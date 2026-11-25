using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using System.Text.Json;
using System.Text.Json.Serialization;
using Rune.Api.Contracts;
using Rune.Application;
using Rune.Browser;
using Rune.Core;
using Rune.Dispatching.Local;
using Rune.Event.Contracts;
using Rune.Html;
using Rune.Job.Contracts;
using Rune.Jobs;
using Rune.Markdown;
using Rune.Messaging.Abstractions;
using Rune.Messaging.Nats;
using Rune.Pdf;
using Rune.RenderProcessing;
using Rune.Rendering;
using Rune.Storage.Abstractions;

var productVersion = RuneVersion.Current;
var builder = WebApplication.CreateBuilder(args);
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
    options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
});
var dataRoot = builder.Configuration["RUNE_DATA_ROOT"] ?? "/data";
var assetRoot = builder.Configuration["RUNE_ASSET_ROOT"] ?? Path.Combine(AppContext.BaseDirectory, "assets");
var natsUrl = builder.Configuration["NATS_URL"] ?? "nats://localhost:4222";
var schemaRoot = builder.Configuration["RUNE_SCHEMA_ROOT"] ?? Path.Combine(AppContext.BaseDirectory, "schemas");
var cacheRoot = builder.Configuration["RUNE_RENDER_CACHE_ROOT"] ?? Path.Combine(dataRoot, "cache");
var temporaryRoot = builder.Configuration["TMPDIR"] ?? Path.GetTempPath();
var dispatchProvider = RenderDispatcherProviderParser.Parse(builder.Configuration);
var browserConcurrency = int.TryParse(builder.Configuration["RUNE_BROWSER_CONCURRENCY"], out var parsedConcurrency) ? parsedConcurrency : 1;
var dispatchPublishTimeoutSeconds = int.TryParse(builder.Configuration["RUNE_DISPATCH_PUBLISH_TIMEOUT_SECONDS"], out var parsedDispatchTimeout)
    ? Math.Clamp(parsedDispatchTimeout, 1, 60)
    : 5;

builder.Services.AddSingleton<IDocumentCompiler>(_ => new MarkdownDocumentCompiler(assetRoot));
builder.Services.AddSingleton<IDocumentCompiler, HtmlDocumentCompiler>();
builder.Services.AddSingleton<IHtmlDocumentRenderer>(_ => new HtmlDocumentRenderer(assetRoot));
builder.Services.AddSingleton(_ => new RendererAssetCatalog(assetRoot));
builder.Services.AddSingleton(new RuneOperationalMetrics(dataRoot, cacheRoot, temporaryRoot));
builder.Services.AddSingleton<IRenderJobStore>(sp => new FileSystemRenderJobStore(dataRoot, sp.GetRequiredService<RuneOperationalMetrics>()));
builder.Services.AddSingleton<RenderJobService>();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton(sp => new FileSystemRenderCache(cacheRoot, sp.GetRequiredService<RuneOperationalMetrics>()));
builder.Services.AddSingleton<IPdfOcrProvider, TesseractPdfOcrProvider>();
builder.Services.AddSingleton<IPdfImportService, PdfImportService>();
if (dispatchProvider == RenderDispatcherProvider.Local)
{
    builder.Services.AddSingleton(_ => new PlaywrightRenderService(browserConcurrency));
    builder.Services.AddScoped<IRenderJobProcessor, RenderJobProcessor>();
    builder.Services.AddLocalRenderDispatching(builder.Configuration);
}
else
{
    builder.Services.AddSingleton(_ => new NatsRenderTransport(new RuneNatsOptions(natsUrl)));
    builder.Services.AddSingleton<IRenderCommandPublisher>(sp => sp.GetRequiredService<NatsRenderTransport>());
    builder.Services.AddSingleton<IRenderLifecyclePublisher>(sp => sp.GetRequiredService<NatsRenderTransport>());
}
builder.Services.AddSingleton(sp => new RenderCommandOutbox(
    sp.GetRequiredService<IRenderJobStore>(),
    sp.GetRequiredService<IRenderCommandPublisher>(),
    sp.GetRequiredService<TimeProvider>(),
    TimeSpan.FromSeconds(dispatchPublishTimeoutSeconds)));
builder.Services.AddHostedService<RenderCommandOutboxWorker>();
builder.Services.AddSingleton<DocumentRenderApplication>();
builder.Services.AddSingleton<ArtifactComparisonService>();
builder.Services.AddSingleton(sp => new ComparisonJobService(
    sp.GetRequiredService<IRenderJobStore>(),
    sp.GetRequiredService<ArtifactComparisonService>(),
    dataRoot));
builder.Services.AddHostedService<ComparisonJobWorker>();
builder.Services.AddHealthChecks();

var app = builder.Build();
app.Use(async (context, next) =>
{
    context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
    context.Response.Headers.Append("X-RUNE-Version", productVersion);
    try { await next(); }
    catch (PdfImportException exception)
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        await context.Response.WriteAsJsonAsync(new ApiErrorResponse(exception.Code, exception.Message, context.TraceIdentifier));
    }
    catch (ArgumentException exception)
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        await context.Response.WriteAsJsonAsync(new ApiErrorResponse("invalid-request", exception.Message, context.TraceIdentifier));
    }
    catch (Exception exception)
    {
        app.Logger.LogError(exception, "Unhandled RUNE API error for trace {TraceId}", context.TraceIdentifier);
        if (!context.Response.HasStarted)
        {
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            await context.Response.WriteAsJsonAsync(new ApiErrorResponse("internal-error", "The render request failed.", context.TraceIdentifier));
        }
    }
});

