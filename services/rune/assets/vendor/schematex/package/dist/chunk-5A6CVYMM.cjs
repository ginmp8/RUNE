'use strict';

var chunkEQMWWNB3_cjs = require('./chunk-EQMWWNB3.cjs');
var chunk54Q7JDQB_cjs = require('./chunk-54Q7JDQB.cjs');
var chunk7ZEDTSU3_cjs = require('./chunk-7ZEDTSU3.cjs');

// src/diagrams/siteplan/parser.ts
var SiteplanParseError = class extends Error {
  line;
  constructor(message, line2) {
    super(`line ${line2}: ${message}`);
    this.name = "SiteplanParseError";
    this.line = line2;
  }
};
var POLYGON_ROLES = ["parcel", "structure", "zone", "landscape", "parking"];
var PATH_ROLES = ["road", "driveway", "walkway", "trail"];
var LINE_ROLES = ["setback", "easement", "fence", "utility", "frontage", "dimension", "boundary"];
var MARKER_KINDS = ["tree", "car", "pin", "entry", "hydrant", "well"];
function normalizeQuotes(line2) {
  return line2.replace(/[“”「」『』]/g, '"').replace(/[‘’]/g, "'");
}
function stripComment(line2) {
  let quoted = false;
  for (let i = 0; i < line2.length; i++) {
    const ch = line2[i];
    if (ch === '"') quoted = !quoted;
    if (!quoted && ch === "#" && !/^#[0-9a-fA-F]{3,8}\b/.test(line2.slice(i))) return line2.slice(0, i);
  }
  return line2;
}
function tokenize(line2) {
  const out = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m;
  while (m = re.exec(line2)) {
    if (m[1] !== void 0) out.push({ str: m[1] });
    else out.push({ word: m[2] });
  }
  return out;
}
var isWord = (t, w) => t !== void 0 && "word" in t && (w === void 0 || t.word.toLowerCase() === w);
var isStr = (t) => t !== void 0 && "str" in t;
function tokenText(t) {
  return "word" in t ? t.word : t.str;
}
function shiftStringIfNext(tok) {
  const first = tok[0];
  if (!isStr(first)) return void 0;
  tok.shift();
  return first.str;
}
function parseNum(t, what, line2) {
  if (!isWord(t)) throw new SiteplanParseError(`expected a number for ${what}`, line2);
  const n = Number(t.word);
  if (!Number.isFinite(n)) throw new SiteplanParseError(`expected a number for ${what}, got "${t.word}"`, line2);
  return n;
}
function parsePointToken(t, what, line2) {
  if (!isWord(t)) throw new SiteplanParseError(`expected "x,y" for ${what}`, line2);
  const m = /^(-?\d*\.?\d+),(-?\d*\.?\d+)$/.exec(t.word);
  if (!m) throw new SiteplanParseError(`expected "x,y" for ${what}, got "${t.word}"`, line2);
  return { x: Number(m[1]), y: Number(m[2]) };
}
function parseDimsToken(t, what, line2) {
  if (!isWord(t)) throw new SiteplanParseError(`expected "WxH" for ${what}`, line2);
  const m = /^(\d*\.?\d+)[x×](\d*\.?\d+)$/i.exec(t.word);
  if (!m) throw new SiteplanParseError(`expected "WxH" for ${what}, got "${t.word}"`, line2);
  return { w: Number(m[1]), h: Number(m[2]) };
}
function parseId(t, what, line2) {
  if (!isWord(t)) throw new SiteplanParseError(`expected ${what}`, line2);
  return t.word;
}
function parsePoints(tok, line2, min = 2) {
  const points = [];
  while (tok.length && isWord(tok[0]) && /^-?\d*\.?\d+,-?\d*\.?\d+$/.test(tok[0].word)) {
    points.push(parsePointToken(tok.shift(), "points", line2));
  }
  if (points.length < min) {
    throw new SiteplanParseError(`expected at least ${min} point${min === 1 ? "" : "s"}`, line2);
  }
  return points;
}
function parseOptionalLabel(tok, obj) {
  const label = shiftStringIfNext(tok);
  if (label !== void 0) obj.label = label;
}
function parseHeader(tok, ast, line2) {
  while (tok.length) {
    const t = tok.shift();
    if (isStr(t)) ast.title = t.str;
    else if (isWord(t, "unit")) {
      const unit = parseId(tok.shift(), "unit (ft|m)", line2).toLowerCase();
      if (unit !== "ft" && unit !== "m") throw new SiteplanParseError(`unit must be "ft" or "m", got "${unit}"`, line2);
      ast.unit = unit;
    } else throw new SiteplanParseError(`siteplan: unexpected token "${tokenText(t)}"`, line2);
  }
}
function parsePolygon(role, tok, line2) {
  const poly = { role, id: parseId(tok.shift(), `${role} id`, line2), points: [], line: line2 };
  parseOptionalLabel(tok, poly);
  if (!isWord(tok.shift(), "points")) throw new SiteplanParseError(`${role}: expected "points"`, line2);
  poly.points = parsePoints(tok, line2, 3);
  while (tok.length) {
    const t = tok.shift();
    if (!isWord(t)) throw new SiteplanParseError(`${role}: unexpected string "${tokenText(t)}"`, line2);
    if (t.word === "fill") poly.fill = parseId(tok.shift(), "fill color", line2);
    else if (t.word === "label") {
      const label = shiftStringIfNext(tok);
      if (label !== void 0) poly.label = label;
      else throw new SiteplanParseError(`${role}: label expects a quoted string`, line2);
    } else throw new SiteplanParseError(`${role}: unexpected token "${t.word}"`, line2);
  }
  return poly;
}
function parsePath(role, tok, line2) {
  const path2 = { role, id: parseId(tok.shift(), `${role} id`, line2), points: [], width: role === "road" ? 20 : 8, line: line2 };
  parseOptionalLabel(tok, path2);
  const head = tok.shift();
  if (isWord(head, "from")) {
    path2.points = [parsePointToken(tok.shift(), "from", line2)];
    if (!isWord(tok.shift(), "to")) throw new SiteplanParseError(`${role}: expected "to"`, line2);
    path2.points.push(parsePointToken(tok.shift(), "to", line2));
  } else if (isWord(head, "points")) {
    path2.points = parsePoints(tok, line2, 2);
  } else throw new SiteplanParseError(`${role}: expected "from" or "points"`, line2);
  while (tok.length) {
    const t = tok.shift();
    if (!isWord(t)) throw new SiteplanParseError(`${role}: unexpected string "${tokenText(t)}"`, line2);
    if (t.word === "width") path2.width = parseNum(tok.shift(), "width", line2);
    else if (t.word === "label") {
      const label = shiftStringIfNext(tok);
      if (label !== void 0) path2.label = label;
      else throw new SiteplanParseError(`${role}: label expects a quoted string`, line2);
    } else throw new SiteplanParseError(`${role}: unexpected token "${t.word}"`, line2);
  }
  return path2;
}
function parseLine(role, tok, line2) {
  const ln = { role, id: parseId(tok.shift(), `${role} id`, line2), points: [], line: line2 };
  parseOptionalLabel(tok, ln);
  const head = tok.shift();
  if (isWord(head, "from")) {
    ln.points = [parsePointToken(tok.shift(), "from", line2)];
    if (!isWord(tok.shift(), "to")) throw new SiteplanParseError(`${role}: expected "to"`, line2);
    ln.points.push(parsePointToken(tok.shift(), "to", line2));
  } else if (isWord(head, "points")) {
    ln.points = parsePoints(tok, line2, 2);
  } else throw new SiteplanParseError(`${role}: expected "from" or "points"`, line2);
  while (tok.length) {
    const t = tok.shift();
    if (!isWord(t)) throw new SiteplanParseError(`${role}: unexpected string "${tokenText(t)}"`, line2);
    if (t.word === "label") {
      const label = shiftStringIfNext(tok);
      if (label !== void 0) ln.label = label;
      else throw new SiteplanParseError(`${role}: label expects a quoted string`, line2);
    } else throw new SiteplanParseError(`${role}: unexpected token "${t.word}"`, line2);
  }
  return ln;
}
function parseMarker(kind, tok, line2) {
  let id = `${kind}${line2}`;
  const first = tok[0];
  if (first && "word" in first && first.word.toLowerCase() !== "at") {
    tok.shift();
    id = first.word;
  }
  const marker = { kind, id, at: { x: 0, y: 0 }, size: kind === "car" ? 16 : 8, rotate: 0, line: line2 };
  parseOptionalLabel(tok, marker);
  while (tok.length) {
    const t = tok.shift();
    if (!isWord(t)) marker.label = tokenText(t);
    else if (t.word === "at") marker.at = parsePointToken(tok.shift(), "at", line2);
    else if (t.word === "size") {
      const next = tok.shift();
      if (isWord(next) && /[x×]/i.test(next.word)) {
        const d = parseDimsToken(next, "size", line2);
        marker.size = Math.max(d.w, d.h);
      } else marker.size = parseNum(next, "size", line2);
    } else if (t.word === "rotate") marker.rotate = parseNum(tok.shift(), "rotate", line2);
    else if (t.word === "label") {
      const label = shiftStringIfNext(tok);
      if (label !== void 0) marker.label = label;
      else throw new SiteplanParseError(`${kind}: label expects a quoted string`, line2);
    } else throw new SiteplanParseError(`${kind}: unexpected token "${t.word}"`, line2);
  }
  return marker;
}
function parseCallout(tok, line2) {
  const first = tok.shift();
  if (!isStr(first)) throw new SiteplanParseError(`callout: expected quoted label`, line2);
  if (!isWord(tok.shift(), "at")) throw new SiteplanParseError(`callout: expected "at"`, line2);
  const at = parsePointToken(tok.shift(), "at", line2);
  if (!isWord(tok.shift(), "to")) throw new SiteplanParseError(`callout: expected "to"`, line2);
  return { label: first.str, at, to: parsePointToken(tok.shift(), "to", line2), line: line2 };
}
function parseDimension(tok, line2) {
  let label = "";
  label = shiftStringIfNext(tok) ?? label;
  if (!isWord(tok.shift(), "from")) throw new SiteplanParseError(`dimension: expected "from"`, line2);
  const from = parsePointToken(tok.shift(), "from", line2);
  if (!isWord(tok.shift(), "to")) throw new SiteplanParseError(`dimension: expected "to"`, line2);
  const to = parsePointToken(tok.shift(), "to", line2);
  while (tok.length) {
    const t = tok.shift();
    if (isWord(t, "label")) {
      const next = shiftStringIfNext(tok);
      if (next !== void 0) label = next;
      else throw new SiteplanParseError(`dimension: label expects a quoted string`, line2);
    } else throw new SiteplanParseError(`dimension: unexpected token`, line2);
  }
  return { label, from, to, line: line2 };
}
function parseSiteplan(text2) {
  const ast = {
    type: "siteplan",
    title: "Site Plan",
    unit: "ft",
    legend: true,
    polygons: [],
    paths: [],
    lines: [],
    markers: [],
    callouts: [],
    dimensions: []
  };
  const lines = text2.split(/\r?\n/);
  const locator = chunk54Q7JDQB_cjs.createSourceLocator(text2);
  let absoluteStart = 0;
  let sawHeader = false;
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const original = lines[i] ?? "";
    const lineStart = absoluteStart;
    absoluteStart += original.length + (i < lines.length - 1 ? text2[lineStart + original.length] === "\r" ? 2 : 1 : 0);
    const raw = stripComment(normalizeQuotes(original)).trim();
    if (!raw) continue;
    const tok = tokenize(raw);
    const head = tok.shift();
    if (!isWord(head)) throw new SiteplanParseError(`unexpected string at line start`, lineNo);
    const keyword = head.word.toLowerCase();
    if (!sawHeader) {
      if (keyword !== "siteplan" && keyword !== "plotplan" && keyword !== "parcelmap" && keyword !== "propertymap") {
        throw new SiteplanParseError(`expected siteplan header`, lineNo);
      }
      const titleToken = /"[^"]*"/.exec(original);
      if (titleToken?.index !== void 0) {
        ast.titleSourceRange = locator.range(
          lineStart + titleToken.index,
          lineStart + titleToken.index + titleToken[0].length
        );
      }
      parseHeader(tok, ast, lineNo);
      sawHeader = true;
      continue;
    }
    if (POLYGON_ROLES.includes(keyword)) {
      const polygon2 = parsePolygon(keyword, tok, lineNo);
      polygon2.pointSourceRanges = coordinateRanges(original, lineStart, locator.range);
      ast.polygons.push(polygon2);
    } else if (PATH_ROLES.includes(keyword)) {
      const path2 = parsePath(keyword, tok, lineNo);
      path2.pointSourceRanges = coordinateRanges(original, lineStart, locator.range);
      ast.paths.push(path2);
    } else if (LINE_ROLES.includes(keyword)) {
      const line2 = parseLine(keyword, tok, lineNo);
      line2.pointSourceRanges = coordinateRanges(original, lineStart, locator.range);
      ast.lines.push(line2);
    } else if (MARKER_KINDS.includes(keyword)) {
      const marker = parseMarker(keyword, tok, lineNo);
      marker.atSourceRange = coordinateRanges(original, lineStart, locator.range)[0];
      ast.markers.push(marker);
    } else if (keyword === "callout") {
      const callout = parseCallout(tokenize(raw).slice(1), lineNo);
      [callout.atSourceRange, callout.toSourceRange] = coordinateRanges(original, lineStart, locator.range);
      ast.callouts.push(callout);
    } else if (keyword === "dim" || keyword === "measure") {
      const dimension = parseDimension(tok, lineNo);
      [dimension.fromSourceRange, dimension.toSourceRange] = coordinateRanges(original, lineStart, locator.range);
      ast.dimensions.push(dimension);
    } else if (keyword === "north") {
      ast.north = tok.length ? parseNum(tok.shift(), "north", lineNo) : 0;
    } else if (keyword === "scale") {
      ast.scale = parseNum(tok.shift(), "scale", lineNo);
    } else if (keyword === "legend") {
      const v = parseId(tok.shift(), "legend (on|off)", lineNo).toLowerCase();
      ast.legend = v !== "off";
    } else {
      throw new SiteplanParseError(`unknown siteplan keyword "${keyword}"`, lineNo);
    }
  }
  if (!sawHeader) throw new SiteplanParseError(`missing siteplan header`, 1);
  return ast;
}
function coordinateRanges(line2, lineStart, locate) {
  const ranges = [];
  const re = /-?\d*\.?\d+,-?\d*\.?\d+/g;
  let match;
  while (match = re.exec(line2)) {
    ranges.push(locate(lineStart + match.index, lineStart + match.index + match[0].length));
  }
  return ranges;
}

