using Xunit;
using System.Collections.Concurrent;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Rune.Application;
using Rune.Core;
using Rune.Event.Contracts;
using Rune.Job.Contracts;
using Rune.Jobs;
using Rune.Messaging.Abstractions;
using Rune.RenderProcessing;
using Rune.Storage.Abstractions;

namespace Rune.Dispatching.Local.Tests;

public sealed class LocalDispatcherTests
{
    [Fact]
    public void Provider_defaults_to_local_and_allows_explicit_nats_selection()
    {
        var defaults = new ConfigurationBuilder().Build();
        var local = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["RUNE_DISPATCH_PROVIDER"] = "local" }).Build();
        var nats = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["RUNE_DISPATCH_PROVIDER"] = "nats" }).Build();
        var invalid = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["RUNE_DISPATCH_PROVIDER"] = "fallback" }).Build();
        Assert.Equal(RenderDispatcherProvider.Local, RenderDispatcherProviderParser.Parse(defaults));
        Assert.Equal(RenderDispatcherProvider.Local, RenderDispatcherProviderParser.Parse(local));
        Assert.Equal(RenderDispatcherProvider.Nats, RenderDispatcherProviderParser.Parse(nats));
        Assert.Throws<InvalidOperationException>(() => RenderDispatcherProviderParser.Parse(invalid));
    }

    [Fact]
    public void Invalid_local_dispatcher_options_fail_fast()
    {
        Assert.Throws<InvalidOperationException>(() => new LocalDispatcherOptions(Capacity: 0).Validate());
        Assert.Throws<InvalidOperationException>(() => new LocalDispatcherOptions(ProcessorCount: 0).Validate());
        Assert.Throws<InvalidOperationException>(() => new LocalDispatcherOptions(RetryDelay: TimeSpan.FromMinutes(11)).Validate());
    }

    [Fact]
    public async Task Bounded_queue_applies_cancellable_backpressure()
    {
        var dispatcher = new LocalRenderDispatcher(new LocalDispatcherOptions(Capacity: 1, RetryDelay: TimeSpan.Zero));
        await dispatcher.PublishAsync(Command(Guid.NewGuid()));
        using var cancellation = new CancellationTokenSource(TimeSpan.FromMilliseconds(100));
        await Assert.ThrowsAnyAsync<OperationCanceledException>(async () => await dispatcher.PublishAsync(Command(Guid.NewGuid()), cancellation.Token));
        Assert.Equal(1, dispatcher.Depth);
    }

    [Fact]
    public async Task Retry_outcome_requeues_without_losing_command()
    {
        var dispatcher = new LocalRenderDispatcher(new LocalDispatcherOptions(Capacity: 2, RetryDelay: TimeSpan.Zero));
        using var cancellation = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        var calls = 0;
        var runner = dispatcher.RunAsync((_, _) =>
        {
            calls++;
            if (calls == 2) cancellation.Cancel();
            return Task.FromResult(new RenderCommandResult(calls >= 2 ? RenderCommandDisposition.Acknowledge : RenderCommandDisposition.Retry));
        }, cancellation.Token);
        await dispatcher.PublishAsync(Command(Guid.NewGuid()), cancellation.Token);
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => runner);
        Assert.Equal(2, calls);
    }

    [Fact]
    public async Task Startup_recovery_republishes_queued_jobs()
    {
        using var directory = new TemporaryDirectory();
        IRenderJobStore store = new FileSystemRenderJobStore(directory.Path);
        var job = await new RenderJobService(store).CreateAsync("<html></html>", RenderOutputFormat.StaticHtml,
            new RenderOptions(), null, null);
        var publisher = new CapturingPublisher();
        var state = new LocalDispatcherState();
        var service = new LocalQueuedJobRecoveryService(store, new RenderCommandOutbox(store, publisher),
            new LocalDispatcherOptions(RecoverQueuedJobsOnStartup: true), state, TimeProvider.System,
            NullLogger<LocalQueuedJobRecoveryService>.Instance);

        await service.StartAsync(CancellationToken.None);

        var command = Assert.Single(publisher.Commands);
        Assert.Equal(job.Id, command.RenderId);
        Assert.True(state.RecoveryCompleted);
        Assert.Equal(1, state.RecoveredJobs);
    }

    [Fact]
    public async Task Startup_recovery_requeues_an_expired_claim()
    {
        using var directory = new TemporaryDirectory();
        IRenderJobStore store = new FileSystemRenderJobStore(directory.Path);
        var job = await new RenderJobService(store).CreateAsync("<html></html>", RenderOutputFormat.StaticHtml,
            new RenderOptions(), null, null);
        Assert.True(await store.TryClaimAsync(job.Id, "interrupted-worker", TimeSpan.Zero));
        var publisher = new CapturingPublisher();
        var state = new LocalDispatcherState();
        var service = new LocalQueuedJobRecoveryService(store, new RenderCommandOutbox(store, publisher),
            new LocalDispatcherOptions(RecoverQueuedJobsOnStartup: true), state, TimeProvider.System,
            NullLogger<LocalQueuedJobRecoveryService>.Instance);

        await service.StartAsync(CancellationToken.None);

        Assert.Equal(job.Id, Assert.Single(publisher.Commands).RenderId);
        var recovered = await store.GetAsync(job.Id);
        Assert.NotNull(recovered);
        Assert.Equal(RenderJobStatus.Queued, recovered.Status);
        Assert.Null(recovered.ClaimedBy);
        Assert.Null(recovered.LeaseExpiresAt);
    }

    [Fact]
    public async Task Health_check_exposes_bounded_queue_and_recovery_state()
    {
        var options = new LocalDispatcherOptions(Capacity: 3, ProcessorCount: 2);
        var dispatcher = new LocalRenderDispatcher(options);
        var state = new LocalDispatcherState
        {
            ProcessingStarted = true,
            RecoveryCompleted = true,
            RecoveredJobs = 4
        };
        await dispatcher.PublishAsync(Command(Guid.NewGuid()));
        var result = await new LocalDispatcherHealthCheck(dispatcher, state, options)
            .CheckHealthAsync(new Microsoft.Extensions.Diagnostics.HealthChecks.HealthCheckContext());

        Assert.Equal(Microsoft.Extensions.Diagnostics.HealthChecks.HealthStatus.Healthy, result.Status);
        Assert.Equal("local", result.Data["provider"]);
        Assert.Equal(3, result.Data["capacity"]);
        Assert.Equal(1, result.Data["depth"]);
        Assert.Equal(2, result.Data["processorCount"]);
        Assert.Equal(4, result.Data["recoveredJobs"]);
    }

    [Fact]
    public async Task Each_command_uses_a_new_dependency_injection_scope()
    {
        ScopedProcessor.InstanceIds.Clear();
        var services = new ServiceCollection();
        services.AddScoped<IRenderJobProcessor, ScopedProcessor>();
        await using var provider = services.BuildServiceProvider();
        var dispatcher = new LocalRenderDispatcher(new LocalDispatcherOptions(Capacity: 4, ProcessorCount: 1, RetryDelay: TimeSpan.Zero));
        var service = new LocalRenderDispatcherService(dispatcher, provider.GetRequiredService<IServiceScopeFactory>(),
            new LocalDispatcherOptions(Capacity: 4, ProcessorCount: 1, RetryDelay: TimeSpan.Zero), new LocalDispatcherState(),
            TimeProvider.System, NullLogger<LocalRenderDispatcherService>.Instance);
        await service.StartAsync(CancellationToken.None);
        await dispatcher.PublishAsync(Command(Guid.NewGuid()));
        await dispatcher.PublishAsync(Command(Guid.NewGuid()));
        await WaitUntilAsync(() => ScopedProcessor.InstanceIds.Count == 2);
        dispatcher.StopAcceptingWrites();
        await service.StopAsync(CancellationToken.None);
        Assert.Equal(2, ScopedProcessor.InstanceIds.Distinct().Count());
    }


    [Fact]
    public async Task Graceful_shutdown_drains_queued_commands_within_timeout()
    {
        DrainingProcessor.Processed = 0;
        var services = new ServiceCollection();
        services.AddScoped<IRenderJobProcessor, DrainingProcessor>();
        await using var provider = services.BuildServiceProvider();
        var options = new LocalDispatcherOptions(
            Capacity: 4,
            ProcessorCount: 1,
            RetryDelay: TimeSpan.Zero,
            ShutdownDrainTimeout: TimeSpan.FromSeconds(2));
        var dispatcher = new LocalRenderDispatcher(options);
        var state = new LocalDispatcherState();
        var service = new LocalRenderDispatcherService(
            dispatcher,
            provider.GetRequiredService<IServiceScopeFactory>(),
            options,
            state,
            TimeProvider.System,
            NullLogger<LocalRenderDispatcherService>.Instance);

        await service.StartAsync(CancellationToken.None);
        await dispatcher.PublishAsync(Command(Guid.NewGuid()));
        await dispatcher.PublishAsync(Command(Guid.NewGuid()));
        await service.StopAsync(CancellationToken.None);

        Assert.Equal(2, DrainingProcessor.Processed);
        Assert.Equal(0, dispatcher.Depth);
        Assert.Equal(0, state.ActiveCommands);
        Assert.False(state.DrainTimedOut);
        Assert.False(dispatcher.AcceptingWrites);
    }

    private static RenderRequested Command(Guid id) => new(new EventMetadata(Guid.NewGuid(), id, null, "1.0", DateTimeOffset.UtcNow), id, $"{id:N}/package.json");

    private static async Task WaitUntilAsync(Func<bool> condition)
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        while (!condition()) await Task.Delay(20, timeout.Token);
    }

    private sealed class CapturingPublisher : IRenderCommandPublisher
    {
        public List<RenderRequested> Commands { get; } = [];
        public ValueTask PublishAsync(RenderRequested command, CancellationToken cancellationToken = default)
        {
            Commands.Add(command);
            return ValueTask.CompletedTask;
        }
    }

    private sealed class DrainingProcessor : IRenderJobProcessor
    {
        public static int Processed;

        public async Task<RenderProcessOutcome> ProcessAsync(RenderRequested command, CancellationToken cancellationToken = default)
        {
            await Task.Delay(50, cancellationToken);
            Interlocked.Increment(ref Processed);
            return RenderProcessOutcome.Acknowledge;
        }
    }

    private sealed class ScopedProcessor : IRenderJobProcessor
    {
        public static ConcurrentBag<Guid> InstanceIds { get; } = [];
        private readonly Guid _id = Guid.NewGuid();
        public Task<RenderProcessOutcome> ProcessAsync(RenderRequested command, CancellationToken cancellationToken = default)
        {
            InstanceIds.Add(_id);
            return Task.FromResult(RenderProcessOutcome.Acknowledge);
        }
    }

    private sealed class TemporaryDirectory : IDisposable
    {
        public TemporaryDirectory() { Path = System.IO.Path.Combine(System.IO.Path.GetTempPath(), $"rune-local-{Guid.NewGuid():N}"); Directory.CreateDirectory(Path); }
        public string Path { get; }
        public void Dispose() { if (Directory.Exists(Path)) Directory.Delete(Path, true); }
    }
}
