using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Rune.Core;
using Rune.Job.Contracts;
using Rune.Storage.Abstractions;

namespace Rune.RenderProcessing;

public sealed record CacheStorageSemantics(
    bool ExclusiveCreate,
    bool AtomicRename,
    bool Delete,
    bool Coherent,
    IReadOnlyList<string> Diagnostics);

public sealed record RenderCacheArtifact(
    byte[] Content,
    string Extension,
    string ContentType,
    Guid SourceRenderId,
    string Fingerprint,
    DateTimeOffset CreatedAt,
    string? SecurityLabel = null,
    bool EncryptedAtRest = false,
    DateTimeOffset? LastAccessedAt = null);

public sealed class CacheFencingRejectedException(string scope, string fingerprint)
    : IOException($"Cache lease no longer owns '{scope}:{fingerprint}'.");

public static class RenderFingerprintBuilder
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
    };

    public static string Build(RenderPackage package, string securityScope)
    {
        if (string.IsNullOrWhiteSpace(securityScope) || securityScope.Length > 200)
            throw new ArgumentException("Cache security scope must contain between 1 and 200 characters.", nameof(securityScope));
        var resourceDigests = (package.Resources ?? [])
            .OrderBy(item => item.Path, StringComparer.Ordinal)
            .Select(item => new
            {
                path = item.Path.Replace('\\', '/'),
                item.ContentType,
                length = item.Content.LongLength,
                sha256 = Convert.ToHexString(SHA256.HashData(item.Content))
            }).ToArray();
        var outputs = (package.OutputFormats is { Count: > 0 } ? package.OutputFormats : [package.OutputFormat])
            .NormalizeOutputSet();
        var canonical = new
        {
            fingerprintVersion = "3",
            source = new
            {
                type = package.SourceType,
                normalizedDigest = package.ContentHash,
                package.SourceResourcePath,
                documentModelDigest = package.DocumentModel is null ? null : Convert.ToHexString(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(package.DocumentModel, JsonOptions)))
            },
            outputs,
            options = package.Options with { CachePolicy = null },
            resources = resourceDigests,
            pdfImport = package.PdfImport,
            nativePdfImports = package.NativePdfImports,
            templateExpansion = package.TemplateExpansion,
            assemblyManifestSha256 = package.AssemblyManifestJson is null ? null : Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(package.AssemblyManifestJson))),
            runtime = new { runeVersion = RuneVersion.Current, contractVersion = package.ContractVersion },
            securityScope
        };
        return Convert.ToHexString(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(canonical, JsonOptions)));
    }
}

public sealed class RenderCacheLease : IAsyncDisposable
{
    private readonly SemaphoreSlim _gate;
    private readonly FileLeaseHandle _fileLock;
    private int _disposed;

    internal RenderCacheLease(SemaphoreSlim gate, FileLeaseHandle fileLock)
    {
        _gate = gate;
        _fileLock = fileLock;
        FencingToken = fileLock.Token;
    }

    public string FencingToken { get; }

    public async ValueTask DisposeAsync()
    {
        if (Interlocked.Exchange(ref _disposed, 1) != 0) return;
        await _fileLock.DisposeAsync();
        _gate.Release();
    }
}

