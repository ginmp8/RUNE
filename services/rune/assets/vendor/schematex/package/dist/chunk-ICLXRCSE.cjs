'use strict';

var chunk4M6OFAHM_cjs = require('./chunk-4M6OFAHM.cjs');
var chunk7ZEDTSU3_cjs = require('./chunk-7ZEDTSU3.cjs');

// src/diagrams/phylo/parser.ts
var PhyloParseError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "PhyloParseError";
  }
};
var _pos = 0;
var _src = "";
var _nextId = 0;
function genId() {
  return `_n${_nextId++}`;
}
function peek() {
  return _src[_pos] ?? "";
}
function advance() {
  return _src[_pos++] ?? "";
}
function skipWhitespace() {
  while (_pos < _src.length && /\s/.test(_src[_pos])) _pos++;
}
function parseNewickName() {
  skipWhitespace();
  if (peek() === "'") {
    advance();
    let name2 = "";
    while (_pos < _src.length) {
      if (peek() === "'") {
        advance();
        if (peek() === "'") {
          name2 += "'";
          advance();
        } else {
          break;
        }
      } else {
        name2 += advance();
      }
    }
    return name2;
  }
  let name = "";
  while (_pos < _src.length && !/[\s():,;[\]']/.test(_src[_pos])) {
    name += advance();
  }
  return name;
}
function parseNewickLength() {
  skipWhitespace();
  if (peek() !== ":") return void 0;
  advance();
  skipWhitespace();
  let numStr = "";
  while (_pos < _src.length && /[0-9eE.+-]/.test(_src[_pos])) {
    numStr += advance();
  }
  if (!numStr) return void 0;
  const val = Number(numStr);
  return Number.isNaN(val) ? void 0 : val;
}
function parseNHX() {
  skipWhitespace();
  if (peek() !== "[") return void 0;
  const start = _pos;
  advance();
  let content = "";
  let depth = 1;
  while (_pos < _src.length && depth > 0) {
    if (peek() === "[") depth++;
    if (peek() === "]") depth--;
    if (depth > 0) content += advance();
    else advance();
  }
  if (content.startsWith("&&NHX:")) {
    const pairs = content.slice(6).split(":");
    const nhx = {};
    let support;
    for (const pair of pairs) {
      const eq = pair.indexOf("=");
      if (eq === -1) continue;
      const key = pair.slice(0, eq);
      const val = pair.slice(eq + 1);
      nhx[key] = val;
      if (key === "B") {
        const num2 = Number(val);
        if (!Number.isNaN(num2)) support = num2;
      }
    }
    return { support, nhx };
  }
  const num = Number(content.trim());
  if (!Number.isNaN(num) && content.trim().length > 0) {
    return { support: num };
  }
  _pos = start;
  return void 0;
}
function parseNewickSubtree() {
  skipWhitespace();
  let children = [];
  if (peek() === "(") {
    advance();
    children = [];
    children.push(parseNewickSubtree());
    skipWhitespace();
    while (peek() === ",") {
      advance();
      children.push(parseNewickSubtree());
      skipWhitespace();
    }
    skipWhitespace();
    if (peek() === ")") advance();
  }
  const name = parseNewickName();
  const nhxData = parseNHX();
  const branchLength = parseNewickLength();
  const nhxData2 = nhxData ? void 0 : parseNHX();
  const merged = nhxData ?? nhxData2;
  const isLeaf = children.length === 0;
  const id = name || genId();
  return {
    id,
    label: name || void 0,
    branchLength,
    support: merged?.support,
    children,
    isLeaf,
    nhx: merged?.nhx
  };
}
function parseNewick(newick) {
  _pos = 0;
  _src = newick.trim();
  _nextId = 0;
  if (_src.endsWith(";")) {
    _src = _src.slice(0, -1);
  }
  const root = parseNewickSubtree();
  return root;
}
function parseIndentTree(lines) {
  _nextId = 0;
  const parsed = [];
  for (const raw of lines) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const indent = raw.search(/\S/);
    const content = raw.trim();
    let name;
    let branchLength;
    let support;
    let contentClean = content;
    const supportMatch = contentClean.match(/\[(\d+(?:\.\d+)?)\]\s*$/);
    if (supportMatch) {
      support = Number(supportMatch[1]);
      contentClean = contentClean.slice(0, supportMatch.index).trim();
    }
    const colonIdx = contentClean.indexOf(":");
    if (colonIdx === -1) {
      name = contentClean;
    } else {
      name = contentClean.slice(0, colonIdx).trim();
      const lenStr = contentClean.slice(colonIdx + 1).trim();
      if (lenStr) {
        const num = Number(lenStr);
        if (!Number.isNaN(num)) branchLength = num;
      }
    }
    parsed.push({ indent, name, branchLength, support });
  }
  if (parsed.length === 0) {
    throw new PhyloParseError("Empty indent tree definition");
  }
  function buildTree(startIdx, parentIndent) {
    const line2 = parsed[startIdx];
    const children2 = [];
    let idx2 = startIdx + 1;
    while (idx2 < parsed.length && parsed[idx2].indent > parentIndent) {
      if (parsed[idx2].indent === line2.indent + 2 || parsed[idx2].indent > line2.indent) {
        const childIndent = parsed[idx2].indent;
        const result = buildTree(idx2, childIndent);
        children2.push(result.node);
        idx2 = result.nextIdx;
      } else {
        break;
      }
    }
    const id = line2.name || genId();
    return {
      node: {
        id,
        label: line2.name || void 0,
        branchLength: line2.branchLength,
        support: line2.support,
        children: children2,
        isLeaf: children2.length === 0
      },
      nextIdx: idx2
    };
  }
  const rootLine = parsed[0];
  const rootIndent = rootLine.indent;
  const children = [];
  let idx = 1;
  while (idx < parsed.length) {
    if (parsed[idx].indent > rootIndent) {
      const result = buildTree(idx, parsed[idx].indent);
      children.push(result.node);
      idx = result.nextIdx;
    } else {
      break;
    }
  }
  const rootId = rootLine.name || genId();
  return {
    id: rootId,
    label: rootLine.name || void 0,
    branchLength: rootLine.branchLength,
    support: rootLine.support,
    children,
    isLeaf: children.length === 0
  };
}
function parseHeaderProps(propsStr) {
  const result = {
    layout: "rectangular",
    mode: "phylogram",
    unrooted: false
  };
  const pairs = propsStr.split(",").map((s) => s.trim());
  for (const pair of pairs) {
    if (pair === "unrooted") {
      result.unrooted = true;
      continue;
    }
    const colonIdx = pair.indexOf(":");
    if (colonIdx === -1) continue;
    const key = pair.slice(0, colonIdx).trim();
    const val = pair.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, "");
    switch (key) {
      case "layout":
        if (["rectangular", "slanted", "circular", "unrooted"].includes(val)) {
          result.layout = val;
        }
        break;
      case "mode":
        if (["phylogram", "cladogram", "chronogram"].includes(val)) {
          result.mode = val;
        } else if (val === "dendrogram") {
          result.mode = "cladogram";
          result.dendrogram = true;
        }
        break;
      case "branch-width":
        result.branchWidth = Number(val);
        break;
      case "openAngle":
        result.openAngle = Number(val);
        break;
      case "mrsd":
        result.mrsd = val;
        break;
    }
  }
  if (result.layout === "unrooted") {
    result.unrooted = true;
  }
  return result;
}
function parseCladeLine(line2) {
  const match = line2.match(
    /^clade\s+(\S+)\s*=\s*\(([^)]+)\)\s*(?:\[([^\]]*)\])?\s*$/
  );
  if (!match) return null;
  const id = match[1];
  const members = match[2].split(",").map((s) => s.trim()).filter(Boolean);
  const propsStr = match[3] ?? "";
  let color;
  let label;
  let highlight;
  if (propsStr) {
    const colorMatch = propsStr.match(/color:\s*"([^"]+)"/);
    if (colorMatch) color = colorMatch[1];
    const labelMatch = propsStr.match(/label:\s*"([^"]+)"/);
    if (labelMatch) label = labelMatch[1];
    const hlMatch = propsStr.match(/highlight:\s*(\w+)/);
    if (hlMatch && ["branch", "background", "both"].includes(hlMatch[1])) {
      highlight = hlMatch[1];
    }
  }
  return { id, members, color, label, highlight };
}
function parsePhylo(text2) {
  const lines = text2.split("\n");
  let lineIdx = 0;
  while (lineIdx < lines.length && !lines[lineIdx].trim()) lineIdx++;
  const headerLine = lines[lineIdx]?.trim() ?? "";
  if (!headerLine.toLowerCase().startsWith("phylo")) {
    throw new PhyloParseError("Phylo document must start with 'phylo'");
  }
  lineIdx++;
  const title2 = chunk4M6OFAHM_cjs.matchQuotedTitle(headerLine);
  let headerProps = {
    layout: "rectangular",
    mode: "phylogram",
    unrooted: false
  };
  const propsMatch = headerLine.match(/\[([^\]]+)\]/);
  if (propsMatch) {
    headerProps = parseHeaderProps(propsMatch[1]);
  }
  let root = null;
  let scaleLabel;
  let outgroup;
  let cut;
  const clades = [];
  const indentLines = [];
  let inIndentTree = false;
  while (lineIdx < lines.length) {
    const raw = lines[lineIdx];
    const trimmed = raw.trim();
    lineIdx++;
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("newick:")) {
      const newickStr = trimmed.slice(7).trim().replace(/^["']|["']$/g, "");
      root = parseNewick(newickStr);
      inIndentTree = false;
      continue;
    }
    if (trimmed.startsWith("scale")) {
      const scaleMatch = trimmed.match(/scale\s+"([^"]+)"/);
      if (scaleMatch) {
        scaleLabel = scaleMatch[1];
      } else {
        scaleLabel = trimmed.slice(5).trim().replace(/^["']|["']$/g, "") || "substitutions/site";
      }
      continue;
    }
    if (trimmed.startsWith("outgroup:")) {
      outgroup = trimmed.slice(9).trim();
      continue;
    }
    if (/^cut\b/i.test(trimmed)) {
      const cutStr = trimmed.replace(/^cut\s*:?\s*/i, "").trim();
      const cutVal = Number(cutStr);
      if (!Number.isNaN(cutVal)) cut = cutVal;
      continue;
    }
    if (trimmed.startsWith("clade ")) {
      const clade = parseCladeLine(trimmed);
      if (clade) clades.push(clade);
      continue;
    }
    if (trimmed.startsWith("style")) {
      const styleProps = trimmed.match(/\[([^\]]+)\]/);
      if (styleProps) {
        headerProps = { ...headerProps, ...parseHeaderProps(styleProps[1]) };
      }
      continue;
    }
    if (trimmed.endsWith(":") && (trimmed === "root:" || !trimmed.includes(" "))) {
      inIndentTree = true;
      indentLines.push(raw);
      continue;
    }
    if (inIndentTree) {
      indentLines.push(raw);
      continue;
    }
  }
  if (!root && indentLines.length > 0) {
    root = parseIndentTree(indentLines);
  }
  if (!root) {
    throw new PhyloParseError("No tree definition found (newick: or indent tree)");
  }
  const metadata = {};
  if (headerProps.dendrogram) metadata.dendrogram = "true";
  if (cut !== void 0) metadata.cut = String(cut);
  return {
    type: "phylo",
    title: title2,
    root,
    unrooted: headerProps.unrooted,
    layout: headerProps.layout,
    mode: headerProps.mode,
    clades,
    scaleLabel,
    mrsd: headerProps.mrsd,
    outgroup,
    metadata
  };
}

