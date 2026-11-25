using System.Text;
using Rune.Api.Contracts;
using Rune.Application;
using Rune.Core;
using Rune.Job.Contracts;
using Rune.Jobs;

namespace Rune.Engine.Tests;

public sealed class ComparisonJobServiceTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "rune-comparison-job-tests", Guid.NewGuid().ToString("N"));

    [Fact]
    public async Task Creates_persists_and_atomically_publishes_an_artifact_addressed_report()
    {
        var store = new FileSystemRenderJobStore(_root);
        var left = await CreateCompletedRenderAsync(store, "same", "tenant-a", "restricted");
        var right = await CreateCompletedRenderAsync(store, "same", "tenant-a", "confidential");
        var service = new ComparisonJobService(store, new ArtifactComparisonService(), _root);
        using var cancellation = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        var worker = service.ExecuteAsync(cancellation.Token);

        var accepted = await service.CreateAsync(new CreateComparisonJobRequest(
            new ComparisonArtifactReference(left.Id),
            new ComparisonArtifactReference(right.Id),
            new ArtifactComparisonProfile(Name: "legal", Version: "2"),
            IdempotencyKey: "comparison-1"), "tenant-a", cancellation.Token);
        var duplicate = await service.CreateAsync(new CreateComparisonJobRequest(
            new ComparisonArtifactReference(left.Id),
            new ComparisonArtifactReference(right.Id),
            new ArtifactComparisonProfile(Name: "legal", Version: "2"),
            IdempotencyKey: "comparison-1"), "tenant-a", cancellation.Token);
        Assert.Equal(accepted.Id, duplicate.Id);
        Assert.Equal("idempotency-hit", duplicate.Existing);

        var completed = await WaitForTerminalAsync(service, accepted.Id, "tenant-a", cancellation.Token);
        Assert.Equal(ComparisonJobStatus.Completed, completed.Status);
        Assert.Equal(ComparisonOutcome.Identical, completed.Outcome);
        Assert.Equal("restricted", completed.SecurityLabel);
        Assert.NotNull(completed.ReportJsonUrl);
        Assert.NotNull(completed.ReportHtmlUrl);

        await using var report = await service.OpenArtifactAsync(accepted.Id, "tenant-a", "comparison-report.json", cancellation.Token);
        Assert.NotNull(report);
        using var reader = new StreamReader(report!, Encoding.UTF8);
        var json = await reader.ReadToEndAsync(cancellation.Token);
        Assert.Contains("comparison-report-v1", json, StringComparison.Ordinal);
        Assert.Contains("restricted", json, StringComparison.Ordinal);

        cancellation.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(async () => await worker);
    }

    [Fact]
    public async Task Independently_rejects_a_cross_tenant_source_without_publishing_a_report()
    {
        var store = new FileSystemRenderJobStore(_root);
        var left = await CreateCompletedRenderAsync(store, "left", "tenant-a", null);
        var right = await CreateCompletedRenderAsync(store, "right", "tenant-b", null);
        var service = new ComparisonJobService(store, new ArtifactComparisonService(), _root);
        using var cancellation = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        var worker = service.ExecuteAsync(cancellation.Token);

        var accepted = await service.CreateAsync(new CreateComparisonJobRequest(
            new ComparisonArtifactReference(left.Id),
            new ComparisonArtifactReference(right.Id)), "tenant-a", cancellation.Token);
        var failed = await WaitForTerminalAsync(service, accepted.Id, "tenant-a", cancellation.Token);
        Assert.Equal(ComparisonJobStatus.Failed, failed.Status);
        Assert.Equal(ComparisonOutcome.Failed, failed.Outcome);
        Assert.Null(await service.OpenArtifactAsync(accepted.Id, "tenant-a", "comparison-report.json", cancellation.Token));

        cancellation.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(async () => await worker);
    }

    private static async ValueTask<RenderJob> CreateCompletedRenderAsync(
        FileSystemRenderJobStore store,
        string content,
        string tenant,
        string? securityLabel)
    {
        var jobs = new RenderJobService(store);
        var job = await jobs.CreateAsync(
            "<html></html>",
            RenderOutputFormat.StaticHtml,
            new RenderOptions(CachePolicy: new RenderCachePolicy(SecurityLabel: securityLabel)),
            null,
            null,
            dispatchHeaders: new Dictionary<string, string> { ["X-RUNE-Tenant"] = tenant });
        await using var stream = new MemoryStream(Encoding.UTF8.GetBytes(content), writable: false);
        var length = await store.SaveResultAsync(job.Id, stream, "html");
        var completed = job with
        {
            Status = RenderJobStatus.Completed,
            ResultPath = $"{job.Id:N}/result.html",
            ContentType = "text/html; charset=utf-8",
            ResultLength = length,
            CompletedAt = DateTimeOffset.UtcNow
        };
        await store.SaveAsync(completed);
        return completed;
    }

    private static async ValueTask<ComparisonJobResponse> WaitForTerminalAsync(
        ComparisonJobService service,
        Guid id,
        string tenant,
        CancellationToken cancellationToken)
    {
        while (true)
        {
            var job = await service.GetAsync(id, tenant, cancellationToken) ?? throw new InvalidOperationException("Comparison disappeared.");
            if (job.Status is ComparisonJobStatus.Completed or ComparisonJobStatus.Failed or ComparisonJobStatus.Cancelled) return job;
            await Task.Delay(25, cancellationToken);
        }
    }

    public void Dispose()
    {
        if (Directory.Exists(_root)) Directory.Delete(_root, true);
    }
}
