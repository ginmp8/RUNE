using System.Security.Cryptography;
using System.Text;
using Rune.Browser;
using Rune.Core;
using Rune.Job.Contracts;
using Rune.Markdown;
using Rune.Rendering;

namespace Rune.Browser.Tests;

public sealed class ComplexDocumentBrowserTests
{
    [Fact]
    [Trait("Category", "Browser")]
    public async Task Materializes_multiple_diagrams_with_unique_reactflow_markers()
    {
        if (!string.Equals(Environment.GetEnvironmentVariable("RUNE_RUN_BROWSER_TESTS"), "1", StringComparison.Ordinal))
            return;

        const string markdown = """
            # Complex document

            ```reactflow
            {"schemaVersion":"1.0","mode":"view","nodes":[{"id":"a","position":{"x":10,"y":20},"data":{"label":"A"}},{"id":"b","position":{"x":260,"y":20},"data":{"label":"B"}}],"edges":[{"id":"e1","source":"a","target":"b"}]}
            ```

            ```reactflow
            {"schemaVersion":"1.0","mode":"view","nodes":[{"id":"c","position":{"x":10,"y":20},"data":{"label":"C"}},{"id":"d","position":{"x":260,"y":20},"data":{"label":"D"}}],"edges":[{"id":"e2","source":"c","target":"d"}]}
            ```

            """;

        var root = FindRoot();
        var compiled = await new MarkdownDocumentCompiler().CompileAsync(
            new SourceDocument(DocumentSourceType.Markdown, markdown));
        var rendered = await new HtmlDocumentRenderer(Path.Combine(root, "services", "rune", "assets"))
            .RenderAsync(compiled, new RenderOptions());
        var html = rendered.Html;
        var id = Guid.NewGuid();
        var package = new RenderPackage(id, html, RenderOutputFormat.StaticHtml, new RenderOptions(TimeoutSeconds: 45),
            Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(html))), DateTimeOffset.UtcNow);

        await using var browser = new PlaywrightRenderService();
        var result = await browser.RenderAsync(package);
        await using var content = result.Content;
        var materialized = Encoding.UTF8.GetString(content.ToArray());

        Assert.Contains("rf-arrow-0", materialized, StringComparison.Ordinal);
        Assert.Contains("rf-arrow-1", materialized, StringComparison.Ordinal);
        Assert.Contains("rune-reactflow", materialized, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("<script", materialized, StringComparison.OrdinalIgnoreCase);
    }

    private static string FindRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            if (File.Exists(Path.Combine(current.FullName, "VERSION"))) return current.FullName;
            current = current.Parent;
        }
        throw new DirectoryNotFoundException("RUNE root was not found.");
    }
}
