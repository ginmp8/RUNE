using System.Globalization;
using System.Text;
using System.Text.Json;

namespace Rune.Storage.Abstractions;

public sealed class RuneInjectedFailureException(string point, Guid? renderId = null)
    : Exception($"Injected RUNE failure at '{point}'{(renderId is null ? string.Empty : $" for render {renderId}")}.")
{
    public string Point { get; } = point;
    public Guid? RenderId { get; } = renderId;
}

public static class RuneFailureInjection
{
    public static bool IsEnabled(string point)
    {
        var configured = Environment.GetEnvironmentVariable("RUNE_FAILURE_POINTS");
        if (string.IsNullOrWhiteSpace(configured)) return false;
        return configured.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
            .Any(value => string.Equals(value, point, StringComparison.OrdinalIgnoreCase) || value == "*");
    }

    public static void Trigger(string point, Guid? renderId = null)
    {
        if (!IsEnabled(point)) return;
        var delay = ParseBoundedInt(Environment.GetEnvironmentVariable("RUNE_FAILURE_DELAY_MS"), 0, 0, 60_000);
        if (delay > 0) Thread.Sleep(delay);
        if (!AcquireOccurrence(point, renderId)) return;
        var action = Environment.GetEnvironmentVariable("RUNE_FAILURE_ACTION")?.Trim().ToLowerInvariant() ?? "throw";
        if (action == "crash") Environment.FailFast(new RuneInjectedFailureException(point, renderId).Message);
        throw new RuneInjectedFailureException(point, renderId);
    }

    private static bool AcquireOccurrence(string point, Guid? renderId)
    {
        var mode = Environment.GetEnvironmentVariable("RUNE_FAILURE_MODE")?.Trim().ToLowerInvariant() ?? "once";
        if (mode == "always") return true;
        var root = Environment.GetEnvironmentVariable("RUNE_FAILURE_ONCE_ROOT");
        if (string.IsNullOrWhiteSpace(root)) root = Path.Combine(Path.GetTempPath(), "rune-failure-once");
        Directory.CreateDirectory(root);
        var safePoint = new string(point.Select(character => char.IsAsciiLetterOrDigit(character) ? character : '-').ToArray());
        var marker = Path.Combine(root, $"{safePoint}-{renderId?.ToString("N") ?? "global"}.marker");
        try
        {
            using var stream = new FileStream(marker, FileMode.CreateNew, FileAccess.Write, FileShare.Read);
            return true;
        }
        catch (IOException)
        {
            return false;
        }
    }

    private static int ParseBoundedInt(string? value, int fallback, int minimum, int maximum) =>
        int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed)
            ? Math.Clamp(parsed, minimum, maximum)
            : fallback;
}

