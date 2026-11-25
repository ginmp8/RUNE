import { S as SyntaxDetail } from '../tools-DrSNczdx.js';
export { A as ApplyDiagramEditsResult, D as DIAGRAM_REGISTRY, a as DIAGRAM_SINCE, b as DiagramCluster, c as DiagramEdit, d as DiagramListItem, e as DiagramMeta, E as EditableDiagramItem, f as Example, G as GetExamplesOptions, g as GetExamplesResult, h as GetSyntaxOptions, i as GetSyntaxResult, I as InspectDiagramResult, R as RenderDslResult, j as SchematexValidationError, k as SyntaxDoc, V as ValidateDslResult, l as applyDiagramEdits, m as getAllDiagramTypes, n as getDiagramCapabilities, o as getDiagramMeta, p as getDiagramSince, q as getExampleBySlug, r as getExamples, s as getSyntax, t as inspectDiagram, u as listDiagrams, v as renderDsl, w as resolveDiagramType, x as validateDsl } from '../tools-DrSNczdx.js';
import { c as DiagramType } from '../types-Bgj27ejP.js';
import '../api-D_Lu9-oC.js';
import '../interactive-capabilities-DqY-QM6X.js';

interface SchematexToolDefinition {
    name: string;
    title: string;
    description: string;
    inputSchema: Record<string, unknown>;
}
/** Model-visible tool contracts shared by AI SDK, stdio MCP, and hosted MCP. */
declare const SCHEMATEX_TOOL_DEFINITIONS: {
    readonly listDiagrams: {
        readonly name: "listDiagrams";
        readonly title: "List Schematex diagrams";
        readonly description: "List every Schematex diagram type with selection guidance, standards, aliases, and canvas-editing capabilities. Call this first when the best diagram type is not already known.";
        readonly inputSchema: {
            readonly type: "object";
            readonly properties: {};
            readonly additionalProperties: false;
        };
    };
    readonly getSyntax: {
        readonly name: "getSyntax";
        readonly title: "Get diagram syntax";
        readonly description: "Return syntax for one diagram type. The default canonical detail is the compact generation path; request reference detail only for advanced forms or imported adapters.";
        readonly inputSchema: {
            readonly type: "object";
            readonly properties: {
                readonly type: {
                    readonly type: "string";
                    readonly description: "Diagram type id from listDiagrams.";
                };
                readonly detail: {
                    readonly type: "string";
                    readonly enum: readonly ["canonical", "reference"];
                    readonly description: "Defaults to canonical.";
                };
            };
            readonly required: readonly ["type"];
            readonly additionalProperties: false;
        };
    };
    readonly getExamples: {
        readonly name: "getExamples";
        readonly title: "Get curated examples";
        readonly description: "Return curated real-world DSL examples for one diagram type. Use a small result as few-shot context before generating DSL.";
        readonly inputSchema: {
            readonly type: "object";
            readonly properties: {
                readonly type: {
                    readonly type: "string";
                };
                readonly limit: {
                    readonly type: "integer";
                    readonly minimum: 1;
                    readonly maximum: 10;
                };
                readonly preferFeatured: {
                    readonly type: "boolean";
                };
                readonly maxComplexity: {
                    readonly type: "integer";
                    readonly minimum: 1;
                    readonly maximum: 5;
                };
            };
            readonly required: readonly ["type"];
            readonly additionalProperties: false;
        };
    };
    readonly validateDsl: {
        readonly name: "validateDsl";
        readonly title: "Validate Schematex DSL";
        readonly description: "Validate DSL and return structured line, column, message, and repair hints. Call before returning generated DSL and self-correct invalid output.";
        readonly inputSchema: {
            readonly type: "object";
            readonly properties: {
                readonly type: {
                    readonly type: "string";
                };
                readonly dsl: {
                    readonly type: "string";
                };
            };
            readonly required: readonly ["dsl"];
            readonly additionalProperties: false;
        };
    };
    readonly renderDsl: {
        readonly name: "renderDsl";
        readonly title: "Render DSL to SVG";
        readonly description: "Render Schematex DSL to an SVG artifact. Use when the client needs the final diagram output; apps that render Schematex locally should return validated DSL instead.";
        readonly inputSchema: {
            readonly type: "object";
            readonly properties: {
                readonly type: {
                    readonly type: "string";
                };
                readonly dsl: {
                    readonly type: "string";
                };
                readonly theme: {
                    readonly type: "string";
                };
                readonly padding: {
                    readonly type: "number";
                };
            };
            readonly required: readonly ["dsl"];
            readonly additionalProperties: false;
        };
    };
    readonly getDiagramCapabilities: {
        readonly name: "getDiagramCapabilities";
        readonly title: "Get diagram editing capabilities";
        readonly description: "Return the safe canvas text and position-editing model for one diagram type. Use before proposing direct manipulation or geometry changes.";
        readonly inputSchema: {
            readonly type: "object";
            readonly properties: {
                readonly type: {
                    readonly type: "string";
                };
            };
            readonly required: readonly ["type"];
            readonly additionalProperties: false;
        };
    };
    readonly inspectDiagram: {
        readonly name: "inspectDiagram";
        readonly title: "Inspect editable diagram items";
        readonly description: "Parse existing DSL and return stable editable targets, visible labels, bounds, and allowed edit modes. Source offsets are intentionally hidden from the model.";
        readonly inputSchema: {
            readonly type: "object";
            readonly properties: {
                readonly type: {
                    readonly type: "string";
                };
                readonly dsl: {
                    readonly type: "string";
                };
            };
            readonly required: readonly ["dsl"];
            readonly additionalProperties: false;
        };
    };
    readonly applyDiagramEdits: {
        readonly name: "applyDiagramEdits";
        readonly title: "Apply atomic diagram edits";
        readonly description: "Apply a batch of label or position edits to an inspected diagram revision. Returns updated DSL only when every edit succeeds and the result still renders.";
        readonly inputSchema: {
            readonly type: "object";
            readonly properties: {
                readonly type: {
                    readonly type: "string";
                };
                readonly dsl: {
                    readonly type: "string";
                };
                readonly revision: {
                    readonly type: "integer";
                    readonly minimum: 0;
                    readonly description: "Revision returned by inspectDiagram.";
                };
                readonly edits: {
                    readonly type: "array";
                    readonly minItems: 1;
                    readonly maxItems: 50;
                    readonly items: {
                        readonly type: "object";
                        readonly properties: {
                            readonly target: {
                                readonly type: "string";
                                readonly description: "Scene target key returned by inspectDiagram.";
                            };
                            readonly op: {
                                readonly type: "string";
                                readonly enum: readonly ["setLabel", "setPosition"];
                            };
                            readonly value: {
                                readonly type: "string";
                                readonly description: "Required for setLabel.";
                            };
                            readonly x: {
                                readonly type: "number";
                                readonly description: "Required for setPosition; SVG bbox top-left x.";
                            };
                            readonly y: {
                                readonly type: "number";
                                readonly description: "Required for setPosition; SVG bbox top-left y.";
                            };
                        };
                        readonly required: readonly ["target", "op"];
                        readonly additionalProperties: false;
                    };
                };
            };
            readonly required: readonly ["dsl", "revision", "edits"];
            readonly additionalProperties: false;
        };
    };
};
type SchematexToolName = keyof typeof SCHEMATEX_TOOL_DEFINITIONS;

