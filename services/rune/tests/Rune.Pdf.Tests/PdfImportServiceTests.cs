using System.Text;
using Rune.Core;
using Xunit;

namespace Rune.Pdf.Tests;

public sealed class PdfImportServiceTests
{
    private readonly PdfImportService _service = new(new StubOcrProvider(false, string.Empty));

    [Fact]
    public async Task Semantic_mode_emits_reflowable_text_and_report()
    {
        var result = await _service.ConvertAsync(new PdfImportRequest(
            CreatePdf("Hello RUNE semantic conversion"),
            new PdfImportOptions(Mode: PdfImportMode.Semantic, SemanticConfidenceThreshold: 0.2)));

        Assert.Contains("rune-pdf-semantic-page", result.Html, StringComparison.Ordinal);
        Assert.Contains("Hello RUNE semantic conversion", result.Html, StringComparison.Ordinal);
        Assert.Equal(PdfImportMode.Semantic, result.Report.RequestedMode);
        Assert.Equal("semantic-reflow", result.Report.Pages.Single().Strategy);
        Assert.DoesNotContain("data:image/bmp", result.Html, StringComparison.Ordinal);
        Assert.Equal("1.1", result.Report.SchemaVersion);
    }

    [Fact]
    public async Task Visual_mode_renders_page_as_self_contained_image()
    {
        var result = await _service.ConvertAsync(new PdfImportRequest(
            CreatePdf("Visual page"),
            new PdfImportOptions(Mode: PdfImportMode.Visual, VisualScale: 1)));

        Assert.Contains("rune-pdf-visual-page", result.Html, StringComparison.Ordinal);
        Assert.Contains("data:image/bmp;base64,Qk", result.Html, StringComparison.Ordinal);
        Assert.Equal("visual-raster", result.Report.Pages.Single().Strategy);
        Assert.Contains(result.Report.Engines, engine => engine.Name == "Docnet.Core/PDFium");
    }

