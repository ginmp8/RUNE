using Rune.Core;
using Rune.Html;
using Rune.Markdown;

namespace Rune.Engine.Tests;

public sealed class ReferenceMinorCompatibilityTests
{
    [Fact]
    public async Task Universal_minor_features_from_reference_1_8_7_are_rendered()
    {
        const string markdown = """
            ---
            github-references: true
            github-repository: openai/example
            ---

            1) First
            A) Second
            IV) Fourth
            #. Automatic

            [=78% "Coverage"]

            {++added++} {--removed--} {~~old~>new~~} {==highlighted==} {>>comment<<}

            GH-123 #124 @octocat

            (tm) (c) (r) +/- --> <-- =/=

            Inline \(e^{i\pi}+1=0\).

            \[
            x^2+y^2
            \]
            """;

        var compiled = await new MarkdownDocumentCompiler().CompileAsync(
            new SourceDocument(DocumentSourceType.Markdown, markdown));

        Assert.Contains("<ol", compiled.BodyHtml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("<progress", compiled.BodyHtml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("critic addition", compiled.BodyHtml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("critic deletion", compiled.BodyHtml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("critic substitution", compiled.BodyHtml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("critic highlight", compiled.BodyHtml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("critic comment", compiled.BodyHtml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("issues/123", compiled.BodyHtml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("issues/124", compiled.BodyHtml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("github.com/octocat", compiled.BodyHtml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("™", compiled.BodyHtml);
        Assert.Contains("©", compiled.BodyHtml);
        Assert.Contains("arithmatex", compiled.BodyHtml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("data-display=\"true\"", compiled.BodyHtml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("data-display=\"false\"", compiled.BodyHtml, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Safe_html_preserves_semantic_media_and_filters_unsafe_css()
    {
        const string html = """
            <section lang="pt-BR"><picture><source srcset="a.webp"><img src="a.png" alt="A"></picture>
            <progress value="75" max="100">75%</progress><ruby>漢<rp>(</rp><rt>kan</rt><rp>)</rp></ruby>
            <span style="color:red;position:fixed" onclick="alert(1)">X</span></section>
            """;

        var compiled = await new HtmlDocumentCompiler().CompileAsync(
            new SourceDocument(DocumentSourceType.Html, html, HtmlTrustMode: HtmlTrustMode.Safe));

        Assert.Contains("<section", compiled.BodyHtml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("<picture", compiled.BodyHtml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("srcset=", compiled.BodyHtml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("<progress", compiled.BodyHtml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("<ruby", compiled.BodyHtml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("color", compiled.BodyHtml, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("position", compiled.BodyHtml, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("onclick", compiled.BodyHtml, StringComparison.OrdinalIgnoreCase);
    }
}
