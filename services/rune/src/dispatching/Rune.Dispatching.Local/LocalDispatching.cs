using System.Threading.Channels;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Rune.Application;
using Rune.Event.Contracts;
using Rune.Messaging.Abstractions;
using Rune.RenderProcessing;
using Rune.Storage.Abstractions;

namespace Rune.Dispatching.Local;

public enum RenderDispatcherProvider { Local, Nats }

public sealed record LocalDispatcherOptions(
    int Capacity = 64,
    int ProcessorCount = 1,
    TimeSpan? RetryDelay = null,
    bool RecoverQueuedJobsOnStartup = true,
    TimeSpan? ShutdownDrainTimeout = null)
{
    public TimeSpan EffectiveRetryDelay => RetryDelay ?? TimeSpan.FromSeconds(2);
    public TimeSpan EffectiveShutdownDrainTimeout => ShutdownDrainTimeout ?? TimeSpan.FromSeconds(30);

    public void Validate()
    {
        if (Capacity is < 1 or > 100_000) throw new InvalidOperationException("Local dispatcher capacity must be between 1 and 100000.");
        if (ProcessorCount is < 1 or > 128) throw new InvalidOperationException("Local dispatcher processor count must be between 1 and 128.");
        if (EffectiveRetryDelay < TimeSpan.Zero || EffectiveRetryDelay > TimeSpan.FromMinutes(10))
            throw new InvalidOperationException("Local dispatcher retry delay is outside the supported range.");
        if (EffectiveShutdownDrainTimeout < TimeSpan.Zero || EffectiveShutdownDrainTimeout > TimeSpan.FromMinutes(10))
            throw new InvalidOperationException("Local dispatcher shutdown drain timeout is outside the supported range.");
    }

    public static LocalDispatcherOptions FromConfiguration(IConfiguration configuration)
    {
        var section = configuration.GetSection("Rune:Dispatching:Local");
        var capacity = section.GetValue<int?>("Capacity") ?? configuration.GetValue<int?>("RUNE_LOCAL_DISPATCH_CAPACITY") ?? 64;
        var processors = section.GetValue<int?>("ProcessorCount") ?? configuration.GetValue<int?>("RUNE_LOCAL_DISPATCH_PROCESSORS") ?? 1;
        var retryDelay = section.GetValue<TimeSpan?>("RetryDelay") ?? TimeSpan.FromSeconds(2);
        var recovery = section.GetValue<bool?>("RecoverQueuedJobsOnStartup") ?? true;
        var drain = section.GetValue<TimeSpan?>("ShutdownDrainTimeout") ?? TimeSpan.FromSeconds(30);
        var options = new LocalDispatcherOptions(capacity, processors, retryDelay, recovery, drain);
        options.Validate();
        return options;
    }
}

public static class RenderDispatcherProviderParser
{
    public static RenderDispatcherProvider Parse(IConfiguration configuration)
    {
        var value = configuration["Rune:Dispatching:Provider"] ?? configuration["RUNE_DISPATCH_PROVIDER"] ?? "local";
        if (Enum.TryParse<RenderDispatcherProvider>(value, true, out var provider)) return provider;
        throw new InvalidOperationException($"Unsupported render dispatcher provider '{value}'. Expected 'local' or 'nats'.");
    }
}

public sealed class LocalRenderDispatcher : IRenderCommandPublisher, IRenderCommandConsumer
{
    private readonly Channel<RenderRequested> _channel;
    private readonly TimeSpan _retryDelay;
    private int _depth;

    public LocalRenderDispatcher(LocalDispatcherOptions options)
    {
        options.Validate();
        Capacity = options.Capacity;
        _retryDelay = options.EffectiveRetryDelay;
        _channel = Channel.CreateBounded<RenderRequested>(new BoundedChannelOptions(options.Capacity)
        {
            FullMode = BoundedChannelFullMode.Wait,
            SingleWriter = false,
            SingleReader = options.ProcessorCount == 1,
            AllowSynchronousContinuations = false
        });
    }

    public int Capacity { get; }
    public int Depth => Volatile.Read(ref _depth);
    public bool AcceptingWrites { get; private set; } = true;

    public async ValueTask PublishAsync(RenderRequested command, CancellationToken cancellationToken = default)
    {
        if (!AcceptingWrites) throw new InvalidOperationException("The local dispatcher is stopping and no longer accepts writes.");
        await _channel.Writer.WriteAsync(command, cancellationToken);
        Interlocked.Increment(ref _depth);
    }

