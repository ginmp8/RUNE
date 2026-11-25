'use strict';

var chunkZJK7WHVT_cjs = require('../chunk-ZJK7WHVT.cjs');
require('../chunk-GOHAZF4E.cjs');
require('../chunk-H5EDPYH7.cjs');
require('../chunk-SRCHQ5FQ.cjs');
require('../chunk-5A6CVYMM.cjs');
require('../chunk-5ZC74S6U.cjs');
require('../chunk-RETPPUXH.cjs');
require('../chunk-FDQVLYPZ.cjs');
require('../chunk-3SMTOXJD.cjs');
require('../chunk-OLKFF6SV.cjs');
require('../chunk-I75B52F2.cjs');
require('../chunk-VZAMNYRV.cjs');
require('../chunk-GUCP6AKN.cjs');
require('../chunk-NTS45SH6.cjs');
require('../chunk-3GSIJMSI.cjs');
require('../chunk-OO27E4GU.cjs');
require('../chunk-JXJQEYL3.cjs');
require('../chunk-VGO4AJ4K.cjs');
require('../chunk-ICLXRCSE.cjs');
require('../chunk-JNSP3SUJ.cjs');
require('../chunk-2JVEMVHO.cjs');
require('../chunk-QPXUX7WK.cjs');
require('../chunk-EQMWWNB3.cjs');
require('../chunk-54Q7JDQB.cjs');
require('../chunk-MPA7DBNQ.cjs');
require('../chunk-SBB6C4OP.cjs');
require('../chunk-4M6OFAHM.cjs');
require('../chunk-7ZEDTSU3.cjs');

// src/ai/prompt-context.ts
function buildPromptContext(type, opts = {}) {
  const resolved = chunkZJK7WHVT_cjs.resolveDiagramType(type) ?? type;
  const detail = opts.detail ?? "canonical";
  const limit = opts.examples ?? 2;
  const { type: canonical, name, standard, syntax } = chunkZJK7WHVT_cjs.getSyntax(resolved, {
    detail
  });
  const parts = [
    `# ${name} (${canonical})`,
    `Standard: ${standard}`,
    "",
    syntax.content
  ];
  let exampleCount = 0;
  if (limit > 0) {
    const examples = chunkZJK7WHVT_cjs.getExamples(canonical, {
      preferFeatured: opts.preferFeatured ?? true,
      limit,
      maxComplexity: opts.maxComplexity
    }).examples;
    exampleCount = examples.length;
    if (examples.length > 0) {
      parts.push("", "## Worked examples");
      for (const ex of examples) {
        parts.push("", `### ${ex.title}`);
        if (ex.description) parts.push(ex.description);
        parts.push("```", ex.dsl.trim(), "```");
      }
    }
  }
  return {
    type: canonical,
    name,
    standard,
    text: parts.join("\n"),
    exampleCount
  };
}

Object.defineProperty(exports, "DIAGRAM_REGISTRY", {
  enumerable: true,
  get: function () { return chunkZJK7WHVT_cjs.DIAGRAM_REGISTRY; }
});
Object.defineProperty(exports, "DIAGRAM_SINCE", {
  enumerable: true,
  get: function () { return chunkZJK7WHVT_cjs.DIAGRAM_SINCE; }
});
Object.defineProperty(exports, "SCHEMATEX_TOOL_DEFINITIONS", {
  enumerable: true,
  get: function () { return chunkZJK7WHVT_cjs.SCHEMATEX_TOOL_DEFINITIONS; }
});
Object.defineProperty(exports, "applyDiagramEdits", {
  enumerable: true,
  get: function () { return chunkZJK7WHVT_cjs.applyDiagramEdits; }
});
Object.defineProperty(exports, "getAllDiagramTypes", {
  enumerable: true,
  get: function () { return chunkZJK7WHVT_cjs.getAllDiagramTypes; }
});
Object.defineProperty(exports, "getDiagramCapabilities", {
  enumerable: true,
  get: function () { return chunkZJK7WHVT_cjs.getDiagramCapabilities; }
});
Object.defineProperty(exports, "getDiagramMeta", {
  enumerable: true,
  get: function () { return chunkZJK7WHVT_cjs.getDiagramMeta; }
});
Object.defineProperty(exports, "getDiagramSince", {
  enumerable: true,
  get: function () { return chunkZJK7WHVT_cjs.getDiagramSince; }
});
Object.defineProperty(exports, "getExampleBySlug", {
  enumerable: true,
  get: function () { return chunkZJK7WHVT_cjs.getExampleBySlug; }
});
Object.defineProperty(exports, "getExamples", {
  enumerable: true,
  get: function () { return chunkZJK7WHVT_cjs.getExamples; }
});
Object.defineProperty(exports, "getSyntax", {
  enumerable: true,
  get: function () { return chunkZJK7WHVT_cjs.getSyntax; }
});
Object.defineProperty(exports, "inspectDiagram", {
  enumerable: true,
  get: function () { return chunkZJK7WHVT_cjs.inspectDiagram; }
});
Object.defineProperty(exports, "listDiagrams", {
  enumerable: true,
  get: function () { return chunkZJK7WHVT_cjs.listDiagrams; }
});
Object.defineProperty(exports, "renderDsl", {
  enumerable: true,
  get: function () { return chunkZJK7WHVT_cjs.renderDsl; }
});
Object.defineProperty(exports, "resolveDiagramType", {
  enumerable: true,
  get: function () { return chunkZJK7WHVT_cjs.resolveDiagramType; }
});
Object.defineProperty(exports, "validateDsl", {
  enumerable: true,
  get: function () { return chunkZJK7WHVT_cjs.validateDsl; }
});
exports.buildPromptContext = buildPromptContext;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map