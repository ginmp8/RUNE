using Rune.Messaging.Nats;

namespace Rune.Messaging.Nats.Tests;

public sealed class NatsContractTests
{
    [Fact]
    public void Subjects_are_versioned_and_owned_by_transport()
    {
        var subjects = new[]
        {
            RuneNatsSubjects.Requested, RuneNatsSubjects.Started, RuneNatsSubjects.Progressed,
            RuneNatsSubjects.Completed, RuneNatsSubjects.Failed, RuneNatsSubjects.Cancelled,
            RuneNatsSubjects.DeadLettered
        };
        Assert.All(subjects, subject => Assert.EndsWith(".v1", subject));
        Assert.Equal(subjects.Length, subjects.Distinct(StringComparer.Ordinal).Count());
        Assert.Equal("RUNE_RENDER", RuneNatsSubjects.Stream);
        Assert.Equal("rune-render-worker-v1", RuneNatsSubjects.Consumer);
    }
}
