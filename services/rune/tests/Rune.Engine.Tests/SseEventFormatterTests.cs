using Rune.Api.Contracts;

namespace Rune.Engine.Tests;

public sealed class SseEventFormatterTests
{
    [Fact]
    public void Formats_resumable_event_with_id_retry_and_json_data()
    {
        var text = SseEventFormatter.Format("render-status", new { status = "rendering", progress = 50 }, 123, 1500);
        Assert.StartsWith("id: 123\nevent: render-status\nretry: 1500\n", text);
        Assert.Contains("data: {\"status\":\"rendering\",\"progress\":50}", text);
        Assert.EndsWith("\n\n", text);
    }

    [Theory]
    [InlineData("123", 123)]
    [InlineData("0", 0)]
    [InlineData("invalid", 0)]
    [InlineData(null, 0)]
    public void Parses_last_event_id_safely(string? input, long expected) => Assert.Equal(expected, SseEventFormatter.ParseLastEventId(input));

    [Fact]
    public void Heartbeat_is_an_sse_comment() => Assert.StartsWith(": heartbeat ", SseEventFormatter.Heartbeat(DateTimeOffset.UnixEpoch));
}
