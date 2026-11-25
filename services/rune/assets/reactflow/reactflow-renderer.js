(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const MAX_CANVAS = 20000;
  const DEFAULT_WIDTH = 190;
  const DEFAULT_HEIGHT = 78;

  function svg(name, attrs = {}) {
    const node = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attrs)) {
      if (value !== undefined && value !== null) node.setAttribute(key, String(value));
    }
    return node;
  }

  function decodePayload(value) {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder("utf-8").decode(bytes));
  }

  function finite(value, fallback) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  function nodeSize(node) {
    return {
      width: Math.max(70, finite(node.initialWidth, DEFAULT_WIDTH)),
      height: Math.max(44, finite(node.initialHeight, DEFAULT_HEIGHT)),
    };
  }

  function autoLayout(documentValue) {
    const nodes = documentValue.nodes.map((node) => ({ ...node, position: { ...(node.position || {}) } }));
    const edges = documentValue.edges || [];
    const requested = documentValue.layout && documentValue.layout.engine;
    const hasUsefulManual = nodes.some((node) => finite(node.position.x, 0) !== 0 || finite(node.position.y, 0) !== 0);
    if (!requested || requested === "manual" || hasUsefulManual) return nodes;

    const incoming = new Map(nodes.map((node) => [node.id, 0]));
    const outgoing = new Map(nodes.map((node) => [node.id, []]));
    for (const edge of edges) {
      if (incoming.has(edge.target)) incoming.set(edge.target, incoming.get(edge.target) + 1);
      if (outgoing.has(edge.source)) outgoing.get(edge.source).push(edge.target);
    }
    const queue = nodes.filter((node) => incoming.get(node.id) === 0).map((node) => node.id);
    const layer = new Map(queue.map((id) => [id, 0]));
    const visited = new Set();
    while (queue.length) {
      const id = queue.shift();
      if (visited.has(id)) continue;
      visited.add(id);
      for (const target of outgoing.get(id) || []) {
        layer.set(target, Math.max(layer.get(target) || 0, (layer.get(id) || 0) + 1));
        incoming.set(target, Math.max(0, incoming.get(target) - 1));
        if (incoming.get(target) === 0) queue.push(target);
      }
    }
    let fallbackLayer = 0;
    for (const node of nodes) {
      if (!layer.has(node.id)) layer.set(node.id, fallbackLayer++);
    }
    const grouped = new Map();
    for (const node of nodes) {
      const key = layer.get(node.id) || 0;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(node);
    }
    const direction = String(documentValue.layout?.direction || "RIGHT").toUpperCase();
    const layerGap = finite(documentValue.layout?.layerSpacing, 130);
    const nodeGap = finite(documentValue.layout?.nodeSpacing, 65);
    for (const [layerIndex, members] of grouped.entries()) {
      members.forEach((node, index) => {
        const size = nodeSize(node);
        if (direction === "DOWN" || direction === "TD") {
          node.position = { x: index * (size.width + nodeGap), y: layerIndex * (size.height + layerGap) };
        } else {
          node.position = { x: layerIndex * (size.width + layerGap), y: index * (size.height + nodeGap) };
        }
      });
    }
    return nodes;
  }

  function absolutePosition(node, byId, seen = new Set()) {
    const local = { x: finite(node.position?.x, 0), y: finite(node.position?.y, 0) };
    if (!node.parentId || seen.has(node.id)) return local;
    const parent = byId.get(node.parentId);
    if (!parent) return local;
    seen.add(node.id);
    const parentPosition = absolutePosition(parent, byId, seen);
    return { x: parentPosition.x + local.x, y: parentPosition.y + local.y };
  }

  function anchor(node, side, byId) {
    const position = absolutePosition(node, byId);
    const size = nodeSize(node);
    switch (side) {
      case "left": return { x: position.x, y: position.y + size.height / 2 };
      case "top": return { x: position.x + size.width / 2, y: position.y };
      case "bottom": return { x: position.x + size.width / 2, y: position.y + size.height };
      default: return { x: position.x + size.width, y: position.y + size.height / 2 };
    }
  }

  function edgePath(edge, source, target, byId) {
    const start = anchor(source, source.sourcePosition || "right", byId);
    const end = anchor(target, target.targetPosition || "left", byId);
    const type = String(edge.type || "default").toLowerCase();
    if (type === "straight") return { d: `M ${start.x} ${start.y} L ${end.x} ${end.y}`, start, end };
    if (type === "step" || type === "smoothstep") {
      const midX = (start.x + end.x) / 2;
      return { d: `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`, start, end };
    }
    const delta = Math.max(50, Math.abs(end.x - start.x) * 0.45);
    return { d: `M ${start.x} ${start.y} C ${start.x + delta} ${start.y}, ${end.x - delta} ${end.y}, ${end.x} ${end.y}`, start, end };
  }

  function labelValue(value, fallback) {
    if (value === null || value === undefined) return fallback;
    if (["string", "number", "boolean"].includes(typeof value)) return String(value);
    return fallback;
  }

  function addMultilineText(group, text, x, y, className, maxChars = 26) {
    const lines = String(text).match(new RegExp(`.{1,${maxChars}}(?:\\s|$)|\\S+`, "g")) || [String(text)];
    const element = svg("text", { x, y, class: className, "text-anchor": "middle" });
    lines.slice(0, 3).forEach((line, index) => {
      const tspan = svg("tspan", { x, dy: index === 0 ? 0 : 16 });
      tspan.textContent = line.trim();
      element.appendChild(tspan);
    });
    group.appendChild(element);
  }

  function renderNode(layer, node, byId) {
    const position = absolutePosition(node, byId);
    const size = nodeSize(node);
    const group = svg("g", { transform: `translate(${position.x},${position.y})`, "data-node-id": node.id });
    const type = String(node.type || "default").toLowerCase();
    const rect = svg("rect", {
      x: 0, y: 0, width: size.width, height: size.height,
      rx: type === "group" ? 10 : 8,
      class: `reactflow-node reactflow-node-${type}`,
    });
    group.appendChild(rect);
    const title = labelValue(node.data?.label, node.id);
    addMultilineText(group, title, size.width / 2, 29, "reactflow-node-title");
    const detail = labelValue(node.data?.value ?? node.data?.description ?? node.data?.type, "");
    if (detail) addMultilineText(group, detail, size.width / 2, size.height - 16, "reactflow-node-subtitle", 34);
    for (const handle of node.handles || []) {
      const side = handle.position || (handle.type === "source" ? "right" : "left");
      let x = side === "left" ? 0 : side === "right" ? size.width : size.width / 2;
      let y = side === "top" ? 0 : side === "bottom" ? size.height : size.height / 2;
      if (Number.isFinite(handle.x)) x = handle.x;
      if (Number.isFinite(handle.y)) y = handle.y;
      const circle = svg("circle", { cx: x, cy: y, r: 5, class: "reactflow-handle" });
      const handleTitle = svg("title");
      handleTitle.textContent = `${handle.type} handle ${handle.id}`;
      circle.appendChild(handleTitle);
      group.appendChild(circle);
    }
    const accessible = svg("title");
    accessible.textContent = `${title} (${node.id})`;
    group.appendChild(accessible);
    layer.appendChild(group);
    return { position, size };
  }

  function renderDocument(node, diagramIndex = 0) {
    const documentValue = decodePayload(node.dataset.reactflowPayload || "");
    const nodes = autoLayout(documentValue);
    const byId = new Map(nodes.map((item) => [item.id, item]));
    let minX = 0, minY = 0, maxX = 800, maxY = 420;
    for (const item of nodes) {
      const position = absolutePosition(item, byId);
      const size = nodeSize(item);
      minX = Math.min(minX, position.x - 40);
      minY = Math.min(minY, position.y - 40);
      maxX = Math.min(MAX_CANVAS, Math.max(maxX, position.x + size.width + 40));
      maxY = Math.min(MAX_CANVAS, Math.max(maxY, position.y + size.height + 40));
    }
    const diagram = svg("svg", {
      viewBox: `${minX} ${minY} ${Math.max(1, maxX - minX)} ${Math.max(1, maxY - minY)}`,
      role: "img",
      "aria-label": documentValue.accessibility?.label || documentValue.title || "React Flow diagram",
      preserveAspectRatio: "xMidYMid meet",
    });
    const defs = svg("defs");
    const marker = svg("marker", { id: `rf-arrow-${diagramIndex}`, markerWidth: 10, markerHeight: 10, refX: 9, refY: 3, orient: "auto", markerUnits: "strokeWidth", class: "reactflow-marker" });
    marker.appendChild(svg("path", { d: "M0,0 L0,6 L9,3 z" }));
    defs.appendChild(marker);
    diagram.appendChild(defs);
    const edgeLayer = svg("g", { class: "reactflow-edges" });
    const nodeLayer = svg("g", { class: "reactflow-nodes" });
    diagram.appendChild(edgeLayer);
    diagram.appendChild(nodeLayer);

    for (const edge of documentValue.edges || []) {
      const source = byId.get(edge.source);
      const target = byId.get(edge.target);
      if (!source || !target || edge.hidden) continue;
      const pathInfo = edgePath(edge, source, target, byId);
      const path = svg("path", {
        d: pathInfo.d,
        class: `reactflow-edge${edge.animated ? " reactflow-edge-animated" : ""}`,
        "marker-end": edge.markerEnd ? `url(#${marker.id})` : null,
        "data-edge-id": edge.id,
      });
      const title = svg("title");
      title.textContent = `${edge.source} connects to ${edge.target}`;
      path.appendChild(title);
      edgeLayer.appendChild(path);
      if (edge.label !== undefined) {
        const label = svg("text", { x: (pathInfo.start.x + pathInfo.end.x) / 2, y: (pathInfo.start.y + pathInfo.end.y) / 2 - 6, class: "reactflow-edge-label", "text-anchor": "middle" });
        label.textContent = labelValue(edge.label, "");
        edgeLayer.appendChild(label);
      }
    }
    const groups = nodes.filter((item) => item.type === "group");
    const regular = nodes.filter((item) => item.type !== "group");
    for (const item of [...groups, ...regular]) if (!item.hidden) renderNode(nodeLayer, item, byId);

    const canvas = node.querySelector(".reactflow-canvas");
    canvas.replaceChildren(diagram);
    node.classList.add("render-interactive-hint");
    return { nodeCount: nodes.length, edgeCount: (documentValue.edges || []).length };
  }

  async function renderAll() {
    const nodes = Array.from(document.querySelectorAll(".reactflow-document[data-reactflow-payload]"));
    const results = [];
    let completed = 0;
    let failed = 0;
    for (const [diagramIndex, node] of nodes.entries()) {
      if (!node.dataset.reactflowPayload) {
        if (node.dataset.renderState === "error") failed += 1;
        continue;
      }
      node.dataset.renderState = "loading";
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      try {
        const details = renderDocument(node, diagramIndex);
        node.dataset.renderState = "ready";
        completed += 1;
        results.push({ ok: true, ...details });
      } catch (error) {
        node.dataset.renderState = "error";
        node.classList.add("diagram-error");
        const loading = node.querySelector(".reactflow-loading");
        if (loading) loading.textContent = `Failed to render React Flow: ${String(error)}`;
        failed += 1;
        results.push({ ok: false, error: String(error) });
      }
    }
    return { expected: nodes.length, completed, failed, results };
  }

  window.MarkdownPdfReactFlow = { renderAll, renderDocument, decodePayload };
})();
