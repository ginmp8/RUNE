using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using PdfLexer;
using PdfLexer.DOM;
using Rune.Core;
using PdfSharp.Pdf.IO;

namespace Rune.Pdf;

public static class NativePdfImportPlanner
{
    public static NativePdfImportPlan Plan(byte[] content, string resourcePath, PdfImportOptions options)
    {
        ArgumentNullException.ThrowIfNull(content);
        ArgumentException.ThrowIfNullOrWhiteSpace(resourcePath);
        ArgumentNullException.ThrowIfNull(options);
        if (options.Mode != PdfImportMode.NativePage)
            throw new PdfImportException("pdf-native-mode-required", "Native PDF planning requires mode native-page.");
        if (content.Length == 0 || content.AsSpan(0, Math.Min(content.Length, 1024)).IndexOf("%PDF-"u8) < 0)
            throw new PdfImportException("pdf-invalid", "The source resource does not contain a valid PDF signature.");
        if (content.LongLength > options.MaximumSourceBytes)
            throw new PdfImportException("pdf-limit-exceeded", $"The source PDF exceeds the configured {options.MaximumSourceBytes} byte limit.");

        var annotations = options.Annotations ?? new PdfAnnotationPolicies();
        var raw = Encoding.Latin1.GetString(content);
        var signatureDetected = ContainsAny(raw, "/Type/Sig", "/Type /Sig", "/FT/Sig", "/FT /Sig", "/ByteRange");
        var formDetected = ContainsAny(raw, "/AcroForm", "/Subtype/Widget", "/Subtype /Widget");
        var javaScriptDetected = ContainsAny(raw, "/JavaScript", "/S/JavaScript", "/S /JavaScript", "/JS");
        var attachmentDetected = ContainsAny(raw, "/EmbeddedFiles", "/Filespec", "/Subtype/FileAttachment", "/Subtype /FileAttachment");
        var commentDetected = ContainsAny(raw, "/Subtype/Text", "/Subtype /Text", "/Subtype/FreeText", "/Subtype /FreeText", "/Subtype/Highlight", "/Subtype /Highlight", "/Subtype/Stamp", "/Subtype /Stamp");
        var warnings = new List<string>();
        string? fallbackReason = null;

        if (signatureDetected)
        {
            if (options.Signatures == PdfSignaturePolicy.Reject)
                throw new PdfImportException("pdf-signature-rejected", "The PDF contains a digital signature and signatures policy is reject.");
            if (options.Signatures == PdfSignaturePolicy.Flatten)
                fallbackReason = "signature-flatten-required";
            else
                warnings.Add("A digital signature was detected. Legal validity is not preserved; signature annotations are removed from the imported page.");
        }
        if (formDetected)
        {
            if (options.Forms == PdfFormPolicy.Reject)
                throw new PdfImportException("pdf-form-rejected", "The PDF contains an interactive form and forms policy is reject.");
            fallbackReason ??= "form-flatten-required";
        }
        if (attachmentDetected && annotations.Attachments == PdfAttachmentAnnotationPolicy.Reject)
            throw new PdfImportException("pdf-attachment-rejected", "The PDF contains an attachment and attachment annotations policy is reject.");
        if (commentDetected && annotations.Comments == PdfCommentAnnotationPolicy.Reject)
            throw new PdfImportException("pdf-comment-rejected", "The PDF contains a comment annotation and comments policy is reject.");
        if (commentDetected && annotations.Comments == PdfCommentAnnotationPolicy.Flatten)
            fallbackReason ??= "comment-flatten-required";
        if (javaScriptDetected && options.JavaScript == PdfJavaScriptPolicy.Reject)
            throw new PdfImportException("pdf-javascript-rejected", "The PDF contains JavaScript and javascript policy is reject.");
        if (javaScriptDetected)
            warnings.Add("PDF JavaScript was detected and is removed by importing page content without source annotations or document actions.");
        if (attachmentDetected)
            warnings.Add("PDF attachments are not copied into the output document.");
        if (commentDetected && annotations.Comments == PdfCommentAnnotationPolicy.Remove)
            warnings.Add("Comment annotations are removed from the imported pages.");

        if (ContainsAny(raw, "/ObjStm", "/Type/ObjStm", "/Type /ObjStm"))
        {
            if (options.Fallback == PdfImportFallbackPolicy.Reject)
                throw new PdfImportException("pdf-native-unsupported", "PDF object streams are not supported by the in-process native inspector and fallback policy is reject.");
            warnings.Add("PDF object streams require visual fallback because native inspection is isolated from unsupported parser structures.");
            var objectStreamImportId = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(resourcePath + ":object-stream")))[..16].ToLowerInvariant();
            return new NativePdfImportPlan(objectStreamImportId, resourcePath, PdfImportMode.NativePage, PdfImportMode.Visual,
                "unsupported-object-stream", options.Password, options.Signatures, options.Forms, annotations,
                options.JavaScript, options.Fallback, signatureDetected, formDetected, javaScriptDetected,
                attachmentDetected, commentDetected, [], warnings);
        }

        var pages = new List<NativePdfPageDescriptor>();
        try
        {
            var password = options.Password ?? string.Empty;
            using (var preflightStream = new MemoryStream(content, writable: false))
            using (var preflight = PdfReader.Open(preflightStream, password, PdfDocumentOpenMode.Import))
            {
                if (preflight.PageCount == 0)
                    throw new PdfImportException("pdf-invalid", "The PDF contains no pages.");
            }
            using var document = PdfLexer.PdfDocument.Open(content, new DocumentOptions { UserPass = password, OwnerPass = password });
            if (document.Pages.Count == 0)
                throw new PdfImportException("pdf-invalid", "The PDF contains no pages.");
            if (document.Pages.Count > options.MaximumPages)
                throw new PdfImportException("pdf-limit-exceeded", $"The PDF contains {document.Pages.Count} pages; the configured limit is {options.MaximumPages}.");
            var importId = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(resourcePath + ":" + Convert.ToHexString(SHA256.HashData(content)))))[..16].ToLowerInvariant();
            for (var index = 0; index < document.Pages.Count; index++)
            {
                var page = document.Pages[index];
                var pageNumber = index + 1;
                var rotation = page.Rotate is null ? 0 : NormalizeRotation((int)page.Rotate);
                var mediaBox = ReadBox(page.NativeObject.Get(new PdfName("MediaBox"))) ?? [0, 0, ToDouble(page.MediaBox.Width), ToDouble(page.MediaBox.Height)];
                var cropBox = ReadBox(page.NativeObject.Get(new PdfName("CropBox")));
                var trimBox = ReadBox(page.NativeObject.Get(new PdfName("TrimBox")));
                var bleedBox = ReadBox(page.NativeObject.Get(new PdfName("BleedBox")));
                var width = Math.Abs(mediaBox[2] - mediaBox[0]);
                var height = Math.Abs(mediaBox[3] - mediaBox[1]);
                var links = annotations.Links == PdfLinkAnnotationPolicy.Preserve ? ExtractLinks(page, pageNumber, warnings) : [];
                pages.Add(new NativePdfPageDescriptor(pageNumber, $"RUNENATIVE{importId.ToUpperInvariant()}{pageNumber:D6}X",
                    width, height, rotation, mediaBox, cropBox, trimBox, bleedBox, links));
            }
            var applied = fallbackReason is null ? PdfImportMode.NativePage : PdfImportMode.Visual;
            if (applied == PdfImportMode.Visual && options.Fallback == PdfImportFallbackPolicy.Reject)
                throw new PdfImportException("pdf-native-fallback-rejected", $"Native page import requires fallback because '{fallbackReason}', but fallback policy is reject.");
            return new NativePdfImportPlan(importId, resourcePath, PdfImportMode.NativePage, applied, fallbackReason,
                options.Password, options.Signatures, options.Forms, annotations, options.JavaScript, options.Fallback,
                signatureDetected, formDetected, javaScriptDetected, attachmentDetected, commentDetected,
                pages, warnings.Distinct(StringComparer.Ordinal).ToArray());
        }
        catch (PdfImportException) { throw; }
        catch (PdfLexerPasswordException exception)
        {
            throw new PdfImportException("pdf-password-required", "The PDF password is missing or invalid.", exception);
        }
        catch (Exception exception)
        {
            if (options.Fallback == PdfImportFallbackPolicy.Reject)
                throw new PdfImportException("pdf-native-unsupported", "The PDF cannot be imported as native pages and fallback policy is reject.", exception);
            warnings.Add($"Native PDF inspection failed ({exception.GetType().Name}); visual fallback is required.");
            var importId = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(resourcePath)))[..16].ToLowerInvariant();
            return new NativePdfImportPlan(importId, resourcePath, PdfImportMode.NativePage, PdfImportMode.Visual,
                "unsupported-pdf-structure", options.Password, options.Signatures, options.Forms, annotations,
                options.JavaScript, options.Fallback, signatureDetected, formDetected, javaScriptDetected,
                attachmentDetected, commentDetected, [], warnings);
        }
    }

    private static IReadOnlyList<NativePdfLink> ExtractLinks(PdfPage page, int pageNumber, List<string> warnings)
    {
        var result = new List<NativePdfLink>();
        var annotationArray = Resolve<PdfArray>(page.NativeObject.Get(new PdfName("Annots")));
        if (annotationArray is null) return result;
        foreach (var annotationObject in annotationArray)
        {
            var annotation = Resolve<PdfDictionary>(annotationObject);
            if (annotation is null || Resolve<PdfName>(annotation.Get(new PdfName("Subtype")))?.Value != "Link") continue;
            var action = Resolve<PdfDictionary>(annotation.Get(new PdfName("A")));
            var actionType = Resolve<PdfName>(action?.Get(new PdfName("S")))?.Value;
            var target = Resolve<PdfString>(action?.Get(new PdfName("URI")))?.Value;
            var rect = ReadBox(annotation.Get(new PdfName("Rect")));
            if (actionType != "URI" || string.IsNullOrWhiteSpace(target) || rect is null)
            {
                warnings.Add($"Page {pageNumber}: an unsupported internal, non-URI, or unbounded link annotation was removed.");
                continue;
            }
            if (!Uri.TryCreate(target, UriKind.Absolute, out var uri) || uri.Scheme is not ("http" or "https" or "mailto"))
            {
                warnings.Add($"Page {pageNumber}: an unsafe link annotation was removed.");
                continue;
            }
            result.Add(new NativePdfLink(rect[0], rect[1], rect[2], rect[3], target));
        }
        return result.Distinct().ToArray();
    }

    private static bool ContainsAny(string text, params string[] values) => values.Any(value => text.Contains(value, StringComparison.Ordinal));
    private static int NormalizeRotation(int value) => ((value % 360) + 360) % 360;
    private static double ToDouble(PdfNumber value) => value;

    private static double[]? ReadBox(IPdfObject? value)
    {
        var array = Resolve<PdfArray>(value);
        if (array is null || array.Count != 4) return null;
        var values = array.Select(item => Resolve<PdfNumber>(item)).ToArray();
        if (values.Any(item => item is null)) return null;
        return values.Select(item => ToDouble(item!)).ToArray();
    }

    private static T? Resolve<T>(IPdfObject? value) where T : class, IPdfObject => Resolve(value) as T;
    private static IPdfObject? Resolve(IPdfObject? value)
    {
        while (value is PdfIndirectRef reference) value = reference.GetObject();
        return value;
    }
}
