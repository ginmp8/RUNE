using System.Text;
using Rune.Api.Contracts;
using Rune.Application;

namespace Rune.Engine.Tests;

public sealed class ArtifactComparisonTests
{
    [Fact]
    public void Detects_semantically_equivalent_json_with_different_bytes()
    {
        var service = new ArtifactComparisonService();
        var left = Input("left.json", "{\"b\":2,\"a\":1}\n", "application/json");
        var right = Input("right.json", "{ \"a\": 1, \"b\": 2 }", "application/json");
        var result = service.Compare(new ArtifactComparisonRequest(left, right));
        Assert.False(result.Identical);
        Assert.True(result.SemanticallyEquivalent);
        Assert.Equal(result.Left.NormalizedTextSha256, result.Right.NormalizedTextSha256);
        Assert.NotEmpty(result.DifferenceRanges);
    }

    [Fact]
    public void Reports_png_dimensions_and_bounded_byte_ranges()
    {
        var leftBytes = PngHeader(320, 200, 1);
        var rightBytes = PngHeader(640, 480, 2);
        var service = new ArtifactComparisonService();
        var result = service.Compare(new ArtifactComparisonRequest(
            new ArtifactComparisonInput("left.png", Convert.ToBase64String(leftBytes), "image/png"),
            new ArtifactComparisonInput("right.png", Convert.ToBase64String(rightBytes), "image/png"),
            MaximumReportedRanges: 2));
        Assert.False(result.Identical);
        Assert.Equal(320, result.Left.Width);
        Assert.Equal(200, result.Left.Height);
        Assert.Equal(640, result.Right.Width);
        Assert.Equal(480, result.Right.Height);
        Assert.InRange(result.DifferenceRanges.Count, 1, 2);
    }

    private static ArtifactComparisonInput Input(string name, string value, string contentType) =>
        new(name, Convert.ToBase64String(Encoding.UTF8.GetBytes(value)), contentType);

