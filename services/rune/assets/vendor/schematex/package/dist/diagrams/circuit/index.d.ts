import { C as CircuitAST, b as SchematexDiagnostic, R as RenderConfig, l as CircuitComponent, D as DiagramPlugin } from '../../types-Bgj27ejP.js';

/**
 * Top-level circuit parser. Detects two DSL modes:
 *
 *   1. Positional (Schemdraw-style):   header `circuit "name"`, body uses
 *      direction chains, `wire`, `at:`, bare component types with direction.
 *
 *   2. Netlist (SPICE-style):          header `circuit "name" netlist`, body
 *      uses `<ID> <net1> <net2> [value]` lines. Auto-layout engine computes
 *      positions.
 */
declare function parseCircuit(text: string): CircuitAST;

declare function lintCircuit(text: string): SchematexDiagnostic[];

/**
 * Netlist DSL parser — SPICE-subset text → CircuitAST.
 *
 * Grammar (line-oriented, after stripping `circuit "name" netlist` header):
 *
 *   R1 vin vout 10k              ← 2-terminal passive
 *   C1 out 0 100n                ← `0` / `gnd` / `GND` → ground net
 *   V1 vin 0 5V                  ← voltage source
 *   D1 vout 0 value="1N4007"     ← diode
 *   Q1 c b e npn                 ← 3-terminal, explicit model
 *   M1 d g s nmos
 *   # comment
 *
 *  Pin ordering by prefix (SPICE conventions):
 *    R/C/L/F(fuse)  → [p1, p2]
 *    D              → [anode, cathode]
 *    V/I            → [plus, minus]
 *    Q              → [c, b, e]
 *    M/J            → [d, g, s]
 *    S (switch)     → [p1, p2]
 *    U (IC)         → custom via pins="vcc,gnd,out,..." attr
 *
 *  After the pin list, trailing tokens can be:
 *    - a bare value (e.g. "10k")  → value
 *    - a bare model name (e.g. "npn", "1N4007") → componentType override or value
 *    - key=value pairs (value=, label=, type=, ...)
 */

/**
 * Parse a netlist body (lines after `circuit "name" netlist` header).
 * Returns components + nets + pinMap.
 */
declare function parseNetlist(body: string, title?: string): CircuitAST;

declare function renderCircuit(ast: CircuitAST, config?: RenderConfig): string;

/**
 * Circuit schematic symbol library.
 *
 * Each symbol is defined in RIGHTWARD orientation (direction="right"):
 *   - `start` anchor at (0, 0) — where the previous component's end connects in
 *   - `end` anchor at (length, 0) — where the next component's start attaches
 *   - Other named anchors (plus/minus/out/base/collector/emitter/wiper/gate/…)
 *
 * When the component is placed with a different direction, the renderer applies
 * an SVG rotation transform around (0,0) and the layout rotates the anchor
 * coordinates accordingly.
 */

interface PinAnchor {
    x: number;
    y: number;
}

interface LaidOutComponent {
    component: CircuitComponent;
    /** World (SVG) coordinates of the component's origin (before rotation). */
    x: number;
    y: number;
    /** Rotation applied to the symbol, in degrees. */
    rotation: number;
    /** Mirror the native right-facing symbol horizontally (used for facing pairs). */
    mirrorX?: boolean;
    /** Length along direction — 0 for zero-length items (dots, labels). */
    length: number;
    /** Resolved anchors in world coordinates. */
    anchors: Record<string, PinAnchor>;
}
interface CircuitLayoutResult {
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
    items: LaidOutComponent[];
}
declare function layoutCircuit(ast: CircuitAST): CircuitLayoutResult;

/**
 * Auto-layout engine for netlist-mode circuits.
 *
 * Strategy (lightweight Sugiyama-ish, no external deps):
 *
 *   1. Classify components by role:
 *        - POWER_TOP: voltage/current sources, battery (supply rails → top)
 *        - GROUND:    ground symbols (→ bottom)
 *        - MIDDLE:    everything else
 *
 *   2. Build adjacency between non-rail components via shared nets (power/
 *      ground nets ignored for this purpose — they'd make everything adjacent).
 *
 *   3. Rank (vertical Y layer) via BFS from power sources:
 *        rank 0 = power, rank K = ground, middle at 1..K-1 by topo distance.
 *
 *   4. Within each rank, order components by declaration order (stable).
 *      Orientation per component is chosen based on which pins connect up vs
 *      down vs sideways — defaults to horizontal.
 *
 *   5. Orthogonal routing: each net is drawn as a polyline via HVH (horizontal
 *      → vertical → horizontal) from each member pin to a common spine.
 *        - 2-pin nets: direct HVH between the two pin coords.
 *        - 3+ pin nets: find median Y, draw horizontal spine, each pin drops
 *          V to spine, then H to spine center. Junctions get dots.
 *
 *   6. Power rail and ground rail: drawn as full-width horizontal lines at the
 *      top/bottom edges of the component region.
 *
 * This is deliberately simple. Output is readable but not publication-grade.
 * Quality can improve by adding rank constraints, barycenter ordering, and a
 * proper grid A* router — but that's future work.
 */

interface RoutedWire {
    netId: string;
    /** Polyline points in world coords. */
    points: PinAnchor[];
    /** Junction dot positions (3+ pin nets have these). */
    junctions?: PinAnchor[];
}
interface AutoLayoutResult extends CircuitLayoutResult {
    routes: RoutedWire[];
}
declare function layoutCircuitNetlist(ast: CircuitAST): AutoLayoutResult;

declare const circuit: DiagramPlugin;

export { circuit, layoutCircuit, layoutCircuitNetlist, lintCircuit, parseCircuit, parseNetlist, renderCircuit };
