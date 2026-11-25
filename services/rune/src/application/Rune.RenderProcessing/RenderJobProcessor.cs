using System.Diagnostics;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Rune.Browser;
using Rune.Core;
using Rune.Event.Contracts;
using Rune.Job.Contracts;
using Rune.Messaging.Abstractions;
using Rune.Pdf;
using Rune.Storage.Abstractions;

namespace Rune.RenderProcessing;

public enum RenderProcessOutcome { Acknowledge, Retry, Terminate }

public interface IRenderJobProcessor
{
    Task<RenderProcessOutcome> ProcessAsync(RenderRequested command, CancellationToken cancellationToken = default);
}

public sealed class RenderJobProcessor(
    IRenderLifecyclePublisher events,
    IRenderJobStore jobs,
    PlaywrightRenderService browser,
    IPdfImportService pdfImport,
    FileSystemRenderCache cache,
    ILogger<RenderJobProcessor> logger,
    IConfiguration? configuration = null,
    RuneOperationalMetrics? metrics = null) : IRenderJobProcessor
{
    private readonly TimeSpan _leaseDuration = TimeSpan.FromSeconds(ParseLeaseSeconds(configuration?["RUNE_JOB_LEASE_SECONDS"]));
    private readonly RuneOperationalMetrics? _metrics = metrics;
    private readonly string _workerId = $"{Environment.MachineName}-{Environment.ProcessId}-{Guid.NewGuid():N}";

    private static readonly JsonSerializerOptions ReportJsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
    };

    private static int ParseLeaseSeconds(string? value) =>
        int.TryParse(value, out var parsed) ? Math.Clamp(parsed, 5, 3600) : 120;

    public async Task<RenderProcessOutcome> ProcessAsync(RenderRequested command, CancellationToken hostCancellationToken = default)
    {
        using var activity = Activity.Current is null
            ? RuneTelemetry.StartConsumerActivity("rune.render.process", command.Metadata)
            : RuneTelemetry.ActivitySource.StartActivity("rune.render.process", ActivityKind.Internal);
        activity?.SetTag("rune.render.id", command.RenderId.ToString("N"));
        var startedAt = Stopwatch.GetTimestamp();
        var initial = await jobs.GetAsync(command.RenderId, hostCancellationToken);
        if (initial is null)
        {
            logger.LogError("Render job {RenderId} was not found", command.RenderId);
            return RenderProcessOutcome.Terminate;
        }
        if (initial.Status == RenderJobStatus.Completed)
        {
            if (_metrics is not null)
                await _metrics.IncrementAsync("rune_message_redelivery_total", cancellationToken: hostCancellationToken);
            if (!string.IsNullOrWhiteSpace(initial.ResultPath) && !string.IsNullOrWhiteSpace(initial.ContentType))
                await PublishCompletedBestEffortAsync(command, initial, hostCancellationToken);
            return RenderProcessOutcome.Acknowledge;
        }
        if (initial.Status is RenderJobStatus.Cancelled or RenderJobStatus.Failed) return RenderProcessOutcome.Terminate;
        if (initial.Status == RenderJobStatus.CancelRequested)
        {
            await CancelUnclaimedAsync(command, initial, hostCancellationToken);
            return RenderProcessOutcome.Acknowledge;
        }

        var lease = await jobs.TryAcquireLeaseAsync(command.RenderId, _workerId, _leaseDuration, hostCancellationToken);
        if (lease is null) return RenderProcessOutcome.Retry;

        var claimed = await jobs.GetAsync(command.RenderId, hostCancellationToken)
            ?? throw new InvalidOperationException($"Claimed render {command.RenderId} disappeared.");
        var attempt = lease.Attempt;
        var package = await jobs.GetPackageAsync(command.RenderId, hostCancellationToken);
        var initialStage = package.SourceType == DocumentSourceType.Pdf ? "starting-pdf-conversion" : "starting-browser";
        var rendering = claimed with { Status = RenderJobStatus.Rendering, ProgressPercent = 5, ProgressStage = initialStage };
        if (!await jobs.SaveOwnedAsync(rendering, lease, hostCancellationToken)) return RenderProcessOutcome.Retry;
        await events.PublishAsync(new RenderStarted(Metadata(command, "started", attempt), command.RenderId, attempt, _workerId), hostCancellationToken);
        await PublishProgressAsync(command, 5, initialStage, attempt, hostCancellationToken);

        using var linkedCancellation = CancellationTokenSource.CreateLinkedTokenSource(hostCancellationToken);
        using var monitorCancellation = CancellationTokenSource.CreateLinkedTokenSource(hostCancellationToken);
        var monitor = MonitorLeaseAndCancellationAsync(command.RenderId, lease, linkedCancellation, monitorCancellation.Token);
        try
        {
            RuneFailureInjection.Trigger("before-render", command.RenderId);
            RenderedArtifact artifact;
            if (package.OutputFormats is { Count: > 0 })
            {
                await UpdateProgressAsync(command, rendering, lease, 20, "rendering-output-set", linkedCancellation.Token);
                artifact = await RenderMultipleAsync(package, command.RenderId, lease, linkedCancellation.Token);
            }
            else if (package.SourceType == DocumentSourceType.Pdf)
            {
                await UpdateProgressAsync(command, rendering, lease, 20, "inspecting-pdf", linkedCancellation.Token);
                artifact = await ConvertPdfAsync(package, command.RenderId, lease, linkedCancellation.Token);
            }
            else
            {
                await UpdateProgressAsync(command, rendering, lease, 20, "rendering", linkedCancellation.Token);
                artifact = await RenderBrowserWithCacheAsync(package, command.RenderId, linkedCancellation.Token);
            }

            await UpdateProgressAsync(command, rendering, lease, 85, "storing-result", linkedCancellation.Token);
            if (artifact.SideArtifacts is not null)
            {
                foreach (var sideArtifact in artifact.SideArtifacts)
                {
                    await using var sideStream = new MemoryStream(sideArtifact.Content, writable: false);
                    if (await jobs.SaveArtifactOwnedAsync(command.RenderId, lease, sideArtifact.FileName, sideStream, linkedCancellation.Token) is null)
                        throw new LeaseLostException(command.RenderId);
                }
            }
            await using var content = artifact.Content;
            var length = await jobs.SaveResultOwnedAsync(command.RenderId, lease, content, artifact.Extension, linkedCancellation.Token);
            if (length is null) throw new LeaseLostException(command.RenderId);
            var completed = rendering with
            {
                Status = RenderJobStatus.Completed,
                ResultPath = $"{command.RenderId:N}/result.{artifact.Extension}",
                ContentType = artifact.ContentType,
                CompletedAt = DateTimeOffset.UtcNow,
                ClaimedBy = null,
                LeaseExpiresAt = null,
                ProgressPercent = 100,
                ProgressStage = "completed",
                ResultLength = length.Value,
                ConversionReportPath = artifact.ConversionReportPath,
                CacheStatus = artifact.CacheStatus,
                CacheFingerprint = artifact.CacheFingerprint,
                CacheSourceRenderId = artifact.CacheSourceRenderId
            };
            if (!await jobs.SaveOwnedAsync(completed, lease, hostCancellationToken)) throw new LeaseLostException(command.RenderId);
            RuneFailureInjection.Trigger("after-commit", command.RenderId);
            await events.PublishAsync(new RenderCompleted(Metadata(command, "completed"), command.RenderId,
                completed.ResultPath, completed.ContentType, length.Value), hostCancellationToken);
            return RenderProcessOutcome.Acknowledge;
        }
        catch (LeaseLostException)
        {
            logger.LogWarning("Render {RenderId} lost lease token {FencingToken}", command.RenderId, lease.FencingToken);
            return RenderProcessOutcome.Retry;
        }
        catch (OperationCanceledException) when (!hostCancellationToken.IsCancellationRequested)
        {
            var current = await jobs.GetAsync(command.RenderId, hostCancellationToken);
            if (current?.Status == RenderJobStatus.CancelRequested &&
                await CancelOwnedAsync(command, current, lease, hostCancellationToken))
                return RenderProcessOutcome.Acknowledge;
            return RenderProcessOutcome.Retry;
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            var current = await jobs.GetAsync(command.RenderId, hostCancellationToken) ?? rendering;
            if (current.Status == RenderJobStatus.Completed)
            {
                logger.LogWarning(exception, "Render {RenderId} committed before acknowledgement; requesting redelivery", command.RenderId);
                return RenderProcessOutcome.Retry;
            }
            var willRetry = attempt < current.MaximumAttempts && exception is not PdfImportException
            {
                Code: "pdf-password-required" or "pdf-encrypted-not-supported" or "pdf-invalid-options" or "pdf-semantic-confidence-too-low" or
                    "pdf-ocr-provider-unavailable" or "pdf-ocr-no-text"
            };
            var error = exception is PdfImportException pdfException ? $"{pdfException.Code}: {pdfException.Message}" : exception.Message;
            var saved = await jobs.SaveOwnedAsync(current with
            {
                Status = willRetry ? RenderJobStatus.Queued : RenderJobStatus.Failed,
                Error = error,
                CompletedAt = willRetry ? null : DateTimeOffset.UtcNow,
                ClaimedBy = null,
                LeaseExpiresAt = null,
                ProgressStage = willRetry ? "retry-pending" : "failed"
            }, lease, hostCancellationToken);
            if (!saved) return RenderProcessOutcome.Retry;
            await PublishFailureBestEffortAsync(command, attempt, error, willRetry, hostCancellationToken);
            logger.LogError(exception, "Render {RenderId} failed on attempt {Attempt}", command.RenderId, attempt);
            return willRetry ? RenderProcessOutcome.Retry : RenderProcessOutcome.Terminate;
        }
        finally
        {
            monitorCancellation.Cancel();
            try { await monitor; }
            catch (OperationCanceledException) { }
            if (_metrics is not null) await _metrics.SetChromiumProcessesAsync(_workerId, 0, CancellationToken.None);
            RuneTelemetry.RenderDuration.Record(Stopwatch.GetElapsedTime(startedAt).TotalSeconds,
                new KeyValuePair<string, object?>("rune.render.id", command.RenderId.ToString("N")));
        }
    }

    private async Task<RenderedArtifact> RenderMultipleAsync(
        RenderPackage package,
        Guid renderId,
        RenderJobLease lease,
        CancellationToken cancellationToken)
    {
        var outputs = package.OutputFormats!.NormalizeOutputSet().ToArray();
        var pending = new List<(RenderArtifactManifestItem Item, byte[] Content)>();
        var sideArtifacts = new Dictionary<string, BrowserSideArtifact>(StringComparer.OrdinalIgnoreCase);
        var sharedHtmlSha256 = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(package.Html)));
        for (var index = 0; index < outputs.Length; index++)
        {
            var format = outputs[index];
            cancellationToken.ThrowIfCancellationRequested();
            await SetOutputProgressAsync(renderId, lease, outputs, format, RenderOutputState.Generating,
                10 + index * 65 / Math.Max(1, outputs.Length), "generating", cancellationToken);
            try
            {
                RenderedArtifact artifact;
                if (format == RenderOutputFormat.InteractiveHtml)
                {
                    artifact = new RenderedArtifact(new MemoryStream(Encoding.UTF8.GetBytes(package.Html), writable: false), "html", "text/html; charset=utf-8", null, "not-applicable");
                }
                else if (format == RenderOutputFormat.StructuredJson)
                {
                    if (package.DocumentModel is null) throw new InvalidOperationException("Structured JSON output requires a document model.");
                    artifact = new RenderedArtifact(new MemoryStream(JsonSerializer.SerializeToUtf8Bytes(package.DocumentModel, ReportJsonOptions), writable: false), "json", "application/vnd.rune.document+json", null, "not-applicable");
                }
                else
                {
                    artifact = await RenderBrowserWithCacheAsync(package with { OutputFormat = format, OutputFormats = null }, renderId, cancellationToken);
                }
                await SetOutputProgressAsync(renderId, lease, outputs, format, RenderOutputState.Validating,
                    15 + index * 65 / Math.Max(1, outputs.Length), "validating", cancellationToken);
                await using var content = artifact.Content;
                using var memory = new MemoryStream();
                await content.CopyToAsync(memory, cancellationToken);
                var bytes = memory.ToArray();
                ValidateArtifactSignature(format, bytes);
                if (artifact.SideArtifacts is not null)
                    foreach (var sideArtifact in artifact.SideArtifacts) sideArtifacts[sideArtifact.FileName] = sideArtifact;
                var fileName = ArtifactFileName(format, package.DocumentName, package.Options.Publication);
                pending.Add((new RenderArtifactManifestItem(
                    format, fileName, artifact.ContentType, bytes.LongLength,
                    Convert.ToHexString(SHA256.HashData(bytes)), artifact.CacheStatus, artifact.CacheFingerprint, artifact.CacheSourceRenderId,
                    lease.FencingToken, "passed", Producer(format), Validator(format), format == RenderOutputFormat.PdfA && outputs.Contains(RenderOutputFormat.Pdf) ? ArtifactFileName(RenderOutputFormat.Pdf, package.DocumentName, package.Options.Publication) : null,
                    sharedHtmlSha256), bytes));
                await SetOutputProgressAsync(renderId, lease, outputs, format, RenderOutputState.ReadyForCommit,
                    20 + (index + 1) * 65 / Math.Max(1, outputs.Length), "ready-for-commit", cancellationToken);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                await SetOutputProgressAsync(renderId, lease, outputs, format, RenderOutputState.Failed,
                    20 + index * 65 / Math.Max(1, outputs.Length), "failed", cancellationToken, exception.Message);
                throw;
            }
        }

        var selectedOutputs = pending.Select(item => item.Item.Format).ToArray();
        var fingerprint = RenderFingerprintBuilder.Build(package, package.Options.CachePolicy?.Scope ?? "deployment");
        var artifactSetId = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{renderId:N}|{string.Join(',', selectedOutputs)}|{fingerprint}")))[..32];
        var manifest = new RenderArtifactSetManifest(
            "1.0", renderId, DateTimeOffset.UtcNow, pending.Select(item => item.Item).ToArray(),
            ArtifactSetId: artifactSetId,
            SourceSha256: package.ContentHash,
            RenderFingerprint: fingerprint,
            SelectedOutputs: selectedOutputs,
            Runtime: new Dictionary<string, string>(StringComparer.Ordinal)
            {
                ["runeVersion"] = RuneVersion.Current,
                ["contractVersion"] = package.ContractVersion,
                ["renderer"] = "playwright-or-direct"
            },
            SharedIntermediates: new Dictionary<string, string>(StringComparer.Ordinal) { ["compiledHtml"] = sharedHtmlSha256 });
        var unsignedManifestBytes = JsonSerializer.SerializeToUtf8Bytes(manifest, ReportJsonOptions);
        manifest = manifest with { ManifestSha256 = Convert.ToHexString(SHA256.HashData(unsignedManifestBytes)) };
        var manifestBytes = JsonSerializer.SerializeToUtf8Bytes(manifest, ReportJsonOptions);

        var writes = pending.Select(entry => new RenderArtifactWrite(entry.Item.FileName, entry.Content, entry.Item.Sha256)).ToList();
        writes.Add(new RenderArtifactWrite("artifact-set-manifest.json", manifestBytes, Convert.ToHexString(SHA256.HashData(manifestBytes))));
        if (!string.IsNullOrWhiteSpace(package.AssemblyManifestJson))
        {
            var bytes = Encoding.UTF8.GetBytes(package.AssemblyManifestJson);
            writes.Add(new RenderArtifactWrite("assembly-manifest.json", bytes, Convert.ToHexString(SHA256.HashData(bytes))));
        }
        if (package.TemplateExpansion is not null)
        {
            var bytes = JsonSerializer.SerializeToUtf8Bytes(package.TemplateExpansion, ReportJsonOptions);
            writes.Add(new RenderArtifactWrite("template-expansion.json", bytes, Convert.ToHexString(SHA256.HashData(bytes))));
        }
        var publication = package.Options.Publication ?? new MultiOutputPublicationOptions();
        if (publication.PackageMode is MultiOutputPackageMode.Zip or MultiOutputPackageMode.ZipAndIndividual)
        {
            var zipBytes = BuildArtifactSetZip(writes, publication, cancellationToken);
            writes.Add(new RenderArtifactWrite("artifact-set.zip", zipBytes, Convert.ToHexString(SHA256.HashData(zipBytes))));
        }
        if (!await jobs.SaveArtifactSetOwnedAsync(renderId, lease, writes, cancellationToken)) throw new LeaseLostException(renderId);
        foreach (var sideArtifact in sideArtifacts.Values)
        {
            await using var sideStream = new MemoryStream(sideArtifact.Content, writable: false);
            if (await jobs.SaveArtifactOwnedAsync(renderId, lease, sideArtifact.FileName, sideStream, cancellationToken) is null)
                throw new LeaseLostException(renderId);
        }
        foreach (var output in outputs)
            await SetOutputProgressAsync(renderId, lease, outputs, output, RenderOutputState.Committed, 100, "committed", cancellationToken);
        return new RenderedArtifact(new MemoryStream(manifestBytes, writable: false), "json", "application/vnd.rune.render-set+json", null,
            pending.Any(item => item.Item.CacheStatus == "hit") ? "mixed-or-hit" : "multi-output");
    }

    private async Task SetOutputProgressAsync(
        Guid renderId,
        RenderJobLease lease,
        IReadOnlyList<RenderOutputFormat> outputs,
        RenderOutputFormat output,
        RenderOutputState state,
        int percent,
        string stage,
        CancellationToken cancellationToken,
        string? error = null)
    {
        var current = await jobs.GetAsync(renderId, cancellationToken) ?? throw new LeaseLostException(renderId);
        var progress = (current.OutputProgress ?? outputs.Select(value => new RenderOutputProgress(value, RenderOutputState.Pending, 0, "pending")).ToArray())
            .Select(item => item.Output == output ? item with { State = state, Percent = percent, Stage = stage, Error = error } : item)
            .ToArray();
        var updated = current with
        {
            OutputProgress = progress,
            ProgressPercent = Math.Clamp(progress.Sum(item => item.Percent) / Math.Max(1, progress.Length), 0, 99),
            ProgressStage = $"output:{output.ToString().ToLowerInvariant()}:{stage}",
            FailedOutput = state == RenderOutputState.Failed ? output : current.FailedOutput,
            FailedStage = state == RenderOutputState.Failed ? stage : current.FailedStage
        };
        if (!await jobs.SaveOwnedAsync(updated, lease, cancellationToken)) throw new LeaseLostException(renderId);
    }

    private static byte[] BuildArtifactSetZip(
        IReadOnlyList<RenderArtifactWrite> writes,
        MultiOutputPublicationOptions publication,
        CancellationToken cancellationToken)
    {
        if (writes.Count > publication.MaximumZipEntries) throw new InvalidOperationException("Artifact ZIP exceeds maximumZipEntries.");
        using var memory = new MemoryStream();
        using (var archive = new ZipArchive(memory, ZipArchiveMode.Create, leaveOpen: true))
        {
            foreach (var write in writes.OrderBy(item => item.Name, StringComparer.Ordinal))
            {
                cancellationToken.ThrowIfCancellationRequested();
                var entry = archive.CreateEntry(write.Name, CompressionLevel.Optimal);
                entry.LastWriteTime = DateTimeOffset.UnixEpoch;
                using var stream = entry.Open();
                stream.Write(write.Content);
            }
        }
        if (memory.Length > publication.MaximumZipBytes) throw new InvalidOperationException("Artifact ZIP exceeds maximumZipBytes.");
        return memory.ToArray();
    }

    private static string ArtifactFileName(RenderOutputFormat format, string documentName, MultiOutputPublicationOptions? publication)
    {
        var safeDocument = Regex.Replace(Path.GetFileNameWithoutExtension(documentName ?? "document"), "[^A-Za-z0-9._-]+", "-").Trim('-', '.');
        if (string.IsNullOrWhiteSpace(safeDocument)) safeDocument = "document";
        var output = format.ToString();
        var pattern = publication?.ArtifactNamePattern ?? "{documentName}.{outputExtension}";
        var value = pattern.Replace("{documentName}", safeDocument, StringComparison.Ordinal)
            .Replace("{output}", output, StringComparison.Ordinal)
            .Replace("{outputExtension}", format.OutputExtension(), StringComparison.Ordinal);
        if (value.Contains("..", StringComparison.Ordinal) || value.Contains('/') || value.Contains('\\') || !Regex.IsMatch(value, "^[A-Za-z0-9][A-Za-z0-9._-]{0,239}$"))
            throw new InvalidOperationException("Artifact name pattern produced an unsafe name.");
        return value;
    }

    private static string Producer(RenderOutputFormat format) => format is RenderOutputFormat.InteractiveHtml or RenderOutputFormat.StructuredJson
        ? "rune-compiled-document" : "rune-playwright";

    private static string? Validator(RenderOutputFormat format) => format switch
    {
        RenderOutputFormat.PdfA => "rune-pdfa-validator",
        RenderOutputFormat.Pdf => "pdf-signature-validator",
        RenderOutputFormat.Png or RenderOutputFormat.Jpeg or RenderOutputFormat.Svg => "image-signature-validator",
        _ => "content-validator"
    };

    private static void ValidateArtifactSignature(RenderOutputFormat format, byte[] content)
    {
        if (content.Length == 0) throw new InvalidDataException($"Generated {format} artifact is empty.");
        var valid = format switch
        {
            RenderOutputFormat.Pdf or RenderOutputFormat.PdfA => content.AsSpan().StartsWith("%PDF-"u8),
            RenderOutputFormat.Png => content.AsSpan().StartsWith(new byte[] { 0x89, 0x50, 0x4E, 0x47 }),
            RenderOutputFormat.Jpeg => content.Length >= 2 && content[0] == 0xFF && content[1] == 0xD8,
            RenderOutputFormat.Svg => Encoding.UTF8.GetString(content.AsSpan(0, Math.Min(content.Length, 1024))).Contains("<svg", StringComparison.OrdinalIgnoreCase),
            RenderOutputFormat.InteractiveHtml or RenderOutputFormat.StaticHtml => Encoding.UTF8.GetString(content.AsSpan(0, Math.Min(content.Length, 2048))).Contains("html", StringComparison.OrdinalIgnoreCase),
            RenderOutputFormat.StructuredJson => content[0] is (byte)'{' or (byte)'[',
            _ => false
        };
        if (!valid) throw new InvalidDataException($"Generated {format} artifact has an invalid signature.");
    }

    private async Task<RenderedArtifact> RenderBrowserWithCacheAsync(RenderPackage package, Guid renderId, CancellationToken cancellationToken)
    {
        var policy = package.Options.CachePolicy ?? new RenderCachePolicy();
        ValidateCachePolicy(policy);
        if (policy.Mode == RenderCacheMode.Bypass || !IsCacheEligible(package))
        {
            var direct = await RenderBrowserAsync(package, renderId, cancellationToken);
            return new RenderedArtifact(direct.Content, direct.Extension, direct.ContentType, null, "bypass", SideArtifacts: direct.SideArtifacts);
        }

        var fingerprint = RenderFingerprintBuilder.Build(package, policy.Scope);
        var maximumAge = TimeSpan.FromSeconds(policy.MaximumAgeSeconds);
        Func<Guid, CancellationToken, ValueTask<bool>>? reauthorize = policy.ReauthorizeOnHit ? ReauthorizeCacheHitAsync : null;
        if (policy.Mode is RenderCacheMode.Read or RenderCacheMode.Use)
        {
            var hit = await cache.TryReadAsync(policy.Scope, fingerprint, maximumAge, cancellationToken,
                policy.InvalidationToken, policy.SecurityLabel, reauthorize, policy.QuarantineCorruptEntries);
            if (hit is not null)
            {
                await IncrementMetricAsync("rune_cache_hit_total", cancellationToken);
                return new RenderedArtifact(new MemoryStream(hit.Content, writable: false), hit.Extension, hit.ContentType, null, "hit", fingerprint, hit.SourceRenderId);
            }
        }

        if (policy.Mode is RenderCacheMode.Write or RenderCacheMode.Use or RenderCacheMode.Refresh)
        {
            var waitStartedAt = Stopwatch.GetTimestamp();
            await using var cacheLease = await cache.AcquireAsync(policy.Scope, fingerprint, cancellationToken,
                policy.DistributedLockTimeoutSeconds, policy.StaleLockSeconds);
            if (_metrics is not null)
                await _metrics.ObserveAsync("rune_cache_wait_seconds", Stopwatch.GetElapsedTime(waitStartedAt).TotalSeconds, cancellationToken);
            if (policy.Mode == RenderCacheMode.Use)
            {
                var hit = await cache.TryReadAsync(policy.Scope, fingerprint, maximumAge, cancellationToken,
                    policy.InvalidationToken, policy.SecurityLabel, reauthorize, policy.QuarantineCorruptEntries);
                if (hit is not null)
                {
                    await IncrementMetricAsync("rune_cache_hit_total", cancellationToken);
                    return new RenderedArtifact(new MemoryStream(hit.Content, writable: false), hit.Extension, hit.ContentType, null, "hit", fingerprint, hit.SourceRenderId);
                }
            }
            await IncrementMetricAsync("rune_cache_miss_total", cancellationToken);
            var rendered = await RenderBrowserAsync(package, renderId, cancellationToken);
            await using var stream = rendered.Content;
            using var memory = new MemoryStream();
            await stream.CopyToAsync(memory, cancellationToken);
            var bytes = memory.ToArray();
            if (policy.StoreResult)
                await cache.PublishAsync(policy.Scope, fingerprint, renderId, rendered.Extension, rendered.ContentType, bytes, cancellationToken,
                    policy.MaximumScopeBytes, policy.MaximumScopeEntries, policy.InvalidationToken, policy.StaleLockSeconds, cacheLease.FencingToken,
                    policy.SecurityLabel, policy.EncryptSensitiveEntries);
            return new RenderedArtifact(new MemoryStream(bytes, writable: false), rendered.Extension, rendered.ContentType, null,
                policy.Mode == RenderCacheMode.Refresh ? "refresh" : "miss", fingerprint, null, rendered.SideArtifacts);
        }

        await IncrementMetricAsync("rune_cache_miss_total", cancellationToken);
        var uncached = await RenderBrowserAsync(package, renderId, cancellationToken);
        return new RenderedArtifact(uncached.Content, uncached.Extension, uncached.ContentType, null, "miss", fingerprint, SideArtifacts: uncached.SideArtifacts);
    }

    private async ValueTask<BrowserRenderResult> RenderBrowserAsync(RenderPackage package, Guid renderId, CancellationToken cancellationToken)
    {
        RuneFailureInjection.Trigger("during-chromium", renderId);
        var stopwatch = Stopwatch.StartNew();
        if (_metrics is not null) await _metrics.SetChromiumProcessesAsync(_workerId, 1, cancellationToken);
        try
        {
            return await browser.RenderAsync(package, cancellationToken);
        }
        finally
        {
            stopwatch.Stop();
            if (_metrics is not null)
            {
                await _metrics.ObserveAsync("rune_render_duration_seconds", stopwatch.Elapsed.TotalSeconds, CancellationToken.None);
                await _metrics.SetChromiumProcessesAsync(_workerId, 0, CancellationToken.None);
            }
        }
    }

    private static bool IsCacheEligible(RenderPackage package)
    {
        if (package.SourceType == DocumentSourceType.Pdf) return false;
        if (package.Options.CachePolicy?.RequireDeterministicInputs != true) return true;
        var source = package.Html + "\n" + package.Options.AdditionalCss;
        return !Regex.IsMatch(source, "(?:src|href)\\s*=\\s*[\\\"']https?://|url\\(\\s*[\\\"']?https?://|Math\\.random\\s*\\(|Date\\.now\\s*\\(", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    }

    private static void ValidateCachePolicy(RenderCachePolicy policy)
    {
        if (!string.Equals(policy.Store, "filesystem", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(policy.Store, "shared-filesystem", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException($"Cache store '{policy.Store}' is not supported by this deployment. Supported stores: filesystem, shared-filesystem.");
        if (policy.MaximumAgeSeconds is < 1 or > 31_536_000)
            throw new InvalidOperationException("Cache maximumAgeSeconds must be between 1 second and 365 days.");
        if (policy.SecurityLabel is { Length: > 128 })
            throw new InvalidOperationException("Cache securityLabel is too long.");
        if (IsSensitiveLabel(policy.SecurityLabel) && !policy.EncryptSensitiveEntries)
            throw new InvalidOperationException("Sensitive cache entries require encryptSensitiveEntries=true.");
    }

    private static bool IsSensitiveLabel(string? securityLabel) =>
        securityLabel is not null &&
        (securityLabel.Equals("confidential", StringComparison.OrdinalIgnoreCase) ||
         securityLabel.Equals("restricted", StringComparison.OrdinalIgnoreCase) ||
         securityLabel.Equals("highly-confidential", StringComparison.OrdinalIgnoreCase));

    private async ValueTask<bool> ReauthorizeCacheHitAsync(Guid sourceRenderId, CancellationToken cancellationToken)
    {
        var source = await jobs.GetAsync(sourceRenderId, cancellationToken);
        return source?.Status == RenderJobStatus.Completed && source.ResultPath is not null;
    }

    private async Task<RenderedArtifact> ConvertPdfAsync(
        RenderPackage package,
        Guid renderId,
        RenderJobLease lease,
        CancellationToken cancellationToken)
    {
        if (package.OutputFormat != RenderOutputFormat.StaticHtml)
            throw new PdfImportException("pdf-output-invalid", "PDF input currently supports only staticHtml output.");
        var sourcePath = package.SourceResourcePath ?? throw new PdfImportException("pdf-source-missing", "SourceResourcePath is required for PDF input.");
        var resource = package.Resources?.SingleOrDefault(item => string.Equals(item.Path, sourcePath, StringComparison.OrdinalIgnoreCase))
            ?? throw new PdfImportException("pdf-source-missing", $"PDF resource '{sourcePath}' was not found in the render package.");
        var conversion = await pdfImport.ConvertAsync(new PdfImportRequest(resource.Content, package.PdfImport ?? new PdfImportOptions(), sourcePath), cancellationToken);
        foreach (var artifact in conversion.Artifacts)
        {
            await using var artifactStream = new MemoryStream(artifact.Content, writable: false);
            if (await jobs.SaveArtifactOwnedAsync(renderId, lease, artifact.FileName, artifactStream, cancellationToken) is null)
                throw new LeaseLostException(renderId);
        }
        var report = conversion.Report with { AtomicPublication = true };
        var reportBytes = JsonSerializer.SerializeToUtf8Bytes(report, ReportJsonOptions);
        await using var reportStream = new MemoryStream(reportBytes, writable: false);
        if (await jobs.SaveArtifactOwnedAsync(renderId, lease, "conversion-report.json", reportStream, cancellationToken) is null)
            throw new LeaseLostException(renderId);
        return new RenderedArtifact(new MemoryStream(Encoding.UTF8.GetBytes(conversion.Html), writable: false), "html", "text/html; charset=utf-8", $"{renderId:N}/conversion-report.json");
    }

    private async Task CancelUnclaimedAsync(RenderRequested command, RenderJob job, CancellationToken cancellationToken)
    {
        var cancelled = job with
        {
            Status = RenderJobStatus.Cancelled,
            CompletedAt = DateTimeOffset.UtcNow,
            ClaimedBy = null,
            LeaseExpiresAt = null,
            ProgressStage = "cancelled"
        };
        await jobs.SaveAsync(cancelled, cancellationToken);
        await events.PublishAsync(new RenderCancelled(Metadata(command, "cancelled"), command.RenderId,
            job.Error ?? "Cancellation requested."), cancellationToken);
    }

    private async Task<bool> CancelOwnedAsync(
        RenderRequested command,
        RenderJob job,
        RenderJobLease lease,
        CancellationToken cancellationToken)
    {
        var cancelled = job with
        {
            Status = RenderJobStatus.Cancelled,
            CompletedAt = DateTimeOffset.UtcNow,
            ClaimedBy = null,
            LeaseExpiresAt = null,
            ProgressStage = "cancelled"
        };
        if (!await jobs.SaveOwnedAsync(cancelled, lease, cancellationToken)) return false;
        await events.PublishAsync(new RenderCancelled(Metadata(command, "cancelled"), command.RenderId,
            job.Error ?? "Cancellation requested."), cancellationToken);
        return true;
    }

    private async Task MonitorLeaseAndCancellationAsync(
        Guid id,
        RenderJobLease lease,
        CancellationTokenSource renderCancellation,
        CancellationToken monitorCancellationToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(2));
        while (await timer.WaitForNextTickAsync(monitorCancellationToken))
        {
            var job = await jobs.GetAsync(id, monitorCancellationToken);
            if (job is null || job.Status == RenderJobStatus.CancelRequested)
            {
                renderCancellation.Cancel();
                return;
            }
            if (!await jobs.RenewLeaseAsync(id, lease.WorkerId, lease.FencingToken, _leaseDuration, monitorCancellationToken))
            {
                renderCancellation.Cancel();
                return;
            }
        }
    }

    private async Task UpdateProgressAsync(
        RenderRequested command,
        RenderJob baseline,
        RenderJobLease lease,
        int percent,
        string stage,
        CancellationToken cancellationToken)
    {
        var current = await jobs.GetAsync(command.RenderId, cancellationToken) ?? baseline;
        if (!await jobs.SaveOwnedAsync(current with { ProgressPercent = percent, ProgressStage = stage }, lease, cancellationToken))
            throw new LeaseLostException(command.RenderId);
        await PublishProgressAsync(command, percent, stage, lease.Attempt, cancellationToken);
    }

    private ValueTask PublishProgressAsync(
        RenderRequested command,
        int percent,
        string stage,
        int attempt,
        CancellationToken cancellationToken) =>
        events.PublishAsync(new RenderProgressed(Metadata(command, "progress:" + stage, attempt), command.RenderId, percent, stage), cancellationToken);

    private async Task PublishCompletedBestEffortAsync(RenderRequested command, RenderJob job, CancellationToken cancellationToken)
    {
        try
        {
            await events.PublishAsync(new RenderCompleted(Metadata(command, "completed"), command.RenderId,
                job.ResultPath!, job.ContentType!, job.ResultLength ?? 0), cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            logger.LogWarning(exception, "Completion event replay failed for {RenderId}", command.RenderId);
        }
    }

    private async Task PublishFailureBestEffortAsync(
        RenderRequested command,
        int attempt,
        string error,
        bool willRetry,
        CancellationToken cancellationToken)
    {
        try
        {
            await events.PublishAsync(new RenderFailed(Metadata(command, "failed", attempt), command.RenderId,
                attempt, error, willRetry), cancellationToken);
        }
        catch (Exception eventError) when (eventError is not OperationCanceledException)
        {
            logger.LogWarning(eventError, "Failure event could not be published for {RenderId}", command.RenderId);
        }
    }

    private async ValueTask IncrementMetricAsync(string name, CancellationToken cancellationToken)
    {
        if (_metrics is not null) await _metrics.IncrementAsync(name, cancellationToken: cancellationToken);
    }

    private static EventMetadata Metadata(RenderRequested command, string kind, int attempt = 0)
    {
        var material = Encoding.UTF8.GetBytes($"{command.Metadata.EventId:N}|{command.RenderId:N}|{kind}|{attempt}");
        var eventId = new Guid(SHA256.HashData(material).AsSpan(0, 16));
        return new EventMetadata(eventId, command.RenderId, command.Metadata.EventId, "1.0", DateTimeOffset.UtcNow, command.Metadata.Headers);
    }

    private sealed class LeaseLostException(Guid renderId) : Exception($"Render {renderId} lost its fencing token.");

    private sealed record RenderedArtifact(
        Stream Content,
        string Extension,
        string ContentType,
        string? ConversionReportPath,
        string? CacheStatus = null,
        string? CacheFingerprint = null,
        Guid? CacheSourceRenderId = null,
        IReadOnlyList<BrowserSideArtifact>? SideArtifacts = null);
}
