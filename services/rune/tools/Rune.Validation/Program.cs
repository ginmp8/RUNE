using System.Net;
using System.Text.Json;
using Rune.Api.Contracts;
using Rune.Client;
using System.Text;
using Rune.Application;
using Rune.Core;
using Rune.Job.Contracts;
using Rune.Jobs;
using Rune.Ownership;
using Rune.ReactFlow;
using System.Text.RegularExpressions;

var checks = new List<(string Name, Func<Task> Run)>
{
    ("document-model", ValidateDocumentModelAsync),
    ("render-options", ValidateRenderOptionsAsync),
    ("dotnet-client-sync-contracts", ValidateDotNetClientAsync),
    ("ownership-analysis", ValidateOwnershipAsync),
    ("ownership-cycle", ValidateOwnershipCycleAsync),
    ("reactflow-parser-security", ValidateReactFlowParserAsync),
    ("reactflow-complex-examples", ValidateReactFlowExamplesAsync),
    ("job-idempotency-concurrency", ValidateConcurrentIdempotencyAsync),
    ("job-lifecycle", ValidateJobLifecycleAsync),
    ("queued-cancellation", ValidateQueuedCancellationAsync),
    ("job-retention", ValidateRetentionAsync)
};

var failures = new List<string>();
foreach (var check in checks)
{
    try
    {
        await check.Run();
        Console.WriteLine($"PASS {check.Name}");
    }
    catch (Exception exception)
    {
        failures.Add($"{check.Name}: {exception.Message}");
        Console.Error.WriteLine($"FAIL {check.Name}: {exception}");
    }
}

if (failures.Count > 0)
{
    Console.Error.WriteLine($"VALIDATION FAILED ({failures.Count}/{checks.Count})");
    Environment.ExitCode = 1;
    return;
}
Console.WriteLine($"VALIDATION PASSED ({checks.Count} checks)");

static Task ValidateDocumentModelAsync()
{
    var model = RuneDocumentModelBuilder.FromCompiled(
        DocumentSourceType.Markdown,
        "Document",
        new Dictionary<string, object?> { ["title"] = "Document" },
        "<h1 id=\"one\">One</h1><h2 id=\"two\">Two</h2><p>Body</p>",
        new HashSet<string> { "mermaid" },
        []);
    Require(model.Nodes.Count == 3, "Document model should contain two headings and the HTML body.");
    Require(model.Nodes[0].Id == "one" && model.Nodes[1].Level == 2, "Heading identity or level was lost.");
    Require(model.RequiredRenderers.Contains("mermaid"), "Renderer inventory was lost.");
    return Task.CompletedTask;
}

static Task ValidateRenderOptionsAsync()
{
    var metadata = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
    {
        ["theme"] = "dark", ["page-size"] = "Letter", ["landscape"] = true,
        ["include-cover"] = true, ["toc"] = true, ["watermark"] = "Draft",
        ["cover-image"] = "logo.png", ["jpeg-quality"] = 81, ["pdfa-conformance"] = "3b"
    };
    var options = RenderOptionsResolver.Resolve(metadata);
    Require(options.Theme == "dark" && options.PageSize == "Letter" && options.Landscape, "Layout metadata was not applied.");
    Require(options.IncludeCover && options.IncludeToc && options.Watermark == "Draft", "Document metadata was not applied.");
    Require(options.CoverImage == "logo.png" && options.JpegQuality == 90 && options.PdfAConformance == "3b", "Front matter allowlist is invalid.");
    var disabled = RenderOptionsResolver.Apply(new RenderOptions(ApplyFrontMatter: false), metadata);
    Require(disabled.Theme == "professional" && disabled.PageSize == "A4", "ApplyFrontMatter=false was ignored.");
    return Task.CompletedTask;
}


static async Task ValidateDotNetClientAsync()
{
    var handler = new StubHandler(request =>
    {
        var body = request.RequestUri?.AbsolutePath switch
        {
            "/v1/render" => "{\"contentType\":\"text/html; charset=utf-8\",\"html\":\"<h1>ready</h1>\",\"requiredRenderers\":[],\"diagnostics\":[]}",
            "/v1/schemas" => "[\"render-request.v1.schema.json\"]",
            _ => "{}"
        };
        return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(body, Encoding.UTF8, "application/json") };
    });
    var client = new RuneApiClient(new HttpClient(handler) { BaseAddress = new Uri("http://rune") });
    var html = await client.RenderInteractiveHtmlAsync(new RenderRequest(DocumentSourceType.Markdown, "# ready", RenderOutputFormat.InteractiveHtml));
    Require(html.Html.Contains("ready", StringComparison.Ordinal), "The .NET client did not deserialize interactive HTML.");
    var schemas = await client.ListSchemasAsync();
    Require(schemas.SequenceEqual(["render-request.v1.schema.json"]), "The .NET client did not deserialize schema names.");
}

