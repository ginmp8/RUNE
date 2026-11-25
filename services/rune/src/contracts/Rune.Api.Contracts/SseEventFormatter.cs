using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace Rune.Api.Contracts;

public static partial class SseEventFormatter
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
    };

    public static long ParseLastEventId(string? value) =>
        long.TryParse(value, System.Globalization.NumberStyles.None, System.Globalization.CultureInfo.InvariantCulture, out var parsed) && parsed > 0 ? parsed : 0;

    public static string Format(string eventName, object payload, long id, int? retryMilliseconds = null)
    {
        if (!EventNameRegex().IsMatch(eventName))
            throw new ArgumentException("SSE event names may contain only letters, digits, hyphens, and underscores.", nameof(eventName));
        if (id <= 0)
            throw new ArgumentOutOfRangeException(nameof(id));
        if (retryMilliseconds is <= 0)
            throw new ArgumentOutOfRangeException(nameof(retryMilliseconds));

        var builder = new StringBuilder();
        builder.Append("id: ").Append(id).Append('\n');
        builder.Append("event: ").Append(eventName).Append('\n');
        if (retryMilliseconds is not null)
            builder.Append("retry: ").Append(retryMilliseconds.Value).Append('\n');
        foreach (var line in JsonSerializer.Serialize(payload, JsonOptions).Split('\n'))
            builder.Append("data: ").Append(line).Append('\n');
        return builder.Append('\n').ToString();
    }

    public static string Heartbeat(DateTimeOffset timestamp) => $": heartbeat {timestamp:O}\n\n";

    [GeneratedRegex("^[A-Za-z0-9_-]+$", RegexOptions.CultureInvariant)]
    private static partial Regex EventNameRegex();
}
