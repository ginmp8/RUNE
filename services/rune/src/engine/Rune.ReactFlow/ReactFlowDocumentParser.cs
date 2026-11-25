using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Rune.ReactFlow;

public sealed record ReactFlowDiagnostic(
    string Code,
    string Message,
    string Path = "$",
    string Severity = "error",
    string Suggestion = "");

public sealed record ReactFlowParseResult(
    JsonObject? Document,
    IReadOnlyList<ReactFlowDiagnostic> Diagnostics,
    string? OriginalVersion = null,
    string? FinalVersion = null,
    IReadOnlyList<string>? Migrations = null)
{
    public IReadOnlyList<ReactFlowDiagnostic> Errors => Diagnostics.Where(item => item.Severity == "error").ToArray();
    public IReadOnlyList<ReactFlowDiagnostic> Warnings => Diagnostics.Where(item => item.Severity != "error").ToArray();
    public bool Ok => Document is not null && Errors.Count == 0;
}

public static partial class ReactFlowDocumentParser
{
    public const string SupportedSchemaVersion = "1.0";
    public const int MaximumDocumentBytes = 2_000_000;
    public const int MaximumNodes = 5_000;
    public const int MaximumEdges = 20_000;
    public const int MaximumHandlesPerNode = 100;
    public const int MaximumParentDepth = 30;
    public const int MaximumStringLength = 2_000;
    public const int MaximumDataDepth = 20;
    public const int MaximumAttributesPerObject = 200;

