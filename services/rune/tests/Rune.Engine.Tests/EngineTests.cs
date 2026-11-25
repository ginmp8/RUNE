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

public sealed class EngineTests
{
    [Fact]
    public async Task Markdown_compiles_mermaid_reactflow_and_static_diagrams()
    {
        var compiler = new MarkdownDocumentCompiler();
        var source = "# Test\n\n```mermaid\nflowchart LR\nA-->B\n```\n\n```reactflow\n{\"nodes\":[],\"edges\":[]}\n```\n\n```chart\n{\"type\":\"bar\",\"labels\":[\"A\"],\"values\":[1]}\n```";
        var result = await compiler.CompileAsync(new SourceDocument(DocumentSourceType.Markdown, source));
        Assert.Contains("mermaid", result.RequiredRenderers);
        Assert.Contains("reactflow", result.RequiredRenderers);
        Assert.Contains("chart", result.RequiredRenderers);
        Assert.Contains("data-kind=\"reactflow\"", result.BodyHtml);
        Assert.Contains("diagram-chart", result.BodyHtml);
    }


    [Fact]
    public async Task Markdown_prerenders_official_schematex_and_orgchart()
    {
        var compiler = new MarkdownDocumentCompiler();
        var source = """
```schematex
orgchart "Team"
ceo: "Ana" | "CEO"
```

```orgchart
ceo: "Ana" | "CEO"
```
""";
        var result = await compiler.CompileAsync(new SourceDocument(DocumentSourceType.Markdown, source));
        Assert.DoesNotContain("schematex", result.RequiredRenderers);
        Assert.DoesNotContain("orgchart", result.RequiredRenderers);
        Assert.Contains("data-kind=\"schematex\"", result.BodyHtml);
        Assert.Contains("data-kind=\"orgchart\"", result.BodyHtml);
        Assert.Contains("data-schematex-version=\"1.0.1\"", result.BodyHtml);
        Assert.Contains("<svg", result.BodyHtml);
    }

