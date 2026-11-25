using System.Text.RegularExpressions;
using Rune.ReactFlow;

namespace Rune.Engine.Tests;

public sealed class ReactFlowTests
{
    [Fact]
    public void Rejects_executable_fields_and_external_urls()
    {
        const string source = """
        {"schemaVersion":"1.0","nodes":[{"id":"a","position":{"x":0,"y":0},"data":{"script":"alert(1)","url":"https://example.invalid"}}],"edges":[]}
        """;
        var result = ReactFlowDocumentParser.Parse(source);
        Assert.False(result.Ok);
        Assert.True(result.Diagnostics.Count(item => item.Code == "SECURITY_POLICY_VIOLATION") >= 2);
    }

    [Fact]
    public void Complex_examples_match_reference_inventory()
    {
        var root = FindRoot();
        var regex = new Regex("```(?:reactflow|react-flow|xyflow|flow-json)\\s*\\n(.*?)\\n```", RegexOptions.Singleline | RegexOptions.IgnoreCase);
        var totals = new[] { 0, 0, 0 };
        foreach (var file in Directory.EnumerateFiles(Path.Combine(root, "services", "rune", "examples", "reactflow"), "*.md"))
        {
            if (Path.GetFileName(file).StartsWith("README", StringComparison.OrdinalIgnoreCase)) continue;
            foreach (Match match in regex.Matches(File.ReadAllText(file)))
            {
                var parsed = ReactFlowDocumentParser.Parse(match.Groups[1].Value);
                Assert.True(parsed.Ok, string.Join("; ", parsed.Diagnostics.Select(item => item.Message)));
                totals[0]++;
                totals[1] += parsed.Document!["nodes"]!.AsArray().Count;
                totals[2] += parsed.Document!["edges"]!.AsArray().Count;
            }
        }
        Assert.Equal(new[] { 3, 72, 82 }, totals);
    }

    private static string FindRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            if (File.Exists(Path.Combine(current.FullName, "RUNE.slnx"))) return current.FullName;
            current = current.Parent;
        }
        throw new DirectoryNotFoundException();
    }
}
