using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using Rune.Browser;
using Rune.Core;
using Rune.Job.Contracts;
using Rune.Markdown;
using Rune.Rendering;

namespace Rune.Browser.Tests;

public sealed class PageDecorationBrowserTests
{
    [Fact]
    [Trait("Category", "Browser")]
    public async Task Chromium_prints_profiled_headers_and_page_counters()
    {
        if (!string.Equals(Environment.GetEnvironmentVariable("RUNE_RUN_BROWSER_TESTS"), "1", StringComparison.Ordinal)) return;
        if (!File.Exists("/usr/bin/pdftotext")) return;
        var paragraphs = string.Join("\n\n", Enumerable.Range(1, 180).Select(index => $"Paragraph {index}: page decoration validation content."));
        var compiled = await new MarkdownDocumentCompiler().CompileAsync(new SourceDocument(DocumentSourceType.Markdown, $"# Decorated report\n\n{paragraphs}"));
        var options = new RenderOptions(TimeoutSeconds: 45, MarginTop: "24mm", MarginBottom: "24mm", PageDecorations: new PageDecorationOptions(
            Default: new PageDecorationTemplate("Decorated report", "Page {page} of {pages}"),
            First: new PageDecorationTemplate("First page", "Page {page} of {pages}")));
        var root = FindRoot();
        var rendered = await new HtmlDocumentRenderer(Path.Combine(root, "services", "rune", "assets")).RenderAsync(compiled, options);
        var package = new RenderPackage(Guid.NewGuid(), rendered.Html, RenderOutputFormat.Pdf, options, Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rendered.Html))), DateTimeOffset.UtcNow);
        await using var browser = new PlaywrightRenderService();
        var result = await browser.RenderAsync(package);
        await using var content = result.Content;
        var pdfPath = Path.Combine(Path.GetTempPath(), $"rune-decoration-{Guid.NewGuid():N}.pdf");
        var textPath = pdfPath + ".txt";
        try
        {
            await File.WriteAllBytesAsync(pdfPath, content.ToArray());
            var startInfo = new ProcessStartInfo("/usr/bin/pdftotext") { RedirectStandardError = true };
            startInfo.ArgumentList.Add(pdfPath);
            startInfo.ArgumentList.Add(textPath);
            var process = Process.Start(startInfo);
            Assert.NotNull(process);
            await process!.WaitForExitAsync();
            Assert.Equal(0, process.ExitCode);
            var text = await File.ReadAllTextAsync(textPath);
            Assert.Contains("First page", text);
            Assert.Contains("Decorated report", text);
            Assert.Matches("Page 1 of [2-9]", text);
        }
        finally
        {
            File.Delete(pdfPath);
            File.Delete(textPath);
        }
    }

    [Fact]
    [Trait("Category", "Browser")]
    public async Task Bundled_mermaid_and_katex_materialize_without_network()
    {
        if (!string.Equals(Environment.GetEnvironmentVariable("RUNE_RUN_BROWSER_TESTS"), "1", StringComparison.Ordinal)) return;
        const string markdown = "# Assets\n\n```mermaid\nflowchart LR\nA-->B\n```\n\n$$E=mc^2$$";
        var root = FindRoot();
        var compiled = await new MarkdownDocumentCompiler().CompileAsync(new SourceDocument(DocumentSourceType.Markdown, markdown));
        var rendered = await new HtmlDocumentRenderer(Path.Combine(root, "services", "rune", "assets")).RenderAsync(compiled, new RenderOptions());
        Assert.DoesNotContain(rendered.Diagnostics, item => item.Code == "renderer-asset-missing");
        var package = new RenderPackage(Guid.NewGuid(), rendered.Html, RenderOutputFormat.StaticHtml, new RenderOptions(TimeoutSeconds: 45), Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rendered.Html))), DateTimeOffset.UtcNow);
        await using var browser = new PlaywrightRenderService();
        var result = await browser.RenderAsync(package);
        await using var content = result.Content;
        var html = Encoding.UTF8.GetString(content.ToArray());
        Assert.Contains("<svg", html, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("katex", html, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("<script", html, StringComparison.OrdinalIgnoreCase);
    }


    [Fact]
    [Trait("Category", "Browser")]
    public async Task Two_pass_composer_applies_physical_and_named_section_rules()
    {
        if (!string.Equals(Environment.GetEnvironmentVariable("RUNE_RUN_BROWSER_TESTS"), "1", StringComparison.Ordinal)) return;
        if (!File.Exists("/usr/bin/pdftotext")) return;
        const string html = """
            <!doctype html><html><head><meta charset="utf-8"><style>
            @page { size:A4; margin:20mm; }
            body{margin:0;font-family:Arial,sans-serif}.page{min-height:245mm;break-after:page}.page:last-child{break-after:auto}
            </style></head><body>
            <section class="page" data-rune-section="Introduction"><h1>Body One</h1></section>
            <section class="page" data-rune-section="Financials"><h1>Body Two</h1></section>
            <script>window.__RUNE_ASSERT_READY__=()=>true;window.__RUNE_RENDER_DONE__=true;window.__RUNE_READY__=Promise.resolve();</script>
            </body></html>
            """;
        var decorations = new PageDecorationOptions(
            Default: new PageDecorationTemplate("Default Header", "Default {page}/{pages}"),
            Rules: [
                new PageDecorationRule("physical-one", new PageDecorationSelector(PhysicalPages: [1]), new PageDecorationTemplate("Physical One", "One {page}/{pages}"), 20),
                new PageDecorationRule("financials", new PageDecorationSelector(NamedSections: ["Financials"]), new PageDecorationTemplate("Financial Section", "Financial {page}/{pages}"), 10)
            ],
            TwoPassPdfComposition: true);
        var options = new RenderOptions(TimeoutSeconds: 45, PageDecorations: decorations);
        var package = new RenderPackage(Guid.NewGuid(), html, RenderOutputFormat.Pdf, options,
            Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(html))), DateTimeOffset.UtcNow);
        await using var browser = new PlaywrightRenderService();
        var result = await browser.RenderAsync(package);
        var bytes = result.Content.ToArray();
        Assert.Equal(2, Rune.Export.Pdf.TwoPassPdfComposer.GetPageCount(bytes));
        var pdfPath = Path.Combine(Path.GetTempPath(), $"rune-two-pass-{Guid.NewGuid():N}.pdf");
        var textPath = pdfPath + ".txt";
        try
        {
            await File.WriteAllBytesAsync(pdfPath, bytes);
            var startInfo = new ProcessStartInfo("/usr/bin/pdftotext") { RedirectStandardError = true };
            startInfo.ArgumentList.Add(pdfPath);
            startInfo.ArgumentList.Add(textPath);
            using var process = Process.Start(startInfo);
            Assert.NotNull(process);
            await process!.WaitForExitAsync();
            Assert.Equal(0, process.ExitCode);
            var text = await File.ReadAllTextAsync(textPath);
            Assert.Contains("Physical One", text);
            Assert.Contains("Financial Section", text);
            Assert.Contains("One 1/2", text);
            Assert.Contains("Financial 2/2", text);
        }
        finally
        {
            File.Delete(pdfPath);
            File.Delete(textPath);
        }
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
