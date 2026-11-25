type SchematexResultStatus = "valid" | "partial" | "invalid";
interface SchematexDiagnostic {
    severity: "error" | "warning";
    code: string;
    message: string;
    line?: number;
    column?: number;
    source?: string;
    hint?: string;
    fatal: boolean;
}
type SchematexParseResult = {
    ok: true;
    status: "valid" | "partial";
    type: DiagramType;
    ast: unknown;
    diagnostics: SchematexDiagnostic[];
} | {
    ok: false;
    status: "invalid";
    type: DiagramType | null;
    diagnostics: SchematexDiagnostic[];
};
type SchematexRenderResult = {
    ok: true;
    status: "valid" | "partial";
    type: DiagramType;
    svg: string;
    diagnostics: SchematexDiagnostic[];
    /** Present only for an explicit renderResult(..., { scene: true }) request. */
    scene?: SceneItem[];
} | {
    ok: false;
    status: "invalid";
    type: DiagramType | null;
    svg: string;
    diagnostics: SchematexDiagnostic[];
};

/**
 * Core type definitions for Schematex.
 *
 * The pipeline is: Text → Parser → AST → Layout → LayoutResult → Renderer → SVG
 *
 * Each diagram type (genogram, ecomap, pedigree) implements its own:
 *   - Parser:   text → DiagramAST
 *   - Layout:   DiagramAST → LayoutResult
 *   - Renderer: LayoutResult → SVG string
 */

type DiagramType = "genogram" | "ecomap" | "pedigree" | "phylo" | "sociogram" | "timing" | "logic" | "circuit" | "blockdiagram" | "ladder" | "sld" | "entity" | "fishbone" | "venn" | "flowchart" | "mindmap" | "matrix" | "orgchart" | "decisiontree" | "timeline" | "state" | "pid" | "erd" | "breadboard" | "bpmn" | "fbd" | "sfc" | "prisma" | "usecase" | "pert" | "sequence" | "petri" | "network" | "umlclass" | "faulttree" | "bowtie" | "eventtree" | "fmea" | "rbd" | "comparison" | "causalloop" | "markov" | "gitgraph" | "epc" | "idef0" | "threatmodel" | "welding" | "floorplan" | "siteplan" | "playbook";
type GenogramMode = "medical" | "heritage";
/**
 * Standard legend positions:
 *   - "bottom-inline" (default) — horizontal strip below the diagram, no box/border
 *   - "bottom-right"            — overlay anchored at bottom-right corner
 *   - "none"                    — disabled
 *
 * All other values are legacy aliases (pedigree DSL, older docs) that the renderer
 * silently maps to one of the standard positions: "outside-*", "right",
 * "top-*", "bottom-left", "bottom-center" → bottom-inline (or bottom-right where
 * a corner is closer in spirit).
 */
