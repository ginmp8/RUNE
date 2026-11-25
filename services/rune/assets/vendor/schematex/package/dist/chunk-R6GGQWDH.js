import { firstContentLine } from './chunk-BTVWLNZ5.js';
import { didYouMean } from './chunk-PIV2A3HG.js';
import { matchQuotedTitle } from './chunk-ISQCUPQR.js';
import { el, text, group, resolveIndustrialTheme, title, desc, defs, path, svgRoot, line } from './chunk-ZUMTE4E7.js';

// src/diagrams/sld/parser.ts
var SLDParseError = class extends Error {
  line;
  source;
  constructor(message, line2, source) {
    super(line2 !== void 0 ? `Line ${line2}: ${message}` : message);
    this.name = "SLDParseError";
    this.line = line2;
    this.source = source;
  }
};
var NODE_TYPES = /* @__PURE__ */ new Set([
  "utility",
  "generator",
  "solar",
  "wind",
  "ups",
  "transformer",
  "transformer_dy",
  "transformer_yd",
  "transformer_yy",
  "transformer_dd",
  "autotransformer",
  "transformer_3winding",
  "bus",
  "bus_tie",
  "hub",
  "breaker",
  "breaker_vacuum",
  "switch",
  "switch_load",
  "ground_switch",
  "ats",
  "recloser",
  "sectionalizer",
  "fuse",
  "fuse_cl",
  "ct",
  "pt",
  "relay",
  "surge_arrester",
  "ground_fault",
  "rcd",
  "motor",
  "load",
  "capacitor_bank",
  "harmonic_filter",
  "vfd",
  "watthour_meter",
  "demand_meter",
  "consumer_unit"
]);
var TYPE_ALIASES = {
  mcb: "breaker",
  mccb: "breaker",
  miniature_circuit_breaker: "breaker",
  rcd: "rcd",
  rcbo: "rcd",
  rccb: "rcd",
  differential: "rcd",
  diferencial: "rcd",
  pia: "breaker",
  iga: "breaker",
  main_switch: "switch_load",
  isolator: "switch_load",
  disconnector: "switch_load",
  db: "consumer_unit",
  cu: "consumer_unit",
  consumer_unit: "consumer_unit",
  distribution_board: "consumer_unit",
  panel: "consumer_unit",
  panelboard: "consumer_unit"
};
function stripComment(s) {
  let out = "";
  let inQuote = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"') inQuote = !inQuote;
    if (!inQuote) {
      if (ch === "#") break;
      if (ch === "/" && s[i + 1] === "/") break;
      if (ch === "%" && s[i + 1] === "%") break;
    }
    out += ch;
  }
  return out;
}
function stripQuotes(v) {
  const t = v.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) {
    return t.slice(1, -1);
  }
  return t;
}
function splitAttrs(inside) {
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
  const out = [];
  for (const p of parts) {
    const s = p.trim();
    if (!s) continue;
    const colon = s.indexOf(":");
    if (colon < 0) {
      throw new SLDParseError(`Invalid attribute "${s}" (missing ":")`);
    }
    const k = s.slice(0, colon).trim();
    const v = stripQuotes(s.slice(colon + 1));
    out.push([k, v]);
  }
  return out;
}
function applyAttrs(node, attrs) {
  for (const [k, v] of attrs) {
    const key = k.toLowerCase();
    if (key === "label") node.label = v;
    else if (key === "voltage") node.voltage = v;
    else if (key === "rating") node.rating = v;
    else if (key === "device") node.deviceNumber = v;
    else {
      if (!node.nameplate) node.nameplate = {};
      node.nameplate[k] = v;
    }
  }
}
function joinBrackets(lines) {
  const out = [];
  let buf = "";
  let depth = 0;
  for (const raw of lines) {
    const line2 = stripComment(raw);
    if (!line2.trim() && depth === 0) {
      if (buf) {
        out.push(buf);
        buf = "";
      }
      out.push("");
      continue;
    }
    for (const ch of line2) {
      if (ch === "[") depth++;
      else if (ch === "]") depth = Math.max(0, depth - 1);
    }
    buf = buf ? buf + " " + line2.trim() : line2;
    if (depth === 0) {
      out.push(buf);
      buf = "";
    }
  }
  if (buf) out.push(buf);
  return out;
}
function parseSLDDSL(text2) {
  const rawLines = text2.split("\n").map((l) => l.replace(/\r$/, ""));
  const lines = joinBrackets(rawLines);
  let title2;
  let standard;
  const nodes = [];
  const nodeMap = /* @__PURE__ */ new Map();
  const connections = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line2 = raw.trim();
    if (!line2) continue;
    if (/^sld\b/i.test(line2)) {
      const t = matchQuotedTitle(line2);
      if (t !== void 0) title2 = t;
      const bracket = line2.match(/\[([^\]]*)\]/);
      if (bracket) {
        for (const [k, v] of splitAttrs(bracket[1])) {
          if (k.toLowerCase() === "standard") {
            const s = v.trim().toLowerCase();
            if (s === "ansi" || s === "iec" || s === "abnt" || s === "as-nzs") {
              standard = s;
            } else {
              throw new SLDParseError(
                `Unknown standard "${v}". Valid: ansi, iec, abnt, as-nzs`,
                i + 1,
                line2
              );
            }
          }
        }
      }
      continue;
    }
    const connMatch = line2.match(
      /^([A-Za-z][A-Za-z0-9_-]*)\s*->\s*([A-Za-z][A-Za-z0-9_-]*)(?:\s*\[([^\]]*)\])?\s*$/
    );
    if (connMatch) {
      const from = connMatch[1];
      const to = connMatch[2];
      const c = { from, to };
      if (connMatch[3]) {
        for (const [k, v] of splitAttrs(connMatch[3])) {
          const key = k.toLowerCase();
          if (key === "cable") c.cable = v;
          else if (key === "cable_csa" || key === "csa") c.cableCsa = v;
          else if (key === "cable_length_m" || key === "length_m") c.cableLengthM = v;
          else if (key === "cable_insulation" || key === "insulation") c.cableInsulation = v;
          else if (key === "label") c.label = v;
        }
      }
      connections.push(c);
      continue;
    }
    const nodeMatch = line2.match(
      /^([A-Za-z][A-Za-z0-9_-]*)\s*=\s*([a-zA-Z_][a-zA-Z0-9_]*)(?:\s*\[([^\]]*)\])?\s*$/
    );
    if (nodeMatch) {
      const id = nodeMatch[1];
      const rawType = nodeMatch[2].toLowerCase();
      const canonical = TYPE_ALIASES[rawType] ?? rawType;
      if (nodeMap.has(id)) {
        throw new SLDParseError(`Duplicate node id "${id}"`, i + 1, line2);
      }
      const isKnown = NODE_TYPES.has(canonical);
      const node = isKnown ? { id, nodeType: canonical } : { id, nodeType: "unknown", rawType: nodeMatch[2] };
      if (isKnown && TYPE_ALIASES[rawType]) {
        node.label = rawType.toUpperCase();
      }
      if (nodeMatch[3]) {
        applyAttrs(node, splitAttrs(nodeMatch[3]));
      }
      nodes.push(node);
      nodeMap.set(id, node);
      continue;
    }
    throw new SLDParseError(`Cannot parse line`, i + 1, line2);
  }
  for (const c of connections) {
    if (!nodeMap.has(c.from)) {
      throw new SLDParseError(`Connection references unknown node "${c.from}"`);
    }
    if (!nodeMap.has(c.to)) {
      throw new SLDParseError(`Connection references unknown node "${c.to}"`);
    }
  }
  if (nodes.length === 0) {
    throw new SLDParseError("SLD diagram has no nodes");
  }
  return { type: "sld", title: title2, standard, nodes, connections };
}

