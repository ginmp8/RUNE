import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
for (const marker of [
  'interactiveHtml', 'structuredJson', 'pdfA', 'waitForCompletion',
  '/v1/render', '/cancel', '/retry', '/content', '/conversion-report', '/events', '/v1/features', '/v1/schemas', 'async wait', 'async list',
  '"pdf"', 'PdfImportOptions', 'sourceResourcePath', 'pdfImport', 'conversionReportPath', 'template', 'outputFormats', 'TemplateOptions', 'FontOptions', 'RenderCachePolicy', 'cacheFingerprint', 'composite', 'CompositeDocumentOptions', 'compareArtifacts', 'createComparison', '/v1/comparisons', 'comparisonStatus', 'cancelComparison', 'retryComparison', 'comparisonEvents', 'comparisonReport', 'comparisonManifest', 'allowRawInterpolation', 'licensePolicy', 'maximumScopeEntries'
]) assert.ok(source.includes(marker), `missing TypeScript client contract marker: ${marker}`);
console.log('TypeScript client contract passed');
