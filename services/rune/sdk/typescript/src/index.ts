export type SourceType = "markdown" | "html" | "pdf" | "template" | "composite";
export type OutputFormat = "interactiveHtml" | "staticHtml" | "structuredJson" | "pdf" | "pdfA" | "png" | "jpeg" | "svg";
export type JobStatus = "queued" | "claimed" | "rendering" | "cancelRequested" | "cancelled" | "completed" | "failed";
export type ComparisonJobStatus = "queued" | "running" | "cancelRequested" | "cancelled" | "completed" | "failed";
export type ComparisonOutcome = "identical" | "equivalentUnderProfile" | "different" | "incomparable" | "failed";

export interface TemplateOptions {
  syntax?: "rune-template-v1";
  contentType?: "markdown" | "html";
  templateResourcePath?: string;
  dataResourcePath: string;
  dataSchemaResourcePath?: string;
  strict?: boolean;
  missingValuePolicy?: "fail" | "empty";
  culture?: string;
  timeZone?: string;
  escapingMode?: "contextual" | "plainText";
  maximumIterations?: number;
  maximumOutputCharacters?: number;
  maximumDepth?: number;
  maximumPartialDepth?: number;
  maximumInstructionSteps?: number;
  maximumLoopIterations?: number;
  maximumGlobalLoopIterations?: number;
  maximumSchemaErrors?: number;
  applySchemaDefaults?: boolean;
  partialsResourcePrefix?: string;
  allowRawInterpolation?: boolean;
  allowedHelpers?: Array<"upper" | "lower" | "trim" | "default" | "number" | "currency" | "date" | "json" | "join">;
  customHelpers?: Array<{ name: string; operations: Array<{ operation: string; argument?: string; secondArgument?: string }> }>;
}

export interface FontFaceDescriptor {
  family: string;
  resourcePath: string;
  weight?: number;
  style?: "normal" | "italic" | "oblique";
  stretch?: string;
  sha256?: string;
  licenseSpdx?: string;
  licenseAllowsEmbedding?: boolean;
}
export interface FontOptions {
  faces: FontFaceDescriptor[];
  defaultFamily?: string;
  fallbackFamilies?: string[];
  missingFacePolicy?: "fail";
  missingGlyphPolicy?: "fallback" | "fail";
  embedPolicy?: "required";
  subsetPolicy?: "full" | "auto";
  licensePolicy?: "allow" | "deny" | "requireMetadata";
  allowedLicenses?: string[];
  deniedLicenses?: string[];
  analyzeGlyphCoverage?: boolean;
  requiredCharacters?: string;
  builtInFallbackPack?: "rune-deterministic-fonts-v1";
  builtInFallbackPackSha256?: string;
  fontReadinessTimeoutSeconds?: number;
  disableHostFontLookup?: true;
  disableRemoteFontAcquisition?: true;
}
export interface RenderCachePolicy {
  mode?: "bypass" | "read" | "write" | "use" | "refresh";
  scope?: string;
  maximumAgeSeconds?: number;
  storeResult?: boolean;
  requireDeterministicInputs?: boolean;
  maximumScopeBytes?: number;
  maximumScopeEntries?: number;
  distributedLockTimeoutSeconds?: number;
  staleLockSeconds?: number;
  invalidationToken?: string;
  store?: "filesystem" | "shared-filesystem";
  reauthorizeOnHit?: boolean;
  quarantineCorruptEntries?: boolean;
  preservePriorEntryOnRefreshFailure?: boolean;
  encryptSensitiveEntries?: boolean;
  securityLabel?: string;
}
export interface MultiOutputPublicationOptions {
  atomicPolicy?: "required";
  packageMode?: "none" | "zip";
  artifactNamePattern?: string;
  includeManifest?: boolean;
  includeProvenance?: boolean;
  maximumZipBytes?: number;
  maximumZipEntries?: number;
}

