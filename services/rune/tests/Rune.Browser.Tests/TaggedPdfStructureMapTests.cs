using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Rune.Browser;
using Rune.Core;
using Rune.Job.Contracts;
using Rune.Rendering;

namespace Rune.Browser.Tests;

public sealed class TaggedPdfStructureMapTests
{
    [Fact]
    [Trait("Category", "Browser")]
    public async Task Emits_dom_to_physical_page_structure_map_for_tagged_pdf()
    {
        if (!string.Equals(Environment.GetEnvironmentVariable("RUNE_RUN_BROWSER_TESTS"), "1", StringComparison.Ordinal)) return;
        var compiled = new CompiledDocument(
            """
            <section data-rune-section="First" style="page:rune-a5">
              <h1 id="first-section">First section</h1>
              <h2 id="first-heading">First heading</h2>
              <p>Content.</p>
            </section>
            <section class="page-break" data-rune-section="Second" style="page:rune-letter">
              <h1 id="second-section">Second section</h1>
              <p>More content.</p>
            </section>
            <section class="page-break" data-rune-section="Third" style="page:rune-a4">
              <h1 id="third-section">Third section</h1>
              <p>Final content.</p>
            </section>
            """,
            new Dictionary<string, object?> { ["title"] = "Tagged structure map" },
            new HashSet<string>(),
            [],
            HeadHtml: "<style>@page rune-a5{size:A5 portrait}@page rune-letter{size:Letter landscape}@page rune-a4{size:A4 portrait}</style>");
        var root = FindRoot();
        var options = new RenderOptions(TimeoutSeconds: 45, Tagged: true, Outline: true, EmitStructureMap: true, AdditionalCss: ".page-break{break-before:page;page-break-before:always;height:1px}");
        var rendered = await new HtmlDocumentRenderer(Path.Combine(root, "services", "rune", "assets")).RenderAsync(compiled, options);
        var package = new RenderPackage(Guid.NewGuid(), rendered.Html, RenderOutputFormat.Pdf, options,
            Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rendered.Html))), DateTimeOffset.UtcNow);
        await using var browser = new PlaywrightRenderService();
        var result = await browser.RenderAsync(package);
        var map = Assert.Single(result.SideArtifacts!);
        Assert.Equal("structure-map.json", map.FileName);
        using var document = JsonDocument.Parse(map.Content);
        Assert.True(document.RootElement.GetProperty("taggedPdfRequested").GetBoolean());
        Assert.Equal("1.1", document.RootElement.GetProperty("contractVersion").GetString());
        Assert.True(document.RootElement.GetProperty("pageCount").GetInt32() >= 3);
        Assert.Equal(0, document.RootElement.GetProperty("fallbackNodeCount").GetInt32());
        var nodes = document.RootElement.GetProperty("nodes").EnumerateArray().ToArray();
        Assert.Equal(1, nodes.Single(node => node.GetProperty("section").GetString() == "First").GetProperty("physicalPage").GetInt32());
        Assert.Equal(2, nodes.Single(node => node.GetProperty("section").GetString() == "Second").GetProperty("physicalPage").GetInt32());
        Assert.Equal(3, nodes.Single(node => node.GetProperty("section").GetString() == "Third").GetProperty("physicalPage").GetInt32());
        Assert.All(nodes, node => Assert.Equal("printed-pdf-marker", node.GetProperty("mappingSource").GetString()));
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