    [Fact]
    public async Task Hybrid_mode_records_page_level_visual_fallback()
    {
        var result = await _service.ConvertAsync(new PdfImportRequest(
            CreatePdf(null),
            new PdfImportOptions(Mode: PdfImportMode.Hybrid, VisualScale: 1)));

        var page = Assert.Single(result.Report.Pages);
        Assert.True(page.Fallback);
        Assert.Equal("no-text-layer", page.FallbackReason);
        Assert.Equal("visual-raster", page.Strategy);
        Assert.Contains("data:image/bmp", result.Html, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Hybrid_mode_keeps_semantic_page_when_confidence_is_sufficient()
    {
        var result = await _service.ConvertAsync(new PdfImportRequest(
            CreatePdf("Hybrid semantic page with enough readable words for explicit selection"),
            new PdfImportOptions(Mode: PdfImportMode.Hybrid, SemanticConfidenceThreshold: 0.2, VisualScale: 1)));

        var page = Assert.Single(result.Report.Pages);
        Assert.False(page.Fallback);
        Assert.Equal("semantic-reflow", page.Strategy);
        Assert.Contains("Hybrid semantic page", result.Html, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Invalid_signature_is_rejected_with_stable_code()
    {
        var exception = await Assert.ThrowsAsync<PdfImportException>(() =>
            _service.ConvertAsync(new PdfImportRequest("not-a-pdf"u8.ToArray(), new PdfImportOptions())));
        Assert.Equal("pdf-invalid", exception.Code);
    }

    [Fact]
    public async Task Ocr_request_is_rejected_when_provider_is_unavailable()
    {
        var exception = await Assert.ThrowsAsync<PdfImportException>(() =>
            _service.ConvertAsync(new PdfImportRequest(CreatePdf("OCR"), new PdfImportOptions(OcrMode: PdfOcrMode.Auto))));
        Assert.Equal("pdf-ocr-provider-unavailable", exception.Code);
    }

    [Fact]
    public async Task Forced_ocr_uses_provider_and_emits_searchable_text()
    {
        var service = new PdfImportService(new StubOcrProvider(true, "Recognized RUNE text"));
        var result = await service.ConvertAsync(new PdfImportRequest(
            CreatePdf(null),
            new PdfImportOptions(Mode: PdfImportMode.Semantic, OcrMode: PdfOcrMode.Force, VisualScale: 1)));

        Assert.Contains("Recognized RUNE text", result.Html, StringComparison.Ordinal);
        Assert.Contains("rune-pdf-ocr-page", result.Html, StringComparison.Ordinal);
        Assert.Equal("ocr-visual-text", result.Report.Pages.Single().Strategy);
        Assert.Contains(result.Report.Engines, engine => engine.Name == "Stub OCR");
    }

    [Fact]
    public async Task Password_protected_pdf_is_rejected_even_with_a_password()
    {
        var bytes = await File.ReadAllBytesAsync(Path.Combine(AppContext.BaseDirectory, "Fixtures", "encrypted-password.pdf"));
        var exception = await Assert.ThrowsAsync<PdfImportException>(() => _service.ConvertAsync(new PdfImportRequest(bytes,
            new PdfImportOptions(Mode: PdfImportMode.Semantic, SemanticConfidenceThreshold: 0.1, Password: "rune-test"))));
        Assert.Equal("pdf-encrypted-not-supported", exception.Code);
    }

    [Fact]
    public async Task Password_protected_pdf_rejects_missing_password()
    {
        var bytes = await File.ReadAllBytesAsync(Path.Combine(AppContext.BaseDirectory, "Fixtures", "encrypted-password.pdf"));
        var exception = await Assert.ThrowsAsync<PdfImportException>(() => _service.ConvertAsync(new PdfImportRequest(bytes,
            new PdfImportOptions(Mode: PdfImportMode.Semantic, SemanticConfidenceThreshold: 0.1))));
        Assert.Equal("pdf-encrypted-not-supported", exception.Code);
    }

    [Fact]
    public async Task Uri_link_annotations_are_preserved_as_safe_anchors()
    {
        var result = await _service.ConvertAsync(new PdfImportRequest(CreateLinkedPdf(),
            new PdfImportOptions(Mode: PdfImportMode.Semantic, SemanticConfidenceThreshold: 0.1, PreserveLinks: true)));

        Assert.Contains("href=\"https://example.com/rune\"", result.Html, StringComparison.Ordinal);
        Assert.Equal(1, result.Report.Pages.Single().LinkCount);
    }

    [Fact]
    public async Task Embedded_images_are_extracted_and_embedded_in_semantic_output()
    {
        var result = await _service.ConvertAsync(new PdfImportRequest(CreateImagePdf(),
            new PdfImportOptions(Mode: PdfImportMode.Semantic, SemanticConfidenceThreshold: 0, ExtractImages: true)));

        var artifact = Assert.Single(result.Artifacts);
        Assert.Equal("image/bmp", artifact.ContentType);
        Assert.StartsWith("BM", Encoding.ASCII.GetString(artifact.Content, 0, 2), StringComparison.Ordinal);
        Assert.Contains("rune-pdf-extracted-images", result.Html, StringComparison.Ordinal);
        Assert.Equal(1, result.Report.Pages.Single().ImageCount);
        Assert.Single(result.Report.ExtractedArtifacts);
    }

    [Fact]
    public void Native_page_plan_preserves_page_geometry_and_safe_links()
    {
        var plan = NativePdfImportPlanner.Plan(CreateLinkedPdf(), "parts/linked.pdf",
            new PdfImportOptions(Mode: PdfImportMode.NativePage, Signatures: PdfSignaturePolicy.Reject,
                Forms: PdfFormPolicy.Flatten, Annotations: new PdfAnnotationPolicies(), JavaScript: PdfJavaScriptPolicy.Remove,
                Fallback: PdfImportFallbackPolicy.Visual));

        Assert.Equal(PdfImportMode.NativePage, plan.AppliedMode);
        var page = Assert.Single(plan.Pages);
        Assert.Equal(612, page.WidthPoints);
        Assert.Equal(792, page.HeightPoints);
        Assert.Equal([0d, 0d, 612d, 792d], page.MediaBox);
        Assert.Equal("https://example.com/rune", Assert.Single(page.Links).Target);
    }

    [Fact]
    public void Native_page_form_flatten_uses_explicit_visual_fallback()
    {
        var plan = NativePdfImportPlanner.Plan(CreateFormPdf(), "parts/form.pdf",
            new PdfImportOptions(Mode: PdfImportMode.NativePage, Forms: PdfFormPolicy.Flatten,
                Signatures: PdfSignaturePolicy.Ignore, Fallback: PdfImportFallbackPolicy.Visual));

        Assert.Equal(PdfImportMode.Visual, plan.AppliedMode);
        Assert.Equal("form-flatten-required", plan.FallbackReason);
        Assert.True(plan.FormDetected);
    }

    [Fact]
    public void Native_page_signature_reject_fails_with_stable_code()
    {
        var exception = Assert.Throws<PdfImportException>(() => NativePdfImportPlanner.Plan(CreateSignatureMarkerPdf(), "parts/signed.pdf",
            new PdfImportOptions(Mode: PdfImportMode.NativePage, Signatures: PdfSignaturePolicy.Reject)));
        Assert.Equal("pdf-signature-rejected", exception.Code);
    }

    [Fact]
    public async Task Native_page_pdf_to_html_reports_visual_fallback()
    {
        var result = await _service.ConvertAsync(new PdfImportRequest(CreatePdf("Native request"),
            new PdfImportOptions(Mode: PdfImportMode.NativePage, VisualScale: 1)));

        Assert.Equal(PdfImportMode.NativePage, result.Report.RequestedMode);
        Assert.Equal(PdfImportMode.Visual, result.Report.EffectiveMode);
        Assert.Contains("visual fallback", result.Report.Warnings.Single(), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Source_size_limit_is_enforced_before_parsing()
    {
        var pdf = CreatePdf("size limit");
        var exception = await Assert.ThrowsAsync<PdfImportException>(() =>
            _service.ConvertAsync(new PdfImportRequest(pdf, new PdfImportOptions(MaximumSourceBytes: pdf.Length - 1))));
        Assert.Equal("pdf-limit-exceeded", exception.Code);
    }

    private static byte[] CreatePdf(string? text)
    {
        var content = text is null ? string.Empty : $"BT /F1 18 Tf 72 720 Td ({EscapePdf(text)}) Tj ET";
        return BuildPdf([
            Ascii("<< /Type /Catalog /Pages 2 0 R >>"),
            Ascii("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
            Ascii("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>"),
            Ascii("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"),
            Stream(Ascii(content), $"/Length {Encoding.ASCII.GetByteCount(content)}")
        ]);
    }

    private static byte[] CreateLinkedPdf()
    {
        var content = Ascii("BT /F1 18 Tf 72 720 Td (RUNE link) Tj ET");
        return BuildPdf([
            Ascii("<< /Type /Catalog /Pages 2 0 R >>"),
            Ascii("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
            Ascii("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R /Annots [6 0 R] >>"),
            Ascii("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"),
            Stream(content, $"/Length {content.Length}"),
            Ascii("<< /Type /Annot /Subtype /Link /Rect [72 710 180 740] /Border [0 0 0] /A << /S /URI /URI (https://example.com/rune) >> >>")
        ]);
    }

    private static byte[] CreateFormPdf()
    {
        var content = Ascii("BT /F1 18 Tf 72 720 Td (Form page) Tj ET");
        return BuildPdf([
            Ascii("<< /Type /Catalog /Pages 2 0 R /AcroForm 6 0 R >>"),
            Ascii("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
            Ascii("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R /Annots [7 0 R] >>"),
            Ascii("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"),
            Stream(content, $"/Length {content.Length}"),
            Ascii("<< /Fields [7 0 R] >>"),
            Ascii("<< /Type /Annot /Subtype /Widget /FT /Tx /T (name) /Rect [72 650 250 680] /V (RUNE) >>")
        ]);
    }

    private static byte[] CreateSignatureMarkerPdf()
    {
        var pdf = CreatePdf("Signed marker");
        var marker = Ascii("\n% /Type /Sig /ByteRange [0 1 2 3]\n");
        return [.. pdf, .. marker];
    }

    private static byte[] CreateImagePdf()
    {
        var content = Ascii("q 100 0 0 100 72 600 cm /Im1 Do Q");
        return BuildPdf([
            Ascii("<< /Type /Catalog /Pages 2 0 R >>"),
            Ascii("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
            Ascii("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>"),
            Stream(content, $"/Length {content.Length}"),
            Stream([255, 0, 0], "/Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length 3")
        ]);
    }

    private static byte[] BuildPdf(IReadOnlyList<byte[]> objects)
    {
        using var output = new MemoryStream();
        Write(output, "%PDF-1.4\n%RUNE\n");
        var offsets = new List<long> { 0 };
        for (var i = 0; i < objects.Count; i++)
        {
            offsets.Add(output.Position);
            Write(output, $"{i + 1} 0 obj\n");
            output.Write(objects[i]);
            Write(output, "\nendobj\n");
        }
        var xref = output.Position;
        Write(output, $"xref\n0 {objects.Count + 1}\n0000000000 65535 f \n");
        foreach (var offset in offsets.Skip(1)) Write(output, $"{offset:D10} 00000 n \n");
        Write(output, $"trailer\n<< /Size {objects.Count + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n");
        return output.ToArray();
    }

    private static byte[] Stream(byte[] content, string dictionaryEntries)
    {
        using var output = new MemoryStream();
        Write(output, $"<< {dictionaryEntries} >>\nstream\n");
        output.Write(content);
        Write(output, "\nendstream");
        return output.ToArray();
    }

    private static byte[] Ascii(string value) => Encoding.ASCII.GetBytes(value);
    private static void Write(Stream stream, string value) => stream.Write(Ascii(value));
    private static string EscapePdf(string value) => value.Replace("\\", "\\\\", StringComparison.Ordinal)
        .Replace("(", "\\(", StringComparison.Ordinal).Replace(")", "\\)", StringComparison.Ordinal);

    private sealed class StubOcrProvider(bool available, string text) : IPdfOcrProvider
    {
        public string Name => "Stub OCR";
        public string Version => "1.0";
        public bool IsAvailable => available;
        public string Recognize(byte[] image, string language, CancellationToken cancellationToken) => text;
    }
}
