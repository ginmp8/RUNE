using Rune.Core;

namespace Rune.Job.Contracts;

public enum RenderJobStatus
{
    Queued,
    Claimed,
    Rendering,
    CancelRequested,
    Cancelled,
    Completed,
    Failed
}

public enum RenderOutputState { Pending, Generating, Validating, ReadyForCommit, Committed, Failed, Cancelled }

public enum RenderDispatchStatus
{
    Pending,
    Publishing,
    Published
}

public sealed record RenderJob(
    Guid Id,
    RenderJobStatus Status,
    RenderOutputFormat OutputFormat,
    RenderOptions Options,
    string PackagePath,
    string? ResultPath,
    string? ContentType,
    int Attempt,
    int MaximumAttempts,
    string? Error,
    DateTimeOffset CreatedAt,
    DateTimeOffset? StartedAt,
    DateTimeOffset? CompletedAt,
    string? IdempotencyKey,
    string? ClaimedBy = null,
    DateTimeOffset? LeaseExpiresAt = null,
    DateTimeOffset? UpdatedAt = null,
    int ProgressPercent = 0,
    string? ProgressStage = null,
    long? ResultLength = null,
    string? ConversionReportPath = null,
    string? CacheStatus = null,
    string? CacheFingerprint = null,
    Guid? CacheSourceRenderId = null,
    long LeaseToken = 0,
    RenderDispatchStatus DispatchStatus = RenderDispatchStatus.Pending,
    Guid DispatchEventId = default,
    long DispatchGeneration = 0,
    int DispatchAttempts = 0,
    string? DispatchClaimedBy = null,
    DateTimeOffset? DispatchLeaseExpiresAt = null,
    long DispatchToken = 0,
    DateTimeOffset? DispatchNextAttemptAt = null,
    DateTimeOffset? DispatchPublishedAt = null,
    string? DispatchError = null,
    IReadOnlyDictionary<string, string>? DispatchHeaders = null,
    DateTimeOffset? DeadLetteredAt = null,
    string? DeadLetterReason = null,
    IReadOnlyList<RenderOutputFormat>? OutputFormats = null,
    IReadOnlyList<RenderOutputProgress>? OutputProgress = null,
    RenderOutputFormat? FailedOutput = null,
    string? FailedStage = null);

public sealed record RenderPackageResource(string Path, string ContentType, byte[] Content);

public sealed record RenderPackage(
    Guid RenderId,
    string Html,
    RenderOutputFormat OutputFormat,
    RenderOptions Options,
    string ContentHash,
    DateTimeOffset CreatedAt,
    RuneDocumentModel? DocumentModel = null,
    string ContractVersion = "1.0",
    DocumentSourceType SourceType = DocumentSourceType.Html,
    string? SourceResourcePath = null,
    IReadOnlyList<RenderPackageResource>? Resources = null,
    PdfImportOptions? PdfImport = null,
    IReadOnlyList<RenderOutputFormat>? OutputFormats = null,
    IReadOnlyList<NativePdfImportPlan>? NativePdfImports = null,
    string DocumentName = "document",
    TemplateExpansionMetadata? TemplateExpansion = null,
    string? AssemblyManifestJson = null);

public sealed record RenderArtifactManifestItem(
    RenderOutputFormat Format,
    string FileName,
    string ContentType,
    long Length,
    string Sha256,
    string? CacheStatus = null,
    string? CacheFingerprint = null,
    Guid? CacheSourceRenderId = null,
    long LeaseToken = 0,
    string Validation = "passed",
    string Producer = "rune",
    string? Validator = null,
    string? DerivedFrom = null,
    string? SharedIntermediateSha256 = null);

public sealed record RenderOutputProgress(
    RenderOutputFormat Output,
    RenderOutputState State,
    int Percent,
    string Stage,
    string? Error = null);

public sealed record RenderArtifactSetManifest(
    string ContractVersion,
    Guid RenderId,
    DateTimeOffset CreatedAt,
    IReadOnlyList<RenderArtifactManifestItem> Artifacts,
    bool AtomicPublication = true,
    bool SharedStorageTransaction = true,
    string CommitProtocol = "stage-verify-rename",
    string? ArtifactSetId = null,
    string? SourceSha256 = null,
    string? RenderFingerprint = null,
    IReadOnlyList<RenderOutputFormat>? SelectedOutputs = null,
    IReadOnlyDictionary<string, string>? Runtime = null,
    IReadOnlyDictionary<string, string>? SharedIntermediates = null,
    string? ManifestSha256 = null);

public sealed record RenderJobQuery(
    RenderJobStatus? Status = null,
    int Offset = 0,
    int Limit = 50,
    DateTimeOffset? CreatedAfter = null,
    DateTimeOffset? CreatedBefore = null,
    bool? DeadLettered = null);

public sealed record RenderJobPage(
    IReadOnlyList<RenderJob> Items,
    int Offset,
    int Limit,
    int Total);

public sealed record RenderJobLease(
    Guid RenderId,
    string WorkerId,
    DateTimeOffset ExpiresAt,
    int Attempt,
    long FencingToken);

public sealed record RenderDispatchLease(
    Guid RenderId,
    Guid EventId,
    long Generation,
    string DispatcherId,
    DateTimeOffset ExpiresAt,
    int Attempt,
    long FencingToken,
    string PackagePath,
    IReadOnlyDictionary<string, string>? Headers = null);
