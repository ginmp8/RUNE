using System.Net;
using System.Text.RegularExpressions;
using Rune.Core;
using Rune.Security;

namespace Rune.Html;

public sealed partial class HtmlDocumentCompiler : IDocumentCompiler
{
    private readonly HtmlContentSanitizer _sanitizer = new();

    public DocumentSourceType SourceType => DocumentSourceType.Html;

    public ValueTask<CompiledDocument> CompileAsync(SourceDocument source, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var diagnostics = new List<RenderDiagnostic>();
        var metadata = source.Metadata is null
            ? new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
            : new Dictionary<string, object?>(source.Metadata, StringComparer.OrdinalIgnoreCase);

        var original = source.Content;
        var title = TitleRegex().Match(original);
        if (title.Success && !metadata.ContainsKey("title"))
            metadata["title"] = WebUtility.HtmlDecode(StripTagsRegex().Replace(title.Groups[1].Value, string.Empty)).Trim();

        string bodyHtml;
        string headHtml;
        if (source.HtmlTrustMode == HtmlTrustMode.Trusted)
        {
            var head = HeadRegex().Match(original);
            headHtml = head.Success ? TitleRegex().Replace(head.Groups[1].Value, string.Empty) : string.Empty;
            var body = BodyRegex().Match(original);
            bodyHtml = body.Success ? body.Groups[1].Value : original;
        }
        else
        {
            var body = BodyRegex().Match(original);
            var candidate = body.Success ? body.Groups[1].Value : original;
            bodyHtml = _sanitizer.Apply(candidate, HtmlTrustMode.Safe);
            headHtml = string.Empty;
            if (!string.Equals(bodyHtml, candidate, StringComparison.Ordinal))
                diagnostics.Add(new("html.sanitized", "Unsafe HTML elements or attributes were removed.", RenderDiagnosticSeverity.Info));
        }

        var renderers = DetectRenderers(bodyHtml);
        var documentTitle = metadata.TryGetValue("title", out var value)
            ? Convert.ToString(value, System.Globalization.CultureInfo.InvariantCulture) ?? "RUNE Document"
            : "RUNE Document";
        var model = RuneDocumentModelBuilder.FromCompiled(DocumentSourceType.Html, documentTitle,
            metadata, bodyHtml, renderers, diagnostics);
        return ValueTask.FromResult(new CompiledDocument(
            bodyHtml,
            metadata,
            renderers,
            diagnostics,
            headHtml,
            model));
    }

    private static HashSet<string> DetectRenderers(string html)
    {
        var result = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (html.Contains("mermaid", StringComparison.OrdinalIgnoreCase)) result.Add("mermaid");
        if (html.Contains("rune-math", StringComparison.OrdinalIgnoreCase)) result.Add("katex");
        foreach (Match match in DiagramRegex().Matches(html)) result.Add(match.Groups[1].Value);
        return result;
    }

    [GeneratedRegex("(?is)<head[^>]*>(.*?)</head>")]
    private static partial Regex HeadRegex();

    [GeneratedRegex("(?is)<body[^>]*>(.*?)</body>")]
    private static partial Regex BodyRegex();

    [GeneratedRegex("(?is)<title[^>]*>(.*?)</title>")]
    private static partial Regex TitleRegex();

    [GeneratedRegex("<[^>]+>")]
    private static partial Regex StripTagsRegex();

    [GeneratedRegex("data-kind=[\\\"']([^\\\"']+)[\\\"']", RegexOptions.IgnoreCase)]
    private static partial Regex DiagramRegex();
}
