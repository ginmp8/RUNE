'use strict';

var chunk4M6OFAHM_cjs = require('./chunk-4M6OFAHM.cjs');
var chunk7ZEDTSU3_cjs = require('./chunk-7ZEDTSU3.cjs');

// src/diagrams/blockdiagram/parser.ts
var BlockDiagramParseError = class extends Error {
  constructor(message, line, column, source) {
    super(line !== void 0 ? `Line ${line}: ${message}` : message);
    this.line = line;
    this.column = column;
    this.source = source;
    this.name = "BlockDiagramParseError";
  }
  line;
  column;
  source;
};
var ROLE_VALUES = /* @__PURE__ */ new Set([
  "plant",
  "controller",
  "sensor",
  "actuator",
  "reference",
  "disturbance",
  "generic"
]);
function parseAttrs(s) {
  const result = {};
  const parts = [];
  let cur = "";
  let inQuote = false;
  for (const ch of s) {
    if (ch === '"') inQuote = !inQuote;
    if (ch === "," && !inQuote) {
      parts.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) parts.push(cur);
  for (const raw of parts) {
    const p = raw.trim();
    if (!p) continue;
    if (p === "discrete") {
      result.discrete = true;
      continue;
    }
    if (p.startsWith('"') && p.endsWith('"')) {
      result.label = p.slice(1, -1);
      continue;
    }
    const m = p.match(/^(\w+)\s*:\s*(.+)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    let val = m[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (key === "name") result.name = val;
    else if (key === "role") {
      if (ROLE_VALUES.has(val)) result.role = val;
    } else if (key === "label") result.label = val;
    else if (key === "route") {
      if (val === "above" || val === "below") result.route = val;
    }
  }
  return result;
}
function parseBlockDiagram(text2) {
  const lines = text2.split("\n").map((l) => l.replace(/\r$/, ""));
  let title2;
  const blocks = [];
  const sums = [];
  const connections = [];
  const signals = /* @__PURE__ */ new Map();
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] ?? "";
    const lineNo = i + 1;
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    if (/^blockdiagram\b/i.test(line)) {
      const t = chunk4M6OFAHM_cjs.matchQuotedTitle(line);
      if (t !== void 0) title2 = t;
      continue;
    }
    const blockMatch = line.match(
      /^([A-Za-z_]\w*)\s*=\s*block\s*\(\s*"([^"]*)"\s*\)\s*(?:\[([^\]]*)\])?\s*$/
    );
    if (blockMatch) {
      const id = blockMatch[1];
      const label = blockMatch[2];
      const attrs = blockMatch[3] ? parseAttrs(blockMatch[3]) : {};
      const node = { id, label, role: attrs.role ?? "generic" };
      if (attrs.route) node.route = attrs.route;
      blocks.push(node);
      continue;
    }
    const sumMatch = line.match(
      /^([A-Za-z_]\w*)\s*=\s*sum\s*\(([^)]*)\)\s*$/
    );
    if (sumMatch) {
      const id = sumMatch[1];
      const rawInputs = sumMatch[2].split(",").map((x) => x.trim()).filter(Boolean);
      const inputs = [];
      for (const tok of rawInputs) {
        if (tok.startsWith("+") || tok.startsWith("-")) inputs.push(tok);
        else inputs.push("+" + tok);
      }
      sums.push({ id, inputs });
      continue;
    }
    const sigMatch = line.match(
      /^([A-Za-z_]\w*)\s*=\s*signal\s*\(\s*"([^"]*)"\s*\)\s*(?:\[([^\]]*)\])?\s*$/
    );
    if (sigMatch) {
      const id = sigMatch[1];
      const label = sigMatch[2];
      const attrs = sigMatch[3] ? parseAttrs(sigMatch[3]) : {};
      signals.set(id, { id, label, discrete: !!attrs.discrete });
      continue;
    }
    const arrowIdx = line.indexOf("->");
    if (arrowIdx >= 0) {
      let body = line;
      let tailAttrs = {};
      if (body.endsWith("]")) {
        let bracketStart = -1;
        let depth = 0;
        let inQuote = false;
        for (let i2 = body.length - 1; i2 >= 1; i2--) {
          const ch = body[i2];
          if (ch === '"') inQuote = !inQuote;
          else if (!inQuote && ch === "]") depth++;
          else if (!inQuote && ch === "[") {
            depth--;
            if (depth === 0) {
              if (/\s/.test(body[i2 - 1] ?? "")) bracketStart = i2;
              break;
            }
          }
        }
        if (bracketStart >= 0) {
          const inner = body.slice(bracketStart + 1, -1).trim();
          const isBareId = /^[A-Za-z_]\w*$/.test(inner);
          if (!isBareId) {
            body = body.slice(0, bracketStart).trim();
            if (inner.startsWith('"') && inner.endsWith('"') && !inner.slice(1, -1).includes(",")) {
              tailAttrs.label = inner.slice(1, -1);
            } else {
              tailAttrs = parseAttrs(inner);
            }
          }
        }
      }
      const parts = body.split("->").map((x) => x.trim()).filter(Boolean);
      if (parts.length < 2) {
        throw new BlockDiagramParseError(`Invalid connection: ${line}`, lineNo, void 0, line);
      }
      const endpoints = parts.map((p) => {
        const m = /^\[([A-Za-z_]\w*)\]$/.exec(p);
        return m ? m[1] : p;
      });
      for (const ep of endpoints) {
        if (!/^[A-Za-z_]\w*$/.test(ep)) continue;
        const exists = blocks.some((b) => b.id === ep) || sums.some((s) => s.id === ep) || signals.has(ep);
        if (!exists) {
          blocks.push({ id: ep, label: ep, role: "generic" });
        }
      }
      for (let i2 = 0; i2 < endpoints.length - 1; i2++) {
        const from = endpoints[i2];
        const to = endpoints[i2 + 1];
        const isLast = i2 === endpoints.length - 2;
        const edge = { from, to };
        if (isLast && tailAttrs.label) edge.label = tailAttrs.label;
        if (isLast && tailAttrs.discrete) edge.discrete = true;
        connections.push(edge);
      }
      continue;
    }
  }
  if (signals.size > 0) {
    const merged = [];
    const bySource = /* @__PURE__ */ new Map();
    const byTarget = /* @__PURE__ */ new Map();
    for (const e of connections) {
      if (!bySource.has(e.from)) bySource.set(e.from, []);
      bySource.get(e.from).push(e);
      if (!byTarget.has(e.to)) byTarget.set(e.to, []);
      byTarget.get(e.to).push(e);
    }
    const consumed = /* @__PURE__ */ new Set();
    for (const sigId of signals.keys()) {
      const sig = signals.get(sigId);
      const incoming = byTarget.get(sigId) ?? [];
      const outgoing = bySource.get(sigId) ?? [];
      if (incoming.length > 0 && outgoing.length > 0) {
        for (const ine of incoming) {
          for (const oute of outgoing) {
            consumed.add(ine);
            consumed.add(oute);
            merged.push({
              from: ine.from,
              to: oute.to,
              label: ine.label ?? oute.label ?? sig.label,
              discrete: sig.discrete || ine.discrete || oute.discrete
            });
          }
        }
      } else if (incoming.length > 0) {
        for (const ine of incoming) {
          consumed.add(ine);
          merged.push({
            from: ine.from,
            to: sigId,
            label: ine.label ?? sig.label,
            discrete: sig.discrete || ine.discrete
          });
        }
      } else if (outgoing.length > 0) {
        for (const oute of outgoing) {
          consumed.add(oute);
          merged.push({
            from: sigId,
            to: oute.to,
            label: oute.label ?? sig.label,
            discrete: sig.discrete || oute.discrete
          });
        }
      }
    }
    for (const e of connections) {
      if (!consumed.has(e)) merged.push(e);
    }
    connections.length = 0;
    connections.push(...merged);
  }
  return {
    type: "blockdiagram",
    title: title2,
    blocks,
    sums,
    connections
  };
}

