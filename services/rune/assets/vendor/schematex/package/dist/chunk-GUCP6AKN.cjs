'use strict';

var chunkNTS45SH6_cjs = require('./chunk-NTS45SH6.cjs');
var chunkVGO4AJ4K_cjs = require('./chunk-VGO4AJ4K.cjs');
var chunkEQMWWNB3_cjs = require('./chunk-EQMWWNB3.cjs');
var chunk54Q7JDQB_cjs = require('./chunk-54Q7JDQB.cjs');
var chunk7ZEDTSU3_cjs = require('./chunk-7ZEDTSU3.cjs');

// src/diagrams/flowchart/parser.ts
var FlowchartParseError = class extends Error {
  constructor(message, line2, column, source) {
    super(`[line ${line2}:${column}] ${message}`);
    this.line = line2;
    this.column = column;
    this.source = source;
    this.name = "FlowchartParseError";
  }
  line;
  column;
  source;
};
var DIRECTIONS = /* @__PURE__ */ new Set(["TB", "TD", "BT", "LR", "RL"]);
function unquoteLabel(s2) {
  const t = s2.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) {
    return t.slice(1, -1).replace(/\\([\\"])/g, "$1");
  }
  return t;
}
function labelToken(line2, start, end) {
  let tokenStart = start;
  let tokenEnd = end;
  while (tokenStart < tokenEnd && /\s/.test(line2[tokenStart])) tokenStart++;
  while (tokenEnd > tokenStart && /\s/.test(line2[tokenEnd - 1])) tokenEnd--;
  return {
    label: unquoteLabel(line2.slice(tokenStart, tokenEnd)),
    start: tokenStart,
    end: tokenEnd
  };
}
function findCloser(line2, start, closer) {
  let inQuote = false;
  for (let i = start; i <= line2.length - closer.length; i++) {
    const ch = line2[i];
    if (ch === '"' && (i === 0 || line2[i - 1] !== "\\")) {
      inQuote = !inQuote;
      continue;
    }
    if (!inQuote && line2.startsWith(closer, i)) return i;
  }
  return -1;
}
function shapeResult(line2, labelStart, labelEnd, shape, end) {
  const token = labelToken(line2, labelStart, labelEnd);
  return { shape, label: token.label, labelStart: token.start, labelEnd: token.end, end };
}
function parseShapeSuffix(line2, pos) {
  const ch = line2[pos];
  if (ch === void 0) return null;
  if (ch === ">") {
    const end = findCloser(line2, pos + 1, "]");
    if (end < 0) return null;
    return shapeResult(line2, pos + 1, end, "asymmetric", end + 1);
  }
  if (ch === "(" && line2[pos + 1] === "(" && line2[pos + 2] === "(") {
    const end = findCloser(line2, pos + 3, ")))");
    if (end < 0) return null;
    return shapeResult(line2, pos + 3, end, "double-circle", end + 3);
  }
  if (ch === "(" && line2[pos + 1] === "[") {
    const end = findCloser(line2, pos + 2, "])");
    if (end < 0) return null;
    return shapeResult(line2, pos + 2, end, "stadium", end + 2);
  }
  if (ch === "(" && line2[pos + 1] === "(") {
    const end = findCloser(line2, pos + 2, "))");
    if (end < 0) return null;
    return shapeResult(line2, pos + 2, end, "circle", end + 2);
  }
  if (ch === "[" && line2[pos + 1] === "[") {
    const end = findCloser(line2, pos + 2, "]]");
    if (end < 0) return null;
    return shapeResult(line2, pos + 2, end, "subroutine", end + 2);
  }
  if (ch === "[" && line2[pos + 1] === "(") {
    const end = findCloser(line2, pos + 2, ")]");
    if (end < 0) return null;
    return shapeResult(line2, pos + 2, end, "cylinder", end + 2);
  }
  if (ch === "{" && line2[pos + 1] === "{") {
    const end = findCloser(line2, pos + 2, "}}");
    if (end < 0) return null;
    return shapeResult(line2, pos + 2, end, "hexagon", end + 2);
  }
  if (ch === "[" && line2[pos + 1] === "/") {
    const endSlash = findCloser(line2, pos + 2, "\\]");
    if (endSlash >= 0) {
      return shapeResult(line2, pos + 2, endSlash, "trapezoid", endSlash + 2);
    }
    const end = findCloser(line2, pos + 2, "/]");
    if (end < 0) return null;
    return shapeResult(line2, pos + 2, end, "parallelogram", end + 2);
  }
  if (ch === "[" && line2[pos + 1] === "\\") {
    const endFwd = findCloser(line2, pos + 2, "/]");
    if (endFwd >= 0) {
      return shapeResult(line2, pos + 2, endFwd, "trapezoid-alt", endFwd + 2);
    }
    const end = findCloser(line2, pos + 2, "\\]");
    if (end < 0) return null;
    return shapeResult(line2, pos + 2, end, "parallelogram-alt", end + 2);
  }
  if (ch === "[") {
    const end = findCloser(line2, pos + 1, "]");
    if (end < 0) return null;
    return shapeResult(line2, pos + 1, end, "rect", end + 1);
  }
  if (ch === "(") {
    const end = findCloser(line2, pos + 1, ")");
    if (end < 0) return null;
    return shapeResult(line2, pos + 1, end, "round", end + 1);
  }
  if (ch === "{") {
    const end = findCloser(line2, pos + 1, "}");
    if (end < 0) return null;
    return shapeResult(line2, pos + 1, end, "diamond", end + 1);
  }
  return null;
}
var ID_CHAR = /[A-Za-z0-9_-]/;
function captureRange(full, captured, absoluteStart) {
  if (!captured) return void 0;
  const capturedAt = full.indexOf(captured);
  if (capturedAt < 0) return void 0;
  const token = labelToken(full, capturedAt, capturedAt + captured.length);
  return { start: absoluteStart + token.start, end: absoluteStart + token.end };
}
function parseEdgeOp(line2, pos) {
  while (pos < line2.length && line2[pos] === " ") pos++;
  const rest = line2.slice(pos);
  const bi = rest.startsWith("<");
  const i = bi ? 1 : 0;
  if (rest[i] === "=") {
    const m = /^(=+)(?:([^=<>]*)(=+))?(>)?/.exec(rest.slice(i));
    if (!m) return null;
    const full = m[0];
    const inlineLabel = m[2]?.trim();
    const hasArrow = m[4] === ">";
    return {
      kind: "thick",
      bidirectional: bi && hasArrow,
      end: pos + i + full.length,
      inlineLabel: inlineLabel && inlineLabel.length > 0 ? inlineLabel : void 0,
      inlineLabelRange: inlineLabel ? captureRange(full, m[2], pos + i) : void 0
    };
  }
  if (rest[i] === "-") {
    const dm = /^-\.+/.exec(rest.slice(i));
    if (dm) {
      const mWithLabel = /^(-\.+)([^.\-<>]+)(\.+->|\.+-)/.exec(rest.slice(i));
      if (mWithLabel) {
        const full = mWithLabel[0];
        const label = mWithLabel[2]?.trim();
        const hasArrow = mWithLabel[3].endsWith(">");
        return {
          kind: "dotted",
          bidirectional: bi && hasArrow,
          end: pos + i + full.length,
          inlineLabel: label && label.length > 0 ? label : void 0,
          inlineLabelRange: label ? captureRange(full, mWithLabel[2], pos + i) : void 0
        };
      }
      const mPlain2 = /^(-\.+)(->|-)?/.exec(rest.slice(i));
      if (mPlain2) {
        const full = mPlain2[0];
        const hasArrow = mPlain2[2] === "->";
        return { kind: "dotted", bidirectional: bi && hasArrow, end: pos + i + full.length };
      }
      return null;
    }
    const mLabeled = /^(-{2,})([^-<>|=][^-<>|=]*?)(-{2,})(>|x|o)?/.exec(rest.slice(i));
    if (mLabeled) {
      const full = mLabeled[0];
      const label = mLabeled[2]?.trim();
      const endCh = mLabeled[4];
      const kind = endCh === "x" ? "crossed" : endCh === "o" ? "round-end" : endCh === ">" ? "solid" : "none";
      return {
        kind,
        bidirectional: bi && endCh === ">",
        end: pos + i + full.length,
        inlineLabel: label && label.length > 0 ? label : void 0,
        inlineLabelRange: label ? captureRange(full, mLabeled[2], pos + i) : void 0
      };
    }
    const mPlain = /^(-{2,})(>|x|o)?/.exec(rest.slice(i));
    if (mPlain) {
      const full = mPlain[0];
      const endCh = mPlain[2];
      const kind = endCh === "x" ? "crossed" : endCh === "o" ? "round-end" : endCh === ">" ? "solid" : "none";
      return { kind, bidirectional: bi && endCh === ">", end: pos + i + full.length };
    }
  }
  return null;
}
function parseNodeRef(line2, pos) {
  let i = pos;
  while (i < line2.length && ID_CHAR.test(line2[i])) i++;
  if (i === pos) return null;
  const id = line2.slice(pos, i);
  const shape = parseShapeSuffix(line2, i);
  if (shape) {
    return {
      ref: {
        id,
        shape: shape.shape,
        label: shape.label,
        labelRange: { start: shape.labelStart, end: shape.labelEnd }
      },
      end: shape.end
    };
  }
  return { ref: { id }, end: i };
}
function parsePipeLabel(line2, pos) {
  if (line2[pos] !== "|") return null;
  const end = findCloser(line2, pos + 1, "|");
  if (end < 0) return null;
  const token = labelToken(line2, pos + 1, end);
  return {
    label: token.label,
    labelRange: { start: token.start, end: token.end },
    end: end + 1
  };
}
function skipSpaces(line2, pos) {
  while (pos < line2.length && (line2[pos] === " " || line2[pos] === "	")) pos++;
  return pos;
}
function registerNode(ref, nodes, lineStart, locate) {
  if (ref.shape && ref.label !== void 0) {
    nodes.push({
      id: ref.id,
      shape: ref.shape,
      label: ref.label,
      labelSourceRange: ref.labelRange ? locate(lineStart + ref.labelRange.start, lineStart + ref.labelRange.end) : void 0
    });
  } else {
    nodes.push({ id: ref.id, shape: "rect", label: ref.id });
  }
}
function parseNodeGroup(line2, startPos, lineNo, nodes, lineStart, locate) {
  let pos = skipSpaces(line2, startPos);
  const first = parseNodeRef(line2, pos);
  if (!first) {
    throw new FlowchartParseError(
      `expected node identifier, got ${JSON.stringify(line2.slice(pos, pos + 10))}`,
      lineNo,
      pos + 1
    );
  }
  registerNode(first.ref, nodes, lineStart, locate);
  const refs = [first.ref];
  pos = first.end;
  while (true) {
    const p2 = skipSpaces(line2, pos);
    if (line2[p2] !== "&") break;
    const p3 = skipSpaces(line2, p2 + 1);
    const next = parseNodeRef(line2, p3);
    if (!next) break;
    registerNode(next.ref, nodes, lineStart, locate);
    refs.push(next.ref);
    pos = next.end;
  }
  return { refs, end: pos };
}
function parseChainStatement(line2, lineNo, lineStart, locate) {
  const nodes = [];
  const edges = [];
  let pos = skipSpaces(line2, 0);
  const firstGroup = parseNodeGroup(line2, pos, lineNo, nodes, lineStart, locate);
  let prevGroup = firstGroup.refs;
  pos = firstGroup.end;
  while (pos < line2.length) {
    pos = skipSpaces(line2, pos);
    if (pos >= line2.length) break;
    const op = parseEdgeOp(line2, pos);
    if (!op) {
      const tail = line2.slice(pos).trim();
      if (tail.length > 0) {
        throw new FlowchartParseError(
          `expected edge operator, got ${JSON.stringify(tail.slice(0, 10))}`,
          lineNo,
          pos + 1
        );
      }
      break;
    }
    pos = op.end;
    pos = skipSpaces(line2, pos);
    let label = op.inlineLabel;
    let labelRange = op.inlineLabelRange;
    const pipe = parsePipeLabel(line2, pos);
    if (pipe) {
      label = pipe.label;
      labelRange = pipe.labelRange;
      pos = pipe.end;
    }
    pos = skipSpaces(line2, pos);
    const targetGroup = parseNodeGroup(line2, pos, lineNo, nodes, lineStart, locate);
    pos = targetGroup.end;
    for (const from of prevGroup) {
      for (const to of targetGroup.refs) {
        edges.push({
          from: from.id,
          to: to.id,
          kind: op.kind,
          label,
          labelSourceRange: labelRange ? locate(lineStart + labelRange.start, lineStart + labelRange.end) : void 0,
          bidirectional: op.bidirectional
        });
      }
    }
    prevGroup = targetGroup.refs;
  }
  return { nodes, edges };
}
function parseSubgraphHeader(rest, idx) {
  const defaultId = `sg_${idx}`;
  const s2 = rest.trim();
  if (!s2) return { id: defaultId, label: defaultId, children: [], subgraphs: [] };
  const idBracket = /^(\w[\w-]*)\s+\[([^\]]*)\]$/.exec(s2);
  if (idBracket) return { id: idBracket[1], label: idBracket[2], children: [], subgraphs: [] };
  const idQuoted = /^(\w[\w-]*)\s+"([^"]*)"$/.exec(s2);
  if (idQuoted) return { id: idQuoted[1], label: idQuoted[2], children: [], subgraphs: [] };
  const quotedOnly = /^"([^"]*)"$/.exec(s2);
  if (quotedOnly) return { id: defaultId, label: quotedOnly[1], children: [], subgraphs: [] };
  const plainId = s2.split(/\s/)[0];
  return { id: plainId, label: plainId, children: [], subgraphs: [] };
}
function normalizeDirection(dir) {
  const up = dir.toUpperCase();
  if (up === "TD") return "TB";
  if (up === "TB" || up === "BT" || up === "LR" || up === "RL") return up;
  return "TB";
}
function parseCssProps(s2) {
  const props = {};
  for (const part of s2.split(",")) {
    const colon = part.indexOf(":");
    if (colon < 0) continue;
    const key = part.slice(0, colon).trim();
    const val = part.slice(colon + 1).trim();
    if (key) props[key] = val;
  }
  return props;
}
function extractInlineClasses(line2) {
  const pairs = [];
  let out = line2;
  const re = /:::([A-Za-z_][\w-]*)/g;
  let m;
  const hits = [];
  while ((m = re.exec(out)) !== null) {
    hits.push({ start: m.index, end: m.index + m[0].length, name: m[1] });
  }
  if (hits.length === 0) return { stripped: line2, pairs };
  for (let h = hits.length - 1; h >= 0; h--) {
    const hit = hits[h];
    const before = out.slice(0, hit.start);
    let cursor = before.length;
    const lastCh = before[cursor - 1];
    if (lastCh === "]" || lastCh === ")" || lastCh === "}") {
      const closer = lastCh;
      const opener = closer === "]" ? "[" : closer === ")" ? "(" : "{";
      let depth = 0;
      let i = cursor - 1;
      for (; i >= 0; i--) {
        if (before[i] === closer) depth++;
        else if (before[i] === opener) {
          depth--;
          if (depth === 0) break;
        }
      }
      if (i >= 0) cursor = i;
    }
    const idEnd = cursor;
    let idStart = idEnd;
    while (idStart > 0 && /[A-Za-z0-9_-]/.test(before[idStart - 1])) idStart--;
    if (idStart === idEnd) {
      continue;
    }
    const id = before.slice(idStart, idEnd);
    pairs.push({ id, className: hit.name });
    out = out.slice(0, hit.start) + " ".repeat(hit.end - hit.start) + out.slice(hit.end);
  }
  return { stripped: out, pairs };
}
function parseFlowchart(source) {
  const lines = source.split(/\r?\n/);
  const lineStarts = [];
  let lineCursor = 0;
  for (const line2 of lines) {
    lineStarts.push(lineCursor);
    lineCursor += line2.length;
    if (source.slice(lineCursor, lineCursor + 2) === "\r\n") lineCursor += 2;
    else if (source[lineCursor] === "\n") lineCursor += 1;
  }
  const locator = chunk54Q7JDQB_cjs.createSourceLocator(source);
  const ast = {
    type: "flowchart",
    direction: "TB",
    nodes: [],
    edges: [],
    subgraphs: [],
    classDefs: [],
    linkStyles: /* @__PURE__ */ new Map()
  };
  const nodeMap = /* @__PURE__ */ new Map();
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.length === 0 || t.startsWith("%%")) continue;
    headerIdx = i;
    break;
  }
  if (headerIdx < 0) throw new FlowchartParseError("empty flowchart source", 1, 1);
  const header = lines[headerIdx].trim();
  const headerMatch = /^(flowchart|graph)(?:\s+(\w+))?(?:\s+(.*))?$/i.exec(header);
  if (!headerMatch) {
    throw new FlowchartParseError(
      `expected 'flowchart' or 'graph' header, got ${JSON.stringify(header)}`,
      headerIdx + 1,
      1
    );
  }
  const dirTok = headerMatch[2];
  if (dirTok) {
    if (!DIRECTIONS.has(dirTok.toUpperCase())) {
      throw new FlowchartParseError(`unknown direction ${JSON.stringify(dirTok)}`, headerIdx + 1, 1);
    }
    ast.direction = normalizeDirection(dirTok);
  }
  const extra = headerMatch[3]?.trim();
  if (extra) {
    const mQuoted = /^"([^"]*)"$/.exec(extra);
    ast.title = mQuoted ? mQuoted[1] : extra;
    const rawHeader = lines[headerIdx];
    const tokenStart = rawHeader.lastIndexOf(extra);
    if (tokenStart >= 0) {
      ast.titleSourceRange = locator.range(
        lineStarts[headerIdx] + tokenStart,
        lineStarts[headerIdx] + tokenStart + extra.length
      );
    }
  }
  const subgraphStack = [];
  const pendingInlineClasses = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const rawOriginal = lines[i];
    const originalTrimmed = rawOriginal.trim();
    if (originalTrimmed.length === 0 || originalTrimmed.startsWith("%%")) {
      continue;
    }
    const { stripped, pairs } = extractInlineClasses(rawOriginal);
    for (const p of pairs) pendingInlineClasses.push(p);
    const raw = stripped;
    const trimmed = raw.trim();
    if (trimmed.length === 0) continue;
    const sgMatch = /^subgraph(?:\s+(.*))?$/.exec(trimmed);
    if (sgMatch) {
      const sg = parseSubgraphHeader(sgMatch[1] ?? "", ast.subgraphs.length);
      let finalId = sg.id;
      let collision = 0;
      while (ast.subgraphs.some((s2) => s2.id === finalId)) {
        finalId = `${sg.id}_${++collision}`;
      }
      sg.id = finalId;
      ast.subgraphs.push(sg);
      if (subgraphStack.length > 0) {
        const parent = subgraphStack[subgraphStack.length - 1];
        if (!parent.subgraphs.includes(sg.id)) parent.subgraphs.push(sg.id);
      }
      subgraphStack.push(sg);
      continue;
    }
    const dirMatch = /^direction\s+(TB|TD|BT|LR|RL)$/i.exec(trimmed);
    if (dirMatch && subgraphStack.length > 0) {
      subgraphStack[subgraphStack.length - 1].direction = normalizeDirection(dirMatch[1]);
      continue;
    }
    if (trimmed === "end" && subgraphStack.length > 0) {
      subgraphStack.pop();
      continue;
    }
    const iconMatch = /^icon\s+(\w[\w-]*)\s*:?\s+([\w-]+)\s*$/.exec(trimmed);
    if (iconMatch) {
      const nid = iconMatch[1];
      const iconName = iconMatch[2];
      const existing = nodeMap.get(nid);
      if (existing) {
        existing.icon = iconName;
      } else {
        const node = { id: nid, shape: "rect", label: nid, icon: iconName };
        nodeMap.set(nid, node);
        ast.nodes.push(node);
      }
      continue;
    }
    const classMatch = /^class\s+([\w,\s]+?)\s+(\w[\w-]*)\s*$/.exec(trimmed);
    if (classMatch) {
      const idList = classMatch[1].split(/[,\s]+/).map((s2) => s2.trim()).filter((s2) => s2.length > 0);
      const className = classMatch[2];
      for (const nid of idList) {
        const existing = nodeMap.get(nid);
        if (!existing) {
          const node = { id: nid, shape: "rect", label: nid, classes: [className] };
          nodeMap.set(nid, node);
          ast.nodes.push(node);
        } else {
          existing.classes = [...existing.classes ?? [], className];
        }
      }
      continue;
    }
    const classDefMatch = /^classDef\s+(\w[\w-]*)\s+(.+)$/.exec(trimmed);
    if (classDefMatch) {
      const cdef = {
        id: classDefMatch[1],
        props: parseCssProps(classDefMatch[2])
      };
      const existIdx = ast.classDefs.findIndex((c) => c.id === cdef.id);
      if (existIdx >= 0) ast.classDefs[existIdx] = cdef;
      else ast.classDefs.push(cdef);
      continue;
    }
    const styleMatch = /^style\s+(\w[\w-]*)\s+(.+)$/.exec(trimmed);
    if (styleMatch) {
      const nid = styleMatch[1];
      const props = parseCssProps(styleMatch[2]);
      const existing = nodeMap.get(nid);
      if (existing) {
        existing.style = { ...existing.style ?? {}, ...props };
      } else {
        const node = { id: nid, shape: "rect", label: nid, style: props };
        nodeMap.set(nid, node);
        ast.nodes.push(node);
      }
      continue;
    }
    const linkStyleMatch = /^linkStyle\s+([\d,\s]+|default)\s+(.+)$/.exec(trimmed);
    if (linkStyleMatch) {
      const sel = linkStyleMatch[1].trim();
      const props = parseCssProps(linkStyleMatch[2]);
      if (sel !== "default") {
        const indices = sel.split(/[,\s]+/).map((s2) => s2.trim()).filter((s2) => s2.length > 0).map((s2) => parseInt(s2, 10)).filter((n) => !isNaN(n));
        for (const idx of indices) {
          ast.linkStyles.set(idx, { ...ast.linkStyles.get(idx) ?? {}, ...props });
        }
      }
      continue;
    }
    let parsed;
    try {
      parsed = parseChainStatement(raw, i + 1, lineStarts[i], locator.range);
    } catch (e) {
      if (e instanceof FlowchartParseError) throw e;
      continue;
    }
    const currentSg = subgraphStack.length > 0 ? subgraphStack[subgraphStack.length - 1] : null;
    for (const ndef of parsed.nodes) {
      const existing = nodeMap.get(ndef.id);
      if (!existing) {
        const node = {
          id: ndef.id,
          shape: ndef.shape,
          label: ndef.label,
          labelSourceRange: ndef.labelSourceRange,
          parent: currentSg?.id
        };
        nodeMap.set(ndef.id, node);
        ast.nodes.push(node);
        if (currentSg && !currentSg.children.includes(ndef.id)) {
          currentSg.children.push(ndef.id);
        }
      } else {
        if (ndef.label !== ndef.id) {
          existing.label = ndef.label;
          existing.labelSourceRange = ndef.labelSourceRange;
        }
        if (ndef.shape !== "rect") existing.shape = ndef.shape;
        if (currentSg && !existing.parent) {
          existing.parent = currentSg.id;
          if (!currentSg.children.includes(existing.id)) currentSg.children.push(existing.id);
        }
      }
    }
    for (const e of parsed.edges) {
      const edge = {
        from: e.from,
        to: e.to,
        kind: e.kind,
        label: e.label,
        labelSourceRange: e.labelSourceRange,
        arrowEnd: e.kind === "solid" || e.kind === "thick" || e.kind === "dotted" || e.kind === "bidirectional" ? "arrow" : e.kind === "crossed" ? "cross" : e.kind === "round-end" ? "circle" : "none",
        arrowStart: e.bidirectional ? "arrow" : "none"
      };
      ast.edges.push(edge);
    }
  }
  for (const { id, className } of pendingInlineClasses) {
    const existing = nodeMap.get(id);
    if (!existing) continue;
    existing.classes = [...existing.classes ?? [], className];
  }
  return ast;
}

