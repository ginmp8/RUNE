using System.Diagnostics;
using System.Text;

namespace Rune.Export.Pdf;

public sealed class PdfAConverter
{
    private static readonly string[] CommonIccProfiles =
    [
        "/usr/share/color/icc/ghostscript/srgb.icc",
        "/usr/share/color/icc/sRGB.icc",
        "/usr/share/ghostscript/iccprofiles/default_rgb.icc",
        "/usr/share/ghostscript/Resource/ColorSpace/DefaultRGB.icc"
    ];

    public async ValueTask<MemoryStream> ConvertAsync(
        ReadOnlyMemory<byte> sourcePdf,
        string conformance,
        CancellationToken cancellationToken = default)
    {
        var part = conformance.Trim().ToLowerInvariant() switch
        {
            "1b" => 1,
            "2b" => 2,
            "3b" => 3,
            _ => throw new ArgumentException("Supported PDF/A conformance values are 1b, 2b, and 3b.", nameof(conformance))
        };
        var iccProfile = ResolveIccProfile();
        var root = Path.Combine(Path.GetTempPath(), $"rune-pdfa-{Guid.NewGuid():N}");
        Directory.CreateDirectory(root);
        var input = Path.Combine(root, "input.pdf");
        var definition = Path.Combine(root, "PDFA_def.ps");
        var output = Path.Combine(root, "output.pdf");
        try
        {
            await File.WriteAllBytesAsync(input, sourcePdf.ToArray(), cancellationToken);
            await File.WriteAllTextAsync(definition, BuildPdfADefinition(iccProfile), Encoding.ASCII, cancellationToken);
            var startInfo = new ProcessStartInfo
            {
                FileName = Environment.GetEnvironmentVariable("RUNE_GHOSTSCRIPT_PATH") ?? "gs",
                RedirectStandardError = true,
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            foreach (var argument in new[]
            {
                $"-dPDFA={part}", "-dBATCH", "-dNOPAUSE", "-dSAFER", $"--permit-file-read={iccProfile}", "-dNOOUTERSAVE",
                "-sDEVICE=pdfwrite", "-dPDFACompatibilityPolicy=1", "-dEmbedAllFonts=true", "-dSubsetFonts=true",
                "-sColorConversionStrategy=RGB", "-sProcessColorModel=DeviceRGB",
                $"-sOutputFile={output}", definition, input
            }) startInfo.ArgumentList.Add(argument);

            using var process = Process.Start(startInfo) ?? throw new InvalidOperationException("Ghostscript could not be started.");
            var standardOutput = process.StandardOutput.ReadToEndAsync(cancellationToken);
            var standardError = process.StandardError.ReadToEndAsync(cancellationToken);
            await process.WaitForExitAsync(cancellationToken);
            var outputText = await standardOutput;
            var error = await standardError;
            if (process.ExitCode != 0 || !File.Exists(output))
                throw new InvalidOperationException($"Ghostscript PDF/A conversion failed with exit code {process.ExitCode}: {(error + Environment.NewLine + outputText).Trim()}");
            var bytes = await File.ReadAllBytesAsync(output, cancellationToken);
            if (bytes.Length < 8 || !bytes.AsSpan(0, 5).SequenceEqual("%PDF-"u8))
                throw new InvalidDataException("Ghostscript did not produce a PDF document.");
            return new MemoryStream(bytes, writable: false);
        }
        finally
        {
            try { if (Directory.Exists(root)) Directory.Delete(root, true); }
            catch { /* Temporary cleanup is best effort. */ }
        }
    }

    private static string ResolveIccProfile()
    {
        var configured = Environment.GetEnvironmentVariable("RUNE_PDFA_ICC_PROFILE");
        if (!string.IsNullOrWhiteSpace(configured) && File.Exists(configured)) return Path.GetFullPath(configured);
        foreach (var candidate in CommonIccProfiles)
            if (File.Exists(candidate)) return candidate;
        foreach (var root in new[] { "/usr/share/color/icc", "/usr/share/ghostscript" })
        {
            if (!Directory.Exists(root)) continue;
            var candidate = Directory.EnumerateFiles(root, "*.icc", SearchOption.AllDirectories)
                .FirstOrDefault(path => Path.GetFileName(path).Contains("rgb", StringComparison.OrdinalIgnoreCase) ||
                                        Path.GetFileName(path).Contains("srgb", StringComparison.OrdinalIgnoreCase));
            if (candidate is not null) return candidate;
        }
        throw new InvalidOperationException("PDF/A conversion requires an sRGB ICC profile. Configure RUNE_PDFA_ICC_PROFILE or install icc-profiles-free.");
    }

    private static string BuildPdfADefinition(string iccProfile)
    {
        var escaped = iccProfile.Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace("(", "\\(", StringComparison.Ordinal)
            .Replace(")", "\\)", StringComparison.Ordinal);
        return $$"""
            %!
            /ICCProfile ({{escaped}}) def
            [/_objdef {icc_PDFA} /type /stream /OBJ pdfmark
            [{icc_PDFA} << /N 3 >> /PUT pdfmark
            [{icc_PDFA} ICCProfile (r) file /PUT pdfmark
            [/_objdef {OutputIntent_PDFA} /type /dict /OBJ pdfmark
            [{OutputIntent_PDFA} <<
              /Type /OutputIntent
              /S /GTS_PDFA1
              /DestOutputProfile {icc_PDFA}
              /OutputConditionIdentifier (sRGB IEC61966-2.1)
              /Info (sRGB IEC61966-2.1)
            >> /PUT pdfmark
            [{Catalog} << /OutputIntents [ {OutputIntent_PDFA} ] >> /PUT pdfmark
            """;
    }
}
