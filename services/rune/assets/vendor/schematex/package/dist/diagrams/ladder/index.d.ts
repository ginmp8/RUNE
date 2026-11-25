import { m as LadderAST, R as RenderConfig, n as LadderRung, o as LadderElement, D as DiagramPlugin } from '../../types-Bgj27ejP.js';

declare function parseLadderDSL(text: string): LadderAST;

declare function renderLadder(ast: LadderAST, config?: RenderConfig): string;

type LadderElementKind = "contact" | "coil" | "function_block" | "compare";
interface LadderLayoutNode {
    id: string;
    rungIndex: number;
    element: LadderElement;
    kind: LadderElementKind;
    /** x of the element body (left edge) */
    x: number;
    /** y of the element body (top edge) */
    y: number;
    width: number;
    height: number;
    /** rung centerline Y (where wires attach) */
    rungY: number;
}
interface LadderLayoutWire {
    path: string;
}
interface LadderLayoutRung {
    rung: LadderRung;
    index: number;
    y: number;
    /** Rightmost x reached by elements on this rung. */
    endX: number;
    /** Rung slot total height (used for spacing). */
    height: number;
    /** Total pixel height reserved above rungY for name/tag labels. */
    headerHeight: number;
}
interface LadderLayoutResult {
    width: number;
    height: number;
    leftRailX: number;
    rightRailX: number;
    rungs: LadderLayoutRung[];
    nodes: LadderLayoutNode[];
    wires: LadderLayoutWire[];
}
declare function layoutLadder(ast: LadderAST): LadderLayoutResult;

declare const ladder: DiagramPlugin;

export { ladder, layoutLadder, parseLadderDSL, renderLadder };