export interface CompositeDocumentPart {
  id?: string;
  name: string;
  sourceType: SourceType;
  content?: string;
  resourcePath?: string;
  template?: TemplateOptions;
  htmlTrustMode?: "safe" | "trusted";
  startOnNewPage?: boolean;
  composite?: CompositeDocumentOptions;
  pageSize?: string;
  landscape?: boolean;
  marginTop?: string;
  marginRight?: string;
  marginBottom?: string;
  marginLeft?: string;
  pdfImport?: PdfImportOptions;
  sectionName?: string;
  pageLabel?: string;
  restartNumbering?: boolean;
  failOnSemanticLoss?: boolean;
}
export interface CompositeDocumentOptions {
  parts: CompositeDocumentPart[];
  mode?: "logical" | "rendered" | "hybrid" | "auto";
  includePartTitles?: boolean;
  pageBreakBetweenParts?: boolean;
  rewriteTableOfContents?: boolean;
  failOnSemanticLoss?: boolean;
  maximumDepth?: number;
  maximumPages?: number;
  maximumAggregateResourceBytes?: number;
  maximumObjects?: number;
  maximumImages?: number;
  maximumFonts?: number;
  timeoutSeconds?: number;
}

export interface PdfAnnotationPolicies {
  links?: "preserve" | "remove";
  comments?: "flatten" | "reject" | "remove";
  attachments?: "reject" | "remove";
}
export interface PdfImportOptions {
  mode: "visual" | "semantic" | "hybrid" | "native-page";
  ocrMode?: "off" | "auto" | "force";
  semanticConfidenceThreshold?: number;
  maximumPages?: number;
  maximumSourceBytes?: number;
  maximumOutputBytes?: number;
  visualScale?: number;
  emitRegionDiagnostics?: boolean;
  preserveLinks?: boolean;
  extractImages?: boolean;
  ocrLanguage?: string;
  signatures?: "reject" | "flatten" | "ignore";
  forms?: "flatten" | "reject";
  annotations?: PdfAnnotationPolicies;
  javascript?: "remove" | "reject";
  fallback?: "visual" | "reject";
  provider?: string;
  ocrProvider?: string;
  ocrModel?: string;
  ocrModelVersion?: string;
  ocrModelSha256?: string;
  providerTimeoutSeconds?: number;
  providerMemoryLimitMegabytes?: number;
  disableNetwork?: true;
  requireNonRoot?: true;
  rejectEncryptedPdf?: true;
}

export interface RenderRequest {
  sourceType: SourceType;
  content?: string;
  outputFormat?: OutputFormat;
  outputFormats?: OutputFormat[];
  htmlTrustMode?: "safe" | "trusted";
  documentName?: string;
  idempotencyKey?: string;
  options?: Record<string, unknown> & { fonts?: FontOptions; cachePolicy?: RenderCachePolicy };
  resources?: Array<{ path: string; contentBase64: string; contentType?: string }>;
  waitForCompletion?: boolean;
  waitTimeoutSeconds?: number;
  sourceResourcePath?: string;
  pdfImport?: PdfImportOptions;
  template?: TemplateOptions;
  composite?: CompositeDocumentOptions;
  multiOutput?: MultiOutputPublicationOptions;
}

export interface RenderAccepted { renderId: string; status: string; statusUrl: string; resultUrl: string; eventsUrl: string; createdAt: string; }
export interface RenderJob {
  id: string;
  status: JobStatus;
  outputFormat?: OutputFormat;
  outputFormats?: OutputFormat[];
  attempt: number;
  maximumAttempts: number;
  progressPercent: number;
  progressStage?: string;
  outputProgress?: Record<string, { status: string; progressPercent: number; stage?: string }>;
  error?: string;
  resultLength?: number;
  conversionReportPath?: string;
  cacheStatus?: "hit" | "miss" | "refresh" | "bypass";
  cacheFingerprint?: string;
  cacheSourceRenderId?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}
