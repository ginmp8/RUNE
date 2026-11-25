export { S as SchematexConfig, p as parse, a as parseResult, r as render, b as renderPreview, c as renderResult } from './api-Dhy5_P92.cjs';
import { S as SceneItem, a as SourceRange, b as SchematexDiagnostic, D as DiagramPlugin, c as DiagramType } from './types-Bgj27ejP.cjs';
export { d as SchematexParseResult, e as SchematexRenderResult, f as SchematexResultStatus } from './types-Bgj27ejP.cjs';
export { I as INTERACTIVE_CAPABILITIES, a as INTERACTIVE_DIAGRAM_COUNT, b as InteractiveCapabilities, c as InteractivePositionCapability, d as InteractiveTextCapability, P as POSITION_EDITABLE_DIAGRAM_COUNT, g as getInteractiveCapabilities, i as isInteractiveDiagramType } from './interactive-capabilities-DAyGfS69.cjs';
export { genogram } from './diagrams/genogram/index.cjs';
export { ecomap } from './diagrams/ecomap/index.cjs';
export { pedigree } from './diagrams/pedigree/index.cjs';
export { phylo } from './diagrams/phylo/index.cjs';
export { sociogram } from './diagrams/sociogram/index.cjs';
export { timing } from './diagrams/timing/index.cjs';
export { logic } from './diagrams/logic/index.cjs';
export { circuit } from './diagrams/circuit/index.cjs';
export { blockdiagram } from './diagrams/blockdiagram/index.cjs';
export { ladder } from './diagrams/ladder/index.cjs';
export { sld } from './diagrams/sld/index.cjs';
export { entity } from './diagrams/entity/index.cjs';
export { fishbone } from './diagrams/fishbone/index.cjs';
export { venn } from './diagrams/venn/index.cjs';
export { B as BASE_THEMES, a as BIOLOGY_TOKENS, b as BaseTheme, c as BiologyTokens, N as NETWORK_TOKENS, d as NetworkTokens, P as PERSON_TOKENS, e as PETRI_TOKENS, f as PersonTokens, g as PetriTokens, R as ResolvedTheme, T as ThemeName, h as TimelineTokens, V as VENN_TOKENS, i as VennTokens, j as flowchart, r as resolveBaseTheme, k as resolveBiologyTheme, l as resolveFishboneTheme, m as resolveGenogramTheme, n as resolveNetworkTheme, o as resolvePersonTheme, p as resolvePetriTheme, q as resolveTimelineTheme, s as resolveVennTheme } from './index-DmRIW1WR.cjs';
export { orgchart } from './diagrams/orgchart/index.cjs';
export { siteplan } from './diagrams/siteplan/index.cjs';

type PositionEditMode = SceneItem["editable"]["position"];
type SceneEditTarget = SceneItem | {
    sourceRange: SourceRange;
    expectedText: string;
    sourceRevision: number;
} | {
    key: string;
    scene: SceneItem[];
};
interface SourceEditResult {
    source: string;
    diagnostics: SchematexDiagnostic[];
}
/** Deterministically replace one parser-produced label range. */
declare function setLabel(source: string, target: SceneEditTarget, newText: string): SourceEditResult;
/** Write or update one delta-only pin in the explicit @overrides block. */
declare function setPosition(source: string, target: SceneEditTarget, pos: {
    x: number;
    y: number;
}): SourceEditResult;
declare function stripPins(source: string): SourceEditResult & {
    block: string;
};
declare function reattachPins(source: string, block: string): SourceEditResult;
declare function prunePins(source: string, scene: SceneItem[]): SourceEditResult;
/** Apply authored bbox-top-left pins without coupling core to one layout type. */
declare function applyPins<T extends {
    x: number;
    y: number;
}>(items: T[], pins: Map<string, {
    x: number;
    y: number;
}> | undefined, options: {
    id: (item: T) => string;
    position: (item: T) => PositionEditMode;
}): void;

declare const decisiontree: DiagramPlugin;

declare const timeline: DiagramPlugin;

declare const state: DiagramPlugin;

declare const pid: DiagramPlugin;

declare const prisma: DiagramPlugin;

declare const usecase: DiagramPlugin;

declare const pert: DiagramPlugin;

declare const sequence: DiagramPlugin;

declare const petri: DiagramPlugin;

declare const network: DiagramPlugin;

declare const umlclass: DiagramPlugin;

declare const faulttree: DiagramPlugin;

declare const bowtie: DiagramPlugin;

declare const eventtree: DiagramPlugin;

declare const fmea: DiagramPlugin;

declare const causalloop: DiagramPlugin;

declare const markov: DiagramPlugin;

/**
 * Git commit-graph (gitgraph) plugin entry.
 * Per docs/reference/43-GIT-GRAPH-STANDARD.md.
 *
 * Mermaid-`gitGraph`-compatible: `detect` matches the Mermaid headers `gitGraph`
 * and `gitGraph:` (case-insensitive) as well as `gitgraph`, so LLM-generated
 * gitGraph blocks route here unchanged.
 *
 * The `"gitgraph"` type is not (yet) a member of the shared `DiagramType` union;
 * this folder-isolated plugin casts at the boundary so no shared file is edited.
 */

declare const gitgraph: DiagramPlugin;

declare const epc: DiagramPlugin;

declare const idef0: DiagramPlugin;

declare const threatmodel: DiagramPlugin;

declare const welding: DiagramPlugin;

declare const rbd: DiagramPlugin;

declare const comparison: DiagramPlugin;

declare const floorplan: DiagramPlugin;

declare const playbook: DiagramPlugin;

/**
 * Domain symbol catalogs — the real symbols an engine uses *inside* a diagram
 * (circuit components, SLD apparatus, P&ID equipment, flowchart node icons),
 * each rendered standalone for the /icons showcase. This is distinct from the
 * per-type representative glyph (assets/icons/*.svg).
 *
 * Each entry's `svg` is a complete, self-styled <svg> so consumers can drop it
 * straight into the page.
 */

interface SymbolCatalogEntry {
    id: string;
    label: string;
    svg: string;
}
interface SymbolCatalog {
    type: DiagramType;
    /** Human label for the catalog section, e.g. "Circuit components". */
    label: string;
    /** Short description of what the symbols are. */
    note: string;
    entries: SymbolCatalogEntry[];
}
/** Diagram types that ship a renderable domain symbol catalog. */
declare const SYMBOL_CATALOG_TYPES: DiagramType[];
declare function getSymbolCatalog(type: string): SymbolCatalog | null;

export { SYMBOL_CATALOG_TYPES, type SceneEditTarget, SceneItem, SchematexDiagnostic, type SourceEditResult, SourceRange, type SymbolCatalog, type SymbolCatalogEntry, applyPins, bowtie, causalloop, comparison, decisiontree, epc, eventtree, faulttree, floorplan, fmea, getSymbolCatalog, gitgraph, idef0, markov, network, pert, petri, pid, playbook, prisma, prunePins, rbd, reattachPins, sequence, setLabel, setPosition, state, stripPins, threatmodel, timeline, umlclass, usecase, welding };
