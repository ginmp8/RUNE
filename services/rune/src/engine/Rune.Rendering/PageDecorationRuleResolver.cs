using Rune.Core;

namespace Rune.Rendering;

public sealed record ResolvedPageDecoration(string Source, PageDecorationTemplate? Template, int Priority);

public static class PageDecorationRuleResolver
{
    public static ResolvedPageDecoration Resolve(PageDecorationOptions? options, int physicalPage, string? namedSection = null)
    {
        if (physicalPage < 1) throw new ArgumentOutOfRangeException(nameof(physicalPage), "Physical page numbers start at 1.");
        if (options is null) return new ResolvedPageDecoration("none", null, int.MinValue);
        ValidateRules(options.Rules);
        var matches = (options.Rules ?? [])
            .Where(rule => Matches(rule.Selector, physicalPage, namedSection))
            .Select(rule => new { Rule = rule, Specificity = Specificity(rule.Selector) })
            .OrderByDescending(item => item.Rule.Priority)
            .ThenByDescending(item => item.Specificity)
            .ThenBy(item => item.Rule.Name, StringComparer.Ordinal)
            .ToArray();
        if (matches.Length > 0)
        {
            if (options.RejectConflicts && matches.Length > 1 && matches[0].Rule.Priority == matches[1].Rule.Priority && matches[0].Specificity == matches[1].Specificity)
                throw new ArgumentException($"Page decoration rules '{matches[0].Rule.Name}' and '{matches[1].Rule.Name}' are ambiguous for physical page {physicalPage}.");
            return new ResolvedPageDecoration(matches[0].Rule.Name, matches[0].Rule.Template, matches[0].Rule.Priority);
        }
        if (physicalPage == 1 && options.Cover is not null) return new ResolvedPageDecoration("cover", options.Cover, 0);
        if (physicalPage == 1 && options.First is not null) return new ResolvedPageDecoration("first", options.First, 0);
        if (physicalPage % 2 == 0 && options.Left is not null) return new ResolvedPageDecoration("left", options.Left, 0);
        if (physicalPage % 2 == 1 && options.Right is not null) return new ResolvedPageDecoration("right", options.Right, 0);
        return new ResolvedPageDecoration("default", options.Default, 0);
    }

    public static void ValidateRules(IReadOnlyList<PageDecorationRule>? rules)
    {
        if (rules is null) return;
        if (rules.Count > 500) throw new ArgumentException("A maximum of 500 page decoration rules is supported.");
        var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var rule in rules)
        {
            if (string.IsNullOrWhiteSpace(rule.Name) || rule.Name.Length > 120 || !names.Add(rule.Name))
                throw new ArgumentException("Page decoration rule names must be unique and contain between 1 and 120 characters.");
            if (rule.Priority is < -10_000 or > 10_000)
                throw new ArgumentException($"Page decoration rule '{rule.Name}' priority is outside -10000 through 10000.");
            var selector = rule.Selector;
            if ((selector.PhysicalPages?.Count ?? 0) == 0 && (selector.PhysicalPageRanges?.Count ?? 0) == 0 &&
                (selector.NamedSections?.Count ?? 0) == 0 && selector.Parity == PageDecorationParity.Any && !selector.Cover && !selector.First)
                throw new ArgumentException($"Page decoration rule '{rule.Name}' has an empty selector.");
            if (selector.Cover && selector.First)
                throw new ArgumentException($"Page decoration rule '{rule.Name}' cannot select both cover and first.");
            if (selector.PhysicalPages?.Any(page => page < 1 || page > 100_000) == true)
                throw new ArgumentException($"Page decoration rule '{rule.Name}' contains an invalid physical page.");
            if (selector.PhysicalPages?.Distinct().Count() != selector.PhysicalPages?.Count)
                throw new ArgumentException($"Page decoration rule '{rule.Name}' contains duplicate physical pages.");
            if (selector.PhysicalPageRanges?.Any(range => range.Start < 1 || range.End < range.Start || range.End > 100_000) == true)
                throw new ArgumentException($"Page decoration rule '{rule.Name}' contains an invalid page range.");
            if (selector.NamedSections?.Any(section => string.IsNullOrWhiteSpace(section) || section.Length > 160) == true)
                throw new ArgumentException($"Page decoration rule '{rule.Name}' contains an invalid named section.");
        }
    }

    private static bool Matches(PageDecorationSelector selector, int physicalPage, string? namedSection)
    {
        if (selector.Cover && physicalPage != 1) return false;
        if (selector.First && physicalPage != 1) return false;
        if (selector.Parity == PageDecorationParity.Left && physicalPage % 2 != 0) return false;
        if (selector.Parity == PageDecorationParity.Right && physicalPage % 2 == 0) return false;
        var hasPageConstraint = (selector.PhysicalPages?.Count ?? 0) > 0 || (selector.PhysicalPageRanges?.Count ?? 0) > 0;
        if (hasPageConstraint)
        {
            var pageMatch = selector.PhysicalPages?.Contains(physicalPage) == true ||
                selector.PhysicalPageRanges?.Any(range => physicalPage >= range.Start && physicalPage <= range.End) == true;
            if (!pageMatch) return false;
        }
        if ((selector.NamedSections?.Count ?? 0) > 0)
        {
            if (string.IsNullOrWhiteSpace(namedSection) || !selector.NamedSections!.Contains(namedSection, StringComparer.OrdinalIgnoreCase)) return false;
        }
        return true;
    }

    private static int Specificity(PageDecorationSelector selector) =>
        (selector.PhysicalPages?.Count > 0 ? 64 : 0) +
        (selector.PhysicalPageRanges?.Count > 0 ? 32 : 0) +
        (selector.NamedSections?.Count > 0 ? 16 : 0) +
        (selector.Cover ? 8 : 0) +
        (selector.First ? 4 : 0) +
        (selector.Parity != PageDecorationParity.Any ? 2 : 0);
}
