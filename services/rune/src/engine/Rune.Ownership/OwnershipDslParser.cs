using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace Rune.Ownership;

public sealed partial class OwnershipDslParser
{
    private static readonly HashSet<string> EntityKinds = new(StringComparer.OrdinalIgnoreCase)
        { "person", "company", "corp", "llc", "fund", "foundation", "trust", "government", "pool", "partnership" };
    private static readonly HashSet<string> RelationKinds = new(StringComparer.OrdinalIgnoreCase)
        { "ownership", "control", "management", "contract", "board-seat", "nominee", "option" };
    private static readonly HashSet<string> Statuses = new(StringComparer.OrdinalIgnoreCase) { "active", "planned", "inactive" };
    private static readonly HashSet<string> Directions = new(StringComparer.OrdinalIgnoreCase) { "down", "right", "up", "left" };
    private static readonly HashSet<string> ValidationModes = new(StringComparer.OrdinalIgnoreCase) { "complete", "partial", "disabled" };
    private const int MaxSourceLength = 1_000_000;
    private const int MaxEntities = 2_000;
    private const int MaxRelations = 10_000;

    public OwnershipParseResult Parse(string source)
    {
        var errors = new List<OwnershipDiagnostic>();
        var warnings = new List<OwnershipDiagnostic>();
        if (source.Length > MaxSourceLength)
            return Failure("ownership.source-too-large", $"Ownership source exceeds {MaxSourceLength} characters.", 1);

        var version = 1;
        var chart = new ChartConfiguration();
        var entities = new List<OwnershipEntity>();
        var relations = new List<OwnershipRelation>();
        var groups = new List<OwnershipGroup>();
        var views = new List<OwnershipView>();
        var statements = SplitStatements(StripComments(source));

        foreach (var (text, line) in statements)
        {
            if (VersionRegex().Match(text) is { Success: true } versionMatch)
            {
                version = int.Parse(versionMatch.Groups[1].Value, CultureInfo.InvariantCulture);
                continue;
            }
            if (ChartRegex().Match(text) is { Success: true } chartMatch)
            {
                var attrs = ParseAttributes(chartMatch.Groups[2].Value, line, warnings);
                chart = ApplyChart(chart with { Title = chartMatch.Groups[1].Value }, attrs, line, errors);
                continue;
            }
            if (EntityStructureRegex().Match(text) is { Success: true } structureMatch)
            {
                chart = chart with { Title = structureMatch.Groups[1].Value };
                continue;
            }
            if (GroupRegex().Match(text) is { Success: true } groupMatch)
            {
                var attrs = ParseAttributes(groupMatch.Groups[3].Value, line, warnings);
                groups.Add(new(groupMatch.Groups[1].Value, groupMatch.Groups[2].Value,
                    StringValue(attrs, "kind"), StringValue(attrs, "parent"), attrs, new(line)));
                continue;
            }
            if (EntityRegex().Match(text) is { Success: true } entityMatch)
            {
                var id = entityMatch.Groups[1].Value;
                var attrs = ParseAttributes(entityMatch.Groups[4].Value, line, warnings);
                var typeToken = entityMatch.Groups[3].Value;
                var (kind, country) = ParseEntityType(typeToken, attrs);
                entities.Add(new(id, entityMatch.Groups[2].Value, kind,
                    StringValue(attrs, "subtype"), StringValue(attrs, "country") ?? country,
                    StringValue(attrs, "registration"), StringValue(attrs, "role"),
                    StringValue(attrs, "group"), attrs, new(line)));
                continue;
            }
            if (RelationRegex().Match(text) is { Success: true } relationMatch)
            {
                var attrs = ParseAttributes(relationMatch.Groups[4].Value, line, warnings);
                var inlineLabel = relationMatch.Groups[3].Value.Trim();
                if (!string.IsNullOrWhiteSpace(inlineLabel) && !attrs.ContainsKey("economic"))
                    attrs["economic"] = ParsePercent(inlineLabel);
                var relation = new OwnershipRelation(
                    StringValue(attrs, "id") ?? $"relation-{relations.Count + 1}",
                    relationMatch.Groups[1].Value,
                    relationMatch.Groups[2].Value,
                    StringValue(attrs, "relation") ?? StringValue(attrs, "kind") ?? "ownership",
                    DecimalValue(attrs, "economic"), DecimalValue(attrs, "voting"),
                    StringValue(attrs, "class") ?? StringValue(attrs, "shareClass"),
                    StringValue(attrs, "label"), StringValue(attrs, "effectiveFrom"),
                    StringValue(attrs, "effectiveTo"), StringValue(attrs, "status") ?? "active",
                    StringValue(attrs, "notes"), attrs, new(line));
                relations.Add(relation);
                continue;
            }
            if (ViewRegex().Match(text) is { Success: true } viewMatch)
            {
                var attrs = ParseAttributes(viewMatch.Groups[2].Value, line, warnings);
                views.Add(new(viewMatch.Groups[1].Value, StringValue(attrs, "mode") ?? "full",
                    StringValue(attrs, "root"), StringValue(attrs, "target"),
                    attrs.GetValueOrDefault("ancestors"), attrs.GetValueOrDefault("descendants"),
                    IntValue(attrs, "maxDepth"), attrs));
                continue;
            }
            warnings.Add(Diagnostic("ownership.unrecognized-line", "warning", $"Unrecognized ownership statement: {text}", line));
        }

        Validate(version, chart, entities, relations, groups, views, errors, warnings);
        if (errors.Count > 0) return new(false, null, errors, warnings);
        var analysis = Analyze(chart, entities, relations, warnings);
        return new(true, new OwnershipDocument(version, chart, entities, relations, groups, views, analysis), errors, warnings);
    }

