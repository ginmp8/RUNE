using PdfSharp.Drawing;
using PdfSharp.Pdf;
using PdfSharp.Pdf.IO;
using Rune.Core;
using Rune.Export.Pdf;
using Rune.Job.Contracts;

namespace Rune.Browser.Tests;

public sealed class NativePdfPageComposerTests
{
    [Fact]
    public void Replaces_marker_page_with_original_vector_page_geometry()
    {
        var source = CreateSourcePdf();
        var basePdf = CreateBasePdf();
        const string marker = "RUNENATIVE0123456789ABCDEF000001X";
        var plan = new NativePdfImportPlan(
            "0123456789abcdef", "parts/source.pdf", PdfImportMode.NativePage, PdfImportMode.NativePage, null, null,
            PdfSignaturePolicy.Reject, PdfFormPolicy.Flatten, new PdfAnnotationPolicies(), PdfJavaScriptPolicy.Remove,
            PdfImportFallbackPolicy.Visual, false, false, false, false, false,
            [new NativePdfPageDescriptor(1, marker, 400, 300, 0, [0, 0, 400, 300], null, null, null,
                [new NativePdfLink(10, 10, 100, 30, "https://example.com")])], []);

        var result = NativePdfPageComposer.Compose(basePdf, [plan],
            [new RenderPackageResource("parts/source.pdf", "application/pdf", source)],
            new Dictionary<string, int> { [marker] = 2 });

        using var stream = new MemoryStream(result.Content, writable: false);
        using var document = PdfReader.Open(stream, PdfDocumentOpenMode.Import);
        Assert.Equal(2, document.PageCount);
        Assert.Equal(400, document.Pages[1].Width.Point, 3);
        Assert.Equal(300, document.Pages[1].Height.Point, 3);
        var composed = Assert.Single(result.Pages);
        Assert.Equal(2, composed.OutputPage);
        Assert.Equal(1, composed.PreservedLinkCount);
    }

    private static byte[] CreateSourcePdf()
    {
        using var document = new PdfDocument();
        var page = document.AddPage();
        page.Width = XUnit.FromPoint(400);
        page.Height = XUnit.FromPoint(300);
        using (var graphics = XGraphics.FromPdfPage(page))
            graphics.DrawRectangle(XPens.Black, 20, 20, 120, 80);
        using var output = new MemoryStream();
        document.Save(output, closeStream: false);
        return output.ToArray();
    }

    private static byte[] CreateBasePdf()
    {
        using var document = new PdfDocument();
        document.AddPage();
        document.AddPage();
        using var output = new MemoryStream();
        document.Save(output, closeStream: false);
        return output.ToArray();
    }
}
