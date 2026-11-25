using System.Diagnostics;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.RegularExpressions;
using Docnet.Core;
using Docnet.Core.Models;
using PdfLexer;
using PdfLexer.Content;
using PdfLexer.Content.Model;
using PdfLexer.DOM;
using Rune.Core;

namespace Rune.Pdf;

public interface IPdfImportService
{
    Task<PdfImportResult> ConvertAsync(PdfImportRequest request, CancellationToken cancellationToken = default);
}

public interface IPdfOcrProvider
{
    string Name { get; }
    string Version { get; }
    bool IsAvailable { get; }
    string Recognize(byte[] image, string language, CancellationToken cancellationToken);
}

public sealed class TesseractPdfOcrProvider : IPdfOcrProvider
{
    private static readonly Regex LanguagePattern = new("^[A-Za-z0-9_+.-]{2,64}$", RegexOptions.CultureInvariant);
    private readonly string _executable;
    private readonly Lazy<(bool Available, string Version)> _identity;

    public TesseractPdfOcrProvider(string? executable = null)
    {
        _executable = string.IsNullOrWhiteSpace(executable)
            ? Environment.GetEnvironmentVariable("RUNE_TESSERACT_PATH") ?? "tesseract"
            : executable;
        _identity = new(Probe, LazyThreadSafetyMode.ExecutionAndPublication);
    }

    public string Name => "Tesseract";
    public string Version => _identity.Value.Version;
    public bool IsAvailable => _identity.Value.Available;

    public string Recognize(byte[] image, string language, CancellationToken cancellationToken)
    {
        if (!IsAvailable) throw new PdfImportException("pdf-ocr-provider-unavailable", "Tesseract OCR is not available.");
        if (!LanguagePattern.IsMatch(language)) throw new PdfImportException("pdf-invalid-options", "OcrLanguage contains unsupported characters.");

        var input = Path.Combine(Path.GetTempPath(), $"rune-ocr-{Guid.NewGuid():N}.bmp");
        try
        {
            File.WriteAllBytes(input, image);
            using var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = _executable,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                }
            };
            process.StartInfo.ArgumentList.Add(input);
            process.StartInfo.ArgumentList.Add("stdout");
            process.StartInfo.ArgumentList.Add("-l");
            process.StartInfo.ArgumentList.Add(language);
            process.StartInfo.ArgumentList.Add("--dpi");
            process.StartInfo.ArgumentList.Add("150");
            if (!process.Start()) throw new PdfImportException("pdf-ocr-provider-unavailable", "Tesseract OCR could not be started.");
            var stdout = process.StandardOutput.ReadToEndAsync(cancellationToken);
            var stderr = process.StandardError.ReadToEndAsync(cancellationToken);
            process.WaitForExitAsync(cancellationToken).GetAwaiter().GetResult();
            var output = stdout.GetAwaiter().GetResult();
            var error = stderr.GetAwaiter().GetResult();
            if (process.ExitCode != 0)
                throw new PdfImportException("pdf-ocr-failed", $"Tesseract OCR failed with exit code {process.ExitCode}: {TrimDiagnostic(error)}");
            return output.Trim();
        }
        finally
        {
            try { if (File.Exists(input)) File.Delete(input); } catch { }
        }
    }

    private (bool Available, string Version) Probe()
    {
        try
        {
            using var process = Process.Start(new ProcessStartInfo
            {
                FileName = _executable,
                Arguments = "--version",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            });
            if (process is null) return (false, "unavailable");
            var line = process.StandardOutput.ReadLine() ?? process.StandardError.ReadLine() ?? string.Empty;
            if (!process.WaitForExit(3000) || process.ExitCode != 0) return (false, "unavailable");
            var version = line.Split(' ', StringSplitOptions.RemoveEmptyEntries).Skip(1).FirstOrDefault() ?? "unknown";
            return (true, version);
        }
        catch { return (false, "unavailable"); }
    }

    private static string TrimDiagnostic(string value) => value.Trim().ReplaceLineEndings(" ") is var text && text.Length > 300 ? text[..300] : text;
}

public sealed record PdfImportRequest(byte[] Content, PdfImportOptions Options, string SourceName = "input.pdf");
public sealed record PdfExtractedArtifact(string FileName, string ContentType, byte[] Content, int Page);
public sealed record PdfImportResult(string Html, PdfConversionReport Report, IReadOnlyList<PdfExtractedArtifact> Artifacts);
public sealed record PdfEngineIdentity(string Name, string Version, string License, string Role);
public sealed record PdfExtractedArtifactReport(string FileName, string ContentType, long Bytes, string Sha256, int Page);
public sealed record PdfFallbackRegion(
    int Page,
    double X,
    double Y,
    double Width,
    double Height,
    string Strategy,
    string Reason,
    double Confidence,
    string Provider);