    private static void Validate(
        int version,
        ChartConfiguration chart,
        IReadOnlyList<OwnershipEntity> entities,
        IReadOnlyList<OwnershipRelation> relations,
        IReadOnlyList<OwnershipGroup> groups,
        IReadOnlyList<OwnershipView> views,
        List<OwnershipDiagnostic> errors,
        List<OwnershipDiagnostic> warnings)
    {
        if (version != 1) warnings.Add(Diagnostic("ownership.version-unknown", "warning", $"Ownership DSL version {version} is not explicitly supported.", 1));
        if (entities.Count == 0) errors.Add(Diagnostic("ownership.no-entities", "error", "No ownership entities were declared.", 1));
        if (entities.Count > MaxEntities) errors.Add(Diagnostic("ownership.too-many-entities", "error", $"Entity count exceeds {MaxEntities}.", 1));
        if (relations.Count > MaxRelations) errors.Add(Diagnostic("ownership.too-many-relations", "error", $"Relation count exceeds {MaxRelations}.", 1));

        var entityById = new Dictionary<string, OwnershipEntity>(StringComparer.OrdinalIgnoreCase);
        foreach (var entity in entities)
        {
            if (!IdentifierRegex().IsMatch(entity.Id)) errors.Add(Diagnostic("ownership.invalid-id", "error", $"Invalid entity identifier: {entity.Id}.", entity.SourceLocation.Line, entity.Id));
            if (!entityById.TryAdd(entity.Id, entity)) errors.Add(Diagnostic("ownership.duplicate-entity", "error", $"Duplicate entity identifier: {entity.Id}.", entity.SourceLocation.Line, entity.Id));
            if (!EntityKinds.Contains(entity.Kind)) warnings.Add(Diagnostic("ownership.unknown-entity-kind", "warning", $"Unknown entity kind: {entity.Kind}.", entity.SourceLocation.Line, entity.Id));
        }
        var groupIds = new HashSet<string>(groups.Select(item => item.Id), StringComparer.OrdinalIgnoreCase);
        foreach (var group in groups)
        {
            if (group.Parent is not null && !groupIds.Contains(group.Parent))
                errors.Add(Diagnostic("ownership.unknown-parent-group", "error", $"Group {group.Id} references unknown parent {group.Parent}.", group.SourceLocation.Line, group.Id));
        }
        foreach (var entity in entities)
        {
            if (entity.Group is not null && !groupIds.Contains(entity.Group))
                errors.Add(Diagnostic("ownership.unknown-group", "error", $"Entity {entity.Id} references unknown group {entity.Group}.", entity.SourceLocation.Line, entity.Id));
        }
        var relationIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var relation in relations)
        {
            if (!relationIds.Add(relation.Id)) errors.Add(Diagnostic("ownership.duplicate-relation", "error", $"Duplicate relation identifier: {relation.Id}.", relation.SourceLocation.Line));
            if (!entityById.ContainsKey(relation.Source) || !entityById.ContainsKey(relation.Target))
                errors.Add(Diagnostic("ownership.unknown-entity", "error", $"Relation {relation.Source} -> {relation.Target} references an unknown entity.", relation.SourceLocation.Line, relation.Source, relation.Target));
            if (string.Equals(relation.Source, relation.Target, StringComparison.OrdinalIgnoreCase))
                errors.Add(Diagnostic("ownership.self-reference", "error", $"Entity {relation.Source} cannot own itself.", relation.SourceLocation.Line, relation.Source));
            if (!RelationKinds.Contains(relation.Kind)) warnings.Add(Diagnostic("ownership.unknown-relation-kind", "warning", $"Unknown relation kind: {relation.Kind}.", relation.SourceLocation.Line));
            if (!Statuses.Contains(relation.Status)) errors.Add(Diagnostic("ownership.invalid-status", "error", $"Invalid relation status: {relation.Status}.", relation.SourceLocation.Line));
            ValidatePercentage(relation.Economic, "economic", relation, errors);
            ValidatePercentage(relation.Voting, "voting", relation, errors);
            ValidateDate(relation.EffectiveFrom, "effectiveFrom", relation, errors);
            ValidateDate(relation.EffectiveTo, "effectiveTo", relation, errors);
        }
        if (!Directions.Contains(chart.Direction)) errors.Add(Diagnostic("ownership.invalid-direction", "error", $"Invalid chart direction: {chart.Direction}.", 1));
        if (!ValidationModes.Contains(chart.OwnershipValidation)) errors.Add(Diagnostic("ownership.invalid-validation", "error", $"Invalid ownership validation mode: {chart.OwnershipValidation}.", 1));
        foreach (var view in views)
        {
            if (view.Root is not null && !entityById.ContainsKey(view.Root)) errors.Add(Diagnostic("ownership.view-root", "error", $"View {view.Name} references unknown root {view.Root}.", 1));
            if (view.Target is not null && !entityById.ContainsKey(view.Target)) errors.Add(Diagnostic("ownership.view-target", "error", $"View {view.Name} references unknown target {view.Target}.", 1));
        }

