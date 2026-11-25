import { V as VennAST, R as RenderConfig, u as VennLayoutResult, D as DiagramPlugin } from '../../types-Bgj27ejP.cjs';

/**
 * Venn / Euler DSL parser (hand-written recursive descent).
 *
 * Accepts four DSL modes (see 15-VENN-STANDARD §5):
 *   1. Declarative set + intersection:  `A & B : 42`
 *   2. Enumeration shorthand:           `A = { 1, 2, 3 }`
 *   3. Region-labeled:                  `region A & B : "..."`
 *   4. Euler-explicit:                  `dogs subset mammals`
 *
 * All four can be mixed within one document (except enumeration sets imply
 * automatic intersections and shouldn't be combined with explicit `A & B :`).
 */

declare class VennParseError extends Error {
    readonly line?: number | undefined;
    constructor(message: string, line?: number | undefined);
}
declare function parseVennDSL(input: string): VennAST;

/**
 * Venn / Euler SVG renderer.
 *
 * Produces a semantic SVG:
 *   - `<title>` + `<desc>` for accessibility
 *   - CSS class hierarchy `.schematex-venn-*`
 *   - One `<circle>` or `<ellipse>` per set, grouped under a layer that
 *     can apply `mix-blend-mode: multiply` for natural overlap blending.
 *   - `<text>` per region label, optional `<path>` leader for externalised
 *     labels.
 */

declare function renderVennAST(ast: VennAST, options?: RenderConfig | {
    theme?: string;
}): string;
declare function renderVennLayout(ast: VennAST, layout: VennLayoutResult, options?: RenderConfig | {
    theme?: string;
}): string;
declare function renderVenn(text: string, options?: RenderConfig | {
    theme?: string;
}): string;

/**
 * Venn / Euler layout dispatcher.
 *
 * Picks a layout based on `ast.sets.length`, `config.mode` and
 * `config.proportional`:
 *
 *   - n=2 fixed or analytic proportional
 *   - n=3 fixed or gradient-descent proportional
 *   - n=4 fixed (4 ellipses); proportional deferred
 *   - Euler (subset / disjoint / partial overlap) — derived from relations or
 *     inferred by auto-detecting which regions actually have values.
 */

interface LayoutOptions {
    /** Canvas width override. */
    width?: number;
    /** Canvas height override. */
    height?: number;
    /** Padding around the diagram (px). */
    padding?: number;
}
declare function layoutVenn(ast: VennAST, opts?: LayoutOptions): VennLayoutResult;

declare const venn: DiagramPlugin;

export { VennParseError, layoutVenn, parseVennDSL, renderVenn, renderVennAST, renderVennLayout, venn };
