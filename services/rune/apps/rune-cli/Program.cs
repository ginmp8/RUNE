using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Rune.Api.Contracts;
using Rune.Client;
using Rune.Core;

var exitCode = await RunAsync(args);
return exitCode;

static async Task<int> RunAsync(string[] args)
{
    if (args.Length == 0 || args[0] is "help" or "--help" or "-h")
    {
        PrintHelp();
        return 0;
    }

    if (args[0].Equals("verify-release", StringComparison.OrdinalIgnoreCase))
        return VerifyRelease(args[1..]);

    var baseUrl = Option(args, "--api") ?? Environment.GetEnvironmentVariable("RUNE_API_URL") ?? "http://localhost:8080";
    using var http = new HttpClient { BaseAddress = new Uri(baseUrl), Timeout = TimeSpan.FromMinutes(10) };
    var client = new RuneApiClient(http);
    try
    {
        return args[0].ToLowerInvariant() switch
        {
            "render" => await RenderAsync(args[1..], client),
            "status" => await StatusAsync(args[1..], client),
            "list" => await ListAsync(args[1..], client),
            "download" => await DownloadAsync(args[1..], client),
            "conversion-report" => await ConversionReportAsync(args[1..], client),
            "artifact" => await ArtifactAsync(args[1..], client),
            "artifact-set" => await ArtifactSetAsync(args[1..], client),
            "package" => await PackageAsync(args[1..], client),
            "comparison-create" => await ComparisonCreateAsync(args[1..], client),
            "comparison-status" => await ComparisonStatusAsync(args[1..], client),
            "comparison-report" => await ComparisonReportAsync(args[1..], client),
            "comparison-cancel" => await ComparisonCancelAsync(args[1..], client),
            "comparison-retry" => await ComparisonRetryAsync(args[1..], client),
            "cancel" => await CancelAsync(args[1..], client),
            "retry" => await RetryAsync(args[1..], client),
            "features" => await ProxyJsonAsync(http, "/v1/features"),
            _ when args.Length >= 2 && args[0] is "markdown" or "html" => await LegacyRenderAsync(args, client),
            _ => Error("Unknown command. Run 'rune-cli help'.")
        };
    }
    catch (Exception exception)
    {
        Console.Error.WriteLine(exception.Message);
        return 1;
    }
}

