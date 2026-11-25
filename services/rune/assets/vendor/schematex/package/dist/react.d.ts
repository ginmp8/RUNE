import * as react_jsx_runtime from 'react/jsx-runtime';
import { CSSProperties, Ref } from 'react';
import { S as SchematexConfig } from './api-D_Lu9-oC.js';
import { S as SceneItem, e as SchematexRenderResult } from './types-Bgj27ejP.js';
import { V as ViewportOptions, a as ViewportState, b as ViewportController } from './viewport-Dg0SX0K5.js';

interface SchematexDiagramProps {
    /** DSL text to render. */
    dsl: string;
    /** Diagram type override; auto-detected when omitted. */
    type?: SchematexConfig["type"];
    theme?: string;
    fontFamily?: string;
    padding?: number;
    className?: string;
    style?: CSSProperties;
    /** Opt-in host-layer pan, zoom, and fit-to-view. */
    viewport?: boolean | ViewportOptions;
    onViewportChange?: (state: ViewportState) => void;
    viewportRef?: Ref<ViewportController>;
    /** Called after a strict parser/layout failure; the diagnostic SVG still renders. */
    onError?: (error: Error) => void;
}
/** Small read-only renderer; use InteractiveSchematexDiagram for canvas editing. */
declare function SchematexDiagram({ dsl, type, theme, fontFamily, padding, className, style, viewport, onViewportChange, viewportRef, onError, }: SchematexDiagramProps): react_jsx_runtime.JSX.Element;
interface InteractiveEditDetail {
    reason: "label" | "position";
    item: SceneItem | null;
}
interface InteractiveSchematexDiagramProps {
    /** Controlled DSL source. Every canvas edit is returned through onChange. */
    value: string;
    onChange: (value: string, detail: InteractiveEditDetail) => void;
    type?: SchematexConfig["type"];
    theme?: string;
    fontFamily?: string;
    padding?: number;
    readOnly?: boolean;
    /** Delay expensive re-renders while a source editor is typing. Direct canvas edits remain guarded against stale scenes. */
    debounceMs?: number;
    className?: string;
    /** Class applied to the inner canvas host div that contains the generated SVG. */
    canvasClassName?: string;
    style?: CSSProperties;
    /** Opt-in host-layer pan, zoom, and fit-to-view. */
    viewport?: boolean | ViewportOptions;
    onViewportChange?: (state: ViewportState) => void;
    viewportRef?: Ref<ViewportController>;
    ariaLabel?: string;
    labelEditorClassName?: string;
    labelEditorStyle?: CSSProperties;
    /** Controlled scene key selected by an external source editor. */
    selectedKey?: string | null;
    onSelect?: (item: SceneItem | null) => void;
    /** Transient drag source for live code previews; `null` discards a cancelled preview. */
    onPreviewChange?: (value: string | null, detail: InteractiveEditDetail) => void;
    onRender?: (result: SchematexRenderResult) => void;
    onError?: (error: Error) => void;
}
/**
 * Controlled, framework-light diagram editor.
 *
 * It owns SVG gestures and the WYSIWYG label input while the caller owns DSL
 * state, persistence, undo, collaboration, and any source-code editor.
 */
declare function InteractiveSchematexDiagram({ value, onChange, type, theme, fontFamily, padding, readOnly, debounceMs, className, canvasClassName, style, viewport, onViewportChange, viewportRef, ariaLabel, labelEditorClassName, labelEditorStyle, selectedKey, onSelect, onPreviewChange, onRender, onError, }: InteractiveSchematexDiagramProps): react_jsx_runtime.JSX.Element;

export { type InteractiveEditDetail, InteractiveSchematexDiagram, type InteractiveSchematexDiagramProps, SchematexDiagram, type SchematexDiagramProps };
