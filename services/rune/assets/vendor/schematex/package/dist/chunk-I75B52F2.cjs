'use strict';

var chunkVGO4AJ4K_cjs = require('./chunk-VGO4AJ4K.cjs');
var chunkEQMWWNB3_cjs = require('./chunk-EQMWWNB3.cjs');
var chunk54Q7JDQB_cjs = require('./chunk-54Q7JDQB.cjs');
var chunk7ZEDTSU3_cjs = require('./chunk-7ZEDTSU3.cjs');

// src/diagrams/fishbone/parser.ts
var FishboneParseError = class extends Error {
  line;
  source;
  constructor(message, line2, source) {
    super(line2 !== void 0 ? `Line ${line2}: ${message}` : message);
    this.name = "FishboneParseError";
    this.line = line2;
    this.source = source;
  }
};
var SLOPE_PRESETS = {
  gentle: 0.45,
  normal: 0.6,
  steep: 0.75
};
function parseFishboneDSL(text2) {
  const rawLines = text2.split(/\r?\n/);
  const locator = chunk54Q7JDQB_cjs.createSourceLocator(text2);
  const lineStarts = [];
  let nextLineStart = 0;
  for (let i = 0; i < rawLines.length; i++) {
    lineStarts.push(nextLineStart);
    nextLineStart += rawLines[i].length + (i < rawLines.length - 1 ? text2[nextLineStart + rawLines[i].length] === "\r" ? 2 : 1 : 0);
  }
  const tokenRange = (lineIndex, token, from = 0) => {
    const at = rawLines[lineIndex].indexOf(token, from);
    return at < 0 ? void 0 : locator.range(lineStarts[lineIndex] + at, lineStarts[lineIndex] + at + token.length);
  };
  let title2;
  let titleSourceRange;
  let effect = "";
  let effectSourceRange;
  let orientation = "ltr";
  let width;
  let height;
  let sides;
  let ribSlope;
  let density;
  let causeSide;
  const categories = [];
  const causesByCategory = /* @__PURE__ */ new Map();
  let lastLevel1 = null;
  let implicitActiveCatId = null;
  let implicitBulletIndent = null;
  let headerSeen = false;
  const getCat = (id) => categories.find((c) => c.id === id || c.label === id);
  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i] ?? "";
    const line2 = stripComment(raw).trimEnd();
    if (!line2.trim()) continue;
    const indent = countIndent(raw);
    const trimmed = line2.trim();
    if (!headerSeen && /^fishbone\b/i.test(trimmed)) {
      const m = trimmed.match(/^fishbone\s*:?\s*(.*)$/i);
      if (m && m[1]) {
        const token = m[1].trim();
        title2 = stripQuotes(token);
        titleSourceRange = tokenRange(i, token);
      }
      headerSeen = true;
      continue;
    }
    if (indent >= 2 && trimmed.startsWith("-")) {
      const subText = stripQuotes(trimmed.slice(1).trim());
      if (!subText) continue;
      if (implicitActiveCatId && (implicitBulletIndent === null || indent <= implicitBulletIndent)) {
        const bucket = causesByCategory.get(implicitActiveCatId);
        const token = trimmed.slice(1).trim();
        const node = { label: subText, sourceRange: tokenRange(i, token), children: [] };
        bucket.push(node);
        lastLevel1 = node;
        implicitBulletIndent = indent;
        continue;
      }
      if (lastLevel1) {
        const token = trimmed.slice(1).trim();
        lastLevel1.children.push({ label: subText, sourceRange: tokenRange(i, token), children: [] });
        continue;
      }
      if (implicitActiveCatId) {
        const bucket = causesByCategory.get(implicitActiveCatId);
        const token = trimmed.slice(1).trim();
        const node = { label: subText, sourceRange: tokenRange(i, token), children: [] };
        bucket.push(node);
        lastLevel1 = node;
        implicitBulletIndent = indent;
        continue;
      }
      throw new FishboneParseError(
        `Sub-cause has no preceding Level-1 cause`,
        i + 1,
        trimmed
      );
    }
    if (/^effect\b/i.test(trimmed)) {
      implicitActiveCatId = null;
      implicitBulletIndent = null;
      const m = trimmed.match(/^effect\s*:?\s*(.*)$/i);
      if (m) {
        const token = (m[1] ?? "").trim();
        effect = stripQuotes(token);
        effectSourceRange = tokenRange(i, token);
      }
      continue;
    }
    if (/^config\b/i.test(trimmed)) {
      implicitActiveCatId = null;
      implicitBulletIndent = null;
      const m = trimmed.match(/^config\s+([a-zA-Z]+)\s*=\s*(.+)$/i);
      if (m) {
        const key = m[1].toLowerCase();
        const val = stripQuotes(m[2].trim());
        if (key === "direction") {
          orientation = val === "left" || val === "rtl" ? "rtl" : "ltr";
        } else if (key === "width") {
          const n = Number(val);
          if (Number.isFinite(n)) width = n;
        } else if (key === "height") {
          const n = Number(val);
          if (Number.isFinite(n)) height = n;
        } else if (key === "sides") {
          const v = val.toLowerCase();
          if (v === "both" || v === "top" || v === "bottom") sides = v;
        } else if (key === "slope" || key === "ribslope") {
          const preset = SLOPE_PRESETS[val.toLowerCase()];
          if (preset !== void 0) ribSlope = preset;
          else {
            const n = Number(val);
            if (Number.isFinite(n) && n > 0 && n < 3) ribSlope = n;
          }
        } else if (key === "density") {
          const v = val.toLowerCase();
          if (v === "compact" || v === "normal" || v === "spacious") density = v;
        } else if (key === "causeside" || key === "cause-side") {
          const v = val.toLowerCase();
          if (v === "head" || v === "tail" || v === "both") causeSide = v;
        }
      }
      continue;
    }
    if (/^category\b/i.test(trimmed)) {
      implicitActiveCatId = null;
      implicitBulletIndent = null;
      const compact = trimmed.match(/^category\s+([^:]+?)\s*:\s*(.+)$/i);
      const structured = trimmed.match(
        /^category\s+([a-zA-Z][\w-]*)\s+("[^"]*"|[^\s[]+)(?:\s*(\[.*\]))?\s*$/i
      );
      if (structured) {
        const id = structured[1];
        const label = stripQuotes(structured[2]);
        const props = parseProps(structured[3] ?? "");
        if (!getCat(id)) {
          const sideProp = props["side"]?.toLowerCase();
          const side = sideProp === "top" || sideProp === "bottom" ? sideProp : void 0;
          const orderProp = props["order"];
          const orderNum = orderProp !== void 0 ? Number(orderProp) : NaN;
          const order = Number.isFinite(orderNum) ? orderNum : void 0;
          categories.push({ id, label, color: props["color"], side, order, sourceRange: tokenRange(i, structured[2]) });
          causesByCategory.set(id, []);
        }
        lastLevel1 = null;
        continue;
      }
      if (compact) {
        const label = stripQuotes(compact[1].trim());
        const id = slugify(label);
        const rest = compact[2].trim();
        if (!getCat(id)) {
          categories.push({ id, label, sourceRange: tokenRange(i, compact[1].trim()) });
          causesByCategory.set(id, []);
        }
        const bucket = causesByCategory.get(id);
        let compactFrom = rawLines[i].indexOf(rest);
        for (const part of rest.split(/[;,]/)) {
          const txt = stripQuotes(part.trim());
          if (txt) {
            const token = part.trim();
            const range = tokenRange(i, token, Math.max(0, compactFrom));
            const node = { label: txt, sourceRange: range, children: [] };
            bucket.push(node);
            lastLevel1 = node;
            if (range) compactFrom = range.end - lineStarts[i];
          }
        }
        continue;
      }
    }
    const causeMatch = trimmed.match(/^([a-zA-Z][\w-]*)\s*:\s*(.+)$/);
    if (causeMatch) {
      const catId = causeMatch[1];
      const cat = getCat(catId);
      if (!cat) {
        throw new FishboneParseError(
          `Unknown category "${catId}". Declare with \`category ${catId} "..."\` first.`,
          i + 1,
          trimmed
        );
      }
      const bucket = causesByCategory.get(cat.id);
      const rest = causeMatch[2].trim();
      const { text: causeText } = splitTrailingProps(rest);
      const label = stripQuotes(causeText);
      if (!label) continue;
      const node = { label, sourceRange: tokenRange(i, causeText.trim()), children: [] };
      bucket.push(node);
      lastLevel1 = node;
      implicitActiveCatId = null;
      implicitBulletIndent = null;
      continue;
    }
    if (indent === 0 && !trimmed.startsWith("-") && !trimmed.includes(":") && !trimmed.startsWith("[")) {
      const label = stripQuotes(trimmed);
      if (label) {
        const id = slugify(label);
        if (!getCat(id)) {
          categories.push({ id, label, sourceRange: tokenRange(i, trimmed) });
          causesByCategory.set(id, []);
        }
        implicitActiveCatId = id;
        implicitBulletIndent = null;
        lastLevel1 = null;
        continue;
      }
    }
  }
  if (!effect) {
    effect = title2 ?? "";
  }
  if (categories.length === 0) {
    throw new FishboneParseError(
      "Fishbone requires at least one `category`. See docs/reference/13-FISHBONE-STANDARD.md."
    );
  }
  const majors = categories.map((c) => ({
    label: c.label,
    sourceRange: c.sourceRange,
    color: c.color,
    children: causesByCategory.get(c.id) ?? [],
    side: c.side,
    order: c.order
  }));
  return {
    type: "fishbone",
    title: title2,
    titleSourceRange,
    effect,
    effectSourceRange,
    majors,
    orientation,
    width,
    height,
    sides,
    ribSlope,
    density,
    causeSide
  };
}
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
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1);
  return t;
}
function countIndent(raw) {
  let n = 0;
  for (const ch of raw) {
    if (ch === " ") n += 1;
    else if (ch === "	") n += 2;
    else break;
  }
  return n;
}
function slugify(s) {
  return s.toLowerCase().replace(/[^\w\u4e00-\u9fff]+/g, "-").replace(/^-+|-+$/g, "") || "cat";
}
function splitTrailingProps(s) {
  const idx = s.lastIndexOf("[");
  if (idx < 0 || !s.trimEnd().endsWith("]")) return { text: s, props: {} };
  const text2 = s.slice(0, idx).trim();
  const props = parseProps(s.slice(idx));
  return { text: text2, props };
}
function parseProps(raw) {
  const out = {};
  const m = raw.match(/^\[(.*)\]$/s);
  if (!m) return out;
  const inside = m[1];
  for (const part of splitTopLevelCommas(inside)) {
    const [k, ...rest] = part.split(":");
    if (!k || rest.length === 0) continue;
    out[k.trim()] = stripQuotes(rest.join(":").trim());
  }
  return out;
}
function splitTopLevelCommas(inside) {
  const parts = [];
  let depth = 0;
  let buf = "";
  let inQuote = false;
  for (const ch of inside) {
    if (ch === '"') inQuote = !inQuote;
    if (!inQuote) {
      if (ch === "[") depth += 1;
      else if (ch === "]") depth -= 1;
      else if (ch === "," && depth === 0) {
        parts.push(buf);
        buf = "";
        continue;
      }
    }
    buf += ch;
  }
  if (buf.trim()) parts.push(buf);
  return parts;
}

