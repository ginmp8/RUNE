using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Rune.Api.Contracts;
using Rune.Core;
using Rune.Job.Contracts;

namespace Rune.Client;

public sealed class RuneApiClient(HttpClient httpClient)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
    };

    public async ValueTask<HttpResponseMessage> RenderRawAsync(RenderRequest request, CancellationToken cancellationToken = default) =>
        await httpClient.PostAsJsonAsync("/v1/render", request, JsonOptions, cancellationToken);

    public async ValueTask<HtmlRenderResponse> RenderInteractiveHtmlAsync(RenderRequest request, CancellationToken cancellationToken = default)
    {
        RequireOutput(request, RenderOutputFormat.InteractiveHtml);
        using var response = await RenderRawAsync(request, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
        return await response.Content.ReadFromJsonAsync<HtmlRenderResponse>(JsonOptions, cancellationToken)
            ?? throw new InvalidDataException("RUNE API returned an empty interactive HTML response.");
    }

    public async ValueTask<StructuredDocumentResponse> RenderStructuredDocumentAsync(RenderRequest request, CancellationToken cancellationToken = default)
    {
        RequireOutput(request, RenderOutputFormat.StructuredJson);
        using var response = await RenderRawAsync(request, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
        return await response.Content.ReadFromJsonAsync<StructuredDocumentResponse>(JsonOptions, cancellationToken)
            ?? throw new InvalidDataException("RUNE API returned an empty structured document response.");
    }

    public async ValueTask<RenderAcceptedResponse> CreateRenderAsync(RenderRequest request, CancellationToken cancellationToken = default)
    {
        var singularOutput = request.OutputFormat ?? RenderOutputFormat.InteractiveHtml;
        if (request.OutputFormats is not { Count: > 0 } && !singularOutput.RequiresBrowser() && request.SourceType != DocumentSourceType.Pdf)
            throw new ArgumentException("CreateRenderAsync requires a browser-backed output or PDF conversion request.", nameof(request));
        using var response = await RenderRawAsync(request, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
        if (response.Content.Headers.ContentType?.MediaType is { } mediaType && !mediaType.Equals("application/json", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("The request completed synchronously. Use RenderRawAsync when WaitForCompletion is enabled.");
        return await response.Content.ReadFromJsonAsync<RenderAcceptedResponse>(JsonOptions, cancellationToken)
            ?? throw new InvalidDataException("RUNE API returned an empty render response.");
    }

    [Obsolete("Synchronous Base64 comparison was retired in RUNE 0.18.0. Use CreateComparisonAsync and WaitComparisonAsync.", error: true)]
    public ValueTask<ArtifactComparisonResponse> CompareArtifactsAsync(ArtifactComparisonRequest request, CancellationToken cancellationToken = default) =>
        throw new NotSupportedException("Synchronous Base64 comparison was retired. Create an artifact-addressed comparison job instead.");

    public async ValueTask<ComparisonJobAccepted> CreateComparisonAsync(CreateComparisonJobRequest request, CancellationToken cancellationToken = default)
    {
        using var response = await httpClient.PostAsJsonAsync("/v1/comparisons", request, JsonOptions, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
        return await response.Content.ReadFromJsonAsync<ComparisonJobAccepted>(JsonOptions, cancellationToken)
            ?? throw new InvalidDataException("RUNE API returned an empty comparison acceptance response.");
    }

    public async ValueTask<ComparisonJobResponse> GetComparisonAsync(Guid id, CancellationToken cancellationToken = default)
    {
        using var response = await httpClient.GetAsync($"/v1/comparisons/{id:D}", cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
        return await response.Content.ReadFromJsonAsync<ComparisonJobResponse>(JsonOptions, cancellationToken)
            ?? throw new InvalidDataException("RUNE API returned an empty comparison job response.");
    }

    public async ValueTask<ComparisonJobResponse> WaitComparisonAsync(Guid id, TimeSpan timeout, TimeSpan? pollInterval = null, CancellationToken cancellationToken = default)
    {
        var deadline = DateTimeOffset.UtcNow.Add(timeout);
        var delay = pollInterval ?? TimeSpan.FromMilliseconds(500);
        while (true)
        {
            var job = await GetComparisonAsync(id, cancellationToken);
            if (job.Status is ComparisonJobStatus.Completed or ComparisonJobStatus.Failed or ComparisonJobStatus.Cancelled) return job;
            if (DateTimeOffset.UtcNow >= deadline) return job;
            await Task.Delay(delay, cancellationToken);
        }
    }

    public async ValueTask CancelComparisonAsync(Guid id, string? reason = null, CancellationToken cancellationToken = default)
    {
        using var response = await httpClient.PostAsJsonAsync($"/v1/comparisons/{id:D}/cancel", new CancelComparisonJobRequest(reason), JsonOptions, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
    }

    public async ValueTask<ComparisonJobResponse> RetryComparisonAsync(Guid id, bool resetAttempts = false, CancellationToken cancellationToken = default)
    {
        using var response = await httpClient.PostAsJsonAsync($"/v1/comparisons/{id:D}/retry", new RetryComparisonJobRequest(resetAttempts), JsonOptions, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
        return await GetComparisonAsync(id, cancellationToken);
    }

    public ValueTask<Stream> DownloadComparisonJsonAsync(Guid id, CancellationToken cancellationToken = default) =>
        DownloadOwnedStreamAsync($"/v1/comparisons/{id:D}/report.json", cancellationToken);

    public ValueTask<Stream> DownloadComparisonHtmlAsync(Guid id, CancellationToken cancellationToken = default) =>
        DownloadOwnedStreamAsync($"/v1/comparisons/{id:D}/report.html", cancellationToken);

    public ValueTask<Stream> DownloadComparisonManifestAsync(Guid id, CancellationToken cancellationToken = default) =>
        DownloadOwnedStreamAsync($"/v1/comparisons/{id:D}/manifest", cancellationToken);

    public async ValueTask<RenderJobResponse> GetRenderAsync(Guid id, CancellationToken cancellationToken = default)
    {
        using var response = await httpClient.GetAsync($"/v1/renders/{id}", cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
        return await response.Content.ReadFromJsonAsync<RenderJobResponse>(JsonOptions, cancellationToken)
            ?? throw new InvalidDataException("RUNE API returned an empty job response.");
    }

    public async ValueTask<RenderJobResponse> WaitAsync(Guid id, TimeSpan timeout, TimeSpan? pollInterval = null, CancellationToken cancellationToken = default)
    {
        var deadline = DateTimeOffset.UtcNow.Add(timeout);
        var delay = pollInterval ?? TimeSpan.FromMilliseconds(500);
        while (true)
        {
            var job = await GetRenderAsync(id, cancellationToken);
            if (job.Job.Status is RenderJobStatus.Completed or RenderJobStatus.Failed or RenderJobStatus.Cancelled) return job;
            if (DateTimeOffset.UtcNow >= deadline) return job;
            await Task.Delay(delay, cancellationToken);
        }
    }

    public async ValueTask<Stream> DownloadAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var response = await httpClient.GetAsync($"/v1/renders/{id}/content", HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
        return new ResponseOwnedStream(response, await response.Content.ReadAsStreamAsync(cancellationToken));
    }

    public async ValueTask<JsonDocument> GetConversionReportAsync(Guid id, CancellationToken cancellationToken = default)
    {
        using var response = await httpClient.GetAsync($"/v1/renders/{id}/conversion-report", cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
        return await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(cancellationToken), cancellationToken: cancellationToken);
    }

    public async ValueTask<Stream> DownloadArtifactAsync(Guid id, string name, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        var response = await httpClient.GetAsync($"/v1/renders/{id}/artifacts/{Uri.EscapeDataString(name)}", HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
        return new ResponseOwnedStream(response, await response.Content.ReadAsStreamAsync(cancellationToken));
    }

    public ValueTask<Stream> DownloadArtifactSetManifestAsync(Guid id, CancellationToken cancellationToken = default) =>
        DownloadOwnedStreamAsync($"/v1/renders/{id:D}/artifacts", cancellationToken);

    public ValueTask<Stream> DownloadArtifactPackageAsync(Guid id, CancellationToken cancellationToken = default) =>
        DownloadOwnedStreamAsync($"/v1/renders/{id:D}/package", cancellationToken);

    public ValueTask<RenderAcceptedResponse> ConvertPdfAsync(
        byte[] content,
        PdfImportOptions? options = null,
        string sourceName = "input.pdf",
        string? idempotencyKey = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(content);
        var resourcePath = $"source/{Path.GetFileName(sourceName)}";
        var request = new RenderRequest(
            DocumentSourceType.Pdf,
            OutputFormat: RenderOutputFormat.StaticHtml,
            Resources: [new ResourceInput(resourcePath, Convert.ToBase64String(content), "application/pdf")],
            IdempotencyKey: idempotencyKey,
            DocumentName: Path.GetFileName(sourceName),
            SourceResourcePath: resourcePath,
            PdfImport: options ?? new PdfImportOptions());
        return CreateRenderAsync(request, cancellationToken);
    }

    public async ValueTask CancelAsync(Guid id, string? reason = null, CancellationToken cancellationToken = default)
    {
        using var response = await httpClient.PostAsJsonAsync($"/v1/renders/{id}/cancel", new CancelRenderRequest(reason), JsonOptions, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
    }

    public async ValueTask RetryAsync(Guid id, bool resetAttempts = false, CancellationToken cancellationToken = default)
    {
        using var response = await httpClient.PostAsJsonAsync($"/v1/renders/{id}/retry", new RetryRenderRequest(resetAttempts), JsonOptions, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
    }

    public async ValueTask<RenderJobPage> ListAsync(string query = "", CancellationToken cancellationToken = default)
    {
        using var response = await httpClient.GetAsync($"/v1/renders{query}", cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
        return await response.Content.ReadFromJsonAsync<RenderJobPage>(JsonOptions, cancellationToken)
            ?? new RenderJobPage([], 0, 50, 0);
    }

    public async ValueTask<JsonDocument> GetFeaturesAsync(CancellationToken cancellationToken = default)
    {
        using var response = await httpClient.GetAsync("/v1/features", cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
        return await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(cancellationToken), cancellationToken: cancellationToken);
    }

    public async ValueTask<IReadOnlyList<string>> ListSchemasAsync(CancellationToken cancellationToken = default)
    {
        using var response = await httpClient.GetAsync("/v1/schemas", cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
        return await response.Content.ReadFromJsonAsync<string[]>(JsonOptions, cancellationToken) ?? [];
    }

    public async ValueTask<Stream> OpenEventsAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var response = await httpClient.GetAsync($"/v1/renders/{id}/events", HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
        return new ResponseOwnedStream(response, await response.Content.ReadAsStreamAsync(cancellationToken));
    }

    private async ValueTask<Stream> DownloadOwnedStreamAsync(string path, CancellationToken cancellationToken)
    {
        var response = await httpClient.GetAsync(path, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
        return new ResponseOwnedStream(response, await response.Content.ReadAsStreamAsync(cancellationToken));
    }

    private static void RequireOutput(RenderRequest request, RenderOutputFormat output)
    {
        if (request.OutputFormats is { Count: > 0 })
            throw new ArgumentException("Synchronous typed render helpers do not accept outputFormats.", nameof(request));
        if (request.OutputFormat != output)
            throw new ArgumentException($"The request output must be {output}.", nameof(request));
    }

    private static async Task EnsureSuccessAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        if (response.IsSuccessStatusCode) return;
        var message = await response.Content.ReadAsStringAsync(cancellationToken);
        throw new HttpRequestException($"RUNE API returned {(int)response.StatusCode}: {message}", null, response.StatusCode);
    }

    private sealed class ResponseOwnedStream(HttpResponseMessage response, Stream inner) : Stream
    {
        public override bool CanRead => inner.CanRead;
        public override bool CanSeek => inner.CanSeek;
        public override bool CanWrite => false;
        public override long Length => inner.Length;
        public override long Position { get => inner.Position; set => inner.Position = value; }
        public override void Flush() => inner.Flush();
        public override int Read(byte[] buffer, int offset, int count) => inner.Read(buffer, offset, count);
        public override long Seek(long offset, SeekOrigin origin) => inner.Seek(offset, origin);
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        public override Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken) => inner.ReadAsync(buffer, offset, count, cancellationToken);
        protected override void Dispose(bool disposing) { if (disposing) { inner.Dispose(); response.Dispose(); } base.Dispose(disposing); }
        public override async ValueTask DisposeAsync() { await inner.DisposeAsync(); response.Dispose(); GC.SuppressFinalize(this); }
    }
}
