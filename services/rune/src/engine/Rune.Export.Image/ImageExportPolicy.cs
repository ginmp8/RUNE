using Rune.Core;

namespace Rune.Export.Image;

public sealed record ImageExportDescriptor(string Extension, string ContentType);

public static class ImageExportPolicy
{
    public static ImageExportDescriptor Describe(RenderOutputFormat format) => format switch
    {
        RenderOutputFormat.Png => new("png", "image/png"),
        RenderOutputFormat.Jpeg => new("jpg", "image/jpeg"),
        _ => throw new ArgumentOutOfRangeException(nameof(format), format, "The output is not a supported image format.")
    };
}
