using Rune.Event.Contracts;

namespace Rune.Messaging.Abstractions;

public enum RenderCommandDisposition
{
    Acknowledge,
    Retry,
    Terminate
}

public sealed record RenderCommandResult(
    RenderCommandDisposition Disposition,
    string? Reason = null,
    int Attempt = 0);

public interface IRenderCommandPublisher
{
    ValueTask PublishAsync(RenderRequested command, CancellationToken cancellationToken = default);
}

public interface IRenderLifecyclePublisher
{
    ValueTask PublishAsync<TRenderEvent>(TRenderEvent message, CancellationToken cancellationToken = default)
        where TRenderEvent : IRenderEvent;
}

public interface IRenderCommandConsumer
{
    Task RunAsync(Func<RenderRequested, CancellationToken, Task<RenderCommandResult>> handler, CancellationToken cancellationToken);
}
