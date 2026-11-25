'use strict';

var chunk2JVEMVHO_cjs = require('./chunk-2JVEMVHO.cjs');
var chunk4M6OFAHM_cjs = require('./chunk-4M6OFAHM.cjs');
var chunk7ZEDTSU3_cjs = require('./chunk-7ZEDTSU3.cjs');

// src/diagrams/sociogram/parser.ts
var SociogramParseError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "SociogramParseError";
  }
};
var EDGE_OPS = [
  ["<===>", { direction: "mutual", valence: "positive", weight: 4 }],
  ["===>", { direction: "one-way", valence: "positive", weight: 4 }],
  ["<===", { direction: "one-way", valence: "positive", weight: 4 }],
  ["<==>", { direction: "mutual", valence: "positive", weight: 3 }],
  ["==>", { direction: "one-way", valence: "positive", weight: 3 }],
  ["<==", { direction: "one-way", valence: "positive", weight: 3 }],
  ["===", { direction: "undirected", valence: "positive", weight: 3 }],
  ["<x->", { direction: "mutual", valence: "negative", weight: 2 }],
  ["-x>", { direction: "one-way", valence: "negative", weight: 2 }],
  ["<x-", { direction: "one-way", valence: "negative", weight: 2 }],
  ["-x-", { direction: "undirected", valence: "negative", weight: 2 }],
  ["<.->", { direction: "mutual", valence: "neutral", weight: 2 }],
  [".->", { direction: "one-way", valence: "neutral", weight: 2 }],
  // part of -.>
  ["-.-", { direction: "undirected", valence: "neutral", weight: 2 }],
  ["<->", { direction: "mutual", valence: "positive", weight: 2 }],
  ["->", { direction: "one-way", valence: "positive", weight: 2 }],
  ["<-", { direction: "one-way", valence: "positive", weight: 2 }],
  ["--", { direction: "undirected", valence: "positive", weight: 2 }]
];
function findEdgeOp(line2) {
  for (const [opStr, op] of EDGE_OPS) {
    const idx = line2.indexOf(` ${opStr} `);
    if (idx === -1) continue;
    const leftId = line2.slice(0, idx).trim();
    const afterOp = line2.slice(idx + opStr.length + 2).trim();
    if (!leftId || !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(leftId)) continue;
    const rightMatch = afterOp.match(/^([a-zA-Z][a-zA-Z0-9_-]*)(.*)/);
    if (!rightMatch) continue;
    const rightId = rightMatch[1];
    const rest = rightMatch[2].trim();
    if (opStr === "<-" || opStr === "<==" || opStr === "<===" || opStr === "<x-") {
      return { leftId: rightId, rightId: leftId, op: { ...op, direction: "one-way" }, rest };
    }
    return { leftId, rightId, op, rest };
  }
  const dashDotMatch = line2.match(/^([a-zA-Z][a-zA-Z0-9_-]*)\s+-\.>\s+([a-zA-Z][a-zA-Z0-9_-]*)(.*)/);
  if (dashDotMatch) {
    return {
      leftId: dashDotMatch[1],
      rightId: dashDotMatch[2],
      op: { direction: "one-way", valence: "neutral", weight: 2 },
      rest: dashDotMatch[3].trim()
    };
  }
  return null;
}
function parseProperties(propsStr) {
  const result = {};
  const regex = /(\w[\w-]*):\s*(?:"([^"]*)"|([^\s,\]]+))/g;
  let match;
  while ((match = regex.exec(propsStr)) !== null) {
    result[match[1]] = match[2] ?? match[3];
  }
  return result;
}
function extractProps(line2) {
  const bracketMatch = line2.match(/\[([^\]]*)\]/);
  if (!bracketMatch) return { clean: line2, props: {} };
  const clean = line2.slice(0, bracketMatch.index).trim();
  const props = parseProperties(bracketMatch[1]);
  return { clean, props };
}
function parseSociogram(text2) {
  const lines = text2.split("\n");
  let lineIdx = 0;
  while (lineIdx < lines.length && !lines[lineIdx].trim()) lineIdx++;
  const headerLine = lines[lineIdx]?.trim() ?? "";
  if (!headerLine.toLowerCase().startsWith("sociogram")) {
    throw new SociogramParseError("Sociogram must start with 'sociogram'");
  }
  lineIdx++;
  const titleStr = chunk4M6OFAHM_cjs.matchQuotedTitle(headerLine);
  const config = {
    layout: "circular",
    sizing: "uniform",
    coloring: "default",
    highlight: ["stars", "isolates"]
  };
  const nodes = [];
  const edges = [];
  const groups = [];
  const nodeIds = /* @__PURE__ */ new Set();
  const legendOverrides = {};
  let hasLegendOverrides = false;
  let currentGroup = null;
  while (lineIdx < lines.length) {
    const raw = lines[lineIdx];
    const trimmed = raw.trim();
    lineIdx++;
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (chunk2JVEMVHO_cjs.parseLegendDirective(trimmed, legendOverrides)) {
      hasLegendOverrides = true;
      continue;
    }
    if (trimmed.startsWith("config:")) {
      const configBody = trimmed.slice(7).trim();
      const eqIdx = configBody.indexOf("=");
      if (eqIdx !== -1) {
        const key = configBody.slice(0, eqIdx).trim();
        const val = configBody.slice(eqIdx + 1).trim();
        switch (key) {
          case "layout":
            if (["circular", "force-directed", "concentric"].includes(val)) {
              config.layout = val;
            }
            break;
          case "sizing":
            if (["uniform", "in-degree", "betweenness"].includes(val)) {
              config.sizing = val;
            }
            break;
          case "coloring":
            if (["default", "group", "role"].includes(val)) {
              config.coloring = val;
            }
            break;
          case "highlight":
            config.highlight = val.split(",").map((s) => s.trim());
            break;
        }
      }
      continue;
    }
    if (trimmed.startsWith("group ")) {
      const { clean: clean2, props: props2 } = extractProps(trimmed.slice(6).trim());
      const groupId = clean2.split(/\s/)[0];
      currentGroup = {
        id: groupId,
        label: props2.label ?? groupId,
        color: props2.color,
        members: []
      };
      groups.push(currentGroup);
      continue;
    }
    const indent = raw.search(/\S/);
    if (currentGroup && indent >= 4) {
      const { clean: clean2, props: props2 } = extractProps(trimmed);
      const memberId = clean2.split(/\s/)[0];
      if (memberId && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(memberId)) {
        currentGroup.members.push(memberId);
        if (!nodeIds.has(memberId)) {
          nodeIds.add(memberId);
          nodes.push({
            id: memberId,
            label: props2.label,
            group: currentGroup.id,
            role: props2.role,
            size: props2.size
          });
        }
        continue;
      }
    }
    if (indent < 4) {
      currentGroup = null;
    }
    const edgeResult = findEdgeOp(trimmed);
    if (edgeResult) {
      const { leftId, rightId, op, rest } = edgeResult;
      const edgeProps = extractProps(rest).props;
      for (const id of [leftId, rightId]) {
        if (!nodeIds.has(id)) {
          nodeIds.add(id);
          nodes.push({ id });
        }
      }
      const weight = edgeProps.weight ? Number(edgeProps.weight) : op.weight;
      edges.push({
        from: leftId,
        to: rightId,
        direction: op.direction,
        valence: op.valence,
        weight,
        label: edgeProps.label
      });
      continue;
    }
    const { clean, props } = extractProps(trimmed);
    const nodeId = clean.split(/\s/)[0];
    if (nodeId && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(nodeId) && !nodeIds.has(nodeId)) {
      nodeIds.add(nodeId);
      const node = {
        id: nodeId,
        label: props.label,
        group: props.group,
        role: props.role,
        size: props.size
      };
      nodes.push(node);
      if (props.group) {
        let grp = groups.find((g) => g.id === props.group);
        if (!grp) {
          grp = { id: props.group, members: [] };
          groups.push(grp);
        }
        grp.members.push(nodeId);
      }
    }
  }
  return {
    type: "sociogram",
    title: titleStr,
    config,
    nodes,
    edges,
    groups,
    legendOverrides: hasLegendOverrides ? legendOverrides : void 0
  };
}

