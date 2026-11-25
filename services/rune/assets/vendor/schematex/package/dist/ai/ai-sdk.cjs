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
var ai = require('ai');

function inputSchema(definition) {
  return ai.jsonSchema(definition.inputSchema);
}
var schematexTools = {
  listDiagrams: ai.tool({
    description: chunkZJK7WHVT_cjs.SCHEMATEX_TOOL_DEFINITIONS.listDiagrams.description,
    inputSchema: inputSchema(chunkZJK7WHVT_cjs.SCHEMATEX_TOOL_DEFINITIONS.listDiagrams),
    execute: async () => chunkZJK7WHVT_cjs.listDiagrams()
  }),
  getSyntax: ai.tool({
    description: chunkZJK7WHVT_cjs.SCHEMATEX_TOOL_DEFINITIONS.getSyntax.description,
    inputSchema: inputSchema(chunkZJK7WHVT_cjs.SCHEMATEX_TOOL_DEFINITIONS.getSyntax),
    execute: async ({ type, detail }) => chunkZJK7WHVT_cjs.getSyntax(type, { detail })
  }),
  getExamples: ai.tool({
    description: chunkZJK7WHVT_cjs.SCHEMATEX_TOOL_DEFINITIONS.getExamples.description,
    inputSchema: inputSchema(chunkZJK7WHVT_cjs.SCHEMATEX_TOOL_DEFINITIONS.getExamples),
    execute: async ({ type, limit, preferFeatured, maxComplexity }) => chunkZJK7WHVT_cjs.getExamples(type, { limit, preferFeatured, maxComplexity })
  }),
  validateDsl: ai.tool({
    description: chunkZJK7WHVT_cjs.SCHEMATEX_TOOL_DEFINITIONS.validateDsl.description,
    inputSchema: inputSchema(chunkZJK7WHVT_cjs.SCHEMATEX_TOOL_DEFINITIONS.validateDsl),
    execute: async ({ type, dsl }) => chunkZJK7WHVT_cjs.validateDsl(type, dsl)
  }),
  renderDsl: ai.tool({
    description: chunkZJK7WHVT_cjs.SCHEMATEX_TOOL_DEFINITIONS.renderDsl.description,
    inputSchema: inputSchema(chunkZJK7WHVT_cjs.SCHEMATEX_TOOL_DEFINITIONS.renderDsl),
    execute: async ({ type, dsl, theme, padding }) => chunkZJK7WHVT_cjs.renderDsl(type, dsl, { theme, padding })
  }),
  getDiagramCapabilities: ai.tool({
    description: chunkZJK7WHVT_cjs.SCHEMATEX_TOOL_DEFINITIONS.getDiagramCapabilities.description,
    inputSchema: inputSchema(chunkZJK7WHVT_cjs.SCHEMATEX_TOOL_DEFINITIONS.getDiagramCapabilities),
    execute: async ({ type }) => chunkZJK7WHVT_cjs.getDiagramCapabilities(type)
  }),
  inspectDiagram: ai.tool({
    description: chunkZJK7WHVT_cjs.SCHEMATEX_TOOL_DEFINITIONS.inspectDiagram.description,
    inputSchema: inputSchema(chunkZJK7WHVT_cjs.SCHEMATEX_TOOL_DEFINITIONS.inspectDiagram),
    execute: async ({ type, dsl }) => chunkZJK7WHVT_cjs.inspectDiagram(type, dsl)
  }),
  applyDiagramEdits: ai.tool({
    description: chunkZJK7WHVT_cjs.SCHEMATEX_TOOL_DEFINITIONS.applyDiagramEdits.description,
    inputSchema: inputSchema(chunkZJK7WHVT_cjs.SCHEMATEX_TOOL_DEFINITIONS.applyDiagramEdits),
    execute: async ({ type, dsl, revision, edits }) => chunkZJK7WHVT_cjs.applyDiagramEdits(type, dsl, revision, edits)
  })
};

exports.schematexTools = schematexTools;
//# sourceMappingURL=ai-sdk.cjs.map
//# sourceMappingURL=ai-sdk.cjs.map