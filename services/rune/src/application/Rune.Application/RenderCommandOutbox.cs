using Rune.Event.Contracts;
using Rune.Messaging.Abstractions;
using Rune.Storage.Abstractions;

namespace Rune.Application;

public sealed class RenderCommandOutbox(
    IRenderJobStore jobs,
    IRenderCommandPublisher publisher,
    TimeProvider? timeProvider = null,
    TimeSpan? publishTimeout = null)
{
    private readonly string _dispatcherId = $"{Environment.MachineName}-{Environment.ProcessId}-{Guid.NewGuid():N}";
    private readonly TimeProvider _timeProvider = timeProvider ?? TimeProvider.System;
    private readonly TimeSpan _leaseDuration = TimeSpan.FromSeconds(30);
    private readonly TimeSpan _publishTimeout = publishTimeout ?? TimeSpan.FromSeconds(5);

    public async ValueTask<bool> PublishAsync(Guid renderId, CancellationToken cancellationToken = default)
    {
        var lease = await jobs.TryAcquireDispatchAsync(renderId, _dispatcherId, _leaseDuration, cancellationToken);
        if (lease is null)
        {
            var current = await jobs.GetAsync(renderId, cancellationToken);
            return current?.DispatchStatus == Rune.Job.Contracts.RenderDispatchStatus.Published;
        }

        using var activity = RuneTelemetry.ActivitySource.StartActivity("rune.dispatch.publish", System.Diagnostics.ActivityKind.Producer);
        activity?.SetTag("rune.render.id", renderId.ToString("N"));
        activity?.SetTag("rune.dispatch.generation", lease.Generation);
        activity?.SetTag("messaging.operation", "publish");
        try
        {
            var metadata = new EventMetadata(
                lease.EventId,
                renderId,
                null,
                "1.0",
                _timeProvider.GetUtcNow(),
                lease.Headers);
            using var publishCancellation = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            publishCancellation.CancelAfter(_publishTimeout);
            await publisher.PublishAsync(new RenderRequested(metadata, renderId, lease.PackagePath), publishCancellation.Token);
            var publishedAt = _timeProvider.GetUtcNow();
            var saved = await jobs.MarkDispatchPublishedAsync(lease, publishedAt, cancellationToken);
            if (saved) RuneTelemetry.DispatchPublished.Add(1);
            return saved;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (OperationCanceledException)
        {
            const string error = "dispatch-publish-timeout: command publication exceeded the configured timeout";
            activity?.SetStatus(System.Diagnostics.ActivityStatusCode.Error, error);
            await jobs.MarkDispatchFailedAsync(
                lease,
                error,
                _timeProvider.GetUtcNow().AddSeconds(1),
                CancellationToken.None);
            RuneTelemetry.DispatchFailed.Add(1);
            return false;
        }
        catch (Exception exception)
        {
            activity?.SetStatus(System.Diagnostics.ActivityStatusCode.Error, exception.Message);
            var seconds = Math.Min(60, Math.Pow(2, Math.Clamp(lease.Attempt - 1, 0, 6)));
            await jobs.MarkDispatchFailedAsync(
                lease,
                exception.Message,
                _timeProvider.GetUtcNow().AddSeconds(seconds),
                CancellationToken.None);
            RuneTelemetry.DispatchFailed.Add(1);
            return false;
        }
    }

    public async ValueTask<int> PublishAvailableAsync(int limit = 100, CancellationToken cancellationToken = default)
    {
        var published = 0;
        await foreach (var job in jobs.ListPendingDispatchesAsync(_timeProvider.GetUtcNow(), limit, cancellationToken))
            if (await PublishAsync(job.Id, cancellationToken)) published++;
        return published;
    }
}
