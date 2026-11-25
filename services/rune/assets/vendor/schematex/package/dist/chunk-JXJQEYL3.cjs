'use strict';

var chunkVGO4AJ4K_cjs = require('./chunk-VGO4AJ4K.cjs');
var chunk2JVEMVHO_cjs = require('./chunk-2JVEMVHO.cjs');
var chunk7ZEDTSU3_cjs = require('./chunk-7ZEDTSU3.cjs');

// src/diagrams/pedigree/parser.ts
var PedigreeParseError = class extends Error {
  constructor(message, line2) {
    super(`Line ${line2}: ${message}`);
    this.line = line2;
    this.name = "PedigreeParseError";
  }
  line;
};
var COUPLE_OPS = [
  { token: "-/-", type: "separated" },
  { token: "==", type: "consanguineous" },
  { token: "--", type: "married" },
  { token: "~", type: "cohabiting" }
];
var VALID_SEX = /* @__PURE__ */ new Set(["male", "female", "unknown", "amab", "afab", "uaab"]);
var GENETIC_STATUSES = /* @__PURE__ */ new Set([
  "affected",
  "carrier",
  "carrier-x",
  "obligate-carrier",
  "presymptomatic",
  "unaffected"
]);
var MARKERS = /* @__PURE__ */ new Set(["proband", "consultand", "evaluated"]);
var VALID_STATUS = /* @__PURE__ */ new Set(["deceased", "stillborn", "pregnancy", "sab", "tab", "ectopic"]);
function parsePedigree(text2) {
  const rawLines = text2.split("\n");
  let i = 0;
  while (i < rawLines.length && (rawLines[i].trim() === "" || rawLines[i].trim().startsWith("#") || rawLines[i].trim().startsWith("//") || rawLines[i].trim().startsWith("%%"))) {
    i++;
  }
  if (i >= rawLines.length) throw new PedigreeParseError("Empty input", 1);
  const headerLine = rawLines[i].trim();
  const headerMatch = headerLine.match(
    /^pedigree(?::([a-zA-Z][\w-]*))?\s*(?:"([^"]*)")?\s*$/i
  );
  if (!headerMatch) {
    throw new PedigreeParseError(
      `Expected 'pedigree' header (got '${headerLine}')`,
      i + 1
    );
  }
  const metadata = {};
  if (headerMatch[1]) metadata.mode = headerMatch[1].toLowerCase();
  if (headerMatch[2]) metadata.title = headerMatch[2];
  i++;
  const legend = [];
  const legendOverrides = {};
  let hasLegendOverrides = false;
  const individualsMap = /* @__PURE__ */ new Map();
  const relationships = [];
  while (i < rawLines.length) {
    const raw = rawLines[i];
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed.startsWith("#") || trimmed.startsWith("//") || trimmed.startsWith("%%")) {
      i++;
      continue;
    }
    if (chunk2JVEMVHO_cjs.parseLegendDirective(trimmed, legendOverrides)) {
      hasLegendOverrides = true;
      i++;
      continue;
    }
    const legendMatch = trimmed.match(
      /^legend:\s*([a-zA-Z][a-zA-Z0-9_-]*)\s*=\s*"([^"]*)"\s*(?:\(\s*fill:\s*([a-zA-Z-]+)\s*\))?$/
    );
    if (legendMatch) {
      legend.push({
        id: legendMatch[1],
        label: legendMatch[2],
        fill: legendMatch[3] ?? "full"
      });
      i++;
      continue;
    }
    const coupleMatch = detectCoupleOp(trimmed);
    if (coupleMatch) {
      const { leftId, op, rightRaw } = coupleMatch;
      const lineNum = i + 1;
      const { id: rightId, propsStr: rightProps } = parseIdWithProps(rightRaw);
      const leftKey = leftId.toLowerCase();
      const rightKey = rightId.toLowerCase();
      if (!individualsMap.has(leftKey)) {
        throw new PedigreeParseError(`Unknown individual '${leftId}'`, lineNum);
      }
      if (rightProps) {
        individualsMap.set(rightKey, buildIndividual(rightId, rightProps));
      } else if (!individualsMap.has(rightKey)) {
        throw new PedigreeParseError(`Unknown individual '${rightId}'`, lineNum);
      }
      relationships.push({ type: op.type, from: leftKey, to: rightKey });
      const coupleIndent = leadingSpaces(raw);
      i++;
      while (i < rawLines.length) {
        const childLine = rawLines[i];
        const childTrimmed = childLine.trim();
        if (childTrimmed === "" || childTrimmed.startsWith("#") || childTrimmed.startsWith("//") || childTrimmed.startsWith("%%")) {
          i++;
          continue;
        }
        if (leadingSpaces(childLine) <= coupleIndent) break;
        const { id: childId, propsStr: propsStr2 } = parseIdWithProps(childTrimmed);
        const childKey = childId.toLowerCase();
        individualsMap.set(childKey, buildIndividual(childId, propsStr2));
        const coupleKey = `${leftKey}+${rightKey}`;
        relationships.push({ type: "parent-child", from: coupleKey, to: childKey });
        i++;
      }
      continue;
    }
    const { id, propsStr } = parseIdWithProps(trimmed);
    const key = id.toLowerCase();
    const ind = buildIndividual(id, propsStr);
    const existing = individualsMap.get(key);
    if (existing) {
      individualsMap.set(key, mergeIndividual(existing, ind));
    } else {
      individualsMap.set(key, ind);
    }
    i++;
  }
  return {
    type: "pedigree",
    individuals: Array.from(individualsMap.values()),
    relationships,
    metadata: Object.keys(metadata).length > 0 ? metadata : void 0,
    legend: legend.length > 0 ? legend : void 0,
    legendOverrides: hasLegendOverrides ? legendOverrides : void 0
  };
}
function leadingSpaces(line2) {
  const m = line2.match(/^(\s*)/);
  return m ? m[1].length : 0;
}
function detectCoupleOp(trimmed) {
  for (const op of COUPLE_OPS) {
    let bracketDepth = 0;
    for (let j = 0; j < trimmed.length; j++) {
      if (trimmed[j] === "[") bracketDepth++;
      if (trimmed[j] === "]") bracketDepth--;
      if (bracketDepth > 0) continue;
      if (trimmed.substring(j, j + op.token.length) === op.token) {
        const left = trimmed.substring(0, j).trim();
        const right = trimmed.substring(j + op.token.length).trim();
        if (left && right && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(left)) {
          return { leftId: left, op, rightRaw: right };
        }
      }
    }
  }
  return null;
}
function parseIdWithProps(raw) {
  const bracketIdx = raw.indexOf("[");
  if (bracketIdx === -1) return { id: raw.trim(), propsStr: null };
  const id = raw.substring(0, bracketIdx).trim();
  const endBracket = raw.lastIndexOf("]");
  const propsStr = raw.substring(bracketIdx + 1, endBracket === -1 ? raw.length : endBracket);
  return { id, propsStr };
}
function splitProps(propsStr) {
  const result = [];
  let current = "";
  let parenDepth = 0;
  for (const ch of propsStr) {
    if (ch === "(") parenDepth++;
    if (ch === ")") parenDepth--;
    if (ch === "," && parenDepth === 0) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) result.push(current);
  return result;
}
function buildIndividual(id, propsStr, _lineNum) {
  const ind = {
    id: id.toLowerCase(),
    label: id,
    sex: "unknown",
    status: "alive"
  };
  if (!propsStr) return ind;
  const tokens = splitProps(propsStr);
  for (const rawToken of tokens) {
    const token = rawToken.trim();
    const lower = token.toLowerCase();
    if (VALID_SEX.has(lower)) {
      ind.sex = lower === "amab" ? "male" : lower === "afab" ? "female" : lower === "uaab" ? "unknown" : lower;
    } else if (VALID_STATUS.has(lower)) {
      ind.status = lower;
    } else if (GENETIC_STATUSES.has(lower)) {
      ind.geneticStatus = lower;
    } else if (MARKERS.has(lower)) {
      if (!ind.markers) ind.markers = [];
      ind.markers.push(lower);
    } else if (/^\d{4}$/.test(lower)) {
      ind.birthYear = parseInt(token, 10);
    } else if (lower.startsWith("affected:")) {
      ind.geneticStatus = "affected";
      const traits = token.substring("affected:".length).trim().split("+").map((t) => t.trim());
      ind.conditions = traits.map((t) => ({ label: t, fill: "full" }));
    } else if (token.includes(":")) {
      const colonIdx = token.indexOf(":");
      const key = token.substring(0, colonIdx).trim().toLowerCase();
      const value = token.substring(colonIdx + 1).trim().replace(/^"|"$/g, "");
      if (key === "label") {
        ind.label = value;
      } else {
        if (!ind.properties) ind.properties = {};
        ind.properties[key] = value;
      }
    }
  }
  return ind;
}
function mergeIndividual(existing, incoming) {
  return {
    ...existing,
    sex: incoming.sex !== "unknown" ? incoming.sex : existing.sex,
    status: incoming.status !== "alive" ? incoming.status : existing.status,
    birthYear: incoming.birthYear ?? existing.birthYear,
    geneticStatus: incoming.geneticStatus ?? existing.geneticStatus,
    markers: incoming.markers ?? existing.markers,
    conditions: incoming.conditions ?? existing.conditions,
    properties: { ...existing.properties, ...incoming.properties }
  };
}

