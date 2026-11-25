import { T as TimingAST, R as RenderConfig, D as DiagramPlugin } from '../../types-Bgj27ejP.cjs';

declare function parseTiming(text: string): TimingAST;

declare function renderTiming(ast: TimingAST, config?: RenderConfig): string;

declare const timing: DiagramPlugin;

export { parseTiming, renderTiming, timing };
