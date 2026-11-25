namespace Rune.Core;

public enum PageDecorationAlignment
{
    Left,
    Center,
    Right
}

public enum PageDecorationContentFormat
{
    Text,
    Markdown,
    Html
}

public enum PageDecorationOverflowPolicy
{
    Error,
    Scale,
    Clip
}

public enum PageDecorationCapabilityClass
{
    Direct,
    PreRender,
    Rejected
}

public sealed record PageDecorationRegion(
    string Content,
    PageDecorationContentFormat Format = PageDecorationContentFormat.Text,
    PageDecorationAlignment Alignment = PageDecorationAlignment.Center,
    PageDecorationOverflowPolicy OverflowPolicy = PageDecorationOverflowPolicy.Error,
    double MinimumScale = 0.8,
    string? MaximumHeight = null,
    IReadOnlyList<string>? AllowedMetadataTokens = null,
    bool SanitizeSvg = true,
    string? AlternativeText = null,
    PageDecorationCapabilityClass? RequiredCapability = null);

public sealed record PageDecorationTemplate(
    string? Header = null,
    string? Footer = null,
    PageDecorationAlignment HeaderAlignment = PageDecorationAlignment.Center,
    PageDecorationAlignment FooterAlignment = PageDecorationAlignment.Center,
    PageDecorationRegion? HeaderRegion = null,
    PageDecorationRegion? FooterRegion = null);

public sealed record PageDecorationOptions(
    PageDecorationTemplate? Default = null,
    PageDecorationTemplate? First = null,
    PageDecorationTemplate? Left = null,
    PageDecorationTemplate? Right = null,
    PageDecorationTemplate? Cover = null,
    IReadOnlyList<PageDecorationRule>? Rules = null,
    bool TwoPassPdfComposition = false,
    bool RejectConflicts = true,
    bool ValidateReservedMargins = true,
    bool ValidateFinalPdfA = true,
    bool PreserveTaggedPdf = true,
    string AuthoringConflictPolicy = "reject",
    bool EmitPlanArtifact = true);


public enum PageDecorationParity
{
    Any,
    Left,
    Right
}

public sealed record PhysicalPageRange(int Start, int End);

public sealed record PageDecorationSelector(
    IReadOnlyList<int>? PhysicalPages = null,
    IReadOnlyList<PhysicalPageRange>? PhysicalPageRanges = null,
    IReadOnlyList<string>? NamedSections = null,
    PageDecorationParity Parity = PageDecorationParity.Any,
    bool Cover = false,
    bool First = false);

public sealed record PageDecorationRule(
    string Name,
    PageDecorationSelector Selector,
    PageDecorationTemplate Template,
    int Priority = 0);
