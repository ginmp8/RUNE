using System.Security.Cryptography;
using System.Text;

namespace Rune.Rendering;

public sealed record RendererCapability(
    string Id,
    bool Configured,
    bool Available,
    string Version,
    string Source,
    string License,
    string LicenseScope,
    string? Sha256,
    IReadOnlyList<string> RequiredAssets,
    IReadOnlyList<string> MissingAssets);

public sealed class RendererAssetCatalog(string assetRoot)
{
    private sealed record Definition(string Id, string Version, string Source, string License, string LicenseScope, params string[] Assets);

    private static readonly Definition[] Definitions =
    [
        new("mermaid", "11.16.0", "bundled-npm", "MIT", "third-party-component", "vendor/mermaid/mermaid.min.js", "vendor/mermaid/LICENSE"),
        new("katex", "0.18.1", "bundled-npm", "MIT", "third-party-component", "vendor/katex/katex.min.js", "vendor/katex/katex.min.css", "vendor/katex/LICENSE"),
        new("schematex", "1.0.1", "official-npm-package-renderResult", "AGPL-3.0-only", "third-party-component", "vendor/schematex/package/dist/index.js", "vendor/schematex/render.mjs", "vendor/schematex/LICENSE", "vendor/schematex/SOURCE.json", "vendor/schematex/SHA256SUMS"),
        new("orgchart", "1.0.1", "official-npm-package-renderResult", "AGPL-3.0-only", "third-party-component", "vendor/schematex/package/dist/index.js", "vendor/schematex/render.mjs", "vendor/schematex/LICENSE", "vendor/schematex/SOURCE.json", "vendor/schematex/SHA256SUMS"),
        new("reactflow", Rune.Core.RuneVersion.Current, "built-in", "MIT", "rune-project", "reactflow/reactflow-renderer.js", "reactflow/reactflow.css"),
        new("ownership-chart", Rune.Core.RuneVersion.Current, "built-in", "MIT", "rune-project", "reference/ownership-renderer.js", "reference/ownership.css"),
        new("geojson", Rune.Core.RuneVersion.Current, "built-in", "MIT", "rune-project", "reference/static-diagrams.js"),
        new("topojson", Rune.Core.RuneVersion.Current, "built-in", "MIT", "rune-project", "reference/static-diagrams.js"),
        new("chart", Rune.Core.RuneVersion.Current, "built-in", "MIT", "rune-project", "reference/static-diagrams.js"),
        new("stl", Rune.Core.RuneVersion.Current, "built-in", "MIT", "rune-project", "reference/static-diagrams.js")
    ];

    public IReadOnlyList<RendererCapability> Inspect() => Definitions.Select(Inspect).ToArray();

    public RendererCapability? Find(string id) => Definitions
        .Where(definition => definition.Id.Equals(id, StringComparison.OrdinalIgnoreCase))
        .Select(Inspect)
        .FirstOrDefault();

    private RendererCapability Inspect(Definition definition)
    {
        var missing = definition.Assets.Where(relative => !File.Exists(PathFor(relative))).ToArray();
        var available = missing.Length == 0;
        return new RendererCapability(
            definition.Id,
            Configured: true,
            Available: available,
            definition.Version,
            definition.Source,
            definition.License,
            definition.LicenseScope,
            available ? Digest(definition.Assets) : null,
            definition.Assets,
            missing);
    }

    private string Digest(IEnumerable<string> relativePaths)
    {
        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        foreach (var relative in relativePaths.Order(StringComparer.Ordinal))
        {
            hash.AppendData(Encoding.UTF8.GetBytes(relative));
            hash.AppendData([0]);
            hash.AppendData(File.ReadAllBytes(PathFor(relative)));
            hash.AppendData([0]);
        }
        return Convert.ToHexString(hash.GetHashAndReset()).ToLowerInvariant();
    }

    private string PathFor(string relative) => Path.Combine(assetRoot, relative.Replace('/', Path.DirectorySeparatorChar));
}
