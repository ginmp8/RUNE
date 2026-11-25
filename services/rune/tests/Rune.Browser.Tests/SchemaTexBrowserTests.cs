using System.Security.Cryptography;
using System.Text;
using Rune.Browser;
using Rune.Core;
using Rune.Job.Contracts;
using Rune.Markdown;
using Rune.Rendering;

namespace Rune.Browser.Tests;

public sealed class SchemaTexBrowserTests
{
    private const string Markdown = """
        # SchemaTex local validation

        ```schematex
        entity-structure "RUNE Holdings"
        jurisdiction BR "Brazil"
        jurisdiction US "United States"
        entity founder "Founder" individual@BR [role: "Controller"]
        entity trust "Founder Trust" trust@US
        entity holding "RUNE Holdings S.A." corp@BR
        entity platform "RUNE Platform Ltda." llc@BR
        entity renderer "RUNE Renderer Fund" fund@US
        founder -> trust : 100%
        trust -> holding : 100%
        holding -> platform : 80% [class: "ON"]
        holding -> renderer : 60% [class: "Series A"]
        ```
        """;

    [Fact]
    [Trait("Category", "Browser")]
    public async Task Bundled_schematex_materializes_without_network()
    {
        if (!string.Equals(Environment.GetEnvironmentVariable("RUNE_RUN_BROWSER_TESTS"), "1", StringComparison.Ordinal)) return;
        var root = FindRoot();
        var compiled = await new MarkdownDocumentCompiler().CompileAsync(new SourceDocument(DocumentSourceType.Markdown, Markdown));
        var rendered = await new HtmlDocumentRenderer(Path.Combine(root, "services", "rune", "assets")).RenderAsync(compiled, new RenderOptions());
        Assert.DoesNotContain(rendered.Diagnostics, item => item.Code == "renderer-asset-missing");
        Assert.Contains(rendered.Diagnostics, item => item.Code == "schematex.official-package");
        Assert.Contains("data-schematex-version=\"1.0.1\"", rendered.Html);
        Assert.Contains("data-render-state=\"ready\"", rendered.Html);
        Assert.Contains("<svg", rendered.Html, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("__RUNE_SCHEMATEX_MODULE_BASE64__", rendered.Html);

        var package = new RenderPackage(
            Guid.NewGuid(), rendered.Html, RenderOutputFormat.StaticHtml,
            new RenderOptions(TimeoutSeconds: 45),
            Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rendered.Html))),
            DateTimeOffset.UtcNow);
        await using var browser = new PlaywrightRenderService();
        var result = await browser.RenderAsync(package);
        await using var content = result.Content;
        var html = Encoding.UTF8.GetString(content.ToArray());
        Assert.Contains("data-schematex-type=\"entity\"", html, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("RUNE Holdings S.A.", html, StringComparison.Ordinal);
        Assert.Contains("80%", html, StringComparison.Ordinal);
        Assert.DoesNotContain("<div class=\"rune-render-error\"", html, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("<script", html, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData(RenderOutputFormat.Pdf, "%PDF")]
    [InlineData(RenderOutputFormat.Png, "PNG")]
    [InlineData(RenderOutputFormat.Jpeg, "JPEG")]
    [InlineData(RenderOutputFormat.Svg, "<svg")]
    [Trait("Category", "Browser")]
    public async Task Schematex_generates_binary_and_vector_outputs(RenderOutputFormat format, string marker)
    {
        if (!string.Equals(Environment.GetEnvironmentVariable("RUNE_RUN_BROWSER_TESTS"), "1", StringComparison.Ordinal)) return;
        var root = FindRoot();
        var compiled = await new MarkdownDocumentCompiler().CompileAsync(new SourceDocument(DocumentSourceType.Markdown, Markdown));
        var rendered = await new HtmlDocumentRenderer(Path.Combine(root, "services", "rune", "assets")).RenderAsync(compiled, new RenderOptions());
        var package = new RenderPackage(
            Guid.NewGuid(), rendered.Html, format,
            new RenderOptions(TimeoutSeconds: 45),
            Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rendered.Html))),
            DateTimeOffset.UtcNow);
        await using var browser = new PlaywrightRenderService();
        var result = await browser.RenderAsync(package);
        await using var content = result.Content;
        var bytes = content.ToArray();
        Assert.NotEmpty(bytes);
        switch (format)
        {
            case RenderOutputFormat.Pdf:
                Assert.StartsWith(marker, Encoding.ASCII.GetString(bytes, 0, Math.Min(8, bytes.Length)));
                break;
            case RenderOutputFormat.Png:
                Assert.Equal(new byte[] { 0x89, 0x50, 0x4E, 0x47 }, bytes[..4]);
                break;
            case RenderOutputFormat.Jpeg:
                Assert.Equal(new byte[] { 0xFF, 0xD8 }, bytes[..2]);
                break;
            case RenderOutputFormat.Svg:
                Assert.Contains(marker, Encoding.UTF8.GetString(bytes), StringComparison.OrdinalIgnoreCase);
                break;
        }
    }

    [Fact]
    [Trait("Category", "Browser")]
    public async Task Schematex_orgchart_and_entity_structure_emit_pdf_structure_map()
    {
        if (!string.Equals(Environment.GetEnvironmentVariable("RUNE_RUN_BROWSER_TESTS"), "1", StringComparison.Ordinal)) return;
        const string source = """
            # SchemaTex advanced evidence

            ```schematex
            entity-structure "RUNE Group"
            entity founder "Founder" individual@BR
            entity holding "RUNE Holdings" corp@BR
            entity api "RUNE API" llc@BR
            founder -> holding : 100%
            holding -> api : 100%
            ```

            ```orgchart
            orgchart "RUNE Delivery"
            ceo: "Avery" | "CEO"
            architecture: "Morgan" | "Architecture" -> ceo
            platform: "Taylor" | "Platform" -> ceo
            rendering: "Jordan" | "Rendering" -> platform
            quality: "Casey" | "Quality" -> platform
            ```
            """;
        var root = FindRoot();
        var compiled = await new MarkdownDocumentCompiler().CompileAsync(new SourceDocument(DocumentSourceType.Markdown, source));
        var options = new RenderOptions(TimeoutSeconds: 45, Tagged: true, EmitStructureMap: true);
        var rendered = await new HtmlDocumentRenderer(Path.Combine(root, "services", "rune", "assets")).RenderAsync(compiled, options);
        var package = new RenderPackage(
            Guid.NewGuid(), rendered.Html, RenderOutputFormat.Pdf, options,
            Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rendered.Html))),
            DateTimeOffset.UtcNow);
        await using var browser = new PlaywrightRenderService();
        var result = await browser.RenderAsync(package);
        await using var content = result.Content;
        Assert.StartsWith("%PDF", Encoding.ASCII.GetString(content.ToArray(), 0, 4));
        var structure = Assert.Single(result.SideArtifacts!);
        Assert.Equal("structure-map.json", structure.FileName);
        using var map = System.Text.Json.JsonDocument.Parse(structure.Content);
        Assert.Contains(map.RootElement.GetProperty("nodes").EnumerateArray(), node => node.GetProperty("text").GetString() == "SchemaTex advanced evidence");
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
