import { P as PhyloTreeAST, i as PhyloLayoutNode, D as DiagramPlugin } from '../../types-Bgj27ejP.cjs';

declare class PhyloParseError extends Error {
    constructor(message: string);
}
declare function parsePhylo(text: string): PhyloTreeAST;

interface PhyloLayoutResult {
    width: number;
    height: number;
    nodes: PhyloLayoutNode[];
    /** Branch paths: { path, cladeId?, isConnector } */
    branches: PhyloBranch[];
    ast: PhyloTreeAST;
    scale: number;
    /** Present only for dendrogram mode — drives the height axis + cut line. */
    dendrogram?: DendrogramExtras;
}
/** Dendrogram-only layout metadata (phylo-local; see ./dendrogram.ts). */
interface DendrogramExtras {
    /** Largest merge height in the tree (root's height). */
    maxHeight: number;
    /** X pixel of the height-0 baseline (where leaves align). */
    baselineX: number;
    /** X pixel of the plot's left edge (root / max height). */
    plotLeftX: number;
    /** Pixels per unit of merge height. */
    scale: number;
    /** Cut threshold value, when a `cut` directive was given. */
    cut?: number;
    /** Number of flat clusters produced by the cut (0 when no cut). */
    clusterCount: number;
    /** Leaf id → cluster index (empty when no cut). */
    leafCluster: Map<string, number>;
    /** Node id → merge height. */
    heights: Map<string, number>;
}
interface PhyloBranch {
    path: string;
    fromId: string;
    toId: string;
    /** Clade id if this branch belongs to a highlighted clade */
    cladeId?: string;
    /** Is this a vertical/arc connector (no length meaning) vs horizontal branch */
    isConnector: boolean;
}
declare function layoutPhylo(ast: PhyloTreeAST): PhyloLayoutResult;

declare function renderPhylo(layout: PhyloLayoutResult): string;

declare const phylo: DiagramPlugin;

export { type PhyloLayoutResult, PhyloParseError, layoutPhylo, parsePhylo, phylo, renderPhylo };
