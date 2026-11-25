using System.Diagnostics;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Rune.Api.Contracts;

namespace Rune.Application;

public sealed partial class ArtifactComparisonService
{
    private const int MaximumArtifactBytes = 100_000_000;

    public async ValueTask<ArtifactComparisonResponse> CompareAsync(ArtifactComparisonRequest request, CancellationToken cancellationToken = default)
    {
        if (request.MaximumReportedRanges is < 0 or > 10_000)
            throw new ArgumentException("maximumReportedRanges must be between 0 and 10000.", nameof(request));
        ValidateAdvancedOptions(request.Advanced);
        var left = Decode(request.Left);
        var right = Decode(request.Right);
        var leftDescriptor = Describe(request.Left, left, request.NormalizeText);
        var rightDescriptor = Describe(request.Right, right, request.NormalizeText);
        var identical = CryptographicOperations.FixedTimeEquals(SHA256.HashData(left), SHA256.HashData(right));
        var equivalent = identical || leftDescriptor.NormalizedTextSha256 is not null &&
            string.Equals(leftDescriptor.NormalizedTextSha256, rightDescriptor.NormalizedTextSha256, StringComparison.Ordinal);
        var ranges = request.IncludeByteRanges && !identical
            ? DifferenceRanges(left, right, request.MaximumReportedRanges)
            : [];
        var diagnostics = new List<string>();
        if (!string.Equals(leftDescriptor.ContentType, rightDescriptor.ContentType, StringComparison.OrdinalIgnoreCase))
            diagnostics.Add("content-type-differs");
        if (leftDescriptor.Length != rightDescriptor.Length) diagnostics.Add("length-differs");
        if (leftDescriptor.Width != rightDescriptor.Width || leftDescriptor.Height != rightDescriptor.Height)
            diagnostics.Add("image-dimensions-differ");
        if (leftDescriptor.PdfPageCount != rightDescriptor.PdfPageCount) diagnostics.Add("pdf-page-count-differs");
        if (!identical && equivalent) diagnostics.Add("normalized-content-equivalent");

        PixelComparisonResult? pixel = null;
        OcrComparisonResult? ocr = null;
        PdfCanonicalComparisonResult? canonical = null;
        if (request.Advanced?.CanonicalizePdf == true)
        {
            if (leftDescriptor.ContentType == "application/pdf" && rightDescriptor.ContentType == "application/pdf")
            {
                var leftCanonical = CanonicalizePdf(left);
                var rightCanonical = CanonicalizePdf(right);
                canonical = new PdfCanonicalComparisonResult(
                    string.Equals(leftCanonical.Sha256, rightCanonical.Sha256, StringComparison.Ordinal),
                    leftCanonical.Sha256,
                    rightCanonical.Sha256,
                    leftCanonical.ObjectCount,
                    rightCanonical.ObjectCount,
                    leftCanonical.Limitations.Concat(rightCanonical.Limitations).Distinct(StringComparer.Ordinal).ToArray());
                equivalent |= canonical.Equivalent;
                if (canonical.Equivalent && !identical) diagnostics.Add("canonical-pdf-equivalent");
            }
            else diagnostics.Add("canonical-pdf-skipped-non-pdf");
        }

        if (request.Advanced is { PixelComparison: true } advanced)
        {
            pixel = await ComparePixelsAsync(left, leftDescriptor.ContentType, right, rightDescriptor.ContentType, advanced, cancellationToken);
            if (pixel.Executed)
            {
                equivalent |= pixel.Equivalent;
                if (pixel.Equivalent && !identical) diagnostics.Add("pixel-equivalent-within-tolerance");
            }
            else if (!string.IsNullOrWhiteSpace(pixel.Diagnostic)) diagnostics.Add(pixel.Diagnostic);
        }
        if (request.Advanced is { OcrComparison: true } ocrOptions)
        {
            ocr = await CompareOcrAsync(left, leftDescriptor.ContentType, right, rightDescriptor.ContentType, ocrOptions, cancellationToken);
            if (ocr.Executed)
            {
                equivalent |= ocr.Equivalent;
                if (ocr.Equivalent && !identical) diagnostics.Add("ocr-equivalent-within-tolerance");
            }
            else if (!string.IsNullOrWhiteSpace(ocr.Diagnostic)) diagnostics.Add(ocr.Diagnostic);
        }

        return new ArtifactComparisonResponse(identical, equivalent, leftDescriptor, rightDescriptor, ranges, diagnostics, pixel, ocr, canonical);
    }