public sealed record PdfPageConversion(
    int Page,
    double WidthPoints,
    double HeightPoints,
    int Rotation,
    string Strategy,
    double Confidence,
    bool Fallback,
    string? FallbackReason,
    int WordCount,
    int ImageCount,
    int LinkCount,
    IReadOnlyList<PdfFallbackRegion>? FallbackRegions = null,
    string TextOrigin = "original");
public sealed record PdfConversionReport(
    string SchemaVersion,
    string SourceSha256,
    long SourceBytes,
    string PdfVersion,
    int PageCount,
    bool Encrypted,
    PdfImportMode RequestedMode,
    PdfImportMode EffectiveMode,
    PdfOcrMode OcrMode,
    string OcrLanguage,
    IReadOnlyList<PdfEngineIdentity> Engines,
    IReadOnlyList<PdfPageConversion> Pages,
    IReadOnlyList<PdfExtractedArtifactReport> ExtractedArtifacts,
    IReadOnlyList<string> Warnings,
    long OutputBytes,
    long DurationMilliseconds,
    bool AtomicPublication,
    string SourceClassification = "reconstructed-from-pdf",
    string SemanticProvider = "PdfLexer",
    string VisualProvider = "Docnet.Core/PDFium",
    string? OcrProvider = null,
    string? OcrModel = null,
    string? OcrModelSha256 = null,
    bool NetworkDisabled = true,
    bool NonRootRequired = true,
    int ProviderTimeoutSeconds = 120,
    int ProviderMemoryLimitMegabytes = 1024);

public sealed class PdfImportException(string code, string message, Exception? innerException = null)
    : Exception(message, innerException)
{
    public string Code { get; } = code;
}

public sealed class PdfImportService(IPdfOcrProvider? ocrProvider = null) : IPdfImportService
{
    private const string PdfLexerVersion = "0.1.27";
    private const string DocnetVersion = "2.6.0";
    private static readonly HtmlEncoder Encoder = HtmlEncoder.Default;
    private readonly IPdfOcrProvider _ocrProvider = ocrProvider ?? new TesseractPdfOcrProvider();

    public Task<PdfImportResult> ConvertAsync(PdfImportRequest request, CancellationToken cancellationToken = default) =>
        Task.Run(() => ConvertCore(request, cancellationToken), cancellationToken);