// src/diagrams/siteplan/layout.ts
var EMPTY_BOUNDS = { minX: 0, minY: 0, maxX: 100, maxY: 70 };
function includePoint(bounds, p, pad = 0) {
  bounds.minX = Math.min(bounds.minX, p.x - pad);
  bounds.minY = Math.min(bounds.minY, p.y - pad);
  bounds.maxX = Math.max(bounds.maxX, p.x + pad);
  bounds.maxY = Math.max(bounds.maxY, p.y + pad);
}
function polygonArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}
function legendItems(ast) {
  const seen = /* @__PURE__ */ new Set();
  const items = [];
  const add = (key, label) => {
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ key, label });
  };
  for (const p of ast.polygons) add(p.role, p.role === "parcel" ? "Parcel boundary" : p.role);
  for (const p of ast.paths) add(p.role, p.role);
  for (const l of ast.lines) add(l.role, l.role);
  for (const m of ast.markers) add(m.kind, m.kind);
  return items;
}
function layoutSiteplan(ast) {
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const warnings = [];
  for (const p of ast.polygons) {
    for (const pt of p.points) includePoint(bounds, pt);
    if (p.points.length >= 3 && polygonArea(p.points) < 1) {
      warnings.push(`${p.role} "${p.id}" has very small area \u2014 check point order or units`);
    }
  }
  for (const p of ast.paths) for (const pt of p.points) includePoint(bounds, pt, p.width / 2);
  for (const l of ast.lines) for (const pt of l.points) includePoint(bounds, pt, 2);
  for (const m of ast.markers) includePoint(bounds, m.at, m.size / 2);
  for (const c of ast.callouts) {
    includePoint(bounds, c.at, 8);
    includePoint(bounds, c.to);
  }
  for (const d of ast.dimensions) {
    includePoint(bounds, d.from, 5);
    includePoint(bounds, d.to, 5);
  }
  const finalBounds = Number.isFinite(bounds.minX) ? bounds : { ...EMPTY_BOUNDS };
  return {
    title: ast.title,
    titleSourceRange: ast.titleSourceRange,
    unit: ast.unit,
    north: ast.north,
    scale: ast.scale,
    legend: ast.legend,
    polygons: ast.polygons,
    paths: ast.paths,
    lines: ast.lines,
    markers: ast.markers,
    callouts: ast.callouts,
    dimensions: ast.dimensions,
    bounds: finalBounds,
    warnings,
    legendItems: legendItems(ast)
  };
}
function formatSiteLength(n, unit) {
  if (unit === "ft") return `${Math.round(n)} ft`;
  return `${Math.round(n * 10) / 10} m`;
}

