namespace Rune.Ownership;

public sealed record SourceLocation(int Line, int Column = 1, int? EndLine = null, int? EndColumn = null);
public sealed record OwnershipDiagnostic(string Code, string Severity, string Message, SourceLocation Location, IReadOnlyList<string> RelatedEntityIds);

public sealed record ChartConfiguration(
    string Title = "Ownership chart",
    string Direction = "down",
    string OwnershipValidation = "partial",
    bool ShowEconomic = true,
    bool ShowVoting = false,
    bool ShowIndirect = false,
    bool ShowSecondary = false,
    string EdgeRouting = "orthogonal",
    int? MaxVisibleDepth = null,
    string CycleSeverity = "warning");

public sealed record OwnershipEntity(
    string Id,
    string Name,
    string Kind,
    string? Subtype,
    string? Country,
    string? Registration,
    string? Role,
    string? Group,
    IReadOnlyDictionary<string, object?> Attributes,
    SourceLocation SourceLocation);

public sealed record OwnershipRelation(
    string Id,
    string Source,
    string Target,
    string Kind,
    decimal? Economic,
    decimal? Voting,
    string? ShareClass,
    string? Label,
    string? EffectiveFrom,
    string? EffectiveTo,
    string Status,
    string? Notes,
    IReadOnlyDictionary<string, object?> Attributes,
    SourceLocation SourceLocation);

public sealed record OwnershipGroup(
    string Id,
    string Name,
    string? Kind,
    string? Parent,
    IReadOnlyDictionary<string, object?> Attributes,
    SourceLocation SourceLocation);

public sealed record OwnershipView(
    string Name,
    string Mode,
    string? Root,
    string? Target,
    object? Ancestors,
    object? Descendants,
    int? MaxDepth,
    IReadOnlyDictionary<string, object?> Attributes);

public sealed record IndirectOwnership(string Source, string Target, decimal Economic, IReadOnlyList<string> Path);

public sealed record OwnershipAnalysis(
    IReadOnlyList<string> Roots,
    IReadOnlyList<string> Orphans,
    IReadOnlyDictionary<string, int> Levels,
    IReadOnlyList<IReadOnlyList<string>> Cycles,
    string IndirectStatus,
    IReadOnlyList<IndirectOwnership> IndirectOwnership,
    int EntityCount,
    int RelationCount,
    IReadOnlyDictionary<string, decimal> EconomicTotals,
    IReadOnlyDictionary<string, decimal> VotingTotals);

public sealed record OwnershipDocument(
    int Version,
    ChartConfiguration Chart,
    IReadOnlyList<OwnershipEntity> Entities,
    IReadOnlyList<OwnershipRelation> Relations,
    IReadOnlyList<OwnershipGroup> Groups,
    IReadOnlyList<OwnershipView> Views,
    OwnershipAnalysis Analysis);

public sealed record OwnershipParseResult(
    bool Ok,
    OwnershipDocument? Document,
    IReadOnlyList<OwnershipDiagnostic> Errors,
    IReadOnlyList<OwnershipDiagnostic> Warnings);