app.MapHealthChecks("/health", new HealthCheckOptions
{
    ResponseWriter = async (context, report) =>
    {
        context.Response.ContentType = "application/json; charset=utf-8";
        await context.Response.WriteAsJsonAsync(new
        {
            status = report.Status.ToString().ToLowerInvariant(),
            checks = report.Entries.OrderBy(entry => entry.Key).ToDictionary(
                entry => entry.Key,
                entry => new
                {
                    status = entry.Value.Status.ToString().ToLowerInvariant(),
                    description = entry.Value.Description,
                    durationMilliseconds = Math.Round(entry.Value.Duration.TotalMilliseconds, 3),
                    data = entry.Value.Data
                })
        });
    }
});
app.MapGet("/metrics", async (RuneOperationalMetrics metrics, CancellationToken cancellationToken) =>
    Results.Text(await metrics.ExportPrometheusAsync(cancellationToken), "text/plain; version=0.0.4; charset=utf-8"));
var builtInFontPack = BuiltInFontPack.TryLoad(assetRoot);

app.MapGet("/", () => Results.Ok(new
{
    name = "RUNE API",
    version = productVersion,
    apiVersion = "v1",
    documentation = "/v1/openapi.json",
    features = "/v1/features",
    metrics = "/metrics",
    license = new { identifier = "MIT", scope = "RUNE project source code", thirdPartyComponents = "/v1/features" }
}));
app.MapGet("/v1/features", (RendererAssetCatalog assetCatalog, IPdfOcrProvider ocrProvider) => Results.Ok(new
{
    version = productVersion,
    projectLicense = new
    {
        identifier = "MIT",
        scope = "RUNE project source code",
        thirdPartyComponentsRetainOwnLicenses = true,
        generatedArtifactsAreNotRelicensedByRune = true
    },
    inputs = Enum.GetNames<DocumentSourceType>(),
    outputs = Enum.GetNames<RenderOutputFormat>(),
    renderers = new[] { "mermaid", "katex", "schematex", "orgchart", "ownership-chart", "reactflow", "geojson", "topojson", "chart", "stl" },
    asynchronousOutputs = Enum.GetValues<RenderOutputFormat>().Where(value => value.RequiresBrowser()).Select(value => value.ToString()),
    advancedDocumentOperations = new
    {
        artifactComparison = new
        {
            architecture = "asynchronous-artifact-addressed-comparison-job",
            endpoint = "/v1/comparisons",
            status = "/v1/comparisons/{id}",
            events = "/v1/comparisons/{id}/events",
            reports = new[] { "json", "sanitized-html", "publication-manifest" },
            outcomes = Enum.GetNames<ComparisonOutcome>().Select(value => JsonNamingPolicy.CamelCase.ConvertName(value)),
            versionedProfiles = true,
            orderedIdentity = true,
            independentAuthorization = true,
            atomicPublication = true,
            byteRanges = true,
            semanticNormalization = true,
            formatStructuralComparison = true,
            pixelComparison = true,
            ocrComparison = true,
            canonicalPdfComparison = "bounded-best-effort"
        },
        compositeDocumentAssembly = new
        {
            nested = true,
            independentPageSizes = true,
            rewriteTableOfContents = true,
            pdfParts = "visual-semantic-native-page-import",
            directObjectPreservingPdfParts = true,
            nativePdfImportManifest = "pdf-import-manifest.json",
            portfolios = false
        },
        templates = new
        {
            syntax = "rune-template-v1",
            strictDefault = true,
            typedJsonValues = true,
            schemaDefaults = true,
            remoteSchemaReferences = false,
            contextualEscaping = new[] { "markdown", "htmlText", "htmlAttribute", "url", "css", "json", "plainText" },
            trustedInsertion = new[] { "$runeTrustedHtml", "$runeTrustedMarkdown" },
            independentCultureAndTimeZone = true,
            oneExpansionForAllOutputs = true,
            builtInHelperAllowlist = true,
            userDefinedDeclarativePipelines = true,
            arbitraryExecutableCode = false
        },
        fontProcessing = new
        {
            formats = new[] { "woff2", "woff", "truetype", "opentype" },
            resolutionAxes = new[] { "family", "weight", "style", "stretch" },
            missingFacePolicies = Enum.GetNames<FontMissingFacePolicy>().Select(value => JsonNamingPolicy.CamelCase.ConvertName(value)),
            missingGlyphPolicies = Enum.GetNames<FontMissingGlyphPolicy>().Select(value => JsonNamingPolicy.CamelCase.ConvertName(value)),
            embedPolicies = Enum.GetNames<FontEmbedPolicy>().Select(value => JsonNamingPolicy.CamelCase.ConvertName(value)),
            subsetPolicies = Enum.GetNames<FontSubsetPolicy>().Select(value => JsonNamingPolicy.CamelCase.ConvertName(value)),
            hostFontLookup = false,
            remoteAcquisition = false,
            maximumFontBytes = 8_000_000,
            unicodeRange = true,
            glyphUsageReadiness = true,
            physicalSubsetting = "opportunistic-cache-or-required",
            woffAndWoff2GlyphIntrospection = true,
            sanitization = true,
            builtInFallbackPack = builtInFontPack is null ? null : new
            {
                id = builtInFontPack.Id,
                version = builtInFontPack.Version,
                sha256 = builtInFontPack.Sha256,
                coverage = builtInFontPack.UnicodeCoverage
            }
        },
        pageDecorations = new
        {
            authoringSources = new[] { "api", "frontMatter", "rune-header-fence", "rune-footer-fence", "themeDefaults" },
            precedence = "api>frontMatter>fences>themeDefaults",
            capabilities = new[] { "direct", "preRender", "rejected" },
            selectors = new[] { "cover", "first", "default", "left", "right", "named", "page", "range" },
            twoPassPdfComposition = true,
            overflowDefaultForLegalAndArchival = "error",
            finalPdfAValidationAfterOverlay = true
        },
        cache = new
        {
            fingerprintVersion = 3,
            policies = Enum.GetNames<RenderCacheMode>().Select(value => JsonNamingPolicy.CamelCase.ConvertName(value)),
            stores = new[] { "filesystem", "shared-filesystem" },
            fencedLeases = true,
            reauthorizationOnHit = true,
            corruptionQuarantine = true,
            refreshPreservesPriorValidEntry = true,
            sensitiveEntryEncryption = "aes-256-gcm-when-configured",
            crossTenantIsolation = true
        },
        multiOutput = new
        {
            atomic = true,
            canonicalOrder = Enum.GetValues<RenderOutputFormat>().NormalizeOutputSet(),
            manifestEndpoint = "/v1/renders/{id}/artifacts",
            artifactEndpoint = "/v1/renders/{id}/artifacts/{name}",
            packageEndpoint = "/v1/renders/{id}/package",
            packageModes = Enum.GetNames<MultiOutputPackageMode>().Select(value => JsonNamingPolicy.CamelCase.ConvertName(value))
        },
        taggedPdfStructureMap = "structure-map.json",
        distributedCacheCoordination = "shared-filesystem-fenced-leases-with-semantics-probe",
        consensusCoordination = false,
        sharedStorageArtifactSetTransaction = "stage-verify-rename"
    },
    observability = new
    {
        prometheusEndpoint = "/metrics",
        activitySource = RuneTelemetry.ActivitySourceName,
        meter = RuneTelemetry.MeterName,
        propagation = "w3c-trace-context",
        exporter = "deployment-configured",
        distributedMetrics = new[]
        {
            "rune_jobs_queued", "rune_jobs_running", "rune_jobs_completed", "rune_jobs_failed",
            "rune_job_duration_seconds", "rune_render_duration_seconds", "rune_message_redelivery_total",
            "rune_idempotency_hit_total", "rune_cache_hit_total", "rune_cache_miss_total",
            "rune_lease_conflict_total", "rune_lease_fencing_rejection_total", "rune_temp_files_total",
            "rune_chromium_processes", "rune_dispatch_published_total",
            "rune_dispatch_failure_total", "rune_dead_letter_total"
        }
    },
    authentication = "not-configured",
    dispatchProvider = dispatchProvider.ToString().ToLowerInvariant(),
    dispatching = new
    {
        selected = dispatchProvider.ToString().ToLowerInvariant(),
        available = new[] { "local", "nats" },
        automaticFallback = false,
        local = dispatchProvider == RenderDispatcherProvider.Local ? new
        {
            durableState = "filesystem-job-store",
            queue = "bounded-memory-channel",
            startupRecovery = true
        } : null
    },
    pdfImport = new
    {
        available = true,
        pdfToHtmlOutput = "staticHtml",
        nativePageOutputs = new[] { "pdf", "pdfA" },
        reportSchema = "/v1/schemas/pdf-conversion-report.v1.schema.json",
        nativeManifestSchema = "/v1/schemas/pdf-import-manifest.v1.schema.json",
        modes = Enum.GetValues<PdfImportMode>().Select(value => value == PdfImportMode.NativePage ? "native-page" : value.ToString().ToLowerInvariant()),
        ocrModes = Enum.GetNames<PdfOcrMode>().Select(value => value.ToLowerInvariant()),
        ocrAvailable = ocrProvider.IsAvailable,
        ocrProvider = ocrProvider.IsAvailable ? new { name = ocrProvider.Name, version = ocrProvider.Version } : null,
        encryptedPdf = false,
        preserveLinks = true,
        extractImages = true,
        policies = new
        {
            signatures = new[] { "reject", "flatten", "ignore" },
            forms = new[] { "flatten", "reject" },
            links = new[] { "preserve", "remove" },
            comments = new[] { "flatten", "reject", "remove" },
            attachments = new[] { "reject", "remove" },
            javascript = new[] { "remove", "reject" },
            fallback = new[] { "visual", "reject" }
        },
        extractedArtifactTemplate = "/v1/renders/{id}/artifacts/{name}",
        semanticProvider = "PdfLexer",
        semanticProviderVersion = "0.1.27",
        visualProvider = "Docnet.Core/PDFium",
        visualProviderVersion = "2.6.0",
        nativePageProvider = "PDFsharp",
        nativePageProviderVersion = "6.2.4"
    },
    rendererCapabilities = assetCatalog.Inspect()
}));
app.MapGet("/v1/openapi.json", () => Results.Json(OpenApiDocument(productVersion), contentType: "application/vnd.oai.openapi+json"));
app.MapGet("/v1/schemas", () => Results.Ok(Directory.Exists(schemaRoot)
    ? Directory.EnumerateFiles(schemaRoot, "*.schema.json", SearchOption.TopDirectoryOnly).Select(Path.GetFileName).Order().ToArray()
    : Array.Empty<string>()));
