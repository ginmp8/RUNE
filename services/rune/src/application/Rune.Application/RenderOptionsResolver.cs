using System.Collections;
using System.Globalization;
using System.Text.Json;
using Rune.Core;

namespace Rune.Application;

public static class RenderOptionsResolver
{
    private static readonly HashSet<string> PageSizes = ["A3", "A4", "A5", "Letter", "Legal", "Tabloid"];
    private static readonly HashSet<string> Themes = ["professional", "minimal", "dark"];
    private static readonly HashSet<string> Directions = ["auto", "ltr", "rtl"];
    private static readonly HashSet<string> PdfAConformance = ["1b", "2b", "3b"];

    public static RenderOptions Resolve(IReadOnlyDictionary<string, object?> metadata) => Apply(new RenderOptions(), metadata);

    public static RenderOptions Apply(RenderOptions options, IReadOnlyDictionary<string, object?> metadata)
    {
        if (!options.ApplyFrontMatter || metadata.Count == 0) return options;
        var theme = Allowed(Text(metadata, "theme", "pdf-theme"), Themes) ?? options.Theme;
        var pageSize = Allowed(Text(metadata, "page-size", "pagesize", "papersize", "paper-size", "format"), PageSizes) ?? options.PageSize;
        var direction = Allowed(Text(metadata, "direction", "dir", "text-direction"), Directions) ?? options.Direction;
        var orientation = Text(metadata, "orientation")?.ToLowerInvariant();
        var landscape = orientation switch
        {
            "landscape" or "paisagem" => true,
            "portrait" or "retrato" => false,
            _ => Boolean(metadata, options.Landscape, "landscape")
        };
        var pdfA = Allowed(Text(metadata, "pdfa-conformance", "pdf-a-conformance"), PdfAConformance) ?? options.PdfAConformance;
        var frontMatterDecorations = ParseFrontMatterDecorations(metadata);
        var fenceDecorations = ParseFenceDecorations(metadata);
        var authoredDecorations = MergeDecorations(frontMatterDecorations, fenceDecorations, "reject");
        var resolvedDecorations = MergeDecorations(options.PageDecorations, authoredDecorations,
            options.PageDecorations?.AuthoringConflictPolicy ?? authoredDecorations?.AuthoringConflictPolicy ?? "reject");

        return options with
        {
            Theme = theme,
            PageSize = pageSize,
            Landscape = landscape,
            PrintBackground = Boolean(metadata, options.PrintBackground, "print-background"),
            Language = Text(metadata, "language", "lang", "idioma") ?? options.Language,
            Direction = direction,
            IncludeCover = Boolean(metadata, options.IncludeCover, "include-cover", "cover", "title-page"),
            IncludeToc = Boolean(metadata, options.IncludeToc, "toc", "include-toc", "table-of-contents"),
            NumberHeadings = Boolean(metadata, options.NumberHeadings, "number-headings", "number-sections", "section-numbers"),
            HeaderTemplate = Truncate(Text(metadata, "header-template", "header", "header-text"), 500) ?? options.HeaderTemplate,
            FooterTemplate = Truncate(Text(metadata, "footer-template", "footer", "footer-text"), 500) ?? options.FooterTemplate,
            MarginTop = Text(metadata, "margin-top") ?? options.MarginTop,
            MarginRight = Text(metadata, "margin-right") ?? options.MarginRight,
            MarginBottom = Text(metadata, "margin-bottom") ?? options.MarginBottom,
            MarginLeft = Text(metadata, "margin-left") ?? options.MarginLeft,
            Watermark = Truncate(Text(metadata, "watermark", "watermark-text", "marca-dagua"), 120) ?? options.Watermark,
            Tagged = Boolean(metadata, options.Tagged, "tagged"),
            Outline = Boolean(metadata, options.Outline, "outline"),
            CoverTitle = Text(metadata, "cover-title", "title") ?? options.CoverTitle,
            CoverSubtitle = Text(metadata, "cover-subtitle", "subtitle") ?? options.CoverSubtitle,
            CoverAuthor = Text(metadata, "cover-author", "author") ?? options.CoverAuthor,
            CoverOrganization = Text(metadata, "cover-organization", "organization") ?? options.CoverOrganization,
            CoverVersion = Text(metadata, "cover-version", "version") ?? options.CoverVersion,
            CoverStatus = Text(metadata, "cover-status", "status") ?? options.CoverStatus,
            CoverDescription = Text(metadata, "cover-description", "description", "abstract") ?? options.CoverDescription,
            CoverDate = Text(metadata, "cover-date", "date") ?? options.CoverDate,
            CoverImage = Text(metadata, "cover-image") ?? options.CoverImage,
            PdfAConformance = pdfA,
            PageDecorations = resolvedDecorations
        };
    }

