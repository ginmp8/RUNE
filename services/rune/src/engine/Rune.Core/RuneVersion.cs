using System.Reflection;

namespace Rune.Core;

public static class RuneVersion
{
    private static readonly Lazy<string> Resolved = new(Resolve);

    public static string Current => Resolved.Value;

    private static string Resolve()
    {
        var value = typeof(RuneVersion).Assembly
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?
            .InformationalVersion;
        if (string.IsNullOrWhiteSpace(value))
            return typeof(RuneVersion).Assembly.GetName().Version?.ToString(3) ?? "unknown";
        var separator = value.IndexOf('+', StringComparison.Ordinal);
        return separator < 0 ? value : value[..separator];
    }
}