app.MapGet("/v1/schemas/{name}", (string name) =>
{
    if (!System.Text.RegularExpressions.Regex.IsMatch(name, @"^[a-z0-9.-]+\.schema\.json$", System.Text.RegularExpressions.RegexOptions.IgnoreCase))
        return Results.BadRequest(new ApiErrorResponse("invalid-schema-name", "Schema names must use the published file name."));
    var fullPath = Path.GetFullPath(Path.Combine(schemaRoot, name));
    var fullRoot = Path.GetFullPath(schemaRoot) + Path.DirectorySeparatorChar;
    if (!fullPath.StartsWith(fullRoot, StringComparison.Ordinal) || !File.Exists(fullPath))
        return Results.NotFound(new ApiErrorResponse("schema-not-found", $"Schema {name} was not found."));
    return Results.File(fullPath, "application/schema+json");
});

app.MapPost("/v1/artifacts/compare", () => Results.Json(
    new ApiErrorResponse("comparison-endpoint-retired", "Synchronous Base64 comparison is retired. Create an asynchronous comparison job at /v1/comparisons."),
    statusCode: StatusCodes.Status410Gone));

app.MapPost("/v1/comparisons", async (CreateComparisonJobRequest request, HttpContext context, ComparisonJobService service, CancellationToken cancellationToken) =>
{
    var accepted = await service.CreateAsync(request, Tenant(context), cancellationToken);
    return Results.Accepted(accepted.StatusUrl, accepted);
});

