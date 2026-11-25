using System.Security.Cryptography;
using System.Text;
using Rune.Core;
using Rune.Application;
using Rune.Event.Contracts;
using Rune.Job.Contracts;
using Rune.Jobs;
using Rune.Messaging.Abstractions;
using Rune.Storage.Abstractions;

namespace Rune.Jobs.Tests;

public sealed class JobStoreTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "rune-tests", Guid.NewGuid().ToString("N"));

    [Fact]
    public async Task Job_and_package_round_trip_is_idempotent()
    {
        var store = new FileSystemRenderJobStore(_root);
        var service = new RenderJobService(store);
        var job = await service.CreateAsync("<p>x</p>", RenderOutputFormat.Pdf, new RenderOptions(), null, "same-key");
        var duplicate = await service.CreateAsync("<p>x</p>", RenderOutputFormat.Pdf, new RenderOptions(), null, "same-key");
        Assert.Equal(job.Id, duplicate.Id);
        Assert.Equal(job.Id, (await store.GetPackageAsync(job.Id)).RenderId);
    }

    [Fact]
    public async Task Concurrent_idempotent_creation_produces_one_job()
    {
        var store = new FileSystemRenderJobStore(_root);
        var service = new RenderJobService(store);
        var jobs = await Task.WhenAll(Enumerable.Range(0, 16)
            .Select(_ => service.CreateAsync("<p>x</p>", RenderOutputFormat.Pdf, new RenderOptions(), null, "concurrent-key").AsTask()));
        Assert.Single(jobs.Select(job => job.Id).Distinct());
    }

    [Fact]
    public async Task Idempotency_key_rejects_a_different_payload()
    {
        var store = new FileSystemRenderJobStore(_root);
        var service = new RenderJobService(store);
        await service.CreateAsync("<p>one</p>", RenderOutputFormat.Pdf, new RenderOptions(), null, "conflict-key");
        await Assert.ThrowsAsync<ArgumentException>(async () =>
            await service.CreateAsync("<p>two</p>", RenderOutputFormat.Pdf, new RenderOptions(), null, "conflict-key"));
    }

    [Fact]
    public async Task Claim_lease_cancel_retry_and_query_follow_the_job_contract()
    {
        var store = new FileSystemRenderJobStore(_root);
        var service = new RenderJobService(store);
        var job = await service.CreateAsync("<p>x</p>", RenderOutputFormat.Png, new RenderOptions(), null, null);

        Assert.True(await store.TryClaimAsync(job.Id, "worker-one", TimeSpan.FromMinutes(1)));
        Assert.False(await store.TryClaimAsync(job.Id, "worker-two", TimeSpan.FromMinutes(1)));
        Assert.True(await store.RenewLeaseAsync(job.Id, "worker-one", TimeSpan.FromMinutes(2)));
        Assert.True(await store.RequestCancellationAsync(job.Id, "test"));
        var requested = Assert.IsType<RenderJob>(await store.GetAsync(job.Id));
        Assert.Equal(RenderJobStatus.CancelRequested, requested.Status);

        await store.SaveAsync(requested with { Status = RenderJobStatus.Cancelled, CompletedAt = DateTimeOffset.UtcNow, ClaimedBy = null, LeaseExpiresAt = null });
        Assert.True(await store.RequeueAsync(job.Id, resetAttempts: true));
        var requeued = Assert.IsType<RenderJob>(await store.GetAsync(job.Id));
        Assert.Equal(RenderJobStatus.Queued, requeued.Status);
        Assert.Equal(0, requeued.Attempt);

        await using var result = new MemoryStream(Encoding.UTF8.GetBytes("result"));
        Assert.Equal(6, await store.SaveResultAsync(job.Id, result, "txt"));
        Assert.NotNull(await store.OpenResultAsync(job.Id));
        var page = await store.QueryAsync(new RenderJobQuery(Limit: 10));
        Assert.Equal(1, page.Total);
        Assert.Equal(job.Id, Assert.Single(page.Items).Id);
    }

    [Fact]
    public async Task Retention_deletes_only_completed_jobs_before_cutoff()
    {
        var store = new FileSystemRenderJobStore(_root);
        var service = new RenderJobService(store);
        var expired = await service.CreateAsync("<p>old</p>", RenderOutputFormat.Pdf, new RenderOptions(), null, null);
        var active = await service.CreateAsync("<p>active</p>", RenderOutputFormat.Pdf, new RenderOptions(), null, null);
        await store.SaveAsync(expired with { Status = RenderJobStatus.Completed, CompletedAt = DateTimeOffset.UtcNow.AddDays(-20) });

        Assert.Equal(1, await store.DeleteExpiredAsync(DateTimeOffset.UtcNow.AddDays(-7)));
        Assert.Null(await store.GetAsync(expired.Id));
        Assert.NotNull(await store.GetAsync(active.Id));
    }

    public void Dispose() { if (Directory.Exists(_root)) Directory.Delete(_root, true); }

    [Fact]
    public async Task Artifact_set_commits_as_one_verified_shared_storage_transaction()
    {
        var store = new FileSystemRenderJobStore(_root);
        var id = Guid.NewGuid();
        var first = Encoding.UTF8.GetBytes("first");
        var second = Encoding.UTF8.GetBytes("second");
        await store.SaveArtifactSetAsync(id, [
            new RenderArtifactWrite("first.txt", first, Convert.ToHexString(SHA256.HashData(first))),
            new RenderArtifactWrite("second.txt", second, Convert.ToHexString(SHA256.HashData(second)))
        ]);
        await using var firstStream = await store.OpenArtifactAsync(id, "first.txt");
        await using var secondStream = await store.OpenArtifactAsync(id, "second.txt");
        Assert.NotNull(firstStream);
        Assert.NotNull(secondStream);
        var commit = Directory.EnumerateFiles(_root, "commit.json", SearchOption.AllDirectories).Single();
        Assert.Contains("stage-verify", await File.ReadAllTextAsync(commit), StringComparison.OrdinalIgnoreCase);
        Assert.Empty(Directory.EnumerateDirectories(_root, ".artifact-set-stage-*", SearchOption.AllDirectories));
    }

    [Fact]
    public async Task Artifact_set_digest_failure_rolls_back_without_partial_publication()
    {
        var store = new FileSystemRenderJobStore(_root);
        var id = Guid.NewGuid();
        var valid = Encoding.UTF8.GetBytes("valid");
        await Assert.ThrowsAsync<InvalidDataException>(async () => await store.SaveArtifactSetAsync(id, [
            new RenderArtifactWrite("valid.txt", valid, Convert.ToHexString(SHA256.HashData(valid))),
            new RenderArtifactWrite("invalid.txt", Encoding.UTF8.GetBytes("invalid"), "00")
        ]));
        Assert.Null(await store.OpenArtifactAsync(id, "valid.txt"));
        Assert.Null(await store.OpenArtifactAsync(id, "invalid.txt"));
        Assert.Empty(Directory.EnumerateDirectories(_root, "artifact-set", SearchOption.AllDirectories));
    }

    [Fact]
    public async Task Expired_lease_is_replaced_and_old_fencing_token_is_rejected()
    {
        var store = new FileSystemRenderJobStore(_root);
        var job = await new RenderJobService(store).CreateAsync("<p>x</p>", RenderOutputFormat.Png, new RenderOptions(), null, null);
        var oldLease = Assert.IsType<RenderJobLease>(await store.TryAcquireLeaseAsync(job.Id, "worker-old", TimeSpan.FromMilliseconds(40)));
        await Task.Delay(80);
        var newLease = Assert.IsType<RenderJobLease>(await store.TryAcquireLeaseAsync(job.Id, "worker-new", TimeSpan.FromMinutes(1)));

        Assert.True(newLease.FencingToken > oldLease.FencingToken);
        var current = Assert.IsType<RenderJob>(await store.GetAsync(job.Id));
        Assert.False(await store.SaveOwnedAsync(current with { ProgressStage = "stale-write" }, oldLease));
        Assert.True(await store.SaveOwnedAsync(current with { ProgressStage = "new-owner" }, newLease));
        Assert.Equal("new-owner", (await store.GetAsync(job.Id))!.ProgressStage);
    }

    [Fact]
    public async Task Old_owner_cannot_publish_result_after_takeover()
    {
        var store = new FileSystemRenderJobStore(_root);
        var job = await new RenderJobService(store).CreateAsync("<p>x</p>", RenderOutputFormat.Png, new RenderOptions(), null, null);
        var oldLease = Assert.IsType<RenderJobLease>(await store.TryAcquireLeaseAsync(job.Id, "worker-old", TimeSpan.FromMilliseconds(40)));
        await Task.Delay(80);
        var newLease = Assert.IsType<RenderJobLease>(await store.TryAcquireLeaseAsync(job.Id, "worker-new", TimeSpan.FromMinutes(1)));

        await using var stale = new MemoryStream(Encoding.UTF8.GetBytes("stale"));
        Assert.Null(await store.SaveResultOwnedAsync(job.Id, oldLease, stale, "txt"));
        await using var current = new MemoryStream(Encoding.UTF8.GetBytes("current"));
        Assert.Equal(7, await store.SaveResultOwnedAsync(job.Id, newLease, current, "txt"));
        await using var published = Assert.IsAssignableFrom<Stream>(await store.OpenResultAsync(job.Id));
        using var reader = new StreamReader(published, Encoding.UTF8);
        Assert.Equal("current", await reader.ReadToEndAsync());
    }

    [Fact]
    public async Task Cleanup_removes_only_abandoned_temporary_entries()
    {
        var store = new FileSystemRenderJobStore(_root);
        var directory = Path.Combine(_root, Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(directory);
        var abandoned = Path.Combine(directory, "result.pdf.old.tmp");
        var fresh = Path.Combine(directory, "result.pdf.new.tmp");
        await File.WriteAllTextAsync(abandoned, "old");
        await File.WriteAllTextAsync(fresh, "new");
        File.SetLastWriteTimeUtc(abandoned, DateTime.UtcNow.AddHours(-1));

        Assert.Equal(1, await store.CleanupAbandonedAsync(TimeSpan.FromMinutes(5)));
        Assert.False(File.Exists(abandoned));
        Assert.True(File.Exists(fresh));
    }

    [Fact]
    public async Task Durable_dispatch_survives_publication_failure_and_reuses_the_same_event_identity()
    {
        var store = new FileSystemRenderJobStore(_root);
        var job = await new RenderJobService(store).CreateAsync("<p>x</p>", RenderOutputFormat.Pdf, new RenderOptions(), null, null);
        var publisher = new FlakyPublisher();
        var outbox = new RenderCommandOutbox(store, publisher);

        Assert.False(await outbox.PublishAsync(job.Id));
        var pending = Assert.IsType<RenderJob>(await store.GetAsync(job.Id));
        Assert.Equal(RenderDispatchStatus.Pending, pending.DispatchStatus);
        Assert.NotEqual(Guid.Empty, pending.DispatchEventId);
        var firstEventId = pending.DispatchEventId;

        publisher.Fail = false;
        Assert.True(await store.ScheduleDispatchAsync(job.Id, newGeneration: false));
        Assert.True(await outbox.PublishAsync(job.Id));
        var published = Assert.IsType<RenderJob>(await store.GetAsync(job.Id));
        Assert.Equal(RenderDispatchStatus.Published, published.DispatchStatus);
        Assert.Equal(firstEventId, published.DispatchEventId);
        Assert.Equal([firstEventId, firstEventId], publisher.EventIds);
    }

    [Fact]
    public async Task Dispatch_publication_timeout_returns_job_to_pending_for_reconciliation()
    {
        var store = new FileSystemRenderJobStore(_root);
        var job = await new RenderJobService(store).CreateAsync("<p>x</p>", RenderOutputFormat.Pdf, new RenderOptions(), null, null);
        var outbox = new RenderCommandOutbox(store, new BlockingPublisher(), publishTimeout: TimeSpan.FromMilliseconds(50));

        Assert.False(await outbox.PublishAsync(job.Id));
        var pending = Assert.IsType<RenderJob>(await store.GetAsync(job.Id));
        Assert.Equal(RenderDispatchStatus.Pending, pending.DispatchStatus);
        Assert.Contains("dispatch-publish-timeout", pending.DispatchError);
        Assert.NotNull(pending.DispatchNextAttemptAt);
    }

    [Fact]
    public async Task Dispatch_fencing_rejects_an_old_publisher_after_takeover()
    {
        var store = new FileSystemRenderJobStore(_root);
        var job = await new RenderJobService(store).CreateAsync("<p>x</p>", RenderOutputFormat.Pdf, new RenderOptions(), null, null);
        var oldLease = Assert.IsType<RenderDispatchLease>(await store.TryAcquireDispatchAsync(job.Id, "api-old", TimeSpan.FromMilliseconds(40)));
        await Task.Delay(80);
        var newLease = Assert.IsType<RenderDispatchLease>(await store.TryAcquireDispatchAsync(job.Id, "api-new", TimeSpan.FromMinutes(1)));

        Assert.True(newLease.FencingToken > oldLease.FencingToken);
        Assert.False(await store.MarkDispatchPublishedAsync(oldLease, DateTimeOffset.UtcNow));
        Assert.True(await store.MarkDispatchPublishedAsync(newLease, DateTimeOffset.UtcNow));
    }

    [Fact]
    public async Task Dead_letter_state_is_explicit_and_requeue_creates_a_new_dispatch_generation()
    {
        var store = new FileSystemRenderJobStore(_root);
        var job = await new RenderJobService(store).CreateAsync("<p>x</p>", RenderOutputFormat.Pdf, new RenderOptions(), null, null);
        var initialGeneration = job.DispatchGeneration;
        Assert.True(await store.MarkDeadLetteredAsync(job.Id, 4, "poison-render", DateTimeOffset.UtcNow));
        var dead = Assert.IsType<RenderJob>(await store.GetAsync(job.Id));
        Assert.Equal(RenderJobStatus.Failed, dead.Status);
        Assert.Equal("poison-render", dead.DeadLetterReason);

        Assert.True(await store.RequeueAsync(job.Id, resetAttempts: true));
        var replay = Assert.IsType<RenderJob>(await store.GetAsync(job.Id));
        Assert.Equal(RenderJobStatus.Queued, replay.Status);
        Assert.Null(replay.DeadLetteredAt);
        Assert.True(replay.DispatchGeneration > initialGeneration);
        Assert.Equal(RenderDispatchStatus.Pending, replay.DispatchStatus);
    }

    [Fact]
    public void Trace_context_headers_round_trip_through_event_metadata()
    {
        using var listener = new System.Diagnostics.ActivityListener
        {
            ShouldListenTo = source => source.Name == RuneTelemetry.ActivitySourceName,
            Sample = (ref System.Diagnostics.ActivityCreationOptions<System.Diagnostics.ActivityContext> _) => System.Diagnostics.ActivitySamplingResult.AllData
        };
        System.Diagnostics.ActivitySource.AddActivityListener(listener);
        using var activity = RuneTelemetry.ActivitySource.StartActivity("test-producer", System.Diagnostics.ActivityKind.Producer);
        var headers = RuneTelemetry.CaptureHeaders(activity);
        Assert.NotNull(headers);
        Assert.True(headers!.ContainsKey(RuneTelemetry.TraceParentHeader));
        var metadata = new EventMetadata(Guid.NewGuid(), Guid.NewGuid(), null, "1.0", DateTimeOffset.UtcNow, headers);
        using var consumer = RuneTelemetry.StartConsumerActivity("test-consumer", metadata);
        Assert.NotNull(consumer);
        Assert.Equal(activity!.TraceId, consumer!.TraceId);
    }

    private sealed class BlockingPublisher : IRenderCommandPublisher
    {
        public async ValueTask PublishAsync(RenderRequested command, CancellationToken cancellationToken = default)
        {
            await Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken);
        }
    }

    private sealed class FlakyPublisher : IRenderCommandPublisher
    {
        public bool Fail { get; set; } = true;
        public List<Guid> EventIds { get; } = [];

        public ValueTask PublishAsync(RenderRequested command, CancellationToken cancellationToken = default)
        {
            EventIds.Add(command.Metadata.EventId);
            if (Fail) throw new IOException("simulated broker outage");
            return ValueTask.CompletedTask;
        }
    }

}
