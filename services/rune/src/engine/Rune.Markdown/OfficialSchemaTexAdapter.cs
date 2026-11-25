using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Rune.Core;

namespace Rune.Markdown;

public sealed record SchemaTexRenderOutput(
    string Svg,
    string? Type,
    IReadOnlyList<RenderDiagnostic> Diagnostics,
    string PackageVersion,
    string PackageDigest);

public sealed class OfficialSchemaTexAdapter(string assetRoot, string nodeExecutable = "node")
{
    public const string PackageVersion = "1.0.1";
    public const string PackageTarballSha256 = "51dff885f6db79425c15c1ce56646178c996a5de308391a7c1ebc8f3645b4d9f";
    private readonly string _packageEntry = Path.Combine(assetRoot, "vendor", "schematex", "package", "dist", "index.js");
    private readonly string _bridge = Path.Combine(assetRoot, "vendor", "schematex", "render.mjs");

    public SchemaTexRenderOutput Render(string source, TimeSpan? timeout = null)
    {
        if (string.IsNullOrWhiteSpace(source)) throw new ArgumentException("SchemaTex source is required.", nameof(source));
        if (!File.Exists(_packageEntry) || !File.Exists(_bridge))
            throw new InvalidOperationException("Official SchemaTex 1.0.1 assets are unavailable.");
        using var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = nodeExecutable,
                UseShellExecute = false,
                RedirectStandardInput = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true
            }
        };
        process.StartInfo.ArgumentList.Add(_bridge);
        process.StartInfo.ArgumentList.Add(_packageEntry);
        process.StartInfo.Environment["NO_PROXY"] = "*";
        process.StartInfo.Environment["HTTP_PROXY"] = string.Empty;
        process.StartInfo.Environment["HTTPS_PROXY"] = string.Empty;
        process.Start();
        process.StandardInput.Write(JsonSerializer.Serialize(new { source }));
        process.StandardInput.Close();
        var outputTask = process.StandardOutput.ReadToEndAsync();
        var errorTask = process.StandardError.ReadToEndAsync();
        var limit = timeout ?? TimeSpan.FromSeconds(20);
        if (!process.WaitForExit((int)limit.TotalMilliseconds))
        {
            try { process.Kill(entireProcessTree: true); } catch { }
            throw new TimeoutException("Official SchemaTex render timed out.");
        }
        var output = outputTask.GetAwaiter().GetResult();
        var error = errorTask.GetAwaiter().GetResult();
        if (process.ExitCode != 0) throw new ArgumentException("SchemaTex render failed: " + Safe(error));
        using var document = JsonDocument.Parse(output);
        var root = document.RootElement;
        if (!root.TryGetProperty("ok", out var ok) || !ok.GetBoolean())
        {
            var message = root.TryGetProperty("diagnostics", out var diagnostics)
                ? string.Join("; ", diagnostics.EnumerateArray().Select(item => item.TryGetProperty("message", out var value) ? value.GetString() : item.GetRawText()))
                : "invalid SchemaTex DSL";
            throw new ArgumentException("SchemaTex render failed: " + Safe(message));
        }
        var svg = SanitizeSvg(root.GetProperty("svg").GetString() ?? throw new ArgumentException("SchemaTex returned no SVG."));
        var type = root.TryGetProperty("type", out var typeNode) ? typeNode.GetString() : null;
        var resultDiagnostics = new List<RenderDiagnostic>
        {
            new("schematex.official-package", $"Rendered with official schematex {PackageVersion} renderResult API ({PackageTarballSha256}).", RenderDiagnosticSeverity.Info)
        };
        if (root.TryGetProperty("diagnostics", out var upstream) && upstream.ValueKind == JsonValueKind.Array)
            foreach (var item in upstream.EnumerateArray())
                resultDiagnostics.Add(new RenderDiagnostic(
                    "schematex." + (item.TryGetProperty("code", out var code) ? code.GetString() : "diagnostic"),
                    item.TryGetProperty("message", out var message) ? message.GetString() ?? "SchemaTex diagnostic" : "SchemaTex diagnostic",
                    item.TryGetProperty("severity", out var severity) && severity.GetString()?.Equals("error", StringComparison.OrdinalIgnoreCase) == true
                        ? RenderDiagnosticSeverity.Error : RenderDiagnosticSeverity.Warning));
        return new SchemaTexRenderOutput(svg, type, resultDiagnostics, PackageVersion, PackageTarballSha256);
    }

    private static string SanitizeSvg(string svg)
    {
        if (!Regex.IsMatch(svg, @"^\s*<svg\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant))
            throw new ArgumentException("SchemaTex output is not an SVG document.");
        svg = Regex.Replace(svg, @"<\s*(script|foreignObject|iframe|object|embed)\b[\s\S]*?<\s*/\s*\1\s*>", string.Empty, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
        svg = Regex.Replace(svg, "\\s+on[a-z]+\\s*=\\s*(['\"]).*?\\1", string.Empty, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
        svg = Regex.Replace(svg, "(href|xlink:href)\\s*=\\s*(['\"])\\s*(?:javascript:|https?:|file:)[^'\"]*\\2", "$1=\"#\"", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
        if (Encoding.UTF8.GetByteCount(svg) > 10_000_000) throw new ArgumentException("SchemaTex SVG exceeds the maximum size.");
        return svg;
    }

    private static string Safe(string? value) => Regex.Replace(value ?? string.Empty, @"[\r\n\t]+", " ").Trim()[..Math.Min(500, Regex.Replace(value ?? string.Empty, @"[\r\n\t]+", " ").Trim().Length)];
}