// src/core/types.ts
function isIecFamily(standard) {
  return standard === "iec" || standard === "abnt" || standard === "as-nzs";
}

// src/diagrams/sld/symbols.ts
var DEFAULT_GEOMETRY = {
  halfWidth: 20,
  topY: -20,
  bottomY: 20
};
function geometryFor(type) {
  switch (type) {
    case "utility":
    case "generator":
    case "solar":
    case "wind":
      return { halfWidth: 18, topY: -24, bottomY: 18 };
    case "transformer":
    case "transformer_dy":
    case "transformer_yd":
    case "transformer_yy":
    case "transformer_dd":
    case "autotransformer":
    case "transformer_3winding":
      return { halfWidth: 22, topY: -24, bottomY: 24 };
    case "breaker":
    case "breaker_vacuum":
    case "recloser":
    case "switch":
    case "switch_load":
    case "ground_switch":
    case "sectionalizer":
      return { halfWidth: 18, topY: -18, bottomY: 18 };
    case "fuse":
    case "fuse_cl":
      return { halfWidth: 14, topY: -18, bottomY: 18 };
    case "motor":
      return { halfWidth: 16, topY: -16, bottomY: 22 };
    case "load":
    case "capacitor_bank":
    case "harmonic_filter":
      return { halfWidth: 20, topY: -14, bottomY: 14 };
    case "vfd":
    case "ups":
      return { halfWidth: 24, topY: -18, bottomY: 18 };
    case "ats":
      return { halfWidth: 22, topY: -18, bottomY: 18 };
    case "ct":
    case "pt":
      return { halfWidth: 10, topY: -16, bottomY: 16 };
    case "relay":
      return { halfWidth: 12, topY: -12, bottomY: 12 };
    case "surge_arrester":
      return { halfWidth: 12, topY: -16, bottomY: 26 };
    case "watthour_meter":
    case "demand_meter":
    case "ground_fault":
    case "rcd":
      return { halfWidth: 14, topY: -14, bottomY: 14 };
    case "consumer_unit":
      return { halfWidth: 52, topY: -24, bottomY: 24 };
    case "bus":
      return DEFAULT_GEOMETRY;
    case "hub":
      return { halfWidth: 52, topY: -20, bottomY: 20 };
    case "bus_tie":
      return { halfWidth: 16, topY: -10, bottomY: 10 };
    default:
      return DEFAULT_GEOMETRY;
  }
}
function lineEl(x1, y1, x2, y2, cls = "lt-sld-stroke") {
  return line({ x1, y1, x2, y2, class: cls });
}
function utilitySymbol() {
  return group({}, [
    el("circle", { cx: 0, cy: 0, r: 16, class: "lt-sld-fill" }),
    path({ d: "M -8 0 Q -4 -8 0 0 Q 4 8 8 0", class: "lt-sld-stroke", fill: "none" }),
    // lead wires in/out
    lineEl(0, -24, 0, -16),
    lineEl(0, 16, 0, 18)
  ]);
}
function generatorSymbol() {
  return group({}, [
    el("circle", { cx: 0, cy: 0, r: 16, class: "lt-sld-fill" }),
    text({ x: 0, y: -2, class: "lt-sld-symbol-text", "text-anchor": "middle", "font-weight": "bold", "font-size": "14" }, "G"),
    path({ d: "M -6 6 Q -3 1 0 6 Q 3 11 6 6", class: "lt-sld-stroke", fill: "none" }),
    lineEl(0, -24, 0, -16),
    lineEl(0, 16, 0, 18)
  ]);
}
function solarSymbol() {
  return group({}, [
    el("rect", { x: -18, y: -12, width: 36, height: 24, class: "lt-sld-fill" }),
    lineEl(-18, -4, 18, -4),
    lineEl(-18, 4, 18, 4),
    lineEl(-6, -12, -6, 12),
    lineEl(6, -12, 6, 12),
    lineEl(0, 12, 0, 18)
  ]);
}
function windSymbol() {
  return group({}, [
    el("circle", { cx: 0, cy: 0, r: 6, class: "lt-sld-fill" }),
    lineEl(0, -6, 0, -22),
    path({ d: "M 0 -6 L 14 -2 L 0 0 Z", class: "lt-sld-fill-dark" }),
    path({ d: "M 0 -6 L -10 8 L 0 2 Z", class: "lt-sld-fill-dark" }),
    path({ d: "M 0 -6 L -6 -18 L 2 -6 Z", class: "lt-sld-fill-dark" }),
    lineEl(0, 6, 0, 18)
  ]);
}
function upsSymbol() {
  return group({}, [
    el("rect", { x: -22, y: -16, width: 44, height: 32, class: "lt-sld-fill" }),
    text({ x: 0, y: 4, class: "lt-sld-symbol-text", "text-anchor": "middle", "font-weight": "bold", "font-size": "11" }, "UPS")
  ]);
}
function transformerSymbol(type) {
  const pieces = [];
  pieces.push(
    path({
      d: "M -12 -18 A 4 4 0 0 1 -4 -18 A 4 4 0 0 1 4 -18 A 4 4 0 0 1 12 -18",
      class: "lt-sld-stroke",
      fill: "none"
    })
  );
  pieces.push(lineEl(-14, -8, 14, -8));
  pieces.push(lineEl(-14, -4, 14, -4));
  pieces.push(
    path({
      d: "M -12 18 A 4 4 0 0 0 -4 18 A 4 4 0 0 0 4 18 A 4 4 0 0 0 12 18",
      class: "lt-sld-stroke",
      fill: "none"
    })
  );
  pieces.push(el("circle", { cx: -10, cy: -14, r: 2, class: "lt-sld-dot" }));
  pieces.push(el("circle", { cx: 10, cy: 14, r: 2, class: "lt-sld-dot" }));
  pieces.push(lineEl(0, -24, 0, -22));
  pieces.push(lineEl(0, 22, 0, 24));
  const { primary, secondary } = windingGlyphs(type);
  if (primary) pieces.push(text({ x: 20, y: -14, class: "lt-sld-wdg", "text-anchor": "start" }, primary));
  if (secondary) pieces.push(text({ x: 20, y: 18, class: "lt-sld-wdg", "text-anchor": "start" }, secondary));
  return group({}, pieces);
}
function windingGlyphs(type) {
  switch (type) {
    case "transformer_dy":
      return { primary: "\u0394", secondary: "Y" };
    case "transformer_yd":
      return { primary: "Y", secondary: "\u0394" };
    case "transformer_yy":
      return { primary: "Y", secondary: "Y" };
    case "transformer_dd":
      return { primary: "\u0394", secondary: "\u0394" };
    default:
      return {};
  }
}
function autotransformerSymbol() {
  return group({}, [
    path({
      d: "M 0 -20 A 6 6 0 0 1 0 -10 A 6 6 0 0 1 0 0 A 6 6 0 0 1 0 10 A 6 6 0 0 1 0 20",
      class: "lt-sld-stroke",
      fill: "none"
    }),
    lineEl(6, 0, 14, 0),
    lineEl(0, -24, 0, -20),
    lineEl(0, 20, 0, 24)
  ]);
}
function threeWindingSymbol() {
  return group({}, [
    // top coil
    path({ d: "M -10 -18 A 3 3 0 0 1 -4 -18 A 3 3 0 0 1 2 -18 A 3 3 0 0 1 8 -18", class: "lt-sld-stroke", fill: "none" }),
    // left-bottom coil
    path({ d: "M -18 6 A 3 3 0 0 1 -12 6 A 3 3 0 0 1 -6 6 A 3 3 0 0 1 0 6", class: "lt-sld-stroke", fill: "none" }),
    // right-bottom coil
    path({ d: "M 0 6 A 3 3 0 0 1 6 6 A 3 3 0 0 1 12 6 A 3 3 0 0 1 18 6", class: "lt-sld-stroke", fill: "none" }),
    lineEl(-14, -8, 14, -8),
    lineEl(0, -24, 0, -18),
    lineEl(-9, 10, -9, 24),
    lineEl(9, 10, 9, 24)
  ]);
}
function breakerSymbol() {
  return group({}, [
    lineEl(0, -14, 0, -10, "lt-sld-stroke"),
    lineEl(0, 10, 0, 14, "lt-sld-stroke"),
    line({ x1: -6, y1: 10, x2: 8, y2: -10, class: "lt-sld-stroke-thick" }),
    path({ d: "M 8 -10 Q 14 -12 12 -18", class: "lt-sld-stroke", fill: "none" }),
    lineEl(0, -18, 0, -14),
    lineEl(0, 14, 0, 18)
  ]);
}
function vacuumBreakerSymbol() {
  return group({}, [
    el("ellipse", { cx: 0, cy: 0, rx: 10, ry: 14, class: "lt-sld-fill" }),
    line({ x1: -6, y1: 10, x2: 8, y2: -10, class: "lt-sld-stroke-thick" }),
    text({ x: -2, y: -4, class: "lt-sld-symbol-text", "text-anchor": "middle", "font-size": "8" }, "V"),
    lineEl(0, -18, 0, -14),
    lineEl(0, 14, 0, 18)
  ]);
}
function recloserSymbol() {
  return group({}, [
    line({ x1: -6, y1: 10, x2: 8, y2: -10, class: "lt-sld-stroke-thick" }),
    path({ d: "M 8 -10 Q 14 -12 12 -18", class: "lt-sld-stroke", fill: "none" }),
    path({ d: "M 14 -6 A 5 5 0 1 1 18 -4", class: "lt-sld-stroke", fill: "none" }),
    el("polygon", { points: "18,-4 20,-8 15,-7", class: "lt-sld-dot" }),
    lineEl(0, -18, 0, -14),
    lineEl(0, 14, 0, 18)
  ]);
}
function switchSymbol(open = false) {
  const pieces = [];
  if (open) {
    pieces.push(line({ x1: -6, y1: 10, x2: 10, y2: -8, class: "lt-sld-stroke-thick" }));
    pieces.push(el("circle", { cx: 10, cy: -8, r: 2, class: "lt-sld-fill" }));
  } else {
    pieces.push(line({ x1: -6, y1: 10, x2: 8, y2: -10, class: "lt-sld-stroke-thick" }));
  }
  pieces.push(lineEl(0, -18, 0, -10));
  pieces.push(lineEl(0, 10, 0, 18));
  return group({}, pieces);
}
function loadSwitchSymbol() {
  return group({}, [
    line({ x1: -6, y1: 10, x2: 8, y2: -10, class: "lt-sld-stroke-thick" }),
    el("rect", { x: 6, y: -14, width: 6, height: 6, class: "lt-sld-fill" }),
    lineEl(0, -18, 0, -10),
    lineEl(0, 10, 0, 18)
  ]);
}
function groundSwitchSymbol() {
  return group({}, [
    line({ x1: -6, y1: 0, x2: 8, y2: -14, class: "lt-sld-stroke-thick" }),
    lineEl(0, -18, 0, -4),
    // ground symbol
    lineEl(-8, 6, 8, 6),
    lineEl(-5, 10, 5, 10),
    lineEl(-2, 14, 2, 14),
    lineEl(0, 0, 0, 6)
  ]);
}
function sectionalizerSymbol() {
  return group({}, [
    line({ x1: -6, y1: 10, x2: 10, y2: -8, class: "lt-sld-stroke-thick" }),
    el("circle", { cx: 10, cy: -8, r: 2, class: "lt-sld-fill" }),
    text({ x: 14, y: -4, class: "lt-sld-wdg", "text-anchor": "start" }, "S"),
    lineEl(0, -18, 0, -10),
    lineEl(0, 10, 0, 18)
  ]);
}
function fuseSymbol() {
  return group({}, [
    el("rect", { x: -5, y: -10, width: 10, height: 20, class: "lt-sld-fill" }),
    lineEl(0, -18, 0, -10),
    lineEl(0, 10, 0, 18)
  ]);
}
function fuseCLSymbol() {
  return group({}, [
    el("rect", { x: -6, y: -12, width: 12, height: 24, class: "lt-sld-fill" }),
    lineEl(-6, 0, 6, 0),
    lineEl(0, -18, 0, -12),
    lineEl(0, 12, 0, 18)
  ]);
}
function motorSymbol() {
  return group({}, [
    el("circle", { cx: 0, cy: 0, r: 14, class: "lt-sld-fill" }),
    text({ x: 0, y: 5, class: "lt-sld-symbol-text", "text-anchor": "middle", "font-weight": "bold", "font-size": "13" }, "M"),
    lineEl(0, -16, 0, -14),
    // 3-phase dots at bottom
    el("circle", { cx: -6, cy: 12, r: 1.5, class: "lt-sld-dot" }),
    el("circle", { cx: 0, cy: 14, r: 1.5, class: "lt-sld-dot" }),
    el("circle", { cx: 6, cy: 12, r: 1.5, class: "lt-sld-dot" })
  ]);
}
function loadSymbol() {
  return group({}, [
    el("rect", { x: -16, y: -12, width: 32, height: 24, class: "lt-sld-fill" })
  ]);
}
function capacitorBankSymbol() {
  return group({}, [
    lineEl(-10, -6, 10, -6, "lt-sld-stroke-thick"),
    lineEl(-10, -2, 10, -2, "lt-sld-stroke-thick"),
    lineEl(-10, 4, 10, 4, "lt-sld-stroke-thick"),
    lineEl(-10, 8, 10, 8, "lt-sld-stroke-thick"),
    lineEl(0, -14, 0, -6),
    lineEl(0, 8, 0, 14)
  ]);
}
function harmonicFilterSymbol() {
  return group({}, [
    // L + C chained
    path({ d: "M -14 -4 A 3 3 0 0 1 -8 -4 A 3 3 0 0 1 -2 -4 A 3 3 0 0 1 4 -4", class: "lt-sld-stroke", fill: "none" }),
    lineEl(4, -8, 14, -8),
    lineEl(4, 0, 14, 0),
    lineEl(0, -14, 0, -4),
    lineEl(0, 4, 0, 14)
  ]);
}
function vfdSymbol() {
  return group({}, [
    el("rect", { x: -22, y: -16, width: 44, height: 32, class: "lt-sld-fill" }),
    text({ x: 0, y: -2, class: "lt-sld-symbol-text", "text-anchor": "middle", "font-weight": "bold", "font-size": "11" }, "VFD"),
    path({ d: "M -10 8 Q -5 2 0 8 Q 5 14 10 8", class: "lt-sld-stroke", fill: "none" }),
    lineEl(0, -18, 0, -16),
    lineEl(0, 16, 0, 18)
  ]);
}
function atsSymbol() {
  return group({}, [
    el("rect", { x: -22, y: -16, width: 44, height: 32, class: "lt-sld-fill" }),
    line({ x1: -14, y1: -8, x2: -2, y2: 6, class: "lt-sld-stroke-thick" }),
    line({ x1: 14, y1: -8, x2: 2, y2: 6, class: "lt-sld-stroke-thick" }),
    text({ x: 0, y: 14, class: "lt-sld-symbol-text", "text-anchor": "middle", "font-weight": "bold", "font-size": "9" }, "ATS"),
    lineEl(-12, -18, -12, -16),
    lineEl(12, -18, 12, -16),
    lineEl(0, 16, 0, 18)
  ]);
}
function ctSymbol() {
  return group({}, [
    el("circle", { cx: 0, cy: 0, r: 7, class: "lt-sld-fill" }),
    text({ x: 0, y: 3, class: "lt-sld-wdg", "text-anchor": "middle", "font-size": "7" }, "CT"),
    lineEl(0, -16, 0, -7),
    lineEl(0, 7, 0, 16)
  ]);
}
function ptSymbol() {
  return group({}, [
    el("circle", { cx: 0, cy: 0, r: 7, class: "lt-sld-fill" }),
    text({ x: 0, y: 3, class: "lt-sld-wdg", "text-anchor": "middle", "font-size": "7" }, "PT"),
    lineEl(0, -16, 0, -7),
    lineEl(0, 7, 0, 16)
  ]);
}
function relaySymbol(deviceNumber) {
  return group({}, [
    el("circle", { cx: 0, cy: 0, r: 11, class: "lt-sld-fill" }),
    text({ x: 0, y: 4, class: "lt-sld-wdg", "text-anchor": "middle", "font-size": "10" }, deviceNumber ?? "R")
  ]);
}
function surgeArresterSymbol() {
  return group({}, [
    el("rect", { x: -7, y: -6, width: 14, height: 14, class: "lt-sld-fill" }),
    path({ d: "M -4 2 Q 0 -4 4 2", class: "lt-sld-stroke", fill: "none" }),
    lineEl(0, -16, 0, -6),
    lineEl(0, 8, 0, 14),
    lineEl(-8, 14, 8, 14),
    lineEl(-5, 18, 5, 18),
    lineEl(-2, 22, 2, 22)
  ]);
}
function groundFaultSymbol() {
  return group({}, [
    el("circle", { cx: 0, cy: 0, r: 12, class: "lt-sld-fill" }),
    text({ x: 0, y: 4, class: "lt-sld-wdg", "text-anchor": "middle", "font-size": "9" }, "GFI"),
    lineEl(0, -14, 0, -12),
    lineEl(0, 12, 0, 14)
  ]);
}
function rcdSymbol() {
  return group({}, [
    el("rect", { x: -14, y: -14, width: 28, height: 28, rx: 3, class: "lt-sld-fill" }),
    text({ x: 0, y: -1, class: "lt-sld-wdg", "text-anchor": "middle", "font-size": "8" }, "RCD"),
    text({ x: 0, y: 9, class: "lt-sld-wdg", "text-anchor": "middle", "font-size": "7" }, "I\u0394n"),
    lineEl(0, -14, 0, -18),
    lineEl(0, 14, 0, 18)
  ]);
}
function consumerUnitSymbol(label) {
  const txt = label && label.length <= 9 ? label : "DB";
  return group({}, [
    el("rect", {
      x: -50,
      y: -22,
      width: 100,
      height: 44,
      rx: 4,
      class: "lt-sld-fill",
      "stroke-width": 2
    }),
    lineEl(-38, -8, 38, -8, "lt-sld-stroke-thick"),
    lineEl(-38, 8, 38, 8, "lt-sld-stroke-thick"),
    lineEl(-22, -15, -22, 15),
    lineEl(0, -15, 0, 15),
    lineEl(22, -15, 22, 15),
    text({ x: 0, y: 4, class: "lt-sld-wdg", "text-anchor": "middle", "font-size": "10" }, txt),
    lineEl(0, -24, 0, -22),
    lineEl(0, 22, 0, 24)
  ]);
}
function hubSymbol(label) {
  return group({}, [
    el("rect", {
      x: -50,
      y: -18,
      width: 100,
      height: 36,
      rx: 4,
      ry: 4,
      class: "lt-sld-fill",
      "stroke-width": 2
    }),
    text(
      { x: 0, y: 4, class: "lt-sld-wdg", "text-anchor": "middle", "font-size": "11" },
      label ?? "HUB"
    ),
    lineEl(0, -20, 0, -18),
    lineEl(0, 18, 0, 20),
    // left/right lead stubs for lateral ports
    lineEl(-50, 0, -54, 0),
    lineEl(50, 0, 54, 0)
  ]);
}
function busTieSymbol() {
  return group({}, [
    lineEl(-16, 0, -4, 0),
    lineEl(4, 0, 16, 0),
    path({ d: "M -4 0 L 4 -6", class: "lt-sld-stroke-thick" }),
    path({ d: "M -4 -6 Q 0 -10 4 -6", class: "lt-sld-stroke", fill: "none" })
  ]);
}
function meterSymbol(label) {
  return group({}, [
    el("circle", { cx: 0, cy: 0, r: 12, class: "lt-sld-fill" }),
    text({ x: 0, y: 4, class: "lt-sld-wdg", "text-anchor": "middle", "font-size": "9" }, label),
    lineEl(0, -14, 0, -12),
    lineEl(0, 12, 0, 14)
  ]);
}
function transformerSymbolIEC(type) {
  const pieces = [
    el("circle", { cx: 0, cy: -7, r: 11, class: "lt-sld-stroke" }),
    el("circle", { cx: 0, cy: 7, r: 11, class: "lt-sld-stroke" }),
    lineEl(0, -24, 0, -18),
    lineEl(0, 18, 0, 24)
  ];
  const { primary, secondary } = windingGlyphs(type);
  if (primary) pieces.push(text({ x: 20, y: -10, class: "lt-sld-wdg", "text-anchor": "start" }, primary));
  if (secondary) pieces.push(text({ x: 20, y: 14, class: "lt-sld-wdg", "text-anchor": "start" }, secondary));
  return group({}, pieces);
}
function breakerSymbolIEC() {
  return group({}, [
    lineEl(0, -18, 0, -10),
    lineEl(0, 10, 0, 18),
    // open contact arm pivoting from the bottom terminal
    line({ x1: -6, y1: 10, x2: 6, y2: -8, class: "lt-sld-stroke-thick" }),
    // × at the fixed contact
    line({ x1: -4, y1: -13, x2: 4, y2: -7, class: "lt-sld-stroke" }),
    line({ x1: 4, y1: -13, x2: -4, y2: -7, class: "lt-sld-stroke" })
  ]);
}
function fuseSymbolIEC() {
  return group({}, [
    el("rect", { x: -5, y: -11, width: 10, height: 22, class: "lt-sld-fill" }),
    lineEl(0, -11, 0, 11),
    lineEl(0, -18, 0, -11),
    lineEl(0, 11, 0, 18)
  ]);
}
function renderSymbol(type, detail, standard) {
  if (isIecFamily(standard)) {
    switch (type) {
      case "transformer":
      case "transformer_dy":
      case "transformer_yd":
      case "transformer_yy":
      case "transformer_dd":
        return transformerSymbolIEC(type);
      case "breaker":
        return breakerSymbolIEC();
      case "fuse":
        return fuseSymbolIEC();
    }
  }
  switch (type) {
    case "utility":
      return utilitySymbol();
    case "generator":
      return generatorSymbol();
    case "solar":
      return solarSymbol();
    case "wind":
      return windSymbol();
    case "ups":
      return upsSymbol();
    case "transformer":
    case "transformer_dy":
    case "transformer_yd":
    case "transformer_yy":
    case "transformer_dd":
      return transformerSymbol(type);
    case "autotransformer":
      return autotransformerSymbol();
    case "transformer_3winding":
      return threeWindingSymbol();
    case "breaker":
      return breakerSymbol();
    case "breaker_vacuum":
      return vacuumBreakerSymbol();
    case "recloser":
      return recloserSymbol();
    case "switch":
      return switchSymbol(true);
    case "switch_load":
      return loadSwitchSymbol();
    case "ground_switch":
      return groundSwitchSymbol();
    case "sectionalizer":
      return sectionalizerSymbol();
    case "fuse":
      return fuseSymbol();
    case "fuse_cl":
      return fuseCLSymbol();
    case "motor":
      return motorSymbol();
    case "load":
      return loadSymbol();
    case "capacitor_bank":
      return capacitorBankSymbol();
    case "harmonic_filter":
      return harmonicFilterSymbol();
    case "vfd":
      return vfdSymbol();
    case "ats":
      return atsSymbol();
    case "ct":
      return ctSymbol();
    case "pt":
      return ptSymbol();
    case "relay":
      return relaySymbol(detail);
    case "surge_arrester":
      return surgeArresterSymbol();
    case "ground_fault":
      return groundFaultSymbol();
    case "rcd":
      return rcdSymbol();
    case "watthour_meter":
      return meterSymbol("Wh");
    case "demand_meter":
      return meterSymbol("D");
    case "consumer_unit":
      return consumerUnitSymbol(detail);
    case "bus":
      return "";
    case "hub":
      return hubSymbol(detail);
    case "bus_tie":
      return busTieSymbol();
    case "unknown":
      return placeholderSymbol(detail);
    default:
      return loadSymbol();
  }
}
function placeholderSymbol(detail) {
  const w = 40;
  const h = 30;
  const parts = [
    el("rect", {
      x: -w / 2,
      y: -h / 2,
      width: w,
      height: h,
      rx: 3,
      class: "lt-sld-unknown-box"
    }),
    text({ x: 0, y: 6, "text-anchor": "middle", class: "lt-sld-unknown-mark" }, "?")
  ];
  if (detail) {
    parts.push(
      text(
        { x: 0, y: h / 2 + 11, "text-anchor": "middle", class: "lt-sld-unknown-type" },
        detail.length > 14 ? detail.slice(0, 13) + "\u2026" : detail
      )
    );
  }
  return group({ class: "lt-sld-unknown" }, parts);
}

