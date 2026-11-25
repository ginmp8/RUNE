import { g as DiagramAST, L as LayoutConfig, h as LayoutResult, R as RenderConfig, I as Individual, D as DiagramPlugin } from '../../types-Bgj27ejP.cjs';

declare class ParseError extends Error {
    line: number;
    column: number;
    source: string;
    constructor(message: string, line: number, column: number, source: string);
}
declare function parseGenogram(text: string): DiagramAST;

declare function layoutGenogram(ast: DiagramAST, config: LayoutConfig, pins?: Map<string, {
    x: number;
    y: number;
}>): LayoutResult;

declare function renderGenogram(layout: LayoutResult, config: RenderConfig, ast?: DiagramAST): string;

declare function renderIndividualSymbol(individual: Individual, x: number, y: number, size: number): string;
declare function getRequiredDefs(individuals: Individual[], includeArrowMarker?: boolean): string;

declare const genogram: DiagramPlugin;

export { ParseError, genogram, getRequiredDefs, layoutGenogram, parseGenogram, renderGenogram, renderIndividualSymbol };