public sealed class RuneOperationalMetrics
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = true };
    private readonly string _dataRoot;
    private readonly string _cacheRoot;
    private readonly string _temporaryRoot;
    private readonly string _metricsRoot;
    private readonly string _statePath;
    private readonly string _lockPath;
    private readonly string _chromiumRoot;

    public RuneOperationalMetrics(string dataRoot, string cacheRoot, string? temporaryRoot = null)
    {
        _dataRoot = Path.GetFullPath(dataRoot);
        _cacheRoot = Path.GetFullPath(cacheRoot);
        _temporaryRoot = Path.GetFullPath(temporaryRoot ?? Path.GetTempPath());
        _metricsRoot = Path.Combine(_dataRoot, ".rune-metrics");
        _statePath = Path.Combine(_metricsRoot, "state.json");
        _lockPath = Path.Combine(_metricsRoot, ".state.lock");
        _chromiumRoot = Path.Combine(_metricsRoot, "chromium");
        Directory.CreateDirectory(_metricsRoot);
        Directory.CreateDirectory(_chromiumRoot);
    }

    public ValueTask IncrementAsync(string metric, long amount = 1, CancellationToken cancellationToken = default) =>
        MutateAsync(state => state.Counters[metric] = state.Counters.GetValueOrDefault(metric) + amount, cancellationToken);

    public ValueTask ObserveAsync(string metric, double value, CancellationToken cancellationToken = default) =>
        MutateAsync(state =>
        {
            if (!state.Observations.TryGetValue(metric, out var values)) state.Observations[metric] = values = [];
            values.Add(value);
            if (values.Count > 4096) values.RemoveRange(0, values.Count - 4096);
        }, cancellationToken);

    public async ValueTask SetChromiumProcessesAsync(string workerId, int count, CancellationToken cancellationToken = default)
    {
        var safeWorker = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(Encoding.UTF8.GetBytes(workerId)))[..24];
        var payload = JsonSerializer.SerializeToUtf8Bytes(new ChromiumSample(Math.Max(0, count), DateTimeOffset.UtcNow), JsonOptions);
        await AtomicWriteAsync(Path.Combine(_chromiumRoot, safeWorker + ".json"), payload, cancellationToken);
    }

    public async ValueTask<string> ExportPrometheusAsync(CancellationToken cancellationToken = default)
    {
        var state = await ReadStateAsync(cancellationToken);
        var jobs = await ReadJobsAsync(cancellationToken);
        var builder = new StringBuilder();
        AppendGauge(builder, "rune_jobs_queued", jobs.Count(job => job.Status == "queued"));
        AppendGauge(builder, "rune_jobs_running", jobs.Count(job => job.Status is "claimed" or "rendering" or "cancelRequested"));
        AppendGauge(builder, "rune_jobs_completed", jobs.Count(job => job.Status == "completed"));
        AppendGauge(builder, "rune_jobs_failed", jobs.Count(job => job.Status == "failed"));
        AppendSummary(builder, "rune_job_duration_seconds", jobs.Where(job => job.CompletedAt is not null)
            .Select(job => Math.Max(0, (job.CompletedAt!.Value - job.CreatedAt).TotalSeconds)).ToArray());
        var observedRenderDurations = state.Observations.GetValueOrDefault("rune_render_duration_seconds") ?? [];
        var renderDurations = observedRenderDurations.Count > 0
            ? observedRenderDurations.ToArray()
            : jobs.Where(job => job.StartedAt is not null && job.CompletedAt is not null)
                .Select(job => Math.Max(0, (job.CompletedAt!.Value - job.StartedAt!.Value).TotalSeconds)).ToArray();
        AppendSummary(builder, "rune_render_duration_seconds", renderDurations);
        AppendCounter(builder, "rune_message_redelivery_total",
            jobs.Sum(job => Math.Max(0, job.Attempt - 1)) + state.Counters.GetValueOrDefault("rune_message_redelivery_total"));
        AppendCounter(builder, "rune_idempotency_hit_total", state.Counters.GetValueOrDefault("rune_idempotency_hit_total"));
        AppendCounter(builder, "rune_cache_hit_total", state.Counters.GetValueOrDefault("rune_cache_hit_total"));
        AppendCounter(builder, "rune_cache_miss_total", state.Counters.GetValueOrDefault("rune_cache_miss_total"));
        AppendCounter(builder, "rune_lease_conflict_total", state.Counters.GetValueOrDefault("rune_lease_conflict_total"));
        AppendCounter(builder, "rune_lease_fencing_rejection_total", state.Counters.GetValueOrDefault("rune_lease_fencing_rejection_total"));
        AppendCounter(builder, "rune_dispatch_published_total", state.Counters.GetValueOrDefault("rune_dispatch_published_total"));
        AppendCounter(builder, "rune_dispatch_failure_total", state.Counters.GetValueOrDefault("rune_dispatch_failure_total"));
        AppendCounter(builder, "rune_dead_letter_total", state.Counters.GetValueOrDefault("rune_dead_letter_total"));
        AppendGauge(builder, "rune_temp_files_total", CountTemporaryEntries());
        AppendGauge(builder, "rune_chromium_processes", await ReadChromiumProcessesAsync(cancellationToken));
        return builder.ToString();
    }

    private async ValueTask MutateAsync(Action<MetricsState> mutation, CancellationToken cancellationToken)
    {
        try
        {
            Directory.CreateDirectory(_metricsRoot);
            await using var gate = await AcquireLockAsync(cancellationToken);
            var state = await ReadStateUnlockedAsync(cancellationToken);
            mutation(state);
            await AtomicWriteAsync(_statePath, JsonSerializer.SerializeToUtf8Bytes(state, JsonOptions), cancellationToken);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or JsonException)
        {
            // Metrics must never break rendering or storage semantics.
        }
    }

    private async ValueTask<MetricsState> ReadStateAsync(CancellationToken cancellationToken)
    {
        try
        {
            await using var gate = await AcquireLockAsync(cancellationToken);
            return await ReadStateUnlockedAsync(cancellationToken);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or JsonException)
        {
            return new MetricsState();
        }
    }

    private async ValueTask<MetricsState> ReadStateUnlockedAsync(CancellationToken cancellationToken)
    {
        if (!File.Exists(_statePath)) return new MetricsState();
        return JsonSerializer.Deserialize<MetricsState>(await File.ReadAllBytesAsync(_statePath, cancellationToken), JsonOptions)
            ?? new MetricsState();
    }

    private async ValueTask<FileStream> AcquireLockAsync(CancellationToken cancellationToken)
    {
        while (true)
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                return new FileStream(_lockPath, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None, 1,
                    FileOptions.Asynchronous | FileOptions.WriteThrough);
            }
            catch (IOException)
            {
                await Task.Delay(20, cancellationToken);
            }
        }
    }

    private async ValueTask<IReadOnlyList<JobSample>> ReadJobsAsync(CancellationToken cancellationToken)
    {
        var result = new List<JobSample>();
        if (!Directory.Exists(_dataRoot)) return result;
        foreach (var path in Directory.EnumerateFiles(_dataRoot, "job.json", SearchOption.AllDirectories))
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                using var document = JsonDocument.Parse(await File.ReadAllBytesAsync(path, cancellationToken));
                var root = document.RootElement;
                result.Add(new JobSample(
                    ReadString(root, "status") ?? "unknown",
                    ReadInt(root, "attempt"),
                    ReadDate(root, "createdAt") ?? DateTimeOffset.UnixEpoch,
                    ReadDate(root, "startedAt"),
                    ReadDate(root, "completedAt"),
                    ReadString(root, "cacheStatus")));
            }
            catch (Exception exception) when (exception is IOException or JsonException or UnauthorizedAccessException) { }
        }
        return result;
    }

    private int CountTemporaryEntries()
    {
        var total = 0;
        foreach (var root in new[] { _dataRoot, _cacheRoot, _temporaryRoot }.Distinct(StringComparer.Ordinal))
        {
            if (!Directory.Exists(root)) continue;
            try
            {
                total += Directory.EnumerateFiles(root, "*.tmp", SearchOption.AllDirectories).Count();
                total += Directory.EnumerateDirectories(root, ".artifact-set-stage-*", SearchOption.AllDirectories).Count();
                total += Directory.EnumerateDirectories(root, ".artifact-set-backup-*", SearchOption.AllDirectories).Count();
            }
            catch (Exception exception) when (exception is IOException or UnauthorizedAccessException) { }
        }
        return total;
    }

    private async ValueTask<int> ReadChromiumProcessesAsync(CancellationToken cancellationToken)
    {
        if (!Directory.Exists(_chromiumRoot)) return 0;
        var total = 0;
        foreach (var path in Directory.EnumerateFiles(_chromiumRoot, "*.json"))
        {
            try
            {
                var sample = JsonSerializer.Deserialize<ChromiumSample>(await File.ReadAllBytesAsync(path, cancellationToken), JsonOptions);
                if (sample is not null && DateTimeOffset.UtcNow - sample.UpdatedAt <= TimeSpan.FromMinutes(1)) total += sample.Count;
            }
            catch (Exception exception) when (exception is IOException or JsonException or UnauthorizedAccessException) { }
        }
        return total;
    }

    private static string? ReadString(JsonElement root, string name) =>
        root.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;

    private static int ReadInt(JsonElement root, string name) =>
        root.TryGetProperty(name, out var value) && value.TryGetInt32(out var result) ? result : 0;

    private static DateTimeOffset? ReadDate(JsonElement root, string name) =>
        root.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String && value.TryGetDateTimeOffset(out var result) ? result : null;

    private static void AppendGauge(StringBuilder builder, string name, long value)
    {
        builder.Append("# TYPE ").Append(name).Append(" gauge\n");
        builder.Append(name).Append(' ').Append(value.ToString(CultureInfo.InvariantCulture)).Append('\n');
    }

    private static void AppendCounter(StringBuilder builder, string name, long value)
    {
        builder.Append("# TYPE ").Append(name).Append(" counter\n");
        builder.Append(name).Append(' ').Append(value.ToString(CultureInfo.InvariantCulture)).Append('\n');
    }

    private static void AppendSummary(StringBuilder builder, string name, IReadOnlyList<double> values)
    {
        var ordered = values.Order().ToArray();
        builder.Append("# TYPE ").Append(name).Append(" summary\n");
        foreach (var quantile in new[] { 0.5, 0.95, 0.99 })
        {
            var value = ordered.Length == 0 ? 0 : ordered[(int)Math.Ceiling((ordered.Length - 1) * quantile)];
            builder.Append(name).Append("{quantile=\"").Append(quantile.ToString("0.00", CultureInfo.InvariantCulture))
                .Append("\"} ").Append(value.ToString("0.######", CultureInfo.InvariantCulture)).Append('\n');
        }
        builder.Append(name).Append("_count ").Append(ordered.Length.ToString(CultureInfo.InvariantCulture)).Append('\n');
        builder.Append(name).Append("_sum ").Append(ordered.Sum().ToString("0.######", CultureInfo.InvariantCulture)).Append('\n');
    }

    private static async ValueTask AtomicWriteAsync(string path, byte[] content, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var temporary = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            await File.WriteAllBytesAsync(temporary, content, cancellationToken);
            File.Move(temporary, path, true);
        }
        finally
        {
            try { if (File.Exists(temporary)) File.Delete(temporary); } catch { }
        }
    }

    private sealed class MetricsState
    {
        public Dictionary<string, long> Counters { get; init; } = new(StringComparer.Ordinal);
        public Dictionary<string, List<double>> Observations { get; init; } = new(StringComparer.Ordinal);
    }

    private sealed record JobSample(string Status, int Attempt, DateTimeOffset CreatedAt, DateTimeOffset? StartedAt, DateTimeOffset? CompletedAt, string? CacheStatus);
    private sealed record ChromiumSample(int Count, DateTimeOffset UpdatedAt);
}
