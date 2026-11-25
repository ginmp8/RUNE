using System.Collections.ObjectModel;
using System.Text.Json.Serialization;

namespace Rune.Core;

public enum DocumentSourceType { Markdown, Html, Pdf, Template, Composite }
public enum HtmlTrustMode { Safe, Trusted }
public enum RenderOutputFormat { InteractiveHtml, StaticHtml, StructuredJson, Pdf, PdfA, Png, Jpeg, Svg }
public enum RenderDiagnosticSeverity { Info, Warning, Error }
public enum PdfImportMode
{
    Visual,
    Semantic,
    Hybrid,
    [JsonStringEnumMemberName("native-page")]
    NativePage
}
public enum PdfSignaturePolicy { Reject, Flatten, Ignore }
public enum PdfFormPolicy { Flatten, Reject }
public enum PdfLinkAnnotationPolicy { Preserve, Remove }
public enum PdfCommentAnnotationPolicy { Flatten, Reject, Remove }
public enum PdfAttachmentAnnotationPolicy { Reject, Remove }
public enum PdfJavaScriptPolicy { Remove, Reject }
public enum PdfImportFallbackPolicy { Visual, Reject }
public enum PdfOcrMode { Off, Auto, Force }
public enum TemplateContentType { Markdown, Html }
public enum TemplateMissingValuePolicy { Fail, Empty }
public enum TemplateEscapingContext { Auto, Markdown, HtmlText, HtmlAttribute, Url, Css, Json, PlainText }
public enum CompositeAssemblyMode { Auto, Logical, Rendered, Hybrid }
public enum CompositePreservationPolicy { Preserve, Flatten, Remove, Reject }
public enum MultiOutputAtomicPolicy { Required }
public enum MultiOutputPackageMode { None, Zip, ZipAndIndividual }
public enum FontMissingFacePolicy { Fail, Fallback }
public enum FontMissingGlyphPolicy { Fail, Fallback, Replace }
public enum FontEmbedPolicy { Required, Allowed, Prohibited }
public enum FontSubsetPolicy { Full, Deterministic, None }
public enum RenderCacheMode { Bypass, Read, Write, Use, Refresh }
public enum FontLicensePolicyMode { Allow, Deny, RequireMetadata }
public enum FontPhysicalSubsetMode { Disabled, Opportunistic, Required }

public sealed record RuneTemplateHelperOperation(
    string Operation,
    string? Argument = null,
    string? SecondArgument = null);

public sealed record RuneTemplateHelperDefinition(
    string Name,
    IReadOnlyList<RuneTemplateHelperOperation> Operations);

public sealed record RuneTemplateOptions(
    string Syntax = "rune-template-v1",
    TemplateContentType ContentType = TemplateContentType.Markdown,
    string? TemplateResourcePath = null,
    string DataResourcePath = "data.json",
    string? DataSchemaResourcePath = null,
    TemplateMissingValuePolicy MissingValuePolicy = TemplateMissingValuePolicy.Fail,
    int MaximumIterations = 10_000,
    int MaximumOutputCharacters = 10_000_000,
    string PartialsResourcePrefix = "partials/",
    bool AllowRawInterpolation = false,
    IReadOnlyList<string>? AllowedHelpers = null,
    string Culture = "en-US",
    IReadOnlyList<RuneTemplateHelperDefinition>? CustomHelpers = null,
    bool Strict = true,
    string TimeZone = "UTC",
    TemplateEscapingContext EscapingContext = TemplateEscapingContext.Auto,
    int MaximumDepth = 64,
    int MaximumExpandedBytes = 10_000_000,
    int MaximumGlobalLoopIterations = 100_000,
    int MaximumLocalLoopIterations = 10_000,
    int MaximumSchemaErrors = 100,
    bool ApplySchemaDefaults = false,
    bool AllowRemoteSchemaReferences = false);

public sealed record CompositeDocumentPart(
    string Name,
    DocumentSourceType SourceType,
    string Content = "",
    string? ResourcePath = null,
    RuneTemplateOptions? Template = null,
    HtmlTrustMode HtmlTrustMode = HtmlTrustMode.Safe,
    bool StartOnNewPage = true,
    CompositeDocumentOptions? Composite = null,
    string? PageSize = null,
    bool? Landscape = null,
    string? MarginTop = null,
    string? MarginRight = null,
    string? MarginBottom = null,
    string? MarginLeft = null,
    PdfImportOptions? PdfImport = null,
    string? Id = null,
    string? SectionId = null,
    string? PageLabel = null,
    int? NumberingStart = null,
    PageDecorationOptions? PageDecorations = null,
    CompositePreservationPolicy Links = CompositePreservationPolicy.Preserve,
    CompositePreservationPolicy Tags = CompositePreservationPolicy.Preserve,
    CompositePreservationPolicy Forms = CompositePreservationPolicy.Flatten,
    CompositePreservationPolicy Annotations = CompositePreservationPolicy.Flatten,
    CompositePreservationPolicy Attachments = CompositePreservationPolicy.Reject,
    CompositePreservationPolicy Signatures = CompositePreservationPolicy.Reject);

