import { resolveSceneTitle } from './chunk-AVFHQLGW.js';
import { createSourceLocator, findFirstQuotedRange } from './chunk-KO55AXPI.js';
import { matchQuotedTitle } from './chunk-ISQCUPQR.js';
import { resolveBaseTheme, title, desc, el, text, path, group, rect, svgRoot, escapeXml, circle } from './chunk-ZUMTE4E7.js';

// src/diagrams/orgchart/parser.ts
var OrgchartParseError = class extends Error {
  constructor(message, line, column, source) {
    super(line !== void 0 ? `Line ${line}: ${message}` : message);
    this.line = line;
    this.column = column;
    this.source = source;
    this.name = "OrgchartParseError";
  }
  line;
  column;
  source;
};
var ROLE_ICONS = {
  ceo: "CEO",
  cto: "CTO",
  cfo: "CFO",
  coo: "COO",
  cmo: "CMO",
  cpo: "CPO",
  vp: "VP",
  engineer: "Engineer",
  engineering: "Engineer",
  designer: "Designer",
  design: "Designer",
  sales: "Sales",
  hr: "HR",
  legal: "Legal",
  ops: "Ops",
  operations: "Ops",
  marketing: "Marketing",
  product: "Product",
  data: "Data",
  advisor: "Advisor",
  intern: "Intern",
  vacant: "Vacant"
};
var NODE_KIND_KEYWORDS = /* @__PURE__ */ new Set([
  "person",
  "role",
  "open",
  "draft",
  "tbh",
  "advisor",
  "external"
]);
function stripComment(line) {
  let out = "";
  let inQuote = false;
  for (const ch of line) {
    if (ch === '"') inQuote = !inQuote;
    if ((ch === "#" || ch === "/" && out.endsWith("/")) && !inQuote) {
      if (ch === "/") return out.slice(0, -1);
      return out;
    }
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
  for (const ch of inside) {
    if (ch === '"') inQuote = !inQuote;
    if (ch === "," && !inQuote) {
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
    if (colon < 0) {
      out[s.toLowerCase()] = "true";
      continue;
    }
    const k = s.slice(0, colon).trim().toLowerCase();
    const v = s.slice(colon + 1).trim();
    out[k] = stripQuotes(v);
  }
  return out;
}
function tokenizeLines(text2) {
  const result = [];
  const split = text2.split("\n");
  let offset = 0;
  for (let i = 0; i < split.length; i++) {
    const raw = split[i] ?? "";
    const stripped = stripComment(raw.replace(/\r$/, ""));
    if (!stripped.trim()) {
      offset += raw.length + (i < split.length - 1 ? 1 : 0);
      continue;
    }
    const match = stripped.match(/^(\s*)(.*)$/);
    if (!match) {
      offset += raw.length + (i < split.length - 1 ? 1 : 0);
      continue;
    }
    const indent = match[1].replace(/\t/g, "  ").length;
    const content = match[2].trim();
    const contentStart = stripped.indexOf(content);
    result.push({ indent, text: content, line: i + 1, start: offset + contentStart });
    offset += raw.length + (i < split.length - 1 ? 1 : 0);
  }
  return result;
}
function parseNodeLine(line) {
  let kind = "person";
  let rest = line;
  let restStart = 0;
  const firstSp = line.indexOf(" ");
  if (firstSp > 0) {
    const first = line.slice(0, firstSp).toLowerCase();
    if (NODE_KIND_KEYWORDS.has(first)) {
      if (first === "role" || first === "open") kind = "role";
      else if (first === "draft" || first === "tbh") kind = "draft";
      else if (first === "advisor" || first === "external") kind = "advisor";
      else kind = "person";
      const afterKind = line.slice(firstSp + 1);
      const leading = afterKind.length - afterKind.trimStart().length;
      restStart = firstSp + 1 + leading;
      rest = afterKind.trim();
    }
  }
  const colonIdx = rest.indexOf(":");
  if (colonIdx < 0) return null;
  const id = rest.slice(0, colonIdx).trim();
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(id)) return null;
  const tailRaw = rest.slice(colonIdx + 1);
  const tailLeading = tailRaw.length - tailRaw.trimStart().length;
  let tail = tailRaw.trim();
  const tailStart = restStart + colonIdx + 1 + tailLeading;
  let props = {};
  const propsMatch = tail.match(/\[([^\]]*)\]\s*$/);
  if (propsMatch) {
    props = parseProps(propsMatch[1]);
    tail = tail.slice(0, tail.length - propsMatch[0].length).trim();
  }
  const fields = [];
  let cur = "";
  let inQuote = false;
  for (const ch of tail) {
    if (ch === '"') inQuote = !inQuote;
    if (ch === "|" && !inQuote) {
      fields.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) fields.push(cur.trim());
  const firstRaw = fields[0];
  let nameStart;
  let nameEnd;
  if (firstRaw) {
    const firstAt = tail.indexOf(firstRaw);
    if (firstAt >= 0) {
      nameStart = tailStart + firstAt;
      nameEnd = nameStart + firstRaw.length;
    }
  }
  if (fields.length > 0) fields[0] = stripQuotes(fields[0]);
  return { kind, id, fields, props, nameStart, nameEnd };
}
function resolveRole(raw) {
  if (!raw) return void 0;
  const key = raw.trim().toLowerCase();
  return ROLE_ICONS[key];
}
var EDGE_OPS = [
  { token: "-.->", kind: "matrix" },
  { token: "->", kind: "report" }
];
function findEdgeToken(line, token) {
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuote = !inQuote;
    if (!inQuote && line.startsWith(token, i)) return i;
  }
  return -1;
}
function parseOrgchart(text2) {
  const rawLines = tokenizeLines(text2);
  const locator = createSourceLocator(text2);
  let title2;
  let titleSourceRange;
  let direction = "TD";
  let layout = "tree";
  const nodes = [];
  const nodeMap = /* @__PURE__ */ new Map();
  const edges = [];
  const indentStack = [];
  const unparseableLines = [];
  const duplicateIds = [];
  const impliedNodes = [];
  for (const rl of rawLines) {
    const line = rl.text;
    if (/^orgchart\b/i.test(line)) {
      const t = matchQuotedTitle(line);
      if (t !== void 0) {
        title2 = t;
        const token = findFirstQuotedRange(line);
        if (token) titleSourceRange = locator.range(rl.start + token.start, rl.start + token.end);
      }
      continue;
    }
    if (/^config\b/i.test(line)) {
      const m = line.match(/^config\s*:\s*(\w+)\s*=\s*"?([^"\n]+?)"?\s*$/i);
      if (m) {
        const key = m[1].toLowerCase();
        const val = m[2].trim();
        if (key === "direction") {
          direction = val.toUpperCase() === "LR" ? "LR" : "TD";
        } else if (key === "layout") {
          const v = val.toLowerCase();
          if (v === "list" || v === "directory" || v === "compact") layout = "list";
          else layout = "tree";
        }
      }
      continue;
    }
    let edgeHandled = false;
    for (const { token, kind } of EDGE_OPS) {
      const idx = findEdgeToken(line, token);
      if (idx < 0) continue;
      const left = line.slice(0, idx).trim();
      let rest = line.slice(idx + token.length).trim();
      if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(left)) break;
      let props = {};
      const propsMatch = rest.match(/\[([^\]]*)\]\s*$/);
      if (propsMatch) {
        props = parseProps(propsMatch[1]);
        rest = rest.slice(0, rest.length - propsMatch[0].length).trim();
      }
      const to = rest.split(/\s+/)[0];
      if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(to)) break;
      const edge = { from: left, to, kind };
      if (props.label) edge.label = props.label;
      edges.push(edge);
      edgeHandled = true;
      break;
    }
    if (edgeHandled) continue;
    const parsed = parseNodeLine(line);
    if (!parsed) {
      unparseableLines.push({ line: rl.line, text: line });
      continue;
    }
    if (nodeMap.has(parsed.id)) {
      duplicateIds.push(parsed.id);
      continue;
    }
    const node = {
      id: parsed.id,
      name: parsed.fields[0] ?? parsed.id,
      title: parsed.fields[1] || void 0,
      department: parsed.fields[2] || void 0,
      info: parsed.fields[3] || void 0,
      kind: parsed.kind,
      matrix: []
    };
    if (parsed.nameStart !== void 0 && parsed.nameEnd !== void 0) {
      node.nameSourceRange = locator.range(
        rl.start + parsed.nameStart,
        rl.start + parsed.nameEnd
      );
    }
    const p = parsed.props;
    if (p.role) node.role = resolveRole(p.role);
    if (p.icon) node.role = resolveRole(p.icon) ?? node.role;
    if (p.open === "true") {
      node.open = true;
      node.kind = "role";
    }
    if (p.draft === "true" || p.tbh === "true") {
      node.draft = true;
      node.kind = "draft";
    }
    if (p.external === "true") {
      node.external = true;
      if (node.kind === "person") node.kind = "advisor";
    }
    if (p["assistant-of"]) node.assistantOf = p["assistant-of"];
    if (p.reports) node.parent = p.reports;
    if (p.matrix) {
      node.matrix = p.matrix.split(/[\s,]+/).filter(Boolean);
    }
    if (p.department) node.department = p.department;
    if (p["avatar-color"] || p.avatarcolor) {
      node.avatarColor = p["avatar-color"] ?? p.avatarcolor;
    }
    if (p.gender) {
      const g = p.gender.toLowerCase();
      if (g === "male" || g === "m") node.gender = "male";
      else if (g === "female" || g === "f") node.gender = "female";
    }
    if (!node.info) {
      node.info = p.note ?? p.email ?? p.phone ?? p.location ?? void 0;
    }
    if (p.status) {
      const s = p.status.toLowerCase();
      if (s === "new" || s === "leaving" || s === "on-leave") node.status = s;
    }
    if (node.kind === "role" && node.open === void 0 && !p.draft) node.open = true;
    if (node.kind === "role" && !node.role) node.role = "Vacant";
    while (indentStack.length > 0 && indentStack[indentStack.length - 1].indent >= rl.indent) {
      indentStack.pop();
    }
    if (!node.parent && indentStack.length > 0) {
      node.parent = indentStack[indentStack.length - 1].id;
    }
    indentStack.push({ indent: rl.indent, id: node.id });
    for (const m of node.matrix) {
      edges.push({ from: m, to: node.id, kind: "matrix" });
    }
    nodes.push(node);
    nodeMap.set(node.id, node);
  }
  for (const n of nodes) {
    if (n.parent && !n.assistantOf) {
      const exists = edges.some(
        (e) => e.kind === "report" && e.from === n.parent && e.to === n.id
      );
      if (!exists) edges.push({ from: n.parent, to: n.id, kind: "report" });
    }
  }
  const ensureNode = (id) => {
    if (nodeMap.has(id)) return;
    const node = { id, name: id, kind: "person", matrix: [] };
    nodes.push(node);
    nodeMap.set(id, node);
    impliedNodes.push(id);
  };
  for (const e of edges) {
    ensureNode(e.from);
    ensureNode(e.to);
  }
  if (nodes.length === 0) {
    throw new OrgchartParseError(
      unparseableLines.length > 0 ? `Orgchart has no parseable nodes (${unparseableLines.length} line(s) could not be read)` : "Orgchart has no nodes"
    );
  }
  const ast = {
    type: "orgchart",
    title: title2,
    titleSourceRange,
    direction,
    layout,
    nodes,
    edges
  };
  if (unparseableLines.length || duplicateIds.length || impliedNodes.length) {
    ast.recovered = {
      ...unparseableLines.length ? { unparseableLines } : {},
      ...duplicateIds.length ? { duplicateIds } : {},
      ...impliedNodes.length ? { impliedNodes } : {}
    };
  }
  return ast;
}

