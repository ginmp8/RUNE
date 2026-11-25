using Rune.Core;
using Rune.Rendering;

namespace Rune.Engine.Tests;

public sealed class PageDecorationAdvancedTests
{
    [Fact]
    public void Resolves_physical_page_range_named_section_parity_and_priority()
    {
        var options = new PageDecorationOptions(
            Default: new PageDecorationTemplate("default"),
            First: new PageDecorationTemplate("first"),
            Left: new PageDecorationTemplate("left"),
            Right: new PageDecorationTemplate("right"),
            Rules: [
                new PageDecorationRule("section", new PageDecorationSelector(NamedSections: ["Financials"]), new PageDecorationTemplate("section"), 10),
                new PageDecorationRule("range-left", new PageDecorationSelector(PhysicalPageRanges: [new PhysicalPageRange(2, 8)], Parity: PageDecorationParity.Left), new PageDecorationTemplate("range-left"), 20),
                new PageDecorationRule("exact", new PageDecorationSelector(PhysicalPages: [4], NamedSections: ["Financials"]), new PageDecorationTemplate("exact"), 20)
            ], TwoPassPdfComposition: true);
        Assert.Equal("first", PageDecorationRuleResolver.Resolve(options, 1).Source);
        Assert.Equal("range-left", PageDecorationRuleResolver.Resolve(options, 2, "Other").Source);
        Assert.Equal("exact", PageDecorationRuleResolver.Resolve(options, 4, "Financials").Source);
        Assert.Equal("section", PageDecorationRuleResolver.Resolve(options, 5, "Financials").Source);
        Assert.Equal("right", PageDecorationRuleResolver.Resolve(options, 9, "Other").Source);
    }

    [Fact]
    public void Requires_two_pass_for_physical_or_named_rules_and_validates_ranges()
    {
        var rules = new[] { new PageDecorationRule("page-two", new PageDecorationSelector(PhysicalPages: [2]), new PageDecorationTemplate("two")) };
        var automatic = new RenderOptions(PageDecorations: new PageDecorationOptions(Rules: rules));
        Assert.True(PageDecorationCompiler.BuildPlan(automatic, new Dictionary<string, object?>()).RequiresTwoPass);
        Assert.Equal(string.Empty, PageDecorationCompiler.Compile(automatic, new Dictionary<string, object?>()));
        Assert.Throws<ArgumentException>(() => PageDecorationRuleResolver.ValidateRules([
            new PageDecorationRule("bad", new PageDecorationSelector(PhysicalPageRanges: [new PhysicalPageRange(5, 2)]), new PageDecorationTemplate("bad"))
        ]));
    }
}