    public async Task RunAsync(Func<RenderRequested, CancellationToken, Task<RenderCommandResult>> handler, CancellationToken cancellationToken)
    {
        await foreach (var command in _channel.Reader.ReadAllAsync(cancellationToken))
        {
            Interlocked.Decrement(ref _depth);
            var result = await handler(command, cancellationToken);
            if (result.Disposition == RenderCommandDisposition.Retry && AcceptingWrites)
            {
                if (_retryDelay > TimeSpan.Zero) await Task.Delay(_retryDelay, cancellationToken);
                if (AcceptingWrites) await PublishAsync(command, cancellationToken);
            }
        }
    }

    public void StopAcceptingWrites()
    {
        AcceptingWrites = false;
        _channel.Writer.TryComplete();
    }
}

public sealed class LocalRenderLifecyclePublisher(ILogger<LocalRenderLifecyclePublisher> logger) : IRenderLifecyclePublisher
{
    public ValueTask PublishAsync<TRenderEvent>(TRenderEvent message, CancellationToken cancellationToken = default)
        where TRenderEvent : IRenderEvent
    {
        logger.LogDebug("Local lifecycle event {EventType} for render {RenderId}", typeof(TRenderEvent).Name, message.RenderId);
        return ValueTask.CompletedTask;
    }
}

public sealed class LocalDispatcherState
{
    private int _activeCommands;

    public bool ProcessingStarted { get; set; }
    public bool RecoveryCompleted { get; set; }
    public int RecoveredJobs { get; set; }
    public int ActiveCommands => Volatile.Read(ref _activeCommands);
    public bool DrainTimedOut { get; set; }

    internal void CommandStarted() => Interlocked.Increment(ref _activeCommands);
    internal void CommandFinished() => Interlocked.Decrement(ref _activeCommands);
}

public sealed class LocalRenderDispatcherService(
    LocalRenderDispatcher dispatcher,
    IServiceScopeFactory scopeFactory,
    LocalDispatcherOptions options,
    LocalDispatcherState state,
    TimeProvider timeProvider,
    ILogger<LocalRenderDispatcherService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        state.ProcessingStarted = true;
        var processors = Enumerable.Range(0, options.ProcessorCount)
            .Select(_ => dispatcher.RunAsync(ProcessAsync, stoppingToken));
        await Task.WhenAll(processors);
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        dispatcher.StopAcceptingWrites();
        var deadline = timeProvider.GetUtcNow() + options.EffectiveShutdownDrainTimeout;
        while ((dispatcher.Depth > 0 || state.ActiveCommands > 0) &&
               timeProvider.GetUtcNow() < deadline &&
               !cancellationToken.IsCancellationRequested)
        {
            await Task.Delay(TimeSpan.FromMilliseconds(20), timeProvider, cancellationToken);
        }

        state.DrainTimedOut = dispatcher.Depth > 0 || state.ActiveCommands > 0;
        if (state.DrainTimedOut)
        {
            logger.LogWarning(
                "Local dispatcher shutdown drain timed out with {QueueDepth} queued and {ActiveCommands} active commands; persisted jobs remain recoverable",
                dispatcher.Depth,
                state.ActiveCommands);
        }

        await base.StopAsync(cancellationToken);
    }

    private async Task<RenderCommandResult> ProcessAsync(RenderRequested command, CancellationToken cancellationToken)
    {
        state.CommandStarted();
        try
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var processor = scope.ServiceProvider.GetRequiredService<IRenderJobProcessor>();
            var outcome = await processor.ProcessAsync(command, cancellationToken);
            logger.LogInformation("Local render {RenderId} completed with {Outcome}", command.RenderId, outcome);
            if (outcome == RenderProcessOutcome.Terminate)
            {
                var jobs = scope.ServiceProvider.GetRequiredService<IRenderJobStore>();
                var events = scope.ServiceProvider.GetRequiredService<IRenderLifecyclePublisher>();
                var job = await jobs.GetAsync(command.RenderId, cancellationToken);
                var reason = job?.Error ?? "Render processing terminated without a retryable outcome.";
                var attempt = job?.Attempt ?? 0;
                var deadLetteredAt = timeProvider.GetUtcNow();
                await jobs.MarkDeadLetteredAsync(command.RenderId, attempt, reason, deadLetteredAt, cancellationToken);
                var metadata = new EventMetadata(
                    RuneTelemetry.DeterministicEventId(command.RenderId, "dead-lettered", attempt),
                    command.RenderId,
                    command.Metadata.EventId,
                    "1.0",
                    deadLetteredAt,
                    command.Metadata.Headers);
                await events.PublishAsync(new RenderDeadLettered(metadata, command.RenderId, attempt, reason, deadLetteredAt), cancellationToken);
                RuneTelemetry.DeadLettered.Add(1);
                return new RenderCommandResult(RenderCommandDisposition.Terminate, reason, attempt);
            }
            return new RenderCommandResult(
                outcome == RenderProcessOutcome.Acknowledge ? RenderCommandDisposition.Acknowledge : RenderCommandDisposition.Retry,
                Attempt: 0);
        }
        finally
        {
            state.CommandFinished();
        }
    }
}