// src/diagrams/phylo/dendrogram.ts
var TIP_SPACING = 24;
var PADDING_LEFT = 20;
var PADDING_RIGHT = 20;
var PADDING_TOP = 24;
var PADDING_BOTTOM = 52;
function isDendrogram(ast) {
  return ast.metadata?.dendrogram === "true";
}
function getCut(ast) {
  const raw = ast.metadata?.cut;
  if (raw === void 0) return void 0;
  const val = Number(raw);
  return Number.isNaN(val) ? void 0 : val;
}
function collectLeaves(node) {
  if (node.isLeaf) return [node];
  const leaves = [];
  for (const child of node.children) {
    leaves.push(...collectLeaves(child));
  }
  return leaves;
}
function estimateLabelWidth(node) {
  const label = node.label ?? node.id;
  return label.length * 7.2 + 6;
}
function computeHeights(node, out) {
  if (node.isLeaf) {
    out.set(node.id, 0);
    return 0;
  }
  let max = 0;
  for (const child of node.children) {
    const childHeight = computeHeights(child, out);
    const branch = child.branchLength ?? 0;
    const reach = childHeight + branch;
    if (reach > max) max = reach;
  }
  out.set(node.id, max);
  return max;
}
function computeClusters(ast, heights, cutValue) {
  const clusters = [];
  function visit(node, parentHeight) {
    const h = heights.get(node.id) ?? 0;
    if (h <= cutValue && parentHeight > cutValue) {
      clusters.push({ rootId: node.id, leafIds: collectLeaves(node).map((l) => l.id) });
      return;
    }
    if (h > cutValue) {
      for (const child of node.children) visit(child, h);
    } else {
      clusters.push({ rootId: node.id, leafIds: collectLeaves(node).map((l) => l.id) });
    }
  }
  visit(ast.root, Number.POSITIVE_INFINITY);
  return clusters;
}
function layoutDendrogram(ast) {
  const leaves = collectLeaves(ast.root);
  const numLeaves = leaves.length;
  const heights = /* @__PURE__ */ new Map();
  const maxHeight = computeHeights(ast.root, heights);
  const maxLabelWidth = Math.max(...leaves.map(estimateLabelWidth), 60);
  const availableWidth = Math.max(320, numLeaves * 36 + maxLabelWidth + 120);
  const plotWidth = availableWidth - PADDING_LEFT - PADDING_RIGHT - maxLabelWidth;
  const scale = maxHeight > 0 ? plotWidth / maxHeight : plotWidth;
  const baselineX = PADDING_LEFT + plotWidth;
  const heightToX = (h) => baselineX - h * scale;
  const nodeMap = /* @__PURE__ */ new Map();
  let leafIdx = 0;
  function assignLeaf(node) {
    if (node.isLeaf) {
      const y = PADDING_TOP + leafIdx * TIP_SPACING;
      nodeMap.set(node.id, { node, x: baselineX, y });
      leafIdx++;
      return;
    }
    for (const child of node.children) assignLeaf(child);
  }
  assignLeaf(ast.root);
  function assignInternal(node) {
    const existing = nodeMap.get(node.id);
    if (node.isLeaf && existing) return existing.y;
    const childYs = node.children.map(assignInternal);
    const y = (Math.min(...childYs) + Math.max(...childYs)) / 2;
    const x = heightToX(heights.get(node.id) ?? 0);
    if (existing) {
      existing.y = y;
      existing.x = x;
    } else {
      nodeMap.set(node.id, { node, x, y });
    }
    return y;
  }
  assignInternal(ast.root);
  const cut = getCut(ast);
  const leafCluster = /* @__PURE__ */ new Map();
  let clusterCount = 0;
  if (cut !== void 0) {
    const clusters = computeClusters(ast, heights, cut);
    clusterCount = clusters.length;
    clusters.forEach((cluster, idx) => {
      for (const leafId of cluster.leafIds) leafCluster.set(leafId, idx);
    });
  }
  function subtreeCluster(node) {
    const ids = collectLeaves(node).map((l) => l.id);
    const first = leafCluster.get(ids[0]);
    if (first === void 0) return void 0;
    for (const id of ids) {
      if (leafCluster.get(id) !== first) return void 0;
    }
    return first;
  }
  const branches = [];
  function generate(node) {
    if (node.children.length === 0) return;
    const parent = nodeMap.get(node.id);
    if (!parent) return;
    const childLayouts = node.children.map((c) => nodeMap.get(c.id)).filter((l) => l !== void 0);
    if (childLayouts.length === 0) return;
    const minY = Math.min(...childLayouts.map((c) => c.y));
    const maxY = Math.max(...childLayouts.map((c) => c.y));
    branches.push({
      path: `M ${parent.x},${minY} V ${maxY}`,
      fromId: node.id,
      toId: node.id,
      isConnector: true
    });
    for (const child of node.children) {
      const childLayout = nodeMap.get(child.id);
      if (!childLayout) continue;
      const cluster = subtreeCluster(child);
      branches.push({
        path: `M ${parent.x},${childLayout.y} H ${childLayout.x}`,
        fromId: node.id,
        toId: child.id,
        cladeId: cluster !== void 0 ? `cut${cluster}` : void 0,
        isConnector: false
      });
    }
    for (const child of node.children) generate(child);
  }
  generate(ast.root);
  const allNodes = Array.from(nodeMap.values());
  const maxX = Math.max(
    ...allNodes.map((n) => n.x + (n.node.isLeaf ? estimateLabelWidth(n.node) : 0))
  );
  const maxNodeY = Math.max(...allNodes.map((n) => n.y));
  const width = Math.max(maxX + PADDING_RIGHT, availableWidth);
  const height = maxNodeY + PADDING_TOP + PADDING_BOTTOM;
  return {
    width,
    height,
    nodes: allNodes,
    branches,
    ast,
    scale,
    // Dendrogram-specific extras stashed for the renderer (see types below).
    dendrogram: {
      maxHeight,
      baselineX,
      plotLeftX: PADDING_LEFT,
      scale,
      cut,
      clusterCount,
      leafCluster,
      heights
    }
  };
}