// src/diagrams/blockdiagram/layout.ts
var BLOCK_W = 100;
var BLOCK_H = 54;
var SUM_R = 12;
var FWD_Y = 110;
var ROW_GAP = 80;
var FIRST_ROW_OFFSET = 110;
var COL_GAP = 60;
var LEFT_PAD = 30;
var RIGHT_PAD = 30;
function layoutBlockDiagram(ast) {
  const nodeIds = /* @__PURE__ */ new Set();
  for (const b of ast.blocks) nodeIds.add(b.id);
  for (const s of ast.sums) nodeIds.add(s.id);
  for (const e of ast.connections) {
    nodeIds.add(e.from);
    nodeIds.add(e.to);
  }
  const outgoing = /* @__PURE__ */ new Map();
  const incoming = /* @__PURE__ */ new Map();
  for (const id of nodeIds) {
    outgoing.set(id, []);
    incoming.set(id, []);
  }
  for (const e of ast.connections) {
    outgoing.get(e.from).push(e);
    incoming.get(e.to).push(e);
  }
  const hasIn = nodeIds.has("in");
  const entries = [];
  if (hasIn) entries.push("in");
  for (const id of nodeIds) {
    if (id === "in" || id === "out") continue;
    if ((incoming.get(id) ?? []).length === 0 && !entries.includes(id)) {
      entries.push(id);
    }
  }
  const col = /* @__PURE__ */ new Map();
  const queue = [];
  for (const e of entries) {
    col.set(e, 0);
    queue.push(e);
  }
  while (queue.length > 0) {
    const cur = queue.shift();
    const c = col.get(cur);
    for (const edge of outgoing.get(cur) ?? []) {
      if (!col.has(edge.to)) {
        col.set(edge.to, c + 1);
        queue.push(edge.to);
      }
    }
  }
  for (const id of nodeIds) {
    if (!col.has(id)) col.set(id, 1);
  }
  const isFeedback = /* @__PURE__ */ new Set();
  for (const id of nodeIds) {
    if (id === "in" || id === "out") continue;
    const myCol = col.get(id);
    const outs = outgoing.get(id) ?? [];
    if (outs.length === 0) continue;
    const allBack = outs.every((e) => (col.get(e.to) ?? myCol) < myCol);
    if (allBack) isFeedback.add(id);
  }
  const blockById = /* @__PURE__ */ new Map();
  for (const b of ast.blocks) blockById.set(b.id, b);
  const fbInfos = [];
  for (const id of isFeedback) {
    const outs = outgoing.get(id) ?? [];
    const ins = incoming.get(id) ?? [];
    const targetCols = outs.map((e) => col.get(e.to) ?? 0);
    const sourceCols = ins.map((e) => col.get(e.from) ?? 0);
    const minC = Math.min(...targetCols, ...sourceCols);
    const maxC = Math.max(...targetCols, ...sourceCols);
    const bn = blockById.get(id);
    const side = bn?.route === "above" ? "above" : "below";
    fbInfos.push({ id, range: [minC, maxC], side, row: 0 });
  }
  fbInfos.sort((a, b) => {
    const wa = a.range[1] - a.range[0];
    const wb = b.range[1] - b.range[0];
    if (wa !== wb) return wb - wa;
    return a.range[0] - b.range[0];
  });
  const tracks = { above: [], below: [] };
  for (const fb of fbInfos) {
    let row = 1;
    while (true) {
      const occupied = tracks[fb.side].find((t) => t.row === row);
      const conflict = occupied?.ranges.some(
        ([a, b]) => !(fb.range[1] < a || fb.range[0] > b)
      ) ?? false;
      if (!conflict) {
        if (occupied) occupied.ranges.push(fb.range);
        else
          tracks[fb.side].push({ row, side: fb.side, ranges: [fb.range] });
        fb.row = row;
        break;
      }
      row++;
    }
  }
  const maxBelowRow = tracks.below.reduce((m, t) => Math.max(m, t.row), 0);
  const maxAboveRow = tracks.above.reduce((m, t) => Math.max(m, t.row), 0);
  const yFor = (side, row) => {
    const step = FIRST_ROW_OFFSET + (row - 1) * ROW_GAP;
    return side === "above" ? FWD_Y - step : FWD_Y + step;
  };
  const topOffset = maxAboveRow > 0 ? FIRST_ROW_OFFSET + (maxAboveRow - 1) * ROW_GAP + 30 : 30;
  const forwardY = FWD_Y + (topOffset - 30);
  const rowY = (side, row) => yFor(side, row) + (topOffset - 30);
  let maxFwdCol = 0;
  for (const id of nodeIds) {
    if (!isFeedback.has(id)) maxFwdCol = Math.max(maxFwdCol, col.get(id) ?? 0);
  }
  const colCount = maxFwdCol + 1;
  const colContent = new Array(colCount).fill(BLOCK_W);
  const colX = [];
  {
    let x = LEFT_PAD;
    for (let i = 0; i < colCount; i++) {
      const w = i === 0 && hasIn ? 30 : colContent[i];
      colX.push(x + w / 2);
      x += w + COL_GAP;
    }
  }
  const totalWidth = colX.length ? colX[colX.length - 1] + BLOCK_W / 2 + RIGHT_PAD : 400;
  const fbById = /* @__PURE__ */ new Map();
  for (const f of fbInfos) fbById.set(f.id, f);
  const nodes = [];
  const branchCount = /* @__PURE__ */ new Map();
  for (const e of ast.connections) {
    branchCount.set(e.from, (branchCount.get(e.from) ?? 0) + 1);
  }
  const hasBranchOf = (id) => (branchCount.get(id) ?? 0) > 1;
  for (const b of ast.blocks) {
    const c = col.get(b.id) ?? 0;
    const cx = colX[Math.min(c, colX.length - 1)];
    let cy = forwardY;
    const fb = fbById.get(b.id);
    if (fb) cy = rowY(fb.side, fb.row);
    nodes.push({
      kind: "block",
      id: b.id,
      label: b.label,
      role: b.role ?? "generic",
      x: cx - BLOCK_W / 2,
      y: cy - BLOCK_H / 2,
      width: BLOCK_W,
      height: BLOCK_H,
      hasBranch: hasBranchOf(b.id)
    });
  }
  for (const s of ast.sums) {
    const c = col.get(s.id) ?? 0;
    const cx = colX[Math.min(c, colX.length - 1)];
    let cy = forwardY;
    const fb = fbById.get(s.id);
    if (fb) cy = rowY(fb.side, fb.row);
    nodes.push({
      kind: "sum",
      id: s.id,
      cx,
      cy,
      r: SUM_R,
      hasBranch: hasBranchOf(s.id)
    });
  }
  if (hasIn) {
    nodes.push({
      kind: "port",
      id: "in",
      label: "in",
      x: LEFT_PAD,
      y: forwardY,
      isInput: true,
      hasBranch: hasBranchOf("in")
    });
  }
  if (nodeIds.has("out")) {
    const outCol = col.get("out") ?? maxFwdCol;
    const cx = colX[Math.min(outCol, colX.length - 1)];
    nodes.push({
      kind: "port",
      id: "out",
      label: "out",
      x: cx,
      y: forwardY,
      isInput: false
    });
  }
  {
    const knownIds = /* @__PURE__ */ new Set([
      ...ast.blocks.map((b) => b.id),
      ...ast.sums.map((s) => s.id),
      "in",
      "out"
    ]);
    for (const id of nodeIds) {
      if (knownIds.has(id)) continue;
      if ((incoming.get(id)?.length ?? 0) === 0) continue;
      const sigCol = Math.min(col.get(id) ?? maxFwdCol + 1, colX.length - 1);
      const x = colX[sigCol] ?? (colX[colX.length - 1] ?? 0) + COL_GAP;
      nodes.push({
        kind: "port",
        id,
        label: "",
        // edge label carries the signal label; blank avoids double-text
        x,
        y: forwardY,
        isInput: false
      });
    }
  }
  const anchors = /* @__PURE__ */ new Map();
  for (const n of nodes) {
    if (n.kind === "block") {
      anchors.set(n.id, {
        left: { x: n.x, y: n.y + n.height / 2 },
        right: { x: n.x + n.width, y: n.y + n.height / 2 },
        top: { x: n.x + n.width / 2, y: n.y },
        bottom: { x: n.x + n.width / 2, y: n.y + n.height },
        cx: n.x + n.width / 2,
        cy: n.y + n.height / 2
      });
    } else if (n.kind === "sum") {
      anchors.set(n.id, {
        left: { x: n.cx - n.r, y: n.cy },
        right: { x: n.cx + n.r, y: n.cy },
        top: { x: n.cx, y: n.cy - n.r },
        bottom: { x: n.cx, y: n.cy + n.r },
        cx: n.cx,
        cy: n.cy
      });
    } else {
      anchors.set(n.id, {
        left: { x: n.x - 10, y: n.y },
        right: { x: n.x + (n.isInput ? 20 : 0), y: n.y },
        top: { x: n.x, y: n.y - 10 },
        bottom: { x: n.x, y: n.y + 10 },
        cx: n.x,
        cy: n.y
      });
    }
  }
  const sumPolarity = /* @__PURE__ */ new Map();
  for (const s of ast.sums) {
    const m = /* @__PURE__ */ new Map();
    for (const tok of s.inputs) {
      const sign = tok.startsWith("-") ? "-" : "+";
      const srcId = tok.replace(/^[+-]/, "");
      m.set(srcId, sign);
    }
    sumPolarity.set(s.id, m);
  }
  const edges = [];
  const sumById = /* @__PURE__ */ new Map();
  for (const s of ast.sums) sumById.set(s.id, s);
  for (const e of ast.connections) {
    const fromA = anchors.get(e.from);
    const toA = anchors.get(e.to);
    if (!fromA || !toA) continue;
    const fromFb = fbById.get(e.from);
    const toFb = fbById.get(e.to);
    const fromCol = col.get(e.from) ?? 0;
    const toCol = col.get(e.to) ?? 0;
    let polarity;
    if (sumById.has(e.to)) {
      const pm = sumPolarity.get(e.to);
      const sign = pm?.get(e.from) ?? "+";
      let pin = "left";
      if (fromFb?.side === "below") pin = "bottom";
      else if (fromFb?.side === "above") pin = "top";
      else if (fromCol < toCol) pin = "left";
      else pin = "bottom";
      const sumNode = nodes.find(
        (n) => n.kind === "sum" && n.id === e.to
      );
      if (sumNode) {
        let px = sumNode.cx, py = sumNode.cy;
        if (pin === "left") {
          px = sumNode.cx - sumNode.r - 8;
          py = sumNode.cy + 6;
        } else if (pin === "bottom") {
          px = sumNode.cx - sumNode.r - 2;
          py = sumNode.cy + sumNode.r + 10;
        } else if (pin === "top") {
          px = sumNode.cx - sumNode.r - 2;
          py = sumNode.cy - sumNode.r - 2;
        }
        polarity = { sign, pin, x: px, y: py };
      }
    }
    let path2;
    let midX, midY;
    let isFb = false;
    const fromIsFbSide = fromFb?.side;
    const toIsFbSide = toFb?.side;
    if (fromIsFbSide && toIsFbSide === fromIsFbSide) {
      const sx = fromA.left.x;
      const sy = fromA.left.y;
      const tx = toA.right.x;
      const ty = toA.right.y;
      path2 = `M ${sx} ${sy} L ${tx} ${ty}`;
      midX = (sx + tx) / 2;
      midY = sy - 6;
      isFb = true;
    } else if (!fromIsFbSide && toIsFbSide === "below") {
      const sx = fromA.bottom.x;
      const sy = fromA.bottom.y;
      const tx = toA.right.x;
      const ty = toA.right.y;
      path2 = `M ${sx} ${sy} L ${sx} ${ty} L ${tx} ${ty}`;
      midX = sx;
      midY = (sy + ty) / 2;
      isFb = true;
    } else if (!fromIsFbSide && toIsFbSide === "above") {
      const sx = fromA.top.x;
      const sy = fromA.top.y;
      const tx = toA.right.x;
      const ty = toA.right.y;
      path2 = `M ${sx} ${sy} L ${sx} ${ty} L ${tx} ${ty}`;
      midX = sx;
      midY = (sy + ty) / 2;
      isFb = true;
    } else if (fromIsFbSide === "below" && !toIsFbSide) {
      const sx = fromA.left.x;
      const sy = fromA.left.y;
      const tx = toA.bottom.x;
      const ty = toA.bottom.y;
      path2 = `M ${sx} ${sy} L ${tx} ${sy} L ${tx} ${ty}`;
      midX = (sx + tx) / 2;
      midY = sy - 6;
      isFb = true;
    } else if (fromIsFbSide === "above" && !toIsFbSide) {
      const sx = fromA.left.x;
      const sy = fromA.left.y;
      const tx = toA.top.x;
      const ty = toA.top.y;
      path2 = `M ${sx} ${sy} L ${tx} ${sy} L ${tx} ${ty}`;
      midX = (sx + tx) / 2;
      midY = sy - 6;
      isFb = true;
    } else if (toCol < fromCol) {
      const sx = fromA.right.x;
      const sy = fromA.right.y;
      const tx = toA.bottom.x;
      const ty = toA.bottom.y;
      const dipY = Math.max(sy, ty) + 60;
      path2 = `M ${sx} ${sy} L ${sx} ${dipY} L ${tx} ${dipY} L ${tx} ${ty}`;
      midX = (sx + tx) / 2;
      midY = dipY + 10;
      isFb = true;
    } else {
      const sx = fromA.right.x;
      const sy = fromA.right.y;
      const tx = toA.left.x;
      const ty = toA.left.y;
      if (Math.abs(sy - ty) < 0.5) {
        path2 = `M ${sx} ${sy} L ${tx} ${ty}`;
      } else {
        const midXH = (sx + tx) / 2;
        path2 = `M ${sx} ${sy} L ${midXH} ${sy} L ${midXH} ${ty} L ${tx} ${ty}`;
      }
      midX = (sx + tx) / 2;
      midY = sy - 8;
    }
    edges.push({
      from: e.from,
      to: e.to,
      label: e.label,
      discrete: !!e.discrete,
      path: path2,
      midX,
      midY,
      isFeedback: isFb,
      polarity
    });
  }
  const totalTopSpace = maxAboveRow > 0 ? FIRST_ROW_OFFSET + (maxAboveRow - 1) * ROW_GAP + 60 : 30;
  const totalBottomSpace = maxBelowRow > 0 ? FIRST_ROW_OFFSET + (maxBelowRow - 1) * ROW_GAP + 60 : 100;
  const hasFeedbackRows = maxBelowRow > 0 || maxAboveRow > 0;
  const height = Math.max(
    forwardY + totalBottomSpace,
    hasFeedbackRows ? FWD_Y + 170 : 0,
    totalTopSpace + totalBottomSpace
  );
  return {
    width: totalWidth,
    height,
    nodes,
    edges,
    title: ast.title,
    topOffset
  };
}