app.MapGet("/v1/comparisons/{id:guid}", async (Guid id, HttpContext context, ComparisonJobService service, CancellationToken cancellationToken) =>
{
    var job = await service.GetAsync(id, Tenant(context), cancellationToken);
    return job is null ? Results.NotFound(new ApiErrorResponse("comparison-not-found", $"Comparison {id} was not found.")) : Results.Ok(job);
});

app.MapPost("/v1/comparisons/{id:guid}/cancel", async (Guid id, CancelComparisonJobRequest request, HttpContext context, ComparisonJobService service, CancellationToken cancellationToken) =>
    await service.CancelAsync(id, Tenant(context), request.Reason, cancellationToken)
        ? Results.Accepted($"/v1/comparisons/{id:D}", new { comparisonId = id, status = "cancelRequested" })
        : Results.Conflict(new ApiErrorResponse("comparison-not-cancellable", $"Comparison {id} cannot be cancelled.")));

app.MapPost("/v1/comparisons/{id:guid}/retry", async (Guid id, RetryComparisonJobRequest request, HttpContext context, ComparisonJobService service, CancellationToken cancellationToken) =>
    await service.RetryAsync(id, Tenant(context), request.ResetAttempts, cancellationToken)
        ? Results.Accepted($"/v1/comparisons/{id:D}", new { comparisonId = id, status = "queued" })
        : Results.Conflict(new ApiErrorResponse("comparison-not-retryable", $"Comparison {id} cannot be retried.")));

app.MapGet("/v1/comparisons/{id:guid}/report.json", async (Guid id, HttpContext context, ComparisonJobService service, CancellationToken cancellationToken) =>
{
    var stream = await service.OpenArtifactAsync(id, Tenant(context), "comparison-report.json", cancellationToken);
    return stream is null
        ? Results.NotFound(new ApiErrorResponse("comparison-report-not-found", $"Comparison report {id} was not found."))
        : Results.Stream(stream, "application/json", $"comparison-{id:N}.json", enableRangeProcessing: true);
});

app.MapGet("/v1/comparisons/{id:guid}/report.html", async (Guid id, HttpContext context, ComparisonJobService service, CancellationToken cancellationToken) =>
{
    var stream = await service.OpenArtifactAsync(id, Tenant(context), "comparison-report.html", cancellationToken);
    return stream is null
        ? Results.NotFound(new ApiErrorResponse("comparison-report-not-found", $"Comparison report {id} was not found."))
        : Results.Stream(stream, "text/html; charset=utf-8", $"comparison-{id:N}.html", enableRangeProcessing: true);
});

app.MapGet("/v1/comparisons/{id:guid}/manifest", async (Guid id, HttpContext context, ComparisonJobService service, CancellationToken cancellationToken) =>
{
    var stream = await service.OpenArtifactAsync(id, Tenant(context), "comparison-manifest.json", cancellationToken);
    return stream is null
        ? Results.NotFound(new ApiErrorResponse("comparison-manifest-not-found", $"Comparison manifest {id} was not found."))
        : Results.Stream(stream, "application/vnd.rune.comparison-manifest+json", $"comparison-{id:N}-manifest.json", enableRangeProcessing: true);
});

