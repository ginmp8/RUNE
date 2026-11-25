using Rune.Event.Contracts;
using Rune.Messaging.Nats;
using Rune.Messaging.Abstractions;

namespace Rune.Messaging.Nats.Tests;

public sealed class NatsLiveIntegrationTests
{
    [Fact]
    public async Task Publish_consume_and_ack_round_trip_against_live_jetstream()
    {
        if (!string.Equals(Environment.GetEnvironmentVariable("RUNE_RUN_NATS_INTEGRATION"), "1", StringComparison.Ordinal))
            return;

        var url = Environment.GetEnvironmentVariable("RUNE_NATS_URL") ?? "nats://127.0.0.1:4222";
        await using var transport = new NatsRenderTransport(new RuneNatsOptions(url));
        using var cancellation = new CancellationTokenSource(TimeSpan.FromSeconds(30));
        var renderId = Guid.NewGuid();
        var expected = new RenderRequested(
            new EventMetadata(Guid.NewGuid(), renderId, null, "1.0", DateTimeOffset.UtcNow),
            renderId,
            $"packages/{renderId:N}.json");
        var received = new TaskCompletionSource<RenderRequested>(TaskCreationOptions.RunContinuationsAsynchronously);

        var consumer = Task.Run(async () =>
        {
            try
            {
                await transport.RunAsync((message, _) =>
                {
                    if (message.RenderId == renderId) received.TrySetResult(message);
                    return Task.FromResult(new RenderCommandResult(RenderCommandDisposition.Acknowledge));
                }, cancellation.Token);
            }
            catch (OperationCanceledException) when (cancellation.IsCancellationRequested)
            {
                // Cooperative cancellation is a valid shutdown path.
            }
        });

        await Task.Delay(500, cancellation.Token);
        await transport.PublishAsync(expected, cancellation.Token);
        var actual = await received.Task.WaitAsync(TimeSpan.FromSeconds(20), cancellation.Token);

        Assert.Equal(expected.RenderId, actual.RenderId);
        Assert.Equal(expected.PackagePath, actual.PackagePath);
        Assert.Equal(expected.Metadata.EventId, actual.Metadata.EventId);

        cancellation.Cancel();
        await consumer.WaitAsync(TimeSpan.FromSeconds(5));
    }
}
