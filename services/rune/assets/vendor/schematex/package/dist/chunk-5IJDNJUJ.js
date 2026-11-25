import { matchQuotedTitle } from './chunk-ISQCUPQR.js';
import { resolveBaseTheme, title, desc, el, defs, text, rect, path, group, svgRoot, escapeXml, polygon, circle } from './chunk-ZUMTE4E7.js';

// src/diagrams/entity/parser.ts
var EntityParseError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "EntityParseError";
  }
};
var ENTITY_TYPE_ALIAS = {
  corp: "corp",
  corporation: "corp",
  inc: "corp",
  llc: "llc",
  llp: "llc",
  gmbh: "llc",
  bv: "llc",
  lp: "lp",
  lllp: "lp",
  fund: "lp",
  trust: "trust",
  individual: "individual",
  person: "individual",
  foundation: "foundation",
  npo: "foundation",
  disregarded: "disregarded",
  branch: "disregarded",
  pool: "pool",
  placeholder: "placeholder",
  tbf: "placeholder"
};
function stripComment(s) {
  let out = "";
  let inQuote = false;
  for (const ch of s) {
    if (ch === '"') inQuote = !inQuote;
    if (ch === "#" && !inQuote) break;
    out += ch;
  }
  return out;
}
function stripQuotes(v) {
  const t = v.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1);
  return t;
}
function splitTopLevelCommas(inside) {
  const parts = [];
  let cur = "";
  let inQuote = false;
  let depth = 0;
  for (const ch of inside) {
    if (ch === '"') inQuote = !inQuote;
    if (!inQuote) {
      if (ch === "[") depth++;
      else if (ch === "]") depth--;
    }
    if (ch === "," && !inQuote && depth === 0) {
      parts.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}
function parseProps(inside) {
  const out = {};
  for (const p of splitTopLevelCommas(inside)) {
    const s = p.trim();
    if (!s) continue;
    const colon = s.indexOf(":");
    if (colon < 0) throw new EntityParseError(`Invalid property "${s}" (missing ":")`);
    const k = s.slice(0, colon).trim().toLowerCase();
    const v = s.slice(colon + 1).trim();
    out[k] = v;
  }
  return out;
}
function parseIdList(v) {
  const t = v.trim();
  const inner = t.startsWith("[") && t.endsWith("]") ? t.slice(1, -1) : t;
  return inner.split(",").map((s) => s.trim()).filter(Boolean);
}
function joinBrackets(lines) {
  const out = [];
  let buf = "";
  let depth = 0;
  for (const raw of lines) {
    const line = stripComment(raw);
    if (!line.trim() && depth === 0) {
      if (buf) {
        out.push(buf);
        buf = "";
      }
      out.push("");
      continue;
    }
    for (const ch of line) {
      if (ch === "[") depth++;
      else if (ch === "]") depth = Math.max(0, depth - 1);
    }
    buf = buf ? buf + " " + line.trim() : line;
    if (depth === 0) {
      out.push(buf);
      buf = "";
    }
  }
  if (buf) out.push(buf);
  return out;
}
var EDGE_OPS = [
  // Order matters: longer tokens first
  { token: "==>", op: "voting" },
  { token: "-.->", op: "pool" },
  { token: "-~->", op: "license" },
  { token: "-->", op: "distribution" },
  { token: "->", op: "ownership" }
];
function matchEdgeOp(line) {
  for (const { token, op } of EDGE_OPS) {
    const idx = findEdgeToken(line, token);
    if (idx >= 0) return { op, idx, len: token.length };
  }
  return null;
}
function findEdgeToken(line, token) {
  let inQuote = false;
  let depth = 0;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuote = !inQuote;
    if (!inQuote) {
      if (ch === "[") depth++;
      else if (ch === "]") depth = Math.max(0, depth - 1);
    }
    if (!inQuote && depth === 0 && line.startsWith(token, i)) {
      return i;
    }
  }
  return -1;
}
function parseEntityDSL(text2) {
  const rawLines = text2.split("\n").map((l) => l.replace(/\r$/, ""));
  const lines = joinBrackets(rawLines);
  let title2;
  const entities = [];
  const entityMap = /* @__PURE__ */ new Map();
  const edges = [];
  const jurisdictions = [];
  const jurisdictionMap = /* @__PURE__ */ new Map();
  const clusters = [];
  let clusterCounter = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^entity-structure\b/i.test(line)) {
      const t = matchQuotedTitle(line);
      if (t !== void 0) title2 = t;
      continue;
    }
    const jurMatch = line.match(
      /^jurisdiction\s+([A-Za-z]{2,3})\s+"([^"]*)"(?:\s*\[([^\]]*)\])?\s*$/i
    );
    if (jurMatch) {
      const code = jurMatch[1].toUpperCase();
      const name = jurMatch[2];
      const props = jurMatch[3] ? parseProps(jurMatch[3]) : {};
      const def = { code, name };
      if (props.color) def.color = stripQuotes(props.color);
      jurisdictions.push(def);
      jurisdictionMap.set(code, def);
      continue;
    }
    const clusterMatch = line.match(
      /^cluster\s+"([^"]*)"(?:\s*\[((?:[^\][]|\[[^\]]*\])*)\])?\s*$/i
    );
    if (clusterMatch) {
      const label = clusterMatch[1];
      const props = clusterMatch[2] ? parseProps(clusterMatch[2]) : {};
      const def = {
        id: `cluster-${++clusterCounter}`,
        label,
        members: props.members ? parseIdList(props.members) : []
      };
      if (props.color) def.color = stripQuotes(props.color);
      clusters.push(def);
      continue;
    }
    const entityMatch = line.match(
      /^entity\s+([A-Za-z][A-Za-z0-9_-]*)\s+"([^"]*)"\s+([a-zA-Z]+)(?:@([A-Za-z]{2,3}))?(?:\s*\[([^\]]*)\])?\s*$/
    );
    if (entityMatch) {
      const id = entityMatch[1];
      const name = entityMatch[2];
      const typeStr = entityMatch[3].toLowerCase();
      const jurisdictionCode = entityMatch[4]?.toUpperCase();
      const propsStr = entityMatch[5];
      const entityType = ENTITY_TYPE_ALIAS[typeStr];
      if (!entityType) {
        throw new EntityParseError(`Unknown entity type "${typeStr}" for "${id}"`);
      }
      if (entityMap.has(id)) {
        throw new EntityParseError(`Duplicate entity id "${id}"`);
      }
      const node = { id, name, entityType };
      if (jurisdictionCode) node.jurisdiction = jurisdictionCode;
      if (propsStr) {
        const props = parseProps(propsStr);
        if (props.status) node.status = stripQuotes(props.status);
        if (props.tax) node.taxClass = stripQuotes(props.tax);
        if (props.role) node.role = stripQuotes(props.role);
        if (props.note) node.note = stripQuotes(props.note);
        if (props.est) node.formationDate = stripQuotes(props.est);
        const reserved = /* @__PURE__ */ new Set(["status", "tax", "role", "note", "est"]);
        const extras = {};
        for (const k of Object.keys(props)) {
          if (!reserved.has(k)) extras[k] = stripQuotes(props[k]);
        }
        if (Object.keys(extras).length) node.properties = extras;
      }
      entities.push(node);
      entityMap.set(id, node);
      continue;
    }
    const edgeInfo = matchEdgeOp(line);
    if (edgeInfo) {
      const left = line.slice(0, edgeInfo.idx).trim();
      const rest = line.slice(edgeInfo.idx + edgeInfo.len).trim();
      if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(left)) {
        throw new EntityParseError(`Invalid edge source on line: ${line}`);
      }
      const restMatch = rest.match(
        /^([A-Za-z][A-Za-z0-9_-]*)(?:\s*:\s*([^[]+?))?(?:\s*\[([^\]]*)\])?\s*$/
      );
      if (!restMatch) {
        throw new EntityParseError(`Cannot parse edge: ${line}`);
      }
      const to = restMatch[1];
      const pct = restMatch[2]?.trim();
      const propsStr = restMatch[3];
      const edge = { from: left, to, op: edgeInfo.op };
      if (pct) edge.percentage = pct;
      if (propsStr) {
        const props = parseProps(propsStr);
        if (props.class) edge.shareClass = stripQuotes(props.class);
        if (props.label) edge.label = stripQuotes(props.label);
      }
      edges.push(edge);
      continue;
    }
    throw new EntityParseError(`Cannot parse line: ${line}`);
  }
  for (const e of edges) {
    if (!entityMap.has(e.from)) {
      throw new EntityParseError(`Edge references unknown entity "${e.from}"`);
    }
    if (!entityMap.has(e.to)) {
      throw new EntityParseError(`Edge references unknown entity "${e.to}"`);
    }
  }
  if (entities.length === 0) {
    throw new EntityParseError("Entity structure diagram has no entities");
  }
  return {
    type: "entity",
    title: title2,
    entities,
    edges,
    jurisdictions,
    clusters
  };
}