static Task ValidateOwnershipAsync()
{
    const string source = """
chart "Acme" [validation=partial, showIndirect=true]
entity founder "Founder" person@BR
entity holding "Holding" corporation@BR
entity operating "Operating" corporation@BR
founder -> holding : 80% [voting=90%]
holding -> operating : 60%
founder -> operating : 10%
""";
    var result = new OwnershipDslParser().Parse(source);
    Require(result.Errors.Count == 0, "A valid ownership chart emitted errors.");
    var document = result.Document ?? throw new InvalidOperationException("Ownership document was not produced.");
    Require(document.Entities.Count == 3 && document.Relations.Count == 3, "Ownership entities or relations were lost.");
    var indirect = document.Analysis.IndirectOwnership.SingleOrDefault(item => item.Source == "founder" && item.Target == "operating");
    if (indirect is null) throw new InvalidOperationException("Indirect ownership was not calculated.");
    Require(indirect.Economic == 48m, $"Expected 48% indirect ownership, got {indirect.Economic}%.");
    Require(document.Analysis.Roots.Contains("founder"), "Root detection failed.");
    return Task.CompletedTask;
}

static Task ValidateOwnershipCycleAsync()
{
    const string source = """
chart "Cycle" [showIndirect=true]
entity a "A" corporation@BR
entity b "B" corporation@BR
a -> b : 60%
b -> a : 20%
""";
    var result = new OwnershipDslParser().Parse(source);
    var document = result.Document ?? throw new InvalidOperationException("Ownership document was not produced.");
    Require(document.Analysis.Cycles.Count > 0, "Ownership cycle was not detected.");
    Require(document.Analysis.IndirectStatus == "cycle-detected", "Indirect ownership should be disabled for cyclic graphs.");
    return Task.CompletedTask;
}

static Task ValidateReactFlowParserAsync()
{
    const string legacy = """
{"schemaVersion":"0.9","elements":[{"id":"a","position":{"x":0,"y":0},"data":{"label":"A"}},{"id":"b","position":{"x":200,"y":0},"data":{"label":"B"}},{"id":"e","source":"a","target":"b"}]}
""";
    var migrated = ReactFlowDocumentParser.Parse(legacy);
    Require(migrated.Ok, "A supported legacy React Flow document did not migrate.");
    Require(migrated.Migrations?.SequenceEqual(["0.9->1.0"]) == true, "React Flow migration evidence is missing.");
    Require(migrated.Document?["nodes"]?.AsArray().Count == 2 && migrated.Document?["edges"]?.AsArray().Count == 1,
        "Legacy React Flow elements were not split into nodes and edges.");

    const string unsafeDocument = """
{"schemaVersion":"1.0","nodes":[{"id":"a","position":{"x":0,"y":0},"data":{"label":"A","script":"alert(1)","url":"https://example.invalid"}}],"edges":[]}
""";
    var rejected = ReactFlowDocumentParser.Parse(unsafeDocument);
    Require(!rejected.Ok && rejected.Diagnostics.Count(item => item.Code == "SECURITY_POLICY_VIOLATION") >= 2,
        "Unsafe React Flow fields or external URLs were accepted.");
    return Task.CompletedTask;
}

static Task ValidateReactFlowExamplesAsync()
{
    var root = FindWorkspaceRoot();
    var examples = Path.Combine(root, "services", "rune", "examples", "reactflow");
    var pattern = new Regex("```(?:reactflow|react-flow|xyflow|flow-json)\\s*\\n(.*?)\\n```",
        RegexOptions.Singleline | RegexOptions.IgnoreCase);
    var documents = 0;
    var nodes = 0;
    var edges = 0;
    foreach (var file in new[]
    {
        "enterprise-event-driven-platform.md",
        "fraud-decision-orchestration.md",
        "multi-region-resilience.md"
    })
    {
        var source = File.ReadAllText(Path.Combine(examples, file));
        var matches = pattern.Matches(source);
        Require(matches.Count > 0, $"React Flow example contains no document: {file}");
        foreach (Match match in matches)
        {
            var parsed = ReactFlowDocumentParser.Parse(match.Groups[1].Value);
            Require(parsed.Ok, $"React Flow example is invalid: {file}: {string.Join("; ", parsed.Diagnostics.Select(item => item.Message))}");
            documents++;
            nodes += parsed.Document?["nodes"]?.AsArray().Count ?? 0;
            edges += parsed.Document?["edges"]?.AsArray().Count ?? 0;
        }
    }
    Require(documents == 3 && nodes == 72 && edges == 82,
        $"React Flow recovery inventory mismatch: documents={documents}, nodes={nodes}, edges={edges}.");
    return Task.CompletedTask;
}

static string FindWorkspaceRoot()
{
    var current = new DirectoryInfo(Environment.CurrentDirectory);
    while (current is not null)
    {
        if (File.Exists(Path.Combine(current.FullName, "RUNE.slnx")) &&
            Directory.Exists(Path.Combine(current.FullName, "services", "rune"))) return current.FullName;
        current = current.Parent;
    }
    throw new DirectoryNotFoundException("RUNE workspace root was not found.");
}