// src/diagrams/siteplan/renderer.ts
var PAPER = "#ffffff";
var INK = "#111827";
var MUTED = "#5f6b7a";
var PLAN_LINE = "#1f2937";
var FAINT_LINE = "#d6dbe3";
var LEGEND_COLS = 1;
var LEGEND_LIMIT = 9;
var SIDE_PANEL_W = 188;
var SIDE_PANEL_GAP = 24;
var r2 = (n) => Math.round(n * 100) / 100;
function renderSiteplan(text2, config) {
  return renderSiteplanLayout(layoutSiteplan(parseSiteplan(text2)), config);
}
function polyPoints(points, sx, sy) {
  return points.map((p) => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ");
}
function pathD(points, sx, sy) {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(" ");
}
function centroid(points) {
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  return { x: x / points.length, y: y / points.length };
}
function renderSiteplanLayout(lay, config) {
  const fontFamily = config?.fontFamily ?? chunk7ZEDTSU3_cjs.DEFAULT_FONT_FAMILY;
  const pad = config?.padding ?? 28;
  const titleBand = lay.title ? 34 : 14;
  const hasPanel = lay.legend && lay.legendItems.length > 0 || lay.north !== void 0 || lay.scale !== void 0;
  const panelW = hasPanel ? SIDE_PANEL_W : 0;
  const panelGap = hasPanel ? SIDE_PANEL_GAP : 0;
  const targetW = 980;
  const targetH = 660;
  const spanX = Math.max(1, lay.bounds.maxX - lay.bounds.minX);
  const spanY = Math.max(1, lay.bounds.maxY - lay.bounds.minY);
  const drawingMaxW = targetW - pad * 2 - panelW - panelGap;
  const drawingMaxH = targetH - pad * 2 - titleBand;
  const scale = Math.min(drawingMaxW / spanX, drawingMaxH / spanY);
  const drawingW = spanX * scale;
  const drawingH = spanY * scale;
  const contentW = drawingW + panelW + panelGap;
  const width = Math.max(520, contentW + pad * 2);
  const height = Math.max(420, drawingH + pad * 2 + titleBand);
  const contentX = pad + Math.max(0, (width - pad * 2 - contentW) / 2);
  const plotY = titleBand + pad + Math.max(0, (height - titleBand - pad * 2 - drawingH) / 2);
  const panelX = contentX + drawingW + panelGap;
  const ox = contentX - lay.bounds.minX * scale;
  const oy = plotY - lay.bounds.minY * scale;
  const sx = (n) => ox + n * scale;
  const sy = (n) => oy + n * scale;
  const len = (n) => n * scale;
  const titleWidth = Math.max(48, lay.title.length * 9 + 10);
  const resolvedTitle = lay.title ? chunkEQMWWNB3_cjs.resolveSceneTitle(lay.title, lay.titleSourceRange, pad + titleWidth / 2, 26, config) : void 0;
  const style = chunk7ZEDTSU3_cjs.el(
    "style",
    {},
    `
.sx-sp-bg { fill: ${PAPER}; }
.sx-sp-sheet { fill: none; stroke: ${PLAN_LINE}; stroke-width: 1; }
.sx-sp-sheet-rule { stroke: ${FAINT_LINE}; stroke-width: 1; }
.sx-sp-title { fill: ${INK}; font-size: 15px; font-weight: ${chunk7ZEDTSU3_cjs.TITLE.weight}; letter-spacing: 0; }
.sx-sp-note { fill: ${MUTED}; font-size: 11px; }
.sx-sp-parcel { stroke: #111827; stroke-width: 2.2; }
.sx-sp-structure { stroke: #253041; stroke-width: 1.6; }
.sx-sp-roofline { fill: none; stroke: #9aa4b2; stroke-width: 0.75; }
.sx-sp-zone { stroke: #9aa4b2; stroke-width: 1; stroke-dasharray: 7 4; }
.sx-sp-landscape { stroke: #899481; stroke-width: 0.9; }
.sx-sp-parking { stroke: #8e99a8; stroke-width: 0.9; }
.sx-sp-road { fill: none; stroke: #f1f3f6; stroke-linecap: butt; stroke-linejoin: round; }
.sx-sp-road-center { fill: none; stroke: #9aa4b2; stroke-width: 0.9; stroke-linecap: butt; stroke-linejoin: round; }
.sx-sp-driveway-edge { fill: none; stroke: #aeb8c4; stroke-linecap: round; stroke-linejoin: round; }
.sx-sp-driveway { fill: none; stroke: #d8dde5; stroke-linecap: round; stroke-linejoin: round; }
.sx-sp-driveway-mark { fill: none; stroke: ${PAPER}; stroke-width: 1.15; stroke-linecap: butt; stroke-dasharray: 7 7; }
.sx-sp-driveway-arrow { fill: ${PAPER}; stroke: #8a94a3; stroke-width: 0.35; }
.sx-sp-walkway, .sx-sp-trail { fill: none; stroke: #d7d0c3; stroke-linecap: round; stroke-linejoin: round; }
.sx-sp-setback { fill: none; stroke: #6b7280; stroke-width: 1; stroke-dasharray: 8 5; }
.sx-sp-easement { fill: none; stroke: #6b7280; stroke-width: 1; stroke-dasharray: 2 5; }
.sx-sp-fence { fill: none; stroke: #344054; stroke-width: 1; stroke-dasharray: 8 3 1.5 3; }
.sx-sp-utility { fill: none; stroke: #2563eb; stroke-width: 1; stroke-dasharray: 2 5; }
.sx-sp-frontage { fill: none; stroke: #111827; stroke-width: 1.7; }
.sx-sp-boundary { fill: none; stroke: #111827; stroke-width: 1.8; }
.sx-sp-dim { fill: none; stroke: #475467; stroke-width: 0.9; }
.sx-sp-callout { fill: none; stroke: #344054; stroke-width: 0.9; marker-end: url(#sx-sp-arrow); }
.sx-sp-label { fill: ${INK}; font-size: 10.2px; font-weight: 600; paint-order: stroke; stroke: ${PAPER}; stroke-width: 3.4px; stroke-linejoin: round; }
.sx-sp-small { fill: ${INK}; font-size: 8.8px; paint-order: stroke; stroke: ${PAPER}; stroke-width: 2.8px; stroke-linejoin: round; }
.sx-sp-marker { fill: #fbfdf8; stroke: #3f684b; stroke-width: 1.05; }
.sx-sp-marker-line { fill: none; stroke: #3f684b; stroke-width: 0.7; }
.sx-sp-car { fill: #fafafa; stroke: #667085; stroke-width: 0.9; }
.sx-sp-pin { fill: #ffffff; stroke: #b42318; stroke-width: 1; }
.sx-sp-entry { fill: #ffffff; stroke: #475467; stroke-width: 1; }
.sx-sp-legend-box { fill: ${PAPER}; stroke: #cfd5dd; stroke-width: 0.9; }
.sx-sp-legend-title { fill: ${INK}; font-size: 10px; font-weight: 700; }
.sx-sp-legend-text { fill: ${MUTED}; font-size: 9.4px; }
.sx-native-handle { fill: #fff; stroke: #2563eb; stroke-width: 1.4; vector-effect: non-scaling-stroke; cursor: move; }
.sx-native-handle:hover { fill: #dbeafe; stroke-width: 2; }
`.trim()
  );
  const children = [
    chunk7ZEDTSU3_cjs.title(lay.title),
    chunk7ZEDTSU3_cjs.desc(`Site plan with ${lay.polygons.length} polygons, ${lay.paths.length} paths, ${lay.lines.length} line features, and ${lay.markers.length} markers.`),
    chunk7ZEDTSU3_cjs.defs([
      chunk7ZEDTSU3_cjs.el("marker", { id: "sx-sp-arrow", markerWidth: 8, markerHeight: 8, refX: 7, refY: 4, orient: "auto" }, [
        chunk7ZEDTSU3_cjs.path({ d: "M1 1 L7 4 L1 7 Z", fill: "#344054" })
      ]),
      chunk7ZEDTSU3_cjs.el("pattern", { id: "sx-sp-structure-hatch", patternUnits: "userSpaceOnUse", width: 7, height: 7 }, [
        chunk7ZEDTSU3_cjs.rect({ x: 0, y: 0, width: 7, height: 7, fill: "#fbfcfd" }),
        chunk7ZEDTSU3_cjs.path({ d: "M-2 7 L7 -2 M2 9 L9 2", stroke: "#d6dbe3", "stroke-width": 0.65 })
      ]),
      chunk7ZEDTSU3_cjs.el("pattern", { id: "sx-sp-parking-hatch", patternUnits: "userSpaceOnUse", width: 24, height: 18 }, [
        chunk7ZEDTSU3_cjs.rect({ x: 0, y: 0, width: 24, height: 18, fill: "#f4f6f8" }),
        chunk7ZEDTSU3_cjs.path({ d: "M4 18 L4 6 M12 18 L12 6 M20 18 L20 6", stroke: "#c5ccd6", "stroke-width": 0.8 })
      ]),
      chunk7ZEDTSU3_cjs.el("pattern", { id: "sx-sp-landscape-dot", patternUnits: "userSpaceOnUse", width: 12, height: 12 }, [
        chunk7ZEDTSU3_cjs.rect({ x: 0, y: 0, width: 12, height: 12, fill: "#fcfdf9" }),
        chunk7ZEDTSU3_cjs.circle({ cx: 3, cy: 4, r: 0.8, fill: "#a6b99d" }),
        chunk7ZEDTSU3_cjs.circle({ cx: 9, cy: 9, r: 0.8, fill: "#a6b99d" })
      ])
    ]),
    style,
    chunk7ZEDTSU3_cjs.rect({ x: 0, y: 0, width, height, class: "sx-sp-bg" }),
    chunk7ZEDTSU3_cjs.rect({ x: 8, y: 8, width: r2(width - 16), height: r2(height - 16), class: "sx-sp-sheet" })
  ];
  if (resolvedTitle) {
    children.push(chunk7ZEDTSU3_cjs.text({ x: resolvedTitle.x, y: resolvedTitle.y, class: "sx-sp-title", "font-family": fontFamily, "text-anchor": "middle", ...resolvedTitle.attrs }, lay.title));
    children.push(chunk7ZEDTSU3_cjs.line({ x1: pad, y1: titleBand, x2: r2(width - pad), y2: titleBand, class: "sx-sp-sheet-rule" }));
  }
  const roads = [];
  const surfaces = [];
  const structures = [];
  const paths = [];
  const overlays = [];
  const dims = [];
  const markers = [];
  const callouts = [];
  const labels = [];
  const nativeHandles = [];
  const addPointHandle = (key, point, range) => {
    if (!config?.__scene || !range) return;
    const x = sx(point.x);
    const y = sy(point.y);
    config.__scene.push({
      key,
      kind: "node",
      bbox: { x: x - 5, y: y - 5, width: 10, height: 10 },
      positionSource: {
        kind: "point",
        range,
        x: point.x,
        y: point.y,
        unitsPerSvgX: 1 / scale,
        unitsPerSvgY: 1 / scale
      },
      editable: { label: false, position: "free" }
    });
    nativeHandles.push(chunk7ZEDTSU3_cjs.circle({
      cx: x,
      cy: y,
      r: 4.5,
      class: "sx-native-handle",
      "data-sx-key": key,
      "data-sx-owner": key
    }));
  };
  for (const p of lay.paths.filter((p2) => p2.role === "road")) {
    roads.push(renderPath(p, sx, sy, len, true));
    if (p.label) labels.push(labelOnLine(p.points, p.label, sx, sy, fontFamily, "sx-sp-small", -4));
    p.points.forEach((point, index) => addPointHandle(`handle:path:${p.id}:${index}`, point, p.pointSourceRanges?.[index]));
  }
  for (const p of lay.polygons) {
    if (p.role === "structure") structures.push(renderPolygon(p, sx, sy, fontFamily));
    else surfaces.push(renderPolygon(p, sx, sy, fontFamily));
    p.points.forEach((point, index) => addPointHandle(`handle:polygon:${p.id}:${index}`, point, p.pointSourceRanges?.[index]));
  }
  for (const p of lay.paths.filter((p2) => p2.role !== "road")) {
    paths.push(renderPath(p, sx, sy, len, false));
    if (p.label) labels.push(labelOnLine(p.points, p.label, sx, sy, fontFamily, "sx-sp-small", -5));
    p.points.forEach((point, index) => addPointHandle(`handle:path:${p.id}:${index}`, point, p.pointSourceRanges?.[index]));
  }
  for (const l of lay.lines) {
    const d = pathD(l.points, sx, sy);
    overlays.push(chunk7ZEDTSU3_cjs.path({ d, class: `sx-sp-${l.role}`, "data-line": l.id }));
    if (l.label) labels.push(labelOnLine(l.points, l.label, sx, sy, fontFamily, "sx-sp-small", l.role === "frontage" ? 11 : -5));
    l.points.forEach((point, index) => addPointHandle(`handle:line:${l.id}:${index}`, point, l.pointSourceRanges?.[index]));
  }
  for (const [index, d] of lay.dimensions.entries()) {
    dims.push(renderDimension(d.from, d.to, d.label, sx, sy, fontFamily));
    addPointHandle(`handle:dimension:${index}:from`, d.from, d.fromSourceRange);
    addPointHandle(`handle:dimension:${index}:to`, d.to, d.toSourceRange);
  }
  for (const m of lay.markers) {
    const x = sx(m.at.x);
    const y = sy(m.at.y);
    const size = Math.max(8, len(m.size));
    const key = `node:${m.id}`;
    if (config?.__scene && m.atSourceRange) {
      config.__scene.push({
        key,
        kind: "node",
        semanticId: m.id,
        label: m.label ?? m.kind,
        bbox: { x: x - size / 2, y: y - size / 2, width: size, height: size },
        positionSource: {
          kind: "point",
          range: m.atSourceRange,
          x: m.at.x,
          y: m.at.y,
          unitsPerSvgX: 1 / scale,
          unitsPerSvgY: 1 / scale
        },
        editable: { label: false, position: "free" }
      });
    }
    markers.push(chunk7ZEDTSU3_cjs.group({
      "data-sx-key": config?.__scene && m.atSourceRange ? key : void 0,
      "data-sx-owner": config?.__scene && m.atSourceRange ? key : void 0
    }, [renderMarker(m.kind, x, y, size, m.rotate, m.label, fontFamily)]));
  }
  for (const [index, c] of lay.callouts.entries()) {
    callouts.push(chunk7ZEDTSU3_cjs.path({ d: `M${r2(sx(c.at.x))} ${r2(sy(c.at.y))} L${r2(sx(c.to.x))} ${r2(sy(c.to.y))}`, class: "sx-sp-callout" }));
    callouts.push(chunk7ZEDTSU3_cjs.text({ x: sx(c.at.x), y: sy(c.at.y) - 5, class: "sx-sp-small", "font-family": fontFamily, "text-anchor": "middle" }, c.label));
    addPointHandle(`handle:callout:${index}:at`, c.at, c.atSourceRange);
    addPointHandle(`handle:callout:${index}:to`, c.to, c.toSourceRange);
  }
  const renderedScene = [
    chunk7ZEDTSU3_cjs.group({ class: "sx-sp-roads" }, roads),
    chunk7ZEDTSU3_cjs.group({ class: "sx-sp-surfaces" }, surfaces),
    chunk7ZEDTSU3_cjs.group({ class: "sx-sp-structures" }, structures),
    chunk7ZEDTSU3_cjs.group({ class: "sx-sp-paths" }, paths),
    chunk7ZEDTSU3_cjs.group({ class: "sx-sp-overlays" }, overlays),
    chunk7ZEDTSU3_cjs.group({ class: "sx-sp-dimensions" }, dims),
    chunk7ZEDTSU3_cjs.group({ class: "sx-sp-markers" }, markers),
    chunk7ZEDTSU3_cjs.group({ class: "sx-sp-callouts" }, callouts),
    chunk7ZEDTSU3_cjs.group({ class: "sx-sp-labels" }, labels),
    chunk7ZEDTSU3_cjs.group({ class: "sx-native-handles" }, nativeHandles)
  ];
  children.push(chunk7ZEDTSU3_cjs.group({ class: "sx-siteplan-scene" }, renderedScene));
  if (hasPanel) {
    children.push(chunk7ZEDTSU3_cjs.line({ x1: r2(panelX - 12), y1: titleBand + 14, x2: r2(panelX - 12), y2: r2(height - pad), class: "sx-sp-sheet-rule" }));
    const panelParts = [];
    let cursorY = titleBand + pad + 36;
    if (lay.north !== void 0) {
      panelParts.push(renderNorth(panelX + panelW / 2, cursorY, lay.north, fontFamily));
      cursorY += 72;
    }
    if (lay.legend && lay.legendItems.length) {
      panelParts.push(renderLegend(lay, panelX, cursorY, panelW, fontFamily));
      cursorY += 34 + Math.ceil(Math.min(lay.legendItems.length, LEGEND_LIMIT) / LEGEND_COLS) * 20;
    }
    if (lay.scale) {
      const scaleWidth = Math.min(Math.max(52, len(lay.scale)), panelW - 18);
      panelParts.push(renderScaleBar(panelX + 4, Math.max(cursorY + 26, height - pad - 34), scaleWidth, formatSiteLength(lay.scale, lay.unit), fontFamily));
    }
    children.push(chunk7ZEDTSU3_cjs.group({ class: "sx-sp-accessories" }, panelParts));
  }
  return chunk7ZEDTSU3_cjs.svgRoot({ width: Math.round(width), height: Math.round(height), viewBox: `0 0 ${Math.round(width)} ${Math.round(height)}`, class: "sx-sp", role: "img" }, children);
}
function renderPolygon(p, sx, sy, fontFamily) {
  const c = centroid(p.points);
  const attrs = {
    points: polyPoints(p.points, sx, sy),
    class: `sx-sp-${p.role}`,
    "data-polygon": p.id,
    fill: p.fill ?? defaultPolygonFill(p.role)
  };
  return chunk7ZEDTSU3_cjs.group({ class: "sx-sp-polygon" }, [
    chunk7ZEDTSU3_cjs.polygon(attrs),
    ...p.role === "structure" ? renderRoofLines(p.points, sx, sy) : [],
    ...p.label ? [chunk7ZEDTSU3_cjs.text({ x: sx(c.x), y: sy(c.y), class: "sx-sp-label", "font-family": fontFamily, "text-anchor": "middle", "dominant-baseline": "central" }, p.label)] : []
  ]);
}
function defaultPolygonFill(role) {
  switch (role) {
    case "parcel":
      return "#fffefd";
    case "structure":
      return "url(#sx-sp-structure-hatch)";
    case "zone":
      return "#fbfdf8";
    case "landscape":
      return "url(#sx-sp-landscape-dot)";
    case "parking":
      return "url(#sx-sp-parking-hatch)";
  }
}
function renderRoofLines(points, sx, sy) {
  if (points.length < 4 || points.length > 8) return [];
  const c = centroid(points);
  return points.map((p) => chunk7ZEDTSU3_cjs.line({ x1: sx(c.x), y1: sy(c.y), x2: sx(p.x), y2: sy(p.y), class: "sx-sp-roofline" }));
}
function renderPath(p, sx, sy, len, road) {
  const d = pathD(p.points, sx, sy);
  const ratio = road ? 0.44 : p.role === "driveway" ? 0.42 : 0.34;
  const maxWidth = road ? 44 : p.role === "driveway" ? 24 : 16;
  const visualWidth = Math.min(Math.max(2.5, len(p.width) * ratio), maxWidth);
  if (p.role === "driveway") {
    const parts2 = [
      chunk7ZEDTSU3_cjs.path({ d, class: "sx-sp-driveway-edge", "stroke-width": r2(visualWidth + 1.8), "data-path": p.id }),
      chunk7ZEDTSU3_cjs.path({ d, class: "sx-sp-driveway", "stroke-width": visualWidth })
    ];
    if (p.width >= 12) parts2.push(chunk7ZEDTSU3_cjs.path({ d, class: "sx-sp-driveway-mark" }));
    if (p.width >= 14) parts2.push(...renderDrivewayArrows(p.points, sx, sy, visualWidth));
    return chunk7ZEDTSU3_cjs.group({ class: "sx-sp-path sx-sp-path-driveway" }, parts2);
  }
  const parts = [chunk7ZEDTSU3_cjs.path({ d, class: `sx-sp-${p.role}`, "stroke-width": visualWidth, "data-path": p.id })];
  if (road) parts.push(chunk7ZEDTSU3_cjs.path({ d, class: "sx-sp-road-center" }));
  return chunk7ZEDTSU3_cjs.group({ class: `sx-sp-path sx-sp-path-${p.role}` }, parts);
}
function screenPoints(points, sx, sy) {
  return points.map((p) => ({ x: sx(p.x), y: sy(p.y) }));
}
function polylineLength(points) {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}
function samplePolyline(points, distance) {
  let walked = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a2 = points[i];
    const b2 = points[i + 1];
    const dx = b2.x - a2.x;
    const dy = b2.y - a2.y;
    const seg = Math.hypot(dx, dy);
    if (walked + seg >= distance) {
      const t = seg === 0 ? 0 : (distance - walked) / seg;
      return {
        x: a2.x + dx * t,
        y: a2.y + dy * t,
        angle: Math.atan2(dy, dx) * 180 / Math.PI
      };
    }
    walked += seg;
  }
  const a = points[Math.max(0, points.length - 2)];
  const b = points[points.length - 1];
  return { x: b.x, y: b.y, angle: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI };
}
function renderDrivewayArrows(points, sx, sy, visualWidth) {
  const screen = screenPoints(points, sx, sy);
  const total = polylineLength(screen);
  if (total < 64) return [];
  const count = Math.min(3, Math.max(1, Math.floor(total / 180)));
  const size = Math.min(Math.max(visualWidth * 0.44, 7), 12);
  const arrows = [];
  for (let i = 0; i < count; i++) {
    const f = count === 1 ? 0.52 : (i + 1) / (count + 1);
    const s = samplePolyline(screen, total * f);
    arrows.push(renderDrivewayArrow(s.x, s.y, s.angle, size));
  }
  return arrows;
}
function renderDrivewayArrow(x, y, angle, size) {
  const s = size;
  const d = `M${r2(-s * 0.55)} ${r2(-s * 0.18)} L${r2(s * 0.12)} ${r2(-s * 0.18)} L${r2(s * 0.12)} ${r2(-s * 0.4)} L${r2(s * 0.62)} 0 L${r2(s * 0.12)} ${r2(s * 0.4)} L${r2(s * 0.12)} ${r2(s * 0.18)} L${r2(-s * 0.55)} ${r2(s * 0.18)} Z`;
  return chunk7ZEDTSU3_cjs.group({ class: "sx-sp-driveway-arrow-g", transform: `translate(${r2(x)},${r2(y)}) rotate(${r2(angle)})` }, [
    chunk7ZEDTSU3_cjs.path({ d, class: "sx-sp-driveway-arrow" })
  ]);
}
function labelOnLine(points, label, sx, sy, fontFamily, cls, yOffset) {
  let best = { a: points[0], b: points[Math.min(1, points.length - 1)], dist: -1 };
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx2 = sx(b.x) - sx(a.x);
    const dy2 = sy(b.y) - sy(a.y);
    const dist2 = Math.hypot(dx2, dy2);
    if (dist2 > best.dist) best = { a, b, dist: dist2 };
  }
  const ax = sx(best.a.x);
  const ay = sy(best.a.y);
  const bx = sx(best.b.x);
  const by = sy(best.b.y);
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.max(1, Math.hypot(dx, dy));
  let angle = Math.atan2(dy, dx) * 180 / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  const x = r2((ax + bx) / 2 + -dy / dist * yOffset);
  const y = r2((ay + by) / 2 + dx / dist * yOffset);
  return chunk7ZEDTSU3_cjs.text(
    {
      x,
      y,
      class: cls,
      "font-family": fontFamily,
      "text-anchor": "middle",
      "dominant-baseline": "central",
      transform: Math.abs(angle) > 3 ? `rotate(${r2(angle)} ${x} ${y})` : void 0
    },
    label
  );
}
function renderDimension(from, to, label, sx, sy, fontFamily) {
  const x1 = sx(from.x);
  const y1 = sy(from.y);
  const x2 = sx(to.x);
  const y2 = sy(to.y);
  const vertical = Math.abs(y2 - y1) > Math.abs(x2 - x1);
  const tick = 3.8;
  const tickA = (x, y) => chunk7ZEDTSU3_cjs.line({ x1: r2(x - tick), y1: r2(y + tick), x2: r2(x + tick), y2: r2(y - tick), class: "sx-sp-dim" });
  const midX = r2((x1 + x2) / 2);
  const midY = r2((y1 + y2) / 2);
  const textAttrs = {
    class: "sx-sp-small",
    "font-family": fontFamily,
    "text-anchor": "middle"
  };
  return chunk7ZEDTSU3_cjs.group({ class: "sx-sp-measure" }, [
    chunk7ZEDTSU3_cjs.line({ x1, y1, x2, y2, class: "sx-sp-dim" }),
    tickA(x1, y1),
    tickA(x2, y2),
    chunk7ZEDTSU3_cjs.text(
      vertical ? { ...textAttrs, x: r2(midX - 6), y: midY, transform: `rotate(-90 ${r2(midX - 6)} ${midY})` } : { ...textAttrs, x: midX, y: r2(midY - 5) },
      label
    )
  ]);
}
function renderMarker(kind, x, y, sizePx, rotate, label, fontFamily) {
  const s = Math.max(8, sizePx);
  const parts = [];
  if (kind === "tree") {
    parts.push(chunk7ZEDTSU3_cjs.circle({ cx: x, cy: y, r: s / 2, class: "sx-sp-marker", "data-marker": kind }));
    parts.push(chunk7ZEDTSU3_cjs.circle({ cx: x, cy: y, r: s * 0.28, class: "sx-sp-marker" }));
    parts.push(chunk7ZEDTSU3_cjs.line({ x1: x - s * 0.42, y1: y, x2: x + s * 0.42, y2: y, class: "sx-sp-marker-line" }));
    parts.push(chunk7ZEDTSU3_cjs.line({ x1: x, y1: y - s * 0.42, x2: x, y2: y + s * 0.42, class: "sx-sp-marker-line" }));
  } else if (kind === "car") {
    parts.push(
      chunk7ZEDTSU3_cjs.group({ transform: `translate(${x},${y}) rotate(${rotate})`, "data-marker": kind }, [
        chunk7ZEDTSU3_cjs.rect({ x: -s * 0.28, y: -s * 0.5, width: s * 0.56, height: s, rx: s * 0.12, class: "sx-sp-car" }),
        chunk7ZEDTSU3_cjs.line({ x1: -s * 0.2, y1: -s * 0.2, x2: s * 0.2, y2: -s * 0.2, class: "sx-sp-car" }),
        chunk7ZEDTSU3_cjs.line({ x1: -s * 0.2, y1: s * 0.22, x2: s * 0.2, y2: s * 0.22, class: "sx-sp-car" })
      ])
    );
  } else {
    const cls = kind === "entry" ? "sx-sp-entry" : kind === "pin" ? "sx-sp-pin" : "sx-sp-marker";
    parts.push(chunk7ZEDTSU3_cjs.circle({ cx: x, cy: y, r: s / 3, class: cls, "data-marker": kind }));
  }
  if (label) parts.push(chunk7ZEDTSU3_cjs.text({ x, y: y - s / 2 - 5, class: "sx-sp-small", "font-family": fontFamily, "text-anchor": "middle" }, label));
  return chunk7ZEDTSU3_cjs.group({ class: `sx-sp-marker-${kind}` }, parts);
}
function renderNorth(x, y, deg, fontFamily) {
  return chunk7ZEDTSU3_cjs.group({ class: "sx-sp-north", transform: `translate(${x},${y})` }, [
    chunk7ZEDTSU3_cjs.circle({ cx: 0, cy: 0, r: 17, fill: "none", stroke: "#475467", "stroke-width": 0.9 }),
    chunk7ZEDTSU3_cjs.group({ transform: `rotate(${deg})` }, [
      chunk7ZEDTSU3_cjs.path({ d: "M0 -14 L5 5 L0 1 L-5 5 Z", fill: "#344054" }),
      chunk7ZEDTSU3_cjs.line({ x1: 0, y1: 1, x2: 0, y2: 13, stroke: "#344054", "stroke-width": 1.1 })
    ]),
    chunk7ZEDTSU3_cjs.text({ x: 0, y: -22, class: "sx-sp-small", "font-family": fontFamily, "text-anchor": "middle" }, "N")
  ]);
}
function renderScaleBar(x, y, w, label, fontFamily) {
  const ww = Math.max(36, w);
  const seg = ww / 4;
  const bars = [0, 1, 2, 3].map(
    (i) => chunk7ZEDTSU3_cjs.rect({ x: r2(x + seg * i), y: r2(y - 4), width: r2(seg), height: 8, fill: i % 2 === 0 ? "#111827" : PAPER, stroke: "#111827", "stroke-width": 0.7 })
  );
  return chunk7ZEDTSU3_cjs.group({ class: "sx-sp-scale" }, [
    ...bars,
    chunk7ZEDTSU3_cjs.text({ x: r2(x + ww / 2), y: r2(y - 10), class: "sx-sp-small", "font-family": fontFamily, "text-anchor": "middle" }, label),
    chunk7ZEDTSU3_cjs.text({ x, y: r2(y + 17), class: "sx-sp-small", "font-family": fontFamily, "text-anchor": "middle" }, "0")
  ]);
}
function renderLegend(lay, x, y, availableWidth, fontFamily) {
  const parts = [];
  const colW = Math.max(160, availableWidth / LEGEND_COLS);
  const rowH = 20;
  const items = lay.legendItems.slice(0, LEGEND_LIMIT);
  const rows = Math.ceil(items.length / LEGEND_COLS);
  const boxH = 26 + rows * rowH + 10;
  parts.push(chunk7ZEDTSU3_cjs.rect({ x, y: r2(y - 16), width: availableWidth, height: boxH, rx: 3, class: "sx-sp-legend-box" }));
  parts.push(chunk7ZEDTSU3_cjs.text({ x: x + 10, y, class: "sx-sp-legend-title", "font-family": fontFamily }, "Legend"));
  for (const [i, item] of items.entries()) {
    const cx = x + i % LEGEND_COLS * colW;
    const cy = y + 24 + Math.floor(i / LEGEND_COLS) * rowH;
    parts.push(renderLegendSymbol(item.key, cx + 10, cy - 4));
    parts.push(chunk7ZEDTSU3_cjs.text({ x: cx + 48, y: cy, class: "sx-sp-legend-text", "font-family": fontFamily }, item.label));
  }
  return chunk7ZEDTSU3_cjs.group({ class: "sx-sp-legend" }, parts);
}
function renderLegendSymbol(key, x, y) {
  if (key === "tree") return chunk7ZEDTSU3_cjs.circle({ cx: x + 14, cy: y - 1, r: 6, class: "sx-sp-marker" });
  if (key === "pin" || key === "entry" || key === "hydrant" || key === "well") {
    return chunk7ZEDTSU3_cjs.circle({ cx: x + 14, cy: y - 1, r: 5, class: `sx-sp-${key === "pin" ? "pin" : "entry"}` });
  }
  if (["road", "driveway", "walkway", "trail"].includes(key)) {
    const width = key === "road" ? 7 : key === "driveway" ? 5 : 4;
    if (key === "driveway") {
      return chunk7ZEDTSU3_cjs.group({ class: "sx-sp-legend-driveway" }, [
        chunk7ZEDTSU3_cjs.line({ x1: x, y1: y, x2: x + 28, y2: y, class: "sx-sp-driveway-edge", "stroke-width": width + 2 }),
        chunk7ZEDTSU3_cjs.line({ x1: x, y1: y, x2: x + 28, y2: y, class: "sx-sp-driveway", "stroke-width": width }),
        chunk7ZEDTSU3_cjs.line({ x1: x + 3, y1: y, x2: x + 25, y2: y, class: "sx-sp-driveway-mark" })
      ]);
    }
    return chunk7ZEDTSU3_cjs.line({ x1: x, y1: y, x2: x + 28, y2: y, class: `sx-sp-${key}`, "stroke-width": width });
  }
  if (["setback", "easement", "fence", "utility", "frontage", "boundary"].includes(key)) {
    return chunk7ZEDTSU3_cjs.line({ x1: x, y1: y, x2: x + 28, y2: y, class: `sx-sp-${key}` });
  }
  const fill = key === "parcel" ? "#fffefd" : key === "structure" ? "url(#sx-sp-structure-hatch)" : key === "parking" ? "url(#sx-sp-parking-hatch)" : key === "landscape" ? "url(#sx-sp-landscape-dot)" : "#fffefd";
  return chunk7ZEDTSU3_cjs.rect({ x, y: y - 7, width: 28, height: 12, rx: 1, class: `sx-sp-${key}`, fill });
}