static async Task<int> RenderAsync(string[] args, RuneApiClient client)
{
    if (args.Length == 0) return Error("Usage: rune-cli render <path> [--source markdown|html|pdf] [--format static-html] [--output file] [--wait seconds]");
    var path = Path.GetFullPath(args[0]);
    var sourceOption = Option(args, "--source");
    var extension = Path.GetExtension(path);
    var sourceType = sourceOption?.ToLowerInvariant() switch
    {
        "pdf" => DocumentSourceType.Pdf,
        "html" => DocumentSourceType.Html,
        "markdown" => DocumentSourceType.Markdown,
        null when extension.Equals(".pdf", StringComparison.OrdinalIgnoreCase) => DocumentSourceType.Pdf,
        null when extension.Equals(".html", StringComparison.OrdinalIgnoreCase) || extension.Equals(".htm", StringComparison.OrdinalIgnoreCase) => DocumentSourceType.Html,
        null => DocumentSourceType.Markdown,
        _ => throw new ArgumentException($"Unknown source type: {sourceOption}")
    };
    var formatValues = Options(args, "--format").ToArray();
    var formats = (formatValues.Length == 0
        ? [ParseFormat(sourceType == DocumentSourceType.Pdf ? "static-html" : "interactive-html")]
        : formatValues.Select(ParseFormat).ToArray()).NormalizeOutputSet();
    var format = formats[0];
    var multiOutput = formats.Count > 1;
    if (sourceType == DocumentSourceType.Pdf && (multiOutput || format != RenderOutputFormat.StaticHtml))
        return Error("PDF input supports one --format static-html output.");
    if (Option(args, "--pdf-password") is not null)
        return Error("Encrypted or permission-restricted PDFs are rejected by the stable contract; --pdf-password is not supported.");
    var content = sourceType == DocumentSourceType.Pdf ? "" : await File.ReadAllTextAsync(path);
    var resources = new List<ResourceInput>();
    string? sourceResourcePath = null;
    PdfImportOptions? pdfImport = null;
    if (sourceType == DocumentSourceType.Pdf)
    {
        sourceResourcePath = $"source/{Path.GetFileName(path)}";
        resources.Add(new ResourceInput(sourceResourcePath, Convert.ToBase64String(await File.ReadAllBytesAsync(path)), "application/pdf"));
        pdfImport = new PdfImportOptions(
            ParsePdfMode(Option(args, "--pdf-mode") ?? "hybrid"),
            ParseOcrMode(Option(args, "--ocr-mode") ?? "off"),
            ParseDouble(Option(args, "--semantic-threshold"), 0.65, "semantic threshold"),
            VisualScale: ParseDouble(Option(args, "--visual-scale"), 1.5, "visual scale"),
            PreserveLinks: HasFlag(args, "--preserve-links"),
            ExtractImages: !HasFlag(args, "--no-extract-images"),
            OcrLanguage: Option(args, "--ocr-language") ?? "eng");
    }
    foreach (var resourcePath in Options(args, "--resource"))
    {
        var full = Path.GetFullPath(resourcePath);
        resources.Add(new ResourceInput(Path.GetFileName(resourcePath), Convert.ToBase64String(await File.ReadAllBytesAsync(full))));
    }
    var request = new RenderRequest(sourceType, content, multiOutput ? null : format,
        HasFlag(args, "--trusted") ? HtmlTrustMode.Trusted : HtmlTrustMode.Safe,
        Resources: resources,
        IdempotencyKey: Option(args, "--idempotency-key"),
        DocumentName: Path.GetFileName(path),
        SourceResourcePath: sourceResourcePath,
        PdfImport: pdfImport,
        OutputFormats: multiOutput ? formats : null,
        MultiOutput: multiOutput ? new MultiOutputPublicationOptions(
            PackageMode: HasFlag(args, "--no-package") ? MultiOutputPackageMode.None : MultiOutputPackageMode.Zip,
            ArtifactNamePattern: Option(args, "--artifact-name") ?? "{documentName}.{outputExtension}") : null);
    using var response = await client.RenderRawAsync(request);
    if (!response.IsSuccessStatusCode)
    {
        Console.Error.WriteLine(await response.Content.ReadAsStringAsync());
        return 1;
    }
    if (!multiOutput && format is RenderOutputFormat.InteractiveHtml or RenderOutputFormat.StructuredJson)
    {
        var payload = await response.Content.ReadAsByteArrayAsync();
        var output = Option(args, "--output");
        if (output is null) Console.WriteLine(System.Text.Encoding.UTF8.GetString(payload));
        else await File.WriteAllBytesAsync(output, payload);
        return 0;
    }
    var accepted = await response.Content.ReadFromJsonAsync<RenderAcceptedResponse>(JsonOptions())
        ?? throw new InvalidDataException("RUNE API returned an empty response.");
    Console.WriteLine(accepted.RenderId);
    var waitSeconds = int.TryParse(Option(args, "--wait"), out var wait) ? wait : 0;
    if (waitSeconds <= 0) return 0;
    var terminal = await client.WaitAsync(accepted.RenderId, TimeSpan.FromSeconds(waitSeconds));
    if (terminal.Job.Status != Rune.Job.Contracts.RenderJobStatus.Completed)
    {
        Console.Error.WriteLine($"Render ended with status {terminal.Job.Status}: {terminal.Job.Error}");
        return 1;
    }
    var outputPath = Option(args, "--output") ?? (multiOutput
        ? $"rune-{accepted.RenderId:N}-artifacts.{(HasFlag(args, "--no-package") ? "json" : "zip")}"
        : $"rune-{accepted.RenderId:N}.{Extension(format)}");
    await using var source = multiOutput
        ? (HasFlag(args, "--no-package") ? await client.DownloadArtifactSetManifestAsync(accepted.RenderId) : await client.DownloadArtifactPackageAsync(accepted.RenderId))
        : await client.DownloadAsync(accepted.RenderId);
    await using var destination = File.Create(outputPath);
    await source.CopyToAsync(destination);
    Console.WriteLine(outputPath);
    return 0;
}