    private static PageDecorationOptions? ParseFrontMatterDecorations(IReadOnlyDictionary<string, object?> metadata)
    {
        object? value = null;
        foreach (var key in new[] { "page-decorations", "pagedecorations", "pageDecorations" })
            if (metadata.TryGetValue(key, out value) && value is not null) break;
        var dictionary = AsDictionary(value);
        PageDecorationOptions? nested = dictionary is null ? null : new PageDecorationOptions(
            Default: ParseTemplate(Get(dictionary, "default")),
            First: ParseTemplate(Get(dictionary, "first")),
            Left: ParseTemplate(Get(dictionary, "left")),
            Right: ParseTemplate(Get(dictionary, "right")),
            Cover: ParseTemplate(Get(dictionary, "cover")),
            Rules: ParseRules(Get(dictionary, "rules")),
            TwoPassPdfComposition: Bool(Get(dictionary, "twoPassPdfComposition", "two-pass-pdf-composition"), false),
            RejectConflicts: Bool(Get(dictionary, "rejectConflicts", "reject-conflicts"), true),
            ValidateReservedMargins: Bool(Get(dictionary, "validateReservedMargins", "validate-reserved-margins"), true),
            ValidateFinalPdfA: Bool(Get(dictionary, "validateFinalPdfA", "validate-final-pdfa"), true),
            PreserveTaggedPdf: Bool(Get(dictionary, "preserveTaggedPdf", "preserve-tagged-pdf"), true),
            AuthoringConflictPolicy: String(Get(dictionary, "authoringConflictPolicy", "authoring-conflict-policy")) ?? "reject");

        var legacyHeader = Text(metadata, "rune-header", "page-header");
        var legacyFooter = Text(metadata, "rune-footer", "page-footer");
        var legacy = legacyHeader is null && legacyFooter is null ? null : new PageDecorationOptions(Default: new PageDecorationTemplate(
            HeaderRegion: legacyHeader is null ? null : new PageDecorationRegion(legacyHeader, DecorationFormat(Text(metadata, "rune-header-format", "page-header-format"))),
            FooterRegion: legacyFooter is null ? null : new PageDecorationRegion(legacyFooter, DecorationFormat(Text(metadata, "rune-footer-format", "page-footer-format")))));
        return MergeDecorations(nested, legacy, "reject");
    }

    private static PageDecorationOptions? ParseFenceDecorations(IReadOnlyDictionary<string, object?> metadata)
    {
        if (!metadata.TryGetValue("rune-decoration-fences", out var raw) || raw is not IEnumerable enumerable) return null;
        PageDecorationTemplate? @default = null, first = null, left = null, right = null, cover = null;
        var rules = new List<PageDecorationRule>();
        var index = 0;
        foreach (var item in enumerable)
        {
            var dictionary = AsDictionary(item);
            if (dictionary is null) continue;
            var regionName = String(Get(dictionary, "region"))?.ToLowerInvariant() ?? throw new ArgumentException("Decoration fence region is missing.");
            var profile = String(Get(dictionary, "profile"))?.ToLowerInvariant() ?? "default";
            var region = ParseRegion(dictionary) ?? throw new ArgumentException("Decoration fence content is missing.");
            var template = regionName switch
            {
                "header" => new PageDecorationTemplate(HeaderRegion: region),
                "footer" => new PageDecorationTemplate(FooterRegion: region),
                _ => throw new ArgumentException($"Unsupported decoration fence region: {regionName}.")
            };
            var selector = ParseFenceSelector(dictionary, profile);
            if (selector is not null)
            {
                var name = String(Get(dictionary, "name")) ?? $"fence-{profile}-{regionName}-{++index:000}";
                rules.Add(new PageDecorationRule(name, selector, template, Int(Get(dictionary, "priority"), 0)));
                continue;
            }
            switch (profile)
            {
                case "default": @default = MergeTemplate(@default, template, "reject", "default"); break;
                case "first": first = MergeTemplate(first, template, "reject", "first"); break;
                case "left": left = MergeTemplate(left, template, "reject", "left"); break;
                case "right": right = MergeTemplate(right, template, "reject", "right"); break;
                case "cover": cover = MergeTemplate(cover, template, "reject", "cover"); break;
                default: throw new ArgumentException($"Unsupported page decoration fence profile '{profile}'.");
            }
        }
        return @default is null && first is null && left is null && right is null && cover is null && rules.Count == 0
            ? null
            : new PageDecorationOptions(@default, first, left, right, cover, rules.Count == 0 ? null : rules, TwoPassPdfComposition: rules.Count > 0);
    }

