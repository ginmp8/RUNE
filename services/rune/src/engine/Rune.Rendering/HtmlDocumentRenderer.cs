using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using Rune.Core;

namespace Rune.Rendering;

public sealed partial class HtmlDocumentRenderer(string assetRoot) : IHtmlDocumentRenderer
{
    public ValueTask<RenderedHtml> RenderAsync(
        CompiledDocument document,
        RenderOptions options,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var theme = ReadRequired($"styles/{NormalizeTheme(options.Theme)}.css");
        var baseCss = ReadRequired("styles/base.css");
        var componentCss = ReadRequired("styles/components.css");
        var runtime = ReadRequired("runtime/readiness.js");
        var staticDiagrams = ReadRequired("reference/static-diagrams.js");
        var ownershipRenderer = ReadRequired("reference/ownership-renderer.js");
        var ownershipCss = ReadRequired("reference/ownership.css");
        var renderers = ReadRequired("runtime/renderers.js");
        var vendorAssets = new StringBuilder();
        var diagnostics = document.Diagnostics.ToList();
        var catalog = new RendererAssetCatalog(assetRoot);
        foreach (var rendererId in document.RequiredRenderers)
        {
            var capability = catalog.Find(rendererId);
            if (capability is { Available: false })
                diagnostics.Add(new RenderDiagnostic("renderer-asset-missing", $"Renderer {rendererId} is configured but unavailable. Missing: {string.Join(", ", capability.MissingAssets)}.", RenderDiagnosticSeverity.Error));
        }

        if (document.RequiredRenderers.Contains("mermaid"))
            AppendOptionalScript(vendorAssets, "vendor/mermaid/mermaid.min.js");
        if (document.RequiredRenderers.Contains("katex"))
        {
            AppendOptionalCss(vendorAssets, "vendor/katex/katex.min.css");
            AppendOptionalScript(vendorAssets, "vendor/katex/katex.min.js");
        }
        if (document.RequiredRenderers.Contains("reactflow"))
            AppendReactFlowRuntime(vendorAssets);

        var title = MetadataString(document.Metadata, "title") ?? options.CoverTitle ?? "RUNE Document";
        var language = MetadataString(document.Metadata, "language") ?? MetadataString(document.Metadata, "lang") ?? options.Language;
        var direction = MetadataString(document.Metadata, "direction") ?? MetadataString(document.Metadata, "dir") ?? options.Direction;
        var includeToc = options.IncludeToc || MetadataBoolean(document.Metadata, "toc");
        var includeCover = options.IncludeCover || MetadataBoolean(document.Metadata, "include-cover");
        var body = PrepareHeadings(document.BodyHtml, includeToc, options.NumberHeadings);
        var cover = includeCover ? BuildCover(document.Metadata, options, title) : string.Empty;
        var watermark = string.IsNullOrWhiteSpace(options.Watermark)
            ? string.Empty
            : $"<div class=\"document-watermark\" aria-hidden=\"true\">{WebUtility.HtmlEncode(options.Watermark)}</div>";
        var additionalCss = options.AdditionalCss ?? string.Empty;
        var pageDecorationCss = PageDecorationCompiler.Compile(options, document.Metadata);
        var description = MetadataString(document.Metadata, "description") ?? options.CoverDescription;
        var author = MetadataString(document.Metadata, "author") ?? options.CoverAuthor;
        var metadataTags = new StringBuilder();
        if (!string.IsNullOrWhiteSpace(description)) metadataTags.Append("<meta name=\"description\" content=\"").Append(WebUtility.HtmlEncode(description)).AppendLine("\">");
        if (!string.IsNullOrWhiteSpace(author)) metadataTags.Append("<meta name=\"author\" content=\"").Append(WebUtility.HtmlEncode(author)).AppendLine("\">");
        metadataTags.Append("<meta name=\"generator\" content=\"RUNE ").Append(WebUtility.HtmlEncode(RuneVersion.Current)).Append("\">");

        var html = $$"""
<!doctype html>
<html lang="{{WebUtility.HtmlEncode(language)}}" dir="{{WebUtility.HtmlEncode(direction)}}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
{{metadataTags}}
<title>{{WebUtility.HtmlEncode(title)}}</title>
<style>{{baseCss}}
{{theme}}
{{componentCss}}
{{ownershipCss}}
{{pageDecorationCss}}
{{additionalCss}}</style>
{{document.HeadHtml}}
{{vendorAssets}}
</head>
<body data-rune-document="true" data-rune-version="{{WebUtility.HtmlEncode(RuneVersion.Current)}}">
{{watermark}}
<main class="rune-document">{{cover}}{{body}}</main>
<script>{{staticDiagrams}}</script>
<script>{{ownershipRenderer}}</script>
<script>{{renderers}}</script>
<script>{{runtime}}</script>
</body>
</html>
""";
        return ValueTask.FromResult(new RenderedHtml(html, document.RequiredRenderers, diagnostics));
    }