// src/diagrams/sociogram/layout.ts
function computeInDegree(nodeId, edges) {
  let count = 0;
  for (const e of edges) {
    if (e.to === nodeId) count++;
    if (e.direction === "mutual" && e.from === nodeId) count++;
    if (e.direction === "undirected" && e.from === nodeId) count++;
  }
  return count;
}
function computeOutDegree(nodeId, edges) {
  let count = 0;
  for (const e of edges) {
    if (e.from === nodeId) count++;
    if (e.direction === "mutual" && e.to === nodeId) count++;
    if (e.direction === "undirected" && e.to === nodeId) count++;
  }
  return count;
}
function autoDetectRole(node, inDeg, outDeg, meanIn, sdIn, rejectionCount) {
  if (node.role) return node.role;
  if (inDeg === 0 && outDeg === 0) return "isolate";
  if (inDeg === 0 && outDeg > 0) return "neglectee";
  if (rejectionCount >= 2) return "rejected";
  if (sdIn > 0 && inDeg >= meanIn + 1.5 * sdIn) return "star";
  return void 0;
}
var BASE_RADIUS = 20;
function computeNodeRadius(node, inDeg, sizing) {
  if (node.size === "small") return 14;
  if (node.size === "large") return 30;
  if (sizing === "in-degree") {
    return Math.min(40, Math.max(14, 14 + inDeg * 4));
  }
  return BASE_RADIUS;
}
function layoutCircular(ast) {
  const n = ast.nodes.length;
  const radius = Math.max(120, n * 22);
  const canvasSize = radius * 2 + 160;
  const cx = canvasSize / 2;
  const cy = canvasSize / 2;
  const inDegrees = /* @__PURE__ */ new Map();
  const outDegrees = /* @__PURE__ */ new Map();
  const rejections = /* @__PURE__ */ new Map();
  for (const node of ast.nodes) {
    inDegrees.set(node.id, computeInDegree(node.id, ast.edges));
    outDegrees.set(node.id, computeOutDegree(node.id, ast.edges));
    rejections.set(node.id, 0);
  }
  for (const e of ast.edges) {
    if (e.valence === "negative") {
      rejections.set(e.to, (rejections.get(e.to) ?? 0) + 1);
    }
  }
  const inVals = Array.from(inDegrees.values());
  const meanIn = inVals.reduce((a, b) => a + b, 0) / (inVals.length || 1);
  const sdIn = Math.sqrt(
    inVals.reduce((sum, v) => sum + (v - meanIn) ** 2, 0) / (inVals.length || 1)
  );
  const sortedNodes = [...ast.nodes];
  if (ast.groups.length > 0) {
    const groupOrder = /* @__PURE__ */ new Map();
    ast.groups.forEach((g, i) => {
      for (const m of g.members) groupOrder.set(m, i);
    });
    sortedNodes.sort((a, b) => {
      const ga = groupOrder.get(a.id) ?? 999;
      const gb = groupOrder.get(b.id) ?? 999;
      if (ga !== gb) return ga - gb;
      return a.id.localeCompare(b.id);
    });
  }
  const angleStep = 2 * Math.PI / n;
  const startAngle = -Math.PI / 2;
  const layoutNodes = sortedNodes.map((node, i) => {
    const angle = startAngle + i * angleStep;
    const inDeg = inDegrees.get(node.id) ?? 0;
    const outDeg = outDegrees.get(node.id) ?? 0;
    const rej = rejections.get(node.id) ?? 0;
    const nodeRadius = computeNodeRadius(node, inDeg, ast.config.sizing);
    const computedRole = autoDetectRole(node, inDeg, outDeg, meanIn, sdIn, rej);
    return {
      node,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      radius: nodeRadius,
      computedRole
    };
  });
  const layoutEdges = computeEdgePositions(layoutNodes, ast.edges);
  return {
    width: canvasSize,
    height: canvasSize,
    nodes: layoutNodes,
    edges: layoutEdges,
    ast
  };
}
function layoutForceDirected(ast) {
  const n = ast.nodes.length;
  const canvasSize = n <= 8 ? 400 : n <= 20 ? 600 : n <= 40 ? 800 : 1e3;
  const padding = 60;
  const inDegrees = /* @__PURE__ */ new Map();
  const outDegrees = /* @__PURE__ */ new Map();
  const rejections = /* @__PURE__ */ new Map();
  for (const node of ast.nodes) {
    inDegrees.set(node.id, computeInDegree(node.id, ast.edges));
    outDegrees.set(node.id, computeOutDegree(node.id, ast.edges));
    rejections.set(node.id, 0);
  }
  for (const e of ast.edges) {
    if (e.valence === "negative") {
      rejections.set(e.to, (rejections.get(e.to) ?? 0) + 1);
    }
  }
  const inVals = Array.from(inDegrees.values());
  const meanIn = inVals.reduce((a, b) => a + b, 0) / (inVals.length || 1);
  const sdIn = Math.sqrt(
    inVals.reduce((sum, v) => sum + (v - meanIn) ** 2, 0) / (inVals.length || 1)
  );
  const initRadius = canvasSize * 0.3;
  const cx = canvasSize / 2;
  const cy = canvasSize / 2;
  const positions = ast.nodes.map((_, i) => {
    const angle = 2 * Math.PI * i / n - Math.PI / 2;
    return {
      x: cx + initRadius * Math.cos(angle),
      y: cy + initRadius * Math.sin(angle)
    };
  });
  const nodeIdx = /* @__PURE__ */ new Map();
  ast.nodes.forEach((node, i) => nodeIdx.set(node.id, i));
  const area = (canvasSize - 2 * padding) ** 2;
  const k = Math.sqrt(area / Math.max(n, 1));
  const maxIterations = 200;
  let temperature = canvasSize / 8;
  const coolingRate = 0.95;
  const minDist = 60;
  for (let iter = 0; iter < maxIterations; iter++) {
    const disp = positions.map(() => ({ dx: 0, dy: 0 }));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = positions[i].x - positions[j].x;
        const dy = positions[i].y - positions[j].y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = k * k / dist;
        const fx = dx / dist * force;
        const fy = dy / dist * force;
        disp[i].dx += fx;
        disp[i].dy += fy;
        disp[j].dx -= fx;
        disp[j].dy -= fy;
      }
    }
    for (const edge of ast.edges) {
      const i = nodeIdx.get(edge.from);
      const j = nodeIdx.get(edge.to);
      if (i === void 0 || j === void 0) continue;
      const dx = positions[i].x - positions[j].x;
      const dy = positions[i].y - positions[j].y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = dist * dist / k;
      const fx = dx / dist * force;
      const fy = dy / dist * force;
      disp[i].dx -= fx;
      disp[i].dy -= fy;
      disp[j].dx += fx;
      disp[j].dy += fy;
    }
    for (let i = 0; i < n; i++) {
      const mag = Math.sqrt(disp[i].dx ** 2 + disp[i].dy ** 2);
      if (mag > 0) {
        const scale = Math.min(mag, temperature) / mag;
        positions[i].x += disp[i].dx * scale;
        positions[i].y += disp[i].dy * scale;
      }
      positions[i].x = Math.max(padding, Math.min(canvasSize - padding, positions[i].x));
      positions[i].y = Math.max(padding, Math.min(canvasSize - padding, positions[i].y));
    }
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = positions[i].x - positions[j].x;
        const dy = positions[i].y - positions[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist && dist > 0) {
          const push = (minDist - dist) / 2;
          const nx = dx / dist;
          const ny = dy / dist;
          positions[i].x += nx * push;
          positions[i].y += ny * push;
          positions[j].x -= nx * push;
          positions[j].y -= ny * push;
        }
      }
    }
    temperature *= coolingRate;
  }
  const layoutNodes = ast.nodes.map((node, i) => {
    const inDeg = inDegrees.get(node.id) ?? 0;
    const outDeg = outDegrees.get(node.id) ?? 0;
    const rej = rejections.get(node.id) ?? 0;
    const nodeRadius = computeNodeRadius(node, inDeg, ast.config.sizing);
    const computedRole = autoDetectRole(node, inDeg, outDeg, meanIn, sdIn, rej);
    return {
      node,
      x: positions[i].x,
      y: positions[i].y,
      radius: nodeRadius,
      computedRole
    };
  });
  const layoutEdges = computeEdgePositions(layoutNodes, ast.edges);
  return {
    width: canvasSize,
    height: canvasSize,
    nodes: layoutNodes,
    edges: layoutEdges,
    ast
  };
}
function computeEdgePositions(nodes, edges) {
  const nodeMap = /* @__PURE__ */ new Map();
  for (const n of nodes) nodeMap.set(n.node.id, n);
  return edges.map((edge) => {
    const fromNode = nodeMap.get(edge.from);
    const toNode = nodeMap.get(edge.to);
    if (!fromNode || !toNode) {
      return { edge, x1: 0, y1: 0, x2: 0, y2: 0 };
    }
    const dx = toNode.x - fromNode.x;
    const dy = toNode.y - fromNode.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return { edge, x1: fromNode.x, y1: fromNode.y, x2: toNode.x, y2: toNode.y };
    const nx = dx / dist;
    const ny = dy / dist;
    const markerGap = 10;
    return {
      edge,
      x1: fromNode.x + nx * (fromNode.radius + 2),
      y1: fromNode.y + ny * (fromNode.radius + 2),
      x2: toNode.x - nx * (toNode.radius + markerGap),
      y2: toNode.y - ny * (toNode.radius + markerGap)
    };
  });
}
function layoutSociogram(ast) {
  switch (ast.config.layout) {
    case "force-directed":
      return layoutForceDirected(ast);
    case "circular":
    default:
      return layoutCircular(ast);
  }
}

