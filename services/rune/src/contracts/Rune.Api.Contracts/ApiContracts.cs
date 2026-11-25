using Rune.Core;
using Rune.Job.Contracts;

namespace Rune.Api.Contracts;

public sealed record ResourceInput(string Path, string ContentBase64, string? ContentType = null);

public sealed record RenderRequest(
    DocumentSourceType SourceType,
    string Content = "",
    RenderOutputFormat? OutputFormat = null,
    HtmlTrustMode HtmlTrustMode = HtmlTrustMode.Safe,
    RenderOptions? Options = null,
    IReadOnlyList<ResourceInput>? Resources = null,
    string? IdempotencyKey = null,
    string DocumentName = "document.md",
    bool WaitForCompletion = false,
    int WaitTimeoutSeconds = 5,
    string? SourceResourcePath = null,
    PdfImportOptions? PdfImport = null,
    RuneTemplateOptions? Template = null,
    IReadOnlyList<RenderOutputFormat>? OutputFormats = null,
    CompositeDocumentOptions? Composite = null,
    MultiOutputPublicationOptions? MultiOutput = null);

public sealed record HtmlRenderResponse(
    string ContentType,
    string Html,
    IReadOnlyList<string> RequiredRenderers,
    IReadOnlyList<RenderDiagnostic> Diagnostics);

public sealed record StructuredDocumentResponse(
    string ContentType,
    RuneDocumentModel Document);

public sealed record RenderAcceptedResponse(
    Guid RenderId,
    string Status,
    string StatusUrl,
    string ResultUrl,
    string EventsUrl,
    DateTimeOffset CreatedAt);

public sealed record RenderJobResponse(
    RenderJob Job,
    string StatusUrl,
    string ResultUrl,
    string EventsUrl,
    bool ResultAvailable);

public sealed record CancelRenderRequest(string? Reason = null);
public sealed record RetryRenderRequest(bool ResetAttempts = false);
public sealed record ReplayRenderRequest(bool ResetAttempts = true);

public sealed record ApiErrorResponse(
    string Code,
    string Message,
    string? TraceId = null,
    IReadOnlyDictionary<string, object?>? Details = null);


public sealed record ArtifactComparisonInput(
    string Name,
    string ContentBase64,
    string? ContentType = null);

public sealed record ArtifactComparisonOptions(
    bool PixelComparison = false,
    bool OcrComparison = false,
    bool CanonicalizePdf = false,
    double PixelTolerancePercent = 0,
    double MaximumPixelMismatchRatio = 0,
    double MinimumOcrSimilarity = 1,
    int RasterDpi = 144,
    string OcrLanguage = "eng",
    int TimeoutSeconds = 30,
    bool IncludePixelDiff = false);

public sealed record ArtifactComparisonRequest(
    ArtifactComparisonInput Left,
    ArtifactComparisonInput Right,
    bool NormalizeText = true,
    bool IncludeByteRanges = true,
    int MaximumReportedRanges = 100,
    ArtifactComparisonOptions? Advanced = null);

public sealed record ArtifactDifferenceRange(long Offset, long Length);

public sealed record ArtifactDescriptor(
    string Name,
    string ContentType,
    long Length,
    string Sha256,
    int? Width = null,
    int? Height = null,
    int? PdfPageCount = null,
    string? NormalizedTextSha256 = null);

public sealed record PixelComparisonResult(
    bool Executed,
    bool Equivalent,
    long? DifferentPixels,
    double? MismatchRatio,
    int? Width = null,
    int? Height = null,
    string? Diagnostic = null,
    string? DiffImageBase64 = null,
    int? ComparedPages = null,
    IReadOnlyList<int>? DifferingPages = null);

public sealed record OcrComparisonResult(
    bool Executed,
    bool Equivalent,
    string? LeftTextSha256,
    string? RightTextSha256,
    double? Similarity,
    string? Diagnostic = null,
    int? ComparedPages = null);

public sealed record PdfCanonicalComparisonResult(
    bool Equivalent,
    string LeftCanonicalSha256,
    string RightCanonicalSha256,
    int LeftObjectCount,
    int RightObjectCount,
    IReadOnlyList<string> Limitations);

public sealed record ArtifactComparisonResponse(
    bool Identical,
    bool SemanticallyEquivalent,
    ArtifactDescriptor Left,
    ArtifactDescriptor Right,
    IReadOnlyList<ArtifactDifferenceRange> DifferenceRanges,
    IReadOnlyList<string> Diagnostics,
    PixelComparisonResult? Pixel = null,
    OcrComparisonResult? Ocr = null,
    PdfCanonicalComparisonResult? CanonicalPdf = null);

public enum ComparisonJobStatus
{
    Queued,
    Running,
    CancelRequested,
    Cancelled,
    Completed,
    Failed
}

public enum ComparisonOutcome
{
    Identical,
    EquivalentUnderProfile,
    Different,
    Incomparable,
    Failed
}

public sealed record ComparisonArtifactReference(
    Guid RenderId,
    string ArtifactName = "content");

public sealed record ArtifactComparisonProfile(
    string Name = "default",
    string Version = "1",
    bool CompareIdentity = true,
    bool CompareSemantic = true,
    bool CompareStructure = true,
    bool CompareVisual = false,
    bool CompareOcr = false,
    bool CanonicalizePdf = true,
    bool NormalizeText = true,
    bool IncludeByteRanges = true,
    int MaximumReportedRanges = 100,
    double PixelTolerancePercent = 0,
    double MaximumPixelMismatchRatio = 0,
    double MinimumOcrSimilarity = 1,
    int RasterDpi = 144,
    string OcrLanguage = "eng",
    int TimeoutSeconds = 60,
    IReadOnlyList<string>? IgnoredFields = null);

public sealed record CreateComparisonJobRequest(
    ComparisonArtifactReference Left,
    ComparisonArtifactReference Right,
    ArtifactComparisonProfile? Profile = null,
    string? IdempotencyKey = null,
    int RetentionDays = 30);

public sealed record ComparisonJobResponse(
    Guid Id,
    ComparisonJobStatus Status,
    ComparisonArtifactReference Left,
    ComparisonArtifactReference Right,
    string ProfileName,
    string ProfileVersion,
    string ProfileDigest,
    string Tenant,
    int ProgressPercent,
    string ProgressStage,
    int Attempt,
    int MaximumAttempts,
    DateTimeOffset CreatedAt,
    DateTimeOffset? StartedAt = null,
    DateTimeOffset? CompletedAt = null,
    ComparisonOutcome? Outcome = null,
    string? Error = null,
    string? ReportJsonUrl = null,
    string? ReportHtmlUrl = null,
    string? ManifestUrl = null,
    string? SecurityLabel = null,
    DateTimeOffset? RetainUntil = null);

public sealed record ComparisonJobAccepted(
    Guid Id,
    string StatusUrl,
    string EventsUrl,
    string? Existing = null);

public sealed record CancelComparisonJobRequest(string? Reason = null);
public sealed record RetryComparisonJobRequest(bool ResetAttempts = false);