app.MapGet("/v1/comparisons/{id:guid}/events", async (Guid id, HttpContext context, ComparisonJobService service, CancellationToken cancellationToken) =>
{
    context.Response.ContentType = "text/event-stream";
    context.Response.Headers["Cache-Control"] = "no-cache";
    context.Response.Headers.Append("X-Accel-Buffering", "no");
    ComparisonJobStatus? previousStatus = null;
    int? previousProgress = null;
    while (!cancellationToken.IsCancellationRequested)
    {
        var job = await service.GetAsync(id, Tenant(context), cancellationToken);
        if (job is null)
        {
            await context.Response.WriteAsync(SseEventFormatter.Format("not-found", new { comparisonId = id }, DateTimeOffset.UtcNow.UtcTicks, 1500), cancellationToken);
            await context.Response.Body.FlushAsync(cancellationToken);
            return;
        }
        if (job.Status != previousStatus || job.ProgressPercent != previousProgress)
        {
            await context.Response.WriteAsync(SseEventFormatter.Format("comparison-status", job, DateTimeOffset.UtcNow.UtcTicks, previousStatus is null ? 1500 : null), cancellationToken);
            await context.Response.Body.FlushAsync(cancellationToken);
            previousStatus = job.Status;
            previousProgress = job.ProgressPercent;
        }
        if (job.Status is ComparisonJobStatus.Completed or ComparisonJobStatus.Failed or ComparisonJobStatus.Cancelled) return;
        await Task.Delay(TimeSpan.FromMilliseconds(500), cancellationToken);
    }
});

app.MapPost("/v1/render", async (RenderRequest request, DocumentRenderApplication service, IRenderJobStore jobs, CancellationToken cancellationToken) =>
{
    var result = await service.RenderAsync(request, cancellationToken);
    if (result is HtmlRenderResponse or StructuredDocumentResponse) return Results.Ok(result);
    var accepted = (RenderAcceptedResponse)result;
    if (request.WaitForCompletion && request.WaitTimeoutSeconds > 0)
    {
        var completed = await WaitForTerminalJobAsync(jobs, accepted.RenderId, TimeSpan.FromSeconds(request.WaitTimeoutSeconds), cancellationToken);
        if (completed?.Status == RenderJobStatus.Completed)
        {
            var stream = await jobs.OpenResultAsync(completed.Id, cancellationToken);
            if (stream is not null) return Results.Stream(stream, completed.ContentType ?? "application/octet-stream", FileName(completed));
        }
        if (completed?.Status is RenderJobStatus.Failed or RenderJobStatus.Cancelled)
            return Results.Conflict(new ApiErrorResponse($"render-{completed.Status.ToString().ToLowerInvariant()}", completed.Error ?? "Render did not complete.", Details: new Dictionary<string, object?> { ["renderId"] = completed.Id }));
    }
    return Results.Accepted(accepted.StatusUrl, accepted);
});

app.MapGet("/v1/renders", async (string? status, int? offset, int? limit, DateTimeOffset? createdAfter, DateTimeOffset? createdBefore, IRenderJobStore jobs, CancellationToken cancellationToken) =>
{
    // Query binding is independent of JSON's camel-case enum converter.
    // Accept the public status names used by the Studio and SDK clients.
    RenderJobStatus? filter = null;
    if (!string.IsNullOrWhiteSpace(status))
    {
        if (status.Contains(',') || !Enum.TryParse<RenderJobStatus>(status, ignoreCase: true, out var parsed) || !Enum.IsDefined(parsed))
            return Results.BadRequest(new ApiErrorResponse("invalid-render-status", "Status must identify a defined render job state."));
        filter = parsed;
    }
    return Results.Ok(await jobs.QueryAsync(new RenderJobQuery(filter, offset ?? 0, limit ?? 50, createdAfter, createdBefore), cancellationToken));
});

app.MapGet("/v1/renders/{id:guid}", async (Guid id, IRenderJobStore jobs, CancellationToken cancellationToken) =>
{
    var job = await jobs.GetAsync(id, cancellationToken);
    return job is null ? Results.NotFound(new ApiErrorResponse("render-not-found", $"Render {id} was not found.")) : Results.Ok(ToResponse(job));
});

app.MapGet("/v1/renders/{id:guid}/content", async (Guid id, IRenderJobStore jobs, CancellationToken cancellationToken) =>
{
    var job = await jobs.GetAsync(id, cancellationToken);
    if (job is null) return Results.NotFound(new ApiErrorResponse("render-not-found", $"Render {id} was not found."));
    if (job.Status != RenderJobStatus.Completed) return Results.Conflict(new ApiErrorResponse("render-not-complete", $"Render status is {job.Status}.", Details: new Dictionary<string, object?> { ["error"] = job.Error }));
    if (job.OutputFormats is not null)
        return Results.Conflict(new ApiErrorResponse("multi-output-content-conflict", "The /content alias is available only for singular-output jobs. Use /artifacts or /package."));
    var stream = await jobs.OpenResultAsync(id, cancellationToken);
    return stream is null ? Results.NotFound(new ApiErrorResponse("result-not-found", $"Result for render {id} was not found.")) : Results.Stream(stream, job.ContentType ?? "application/octet-stream", FileName(job), enableRangeProcessing: true);
});