// src/diagrams/fishbone/layout.ts
var FB_CONST = {
  PADDING: 40,
  HEAD_W: 90,
  HEAD_H: 80,
  TAIL_LEN: 40,
  SPINE_OFFSET_FROM_TAIL: 40,
  // distance from canvas left to spine start
  RIB_SLOPE: 0.6,
  // dx/dy — consistent across all ribs
  RIB_BASE_EXTENT_Y: 30,
  // vertical distance of first slot from spine
  ROW_HEIGHT: 30,
  // vertical gap between Level-1 slots
  SUB_ROW_HEIGHT: 17,
  BRANCH_LEN: 30,
  // horizontal Level-1 branch length
  SUB_TICK_LEN: 10,
  HEADER_W: 132,
  HEADER_H: 34,
  HEADER_GAP: 12,
  // gap between rib endpoint and header pill
  COL_STEP: 130,
  // spine x gap between adjacent ribs
  COL_FIRST_OFFSET: 170,
  // first rib's distance from spine start
  LABEL_FONT: 12,
  HEADER_FONT: 14,
  SUB_FONT: 11,
  EFFECT_FONT: 14,
  LABEL_GAP: 6,
  // gap from branch end to label
  MIN_ROWS_PER_HALF: 4,
  // aesthetic minimum rib length
  COL_GAP_BETWEEN_LABELS: 18,
  // min horizontal breathing between adjacent ribs' label columns
  HEAD_PAD_X: 44,
  // total horizontal padding around effect text inside head
  HEAD_PAD_Y: 20,
  // min vertical padding around effect text inside head
  TITLE_CLEARANCE: 24
  // extra gap between title baseline and top header pill
};
function estimateTextWidth(s, fontSize) {
  let w = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    const isWide = cp >= 12288 && cp <= 12543 || cp >= 13312 && cp <= 40959 || cp >= 44032 && cp <= 55215 || cp >= 65280 && cp <= 65519;
    w += fontSize * (isWide ? 1 : 0.56);
  }
  return w;
}
var DENSITY = {
  compact: {
    rowHeight: 24,
    subRowHeight: 15,
    colStep: 110,
    headerW: 118,
    headerH: 30,
    headerGap: 8,
    minRowsPerHalf: 3,
    colFirstOffset: 140
  },
  normal: {
    rowHeight: 30,
    subRowHeight: 17,
    colStep: 130,
    headerW: 132,
    headerH: 34,
    headerGap: 12,
    minRowsPerHalf: 4,
    colFirstOffset: 170
  },
  spacious: {
    rowHeight: 36,
    subRowHeight: 19,
    colStep: 150,
    headerW: 148,
    headerH: 38,
    headerGap: 16,
    minRowsPerHalf: 5,
    colFirstOffset: 200
  }
};
function layoutFishbone(ast, opts) {
  const majors = ast.majors.length > 0 ? ast.majors : [];
  majors.length;
  const density = ast.density ?? "normal";
  const D = DENSITY[density];
  const ribSlope = ast.ribSlope ?? FB_CONST.RIB_SLOPE;
  const causeSideSetting = ast.causeSide ?? "head";
  const sides = ast.sides ?? "both";
  const topMajors = [];
  const botMajors = [];
  if (sides === "top" || sides === "bottom") {
    const bucket = sides === "top" ? topMajors : botMajors;
    for (const m of majors) {
      if (m.side === "top") topMajors.push(m);
      else if (m.side === "bottom") botMajors.push(m);
      else bucket.push(m);
    }
  } else {
    const autoPool = [];
    for (const m of majors) {
      if (m.side === "top") topMajors.push(m);
      else if (m.side === "bottom") botMajors.push(m);
      else autoPool.push(m);
    }
    for (const m of autoPool) {
      if (topMajors.length <= botMajors.length) topMajors.push(m);
      else botMajors.push(m);
    }
  }
  const byOrder = (a, b) => {
    const ao = a.order ?? Number.POSITIVE_INFINITY;
    const bo = b.order ?? Number.POSITIVE_INFINITY;
    return ao - bo;
  };
  topMajors.sort(byOrder);
  botMajors.sort(byOrder);
  const nTop = topMajors.length;
  const nBot = botMajors.length;
  const ribRowHeights = (m) => {
    if (m.children.length === 0) return [];
    return m.children.map(
      (c) => D.rowHeight + c.children.length * D.subRowHeight
    );
  };
  const topExtents = topMajors.map(
    (m) => sumOrMin(ribRowHeights(m), D.minRowsPerHalf * D.rowHeight)
  );
  const botExtents = botMajors.map(
    (m) => sumOrMin(ribRowHeights(m), D.minRowsPerHalf * D.rowHeight)
  );
  const effectTextW = estimateTextWidth(ast.effect, FB_CONST.EFFECT_FONT);
  const rawHeadW = effectTextW + FB_CONST.HEAD_PAD_X;
  const headEffectiveH = Math.max(FB_CONST.HEAD_H, Math.ceil(rawHeadW / 2));
  const taperAtText = 1 - FB_CONST.EFFECT_FONT / headEffectiveH;
  const headEffectiveW = Math.max(FB_CONST.HEAD_W, Math.ceil(rawHeadW / taperAtText));
  const minHalfFromHead = Math.ceil(headEffectiveH / 2) + 6;
  const topHalfExtent = nTop > 0 ? Math.max(
    minHalfFromHead,
    D.minRowsPerHalf * D.rowHeight,
    ...topExtents.length ? topExtents : [0]
  ) : sides === "bottom" ? Math.max(minHalfFromHead, 0) : 0;
  const botHalfExtent = nBot > 0 ? Math.max(
    minHalfFromHead,
    D.minRowsPerHalf * D.rowHeight,
    ...botExtents.length ? botExtents : [0]
  ) : sides === "top" ? Math.max(minHalfFromHead, 0) : 0;
  const nCols = Math.max(nTop, nBot, 1);
  let maxCauseLabelW = 0;
  let maxSubLabelW = 0;
  for (const m of majors) {
    for (const c of m.children) {
      maxCauseLabelW = Math.max(
        maxCauseLabelW,
        estimateTextWidth(c.label, FB_CONST.LABEL_FONT)
      );
      for (const sc of c.children) {
        maxSubLabelW = Math.max(
          maxSubLabelW,
          estimateTextWidth(sc.label, FB_CONST.SUB_FONT)
        );
      }
    }
  }
  const subExtent = maxSubLabelW > 0 ? FB_CONST.SUB_TICK_LEN + 4 + maxSubLabelW : 0;
  const labelColW = Math.max(maxCauseLabelW, subExtent);
  const labelExtentsPerCol = causeSideSetting === "both" ? 2 : 1;
  const minColStep = FB_CONST.BRANCH_LEN + FB_CONST.LABEL_GAP + labelColW + FB_CONST.COL_GAP_BETWEEN_LABELS;
  const colStep = Math.max(
    D.colStep,
    Math.ceil(minColStep * (labelExtentsPerCol === 2 ? 1.15 : 1))
  );
  const spineStartX = FB_CONST.PADDING + FB_CONST.TAIL_LEN + FB_CONST.SPINE_OFFSET_FROM_TAIL;
  const firstRibX = spineStartX + D.colFirstOffset;
  const lastRibX = firstRibX + (nCols - 1) * colStep;
  const spineEndX = lastRibX + Math.max(40, FB_CONST.BRANCH_LEN + FB_CONST.LABEL_GAP + labelColW + 12);
  const headX = spineEndX;
  const headTipXAdj = headX + headEffectiveW;
  const width = ast.width ?? Math.ceil(headTipXAdj + FB_CONST.PADDING);
  const title2 = ast.title;
  const titleReserve = title2 ? FB_CONST.TITLE_CLEARANCE + 20 : 0;
  const spineY = FB_CONST.PADDING + titleReserve + topHalfExtent + D.headerH / 2 + 12;
  const height = ast.height ?? Math.ceil(
    spineY + botHalfExtent + D.headerH / 2 + 12 + FB_CONST.PADDING
  );
  const ribs = [];
  const palette = opts?.palette ?? chunk7ZEDTSU3_cjs.resolveFishboneTheme("default").palette;
  const textBBoxes = [];
  const buildHalfRibs = (halfMajors, startIndex, half, halfExtent) => {
    for (let i = 0; i < halfMajors.length; i++) {
      const major = halfMajors[i];
      const globalIdx = startIndex + i;
      const color = major.color ?? palette[globalIdx % palette.length];
      const spineX = firstRibX + i * colStep;
      const endY = half === "top" ? spineY - halfExtent : spineY + halfExtent;
      const endX = spineX - halfExtent * ribSlope;
      const extraDist = D.headerGap + D.headerH / 2;
      const headerCenterY = half === "top" ? endY - extraDist : endY + extraDist;
      const headerCenterX = endX - extraDist * ribSlope;
      const headerW = Math.max(
        D.headerW,
        estimateTextWidth(major.label, FB_CONST.HEADER_FONT) + 28
      );
      const headerX = headerCenterX - headerW / 2;
      const headerY = headerCenterY - D.headerH / 2;
      textBBoxes.push({
        x: headerX,
        y: headerY,
        w: headerW,
        h: D.headerH
      });
      const causes = [];
      let accum = FB_CONST.RIB_BASE_EXTENT_Y;
      for (let s = 0; s < major.children.length; s++) {
        const child = major.children[s];
        const rowH = D.rowHeight + child.children.length * D.subRowHeight;
        const slotOffset = accum + rowH / 2 - D.rowHeight / 2;
        const ribY = half === "top" ? spineY - slotOffset : spineY + slotOffset;
        const ribX = spineX - slotOffset * ribSlope;
        const causeDir = causeSideSetting === "tail" ? "tail" : causeSideSetting === "both" ? s % 2 === 0 ? "head" : "tail" : "head";
        const branchY = ribY;
        const branchX = causeDir === "head" ? ribX + FB_CONST.BRANCH_LEN : ribX - FB_CONST.BRANCH_LEN;
        const labelX = causeDir === "head" ? branchX + FB_CONST.LABEL_GAP : branchX - FB_CONST.LABEL_GAP;
        const labelY = branchY;
        const labelAnchor = causeDir === "head" ? "start" : "end";
        const labelW = estimateTextWidth(child.label, FB_CONST.LABEL_FONT);
        textBBoxes.push({
          x: causeDir === "head" ? labelX - 2 : labelX - labelW - 2,
          y: labelY - FB_CONST.LABEL_FONT / 2 - 2,
          w: labelW + 4,
          h: FB_CONST.LABEL_FONT + 4
        });
        const subCauses = [];
        for (let si = 0; si < child.children.length; si++) {
          const sub = child.children[si];
          const subY = labelY + (si + 1) * D.subRowHeight;
          const tickX1 = causeDir === "head" ? labelX + 2 : labelX - 2;
          const tickX2 = causeDir === "head" ? tickX1 + FB_CONST.SUB_TICK_LEN : tickX1 - FB_CONST.SUB_TICK_LEN;
          const subX = causeDir === "head" ? tickX2 + 4 : tickX2 - 4;
          subCauses.push({
            label: sub.label,
            sourceRange: sub.sourceRange,
            x: subX,
            y: subY,
            tickX1,
            tickX2,
            tickY: subY,
            anchor: causeDir === "head" ? "start" : "end"
          });
          const subW = estimateTextWidth(sub.label, FB_CONST.SUB_FONT);
          textBBoxes.push({
            x: causeDir === "head" ? subX - 2 : subX - subW - 2,
            y: subY - FB_CONST.SUB_FONT / 2 - 2,
            w: subW + 4,
            h: FB_CONST.SUB_FONT + 4
          });
        }
        causes.push({
          label: child.label,
          sourceRange: child.sourceRange,
          ribIndex: globalIdx,
          slotIndex: s,
          ribX,
          ribY,
          branchX,
          branchY,
          labelX,
          labelY,
          labelAnchor,
          causeSide: causeDir,
          subCauses
        });
        accum += rowH;
      }
      ribs.push({
        index: globalIdx,
        half,
        label: major.label,
        sourceRange: major.sourceRange,
        color,
        spineX,
        spineY,
        endX,
        endY,
        headerX,
        headerY,
        headerW,
        headerH: D.headerH,
        causes
      });
    }
  };
  buildHalfRibs(topMajors, 0, "top", topHalfExtent);
  buildHalfRibs(botMajors, nTop, "bottom", botHalfExtent);
  const head = {
    x: headX,
    y: spineY,
    tipX: headTipXAdj,
    tipY: spineY,
    w: headEffectiveW,
    h: headEffectiveH,
    label: ast.effect
  };
  textBBoxes.push({
    x: headX + 4,
    y: spineY - headEffectiveH / 2 + 4,
    w: headEffectiveW - 8,
    h: headEffectiveH - 8
  });
  return {
    width,
    height,
    orientation: ast.orientation,
    spineY,
    spineStartX,
    spineEndX,
    tailForkTipTop: { x: FB_CONST.PADDING, y: spineY - FB_CONST.TAIL_LEN },
    tailForkTipBot: { x: FB_CONST.PADDING, y: spineY + FB_CONST.TAIL_LEN },
    head,
    ribs,
    textBBoxes,
    title: title2
  };
}
function sumOrMin(arr, min) {
  if (arr.length === 0) return min;
  const s = arr.reduce((a, b) => a + b, 0);
  return Math.max(s, min);
}