public sealed class LocalQueuedJobRecoveryService(
    IRenderJobStore jobs,
    RenderCommandOutbox outbox,
    LocalDispatcherOptions options,
    LocalDispatcherState state,
    TimeProvider timeProvider,
    ILogger<LocalQueuedJobRecoveryService> logger) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        if (!options.RecoverQueuedJobsOnStartup)
        {
            state.RecoveryCompleted = true;
            return;
        }
        var count = 0;
        await foreach (var job in jobs.ListRecoverableAsync(timeProvider.GetUtcNow(), cancellationToken))
        {
            if (job.Status != Rune.Job.Contracts.RenderJobStatus.Queued)
            {
                if (!await jobs.RequeueAsync(job.Id, false, cancellationToken)) continue;
            }
            else if (job.DispatchStatus == Rune.Job.Contracts.RenderDispatchStatus.Published)
            {
                if (!await jobs.ScheduleDispatchAsync(job.Id, newGeneration: true, job.DispatchHeaders, cancellationToken)) continue;
            }
            if (await outbox.PublishAsync(job.Id, cancellationToken)) count++;
        }
        state.RecoveredJobs = count;
        state.RecoveryCompleted = true;
        logger.LogInformation("Recovered {Count} queued local render jobs", count);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}

public sealed class LocalDispatcherHealthCheck(
    LocalRenderDispatcher dispatcher,
    LocalDispatcherState state,
    LocalDispatcherOptions options) : IHealthCheck
{
    public Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        var data = new Dictionary<string, object>
        {
            ["provider"] = "local",
            ["capacity"] = options.Capacity,
            ["depth"] = dispatcher.Depth,
            ["activeCommands"] = state.ActiveCommands,
            ["processorCount"] = options.ProcessorCount,
            ["startupRecovery"] = options.RecoverQueuedJobsOnStartup,
            ["recoveryCompleted"] = state.RecoveryCompleted,
            ["recoveredJobs"] = state.RecoveredJobs,
            ["drainTimedOut"] = state.DrainTimedOut
        };
        return Task.FromResult(state.ProcessingStarted && state.RecoveryCompleted
            ? HealthCheckResult.Healthy("Local dispatcher is ready.", data)
            : HealthCheckResult.Degraded("Local dispatcher is starting.", data: data));
    }
}

public static class LocalDispatchingRegistration
{
    public static IServiceCollection AddLocalRenderDispatching(this IServiceCollection services, IConfiguration configuration)
    {
        var options = LocalDispatcherOptions.FromConfiguration(configuration);
        services.AddSingleton(options);
        services.AddSingleton<LocalDispatcherState>();
        services.AddSingleton<LocalRenderDispatcher>();
        services.AddSingleton<IRenderCommandPublisher>(sp => sp.GetRequiredService<LocalRenderDispatcher>());
        services.AddSingleton<IRenderCommandConsumer>(sp => sp.GetRequiredService<LocalRenderDispatcher>());
        services.AddSingleton<IRenderLifecyclePublisher, LocalRenderLifecyclePublisher>();
        services.AddSingleton(TimeProvider.System);
        // Start consumers before recovery so a recovery set larger than the bounded
        // channel capacity cannot block host startup.
        services.AddHostedService<LocalRenderDispatcherService>();
        services.AddHostedService<LocalQueuedJobRecoveryService>();
        services.AddHealthChecks().AddCheck<LocalDispatcherHealthCheck>("local-dispatcher");
        return services;
    }
}