// src/diagrams/siteplan/index.ts
var siteplan = {
  type: "siteplan",
  capabilities: { scene: true, editablePosition: true },
  detect(text2) {
    for (const raw of text2.split(/\r?\n/)) {
      const t = raw.trim();
      if (!t || t.startsWith("#") || t.startsWith("//")) continue;
      return /^(siteplan|plotplan|parcelmap|propertymap)\b/i.test(t);
    }
    return false;
  },
  parse: parseSiteplan,
  render(text2, config) {
    return renderSiteplan(text2, config);
  },
  lint(text2) {
    try {
      const lay = layoutSiteplan(parseSiteplan(text2));
      return lay.warnings.map((message) => ({
        severity: "warning",
        code: "siteplan/warning",
        message,
        fatal: false
      }));
    } catch {
      return [];
    }
  }
};

exports.SiteplanParseError = SiteplanParseError;
exports.formatSiteLength = formatSiteLength;
exports.layoutSiteplan = layoutSiteplan;
exports.parseSiteplan = parseSiteplan;
exports.renderSiteplan = renderSiteplan;
exports.renderSiteplanLayout = renderSiteplanLayout;
exports.siteplan = siteplan;
//# sourceMappingURL=chunk-5A6CVYMM.cjs.map
//# sourceMappingURL=chunk-5A6CVYMM.cjs.map