// src/diagrams/pedigree/layout.ts
var LABEL_HEIGHT = 20;
var LABEL_GAP = 6;
var GEN_LABEL_MARGIN = 50;
function layoutPedigree(ast, config) {
  const graph = buildGraph(ast);
  assignGenerations(graph);
  const ordered = orderNodesInGenerations(graph);
  const positions = assignPositions(ordered, graph, config);
  const edges = computeEdges(graph, positions, config);
  return packageResult(positions, edges, graph, config);
}
function buildGraph(ast) {
  const individuals = /* @__PURE__ */ new Map();
  for (const ind of ast.individuals) individuals.set(ind.id, ind);
  const familyUnits = [];
  const childOf = /* @__PURE__ */ new Map();
  const coupleRels = ast.relationships.filter(
    (r) => r.type === "married" || r.type === "separated" || r.type === "consanguineous" || r.type === "cohabiting"
  );
  for (const rel of coupleRels) {
    const fuId = `${rel.from}+${rel.to}`;
    const indA = individuals.get(rel.from);
    const indB = individuals.get(rel.to);
    let partners;
    if (indA && indB) {
      if (indA.sex === "male" && indB.sex === "female") {
        partners = [rel.from, rel.to];
      } else if (indA.sex === "female" && indB.sex === "male") {
        partners = [rel.to, rel.from];
      } else {
        partners = [rel.from, rel.to];
      }
    } else {
      partners = [rel.from, rel.to];
    }
    const children = [];
    for (const r of ast.relationships) {
      if (r.type === "parent-child" && r.from === fuId) {
        children.push(r.to);
        childOf.set(r.to, fuId);
      }
    }
    children.sort((a, b) => {
      const ia = individuals.get(a);
      const ib = individuals.get(b);
      return (ia?.birthYear ?? 9999) - (ib?.birthYear ?? 9999);
    });
    familyUnits.push({ id: fuId, partners, relationship: rel.type, children });
  }
  return { individuals, familyUnits, generations: /* @__PURE__ */ new Map(), childOf };
}
function assignGenerations(graph) {
  const { individuals, familyUnits, childOf, generations } = graph;
  const allIds = Array.from(individuals.keys());
  const roots = allIds.filter((id) => !childOf.has(id));
  if (roots.length === 0 && allIds.length > 0) {
    for (const id of allIds) generations.set(id, 0);
    return;
  }
  for (const root of roots) {
    if (!generations.has(root)) generations.set(root, 0);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const fu of familyUnits) {
      const gen0 = generations.get(fu.partners[0]);
      const gen1 = generations.get(fu.partners[1]);
      let partnerGen;
      if (gen0 !== void 0 && gen1 !== void 0) {
        partnerGen = Math.max(gen0, gen1);
        if (gen0 !== partnerGen) {
          generations.set(fu.partners[0], partnerGen);
          changed = true;
        }
        if (gen1 !== partnerGen) {
          generations.set(fu.partners[1], partnerGen);
          changed = true;
        }
      } else if (gen0 !== void 0) {
        partnerGen = gen0;
        generations.set(fu.partners[1], partnerGen);
        changed = true;
      } else if (gen1 !== void 0) {
        partnerGen = gen1;
        generations.set(fu.partners[0], partnerGen);
        changed = true;
      } else {
        continue;
      }
      for (const childId of fu.children) {
        const childGen = partnerGen + 1;
        const existing = generations.get(childId);
        if (existing === void 0 || existing < childGen) {
          generations.set(childId, childGen);
          changed = true;
        }
      }
    }
  }
  for (const id of allIds) {
    if (!generations.has(id)) generations.set(id, 0);
  }
}
function orderNodesInGenerations(graph) {
  const genGroups = /* @__PURE__ */ new Map();
  for (const [id, gen] of graph.generations) {
    const grp = genGroups.get(gen) ?? [];
    grp.push(id);
    genGroups.set(gen, grp);
  }
  const genIndices = Array.from(genGroups.keys()).sort((a, b) => a - b);
  const result = [];
  for (const genIdx of genIndices) {
    const nodeIds = genGroups.get(genIdx) ?? [];
    result.push({ index: genIdx, nodeIds: orderGeneration(nodeIds, graph) });
  }
  return result;
}
function orderGeneration(nodeIds, graph) {
  if (nodeIds.length <= 1) return [...nodeIds];
  const nodeSet = new Set(nodeIds);
  const placed = /* @__PURE__ */ new Set();
  const ordered = [];
  const fuInGen = graph.familyUnits.filter(
    (fu) => nodeSet.has(fu.partners[0]) || nodeSet.has(fu.partners[1])
  );
  for (const fu of fuInGen) {
    for (const p of fu.partners) {
      if (nodeSet.has(p) && !placed.has(p)) {
        ordered.push(p);
        placed.add(p);
      }
    }
  }
  for (const id of nodeIds) {
    if (!placed.has(id)) {
      ordered.push(id);
      placed.add(id);
    }
  }
  return ordered;
}
function assignPositions(orderedGens, graph, config) {
  const positions = /* @__PURE__ */ new Map();
  const { nodeWidth, nodeSpacingX } = config;
  const half = nodeWidth / 2;
  const coupleGap = nodeWidth + nodeSpacingX * 0.6;
  const familyGap = nodeWidth + nodeSpacingX * 1.5;
  const genStepY = config.nodeHeight + LABEL_HEIGHT + LABEL_GAP + config.nodeSpacingY;
  for (const gen of orderedGens) {
    const y = gen.index * genStepY + half;
    const segments = buildSegments(gen.nodeIds, graph);
    let xCursor = GEN_LABEL_MARGIN + half;
    for (let s = 0; s < segments.length; s++) {
      const seg = segments[s];
      if (s > 0) xCursor += familyGap;
      if (seg.type === "couple") {
        positions.set(seg.ids[0], { id: seg.ids[0], x: xCursor, y, generation: gen.index });
        xCursor += coupleGap;
        positions.set(seg.ids[1], { id: seg.ids[1], x: xCursor, y, generation: gen.index });
      } else {
        positions.set(seg.ids[0], { id: seg.ids[0], x: xCursor, y, generation: gen.index });
      }
    }
  }
  resolveOverlaps(positions, orderedGens, config);
  centerChildrenUnderParents(positions, graph, config);
  resolveOverlaps(positions, orderedGens, config);
  return positions;
}
function buildSegments(nodeIds, graph) {
  const nodeSet = new Set(nodeIds);
  const segments = [];
  const placed = /* @__PURE__ */ new Set();
  for (const id of nodeIds) {
    if (placed.has(id)) continue;
    const fu = graph.familyUnits.find(
      (f) => (f.partners[0] === id || f.partners[1] === id) && !placed.has(f.partners[0]) && !placed.has(f.partners[1]) && nodeSet.has(f.partners[0]) && nodeSet.has(f.partners[1])
    );
    if (fu) {
      segments.push({ type: "couple", ids: [fu.partners[0], fu.partners[1]] });
      placed.add(fu.partners[0]);
      placed.add(fu.partners[1]);
    } else {
      segments.push({ type: "single", ids: [id] });
      placed.add(id);
    }
  }
  return segments;
}
function centerChildrenUnderParents(positions, graph, config) {
  const coupleGap = config.nodeSpacingX + config.nodeWidth;
  const personToFUs = /* @__PURE__ */ new Map();
  for (const fu of graph.familyUnits) {
    for (const p of fu.partners) {
      const arr = personToFUs.get(p) ?? [];
      arr.push(fu);
      personToFUs.set(p, arr);
    }
  }
  for (let pass = 0; pass < 3; pass++) {
    for (const fu of graph.familyUnits) {
      if (fu.children.length === 0) continue;
      const posA = positions.get(fu.partners[0]);
      const posB = positions.get(fu.partners[1]);
      if (!posA || !posB) continue;
      const parentMidX = (posA.x + posB.x) / 2;
      const childSpacing = config.nodeSpacingX + config.nodeWidth;
      const sortedChildren = [...fu.children].sort((a, b) => {
        const ia = graph.individuals.get(a);
        const ib = graph.individuals.get(b);
        return (ia?.birthYear ?? 9999) - (ib?.birthYear ?? 9999);
      });
      if (sortedChildren.length > 1) {
        const gaps = [];
        for (let j = 0; j < sortedChildren.length - 1; j++) {
          let gap = childSpacing;
          const nextChild = sortedChildren[j + 1];
          const nextFUs = personToFUs.get(nextChild) ?? [];
          for (const cfu of nextFUs) {
            const pid = cfu.partners[0] === nextChild ? cfu.partners[1] : cfu.partners[0];
            const cInd = graph.individuals.get(nextChild);
            const pInd = graph.individuals.get(pid);
            if (!(cInd?.sex === "male" || cInd?.sex !== "female" && pInd?.sex === "female")) {
              gap += coupleGap;
            }
          }
          const currChild = sortedChildren[j];
          const currFUs = personToFUs.get(currChild) ?? [];
          for (const cfu of currFUs) {
            const pid = cfu.partners[0] === currChild ? cfu.partners[1] : cfu.partners[0];
            const cInd = graph.individuals.get(currChild);
            const pInd = graph.individuals.get(pid);
            if (cInd?.sex === "male" || cInd?.sex !== "female" && pInd?.sex === "female") {
              gap += coupleGap;
            }
          }
          gaps.push(gap);
        }
        const totalWidth = gaps.reduce((s, g) => s + g, 0);
        const startX = parentMidX - totalWidth / 2;
        let cx = startX;
        for (let j = 0; j < sortedChildren.length; j++) {
          const pos = positions.get(sortedChildren[j]);
          if (pos) pos.x = cx;
          if (j < gaps.length) cx += gaps[j];
        }
      } else {
        const pos = positions.get(sortedChildren[0]);
        if (pos) pos.x = parentMidX;
      }
      for (const childId of fu.children) {
        const childPos = positions.get(childId);
        if (!childPos) continue;
        const childFUs = personToFUs.get(childId) ?? [];
        for (const childFU of childFUs) {
          const partnerId = childFU.partners[0] === childId ? childFU.partners[1] : childFU.partners[0];
          const partnerPos = positions.get(partnerId);
          if (!partnerPos) continue;
          const childInd = graph.individuals.get(childId);
          const partnerInd = graph.individuals.get(partnerId);
          if (childInd?.sex === "male" || childInd?.sex !== "female" && partnerInd?.sex === "female") {
            partnerPos.x = childPos.x + coupleGap;
          } else {
            partnerPos.x = childPos.x - coupleGap;
          }
        }
      }
    }
  }
}
function resolveOverlaps(positions, orderedGens, config) {
  const minGap = config.nodeWidth + config.nodeSpacingX;
  for (const gen of orderedGens) {
    const genNodes = gen.nodeIds.map((id) => positions.get(id)).filter((p) => p !== void 0);
    genNodes.sort((a, b) => a.x - b.x);
    for (let j = 1; j < genNodes.length; j++) {
      const gap = genNodes[j].x - genNodes[j - 1].x;
      if (gap < minGap) {
        const shift = minGap - gap;
        for (let k = j; k < genNodes.length; k++) genNodes[k].x += shift;
      }
    }
  }
  let minX = Infinity;
  for (const pos of positions.values()) {
    if (pos.x < minX) minX = pos.x;
  }
  const minAllowed = GEN_LABEL_MARGIN + config.nodeWidth / 2;
  if (minX < minAllowed) {
    const shift = minAllowed - minX;
    for (const pos of positions.values()) pos.x += shift;
  }
}
function computeEdges(graph, positions, config) {
  const edges = [];
  const half = config.nodeWidth / 2;
  const dropY_offset = config.nodeHeight / 2 + LABEL_HEIGHT + LABEL_GAP + config.nodeSpacingY * 0.35;
  for (const fu of graph.familyUnits) {
    const posA = positions.get(fu.partners[0]);
    const posB = positions.get(fu.partners[1]);
    if (!posA || !posB) continue;
    const leftPos = posA.x < posB.x ? posA : posB;
    const rightPos = posA.x < posB.x ? posB : posA;
    const leftId = posA.x < posB.x ? fu.partners[0] : fu.partners[1];
    const rightId = posA.x < posB.x ? fu.partners[1] : fu.partners[0];
    const coupleRel = { type: fu.relationship, from: leftId, to: rightId };
    const couplePath = `M ${leftPos.x + half} ${leftPos.y} L ${rightPos.x - half} ${rightPos.y}`;
    edges.push({ from: leftId, to: rightId, relationship: coupleRel, path: couplePath });
    if (fu.relationship === "consanguineous") {
      const offset = 3;
      const consPath = `M ${leftPos.x + half} ${leftPos.y + offset} L ${rightPos.x - half} ${rightPos.y + offset}`;
      edges.push({
        from: leftId,
        to: rightId,
        relationship: { type: "consanguineous", from: leftId, to: rightId, label: "_double" },
        path: consPath
      });
    }
    if (fu.children.length > 0) {
      const midX = (posA.x + posB.x) / 2;
      const coupleY = posA.y;
      const dropY = coupleY + dropY_offset;
      const childPositions = fu.children.map((cid) => ({ id: cid, pos: positions.get(cid) })).filter((c) => c.pos !== void 0);
      if (childPositions.length === 0) continue;
      childPositions.sort((a, b) => a.pos.x - b.pos.x);
      const leftX = childPositions[0].pos.x;
      const rightX = childPositions[childPositions.length - 1].pos.x;
      edges.push({
        from: fu.partners[0],
        to: fu.partners[1],
        relationship: { type: "parent-child", from: fu.id, to: "_drop" },
        path: `M ${midX} ${coupleY} L ${midX} ${dropY}`
      });
      if (childPositions.length > 1) {
        edges.push({
          from: fu.partners[0],
          to: fu.partners[1],
          relationship: { type: "parent-child", from: fu.id, to: "_sibship" },
          path: `M ${leftX} ${dropY} L ${rightX} ${dropY}`
        });
      }
      for (const child of childPositions) {
        const childTop = child.pos.y - config.nodeHeight / 2;
        const childPath = childPositions.length === 1 ? `M ${midX} ${coupleY} L ${midX} ${childTop}` : `M ${child.pos.x} ${dropY} L ${child.pos.x} ${childTop}`;
        edges.push({
          from: fu.id,
          to: child.id,
          relationship: { type: "parent-child", from: fu.id, to: child.id },
          path: childPath
        });
      }
    }
  }
  return edges;
}
function packageResult(positions, edges, graph, config) {
  const padding = 40;
  const nodes = [];
  for (const [id, pos] of positions) {
    const ind = graph.individuals.get(id);
    if (!ind) continue;
    nodes.push({
      id,
      x: pos.x - config.nodeWidth / 2 + padding,
      y: pos.y - config.nodeHeight / 2 + padding,
      width: config.nodeWidth,
      height: config.nodeHeight,
      generation: pos.generation,
      individual: ind
    });
  }
  const shiftedEdges = edges.map((e) => ({
    ...e,
    path: shiftPath(e.path, padding, padding)
  }));
  let maxX = 0;
  let maxY = 0;
  let minX = Infinity;
  for (const node of nodes) {
    const cx = node.x + node.width / 2;
    const labelText = node.individual.label || node.individual.id;
    const labelHalfWidth = labelText.length * 3.8;
    const right = Math.max(node.x + node.width, cx + labelHalfWidth);
    const left = Math.min(node.x, cx - labelHalfWidth);
    const bottom = node.y + node.height;
    if (right > maxX) maxX = right;
    if (bottom > maxY) maxY = bottom;
    if (left < minX) minX = left;
  }
  if (minX < 0) {
    const shift = -minX;
    for (const node of nodes) {
      node.x += shift;
    }
    for (const edge of shiftedEdges) {
      edge.path = shiftPath(edge.path, shift, 0);
    }
    maxX += shift;
  }
  return {
    width: maxX + padding,
    height: maxY + padding + LABEL_GAP + LABEL_HEIGHT + 10,
    nodes,
    edges: shiftedEdges
  };
}
function shiftPath(pathData, dx, dy) {
  return pathData.replace(
    /([ML])\s*([\d.-]+)\s+([\d.-]+)/g,
    (_match, cmd, xStr, yStr) => {
      const x = parseFloat(xStr) + dx;
      const y = parseFloat(yStr) + dy;
      return `${cmd} ${x} ${y}`;
    }
  );
}

