'use strict';

var chunk54Q7JDQB_cjs = require('./chunk-54Q7JDQB.cjs');
var chunk4M6OFAHM_cjs = require('./chunk-4M6OFAHM.cjs');
var chunk7ZEDTSU3_cjs = require('./chunk-7ZEDTSU3.cjs');

// src/diagrams/venn/parser.ts
var VennParseError = class extends Error {
  constructor(message, line) {
    super(line !== void 0 ? `Line ${line}: ${message}` : message);
    this.line = line;
    this.name = "VennParseError";
  }
  line;
};
var DEFAULT_CONFIG = {
  mode: "auto",
  proportional: false,
  palette: "default",
  blendMode: "multiply",
  showCounts: "auto",
  showPercent: false
};
function stripComment(line) {
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (chunk4M6OFAHM_cjs.isOpenQuote(ch)) {
      try {
        const r = chunk4M6OFAHM_cjs.extractQuotedString(line, i);
        if (r) {
          i = r.end - 1;
          continue;
        }
      } catch {
        return line;
      }
    }
    if (ch === "#") return line.slice(0, i);
  }
  return line;
}
function stripQuotes2(s) {
  return chunk4M6OFAHM_cjs.stripQuotes(s);
}
function parseConfigProps(text2) {
  const out = {};
  let depth = 0;
  let buf = "";
  const parts = [];
  for (let i = 0; i < text2.length; i++) {
    const ch = text2[i];
    if (chunk4M6OFAHM_cjs.isOpenQuote(ch)) {
      try {
        const r = chunk4M6OFAHM_cjs.extractQuotedString(text2, i);
        if (r) {
          buf += text2.slice(i, r.end);
          i = r.end - 1;
          continue;
        }
      } catch {
      }
    }
    if (ch === "[" || ch === "(" || ch === "{") depth++;
    else if (ch === "]" || ch === ")" || ch === "}") depth--;
    if (ch === "," && depth === 0) {
      parts.push(buf);
      buf = "";
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) parts.push(buf);
  for (const p of parts) {
    const idx = p.indexOf(":");
    if (idx < 0) continue;
    const k = p.slice(0, idx).trim();
    const v = p.slice(idx + 1).trim();
    out[k] = stripQuotes2(v);
  }
  return out;
}
function parseTitleAndProps(rest) {
  const trimmed = rest.trim();
  let i = 0;
  let title2;
  if (trimmed.length > 0 && chunk4M6OFAHM_cjs.isOpenQuote(trimmed[0])) {
    try {
      const r = chunk4M6OFAHM_cjs.extractQuotedString(trimmed, 0);
      if (r) {
        title2 = r.value;
        i = r.end;
      }
    } catch {
      throw new VennParseError("unterminated quoted title");
    }
  }
  const tail = trimmed.slice(i).trim();
  let props = {};
  if (tail.startsWith("[") && tail.endsWith("]")) {
    props = parseConfigProps(tail.slice(1, -1));
  }
  return { title: title2, props };
}
function parseValue(raw) {
  const t = raw.trim();
  if (!t) return { kind: "none" };
  if (t.startsWith("[") && t.endsWith("]")) {
    const inner = t.slice(1, -1).trim();
    if (!inner) return { kind: "list", value: [] };
    const items = splitTopLevelCommas(inner).map((x) => stripQuotes2(x.trim()));
    return { kind: "list", value: items };
  }
  if (/^-?\d+(\.\d+)?%$/.test(t)) {
    return { kind: "percent", value: parseFloat(t.slice(0, -1)) };
  }
  if (/^-?\d+$/.test(t)) {
    return { kind: "integer", value: parseInt(t, 10) };
  }
  if (t.length >= 2 && chunk4M6OFAHM_cjs.isOpenQuote(t[0])) {
    const stripped = chunk4M6OFAHM_cjs.stripQuotes(t);
    if (stripped !== t) return { kind: "text", value: stripped };
  }
  return { kind: "text", value: t };
}
function splitTopLevelCommas(s) {
  const out = [];
  let buf = "";
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (chunk4M6OFAHM_cjs.isOpenQuote(ch)) {
      try {
        const r = chunk4M6OFAHM_cjs.extractQuotedString(s, i);
        if (r) {
          buf += s.slice(i, r.end);
          i = r.end - 1;
          continue;
        }
      } catch {
      }
    }
    if (ch === "{" || ch === "[" || ch === "(") depth++;
    else if (ch === "}" || ch === "]" || ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(buf);
      buf = "";
    } else {
      buf += ch;
    }
  }
  if (buf.length > 0) out.push(buf);
  return out;
}
var EULER_KEYWORDS = {
  subset: "subset",
  disjoint: "disjoint",
  overlap: "overlap"
};
function parseRegionKey(text2, knownSets) {
  const trimmed = text2.trim();
  const onlyMatch = /^([A-Za-z][\w-]*)\s+only$/i.exec(trimmed);
  if (onlyMatch && onlyMatch[1]) {
    const id = onlyMatch[1];
    if (!knownSets.has(id)) {
      throw new VennParseError(`unknown set id "${id}" in region key`);
    }
    return { sets: [id], only: true };
  }
  const parts = trimmed.split("&").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) {
    throw new VennParseError(`empty region key: "${text2}"`);
  }
  for (const p of parts) {
    if (!/^[A-Za-z][\w-]*$/.test(p)) {
      throw new VennParseError(`invalid set ref "${p}" in region key`);
    }
    if (!knownSets.has(p)) {
      throw new VennParseError(`unknown set id "${p}" in region key`);
    }
  }
  return { sets: [...parts], only: false };
}
function parseVennDSL(input) {
  const lines = input.split(/\r?\n/);
  let title2;
  let headerSeen = false;
  const config = { ...DEFAULT_CONFIG };
  const sets = [];
  const setsById = /* @__PURE__ */ new Map();
  const regions = [];
  const relations = [];
  const metadata = {};
  const knownSetIds = /* @__PURE__ */ new Set();
  const applyConfigProps = (props) => {
    for (const [k, v] of Object.entries(props)) {
      applyConfig(k, v, config, metadata);
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const raw = stripComment(lines[i] ?? "").trim();
    if (!raw) continue;
    const lineNo = i + 1;
    if (!headerSeen && /^venn\b/i.test(raw)) {
      const rest = raw.replace(/^venn\s*:?\s*/i, "");
      const { title: t, props } = parseTitleAndProps(rest);
      if (t !== void 0) title2 = t;
      applyConfigProps(props);
      headerSeen = true;
      continue;
    }
    const configMatch = /^config\s*:\s*([a-zA-Z_]+)\s*=\s*(.+)$/.exec(raw);
    if (configMatch && configMatch[1] && configMatch[2]) {
      applyConfig(configMatch[1], configMatch[2].trim(), config, metadata);
      continue;
    }
    const layoutMatch = /^layout\s+(venn|euler|auto)\s*$/i.exec(raw);
    if (layoutMatch && layoutMatch[1]) {
      config.mode = layoutMatch[1].toLowerCase();
      continue;
    }
    const setMatch = /^set\s+([A-Za-z][\w-]*)\s+(.+)$/i.exec(raw);
    if (setMatch && setMatch[1] && setMatch[2]) {
      const id = setMatch[1];
      const rest = setMatch[2];
      const { title: label, props } = parseTitleAndProps(rest);
      if (setsById.has(id)) {
        throw new VennParseError(`duplicate set id "${id}"`, lineNo);
      }
      const color = props["color"] ?? props["fill"];
      const atMatch = /^\(\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*,\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*\)$/.exec(props["at"] ?? "");
      const radiusValue = Number(props["radius"]);
      const setObj = {
        id,
        label: label ?? id,
        color,
        ...atMatch ? { at: { x: Number(atMatch[1]), y: Number(atMatch[2]) } } : {},
        ...Number.isFinite(radiusValue) && radiusValue > 0 ? { radius: radiusValue } : {}
      };
      sets.push(setObj);
      setsById.set(id, setObj);
      knownSetIds.add(id);
      continue;
    }
    const enumMatch = /^([A-Za-z][\w-]*)\s*=\s*\{([^}]*)\}\s*$/.exec(raw);
    if (enumMatch && enumMatch[1] !== void 0 && enumMatch[2] !== void 0) {
      const id = enumMatch[1];
      const items = splitTopLevelCommas(enumMatch[2]).map((x) => stripQuotes2(x.trim())).filter((x) => x.length > 0);
      let setObj = setsById.get(id);
      if (!setObj) {
        setObj = { id, label: id, elements: items };
        sets.push(setObj);
        setsById.set(id, setObj);
        knownSetIds.add(id);
      } else {
        setObj.elements = items;
      }
      continue;
    }
    const eulerMatch = /^([A-Za-z][\w-]*)\s+(subset|in|disjoint|overlap)\s+([A-Za-z][\w-]*)\s*$/i.exec(
      raw
    );
    if (eulerMatch && eulerMatch[1] && eulerMatch[2] && eulerMatch[3]) {
      const from = eulerMatch[1];
      const relRaw = eulerMatch[2].toLowerCase();
      const rel = relRaw === "in" ? "subset" : relRaw;
      const to = eulerMatch[3];
      if (!knownSetIds.has(from)) {
        throw new VennParseError(`unknown set "${from}" in relation`, lineNo);
      }
      if (!knownSetIds.has(to)) {
        throw new VennParseError(`unknown set "${to}" in relation`, lineNo);
      }
      const relType = EULER_KEYWORDS[rel];
      if (!relType) {
        throw new VennParseError(`unknown relation "${rel}"`, lineNo);
      }
      relations.push({ from, to, type: relType });
      continue;
    }
    let regionBody = raw;
    if (/^region\s+/i.test(regionBody)) {
      regionBody = regionBody.replace(/^region\s+/i, "");
    }
    const colonIdx = regionBody.indexOf(":");
    if (colonIdx > 0) {
      const keyPart = regionBody.slice(0, colonIdx);
      const valuePart = regionBody.slice(colonIdx + 1).trim();
      try {
        const { sets: regionSets, only } = parseRegionKey(keyPart, knownSetIds);
        const value = parseValue(valuePart);
        regions.push({ sets: regionSets, only, value });
        continue;
      } catch (e) {
        if (e instanceof VennParseError) {
          throw new VennParseError(e.message, lineNo);
        }
        throw e;
      }
    }
    throw new VennParseError(`could not parse line: "${raw}"`, lineNo);
  }
  if (!headerSeen && sets.length === 0) {
    throw new VennParseError("empty or missing 'venn' header");
  }
  const hasEnumeration = sets.some((s) => s.elements !== void 0);
  if (hasEnumeration && regions.length === 0) {
    regions.push(...deriveRegionsFromEnumeration(sets));
  }
  const ast = {
    type: "venn",
    ...title2 !== void 0 ? { title: title2 } : {},
    sets,
    regions,
    relations,
    config,
    ...Object.keys(metadata).length > 0 ? { metadata } : {}
  };
  return ast;
}
function applyConfig(key, rawValue, config, metadata) {
  const value = rawValue.trim().toLowerCase();
  switch (key) {
    case "diagram":
      if (value === "venn" || value === "euler" || value === "auto") {
        config.mode = value;
      }
      return;
    case "proportional":
      config.proportional = value === "true" || value === "yes" || value === "1";
      return;
    case "palette":
      if (value === "default" || value === "brand" || value === "monochrome") {
        config.palette = value;
      }
      return;
    case "blendMode":
    case "blendmode":
      if (value === "multiply" || value === "screen" || value === "none") {
        config.blendMode = value;
      }
      return;
    case "showCounts":
    case "showcounts":
      config.showCounts = value === "true" ? true : value === "false" ? false : "auto";
      return;
    case "showPercent":
    case "showpercent":
      config.showPercent = value === "true" || value === "yes";
      return;
    default:
      metadata[key] = rawValue.trim();
  }
}
function deriveRegionsFromEnumeration(sets) {
  const n = sets.length;
  if (n === 0) return [];
  const regions = [];
  const total = 1 << n;
  for (let mask = 1; mask < total; mask++) {
    const included = [];
    const excluded = [];
    for (let i = 0; i < n; i++) {
      if (mask >> i & 1) included.push(i);
      else excluded.push(i);
    }
    const firstIdx = included[0];
    if (firstIdx === void 0) continue;
    const firstSetObj = sets[firstIdx];
    if (!firstSetObj) continue;
    const firstSet = firstSetObj.elements ?? [];
    const members = firstSet.filter((el2) => {
      for (const idx of included) {
        const s = sets[idx];
        const list = s?.elements ?? [];
        if (!list.includes(el2)) return false;
      }
      for (const idx of excluded) {
        const s = sets[idx];
        const list = s?.elements ?? [];
        if (list.includes(el2)) return false;
      }
      return true;
    });
    if (members.length === 0) continue;
    const setIds = [];
    for (const idx of included) {
      const s = sets[idx];
      if (s) setIds.push(s.id);
    }
    regions.push({
      sets: setIds,
      only: excluded.length > 0 && included.length < n,
      value: { kind: "list", value: members }
    });
  }
  return regions;
}

