import { c as DiagramType, d as SchematexParseResult, e as SchematexRenderResult } from './types-Bgj27ejP.cjs';

interface SchematexConfig {
    type?: DiagramType;
    width?: number;
    height?: number;
    padding?: number;
    theme?: string;
    fontFamily?: string;
    /**
     * `strict` preserves the historical throw-on-error API.
     * `preview` returns a visible diagnostic SVG instead of an empty surface.
     */
    mode?: "strict" | "preview";
    /** Opt in to derived geometry/source metadata and data-sx-* SVG hooks. */
    scene?: boolean;
}
/**
 * Parse DSL text to the diagram's AST and return it as a plain object.
 * Useful for JSON serialization, programmatic inspection, or custom renderers.
 *
 * @example
 * ```ts
 * const ast = parse('genogram\n  alice [female]');
 * console.log(JSON.stringify(ast, null, 2));
 * ```
 */
declare function parse(text: string, config?: SchematexConfig): unknown;
declare function parseResult(text: string, config?: SchematexConfig): SchematexParseResult;
declare function render(text: string, config?: SchematexConfig): string;
declare function renderResult(text: string, config?: SchematexConfig): SchematexRenderResult;
declare function renderPreview(text: string, config?: SchematexConfig): string;

export { type SchematexConfig as S, parseResult as a, renderPreview as b, renderResult as c, parse as p, render as r };
