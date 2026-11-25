using System.Net;
using System.Text;
using System.Text.Json;
using Rune.Client;
using Rune.Core;

namespace Rune.Engine.Tests;

public sealed class PdfContractTests
{
    [Fact]
    public async Task Dotnet_sdk_serializes_pdf_conversion_and_reads_report()
    {
        string? requestBody = null;
        var handler = new StubHandler(async request =>
        {
            if (request.RequestUri?.AbsolutePath == "/v1/render")
            {
                requestBody = await request.Content!.ReadAsStringAsync();
                return Json(HttpStatusCode.Accepted, """
                    {"renderId":"00000000-0000-0000-0000-000000000009","status":"queued","statusUrl":"/v1/renders/00000000-0000-0000-0000-000000000009","resultUrl":"/v1/renders/00000000-0000-0000-0000-000000000009/content","eventsUrl":"/v1/renders/00000000-0000-0000-0000-000000000009/events","createdAt":"2026-07-26T00:00:00Z"}
                    """);
            }
            if (request.RequestUri?.AbsolutePath.EndsWith("/conversion-report", StringComparison.Ordinal) == true)
                return Json(HttpStatusCode.OK, "{\"schemaVersion\":\"1.0\",\"effectiveMode\":\"hybrid\"}");
            return new HttpResponseMessage(HttpStatusCode.NotFound);
        });
        using var http = new HttpClient(handler) { BaseAddress = new Uri("http://rune") };
        var client = new RuneApiClient(http);

        var accepted = await client.ConvertPdfAsync("%PDF-1.4"u8.ToArray(), new PdfImportOptions(PdfImportMode.Hybrid));
        using var report = await client.GetConversionReportAsync(accepted.RenderId);

        Assert.NotNull(requestBody);
        using var request = JsonDocument.Parse(requestBody);
        Assert.Equal("pdf", request.RootElement.GetProperty("sourceType").GetString());
        Assert.Equal("staticHtml", request.RootElement.GetProperty("outputFormat").GetString());
        Assert.Equal("source/input.pdf", request.RootElement.GetProperty("sourceResourcePath").GetString());
        Assert.Equal("hybrid", request.RootElement.GetProperty("pdfImport").GetProperty("mode").GetString());
        Assert.Equal("application/pdf", request.RootElement.GetProperty("resources")[0].GetProperty("contentType").GetString());
        Assert.Equal("hybrid", report.RootElement.GetProperty("effectiveMode").GetString());
    }

    [Fact]
    public void Published_schemas_include_pdf_input_options_report_and_job_artifact()
    {
        var root = FindRepositoryRoot();
        var schemas = Path.Combine(root, "services", "rune", "schemas");
        using var request = JsonDocument.Parse(File.ReadAllText(Path.Combine(schemas, "render-request.v1.schema.json")));
        using var package = JsonDocument.Parse(File.ReadAllText(Path.Combine(schemas, "render-package.v1.schema.json")));
        using var report = JsonDocument.Parse(File.ReadAllText(Path.Combine(schemas, "pdf-conversion-report.v1.schema.json")));
        using var manifest = JsonDocument.Parse(File.ReadAllText(Path.Combine(schemas, "pdf-import-manifest.v1.schema.json")));
        using var packagePlan = JsonDocument.Parse(File.ReadAllText(Path.Combine(schemas, "native-pdf-import-plan.v1.schema.json")));
        using var job = JsonDocument.Parse(File.ReadAllText(Path.Combine(schemas, "render-job.v1.schema.json")));

        var sourceTypes = request.RootElement.GetProperty("properties").GetProperty("sourceType").GetProperty("enum")
            .EnumerateArray().Select(item => item.GetString()).ToArray();
        Assert.Contains("pdf", sourceTypes);
        Assert.Equal("pdf-import-options.v1.schema.json",
            request.RootElement.GetProperty("properties").GetProperty("pdfImport").GetProperty("oneOf")[0].GetProperty("$ref").GetString());
        Assert.Contains("1.1", package.RootElement.GetProperty("properties").GetProperty("contractVersion").GetProperty("enum")
            .EnumerateArray().Select(item => item.GetString()));
        Assert.Equal("1.1", report.RootElement.GetProperty("properties").GetProperty("schemaVersion").GetProperty("const").GetString());
        Assert.True(report.RootElement.GetProperty("properties").TryGetProperty("extractedArtifacts", out _));
        Assert.Equal("1.0", manifest.RootElement.GetProperty("properties").GetProperty("schemaVersion").GetProperty("const").GetString());
        Assert.Equal("native-page", packagePlan.RootElement.GetProperty("properties").GetProperty("requestedMode").GetProperty("const").GetString());
        Assert.True(package.RootElement.GetProperty("properties").TryGetProperty("nativePdfImports", out _));
        Assert.True(job.RootElement.GetProperty("properties").TryGetProperty("conversionReportPath", out _));
    }

    [Fact]
    public void Native_pdf_options_use_hyphenated_mode_and_lowercase_javascript_contract()
    {
        var options = new PdfImportOptions(
            Mode: PdfImportMode.NativePage,
            Signatures: PdfSignaturePolicy.Flatten,
            Forms: PdfFormPolicy.Reject,
            Annotations: new PdfAnnotationPolicies(PdfLinkAnnotationPolicy.Preserve, PdfCommentAnnotationPolicy.Remove, PdfAttachmentAnnotationPolicy.Remove),
            JavaScript: PdfJavaScriptPolicy.Reject,
            Fallback: PdfImportFallbackPolicy.Reject);
        var json = JsonSerializer.Serialize(options, new JsonSerializerOptions(JsonSerializerDefaults.Web)
        {
            Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
        });
        using var document = JsonDocument.Parse(json);
        Assert.Equal("native-page", document.RootElement.GetProperty("mode").GetString());
        Assert.Equal("reject", document.RootElement.GetProperty("javascript").GetString());
        Assert.False(document.RootElement.TryGetProperty("javaScript", out _));
        Assert.Equal("preserve", document.RootElement.GetProperty("annotations").GetProperty("links").GetString());
    }

    private static HttpResponseMessage Json(HttpStatusCode status, string content) => new(status)
    {
        Content = new StringContent(content, Encoding.UTF8, "application/json")
    };

    private static string FindRepositoryRoot()
    {
        DirectoryInfo? current = new(AppContext.BaseDirectory);
        while (current is not null)
        {
            if (File.Exists(Path.Combine(current.FullName, "RUNE.slnx"))) return current.FullName;
            current = current.Parent;
        }
        throw new DirectoryNotFoundException("RUNE repository root was not found.");
    }

    private sealed class StubHandler(Func<HttpRequestMessage, Task<HttpResponseMessage>> handler) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) => handler(request);
    }
}