export interface RenderJobResponse { job: RenderJob; statusUrl: string; resultUrl: string; eventsUrl: string; resultAvailable: boolean; }
export interface RenderJobPage { items: RenderJob[]; offset: number; limit: number; total: number; }
export interface HtmlRenderResponse { contentType: string; html: string; requiredRenderers: string[]; diagnostics: unknown[]; }
export interface StructuredDocumentResponse { contentType: string; document: Record<string, unknown>; }
export type RenderResponse = RenderAccepted | HtmlRenderResponse | StructuredDocumentResponse;

export interface ComparisonArtifactReference { renderId: string; artifactName?: string; }
export interface ArtifactComparisonProfile {
  name?: string;
  version?: string;
  compareIdentity?: boolean;
  compareSemantic?: boolean;
  compareStructure?: boolean;
  compareVisual?: boolean;
  compareOcr?: boolean;
  canonicalizePdf?: boolean;
  normalizeText?: boolean;
  includeByteRanges?: boolean;
  maximumReportedRanges?: number;
  pixelTolerancePercent?: number;
  maximumPixelMismatchRatio?: number;
  minimumOcrSimilarity?: number;
  rasterDpi?: number;
  ocrLanguage?: string;
  timeoutSeconds?: number;
  ignoredFields?: string[];
}
export interface CreateComparisonJobRequest {
  left: ComparisonArtifactReference;
  right: ComparisonArtifactReference;
  profile?: ArtifactComparisonProfile;
  idempotencyKey?: string;
  retentionDays?: number;
}
export interface ComparisonJobAccepted { id: string; statusUrl: string; eventsUrl: string; existing?: string; }
export interface ComparisonJobResponse {
  id: string;
  status: ComparisonJobStatus;
  left: ComparisonArtifactReference;
  right: ComparisonArtifactReference;
  profileName: string;
  profileVersion: string;
  profileDigest: string;
  tenant: string;
  progressPercent: number;
  progressStage: string;
  attempt: number;
  maximumAttempts: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  outcome?: ComparisonOutcome;
  error?: string;
  reportJsonUrl?: string;
  reportHtmlUrl?: string;
  manifestUrl?: string;
  securityLabel?: string;
  retainUntil?: string;
}