// src/diagrams/orgchart/lint.ts
function lintOrgchart(text2) {
  let ast;
  try {
    ast = parseOrgchart(text2);
  } catch {
    return [];
  }
  const out = [];
  const rec = ast.recovered;
  if (!rec) return out;
  for (const { line, text: src } of rec.unparseableLines ?? []) {
    out.push({
      severity: "warning",
      code: "ORGCHART_UNPARSEABLE_LINE",
      message: `skipped a line that is neither a node nor an edge: "${src}"`,
      line,
      source: src,
      hint: 'A node is `id : "Name" | Title | Dept`; an edge is `parent -> child`. Check for a missing colon or a stray line.',
      fatal: false
    });
  }
  if (rec.duplicateIds?.length) {
    out.push({
      severity: "warning",
      code: "ORGCHART_DUPLICATE_ID",
      message: `kept the first declaration of duplicate node id(s): ${rec.duplicateIds.map((id) => `"${id}"`).join(", ")}`,
      hint: "Give each person/role a unique id; later redeclarations are dropped.",
      fatal: false
    });
  }
  if (rec.impliedNodes?.length) {
    out.push({
      severity: "warning",
      code: "ORGCHART_IMPLIED_NODE",
      message: `created node(s) from edges that were never declared: ${rec.impliedNodes.map((id) => `"${id}"`).join(", ")}`,
      hint: 'Declare each person/role explicitly (`id : "Name"`) so labels and roles render; bare ids fall back to the id as the name.',
      fatal: false
    });
  }
  return out;
}

