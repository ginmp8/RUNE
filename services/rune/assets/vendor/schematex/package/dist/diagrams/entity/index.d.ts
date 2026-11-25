import { E as EntityAST, R as RenderConfig, s as EntityNode, t as EntityEdge, D as DiagramPlugin } from '../../types-Bgj27ejP.js';

declare function parseEntityDSL(text: string): EntityAST;

declare function renderEntity(ast: EntityAST, config?: RenderConfig): string;

/**
 * Tier-based top-down layout for entity structure diagrams.
 *
 * - Tier assigned via longest-path from sources (relaxation)
 * - Within-tier x placed by DFS declaration order
 * - Non-bus parents re-centered over children bottom-up
 * - Edges routed orthogonally (down → across → down)
 */
interface EntityLayoutNode {
    node: EntityNode;
    x: number;
    y: number;
    tier: number;
    width: number;
    height: number;
    /** Top-center anchor for edge end */
    topY: number;
    bottomY: number;
}
interface EntityLayoutEdge {
    edge: EntityEdge;
    path: string;
    /** Label anchor (horizontal mid of the branch segment) */
    labelX: number;
    labelY: number;
}
interface EntityLayoutCluster {
    id: string;
    label: string;
    color?: string;
    x: number;
    y: number;
    width: number;
    height: number;
}
interface EntityLayoutResult {
    width: number;
    height: number;
    nodes: EntityLayoutNode[];
    nodeById: Map<string, EntityLayoutNode>;
    edges: EntityLayoutEdge[];
    clusters: EntityLayoutCluster[];
}
declare function layoutEntity(ast: EntityAST): EntityLayoutResult;

declare const entity: DiagramPlugin;

export { entity, layoutEntity, parseEntityDSL, renderEntity };