// src/diagrams/phylo/layout.ts
function collectLeaves2(node) {
  if (node.isLeaf) return [node];
  const leaves = [];
  for (const child of node.children) {
    leaves.push(...collectLeaves2(child));
  }
  return leaves;
}
function maxRootToTip(node, distSoFar) {
  if (node.isLeaf) return distSoFar;
  let maxDist = distSoFar;
  for (const child of node.children) {
    const childDist = maxRootToTip(child, distSoFar + (child.branchLength ?? 0));
    if (childDist > maxDist) maxDist = childDist;
  }
  return maxDist;
}
function maxDepth(node) {
  if (node.isLeaf) return 0;
  let max = 0;
  for (const child of node.children) {
    const d = maxDepth(child) + 1;
    if (d > max) max = d;
  }
  return max;
}
function estimateLabelWidth2(node) {
  const label = node.label ?? node.id;
  return label.length * 7.2 + 6;
}
function buildCladeMap(ast) {
  const branchToCladeMap = /* @__PURE__ */ new Map();
  for (const clade of ast.clades) {
    const memberSet = new Set(clade.members);
    markCladeBranches(ast.root, memberSet, clade.id, branchToCladeMap);
  }
  return branchToCladeMap;
}
function markCladeBranches(node, memberSet, cladeId, result) {
  if (node.isLeaf) {
    return memberSet.has(node.id);
  }
  const childResults = [];
  for (const child of node.children) {
    childResults.push(markCladeBranches(child, memberSet, cladeId, result));
  }
  const allIn = childResults.every(Boolean);
  const anyIn = childResults.some(Boolean);
  if (allIn && anyIn) {
    for (const child of node.children) {
      result.set(child.id, cladeId);
    }
    return true;
  }
  for (let i = 0; i < node.children.length; i++) {
    if (childResults[i]) {
      result.set(node.children[i].id, cladeId);
    }
  }
  return false;
}
var TIP_SPACING2 = 20;
var PADDING_LEFT2 = 20;
var PADDING_RIGHT2 = 20;
var PADDING_TOP2 = 20;
var PADDING_BOTTOM2 = 40;
function layoutPhylo(ast) {
  if (isDendrogram(ast)) {
    return layoutDendrogram(ast);
  }
  const leaves = collectLeaves2(ast.root);
  const numLeaves = leaves.length;
  const tipSpacing = TIP_SPACING2;
  const maxLabelWidth = Math.max(...leaves.map(estimateLabelWidth2), 60);
  const maxDist = maxRootToTip(ast.root, 0);
  const isCladogram = ast.mode === "cladogram";
  const availableWidth = Math.max(300, numLeaves * 30 + maxLabelWidth + 100);
  const plotWidth = availableWidth - PADDING_LEFT2 - PADDING_RIGHT2 - maxLabelWidth;
  let scale;
  if (isCladogram || maxDist === 0) {
    const depth = maxDepth(ast.root);
    scale = depth > 0 ? plotWidth / depth : plotWidth;
  } else {
    scale = plotWidth / maxDist;
  }
  const nodeMap = /* @__PURE__ */ new Map();
  let leafIdx = 0;
  function assignLeafY(node) {
    if (node.isLeaf) {
      const y = PADDING_TOP2 + leafIdx * tipSpacing;
      nodeMap.set(node.id, { node, x: 0, y });
      leafIdx++;
      return;
    }
    for (const child of node.children) {
      assignLeafY(child);
    }
  }
  assignLeafY(ast.root);
  function assignInternalY(node) {
    const existing = nodeMap.get(node.id);
    if (node.isLeaf && existing) return existing.y;
    const childYs = node.children.map(assignInternalY);
    const y = (Math.min(...childYs) + Math.max(...childYs)) / 2;
    if (!existing) {
      nodeMap.set(node.id, { node, x: 0, y });
    } else {
      existing.y = y;
    }
    return y;
  }
  assignInternalY(ast.root);
  function assignX(node, parentX, depth) {
    let x;
    if (node === ast.root) {
      x = PADDING_LEFT2;
    } else if (isCladogram) {
      if (node.isLeaf) {
        x = PADDING_LEFT2 + plotWidth;
      } else {
        x = PADDING_LEFT2 + depth * (plotWidth / maxDepth(ast.root));
      }
    } else {
      x = parentX + (node.branchLength ?? 0) * scale;
    }
    const layoutNode = nodeMap.get(node.id);
    if (layoutNode) layoutNode.x = x;
    for (const child of node.children) {
      assignX(child, x, depth + 1);
    }
  }
  assignX(ast.root, PADDING_LEFT2, 0);
  if (isCladogram) {
    assignCladogramInternalX(ast.root, nodeMap);
  }
  const cladeMap = buildCladeMap(ast);
  const branches = [];
  function generateBranches(node) {
    const parentLayout = nodeMap.get(node.id);
    if (!parentLayout) return;
    if (node.children.length === 0) return;
    const childLayouts = node.children.map((c) => nodeMap.get(c.id)).filter((l) => l !== void 0);
    if (childLayouts.length === 0) return;
    const minY = Math.min(...childLayouts.map((c) => c.y));
    const maxY = Math.max(...childLayouts.map((c) => c.y));
    if (ast.layout === "slanted") {
      for (const child of node.children) {
        const childLayout = nodeMap.get(child.id);
        if (!childLayout) continue;
        const pathStr = `M ${parentLayout.x},${parentLayout.y} L ${childLayout.x},${childLayout.y}`;
        branches.push({
          path: pathStr,
          fromId: node.id,
          toId: child.id,
          cladeId: cladeMap.get(child.id),
          isConnector: false
        });
      }
    } else {
      branches.push({
        path: `M ${parentLayout.x},${minY} V ${maxY}`,
        fromId: node.id,
        toId: node.id,
        isConnector: true
      });
      for (const child of node.children) {
        const childLayout = nodeMap.get(child.id);
        if (!childLayout) continue;
        const pathStr = `M ${parentLayout.x},${childLayout.y} H ${childLayout.x}`;
        branches.push({
          path: pathStr,
          fromId: node.id,
          toId: child.id,
          cladeId: cladeMap.get(child.id),
          isConnector: false
        });
      }
    }
    for (const child of node.children) {
      generateBranches(child);
    }
  }
  generateBranches(ast.root);
  const allNodes = Array.from(nodeMap.values());
  let maxX = Math.max(...allNodes.map((n) => n.x + (n.node.isLeaf ? estimateLabelWidth2(n.node) : 0)));
  let maxCladeLabelWidth = 0;
  for (const clade of ast.clades) {
    if (clade.label && clade.highlight && clade.highlight !== "branch") {
      const w = clade.label.length * 8 + 30;
      if (w > maxCladeLabelWidth) maxCladeLabelWidth = w;
    }
  }
  maxX += maxCladeLabelWidth;
  const maxNodeY = Math.max(...allNodes.map((n) => n.y));
  const width = Math.max(maxX + PADDING_RIGHT2, availableWidth);
  const height = maxNodeY + PADDING_TOP2 + PADDING_BOTTOM2;
  return {
    width,
    height,
    nodes: allNodes,
    branches,
    ast,
    scale
  };
}
function assignCladogramInternalX(node, nodeMap) {
  if (node.isLeaf) {
    return nodeMap.get(node.id)?.x ?? 0;
  }
  let minChildX = Infinity;
  for (const child of node.children) {
    const childX = assignCladogramInternalX(child, nodeMap);
    if (childX < minChildX) minChildX = childX;
  }
  const layout = nodeMap.get(node.id);
  if (layout) {
    layout.x = minChildX - 40;
    if (layout.x < PADDING_LEFT2) layout.x = PADDING_LEFT2;
  }
  return layout?.x ?? PADDING_LEFT2;
}

