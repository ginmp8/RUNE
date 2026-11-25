using System.Collections.Concurrent;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Channels;
using Rune.Api.Contracts;
using Rune.Job.Contracts;
using Rune.Storage.Abstractions;

namespace Rune.Application;

public sealed class ComparisonJobService
{
    private const long MaximumArtifactBytes = 100_000_000;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
    };

    private readonly IRenderJobStore _renders;
    private readonly ArtifactComparisonService _comparison;
    private readonly string _root;
    private readonly Channel<Guid> _queue = Channel.CreateUnbounded<Guid>(new UnboundedChannelOptions
    {
        SingleReader = true,
        SingleWriter = false,
        AllowSynchronousContinuations = false
    });
    private readonly ConcurrentDictionary<Guid, CancellationTokenSource> _running = new();
    private readonly SemaphoreSlim _mutation = new(1, 1);
    private int _recovered;

    public ComparisonJobService(IRenderJobStore renders, ArtifactComparisonService comparison, string dataRoot)
    {
        _renders = renders;
        _comparison = comparison;
        _root = Path.Combine(Path.GetFullPath(dataRoot), "comparisons");
        Directory.CreateDirectory(_root);
        Directory.CreateDirectory(Path.Combine(_root, ".idempotency"));
    }

    public async ValueTask<ComparisonJobAccepted> CreateAsync(
        CreateComparisonJobRequest request,
        string tenant,
        CancellationToken cancellationToken = default)
    {
        tenant = NormalizeTenant(tenant);
        var profile = request.Profile ?? new ArtifactComparisonProfile();
        ValidateRequest(request, profile);
        var profileDigest = Digest(profile);
        var idempotencyIdentity = request.IdempotencyKey is null
            ? null
            : Digest(new
            {
                tenant,
                request.IdempotencyKey,
                request.Left,
                request.Right,
                profileDigest
            });

        await _mutation.WaitAsync(cancellationToken);
        try
        {
            if (idempotencyIdentity is not null)
            {
                var existingPath = IdempotencyPath(idempotencyIdentity);
                if (File.Exists(existingPath) && Guid.TryParse(await File.ReadAllTextAsync(existingPath, cancellationToken), out var existingId))
                {
                    var existing = await GetStateAsync(existingId, cancellationToken);
                    if (existing is not null)
                        return Accepted(existing.Id, "idempotency-hit");
                }
            }

            var now = DateTimeOffset.UtcNow;
            var id = Guid.NewGuid();
            var state = new ComparisonJobState(
                id,
                ComparisonJobStatus.Queued,
                request.Left,
                request.Right,
                profile,
                profileDigest,
                tenant,
                0,
                "queued",
                0,
                3,
                now,
                RetainUntil: now.AddDays(request.RetentionDays),
                IdempotencyIdentity: idempotencyIdentity);
            var directory = JobDirectory(id);
            Directory.CreateDirectory(directory);
            await AtomicWriteAsync(Path.Combine(directory, "request.json"), JsonSerializer.SerializeToUtf8Bytes(request, JsonOptions), cancellationToken);
            await SaveStateAsync(state, cancellationToken);
            if (idempotencyIdentity is not null)
                await AtomicWriteAsync(IdempotencyPath(idempotencyIdentity), Encoding.UTF8.GetBytes(id.ToString("D")), cancellationToken);
            await _queue.Writer.WriteAsync(id, cancellationToken);
            return Accepted(id, null);
        }
        finally
        {
            _mutation.Release();
        }
    }

    public async ValueTask<ComparisonJobResponse?> GetAsync(Guid id, string tenant, CancellationToken cancellationToken = default)
    {
        var state = await GetStateAsync(id, cancellationToken);
        if (state is null || !string.Equals(state.Tenant, NormalizeTenant(tenant), StringComparison.Ordinal)) return null;
        return ToResponse(state);
    }

    public async ValueTask<bool> CancelAsync(Guid id, string tenant, string? reason, CancellationToken cancellationToken = default)
    {
        await _mutation.WaitAsync(cancellationToken);
        try
        {
            var state = await GetStateAsync(id, cancellationToken);
            if (state is null || !string.Equals(state.Tenant, NormalizeTenant(tenant), StringComparison.Ordinal)) return false;
            if (state.Status is ComparisonJobStatus.Completed or ComparisonJobStatus.Cancelled or ComparisonJobStatus.Failed) return false;
            state = state with
            {
                Status = ComparisonJobStatus.CancelRequested,
                ProgressStage = "cancel-requested",
                Error = string.IsNullOrWhiteSpace(reason) ? state.Error : SafeMessage(reason)
            };
            await SaveStateAsync(state, cancellationToken);
            if (_running.TryGetValue(id, out var running)) running.Cancel();
            return true;
        }
        finally { _mutation.Release(); }
    }

    public async ValueTask<bool> RetryAsync(Guid id, string tenant, bool resetAttempts, CancellationToken cancellationToken = default)
    {
        await _mutation.WaitAsync(cancellationToken);
        try
        {
            var state = await GetStateAsync(id, cancellationToken);
            if (state is null || !string.Equals(state.Tenant, NormalizeTenant(tenant), StringComparison.Ordinal)) return false;
            if (state.Status is not (ComparisonJobStatus.Failed or ComparisonJobStatus.Cancelled)) return false;
            if (!resetAttempts && state.Attempt >= state.MaximumAttempts) return false;
            state = state with
            {
                Status = ComparisonJobStatus.Queued,
                ProgressPercent = 0,
                ProgressStage = "queued",
                Attempt = resetAttempts ? 0 : state.Attempt,
                StartedAt = null,
                CompletedAt = null,
                Outcome = null,
                Error = null
            };
            await SaveStateAsync(state, cancellationToken);
            await _queue.Writer.WriteAsync(id, cancellationToken);
            return true;
        }
        finally { _mutation.Release(); }
    }

    public async ValueTask<Stream?> OpenArtifactAsync(Guid id, string tenant, string name, CancellationToken cancellationToken = default)
    {
        var state = await GetStateAsync(id, cancellationToken);
        if (state is null || state.Status != ComparisonJobStatus.Completed ||
            !string.Equals(state.Tenant, NormalizeTenant(tenant), StringComparison.Ordinal)) return null;
        if (name is not ("comparison-report.json" or "comparison-report.html" or "comparison-manifest.json")) return null;
        var path = Path.Combine(JobDirectory(id), "artifacts", name);
        return File.Exists(path)
            ? new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 64 * 1024, FileOptions.Asynchronous | FileOptions.SequentialScan)
            : null;
    }

    public async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (Interlocked.Exchange(ref _recovered, 1) == 0)
        {
            foreach (var statePath in Directory.EnumerateFiles(_root, "job.json", SearchOption.AllDirectories))
            {
                stoppingToken.ThrowIfCancellationRequested();
                var state = await ReadStatePathAsync(statePath, stoppingToken);
                if (state?.Status is ComparisonJobStatus.Queued or ComparisonJobStatus.Running or ComparisonJobStatus.CancelRequested)
                    await _queue.Writer.WriteAsync(state.Id, stoppingToken);
            }
        }

        await foreach (var id in _queue.Reader.ReadAllAsync(stoppingToken))
        {
            try { await ProcessAsync(id, stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch { /* ProcessAsync persists a safe terminal state. */ }
        }
    }

    private async Task ProcessAsync(Guid id, CancellationToken stoppingToken)
    {
        var initial = await GetStateAsync(id, stoppingToken);
        if (initial is null || initial.Status is ComparisonJobStatus.Completed or ComparisonJobStatus.Cancelled) return;
        if (initial.Status == ComparisonJobStatus.CancelRequested)
        {
            await SaveStateAsync(initial with
            {
                Status = ComparisonJobStatus.Cancelled,
                ProgressPercent = 100,
                ProgressStage = "cancelled",
                CompletedAt = DateTimeOffset.UtcNow
            }, stoppingToken);
            return;
        }
        if (initial.Attempt >= initial.MaximumAttempts)
        {
            await SaveStateAsync(initial with
            {
                Status = ComparisonJobStatus.Failed,
                Outcome = ComparisonOutcome.Failed,
                ProgressPercent = 100,
                ProgressStage = "failed",
                Error = "comparison-attempts-exhausted",
                CompletedAt = DateTimeOffset.UtcNow
            }, stoppingToken);
            return;
        }

        using var linked = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
        if (!_running.TryAdd(id, linked)) return;
        var state = initial with
        {
            Status = ComparisonJobStatus.Running,
            ProgressPercent = 5,
            ProgressStage = "authorizing",
            Attempt = initial.Attempt + 1,
            StartedAt = initial.StartedAt ?? DateTimeOffset.UtcNow,
            Error = null
        };
        await SaveStateAsync(state, stoppingToken);
        try
        {
            var left = await ReadSourceAsync(state.Left, state.Tenant, linked.Token);
            state = state with { ProgressPercent = 25, ProgressStage = "reading-right" };
            await SaveStateAsync(state, linked.Token);
            var right = await ReadSourceAsync(state.Right, state.Tenant, linked.Token);
            state = state with { ProgressPercent = 45, ProgressStage = "comparing" };
            await SaveStateAsync(state, linked.Token);

            var profile = state.Profile;
            var comparisonRequest = new ArtifactComparisonRequest(
                new ArtifactComparisonInput(left.Name, Convert.ToBase64String(left.Content), left.ContentType),
                new ArtifactComparisonInput(right.Name, Convert.ToBase64String(right.Content), right.ContentType),
                profile.NormalizeText && profile.CompareSemantic,
                profile.IncludeByteRanges && profile.CompareIdentity,
                profile.MaximumReportedRanges,
                new ArtifactComparisonOptions(
                    profile.CompareVisual,
                    profile.CompareOcr,
                    profile.CanonicalizePdf && profile.CompareStructure,
                    profile.PixelTolerancePercent,
                    profile.MaximumPixelMismatchRatio,
                    profile.MinimumOcrSimilarity,
                    profile.RasterDpi,
                    profile.OcrLanguage,
                    profile.TimeoutSeconds,
                    IncludePixelDiff: profile.CompareVisual));
            var result = await _comparison.CompareAsync(comparisonRequest, linked.Token);
            var outcome = result.Identical
                ? ComparisonOutcome.Identical
                : result.SemanticallyEquivalent
                    ? ComparisonOutcome.EquivalentUnderProfile
                    : ComparisonOutcome.Different;
            var securityLabel = MoreRestrictive(left.SecurityLabel, right.SecurityLabel);
            state = state with { ProgressPercent = 80, ProgressStage = "publishing", SecurityLabel = securityLabel };
            await SaveStateAsync(state, linked.Token);
            await PublishReportsAsync(state, result, outcome, left, right, linked.Token);
            await SaveStateAsync(state with
            {
                Status = ComparisonJobStatus.Completed,
                Outcome = outcome,
                ProgressPercent = 100,
                ProgressStage = "completed",
                CompletedAt = DateTimeOffset.UtcNow,
                ReportPublished = true
            }, linked.Token);
        }
        catch (OperationCanceledException) when (!stoppingToken.IsCancellationRequested)
        {
            var current = await GetStateAsync(id, CancellationToken.None) ?? state;
            await SaveStateAsync(current with
            {
                Status = ComparisonJobStatus.Cancelled,
                ProgressPercent = 100,
                ProgressStage = "cancelled",
                CompletedAt = DateTimeOffset.UtcNow
            }, CancellationToken.None);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            var current = await GetStateAsync(id, CancellationToken.None) ?? state;
            await SaveStateAsync(current with
            {
                Status = ComparisonJobStatus.Failed,
                Outcome = ComparisonOutcome.Failed,
                ProgressPercent = 100,
                ProgressStage = "failed",
                Error = SafeMessage(exception.Message),
                CompletedAt = DateTimeOffset.UtcNow
            }, CancellationToken.None);
        }
        finally
        {
            _running.TryRemove(id, out _);
        }
    }

    private async ValueTask<ComparisonSource> ReadSourceAsync(ComparisonArtifactReference reference, string tenant, CancellationToken cancellationToken)
    {
        ValidateReference(reference);
        var render = await _renders.GetAsync(reference.RenderId, cancellationToken)
            ?? throw new InvalidOperationException($"Render {reference.RenderId} was not found.");
        if (render.Status != RenderJobStatus.Completed)
            throw new InvalidOperationException($"Render {reference.RenderId} is not completed.");
        var sourceTenant = Header(render.DispatchHeaders, "X-RUNE-Tenant") ?? "default";
        if (!string.Equals(sourceTenant, tenant, StringComparison.Ordinal))
            throw new UnauthorizedAccessException("Comparison source authorization failed.");
        Stream? stream;
        string name;
        string contentType;
        if (reference.ArtifactName is "content" or "result")
        {
            stream = await _renders.OpenResultAsync(reference.RenderId, cancellationToken);
            name = $"{reference.RenderId:N}.{ExtensionFor(render.ContentType)}";
            contentType = render.ContentType ?? "application/octet-stream";
        }
        else
        {
            stream = await _renders.OpenArtifactAsync(reference.RenderId, reference.ArtifactName, cancellationToken);
            name = reference.ArtifactName;
            contentType = ContentTypeFor(reference.ArtifactName);
        }
        if (stream is null) throw new FileNotFoundException($"Artifact '{reference.ArtifactName}' was not found for render {reference.RenderId}.");
        await using (stream)
        {
            var content = await ReadBoundedAsync(stream, MaximumArtifactBytes, cancellationToken);
            return new ComparisonSource(name, contentType, content, render.Options.CachePolicy?.SecurityLabel);
        }
    }

    private async ValueTask PublishReportsAsync(
        ComparisonJobState state,
        ArtifactComparisonResponse result,
        ComparisonOutcome outcome,
        ComparisonSource left,
        ComparisonSource right,
        CancellationToken cancellationToken)
    {
        var directory = JobDirectory(state.Id);
        var target = Path.Combine(directory, "artifacts");
        var stage = Path.Combine(directory, ".report-stage-" + Guid.NewGuid().ToString("N"));
        var backup = Path.Combine(directory, ".report-backup-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(stage);
        try
        {
            var report = new
            {
                contractVersion = "comparison-report-v1",
                comparisonId = state.Id,
                outcome,
                orderedIdentity = new { state.Left, state.Right },
                profile = state.Profile,
                state.ProfileDigest,
                state.Tenant,
                state.SecurityLabel,
                classification = state.SecurityLabel ?? "internal",
                thresholds = new
                {
                    state.Profile.PixelTolerancePercent,
                    state.Profile.MaximumPixelMismatchRatio,
                    state.Profile.MinimumOcrSimilarity
                },
                ignoredFields = state.Profile.IgnoredFields ?? [],
                severity = outcome is ComparisonOutcome.Identical ? "none" : outcome is ComparisonOutcome.EquivalentUnderProfile ? "informational" : "material",
                confidence = result.Pixel?.Executed == true || result.Ocr?.Executed == true ? "high" : "standard",
                result
            };
            var reportBytes = JsonSerializer.SerializeToUtf8Bytes(report, JsonOptions);
            await File.WriteAllBytesAsync(Path.Combine(stage, "comparison-report.json"), reportBytes, cancellationToken);
            var html = BuildHtmlReport(state, result, outcome);
            await File.WriteAllTextAsync(Path.Combine(stage, "comparison-report.html"), html, Encoding.UTF8, cancellationToken);
            var manifest = new
            {
                contractVersion = "comparison-manifest-v1",
                comparisonId = state.Id,
                createdAt = DateTimeOffset.UtcNow,
                outcome,
                state.ProfileDigest,
                state.SecurityLabel,
                sources = new[]
                {
                    new { side = "left", reference = state.Left, left.Name, left.ContentType, length = left.Content.LongLength, sha256 = Convert.ToHexString(SHA256.HashData(left.Content)) },
                    new { side = "right", reference = state.Right, right.Name, right.ContentType, length = right.Content.LongLength, sha256 = Convert.ToHexString(SHA256.HashData(right.Content)) }
                },
                artifacts = new[]
                {
                    ManifestItem(stage, "comparison-report.json", "application/json"),
                    ManifestItem(stage, "comparison-report.html", "text/html; charset=utf-8")
                },
                atomicPublication = true,
                commitProtocol = "stage-verify-rename"
            };
            await File.WriteAllBytesAsync(Path.Combine(stage, "comparison-manifest.json"), JsonSerializer.SerializeToUtf8Bytes(manifest, JsonOptions), cancellationToken);
            if (Directory.Exists(target)) Directory.Move(target, backup);
            Directory.Move(stage, target);
            TryDeleteDirectory(backup);
        }
        catch
        {
            if (!Directory.Exists(target) && Directory.Exists(backup)) Directory.Move(backup, target);
            throw;
        }
        finally
        {
            TryDeleteDirectory(stage);
            TryDeleteDirectory(backup);
        }
    }

    private static object ManifestItem(string root, string name, string contentType)
    {
        var bytes = File.ReadAllBytes(Path.Combine(root, name));
        return new { name, contentType, length = bytes.LongLength, sha256 = Convert.ToHexString(SHA256.HashData(bytes)) };
    }

    private static string BuildHtmlReport(ComparisonJobState state, ArtifactComparisonResponse result, ComparisonOutcome outcome)
    {
        static string E(object? value) => WebUtility.HtmlEncode(Convert.ToString(value, System.Globalization.CultureInfo.InvariantCulture) ?? string.Empty);
        var diagnostics = string.Join(string.Empty, result.Diagnostics.Select(item => $"<li>{E(item)}</li>"));
        return "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
               "<title>RUNE comparison report</title><style>body{font-family:system-ui,sans-serif;max-width:1000px;margin:2rem auto;padding:0 1rem}table{border-collapse:collapse;width:100%}td,th{border:1px solid #bbb;padding:.5rem;text-align:left}code{overflow-wrap:anywhere}</style></head><body>" +
               $"<h1>Artifact comparison</h1><p><strong>Outcome:</strong> {E(outcome)}</p><p><strong>Profile:</strong> {E(state.Profile.Name)} {E(state.Profile.Version)} (<code>{E(state.ProfileDigest)}</code>)</p>" +
               $"<table><thead><tr><th></th><th>Left</th><th>Right</th></tr></thead><tbody><tr><th>Name</th><td>{E(result.Left.Name)}</td><td>{E(result.Right.Name)}</td></tr><tr><th>Type</th><td>{E(result.Left.ContentType)}</td><td>{E(result.Right.ContentType)}</td></tr><tr><th>Length</th><td>{result.Left.Length}</td><td>{result.Right.Length}</td></tr><tr><th>SHA-256</th><td><code>{E(result.Left.Sha256)}</code></td><td><code>{E(result.Right.Sha256)}</code></td></tr></tbody></table>" +
               $"<h2>Diagnostics</h2><ul>{diagnostics}</ul></body></html>";
    }

    private async ValueTask<ComparisonJobState?> GetStateAsync(Guid id, CancellationToken cancellationToken) =>
        await ReadStatePathAsync(Path.Combine(JobDirectory(id), "job.json"), cancellationToken);

    private static async ValueTask<ComparisonJobState?> ReadStatePathAsync(string path, CancellationToken cancellationToken)
    {
        if (!File.Exists(path)) return null;
        try { return JsonSerializer.Deserialize<ComparisonJobState>(await File.ReadAllBytesAsync(path, cancellationToken), JsonOptions); }
        catch (JsonException) { return null; }
    }

    private ValueTask SaveStateAsync(ComparisonJobState state, CancellationToken cancellationToken) =>
        AtomicWriteAsync(Path.Combine(JobDirectory(state.Id), "job.json"), JsonSerializer.SerializeToUtf8Bytes(state, JsonOptions), cancellationToken);

    private static ComparisonJobResponse ToResponse(ComparisonJobState state) => new(
        state.Id,
        state.Status,
        state.Left,
        state.Right,
        state.Profile.Name,
        state.Profile.Version,
        state.ProfileDigest,
        state.Tenant,
        state.ProgressPercent,
        state.ProgressStage,
        state.Attempt,
        state.MaximumAttempts,
        state.CreatedAt,
        state.StartedAt,
        state.CompletedAt,
        state.Outcome,
        state.Error,
        state.ReportPublished ? $"/v1/comparisons/{state.Id:D}/report.json" : null,
        state.ReportPublished ? $"/v1/comparisons/{state.Id:D}/report.html" : null,
        state.ReportPublished ? $"/v1/comparisons/{state.Id:D}/manifest" : null,
        state.SecurityLabel,
        state.RetainUntil);

    private static ComparisonJobAccepted Accepted(Guid id, string? existing) => new(
        id,
        $"/v1/comparisons/{id:D}",
        $"/v1/comparisons/{id:D}/events",
        existing);

    private string JobDirectory(Guid id) => Path.Combine(_root, id.ToString("N"));
    private string IdempotencyPath(string digest) => Path.Combine(_root, ".idempotency", digest + ".txt");

    private static void ValidateRequest(CreateComparisonJobRequest request, ArtifactComparisonProfile profile)
    {
        ValidateReference(request.Left);
        ValidateReference(request.Right);
        if (request.RetentionDays is < 1 or > 3650) throw new ArgumentException("retentionDays must be between 1 and 3650.");
        if (request.IdempotencyKey is { Length: > 240 }) throw new ArgumentException("idempotencyKey is too long.");
        if (string.IsNullOrWhiteSpace(profile.Name) || profile.Name.Length > 120 || string.IsNullOrWhiteSpace(profile.Version) || profile.Version.Length > 64)
            throw new ArgumentException("Comparison profile name or version is invalid.");
        if (!profile.CompareIdentity && !profile.CompareSemantic && !profile.CompareStructure && !profile.CompareVisual && !profile.CompareOcr)
            throw new ArgumentException("At least one comparison layer must be enabled.");
        if (profile.MaximumReportedRanges is < 0 or > 10_000) throw new ArgumentException("maximumReportedRanges must be between 0 and 10000.");
        if (profile.PixelTolerancePercent is < 0 or > 100) throw new ArgumentException("pixelTolerancePercent must be between 0 and 100.");
        if (profile.MaximumPixelMismatchRatio is < 0 or > 1) throw new ArgumentException("maximumPixelMismatchRatio must be between 0 and 1.");
        if (profile.MinimumOcrSimilarity is < 0 or > 1) throw new ArgumentException("minimumOcrSimilarity must be between 0 and 1.");
        if (profile.RasterDpi is < 72 or > 600) throw new ArgumentException("rasterDpi must be between 72 and 600.");
        if (profile.TimeoutSeconds is < 1 or > 900) throw new ArgumentException("timeoutSeconds must be between 1 and 900.");
        if (string.IsNullOrWhiteSpace(profile.OcrLanguage) || profile.OcrLanguage.Length > 64) throw new ArgumentException("ocrLanguage is invalid.");
        if (profile.IgnoredFields?.Count > 1000) throw new ArgumentException("ignoredFields exceeds the limit.");
        if (profile.IgnoredFields?.Any(field => string.IsNullOrWhiteSpace(field) || field.Length > 240) == true)
            throw new ArgumentException("ignoredFields contains an invalid field path.");
    }

    private static void ValidateReference(ComparisonArtifactReference reference)
    {
        if (reference.RenderId == Guid.Empty) throw new ArgumentException("Artifact renderId is required.");
        if (string.IsNullOrWhiteSpace(reference.ArtifactName) || reference.ArtifactName.Length > 240 ||
            reference.ArtifactName.Contains('/') || reference.ArtifactName.Contains('\\') || reference.ArtifactName.Contains("..", StringComparison.Ordinal))
            throw new ArgumentException("Artifact name is invalid.");
    }

    private static string NormalizeTenant(string tenant)
    {
        tenant = string.IsNullOrWhiteSpace(tenant) ? "default" : tenant.Trim();
        if (tenant.Length > 200 || tenant.Any(character => char.IsControl(character))) throw new ArgumentException("Tenant identity is invalid.");
        return tenant;
    }

    private static string? Header(IReadOnlyDictionary<string, string>? headers, string name) =>
        headers?.FirstOrDefault(item => string.Equals(item.Key, name, StringComparison.OrdinalIgnoreCase)).Value;

    private static string Digest<T>(T value) =>
        Convert.ToHexString(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(value, JsonOptions)));

    private static async ValueTask<byte[]> ReadBoundedAsync(Stream stream, long maximumBytes, CancellationToken cancellationToken)
    {
        using var memory = new MemoryStream();
        var buffer = new byte[64 * 1024];
        while (true)
        {
            var read = await stream.ReadAsync(buffer, cancellationToken);
            if (read == 0) break;
            if (memory.Length + read > maximumBytes) throw new InvalidDataException($"Comparison artifact exceeds {maximumBytes} bytes.");
            await memory.WriteAsync(buffer.AsMemory(0, read), cancellationToken);
        }
        return memory.ToArray();
    }

    private static string MoreRestrictive(string? left, string? right)
    {
        static int Rank(string? value) => value?.ToLowerInvariant() switch
        {
            "highly-confidential" => 4,
            "restricted" => 3,
            "confidential" => 2,
            "internal" => 1,
            _ => 0
        };
        return Rank(left) >= Rank(right) ? left ?? right ?? "internal" : right ?? left ?? "internal";
    }

    private static string ContentTypeFor(string name) => Path.GetExtension(name).ToLowerInvariant() switch
    {
        ".json" => "application/json",
        ".html" or ".htm" => "text/html",
        ".pdf" => "application/pdf",
        ".png" => "image/png",
        ".jpg" or ".jpeg" => "image/jpeg",
        ".svg" => "image/svg+xml",
        ".txt" or ".md" => "text/plain",
        ".zip" => "application/zip",
        _ => "application/octet-stream"
    };

    private static string ExtensionFor(string? contentType) => contentType?.Split(';')[0].Trim().ToLowerInvariant() switch
    {
        "application/pdf" => "pdf",
        "text/html" => "html",
        "application/json" or "application/vnd.rune.document+json" => "json",
        "image/png" => "png",
        "image/jpeg" => "jpg",
        "image/svg+xml" => "svg",
        _ => "bin"
    };

    private static string SafeMessage(string value)
    {
        value = value.Replace('\r', ' ').Replace('\n', ' ').Trim();
        return value[..Math.Min(value.Length, 500)];
    }

    private static async ValueTask AtomicWriteAsync(string path, byte[] bytes, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var temporary = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            await File.WriteAllBytesAsync(temporary, bytes, cancellationToken);
            File.Move(temporary, path, true);
        }
        finally
        {
            try { if (File.Exists(temporary)) File.Delete(temporary); } catch { }
        }
    }

    private static void TryDeleteDirectory(string path)
    {
        try { if (Directory.Exists(path)) Directory.Delete(path, true); } catch { }
    }

    private sealed record ComparisonSource(string Name, string ContentType, byte[] Content, string? SecurityLabel);

    private sealed record ComparisonJobState(
        Guid Id,
        ComparisonJobStatus Status,
        ComparisonArtifactReference Left,
        ComparisonArtifactReference Right,
        ArtifactComparisonProfile Profile,
        string ProfileDigest,
        string Tenant,
        int ProgressPercent,
        string ProgressStage,
        int Attempt,
        int MaximumAttempts,
        DateTimeOffset CreatedAt,
        DateTimeOffset? StartedAt = null,
        DateTimeOffset? CompletedAt = null,
        ComparisonOutcome? Outcome = null,
        string? Error = null,
        string? SecurityLabel = null,
        DateTimeOffset? RetainUntil = null,
        string? IdempotencyIdentity = null,
        bool ReportPublished = false);
}
