using Rune.Application;
using Rune.Core;
using Rune.Markdown;
using Rune.Rendering;

namespace Rune.Engine.Tests;

public sealed class PageDecorationAuthoringTests
{
    [Fact]
    public void Constrained_markdown_and_html_are_normalized_without_executable_content()
    {
        var options = new RenderOptions(PageDecorations: new PageDecorationOptions(Default: new PageDecorationTemplate(
            HeaderRegion: new PageDecorationRegion("**Confidential** — [{title}](https://invalid.example)", PageDecorationContentFormat.Markdown),
            FooterRegion: new PageDecorationRegion("<strong>Page</strong> {page} / {pages}<br>Internal", PageDecorationContentFormat.Html))));
        var metadata = new Dictionary<string, object?> { ["title"] = "Contract" };
        var plan = PageDecorationCompiler.BuildPlan(options, metadata);
        Assert.True(plan.RequiresTwoPass);
        Assert.All(plan.Fragments, item => Assert.Equal(PageDecorationCapabilityClass.Direct, item.Capability));
        var values = PageDecorationCompiler.BuildTokenValues(options, metadata, 2, 5);
        var header = PageDecorationCompiler.RenderFragmentHtml(options.PageDecorations!.Default!.HeaderRegion!, values);
        var footer = PageDecorationCompiler.RenderFragmentHtml(options.PageDecorations.Default.FooterRegion!, values);
        Assert.Contains("Confidential", header);
        Assert.Contains("Contract", header);
        Assert.Contains("Page", footer);
        Assert.DoesNotContain("https://", header);
    }

    [Fact]
    public void Rejects_executable_or_ambiguous_decoration_sources()
    {
        Assert.Throws<ArgumentException>(() => PageDecorationCompiler.Compile(
            new RenderOptions(PageDecorations: new PageDecorationOptions(Default: new PageDecorationTemplate(
                HeaderRegion: new PageDecorationRegion("<script>alert(1)</script>", PageDecorationContentFormat.Html)))),
            new Dictionary<string, object?>()));
        Assert.Throws<ArgumentException>(() => PageDecorationCompiler.Compile(
            new RenderOptions(PageDecorations: new PageDecorationOptions(Default: new PageDecorationTemplate(
                Header: "legacy", HeaderRegion: new PageDecorationRegion("new")))), new Dictionary<string, object?>()));
    }

    [Fact]
    public async Task Markdown_fences_compile_into_canonical_page_decorations_and_leave_document_body_clean()
    {
        const string markdown = """
```rune-header markdown
**Contract** {title}
```
```rune-footer html
<strong>Page</strong> {page} of {pages}
```
# Agreement
Body
""";
        var compiled = await new MarkdownDocumentCompiler().CompileAsync(new SourceDocument(DocumentSourceType.Markdown, markdown));
        var options = RenderOptionsResolver.Apply(new RenderOptions(), compiled.Metadata);
        Assert.NotNull(options.PageDecorations?.Default?.HeaderRegion);
        var metadata = new Dictionary<string, object?> { ["title"] = "Agreement" };
        var plan = PageDecorationCompiler.BuildPlan(options, metadata);
        Assert.True(plan.RequiresTwoPass);
        var values = PageDecorationCompiler.BuildTokenValues(options, metadata, 1, 3);
        var header = PageDecorationCompiler.RenderFragmentHtml(options.PageDecorations!.Default!.HeaderRegion!, values);
        Assert.Contains("Contract", header);
        Assert.DoesNotContain("rune-header", compiled.BodyHtml);
        Assert.Contains(compiled.Diagnostics, item => item.Code == "page-decoration-authoring");
    }
}