// src/diagrams/fishbone/renderer.ts
var CSS = `
.sx-fb { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
.sx-fb-title { font: 700 16px sans-serif; fill: #111; }
.sx-fb-spine { stroke: var(--schematex-fb-spine, #141413); stroke-width: 2; stroke-linecap: butt; fill: none; }
.sx-fb-tail { stroke: var(--schematex-fb-spine, #141413); stroke-width: 2; stroke-linecap: round; fill: none; }
.sx-fb-head { stroke-width: 0.5; }
.sx-fb-head-text { font: 500 14px sans-serif; text-anchor: middle; dominant-baseline: central; }
.sx-fb-rib { stroke-width: 1.5; fill: none; }
.sx-fb-header-pill { stroke-width: 0.6; }
.sx-fb-header-text { font: 500 14px sans-serif; text-anchor: middle; dominant-baseline: central; }
.sx-fb-branch { stroke-width: 0.8; opacity: 0.6; fill: none; }
.sx-fb-cause-label { font: 400 12px sans-serif; fill: #3d3d3a; dominant-baseline: central; }
.sx-fb-sub-tick { stroke-width: 0.7; opacity: 0.5; fill: none; }
.sx-fb-sub-label { font: 400 11px sans-serif; fill: #555; dominant-baseline: central; }
`.trim();
function lighten(hex, amount) {
  const m = hex.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = n >> 16 & 255;
  const g = n >> 8 & 255;
  const b = n & 255;
  const rr = Math.round(r + (255 - r) * amount);
  const gg = Math.round(g + (255 - g) * amount);
  const bb = Math.round(b + (255 - b) * amount);
  return `#${[rr, gg, bb].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
function darken(hex, amount) {
  const m = hex.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = n >> 16 & 255;
  const g = n >> 8 & 255;
  const b = n & 255;
  const rr = Math.round(r * (1 - amount));
  const gg = Math.round(g * (1 - amount));
  const bb = Math.round(b * (1 - amount));
  return `#${[rr, gg, bb].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
function randomId() {
  return Math.random().toString(36).slice(2, 8);
}
function buildMask(id, w, h, bboxes) {
  const base = chunk7ZEDTSU3_cjs.rect({ x: 0, y: 0, width: w, height: h, fill: "white" });
  const holes = bboxes.map(
    (b) => chunk7ZEDTSU3_cjs.rect({
      x: b.x,
      y: b.y,
      width: b.w,
      height: b.h,
      fill: "black",
      rx: 2
    })
  ).join("\n");
  return chunk7ZEDTSU3_cjs.el("mask", { id, maskUnits: "userSpaceOnUse" }, [base, holes]);
}
function renderHead(layout, ltr, ast, scene) {
  const h = layout.head;
  const tipX = ltr ? h.tipX : h.x - (h.tipX - h.x);
  const leftX = ltr ? h.x : h.x;
  const rightX = ltr ? h.tipX : tipX;
  const points = ltr ? `${leftX},${h.y - h.h / 2} ${leftX},${h.y + h.h / 2} ${rightX},${h.y}` : `${rightX},${h.y - h.h / 2} ${rightX},${h.y + h.h / 2} ${tipX},${h.y}`;
  const fill = "#faece7";
  const stroke = "#993c1d";
  const textX = ltr ? leftX + h.w * 0.38 : rightX - h.w * 0.38;
  const key = "label:effect";
  scene?.push({
    key,
    kind: "label",
    label: h.label,
    sourceRange: ast.effectSourceRange,
    bbox: { x: Math.min(leftX, rightX), y: h.y - h.h / 2, width: Math.abs(rightX - leftX), height: h.h },
    editable: { label: ast.effectSourceRange !== void 0, position: "none" }
  });
  return chunk7ZEDTSU3_cjs.group({ class: "sx-fb-head-g" }, [
    chunk7ZEDTSU3_cjs.polygon({
      points,
      class: "sx-fb-head",
      fill,
      stroke
    }),
    chunk7ZEDTSU3_cjs.text(
      {
        x: textX,
        y: h.y,
        class: "sx-fb-head-text",
        fill: darken(stroke, 0.3),
        "data-sx-key": scene && ast.effectSourceRange ? key : void 0,
        "data-sx-role": scene && ast.effectSourceRange ? "label" : void 0
      },
      h.label
    )
  ]);
}
function renderRibs(layout, maskUrl, scene) {
  const parts = [];
  for (const rib of layout.ribs) {
    const ribKey = `rib:${rib.index}:label`;
    scene?.push({
      key: ribKey,
      kind: "label",
      label: rib.label,
      sourceRange: rib.sourceRange,
      bbox: { x: rib.headerX, y: rib.headerY, width: rib.headerW, height: rib.headerH },
      editable: { label: rib.sourceRange !== void 0, position: "none" }
    });
    const pillFill = lighten(rib.color, 0.82);
    const pillStroke = rib.color;
    const headerTextFill = darken(rib.color, 0.3);
    parts.push(
      chunk7ZEDTSU3_cjs.line({
        x1: rib.spineX,
        y1: rib.spineY,
        x2: rib.endX,
        y2: rib.endY,
        class: "sx-fb-rib",
        stroke: rib.color,
        mask: maskUrl
      })
    );
    parts.push(
      chunk7ZEDTSU3_cjs.line({
        x1: rib.endX,
        y1: rib.endY,
        x2: rib.headerX + rib.headerW / 2,
        y2: rib.headerY + rib.headerH / 2,
        class: "sx-fb-rib",
        stroke: rib.color
      })
    );
    parts.push(
      chunk7ZEDTSU3_cjs.rect({
        x: rib.headerX,
        y: rib.headerY,
        width: rib.headerW,
        height: rib.headerH,
        rx: 8,
        class: "sx-fb-header-pill",
        fill: pillFill,
        stroke: pillStroke
      })
    );
    parts.push(
      chunk7ZEDTSU3_cjs.text(
        {
          x: rib.headerX + rib.headerW / 2,
          y: rib.headerY + rib.headerH / 2,
          class: "sx-fb-header-text",
          fill: headerTextFill,
          "data-sx-key": scene && rib.sourceRange ? ribKey : void 0,
          "data-sx-role": scene && rib.sourceRange ? "label" : void 0
        },
        rib.label
      )
    );
    for (const cause of rib.causes) {
      const causeKey = `rib:${rib.index}:cause:${cause.slotIndex}`;
      scene?.push({
        key: causeKey,
        kind: "label",
        label: cause.label,
        sourceRange: cause.sourceRange,
        editable: { label: cause.sourceRange !== void 0, position: "none" }
      });
      parts.push(
        chunk7ZEDTSU3_cjs.line({
          x1: cause.ribX,
          y1: cause.ribY,
          x2: cause.branchX,
          y2: cause.branchY,
          class: "sx-fb-branch",
          stroke: rib.color,
          mask: maskUrl
        })
      );
      parts.push(
        chunk7ZEDTSU3_cjs.text(
          {
            x: cause.labelX,
            y: cause.labelY,
            class: "sx-fb-cause-label",
            "text-anchor": cause.labelAnchor,
            "data-sx-key": scene && cause.sourceRange ? causeKey : void 0,
            "data-sx-role": scene && cause.sourceRange ? "label" : void 0
          },
          cause.label
        )
      );
      for (let subIndex = 0; subIndex < cause.subCauses.length; subIndex++) {
        const sub = cause.subCauses[subIndex];
        const subKey = `${causeKey}:sub:${subIndex}`;
        scene?.push({
          key: subKey,
          kind: "label",
          label: sub.label,
          sourceRange: sub.sourceRange,
          editable: { label: sub.sourceRange !== void 0, position: "none" }
        });
        parts.push(
          chunk7ZEDTSU3_cjs.line({
            x1: sub.tickX1,
            y1: sub.tickY,
            x2: sub.tickX2,
            y2: sub.tickY,
            class: "sx-fb-sub-tick",
            stroke: rib.color
          })
        );
        parts.push(
          chunk7ZEDTSU3_cjs.text(
            {
              x: sub.x,
              y: sub.y,
              class: "sx-fb-sub-label",
              "text-anchor": sub.anchor,
              "data-sx-key": scene && sub.sourceRange ? subKey : void 0,
              "data-sx-role": scene && sub.sourceRange ? "label" : void 0
            },
            sub.label
          )
        );
      }
    }
  }
  return chunk7ZEDTSU3_cjs.group({ class: "sx-fb-ribs" }, parts);
}
function renderFishboneAST(ast, options = {}) {
  const themeName = options.theme ?? ast.metadata?.["theme"] ?? "default";
  const tokens = chunk7ZEDTSU3_cjs.resolveFishboneTheme(themeName);
  const layout = layoutFishbone(ast, { palette: tokens.palette });
  const ltr = layout.orientation !== "rtl";
  const maskId = `sx-fb-mask-${randomId()}`;
  const maskUrl = `url(#${maskId})`;
  const mask = buildMask(maskId, layout.width, layout.height, layout.textBBoxes);
  const spine = chunk7ZEDTSU3_cjs.line({
    x1: layout.spineStartX,
    y1: layout.spineY,
    x2: layout.spineEndX,
    y2: layout.spineY,
    class: "sx-fb-spine"
  });
  const tailTop = chunk7ZEDTSU3_cjs.line({
    x1: layout.spineStartX,
    y1: layout.spineY,
    x2: layout.tailForkTipTop.x,
    y2: layout.tailForkTipTop.y,
    class: "sx-fb-tail"
  });
  const tailBot = chunk7ZEDTSU3_cjs.line({
    x1: layout.spineStartX,
    y1: layout.spineY,
    x2: layout.tailForkTipBot.x,
    y2: layout.tailForkTipBot.y,
    class: "sx-fb-tail"
  });
  const titleBlock = layout.title ? (() => {
    const title2 = chunkEQMWWNB3_cjs.resolveSceneTitle(layout.title, ast.titleSourceRange, layout.width / 2, 28, options);
    return chunk7ZEDTSU3_cjs.text({ x: title2.x, y: title2.y, class: "sx-fb-title", "text-anchor": "middle", ...title2.attrs }, layout.title);
  })() : "";
  const head = renderHead(layout, ltr, ast, options.__scene);
  const ribs = renderRibs(layout, maskUrl, options.__scene);
  const inner = [
    chunk7ZEDTSU3_cjs.title(layout.title ? `${layout.title} \u2014 Fishbone diagram` : "Fishbone diagram"),
    chunk7ZEDTSU3_cjs.desc(
      `Ishikawa cause-and-effect diagram. Effect: ${ast.effect}. ${ast.majors.length} categories.`
    ),
    chunk7ZEDTSU3_cjs.el("style", {}, CSS),
    chunk7ZEDTSU3_cjs.defs([mask]),
    titleBlock,
    tailTop,
    tailBot,
    spine,
    head,
    ribs
  ];
  if (!ltr) {
    const mirrored = chunk7ZEDTSU3_cjs.group(
      {
        transform: `translate(${layout.width} 0) scale(-1 1)`
      },
      [tailTop, tailBot, spine, head, ribs]
    );
    return chunk7ZEDTSU3_cjs.svgRoot(
      {
        viewBox: `0 0 ${layout.width} ${layout.height}`,
        width: layout.width,
        height: layout.height,
        class: "sx-fb",
        role: "img"
      },
      [
        chunk7ZEDTSU3_cjs.title(layout.title ?? "Fishbone"),
        chunk7ZEDTSU3_cjs.desc(`Ishikawa diagram (head-left). Effect: ${ast.effect}.`),
        chunk7ZEDTSU3_cjs.el("style", {}, CSS),
        chunk7ZEDTSU3_cjs.defs([mask]),
        titleBlock,
        mirrored
      ]
    );
  }
  return chunk7ZEDTSU3_cjs.svgRoot(
    {
      viewBox: `0 0 ${layout.width} ${layout.height}`,
      width: layout.width,
      height: layout.height,
      class: "sx-fb",
      role: "img"
    },
    inner
  );
}
function renderFishbone(text2, options = {}) {
  const ast = parseFishboneDSL(text2);
  return renderFishboneAST(ast, options);
}

// src/diagrams/fishbone/index.ts
var fishbone = {
  type: "fishbone",
  capabilities: { scene: true },
  detect(text2) {
    const first = chunkVGO4AJ4K_cjs.firstContentLine(text2)?.toLowerCase() ?? "";
    return first.startsWith("fishbone");
  },
  parse: parseFishboneDSL,
  render(text2, config) {
    return renderFishbone(text2, config);
  }
};

exports.FB_CONST = FB_CONST;
exports.fishbone = fishbone;
exports.layoutFishbone = layoutFishbone;
exports.parseFishboneDSL = parseFishboneDSL;
exports.renderFishbone = renderFishbone;
exports.renderFishboneAST = renderFishboneAST;
//# sourceMappingURL=chunk-I75B52F2.cjs.map
//# sourceMappingURL=chunk-I75B52F2.cjs.map