using PdfSharp.Pdf;
using PdfSharp.Drawing;
using PdfSharp.Pdf.IO;
using Rune.Core;
using Rune.Job.Contracts;

namespace Rune.Export.Pdf;

public sealed record NativePdfCompositionPage(
    string ImportId,
    string ResourcePath,
    int SourcePage,
    int OutputPage,
    double WidthPoints,
    double HeightPoints,
    int Rotation,
    int PreservedLinkCount);

public sealed record NativePdfCompositionResult(
    byte[] Content,
    IReadOnlyList<NativePdfCompositionPage> Pages);

public static class NativePdfPageComposer
{
    public static NativePdfCompositionResult Compose(
        byte[] basePdf,
        IReadOnlyList<NativePdfImportPlan> plans,
        IReadOnlyList<RenderPackageResource> resources,
        IReadOnlyDictionary<string, int> markerPages)
    {
        ArgumentNullException.ThrowIfNull(basePdf);
        ArgumentNullException.ThrowIfNull(plans);
        ArgumentNullException.ThrowIfNull(resources);
        ArgumentNullException.ThrowIfNull(markerPages);

        using var baseStream = new MemoryStream(basePdf, writable: false);
        using var outputDocument = PdfReader.Open(baseStream, PdfDocumentOpenMode.Modify);
        var resourceMap = resources.ToDictionary(item => item.Path, StringComparer.OrdinalIgnoreCase);
        var sourceDocuments = new Dictionary<string, (MemoryStream Stream, PdfDocument Document)>(StringComparer.OrdinalIgnoreCase);
        var composedPages = new List<NativePdfCompositionPage>();
        try
        {
            foreach (var plan in plans.Where(item => item.AppliedMode == PdfImportMode.NativePage))
            {
                if (!resourceMap.TryGetValue(plan.ResourcePath, out var resource))
                    throw new InvalidOperationException($"Native PDF resource '{plan.ResourcePath}' was not found in the render package.");
                if (!sourceDocuments.TryGetValue(plan.ResourcePath, out var source))
                {
                    var sourceStream = new MemoryStream(resource.Content, writable: false);
                    var sourceDocument = PdfReader.Open(sourceStream, plan.Password ?? string.Empty, PdfDocumentOpenMode.Import);
                    source = (sourceStream, sourceDocument);
                    sourceDocuments[plan.ResourcePath] = source;
                }

                foreach (var descriptor in plan.Pages.OrderBy(item => item.SourcePage))
                {
                    if (!markerPages.TryGetValue(descriptor.Marker, out var outputPage))
                        throw new InvalidOperationException($"Native PDF marker '{descriptor.Marker}' was not found in the Chromium PDF.");
                    if (outputPage < 1 || outputPage > outputDocument.PageCount)
                        throw new InvalidOperationException($"Native PDF marker '{descriptor.Marker}' resolved outside the output page range.");
                    if (descriptor.SourcePage < 1 || descriptor.SourcePage > source.Document.PageCount)
                        throw new InvalidOperationException($"Source page {descriptor.SourcePage} is outside '{plan.ResourcePath}'.");

                    var imported = outputDocument.Pages.Insert(outputPage - 1, source.Document.Pages[descriptor.SourcePage - 1]);
                    outputDocument.Pages.RemoveAt(outputPage);
                    imported.Elements.Remove("/Annots");
                    imported.Elements.Remove("/AA");
                    var preservedLinks = 0;
                    if (plan.Annotations.Links == PdfLinkAnnotationPolicy.Preserve)
                    {
                        foreach (var link in descriptor.Links)
                        {
                            imported.AddWebLink(new PdfRectangle(new XPoint(link.X1, link.Y1), new XPoint(link.X2, link.Y2)), link.Target);
                            preservedLinks++;
                        }
                    }
                    composedPages.Add(new NativePdfCompositionPage(plan.ImportId, plan.ResourcePath, descriptor.SourcePage,
                        outputPage, descriptor.WidthPoints, descriptor.HeightPoints, descriptor.Rotation, preservedLinks));
                }
            }
            using var output = new MemoryStream();
            outputDocument.Save(output, closeStream: false);
            return new NativePdfCompositionResult(output.ToArray(), composedPages.OrderBy(item => item.OutputPage).ToArray());
        }
        finally
        {
            foreach (var source in sourceDocuments.Values)
            {
                source.Document.Dispose();
                source.Stream.Dispose();
            }
        }
    }
}
