using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using YamlDotNet.Serialization;

namespace Rune.Markdown;

internal sealed record MarkdownCompatibilityResult(
    string Body,
    IReadOnlyDictionary<string, object?> Metadata,
    IReadOnlyList<string> Warnings);

internal static partial class MarkdownCompatibilityNormalizer
{
    private const int MaximumIncludeDepth = 5;
    private const int MaximumIncludedCharacters = 5_000_000;

    private static readonly IReadOnlyDictionary<string, string> CalloutTypes =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["note"] = "note", ["abstract"] = "abstract", ["summary"] = "abstract", ["tldr"] = "abstract",
            ["info"] = "info", ["todo"] = "todo", ["tip"] = "tip", ["hint"] = "tip",
            ["important"] = "important", ["success"] = "success", ["check"] = "success", ["done"] = "success",
            ["question"] = "question", ["help"] = "question", ["faq"] = "question",
            ["warning"] = "warning", ["caution"] = "caution", ["attention"] = "warning",
            ["failure"] = "failure", ["fail"] = "failure", ["missing"] = "failure",
            ["danger"] = "danger", ["error"] = "danger", ["bug"] = "bug", ["example"] = "example",
            ["quote"] = "quote", ["cite"] = "quote"
        };

    public static MarkdownCompatibilityResult Normalize(
        string source,
        IReadOnlyDictionary<string, string>? resources,
        string entryPath = "document.md")
    {
        var warnings = new List<string>();
        var (body, metadata) = ExtractFrontMatter(source, warnings);
        var normalizedResources = resources?.ToDictionary(
            pair => NormalizeResourcePath(pair.Key), pair => pair.Value, StringComparer.OrdinalIgnoreCase);
        body = ExpandIncludes(body, normalizedResources, warnings, 0,
            new HashSet<string>(StringComparer.OrdinalIgnoreCase), NormalizeResourcePath(entryPath));
        body = NormalizeConditionalContent(body);
        body = NormalizeCallouts(body);
        body = NormalizeTabs(body);
        body = NormalizeFencedDivs(body);
        body = NormalizeDefinitionLists(body);
        body = NormalizeFancyLists(body);
        body = NormalizeProgressBars(body);
        body = NormalizeCriticMarkup(body);
        body = NormalizeSmartSymbols(body);
        body = NormalizeWikiLinks(body);
        body = NormalizeInlineFootnotes(body);
        body = NormalizeGitHubReferences(body, metadata);
        body = NormalizeKeyboardKeys(body);
        body = NormalizePageBreaks(body);
        body = NormalizeMath(body);
        return new(body, metadata, warnings);
    }

    private static (string Body, IReadOnlyDictionary<string, object?> Metadata) ExtractFrontMatter(
        string source,
        List<string> warnings)
    {
        var text = source.TrimStart('\uFEFF');
        var yaml = Regex.Match(text, "\\A---\\s*\\r?\\n(.*?)\\r?\\n---\\s*(?:\\r?\\n|\\z)", RegexOptions.Singleline);
        if (yaml.Success)
            return (text[yaml.Length..], ParseYaml(yaml.Groups[1].Value, warnings));

        var toml = Regex.Match(text, "\\A\\+\\+\\+\\s*\\r?\\n(.*?)\\r?\\n\\+\\+\\+\\s*(?:\\r?\\n|\\z)", RegexOptions.Singleline);
        if (toml.Success)
            return (text[toml.Length..], ParseSimpleMetadata(toml.Groups[1].Value, '=', warnings, "TOML"));

        var json = Regex.Match(text, "\\A;;;json\\s*\\r?\\n(.*?)\\r?\\n;;;\\s*(?:\\r?\\n|\\z)", RegexOptions.Singleline | RegexOptions.IgnoreCase);
        if (json.Success)
        {
            try
            {
                using var document = JsonDocument.Parse(json.Groups[1].Value);
                if (document.RootElement.ValueKind != JsonValueKind.Object)
                    throw new JsonException("The root value must be an object.");
                return (text[json.Length..], JsonObjectToDictionary(document.RootElement));
            }
            catch (Exception exception)
            {
                warnings.Add($"Invalid JSON front matter: {exception.Message}");
                return (text[json.Length..], new Dictionary<string, object?>());
            }
        }

        var lines = text.Replace("\r\n", "\n", StringComparison.Ordinal).Split('\n');
        var metadata = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        var consumed = 0;
        for (var index = 0; index < lines.Length; index++)
        {
            if (string.IsNullOrWhiteSpace(lines[index]))
            {
                if (metadata.Count > 0) consumed = index + 1;
                break;
            }
            var match = Regex.Match(lines[index], "^([A-Za-z][A-Za-z0-9 _.-]{0,80}):\\s*(.*)$");
            if (!match.Success)
            {
                metadata.Clear();
                break;
            }
            metadata[NormalizeMetadataKey(match.Groups[1].Value)] = match.Groups[2].Value.Trim();
        }
        return metadata.Count > 0 && consumed > 0
            ? (string.Join('\n', lines[consumed..]), metadata)
            : (text, metadata);
    }

    private static IReadOnlyDictionary<string, object?> ParseYaml(string payload, List<string> warnings)
    {
        try
        {
            var parsed = new DeserializerBuilder().Build().Deserialize<Dictionary<string, object?>>(payload);
            return NormalizeMetadata(parsed ?? new Dictionary<string, object?>());
        }
        catch (Exception exception)
        {
            warnings.Add($"Invalid YAML front matter: {exception.Message}");
            return new Dictionary<string, object?>();
        }
    }

    private static IReadOnlyDictionary<string, object?> ParseSimpleMetadata(
        string payload,
        char separator,
        List<string> warnings,
        string format)
    {
        var result = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        foreach (var rawLine in payload.Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries))
        {
            var line = rawLine.Trim();
            if (line.Length == 0 || line.StartsWith('#')) continue;
            var index = line.IndexOf(separator);
            if (index <= 0)
            {
                warnings.Add($"Unsupported {format} front matter line: {line}");
                continue;
            }
            var key = NormalizeMetadataKey(line[..index]);
            result[key] = ParseScalar(line[(index + 1)..]);
        }
        return result;
    }

    private static IReadOnlyDictionary<string, object?> NormalizeMetadata(IReadOnlyDictionary<string, object?> source) =>
        source.ToDictionary(pair => NormalizeMetadataKey(pair.Key), pair => pair.Value, StringComparer.OrdinalIgnoreCase);

    private static string NormalizeMetadataKey(string value) => value.Trim().ToLowerInvariant().Replace(' ', '-');

    private static object? ParseScalar(string value)
    {
        var text = value.Trim().Trim('"', '\'');
        if (bool.TryParse(text, out var boolean)) return boolean;
        if (long.TryParse(text, out var integer)) return integer;
        if (double.TryParse(text, System.Globalization.CultureInfo.InvariantCulture, out var number)) return number;
        return text;
    }

    private static Dictionary<string, object?> JsonObjectToDictionary(JsonElement element)
    {
        var result = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        foreach (var property in element.EnumerateObject())
            result[NormalizeMetadataKey(property.Name)] = property.Value.ValueKind switch
            {
                JsonValueKind.String => property.Value.GetString(),
                JsonValueKind.True => true,
                JsonValueKind.False => false,
                JsonValueKind.Number when property.Value.TryGetInt64(out var integer) => integer,
                JsonValueKind.Number => property.Value.GetDouble(),
                JsonValueKind.Null => null,
                _ => property.Value.GetRawText()
            };
        return result;
    }

    private static string ExpandIncludes(
        string source,
        IReadOnlyDictionary<string, string>? resources,
        List<string> warnings,
        int depth,
        HashSet<string> active,
        string currentPath)
    {
        if (resources is null || resources.Count == 0) return source;
        if (depth >= MaximumIncludeDepth)
        {
            warnings.Add($"Include depth limit ({MaximumIncludeDepth}) reached.");
            return source;
        }

        var includedCharacters = 0;
        return IncludeLineRegex().Replace(source, match =>
        {
            var targetExpression = match.Groups["target"].Value.Trim().Trim('"', '\'');
            var options = match.Groups["options"].Value;
            var selector = ParseIncludeSelector(targetExpression, options);
            var relativeDirectory = Path.GetDirectoryName(currentPath)?.Replace('\\', '/') ?? string.Empty;
            var target = NormalizeResourcePath(Path.Combine(relativeDirectory, selector.Path).Replace('\\', '/'));
            if (selector.Path.Contains("..", StringComparison.Ordinal) || Path.IsPathRooted(selector.Path) || target.StartsWith("../", StringComparison.Ordinal))
            {
                warnings.Add($"Unsafe include path rejected: {selector.Path}");
                return $"> Include rejected: `{selector.Path}`";
            }
            if (!resources.TryGetValue(target, out var content) && !resources.TryGetValue(NormalizeResourcePath(selector.Path), out content))
            {
                warnings.Add($"Include resource not supplied: {target}");
                return $"> Missing resource: `{target}`";
            }
            if (!active.Add(target))
            {
                warnings.Add($"Include cycle detected: {target}");
                return $"> Include cycle: `{target}`";
            }
            var selected = ApplyIncludeSelector(content, selector, warnings, target);
            includedCharacters += selected.Length;
            if (includedCharacters > MaximumIncludedCharacters)
            {
                active.Remove(target);
                warnings.Add("Included content exceeded the configured size limit.");
                return "> Include size limit exceeded.";
            }
            var expanded = ExpandIncludes(selected, resources, warnings, depth + 1, active, target);
            active.Remove(target);
            return $"\n{expanded}\n";
        });
    }

    private sealed record IncludeSelector(string Path, int? StartLine, int? EndLine, string? Heading, string? BlockId);

    private static IncludeSelector ParseIncludeSelector(string targetExpression, string options)
    {
        var path = targetExpression.Trim();
        int? start = null;
        int? end = null;
        string? heading = null;
        string? blockId = null;

        var lineSuffix = Regex.Match(path, @"::lines?=(\d+)(?:\.\.|-)(\d+)$", RegexOptions.IgnoreCase);
        if (!lineSuffix.Success) lineSuffix = Regex.Match(options, @"lines?\s*=\s*(\d+)(?:\.\.|-)(\d+)", RegexOptions.IgnoreCase);
        if (lineSuffix.Success)
        {
            start = int.Parse(lineSuffix.Groups[1].Value, System.Globalization.CultureInfo.InvariantCulture);
            end = int.Parse(lineSuffix.Groups[2].Value, System.Globalization.CultureInfo.InvariantCulture);
            path = Regex.Replace(path, @"::lines?=\d+(?:\.\.|-)\d+$", string.Empty, RegexOptions.IgnoreCase);
        }
        var fragmentIndex = path.IndexOf('#');
        if (fragmentIndex >= 0)
        {
            var fragment = path[(fragmentIndex + 1)..].Trim();
            path = path[..fragmentIndex];
            if (fragment.StartsWith('^')) blockId = fragment[1..];
            else heading = fragment;
        }
        return new(path.Trim(), start, end, heading, blockId);
    }

    private static string ApplyIncludeSelector(string content, IncludeSelector selector, List<string> warnings, string target)
    {
        var normalized = content.Replace("\r\n", "\n", StringComparison.Ordinal);
        var lines = normalized.Split('\n');
        if (selector.StartLine is not null)
        {
            var start = Math.Clamp(selector.StartLine.Value, 1, Math.Max(1, lines.Length));
            var end = Math.Clamp(selector.EndLine ?? start, start, Math.Max(start, lines.Length));
            return string.Join('\n', lines[(start - 1)..end]);
        }
        if (!string.IsNullOrWhiteSpace(selector.BlockId))
        {
            var marker = $"^{selector.BlockId}";
            var index = Array.FindIndex(lines, line => line.TrimEnd().EndsWith(marker, StringComparison.Ordinal));
            if (index < 0)
            {
                warnings.Add($"Include block id not found in {target}: {selector.BlockId}");
                return string.Empty;
            }
            var selected = lines[index].Replace(marker, string.Empty, StringComparison.Ordinal).TrimEnd();
            return selected;
        }
        if (!string.IsNullOrWhiteSpace(selector.Heading))
        {
            var expected = Slugify(selector.Heading);
            var start = -1;
            var level = 0;
            for (var index = 0; index < lines.Length; index++)
            {
                var match = Regex.Match(lines[index], @"^(#{1,6})\s+(.+?)\s*#*\s*$");
                if (!match.Success || !Slugify(match.Groups[2].Value).Equals(expected, StringComparison.OrdinalIgnoreCase)) continue;
                start = index; level = match.Groups[1].Value.Length; break;
            }
            if (start < 0)
            {
                warnings.Add($"Include heading not found in {target}: {selector.Heading}");
                return string.Empty;
            }
            var end = lines.Length;
            for (var index = start + 1; index < lines.Length; index++)
            {
                var match = Regex.Match(lines[index], @"^(#{1,6})\s+");
                if (match.Success && match.Groups[1].Value.Length <= level) { end = index; break; }
            }
            return string.Join('\n', lines[start..end]);
        }
        return normalized;
    }

    private static string NormalizeResourcePath(string path)
    {
        var segments = new List<string>();
        foreach (var segment in path.Replace('\\', '/').Split('/', StringSplitOptions.RemoveEmptyEntries))
        {
            if (segment == ".") continue;
            if (segment == "..") { if (segments.Count > 0) segments.RemoveAt(segments.Count - 1); else segments.Add(".."); }
            else segments.Add(segment);
        }
        return string.Join('/', segments);
    }

    private static string NormalizeConditionalContent(string source)
    {
        source = Regex.Replace(source, "<!--\\s*html-only\\s*-->(.*?)<!--\\s*/html-only\\s*-->",
            "<div class=\"rune-html-only\">$1</div>", RegexOptions.Singleline | RegexOptions.IgnoreCase);
        source = Regex.Replace(source, "<!--\\s*pdf-only\\s*-->(.*?)<!--\\s*/pdf-only\\s*-->",
            "<div class=\"rune-pdf-only\">$1</div>", RegexOptions.Singleline | RegexOptions.IgnoreCase);
        return Regex.Replace(source, "{%\\s*comment\\s*%}.*?{%\\s*endcomment\\s*%}", string.Empty,
            RegexOptions.Singleline | RegexOptions.IgnoreCase);
    }

    private static string NormalizeCallouts(string source)
    {
        var lines = source.Replace("\r\n", "\n", StringComparison.Ordinal).Split('\n');
        var output = new List<string>();
        for (var index = 0; index < lines.Length; index++)
        {
            var obsidian = Regex.Match(lines[index], "^(\\s*)>\\s*\\[!([A-Za-z0-9_-]+)\\]([+-])?\\s*(.*)$");
            if (obsidian.Success)
            {
                var content = new List<string>();
                while (index + 1 < lines.Length)
                {
                    var quoted = Regex.Match(lines[index + 1], $"^{Regex.Escape(obsidian.Groups[1].Value)}>\\s?(.*)$");
                    if (!quoted.Success) break;
                    content.Add(quoted.Groups[1].Value);
                    index++;
                }
                output.Add(BuildCallout(obsidian.Groups[2].Value, obsidian.Groups[4].Value, content, obsidian.Groups[3].Value));
                continue;
            }

            var mkdocs = Regex.Match(lines[index], "^(\\s*)(!{3}|\\?{3}\\+?)\\s+([A-Za-z0-9_-]+)(?:\\s+[\"'](.*?)[\"'])?\\s*$");
            if (mkdocs.Success)
            {
                var content = new List<string>();
                var indent = mkdocs.Groups[1].Value.Length;
                while (index + 1 < lines.Length)
                {
                    var next = lines[index + 1];
                    if (string.IsNullOrWhiteSpace(next)) { content.Add(string.Empty); index++; continue; }
                    var leading = next.Length - next.TrimStart().Length;
                    if (leading <= indent) break;
                    content.Add(next.TrimStart());
                    index++;
                }
                output.Add(BuildCallout(mkdocs.Groups[3].Value, mkdocs.Groups[4].Value, content, mkdocs.Groups[2].Value));
                continue;
            }
            output.Add(lines[index]);
        }
        return string.Join('\n', output);
    }

    private static string BuildCallout(string requestedType, string title, IReadOnlyList<string> content, string collapse)
    {
        var type = CalloutTypes.TryGetValue(requestedType, out var normalized) ? normalized : "note";
        var label = string.IsNullOrWhiteSpace(title) ? requestedType.Replace('-', ' ') : title;
        var open = collapse == "-" ? string.Empty : " open";
        var body = string.Join("<br>", content.Select(WebUtility.HtmlEncode));
        return $"<details class=\"admonition {WebUtility.HtmlEncode(type)}\"{open}><summary class=\"admonition-title\">{WebUtility.HtmlEncode(label)}</summary><p>{body}</p></details>";
    }

    private static string NormalizeTabs(string source)
    {
        var lines = source.Replace("\r\n", "\n", StringComparison.Ordinal).Split('\n');
        var output = new List<string>();
        for (var index = 0; index < lines.Length; index++)
        {
            var tab = Regex.Match(lines[index], "^===\\s+[\"'](.+?)[\"']\\s*$");
            if (!tab.Success) { output.Add(lines[index]); continue; }

            var blocks = new List<(string Label, List<string> Content)>();
            while (tab.Success)
            {
                var content = new List<string>();
                while (index + 1 < lines.Length)
                {
                    var next = lines[index + 1];
                    if (Regex.IsMatch(next, "^===\\s+[\"']")) break;
                    if (next.Length > 0 && next.Length - next.TrimStart().Length < 4 && !string.IsNullOrWhiteSpace(next)) break;
                    content.Add(next.Length >= 4 ? next[4..] : string.Empty);
                    index++;
                }
                blocks.Add((tab.Groups[1].Value, content));
                if (index + 1 >= lines.Length || !Regex.IsMatch(lines[index + 1], "^===\\s+[\"']")) break;
                index++;
                tab = Regex.Match(lines[index], "^===\\s+[\"'](.+?)[\"']\\s*$");
            }
            var sections = blocks.Select(block =>
                $"<section class=\"tabbed-block\"><h4>{WebUtility.HtmlEncode(block.Label)}</h4><p>{string.Join("<br>", block.Content.Select(WebUtility.HtmlEncode))}</p></section>");
            output.Add($"<div class=\"tabbed-set\">{string.Concat(sections)}</div>");
        }
        return string.Join('\n', output);
    }

    private static string NormalizeFencedDivs(string source)
    {
        var lines = source.Replace("\r\n", "\n", StringComparison.Ordinal).Split('\n');
        var output = new List<string>();
        var stack = new Stack<string>();
        foreach (var line in lines)
        {
            var opening = Regex.Match(line, "^(\\s*):::\\s+(.+?)\\s*$");
            if (opening.Success)
            {
                output.Add($"{opening.Groups[1].Value}<div{ParseAttributes(opening.Groups[2].Value)}>");
                stack.Push(opening.Groups[1].Value);
                continue;
            }
            if (stack.Count > 0 && Regex.IsMatch(line, "^\\s*:::\\s*$"))
            {
                output.Add(stack.Pop() + "</div>");
                continue;
            }
            output.Add(line);
        }
        while (stack.TryPop(out var indent)) output.Add(indent + "</div>");
        return string.Join('\n', output);
    }

    private static string ParseAttributes(string spec)
    {
        var text = spec.Trim().Trim('{', '}');
        var classes = new List<string>();
        var attributes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (Match tokenMatch in Regex.Matches(text, "(?:[^\\s\"']+|\"[^\"]*\"|'[^']*')+"))
        {
            var token = tokenMatch.Value;
            if (token.StartsWith('.') && token.Length > 1) classes.Add(token[1..]);
            else if (token.StartsWith('#') && token.Length > 1) attributes["id"] = token[1..];
            else if (token.Contains('='))
            {
                var split = token.Split('=', 2);
                var key = split[0].Trim();
                if (new[] { "id", "class", "lang", "dir", "title", "role", "aria-label", "aria-describedby" }.Contains(key, StringComparer.OrdinalIgnoreCase))
                    attributes[key] = split[1].Trim().Trim('"', '\'');
            }
            else if (Regex.IsMatch(token, "^[A-Za-z][A-Za-z0-9_-]*$")) classes.Add(token);
        }
        if (classes.Count > 0) attributes["class"] = string.Join(' ', classes);
        return string.Concat(attributes.Select(pair => $" {WebUtility.HtmlEncode(pair.Key)}=\"{WebUtility.HtmlEncode(pair.Value)}\""));
    }

    private static string NormalizeDefinitionLists(string source)
    {
        var lines = source.Replace("\r\n", "\n", StringComparison.Ordinal).Split('\n');
        var output = new List<string>();
        char? fenceCharacter = null;
        var fenceLength = 0;
        for (var index = 0; index < lines.Length; index++)
        {
            var line = lines[index];
            var fence = Regex.Match(line, "^\\s*(`{3,}|~{3,})");
            if (fence.Success)
            {
                var token = fence.Groups[1].Value;
                if (fenceCharacter is null) { fenceCharacter = token[0]; fenceLength = token.Length; }
                else if (fenceCharacter == token[0] && token.Length >= fenceLength) { fenceCharacter = null; fenceLength = 0; }
                output.Add(line);
                continue;
            }

            if (fenceCharacter is null && !string.IsNullOrWhiteSpace(line) && index + 1 < lines.Length &&
                Regex.IsMatch(lines[index + 1], "^\\s*:\\s+.+$"))
            {
                output.Add("<dl>");
                while (index < lines.Length && !string.IsNullOrWhiteSpace(lines[index]) &&
                       index + 1 < lines.Length && Regex.IsMatch(lines[index + 1], "^\\s*:\\s+.+$"))
                {
                    output.Add($"<dt>{WebUtility.HtmlEncode(lines[index].Trim())}</dt>");
                    index++;
                    while (index < lines.Length)
                    {
                        var definition = Regex.Match(lines[index], "^\\s*:\\s+(.+)$");
                        if (!definition.Success) break;
                        output.Add($"<dd>{WebUtility.HtmlEncode(definition.Groups[1].Value.Trim())}</dd>");
                        if (index + 1 >= lines.Length || !Regex.IsMatch(lines[index + 1], "^\\s*:\\s+.+$")) break;
                        index++;
                    }
                    if (index + 2 < lines.Length && string.IsNullOrWhiteSpace(lines[index + 1]) &&
                        !string.IsNullOrWhiteSpace(lines[index + 2]) && index + 3 < lines.Length &&
                        Regex.IsMatch(lines[index + 3], "^\\s*:\\s+.+$"))
                    {
                        index += 2;
                        continue;
                    }
                    break;
                }
                output.Add("</dl>");
                continue;
            }
            output.Add(line);
        }
        return string.Join('\n', output);
    }

    private static string NormalizeFancyLists(string source)
    {
        var counters = new Dictionary<int, int>();
        return MapOutsideFences(source, line =>
        {
            var match = Regex.Match(line, "^(?<indent>\\s*)(?<marker>#\\.|\\d+\\)|[A-Za-z]\\)|[IVXLCDMivxlcdm]+\\))\\s+(?<content>.+)$");
            if (!match.Success) return line;
            var indent = match.Groups["indent"].Value;
            var level = indent.Length;
            counters[level] = counters.TryGetValue(level, out var current) ? current + 1 : 1;
            var marker = match.Groups["marker"].Value;
            var number = marker switch
            {
                "#." => counters[level],
                _ when marker.EndsWith(')') && int.TryParse(marker[..^1], out var parsed) => parsed,
                _ when marker.EndsWith(')') && marker[..^1].Length == 1 && char.IsLetter(marker[0]) => char.ToUpperInvariant(marker[0]) - 'A' + 1,
                _ when marker.EndsWith(')') => ParseRoman(marker[..^1]),
                _ => counters[level]
            };
            return $"{indent}{Math.Max(1, number)}. {match.Groups["content"].Value}";
        });
    }

    private static int ParseRoman(string value)
    {
        var total = 0;
        var previous = 0;
        foreach (var character in value.ToUpperInvariant().Reverse())
        {
            var current = character switch { 'I' => 1, 'V' => 5, 'X' => 10, 'L' => 50, 'C' => 100, 'D' => 500, 'M' => 1000, _ => 0 };
            total += current < previous ? -current : current;
            previous = Math.Max(previous, current);
        }
        return total;
    }

    private static string NormalizeProgressBars(string source) => MapOutsideFences(source, line =>
        Regex.Replace(line, "\\[=(?<value>\\d{1,3})%\\s*(?:[\\\"'](?<label>.*?)[\\\"'])?\\]", match =>
        {
            var value = Math.Clamp(int.Parse(match.Groups["value"].Value, System.Globalization.CultureInfo.InvariantCulture), 0, 100);
            var label = match.Groups["label"].Success ? match.Groups["label"].Value : $"{value}%";
            return $"<span class=\"progress-label\">{WebUtility.HtmlEncode(label)}</span><progress class=\"progress\" value=\"{value}\" max=\"100\" aria-label=\"{WebUtility.HtmlEncode(label)}\">{value}%</progress>";
        }));

    private static string NormalizeCriticMarkup(string source) => MapOutsideFences(source, line =>
    {
        line = Regex.Replace(line, "\\{~~(.*?)~>(.*?)~~\\}", match => $"<span class=\"critic substitution\"><del>{WebUtility.HtmlEncode(match.Groups[1].Value)}</del><ins>{WebUtility.HtmlEncode(match.Groups[2].Value)}</ins></span>");
        line = Regex.Replace(line, "\\{\\+\\+(.*?)\\+\\+\\}", match => $"<ins class=\"critic addition\">{WebUtility.HtmlEncode(match.Groups[1].Value)}</ins>");
        line = Regex.Replace(line, "\\{--(.*?)--\\}", match => $"<del class=\"critic deletion\">{WebUtility.HtmlEncode(match.Groups[1].Value)}</del>");
        line = Regex.Replace(line, "\\{==(.*?)==\\}", match => $"<mark class=\"critic highlight\">{WebUtility.HtmlEncode(match.Groups[1].Value)}</mark>");
        return Regex.Replace(line, "\\{>>(.*?)<<\\}", match => $"<span class=\"critic comment\" role=\"note\">{WebUtility.HtmlEncode(match.Groups[1].Value)}</span>");
    });

    private static string NormalizeSmartSymbols(string source) => MapOutsideFences(source, line =>
    {
        var replacements = new (string Source, string Target)[]
        {
            ("(tm)", "™"), ("(c)", "©"), ("(r)", "®"), ("+/-", "±"),
            ("=/=", "≠"), ("<-->", "↔"), ("-->", "→"), ("<--", "←")
        };
        foreach (var (from, to) in replacements) line = line.Replace(from, to, StringComparison.OrdinalIgnoreCase);
        return line;
    });

    private static string NormalizeWikiLinks(string source) => MapOutsideFences(source, line =>
    {
        line = Regex.Replace(line, "!\\[\\[([^]\\n]+)\\]\\]", match =>
        {
            var parts = match.Groups[1].Value.Split('|', 2);
            var target = parts[0].Trim();
            var label = parts.Length == 2 ? parts[1].Trim() : Path.GetFileNameWithoutExtension(target);
            var extension = Path.GetExtension(target).ToLowerInvariant();
            if (new[] { ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".avif" }.Contains(extension))
                return $"![{label}]({target})";
            if (new[] { ".mp3", ".wav", ".ogg", ".m4a", ".flac" }.Contains(extension))
                return $"<audio controls src=\"{WebUtility.HtmlEncode(target)}\">{WebUtility.HtmlEncode(label)}</audio>";
            if (new[] { ".mp4", ".webm", ".ogv", ".mov" }.Contains(extension))
                return $"<video controls src=\"{WebUtility.HtmlEncode(target)}\">{WebUtility.HtmlEncode(label)}</video>";
            return match.Value;
        });
        return Regex.Replace(line, "(?<!!)\\[\\[([^]\\n]+)\\]\\]", match =>
        {
            var parts = match.Groups[1].Value.Split('|', 2);
            var target = parts[0].Trim();
            var label = parts.Length == 2 ? parts[1].Trim() : target.TrimStart('#');
            if (target.StartsWith('#')) return $"[{label}](#{Slugify(target[1..])})";
            var fragmentParts = target.Split('#', 2);
            var href = fragmentParts[0];
            if (!string.IsNullOrEmpty(href) && string.IsNullOrEmpty(Path.GetExtension(href))) href += ".md";
            if (fragmentParts.Length == 2) href += "#" + Slugify(fragmentParts[1].TrimStart('^'));
            return $"[{label}]({href})";
        });
    });

    private static string NormalizeInlineFootnotes(string source)
    {
        var definitions = new List<string>();
        var counter = 0;
        var body = MapOutsideFences(source, line => Regex.Replace(line, "\\^\\[([^]\\n]+)\\]", match =>
        {
            var key = $"inline-{++counter}";
            definitions.Add($"[^{key}]: {match.Groups[1].Value.Trim()}");
            return $"[^{key}]";
        }));
        return definitions.Count == 0 ? body : body + "\n\n" + string.Join('\n', definitions);
    }

    private static string NormalizeGitHubReferences(string source, IReadOnlyDictionary<string, object?> metadata)
    {
        var enabled = metadata.TryGetValue("github-references", out var enabledValue) &&
                      new[] { "true", "yes", "1", "on" }.Contains(Convert.ToString(enabledValue), StringComparer.OrdinalIgnoreCase);
        if (!enabled) return source;
        var repository = metadata.TryGetValue("github-repository", out var repositoryValue)
            ? Convert.ToString(repositoryValue)
            : metadata.TryGetValue("repository", out repositoryValue) ? Convert.ToString(repositoryValue) : null;
        if (string.IsNullOrWhiteSpace(repository) || !Regex.IsMatch(repository, "^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")) return source;
        return MapOutsideFences(source, line =>
        {
            line = Regex.Replace(line, "(?<![\\w/])#(\\d+)\\b", match => $"[#{match.Groups[1].Value}](https://github.com/{repository}/issues/{match.Groups[1].Value})");
            line = Regex.Replace(line, "(?<![\\w/])GH-(\\d+)\\b", match => $"[GH-{match.Groups[1].Value}](https://github.com/{repository}/issues/{match.Groups[1].Value})", RegexOptions.IgnoreCase);
            return Regex.Replace(line, "(?<![\\w@])@([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)\\b", match => $"[@{match.Groups[1].Value}](https://github.com/{match.Groups[1].Value})");
        });
    }

    private static string NormalizeKeyboardKeys(string source) =>
        MapOutsideFences(source, line => Regex.Replace(line, "\\+\\+([^\\n]+?)\\+\\+", match => $"<kbd>{WebUtility.HtmlEncode(match.Groups[1].Value)}</kbd>"));

    private static string NormalizePageBreaks(string source) =>
        MapOutsideFences(source, line => Regex.IsMatch(line.Trim(), "^\\\\(?:pagebreak|newpage)$", RegexOptions.IgnoreCase)
            ? "<div class=\"page-break\" aria-hidden=\"true\"></div>"
            : line);

    private static string NormalizeMath(string source)
    {
        source = Regex.Replace(source, """(?ms)^\$\$\s*\n?(.*?)\n?\$\$\s*$""", match =>
            $"<div class=\"arithmatex rune-math rune-async\" data-display=\"true\" data-render-state=\"pending\">{WebUtility.HtmlEncode(match.Groups[1].Value.Trim())}</div>");
        source = Regex.Replace(source, """(?ms)^\\\[\s*\n?(.*?)\n?\\\]\s*$""", match =>
            $"<div class=\"arithmatex rune-math rune-async\" data-display=\"true\" data-render-state=\"pending\">{WebUtility.HtmlEncode(match.Groups[1].Value.Trim())}</div>");
        return MapOutsideFences(source, line =>
        {
            line = Regex.Replace(line, """\\\((.+?)\\\)""", match =>
                $"<span class=\"arithmatex rune-math rune-async\" data-display=\"false\" data-render-state=\"pending\">{WebUtility.HtmlEncode(match.Groups[1].Value)}</span>");
            return Regex.Replace(line, """(?<!\\)\$(?!\$)(.+?)(?<!\\)\$""", match =>
                $"<span class=\"arithmatex rune-math rune-async\" data-display=\"false\" data-render-state=\"pending\">{WebUtility.HtmlEncode(match.Groups[1].Value)}</span>");
        });
    }

    private static string MapOutsideFences(string source, Func<string, string> transform)
    {
        var output = new List<string>();
        char? fenceCharacter = null;
        var fenceLength = 0;
        foreach (var line in source.Replace("\r\n", "\n", StringComparison.Ordinal).Split('\n'))
        {
            var fence = Regex.Match(line, "^\\s*(`{3,}|~{3,})");
            if (fence.Success)
            {
                var token = fence.Groups[1].Value;
                if (fenceCharacter is null) { fenceCharacter = token[0]; fenceLength = token.Length; }
                else if (fenceCharacter == token[0] && token.Length >= fenceLength) { fenceCharacter = null; fenceLength = 0; }
                output.Add(line);
                continue;
            }
            output.Add(fenceCharacter is null ? TransformOutsideInlineCode(line, transform) : line);
        }
        return string.Join('\n', output);
    }

    private static string TransformOutsideInlineCode(string line, Func<string, string> transform)
    {
        var pieces = Regex.Split(line, "(`+[^`]*`+)");
        for (var index = 0; index < pieces.Length; index += 2) pieces[index] = transform(pieces[index]);
        return string.Concat(pieces);
    }

    private static string Slugify(string value)
    {
        var normalized = value.Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder();
        foreach (var character in normalized)
            if (System.Globalization.CharUnicodeInfo.GetUnicodeCategory(character) != System.Globalization.UnicodeCategory.NonSpacingMark)
                builder.Append(character);
        var slug = Regex.Replace(builder.ToString().ToLowerInvariant(), "[^a-z0-9_-]+", "-").Trim('-');
        return string.IsNullOrWhiteSpace(slug) ? "section" : slug;
    }

    [GeneratedRegex("""(?mi)^\s*(?:--8<--\s*["'](?<target>[^"']+)["']|\{\{include:\s*(?<target>[^}]+)\}\}|\{%\s*(?:include|include_relative)\s+["']?(?<target>[^"'%}]+)["']?\s*%\}|\{\{[<%]\s*include\s+["']?(?<target>[^"'%>}]+)["']?\s*[>%]\}\}|include::(?<target>[^\[]+)\[(?<options>.*?)\]|@import\s+["'](?<target>[^"']+)["'])\s*$""")]
    private static partial Regex IncludeLineRegex();

}
