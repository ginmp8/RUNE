import { v as FlowchartAST, w as FlowchartLayoutResult, R as RenderConfig, D as DiagramPlugin } from './types-Bgj27ejP.cjs';

/**
 * Flowchart DSL parser.
 *
 * Supports a mermaid-inspired subset:
 *   flowchart TD | TB | BT | LR | RL
 *   A[Label]              rect
 *   A(Label)              round
 *   A([Label])            stadium
 *   A{Label}              diamond
 *   A[/Label/]            parallelogram
 *   A[\Label\]            parallelogram-alt
 *   A[/Label\]            trapezoid
 *   A[\Label/]            trapezoid-alt
 *   A[[Label]]            subroutine
 *   A[(Label)]            cylinder
 *   A((Label))            circle
 *   A(((Label)))          double-circle
 *   A{{Label}}            hexagon
 *   A>Label]              asymmetric
 *   A --> B               solid edge
 *   A --- B               no-arrow edge
 *   A -.-> B              dotted
 *   A ==> B               thick
 *   A <--> B              bidirectional
 *   A --x B               crossed end
 *   A --o B               round end
 *   A -->|yes| B          edge with pipe label
 *   A -- yes --> B        edge with inline label
 *   A --> B --> C         chain
 *   A & B --> C & D       fan-out (cross-product edges)
 *   subgraph "Title"      cluster grouping
 *     ...
 *   end
 *   class A,B className   semantic class assignment
 *   style A fill:#f9f,... per-node style
 *   classDef name ...     class definition (stored, applied in renderer)
 *   %% comment
 *
 * Hand-written tokenizer + recursive descent. Zero deps.
 */

declare function parseFlowchart(source: string): FlowchartAST;

/**
 * Flowchart Sugiyama-style layered layout (M1).
 *
 * Phases:
 *   1. Cycle removal — Greedy-FAS (Eades-Lin-Smyth 1993)
 *   2. Layer assignment — Longest-path layering
 *   3. Dummy node insertion for edges spanning > 1 layer
 *   4. Crossing minimization — median heuristic, bi-directional sweep
 *   5. X-coordinate assignment — simple symmetric pass
 *      (Brandes-Köpf full 4-alignment is deferred; for M1 a centered
 *       median-based placement produces visually indistinguishable results
 *       on graphs ≤ 20 nodes, which is the M1 target.)
 *
 * Zero runtime dependencies. All heuristics hand-written.
 */

declare const FC_CONST: {
    readonly nodeWidth: 120;
    readonly nodeHeight: 44;
    readonly nodeSpacingX: 40;
    readonly layerSpacingY: 76;
    readonly dummyWidth: 1;
    readonly padding: 24;
    /** Latin/digit avg width at 12px font. CJK uses cjkCharWidth instead. */
    readonly charWidth: 6.8;
    /** Full-width glyph width at 12px (CJK ideograph, kana, hangul, fullwidth). */
    readonly cjkCharWidth: 12.5;
    readonly labelHPad: 16;
    readonly minNodeWidth: 72;
    /**
     * Cap on per-line label width. Labels wider than `wrapLabelWidth` are
     * auto-wrapped first (see `wrapLabel`), so this clamp only bites on
     * unbreakable single tokens that survive wrapping (URLs, ids).
     */
    readonly maxLabelWidth: 420;
    /**
     * Auto-wrap target: a single-line label measuring wider than this is
     * broken into multiple lines (preferring spaces, falling back to CJK
     * char boundaries). ≈38 Latin chars / ≈20 full-width chars per line —
     * keeps prose nodes near a readable 3:1 aspect instead of a 400px strip.
     */
    readonly wrapLabelWidth: 260;
    readonly crossingSweepIters: 24;
};
declare function layoutFlowchart(ast: FlowchartAST, pins?: Map<string, {
    x: number;
    y: number;
}>): FlowchartLayoutResult;

/**
 * Shared design-token system for all Schematex diagram renderers.
 *
 * Two-layer architecture:
 *   1. BaseTheme — universal tokens every diagram uses
 *   2. Semantic extensions — diagram-family tokens (PersonTokens, BiologyTokens, …)
 *
 * Three built-in presets: default, monochrome, dark.
 * All tokens are also exposed as CSS custom properties (--schematex-*)
 * so consumers can override them.
 */
type ThemeName = "default" | "monochrome" | "dark";
interface BaseTheme {
    bg: string;
    text: string;
    textMuted: string;
    stroke: string;
    fill: string;
    fillMuted: string;
    /** Emphasis / interactive / link color. Use for net labels, focus, selected. */
    accent: string;
    positive: string;
    negative: string;
    /** Mid-gray. Use for muted strokes, neutral-valence edges, dashed separators. */
    neutral: string;
    warn: string;
    /** Category palette — 8 distinguishable colors for ecomap systems, sociogram groups, etc. */
    palette: readonly string[];
}
interface PersonTokens {
    maleFill: string;
    femaleFill: string;
    unknownFill: string;
    deceasedMark: string;
    conditionFill: string;
}
interface BiologyTokens {
    cladeColors: readonly string[];
    supportGood: string;
    supportMedium: string;
    supportWarn: string;
    supportBad: string;
}
/**
 * Tokens for set-theory diagrams (Venn / Euler). Paletteof set fills is
 * tuned slightly softer than BaseTheme to blend nicely under
 * `mix-blend-mode: multiply`.
 */
interface VennTokens {
    vennSetColors: readonly string[];
    vennBlendMode: "multiply" | "screen" | "none";
    vennSetOpacity: number;
    vennSetStroke: string;
    vennLabelColor: string;
    vennCountColor: string;
    vennLeaderColor: string;
}
/**
 * Tokens for timeline diagrams. Palette-driven so categories/tracks share
 * colors with the rest of the diagram family (ecomap/sociogram/phylo).
 * Era bands and card surfaces use theme-neutral tints so no magic hex codes
 * leak into the renderer.
 */