// src/core/layered/bk.ts
function bkXCoords(layers, segments, nodeSep) {
  if (layers.length === 0) return /* @__PURE__ */ new Map();
  const preds = /* @__PURE__ */ new Map();
  const succs = /* @__PURE__ */ new Map();
  const indexInLayer = /* @__PURE__ */ new Map();
  const nodeById = /* @__PURE__ */ new Map();
  for (const layer of layers) {
    for (let i = 0; i < layer.length; i++) {
      const n = layer[i];
      indexInLayer.set(n.id, i);
      nodeById.set(n.id, n);
      preds.set(n.id, []);
      succs.set(n.id, []);
    }
  }
  for (const [u, v] of segments) {
    if (!nodeById.has(u) || !nodeById.has(v)) continue;
    succs.get(u).push(v);
    preds.get(v).push(u);
  }
  const conflicts = findType1Conflicts(layers, preds, nodeById);
  const xss = {};
  for (const vertDir of ["u", "d"]) {
    const adjNeighbors = vertDir === "u" ? (v) => preds.get(v) ?? [] : (v) => succs.get(v) ?? [];
    const flippedV = vertDir === "u" ? layers : layers.slice().reverse();
    for (const horizDir of ["l", "r"]) {
      const flippedH = horizDir === "l" ? flippedV : flippedV.map((l) => l.slice().reverse());
      const { root, align } = verticalAlignment(
        flippedH,
        conflicts,
        adjNeighbors
      );
      let xs = horizontalCompaction(flippedH, root, align, nodeById, nodeSep);
      if (horizDir === "r") {
        const neg = /* @__PURE__ */ new Map();
        for (const [k, v] of xs) neg.set(k, -v);
        xs = neg;
      }
      xss[vertDir + horizDir] = xs;
    }
  }
  alignCoordinates(xss, findSmallestWidthAlignment(xss, nodeById));
  return balance(xss);
}
function findType1Conflicts(layers, preds, nodeById) {
  const conflicts = /* @__PURE__ */ new Set();
  if (layers.length < 2) return conflicts;
  for (let li = 1; li < layers.length; li++) {
    const prev = layers[li - 1];
    const layer = layers[li];
    const prevIdx = /* @__PURE__ */ new Map();
    prev.forEach((n, i) => prevIdx.set(n.id, i));
    let k0 = 0;
    let scanPos = 0;
    const lastIdx = layer.length - 1;
    for (let i1 = 0; i1 < layer.length; i1++) {
      const v = layer[i1];
      let w = null;
      if (v.isDummy) {
        for (const p of preds.get(v.id) ?? []) {
          if (nodeById.get(p)?.isDummy && prevIdx.has(p)) {
            w = p;
            break;
          }
        }
      }
      if (w !== null || i1 === lastIdx) {
        const k1 = w !== null ? prevIdx.get(w) : prev.length - 1;
        for (let i = scanPos; i <= i1; i++) {
          const vv = layer[i];
          for (const u of preds.get(vv.id) ?? []) {
            const uPos = prevIdx.get(u);
            if (uPos === void 0) continue;
            if (uPos < k0 || uPos > k1) {
              conflicts.add(conflictKey(u, vv.id));
            }
          }
        }
        scanPos = i1 + 1;
        k0 = k1;
      }
    }
  }
  return conflicts;
}
function conflictKey(a, b) {
  return a < b ? `${a}\0${b}` : `${b}\0${a}`;
}
function hasConflict(conflicts, a, b) {
  return conflicts.has(conflictKey(a, b));
}
function verticalAlignment(layers, conflicts, neighborsOf) {
  const root = /* @__PURE__ */ new Map();
  const align = /* @__PURE__ */ new Map();
  const pos = /* @__PURE__ */ new Map();
  for (const layer of layers) {
    for (let i = 0; i < layer.length; i++) {
      const v = layer[i].id;
      root.set(v, v);
      align.set(v, v);
      pos.set(v, i);
    }
  }
  for (const layer of layers) {
    let prevIdx = -1;
    for (const vn of layer) {
      const v = vn.id;
      const ws = neighborsOf(v).slice();
      if (ws.length === 0) continue;
      ws.sort((a, b) => (pos.get(a) ?? 0) - (pos.get(b) ?? 0));
      const mp = (ws.length - 1) / 2;
      const mids = [Math.floor(mp), Math.ceil(mp)];
      for (const mi of mids) {
        if (align.get(v) !== v) continue;
        const w = ws[mi];
        if (hasConflict(conflicts, w, v)) continue;
        const wPos = pos.get(w) ?? 0;
        if (wPos <= prevIdx) continue;
        align.set(w, v);
        root.set(v, root.get(w));
        align.set(v, root.get(v));
        prevIdx = wPos;
      }
    }
  }
  return { root, align };
}
function horizontalCompaction(layers, root, align, nodeById, nodeSep) {
  const xs = /* @__PURE__ */ new Map();
  const sink = /* @__PURE__ */ new Map();
  const shift = /* @__PURE__ */ new Map();
  for (const layer of layers) {
    for (const v of layer) {
      sink.set(v.id, v.id);
      shift.set(v.id, Number.POSITIVE_INFINITY);
    }
  }
  const indexInLayer = /* @__PURE__ */ new Map();
  const layerOf = /* @__PURE__ */ new Map();
  for (let li = 0; li < layers.length; li++) {
    for (let i = 0; i < layers[li].length; i++) {
      const id = layers[li][i].id;
      indexInLayer.set(id, i);
      layerOf.set(id, li);
    }
  }
  const sep = (uId, vId) => {
    const u = nodeById.get(uId);
    const v = nodeById.get(vId);
    return u.width / 2 + nodeSep + v.width / 2;
  };
  const placeBlock = (v) => {
    if (xs.has(v)) return;
    xs.set(v, 0);
    let w = v;
    do {
      const wi = indexInLayer.get(w);
      const wLayer = layerOf.get(w);
      if (wi > 0) {
        const pred = layers[wLayer][wi - 1].id;
        const u = root.get(pred);
        placeBlock(u);
        if (sink.get(v) === v) sink.set(v, sink.get(u));
        if (sink.get(v) !== sink.get(u)) {
          const candidate = xs.get(v) - xs.get(u) - sep(pred, w);
          const cur = shift.get(sink.get(u)) ?? Number.POSITIVE_INFINITY;
          shift.set(sink.get(u), Math.min(cur, candidate));
        } else {
          const candidate = xs.get(u) + sep(pred, w);
          if (candidate > xs.get(v)) xs.set(v, candidate);
        }
      }
      w = align.get(w);
    } while (w !== v);
  };
  for (const layer of layers) {
    for (const v of layer) {
      if (root.get(v.id) === v.id) placeBlock(v.id);
    }
  }
  const result = /* @__PURE__ */ new Map();
  for (const layer of layers) {
    for (const v of layer) {
      const r = root.get(v.id);
      const rx = xs.get(r) ?? 0;
      const s2 = shift.get(sink.get(r));
      const sx = s2 !== void 0 && s2 !== Number.POSITIVE_INFINITY ? s2 : 0;
      result.set(v.id, rx + sx);
    }
  }
  return result;
}
function findSmallestWidthAlignment(xss, nodeById, _nodeSep) {
  let best = null;
  let bestWidth = Number.POSITIVE_INFINITY;
  for (const key of Object.keys(xss)) {
    const xs = xss[key];
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    for (const [id, x] of xs) {
      const n = nodeById.get(id);
      if (!n) continue;
      minX = Math.min(minX, x - n.width / 2);
      maxX = Math.max(maxX, x + n.width / 2);
    }
    const w = maxX - minX;
    if (w < bestWidth) {
      bestWidth = w;
      best = xs;
    }
  }
  return best ?? /* @__PURE__ */ new Map();
}
function alignCoordinates(xss, ref) {
  let refMin = Number.POSITIVE_INFINITY;
  let refMax = Number.NEGATIVE_INFINITY;
  for (const [, v] of ref) {
    refMin = Math.min(refMin, v);
    refMax = Math.max(refMax, v);
  }
  for (const key of Object.keys(xss)) {
    const xs = xss[key];
    if (xs === ref) continue;
    let xMin = Number.POSITIVE_INFINITY;
    let xMax = Number.NEGATIVE_INFINITY;
    for (const [, v] of xs) {
      xMin = Math.min(xMin, v);
      xMax = Math.max(xMax, v);
    }
    const delta = key.endsWith("r") ? refMax - xMax : refMin - xMin;
    if (delta === 0) continue;
    for (const [k, v] of xs) xs.set(k, v + delta);
  }
}
function balance(xss) {
  const keys = Object.keys(xss);
  const result = /* @__PURE__ */ new Map();
  if (keys.length === 0) return result;
  const ids = /* @__PURE__ */ new Set();
  for (const k of keys) for (const id of xss[k].keys()) ids.add(id);
  for (const id of ids) {
    const vals = [];
    for (const k of keys) {
      const v = xss[k].get(id);
      if (v !== void 0) vals.push(v);
    }
    vals.sort((a, b) => a - b);
    const n = vals.length;
    if (n === 0) continue;
    if (n % 2 === 0) {
      result.set(id, (vals[n / 2 - 1] + vals[n / 2]) / 2);
    } else {
      result.set(id, vals[(n - 1) / 2]);
    }
  }
  return result;
}