    private PdfImportResult ConvertCore(PdfImportRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        var requestedMode = request.Options.Mode;
        var nativePageFallback = requestedMode == PdfImportMode.NativePage;
        if (nativePageFallback)
            request = request with { Options = request.Options with { Mode = PdfImportMode.Visual } };
        ValidateOptions(request.Options);
        ValidateSource(request.Content, request.Options);
        if (request.Options.OcrMode != PdfOcrMode.Off && !_ocrProvider.IsAvailable)
            throw new PdfImportException("pdf-ocr-provider-unavailable", "OCR was requested, but the configured OCR provider is unavailable.");

        var stopwatch = Stopwatch.StartNew();
        var sourceHash = Convert.ToHexString(SHA256.HashData(request.Content)).ToLowerInvariant();
        var warnings = new List<string>();
        if (nativePageFallback)
            warnings.Add("native-page is available only for PDF composite output; this PDF-to-HTML conversion applied visual fallback.");
        var artifacts = new List<PdfExtractedArtifact>();
        var convertedPages = new List<PdfPageConversion>();
        var pageHtml = new List<string>();
        string pdfVersion;
        int pageCount;
        bool encrypted;

        try
        {
            using var document = PdfDocument.Open(request.Content);
            encrypted = document.Trailer.ContainsKey(new PdfName("Encrypt"));
            if (encrypted) throw new PdfImportException("pdf-encrypted-not-supported", "Encrypted or permission-restricted PDFs are rejected by the stable contract.");
            pdfVersion = document.PdfVersion.ToString(CultureInfo.InvariantCulture);
            pageCount = document.Pages.Count;
            if (pageCount == 0) throw new PdfImportException("pdf-invalid", "The PDF contains no pages.");
            if (pageCount > request.Options.MaximumPages)
                throw new PdfImportException("pdf-limit-exceeded", $"The PDF contains {pageCount} pages; the configured limit is {request.Options.MaximumPages}.");

            using var visualDocument = NeedsVisualProvider(request.Options)
                ? DocLib.Instance.GetDocReader(request.Content, new PageDimensions(request.Options.VisualScale))
                : null;

            for (var index = 0; index < pageCount; index++)
            {
                cancellationToken.ThrowIfCancellationRequested();
                var pageNumber = index + 1;
                var page = document.Pages[index];
                var structured = page.GetStructuredText(new StructuredTextOptions
                {
                    Order = TextOrder.Reading,
                    Mode = StructuredTextMode.Deduplicated
                });
                var words = structured.Words;
                var confidence = CalculateConfidence(structured);
                var width = ToDouble(page.MediaBox.Width);
                var height = ToDouble(page.MediaBox.Height);
                var rotation = page.Rotate is null ? 0 : (int)page.Rotate;
                var links = request.Options.PreserveLinks ? ExtractLinks(page, pageNumber, warnings) : [];
                var pageArtifacts = request.Options.ExtractImages ? ExtractImages(page, pageNumber, warnings) : [];
                artifacts.AddRange(pageArtifacts);

                var shouldOcr = request.Options.OcrMode == PdfOcrMode.Force ||
                    request.Options.OcrMode == PdfOcrMode.Auto && confidence < request.Options.SemanticConfidenceThreshold;
                var useVisual = request.Options.Mode == PdfImportMode.Visual ||
                    request.Options.Mode == PdfImportMode.Hybrid && confidence < request.Options.SemanticConfidenceThreshold;
                if (request.Options.Mode == PdfImportMode.Semantic && !shouldOcr && confidence < request.Options.SemanticConfidenceThreshold)
                    throw new PdfImportException("pdf-semantic-confidence-too-low",
                        $"Page {pageNumber} semantic confidence {confidence:F2} is below the configured threshold {request.Options.SemanticConfidenceThreshold:F2}.");

                string html;
                string strategy;
                string? fallbackReason = null;
                var outputWordCount = words.Count;
                if (shouldOcr)
                {
                    if (visualDocument is null) throw new PdfImportException("pdf-engine-unavailable", "The visual PDF provider required by OCR is unavailable.");
                    var bmp = RenderPage(visualDocument, index);
                    var ocrText = _ocrProvider.Recognize(bmp, request.Options.OcrLanguage, cancellationToken);
                    if (string.IsNullOrWhiteSpace(ocrText))
                    {
                        if (request.Options.Mode == PdfImportMode.Semantic)
                            throw new PdfImportException("pdf-ocr-no-text", $"OCR produced no text for page {pageNumber}.");
                        html = ComposeVisualPage(pageNumber, width, height, rotation, bmp, links);
                        strategy = "visual-raster";
                        fallbackReason = "ocr-produced-no-text";
                    }
                    else
                    {
                        outputWordCount = CountWords(ocrText);
                        confidence = Math.Max(confidence, 0.8);
                        html = ComposeOcrPage(pageNumber, width, height, rotation, bmp, ocrText, links);
                        strategy = "ocr-visual-text";
                        fallbackReason = request.Options.OcrMode == PdfOcrMode.Force ? "ocr-forced" : "no-reliable-text-layer";
                    }
                }
                else if (useVisual)
                {
                    if (visualDocument is null) throw new PdfImportException("pdf-engine-unavailable", "The visual PDF provider is unavailable.");
                    var bmp = RenderPage(visualDocument, index);
                    html = ComposeVisualPage(pageNumber, width, height, rotation, bmp, links);
                    strategy = "visual-raster";
                    if (request.Options.Mode == PdfImportMode.Hybrid)
                        fallbackReason = words.Count == 0 ? "no-text-layer" : "semantic-confidence-below-threshold";
                }
                else
                {
                    html = ComposeSemanticPage(pageNumber, structured, links, pageArtifacts);
                    strategy = "semantic-reflow";
                }

                pageHtml.Add(html);
                var fallback = request.Options.Mode == PdfImportMode.Hybrid && (useVisual || shouldOcr);
                var fallbackRegions = fallback
                    ? new[] { new PdfFallbackRegion(pageNumber, 0, 0, width, height, strategy,
                        fallbackReason ?? "hybrid-provider-fallback", confidence,
                        shouldOcr ? _ocrProvider.Name : "Docnet.Core/PDFium") }
                    : Array.Empty<PdfFallbackRegion>();
                convertedPages.Add(new PdfPageConversion(pageNumber, width, height, rotation, strategy,
                    confidence, fallback, fallbackReason,
                    outputWordCount, pageArtifacts.Count, links.Count, fallbackRegions,
                    shouldOcr ? "ocr-derived" : "original-text-layer"));
            }
        }
        catch (PdfImportException) { throw; }
        catch (PdfLexerPasswordException exception)
        {
            throw new PdfImportException("pdf-encrypted-not-supported", "Encrypted or permission-restricted PDFs are rejected by the stable contract.", exception);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception exception)
        {
            throw new PdfImportException("pdf-invalid", "The PDF could not be parsed safely.", exception);
        }

        if (!request.Options.ExtractImages)
            warnings.Add("Image extraction was disabled by request.");

        var htmlDocument = ComposeDocument(request.SourceName, request.Options.Mode, pageHtml);
        var outputBytes = Encoding.UTF8.GetByteCount(htmlDocument);
        var extractedBytes = artifacts.Sum(item => item.Content.LongLength);
        if (outputBytes + extractedBytes > request.Options.MaximumOutputBytes)
            throw new PdfImportException("pdf-limit-exceeded", $"Generated HTML and extracted artifacts exceed the configured {request.Options.MaximumOutputBytes} byte limit.");

        stopwatch.Stop();
        var engines = new List<PdfEngineIdentity>
        {
            new("PdfLexer", PdfLexerVersion, "MIT", "structure-text-links-and-images")
        };
        if (NeedsVisualProvider(request.Options))
            engines.Add(new("Docnet.Core/PDFium", DocnetVersion, "MIT package metadata; bundled PDFium notices retained", "visual-page-rendering"));
        if (request.Options.OcrMode != PdfOcrMode.Off)
            engines.Add(new(_ocrProvider.Name, _ocrProvider.Version, "Apache-2.0", "optical-character-recognition"));
        var artifactReports = artifacts.Select(item => new PdfExtractedArtifactReport(
            item.FileName, item.ContentType, item.Content.LongLength,
            Convert.ToHexString(SHA256.HashData(item.Content)).ToLowerInvariant(), item.Page)).ToArray();
        var report = new PdfConversionReport(
            "1.1", sourceHash, request.Content.LongLength, pdfVersion, pageCount, encrypted,
            requestedMode, request.Options.Mode, request.Options.OcrMode, request.Options.OcrLanguage, engines,
            convertedPages, artifactReports, warnings.Distinct(StringComparer.Ordinal).ToArray(), outputBytes,
            stopwatch.ElapsedMilliseconds, false,
            OcrProvider: request.Options.OcrMode == PdfOcrMode.Off ? null : _ocrProvider.Name,
            OcrModel: request.Options.OcrModel,
            OcrModelSha256: request.Options.OcrModelSha256,
            NetworkDisabled: request.Options.DisableNetwork,
            NonRootRequired: request.Options.RequireNonRoot,
            ProviderTimeoutSeconds: request.Options.ProviderTimeoutSeconds,
            ProviderMemoryLimitMegabytes: request.Options.ProviderMemoryLimitMegabytes);
        return new PdfImportResult(htmlDocument, report, artifacts);
    }

