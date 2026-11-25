using System.Globalization;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Markdig;
using Rune.Core;
using Rune.Security;
using Rune.Ownership;
using Rune.ReactFlow;
using YamlDotNet.Serialization;

namespace Rune.Markdown;

public sealed partial class MarkdownDocumentCompiler : IDocumentCompiler
{
    private static readonly string[] RenderableDiagramKinds =
    [
        "reactflow", "react-flow", "xyflow", "flow-json",
        "ownership-chart", "corporate-structure", "shareholding",
        "chart", "echarts", "map", "leaflet", "geojson", "topojson", "stl",
        "schematex", "orgchart"
    ];

    private static readonly string[] SourceOnlyDiagramKinds =
    [
        "plantuml", "graphviz", "dot", "d2", "wavedrom", "vega", "vega-lite", "nomnoml", "bpmn", "structurizr"
    ];

    private readonly MarkdownPipeline _pipeline = new MarkdownPipelineBuilder()
        .UseAdvancedExtensions()
        .UseDefinitionLists()
        .UseYamlFrontMatter()
        .UseEmojiAndSmiley()
        .UseSmartyPants()
        .Build();

    private readonly HtmlContentSanitizer _sanitizer = new();
    private readonly OwnershipDslParser _ownershipParser = new();
    private readonly OfficialSchemaTexAdapter? _schemaTex;

    public MarkdownDocumentCompiler(string? assetRoot = null)
    {
        var resolved = assetRoot ?? Environment.GetEnvironmentVariable("RUNE_ASSET_ROOT") ?? FindAssetRoot();
        if (!string.IsNullOrWhiteSpace(resolved) && Directory.Exists(Path.Combine(resolved, "vendor", "schematex", "package")))
            _schemaTex = new OfficialSchemaTexAdapter(resolved);
    }

    public DocumentSourceType SourceType => DocumentSourceType.Markdown;

    public ValueTask<CompiledDocument> CompileAsync(SourceDocument source, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var compatibility = MarkdownCompatibilityNormalizer.Normalize(source.Content, source.Resources, source.EntryPath);
        var diagnostics = compatibility.Warnings
            .Select(message => new RenderDiagnostic("markdown.compatibility", message, RenderDiagnosticSeverity.Warning))
            .ToList();
        var metadata = new Dictionary<string, object?>(compatibility.Metadata, StringComparer.OrdinalIgnoreCase);
        var decorationSource = ExtractDecorationFences(compatibility.Body, metadata, diagnostics);
        var markdown = ReplaceSpecialFences(decorationSource, diagnostics);
        var html = Markdig.Markdown.ToHtml(markdown, _pipeline);
        html = WrapHighlightedCode(html);
        var sanitized = _sanitizer.Apply(html, source.HtmlTrustMode);
        if (!string.Equals(sanitized, html, StringComparison.Ordinal))
            diagnostics.Add(new("markdown.html-sanitized", "Unsafe raw HTML was removed from Markdown output.", RenderDiagnosticSeverity.Info));
        var renderers = DetectRenderers(sanitized);
        var title = metadata.TryGetValue("title", out var titleValue)
            ? Convert.ToString(titleValue, CultureInfo.InvariantCulture) ?? "RUNE Document"
            : "RUNE Document";
        var model = RuneDocumentModelBuilder.FromCompiled(DocumentSourceType.Markdown, title,
            metadata, sanitized, renderers, diagnostics);
        return ValueTask.FromResult(new CompiledDocument(sanitized, metadata, renderers, diagnostics, DocumentModel: model));
    }


    private static string ExtractDecorationFences(
        string markdown,
        IDictionary<string, object?> metadata,
        ICollection<RenderDiagnostic> diagnostics)
    {
        var fences = metadata.TryGetValue("rune-decoration-fences", out var existing) && existing is List<Dictionary<string, object?>> list
            ? list
            : [];
        var result = DecorationFenceRegex().Replace(markdown, match =>
        {
            var attributes = ParseDecorationAttributes(match.Groups["attrs"].Value);
            var region = match.Groups["region"].Value.ToLowerInvariant();
            var format = attributes.Remove("format", out var declaredFormat) ? declaredFormat :
                attributes.Remove("bare-format", out var bareFormat) ? bareFormat : "markdown";
            var profile = attributes.Remove("profile", out var declaredProfile) ? declaredProfile : "default";
            var fence = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
            {
                ["region"] = region,
                ["profile"] = profile,
                ["format"] = format,
                ["content"] = match.Groups["body"].Value.Trim()
            };
            foreach (var pair in attributes) fence[pair.Key] = pair.Value;
            fences.Add(fence);
            diagnostics.Add(new RenderDiagnostic("page-decoration-authoring", $"Compiled rune-{region} profile '{profile}' ({format}) into the canonical page decoration model.", RenderDiagnosticSeverity.Info));
            return string.Empty;
        });
        if (fences.Count > 0) metadata["rune-decoration-fences"] = fences;
        return result;
    }

