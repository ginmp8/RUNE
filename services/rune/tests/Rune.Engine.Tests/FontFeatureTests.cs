using System.Diagnostics;
using System.Security.Cryptography;
using Rune.Application;
using Rune.Core;

namespace Rune.Engine.Tests;

public sealed class FontFeatureTests
{
    [Fact]
    public void Compiles_resource_bound_font_faces_and_default_family_deterministically()
    {
        var bytes = new byte[] { 0x77, 0x4F, 0x46, 0x32, 1, 2, 3, 4 };
        var digest = Convert.ToHexString(SHA256.HashData(bytes));
        var options = new FontOptions(
            [new FontFaceDescriptor("Acme Sans", "fonts/acme.woff2", 400, Sha256: digest)],
            "Acme Sans", ["RUNE Noto Sans"]);
        var resources = new[] { new FontResourceContent("fonts/acme.woff2", "font/woff2", bytes) };
        var first = FontCssCompiler.Compile(options, resources);
        var second = FontCssCompiler.Compile(options, resources);
        Assert.Equal(first.Css, second.Css);
        Assert.Equal(first.Digests, second.Digests);
        Assert.Contains("@font-face", first.Css);
        Assert.Contains("data:font/woff2;base64", first.Css);
        Assert.Contains("font-family:\"Acme Sans\"", first.Css);
        Assert.Contains(digest, first.Css);
    }

    [Fact]
    public void Rejects_missing_resources_digest_mismatch_and_duplicate_faces()
    {
        var resource = new FontResourceContent("font.woff2", "font/woff2", [0x77, 0x4F, 0x46, 0x32]);
        Assert.Throws<ArgumentException>(() => FontCssCompiler.Compile(
            new FontOptions([new FontFaceDescriptor("Missing", "missing.woff2")]), [resource]));
        Assert.Throws<ArgumentException>(() => FontCssCompiler.Compile(
            new FontOptions([new FontFaceDescriptor("Acme", "font.woff2", Sha256: "00")]), [resource]));
        Assert.Throws<ArgumentException>(() => FontCssCompiler.Compile(
            new FontOptions([
                new FontFaceDescriptor("Acme", "font.woff2"),
                new FontFaceDescriptor("Acme", "font.woff2")]), [resource]));
    }

    [Fact]
    public void Rejects_unapproved_font_media_types_and_invalid_descriptors()
    {
        var resource = new FontResourceContent("font.bin", "application/octet-stream", [1, 2, 3, 4]);
        Assert.Throws<ArgumentException>(() => FontCssCompiler.Compile(
            new FontOptions([new FontFaceDescriptor("Acme", "font.bin")]), [resource]));
        Assert.Throws<ArgumentException>(() => FontCssCompiler.Compile(
            new FontOptions([new FontFaceDescriptor("Acme", "font.bin", 450)]), [resource with { ContentType = "font/woff2" }]));
    }

    [Fact]
    public void Enforces_font_license_metadata_and_embedding_policy()
    {
        var bytes = BuildMinimalSfntFormat12(0x41, 0x5A);
        var resource = new FontResourceContent("font.ttf", "font/ttf", bytes);
        Assert.Throws<ArgumentException>(() => FontCssCompiler.Compile(
            new FontOptions([new FontFaceDescriptor("Acme", "font.ttf")], LicensePolicy: FontLicensePolicyMode.RequireMetadata), [resource]));
        Assert.Throws<ArgumentException>(() => FontCssCompiler.Compile(
            new FontOptions([new FontFaceDescriptor("Acme", "font.ttf", LicenseSpdx: "Proprietary", LicenseAllowsEmbedding: false)]), [resource]));
        Assert.Throws<ArgumentException>(() => FontCssCompiler.Compile(
            new FontOptions([new FontFaceDescriptor("Acme", "font.ttf", LicenseSpdx: "GPL-3.0")], DeniedLicenses: ["GPL-3.0"]), [resource]));
        var allowed = FontCssCompiler.Compile(
            new FontOptions([new FontFaceDescriptor("Acme", "font.ttf", LicenseSpdx: "OFL-1.1", LicenseAllowsEmbedding: true)],
                LicensePolicy: FontLicensePolicyMode.RequireMetadata, AllowedLicenses: ["OFL-1.1"]), [resource]);
        Assert.Contains("@font-face", allowed.Css);
    }

    [Fact]
    public void Analyzes_glyphs_and_emits_deterministic_auto_subset_unicode_range()
    {
        var bytes = BuildMinimalSfntFormat12(0x41, 0x5A);
        var resource = new FontResourceContent("font.ttf", "font/ttf", bytes);
        var result = FontCssCompiler.Compile(
            new FontOptions([new FontFaceDescriptor("Acme", "font.ttf", LicenseSpdx: "OFL-1.1")],
                SubsetPolicy: "auto", AnalyzeGlyphCoverage: true, RequiredCharacters: "ABCZ"), [resource]);
        var analysis = Assert.Single(result.GlyphAnalyses!);
        Assert.True(analysis.Supported);
        Assert.Empty(analysis.MissingCodePoints);
        Assert.Contains("unicode-range:U+41-43,U+5A", result.Css);
        Assert.Throws<ArgumentException>(() => FontCssCompiler.Compile(
            new FontOptions([new FontFaceDescriptor("Acme", "font.ttf")], MissingGlyphPolicy: "fail",
                AnalyzeGlyphCoverage: true, RequiredCharacters: "Aé"), [resource]));
    }