    private static PageDecorationSelector? ParseFenceSelector(IReadOnlyDictionary<string, object?> dictionary, string profile)
    {
        var pages = ParseIntegers(String(Get(dictionary, "physicalPages", "pages")));
        var ranges = ParseRanges(String(Get(dictionary, "physicalPageRanges", "ranges")));
        var sections = Split(String(Get(dictionary, "namedSections", "sections", "section")));
        var parity = String(Get(dictionary, "parity"))?.ToLowerInvariant() switch
        {
            "left" => PageDecorationParity.Left,
            "right" => PageDecorationParity.Right,
            _ => PageDecorationParity.Any
        };
        var cover = profile == "cover" && (pages.Count > 0 || ranges.Count > 0 || sections.Count > 0 || parity != PageDecorationParity.Any);
        var first = profile == "first" && (pages.Count > 0 || ranges.Count > 0 || sections.Count > 0 || parity != PageDecorationParity.Any);
        if (pages.Count == 0 && ranges.Count == 0 && sections.Count == 0 && parity == PageDecorationParity.Any && !cover && !first) return null;
        return new PageDecorationSelector(pages.Count == 0 ? null : pages, ranges.Count == 0 ? null : ranges,
            sections.Count == 0 ? null : sections, parity, cover, first);
    }

    private static PageDecorationOptions? MergeDecorations(PageDecorationOptions? higher, PageDecorationOptions? lower, string policy)
    {
        if (higher is null) return lower;
        if (lower is null) return higher;
        var rules = (higher.Rules ?? []).Concat(lower.Rules ?? []).ToArray();
        return higher with
        {
            Default = MergeTemplate(higher.Default, lower.Default, policy, "default"),
            First = MergeTemplate(higher.First, lower.First, policy, "first"),
            Left = MergeTemplate(higher.Left, lower.Left, policy, "left"),
            Right = MergeTemplate(higher.Right, lower.Right, policy, "right"),
            Cover = MergeTemplate(higher.Cover, lower.Cover, policy, "cover"),
            Rules = rules.Length == 0 ? null : rules,
            TwoPassPdfComposition = higher.TwoPassPdfComposition || lower.TwoPassPdfComposition
        };
    }

    private static PageDecorationTemplate? MergeTemplate(PageDecorationTemplate? higher, PageDecorationTemplate? lower, string policy, string profile)
    {
        if (higher is null) return lower;
        if (lower is null) return higher;
        var highHeader = Header(higher); var lowHeader = Header(lower);
        var highFooter = Footer(higher); var lowFooter = Footer(lower);
        if (string.Equals(policy, "reject", StringComparison.OrdinalIgnoreCase) &&
            ((highHeader is not null && lowHeader is not null) || (highFooter is not null && lowFooter is not null)))
            throw new ArgumentException($"Page decoration authoring conflict for profile '{profile}'.");
        return new PageDecorationTemplate(HeaderRegion: highHeader ?? lowHeader, FooterRegion: highFooter ?? lowFooter);
    }