// src/diagrams/sld/layout.ts
var LEVEL_SPACING = 100;
var H_SPACING = 90;
var LEFT_PADDING = 80;
var TOP_PADDING = 40;
var BUS_OVERHANG = 20;
function computeLevels(ast) {
  const levels = /* @__PURE__ */ new Map();
  const inEdges = /* @__PURE__ */ new Map();
  const outEdges = /* @__PURE__ */ new Map();
  for (const n of ast.nodes) {
    inEdges.set(n.id, []);
    outEdges.set(n.id, []);
  }
  for (const c of ast.connections) {
    inEdges.get(c.to)?.push(c);
    outEdges.get(c.from)?.push(c);
  }
  const roots = ast.nodes.filter((n) => (inEdges.get(n.id) ?? []).length === 0);
  for (const r of roots) levels.set(r.id, 0);
  const typeById = /* @__PURE__ */ new Map();
  for (const n of ast.nodes) typeById.set(n.id, n.nodeType);
  const isTieEdge = (c) => typeById.get(c.from) === "bus_tie" || typeById.get(c.to) === "bus_tie";
  const maxIter = ast.nodes.length + 2;
  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    for (const c of ast.connections) {
      if (isTieEdge(c)) continue;
      const fromLvl = levels.get(c.from);
      if (fromLvl === void 0) continue;
      const want = fromLvl + 1;
      const curr = levels.get(c.to);
      if (curr === void 0 || want > curr) {
        levels.set(c.to, want);
        changed = true;
      }
    }
    if (!changed) break;
  }
  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    for (const c of ast.connections) {
      if (!isTieEdge(c)) continue;
      const fromLvl = levels.get(c.from);
      const toLvl = levels.get(c.to);
      const shared = fromLvl ?? toLvl;
      if (shared === void 0) continue;
      if (fromLvl === void 0 || fromLvl !== shared) {
        levels.set(c.from, shared);
        changed = true;
      }
      if (toLvl === void 0 || toLvl !== shared) {
        levels.set(c.to, shared);
        changed = true;
      }
    }
    if (!changed) break;
  }
  for (const n of ast.nodes) {
    if (!levels.has(n.id)) levels.set(n.id, 0);
  }
  return levels;
}
function orderWithinLevel(ast, levels) {
  const byLevel = /* @__PURE__ */ new Map();
  for (const n of ast.nodes) {
    const lvl = levels.get(n.id) ?? 0;
    if (!byLevel.has(lvl)) byLevel.set(lvl, []);
    byLevel.get(lvl).push(n.id);
  }
  const visited = /* @__PURE__ */ new Set();
  const order = /* @__PURE__ */ new Map();
  let idx = 0;
  const adj = /* @__PURE__ */ new Map();
  for (const n of ast.nodes) adj.set(n.id, []);
  for (const c of ast.connections) adj.get(c.from)?.push(c.to);
  function dfs(id) {
    if (visited.has(id)) return;
    visited.add(id);
    order.set(id, idx++);
    for (const child of adj.get(id) ?? []) dfs(child);
  }
  const inEdgeCount = /* @__PURE__ */ new Map();
  for (const n of ast.nodes) inEdgeCount.set(n.id, 0);
  for (const c of ast.connections) {
    inEdgeCount.set(c.to, (inEdgeCount.get(c.to) ?? 0) + 1);
  }
  for (const n of ast.nodes) {
    if ((inEdgeCount.get(n.id) ?? 0) === 0) dfs(n.id);
  }
  for (const n of ast.nodes) dfs(n.id);
  for (const [lvl, ids] of byLevel.entries()) {
    ids.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
    byLevel.set(lvl, ids);
  }
  return byLevel;
}
function layoutSLD(ast) {
  const levels = computeLevels(ast);
  const byLevel = orderWithinLevel(ast, levels);
  const nodeMap = /* @__PURE__ */ new Map();
  for (const n of ast.nodes) nodeMap.set(n.id, n);
  const layoutNodes = [];
  const byIdLayout = /* @__PURE__ */ new Map();
  const parents = /* @__PURE__ */ new Map();
  const children = /* @__PURE__ */ new Map();
  for (const n of ast.nodes) {
    parents.set(n.id, []);
    children.set(n.id, []);
  }
  for (const c of ast.connections) {
    parents.get(c.to)?.push(c.from);
    children.get(c.from)?.push(c.to);
  }
  const sortedLevels = Array.from(byLevel.keys()).sort((a, b) => a - b);
  const maxLevel = sortedLevels.length ? sortedLevels[sortedLevels.length - 1] : 0;
  let nextX = LEFT_PADDING;
  function placeNode(id) {
    const existing = byIdLayout.get(id);
    if (existing) return existing;
    const node = nodeMap.get(id);
    const lvl = levels.get(id) ?? 0;
    const geom = geometryFor(node.nodeType);
    const y = TOP_PADDING + lvl * LEVEL_SPACING;
    const ln = {
      node,
      nodeType: node.nodeType,
      x: 0,
      y,
      topY: y + geom.topY,
      bottomY: y + geom.bottomY,
      level: lvl,
      halfWidth: geom.halfWidth
    };
    byIdLayout.set(id, ln);
    layoutNodes.push(ln);
    return ln;
  }
  for (const lvl of sortedLevels) {
    for (const id of byLevel.get(lvl)) {
      const ln = placeNode(id);
      if (ln.nodeType === "bus") {
        ln.x = nextX;
      } else {
        ln.x = nextX;
        nextX += H_SPACING;
      }
    }
  }
  for (let iter = 0; iter < 4; iter++) {
    for (const lvl of sortedLevels) {
      for (const id of byLevel.get(lvl)) {
        const ln = byIdLayout.get(id);
        if (ln.nodeType !== "bus") continue;
        const childrenIds = children.get(id) ?? [];
        const parentIds = parents.get(id) ?? [];
        const relatedXs = [];
        for (const cid of childrenIds) {
          const c = byIdLayout.get(cid);
          if (c && c.nodeType !== "bus_tie") relatedXs.push(c.x);
        }
        if (relatedXs.length === 0) {
          for (const pid of parentIds) {
            const p = byIdLayout.get(pid);
            if (p && p.nodeType !== "bus_tie") relatedXs.push(p.x);
          }
        }
        if (relatedXs.length > 0) {
          const minX = Math.min(...relatedXs);
          const maxX2 = Math.max(...relatedXs);
          ln.x = (minX + maxX2) / 2;
          ln.busLeft = minX - BUS_OVERHANG;
          ln.busRight = maxX2 + BUS_OVERHANG;
        } else {
          ln.busLeft = ln.x - 40;
          ln.busRight = ln.x + 40;
        }
      }
    }
  }
  const CONVERGENCE_SPREAD = Math.max(H_SPACING, 110);
  for (let iter = 0; iter < 4; iter++) {
    for (const lvl of [...sortedLevels].reverse()) {
      for (const id of byLevel.get(lvl)) {
        const ln = byIdLayout.get(id);
        if (ln.nodeType === "bus" || ln.nodeType === "bus_tie") continue;
        const childIds = children.get(id) ?? [];
        if (childIds.length === 1) {
          const child = byIdLayout.get(childIds[0]);
          if (!child) continue;
          const siblingParents = (parents.get(child.node.id) ?? []).map((pid) => byIdLayout.get(pid)).filter((p) => !!p && p.level === lvl && p.nodeType !== "bus");
          if (siblingParents.length > 1) {
            siblingParents.sort((a, b) => a.x - b.x);
            const n = siblingParents.length;
            const spread = Math.max(
              CONVERGENCE_SPREAD,
              (child.halfWidth * 2 + 40) / Math.max(1, n - 1)
            );
            const idx = siblingParents.indexOf(ln);
            ln.x = child.x + (idx - (n - 1) / 2) * spread;
          } else {
            ln.x = child.x;
          }
        } else if (childIds.length > 1) {
          const xs = childIds.map((c) => byIdLayout.get(c)?.x).filter((v) => v !== void 0);
          if (xs.length > 0) {
            ln.x = (Math.min(...xs) + Math.max(...xs)) / 2;
          }
        }
      }
    }
  }
  for (const ln of layoutNodes) {
    if (ln.nodeType !== "bus_tie") continue;
    const inIds = parents.get(ln.node.id) ?? [];
    const outIds = children.get(ln.node.id) ?? [];
    const busA = inIds.map((id) => byIdLayout.get(id)).find((n) => n?.nodeType === "bus");
    const busB = outIds.map((id) => byIdLayout.get(id)).find((n) => n?.nodeType === "bus");
    if (!busA || !busB) continue;
    const busAChildren = (children.get(busA.node.id) ?? []).map((id) => byIdLayout.get(id)).filter((c) => !!c && c.nodeType !== "bus_tie");
    const busAMaxX = busAChildren.length ? Math.max(...busAChildren.map((c) => c.x)) : busA.x;
    ln.y = busA.y;
    ln.x = busAMaxX + 60;
    const cluster = /* @__PURE__ */ new Set([busB.node.id]);
    const queue = [busB.node.id];
    const excluded = /* @__PURE__ */ new Set([busA.node.id, ln.node.id]);
    while (queue.length) {
      const cur = queue.shift();
      const neighbors = [...children.get(cur) ?? [], ...parents.get(cur) ?? []];
      for (const nb of neighbors) {
        if (cluster.has(nb) || excluded.has(nb)) continue;
        cluster.add(nb);
        queue.push(nb);
      }
    }
    let minClusterX = Infinity;
    for (const id of cluster) {
      const n = byIdLayout.get(id);
      if (!n) continue;
      const left = n.nodeType === "bus" ? n.busLeft ?? n.x : n.x - n.halfWidth;
      if (left < minClusterX) minClusterX = left;
    }
    const desiredLeft = ln.x + 30;
    const shift = desiredLeft - minClusterX;
    if (shift > 0) {
      for (const id of cluster) {
        const n = byIdLayout.get(id);
        if (!n) continue;
        n.x += shift;
        if (n.busLeft !== void 0) n.busLeft += shift;
        if (n.busRight !== void 0) n.busRight += shift;
      }
    }
  }
  const labelHalfWidth = (ln) => {
    if (ln.nodeType === "bus" || ln.nodeType === "bus_tie") return 0;
    const node = ln.node;
    const txtParts = [node.label ?? node.id];
    if (node.rating) txtParts.push(node.rating);
    const longest = txtParts.reduce((m, s) => Math.max(m, s.length), 0);
    return longest * 6.2 / 2 + 4;
  };
  for (const lvl of sortedLevels) {
    const ids = byLevel.get(lvl);
    const sorted = ids.map((id) => byIdLayout.get(id)).sort((a, b) => a.x - b.x);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (prev.nodeType === "bus" && cur.nodeType !== "bus") continue;
      if (cur.nodeType === "bus" && prev.nodeType !== "bus") continue;
      const symGap = (prev.nodeType === "bus" ? 0 : prev.halfWidth) + (cur.nodeType === "bus" ? 0 : cur.halfWidth) + 16;
      const labelGap = labelHalfWidth(prev) + labelHalfWidth(cur) + 8;
      const minGap = Math.max(symGap, labelGap);
      if (cur.x - prev.x < minGap) {
        cur.x = prev.x + minGap;
      }
    }
  }
  for (const ln of layoutNodes) {
    if (ln.nodeType !== "bus") continue;
    const childrenIds = children.get(ln.node.id) ?? [];
    const parentIds = parents.get(ln.node.id) ?? [];
    const xs = [];
    for (const cid of [...childrenIds, ...parentIds]) {
      const rel = byIdLayout.get(cid);
      if (rel && rel.nodeType !== "bus_tie") xs.push(rel.x);
    }
    const tieXs = [];
    for (const cid of [...childrenIds, ...parentIds]) {
      const rel = byIdLayout.get(cid);
      if (rel && rel.nodeType === "bus_tie") tieXs.push(rel.x);
    }
    if (xs.length > 0) {
      let left = Math.min(...xs) - BUS_OVERHANG;
      let right = Math.max(...xs) + BUS_OVERHANG;
      for (const tx of tieXs) {
        if (tx < left) left = tx;
        if (tx > right) right = tx;
      }
      ln.busLeft = left;
      ln.busRight = right;
      ln.x = (Math.min(...xs) + Math.max(...xs)) / 2;
    }
  }
  for (const ln of layoutNodes) {
    const geom = geometryFor(ln.nodeType);
    ln.topY = ln.y + geom.topY;
    ln.bottomY = ln.y + geom.bottomY;
  }
  const edges = [];
  for (const c of ast.connections) {
    const from = byIdLayout.get(c.from);
    const to = byIdLayout.get(c.to);
    if (!from || !to) continue;
    const fx = from.x;
    const tx = to.x;
    const lateralTie = from.nodeType === "bus_tie" || to.nodeType === "bus_tie" || from.level === to.level && (from.nodeType === "bus" || to.nodeType === "bus");
    let startY;
    let endY;
    if (lateralTie) {
      startY = from.y;
      endY = to.y;
    } else {
      startY = from.nodeType === "bus" ? from.y : from.bottomY;
      endY = to.nodeType === "bus" ? to.y : to.topY;
    }
    let pathD;
    if (lateralTie) {
      pathD = `M ${fx} ${startY} L ${tx} ${endY}`;
    } else if (Math.abs(fx - tx) < 0.5) {
      pathD = `M ${fx} ${startY} L ${tx} ${endY}`;
    } else {
      const midY = (startY + endY) / 2;
      pathD = `M ${fx} ${startY} L ${fx} ${midY} L ${tx} ${midY} L ${tx} ${endY}`;
    }
    edges.push({
      from: c.from,
      to: c.to,
      path: pathD,
      cable: c.cable,
      cableCsa: c.cableCsa,
      cableLengthM: c.cableLengthM,
      cableInsulation: c.cableInsulation,
      label: c.label,
      midX: (fx + tx) / 2,
      midY: (startY + endY) / 2
    });
  }
  const bands = [];
  for (const lvl of sortedLevels) {
    let voltage;
    for (const id of byLevel.get(lvl)) {
      const n = nodeMap.get(id);
      if (n.voltage) {
        voltage = n.voltage;
        break;
      }
    }
    bands.push({
      level: lvl,
      voltage,
      y: TOP_PADDING + lvl * LEVEL_SPACING - LEVEL_SPACING / 2 + 10,
      height: LEVEL_SPACING
    });
  }
  let contentMinX = Infinity;
  for (const ln of layoutNodes) {
    const left = ln.nodeType === "bus" ? ln.busLeft ?? ln.x : ln.x - ln.halfWidth;
    if (left < contentMinX) contentMinX = left;
  }
  if (!Number.isFinite(contentMinX)) contentMinX = 0;
  const xShift = LEFT_PADDING - contentMinX;
  if (Math.abs(xShift) > 0.5) {
    for (const ln of layoutNodes) {
      ln.x += xShift;
      if (ln.busLeft !== void 0) ln.busLeft += xShift;
      if (ln.busRight !== void 0) ln.busRight += xShift;
    }
    for (const e of edges) {
      e.midX += xShift;
      e.path = e.path.replace(
        /([ML])\s+(-?[\d.]+)\s+(-?[\d.]+)/g,
        (_m, cmd, x, y) => `${cmd} ${Number(x) + xShift} ${y}`
      );
    }
  }
  let maxX = 0;
  for (const ln of layoutNodes) {
    const right = (ln.busRight ?? ln.x + ln.halfWidth) + 60;
    if (right > maxX) maxX = right;
  }
  const width = Math.max(400, maxX + 40);
  const height = TOP_PADDING + maxLevel * LEVEL_SPACING + 120;
  return {
    width,
    height,
    nodes: layoutNodes,
    edges,
    bands,
    nodeById: byIdLayout
  };
}

