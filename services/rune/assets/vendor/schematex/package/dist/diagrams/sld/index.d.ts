import { b as SchematexDiagnostic, p as SLDAST, R as RenderConfig, q as SLDNode, r as SLDNodeType, D as DiagramPlugin } from '../../types-Bgj27ejP.js';

/**
 * SLD standard-compatibility lint.
 *
 * When an explicit `[standard: …]` is selected, flag devices that have no
 * symbol in that standard's published catalog so an engineer doesn't
 * unknowingly submit a glyph their jurisdiction won't accept. The engine does
 * not silently substitute a foreign symbol — it renders the closest available
 * form and warns.
 */
declare function lintSLD(text: string): SchematexDiagnostic[];
declare function lintSLDAst(ast: SLDAST): SchematexDiagnostic[];

declare function parseSLDDSL(text: string): SLDAST;

declare function renderSLD(ast: SLDAST, config?: RenderConfig): string;

/**
 * Top-down hierarchical layout:
 *   level 0 = sources (top)
 *   each edge forces child.level >= parent.level + 1
 * Bus nodes expand horizontally to span their children.
 * Other nodes are positioned in a tidy tree-like layout.
 */
interface SLDLayoutNode {
    node: SLDNode;
    nodeType: SLDNodeType;
    /** center x */
    x: number;
    /** center y */
    y: number;
    /** Terminal y (top and bottom) after symbol geometry */
    topY: number;
    bottomY: number;
    level: number;
    /** Half width for spacing */
    halfWidth: number;
    /** For bus nodes: left and right extent (x min/max) */
    busLeft?: number;
    busRight?: number;
}
interface SLDLayoutEdge {
    from: string;
    to: string;
    path: string;
    cable?: string;
    cableCsa?: string;
    cableLengthM?: string;
    cableInsulation?: string;
    label?: string;
    midX: number;
    midY: number;
}
interface SLDLayoutBand {
    level: number;
    voltage?: string;
    y: number;
    height: number;
}
interface SLDLayoutResult {
    width: number;
    height: number;
    nodes: SLDLayoutNode[];
    edges: SLDLayoutEdge[];
    bands: SLDLayoutBand[];
    nodeById: Map<string, SLDLayoutNode>;
}
declare function layoutSLD(ast: SLDAST): SLDLayoutResult;

declare const sld: DiagramPlugin;

export { layoutSLD, lintSLD, lintSLDAst, parseSLDDSL, renderSLD, sld };