    private static void ValidateOptions(PdfImportOptions options)
    {
        if (!Enum.IsDefined(options.Mode)) throw new PdfImportException("pdf-invalid-options", "A valid PDF conversion mode is required.");
        if (!Enum.IsDefined(options.OcrMode)) throw new PdfImportException("pdf-invalid-options", "A valid OCR mode is required.");
        if (!Enum.IsDefined(options.Signatures) || !Enum.IsDefined(options.Forms) || !Enum.IsDefined(options.JavaScript) || !Enum.IsDefined(options.Fallback))
            throw new PdfImportException("pdf-invalid-options", "Valid native PDF policy values are required.");
        var annotations = options.Annotations ?? new PdfAnnotationPolicies();
        if (!Enum.IsDefined(annotations.Links) || !Enum.IsDefined(annotations.Comments) || !Enum.IsDefined(annotations.Attachments))
            throw new PdfImportException("pdf-invalid-options", "Valid PDF annotation policy values are required.");
        if (options.SemanticConfidenceThreshold is < 0 or > 1) throw new PdfImportException("pdf-invalid-options", "SemanticConfidenceThreshold must be between 0 and 1.");
        if (options.MaximumPages is < 1 or > 2_000) throw new PdfImportException("pdf-invalid-options", "MaximumPages must be between 1 and 2000.");
        if (options.MaximumSourceBytes is < 1 or > 500_000_000) throw new PdfImportException("pdf-invalid-options", "MaximumSourceBytes is outside the supported range.");
        if (options.MaximumOutputBytes is < 1 or > 1_000_000_000) throw new PdfImportException("pdf-invalid-options", "MaximumOutputBytes is outside the supported range.");
        if (options.VisualScale is < 0.5 or > 4) throw new PdfImportException("pdf-invalid-options", "VisualScale must be between 0.5 and 4.");
        if (!Regex.IsMatch(options.OcrLanguage, "^[A-Za-z0-9_+.-]{2,64}$", RegexOptions.CultureInvariant))
            throw new PdfImportException("pdf-invalid-options", "OcrLanguage contains unsupported characters.");
        if (!string.IsNullOrWhiteSpace(options.Password) || !options.RejectEncryptedPdf)
            throw new PdfImportException("pdf-encrypted-not-supported", "Password-enabled PDF input is not part of the stable contract.");
        if (options.ProviderTimeoutSeconds is < 1 or > 3600 || options.ProviderMemoryLimitMegabytes is < 128 or > 32768)
            throw new PdfImportException("pdf-invalid-options", "Provider isolation limits are outside the supported range.");
        if (!options.DisableNetwork || !options.RequireNonRoot)
            throw new PdfImportException("pdf-invalid-options", "PDF providers must run with network disabled and non-root execution required.");
    }

