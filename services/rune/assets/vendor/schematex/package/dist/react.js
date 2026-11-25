"use client";
import { attachInteraction, attachViewport } from './chunk-2K7FEUYQ.js';
import { renderResult } from './chunk-S5SCBZQA.js';
import './chunk-HHD67KEI.js';
import './chunk-LVOQHHOY.js';
import './chunk-IIB6MJVI.js';
import './chunk-UCXYF6LN.js';
import './chunk-2KX4J7KX.js';
import './chunk-R6GGQWDH.js';
import './chunk-5IJDNJUJ.js';
import './chunk-K2L56KX2.js';
import './chunk-OASHF7KX.js';
import './chunk-227KJGLB.js';
import { sourceRevision } from './chunk-NRSOPIUR.js';
import './chunk-XWMX2GWP.js';
import './chunk-FKNZ3DJB.js';
import './chunk-6HBNH3AK.js';
import './chunk-BTVWLNZ5.js';
import './chunk-YC56U42M.js';
import './chunk-QLXTXIFY.js';
import './chunk-S5MF733M.js';
import './chunk-IC64LCKF.js';
import './chunk-AVFHQLGW.js';
import './chunk-KO55AXPI.js';
import './chunk-QDQTH6HV.js';
import './chunk-PIV2A3HG.js';
import './chunk-ISQCUPQR.js';
import './chunk-ZUMTE4E7.js';
import { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { jsx, jsxs } from 'react/jsx-runtime';

function renderError(result) {
  return result.ok ? null : new Error(result.diagnostics[0]?.message ?? "Schematex render failed");
}
function setReactRef(ref, value) {
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  if (ref) ref.current = value;
}
function useDiagramViewport({
  viewport,
  onViewportChange,
  viewportRef,
  frameRef,
  hostRef,
  structuralKey,
  contentKey,
  onInternalChange
}) {
  const enabled = viewport !== void 0 && viewport !== false;
  const options = typeof viewport === "object" ? viewport : {};
  const {
    minScale,
    maxScale,
    initialFit,
    wheelRequiresModifier,
    pan,
    pinch,
    doubleClickZoom
  } = options;
  const controllerRef = useRef(null);
  const changeRef = useRef(onViewportChange);
  const internalChangeRef = useRef(onInternalChange);
  const fittedStructuralKeyRef = useRef(structuralKey);
  changeRef.current = onViewportChange;
  internalChangeRef.current = onInternalChange;
  useEffect(() => {
    if (!enabled || !frameRef.current || !hostRef.current) {
      setReactRef(viewportRef, null);
      return;
    }
    const controller = attachViewport(
      frameRef.current,
      hostRef.current,
      {
        minScale,
        maxScale,
        initialFit,
        wheelRequiresModifier,
        pan,
        pinch,
        doubleClickZoom
      },
      (state) => {
        internalChangeRef.current?.(state);
        changeRef.current?.(state);
      }
    );
    controllerRef.current = controller;
    fittedStructuralKeyRef.current = structuralKey;
    setReactRef(viewportRef, controller);
    return () => {
      controller.detach();
      controllerRef.current = null;
      setReactRef(viewportRef, null);
    };
  }, [
    doubleClickZoom,
    enabled,
    frameRef,
    hostRef,
    initialFit,
    maxScale,
    minScale,
    pan,
    pinch,
    structuralKey,
    viewportRef,
    wheelRequiresModifier
  ]);
  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    if (fittedStructuralKeyRef.current !== structuralKey) {
      fittedStructuralKeyRef.current = structuralKey;
      if ((initialFit ?? "contain") === "contain") controller.fit();
      return;
    }
    controller.setState({});
  }, [contentKey, initialFit, structuralKey]);
  return enabled;
}
function SchematexDiagram({
  dsl,
  type,
  theme,
  fontFamily,
  padding,
  className,
  style,
  viewport,
  onViewportChange,
  viewportRef,
  onError
}) {
  const frameRef = useRef(null);
  const hostRef = useRef(null);
  const result = useMemo(
    () => renderResult(dsl, { type, theme, fontFamily, padding }),
    [dsl, type, theme, fontFamily, padding]
  );
  const viewportEnabled = useDiagramViewport({
    viewport,
    onViewportChange,
    viewportRef,
    frameRef,
    hostRef,
    structuralKey: result.type ?? type ?? "",
    contentKey: result.svg
  });
  useEffect(() => {
    const error = renderError(result);
    if (error) onError?.(error);
  }, [onError, result]);
  if (viewportEnabled) {
    return /* @__PURE__ */ jsx(
      "div",
      {
        ref: frameRef,
        className,
        style,
        "data-schematex-viewport": "true",
        children: /* @__PURE__ */ jsx(
          "div",
          {
            ref: hostRef,
            "data-schematex-viewport-host": "true",
            dangerouslySetInnerHTML: { __html: result.svg }
          }
        )
      }
    );
  }
  return /* @__PURE__ */ jsx(
    "div",
    {
      className,
      style,
      dangerouslySetInnerHTML: { __html: result.svg }
    }
  );
}
function measureDraftWidth(anchor, draft) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return Math.max(anchor.rect.width, draft.length * anchor.fontSize * 0.62);
  context.font = `${anchor.fontStyle} ${anchor.fontWeight} ${anchor.fontSize}px ${anchor.fontFamily}`;
  let width = context.measureText(draft || " ").width;
  const letterSpacing = Number.parseFloat(anchor.letterSpacing);
  if (Number.isFinite(letterSpacing) && draft.length > 1) {
    width += letterSpacing * (draft.length - 1);
  }
  return width;
}
function defaultLabelEditorStyle(state) {
  const { anchor, draftWidth } = state;
  const width = Math.max(
    28,
    Math.min(window.innerWidth - 16, Math.max(anchor.rect.width, draftWidth) + 12)
  );
  const height = Math.max(22, anchor.rect.height + 6);
  return {
    position: "fixed",
    zIndex: 1e3,
    boxSizing: "border-box",
    left: Math.max(
      8,
      Math.min(anchor.rect.left + anchor.rect.width / 2 - width / 2, window.innerWidth - width - 8)
    ),
    top: Math.max(
      8,
      Math.min(anchor.rect.top + anchor.rect.height / 2 - height / 2, window.innerHeight - height - 8)
    ),
    width,
    height,
    margin: 0,
    padding: "0 5px",
    border: "1px solid var(--schematex-editor-accent, #2457f5)",
    borderRadius: 4,
    outline: "2px solid color-mix(in srgb, var(--schematex-editor-accent, #2457f5) 18%, transparent)",
    outlineOffset: 0,
    background: "var(--schematex-editor-background, #ffffff)",
    color: anchor.color,
    fontFamily: anchor.fontFamily,
    fontSize: anchor.fontSize,
    fontWeight: anchor.fontWeight,
    fontStyle: anchor.fontStyle,
    letterSpacing: anchor.letterSpacing,
    lineHeight: 1,
    textAlign: "center",
    appearance: "none"
  };
}
var INTERACTIVE_STYLES = `
.schematex-interactive-editor .sx-interactive-movable {
  cursor: grab;
  touch-action: none;
  user-select: none;
}
.schematex-interactive-editor [data-sx-interactive-position='move-x'] { cursor: ew-resize; }
.schematex-interactive-editor [data-sx-interactive-position='move-y'] { cursor: ns-resize; }
.schematex-interactive-editor [data-sx-role='label'] { cursor: text; }
.schematex-interactive-editor [data-sx-key],
.schematex-interactive-editor [data-sx-owner] {
  transition: filter .12s ease, opacity .12s ease;
}
.schematex-interactive-editor .sx-interactive-selected:not([data-sx-role='label']) {
  filter:
    drop-shadow(0 0 1px var(--schematex-editor-accent, #2457f5))
    drop-shadow(0 0 1px var(--schematex-editor-accent, #2457f5));
}
.schematex-interactive-editor .sx-interactive-selected[data-sx-role='label'] {
  fill: var(--schematex-editor-accent, #2457f5) !important;
  font-weight: 600;
}
.schematex-interactive-editor [data-sx-dragging='true'] { cursor: grabbing; opacity: .82; }
.schematex-interactive-editor .sx-label-editing { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .schematex-interactive-editor * {
    scroll-behavior: auto !important;
    transition-duration: 0s !important;
  }
}
`;
function InteractiveSchematexDiagram({
  value,
  onChange,
  type,
  theme,
  fontFamily,
  padding,
  readOnly = false,
  debounceMs = 0,
  className,
  canvasClassName,
  style,
  viewport,
  onViewportChange,
  viewportRef,
  ariaLabel = "Editable Schematex diagram",
  labelEditorClassName = "sx-label-editor",
  labelEditorStyle,
  selectedKey,
  onSelect,
  onPreviewChange,
  onRender,
  onError
}) {
  const frameRef = useRef(null);
  const hostRef = useRef(null);
  const sourceRef = useRef(value);
  const selectedRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const onSelectRef = useRef(onSelect);
  const onPreviewChangeRef = useRef(onPreviewChange);
  const cancelLabelEditRef = useRef(null);
  const syncLabelAnchorRef = useRef(null);
  const [renderSource, setRenderSource] = useState(value);
  const [labelEditor, setLabelEditor] = useState(null);
  sourceRef.current = value;
  onChangeRef.current = onChange;
  onSelectRef.current = onSelect;
  onPreviewChangeRef.current = onPreviewChange;
  const hasPreviewHandler = onPreviewChange !== void 0;
  useEffect(() => {
    cancelLabelEditRef.current?.();
  }, [fontFamily, padding, readOnly, theme, type, value]);
  useEffect(() => {
    if (debounceMs <= 0) {
      setRenderSource(value);
      return;
    }
    const timer = window.setTimeout(() => setRenderSource(value), debounceMs);
    return () => window.clearTimeout(timer);
  }, [debounceMs, value]);
  const result = useMemo(
    () => renderResult(renderSource, { type, theme, fontFamily, padding, scene: !readOnly }),
    [fontFamily, padding, readOnly, renderSource, theme, type]
  );
  const scene = result.ok ? result.scene ?? [] : [];
  const revision = useMemo(() => sourceRevision(renderSource), [renderSource]);
  const viewportEnabled = useDiagramViewport({
    viewport,
    onViewportChange,
    viewportRef,
    frameRef,
    hostRef,
    structuralKey: result.type ?? type ?? "",
    contentKey: result.svg,
    onInternalChange: () => syncLabelAnchorRef.current?.()
  });
  useEffect(() => {
    onRender?.(result);
    const error = renderError(result);
    if (error) onError?.(error);
  }, [onError, onRender, result]);
  const selectItem = useCallback((item) => {
    selectedRef.current = item;
    onSelectRef.current?.(item);
  }, []);
  useEffect(() => {
    if (readOnly || !result.ok || scene.length === 0) return;
    const svg = hostRef.current?.querySelector("svg");
    if (!svg) return;
    const detach = attachInteraction(svg, {
      getSource: () => sourceRef.current,
      getScene: () => ({ rev: revision, items: scene }),
      onSelect: selectItem,
      onRequestLabelEdit: (item, anchor, commit, cancel) => {
        cancelLabelEditRef.current = cancel;
        setLabelEditor({
          item,
          anchor,
          draft: item.label ?? "",
          draftWidth: anchor.rect.width,
          commit,
          cancel
        });
      },
      onLabelEditEnd: () => {
        cancelLabelEditRef.current = null;
        setLabelEditor(null);
      },
      onSourceChange: (source, reason) => {
        onChangeRef.current(source, { reason, item: selectedRef.current });
        setLabelEditor(null);
      },
      onSourcePreview: hasPreviewHandler ? (source, reason) => onPreviewChangeRef.current?.(source, { reason, item: selectedRef.current }) : void 0
    });
    return detach;
  }, [hasPreviewHandler, readOnly, result.ok, revision, scene, selectItem]);
  useEffect(() => {
    if (selectedKey === void 0) return;
    const svg = hostRef.current?.querySelector("svg");
    if (!svg) return;
    svg.querySelectorAll("[data-sx-key]").forEach((element) => {
      element.classList.toggle(
        "sx-interactive-selected",
        selectedKey !== null && element.getAttribute("data-sx-key") === selectedKey
      );
    });
    selectedRef.current = selectedKey ? scene.find((item) => item.key === selectedKey) ?? null : null;
  }, [result.svg, scene, selectedKey]);
  useEffect(() => {
    const key = labelEditor?.item.key;
    const measureRect = labelEditor?.anchor.measureRect;
    const remeasure = labelEditor?.anchor.remeasure;
    if (!key || !measureRect) return;
    let frame = 0;
    const syncAnchor = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setLabelEditor((current) => {
          if (!current || current.item.key !== key) return current;
          const anchor = remeasure?.() ?? {
            ...current.anchor,
            rect: measureRect()
          };
          const previous = current.anchor;
          return previous.rect.left === anchor.rect.left && previous.rect.top === anchor.rect.top && previous.rect.width === anchor.rect.width && previous.rect.height === anchor.rect.height && previous.fontSize === anchor.fontSize && previous.fontFamily === anchor.fontFamily && previous.fontWeight === anchor.fontWeight && previous.fontStyle === anchor.fontStyle && previous.letterSpacing === anchor.letterSpacing && previous.color === anchor.color ? current : {
            ...current,
            anchor,
            draftWidth: measureDraftWidth(anchor, current.draft)
          };
        });
      });
    };
    syncAnchor();
    syncLabelAnchorRef.current = syncAnchor;
    window.addEventListener("resize", syncAnchor);
    window.addEventListener("scroll", syncAnchor, true);
    return () => {
      if (syncLabelAnchorRef.current === syncAnchor) syncLabelAnchorRef.current = null;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", syncAnchor);
      window.removeEventListener("scroll", syncAnchor, true);
    };
  }, [labelEditor?.anchor.measureRect, labelEditor?.anchor.remeasure, labelEditor?.item.key]);
  const overlay = labelEditor && typeof document !== "undefined" ? createPortal(
    /* @__PURE__ */ jsx(
      "input",
      {
        className: labelEditorClassName,
        style: { ...defaultLabelEditorStyle(labelEditor), ...labelEditorStyle },
        "aria-label": `Edit ${labelEditor.item.label ?? "diagram label"}`,
        autoFocus: true,
        value: labelEditor.draft,
        onChange: (event) => {
          const draft = event.currentTarget.value;
          setLabelEditor((current) => current ? { ...current, draft, draftWidth: measureDraftWidth(current.anchor, draft) } : current);
        },
        onFocus: (event) => event.currentTarget.select(),
        onBlur: (event) => {
          labelEditor.commit(event.currentTarget.value);
          setLabelEditor(null);
        },
        onKeyDown: (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          } else if (event.key === "Escape") {
            event.preventDefault();
            labelEditor.cancel();
            setLabelEditor(null);
          }
        }
      },
      labelEditor.item.key
    ),
    document.body
  ) : null;
  const svgHost = useMemo(() => /* @__PURE__ */ jsx(
    "div",
    {
      ref: hostRef,
      className: canvasClassName,
      "data-schematex-viewport-host": viewportEnabled ? "true" : void 0,
      dangerouslySetInnerHTML: { __html: result.svg }
    }
  ), [canvasClassName, result.svg, viewportEnabled]);
  return /* @__PURE__ */ jsxs(
    "div",
    {
      ref: frameRef,
      className: `schematex-interactive-editor ${className ?? ""}`.trim(),
      style,
      role: "region",
      "aria-label": ariaLabel,
      tabIndex: 0,
      "data-schematex-editor": "true",
      "data-schematex-viewport": viewportEnabled ? "true" : void 0,
      children: [
        /* @__PURE__ */ jsx("style", { children: INTERACTIVE_STYLES }),
        svgHost,
        overlay
      ]
    }
  );
}

export { InteractiveSchematexDiagram, SchematexDiagram };
//# sourceMappingURL=react.js.map
//# sourceMappingURL=react.js.map