type LegendPosition = "bottom-inline" | "bottom-right" | "none" | "top-left" | "top-right" | "bottom-left" | "bottom-center" | "outside-right" | "outside-bottom" | "right";
type LegendItemKind = "shape" | "fill" | "fill-pattern" | "line" | "marker" | "edge";
type LegendLinePattern = "solid" | "dashed" | "dotted" | "double" | "wavy" | "zigzag" | "broken";
interface LegendItem {
    /** Stable identifier addressable from DSL `legend.label <key>: ...` */
    key: string;
    /** Display text (user-overridable). */
    label: string;
    kind: LegendItemKind;
    /** Primary color. For "shape": stroke. For "line"/"edge": stroke. For "fill"/"fill-pattern"/"marker": fill. */
    color?: string;
    /** For kind: "shape" — fill color (separate from stroke). Used for WYSIWYG matching of node fills. */
    fill?: string;
    /** Secondary color for two-tone swatches (half-fill, etc.). */
    color2?: string;
    pattern?: LegendLinePattern;
    strokeWidth?: number;
    /** For kind: "shape" — "square" | "circle" | "diamond" | "triangle" | "concentric-square" | "concentric-circle". */
    shape?: string;
    /** For kind: "marker" / "edge" — "arrow" | "X" | "dot" | "P" | "C" | "E" | "star" | "slash". */
    marker?: string;
    /** Section group id (e.g. "symbols", "structural", "relationships", "conditions"). */
    section?: string;
}
/** User edits parsed from DSL; merged onto each diagram's auto-derived spec. */
interface LegendOverrides {
    mode?: "on" | "off" | "auto";
    title?: string;
    position?: LegendPosition;
    columns?: number;
    /** Rename items by key. */
    labels?: Record<string, string>;
    /** Hide items by key. */
    hide?: string[];
    /** Rename / hide sections by id. */
    sections?: Record<string, {
        title?: string;
        hidden?: boolean;
    }>;
    /** Manually authored items appended after auto-derived ones. */
    added?: LegendItem[];
}
interface DiagramAST {
    type: DiagramType;
    individuals: Individual[];
    relationships: Relationship[];
    metadata?: Record<string, string>;
    /** Exact authored title token, including quotes when present. */
    titleSourceRange?: SourceRange;
    /** Legacy: pedigree-style trait legend. To be migrated into LegendOverrides.added. */
    legend?: LegendEntry[];
    /** Genogram display mode: medical conditions or cultural heritage */
    mode?: GenogramMode;
    /** Legacy: pre-unified-legend position field. New code uses legendOverrides.position. */
    legendPosition?: LegendPosition;
    /** Unified legend system — user DSL edits merged onto auto-derived spec at render time. */
    legendOverrides?: LegendOverrides;
}
interface LegendEntry {
    id: string;
    label: string;
    /** Fill position (for pedigree trait legend) */
    fill?: ConditionFill;
    /** Color (for heritage legend or pedigree trait legend) */
    color?: string;
}
interface Individual {
    id: string;
    label: string;
    /** Exact explicitly-authored display label token. */
    labelSourceRange?: SourceRange;
    sex: Sex;
    status: IndividualStatus;
    birthYear?: number;
    deathYear?: number;
    /**
     * Full ISO birth date (`"1940-03-12"`) for genealogy / legal family trees.
     * Backward-compatible with `birthYear`: when present it takes precedence in
     * the vital-records caption (`* 1940-03-12`). A bare 4-digit year still fills
     * `birthYear`.
     */
    dob?: string;
    /** Full ISO death date (`"2018-11-04"`), rendered as `† 2018-11-04`. */
    dod?: string;
    /** One-line free-text annotation rendered as a small caption under the symbol. */
    note?: string;
    /**
     * Legal/genealogy birth status (German Ahnentafel convention). Modifies the
     * born glyph in the vital-records caption: `out-of-wedlock` → `(*)`,
     * `adopted` → `[*]`. Default (legitimate) keeps the plain `*` born glyph.
     */
    birthStatus?: "legitimate" | "out-of-wedlock" | "adopted";
    /** Medical/psychological conditions (genogram) or affected traits (pedigree) */
    conditions?: Condition[];
    /** Genetic status for pedigree charts */
    geneticStatus?: GeneticStatus;
    /** Child relationship modifier */
    childType?: ChildType;
    /** Special markers */
    markers?: IndividualMarker[];
    /** Gender identity annotation (Bennett 2022: when gender ≠ assigned sex) */
    genderIdentity?: string;
    /** Cultural/ethnic heritage identifiers (heritage genogram mode) */
    heritage?: string[];
    /** Age to display inside shape (auto-calculated from birthYear if omitted) */
    age?: number;
    /** Rich annotations: occupation, traits, notes, etc. */
    annotations?: Record<string, string>;
    /** Whether this individual is external/non-family (dashed border) */
    external?: boolean;
    /**
     * Optional shape override. By default the shape is derived from `sex`
     * (male=square, female=circle, other=diamond). Some kinship/anthropology
     * conventions use triangles for males, etc. This field lets the DSL request
     * a specific shape regardless of sex.
     */
    shape?: "square" | "circle" | "diamond" | "triangle" | "triangle-down";
    /**
     * Pedigree convention for "known relative, unknown ancestry":
     * id of another individual whose generation this person shares as a sibling.
     * No phantom parents are synthesized — layout pins generation, renderer
     * draws a dashed bracket between the two.
     */
    siblingOf?: string;
    /** Custom properties for extensibility */
    properties?: Record<string, string>;
}
type Sex = "male" | "female" | "unknown" | "other" | "nonbinary" | "intersex";
type IndividualStatus = "alive" | "deceased" | "stillborn" | "miscarriage" | "abortion" | "pregnancy" | "sab" | "tab" | "ectopic";
type GeneticStatus = "unaffected" | "affected" | "carrier" | "carrier-x" | "obligate-carrier" | "presymptomatic";
type ChildType = "biological" | "adopted" | "adopted-in" | "adopted-out" | "foster" | "step" | "surrogate" | "donor" | "donor-egg" | "donor-sperm" | "donor-embryo";
type IndividualMarker = "proband" | "consultand" | "evaluated" | "index-person" | "transgender" | "no-children" | "infertile" | "unknown-siblings";
interface Condition {
    label: string;
    /** Fill pattern for condition display */
    fill: ConditionFill;
    /** Color for the fill (hex or named). Falls back to category default. */
    color?: string;
    /** Medical category for automatic color assignment */
    category?: MedicalCategory;
}
type ConditionFill = "full" | "half-left" | "half-right" | "half-top" | "half-bottom" | "quad-tl" | "quad-tr" | "quad-bl" | "quad-br" | "striped" | "dotted" | "carrier";
/** Standard 22-category medical condition system (genogram) */
type MedicalCategory = "cardiovascular" | "cancer" | "diabetes" | "mental-health" | "depression" | "anxiety" | "bipolar" | "ptsd" | "substance-alcohol" | "substance-drugs" | "substance-tobacco" | "neurological" | "respiratory" | "autoimmune" | "genetic" | "reproductive" | "eating-disorder" | "learning-developmental" | "kidney" | "liver-gi" | "obesity" | "other";
type FishboneOrientation = "ltr" | "rtl";
/** Which halves of the spine host ribs. */
type FishboneSides = "both" | "top" | "bottom";
/** Density preset — controls spine length, slot spacing, header size. */
type FishboneDensity = "compact" | "normal" | "spacious";
/** Where cause branches stick out of a rib. */
type FishboneCauseSide = "head" | "tail" | "both";
interface FishboneNode {
    /** Display text on the bone. */
    label: string;
    /** Exact authored label token used by interactive text editing. */
    sourceRange?: SourceRange;
    /** Optional explicit hex color (conventionally set only on majors). */
    color?: string;
    /** Nested sub-causes (unbounded depth, recommended ≤ 3). */
    children: FishboneNode[];
    /** Per-rib placement override (only honored on majors). */
    side?: "top" | "bottom";
    /** Per-rib explicit ordering within its half (lower = closer to tail). */
    order?: number;
}
interface FishboneLegendEntry {
    label: string;
    color: string;
}
interface FishboneAST {
    type: "fishbone";
    title?: string;
    titleSourceRange?: SourceRange;
    /** Problem / outcome displayed in the head box. */
    effect: string;
    effectSourceRange?: SourceRange;
    /** Top-level cause categories (major bones). */
    majors: FishboneNode[];
    /** Effect position: `ltr` → head on right, `rtl` → head on left. */
    orientation: FishboneOrientation;
    /** Optional explicit canvas dimensions (otherwise auto-computed). */
    width?: number;
    height?: number;
    /** Optional legend entries rendered in a corner box. */
    legend?: FishboneLegendEntry[];
    metadata?: Record<string, string>;
    /** Which sides of the spine host ribs. Default: "both". */
    sides?: FishboneSides;
    /** Rib slope dx/dy. Default: 0.6. Accepts number or preset name. */
    ribSlope?: number;
    /** Density preset. Default: "normal". */
    density?: FishboneDensity;
    /** Which side of the rib cause branches stick out on. Default: "head". */
    causeSide?: FishboneCauseSide;
}
/** Layout algorithm for phylogenetic tree */
type PhyloLayout = "rectangular" | "slanted" | "circular" | "unrooted";
/** Tree representation mode — determines how branch lengths are interpreted */
type PhyloMode = "phylogram" | "cladogram" | "chronogram";
/** Clade highlight display mode */
type CladeHighlightMode = "branch" | "background" | "both";
/** A phylogenetic tree node (distinct from family-tree Individual) */
interface PhyloNode {
    /** Unique id (auto-generated for unnamed internal nodes) */
    id: string;
    /** Display label (species name, gene id, etc.) */
    label?: string;
    /** Branch length to parent (substitutions/site or time units) */
    branchLength?: number;
    /** Bootstrap support or Bayesian posterior probability (0-100 or 0-1) */
    support?: number;
    /** Children nodes (empty = leaf/tip) */
    children: PhyloNode[];
    /** Is this a leaf/tip node? */
    isLeaf: boolean;
    /** NHX metadata key-value pairs */
    nhx?: Record<string, string>;
}
/** Clade definition for visual highlighting */
interface CladeDef {
    id: string;
    /** Label to display next to clade bracket/background */
    label?: string;
    /** Leaf ids that define this clade (MRCA computed automatically) */
    members: string[];
    /** Branch/background color */
    color?: string;
    /** Highlight mode */
    highlight?: CladeHighlightMode;
}
/** Phylogenetic tree AST — separate from DiagramAST because structure is fundamentally different */
interface PhyloTreeAST {
    type: "phylo";
    /** Tree title */
    title?: string;
    /** Root node of the tree */
    root: PhyloNode;
    /** Is this explicitly unrooted? */
    unrooted: boolean;
    /** Layout algorithm */
    layout: PhyloLayout;
    /** Branch length interpretation */
    mode: PhyloMode;
    /** Clade definitions for visual highlighting */
    clades: CladeDef[];
    /** Scale bar label (e.g. "substitutions/site", "Million years ago") */
    scaleLabel?: string;
    /** Most recent sampling date (for chronogram mode) */
    mrsd?: string;
    /** Outgroup taxon id (for rooting) */
    outgroup?: string;
    /** Custom metadata */
    metadata?: Record<string, string>;
}
/** Layout result for phylogenetic tree */
interface PhyloLayoutNode {
    node: PhyloNode;
    x: number;
    y: number;
    /** Angle in radians (for circular/unrooted layouts) */
    angle?: number;
    /** Radius from center (for circular/unrooted layouts) */
    radius?: number;
}
type RelationshipType = "married" | "divorced" | "separated" | "engaged" | "cohabiting" | "cohabiting-ended" | "domestic-partnership" | "consanguineous" | "parent-child" | "adopted" | "foster" | "twin-identical" | "twin-fraternal" | "harmony" | "close" | "bestfriends" | "love" | "inlove" | "friendship" | "hostile" | "conflict" | "enmity" | "distant-hostile" | "cutoff" | "close-hostile" | "fused" | "fused-hostile" | "distant" | "normal" | "nevermet" | "abuse" | "physical-abuse" | "emotional-abuse" | "sexual-abuse" | "neglect" | "manipulative" | "controlling" | "jealous" | "focused" | "focused-neg" | "distrust" | "admirer" | "limerence" | "strong" | "moderate" | "weak" | "stressful" | "stressful-strong" | "conflictual" | "broken" | "reciprocal";
interface Relationship {
    type: RelationshipType;
    from: string;
    to: string;
    label?: string;
    /** Is this relationship directional? (abuse, control, focused, ecomap energy flow) */
    directional?: boolean;
    /** For ecomap: line weight 1-5 */
    weight?: number;
    /** For ecomap: energy flow direction */
    energyFlow?: "from" | "to" | "mutual" | "none";
    /**
     * Genogram parent-child only. When true, this link is data-true but
     * does NOT dominate layout — used for foster/adopted/guardian "current
     * caregiver" relationships when biological parents already claim the
     * child structurally. Renderer draws it as a dotted line.
     */
    secondary?: boolean;
}
interface LayoutResult {
    width: number;
    height: number;
    nodes: LayoutNode[];
    edges: LayoutEdge[];
}
interface LayoutNode {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    /** Generation/layer index (0 = oldest generation) */
    generation: number;
    individual: Individual;
}
interface LayoutEdge {
    from: string;
    to: string;
    relationship: Relationship;
    /** SVG path data (d attribute) */
    path: string;
}
/** A source span in the caller's original UTF-16 string coordinate space. */
interface SourceRange {
    /** Absolute UTF-16 offsets; end is exclusive. */
    start: number;
    end: number;
    /** Zero-based line and columns; colEnd is exclusive. */
    line: number;
    colStart: number;
    colEnd: number;
}
type ScenePositionSource = {
    /** Existing authored `x,y` coordinate pair. */
    kind?: "point";
    range: SourceRange;
    x: number;
    y: number;
    unitsPerSvgX: number;
    unitsPerSvgY: number;
    /** Optional syntax emitted around the coordinate pair (also supports zero-width insertion ranges). */
    prefix?: string;
    suffix?: string;
} | {
    /** One authored scalar controlled by a one-axis geometry handle. */
    kind: "scalar";
    range: SourceRange;
    value: number;
    unitsPerSvgX: number;
    min?: number;
    max?: number;
    prefix?: string;
    suffix?: string;
} | {
    /** Reorder one complete authored block by dragging a discrete row handle. */
    kind: "source-block";
    range: SourceRange;
    blocks: SourceRange[];
    index: number;
    step: number;
} | {
    /** Authored `WxH` dimensions, edited by edge/corner handles. */
    kind: "size";
    range: SourceRange;
    width: number;
    height: number;
    unitsPerSvgX: number;
    unitsPerSvgY: number;
    axis: "x" | "y" | "xy";
    minWidth?: number;
    minHeight?: number;
} | {
    /** Timeline date or year scalar, edited on the time axis. */
    kind: "date";
    range: SourceRange;
    value: number;
    raw: string;
    precision: "day" | "month" | "year" | "ma";
    unitsPerSvgX: number;
} | {
    /** Boundary between two adjacent runs in a canonical timing wave. */
    kind: "wave-boundary";
    range: SourceRange;
    wave: string;
    boundary: number;
    runStart: number;
    runEnd: number;
    periodWidth: number;
} | {
    /** Breadboard point/span placement, snapped to physical board holes. */
    kind: "breadboard";
    range: SourceRange;
    from: {
        kind: "hole" | "rail";
        col: number;
        row?: string;
        rail?: string;
    };
    to?: {
        kind: "hole" | "rail";
        col: number;
        row?: string;
        rail?: string;
    };
    anchorSvgX: number;
    anchorSvgY: number;
    gridX0: number;
    holeRowYs: number[];
    railRowYs: Record<string, number>;
    pitch: number;
    cols: number;
};
/** Derived geometry and source identity for an interactive render. */
interface SceneItem {
    /** Render-unique identity. This, rather than semanticId, is written to SVG. */
    key: string;
    kind: "node" | "edge" | "label" | "group" | "handle";
    /** Revision of the exact source from which this derived item was rendered. */
    sourceRevision?: number;
    /** Stable DSL identity used by pin/reconcile operations when available. */
    semanticId?: string;
    label?: string;
    /**
     * How setLabel writes the edited value back into source. Most DSL labels
     * use delimiter-aware encoding; authored markup such as Mindmap Markdown
     * must be replaced verbatim so quotes/backticks remain meaningful content.
     */
    labelWrite?: "encoded" | "verbatim" | "identifier" | "newick-bare" | "newick-quoted";
    sourceRange?: SourceRange;
    /** Exact authored bytes at sourceRange when this item was rendered. */
    expectedText?: string;
    /** All identity references that must be renamed atomically with this label. */
    labelSourceRanges?: SourceRange[];
    /** Exact authored bytes corresponding one-to-one with labelSourceRanges. */
    labelExpectedTexts?: string[];
    bbox?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    path?: string;
    /**
     * Optional native coordinate writer for DSLs that already author an `at x,y`
     * token. The interaction layer still works in SVG coordinates; setPosition
     * converts the drag delta back into source units and replaces this range.
     */
    positionSource?: ScenePositionSource;
    editable: {
        label: boolean;
        position: "free" | "move-x" | "move-y" | "none";
    };
}
interface DiagramPlugin {
    type: DiagramType;
    detect: (text: string) => boolean;
    render: (text: string, config?: RenderConfig) => string;
    /** Parse DSL text to the diagram's AST (for JSON export / programmatic access). */
    parse?: (text: string) => unknown;
    /**
     * Optional non-fatal validation pass. Runs after a successful parse and
     * returns domain-level warnings (e.g. an incomplete instrument loop) without
     * blocking rendering. Surfaced through `parseResult` / `renderResult`
     * diagnostics. Must not throw — return `[]` when there's nothing to flag.
     */
    lint?: (text: string) => SchematexDiagnostic[];
    capabilities?: {
        /** Renderer can populate RenderConfig.__scene when explicitly requested. */
        scene?: boolean;
        /** The engine has at least one safe position-editing mode. */
        editablePosition?: boolean;
    };
}
interface LayoutConfig {
    /** Horizontal spacing between nodes */
    nodeSpacingX: number;
    /** Vertical spacing between generations */
    nodeSpacingY: number;
    /** Node dimensions */
    nodeWidth: number;
    nodeHeight: number;
}
interface RenderConfig {
    fontFamily: string;
    fontSize: number;
    theme: string;
    padding: number;
    /** Show age number inside shapes */
    showAge?: boolean;
    /** Show rich annotations below names */
    showAnnotations?: boolean;
    /** Show relationship labels on lines */
    showEdgeLabels?: boolean;
    /** Show in-law relationship labels */
    showInLawLabels?: boolean;
    /** Legend position override */
    legendPosition?: LegendPosition;
    /** @internal Core-owned scene collector; absent in the default render path. */
    __scene?: SceneItem[];
    /** @internal Parsed @overrides pins, blanked out before the diagram parser. */
    __pins?: Map<string, {
        x: number;
        y: number;
    }>;
    /** @internal Exact preprocessed DSL available to engine-specific renderers. */
    __source?: string;
}
interface TimingSignal {
    /** Signal name (display label) */
    name: string;
    /** WaveDrom wave string: sequence of state chars */
    wave: string;
    /** Exact authored wave token; absent for expanded clock/rle shorthand. */
    waveSourceRange?: SourceRange;
    /** Data labels for bus states (= or 2-9) */
    data?: string[];
    /** Phase offset in half-periods */
    phase?: number;
    /** Period multiplier */
    period?: number;
    /** Node markers for annotation arrows */
    node?: string;
}
interface TimingGroup {
    label: string;
    signals: Array<TimingSignal | TimingGroup>;
}
interface TimingAnnotation {
    /** Source node marker id */
    from: string;
    /** Target node marker id */
    to: string;
    label?: string;
}
interface TimingAST {
    type: "timing";
    title?: string;
    titleSourceRange?: SourceRange;
    /** Time scale multiplier (1–4) */
    hscale?: number;
    signals: Array<TimingSignal | TimingGroup>;
    annotations?: TimingAnnotation[];
    metadata?: Record<string, string>;
}
type LogicGateType = "AND" | "OR" | "NOT" | "NAND" | "NOR" | "XOR" | "XNOR" | "BUF" | "TRISTATE_BUF" | "TRISTATE_INV" | "OPEN_DRAIN" | "SCHMITT" | "DFF" | "JKFF" | "SRFF" | "TFF" | "LATCH_SR" | "LATCH_D" | "MUX" | "DEMUX" | "DECODER" | "ENCODER" | "COUNTER" | "SHIFT_REG" | "unknown";
type LogicGateStyle = "ansi" | "iec";
interface LogicGateNode {
    id: string;
    gateType: LogicGateType;
    /** Original (unrecognised) gate token, set only when `gateType === "unknown"`. */
    rawType?: string;
    inputs: string[];
    label?: string;
    style?: LogicGateStyle;
    /** Optional module/sub-circuit this gate belongs to */
    moduleId?: string;
}
interface LogicGateModule {
    id: string;
    label: string;
}
interface LogicGateInput {
    id: string;
    label: string;
    isActiveLow?: boolean;
    /** True when the parser inferred this input from a gate reference rather than an explicit declaration. */
    autoDeclared?: boolean;
}
interface LogicGateOutput {
    id: string;
    /** Signal source id (gate output or input port) */
    from: string;
    label: string;
    isActiveLow?: boolean;
}
interface LogicGateAST {
    type: "logic";
    title?: string;
    style?: LogicGateStyle;
    inputs: LogicGateInput[];
    outputs: LogicGateOutput[];
    gates: LogicGateNode[];
    modules?: LogicGateModule[];
    metadata?: Record<string, string>;
    /** Non-fatal parser warnings (e.g. signals auto-declared as inputs). */
    warnings?: string[];
}
type CircuitComponentType = "resistor" | "potentiometer" | "rheostat" | "thermistor_ntc" | "thermistor_ptc" | "ldr" | "varistor" | "fuse" | "fuse_slow" | "capacitor" | "electrolytic_cap" | "variable_cap" | "inductor" | "inductor_iron" | "inductor_ferrite" | "variable_inductor" | "ferrite_bead" | "crystal" | "transformer" | "diode" | "zener" | "schottky" | "led" | "photodiode" | "varactor" | "tvs_diode" | "bridge_rectifier" | "npn" | "pnp" | "darlington_npn" | "darlington_pnp" | "nmos" | "pmos" | "nmos_depletion" | "jfet_n" | "jfet_p" | "igbt" | "scr" | "triac" | "diac" | "phototransistor" | "optocoupler" | "opamp" | "comparator" | "schmitt_buffer" | "tri_state_buffer" | "instrumentation_amp" | "generic_ic" | "voltage_regulator" | "dc_dc_converter" | "555_timer" | "terminal_block" | "enclosure" | "din_rail" | "wire_duct" | "plc" | "pilot_light" | "selector_switch" | "emergency_stop" | "voltage_source" | "current_source" | "ac_source" | "battery" | "vcc" | "ground" | "gnd_signal" | "gnd_chassis" | "gnd_digital" | "switch_spst" | "switch_spdt" | "switch_dpdt" | "push_no" | "push_nc" | "relay_coil" | "relay_no" | "relay_nc" | "contactor" | "solenoid_valve" | "thermal_overload" | "disconnect_switch" | "motor" | "lamp" | "speaker" | "microphone" | "buzzer" | "ammeter" | "voltmeter" | "wattmeter" | "oscilloscope" | "wire" | "dot" | "label" | "port" | "test_point" | "no_connect" | "antenna";
type CircuitDirection = "right" | "left" | "up" | "down";
interface CircuitComponent {
    id: string;
    /** True only when the id is explicitly authored and safe to persist in @overrides. */
    stableId?: boolean;
    componentType: CircuitComponentType;
    direction: CircuitDirection;
    /** Reference to anchor point of previous/named element: e.g. "R1.end", "origin" */
    at?: string;
    /** Display label (R1, C2, etc.) */
    label?: string;
    labelSourceRange?: SourceRange;
    /** Value annotation (1kΩ, 100nF, etc.) */
    value?: string;
    valueSourceRange?: SourceRange;
    /** Extra attributes (length for wires, gain for opamp, etc.) */
    attrs?: Record<string, string>;
}
/** Multi-terminal electrical node — connects multiple anchor refs to the same node */
interface CircuitNet {
    /** Net name (e.g. "VOUT") */
    id: string;
    /** Anchor refs sharing the same node (e.g. ["R2.end", "U1.out", "OUT.start"]) */
    anchors: string[];
}
interface CircuitAST {
    type: "circuit";
    title?: string;
    titleSourceRange?: SourceRange;
    components: CircuitComponent[];
    /** Explicit net declarations for multi-terminal connections */
    nets: CircuitNet[];
    metadata?: Record<string, string>;
    /** Layout mode: "positional" (Schemdraw-style direction chain) or "netlist" (SPICE-style, auto-layout). */
    mode?: "positional" | "netlist";
    /**
     * Netlist-only. Maps componentId → { pinName → netId }.
     * Populated by the netlist parser; consumed by the auto-layout engine.
     */
    pinMap?: Record<string, Record<string, string>>;
    /**
     * Netlist-only recoverable-input notes. Components given fewer nets than
     * their pin count are padded with floating no-connect nets and rendered
     * anyway (rather than throwing). Surfaced as `CIRCUIT_PIN_UNDERSPECIFIED`
     * lint warnings (status `partial`).
     */
    recovered?: {
        underspecified?: {
            id: string;
            type: string;
            expected: number;
            got: number;
        }[];
    };
}
type BlockRole = "plant" | "controller" | "sensor" | "actuator" | "reference" | "disturbance" | "generic";
interface BlockNode {
    id: string;
    /** Display label / transfer function e.g. "G(s)" */
    label: string;
    role?: BlockRole;
    /** Routing hint for feedback/feedforward blocks: "above" = route over forward path */
    route?: "above" | "below";
}
interface SummingJunction {
    id: string;
    /** Signed inputs: "+r" means add signal r, "-ym" means subtract signal ym */
    inputs: string[];
    /** Output signal id */
    output?: string;
}
interface BlockEdge {
    from: string;
    to: string;
    /** Signal label e.g. "E(s)", "U(s)" */
    label?: string;
    /** Dashed line for discrete-time signals */
    discrete?: boolean;
}
interface BlockAST {
    type: "blockdiagram";
    title?: string;
    blocks: BlockNode[];
    sums: SummingJunction[];
    connections: BlockEdge[];
    metadata?: Record<string, string>;
}
type LadderContactType = "XIC" | "XIO" | "ONS" | "OSF";
type LadderCoilType = "OTE" | "OTL" | "OTU" | "OTN" | "RES";
type LadderFBType = "TON" | "TOFF" | "TP" | "CTU" | "CTD" | "CTUD" | "ADD" | "SUB" | "MUL" | "DIV" | "MOV" | "EQU" | "NEQ" | "GRT" | "LES" | "GEQ" | "LEQ";
interface LadderContact {
    elementType: "contact";
    contactType: LadderContactType;
    tag: string;
    address?: string;
    /** Human-readable description (rendered above the tag as 1–3 wrapped lines) */
    name?: string;
}
interface LadderCoil {
    elementType: "coil";
    coilType: LadderCoilType;
    tag: string;
    address?: string;
    /** Human-readable description (rendered above the tag as 1–3 wrapped lines) */
    name?: string;
}
interface LadderFunctionBlock {
    elementType: "function_block";
    fbType: LadderFBType;
    tag: string;
    params: Record<string, string | number>;
}
type LadderElement = LadderContact | LadderCoil | LadderFunctionBlock;
interface LadderBranch {
    elements: LadderElement[];
}
interface LadderRung {
    number: number;
    comment?: string;
    /** Sequential elements and parallel groups */
    elements: Array<LadderElement | {
        parallel: LadderBranch[];
    }>;
}
interface LadderAST {
    type: "ladder";
    title?: string;
    rungs: LadderRung[];
    metadata?: Record<string, string>;
}
type SLDNodeType = "utility" | "generator" | "solar" | "wind" | "ups" | "transformer" | "transformer_dy" | "transformer_yd" | "transformer_yy" | "transformer_dd" | "autotransformer" | "transformer_3winding" | "bus" | "bus_tie" | "hub" | "breaker" | "breaker_vacuum" | "switch" | "switch_load" | "ground_switch" | "ats" | "recloser" | "sectionalizer" | "fuse" | "fuse_cl" | "ct" | "pt" | "relay" | "surge_arrester" | "ground_fault" | "rcd" | "motor" | "load" | "capacitor_bank" | "harmonic_filter" | "vfd" | "watthour_meter" | "demand_meter" | "consumer_unit" | "unknown";
interface SLDNode {
    id: string;
    nodeType: SLDNodeType;
    /** Original (unrecognised) type token, set only when `nodeType === "unknown"`. */
    rawType?: string;
    label?: string;
    /** Voltage level e.g. "13.8kV", "480V" */
    voltage?: string;
    /** Equipment rating e.g. "1000A", "500kVA" */
    rating?: string;
    /** ANSI device number (relays: 51, 87, 27, etc.) */
    deviceNumber?: string;
    /** Additional nameplate data (transformer: kVA, ratio, %Z) */
    nameplate?: Record<string, string>;
}
interface SLDConnection {
    from: string;
    to: string;
    /** Cable specification e.g. "3#2/0 AWG" */
    cable?: string;
    /** Cable cross-sectional area, common in IEC/REBT residential docs (e.g. "2.5 mm2"). */
    cableCsa?: string;
    /** Cable length in meters, when a prompt asks for cable schedule hints. */
    cableLengthM?: string;
    /** Cable insulation / construction (e.g. "H07V-K", "XLPE/SWA/PVC"). */
    cableInsulation?: string;
    label?: string;
}
/**
 * Symbol standard for SLD / circuit glyphs. `ansi` (IEEE 315 / ANSI Y32.2) is
 * the default and preserves historical rendering. `iec` (IEC 60617) switches to
 * IEC symbol forms. `abnt` (Brazil, NBR 5410) and `as-nzs` (Australia/NZ,
 * AS/NZS 3000) are IEC 60364-family presets: they reuse the IEC glyphs and add
 * their own jurisdiction labelling.
 */
