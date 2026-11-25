using System.Security.Cryptography;
using System.Text;
using Rune.Core;
using Rune.Event.Contracts;
using Rune.Job.Contracts;
using Rune.Storage.Abstractions;

namespace Rune.Jobs;

public sealed class RenderJobService(IRenderJobStore store)
{
    public async ValueTask<RenderJob> CreateAsync(
        string html,
        RenderOutputFormat format,
        RenderOptions options,
        RuneDocumentModel? documentModel,
        string? idempotencyKey,
        IReadOnlyList<RenderOutputFormat>? outputFormats = null,
        IReadOnlyList<RenderPackageResource>? resources = null,
        IReadOnlyList<NativePdfImportPlan>? nativePdfImports = null,
        string documentName = "document",
        TemplateExpansionMetadata? templateExpansion = null,
        string? assemblyManifestJson = null,
        IReadOnlyDictionary<string, string>? dispatchHeaders = null,
        CancellationToken cancellationToken = default)
    {
        var contentHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(html)));
        var id = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;
        var normalizedOutputs = outputFormats?.NormalizeOutputSet();
        var package = new RenderPackage(id, html, format, options, contentHash, now, documentModel,
            Resources: resources, OutputFormats: normalizedOutputs, NativePdfImports: nativePdfImports,
            DocumentName: documentName, TemplateExpansion: templateExpansion, AssemblyManifestJson: assemblyManifestJson);
        var packagePath = $"{id:N}/package.json";
        var job = new RenderJob(
            id, RenderJobStatus.Queued, format, options, packagePath, null, null,
            0, 4, null, now, null, null, idempotencyKey,
            ProgressPercent: 0, ProgressStage: "queued", UpdatedAt: now,
            DispatchHeaders: dispatchHeaders ?? RuneTelemetry.CaptureHeaders(), OutputFormats: normalizedOutputs,
            OutputProgress: normalizedOutputs?.Select(output => new RenderOutputProgress(output, RenderOutputState.Pending, 0, "pending")).ToArray());
        return await store.CreateAsync(job, package, cancellationToken);
    }

    public async ValueTask<RenderJob> CreatePdfAsync(
        byte[] pdf,
        string sourceResourcePath,
        PdfImportOptions importOptions,
        RenderOptions renderOptions,
        string? idempotencyKey,
        IReadOnlyDictionary<string, string>? dispatchHeaders = null,
        CancellationToken cancellationToken = default)
    {
        var contentHash = Convert.ToHexString(SHA256.HashData(pdf));
        var id = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;
        var package = new RenderPackage(
            id,
            string.Empty,
            RenderOutputFormat.StaticHtml,
            renderOptions,
            contentHash,
            now,
            ContractVersion: "1.1",
            SourceType: DocumentSourceType.Pdf,
            SourceResourcePath: sourceResourcePath,
            Resources: [new RenderPackageResource(sourceResourcePath, "application/pdf", pdf)],
            PdfImport: importOptions);
        var job = new RenderJob(
            id, RenderJobStatus.Queued, RenderOutputFormat.StaticHtml, renderOptions, $"{id:N}/package.json", null, null,
            0, 4, null, now, null, null, idempotencyKey,
            ProgressPercent: 0, ProgressStage: "queued", UpdatedAt: now,
            DispatchHeaders: dispatchHeaders ?? RuneTelemetry.CaptureHeaders());
        return await store.CreateAsync(job, package, cancellationToken);
    }
}