    private static PageDecorationTemplate? ParseTemplate(object? value)
    {
        if (value is null) return null;
        if (value is string text) return new PageDecorationTemplate(HeaderRegion: new PageDecorationRegion(text));
        var dictionary = AsDictionary(value) ?? throw new ArgumentException("Page decoration profile must be an object.");
        return new PageDecorationTemplate(
            HeaderRegion: ParseRegion(Get(dictionary, "header")),
            FooterRegion: ParseRegion(Get(dictionary, "footer")));
    }

    private static PageDecorationRegion? ParseRegion(object? value)
    {
        if (value is null) return null;
        if (value is string text) return new PageDecorationRegion(text);
        var dictionary = AsDictionary(value) ?? throw new ArgumentException("Page decoration region must be a string or object.");
        var content = String(Get(dictionary, "content")) ?? throw new ArgumentException("Page decoration region content is required.");
        return new PageDecorationRegion(
            content,
            DecorationFormat(String(Get(dictionary, "format"))),
            Alignment(String(Get(dictionary, "alignment", "align"))),
            Overflow(String(Get(dictionary, "overflow", "overflowPolicy"))),
            Double(Get(dictionary, "minimumScale", "minScale"), 0.8),
            String(Get(dictionary, "maximumHeight", "maxHeight")),
            Split(String(Get(dictionary, "allowedMetadataTokens", "metadataTokens"))),
            Bool(Get(dictionary, "sanitizeSvg"), true),
            String(Get(dictionary, "alternativeText", "alt")));
    }

    private static IReadOnlyList<PageDecorationRule>? ParseRules(object? value)
    {
        var enumerable = Enumerate(value);
        if (enumerable is null) return null;
        var result = new List<PageDecorationRule>();
        foreach (var item in enumerable)
        {
            var dictionary = AsDictionary(item) ?? throw new ArgumentException("Page decoration rules must be objects.");
            var selectorDictionary = AsDictionary(Get(dictionary, "selector")) ?? dictionary;
            var selector = new PageDecorationSelector(
                ParseIntegers(String(Get(selectorDictionary, "physicalPages", "pages"))),
                ParseRanges(String(Get(selectorDictionary, "physicalPageRanges", "ranges"))),
                Split(String(Get(selectorDictionary, "namedSections", "sections"))),
                String(Get(selectorDictionary, "parity"))?.ToLowerInvariant() switch { "left" => PageDecorationParity.Left, "right" => PageDecorationParity.Right, _ => PageDecorationParity.Any },
                Bool(Get(selectorDictionary, "cover"), false),
                Bool(Get(selectorDictionary, "first"), false));
            result.Add(new PageDecorationRule(
                String(Get(dictionary, "name")) ?? throw new ArgumentException("Page decoration rule name is required."),
                selector,
                ParseTemplate(Get(dictionary, "template")) ?? throw new ArgumentException("Page decoration rule template is required."),
                Int(Get(dictionary, "priority"), 0)));
        }
        return result.Count == 0 ? null : result;
    }

    private static IEnumerable? Enumerate(object? value) => value switch
    {
        null or string => null,
        JsonElement { ValueKind: JsonValueKind.Array } element => element.EnumerateArray().Select(item => (object)item.Clone()).ToArray(),
        IEnumerable enumerable => enumerable,
        _ => null
    };

    private static PageDecorationRegion? Header(PageDecorationTemplate template) => template.HeaderRegion ??
        (template.Header is null ? null : new PageDecorationRegion(template.Header, Alignment: template.HeaderAlignment));
    private static PageDecorationRegion? Footer(PageDecorationTemplate template) => template.FooterRegion ??
        (template.Footer is null ? null : new PageDecorationRegion(template.Footer, Alignment: template.FooterAlignment));

    private static IReadOnlyDictionary<string, object?>? AsDictionary(object? value)
    {
        if (value is null) return null;
        if (value is IReadOnlyDictionary<string, object?> readOnly) return readOnly;
        if (value is IDictionary<string, object?> typed) return new Dictionary<string, object?>(typed, StringComparer.OrdinalIgnoreCase);
        if (value is IDictionary dictionary)
        {
            var result = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
            foreach (DictionaryEntry entry in dictionary) result[Convert.ToString(entry.Key, CultureInfo.InvariantCulture) ?? string.Empty] = entry.Value;
            return result;
        }
        if (value is JsonElement element && element.ValueKind == JsonValueKind.Object)
            return element.EnumerateObject().ToDictionary(property => property.Name, property => (object?)property.Value, StringComparer.OrdinalIgnoreCase);
        if (value is string json && json.TrimStart().StartsWith('{'))
        {
            using var document = JsonDocument.Parse(json);
            return document.RootElement.EnumerateObject().ToDictionary(property => property.Name, property => (object?)property.Value.Clone(), StringComparer.OrdinalIgnoreCase);
        }
        return null;
    }

