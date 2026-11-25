using System.Buffers.Binary;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Rune.Core;

namespace Rune.Application;

public sealed record FontResourceContent(string Path, string ContentType, byte[] Content);
public sealed record FontGlyphAnalysis(string ResourcePath, bool Supported, int GlyphMappedCodePoints, IReadOnlyList<int> MissingCodePoints);
public sealed record CompiledFontCss(string Css, IReadOnlyList<string> Digests, IReadOnlyList<FontGlyphAnalysis>? GlyphAnalyses = null, IReadOnlyList<FontPhysicalSubsetResult>? PhysicalSubsets = null);

public static class FontCssCompiler
{
    private const int MaximumFontBytes = 8_000_000;
    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "font/woff2", "font/woff", "font/ttf", "font/otf", "application/font-sfnt"
    };
    private static readonly HashSet<string> AllowedStyles = new(StringComparer.OrdinalIgnoreCase) { "normal", "italic", "oblique" };
    private static readonly HashSet<string> AllowedStretches = new(StringComparer.OrdinalIgnoreCase)
    {
        "normal", "condensed", "expanded", "semi-condensed", "semi-expanded"
    };

    public static CompiledFontCss Compile(FontOptions? options, IReadOnlyList<FontResourceContent> resources)
    {
        if (options is null) return new CompiledFontCss(string.Empty, [], [], []);
        ValidatePolicy(options);
        var pack = string.IsNullOrWhiteSpace(options.BuiltInFallbackPack) ? null : BuiltInFontPack.TryLoad();
        if (pack is not null && !string.Equals(options.BuiltInFallbackPack, pack.Id, StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException($"Unknown built-in fallback pack: {options.BuiltInFallbackPack}.");
        if (pack is not null && !string.IsNullOrWhiteSpace(options.BuiltInFallbackPackSha256) &&
            !string.Equals(options.BuiltInFallbackPackSha256, pack.Sha256, StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("Built-in fallback pack digest mismatch.");
        var allResources = resources.Concat(pack?.Resources ?? []).GroupBy(item => item.Path, StringComparer.OrdinalIgnoreCase).Select(group => group.First()).ToArray();
        var allFaces = options.Faces.Concat(pack?.Faces ?? []).ToArray();
        if (allFaces.Length == 0) return new CompiledFontCss(string.Empty, [], [], []);
        var byPath = allResources.ToDictionary(item => item.Path, StringComparer.OrdinalIgnoreCase);
        var descriptors = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var css = new StringBuilder();
        var digests = new List<string>();
        var analyses = new List<FontGlyphAnalysis>();
        var physicalSubsets = new List<FontPhysicalSubsetResult>();
        var requiredCodePoints = EnumerateCodePoints(options.RequiredCharacters).Distinct().Order().ToArray();
        var faceIndex = 0;
        foreach (var face in allFaces)
        {
            faceIndex++;
            ValidateFace(face, options);
            var descriptor = $"{face.Family}|{face.Weight}|{face.Style}|{face.Stretch}";
            if (!descriptors.Add(descriptor)) throw new ArgumentException($"Duplicate font face descriptor: {descriptor}.");
            if (!byPath.TryGetValue(face.ResourcePath, out var resource))
                throw new ArgumentException($"Font resource not found: {face.ResourcePath}.");
            if (!AllowedContentTypes.Contains(resource.ContentType))
                throw new ArgumentException($"Font format unsupported for {face.ResourcePath}: {resource.ContentType}.");
            if (resource.Content.Length is < 4 or > MaximumFontBytes)
                throw new ArgumentException($"Font resource {face.ResourcePath} is outside the supported size range.");
            var digest = Convert.ToHexString(SHA256.HashData(resource.Content));
            if (!string.IsNullOrWhiteSpace(face.Sha256) && !string.Equals(NormalizeDigest(face.Sha256), digest, StringComparison.OrdinalIgnoreCase))
                throw new ArgumentException($"Font digest mismatch for {face.ResourcePath}.");
            digests.Add(digest);

            FontGlyphAnalysis? analysis = null;
            var selectedContent = resource.Content;
            var physicalSubsetAllowed = options.PhysicalSubset is null || faceIndex <= options.PhysicalSubset.MaximumFontsPerDocument;
            var toolResult = FontToolBridge.Process(face, resource, options, requiredCodePoints, physicalSubsetAllowed);
            selectedContent = toolResult.SelectedContent;
            physicalSubsets.Add(toolResult.Status);
            if (options.AnalyzeGlyphCoverage || requiredCodePoints.Length > 0 || options.SubsetPolicy.Equals("auto", StringComparison.OrdinalIgnoreCase))
            {
                analysis = toolResult.Analysis ?? AnalyzeGlyphs(face.ResourcePath, resource.ContentType, resource.Content, requiredCodePoints);
                analyses.Add(analysis);
                if (analysis.MissingCodePoints.Count > 0 && options.MissingGlyphPolicy.Equals("fail", StringComparison.OrdinalIgnoreCase))
                    throw new ArgumentException($"Font {face.ResourcePath} is missing required glyphs: {string.Join(", ", analysis.MissingCodePoints.Select(value => $"U+{value:X4}"))}.");
            }

            css.Append("@font-face{font-family:").Append(CssString(face.Family))
                .Append(";src:url(data:").Append(resource.ContentType).Append(";base64,").Append(Convert.ToBase64String(selectedContent)).Append(") format(")
                .Append(CssString(FormatName(resource.ContentType))).Append(");font-weight:").Append(face.Weight.ToString(CultureInfo.InvariantCulture))
                .Append(";font-style:").Append(face.Style.ToLowerInvariant()).Append(";font-stretch:").Append(face.Stretch.ToLowerInvariant());
            if (options.SubsetPolicy.Equals("auto", StringComparison.OrdinalIgnoreCase) && requiredCodePoints.Length > 0)
                css.Append(";unicode-range:").Append(ToUnicodeRange(requiredCodePoints));
            else if (!options.SubsetPolicy.Equals("full", StringComparison.OrdinalIgnoreCase))
                throw new ArgumentException("Font subsetPolicy must be 'full' or 'auto'.");
            css.AppendLine(";font-display:block;}");
        }
        if (!string.IsNullOrWhiteSpace(options.DefaultFamily))
        {
            var families = new List<string> { CssString(options.DefaultFamily) };
            families.AddRange((options.FallbackFamilies ?? []).Select(CssString));
            if (pack is not null) families.Add(CssString("RUNE Deterministic Sans"));
            if (!options.DisableHostFontLookup) families.Add("sans-serif");
            css.Append("html,body,.rune-document{font-family:").Append(string.Join(',', families)).AppendLine(";}");
        }
        css.Append("html{--rune-font-manifest:").Append(CssString(string.Join(',', digests.Order(StringComparer.Ordinal)))).Append(';');
        if (pack is not null) css.Append("--rune-font-pack:").Append(CssString($"{pack.Id}@{pack.Version}:{pack.Sha256}" )).Append(';');
        css.AppendLine("}");
        return new CompiledFontCss(css.ToString(), digests, analyses, physicalSubsets);
    }

    private static void ValidatePolicy(FontOptions options)
    {
        if (options.AllowedLicenses?.Any(string.IsNullOrWhiteSpace) == true || options.DeniedLicenses?.Any(string.IsNullOrWhiteSpace) == true)
            throw new ArgumentException("Font license allow and deny lists cannot contain empty values.");
        var overlap = (options.AllowedLicenses ?? []).Intersect(options.DeniedLicenses ?? [], StringComparer.OrdinalIgnoreCase).FirstOrDefault();
        if (overlap is not null) throw new ArgumentException($"Font license '{overlap}' appears in both allow and deny lists.");
    }

    private static void ValidateFace(FontFaceDescriptor face, FontOptions options)
    {
        if (string.IsNullOrWhiteSpace(face.Family) || face.Family.Length > 100)
            throw new ArgumentException("Font family must contain between 1 and 100 characters.");
        if (face.Weight is < 100 or > 900 || face.Weight % 100 != 0)
            throw new ArgumentException($"Font weight for {face.Family} must be a CSS weight from 100 through 900.");
        if (!AllowedStyles.Contains(face.Style)) throw new ArgumentException($"Unsupported font style: {face.Style}.");
        if (!AllowedStretches.Contains(face.Stretch)) throw new ArgumentException($"Unsupported font stretch: {face.Stretch}.");
        var embedPolicy = options.Embedding?.ToString().ToLowerInvariant() ?? options.EmbedPolicy.ToLowerInvariant();
        if (face.LicenseAllowsEmbedding == false && embedPolicy == "required")
            throw new ArgumentException($"Font {face.ResourcePath} license metadata prohibits embedding.");
        if (options.LicensePolicy == FontLicensePolicyMode.RequireMetadata && string.IsNullOrWhiteSpace(face.LicenseSpdx))
            throw new ArgumentException($"Font {face.ResourcePath} requires SPDX license metadata.");
        if (!string.IsNullOrWhiteSpace(face.LicenseSpdx))
        {
            if (options.DeniedLicenses?.Contains(face.LicenseSpdx, StringComparer.OrdinalIgnoreCase) == true || options.LicensePolicy == FontLicensePolicyMode.Deny)
                throw new ArgumentException($"Font license {face.LicenseSpdx} is denied for {face.ResourcePath}.");
            if ((options.AllowedLicenses?.Count ?? 0) > 0 && !options.AllowedLicenses!.Contains(face.LicenseSpdx, StringComparer.OrdinalIgnoreCase))
                throw new ArgumentException($"Font license {face.LicenseSpdx} is not in the allowed license set.");
        }
    }

    private static FontGlyphAnalysis AnalyzeGlyphs(string path, string contentType, byte[] content, IReadOnlyList<int> required)
    {
        if (contentType is "font/woff" or "font/woff2")
            return new FontGlyphAnalysis(path, false, 0, required.ToArray());
        try
        {
            var mapped = ReadCmap(content);
            var missing = required.Where(codePoint => !mapped.Contains(codePoint)).ToArray();
            return new FontGlyphAnalysis(path, true, mapped.Count, missing);
        }
        catch (InvalidDataException)
        {
            return new FontGlyphAnalysis(path, false, 0, required.ToArray());
        }
    }

    private static HashSet<int> ReadCmap(byte[] font)
    {
        var data = font.AsSpan();
        if (data.Length < 12) throw new InvalidDataException("Invalid SFNT header.");
        var tableCount = ReadU16(data, 4);
        var cmapOffset = -1;
        var cmapLength = 0;
        for (var index = 0; index < tableCount; index++)
        {
            var offset = 12 + index * 16;
            if (offset + 16 > data.Length) throw new InvalidDataException("Invalid SFNT table directory.");
            if (data.Slice(offset, 4).SequenceEqual("cmap"u8))
            {
                cmapOffset = checked((int)ReadU32(data, offset + 8));
                cmapLength = checked((int)ReadU32(data, offset + 12));
                break;
            }
        }
        if (cmapOffset < 0 || cmapOffset + cmapLength > data.Length) throw new InvalidDataException("Font has no valid cmap table.");
        var cmap = data.Slice(cmapOffset, cmapLength);
        if (cmap.Length < 4) throw new InvalidDataException("Invalid cmap table.");
        var subtableCount = ReadU16(cmap, 2);
        var candidates = new List<(ushort Format, int Offset)>();
        for (var index = 0; index < subtableCount; index++)
        {
            var recordOffset = 4 + index * 8;
            if (recordOffset + 8 > cmap.Length) break;
            var subOffset = checked((int)ReadU32(cmap, recordOffset + 4));
            if (subOffset + 2 > cmap.Length) continue;
            candidates.Add((ReadU16(cmap, subOffset), subOffset));
        }
        var selected = candidates.OrderByDescending(item => item.Format == 12 ? 2 : item.Format == 4 ? 1 : 0).FirstOrDefault();
        return selected.Format switch
        {
            12 => ReadFormat12(cmap, selected.Offset),
            4 => ReadFormat4(cmap, selected.Offset),
            _ => throw new InvalidDataException("Only cmap formats 4 and 12 are supported.")
        };
    }

    private static HashSet<int> ReadFormat12(ReadOnlySpan<byte> cmap, int offset)
    {
        if (offset + 16 > cmap.Length) throw new InvalidDataException("Invalid cmap format 12.");
        var groups = checked((int)ReadU32(cmap, offset + 12));
        var result = new HashSet<int>();
        for (var index = 0; index < groups; index++)
        {
            var groupOffset = offset + 16 + index * 12;
            if (groupOffset + 12 > cmap.Length) throw new InvalidDataException("Invalid cmap format 12 group.");
            var start = ReadU32(cmap, groupOffset);
            var end = ReadU32(cmap, groupOffset + 4);
            if (end < start || end > 0x10FFFF || end - start > 1_000_000) throw new InvalidDataException("Invalid cmap range.");
            for (var value = start; value <= end; value++) result.Add((int)value);
        }
        return result;
    }

    private static HashSet<int> ReadFormat4(ReadOnlySpan<byte> cmap, int offset)
    {
        if (offset + 16 > cmap.Length) throw new InvalidDataException("Invalid cmap format 4.");
        var length = ReadU16(cmap, offset + 2);
        if (offset + length > cmap.Length) throw new InvalidDataException("Invalid cmap format 4 length.");
        var segCount = ReadU16(cmap, offset + 6) / 2;
        var endCodes = offset + 14;
        var startCodes = endCodes + segCount * 2 + 2;
        var idDeltas = startCodes + segCount * 2;
        var idRangeOffsets = idDeltas + segCount * 2;
        var result = new HashSet<int>();
        for (var segment = 0; segment < segCount; segment++)
        {
            var end = ReadU16(cmap, endCodes + segment * 2);
            var start = ReadU16(cmap, startCodes + segment * 2);
            var delta = unchecked((short)ReadU16(cmap, idDeltas + segment * 2));
            var rangeOffset = ReadU16(cmap, idRangeOffsets + segment * 2);
            if (end < start) continue;
            for (var code = start; code <= end && code != 0xFFFF; code++)
            {
                ushort glyph;
                if (rangeOffset == 0) glyph = (ushort)((code + delta) & 0xFFFF);
                else
                {
                    var glyphOffset = idRangeOffsets + segment * 2 + rangeOffset + (code - start) * 2;
                    if (glyphOffset + 2 > offset + length) continue;
                    glyph = ReadU16(cmap, glyphOffset);
                    if (glyph != 0) glyph = (ushort)((glyph + delta) & 0xFFFF);
                }
                if (glyph != 0) result.Add(code);
                if (code == ushort.MaxValue) break;
            }
        }
        return result;
    }

    private static IEnumerable<int> EnumerateCodePoints(string? value)
    {
        if (string.IsNullOrEmpty(value)) yield break;
        foreach (var rune in value.EnumerateRunes()) yield return rune.Value;
    }

    private static string ToUnicodeRange(IReadOnlyList<int> codePoints)
    {
        var ranges = new List<string>();
        var start = codePoints[0];
        var end = start;
        foreach (var value in codePoints.Skip(1))
        {
            if (value == end + 1) { end = value; continue; }
            ranges.Add(start == end ? $"U+{start:X}" : $"U+{start:X}-{end:X}");
            start = end = value;
        }
        ranges.Add(start == end ? $"U+{start:X}" : $"U+{start:X}-{end:X}");
        return string.Join(',', ranges);
    }

    private static ushort ReadU16(ReadOnlySpan<byte> data, int offset)
    {
        if ((uint)offset > data.Length - 2) throw new InvalidDataException("Unexpected end of font data.");
        return BinaryPrimitives.ReadUInt16BigEndian(data.Slice(offset, 2));
    }

    private static uint ReadU32(ReadOnlySpan<byte> data, int offset)
    {
        if ((uint)offset > data.Length - 4) throw new InvalidDataException("Unexpected end of font data.");
        return BinaryPrimitives.ReadUInt32BigEndian(data.Slice(offset, 4));
    }

    private static string NormalizeDigest(string value) => value.Replace("sha256:", string.Empty, StringComparison.OrdinalIgnoreCase).Replace("-", string.Empty, StringComparison.Ordinal).Trim();
    private static string CssString(string value) => $"\"{value.Replace("\\", "\\\\", StringComparison.Ordinal).Replace("\"", "\\\"", StringComparison.Ordinal)}\"";
    private static string FormatName(string contentType) => contentType.ToLowerInvariant() switch
    {
        "font/woff2" => "woff2",
        "font/woff" => "woff",
        "font/ttf" or "application/font-sfnt" => "truetype",
        "font/otf" => "opentype",
        _ => throw new ArgumentOutOfRangeException(nameof(contentType))
    };
}
