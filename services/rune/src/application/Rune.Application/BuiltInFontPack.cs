using System.Security.Cryptography;
using Rune.Core;

namespace Rune.Application;

public sealed record BuiltInFontPackDescriptor(
    string Id,
    string Version,
    string Sha256,
    IReadOnlyList<FontFaceDescriptor> Faces,
    IReadOnlyList<FontResourceContent> Resources,
    IReadOnlyDictionary<string, string> UnicodeCoverage);

public static class BuiltInFontPack
{
    public const string Id = "rune-deterministic-fonts-v1";
    public const string Version = "1.0.0";

    public static BuiltInFontPackDescriptor? TryLoad(string? assetRoot = null)
    {
        assetRoot ??= Environment.GetEnvironmentVariable("RUNE_ASSET_ROOT") ?? FindAssetRoot();
        if (string.IsNullOrWhiteSpace(assetRoot)) return null;
        var files = new[]
        {
            (Path: "vendor/katex/fonts/KaTeX_SansSerif-Regular.woff2", Family: "RUNE Deterministic Sans", Coverage: "U+0000-024F,U+2000-206F"),
            (Path: "vendor/katex/fonts/KaTeX_Main-Regular.woff2", Family: "RUNE Deterministic Math", Coverage: "U+0000-024F,U+2000-206F,U+2100-22FF")
        };
        var resources = new List<FontResourceContent>();
        var faces = new List<FontFaceDescriptor>();
        var coverage = new Dictionary<string, string>(StringComparer.Ordinal);
        using var aggregate = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        foreach (var item in files)
        {
            var full = Path.Combine(assetRoot, item.Path.Replace('/', Path.DirectorySeparatorChar));
            if (!File.Exists(full)) return null;
            var bytes = File.ReadAllBytes(full);
            var digest = Convert.ToHexString(SHA256.HashData(bytes));
            aggregate.AppendData(System.Text.Encoding.UTF8.GetBytes(item.Path));
            aggregate.AppendData([0]); aggregate.AppendData(bytes); aggregate.AppendData([0]);
            resources.Add(new FontResourceContent(item.Path, "font/woff2", bytes));
            faces.Add(new FontFaceDescriptor(item.Family, item.Path, 400, Sha256: digest, LicenseSpdx: "MIT", LicenseAllowsEmbedding: true));
            coverage[item.Family] = item.Coverage;
        }
        return new BuiltInFontPackDescriptor(Id, Version, Convert.ToHexString(aggregate.GetHashAndReset()), faces, resources, coverage);
    }

    private static string? FindAssetRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            foreach (var candidate in new[] { Path.Combine(current.FullName, "assets"), Path.Combine(current.FullName, "services", "rune", "assets") })
                if (Directory.Exists(candidate)) return candidate;
            current = current.Parent;
        }
        return null;
    }
}
