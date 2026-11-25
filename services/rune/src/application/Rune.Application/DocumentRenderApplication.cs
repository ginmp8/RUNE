using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Text.Json;
using Rune.Api.Contracts;
using Rune.Core;
using Rune.Jobs;
using Rune.Messaging.Abstractions;
using Rune.Pdf;

namespace Rune.Application;

public sealed class DocumentRenderApplication(
    IEnumerable<IDocumentCompiler> compilers,
    IHtmlDocumentRenderer htmlRenderer,
    RenderJobService jobs,
    RenderCommandOutbox outbox,
    IPdfImportService? pdfImport = null)
{
    private const int MaximumDocumentCharacters = 10_000_000;
    private const int MaximumResourceBytes = 25_000_000;
    private readonly IReadOnlyDictionary<DocumentSourceType, IDocumentCompiler> _compilers = compilers.ToDictionary(compiler => compiler.SourceType);

    public async ValueTask<object> RenderAsync(RenderRequest request, CancellationToken cancellationToken = default)
    {
        Validate(request);
        var singularOutput = request.OutputFormat ?? RenderOutputFormat.InteractiveHtml;
        var requestedOutputs = request.OutputFormats?.NormalizeOutputSet().ToArray();
        var decodedResources = DecodeResources(request.Resources);
        if (request.SourceType == DocumentSourceType.Pdf)
            return await QueuePdfAsync(request, decodedResources, cancellationToken);

        var textResources = decodedResources
            .Where(resource => IsTextResource(resource.Path, resource.ContentType))
            .ToDictionary(resource => resource.Path, resource => Encoding.UTF8.GetString(resource.Content), StringComparer.OrdinalIgnoreCase);

        CompiledDocument compiled;
        TemplateExpansionMetadata? templateExpansion = null;
        if (request.SourceType == DocumentSourceType.Composite)
        {
            var nativePdfOutputSupported = requestedOutputs is null
                ? singularOutput is RenderOutputFormat.Pdf or RenderOutputFormat.PdfA
                : requestedOutputs.All(format => format is RenderOutputFormat.Pdf or RenderOutputFormat.PdfA);
            compiled = await CompileCompositeAsync(request.Composite!, decodedResources, textResources, nativePdfOutputSupported, cancellationToken);
        }
        else
        {
            var sourceType = request.SourceType;
            var sourceContent = request.Content;
            var documentName = request.DocumentName;
            if (sourceType == DocumentSourceType.Template)
                (sourceType, sourceContent, documentName, templateExpansion) = ExpandTemplate(sourceContent, request.Template ?? new RuneTemplateOptions(), decodedResources, textResources);

            if (!_compilers.TryGetValue(sourceType, out var compiler))
                throw new ArgumentException($"Source type {sourceType} is not supported.", nameof(request));
            compiled = await compiler.CompileAsync(
                new SourceDocument(sourceType, sourceContent, textResources,
                    HtmlTrustMode: request.HtmlTrustMode, EntryPath: documentName),
                cancellationToken);
        }
        var options = RenderOptionsResolver.Apply(request.Options ?? new RenderOptions(), compiled.Metadata);
        if (request.MultiOutput is not null) options = options with { Publication = request.MultiOutput };
        var fontCss = FontCssCompiler.Compile(options.Fonts, decodedResources.Select(resource => new FontResourceContent(resource.Path, resource.ContentType, resource.Content)).ToArray());
        if (!string.IsNullOrWhiteSpace(fontCss.Css))
            options = options with { AdditionalCss = string.Concat(options.AdditionalCss, "\n", fontCss.Css) };
        var rendered = await htmlRenderer.RenderAsync(compiled, options, cancellationToken);
        var selfContainedHtml = EmbedResources(rendered.Html, decodedResources);

        if (requestedOutputs is { Length: > 0 } && requestedOutputs.Length > Enum.GetValues<RenderOutputFormat>().Length)
            throw new ArgumentException("outputFormats exceeds the supported format count.", nameof(request));

        if (requestedOutputs is null && singularOutput == RenderOutputFormat.InteractiveHtml)
            return new HtmlRenderResponse(
                "text/html; charset=utf-8",
                selfContainedHtml,
                rendered.RequiredRenderers.Order(StringComparer.Ordinal).ToArray(),
                rendered.Diagnostics);
        if (requestedOutputs is null && singularOutput == RenderOutputFormat.StructuredJson)
            return new StructuredDocumentResponse("application/vnd.rune.document+json", compiled.DocumentModel
                ?? RuneDocumentModelBuilder.FromCompiled(request.SourceType, "RUNE Document", compiled.Metadata,
                    compiled.BodyHtml, compiled.RequiredRenderers, compiled.Diagnostics));

        var primaryFormat = requestedOutputs?.FirstOrDefault() ?? singularOutput;
        var nativeResourcePaths = (compiled.NativePdfImports ?? [])
            .Select(item => item.ResourcePath).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var nativeResources = decodedResources
            .Where(item => nativeResourcePaths.Contains(item.Path))
            .Select(item => new Rune.Job.Contracts.RenderPackageResource(item.Path, item.ContentType, item.Content))
            .ToArray();
        var job = await jobs.CreateAsync(selfContainedHtml, primaryFormat, options, compiled.DocumentModel,
            request.IdempotencyKey, requestedOutputs,
            resources: nativeResources.Length == 0 ? null : nativeResources,
            nativePdfImports: compiled.NativePdfImports,
            documentName: Path.GetFileNameWithoutExtension(request.DocumentName),
            templateExpansion: templateExpansion,
            assemblyManifestJson: compiled.AssemblyManifestJson,
            cancellationToken: cancellationToken);
        if (job.Status == Rune.Job.Contracts.RenderJobStatus.Queued && job.Attempt == 0)
            await outbox.PublishAsync(job.Id, cancellationToken);
        return new RenderAcceptedResponse(job.Id, job.Status.ToString().ToLowerInvariant(),
            $"/v1/renders/{job.Id}", $"/v1/renders/{job.Id}/content",
            $"/v1/renders/{job.Id}/events", job.CreatedAt);
    }


    private async ValueTask<CompiledDocument> CompileCompositeAsync(
        CompositeDocumentOptions composite,
        IReadOnlyList<DecodedResource> resources,
        IReadOnlyDictionary<string, string> textResources,
        bool nativePdfOutputSupported,
        CancellationToken cancellationToken)
    {
        if (composite.MaximumDepth is < 1 or > 16)
            throw new ArgumentException("Composite maximumDepth must be between 1 and 16.");
        if (composite.TimeoutSeconds is < 1 or > 3600 || composite.MaximumPages is < 1 or > 20_000 ||
            composite.MaximumAggregateResourceBytes is < 1 or > 2_000_000_000)
            throw new ArgumentException("Composite limits are outside the supported range.");
        if (resources.Sum(resource => (long)resource.Content.Length) > composite.MaximumAggregateResourceBytes)
            throw new ArgumentException("Composite resources exceed maximumAggregateResourceBytes.");
        var flattenedParts = FlattenCompositeParts(composite).ToArray();
        var hasPdfParts = flattenedParts.Any(part => part.SourceType == DocumentSourceType.Pdf);
        var hasLogicalParts = flattenedParts.Any(part => part.SourceType != DocumentSourceType.Pdf);
        var resolvedMode = composite.Mode == CompositeAssemblyMode.Auto
            ? hasPdfParts && hasLogicalParts ? CompositeAssemblyMode.Hybrid : hasPdfParts ? CompositeAssemblyMode.Rendered : CompositeAssemblyMode.Logical
            : composite.Mode;
        if (resolvedMode == CompositeAssemblyMode.Logical && hasPdfParts)
            throw new ArgumentException("Logical composite assembly cannot contain fixed PDF parts.");
        if (resolvedMode == CompositeAssemblyMode.Hybrid && !(hasPdfParts && hasLogicalParts))
            throw new ArgumentException("Hybrid composite assembly requires both logical and fixed PDF parts.");
        var body = new StringBuilder();
        var pageCss = new StringBuilder();
        var renderers = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var diagnostics = new List<RenderDiagnostic>();
        var namedSections = new List<string>();
        var headings = new List<(int Level, string Text, string Id)>();
        var nativePdfImports = new List<NativePdfImportPlan>();
        var partIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var partSlugs = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var partManifest = new List<object>();
        var totalParts = 0;

        async ValueTask CompilePartsAsync(CompositeDocumentOptions current, int depth, string pathPrefix)
        {
            if (depth > composite.MaximumDepth)
                throw new ArgumentException($"Composite nesting exceeds maximumDepth {composite.MaximumDepth}.");
            var localIndex = 0;
            foreach (var part in current.Parts)
            {
                cancellationToken.ThrowIfCancellationRequested();
                localIndex++;
                totalParts++;
                if (totalParts > 100) throw new ArgumentException("Composite input supports at most 100 total parts including nested parts.");
                if (string.IsNullOrWhiteSpace(part.Name) || part.Name.Length > 160 || !Regex.IsMatch(part.Name, "^[A-Za-z0-9][A-Za-z0-9_. -]*$"))
                    throw new ArgumentException($"Composite part {totalParts} has an invalid name.");
                var partId = string.IsNullOrWhiteSpace(part.Id) ? SafeFileName(part.Name) : part.Id.Trim();
                if (!Regex.IsMatch(partId, "^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$") || !partIds.Add(partId))
                    throw new ArgumentException($"Composite part id '{partId}' is invalid or duplicated.");
                var sectionPath = string.IsNullOrWhiteSpace(pathPrefix) ? part.Name : pathPrefix + "/" + part.Name;
                namedSections.Add(sectionPath);
                var slug = $"part-{totalParts:D3}-{SafeFileName(sectionPath)}";
                partSlugs[partId] = slug;
                var breakStyle = totalParts > 1 && (current.PageBreakBetweenParts || part.StartOnNewPage)
                    ? "break-before:page;page-break-before:always;"
                    : string.Empty;
                var pageName = "rune-" + slug;
                if (!string.IsNullOrWhiteSpace(part.PageSize) || part.Landscape.HasValue ||
                    part.MarginTop is not null || part.MarginRight is not null || part.MarginBottom is not null || part.MarginLeft is not null)
                {
                    var size = ValidatePageSize(part.PageSize ?? "A4");
                    var orientation = part.Landscape == true ? "landscape" : "portrait";
                    pageCss.Append("@page ").Append(pageName).Append("{size:").Append(size).Append(' ').Append(orientation).Append(';');
                    if (part.MarginTop is not null || part.MarginRight is not null || part.MarginBottom is not null || part.MarginLeft is not null)
                        pageCss.Append("margin:").Append(ValidateCssLength(part.MarginTop ?? "20mm")).Append(' ')
                            .Append(ValidateCssLength(part.MarginRight ?? "18mm")).Append(' ')
                            .Append(ValidateCssLength(part.MarginBottom ?? "20mm")).Append(' ')
                            .Append(ValidateCssLength(part.MarginLeft ?? "18mm")).Append(';');
                    pageCss.AppendLine("}");
                    breakStyle += $"page:{pageName};";
                }

                body.Append("<section class=\"rune-composite-part\" data-rune-section=\"")
                    .Append(System.Net.WebUtility.HtmlEncode(sectionPath)).Append("\" id=\"").Append(slug).Append("\"");
                if (breakStyle.Length > 0) body.Append(" style=\"").Append(breakStyle).Append("\"");
                body.Append('>');
                if (current.IncludePartTitles)
                {
                    var titleId = slug + "-title";
                    body.Append("<h1 class=\"rune-composite-part-title\" id=\"").Append(titleId).Append("\">")
                        .Append(System.Net.WebUtility.HtmlEncode(part.Name)).Append("</h1>");
                    headings.Add((1, part.Name, titleId));
                }

                if (part.SourceType == DocumentSourceType.Composite)
                {
                    if (part.Composite?.Parts is null || part.Composite.Parts.Count == 0)
                        throw new ArgumentException($"Nested composite part '{part.Name}' requires composite options with at least one part.");
                    await CompilePartsAsync(part.Composite, depth + 1, sectionPath);
                    body.AppendLine("</section>");
                    partManifest.Add(new { id = partId, name = part.Name, sourceType = "composite", sectionPath, mode = resolvedMode.ToString().ToLowerInvariant(), digest = DigestText(sectionPath), preservation = Preservation(part) });
                    continue;
                }
                if (part.SourceType == DocumentSourceType.Pdf)
                {
                    if (string.IsNullOrWhiteSpace(part.ResourcePath))
                        throw new ArgumentException($"Composite PDF part '{part.Name}' requires resourcePath.");
                    var pdfResource = resources.SingleOrDefault(item => string.Equals(item.Path, part.ResourcePath, StringComparison.OrdinalIgnoreCase))
                        ?? throw new ArgumentException($"Composite PDF part resource '{part.ResourcePath}' was not found.");
                    if (!string.Equals(pdfResource.ContentType, "application/pdf", StringComparison.OrdinalIgnoreCase))
                        throw new ArgumentException($"Composite PDF part resource '{part.ResourcePath}' must use content type application/pdf.");
                    var converter = pdfImport ?? new PdfImportService();
                    var importOptions = part.PdfImport ?? new PdfImportOptions(Mode: PdfImportMode.Visual, OcrMode: PdfOcrMode.Off,
                        MaximumPages: 200, MaximumSourceBytes: 25_000_000, MaximumOutputBytes: 150_000_000,
                        VisualScale: 1.5, EmitRegionDiagnostics: true, PreserveLinks: true, ExtractImages: false);
                    NativePdfImportPlan? nativePlan = null;
                    if (importOptions.Mode == PdfImportMode.NativePage)
                    {
                        nativePlan = NativePdfImportPlanner.Plan(pdfResource.Content, part.ResourcePath, importOptions);
                        if (nativePlan.AppliedMode == PdfImportMode.NativePage && !nativePdfOutputSupported)
                        {
                            if (importOptions.Fallback == PdfImportFallbackPolicy.Reject)
                                throw new PdfImportException("pdf-native-output-invalid", "native-page currently supports only a single PDF or PDF/A composite output.");
                            nativePlan = nativePlan with { AppliedMode = PdfImportMode.Visual, FallbackReason = "native-page-output-requires-single-pdf" };
                        }
                        nativePdfImports.Add(nativePlan);
                        if (nativePlan.AppliedMode == PdfImportMode.NativePage)
                        {
                            foreach (var nativePage in nativePlan.Pages)
                            {
                                var effectiveWidth = nativePage.Rotation is 90 or 270 ? nativePage.HeightPoints : nativePage.WidthPoints;
                                var effectiveHeight = nativePage.Rotation is 90 or 270 ? nativePage.WidthPoints : nativePage.HeightPoints;
                                var nativePageName = $"rune-native-{nativePlan.ImportId}-{nativePage.SourcePage:D6}";
                                pageCss.Append("@page ").Append(nativePageName).Append("{size:")
                                    .Append(effectiveWidth.ToString("0.###", System.Globalization.CultureInfo.InvariantCulture)).Append("pt ")
                                    .Append(effectiveHeight.ToString("0.###", System.Globalization.CultureInfo.InvariantCulture)).AppendLine("pt;margin:0}");
                                body.Append("<section class=\"rune-native-pdf-page\" data-rune-native-import=\"")
                                    .Append(nativePlan.ImportId).Append("\" data-rune-native-source-page=\"")
                                    .Append(nativePage.SourcePage).Append("\" style=\"page:").Append(nativePageName)
                                    .Append(";width:").Append(effectiveWidth.ToString("0.###", System.Globalization.CultureInfo.InvariantCulture))
                                    .Append("pt;height:").Append(effectiveHeight.ToString("0.###", System.Globalization.CultureInfo.InvariantCulture))
                                    .Append("pt;break-before:page;break-after:page;overflow:hidden;margin:0;padding:0\">")
                                    .Append("<span aria-hidden=\"true\" style=\"font:8pt/1 monospace;color:#000\">")
                                    .Append(nativePage.Marker).Append("</span></section>");
                            }
                            body.AppendLine("</section>");
                            diagnostics.Add(new RenderDiagnostic("composite-pdf-native-page",
                                $"[{sectionPath}] PDF pages are scheduled for native object-preserving composition after Chromium rendering.",
                                RenderDiagnosticSeverity.Info, RelatedIds: [sectionPath]));
                            continue;
                        }
                        importOptions = importOptions with { Mode = PdfImportMode.Visual };
                    }
                    var conversion = await converter.ConvertAsync(new PdfImportRequest(pdfResource.Content, importOptions, part.ResourcePath), cancellationToken);
                    var importedBody = Regex.Match(conversion.Html, "<body[^>]*>(?<body>.*)</body>", RegexOptions.IgnoreCase | RegexOptions.Singleline | RegexOptions.CultureInvariant);
                    var importedStyles = Regex.Matches(conversion.Html, "<style[^>]*>(?<css>.*?)</style>", RegexOptions.IgnoreCase | RegexOptions.Singleline | RegexOptions.CultureInvariant)
                        .Select(match => match.Groups["css"].Value);
                    foreach (var style in importedStyles) pageCss.AppendLine(style);
                    body.Append(importedBody.Success ? importedBody.Groups["body"].Value : conversion.Html).AppendLine("</section>");
                    diagnostics.Add(new RenderDiagnostic(nativePlan is null ? "composite-pdf-rasterized" : "composite-pdf-native-fallback",
                        nativePlan is null
                            ? $"[{sectionPath}] PDF part was imported through the bounded visual/semantic conversion pipeline; direct PDF object preservation is not claimed."
                            : $"[{sectionPath}] native-page applied visual fallback: {nativePlan.FallbackReason}.",
                        RenderDiagnosticSeverity.Warning, RelatedIds: [sectionPath]));
                    if (composite.FailOnSemanticLoss && (part.Tags == CompositePreservationPolicy.Preserve || part.Signatures == CompositePreservationPolicy.Preserve))
                        throw new ArgumentException($"Composite part '{partId}' requires PDF semantics that the selected conversion mode cannot preserve.");
                    partManifest.Add(new { id = partId, name = part.Name, sourceType = "pdf", resourcePath = part.ResourcePath, sectionPath, mode = conversion.Report.EffectiveMode.ToString().ToLowerInvariant(), digest = Convert.ToHexString(SHA256.HashData(pdfResource.Content)), preservation = Preservation(part), pages = conversion.Report.PageCount });
                    continue;
                }

                var content = part.Content;
                if (!string.IsNullOrWhiteSpace(part.ResourcePath))
                {
                    var resource = resources.SingleOrDefault(item => string.Equals(item.Path, part.ResourcePath, StringComparison.OrdinalIgnoreCase))
                        ?? throw new ArgumentException($"Composite part resource '{part.ResourcePath}' was not found.");
                    if (!IsTextResource(resource.Path, resource.ContentType))
                        throw new ArgumentException($"Composite part resource '{part.ResourcePath}' must be textual.");
                    content = Encoding.UTF8.GetString(resource.Content);
                }
                var sourceType = part.SourceType;
                var entryPath = part.ResourcePath ?? $"composite/{totalParts:D3}-{SafeFileName(part.Name)}.md";
                TemplateExpansionMetadata? partTemplateExpansion = null;
                if (sourceType == DocumentSourceType.Template)
                    (sourceType, content, entryPath, partTemplateExpansion) = ExpandTemplate(content, part.Template ?? new RuneTemplateOptions(), resources, textResources);
                if (string.IsNullOrWhiteSpace(content)) throw new ArgumentException($"Composite part '{part.Name}' has no content.");
                if (!_compilers.TryGetValue(sourceType, out var compiler))
                    throw new ArgumentException($"Composite part source type {sourceType} is not supported.");
                var compiledPart = await compiler.CompileAsync(new SourceDocument(sourceType, content, textResources,
                    HtmlTrustMode: part.HtmlTrustMode, EntryPath: entryPath), cancellationToken);
                var partBodyHtml = current.IncludePartTitles
                    ? RemoveLeadingDuplicateHeading(compiledPart.BodyHtml, part.Name)
                    : compiledPart.BodyHtml;
                var rewritten = RewritePartFragments(partBodyHtml, slug, headings);
                body.Append(rewritten).AppendLine("</section>");
                renderers.UnionWith(compiledPart.RequiredRenderers);
                diagnostics.AddRange(compiledPart.Diagnostics.Select(item => item with
                {
                    Message = $"[{sectionPath}] {item.Message}",
                    RelatedIds = (item.RelatedIds ?? []).Prepend(sectionPath).ToArray()
                }));
                partManifest.Add(new { id = partId, name = part.Name, sourceType = part.SourceType.ToString().ToLowerInvariant(), resourcePath = part.ResourcePath, sectionPath, mode = resolvedMode.ToString().ToLowerInvariant(), digest = DigestText(content), trust = part.HtmlTrustMode.ToString().ToLowerInvariant(), preservation = Preservation(part), templateExpansion = partTemplateExpansion, diagnostics = compiledPart.Diagnostics.Count });
            }
        }

        await CompilePartsAsync(composite, 1, string.Empty);
        var assembledBody = RewriteCrossPartReferences(body.ToString(), partSlugs, composite.NamespaceDuplicateAnchors);
        body.Clear().Append(assembledBody);
        if ((composite.RewriteTableOfContents || composite.GlobalTableOfContents) && headings.Count > 0)
        {
            var toc = new StringBuilder("<nav class=\"rune-composite-toc\" aria-label=\"Table of contents\"><h1>Table of contents</h1><ol>");
            foreach (var heading in headings)
                toc.Append("<li class=\"level-").Append(heading.Level).Append("\"><a href=\"#").Append(heading.Id).Append("\">")
                    .Append(System.Net.WebUtility.HtmlEncode(heading.Text)).Append("</a></li>");
            toc.Append("</ol></nav>");
            body.Insert(0, toc.ToString());
        }
        var metadata = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
        {
            ["title"] = "Composite Document",
            ["compositePartCount"] = totalParts,
            ["namedSections"] = namedSections.ToArray(),
            ["tableOfContentsRewritten"] = composite.RewriteTableOfContents || composite.GlobalTableOfContents,
            ["assemblyMode"] = resolvedMode.ToString().ToLowerInvariant(),
            ["globalOutline"] = composite.GlobalOutline,
            ["globalHeadingNumbering"] = composite.GlobalHeadingNumbering
        };
        var model = RuneDocumentModelBuilder.FromCompiled(DocumentSourceType.Composite, "Composite Document", metadata,
            body.ToString(), renderers, diagnostics);
        var head = pageCss.Length == 0 ? string.Empty : "<style data-rune-composite-pages>" + pageCss + "</style>";
        var assemblyManifest = JsonSerializer.Serialize(new
        {
            schemaVersion = "1.0",
            mode = resolvedMode.ToString().ToLowerInvariant(),
            partCount = totalParts,
            options = new { composite.GlobalTableOfContents, composite.GlobalOutline, composite.GlobalHeadingNumbering, composite.NamespaceDuplicateAnchors, composite.PreservePageLabels, composite.FailOnSemanticLoss },
            parts = partManifest,
            namedSections,
            finalHtmlSha256 = DigestText(body.ToString()),
            diagnostics = diagnostics.Select(item => new { item.Code, item.Severity, item.Message })
        }, new JsonSerializerOptions(JsonSerializerDefaults.Web) { WriteIndented = true, Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter(JsonNamingPolicy.CamelCase) } });
        return new CompiledDocument(body.ToString(), metadata, renderers, diagnostics, HeadHtml: head, DocumentModel: model,
            NativePdfImports: nativePdfImports.Count == 0 ? null : nativePdfImports, AssemblyManifestJson: assemblyManifest);
    }

    private static IEnumerable<CompositeDocumentPart> FlattenCompositeParts(CompositeDocumentOptions composite)
    {
        foreach (var part in composite.Parts)
        {
            yield return part;
            if (part.SourceType == DocumentSourceType.Composite && part.Composite is not null)
                foreach (var nested in FlattenCompositeParts(part.Composite)) yield return nested;
        }
    }

    private static object Preservation(CompositeDocumentPart part) => new
    {
        links = part.Links.ToString().ToLowerInvariant(),
        tags = part.Tags.ToString().ToLowerInvariant(),
        forms = part.Forms.ToString().ToLowerInvariant(),
        annotations = part.Annotations.ToString().ToLowerInvariant(),
        attachments = part.Attachments.ToString().ToLowerInvariant(),
        signatures = part.Signatures.ToString().ToLowerInvariant()
    };

    private static string DigestText(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    private static string RewriteCrossPartReferences(string html, IReadOnlyDictionary<string, string> partSlugs, bool strict)
    {
        return Regex.Replace(html, "\\bhref=[\"'](?<part>[A-Za-z0-9][A-Za-z0-9_.-]{0,127})#(?<anchor>[^\"']+)[\"']", match =>
        {
            var partId = match.Groups["part"].Value;
            if (!partSlugs.TryGetValue(partId, out var slug))
            {
                if (strict) throw new ArgumentException($"Composite cross-part reference targets unknown part '{partId}'.");
                return match.Value;
            }
            return $"href=\"#{slug}-{SafeFileName(match.Groups["anchor"].Value)}\"";
        }, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    }

    private static string RemoveLeadingDuplicateHeading(string html, string expectedTitle)
    {
        if (string.IsNullOrWhiteSpace(html) || string.IsNullOrWhiteSpace(expectedTitle)) return html;
        var match = Regex.Match(html, @"^\s*<h1\b(?<attrs>[^>]*)>(?<content>.*?)</h1>\s*",
            RegexOptions.IgnoreCase | RegexOptions.Singleline | RegexOptions.CultureInvariant);
        if (!match.Success) return html;
        var headingText = Regex.Replace(match.Groups["content"].Value, "<[^>]+>", string.Empty, RegexOptions.CultureInvariant);
        if (!string.Equals(NormalizeHeadingText(headingText), NormalizeHeadingText(expectedTitle), StringComparison.Ordinal)) return html;
        return html[(match.Index + match.Length)..].TrimStart();
    }

    private static string NormalizeHeadingText(string value) =>
        Regex.Replace(System.Net.WebUtility.HtmlDecode(value), @"\s+", " ", RegexOptions.CultureInvariant).Trim().ToLowerInvariant();

    private static string RewritePartFragments(string html, string prefix, List<(int Level, string Text, string Id)> headings)
    {
        var idMap = new Dictionary<string, string>(StringComparer.Ordinal);
        var headingIndex = 0;
        html = Regex.Replace(html, "<(h[1-6])(?<attrs>[^>]*)>(?<content>.*?)</\\1>", match =>
        {
            headingIndex++;
            var attrs = match.Groups["attrs"].Value;
            var idMatch = Regex.Match(attrs, "\\bid=[\\\"'](?<id>[^\\\"']+)[\\\"']", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
            var oldId = idMatch.Success ? idMatch.Groups["id"].Value : $"heading-{headingIndex:D3}";
            var newId = prefix + "-" + SafeFileName(oldId);
            idMap[oldId] = newId;
            attrs = idMatch.Success ? Regex.Replace(attrs, "\\bid=[\\\"'][^\\\"']+[\\\"']", $"id=\"{newId}\"", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant) : attrs + $" id=\"{newId}\"";
            var level = int.Parse(match.Groups[1].Value[1..], System.Globalization.CultureInfo.InvariantCulture);
            var text = Regex.Replace(match.Groups["content"].Value, "<[^>]+>", string.Empty, RegexOptions.CultureInvariant);
            headings.Add((level, System.Net.WebUtility.HtmlDecode(text).Trim(), newId));
            return "<" + match.Groups[1].Value + attrs + ">" + match.Groups["content"].Value + "</" + match.Groups[1].Value + ">";
        }, RegexOptions.IgnoreCase | RegexOptions.Singleline | RegexOptions.CultureInvariant);
        html = Regex.Replace(html, "\\bid=[\\\"'](?<id>[^\\\"']+)[\\\"']", match =>
        {
            var oldId = match.Groups["id"].Value;
            if (oldId.StartsWith(prefix + "-", StringComparison.Ordinal)) return match.Value;
            var newId = prefix + "-" + SafeFileName(oldId);
            idMap[oldId] = newId;
            return $"id=\"{newId}\"";
        }, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
        return Regex.Replace(html, "\\bhref=[\\\"']#(?<id>[^\\\"']+)[\\\"']", match =>
        {
            var oldId = match.Groups["id"].Value;
            var newId = idMap.TryGetValue(oldId, out var mapped) ? mapped : prefix + "-" + SafeFileName(oldId);
            return $"href=\"#{newId}\"";
        }, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    }

    private static string ValidatePageSize(string value)
    {
        value = value.Trim();
        if (!Regex.IsMatch(value, "^(A[0-6]|Letter|Legal|Tabloid|Ledger|[0-9]+(?:\\.[0-9]+)?(?:mm|cm|in)\\s+[0-9]+(?:\\.[0-9]+)?(?:mm|cm|in))$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant))
            throw new ArgumentException($"Unsupported composite page size '{value}'.");
        return value;
    }

    private static string ValidateCssLength(string value)
    {
        value = value.Trim();
        if (!Regex.IsMatch(value, "^(0|[0-9]+(?:\\.[0-9]+)?(?:mm|cm|in|pt|px))$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant))
            throw new ArgumentException($"Invalid composite page margin '{value}'.");
        return value;
    }

    private static (DocumentSourceType SourceType, string Content, string DocumentName, TemplateExpansionMetadata Metadata) ExpandTemplate(
        string inlineContent,
        RuneTemplateOptions templateOptions,
        IReadOnlyList<DecodedResource> resources,
        IReadOnlyDictionary<string, string> textResources)
    {
        var templateResource = string.IsNullOrWhiteSpace(templateOptions.TemplateResourcePath)
            ? null
            : resources.SingleOrDefault(resource => string.Equals(resource.Path, templateOptions.TemplateResourcePath, StringComparison.OrdinalIgnoreCase));
        if (!string.IsNullOrWhiteSpace(templateOptions.TemplateResourcePath) && templateResource is null)
            throw new ArgumentException($"Template resource '{templateOptions.TemplateResourcePath}' was not found.");
        var templateContent = templateResource is null ? inlineContent : Encoding.UTF8.GetString(templateResource.Content);
        var dataResource = resources.SingleOrDefault(resource => string.Equals(resource.Path, templateOptions.DataResourcePath, StringComparison.OrdinalIgnoreCase))
            ?? throw new ArgumentException($"Template data resource '{templateOptions.DataResourcePath}' was not found.");
        using var dataDocument = JsonDocument.Parse(dataResource.Content);
        JsonDocument? effectiveDataDocument = null;
        var effectiveData = dataDocument.RootElement;
        if (!string.IsNullOrWhiteSpace(templateOptions.DataSchemaResourcePath))
        {
            var schemaResource = resources.SingleOrDefault(resource => string.Equals(resource.Path, templateOptions.DataSchemaResourcePath, StringComparison.OrdinalIgnoreCase))
                ?? throw new ArgumentException($"Template data schema resource '{templateOptions.DataSchemaResourcePath}' was not found.");
            using var schemaDocument = JsonDocument.Parse(schemaResource.Content);
            RuneTemplateEngine.ValidateSchema(dataDocument.RootElement, schemaDocument.RootElement, templateOptions);
            if (templateOptions.ApplySchemaDefaults)
            {
                effectiveDataDocument = RuneTemplateEngine.ApplySchemaDefaults(dataDocument.RootElement, schemaDocument.RootElement, templateOptions);
                effectiveData = effectiveDataDocument.RootElement;
                RuneTemplateEngine.ValidateSchema(effectiveData, schemaDocument.RootElement, templateOptions);
            }
        }
        var expansion = RuneTemplateEngine.Expand(templateContent, effectiveData, templateOptions, textResources);
        effectiveDataDocument?.Dispose();
        var sourceType = templateOptions.ContentType == TemplateContentType.Markdown ? DocumentSourceType.Markdown : DocumentSourceType.Html;
        var name = templateOptions.ContentType == TemplateContentType.Markdown ? "expanded-template.md" : "expanded-template.html";
        return (sourceType, expansion.Content, name, expansion.Metadata!);
    }

    private static string SafeFileName(string value) => Regex.Replace(value.ToLowerInvariant(), "[^a-z0-9]+", "-").Trim('-');

    private static void Validate(RenderRequest request)
    {
        if (request.SourceType is not (DocumentSourceType.Pdf or DocumentSourceType.Template or DocumentSourceType.Composite) && string.IsNullOrWhiteSpace(request.Content))
            throw new ArgumentException("Document content is required.", nameof(request));
        if (request.SourceType == DocumentSourceType.Composite && (request.Composite?.Parts is null || request.Composite.Parts.Count == 0))
            throw new ArgumentException("Composite input requires at least one part.", nameof(request));
        if (request.SourceType != DocumentSourceType.Composite && request.Composite is not null)
            throw new ArgumentException("Composite options are valid only for composite input.", nameof(request));
        if (request.SourceType == DocumentSourceType.Template && string.IsNullOrWhiteSpace(request.Content) && string.IsNullOrWhiteSpace(request.Template?.TemplateResourcePath))
            throw new ArgumentException("Template content or templateResourcePath is required.", nameof(request));
        if (request.Content.Length > MaximumDocumentCharacters) throw new ArgumentException($"Document content exceeds {MaximumDocumentCharacters} characters.", nameof(request));
        if (request.OutputFormats is not null && request.OutputFormat is not null)
            throw new ArgumentException("Exactly one of outputFormat and outputFormats may be supplied.", nameof(request));
        if (request.OutputFormats is { Count: 0 })
            throw new ArgumentException("outputFormats must contain at least one format.", nameof(request));
        if (request.OutputFormats is not null)
            _ = request.OutputFormats.NormalizeOutputSet();
        if (request.MultiOutput is not null && request.OutputFormats is null)
            throw new ArgumentException("multiOutput is valid only when outputFormats is supplied.", nameof(request));
        if (request.OutputFormats is { Count: > 0 } && request.SourceType == DocumentSourceType.Pdf)
            throw new ArgumentException("Atomic multi-output rendering is not supported for PDF import.", nameof(request));
        if (request.Composite?.Parts.Count > 100)
            throw new ArgumentException("Composite input supports at most 100 parts.", nameof(request));
        if (request.SourceType == DocumentSourceType.Pdf)
        {
            if ((request.OutputFormat ?? RenderOutputFormat.StaticHtml) != RenderOutputFormat.StaticHtml)
                throw new ArgumentException("PDF input currently supports only staticHtml output.", nameof(request));
            if (!string.IsNullOrWhiteSpace(request.PdfImport?.Password) || request.PdfImport?.RejectEncryptedPdf == false)
                throw new ArgumentException("Encrypted or permission-restricted PDF input is rejected by the stable contract.", nameof(request));
            if (string.IsNullOrWhiteSpace(request.SourceResourcePath))
                throw new ArgumentException("SourceResourcePath is required for PDF input.", nameof(request));
        }
        var options = request.Options ?? new RenderOptions();
        if (options.Width is < 320 or > 8_000 || options.Height is < 240 or > 8_000)
            throw new ArgumentException("Viewport dimensions are outside the supported range.", nameof(request));
        if (options.TimeoutSeconds is < 1 or > 300)
            throw new ArgumentException("TimeoutSeconds must be between 1 and 300.", nameof(request));
        if (string.IsNullOrWhiteSpace(request.DocumentName) || request.DocumentName.Length > 500 ||
            Path.IsPathRooted(request.DocumentName) || request.DocumentName.Contains("..", StringComparison.Ordinal))
            throw new ArgumentException("DocumentName must be a safe relative path.", nameof(request));
        if (request.WaitTimeoutSeconds is < 0 or > 30)
            throw new ArgumentException("WaitTimeoutSeconds must be between 0 and 30.", nameof(request));
        if (request.Options?.JpegQuality is < 1 or > 100)
            throw new ArgumentException("JpegQuality must be between 1 and 100.", nameof(request));
        if (request.IdempotencyKey?.Length > 200)
            throw new ArgumentException("IdempotencyKey cannot exceed 200 characters.", nameof(request));
        if (options.AdditionalCss?.Length > 1_000_000)
            throw new ArgumentException("Additional CSS exceeds the supported size.", nameof(request));
        if (options.AdditionalCss?.Contains('<', StringComparison.Ordinal) == true)
            throw new ArgumentException("Additional CSS cannot contain HTML markup.", nameof(request));
        if (options.HeaderTemplate?.Contains("<script", StringComparison.OrdinalIgnoreCase) == true ||
            options.FooterTemplate?.Contains("<script", StringComparison.OrdinalIgnoreCase) == true)
            throw new ArgumentException("Header and footer templates cannot contain scripts.", nameof(request));
        if (options.CachePolicy is { MaximumAgeSeconds: < 0 or > 31_536_000 })
            throw new ArgumentException("Cache maximumAgeSeconds must be between 0 and 31536000.", nameof(request));
        ValidatePublication(request.MultiOutput ?? options.Publication);
    }

    private static void ValidatePublication(MultiOutputPublicationOptions? publication)
    {
        if (publication is null) return;
        if (publication.AtomicPolicy != MultiOutputAtomicPolicy.Required)
            throw new ArgumentException("The stable multi-output contract requires atomic publication.");
        if (publication.MaximumZipBytes is < 1 or > 2_000_000_000)
            throw new ArgumentException("multiOutput.maximumZipBytes is outside the supported range.");
        if (publication.MaximumZipEntries is < 1 or > 256)
            throw new ArgumentException("multiOutput.maximumZipEntries is outside the supported range.");
        var pattern = publication.ArtifactNamePattern;
        if (string.IsNullOrWhiteSpace(pattern) || pattern.Length > 240 || pattern.Contains("..", StringComparison.Ordinal) ||
            pattern.Contains('/') || pattern.Contains('\\'))
            throw new ArgumentException("multiOutput.artifactNamePattern must be a safe file-name pattern.");
        var withoutTokens = Regex.Replace(pattern, "\\{(?:documentName|output|outputExtension)\\}", string.Empty, RegexOptions.CultureInvariant);
        if (withoutTokens.Contains('{') || withoutTokens.Contains('}'))
            throw new ArgumentException("multiOutput.artifactNamePattern contains an unsupported token.");
    }

    private async ValueTask<object> QueuePdfAsync(
        RenderRequest request,
        IReadOnlyList<DecodedResource> resources,
        CancellationToken cancellationToken)
    {
        var sourcePath = request.SourceResourcePath!.Replace('\\', '/').TrimStart('/');
        var source = resources.SingleOrDefault(resource => string.Equals(resource.Path, sourcePath, StringComparison.OrdinalIgnoreCase))
            ?? throw new ArgumentException($"PDF source resource '{sourcePath}' was not found.", nameof(request));
        if (!string.Equals(source.ContentType, "application/pdf", StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("The PDF source resource must use content type application/pdf.", nameof(request));
        if (source.Content.Length < 8 || source.Content.AsSpan(0, Math.Min(1024, source.Content.Length)).IndexOf("%PDF-"u8) < 0)
            throw new ArgumentException("The source resource does not contain a valid PDF signature.", nameof(request));

        var job = await jobs.CreatePdfAsync(
            source.Content,
            sourcePath,
            request.PdfImport ?? new PdfImportOptions(),
            request.Options ?? new RenderOptions(),
            request.IdempotencyKey,
            cancellationToken: cancellationToken);
        if (job.Status == Rune.Job.Contracts.RenderJobStatus.Queued && job.Attempt == 0)
            await outbox.PublishAsync(job.Id, cancellationToken);
        return new RenderAcceptedResponse(job.Id, job.Status.ToString().ToLowerInvariant(),
            $"/v1/renders/{job.Id}", $"/v1/renders/{job.Id}/content",
            $"/v1/renders/{job.Id}/events", job.CreatedAt);
    }

    private static IReadOnlyList<DecodedResource> DecodeResources(IReadOnlyList<ResourceInput>? resources)
    {
        if (resources is null || resources.Count == 0) return [];
        if (resources.Count > 100) throw new ArgumentException("A maximum of 100 resources is supported.", nameof(resources));
        var result = new List<DecodedResource>(resources.Count);
        var seenPaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var totalBytes = 0;
        foreach (var resource in resources)
        {
            var path = resource.Path.Replace('\\', '/').TrimStart('/');
            if (string.IsNullOrWhiteSpace(path) || path.Contains("..", StringComparison.Ordinal) || Path.IsPathRooted(resource.Path))
                throw new ArgumentException($"Unsafe resource path: {resource.Path}", nameof(resources));
            if (!seenPaths.Add(path)) throw new ArgumentException($"Duplicate resource path: {path}", nameof(resources));
            var estimatedBytes = resource.ContentBase64.Length * 3L / 4L;
            if (totalBytes + estimatedBytes > MaximumResourceBytes)
                throw new ArgumentException($"Resources exceed {MaximumResourceBytes} bytes.", nameof(resources));
            byte[] content;
            try { content = Convert.FromBase64String(resource.ContentBase64); }
            catch (FormatException exception) { throw new ArgumentException($"Resource {path} is not valid Base64.", nameof(resources), exception); }
            totalBytes += content.Length;
            if (totalBytes > MaximumResourceBytes)
                throw new ArgumentException($"Resources exceed {MaximumResourceBytes} bytes.", nameof(resources));
            var contentType = resource.ContentType ?? InferContentType(path);
            if (!Regex.IsMatch(contentType, "^[A-Za-z0-9!#$&^_.+-]+/[A-Za-z0-9!#$&^_.+-]+$"))
                throw new ArgumentException($"Invalid content type for resource {path}.", nameof(resources));
            result.Add(new(path, contentType, content));
        }
        return result;
    }

    private static string EmbedResources(string html, IReadOnlyList<DecodedResource> resources)
    {
        foreach (var resource in resources)
        {
            var dataUri = $"data:{resource.ContentType};base64,{Convert.ToBase64String(resource.Content)}";
            var escapedPath = Regex.Escape(resource.Path);
            html = Regex.Replace(
                html,
                $"(?<attribute>src|href)=(?<quote>[\\\"']){escapedPath}\\k<quote>",
                match => $"{match.Groups["attribute"].Value}={match.Groups["quote"].Value}{dataUri}{match.Groups["quote"].Value}",
                RegexOptions.IgnoreCase);
        }
        return html;
    }

    private static bool IsTextResource(string path, string contentType) =>
        contentType.StartsWith("text/", StringComparison.OrdinalIgnoreCase) ||
        new[] { ".md", ".markdown", ".txt", ".json", ".yaml", ".yml", ".csv", ".tsv" }
            .Contains(Path.GetExtension(path), StringComparer.OrdinalIgnoreCase);

    private static string InferContentType(string path) => Path.GetExtension(path).ToLowerInvariant() switch
    {
        ".png" => "image/png",
        ".jpg" or ".jpeg" => "image/jpeg",
        ".gif" => "image/gif",
        ".svg" => "image/svg+xml",
        ".webp" => "image/webp",
        ".avif" => "image/avif",
        ".woff2" => "font/woff2",
        ".woff" => "font/woff",
        ".ttf" => "font/ttf",
        ".css" => "text/css",
        ".json" => "application/json",
        ".yaml" or ".yml" => "application/yaml",
        ".csv" => "text/csv",
        ".tsv" => "text/tab-separated-values",
        ".md" or ".markdown" => "text/markdown",
        ".pdf" => "application/pdf",
        _ => "application/octet-stream"
    };

    private sealed record DecodedResource(string Path, string ContentType, byte[] Content);
}
