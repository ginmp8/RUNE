using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Rune.Browser;
using Rune.Event.Contracts;
using Rune.Jobs;
using Rune.Messaging.Abstractions;
using Rune.Messaging.Nats;
using Rune.Pdf;
using Rune.RenderProcessing;
using Rune.Storage.Abstractions;

if (args.Contains("--install-playwright", StringComparer.Ordinal))
{
    Environment.ExitCode = Microsoft.Playwright.Program.Main(["install", "--with-deps", "chromium"]);
    return;
}

var builder = Host.CreateApplicationBuilder(args);
var dataRoot = builder.Configuration["RUNE_DATA_ROOT"] ?? "/data";
var natsUrl = builder.Configuration["NATS_URL"] ?? "nats://localhost:4222";
var concurrency = int.TryParse(builder.Configuration["RUNE_BROWSER_CONCURRENCY"], out var parsed) ? parsed : 1;
var cacheRoot = builder.Configuration["RUNE_RENDER_CACHE_ROOT"] ?? Path.Combine(dataRoot, "cache");
var temporaryRoot = builder.Configuration["TMPDIR"] ?? Path.GetTempPath();
var acknowledgementWait = TimeSpan.FromSeconds(ParseBoundedInt(builder.Configuration["RUNE_NATS_ACK_WAIT_SECONDS"], 600, 5, 3600));
var negativeAcknowledgementDelay = TimeSpan.FromSeconds(ParseBoundedInt(builder.Configuration["RUNE_NATS_NAK_DELAY_SECONDS"], 10, 1, 300));
builder.Services.AddSingleton(new RuneOperationalMetrics(dataRoot, cacheRoot, temporaryRoot));
builder.Services.AddSingleton<IRenderJobStore>(sp => new FileSystemRenderJobStore(dataRoot, sp.GetRequiredService<RuneOperationalMetrics>()));
builder.Services.AddSingleton(_ => new PlaywrightRenderService(concurrency));
builder.Services.AddSingleton(sp => new FileSystemRenderCache(cacheRoot, sp.GetRequiredService<RuneOperationalMetrics>()));
builder.Services.AddSingleton<IPdfOcrProvider, TesseractPdfOcrProvider>();
builder.Services.AddSingleton<IPdfImportService, PdfImportService>();
builder.Services.AddScoped<IRenderJobProcessor, RenderJobProcessor>();
builder.Services.AddSingleton(_ => new NatsRenderTransport(new RuneNatsOptions(natsUrl, acknowledgementWait, negativeAcknowledgementDelay)));
builder.Services.AddSingleton<IRenderCommandConsumer>(sp => sp.GetRequiredService<NatsRenderTransport>());
builder.Services.AddSingleton<IRenderLifecyclePublisher>(sp => sp.GetRequiredService<NatsRenderTransport>());
builder.Services.AddHostedService<NatsRenderWorker>();
builder.Services.AddHostedService<RenderRetentionWorker>();
await builder.Build().RunAsync();

static int ParseBoundedInt(string? value, int fallback, int minimum, int maximum) =>
    int.TryParse(value, out var parsed) ? Math.Clamp(parsed, minimum, maximum) : fallback;

sealed class NatsRenderWorker(
    IRenderCommandConsumer consumer,
    IServiceScopeFactory scopeFactory) : BackgroundService
{
    protected override Task ExecuteAsync(CancellationToken stoppingToken) => consumer.RunAsync(ProcessAsync, stoppingToken);

    private async Task<RenderCommandResult> ProcessAsync(RenderRequested command, CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var processor = scope.ServiceProvider.GetRequiredService<IRenderJobProcessor>();
        var outcome = await processor.ProcessAsync(command, cancellationToken);
        if (outcome == RenderProcessOutcome.Terminate)
        {
            var jobs = scope.ServiceProvider.GetRequiredService<IRenderJobStore>();
            var events = scope.ServiceProvider.GetRequiredService<IRenderLifecyclePublisher>();
            var job = await jobs.GetAsync(command.RenderId, cancellationToken);
            var reason = job?.Error ?? "Render processing terminated without a retryable outcome.";
            var attempt = job?.Attempt ?? 0;
            var deadLetteredAt = DateTimeOffset.UtcNow;
            await jobs.MarkDeadLetteredAsync(command.RenderId, attempt, reason, deadLetteredAt, cancellationToken);
            var metadata = new EventMetadata(
                RuneTelemetry.DeterministicEventId(command.RenderId, "dead-lettered", attempt),
                command.RenderId,
                command.Metadata.EventId,
                "1.0",
                deadLetteredAt,
                command.Metadata.Headers);
            await events.PublishAsync(new RenderDeadLettered(metadata, command.RenderId, attempt, reason, deadLetteredAt), cancellationToken);
            RuneTelemetry.DeadLettered.Add(1);
            RuneFailureInjection.Trigger("before-ack", command.RenderId);
            return new RenderCommandResult(RenderCommandDisposition.Terminate, reason, attempt);
        }
        if (outcome == RenderProcessOutcome.Acknowledge)
        {
            RuneFailureInjection.Trigger("before-ack", command.RenderId);
            return new RenderCommandResult(RenderCommandDisposition.Acknowledge);
        }
        return new RenderCommandResult(RenderCommandDisposition.Retry);
    }
}

sealed class RenderRetentionWorker(
    IRenderJobStore jobs,
    IConfiguration configuration,
    ILogger<RenderRetentionWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var retentionDays = int.TryParse(configuration["RUNE_JOB_RETENTION_DAYS"], out var configured) ? Math.Clamp(configured, 1, 3650) : 7;
        var abandonedMinutes = int.TryParse(configuration["RUNE_ABANDONED_TEMP_MINUTES"], out var configuredAbandoned)
            ? Math.Clamp(configuredAbandoned, 1, 1440)
            : 15;
        using var timer = new PeriodicTimer(TimeSpan.FromHours(1));
        do
        {
            try
            {
                var cleaned = await jobs.CleanupAbandonedAsync(TimeSpan.FromMinutes(abandonedMinutes), stoppingToken);
                if (cleaned > 0) logger.LogInformation("Deleted {Count} abandoned temporary render entries", cleaned);
                var deleted = await jobs.DeleteExpiredAsync(DateTimeOffset.UtcNow.AddDays(-retentionDays), stoppingToken);
                if (deleted > 0) logger.LogInformation("Deleted {Count} expired render jobs", deleted);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch (Exception exception) { logger.LogError(exception, "Render job retention cleanup failed"); }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