static async Task<int> LegacyRenderAsync(string[] args, RuneApiClient client)
{
    var forwarded = new List<string> { args[1], "--source", args[0] };
    if (args.Length > 2) { forwarded.Add("--format"); forwarded.Add(args[2]); }
    return await RenderAsync(forwarded.ToArray(), client);
}

static async Task<int> StatusAsync(string[] args, RuneApiClient client)
{
    if (args.Length == 0 || !Guid.TryParse(args[0], out var id)) return Error("Usage: rune-cli status <render-id>");
    Console.WriteLine(JsonSerializer.Serialize(await client.GetRenderAsync(id), JsonOptionsIndented()));
    return 0;
}

static async Task<int> ListAsync(string[] args, RuneApiClient client)
{
    var query = new List<string>();
    if (Option(args, "--status") is { } status) query.Add($"status={Uri.EscapeDataString(status)}");
    if (Option(args, "--limit") is { } limit) query.Add($"limit={Uri.EscapeDataString(limit)}");
    Console.WriteLine(JsonSerializer.Serialize(await client.ListAsync(query.Count == 0 ? "" : "?" + string.Join('&', query)), JsonOptionsIndented()));
    return 0;
}

static async Task<int> DownloadAsync(string[] args, RuneApiClient client)
{
    if (args.Length == 0 || !Guid.TryParse(args[0], out var id)) return Error("Usage: rune-cli download <render-id> [--output file]");
    var status = await client.GetRenderAsync(id);
    var multiOutput = status.Job.OutputFormats is { Count: > 0 };
    var output = Option(args, "--output") ?? (multiOutput ? $"rune-{id:N}-artifacts.zip" : $"rune-{id:N}.{Extension(status.Job.OutputFormat)}");
    await using var source = multiOutput ? await client.DownloadArtifactPackageAsync(id) : await client.DownloadAsync(id);
    await using var destination = File.Create(output);
    await source.CopyToAsync(destination);
    Console.WriteLine(output);
    return 0;
}

static async Task<int> ConversionReportAsync(string[] args, RuneApiClient client)
{
    if (args.Length == 0 || !Guid.TryParse(args[0], out var id)) return Error("Usage: rune-cli conversion-report <render-id> [--output file]");
    using var report = await client.GetConversionReportAsync(id);
    var json = JsonSerializer.Serialize(report.RootElement, JsonOptionsIndented());
    var output = Option(args, "--output");
    if (output is null) Console.WriteLine(json);
    else await File.WriteAllTextAsync(output, json + Environment.NewLine);
    return 0;
}

static async Task<int> ArtifactAsync(string[] args, RuneApiClient client)
{
    if (args.Length < 2 || !Guid.TryParse(args[0], out var id)) return Error("Usage: rune-cli artifact <render-id> <name> [--output file]");
    var output = Option(args, "--output") ?? args[1];
    await using var source = await client.DownloadArtifactAsync(id, args[1]);
    await using var destination = File.Create(output);
    await source.CopyToAsync(destination);
    Console.WriteLine(output);
    return 0;
}

static async Task<int> ArtifactSetAsync(string[] args, RuneApiClient client)
{
    if (args.Length == 0 || !Guid.TryParse(args[0], out var id)) return Error("Usage: rune-cli artifact-set <render-id> [--output file]");
    var output = Option(args, "--output") ?? $"rune-{id:N}-artifact-set.json";
    await using var source = await client.DownloadArtifactSetManifestAsync(id);
    await using var destination = File.Create(output);
    await source.CopyToAsync(destination);
    Console.WriteLine(output);
    return 0;
}

static async Task<int> PackageAsync(string[] args, RuneApiClient client)
{
    if (args.Length == 0 || !Guid.TryParse(args[0], out var id)) return Error("Usage: rune-cli package <render-id> [--output file]");
    var output = Option(args, "--output") ?? $"rune-{id:N}-artifacts.zip";
    await using var source = await client.DownloadArtifactPackageAsync(id);
    await using var destination = File.Create(output);
    await source.CopyToAsync(destination);
    Console.WriteLine(output);
    return 0;
}

