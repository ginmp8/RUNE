'use strict';

var chunkEQMWWNB3_cjs = require('./chunk-EQMWWNB3.cjs');
var chunk54Q7JDQB_cjs = require('./chunk-54Q7JDQB.cjs');
var chunk4M6OFAHM_cjs = require('./chunk-4M6OFAHM.cjs');
var chunk7ZEDTSU3_cjs = require('./chunk-7ZEDTSU3.cjs');

// src/diagrams/timing/parser.ts
var TimingParseError = class extends Error {
  constructor(message, line, column, source) {
    super(line !== void 0 ? `Line ${line}: ${message}` : message);
    this.line = line;
    this.column = column;
    this.source = source;
    this.name = "TimingParseError";
  }
  line;
  column;
  source;
};
var VALID_STATES = /^[01xzpPnNhHlLudD=.23456789]+$/;
function splitDataList(rest) {
  const trimmed = rest.trim();
  const m = trimmed.match(/^(\S+)\s*(.*)$/);
  if (!m) return { wave: trimmed, data: [] };
  const wave = m[1];
  const remainder = m[2].trim();
  if (!remainder) return { wave, data: [] };
  const data = [];
  let r = remainder.replace(/^data\s*:\s*/, "").trim();
  if (r.startsWith("[") && r.endsWith("]")) r = r.slice(1, -1);
  const re = /"([^"]*)"/g;
  let match;
  while ((match = re.exec(r)) !== null) data.push(match[1]);
  return { wave, data };
}
function parseTiming(text2) {
  const lines = text2.split("\n").map((l) => l.replace(/\r$/, ""));
  const locator = chunk54Q7JDQB_cjs.createSourceLocator(text2);
  let absoluteStart = 0;
  const signals = [];
  let title2;
  let titleSourceRange;
  let hscale;
  let currentGroup = null;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    const lineStart = absoluteStart;
    absoluteStart += raw.length + (i < lines.length - 1 ? 1 : 0);
    const lineNo = i + 1;
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (/^timing\b/i.test(line)) {
      const t = chunk4M6OFAHM_cjs.matchQuotedTitle(line);
      if (t !== void 0) {
        title2 = t;
        const quoted = /"[^"]*"/.exec(raw);
        if (quoted?.index !== void 0) {
          titleSourceRange = locator.range(
            lineStart + quoted.index,
            lineStart + quoted.index + quoted[0].length
          );
        }
      }
      const hs = line.match(/hscale\s*:\s*(\d+(?:\.\d+)?)/);
      if (hs) hscale = parseFloat(hs[1]);
      continue;
    }
    const groupOpen = line.match(/^\[([^\]]+)\]$/) || line.match(/^group\s+"([^"]+)"\s*\{?$/);
    if (groupOpen) {
      currentGroup = { label: groupOpen[1], signals: [] };
      signals.push(currentGroup);
      continue;
    }
    if (line === "}") {
      currentGroup = null;
      continue;
    }
    if (line === "---") {
      currentGroup = null;
      continue;
    }
    const sigMatch = line.match(/^([^:]+):\s*(.+)$/);
    if (sigMatch) {
      const name = sigMatch[1].trim();
      const rhs = sigMatch[2].trim();
      const tok = rhs.split(/\s+/);
      let wave;
      let data = [];
      if (/^clock$/i.test(tok[0])) {
        const n = Number(tok[1]);
        if (!Number.isInteger(n) || n < 1) {
          throw new TimingParseError(
            `clock needs a positive cycle count, e.g. "${name}: clock 8"`,
            lineNo,
            void 0,
            line
          );
        }
        wave = (/^neg/i.test(tok[2] ?? "") ? "n" : "p").repeat(n);
      } else if (/^rle$/i.test(tok[0])) {
        wave = "";
        for (const seg of tok.slice(1)) {
          const sm = seg.match(/^(.)\*(\d+)$/);
          if (!sm || !VALID_STATES.test(sm[1])) {
            throw new TimingParseError(
              `rle segment must be <state>*<count>, e.g. "1*2 0*6"; got "${seg}"`,
              lineNo,
              void 0,
              line
            );
          }
          wave += sm[1].repeat(Number(sm[2]));
        }
      } else {
        const parsed = splitDataList(rhs);
        wave = parsed.wave;
        data = parsed.data;
        if (!VALID_STATES.test(wave)) {
          const bad = [...wave].find((c) => !VALID_STATES.test(c));
          throw new TimingParseError(
            `Invalid wave string "${wave}" for signal ${name}` + (bad ? ` \u2014 "${bad}" is not a valid state` : "") + `. Valid states: 0 1 x z = . p P n N h H l L u d 2-9. Tip: use "clock N" for a clock or "rle 1*2 0*6" for run-length.`,
            lineNo,
            void 0,
            line
          );
        }
      }
      const colon = raw.indexOf(":");
      const rhsStart = colon >= 0 ? colon + 1 + (raw.slice(colon + 1).match(/^\s*/)?.[0].length ?? 0) : -1;
      const literalWave = !/^clock$/i.test(tok[0] ?? "") && !/^rle$/i.test(tok[0] ?? "");
      const signal = {
        name,
        wave,
        data: data.length ? data : void 0,
        waveSourceRange: literalWave && rhsStart >= 0 ? locator.range(lineStart + rhsStart, lineStart + rhsStart + (rhs.split(/\s+/)[0]?.length ?? 0)) : void 0
      };
      if (currentGroup) currentGroup.signals.push(signal);
      else signals.push(signal);
      continue;
    }
  }
  return { type: "timing", title: title2, titleSourceRange, hscale, signals };
}

