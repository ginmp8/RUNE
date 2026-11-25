using System.Text.Json;
using Rune.Core;
using Xunit;
using Rune.Pdf;

namespace Rune.Pdf.Tests;

public sealed class NativePdfCorpusTests
{
    [Fact]
    public void Retained_corpus_matches_declared_native_fallback_and_reject_outcomes()
    {
        var corpusRoot = Path.Combine(FindRepositoryRoot(), "services", "rune", "tests", "fixtures", "pdf-native");
        using var manifest = JsonDocument.Parse(File.ReadAllText(Path.Combine(corpusRoot, "corpus.json")));
        foreach (var item in manifest.RootElement.GetProperty("cases").EnumerateArray())
        {
            var fileName = item.GetProperty("file").GetString()!;
            var expectedOutcome = item.GetProperty("expectedOutcome").GetString()!;
            var expectedReason = item.GetProperty("expectedReason").ValueKind == JsonValueKind.Null
                ? null
                : item.GetProperty("expectedReason").GetString();
            var content = File.ReadAllBytes(Path.Combine(corpusRoot, fileName));
            var options = new PdfImportOptions(Mode: PdfImportMode.NativePage);

            if (expectedOutcome == "reject")
            {
                var exception = Assert.Throws<PdfImportException>(() =>
                    NativePdfImportPlanner.Plan(content, $"corpus/{fileName}", options));
                Assert.Equal(expectedReason, exception.Code);
                continue;
            }

            var plan = NativePdfImportPlanner.Plan(content, $"corpus/{fileName}", options);
            Assert.Equal(expectedOutcome == "native-page" ? PdfImportMode.NativePage : PdfImportMode.Visual, plan.AppliedMode);
            Assert.Equal(expectedReason, plan.FallbackReason);
            if (plan.AppliedMode == PdfImportMode.NativePage)
            {
                Assert.NotEmpty(plan.Pages);
                Assert.All(plan.Pages, page => Assert.True(page.WidthPoints > 0 && page.HeightPoints > 0));
            }
        }
    }

    private static string FindRepositoryRoot()
    {
        DirectoryInfo? current = new(AppContext.BaseDirectory);
        while (current is not null)
        {
            if (File.Exists(Path.Combine(current.FullName, "RUNE.slnx"))) return current.FullName;
            current = current.Parent;
        }
        throw new DirectoryNotFoundException("RUNE repository root was not found.");
    }
}
