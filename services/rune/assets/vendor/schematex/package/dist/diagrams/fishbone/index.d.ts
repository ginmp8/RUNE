import { F as FishboneAST, R as RenderConfig, a as SourceRange, D as DiagramPlugin } from '../../types-Bgj27ejP.js';

/**
 * Fishbone DSL parser.
 *
 * Supports two syntactic styles, mixable in one document:
 *
 * Style A — structured (per 13-FISHBONE-STANDARD §11)
 *
 *   fishbone "Title"
 *   effect "Problem statement"
 *   category content "Content"
 *   category tech    "Technical"
 *   content : "Publishing frequency down"
 *   content : "Keyword gaps"
 *     - "No long-tail coverage"
 *     - "Competitor dominates H1"
 *
 * Style B — compact shorthand (convenient for quick authoring, AI output)
 *
 *   fishbone "Title"
 *   effect "Problem statement"
 *   category Content: Publishing frequency down; Content too generic; Keyword gaps
 *   category Technical: Core Web Vitals failing; Crawl coverage drop
 *
 * Config directives:
 *
 *   config direction = left|right          # head orientation (default right)
 *   config width = 900
 *   config height = 620
 *
 * Lines starting with `#` are comments. Leading whitespace is indentation; a
 * line that begins with `-` (after ≥2 spaces of indent) is a Level-2 sub-cause
 * for the most-recent Level-1 cause.
 */
declare function parseFishboneDSL(text: string): FishboneAST;

declare function renderFishboneAST(ast: FishboneAST, options?: RenderConfig): string;
declare function renderFishbone(text: string, options?: RenderConfig): string;

/**
 * Fishbone layout engine.
 *
 * Geometric contract (see 13-FISHBONE-STANDARD §5, §9):
 *  - Horizontal spine at `spineY`
 *  - Effect polygon at right (ltr) or left (rtl) end
 *  - Category ribs slant AWAY from the fish head (signature of Ishikawa form)
 *  - Ribs are paired top/bottom on the same X column for visual rhythm
 *  - Each rib hosts Level-1 causes as short horizontal branches toward the head
 *  - Rib length adapts to (max) cause count in its half so headers align
 *
 * This is an optimized v2 layout that improves on the naive fixed-slope design:
 *  1. Dynamic row heights — a Level-1 cause with N sub-causes reserves
 *     (baseRow + N·subRow) of vertical space so nothing overlaps.
 *  2. Per-half aligned headers — ribs in the same half share the same outer Y
 *     so category pills form a clean visual row.
 *  3. Column-pairing — top and bottom ribs share the same spine X.
 *  4. Smart canvas sizing — derives width/height from content, respecting
 *     optional user overrides from `config width = …` / `config height = …`.
 *  5. Label-aware extents — long cause labels extend the canvas rather than
 *     clipping, so multi-lingual / verbose content is first-class.
 *  6. Label bboxes exposed for the renderer to build a text-gap mask.
 */
interface FishboneLayoutCause {
    label: string;
    sourceRange?: SourceRange;
    /** Rib index (0 = first category) */
    ribIndex: number;
    /** Slot index on the rib (0 = closest to spine) */
    slotIndex: number;
    /** Cause start point on the rib */
    ribX: number;
    ribY: number;
    /** Horizontal branch end point (label starts just beyond) */
    branchX: number;
    branchY: number;
    /** Label anchor (x where text starts, y baseline) */
    labelX: number;
    labelY: number;
    labelAnchor: "start" | "end";
    /** Direction this cause branch sticks out: "head" = toward head, "tail" = toward tail. */
    causeSide: "head" | "tail";
    /** Sub-causes (Level 2) stacked below the main label */
    subCauses: FishboneLayoutSubCause[];
}
interface FishboneLayoutSubCause {
    label: string;
    sourceRange?: SourceRange;
    x: number;
    y: number;
    tickX1: number;
    tickX2: number;
    tickY: number;
    anchor: "start" | "end";
}
interface FishboneLayoutRib {
    index: number;
    half: "top" | "bottom";
    label: string;
    sourceRange?: SourceRange;
    color: string;
    /** Where rib meets spine */
    spineX: number;
    spineY: number;
    /** Far end of rib (where header pill sits) */
    endX: number;
    endY: number;
    /** Header pill geometry */
    headerX: number;
    headerY: number;
    headerW: number;
    headerH: number;
    causes: FishboneLayoutCause[];
}
interface FishboneBBox {
    x: number;
    y: number;
    w: number;
    h: number;
}
interface FishboneLayoutResult {
    width: number;
    height: number;
    orientation: "ltr" | "rtl";
    spineY: number;
    spineStartX: number;
    spineEndX: number;
    tailForkTipTop: {
        x: number;
        y: number;
    };
    tailForkTipBot: {
        x: number;
        y: number;
    };
    head: {
        x: number;
        y: number;
        tipX: number;
        tipY: number;
        w: number;
        h: number;
        label: string;
    };
    ribs: FishboneLayoutRib[];
    /** Label bounding boxes (for text-gap mask) */
    textBBoxes: FishboneBBox[];
    title?: string;
}
declare const FB_CONST: {
    readonly PADDING: 40;
    readonly HEAD_W: 90;
    readonly HEAD_H: 80;
    readonly TAIL_LEN: 40;
    readonly SPINE_OFFSET_FROM_TAIL: 40;
    readonly RIB_SLOPE: 0.6;
    readonly RIB_BASE_EXTENT_Y: 30;
    readonly ROW_HEIGHT: 30;
    readonly SUB_ROW_HEIGHT: 17;
    readonly BRANCH_LEN: 30;
    readonly SUB_TICK_LEN: 10;
    readonly HEADER_W: 132;
    readonly HEADER_H: 34;
    readonly HEADER_GAP: 12;
    readonly COL_STEP: 130;
    readonly COL_FIRST_OFFSET: 170;
    readonly LABEL_FONT: 12;
    readonly HEADER_FONT: 14;
    readonly SUB_FONT: 11;
    readonly EFFECT_FONT: 14;
    readonly LABEL_GAP: 6;
    readonly MIN_ROWS_PER_HALF: 4;
    readonly COL_GAP_BETWEEN_LABELS: 18;
    readonly HEAD_PAD_X: 44;
    readonly HEAD_PAD_Y: 20;
    readonly TITLE_CLEARANCE: 24;
};
declare function layoutFishbone(ast: FishboneAST, opts?: {
    palette?: readonly string[];
}): FishboneLayoutResult;

declare const fishbone: DiagramPlugin;

export { FB_CONST, fishbone, layoutFishbone, parseFishboneDSL, renderFishbone, renderFishboneAST };
