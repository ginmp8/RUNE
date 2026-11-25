import { k as LogicGateAST, R as RenderConfig, b as SchematexDiagnostic, D as DiagramPlugin } from '../../types-Bgj27ejP.cjs';

declare function parseLogic(text: string): LogicGateAST;

declare function renderLogic(ast: LogicGateAST, config?: RenderConfig): string;

interface GateGeometry {
    width: number;
    height: number;
    inputPins: Array<{
        id: string;
        x: number;
        y: number;
        label?: string;
    }>;
    outputPins: Array<{
        id: string;
        x: number;
        y: number;
        label?: string;
        bubble?: boolean;
    }>;
    /** Body SVG path (ANSI) */
    ansiPath: string;
    /** Output bubble? */
    outputBubble?: boolean;
    /** Clock triangle pin id (sequential) */
    clockPin?: string;
    /** IEC label inside rectangle */
    iecLabel?: string;
}

interface LogicLayoutNode {
    id: string;
    kind: "input" | "gate" | "output";
    x: number;
    y: number;
    layer: number;
    geometry?: GateGeometry;
    gateType?: string;
    /** Original (unrecognised) gate token, set only when `gateType === "unknown"`. */
    rawType?: string;
    label: string;
    isActiveLow?: boolean;
}
interface LogicLayoutWire {
    fromNode: string;
    fromX: number;
    fromY: number;
    toNode: string;
    toX: number;
    toY: number;
    isActiveLow?: boolean;
    path: string;
}
interface LogicLayoutModule {
    id: string;
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
}
interface LogicLayoutResult {
    width: number;
    height: number;
    nodes: LogicLayoutNode[];
    wires: LogicLayoutWire[];
    modules: LogicLayoutModule[];
}
declare function layoutLogic(ast: LogicGateAST): LogicLayoutResult;

declare function lintLogic(text: string): SchematexDiagnostic[];
declare function lintLogicAst(ast: LogicGateAST): SchematexDiagnostic[];

declare const logic: DiagramPlugin;

export { layoutLogic, lintLogic, lintLogicAst, logic, parseLogic, renderLogic };