// src/diagrams/phylo/renderer.ts
var TIP_LABEL_GAP = 6;
var SUPPORT_THRESHOLD = 50;
function getSupportColor(value, t) {
  if (value >= 95) return t.supportGood;
  if (value >= 75) return t.supportMedium;
  if (value >= 50) return t.supportWarn;
  return t.supportBad;
}
function isSpeciesBinomial(label) {
  const parts = label.trim().split(/\s+/);
  if (parts.length !== 2) return false;
  return /^[A-Z][a-z]+$/.test(parts[0]) && /^[a-z]+$/.test(parts[1]);
}
function buildCSS(ast, t) {
  const cladeColors = ast.clades.map((c, i) => {
    const color = c.color ?? t.cladeColors[i % t.cladeColors.length];
    return `.schematex-phylo-clade-${c.id} { stroke: ${color}; }
.schematex-phylo-clade-bg-${c.id} { fill: ${color}; fill-opacity: 0.12; }
.schematex-phylo-clade-label-${c.id} { fill: ${color}; }`;
  });
  const cutColors = [];
  if (ast.metadata?.dendrogram === "true" && ast.metadata?.cut !== void 0) {
    for (let i = 0; i < t.cladeColors.length; i++) {
      cutColors.push(
        `.schematex-phylo-clade-cut${i} { stroke: ${t.cladeColors[i % t.cladeColors.length]}; }`
      );
    }
  }
  return `
.schematex-phylo {${chunk7ZEDTSU3_cjs.cssCustomProperties(t)}
  font-family: system-ui, -apple-system, sans-serif;
}
.schematex-phylo-branch { fill: none; stroke: ${t.text}; stroke-width: ${chunk7ZEDTSU3_cjs.STROKE_WIDTH.normal}; stroke-linecap: round; }
.schematex-phylo-branch-connector { fill: none; stroke: ${t.text}; stroke-width: ${chunk7ZEDTSU3_cjs.STROKE_WIDTH.normal}; }
.schematex-phylo-dendro-axis line { stroke: ${t.text}; stroke-width: ${chunk7ZEDTSU3_cjs.STROKE_WIDTH.thin}; }
.schematex-phylo-dendro-axis text { font-size: 10px; fill: ${t.textMuted}; text-anchor: middle; }
.schematex-phylo-dendro-cut { stroke: ${t.supportBad}; stroke-width: ${chunk7ZEDTSU3_cjs.STROKE_WIDTH.normal}; stroke-dasharray: 5 4; fill: none; }
.schematex-phylo-dendro-cut-label { font-size: 10px; fill: ${t.supportBad}; text-anchor: start; }
${cutColors.join("\n")}
.schematex-phylo-tip-label { font-size: ${chunk7ZEDTSU3_cjs.FONT_SIZE.label}px; fill: ${t.text}; dominant-baseline: central; }
.schematex-phylo-tip-label-italic { font-style: italic; }
.schematex-phylo-support-label { font-size: ${chunk7ZEDTSU3_cjs.FONT_SIZE.small}px; fill: ${t.textMuted}; text-anchor: middle; dominant-baseline: auto; }
.schematex-phylo-support-dot { stroke: none; }
.schematex-phylo-scale-bar line { stroke: ${t.text}; stroke-width: ${chunk7ZEDTSU3_cjs.STROKE_WIDTH.normal}; }
.schematex-phylo-scale-bar text { font-size: 10px; fill: ${t.text}; text-anchor: middle; }
.schematex-phylo-scale-tick { stroke: ${t.text}; stroke-width: ${chunk7ZEDTSU3_cjs.STROKE_WIDTH.thin}; }
.schematex-phylo-title { font-size: ${chunk7ZEDTSU3_cjs.FONT_SIZE.title}px; font-weight: bold; fill: ${t.text}; text-anchor: middle; }
.schematex-phylo-clade-label { font-size: 13px; font-weight: bold; }
.schematex-phylo-root-marker { fill: none; stroke: ${t.text}; stroke-width: ${chunk7ZEDTSU3_cjs.STROKE_WIDTH.normal}; }
${cladeColors.join("\n")}
`.trim();
}
function computeScaleBar(scale, plotWidth) {
  if (scale <= 0) return { length: 0.1, label: "0.1", pxLength: 50 };
  const targetPx = plotWidth * 0.2;
  const magnitudes = [1e-3, 2e-3, 5e-3, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];
  let best = magnitudes[0];
  let bestDiff = Infinity;
  for (const m of magnitudes) {
    const diff = Math.abs(m * scale - targetPx);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = m;
    }
  }
  return {
    length: best,
    label: best < 0.01 ? best.toExponential() : String(best),
    pxLength: best * scale
  };
}
function renderScaleBar(layout, t, scaleLabel) {
  if (layout.ast.mode === "cladogram") return "";
  const plotWidth = layout.width - 40;
  const bar = computeScaleBar(layout.scale, plotWidth);
  if (bar.pxLength < 5) return "";
  const x = 20;
  const y = layout.height - 20;
  const elements = [
    chunk7ZEDTSU3_cjs.line({ x1: x, y1: y, x2: x + bar.pxLength, y2: y, class: "schematex-phylo-scale-bar" }),
    chunk7ZEDTSU3_cjs.line({ x1: x, y1: y - 4, x2: x, y2: y + 4, class: "schematex-phylo-scale-tick" }),
    chunk7ZEDTSU3_cjs.line({ x1: x + bar.pxLength, y1: y - 4, x2: x + bar.pxLength, y2: y + 4, class: "schematex-phylo-scale-tick" }),
    chunk7ZEDTSU3_cjs.text({ x: x + bar.pxLength / 2, y: y + 16, "text-anchor": "middle", class: "schematex-phylo-scale-bar" }, bar.label)
  ];
  if (scaleLabel) {
    elements.push(
      chunk7ZEDTSU3_cjs.text(
        { x: x + bar.pxLength / 2, y: y + 28, "text-anchor": "middle", "font-size": "9", fill: t.textMuted },
        scaleLabel
      )
    );
  }
  return chunk7ZEDTSU3_cjs.group({ class: "schematex-phylo-scale-bar" }, elements);
}
function renderCladeBackgrounds(layout, t) {
  const elements = [];
  for (let ci = 0; ci < layout.ast.clades.length; ci++) {
    const clade = layout.ast.clades[ci];
    const hl = clade.highlight ?? "branch";
    if (hl === "branch") continue;
    const memberNodes = layout.nodes.filter(
      (n) => n.node.isLeaf && clade.members.includes(n.node.id)
    );
    if (memberNodes.length === 0) continue;
    const minY = Math.min(...memberNodes.map((n) => n.y)) - 10;
    const maxY = Math.max(...memberNodes.map((n) => n.y)) + 10;
    const minX = Math.min(...memberNodes.map((n) => n.x)) - 20;
    const maxX = Math.max(...memberNodes.map((n) => {
      const labelW = (n.node.label ?? n.node.id).length * 7.2 + TIP_LABEL_GAP + 8;
      return n.x + labelW;
    }));
    const color = clade.color ?? t.cladeColors[ci % t.cladeColors.length];
    elements.push(
      chunk7ZEDTSU3_cjs.rect({
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        rx: 4,
        class: `schematex-phylo-clade-bg schematex-phylo-clade-bg-${clade.id}`,
        fill: color,
        "fill-opacity": 0.12
      })
    );
    if (clade.label) {
      elements.push(
        chunk7ZEDTSU3_cjs.text(
          {
            x: maxX + 4,
            y: (minY + maxY) / 2,
            class: `schematex-phylo-clade-label schematex-phylo-clade-label-${clade.id}`,
            fill: color,
            "font-weight": "bold",
            "font-size": "13",
            "dominant-baseline": "central"
          },
          clade.label
        )
      );
    }
  }
  return elements;
}
function niceStep(maxHeight, targetTicks) {
  if (maxHeight <= 0) return 1;
  const rough = maxHeight / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  let step;
  if (norm < 1.5) step = 1;
  else if (norm < 3) step = 2;
  else if (norm < 7) step = 5;
  else step = 10;
  return step * mag;
}
function formatTick(value) {
  if (value === 0) return "0";
  if (Math.abs(value) < 0.01) return value.toExponential(0);
  return String(Math.round(value * 1e3) / 1e3);
}
function renderDendrogramAxis(layout, t) {
  const d = layout.dendrogram;
  if (!d) return "";
  const axisY = layout.height - 28;
  const elements = [];
  elements.push(
    chunk7ZEDTSU3_cjs.line({ x1: d.plotLeftX, y1: axisY, x2: d.baselineX, y2: axisY })
  );
  const step = niceStep(d.maxHeight, 5);
  for (let h = 0; h <= d.maxHeight + step * 1e-3; h += step) {
    const x = d.baselineX - h * d.scale;
    elements.push(chunk7ZEDTSU3_cjs.line({ x1: x, y1: axisY, x2: x, y2: axisY + 4 }));
    elements.push(
      chunk7ZEDTSU3_cjs.text({ x, y: axisY + 16, "text-anchor": "middle" }, formatTick(h))
    );
  }
  if (layout.ast.scaleLabel) {
    elements.push(
      chunk7ZEDTSU3_cjs.text(
        {
          x: (d.plotLeftX + d.baselineX) / 2,
          y: axisY + 28,
          "text-anchor": "middle",
          "font-size": "9",
          fill: t.textMuted
        },
        layout.ast.scaleLabel
      )
    );
  }
  return chunk7ZEDTSU3_cjs.group({ class: "schematex-phylo-dendro-axis" }, elements);
}
function renderCutLine(layout) {
  const d = layout.dendrogram;
  if (!d || d.cut === void 0) return "";
  const x = d.baselineX - d.cut * d.scale;
  const topY = 8;
  const bottomY = layout.height - 32;
  return chunk7ZEDTSU3_cjs.group({}, [
    chunk7ZEDTSU3_cjs.line({
      x1: x,
      y1: topY,
      x2: x,
      y2: bottomY,
      class: "schematex-phylo-dendro-cut"
    }),
    chunk7ZEDTSU3_cjs.text(
      { x: x + 4, y: topY + 4, class: "schematex-phylo-dendro-cut-label" },
      `cut = ${formatTick(d.cut)}`
    )
  ]);
}
function renderPhylo(layout) {
  const { ast, nodes, branches } = layout;
  const t = chunk7ZEDTSU3_cjs.resolveBiologyTheme(ast.metadata?.theme ?? "default");
  const css = buildCSS(ast, t);
  const titleOffset = ast.title ? 30 : 0;
  const totalHeight = layout.height + titleOffset;
  const totalWidth = layout.width;
  const branchElements = [];
  const nodeElements = [];
  const labelElements = [];
  for (const branch of branches) {
    const cladeIdx = branch.cladeId ? ast.clades.findIndex((c) => c.id === branch.cladeId) : -1;
    const cladeColor = cladeIdx >= 0 ? ast.clades[cladeIdx].color ?? t.cladeColors[cladeIdx % t.cladeColors.length] : void 0;
    const cls = branch.isConnector ? "schematex-phylo-branch schematex-phylo-branch-connector" : `schematex-phylo-branch schematex-phylo-branch-internal${branch.cladeId ? ` schematex-phylo-clade-${branch.cladeId}` : ""}`;
    const attrs = {
      d: branch.path,
      class: cls
    };
    if (cladeColor && !branch.isConnector) {
      attrs.stroke = cladeColor;
    }
    branchElements.push(chunk7ZEDTSU3_cjs.path(attrs));
  }
  const rootLayout = nodes.find((n) => n.node === ast.root);
  if (rootLayout && !ast.unrooted) {
    nodeElements.push(
      chunk7ZEDTSU3_cjs.circle({
        cx: rootLayout.x,
        cy: rootLayout.y,
        r: 5,
        class: "schematex-phylo-root-marker"
      })
    );
  }
  for (const layoutNode of nodes) {
    const { node, x, y } = layoutNode;
    if (!node.isLeaf && node.support !== void 0) {
      const support = node.support > 1 ? node.support : node.support * 100;
      if (support >= SUPPORT_THRESHOLD) {
        const color = getSupportColor(support, t);
        nodeElements.push(
          chunk7ZEDTSU3_cjs.circle({
            cx: x,
            cy: y,
            r: 4,
            class: "schematex-phylo-support-dot",
            fill: color
          })
        );
        labelElements.push(
          chunk7ZEDTSU3_cjs.text(
            { x, y: y - 8, class: "schematex-phylo-support-label" },
            String(Math.round(support))
          )
        );
      }
    }
    if (node.isLeaf) {
      const label = node.label ?? node.id;
      const italic = isSpeciesBinomial(label);
      const cls = `schematex-phylo-tip-label${italic ? " schematex-phylo-tip-label-italic" : ""}`;
      labelElements.push(
        chunk7ZEDTSU3_cjs.text(
          {
            x: x + TIP_LABEL_GAP,
            y,
            class: cls,
            "font-style": italic ? "italic" : void 0,
            "data-taxon-id": node.id
          },
          label
        )
      );
    }
  }
  const cladeBgElements = renderCladeBackgrounds(layout, t);
  const isDendro = layout.dendrogram !== void 0;
  const scaleBarEl = isDendro ? "" : renderScaleBar(layout, t, ast.scaleLabel);
  const dendroAxisEl = isDendro ? renderDendrogramAxis(layout, t) : "";
  const cutLineEl = isDendro ? renderCutLine(layout) : "";
  const titleEl = ast.title ? chunk7ZEDTSU3_cjs.text(
    { x: totalWidth / 2, y: 20, class: "schematex-phylo-title" },
    ast.title
  ) : "";
  const leafCount = nodes.filter((n) => n.node.isLeaf).length;
  const isDendrogramMode = layout.dendrogram !== void 0;
  const descMode = isDendrogramMode ? "dendrogram" : ast.mode;
  const descTitle = isDendrogramMode ? "Dendrogram" : "Phylogenetic Tree";
  const cutSuffix = isDendrogramMode && layout.dendrogram?.cut !== void 0 ? `, cut at ${layout.dendrogram.cut} into ${layout.dendrogram.clusterCount} clusters` : "";
  const svgContent = [
    chunk7ZEDTSU3_cjs.title(`${descTitle}${ast.title ? `: ${ast.title}` : ""}`),
    chunk7ZEDTSU3_cjs.desc(
      `${isDendrogramMode ? "Dendrogram" : "Phylogenetic tree"} with ${leafCount} taxa, ${descMode} mode, ${ast.layout} layout${cutSuffix}`
    ),
    chunk7ZEDTSU3_cjs.el("style", {}, css)
  ];
  if (titleEl) svgContent.push(titleEl);
  const transformY = titleOffset;
  if (cladeBgElements.length > 0) {
    svgContent.push(
      chunk7ZEDTSU3_cjs.group(
        { class: "schematex-phylo-clade-highlights", transform: transformY ? `translate(0,${transformY})` : void 0 },
        cladeBgElements
      )
    );
  }
  svgContent.push(
    chunk7ZEDTSU3_cjs.group(
      { class: "schematex-phylo-branches", transform: transformY ? `translate(0,${transformY})` : void 0 },
      branchElements
    )
  );
  svgContent.push(
    chunk7ZEDTSU3_cjs.group(
      { class: "schematex-phylo-nodes", transform: transformY ? `translate(0,${transformY})` : void 0 },
      nodeElements
    )
  );
  svgContent.push(
    chunk7ZEDTSU3_cjs.group(
      { class: "schematex-phylo-labels", transform: transformY ? `translate(0,${transformY})` : void 0 },
      labelElements
    )
  );
  if (scaleBarEl) {
    svgContent.push(
      chunk7ZEDTSU3_cjs.group(
        { transform: transformY ? `translate(0,${transformY})` : void 0 },
        [scaleBarEl]
      )
    );
  }
  if (dendroAxisEl) {
    svgContent.push(
      chunk7ZEDTSU3_cjs.group(
        { transform: transformY ? `translate(0,${transformY})` : void 0 },
        [dendroAxisEl]
      )
    );
  }
  if (cutLineEl) {
    svgContent.push(
      chunk7ZEDTSU3_cjs.group(
        { transform: transformY ? `translate(0,${transformY})` : void 0 },
        [cutLineEl]
      )
    );
  }
  return chunk7ZEDTSU3_cjs.svgRoot(
    {
      class: "schematex-diagram schematex-phylo",
      viewBox: `0 0 ${totalWidth} ${totalHeight}`,
      width: totalWidth,
      height: totalHeight
    },
    svgContent
  );
}

// src/diagrams/phylo/index.ts
var phylo = {
  type: "phylo",
  detect(text2) {
    const firstLine = text2.trim().split("\n")[0]?.trim().toLowerCase() ?? "";
    return firstLine === "phylo" || firstLine.startsWith("phylo ");
  },
  parse: parsePhylo,
  render(text2) {
    const ast = parsePhylo(text2);
    const layout = layoutPhylo(ast);
    return renderPhylo(layout);
  }
};

exports.PhyloParseError = PhyloParseError;
exports.layoutPhylo = layoutPhylo;
exports.parsePhylo = parsePhylo;
exports.phylo = phylo;
exports.renderPhylo = renderPhylo;
//# sourceMappingURL=chunk-ICLXRCSE.cjs.map
//# sourceMappingURL=chunk-ICLXRCSE.cjs.map