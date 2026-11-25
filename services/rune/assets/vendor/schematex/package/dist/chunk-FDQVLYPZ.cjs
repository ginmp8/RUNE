'use strict';

var chunkVGO4AJ4K_cjs = require('./chunk-VGO4AJ4K.cjs');
var chunk54Q7JDQB_cjs = require('./chunk-54Q7JDQB.cjs');
var chunkSBB6C4OP_cjs = require('./chunk-SBB6C4OP.cjs');
var chunk4M6OFAHM_cjs = require('./chunk-4M6OFAHM.cjs');
var chunk7ZEDTSU3_cjs = require('./chunk-7ZEDTSU3.cjs');

// src/diagrams/ladder/parser.ts
var LadderParseError = class extends Error {
  constructor(message, line, column, source) {
    super(line !== void 0 ? `Line ${line}: ${message}` : message);
    this.line = line;
    this.column = column;
    this.source = source;
    this.name = "LadderParseError";
  }
  line;
  column;
  source;
};
var CONTACT_TYPES = /* @__PURE__ */ new Set(["XIC", "XIO", "ONS", "OSF"]);
var COIL_TYPES = /* @__PURE__ */ new Set(["OTE", "OTL", "OTU", "OTN", "RES"]);
var FB_TYPES = /* @__PURE__ */ new Set([
  "TON",
  "TOFF",
  "TP",
  "CTU",
  "CTD",
  "CTUD",
  "ADD",
  "SUB",
  "MUL",
  "DIV",
  "MOV",
  "EQU",
  "NEQ",
  "GRT",
  "LES",
  "GEQ",
  "LEQ"
]);
var ALL_ELEMENT_TYPES = [
  ...CONTACT_TYPES,
  ...COIL_TYPES,
  ...FB_TYPES
];
function splitArgs(s) {
  const out = [];
  let cur = "";
  let inQuote = false;
  for (const ch of s) {
    if (ch === '"') inQuote = !inQuote;
    if (ch === "," && !inQuote) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
function stripQuotes(v) {
  const t = v.trim();
  if (t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1);
  return t;
}
function splitOpAndArgs(line) {
  const opMatch = line.match(/^([A-Z][A-Z0-9_]*)\s*\(/);
  if (!opMatch) return null;
  const op = opMatch[1];
  const start = opMatch[0].length;
  let depth = 1;
  let inQuote = false;
  let end = -1;
  for (let i = start; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i - 1] !== "\\") {
      inQuote = !inQuote;
      continue;
    }
    if (inQuote) continue;
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) return null;
  if (line.slice(end + 1).trim() !== "") return null;
  return { op, inside: line.slice(start, end) };
}
function parseElement(line, lineNo) {
  const m = splitOpAndArgs(line);
  if (!m) {
    throw new LadderParseError(`invalid element syntax: ${line}`, lineNo, void 0, line);
  }
  const op = m.op;
  const args = splitArgs(m.inside);
  if (args.length === 0 || !args[0]) {
    throw new LadderParseError(`element missing tag: ${line}`, lineNo, void 0, line);
  }
  const tag = args[0];
  if (CONTACT_TYPES.has(op)) {
    const contact = {
      elementType: "contact",
      contactType: op,
      tag
    };
    for (let i = 1; i < args.length; i++) {
      const a = args[i];
      const kv = a.match(/^(\w+)\s*=\s*(.+)$/);
      if (kv) {
        const key = kv[1].toLowerCase();
        if (key === "address") contact.address = stripQuotes(kv[2]);
        else if (key === "name") contact.name = stripQuotes(kv[2]);
      } else {
        contact.address = stripQuotes(a);
      }
    }
    return contact;
  }
  if (COIL_TYPES.has(op)) {
    const coil = {
      elementType: "coil",
      coilType: op,
      tag
    };
    for (let i = 1; i < args.length; i++) {
      const a = args[i];
      const kv = a.match(/^(\w+)\s*=\s*(.+)$/);
      if (kv) {
        const key = kv[1].toLowerCase();
        if (key === "address") coil.address = stripQuotes(kv[2]);
        else if (key === "name") coil.name = stripQuotes(kv[2]);
      } else {
        coil.address = stripQuotes(a);
      }
    }
    return coil;
  }
  if (FB_TYPES.has(op)) {
    const params = {};
    for (let i = 1; i < args.length; i++) {
      const a = args[i];
      const kv = a.match(/^(\w+)\s*=\s*(.+)$/);
      if (kv) {
        const v = stripQuotes(kv[2]);
        const n = Number(v);
        params[kv[1]] = Number.isFinite(n) && v !== "" && /^-?\d+(\.\d+)?$/.test(v) ? n : v;
      }
    }
    const fb = {
      elementType: "function_block",
      fbType: op,
      tag,
      params
    };
    return fb;
  }
  throw new LadderParseError(
    `unknown element type "${op}"${chunkSBB6C4OP_cjs.didYouMean(op, ALL_ELEMENT_TYPES)}`,
    lineNo,
    void 0,
    line
  );
}
function parseLadderDSL(text2) {
  const rawLines = text2.split("\n").map((l) => l.replace(/\r$/, ""));
  let title2;
  const rungs = [];
  let currentRung = null;
  let currentParallel = null;
  let currentBranch = null;
  let parallelIndent = -1;
  let branchIndent = -1;
  function finishParallel() {
    if (currentRung && currentParallel) {
      currentRung.elements.push({ parallel: currentParallel });
    }
    currentParallel = null;
    currentBranch = null;
    parallelIndent = -1;
    branchIndent = -1;
  }
  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    const lineNo = i + 1;
    const stripped = raw.replace(/(#|\/\/|%%).*$/, "");
    if (!stripped.trim()) continue;
    let indent = 0;
    for (const ch of stripped) {
      if (ch === " ") indent++;
      else if (ch === "	") indent += 2;
      else break;
    }
    const line = stripped.trim();
    if (/^ladder\b/i.test(line)) {
      const t = chunk4M6OFAHM_cjs.matchQuotedTitle(line);
      if (t !== void 0) title2 = t;
      continue;
    }
    const rungMatch = line.match(/^rung\s+(\d+)(?:\s+"([^"]*)")?\s*:?\s*$/i);
    if (rungMatch) {
      finishParallel();
      if (currentRung) {
        if (currentRung.elements.length === 0) {
          throw new LadderParseError(`Rung ${currentRung.number}: empty rung`);
        }
        rungs.push(currentRung);
      }
      currentRung = {
        number: Number(rungMatch[1]),
        comment: rungMatch[2],
        elements: []
      };
      continue;
    }
    if (!currentRung) {
      throw new LadderParseError(`element outside of rung: ${line}`, lineNo, void 0, line);
    }
    if (/^parallel\s*:\s*$/i.test(line)) {
      finishParallel();
      currentParallel = [];
      parallelIndent = indent;
      continue;
    }
    if (/^branch\s*:\s*$/i.test(line)) {
      if (!currentParallel) {
        throw new LadderParseError(`branch: without parallel:`, lineNo, void 0, line);
      }
      currentBranch = { elements: [] };
      currentParallel.push(currentBranch);
      branchIndent = indent;
      continue;
    }
    if (currentParallel && indent <= parallelIndent) {
      finishParallel();
    }
    const element = parseElement(line, lineNo);
    if (currentParallel && currentBranch && indent > branchIndent) {
      currentBranch.elements.push(element);
    } else {
      if (currentParallel) finishParallel();
      currentRung.elements.push(element);
    }
  }
  finishParallel();
  if (currentRung) {
    if (currentRung.elements.length === 0) {
      throw new LadderParseError(`Rung ${currentRung.number}: empty rung`);
    }
    rungs.push(currentRung);
  }
  if (rungs.length === 0) {
    throw new LadderParseError("Ladder diagram has no rungs");
  }
  return { type: "ladder", title: title2, rungs };
}

// src/diagrams/ladder/layout.ts
var LEFT_RAIL_X = 60;
var RIGHT_RAIL_MARGIN = 30;
var BASE_RUNG_HEIGHT = 100;
var ELEMENT_WIDTH = 32;
var ELEMENT_HEIGHT = 24;
var FB_WIDTH = 80;
var FB_HEIGHT = 56;
var CMP_WIDTH = 56;
var CMP_HEIGHT = 34;
var RUNG_Y_OFFSET = 70;
var H_SPACING = 16;
var PARALLEL_GAP = 14;
var CANVAS_PADDING = 30;
var CHAR_W = 6.1;
var LINE_H = 11;
var COMPARE_TYPES = /* @__PURE__ */ new Set(["EQU", "NEQ", "GRT", "LES", "GEQ", "LEQ"]);
function bodyWidth(el2) {
  if (el2.elementType === "function_block") {
    if (COMPARE_TYPES.has(el2.fbType)) return CMP_WIDTH;
    return FB_WIDTH;
  }
  return ELEMENT_WIDTH;
}
function bodyHeight(el2) {
  if (el2.elementType === "function_block") {
    if (COMPARE_TYPES.has(el2.fbType)) return CMP_HEIGHT;
    return FB_HEIGHT;
  }
  return ELEMENT_HEIGHT;
}
function elementKind(el2) {
  if (el2.elementType === "contact") return "contact";
  if (el2.elementType === "coil") return "coil";
  if (COMPARE_TYPES.has(el2.fbType)) return "compare";
  return "function_block";
}
function wrapName(name, maxChars = 14) {
  const words = name.split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? `${cur} ${w}` : w;
    if (trial.length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = trial;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}
function labelLinesForContactOrCoil(el2) {
  if (el2.elementType === "function_block") return [el2.tag];
  const lines = [];
  if (el2.name) lines.push(...wrapName(el2.name));
  lines.push(el2.tag);
  if (el2.address) lines.push(el2.address);
  return lines;
}
function labelWidth(el2) {
  const lines = labelLinesForContactOrCoil(el2);
  let maxChars = 0;
  for (const l of lines) if (l.length > maxChars) maxChars = l.length;
  return maxChars * CHAR_W;
}
function slotWidth(el2) {
  return Math.max(bodyWidth(el2), labelWidth(el2)) + 6;
}
function labelRowsAbove(el2) {
  if (el2.elementType === "function_block") return 1;
  const name = el2.name ? wrapName(el2.name).length : 0;
  return name + 1;
}
function labelRowsBelow(el2) {
  if (el2.elementType === "function_block") return 0;
  if (el2.address) return 1;
  return 0;
}
function rungLabelHeaderHeight(rung) {
  let maxAbovePx = 0;
  for (const item of rung.elements) {
    if ("parallel" in item) {
      const ph = parallelHeight(item.parallel);
      const topBranch = item.parallel[0];
      if (!topBranch) continue;
      const aboveRows = Math.max(
        1,
        ...topBranch.elements.map((e) => labelRowsAbove(e))
      );
      const px = ph / 2 + aboveRows * LINE_H + 4;
      if (px > maxAbovePx) maxAbovePx = px;
    } else {
      const rows = labelRowsAbove(item);
      const px = bodyHeight(item) / 2 + rows * LINE_H + 4;
      if (px > maxAbovePx) maxAbovePx = px;
    }
  }
  return maxAbovePx;
}
function rungLabelFooterHeight(rung) {
  let maxBelowPx = 0;
  for (const item of rung.elements) {
    if ("parallel" in item) {
      const ph = parallelHeight(item.parallel);
      const bottomBranch = item.parallel[item.parallel.length - 1];
      if (!bottomBranch) continue;
      const belowRows = Math.max(
        0,
        ...bottomBranch.elements.map((e) => labelRowsBelow(e))
      );
      const px = ph / 2 + belowRows * LINE_H + 4;
      if (px > maxBelowPx) maxBelowPx = px;
    } else {
      const rows = labelRowsBelow(item);
      const px = bodyHeight(item) / 2 + rows * LINE_H + 4;
      if (px > maxBelowPx) maxBelowPx = px;
    }
  }
  return maxBelowPx;
}
function branchInlineWidth(branch) {
  if (branch.elements.length === 0) return ELEMENT_WIDTH;
  let w = 0;
  branch.elements.forEach((el2, i) => {
    w += slotWidth(el2);
    if (i < branch.elements.length - 1) w += H_SPACING;
  });
  return w;
}
function parallelWidth(branches) {
  const maxBranch = Math.max(
    ELEMENT_WIDTH,
    ...branches.map(branchInlineWidth)
  );
  return maxBranch + 2 * H_SPACING;
}
function branchRowHeight(branch) {
  const bodyH = Math.max(
    ELEMENT_HEIGHT,
    ...branch.elements.map((e) => bodyHeight(e))
  );
  const above = Math.max(1, ...branch.elements.map((e) => labelRowsAbove(e)));
  const below = Math.max(0, ...branch.elements.map((e) => labelRowsBelow(e)));
  return bodyH + above * LINE_H + below * LINE_H + 6;
}
function parallelHeight(branches) {
  let total = 0;
  branches.forEach((br, i) => {
    total += branchRowHeight(br);
    if (i < branches.length - 1) total += PARALLEL_GAP;
  });
  return Math.max(total, ELEMENT_HEIGHT);
}
function layoutLadder(ast) {
  const nodes = [];
  const wires = [];
  const rungs = [];
  let maxEndX = LEFT_RAIL_X + 200;
  let cursorY = RUNG_Y_OFFSET;
  ast.rungs.forEach((rung, rungIndex) => {
    const headerH = rungLabelHeaderHeight(rung);
    const footerH = rungLabelFooterHeight(rung);
    const rungHeight = Math.max(BASE_RUNG_HEIGHT, 16 + headerH + footerH + 16);
    const rungY = cursorY + 16 + headerH;
    let x = LEFT_RAIL_X + H_SPACING;
    let prevRightX = LEFT_RAIL_X;
    let prevRightY = rungY;
    const addWire = (x1, y1, x2, y2) => {
      wires.push({ path: `M ${x1} ${y1} L ${x2} ${y2}` });
    };
    rung.elements.forEach((item, elIdx) => {
      if ("parallel" in item) {
        const branches = item.parallel;
        const pw = parallelWidth(branches);
        const ph = parallelHeight(branches);
        const bx = x;
        const ex = x + pw;
        addWire(prevRightX, prevRightY, bx, rungY);
        const busTop = rungY - ph / 2;
        const busBot = rungY + ph / 2;
        wires.push({ path: `M ${bx} ${busTop} L ${bx} ${busBot}` });
        wires.push({ path: `M ${ex} ${busTop} L ${ex} ${busBot}` });
        let rowY = busTop;
        branches.forEach((branch, bIdx) => {
          const rowH = branchRowHeight(branch);
          const bodyMax = Math.max(
            ELEMENT_HEIGHT,
            ...branch.elements.map((e) => bodyHeight(e))
          );
          const above = Math.max(
            1,
            ...branch.elements.map((e) => labelRowsAbove(e))
          );
          const branchY = rowY + above * LINE_H + bodyMax / 2;
          const bInline = branchInlineWidth(branch);
          const startX = bx + H_SPACING + (ex - bx - 2 * H_SPACING - bInline) / 2;
          let bx0 = startX;
          let prevBX = bx;
          branch.elements.forEach((bel, beIdx) => {
            const w2 = bodyWidth(bel);
            const h2 = bodyHeight(bel);
            const slot2 = slotWidth(bel);
            const nx2 = bx0 + (slot2 - w2) / 2;
            const ny2 = branchY - h2 / 2;
            const id2 = `R${rung.number}_P${elIdx}_B${bIdx}_E${beIdx}`;
            nodes.push({
              id: id2,
              rungIndex,
              element: bel,
              kind: elementKind(bel),
              x: nx2,
              y: ny2,
              width: w2,
              height: h2,
              rungY: branchY
            });
            addWire(prevBX, branchY, nx2, branchY);
            prevBX = nx2 + w2;
            bx0 += slot2 + H_SPACING;
          });
          addWire(prevBX, branchY, ex, branchY);
          rowY += rowH + PARALLEL_GAP;
        });
        prevRightX = ex;
        prevRightY = rungY;
        x = ex + H_SPACING;
        return;
      }
      const el2 = item;
      const w = bodyWidth(el2);
      const h = bodyHeight(el2);
      const slot = slotWidth(el2);
      const nx = x + (slot - w) / 2;
      const ny = rungY - h / 2;
      const id = `R${rung.number}_E${elIdx}`;
      nodes.push({
        id,
        rungIndex,
        element: el2,
        kind: elementKind(el2),
        x: nx,
        y: ny,
        width: w,
        height: h,
        rungY
      });
      addWire(prevRightX, prevRightY, nx, rungY);
      prevRightX = nx + w;
      prevRightY = rungY;
      x += slot + H_SPACING;
    });
    rungs.push({
      rung,
      index: rungIndex,
      y: rungY,
      endX: prevRightX,
      height: rungHeight,
      headerHeight: headerH
    });
    if (prevRightX > maxEndX) maxEndX = prevRightX;
    cursorY += rungHeight;
  });
  const rightRailX = maxEndX + H_SPACING * 2;
  const width = rightRailX + RIGHT_RAIL_MARGIN;
  const height = cursorY + CANVAS_PADDING;
  for (const r of rungs) {
    wires.push({ path: `M ${r.endX} ${r.y} L ${rightRailX} ${r.y}` });
  }
  return {
    width,
    height,
    leftRailX: LEFT_RAIL_X,
    rightRailX,
    rungs,
    nodes,
    wires
  };
}

// src/diagrams/ladder/renderer.ts
function buildCss(t) {
  return `
.lt-ladder { font-family: system-ui, -apple-system, sans-serif; }
.lt-ladder-rail { stroke: ${t.strokeHeavy}; stroke-width: 4; stroke-linecap: square; }
.lt-ladder-wire { stroke: ${t.stroke}; stroke-width: 1.5; fill: none; }
.lt-ladder-element { stroke: ${t.stroke}; stroke-width: 2; fill: none; }
.lt-ladder-coil { stroke: ${t.stroke}; stroke-width: 2; fill: none; }
.lt-ladder-fb { fill: ${t.bg}; stroke: ${t.stroke}; stroke-width: 2; }
.lt-ladder-fb-name { font: bold 11px sans-serif; fill: ${t.text}; text-anchor: middle; }
.lt-ladder-pin { font: 8px sans-serif; fill: ${t.stroke}; }
.lt-ladder-name { font: 9px sans-serif; fill: ${t.text}; text-anchor: middle; }
.lt-ladder-tag { font: 600 9px ui-monospace, SFMono-Regular, Menlo, monospace; fill: ${t.accent}; text-anchor: middle; }
.lt-ladder-addr { font: 600 8.5px ui-monospace, monospace; fill: ${t.error}; text-anchor: middle; }
.lt-ladder-rung-num { font: 10px sans-serif; fill: ${t.textMuted}; text-anchor: end; }
.lt-ladder-comment { font: italic 10px sans-serif; fill: ${t.textMuted}; }
.lt-ladder-title { font: 700 16px sans-serif; fill: ${t.text}; }
.lt-ladder-symbol-label { font: bold 10px sans-serif; fill: ${t.stroke}; text-anchor: middle; }
.lt-ladder-rung-handle { fill: ${t.bg}; stroke: #2563eb; stroke-width: 1.5; rx: 3; }
.lt-ladder-rung-grip { fill: #2563eb; }
`.trim();
}
function rungSourceBlocks(source) {
  if (!source) return [];
  const locator = chunk54Q7JDQB_cjs.createSourceLocator(source);
  const starts = [];
  let offset = 0;
  for (const rawLine of source.split(/\n/)) {
    if (/^\s*rung\s+\S+/i.test(rawLine.replace(/\r$/, ""))) starts.push(offset);
    offset += rawLine.length + 1;
  }
  return starts.map((start, index) => locator.range(start, starts[index + 1] ?? source.length));
}
var LINE_H2 = 11;
function labelsAbove(name, tag, cx, bodyTopY) {
  const pieces = [];
  const nameLines = name ? wrapName(name) : [];
  const totalLines = nameLines.length + 1;
  const firstY = bodyTopY - 4 - (totalLines - 1) * LINE_H2;
  nameLines.forEach((line, i) => {
    pieces.push(
      chunk7ZEDTSU3_cjs.text({ x: cx, y: firstY + i * LINE_H2, class: "lt-ladder-name" }, line)
    );
  });
  pieces.push(
    chunk7ZEDTSU3_cjs.text(
      { x: cx, y: firstY + nameLines.length * LINE_H2, class: "lt-ladder-tag" },
      tag
    )
  );
  return pieces;
}
function renderContact(node) {
  const c = node.element;
  const { x, y, width: w, height: h } = node;
  const cy = y + h / 2;
  const leftBarX = x + 4;
  const rightBarX = x + w - 4;
  const cx = x + w / 2;
  const pieces = [];
  pieces.push(chunk7ZEDTSU3_cjs.el("line", { x1: x, y1: cy, x2: leftBarX, y2: cy, class: "lt-ladder-wire" }));
  pieces.push(chunk7ZEDTSU3_cjs.el("line", { x1: rightBarX, y1: cy, x2: x + w, y2: cy, class: "lt-ladder-wire" }));
  pieces.push(chunk7ZEDTSU3_cjs.el("line", { x1: leftBarX, y1: y, x2: leftBarX, y2: y + h, class: "lt-ladder-element" }));
  pieces.push(chunk7ZEDTSU3_cjs.el("line", { x1: rightBarX, y1: y, x2: rightBarX, y2: y + h, class: "lt-ladder-element" }));
  if (c.contactType === "XIO") {
    pieces.push(
      chunk7ZEDTSU3_cjs.el("line", {
        x1: leftBarX + 2,
        y1: y + h - 2,
        x2: rightBarX - 2,
        y2: y + 2,
        class: "lt-ladder-element"
      })
    );
  } else if (c.contactType === "ONS") {
    pieces.push(chunk7ZEDTSU3_cjs.text({ x: cx, y: cy + 3, class: "lt-ladder-symbol-label" }, "\u2191"));
  } else if (c.contactType === "OSF") {
    pieces.push(chunk7ZEDTSU3_cjs.text({ x: cx, y: cy + 3, class: "lt-ladder-symbol-label" }, "\u2193"));
  }
  pieces.push(...labelsAbove(c.name, c.tag, cx, y));
  if (c.address) {
    pieces.push(
      chunk7ZEDTSU3_cjs.text({ x: cx, y: y + h + 10, class: "lt-ladder-addr" }, c.address)
    );
  }
  return chunk7ZEDTSU3_cjs.group({ "data-element": "contact", "data-tag": c.tag }, pieces);
}
function renderCoil(node) {
  const c = node.element;
  const { x, y, width: w, height: h } = node;
  const cy = y + h / 2;
  const cx = x + w / 2;
  const pieces = [];
  const leftArc = `M ${x + 6} ${y} A 10 ${h / 2} 0 0 0 ${x + 6} ${y + h}`;
  const rightArc = `M ${x + w - 6} ${y} A 10 ${h / 2} 0 0 1 ${x + w - 6} ${y + h}`;
  pieces.push(chunk7ZEDTSU3_cjs.path({ d: leftArc, class: "lt-ladder-coil" }));
  pieces.push(chunk7ZEDTSU3_cjs.path({ d: rightArc, class: "lt-ladder-coil" }));
  pieces.push(chunk7ZEDTSU3_cjs.el("line", { x1: x, y1: cy, x2: x + 6, y2: cy, class: "lt-ladder-wire" }));
  pieces.push(chunk7ZEDTSU3_cjs.el("line", { x1: x + w - 6, y1: cy, x2: x + w, y2: cy, class: "lt-ladder-wire" }));
  let inner = "";
  if (c.coilType === "OTL") inner = "S";
  else if (c.coilType === "OTU") inner = "R";
  else if (c.coilType === "OTN") inner = "/";
  else if (c.coilType === "RES") inner = "R";
  if (inner) {
    pieces.push(chunk7ZEDTSU3_cjs.text({ x: cx, y: cy + 3, class: "lt-ladder-symbol-label" }, inner));
  }
  pieces.push(...labelsAbove(c.name, c.tag, cx, y));
  if (c.address) {
    pieces.push(
      chunk7ZEDTSU3_cjs.text({ x: cx, y: y + h + 10, class: "lt-ladder-addr" }, c.address)
    );
  }
  return chunk7ZEDTSU3_cjs.group({ "data-element": "coil", "data-tag": c.tag }, pieces);
}
function renderCompare(node) {
  const fb = node.element;
  const { x, y, width: w, height: h } = node;
  const cy = y + h / 2;
  const cx = x + w / 2;
  const pieces = [];
  pieces.push(chunk7ZEDTSU3_cjs.el("rect", { x, y, width: w, height: h, class: "lt-ladder-fb" }));
  pieces.push(chunk7ZEDTSU3_cjs.text({ x: cx, y: y + 12, class: "lt-ladder-fb-name" }, fb.fbType));
  const entries = Object.entries(fb.params);
  entries.slice(0, 2).forEach(([k, v], i) => {
    pieces.push(
      chunk7ZEDTSU3_cjs.text({ x: x + 4, y: y + 22 + i * 9, class: "lt-ladder-pin" }, `${k}:${v}`)
    );
  });
  pieces.push(chunk7ZEDTSU3_cjs.el("line", { x1: x - 2, y1: cy, x2: x, y2: cy, class: "lt-ladder-wire" }));
  pieces.push(chunk7ZEDTSU3_cjs.el("line", { x1: x + w, y1: cy, x2: x + w + 2, y2: cy, class: "lt-ladder-wire" }));
  pieces.push(chunk7ZEDTSU3_cjs.text({ x: cx, y: y - 4, class: "lt-ladder-tag" }, fb.tag));
  return chunk7ZEDTSU3_cjs.group({ "data-element": "compare", "data-tag": fb.tag }, pieces);
}
function renderFunctionBlock(node) {
  const fb = node.element;
  const { x, y, width: w, height: h } = node;
  const cy = y + h / 2;
  const cx = x + w / 2;
  const pieces = [];
  pieces.push(chunk7ZEDTSU3_cjs.el("rect", { x, y, width: w, height: h, class: "lt-ladder-fb" }));
  pieces.push(chunk7ZEDTSU3_cjs.text({ x: cx, y: y + 14, class: "lt-ladder-fb-name" }, fb.fbType));
  pieces.push(
    chunk7ZEDTSU3_cjs.el("line", { x1: x - 6, y1: cy, x2: x, y2: cy, class: "lt-ladder-wire" })
  );
  pieces.push(
    chunk7ZEDTSU3_cjs.el("line", { x1: x + w, y1: cy, x2: x + w + 6, y2: cy, class: "lt-ladder-wire" })
  );
  const entries = Object.entries(fb.params);
  entries.slice(0, 3).forEach(([k, v], i) => {
    pieces.push(
      chunk7ZEDTSU3_cjs.text({ x: x + 4, y: y + 28 + i * 9, class: "lt-ladder-pin" }, `${k}=${v}`)
    );
  });
  pieces.push(chunk7ZEDTSU3_cjs.text({ x: cx, y: y - 4, class: "lt-ladder-tag" }, fb.tag));
  return chunk7ZEDTSU3_cjs.group({ "data-element": "function_block", "data-tag": fb.tag }, pieces);
}
function renderNode(node) {
  switch (node.kind) {
    case "contact":
      return renderContact(node);
    case "coil":
      return renderCoil(node);
    case "compare":
      return renderCompare(node);
    case "function_block":
      return renderFunctionBlock(node);
  }
}
function renderLadder(ast, config) {
  const layout = layoutLadder(ast);
  const t = chunk7ZEDTSU3_cjs.resolveIndustrialTheme(config?.theme ?? "default");
  const titleOffset = ast.title ? 30 : 0;
  const width = layout.width;
  const height = layout.height + titleOffset;
  const children = [];
  children.push(chunk7ZEDTSU3_cjs.title(ast.title ?? "Ladder Logic"));
  children.push(
    chunk7ZEDTSU3_cjs.desc(`PLC ladder logic diagram with ${ast.rungs.length} rung${ast.rungs.length === 1 ? "" : "s"}`)
  );
  children.push(chunk7ZEDTSU3_cjs.el("style", {}, buildCss(t)));
  if (ast.title) {
    children.push(
      chunk7ZEDTSU3_cjs.text({ x: width / 2, y: 20, class: "lt-ladder-title", "text-anchor": "middle" }, ast.title)
    );
  }
  const inner = [];
  const rungBlocks = rungSourceBlocks(config?.__source);
  inner.push(
    chunk7ZEDTSU3_cjs.el("line", {
      x1: layout.leftRailX,
      y1: 0,
      x2: layout.leftRailX,
      y2: layout.height,
      class: "lt-ladder-rail"
    })
  );
  inner.push(
    chunk7ZEDTSU3_cjs.el("line", {
      x1: layout.rightRailX,
      y1: 0,
      x2: layout.rightRailX,
      y2: layout.height,
      class: "lt-ladder-rail"
    })
  );
  for (let index = 0; index < layout.rungs.length; index++) {
    const r = layout.rungs[index];
    const block = rungBlocks[index];
    if (config?.__scene && block) {
      const key = `ladder:rung:${r.rung.number}:order`;
      const handleX = layout.leftRailX - 31;
      const handleY = r.y - 9;
      config.__scene.push({
        key,
        kind: "handle",
        semanticId: `rung:${r.rung.number}`,
        label: r.rung.comment ?? `Rung ${r.rung.number}`,
        bbox: { x: handleX, y: handleY + titleOffset, width: 18, height: 18 },
        positionSource: {
          kind: "source-block",
          range: block,
          blocks: rungBlocks,
          index,
          step: r.height
        },
        editable: { label: false, position: "move-y" }
      });
      inner.push(chunk7ZEDTSU3_cjs.group({ "data-sx-key": key, "aria-label": `Reorder rung ${r.rung.number}` }, [
        chunk7ZEDTSU3_cjs.el("rect", { x: handleX, y: handleY, width: 18, height: 18, class: "lt-ladder-rung-handle" }),
        ...[0, 1, 2].flatMap((row) => [0, 1].map((col) => chunk7ZEDTSU3_cjs.el("circle", {
          cx: handleX + 6 + col * 6,
          cy: handleY + 5 + row * 4,
          r: 1.25,
          class: "lt-ladder-rung-grip"
        })))
      ]));
    }
    inner.push(
      chunk7ZEDTSU3_cjs.text(
        { x: layout.leftRailX - 6, y: r.y + 3, class: "lt-ladder-rung-num" },
        `Rung ${String(r.rung.number).padStart(3, "0")}`
      )
    );
    if (r.rung.comment) {
      const commentY = Math.max(14, r.y - (r.headerHeight + 6));
      inner.push(
        chunk7ZEDTSU3_cjs.text(
          {
            x: layout.leftRailX + 10,
            y: commentY,
            class: "lt-ladder-comment"
          },
          `\u2014 ${r.rung.comment} \u2014`
        )
      );
    }
  }
  for (const w of layout.wires) {
    inner.push(chunk7ZEDTSU3_cjs.path({ d: w.path, class: "lt-ladder-wire" }));
  }
  for (const n of layout.nodes) {
    inner.push(renderNode(n));
  }
  const wrap = chunk7ZEDTSU3_cjs.group({ transform: `translate(0, ${titleOffset})` }, inner);
  children.push(wrap);
  return chunk7ZEDTSU3_cjs.svgRoot(
    {
      class: "lt-ladder",
      role: "img",
      "aria-labelledby": "lt-ladder-title lt-ladder-desc",
      width,
      height,
      viewBox: `0 0 ${width} ${height}`
    },
    children
  );
}

// src/diagrams/ladder/index.ts
var ladder = {
  type: "ladder",
  detect(text2) {
    const first = chunkVGO4AJ4K_cjs.firstContentLine(text2)?.toLowerCase() ?? "";
    return first.startsWith("ladder");
  },
  parse: parseLadderDSL,
  render(text2, config) {
    const ast = parseLadderDSL(text2);
    return renderLadder(ast, config);
  }
};

exports.ladder = ladder;
exports.layoutLadder = layoutLadder;
exports.parseLadderDSL = parseLadderDSL;
exports.renderLadder = renderLadder;
//# sourceMappingURL=chunk-FDQVLYPZ.cjs.map
//# sourceMappingURL=chunk-FDQVLYPZ.cjs.map