    private static void ValidateSource(byte[] content, PdfImportOptions options)
    {
        if (content.Length == 0) throw new PdfImportException("pdf-source-missing", "The source PDF is empty.");
        if (content.LongLength > options.MaximumSourceBytes)
            throw new PdfImportException("pdf-limit-exceeded", $"The source PDF exceeds the configured {options.MaximumSourceBytes} byte limit.");
        if (content.Length < 8 || content.AsSpan(0, Math.Min(content.Length, 1024)).IndexOf("%PDF-"u8) < 0)
            throw new PdfImportException("pdf-invalid", "The source resource does not contain a valid PDF signature.");
    }

    private static bool NeedsVisualProvider(PdfImportOptions options) =>
        options.Mode is PdfImportMode.Visual or PdfImportMode.Hybrid || options.OcrMode != PdfOcrMode.Off;

    private static byte[] RenderPage(Docnet.Core.Readers.IDocReader document, int index)
    {
        using var visualPage = document.GetPageReader(index);
        var raster = visualPage.GetImage(RenderFlags.RenderAnnotations);
        return EncodeTopDownBgraBmp(visualPage.GetPageWidth(), visualPage.GetPageHeight(), raster);
    }

    private static double CalculateConfidence(StructuredTextPage page)
    {
        if (page.Words.Count == 0) return 0;
        var characterCount = page.Words.Sum(word => word.Text.Length);
        var paragraphSignal = Math.Min(0.25, page.Paragraphs.Count / 20d);
        var wordSignal = Math.Min(0.35, page.Words.Count / 100d);
        var characterSignal = Math.Min(0.25, characterCount / 1000d);
        var rotationPenalty = page.Words.Count(word => Math.Abs(word.Rotation) > 2) / (double)page.Words.Count * 0.2;
        return Math.Clamp(0.35 + paragraphSignal + wordSignal + characterSignal - rotationPenalty, 0, 1);
    }

    private static IReadOnlyList<PdfLink> ExtractLinks(PdfPage page, int pageNumber, List<string> warnings)
    {
        var result = new List<PdfLink>();
        var annotations = Resolve<PdfArray>(page.NativeObject.Get(new PdfName("Annots")));
        if (annotations is null) return result;
        foreach (var annotationObject in annotations)
        {
            var annotation = Resolve<PdfDictionary>(annotationObject);
            if (annotation is null || Resolve<PdfName>(annotation.Get(new PdfName("Subtype")))?.Value != "Link") continue;
            var action = Resolve<PdfDictionary>(annotation.Get(new PdfName("A")));
            var actionType = Resolve<PdfName>(action?.Get(new PdfName("S")))?.Value;
            var target = Resolve<PdfString>(action?.Get(new PdfName("URI")))?.Value;
            if (actionType != "URI" || string.IsNullOrWhiteSpace(target))
            {
                warnings.Add($"Page {pageNumber}: an unsupported internal or non-URI link annotation was skipped.");
                continue;
            }
            if (!Uri.TryCreate(target, UriKind.Absolute, out var uri) || uri.Scheme is not ("http" or "https" or "mailto"))
            {
                warnings.Add($"Page {pageNumber}: an unsafe link annotation was skipped.");
                continue;
            }
            result.Add(new PdfLink(target, target));
        }
        return result.DistinctBy(item => item.Target, StringComparer.Ordinal).ToArray();
    }