public sealed record CompositeDocumentOptions(
    IReadOnlyList<CompositeDocumentPart> Parts,
    bool IncludePartTitles = false,
    bool PageBreakBetweenParts = true,
    bool RewriteTableOfContents = false,
    int MaximumDepth = 8,
    CompositeAssemblyMode Mode = CompositeAssemblyMode.Auto,
    bool GlobalTableOfContents = false,
    bool GlobalOutline = true,
    bool GlobalHeadingNumbering = false,
    bool NamespaceDuplicateAnchors = true,
    bool PreservePageLabels = true,
    bool FailOnSemanticLoss = true,
    int MaximumPages = 2_000,
    long MaximumAggregateResourceBytes = 250_000_000,
    int MaximumObjects = 1_000_000,
    int MaximumImages = 10_000,
    int MaximumFonts = 512,
    int TimeoutSeconds = 300);

public sealed record FontFaceDescriptor(
    string Family,
    string ResourcePath,
    int Weight = 400,
    string Style = "normal",
    string Stretch = "normal",
    string? Sha256 = null,
    string? LicenseSpdx = null,
    bool? LicenseAllowsEmbedding = null);

public sealed record PhysicalFontSubsetOptions(
    FontPhysicalSubsetMode Mode = FontPhysicalSubsetMode.Opportunistic,
    bool BlockCurrentRequest = false,
    int MinimumFontSizeBytes = 500_000,
    double MaximumUsedGlyphRatio = 0.35,
    int MinimumEstimatedSavingBytes = 200_000,
    int MaximumFontsPerDocument = 8,
    int DecisionBudgetMilliseconds = 25,
    string SubsetterVersion = "fonttools-v1");

public sealed record FontSanitizationOptions(
    bool Enabled = true,
    bool RequireSuccess = true,
    int TimeoutSeconds = 20,
    string ValidatorVersion = "fonttools-v1",
    string PolicyVersion = "1");

public sealed record FontOptions(
    IReadOnlyList<FontFaceDescriptor> Faces,
    string? DefaultFamily = null,
    IReadOnlyList<string>? FallbackFamilies = null,
    string MissingFacePolicy = "fail",
    string MissingGlyphPolicy = "fallback",
    string EmbedPolicy = "required",
    string SubsetPolicy = "full",
    FontLicensePolicyMode LicensePolicy = FontLicensePolicyMode.Allow,
    IReadOnlyList<string>? AllowedLicenses = null,
    IReadOnlyList<string>? DeniedLicenses = null,
    bool AnalyzeGlyphCoverage = false,
    string? RequiredCharacters = null,
    PhysicalFontSubsetOptions? PhysicalSubset = null,
    FontSanitizationOptions? Sanitization = null,
    FontMissingFacePolicy? MissingFace = null,
    FontMissingGlyphPolicy? MissingGlyph = null,
    FontEmbedPolicy? Embedding = null,
    FontSubsetPolicy? Subsetting = null,
    string BuiltInFallbackPack = "",
    string? BuiltInFallbackPackSha256 = null,
    int FontReadinessTimeoutSeconds = 20,
    bool DisableHostFontLookup = true,
    bool DisableRemoteFontAcquisition = true);

public sealed record RenderCachePolicy(
    RenderCacheMode Mode = RenderCacheMode.Bypass,
    string Scope = "deployment",
    int MaximumAgeSeconds = 86_400,
    bool StoreResult = true,
    bool RequireDeterministicInputs = true,
    long MaximumScopeBytes = 1_000_000_000,
    int MaximumScopeEntries = 10_000,
    int DistributedLockTimeoutSeconds = 120,
    int StaleLockSeconds = 300,
    string? InvalidationToken = null,
    string Store = "filesystem",
    bool ReauthorizeOnHit = true,
    bool QuarantineCorruptEntries = true,
    bool PreservePriorEntryOnRefreshFailure = true,
    bool EncryptSensitiveEntries = false,
    string? SecurityLabel = null);

