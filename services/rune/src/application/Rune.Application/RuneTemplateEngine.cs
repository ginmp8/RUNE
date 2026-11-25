using System.Globalization;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Rune.Core;

namespace Rune.Application;

public sealed record RuneTemplateResult(
    string Content,
    string ExpandedSha256,
    int EvaluationSteps,
    TemplateExpansionMetadata? Metadata = null);

public static partial class RuneTemplateEngine
{
    private static readonly HashSet<string> BuiltInHelpers = new(StringComparer.OrdinalIgnoreCase)
    {
        "upper", "lower", "trim", "default", "number", "currency", "date", "json", "join"
    };

    public static RuneTemplateResult Expand(
        string template,
        JsonElement data,
        RuneTemplateOptions options,
        IReadOnlyDictionary<string, string>? resources = null)
    {
        if (!string.Equals(options.Syntax, "rune-template-v1", StringComparison.Ordinal))
            throw new ArgumentException($"Unsupported template syntax: {options.Syntax}.");
        if (options.MaximumIterations is < 1 or > 100_000)
            throw new ArgumentException("Template maximumIterations must be between 1 and 100000.");
        if (options.MaximumOutputCharacters is < 1 or > 10_000_000)
            throw new ArgumentException("Template maximumOutputCharacters must be between 1 and 10000000.");
        if (string.IsNullOrWhiteSpace(options.PartialsResourcePrefix) || options.PartialsResourcePrefix.Contains("..", StringComparison.Ordinal))
            throw new ArgumentException("Template partialsResourcePrefix must be a safe relative prefix.");
        _ = CultureInfo.GetCultureInfo(options.Culture);
        if (options.MaximumDepth is < 1 or > 256) throw new ArgumentException("Template maximumDepth must be between 1 and 256.");
        if (options.MaximumExpandedBytes is < 1 or > 100_000_000) throw new ArgumentException("Template maximumExpandedBytes must be between 1 and 100000000.");
        if (options.MaximumLocalLoopIterations is < 1 or > 100_000 || options.MaximumGlobalLoopIterations is < 1 or > 1_000_000)
            throw new ArgumentException("Template loop limits are outside the supported range.");
        if (options.MaximumSchemaErrors is < 1 or > 10_000) throw new ArgumentException("Template maximumSchemaErrors must be between 1 and 10000.");
        if (options.AllowRemoteSchemaReferences) throw new ArgumentException("Remote template schema references are not supported.");
        _ = ResolveTimeZone(options.TimeZone);
        ValidateCustomHelpers(options);

        var normalizedResources = resources ?? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var state = new EvaluationState(options, normalizedResources);
        var withPartials = ExpandPartials(template, state, [], 0);
        var expanded = Evaluate(withPartials, data, data, state);
        if (expanded.Length > options.MaximumOutputCharacters)
            throw new ArgumentException("Template expansion exceeded maximumOutputCharacters.");
        var expandedBytes = Encoding.UTF8.GetByteCount(expanded);
        if (expandedBytes > options.MaximumExpandedBytes)
            throw new ArgumentException("Template expansion exceeded maximumExpandedBytes.");
        var digest = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(Encoding.UTF8.GetBytes(expanded)));
        var partialDigests = normalizedResources
            .Where(item => item.Key.Replace('\\', '/').StartsWith(options.PartialsResourcePrefix.Replace('\\', '/'), StringComparison.OrdinalIgnoreCase))
            .OrderBy(item => item.Key, StringComparer.Ordinal)
            .ToDictionary(item => item.Key, item => Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(Encoding.UTF8.GetBytes(item.Value))), StringComparer.Ordinal);
        var metadata = new TemplateExpansionMetadata(
            "rune-template-v1", RuneVersion.Current,
            Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(Encoding.UTF8.GetBytes(template))),
            Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(Encoding.UTF8.GetBytes(data.GetRawText()))),
            null, partialDigests, digest, state.Steps, state.LoopIterations, expandedBytes, options.Culture, options.TimeZone);
        return new RuneTemplateResult(expanded, digest, state.Steps, metadata);
    }

    public static void ValidateSchema(JsonElement data, JsonElement schema, RuneTemplateOptions? options = null)
    {
        if (schema.ValueKind != JsonValueKind.Object)
            throw new ArgumentException("Template data schema must be a JSON object.");
        options ??= new RuneTemplateOptions();
        var errors = new List<string>();
        ValidateNode(data, schema, "$", options, errors);
        if (errors.Count > 0)
            throw new ArgumentException("Template data schema validation failed: " + string.Join("; ", errors));
    }

    public static JsonDocument ApplySchemaDefaults(JsonElement data, JsonElement schema, RuneTemplateOptions options)
    {
        if (!options.ApplySchemaDefaults) return JsonDocument.Parse(data.GetRawText());
        var node = JsonNode.Parse(data.GetRawText()) ?? throw new ArgumentException("Template data cannot be null when schema defaults are enabled.");
        ApplyDefaults(node, schema, 0, options.MaximumDepth);
        return JsonDocument.Parse(node.ToJsonString());
    }

    private static string ExpandPartials(string template, EvaluationState state, HashSet<string> stack, int depth)
    {
        if (depth > 20) throw new ArgumentException("Template partial nesting exceeds 20 levels.");
        return PartialRegex().Replace(template, match =>
        {
            state.Step();
            var name = match.Groups["name"].Value;
            if (!SafePartialNameRegex().IsMatch(name)) throw new ArgumentException($"Invalid template partial name '{name}'.");
            var prefix = state.Options.PartialsResourcePrefix.Replace('\\', '/').TrimStart('/');
            var candidates = new[] { prefix + name, prefix + name + ".md", prefix + name + ".html", prefix + name + ".txt" };
            var path = candidates.FirstOrDefault(candidate => state.Resources.ContainsKey(candidate));
            if (path is null) throw new ArgumentException($"Template partial '{name}' was not found under '{prefix}'.");
            if (!stack.Add(path)) throw new ArgumentException($"Template partial cycle detected at '{name}'.");
            try { return ExpandPartials(state.Resources[path], state, stack, depth + 1); }
            finally { stack.Remove(path); }
        });
    }

    private static void ValidateNode(JsonElement value, JsonElement schema, string path, RuneTemplateOptions options, List<string> errors)
    {
        if (errors.Count >= options.MaximumSchemaErrors) return;
        if (schema.TryGetProperty("$ref", out var reference) && reference.ValueKind == JsonValueKind.String)
        {
            var referenceValue = reference.GetString() ?? string.Empty;
            if (referenceValue.StartsWith("http://", StringComparison.OrdinalIgnoreCase) || referenceValue.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                errors.Add($"Remote schema reference at {path} is not allowed.");
            else if (!referenceValue.StartsWith("#/", StringComparison.Ordinal))
                errors.Add($"Unsupported schema reference '{referenceValue}' at {path}.");
        }
        if (schema.TryGetProperty("type", out var typeElement))
        {
            var expected = typeElement.GetString();
            var valid = expected switch
            {
                "object" => value.ValueKind == JsonValueKind.Object,
                "array" => value.ValueKind == JsonValueKind.Array,
                "string" => value.ValueKind == JsonValueKind.String,
                "number" => value.ValueKind == JsonValueKind.Number,
                "integer" => value.ValueKind == JsonValueKind.Number && value.TryGetInt64(out _),
                "boolean" => value.ValueKind is JsonValueKind.True or JsonValueKind.False,
                "null" => value.ValueKind == JsonValueKind.Null,
                null => true,
                _ => false
            };
            if (!valid)
            {
                errors.Add($"Template data at {path} does not match schema type {expected}.");
                return;
            }
        }

        if (value.ValueKind == JsonValueKind.Object)
        {
            if (schema.TryGetProperty("required", out var required) && required.ValueKind == JsonValueKind.Array)
                foreach (var item in required.EnumerateArray())
                {
                    var name = item.GetString();
                    if (name is null) errors.Add($"Template schema required entry at {path} must be a string.");
                    else if (!value.TryGetProperty(name, out _)) errors.Add($"Template data is missing required property {path}.{name}.");
                    if (errors.Count >= options.MaximumSchemaErrors) return;
                }
            var known = new HashSet<string>(StringComparer.Ordinal);
            if (schema.TryGetProperty("properties", out var properties) && properties.ValueKind == JsonValueKind.Object)
                foreach (var property in properties.EnumerateObject())
                {
                    known.Add(property.Name);
                    if (value.TryGetProperty(property.Name, out var child)) ValidateNode(child, property.Value, path + "." + property.Name, options, errors);
                }
            if (schema.TryGetProperty("additionalProperties", out var additional) && additional.ValueKind == JsonValueKind.False)
                foreach (var property in value.EnumerateObject())
                    if (!known.Contains(property.Name))
                    {
                        errors.Add($"Template data property {path}.{property.Name} is not allowed by the schema.");
                        if (errors.Count >= options.MaximumSchemaErrors) return;
                    }
        }
        else if (value.ValueKind == JsonValueKind.Array && schema.TryGetProperty("items", out var items))
        {
            var index = 0;
            foreach (var child in value.EnumerateArray()) ValidateNode(child, items, $"{path}[{index++}]", options, errors);
        }
        else if (value.ValueKind == JsonValueKind.String && schema.TryGetProperty("format", out var formatElement) && formatElement.ValueKind == JsonValueKind.String)
        {
            var text = value.GetString() ?? string.Empty;
            var format = formatElement.GetString();
            var valid = format switch
            {
                "date" => DateOnly.TryParseExact(text, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _),
                "date-time" => DateTimeOffset.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out _),
                "time" => TimeOnly.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.None, out _),
                "uri" => Uri.TryCreate(text, UriKind.Absolute, out _),
                null => true,
                _ => true
            };
            if (!valid) errors.Add($"Template data at {path} does not match schema format {format}.");
        }
    }

    private static void ApplyDefaults(JsonNode node, JsonElement schema, int depth, int maximumDepth)
    {
        if (depth > maximumDepth) throw new ArgumentException("Template schema defaults exceed maximumDepth.");
        if (node is JsonObject objectNode && schema.TryGetProperty("properties", out var properties) && properties.ValueKind == JsonValueKind.Object)
        {
            foreach (var property in properties.EnumerateObject())
            {
                if (!objectNode.ContainsKey(property.Name) && property.Value.TryGetProperty("default", out var defaultValue))
                    objectNode[property.Name] = JsonNode.Parse(defaultValue.GetRawText());
                if (objectNode[property.Name] is JsonNode child) ApplyDefaults(child, property.Value, depth + 1, maximumDepth);
            }
        }
        else if (node is JsonArray array && schema.TryGetProperty("items", out var items))
            foreach (var child in array) if (child is not null) ApplyDefaults(child, items, depth + 1, maximumDepth);
    }

    private static string Evaluate(string template, JsonElement root, JsonElement context, EvaluationState state)
    {
        template = EachRegex().Replace(template, match =>
        {
            var path = match.Groups["path"].Value.Trim();
            var value = Resolve(path, root, context, state, allowMissing: false);
            if (value.ValueKind != JsonValueKind.Array) throw new ArgumentException($"Template each expression '{path}' must resolve to an array.");
            var builder = new StringBuilder();
            var index = 0;
            foreach (var item in value.EnumerateArray())
            {
                state.Loop();
                if (index >= state.Options.MaximumLocalLoopIterations)
                    throw new ArgumentException("Template local loop exceeded maximumLocalLoopIterations.");
                var body = match.Groups["body"].Value.Replace("{{@index}}", index.ToString(CultureInfo.InvariantCulture), StringComparison.Ordinal);
                builder.Append(Evaluate(body, root, item, state));
                index++;
            }
            return builder.ToString();
        });

        template = IfRegex().Replace(template, match =>
        {
            var path = match.Groups["path"].Value.Trim();
            var value = Resolve(path, root, context, state, allowMissing: true);
            return IsTruthy(value) ? Evaluate(match.Groups["body"].Value, root, context, state) : string.Empty;
        });

        template = RawValueRegex().Replace(template, match =>
        {
            if (!state.Options.AllowRawInterpolation)
                throw new ArgumentException("Raw template interpolation requires allowRawInterpolation=true.");
            var value = Resolve(match.Groups["path"].Value.Trim(), root, context, state,
                state.Options.MissingValuePolicy == TemplateMissingValuePolicy.Empty);
            return TrustedInsertion(value, state.Options.ContentType);
        });

        template = HelperRegex().Replace(template, match =>
        {
            var helper = match.Groups["helper"].Value;
            if (!IsHelperAllowed(helper, state.Options))
                throw new ArgumentException($"Template helper '{helper}' is not allowed.");
            var arguments = Tokenize(match.Groups["args"].Value)
                .Select(token => ResolveArgument(token, root, context, state)).ToArray();
            var output = ExecuteHelper(helper, arguments, state.Options);
            return EscapeForMatch(output, state.Options, template, match.Index);
        });

        return ValueRegex().Replace(template, match =>
        {
            var path = match.Groups["path"].Value.Trim();
            var value = Resolve(path, root, context, state, state.Options.MissingValuePolicy == TemplateMissingValuePolicy.Empty);
            return EscapeForMatch(Scalar(value), state.Options, template, match.Index);
        });
    }

    private static bool IsHelperAllowed(string helper, RuneTemplateOptions options)
    {
        var known = BuiltInHelpers.Contains(helper) || options.CustomHelpers?.Any(item => string.Equals(item.Name, helper, StringComparison.OrdinalIgnoreCase)) == true;
        if (!known) return false;
        return options.AllowedHelpers is null || options.AllowedHelpers.Contains(helper, StringComparer.OrdinalIgnoreCase);
    }

    private static void ValidateCustomHelpers(RuneTemplateOptions options)
    {
        if (options.CustomHelpers is null) return;
        if (options.CustomHelpers.Count > 50) throw new ArgumentException("A maximum of 50 custom template helpers is supported.");
        var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var helper in options.CustomHelpers)
        {
            if (!Regex.IsMatch(helper.Name, "^[A-Za-z_][A-Za-z0-9_-]{0,63}$", RegexOptions.CultureInvariant))
                throw new ArgumentException($"Invalid custom template helper name '{helper.Name}'.");
            if (BuiltInHelpers.Contains(helper.Name) || !names.Add(helper.Name))
                throw new ArgumentException($"Custom template helper name '{helper.Name}' is duplicated or reserved.");
            if (helper.Operations.Count is < 1 or > 20)
                throw new ArgumentException($"Custom template helper '{helper.Name}' must contain between 1 and 20 operations.");
            foreach (var operation in helper.Operations) ValidateCustomOperation(helper.Name, operation);
        }
    }

    private static void ValidateCustomOperation(string helper, RuneTemplateHelperOperation operation)
    {
        var name = operation.Operation.ToLowerInvariant();
        if (name is not ("upper" or "lower" or "trim" or "prefix" or "suffix" or "replace" or "regex-replace" or "default" or "substring"))
            throw new ArgumentException($"Custom template helper '{helper}' uses unsupported operation '{operation.Operation}'.");
        if ((operation.Argument?.Length ?? 0) > 10_000 || (operation.SecondArgument?.Length ?? 0) > 10_000)
            throw new ArgumentException($"Custom template helper '{helper}' operation arguments are too large.");
        if (name == "regex-replace" && string.IsNullOrEmpty(operation.Argument))
            throw new ArgumentException($"Custom template helper '{helper}' regex-replace requires a pattern.");
    }

    private static IReadOnlyList<string> Tokenize(string arguments) => ArgumentTokenRegex().Matches(arguments)
        .Select(match => match.Groups["quoted"].Success ? "\"" + match.Groups["quoted"].Value + "\"" : match.Groups["bare"].Value)
        .ToArray();

    private static object? ResolveArgument(string token, JsonElement root, JsonElement context, EvaluationState state)
    {
        if (token.Length >= 2 && token[0] == '"' && token[^1] == '"') return token[1..^1].Replace("\\\"", "\"", StringComparison.Ordinal);
        var value = Resolve(token, root, context, state, allowMissing: true);
        return value.ValueKind switch
        {
            JsonValueKind.Undefined or JsonValueKind.Null => null,
            JsonValueKind.String => value.GetString(),
            JsonValueKind.Number when value.TryGetDecimal(out var number) => number,
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Array or JsonValueKind.Object => value,
            _ => value.GetRawText()
        };
    }

    private static string ExecuteHelper(string helper, object?[] arguments, RuneTemplateOptions options)
    {
        var culture = CultureInfo.GetCultureInfo(options.Culture);
        string Arg(int index) => index < arguments.Length ? Convert.ToString(arguments[index], culture) ?? string.Empty : string.Empty;
        return helper.ToLowerInvariant() switch
        {
            "upper" => Arg(0).ToUpper(culture),
            "lower" => Arg(0).ToLower(culture),
            "trim" => Arg(0).Trim(),
            "default" => string.IsNullOrWhiteSpace(Arg(0)) ? Arg(1) : Arg(0),
            "number" => FormatNumber(arguments.ElementAtOrDefault(0), Arg(1), culture),
            "currency" => FormatCurrency(arguments.ElementAtOrDefault(0), Arg(1), culture),
            "date" => FormatDate(arguments.ElementAtOrDefault(0), Arg(1), culture, options.TimeZone),
            "json" => arguments.ElementAtOrDefault(0) is JsonElement element ? element.GetRawText() : JsonSerializer.Serialize(arguments.ElementAtOrDefault(0)),
            "join" => Join(arguments.ElementAtOrDefault(0), Arg(1)),
            _ => ExecuteCustomHelper(helper, Arg(0), options, culture)
        };
    }

    private static string ExecuteCustomHelper(string helper, string value, RuneTemplateOptions options, CultureInfo culture)
    {
        var definition = options.CustomHelpers?.SingleOrDefault(item => string.Equals(item.Name, helper, StringComparison.OrdinalIgnoreCase))
            ?? throw new ArgumentException($"Unsupported template helper '{helper}'.");
        foreach (var operation in definition.Operations)
        {
            var argument = operation.Argument ?? string.Empty;
            value = operation.Operation.ToLowerInvariant() switch
            {
                "upper" => value.ToUpper(culture),
                "lower" => value.ToLower(culture),
                "trim" => value.Trim(),
                "prefix" => argument + value,
                "suffix" => value + argument,
                "replace" => value.Replace(argument, operation.SecondArgument ?? string.Empty, StringComparison.Ordinal),
                "regex-replace" => Regex.Replace(value, argument, operation.SecondArgument ?? string.Empty, RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(100)),
                "default" => string.IsNullOrWhiteSpace(value) ? argument : value,
                "substring" => ApplySubstring(value, argument, operation.SecondArgument),
                _ => throw new ArgumentException($"Unsupported custom helper operation '{operation.Operation}'.")
            };
            if (value.Length > options.MaximumOutputCharacters) throw new ArgumentException($"Custom template helper '{helper}' exceeded maximumOutputCharacters.");
        }
        return value;
    }

    private static string ApplySubstring(string value, string startValue, string? lengthValue)
    {
        if (!int.TryParse(startValue, NumberStyles.Integer, CultureInfo.InvariantCulture, out var start) || start < 0 || start > value.Length)
            throw new ArgumentException("substring operation requires a valid non-negative start index.");
        if (string.IsNullOrWhiteSpace(lengthValue)) return value[start..];
        if (!int.TryParse(lengthValue, NumberStyles.Integer, CultureInfo.InvariantCulture, out var length) || length < 0 || start + length > value.Length)
            throw new ArgumentException("substring operation requires a valid length.");
        return value.Substring(start, length);
    }

    private static string FormatNumber(object? value, string format, CultureInfo culture)
    {
        if (!decimal.TryParse(Convert.ToString(value, CultureInfo.InvariantCulture), NumberStyles.Any, CultureInfo.InvariantCulture, out var number))
            throw new ArgumentException("number helper requires a numeric value.");
        return number.ToString(string.IsNullOrWhiteSpace(format) ? "N" : format, culture);
    }

    private static string FormatCurrency(object? value, string currencyCode, CultureInfo culture)
    {
        if (!decimal.TryParse(Convert.ToString(value, CultureInfo.InvariantCulture), NumberStyles.Any, CultureInfo.InvariantCulture, out var number))
            throw new ArgumentException("currency helper requires a numeric value.");
        var formatted = number.ToString("C", culture);
        return string.IsNullOrWhiteSpace(currencyCode) ? formatted : $"{currencyCode} {number.ToString("N2", culture)}";
    }

    private static string FormatDate(object? value, string format, CultureInfo culture, string timeZone)
    {
        if (!DateTimeOffset.TryParse(Convert.ToString(value, CultureInfo.InvariantCulture), CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var date))
            throw new ArgumentException("date helper requires an ISO-8601 date value.");
        var converted = TimeZoneInfo.ConvertTime(date, ResolveTimeZone(timeZone));
        return converted.ToString(string.IsNullOrWhiteSpace(format) ? "d" : format, culture);
    }

    private static TimeZoneInfo ResolveTimeZone(string timeZone)
    {
        if (string.Equals(timeZone, "UTC", StringComparison.OrdinalIgnoreCase)) return TimeZoneInfo.Utc;
        try { return TimeZoneInfo.FindSystemTimeZoneById(timeZone); }
        catch (TimeZoneNotFoundException exception) { throw new ArgumentException($"Unknown template time zone '{timeZone}'.", exception); }
        catch (InvalidTimeZoneException exception) { throw new ArgumentException($"Invalid template time zone '{timeZone}'.", exception); }
    }

    private static string Join(object? value, string separator)
    {
        if (value is not JsonElement { ValueKind: JsonValueKind.Array } array)
            throw new ArgumentException("join helper requires an array value.");
        return string.Join(separator, array.EnumerateArray().Select(Scalar));
    }

    private static JsonElement Resolve(string path, JsonElement root, JsonElement context, EvaluationState state, bool allowMissing)
    {
        state.Step();
        var current = path is "this" or "." ? context : path.StartsWith("this.", StringComparison.Ordinal) ? context : root;
        var segments = path is "this" or "." ? Array.Empty<string>() : path.StartsWith("this.", StringComparison.Ordinal) ? path[5..].Split('.') : path.Split('.');
        foreach (var segment in segments)
        {
            if (string.IsNullOrWhiteSpace(segment) || segment.Contains('[') || segment.Contains(']'))
                throw new ArgumentException($"Invalid template path '{path}'.");
            if (current.ValueKind != JsonValueKind.Object || !current.TryGetProperty(segment, out current))
            {
                if (allowMissing) return default;
                throw new ArgumentException($"Template value '{path}' was not found.");
            }
        }
        return current;
    }

    private static bool IsTruthy(JsonElement value) => value.ValueKind switch
    {
        JsonValueKind.Undefined or JsonValueKind.Null or JsonValueKind.False => false,
        JsonValueKind.String => !string.IsNullOrEmpty(value.GetString()),
        JsonValueKind.Array => value.GetArrayLength() > 0,
        JsonValueKind.Number => value.TryGetDecimal(out var number) && number != 0,
        _ => true
    };

    private static string Scalar(JsonElement value) => value.ValueKind switch
    {
        JsonValueKind.Undefined or JsonValueKind.Null => string.Empty,
        JsonValueKind.String => value.GetString() ?? string.Empty,
        JsonValueKind.True => "true",
        JsonValueKind.False => "false",
        JsonValueKind.Number => value.GetRawText(),
        _ => throw new ArgumentException("Template interpolation supports only scalar values.")
    };

    private static string TrustedInsertion(JsonElement value, TemplateContentType contentType)
    {
        if (value.ValueKind != JsonValueKind.Object)
            throw new ArgumentException("Raw template interpolation requires a typed trusted insertion object.");
        var propertyName = contentType == TemplateContentType.Html ? "$runeTrustedHtml" : "$runeTrustedMarkdown";
        if (!value.TryGetProperty(propertyName, out var trusted) || trusted.ValueKind != JsonValueKind.String || value.EnumerateObject().Count() != 1)
            throw new ArgumentException($"Raw template interpolation requires exactly one '{propertyName}' string property.");
        return trusted.GetString() ?? string.Empty;
    }

    private static string EscapeForMatch(string value, RuneTemplateOptions options, string template, int index)
    {
        var context = options.EscapingContext;
        if (context == TemplateEscapingContext.Auto)
        {
            if (options.ContentType == TemplateContentType.Markdown) context = TemplateEscapingContext.Markdown;
            else
            {
                var prefix = template[..Math.Min(index, template.Length)];
                var lastOpen = prefix.LastIndexOf('<');
                var lastClose = prefix.LastIndexOf('>');
                if (lastOpen > lastClose)
                {
                    var fragment = prefix[lastOpen..];
                    if (Regex.IsMatch(fragment, "(?:href|src|action)\\s*=\\s*[\'\"]?[^\'\"]*$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)) context = TemplateEscapingContext.Url;
                    else if (Regex.IsMatch(fragment, "style\\s*=\\s*[\'\"]?[^\'\"]*$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)) context = TemplateEscapingContext.Css;
                    else if (Regex.IsMatch(fragment, "=\\s*[\'\"]?[^\'\"]*$", RegexOptions.CultureInvariant)) context = TemplateEscapingContext.HtmlAttribute;
                    else context = TemplateEscapingContext.HtmlText;
                }
                else context = TemplateEscapingContext.HtmlText;
            }
        }
        return context switch
        {
            TemplateEscapingContext.Markdown => EscapeMarkdown(value),
            TemplateEscapingContext.HtmlText or TemplateEscapingContext.HtmlAttribute => WebUtility.HtmlEncode(value),
            TemplateEscapingContext.Url => EscapeUrl(value),
            TemplateEscapingContext.Css => EscapeCss(value),
            TemplateEscapingContext.Json => JsonSerializer.Serialize(value)[1..^1],
            TemplateEscapingContext.PlainText => value.Replace("\0", string.Empty, StringComparison.Ordinal),
            _ => WebUtility.HtmlEncode(value)
        };
    }

    private static string EscapeUrl(string value)
    {
        if (!Uri.TryCreate(value, UriKind.RelativeOrAbsolute, out var uri)) throw new ArgumentException("Template URL value is invalid.");
        if (uri.IsAbsoluteUri && uri.Scheme is not ("http" or "https" or "mailto")) throw new ArgumentException("Template URL scheme is not allowed.");
        return WebUtility.HtmlEncode(value);
    }

    private static string EscapeCss(string value)
    {
        if (value.Contains("url(", StringComparison.OrdinalIgnoreCase) || value.Contains("expression", StringComparison.OrdinalIgnoreCase) || value.Contains('<'))
            throw new ArgumentException("Template CSS value contains a prohibited construct.");
        return Regex.Replace(value, @"[^A-Za-z0-9 #.,%()_+\-/]", match => $"\\{(int)match.Value[0]:X} ", RegexOptions.CultureInvariant);
    }

    private static string EscapeMarkdown(string value) => Regex.Replace(value, @"([\\`*_{}\[\]()<>#+\-.!|])", @"\$1", RegexOptions.CultureInvariant);

    private sealed class EvaluationState(RuneTemplateOptions options, IReadOnlyDictionary<string, string> resources)
    {
        public RuneTemplateOptions Options { get; } = options;
        public IReadOnlyDictionary<string, string> Resources { get; } = resources;
        public int Steps { get; private set; }
        public int LoopIterations { get; private set; }
        public void Loop()
        {
            LoopIterations++;
            if (LoopIterations > Options.MaximumGlobalLoopIterations)
                throw new ArgumentException("Template global loop exceeded maximumGlobalLoopIterations.");
            Step();
        }
        public void Step()
        {
            Steps++;
            if (Steps > Options.MaximumIterations) throw new ArgumentException("Template evaluation exceeded maximumIterations.");
        }
    }

    [GeneratedRegex(@"\{\{>\s*(?<name>[A-Za-z0-9_./-]+)\s*\}\}", RegexOptions.CultureInvariant)]
    private static partial Regex PartialRegex();
    [GeneratedRegex(@"^[A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+)*$", RegexOptions.CultureInvariant)]
    private static partial Regex SafePartialNameRegex();
    [GeneratedRegex(@"\{\{#each\s+(?<path>[A-Za-z0-9_.]+)\}\}(?<body>.*?)\{\{/each\}\}", RegexOptions.Singleline | RegexOptions.CultureInvariant)]
    private static partial Regex EachRegex();
    [GeneratedRegex(@"\{\{#if\s+(?<path>[A-Za-z0-9_.]+)\}\}(?<body>.*?)\{\{/if\}\}", RegexOptions.Singleline | RegexOptions.CultureInvariant)]
    private static partial Regex IfRegex();
    [GeneratedRegex(@"\{\{\{\s*(?<path>(?:this\.)?[A-Za-z_][A-Za-z0-9_.]*|this|\.)\s*\}\}\}", RegexOptions.CultureInvariant)]
    private static partial Regex RawValueRegex();
    [GeneratedRegex(@"\{\{\s*(?<helper>[A-Za-z_][A-Za-z0-9_-]*)\s+(?<args>[^{}]+?)\s*\}\}", RegexOptions.CultureInvariant)]
    private static partial Regex HelperRegex();
    [GeneratedRegex("\\s*(?:\\\"(?<quoted>(?:\\\\.|[^\\\"])*)\\\"|(?<bare>[^\\s]+))", RegexOptions.CultureInvariant)]
    private static partial Regex ArgumentTokenRegex();
    [GeneratedRegex(@"\{\{\s*(?<path>(?:this\.)?[A-Za-z_][A-Za-z0-9_.]*|this|\.)\s*\}\}", RegexOptions.CultureInvariant)]
    private static partial Regex ValueRegex();
}