// src/diagrams/pedigree/legend.ts
var SECTIONS = [
  { id: "status", title: "Genetic status" },
  { id: "traits", title: "Traits" },
  { id: "symbols", title: "Symbols" }
];
var OBVIOUS_SEX = /* @__PURE__ */ new Set(["male", "female"]);
function buildPedigreeLegend(ast, theme) {
  const items = [];
  const statusUsed = /* @__PURE__ */ new Set();
  for (const ind of ast.individuals) {
    if (ind.geneticStatus && ind.geneticStatus !== "unaffected") {
      statusUsed.add(ind.geneticStatus);
    }
  }
  const statusOrder = [
    "affected",
    "carrier",
    "carrier-x",
    "obligate-carrier",
    "presymptomatic"
  ];
  for (const s of statusOrder) {
    if (!statusUsed.has(s)) continue;
    items.push(geneticStatusItem(s, theme));
  }
  if (ast.legend && ast.legend.length > 0) {
    for (const entry of ast.legend) {
      const isFull = !entry.fill || entry.fill === "full";
      items.push({
        key: entry.id,
        label: entry.label,
        kind: isFull ? "fill" : "fill-pattern",
        color: entry.color ?? theme.conditionFill,
        shape: isFull ? void 0 : entry.fill,
        section: "traits"
      });
    }
  }
  const sexUsed = /* @__PURE__ */ new Set();
  for (const ind of ast.individuals) sexUsed.add(ind.sex);
  const sexOrder = ["unknown", "other", "nonbinary", "intersex"];
  for (const s of sexOrder) {
    if (!sexUsed.has(s) || OBVIOUS_SEX.has(s)) continue;
    items.push({
      key: `sex.${s}`,
      label: sexLabel(s),
      kind: "shape",
      shape: "diamond",
      fill: theme.unknownFill,
      color: theme.stroke,
      section: "symbols"
    });
  }
  const hasDeceased = ast.individuals.some((i) => i.status === "deceased");
  if (hasDeceased) {
    items.push({
      key: "status.deceased",
      label: "Deceased",
      kind: "marker",
      marker: "slash",
      color: theme.deceasedMark,
      section: "symbols"
    });
  }
  const hasProband = ast.individuals.some((i) => i.markers?.includes("proband"));
  if (hasProband) {
    items.push({
      key: "marker.proband",
      label: "Proband (P) \u2014 first affected case identified",
      kind: "marker",
      marker: "P",
      section: "symbols"
    });
  }
  const hasConsultand = ast.individuals.some((i) => i.markers?.includes("consultand"));
  if (hasConsultand) {
    items.push({
      key: "marker.consultand",
      label: "Consultand (C)",
      kind: "marker",
      marker: "C",
      section: "symbols"
    });
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
function geneticStatusItem(s, theme) {
  switch (s) {
    case "affected":
      return {
        key: `status.${s}`,
        label: "Affected",
        kind: "fill",
        color: theme.conditionFill,
        section: "status"
      };
    case "carrier":
      return {
        key: `status.${s}`,
        label: "Carrier",
        kind: "fill-pattern",
        color: theme.conditionFill,
        shape: "half-left",
        section: "status"
      };
    case "carrier-x":
      return {
        key: `status.${s}`,
        label: "X-linked carrier",
        kind: "marker",
        marker: "dot",
        color: theme.conditionFill,
        section: "status"
      };
    case "obligate-carrier":
      return {
        key: `status.${s}`,
        label: "Obligate carrier",
        kind: "marker",
        marker: "dot",
        color: theme.conditionFill,
        section: "status"
      };
    case "presymptomatic":
      return {
        key: `status.${s}`,
        label: "Presymptomatic",
        kind: "line",
        color: theme.conditionFill,
        pattern: "solid",
        strokeWidth: 2,
        section: "status"
      };
    default:
      return {
        key: `status.${s}`,
        label: humanize(s),
        kind: "fill",
        color: theme.conditionFill,
        section: "status"
      };
  }
}
function sexLabel(s) {
  switch (s) {
    case "unknown":
      return "Unknown sex";
    case "other":
      return "Other";
    case "nonbinary":
      return "Non-binary";
    case "intersex":
      return "Intersex";
    default:
      return s;
  }
}
function humanize(s) {
  return s.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// src/diagrams/pedigree/renderer.ts
function renderPedigree(layout, config, ast) {
  const t = chunk7ZEDTSU3_cjs.resolvePersonTheme(config.theme);
  const defsStr = buildDefs(layout.nodes, t);
  const styleStr = buildStyles(config, t);
  const genGroups = groupByGeneration(layout.nodes);
  const edgeLayers = renderEdges(layout.edges);
  const nodeLayers = renderNodes(genGroups);
  const labelLayer = renderLabels(layout.nodes, genGroups, config);
  const genLabels = renderGenerationLabels(genGroups);
  const nodeCount = layout.nodes.length;
  const genCount = genGroups.size;
  const diagramTitle = ast?.metadata?.title ?? "Pedigree";
  const layers = [
    chunk7ZEDTSU3_cjs.title(diagramTitle),
    chunk7ZEDTSU3_cjs.desc(`Pedigree chart with ${nodeCount} individuals across ${genCount} generations`),
    defsStr,
    styleStr
  ];
  const chartContent = [genLabels, edgeLayers, ...nodeLayers, labelLayer];
  let finalWidth = layout.width;
  let finalHeight = layout.height;
  let legendSvg = "";
  if (ast) {
    const autoSpec = buildPedigreeLegend(ast, t);
    const finalSpec = chunk2JVEMVHO_cjs.applyLegendOverrides(autoSpec, ast.legendOverrides);
    if (finalSpec.mode === "on" && finalSpec.items.length > 0) {
      const { svg, bbox: lb } = chunk2JVEMVHO_cjs.renderLegend(
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
    chunk7ZEDTSU3_cjs.group(
      { transform: chartXOffset > 0 ? `translate(${chartXOffset}, 0)` : void 0 },
      chartContent
    )
  );
  if (legendSvg) layers.push(legendSvg);
  return chunk7ZEDTSU3_cjs.svgRoot(
    {
      viewBox: `0 0 ${finalWidth} ${finalHeight}`,
      class: "schematex-diagram schematex-pedigree",
      width: finalWidth,
      height: finalHeight
    },
    layers
  );
}
function buildDefs(nodes, t) {
  const children = [];
  const needs = /* @__PURE__ */ new Set();
  for (const n of nodes) {
    const gs = n.individual.geneticStatus;
    if (gs) needs.add(gs);
  }
  if (needs.has("carrier")) {
    children.push(
      chunk7ZEDTSU3_cjs.el("clipPath", { id: "schematex-pedigree-clip-carrier-rect" }, [
        chunk7ZEDTSU3_cjs.rect({ x: "0", y: "0", width: "50%", height: "100%" })
      ]),
      chunk7ZEDTSU3_cjs.el("clipPath", { id: "schematex-pedigree-clip-carrier-circle" }, [
        chunk7ZEDTSU3_cjs.rect({ x: "-50", y: "-50", width: "50", height: "100" })
      ])
    );
  }
  children.push(
    chunk7ZEDTSU3_cjs.el("marker", {
      id: "schematex-pedigree-proband-arrow",
      viewBox: "0 0 10 10",
      refX: "0",
      refY: "5",
      markerWidth: "8",
      markerHeight: "8",
      orient: "auto-start-reverse"
    }, [
      chunk7ZEDTSU3_cjs.path({ d: "M 0 0 L 10 5 L 0 10 z", fill: t.stroke })
    ])
  );
  return chunk7ZEDTSU3_cjs.defs(children);
}
function buildStyles(config, t) {
  const css = `
.schematex-pedigree {${chunk7ZEDTSU3_cjs.cssCustomProperties(t)}
}
.schematex-pedigree-shape { fill: ${t.fill}; stroke: ${t.stroke}; stroke-width: ${chunk7ZEDTSU3_cjs.STROKE_WIDTH.normal}; stroke-linejoin: round; }
.schematex-pedigree-label { font-family: ${config.fontFamily}; font-size: ${config.fontSize}px; text-anchor: middle; fill: ${t.text}; }
.schematex-pedigree-gen-label { font-family: ${config.fontFamily}; font-size: 14px; font-weight: bold; fill: ${t.text}; text-anchor: middle; }
.schematex-pedigree-edge { stroke: ${t.stroke}; stroke-width: ${chunk7ZEDTSU3_cjs.STROKE_WIDTH.normal}; fill: none; stroke-linecap: round; stroke-linejoin: round; }
.schematex-pedigree-deceased-mark { stroke: ${t.deceasedMark}; stroke-width: ${chunk7ZEDTSU3_cjs.STROKE_WIDTH.normal}; stroke-linecap: round; }
.schematex-pedigree-affected-fill { fill: ${t.conditionFill}; }
.schematex-pedigree-carrier-fill { fill: ${t.conditionFill}; }
.schematex-pedigree-carrier-x-dot { fill: ${t.conditionFill}; }
.schematex-pedigree-presymptomatic-mark { stroke: ${t.conditionFill}; stroke-width: ${chunk7ZEDTSU3_cjs.STROKE_WIDTH.normal}; }
.schematex-pedigree-proband-arrow-line { stroke: ${t.stroke}; stroke-width: ${chunk7ZEDTSU3_cjs.STROKE_WIDTH.normal}; fill: none; marker-end: url(#schematex-pedigree-proband-arrow); }
.schematex-pedigree-proband-label { font-family: ${config.fontFamily}; font-size: 10px; font-weight: bold; fill: ${t.stroke}; }
.schematex-pedigree-loss-shape { fill: ${t.stroke}; stroke: ${t.stroke}; stroke-width: ${chunk7ZEDTSU3_cjs.STROKE_WIDTH.normal}; stroke-linejoin: round; }
.schematex-pedigree-tab-slash { stroke: ${t.deceasedMark}; stroke-width: ${chunk7ZEDTSU3_cjs.STROKE_WIDTH.normal}; stroke-linecap: round; }
.schematex-pedigree-status-label { font-family: ${config.fontFamily}; font-size: 10px; font-weight: bold; fill: ${t.text}; }
.schematex-pedigree-legend { font-family: ${config.fontFamily}; font-size: 11px; fill: ${t.text}; }
.schematex-pedigree-legend-box { fill: ${t.fill}; stroke: ${t.neutral}; stroke-width: 1; }
`;
  return chunk7ZEDTSU3_cjs.el("style", {}, css);
}
function renderEdges(edges) {
  const children = [];
  for (const edge of edges) {
    const relType = edge.relationship.type;
    const cssClass = `schematex-pedigree-edge schematex-pedigree-edge-${relType}`;
    const elements = [
      chunk7ZEDTSU3_cjs.el("path", { d: edge.path, class: "schematex-pedigree-edge-path" })
    ];
    if (relType === "separated") {
      const mid = pathMidpoint(edge.path);
      if (mid) {
        elements.push(
          chunk7ZEDTSU3_cjs.line({
            x1: mid.x - 4,
            y1: mid.y - 6,
            x2: mid.x + 4,
            y2: mid.y + 6,
            class: "schematex-pedigree-edge"
          })
        );
      }
    }
    children.push(
      chunk7ZEDTSU3_cjs.group({ class: cssClass, "data-from": edge.from, "data-to": edge.to }, elements)
    );
  }
  return chunk7ZEDTSU3_cjs.group({ class: "schematex-pedigree-edges" }, children);
}
function pathMidpoint(pathData) {
  const coords = pathData.match(/[\d.-]+/g);
  if (!coords || coords.length < 4) return null;
  return {
    x: (parseFloat(coords[0]) + parseFloat(coords[2])) / 2,
    y: (parseFloat(coords[1]) + parseFloat(coords[3])) / 2
  };
}
function groupByGeneration(nodes) {
  const groups = /* @__PURE__ */ new Map();
  for (const node of nodes) {
    const grp = groups.get(node.generation) ?? [];
    grp.push(node);
    groups.set(node.generation, grp);
  }
  return groups;
}
function renderNodes(genGroups) {
  const layers = [];
  const sortedGens = Array.from(genGroups.keys()).sort((a, b) => a - b);
  for (const genIdx of sortedGens) {
    const nodes = genGroups.get(genIdx) ?? [];
    const nodeElements = [];
    for (const node of nodes) {
      const cx = node.x + node.width / 2;
      const cy = node.y + node.height / 2;
      nodeElements.push(renderPedigreeSymbol(node.individual, cx, cy, node.width));
    }
    layers.push(
      chunk7ZEDTSU3_cjs.group(
        { class: `schematex-pedigree-generation schematex-pedigree-generation-${genIdx}`, "data-generation": genIdx },
        nodeElements
      )
    );
  }
  return layers;
}
function renderPedigreeSymbol(ind, x, y, size) {
  const half = size / 2;
  const classes = ["schematex-pedigree-node", `schematex-pedigree-${ind.sex === "other" ? "unknown" : ind.sex}`];
  if (ind.status === "deceased") classes.push("schematex-pedigree-deceased");
  if (ind.geneticStatus) classes.push(`schematex-pedigree-${ind.geneticStatus}`);
  const titleText = formatTitle(ind);
  const children = [chunk7ZEDTSU3_cjs.title(titleText)];
  const pregLoss = ind.status === "sab" || ind.status === "tab" || ind.status === "ectopic";
  if (pregLoss) {
    classes.push(`schematex-pedigree-${ind.status}`);
    const t = half * 0.6;
    children.push(
      chunk7ZEDTSU3_cjs.polygon({
        points: `${-t},${-t} ${t},${-t} 0,${t}`,
        class: `schematex-pedigree-loss-shape schematex-pedigree-${ind.status}-shape`
      })
    );
    if (ind.status === "tab") {
      children.push(
        chunk7ZEDTSU3_cjs.line({
          x1: -t * 1.1,
          y1: t * 1.1,
          x2: t * 1.1,
          y2: -t * 1.1,
          class: "schematex-pedigree-tab-slash"
        })
      );
    }
    if (ind.status === "ectopic") {
      children.push(
        chunk7ZEDTSU3_cjs.text(
          { x: 0, y: t + 14, class: "schematex-pedigree-status-label", "text-anchor": "middle" },
          "ECT"
        )
      );
    }
    return chunk7ZEDTSU3_cjs.group(
      {
        class: classes.join(" "),
        "data-individual-id": ind.id,
        transform: `translate(${x}, ${y})`
      },
      children
    );
  }
  children.push(baseShape(ind.sex, half));
  if (ind.status === "stillborn") {
    classes.push("schematex-pedigree-stillborn");
    children.push(
      chunk7ZEDTSU3_cjs.text(
        { x: 0, y: half + 14, class: "schematex-pedigree-status-label", "text-anchor": "middle" },
        "SB"
      )
    );
  }
  const gs = ind.geneticStatus;
  if (gs === "affected") {
    children.push(affectedFill(ind.sex, half));
  } else if (gs === "carrier") {
    children.push(carrierFill(ind.sex, half));
  } else if (gs === "carrier-x" || gs === "obligate-carrier") {
    children.push(carrierDot(half));
  }
  if (gs === "presymptomatic") {
    children.push(
      chunk7ZEDTSU3_cjs.line({ x1: 0, y1: -half, x2: 0, y2: half, class: "schematex-pedigree-presymptomatic-mark" })
    );
  }
  if (ind.status === "deceased") {
    const ext = ind.sex === "female" ? half * 0.707 : half;
    children.push(
      chunk7ZEDTSU3_cjs.line({ x1: ext, y1: -ext, x2: -ext, y2: ext, class: "schematex-pedigree-deceased-mark" })
    );
  }
  if (ind.markers?.includes("proband")) {
    const arrowLen = 20;
    children.push(
      chunk7ZEDTSU3_cjs.line({
        x1: -half - arrowLen,
        y1: half + arrowLen,
        x2: -half - 2,
        y2: half + 2,
        class: "schematex-pedigree-proband-arrow-line"
      }),
      chunk7ZEDTSU3_cjs.text(
        { x: -half - arrowLen - 4, y: half + arrowLen + 4, class: "schematex-pedigree-proband-label", "text-anchor": "end" },
        "P"
      )
    );
  }
  if (ind.markers?.includes("consultand")) {
    const arrowLen = 20;
    children.push(
      chunk7ZEDTSU3_cjs.line({
        x1: -half - arrowLen,
        y1: half + arrowLen,
        x2: -half - 2,
        y2: half + 2,
        class: "schematex-pedigree-proband-arrow-line"
      }),
      chunk7ZEDTSU3_cjs.text(
        { x: -half - arrowLen - 4, y: half + arrowLen + 4, class: "schematex-pedigree-proband-label", "text-anchor": "end" },
        "C"
      )
    );
  }
  if (ind.markers?.includes("evaluated")) {
    children.push(
      chunk7ZEDTSU3_cjs.text(
        { x: 0, y: -half - 4, class: "schematex-pedigree-proband-label", "text-anchor": "middle" },
        "E"
      )
    );
  }
  return chunk7ZEDTSU3_cjs.group(
    {
      class: classes.join(" "),
      "data-individual-id": ind.id,
      transform: `translate(${x}, ${y})`
    },
    children
  );
}
function baseShape(sex, half) {
  switch (sex) {
    case "male":
      return chunk7ZEDTSU3_cjs.rect({ x: -half, y: -half, width: half * 2, height: half * 2, class: "schematex-pedigree-shape" });
    case "female":
      return chunk7ZEDTSU3_cjs.circle({ cx: 0, cy: 0, r: half, class: "schematex-pedigree-shape" });
    default:
      return chunk7ZEDTSU3_cjs.polygon({ points: `0,${-half} ${half},0 0,${half} ${-half},0`, class: "schematex-pedigree-shape" });
  }
}
function affectedFill(sex, half) {
  const attrs = { class: "schematex-pedigree-affected-fill" };
  switch (sex) {
    case "male":
      return chunk7ZEDTSU3_cjs.rect({ x: -half, y: -half, width: half * 2, height: half * 2, ...attrs });
    case "female":
      return chunk7ZEDTSU3_cjs.circle({ cx: 0, cy: 0, r: half, ...attrs });
    default:
      return chunk7ZEDTSU3_cjs.polygon({ points: `0,${-half} ${half},0 0,${half} ${-half},0`, ...attrs });
  }
}
function carrierFill(sex, half) {
  const clipSuffix = sex === "female" ? "circle" : "rect";
  const attrs = {
    class: "schematex-pedigree-carrier-fill",
    "clip-path": `url(#schematex-pedigree-clip-carrier-${clipSuffix})`
  };
  switch (sex) {
    case "male":
      return chunk7ZEDTSU3_cjs.rect({ x: -half, y: -half, width: half * 2, height: half * 2, ...attrs });
    case "female":
      return chunk7ZEDTSU3_cjs.circle({ cx: 0, cy: 0, r: half, ...attrs });
    default:
      return chunk7ZEDTSU3_cjs.polygon({ points: `0,${-half} ${half},0 0,${half} ${-half},0`, ...attrs });
  }
}
function carrierDot(half) {
  return chunk7ZEDTSU3_cjs.circle({ cx: 0, cy: 0, r: half * 0.15, class: "schematex-pedigree-carrier-x-dot" });
}
function formatTitle(ind) {
  const name = ind.label.charAt(0).toUpperCase() + ind.label.slice(1);
  if (ind.geneticStatus && ind.geneticStatus !== "unaffected") {
    return `${name} (${ind.geneticStatus})`;
  }
  return name;
}
function renderLabels(nodes, genGroups, config) {
  const labels = [];
  const genNumbering = /* @__PURE__ */ new Map();
  const sortedGens = Array.from(genGroups.keys()).sort((a, b) => a - b);
  for (const genIdx of sortedGens) {
    const genNodes = genGroups.get(genIdx) ?? [];
    const sorted = [...genNodes].sort((a, b) => a.x - b.x);
    const romanNum = toRoman(genIdx + 1);
    for (let i = 0; i < sorted.length; i++) {
      genNumbering.set(sorted[i].id, `${romanNum}-${i + 1}`);
    }
  }
  for (const node of nodes) {
    const ind = node.individual;
    const cx = node.x + node.width / 2;
    const labelY = node.y + node.height + 6 + config.fontSize;
    const pedigreeId = genNumbering.get(ind.id) ?? ind.id;
    const displayLabel = ind.label !== ind.id ? ind.label : pedigreeId;
    labels.push(
      chunk7ZEDTSU3_cjs.text(
        { x: cx, y: labelY, class: "schematex-pedigree-label", "data-individual-id": ind.id },
        displayLabel
      )
    );
  }
  return chunk7ZEDTSU3_cjs.group({ class: "schematex-pedigree-labels" }, labels);
}
function renderGenerationLabels(genGroups, _config) {
  const labels = [];
  const sortedGens = Array.from(genGroups.keys()).sort((a, b) => a - b);
  for (const genIdx of sortedGens) {
    const nodes = genGroups.get(genIdx) ?? [];
    if (nodes.length === 0) continue;
    const midY = nodes[0].y + nodes[0].height / 2;
    const roman = toRoman(genIdx + 1);
    labels.push(
      chunk7ZEDTSU3_cjs.text(
        { x: 25, y: midY + 5, class: "schematex-pedigree-gen-label" },
        roman
      )
    );
  }
  return chunk7ZEDTSU3_cjs.group({ class: "schematex-pedigree-generation-labels" }, labels);
}
function toRoman(n) {
  const vals = [1e3, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
  const syms = ["M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"];
  let result = "";
  for (let i = 0; i < vals.length; i++) {
    while (n >= vals[i]) {
      result += syms[i];
      n -= vals[i];
    }
  }
  return result;
}

// src/diagrams/pedigree/index.ts
var pedigree = {
  type: "pedigree",
  detect(text2) {
    const firstLine = chunkVGO4AJ4K_cjs.firstContentLine(text2)?.toLowerCase() ?? "";
    return firstLine === "pedigree" || firstLine.startsWith("pedigree ") || firstLine.startsWith("pedigree:");
  },
  parse: parsePedigree,
  render(text2, config) {
    const ast = parsePedigree(text2);
    const layoutConfig = {
      nodeSpacingX: 80,
      nodeSpacingY: 100,
      nodeWidth: 40,
      nodeHeight: 40
    };
    const layout = layoutPedigree(ast, layoutConfig);
    const renderConfig = {
      fontFamily: config?.fontFamily ?? "system-ui, -apple-system, sans-serif",
      fontSize: config?.fontSize ?? 12,
      theme: config?.theme ?? "default",
      padding: config?.padding ?? 20
    };
    return renderPedigree(layout, renderConfig, ast);
  }
};

exports.PedigreeParseError = PedigreeParseError;
exports.layoutPedigree = layoutPedigree;
exports.parsePedigree = parsePedigree;
exports.pedigree = pedigree;
exports.renderPedigree = renderPedigree;
//# sourceMappingURL=chunk-JXJQEYL3.cjs.map
//# sourceMappingURL=chunk-JXJQEYL3.cjs.map