// src/diagrams/flowchart/icons.ts
var ICON_SIZE = 22;
var ICON_GAP = 4;
var s = `class="sx-fc-icon" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"`;
var sf = `class="sx-fc-icon-fill"`;
function gearGlyph() {
  let teeth = "";
  for (let i = 0; i < 8; i++) {
    teeth += `<rect x="-1.8" y="-10.4" width="3.6" height="3.6" rx="0.6" transform="rotate(${i * 45})" ${sf}/>`;
  }
  return `<circle cx="0" cy="0" r="7" ${s}/>${teeth}<circle cx="0" cy="0" r="2.6" ${s}/>`;
}
var ICONS = {
  // ── core (original set) ──────────────────────────────────────
  server: () => `<rect x="-10" y="-9" width="20" height="7" rx="1.5" ${s}/><rect x="-10" y="2" width="20" height="7" rx="1.5" ${s}/><circle cx="-6" cy="-5.5" r="0.9" ${sf}/><circle cx="-6" cy="5.5" r="0.9" ${sf}/>`,
  database: () => `<ellipse cx="0" cy="-7" rx="9" ry="3.2" ${s}/><path d="M -9 -7 V 7 C -9 8.8 -5 10 0 10 C 5 10 9 8.8 9 7 V -7" ${s}/><path d="M -9 0 C -9 1.8 -5 3 0 3 C 5 3 9 1.8 9 0" ${s}/>`,
  user: () => `<circle cx="0" cy="-4" r="4" ${s}/><path d="M -8 10 C -8 3 8 3 8 10" ${s}/>`,
  cloud: () => `<path d="M -7 5 C -11 5 -11 -2 -6 -2 C -6 -8 5 -8 5 -2 C 10 -3 11 5 6 5 Z" ${s}/>`,
  gear: gearGlyph,
  document: () => `<path d="M -7 -10 H 3 L 7 -6 V 10 H -7 Z" ${s}/><path d="M 3 -10 V -6 H 7 M -4 0 H 4 M -4 4 H 4" ${s}/>`,
  globe: () => `<circle cx="0" cy="0" r="9" ${s}/><path d="M -9 0 H 9 M 0 -9 V 9 M 0 -9 C -5 -4 -5 4 0 9 C 5 4 5 -4 0 -9" ${s}/>`,
  lock: () => `<rect x="-7" y="-1" width="14" height="11" rx="1.5" ${s}/><path d="M -4 -1 V -4 C -4 -9 4 -9 4 -4 V -1" ${s}/>`,
  mail: () => `<rect x="-10" y="-7" width="20" height="14" rx="1.5" ${s}/><path d="M -10 -6 L 0 2 L 10 -6" ${s}/>`,
  clock: () => `<circle cx="0" cy="0" r="9" ${s}/><path d="M 0 -5 V 0 L 4 3" ${s}/>`,
  check: () => `<circle cx="0" cy="0" r="9" ${s}/><path d="M -4 0 L -1 3 L 5 -4" ${s}/>`,
  alert: () => `<path d="M 0 -9 L 10 8 H -10 Z" ${s}/><path d="M 0 -3 V 2" ${s}/><circle cx="0" cy="5" r="0.9" ${sf}/>`,
  process: () => `<rect x="-9" y="-7" width="18" height="14" rx="1.5" ${s}/><path d="M -5 -2 H 5 M -5 2 H 2" ${s}/>`,
  queue: () => `<rect x="-10" y="-6" width="6" height="12" rx="1" ${s}/><rect x="-2" y="-6" width="6" height="12" rx="1" ${s}/><rect x="6" y="-6" width="4" height="12" rx="1" ${s}/>`,
  // ── Tier 1 · general flow ────────────────────────────────────
  folder: () => `<path d="M -10 -6 H -3 L -1 -3 H 10 V 8 H -10 Z" ${s}/>`,
  file: () => `<path d="M -7 -10 H 3 L 7 -6 V 10 H -7 Z" ${s}/><path d="M 3 -10 V -6 H 7" ${s}/>`,
  search: () => `<circle cx="-2" cy="-2" r="6" ${s}/><path d="M 2.5 2.5 L 9 9" ${s}/>`,
  edit: () => `<path d="M -9 9 H -5 L 7 -3 L 3 -7 L -9 5 Z" ${s}/><path d="M 2 -6 L 6 -2" ${s}/>`,
  trash: () => `<path d="M -8 -5 H 8 M -6 -5 V 8 C -6 9 -5 9 -4 9 H 4 C 5 9 6 9 6 8 V -5 M -3 -5 V -8 H 3 V -5 M -2 -1 V 5 M 2 -1 V 5" ${s}/>`,
  add: () => `<circle cx="0" cy="0" r="9" ${s}/><path d="M -4 0 H 4 M 0 -4 V 4" ${s}/>`,
  sync: () => `<path d="M -8 -1 A 8 8 0 0 1 6 -5" ${s}/><path d="M 6 -5 L 7 -8 M 6 -5 L 3 -6" ${s}/><path d="M 8 1 A 8 8 0 0 1 -6 5" ${s}/><path d="M -6 5 L -7 8 M -6 5 L -3 6" ${s}/>`,
  upload: () => `<path d="M -8 6 V 9 H 8 V 6" ${s}/><path d="M 0 -9 V 3 M -4 -5 L 0 -9 L 4 -5" ${s}/>`,
  download: () => `<path d="M -8 6 V 9 H 8 V 6" ${s}/><path d="M 0 -9 V 3 M -4 -1 L 0 3 L 4 -1" ${s}/>`,
  link: () => `<path d="M -1 -4 L -5 0 A 4.2 4.2 0 0 0 1 6 L 3 4" ${s}/><path d="M 1 4 L 5 0 A 4.2 4.2 0 0 0 -1 -6 L -3 -4" ${s}/>`,
  calendar: () => `<rect x="-9" y="-7" width="18" height="15" rx="1.5" ${s}/><path d="M -9 -2 H 9 M -4 -10 V -4 M 4 -10 V -4" ${s}/>`,
  list: () => `<circle cx="-8" cy="-6" r="1.2" ${sf}/><circle cx="-8" cy="0" r="1.2" ${sf}/><circle cx="-8" cy="6" r="1.2" ${sf}/><path d="M -4 -6 H 9 M -4 0 H 9 M -4 6 H 9" ${s}/>`,
  filter: () => `<path d="M -9 -7 H 9 L 2 1 V 9 L -2 7 V 1 Z" ${s}/>`,
  flag: () => `<path d="M -7 -9 V 9 M -7 -9 H 7 L 4 -5 L 7 -1 H -7" ${s}/>`,
  star: () => `<path d="M 0 -9 L 2.6 -2.8 L 9 -2.4 L 4 1.8 L 5.6 8.4 L 0 5 L -5.6 8.4 L -4 1.8 L -9 -2.4 L -2.6 -2.8 Z" ${s}/>`,
  tag: () => `<path d="M 1 -8 H 9 V 0 L 0 9 L -9 0 L 1 -8 Z" ${s}/><circle cx="5.5" cy="-4.5" r="1.4" ${sf}/>`,
  info: () => `<circle cx="0" cy="0" r="9" ${s}/><circle cx="0" cy="-4" r="1" ${sf}/><path d="M 0 -1 V 5" ${s}/>`,
  question: () => `<circle cx="0" cy="0" r="9" ${s}/><path d="M -3 -3 A 3 3 0 1 1 1 1 V 3" ${s}/><circle cx="0.5" cy="6" r="1" ${sf}/>`,
  cancel: () => `<circle cx="0" cy="0" r="9" ${s}/><path d="M -4 -4 L 4 4 M 4 -4 L -4 4" ${s}/>`,
  play: () => `<circle cx="0" cy="0" r="9" ${s}/><path d="M -3 -5 L 5 0 L -3 5 Z" ${sf}/>`,
  stop: () => `<path d="M -3.5 -8 H 3.5 L 8 -3.5 V 3.5 L 3.5 8 H -3.5 L -8 3.5 V -3.5 Z" ${s}/>`,
  // ── Tier 2 · tech / architecture ─────────────────────────────
  code: () => `<path d="M -3 -7 L -9 0 L -3 7 M 3 -7 L 9 0 L 3 7" ${s}/>`,
  terminal: () => `<rect x="-10" y="-7" width="20" height="14" rx="1.5" ${s}/><path d="M -6 -2 L -2 1 L -6 4 M 0 4 H 5" ${s}/>`,
  container: () => `<path d="M 0 -9 L 9 -4 V 5 L 0 10 L -9 5 V -4 Z" ${s}/><path d="M -9 -4 L 0 1 L 9 -4 M 0 1 V 10" ${s}/>`,
  cache: () => `<rect x="-9" y="-7" width="18" height="14" rx="1.5" ${s}/><path d="M 1 -4 L -3 1 H 0 L -1 4 L 3 -1 H 0 Z" ${sf}/>`,
  shield: () => `<path d="M 0 -9 L 8 -6 V 1 C 8 7 0 10 0 10 C 0 10 -8 7 -8 1 V -6 Z" ${s}/><path d="M -3 -0.5 L -1 1.5 L 3.5 -3" ${s}/>`,
  key: () => `<circle cx="-4" cy="-4" r="4" ${s}/><path d="M -1 -1 L 7 7 M 4 4 L 7 1 M 7 7 L 4 10" ${s}/>`,
  browser: () => `<rect x="-10" y="-8" width="20" height="16" rx="1.5" ${s}/><path d="M -10 -3 H 10" ${s}/><circle cx="-7" cy="-5.5" r="0.9" ${sf}/><circle cx="-4" cy="-5.5" r="0.9" ${sf}/>`,
  mobile: () => `<rect x="-6" y="-9" width="12" height="18" rx="2" ${s}/><path d="M -2 6 H 2" ${s}/>`,
  desktop: () => `<rect x="-10" y="-8" width="20" height="13" rx="1.5" ${s}/><path d="M -4 9 H 4 M 0 5 V 9" ${s}/>`,
  cpu: () => `<rect x="-6" y="-6" width="12" height="12" rx="1" ${s}/><rect x="-2.5" y="-2.5" width="5" height="5" ${s}/><path d="M -3 -6 V -9 M 0 -6 V -9 M 3 -6 V -9 M -3 6 V 9 M 0 6 V 9 M 3 6 V 9 M -6 -3 H -9 M -6 0 H -9 M -6 3 H -9 M 6 -3 H 9 M 6 0 H 9 M 6 3 H 9" ${s}/>`,
  "git-branch": () => `<circle cx="-5" cy="-6" r="2.5" ${s}/><circle cx="-5" cy="7" r="2.5" ${s}/><circle cx="5" cy="-6" r="2.5" ${s}/><path d="M -5 -3.5 V 4.5 M -5 0 C -5 -4 5 -2 5 -3.5" ${s}/>`,
  bug: () => `<ellipse cx="0" cy="1" rx="5" ry="6" ${s}/><path d="M -5 -2 H 5 M -8 -3 L -5 -1 M 8 -3 L 5 -1 M -8 3 H -5 M 8 3 H 5 M -7 7 L -5 4 M 7 7 L 5 4 M -2 -6 L -4 -9 M 2 -6 L 4 -9" ${s}/>`,
  rocket: () => `<path d="M 0 -10 C 4 -6 4 0 2 5 H -2 C -4 0 -4 -6 0 -10 Z" ${s}/><circle cx="0" cy="-3" r="1.6" ${s}/><path d="M -2 5 L -5 9 L -2 7 M 2 5 L 5 9 L 2 7" ${s}/>`,
  webhook: () => `<circle cx="-4" cy="-4" r="2.6" ${s}/><circle cx="5" cy="5" r="2.6" ${s}/><path d="M -2.5 -2 C 1 1 1 3 2.8 4" ${s}/>`,
  function: () => `<path d="M 5 -8 H 3 C 1 -8 0 -6 0 -3 V 8 M -4 -2 H 4" ${s}/>`,
  // ── Tier 3 · people / business / analytics ──────────────────
  users: () => `<circle cx="-3" cy="-4" r="3.2" ${s}/><path d="M -10 9 C -10 3 4 3 4 9" ${s}/><circle cx="5" cy="-3" r="2.6" ${s}/><path d="M 6 0 C 9 0.5 10 4 10 9" ${s}/>`,
  building: () => `<rect x="-7" y="-9" width="14" height="18" rx="1" ${s}/><path d="M -4 -5 H -1 M 1 -5 H 4 M -4 -1 H -1 M 1 -1 H 4 M -2 9 V 4 H 2 V 9" ${s}/>`,
  briefcase: () => `<rect x="-9" y="-4" width="18" height="12" rx="1.5" ${s}/><path d="M -4 -4 V -7 H 4 V -4 M -9 1 H 9" ${s}/>`,
  money: () => `<circle cx="0" cy="0" r="9" ${s}/><path d="M 0 -6 V 6 M 3 -3 C 3 -5 -3 -5 -3 -2.5 C -3 0 3 0 3 2.5 C 3 5 -3 5 -3 3" ${s}/>`,
  "bar-chart": () => `<path d="M -9 9 H 9 M -8 9 V -9" ${s}/><rect x="-6" y="1" width="3.4" height="8" ${sf}/><rect x="-1" y="-4" width="3.4" height="13" ${sf}/><rect x="4" y="-8" width="3.4" height="17" ${sf}/>`,
  "pie-chart": () => `<circle cx="0" cy="0" r="9" ${s}/><path d="M 0 0 L 0 -9 A 9 9 0 0 1 7.8 4.5 Z" ${s}/>`,
  trend: () => `<path d="M -9 7 L -3 1 L 1 4 L 9 -6 M 9 -6 H 4 M 9 -6 V -1" ${s}/>`,
  chat: () => `<path d="M -9 -7 H 9 V 3 H -2 L -6 7 V 3 H -9 Z" ${s}/>`,
  bell: () => `<path d="M 0 -9 C 4 -9 6 -6 6 -2 C 6 3 8 5 8 5 H -8 C -8 5 -6 3 -6 -2 C -6 -6 -4 -9 0 -9 Z" ${s}/><path d="M -2.5 5 C -2.5 8 2.5 8 2.5 5" ${s}/>`,
  phone: () => `<path d="M -7 -7 C -3 -3 3 3 7 7 C 9 5 9 3 7 2 L 4 4 C 1 2 -2 -1 -4 -4 L -2 -7 C -3 -9 -5 -9 -7 -7 Z" ${s}/>`,
  // ── Tier 4 · medical ─────────────────────────────────────────
  heart: () => `<path d="M 0 8 C -8 1 -9 -7 -3 -7 C -1 -7 0 -5 0 -4 C 0 -5 1 -7 3 -7 C 9 -7 8 1 0 8 Z" ${s}/>`,
  pill: () => `<g transform="rotate(-40)"><rect x="-9" y="-4" width="18" height="8" rx="4" ${s}/><path d="M 0 -4 V 4" ${s}/></g>`,
  cross: () => `<path d="M -3 -9 H 3 V -3 H 9 V 3 H 3 V 9 H -3 V 3 H -9 V -3 H -3 Z" ${s}/>`,
  syringe: () => `<g transform="rotate(-45)"><rect x="-6" y="-3" width="11" height="6" ${s}/><path d="M 5 0 H 10 M -6 -3 V 3 M -8 0 H -6 M 0 -3 V 3 M 2.5 -3 V 3" ${s}/></g>`,
  dna: () => `<path d="M -5 -9 C 5 -4 -5 4 5 9 M 5 -9 C -5 -4 5 4 -5 9" ${s}/><path d="M -2.5 -6 H 2.5 M -3.5 0 H 3.5 M -2.5 6 H 2.5" ${s}/>`,
  // ── Tier 4 · legal ───────────────────────────────────────────
  scale: () => `<path d="M 0 -9 V 9 M -8 9 H 8 M -8 -5 H 8" ${s}/><circle cx="0" cy="-7.5" r="1.3" ${sf}/><path d="M -8 -5 L -10.5 1 H -5.5 Z M 8 -5 L 5.5 1 H 10.5 Z" ${s}/>`,
  gavel: () => `<g transform="rotate(40)"><rect x="-5" y="-4.5" width="10" height="9" rx="1" ${s}/><path d="M 0 4.5 V 11 M -5 -2 H 5" ${s}/></g>`,
  contract: () => `<path d="M -7 -10 H 3 L 7 -6 V 10 H -7 Z" ${s}/><path d="M 3 -10 V -6 H 7 M -4 -2 H 3 M -4 1 H 1 M -4 5 C -2 3 0 7 2 5 C 3 4 4 5 4.5 5" ${s}/>`,
  stamp: () => `<path d="M -7 9 H 7 M -7 6 H 7 M -4 6 V 2 C -4 0 -2 0 -2 -2 V -5 C -2 -7 2 -7 2 -5 V -2 C 2 0 4 0 4 2 V 6" ${s}/>`,
  // ── Tier 4 · engineering ─────────────────────────────────────
  bolt: () => `<path d="M 2 -9 L -5 2 H 0 L -2 9 L 6 -2 H 1 Z" ${s}/>`,
  battery: () => `<rect x="-9" y="-5" width="16" height="10" rx="1.5" ${s}/><path d="M 7 -2 H 9 V 2 H 7" ${s}/><path d="M -5 -2 V 2 M -1 -2 V 2 M 3 -2 V 2" ${s}/>`,
  gauge: () => `<path d="M -8 5 A 8 8 0 0 1 8 5" ${s}/><path d="M 0 5 L 4.5 -2" ${s}/><circle cx="0" cy="5" r="1.5" ${sf}/><path d="M -8 5 H -6 M 8 5 H 6 M 0 -3 V -1" ${s}/>`,
  wrench: () => `<path d="M 5 -9 A 4 4 0 1 0 9 -3 L -1 7 L -4 9.5 L -6.5 7 L -4 4 Z" ${s}/>`,
  factory: () => `<path d="M -9 9 V -1 L -3 3 V -1 L 3 3 V -1 L 9 3 V 9 Z" ${s}/><path d="M -7 -1 V -7 H -4 V -3" ${s}/>`,
  valve: () => `<path d="M -9 -6 V 6 L 0 0 Z M 9 -6 V 6 L 0 0 Z" ${s}/><path d="M 0 0 V -8 M -3 -8 H 3" ${s}/>`,
  // ── Tier 4 · finance ─────────────────────────────────────────
  bank: () => `<path d="M -9 -2 L 0 -8 L 9 -2 Z" ${s}/><path d="M -7 -2 V 7 M -2.5 -2 V 7 M 2.5 -2 V 7 M 7 -2 V 7 M -9 9 H 9" ${s}/>`,
  "credit-card": () => `<rect x="-10" y="-7" width="20" height="14" rx="2" ${s}/><path d="M -10 -2 H 10 M -7 4 H -2" ${s}/>`,
  invoice: () => `<path d="M -7 -10 H 7 V 9 L 5 11 L 3 9 L 1 11 L -1 9 L -3 11 L -5 9 L -7 11 Z" ${s}/><path d="M -4 -5 H 4 M -4 -1 H 4 M -4 3 H 1" ${s}/>`,
  coins: () => `<ellipse cx="0" cy="-4" rx="7" ry="3" ${s}/><path d="M -7 -4 V 2 C -7 4 7 4 7 2 V -4 M -7 -1 C -7 1 7 1 7 -1" ${s}/>`
};
var ALIASES = {
  db: "database",
  storage: "database",
  api: "server",
  service: "server",
  person: "user",
  account: "user",
  customer: "user",
  cog: "gear",
  settings: "gear",
  config: "gear",
  doc: "document",
  web: "globe",
  internet: "globe",
  www: "globe",
  secure: "lock",
  auth: "lock",
  password: "lock",
  email: "mail",
  envelope: "mail",
  time: "clock",
  timer: "clock",
  schedule: "clock",
  done: "check",
  success: "check",
  ok: "check",
  complete: "check",
  warning: "alert",
  error: "alert",
  danger: "alert",
  // tier 1
  directory: "folder",
  page: "file",
  find: "search",
  pencil: "edit",
  modify: "edit",
  delete: "trash",
  remove: "trash",
  plus: "add",
  new: "add",
  create: "add",
  refresh: "sync",
  reload: "sync",
  publish: "upload",
  import: "download",
  save: "download",
  url: "link",
  date: "calendar",
  events: "calendar",
  menu: "list",
  steps: "list",
  sort: "filter",
  milestone: "flag",
  favorite: "star",
  rating: "star",
  label: "tag",
  about: "info",
  help: "question",
  faq: "question",
  close: "cancel",
  reject: "cancel",
  start: "play",
  run: "play",
  end: "stop",
  // tier 2
  dev: "code",
  source: "code",
  shell: "terminal",
  cli: "terminal",
  docker: "container",
  pod: "container",
  redis: "cache",
  firewall: "shield",
  protect: "shield",
  token: "key",
  credential: "key",
  site: "browser",
  phone_app: "mobile",
  app: "mobile",
  monitor: "desktop",
  computer: "desktop",
  chip: "cpu",
  processor: "cpu",
  git: "git-branch",
  branch: "git-branch",
  issue: "bug",
  defect: "bug",
  deploy: "rocket",
  launch: "rocket",
  ship: "rocket",
  hook: "webhook",
  fn: "function",
  lambda: "function",
  // tier 3
  group: "users",
  team: "users",
  org: "building",
  company: "building",
  office: "building",
  work: "briefcase",
  job: "briefcase",
  cash: "money",
  dollar: "money",
  payment: "money",
  chart: "bar-chart",
  bars: "bar-chart",
  metrics: "bar-chart",
  pie: "pie-chart",
  growth: "trend",
  analytics: "trend",
  message: "chat",
  comment: "chat",
  notification: "bell",
  notify: "bell",
  call: "phone",
  // tier 4 medical
  health: "heart",
  like: "heart",
  medication: "pill",
  drug: "pill",
  clinic: "cross",
  hospital: "cross",
  medical: "cross",
  injection: "syringe",
  vaccine: "syringe",
  gene: "dna",
  genetic: "dna",
  // tier 4 legal
  justice: "scale",
  balance: "scale",
  legal: "scale",
  judge: "gavel",
  court: "gavel",
  agreement: "contract",
  signed: "contract",
  seal: "stamp",
  approved: "stamp",
  // tier 4 engineering
  power: "bolt",
  electric: "bolt",
  flash: "bolt",
  charge: "battery",
  meter: "gauge",
  speed: "gauge",
  tool: "wrench",
  tools: "wrench",
  repair: "wrench",
  plant: "factory",
  industrial: "factory",
  // tier 4 finance
  finance: "bank",
  card: "credit-card",
  bill: "invoice",
  receipt: "invoice",
  coin: "coins"
};
function resolveIconName(name) {
  const key = name.toLowerCase();
  if (ICONS[key]) return key;
  if (ALIASES[key] && ICONS[ALIASES[key]]) return ALIASES[key];
  return void 0;
}
function iconNames() {
  return Object.keys(ICONS);
}
function renderIcon(name) {
  const key = resolveIconName(name);
  if (key) return ICONS[key]();
  return `<path d="M -9 -5 H 2 L 9 0 L 2 5 H -9 Z" ${s}/><circle cx="-5" cy="0" r="1" ${sf}/>`;
}
function hasIcon(name) {
  return typeof name === "string" && name.length > 0;
}