// src/diagrams/venn/geometry.ts
function twoCircleIntersectionArea(rA, rB, d) {
  if (rA <= 0 || rB <= 0) return 0;
  if (d >= rA + rB) return 0;
  const rMin = Math.min(rA, rB);
  if (d <= Math.abs(rA - rB)) return Math.PI * rMin * rMin;
  const aTerm = (d * d + rA * rA - rB * rB) / (2 * d * rA);
  const bTerm = (d * d + rB * rB - rA * rA) / (2 * d * rB);
  const a = Math.max(-1, Math.min(1, aTerm));
  const b = Math.max(-1, Math.min(1, bTerm));
  const kSq = (-d + rA + rB) * (d + rA - rB) * (d - rA + rB) * (d + rA + rB);
  const k = kSq > 0 ? Math.sqrt(kSq) : 0;
  return rA * rA * Math.acos(a) + rB * rB * Math.acos(b) - 0.5 * k;
}
function solveTwoCircleDistance(rA, rB, target) {
  const rMin = Math.min(rA, rB);
  const maxArea = Math.PI * rMin * rMin;
  if (target >= maxArea) return Math.abs(rA - rB);
  if (target <= 0) return rA + rB;
  let lo = Math.abs(rA - rB);
  let hi = rA + rB;
  for (let i = 0; i < 60; i++) {
    const mid = 0.5 * (lo + hi);
    const a = twoCircleIntersectionArea(rA, rB, mid);
    if (a > target) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return 0.5 * (lo + hi);
}
function threeCircleClassic(cx, cy, r, offsetScale = 0.6) {
  const o = r * offsetScale;
  const cos30 = Math.cos(Math.PI / 6);
  const sin30 = Math.sin(Math.PI / 6);
  return [
    { id: "0", cx: cx - o * cos30, cy: cy + o * sin30, r },
    { id: "1", cx: cx + o * cos30, cy: cy + o * sin30, r },
    { id: "2", cx, cy: cy - o, r }
  ];
}
function fourEllipseStandard(cx, cy, a, b) {
  const dx = 0.18 * a;
  const dy = 0.1 * b;
  return [
    { id: "0", cx: cx - dx, cy: cy - dy, rx: a, ry: b, rotation: -65 },
    { id: "1", cx: cx - 0.6 * dx, cy: cy - dy, rx: a, ry: b, rotation: -35 },
    { id: "2", cx: cx + 0.6 * dx, cy: cy - dy, rx: a, ry: b, rotation: 35 },
    { id: "3", cx: cx + dx, cy: cy - dy, rx: a, ry: b, rotation: 65 }
  ];
}
function pointInCircle(c, x, y) {
  const dx = x - c.cx;
  const dy = y - c.cy;
  return dx * dx + dy * dy <= c.r * c.r;
}
function pointInEllipse(e, x, y) {
  const dx = x - e.cx;
  const dy = y - e.cy;
  const rad = e.rotation * Math.PI / 180;
  const cos = Math.cos(-rad);
  const sin = Math.sin(-rad);
  const rx = dx * cos - dy * sin;
  const ry = dx * sin + dy * cos;
  return rx * rx / (e.rx * e.rx) + ry * ry / (e.ry * e.ry) <= 1;
}
function circleBBox(c) {
  return { x: c.cx - c.r, y: c.cy - c.r, w: 2 * c.r, h: 2 * c.r };
}
function ellipseBBox(e) {
  const rad = e.rotation * Math.PI / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const ux = e.rx * cos;
  const uy = e.rx * sin;
  const vx = e.ry * -sin;
  const vy = e.ry * cos;
  const hx = Math.sqrt(ux * ux + vx * vx);
  const hy = Math.sqrt(uy * uy + vy * vy);
  return { x: e.cx - hx, y: e.cy - hy, w: 2 * hx, h: 2 * hy };
}
function unionBBox(boxes) {
  if (boxes.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of boxes) {
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.w > maxX) maxX = b.x + b.w;
    if (b.y + b.h > maxY) maxY = b.y + b.h;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return function() {
    a = a + 1831565813 >>> 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function regionCentroid(bounds, include, exclude, nSamples = 2e3, seed = 12648430) {
  const rand = mulberry32(seed);
  let hits = 0;
  let sumX = 0;
  let sumY = 0;
  const interior = [];
  for (let i = 0; i < nSamples; i++) {
    const x = bounds.x + rand() * bounds.w;
    const y = bounds.y + rand() * bounds.h;
    let ok = true;
    for (const s of include) {
      if (!s.inside(x, y)) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    for (const s of exclude) {
      if (s.inside(x, y)) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    hits++;
    sumX += x;
    sumY += y;
    if (interior.length < 256) interior.push({ x, y });
  }
  const area = hits / nSamples * bounds.w * bounds.h;
  if (hits === 0) return { cx: NaN, cy: NaN, area: 0, interior };
  return { cx: sumX / hits, cy: sumY / hits, area, interior };
}

// src/diagrams/venn/labels.ts
var MIN_AREA = 400;
var MIN_AREA_DENSE = 900;
var LABEL_H = 14;
var CHAR_W = 6.2;
var LABEL_GAP = 4;
function labelWidth(text2) {
  return text2.length * CHAR_W + 8;
}
function bboxesOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw + LABEL_GAP && ax + aw + LABEL_GAP > bx && ay < by + bh + LABEL_GAP && ay + ah + LABEL_GAP > by;
}
function makeShapeEntry(shape) {
  if (shape.kind === "circle") {
    const c = shape;
    return {
      id: shape.id,
      shape,
      bbox: circleBBox(c),
      inside: (x, y) => pointInCircle(c, x, y)
    };
  }
  const e = shape;
  return {
    id: shape.id,
    shape,
    bbox: ellipseBBox(e),
    inside: (x, y) => pointInEllipse(e, x, y)
  };
}
function placeLabels(ast, shapes) {
  const entries = shapes.map(makeShapeEntry);
  const byId = /* @__PURE__ */ new Map();
  for (const e of entries) byId.set(e.id, e);
  const canvasBounds = unionBBox(entries.map((e) => e.bbox));
  const canvasCx = canvasBounds.x + canvasBounds.w / 2;
  const canvasCy = canvasBounds.y + canvasBounds.h / 2;
  const dense = shapes.length >= 4;
  const minArea = dense ? MIN_AREA_DENSE : MIN_AREA;
  const candidates = [];
  ast.regions.forEach((region, regionIdx) => {
    const included = region.sets.map((id) => byId.get(id)).filter(isDefined);
    if (included.length === 0) return;
    const excluded = region.only ? entries.filter((e) => !region.sets.includes(e.id)) : [];
    const bounds = unionBBox(included.map((e) => e.bbox));
    const seed = 4919 + regionIdx * 2654435769;
    const { cx, cy, area, interior } = regionCentroid(
      bounds,
      included,
      excluded,
      1500,
      seed
    );
    const text2 = regionLabelText(region);
    if (!text2) return;
    if (!Number.isFinite(cx) || !Number.isFinite(cy) || area === 0) return;
    candidates.push({
      region,
      text: text2,
      cx,
      cy,
      area,
      interior,
      width: labelWidth(text2)
    });
  });
  const byAreaDesc = [...candidates].sort((a, b) => b.area - a.area);
  const placedInternal = [];
  const externalQueue = [];
  for (const c of byAreaDesc) {
    if (c.area < minArea) {
      externalQueue.push(c);
      continue;
    }
    const x = c.cx - c.width / 2;
    const y = c.cy - LABEL_H / 2;
    const collides = placedInternal.some(
      ({ c: p, x: px, y: py }) => bboxesOverlap(x, y, c.width, LABEL_H, px, py, p.width, LABEL_H)
    );
    if (collides) {
      externalQueue.push(c);
    } else {
      placedInternal.push({ c, x, y });
    }
  }
  const externalPlacements = layoutExternal(
    externalQueue,
    canvasCx,
    canvasCy,
    canvasBounds
  );
  const placedMap = /* @__PURE__ */ new Map();
  for (const { c } of placedInternal) {
    placedMap.set(c.region, {
      sets: c.region.sets,
      label: c.text,
      x: c.cx,
      y: c.cy,
      external: false
    });
  }
  for (const p of externalPlacements) {
    placedMap.set(p.region, p.label);
  }
  const out = [];
  for (const region of ast.regions) {
    const p = placedMap.get(region);
    if (p) out.push(p);
  }
  return out;
}
function layoutExternal(queue, cx, cy, canvas) {
  if (queue.length === 0) return [];
  const withAngle = queue.map((c) => {
    const dx = c.cx - cx;
    const dy = c.cy - cy;
    let theta = Math.atan2(dy, dx);
    if (!Number.isFinite(theta)) theta = 0;
    return { c, theta };
  });
  withAngle.sort((a, b) => a.theta - b.theta);
  const radiusX = canvas.w / 2 + 40;
  const radiusY = canvas.h / 2 + 28;
  const minGap = Math.min(2 * Math.PI / Math.max(6, withAngle.length), 0.45);
  const adjusted = redistributeAngles(
    withAngle.map((w) => w.theta),
    minGap
  );
  const out = [];
  for (let i = 0; i < withAngle.length; i++) {
    const { c } = withAngle[i];
    const theta = adjusted[i];
    const ux = Math.cos(theta);
    const uy = Math.sin(theta);
    const ex = cx + ux * radiusX;
    const ey = cy + uy * radiusY;
    const anchor = ux > 0.25 ? "start" : ux < -0.25 ? "end" : "middle";
    const picked = c.interior[Math.floor(c.interior.length / 2)];
    const start = picked ?? { x: c.cx, y: c.cy };
    out.push({
      region: c.region,
      label: {
        sets: c.region.sets,
        label: c.text,
        x: ex,
        y: ey,
        external: true,
        leader: { x1: start.x, y1: start.y, x2: ex, y2: ey },
        anchor
      }
    });
  }
  return out;
}
function redistributeAngles(thetas, minGap) {
  const out = thetas.slice();
  for (let i = 1; i < out.length; i++) {
    const need = out[i - 1] + minGap;
    if (out[i] < need) out[i] = need;
  }
  const wrapLimit = out[0] + Math.PI * 2 - minGap;
  if (out.length > 1 && out[out.length - 1] > wrapLimit) {
    const shift = out[out.length - 1] - wrapLimit;
    for (let i = 0; i < out.length; i++) out[i] = out[i] - shift;
  }
  return out;
}
function regionLabelText(region) {
  return formatRegionValue(region);
}
function isDefined(x) {
  return x !== void 0;
}

// src/diagrams/venn/layout.ts
var DEFAULTS = {
  padding: 24,
  canvasN2: { w: 480, h: 320, r: 110, d: 120 },
  canvasN3: { w: 520, h: 480, r: 130, offset: 0.6 },
  canvasN4: { w: 640, h: 480, a: 216, b: 120 },
  canvasEuler: { w: 520, h: 420 }
};
function layoutVenn(ast, opts = {}) {
  const mode = decideMode(ast);
  let result;
  if (mode === "euler") {
    result = layoutEuler(ast, opts);
  } else {
    const n = ast.sets.length;
    if (n === 1) result = layoutSingle(ast, opts);
    else if (n === 2) result = layoutTwo(ast, opts);
    else if (n === 3) result = layoutThree(ast, opts);
    else if (n === 4) result = layoutFour(ast, opts);
    else result = layoutEuler(ast, opts);
  }
  return applyAuthoredGeometry(ast, result);
}
function applyAuthoredGeometry(ast, result) {
  const minDimension = Math.min(result.width, result.height);
  const shapes = result.shapes.map((shape) => {
    const authored = ast.sets.find((set) => set.id === shape.id);
    if (!authored?.at && authored?.radius === void 0) return shape;
    const cx = authored.at ? authored.at.x * result.width : shape.cx;
    const cy = authored.at ? authored.at.y * result.height : shape.cy;
    if (shape.kind === "circle") {
      return {
        ...shape,
        cx,
        cy,
        r: authored.radius !== void 0 ? authored.radius * minDimension : shape.r
      };
    }
    const scale = authored.radius !== void 0 ? authored.radius * minDimension / Math.max(shape.rx, 1) : 1;
    return { ...shape, cx, cy, rx: shape.rx * scale, ry: shape.ry * scale };
  });
  const setLabels = ast.sets.map((set) => {
    const shape = shapes.find((candidate) => candidate.id === set.id);
    if (!shape) return result.setLabels.find((label) => label.id === set.id) ?? { id: set.id, label: set.label, x: result.width / 2, y: 24, anchor: "middle" };
    const top = shape.kind === "circle" ? shape.r : shape.ry;
    return { id: set.id, label: set.label, x: shape.cx, y: shape.cy - top - 10, anchor: "middle" };
  });
  return {
    ...result,
    shapes,
    labels: placeLabels(ast, shapes),
    setLabels
  };
}
function decideMode(ast) {
  if (ast.config.mode === "venn") return "venn";
  if (ast.config.mode === "euler") return "euler";
  return ast.relations.length > 0 ? "euler" : "venn";
}
function layoutSingle(ast, opts) {
  const w = opts.width ?? 320;
  const h = opts.height ?? 260;
  const set = ast.sets[0];
  if (!set) {
    return { width: w, height: h, mode: "venn", shapes: [], labels: [], setLabels: [] };
  }
  const circle2 = { id: set.id, cx: w / 2, cy: h / 2, r: Math.min(w, h) / 3 };
  const shapes = [{ kind: "circle", ...circle2 }];
  const region = ast.regions.find((r) => r.sets.length === 1 && r.sets[0] === set.id);
  const labels = region ? [
    {
      sets: [set.id],
      label: formatRegionValue(region),
      x: circle2.cx,
      y: circle2.cy,
      external: false
    }
  ] : [];
  const setLabels = [
    {
      id: set.id,
      label: set.label,
      x: circle2.cx,
      y: circle2.cy - circle2.r - 12,
      anchor: "middle"
    }
  ];
  return {
    width: w,
    height: h,
    mode: "venn",
    shapes,
    labels,
    setLabels,
    ...ast.title ? { title: { text: ast.title, x: w / 2, y: 24 } } : {}
  };
}
function layoutTwo(ast, opts) {
  const padding = opts.padding ?? DEFAULTS.padding;
  const setA = ast.sets[0];
  const setB = ast.sets[1];
  if (!setA || !setB) {
    throw new Error("layoutTwo requires two sets");
  }
  let rA = DEFAULTS.canvasN2.r;
  let rB = DEFAULTS.canvasN2.r;
  let d = DEFAULTS.canvasN2.d;
  if (ast.config.proportional) {
    const sizes = computeAbsoluteSetSizes(ast);
    const sizeA = sizes.get(setA.id) ?? 1;
    const sizeB = sizes.get(setB.id) ?? 1;
    const inter = regionValue(ast, [setA.id, setB.id]) ?? 0;
    const scale = 1 / Math.sqrt(Math.max(sizeA, sizeB));
    rA = 110 * Math.sqrt(sizeA) * scale;
    rB = 110 * Math.sqrt(sizeB) * scale;
    const areaPerElem = Math.PI * rA * rA / Math.max(sizeA, 1e-6);
    d = solveTwoCircleDistance(rA, rB, inter * areaPerElem);
  }
  const totalW = rA + rB + d + 2 * padding;
  const w = Math.max(opts.width ?? DEFAULTS.canvasN2.w, totalW);
  const h = opts.height ?? DEFAULTS.canvasN2.h;
  const cxA = (w - d) / 2;
  const cxB = cxA + d;
  const cy = h / 2;
  const circles = [
    { id: setA.id, cx: cxA, cy, r: rA },
    { id: setB.id, cx: cxB, cy, r: rB }
  ];
  const shapes = circles.map((c) => ({ kind: "circle", ...c }));
  const labels = placeLabels(ast, shapes);
  const setLabels = [
    { id: setA.id, label: setA.label, x: cxA, y: cy - rA - 10, anchor: "middle" },
    { id: setB.id, label: setB.label, x: cxB, y: cy - rB - 10, anchor: "middle" }
  ];
  return {
    width: w,
    height: h,
    mode: "venn",
    shapes,
    labels,
    setLabels,
    ...ast.title ? { title: { text: ast.title, x: w / 2, y: 24 } } : {}
  };
}
function layoutThree(ast, opts) {
  const w = opts.width ?? DEFAULTS.canvasN3.w;
  const h = opts.height ?? DEFAULTS.canvasN3.h;
  const r = DEFAULTS.canvasN3.r;
  const offsetScale = DEFAULTS.canvasN3.offset;
  const cx = w / 2;
  const cy = h / 2 + 12;
  let circles = threeCircleClassic(cx, cy, r, offsetScale);
  if (ast.config.proportional) {
    const adjusted = solveProportionalThree(ast, cx, cy);
    if (adjusted) circles = adjusted;
  }
  const shapes = circles.map((c, i) => {
    const setId = ast.sets[i]?.id ?? c.id;
    return { kind: "circle", ...c, id: setId };
  });
  const labels = placeLabels(ast, shapes);
  const setLabels = ast.sets.map((s, i) => {
    const c = circles[i] ?? circles[0];
    if (!c) {
      return { id: s.id, label: s.label, x: cx, y: cy, anchor: "middle" };
    }
    const isTop = i === 2;
    return {
      id: s.id,
      label: s.label,
      x: isTop ? c.cx : c.cx + (i === 0 ? -c.r : c.r) * 0.7,
      y: isTop ? c.cy - c.r - 10 : c.cy + c.r + 16,
      anchor: isTop ? "middle" : i === 0 ? "end" : "start"
    };
  });
  return {
    width: w,
    height: h,
    mode: "venn",
    shapes,
    labels,
    setLabels,
    ...ast.title ? { title: { text: ast.title, x: w / 2, y: 24 } } : {}
  };
}
function layoutFour(ast, opts) {
  const w = opts.width ?? DEFAULTS.canvasN4.w;
  const h = opts.height ?? DEFAULTS.canvasN4.h;
  const cx = w / 2;
  const cy = h / 2 + 8;
  const ellipses = fourEllipseStandard(cx, cy, DEFAULTS.canvasN4.a, DEFAULTS.canvasN4.b);
  const shapes = ellipses.map((e, i) => ({
    kind: "ellipse",
    ...e,
    id: ast.sets[i]?.id ?? e.id
  }));
  const labels = placeLabels(ast, shapes);
  const setLabels = ast.sets.map((s, i) => {
    const e = ellipses[i];
    if (!e) {
      return { id: s.id, label: s.label, x: cx, y: cy, anchor: "middle" };
    }
    const bb = ellipseBBox(e);
    const sign = i < 2 ? -1 : 1;
    return {
      id: s.id,
      label: s.label,
      x: bb.x + (sign < 0 ? 0 : bb.w),
      y: bb.y + (i % 2 === 0 ? 14 : bb.h - 4),
      anchor: sign < 0 ? "start" : "end"
    };
  });
  return {
    width: w,
    height: h,
    mode: "venn",
    shapes,
    labels,
    setLabels,
    ...ast.title ? { title: { text: ast.title, x: w / 2, y: 24 } } : {}
  };
}
function layoutEuler(ast, opts) {
  const w = opts.width ?? DEFAULTS.canvasEuler.w;
  const h = opts.height ?? DEFAULTS.canvasEuler.h;
  const n = ast.sets.length;
  if (n === 0) {
    return {
      width: w,
      height: h,
      mode: "euler",
      shapes: [],
      labels: [],
      setLabels: []
    };
  }
  const parents = /* @__PURE__ */ new Map();
  const disjointPairs = /* @__PURE__ */ new Set();
  for (const rel of ast.relations) {
    if (rel.type === "subset") parents.set(rel.from, rel.to);
    if (rel.type === "disjoint") disjointPairs.add(edgeKey(rel.from, rel.to));
  }
  const roots = ast.sets.filter((s) => !parents.has(s.id)).map((s) => s.id);
  const circles = /* @__PURE__ */ new Map();
  const rootRadius = Math.min(w, h) * 0.32;
  const rootSpacing = Math.min(w / Math.max(roots.length, 1), 2 * rootRadius + 40);
  const startX = w / 2 - (roots.length - 1) * rootSpacing / 2;
  roots.forEach((rootId, i) => {
    circles.set(rootId, { id: rootId, cx: startX + i * rootSpacing, cy: h / 2, r: rootRadius });
  });
  const childrenOf = /* @__PURE__ */ new Map();
  for (const [child, par] of parents.entries()) {
    const arr = childrenOf.get(par) ?? [];
    arr.push(child);
    childrenOf.set(par, arr);
  }
  const placeChildren = (parentId, depth) => {
    const kids = childrenOf.get(parentId) ?? [];
    if (kids.length === 0) return;
    const parent = circles.get(parentId);
    if (!parent) return;
    const childR = parent.r * (kids.length === 1 ? 0.55 : 0.4);
    kids.forEach((kid, i) => {
      const offset = kids.length === 1 ? 0 : (i - (kids.length - 1) / 2) * childR * 1.4;
      circles.set(kid, {
        id: kid,
        cx: parent.cx + offset,
        cy: parent.cy + (depth % 2 === 0 ? 0 : -childR * 0.2),
        r: childR
      });
      placeChildren(kid, depth + 1);
    });
  };
  for (const r of roots) placeChildren(r, 0);
  let sideX = 30;
  for (const s of ast.sets) {
    if (!circles.has(s.id)) {
      circles.set(s.id, { id: s.id, cx: sideX + 60, cy: h / 2, r: 50 });
      sideX += 130;
    }
  }
  const shapes = ast.sets.map((s) => ({
    kind: "circle",
    ...circles.get(s.id) ?? { id: s.id, cx: w / 2, cy: h / 2, r: 40 }
  }));
  const labels = placeLabels(ast, shapes);
  const setLabels = ast.sets.map((s) => {
    const c = circles.get(s.id) ?? { cx: w / 2, cy: h / 2, r: 40 };
    return {
      id: s.id,
      label: s.label,
      x: c.cx,
      y: c.cy - c.r - 6,
      anchor: "middle"
    };
  });
  return {
    width: w,
    height: h,
    mode: "euler",
    shapes,
    labels,
    setLabels,
    ...ast.title ? { title: { text: ast.title, x: w / 2, y: 24 } } : {}
  };
}
function edgeKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
function computeAbsoluteSetSizes(ast) {
  const out = /* @__PURE__ */ new Map();
  for (const s of ast.sets) out.set(s.id, 0);
  for (const r of ast.regions) {
    const num = numericValue(r);
    if (num === null) continue;
    for (const sid of r.sets) {
      out.set(sid, (out.get(sid) ?? 0) + num);
    }
  }
  return out;
}
function numericValue(r) {
  if (r.value.kind === "integer" || r.value.kind === "percent") return r.value.value;
  if (r.value.kind === "list") return r.value.value.length;
  return null;
}
function regionValue(ast, sets) {
  const needle = [...sets].sort().join("|");
  for (const r of ast.regions) {
    const key = [...r.sets].sort().join("|");
    if (key === needle) {
      return numericValue(r);
    }
  }
  return null;
}
function solveProportionalThree(ast, cx, cy) {
  const setA = ast.sets[0];
  const setB = ast.sets[1];
  const setC = ast.sets[2];
  if (!setA || !setB || !setC) return null;
  const sizes = computeAbsoluteSetSizes(ast);
  const s0 = sizes.get(setA.id) ?? 0;
  const s1 = sizes.get(setB.id) ?? 0;
  const s2 = sizes.get(setC.id) ?? 0;
  if (s0 <= 0 || s1 <= 0 || s2 <= 0) return null;
  const maxSize = Math.max(s0, s1, s2);
  const baseR = 130;
  const baseArea = Math.PI * baseR * baseR;
  const perElem = baseArea / maxSize;
  const r0 = Math.sqrt(s0 * perElem / Math.PI);
  const r1 = Math.sqrt(s1 * perElem / Math.PI);
  const r2 = Math.sqrt(s2 * perElem / Math.PI);
  const p01 = regionValue(ast, [setA.id, setB.id]) ?? 0;
  const p02 = regionValue(ast, [setA.id, setC.id]) ?? 0;
  const p12 = regionValue(ast, [setB.id, setC.id]) ?? 0;
  const d01 = solveTwoCircleDistance(r0, r1, p01 * perElem);
  const d02 = solveTwoCircleDistance(r0, r2, p02 * perElem);
  const d12 = solveTwoCircleDistance(r1, r2, p12 * perElem);
  const x0 = cx - d01 / 2;
  const y0 = cy + d01 * 0.1;
  const x1 = x0 + d01;
  const y1 = y0;
  const ex = x1 - x0;
  const ey = y1 - y0;
  const dxy = Math.sqrt(ex * ex + ey * ey);
  if (dxy < 1e-6) return null;
  const a = (d02 * d02 - d12 * d12 + dxy * dxy) / (2 * dxy);
  const hSq = d02 * d02 - a * a;
  const h = hSq > 0 ? Math.sqrt(hSq) : 0;
  const px = x0 + a * ex / dxy;
  const py = y0 + a * ey / dxy;
  const x2 = px - h * ey / dxy;
  const y2 = py - h * ex / dxy;
  const avgX = (x0 + x1 + x2) / 3;
  const avgY = (y0 + y1 + y2) / 3;
  const offX = cx - avgX;
  const offY = cy - avgY;
  return [
    { id: setA.id, cx: x0 + offX, cy: y0 + offY, r: r0 },
    { id: setB.id, cx: x1 + offX, cy: y1 + offY, r: r1 },
    { id: setC.id, cx: x2 + offX, cy: y2 + offY, r: r2 }
  ];
}
function formatRegionValue(r) {
  switch (r.value.kind) {
    case "integer":
      return String(r.value.value);
    case "percent":
      return `${r.value.value}%`;
    case "text":
      return r.value.value;
    case "list":
      return r.value.value.join(", ");
    case "none":
      return "";
  }
}

// src/diagrams/venn/renderer.ts
function ellipseEl(attrs) {
  return chunk7ZEDTSU3_cjs.el("ellipse", attrs);
}
function idSlug(id) {
  return id.replace(/[^A-Za-z0-9_-]/g, "_");
}
function buildCss(tokens) {
  return `
.schematex-venn { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
.schematex-venn-title { font: 600 16px sans-serif; fill: ${tokens.text}; }
.schematex-venn-set { stroke: ${tokens.vennSetStroke}; stroke-width: 1.25; }
.schematex-venn-blend-multiply { mix-blend-mode: multiply; }
.schematex-venn-blend-screen { mix-blend-mode: screen; }
.schematex-venn-setlabel { font: 600 13px sans-serif; fill: ${tokens.text}; }
.schematex-venn-label { font: 500 12px sans-serif; fill: ${tokens.vennLabelColor}; dominant-baseline: central; text-anchor: middle; }
.schematex-venn-label-external { font: 500 11px sans-serif; fill: ${tokens.vennLabelColor}; dominant-baseline: central; }
.schematex-venn-leader { stroke: ${tokens.vennLeaderColor}; stroke-width: 0.7; fill: none; opacity: 0.8; }
.schematex-venn-leader-dot { fill: ${tokens.vennLeaderColor}; }
.schematex-venn-handle { fill: #fff; stroke: #2563eb; stroke-width: 2; vector-effect: non-scaling-stroke; }
`.trim();
}
function geometryRanges(source) {
  const result = /* @__PURE__ */ new Map();
  if (!source) return result;
  const locator = chunk54Q7JDQB_cjs.createSourceLocator(source);
  const number = "[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?";
  let offset = 0;
  for (const rawLine of source.split(/\n/)) {
    const line = rawLine.replace(/\r$/, "");
    const declaration = /^\s*set\s+([A-Za-z][\w-]*)\b/i.exec(line);
    if (!declaration) {
      offset += rawLine.length + 1;
      continue;
    }
    const id = declaration[1];
    const at = new RegExp(`\\bat\\s*:\\s*\\(\\s*(${number})\\s*,\\s*(${number})\\s*\\)`, "i").exec(line);
    const radius = new RegExp(`\\bradius\\s*:\\s*(${number})`, "i").exec(line);
    const closeBracket = line.lastIndexOf("]");
    const openBracket = closeBracket >= 0 ? line.lastIndexOf("[", closeBracket) : -1;
    const insertAt = closeBracket >= 0 ? closeBracket : line.length;
    const hasProps = openBracket >= 0 && line.slice(openBracket + 1, closeBracket).trim().length > 0;
    const center = at ? (() => {
      const first = offset + at.index + at[0].indexOf(at[1]);
      const second = offset + at.index + at[0].lastIndexOf(at[2]);
      return { range: locator.range(first, second + at[2].length) };
    })() : {
      range: locator.range(offset + insertAt, offset + insertAt),
      prefix: closeBracket >= 0 ? `${hasProps ? ", " : ""}at: (` : " [at: (",
      suffix: closeBracket >= 0 ? ")" : ")]"
    };
    const radiusRange = radius ? (() => {
      const value = offset + radius.index + radius[0].lastIndexOf(radius[1]);
      return { range: locator.range(value, value + radius[1].length) };
    })() : {
      range: locator.range(offset + insertAt, offset + insertAt),
      prefix: closeBracket >= 0 ? `${hasProps ? ", " : ""}radius: ` : " [radius: ",
      suffix: closeBracket >= 0 ? "" : "]"
    };
    result.set(id, { center, radius: radiusRange });
    offset += rawLine.length + 1;
  }
  return result;
}
function renderShape(shape, index, color, opacity, setLabel, sceneKey) {
  const classes = `schematex-venn-set schematex-venn-set-${index}`;
  const hoverTitle = chunk7ZEDTSU3_cjs.title(`Set ${setLabel}`);
  if (shape.kind === "circle") {
    return chunk7ZEDTSU3_cjs.el(
      "g",
      {
        class: `schematex-venn-set-group schematex-venn-set-group-${index}`,
        ...sceneKey ? { "data-sx-key": sceneKey } : {}
      },
      [
        chunk7ZEDTSU3_cjs.circle({
          cx: shape.cx,
          cy: shape.cy,
          r: shape.r,
          class: classes,
          fill: color,
          "fill-opacity": opacity,
          "data-set-id": idSlug(shape.id)
        }),
        hoverTitle
      ]
    );
  }
  return chunk7ZEDTSU3_cjs.el(
    "g",
    {
      class: `schematex-venn-set-group schematex-venn-set-group-${index}`,
      ...sceneKey ? { "data-sx-key": sceneKey } : {}
    },
    [
      ellipseEl({
        cx: shape.cx,
        cy: shape.cy,
        rx: shape.rx,
        ry: shape.ry,
        transform: `rotate(${shape.rotation} ${shape.cx} ${shape.cy})`,
        class: classes,
        fill: color,
        "fill-opacity": opacity,
        "data-set-id": idSlug(shape.id)
      }),
      hoverTitle
    ]
  );
}
function renderVennAST(ast, options = {}) {
  const layout = layoutVenn(ast);
  return renderVennLayout(ast, layout, options);
}
function renderVennLayout(ast, layout, options = {}) {
  const tokens = chunk7ZEDTSU3_cjs.resolveVennTheme(options.theme ?? "default");
  const effectiveBlend = ast.config.blendMode === "none" ? "none" : ast.config.blendMode || tokens.vennBlendMode;
  const css = buildCss(tokens);
  const colors = tokens.vennSetColors;
  const config = options;
  const authoredGeometry = geometryRanges(config.__source);
  const handleEls = [];
  const shapeEls = layout.shapes.map((shape, i) => {
    const color = ast.sets[i]?.color ?? colors[i % colors.length] ?? "#4E79A7";
    const ranges = authoredGeometry.get(shape.id);
    const sceneKey = ranges && config.__scene ? `venn:set:${shape.id}` : void 0;
    if (sceneKey && ranges && config.__scene) {
      const halfWidth = shape.kind === "circle" ? shape.r : shape.rx;
      const halfHeight = shape.kind === "circle" ? shape.r : shape.ry;
      config.__scene.push({
        key: sceneKey,
        kind: "node",
        semanticId: shape.id,
        label: ast.sets[i]?.label ?? shape.id,
        bbox: {
          x: shape.cx - halfWidth,
          y: shape.cy - halfHeight,
          width: halfWidth * 2,
          height: halfHeight * 2
        },
        positionSource: {
          kind: "point",
          range: ranges.center.range,
          x: shape.cx / layout.width,
          y: shape.cy / layout.height,
          unitsPerSvgX: 1 / layout.width,
          unitsPerSvgY: 1 / layout.height,
          prefix: ranges.center.prefix,
          suffix: ranges.center.suffix
        },
        editable: { label: false, position: "free" }
      });
      const radius = shape.kind === "circle" ? shape.r : shape.rx;
      const handleKey = `venn:set:${shape.id}:radius`;
      config.__scene.push({
        key: handleKey,
        kind: "handle",
        semanticId: `${shape.id}:radius`,
        bbox: { x: shape.cx + radius - 6, y: shape.cy - 6, width: 12, height: 12 },
        positionSource: {
          kind: "scalar",
          range: ranges.radius.range,
          value: radius / Math.min(layout.width, layout.height),
          unitsPerSvgX: 1 / Math.min(layout.width, layout.height),
          min: 0.04,
          max: 0.8,
          prefix: ranges.radius.prefix,
          suffix: ranges.radius.suffix
        },
        editable: { label: false, position: "move-x" }
      });
      handleEls.push(chunk7ZEDTSU3_cjs.circle({
        cx: shape.cx + radius,
        cy: shape.cy,
        r: 5,
        class: "schematex-venn-handle",
        "data-sx-key": handleKey,
        "aria-label": `Resize set ${shape.id}`
      }));
    }
    return renderShape(shape, i, color, tokens.vennSetOpacity, ast.sets[i]?.label ?? shape.id, sceneKey);
  });
  const shapesGroup = chunk7ZEDTSU3_cjs.group(
    {
      class: `schematex-venn-shapes ${effectiveBlend !== "none" ? `schematex-venn-blend-${effectiveBlend}` : ""}`.trim(),
      ...effectiveBlend !== "none" ? { style: `mix-blend-mode: ${effectiveBlend}` } : {}
    },
    shapeEls
  );
  const setLabelEls = layout.setLabels.map(
    (s) => chunk7ZEDTSU3_cjs.text(
      {
        x: s.x,
        y: s.y,
        class: "schematex-venn-setlabel",
        "text-anchor": s.anchor
      },
      s.label
    )
  );
  const labelEls = [];
  const leaderEls = [];
  for (const label of layout.labels) {
    const cls = label.external ? "schematex-venn-label schematex-venn-label-external" : "schematex-venn-label";
    labelEls.push(
      chunk7ZEDTSU3_cjs.text(
        {
          x: label.x,
          y: label.y,
          class: cls,
          "text-anchor": label.anchor ?? "middle",
          "data-region": label.sets.join("-")
        },
        label.label
      )
    );
    if (label.external && label.leader) {
      leaderEls.push(
        chunk7ZEDTSU3_cjs.path({
          d: `M ${label.leader.x1} ${label.leader.y1} L ${label.leader.x2} ${label.leader.y2}`,
          class: "schematex-venn-leader",
          "aria-hidden": "true"
        })
      );
      leaderEls.push(
        chunk7ZEDTSU3_cjs.circle({
          cx: label.leader.x1,
          cy: label.leader.y1,
          r: 1.5,
          class: "schematex-venn-leader-dot",
          "aria-hidden": "true"
        })
      );
    }
  }
  const titleBlock = layout.title ? chunk7ZEDTSU3_cjs.text(
    {
      x: layout.title.x,
      y: layout.title.y,
      class: "schematex-venn-title",
      "text-anchor": "middle"
    },
    layout.title.text
  ) : "";
  const nonEmptyRegions = ast.regions.length;
  const description = `Venn/Euler diagram${ast.title ? ` "${ast.title}"` : ""}: ${ast.sets.length} sets, ${nonEmptyRegions} regions.`;
  const body = [
    chunk7ZEDTSU3_cjs.title(ast.title ?? "Venn diagram"),
    chunk7ZEDTSU3_cjs.desc(description),
    chunk7ZEDTSU3_cjs.el("style", {}, css),
    titleBlock,
    shapesGroup,
    chunk7ZEDTSU3_cjs.group({ class: "schematex-venn-handles" }, handleEls),
    chunk7ZEDTSU3_cjs.group({ class: "schematex-venn-leaders" }, leaderEls),
    chunk7ZEDTSU3_cjs.group({ class: "schematex-venn-setlabels" }, setLabelEls),
    chunk7ZEDTSU3_cjs.group({ class: "schematex-venn-labels" }, labelEls)
  ];
  return chunk7ZEDTSU3_cjs.svgRoot(
    {
      viewBox: `0 0 ${layout.width} ${layout.height}`,
      width: layout.width,
      height: layout.height,
      class: "schematex-venn",
      role: "img"
    },
    body
  );
}
function renderVenn(text2, options = {}) {
  const ast = parseVennDSL(text2);
  return renderVennAST(ast, options);
}

// src/diagrams/venn/index.ts
var venn = {
  type: "venn",
  detect(text2) {
    const first = text2.trim().split("\n")[0]?.trim().toLowerCase() ?? "";
    return first.startsWith("venn");
  },
  parse: parseVennDSL,
  render(text2, config) {
    return renderVenn(text2, config);
  }
};

exports.VennParseError = VennParseError;
exports.layoutVenn = layoutVenn;
exports.parseVennDSL = parseVennDSL;
exports.renderVenn = renderVenn;
exports.renderVennAST = renderVennAST;
exports.renderVennLayout = renderVennLayout;
exports.venn = venn;
//# sourceMappingURL=chunk-VZAMNYRV.cjs.map
//# sourceMappingURL=chunk-VZAMNYRV.cjs.map