    public ArtifactComparisonResponse Compare(ArtifactComparisonRequest request) => CompareAsync(request).AsTask().GetAwaiter().GetResult();

    private static void ValidateAdvancedOptions(ArtifactComparisonOptions? options)
    {
        if (options is null) return;
        if (options.PixelTolerancePercent is < 0 or > 100) throw new ArgumentException("pixelTolerancePercent must be between 0 and 100.");
        if (options.MaximumPixelMismatchRatio is < 0 or > 1) throw new ArgumentException("maximumPixelMismatchRatio must be between 0 and 1.");
        if (options.MinimumOcrSimilarity is < 0 or > 1) throw new ArgumentException("minimumOcrSimilarity must be between 0 and 1.");
        if (options.RasterDpi is < 36 or > 600) throw new ArgumentException("rasterDpi must be between 36 and 600.");
        if (options.TimeoutSeconds is < 1 or > 120) throw new ArgumentException("advanced comparison timeoutSeconds must be between 1 and 120.");
        if (!Regex.IsMatch(options.OcrLanguage, "^[A-Za-z0-9_+-]{1,32}$", RegexOptions.CultureInvariant))
            throw new ArgumentException("ocrLanguage is invalid.");
    }

    private static async ValueTask<PixelComparisonResult> ComparePixelsAsync(
        byte[] left, string leftContentType, byte[] right, string rightContentType,
        ArtifactComparisonOptions options, CancellationToken cancellationToken)
    {
        var magick = FindExecutable("RUNE_IMAGEMAGICK_PATH", "magick", "/opt/imagemagick/bin/magick", "/usr/bin/magick");
        if (magick is null) return new PixelComparisonResult(false, false, null, null, Diagnostic: "pixel-comparison-unavailable");
        var root = CreateTemporaryDirectory("pixel");
        try
        {
            var leftPages = await RasterizePagesAsync(root, "left", left, leftContentType, options, cancellationToken);
            var rightPages = await RasterizePagesAsync(root, "right", right, rightContentType, options, cancellationToken);
            if (leftPages.Count == 0 || rightPages.Count == 0)
                return new PixelComparisonResult(false, false, null, null, Diagnostic: "pixel-comparison-unsupported-artifact");
            if (leftPages.Count != rightPages.Count)
                return new PixelComparisonResult(true, false, null, 1, Diagnostic: "pixel-page-count-differs", ComparedPages: Math.Min(leftPages.Count, rightPages.Count));

            long differentPixels = 0;
            double totalPixels = 0;
            var differingPages = new List<int>();
            var diffPaths = new List<string>();
            (int Width, int Height)? firstSize = null;
            for (var index = 0; index < leftPages.Count; index++)
            {
                var leftSize = await IdentifyAsync(magick, leftPages[index], options.TimeoutSeconds, cancellationToken);
                var rightSize = await IdentifyAsync(magick, rightPages[index], options.TimeoutSeconds, cancellationToken);
                if (leftSize is null || rightSize is null)
                    return new PixelComparisonResult(false, false, null, null, Diagnostic: "pixel-identification-failed", ComparedPages: index);
                firstSize ??= leftSize;
                if (leftSize != rightSize)
                {
                    differingPages.Add(index + 1);
                    return new PixelComparisonResult(true, false, null, 1, firstSize.Value.Width, firstSize.Value.Height,
                        "pixel-dimensions-differ", ComparedPages: leftPages.Count, DifferingPages: differingPages);
                }
                var diffPath = Path.Combine(root, $"diff-{index + 1:D4}.png");
                var result = await RunProcessAsync(magick,
                    ["compare", "-metric", "AE", "-fuzz", options.PixelTolerancePercent.ToString("0.####", CultureInfo.InvariantCulture) + "%", leftPages[index], rightPages[index], diffPath],
                    options.TimeoutSeconds, cancellationToken, allowExitCodeOne: true);
                if (result.ExitCode is not (0 or 1))
                    return new PixelComparisonResult(false, false, null, null, firstSize.Value.Width, firstSize.Value.Height,
                        "pixel-comparison-failed", ComparedPages: index);
                var metricText = result.StandardError.Trim().Split('\n', StringSplitOptions.RemoveEmptyEntries).LastOrDefault()?.Trim() ?? "0";
                var metricMatch = Regex.Match(metricText, @"[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?", RegexOptions.CultureInvariant);
                if (!metricMatch.Success || !double.TryParse(metricMatch.Value, NumberStyles.Float, CultureInfo.InvariantCulture, out var doubleMetric))
                    return new PixelComparisonResult(false, false, null, null, firstSize.Value.Width, firstSize.Value.Height,
                        "pixel-metric-invalid", ComparedPages: index);
                var pageDifferent = checked((long)Math.Round(doubleMetric));
                differentPixels += pageDifferent;
                totalPixels += (double)leftSize.Value.Width * leftSize.Value.Height;
                if (pageDifferent > 0) differingPages.Add(index + 1);
                if (File.Exists(diffPath))
                {
                    var readableDiffPath = Path.Combine(root, $"diff-readable-{index + 1:D4}.png");
                    var preferredPath = await BuildReadableDiffAsync(magick, leftPages[index], rightPages[index], readableDiffPath, options.TimeoutSeconds, cancellationToken)
                        ?? diffPath;
                    diffPaths.Add(preferredPath);
                }
            }

            var ratio = totalPixels <= 0 ? 1 : differentPixels / totalPixels;
            var equivalent = ratio <= options.MaximumPixelMismatchRatio;
            string? diff = null;
            if (options.IncludePixelDiff && diffPaths.Count > 0)
            {
                var diffPath = diffPaths.Count == 1 ? diffPaths[0] : Path.Combine(root, "diff-all-pages.png");
                if (diffPaths.Count > 1)
                {
                    var append = diffPaths.Concat(["-append", diffPath]).ToArray();
                    var appendResult = await RunProcessAsync(magick, append, options.TimeoutSeconds, cancellationToken);
                    if (appendResult.ExitCode != 0) diffPath = diffPaths[0];
                }
                if (File.Exists(diffPath))
                {
                    var bytes = await File.ReadAllBytesAsync(diffPath, cancellationToken);
                    if (bytes.Length <= 10_000_000) diff = Convert.ToBase64String(bytes);
                }
            }
            return new PixelComparisonResult(true, equivalent, differentPixels, ratio, firstSize?.Width, firstSize?.Height,
                DiffImageBase64: diff, ComparedPages: leftPages.Count, DifferingPages: differingPages);
        }
        catch (Exception exception) when (exception is IOException or InvalidOperationException or TimeoutException)
        {
            return new PixelComparisonResult(false, false, null, null, Diagnostic: "pixel-comparison-failed:" + SafeDiagnostic(exception.Message));
        }
        finally { DeleteDirectoryBestEffort(root); }
    }