    private static object? Get(IReadOnlyDictionary<string, object?> dictionary, params string[] keys)
    {
        foreach (var key in keys)
            if (dictionary.TryGetValue(key, out var value)) return value;
        return null;
    }

    private static string? Text(IReadOnlyDictionary<string, object?> metadata, params string[] keys)
    {
        foreach (var key in keys)
            if (metadata.TryGetValue(key, out var value) && value is not null && value is not IDictionary && value is not IEnumerable<object>)
                return String(value)?.Trim();
        return null;
    }

    private static string? String(object? value) => value switch
    {
        null => null,
        JsonElement { ValueKind: JsonValueKind.String } element => element.GetString(),
        JsonElement element => element.GetRawText(),
        _ => Convert.ToString(value, CultureInfo.InvariantCulture)
    };
    private static bool Boolean(IReadOnlyDictionary<string, object?> metadata, bool fallback, params string[] keys) => Bool(Text(metadata, keys), fallback);
    private static bool Bool(object? value, bool fallback) => String(value)?.Trim().ToLowerInvariant() switch
    {
        "true" or "yes" or "1" or "on" or "enabled" or "sim" => true,
        "false" or "no" or "0" or "off" or "disabled" or "nao" or "não" => false,
        _ => fallback
    };
    private static int Int(object? value, int fallback) => int.TryParse(String(value), NumberStyles.Integer, CultureInfo.InvariantCulture, out var result) ? result : fallback;
    private static double Double(object? value, double fallback) => double.TryParse(String(value), NumberStyles.Float, CultureInfo.InvariantCulture, out var result) ? result : fallback;
    private static string? Allowed(string? value, HashSet<string> allowed) => value is null ? null : allowed.FirstOrDefault(candidate => candidate.Equals(value, StringComparison.OrdinalIgnoreCase));
    private static PageDecorationContentFormat DecorationFormat(string? value) => value?.ToLowerInvariant() switch
    {
        null or "text" => PageDecorationContentFormat.Text,
        "markdown" or "md" => PageDecorationContentFormat.Markdown,
        "html" => PageDecorationContentFormat.Html,
        _ => throw new ArgumentException($"Unsupported page decoration format: {value}.")
    };
    private static PageDecorationAlignment Alignment(string? value) => value?.ToLowerInvariant() switch
    {
        "left" => PageDecorationAlignment.Left,
        "right" => PageDecorationAlignment.Right,
        _ => PageDecorationAlignment.Center
    };
    private static PageDecorationOverflowPolicy Overflow(string? value) => value?.ToLowerInvariant() switch
    {
        null or "error" => PageDecorationOverflowPolicy.Error,
        "shrink" or "scale" => PageDecorationOverflowPolicy.Scale,
        "clip" => PageDecorationOverflowPolicy.Clip,
        _ => throw new ArgumentException($"Unsupported page decoration overflow policy: {value}.")
    };
    private static List<string> Split(string? value) => string.IsNullOrWhiteSpace(value) ? [] : value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
    private static List<int> ParseIntegers(string? value) => Split(value).Select(item => int.Parse(item, CultureInfo.InvariantCulture)).ToList();
    private static List<PhysicalPageRange> ParseRanges(string? value)
    {
        var result = new List<PhysicalPageRange>();
        foreach (var item in Split(value))
        {
            var parts = item.Split(['-', '.'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (parts.Length != 2) throw new ArgumentException($"Invalid page range '{item}'.");
            result.Add(new PhysicalPageRange(int.Parse(parts[0], CultureInfo.InvariantCulture), int.Parse(parts[^1], CultureInfo.InvariantCulture)));
        }
        return result;
    }
    private static string? Truncate(string? value, int length) => value is null || value.Length <= length ? value : value[..length];
}