    private static IReadOnlyList<PdfExtractedArtifact> ExtractImages(PdfPage page, int pageNumber, List<string> warnings)
    {
        var result = new List<PdfExtractedArtifact>();
        var imageIndex = 0;
        foreach (var group in page.GetContentModel(false))
        {
            if (group is not ImageContent<double> image) continue;
            imageIndex++;
            var extracted = TryExtractImage(image.Stream, pageNumber, imageIndex, warnings);
            if (extracted is not null) result.Add(extracted);
        }
        return result;
    }

    private static PdfExtractedArtifact? TryExtractImage(PdfStream stream, int pageNumber, int imageIndex, List<string> warnings)
    {
        try
        {
            var dictionary = stream.Dictionary;
            var widthValue = dictionary.GetRequiredValue<PdfNumber>(new PdfName("Width"));
            var heightValue = dictionary.GetRequiredValue<PdfNumber>(new PdfName("Height"));
            var width = (int)ToDouble(widthValue);
            var height = (int)ToDouble(heightValue);
            var bits = dictionary.GetOptionalValue<PdfNumber>(new PdfName("BitsPerComponent"));
            var bitsPerComponent = bits is null ? 8 : (int)ToDouble(bits);
            var colorSpace = Resolve<PdfName>(dictionary.Get(new PdfName("ColorSpace")))?.Value ?? "DeviceRGB";
            var filters = ReadFilterNames(dictionary.Get(new PdfName("Filter")));
            byte[] content;
            string extension;
            string contentType;
            if (filters.Contains("DCTDecode", StringComparer.Ordinal))
            {
                content = ReadAll(stream.Contents.GetEncodedData());
                extension = "jpg";
                contentType = "image/jpeg";
            }
            else if (filters.Contains("JPXDecode", StringComparer.Ordinal))
            {
                content = ReadAll(stream.Contents.GetEncodedData());
                extension = "jp2";
                contentType = "image/jp2";
            }
            else if (bitsPerComponent == 8 && colorSpace is "DeviceRGB" or "DeviceGray" or "DeviceCMYK")
            {
                content = EncodeRawImageBmp(width, height, colorSpace, stream.Contents.GetDecodedData());
                extension = "bmp";
                contentType = "image/bmp";
            }
            else
            {
                warnings.Add($"Page {pageNumber}: image {imageIndex} uses unsupported filters or color depth and was not extracted.");
                return null;
            }
            return new PdfExtractedArtifact($"page-{pageNumber:D3}-image-{imageIndex:D3}.{extension}", contentType, content, pageNumber);
        }
        catch (Exception exception)
        {
            warnings.Add($"Page {pageNumber}: image {imageIndex} could not be extracted ({exception.GetType().Name}).");
            return null;
        }
    }

    private static string[] ReadFilterNames(IPdfObject? value)
    {
        var resolved = Resolve(value);
        return resolved switch
        {
            PdfName name => [name.Value],
            PdfArray array => array.Select(item => Resolve<PdfName>(item)?.Value).Where(item => item is not null).Cast<string>().ToArray(),
            _ => []
        };
    }

    private static T? Resolve<T>(IPdfObject? value) where T : class, IPdfObject => Resolve(value) as T;
    private static IPdfObject? Resolve(IPdfObject? value)
    {
        while (value is PdfIndirectRef reference) value = reference.GetObject();
        return value;
    }

    private static string ComposeSemanticPage(int pageNumber, StructuredTextPage page, IReadOnlyList<PdfLink> links, IReadOnlyList<PdfExtractedArtifact> images)
    {
        var builder = new StringBuilder();
        builder.Append("<section class=\"rune-pdf-semantic-page\" data-page=\"").Append(pageNumber).Append("\">");
        builder.Append("<span class=\"rune-pdf-page-marker\" aria-hidden=\"true\">Page ").Append(pageNumber).Append("</span>");
        foreach (var paragraph in page.Paragraphs)
        {
            var text = paragraph.Text.Trim();
            if (text.Length == 0) continue;
            builder.Append("<p>").Append(Encoder.Encode(text)).Append("</p>");
        }
        if (page.Paragraphs.Count == 0 && page.Words.Count > 0)
            builder.Append("<p>").Append(Encoder.Encode(string.Join(' ', page.Words.Select(word => word.Text)))).Append("</p>");
        AppendImages(builder, images);
        AppendLinks(builder, links);
        builder.Append("</section>");
        return builder.ToString();
    }