    private static byte[] BuildMinimalSfntFormat12(uint start, uint end)
    {
        const int cmapOffset = 28;
        const int cmapLength = 40;
        var bytes = new byte[cmapOffset + cmapLength];
        WriteU32(bytes, 0, 0x00010000);
        WriteU16(bytes, 4, 1);
        System.Text.Encoding.ASCII.GetBytes("cmap").CopyTo(bytes, 12);
        WriteU32(bytes, 20, cmapOffset);
        WriteU32(bytes, 24, cmapLength);
        WriteU16(bytes, cmapOffset, 0);
        WriteU16(bytes, cmapOffset + 2, 1);
        WriteU16(bytes, cmapOffset + 4, 3);
        WriteU16(bytes, cmapOffset + 6, 10);
        WriteU32(bytes, cmapOffset + 8, 12);
        var sub = cmapOffset + 12;
        WriteU16(bytes, sub, 12);
        WriteU16(bytes, sub + 2, 0);
        WriteU32(bytes, sub + 4, 28);
        WriteU32(bytes, sub + 8, 0);
        WriteU32(bytes, sub + 12, 1);
        WriteU32(bytes, sub + 16, start);
        WriteU32(bytes, sub + 20, end);
        WriteU32(bytes, sub + 24, 1);
        return bytes;
    }

    private static void WriteU16(byte[] bytes, int offset, ushort value)
    {
        bytes[offset] = (byte)(value >> 8);
        bytes[offset + 1] = (byte)value;
    }

    private static void WriteU32(byte[] bytes, int offset, uint value)
    {
        bytes[offset] = (byte)(value >> 24);
        bytes[offset + 1] = (byte)(value >> 16);
        bytes[offset + 2] = (byte)(value >> 8);
        bytes[offset + 3] = (byte)value;
    }

    [Fact]
    public void Introspects_sanitizes_and_physically_subsets_woff2_with_cache_reuse()
    {
        var sourceFont = new[] {
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf"
        }.FirstOrDefault(File.Exists) ?? throw new FileNotFoundException("A system test font is required.");
        var root = Path.Combine(Path.GetTempPath(), "rune-font-tool-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        try
        {
            var script = FindFontTool();
            var python = File.Exists("/opt/pyvenv/bin/python") ? "/opt/pyvenv/bin/python" : "/usr/bin/python3";
            var woff2 = Path.Combine(root, "source.woff2");
            using (var process = Process.Start(new ProcessStartInfo(python)
            {
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                ArgumentList = { script, "sanitize", "--input", sourceFont, "--output", woff2, "--flavor", "woff2" }
            })!)
            {
                process.WaitForExit(60_000);
                Assert.True(process.ExitCode == 0, process.StandardError.ReadToEnd());
            }
            Environment.SetEnvironmentVariable("RUNE_FONT_TOOL_PATH", script);
            Environment.SetEnvironmentVariable("RUNE_FONT_TOOL_PYTHON", python);
            Environment.SetEnvironmentVariable("RUNE_FONT_CACHE_ROOT", Path.Combine(root, "cache"));
            var bytes = File.ReadAllBytes(woff2);
            var options = new FontOptions(
                [new FontFaceDescriptor("RUNE Test", "source.woff2", LicenseSpdx: "OFL-1.1")],
                SubsetPolicy: "auto", AnalyzeGlyphCoverage: true, RequiredCharacters: "RUNE 013",
                PhysicalSubset: new PhysicalFontSubsetOptions(FontPhysicalSubsetMode.Required, BlockCurrentRequest: true,
                    MinimumFontSizeBytes: 0, MaximumUsedGlyphRatio: 1, MinimumEstimatedSavingBytes: 0),
                Sanitization: new FontSanitizationOptions());
            var first = FontCssCompiler.Compile(options, [new FontResourceContent("source.woff2", "font/woff2", bytes)]);
            var firstStatus = Assert.Single(first.PhysicalSubsets!);
            Assert.Equal("generated", firstStatus.Status);
            Assert.True(firstStatus.Sanitized);
            Assert.True(firstStatus.SelectedBytes < firstStatus.OriginalBytes);
            var analysis = Assert.Single(first.GlyphAnalyses!);
            Assert.True(analysis.Supported);
            Assert.Empty(analysis.MissingCodePoints);
            var second = FontCssCompiler.Compile(options, [new FontResourceContent("source.woff2", "font/woff2", bytes)]);
            Assert.Equal("cache-hit", Assert.Single(second.PhysicalSubsets!).Status);
            Assert.Equal(first.Css, second.Css);

            var bounded = options with
            {
                Faces =
                [
                    new FontFaceDescriptor("RUNE Test", "source.woff2", LicenseSpdx: "OFL-1.1"),
                    new FontFaceDescriptor("RUNE Test Alternate", "source.woff2", LicenseSpdx: "OFL-1.1")
                ],
                PhysicalSubset = options.PhysicalSubset! with { MaximumFontsPerDocument = 1 }
            };
            var boundedResult = FontCssCompiler.Compile(bounded, [new FontResourceContent("source.woff2", "font/woff2", bytes)]);
            Assert.Equal("cache-hit", boundedResult.PhysicalSubsets![0].Status);
            Assert.Equal("skipped-font-limit", boundedResult.PhysicalSubsets[1].Status);
        }
        finally
        {
            Environment.SetEnvironmentVariable("RUNE_FONT_TOOL_PATH", null);
            Environment.SetEnvironmentVariable("RUNE_FONT_TOOL_PYTHON", null);
            Environment.SetEnvironmentVariable("RUNE_FONT_CACHE_ROOT", null);
            if (Directory.Exists(root)) Directory.Delete(root, true);
        }
    }

    private static string FindFontTool()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, "services", "rune", "apps", "rune-api", "tools", "rune_font_tool.py");
            if (File.Exists(candidate)) return candidate;
            current = current.Parent;
        }
        throw new FileNotFoundException("rune_font_tool.py");
    }

}
