using System.Globalization;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Markdig;
using Rune.Core;

namespace Rune.Rendering;

public sealed record PageDecorationResource(string Path, string ContentType, byte[] Content);

public sealed record PageDecorationFragmentPlan(
    string Profile,
    string Region,
    PageDecorationContentFormat Format,
    PageDecorationCapabilityClass Capability,
    PageDecorationOverflowPolicy Overflow,
    double MinimumScale,
    string? MaximumHeight,
    IReadOnlyList<string> Tokens,
    IReadOnlyList<string> Resources,
    string ContentSha256);

public sealed record PageDecorationPlan(
    string ContractVersion,
    bool RequiresTwoPass,
    bool PreserveTaggedPdf,
    bool ValidateFinalPdfA,
    IReadOnlyList<PageDecorationFragmentPlan> Fragments,
    string Digest);

public static partial class PageDecorationCompiler
{
    private const int MaximumTemplateLength = 32_000;
    private static readonly MarkdownPipeline DecorationMarkdownPipeline = new MarkdownPipelineBuilder()
        .UseAdvancedExtensions()
        .DisableHtml()
        .Build();
    private static readonly HashSet<string> BuiltInTokens = new(StringComparer.OrdinalIgnoreCase)
    {
        "page", "pages", "pageNumber", "totalPages", "title", "documentName", "renderDate", "sectionTitle",
        "author", "organization", "version", "status", "date"
    };
    private static readonly HashSet<string> DirectHtmlTags = new(StringComparer.OrdinalIgnoreCase)
    {
        "p", "div", "span", "strong", "b", "em", "i", "small", "br", "code", "a", "img",
        "table", "thead", "tbody", "tfoot", "tr", "th", "td", "ul", "ol", "li",
        "svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "text", "title", "desc"
    };
    private static readonly HashSet<string> SafeImageTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/png", "image/jpeg", "image/webp", "image/svg+xml"
    };

    public static string Compile(RenderOptions options, IReadOnlyDictionary<string, object?> metadata)
    {
        var decorations = options.PageDecorations;
        if (decorations is null) return string.Empty;
        if (!string.IsNullOrWhiteSpace(options.HeaderTemplate) || !string.IsNullOrWhiteSpace(options.FooterTemplate))
            throw new ArgumentException("Page decoration profiles cannot be combined with legacy headerTemplate or footerTemplate.");

        var plan = BuildPlan(options, metadata);
        ValidateReservedMargins(options, decorations);
        if (plan.RequiresTwoPass) return string.Empty;

        var values = StaticValues(options, metadata);
        var css = new StringBuilder();
        AppendProfile(css, string.Empty, decorations.Default, values);
        AppendProfile(css, ":first", decorations.First, values);
        AppendProfile(css, ":left", decorations.Left, values);
        AppendProfile(css, ":right", decorations.Right, values);
        return css.ToString();
    }

    public static PageDecorationPlan BuildPlan(RenderOptions options, IReadOnlyDictionary<string, object?> metadata)
    {
        var decorations = options.PageDecorations ?? throw new ArgumentException("Page decorations are not configured.");
        PageDecorationRuleResolver.ValidateRules(decorations.Rules);
        if (!string.Equals(decorations.AuthoringConflictPolicy, "reject", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(decorations.AuthoringConflictPolicy, "higher-precedence-wins", StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("Page decoration authoringConflictPolicy must be reject or higher-precedence-wins.");

        var fragments = new List<PageDecorationFragmentPlan>();
        AddTemplate(fragments, "default", decorations.Default, metadata);
        AddTemplate(fragments, "first", decorations.First, metadata);
        AddTemplate(fragments, "left", decorations.Left, metadata);
        AddTemplate(fragments, "right", decorations.Right, metadata);
        AddTemplate(fragments, "cover", decorations.Cover, metadata);
        foreach (var rule in decorations.Rules ?? []) AddTemplate(fragments, $"rule:{rule.Name}", rule.Template, metadata);

        if (fragments.Any(item => item.Capability == PageDecorationCapabilityClass.Rejected))
            throw new ArgumentException("A page decoration fragment contains a rejected document-global, executable, remote, or unsafe capability.");

        var requiresTwoPass = decorations.TwoPassPdfComposition || decorations.Cover is not null ||
            (decorations.Rules?.Count ?? 0) > 0 || fragments.Any(item =>
                item.Format != PageDecorationContentFormat.Text || item.Capability != PageDecorationCapabilityClass.Direct ||
                item.MaximumHeight is not null || item.Overflow != PageDecorationOverflowPolicy.Error || item.Resources.Count > 0);
        var payload = JsonSerializer.SerializeToUtf8Bytes(new
        {
            contractVersion = "1.0",
            requiresTwoPass,
            decorations.PreserveTaggedPdf,
            decorations.ValidateFinalPdfA,
            fragments
        }, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        return new PageDecorationPlan("1.0", requiresTwoPass, decorations.PreserveTaggedPdf, decorations.ValidateFinalPdfA,
            fragments, Convert.ToHexString(SHA256.HashData(payload)));
    }

    public static bool RequiresTwoPass(RenderOptions options, IReadOnlyDictionary<string, object?>? metadata = null) =>
        options.PageDecorations is not null && BuildPlan(options, metadata ?? new Dictionary<string, object?>()).RequiresTwoPass;

    public static string RenderFragmentHtml(
        PageDecorationRegion region,
        IReadOnlyDictionary<string, string> values,
        IReadOnlyDictionary<string, PageDecorationResource>? resources = null)
    {
        Validate(region, "region", values.ToDictionary(pair => pair.Key, pair => (object?)pair.Value, StringComparer.OrdinalIgnoreCase));
        var content = ReplaceTokens(region.Content, values, htmlEncode: region.Format != PageDecorationContentFormat.Text);
        string html = region.Format switch
        {
            PageDecorationContentFormat.Text => WebUtility.HtmlEncode(content).Replace("\n", "<br>", StringComparison.Ordinal),
            PageDecorationContentFormat.Markdown => Markdig.Markdown.ToHtml(content, DecorationMarkdownPipeline),
            PageDecorationContentFormat.Html => content,
            _ => throw new ArgumentOutOfRangeException(nameof(region.Format), region.Format, "Unsupported page decoration format.")
        };
        html = EmbedLocalResources(html, resources);
        return SanitizeDecorationHtml(html, region.SanitizeSvg);
    }

    public static IReadOnlyDictionary<string, string> BuildTokenValues(
        RenderOptions options,
        IReadOnlyDictionary<string, object?> metadata,
        int pageNumber,
        int totalPages,
        string? sectionTitle = null,
        string? documentName = null,
        DateTimeOffset? renderDate = null)
    {
        var result = StaticValues(options, metadata).ToDictionary(pair => pair.Key, pair => pair.Value, StringComparer.OrdinalIgnoreCase);
        result["page"] = pageNumber.ToString(CultureInfo.InvariantCulture);
        result["pages"] = totalPages.ToString(CultureInfo.InvariantCulture);
        result["pageNumber"] = result["page"];
        result["totalPages"] = result["pages"];
        result["sectionTitle"] = sectionTitle ?? string.Empty;
        result["documentName"] = documentName ?? result.GetValueOrDefault("documentName", string.Empty);
        result["renderDate"] = (renderDate ?? ParseRenderDate(metadata) ?? DateTimeOffset.UtcNow).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        foreach (var pair in metadata)
            result[$"metadata.{pair.Key}"] = Convert.ToString(pair.Value, CultureInfo.InvariantCulture) ?? string.Empty;
        return result;
    }

    public static string NormalizeContent(string content, PageDecorationContentFormat format)
    {
        ValidateText(content, "content");
        return format switch
        {
            PageDecorationContentFormat.Text => content,
            PageDecorationContentFormat.Markdown => NormalizeWhitespace(WebUtility.HtmlDecode(HtmlTagRegex().Replace(
                Markdig.Markdown.ToHtml(content, DecorationMarkdownPipeline), " "))),
            PageDecorationContentFormat.Html => NormalizeWhitespace(WebUtility.HtmlDecode(HtmlTagRegex().Replace(
                SanitizeDecorationHtml(content, sanitizeSvg: true), " "))),
            _ => throw new ArgumentOutOfRangeException(nameof(format), format, "Unsupported page decoration format.")
        };
    }

    internal static string ToContentExpression(string template, IReadOnlyDictionary<string, string> values)
    {
        ValidateText(template, "template");
        if (template.Length == 0) return "none";
        var parts = new List<string>();
        var offset = 0;
        foreach (Match match in TokenRegex().Matches(template))
        {
            if (match.Index > offset) parts.Add(Quote(template[offset..match.Index]));
            var token = TokenName(match);
            parts.Add(token.ToLowerInvariant() switch
            {
                "page" or "pagenumber" => "counter(page)",
                "pages" or "totalpages" => "counter(pages)",
                _ when values.TryGetValue(token, out var value) => Quote(value),
                _ => throw new ArgumentException($"Unsupported page decoration token: {match.Value}.")
            });
            offset = match.Index + match.Length;
        }
        if (offset < template.Length) parts.Add(Quote(template[offset..]));
        return parts.Count == 0 ? Quote(template) : string.Join(" ", parts.Where(part => part != "\"\""));
    }

    private static void AppendProfile(StringBuilder css, string selector, PageDecorationTemplate? template, IReadOnlyDictionary<string, string> values)
    {
        if (template is null) return;
        var (header, footer) = Regions(template);
        Validate(header, "header", values.ToDictionary(pair => pair.Key, pair => (object?)pair.Value, StringComparer.OrdinalIgnoreCase));
        Validate(footer, "footer", values.ToDictionary(pair => pair.Key, pair => (object?)pair.Value, StringComparer.OrdinalIgnoreCase));
        css.Append("@page").Append(selector.Length == 0 ? string.Empty : " " + selector).AppendLine(" {");
        AppendBox(css, true, header, values);
        AppendBox(css, false, footer, values);
        css.AppendLine("}");
    }

    private static void AppendBox(StringBuilder css, bool header, PageDecorationRegion? region, IReadOnlyDictionary<string, string> values)
    {
        if (region is null) return;
        var vertical = header ? "top" : "bottom";
        var horizontal = region.Alignment.ToString().ToLowerInvariant();
        var normalized = NormalizeContent(region.Content, region.Format);
        css.Append("  @").Append(vertical).Append('-').Append(horizontal).Append(" { content: ")
            .Append(ToContentExpression(normalized, values)).Append(';');
        if (region.OverflowPolicy == PageDecorationOverflowPolicy.Clip) css.Append(" overflow: hidden;");
        else if (region.OverflowPolicy == PageDecorationOverflowPolicy.Scale)
            css.Append(" font-size: ").Append(Math.Clamp(region.MinimumScale, 0.5, 1).ToString("0.###", CultureInfo.InvariantCulture)).Append("em;");
        if (region.MaximumHeight is not null) css.Append(" max-height:").Append(region.MaximumHeight).Append(';');
        css.AppendLine(" }");
    }

    private static void AddTemplate(List<PageDecorationFragmentPlan> fragments, string profile, PageDecorationTemplate? template,
        IReadOnlyDictionary<string, object?> metadata)
    {
        if (template is null) return;
        var (header, footer) = Regions(template);
        if (header is not null) fragments.Add(Fragment(profile, "header", header, metadata));
        if (footer is not null) fragments.Add(Fragment(profile, "footer", footer, metadata));
    }

    private static PageDecorationFragmentPlan Fragment(string profile, string regionName, PageDecorationRegion region,
        IReadOnlyDictionary<string, object?> metadata)
    {
        Validate(region, regionName, metadata);
        var capability = Classify(region.Content, region.Format);
        if (region.RequiredCapability is { } required && required != capability)
            throw new ArgumentException($"Page decoration {profile}/{regionName} requires capability {required} but normalized as {capability}.");
        var tokens = TokenRegex().Matches(region.Content).Select(TokenName).Distinct(StringComparer.OrdinalIgnoreCase).Order(StringComparer.OrdinalIgnoreCase).ToArray();
        var resources = ResourceRegex().Matches(region.Content).Select(match => match.Groups["path"].Value).Distinct(StringComparer.OrdinalIgnoreCase).Order(StringComparer.OrdinalIgnoreCase).ToArray();
        return new PageDecorationFragmentPlan(profile, regionName, region.Format, capability, region.OverflowPolicy,
            region.MinimumScale, region.MaximumHeight, tokens, resources,
            Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(region.Content))));
    }

    private static PageDecorationCapabilityClass Classify(string content, PageDecorationContentFormat format)
    {
        if (RejectedContentRegex().IsMatch(content)) return PageDecorationCapabilityClass.Rejected;
        if (RendererFenceRegex().IsMatch(content) || Regex.IsMatch(content, "data-(?:kind|renderer)=", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant))
            return PageDecorationCapabilityClass.PreRender;
        if (format == PageDecorationContentFormat.Html)
        {
            foreach (Match match in HtmlOpenTagRegex().Matches(content))
                if (!DirectHtmlTags.Contains(match.Groups["tag"].Value)) return PageDecorationCapabilityClass.Rejected;
        }
        return PageDecorationCapabilityClass.Direct;
    }

    private static (PageDecorationRegion? Header, PageDecorationRegion? Footer) Regions(PageDecorationTemplate template)
    {
        if (template.Header is not null && template.HeaderRegion is not null)
            throw new ArgumentException("A page decoration header cannot define both the legacy string and headerRegion.");
        if (template.Footer is not null && template.FooterRegion is not null)
            throw new ArgumentException("A page decoration footer cannot define both the legacy string and footerRegion.");
        return (
            template.HeaderRegion ?? (template.Header is null ? null : new PageDecorationRegion(template.Header, Alignment: template.HeaderAlignment)),
            template.FooterRegion ?? (template.Footer is null ? null : new PageDecorationRegion(template.Footer, Alignment: template.FooterAlignment)));
    }

    private static IReadOnlyDictionary<string, string> StaticValues(RenderOptions options, IReadOnlyDictionary<string, object?> metadata) =>
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["title"] = Metadata(metadata, "title") ?? options.CoverTitle ?? "RUNE Document",
            ["author"] = Metadata(metadata, "author") ?? options.CoverAuthor ?? string.Empty,
            ["organization"] = Metadata(metadata, "organization") ?? options.CoverOrganization ?? string.Empty,
            ["version"] = Metadata(metadata, "version") ?? options.CoverVersion ?? string.Empty,
            ["status"] = Metadata(metadata, "status") ?? options.CoverStatus ?? string.Empty,
            ["date"] = Metadata(metadata, "date") ?? options.CoverDate ?? string.Empty,
            ["documentName"] = Metadata(metadata, "document-name") ?? string.Empty,
            ["renderDate"] = (ParseRenderDate(metadata) ?? DateTimeOffset.UtcNow).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            ["sectionTitle"] = string.Empty
        };

    private static DateTimeOffset? ParseRenderDate(IReadOnlyDictionary<string, object?> metadata)
    {
        var value = Metadata(metadata, "render-date") ?? Metadata(metadata, "renderDate");
        return DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var parsed)
            ? parsed.ToUniversalTime()
            : null;
    }

    private static void Validate(PageDecorationRegion? region, string field, IReadOnlyDictionary<string, object?> metadata)
    {
        if (region is null) return;
        ValidateText(region.Content, field);
        if (region.MinimumScale is < 0.5 or > 1)
            throw new ArgumentException($"Page decoration {field} minimumScale must be between 0.5 and 1.");
        if (region.MaximumHeight is not null && !CssLengthRegex().IsMatch(region.MaximumHeight))
            throw new ArgumentException($"Page decoration {field} maximumHeight is invalid.");
        foreach (Match match in TokenRegex().Matches(region.Content))
        {
            var token = TokenName(match);
            if (BuiltInTokens.Contains(token)) continue;
            if (token.StartsWith("metadata.", StringComparison.OrdinalIgnoreCase))
            {
                var key = token["metadata.".Length..];
                if (region.AllowedMetadataTokens?.Contains(key, StringComparer.OrdinalIgnoreCase) != true)
                    throw new ArgumentException($"Page decoration metadata token '{key}' is not allowlisted.");
                if (!metadata.ContainsKey(key) && !metadata.ContainsKey("metadata." + key))
                    throw new ArgumentException($"Page decoration metadata token '{key}' is unavailable.");
                continue;
            }
            throw new ArgumentException($"Unsupported page decoration token: {match.Value}.");
        }
    }

    private static void ValidateReservedMargins(RenderOptions options, PageDecorationOptions decorations)
    {
        if (!decorations.ValidateReservedMargins) return;
        var top = ToMillimeters(options.MarginTop);
        var bottom = ToMillimeters(options.MarginBottom);
        foreach (var template in new[] { decorations.Default, decorations.First, decorations.Left, decorations.Right, decorations.Cover }
                     .Concat((decorations.Rules ?? []).Select(rule => rule.Template)).Where(item => item is not null))
        {
            var regions = Regions(template!);
            if (regions.Header?.MaximumHeight is { } headerHeight && ToMillimeters(headerHeight) > top)
                throw new ArgumentException("Page decoration header maximumHeight exceeds the reserved top margin.");
            if (regions.Footer?.MaximumHeight is { } footerHeight && ToMillimeters(footerHeight) > bottom)
                throw new ArgumentException("Page decoration footer maximumHeight exceeds the reserved bottom margin.");
        }
    }

    private static double ToMillimeters(string value)
    {
        var match = CssLengthRegex().Match(value.Trim());
        if (!match.Success) throw new ArgumentException($"Unsupported CSS length: {value}.");
        var number = double.Parse(match.Groups["value"].Value, CultureInfo.InvariantCulture);
        return match.Groups["unit"].Value.ToLowerInvariant() switch
        {
            "mm" => number,
            "cm" => number * 10,
            "in" => number * 25.4,
            "pt" => number * 25.4 / 72,
            "px" => number * 25.4 / 96,
            _ => throw new ArgumentException($"Unsupported CSS length: {value}.")
        };
    }

    private static string ReplaceTokens(string template, IReadOnlyDictionary<string, string> values, bool htmlEncode)
    {
        return TokenRegex().Replace(template, match =>
        {
            var token = TokenName(match);
            if (!values.TryGetValue(token, out var value)) throw new ArgumentException($"Page decoration token '{token}' is unavailable.");
            return htmlEncode ? WebUtility.HtmlEncode(value) : value;
        });
    }

    private static string EmbedLocalResources(string html, IReadOnlyDictionary<string, PageDecorationResource>? resources)
    {
        return ResourceAttributeRegex().Replace(html, match =>
        {
            var path = match.Groups["path"].Value;
            if (resources is null || !resources.TryGetValue(path, out var resource))
                throw new ArgumentException($"Page decoration resource '{path}' was not supplied.");
            if (!SafeImageTypes.Contains(resource.ContentType))
                throw new ArgumentException($"Page decoration resource '{path}' has unsupported content type '{resource.ContentType}'.");
            var bytes = resource.ContentType.Equals("image/svg+xml", StringComparison.OrdinalIgnoreCase)
                ? Encoding.UTF8.GetBytes(SanitizeSvgText(Encoding.UTF8.GetString(resource.Content)))
                : resource.Content;
            var uri = $"data:{resource.ContentType};base64,{Convert.ToBase64String(bytes)}";
            return $"{match.Groups["name"].Value}=\"{uri}\"";
        });
    }

    private static string SanitizeDecorationHtml(string html, bool sanitizeSvg)
    {
        if (RejectedContentRegex().IsMatch(html))
            throw new ArgumentException("Page decoration HTML contains executable or document-global content.");
        html = EventAttributeRegex().Replace(html, string.Empty);
        html = UnsafeUrlAttributeRegex().Replace(html, string.Empty);
        html = HtmlOpenTagRegex().Replace(html, match => DirectHtmlTags.Contains(match.Groups["tag"].Value) ? match.Value : string.Empty);
        html = HtmlCloseTagRegex().Replace(html, match => DirectHtmlTags.Contains(match.Groups["tag"].Value) ? match.Value : string.Empty);
        html = StyleAttributeRegex().Replace(html, match =>
        {
            var safe = string.Join(';', match.Groups["value"].Value.Split(';', StringSplitOptions.RemoveEmptyEntries)
                .Select(item => item.Trim())
                .Where(item => Regex.IsMatch(item, "^(?:color|background-color|font(?:-family|-size|-weight|-style)?|text-align|line-height|width|height|max-width|max-height|margin|padding|border(?:-[a-z]+)?|display|vertical-align|white-space)\\s*:", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant) &&
                               !item.Contains("url(", StringComparison.OrdinalIgnoreCase) && !item.Contains("expression", StringComparison.OrdinalIgnoreCase)));
            return safe.Length == 0 ? string.Empty : $" style=\"{WebUtility.HtmlEncode(safe)}\"";
        });
        return sanitizeSvg ? SanitizeSvgText(html) : html;
    }

    private static string SanitizeSvgText(string value)
    {
        value = Regex.Replace(value, "<\\s*(?:script|foreignObject|iframe|object|embed|use)\\b[^>]*>.*?<\\s*/\\s*(?:script|foreignObject|iframe|object|embed|use)\\s*>", string.Empty,
            RegexOptions.IgnoreCase | RegexOptions.Singleline | RegexOptions.CultureInvariant);
        value = Regex.Replace(value, "\\s(?:href|xlink:href)\\s*=\\s*([\"'])(?!#)[^\"']*\\1", string.Empty,
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
        value = EventAttributeRegex().Replace(value, string.Empty);
        return value;
    }

    private static string NormalizeWhitespace(string value) =>
        Regex.Replace(value.Replace("\r\n", "\n", StringComparison.Ordinal).Replace('\r', '\n'), @"[ \t]+", " ", RegexOptions.CultureInvariant).Trim();

    private static void ValidateText(string? value, string field)
    {
        if (value is null) return;
        if (value.Length > MaximumTemplateLength)
            throw new ArgumentException($"Page decoration {field} exceeds {MaximumTemplateLength.ToString(CultureInfo.InvariantCulture)} characters.");
        if (value.Any(character => char.IsControl(character) && character is not '\r' and not '\n' and not '\t'))
            throw new ArgumentException($"Page decoration {field} contains a control character.");
    }

    private static string TokenName(Match match) => match.Groups["canonical"].Success
        ? match.Groups["canonical"].Value.Trim()
        : match.Groups["legacy"].Value.Trim();

    private static string Quote(string value) => $"\"{value.Replace("\\", "\\\\", StringComparison.Ordinal).Replace("\"", "\\\"", StringComparison.Ordinal).Replace("\r\n", "\\A ", StringComparison.Ordinal).Replace("\n", "\\A ", StringComparison.Ordinal).Replace("\r", "\\A ", StringComparison.Ordinal)}\"";
    private static string? Metadata(IReadOnlyDictionary<string, object?> metadata, string key) => metadata.TryGetValue(key, out var value) ? Convert.ToString(value, CultureInfo.InvariantCulture) : null;

    [GeneratedRegex(@"\{\{\s*(?<canonical>[A-Za-z][A-Za-z0-9.-]*)\s*\}\}|(?<!\{)\{(?<legacy>[A-Za-z][A-Za-z0-9.-]*)\}(?!\})", RegexOptions.CultureInvariant)]
    private static partial Regex TokenRegex();
    [GeneratedRegex(@"resource://(?<path>[A-Za-z0-9._/-]+)", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex ResourceRegex();
    [GeneratedRegex("(?<name>src|href)\\s*=\\s*[\"']resource://(?<path>[A-Za-z0-9._/-]+)[\"']", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex ResourceAttributeRegex();
    [GeneratedRegex(@"<[^>]+>", RegexOptions.CultureInvariant)]
    private static partial Regex HtmlTagRegex();
    [GeneratedRegex(@"<\s*(?<tag>[A-Za-z][A-Za-z0-9:-]*)\b[^>]*>", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex HtmlOpenTagRegex();
    [GeneratedRegex(@"<\s*/\s*(?<tag>[A-Za-z][A-Za-z0-9:-]*)\s*>", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex HtmlCloseTagRegex();
    [GeneratedRegex(@"<\s*(?:script|style|iframe|object|embed|form|input|button|video|audio|canvas|link|meta|base)\b|\bon[a-z]+\s*=|javascript:|vbscript:|data:text/html|@import|expression\s*\(", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex RejectedContentRegex();
    [GeneratedRegex(@"(?:https?|ftp|file):\\?/\\?/|\\\\|/(?:etc|proc|sys|dev)/", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex RemoteUrlRegex();
    [GeneratedRegex(@"```\s*(?:mermaid|schematex|orgchart|reactflow|react-flow|xyflow|chart|echarts|map|geojson|topojson|katex|math)\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex RendererFenceRegex();
    [GeneratedRegex("\\s+on[a-z]+\\s*=\\s*([\"']).*?\\1", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex EventAttributeRegex();
    [GeneratedRegex("\\s+(?:href|src)\\s*=\\s*([\"'])(?:javascript:|vbscript:|https?:|file:).*?\\1", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex UnsafeUrlAttributeRegex();
    [GeneratedRegex("\\s+style\\s*=\\s*([\"'])(?<value>.*?)\\1", RegexOptions.IgnoreCase | RegexOptions.Singleline | RegexOptions.CultureInvariant)]
    private static partial Regex StyleAttributeRegex();
    [GeneratedRegex(@"^(?<value>\d+(?:\.\d+)?)(?<unit>mm|cm|in|pt|px)$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex CssLengthRegex();
}