static async Task<int> ComparisonCreateAsync(string[] args, RuneApiClient client)
{
    if (args.Length < 2 || !Guid.TryParse(args[0], out var left) || !Guid.TryParse(args[1], out var right))
        return Error("Usage: rune-cli comparison-create <left-render-id> <right-render-id> [--left-artifact name] [--right-artifact name] [--profile name] [--visual] [--ocr]");
    var request = new CreateComparisonJobRequest(
        new ComparisonArtifactReference(left, Option(args, "--left-artifact") ?? "content"),
        new ComparisonArtifactReference(right, Option(args, "--right-artifact") ?? "content"),
        new ArtifactComparisonProfile(
            Name: Option(args, "--profile") ?? "default",
            CompareVisual: HasFlag(args, "--visual"),
            CompareOcr: HasFlag(args, "--ocr")),
        Option(args, "--idempotency-key"));
    var accepted = await client.CreateComparisonAsync(request);
    Console.WriteLine(accepted.Id);
    return 0;
}

static async Task<int> ComparisonStatusAsync(string[] args, RuneApiClient client)
{
    if (args.Length == 0 || !Guid.TryParse(args[0], out var id)) return Error("Usage: rune-cli comparison-status <comparison-id>");
    Console.WriteLine(JsonSerializer.Serialize(await client.GetComparisonAsync(id), JsonOptionsIndented()));
    return 0;
}

static async Task<int> ComparisonReportAsync(string[] args, RuneApiClient client)
{
    if (args.Length == 0 || !Guid.TryParse(args[0], out var id)) return Error("Usage: rune-cli comparison-report <comparison-id> [--html] [--output file]");
    var html = HasFlag(args, "--html");
    var output = Option(args, "--output") ?? $"comparison-{id:N}.{(html ? "html" : "json")}";
    await using var source = html ? await client.DownloadComparisonHtmlAsync(id) : await client.DownloadComparisonJsonAsync(id);
    await using var destination = File.Create(output);
    await source.CopyToAsync(destination);
    Console.WriteLine(output);
    return 0;
}

static async Task<int> ComparisonCancelAsync(string[] args, RuneApiClient client)
{
    if (args.Length == 0 || !Guid.TryParse(args[0], out var id)) return Error("Usage: rune-cli comparison-cancel <comparison-id> [--reason text]");
    await client.CancelComparisonAsync(id, Option(args, "--reason"));
    return 0;
}

static async Task<int> ComparisonRetryAsync(string[] args, RuneApiClient client)
{
    if (args.Length == 0 || !Guid.TryParse(args[0], out var id)) return Error("Usage: rune-cli comparison-retry <comparison-id> [--reset-attempts]");
    Console.WriteLine(JsonSerializer.Serialize(await client.RetryComparisonAsync(id, HasFlag(args, "--reset-attempts")), JsonOptionsIndented()));
    return 0;
}

static async Task<int> CancelAsync(string[] args, RuneApiClient client)
{
    if (args.Length == 0 || !Guid.TryParse(args[0], out var id)) return Error("Usage: rune-cli cancel <render-id> [--reason text]");
    await client.CancelAsync(id, Option(args, "--reason"));
    return 0;
}

static async Task<int> RetryAsync(string[] args, RuneApiClient client)
{
    if (args.Length == 0 || !Guid.TryParse(args[0], out var id)) return Error("Usage: rune-cli retry <render-id> [--reset-attempts]");
    await client.RetryAsync(id, HasFlag(args, "--reset-attempts"));
    return 0;
}


static int VerifyRelease(string[] args)
{
    if (args.Length == 0)
        return Error("Usage: rune-cli verify-release <RUNE-version.zip> [--checksum file]");
    var result = ReleasePackageVerifier.Verify(args[0], Option(args, "--checksum"));
    Console.WriteLine(JsonSerializer.Serialize(result, JsonOptionsIndented()));
    return result.IsValid ? 0 : 1;
}

static async Task<int> ProxyJsonAsync(HttpClient http, string path)
{
    var response = await http.GetAsync(path);
    var text = await response.Content.ReadAsStringAsync();
    Console.WriteLine(text);
    return response.IsSuccessStatusCode ? 0 : 1;
}

