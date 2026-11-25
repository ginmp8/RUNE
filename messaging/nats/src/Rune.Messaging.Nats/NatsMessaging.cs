using NATS.Client.Core;
using NATS.Client.JetStream;
using NATS.Client.JetStream.Models;
using NATS.Net;
using Rune.Event.Contracts;
using Rune.Messaging.Abstractions;

namespace Rune.Messaging.Nats;

public static class RuneNatsSubjects
{
    public const string Stream = "RUNE_RENDER";
    public const string Requested = "rune.render.requested.v1";
    public const string Started = "rune.render.started.v1";
    public const string Progressed = "rune.render.progressed.v1";
    public const string Completed = "rune.render.completed.v1";
    public const string Failed = "rune.render.failed.v1";
    public const string Cancelled = "rune.render.cancelled.v1";
    public const string DeadLettered = "rune.render.dead-lettered.v1";
    public const string Consumer = "rune-render-worker-v1";
}

public sealed record RuneNatsOptions(
    string Url = "nats://localhost:4222",
    TimeSpan? AcknowledgementWait = null,
    TimeSpan? NegativeAcknowledgementDelay = null);

public sealed class NatsRenderTransport : IRenderCommandPublisher, IRenderLifecyclePublisher, IRenderCommandConsumer, IAsyncDisposable
{
    private readonly NatsClient _client;
    private readonly INatsJSContext _jetStream;
    private readonly TimeSpan _acknowledgementWait;
    private readonly TimeSpan _negativeAcknowledgementDelay;
    private readonly SemaphoreSlim _provisionGate = new(1, 1);
    private bool _provisioned;

    public NatsRenderTransport(RuneNatsOptions options)
    {
        _client = new NatsClient(new NatsOpts
        {
            Url = options.Url,
            Name = "rune",
            RetryOnInitialConnect = true,
            ConnectTimeout = TimeSpan.FromSeconds(5),
            RequestTimeout = TimeSpan.FromSeconds(10)
        });
        _jetStream = _client.CreateJetStreamContext();
        _acknowledgementWait = options.AcknowledgementWait ?? TimeSpan.FromMinutes(10);
        _negativeAcknowledgementDelay = options.NegativeAcknowledgementDelay ?? TimeSpan.FromSeconds(10);
    }

    public async ValueTask PublishAsync(RenderRequested command, CancellationToken cancellationToken = default)
    {
        await EnsureProvisionedAsync(cancellationToken);
        var ack = await _jetStream.PublishAsync(
            RuneNatsSubjects.Requested,
            command,
            opts: new NatsJSPubOpts
            {
                MsgId = command.Metadata.EventId.ToString("N"),
                RetryAttempts = 3,
                RetryWaitBetweenAttempts = TimeSpan.FromMilliseconds(250)
            },
            cancellationToken: cancellationToken);
        ack.EnsureSuccess();
    }

    public async ValueTask PublishAsync<TRenderEvent>(TRenderEvent message, CancellationToken cancellationToken = default)
        where TRenderEvent : IRenderEvent
    {
        await EnsureProvisionedAsync(cancellationToken);
        var subject = message switch
        {
            RenderStarted => RuneNatsSubjects.Started,
            RenderProgressed => RuneNatsSubjects.Progressed,
            RenderCompleted => RuneNatsSubjects.Completed,
            RenderFailed => RuneNatsSubjects.Failed,
            RenderCancelled => RuneNatsSubjects.Cancelled,
            RenderDeadLettered => RuneNatsSubjects.DeadLettered,
            RenderRequested => RuneNatsSubjects.Requested,
            _ => throw new NotSupportedException(typeof(TRenderEvent).Name)
        };
        var ack = await _jetStream.PublishAsync(
            subject,
            message,
            opts: new NatsJSPubOpts
            {
                MsgId = message.Metadata.EventId.ToString("N"),
                RetryAttempts = 3,
                RetryWaitBetweenAttempts = TimeSpan.FromMilliseconds(250)
            },
            cancellationToken: cancellationToken);
        ack.EnsureSuccess();
    }

    public async Task RunAsync(Func<RenderRequested, CancellationToken, Task<RenderCommandResult>> handler, CancellationToken cancellationToken)
    {
        await EnsureProvisionedAsync(cancellationToken);
        var consumer = await _jetStream.CreateOrUpdateConsumerAsync(
            RuneNatsSubjects.Stream,
            new ConsumerConfig(RuneNatsSubjects.Consumer)
            {
                FilterSubject = RuneNatsSubjects.Requested,
                AckPolicy = ConsumerConfigAckPolicy.Explicit,
                AckWait = _acknowledgementWait,
                MaxDeliver = 4
            },
            cancellationToken);

        await foreach (var message in consumer.ConsumeAsync<RenderRequested>(cancellationToken: cancellationToken))
        {
            try
            {
                if (message.Data is null) { await message.AckAsync(cancellationToken: cancellationToken); continue; }
                using var activity = RuneTelemetry.StartConsumerActivity("rune.render.consume", message.Data.Metadata);
                activity?.SetTag("rune.render.id", message.Data.RenderId.ToString("N"));
                activity?.SetTag("messaging.system", "nats");
                activity?.SetTag("messaging.destination.name", RuneNatsSubjects.Requested);
                var result = await handler(message.Data, cancellationToken);
                switch (result.Disposition)
                {
                    case RenderCommandDisposition.Acknowledge:
                        await message.AckAsync(cancellationToken: cancellationToken);
                        break;
                    case RenderCommandDisposition.Terminate:
                        activity?.SetStatus(System.Diagnostics.ActivityStatusCode.Error, result.Reason);
                        await message.AckTerminateAsync(
                            new AckOpts { TerminateReason = result.Reason ?? "terminal-render-outcome" },
                            cancellationToken);
                        break;
                    default:
                        await message.NakAsync(_negativeAcknowledgementDelay, cancellationToken);
                        break;
                }
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
            catch
            {
                await message.NakAsync(_negativeAcknowledgementDelay, cancellationToken);
            }
        }
    }

    private async ValueTask EnsureProvisionedAsync(CancellationToken cancellationToken)
    {
        if (_provisioned) return;
        await _provisionGate.WaitAsync(cancellationToken);
        try
        {
            if (_provisioned) return;
            await _jetStream.CreateOrUpdateStreamAsync(
                new StreamConfig(RuneNatsSubjects.Stream, ["rune.render.>"])
                {
                    Storage = StreamConfigStorage.File,
                    Retention = StreamConfigRetention.Limits,
                    MaxAge = TimeSpan.FromDays(7),
                    DuplicateWindow = TimeSpan.FromMinutes(2)
                },
                cancellationToken);
            _provisioned = true;
        }
        finally
        {
            _provisionGate.Release();
        }
    }

    public async ValueTask DisposeAsync()
    {
        _provisionGate.Dispose();
        await _client.DisposeAsync();
    }
}