// src/diagrams/entity/layout.ts
var TIER_GAP = 170;
var H_GAP = 70;
var PADDING = 40;
var CLUSTER_PADDING = 26;
var CLUSTER_V_GAP = 16;
function geometryFor(type) {
  switch (type) {
    case "trust":
      return { width: 200, height: 80 };
    // ellipse bbox
    case "individual":
      return { width: 80, height: 80 };
    // circle bbox; label rendered below
    case "foundation":
      return { width: 150, height: 80 };
    case "pool":
    case "disregarded":
    case "placeholder":
    case "corp":
    case "llc":
    case "lp":
    default:
      return { width: 170, height: 62 };
  }
}
function computeTiers(ast) {
  const inEdges = /* @__PURE__ */ new Map();
  const outEdges = /* @__PURE__ */ new Map();
  for (const n of ast.entities) {
    inEdges.set(n.id, []);
    outEdges.set(n.id, []);
  }
  for (const e of ast.edges) {
    inEdges.get(e.to)?.push(e);
    outEdges.get(e.from)?.push(e);
  }
  const isHierarchy = (e) => e.op === "ownership" || e.op === "voting" || e.op === "pool";
  const tiers = /* @__PURE__ */ new Map();
  for (const n of ast.entities) {
    const hierIn = (inEdges.get(n.id) ?? []).filter(isHierarchy);
    if (hierIn.length === 0) tiers.set(n.id, 0);
  }
  const maxIter = ast.entities.length + 4;
  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    for (const e of ast.edges) {
      if (!isHierarchy(e)) continue;
      const fromT = tiers.get(e.from);
      if (fromT === void 0) continue;
      const want = fromT + 1;
      const cur = tiers.get(e.to);
      if (cur === void 0 || want > cur) {
        tiers.set(e.to, want);
        changed = true;
      }
    }
    if (!changed) break;
  }
  for (const e of ast.edges) {
    if (isHierarchy(e)) continue;
    if (!tiers.has(e.to)) {
      const src = tiers.get(e.from);
      if (src !== void 0) tiers.set(e.to, src);
    }
    if (!tiers.has(e.from)) {
      const dst = tiers.get(e.to);
      if (dst !== void 0) tiers.set(e.from, dst);
    }
  }
  for (const n of ast.entities) {
    if (!tiers.has(n.id)) tiers.set(n.id, 0);
  }
  return tiers;
}
function layoutEntity(ast) {
  const tiers = computeTiers(ast);
  const maxTier = Math.max(0, ...Array.from(tiers.values()));
  const byTier = /* @__PURE__ */ new Map();
  for (const n of ast.entities) {
    const t = tiers.get(n.id) ?? 0;
    if (!byTier.has(t)) byTier.set(t, []);
    byTier.get(t).push(n);
  }
  const layoutNodes = [];
  const byId = /* @__PURE__ */ new Map();
  for (const n of ast.entities) {
    const g = geometryFor(n.entityType);
    const t = tiers.get(n.id) ?? 0;
    const ln = {
      node: n,
      x: 0,
      y: PADDING + t * TIER_GAP + g.height / 2,
      tier: t,
      width: g.width,
      height: g.height,
      topY: 0,
      bottomY: 0
    };
    ln.topY = ln.y - g.height / 2;
    ln.bottomY = ln.y + g.height / 2;
    layoutNodes.push(ln);
    byId.set(n.id, ln);
  }
  for (let t = 0; t <= maxTier; t++) {
    const nodes = byTier.get(t) ?? [];
    let cx = PADDING;
    for (const n of nodes) {
      const ln = byId.get(n.id);
      cx += ln.width / 2;
      ln.x = cx;
      cx += ln.width / 2 + H_GAP;
    }
  }
  const children = /* @__PURE__ */ new Map();
  const parents = /* @__PURE__ */ new Map();
  for (const n of ast.entities) {
    children.set(n.id, []);
    parents.set(n.id, []);
  }
  for (const e of ast.edges) {
    if (e.op === "ownership" || e.op === "voting" || e.op === "pool") {
      children.get(e.from)?.push(e.to);
      parents.get(e.to)?.push(e.from);
    }
  }
  for (let iter = 0; iter < 4; iter++) {
    for (let t = maxTier - 1; t >= 0; t--) {
      const tierNodes = byTier.get(t) ?? [];
      for (const n of tierNodes) {
        const ln = byId.get(n.id);
        const childIds = children.get(n.id) ?? [];
        if (childIds.length === 0) continue;
        if (childIds.length === 1) {
          const child = byId.get(childIds[0]);
          if (!child) continue;
          const siblingParents = (parents.get(child.node.id) ?? []).map((pid) => byId.get(pid)).filter((p) => !!p && p.tier === t);
          if (siblingParents.length > 1) {
            siblingParents.sort(
              (a, b) => (byTier.get(t) ?? []).indexOf(a.node) - (byTier.get(t) ?? []).indexOf(b.node)
            );
            const totalWidth = siblingParents.reduce(
              (sum, p) => sum + effectiveHalfWidth(p) * 2,
              0
            );
            const spread = Math.max(
              H_GAP + (effectiveHalfWidth(ln) + effectiveHalfWidth(siblingParents[0])) / 1,
              totalWidth / Math.max(1, siblingParents.length - 1)
            );
            const idx = siblingParents.indexOf(ln);
            const n2 = siblingParents.length;
            ln.x = child.x + (idx - (n2 - 1) / 2) * spread;
          } else {
            ln.x = child.x;
          }
          continue;
        }
        const xs = childIds.map((c) => byId.get(c)?.x).filter((v) => v !== void 0);
        if (xs.length > 0) {
          ln.x = (Math.min(...xs) + Math.max(...xs)) / 2;
        }
      }
    }
    for (let t = 1; t <= maxTier; t++) {
      const tierNodes = byTier.get(t) ?? [];
      for (const n of tierNodes) {
        const ln = byId.get(n.id);
        const parentIds = parents.get(n.id) ?? [];
        if (parentIds.length < 2) continue;
        const xs = parentIds.map((p) => byId.get(p)?.x).filter((v) => v !== void 0);
        if (xs.length > 0) {
          ln.x = (Math.min(...xs) + Math.max(...xs)) / 2;
        }
      }
    }
    for (let t = 0; t <= maxTier; t++) {
      const tierNodes = (byTier.get(t) ?? []).map((n) => byId.get(n.id)).sort((a, b) => a.x - b.x);
      for (let i = 1; i < tierNodes.length; i++) {
        const prev = tierNodes[i - 1];
        const cur = tierNodes[i];
        const gap = effectiveHalfWidth(prev) + effectiveHalfWidth(cur) + H_GAP;
        if (cur.x - prev.x < gap) cur.x = prev.x + gap;
      }
    }
  }
  let minLeft = Infinity;
  for (const ln of layoutNodes) {
    const left = ln.x - ln.width / 2;
    if (left < minLeft) minLeft = left;
  }
  const shift = PADDING - minLeft;
  if (Math.abs(shift) > 0.5) {
    for (const ln of layoutNodes) ln.x += shift;
  }
  const edges = [];
  for (const e of ast.edges) {
    const from = byId.get(e.from);
    const to = byId.get(e.to);
    if (!from || !to) continue;
    const sameTier = from.tier === to.tier;
    let path2;
    let labelX;
    let labelY;
    if (sameTier) {
      const leftFirst = from.x < to.x;
      const sx = leftFirst ? from.x + from.width / 2 : from.x - from.width / 2;
      const ex = leftFirst ? to.x - to.width / 2 : to.x + to.width / 2;
      path2 = `M ${sx} ${from.y} L ${ex} ${to.y}`;
      labelX = (sx + ex) / 2;
      labelY = from.y - 6;
    } else {
      const sx = from.x;
      const sy = from.bottomY;
      const ex = to.x;
      const ey = to.topY;
      const straight = Math.abs(sx - ex) < 0.5;
      if (straight) {
        path2 = `M ${sx} ${sy} L ${ex} ${ey}`;
        labelX = sx;
        labelY = (sy + ey) / 2;
      } else {
        const midY = (sy + ey) / 2;
        path2 = `M ${sx} ${sy} L ${sx} ${midY} L ${ex} ${midY} L ${ex} ${ey}`;
        const isHier = e.op === "ownership" || e.op === "voting" || e.op === "pool";
        const parentCount = isHier ? (parents.get(e.to) ?? []).length : 0;
        const fanIn = parentCount > 1;
        if (fanIn) {
          labelX = sx;
          labelY = midY;
        } else {
          labelX = ex;
          labelY = midY;
        }
      }
    }
    edges.push({ edge: e, path: path2, labelX, labelY });
  }
  const layoutClusters = [];
  const usedIds = /* @__PURE__ */ new Set();
  const LABEL_ROW = 22;
  for (const c of ast.clusters) {
    const members = c.members.map((id) => byId.get(id)).filter((n) => !!n);
    if (members.length === 0) continue;
    const bounds = boundingBox(members);
    layoutClusters.push({
      id: c.id,
      label: c.label,
      color: c.color,
      x: bounds.minX - CLUSTER_PADDING,
      y: bounds.minY - CLUSTER_PADDING - LABEL_ROW,
      width: bounds.maxX - bounds.minX + CLUSTER_PADDING * 2,
      height: bounds.maxY - bounds.minY + CLUSTER_PADDING * 2 + LABEL_ROW
    });
    for (const m of members) usedIds.add(m.node.id);
  }
  for (const j of ast.jurisdictions) {
    const members = layoutNodes.filter(
      (n) => n.node.jurisdiction === j.code && !usedIds.has(n.node.id)
    );
    if (members.length === 0) continue;
    const bounds = boundingBox(members);
    layoutClusters.push({
      id: `jur-${j.code}`,
      label: j.name,
      color: j.color,
      x: bounds.minX - CLUSTER_PADDING,
      y: bounds.minY - CLUSTER_PADDING - LABEL_ROW,
      width: bounds.maxX - bounds.minX + CLUSTER_PADDING * 2,
      height: bounds.maxY - bounds.minY + CLUSTER_PADDING * 2 + LABEL_ROW
    });
    for (const m of members) usedIds.add(m.node.id);
  }
  for (let i = 0; i < layoutClusters.length; i++) {
    for (let k = i + 1; k < layoutClusters.length; k++) {
      const a = layoutClusters[i];
      const b = layoutClusters[k];
      const hOverlap = !(a.x + a.width < b.x || b.x + b.width < a.x);
      const vOverlap = !(a.y + a.height < b.y || b.y + b.height < a.y);
      if (!hOverlap || !vOverlap) continue;
      const [top, bot] = a.y < b.y ? [a, b] : [b, a];
      const want = bot.y - CLUSTER_V_GAP;
      if (top.y + top.height > want) top.height = Math.max(20, want - top.y);
    }
  }
  let maxX = 0;
  let maxY = 0;
  for (const ln of layoutNodes) {
    const right = ln.x + ln.width / 2;
    const bottom = ln.bottomY + 40;
    if (right > maxX) maxX = right;
    if (bottom > maxY) maxY = bottom;
  }
  for (const c of layoutClusters) {
    if (c.x + c.width > maxX) maxX = c.x + c.width;
    if (c.y + c.height > maxY) maxY = c.y + c.height;
  }
  const width = Math.max(400, maxX + PADDING);
  const height = Math.max(200, maxY + PADDING);
  return {
    width,
    height,
    nodes: layoutNodes,
    nodeById: byId,
    edges,
    clusters: layoutClusters
  };
}
function effectiveHalfWidth(ln) {
  const n = ln.node;
  const shapeHalf = ln.width / 2;
  const textLen = (s) => s ? s.length : 0;
  if (n.entityType === "individual") {
    const longest = Math.max(
      textLen(n.name),
      textLen(n.role),
      textLen(n.note)
    );
    const textHalf2 = longest * 6.2 / 2 + 4;
    return Math.max(shapeHalf, textHalf2);
  }
  const longestBelow = Math.max(textLen(n.note), textLen(n.role));
  const textHalf = longestBelow * 6 / 2 + 4;
  return Math.max(shapeHalf, textHalf);
}
function boundingBox(nodes) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x - n.width / 2);
    maxX = Math.max(maxX, n.x + n.width / 2);
    minY = Math.min(minY, n.topY);
    maxY = Math.max(maxY, n.bottomY + 26);
  }
  return { minX, maxX, minY, maxY };
}