type SLDStandard = "ansi" | "iec" | "abnt" | "as-nzs";
interface SLDAST {
    type: "sld";
    title?: string;
    /** Symbol standard (default `ansi`). */
    standard?: SLDStandard;
    nodes: SLDNode[];
    connections: SLDConnection[];
    metadata?: Record<string, string>;
}
type EntityType = "corp" | "llc" | "lp" | "trust" | "individual" | "foundation" | "disregarded" | "pool" | "placeholder";
type EntityStatus = "normal" | "new" | "eliminated" | "modified";
interface EntityNode {
    id: string;
    name: string;
    entityType: EntityType;
    /** ISO 3166-1 alpha-2 or 2-3 letter state code (DE, IE, KY, BVI, ...) */
    jurisdiction?: string;
    status?: EntityStatus;
    taxClass?: string;
    role?: string;
    note?: string;
    formationDate?: string;
    properties?: Record<string, string>;
}
type EntityEdgeOp = "ownership" | "voting" | "pool" | "license" | "distribution";
interface EntityEdge {
    from: string;
    to: string;
    op: EntityEdgeOp;
    /** Raw percentage text, e.g. "100%" or "V 75% / E 50%" or "was 40% → 100%" */
    percentage?: string;
    /** Share class label (Series A Pref, Common, Option Pool) */
    shareClass?: string;
    label?: string;
}
interface JurisdictionDef {
    code: string;
    name: string;
    color?: string;
}
interface ClusterDef {
    id: string;
    label: string;
    /** Entity ids (explicit members) */
    members: string[];
    color?: string;
}
interface EntityAST {
    type: "entity";
    title?: string;
    entities: EntityNode[];
    edges: EntityEdge[];
    jurisdictions: JurisdictionDef[];
    clusters: ClusterDef[];
    metadata?: Record<string, string>;
}
type VennDiagramMode = "auto" | "venn" | "euler";
type VennPalette = "default" | "brand" | "monochrome";
type VennBlendMode = "multiply" | "screen" | "none";
type VennEulerRelationType = "subset" | "disjoint" | "overlap";
/** Raw value attached to a region. */
type VennRegionValue = {
    kind: "integer";
    value: number;
} | {
    kind: "percent";
    value: number;
} | {
    kind: "text";
    value: string;
} | {
    kind: "list";
    value: string[];
} | {
    kind: "none";
};
/** One set (a circle or ellipse in the diagram). */
interface VennSet {
    id: string;
    label: string;
    /** Optional explicit elements (enumeration DSL). */
    elements?: string[];
    /** Override color (hex). */
    color?: string;
    /** Optional normalized center authored by the native geometry handle. */
    at?: {
        x: number;
        y: number;
    };
    /** Optional normalized radius / ellipse scale authored by the native size handle. */
    radius?: number;
}
/** A named region. `sets` is the subset of set ids that define it (at least one). */
interface VennRegion {
    /** Sorted list of set ids that belong to the intersection (e.g. ["A","B"]). */
    sets: string[];
    /** Does this region mean "only" these sets (exclude any other set)? */
    only: boolean;
    /** Value payload attached to the region. */
    value: VennRegionValue;
}
interface VennEulerRelation {
    from: string;
    to: string;
    type: VennEulerRelationType;
}
interface VennConfig {
    mode: VennDiagramMode;
    proportional: boolean;
    palette: VennPalette;
    blendMode: VennBlendMode;
    showCounts: boolean | "auto";
    showPercent: boolean;
}
interface VennAST {
    type: "venn";
    title?: string;
    sets: VennSet[];
    regions: VennRegion[];
    relations: VennEulerRelation[];
    config: VennConfig;
    metadata?: Record<string, string>;
}
/** Circle geometry (n=2, n=3 and Euler). */
interface VennCircle {
    id: string;
    cx: number;
    cy: number;
    r: number;
}
/** Ellipse geometry (n=4). */
interface VennEllipse {
    id: string;
    cx: number;
    cy: number;
    rx: number;
    ry: number;
    /** Rotation in degrees around (cx,cy). */
    rotation: number;
}
type VennShape = ({
    kind: "circle";
} & VennCircle) | ({
    kind: "ellipse";
} & VennEllipse);
interface VennLabelPosition {
    /** Region this label describes (sorted set ids). */
    sets: string[];
    /** Canonical label text (e.g. "A ∩ B", "42", "[a,b,c]"). */
    label: string;
    /** Centroid x / y (inside or external). */
    x: number;
    y: number;
    /** If true, label is placed outside the region and `leader` is populated. */
    external: boolean;
    /** Optional leader line endpoints (from region-interior → label). */
    leader?: {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
    };
    /** Text anchor for external labels. */
    anchor?: "start" | "middle" | "end";
}
interface VennLayoutResult {
    width: number;
    height: number;
    /** Rendering mode chosen (venn or euler; upset deferred). */
    mode: "venn" | "euler";
    /** Shape per set id (circles for n=2/3/euler, ellipses for n=4). */
    shapes: VennShape[];
    /** Region labels + placements. */
    labels: VennLabelPosition[];
    /** Set-title positions (one per set). */
    setLabels: Array<{
        id: string;
        label: string;
        x: number;
        y: number;
        anchor: "start" | "middle" | "end";
    }>;
    /** Title placement (optional). */
    title?: {
        text: string;
        x: number;
        y: number;
    };
    /** Proportional-solve residual (0 if not proportional). */
    proportionalResidual?: number;
}
type FlowchartDirection = "TB" | "BT" | "LR" | "RL";
/**
 * Shape keyword catalog. M1 implements only the first 5; the rest are reserved
 * for M2 so AST/types don't have to be rewritten later.
 */