    private static Dictionary<string, string> ParseDecorationAttributes(string value)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var text = value.Trim();
        if (text.Length == 0) return result;
        var bare = Regex.Match(text, "^(text|markdown|html)(?:\\s|$)", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
        if (bare.Success)
        {
            result["bare-format"] = bare.Groups[1].Value.ToLowerInvariant();
            text = text[bare.Length..].Trim();
        }
        foreach (Match match in Regex.Matches(text, "(?<key>[A-Za-z][A-Za-z0-9-]*)\\s*=\\s*(?:\"(?<quoted>[^\"]*)\"|'(?<single>[^']*)'|(?<bare>[^\\s]+))", RegexOptions.CultureInvariant))
        {
            var key = match.Groups["key"].Value.Replace("-", string.Empty, StringComparison.Ordinal).ToLowerInvariant();
            var normalizedKey = key switch
            {
                "maxheight" => "maximumHeight",
                "minscale" => "minimumScale",
                "pages" => "physicalPages",
                "pageranges" or "ranges" => "physicalPageRanges",
                "section" or "sections" => "namedSections",
                _ => match.Groups["key"].Value
            };
            result[normalizedKey] = match.Groups["quoted"].Success ? match.Groups["quoted"].Value :
                match.Groups["single"].Success ? match.Groups["single"].Value : match.Groups["bare"].Value;
        }
        return result;
    }