// src/diagrams/flowchart/layout.ts
var FC_CONST = {
  nodeWidth: 120,
  nodeHeight: 44,
  nodeSpacingX: 40,
  // cross-flow gap between nodes in same layer
  layerSpacingY: 76,
  // flow-direction gap between layers
  dummyWidth: 1,
  padding: 24,
  /** Latin/digit avg width at 12px font. CJK uses cjkCharWidth instead. */
  charWidth: 6.8,
  /** Full-width glyph width at 12px (CJK ideograph, kana, hangul, fullwidth). */
  cjkCharWidth: 12.5,
  labelHPad: 16,
  minNodeWidth: 72,
  /**
   * Cap on per-line label width. Labels wider than `wrapLabelWidth` are
   * auto-wrapped first (see `wrapLabel`), so this clamp only bites on
   * unbreakable single tokens that survive wrapping (URLs, ids).
   */
  maxLabelWidth: 420,
  /**
   * Auto-wrap target: a single-line label measuring wider than this is
   * broken into multiple lines (preferring spaces, falling back to CJK
   * char boundaries). ≈38 Latin chars / ≈20 full-width chars per line —
   * keeps prose nodes near a readable 3:1 aspect instead of a 400px strip.
   */
  wrapLabelWidth: 260,
  crossingSweepIters: 24
};
var SHAPE_SLANT = {
  parallelogram: 20,
  trapezoid: 16
};
var CLUSTER_GEO = {
  pad: 24,
  titleH: 20,
  /** Extra visible separation between two sequential cluster bboxes. */
  gap: 12
};
function isFullWidth(code) {
  if (code >= 12288 && code <= 12351) return true;
  if (code >= 12352 && code <= 12447) return true;
  if (code >= 12448 && code <= 12543) return true;
  if (code >= 13312 && code <= 19903) return true;
  if (code >= 19968 && code <= 40959) return true;
  if (code >= 44032 && code <= 55215) return true;
  if (code >= 63744 && code <= 64255) return true;
  if (code >= 65280 && code <= 65376) return true;
  if (code >= 65504 && code <= 65510) return true;
  if (code >= 131072 && code <= 196607) return true;
  return false;
}
function labelLines(label) {
  return String(label).split(/<br\s*\/?>|\n/i).map((line2) => line2.replace(/<\/?[bi]>/gi, ""));
}
function measureLineWidth(line2) {
  let w = 0;
  for (const ch of line2) {
    const code = ch.codePointAt(0) ?? 0;
    if (isFullWidth(code)) w += FC_CONST.cjkCharWidth;
    else w += FC_CONST.charWidth;
  }
  return w;
}
function measureLabelWidth(label) {
  const lines = labelLines(label);
  let max = 0;
  for (const line2 of lines) {
    const w = measureLineWidth(line2);
    if (w > max) max = w;
  }
  return max;
}
function wrapLabel(label) {
  const text2 = String(label);
  if (/<br\s*\/?>|\n/i.test(text2)) return label;
  if (/<\/?[bi]>/i.test(text2)) return label;
  if (measureLineWidth(text2) <= FC_CONST.wrapLabelWidth) return label;
  const maxW = FC_CONST.wrapLabelWidth;
  const lines = [];
  let line2 = "";
  let lineW = 0;
  let breakAt = -1;
  let breakIsSpace = false;
  for (const ch of text2) {
    const code = ch.codePointAt(0) ?? 0;
    const chW = isFullWidth(code) ? FC_CONST.cjkCharWidth : FC_CONST.charWidth;
    if (ch === " " && line2.length > 0) {
      breakAt = line2.length;
      breakIsSpace = true;
    }
    if (lineW + chW > maxW && line2.length > 0) {
      if (breakAt > 0) {
        const head = line2.slice(0, breakAt);
        const tail = line2.slice(breakIsSpace ? breakAt + 1 : breakAt);
        lines.push(head);
        line2 = tail;
      } else {
        lines.push(line2);
        line2 = "";
      }
      lineW = measureLineWidth(line2);
      breakAt = -1;
      breakIsSpace = false;
      if (ch === " " && line2.length === 0) continue;
    }
    line2 += ch;
    lineW += chW;
    if (isFullWidth(code)) {
      breakAt = line2.length;
      breakIsSpace = false;
    }
  }
  if (line2.length > 0) lines.push(line2);
  return lines.join("\n");
}
function greedyFAS(nodeIds, edges) {
  const outAdj = /* @__PURE__ */ new Map();
  const inAdj = /* @__PURE__ */ new Map();
  for (const id of nodeIds) {
    outAdj.set(id, /* @__PURE__ */ new Set());
    inAdj.set(id, /* @__PURE__ */ new Set());
  }
  for (const e of edges) {
    if (e.from === e.to) continue;
    outAdj.get(e.from)?.add(e.to);
    inAdj.get(e.to)?.add(e.from);
  }
  const s1 = [];
  const s2 = [];
  const remaining = new Set(nodeIds);
  while (remaining.size > 0) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const v of Array.from(remaining)) {
        if ((outAdj.get(v)?.size ?? 0) === 0) {
          s2.unshift(v);
          removeVertex(v, remaining, outAdj, inAdj);
          changed = true;
        }
      }
    }
    changed = true;
    while (changed) {
      changed = false;
      for (const v of Array.from(remaining)) {
        if ((inAdj.get(v)?.size ?? 0) === 0) {
          s1.push(v);
          removeVertex(v, remaining, outAdj, inAdj);
          changed = true;
        }
      }
    }
    if (remaining.size === 0) break;
    let best = null;
    let bestScore = -Infinity;
    for (const v of remaining) {
      const score = (outAdj.get(v)?.size ?? 0) - (inAdj.get(v)?.size ?? 0);
      if (score > bestScore) {
        bestScore = score;
        best = v;
      }
    }
    if (best !== null) {
      s1.push(best);
      removeVertex(best, remaining, outAdj, inAdj);
    }
  }
  const ordering = [...s1, ...s2];
  const rank = /* @__PURE__ */ new Map();
  ordering.forEach((id, i) => rank.set(id, i));
  const feedback = /* @__PURE__ */ new Set();
  edges.forEach((e, i) => {
    if (e.from === e.to) {
      feedback.add(i);
      return;
    }
    const ru = rank.get(e.from);
    const rv = rank.get(e.to);
    if (ru !== void 0 && rv !== void 0 && ru > rv) {
      feedback.add(i);
    }
  });
  return feedback;
}
function removeVertex(v, remaining, outAdj, inAdj) {
  remaining.delete(v);
  const outs = outAdj.get(v);
  if (outs) {
    for (const w of outs) inAdj.get(w)?.delete(v);
  }
  const ins = inAdj.get(v);
  if (ins) {
    for (const u of ins) outAdj.get(u)?.delete(v);
  }
  outAdj.delete(v);
  inAdj.delete(v);
}
function longestPathLayers(nodeIds, edges) {
  const layer = /* @__PURE__ */ new Map();
  for (const id of nodeIds) layer.set(id, 0);
  const outAdj = /* @__PURE__ */ new Map();
  const inDeg = /* @__PURE__ */ new Map();
  for (const id of nodeIds) {
    outAdj.set(id, []);
    inDeg.set(id, 0);
  }
  for (const e of edges) {
    if (e.from === e.to) continue;
    outAdj.get(e.from)?.push(e.to);
    inDeg.set(e.to, (inDeg.get(e.to) ?? 0) + 1);
  }
  const queue = [];
  for (const id of nodeIds) {
    if ((inDeg.get(id) ?? 0) === 0) queue.push(id);
  }
  const order = [];
  const remIn = new Map(inDeg);
  while (queue.length > 0) {
    const v = queue.shift();
    order.push(v);
    for (const w of outAdj.get(v) ?? []) {
      const d = (remIn.get(w) ?? 0) - 1;
      remIn.set(w, d);
      if (d === 0) queue.push(w);
    }
  }
  if (order.length !== nodeIds.length) {
    for (const id of nodeIds) {
      if (!order.includes(id)) order.push(id);
    }
  }
  for (const v of order) {
    for (const w of outAdj.get(v) ?? []) {
      const lv = layer.get(v) ?? 0;
      const lw = layer.get(w) ?? 0;
      if (lw < lv + 1) layer.set(w, lv + 1);
    }
  }
  return layer;
}
function insertDummies(ledges, layerMap, genDummyId) {
  const dummyIds = [];
  const updated = [];
  for (const e of ledges) {
    if (e.from === e.to) {
      updated.push(e);
      continue;
    }
    const lu = layerMap.get(e.from) ?? 0;
    const lv = layerMap.get(e.to) ?? 0;
    const diff = Math.abs(lv - lu);
    if (diff <= 1) {
      e.chain = [e.from, e.to];
      updated.push(e);
      continue;
    }
    const step = lv > lu ? 1 : -1;
    const chain = [e.from];
    let curLayer = lu + step;
    while (curLayer !== lv) {
      const d = genDummyId();
      layerMap.set(d, curLayer);
      dummyIds.push(d);
      chain.push(d);
      curLayer += step;
    }
    chain.push(e.to);
    e.chain = chain;
    updated.push(e);
  }
  return { dummyIds, updatedEdges: updated };
}
function dfsInitOrder(layers, segments) {
  const layerOf = /* @__PURE__ */ new Map();
  layers.forEach((l, i) => l.forEach((id) => layerOf.set(id, i)));
  const succ = /* @__PURE__ */ new Map();
  for (const [u, v] of segments) {
    if (!succ.has(u)) succ.set(u, []);
    succ.get(u).push(v);
  }
  const order = layers.map(() => []);
  const seen = /* @__PURE__ */ new Set();
  const visit = (id) => {
    if (seen.has(id)) return;
    seen.add(id);
    const l = layerOf.get(id);
    if (l === void 0) return;
    order[l].push(id);
    for (const n of succ.get(id) ?? []) visit(n);
  };
  for (const id of layers[0] ?? []) visit(id);
  for (const layer of layers) {
    for (const id of layer) if (!seen.has(id)) {
      seen.add(id);
      const l = layerOf.get(id);
      order[l].push(id);
    }
  }
  return order;
}
function barycenterReorder(layer, fixed, neighborsOf, biasRight) {
  const fixedIdx = /* @__PURE__ */ new Map();
  fixed.forEach((id, i) => fixedIdx.set(id, i));
  const scored = layer.map((id, i) => {
    const neighbors = neighborsOf(id).map((n) => fixedIdx.get(n)).filter((p) => p !== void 0);
    if (neighbors.length === 0) return { id, score: -1, orig: i, hasNeighbors: false };
    const sum = neighbors.reduce((s2, n) => s2 + n, 0);
    return { id, score: sum / neighbors.length, orig: i, hasNeighbors: true };
  });
  const withNbrs = scored.filter((s2) => s2.hasNeighbors);
  const withoutNbrs = scored.filter((s2) => !s2.hasNeighbors);
  withNbrs.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return biasRight ? b.orig - a.orig : a.orig - b.orig;
  });
  const result = new Array(layer.length);
  for (const s2 of withoutNbrs) result[s2.orig] = s2;
  let k = 0;
  for (let i = 0; i < result.length; i++) {
    if (result[i] !== void 0) continue;
    result[i] = withNbrs[k++];
  }
  return result.map((s2) => s2.id);
}
function orderLayers(layers, segments) {
  const succ = /* @__PURE__ */ new Map();
  const pred = /* @__PURE__ */ new Map();
  for (const layer of layers) for (const id of layer) {
    succ.set(id, []);
    pred.set(id, []);
  }
  for (const [u, v] of segments) {
    succ.get(u)?.push(v);
    pred.get(v)?.push(u);
  }
  let result = dfsInitOrder(layers, segments);
  let bestCrossings = countCrossings(result, segments);
  let best = result.map((l) => l.slice());
  const maxStale = 4;
  let stale = 0;
  for (let iter = 0; iter < FC_CONST.crossingSweepIters && stale < maxStale; iter++) {
    const down = iter % 2 === 0;
    const biasRight = iter % 4 >= 2;
    const next = result.map((l) => l.slice());
    if (down) {
      for (let i = 1; i < next.length; i++) {
        next[i] = barycenterReorder(
          next[i],
          next[i - 1],
          (id) => pred.get(id) ?? [],
          biasRight
        );
      }
    } else {
      for (let i = next.length - 2; i >= 0; i--) {
        next[i] = barycenterReorder(
          next[i],
          next[i + 1],
          (id) => succ.get(id) ?? [],
          biasRight
        );
      }
    }
    const c = countCrossings(next, segments);
    if (c < bestCrossings) {
      bestCrossings = c;
      best = next.map((l) => l.slice());
      stale = 0;
    } else {
      stale++;
    }
    result = next;
  }
  return best;
}
function countCrossings(layers, segments) {
  let total = 0;
  const layerIdx = layers.map((l) => {
    const m = /* @__PURE__ */ new Map();
    l.forEach((id, i) => m.set(id, i));
    return m;
  });
  for (let i = 0; i < layers.length - 1; i++) {
    const upper = layerIdx[i];
    const lower = layerIdx[i + 1];
    const n = layers[i + 1].length;
    if (n === 0) continue;
    const edges = [];
    for (const [u, v] of segments) {
      const iu = upper.get(u);
      const iv = lower.get(v);
      if (iu !== void 0 && iv !== void 0) edges.push([iu, iv]);
    }
    edges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let firstIndex = 1;
    while (firstIndex < n) firstIndex <<= 1;
    const treeSize = 2 * firstIndex - 1;
    firstIndex -= 1;
    const tree = new Uint32Array(treeSize);
    for (const [, iv] of edges) {
      let idx = iv + firstIndex;
      tree[idx] += 1;
      let weightSum = 0;
      while (idx > 0) {
        if (idx % 2) weightSum += tree[idx + 1] ?? 0;
        idx = idx - 1 >> 1;
        tree[idx] += 1;
      }
      total += weightSum;
    }
  }
  return total;
}
function laneBasedXCoords(layerNodes, pathOf, nodeSpacingX, segments) {
  const INNER_PAD = 28;
  const LANE_GAP = 36;
  const laneOf = (id) => {
    const p = pathOf(id);
    return p.length > 0 ? p[0] : null;
  };
  const laneOrder = [];
  const laneSeen = /* @__PURE__ */ new Set();
  for (const layer of layerNodes) {
    for (const n of layer) {
      if (n.isDummy) continue;
      const lane = laneOf(n.id);
      if (!laneSeen.has(lane)) {
        laneSeen.add(lane);
        laneOrder.push(lane);
      }
    }
  }
  const clusterLanes = laneOrder.filter((l) => l !== null);
  if (clusterLanes.length >= 2 && laneOrder.includes(null)) {
    const tmpPartition = layerNodes.map(
      (layer) => {
        const m = /* @__PURE__ */ new Map();
        for (const n of layer) {
          if (n.isDummy) continue;
          const lane = laneOf(n.id);
          if (!m.has(lane)) m.set(lane, []);
          m.get(lane).push(n);
        }
        return m;
      }
    );
    const clusterOccupiedLayers = /* @__PURE__ */ new Set();
    for (let li = 0; li < tmpPartition.length; li++) {
      for (const lane of clusterLanes) {
        if ((tmpPartition[li].get(lane) ?? []).length > 0) {
          clusterOccupiedLayers.add(li);
        }
      }
    }
    let nullIsBoundary = true;
    for (let li = 0; li < tmpPartition.length; li++) {
      const nm = tmpPartition[li].get(null) ?? [];
      if (nm.length > 0 && clusterOccupiedLayers.has(li)) {
        nullIsBoundary = false;
        break;
      }
    }
    if (nullIsBoundary) {
      const mid = Math.floor(clusterLanes.length / 2);
      laneOrder.length = 0;
      laneOrder.push(
        ...clusterLanes.slice(0, mid),
        null,
        ...clusterLanes.slice(mid)
      );
    }
  }
  const lanesPerLayer = layerNodes.map(
    (layer) => {
      const m = /* @__PURE__ */ new Map();
      for (const n of layer) {
        if (n.isDummy) continue;
        const lane = laneOf(n.id);
        if (!m.has(lane)) m.set(lane, []);
        m.get(lane).push(n);
      }
      return m;
    }
  );
  const laneWidths = laneOrder.map((lane) => {
    let maxInner = 0;
    for (const layerLanes of lanesPerLayer) {
      const members = layerLanes.get(lane) ?? [];
      if (members.length === 0) continue;
      const inner = members.reduce((s2, n) => s2 + n.width, 0) + (members.length - 1) * nodeSpacingX;
      if (inner > maxInner) maxInner = inner;
    }
    const pad = lane !== null ? 2 * INNER_PAD : 0;
    return maxInner + pad;
  });
  const laneStartX = [];
  {
    let x = 0;
    for (let i = 0; i < laneWidths.length; i++) {
      laneStartX.push(x);
      x += laneWidths[i];
      if (i < laneWidths.length - 1) x += LANE_GAP;
    }
  }
  const result = /* @__PURE__ */ new Map();
  for (let li = 0; li < lanesPerLayer.length; li++) {
    for (let laneIdx = 0; laneIdx < laneOrder.length; laneIdx++) {
      const lane = laneOrder[laneIdx];
      const members = lanesPerLayer[li].get(lane) ?? [];
      if (members.length === 0) continue;
      const laneW = laneWidths[laneIdx];
      const laneStart = laneStartX[laneIdx];
      const innerW = members.reduce((s2, n) => s2 + n.width, 0) + (members.length - 1) * nodeSpacingX;
      let cursor = laneStart + (laneW - innerW) / 2;
      for (const n of members) {
        result.set(n.id, cursor + n.width / 2);
        cursor += n.width + nodeSpacingX;
      }
    }
  }
  for (let pass = 0; pass < 4; pass++) {
    for (const layer of layerNodes) {
      for (const n of layer) {
        if (!n.isDummy) continue;
        const neighbors = [];
        for (const [u, v] of segments) {
          if (v === n.id) {
            const ux = result.get(u);
            if (ux !== void 0) neighbors.push(ux);
          }
          if (u === n.id) {
            const vx = result.get(v);
            if (vx !== void 0) neighbors.push(vx);
          }
        }
        if (neighbors.length === 0) {
          if (!result.has(n.id)) result.set(n.id, 0);
          continue;
        }
        neighbors.sort((a, b) => a - b);
        result.set(n.id, neighbors[Math.floor(neighbors.length / 2)]);
      }
    }
  }
  return result;
}
function enforceSequentialClusterLayers(ast, layerMap, edges) {
  const sgParent = /* @__PURE__ */ new Map();
  for (const sg of ast.subgraphs) {
    for (const childSg of sg.subgraphs) sgParent.set(childSg, sg.id);
    if (!sgParent.has(sg.id)) sgParent.set(sg.id, void 0);
  }
  const topLevel = ast.subgraphs.filter((sg) => !sgParent.get(sg.id));
  if (topLevel.length < 2) return;
  const collect = (sgId) => {
    const sg = ast.subgraphs.find((s2) => s2.id === sgId);
    if (!sg) return [];
    const ids = [...sg.children];
    for (const childSgId of sg.subgraphs) ids.push(...collect(childSgId));
    return ids;
  };
  const adjOut = /* @__PURE__ */ new Map();
  for (const e of edges) {
    if (!adjOut.has(e.from)) adjOut.set(e.from, []);
    adjOut.get(e.from).push(e.to);
  }
  const hasForwardEdge = (srcSgId, dstSgId) => {
    const srcIds = new Set(collect(srcSgId));
    const dstIds = new Set(collect(dstSgId));
    for (const id of srcIds) {
      for (const t of adjOut.get(id) ?? []) {
        if (dstIds.has(t)) return true;
      }
    }
    return false;
  };
  const chains = [];
  let cur = [];
  for (let i = 0; i < topLevel.length; i++) {
    const sg = topLevel[i];
    if (i === 0 || !hasForwardEdge(topLevel[i - 1].id, sg.id)) {
      if (cur.length > 1) chains.push(cur);
      cur = [sg.id];
    } else {
      cur.push(sg.id);
    }
  }
  if (cur.length > 1) chains.push(cur);
  if (chains.length === 0) return;
  for (const chain of chains) {
    let prevMax = -Infinity;
    for (const clusterId of chain) {
      const ids = collect(clusterId);
      if (ids.length === 0) continue;
      let curMin = Infinity;
      let curMax = -Infinity;
      for (const id of ids) {
        const l = layerMap.get(id) ?? 0;
        if (l < curMin) curMin = l;
        if (l > curMax) curMax = l;
      }
      const requiredMin = prevMax === -Infinity ? curMin : prevMax + 1;
      if (curMin < requiredMin) {
        const shift = requiredMin - curMin;
        const toShift = new Set(ids);
        const queue = [...ids];
        while (queue.length > 0) {
          const u = queue.shift();
          for (const t of adjOut.get(u) ?? []) {
            if (!toShift.has(t)) {
              toShift.add(t);
              queue.push(t);
            }
          }
        }
        for (const id of toShift) {
          layerMap.set(id, (layerMap.get(id) ?? 0) + shift);
        }
        prevMax = curMax + shift;
      } else {
        prevMax = curMax;
      }
    }
  }
}
function hasOverlappingTopLevelClusters(ast, layerMap, sgParent) {
  const topLevel = ast.subgraphs.filter((sg) => !sgParent.get(sg.id));
  if (topLevel.length < 2) return false;
  const collect = (sgId) => {
    const sg = ast.subgraphs.find((s2) => s2.id === sgId);
    if (!sg) return [];
    const ids = [...sg.children];
    for (const childSgId of sg.subgraphs) ids.push(...collect(childSgId));
    return ids;
  };
  const ranges = topLevel.map((sg) => {
    const ids = collect(sg.id);
    if (ids.length === 0) return { min: 0, max: -1 };
    const layers = ids.map((id) => layerMap.get(id) ?? 0);
    return { min: Math.min(...layers), max: Math.max(...layers) };
  });
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      const a = ranges[i];
      const b = ranges[j];
      if (a.max < a.min || b.max < b.min) continue;
      if (a.min <= b.max && b.min <= a.max) return true;
    }
  }
  return false;
}
function layoutFlowchart(ast, pins) {
  const dir = ast.direction;
  const isHorizontalDir = dir === "LR" || dir === "RL";
  for (const n of ast.nodes) n.label = wrapLabel(n.label);
  const sizeOf = (n) => {
    const rawTextW = measureLabelWidth(n.label);
    const labelW = Math.min(
      FC_CONST.maxLabelWidth,
      Math.ceil(rawTextW) + FC_CONST.labelHPad * 2
    );
    let shapeW = Math.max(FC_CONST.minNodeWidth, labelW);
    const nLines = labelLines(n.label).length;
    const multilineH = nLines > 1 ? FC_CONST.nodeHeight + (nLines - 1) * 14 : FC_CONST.nodeHeight;
    let shapeH = multilineH;
    if (n.shape === "diamond") {
      shapeW = Math.max(shapeW, labelW * 1.4);
      shapeH = Math.max(shapeH, 52);
    }
    if (n.shape === "parallelogram" || n.shape === "parallelogram-alt") {
      shapeW += 2 * SHAPE_SLANT.parallelogram + 8;
    }
    if (n.shape === "trapezoid" || n.shape === "trapezoid-alt") {
      shapeW += 2 * SHAPE_SLANT.trapezoid + 8;
    }
    if (n.shape === "stadium" || n.shape === "round") {
      shapeW = Math.max(shapeW, shapeH + 20);
    }
    if (n.shape === "circle" || n.shape === "double-circle") {
      const side = Math.max(shapeW, shapeH) + 8;
      shapeW = side;
      shapeH = side;
    }
    if (n.shape === "hexagon") {
      shapeW = Math.max(shapeW, labelW + 48);
    }
    if (n.shape === "asymmetric") {
      shapeW += 24;
    }
    if (n.shape === "cylinder") {
      shapeH = Math.max(shapeH, 52);
    }
    if (n.shape === "subroutine") {
      shapeW = Math.max(shapeW, labelW + 36);
    }
    if (hasIcon(n.icon)) {
      shapeH += ICON_SIZE + ICON_GAP;
      shapeW = Math.max(shapeW, ICON_SIZE + 16);
    }
    return isHorizontalDir ? { w: shapeH, h: shapeW } : { w: shapeW, h: shapeH };
  };
  const nodeMap = /* @__PURE__ */ new Map();
  for (const n of ast.nodes) nodeMap.set(n.id, n);
  for (const e of ast.edges) {
    for (const id of [e.from, e.to]) {
      if (!nodeMap.has(id)) {
        const implicit = { id, label: id, shape: "rect" };
        nodeMap.set(id, implicit);
        ast.nodes.push(implicit);
      }
    }
  }
  const allIds = Array.from(nodeMap.keys());
  const feedbackIdx = greedyFAS(allIds, ast.edges);
  const ledges = ast.edges.map((e, i) => {
    const reversed = feedbackIdx.has(i) && e.from !== e.to;
    return {
      from: reversed ? e.to : e.from,
      to: reversed ? e.from : e.to,
      original: e,
      isReversed: reversed,
      chain: []
    };
  });
  const layerMap = longestPathLayers(allIds, ledges);
  enforceSequentialClusterLayers(ast, layerMap, ledges);
  let dummyCounter = 0;
  const dummies = [];
  const { updatedEdges } = insertDummies(ledges, layerMap, () => {
    const id = `__dummy_${dummyCounter++}`;
    dummies.push(id);
    return id;
  });
  const lnodes = /* @__PURE__ */ new Map();
  for (const id of allIds) {
    const n = nodeMap.get(id);
    const { w, h } = sizeOf(n);
    lnodes.set(id, {
      id,
      node: n,
      layer: layerMap.get(id) ?? 0,
      order: 0,
      width: w,
      height: h,
      isDummy: false
    });
  }
  for (const id of dummies) {
    lnodes.set(id, {
      id,
      layer: layerMap.get(id) ?? 0,
      order: 0,
      width: FC_CONST.dummyWidth,
      height: 0,
      isDummy: true
    });
  }
  const maxLayer = Math.max(0, ...Array.from(layerMap.values()));
  const layers = [];
  for (let i = 0; i <= maxLayer; i++) layers.push([]);
  for (const [id, layer] of layerMap) {
    layers[layer].push(id);
  }
  const segments = [];
  for (const e of updatedEdges) {
    if (e.chain.length >= 2) {
      for (let i = 0; i < e.chain.length - 1; i++) {
        segments.push([e.chain[i], e.chain[i + 1]]);
      }
    }
  }
  let ordered = orderLayers(layers, segments);
  const parentOf = /* @__PURE__ */ new Map();
  for (const n of ast.nodes) parentOf.set(n.id, n.parent);
  const sgParent = /* @__PURE__ */ new Map();
  for (const sg of ast.subgraphs) {
    for (const childSg of sg.subgraphs) sgParent.set(childSg, sg.id);
    if (!sgParent.has(sg.id)) sgParent.set(sg.id, void 0);
  }
  const ancestryPath = (id) => {
    const path2 = [];
    let cur = parentOf.get(id);
    while (cur !== void 0) {
      path2.unshift(cur);
      cur = sgParent.get(cur);
    }
    return path2;
  };
  const dummyAncestry = /* @__PURE__ */ new Map();
  for (const e of updatedEdges) {
    if (e.chain.length < 3) continue;
    const fromA = ancestryPath(e.chain[0]);
    const toA = ancestryPath(e.chain[e.chain.length - 1]);
    const common = [];
    for (let k = 0; k < Math.min(fromA.length, toA.length); k++) {
      if (fromA[k] === toA[k]) common.push(fromA[k]);
      else break;
    }
    for (let i = 1; i < e.chain.length - 1; i++) {
      dummyAncestry.set(e.chain[i], common);
    }
  }
  const pathOf = (id) => dummyAncestry.get(id) ?? ancestryPath(id);
  if (ast.subgraphs.length > 0) {
    ordered = ordered.map((layer) => {
      const keyed = layer.map((id, i) => ({ id, i, path: pathOf(id) }));
      keyed.sort((a, b) => {
        const la = a.path;
        const lb = b.path;
        const len = Math.min(la.length, lb.length);
        for (let k = 0; k < len; k++) {
          if (la[k] !== lb[k]) return la[k].localeCompare(lb[k]);
        }
        if (la.length !== lb.length) return la.length - lb.length;
        return a.i - b.i;
      });
      return keyed.map((k) => k.id);
    });
  }
  for (let li = 0; li < ordered.length; li++) {
    const layer = ordered[li];
    for (let oi = 0; oi < layer.length; oi++) {
      const n = lnodes.get(layer[oi]);
      if (n) n.order = oi;
    }
  }
  const layerNodes = ordered.map(
    (layer) => layer.map((id) => lnodes.get(id))
  );
  const useLane = ast.subgraphs.length > 0 && hasOverlappingTopLevelClusters(ast, layerMap, sgParent);
  let xMap;
  if (useLane) {
    xMap = laneBasedXCoords(
      layerNodes,
      pathOf,
      FC_CONST.nodeSpacingX,
      segments
    );
  } else {
    const bkLayers = layerNodes.map(
      (layer) => layer.map((n) => ({ id: n.id, width: n.width, isDummy: n.isDummy }))
    );
    xMap = bkXCoords(bkLayers, segments, FC_CONST.nodeSpacingX);
  }
  const isHorizontal = dir === "LR" || dir === "RL";
  const layerHeights = layerNodes.map((layer) => {
    let maxH = 0;
    for (const n of layer) {
      if (n.isDummy) continue;
      if (n.height > maxH) maxH = n.height;
    }
    return maxH > 0 ? maxH : FC_CONST.nodeHeight;
  });
  const hasClusters = ast.subgraphs.length > 0;
  const CLUSTER_OVERHEAD_TITLE = hasClusters ? CLUSTER_GEO.pad + CLUSTER_GEO.titleH : 0;
  const CLUSTER_OVERHEAD_SIDE = hasClusters ? CLUSTER_GEO.pad : 0;
  const extraTopPad = !isHorizontal && dir !== "BT" ? CLUSTER_OVERHEAD_TITLE : CLUSTER_OVERHEAD_SIDE;
  const extraLeftPad = isHorizontal && dir !== "RL" ? CLUSTER_OVERHEAD_TITLE : CLUSTER_OVERHEAD_SIDE;
  const topLevelOf = (sgId) => {
    let cur = sgId;
    let safety = 32;
    while (safety-- > 0) {
      const p = sgParent.get(cur);
      if (!p) return cur;
      cur = p;
    }
    return cur;
  };
  const clustersAtLayer = layerNodes.map(() => /* @__PURE__ */ new Set());
  for (let li = 0; li < layerNodes.length; li++) {
    for (const n of layerNodes[li]) {
      if (n.isDummy) continue;
      const parent = parentOf.get(n.id);
      if (!parent) continue;
      clustersAtLayer[li].add(topLevelOf(parent));
    }
  }
  const layerGapAt = (li) => {
    const a = clustersAtLayer[li] ?? /* @__PURE__ */ new Set();
    const b = clustersAtLayer[li + 1] ?? /* @__PURE__ */ new Set();
    let hasExit = false;
    for (const c of a) if (!b.has(c)) {
      hasExit = true;
      break;
    }
    let hasEntry = false;
    for (const c of b) if (!a.has(c)) {
      hasEntry = true;
      break;
    }
    let required = 0;
    if (hasExit) required += CLUSTER_GEO.pad;
    if (hasEntry) required += CLUSTER_GEO.pad + CLUSTER_GEO.titleH;
    if (hasExit && hasEntry) required += CLUSTER_GEO.gap;
    return Math.max(FC_CONST.layerSpacingY, required);
  };
  const layerCenterY = [];
  {
    let y = FC_CONST.padding + extraTopPad;
    for (let li = 0; li < layerHeights.length; li++) {
      y += layerHeights[li] / 2;
      layerCenterY.push(y);
      y += layerHeights[li] / 2;
      if (li < layerHeights.length - 1) y += layerGapAt(li);
    }
  }
  const channelMidAbstract = [];
  for (let li = 0; li < layerCenterY.length - 1; li++) {
    const bottomI = layerCenterY[li] + layerHeights[li] / 2;
    const topNext = layerCenterY[li + 1] - layerHeights[li + 1] / 2;
    channelMidAbstract.push((bottomI + topNext) / 2);
  }
  let minX = Infinity;
  let maxX = -Infinity;
  for (const [id, x] of xMap) {
    const n = lnodes.get(id);
    if (n.isDummy) continue;
    minX = Math.min(minX, x - n.width / 2);
    maxX = Math.max(maxX, x + n.width / 2);
  }
  if (!isFinite(minX)) {
    minX = 0;
    maxX = 100;
  }
  const padding = FC_CONST.padding;
  const shiftX = padding + extraLeftPad - minX;
  const placed = [];
  for (let li = 0; li < layerNodes.length; li++) {
    const y = layerCenterY[li];
    for (const n of layerNodes[li]) {
      if (n.isDummy) continue;
      const cx = (xMap.get(n.id) ?? 0) + shiftX;
      placed.push({
        id: n.id,
        x: cx - n.width / 2,
        y: y - n.height / 2,
        width: n.width,
        height: n.height,
        layer: li,
        order: n.order
      });
    }
  }
  const dummyPos = /* @__PURE__ */ new Map();
  for (let li = 0; li < layerNodes.length; li++) {
    const y = layerCenterY[li];
    for (const n of layerNodes[li]) {
      if (!n.isDummy) continue;
      dummyPos.set(n.id, {
        x: (xMap.get(n.id) ?? 0) + shiftX,
        y
      });
    }
  }
  const extraRightPad = isHorizontal && dir === "RL" ? CLUSTER_OVERHEAD_TITLE : CLUSTER_OVERHEAD_SIDE;
  const extraBottomPad = !isHorizontal && dir === "BT" ? CLUSTER_OVERHEAD_TITLE : CLUSTER_OVERHEAD_SIDE;
  const canvasW = maxX - minX + 2 * padding + extraLeftPad + extraRightPad;
  const lastLayer = layerCenterY.length - 1;
  const canvasH = lastLayer >= 0 ? layerCenterY[lastLayer] + layerHeights[lastLayer] / 2 + padding + extraBottomPad : 2 * padding;
  const outNodes = placed.map((p) => {
    const base = lnodes.get(p.id).node;
    if (!isHorizontal) {
      return {
        node: base,
        x: p.x,
        y: p.y,
        width: p.width,
        height: p.height,
        layer: p.layer,
        order: p.order
      };
    }
    return {
      node: base,
      x: p.y,
      y: p.x,
      width: p.height,
      height: p.width,
      layer: p.layer,
      order: p.order
    };
  });
  const outWidth = isHorizontal ? canvasH : canvasW;
  const outHeight = isHorizontal ? canvasW : canvasH;
  const finalChannel = channelMidAbstract.map((m) => {
    if (dir === "BT") return outHeight - m;
    if (dir === "RL") return outWidth - m;
    return m;
  });
  const nodeCenter = /* @__PURE__ */ new Map();
  for (const ln of outNodes) {
    nodeCenter.set(ln.node.id, {
      x: ln.x + ln.width / 2,
      y: ln.y + ln.height / 2,
      w: ln.width,
      h: ln.height
    });
  }
  const dummyCenter = /* @__PURE__ */ new Map();
  for (const [id, p] of dummyPos) {
    if (!isHorizontal) dummyCenter.set(id, p);
    else dummyCenter.set(id, { x: p.y, y: p.x });
  }
  if (dir === "BT" || dir === "RL") {
    const flipY = dir === "BT";
    const flipX = dir === "RL";
    for (const n of outNodes) {
      if (flipY) n.y = outHeight - n.y - n.height;
      if (flipX) n.x = outWidth - n.x - n.width;
    }
    for (const c of nodeCenter.values()) {
      if (flipY) c.y = outHeight - c.y;
      if (flipX) c.x = outWidth - c.x;
    }
    for (const c of dummyCenter.values()) {
      if (flipY) c.y = outHeight - c.y;
      if (flipX) c.x = outWidth - c.x;
    }
  }
  chunkNTS45SH6_cjs.applyPins(outNodes, pins, {
    id: (item) => item.node.id,
    position: () => "free"
  });
  nodeCenter.clear();
  for (const ln of outNodes) {
    nodeCenter.set(ln.node.id, {
      x: ln.x + ln.width / 2,
      y: ln.y + ln.height / 2,
      w: ln.width,
      h: ln.height
    });
  }
  const edgeIndex = /* @__PURE__ */ new Map();
  ast.edges.forEach((e, i) => edgeIndex.set(e, i));
  const outEdges = updatedEdges.map((le) => {
    const chain = le.chain.length > 0 ? le.chain : [le.from, le.to];
    const points = [];
    for (let i = 0; i < chain.length; i++) {
      const id = chain[i];
      const nc = nodeCenter.get(id);
      const dc = dummyCenter.get(id);
      if (nc) {
        points.push({ x: nc.x, y: nc.y });
      } else if (dc) {
        points.push({ x: dc.x, y: dc.y });
      }
    }
    if (points.length < 2) {
      return { edge: le.original, path: "", index: edgeIndex.get(le.original) };
    }
    const startNode = nodeCenter.get(chain[0]);
    const endNode = nodeCenter.get(chain[chain.length - 1]);
    if (startNode) {
      points[0] = clipToBox(points[0], points[1], startNode, dir);
    }
    if (endNode) {
      points[points.length - 1] = clipToBox(
        points[points.length - 1],
        points[points.length - 2],
        endNode,
        dir);
    }
    const chainLayers = chain.map((id) => layerMap.get(id) ?? 0);
    const d = buildManhattanPath(points, dir, chainLayers, finalChannel);
    let labelAnchor;
    if (le.original.label) {
      labelAnchor = edgeLabelAnchor(points, dir, chainLayers, finalChannel);
    }
    return {
      edge: {
        ...le.original,
        isReversed: le.isReversed
      },
      path: d,
      labelAnchor,
      index: edgeIndex.get(le.original)
    };
  });
  function collectDescendantNodeIds(sgId) {
    const sg = ast.subgraphs.find((s2) => s2.id === sgId);
    if (!sg) return [];
    const ids = [...sg.children];
    for (const childSgId of sg.subgraphs) ids.push(...collectDescendantNodeIds(childSgId));
    return ids;
  }
  function computeDepth(sgId) {
    for (const s2 of ast.subgraphs) {
      if (s2.subgraphs.includes(sgId)) return 1 + computeDepth(s2.id);
    }
    return 0;
  }
  const { pad: CLUSTER_PAD, titleH: CLUSTER_TITLE_H } = CLUSTER_GEO;
  const clusters = ast.subgraphs.map((sg) => {
    const memberIds = collectDescendantNodeIds(sg.id);
    const members = outNodes.filter((n) => memberIds.includes(n.node.id));
    if (members.length === 0) return null;
    const minX2 = Math.min(...members.map((n) => n.x)) - CLUSTER_PAD;
    const minY = Math.min(...members.map((n) => n.y)) - CLUSTER_PAD - CLUSTER_TITLE_H;
    const maxX2 = Math.max(...members.map((n) => n.x + n.width)) + CLUSTER_PAD;
    const maxY = Math.max(...members.map((n) => n.y + n.height)) + CLUSTER_PAD;
    return {
      subgraph: sg,
      x: minX2,
      y: minY,
      width: maxX2 - minX2,
      height: maxY - minY,
      depth: computeDepth(sg.id)
    };
  }).filter((c) => c !== null);
  let expandedViewBox;
  if (pins && pins.size > 0 && outNodes.length > 0) {
    const bounds = [
      ...outNodes.map((node) => ({
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height
      })),
      ...clusters
    ];
    const minPinnedX = Math.min(0, ...bounds.map((box) => box.x - padding));
    const minPinnedY = Math.min(0, ...bounds.map((box) => box.y - padding));
    const maxPinnedX = Math.max(outWidth, ...bounds.map((box) => box.x + box.width + padding));
    const maxPinnedY = Math.max(outHeight, ...bounds.map((box) => box.y + box.height + padding));
    if (minPinnedX !== 0 || minPinnedY !== 0 || maxPinnedX !== outWidth || maxPinnedY !== outHeight) {
      expandedViewBox = {
        x: minPinnedX,
        y: minPinnedY,
        width: maxPinnedX - minPinnedX,
        height: maxPinnedY - minPinnedY
      };
    }
  }
  return {
    width: expandedViewBox?.width ?? outWidth,
    height: expandedViewBox?.height ?? outHeight,
    direction: dir,
    nodes: outNodes,
    edges: outEdges,
    clusters,
    viewBox: expandedViewBox
  };
}
function clipToBox(from, toward, box, dir, isStart) {
  const cx = box.x;
  const cy = box.y;
  if (dir === "TB" || dir === "BT") {
    const goingDown = toward.y >= from.y;
    return { x: cx, y: cy + (goingDown ? box.h / 2 : -box.h / 2) };
  }
  const goingRight = toward.x >= from.x;
  return { x: cx + (goingRight ? box.w / 2 : -box.w / 2), y: cy };
}
function buildManhattanPath(pts, dir, layers, channel) {
  if (pts.length === 0) return "";
  const parts = [`M ${fmt(pts[0].x)} ${fmt(pts[0].y)}`];
  const isHorizontal = dir === "LR" || dir === "RL";
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    let bend = null;
    if (layers && channel) {
      const la = layers[i - 1];
      const lb = layers[i];
      if (la !== void 0 && lb !== void 0 && la !== lb) {
        const ci = Math.min(la, lb);
        const cv = channel[ci];
        if (cv !== void 0) bend = cv;
      }
    }
    if (isHorizontal) {
      const midX = bend ?? (a.x + b.x) / 2;
      parts.push(`L ${fmt(midX)} ${fmt(a.y)}`);
      parts.push(`L ${fmt(midX)} ${fmt(b.y)}`);
      parts.push(`L ${fmt(b.x)} ${fmt(b.y)}`);
    } else {
      const midY = bend ?? (a.y + b.y) / 2;
      parts.push(`L ${fmt(a.x)} ${fmt(midY)}`);
      parts.push(`L ${fmt(b.x)} ${fmt(midY)}`);
      parts.push(`L ${fmt(b.x)} ${fmt(b.y)}`);
    }
  }
  return parts.join(" ");
}
function fmt(n) {
  return (Math.round(n * 100) / 100).toString();
}
function edgeLabelAnchor(pts, dir, layers, channel) {
  let bend = null;
  if (layers && channel && layers.length >= 2) {
    const la = layers[0];
    const lb = layers[1];
    if (la !== lb) {
      const cv = channel[Math.min(la, lb)];
      if (cv !== void 0) bend = cv;
    }
  }
  if (pts.length < 2) return pts[0] ?? { x: 0, y: 0 };
  const a = pts[0];
  const b = pts[1];
  const isHorizontal = dir === "LR" || dir === "RL";
  if (isHorizontal) {
    const midX = bend ?? (a.x + b.x) / 2;
    const bends2 = Math.abs(a.y - b.y) > 1;
    if (bends2) {
      const midY2 = (a.y + b.y) / 2;
      return { x: midX + 6, y: midY2, textAnchor: "start" };
    }
    return { x: midX, y: a.y - 8, textAnchor: "middle" };
  }
  const midY = bend ?? (a.y + b.y) / 2;
  const bends = Math.abs(a.x - b.x) > 1;
  if (bends) {
    const midX = (a.x + b.x) / 2;
    return { x: midX, y: midY - 8, textAnchor: "middle" };
  }
  return { x: a.x + 6, y: midY, textAnchor: "start" };
}