    private void AppendReactFlowRuntime(StringBuilder builder)
    {
        AppendOptionalCss(builder, "reactflow/reactflow.css");
        AppendOptionalScript(builder, "reactflow/reactflow-renderer.js");
    }

    private string ReadRequired(string relative)
    {
        var path = Path.Combine(assetRoot, relative.Replace('/', Path.DirectorySeparatorChar));
        return File.ReadAllText(path);
    }

    private void AppendOptionalScript(StringBuilder builder, string relative)
    {
        var path = Path.Combine(assetRoot, relative.Replace('/', Path.DirectorySeparatorChar));
        if (File.Exists(path)) builder.Append("<script>").Append(File.ReadAllText(path)).AppendLine("</script>");
    }

    private void AppendOptionalModulePayload(StringBuilder builder, string relative, string globalName)
    {
        var path = Path.Combine(assetRoot, relative.Replace('/', Path.DirectorySeparatorChar));
        if (!File.Exists(path)) return;
        var payload = Convert.ToBase64String(File.ReadAllBytes(path));
        builder.Append("<script>window.").Append(globalName).Append("='").Append(payload).AppendLine("';</script>");
    }

    private void AppendOptionalCss(StringBuilder builder, string relative)
    {
        var path = Path.Combine(assetRoot, relative.Replace('/', Path.DirectorySeparatorChar));
        if (!File.Exists(path)) return;
        var directory = Path.GetDirectoryName(path)!;
        var css = File.ReadAllText(path);
        css = Regex.Replace(css, """url\((?<quote>['"]?)(?<value>[^)'"]+)\k<quote>\)""", match =>
        {
            var value = match.Groups["value"].Value;
            if (value.StartsWith("data:", StringComparison.OrdinalIgnoreCase) || Uri.IsWellFormedUriString(value, UriKind.Absolute)) return match.Value;
            var fontPath = Path.GetFullPath(Path.Combine(directory, value.Replace('/', Path.DirectorySeparatorChar)));
            var allowedRoot = Path.GetFullPath(directory) + Path.DirectorySeparatorChar;
            if (!fontPath.StartsWith(allowedRoot, StringComparison.Ordinal) || !File.Exists(fontPath)) return match.Value;
            var mime = Path.GetExtension(fontPath).ToLowerInvariant() switch
            {
                ".woff2" => "font/woff2",
                ".woff" => "font/woff",
                ".ttf" => "font/ttf",
                _ => "application/octet-stream"
            };
            return $"url(data:{mime};base64,{Convert.ToBase64String(File.ReadAllBytes(fontPath))})";
        });
        builder.Append("<style>").Append(css).AppendLine("</style>");
    }

    private static string PrepareHeadings(string body, bool includeToc, bool numberHeadings)
    {
        var counters = new int[6];
        var usedIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var items = new List<TocItem>();
        var rendered = HeadingRegex().Replace(body, match =>
        {
            var level = int.Parse(match.Groups[1].Value, System.Globalization.CultureInfo.InvariantCulture);
            var attributes = match.Groups[2].Value;
            var inner = match.Groups[3].Value;
            var label = StripTags(inner).Trim();
            var idMatch = IdRegex().Match(attributes);
            var id = idMatch.Success ? idMatch.Groups[1].Value : UniqueSlug(label, usedIds);
            usedIds.Add(id);
            if (!idMatch.Success) attributes += $" id=\"{WebUtility.HtmlEncode(id)}\"";
            if (numberHeadings)
            {
                counters[level - 1]++;
                for (var index = level; index < counters.Length; index++) counters[index] = 0;
                var number = string.Join('.', counters.Take(level).Where(value => value > 0));
                inner = $"<span class=\"section-number\">{number}</span> {inner}";
                label = $"{number} {label}";
            }
            items.Add(new(level, id, label));
            return $"<h{level}{attributes}>{inner}</h{level}>";
        });
        if (!includeToc || items.Count == 0) return rendered;
        var toc = BuildHierarchicalToc(items);
        var marker = TocMarkerRegex();
        return marker.IsMatch(rendered) ? marker.Replace(rendered, toc, 1) : toc + rendered;
    }

    private static string BuildHierarchicalToc(IReadOnlyList<TocItem> items)
    {
        var root = new TocNode(0, string.Empty, string.Empty);
        var stack = new Stack<TocNode>();
        stack.Push(root);
        foreach (var item in items)
        {
            while (stack.Count > 1 && stack.Peek().Level >= item.Level) stack.Pop();
            var node = new TocNode(item.Level, item.Id, item.Label);
            stack.Peek().Children.Add(node);
            stack.Push(node);
        }
        var builder = new StringBuilder("<nav class=\"toc\" aria-label=\"Table of contents\"><h2>Table of contents</h2>");
        AppendTocList(builder, root.Children);
        return builder.Append("</nav>").ToString();
    }