// src/diagrams/sociogram/legend.ts
var SECTIONS = [
  { id: "groups", title: "Groups" },
  { id: "roles", title: "Roles" },
  { id: "ties", title: "Ties" }
];
function buildSociogramLegend(ast, theme) {
  const items = [];
  const colorByGroup = ast.config.coloring === "group" || ast.groups.some((g) => g.color);
  if (colorByGroup) {
    ast.groups.forEach((g, i) => {
      const color = g.color ?? theme.palette[i % theme.palette.length];
      items.push({
        key: `group.${g.id}`,
        label: g.label ?? humanize(g.id),
        kind: "fill",
        color,
        section: "groups"
      });
    });
  }
  const usedRoles = /* @__PURE__ */ new Set();
  for (const n of ast.nodes) {
    if (n.role) usedRoles.add(n.role);
  }
  const roleOrder = ["star", "isolate", "neglectee", "rejected"];
  for (const r of roleOrder) {
    if (!usedRoles.has(r)) continue;
    items.push(roleItem(r, theme));
  }
  const usedValences = /* @__PURE__ */ new Set();
  for (const e of ast.edges) usedValences.add(e.valence);
  const valOrder = ["positive", "negative", "neutral"];
  for (const v of valOrder) {
    if (!usedValences.has(v)) continue;
    items.push(valenceItem(v, theme));
  }
  return {
    mode: "auto",
    title: "Legend",
    position: "bottom-inline",
    columns: 1,
    sections: SECTIONS,
    items
  };
}
function roleItem(r, theme) {
  switch (r) {
    case "star":
      return {
        key: `role.${r}`,
        label: "Star (sociometric center)",
        kind: "shape",
        shape: "circle",
        fill: theme.warn,
        color: theme.warn,
        section: "roles"
      };
    case "isolate":
      return {
        key: `role.${r}`,
        label: "Isolate",
        kind: "shape",
        shape: "circle",
        fill: theme.fillMuted,
        color: theme.neutral,
        section: "roles"
      };
    case "neglectee":
      return {
        key: `role.${r}`,
        label: "Neglectee",
        kind: "shape",
        shape: "circle",
        fill: theme.fillMuted,
        color: theme.accent,
        section: "roles"
      };
    case "rejected":
      return {
        key: `role.${r}`,
        label: "Rejected",
        kind: "shape",
        shape: "circle",
        fill: theme.negative,
        color: theme.negative,
        section: "roles"
      };
    default:
      return {
        key: `role.${r}`,
        label: humanize(r),
        kind: "shape",
        shape: "circle",
        section: "roles"
      };
  }
}
function valenceItem(v, theme) {
  switch (v) {
    case "positive":
      return {
        key: `valence.${v}`,
        label: "Positive tie",
        kind: "line",
        color: theme.positive,
        pattern: "solid",
        strokeWidth: 2,
        section: "ties"
      };
    case "negative":
      return {
        key: `valence.${v}`,
        label: "Negative tie",
        kind: "line",
        color: theme.negative,
        pattern: "dashed",
        strokeWidth: 2,
        section: "ties"
      };
    case "neutral":
      return {
        key: `valence.${v}`,
        label: "Neutral tie",
        kind: "line",
        color: theme.neutral,
        pattern: "dotted",
        strokeWidth: 2,
        section: "ties"
      };
  }
}
function humanize(s) {
  return s.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// src/diagrams/sociogram/renderer.ts
var LABEL_GAP = 4;
var LABEL_FONT_SIZE = 11;
function valenceColors(t) {
  return { positive: t.positive, negative: t.negative, neutral: t.neutral };
}
function roleFills(t) {
  return { star: t.warn, isolate: t.fillMuted, rejected: t.negative };
}
function buildCSS(ast, t) {
  const vc = valenceColors(t);
  const rf = roleFills(t);
  const groupColors = ast.groups.map((g, i) => {
    const color = g.color ?? t.palette[i % t.palette.length];
    return `.schematex-sociogram-group-${g.id} { fill: ${color}; stroke: ${color}; }`;
  });
  return `
.schematex-sociogram {${chunk7ZEDTSU3_cjs.cssCustomProperties(t)}
  font-family: system-ui, -apple-system, sans-serif;
}
.schematex-sociogram-node { fill: ${t.accent}; stroke: ${t.accent}; stroke-width: ${chunk7ZEDTSU3_cjs.STROKE_WIDTH.normal}; }
.schematex-sociogram-node-star { fill: ${rf.star}; stroke: ${t.warn}; stroke-width: ${chunk7ZEDTSU3_cjs.STROKE_WIDTH.thick}; }
.schematex-sociogram-node-isolate { fill: ${rf.isolate}; stroke: ${t.neutral}; stroke-width: ${chunk7ZEDTSU3_cjs.STROKE_WIDTH.normal}; stroke-dasharray: 4 3; }
.schematex-sociogram-node-neglectee { fill: ${t.fillMuted}; stroke: ${t.accent}; stroke-width: ${chunk7ZEDTSU3_cjs.STROKE_WIDTH.normal}; stroke-dasharray: 4 3; }
.schematex-sociogram-node-rejected { fill: ${rf.rejected}; stroke: ${t.negative}; stroke-width: ${chunk7ZEDTSU3_cjs.STROKE_WIDTH.normal}; stroke-dasharray: 4 3; }
.schematex-sociogram-edge { stroke-linecap: round; }
.schematex-sociogram-edge-positive { stroke: ${vc.positive}; }
.schematex-sociogram-edge-negative { stroke: ${vc.negative}; stroke-dasharray: 6 3; }
.schematex-sociogram-edge-neutral { stroke: ${vc.neutral}; stroke-dasharray: 2 3; }
.schematex-sociogram-label { font-size: ${LABEL_FONT_SIZE}px; fill: ${t.text}; text-anchor: middle; }
.schematex-sociogram-edge-label { font-size: ${chunk7ZEDTSU3_cjs.FONT_SIZE.small}px; fill: ${t.textMuted}; text-anchor: middle; }
.schematex-sociogram-title { font-size: ${chunk7ZEDTSU3_cjs.FONT_SIZE.title}px; font-weight: bold; fill: ${t.text}; text-anchor: middle; }
.schematex-sociogram-star-badge { font-size: 10px; fill: ${t.warn}; }
.schematex-sociogram-group-label { font-size: 13px; font-weight: bold; fill-opacity: 0.7; text-anchor: middle; }
${groupColors.join("\n")}
`.trim();
}
function buildDefs(t) {
  const vc = valenceColors(t);
  const markers = [
    { id: "sociogram-arrow", fill: vc.positive },
    { id: "sociogram-arrow-negative", fill: vc.negative },
    { id: "sociogram-arrow-neutral", fill: vc.neutral }
  ];
  const markerEls = markers.map(
    (m) => chunk7ZEDTSU3_cjs.el(
      "marker",
      {
        id: m.id,
        viewBox: "0 0 10 10",
        refX: "9",
        refY: "5",
        markerWidth: "8",
        markerHeight: "8",
        orient: "auto"
      },
      chunk7ZEDTSU3_cjs.el("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: m.fill })
    )
  );
  return chunk7ZEDTSU3_cjs.el("defs", {}, markerEls);
}
function edgeStrokeWidth(weight) {
  if (weight <= 1) return 1;
  if (weight === 2) return 2;
  if (weight === 3) return 3.5;
  return 5;
}
function getNodeClass(role) {
  if (!role) return "schematex-sociogram-node";
  switch (role) {
    case "star":
      return "schematex-sociogram-node schematex-sociogram-node-star";
    case "isolate":
      return "schematex-sociogram-node schematex-sociogram-node-isolate";
    case "neglectee":
      return "schematex-sociogram-node schematex-sociogram-node-neglectee";
    case "rejected":
      return "schematex-sociogram-node schematex-sociogram-node-rejected";
    case "bridge":
      return "schematex-sociogram-node";
    default:
      return "schematex-sociogram-node";
  }
}
function getNodeFill(node, ast, t) {
  const role = node.computedRole ?? node.node.role;
  const rf = roleFills(t);
  if (ast.config.coloring === "role" && role) {
    return rf[role];
  }
  if (ast.config.coloring === "group" && node.node.group) {
    const gIdx = ast.groups.findIndex((g) => g.id === node.node.group);
    if (gIdx >= 0) {
      return ast.groups[gIdx].color ?? t.palette[gIdx % t.palette.length];
    }
  }
  return void 0;
}
function renderNodes(layout, t) {
  const nodeEls = [];
  const labelEls = [];
  const { ast } = layout;
  for (const layoutNode of layout.nodes) {
    const { node, x, y, radius, computedRole } = layoutNode;
    const role = computedRole ?? node.role;
    let cls = getNodeClass(role);
    const fill = getNodeFill(layoutNode, ast, t);
    if (ast.config.coloring === "group" && node.group && cls === "schematex-sociogram-node" && ast.groups.some((g) => g.id === node.group)) {
      cls += ` schematex-sociogram-group-${node.group}`;
    }
    const attrs = {
      cx: x,
      cy: y,
      r: radius,
      class: cls,
      "data-node-id": node.id
    };
    if (fill) attrs.fill = fill;
    nodeEls.push(chunk7ZEDTSU3_cjs.circle(attrs));
    if (role === "star") {
      const badgeX = x + radius * 0.6;
      const badgeY = y - radius * 0.6;
      const s = 6;
      const points = starPoints(badgeX, badgeY, s, s * 0.4, 5);
      nodeEls.push(
        chunk7ZEDTSU3_cjs.polygon({
          points,
          fill: t.warn,
          class: "schematex-sociogram-star-badge"
        })
      );
    }
    const label = node.label ?? node.id;
    labelEls.push(
      chunk7ZEDTSU3_cjs.text(
        {
          x,
          y: y + radius + LABEL_GAP + LABEL_FONT_SIZE,
          class: "schematex-sociogram-label",
          "data-node-id": node.id
        },
        label
      )
    );
  }
  return { nodeEls, labelEls };
}
function starPoints(cx, cy, outerR, innerR, points) {
  const coords = [];
  for (let i = 0; i < points * 2; i++) {
    const angle = Math.PI * i / points - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    coords.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return coords.join(" ");
}
function getMarkerUrl(valence, direction) {
  if (direction === "undirected") return {};
  const markerId = valence === "negative" ? "sociogram-arrow-negative" : valence === "neutral" ? "sociogram-arrow-neutral" : "sociogram-arrow";
  if (direction === "mutual") {
    return {
      start: `url(#${markerId})`,
      end: `url(#${markerId})`
    };
  }
  return { end: `url(#${markerId})` };
}
function renderEdges(layout) {
  const edgeEls = [];
  const edgeLabelEls = [];
  for (const layoutEdge of layout.edges) {
    const { edge, x1, y1, x2, y2 } = layoutEdge;
    const valenceClass = `schematex-sociogram-edge-${edge.valence}`;
    const markers = getMarkerUrl(edge.valence, edge.direction);
    const sw = edgeStrokeWidth(edge.weight);
    const attrs = {
      x1,
      y1,
      x2,
      y2,
      class: `schematex-sociogram-edge ${valenceClass}`,
      "stroke-width": sw,
      "data-from": edge.from,
      "data-to": edge.to
    };
    if (markers.end) attrs["marker-end"] = markers.end;
    if (markers.start) attrs["marker-start"] = markers.start;
    edgeEls.push(chunk7ZEDTSU3_cjs.line(attrs));
    if (edge.label) {
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      edgeLabelEls.push(
        chunk7ZEDTSU3_cjs.text(
          { x: mx, y: my - 6, class: "schematex-sociogram-edge-label" },
          edge.label
        )
      );
    }
  }
  return { edgeEls, edgeLabelEls };
}
function renderGroupLabels(layout, t) {
  const elements = [];
  const { ast } = layout;
  for (let gi = 0; gi < ast.groups.length; gi++) {
    const grp = ast.groups[gi];
    const memberNodes = layout.nodes.filter(
      (n) => n.node.group === grp.id
    );
    if (memberNodes.length === 0) continue;
    const color = grp.color ?? t.palette[gi % t.palette.length];
    const cx = memberNodes.reduce((s, n) => s + n.x, 0) / memberNodes.length;
    const minY = Math.min(...memberNodes.map((n) => n.y - n.radius));
    elements.push(
      chunk7ZEDTSU3_cjs.text(
        {
          x: cx,
          y: minY - 14,
          class: "schematex-sociogram-group-label",
          fill: color
        },
        grp.label ?? grp.id
      )
    );
  }
  return elements;
}
function renderSociogram(layout, options = {}) {
  const { ast } = layout;
  const t = chunk7ZEDTSU3_cjs.resolveBaseTheme(options.theme ?? "default");
  const css = buildCSS(ast, t);
  const defsStr = buildDefs(t);
  const titleOffset = ast.title ? 30 : 0;
  const totalWidth = layout.width;
  const totalHeight = layout.height + titleOffset;
  const { edgeEls, edgeLabelEls } = renderEdges(layout);
  const { nodeEls, labelEls } = renderNodes(layout, t);
  const groupLabelEls = renderGroupLabels(layout, t);
  const titleEl = ast.title ? chunk7ZEDTSU3_cjs.text(
    { x: totalWidth / 2, y: 20, class: "schematex-sociogram-title" },
    ast.title
  ) : "";
  const transformY = titleOffset;
  const transform = transformY ? `translate(0,${transformY})` : void 0;
  const svgContent = [
    chunk7ZEDTSU3_cjs.title(`Sociogram${ast.title ? `: ${ast.title}` : ""}`),
    chunk7ZEDTSU3_cjs.desc(
      `Sociogram with ${ast.nodes.length} members and ${ast.edges.length} connections`
    ),
    chunk7ZEDTSU3_cjs.el("style", {}, css),
    defsStr
  ];
  if (titleEl) svgContent.push(titleEl);
  if (groupLabelEls.length > 0) {
    svgContent.push(
      chunk7ZEDTSU3_cjs.group({ class: "schematex-sociogram-groups", transform }, groupLabelEls)
    );
  }
  svgContent.push(
    chunk7ZEDTSU3_cjs.group({ class: "schematex-sociogram-edges", transform }, [
      ...edgeEls,
      ...edgeLabelEls
    ])
  );
  svgContent.push(
    chunk7ZEDTSU3_cjs.group({ class: "schematex-sociogram-nodes", transform }, nodeEls)
  );
  svgContent.push(
    chunk7ZEDTSU3_cjs.group({ class: "schematex-sociogram-labels", transform }, labelEls)
  );
  let finalWidth = totalWidth;
  let finalHeight = totalHeight;
  const autoSpec = buildSociogramLegend(ast, t);
  const finalSpec = chunk2JVEMVHO_cjs.applyLegendOverrides(autoSpec, ast.legendOverrides);
  if (finalSpec.mode === "on" && finalSpec.items.length > 0) {
    const { svg: legendSvg, bbox: lb } = chunk2JVEMVHO_cjs.renderLegend(
      finalSpec,
      {
        canvasWidth: totalWidth,
        canvasHeight: totalHeight,
        padding: 16,
        titleHeight: titleOffset
      },
      t,
      { fontFamily: "system-ui, sans-serif", fontSize: 12 }
    );
    if (legendSvg) {
      svgContent.push(legendSvg);
      const overflowX = lb.x + lb.w + 8;
      const overflowY = lb.y + lb.h + 8;
      if (overflowX > finalWidth) finalWidth = overflowX;
      if (overflowY > finalHeight) finalHeight = overflowY;
    }
  }
  return chunk7ZEDTSU3_cjs.svgRoot(
    {
      class: "schematex-diagram schematex-sociogram",
      viewBox: `0 0 ${finalWidth} ${finalHeight}`,
      width: finalWidth,
      height: finalHeight
    },
    svgContent
  );
}

// src/diagrams/sociogram/index.ts
var sociogram = {
  type: "sociogram",
  detect(text2) {
    const first = text2.trim().split("\n")[0]?.trim().toLowerCase() ?? "";
    return first.startsWith("sociogram");
  },
  parse: parseSociogram,
  render(text2, config) {
    const ast = parseSociogram(text2);
    const layout = layoutSociogram(ast);
    return renderSociogram(layout, { theme: config?.theme });
  }
};

exports.layoutSociogram = layoutSociogram;
exports.parseSociogram = parseSociogram;
exports.renderSociogram = renderSociogram;
exports.sociogram = sociogram;
//# sourceMappingURL=chunk-JNSP3SUJ.cjs.map
//# sourceMappingURL=chunk-JNSP3SUJ.cjs.map