export class RuneClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetcher: typeof fetch = fetch,
    private readonly tenant = "default",
  ) {}

  async render(request: RenderRequest): Promise<RenderResponse> {
    if (request.outputFormats?.length && request.outputFormat !== undefined) {
      throw new Error("outputFormat and outputFormats are mutually exclusive.");
    }
    if (request.pdfImport && "password" in request.pdfImport) {
      throw new Error("Encrypted or permission-restricted PDFs are rejected by the stable RUNE contract.");
    }
    return this.request<RenderResponse>("/v1/render", { method: "POST", body: JSON.stringify(request) });
  }

  /** @deprecated Synchronous Base64 comparison was retired in RUNE 0.18.0. */
  async compareArtifacts(): Promise<never> {
    throw new Error("Synchronous Base64 comparison was retired. Use createComparison().");
  }

  async createComparison(request: CreateComparisonJobRequest): Promise<ComparisonJobAccepted> {
    return this.request<ComparisonJobAccepted>("/v1/comparisons", { method: "POST", body: JSON.stringify(request) });
  }
  async comparisonStatus(id: string): Promise<ComparisonJobResponse> { return this.request(`/v1/comparisons/${encodeURIComponent(id)}`); }
  async waitComparison(id: string, timeoutMs = 120_000, pollIntervalMs = 500): Promise<ComparisonJobResponse> {
    const deadline = Date.now() + timeoutMs;
    while (true) {
      const job = await this.comparisonStatus(id);
      if (["completed", "failed", "cancelled"].includes(job.status) || Date.now() >= deadline) return job;
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
  }
  async cancelComparison(id: string, reason?: string): Promise<unknown> {
    return this.request(`/v1/comparisons/${encodeURIComponent(id)}/cancel`, { method: "POST", body: JSON.stringify({ reason }) });
  }
  async retryComparison(id: string, resetAttempts = false): Promise<ComparisonJobResponse> {
    await this.request(`/v1/comparisons/${encodeURIComponent(id)}/retry`, { method: "POST", body: JSON.stringify({ resetAttempts }) });
    return this.comparisonStatus(id);
  }
  comparisonEvents(id: string): EventSource { return new EventSource(this.url(`/v1/comparisons/${encodeURIComponent(id)}/events`)); }
  async comparisonReport(id: string, html = false): Promise<Blob> { return this.downloadBlob(`/v1/comparisons/${encodeURIComponent(id)}/${html ? "report.html" : "report.json"}`); }
  async comparisonManifest(id: string): Promise<Record<string, unknown>> { return this.request(`/v1/comparisons/${encodeURIComponent(id)}/manifest`); }

  async status(renderId: string): Promise<RenderJobResponse> { return this.request(`/v1/renders/${encodeURIComponent(renderId)}`); }
  async list(query: { status?: JobStatus; offset?: number; limit?: number; createdAfter?: string; createdBefore?: string } = {}): Promise<RenderJobPage> {
    const parameters = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => { if (value !== undefined) parameters.set(key, String(value)); });
    const suffix = parameters.size ? `?${parameters}` : "";
    return this.request<RenderJobPage>(`/v1/renders${suffix}`);
  }
  async wait(renderId: string, timeoutMs = 120_000, pollIntervalMs = 500): Promise<RenderJobResponse> {
    const deadline = Date.now() + timeoutMs;
    while (true) {
      const response = await this.status(renderId);
      if (["completed", "failed", "cancelled"].includes(response.job.status) || Date.now() >= deadline) return response;
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
  }
  async cancel(renderId: string, reason?: string): Promise<unknown> { return this.request(`/v1/renders/${encodeURIComponent(renderId)}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }); }
  async retry(renderId: string, resetAttempts = false): Promise<RenderJobResponse> { return this.request(`/v1/renders/${encodeURIComponent(renderId)}/retry`, { method: "POST", body: JSON.stringify({ resetAttempts }) }); }
  async download(renderId: string): Promise<Blob> { return this.downloadBlob(`/v1/renders/${encodeURIComponent(renderId)}/content`); }
  async conversionReport(renderId: string): Promise<Record<string, unknown>> { return this.request(`/v1/renders/${encodeURIComponent(renderId)}/conversion-report`); }
  async artifactManifest(renderId: string): Promise<Record<string, unknown>> { return this.request(`/v1/renders/${encodeURIComponent(renderId)}/artifacts`); }
  async artifact(renderId: string, name: string): Promise<Blob> { return this.downloadBlob(`/v1/renders/${encodeURIComponent(renderId)}/artifacts/${encodeURIComponent(name)}`); }
  async artifactPackage(renderId: string): Promise<Blob> { return this.downloadBlob(`/v1/renders/${encodeURIComponent(renderId)}/package`); }
  async features(): Promise<Record<string, unknown>> { return this.request("/v1/features"); }
  async schemas(): Promise<string[]> { return this.request("/v1/schemas"); }
  async schema(name: string): Promise<Record<string, unknown>> { return this.request(`/v1/schemas/${encodeURIComponent(name)}`); }
  events(renderId: string): EventSource { return new EventSource(this.url(`/v1/renders/${encodeURIComponent(renderId)}/events`)); }

  private async downloadBlob(path: string): Promise<Blob> {
    const response = await this.fetcher(this.url(path), { headers: this.headers(false) });
    if (!response.ok) throw new Error(await response.text());
    return response.blob();
  }
  private async request<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.fetcher(this.url(path), { ...init, headers: { ...this.headers(Boolean(init.body)), ...init.headers } });
    if (!response.ok) throw new Error(await response.text());
    return response.json() as Promise<T>;
  }
  private headers(json: boolean): Record<string, string> {
    return { ...(json ? { "content-type": "application/json" } : {}), "X-RUNE-Tenant": this.tenant };
  }
  private url(path: string): string { return `${this.baseUrl.replace(/\/$/, "")}${path}`; }
}
