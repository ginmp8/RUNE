using Ganss.Xss;
using Rune.Core;

namespace Rune.Security;

public sealed class HtmlContentSanitizer
{
    public string Apply(string html, HtmlTrustMode trustMode)
    {
        if (trustMode == HtmlTrustMode.Trusted) return html;

        var sanitizer = new HtmlSanitizer();
        foreach (var tag in new[]
        {
            "article", "aside", "audio", "details", "dl", "dt", "dd", "figcaption", "figure", "footer", "header", "main",
            "ins", "kbd", "mark", "meter", "picture", "progress", "q", "rp", "rt", "ruby", "samp", "section", "source", "summary", "var", "video", "rune-diagram",
            "svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "text", "tspan", "defs",
            "linearGradient", "radialGradient", "stop", "clipPath", "mask", "marker", "symbol", "use", "desc"
        })
            sanitizer.AllowedTags.Add(tag);

        foreach (var attribute in new[]
        {
            "aria-describedby", "aria-label", "class", "controls", "data-diagram-type", "data-display",
            "data-instance", "data-kind", "data-reactflow-payload", "data-render-state", "data-source-base64",
            "data-schematex-type", "data-schematex-version",
            "dir", "height", "id", "lang", "loading", "max", "open", "poster", "role", "scope", "srcset", "style", "title", "value", "width",
            "viewBox", "viewbox", "xmlns", "fill", "fill-opacity", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
            "stroke-dasharray", "stroke-opacity", "opacity", "transform", "x", "y", "x1", "x2", "y1", "y2", "cx", "cy", "r", "rx", "ry",
            "d", "points", "offset", "stop-color", "stop-opacity", "font-family", "font-size", "font-style", "font-weight",
            "text-anchor", "dominant-baseline", "preserveAspectRatio", "aria-hidden", "focusable"
        })
            sanitizer.AllowedAttributes.Add(attribute);

        sanitizer.AllowedCssProperties.Clear();
        foreach (var property in new[]
        {
            "background-color", "border", "border-color", "border-radius", "border-style", "border-width",
            "color", "display", "font-family", "font-size", "font-style", "font-weight", "height", "line-height",
            "list-style-type", "margin", "margin-bottom", "margin-left", "margin-right", "margin-top", "max-height",
            "max-width", "min-height", "min-width", "opacity", "padding", "padding-bottom", "padding-left",
            "padding-right", "padding-top", "text-align", "text-decoration", "vertical-align", "white-space", "width"
        })
            sanitizer.AllowedCssProperties.Add(property);

        sanitizer.AllowedSchemes.Add("data");
        sanitizer.AllowedSchemes.Add("mailto");
        sanitizer.AllowedSchemes.Add("tel");
        return sanitizer.Sanitize(html);
    }
}
