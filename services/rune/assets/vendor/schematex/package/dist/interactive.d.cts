import { S as SceneItem } from './types-Bgj27ejP.cjs';
export { b as ViewportController, V as ViewportOptions, a as ViewportState, c as attachViewport } from './viewport-Dg0SX0K5.cjs';

/** Stable, inexpensive revision for matching derived scene data to exact source. */
declare function sourceRevision(source: string): number;

interface InteractionScene {
    /** Use sourceRevision(source) so stale preview/source pairs are rejected. */
    rev: number;
    items: SceneItem[];
}
interface LabelEditAnchor {
    /** Screen-space glyph bounds, including CSS zoom and responsive SVG scaling. */
    rect: DOMRect;
    /** Re-measure after scrolling or viewport changes so a fixed editor stays over the glyph. */
    measureRect?: () => DOMRect;
    /** Re-measure both screen-space geometry and typography after a viewport transform. */
    remeasure?: () => LabelEditAnchor;
    fontFamily: string;
    fontSize: number;
    fontWeight: string;
    fontStyle: string;
    letterSpacing: string;
    color: string;
}
interface InteractionOptions {
    getSource: () => string;
    getScene: () => InteractionScene;
    onSelect?: (item: SceneItem | null) => void;
    onRequestLabelEdit?: (item: SceneItem, anchor: LabelEditAnchor, commit: (text: string) => void, cancel: () => void) => void;
    /** Called whenever an active label editor commits, cancels, or is detached. */
    onLabelEditEnd?: () => void;
    /**
     * Transient, revision-guarded position source produced during a drag.
     * The host may display it without rerendering the controlled SVG. `null`
     * means the gesture was cancelled and the preview should be discarded.
     */
    onSourcePreview?: (newSource: string | null, reason: "position") => void;
    onSourceChange: (newSource: string, reason: "label" | "position") => void;
}
/**
 * Attach target detection and editing gestures to one rendered SVG.
 * The host owns form UI, rerendering, and styling; this layer owns gestures,
 * CTM coordinate conversion, stale protection, and deterministic DSL edits.
 */
declare function attachInteraction(svg: SVGSVGElement, options: InteractionOptions): () => void;

export { type InteractionOptions, type InteractionScene, type LabelEditAnchor, attachInteraction, sourceRevision };
