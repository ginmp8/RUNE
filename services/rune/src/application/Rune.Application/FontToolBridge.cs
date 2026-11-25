using System.Diagnostics;
using System.Security.Cryptography;
using System.Text.Json;
using Rune.Core;

namespace Rune.Application;

internal sealed record FontToolProcessResult(
    byte[] SelectedContent,
    FontGlyphAnalysis? Analysis,
    FontPhysicalSubsetResult Status);

public sealed record FontPhysicalSubsetResult(
    string ResourcePath,
    string Status,
    bool RenderBlocked,
    bool GenerationScheduled,
    bool Sanitized,
    int OriginalBytes,
    int SelectedBytes,
    string? CacheKey = null,
    string? Diagnostic = null);

internal static class FontToolBridge
{
    public static FontToolProcessResult Process(
        FontFaceDescriptor face,
        FontResourceContent resource,
        FontOptions options,
        IReadOnlyList<int> requiredCodePoints,
        bool physicalSubsetAllowed = true)
    {
        var physical = options.PhysicalSubset;
        var sanitation = options.Sanitization;
        var needsTool = sanitation?.Enabled == true || physical is not null || ((resource.ContentType is "font/woff" or "font/woff2") && (options.AnalyzeGlyphCoverage || requiredCodePoints.Count > 0 || options.SubsetPolicy.Equals("auto", StringComparison.OrdinalIgnoreCase)));
        if (!needsTool)
            return new FontToolProcessResult(resource.Content, null,
                new FontPhysicalSubsetResult(face.ResourcePath, "not-requested", false, false, false, resource.Content.Length, resource.Content.Length));

        var python = FindPython();
        var script = FindScript();
        if (python is null || script is null)
        {
            if (sanitation is { Enabled: true, RequireSuccess: true } || physical?.Mode == FontPhysicalSubsetMode.Required)
                throw new ArgumentException($"Font processing tool is unavailable for {face.ResourcePath}.");
            return new FontToolProcessResult(resource.Content, null,
                new FontPhysicalSubsetResult(face.ResourcePath, "tool-unavailable", false, false, false, resource.Content.Length, resource.Content.Length));
        }

        var digest = Convert.ToHexString(SHA256.HashData(resource.Content));
        var extension = Extension(resource.ContentType);
        var cacheRoot = Environment.GetEnvironmentVariable("RUNE_FONT_CACHE_ROOT") ?? Path.Combine(Path.GetTempPath(), "rune-font-cache");
        var validationVersion = sanitation?.ValidatorVersion ?? "fonttools-v1";
        var policyVersion = sanitation?.PolicyVersion ?? "1";
        var validationKey = $"{digest}-{SafeToken(validationVersion)}-{SafeToken(policyVersion)}";
        var validationDirectory = Path.Combine(cacheRoot, "validation", validationKey);
        Directory.CreateDirectory(validationDirectory);
        var sourcePath = Path.Combine(validationDirectory, "source." + extension);
        var sanitizedPath = Path.Combine(validationDirectory, "sanitized." + extension);
        var metadataPath = Path.Combine(validationDirectory, "metadata.json");
        if (!File.Exists(sourcePath)) AtomicWrite(sourcePath, resource.Content);

        FontToolMetadata metadata;
        var selected = resource.Content;
        var sanitized = false;
        try
        {
            if (sanitation?.Enabled == true)
            {
                if (!File.Exists(sanitizedPath) || !File.Exists(metadataPath))
                {
                    var temporarySanitized = sanitizedPath + "." + Guid.NewGuid().ToString("N") + ".tmp";
                    try
                    {
                        var result = Run(python, script, "sanitize", sourcePath, temporarySanitized, extension, null, sanitation.TimeoutSeconds);
                        File.Move(temporarySanitized, sanitizedPath, true);
                        AtomicWrite(metadataPath, System.Text.Encoding.UTF8.GetBytes(result));
                    }
                    finally { try { if (File.Exists(temporarySanitized)) File.Delete(temporarySanitized); } catch { } }
                }
                metadata = JsonSerializer.Deserialize<FontToolMetadata>(File.ReadAllText(metadataPath), JsonOptions())
                    ?? throw new InvalidDataException("Font sanitizer returned no metadata.");
                selected = File.ReadAllBytes(sanitizedPath);
                sanitized = true;
            }
            else
            {
                var result = Run(python, script, "inspect", sourcePath, null, extension, null, 20);
                metadata = JsonSerializer.Deserialize<FontToolMetadata>(result, JsonOptions())
                    ?? throw new InvalidDataException("Font introspector returned no metadata.");
            }
        }
        catch (Exception exception) when (exception is IOException or InvalidDataException or InvalidOperationException or TimeoutException or JsonException)
        {
            if (sanitation is { Enabled: true, RequireSuccess: true } || physical?.Mode == FontPhysicalSubsetMode.Required)
                throw new ArgumentException($"Font sanitization or introspection failed for {face.ResourcePath}: {exception.Message}", exception);
            return new FontToolProcessResult(resource.Content, null,
                new FontPhysicalSubsetResult(face.ResourcePath, "validation-failed", false, false, false, resource.Content.Length, resource.Content.Length, Diagnostic: exception.Message));
        }

        var mapped = metadata.CodePoints?.ToHashSet() ?? [];
        var missing = requiredCodePoints.Where(value => !mapped.Contains(value)).ToArray();
        var analysis = new FontGlyphAnalysis(face.ResourcePath, metadata.Supported, metadata.MappedCodePoints, missing);
        if (!options.SubsetPolicy.Equals("auto", StringComparison.OrdinalIgnoreCase) || physical is null || physical.Mode == FontPhysicalSubsetMode.Disabled || requiredCodePoints.Count == 0)
            return new FontToolProcessResult(selected, analysis,
                new FontPhysicalSubsetResult(face.ResourcePath, sanitized ? "sanitized" : "introspected", false, false, sanitized, resource.Content.Length, selected.Length));
        if (!physicalSubsetAllowed)
            return new FontToolProcessResult(selected, analysis,
                new FontPhysicalSubsetResult(face.ResourcePath, "skipped-font-limit", false, false, sanitized, resource.Content.Length, selected.Length));

        ValidatePhysicalPolicy(physical);
        var decisionStarted = Stopwatch.GetTimestamp();
        var glyphHash = Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(string.Join(',', requiredCodePoints.Order()))));
        var optionsHash = Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes($"{physical.MaximumUsedGlyphRatio}|{physical.MinimumEstimatedSavingBytes}")))[..16];
        var cacheKey = $"{digest}-{glyphHash}-{extension}-{SafeToken(physical.SubsetterVersion)}-{optionsHash}";
        var subsetDirectory = Path.Combine(cacheRoot, "subsets", cacheKey);
        var subsetPath = Path.Combine(subsetDirectory, "subset." + extension);
        if (File.Exists(subsetPath))
        {
            var subsetBytes = File.ReadAllBytes(subsetPath);
            if (subsetBytes.Length >= 4)
                return new FontToolProcessResult(subsetBytes, analysis,
                    new FontPhysicalSubsetResult(face.ResourcePath, "cache-hit", false, false, sanitized, resource.Content.Length, subsetBytes.Length, cacheKey));
            try { File.Delete(subsetPath); } catch { }
        }
        if (Stopwatch.GetElapsedTime(decisionStarted).TotalMilliseconds > physical.DecisionBudgetMilliseconds)
            return new FontToolProcessResult(selected, analysis,
                new FontPhysicalSubsetResult(face.ResourcePath, "skipped-budget-exceeded", false, false, sanitized, resource.Content.Length, selected.Length, cacheKey));

        var usedRatio = metadata.MappedCodePoints == 0 ? 1 : requiredCodePoints.Count / (double)metadata.MappedCodePoints;
        var estimatedSaving = (int)Math.Max(0, selected.Length * (1 - Math.Min(1, usedRatio)));
        var eligible = selected.Length >= physical.MinimumFontSizeBytes && usedRatio <= physical.MaximumUsedGlyphRatio && estimatedSaving >= physical.MinimumEstimatedSavingBytes;
        if (!eligible)
            return new FontToolProcessResult(selected, analysis,
                new FontPhysicalSubsetResult(face.ResourcePath, "skipped-not-beneficial", false, false, sanitized, resource.Content.Length, selected.Length, cacheKey));

        void Generate()
        {
            Directory.CreateDirectory(subsetDirectory);
            var temporary = subsetPath + "." + Guid.NewGuid().ToString("N") + ".tmp";
            try
            {
                _ = Run(python, script, "subset", sanitized ? sanitizedPath : sourcePath, temporary, extension, requiredCodePoints, 120);
                File.Move(temporary, subsetPath, true);
            }
            finally { try { if (File.Exists(temporary)) File.Delete(temporary); } catch { } }
        }

        if (physical.BlockCurrentRequest || physical.Mode == FontPhysicalSubsetMode.Required)
        {
            Generate();
            var subsetBytes = File.ReadAllBytes(subsetPath);
            return new FontToolProcessResult(subsetBytes, analysis,
                new FontPhysicalSubsetResult(face.ResourcePath, "generated", true, false, sanitized, resource.Content.Length, subsetBytes.Length, cacheKey));
        }
        _ = Task.Run(() => { try { Generate(); } catch { } });
        return new FontToolProcessResult(selected, analysis,
            new FontPhysicalSubsetResult(face.ResourcePath, "cache-miss", false, true, sanitized, resource.Content.Length, selected.Length, cacheKey));
    }

    private static void ValidatePhysicalPolicy(PhysicalFontSubsetOptions options)
    {
        if (options.MinimumFontSizeBytes < 0 || options.MinimumEstimatedSavingBytes < 0 || options.MaximumFontsPerDocument is < 1 or > 100 ||
            options.MaximumUsedGlyphRatio is < 0 or > 1 || options.DecisionBudgetMilliseconds is < 1 or > 1000)
            throw new ArgumentException("Physical font subset policy contains invalid limits.");
    }

    private static string Run(string python, string script, string command, string input, string? output, string flavor, IReadOnlyList<int>? codePoints, int timeoutSeconds)
    {
        using var process = new Process { StartInfo = new ProcessStartInfo(python) { RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false, CreateNoWindow = true } };
        process.StartInfo.ArgumentList.Add(script); process.StartInfo.ArgumentList.Add(command);
        process.StartInfo.ArgumentList.Add("--input"); process.StartInfo.ArgumentList.Add(input);
        process.StartInfo.ArgumentList.Add("--flavor"); process.StartInfo.ArgumentList.Add(flavor);
        if (output is not null) { process.StartInfo.ArgumentList.Add("--output"); process.StartInfo.ArgumentList.Add(output); }
        if (codePoints is not null) { process.StartInfo.ArgumentList.Add("--unicodes"); process.StartInfo.ArgumentList.Add(string.Join(',', codePoints.Select(value => value.ToString("X")))); }
        if (!process.Start()) throw new InvalidOperationException("Could not start the font processing tool.");
        var stdout = process.StandardOutput.ReadToEndAsync(); var stderr = process.StandardError.ReadToEndAsync();
        if (!process.WaitForExit(timeoutSeconds * 1000)) { try { process.Kill(true); } catch { } throw new TimeoutException("Font processing exceeded its timeout."); }
        var outputText = stdout.GetAwaiter().GetResult(); var errorText = stderr.GetAwaiter().GetResult();
        if (process.ExitCode != 0) throw new InvalidDataException(errorText.Trim());
        return outputText;
    }

    private static string? FindPython()
    {
        var configured = Environment.GetEnvironmentVariable("RUNE_FONT_TOOL_PYTHON");
        if (!string.IsNullOrWhiteSpace(configured) && File.Exists(configured)) return configured;
        foreach (var path in new[] { "/opt/pyvenv/bin/python", "/usr/bin/python3" }) if (File.Exists(path)) return path;
        return null;
    }
    private static string? FindScript()
    {
        var configured = Environment.GetEnvironmentVariable("RUNE_FONT_TOOL_PATH");
        if (!string.IsNullOrWhiteSpace(configured) && File.Exists(configured)) return configured;
        var output = Path.Combine(AppContext.BaseDirectory, "tools", "rune_font_tool.py");
        if (File.Exists(output)) return output;
        var current = Path.GetFullPath(Path.Combine(Environment.CurrentDirectory, "services/rune/apps/rune-api/tools/rune_font_tool.py"));
        return File.Exists(current) ? current : null;
    }
    private static string Extension(string contentType) => contentType switch { "font/woff2" => "woff2", "font/woff" => "woff", "font/otf" => "otf", _ => "ttf" };
    private static string SafeToken(string value) => string.Concat(value.Where(character => char.IsAsciiLetterOrDigit(character) || character is '-' or '_'))[..Math.Min(40, string.Concat(value.Where(character => char.IsAsciiLetterOrDigit(character) || character is '-' or '_')).Length)];
    private static void AtomicWrite(string path, byte[] content)
    {
        var temp = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try { File.WriteAllBytes(temp, content); File.Move(temp, path, true); }
        finally { try { if (File.Exists(temp)) File.Delete(temp); } catch { } }
    }
    private static JsonSerializerOptions JsonOptions() => new(JsonSerializerDefaults.Web) { PropertyNameCaseInsensitive = true };
    private sealed record FontToolMetadata(bool Supported, int MappedCodePoints, IReadOnlyList<int>? CodePoints, int GlyphCount, IReadOnlyList<string>? Tables);
}
