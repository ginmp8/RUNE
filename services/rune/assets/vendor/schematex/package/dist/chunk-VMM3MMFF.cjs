'use strict';

var chunkNTS45SH6_cjs = require('./chunk-NTS45SH6.cjs');

// src/core/screen-point.ts
function pointInSvg(svg, clientX, clientY) {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const mapped = point.matrixTransform(matrix.inverse());
  return { x: mapped.x, y: mapped.y };
}

// src/viewport.ts
var DEFAULT_MIN_SCALE = 0.1;
var DEFAULT_MAX_SCALE = 10;
var DEFAULT_ZOOM_STEP = 0.2;
var PAN_THRESHOLD = 3;
function finitePositive(value, fallback) {
  return value !== void 0 && Number.isFinite(value) && value > 0 ? value : fallback;
}
function normalizeOptions(options) {
  const minScale = finitePositive(options.minScale, DEFAULT_MIN_SCALE);
  const maxScale = Math.max(
    minScale,
    finitePositive(options.maxScale, DEFAULT_MAX_SCALE)
  );
  return {
    minScale,
    maxScale,
    initialFit: options.initialFit ?? "contain",
    wheelRequiresModifier: options.wheelRequiresModifier ?? true,
    pan: options.pan ?? true,
    pinch: options.pinch ?? true,
    doubleClickZoom: options.doubleClickZoom ?? false
  };
}
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function sameState(a, b) {
  return a.scale === b.scale && a.x === b.x && a.y === b.y;
}
function localPoint(frame, clientX, clientY) {
  const rect = frame.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}