    private string ReplaceSpecialFences(string markdown, List<RenderDiagnostic> diagnostics)
    {
        var diagramIndex = 0;
        return FenceRegex().Replace(markdown, match =>
        {
            var kind = match.Groups[1].Value.ToLowerInvariant();
            var options = match.Groups[2].Value.Trim();
            var content = match.Groups[3].Value.Trim();
            var encoded = WebUtility.HtmlEncode(content);
            var sourceBase64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(content));

            if (kind == "mermaid")
                return $"\n<div class=\"mermaid rune-async\" data-kind=\"mermaid\" data-render-state=\"pending\">{encoded}</div>\n";
            if (kind is "math" or "katex")
                return $"\n<div class=\"rune-math rune-async\" data-display=\"true\" data-render-state=\"pending\">{encoded}</div>\n";
            if (kind.EndsWith("-table", StringComparison.Ordinal))
                return BuildDataTable(kind[..^6], content, options, diagnostics);
            if (SourceOnlyDiagramKinds.Contains(kind, StringComparer.OrdinalIgnoreCase))
                return $"\n<div class=\"static-diagram diagram-{kind} diagram-source-only\" data-diagram-type=\"{kind}\" data-render-state=\"ready\"><pre>{encoded}</pre></div>\n";
            if (!RenderableDiagramKinds.Contains(kind, StringComparer.OrdinalIgnoreCase))
                return match.Value;

            if (kind is "schematex" or "orgchart")
            {
                if (_schemaTex is null) throw new InvalidOperationException("Official SchemaTex runtime is unavailable.");
                var officialSource = kind == "orgchart" && !content.TrimStart().StartsWith("orgchart", StringComparison.OrdinalIgnoreCase)
                    ? $"orgchart \"Organization\"\n{content}"
                    : content;
                var result = _schemaTex.Render(officialSource);
                diagnostics.AddRange(result.Diagnostics);
                var cssClass = kind == "orgchart" ? "schematex schematex-orgchart diagram-rendered" : "schematex diagram-rendered";
                return $"\n<figure class=\"{cssClass}\" data-kind=\"{kind}\" data-render-state=\"ready\" data-schematex-type=\"{WebUtility.HtmlEncode(result.Type ?? kind)}\" data-schematex-version=\"{OfficialSchemaTexAdapter.PackageVersion}\">{result.Svg}</figure>\n";
            }

            if (kind is "reactflow" or "react-flow" or "xyflow" or "flow-json")
            {
                var parsed = ReactFlowDocumentParser.Parse(content);
                foreach (var diagnostic in parsed.Diagnostics)
                {
                    diagnostics.Add(new RenderDiagnostic(
                        $"reactflow.{diagnostic.Code.ToLowerInvariant().Replace('_', '-')}",
                        diagnostic.Message,
                        diagnostic.Severity.Equals("error", StringComparison.OrdinalIgnoreCase)
                            ? RenderDiagnosticSeverity.Error
                            : diagnostic.Severity.Equals("warning", StringComparison.OrdinalIgnoreCase)
                                ? RenderDiagnosticSeverity.Warning
                                : RenderDiagnosticSeverity.Info));
                }
                return "\n" + ReactFlowDocumentParser.RenderFenceHtml(content, parsed) + "\n";
            }

            var canonical = kind switch
            {
                "corporate-structure" or "shareholding" => "ownership-chart",
                "echarts" => "chart",
                "map" or "leaflet" => "geojson",
                "orgchart" => "orgchart",
                _ => kind
            };
            var index = diagramIndex++;
            var classes = canonical switch
            {
                "ownership-chart" => "ownership-chart rune-async",
                "schematex" => "schematex rune-async",
                "orgchart" => "schematex schematex-orgchart rune-async",
                "geojson" => "static-diagram diagram-geojson rune-async",
                "topojson" => "static-diagram diagram-topojson rune-async",
                "stl" => "static-diagram diagram-stl rune-async",
                "chart" => "static-diagram diagram-chart rune-async",
                _ => "rune-async"
            };
            var payloadAttributes = string.Empty;
            if (canonical == "ownership-chart")
            {
                var parsed = _ownershipParser.Parse(content);
                foreach (var diagnostic in parsed.Errors.Concat(parsed.Warnings))
                {
                    diagnostics.Add(new RenderDiagnostic(
                        diagnostic.Code,
                        diagnostic.Message,
                        diagnostic.Severity.Equals("error", StringComparison.OrdinalIgnoreCase)
                            ? RenderDiagnosticSeverity.Error
                            : diagnostic.Severity.Equals("warning", StringComparison.OrdinalIgnoreCase)
                                ? RenderDiagnosticSeverity.Warning
                                : RenderDiagnosticSeverity.Info,
                        diagnostic.Location.Line,
                        diagnostic.Location.Column,
                        diagnostic.RelatedEntityIds));
                }
                var payloadJson = JsonSerializer.Serialize(parsed, new JsonSerializerOptions(JsonSerializerDefaults.Web));
                var payloadBase64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(payloadJson));
                payloadAttributes = $" data-ownership-payload=\"{payloadBase64}\"";
            }
            return $"\n<rune-diagram class=\"{classes}\" data-kind=\"{canonical}\" data-instance=\"{index}\" data-source-base64=\"{sourceBase64}\"{payloadAttributes} data-render-state=\"pending\"><pre class=\"diagram-source\">{encoded}</pre></rune-diagram>\n";
        });
    }

    private static string BuildDataTable(
        string kind,
        string source,
        string optionText,
        List<RenderDiagnostic> diagnostics)
    {
        try
        {
            var (headers, rows) = kind switch
            {
                "csv" => ParseDelimited(source, ','),
                "tsv" => ParseDelimited(source, '\t'),
                "json" => ParseJsonTable(source),
                "yaml" => ParseYamlTable(source),
                _ => throw new InvalidDataException($"Unsupported data table kind: {kind}.")
            };
            if (headers.Count > 50 || rows.Count > 1_000)
                throw new InvalidDataException("Data tables are limited to 50 columns and 1,000 rows.");
            var title = Regex.Match(optionText, "title=[\"'](.*?)[\"']", RegexOptions.IgnoreCase).Groups[1].Value;
            var caption = string.IsNullOrWhiteSpace(title) ? string.Empty : $"<caption>{WebUtility.HtmlEncode(title)}</caption>";
            var head = string.Concat(headers.Select(value => $"<th scope=\"col\">{WebUtility.HtmlEncode(value)}</th>"));
            var body = string.Concat(rows.Select(row => "<tr>" + string.Concat(headers.Select((_, index) =>
                $"<td>{WebUtility.HtmlEncode(index < row.Count ? row[index] : string.Empty)}</td>")) + "</tr>"));
            return $"\n<div class=\"data-table-wrapper\"><table class=\"data-table data-table-{kind}\">{caption}<thead><tr>{head}</tr></thead><tbody>{body}</tbody></table></div>\n";
        }
        catch (Exception exception)
        {
            diagnostics.Add(new($"table.{kind}.invalid", exception.Message, RenderDiagnosticSeverity.Error));
            return $"\n<div class=\"data-table-error\" role=\"alert\"><strong>Invalid {kind} table: {WebUtility.HtmlEncode(exception.Message)}</strong><pre>{WebUtility.HtmlEncode(source)}</pre></div>\n";
        }
    }

    private static (List<string> Headers, List<List<string>> Rows) ParseDelimited(string source, char delimiter)
    {
        var parsed = source.Replace("\r\n", "\n", StringComparison.Ordinal)
            .Split('\n', StringSplitOptions.RemoveEmptyEntries)
            .Select(line => ParseDelimitedLine(line, delimiter))
            .ToList();
        if (parsed.Count == 0) throw new InvalidDataException("The table does not contain rows.");
        return (parsed[0], parsed.Skip(1).ToList());
    }

    private static List<string> ParseDelimitedLine(string line, char delimiter)
    {
        var result = new List<string>();
        var value = new StringBuilder();
        var quoted = false;
        for (var index = 0; index < line.Length; index++)
        {
            var character = line[index];
            if (character == '"')
            {
                if (quoted && index + 1 < line.Length && line[index + 1] == '"') { value.Append('"'); index++; }
                else quoted = !quoted;
            }
            else if (character == delimiter && !quoted) { result.Add(value.ToString()); value.Clear(); }
            else value.Append(character);
        }
        result.Add(value.ToString());
        return result;
    }

    private static (List<string> Headers, List<List<string>> Rows) ParseJsonTable(string source)
    {
        using var document = JsonDocument.Parse(source);
        return ParseStructuredTable(document.RootElement);
    }

    private static (List<string> Headers, List<List<string>> Rows) ParseYamlTable(string source)
    {
        var value = new DeserializerBuilder().Build().Deserialize<object>(source);
        var json = JsonSerializer.Serialize(value);
        using var document = JsonDocument.Parse(json);
        return ParseStructuredTable(document.RootElement);
    }

    private static (List<string> Headers, List<List<string>> Rows) ParseStructuredTable(JsonElement root)
    {
        if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("rows", out var rowsProperty)) root = rowsProperty;
        else if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("data", out var dataProperty)) root = dataProperty;

        if (root.ValueKind == JsonValueKind.Object)
        {
            var headers = new List<string> { "Key", "Value" };
            var rows = root.EnumerateObject().Select(property => new List<string> { property.Name, JsonValue(property.Value) }).ToList();
            return (headers, rows);
        }
        if (root.ValueKind != JsonValueKind.Array) throw new InvalidDataException("Expected an object or array.");
        var elements = root.EnumerateArray().ToList();
        if (elements.Count == 0) throw new InvalidDataException("The table does not contain rows.");
        if (elements.All(item => item.ValueKind == JsonValueKind.Object))
        {
            var headers = elements.SelectMany(item => item.EnumerateObject().Select(property => property.Name)).Distinct(StringComparer.Ordinal).ToList();
            var rows = elements.Select(item =>
            {
                var values = item.EnumerateObject().ToDictionary(property => property.Name, property => JsonValue(property.Value), StringComparer.Ordinal);
                return headers.Select(header => values.TryGetValue(header, out var value) ? value : string.Empty).ToList();
            }).ToList();
            return (headers, rows);
        }
        if (elements.All(item => item.ValueKind == JsonValueKind.Array))
        {
            var matrix = elements.Select(item => item.EnumerateArray().Select(JsonValue).ToList()).ToList();
            return (matrix[0], matrix.Skip(1).ToList());
        }
        throw new InvalidDataException("Expected an array of objects or an array of arrays.");
    }

    private static string JsonValue(JsonElement value) => value.ValueKind == JsonValueKind.String
        ? value.GetString() ?? string.Empty
        : value.GetRawText();

    private static string WrapHighlightedCode(string html) => CodeBlockRegex().Replace(html, match =>
        $"<div class=\"highlight\"><pre><code class=\"language-{match.Groups[1].Value}\">{match.Groups[2].Value}</code></pre></div>");

    private static HashSet<string> DetectRenderers(string html)
    {
        var result = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (html.Contains("class=\"mermaid", StringComparison.Ordinal)) result.Add("mermaid");
        if (html.Contains("rune-math", StringComparison.Ordinal)) result.Add("katex");
        if (html.Contains("data-reactflow-payload=", StringComparison.Ordinal)) result.Add("reactflow");
        foreach (Match match in DiagramKindRegex().Matches(html))
        {
            var kind = match.Groups[1].Value;
            if (kind is "schematex" or "orgchart") continue;
            result.Add(kind);
        }
        return result;
    }

    private static string? FindAssetRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, "services", "rune", "assets");
            if (Directory.Exists(candidate)) return candidate;
            candidate = Path.Combine(current.FullName, "assets");
            if (Directory.Exists(candidate)) return candidate;
            current = current.Parent;
        }
        return null;
    }

    [GeneratedRegex("(?ms)^```rune-(?<region>header|footer)(?<attrs>[^\\n]*)\\n(?<body>.*?)^```\\s*$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex DecorationFenceRegex();

    [GeneratedRegex("(?ms)^```([A-Za-z0-9_-]+)([^\\n]*)\\n(.*?)^```\\s*$")]
    private static partial Regex FenceRegex();

    [GeneratedRegex("(?s)<pre><code class=\"language-([^\"]+)\">(.*?)</code></pre>")]
    private static partial Regex CodeBlockRegex();

    [GeneratedRegex("data-kind=\"([^\"]+)\"")]
    private static partial Regex DiagramKindRegex();
}