app.MapGet("/v1/renders/{id:guid}/conversion-report", async (Guid id, IRenderJobStore jobs, CancellationToken cancellationToken) =>
{
    var job = await jobs.GetAsync(id, cancellationToken);
    if (job is null) return Results.NotFound(new ApiErrorResponse("render-not-found", $"Render {id} was not found."));
    if (string.IsNullOrWhiteSpace(job.ConversionReportPath))
        return Results.NotFound(new ApiErrorResponse("conversion-report-not-found", $"Render {id} has no PDF conversion report."));
    var stream = await jobs.OpenArtifactAsync(id, "conversion-report.json", cancellationToken);
    return stream is null
        ? Results.NotFound(new ApiErrorResponse("conversion-report-not-found", $"Render {id} has no PDF conversion report."))
        : Results.Stream(stream, "application/json", "conversion-report.json");
});

app.MapGet("/v1/renders/{id:guid}/artifacts", async (Guid id, IRenderJobStore jobs, CancellationToken cancellationToken) =>
{
    var job = await jobs.GetAsync(id, cancellationToken);
    if (job is null) return Results.NotFound(new ApiErrorResponse("render-not-found", $"Render {id} was not found."));
    if (job.Status != RenderJobStatus.Completed)
        return Results.Conflict(new ApiErrorResponse("render-not-complete", $"Artifacts for render {id} are published only after atomic completion."));
    var stream = await jobs.OpenArtifactAsync(id, "artifact-set-manifest.json", cancellationToken);
    if (stream is null) return Results.NotFound(new ApiErrorResponse("artifact-set-not-found", $"Render {id} has no artifact-set manifest."));
    return Results.Stream(stream, "application/vnd.rune.render-set+json", "artifact-set-manifest.json");
});

app.MapGet("/v1/renders/{id:guid}/package", async (Guid id, IRenderJobStore jobs, CancellationToken cancellationToken) =>
{
    var job = await jobs.GetAsync(id, cancellationToken);
    if (job is null) return Results.NotFound(new ApiErrorResponse("render-not-found", $"Render {id} was not found."));
    if (job.Status != RenderJobStatus.Completed)
        return Results.Conflict(new ApiErrorResponse("render-not-complete", $"Package for render {id} is published only after atomic completion."));
    var stream = await jobs.OpenArtifactAsync(id, "artifact-set.zip", cancellationToken);
    return stream is null
        ? Results.NotFound(new ApiErrorResponse("artifact-package-not-found", $"Render {id} was not configured to publish a ZIP package."))
        : Results.Stream(stream, "application/zip", $"rune-{id:N}-artifacts.zip", enableRangeProcessing: true);
});

app.MapGet("/v1/renders/{id:guid}/artifacts/{name}", async (Guid id, string name, IRenderJobStore jobs, CancellationToken cancellationToken) =>
{
    var job = await jobs.GetAsync(id, cancellationToken);
    if (job is null) return Results.NotFound(new ApiErrorResponse("render-not-found", $"Render {id} was not found."));
    if (job.Status != RenderJobStatus.Completed)
        return Results.Conflict(new ApiErrorResponse("render-not-complete", $"Artifacts for render {id} are published only after atomic completion."));
    try
    {
        var stream = await jobs.OpenArtifactAsync(id, name, cancellationToken);
        return stream is null
            ? Results.NotFound(new ApiErrorResponse("artifact-not-found", $"Artifact {name} was not found for render {id}."))
            : Results.Stream(stream, ArtifactContentType(name), name, enableRangeProcessing: true);
    }
    catch (ArgumentException exception)
    {
        return Results.BadRequest(new ApiErrorResponse("invalid-artifact-name", exception.Message));
    }
});

app.MapPost("/v1/renders/{id:guid}/cancel", async (Guid id, CancelRenderRequest request, IRenderJobStore jobs, IRenderLifecyclePublisher events, CancellationToken cancellationToken) =>
{
    if (!await jobs.RequestCancellationAsync(id, request.Reason, cancellationToken))
        return Results.Conflict(new ApiErrorResponse("render-not-cancellable", $"Render {id} cannot be cancelled."));
    var job = await jobs.GetAsync(id, cancellationToken) ?? throw new InvalidOperationException($"Render {id} disappeared after cancellation.");
    if (job.Status == RenderJobStatus.Cancelled)
    {
        var metadata = new EventMetadata(Guid.NewGuid(), id, null, "1.0", DateTimeOffset.UtcNow);
        await events.PublishAsync(new RenderCancelled(metadata, id, job.Error ?? "Cancellation requested."), cancellationToken);
    }
    return Results.Accepted($"/v1/renders/{id}", new { renderId = id, status = job.Status.ToString().ToLowerInvariant() });
});

app.MapPost("/v1/renders/{id:guid}/retry", async (Guid id, RetryRenderRequest request, IRenderJobStore jobs, RenderCommandOutbox outbox, CancellationToken cancellationToken) =>
{
    if (!await jobs.RequeueAsync(id, request.ResetAttempts, cancellationToken))
        return Results.Conflict(new ApiErrorResponse("render-not-retryable", $"Render {id} cannot be retried."));
    var job = await jobs.GetAsync(id, cancellationToken) ?? throw new InvalidOperationException($"Render {id} disappeared after requeue.");
    await outbox.PublishAsync(id, cancellationToken);
    return Results.Accepted($"/v1/renders/{id}", ToResponse(job));
});

