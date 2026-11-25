using System.Text;
using Rune.Core;
using Rune.Job.Contracts;
using Rune.RenderProcessing;

namespace Rune.Engine.Tests;

public sealed class RenderCacheFeatureTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "rune-cache-tests", Guid.NewGuid().ToString("N"));

    [Fact]
    public void Fingerprint_is_stable_and_changes_for_material_options_or_scope()
    {
        var package = Package(new RenderOptions(CachePolicy: new RenderCachePolicy(RenderCacheMode.Use, "tenant-a")));
        var first = RenderFingerprintBuilder.Build(package, "tenant-a");
        var second = RenderFingerprintBuilder.Build(package, "tenant-a");
        var changedOption = RenderFingerprintBuilder.Build(Package(package.Options with { PageSize = "Letter" }), "tenant-a");
        var changedScope = RenderFingerprintBuilder.Build(package, "tenant-b");
        var changedResource = RenderFingerprintBuilder.Build(package with
        {
            Resources = [new RenderPackageResource("logo.png", "image/png", [1, 2, 3])]
        }, "tenant-a");
        var changedOutputs = RenderFingerprintBuilder.Build(package with
        {
            OutputFormats = [RenderOutputFormat.Pdf, RenderOutputFormat.StaticHtml]
        }, "tenant-a");
        var changedTemplate = RenderFingerprintBuilder.Build(package with
        {
            TemplateExpansion = new TemplateExpansionMetadata("rune-template-v1", "1", "template", "data", "schema",
                new Dictionary<string, string>(), "expanded", 1, 1, 1, "en-US", "UTC")
        }, "tenant-a");
        var changedAssembly = RenderFingerprintBuilder.Build(package with { AssemblyManifestJson = "{\"parts\":[\"a\"]}" }, "tenant-a");
        Assert.Equal(first, second);
        Assert.NotEqual(first, changedOption);
        Assert.NotEqual(first, changedScope);
        Assert.NotEqual(first, changedResource);
        Assert.NotEqual(first, changedOutputs);
        Assert.NotEqual(first, changedTemplate);
        Assert.NotEqual(first, changedAssembly);
    }

    [Fact]
    public async Task Publishes_validates_and_reuses_immutable_artifacts()
    {
        var cache = new FileSystemRenderCache(_root);
        var package = Package(new RenderOptions(CachePolicy: new RenderCachePolicy(RenderCacheMode.Use, "tenant-a")));
        var fingerprint = RenderFingerprintBuilder.Build(package, "tenant-a");
        var sourceId = Guid.NewGuid();
        var bytes = Encoding.UTF8.GetBytes("cached html");
        await cache.PublishAsync("tenant-a", fingerprint, sourceId, "html", "text/html", bytes);
        var hit = await cache.TryReadAsync("tenant-a", fingerprint, TimeSpan.FromDays(1));
        Assert.NotNull(hit);
        Assert.Equal(sourceId, hit!.SourceRenderId);
        Assert.Equal(bytes, hit.Content);
        Assert.Null(await cache.TryReadAsync("tenant-b", fingerprint, TimeSpan.FromDays(1)));
    }

    [Fact]
    public async Task Corrupt_artifact_is_quarantined_and_returned_as_miss()
    {
        var cache = new FileSystemRenderCache(_root);
        var package = Package(new RenderOptions(CachePolicy: new RenderCachePolicy(RenderCacheMode.Use, "tenant-a")));
        var fingerprint = RenderFingerprintBuilder.Build(package, "tenant-a");
        await cache.PublishAsync("tenant-a", fingerprint, Guid.NewGuid(), "pdf", "application/pdf", [1, 2, 3, 4]);
        var artifact = Directory.EnumerateFiles(_root, "artifact.pdf", SearchOption.AllDirectories).Single();
        await File.WriteAllBytesAsync(artifact, [9, 9, 9]);
        Assert.Null(await cache.TryReadAsync("tenant-a", fingerprint, TimeSpan.FromDays(1)));
        Assert.NotEmpty(Directory.EnumerateDirectories(_root, "*.corrupt-*", SearchOption.AllDirectories));
    }

    private static RenderPackage Package(RenderOptions options) => new(
        Guid.NewGuid(), "<html><body>stable</body></html>", RenderOutputFormat.StaticHtml, options,
        new string('A', 64), DateTimeOffset.UnixEpoch);

    public void Dispose()
    {
        if (Directory.Exists(_root)) Directory.Delete(_root, true);
    }

    [Fact]
    public async Task Coordinates_cross_instance_locks_and_releases_waiters()
    {
        var first = new FileSystemRenderCache(_root);
        var second = new FileSystemRenderCache(_root);
        var fingerprint = new string('A', 64);
        var lease = await first.AcquireAsync("tenant", fingerprint, timeoutSeconds: 2);
        using var cancellation = new CancellationTokenSource(TimeSpan.FromSeconds(3));
        var waiter = second.AcquireAsync("tenant", fingerprint, cancellation.Token, timeoutSeconds: 2).AsTask();
        await Task.Delay(150);
        Assert.False(waiter.IsCompleted);
        await lease.DisposeAsync();
        await using var acquired = await waiter;
        Assert.NotNull(acquired);
    }

    [Fact]
    public async Task Invalidates_scope_and_evicts_oldest_entries_to_enforce_quotas()
    {
        var cache = new FileSystemRenderCache(_root);
        var first = new string('A', 64);
        var second = new string('B', 64);
        await cache.PublishAsync("tenant", first, Guid.NewGuid(), "html", "text/html", Encoding.UTF8.GetBytes("first"),
            maximumScopeBytes: 100, maximumScopeEntries: 1, invalidationToken: "v1");
        await Task.Delay(20);
        await cache.PublishAsync("tenant", second, Guid.NewGuid(), "html", "text/html", Encoding.UTF8.GetBytes("second"),
            maximumScopeBytes: 100, maximumScopeEntries: 1, invalidationToken: "v1");
        Assert.Null(await cache.TryReadAsync("tenant", first, TimeSpan.FromDays(1), invalidationToken: "v1"));
        Assert.NotNull(await cache.TryReadAsync("tenant", second, TimeSpan.FromDays(1), invalidationToken: "v1"));
        await cache.InvalidateScopeAsync("tenant");
        Assert.Null(await cache.TryReadAsync("tenant", second, TimeSpan.FromDays(1), invalidationToken: "v1"));
        Assert.Null(await cache.TryReadAsync("tenant", second, TimeSpan.FromDays(1), invalidationToken: "v2"));
    }

    [Fact]
    public async Task Superseded_lease_neither_heartbeats_nor_deletes_the_replacement_lock()
    {
        var cache = new FileSystemRenderCache(_root);
        var fingerprint = new string('C', 64);
        var lease = await cache.AcquireAsync("tenant", fingerprint, timeoutSeconds: 2, staleLockSeconds: 1);
        var lockPath = Directory.EnumerateFiles(_root, "*.lock", SearchOption.AllDirectories).Single();
        File.Move(lockPath, lockPath + ".superseded");
        await File.WriteAllTextAsync(lockPath, "replacement|other-node|1|2026-07-27T00:00:00Z");
        var oldTimestamp = DateTime.UtcNow.AddMinutes(-10);
        File.SetLastWriteTimeUtc(lockPath, oldTimestamp);
        await Task.Delay(800);
        Assert.True(File.GetLastWriteTimeUtc(lockPath) < DateTime.UtcNow.AddMinutes(-5));
        await lease.DisposeAsync();
        Assert.True(File.Exists(lockPath));
    }

    [Fact]
    public async Task Probes_required_shared_filesystem_semantics()
    {
        var cache = new FileSystemRenderCache(_root);
        var semantics = await cache.ProbeStorageSemanticsAsync();
        Assert.True(semantics.ExclusiveCreate, string.Join(',', semantics.Diagnostics));
        Assert.True(semantics.AtomicRename, string.Join(',', semantics.Diagnostics));
        Assert.True(semantics.Delete, string.Join(',', semantics.Diagnostics));
        Assert.True(semantics.Coherent, string.Join(',', semantics.Diagnostics));
    }

    [Fact]
    public async Task Superseded_cache_fencing_token_cannot_publish()
    {
        var cache = new FileSystemRenderCache(_root);
        var fingerprint = new string('D', 64);
        await using var lease = await cache.AcquireAsync("tenant", fingerprint, timeoutSeconds: 2, staleLockSeconds: 1);
        var lockPath = Directory.EnumerateFiles(_root, "*.lock", SearchOption.AllDirectories).Single();
        File.Move(lockPath, lockPath + ".superseded");
        await File.WriteAllTextAsync(lockPath, "replacement|other-node|2|2026-07-27T00:00:00Z");

        await Assert.ThrowsAsync<CacheFencingRejectedException>(async () =>
            await cache.PublishAsync("tenant", fingerprint, Guid.NewGuid(), "html", "text/html", Encoding.UTF8.GetBytes("stale"),
                staleLockSeconds: 1, fencingToken: lease.FencingToken));
        Assert.Null(await cache.TryReadAsync("tenant", fingerprint, TimeSpan.FromDays(1)));
    }

    [Fact]
    public async Task Encrypted_entry_requires_matching_security_label_and_reauthorization()
    {
        var previousKey = Environment.GetEnvironmentVariable("RUNE_CACHE_ENCRYPTION_KEY");
        Environment.SetEnvironmentVariable("RUNE_CACHE_ENCRYPTION_KEY", Convert.ToBase64String(Enumerable.Range(0, 32).Select(value => (byte)value).ToArray()));
        try
        {
            var cache = new FileSystemRenderCache(_root);
            var fingerprint = new string('E', 64);
            var sourceId = Guid.NewGuid();
            var plaintext = Encoding.UTF8.GetBytes("restricted content");
            await cache.PublishAsync("tenant", fingerprint, sourceId, "html", "text/html", plaintext,
                securityLabel: "restricted", encryptAtRest: true);

            var stored = Directory.EnumerateFiles(_root, "artifact.html", SearchOption.AllDirectories).Single();
            Assert.NotEqual(plaintext, await File.ReadAllBytesAsync(stored));
            Assert.Null(await cache.TryReadAsync("tenant", fingerprint, TimeSpan.FromDays(1), expectedSecurityLabel: "public"));
            Assert.Null(await cache.TryReadAsync("tenant", fingerprint, TimeSpan.FromDays(1), expectedSecurityLabel: "restricted",
                reauthorize: (_, _) => ValueTask.FromResult(false)));

            var hit = await cache.TryReadAsync("tenant", fingerprint, TimeSpan.FromDays(1), expectedSecurityLabel: "restricted",
                reauthorize: (id, _) => ValueTask.FromResult(id == sourceId));
            Assert.NotNull(hit);
            Assert.True(hit!.EncryptedAtRest);
            Assert.Equal("restricted", hit.SecurityLabel);
            Assert.Equal(plaintext, hit.Content);
        }
        finally
        {
            Environment.SetEnvironmentVariable("RUNE_CACHE_ENCRYPTION_KEY", previousKey);
        }
    }

    [Fact]
    public async Task Failed_refresh_preserves_the_previous_valid_entry()
    {
        var cache = new FileSystemRenderCache(_root);
        var fingerprint = new string('F', 64);
        var original = Encoding.UTF8.GetBytes("original");
        await cache.PublishAsync("tenant", fingerprint, Guid.NewGuid(), "html", "text/html", original);

        await Assert.ThrowsAsync<CacheFencingRejectedException>(async () =>
            await cache.PublishAsync("tenant", fingerprint, Guid.NewGuid(), "html", "text/html", Encoding.UTF8.GetBytes("replacement"),
                fencingToken: "not-the-owner"));

        var hit = await cache.TryReadAsync("tenant", fingerprint, TimeSpan.FromDays(1));
        Assert.NotNull(hit);
        Assert.Equal(original, hit!.Content);
    }

    [Fact]
    public async Task Administrative_invalidation_records_a_reason()
    {
        var cache = new FileSystemRenderCache(_root);
        await cache.InvalidateScopeAsync("tenant", reason: "incident-123");
        var auditPath = Directory.EnumerateFiles(_root, "last-invalidation.json", SearchOption.AllDirectories).Single();
        var audit = await File.ReadAllTextAsync(auditPath);
        Assert.Contains("incident-123", audit, StringComparison.Ordinal);
    }

}
