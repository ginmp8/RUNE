import { SCHEMATEX_TOOL_DEFINITIONS, applyDiagramEdits, inspectDiagram, getDiagramCapabilities, renderDsl, validateDsl, getExamples, getSyntax, listDiagrams } from '../chunk-QMOUCLLG.js';
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
import { tool, jsonSchema } from 'ai';

function inputSchema(definition) {
  return jsonSchema(definition.inputSchema);
}
var schematexTools = {
  listDiagrams: tool({
    description: SCHEMATEX_TOOL_DEFINITIONS.listDiagrams.description,
    inputSchema: inputSchema(SCHEMATEX_TOOL_DEFINITIONS.listDiagrams),
    execute: async () => listDiagrams()
  }),
  getSyntax: tool({
    description: SCHEMATEX_TOOL_DEFINITIONS.getSyntax.description,
    inputSchema: inputSchema(SCHEMATEX_TOOL_DEFINITIONS.getSyntax),
    execute: async ({ type, detail }) => getSyntax(type, { detail })
  }),
  getExamples: tool({
    description: SCHEMATEX_TOOL_DEFINITIONS.getExamples.description,
    inputSchema: inputSchema(SCHEMATEX_TOOL_DEFINITIONS.getExamples),
    execute: async ({ type, limit, preferFeatured, maxComplexity }) => getExamples(type, { limit, preferFeatured, maxComplexity })
  }),
  validateDsl: tool({
    description: SCHEMATEX_TOOL_DEFINITIONS.validateDsl.description,
    inputSchema: inputSchema(SCHEMATEX_TOOL_DEFINITIONS.validateDsl),
    execute: async ({ type, dsl }) => validateDsl(type, dsl)
  }),
  renderDsl: tool({
    description: SCHEMATEX_TOOL_DEFINITIONS.renderDsl.description,
    inputSchema: inputSchema(SCHEMATEX_TOOL_DEFINITIONS.renderDsl),
    execute: async ({ type, dsl, theme, padding }) => renderDsl(type, dsl, { theme, padding })
  }),
  getDiagramCapabilities: tool({
    description: SCHEMATEX_TOOL_DEFINITIONS.getDiagramCapabilities.description,
    inputSchema: inputSchema(SCHEMATEX_TOOL_DEFINITIONS.getDiagramCapabilities),
    execute: async ({ type }) => getDiagramCapabilities(type)
  }),
  inspectDiagram: tool({
    description: SCHEMATEX_TOOL_DEFINITIONS.inspectDiagram.description,
    inputSchema: inputSchema(SCHEMATEX_TOOL_DEFINITIONS.inspectDiagram),
    execute: async ({ type, dsl }) => inspectDiagram(type, dsl)
  }),
  applyDiagramEdits: tool({
    description: SCHEMATEX_TOOL_DEFINITIONS.applyDiagramEdits.description,
    inputSchema: inputSchema(SCHEMATEX_TOOL_DEFINITIONS.applyDiagramEdits),
    execute: async ({ type, dsl, revision, edits }) => applyDiagramEdits(type, dsl, revision, edits)
  })
};

export { schematexTools };
//# sourceMappingURL=ai-sdk.js.map
//# sourceMappingURL=ai-sdk.js.map