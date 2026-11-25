import { firstContentLine } from './chunk-BTVWLNZ5.js';
import { parseLegendDirective, applyLegendOverrides, renderLegend } from './chunk-S5MF733M.js';
import { resolveBaseTheme, title, desc, group, svgRoot, el, STROKE_WIDTH, cssCustomProperties, text } from './chunk-ZUMTE4E7.js';

// src/diagrams/ecomap/parser.ts
var EcomapParseError = class extends Error {
  constructor(message, line) {
    super(`Line ${line}: ${message}`);
    this.line = line;
    this.name = "EcomapParseError";
  }
  line;
};
var CONNECTION_OPS = {
  "===": { relType: "strong" },
  "==": { relType: "moderate" },
  "---": { relType: "normal" },
  "- -": { relType: "weak" },
  "~~~": { relType: "stressful" },
  "~=~": { relType: "stressful-strong" },
  "~x~": { relType: "conflictual" },
  "-/-": { relType: "broken" },
  "===>": { relType: "strong", energyFlow: "from" },
  "<===": { relType: "strong", energyFlow: "to" },
  "<=>": { relType: "moderate", energyFlow: "mutual" },
  "==>": { relType: "moderate", energyFlow: "from" },
  "<==": { relType: "moderate", energyFlow: "to" },
  "-->": { relType: "normal", energyFlow: "from" },
  "<--": { relType: "normal", energyFlow: "to" },
  "<->": { relType: "normal", energyFlow: "mutual" }
};
var OP_PATTERN = "===>|<===|===|<=>|==>|<==|<->|-->|<--|~=~|~x~|~~~|-\\/-|---|==|- -";
var CONNECTION_RE = new RegExp(
  `^([a-zA-Z][a-zA-Z0-9_-]*)\\s+(${OP_PATTERN})\\s+([a-zA-Z][a-zA-Z0-9_-]*)(.*)$`
);
function parseEcomap(text2) {
  const lines = text2.split("\n");
  const individuals = [];
  const knownIds = /* @__PURE__ */ new Set();
  const relationships = [];
  const metadata = {};
  const legendOverrides = {};
  let hasLegendOverrides = false;
  let centerId = null;
  let i = 0;
  while (i < lines.length && (lines[i].trim() === "" || lines[i].trim().startsWith("#") || lines[i].trim().startsWith("//") || lines[i].trim().startsWith("%%"))) {
    i++;
  }
  if (i >= lines.length) throw new EcomapParseError("Empty input", 1);
  const header = lines[i].trim();
  const headerMatch = header.match(
    /^ecomap(?::([a-zA-Z][\w-]*))?\s*(?:"([^"]*)")?\s*$/i
  );
  if (!headerMatch)
    throw new EcomapParseError(
      `Expected 'ecomap' header (got '${header}')`,
      i + 1
    );
  if (headerMatch[1]) metadata.mode = headerMatch[1].toLowerCase();
  if (headerMatch[2]) metadata.title = headerMatch[2];
  i++;
  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed.startsWith("#") || trimmed.startsWith("//") || trimmed.startsWith("%%")) {
      i++;
      continue;
    }
    if (parseLegendDirective(trimmed, legendOverrides)) {
      hasLegendOverrides = true;
      i++;
      continue;
    }
    const centerMatch = trimmed.match(
      /^center:\s*([a-zA-Z][a-zA-Z0-9_-]*)\s*(\[.*\])?\s*$/
    );
    if (centerMatch) {
      const id = centerMatch[1].toLowerCase();
      centerId = id;
      const props = centerMatch[2] ? parseProps(centerMatch[2]) : {};
      individuals.push(buildIndividual(id, props, true));
      knownIds.add(id);
      i++;
      const baseIndent = leadingSpaces(raw);
      while (i < lines.length) {
        if (lines[i].trim() === "") {
          i++;
          continue;
        }
        if (leadingSpaces(lines[i]) > baseIndent + 2) {
          i++;
        } else {
          break;
        }
      }
      continue;
    }
    const connMatch = trimmed.match(CONNECTION_RE);
    if (connMatch) {
      const fromRaw = connMatch[1].toLowerCase();
      const op = connMatch[2];
      const toRaw = connMatch[3].toLowerCase();
      const rest = connMatch[4]?.trim() ?? "";
      const opInfo = CONNECTION_OPS[op];
      if (!opInfo)
        throw new EcomapParseError(`Unknown operator '${op}'`, i + 1);
      let label;
      const lblMatch = rest.match(/\[\s*label:\s*"([^"]*)"\s*\]/);
      if (lblMatch) label = lblMatch[1];
      let from = fromRaw;
      let to = toRaw;
      let flow = opInfo.energyFlow;
      if (to === centerId && from !== centerId) {
        [from, to] = [to, from];
        if (flow === "from") flow = "to";
        else if (flow === "to") flow = "from";
      }
      relationships.push({
        type: opInfo.relType,
        from,
        to,
        label,
        energyFlow: flow
      });
      i++;
      continue;
    }
    const sysMatch = trimmed.match(
      /^([a-zA-Z][a-zA-Z0-9_-]*)\s*(\[.*\])?\s*$/
    );
    if (sysMatch) {
      const id = sysMatch[1].toLowerCase();
      if (!knownIds.has(id)) {
        const props = sysMatch[2] ? parseProps(sysMatch[2]) : {};
        individuals.push(buildIndividual(id, props, false));
        knownIds.add(id);
      }
      i++;
      continue;
    }
    throw new EcomapParseError(`Unexpected: ${trimmed}`, i + 1);
  }
  return {
    type: "ecomap",
    individuals,
    relationships,
    metadata,
    legendOverrides: hasLegendOverrides ? legendOverrides : void 0
  };
}
function leadingSpaces(line) {
  const m = line.match(/^(\s*)/);
  return m ? m[1].length : 0;
}
function parseProps(bracketStr) {
  const inner = bracketStr.slice(1, -1).trim();
  if (!inner) return {};
  const props = {};
  for (const part of splitCommas(inner)) {
    const t = part.trim();
    if (!t) continue;
    const kv = t.match(/^([\w][\w-]*)\s*:\s*(?:"([^"]*)"|(\S+))$/);
    if (kv) {
      props[kv[1]] = kv[2] ?? kv[3];
      continue;
    }
    if (t === "male" || t === "female" || t === "unknown") {
      props.sex = t;
      continue;
    }
    props[t] = "true";
  }
  return props;
}
function splitCommas(s) {
  const parts = [];
  let cur = "";
  let inQ = false;
  for (const ch of s) {
    if (ch === '"') {
      inQ = !inQ;
      cur += ch;
    } else if (ch === "," && !inQ) {
      parts.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur) parts.push(cur);
  return parts;
}
function parseSex(s) {
  switch (s) {
    case "male":
    case "female":
    case "unknown":
    case "other":
    case "nonbinary":
    case "intersex":
      return s;
    default:
      return "unknown";
  }
}
function buildIndividual(id, props, isCenter) {
  const properties = {};
  if (isCenter) properties.center = "true";
  if (props.category) properties.category = props.category;
  if (props.size) properties.size = props.size;
  if (props.importance) properties.importance = props.importance;
  if (props.sector) properties.sector = props.sector;
  return {
    id,
    label: props.label ?? id,
    sex: parseSex(props.sex),
    status: "alive",
    age: props.age ? parseInt(props.age, 10) : void 0,
    properties
  };
}

// src/core/text-metrics.ts
var FULL_WIDTH_RE = /[ᄀ-ᇿ⺀-〿぀-ヿ㄰-㆏㇀-㏿㐀-䶿一-鿿ꥠ-꥿가-퟿豈-﫿︰-﹏＀-｠￠-￦]/;
function isFullWidth(ch) {
  return FULL_WIDTH_RE.test(ch);
}
var NARROW_RE = /[iIljtf.,:;'"!|()[\]{}` ]/;
var WIDE_RE = /[0-9A-HK-Z@#%&mwMW_<>=+~^$]/;
function estimateTextWidth(text2, fontSize, opts = {}) {
  let units = 0;
  for (const ch of text2) {
    if (isFullWidth(ch)) {
      units += 1;
    } else if (opts.monospace) {
      units += 0.6;
    } else if (NARROW_RE.test(ch)) {
      units += 0.32;
    } else if (WIDE_RE.test(ch)) {
      units += 0.66;
    } else {
      units += 0.54;
    }
  }
  const weightFactor = (opts.fontWeight ?? 400) >= 600 ? 1.06 : 1;
  return units * fontSize * weightFactor;
}

// src/diagrams/ecomap/layout.ts
var CENTER_R = 50;
var CENTER_LABEL_FONT = 14;
function getCenterRadius(center) {
  const label = center.label !== center.id ? center.label : center.id.charAt(0).toUpperCase() + center.id.slice(1);
  const w = estimateTextWidth(label, CENTER_LABEL_FONT, { fontWeight: 600 });
  return Math.max(CENTER_R, Math.ceil(w / 2) + 10);
}
var SYS_R = 30;
var SYS_R_LARGE = 40;
var SYS_R_SMALL = 20;
var PADDING = 40;
var LABEL_CLEARANCE = 60;
function layoutEcomap(ast, _config) {
  const center = ast.individuals.find(
    (ind) => ind.properties?.center === "true"
  );
  if (!center) throw new Error("Ecomap requires a center element");
  const systems = ast.individuals.filter(
    (ind) => ind.properties?.center !== "true"
  );
  const n = systems.length;
  const centerR = getCenterRadius(center);
  if (n === 0) {
    const size = (centerR + PADDING + LABEL_CLEARANCE) * 2;
    return {
      width: size,
      height: size,
      nodes: [
        {
          id: center.id,
          x: size / 2 - centerR,
          y: size / 2 - centerR,
          width: centerR * 2,
          height: centerR * 2,
          generation: 0,
          individual: center
        }
      ],
      edges: []
    };
  }
  const ringRadii = getRingRadii(n);
  const ringAssignment = assignToRings(
    center.id,
    systems,
    ast.relationships,
    ringRadii.length
  );
  const systemPositions = placeOnRings(systems, ringAssignment, ringRadii);
  const maxRing = ringRadii[ringRadii.length - 1] ?? 180;
  const canvasSize = (maxRing + SYS_R_LARGE + LABEL_CLEARANCE + PADDING) * 2;
  const cx = canvasSize / 2;
  const cy = canvasSize / 2;
  const nodes = [];
  nodes.push({
    id: center.id,
    x: cx - centerR,
    y: cy - centerR,
    width: centerR * 2,
    height: centerR * 2,
    generation: 0,
    individual: center
  });
  for (const sys of systems) {
    const pos = systemPositions.get(sys.id);
    if (!pos) continue;
    const r = getSystemRadius(sys);
    nodes.push({
      id: sys.id,
      x: cx + pos.x - r,
      y: cy + pos.y - r,
      width: r * 2,
      height: r * 2,
      generation: pos.ring + 1,
      individual: sys
    });
  }
  const edges = computeEdges(nodes, ast.relationships);
  return { width: canvasSize, height: canvasSize, nodes, edges };
}
function getRingRadii(n) {
  if (n === 0) return [];
  if (n <= 6) return [180];
  if (n <= 12) return [150, 270];
  return [140, 230, 320];
}
function assignToRings(_centerId, systems, rels, ringCount) {
  const relBySys = /* @__PURE__ */ new Map();
  for (const r of rels) {
    const sysId = r.from === _centerId ? r.to : r.from === _centerId ? r.to : r.to;
    if (!relBySys.has(sysId)) relBySys.set(sysId, r);
    const otherId = r.from === _centerId ? r.to : r.from;
    if (!relBySys.has(otherId)) relBySys.set(otherId, r);
  }
  const result = /* @__PURE__ */ new Map();
  if (ringCount <= 1) {
    for (const s of systems) result.set(s.id, 0);
    return result;
  }
  for (const s of systems) {
    const rel = relBySys.get(s.id);
    if (!rel) {
      result.set(s.id, ringCount - 1);
      continue;
    }
    if (rel.type === "strong" || rel.type === "stressful-strong") {
      result.set(s.id, 0);
    } else if (rel.type === "weak" || rel.type === "broken") {
      result.set(s.id, ringCount - 1);
    } else {
      result.set(s.id, Math.min(1, ringCount - 1));
    }
  }
  return result;
}
function placeOnRings(systems, ringAssignment, ringRadii) {
  const ringGroups = /* @__PURE__ */ new Map();
  for (const s of systems) {
    const ring = ringAssignment.get(s.id) ?? 0;
    const grp = ringGroups.get(ring) ?? [];
    grp.push(s);
    ringGroups.set(ring, grp);
  }
  const positions = /* @__PURE__ */ new Map();
  for (const [ring, grp] of ringGroups) {
    const radius = ringRadii[ring] ?? ringRadii[ringRadii.length - 1] ?? 180;
    const n = grp.length;
    const startAngle = -Math.PI / 2;
    for (let idx = 0; idx < n; idx++) {
      const angle = startAngle + 2 * Math.PI * idx / n;
      positions.set(grp[idx].id, {
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
        ring
      });
    }
  }
  return positions;
}
function computeEdges(nodes, rels) {
  const nodeMap = /* @__PURE__ */ new Map();
  for (const n of nodes) nodeMap.set(n.id, n);
  const edges = [];
  for (const rel of rels) {
    const fromNode = nodeMap.get(rel.from);
    const toNode = nodeMap.get(rel.to);
    if (!fromNode || !toNode) continue;
    const fcx = fromNode.x + fromNode.width / 2;
    const fcy = fromNode.y + fromNode.height / 2;
    const tcx = toNode.x + toNode.width / 2;
    const tcy = toNode.y + toNode.height / 2;
    const dx = tcx - fcx;
    const dy = tcy - fcy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) continue;
    const ux = dx / dist;
    const uy = dy / dist;
    const fromR = fromNode.width / 2;
    const toR = toNode.width / 2;
    const x1 = fcx + ux * fromR;
    const y1 = fcy + uy * fromR;
    const x2 = tcx - ux * toR;
    const y2 = tcy - uy * toR;
    edges.push({
      from: rel.from,
      to: rel.to,
      relationship: rel,
      path: `M ${x1} ${y1} L ${x2} ${y2}`
    });
  }
  return edges;
}
function getSystemRadius(ind) {
  const imp = ind.properties?.importance ?? ind.properties?.size;
  switch (imp) {
    case "major":
    case "large":
      return SYS_R_LARGE;
    case "minor":
    case "small":
      return SYS_R_SMALL;
    default:
      return SYS_R;
  }
}

// src/diagrams/ecomap/legend.ts
var CATEGORY_COLORS = {
  family: "#8D6E63",
  friends: "#42A5F5",
  work: "#66BB6A",
  education: "#FFA726",
  health: "#EF5350",
  "mental-health": "#AB47BC",
  religion: "#CCBB33",
  recreation: "#26C6DA",
  legal: "#78909C",
  government: "#8D6E63",
  financial: "#66BB6A",
  community: "#29B6F6",
  cultural: "#FFA726",
  substance: "#EF5350",
  technology: "#42A5F5",
  pet: "#8D6E63"
};
var ECOMAP_TIE_TYPES = /* @__PURE__ */ new Set([
  "strong",
  "moderate",
  "weak",
  "stressful",
  "stressful-strong",
  "conflictual",
  "broken"
]);
var SECTIONS = [
  { id: "systems", title: "Systems" },
  { id: "ties", title: "Ties" }
];
function buildEcomapLegend(ast) {
  const items = [];
  const usedCats = /* @__PURE__ */ new Set();
  for (const ind of ast.individuals) {
    if (ind.properties?.center === "true") continue;
    const cat = ind.properties?.category;
    if (cat) usedCats.add(cat);
  }
  const orderedCats = Array.from(usedCats).sort();
  for (const cat of orderedCats) {
    const color = CATEGORY_COLORS[cat] ?? "#9ca3af";
    items.push({
      key: `cat.${cat}`,
      label: humanize(cat),
      // WYSIWYG: system nodes draw as circles with a ~9% tint fill and the
      // category color as stroke — the swatch must match, not show solid color.
      kind: "shape",
      shape: "circle",
      color,
      fill: `${color}18`,
      section: "systems"
    });
  }
  const usedTies = /* @__PURE__ */ new Set();
  for (const r of ast.relationships) {
    if (ECOMAP_TIE_TYPES.has(r.type)) usedTies.add(r.type);
  }
  const tieOrder = [
    "strong",
    "moderate",
    "weak",
    "stressful",
    "stressful-strong",
    "conflictual",
    "broken"
  ];
  for (const t of tieOrder) {
    if (!usedTies.has(t)) continue;
    items.push(tieItem(t));
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
function tieItem(t) {
  const base = {
    key: t,
    label: humanize(t),
    kind: "line",
    section: "ties",
    pattern: "solid"
  };
  switch (t) {
    case "strong":
      return { ...base, strokeWidth: 4 };
    case "moderate":
      return { ...base, strokeWidth: 3 };
    case "weak":
      return { ...base, pattern: "dashed", strokeWidth: 1.5 };
    case "stressful":
      return { ...base, pattern: "wavy", strokeWidth: 2 };
    case "stressful-strong":
      return { ...base, pattern: "wavy", strokeWidth: 3 };
    case "conflictual":
      return { ...base, kind: "edge", pattern: "wavy", marker: "X", strokeWidth: 2 };
    case "broken":
      return { ...base, pattern: "broken" };
    default:
      return base;
  }
}
function humanize(s) {
  return s.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// src/diagrams/ecomap/renderer.ts
var CATEGORY_COLORS2 = {
  family: "#8D6E63",
  friends: "#42A5F5",
  work: "#66BB6A",
  education: "#FFA726",
  health: "#EF5350",
  "mental-health": "#AB47BC",
  religion: "#CCBB33",
  recreation: "#26C6DA",
  legal: "#78909C",
  government: "#8D6E63",
  financial: "#66BB6A",
  community: "#29B6F6",
  cultural: "#FFA726",
  substance: "#EF5350",
  technology: "#42A5F5",
  pet: "#8D6E63"
};
function renderEcomap(layout, config, ast) {
  const centerNode = layout.nodes.find(
    (n) => n.individual.properties?.center === "true"
  );
  const systemNodes = layout.nodes.filter(
    (n) => n.individual.properties?.center !== "true"
  );
  const t = resolveBaseTheme(config.theme);
  const defsStr = buildDefs(t);
  const styleStr = buildStyles(config, t);
  const connectionsStr = renderConnections(layout.edges, centerNode?.individual.id);
  const centerStr = centerNode ? renderCenter(centerNode, config) : "";
  const systemsStr = renderSystems(systemNodes, config);
  const labelsStr = renderConnectionLabels(layout.edges, layout.nodes, t);
  const layers = [
    title("Ecomap"),
    desc(`Ecomap diagram with ${systemNodes.length} external systems`),
    defsStr,
    styleStr
  ];
  const chartContent = [
    connectionsStr,
    centerStr,
    systemsStr,
    labelsStr
  ];
  let finalWidth = layout.width;
  let finalHeight = layout.height;
  let legendSvg = "";
  if (ast) {
    const autoSpec = buildEcomapLegend(ast);
    const finalSpec = applyLegendOverrides(autoSpec, ast.legendOverrides);
    if (finalSpec.mode === "on" && finalSpec.items.length > 0) {
      const { svg, bbox: lb } = renderLegend(
        finalSpec,
        {
          canvasWidth: layout.width,
          canvasHeight: layout.height,
          padding: 16
        },
        t,
        { fontFamily: config.fontFamily, fontSize: config.fontSize }
      );
      if (svg) {
        legendSvg = svg;
        const overflowX = lb.x + lb.w + 8;
        const overflowY = lb.y + lb.h + 8;
        if (overflowX > finalWidth) finalWidth = overflowX;
        if (overflowY > finalHeight) finalHeight = overflowY;
      }
    }
  }
  const chartXOffset = Math.max(0, (finalWidth - layout.width) / 2);
  layers.push(
    group(
      { transform: chartXOffset > 0 ? `translate(${chartXOffset}, 0)` : void 0 },
      chartContent
    )
  );
  if (legendSvg) layers.push(legendSvg);
  return svgRoot(
    {
      viewBox: `0 0 ${finalWidth} ${finalHeight}`,
      class: "schematex-diagram schematex-ecomap",
      width: finalWidth,
      height: finalHeight
    },
    layers
  );
}
function buildDefs(t) {
  const arrowMarker = el(
    "marker",
    {
      id: "schematex-ecomap-eco-arrow",
      viewBox: "0 0 10 10",
      refX: "10",
      refY: "5",
      markerWidth: "8",
      markerHeight: "8",
      orient: "auto-start-reverse"
    },
    [el("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: t.neutral })]
  );
  return el("defs", {}, [arrowMarker]);
}
function buildStyles(config, t) {
  let css = `
.schematex-ecomap {${cssCustomProperties(t)}
}
.schematex-ecomap-center-shape { fill: ${t.fill}; stroke: ${t.stroke}; stroke-width: ${STROKE_WIDTH.thick}; }
.schematex-ecomap-center-label { font-family: ${config.fontFamily}; font-size: ${config.fontSize + 2}px; text-anchor: middle; dominant-baseline: central; fill: ${t.text}; font-weight: 600; }
.schematex-ecomap-system-shape { fill: ${t.fillMuted}; stroke: ${t.neutral}; stroke-width: ${STROKE_WIDTH.normal}; }
.schematex-ecomap-system-label { font-family: ${config.fontFamily}; font-size: ${config.fontSize - 1}px; text-anchor: middle; fill: ${t.text}; }
.schematex-ecomap-eco-line { stroke: ${t.neutral}; stroke-width: ${STROKE_WIDTH.normal}; fill: none; stroke-linecap: round; }
.schematex-ecomap-eco-line-parallel { stroke: ${t.neutral}; stroke-width: ${STROKE_WIDTH.normal}; fill: none; stroke-linecap: round; }
.schematex-ecomap-eco-line-weak { stroke: ${t.neutral}; stroke-width: ${STROKE_WIDTH.normal}; stroke-dasharray: 6,4; fill: none; stroke-linecap: round; }
.schematex-ecomap-eco-line-broken { stroke: ${t.neutral}; stroke-width: ${STROKE_WIDTH.normal}; stroke-dasharray: 3,8; fill: none; stroke-linecap: round; }
.schematex-ecomap-eco-line-stressful { stroke: ${t.neutral}; stroke-width: ${STROKE_WIDTH.normal}; fill: none; stroke-linecap: round; }
.schematex-ecomap-eco-conn-label { font-family: ${config.fontFamily}; font-size: ${config.fontSize - 2}px; text-anchor: middle; fill: ${t.textMuted}; paint-order: stroke; stroke: ${t.bg}; stroke-width: 3px; stroke-linejoin: round; }
.schematex-ecomap-eco-arrow { fill: ${t.neutral}; }
.schematex-ecomap-connection-mesosystem .schematex-ecomap-eco-line,
.schematex-ecomap-connection-mesosystem .schematex-ecomap-eco-line-parallel,
.schematex-ecomap-connection-mesosystem .schematex-ecomap-eco-line-weak,
.schematex-ecomap-connection-mesosystem .schematex-ecomap-eco-line-broken,
.schematex-ecomap-connection-mesosystem .schematex-ecomap-eco-line-stressful { stroke-opacity: 0.55; }
`;
  for (const [cat, color] of Object.entries(CATEGORY_COLORS2)) {
    css += `.schematex-ecomap-system-${cat} .schematex-ecomap-system-shape { fill: ${color}18; stroke: ${color}; }
`;
  }
  return el("style", {}, css);
}
function renderCenter(node, config) {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const r = node.width / 2;
  const ind = node.individual;
  const label = ind.label !== ind.id ? ind.label : capitalize(ind.id);
  const elements = [
    el("circle", {
      cx,
      cy,
      r,
      class: "schematex-ecomap-center-shape"
    }),
    text(
      {
        x: cx,
        y: cy,
        class: "schematex-ecomap-center-label"
      },
      label
    )
  ];
  if (ind.age) {
    elements.push(
      text(
        {
          x: cx,
          y: cy + config.fontSize + 4,
          class: "schematex-ecomap-center-label",
          "font-size": `${config.fontSize}px`,
          "font-weight": "normal"
        },
        `Age ${ind.age}`
      )
    );
  }
  return group(
    { class: "schematex-ecomap-center", "data-id": ind.id },
    elements
  );
}
function renderSystems(nodes, config) {
  const elements = [];
  for (const node of nodes) {
    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;
    const r = node.width / 2;
    const ind = node.individual;
    const cat = ind.properties?.category ?? "other";
    const label = ind.label !== ind.id ? ind.label : capitalize(ind.id);
    const labelLines = wrapLabel(label, 12);
    const labelElements = [];
    const labelStartY = cy + r + config.fontSize + 2;
    for (let li = 0; li < labelLines.length; li++) {
      labelElements.push(
        text(
          {
            x: cx,
            y: labelStartY + li * (config.fontSize + 1),
            class: "schematex-ecomap-system-label"
          },
          labelLines[li]
        )
      );
    }
    elements.push(
      group(
        {
          class: `schematex-ecomap-system schematex-ecomap-system-${cat}`,
          "data-system-id": ind.id
        },
        [
          el("circle", {
            cx,
            cy,
            r,
            class: "schematex-ecomap-system-shape"
          }),
          ...labelElements
        ]
      )
    );
  }
  return group({ class: "schematex-ecomap-systems" }, elements);
}
function renderConnections(edges, centerId) {
  const elements = [];
  for (const edge of edges) {
    const coords = extractLineCoords(edge.path);
    if (!coords) continue;
    const relType = edge.relationship.type;
    const flow = edge.relationship.energyFlow;
    const lineElements = [];
    const arrowAttrs = getArrowAttrs(flow);
    switch (relType) {
      case "strong":
        lineElements.push(
          ...parallelLines(coords, 3, 4, {
            class: "schematex-ecomap-eco-line-parallel",
            ...arrowAttrs
          })
        );
        break;
      case "moderate":
        lineElements.push(
          ...parallelLines(coords, 2, 4, {
            class: "schematex-ecomap-eco-line-parallel",
            ...arrowAttrs
          })
        );
        break;
      case "weak":
        lineElements.push(
          el("line", {
            x1: coords.x1,
            y1: coords.y1,
            x2: coords.x2,
            y2: coords.y2,
            class: "schematex-ecomap-eco-line-weak",
            ...arrowAttrs
          })
        );
        break;
      case "stressful":
      case "stressful-strong":
        lineElements.push(
          el("path", {
            d: wavyPath(
              coords.x1,
              coords.y1,
              coords.x2,
              coords.y2,
              8,
              20
            ),
            class: "schematex-ecomap-eco-line-stressful",
            "stroke-width": relType === "stressful-strong" ? "3" : "2",
            ...arrowAttrs
          })
        );
        break;
      case "conflictual":
        lineElements.push(
          el("path", {
            d: wavyPath(
              coords.x1,
              coords.y1,
              coords.x2,
              coords.y2,
              8,
              20
            ),
            class: "schematex-ecomap-eco-line-stressful",
            ...arrowAttrs
          })
        );
        lineElements.push(
          ...conflictMarks(coords)
        );
        break;
      case "broken":
        lineElements.push(
          el("line", {
            x1: coords.x1,
            y1: coords.y1,
            x2: coords.x2,
            y2: coords.y2,
            class: "schematex-ecomap-eco-line-broken",
            ...arrowAttrs
          })
        );
        break;
      default:
        lineElements.push(
          el("line", {
            x1: coords.x1,
            y1: coords.y1,
            x2: coords.x2,
            y2: coords.y2,
            class: "schematex-ecomap-eco-line",
            ...arrowAttrs
          })
        );
        break;
    }
    const isMesosystem = centerId !== void 0 && edge.from !== centerId && edge.to !== centerId;
    const groupClass = isMesosystem ? `schematex-ecomap-connection schematex-ecomap-connection-${relType} schematex-ecomap-connection-mesosystem` : `schematex-ecomap-connection schematex-ecomap-connection-${relType}`;
    const groupAttrs = {
      class: groupClass,
      "data-from": edge.from,
      "data-to": edge.to
    };
    if (isMesosystem) groupAttrs["data-mesosystem"] = "true";
    elements.push(group(groupAttrs, lineElements));
  }
  return group({ class: "schematex-ecomap-connections" }, elements);
}
function renderConnectionLabels(edges, nodes, t) {
  const elements = [];
  const clearsNodes = (x, y, halfW) => nodes.every((n) => {
    const r = n.width / 2;
    const ncx = n.x + r;
    const ncy = n.y + r;
    const dx = Math.max(Math.abs(x - ncx) - halfW, 0);
    const dy = Math.abs(y - ncy);
    return dx * dx + dy * dy > (r + 4) * (r + 4);
  });
  for (const edge of edges) {
    if (!edge.relationship.label) continue;
    const coords = extractLineCoords(edge.path);
    if (!coords) continue;
    const labelW = estimateTextWidth(edge.relationship.label, 10) + 12;
    let lt = 0.5;
    for (const cand of [0.5, 0.62, 0.38, 0.72, 0.28]) {
      const x = coords.x1 + (coords.x2 - coords.x1) * cand;
      const y = coords.y1 + (coords.y2 - coords.y1) * cand;
      if (clearsNodes(x, y, labelW / 2)) {
        lt = cand;
        break;
      }
    }
    const mx = coords.x1 + (coords.x2 - coords.x1) * lt;
    const my = coords.y1 + (coords.y2 - coords.y1) * lt;
    elements.push(
      group({ class: "schematex-ecomap-conn-label-group" }, [
        el("rect", {
          x: mx - labelW / 2,
          y: my - 8,
          width: labelW,
          height: 16,
          rx: 3,
          fill: t.bg,
          "fill-opacity": "0.85"
        }),
        text(
          { x: mx, y: my + 4, class: "schematex-ecomap-eco-conn-label" },
          edge.relationship.label
        )
      ])
    );
  }
  return group({ class: "schematex-ecomap-connection-labels" }, elements);
}
function extractLineCoords(pathData) {
  const m = pathData.match(
    /M\s*([\d.-]+)\s+([\d.-]+)\s*L\s*([\d.-]+)\s+([\d.-]+)/
  );
  if (!m) return null;
  return { x1: +m[1], y1: +m[2], x2: +m[3], y2: +m[4] };
}
function parallelLines(coords, count, gap, attrs) {
  const { x1, y1, x2, y2 } = coords;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return [];
  const nx = -dy / len;
  const ny = dx / len;
  const lines = [];
  const offsets = count === 2 ? [-gap / 2, gap / 2] : count === 3 ? [-gap, 0, gap] : [0];
  for (const off of offsets) {
    lines.push(
      el("line", {
        x1: x1 + nx * off,
        y1: y1 + ny * off,
        x2: x2 + nx * off,
        y2: y2 + ny * off,
        ...attrs
      })
    );
  }
  return lines;
}
function wavyPath(x1, y1, x2, y2, amplitude, wavelength) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const segments = Math.max(4, Math.round(len / wavelength));
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  let d = `M ${x1} ${y1}`;
  for (let i = 0; i < segments; i++) {
    const t1 = (i + 0.5) / segments;
    const t2 = (i + 1) / segments;
    const sign = i % 2 === 0 ? 1 : -1;
    const cpx = x1 + dx * t1 + nx * amplitude * sign;
    const cpy = y1 + dy * t1 + ny * amplitude * sign;
    const ex = x1 + dx * t2;
    const ey = y1 + dy * t2;
    d += ` Q ${cpx} ${cpy} ${ex} ${ey}`;
  }
  return d;
}
function conflictMarks(coords) {
  const mx = (coords.x1 + coords.x2) / 2;
  const my = (coords.y1 + coords.y2) / 2;
  const dx = coords.x2 - coords.x1;
  const dy = coords.y2 - coords.y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return [];
  const nx = -dy / len;
  const ny = dx / len;
  const markLen = 6;
  return [
    el("line", {
      x1: mx - 3 + nx * markLen,
      y1: my - 3 + ny * markLen,
      x2: mx - 3 - nx * markLen,
      y2: my - 3 - ny * markLen,
      class: "schematex-ecomap-eco-line",
      "stroke-width": "2"
    }),
    el("line", {
      x1: mx + 3 + nx * markLen,
      y1: my + 3 + ny * markLen,
      x2: mx + 3 - nx * markLen,
      y2: my + 3 - ny * markLen,
      class: "schematex-ecomap-eco-line",
      "stroke-width": "2"
    })
  ];
}
function getArrowAttrs(flow) {
  if (!flow || flow === "none") return {};
  switch (flow) {
    case "from":
      return { "marker-end": "url(#schematex-ecomap-eco-arrow)" };
    case "to":
      return { "marker-start": "url(#schematex-ecomap-eco-arrow)" };
    case "mutual":
      return {
        "marker-start": "url(#schematex-ecomap-eco-arrow)",
        "marker-end": "url(#schematex-ecomap-eco-arrow)"
      };
    default:
      return {};
  }
}
function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function wrapLabel(label, maxChars) {
  if (label.length <= maxChars) return [label];
  const words = label.split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    if (current && current.length + word.length + 1 > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = current ? current + " " + word : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// src/diagrams/ecomap/index.ts
var ecomap = {
  type: "ecomap",
  detect(text2) {
    const firstLine = firstContentLine(text2)?.toLowerCase() ?? "";
    return firstLine === "ecomap" || firstLine.startsWith("ecomap ") || firstLine.startsWith("ecomap:");
  },
  parse: parseEcomap,
  render(text2, config) {
    const ast = parseEcomap(text2);
    const layout = layoutEcomap(ast);
    const renderConfig = {
      fontFamily: config?.fontFamily ?? "system-ui, -apple-system, sans-serif",
      fontSize: config?.fontSize ?? 12,
      theme: config?.theme ?? "default",
      padding: config?.padding ?? 20
    };
    return renderEcomap(layout, renderConfig, ast);
  }
};

export { EcomapParseError, ecomap, estimateTextWidth, layoutEcomap, parseEcomap, renderEcomap };
//# sourceMappingURL=chunk-FKNZ3DJB.js.map
//# sourceMappingURL=chunk-FKNZ3DJB.js.map