interface TimelineTokens {
    axis: string;
    axisLabel: string;
    eraLabel: string;
    eraOpacity: number;
    eraPlotOpacity: number;
    /** Alternating lane stripe fill. */
    laneStripe: string;
    laneStripeOpacity: number;
    /** Category / task bar palette. Cycled by `category` (fallback to trackIdx). */
    categoryPalette: readonly string[];
    /** Point/milestone ring — defaults to accent but configurable. */
    markerRing: string;
    markerFill: string;
    milestoneFill: string;
    /** Gantt vertical pin shaft. */
    pinShaft: string;
    /** Lollipop card. */
    cardBg: string;
    cardStroke: string;
    cardText: string;
    cardShadow: string;
    /** Gantt legend chip background. */
    legendBg: string;
    legendStroke: string;
}
type ResolvedTheme<T = object> = BaseTheme & T;
declare const BASE_THEMES: Record<ThemeName, BaseTheme>;
declare const PERSON_TOKENS: Record<ThemeName, PersonTokens>;
declare const BIOLOGY_TOKENS: Record<ThemeName, BiologyTokens>;
declare const VENN_TOKENS: Record<ThemeName, VennTokens>;
declare function resolveTimelineTheme(name: string): ResolvedTheme<TimelineTokens>;
/**
 * Tokens for Petri nets (place/transition nets). Petri net is a CS/maths
 * formalism, not an IEC/IEEE compliance drawing — so unlike IndustrialTokens it
 * gets a tasteful colour theme in `default`. The house rule (see
 * 34-PETRINET-STANDARD §6): body in neutral strokes; green (`positive`) reserved
 * for "enabled", red (`negative`) reserved for "inhibitor / dead", blue
 * (`accent`) only for weight/rate annotations. `monochrome` reproduces the
 * Murata-1989 textbook look faithfully — colour falls back to shape there.
 */
interface PetriTokens {
    placeFill: string;
    placeStroke: string;
    /** Immediate transition: solid bar — the "ink" colour. */
    transitionBarFill: string;
    /** Timed transition: hollow box interior. */
    transitionBoxFill: string;
    transitionStroke: string;
    /** Marking dot colour. */
    tokenFill: string;
    /** Enabled (fireable) transition highlight. */
    enabledStroke: string;
    enabledFill: string;
    /** Dead / disabled transition. */
    deadStroke: string;
    /** Inhibitor + reset arcs. */
    inhibitorStroke: string;
    arcStroke: string;
    weightLabel: string;
    /** Coloured-token (CPN) palette. */
    tokenPalette: readonly string[];
}
declare const PETRI_TOKENS: Record<ThemeName, PetriTokens>;
declare function resolvePetriTheme(name: string): ResolvedTheme<PetriTokens>;
interface NetworkTokens {
    deviceFill: string;
    deviceStroke: string;
    deviceAccent: string;
    cloudFill: string;
    cloudStroke: string;
    label: string;
    subLabel: string;
    linkCopper: string;
    linkFiber: string;
    linkWireless: string;
    linkSerial: string;
    linkPoe: string;
    linkVpn: string;
    linkLag: string;
    linkLabel: string;
    siteStroke: string;
    subnetStroke: string;
    subnetFill: string;
    zoneStroke: string;
    vlanPalette: readonly string[];
    warn: string;
}
declare const NETWORK_TOKENS: Record<ThemeName, NetworkTokens>;
declare function resolveNetworkTheme(name: string): ResolvedTheme<NetworkTokens>;
declare function resolveBaseTheme(name: string): BaseTheme;
declare function resolvePersonTheme(name: string): ResolvedTheme<PersonTokens>;
declare function resolveBiologyTheme(name: string): ResolvedTheme<BiologyTokens>;
/**
 * Fishbone uses BaseTheme directly — its bone colors come from `theme.palette`.
 * Kept as a named resolver so callers don't have to know that.
 */
declare function resolveFishboneTheme(name: string): BaseTheme;
declare function resolveVennTheme(name: string): ResolvedTheme<VennTokens>;
declare function resolveGenogramTheme(name: string): ResolvedTheme<PersonTokens>;

/**
 * Flowchart renderer — LayoutResult → SVG string.
 *
 * Produces semantic, themeable SVG per spec §12:
 *   - <title>/<desc> for a11y
 *   - data-* attributes for interaction hooks
 *   - CSS custom properties from resolveBaseTheme
 *   - Arrowhead markers in <defs>
 */

declare function renderFlowchartAST(ast: FlowchartAST, themeName?: ThemeName, config?: RenderConfig): string;
declare function renderFlowchart(text: string, themeName?: ThemeName, config?: RenderConfig): string;

declare const flowchart: DiagramPlugin;

export { BASE_THEMES as B, FC_CONST as F, NETWORK_TOKENS as N, PERSON_TOKENS as P, type ResolvedTheme as R, type ThemeName as T, VENN_TOKENS as V, BIOLOGY_TOKENS as a, type BaseTheme as b, type BiologyTokens as c, type NetworkTokens as d, PETRI_TOKENS as e, type PersonTokens as f, type PetriTokens as g, type TimelineTokens as h, type VennTokens as i, flowchart as j, resolveBiologyTheme as k, resolveFishboneTheme as l, resolveGenogramTheme as m, resolveNetworkTheme as n, resolvePersonTheme as o, resolvePetriTheme as p, resolveTimelineTheme as q, resolveBaseTheme as r, resolveVennTheme as s, layoutFlowchart as t, parseFlowchart as u, renderFlowchart as v, renderFlowchartAST as w };