static async Task ValidateConcurrentIdempotencyAsync()
{
    var root = TemporaryRoot();
    try
    {
        var service = new RenderJobService(new FileSystemRenderJobStore(root));
        var tasks = Enumerable.Range(0, 12)
            .Select(_ => service.CreateAsync("<p>same</p>", RenderOutputFormat.Pdf, new RenderOptions(), null, "same-key").AsTask())
            .ToArray();
        var jobs = await Task.WhenAll(tasks);
        Require(jobs.Select(job => job.Id).Distinct().Count() == 1, "Concurrent idempotent creates produced multiple jobs.");
    }
    finally { DeleteRoot(root); }
}

static async Task ValidateJobLifecycleAsync()
{
    var root = TemporaryRoot();
    try
    {
        var store = new FileSystemRenderJobStore(root);
        var service = new RenderJobService(store);
        var job = await service.CreateAsync("<p>x</p>", RenderOutputFormat.Pdf, new RenderOptions(), null, "lifecycle");
        Require(await store.TryClaimAsync(job.Id, "worker-a", TimeSpan.FromMinutes(1)), "Worker could not claim a queued job.");
        var claimed = await store.GetAsync(job.Id) ?? throw new InvalidOperationException("Claimed job disappeared.");
        Require(claimed.Status == RenderJobStatus.Claimed && claimed.Attempt == 1 && claimed.ClaimedBy == "worker-a", "Claim state is invalid.");
        Require(!await store.TryClaimAsync(job.Id, "worker-b", TimeSpan.FromMinutes(1)), "A foreign worker stole an active lease.");
        Require(await store.RenewLeaseAsync(job.Id, "worker-a", TimeSpan.FromMinutes(2)), "Lease renewal failed.");
        Require(await store.RequestCancellationAsync(job.Id, "test cancellation"), "Cancellation request failed.");
        var cancellation = await store.GetAsync(job.Id) ?? throw new InvalidOperationException("Cancelled job disappeared.");
        Require(cancellation.Status == RenderJobStatus.CancelRequested, "A claimed job should enter CancelRequested.");
        await store.SaveAsync(cancellation with { Status = RenderJobStatus.Cancelled, CompletedAt = DateTimeOffset.UtcNow, ClaimedBy = null, LeaseExpiresAt = null });
        Require(await store.RequeueAsync(job.Id, resetAttempts: true), "Cancelled job could not be requeued.");
        var requeued = await store.GetAsync(job.Id) ?? throw new InvalidOperationException("Requeued job disappeared.");
        Require(requeued.Status == RenderJobStatus.Queued && requeued.Attempt == 0, "Requeue did not reset lifecycle state.");
        await using var payload = new MemoryStream(Encoding.UTF8.GetBytes("result"));
        var length = await store.SaveResultAsync(job.Id, payload, "txt");
        Require(length == 6 && await store.OpenResultAsync(job.Id) is not null, "Result storage failed.");
        var page = await store.QueryAsync(new RenderJobQuery(Limit: 10));
        Require(page.Total == 1 && page.Items[0].Id == job.Id, "Job query did not return the stored job.");
    }
    finally { DeleteRoot(root); }
}


static async Task ValidateQueuedCancellationAsync()
{
    var root = TemporaryRoot();
    try
    {
        var store = new FileSystemRenderJobStore(root);
        var job = await new RenderJobService(store).CreateAsync("<p>x</p>", RenderOutputFormat.Pdf, new RenderOptions(), null, "queued-cancel");
        Require(await store.RequestCancellationAsync(job.Id, "cancel before claim"), "Queued cancellation failed.");
        var cancelled = await store.GetAsync(job.Id) ?? throw new InvalidOperationException("Cancelled job disappeared.");
        Require(cancelled.Status == RenderJobStatus.Cancelled && cancelled.CompletedAt is not null, "Queued job was not cancelled atomically.");
    }
    finally { DeleteRoot(root); }
}

static async Task ValidateRetentionAsync()
{
    var root = TemporaryRoot();
    try
    {
        var store = new FileSystemRenderJobStore(root);
        var service = new RenderJobService(store);
        var job = await service.CreateAsync("<p>x</p>", RenderOutputFormat.Png, new RenderOptions(), null, null);
        await store.SaveAsync(job with { Status = RenderJobStatus.Completed, CompletedAt = DateTimeOffset.UtcNow.AddDays(-10) });
        Require(await store.DeleteExpiredAsync(DateTimeOffset.UtcNow.AddDays(-7)) == 1, "Expired job was not deleted.");
        Require(await store.GetAsync(job.Id) is null, "Deleted job remains readable.");
    }
    finally { DeleteRoot(root); }
}

static string TemporaryRoot() => Path.Combine(Path.GetTempPath(), "rune-validation", Guid.NewGuid().ToString("N"));
static void DeleteRoot(string path) { if (Directory.Exists(path)) Directory.Delete(path, true); }
static void Require(bool condition, string message) { if (!condition) throw new InvalidOperationException(message); }


sealed class StubHandler(Func<HttpRequestMessage, HttpResponseMessage> handler) : HttpMessageHandler
{
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
        Task.FromResult(handler(request));
}