app.MapGet("/v1/dead-letters", async (int? offset, int? limit, IRenderJobStore jobs, CancellationToken cancellationToken) =>
{
    var page = await jobs.QueryAsync(new RenderJobQuery(
        RenderJobStatus.Failed,
        Math.Max(0, offset ?? 0),
        Math.Clamp(limit ?? 50, 1, 200),
        DeadLettered: true), cancellationToken);
    return Results.Ok(page);
});

app.MapPost("/v1/renders/{id:guid}/replay", async (Guid id, ReplayRenderRequest request, IRenderJobStore jobs, RenderCommandOutbox outbox, CancellationToken cancellationToken) =>
{
    var current = await jobs.GetAsync(id, cancellationToken);
    if (current?.DeadLetteredAt is null)
        return Results.Conflict(new ApiErrorResponse("render-not-dead-lettered", $"Render {id} is not in the dead-letter state."));
    if (!await jobs.RequeueAsync(id, request.ResetAttempts, cancellationToken))
        return Results.Conflict(new ApiErrorResponse("render-not-replayable", $"Render {id} cannot be replayed."));
    await outbox.PublishAsync(id, cancellationToken);
    return Results.Accepted($"/v1/renders/{id}", ToResponse((await jobs.GetAsync(id, cancellationToken))!));
});

app.MapGet("/v1/renders/{id:guid}/events", async (Guid id, HttpContext context, IRenderJobStore jobs, CancellationToken cancellationToken) =>
{
    context.Response.ContentType = "text/event-stream";
    context.Response.Headers["Cache-Control"] = "no-cache";
    context.Response.Headers.Append("X-Accel-Buffering", "no");
    context.Response.Headers.Append("Connection", "keep-alive");
    var lastEventId = SseEventFormatter.ParseLastEventId(context.Request.Headers["Last-Event-ID"].FirstOrDefault());
    RenderJobStatus? previousStatus = null;
    int? previousProgress = null;
    var lastHeartbeat = DateTimeOffset.UtcNow;
    while (!cancellationToken.IsCancellationRequested)
    {
        var job = await jobs.GetAsync(id, cancellationToken);
        if (job is null)
        {
            var eventId = DateTimeOffset.UtcNow.UtcTicks;
            await context.Response.WriteAsync(SseEventFormatter.Format("not-found", new { renderId = id }, eventId, 1500), cancellationToken);
            await context.Response.Body.FlushAsync(cancellationToken);
            return;
        }
        var currentEventId = (job.UpdatedAt ?? job.CreatedAt).UtcTicks;
        if ((previousStatus != job.Status || previousProgress != job.ProgressPercent) && currentEventId > lastEventId)
        {
            await context.Response.WriteAsync(SseEventFormatter.Format("render-status", ToResponse(job), currentEventId, previousStatus is null ? 1500 : null), cancellationToken);
            await context.Response.Body.FlushAsync(cancellationToken);
            lastEventId = currentEventId;
            previousStatus = job.Status;
            previousProgress = job.ProgressPercent;
        }
        if (job.Status is RenderJobStatus.Completed or RenderJobStatus.Failed or RenderJobStatus.Cancelled) return;
        if (DateTimeOffset.UtcNow - lastHeartbeat >= TimeSpan.FromSeconds(10))
        {
            await context.Response.WriteAsync(SseEventFormatter.Heartbeat(DateTimeOffset.UtcNow), cancellationToken);
            await context.Response.Body.FlushAsync(cancellationToken);
            lastHeartbeat = DateTimeOffset.UtcNow;
        }
        await Task.Delay(TimeSpan.FromMilliseconds(750), cancellationToken);
    }
});

app.Run();

static RenderJobResponse ToResponse(RenderJob job) => new(job,
    $"/v1/renders/{job.Id}", $"/v1/renders/{job.Id}/content", $"/v1/renders/{job.Id}/events",
    job.Status == RenderJobStatus.Completed && job.ResultPath is not null);

static async Task<RenderJob?> WaitForTerminalJobAsync(IRenderJobStore jobs, Guid id, TimeSpan timeout, CancellationToken cancellationToken)
{
    var deadline = DateTimeOffset.UtcNow.Add(timeout);
    do
    {
        var job = await jobs.GetAsync(id, cancellationToken);
        if (job?.Status is RenderJobStatus.Completed or RenderJobStatus.Failed or RenderJobStatus.Cancelled) return job;
        await Task.Delay(TimeSpan.FromMilliseconds(200), cancellationToken);
    } while (DateTimeOffset.UtcNow < deadline);
    return await jobs.GetAsync(id, cancellationToken);
}

static string FileName(RenderJob job) => string.Equals(job.ContentType, "application/vnd.rune.render-set+json", StringComparison.OrdinalIgnoreCase)
    ? $"rune-{job.Id:N}-artifact-set.json"
    : $"rune-{job.Id:N}.{job.OutputFormat switch
    {
        RenderOutputFormat.StaticHtml => "html",
        RenderOutputFormat.Pdf or RenderOutputFormat.PdfA => "pdf",
        RenderOutputFormat.Png => "png",
        RenderOutputFormat.Jpeg => "jpg",
        RenderOutputFormat.Svg => "svg",
        _ => "bin"
    }}";

