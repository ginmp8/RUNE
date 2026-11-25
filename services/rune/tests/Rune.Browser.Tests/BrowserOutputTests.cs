using System.Security.Cryptography;
using System.Text;
using Rune.Browser;
using Rune.Core;
using Rune.Job.Contracts;

namespace Rune.Browser.Tests;

public sealed class BrowserOutputTests
{
    [Theory]
    [InlineData(RenderOutputFormat.StaticHtml, "html")]
    [InlineData(RenderOutputFormat.Pdf, "pdf")]
    [InlineData(RenderOutputFormat.PdfA, "pdf")]
    [InlineData(RenderOutputFormat.Png, "png")]
    [InlineData(RenderOutputFormat.Jpeg, "jpg")]
    [InlineData(RenderOutputFormat.Svg, "svg")]
    [Trait("Category", "Browser")]
    public async Task Generates_declared_browser_output(RenderOutputFormat format, string expectedExtension)
    {
        if (!string.Equals(Environment.GetEnvironmentVariable("RUNE_RUN_BROWSER_TESTS"), "1", StringComparison.Ordinal))
            return;

        const string html = """
            <!doctype html><html><head><meta charset="utf-8"></head><body><main><h1>Browser validation</h1></main>
            <script>window.__RUNE_RENDER_DONE__=true;window.__RUNE_ASSERT_READY__=()=>true;</script></body></html>
            """;
        var id = Guid.NewGuid();
        var package = new RenderPackage(id, html, format, new RenderOptions(TimeoutSeconds: 30),
            Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(html))), DateTimeOffset.UtcNow);
        await using var renderer = new PlaywrightRenderService();
        var result = await renderer.RenderAsync(package);
        await using var content = result.Content;
        var bytes = content.ToArray();

        Assert.Equal(expectedExtension, result.Extension);
        Assert.NotEmpty(bytes);
        switch (format)
        {
            case RenderOutputFormat.Pdf:
            case RenderOutputFormat.PdfA:
                Assert.StartsWith("%PDF", Encoding.ASCII.GetString(bytes, 0, Math.Min(bytes.Length, 8)));
                break;
            case RenderOutputFormat.Png:
                Assert.Equal(new byte[] { 0x89, 0x50, 0x4E, 0x47 }, bytes[..4]);
                break;
            case RenderOutputFormat.Jpeg:
                Assert.Equal(new byte[] { 0xFF, 0xD8 }, bytes[..2]);
                break;
            case RenderOutputFormat.Svg:
                Assert.Contains("<svg", Encoding.UTF8.GetString(bytes), StringComparison.OrdinalIgnoreCase);
                break;
            case RenderOutputFormat.StaticHtml:
                var text = Encoding.UTF8.GetString(bytes);
                Assert.Contains("data-rune-static=\"true\"", text, StringComparison.OrdinalIgnoreCase);
                Assert.DoesNotContain("<script", text, StringComparison.OrdinalIgnoreCase);
                break;
        }
    }
}
