using Rune.Core;
using Rune.Rendering;

namespace Rune.Engine.Tests;

public sealed class PageDecorationTests
{
    [Fact]
    public void Compiles_default_first_left_and_right_profiles_with_tokens()
    {
        var options = new RenderOptions(PageDecorations: new PageDecorationOptions(
            Default: new PageDecorationTemplate("{title}", "Page {page} of {pages}"),
            First: new PageDecorationTemplate("Cover", null, PageDecorationAlignment.Left),
            Left: new PageDecorationTemplate(null, "Left {page}", FooterAlignment: PageDecorationAlignment.Left),
            Right: new PageDecorationTemplate(null, "Right {page}", FooterAlignment: PageDecorationAlignment.Right)));
        var css = PageDecorationCompiler.Compile(options, new Dictionary<string, object?> { ["title"] = "Quarterly Report" });
        Assert.Contains("@page {", css);
        Assert.Contains("@page :first", css);
        Assert.Contains("@page :left", css);
        Assert.Contains("@page :right", css);
        Assert.Contains("\"Quarterly Report\"", css);
        Assert.Contains("counter(page)", css);
        Assert.Contains("counter(pages)", css);
        Assert.Contains("@bottom-right", css);
    }

    [Fact]
    public void Rejects_legacy_template_conflicts_and_unknown_tokens()
    {
        Assert.Throws<ArgumentException>(() => PageDecorationCompiler.Compile(
            new RenderOptions(HeaderTemplate: "legacy", PageDecorations: new PageDecorationOptions(Default: new PageDecorationTemplate("new"))),
            new Dictionary<string, object?>()));
        Assert.Throws<ArgumentException>(() => PageDecorationCompiler.Compile(
            new RenderOptions(PageDecorations: new PageDecorationOptions(Default: new PageDecorationTemplate("{unknown}"))),
            new Dictionary<string, object?>()));
    }

    [Fact]
    public async Task Html_renderer_embeds_page_decoration_css()
    {
        var renderer = new HtmlDocumentRenderer(FindAssetRoot());
        var document = new CompiledDocument("<h1>Body</h1>", new Dictionary<string, object?> { ["title"] = "Decorated" }, new HashSet<string>(), []);
        var result = await renderer.RenderAsync(document, new RenderOptions(PageDecorations: new PageDecorationOptions(Default: new PageDecorationTemplate("{title}", "{page}/{pages}"))));
        Assert.Contains("@top-center", result.Html);
        Assert.Contains("counter(page)", result.Html);
        Assert.Contains("Decorated", result.Html);
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
