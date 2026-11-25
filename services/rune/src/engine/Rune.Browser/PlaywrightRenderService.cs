using Microsoft.Playwright;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using PdfLexer;
using PdfLexer.Content;
using Rune.Rendering;
using Rune.Core;
using Rune.Job.Contracts;
using Rune.Export.Image;
using Rune.Export.Pdf;

namespace Rune.Browser;

public sealed record BrowserSideArtifact(string FileName, string ContentType, byte[] Content);
public sealed record BrowserRenderResult(MemoryStream Content, string Extension, string ContentType, IReadOnlyList<BrowserSideArtifact>? SideArtifacts = null);

public sealed class PlaywrightRenderService : IAsyncDisposable
{
    private readonly SemaphoreSlim _gate;
    private IPlaywright? _playwright;
    private IBrowser? _browser;

    public PlaywrightRenderService(int maximumConcurrentRenders = 1) => _gate = new(Math.Max(1, maximumConcurrentRenders));

    public async ValueTask<BrowserRenderResult> RenderAsync(
        RenderPackage package,
        CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            await EnsureBrowserAsync();
            await using var context = await _browser!.NewContextAsync(new BrowserNewContextOptions
            {
                ViewportSize = new ViewportSize { Width = package.Options.Width, Height = package.Options.Height },
                JavaScriptEnabled = true
            });
            var page = await context.NewPageAsync();
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
            await page.SetContentAsync(package.Html, new PageSetContentOptions { WaitUntil = WaitUntilState.DOMContentLoaded, Timeout = package.Options.TimeoutSeconds * 1000f });
            await WaitForReadinessAsync(page, package.Options.TimeoutSeconds);

            switch (package.OutputFormat)
            {
                case RenderOutputFormat.StaticHtml:
                    await MaterializeStaticHtmlAsync(page, removeScripts: true);
                    return new BrowserRenderResult(ToStream(await page.ContentAsync()), "html", "text/html; charset=utf-8");
                case RenderOutputFormat.Pdf:
                case RenderOutputFormat.PdfA:
                    PdfExportPolicy.Validate(package.Options);
                    await page.EvaluateAsync("() => document.querySelectorAll('details').forEach(element => element.open = true)");
                    await page.EmulateMediaAsync(new PageEmulateMediaOptions { Media = Media.Print });
                    await WaitForPrintReadinessAsync(page, package.Options.TimeoutSeconds);
                    var pdfOptions = new PagePdfOptions
                    {
                        Format = package.Options.PageSize,
                        Landscape = package.Options.Landscape,
                        PrintBackground = package.Options.PrintBackground,
                        PreferCSSPageSize = true,
                        DisplayHeaderFooter = !string.IsNullOrWhiteSpace(package.Options.HeaderTemplate) || !string.IsNullOrWhiteSpace(package.Options.FooterTemplate),
                        HeaderTemplate = package.Options.HeaderTemplate ?? string.Empty,
                        FooterTemplate = package.Options.FooterTemplate ?? string.Empty,
                        Margin = new Margin
                        {
                            Top = package.Options.MarginTop,
                            Right = package.Options.MarginRight,
                            Bottom = package.Options.MarginBottom,
                            Left = package.Options.MarginLeft
                        },
                        Tagged = package.Options.Tagged,
                        Outline = package.Options.Outline
                    };
                    var sideArtifacts = new List<BrowserSideArtifact>();
                    byte[] pdf;
                    byte[] nativeMarkerPdf;
                    if (package.Options.EmitStructureMap)
                    {
                        var nodes = await AddStructureMarkersAsync(page);
                        var mappingPdf = await page.PdfAsync(pdfOptions);
                        var markerPages = ExtractMarkerPages(mappingPdf);
                        await RemoveStructureMarkersAsync(page);
                        pdf = await page.PdfAsync(pdfOptions);
                        nativeMarkerPdf = mappingPdf;
                        sideArtifacts.Add(BuildStructureMap(nodes, markerPages, pdf));
                    }
                    else
                    {
                        pdf = await page.PdfAsync(pdfOptions);
                        nativeMarkerPdf = pdf;
                    }
                    if (package.NativePdfImports is { Count: > 0 })
                    {
                        var nativeMarkerPages = ExtractNativeMarkerPages(nativeMarkerPdf);
                        var nativeComposition = NativePdfPageComposer.Compose(pdf, package.NativePdfImports,
                            package.Resources ?? [], nativeMarkerPages);
                        pdf = nativeComposition.Content;
                        sideArtifacts.Add(BuildPdfImportManifest(package.NativePdfImports, nativeComposition.Pages));
                    }
                    if (package.Options.PageDecorations is not null)
                    {
                        var decorationMetadata = package.DocumentModel?.Metadata ?? new Dictionary<string, object?>();
                        var decorationPlan = PageDecorationCompiler.BuildPlan(package.Options, decorationMetadata);
                        if (decorationPlan.RequiresTwoPass)
                        {
                            if (package.Options.Tagged && package.Options.PageDecorations.PreserveTaggedPdf)
                                throw new InvalidOperationException("page-decoration-tagged-pdf-not-preserved: two-pass overlays cannot preserve the Chromium tagged-PDF structure.");
                            pdf = await ComposePageDecorationsAsync(context, page, pdf, package, cancellationToken);
                        }
                        if (package.Options.PageDecorations.EmitPlanArtifact)
                        {
                            var planBytes = JsonSerializer.SerializeToUtf8Bytes(decorationPlan,
                                new JsonSerializerOptions(JsonSerializerDefaults.Web) { WriteIndented = true });
                            sideArtifacts.Add(new BrowserSideArtifact("page-decoration-plan.json", "application/vnd.rune.page-decoration-plan+json", planBytes));
                        }
                    }
                    if (package.OutputFormat == RenderOutputFormat.PdfA)
                    {
                        var converted = await new PdfAConverter().ConvertAsync(pdf, package.Options.PdfAConformance, cancellationToken);
                        return new BrowserRenderResult(converted, PdfExportPolicy.Extension, "application/pdf",
                            sideArtifacts.Count == 0 ? null : sideArtifacts);
                    }
                    return new BrowserRenderResult(new MemoryStream(pdf), PdfExportPolicy.Extension, PdfExportPolicy.ContentType,
                        sideArtifacts.Count == 0 ? null : sideArtifacts);
                case RenderOutputFormat.Png:
                {
                    var image = ImageExportPolicy.Describe(package.OutputFormat);
                    return new BrowserRenderResult(new MemoryStream(await page.ScreenshotAsync(new PageScreenshotOptions { FullPage = true, Type = ScreenshotType.Png })), image.Extension, image.ContentType);
                }
                case RenderOutputFormat.Jpeg:
                {
                    var image = ImageExportPolicy.Describe(package.OutputFormat);
                    return new BrowserRenderResult(new MemoryStream(await page.ScreenshotAsync(new PageScreenshotOptions { FullPage = true, Type = ScreenshotType.Jpeg, Quality = package.Options.JpegQuality })), image.Extension, image.ContentType);
                }
                case RenderOutputFormat.Svg:
                {
                    await MaterializeStaticHtmlAsync(page, removeScripts: true);
                    var svg = await page.EvaluateAsync<string>("""
                        () => {
                          const existing = document.querySelector('main svg');
                          if (existing && document.querySelectorAll('main svg').length === 1) {
                            const clone = existing.cloneNode(true);
                            clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                            return new XMLSerializer().serializeToString(clone);
                          }
                          const width = Math.max(document.documentElement.scrollWidth, 1);
                          const height = Math.max(document.documentElement.scrollHeight, 1);
                          const body = document.body.cloneNode(true);
                          body.querySelectorAll('script').forEach(node => node.remove());
                          const serialized = new XMLSerializer().serializeToString(body);
                          return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml">${serialized}</div></foreignObject></svg>`;
                        }
                        """);
                    return new BrowserRenderResult(ToStream(svg), "svg", "image/svg+xml");
                }
                default:
                    throw new NotSupportedException($"Browser output {package.OutputFormat} is not supported.");
            }
        }
        finally
        {
            _gate.Release();
        }
    }


    private static async ValueTask<StructureNodePosition[]> AddStructureMarkersAsync(IPage page)
    {
        return await page.EvaluateAsync<StructureNodePosition[]>("""
            () => [...document.querySelectorAll('main [data-rune-section], main h1, main h2, main h3, main h4, main h5, main h6')].map((element, index) => {
              const sequence = index + 1;
              const startMarker = document.createElement('span');
              startMarker.className = 'rune-structure-marker';
              startMarker.textContent = `RUNESTRUCTS${String(sequence).padStart(6, '0')}X`;
              startMarker.setAttribute('aria-hidden', 'true');
              startMarker.style.cssText = 'display:block;height:1px;margin-bottom:-1px;overflow:visible;font:1px/1px monospace;color:#fff;opacity:.01;white-space:nowrap';
              element.prepend(startMarker);
              const endMarker = document.createElement('span');
              endMarker.className = 'rune-structure-marker';
              endMarker.textContent = `RUNESTRUCTE${String(sequence).padStart(6, '0')}X`;
              endMarker.setAttribute('aria-hidden', 'true');
              endMarker.style.cssText = startMarker.style.cssText;
              element.append(endMarker);
              const rect = element.getBoundingClientRect();
              return {
                sequence,
                tag: element.tagName.toLowerCase(),
                id: element.id || null,
                section: element.getAttribute('data-rune-section'),
                text: [...element.childNodes].filter(node => !node.classList?.contains?.('rune-structure-marker')).map(node => node.textContent || '').join(' ').trim().replace(/\s+/g, ' ').slice(0, 500),
                top: Math.max(0, rect.top + window.scrollY),
                height: Math.max(0, rect.height),
                documentHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, 1)
              };
            })
            """) ?? [];
    }

    private static Task RemoveStructureMarkersAsync(IPage page) =>
        page.EvaluateAsync("() => document.querySelectorAll('.rune-structure-marker').forEach(marker => marker.remove())");

    private static IReadOnlyDictionary<(char Boundary, int Sequence), int> ExtractMarkerPages(byte[] pdf)
    {
        var result = new Dictionary<(char Boundary, int Sequence), int>();
        using var document = PdfDocument.Open(pdf);
        for (var index = 0; index < document.Pages.Count; index++)
        {
            var structured = document.Pages[index].GetStructuredText(new StructuredTextOptions
            {
                Order = TextOrder.Reading,
                Mode = StructuredTextMode.Deduplicated
            });
            var compact = Regex.Replace(string.Concat(structured.Words.Select(word => word.Text)), "[^A-Za-z0-9]", string.Empty,
                RegexOptions.CultureInvariant);
            foreach (Match match in Regex.Matches(compact, "RUNESTRUCT(?<boundary>[SE])(?<sequence>[0-9]{6})X",
                         RegexOptions.CultureInvariant))
            {
                var boundary = match.Groups["boundary"].Value[0];
                var sequence = int.Parse(match.Groups["sequence"].Value, System.Globalization.CultureInfo.InvariantCulture);
                result[(boundary, sequence)] = index + 1;
            }
        }
        return result;
    }

    private static IReadOnlyDictionary<string, int> ExtractNativeMarkerPages(byte[] pdf)
    {
        var result = new Dictionary<string, int>(StringComparer.Ordinal);
        using var document = PdfDocument.Open(pdf);
        for (var index = 0; index < document.Pages.Count; index++)
        {
            var structured = document.Pages[index].GetStructuredText(new StructuredTextOptions
            {
                Order = TextOrder.Reading,
                Mode = StructuredTextMode.Deduplicated
            });
            var compact = Regex.Replace(string.Concat(structured.Words.Select(word => word.Text)), "[^A-Za-z0-9]", string.Empty,
                RegexOptions.CultureInvariant);
            foreach (Match match in Regex.Matches(compact, "RUNENATIVE[A-Fa-f0-9]{16}[0-9]{6}X", RegexOptions.CultureInvariant))
                result[match.Value.ToUpperInvariant()] = index + 1;
        }
        return result;
    }

    private static BrowserSideArtifact BuildPdfImportManifest(
        IReadOnlyList<NativePdfImportPlan> plans,
        IReadOnlyList<NativePdfCompositionPage> composedPages)
    {
        static string Mode(PdfImportMode value) => value == PdfImportMode.NativePage ? "native-page" : value.ToString().ToLowerInvariant();
        var payload = JsonSerializer.SerializeToUtf8Bytes(new
        {
            schemaVersion = "1.0",
            generatedAt = DateTimeOffset.UtcNow,
            imports = plans.Select(plan => new
            {
                plan.ImportId,
                plan.ResourcePath,
                requestedMode = Mode(plan.RequestedMode),
                appliedMode = Mode(plan.AppliedMode),
                plan.FallbackReason,
                policies = new
                {
                    signatures = plan.Signatures.ToString().ToLowerInvariant(),
                    forms = plan.Forms.ToString().ToLowerInvariant(),
                    annotations = new
                    {
                        links = plan.Annotations.Links.ToString().ToLowerInvariant(),
                        comments = plan.Annotations.Comments.ToString().ToLowerInvariant(),
                        attachments = plan.Annotations.Attachments.ToString().ToLowerInvariant()
                    },
                    javascript = plan.JavaScript.ToString().ToLowerInvariant(),
                    fallback = plan.Fallback.ToString().ToLowerInvariant()
                },
                detected = new
                {
                    signatures = plan.SignatureDetected,
                    forms = plan.FormDetected,
                    javascript = plan.JavaScriptDetected,
                    attachments = plan.AttachmentDetected,
                    comments = plan.CommentDetected
                },
                pages = plan.Pages.Select(page =>
                {
                    var composed = composedPages.SingleOrDefault(item => item.ImportId == plan.ImportId && item.SourcePage == page.SourcePage);
                    return new
                    {
                        page.SourcePage,
                        outputPage = composed?.OutputPage,
                        page.WidthPoints,
                        page.HeightPoints,
                        page.Rotation,
                        page.MediaBox,
                        page.CropBox,
                        page.TrimBox,
                        page.BleedBox,
                        preservedLinkCount = composed?.PreservedLinkCount ?? 0
                    };
                }),
                plan.Warnings
            })
        }, new JsonSerializerOptions(JsonSerializerDefaults.Web) { WriteIndented = true });
        return new BrowserSideArtifact("pdf-import-manifest.json", "application/vnd.rune.pdf-import-manifest+json", payload);
    }

    private static BrowserSideArtifact BuildStructureMap(
        IReadOnlyList<StructureNodePosition> nodes,
        IReadOnlyDictionary<(char Boundary, int Sequence), int> markerPages,
        byte[] finalPdf)
    {
        var pageCount = TwoPassPdfComposer.GetPageCount(finalPdf);
        var mapped = nodes.Select(node =>
        {
            var hasStart = markerPages.TryGetValue(('S', node.Sequence), out var startPage);
            var hasEnd = markerPages.TryGetValue(('E', node.Sequence), out var endPage);
            if (!hasStart && hasEnd) startPage = endPage;
            if (!hasEnd && hasStart) endPage = startPage;
            if (!hasStart && !hasEnd)
            {
                startPage = Math.Clamp((int)Math.Floor(node.Top / Math.Max(node.DocumentHeight, 1) * pageCount) + 1, 1, pageCount);
                endPage = Math.Clamp((int)Math.Floor((node.Top + node.Height) / Math.Max(node.DocumentHeight, 1) * pageCount) + 1, startPage, pageCount);
            }
            return new
            {
                node.Sequence,
                node.Tag,
                node.Id,
                node.Section,
                node.Text,
                node.Top,
                node.Height,
                physicalPage = Math.Clamp(startPage, 1, pageCount),
                physicalEndPage = Math.Clamp(Math.Max(startPage, endPage), 1, pageCount),
                mappingSource = hasStart || hasEnd ? "printed-pdf-marker" : "proportional-fallback"
            };
        }).ToArray();
        var payload = JsonSerializer.SerializeToUtf8Bytes(new
        {
            contractVersion = "1.1",
            taggedPdfRequested = true,
            pageCount,
            mappingMethod = "temporary-print-markers-extracted-from-pdf",
            fallbackNodeCount = mapped.Count(node => node.mappingSource == "proportional-fallback"),
            nodes = mapped
        }, new JsonSerializerOptions(JsonSerializerDefaults.Web) { WriteIndented = true });
        return new BrowserSideArtifact("structure-map.json", "application/vnd.rune.pdf-structure-map+json", payload);
    }

    private static async Task<byte[]> ComposePageDecorationsAsync(
        IBrowserContext context,
        IPage sourcePage,
        byte[] basePdf,
        RenderPackage package,
        CancellationToken cancellationToken)
    {
        var options = package.Options;
        var pageCount = TwoPassPdfComposer.GetPageCount(basePdf);
        var positions = await sourcePage.EvaluateAsync<SectionPosition[]>("""
            () => {
              const height = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, 1);
              return [...document.querySelectorAll('[data-rune-section]')].map(element => ({
                name: element.getAttribute('data-rune-section') || '',
                top: Math.max(0, element.getBoundingClientRect().top + window.scrollY),
                documentHeight: height
              }));
            }
            """) ?? [];
        var sectionStarts = positions
            .Where(item => !string.IsNullOrWhiteSpace(item.Name))
            .Select(item => new
            {
                item.Name,
                Page = Math.Clamp((int)Math.Floor(item.Top / Math.Max(item.DocumentHeight, 1) * pageCount) + 1, 1, pageCount)
            })
            .OrderBy(item => item.Page).ToArray();
        var metadata = package.DocumentModel?.Metadata ?? new Dictionary<string, object?>();
        var resourceMap = (package.Resources ?? [])
            .ToDictionary(item => item.Path, item => new PageDecorationResource(item.Path, item.ContentType, item.Content), StringComparer.OrdinalIgnoreCase);
        var overlays = new Dictionary<int, byte[]>();
        var overlayPage = await context.NewPageAsync();
        try
        {
            for (var physicalPage = 1; physicalPage <= pageCount; physicalPage++)
            {
                cancellationToken.ThrowIfCancellationRequested();
                var section = sectionStarts.LastOrDefault(item => item.Page <= physicalPage)?.Name;
                var resolved = PageDecorationRuleResolver.Resolve(options.PageDecorations, physicalPage, section);
                if (resolved.Template is null) continue;
                var values = PageDecorationCompiler.BuildTokenValues(options, metadata, physicalPage, pageCount, section,
                    package.DocumentName, package.CreatedAt);
                var html = BuildOverlayHtml(resolved.Template, values, resourceMap, options);
                await overlayPage.SetContentAsync(html, new PageSetContentOptions
                {
                    WaitUntil = WaitUntilState.DOMContentLoaded,
                    Timeout = options.TimeoutSeconds * 1000f
                });
                await overlayPage.EvaluateAsync("() => document.fonts ? document.fonts.ready : Promise.resolve()");
                var layoutErrors = await overlayPage.EvaluateAsync<string[]>("""
                    () => {
                      const errors = [];
                      for (const element of document.querySelectorAll('.region')) {
                        const style = getComputedStyle(element);
                        const max = Number.parseFloat(style.maxHeight);
                        if (!Number.isFinite(max) || max <= 0 || element.scrollHeight <= max + 0.5) continue;
                        const policy = element.dataset.overflow || 'error';
                        if (policy === 'clip') {
                          element.style.overflow = 'hidden';
                          element.style.maxHeight = `${max}px`;
                          continue;
                        }
                        if (policy === 'scale') {
                          const scale = max / Math.max(element.scrollHeight, 1);
                          const minimum = Number.parseFloat(element.dataset.minimumScale || '0.8');
                          if (scale + 0.0001 < minimum) {
                            errors.push(`page-decoration-overflow: required scale ${scale.toFixed(4)} is below minimum ${minimum.toFixed(4)}`);
                            continue;
                          }
                          element.style.transformOrigin = element.classList.contains('header') ? 'top left' : 'bottom left';
                          element.style.transform = `scale(${scale})`;
                          element.style.width = `${100 / scale}%`;
                          continue;
                        }
                        errors.push(`page-decoration-overflow: content height ${element.scrollHeight}px exceeds ${max}px`);
                      }
                      return errors;
                    }
                    """) ?? [];
                if (layoutErrors.Length > 0) throw new InvalidOperationException(string.Join("; ", layoutErrors));
                overlays[physicalPage] = await overlayPage.PdfAsync(new PagePdfOptions
                {
                    Format = options.PageSize,
                    Landscape = options.Landscape,
                    PrintBackground = true,
                    PreferCSSPageSize = true,
                    DisplayHeaderFooter = false,
                    Margin = new Margin { Top = "0", Right = "0", Bottom = "0", Left = "0" }
                });
            }
        }
        finally
        {
            await overlayPage.CloseAsync();
        }
        return overlays.Count == 0 ? basePdf : TwoPassPdfComposer.Compose(basePdf, overlays);
    }

    private static string BuildOverlayHtml(
        PageDecorationTemplate template,
        IReadOnlyDictionary<string, string> values,
        IReadOnlyDictionary<string, PageDecorationResource> resources,
        RenderOptions options)
    {
        var header = template.HeaderRegion ?? (template.Header is null ? null : new PageDecorationRegion(template.Header, Alignment: template.HeaderAlignment));
        var footer = template.FooterRegion ?? (template.Footer is null ? null : new PageDecorationRegion(template.Footer, Alignment: template.FooterAlignment));
        string Region(PageDecorationRegion? region, bool isHeader)
        {
            if (region is null) return string.Empty;
            var fragment = PageDecorationCompiler.RenderFragmentHtml(region, values, resources);
            var position = isHeader ? "top:3mm" : "bottom:3mm";
            var alignment = region.Alignment.ToString().ToLowerInvariant();
            var maximumHeight = region.MaximumHeight ?? (isHeader ? options.MarginTop : options.MarginBottom);
            var overflow = region.OverflowPolicy.ToString().ToLowerInvariant();
            return $"<div class=\"region {(isHeader ? "header" : "footer")}\" data-overflow=\"{overflow}\" data-minimum-scale=\"{region.MinimumScale.ToString("0.###", System.Globalization.CultureInfo.InvariantCulture)}\" style=\"{position};text-align:{alignment};max-height:{WebUtility.HtmlEncode(maximumHeight)}\">{fragment}</div>";
        }
        var body = Region(header, true) + Region(footer, false);
        return $$"""
            <!doctype html><html><head><meta charset="utf-8"><style>
            @page { size: {{WebUtility.HtmlEncode(options.PageSize)}} {{(options.Landscape ? "landscape" : "portrait")}}; margin:0; }
            html,body{margin:0;padding:0;width:100%;height:100%;font-family:var(--rune-decoration-font,Arial,sans-serif);color:#111}
            .region{position:fixed;left:10mm;right:10mm;line-height:1.2;box-sizing:border-box;font-size:10pt}
            .region img,.region svg{max-width:100%;max-height:100%;object-fit:contain}
            .region table{border-collapse:collapse;width:100%;font-size:9pt}.region th,.region td{border:0.2mm solid #aaa;padding:1mm}
            .region p{margin:0}.region ul,.region ol{margin:0;padding-left:5mm}
            </style></head><body>{{body}}</body></html>
            """;
    }

    private sealed class StructureNodePosition
    {
        public int Sequence { get; set; }
        public string Tag { get; set; } = string.Empty;
        public string? Id { get; set; }
        public string? Section { get; set; }
        public string Text { get; set; } = string.Empty;
        public double Top { get; set; }
        public double Height { get; set; }
        public double DocumentHeight { get; set; }
    }

    private sealed class SectionPosition
    {
        public string Name { get; set; } = string.Empty;
        public double Top { get; set; }
        public double DocumentHeight { get; set; }
    }

    private async Task EnsureBrowserAsync()
    {
        if (_browser is { IsConnected: true }) return;
        if (_browser is not null) await _browser.DisposeAsync();
        _playwright ??= await Playwright.CreateAsync();
        var executablePath = Environment.GetEnvironmentVariable("RUNE_CHROMIUM_EXECUTABLE_PATH")
            ?? Environment.GetEnvironmentVariable("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH");
        _browser = await _playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions
        {
            Headless = true,
            ExecutablePath = string.IsNullOrWhiteSpace(executablePath) ? null : executablePath,
            Args = ["--disable-dev-shm-usage", "--no-sandbox"]
        });
    }


    private static Task MaterializeStaticHtmlAsync(IPage page, bool removeScripts) => page.EvaluateAsync("""
        (removeScripts) => {
          document.querySelectorAll('canvas').forEach(canvas => {
            try {
              const image = document.createElement('img');
              image.src = canvas.toDataURL('image/png');
              image.width = canvas.width;
              image.height = canvas.height;
              image.alt = canvas.getAttribute('aria-label') || 'Rendered canvas';
              image.className = canvas.className;
              canvas.replaceWith(image);
            } catch {
              canvas.dataset.runeMaterializationError = 'canvas-to-image-failed';
            }
          });
          if (removeScripts) document.querySelectorAll('script').forEach(node => node.remove());
          document.querySelectorAll('*').forEach(node => {
            for (const attribute of [...node.attributes]) {
              if (attribute.name.toLowerCase().startsWith('on')) node.removeAttribute(attribute.name);
            }
          });
          document.documentElement.dataset.runeStatic = 'true';
        }
        """, removeScripts);

    private static async Task WaitForPrintReadinessAsync(IPage page, int timeoutSeconds)
    {
        await page.WaitForFunctionAsync("""
            () => typeof window.__RUNE_ASSERT_READY__ === 'function'
            """, null, new PageWaitForFunctionOptions { Timeout = timeoutSeconds * 1000f });
        await page.EvaluateAsync("""
            async () => {
              if (document.fonts?.ready) await document.fonts.ready;
              let previous = null;
              let stable = 0;
              for (let attempt = 0; attempt < 60; attempt += 1) {
                await new Promise(resolve => requestAnimationFrame(resolve));
                const current = `${document.documentElement.scrollWidth}x${document.documentElement.scrollHeight}`;
                if (current === previous) stable += 1; else stable = 0;
                if (stable >= 3) return window.__RUNE_ASSERT_READY__();
                previous = current;
              }
              throw new Error('Print dimensions did not stabilize.');
            }
            """);
    }

    private static async Task WaitForReadinessAsync(IPage page, int timeoutSeconds)
    {
        await page.WaitForFunctionAsync("() => window.__RUNE_RENDER_DONE__ === true || Boolean(window.__RUNE_RENDER_ERROR__)", null, new PageWaitForFunctionOptions { Timeout = timeoutSeconds * 1000f });
        var error = await page.EvaluateAsync<string?>("() => window.__RUNE_RENDER_ERROR__ || null");
        if (!string.IsNullOrWhiteSpace(error)) throw new InvalidOperationException(error);
        await page.EvaluateAsync("() => window.__RUNE_ASSERT_READY__()");
    }

    private static MemoryStream ToStream(string value) => new(System.Text.Encoding.UTF8.GetBytes(value));

    public async ValueTask DisposeAsync()
    {
        if (_browser is not null) await _browser.DisposeAsync();
        _playwright?.Dispose();
        _gate.Dispose();
    }
}
