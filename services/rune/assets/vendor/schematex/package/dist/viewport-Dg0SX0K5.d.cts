/** Framework-independent viewport gestures and commands for rendered diagrams. */
interface ViewportState {
    /** Current zoom ratio. `1` is the rendered SVG's original CSS size. */
    scale: number;
    /** CSS-pixel translation applied to the host with transform-origin `0 0`. */
    x: number;
    y: number;
}
interface ViewportOptions {
    minScale?: number;
    maxScale?: number;
    /** Fit on attach. React integrations also fit after the diagram type changes. */
    initialFit?: "contain" | "none";
    /** Require Ctrl/Command for wheel zoom. Trackpad pinch reports Ctrl automatically. */
    wheelRequiresModifier?: boolean;
    /** Pan by dragging unclaimed canvas space. */
    pan?: boolean;
    /** Zoom and pan with two touch pointers. */
    pinch?: boolean;
    /** Zoom on an unclaimed double click. Disabled by default to protect label editing. */
    doubleClickZoom?: boolean;
}
interface ViewportController {
    zoomIn(step?: number): void;
    zoomOut(step?: number): void;
    /** `origin` is expressed in CSS pixels from the viewport frame's top-left corner. */
    zoomTo(scale: number, origin?: {
        x: number;
        y: number;
    }): void;
    panBy(dx: number, dy: number): void;
    fit(): void;
    reset(): void;
    getState(): ViewportState;
    setState(next: Partial<ViewportState>): void;
    /** Remove every listener/observer and restore the frame and host inline styles. */
    detach(): void;
}
/**
 * Attach a pan/zoom viewport to a frame and an inner transform host.
 *
 * The CSS transform intentionally lives outside the SVG. `getScreenCTM()`
 * therefore includes it, keeping diagram-editing coordinates correct.
 */
declare function attachViewport(frame: HTMLElement, host: HTMLElement, options?: ViewportOptions, onChange?: (state: ViewportState) => void): ViewportController;

export { type ViewportOptions as V, type ViewportState as a, type ViewportController as b, attachViewport as c };