public sealed record PdfAnnotationPolicies(
    PdfLinkAnnotationPolicy Links = PdfLinkAnnotationPolicy.Preserve,
    PdfCommentAnnotationPolicy Comments = PdfCommentAnnotationPolicy.Flatten,
    PdfAttachmentAnnotationPolicy Attachments = PdfAttachmentAnnotationPolicy.Reject);

public sealed record PdfImportOptions(
    PdfImportMode Mode = PdfImportMode.Hybrid,
    PdfOcrMode OcrMode = PdfOcrMode.Off,
    double SemanticConfidenceThreshold = 0.65,
    int MaximumPages = 200,
    long MaximumSourceBytes = 25_000_000,
    long MaximumOutputBytes = 150_000_000,
    double VisualScale = 1.5,
    bool EmitRegionDiagnostics = true,
    bool PreserveLinks = false,
    bool ExtractImages = true,
    string? Password = null,
    string OcrLanguage = "eng",
    PdfSignaturePolicy Signatures = PdfSignaturePolicy.Reject,
    PdfFormPolicy Forms = PdfFormPolicy.Flatten,
    PdfAnnotationPolicies? Annotations = null,
    [property: JsonPropertyName("javascript")] PdfJavaScriptPolicy JavaScript = PdfJavaScriptPolicy.Remove,
    PdfImportFallbackPolicy Fallback = PdfImportFallbackPolicy.Visual,
    string? Provider = null,
    string? OcrProvider = null,
    string? OcrModel = null,
    string? OcrModelVersion = null,
    string? OcrModelSha256 = null,
    int ProviderTimeoutSeconds = 120,
    int ProviderMemoryLimitMegabytes = 1024,
    bool DisableNetwork = true,
    bool RequireNonRoot = true,
    bool RejectEncryptedPdf = true);

public sealed record NativePdfLink(
    double X1,
    double Y1,
    double X2,
    double Y2,
    string Target);

public sealed record NativePdfPageDescriptor(
    int SourcePage,
    string Marker,
    double WidthPoints,
    double HeightPoints,
    int Rotation,
    double[] MediaBox,
    double[]? CropBox,
    double[]? TrimBox,
    double[]? BleedBox,
    IReadOnlyList<NativePdfLink> Links);

public sealed record NativePdfImportPlan(
    string ImportId,
    string ResourcePath,
    PdfImportMode RequestedMode,
    PdfImportMode AppliedMode,
    string? FallbackReason,
    string? Password,
    PdfSignaturePolicy Signatures,
    PdfFormPolicy Forms,
    PdfAnnotationPolicies Annotations,
    [property: JsonPropertyName("javascript")] PdfJavaScriptPolicy JavaScript,
    PdfImportFallbackPolicy Fallback,
    bool SignatureDetected,
    bool FormDetected,
    bool JavaScriptDetected,
    bool AttachmentDetected,
    bool CommentDetected,
    IReadOnlyList<NativePdfPageDescriptor> Pages,
    IReadOnlyList<string> Warnings);

public sealed record RenderDiagnostic(
    string Code,
    string Message,
    RenderDiagnosticSeverity Severity,
    int? Line = null,
    int? Column = null,
    IReadOnlyList<string>? RelatedIds = null);

public sealed record SourceDocument(
    DocumentSourceType SourceType,
    string Content,
    IReadOnlyDictionary<string, string>? Resources = null,
    IReadOnlyDictionary<string, object?>? Metadata = null,
    HtmlTrustMode HtmlTrustMode = HtmlTrustMode.Safe,
    string EntryPath = "document.md");

public sealed record CompiledDocument(
    string BodyHtml,
    IReadOnlyDictionary<string, object?> Metadata,
    IReadOnlySet<string> RequiredRenderers,
    IReadOnlyList<RenderDiagnostic> Diagnostics,
    string HeadHtml = "",
    RuneDocumentModel? DocumentModel = null,
    IReadOnlyList<NativePdfImportPlan>? NativePdfImports = null,
    TemplateExpansionMetadata? TemplateExpansion = null,
    string? AssemblyManifestJson = null);

public sealed record RenderedHtml(
    string Html,
    IReadOnlySet<string> RequiredRenderers,
    IReadOnlyList<RenderDiagnostic> Diagnostics);