    private static async ValueTask<string?> BuildReadableDiffAsync(
        string magick,
        string leftPage,
        string rightPage,
        string outputPath,
        int timeoutSeconds,
        CancellationToken cancellationToken)
    {
        var directory = Path.GetDirectoryName(outputPath) ?? Path.GetTempPath();
        var token = Path.GetFileNameWithoutExtension(outputPath);
        var maskPath = Path.Combine(directory, token + "-mask.png");
        var overlayPath = Path.Combine(directory, token + "-overlay.png");

        var mask = await RunProcessAsync(magick,
            [leftPage, rightPage, "-compose", "difference", "-composite", "-colorspace", "gray", "-threshold", "0", maskPath],
            timeoutSeconds, cancellationToken);
        if (mask.ExitCode != 0 || !File.Exists(maskPath)) return null;

        var overlay = await RunProcessAsync(magick,
            [maskPath, "-fill", "red", "-opaque", "white", "-transparent", "black", overlayPath],
            timeoutSeconds, cancellationToken);
        if (overlay.ExitCode != 0 || !File.Exists(overlayPath)) return null;

        var composite = await RunProcessAsync(magick,
            [rightPage, overlayPath, "-compose", "over", "-composite", outputPath],
            timeoutSeconds, cancellationToken);
        return composite.ExitCode == 0 && File.Exists(outputPath) ? outputPath : null;
    }

