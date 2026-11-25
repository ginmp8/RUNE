using Microsoft.Playwright;

// Local validation command used by the recovery and Studio smoke scripts.
// Use the same pinned Chromium driver as the actual renderer, without depending
// on Chrome's virtual-time/headless CLI behavior.
internal static class RecoveryBrowserProbe
{
    internal static async Task RunAsync(string[] args)
    {
        if (args.Length is < 4 or > 5 || !int.TryParse(args[3], out var seconds) || seconds <= 0)
            throw new ArgumentException("Expected HTML path, DOM path, PDF path, positive timeout seconds, and optional Chromium executable.");

        var timeout = seconds * 1000f;
        using var playwright = await Playwright.CreateAsync();
        await using var browser = await playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions
        {
            Headless = true,
            ExecutablePath = args.Length == 5 ? args[4] : null,
            Timeout = timeout,
            Args = ["--disable-dev-shm-usage", "--no-sandbox"]
        });
        await using var context = await browser.NewContextAsync();
        var page = await context.NewPageAsync();
        page.SetDefaultTimeout(timeout);
        await page.RouteAsync("**/*", async route =>
        {
            var url = route.Request.Url;
            if (url.StartsWith("data:", StringComparison.OrdinalIgnoreCase) ||
                url.StartsWith("about:", StringComparison.OrdinalIgnoreCase) ||
                url.StartsWith("blob:", StringComparison.OrdinalIgnoreCase))
                await route.ContinueAsync();
            else
                await route.AbortAsync();
        });
        await page.SetContentAsync(await File.ReadAllTextAsync(args[0]), new PageSetContentOptions
        {
            WaitUntil = WaitUntilState.DOMContentLoaded,
            Timeout = timeout
        });
        await page.WaitForFunctionAsync("""
            () => document.documentElement.dataset.recoveryDone === 'true' ||
                  window.__RUNE_RENDER_DONE__ === true ||
                  Boolean(window.__RUNE_RENDER_ERROR__)
            """, null, new PageWaitForFunctionOptions { Timeout = timeout });
        await page.EvaluateAsync("""
            async () => {
                if (window.__RUNE_RENDER_ERROR__) throw new Error(window.__RUNE_RENDER_ERROR__);
                if (typeof window.__RUNE_ASSERT_READY__ === 'function') window.__RUNE_ASSERT_READY__();
                if (document.fonts?.ready) await document.fonts.ready;
            }
            """);
        await File.WriteAllTextAsync(args[1], await page.ContentAsync());
        await page.PdfAsync(new PagePdfOptions
        {
            Path = args[2],
            PrintBackground = true,
            PreferCSSPageSize = true
        });
    }
}