// src/diagrams/blockdiagram/renderer.ts
function renderBlockDiagram(ast, config) {
  const t = chunk7ZEDTSU3_cjs.resolveBlockTheme(config?.theme ?? "default");
  const layout = layoutBlockDiagram(ast);
  const titleOffset = ast.title ? 26 : 0;
  const { width } = layout;
  const height = layout.height + titleOffset;
  const css = `
.schematex-bd { font-family: system-ui, -apple-system, sans-serif; }
.schematex-bd-block { stroke: ${t.blockStroke}; stroke-width: 2; }
.schematex-bd-tf { font: italic 14px serif; fill: ${t.blockText}; }
.schematex-bd-block-name { font: 10px sans-serif; fill: ${t.blockName}; }
.schematex-bd-sum { fill: ${t.sumFill}; stroke: ${t.blockStroke}; stroke-width: 2; }
.schematex-bd-sum-sign { font: bold 11px sans-serif; fill: ${t.signalStroke}; }
.schematex-bd-signal { stroke: ${t.signalStroke}; stroke-width: 2; fill: none; }
.schematex-bd-signal-discrete { stroke: ${t.signalStroke}; stroke-width: 2; fill: none; stroke-dasharray: 6 4; }
.schematex-bd-signal-label { font: italic 12px serif; fill: ${t.signalStroke}; }
.schematex-bd-port-label { font: italic 13px serif; fill: ${t.blockText}; }
.schematex-bd-title { font: 700 16px sans-serif; fill: ${t.blockText}; }
.schematex-bd-branch { fill: ${t.signalStroke}; stroke: none; }
`.trim();
  const arrowDef = chunk7ZEDTSU3_cjs.el(
    "marker",
    {
      id: "lt-bd-arrow",
      markerWidth: 10,
      markerHeight: 8,
      refX: 9,
      refY: 4,
      orient: "auto"
    },
    [chunk7ZEDTSU3_cjs.el("polygon", { points: "0 0, 10 4, 0 8", fill: t.signalStroke })]
  );
  const nodeSvgs = [];
  const edgeSvgs = [];
  const branchSvgs = [];
  for (const n of layout.nodes) {
    if (n.kind === "block") {
      const fill = t.roleFills[n.role] ?? t.roleFills["generic"] ?? "#ffffff";
      nodeSvgs.push(
        chunk7ZEDTSU3_cjs.group(
          {
            transform: `translate(${n.x}, ${n.y})`,
            "data-block-id": n.id,
            "data-block-role": n.role
          },
          [
            chunk7ZEDTSU3_cjs.el("rect", {
              width: n.width,
              height: n.height,
              fill,
              class: "schematex-bd-block",
              rx: 2
            }),
            chunk7ZEDTSU3_cjs.text(
              {
                x: n.width / 2,
                y: n.height / 2 + 5,
                "text-anchor": "middle",
                class: "schematex-bd-tf"
              },
              n.label
            )
          ]
        )
      );
      if (n.hasBranch) {
        branchSvgs.push(
          chunk7ZEDTSU3_cjs.circle({
            cx: n.x + n.width,
            cy: n.y + n.height / 2,
            r: 3.5,
            class: "schematex-bd-branch"
          })
        );
      }
    } else if (n.kind === "sum") {
      nodeSvgs.push(
        chunk7ZEDTSU3_cjs.group({ "data-sum-id": n.id }, [
          chunk7ZEDTSU3_cjs.circle({
            cx: n.cx,
            cy: n.cy,
            r: n.r,
            class: "schematex-bd-sum"
          })
        ])
      );
      if (n.hasBranch) {
        branchSvgs.push(
          chunk7ZEDTSU3_cjs.circle({
            cx: n.cx + n.r,
            cy: n.cy,
            r: 3.5,
            class: "schematex-bd-branch"
          })
        );
      }
    } else if (n.kind === "port") {
      nodeSvgs.push(
        chunk7ZEDTSU3_cjs.group({ "data-port-id": n.id }, [
          chunk7ZEDTSU3_cjs.text(
            {
              x: n.isInput ? n.x - 4 : n.x + 4,
              y: n.y + 4,
              "text-anchor": n.isInput ? "end" : "start",
              class: "schematex-bd-port-label"
            },
            n.label
          )
        ])
      );
    }
  }
  for (const e of layout.edges) {
    const cls = e.discrete ? "schematex-bd-signal-discrete" : "schematex-bd-signal";
    edgeSvgs.push(
      chunk7ZEDTSU3_cjs.path({
        d: e.path,
        class: cls,
        "marker-end": "url(#lt-bd-arrow)",
        "data-from": e.from,
        "data-to": e.to
      })
    );
    if (e.label) {
      edgeSvgs.push(
        chunk7ZEDTSU3_cjs.text(
          {
            x: e.midX,
            y: e.midY,
            "text-anchor": "middle",
            class: "schematex-bd-signal-label"
          },
          e.label
        )
      );
    }
    if (e.polarity) {
      edgeSvgs.push(
        chunk7ZEDTSU3_cjs.text(
          {
            x: e.polarity.x,
            y: e.polarity.y,
            "text-anchor": "middle",
            class: "schematex-bd-sum-sign"
          },
          e.polarity.sign === "-" ? "\u2212" : "+"
        )
      );
    }
  }
  const titleSvg = ast.title ? chunk7ZEDTSU3_cjs.text(
    {
      x: width / 2,
      y: 18,
      "text-anchor": "middle",
      class: "schematex-bd-title"
    },
    ast.title
  ) : "";
  return chunk7ZEDTSU3_cjs.svgRoot(
    {
      class: "schematex-bd",
      viewBox: `0 0 ${width} ${height}`,
      width,
      height,
      role: "img",
      "data-diagram-type": "blockdiagram"
    },
    [
      chunk7ZEDTSU3_cjs.title(ast.title ?? "Block Diagram"),
      chunk7ZEDTSU3_cjs.desc(
        `Block diagram with ${ast.blocks.length} blocks, ${ast.sums.length} summing junctions, ${ast.connections.length} signals`
      ),
      chunk7ZEDTSU3_cjs.defs([chunk7ZEDTSU3_cjs.el("style", {}, css), arrowDef]),
      titleSvg,
      chunk7ZEDTSU3_cjs.group({ transform: `translate(0, ${titleOffset})` }, [
        chunk7ZEDTSU3_cjs.group({ class: "schematex-bd-signals" }, edgeSvgs),
        chunk7ZEDTSU3_cjs.group({ class: "schematex-bd-nodes" }, nodeSvgs),
        chunk7ZEDTSU3_cjs.group({ class: "schematex-bd-branches" }, branchSvgs)
      ])
    ]
  );
}

// src/diagrams/blockdiagram/index.ts
var blockdiagram = {
  type: "blockdiagram",
  detect(text2) {
    const first = text2.trim().split("\n")[0]?.trim().toLowerCase() ?? "";
    return first.startsWith("blockdiagram");
  },
  parse: parseBlockDiagram,
  render(text2, config) {
    const ast = parseBlockDiagram(text2);
    return renderBlockDiagram(ast, config);
  }
};

exports.blockdiagram = blockdiagram;
exports.layoutBlockDiagram = layoutBlockDiagram;
exports.parseBlockDiagram = parseBlockDiagram;
exports.renderBlockDiagram = renderBlockDiagram;
//# sourceMappingURL=chunk-RETPPUXH.cjs.map
//# sourceMappingURL=chunk-RETPPUXH.cjs.map