    private static void AppendTocList(StringBuilder builder, IReadOnlyList<TocNode> nodes)
    {
        if (nodes.Count == 0) return;
        builder.Append("<ol>");
        foreach (var node in nodes)
        {
            builder.Append("<li class=\"toc-level-").Append(node.Level).Append("\"><a href=\"#")
                .Append(WebUtility.HtmlEncode(node.Id)).Append("\">").Append(WebUtility.HtmlEncode(node.Label)).Append("</a>");
            AppendTocList(builder, node.Children);
            builder.Append("</li>");
        }
        builder.Append("</ol>");
    }

    private static string BuildCover(IReadOnlyDictionary<string, object?> metadata, RenderOptions options, string title)
    {
        var coverTitle = options.CoverTitle ?? title;
        var subtitle = options.CoverSubtitle ?? MetadataString(metadata, "subtitle");
        var author = options.CoverAuthor ?? MetadataString(metadata, "author");
        var organization = options.CoverOrganization ?? MetadataString(metadata, "organization");
        var version = options.CoverVersion ?? MetadataString(metadata, "version");
        var status = options.CoverStatus ?? MetadataString(metadata, "status");
        var description = options.CoverDescription ?? MetadataString(metadata, "description") ?? MetadataString(metadata, "abstract");
        var date = options.CoverDate ?? MetadataString(metadata, "date");
        var image = options.CoverImage ?? MetadataString(metadata, "cover-image");
        var builder = new StringBuilder("<section class=\"document-cover\">");
        if (!string.IsNullOrWhiteSpace(image)) builder.Append("<img class=\"cover-image\" src=\"").Append(WebUtility.HtmlEncode(image)).Append("\" alt=\"\">");
        builder.Append("<h1>").Append(WebUtility.HtmlEncode(coverTitle)).Append("</h1>");
        AppendCoverField(builder, "cover-subtitle", subtitle);
        AppendCoverField(builder, "cover-description", description);
        AppendCoverField(builder, "cover-author", author);
        AppendCoverField(builder, "cover-organization", organization);
        AppendCoverField(builder, "cover-version", version is null ? null : $"Version {version}");
        AppendCoverField(builder, "cover-status", status);
        AppendCoverField(builder, "cover-date", date);
        return builder.Append("</section>").ToString();
    }

    private static void AppendCoverField(StringBuilder builder, string cssClass, string? value)
    {
        if (!string.IsNullOrWhiteSpace(value)) builder.Append("<p class=\"").Append(cssClass).Append("\">").Append(WebUtility.HtmlEncode(value)).Append("</p>");
    }

    private static string UniqueSlug(string label, HashSet<string> used)
    {
        var slug = SlugRegex().Replace(WebUtility.HtmlDecode(label).ToLowerInvariant(), "-").Trim('-');
        if (string.IsNullOrWhiteSpace(slug)) slug = "section";
        var candidate = slug;
        var suffix = 2;
        while (used.Contains(candidate)) candidate = $"{slug}-{suffix++}";
        return candidate;
    }

    private static string StripTags(string value) => TagRegex().Replace(value, string.Empty);
    private static string? MetadataString(IReadOnlyDictionary<string, object?> metadata, string key) =>
        metadata.TryGetValue(key, out var value) ? Convert.ToString(value, System.Globalization.CultureInfo.InvariantCulture) : null;
    private static bool MetadataBoolean(IReadOnlyDictionary<string, object?> metadata, string key) =>
        metadata.TryGetValue(key, out var value) && (value is true || new[] { "true", "yes", "1", "on" }.Contains(Convert.ToString(value), StringComparer.OrdinalIgnoreCase));
    private static string NormalizeTheme(string theme) => theme.ToLowerInvariant() switch { "dark" => "dark", "minimal" => "minimal", _ => "professional" };

    private sealed record TocItem(int Level, string Id, string Label);
    private sealed class TocNode(int level, string id, string label)
    {
        public int Level { get; } = level;
        public string Id { get; } = id;
        public string Label { get; } = label;
        public List<TocNode> Children { get; } = [];
    }

    [GeneratedRegex("<h([1-6])([^>]*)>(.*?)</h\\1>", RegexOptions.IgnoreCase | RegexOptions.Singleline)]
    private static partial Regex HeadingRegex();
    [GeneratedRegex("\\sid=[\"']([^\"']+)[\"']", RegexOptions.IgnoreCase)]
    private static partial Regex IdRegex();
    [GeneratedRegex("<[^>]+>")]
    private static partial Regex TagRegex();
    [GeneratedRegex("[^a-z0-9_-]+")]
    private static partial Regex SlugRegex();
    [GeneratedRegex("(?is)<p>\\s*\\[TOC\\]\\s*</p>|\\[TOC\\]")]
    private static partial Regex TocMarkerRegex();
}
