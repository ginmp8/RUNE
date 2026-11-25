import { g as DiagramAST, L as LayoutConfig, h as LayoutResult, R as RenderConfig, D as DiagramPlugin } from '../../types-Bgj27ejP.cjs';

declare class PedigreeParseError extends Error {
    line: number;
    constructor(message: string, line: number);
}
declare function parsePedigree(text: string): DiagramAST;

declare function layoutPedigree(ast: DiagramAST, config: LayoutConfig): LayoutResult;

declare function renderPedigree(layout: LayoutResult, config: RenderConfig, ast?: DiagramAST): string;

declare const pedigree: DiagramPlugin;

export { PedigreeParseError, layoutPedigree, parsePedigree, pedigree, renderPedigree };