// src/diagrams/timing/renderer.ts
var NAME_W = 120;
var SIG_H = 36;
var PAD_TOP = 12;
var PAD_BOT = 12;
var TITLE_H = 28;
var PAD_V = 6;
var DEFAULT_PW = 40;
var GROUP_LABEL_H = 22;
function flatten(items, indent = 0) {
  const out = [];
  for (const item of items) {
    if ("wave" in item) {
      out.push({ kind: "signal", signal: item, indent });
    } else {
      out.push({ kind: "group", label: item.label, indent });
      out.push(...flatten(item.signals, indent + 1));
    }
  }
  return out;
}
function renderWave(signal, ctx) {
  const { pw, yHi, yLo, yMid } = ctx;
  const wave = signal.wave;
  const paths = [];
  const busRects = [];
  const busTexts = [];
  const xPatchRects = [];
  const zLines = [];
  let prev = "none";
  let prevChar = "";
  let busStartX = 0;
  let busIndex = 0;
  let dataIdx = 0;
  let linePath = "";
  const startLine = (x, y) => {
    if (linePath) paths.push(linePath);
    linePath = `M ${x},${y}`;
  };
  const extendLineTo = (x, y) => {
    linePath += ` L ${x},${y}`;
  };
  const flushLine = () => {
    if (linePath) {
      paths.push(linePath);
      linePath = "";
    }
  };
  const closeBus = (x) => {
    const start = busStartX;
    const end = x;
    const inset = Math.min(5, (end - start) / 2);
    const d = `M ${start + inset},${yHi} L ${end - inset},${yHi} L ${end},${yMid} L ${end - inset},${yLo} L ${start + inset},${yLo} L ${start},${yMid} Z`;
    busRects.push(
      chunk7ZEDTSU3_cjs.el("path", { class: "schematex-timing-bus", d, "data-bus-index": String(busIndex) })
    );
    const label = signal.data?.[dataIdx] ?? "";
    if (label) {
      busTexts.push(
        chunk7ZEDTSU3_cjs.text(
          {
            x: (start + end) / 2,
            y: yMid + 4,
            class: "schematex-timing-bus-label",
            "text-anchor": "middle"
          },
          label
        )
      );
    }
    dataIdx++;
    busIndex++;
  };
  for (let i = 0; i < wave.length; i++) {
    const ch = wave[i];
    const x = i * pw;
    const xNext = x + pw;
    const effective = ch === "." ? prevChar : ch;
    switch (effective) {
      case "0":
      case "l":
      case "L": {
        if (prev === "bus") closeBus(x);
        if (prev === "x" || prev === "z" || prev === "none" || prev === "bus") {
          flushLine();
          startLine(x, yLo);
        } else if (prev === "hi") {
          extendLineTo(x, yLo);
        }
        extendLineTo(xNext, yLo);
        prev = "lo";
        break;
      }
      case "1":
      case "h":
      case "H": {
        if (prev === "bus") closeBus(x);
        if (prev === "x" || prev === "z" || prev === "none" || prev === "bus") {
          flushLine();
          startLine(x, yHi);
        } else if (prev === "lo") {
          extendLineTo(x, yHi);
        }
        extendLineTo(xNext, yHi);
        prev = "hi";
        break;
      }
      case "p":
      case "P": {
        if (prev === "bus") closeBus(x);
        flushLine();
        startLine(x, yLo);
        extendLineTo(x, yHi);
        extendLineTo(x + pw / 2, yHi);
        extendLineTo(x + pw / 2, yLo);
        extendLineTo(xNext, yLo);
        flushLine();
        prev = "lo";
        break;
      }
      case "n":
      case "N": {
        if (prev === "bus") closeBus(x);
        flushLine();
        startLine(x, yHi);
        extendLineTo(x, yLo);
        extendLineTo(x + pw / 2, yLo);
        extendLineTo(x + pw / 2, yHi);
        extendLineTo(xNext, yHi);
        flushLine();
        prev = "hi";
        break;
      }
      case "u": {
        if (prev === "bus") closeBus(x);
        flushLine();
        startLine(x, yLo);
        extendLineTo(xNext, yHi);
        prev = "hi";
        break;
      }
      case "d": {
        if (prev === "bus") closeBus(x);
        flushLine();
        startLine(x, yHi);
        extendLineTo(xNext, yLo);
        prev = "lo";
        break;
      }
      case "z": {
        if (prev === "bus") closeBus(x);
        flushLine();
        zLines.push(
          chunk7ZEDTSU3_cjs.el("line", {
            x1: x,
            y1: yMid,
            x2: xNext,
            y2: yMid,
            class: "schematex-timing-hiz"
          })
        );
        prev = "z";
        break;
      }
      case "x": {
        if (prev === "bus") closeBus(x);
        flushLine();
        xPatchRects.push(
          chunk7ZEDTSU3_cjs.el("rect", {
            x,
            y: yHi,
            width: pw,
            height: yLo - yHi,
            class: "schematex-timing-unknown",
            fill: "url(#schematex-timing-xhatch)"
          })
        );
        prev = "x";
        break;
      }
      case "=":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7":
      case "8":
      case "9": {
        const isContinuation = ch === ".";
        if (!isContinuation && prev === "bus") closeBus(x);
        if (prev !== "bus" || !isContinuation) {
          flushLine();
          busStartX = x;
        }
        prev = "bus";
        break;
      }
      default: {
        flushLine();
        xPatchRects.push(
          chunk7ZEDTSU3_cjs.el("rect", {
            x,
            y: yHi,
            width: pw,
            height: yLo - yHi,
            class: "schematex-timing-unknown",
            fill: "url(#schematex-timing-xhatch)"
          })
        );
        prev = "x";
      }
    }
    prevChar = effective;
  }
  if (prev === "bus") closeBus(wave.length * pw);
  flushLine();
  const waveSvg = paths.map((d) => chunk7ZEDTSU3_cjs.el("path", { class: "schematex-timing-wave", d })).concat(xPatchRects, zLines, busRects).join("");
  return { svg: waveSvg, labels: busTexts.join("") };
}
function renderTiming(ast, config) {
  const t = chunk7ZEDTSU3_cjs.resolveBaseTheme(config?.theme ?? "default");
  const pw = DEFAULT_PW * (ast.hscale ?? 1);
  const rows = flatten(ast.signals);
  const maxWaveLen = Math.max(
    1,
    ...rows.flatMap((r) => r.kind === "signal" ? [r.signal.wave.length] : [])
  );
  const waveAreaW = maxWaveLen * pw;
  const width = NAME_W + waveAreaW + 20;
  const gridTop = PAD_TOP + (ast.title ? TITLE_H : 0);
  let y = gridTop;
  const rowYs = [];
  for (const r of rows) {
    rowYs.push(y);
    y += r.kind === "group" ? GROUP_LABEL_H : SIG_H;
  }
  const height = y + PAD_BOT + 10;
  const waveSvgs = [];
  const labelSvgs = [];
  const nameSvgs = [];
  const gridLines = [];
  const nativeHandles = [];
  for (let i = 0; i <= maxWaveLen; i++) {
    const xg = NAME_W + i * pw;
    gridLines.push(
      chunk7ZEDTSU3_cjs.el("line", {
        x1: xg,
        y1: gridTop,
        x2: xg,
        y2: height - PAD_BOT,
        class: "schematex-timing-grid"
      })
    );
  }
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const ry = rowYs[i];
    if (row.kind === "group") {
      nameSvgs.push(
        chunk7ZEDTSU3_cjs.text(
          {
            x: 6 + row.indent * 10,
            y: ry + GROUP_LABEL_H - 6,
            class: "schematex-timing-group-label"
          },
          row.label
        )
      );
      continue;
    }
    const signal = row.signal;
    const yHi = ry + PAD_V;
    const yLo = ry + SIG_H - PAD_V;
    const yMid = ry + SIG_H / 2;
    const activeLow = signal.name.startsWith("~") || signal.name.startsWith("/");
    const displayName = activeLow ? signal.name.slice(1) : signal.name;
    nameSvgs.push(
      chunk7ZEDTSU3_cjs.text(
        {
          x: NAME_W - 8,
          y: yMid + 4,
          class: activeLow ? "schematex-timing-name schematex-timing-name-activelow" : "schematex-timing-name",
          "text-anchor": "end"
        },
        displayName
      )
    );
    const { svg, labels } = renderWave(signal, {
      pw,
      yHi,
      yLo,
      yMid});
    waveSvgs.push(
      chunk7ZEDTSU3_cjs.group(
        {
          transform: `translate(${NAME_W}, 0)`,
          "data-signal": signal.name
        },
        [svg]
      )
    );
    labelSvgs.push(
      chunk7ZEDTSU3_cjs.group({ transform: `translate(${NAME_W}, 0)` }, [labels])
    );
    if (config?.__scene && signal.waveSourceRange) {
      const effective = [];
      let previous = "x";
      for (const char of signal.wave) {
        const state = char === "." ? previous : char;
        effective.push(state);
        previous = state;
      }
      const boundaries = [];
      for (let boundary = 1; boundary < effective.length; boundary++) {
        if (effective[boundary] !== effective[boundary - 1]) boundaries.push(boundary);
      }
      for (const boundary of boundaries) {
        let runStart = boundary - 1;
        while (runStart > 0 && effective[runStart - 1] === effective[boundary - 1]) runStart--;
        let runEnd = boundary + 1;
        while (runEnd < effective.length && effective[runEnd] === effective[boundary]) runEnd++;
        const key = `handle:timing:${signal.name}:${boundary}`;
        const hx = NAME_W + boundary * pw;
        config.__scene.push({
          key,
          kind: "node",
          label: `${signal.name} transition ${boundary}`,
          bbox: { x: hx - 5, y: yMid - 5, width: 10, height: 10 },
          positionSource: {
            kind: "wave-boundary",
            range: signal.waveSourceRange,
            wave: signal.wave,
            boundary,
            runStart,
            runEnd,
            periodWidth: pw
          },
          editable: { label: false, position: "move-x" }
        });
        nativeHandles.push(chunk7ZEDTSU3_cjs.el("rect", {
          x: hx - 4,
          y: yMid - 4,
          width: 8,
          height: 8,
          rx: 1.5,
          class: "sx-native-handle",
          transform: `rotate(45 ${hx} ${yMid})`,
          "data-sx-key": key,
          "data-sx-owner": key
        }));
      }
    }
  }
  const xhatch = chunk7ZEDTSU3_cjs.el(
    "pattern",
    {
      id: "schematex-timing-xhatch",
      patternUnits: "userSpaceOnUse",
      width: 6,
      height: 6
    },
    [
      chunk7ZEDTSU3_cjs.el("rect", { x: 0, y: 0, width: 6, height: 6, fill: t.fillMuted }),
      chunk7ZEDTSU3_cjs.el("path", {
        d: "M 0,6 L 6,0 M -1,1 L 1,-1 M 5,7 L 7,5",
        stroke: t.textMuted,
        "stroke-width": 0.8
      })
    ]
  );
  const css = `
.schematex-timing { font-family: system-ui, -apple-system, sans-serif; }
.schematex-timing-name { font: 12px monospace; fill: ${t.text}; }
.schematex-timing-name-activelow { text-decoration: overline; }
.schematex-timing-group-label { font: bold 12px sans-serif; fill: ${t.text}; }
.schematex-timing-wave { stroke: ${t.stroke}; stroke-width: 1.75; fill: none; stroke-linejoin: miter; stroke-linecap: square; }
.schematex-timing-bus { fill: none; stroke: ${t.stroke}; stroke-width: 1.5; }
.schematex-timing-bus-label { font: 11px monospace; fill: ${t.text}; }
.schematex-timing-unknown { stroke: ${t.textMuted}; stroke-width: 0.5; }
.schematex-timing-hiz { stroke: ${t.textMuted}; stroke-width: 1.5; stroke-dasharray: 4 3; }
.schematex-timing-grid { stroke: ${t.fillMuted}; stroke-width: 0.5; }
.schematex-timing-title { font: 700 16px system-ui, -apple-system, sans-serif; fill: ${t.text}; }
.sx-native-handle { fill: ${t.fill}; stroke: ${t.accent}; stroke-width: 1.4; cursor: ew-resize; vector-effect: non-scaling-stroke; }
.sx-native-handle:hover { fill: ${t.fillMuted}; stroke-width: 2; }
`.trim();
  return chunk7ZEDTSU3_cjs.svgRoot(
    {
      class: "schematex-timing",
      viewBox: `0 0 ${width} ${height}`,
      width,
      height,
      role: "img",
      "data-diagram-type": "timing"
    },
    [
      chunk7ZEDTSU3_cjs.title(ast.title ?? "Timing Diagram"),
      chunk7ZEDTSU3_cjs.desc(`Digital timing diagram with ${rows.filter((r) => r.kind === "signal").length} signals`),
      chunk7ZEDTSU3_cjs.defs([xhatch, chunk7ZEDTSU3_cjs.el("style", {}, css)]),
      chunk7ZEDTSU3_cjs.group({ class: "schematex-timing-grid-g" }, gridLines),
      chunk7ZEDTSU3_cjs.group({ class: "schematex-timing-waves" }, waveSvgs),
      chunk7ZEDTSU3_cjs.group({ class: "schematex-timing-labels" }, labelSvgs),
      chunk7ZEDTSU3_cjs.group({ class: "schematex-timing-names" }, nameSvgs),
      chunk7ZEDTSU3_cjs.group({ class: "sx-native-handles" }, nativeHandles),
      ast.title ? (() => {
        const title2 = chunkEQMWWNB3_cjs.resolveSceneTitle(ast.title, ast.titleSourceRange, width / 2, PAD_TOP + 12, config);
        return chunk7ZEDTSU3_cjs.text(
          {
            x: title2.x,
            y: title2.y,
            "text-anchor": "middle",
            class: "schematex-timing-title",
            ...title2.attrs
          },
          ast.title
        );
      })() : ""
    ]
  );
}

// src/diagrams/timing/index.ts
var timing = {
  type: "timing",
  capabilities: { scene: true, editablePosition: true },
  detect(text2) {
    const first = text2.trim().split("\n")[0]?.trim().toLowerCase() ?? "";
    return first.startsWith("timing");
  },
  parse: parseTiming,
  render(text2, config) {
    const ast = parseTiming(text2);
    return renderTiming(ast, config);
  }
};

exports.parseTiming = parseTiming;
exports.renderTiming = renderTiming;
exports.timing = timing;
//# sourceMappingURL=chunk-QPXUX7WK.cjs.map
//# sourceMappingURL=chunk-QPXUX7WK.cjs.map