public sealed class FileSystemRenderCache
{
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> Gates = new(StringComparer.Ordinal);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = true };
    private readonly string _root;
    private readonly RuneOperationalMetrics? _metrics;

    public FileSystemRenderCache(string root, RuneOperationalMetrics? metrics = null)
    {
        _root = Path.GetFullPath(root);
        _metrics = metrics;
        Directory.CreateDirectory(_root);
    }

    public async ValueTask<RenderCacheArtifact?> TryReadAsync(
        string scope,
        string fingerprint,
        TimeSpan maximumAge,
        CancellationToken cancellationToken = default,
        string? invalidationToken = null,
        string? expectedSecurityLabel = null,
        Func<Guid, CancellationToken, ValueTask<bool>>? reauthorize = null,
        bool quarantineCorruptEntries = true)
    {
        var directory = EntryDirectory(scope, fingerprint);
        var manifestPath = Path.Combine(directory, "manifest.json");
        if (!File.Exists(manifestPath)) return null;
        CacheManifest? manifest;
        try
        {
            manifest = JsonSerializer.Deserialize<CacheManifest>(await File.ReadAllBytesAsync(manifestPath, cancellationToken), JsonOptions);
        }
        catch (JsonException)
        {
            if (quarantineCorruptEntries) Quarantine(directory);
            if (_metrics is not null) await _metrics.IncrementAsync("rune_cache_corrupt_total", cancellationToken: cancellationToken);
            return null;
        }
        if (manifest is null || !string.Equals(manifest.Fingerprint, fingerprint, StringComparison.OrdinalIgnoreCase) ||
            DateTimeOffset.UtcNow - manifest.CreatedAt > maximumAge ||
            !string.Equals(manifest.InvalidationToken, invalidationToken, StringComparison.Ordinal))
            return null;
        if (!string.Equals(manifest.SecurityLabel, expectedSecurityLabel, StringComparison.Ordinal)) return null;
        if (reauthorize is not null && !await reauthorize(manifest.SourceRenderId, cancellationToken))
        {
            if (_metrics is not null) await _metrics.IncrementAsync("rune_cache_reauthorization_denied_total", cancellationToken: cancellationToken);
            return null;
        }
        var scopeGeneration = await ReadScopeGenerationAsync(scope, cancellationToken);
        if (!string.Equals(manifest.ScopeGeneration, scopeGeneration, StringComparison.Ordinal)) return null;
        var artifactPath = Path.Combine(directory, manifest.FileName);
        if (!File.Exists(artifactPath))
        {
            if (quarantineCorruptEntries) Quarantine(directory);
            if (_metrics is not null) await _metrics.IncrementAsync("rune_cache_corrupt_total", cancellationToken: cancellationToken);
            return null;
        }
        var storedBytes = await File.ReadAllBytesAsync(artifactPath, cancellationToken);
        var digest = Convert.ToHexString(SHA256.HashData(storedBytes));
        if (!string.Equals(digest, manifest.Sha256, StringComparison.OrdinalIgnoreCase) || storedBytes.LongLength != manifest.Length)
        {
            if (quarantineCorruptEntries) Quarantine(directory);
            if (_metrics is not null) await _metrics.IncrementAsync("rune_cache_corrupt_total", cancellationToken: cancellationToken);
            return null;
        }
        byte[] bytes;
        try
        {
            bytes = manifest.EncryptedAtRest ? Decrypt(storedBytes, manifest.EncryptionNonce, manifest.EncryptionTag) : storedBytes;
        }
        catch (CryptographicException)
        {
            if (quarantineCorruptEntries) Quarantine(directory);
            if (_metrics is not null) await _metrics.IncrementAsync("rune_cache_corrupt_total", cancellationToken: cancellationToken);
            return null;
        }
        if (manifest.PlaintextSha256 is not null && !string.Equals(Convert.ToHexString(SHA256.HashData(bytes)), manifest.PlaintextSha256, StringComparison.OrdinalIgnoreCase))
        {
            if (quarantineCorruptEntries) Quarantine(directory);
            return null;
        }
        try
        {
            var touched = manifest with { LastAccessedAt = DateTimeOffset.UtcNow };
            await AtomicWriteAsync(manifestPath, JsonSerializer.SerializeToUtf8Bytes(touched, JsonOptions), cancellationToken);
        }
        catch (IOException) { }
        return new RenderCacheArtifact(bytes, manifest.Extension, manifest.ContentType, manifest.SourceRenderId, fingerprint, manifest.CreatedAt,
            manifest.SecurityLabel, manifest.EncryptedAtRest, DateTimeOffset.UtcNow);
    }

    public async ValueTask PublishAsync(
        string scope,
        string fingerprint,
        Guid sourceRenderId,
        string extension,
        string contentType,
        byte[] content,
        CancellationToken cancellationToken = default,
        long maximumScopeBytes = 1_000_000_000,
        int maximumScopeEntries = 10_000,
        string? invalidationToken = null,
        int staleLockSeconds = 300,
        string? fencingToken = null,
        string? securityLabel = null,
        bool encryptAtRest = false)
    {
        if (maximumScopeBytes < 1 || maximumScopeEntries < 1) throw new ArgumentException("Cache quotas must be positive.");
        var directory = EntryDirectory(scope, fingerprint);
        var safeExtension = extension.TrimStart('.').ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(safeExtension) || safeExtension.Any(character => !char.IsAsciiLetterOrDigit(character)))
            throw new ArgumentException("Cache artifact extension is invalid.", nameof(extension));
        var fileName = "artifact." + safeExtension;
        var plaintextDigest = Convert.ToHexString(SHA256.HashData(content));
        var encryption = encryptAtRest ? Encrypt(content) : new EncryptionResult(content, null, null);
        var storedContent = encryption.Content;
        var digest = Convert.ToHexString(SHA256.HashData(storedContent));
        var now = DateTimeOffset.UtcNow;
        var manifest = new CacheManifest("3", fingerprint, sourceRenderId, now, now, fileName, safeExtension, contentType,
            storedContent.LongLength, digest, invalidationToken, await ReadScopeGenerationAsync(scope, cancellationToken),
            securityLabel, encryptAtRest, encryption.Nonce, encryption.Tag, plaintextDigest, content.LongLength);
        var stage = directory + ".stage-" + Guid.NewGuid().ToString("N");
        var backup = directory + ".backup-" + Guid.NewGuid().ToString("N");
        Directory.CreateDirectory(stage);
        try
        {
            if (fencingToken is not null)
                await EnsureLeaseOwnerAsync(scope, fingerprint, fencingToken, TimeSpan.FromSeconds(staleLockSeconds), cancellationToken);
            RuneFailureInjection.Trigger("during-temp-write", sourceRenderId);
            await File.WriteAllBytesAsync(Path.Combine(stage, fileName), storedContent, cancellationToken);
            RuneFailureInjection.Trigger("during-upload", sourceRenderId);
            await File.WriteAllBytesAsync(Path.Combine(stage, "manifest.json"), JsonSerializer.SerializeToUtf8Bytes(manifest, JsonOptions), cancellationToken);
            if (fencingToken is not null)
                await EnsureLeaseOwnerAsync(scope, fingerprint, fencingToken, TimeSpan.FromSeconds(staleLockSeconds), cancellationToken);
            RuneFailureInjection.Trigger("during-rename", sourceRenderId);
            if (Directory.Exists(directory)) Directory.Move(directory, backup);
            Directory.Move(stage, directory);
            TryDeleteDirectory(backup);
        }
        catch
        {
            if (!Directory.Exists(directory) && Directory.Exists(backup)) Directory.Move(backup, directory);
            throw;
        }
        finally
        {
            TryDeleteDirectory(stage);
            TryDeleteDirectory(backup);
        }
        await EnforceQuotaAsync(scope, maximumScopeBytes, maximumScopeEntries, TimeSpan.FromSeconds(staleLockSeconds), cancellationToken);
    }

    public async ValueTask<RenderCacheLease> AcquireAsync(
        string scope,
        string fingerprint,
        CancellationToken cancellationToken = default,
        int timeoutSeconds = 120,
        int staleLockSeconds = 300)
    {
        if (timeoutSeconds is < 1 or > 3600 || staleLockSeconds is < 1 or > 86_400)
            throw new ArgumentException("Cache lock timeout or stale lock interval is invalid.");
        var key = scope + ":" + fingerprint;
        var gate = Gates.GetOrAdd(key, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(cancellationToken);
        try
        {
            var lockPath = LockPath(scope, fingerprint);
            Directory.CreateDirectory(Path.GetDirectoryName(lockPath)!);
            var fileLock = await AcquireFileLockAsync(lockPath, TimeSpan.FromSeconds(timeoutSeconds), TimeSpan.FromSeconds(staleLockSeconds), cancellationToken);
            return new RenderCacheLease(gate, fileLock);
        }
        catch
        {
            gate.Release();
            throw;
        }
    }

    public async ValueTask<CacheStorageSemantics> ProbeStorageSemanticsAsync(CancellationToken cancellationToken = default)
    {
        var directory = Path.Combine(_root, ".semantics-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(directory);
        var diagnostics = new List<string>();
        var exclusiveCreate = false;
        var atomicRename = false;
        var delete = false;
        try
        {
            var source = Path.Combine(directory, "source");
            await using (var first = new FileStream(source, FileMode.CreateNew, FileAccess.ReadWrite, FileShare.Read, 1, FileOptions.Asynchronous))
            {
                try { await using var duplicate = new FileStream(source, FileMode.CreateNew, FileAccess.Write, FileShare.None); }
                catch (IOException) { exclusiveCreate = true; }
                if (!exclusiveCreate) diagnostics.Add("exclusive-create-not-enforced");
                await first.WriteAsync("probe"u8.ToArray(), cancellationToken);
                await first.FlushAsync(cancellationToken);
            }
            var destination = Path.Combine(directory, "destination");
            File.Move(source, destination, false);
            atomicRename = !File.Exists(source) && File.Exists(destination) && await File.ReadAllTextAsync(destination, cancellationToken) == "probe";
            if (!atomicRename) diagnostics.Add("rename-not-observed-atomically");
            File.Delete(destination);
            delete = !File.Exists(destination);
            if (!delete) diagnostics.Add("delete-not-coherent");
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            diagnostics.Add("storage-semantics-probe-failed:" + exception.GetType().Name);
        }
        finally { TryDeleteDirectory(directory); }
        return new CacheStorageSemantics(exclusiveCreate, atomicRename, delete, exclusiveCreate && atomicRename && delete, diagnostics);
    }

    public async ValueTask<string> InvalidateScopeAsync(string scope, CancellationToken cancellationToken = default, string reason = "administrative")
    {
        if (string.IsNullOrWhiteSpace(reason) || reason.Length > 240) throw new ArgumentException("Cache invalidation reason is invalid.", nameof(reason));
        var generation = $"{DateTimeOffset.UtcNow:O}-{Guid.NewGuid():N}";
        var scopeDirectory = ScopeDirectory(scope);
        Directory.CreateDirectory(scopeDirectory);
        await AtomicWriteAsync(Path.Combine(scopeDirectory, "generation.txt"), Encoding.UTF8.GetBytes(generation), cancellationToken);
        var audit = JsonSerializer.SerializeToUtf8Bytes(new { generation, reason, invalidatedAt = DateTimeOffset.UtcNow }, JsonOptions);
        await AtomicWriteAsync(Path.Combine(scopeDirectory, "last-invalidation.json"), audit, cancellationToken);
        if (_metrics is not null) await _metrics.IncrementAsync("rune_cache_invalidation_total", cancellationToken: cancellationToken);
        return generation;
    }

    private async ValueTask EnsureLeaseOwnerAsync(
        string scope,
        string fingerprint,
        string token,
        TimeSpan staleAfter,
        CancellationToken cancellationToken)
    {
        var lockPath = LockPath(scope, fingerprint);
        var valid = false;
        try
        {
            if (File.Exists(lockPath) && DateTimeOffset.UtcNow - File.GetLastWriteTimeUtc(lockPath) <= staleAfter)
            {
                var value = await File.ReadAllTextAsync(lockPath, cancellationToken);
                valid = value.StartsWith(token + "|", StringComparison.Ordinal);
            }
        }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
        if (valid) return;
        if (_metrics is not null) await _metrics.IncrementAsync("rune_lease_fencing_rejection_total", cancellationToken: cancellationToken);
        throw new CacheFencingRejectedException(scope, fingerprint);
    }

    private async ValueTask EnforceQuotaAsync(string scope, long maximumBytes, int maximumEntries, TimeSpan staleLock, CancellationToken cancellationToken)
    {
        var scopeDirectory = ScopeDirectory(scope);
        Directory.CreateDirectory(scopeDirectory);
        var quotaLockPath = Path.Combine(scopeDirectory, ".quota.lock");
        await using var quotaLock = await AcquireFileLockAsync(quotaLockPath, TimeSpan.FromSeconds(120), staleLock, cancellationToken);
        var entries = new List<(string Directory, CacheManifest Manifest)>();
        foreach (var directory in Directory.EnumerateDirectories(scopeDirectory))
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (directory.Contains(".stage-", StringComparison.Ordinal) || directory.Contains(".backup-", StringComparison.Ordinal)) continue;
            var manifestPath = Path.Combine(directory, "manifest.json");
            if (!File.Exists(manifestPath)) continue;
            try
            {
                var manifest = JsonSerializer.Deserialize<CacheManifest>(await File.ReadAllBytesAsync(manifestPath, cancellationToken), JsonOptions);
                if (manifest is not null) entries.Add((directory, manifest));
            }
            catch (JsonException) { Quarantine(directory); }
        }
        long totalBytes = entries.Sum(item => item.Manifest.Length);
        foreach (var entry in entries.OrderBy(item => item.Manifest.LastAccessedAt).ThenBy(item => item.Manifest.CreatedAt).ToArray())
        {
            if (entries.Count <= maximumEntries && totalBytes <= maximumBytes) break;
            try
            {
                Directory.Delete(entry.Directory, true);
                totalBytes -= entry.Manifest.Length;
                entries.Remove(entry);
            }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
        }
    }

    private async ValueTask<string> ReadScopeGenerationAsync(string scope, CancellationToken cancellationToken)
    {
        var path = Path.Combine(ScopeDirectory(scope), "generation.txt");
        return File.Exists(path) ? (await File.ReadAllTextAsync(path, cancellationToken)).Trim() : "0";
    }

    private string ScopeDirectory(string scope)
    {
        if (string.IsNullOrWhiteSpace(scope) || scope.Length > 200) throw new ArgumentException("Cache scope is invalid.", nameof(scope));
        var scopeHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(scope)))[..24];
        return Path.Combine(_root, scopeHash);
    }

    private string EntryDirectory(string scope, string fingerprint)
    {
        if (fingerprint.Length != 64 || fingerprint.Any(character => !char.IsAsciiHexDigit(character)))
            throw new ArgumentException("Cache fingerprint is invalid.", nameof(fingerprint));
        return Path.Combine(ScopeDirectory(scope), fingerprint.ToUpperInvariant());
    }

    private string LockPath(string scope, string fingerprint) => EntryDirectory(scope, fingerprint) + ".lock";

    private static async Task<FileLeaseHandle> AcquireFileLockAsync(string path, TimeSpan timeout, TimeSpan staleAfter, CancellationToken cancellationToken)
    {
        var deadline = DateTimeOffset.UtcNow.Add(timeout);
        while (true)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var token = Guid.NewGuid().ToString("N");
            try
            {
                var stream = new FileStream(path, FileMode.CreateNew, FileAccess.ReadWrite, FileShare.Read, 4096,
                    FileOptions.Asynchronous | FileOptions.WriteThrough);
                var payload = Encoding.UTF8.GetBytes($"{token}|{Environment.MachineName}|{Environment.ProcessId}|{DateTimeOffset.UtcNow:O}");
                await stream.WriteAsync(payload, cancellationToken);
                await stream.FlushAsync(cancellationToken);
                return new FileLeaseHandle(path, token, stream, staleAfter);
            }
            catch (IOException)
            {
                TryQuarantineStaleLock(path, staleAfter);
                if (DateTimeOffset.UtcNow >= deadline) throw new TimeoutException($"Timed out acquiring distributed cache lock {Path.GetFileName(path)}.");
                await Task.Delay(50, cancellationToken);
            }
        }
    }

    private static void TryQuarantineStaleLock(string path, TimeSpan staleAfter)
    {
        try
        {
            if (!File.Exists(path) || DateTimeOffset.UtcNow - File.GetLastWriteTimeUtc(path) <= staleAfter) return;
            var stale = path + ".stale-" + Guid.NewGuid().ToString("N");
            File.Move(path, stale, false);
            File.Delete(stale);
        }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
    }

    private static async Task AtomicWriteAsync(string path, byte[] bytes, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var temp = path + $".{Guid.NewGuid():N}.tmp";
        try
        {
            await File.WriteAllBytesAsync(temp, bytes, cancellationToken);
            File.Move(temp, path, true);
        }
        finally { TryDeleteFile(temp); }
    }

    private static void Quarantine(string directory)
    {
        try
        {
            if (!Directory.Exists(directory)) return;
            var target = directory + $".corrupt-{DateTimeOffset.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid():N}";
            Directory.Move(directory, target);
        }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
    }

    private static void TryDeleteFile(string path)
    {
        try { if (File.Exists(path)) File.Delete(path); }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
    }

    private static void TryDeleteDirectory(string path)
    {
        try { if (Directory.Exists(path)) Directory.Delete(path, true); }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
    }

    private sealed record CacheManifest(
        string FingerprintVersion,
        string Fingerprint,
        Guid SourceRenderId,
        DateTimeOffset CreatedAt,
        DateTimeOffset LastAccessedAt,
        string FileName,
        string Extension,
        string ContentType,
        long Length,
        string Sha256,
        string? InvalidationToken,
        string ScopeGeneration,
        string? SecurityLabel = null,
        bool EncryptedAtRest = false,
        string? EncryptionNonce = null,
        string? EncryptionTag = null,
        string? PlaintextSha256 = null,
        long? PlaintextLength = null);

    private sealed record EncryptionResult(byte[] Content, string? Nonce, string? Tag);

    private static EncryptionResult Encrypt(byte[] content)
    {
        var key = CacheEncryptionKey();
        var nonce = RandomNumberGenerator.GetBytes(12);
        var tag = new byte[16];
        var ciphertext = new byte[content.Length];
        using var aes = new AesGcm(key, 16);
        aes.Encrypt(nonce, content, ciphertext, tag);
        return new EncryptionResult(ciphertext, Convert.ToBase64String(nonce), Convert.ToBase64String(tag));
    }

    private static byte[] Decrypt(byte[] content, string? nonceValue, string? tagValue)
    {
        if (nonceValue is null || tagValue is null) throw new CryptographicException("Cache encryption metadata is incomplete.");
        var plaintext = new byte[content.Length];
        using var aes = new AesGcm(CacheEncryptionKey(), 16);
        aes.Decrypt(Convert.FromBase64String(nonceValue), content, Convert.FromBase64String(tagValue), plaintext);
        return plaintext;
    }

    private static byte[] CacheEncryptionKey()
    {
        var value = Environment.GetEnvironmentVariable("RUNE_CACHE_ENCRYPTION_KEY");
        if (string.IsNullOrWhiteSpace(value)) throw new InvalidOperationException("RUNE_CACHE_ENCRYPTION_KEY is required for encrypted cache entries.");
        byte[] key;
        try { key = value.Length == 64 && value.All(char.IsAsciiHexDigit) ? Convert.FromHexString(value) : Convert.FromBase64String(value); }
        catch (FormatException exception) { throw new InvalidOperationException("RUNE_CACHE_ENCRYPTION_KEY must be 32-byte Base64 or 64-character hex.", exception); }
        return key.Length == 32 ? key : throw new InvalidOperationException("RUNE_CACHE_ENCRYPTION_KEY must contain exactly 32 bytes.");
    }
}

internal sealed class FileLeaseHandle : IAsyncDisposable
{
    private readonly string _path;
    private readonly string _token;
    private readonly FileStream _stream;
    private readonly Timer _heartbeat;

    public FileLeaseHandle(string path, string token, FileStream stream, TimeSpan staleAfter)
    {
        _path = path;
        _token = token;
        _stream = stream;
        var heartbeatInterval = TimeSpan.FromMilliseconds(Math.Max(500, staleAfter.TotalMilliseconds / 3));
        _heartbeat = new Timer(_ =>
        {
            try
            {
                if (!File.Exists(_path)) return;
                var value = File.ReadAllText(_path);
                if (value.StartsWith(_token + "|", StringComparison.Ordinal))
                    File.SetLastWriteTimeUtc(_path, DateTime.UtcNow);
            }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
        }, null, heartbeatInterval, heartbeatInterval);
    }

    public string Token => _token;

    public async ValueTask DisposeAsync()
    {
        await _heartbeat.DisposeAsync();
        await _stream.DisposeAsync();
        try
        {
            if (!File.Exists(_path)) return;
            var value = await File.ReadAllTextAsync(_path);
            if (value.StartsWith(_token + "|", StringComparison.Ordinal)) File.Delete(_path);
        }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
    }
}
