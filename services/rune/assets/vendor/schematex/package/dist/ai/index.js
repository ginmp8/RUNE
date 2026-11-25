import { resolveDiagramType, getSyntax, getExamples } from '../chunk-QMOUCLLG.js';
export { DIAGRAM_REGISTRY, DIAGRAM_SINCE, SCHEMATEX_TOOL_DEFINITIONS, applyDiagramEdits, getAllDiagramTypes, getDiagramCapabilities, getDiagramMeta, getDiagramSince, getExampleBySlug, getExamples, getSyntax, inspectDiagram, listDiagrams, renderDsl, resolveDiagramType, validateDsl } from '../chunk-QMOUCLLG.js';
import '../chunk-UUDIMDT2.js';
import '../chunk-S5SCBZQA.js';
import '../chunk-HHD67KEI.js';
import '../chunk-LVOQHHOY.js';
import '../chunk-IIB6MJVI.js';
import '../chunk-UCXYF6LN.js';
import '../chunk-2KX4J7KX.js';
import '../chunk-R6GGQWDH.js';
import '../chunk-5IJDNJUJ.js';
import '../chunk-K2L56KX2.js';
import '../chunk-OASHF7KX.js';
import '../chunk-227KJGLB.js';
import '../chunk-NRSOPIUR.js';
import '../chunk-XWMX2GWP.js';
import '../chunk-FKNZ3DJB.js';
import '../chunk-6HBNH3AK.js';
import '../chunk-BTVWLNZ5.js';
import '../chunk-YC56U42M.js';
import '../chunk-QLXTXIFY.js';
import '../chunk-S5MF733M.js';
import '../chunk-IC64LCKF.js';
import '../chunk-AVFHQLGW.js';
import '../chunk-KO55AXPI.js';
import '../chunk-QDQTH6HV.js';
import '../chunk-PIV2A3HG.js';
import '../chunk-ISQCUPQR.js';
import '../chunk-ZUMTE4E7.js';

// src/ai/prompt-context.ts
function buildPromptContext(type, opts = {}) {
  const resolved = resolveDiagramType(type) ?? type;
  const detail = opts.detail ?? "canonical";
  const limit = opts.examples ?? 2;
  const { type: canonical, name, standard, syntax } = getSyntax(resolved, {
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
    const examples = getExamples(canonical, {
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

export { buildPromptContext };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map