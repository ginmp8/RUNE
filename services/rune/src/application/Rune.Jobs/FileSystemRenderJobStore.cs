using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Rune.Job.Contracts;
using Rune.Storage.Abstractions;

namespace Rune.Jobs;

public sealed class FileSystemRenderJobStore(string rootPath, RuneOperationalMetrics? metrics = null) : IRenderJobStore
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true,
        Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
    };

    private static readonly ConcurrentDictionary<Guid, SemaphoreSlim> Gates = new();
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> RootGates = new(StringComparer.Ordinal);
    private readonly string _root = Path.GetFullPath(rootPath);
    private readonly RuneOperationalMetrics? _metrics = metrics;

    public ValueTask<RenderJob?> FindByIdempotencyKeyAsync(string key, CancellationToken cancellationToken = default) =>
        new(FindByIdempotencyKeyUnlockedAsync(key, cancellationToken));

    public async ValueTask<RenderJob> CreateAsync(RenderJob job, RenderPackage package, CancellationToken cancellationToken = default)
    {
        return await WithStoreLockAsync(async () =>
        {
            if (!string.IsNullOrWhiteSpace(job.IdempotencyKey))
            {
                var existing = await FindByIdempotencyKeyUnlockedAsync(job.IdempotencyKey, cancellationToken);
                if (existing is not null)
                {
                    var existingPackage = await GetPackageAsync(existing.Id, cancellationToken);
                    if (!string.Equals(existingPackage.ContentHash, package.ContentHash, StringComparison.Ordinal) ||
                        existing.OutputFormat != job.OutputFormat || existing.Options != job.Options ||
                        !SequenceEqual(existingPackage.OutputFormats, package.OutputFormats) ||
                        !string.Equals(existingPackage.DocumentName, package.DocumentName, StringComparison.Ordinal))
                        throw new ArgumentException("The idempotency key is already associated with a different render request.", nameof(job));
                    await RecordAsync("rune_idempotency_hit_total", cancellationToken);
                    return existing;
                }
            }

            Directory.CreateDirectory(JobDirectory(job.Id));
            await AtomicWriteAsync(PackagePath(job.Id), JsonSerializer.SerializeToUtf8Bytes(package, JsonOptions), cancellationToken);
            job = NormalizeDispatch(job, newGeneration: false, job.DispatchHeaders);
            await WriteJobUnlockedAsync(job, cancellationToken);
            return job;
        }, cancellationToken);
    }

    public ValueTask<RenderJob?> GetAsync(Guid id, CancellationToken cancellationToken = default) =>
        new(ReadJobAsync(JobPath(id), cancellationToken));

    public async ValueTask<RenderJobPage> QueryAsync(RenderJobQuery query, CancellationToken cancellationToken = default)
    {
        var limit = Math.Clamp(query.Limit, 1, 200);
        var offset = Math.Max(0, query.Offset);
        if (!Directory.Exists(_root)) return new RenderJobPage([], offset, limit, 0);
        var jobs = new List<RenderJob>();
        foreach (var file in Directory.EnumerateFiles(_root, "job.json", SearchOption.AllDirectories))
        {
            cancellationToken.ThrowIfCancellationRequested();
            var job = await ReadJobAsync(file, cancellationToken);
            if (job is null || query.Status is not null && job.Status != query.Status) continue;
            if (query.CreatedAfter is not null && job.CreatedAt < query.CreatedAfter) continue;
            if (query.CreatedBefore is not null && job.CreatedAt > query.CreatedBefore) continue;
            if (query.DeadLettered is not null && (job.DeadLetteredAt is not null) != query.DeadLettered.Value) continue;
            jobs.Add(job);
        }
        var ordered = jobs.OrderByDescending(item => item.CreatedAt).ThenBy(item => item.Id).ToArray();
        return new RenderJobPage(ordered.Skip(offset).Take(limit).ToArray(), offset, limit, ordered.Length);
    }

    public async ValueTask SaveAsync(RenderJob job, CancellationToken cancellationToken = default)
    {
        await WithGateAsync(job.Id, () => WriteJobUnlockedAsync(job, cancellationToken), cancellationToken);
    }

    public async ValueTask<bool> TryClaimAsync(Guid id, string workerId, TimeSpan leaseDuration, CancellationToken cancellationToken = default) =>
        await TryAcquireLeaseAsync(id, workerId, leaseDuration, cancellationToken) is not null;

    public async ValueTask<RenderJobLease?> TryAcquireLeaseAsync(
        Guid id,
        string workerId,
        TimeSpan leaseDuration,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(workerId)) throw new ArgumentException("Worker id is required.", nameof(workerId));
        if (leaseDuration <= TimeSpan.Zero) leaseDuration = TimeSpan.FromMilliseconds(1);
        return await WithGateAsync(id, async () =>
        {
            var job = await ReadJobAsync(JobPath(id), cancellationToken);
            if (job is null || IsTerminal(job.Status)) return null;
            var now = DateTimeOffset.UtcNow;
            var activeLease = job.LeaseExpiresAt > now;
            if (activeLease)
            {
                await RecordAsync("rune_lease_conflict_total", cancellationToken);
                return null;
            }
            if (job.Status == RenderJobStatus.CancelRequested)
            {
                await WriteJobUnlockedAsync(job with
                {
                    Status = RenderJobStatus.Cancelled,
                    CompletedAt = now,
                    ClaimedBy = null,
                    LeaseExpiresAt = null,
                    ProgressStage = "cancelled"
                }, cancellationToken);
                return null;
            }

            var token = checked(job.LeaseToken + 1);
            var expiresAt = now.Add(leaseDuration);
            var claimed = job with
            {
                Status = RenderJobStatus.Claimed,
                ClaimedBy = workerId,
                LeaseExpiresAt = expiresAt,
                LeaseToken = token,
                Attempt = job.Attempt + 1,
                StartedAt = job.StartedAt ?? now,
                ProgressPercent = Math.Max(1, job.ProgressPercent),
                ProgressStage = "claimed",
                Error = null
            };
            await WriteJobUnlockedAsync(claimed, cancellationToken);
            return new RenderJobLease(id, workerId, expiresAt, claimed.Attempt, token);
        }, cancellationToken);
    }

    public async ValueTask<bool> RenewLeaseAsync(
        Guid id,
        string workerId,
        TimeSpan leaseDuration,
        CancellationToken cancellationToken = default)
    {
        return await WithGateAsync(id, async () =>
        {
            var job = await ReadJobAsync(JobPath(id), cancellationToken);
            if (!OwnsLease(job, workerId, job?.LeaseToken ?? 0, requireUnexpired: true)) return false;
            await WriteJobUnlockedAsync(job! with { LeaseExpiresAt = DateTimeOffset.UtcNow.Add(leaseDuration) }, cancellationToken);
            return true;
        }, cancellationToken);
    }

    public async ValueTask<bool> RenewLeaseAsync(
        Guid id,
        string workerId,
        long fencingToken,
        TimeSpan leaseDuration,
        CancellationToken cancellationToken = default)
    {
        return await WithGateAsync(id, async () =>
        {
            var job = await ReadJobAsync(JobPath(id), cancellationToken);
            if (!OwnsLease(job, workerId, fencingToken, requireUnexpired: true))
            {
                await RecordAsync("rune_lease_fencing_rejection_total", cancellationToken);
                return false;
            }
            await WriteJobUnlockedAsync(job! with { LeaseExpiresAt = DateTimeOffset.UtcNow.Add(leaseDuration) }, cancellationToken);
            return true;
        }, cancellationToken);
    }

    public async ValueTask<bool> SaveOwnedAsync(RenderJob job, RenderJobLease lease, CancellationToken cancellationToken = default)
    {
        return await WithGateAsync(job.Id, async () =>
        {
            var current = await ReadJobAsync(JobPath(job.Id), cancellationToken);
            if (!OwnsLease(current, lease.WorkerId, lease.FencingToken, requireUnexpired: true))
            {
                await RecordAsync("rune_lease_fencing_rejection_total", cancellationToken);
                return false;
            }
            await WriteJobUnlockedAsync(job with { LeaseToken = lease.FencingToken }, cancellationToken);
            return true;
        }, cancellationToken);
    }

    public async ValueTask<bool> RequestCancellationAsync(Guid id, string? reason, CancellationToken cancellationToken = default)
    {
        return await WithGateAsync(id, async () =>
        {
            var job = await ReadJobAsync(JobPath(id), cancellationToken);
            if (job is null || IsTerminal(job.Status)) return false;
            var now = DateTimeOffset.UtcNow;
            var queued = job.Status == RenderJobStatus.Queued;
            await WriteJobUnlockedAsync(job with
            {
                Status = queued ? RenderJobStatus.Cancelled : RenderJobStatus.CancelRequested,
                Error = string.IsNullOrWhiteSpace(reason) ? "Cancellation requested." : reason,
                CompletedAt = queued ? now : job.CompletedAt,
                ProgressStage = queued ? "cancelled" : "cancellation-requested",
                LeaseExpiresAt = queued ? null : job.LeaseExpiresAt,
                ClaimedBy = queued ? null : job.ClaimedBy
            }, cancellationToken);
            return true;
        }, cancellationToken);
    }

    public async ValueTask<bool> RequeueAsync(Guid id, bool resetAttempts, CancellationToken cancellationToken = default)
    {
        return await WithGateAsync(id, async () =>
        {
            var job = await ReadJobAsync(JobPath(id), cancellationToken);
            if (job is null || job.Status == RenderJobStatus.Completed) return false;
            if (job.Status is RenderJobStatus.Rendering or RenderJobStatus.Claimed && job.LeaseExpiresAt > DateTimeOffset.UtcNow) return false;
            var requeued = NormalizeDispatch(job with
            {
                Status = RenderJobStatus.Queued,
                Attempt = resetAttempts ? 0 : job.Attempt,
                Error = null,
                StartedAt = null,
                CompletedAt = null,
                ClaimedBy = null,
                LeaseExpiresAt = null,
                ProgressPercent = 0,
                ProgressStage = "queued",
                DeadLetteredAt = null,
                DeadLetterReason = null
            }, newGeneration: true, job.DispatchHeaders);
            await WriteJobUnlockedAsync(requeued, cancellationToken);
            return true;
        }, cancellationToken);
    }

    public async ValueTask<bool> ScheduleDispatchAsync(
        Guid id,
        bool newGeneration,
        IReadOnlyDictionary<string, string>? headers = null,
        CancellationToken cancellationToken = default)
    {
        return await WithGateAsync(id, async () =>
        {
            var job = await ReadJobAsync(JobPath(id), cancellationToken);
            if (job is null || job.Status is RenderJobStatus.Completed or RenderJobStatus.Cancelled) return false;
            await WriteJobUnlockedAsync(NormalizeDispatch(job, newGeneration, headers ?? job.DispatchHeaders), cancellationToken);
            return true;
        }, cancellationToken);
    }

    public async IAsyncEnumerable<RenderJob> ListPendingDispatchesAsync(
        DateTimeOffset now,
        int limit = 100,
        [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        if (!Directory.Exists(_root)) yield break;
        var pending = new List<RenderJob>();
        foreach (var file in Directory.EnumerateFiles(_root, "job.json", SearchOption.AllDirectories))
        {
            cancellationToken.ThrowIfCancellationRequested();
            var job = await ReadJobAsync(file, cancellationToken);
            if (job is null || IsTerminal(job.Status)) continue;
            if (job.DispatchStatus == RenderDispatchStatus.Pending && job.DispatchNextAttemptAt <= now ||
                job.DispatchStatus == RenderDispatchStatus.Publishing && job.DispatchLeaseExpiresAt <= now)
                pending.Add(job);
        }
        foreach (var job in pending.OrderBy(item => item.DispatchNextAttemptAt ?? item.CreatedAt).ThenBy(item => item.Id).Take(Math.Clamp(limit, 1, 1000)))
            yield return job;
    }

    public async ValueTask<RenderDispatchLease?> TryAcquireDispatchAsync(
        Guid id,
        string dispatcherId,
        TimeSpan leaseDuration,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(dispatcherId)) throw new ArgumentException("Dispatcher id is required.", nameof(dispatcherId));
        if (leaseDuration <= TimeSpan.Zero) leaseDuration = TimeSpan.FromMilliseconds(1);
        return await WithGateAsync(id, async () =>
        {
            var job = await ReadJobAsync(JobPath(id), cancellationToken);
            if (job is null || IsTerminal(job.Status) || job.DispatchStatus == RenderDispatchStatus.Published) return null;
            var now = DateTimeOffset.UtcNow;
            if (job.DispatchStatus == RenderDispatchStatus.Pending && job.DispatchNextAttemptAt > now) return null;
            if (job.DispatchStatus == RenderDispatchStatus.Publishing && job.DispatchLeaseExpiresAt > now) return null;
            job = NormalizeDispatch(job, newGeneration: false, job.DispatchHeaders);
            var token = checked(job.DispatchToken + 1);
            var expiresAt = now.Add(leaseDuration);
            var claimed = job with
            {
                DispatchStatus = RenderDispatchStatus.Publishing,
                DispatchClaimedBy = dispatcherId,
                DispatchLeaseExpiresAt = expiresAt,
                DispatchToken = token,
                DispatchAttempts = checked(job.DispatchAttempts + 1),
                DispatchError = null
            };
            await WriteJobUnlockedAsync(claimed, cancellationToken);
            return new RenderDispatchLease(
                id,
                claimed.DispatchEventId,
                claimed.DispatchGeneration,
                dispatcherId,
                expiresAt,
                claimed.DispatchAttempts,
                token,
                claimed.PackagePath,
                claimed.DispatchHeaders);
        }, cancellationToken);
    }

    public async ValueTask<bool> MarkDispatchPublishedAsync(
        RenderDispatchLease lease,
        DateTimeOffset publishedAt,
        CancellationToken cancellationToken = default)
    {
        return await WithGateAsync(lease.RenderId, async () =>
        {
            var job = await ReadJobAsync(JobPath(lease.RenderId), cancellationToken);
            if (!OwnsDispatch(job, lease)) return false;
            await WriteJobUnlockedAsync(job! with
            {
                DispatchStatus = RenderDispatchStatus.Published,
                DispatchClaimedBy = null,
                DispatchLeaseExpiresAt = null,
                DispatchNextAttemptAt = null,
                DispatchPublishedAt = publishedAt,
                DispatchError = null
            }, cancellationToken);
            await RecordAsync("rune_dispatch_published_total", cancellationToken);
            return true;
        }, cancellationToken);
    }

    public async ValueTask<bool> MarkDispatchFailedAsync(
        RenderDispatchLease lease,
        string error,
        DateTimeOffset nextAttemptAt,
        CancellationToken cancellationToken = default)
    {
        return await WithGateAsync(lease.RenderId, async () =>
        {
            var job = await ReadJobAsync(JobPath(lease.RenderId), cancellationToken);
            if (!OwnsDispatch(job, lease)) return false;
            await WriteJobUnlockedAsync(job! with
            {
                DispatchStatus = RenderDispatchStatus.Pending,
                DispatchClaimedBy = null,
                DispatchLeaseExpiresAt = null,
                DispatchNextAttemptAt = nextAttemptAt,
                DispatchError = string.IsNullOrWhiteSpace(error) ? "Command publication failed." : error
            }, cancellationToken);
            await RecordAsync("rune_dispatch_failure_total", cancellationToken);
            return true;
        }, cancellationToken);
    }

    public async ValueTask<bool> MarkDeadLetteredAsync(
        Guid id,
        int attempt,
        string reason,
        DateTimeOffset deadLetteredAt,
        CancellationToken cancellationToken = default)
    {
        return await WithGateAsync(id, async () =>
        {
            var job = await ReadJobAsync(JobPath(id), cancellationToken);
            if (job is null || job.Status == RenderJobStatus.Completed) return false;
            if (job.DeadLetteredAt is not null && string.Equals(job.DeadLetterReason, reason, StringComparison.Ordinal)) return true;
            await WriteJobUnlockedAsync(job with
            {
                Status = RenderJobStatus.Failed,
                Attempt = Math.Max(job.Attempt, attempt),
                Error = string.IsNullOrWhiteSpace(job.Error) ? reason : job.Error,
                CompletedAt = job.CompletedAt ?? deadLetteredAt,
                ProgressStage = "dead-lettered",
                ClaimedBy = null,
                LeaseExpiresAt = null,
                DeadLetteredAt = deadLetteredAt,
                DeadLetterReason = reason
            }, cancellationToken);
            await RecordAsync("rune_dead_letter_total", cancellationToken);
            return true;
        }, cancellationToken);
    }

    public async IAsyncEnumerable<RenderJob> ListRecoverableAsync(
        DateTimeOffset now,
        [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        if (!Directory.Exists(_root)) yield break;
        foreach (var file in Directory.EnumerateFiles(_root, "job.json", SearchOption.AllDirectories))
        {
            cancellationToken.ThrowIfCancellationRequested();
            var job = await ReadJobAsync(file, cancellationToken);
            if (job is null) continue;
            if (job.Status == RenderJobStatus.Queued ||
                job.Status is RenderJobStatus.Claimed or RenderJobStatus.Rendering && job.LeaseExpiresAt <= now)
                yield return job;
        }
    }

    public async ValueTask<RenderPackage> GetPackageAsync(Guid id, CancellationToken cancellationToken = default)
    {
        await using var stream = File.OpenRead(PackagePath(id));
        return (await JsonSerializer.DeserializeAsync<RenderPackage>(stream, JsonOptions, cancellationToken))
            ?? throw new InvalidDataException($"Render package {id} is invalid.");
    }

    public async ValueTask SavePackageAsync(RenderPackage package, CancellationToken cancellationToken = default)
    {
        Directory.CreateDirectory(JobDirectory(package.RenderId));
        await AtomicWriteAsync(PackagePath(package.RenderId), JsonSerializer.SerializeToUtf8Bytes(package, JsonOptions), cancellationToken);
    }

    public async ValueTask<long> SaveResultAsync(Guid id, Stream content, string extension, CancellationToken cancellationToken = default)
    {
        Directory.CreateDirectory(JobDirectory(id));
        var final = ResultPath(id, extension);
        var temp = final + $".{Guid.NewGuid():N}.tmp";
        try
        {
            await WriteStreamToTemporaryAsync(content, temp, id, cancellationToken);
            RuneFailureInjection.Trigger("during-rename", id);
            File.Move(temp, final, true);
            return new FileInfo(final).Length;
        }
        finally
        {
            TryDeleteFile(temp);
        }
    }

    public async ValueTask<long?> SaveResultOwnedAsync(
        Guid id,
        RenderJobLease lease,
        Stream content,
        string extension,
        CancellationToken cancellationToken = default)
    {
        Directory.CreateDirectory(JobDirectory(id));
        var final = ResultPath(id, extension);
        var temp = final + $".{Guid.NewGuid():N}.tmp";
        try
        {
            if (!await VerifyOwnershipAsync(id, lease, cancellationToken)) return null;
            await WriteStreamToTemporaryAsync(content, temp, id, cancellationToken);
            return await WithGateAsync(id, async () =>
            {
                var current = await ReadJobAsync(JobPath(id), cancellationToken);
                if (!OwnsLease(current, lease.WorkerId, lease.FencingToken, requireUnexpired: true))
                {
                    await RecordAsync("rune_lease_fencing_rejection_total", cancellationToken);
                    return (long?)null;
                }
                RuneFailureInjection.Trigger("during-rename", id);
                File.Move(temp, final, true);
                return new FileInfo(final).Length;
            }, cancellationToken);
        }
        finally
        {
            TryDeleteFile(temp);
        }
    }

    public ValueTask<Stream?> OpenResultAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var directory = JobDirectory(id);
        if (!Directory.Exists(directory)) return ValueTask.FromResult<Stream?>(null);
        var file = Directory.EnumerateFiles(directory, "result.*")
            .FirstOrDefault(path => !path.EndsWith(".tmp", StringComparison.OrdinalIgnoreCase));
        return ValueTask.FromResult<Stream?>(file is null ? null : File.OpenRead(file));
    }

    public async ValueTask<long> SaveArtifactAsync(Guid id, string name, Stream content, CancellationToken cancellationToken = default)
    {
        var safeName = ValidateArtifactName(name);
        Directory.CreateDirectory(JobDirectory(id));
        var final = Path.Combine(JobDirectory(id), safeName);
        var temp = final + $".{Guid.NewGuid():N}.tmp";
        try
        {
            await WriteStreamToTemporaryAsync(content, temp, id, cancellationToken);
            RuneFailureInjection.Trigger("during-rename", id);
            File.Move(temp, final, true);
            return new FileInfo(final).Length;
        }
        finally
        {
            TryDeleteFile(temp);
        }
    }

    public async ValueTask<long?> SaveArtifactOwnedAsync(
        Guid id,
        RenderJobLease lease,
        string name,
        Stream content,
        CancellationToken cancellationToken = default)
    {
        var safeName = ValidateArtifactName(name);
        Directory.CreateDirectory(JobDirectory(id));
        var final = Path.Combine(JobDirectory(id), safeName);
        var temp = final + $".{Guid.NewGuid():N}.tmp";
        try
        {
            if (!await VerifyOwnershipAsync(id, lease, cancellationToken)) return null;
            await WriteStreamToTemporaryAsync(content, temp, id, cancellationToken);
            return await WithGateAsync(id, async () =>
            {
                var current = await ReadJobAsync(JobPath(id), cancellationToken);
                if (!OwnsLease(current, lease.WorkerId, lease.FencingToken, requireUnexpired: true))
                {
                    await RecordAsync("rune_lease_fencing_rejection_total", cancellationToken);
                    return (long?)null;
                }
                RuneFailureInjection.Trigger("during-rename", id);
                File.Move(temp, final, true);
                return new FileInfo(final).Length;
            }, cancellationToken);
        }
        finally
        {
            TryDeleteFile(temp);
        }
    }

    public async ValueTask SaveArtifactSetAsync(Guid id, IReadOnlyList<RenderArtifactWrite> artifacts, CancellationToken cancellationToken = default)
    {
        var staged = await StageArtifactSetAsync(id, artifacts, cancellationToken);
        try
        {
            await WithGateAsync(id, () => CommitArtifactSetAsync(id, staged, cancellationToken), cancellationToken);
        }
        finally
        {
            TryDeleteDirectory(staged.Stage);
            TryDeleteDirectory(staged.Backup);
        }
    }

    public async ValueTask<bool> SaveArtifactSetOwnedAsync(
        Guid id,
        RenderJobLease lease,
        IReadOnlyList<RenderArtifactWrite> artifacts,
        CancellationToken cancellationToken = default)
    {
        if (!await VerifyOwnershipAsync(id, lease, cancellationToken)) return false;
        var staged = await StageArtifactSetAsync(id, artifacts, cancellationToken);
        try
        {
            return await WithGateAsync(id, async () =>
            {
                var current = await ReadJobAsync(JobPath(id), cancellationToken);
                if (!OwnsLease(current, lease.WorkerId, lease.FencingToken, requireUnexpired: true))
                {
                    await RecordAsync("rune_lease_fencing_rejection_total", cancellationToken);
                    return false;
                }
                await CommitArtifactSetAsync(id, staged, cancellationToken);
                return true;
            }, cancellationToken);
        }
        finally
        {
            TryDeleteDirectory(staged.Stage);
            TryDeleteDirectory(staged.Backup);
        }
    }

    public ValueTask<Stream?> OpenArtifactAsync(Guid id, string name, CancellationToken cancellationToken = default)
    {
        var safeName = ValidateArtifactName(name);
        var transactionPath = Path.Combine(JobDirectory(id), "artifact-set", safeName);
        var legacyPath = Path.Combine(JobDirectory(id), safeName);
        var path = File.Exists(transactionPath) ? transactionPath : legacyPath;
        return ValueTask.FromResult<Stream?>(File.Exists(path) ? File.OpenRead(path) : null);
    }

    public async ValueTask<int> DeleteExpiredAsync(DateTimeOffset completedBefore, CancellationToken cancellationToken = default)
    {
        if (!Directory.Exists(_root)) return 0;
        var deleted = 0;
        foreach (var directory in Directory.EnumerateDirectories(_root))
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (!Guid.TryParseExact(Path.GetFileName(directory), "N", out var id)) continue;
            var job = await GetAsync(id, cancellationToken);
            if (job?.CompletedAt is null || job.CompletedAt >= completedBefore) continue;
            await WithGateAsync(id, () =>
            {
                if (Directory.Exists(directory)) Directory.Delete(directory, true);
                return Task.CompletedTask;
            }, cancellationToken);
            Gates.TryRemove(id, out var gate);
            gate?.Dispose();
            deleted++;
        }
        return deleted;
    }

    public ValueTask<int> CleanupAbandonedAsync(TimeSpan minimumAge, CancellationToken cancellationToken = default)
    {
        if (!Directory.Exists(_root)) return ValueTask.FromResult(0);
        var cutoff = DateTimeOffset.UtcNow - (minimumAge < TimeSpan.Zero ? TimeSpan.Zero : minimumAge);
        var deleted = 0;
        foreach (var file in Directory.EnumerateFiles(_root, "*.tmp", SearchOption.AllDirectories))
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                if (File.GetLastWriteTimeUtc(file) > cutoff.UtcDateTime) continue;
                File.Delete(file);
                deleted++;
            }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
        }
        foreach (var pattern in new[] { ".artifact-set-stage-*", ".artifact-set-backup-*" })
        {
            foreach (var directory in Directory.EnumerateDirectories(_root, pattern, SearchOption.AllDirectories))
            {
                cancellationToken.ThrowIfCancellationRequested();
                try
                {
                    if (Directory.GetLastWriteTimeUtc(directory) > cutoff.UtcDateTime) continue;
                    Directory.Delete(directory, true);
                    deleted++;
                }
                catch (IOException) { }
                catch (UnauthorizedAccessException) { }
            }
        }
        return ValueTask.FromResult(deleted);
    }

    public string GetResultPath(Guid id, string extension) => ResultPath(id, extension);

    private async Task<bool> VerifyOwnershipAsync(Guid id, RenderJobLease lease, CancellationToken cancellationToken)
    {
        return await WithGateAsync(id, async () =>
        {
            var current = await ReadJobAsync(JobPath(id), cancellationToken);
            var valid = OwnsLease(current, lease.WorkerId, lease.FencingToken, requireUnexpired: true);
            if (!valid) await RecordAsync("rune_lease_fencing_rejection_total", cancellationToken);
            return valid;
        }, cancellationToken);
    }

    private static bool OwnsLease(RenderJob? job, string workerId, long fencingToken, bool requireUnexpired)
    {
        if (job is null || IsTerminal(job.Status)) return false;
        if (!string.Equals(job.ClaimedBy, workerId, StringComparison.Ordinal) || job.LeaseToken != fencingToken) return false;
        return !requireUnexpired || job.LeaseExpiresAt > DateTimeOffset.UtcNow;
    }

    private static bool IsTerminal(RenderJobStatus status) =>
        status is RenderJobStatus.Completed or RenderJobStatus.Cancelled or RenderJobStatus.Failed;

    private async Task<StagedArtifactSet> StageArtifactSetAsync(
        Guid id,
        IReadOnlyList<RenderArtifactWrite> artifacts,
        CancellationToken cancellationToken)
    {
        if (artifacts.Count is < 2 or > 100) throw new ArgumentException("Artifact sets must contain between 2 and 100 files.", nameof(artifacts));
        var jobDirectory = JobDirectory(id);
        Directory.CreateDirectory(jobDirectory);
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var transactionId = Guid.NewGuid().ToString("N");
        var stage = Path.Combine(jobDirectory, $".artifact-set-stage-{transactionId}");
        var backup = Path.Combine(jobDirectory, $".artifact-set-backup-{transactionId}");
        Directory.CreateDirectory(stage);
        try
        {
            var commitItems = new List<object>();
            foreach (var artifact in artifacts)
            {
                cancellationToken.ThrowIfCancellationRequested();
                var safeName = ValidateArtifactName(artifact.Name);
                if (!seen.Add(safeName)) throw new ArgumentException($"Duplicate artifact name: {safeName}.", nameof(artifacts));
                var actualDigest = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(artifact.Content));
                if (!string.Equals(actualDigest, artifact.Sha256, StringComparison.OrdinalIgnoreCase))
                    throw new InvalidDataException($"Artifact digest mismatch for {safeName}.");
                RuneFailureInjection.Trigger("during-temp-write", id);
                await File.WriteAllBytesAsync(Path.Combine(stage, safeName), artifact.Content, cancellationToken);
                commitItems.Add(new { name = safeName, length = artifact.Content.LongLength, sha256 = actualDigest });
            }
            var commit = JsonSerializer.SerializeToUtf8Bytes(new
            {
                contractVersion = "1.0",
                renderId = id,
                transactionId,
                createdAt = DateTimeOffset.UtcNow,
                sharedStorageTransaction = true,
                commitProtocol = "stage-verify-rename",
                artifacts = commitItems
            }, JsonOptions);
            await File.WriteAllBytesAsync(Path.Combine(stage, "commit.json"), commit, cancellationToken);
            return new StagedArtifactSet(stage, backup);
        }
        catch
        {
            TryDeleteDirectory(stage);
            throw;
        }
    }

    private async Task CommitArtifactSetAsync(Guid id, StagedArtifactSet staged, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var committed = Path.Combine(JobDirectory(id), "artifact-set");
        try
        {
            RuneFailureInjection.Trigger("during-rename", id);
            if (Directory.Exists(committed)) Directory.Move(committed, staged.Backup);
            Directory.Move(staged.Stage, committed);
            TryDeleteDirectory(staged.Backup);
            await Task.CompletedTask;
        }
        catch
        {
            if (!Directory.Exists(committed) && Directory.Exists(staged.Backup)) Directory.Move(staged.Backup, committed);
            throw;
        }
    }

    private static async Task WriteStreamToTemporaryAsync(Stream content, string temp, Guid id, CancellationToken cancellationToken)
    {
        RuneFailureInjection.Trigger("during-temp-write", id);
        await using var output = new FileStream(temp, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920,
            FileOptions.Asynchronous | FileOptions.WriteThrough);
        await content.CopyToAsync(output, cancellationToken);
        RuneFailureInjection.Trigger("during-upload", id);
        await output.FlushAsync(cancellationToken);
    }


    private static bool SequenceEqual<T>(IReadOnlyList<T>? left, IReadOnlyList<T>? right) where T : struct, Enum =>
        ReferenceEquals(left, right) || left is not null && right is not null && left.SequenceEqual(right);

    private async Task<RenderJob?> FindByIdempotencyKeyUnlockedAsync(string key, CancellationToken cancellationToken)
    {
        if (!Directory.Exists(_root)) return null;
        foreach (var file in Directory.EnumerateFiles(_root, "job.json", SearchOption.AllDirectories))
        {
            cancellationToken.ThrowIfCancellationRequested();
            var job = await ReadJobAsync(file, cancellationToken);
            if (string.Equals(job?.IdempotencyKey, key, StringComparison.Ordinal)) return job;
        }
        return null;
    }

    private string JobDirectory(Guid id) => Path.Combine(_root, id.ToString("N"));
    private string JobPath(Guid id) => Path.Combine(JobDirectory(id), "job.json");
    private string PackagePath(Guid id) => Path.Combine(JobDirectory(id), "package.json");
    private string ResultPath(Guid id, string extension) => Path.Combine(JobDirectory(id), $"result.{extension.TrimStart('.')}");

    private static string ValidateArtifactName(string name)
    {
        if (string.IsNullOrWhiteSpace(name) || name != Path.GetFileName(name) || name.Contains("..", StringComparison.Ordinal))
            throw new ArgumentException("Artifact name must be a safe file name.", nameof(name));
        return name;
    }

    private async Task WriteJobUnlockedAsync(RenderJob job, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(JobDirectory(job.Id));
        var normalized = job with { UpdatedAt = DateTimeOffset.UtcNow };
        await AtomicWriteAsync(JobPath(job.Id), JsonSerializer.SerializeToUtf8Bytes(normalized, JsonOptions), cancellationToken);
    }

    private static RenderJob NormalizeDispatch(
        RenderJob job,
        bool newGeneration,
        IReadOnlyDictionary<string, string>? headers)
    {
        var generation = newGeneration ? checked(Math.Max(0, job.DispatchGeneration) + 1) : Math.Max(1, job.DispatchGeneration);
        var eventId = newGeneration || job.DispatchEventId == Guid.Empty
            ? DeterministicDispatchEventId(job.Id, generation)
            : job.DispatchEventId;
        return job with
        {
            DispatchStatus = RenderDispatchStatus.Pending,
            DispatchEventId = eventId,
            DispatchGeneration = generation,
            DispatchClaimedBy = null,
            DispatchLeaseExpiresAt = null,
            DispatchNextAttemptAt = null,
            DispatchPublishedAt = null,
            DispatchError = null,
            DispatchHeaders = headers
        };
    }

    private static Guid DeterministicDispatchEventId(Guid renderId, long generation)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes($"rune-render-dispatch-v1:{renderId:N}:{generation}"));
        return new Guid(bytes.AsSpan(0, 16));
    }

    private static bool OwnsDispatch(RenderJob? job, RenderDispatchLease lease) =>
        job is not null &&
        job.DispatchStatus == RenderDispatchStatus.Publishing &&
        job.DispatchEventId == lease.EventId &&
        job.DispatchGeneration == lease.Generation &&
        job.DispatchToken == lease.FencingToken &&
        string.Equals(job.DispatchClaimedBy, lease.DispatcherId, StringComparison.Ordinal) &&
        job.DispatchLeaseExpiresAt > DateTimeOffset.UtcNow;

    private static async Task<RenderJob?> ReadJobAsync(string path, CancellationToken cancellationToken)
    {
        if (!File.Exists(path)) return null;
        await using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete, 4096, FileOptions.Asynchronous);
        return await JsonSerializer.DeserializeAsync<RenderJob>(stream, JsonOptions, cancellationToken);
    }

    private static async Task AtomicWriteAsync(string path, byte[] bytes, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var temp = path + $".{Guid.NewGuid():N}.tmp";
        try
        {
            await File.WriteAllBytesAsync(temp, bytes, cancellationToken);
            File.Move(temp, path, true);
        }
        finally
        {
            TryDeleteFile(temp);
        }
    }

    private async Task WithGateAsync(Guid id, Func<Task> action, CancellationToken cancellationToken)
    {
        await WithGateAsync(id, async () => { await action(); return true; }, cancellationToken);
    }

    private async Task<T> WithGateAsync<T>(Guid id, Func<Task<T>> action, CancellationToken cancellationToken)
    {
        var gate = Gates.GetOrAdd(id, static _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(cancellationToken);
        try
        {
            Directory.CreateDirectory(JobDirectory(id));
            await using var fileLock = await AcquireFileLockAsync(Path.Combine(JobDirectory(id), ".job.lock"), cancellationToken);
            return await action();
        }
        finally
        {
            gate.Release();
        }
    }

    private async Task<T> WithStoreLockAsync<T>(Func<Task<T>> action, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(_root);
        var gate = RootGates.GetOrAdd(_root, static _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(cancellationToken);
        try
        {
            await using var fileLock = await AcquireFileLockAsync(Path.Combine(_root, ".store.lock"), cancellationToken);
            return await action();
        }
        finally
        {
            gate.Release();
        }
    }

    private static async Task<FileStream> AcquireFileLockAsync(string path, CancellationToken cancellationToken)
    {
        while (true)
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                return new FileStream(path, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None, 1,
                    FileOptions.Asynchronous | FileOptions.DeleteOnClose);
            }
            catch (IOException)
            {
                await Task.Delay(25, cancellationToken);
            }
        }
    }

    private async ValueTask RecordAsync(string metric, CancellationToken cancellationToken)
    {
        if (_metrics is null) return;
        await _metrics.IncrementAsync(metric, cancellationToken: cancellationToken);
    }

    private static void TryDeleteFile(string path)
    {
        try { if (File.Exists(path)) File.Delete(path); }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
    }

    private static void TryDeleteDirectory(string path)
    {
        try { if (Directory.Exists(path)) Directory.Delete(path, true); }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
    }

    private sealed record StagedArtifactSet(string Stage, string Backup);
}