static RenderOutputFormat ParseFormat(string value) => value.Replace("-", string.Empty, StringComparison.Ordinal).ToLowerInvariant() switch
{
    "interactivehtml" or "html" => RenderOutputFormat.InteractiveHtml,
    "statichtml" => RenderOutputFormat.StaticHtml,
    "structuredjson" or "json" => RenderOutputFormat.StructuredJson,
    "pdf" => RenderOutputFormat.Pdf,
    "pdfa" => RenderOutputFormat.PdfA,
    "png" => RenderOutputFormat.Png,
    "jpeg" or "jpg" => RenderOutputFormat.Jpeg,
    "svg" => RenderOutputFormat.Svg,
    _ => throw new ArgumentException($"Unknown output format: {value}")
};

static PdfImportMode ParsePdfMode(string value) => value.ToLowerInvariant() switch
{
    "visual" => PdfImportMode.Visual,
    "semantic" => PdfImportMode.Semantic,
    "hybrid" => PdfImportMode.Hybrid,
    _ => throw new ArgumentException($"Unknown PDF conversion mode: {value}")
};

static PdfOcrMode ParseOcrMode(string value) => value.ToLowerInvariant() switch
{
    "off" => PdfOcrMode.Off,
    "auto" => PdfOcrMode.Auto,
    "force" => PdfOcrMode.Force,
    _ => throw new ArgumentException($"Unknown OCR mode: {value}")
};

static double ParseDouble(string? value, double fallback, string label) => value is null
    ? fallback
    : double.TryParse(value, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var parsed)
        ? parsed
        : throw new ArgumentException($"Invalid {label}: {value}");

static string Extension(RenderOutputFormat format) => format switch
{
    RenderOutputFormat.InteractiveHtml or RenderOutputFormat.StaticHtml => "html",
    RenderOutputFormat.StructuredJson => "json",
    RenderOutputFormat.Pdf or RenderOutputFormat.PdfA => "pdf",
    RenderOutputFormat.Png => "png",
    RenderOutputFormat.Jpeg => "jpg",
    RenderOutputFormat.Svg => "svg",
    _ => "bin"
};

static string? Option(string[] args, string name)
{
    for (var index = 0; index < args.Length - 1; index++) if (args[index].Equals(name, StringComparison.OrdinalIgnoreCase)) return args[index + 1];
    return null;
}

static IEnumerable<string> Options(string[] args, string name)
{
    for (var index = 0; index < args.Length - 1; index++) if (args[index].Equals(name, StringComparison.OrdinalIgnoreCase)) yield return args[index + 1];
}
static bool HasFlag(string[] args, string name) => args.Contains(name, StringComparer.OrdinalIgnoreCase);
static int Error(string message) { Console.Error.WriteLine(message); return 2; }
static JsonSerializerOptions JsonOptions() => new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };
static JsonSerializerOptions JsonOptionsIndented() => new(JsonSerializerDefaults.Web) { WriteIndented = true, Converters = { new JsonStringEnumConverter() } };

static void PrintHelp() => Console.WriteLine($"""
RUNE CLI {RuneVersion.Current}

Commands:
  rune-cli render <path> [--source markdown|html|pdf] [--format FORMAT ...]
                         [--output file] [--wait seconds] [--trusted] [--resource path]
                         [--artifact-name pattern] [--no-package]
                         [--pdf-mode visual|semantic|hybrid] [--ocr-mode off|auto|force] [--ocr-language eng]
                         [--preserve-links] [--no-extract-images] [--semantic-threshold 0.65] [--visual-scale 1.5]
  rune-cli status <render-id>
  rune-cli list [--status status] [--limit number]
  rune-cli download <render-id> [--output file]
  rune-cli conversion-report <render-id> [--output file]
  rune-cli artifact <render-id> <name> [--output file]
  rune-cli artifact-set <render-id> [--output file]
  rune-cli package <render-id> [--output file]
  rune-cli comparison-create <left-render-id> <right-render-id> [--visual] [--ocr]
  rune-cli comparison-status <comparison-id>
  rune-cli comparison-report <comparison-id> [--html] [--output file]
  rune-cli comparison-cancel <comparison-id> [--reason text]
  rune-cli comparison-retry <comparison-id> [--reset-attempts]
  rune-cli cancel <render-id> [--reason text]
  rune-cli retry <render-id> [--reset-attempts]
  rune-cli features
  rune-cli verify-release <RUNE-version.zip> [--checksum RUNE-version.sha256]

Environment:
  RUNE_API_URL  API base URL (default http://localhost:8080)
""");
