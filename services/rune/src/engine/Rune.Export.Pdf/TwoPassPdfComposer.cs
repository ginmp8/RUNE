using PdfSharp.Drawing;
using PdfSharp.Pdf.IO;

namespace Rune.Export.Pdf;

public static class TwoPassPdfComposer
{
    public static int GetPageCount(byte[] pdf)
    {
        using var stream = new MemoryStream(pdf, writable: false);
        using var document = PdfReader.Open(stream, PdfDocumentOpenMode.Import);
        return document.PageCount;
    }

    public static byte[] Compose(byte[] basePdf, IReadOnlyDictionary<int, byte[]> pageOverlays)
    {
        using var baseStream = new MemoryStream(basePdf, writable: false);
        using var document = PdfReader.Open(baseStream, PdfDocumentOpenMode.Modify);
        foreach (var entry in pageOverlays.OrderBy(item => item.Key))
        {
            if (entry.Key < 1 || entry.Key > document.PageCount)
                throw new ArgumentOutOfRangeException(nameof(pageOverlays), $"Overlay page {entry.Key} is outside the PDF page range.");
            using var overlayStream = new MemoryStream(entry.Value, writable: false);
            using var form = XPdfForm.FromStream(overlayStream);
            form.PageNumber = 1;
            var page = document.Pages[entry.Key - 1];
            using var graphics = XGraphics.FromPdfPage(page, XGraphicsPdfPageOptions.Append);
            graphics.DrawImage(form, 0, 0, page.Width.Point, page.Height.Point);
        }
        using var output = new MemoryStream();
        document.Save(output, closeStream: false);
        return output.ToArray();
    }
}