public sealed record RenderOptions(
    string Theme = "professional",
    string PageSize = "A4",
    bool Landscape = false,
    bool PrintBackground = true,
    int Width = 1440,
    int Height = 1000,
    int TimeoutSeconds = 45,
    string Language = "en",
    string Direction = "ltr",
    bool IncludeCover = false,
    bool IncludeToc = false,
    bool NumberHeadings = false,
    string? HeaderTemplate = null,
    string? FooterTemplate = null,
    string MarginTop = "20mm",
    string MarginRight = "18mm",
    string MarginBottom = "20mm",
    string MarginLeft = "18mm",
    string? AdditionalCss = null,
    string? Watermark = null,
    bool Tagged = true,
    bool Outline = true,
    string? CoverTitle = null,
    string? CoverSubtitle = null,
    string? CoverAuthor = null,
    string? CoverOrganization = null,
    string? CoverVersion = null,
    string? CoverStatus = null,
    string? CoverDescription = null,
    string? CoverDate = null,
    string? CoverImage = null,
    bool EmbedSource = false,
    bool ApplyFrontMatter = true,
    int JpegQuality = 90,
    string PdfAConformance = "2b",
    PageDecorationOptions? PageDecorations = null,
    FontOptions? Fonts = null,
    RenderCachePolicy? CachePolicy = null,
    bool EmitStructureMap = false,
    MultiOutputPublicationOptions? Publication = null);

public sealed record MultiOutputPublicationOptions(
    MultiOutputAtomicPolicy AtomicPolicy = MultiOutputAtomicPolicy.Required,
    MultiOutputPackageMode PackageMode = MultiOutputPackageMode.None,
    string ArtifactNamePattern = "{documentName}.{outputExtension}",
    bool IncludeManifest = true,
    bool IncludeProvenance = true,
    long MaximumZipBytes = 500_000_000,
    int MaximumZipEntries = 32);

public sealed record TemplateExpansionMetadata(
    string Engine,
    string EngineVersion,
    string TemplateSha256,
    string DataSha256,
    string? SchemaSha256,
    IReadOnlyDictionary<string, string> PartialDigests,
    string ExpandedSha256,
    int EvaluationSteps,
    int LoopIterations,
    long ExpandedBytes,
    string Culture,
    string TimeZone);

public static class RenderOutputFormatExtensions
{
    private static readonly IReadOnlyDictionary<RenderOutputFormat, int> StableOrder = new Dictionary<RenderOutputFormat, int>
    {
        [RenderOutputFormat.InteractiveHtml] = 0,
        [RenderOutputFormat.StructuredJson] = 1,
        [RenderOutputFormat.StaticHtml] = 2,
        [RenderOutputFormat.Pdf] = 3,
        [RenderOutputFormat.PdfA] = 4,
        [RenderOutputFormat.Png] = 5,
        [RenderOutputFormat.Jpeg] = 6,
        [RenderOutputFormat.Svg] = 7
    };

    public static bool RequiresBrowser(this RenderOutputFormat format) => format is
        RenderOutputFormat.StaticHtml or RenderOutputFormat.Pdf or RenderOutputFormat.PdfA or
        RenderOutputFormat.Png or RenderOutputFormat.Jpeg or RenderOutputFormat.Svg;

    public static IReadOnlyList<RenderOutputFormat> NormalizeOutputSet(this IEnumerable<RenderOutputFormat> formats)
    {
        ArgumentNullException.ThrowIfNull(formats);
        var values = formats.ToArray();
        if (values.Length == 0) throw new ArgumentException("At least one output format is required.", nameof(formats));
        var duplicate = values.GroupBy(value => value).FirstOrDefault(group => group.Count() > 1);
        if (duplicate is not null) throw new ArgumentException($"Duplicate output format: {duplicate.Key}.", nameof(formats));
        return values.OrderBy(value => StableOrder[value]).ToArray();
    }

    public static string OutputExtension(this RenderOutputFormat format) => format switch
    {
        RenderOutputFormat.InteractiveHtml or RenderOutputFormat.StaticHtml => "html",
        RenderOutputFormat.StructuredJson => "json",
        RenderOutputFormat.Pdf or RenderOutputFormat.PdfA => "pdf",
        RenderOutputFormat.Png => "png",
        RenderOutputFormat.Jpeg => "jpg",
        RenderOutputFormat.Svg => "svg",
        _ => throw new ArgumentOutOfRangeException(nameof(format), format, "Unsupported output format.")
    };
}

public interface IDocumentCompiler
{
    DocumentSourceType SourceType { get; }
    ValueTask<CompiledDocument> CompileAsync(SourceDocument source, CancellationToken cancellationToken = default);
}

public interface IHtmlDocumentRenderer
{
    ValueTask<RenderedHtml> RenderAsync(CompiledDocument document, RenderOptions options, CancellationToken cancellationToken = default);
}
