using System.Net;
using System.Text.RegularExpressions;

namespace Rune.Core;

public sealed record RuneDocumentModel(
    string Version,
    string Title,
    DocumentSourceType SourceType,
    IReadOnlyDictionary<string, object?> Metadata,
    IReadOnlyList<RuneDocumentNode> Nodes,
    IReadOnlyList<RenderDiagnostic> Diagnostics,
    IReadOnlyList<string> RequiredRenderers);

public sealed record RuneDocumentNode(
    string Id,
    string Type,
    int Level,
    string? Text,
    string? Html,
    IReadOnlyDictionary<string, object?> Attributes,
    IReadOnlyList<RuneDocumentNode> Children);

public static partial class RuneDocumentModelBuilder
{
    public static RuneDocumentModel FromCompiled(
        DocumentSourceType sourceType,
        string title,
        IReadOnlyDictionary<string, object?> metadata,
        string bodyHtml,
        IReadOnlySet<string> requiredRenderers,
        IReadOnlyList<RenderDiagnostic> diagnostics)
    {
        var nodes = new List<RuneDocumentNode>();
        var ids = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var index = 0;
        foreach (Match match in BlockRegex().Matches(bodyHtml))
        {
            index++;
            var tag = (match.Groups[1].Success ? match.Groups[1].Value : match.Groups[4].Value).ToLowerInvariant();
            var attributeText = match.Groups[1].Success ? match.Groups[2].Value : match.Groups[5].Value;
            var innerHtml = match.Groups[1].Success ? match.Groups[3].Value : string.Empty;
            var attributes = ParseAttributes(attributeText);
            var type = BlockType(tag, attributes);
            var level = tag.Length == 2 && tag[0] == 'h' && char.IsDigit(tag[1]) ? tag[1] - '0' : 0;
            var text = type is "diagram" or "html" ? null : PlainText(innerHtml);
            var suggestedId = attributes.TryGetValue("id", out var explicitId) ? Convert.ToString(explicitId) : null;
            var id = UniqueId(string.IsNullOrWhiteSpace(suggestedId) ? $"{type}-{index}" : suggestedId!, ids);
            var nodeAttributes = new Dictionary<string, object?>(attributes, StringComparer.OrdinalIgnoreCase)
            {
                ["tag"] = tag,
                ["sourceIndex"] = index
            };
            if (type == "code")
            {
                var language = LanguageRegex().Match(attributeText + " " + innerHtml);
                if (language.Success) nodeAttributes["language"] = language.Groups[1].Value;
            }
            if (type == "diagram" && attributes.TryGetValue("data-kind", out var kind))
                nodeAttributes["renderer"] = kind;
            nodes.Add(new RuneDocumentNode(id, type, level, text, match.Value, nodeAttributes, []));
        }

        if (nodes.Count == 0 || !CoversMeaningfulBody(nodes, bodyHtml))
        {
            nodes.Add(new RuneDocumentNode(
                UniqueId("document-html", ids),
                "html",
                0,
                null,
                bodyHtml,
                new Dictionary<string, object?> { ["sourceIndex"] = nodes.Count + 1 },
                []));
        }

        return new RuneDocumentModel(
            "1.0",
            title,
            sourceType,
            metadata,
            nodes,
            diagnostics,
            requiredRenderers.Order(StringComparer.Ordinal).ToArray());
    }

    private static string BlockType(string tag, IReadOnlyDictionary<string, object?> attributes)
    {
        if (tag.StartsWith('h') && tag.Length == 2 && char.IsDigit(tag[1])) return "heading";
        if (tag == "rune-diagram" || attributes.ContainsKey("data-kind")) return "diagram";
        return tag switch
        {
            "p" => "paragraph",
            "ul" or "ol" or "dl" => "list",
            "blockquote" => "quote",
            "pre" => "code",
            "table" => "table",
            "figure" => "figure",
            "details" => "details",
            "section" or "article" => "section",
            "hr" => "thematic-break",
            _ => "html"
        };
    }

    private static Dictionary<string, object?> ParseAttributes(string source)
    {
        var attributes = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        foreach (Match match in AttributeRegex().Matches(source))
        {
            var name = match.Groups[1].Value;
            object value = match.Groups[3].Success ? WebUtility.HtmlDecode(match.Groups[4].Value) : true;
            attributes[name] = value;
        }
        return attributes;
    }

    private static string PlainText(string html) =>
        WhitespaceRegex().Replace(WebUtility.HtmlDecode(TagRegex().Replace(html, " ")), " ").Trim();

    private static bool CoversMeaningfulBody(IReadOnlyList<RuneDocumentNode> nodes, string bodyHtml)
    {
        var represented = nodes.Sum(node => node.Html?.Length ?? 0);
        return represented >= Math.Max(1, bodyHtml.Length / 2);
    }

    private static string UniqueId(string proposed, ISet<string> ids)
    {
        var normalized = Regex.Replace(proposed.Trim(), "[^A-Za-z0-9_.:-]+", "-").Trim('-');
        if (normalized.Length == 0) normalized = "node";
        var candidate = normalized;
        var suffix = 2;
        while (!ids.Add(candidate)) candidate = $"{normalized}-{suffix++}";
        return candidate;
    }

    [GeneratedRegex("<(h[1-6]|p|ul|ol|dl|blockquote|pre|table|figure|details|div|rune-diagram|section|article|hr)\\b([^>]*)>(.*?)</\\1>|<(hr)\\b([^>]*)/?>", RegexOptions.IgnoreCase | RegexOptions.Singleline)]
    private static partial Regex BlockRegex();

    [GeneratedRegex("([A-Za-z_:][-A-Za-z0-9_:.]*)(\\s*=\\s*([\\\"'])(.*?)\\3)?", RegexOptions.Singleline)]
    private static partial Regex AttributeRegex();

    [GeneratedRegex("<[^>]+>")]
    private static partial Regex TagRegex();

    [GeneratedRegex("\\s+")]
    private static partial Regex WhitespaceRegex();

    [GeneratedRegex("language-([A-Za-z0-9_-]+)", RegexOptions.IgnoreCase)]
    private static partial Regex LanguageRegex();
}