    private static byte[] PngHeader(int width, int height, byte tail)
    {
        var bytes = new byte[25];
        new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }.CopyTo(bytes, 0);
        WriteBigEndian(bytes, 16, width);
        WriteBigEndian(bytes, 20, height);
        bytes[24] = tail;
        return bytes;
    }

    private static void WriteBigEndian(byte[] bytes, int offset, int value)
    {
        bytes[offset] = (byte)(value >> 24);
        bytes[offset + 1] = (byte)(value >> 16);
        bytes[offset + 2] = (byte)(value >> 8);
        bytes[offset + 3] = (byte)value;
    }
    [Fact]
    public async Task Canonicalizes_pdf_objects_and_ignores_volatile_metadata()
    {
        var left = "%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R /CreationDate (D:20260101) >> endobj\n2 0 obj << /Type /Pages /Count 0 >> endobj\n%%EOF";
        var right = "%PDF-1.4\n9 0 obj << /Type /Catalog /Pages 8 0 R /CreationDate (D:20260727) >> endobj\n8 0 obj << /Type /Pages /Count 0 >> endobj\n%%EOF";
        var result = await new ArtifactComparisonService().CompareAsync(new ArtifactComparisonRequest(
            Input("left.pdf", left, "application/pdf"), Input("right.pdf", right, "application/pdf"),
            Advanced: new ArtifactComparisonOptions(CanonicalizePdf: true)));
        Assert.NotNull(result.CanonicalPdf);
        Assert.True(result.CanonicalPdf!.Equivalent);
        Assert.True(result.SemanticallyEquivalent);
    }

    [Fact]
    public async Task Compares_pixels_and_ocr_for_visually_equivalent_svg_artifacts()
    {
        const string left = """<svg xmlns="http://www.w3.org/2000/svg" width="800" height="200"><rect width="100%" height="100%" fill="white"/><text x="40" y="120" font-family="DejaVu Sans" font-size="64" fill="black">RUNE 013</text></svg>""";
        const string right = """<svg xmlns="http://www.w3.org/2000/svg" width="800" height="200" data-version="other"><rect height="100%" width="100%" fill="white"/><text fill="black" font-size="64" font-family="DejaVu Sans" y="120" x="40">RUNE 013</text></svg>""";
        var result = await new ArtifactComparisonService().CompareAsync(new ArtifactComparisonRequest(
            Input("left.svg", left, "image/svg+xml"), Input("right.svg", right, "image/svg+xml"),
            Advanced: new ArtifactComparisonOptions(PixelComparison: true, OcrComparison: true, PixelTolerancePercent: 0.1,
                MaximumPixelMismatchRatio: 0.001, MinimumOcrSimilarity: 0.95, IncludePixelDiff: true)));
        Assert.NotNull(result.Pixel);
        Assert.True(result.Pixel!.Executed, result.Pixel.Diagnostic);
        Assert.True(result.Pixel.Equivalent);
        Assert.NotNull(result.Ocr);
        Assert.True(result.Ocr!.Executed, result.Ocr.Diagnostic);
        Assert.True(result.Ocr.Equivalent);
    }

    [Fact]
    public async Task Compares_every_page_of_multi_page_pdf_with_pixels_ocr_and_canonicalization()
    {
        var left = BuildTwoPagePdf("D:20260101000000Z");
        var right = BuildTwoPagePdf("D:20260727000000Z");
        var result = await new ArtifactComparisonService().CompareAsync(new ArtifactComparisonRequest(
            new ArtifactComparisonInput("left.pdf", Convert.ToBase64String(left), "application/pdf"),
            new ArtifactComparisonInput("right.pdf", Convert.ToBase64String(right), "application/pdf"),
            Advanced: new ArtifactComparisonOptions(PixelComparison: true, OcrComparison: true, CanonicalizePdf: true,
                PixelTolerancePercent: 0.1, MaximumPixelMismatchRatio: 0.0001, MinimumOcrSimilarity: 0.95, IncludePixelDiff: true)));
        Assert.False(result.Identical);
        Assert.True(result.CanonicalPdf!.Equivalent);
        Assert.True(result.Pixel!.Executed, result.Pixel.Diagnostic);
        Assert.True(result.Pixel.Equivalent);
        Assert.Equal(2, result.Pixel.ComparedPages);
        Assert.Empty(result.Pixel.DifferingPages!);
        Assert.True(result.Ocr!.Executed, result.Ocr.Diagnostic);
        Assert.True(result.Ocr.Equivalent);
        Assert.Equal(2, result.Ocr.ComparedPages);
    }

    [Fact]
    public async Task Produces_png_diff_artifact_for_changed_multi_page_pdf()
    {
        var left = BuildTwoPagePdf("D:20260101000000Z", secondPageText: "ORIGINAL SECOND PAGE");
        var right = BuildTwoPagePdf("D:20260727000000Z", secondPageText: "CHANGED SECOND PAGE");
        var result = await new ArtifactComparisonService().CompareAsync(new ArtifactComparisonRequest(
            new ArtifactComparisonInput("left.pdf", Convert.ToBase64String(left), "application/pdf"),
            new ArtifactComparisonInput("right.pdf", Convert.ToBase64String(right), "application/pdf"),
            Advanced: new ArtifactComparisonOptions(PixelComparison: true, PixelTolerancePercent: 0.1, MaximumPixelMismatchRatio: 0, IncludePixelDiff: true)));
        Assert.True(result.Pixel!.Executed, result.Pixel.Diagnostic);
        Assert.Equal(2, result.Pixel.ComparedPages);
        Assert.Contains(2, result.Pixel.DifferingPages!);
        Assert.False(string.IsNullOrWhiteSpace(result.Pixel.DiffImageBase64));
        var diffBytes = Convert.FromBase64String(result.Pixel.DiffImageBase64!);
        Assert.True(diffBytes.Length > 8);
        Assert.Equal(137, diffBytes[0]);
        Assert.Equal(80, diffBytes[1]);
        Assert.Equal(78, diffBytes[2]);
        Assert.Equal(71, diffBytes[3]);
    }

    private static byte[] BuildTwoPagePdf(string creationDate, string firstPageText = "RUNE PAGE ONE", string secondPageText = "RUNE PAGE TWO")
    {
        var objects = new[]
        {
            "<< /Type /Catalog /Pages 2 0 R >>",
            "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>",
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>",
            Stream($"BT /F1 28 Tf 45 105 Td ({EscapePdfText(firstPageText)}) Tj ET"),
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>",
            Stream($"BT /F1 28 Tf 45 105 Td ({EscapePdfText(secondPageText)}) Tj ET"),
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
            $"<< /Producer (RUNE test) /CreationDate ({creationDate}) >>"
        };
        using var output = new MemoryStream();
        void Write(string value)
        {
            var bytes = Encoding.ASCII.GetBytes(value);
            output.Write(bytes, 0, bytes.Length);
        }
        Write("%PDF-1.4\n%RUNE\n");
        var offsets = new List<long> { 0 };
        for (var index = 0; index < objects.Length; index++)
        {
            offsets.Add(output.Position);
            Write($"{index + 1} 0 obj\n{objects[index]}\nendobj\n");
        }
        var xref = output.Position;
        Write($"xref\n0 {objects.Length + 1}\n0000000000 65535 f \n");
        foreach (var offset in offsets.Skip(1)) Write($"{offset:0000000000} 00000 n \n");
        Write($"trailer\n<< /Size {objects.Length + 1} /Root 1 0 R /Info 8 0 R >>\nstartxref\n{xref}\n%%EOF\n");
        return output.ToArray();

        static string Stream(string content) => $"<< /Length {Encoding.ASCII.GetByteCount(content)} >>\nstream\n{content}\nendstream";
    }

    private static string EscapePdfText(string value) => value.Replace("\\", "\\\\").Replace("(", "\\(").Replace(")", "\\)");
}
