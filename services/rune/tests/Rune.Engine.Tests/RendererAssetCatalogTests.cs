using Rune.Rendering;

namespace Rune.Engine.Tests;

public sealed class RendererAssetCatalogTests
{
    [Fact]
    public void Reports_bundled_assets_with_stable_digests_and_local_schematex()
    {
        var catalog = new RendererAssetCatalog(FindAssetRoot());
        var capabilities = catalog.Inspect().ToDictionary(item => item.Id);
        Assert.True(capabilities["mermaid"].Available);
        Assert.True(capabilities["katex"].Available);
        Assert.True(capabilities["schematex"].Available);
        Assert.True(capabilities["orgchart"].Available);
        Assert.Equal("1.0.1", capabilities["schematex"].Version);
        Assert.Equal("official-npm-package-renderResult", capabilities["schematex"].Source);
        Assert.Equal("AGPL-3.0-only", capabilities["schematex"].License);
        Assert.Equal("third-party-component", capabilities["schematex"].LicenseScope);
        Assert.Equal("MIT", capabilities["reactflow"].License);
        Assert.Equal("rune-project", capabilities["reactflow"].LicenseScope);
        Assert.Equal(64, capabilities["mermaid"].Sha256!.Length);
        Assert.Equal(64, capabilities["schematex"].Sha256!.Length);
        Assert.Empty(capabilities["schematex"].MissingAssets);
        Assert.Equal(capabilities["schematex"].Sha256, capabilities["orgchart"].Sha256);
        Assert.Equal(capabilities["mermaid"].Sha256, catalog.Find("MERMAID")!.Sha256);
    }

    [Fact]
    public async Task Html_renderer_accepts_prerendered_official_schematex_without_browser_module()
    {
        var renderer = new HtmlDocumentRenderer(FindAssetRoot());
        var document = new Rune.Core.CompiledDocument(
            "<figure class=\"schematex diagram-rendered\" data-kind=\"schematex\" data-render-state=\"ready\" data-schematex-version=\"1.0.1\"><svg xmlns=\"http://www.w3.org/2000/svg\"></svg></figure>",
            new Dictionary<string, object?>(),
            new HashSet<string>(),
            []);
        var result = await renderer.RenderAsync(document, new Rune.Core.RenderOptions());
        Assert.DoesNotContain(result.Diagnostics, item => item.Code == "renderer-asset-missing");
        Assert.DoesNotContain("__RUNE_SCHEMATEX_MODULE_BASE64__", result.Html);
        Assert.Contains("data-schematex-version=\"1.0.1\"", result.Html);
    }

    private static string FindAssetRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, "services", "rune", "assets");
            if (Directory.Exists(candidate)) return candidate;
            current = current.Parent;
        }
        throw new DirectoryNotFoundException("services/rune/assets");
    }
}