// src/diagrams/orgchart/layout.ts
var CARD_W = 240;
var CARD_H = 76;
var TIER_GAP = 44;
var SIB_GAP = 20;
var PADDING = 30;
var ASSISTANT_GAP = 32;
function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = h * 31 + s.charCodeAt(i) | 0;
  }
  return Math.abs(h);
}
function hexToRgb(hex) {
  const h = hex.replace("#", "").padEnd(6, "0");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16)
  };
}
function rgbToHex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}
function tint(hex, weight) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(255 + (r - 255) * weight, 255 + (g - 255) * weight, 255 + (b - 255) * weight);
}
function shade(hex, weight) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r * (1 - weight), g * (1 - weight), b * (1 - weight));
}
function computeInitials(name) {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  if (/[^\x00-\x7F]/.test(trimmed[0])) {
    return Array.from(trimmed)[0];
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
function layoutOrgchart(ast, palette, pins) {
  const hasInfo = ast.nodes.some((n) => !!n.info);
  const cW = CARD_W;
  const cH = hasInfo ? 92 : CARD_H;
  const tierGap = TIER_GAP;
  const sibGap = SIB_GAP;
  const nodeById = /* @__PURE__ */ new Map();
  for (const n of ast.nodes) nodeById.set(n.id, n);
  const childrenMap = /* @__PURE__ */ new Map();
  const parentMap = /* @__PURE__ */ new Map();
  for (const n of ast.nodes) childrenMap.set(n.id, []);
  for (const e of ast.edges) {
    if (e.kind !== "report") continue;
    childrenMap.get(e.from)?.push(e.to);
    parentMap.set(e.to, e.from);
  }
  const roots = [];
  for (const n of ast.nodes) {
    if (!parentMap.has(n.id) && !n.assistantOf) roots.push(n);
  }
  const treeById = /* @__PURE__ */ new Map();
  for (const n of ast.nodes) {
    treeById.set(n.id, {
      id: n.id,
      node: n,
      children: [],
      assistants: [],
      subtreeWidth: 0,
      x: 0,
      y: 0
    });
  }
  for (const n of ast.nodes) {
    const t = treeById.get(n.id);
    for (const cid of childrenMap.get(n.id) ?? []) {
      const c = nodeById.get(cid);
      if (c.assistantOf === n.id) continue;
      t.children.push(treeById.get(cid));
    }
  }
  for (const n of ast.nodes) {
    if (n.assistantOf) {
      const parent = treeById.get(n.assistantOf);
      if (parent) parent.assistants.push(treeById.get(n.id));
    }
  }
  function computeWidth(t) {
    if (t.children.length === 0) {
      t.subtreeWidth = cW;
      return t.subtreeWidth;
    }
    let sum = 0;
    for (let i = 0; i < t.children.length; i++) {
      sum += computeWidth(t.children[i]);
      if (i < t.children.length - 1) sum += sibGap;
    }
    t.subtreeWidth = Math.max(cW, sum);
    return t.subtreeWidth;
  }
  function assign(t, leftX, depth) {
    const cx = leftX + t.subtreeWidth / 2;
    t.x = cx;
    t.y = PADDING + depth * (cH + tierGap);
    if (t.children.length > 0) {
      const childBlock = t.children.reduce(
        (s, c, i) => s + c.subtreeWidth + (i > 0 ? sibGap : 0),
        0
      );
      let childLeft = cx - childBlock / 2;
      for (const c of t.children) {
        assign(c, childLeft, depth + 1);
        childLeft += c.subtreeWidth + sibGap;
      }
    }
  }
  let curLeft = PADDING;
  for (const r of roots) {
    const rt = treeById.get(r.id);
    computeWidth(rt);
    assign(rt, curLeft, 0);
    curLeft += rt.subtreeWidth + sibGap * 2;
  }
  for (const [, t] of treeById) {
    for (let i = 0; i < t.assistants.length; i++) {
      const a = t.assistants[i];
      a.x = t.x + cW + ASSISTANT_GAP + i * (cW + sibGap);
      a.y = t.y + cH * 0.3;
    }
  }
  const deptIndex = /* @__PURE__ */ new Map();
  for (const n of ast.nodes) {
    if (n.department && !deptIndex.has(n.department)) {
      deptIndex.set(n.department, deptIndex.size);
    }
  }
  const nodes = [];
  for (const n of ast.nodes) {
    const t = treeById.get(n.id);
    const deptColor = n.department ? palette[(deptIndex.get(n.department) ?? 0) % palette.length] : void 0;
    const base = n.avatarColor ?? deptColor ?? palette[hashString(n.name) % palette.length];
    const avatarBg = tint(base, 0.14);
    const avatarFg = shade(base, 0.4);
    nodes.push({
      node: n,
      x: t.x,
      y: t.y,
      width: cW,
      height: cH,
      deptColor,
      avatarBg,
      avatarFg,
      initials: computeInitials(n.name)
    });
  }
  let minX = Infinity;
  for (const n of nodes) minX = Math.min(minX, n.x - n.width / 2);
  const shift = PADDING - minX;
  if (Math.abs(shift) > 0.5) {
    for (const n of nodes) n.x += shift;
  }
  for (const n of nodes) {
    const pin = pins?.get(n.node.id);
    if (pin) n.x = pin.x + n.width / 2;
  }
  const nodeLayoutById = /* @__PURE__ */ new Map();
  for (const n of nodes) nodeLayoutById.set(n.node.id, n);
  const layoutEdges = [];
  for (const e of ast.edges) {
    const from = nodeLayoutById.get(e.from);
    const to = nodeLayoutById.get(e.to);
    if (!from || !to) continue;
    if (e.kind === "report") {
      if (to.node.assistantOf === from.node.id) {
        const sx2 = from.x + from.width / 2;
        const sy2 = from.y + from.height / 2;
        const ex2 = to.x - to.width / 2;
        const ey2 = to.y + to.height / 2;
        layoutEdges.push({ edge: e, path: `M ${sx2} ${sy2} L ${ex2} ${ey2}` });
        continue;
      }
      const sx = from.x;
      const sy = from.y + from.height;
      const ex = to.x;
      const ey = to.y;
      const midY = (sy + ey) / 2;
      const path2 = Math.abs(sx - ex) < 0.5 ? `M ${sx} ${sy} L ${ex} ${ey}` : `M ${sx} ${sy} L ${sx} ${midY} L ${ex} ${midY} L ${ex} ${ey}`;
      layoutEdges.push({ edge: e, path: path2 });
    } else {
      const sx = from.x;
      const sy = from.y + from.height / 2;
      const ex = to.x;
      const ey = to.y + to.height / 2;
      const midY = (sy + ey) / 2;
      const path2 = `M ${sx} ${sy} C ${sx} ${midY}, ${ex} ${midY}, ${ex} ${ey}`;
      const entry = { edge: e, path: path2 };
      if (e.label) {
        entry.labelX = (sx + ex) / 2;
        entry.labelY = midY;
      }
      layoutEdges.push(entry);
    }
  }
  let maxX = 0;
  let maxY = 0;
  for (const n of nodes) {
    maxX = Math.max(maxX, n.x + n.width / 2);
    maxY = Math.max(maxY, n.y + n.height);
  }
  const width = Math.max(400, maxX + PADDING);
  const height = Math.max(200, maxY + PADDING);
  return {
    width,
    height,
    nodes,
    edges: layoutEdges,
    title: ast.title,
    mode: "tree"
  };
}
var LIST_ROW_H = 32;
var LIST_INDENT = 22;
var LIST_PAD = 20;
var LIST_PANEL_W = 820;
var LIST_GUIDE_X0 = 32;
function layoutOrgchartList(ast, palette) {
  const nodeById = /* @__PURE__ */ new Map();
  for (const n of ast.nodes) nodeById.set(n.id, n);
  const childrenMap = /* @__PURE__ */ new Map();
  const parentMap = /* @__PURE__ */ new Map();
  for (const n of ast.nodes) childrenMap.set(n.id, []);
  for (const e of ast.edges) {
    if (e.kind !== "report") continue;
    childrenMap.get(e.from)?.push(e.to);
    parentMap.set(e.to, e.from);
  }
  const roots = [];
  for (const n of ast.nodes) {
    if (!parentMap.has(n.id) && !n.assistantOf) roots.push(n);
  }
  const subtreeSize = /* @__PURE__ */ new Map();
  function computeSize(id) {
    const cached = subtreeSize.get(id);
    if (cached !== void 0) return cached;
    const kids = childrenMap.get(id) ?? [];
    let s = kids.length;
    for (const k of kids) s += computeSize(k);
    subtreeSize.set(id, s);
    return s;
  }
  for (const n of ast.nodes) computeSize(n.id);
  const deptIndex = /* @__PURE__ */ new Map();
  for (const n of ast.nodes) {
    if (n.department && !deptIndex.has(n.department)) {
      deptIndex.set(n.department, deptIndex.size);
    }
  }
  const nodes = [];
  const guides = [];
  let rowIdx = 0;
  function visit(id, depth) {
    const n = nodeById.get(id);
    if (!n) return;
    const y = LIST_PAD + rowIdx * LIST_ROW_H;
    const x = LIST_GUIDE_X0 + depth * LIST_INDENT;
    const deptColor = n.department ? palette[(deptIndex.get(n.department) ?? 0) % palette.length] : void 0;
    const base = n.avatarColor ?? deptColor ?? palette[hashString(n.name) % palette.length];
    const kids = childrenMap.get(id) ?? [];
    const hasKids = kids.length > 0;
    nodes.push({
      node: n,
      x,
      y,
      width: LIST_PANEL_W - x - LIST_PAD,
      height: LIST_ROW_H,
      deptColor,
      avatarBg: tint(base, 0.14),
      avatarFg: shade(base, 0.4),
      initials: computeInitials(n.name),
      depth,
      subtreeSize: subtreeSize.get(id) ?? 0,
      hasChildren: hasKids
    });
    rowIdx++;
    for (const c of kids) visit(c, depth + 1);
  }
  for (const r of roots) visit(r.id, 0);
  for (let i = 0; i < nodes.length; i++) {
    const p = nodes[i];
    if (!p.hasChildren) continue;
    const pxLine = p.x + 10;
    const pyStart = p.y + LIST_ROW_H / 2 + 6;
    const directChildren = [];
    for (let j = i + 1; j < nodes.length; j++) {
      const q = nodes[j];
      if ((q.depth ?? 0) <= (p.depth ?? 0)) break;
      if ((q.depth ?? 0) === (p.depth ?? 0) + 1) directChildren.push(q);
    }
    if (directChildren.length === 0) continue;
    const lastChild = directChildren[directChildren.length - 1];
    const pyEnd = lastChild.y + LIST_ROW_H / 2;
    guides.push(`M ${pxLine} ${pyStart} L ${pxLine} ${pyEnd}`);
    for (const c of directChildren) {
      const tickY = c.y + LIST_ROW_H / 2;
      guides.push(`M ${pxLine} ${tickY} L ${c.x - 2} ${tickY}`);
    }
  }
  const height = LIST_PAD * 2 + rowIdx * LIST_ROW_H;
  return {
    width: LIST_PANEL_W,
    height,
    nodes,
    edges: [],
    title: ast.title,
    mode: "list",
    guides
  };
}

// src/diagrams/orgchart/renderer.ts
function buildCss(t) {
  return `
.lt-org { font-family: system-ui, -apple-system, sans-serif; }
.lt-org-title { font: 700 16px sans-serif; fill: ${t.text}; }
.lt-org-card { fill: ${t.bg}; stroke: ${t.neutral}; stroke-width: 1; }
.lt-org-card-vacant { fill: ${t.bg}; stroke: ${t.warn}; stroke-width: 1; stroke-dasharray: 4,3; }
.lt-org-card-draft { fill: ${t.bg}; stroke: ${t.neutral}; stroke-width: 1; stroke-dasharray: 4,3; opacity: 0.7; }
.lt-org-card-external { fill: ${t.bg}; stroke: ${t.neutral}; stroke-width: 1; stroke-dasharray: 4,3; }
.lt-org-name { font: 500 14px sans-serif; fill: ${t.text}; }
.lt-org-title-text { font: 400 12px sans-serif; fill: ${t.textMuted}; }
.lt-org-info { font: 400 11px sans-serif; fill: ${t.textMuted}; }
.lt-org-dept { font: 500 10px sans-serif; }
.lt-org-avatar-text { font: 600 13px sans-serif; text-anchor: middle; }
.lt-org-edge { stroke: ${t.stroke}; stroke-width: 1.4; fill: none; }
.lt-org-edge-matrix { stroke: ${t.neutral}; stroke-width: 1.2; stroke-dasharray: 4,3; fill: none; }
.lt-org-edge-label-bg { fill: ${t.bg}; stroke: ${t.neutral}; stroke-width: 1; }
.lt-org-edge-label { font: 500 10px sans-serif; fill: ${t.textMuted}; text-anchor: middle; }
.lt-org-pill-bg { fill: ${t.bg}; stroke-width: 1; }
.lt-org-pill { font: 600 9px sans-serif; text-anchor: middle; letter-spacing: 0.4px; }
.lt-org-panel { fill: ${t.bg}; stroke: ${t.neutral}; stroke-width: 1; }
.lt-org-guide { stroke: ${t.neutral}; stroke-width: 1; fill: none; }
.lt-org-caret { font: 400 9px sans-serif; fill: ${t.textMuted}; }
.lt-org-row-name { font: 500 13px sans-serif; fill: ${t.text}; }
.lt-org-row-title { font: 400 12px sans-serif; fill: ${t.textMuted}; }
.lt-org-row-avatar-text { font: 600 10px sans-serif; text-anchor: middle; }
.lt-org-row-count { font: 400 11px sans-serif; fill: ${t.textMuted}; text-anchor: end; }
.lt-org-row-dept { font: 500 10px sans-serif; text-anchor: middle; }
`.trim();
}
function renderGenderGlyph(gender, fg) {
  const f = `fill="${fg}"`;
  if (gender === "male") {
    return `<circle cx="0" cy="-7" r="5.5" ${f}/><path d="M -9 11 C -9 2 -5 0 0 0 C 5 0 9 2 9 11 Z" ${f}/>`;
  }
  return `<circle cx="0" cy="-7" r="5.5" ${f}/><path d="M -5 0 C -10 5 -11 10 -10 11 L 10 11 C 11 10 10 5 5 0 Z" ${f}/>`;
}
function renderRoleGlyph(role, fg) {
  const stroke = `stroke="${fg}" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  const fillWhite = `fill="${fg}"`;
  switch (role) {
    case "CEO":
    case "VP":
      return `<path d="M -10 4 L -10 -6 L -4 0 L 0 -8 L 4 0 L 10 -6 L 10 4 Z" ${fillWhite} stroke="none"/>`;
    case "CTO":
    case "Engineer":
      return `<circle r="6" ${stroke}/><circle r="2" ${fillWhite} stroke="none"/><g ${stroke}><line x1="0" y1="-9" x2="0" y2="-7"/><line x1="0" y1="9" x2="0" y2="7"/><line x1="-9" y1="0" x2="-7" y2="0"/><line x1="9" y1="0" x2="7" y2="0"/><line x1="-6.4" y1="-6.4" x2="-5" y2="-5"/><line x1="6.4" y1="-6.4" x2="5" y2="-5"/><line x1="-6.4" y1="6.4" x2="-5" y2="5"/><line x1="6.4" y1="6.4" x2="5" y2="5"/></g>`;
    case "CFO":
      return `<text x="0" y="6" text-anchor="middle" font-size="18" font-weight="700" fill="${fg}">$</text>`;
    case "COO":
    case "Ops":
      return `<g ${fillWhite}><circle cx="-6" cy="0" r="3" stroke="none"/><circle cx="6" cy="0" r="3" stroke="none"/><circle cx="0" cy="-5" r="3" stroke="none"/></g>`;
    case "CMO":
    case "Marketing":
      return `<path d="M -8 -4 L 2 -7 L 2 7 L -8 4 Z" ${fillWhite} stroke="none"/><path d="M 2 -4 L 8 -6 L 8 6 L 2 4 Z" ${fillWhite} stroke="none"/>`;
    case "CPO":
    case "Product":
      return `<path d="M 0 -8 C 5 -8 7 -4 7 0 C 7 3 4 4 4 6 L -4 6 C -4 4 -7 3 -7 0 C -7 -4 -5 -8 0 -8 Z" ${fillWhite} stroke="none"/><line x1="-3" y1="9" x2="3" y2="9" stroke="${fg}" stroke-width="1.5"/>`;
    case "Designer":
      return `<path d="M -7 7 L 7 -7 L 9 -5 L -5 9 Z" ${fillWhite} stroke="none"/>`;
    case "Sales":
      return `<rect x="-8" y="-4" width="16" height="10" rx="1" ${fillWhite} stroke="none"/><rect x="-4" y="-7" width="8" height="4" ${stroke}/>`;
    case "HR":
      return `<circle cx="-3" cy="-4" r="3" ${fillWhite} stroke="none"/><circle cx="4" cy="-3" r="2.5" ${fillWhite} stroke="none"/><path d="M -8 7 C -8 2 -2 2 -2 2 C -2 2 2 2 2 7 Z" ${fillWhite} stroke="none"/><path d="M 0 7 C 0 4 4 4 4 4 C 4 4 9 4 9 7 Z" ${fillWhite} stroke="none"/>`;
    case "Legal":
      return `<line x1="0" y1="-8" x2="0" y2="8" stroke="${fg}" stroke-width="1.6"/><line x1="-7" y1="-6" x2="7" y2="-6" stroke="${fg}" stroke-width="1.6"/><path d="M -9 0 L -5 -6 L -1 0 Z" ${fillWhite} stroke="none"/><path d="M 1 0 L 5 -6 L 9 0 Z" ${fillWhite} stroke="none"/>`;
    case "Data":
      return `<g ${fillWhite}><rect x="-8" y="0" width="4" height="7" stroke="none"/><rect x="-2" y="-4" width="4" height="11" stroke="none"/><rect x="4" y="-7" width="4" height="14" stroke="none"/></g>`;
    case "Advisor":
      return `<path d="M 0 -9 L 2.6 -2.7 L 9 -2 L 4 2.3 L 5.3 8.5 L 0 5 L -5.3 8.5 L -4 2.3 L -9 -2 L -2.6 -2.7 Z" ${fillWhite} stroke="none"/>`;
    case "Intern":
      return `<path d="M -10 -2 L 0 -7 L 10 -2 L 0 3 Z" ${fillWhite} stroke="none"/><path d="M -5 0 L -5 5 C -5 7 5 7 5 5 L 5 0" ${stroke}/>`;
    case "Vacant":
      return `<circle r="7" stroke="${fg}" stroke-width="1.4" fill="none" stroke-dasharray="3,2"/><text x="0" y="4" text-anchor="middle" font-size="12" font-weight="700" fill="${fg}">?</text>`;
    default:
      return "";
  }
}
function renderAvatar(ln) {
  const role = ln.node.role;
  const cx = -ln.width / 2 + 14 + 18;
  const cy = 0;
  const r = 18;
  const parts = [
    circle({ cx, cy, r, fill: ln.avatarBg, stroke: "none" })
  ];
  if (role && role !== "Vacant") {
    parts.push(
      group({ transform: `translate(${cx}, ${cy})` }, [
        renderRoleGlyph(role, ln.avatarFg)
      ])
    );
  } else if (ln.node.open) {
    parts.push(
      group({ transform: `translate(${cx}, ${cy})` }, [
        renderRoleGlyph("Vacant", ln.avatarFg)
      ])
    );
  } else if (ln.node.gender) {
    parts.push(
      group({ transform: `translate(${cx}, ${cy})` }, [
        renderGenderGlyph(ln.node.gender, ln.avatarFg)
      ])
    );
  } else {
    parts.push(
      text(
        { x: cx, y: cy + 5, class: "lt-org-avatar-text", fill: ln.avatarFg },
        ln.initials
      )
    );
  }
  return group({}, parts);
}
function renderCardBody(ln, t, scene, sceneOffsetY = 0) {
  const n = ln.node;
  const x = -ln.width / 2;
  const y = -ln.height / 2;
  let cardClass = "lt-org-card";
  if (n.open) cardClass = "lt-org-card-vacant";
  else if (n.draft) cardClass = "lt-org-card-draft";
  else if (n.external) cardClass = "lt-org-card-external";
  const parts = [];
  parts.push(
    rect({
      x,
      y,
      width: ln.width,
      height: ln.height,
      rx: 10,
      ry: 10,
      class: cardClass
    })
  );
  parts.push(renderAvatar(ln));
  const textX = x + 14 + 36 + 12;
  const hasTitle = !!n.title;
  const hasInfo = !!n.info;
  const displayName = n.open && !n.name ? "Open Role" : n.name;
  const lineCount = 1 + (hasTitle ? 1 : 0) + (hasInfo ? 1 : 0);
  const lineH = 16;
  const nameY = -(lineCount - 1) * lineH / 2;
  parts.push(text({
    x: textX,
    y: nameY,
    class: "lt-org-name",
    "data-sx-role": scene && n.nameSourceRange ? "label" : void 0
  }, displayName));
  if (hasTitle) {
    parts.push(text({ x: textX, y: nameY + lineH, class: "lt-org-title-text" }, n.title));
  }
  if (hasInfo) {
    parts.push(
      text(
        { x: textX, y: nameY + lineH * (hasTitle ? 2 : 1), class: "lt-org-info" },
        n.info
      )
    );
  }
  const pillLabel = n.open ? "HIRING" : n.status === "new" ? "NEW" : n.status === "leaving" ? "LEAVING" : n.status === "on-leave" ? "ON LEAVE" : void 0;
  if (pillLabel) {
    const pw = pillLabel.length * 5.8 + 10;
    const ph = 14;
    const px = ln.width / 2 - pw - 8;
    const py = y + 8;
    const pillFg = pillLabel === "HIRING" ? "#8a6d00" : pillLabel === "NEW" ? "#2b6a3a" : pillLabel === "LEAVING" ? "#8a3b1a" : t.textMuted;
    const pillBg = pillLabel === "HIRING" ? "#fef3c7" : pillLabel === "NEW" ? "#dcfce7" : pillLabel === "LEAVING" ? "#fee4d8" : "#eeeeea";
    parts.push(
      rect({ x: px, y: py, width: pw, height: ph, rx: 3, fill: pillBg, stroke: "none" })
    );
    parts.push(
      text(
        { x: px + pw / 2, y: py + ph - 4, class: "lt-org-pill", fill: pillFg },
        pillLabel
      )
    );
  }
  const key = `node:${n.id}`;
  scene?.push({
    key,
    kind: "node",
    semanticId: n.id,
    label: displayName,
    sourceRange: n.nameSourceRange,
    bbox: { x: ln.x - ln.width / 2, y: ln.y + sceneOffsetY, width: ln.width, height: ln.height },
    editable: { label: n.nameSourceRange !== void 0, position: "move-x" }
  });
  return group(
    {
      transform: `translate(${ln.x}, ${ln.y + ln.height / 2})`,
      "data-person-id": n.id,
      "data-department": n.department ?? "",
      "data-role": n.role ?? "",
      "data-sx-key": scene ? key : void 0
    },
    parts
  );
}
function renderListRow(ln, scene, sceneOffsetY = 0) {
  const n = ln.node;
  const rowCenterY = ln.y + ln.height / 2;
  const caretX = ln.x;
  const avatarCx = ln.x + 20;
  const avatarR = 11;
  const parts = [];
  const caret = ln.hasChildren ? "\u25BC" : "\xB7";
  parts.push(
    text(
      { x: caretX, y: rowCenterY + 3, class: "lt-org-caret" },
      caret
    )
  );
  parts.push(circle({ cx: avatarCx, cy: rowCenterY, r: avatarR, fill: ln.avatarBg, stroke: "none" }));
  if (n.role && n.role !== "Vacant") {
    parts.push(
      group({ transform: `translate(${avatarCx}, ${rowCenterY}) scale(0.58)` }, [
        renderRoleGlyph(n.role, ln.avatarFg)
      ])
    );
  } else if (n.open) {
    parts.push(
      group({ transform: `translate(${avatarCx}, ${rowCenterY}) scale(0.58)` }, [
        renderRoleGlyph("Vacant", ln.avatarFg)
      ])
    );
  } else if (n.gender) {
    parts.push(
      group({ transform: `translate(${avatarCx}, ${rowCenterY}) scale(0.56)` }, [
        renderGenderGlyph(n.gender, ln.avatarFg)
      ])
    );
  } else {
    parts.push(
      text(
        {
          x: avatarCx,
          y: rowCenterY + 3,
          class: "lt-org-row-avatar-text",
          fill: ln.avatarFg
        },
        ln.initials
      )
    );
  }
  const textY = rowCenterY + 4;
  const nameX = avatarCx + avatarR + 10;
  const displayName = n.open && !n.name ? "Open Role" : n.name;
  parts.push(text({
    x: nameX,
    y: textY,
    class: "lt-org-row-name",
    "data-sx-role": scene && n.nameSourceRange ? "label" : void 0
  }, displayName));
  if (n.title) {
    const titleX = nameX + Math.max(80, displayName.length * 8 + 10);
    parts.push(text({ x: titleX, y: textY, class: "lt-org-row-title" }, n.title));
  }
  const rightEdge = ln.x + ln.width;
  let cursor = rightEdge;
  if (ln.subtreeSize && ln.subtreeSize > 0) {
    const countLabel = ln.depth === 0 ? `${ln.subtreeSize} reports` : `${ln.subtreeSize}`;
    parts.push(
      text(
        { x: cursor, y: textY, class: "lt-org-row-count" },
        countLabel
      )
    );
    cursor -= Math.max(30, countLabel.length * 6.5) + 12;
  }
  if (n.department) {
    const pw = n.department.length * 5.6 + 14;
    const ph = 16;
    const px = cursor - pw;
    const py = rowCenterY - ph / 2;
    parts.push(
      rect({ x: px, y: py, width: pw, height: ph, rx: 3, fill: ln.avatarBg, stroke: "none" })
    );
    parts.push(
      text(
        {
          x: px + pw / 2,
          y: textY,
          class: "lt-org-row-dept",
          fill: ln.avatarFg
        },
        n.department
      )
    );
  }
  const key = `node:${n.id}`;
  scene?.push({
    key,
    kind: "node",
    semanticId: n.id,
    label: displayName,
    sourceRange: n.nameSourceRange,
    bbox: { x: ln.x, y: ln.y + sceneOffsetY, width: ln.width, height: ln.height },
    editable: { label: n.nameSourceRange !== void 0, position: "none" }
  });
  return group({ "data-person-id": n.id, "data-sx-key": scene ? key : void 0 }, parts);
}
function renderOrgchartList(ast, layout, t, config) {
  const titleOffset = ast.title ? 42 : 16;
  const width = Math.ceil(layout.width);
  const height = Math.ceil(layout.height + titleOffset);
  const children = [];
  children.push(title(ast.title ?? "Organizational Directory"));
  children.push(
    desc(
      `Organizational directory with ${ast.nodes.length} people and ${ast.edges.length} reporting relationships`
    )
  );
  children.push(el("style", {}, buildCss(t)));
  const titleScene = ast.title ? resolveSceneTitle(ast.title, ast.titleSourceRange, width / 2, 24, config) : void 0;
  const titleNode = ast.title && titleScene ? text({ x: titleScene.x, y: titleScene.y, class: "lt-org-title", "text-anchor": "middle", ...titleScene.attrs }, ast.title) : "";
  if (titleNode && !config?.__scene) children.push(titleNode);
  const inner = [];
  for (const g of layout.guides ?? []) {
    inner.push(path({ d: g, class: "lt-org-guide" }));
  }
  for (const ln of layout.nodes) {
    inner.push(renderListRow(ln, config?.__scene, titleOffset));
  }
  children.push(group({ transform: `translate(0, ${titleOffset})` }, inner));
  if (titleNode && config?.__scene) children.push(titleNode);
  return svgRoot(
    {
      class: "lt-org",
      role: "img",
      "aria-label": escapeXml(ast.title ?? "Organizational directory"),
      width,
      height,
      viewBox: `0 0 ${width} ${height}`
    },
    children
  );
}
function renderOrgchart(ast, config) {
  const t = resolveBaseTheme(config?.theme ?? "default");
  if (ast.layout === "list") {
    return renderOrgchartList(ast, layoutOrgchartList(ast, t.palette), t, config);
  }
  const layout = layoutOrgchart(ast, t.palette, config?.__pins);
  const titleOffset = ast.title ? 36 : 10;
  const width = Math.ceil(layout.width);
  const height = Math.ceil(layout.height + titleOffset);
  const children = [];
  children.push(title(ast.title ?? "Organizational Chart"));
  children.push(
    desc(
      `Organizational chart with ${ast.nodes.length} people and ${ast.edges.length} relationships`
    )
  );
  children.push(el("style", {}, buildCss(t)));
  const titleScene = ast.title ? resolveSceneTitle(ast.title, ast.titleSourceRange, width / 2, 24, config) : void 0;
  const titleNode = ast.title && titleScene ? text({ x: titleScene.x, y: titleScene.y, class: "lt-org-title", "text-anchor": "middle", ...titleScene.attrs }, ast.title) : "";
  if (titleNode && !config?.__scene) children.push(titleNode);
  const inner = [];
  layout.edges.forEach((le, index) => {
    const cls = le.edge.kind === "matrix" ? "lt-org-edge-matrix" : "lt-org-edge";
    const key = `edge:${index}`;
    const edgePath = path({
      d: le.path,
      class: cls,
      "data-sx-live-edge": config?.__scene ? "true" : void 0
    });
    config?.__scene?.push({
      key,
      kind: "edge",
      path: le.path,
      editable: { label: false, position: "none" }
    });
    inner.push(config?.__scene ? group({
      "data-sx-key": key,
      "data-from": le.edge.from,
      "data-to": le.edge.to,
      "data-sx-live-explicit": "true",
      "data-sx-live-start": le.edge.from,
      "data-sx-live-end": le.edge.to,
      "data-sx-live-mode": "orthogonal",
      class: "lt-org-edge-g"
    }, [edgePath]) : edgePath);
  });
  for (const le of layout.edges) {
    if (le.edge.kind !== "matrix" || !le.edge.label || le.labelX === void 0) continue;
    const w = le.edge.label.length * 6 + 12;
    const h = 16;
    const x = (le.labelX ?? 0) - w / 2;
    const y = (le.labelY ?? 0) - h / 2;
    inner.push(
      rect({ x, y, width: w, height: h, rx: 3, class: "lt-org-edge-label-bg" })
    );
    inner.push(
      text(
        { x: le.labelX, y: (le.labelY ?? 0) + 4, class: "lt-org-edge-label" },
        le.edge.label
      )
    );
  }
  for (const ln of layout.nodes) {
    inner.push(renderCardBody(ln, t, config?.__scene, titleOffset));
  }
  children.push(group({ transform: `translate(0, ${titleOffset})` }, inner));
  if (titleNode && config?.__scene) children.push(titleNode);
  return svgRoot(
    {
      class: "lt-org",
      role: "img",
      "aria-label": escapeXml(ast.title ?? "Organizational chart"),
      width,
      height,
      viewBox: `0 0 ${width} ${height}`
    },
    children
  );
}

// src/diagrams/orgchart/index.ts
var orgchart = {
  type: "orgchart",
  capabilities: { scene: true, editablePosition: true },
  detect(text2) {
    return /^\s*orgchart\b/i.test(text2);
  },
  parse: parseOrgchart,
  lint: lintOrgchart,
  render(text2, config) {
    const ast = parseOrgchart(text2);
    return renderOrgchart(ast, config);
  }
};

export { OrgchartParseError, layoutOrgchart, lintOrgchart, orgchart, parseOrgchart, renderOrgchart };
//# sourceMappingURL=chunk-HHD67KEI.js.map
//# sourceMappingURL=chunk-HHD67KEI.js.map