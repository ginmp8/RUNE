import { a as SourceRange, b as SchematexDiagnostic, R as RenderConfig, D as DiagramPlugin } from '../../types-Bgj27ejP.cjs';

type OrgchartDirection = "TD" | "LR";
type OrgchartLayoutMode = "tree" | "list";
type OrgchartRoleIcon = "CEO" | "CTO" | "CFO" | "COO" | "CMO" | "CPO" | "VP" | "Engineer" | "Designer" | "Sales" | "HR" | "Legal" | "Ops" | "Marketing" | "Product" | "Data" | "Advisor" | "Intern" | "Vacant";
type OrgchartNodeKind = "person" | "role" | "draft" | "advisor";
interface OrgchartNode {
    id: string;
    name: string;
    /** Exact source token for the explicitly-authored display name. */
    nameSourceRange?: SourceRange;
    title?: string;
    department?: string;
    /** Secondary info line: email, phone, location, short note */
    info?: string;
    kind: OrgchartNodeKind;
    /** Parent id determined by hierarchy / reports property */
    parent?: string;
    /** Assistant-of another node id */
    assistantOf?: string;
    /** Matrix (dotted) report targets */
    matrix: string[];
    /** Built-in role icon keyword */
    role?: OrgchartRoleIcon;
    /** Gender silhouette (shown when no role icon set) */
    gender?: "male" | "female";
    /** Vacant / open position */
    open?: boolean;
    /** Draft / planned but not actively recruited */
    draft?: boolean;
    /** External advisor / contractor */
    external?: boolean;
    /** Explicit avatar color override (hex) */
    avatarColor?: string;
    /** Status pill: NEW / HIRING / LEAVING */
    status?: "new" | "leaving" | "on-leave";
}
interface OrgchartEdge {
    from: string;
    to: string;
    kind: "report" | "matrix";
    label?: string;
}
interface OrgchartAST {
    type: "orgchart";
    title?: string;
    titleSourceRange?: SourceRange;
    direction: OrgchartDirection;
    layout: OrgchartLayoutMode;
    nodes: OrgchartNode[];
    edges: OrgchartEdge[];
    metadata?: Record<string, string>;
    /**
     * Recoverable-input notes recorded during parsing. The parser degrades
     * instead of throwing — unparseable lines are skipped, duplicate ids dropped,
     * and nodes referenced only by edges are synthesized — so a renderable chart
     * is still produced. Surfaced as `partial`-status lint warnings.
     */
    recovered?: {
        unparseableLines?: {
            line?: number;
            text: string;
        }[];
        duplicateIds?: string[];
        impliedNodes?: string[];
    };
}
interface OrgchartLayoutNode {
    node: OrgchartNode;
    x: number;
    y: number;
    width: number;
    height: number;
    /** Department color (resolved from palette) */
    deptColor?: string;
    /** Avatar background color (soft tint) */
    avatarBg: string;
    /** Avatar foreground color (darker, for initials / role glyph) */
    avatarFg: string;
    /** Avatar display initials (2 chars or 1 CJK glyph) */
    initials: string;
    /** Indent depth from root (list mode only). 0 for root. */
    depth?: number;
    /** Subtree size excluding self (list mode only). */
    subtreeSize?: number;
    /** True if this node has children (list mode only). */
    hasChildren?: boolean;
}
interface OrgchartLayoutEdge {
    edge: OrgchartEdge;
    path: string;
    labelX?: number;
    labelY?: number;
}
interface OrgchartLayoutResult {
    width: number;
    height: number;
    nodes: OrgchartLayoutNode[];
    edges: OrgchartLayoutEdge[];
    title?: string;
    mode: OrgchartLayoutMode;
    /** List-mode guide lines (vertical trunks + horizontal ticks). */
    guides?: string[];
}

declare class OrgchartParseError extends Error {
    line?: number | undefined;
    column?: number | undefined;
    source?: string | undefined;
    constructor(message: string, line?: number | undefined, column?: number | undefined, source?: string | undefined);
}
declare function parseOrgchart(text: string): OrgchartAST;

/**
 * Orgchart recoverable-input lint.
 *
 * The parser degrades instead of throwing: unparseable lines are skipped,
 * duplicate ids dropped, and ids referenced only by edges are synthesized into
 * nodes. Each recovery is surfaced here as a warning so the render reports
 * `partial` and the author learns what was repaired — without ever blanking a
 * chart that has at least one node.
 */
declare function lintOrgchart(text: string): SchematexDiagnostic[];

declare function renderOrgchart(ast: OrgchartAST, config?: RenderConfig): string;

declare function layoutOrgchart(ast: OrgchartAST, palette: readonly string[], pins?: Map<string, {
    x: number;
    y: number;
}>): OrgchartLayoutResult;

declare const orgchart: DiagramPlugin;

export { type OrgchartAST, type OrgchartDirection, type OrgchartEdge, type OrgchartLayoutEdge, type OrgchartLayoutMode, type OrgchartLayoutNode, type OrgchartLayoutResult, type OrgchartNode, type OrgchartNodeKind, OrgchartParseError, type OrgchartRoleIcon, layoutOrgchart, lintOrgchart, orgchart, parseOrgchart, renderOrgchart };
