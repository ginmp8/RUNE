using Rune.Job.Contracts;

namespace Rune.Storage.Abstractions;

public sealed record RenderArtifactWrite(string Name, byte[] Content, string Sha256);

public interface IRenderJobStore
{
    ValueTask<RenderJob?> FindByIdempotencyKeyAsync(string key, CancellationToken cancellationToken = default);
    ValueTask<RenderJob> CreateAsync(RenderJob job, RenderPackage package, CancellationToken cancellationToken = default);
    ValueTask<RenderJob?> GetAsync(Guid id, CancellationToken cancellationToken = default);
    ValueTask<RenderJobPage> QueryAsync(RenderJobQuery query, CancellationToken cancellationToken = default);
    ValueTask SaveAsync(RenderJob job, CancellationToken cancellationToken = default);
    ValueTask<bool> TryClaimAsync(Guid id, string workerId, TimeSpan leaseDuration, CancellationToken cancellationToken = default);
    ValueTask<RenderJobLease?> TryAcquireLeaseAsync(Guid id, string workerId, TimeSpan leaseDuration, CancellationToken cancellationToken = default);
    ValueTask<bool> RenewLeaseAsync(Guid id, string workerId, TimeSpan leaseDuration, CancellationToken cancellationToken = default);
    ValueTask<bool> RenewLeaseAsync(Guid id, string workerId, long fencingToken, TimeSpan leaseDuration, CancellationToken cancellationToken = default);
    ValueTask<bool> SaveOwnedAsync(RenderJob job, RenderJobLease lease, CancellationToken cancellationToken = default);
    ValueTask<bool> RequestCancellationAsync(Guid id, string? reason, CancellationToken cancellationToken = default);
    ValueTask<bool> RequeueAsync(Guid id, bool resetAttempts, CancellationToken cancellationToken = default);
    ValueTask<bool> ScheduleDispatchAsync(Guid id, bool newGeneration, IReadOnlyDictionary<string, string>? headers = null, CancellationToken cancellationToken = default);
    IAsyncEnumerable<RenderJob> ListPendingDispatchesAsync(DateTimeOffset now, int limit = 100, CancellationToken cancellationToken = default);
    ValueTask<RenderDispatchLease?> TryAcquireDispatchAsync(Guid id, string dispatcherId, TimeSpan leaseDuration, CancellationToken cancellationToken = default);
    ValueTask<bool> MarkDispatchPublishedAsync(RenderDispatchLease lease, DateTimeOffset publishedAt, CancellationToken cancellationToken = default);
    ValueTask<bool> MarkDispatchFailedAsync(RenderDispatchLease lease, string error, DateTimeOffset nextAttemptAt, CancellationToken cancellationToken = default);
    ValueTask<bool> MarkDeadLetteredAsync(Guid id, int attempt, string reason, DateTimeOffset deadLetteredAt, CancellationToken cancellationToken = default);
    IAsyncEnumerable<RenderJob> ListRecoverableAsync(DateTimeOffset now, CancellationToken cancellationToken = default);
    ValueTask<RenderPackage> GetPackageAsync(Guid id, CancellationToken cancellationToken = default);
    ValueTask SavePackageAsync(RenderPackage package, CancellationToken cancellationToken = default);
    ValueTask<long> SaveResultAsync(Guid id, Stream content, string extension, CancellationToken cancellationToken = default);
    ValueTask<long?> SaveResultOwnedAsync(Guid id, RenderJobLease lease, Stream content, string extension, CancellationToken cancellationToken = default);
    ValueTask<Stream?> OpenResultAsync(Guid id, CancellationToken cancellationToken = default);
    ValueTask<long> SaveArtifactAsync(Guid id, string name, Stream content, CancellationToken cancellationToken = default);
    ValueTask<long?> SaveArtifactOwnedAsync(Guid id, RenderJobLease lease, string name, Stream content, CancellationToken cancellationToken = default);
    ValueTask SaveArtifactSetAsync(Guid id, IReadOnlyList<RenderArtifactWrite> artifacts, CancellationToken cancellationToken = default);
    ValueTask<bool> SaveArtifactSetOwnedAsync(Guid id, RenderJobLease lease, IReadOnlyList<RenderArtifactWrite> artifacts, CancellationToken cancellationToken = default);
    ValueTask<Stream?> OpenArtifactAsync(Guid id, string name, CancellationToken cancellationToken = default);
    ValueTask<int> DeleteExpiredAsync(DateTimeOffset completedBefore, CancellationToken cancellationToken = default);
    ValueTask<int> CleanupAbandonedAsync(TimeSpan minimumAge, CancellationToken cancellationToken = default);
}
