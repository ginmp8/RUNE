using System.Diagnostics;
using System.Diagnostics.Metrics;
using System.Security.Cryptography;
using System.Text;

namespace Rune.Event.Contracts;

public static class RuneTelemetry
{
    public const string ActivitySourceName = "Rune";
    public const string MeterName = "Rune";
    public const string TraceParentHeader = "traceparent";
    public const string TraceStateHeader = "tracestate";

    public static readonly ActivitySource ActivitySource = new(ActivitySourceName);
    public static readonly Meter Meter = new(MeterName);
    public static readonly Counter<long> DispatchPublished = Meter.CreateCounter<long>("rune.dispatch.published");
    public static readonly Counter<long> DispatchFailed = Meter.CreateCounter<long>("rune.dispatch.failed");
    public static readonly Counter<long> DeadLettered = Meter.CreateCounter<long>("rune.message.dead_lettered");
    public static readonly Histogram<double> RenderDuration = Meter.CreateHistogram<double>("rune.render.duration", "s");

    public static IReadOnlyDictionary<string, string>? CaptureHeaders(Activity? activity = null)
    {
        activity ??= Activity.Current;
        if (activity is null || string.IsNullOrWhiteSpace(activity.Id)) return null;
        var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            [TraceParentHeader] = activity.Id
        };
        if (!string.IsNullOrWhiteSpace(activity.TraceStateString))
            headers[TraceStateHeader] = activity.TraceStateString;
        return headers;
    }

    public static Activity? StartConsumerActivity(string name, EventMetadata metadata)
    {
        var parent = default(ActivityContext);
        if (metadata.Headers is not null &&
            metadata.Headers.TryGetValue(TraceParentHeader, out var traceParent) &&
            ActivityContext.TryParse(traceParent,
                metadata.Headers.TryGetValue(TraceStateHeader, out var traceState) ? traceState : null,
                out var parsed))
            parent = parsed;
        return parent != default
            ? ActivitySource.StartActivity(name, ActivityKind.Consumer, parent)
            : ActivitySource.StartActivity(name, ActivityKind.Consumer);
    }

    public static Guid DeterministicEventId(Guid correlationId, string eventKind, long generation = 0)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes($"rune-event-v1:{correlationId:N}:{eventKind}:{generation}"));
        return new Guid(bytes.AsSpan(0, 16));
    }
}

public sealed record EventMetadata(
    Guid EventId,
    Guid CorrelationId,
    Guid? CausationId,
    string SchemaVersion,
    DateTimeOffset OccurredAt,
    IReadOnlyDictionary<string, string>? Headers = null);

public interface IRenderEvent { EventMetadata Metadata { get; } Guid RenderId { get; } }

public sealed record RenderRequested(EventMetadata Metadata, Guid RenderId, string PackagePath) : IRenderEvent;
public sealed record RenderStarted(EventMetadata Metadata, Guid RenderId, int Attempt, string WorkerId) : IRenderEvent;
public sealed record RenderProgressed(EventMetadata Metadata, Guid RenderId, int Percent, string Stage) : IRenderEvent;
public sealed record RenderCompleted(EventMetadata Metadata, Guid RenderId, string ResultPath, string ContentType, long ResultLength) : IRenderEvent;
public sealed record RenderFailed(EventMetadata Metadata, Guid RenderId, int Attempt, string Error, bool WillRetry) : IRenderEvent;
public sealed record RenderCancelled(EventMetadata Metadata, Guid RenderId, string Reason) : IRenderEvent;
public sealed record RenderDeadLettered(EventMetadata Metadata, Guid RenderId, int Attempt, string Reason, DateTimeOffset DeadLetteredAt) : IRenderEvent;