    [Fact]
    public async Task Markdown_normalizes_reference_compatibility_features()
    {
        var compiler = new MarkdownDocumentCompiler();
        var source = """
---
title: Document
toc: true
github-references: true
github-repository: owner/repo
---
# One

> [!WARNING] Attention
> Content

=== "A"

    Tab content

[[Internal document|Label]] See #123 and @octocat. ++ctrl+c++

Inline note.^[Footnote]

<!-- pdf-only -->PDF<!-- /pdf-only -->

\pagebreak

```csv-table
Name,Value
API,100
```
""";
        var result = await compiler.CompileAsync(new SourceDocument(DocumentSourceType.Markdown, source));
        Assert.Equal("Document", result.Metadata["title"]);
        Assert.Contains("admonition warning", result.BodyHtml);
        Assert.Contains("tabbed-set", result.BodyHtml);
        Assert.Contains("Label", result.BodyHtml);
        Assert.Contains("https://github.com/owner/repo/issues/123", result.BodyHtml);
        Assert.Contains("https://github.com/octocat", result.BodyHtml);
        Assert.Contains("<kbd>ctrl+c</kbd>", result.BodyHtml);
        Assert.Contains("footnote", result.BodyHtml, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("rune-pdf-only", result.BodyHtml);
        Assert.Contains("page-break", result.BodyHtml);
        Assert.Contains("data-table-csv", result.BodyHtml);
    }

    [Fact]
    public async Task Markdown_expands_supplied_include_and_sanitizes_raw_script()
    {
        var compiler = new MarkdownDocumentCompiler();
        var result = await compiler.CompileAsync(new SourceDocument(
            DocumentSourceType.Markdown,
            "--8<-- \"snippet.md\"\n\n<script>alert(1)</script>",
            new Dictionary<string, string> { ["snippet.md"] = "## Included" }));
        Assert.Contains("Included", result.BodyHtml);
        Assert.DoesNotContain("<script", result.BodyHtml, StringComparison.OrdinalIgnoreCase);
    }


    [Fact]
    public async Task Trusted_html_preserves_head_styles_scripts_and_title()
    {
        var compiler = new HtmlDocumentCompiler();
        var source = "<!doctype html><html><head><title>Report</title><style>.x{color:red}</style><script>window.__RUNE_READY__=Promise.resolve()</script></head><body><h1 class=\"x\">x</h1></body></html>";
        var result = await compiler.CompileAsync(new SourceDocument(DocumentSourceType.Html, source, HtmlTrustMode: HtmlTrustMode.Trusted));
        Assert.Equal("Report", result.Metadata["title"]);
        Assert.Contains("<style>.x{color:red}</style>", result.HeadHtml);
        Assert.Contains("window.__RUNE_READY__", result.HeadHtml);
        Assert.Contains("<h1", result.BodyHtml);
    }

    [Fact]
    public async Task Safe_html_does_not_preserve_head_scripts()
    {
        var compiler = new HtmlDocumentCompiler();
        var source = "<html><head><script>alert(1)</script></head><body><h1>x</h1></body></html>";
        var result = await compiler.CompileAsync(new SourceDocument(DocumentSourceType.Html, source));
        Assert.Empty(result.HeadHtml);
        Assert.DoesNotContain("script", result.BodyHtml, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Safe_html_removes_scripts()
    {
        var compiler = new HtmlDocumentCompiler();
        var result = await compiler.CompileAsync(new SourceDocument(DocumentSourceType.Html, "<h1>x</h1><script>alert(1)</script>"));
        Assert.DoesNotContain("script", result.BodyHtml, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Renderer_builds_cover_toc_and_unique_reactflow_markers()
    {
        var renderer = new HtmlDocumentRenderer(FindAssetRoot());
        var document = new CompiledDocument(
            "<h1>One</h1><h2>Two</h2><figure class=\"reactflow-document rune-async\" data-reactflow-payload=\"e30\" data-render-state=\"pending\"></figure>",
            new Dictionary<string, object?> { ["title"] = "Document", ["author"] = "Author" },
            new HashSet<string> { "reactflow" },
            []);
        var html = await renderer.RenderAsync(document, new RenderOptions(IncludeCover: true, IncludeToc: true, NumberHeadings: true));
        Assert.Contains("document-cover", html.Html);
        Assert.Contains("class=\"toc\"", html.Html);
        Assert.Contains("section-number", html.Html);
        Assert.Contains("window.MarkdownPdfReactFlow", html.Html);
        Assert.Contains("rf-arrow-${diagramIndex}", html.Html);
        Assert.DoesNotContain("ReactFlowProvider", html.Html);
        Assert.Contains("__RUNE_RENDER_DONE__", html.Html);
        Assert.Contains("__RUNE_READY__", html.Html);
    }

    [Fact]
    public async Task Application_embeds_binary_resources_in_interactive_html()
    {
        var root = Path.Combine(Path.GetTempPath(), "rune-application-tests", Guid.NewGuid().ToString("N"));
        try
        {
            var store = new FileSystemRenderJobStore(root);
            var application = new DocumentRenderApplication(
                [new MarkdownDocumentCompiler(), new HtmlDocumentCompiler()],
                new HtmlDocumentRenderer(FindAssetRoot()),
                new RenderJobService(store),
                new RenderCommandOutbox(store, new NoOpPublisher()));
            var resource = new ResourceInput("image.png", Convert.ToBase64String(new byte[] { 0x89, 0x50, 0x4E, 0x47 }), "image/png");
            var response = Assert.IsType<HtmlRenderResponse>(await application.RenderAsync(
                new RenderRequest(DocumentSourceType.Markdown, "![image](image.png)", Resources: [resource])));
            Assert.Contains("data:image/png;base64,", response.Html);
        }
        finally
        {
            if (Directory.Exists(root)) Directory.Delete(root, true);
        }
    }


    [Fact]
    public void Ownership_parser_calculates_indirect_ownership_and_detects_cycles()
    {
        var parser = new Rune.Ownership.OwnershipDslParser();
        var valid = parser.Parse("""
chart "Acme" [validation=partial, showIndirect=true]
entity founder "Founder" person@BR
entity holding "Holding" company@BR
entity operating "Operating" company@BR
founder -> holding : 80%
holding -> operating : 60%
""");
        Assert.True(valid.Ok);
        var document = Assert.IsType<Rune.Ownership.OwnershipDocument>(valid.Document);
        Assert.Contains(document.Analysis.IndirectOwnership,
            item => item.Source == "founder" && item.Target == "operating" && item.Economic == 48m);

        var cyclic = parser.Parse("""
entity a "A" company@BR
entity b "B" company@BR
a -> b : 60%
b -> a : 20%
""");
        Assert.True(cyclic.Ok);
        Assert.NotEmpty(cyclic.Document!.Analysis.Cycles);
        Assert.Equal("cycle-detected", cyclic.Document.Analysis.IndirectStatus);
    }

    [Fact]
    public async Task Structured_document_contains_semantic_nodes()
    {
        var compiler = new MarkdownDocumentCompiler();
        var result = await compiler.CompileAsync(new SourceDocument(DocumentSourceType.Markdown,
            "# Title\n\nParagraph.\n\n```mermaid\nflowchart LR\nA-->B\n```"));
        var model = Assert.IsType<RuneDocumentModel>(result.DocumentModel);
        Assert.Contains(model.Nodes, node => node.Type == "heading" && node.Text == "Title");
        Assert.Contains(model.Nodes, node => node.Type == "paragraph");
        Assert.Contains(model.Nodes, node => node.Type == "diagram" && Equals(node.Attributes["renderer"], "mermaid"));
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

    private sealed class NoOpPublisher : IRenderCommandPublisher
    {
        public ValueTask PublishAsync(RenderRequested command, CancellationToken cancellationToken = default) => ValueTask.CompletedTask;
    }
}