// src/diagrams/flowchart/shapes.ts
function shapeSVG(shape, w, h) {
  switch (shape) {
    // ── M1 core shapes ─────────────────────────────────────────
    case "rect":
      return chunk7ZEDTSU3_cjs.rect({ x: 0, y: 0, width: w, height: h, rx: 14, ry: 14, class: "sx-fc-node" });
    case "round":
      return chunk7ZEDTSU3_cjs.rect({ x: 0, y: 0, width: w, height: h, rx: 20, ry: 20, class: "sx-fc-node sx-fc-node-round" });
    case "stadium": {
      const r = Math.min(h / 2, 24);
      return chunk7ZEDTSU3_cjs.rect({ x: 0, y: 0, width: w, height: h, rx: r, ry: r, class: "sx-fc-node sx-fc-node-stadium" });
    }
    case "diamond": {
      const points = `${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`;
      return chunk7ZEDTSU3_cjs.polygon({ points, class: "sx-fc-node sx-fc-node-diamond" });
    }
    case "parallelogram": {
      const slant = SHAPE_SLANT.parallelogram;
      const points = `${slant},0 ${w},0 ${w - slant},${h} 0,${h}`;
      return chunk7ZEDTSU3_cjs.polygon({ points, class: "sx-fc-node" });
    }
    // ── M2 additional shapes ────────────────────────────────────
    case "parallelogram-alt": {
      const slant = SHAPE_SLANT.parallelogram;
      const points = `0,0 ${w - slant},0 ${w},${h} ${slant},${h}`;
      return chunk7ZEDTSU3_cjs.polygon({ points, class: "sx-fc-node" });
    }
    case "trapezoid": {
      const slant = SHAPE_SLANT.trapezoid;
      const points = `0,0 ${w},0 ${w - slant},${h} ${slant},${h}`;
      return chunk7ZEDTSU3_cjs.polygon({ points, class: "sx-fc-node" });
    }
    case "trapezoid-alt": {
      const slant = SHAPE_SLANT.trapezoid;
      const points = `${slant},0 ${w - slant},0 ${w},${h} 0,${h}`;
      return chunk7ZEDTSU3_cjs.polygon({ points, class: "sx-fc-node" });
    }
    case "subroutine": {
      const barX = 10;
      const body = chunk7ZEDTSU3_cjs.rect({ x: 0, y: 0, width: w, height: h, rx: 2, class: "sx-fc-node" });
      const left = chunk7ZEDTSU3_cjs.line({ x1: barX, y1: 0, x2: barX, y2: h, class: "sx-fc-node-subline" });
      const right = chunk7ZEDTSU3_cjs.line({ x1: w - barX, y1: 0, x2: w - barX, y2: h, class: "sx-fc-node-subline" });
      return body + left + right;
    }
    case "cylinder": {
      const ry = Math.min(8, h / 4);
      const silhouette = chunk7ZEDTSU3_cjs.path({
        d: `M0,${ry} A${w / 2},${ry} 0 0,1 ${w},${ry} L${w},${h - ry} A${w / 2},${ry} 0 0,1 0,${h - ry} Z`,
        class: "sx-fc-node"
      });
      const topRim = chunk7ZEDTSU3_cjs.path({
        d: `M0,${ry} A${w / 2},${ry} 0 0,0 ${w},${ry}`,
        class: "sx-fc-node-arc"
      });
      return silhouette + topRim;
    }
    case "circle": {
      const r = Math.min(w, h) / 2 - 1;
      return chunk7ZEDTSU3_cjs.circle({ cx: w / 2, cy: h / 2, r, class: "sx-fc-node sx-fc-node-circle" });
    }
    case "double-circle": {
      const r1 = Math.min(w, h) / 2 - 1;
      const r2 = r1 - 5;
      const outer = chunk7ZEDTSU3_cjs.circle({ cx: w / 2, cy: h / 2, r: r1, class: "sx-fc-node" });
      const inner = chunk7ZEDTSU3_cjs.circle({ cx: w / 2, cy: h / 2, r: r2, class: "sx-fc-node-ring" });
      return outer + inner;
    }
    case "hexagon": {
      const cut = Math.min(20, w / 4);
      const points = `${cut},0 ${w - cut},0 ${w},${h / 2} ${w - cut},${h} ${cut},${h} 0,${h / 2}`;
      return chunk7ZEDTSU3_cjs.polygon({ points, class: "sx-fc-node sx-fc-node-hexagon" });
    }
    case "asymmetric": {
      const pts = `0,0 ${w - 15},0 ${w},${h / 2} ${w - 15},${h} 0,${h}`;
      return chunk7ZEDTSU3_cjs.polygon({ points: pts, class: "sx-fc-node" });
    }
    default:
      return chunk7ZEDTSU3_cjs.rect({ x: 0, y: 0, width: w, height: h, rx: 14, ry: 14, class: "sx-fc-node" });
  }
}