    private static string ComposeOcrPage(int pageNumber, double width, double height, int rotation, byte[] bmp, string text, IReadOnlyList<PdfLink> links)
    {
        var builder = new StringBuilder();
        var data = Convert.ToBase64String(bmp);
        builder.Append(FormattableString.Invariant($"<section class=\"rune-pdf-ocr-page\" data-page=\"{pageNumber}\" data-rotation=\"{rotation}\" style=\"aspect-ratio:{width:F3}/{height:F3}\"><img alt=\"PDF page {pageNumber}\" src=\"data:image/bmp;base64,{data}\"><div class=\"rune-pdf-ocr-text\">") );
        foreach (var paragraph in text.Split(["\r\n\r\n", "\n\n"], StringSplitOptions.RemoveEmptyEntries))
            builder.Append("<p>").Append(Encoder.Encode(paragraph.Trim())).Append("</p>");
        builder.Append("</div>");
        AppendLinks(builder, links);
        builder.Append("</section>");
        return builder.ToString();
    }

    private static string ComposeVisualPage(int pageNumber, double width, double height, int rotation, byte[] bmp, IReadOnlyList<PdfLink> links)
    {
        var data = Convert.ToBase64String(bmp);
        var builder = new StringBuilder(FormattableString.Invariant($"<section class=\"rune-pdf-visual-page\" data-page=\"{pageNumber}\" data-rotation=\"{rotation}\" style=\"aspect-ratio:{width:F3}/{height:F3}\"><img alt=\"PDF page {pageNumber}\" src=\"data:image/bmp;base64,{data}\">"));
        AppendLinks(builder, links);
        builder.Append("</section>");
        return builder.ToString();
    }

    private static void AppendLinks(StringBuilder builder, IReadOnlyList<PdfLink> links)
    {
        if (links.Count == 0) return;
        builder.Append("<nav class=\"rune-pdf-links\" aria-label=\"Links from this PDF page\"><ul>");
        foreach (var link in links)
            builder.Append("<li><a rel=\"noopener noreferrer\" href=\"").Append(Encoder.Encode(link.Target)).Append("\">").Append(Encoder.Encode(link.Label)).Append("</a></li>");
        builder.Append("</ul></nav>");
    }

    private static void AppendImages(StringBuilder builder, IReadOnlyList<PdfExtractedArtifact> images)
    {
        if (images.Count == 0) return;
        builder.Append("<div class=\"rune-pdf-extracted-images\">");
        foreach (var image in images)
            builder.Append("<figure><img alt=\"Extracted PDF image\" src=\"data:").Append(image.ContentType).Append(";base64,").Append(Convert.ToBase64String(image.Content)).Append("\"><figcaption>").Append(Encoder.Encode(image.FileName)).Append("</figcaption></figure>");
        builder.Append("</div>");
    }

    private static string ComposeDocument(string sourceName, PdfImportMode mode, IReadOnlyList<string> pages)
    {
        var title = Encoder.Encode(Path.GetFileName(sourceName));
        return "<!doctype html><html lang=\"en\" data-rune-pdf-conversion=\"1\" data-rune-pdf-mode=\"" + mode.ToString().ToLowerInvariant() + "\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>" + title + "</title><style>" +
            "html{background:#e8e8e8}body{margin:0;padding:24px;font-family:system-ui,sans-serif;color:#111}.rune-pdf-visual-page,.rune-pdf-ocr-page{position:relative;max-width:1000px;margin:0 auto 24px;background:white;box-shadow:0 2px 12px #0003;overflow:hidden}.rune-pdf-visual-page>img,.rune-pdf-ocr-page>img{display:block;width:100%;height:100%;object-fit:contain}.rune-pdf-ocr-text{padding:24px 48px;border-top:1px solid #ddd}.rune-pdf-semantic-page{max-width:900px;margin:0 auto 24px;padding:48px;background:white;box-shadow:0 2px 12px #0002}.rune-pdf-semantic-page p,.rune-pdf-ocr-text p{line-height:1.5;white-space:pre-wrap}.rune-pdf-page-marker{display:block;color:#666;font-size:.75rem;border-bottom:1px solid #ddd;margin-bottom:1rem;padding-bottom:.5rem}.rune-pdf-links{padding:12px 24px;background:#f6f8fa}.rune-pdf-extracted-images{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px}.rune-pdf-extracted-images img{max-width:100%;height:auto}@media print{html{background:white}body{padding:0}.rune-pdf-visual-page,.rune-pdf-ocr-page,.rune-pdf-semantic-page{box-shadow:none;break-after:page;margin:0 auto}}" +
            "</style></head><body><main>" + string.Concat(pages) + "</main></body></html>";
    }

