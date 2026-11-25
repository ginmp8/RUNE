import { c as DiagramType } from './types-Bgj27ejP.cjs';

type InteractiveTextCapability = "title" | "labels" | "structured-fields";
type InteractivePositionCapability = "none" | "free" | "move-x" | "move-y" | "cross-axis" | "native-x" | "native-y" | "native-xy";
interface InteractiveCapabilities {
    type: DiagramType;
    /** Empty for engines that have not shipped parser-native scene metadata yet. */
    text: readonly InteractiveTextCapability[];
    /** Human-facing summary; individual SceneItems remain the exact source of truth. */
    position: InteractivePositionCapability;
    /**
     * Standards/layout reason for a constrained or native position model.
     * This is canonical product data consumed by docs, playgrounds, and AI tools;
     * callers should not maintain their own explanation tables.
     */
    reason?: string;
}
/**
 * Canonical canvas-editing capability registry.
 *
 * Only parser-native engines appear here. Documentation, the website, and AI
 * tools consume this table so an engine cannot accidentally advertise canvas
 * editing before its parser and renderer produce deterministic source ranges.
 */
declare const INTERACTIVE_CAPABILITIES: {
    readonly genogram: InteractiveCapabilities;
    readonly timing: InteractiveCapabilities;
    readonly circuit: InteractiveCapabilities;
    readonly fishbone: InteractiveCapabilities;
    readonly flowchart: InteractiveCapabilities;
    readonly mindmap: InteractiveCapabilities;
    readonly orgchart: InteractiveCapabilities;
    readonly decisiontree: InteractiveCapabilities;
    readonly timeline: InteractiveCapabilities;
    readonly state: InteractiveCapabilities;
    readonly pid: InteractiveCapabilities;
    readonly erd: InteractiveCapabilities;
    readonly breadboard: InteractiveCapabilities;
    readonly fbd: InteractiveCapabilities;
    readonly sequence: InteractiveCapabilities;
    readonly petri: InteractiveCapabilities;
    readonly network: InteractiveCapabilities;
    readonly umlclass: InteractiveCapabilities;
    readonly floorplan: InteractiveCapabilities;
    readonly siteplan: InteractiveCapabilities;
};
declare function isInteractiveDiagramType(type: DiagramType): boolean;
declare function getInteractiveCapabilities(type: DiagramType): InteractiveCapabilities;
declare const INTERACTIVE_DIAGRAM_COUNT: number;
declare const POSITION_EDITABLE_DIAGRAM_COUNT: number;

export { INTERACTIVE_CAPABILITIES as I, POSITION_EDITABLE_DIAGRAM_COUNT as P, INTERACTIVE_DIAGRAM_COUNT as a, type InteractiveCapabilities as b, type InteractivePositionCapability as c, type InteractiveTextCapability as d, getInteractiveCapabilities as g, isInteractiveDiagramType as i };
