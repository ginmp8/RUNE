using System.Text.Json;
using Rune.Core;
using Rune.Markdown;
using Rune.Rendering;

namespace Rune.Engine.Tests;

public sealed class CompatibilityTests
{
    [Fact]
    public async Task Reference_feature_cases_are_executable_and_pass()
    {
        var root = FindRoot();
        var cases = JsonDocument.Parse(await File.ReadAllTextAsync(Path.Combine(root, "services/rune/tests/compatibility/reference-feature-cases.json"))).RootElement;
        var compiler = new MarkdownDocumentCompiler();
        var renderer = new HtmlDocumentRenderer(Path.Combine(root, "services/rune/assets"));
        var executed = 0;

        foreach (var feature in cases.EnumerateArray())
        {
            var id = feature.GetProperty("id").GetString() ?? "unknown";
            var kind = feature.GetProperty("kind").GetString();
            if (kind == "asset")
            {
                var source = string.Join('\n', feature.GetProperty("paths").EnumerateArray().Select(path =>
                    File.ReadAllText(Path.Combine(root, path.GetString()!))));
                AssertMarkers(id, source, feature);
                executed++;
                continue;
            }

            var resources = feature.TryGetProperty("resources", out var resourcesElement)
                ? resourcesElement.EnumerateObject().ToDictionary(item => item.Name, item => item.Value.GetString() ?? string.Empty, StringComparer.OrdinalIgnoreCase)
                : null;
            var documentName = feature.TryGetProperty("documentName", out var documentNameElement) ? documentNameElement.GetString()! : "document.md";
            var compiled = await compiler.CompileAsync(new SourceDocument(DocumentSourceType.Markdown,
                feature.GetProperty("markdown").GetString()!, resources, EntryPath: documentName));

            if (kind == "metadata")
            {
                foreach (var expected in feature.GetProperty("metadata").EnumerateObject())
                {
                    Assert.True(compiled.Metadata.TryGetValue(expected.Name, out var value), $"{id}: metadata {expected.Name} was not produced.");
                    Assert.Equal(expected.Value.GetString(), Convert.ToString(value, System.Globalization.CultureInfo.InvariantCulture), ignoreCase: true);
                }
            }
            else
            {
                var options = ReadOptions(feature);
                var html = (await renderer.RenderAsync(compiled, options)).Html;
                AssertMarkers(id, html, feature);
            }
            executed++;
        }

        Assert.Equal(cases.GetArrayLength(), executed);
        Assert.True(executed >= 38);
    }

    private static RenderOptions ReadOptions(JsonElement feature)
    {
        if (!feature.TryGetProperty("options", out var options)) return new RenderOptions();
        return new RenderOptions(
            IncludeToc: options.TryGetProperty("includeToc", out var toc) && toc.GetBoolean(),
            NumberHeadings: options.TryGetProperty("numberHeadings", out var numbering) && numbering.GetBoolean());
    }

    private static void AssertMarkers(string id, string text, JsonElement feature)
    {
        if (feature.TryGetProperty("contains", out var contains))
            foreach (var marker in contains.EnumerateArray())
                Assert.Contains(marker.GetString()!, text, StringComparison.OrdinalIgnoreCase);
        if (feature.TryGetProperty("containsAny", out var containsAny))
            Assert.True(containsAny.EnumerateArray().Any(marker => text.Contains(marker.GetString()!, StringComparison.OrdinalIgnoreCase)),
                $"{id}: none of the alternative markers were found.");
        if (feature.TryGetProperty("notContains", out var notContains))
            foreach (var marker in notContains.EnumerateArray())
                Assert.DoesNotContain(marker.GetString()!, text, StringComparison.OrdinalIgnoreCase);
    }

    private static string FindRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            if (File.Exists(Path.Combine(current.FullName, "VERSION")) && Directory.Exists(Path.Combine(current.FullName, "services", "rune")))
                return current.FullName;
            current = current.Parent;
        }
        throw new DirectoryNotFoundException("RUNE root was not found.");
    }
}