    private static byte[] EncodeTopDownBgraBmp(int width, int height, byte[] pixels)
    {
        var expected = checked(width * height * 4);
        if (width <= 0 || height <= 0 || pixels.Length < expected)
            throw new PdfImportException("pdf-output-invalid", "The visual provider returned an invalid page raster.");
        var result = new byte[54 + expected];
        result[0] = (byte)'B'; result[1] = (byte)'M';
        WriteInt32(result, 2, result.Length);
        WriteInt32(result, 10, 54);
        WriteInt32(result, 14, 40);
        WriteInt32(result, 18, width);
        WriteInt32(result, 22, -height);
        result[26] = 1;
        result[28] = 32;
        WriteInt32(result, 34, expected);
        var target = 54;
        for (var offset = 0; offset < expected; offset += 4)
        {
            var blue = pixels[offset];
            var green = pixels[offset + 1];
            var red = pixels[offset + 2];
            var alpha = pixels[offset + 3];
            result[target++] = BlendAgainstWhite(blue, alpha);
            result[target++] = BlendAgainstWhite(green, alpha);
            result[target++] = BlendAgainstWhite(red, alpha);
            result[target++] = byte.MaxValue;
        }
        return result;
    }

    private static byte BlendAgainstWhite(byte channel, byte alpha)
    {
        if (alpha == byte.MaxValue) return channel;
        var value = channel * alpha + byte.MaxValue * (byte.MaxValue - alpha);
        return (byte)((value + 127) / byte.MaxValue);
    }

    private static byte[] EncodeRawImageBmp(int width, int height, string colorSpace, byte[] pixels)
    {
        if (width <= 0 || height <= 0) throw new InvalidDataException("Invalid image dimensions.");
        var channels = colorSpace switch { "DeviceGray" => 1, "DeviceRGB" => 3, "DeviceCMYK" => 4, _ => 0 };
        if (channels == 0 || pixels.Length < checked(width * height * channels)) throw new InvalidDataException("Invalid image data.");
        var stride = (width * 3 + 3) & ~3;
        var result = new byte[54 + stride * height];
        result[0] = (byte)'B'; result[1] = (byte)'M';
        WriteInt32(result, 2, result.Length); WriteInt32(result, 10, 54); WriteInt32(result, 14, 40);
        WriteInt32(result, 18, width); WriteInt32(result, 22, -height); result[26] = 1; result[28] = 24;
        WriteInt32(result, 34, stride * height);
        for (var y = 0; y < height; y++)
        for (var x = 0; x < width; x++)
        {
            var source = (y * width + x) * channels;
            byte r, g, b;
            if (channels == 1) r = g = b = pixels[source];
            else if (channels == 3) { r = pixels[source]; g = pixels[source + 1]; b = pixels[source + 2]; }
            else
            {
                var c = pixels[source] / 255d; var m = pixels[source + 1] / 255d; var yy = pixels[source + 2] / 255d; var k = pixels[source + 3] / 255d;
                r = (byte)Math.Round(255 * (1 - c) * (1 - k)); g = (byte)Math.Round(255 * (1 - m) * (1 - k)); b = (byte)Math.Round(255 * (1 - yy) * (1 - k));
            }
            var target = 54 + y * stride + x * 3;
            result[target] = b; result[target + 1] = g; result[target + 2] = r;
        }
        return result;
    }

    private static byte[] ReadAll(Stream stream)
    {
        using (stream)
        using (var memory = new MemoryStream()) { stream.CopyTo(memory); return memory.ToArray(); }
    }

    private static int CountWords(string text) => Regex.Matches(text, @"\S+", RegexOptions.CultureInvariant).Count;

    private static void WriteInt32(byte[] target, int offset, int value)
    {
        target[offset] = (byte)value;
        target[offset + 1] = (byte)(value >> 8);
        target[offset + 2] = (byte)(value >> 16);
        target[offset + 3] = (byte)(value >> 24);
    }

    private static double ToDouble(PdfNumber number) => number;
    private sealed record PdfLink(string Target, string Label);
}
