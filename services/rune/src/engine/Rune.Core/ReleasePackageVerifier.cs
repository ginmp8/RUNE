using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace Rune.Core;

public sealed record ReleaseVerificationResult(
    bool IsValid,
    string? Version,
    string? ArchiveSha256,
    int VerifiedFileCount,
    IReadOnlyList<string> Errors);

public static partial class ReleasePackageVerifier
{
    public static ReleaseVerificationResult Verify(string archivePath, string? checksumPath = null)
    {
        var errors = new List<string>();
        string? version = null;
        var verified = 0;
        string? archiveHash = null;
        try
        {
            var archiveFile = Path.GetFullPath(archivePath);
            if (!File.Exists(archiveFile))
                return new(false, null, null, 0, [$"Archive was not found: {archiveFile}"]);
            archiveHash = Sha256(File.ReadAllBytes(archiveFile));
            if (checksumPath is not null)
                VerifyExternalChecksum(checksumPath, Path.GetFileName(archiveFile), archiveHash, errors);

            using var archive = ZipFile.OpenRead(archiveFile);
            var files = new Dictionary<string, ZipArchiveEntry>(StringComparer.Ordinal);
            foreach (var entry in archive.Entries.Where(item => !string.IsNullOrEmpty(item.Name)))
            {
                var normalized = entry.FullName.Replace('\\', '/');
                if (!normalized.StartsWith("RUNE/", StringComparison.Ordinal) || normalized.StartsWith("/", StringComparison.Ordinal) || normalized.Split('/').Any(part => part is ".." or "."))
                {
                    errors.Add($"Unsafe or invalid archive path: {entry.FullName}");
                    continue;
                }
                var relative = normalized[5..];
                if (!files.TryAdd(relative, entry))
                    errors.Add($"Duplicate archive entry: {relative}");
            }

            if (!files.TryGetValue("VERSION", out var versionEntry))
                errors.Add("VERSION is missing from the archive.");
            else
            {
                version = ReadText(versionEntry).Trim();
                if (!SemanticVersionRegex().IsMatch(version))
                    errors.Add($"VERSION is not a supported semantic version: {version}");
                if (!Path.GetFileName(archiveFile).Equals($"RUNE-{version}.zip", StringComparison.Ordinal))
                    errors.Add($"Archive name does not match VERSION {version}.");
            }

            if (!files.TryGetValue("MANIFEST.sha256", out var manifestEntry))
                errors.Add("MANIFEST.sha256 is missing from the archive.");
            else
            {
                var manifestPaths = new HashSet<string>(StringComparer.Ordinal);
                foreach (var line in ReadText(manifestEntry).Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                {
                    var separator = line.IndexOf("  ", StringComparison.Ordinal);
                    if (separator != 64 || !HexRegex().IsMatch(line[..separator]))
                    {
                        errors.Add($"Invalid manifest line: {line}");
                        continue;
                    }
                    var expected = line[..separator].ToLowerInvariant();
                    var relative = line[(separator + 2)..].Replace('\\', '/');
                    if (relative is "MANIFEST.sha256" || relative.StartsWith("/", StringComparison.Ordinal) || relative.Split('/').Any(part => part is ".." or "."))
                    {
                        errors.Add($"Invalid manifest path: {relative}");
                        continue;
                    }
                    if (!manifestPaths.Add(relative))
                    {
                        errors.Add($"Duplicate manifest path: {relative}");
                        continue;
                    }
                    if (!files.TryGetValue(relative, out var file))
                    {
                        errors.Add($"Manifest file is missing: {relative}");
                        continue;
                    }
                    var actual = Sha256(ReadBytes(file));
                    if (!actual.Equals(expected, StringComparison.OrdinalIgnoreCase))
                        errors.Add($"Manifest hash mismatch: {relative}");
                    else
                        verified++;
                }
                foreach (var relative in files.Keys.Where(name => name != "MANIFEST.sha256" && !manifestPaths.Contains(name)).Order(StringComparer.Ordinal))
                    errors.Add($"Archive file is not covered by the manifest: {relative}");
            }
        }
        catch (Exception exception) when (exception is IOException or InvalidDataException or UnauthorizedAccessException)
        {
            errors.Add(exception.Message);
        }
        return new(errors.Count == 0, version, archiveHash, verified, errors);
    }

    private static void VerifyExternalChecksum(string checksumPath, string archiveName, string actual, List<string> errors)
    {
        if (!File.Exists(checksumPath))
        {
            errors.Add($"External checksum was not found: {checksumPath}");
            return;
        }
        var line = File.ReadLines(checksumPath).FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));
        if (line is null)
        {
            errors.Add("External checksum file is empty.");
            return;
        }
        var parts = line.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length < 1 || !HexRegex().IsMatch(parts[0]))
        {
            errors.Add("External checksum file is invalid.");
            return;
        }
        if (parts.Length > 1 && !Path.GetFileName(parts[^1]).TrimStart('*').Equals(archiveName, StringComparison.Ordinal))
            errors.Add("External checksum filename does not match the archive.");
        if (!parts[0].Equals(actual, StringComparison.OrdinalIgnoreCase))
            errors.Add("External checksum does not match the archive.");
    }

    private static string ReadText(ZipArchiveEntry entry) => Encoding.UTF8.GetString(ReadBytes(entry));
    private static byte[] ReadBytes(ZipArchiveEntry entry)
    {
        using var source = entry.Open();
        using var output = new MemoryStream();
        source.CopyTo(output);
        return output.ToArray();
    }
    private static string Sha256(byte[] bytes) => Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();

    [GeneratedRegex("^[0-9a-fA-F]{64}$", RegexOptions.CultureInvariant)]
    private static partial Regex HexRegex();
    [GeneratedRegex("^\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?$", RegexOptions.CultureInvariant)]
    private static partial Regex SemanticVersionRegex();
}
