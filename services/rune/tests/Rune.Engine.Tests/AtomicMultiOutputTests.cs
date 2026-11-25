using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging.Abstractions;
using Rune.Browser;
using Rune.Core;
using Rune.Event.Contracts;
using Rune.Job.Contracts;
using Rune.Jobs;
using Rune.Messaging.Abstractions;
using Rune.Pdf;
using Rune.RenderProcessing;

namespace Rune.Engine.Tests;

public sealed class AtomicMultiOutputTests : IAsyncLifetime
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "rune-multi-output-tests", Guid.NewGuid().ToString("N"));

    [Fact]
    public async Task Publishes_manifest_and_all_artifacts_only_after_successful_job_completion()
    {
        var store = new FileSystemRenderJobStore(Path.Combine(_root, "jobs"));
        var model = RuneDocumentModelBuilder.FromCompiled(DocumentSourceType.Markdown, "Atomic", new Dictionary<string, object?>(),
            "<h1>Atomic</h1>", new HashSet<string>(), []);
        var service = new RenderJobService(store);
        var job = await service.CreateAsync("<html><body><h1>Atomic</h1></body></html>", RenderOutputFormat.InteractiveHtml,
            new RenderOptions(), model, null, [RenderOutputFormat.InteractiveHtml, RenderOutputFormat.StructuredJson]);
        await using var browser = new PlaywrightRenderService();
        var processor = new RenderJobProcessor(new CapturingLifecyclePublisher(), store, browser, new PdfImportService(),
            new FileSystemRenderCache(Path.Combine(_root, "cache")), NullLogger<RenderJobProcessor>.Instance);
        var command = new RenderRequested(new EventMetadata(Guid.NewGuid(), job.Id, null, "1.0", DateTimeOffset.UtcNow), job.Id, job.PackagePath);
        Assert.Equal(RenderProcessOutcome.Acknowledge, await processor.ProcessAsync(command));
        var completed = await store.GetAsync(job.Id);
        Assert.Equal(RenderJobStatus.Completed, completed?.Status);
        await using var result = await store.OpenResultAsync(job.Id);
        Assert.NotNull(result);
        var jsonOptions = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        jsonOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
        var manifest = await JsonSerializer.DeserializeAsync<RenderArtifactSetManifest>(result!, jsonOptions);
        Assert.NotNull(manifest);
        Assert.True(manifest!.AtomicPublication);
        Assert.Equal(2, manifest.Artifacts.Count);
        Assert.Contains(manifest.Artifacts, item => item.FileName == "document.html");
        Assert.Contains(manifest.Artifacts, item => item.FileName == "document.json");
        Assert.NotNull(await store.OpenArtifactAsync(job.Id, "document.html"));
        Assert.NotNull(await store.OpenArtifactAsync(job.Id, "document.json"));
    }

    public Task InitializeAsync() => Task.CompletedTask;
    public Task DisposeAsync()
    {
        if (Directory.Exists(_root)) Directory.Delete(_root, true);
        return Task.CompletedTask;
    }

    private sealed class CapturingLifecyclePublisher : IRenderLifecyclePublisher
    {
        public ValueTask PublishAsync<TRenderEvent>(TRenderEvent message, CancellationToken cancellationToken = default)
            where TRenderEvent : IRenderEvent => ValueTask.CompletedTask;
    }
}