    private static readonly HashSet<string> InternalNodeFields = new(StringComparer.Ordinal)
    {
        "dragging", "resizing", "measured", "width", "height", "positionAbsolute",
        "positionAbsoluteX", "positionAbsoluteY", "internals"
    };
    private static readonly HashSet<string> BuiltinNodeTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "default", "input", "output", "group", "note", "metric", "media", "form", "shape",
        "service", "database", "queue", "decision", "risk"
    };
    private static readonly HashSet<string> BuiltinEdgeTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "default", "straight", "step", "smoothstep", "simplebezier", "status", "button",
        "floating", "bidirectional", "temporary"
    };
    private static readonly HashSet<string> Positions = new(StringComparer.OrdinalIgnoreCase)
        { "left", "top", "right", "bottom" };
    private static readonly HashSet<string> Modes = new(StringComparer.OrdinalIgnoreCase)
        { "view", "edit", "present" };
    private static readonly HashSet<string> DangerousKeys = new(StringComparer.Ordinal)
        { "__proto__", "prototype", "constructor" };
    private static readonly HashSet<string> ExecutableKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        "code", "script", "handler", "callback", "function", "jsx", "tsx", "import", "imports",
        "module", "moduleUrl", "componentUrl", "componentURL"
    };
    private static readonly HashSet<string> AllowedSchemes = new(StringComparer.OrdinalIgnoreCase)
        { "mailto", "tel", "data" };

    public static ReactFlowParseResult Parse(string source)
    {
        if (Encoding.UTF8.GetByteCount(source) > MaximumDocumentBytes)
            return Failure("DOCUMENT_LIMIT_EXCEEDED", $"Document exceeds {MaximumDocumentBytes} bytes.");

        JsonObject raw;
        try
        {
            raw = JsonNode.Parse(source, new JsonNodeOptions { PropertyNameCaseInsensitive = false },
                new JsonDocumentOptions { CommentHandling = JsonCommentHandling.Disallow, MaxDepth = MaximumDataDepth + 5 }) as JsonObject
                ?? throw new JsonException("The top-level value must be a JSON object.");
        }
        catch (JsonException exception)
        {
            var path = exception.LineNumber is not null ? $"$:{exception.LineNumber + 1}:{exception.BytePositionInLine + 1}" : "$";
            return Failure("INVALID_JSON", exception.Message, path, "Correct the JSON in the reactflow block.");
        }

        var diagnostics = new List<ReactFlowDiagnostic>();
        WalkPolicy(raw, "$", 0, diagnostics);
        var document = raw.DeepClone().AsObject();
        var originalVersion = String(document["schemaVersion"]);
        var migrations = new List<string>();
        if (originalVersion is "0.1" or "0.9")
        {
            document["schemaVersion"] = SupportedSchemaVersion;
            if (document["elements"] is JsonArray elements && document["nodes"] is null)
            {
                var migratedNodes = new JsonArray();
                var migratedEdges = new JsonArray();
                foreach (var item in elements)
                {
                    if (item is not JsonObject value) continue;
                    (value["source"] is null ? migratedNodes : migratedEdges).Add(value.DeepClone());
                }
                document.Remove("elements");
                document["nodes"] = migratedNodes;
                document["edges"] = migratedEdges;
            }
            migrations.Add($"{originalVersion}->{SupportedSchemaVersion}");
        }
        else if (!string.Equals(originalVersion, SupportedSchemaVersion, StringComparison.Ordinal))
        {
            diagnostics.Add(Error("UNSUPPORTED_SCHEMA_VERSION",
                $"Schema version '{(string.IsNullOrEmpty(originalVersion) ? "missing" : originalVersion)}' is unsupported; expected {SupportedSchemaVersion}.",
                "$.schemaVersion", $"Set schemaVersion to '{SupportedSchemaVersion}'."));
        }

        var nodes = document["nodes"] as JsonArray;
        var edges = document["edges"] as JsonArray;
        if (nodes is null)
        {
            diagnostics.Add(Error("SCHEMA_VALIDATION_ERROR", "nodes must be an array.", "$.nodes"));
            nodes = [];
        }
        if (edges is null)
        {
            diagnostics.Add(Error("SCHEMA_VALIDATION_ERROR", "edges must be an array.", "$.edges"));
            edges = [];
        }
        if (nodes.Count > MaximumNodes) diagnostics.Add(Error("NODE_LIMIT_EXCEEDED", $"Maximum {MaximumNodes} nodes.", "$.nodes"));
        if (edges.Count > MaximumEdges) diagnostics.Add(Error("EDGE_LIMIT_EXCEEDED", $"Maximum {MaximumEdges} edges.", "$.edges"));
        var mode = String(document["mode"]) ?? "view";
        if (!Modes.Contains(mode)) diagnostics.Add(Error("SCHEMA_VALIDATION_ERROR", "mode must be view, edit, or present.", "$.mode"));

        var nodeIds = new HashSet<string>(StringComparer.Ordinal);
        var handlesByNode = new Dictionary<string, HashSet<string>>(StringComparer.Ordinal);
        var parents = new Dictionary<string, string>(StringComparer.Ordinal);
        var normalizedNodes = new JsonArray();
        for (var index = 0; index < nodes.Count; index++)
        {
            var path = $"$.nodes[{index}]";
            if (nodes[index] is not JsonObject node)
            {
                diagnostics.Add(Error("SCHEMA_VALIDATION_ERROR", "Node must be an object.", path));
                continue;
            }
            var forbidden = node.Select(item => item.Key).Where(InternalNodeFields.Contains).Order().ToArray();
            if (forbidden.Length > 0)
                diagnostics.Add(Error("RUNTIME_FIELD_NOT_ALLOWED", "Internal fields are not accepted: " + string.Join(", ", forbidden), path));
            var id = String(node["id"]);
            if (string.IsNullOrWhiteSpace(id))
            {
                diagnostics.Add(Error("SCHEMA_VALIDATION_ERROR", "Node requires a non-empty string id.", $"{path}.id"));
                continue;
            }
            if (!nodeIds.Add(id)) diagnostics.Add(Error("DUPLICATE_NODE_ID", $"Duplicate node id: '{id}'.", $"{path}.id"));
            var type = String(node["type"]) ?? "default";
            if (!BuiltinNodeTypes.Contains(type))
                diagnostics.Add(Warning("UNKNOWN_NODE_TYPE", $"Node type '{type}' requires an external registry.", $"{path}.type", "Register the type in the separate React package."));
            var position = node["position"] as JsonObject;
            if (position is null || !Number(position["x"], out var x) || !Number(position["y"], out var y))
            {
                diagnostics.Add(Error("INVALID_POSITION", "position must contain numeric x and y.", $"{path}.position"));
                x = 0; y = 0;
            }
            var data = node["data"] as JsonObject;
            if (data is null)
            {
                diagnostics.Add(Error("SCHEMA_VALIDATION_ERROR", "data must be a JSON object.", $"{path}.data"));
                data = new JsonObject { ["label"] = node["data"]?.ToJsonString() ?? id };
            }
            var handleIds = new HashSet<string>(StringComparer.Ordinal);
            if (node["handles"] is JsonNode handlesNode)
            {
                if (handlesNode is not JsonArray handles)
                    diagnostics.Add(Error("SCHEMA_VALIDATION_ERROR", "handles must be an array.", $"{path}.handles"));
                else
                {
                    if (handles.Count > MaximumHandlesPerNode)
                        diagnostics.Add(Error("HANDLE_LIMIT_EXCEEDED", $"Maximum {MaximumHandlesPerNode} handles per node.", $"{path}.handles"));
                    for (var handleIndex = 0; handleIndex < handles.Count; handleIndex++)
                    {
                        var handlePath = $"{path}.handles[{handleIndex}]";
                        if (handles[handleIndex] is not JsonObject handle)
                        {
                            diagnostics.Add(Error("SCHEMA_VALIDATION_ERROR", "Handle must be an object.", handlePath));
                            continue;
                        }
                        var handleId = String(handle["id"]);
                        if (string.IsNullOrWhiteSpace(handleId))
                        {
                            diagnostics.Add(Error("SCHEMA_VALIDATION_ERROR", "Handle requires an id.", $"{handlePath}.id"));
                            continue;
                        }
                        if (!handleIds.Add(handleId)) diagnostics.Add(Error("DUPLICATE_HANDLE_ID", $"Duplicate handle '{handleId}' on node '{id}'.", $"{handlePath}.id"));
                        if (String(handle["type"]) is not ("source" or "target")) diagnostics.Add(Error("SCHEMA_VALIDATION_ERROR", "Handle type must be source or target.", $"{handlePath}.type"));
                        if (!Positions.Contains(String(handle["position"]) ?? "")) diagnostics.Add(Error("SCHEMA_VALIDATION_ERROR", "Handle position is invalid.", $"{handlePath}.position"));
                    }
                }
            }
            handlesByNode[id] = handleIds;
            var parentId = String(node["parentId"]);
            if (!string.IsNullOrWhiteSpace(parentId)) parents[id] = parentId;
            var normalized = node.DeepClone().AsObject();
            normalized["id"] = id;
            normalized["type"] = type;
            normalized["position"] = new JsonObject { ["x"] = x, ["y"] = y };
            normalized["data"] = data.DeepClone();
            normalizedNodes.Add(normalized);
        }

        foreach (var (nodeId, parentId) in parents)
        {
            if (!nodeIds.Contains(parentId)) diagnostics.Add(Error("MISSING_PARENT_NODE", $"Parent '{parentId}' of node '{nodeId}' does not exist.", "$.nodes"));
            var seen = new HashSet<string>(StringComparer.Ordinal) { nodeId };
            var current = parentId;
            var depth = 0;
            while (parents.TryGetValue(current, out var next) && depth <= MaximumParentDepth)
            {
                if (!seen.Add(current)) { diagnostics.Add(Error("INVALID_PARENT_CYCLE", $"parentId cycle involving '{nodeId}'.", "$.nodes")); break; }
                current = next; depth++;
            }
            if (depth > MaximumParentDepth) diagnostics.Add(Error("PARENT_DEPTH_EXCEEDED", $"parentId depth exceeds {MaximumParentDepth}.", "$.nodes"));
        }

        var edgeIds = new HashSet<string>(StringComparer.Ordinal);
        var normalizedEdges = new JsonArray();
        for (var index = 0; index < edges.Count; index++)
        {
            var path = $"$.edges[{index}]";
            if (edges[index] is not JsonObject edge)
            {
                diagnostics.Add(Error("SCHEMA_VALIDATION_ERROR", "Edge must be an object.", path));
                continue;
            }
            var id = String(edge["id"]);
            if (string.IsNullOrWhiteSpace(id)) { diagnostics.Add(Error("SCHEMA_VALIDATION_ERROR", "Edge requires a non-empty string id.", $"{path}.id")); continue; }
            if (!edgeIds.Add(id)) diagnostics.Add(Error("DUPLICATE_EDGE_ID", $"Duplicate edge id: '{id}'.", $"{path}.id"));
            var sourceId = String(edge["source"]);
            var targetId = String(edge["target"]);
            if (sourceId is null || !nodeIds.Contains(sourceId)) diagnostics.Add(Error("MISSING_SOURCE_NODE", $"Source '{sourceId}' does not exist.", $"{path}.source"));
            if (targetId is null || !nodeIds.Contains(targetId)) diagnostics.Add(Error("MISSING_TARGET_NODE", $"Target '{targetId}' does not exist.", $"{path}.target"));
            var type = String(edge["type"]) ?? "default";
            if (!BuiltinEdgeTypes.Contains(type)) diagnostics.Add(Warning("UNKNOWN_EDGE_TYPE", $"Edge type '{type}' requires an external registry.", $"{path}.type", "Register the type in the separate React package."));
            foreach (var pair in new[] { (Field: "sourceHandle", Node: sourceId), (Field: "targetHandle", Node: targetId) })
            {
                var handle = String(edge[pair.Field]);
                if (handle is not null && pair.Node is not null && !handlesByNode.GetValueOrDefault(pair.Node, []).Contains(handle))
                    diagnostics.Add(Error("INVALID_HANDLE_REFERENCE", $"Handle '{handle}' does not exist on node '{pair.Node}'.", $"{path}.{pair.Field}"));
            }
            normalizedEdges.Add(edge.DeepClone());
        }

        var normalizedDocument = document.DeepClone().AsObject();
        normalizedDocument["schemaVersion"] = SupportedSchemaVersion;
        normalizedDocument["mode"] = mode;
        normalizedDocument["nodes"] = normalizedNodes;
        normalizedDocument["edges"] = normalizedEdges;
        var hasErrors = diagnostics.Any(item => item.Severity == "error");
        return new(hasErrors ? null : normalizedDocument, diagnostics, originalVersion,
            hasErrors ? null : SupportedSchemaVersion, migrations);
    }

    public static string RenderFenceHtml(string source, ReactFlowParseResult result)
    {
        var title = String(result.Document?["title"]) ?? String(result.Document?["id"]) ?? "React Flow";
        var status = result.Ok ? "pending" : "error";
        var payload = result.Document is null ? "" : Base64Url(Encoding.UTF8.GetBytes(result.Document.ToJsonString(new JsonSerializerOptions { WriteIndented = false })));
        var diagnostics = result.Diagnostics.Count == 0 ? "" : BuildDiagnostics(result.Diagnostics);
        var fallbackNodes = new StringBuilder();
        var fallbackEdges = new StringBuilder();
        if (result.Document?["nodes"] is JsonArray nodes)
        {
            foreach (var node in nodes.OfType<JsonObject>())
            {
                var id = String(node["id"]) ?? "node";
                var label = String(node["data"]?["label"]) ?? id;
                fallbackNodes.Append("<li><strong>").Append(WebUtility.HtmlEncode(label)).Append("</strong> <code>")
                    .Append(WebUtility.HtmlEncode(id)).Append("</code></li>");
            }
        }
        if (result.Document?["edges"] is JsonArray edges)
        {
            foreach (var edge in edges.OfType<JsonObject>())
                fallbackEdges.Append("<li><code>").Append(WebUtility.HtmlEncode(String(edge["source"])))
                    .Append("</code> &rarr; <code>").Append(WebUtility.HtmlEncode(String(edge["target"]))).Append("</code></li>");
        }
        var fallback = "<details class=\"reactflow-text-alternative\"><summary>Text alternative</summary>" +
            "<h4>Nodes</h4><ul>" + fallbackNodes + "</ul><h4>Edges</h4><ul>" + fallbackEdges + "</ul></details>";
        return $"<figure class=\"reactflow-document rune-async\" data-kind=\"reactflow\" data-render-state=\"{status}\" data-reactflow-payload=\"{WebUtility.HtmlEncode(payload)}\" data-reactflow-mode=\"{WebUtility.HtmlEncode(String(result.Document?["mode"]) ?? "view")}\">" +
            $"<figcaption>{WebUtility.HtmlEncode(title)}</figcaption>" +
            "<div class=\"reactflow-loading\" role=\"status\">Preparing React Flow...</div>" +
            $"<div class=\"reactflow-canvas\" role=\"img\" aria-label=\"{WebUtility.HtmlEncode(title)}\"></div>" + diagnostics + fallback +
            "<details class=\"reactflow-source-fallback\"><summary>Original JSON</summary><pre><code>" + WebUtility.HtmlEncode(source) + "</code></pre></details></figure>";
    }

    private static string BuildDiagnostics(IReadOnlyList<ReactFlowDiagnostic> items)
    {
        var rows = string.Concat(items.Select(item =>
            $"<li class=\"reactflow-diagnostic reactflow-diagnostic-{WebUtility.HtmlEncode(item.Severity)}\"><code>{WebUtility.HtmlEncode(item.Code)}</code> &mdash; {WebUtility.HtmlEncode(item.Message)} <small>{WebUtility.HtmlEncode(item.Path)}</small>" +
            (string.IsNullOrWhiteSpace(item.Suggestion) ? "" : $"<div class=\"reactflow-suggestion\">{WebUtility.HtmlEncode(item.Suggestion)}</div>") + "</li>"));
        return $"<details class=\"reactflow-diagnostics\"{(items.Any(item => item.Severity == "error") ? " open" : "")}><summary>Diagnostics ({items.Count})</summary><ul>{rows}</ul></details>";
    }

    private static void WalkPolicy(JsonNode? node, string path, int depth, List<ReactFlowDiagnostic> diagnostics)
    {
        if (depth > MaximumDataDepth) { diagnostics.Add(Error("DATA_DEPTH_EXCEEDED", $"Structure exceeds depth {MaximumDataDepth}.", path)); return; }
        if (node is JsonValue value)
        {
            if (!value.TryGetValue<string>(out var text)) return;
            if (text.Length > MaximumStringLength) diagnostics.Add(Error("STRING_LIMIT_EXCEEDED", $"String exceeds {MaximumStringLength} characters.", path));
            var match = UrlSchemeRegex().Match(text);
            if (!match.Success) return;
            var scheme = match.Groups[1].Value;
            if (scheme.Equals("javascript", StringComparison.OrdinalIgnoreCase) || scheme.Equals("vbscript", StringComparison.OrdinalIgnoreCase) || scheme.Equals("file", StringComparison.OrdinalIgnoreCase))
                diagnostics.Add(Error("SECURITY_POLICY_VIOLATION", $"Executable or local URL scheme is not allowed: '{scheme}'.", path));
            else if (scheme.Equals("http", StringComparison.OrdinalIgnoreCase) || scheme.Equals("https", StringComparison.OrdinalIgnoreCase))
                diagnostics.Add(Error("SECURITY_POLICY_VIOLATION", "External URLs are disabled in the embedded safe JSON renderer.", path, "Use a local resource/Data URI or a trusted React host with an explicit policy."));
            else if (!AllowedSchemes.Contains(scheme)) diagnostics.Add(Error("SECURITY_POLICY_VIOLATION", $"URL scheme is not allowed: '{scheme}'.", path));
            else if (scheme.Equals("data", StringComparison.OrdinalIgnoreCase) && !ImageDataUrlRegex().IsMatch(text)) diagnostics.Add(Error("SECURITY_POLICY_VIOLATION", "Only image Data URLs are allowed.", path));
            return;
        }
        if (node is JsonObject obj)
        {
            if (obj.Count > MaximumAttributesPerObject) diagnostics.Add(Error("ATTRIBUTE_LIMIT_EXCEEDED", $"Object exceeds {MaximumAttributesPerObject} properties.", path));
            foreach (var (key, item) in obj)
            {
                var keyPath = $"{path}.{key}";
                if (DangerousKeys.Contains(key)) { diagnostics.Add(Error("SECURITY_POLICY_VIOLATION", $"Dangerous key is not allowed: '{key}'.", keyPath)); continue; }
                if (ExecutableKeys.Contains(key)) { diagnostics.Add(Error("SECURITY_POLICY_VIOLATION", $"Executable field '{key}' is not allowed in safe JSON mode.", keyPath, "Use declarative IDs resolved by controlled registries.")); continue; }
                WalkPolicy(item, keyPath, depth + 1, diagnostics);
            }
        }
        else if (node is JsonArray array)
        {
            for (var index = 0; index < array.Count; index++) WalkPolicy(array[index], $"{path}[{index}]", depth + 1, diagnostics);
        }
    }

    private static ReactFlowParseResult Failure(string code, string message, string path = "$", string suggestion = "") =>
        new(null, [Error(code, message, path, suggestion)]);
    private static ReactFlowDiagnostic Error(string code, string message, string path = "$", string suggestion = "") => new(code, message, path, "error", suggestion);
    private static ReactFlowDiagnostic Warning(string code, string message, string path = "$", string suggestion = "") => new(code, message, path, "warning", suggestion);
    private static string? String(JsonNode? node) => node is JsonValue value && value.TryGetValue<string>(out var text) ? text : null;
    private static bool Number(JsonNode? node, out double result)
    {
        result = 0;
        return node is JsonValue value && (value.TryGetValue<double>(out result) || (value.TryGetValue<decimal>(out var number) && (result = (double)number) == result));
    }
    private static string Base64Url(byte[] bytes) => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    [GeneratedRegex(@"^\s*([a-z][a-z0-9+.-]*):", RegexOptions.IgnoreCase)]
    private static partial Regex UrlSchemeRegex();
    [GeneratedRegex(@"^data:image/(?:png|jpeg|gif|webp|svg\+xml);", RegexOptions.IgnoreCase)]
    private static partial Regex ImageDataUrlRegex();
}
