using PdfSharp.Pdf;
using System.Text.RegularExpressions;
using System.Text;
using Rune.Api.Contracts;
using Rune.Application;
using Rune.Core;
using Rune.Event.Contracts;
using Rune.Html;
using Rune.Jobs;
using Rune.Markdown;
using Rune.Messaging.Abstractions;
using Rune.Rendering;

namespace Rune.Engine.Tests;

public sealed class CompositeDocumentTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "rune-composite-tests", Guid.NewGuid().ToString("N"));

    [Fact]
    public async Task Assembles_markdown_html_and_template_parts_as_named_sections()
    {
        var store = new FileSystemRenderJobStore(_root);
        var application = new DocumentRenderApplication(
            [new MarkdownDocumentCompiler(), new HtmlDocumentCompiler()],
            new HtmlDocumentRenderer(FindAssetRoot()),
            new RenderJobService(store),
            new RenderCommandOutbox(store, new NoOpPublisher()));
        var resources = new[]
        {
            TextResource("data.json", "{\"customer\":\"Acme\",\"amount\":1234.5}"),
            TextResource("partials/summary.html", "<strong>{{customer}}</strong>")
        };
        var composite = new CompositeDocumentOptions([
            new CompositeDocumentPart("Introduction", DocumentSourceType.Markdown, "# Intro\n\nMarkdown body."),
            new CompositeDocumentPart("Trusted HTML", DocumentSourceType.Html, "<h2>HTML body</h2>", HtmlTrustMode: HtmlTrustMode.Trusted),
            new CompositeDocumentPart("Regional Summary", DocumentSourceType.Template,
                "{{> summary}} <span>{{currency amount \"BRL\"}}</span>",
                Template: new RuneTemplateOptions(ContentType: TemplateContentType.Html, AllowedHelpers: ["currency"], Culture: "pt-BR"))
        ], IncludePartTitles: true);
        var response = Assert.IsType<HtmlRenderResponse>(await application.RenderAsync(
            new RenderRequest(DocumentSourceType.Composite, Resources: resources, Composite: composite)));
        Assert.Contains("data-rune-section=\"Introduction\"", response.Html);
        Assert.Contains("data-rune-section=\"Trusted HTML\"", response.Html);
        Assert.Contains("data-rune-section=\"Regional Summary\"", response.Html);
        Assert.Contains("Acme", response.Html);
        Assert.Contains("BRL 1.234,50", response.Html);
        Assert.Contains("break-before:page", response.Html);
    }

    [Fact]
    public async Task Supports_nested_composites_and_rejects_invalid_part_names()
    {
        var application = new DocumentRenderApplication(
            [new MarkdownDocumentCompiler(), new HtmlDocumentCompiler()],
            new HtmlDocumentRenderer(FindAssetRoot()),
            CreateJobService(_root),
            CreateOutbox(_root));
        var nested = Assert.IsType<HtmlRenderResponse>(await application.RenderAsync(
            new RenderRequest(DocumentSourceType.Composite, Composite: new CompositeDocumentOptions([
                new CompositeDocumentPart("Parent", DocumentSourceType.Composite, Composite: new CompositeDocumentOptions([
                    new CompositeDocumentPart("Child", DocumentSourceType.Markdown, "# Child heading\n\n[Jump](#detail)\n\n## Detail")
                ], IncludePartTitles: true))
            ], IncludePartTitles: true, RewriteTableOfContents: true))));
        Assert.Contains("data-rune-section=\"Parent/Child\"", nested.Html);
        Assert.Contains("rune-composite-toc", nested.Html);
        Assert.Contains("href=\"#part-002-parent-child-", nested.Html);
        await Assert.ThrowsAsync<ArgumentException>(async () => await application.RenderAsync(
            new RenderRequest(DocumentSourceType.Composite, Composite: new CompositeDocumentOptions([
                new CompositeDocumentPart("<bad>", DocumentSourceType.Markdown, "x")
            ]))));
    }


    [Fact]
    public async Task Avoids_duplicate_first_level_heading_when_part_title_matches_content_heading()
    {
        var application = new DocumentRenderApplication(
            [new MarkdownDocumentCompiler(), new HtmlDocumentCompiler()],
            new HtmlDocumentRenderer(FindAssetRoot()),
            CreateJobService(_root),
            CreateOutbox(_root));
        var response = Assert.IsType<HtmlRenderResponse>(await application.RenderAsync(
            new RenderRequest(DocumentSourceType.Composite, Composite: new CompositeDocumentOptions([
                new CompositeDocumentPart("Introduction", DocumentSourceType.Markdown, """
# Introduction

[Go to details](#details)

## Details

Body.
""")
            ], IncludePartTitles: true, RewriteTableOfContents: true))));

        Assert.Single(Regex.Matches(response.Html, "<h1[^>]*>Introduction</h1>", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant).Cast<Match>());
        Assert.Single(Regex.Matches(response.Html, ">Introduction</a>", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant).Cast<Match>());
        Assert.Contains("#part-001-introduction-details", response.Html);
    }

    [Fact]
    public async Task Applies_independent_page_sizes_and_margins_per_part()
    {
        var application = new DocumentRenderApplication(
            [new MarkdownDocumentCompiler(), new HtmlDocumentCompiler()],
            new HtmlDocumentRenderer(FindAssetRoot()),
            CreateJobService(_root),
            CreateOutbox(_root));
        var response = Assert.IsType<HtmlRenderResponse>(await application.RenderAsync(
            new RenderRequest(DocumentSourceType.Composite, Composite: new CompositeDocumentOptions([
                new CompositeDocumentPart("Portrait", DocumentSourceType.Markdown, "# A", PageSize: "A4", MarginTop: "10mm"),
                new CompositeDocumentPart("Wide", DocumentSourceType.Markdown, "# B", PageSize: "11in 17in", Landscape: true, MarginLeft: "5mm")
            ]))));
        Assert.Contains("@page rune-part-001-portrait{size:A4 portrait;margin:10mm", response.Html);
        Assert.Contains("@page rune-part-002-wide{size:11in 17in landscape", response.Html);
        Assert.Contains("page:rune-part-002-wide", response.Html);
    }


    [Fact]
    public async Task Imports_pdf_parts_through_the_bounded_visual_pipeline()
    {
        byte[] pdf;
        using (var document = new PdfDocument())
        {
            document.AddPage();
            using var stream = new MemoryStream();
            document.Save(stream, false);
            pdf = stream.ToArray();
        }
        var application = new DocumentRenderApplication(
            [new MarkdownDocumentCompiler(), new HtmlDocumentCompiler()],
            new HtmlDocumentRenderer(FindAssetRoot()),
            CreateJobService(_root),
            CreateOutbox(_root));
        var response = Assert.IsType<HtmlRenderResponse>(await application.RenderAsync(new RenderRequest(
            DocumentSourceType.Composite,
            Resources: [new ResourceInput("parts/input.pdf", Convert.ToBase64String(pdf), "application/pdf")],
            Composite: new CompositeDocumentOptions([
                new CompositeDocumentPart("Imported PDF", DocumentSourceType.Pdf, ResourcePath: "parts/input.pdf",
                    PdfImport: new PdfImportOptions(Mode: PdfImportMode.Visual, ExtractImages: false),
                    Tags: CompositePreservationPolicy.Flatten)
            ]))));
        Assert.Contains("rune-pdf-visual-page", response.Html);
        var bmpMatch = Regex.Match(response.Html, "src=\"data:image/bmp;base64,(?<data>[A-Za-z0-9+/=]+)\"", RegexOptions.CultureInvariant);
        Assert.True(bmpMatch.Success);
        var bmp = Convert.FromBase64String(bmpMatch.Groups["data"].Value);
        Assert.True(bmp.Length > 58);
        Assert.Equal((byte)'B', bmp[0]);
        Assert.Equal((byte)'M', bmp[1]);
        Assert.Equal(255, bmp[54]);
        Assert.Equal(255, bmp[55]);
        Assert.Equal(255, bmp[56]);
        Assert.Equal(255, bmp[57]);
        Assert.Contains(response.Diagnostics, diagnostic => diagnostic.Code == "composite-pdf-rasterized");
    }

    private static RenderJobService CreateJobService(string root) => new(new FileSystemRenderJobStore(root));

    private static RenderCommandOutbox CreateOutbox(string root) =>
        new(new FileSystemRenderJobStore(root), new NoOpPublisher());

    private static ResourceInput TextResource(string path, string value) =>
        new(path, Convert.ToBase64String(Encoding.UTF8.GetBytes(value)), path.EndsWith(".json", StringComparison.Ordinal) ? "application/json" : "text/html");

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

    private sealed class NoOpPublisher : IRenderCommandPublisher
    {
        public ValueTask PublishAsync(RenderRequested command, CancellationToken cancellationToken = default) => ValueTask.CompletedTask;
    }

    public void Dispose()
    {
        if (Directory.Exists(_root)) Directory.Delete(_root, true);
    }
}