static string ArtifactContentType(string name) => Path.GetExtension(name).ToLowerInvariant() switch
{
    ".html" or ".htm" => "text/html; charset=utf-8",
    ".json" => "application/json",
    ".pdf" => "application/pdf",
    ".svg" => "image/svg+xml",
    ".jpg" or ".jpeg" => "image/jpeg",
    ".jp2" => "image/jp2",
    ".bmp" => "image/bmp",
    ".png" => "image/png",
    _ => "application/octet-stream"
};

static string Tenant(HttpContext context)
{
    var value = context.Request.Headers["X-RUNE-Tenant"].FirstOrDefault();
    return string.IsNullOrWhiteSpace(value) ? "default" : value.Trim();
}

static object OpenApiDocument(string version) => new
{
    openapi = "3.1.0",
    info = new { title = "RUNE API", version, description = "Document compilation and browser rendering API." },
    servers = new[] { new { url = "/" } },
    paths = new Dictionary<string, object>
    {
        ["/metrics"] = new { get = new { summary = "Export Prometheus metrics for distributed render operations" } },
        ["/v1/render"] = new { post = new { summary = "Compile Markdown or HTML, convert PDF to HTML, or create a browser render", requestBody = new { required = true, content = new Dictionary<string, object> { ["application/json"] = new { schema = new Dictionary<string, string> { ["$ref"] = "/v1/schemas/render-request.v1.schema.json" } } } }, responses = new Dictionary<string, object> { ["200"] = new { description = "Synchronous result" }, ["202"] = new { description = "Asynchronous render or conversion accepted" }, ["400"] = new { description = "Invalid request" } } } },
        ["/v1/artifacts/compare"] = new { post = new { summary = "Retired synchronous comparison endpoint", responses = new Dictionary<string, object> { ["410"] = new { description = "Use /v1/comparisons" } } } },
        ["/v1/comparisons"] = new { post = new { summary = "Create an asynchronous artifact-addressed comparison job", requestBody = new { required = true, content = new Dictionary<string, object> { ["application/json"] = new { schema = new Dictionary<string, string> { ["$ref"] = "/v1/schemas/comparison-job.v1.schema.json" } } } }, responses = new Dictionary<string, object> { ["202"] = new { description = "Comparison accepted" }, ["400"] = new { description = "Invalid comparison request" } } } },
        ["/v1/comparisons/{id}"] = new { get = new { summary = "Get comparison job status" } },
        ["/v1/comparisons/{id}/events"] = new { get = new { summary = "Stream comparison job status" } },
        ["/v1/comparisons/{id}/report.json"] = new { get = new { summary = "Download static comparison JSON report" } },
        ["/v1/comparisons/{id}/report.html"] = new { get = new { summary = "Download static sanitized comparison HTML report" } },
        ["/v1/comparisons/{id}/manifest"] = new { get = new { summary = "Download comparison publication manifest" } },
        ["/v1/renders"] = new { get = new { summary = "List render jobs" } },
        ["/v1/renders/{id}"] = new { get = new { summary = "Get render status" } },
        ["/v1/renders/{id}/content"] = new { get = new { summary = "Download render result" } },
        ["/v1/renders/{id}/conversion-report"] = new { get = new { summary = "Download a PDF conversion report" } },
        ["/v1/renders/{id}/artifacts"] = new { get = new { summary = "Download the committed artifact-set manifest" } },
        ["/v1/renders/{id}/artifacts/{name}"] = new { get = new { summary = "Download an individual committed artifact" } },
        ["/v1/renders/{id}/package"] = new { get = new { summary = "Download the optional atomic artifact-set ZIP package" } },
        ["/v1/renders/{id}/events"] = new { get = new { summary = "Stream render status as Server-Sent Events" } },
        ["/v1/renders/{id}/cancel"] = new { post = new { summary = "Cancel a queued or running render" } },
        ["/v1/renders/{id}/retry"] = new { post = new { summary = "Retry a failed or cancelled render" } },
        ["/v1/renders/{id}/replay"] = new { post = new { summary = "Replay a dead-lettered render with a new durable dispatch generation" } },
        ["/v1/dead-letters"] = new { get = new { summary = "List terminal dead-lettered render jobs" } },
        ["/v1/schemas"] = new { get = new { summary = "List published JSON schemas" } },
        ["/v1/schemas/{name}"] = new { get = new { summary = "Get a published JSON schema" } }
    }
};

sealed class RenderCommandOutboxWorker(
    RenderCommandOutbox outbox,
    ILogger<RenderCommandOutboxWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(500));
        do
        {
            try
            {
                var count = await outbox.PublishAvailableAsync(100, stoppingToken);
                if (count > 0) logger.LogInformation("Published {Count} durable render commands", count);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch (Exception exception) { logger.LogError(exception, "Durable render command reconciliation failed"); }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}

sealed class ComparisonJobWorker(ComparisonJobService service) : BackgroundService
{
    protected override Task ExecuteAsync(CancellationToken stoppingToken) => service.ExecuteAsync(stoppingToken);
}
