import { B as BlockAST, R as RenderConfig, D as DiagramPlugin } from '../../types-Bgj27ejP.cjs';

declare function parseBlockDiagram(text: string): BlockAST;

declare function renderBlockDiagram(ast: BlockAST, config?: RenderConfig): string;

interface LaidBlock {
    kind: "block";
    id: string;
    label: string;
    role: string;
    x: number;
    y: number;
    width: number;
    height: number;
    hasBranch?: boolean;
}
interface LaidSum {
    kind: "sum";
    id: string;
    cx: number;
    cy: number;
    r: number;
    hasBranch?: boolean;
}
interface LaidPort {
    kind: "port";
    id: string;
    label: string;
    x: number;
    y: number;
    isInput: boolean;
    hasBranch?: boolean;
}
type LaidNode = LaidBlock | LaidSum | LaidPort;
interface LaidEdgePolarity {
    sign: "+" | "-";
    pin: "left" | "top" | "right" | "bottom";
    x: number;
    y: number;
}
interface LaidEdge {
    from: string;
    to: string;
    label?: string;
    discrete: boolean;
    path: string;
    midX: number;
    midY: number;
    isFeedback: boolean;
    /** Polarity sign to draw near the target if target is a sum */
    polarity?: LaidEdgePolarity;
}
interface BlockDiagramLayout {
    width: number;
    height: number;
    nodes: LaidNode[];
    edges: LaidEdge[];
    title?: string;
    /** Offset applied to all y coords (>0 when feedforward rows exist above FWD_Y) */
    topOffset: number;
}
declare function layoutBlockDiagram(ast: BlockAST): BlockDiagramLayout;

declare const blockdiagram: DiagramPlugin;

export { blockdiagram, layoutBlockDiagram, parseBlockDiagram, renderBlockDiagram };