interface BuildPromptContextOptions {
    /** How many few-shot examples to embed. Default 2. Set 0 to omit examples. */
    examples?: number;
    /** Syntax detail level. Default `"canonical"` (the compact first-shot card). */
    detail?: SyntaxDetail;
    /** Prefer `featured: true` examples first. Default true. */
    preferFeatured?: boolean;
    /** Cap embedded example complexity (1–5). */
    maxComplexity?: number;
}
interface PromptContext {
    type: string;
    name: string;
    standard: string;
    /** One inject-ready markdown block: grammar card + worked examples. */
    text: string;
    /** Number of examples embedded in `text`. */
    exampleCount: number;
}
/**
 * Build a single inject-ready prompt block for one diagram type.
 *
 * @example
 * const ctx = buildPromptContext("genogram");
 * const systemPrompt = `Generate Schematex DSL.\n\n${ctx.text}`;
 */
declare function buildPromptContext(type: string, opts?: BuildPromptContextOptions): PromptContext;

interface GenerationProfile {
    /** Canonical type id from `listDiagrams()`. */
    type: DiagramType;
    /** First line form preferred for generated DSL. */
    header: string;
    /** Short name for the preferred authoring mode when a parser has several. */
    mode: string;
    /**
     * Compact one-line vocabulary — the full set of keywords / operators / tokens
     * the parser accepts, so a single-shot caller sees the whole surface without
     * fetching the `reference` syntax. Optional.
     */
    keywords?: string;
    /** Forms that cover most first-shot generations for this type. */
    forms: readonly string[];
    /** Short grammar choices the model should make by default. */
    prefer: readonly string[];
    /** Accepted adapters / advanced paths to avoid unless explicitly needed. */
    avoid: readonly string[];
    /** Validation or semantic reminders that prevent common failed renders. */
    repair: readonly string[];
}

export { type BuildPromptContextOptions, DiagramType, type GenerationProfile, type PromptContext, SCHEMATEX_TOOL_DEFINITIONS, type SchematexToolDefinition, type SchematexToolName, SyntaxDetail, buildPromptContext };
