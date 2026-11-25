import { g as DiagramAST, L as LayoutConfig, h as LayoutResult, R as RenderConfig, D as DiagramPlugin } from '../../types-Bgj27ejP.js';

declare class EcomapParseError extends Error {
    line: number;
    constructor(message: string, line: number);
}
declare function parseEcomap(text: string): DiagramAST;

declare function layoutEcomap(ast: DiagramAST, _config: LayoutConfig): LayoutResult;

declare function renderEcomap(layout: LayoutResult, config: RenderConfig, ast?: DiagramAST): string;

declare const ecomap: DiagramPlugin;

export { EcomapParseError, ecomap, layoutEcomap, parseEcomap, renderEcomap };