function svgFallbackSize(svg) {
  if (!svg) return { width: 0, height: 0 };
  const viewBox = svg.viewBox?.baseVal;
  const widthAttribute = Number.parseFloat(svg.getAttribute("width") ?? "");
  const heightAttribute = Number.parseFloat(svg.getAttribute("height") ?? "");
  return {
    width: viewBox?.width || (Number.isFinite(widthAttribute) ? widthAttribute : 0),
    height: viewBox?.height || (Number.isFinite(heightAttribute) ? heightAttribute : 0)
  };
}
function measureViewport(frame, host) {
  const transformed = host.style.transform;
  host.style.transform = "none";
  const frameRect = frame.getBoundingClientRect();
  const hostRect = host.getBoundingClientRect();
  const svg = host.querySelector("svg");
  const contentRect = svg?.getBoundingClientRect() ?? hostRect;
  const fallback = svgFallbackSize(svg);
  host.style.transform = transformed;
  const frameWidth = frame.clientWidth || frameRect.width;
  const frameHeight = frame.clientHeight || frameRect.height;
  const contentWidth = contentRect.width || fallback.width || host.scrollWidth || hostRect.width;
  const contentHeight = contentRect.height || fallback.height || host.scrollHeight || hostRect.height;
  if (frameWidth <= 0 || frameHeight <= 0 || contentWidth <= 0 || contentHeight <= 0) {
    return null;
  }
  return {
    frameWidth,
    frameHeight,
    hostX: hostRect.left - frameRect.left,
    hostY: hostRect.top - frameRect.top,
    contentX: contentRect.left - hostRect.left,
    contentY: contentRect.top - hostRect.top,
    contentWidth,
    contentHeight
  };
}
function clampTranslation(state, metrics) {
  if (!metrics) return state;
  const scaledWidth = metrics.contentWidth * state.scale;
  const scaledHeight = metrics.contentHeight * state.scale;
  const currentLeft = metrics.hostX + state.x + metrics.contentX * state.scale;
  const currentTop = metrics.hostY + state.y + metrics.contentY * state.scale;
  const left = scaledWidth <= metrics.frameWidth ? (metrics.frameWidth - scaledWidth) / 2 : clamp(currentLeft, metrics.frameWidth - scaledWidth, 0);
  const top = scaledHeight <= metrics.frameHeight ? (metrics.frameHeight - scaledHeight) / 2 : clamp(currentTop, metrics.frameHeight - scaledHeight, 0);
  return {
    scale: state.scale,
    x: left - metrics.hostX - metrics.contentX * state.scale,
    y: top - metrics.hostY - metrics.contentY * state.scale
  };
}
function contentCenteredState(scale, metrics) {
  return {
    scale,
    x: (metrics.frameWidth - metrics.contentWidth * scale) / 2 - metrics.hostX - metrics.contentX * scale,
    y: (metrics.frameHeight - metrics.contentHeight * scale) / 2 - metrics.hostY - metrics.contentY * scale
  };
}
function cancelClaimedInteractionDrag(host, pointerId) {
  const svg = host.querySelector("svg");
  if (!svg) return;
  const view = svg.ownerDocument?.defaultView;
  const PointerEventConstructor = view?.PointerEvent;
  let event;
  if (PointerEventConstructor) {
    event = new PointerEventConstructor("pointercancel", { pointerId });
  } else {
    event = new Event("pointercancel");
    Object.defineProperty(event, "pointerId", { value: pointerId });
  }
  svg.dispatchEvent(event);
}
function attachViewport(frame, host, options = {}, onChange) {
  const settings = normalizeOptions(options);
  const previousFramePosition = frame.style.position;
  const previousFrameOverflow = frame.style.overflow;
  const previousFrameTouchAction = frame.style.touchAction;
  const previousHostTransform = host.style.transform;
  const previousHostTransformOrigin = host.style.transformOrigin;
  let state = { scale: 1, x: 0, y: 0 };
  let metrics = null;
  let detached = false;
  let panGesture = null;
  let pinchGesture = null;
  let hasSuccessfulFit = false;
  let suppressPanClick = false;
  const activePointers = /* @__PURE__ */ new Map();
  const computedFramePosition = frame.ownerDocument?.defaultView?.getComputedStyle?.(frame).position;
  if (computedFramePosition === "static" || computedFramePosition === void 0 && frame.style.position === "") {
    frame.style.position = "relative";
  }
  frame.style.overflow = "hidden";
  frame.style.touchAction = "none";
  host.style.transformOrigin = "0 0";
  const refreshMetrics = () => {
    metrics = measureViewport(frame, host);
    return metrics;
  };
  const renderState = (next, { clampPosition = true, notify = true } = {}) => {
    if (detached) return;
    const boundedScale = clamp(next.scale, settings.minScale, settings.maxScale);
    const bounded = clampPosition ? clampTranslation({ ...next, scale: boundedScale }, metrics) : { ...next, scale: boundedScale };
    const changed = !sameState(state, bounded);
    state = bounded;
    host.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
    if (notify && changed) onChange?.({ ...state });
  };
  const frameCenter = () => {
    const rect = frame.getBoundingClientRect();
    return {
      x: (frame.clientWidth || rect.width) / 2,
      y: (frame.clientHeight || rect.height) / 2
    };
  };
  const zoomTo = (nextScale, origin = frameCenter()) => {
    if (detached || !Number.isFinite(nextScale)) return;
    const scale = clamp(nextScale, settings.minScale, settings.maxScale);
    const ratio = scale / state.scale;
    renderState({
      scale,
      x: origin.x - (origin.x - state.x) * ratio,
      y: origin.y - (origin.y - state.y) * ratio
    });
  };
  const fit = () => {
    const measured = refreshMetrics();
    if (!measured) return;
    hasSuccessfulFit = true;
    const scale = clamp(
      Math.min(
        measured.frameWidth / measured.contentWidth,
        measured.frameHeight / measured.contentHeight
      ),
      settings.minScale,
      settings.maxScale
    );
    renderState(contentCenteredState(scale, measured), { clampPosition: false });
  };
  const reset = () => {
    const measured = refreshMetrics();
    if (!measured) {
      renderState({ scale: 1, x: 0, y: 0 }, { clampPosition: false });
      return;
    }
    renderState(contentCenteredState(1, measured), { clampPosition: false });
  };
  const beginPinch = () => {
    if (!settings.pinch || activePointers.size < 2) return;
    const entries = Array.from(activePointers.entries()).slice(0, 2);
    const first = entries[0];
    const second = entries[1];
    if (!first || !second) return;
    for (const [pointerId, pointer] of entries) {
      if (pointer.claimedByInteraction) cancelClaimedInteractionDrag(host, pointerId);
      try {
        frame.setPointerCapture(pointerId);
      } catch {
      }
    }
    panGesture = null;
    const midpoint = {
      x: (first[1].x + second[1].x) / 2,
      y: (first[1].y + second[1].y) / 2
    };
    pinchGesture = {
      pointerIds: [first[0], second[0]],
      midpoint,
      distance: Math.max(
        1,
        Math.hypot(first[1].x - second[1].x, first[1].y - second[1].y)
      ),
      state: { ...state }
    };
  };
  const onPointerDown = (event) => {
    suppressPanClick = false;
    if (event.button !== 0) return;
    const point = localPoint(frame, event.clientX, event.clientY);
    if (event.pointerType === "touch") {
      activePointers.set(event.pointerId, {
        ...point,
        claimedByInteraction: event.defaultPrevented
      });
      if (activePointers.size >= 2) {
        beginPinch();
        event.preventDefault();
        return;
      }
    }
    if (!settings.pan || event.defaultPrevented) return;
    panGesture = {
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      state: { ...state },
      moved: false
    };
  };
  const onPointerMove = (event) => {
    const point = localPoint(frame, event.clientX, event.clientY);
    const active = activePointers.get(event.pointerId);
    if (active) {
      active.x = point.x;
      active.y = point.y;
    }
    if (pinchGesture) {
      const first = activePointers.get(pinchGesture.pointerIds[0]);
      const second = activePointers.get(pinchGesture.pointerIds[1]);
      if (!first || !second) return;
      const midpoint = {
        x: (first.x + second.x) / 2,
        y: (first.y + second.y) / 2
      };
      const distance = Math.max(1, Math.hypot(first.x - second.x, first.y - second.y));
      const scale = clamp(
        pinchGesture.state.scale * (distance / pinchGesture.distance),
        settings.minScale,
        settings.maxScale
      );
      const ratio = scale / pinchGesture.state.scale;
      renderState({
        scale,
        x: midpoint.x - (pinchGesture.midpoint.x - pinchGesture.state.x) * ratio,
        y: midpoint.y - (pinchGesture.midpoint.y - pinchGesture.state.y) * ratio
      });
      event.preventDefault();
      return;
    }
    if (!panGesture || panGesture.pointerId !== event.pointerId) return;
    const dx = point.x - panGesture.startX;
    const dy = point.y - panGesture.startY;
    if (!panGesture.moved && Math.hypot(dx, dy) < PAN_THRESHOLD) return;
    if (!panGesture.moved) {
      panGesture.moved = true;
      suppressPanClick = true;
      try {
        frame.setPointerCapture(event.pointerId);
      } catch {
      }
    }
    renderState({
      ...panGesture.state,
      x: panGesture.state.x + dx,
      y: panGesture.state.y + dy
    });
    event.preventDefault();
  };
  const finishPointer = (event) => {
    activePointers.delete(event.pointerId);
    if (pinchGesture?.pointerIds.includes(event.pointerId)) {
      pinchGesture = null;
      panGesture = null;
    } else if (panGesture?.pointerId === event.pointerId) {
      panGesture = null;
    }
    try {
      frame.releasePointerCapture(event.pointerId);
    } catch {
    }
  };
  const onWheel = (event) => {
    if (settings.wheelRequiresModifier && !event.ctrlKey && !event.metaKey) {
      return;
    }
    const point = localPoint(frame, event.clientX, event.clientY);
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? frame.clientHeight || 800 : 1;
    zoomTo(state.scale * Math.exp(-event.deltaY * unit * 2e-3), point);
    event.preventDefault();
  };
  const onDoubleClick = (event) => {
    if (!settings.doubleClickZoom || event.defaultPrevented) return;
    zoomTo(
      state.scale + DEFAULT_ZOOM_STEP,
      localPoint(frame, event.clientX, event.clientY)
    );
    event.preventDefault();
  };
  const onClickCapture = (event) => {
    if (!suppressPanClick) return;
    suppressPanClick = false;
    event.preventDefault();
    event.stopPropagation();
  };
  frame.addEventListener("pointerdown", onPointerDown);
  frame.addEventListener("pointermove", onPointerMove);
  frame.addEventListener("pointerup", finishPointer);
  frame.addEventListener("pointercancel", finishPointer);
  frame.addEventListener("wheel", onWheel, { passive: false });
  frame.addEventListener("dblclick", onDoubleClick);
  frame.addEventListener("click", onClickCapture, true);
  const ResizeObserverConstructor = frame.ownerDocument?.defaultView?.ResizeObserver ?? (typeof ResizeObserver === "undefined" ? void 0 : ResizeObserver);
  const resizeObserver = ResizeObserverConstructor ? new ResizeObserverConstructor(() => {
    if (settings.initialFit === "contain" && !hasSuccessfulFit) {
      fit();
      return;
    }
    refreshMetrics();
    renderState(state);
  }) : null;
  resizeObserver?.observe(frame);
  refreshMetrics();
  if (settings.initialFit === "contain") fit();
  else renderState(state, { clampPosition: false, notify: false });
  const controller = {
    zoomIn(step = DEFAULT_ZOOM_STEP) {
      const amount = finitePositive(step, DEFAULT_ZOOM_STEP);
      zoomTo(state.scale + amount);
    },
    zoomOut(step = DEFAULT_ZOOM_STEP) {
      const amount = finitePositive(step, DEFAULT_ZOOM_STEP);
      zoomTo(state.scale - amount);
    },
    zoomTo,
    panBy(dx, dy) {
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
      renderState({ ...state, x: state.x + dx, y: state.y + dy });
    },
    fit,
    reset,
    getState() {
      return { ...state };
    },
    setState(next) {
      refreshMetrics();
      renderState({
        scale: next.scale ?? state.scale,
        x: next.x ?? state.x,
        y: next.y ?? state.y
      });
    },
    detach() {
      if (detached) return;
      detached = true;
      resizeObserver?.disconnect();
      activePointers.clear();
      panGesture = null;
      pinchGesture = null;
      frame.removeEventListener("pointerdown", onPointerDown);
      frame.removeEventListener("pointermove", onPointerMove);
      frame.removeEventListener("pointerup", finishPointer);
      frame.removeEventListener("pointercancel", finishPointer);
      frame.removeEventListener("wheel", onWheel);
      frame.removeEventListener("dblclick", onDoubleClick);
      frame.removeEventListener("click", onClickCapture, true);
      frame.style.position = previousFramePosition;
      frame.style.overflow = previousFrameOverflow;
      frame.style.touchAction = previousFrameTouchAction;
      host.style.transform = previousHostTransform;
      host.style.transformOrigin = previousHostTransformOrigin;
    }
  };
  return controller;
}