        ValidateTotals(chart, relations, "economic", item => item.Economic, errors, warnings);
        ValidateTotals(chart, relations, "voting", item => item.Voting, errors, warnings);
    }

    private static OwnershipAnalysis Analyze(
        ChartConfiguration chart,
        IReadOnlyList<OwnershipEntity> entities,
        IReadOnlyList<OwnershipRelation> relations,
        List<OwnershipDiagnostic> warnings)
    {
        var active = relations.Where(item => item.Kind.Equals("ownership", StringComparison.OrdinalIgnoreCase) && item.Status.Equals("active", StringComparison.OrdinalIgnoreCase)).ToArray();
        var incoming = active.GroupBy(item => item.Target, StringComparer.OrdinalIgnoreCase).ToDictionary(group => group.Key, group => group.ToArray(), StringComparer.OrdinalIgnoreCase);
        var outgoing = active.GroupBy(item => item.Source, StringComparer.OrdinalIgnoreCase).ToDictionary(group => group.Key, group => group.ToArray(), StringComparer.OrdinalIgnoreCase);
        var roots = entities.Select(item => item.Id).Where(id => !incoming.ContainsKey(id)).Order(StringComparer.OrdinalIgnoreCase).ToArray();
        var connected = new HashSet<string>(active.SelectMany(item => new[] { item.Source, item.Target }), StringComparer.OrdinalIgnoreCase);
        var orphans = entities.Select(item => item.Id).Where(id => !connected.Contains(id)).Order(StringComparer.OrdinalIgnoreCase).ToArray();
        var levels = entities.ToDictionary(item => item.Id, _ => 0, StringComparer.OrdinalIgnoreCase);
        var queue = new Queue<(string Id, int Level)>(roots.Select(id => (id, 0)));
        var iterations = 0;
        while (queue.Count > 0 && iterations++ < Math.Max(1, entities.Count * entities.Count))
        {
            var (id, level) = queue.Dequeue();
            if (level > levels[id]) levels[id] = level;
            if (!outgoing.TryGetValue(id, out var children)) continue;
            foreach (var child in children) queue.Enqueue((child.Target, level + 1));
        }
        var cycles = FindCycles(entities.Select(item => item.Id), outgoing);
        if (cycles.Count > 0)
            warnings.Add(Diagnostic("ownership.cycle", chart.CycleSeverity, $"Detected {cycles.Count} ownership cycle(s).", 1, cycles.SelectMany(item => item).Distinct().ToArray()));
        var indirect = cycles.Count == 0 && chart.ShowIndirect
            ? CalculateIndirect(entities.Select(item => item.Id), outgoing)
            : [];
        var totalsEconomic = active.Where(item => item.Economic is not null).GroupBy(item => item.Target, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.Sum(item => item.Economic!.Value), StringComparer.OrdinalIgnoreCase);
        var totalsVoting = active.Where(item => item.Voting is not null).GroupBy(item => item.Target, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.Sum(item => item.Voting!.Value), StringComparer.OrdinalIgnoreCase);
        return new(roots, orphans, levels, cycles, cycles.Count > 0 ? "cycle-detected" : chart.ShowIndirect ? "computed" : "disabled",
            indirect, entities.Count, relations.Count, totalsEconomic, totalsVoting);
    }

    private static IReadOnlyList<IndirectOwnership> CalculateIndirect(IEnumerable<string> entityIds, IReadOnlyDictionary<string, OwnershipRelation[]> outgoing)
    {
        var result = new List<IndirectOwnership>();
        foreach (var source in entityIds)
        {
            var stack = new Stack<(string Node, decimal Share, List<string> Path)>();
            stack.Push((source, 1m, [source]));
            while (stack.TryPop(out var current))
            {
                if (!outgoing.TryGetValue(current.Node, out var children)) continue;
                foreach (var edge in children)
                {
                    if (edge.Economic is null || current.Path.Contains(edge.Target, StringComparer.OrdinalIgnoreCase)) continue;
                    var share = current.Share * edge.Economic.Value / 100m;
                    var path = new List<string>(current.Path) { edge.Target };
                    if (path.Count > 2) result.Add(new(source, edge.Target, decimal.Round(share * 100m, 8), path));
                    stack.Push((edge.Target, share, path));
                }
            }
        }
        return result.GroupBy(item => (item.Source.ToLowerInvariant(), item.Target.ToLowerInvariant()))
            .Select(group => new IndirectOwnership(group.First().Source, group.First().Target, group.Sum(item => item.Economic), group.OrderByDescending(item => item.Economic).First().Path))
            .OrderBy(item => item.Source, StringComparer.OrdinalIgnoreCase).ThenBy(item => item.Target, StringComparer.OrdinalIgnoreCase).ToArray();
    }

    private static IReadOnlyList<IReadOnlyList<string>> FindCycles(IEnumerable<string> ids, IReadOnlyDictionary<string, OwnershipRelation[]> outgoing)
    {
        var result = new List<IReadOnlyList<string>>();
        var state = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var stack = new List<string>();
        foreach (var id in ids) Visit(id);
        return result;

        void Visit(string id)
        {
            if (state.GetValueOrDefault(id) == 2) return;
            if (state.GetValueOrDefault(id) == 1)
            {
                var index = stack.FindIndex(item => item.Equals(id, StringComparison.OrdinalIgnoreCase));
                if (index >= 0)
                {
                    var cycle = stack.Skip(index).Append(id).ToArray();
                    if (!result.Any(existing => CanonicalCycle(existing) == CanonicalCycle(cycle))) result.Add(cycle);
                }
                return;
            }
            state[id] = 1;
            stack.Add(id);
            if (outgoing.TryGetValue(id, out var children)) foreach (var child in children) Visit(child.Target);
            stack.RemoveAt(stack.Count - 1);
            state[id] = 2;
        }
    }

    private static string CanonicalCycle(IReadOnlyList<string> cycle) => string.Join('|', cycle.Take(Math.Max(0, cycle.Count - 1)).Order(StringComparer.OrdinalIgnoreCase));

    private static void ValidateTotals(
        ChartConfiguration chart,
        IReadOnlyList<OwnershipRelation> relations,
        string dimension,
        Func<OwnershipRelation, decimal?> selector,
        List<OwnershipDiagnostic> errors,
        List<OwnershipDiagnostic> warnings)
    {
        if (chart.OwnershipValidation.Equals("disabled", StringComparison.OrdinalIgnoreCase)) return;
        foreach (var group in relations.Where(item => item.Kind.Equals("ownership", StringComparison.OrdinalIgnoreCase) && item.Status.Equals("active", StringComparison.OrdinalIgnoreCase) && selector(item) is not null)
                     .GroupBy(item => item.Target, StringComparer.OrdinalIgnoreCase))
        {
            var total = group.Sum(item => selector(item)!.Value);
            if (total > 100.00000001m)
                errors.Add(Diagnostic($"ownership.{dimension}-over-100", "error", $"{dimension} ownership for {group.Key} totals {total:0.########}%, above 100%.", group.First().SourceLocation.Line, group.Key));
            else if (chart.OwnershipValidation.Equals("complete", StringComparison.OrdinalIgnoreCase) && total != 100m)
                errors.Add(Diagnostic($"ownership.{dimension}-incomplete", "error", $"{dimension} ownership for {group.Key} totals {total:0.########}%, expected 100%.", group.First().SourceLocation.Line, group.Key));
            else if (chart.OwnershipValidation.Equals("partial", StringComparison.OrdinalIgnoreCase) && total < 100m)
                warnings.Add(Diagnostic($"ownership.{dimension}-partial", "warning", $"{dimension} ownership for {group.Key} totals {total:0.########}%.", group.First().SourceLocation.Line, group.Key));
        }
    }

    private static ChartConfiguration ApplyChart(ChartConfiguration chart, IReadOnlyDictionary<string, object?> attrs, int line, List<OwnershipDiagnostic> errors)
    {
        var maxDepth = IntValue(attrs, "maxVisibleDepth") ?? IntValue(attrs, "maxDepth");
        return chart with
        {
            Direction = StringValue(attrs, "direction") ?? chart.Direction,
            OwnershipValidation = StringValue(attrs, "ownershipValidation") ?? StringValue(attrs, "validation") ?? chart.OwnershipValidation,
            ShowEconomic = BoolValue(attrs, "showEconomic", chart.ShowEconomic),
            ShowVoting = BoolValue(attrs, "showVoting", chart.ShowVoting),
            ShowIndirect = BoolValue(attrs, "showIndirect", chart.ShowIndirect),
            ShowSecondary = BoolValue(attrs, "showSecondary", chart.ShowSecondary),
            EdgeRouting = StringValue(attrs, "edgeRouting") ?? chart.EdgeRouting,
            MaxVisibleDepth = maxDepth,
            CycleSeverity = StringValue(attrs, "cycleSeverity") ?? chart.CycleSeverity
        };
    }

    private static Dictionary<string, object?> ParseAttributes(string source, int line, List<OwnershipDiagnostic> warnings)
    {
        var result = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        if (string.IsNullOrWhiteSpace(source)) return result;
        foreach (var part in SplitAttributes(source))
        {
            var index = part.IndexOf('=');
            if (index < 0) { result[part.Trim()] = true; continue; }
            var key = part[..index].Trim();
            if (string.IsNullOrWhiteSpace(key)) continue;
            result[key] = ParseValue(part[(index + 1)..].Trim());
        }
        if (result.Count > 30) warnings.Add(Diagnostic("ownership.too-many-attributes", "warning", "A statement contains more than 30 attributes.", line));
        return result;
    }

    private static IEnumerable<string> SplitAttributes(string source)
    {
        var current = new StringBuilder();
        var quoted = false;
        var quote = '\0';
        foreach (var character in source)
        {
            if ((character is '\'' or '"') && (!quoted || quote == character))
            {
                quoted = !quoted; quote = quoted ? character : '\0'; current.Append(character); continue;
            }
            if ((character == ',' || char.IsWhiteSpace(character)) && !quoted)
            {
                if (current.Length > 0) { yield return current.ToString(); current.Clear(); }
                continue;
            }
            current.Append(character);
        }
        if (current.Length > 0) yield return current.ToString();
    }

    private static object? ParseValue(string text)
    {
        text = text.Trim();
        if (text.Length >= 2 && text[0] == text[^1] && (text[0] is '\'' or '"')) return text[1..^1];
        if (bool.TryParse(text, out var boolean)) return boolean;
        if (text.EndsWith('%') && decimal.TryParse(text[..^1], NumberStyles.Number, CultureInfo.InvariantCulture, out var percent)) return percent;
        if (decimal.TryParse(text, NumberStyles.Number, CultureInfo.InvariantCulture, out var number)) return number;
        if (text.Equals("null", StringComparison.OrdinalIgnoreCase)) return null;
        return text;
    }

    private static decimal? ParsePercent(string text)
    {
        var value = text.Trim().TrimEnd('%');
        return decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed) ? parsed : null;
    }

    private static (string Kind, string? Country) ParseEntityType(string token, IReadOnlyDictionary<string, object?> attrs)
    {
        var value = string.IsNullOrWhiteSpace(token) ? StringValue(attrs, "kind") ?? "company" : token.Trim();
        var parts = value.Split('@', 2);
        return (parts[0].Equals("corp", StringComparison.OrdinalIgnoreCase) || parts[0].Equals("llc", StringComparison.OrdinalIgnoreCase) ? "company" : parts[0], parts.Length == 2 ? parts[1] : null);
    }

    private static string? StringValue(IReadOnlyDictionary<string, object?> attrs, string key) => attrs.TryGetValue(key, out var value) ? Convert.ToString(value, CultureInfo.InvariantCulture) : null;
    private static decimal? DecimalValue(IReadOnlyDictionary<string, object?> attrs, string key) => attrs.TryGetValue(key, out var value) && decimal.TryParse(Convert.ToString(value, CultureInfo.InvariantCulture), NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed) ? parsed : null;
    private static int? IntValue(IReadOnlyDictionary<string, object?> attrs, string key) => attrs.TryGetValue(key, out var value) && int.TryParse(Convert.ToString(value, CultureInfo.InvariantCulture), NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed) ? parsed : null;
    private static bool BoolValue(IReadOnlyDictionary<string, object?> attrs, string key, bool fallback) => attrs.TryGetValue(key, out var value) && bool.TryParse(Convert.ToString(value, CultureInfo.InvariantCulture), out var parsed) ? parsed : fallback;

    private static void ValidatePercentage(decimal? value, string name, OwnershipRelation relation, List<OwnershipDiagnostic> errors)
    {
        if (value is < 0m or > 100m) errors.Add(Diagnostic($"ownership.{name}-range", "error", $"Relation {relation.Id} has {name} percentage outside 0..100.", relation.SourceLocation.Line));
    }

    private static void ValidateDate(string? value, string name, OwnershipRelation relation, List<OwnershipDiagnostic> errors)
    {
        if (value is not null && !DateOnly.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _))
            errors.Add(Diagnostic($"ownership.{name}-date", "error", $"Relation {relation.Id} has invalid {name} date {value}; expected yyyy-MM-dd.", relation.SourceLocation.Line));
    }

    private static OwnershipDiagnostic Diagnostic(string code, string severity, string message, int line, params string[] related) => new(code, severity, message, new(line), related);
    private static OwnershipParseResult Failure(string code, string message, int line) => new(false, null, [Diagnostic(code, "error", message, line)], []);

    private static string StripComments(string source)
    {
        var lines = source.Replace("\r\n", "\n", StringComparison.Ordinal).Split('\n');
        for (var i = 0; i < lines.Length; i++)
        {
            var quoted = false; var quote = '\0';
            for (var j = 0; j < lines[i].Length; j++)
            {
                var c = lines[i][j];
                if ((c is '\'' or '"') && (!quoted || quote == c)) { quoted = !quoted; quote = quoted ? c : '\0'; continue; }
                if (!quoted && c == '#') { lines[i] = lines[i][..j]; break; }
                if (!quoted && c == '/' && j + 1 < lines[i].Length && lines[i][j + 1] == '/') { lines[i] = lines[i][..j]; break; }
            }
        }
        return string.Join('\n', lines);
    }

    private static IReadOnlyList<(string Text, int Line)> SplitStatements(string source)
    {
        var result = new List<(string, int)>();
        var current = new StringBuilder();
        var line = 1; var startLine = 1; var depth = 0; var quoted = false; var quote = '\0';
        foreach (var c in source)
        {
            if (current.Length == 0 && !char.IsWhiteSpace(c)) startLine = line;
            current.Append(c);
            if ((c is '\'' or '"') && (!quoted || quote == c)) { quoted = !quoted; quote = quoted ? c : '\0'; }
            if (!quoted) { if (c == '[') depth++; else if (c == ']') depth--; }
            if (c == '\n')
            {
                if (depth <= 0 && !quoted)
                {
                    var text = current.ToString().Trim(); if (text.Length > 0) result.Add((text, startLine)); current.Clear(); depth = 0;
                }
                line++;
            }
        }
        var final = current.ToString().Trim(); if (final.Length > 0) result.Add((final, startLine));
        return result;
    }

    [GeneratedRegex("^[A-Za-z][A-Za-z0-9_-]*$")]
    private static partial Regex IdentifierRegex();
    [GeneratedRegex("^version\\s+(\\d+)$", RegexOptions.IgnoreCase)]
    private static partial Regex VersionRegex();
    [GeneratedRegex("^chart\\s+\"([^\"]+)\"\\s*(?:\\[(.*)\\])?$", RegexOptions.IgnoreCase)]
    private static partial Regex ChartRegex();
    [GeneratedRegex("^entity-structure\\s+\"([^\"]+)\"$", RegexOptions.IgnoreCase)]
    private static partial Regex EntityStructureRegex();
    [GeneratedRegex("^group\\s+([A-Za-z][A-Za-z0-9_-]*)\\s+\"([^\"]+)\"\\s*(?:\\[(.*)\\])?$", RegexOptions.IgnoreCase)]
    private static partial Regex GroupRegex();
    [GeneratedRegex("^entity\\s+([A-Za-z][A-Za-z0-9_-]*)\\s+\"([^\"]+)\"(?:\\s+([^\\s\\[]+))?\\s*(?:\\[(.*)\\])?$", RegexOptions.IgnoreCase)]
    private static partial Regex EntityRegex();
    [GeneratedRegex("^([A-Za-z][A-Za-z0-9_-]*)\\s*->\\s*([A-Za-z][A-Za-z0-9_-]*)\\s*(?::\\s*([^\\[]+?))?\\s*(?:\\[(.*)\\])?$")]
    private static partial Regex RelationRegex();
    [GeneratedRegex("^view\\s+\"([^\"]+)\"\\s*(?:\\[(.*)\\])?$", RegexOptions.IgnoreCase)]
    private static partial Regex ViewRegex();
}