// src/diagrams/flowchart/renderer.ts
var CSS_TEMPLATE = (themeName) => {
  const t = chunk7ZEDTSU3_cjs.resolveFlowchartTheme(themeName);
  const c = t.classes;
  return `
.sx-fc { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
.sx-fc-node { fill: ${t.fillMuted}; stroke: ${t.stroke}; stroke-width: 1.5; stroke-linejoin: round; }
.sx-fc-node-stadium { fill: ${t.stadiumFill}; stroke: ${t.stroke}; }
.sx-fc-node-diamond { fill: ${t.diamondFill}; stroke: ${t.stroke}; }
.sx-fc-node-round { fill: ${t.roundFill}; stroke: ${t.stroke}; }
.sx-fc-node-text { fill: ${t.text}; font: 12px system-ui, -apple-system, "Segoe UI", sans-serif; }
.sx-fc-icon { stroke: ${t.text}; fill: none; }
.sx-fc-icon-fill { fill: ${t.text}; stroke: none; }
/* Semantic class presets (applied via 'class A start') \u2014 override shape fills */
.sx-fc-class-start    > .sx-fc-node { fill: ${c.start.fill}; stroke: ${c.start.stroke}; }
.sx-fc-class-start    > .sx-fc-node-text { fill: ${c.start.text}; font-weight: 600; }
.sx-fc-class-process  > .sx-fc-node { fill: ${c.process.fill}; stroke: ${c.process.stroke}; }
.sx-fc-class-process  > .sx-fc-node-text { fill: ${c.process.text}; font-weight: 600; }
.sx-fc-class-decision > .sx-fc-node { fill: ${c.decision.fill}; stroke: ${c.decision.stroke}; }
.sx-fc-class-decision > .sx-fc-node-text { fill: ${c.decision.text}; font-weight: 600; }
.sx-fc-class-success  > .sx-fc-node { fill: ${c.success.fill}; stroke: ${c.success.stroke}; }
.sx-fc-class-success  > .sx-fc-node-text { fill: ${c.success.text}; font-weight: 600; }
.sx-fc-class-danger   > .sx-fc-node { fill: ${c.danger.fill}; stroke: ${c.danger.stroke}; }
.sx-fc-class-danger   > .sx-fc-node-text { fill: ${c.danger.text}; font-weight: 600; }
.sx-fc-class-neutral  > .sx-fc-node { fill: ${c.neutral.fill}; stroke: ${c.neutral.stroke}; }
.sx-fc-class-neutral  > .sx-fc-node-text { fill: ${c.neutral.text}; font-weight: 600; }
.sx-fc-edge { fill: none; stroke: ${t.neutral}; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
.sx-fc-edge-thick { stroke: ${t.stroke}; stroke-width: 2.4; }
.sx-fc-edge-dashed { stroke-dasharray: 5 3; }
.sx-fc-edge-dotted { stroke-dasharray: 1.5 3; }
.sx-fc-edge-label { fill: ${t.textMuted}; font: 11px system-ui, -apple-system, "Segoe UI", sans-serif; }
.sx-fc-edge-label-bg { fill: ${t.bg}; fill-opacity: 0.96; stroke: ${t.neutral}; stroke-width: 0.5; }
.sx-fc-title { fill: ${t.text}; font: 700 16px system-ui, -apple-system, "Segoe UI", sans-serif; }
/* Shape sub-elements */
.sx-fc-node-subline { fill: none; stroke: ${t.stroke}; stroke-width: 1.5; }
.sx-fc-node-arc { fill: none; stroke: ${t.stroke}; stroke-width: 1.5; }
.sx-fc-node-ring { fill: none; stroke: ${t.stroke}; stroke-width: 1.8; }
/* Cluster (subgraph) */
.sx-fc-cluster { fill: ${t.fillMuted}; fill-opacity: 0.35; stroke: ${t.neutral}; stroke-width: 1.5; stroke-dasharray: 5,3; }
.sx-fc-cluster-title { fill: ${t.textMuted}; font: 500 11px system-ui, -apple-system, "Segoe UI", sans-serif; }
`.trim();
};
var ARROW_MARKER = `
<marker id="sx-fc-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
  <path d="M0,0 L8,4 L0,8 L2,4 Z" fill="context-stroke"/>
</marker>
<marker id="sx-fc-arrow-o" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse">
  <circle cx="4" cy="4" r="3" fill="none" stroke="context-stroke" stroke-width="1"/>
</marker>
<marker id="sx-fc-arrow-x" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto" markerUnits="userSpaceOnUse">
  <path d="M1,1 L7,7 M1,7 L7,1" stroke="context-stroke" stroke-width="1.2"/>
</marker>
`.trim();
function edgeCssClass(edge) {
  const classes = ["sx-fc-edge"];
  if (edge.kind === "thick") classes.push("sx-fc-edge-thick");
  if (edge.kind === "dotted") classes.push("sx-fc-edge-dotted");
  return classes.join(" ");
}
function markerEndFor(edge) {
  switch (edge.arrowEnd) {
    case "arrow":
      return "url(#sx-fc-arrow)";
    case "circle":
      return "url(#sx-fc-arrow-o)";
    case "cross":
      return "url(#sx-fc-arrow-x)";
    default:
      return void 0;
  }
}
function markerStartFor(edge) {
  return edge.arrowStart === "arrow" ? "url(#sx-fc-arrow)" : void 0;
}
function renderCluster(lc, scene) {
  const sg = lc.subgraph;
  const bg = chunk7ZEDTSU3_cjs.rect({ x: lc.x, y: lc.y, width: lc.width, height: lc.height, rx: 8, class: "sx-fc-cluster" });
  const label = chunk7ZEDTSU3_cjs.text(
    { x: lc.x + 12, y: lc.y + 15, class: "sx-fc-cluster-title" },
    sg.label
  );
  const key = `group:${sg.id}`;
  scene?.push({
    key,
    kind: "group",
    semanticId: sg.id,
    label: sg.label,
    bbox: { x: lc.x, y: lc.y, width: lc.width, height: lc.height },
    editable: { label: false, position: "none" }
  });
  return chunk7ZEDTSU3_cjs.group(
    {
      "data-cluster-id": sg.id,
      "data-depth": lc.depth,
      "data-sx-key": scene ? key : void 0,
      class: "sx-fc-cluster-g"
    },
    [bg, label]
  );
}
function renderNode(ln, position, scene) {
  const n = ln.node;
  const key = `node:${n.id}`;
  const shapeEl = shapeSVG(n.shape, ln.width, ln.height);
  const iconBand = hasIcon(n.icon) ? ICON_SIZE + ICON_GAP : 0;
  let iconEl = "";
  if (iconBand > 0) {
    iconEl = chunk7ZEDTSU3_cjs.group(
      { transform: `translate(${fmt2(ln.width / 2)} ${fmt2(8 + ICON_SIZE / 2)})` },
      [renderIcon(n.icon)]
    );
  }
  const labelCy = iconBand > 0 ? iconBand + (ln.height - iconBand) / 2 : ln.height / 2;
  const label = chunk7ZEDTSU3_cjs.multilineText(
    {
      x: ln.width / 2,
      y: labelCy,
      class: "sx-fc-node-text",
      "text-anchor": "middle",
      "dominant-baseline": "central",
      "data-sx-role": scene && n.labelSourceRange ? "label" : void 0
    },
    n.label
  );
  const plainLabel = n.label.replace(/<br\s*\/?>/gi, " ").replace(/<\/?[bi]>/gi, "");
  const nodeTitle = chunk7ZEDTSU3_cjs.title(plainLabel);
  const classAttr = ["sx-fc-node-g", ...(n.classes ?? []).map((c) => `sx-fc-class-${c}`)].join(" ");
  scene?.push({
    key,
    kind: "node",
    semanticId: n.id,
    label: n.label,
    sourceRange: n.labelSourceRange,
    bbox: { x: ln.x, y: ln.y, width: ln.width, height: ln.height },
    editable: { label: n.labelSourceRange !== void 0, position }
  });
  return chunk7ZEDTSU3_cjs.group(
    {
      "data-node-id": n.id,
      "data-shape": n.shape,
      "data-layer": ln.layer,
      "data-classes": n.classes?.join(" "),
      "data-sx-key": scene ? key : void 0,
      class: classAttr,
      transform: `translate(${fmt2(ln.x)} ${fmt2(ln.y)})`
    },
    [shapeEl, iconEl, label, nodeTitle].filter((sEl) => sEl.length > 0)
  );
}
function renderEdge(le, scene) {
  const e = le.edge;
  const index = le.index ?? 0;
  const key = `edge:${index}`;
  const labelKey = `${key}:label`;
  const attrs = {
    d: le.path,
    class: edgeCssClass(e)
  };
  const me = markerEndFor(e);
  const ms = markerStartFor(e);
  if (me) attrs["marker-end"] = me;
  if (ms) attrs["marker-start"] = ms;
  const p = chunk7ZEDTSU3_cjs.path(attrs);
  const labelEl = e.label && le.labelAnchor ? renderEdgeLabel(
    e.label,
    le.labelAnchor.x,
    le.labelAnchor.y,
    le.labelAnchor.textAnchor ?? "middle",
    scene ? labelKey : void 0
  ) : "";
  const edgeTitle = chunk7ZEDTSU3_cjs.title(
    e.label ? `${e.from} \u2192 ${e.to}: ${e.label}` : `${e.from} \u2192 ${e.to}`
  );
  scene?.push({
    key,
    kind: "edge",
    semanticId: e.id,
    path: le.path,
    editable: { label: false, position: "none" }
  });
  if (scene && e.label && le.labelAnchor) {
    const labelWidth = Math.max(20, e.label.length * 6.5 + 10);
    const textAnchor = le.labelAnchor.textAnchor ?? "middle";
    const x = le.labelAnchor.x - (textAnchor === "start" ? 0 : textAnchor === "end" ? labelWidth : labelWidth / 2);
    scene.push({
      key: labelKey,
      kind: "label",
      label: e.label,
      sourceRange: e.labelSourceRange,
      bbox: { x, y: le.labelAnchor.y - 8, width: labelWidth, height: 16 },
      editable: { label: e.labelSourceRange !== void 0, position: "none" }
    });
  }
  return chunk7ZEDTSU3_cjs.group(
    {
      "data-edge-id": e.id ?? `${e.from}->${e.to}`,
      "data-edge-index": le.index,
      "data-kind": e.kind,
      "data-from": e.from,
      "data-to": e.to,
      "data-sx-key": scene ? key : void 0
    },
    [p, edgeTitle, labelEl].filter((s2) => s2.length > 0)
  );
}
function renderEdgeLabel(label, cx, cy, textAnchor, sceneKey) {
  const w = Math.max(20, label.length * 6.5 + 10);
  const h = 16;
  const rx = cx - (textAnchor === "start" ? 0 : textAnchor === "end" ? w : w / 2);
  const ry = cy - h / 2;
  const bg = chunk7ZEDTSU3_cjs.rect({
    x: rx,
    y: ry,
    width: w,
    height: h,
    rx: 3,
    class: "sx-fc-edge-label-bg"
  });
  const t = chunk7ZEDTSU3_cjs.text(
    {
      x: cx,
      y: cy,
      class: "sx-fc-edge-label",
      "text-anchor": textAnchor,
      "dominant-baseline": "central",
      "data-sx-key": sceneKey,
      "data-sx-role": sceneKey ? "label" : void 0
    },
    label
  );
  return chunk7ZEDTSU3_cjs.group({ class: "sx-fc-edge-label-g" }, [bg, t]);
}
function fmt2(n) {
  return (Math.round(n * 100) / 100).toString();
}
function renderFlowchartAST(ast, themeName = "default", config) {
  const layout = layoutFlowchart(ast, config?.__pins);
  const position = "free";
  const clusterSvg = layout.clusters.map((cluster) => renderCluster(cluster, config?.__scene));
  const nodeSvg = layout.nodes.map((node) => renderNode(node, position, config?.__scene));
  const edgeSvg = layout.edges.map((edge) => renderEdge(edge, config?.__scene));
  const nodeStyleOverrides = ast.nodes.filter((n) => n.style && Object.keys(n.style).length > 0).map((n) => {
    const props = Object.entries(n.style).map(([k, v]) => `${k}:${v}`).join(";");
    return `g[data-node-id="${n.id}"] .sx-fc-node { ${props} }`;
  }).join("\n");
  const classDefOverrides = ast.classDefs.map((cd) => {
    const props = Object.entries(cd.props).map(([k, v]) => `${k}:${v}`).join(";");
    return `.sx-fc-class-${cd.id} > .sx-fc-node { ${props} }`;
  }).join("\n");
  const linkStyleOverrides = Array.from(ast.linkStyles.entries()).map(([idx, props]) => {
    const cssProps = Object.entries(props).map(([k, v]) => `${k}:${v}`).join(";");
    return `g[data-edge-index="${idx}"] path { ${cssProps} }`;
  }).join("\n");
  const titleScene = ast.title ? chunkEQMWWNB3_cjs.resolveSceneTitle(
    ast.title,
    ast.titleSourceRange,
    (layout.viewBox?.x ?? 0) + layout.width / 2,
    16,
    config
  ) : void 0;
  const titleBlock = ast.title && titleScene ? chunk7ZEDTSU3_cjs.text(
    {
      x: titleScene.x,
      y: titleScene.y,
      class: "sx-fc-title",
      "text-anchor": "middle",
      ...titleScene.attrs
    },
    ast.title
  ) : "";
  const cssOverrides = [nodeStyleOverrides, classDefOverrides, linkStyleOverrides].filter((s2) => s2.length > 0).join("\n");
  const headMeta = [
    chunk7ZEDTSU3_cjs.title(ast.title ? `${ast.title} \u2014 Flowchart` : "Flowchart"),
    chunk7ZEDTSU3_cjs.desc(
      `Flowchart with ${ast.nodes.length} node${ast.nodes.length === 1 ? "" : "s"} and ${ast.edges.length} edge${ast.edges.length === 1 ? "" : "s"}.`
    ),
    chunk7ZEDTSU3_cjs.el("style", {}, CSS_TEMPLATE(themeName) + (cssOverrides ? "\n" + cssOverrides : "")),
    chunk7ZEDTSU3_cjs.defs([ARROW_MARKER])
  ];
  const content = [];
  if (clusterSvg.length > 0) content.push(chunk7ZEDTSU3_cjs.group({ class: "sx-fc-clusters" }, clusterSvg));
  content.push(chunk7ZEDTSU3_cjs.group({ class: "sx-fc-edges" }, edgeSvg));
  content.push(chunk7ZEDTSU3_cjs.group({ class: "sx-fc-nodes" }, nodeSvg));
  const hasClusters = layout.clusters.length > 0;
  const topPad = ast.title ? hasClusters ? 56 : 24 : 0;
  const totalH = layout.height + topPad;
  const viewBox = layout.viewBox ?? { x: 0, y: 0, width: layout.width, height: layout.height };
  const titleSvg = titleBlock;
  return chunk7ZEDTSU3_cjs.svgRoot(
    {
      viewBox: `${fmt2(viewBox.x)} ${fmt2(viewBox.y)} ${fmt2(viewBox.width)} ${fmt2(viewBox.height + topPad)}`,
      width: fmt2(layout.width),
      height: fmt2(totalH),
      class: "sx-fc",
      "data-diagram-type": "flowchart",
      "data-direction": layout.direction,
      role: "graphics-document"
    },
    topPad > 0 ? config?.__scene ? [...headMeta, chunk7ZEDTSU3_cjs.group({ transform: `translate(0 ${topPad})` }, content), titleSvg] : [...headMeta, titleSvg, chunk7ZEDTSU3_cjs.group({ transform: `translate(0 ${topPad})` }, content)] : config?.__scene ? [...headMeta, ...content, titleSvg] : [...headMeta, titleSvg, ...content]
  );
}
function renderFlowchart(text2, themeName = "default", config) {
  const ast = parseFlowchart(text2);
  return renderFlowchartAST(ast, themeName, config);
}

// src/diagrams/flowchart/index.ts
var flowchart = {
  type: "flowchart",
  capabilities: { scene: true, editablePosition: true },
  detect(text2) {
    const first = chunkVGO4AJ4K_cjs.firstContentLine(text2)?.split(/\s+/)[0]?.toLowerCase() ?? "";
    return first === "flowchart" || first === "graph";
  },
  parse: parseFlowchart,
  render(text2, config) {
    const themeName = config?.theme ?? "default";
    return renderFlowchart(text2, themeName, config);
  }
};

exports.FC_CONST = FC_CONST;
exports.flowchart = flowchart;
exports.iconNames = iconNames;
exports.layoutFlowchart = layoutFlowchart;
exports.parseFlowchart = parseFlowchart;
exports.renderFlowchart = renderFlowchart;
exports.renderFlowchartAST = renderFlowchartAST;
exports.renderIcon = renderIcon;
//# sourceMappingURL=chunk-GUCP6AKN.cjs.map
//# sourceMappingURL=chunk-GUCP6AKN.cjs.map