// src/interactive.ts
var DRAG_THRESHOLD = 4;
function eventElement(target) {
  return target instanceof Element ? target : null;
}
function sceneItemFor(target, items, options = {}) {
  const keyed = target?.closest("[data-sx-key]");
  const owned = target?.closest("[data-sx-owner]");
  const element = options.preferOwner ? owned ?? keyed : keyed ?? owned;
  const key = options.preferOwner ? owned?.getAttribute("data-sx-owner") ?? keyed?.getAttribute("data-sx-key") : keyed?.getAttribute("data-sx-key") ?? owned?.getAttribute("data-sx-owner");
  if (!key || !element) return null;
  const item = items.find((candidate) => candidate.key === key);
  return item ? { item, element } : null;
}
function fmt(value) {
  return String(Math.round(value * 100) / 100);
}
function influenceWeight(value, semanticId) {
  if (!value) return 0;
  for (const entry of value.split(",")) {
    const [id, weightText] = entry.trim().split(":");
    if (id !== semanticId) continue;
    const weight = weightText === void 0 ? 1 : Number(weightText);
    return Number.isFinite(weight) ? weight : 0;
  }
  return 0;
}
function parseOrthogonalPath(path) {
  const command = /([ML])\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))[,\s]+([+-]?(?:\d+(?:\.\d*)?|\.\d+))/gi;
  const points = [];
  let match;
  while (match = command.exec(path)) {
    points.push({ x: Number(match[2]), y: Number(match[3]) });
  }
  return points.length >= 2 ? points : null;
}
function compactOrthogonalPoints(points) {
  const unique = [];
  for (const point of points) {
    const previous = unique[unique.length - 1];
    if (!previous || Math.abs(previous.x - point.x) >= 0.1 || Math.abs(previous.y - point.y) >= 0.1) {
      unique.push(point);
    }
  }
  if (unique.length < 3) return unique;
  const compacted = [unique[0]];
  for (let index = 1; index < unique.length - 1; index++) {
    const previous = compacted[compacted.length - 1];
    const current = unique[index];
    const next = unique[index + 1];
    const vertical = Math.abs(previous.x - current.x) < 0.1 && Math.abs(current.x - next.x) < 0.1;
    const horizontal = Math.abs(previous.y - current.y) < 0.1 && Math.abs(current.y - next.y) < 0.1;
    if (!vertical && !horizontal) compacted.push(current);
  }
  compacted.push(unique[unique.length - 1]);
  return compacted;
}
function orthogonalizeMovedPoints(original, moved) {
  const output = [{ ...moved[0] }];
  for (let index = 1; index < moved.length; index++) {
    const previous = output[output.length - 1];
    const next = moved[index];
    if (Math.abs(previous.x - next.x) < 0.1 || Math.abs(previous.y - next.y) < 0.1) {
      output.push({ ...next });
      continue;
    }
    const originalPrevious = original[Math.max(0, index - 1)];
    const originalNext = original[index] ?? originalPrevious;
    const wasHorizontal = Math.abs(originalPrevious.y - originalNext.y) < 0.1;
    output.push(wasHorizontal ? { x: next.x, y: previous.y } : { x: previous.x, y: next.y });
    output.push({ ...next });
  }
  return compactOrthogonalPoints(output);
}
function previewOrthogonalEdge(edge, dx, dy) {
  const original = parseOrthogonalPath(edge.basePath);
  if (!original) return null;
  const points = original.map((point) => ({
    x: point.x + dx * edge.allWeight,
    y: point.y + dy * edge.allWeight
  }));
  const first = points[0];
  const last = points[points.length - 1];
  first.x += dx * edge.startWeight;
  first.y += dy * edge.startWeight;
  last.x += dx * edge.endWeight;
  last.y += dy * edge.endWeight;
  if (points.length === 2) {
    const horizontal = Math.abs(original[0].y - original[1].y) < 0.1;
    const vertical = Math.abs(original[0].x - original[1].x) < 0.1;
    if (Math.abs(first.y - last.y) < 0.1 || Math.abs(first.x - last.x) < 0.1) {
      return `M${fmt(first.x)} ${fmt(first.y)} L${fmt(last.x)} ${fmt(last.y)}`;
    }
    const bend = horizontal || !vertical ? { x: last.x, y: first.y } : { x: first.x, y: last.y };
    return `M${fmt(first.x)} ${fmt(first.y)} L${fmt(bend.x)} ${fmt(bend.y)} L${fmt(last.x)} ${fmt(last.y)}`;
  }
  const second = points[1];
  if (Math.abs(original[0].y - original[1].y) < 0.1) {
    second.y += dy * edge.startWeight;
  } else {
    second.x += dx * edge.startWeight;
  }
  const beforeLast = points[points.length - 2];
  const originalBeforeLast = original[original.length - 2];
  const originalLast = original[original.length - 1];
  if (Math.abs(originalBeforeLast.y - originalLast.y) < 0.1) {
    beforeLast.y += dy * edge.endWeight;
  } else {
    beforeLast.x += dx * edge.endWeight;
  }
  return orthogonalizeMovedPoints(original, points).map(
    (point, index) => `${index === 0 ? "M" : "L"}${fmt(point.x)} ${fmt(point.y)}`
  ).join(" ");
}
function previewQuadraticEdge(edge, dx, dy) {
  const number = "([+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+))";
  const match = new RegExp(`^\\s*M\\s*${number}[,\\s]+${number}\\s*Q\\s*${number}[,\\s]+${number}[,\\s]+${number}[,\\s]+${number}\\s*$`, "i").exec(edge.basePath);
  if (!match) return null;
  const start = { x: Number(match[1]), y: Number(match[2]) };
  const control = { x: Number(match[3]), y: Number(match[4]) };
  const end = { x: Number(match[5]), y: Number(match[6]) };
  const midpointWeight = (edge.startWeight + edge.endWeight) / 2;
  for (const point of [start, control, end]) {
    point.x += dx * edge.allWeight;
    point.y += dy * edge.allWeight;
  }
  start.x += dx * edge.startWeight;
  start.y += dy * edge.startWeight;
  end.x += dx * edge.endWeight;
  end.y += dy * edge.endWeight;
  control.x += dx * midpointWeight;
  control.y += dy * midpointWeight;
  return `M${fmt(start.x)} ${fmt(start.y)} Q${fmt(control.x)} ${fmt(control.y)} ${fmt(end.x)} ${fmt(end.y)}`;
}
function labelEditAnchor(label) {
  let fallbackRect = label.getBoundingClientRect();
  const measureRect = () => {
    if (label.isConnected) fallbackRect = label.getBoundingClientRect();
    return fallbackRect;
  };
  const remeasure = () => {
    const style = window.getComputedStyle(label);
    const matrix = label.getScreenCTM();
    const screenScaleY = matrix ? Math.hypot(matrix.c, matrix.d) : 1;
    const fontSize = Number.parseFloat(style.fontSize) || 12;
    return {
      rect: measureRect(),
      measureRect,
      remeasure,
      fontFamily: style.fontFamily,
      fontSize: fontSize * screenScaleY,
      fontWeight: style.fontWeight,
      fontStyle: style.fontStyle,
      letterSpacing: style.letterSpacing,
      color: style.fill && style.fill !== "none" ? style.fill : style.color
    };
  };
  return remeasure();
}
function collectLiveEdges(svg, semanticId, bbox) {
  const center = { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
  const previews = [];
  const claimedPaths = /* @__PURE__ */ new Set();
  const groups = svg.querySelectorAll(
    "g[data-from][data-to], path[data-from][data-to], g[data-sx-live-explicit='true'], path[data-sx-live-edge='true']"
  );
  for (const edgeGroup of groups) {
    const from = edgeGroup.getAttribute("data-from");
    const to = edgeGroup.getAttribute("data-to");
    const explicit = edgeGroup.getAttribute("data-sx-live-explicit") === "true";
    let startWeight = influenceWeight(edgeGroup.getAttribute("data-sx-live-start"), semanticId);
    let endWeight = influenceWeight(edgeGroup.getAttribute("data-sx-live-end"), semanticId);
    const allWeight = influenceWeight(edgeGroup.getAttribute("data-sx-live-all"), semanticId);
    if (explicit && startWeight === 0 && endWeight === 0 && allWeight === 0) continue;
    if (!explicit && from !== semanticId && to !== semanticId) continue;
    const path = edgeGroup instanceof SVGPathElement ? edgeGroup : edgeGroup.querySelector("path[data-sx-live-edge], path.sx-fc-edge");
    const basePath = path?.getAttribute("d");
    if (!path || !basePath) continue;
    if (claimedPaths.has(path)) continue;
    claimedPaths.add(path);
    try {
      const length = path.getTotalLength();
      if (!Number.isFinite(length) || length <= 0) continue;
      const sampleCount = Math.max(8, Math.min(24, Math.ceil(length / 18)));
      const points = Array.from({ length: sampleCount + 1 }, (_, index) => {
        const t = index / sampleCount;
        const point = path.getPointAtLength(length * t);
        return { x: point.x, y: point.y, t };
      });
      const first = points[0];
      const last = points[points.length - 1];
      if (!first || !last) continue;
      const firstDistance = Math.hypot(first.x - center.x, first.y - center.y);
      const lastDistance = Math.hypot(last.x - center.x, last.y - center.y);
      if (!explicit) {
        const isSelfLoop = from === semanticId && to === semanticId;
        startWeight = isSelfLoop || firstDistance <= lastDistance ? 1 : 0;
        endWeight = isSelfLoop || lastDistance < firstDistance ? 1 : 0;
      }
      const labelGroup = edgeGroup instanceof SVGGElement ? edgeGroup.querySelector(".sx-fc-edge-label-g") : null;
      previews.push({
        path,
        basePath,
        points,
        mode: edgeGroup.getAttribute("data-sx-live-mode") === "orthogonal" ? "orthogonal" : edgeGroup.getAttribute("data-sx-live-mode") === "quadratic" ? "quadratic" : "sampled",
        startWeight,
        endWeight,
        allWeight,
        labelGroup,
        baseLabelTransform: labelGroup?.getAttribute("transform") ?? null,
        midpointElements: Array.from(
          edgeGroup.querySelectorAll("[data-sx-live-midpoint]")
        ).map((element) => ({
          element,
          baseTransform: element.getAttribute("transform")
        }))
      });
    } catch {
    }
  }
  return previews;
}
function previewLiveEdges(edges, dx, dy) {
  for (const edge of edges) {
    const exactPath = edge.mode === "orthogonal" ? previewOrthogonalEdge(edge, dx, dy) : edge.mode === "quadratic" ? previewQuadraticEdge(edge, dx, dy) : null;
    const path = exactPath ?? edge.points.map((point, index) => {
      const weight = edge.allWeight + edge.startWeight * (1 - point.t) + edge.endWeight * point.t;
      const command = index === 0 ? "M" : "L";
      return `${command}${fmt(point.x + dx * weight)} ${fmt(point.y + dy * weight)}`;
    }).join(" ");
    edge.path.setAttribute("d", path);
    const midpointWeight = edge.allWeight + (edge.startWeight + edge.endWeight) / 2;
    if (edge.labelGroup) {
      const delta = `translate(${fmt(dx * midpointWeight)} ${fmt(dy * midpointWeight)})`;
      edge.labelGroup.setAttribute(
        "transform",
        edge.baseLabelTransform ? `${delta} ${edge.baseLabelTransform}` : delta
      );
    }
    for (const midpoint of edge.midpointElements) {
      const delta = `translate(${fmt(dx * midpointWeight)} ${fmt(dy * midpointWeight)})`;
      midpoint.element.setAttribute(
        "transform",
        midpoint.baseTransform ? `${delta} ${midpoint.baseTransform}` : delta
      );
    }
  }
}
function restoreDragVisual(state) {
  for (const linked of state.linkedElements) {
    if (linked.baseTransform) linked.element.setAttribute("transform", linked.baseTransform);
    else linked.element.removeAttribute("transform");
  }
  for (const edge of state.liveEdges) {
    edge.path.setAttribute("d", edge.basePath);
    if (edge.labelGroup) {
      if (edge.baseLabelTransform === null) edge.labelGroup.removeAttribute("transform");
      else edge.labelGroup.setAttribute("transform", edge.baseLabelTransform);
    }
    for (const midpoint of edge.midpointElements) {
      if (midpoint.baseTransform === null) midpoint.element.removeAttribute("transform");
      else midpoint.element.setAttribute("transform", midpoint.baseTransform);
    }
  }
}
function attachInteraction(svg, options) {
  let selected = null;
  let drag = null;
  let suppressClick = false;
  let cancelActiveLabelEdit = null;
  const currentScene = () => {
    const scene = options.getScene();
    return scene.rev === chunkNTS45SH6_cjs.sourceRevision(options.getSource()) ? scene : null;
  };
  const decoratedElements = Array.from(
    svg.querySelectorAll("[data-sx-key], [data-sx-owner]")
  );
  const initialScene = currentScene();
  const previousTouchAction = svg.style.touchAction;
  let hasMovableElement = false;
  if (initialScene) {
    const itemsByKey = new Map(initialScene.items.map((item) => [item.key, item]));
    for (const element of decoratedElements) {
      const owned = itemsByKey.get(element.getAttribute("data-sx-owner") ?? "");
      const keyed = itemsByKey.get(element.getAttribute("data-sx-key") ?? "");
      const movable = owned && owned.editable.position !== "none" ? owned : keyed && keyed.editable.position !== "none" ? keyed : null;
      if (!movable) continue;
      hasMovableElement = true;
      element.classList.add("sx-interactive-movable");
      element.setAttribute("data-sx-interactive-position", movable.editable.position);
    }
  }
  if (hasMovableElement) svg.style.touchAction = "none";
  const select = (hit) => {
    if (selected !== hit?.element) {
      svg.querySelectorAll(".sx-interactive-selected").forEach(
        (element) => element.classList.remove("sx-interactive-selected")
      );
    }
    selected = hit?.element ?? null;
    selected?.classList.add("sx-interactive-selected");
    options.onSelect?.(hit?.item ?? null);
  };
  const onClick = (event) => {
    if (suppressClick) {
      suppressClick = false;
      event.preventDefault();
      return;
    }
    const scene = currentScene();
    if (!scene) return;
    select(sceneItemFor(eventElement(event.target), scene.items));
  };
  const onDoubleClick = (event) => {
    const target = eventElement(event.target);
    const scene = currentScene();
    if (!scene) return;
    const directLabel = target?.closest("[data-sx-role='label']");
    const keyed = target?.closest("[data-sx-owner], [data-sx-key]");
    const label = directLabel ?? keyed?.querySelector("[data-sx-role='label']");
    if (!label) return;
    const hit = sceneItemFor(target, scene.items, { preferOwner: true }) ?? sceneItemFor(label, scene.items, { preferOwner: true });
    if (!hit?.item.editable.label || !options.onRequestLabelEdit) return;
    event.preventDefault();
    event.stopPropagation();
    select(hit);
    const sourceAtRequest = options.getSource();
    const revisionAtRequest = scene.rev;
    cancelActiveLabelEdit?.();
    label.classList.add("sx-label-editing");
    let settled = false;
    const cancel = () => {
      if (settled) return;
      settled = true;
      label.classList.remove("sx-label-editing");
      cancelActiveLabelEdit = null;
      options.onLabelEditEnd?.();
    };
    cancelActiveLabelEdit = cancel;
    options.onRequestLabelEdit(hit.item, labelEditAnchor(label), (text) => {
      cancel();
      if (chunkNTS45SH6_cjs.sourceRevision(options.getSource()) !== revisionAtRequest) return;
      const edited = chunkNTS45SH6_cjs.setLabel(sourceAtRequest, hit.item, text);
      if (edited.diagnostics.length === 0 && edited.source !== sourceAtRequest) {
        options.onSourceChange(edited.source, "label");
      }
    }, cancel);
  };
  const finishDrag = (commit) => {
    if (!drag) return;
    const state = drag;
    drag = null;
    const endTransform = state.element.getAttribute("data-sx-drag-delta");
    state.element.removeAttribute("data-sx-drag-delta");
    state.element.removeAttribute("data-sx-dragging");
    try {
      state.element.releasePointerCapture(state.pointerId);
    } catch {
    }
    if (!commit || !state.moved || !state.item.bbox) {
      if (state.previewSource !== null) options.onSourcePreview?.(null, "position");
      restoreDragVisual(state);
      return;
    }
    const scene = currentScene();
    if (!scene || !endTransform) {
      if (state.previewSource !== null) options.onSourcePreview?.(null, "position");
      restoreDragVisual(state);
      return;
    }
    const [dxText, dyText] = endTransform.split(",");
    const dx = Number(dxText);
    const dy = Number(dyText);
    const edited = chunkNTS45SH6_cjs.setPosition(state.sourceAtStart, state.item, {
      x: state.item.bbox.x + dx,
      y: state.item.bbox.y + dy
    });
    if (edited.diagnostics.length === 0 && edited.source !== state.sourceAtStart) {
      suppressClick = true;
      options.onSourceChange(edited.source, "position");
      return;
    }
    if (state.previewSource !== null) options.onSourcePreview?.(null, "position");
    restoreDragVisual(state);
  };
  const onPointerDown = (event) => {
    if (event.button !== 0 || !event.isPrimary) return;
    const scene = currentScene();
    if (!scene) return;
    const hit = sceneItemFor(eventElement(event.target), scene.items, { preferOwner: true });
    if (!hit || hit.item.editable.position === "none" || !hit.item.bbox) return;
    const start = pointInSvg(svg, event.clientX, event.clientY);
    if (!start) return;
    drag = {
      pointerId: event.pointerId,
      item: hit.item,
      element: hit.element,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startSvgX: start.x,
      startSvgY: start.y,
      baseTransform: hit.element.getAttribute("transform") ?? "",
      linkedElements: (() => {
        const linked = Array.from(svg.querySelectorAll("[data-sx-owner]")).filter((element) => element.getAttribute("data-sx-owner") === hit.item.key);
        if (!linked.includes(hit.element)) linked.push(hit.element);
        return linked.map((element) => ({
          element,
          baseTransform: element.getAttribute("transform") ?? ""
        }));
      })(),
      liveEdges: hit.item.semanticId ? collectLiveEdges(svg, hit.item.semanticId, hit.item.bbox) : [],
      sourceAtStart: options.getSource(),
      previewSource: null,
      moved: false
    };
    select(hit);
    event.preventDefault();
    try {
      hit.element.setPointerCapture(event.pointerId);
    } catch {
    }
  };
  const onPointerMove = (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const bbox = drag.item.bbox;
    if (!bbox) return;
    const clientDistance = Math.hypot(
      event.clientX - drag.startClientX,
      event.clientY - drag.startClientY
    );
    if (!drag.moved && clientDistance < DRAG_THRESHOLD) return;
    const point = pointInSvg(svg, event.clientX, event.clientY);
    if (!point) return;
    drag.moved = true;
    let dx = point.x - drag.startSvgX;
    let dy = point.y - drag.startSvgY;
    if (drag.item.editable.position === "move-x") dy = 0;
    if (drag.item.editable.position === "move-y") dx = 0;
    drag.element.setAttribute("data-sx-dragging", "true");
    drag.element.setAttribute("data-sx-drag-delta", `${dx},${dy}`);
    const delta = `translate(${fmt(dx)} ${fmt(dy)})`;
    for (const linked of drag.linkedElements) {
      linked.element.setAttribute(
        "transform",
        linked.baseTransform ? `${delta} ${linked.baseTransform}` : delta
      );
    }
    previewLiveEdges(drag.liveEdges, dx, dy);
    if (options.onSourcePreview) {
      const edited = chunkNTS45SH6_cjs.setPosition(drag.sourceAtStart, drag.item, {
        x: bbox.x + dx,
        y: bbox.y + dy
      });
      if (edited.diagnostics.length === 0 && edited.source !== drag.sourceAtStart && edited.source !== drag.previewSource) {
        drag.previewSource = edited.source;
        options.onSourcePreview(edited.source, "position");
      }
    }
    event.preventDefault();
  };
  const onPointerUp = (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    finishDrag(true);
  };
  const onPointerCancel = (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    finishDrag(false);
  };
  svg.addEventListener("click", onClick);
  svg.addEventListener("dblclick", onDoubleClick);
  svg.addEventListener("pointerdown", onPointerDown);
  svg.addEventListener("pointermove", onPointerMove);
  svg.addEventListener("pointerup", onPointerUp);
  svg.addEventListener("pointercancel", onPointerCancel);
  return () => {
    finishDrag(false);
    cancelActiveLabelEdit?.();
    selected?.classList.remove("sx-interactive-selected");
    for (const element of decoratedElements) {
      element.classList.remove("sx-interactive-movable");
      element.removeAttribute("data-sx-interactive-position");
    }
    svg.style.touchAction = previousTouchAction;
    svg.removeEventListener("click", onClick);
    svg.removeEventListener("dblclick", onDoubleClick);
    svg.removeEventListener("pointerdown", onPointerDown);
    svg.removeEventListener("pointermove", onPointerMove);
    svg.removeEventListener("pointerup", onPointerUp);
    svg.removeEventListener("pointercancel", onPointerCancel);
  };
}

exports.attachInteraction = attachInteraction;
exports.attachViewport = attachViewport;
//# sourceMappingURL=chunk-VMM3MMFF.cjs.map
//# sourceMappingURL=chunk-VMM3MMFF.cjs.map