// src/diagrams/sld/renderer.ts
var BAND_ODD_LIGHT = "#f7f7f7";
var BAND_EVEN_LIGHT = "#fbfbfb";
var BAND_ODD_DARK = "#172033";
var BAND_EVEN_DARK = "#202b3d";
function buildCss(t) {
  const isDark = t.bg !== "#ffffff";
  const bandOdd = isDark ? BAND_ODD_DARK : BAND_ODD_LIGHT;
  const bandEven = isDark ? BAND_EVEN_DARK : BAND_EVEN_LIGHT;
  return `
.lt-sld { font-family: system-ui, -apple-system, sans-serif; }
.lt-sld-stroke { stroke: ${t.stroke}; stroke-width: 1.8; fill: none; }
.lt-sld-stroke-thick { stroke: ${t.stroke}; stroke-width: 2.4; fill: none; stroke-linecap: round; }
.lt-sld-fill { fill: ${t.bg}; stroke: ${t.stroke}; stroke-width: 2; }
.lt-sld-fill-dark { fill: ${t.stroke}; stroke: ${t.stroke}; stroke-width: 1; }
.lt-sld-dot { fill: ${t.stroke}; stroke: none; }
.lt-sld-wire { stroke: ${t.stroke}; stroke-width: 2; fill: none; }
.lt-sld-bus { stroke: ${t.strokeHeavy}; stroke-width: 6; stroke-linecap: square; }
.lt-sld-band-odd { fill: ${bandOdd}; stroke: none; }
.lt-sld-band-even { fill: ${bandEven}; stroke: none; }
.lt-sld-band-label { font: bold 11px sans-serif; fill: ${t.textMuted}; }
.lt-sld-title { font: bold 16px sans-serif; fill: ${t.text}; }
.lt-sld-id { font: bold 11px sans-serif; fill: ${t.text}; text-anchor: middle; }
.lt-sld-rating { font: 9px sans-serif; fill: ${t.textMuted}; text-anchor: middle; }
.lt-sld-voltage { font: bold 10px sans-serif; fill: ${t.textMuted}; }
.lt-sld-nameplate { font: 9px sans-serif; fill: ${t.textMuted}; }
.lt-sld-cable { font: 9px ui-monospace, SFMono-Regular, Menlo, monospace; fill: ${t.textMuted}; }
.lt-sld-symbol-text { font: 11px sans-serif; fill: ${t.text}; dominant-baseline: middle; }
.lt-sld-wdg { font: bold 10px sans-serif; fill: ${t.stroke}; dominant-baseline: middle; }
.lt-sld-bus-label { font: bold 11px sans-serif; fill: ${t.accent}; }
.lt-sld-standard-badge { font: bold 10px sans-serif; fill: ${t.textMuted}; letter-spacing: 0.3px; }
.lt-sld-unknown-box { fill: none; stroke: ${t.accent}; stroke-width: 1.6; stroke-dasharray: 5 3; }
.lt-sld-unknown-mark { font: bold 16px sans-serif; fill: ${t.accent}; dominant-baseline: middle; }
.lt-sld-unknown-type { font: 9px ui-monospace, monospace; fill: ${t.textMuted}; }
`.trim();
}
function standardBadge(standard) {
  switch (standard) {
    case "iec":
      return "Standard: IEC 60617";
    case "abnt":
      return "Norma: ABNT NBR 5410 (IEC 60364)";
    case "as-nzs":
      return "Standard: AS/NZS 3000 (IEC 60364)";
    default:
      return void 0;
  }
}
function renderLabels(ln) {
  const pieces = [];
  const { node } = ln;
  if (ln.nodeType === "bus") {
    const label = node.label ?? node.id;
    pieces.push(
      text(
        { x: (ln.busLeft ?? ln.x - 40) + 4, y: ln.y - 8, class: "lt-sld-bus-label" },
        node.voltage ? `${node.voltage} \xB7 ${label}` : label
      )
    );
    return pieces;
  }
  if (ln.nodeType === "hub") {
    if (node.rating || node.voltage) {
      const lines2 = [];
      if (node.rating) lines2.push(node.rating);
      if (node.voltage) lines2.push(node.voltage);
      lines2.forEach((l, i) => {
        pieces.push(
          text(
            { x: ln.x, y: ln.bottomY + 14 + i * 11, class: "lt-sld-rating" },
            l
          )
        );
      });
    }
    return pieces;
  }
  if (ln.nodeType === "bus_tie") {
    pieces.push(
      text(
        { x: ln.x, y: ln.topY - 6, class: "lt-sld-rating" },
        node.label ?? node.id
      )
    );
    return pieces;
  }
  const idY = ln.topY - 22;
  pieces.push(
    text({ x: ln.x, y: idY, class: "lt-sld-id" }, node.label ?? node.id)
  );
  const lines = [];
  if (node.rating) lines.push(node.rating);
  if (node.voltage) lines.push(node.voltage);
  if (node.nameplate) {
    for (const key of ["curve", "icn", "rcd_type", "type", "sensitivity", "poles"]) {
      const value = node.nameplate[key] ?? node.nameplate[key.toUpperCase()];
      if (value) lines.push(`${key}: ${value}`);
    }
  }
  if (node.deviceNumber && ln.nodeType === "relay") ;
  lines.forEach((l, i) => {
    pieces.push(
      text(
        { x: ln.x, y: ln.bottomY + 14 + i * 11, class: "lt-sld-rating" },
        l
      )
    );
  });
  if ((ln.nodeType === "transformer" || ln.nodeType === "transformer_dy" || ln.nodeType === "transformer_yd" || ln.nodeType === "transformer_yy" || ln.nodeType === "transformer_dd" || ln.nodeType === "autotransformer" || ln.nodeType === "transformer_3winding") && node.nameplate) {
    const np = node.nameplate;
    const keys = Object.keys(np);
    let offset = -12;
    const x = ln.x + ln.halfWidth + 28;
    for (const k of keys) {
      pieces.push(
        text(
          { x, y: ln.y + offset, class: "lt-sld-nameplate" },
          `${k}: ${np[k]}`
        )
      );
      offset += 11;
    }
  }
  return pieces;
}
function renderSLD(ast, config) {
  const layout = layoutSLD(ast);
  const t = resolveIndustrialTheme(config?.theme ?? "default");
  const titleOffset = ast.title ? 34 : 12;
  const width = Math.ceil(layout.width);
  const height = Math.ceil(layout.height + titleOffset);
  const children = [];
  children.push(title(ast.title ?? "Single-Line Diagram"));
  children.push(
    desc(
      `Single-line diagram with ${ast.nodes.length} nodes and ${ast.connections.length} connections`
    )
  );
  children.push(el("style", {}, buildCss(t)));
  children.push(
    defs([
      el(
        "marker",
        {
          id: "lt-sld-arrow",
          markerWidth: 8,
          markerHeight: 8,
          refX: 6,
          refY: 3,
          orient: "auto",
          markerUnits: "strokeWidth"
        },
        [el("path", { d: "M 0 0 L 6 3 L 0 6 z", fill: t.textMuted })]
      )
    ])
  );
  if (ast.title) {
    children.push(
      text({ x: 20, y: 22, class: "lt-sld-title" }, ast.title)
    );
  }
  const badge = standardBadge(ast.standard);
  if (badge) {
    children.push(
      text(
        { x: width - 14, y: 22, class: "lt-sld-standard-badge", "text-anchor": "end" },
        badge
      )
    );
  }
  const inner = [];
  layout.bands.forEach((b, i) => {
    inner.push(
      el("rect", {
        x: 0,
        y: b.y,
        width: layout.width,
        height: b.height,
        class: i % 2 === 0 ? "lt-sld-band-odd" : "lt-sld-band-even"
      })
    );
    if (b.voltage) {
      inner.push(
        text(
          { x: 14, y: b.y + 18, class: "lt-sld-band-label" },
          b.voltage
        )
      );
    }
  });
  for (const e of layout.edges) {
    inner.push(path({ d: e.path, class: "lt-sld-wire" }));
    const cableParts = [
      e.cable,
      e.cableCsa,
      e.cableInsulation,
      e.cableLengthM ? `${e.cableLengthM} m` : void 0
    ].filter((v) => !!v);
    if (cableParts.length) {
      inner.push(
        text(
          { x: e.midX + 6, y: e.midY - 2, class: "lt-sld-cable" },
          cableParts.join(" \xB7 ")
        )
      );
    }
    if (e.label) {
      inner.push(
        text(
          { x: e.midX + 6, y: e.midY + 10, class: "lt-sld-cable" },
          e.label
        )
      );
    }
  }
  for (const ln of layout.nodes) {
    if (ln.nodeType === "bus") {
      const left = ln.busLeft ?? ln.x - 40;
      const right = ln.busRight ?? ln.x + 40;
      inner.push(
        el("line", {
          x1: left,
          y1: ln.y,
          x2: right,
          y2: ln.y,
          class: "lt-sld-bus",
          "data-id": ln.node.id
        })
      );
      for (const piece of renderLabels(ln)) inner.push(piece);
      continue;
    }
    const attrs = {
      transform: `translate(${ln.x}, ${ln.y})`,
      "data-type": ln.nodeType,
      "data-id": ln.node.id
    };
    if (ln.nodeType === "unknown" && ln.node.rawType) {
      attrs["data-raw-type"] = ln.node.rawType;
    }
    const detail = ln.nodeType === "hub" || ln.nodeType === "consumer_unit" ? ln.node.label ?? ln.node.id : ln.nodeType === "unknown" ? ln.node.rawType : ln.node.deviceNumber;
    inner.push(
      group(attrs, [renderSymbol(ln.nodeType, detail, ast.standard)])
    );
    for (const piece of renderLabels(ln)) inner.push(piece);
  }
  const wrap = group({ transform: `translate(0, ${titleOffset})` }, inner);
  children.push(wrap);
  return svgRoot(
    {
      class: "lt-sld",
      role: "img",
      "aria-labelledby": "lt-sld-title lt-sld-desc",
      width,
      height,
      viewBox: `0 0 ${width} ${height}`
    },
    children
  );
}

