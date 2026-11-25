using Rune.Core;

namespace Rune.Export.Pdf;

public static class PdfExportPolicy
{
    private static readonly HashSet<string> SupportedPageSizes = new(StringComparer.OrdinalIgnoreCase)
    {
        "A3", "A4", "A5", "Letter", "Legal", "Tabloid"
    };

    public const string Extension = "pdf";
    public const string ContentType = "application/pdf";

    public static void Validate(RenderOptions options)
    {
        if (!SupportedPageSizes.Contains(options.PageSize))
            throw new ArgumentException($"Unsupported PDF page size: {options.PageSize}.", nameof(options));
    }
}
