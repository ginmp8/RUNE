using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using Rune.Core;

namespace Rune.Engine.Tests;

public sealed class ReleasePackageVerifierTests
{
    [Fact]
    public void Verifies_manifest_archive_root_version_and_external_checksum()
    {
        using var fixture = ReleaseFixture.Create();
        var result = ReleasePackageVerifier.Verify(fixture.ArchivePath, fixture.ChecksumPath);
        Assert.True(result.IsValid, string.Join("; ", result.Errors));
        Assert.Equal("0.6.0", result.Version);
        Assert.Equal(2, result.VerifiedFileCount);
    }

    [Fact]
    public void Detects_tampered_manifest_content()
    {
        using var fixture = ReleaseFixture.Create(tamperReadme: true);
        var result = ReleasePackageVerifier.Verify(fixture.ArchivePath, fixture.ChecksumPath);
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, item => item.Contains("hash mismatch", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void Rejects_path_traversal_entries()
    {
        using var fixture = ReleaseFixture.Create(unsafeEntry: true);
        var result = ReleasePackageVerifier.Verify(fixture.ArchivePath);
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, item => item.Contains("Unsafe", StringComparison.OrdinalIgnoreCase));
    }

    private sealed class ReleaseFixture : IDisposable
    {
        public string Root { get; }
        public string ArchivePath { get; }
        public string ChecksumPath { get; }
        private ReleaseFixture(string root, string archivePath, string checksumPath) => (Root, ArchivePath, ChecksumPath) = (root, archivePath, checksumPath);

        public static ReleaseFixture Create(bool tamperReadme = false, bool unsafeEntry = false)
        {
            var root = Path.Combine(Path.GetTempPath(), "rune-release-verifier", Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(root);
            var archivePath = Path.Combine(root, "RUNE-0.6.0.zip");
            var version = Encoding.UTF8.GetBytes("0.6.0\n");
            var readmeOriginal = Encoding.UTF8.GetBytes("# RUNE\n");
            var manifest = $"{Hash(version)}  VERSION\n{Hash(readmeOriginal)}  README.md\n";
            using (var archive = ZipFile.Open(archivePath, ZipArchiveMode.Create))
            {
                Write(archive, "RUNE/VERSION", version);
                Write(archive, "RUNE/README.md", tamperReadme ? Encoding.UTF8.GetBytes("tampered") : readmeOriginal);
                Write(archive, "RUNE/MANIFEST.sha256", Encoding.UTF8.GetBytes(manifest));
                if (unsafeEntry) Write(archive, "../escape.txt", Encoding.UTF8.GetBytes("x"));
            }
            var checksumPath = Path.Combine(root, "RUNE-0.6.0.sha256");
            File.WriteAllText(checksumPath, $"{Hash(File.ReadAllBytes(archivePath))}  RUNE-0.6.0.zip\n");
            return new(root, archivePath, checksumPath);
        }

        private static void Write(ZipArchive archive, string name, byte[] content)
        {
            var entry = archive.CreateEntry(name);
            using var stream = entry.Open();
            stream.Write(content);
        }
        private static string Hash(byte[] bytes) => Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
        public void Dispose() { if (Directory.Exists(Root)) Directory.Delete(Root, true); }
    }
}