type FlowchartShape = "rect" | "round" | "stadium" | "diamond" | "parallelogram" | "parallelogram-alt" | "trapezoid" | "trapezoid-alt" | "subroutine" | "cylinder" | "circle" | "double-circle" | "hexagon" | "asymmetric";
type FlowchartEdgeKind = "solid" | "none" | "dotted" | "thick" | "bidirectional" | "crossed" | "round-end";
type FlowchartArrowEnd = "none" | "arrow" | "circle" | "cross";
interface FlowchartNode {
    id: string;
    label: string;
    shape: FlowchartShape;
    icon?: string;
    classes?: string[];
    /** Inline CSS overrides from `style nodeId fill:#f9f,...` */
    style?: Record<string, string>;
    /** Containing subgraph id (undefined = root) */
    parent?: string;
    /** Exact editable label token in the parser input. */
    labelSourceRange?: SourceRange;
}
interface FlowchartEdge {
    id?: string;
    from: string;
    to: string;
    kind: FlowchartEdgeKind;
    label?: string;
    arrowStart?: FlowchartArrowEnd;
    arrowEnd?: FlowchartArrowEnd;
    classes?: string[];
    /** Reversed during cycle-removal (renderer must flip visual arrow) */
    isReversed?: boolean;
    /** Exact editable edge-label token in the parser input. */
    labelSourceRange?: SourceRange;
}
interface FlowchartSubgraph {
    id: string;
    label: string;
    direction?: FlowchartDirection;
    children: string[];
    subgraphs: string[];
    classes?: string[];
}
interface FlowchartClassDef {
    id: string;
    props: Record<string, string>;
}
interface FlowchartAST {
    type: "flowchart";
    title?: string;
    titleSourceRange?: SourceRange;
    direction: FlowchartDirection;
    nodes: FlowchartNode[];
    edges: FlowchartEdge[];
    subgraphs: FlowchartSubgraph[];
    classDefs: FlowchartClassDef[];
    /** linkStyle index → css-ish props. Parsed in M1, applied in M2. */
    linkStyles: Map<number, Record<string, string>>;
    metadata?: Record<string, string>;
}
interface FlowchartLayoutNode {
    node: FlowchartNode;
    x: number;
    y: number;
    width: number;
    height: number;
    /** 0-based layer index (top for TB, left for LR) */
    layer: number;
    /** Position within the layer (0-based) */
    order: number;
    /** Dummy routing node inserted for long edges */
    isDummy?: boolean;
}
interface FlowchartLayoutEdge {
    edge: FlowchartEdge;
    /** SVG path d attribute */
    path: string;
    /** Label anchor with optional text-anchor hint for proper line clearance */
    labelAnchor?: {
        x: number;
        y: number;
        textAnchor?: "start" | "middle" | "end";
    };
    /** Position in `ast.edges` (declaration order) — used by linkStyle index targeting */
    index?: number;
}
interface FlowchartLayoutCluster {
    subgraph: FlowchartSubgraph;
    x: number;
    y: number;
    width: number;
    height: number;
    depth: number;
}
interface FlowchartLayoutResult {
    width: number;
    height: number;
    direction: FlowchartDirection;
    nodes: FlowchartLayoutNode[];
    edges: FlowchartLayoutEdge[];
    clusters: FlowchartLayoutCluster[];
    /** Optional expanded viewport when authored pins leave the auto-layout canvas. */
    viewBox?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}

export type { BlockAST as B, CircuitAST as C, DiagramPlugin as D, EntityAST as E, FishboneAST as F, Individual as I, LayoutConfig as L, PhyloTreeAST as P, RenderConfig as R, SceneItem as S, TimingAST as T, VennAST as V, SourceRange as a, SchematexDiagnostic as b, DiagramType as c, SchematexParseResult as d, SchematexRenderResult as e, SchematexResultStatus as f, DiagramAST as g, LayoutResult as h, PhyloLayoutNode as i, LegendOverrides as j, LogicGateAST as k, CircuitComponent as l, LadderAST as m, LadderRung as n, LadderElement as o, SLDAST as p, SLDNode as q, SLDNodeType as r, EntityNode as s, EntityEdge as t, VennLayoutResult as u, FlowchartAST as v, FlowchartLayoutResult as w };