// src/diagrams/entity/renderer.ts
function buildCss(t) {
  return `
.lt-entity { font-family: system-ui, -apple-system, sans-serif; }
.lt-entity-title { font: bold 16px sans-serif; fill: ${t.text}; }
.lt-entity-name { font: 600 12px sans-serif; fill: ${t.text}; text-anchor: middle; }
.lt-entity-type { font: 500 10px sans-serif; fill: ${t.textMuted}; text-anchor: middle; }
.lt-entity-role { font: italic 10px sans-serif; fill: ${t.textMuted}; text-anchor: middle; }
.lt-entity-note { font: 10px sans-serif; fill: ${t.textMuted}; text-anchor: middle; }
.lt-entity-badge-bg { fill: ${t.bg}; stroke: ${t.neutral}; stroke-width: 1; }
.lt-entity-badge-text { font: 600 9px sans-serif; fill: ${t.text}; text-anchor: middle; letter-spacing: 0.5px; }
.lt-entity-edge { stroke: ${t.stroke}; stroke-width: 1.5; fill: none; }
.lt-entity-edge-voting { stroke: ${t.stroke}; stroke-width: 1.2; fill: none; }
.lt-entity-edge-pool { stroke: ${t.neutral}; stroke-width: 1.5; fill: none; stroke-dasharray: 5,4; }
.lt-entity-edge-license { stroke: ${t.palette[3]}; stroke-width: 1.5; fill: none; stroke-dasharray: 5,4; }
.lt-entity-edge-distribution { stroke: ${t.positive}; stroke-width: 1.5; fill: none; stroke-dasharray: 5,4; }
.lt-entity-edge-voting-pref { stroke: ${t.accent}; stroke-width: 1.8; fill: none; }
.lt-entity-label-bg { fill: ${t.bg}; stroke: ${t.neutral}; stroke-width: 1; }
.lt-entity-label { font: 600 10px sans-serif; fill: ${t.text}; text-anchor: middle; }
.lt-entity-label-sub { font: 500 9px sans-serif; fill: ${t.textMuted}; text-anchor: middle; }
.lt-entity-cluster { fill: none; stroke-dasharray: 6,4; stroke-width: 1.2; }
.lt-entity-cluster-label-bg { fill: ${t.bg}; }
.lt-entity-cluster-label { font: 600 11px sans-serif; letter-spacing: 0.5px; }
.lt-entity-status-new { stroke: ${t.positive}; stroke-width: 2.2; }
.lt-entity-status-eliminated { stroke: ${t.negative}; stroke-width: 2.2; }
.lt-entity-status-modified { stroke: ${t.warn}; stroke-width: 2.2; }
.lt-entity-status-tag { font: 700 8px sans-serif; text-anchor: middle; letter-spacing: 0.5px; }
`.trim();
}
var FILL = {
  corp: "#dbeafe",
  llc: "#dcfce7",
  lp: "#fef9c3",
  trust: "#ede9fe",
  individual: "#fed7aa",
  foundation: "#fef9c3",
  disregarded: "#f5f5f5",
  pool: "#f1f5f9",
  placeholder: "#f9fafb"
};
var TYPE_LABEL = {
  corp: "Corporation",
  llc: "LLC",
  lp: "LP / Fund",
  trust: "Trust",
  individual: "Individual",
  foundation: "Foundation",
  disregarded: "Disregarded Entity",
  pool: "Reserved Pool",
  placeholder: "To Be Formed"
};
function statusClass(node) {
  switch (node.status) {
    case "new":
      return "lt-entity-status-new";
    case "eliminated":
      return "lt-entity-status-eliminated";
    case "modified":
      return "lt-entity-status-modified";
    default:
      return void 0;
  }
}
function renderShape(ln, t) {
  const n = ln.node;
  const fill = FILL[n.entityType] ?? t.bg;
  const sc = statusClass(n);
  const commonAttrs = {
    fill,
    stroke: t.stroke,
    "stroke-width": 1.4
  };
  if (sc) {
    commonAttrs.class = sc;
  }
  const dashed = n.entityType === "disregarded" || n.entityType === "placeholder" || n.entityType === "pool";
  const dashAttr = dashed ? { "stroke-dasharray": "5,3" } : {};
  const opacity = n.entityType === "placeholder" ? { opacity: 0.75 } : {};
  const x = -ln.width / 2;
  const y = -ln.height / 2;
  switch (n.entityType) {
    case "corp":
      return rect({
        x,
        y,
        width: ln.width,
        height: ln.height,
        rx: 0,
        ...commonAttrs,
        ...dashAttr
      });
    case "llc":
      return rect({
        x,
        y,
        width: ln.width,
        height: ln.height,
        rx: 10,
        ry: 10,
        ...commonAttrs
      });
    case "lp": {
      const w = ln.width;
      const h = ln.height;
      const notch = 12;
      const pts = [
        [x + notch, y],
        [x + w - notch, y],
        [x + w, y + notch],
        [x + w, y + h],
        [x, y + h],
        [x, y + notch]
      ].map((p) => p.join(",")).join(" ");
      return polygon({ points: pts, ...commonAttrs });
    }
    case "trust":
      return el("ellipse", {
        cx: 0,
        cy: 0,
        rx: ln.width / 2,
        ry: ln.height / 2,
        ...commonAttrs
      });
    case "individual":
      return circle({
        cx: 0,
        cy: 0,
        r: Math.min(ln.width, ln.height) / 2 - 4,
        ...commonAttrs
      });
    case "foundation": {
      const w = ln.width;
      const h = ln.height;
      const tip = 14;
      const pts = [
        [x + w / 2, y - tip],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
        [x, y]
      ].map((p) => p.join(",")).join(" ");
      return polygon({ points: pts, ...commonAttrs });
    }
    case "disregarded":
      return rect({
        x,
        y,
        width: ln.width,
        height: ln.height,
        ...commonAttrs,
        ...dashAttr
      });
    case "pool":
      return rect({
        x,
        y,
        width: ln.width,
        height: ln.height,
        rx: 8,
        ry: 8,
        ...commonAttrs,
        ...dashAttr
      });
    case "placeholder":
      return rect({
        x,
        y,
        width: ln.width,
        height: ln.height,
        rx: 4,
        ry: 4,
        ...commonAttrs,
        ...dashAttr,
        ...opacity
      });
  }
}
function renderBadge(ln) {
  const j = ln.node.jurisdiction;
  if (!j) return void 0;
  const bw = j.length >= 3 ? 26 : 20;
  const bh = 13;
  const bx = ln.width / 2 - bw - 4;
  const by = -ln.height / 2 + 4;
  return group({}, [
    rect({ x: bx, y: by, width: bw, height: bh, rx: 2, class: "lt-entity-badge-bg" }),
    text(
      { x: bx + bw / 2, y: by + bh - 3, class: "lt-entity-badge-text" },
      j
    )
  ]);
}
function renderStatusTag(ln, t) {
  const n = ln.node;
  if (!n.status || n.status === "normal") return void 0;
  const map = {
    new: { label: "NEW", color: t.positive },
    eliminated: { label: "ELIMINATED", color: t.negative },
    modified: { label: "MODIFIED", color: t.warn }
  };
  const info = map[n.status];
  if (!info) return void 0;
  const w = info.label.length * 6 + 8;
  const h = 12;
  const x = -ln.width / 2 - 2;
  const y = -ln.height / 2 - h - 2;
  return group({}, [
    rect({ x, y, width: w, height: h, rx: 2, fill: info.color, stroke: "none" }),
    text(
      { x: x + w / 2, y: y + h - 3, class: "lt-entity-status-tag", fill: t.bg },
      info.label
    )
  ]);
}
function renderNodeLabels(ln) {
  const n = ln.node;
  const pieces = [];
  const isCircle = n.entityType === "individual";
  if (isCircle) {
    let y = ln.height / 2 + 14;
    pieces.push(text({ x: 0, y, class: "lt-entity-name" }, n.name));
    y += 13;
    if (n.role) {
      pieces.push(text({ x: 0, y, class: "lt-entity-role" }, n.role));
      y += 12;
    }
    if (n.note) {
      pieces.push(text({ x: 0, y, class: "lt-entity-note" }, n.note));
    }
    return pieces;
  }
  const topY = -6;
  pieces.push(text({ x: 0, y: topY, class: "lt-entity-name" }, n.name));
  pieces.push(text({ x: 0, y: topY + 14, class: "lt-entity-type" }, TYPE_LABEL[n.entityType] ?? n.entityType));
  let belowY = ln.height / 2 + 14;
  if (n.role) {
    pieces.push(text({ x: 0, y: belowY, class: "lt-entity-role" }, n.role));
    belowY += 12;
  }
  if (n.note) {
    pieces.push(text({ x: 0, y: belowY, class: "lt-entity-note" }, n.note));
    belowY += 12;
  }
  if (n.formationDate) {
    pieces.push(
      text({ x: 0, y: belowY, class: "lt-entity-note" }, `est. ${n.formationDate}`)
    );
  }
  return pieces;
}
function edgeClass(edge) {
  switch (edge.op) {
    case "pool":
      return "lt-entity-edge-pool";
    case "license":
      return "lt-entity-edge-license";
    case "distribution":
      return "lt-entity-edge-distribution";
    case "voting":
      return "lt-entity-edge-voting-pref";
    case "ownership":
    default:
      if (edge.shareClass && /pref|series/i.test(edge.shareClass)) {
        return "lt-entity-edge-voting-pref";
      }
      return "lt-entity-edge";
  }
}
function renderEdgeLabel(le) {
  const e = le.edge;
  const lines = [];
  if (e.percentage) lines.push(e.percentage);
  if (e.label) lines.push(e.label);
  const hasClass = !!e.shareClass;
  if (!lines.length && !hasClass) return void 0;
  const main = lines[0];
  const sub = lines[1];
  const classLabel = hasClass ? e.shareClass : void 0;
  const maxText = Math.max(
    main ? main.length : 0,
    sub ? sub.length : 0,
    classLabel ? classLabel.length : 0
  );
  const w = Math.max(30, maxText * 6 + 10);
  const rows = (main ? 1 : 0) + (sub ? 1 : 0) + (classLabel ? 1 : 0);
  const h = 4 + rows * 12;
  const x = le.labelX - w / 2;
  const y = le.labelY - h / 2;
  const pieces = [];
  pieces.push(rect({ x, y, width: w, height: h, rx: 3, class: "lt-entity-label-bg" }));
  let ty = y + 12;
  if (main) {
    pieces.push(text({ x: le.labelX, y: ty, class: "lt-entity-label" }, main));
    ty += 12;
  }
  if (sub) {
    pieces.push(text({ x: le.labelX, y: ty, class: "lt-entity-label-sub" }, sub));
    ty += 12;
  }
  if (classLabel) {
    pieces.push(text({ x: le.labelX, y: ty, class: "lt-entity-label-sub" }, classLabel));
  }
  return group({}, pieces);
}
function renderEntity(ast, config) {
  const layout = layoutEntity(ast);
  const t = resolveBaseTheme(config?.theme ?? "default");
  const titleOffset = ast.title ? 34 : 12;
  const width = Math.ceil(layout.width);
  const height = Math.ceil(layout.height + titleOffset);
  const children = [];
  children.push(title(ast.title ?? "Entity Structure Diagram"));
  children.push(
    desc(
      `Entity structure diagram with ${ast.entities.length} entities and ${ast.edges.length} relationships`
    )
  );
  children.push(el("style", {}, buildCss(t)));
  children.push(
    defs([
      arrowMarker("lt-entity-arrow", t.stroke),
      arrowMarker("lt-entity-arrow-purple", t.palette[3] ?? t.stroke),
      arrowMarker("lt-entity-arrow-green", t.positive),
      arrowMarker("lt-entity-arrow-grey", t.neutral),
      arrowMarker("lt-entity-arrow-blue", t.accent)
    ])
  );
  if (ast.title) {
    children.push(text({ x: width / 2, y: 22, class: "lt-entity-title", "text-anchor": "middle" }, ast.title));
  }
  const inner = [];
  for (const c of layout.clusters) {
    const color = c.color ?? t.neutral;
    inner.push(
      rect({
        x: c.x,
        y: c.y,
        width: c.width,
        height: c.height,
        rx: 8,
        stroke: color,
        class: "lt-entity-cluster"
      })
    );
    inner.push(
      text(
        { x: c.x + 12, y: c.y + 16, class: "lt-entity-cluster-label", fill: color },
        c.label
      )
    );
  }
  for (const le of layout.edges) {
    const cls = edgeClass(le.edge);
    const markerId = pickMarker(le.edge, cls);
    inner.push(
      path({
        d: le.path,
        class: cls,
        "marker-end": `url(#${markerId})`
      })
    );
  }
  for (const le of layout.edges) {
    const piece = renderEdgeLabel(le);
    if (piece) inner.push(piece);
  }
  for (const ln of layout.nodes) {
    const parts = [];
    parts.push(renderShape(ln, t));
    const badge = renderBadge(ln);
    if (badge) parts.push(badge);
    const status = renderStatusTag(ln, t);
    if (status) parts.push(status);
    for (const p of renderNodeLabels(ln)) parts.push(p);
    inner.push(
      group(
        {
          transform: `translate(${ln.x}, ${ln.y})`,
          "data-entity-id": ln.node.id,
          "data-entity-type": ln.node.entityType,
          "data-jurisdiction": ln.node.jurisdiction ?? ""
        },
        parts
      )
    );
  }
  const wrap = group({ transform: `translate(0, ${titleOffset})` }, inner);
  children.push(wrap);
  return svgRoot(
    {
      class: "lt-entity",
      role: "img",
      "aria-label": escapeXml(ast.title ?? "Entity structure diagram"),
      width,
      height,
      viewBox: `0 0 ${width} ${height}`
    },
    children
  );
}
function arrowMarker(id, color) {
  return el(
    "marker",
    {
      id,
      markerWidth: 9,
      markerHeight: 9,
      refX: 7,
      refY: 3,
      orient: "auto",
      markerUnits: "strokeWidth"
    },
    [el("path", { d: "M 0 0 L 7 3 L 0 6 z", fill: color })]
  );
}
function pickMarker(_edge, cls) {
  if (cls === "lt-entity-edge-license") return "lt-entity-arrow-purple";
  if (cls === "lt-entity-edge-distribution") return "lt-entity-arrow-green";
  if (cls === "lt-entity-edge-pool") return "lt-entity-arrow-grey";
  if (cls === "lt-entity-edge-voting-pref") return "lt-entity-arrow-blue";
  return "lt-entity-arrow";
}

// src/diagrams/entity/index.ts
var entity = {
  type: "entity",
  detect(text2) {
    const first = text2.trim().split("\n")[0]?.trim().toLowerCase() ?? "";
    return first.startsWith("entity-structure");
  },
  parse: parseEntityDSL,
  render(text2, config) {
    const ast = parseEntityDSL(text2);
    return renderEntity(ast, config);
  }
};

export { entity, layoutEntity, parseEntityDSL, renderEntity };
//# sourceMappingURL=chunk-5IJDNJUJ.js.map
//# sourceMappingURL=chunk-5IJDNJUJ.js.map