    private static async ValueTask<OcrComparisonResult> CompareOcrAsync(
        byte[] left, string leftContentType, byte[] right, string rightContentType,
        ArtifactComparisonOptions options, CancellationToken cancellationToken)
    {
        var tesseract = FindExecutable("RUNE_TESSERACT_PATH", "tesseract", "/usr/bin/tesseract");
        if (tesseract is null) return new OcrComparisonResult(false, false, null, null, null, "ocr-comparison-unavailable");
        var root = CreateTemporaryDirectory("ocr");
        try
        {
            var leftPages = await RasterizePagesAsync(root, "left", left, leftContentType, options, cancellationToken);
            var rightPages = await RasterizePagesAsync(root, "right", right, rightContentType, options, cancellationToken);
            if (leftPages.Count == 0 || rightPages.Count == 0)
                return new OcrComparisonResult(false, false, null, null, null, "ocr-comparison-unsupported-artifact");
            if (leftPages.Count != rightPages.Count)
                return new OcrComparisonResult(true, false, null, null, 0, "ocr-page-count-differs", Math.Min(leftPages.Count, rightPages.Count));
            var leftText = new StringBuilder();
            var rightText = new StringBuilder();
            for (var index = 0; index < leftPages.Count; index++)
            {
                if (index > 0) { leftText.Append("\n\f\n"); rightText.Append("\n\f\n"); }
                leftText.Append(await OcrAsync(tesseract, leftPages[index], options, cancellationToken));
                rightText.Append(await OcrAsync(tesseract, rightPages[index], options, cancellationToken));
            }
            var normalizedLeft = NormalizeOcr(leftText.ToString());
            var normalizedRight = NormalizeOcr(rightText.ToString());
            var similarity = Similarity(normalizedLeft, normalizedRight);
            return new OcrComparisonResult(true, similarity >= options.MinimumOcrSimilarity,
                Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(normalizedLeft))),
                Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(normalizedRight))), similarity, ComparedPages: leftPages.Count);
        }
        catch (Exception exception) when (exception is IOException or InvalidOperationException or TimeoutException)
        {
            return new OcrComparisonResult(false, false, null, null, null, "ocr-comparison-failed:" + SafeDiagnostic(exception.Message));
        }
        finally { DeleteDirectoryBestEffort(root); }
    }

    private static async ValueTask<IReadOnlyList<string>> RasterizePagesAsync(string root, string name, byte[] bytes, string contentType, ArtifactComparisonOptions options, CancellationToken cancellationToken)
    {
        var input = Path.Combine(root, name + ExtensionFor(contentType));
        await File.WriteAllBytesAsync(input, bytes, cancellationToken);
        if (contentType == "application/pdf")
        {
            var pdftoppm = FindExecutable("RUNE_PDFTOPPM_PATH", "pdftoppm", "/usr/bin/pdftoppm");
            if (pdftoppm is null) return [];
            var prefix = Path.Combine(root, name + "-page");
            var result = await RunProcessAsync(pdftoppm,
                ["-png", "-r", options.RasterDpi.ToString(CultureInfo.InvariantCulture), input, prefix],
                options.TimeoutSeconds, cancellationToken);
            if (result.ExitCode != 0) return [];
            return Directory.EnumerateFiles(root, name + "-page-*.png")
                .OrderBy(path => PageNumber(path)).Take(500).ToArray();
        }
        if (contentType is not ("image/png" or "image/jpeg" or "image/svg+xml")) return [];
        var magick = FindExecutable("RUNE_IMAGEMAGICK_PATH", "magick", "/opt/imagemagick/bin/magick", "/usr/bin/magick");
        if (magick is null) return [];
        var output = Path.Combine(root, name + ".png");
        var conversion = await RunProcessAsync(magick, [input, "-background", "white", "-alpha", "remove", "-alpha", "off", output], options.TimeoutSeconds, cancellationToken);
        return conversion.ExitCode == 0 && File.Exists(output) ? [output] : [];
    }

    private static int PageNumber(string path)
    {
        var match = Regex.Match(Path.GetFileNameWithoutExtension(path), @"-(\d+)$", RegexOptions.CultureInvariant);
        return match.Success && int.TryParse(match.Groups[1].Value, CultureInfo.InvariantCulture, out var value) ? value : int.MaxValue;
    }

    private static async ValueTask<(int Width, int Height)?> IdentifyAsync(string magick, string path, int timeoutSeconds, CancellationToken cancellationToken)
    {
        var result = await RunProcessAsync(magick, ["identify", "-format", "%w %h", path], timeoutSeconds, cancellationToken);
        var values = result.StandardOutput.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return result.ExitCode == 0 && values.Length == 2 && int.TryParse(values[0], out var width) && int.TryParse(values[1], out var height)
            ? (width, height) : null;
    }

    private static async ValueTask<string> OcrAsync(string tesseract, string path, ArtifactComparisonOptions options, CancellationToken cancellationToken)
    {
        var result = await RunProcessAsync(tesseract, [path, "stdout", "-l", options.OcrLanguage, "--psm", "6"], options.TimeoutSeconds, cancellationToken);
        if (result.ExitCode != 0) throw new InvalidOperationException("Tesseract OCR failed.");
        return result.StandardOutput;
    }

    private static async ValueTask<ProcessResult> RunProcessAsync(string executable, IReadOnlyList<string> arguments, int timeoutSeconds, CancellationToken cancellationToken, bool allowExitCodeOne = false)
    {
        using var process = new Process { StartInfo = new ProcessStartInfo(executable) { RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false, CreateNoWindow = true } };
        foreach (var argument in arguments) process.StartInfo.ArgumentList.Add(argument);
        if (!process.Start()) throw new InvalidOperationException($"Could not start {Path.GetFileName(executable)}.");
        var stdout = process.StandardOutput.ReadToEndAsync(cancellationToken);
        var stderr = process.StandardError.ReadToEndAsync(cancellationToken);
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(timeoutSeconds));
        try { await process.WaitForExitAsync(timeout.Token); }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            try { process.Kill(true); } catch { }
            throw new TimeoutException($"{Path.GetFileName(executable)} exceeded the comparison timeout.");
        }
        var result = new ProcessResult(process.ExitCode, await stdout, await stderr);
        if (result.ExitCode != 0 && !(allowExitCodeOne && result.ExitCode == 1)) return result;
        return result;
    }

    private static string? FindExecutable(string environmentName, string command, params string[] commonPaths)
    {
        var configured = Environment.GetEnvironmentVariable(environmentName);
        if (!string.IsNullOrWhiteSpace(configured) && File.Exists(configured)) return configured;
        foreach (var path in commonPaths) if (File.Exists(path)) return path;
        var pathVariable = Environment.GetEnvironmentVariable("PATH") ?? string.Empty;
        return pathVariable.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries)
            .Select(directory => Path.Combine(directory, command)).FirstOrDefault(File.Exists);
    }

    private static (string Sha256, int ObjectCount, IReadOnlyList<string> Limitations) CanonicalizePdf(byte[] bytes)
    {
        var text = Encoding.Latin1.GetString(bytes);
        var limitations = new List<string>();
        if (text.Contains("/Encrypt", StringComparison.Ordinal)) limitations.Add("encrypted-pdf-canonicalization-is-best-effort");
        if (text.Contains("/ObjStm", StringComparison.Ordinal)) limitations.Add("object-stream-canonicalization-is-best-effort");
        text = PdfVolatileMetadataRegex().Replace(text, string.Empty);
        var objects = PdfObjectRegex().Matches(text).Select(match => NormalizePdfObject(match.Groups["body"].Value)).Order(StringComparer.Ordinal).ToArray();
        if (objects.Length == 0)
        {
            limitations.Add("no-indirect-objects-detected");
            objects = [NormalizePdfObject(text)];
        }
        var canonical = string.Join("\n--object--\n", objects);
        return (Convert.ToHexString(SHA256.HashData(Encoding.Latin1.GetBytes(canonical))), objects.Length, limitations);
    }

    private static string NormalizePdfObject(string value)
    {
        value = PdfReferenceRegex().Replace(value, "#REF");
        value = PdfStreamLengthRegex().Replace(value, "/Length #");
        value = PdfWhitespaceRegex().Replace(value, " ").Trim();
        return value;
    }

    private static string NormalizeOcr(string value) => Regex.Replace(value.Normalize(NormalizationForm.FormKC).ToLowerInvariant(), "\\s+", " ", RegexOptions.CultureInvariant).Trim();

    private static double Similarity(string left, string right)
    {
        if (left == right) return 1;
        if (left.Length == 0 || right.Length == 0) return 0;
        var previous = Enumerable.Range(0, right.Length + 1).ToArray();
        var current = new int[right.Length + 1];
        for (var i = 1; i <= left.Length; i++)
        {
            current[0] = i;
            for (var j = 1; j <= right.Length; j++)
                current[j] = Math.Min(Math.Min(current[j - 1] + 1, previous[j] + 1), previous[j - 1] + (left[i - 1] == right[j - 1] ? 0 : 1));
            (previous, current) = (current, previous);
        }
        return 1d - previous[right.Length] / (double)Math.Max(left.Length, right.Length);
    }

    private static string CreateTemporaryDirectory(string category)
    {
        var path = Path.Combine(Path.GetTempPath(), "rune-comparison", category + "-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(path);
        return path;
    }

    private static void DeleteDirectoryBestEffort(string path) { try { if (Directory.Exists(path)) Directory.Delete(path, true); } catch { } }
    private static string SafeDiagnostic(string value) => Regex.Replace(value, "[\\r\\n]+", " ", RegexOptions.CultureInvariant).Trim()[..Math.Min(160, Regex.Replace(value, "[\\r\\n]+", " ", RegexOptions.CultureInvariant).Trim().Length)];
    private static string ExtensionFor(string contentType) => contentType switch { "application/pdf" => ".pdf", "image/png" => ".png", "image/jpeg" => ".jpg", "image/svg+xml" => ".svg", _ => ".bin" };

    private static byte[] Decode(ArtifactComparisonInput input)
    {
        if (string.IsNullOrWhiteSpace(input.Name) || input.Name.Length > 240)
            throw new ArgumentException("Artifact names must contain between 1 and 240 characters.");
        byte[] bytes;
        try { bytes = Convert.FromBase64String(input.ContentBase64); }
        catch (FormatException exception) { throw new ArgumentException($"Artifact {input.Name} is not valid base64.", exception); }
        if (bytes.LongLength > MaximumArtifactBytes)
            throw new ArgumentException($"Artifact {input.Name} exceeds {MaximumArtifactBytes} bytes.");
        return bytes;
    }

    private static ArtifactDescriptor Describe(ArtifactComparisonInput input, byte[] bytes, bool normalizeText)
    {
        var contentType = NormalizeContentType(input.ContentType, input.Name, bytes);
        var digest = Convert.ToHexString(SHA256.HashData(bytes));
        var (width, height) = ImageDimensions(bytes, contentType);
        var pageCount = contentType.Equals("application/pdf", StringComparison.OrdinalIgnoreCase) ? CountPdfPages(bytes) : null;
        string? normalizedDigest = null;
        if (normalizeText && IsText(contentType, input.Name))
        {
            var normalized = NormalizeText(bytes, contentType);
            normalizedDigest = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(normalized)));
        }
        return new ArtifactDescriptor(input.Name, contentType, bytes.LongLength, digest, width, height, pageCount, normalizedDigest);
    }

    private static string NormalizeContentType(string? contentType, string name, byte[] bytes)
    {
        if (!string.IsNullOrWhiteSpace(contentType)) return contentType.Split(';', 2)[0].Trim().ToLowerInvariant();
        var extension = Path.GetExtension(name).ToLowerInvariant();
        return extension switch
        {
            ".html" or ".htm" => "text/html",
            ".json" => "application/json",
            ".svg" => "image/svg+xml",
            ".txt" or ".md" => "text/plain",
            ".pdf" => "application/pdf",
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            _ when bytes.AsSpan().StartsWith("%PDF"u8) => "application/pdf",
            _ when bytes.AsSpan().StartsWith(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }) => "image/png",
            _ => "application/octet-stream"
        };
    }

    private static bool IsText(string contentType, string name) =>
        contentType.StartsWith("text/", StringComparison.OrdinalIgnoreCase) ||
        contentType is "application/json" or "image/svg+xml" or "application/vnd.rune.document+json" ||
        Path.GetExtension(name).Equals(".md", StringComparison.OrdinalIgnoreCase);

    private static string NormalizeText(byte[] bytes, string contentType)
    {
        var value = Encoding.UTF8.GetString(bytes).Replace("\r\n", "\n", StringComparison.Ordinal).Replace('\r', '\n').Trim();
        if (contentType.Contains("json", StringComparison.OrdinalIgnoreCase))
        {
            try { using var document = JsonDocument.Parse(value); return CanonicalJson(document.RootElement); }
            catch (JsonException) { }
        }
        if (contentType is "text/html" or "image/svg+xml") value = BetweenTagsWhitespaceRegex().Replace(value, "><");
        return TrailingWhitespaceRegex().Replace(value, string.Empty);
    }

    private static string CanonicalJson(JsonElement element) => element.ValueKind switch
    {
        JsonValueKind.Object => "{" + string.Join(',', element.EnumerateObject().OrderBy(item => item.Name, StringComparer.Ordinal)
            .Select(item => JsonSerializer.Serialize(item.Name) + ":" + CanonicalJson(item.Value))) + "}",
        JsonValueKind.Array => "[" + string.Join(',', element.EnumerateArray().Select(CanonicalJson)) + "]",
        _ => element.GetRawText()
    };

    private static IReadOnlyList<ArtifactDifferenceRange> DifferenceRanges(byte[] left, byte[] right, int maximum)
    {
        if (maximum == 0) return [];
        var result = new List<ArtifactDifferenceRange>();
        var length = Math.Max(left.Length, right.Length);
        var start = -1;
        for (var index = 0; index < length; index++)
        {
            var differs = index >= left.Length || index >= right.Length || left[index] != right[index];
            if (differs && start < 0) start = index;
            if ((!differs || index == length - 1) && start >= 0)
            {
                var end = differs && index == length - 1 ? index + 1 : index;
                result.Add(new ArtifactDifferenceRange(start, end - start));
                start = -1;
                if (result.Count >= maximum) break;
            }
        }
        return result;
    }

    private static (int? Width, int? Height) ImageDimensions(byte[] bytes, string contentType)
    {
        if (contentType == "image/png" && bytes.Length >= 24) return (ReadBigEndianInt32(bytes, 16), ReadBigEndianInt32(bytes, 20));
        if (contentType == "image/jpeg") return JpegDimensions(bytes);
        return (null, null);
    }
    private static int ReadBigEndianInt32(byte[] bytes, int offset) => (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
    private static (int?, int?) JpegDimensions(byte[] bytes)
    {
        var index = 2;
        while (index + 8 < bytes.Length)
        {
            if (bytes[index] != 0xFF) { index++; continue; }
            var marker = bytes[index + 1];
            if (marker is >= 0xC0 and <= 0xC3 or >= 0xC5 and <= 0xC7 or >= 0xC9 and <= 0xCB or >= 0xCD and <= 0xCF)
                return ((bytes[index + 7] << 8) | bytes[index + 8], (bytes[index + 5] << 8) | bytes[index + 6]);
            if (index + 3 >= bytes.Length) break;
            var segmentLength = (bytes[index + 2] << 8) | bytes[index + 3];
            if (segmentLength < 2) break;
            index += 2 + segmentLength;
        }
        return (null, null);
    }
    private static int? CountPdfPages(byte[] bytes)
    {
        var count = PdfPageRegex().Matches(Encoding.Latin1.GetString(bytes)).Count;
        return count == 0 ? null : count;
    }

    private sealed record ProcessResult(int ExitCode, string StandardOutput, string StandardError);
    [GeneratedRegex(@"(?m)[ \t]+$", RegexOptions.CultureInvariant)] private static partial Regex TrailingWhitespaceRegex();
    [GeneratedRegex(@">\s+<", RegexOptions.CultureInvariant)] private static partial Regex BetweenTagsWhitespaceRegex();
    [GeneratedRegex(@"/Type\s*/Page(?!s)\b", RegexOptions.CultureInvariant)] private static partial Regex PdfPageRegex();
    [GeneratedRegex(@"(?s)(?:/CreationDate|/ModDate|/Producer|/Creator)\s*(?:\([^)]*\)|<[^>]*>)|/ID\s*\[[^\]]*\]", RegexOptions.CultureInvariant)] private static partial Regex PdfVolatileMetadataRegex();
    [GeneratedRegex(@"(?s)(?:\d+)\s+(?:\d+)\s+obj(?<body>.*?)endobj", RegexOptions.CultureInvariant)] private static partial Regex PdfObjectRegex();
    [GeneratedRegex(@"\b\d+\s+\d+\s+R\b", RegexOptions.CultureInvariant)] private static partial Regex PdfReferenceRegex();
    [GeneratedRegex(@"/Length\s+\d+", RegexOptions.CultureInvariant)] private static partial Regex PdfStreamLengthRegex();
    [GeneratedRegex(@"\s+", RegexOptions.CultureInvariant)] private static partial Regex PdfWhitespaceRegex();
}