// src/diagrams/sld/lint.ts
var KNOWN_DEVICE_WORDS = [
  "utility",
  "generator",
  "solar",
  "wind",
  "ups",
  "transformer",
  "transformer_dy",
  "transformer_yd",
  "transformer_yy",
  "transformer_dd",
  "autotransformer",
  "transformer_3winding",
  "bus",
  "bus_tie",
  "hub",
  "breaker",
  "breaker_vacuum",
  "switch",
  "switch_load",
  "ground_switch",
  "ats",
  "recloser",
  "sectionalizer",
  "fuse",
  "fuse_cl",
  "ct",
  "pt",
  "relay",
  "surge_arrester",
  "ground_fault",
  "rcd",
  "motor",
  "load",
  "capacitor_bank",
  "harmonic_filter",
  "vfd",
  "watthour_meter",
  "demand_meter",
  "consumer_unit",
  "mcb",
  "mccb",
  "rcbo",
  "rccb",
  "isolator",
  "disconnector",
  "panel",
  "distribution_board",
  "consumer_unit"
];
function lintSLD(text2) {
  let ast;
  try {
    ast = parseSLDDSL(text2);
  } catch {
    return [];
  }
  return lintSLDAst(ast);
}
var ANSI_ONLY = {
  recloser: "recloser",
  sectionalizer: "sectionalizer",
  watthour_meter: "watt-hour meter",
  demand_meter: "demand meter"
};
function lintSLDAst(ast) {
  const out = [];
  for (const node of ast.nodes) {
    if (node.nodeType !== "unknown") continue;
    const raw = node.rawType ?? "";
    out.push({
      severity: "warning",
      code: "SLD_UNKNOWN_DEVICE",
      message: `device "${node.id}" has unrecognised type "${raw}"; drawn as a flagged placeholder`,
      hint: `"${raw}" is not a known SLD device.${didYouMean(raw.toLowerCase(), KNOWN_DEVICE_WORDS)} See docs/reference for the device catalog.`,
      fatal: false
    });
  }
  if (!isIecFamily(ast.standard)) return out;
  const stdName = ast.standard === "abnt" ? "ABNT NBR 5410" : ast.standard === "as-nzs" ? "AS/NZS 3000" : "IEC 60617";
  const seen = /* @__PURE__ */ new Set();
  for (const node of ast.nodes) {
    const friendly = ANSI_ONLY[node.nodeType];
    if (!friendly || seen.has(node.nodeType)) continue;
    seen.add(node.nodeType);
    out.push({
      severity: "warning",
      code: "SLD_SYMBOL_NOT_IN_STANDARD",
      message: `device "${node.nodeType}" (${friendly}) has no symbol in ${stdName}; rendered with the ANSI/IEEE form`,
      hint: `${friendly} is a North-American utility convention. Confirm an equivalent device exists in ${stdName}, or model it with an IEC-native device.`,
      fatal: false
    });
  }
  return out;
}

// src/diagrams/sld/index.ts
var sld = {
  type: "sld",
  detect(text2) {
    const first = firstContentLine(text2)?.toLowerCase() ?? "";
    return first.startsWith("sld");
  },
  parse: parseSLDDSL,
  lint: lintSLD,
  render(text2, config) {
    const ast = parseSLDDSL(text2);
    return renderSLD(ast, config);
  }
};

export { geometryFor, layoutSLD, lintSLD, lintSLDAst, parseSLDDSL, renderSLD, renderSymbol, sld };
//# sourceMappingURL=chunk-R6GGQWDH.js.map
//# sourceMappingURL=chunk-R6GGQWDH.js.map