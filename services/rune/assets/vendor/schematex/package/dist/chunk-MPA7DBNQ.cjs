'use strict';

var chunkSBB6C4OP_cjs = require('./chunk-SBB6C4OP.cjs');
var chunk4M6OFAHM_cjs = require('./chunk-4M6OFAHM.cjs');
var chunk7ZEDTSU3_cjs = require('./chunk-7ZEDTSU3.cjs');

// src/diagrams/logic/parser.ts
var LogicParseError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "LogicParseError";
  }
};
var GATE_TYPES = /* @__PURE__ */ new Set([
  "AND",
  "OR",
  "NOT",
  "NAND",
  "NOR",
  "XOR",
  "XNOR",
  "BUF",
  "TRISTATE_BUF",
  "TRISTATE_INV",
  "OPEN_DRAIN",
  "SCHMITT",
  "DFF",
  "JKFF",
  "SRFF",
  "TFF",
  "LATCH_SR",
  "LATCH_D",
  "MUX",
  "DEMUX",
  "DECODER",
  "ENCODER",
  "COUNTER",
  "SHIFT_REG"
]);
function splitIds(s) {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}
function parseInputList(s) {
  return s.split(",").map((x) => x.trim()).filter(Boolean).map((tok) => {
    const eq = tok.indexOf("=");
    return eq >= 0 ? tok.slice(eq + 1).trim() : tok;
  });
}
function parseLogic(text2) {
  const lines = text2.split("\n").map((l) => l.replace(/\r$/, "").trim());
  let title2;
  let style;
  const inputs = [];
  const outputs = [];
  const gates = [];
  const modules = [];
  const moduleStack = [];
  let moduleCounter = 0;
  const explicitOutputFrom = /* @__PURE__ */ new Map();
  const warnings = [];
  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, "").replace(/--.*$/, "").trim();
    if (!line) continue;
    const modOpen = line.match(/^module\s+(?:"([^"]+)"|([a-zA-Z_][\w]*))\s*\{$/);
    if (modOpen) {
      const label = modOpen[1] ?? modOpen[2];
      const id = `mod_${moduleCounter++}`;
      modules.push({ id, label });
      moduleStack.push(id);
      continue;
    }
    if (line === "}") {
      if (moduleStack.length === 0) {
        throw new LogicParseError("Unmatched `}` \u2014 no open module");
      }
      moduleStack.pop();
      continue;
    }
    if (/^logic\b/i.test(line)) {
      const t = chunk4M6OFAHM_cjs.matchQuotedTitle(line);
      if (t !== void 0) title2 = t;
      const s = line.match(/style\s*:\s*(ansi|iec)/i);
      if (s) style = s[1].toLowerCase();
      continue;
    }
    const inputMatch = line.match(/^input\s+(.+)$/i);
    if (inputMatch) {
      for (const id of splitIds(inputMatch[1])) {
        const isLow = id.startsWith("~");
        const clean = isLow ? id.slice(1) : id;
        inputs.push({ id: clean, label: clean, isActiveLow: isLow || void 0 });
      }
      continue;
    }
    const outputMatch = line.match(/^output\s+(.+)$/i);
    if (outputMatch) {
      for (const id of splitIds(outputMatch[1])) {
        outputs.push({ id, label: id, from: id });
      }
      continue;
    }
    const assignMatch = line.match(/^([a-zA-Z_][\w]*)\s*<-\s*([a-zA-Z_][\w]*)$/);
    if (assignMatch) {
      explicitOutputFrom.set(assignMatch[1], assignMatch[2]);
      continue;
    }
    const gateMatch = line.match(/^([a-zA-Z_][\w]*)\s*=\s*([A-Za-z_][\w]*)\s*\(([^)]*)\)$/);
    if (gateMatch) {
      const id = gateMatch[1];
      const rawType = gateMatch[2].toUpperCase();
      const gInputs = parseInputList(gateMatch[3]);
      const moduleId = moduleStack[moduleStack.length - 1];
      if (GATE_TYPES.has(rawType)) {
        gates.push({ id, gateType: rawType, inputs: gInputs, moduleId });
      } else {
        gates.push({ id, gateType: "unknown", rawType: gateMatch[2], inputs: gInputs, moduleId });
        warnings.push(
          `Gate "${id}" has unrecognised type "${gateMatch[2]}"; drawn as a flagged placeholder.`
        );
      }
      continue;
    }
  }
  if (moduleStack.length > 0) {
    throw new LogicParseError(`Unclosed module (${moduleStack.length} open)`);
  }
  for (const out of outputs) {
    const mapped = explicitOutputFrom.get(out.id);
    if (mapped) out.from = mapped;
    else if (gates.some((g) => g.id === out.id)) out.from = out.id;
  }
  const known = /* @__PURE__ */ new Set([
    ...inputs.map((i) => i.id),
    ...gates.map((g) => g.id)
  ]);
  const autoDeclared = /* @__PURE__ */ new Set();
  for (const g of gates) {
    for (const inp of g.inputs) {
      const isLow = inp.startsWith("~");
      const clean = isLow ? inp.slice(1) : inp;
      if (!known.has(clean) && !autoDeclared.has(clean)) {
        autoDeclared.add(clean);
        inputs.push({
          id: clean,
          label: clean,
          isActiveLow: isLow || void 0,
          autoDeclared: true
        });
        warnings.push(
          `Signal "${clean}" referenced in gate ${g.id} was not declared; auto-declared as input.`
        );
      }
    }
  }
  return {
    type: "logic",
    title: title2,
    style: style ?? "ansi",
    inputs,
    outputs,
    gates,
    modules: modules.length > 0 ? modules : void 0,
    warnings: warnings.length > 0 ? warnings : void 0
  };
}

// src/diagrams/logic/symbols.ts
function combPins(nInputs, _width, leftX) {
  const pins = [];
  if (nInputs === 1) {
    pins.push({ id: "in1", x: leftX, y: 30 });
  } else if (nInputs === 2) {
    pins.push({ id: "in1", x: leftX, y: 15 });
    pins.push({ id: "in2", x: leftX, y: 45 });
  } else {
    const step = 50 / (nInputs - 1);
    for (let i = 0; i < nInputs; i++) {
      pins.push({ id: `in${i + 1}`, x: leftX, y: 5 + step * i });
    }
  }
  return pins;
}
function getGateGeometry(gateType, inputCount) {
  switch (gateType) {
    case "AND":
    case "NAND": {
      const bubble = gateType === "NAND";
      return {
        width: bubble ? 90 : 80,
        height: 60,
        inputPins: combPins(inputCount, 80, 20).map((p) => ({ ...p, x: 20 })),
        outputPins: [{ id: "out", x: bubble ? 90 : 80, y: 30, bubble }],
        ansiPath: "M 20,60 L 20,0 Q 80,0 80,30 Q 80,60 20,60 Z",
        outputBubble: bubble,
        iecLabel: "&"
      };
    }
    case "OR":
    case "NOR": {
      const bubble = gateType === "NOR";
      return {
        width: bubble ? 80 : 70,
        height: 60,
        inputPins: combPins(inputCount, 80, 18).map((p) => ({ ...p, x: 18 })),
        outputPins: [{ id: "out", x: bubble ? 80 : 70, y: 30, bubble }],
        ansiPath: "M 15,60 Q 10,30 15,0 Q 30,15 70,30 Q 30,45 15,60 Z",
        outputBubble: bubble,
        iecLabel: "\u22651"
      };
    }
    case "XOR":
    case "XNOR": {
      const bubble = gateType === "XNOR";
      return {
        width: bubble ? 80 : 70,
        height: 60,
        inputPins: combPins(inputCount, 80, 12).map((p) => ({ ...p, x: 12 })),
        outputPins: [{ id: "out", x: bubble ? 80 : 70, y: 30, bubble }],
        ansiPath: "M 15,60 Q 10,30 15,0 Q 30,15 70,30 Q 30,45 15,60 Z M 8,60 Q 3,30 8,0",
        outputBubble: bubble,
        iecLabel: "=1"
      };
    }
    case "NOT": {
      return {
        width: 70,
        height: 60,
        inputPins: [{ id: "in1", x: 10, y: 30 }],
        outputPins: [{ id: "out", x: 70, y: 30, bubble: true }],
        ansiPath: "M 10,55 L 60,30 L 10,5 Z",
        outputBubble: true,
        iecLabel: "1"
      };
    }
    case "BUF":
    case "SCHMITT": {
      return {
        width: 60,
        height: 60,
        inputPins: [{ id: "in1", x: 10, y: 30 }],
        outputPins: [{ id: "out", x: 60, y: 30 }],
        ansiPath: "M 10,55 L 60,30 L 10,5 Z",
        iecLabel: "1"
      };
    }
    case "TRISTATE_BUF":
    case "TRISTATE_INV":
    case "OPEN_DRAIN": {
      const bubble = gateType === "TRISTATE_INV";
      return {
        width: bubble ? 70 : 60,
        height: 70,
        inputPins: [
          { id: "in1", x: 10, y: 30 },
          { id: "en", x: 35, y: 65, label: "EN" }
        ],
        outputPins: [{ id: "out", x: bubble ? 70 : 60, y: 30, bubble }],
        ansiPath: "M 10,55 L 60,30 L 10,5 Z",
        outputBubble: bubble,
        iecLabel: "1"
      };
    }
    case "DFF": {
      return {
        width: 60,
        height: 80,
        inputPins: [
          { id: "D", x: 0, y: 20, label: "D" },
          { id: "CLK", x: 0, y: 50, label: "" }
        ],
        outputPins: [
          { id: "Q", x: 60, y: 20, label: "Q" },
          { id: "Qn", x: 60, y: 60, label: "Q\u0304", bubble: true }
        ],
        ansiPath: "M 0,0 H 60 V 80 H 0 Z",
        clockPin: "CLK",
        iecLabel: "DFF"
      };
    }
    case "JKFF": {
      return {
        width: 60,
        height: 80,
        inputPins: [
          { id: "J", x: 0, y: 15, label: "J" },
          { id: "CLK", x: 0, y: 40 },
          { id: "K", x: 0, y: 65, label: "K" }
        ],
        outputPins: [
          { id: "Q", x: 60, y: 20, label: "Q" },
          { id: "Qn", x: 60, y: 60, label: "Q\u0304", bubble: true }
        ],
        ansiPath: "M 0,0 H 60 V 80 H 0 Z",
        clockPin: "CLK",
        iecLabel: "JK"
      };
    }
    case "SRFF":
    case "LATCH_SR": {
      return {
        width: 60,
        height: 80,
        inputPins: [
          { id: "S", x: 0, y: 20, label: "S" },
          { id: "R", x: 0, y: 60, label: "R" }
        ],
        outputPins: [
          { id: "Q", x: 60, y: 20, label: "Q" },
          { id: "Qn", x: 60, y: 60, label: "Q\u0304", bubble: true }
        ],
        ansiPath: "M 0,0 H 60 V 80 H 0 Z",
        iecLabel: "SR"
      };
    }
    case "TFF": {
      return {
        width: 60,
        height: 80,
        inputPins: [
          { id: "T", x: 0, y: 20, label: "T" },
          { id: "CLK", x: 0, y: 50 }
        ],
        outputPins: [
          { id: "Q", x: 60, y: 20, label: "Q" },
          { id: "Qn", x: 60, y: 60, label: "Q\u0304", bubble: true }
        ],
        ansiPath: "M 0,0 H 60 V 80 H 0 Z",
        clockPin: "CLK",
        iecLabel: "T"
      };
    }
    case "LATCH_D": {
      return {
        width: 60,
        height: 80,
        inputPins: [
          { id: "D", x: 0, y: 20, label: "D" },
          { id: "E", x: 0, y: 60, label: "E" }
        ],
        outputPins: [
          { id: "Q", x: 60, y: 20, label: "Q" },
          { id: "Qn", x: 60, y: 60, label: "Q\u0304", bubble: true }
        ],
        ansiPath: "M 0,0 H 60 V 80 H 0 Z",
        iecLabel: "D"
      };
    }
    case "unknown": {
      const ins = Math.max(inputCount, 1);
      const inputPins = combPins(ins, 90, 0).map((p) => ({ ...p, x: 0 }));
      return {
        width: 90,
        height: 70,
        inputPins,
        outputPins: [{ id: "out", x: 90, y: 35 }],
        ansiPath: "M 0,0 H 90 V 70 H 0 Z",
        iecLabel: "?"
      };
    }
    default: {
      const ins = Math.max(inputCount, 2);
      const inputPins = combPins(ins, 100, 0).map((p, i) => ({
        ...p,
        x: 0,
        label: `I${i}`
      }));
      return {
        width: 100,
        height: 80,
        inputPins,
        outputPins: [{ id: "out", x: 100, y: 40 }],
        ansiPath: "M 0,0 H 100 V 80 H 0 Z",
        iecLabel: gateType
      };
    }
  }
}

// src/diagrams/logic/layout.ts
var LAYER_GAP = 80;
var ROW_GAP = 40;
var PORT_SIZE = 40;
var PORT_H = 30;
function layoutLogic(ast) {
  const layerOf = /* @__PURE__ */ new Map();
  for (const inp of ast.inputs) layerOf.set(inp.id, 0);
  const pending = new Set(ast.gates.map((g) => g.id));
  let safety = 0;
  while (pending.size > 0 && safety++ < 1e3) {
    for (const g of ast.gates) {
      if (!pending.has(g.id)) continue;
      let maxDep = -1;
      let ready = true;
      for (const inp of g.inputs) {
        const clean = inp.startsWith("~") ? inp.slice(1) : inp;
        const l = layerOf.get(clean);
        if (l === void 0) {
          ready = false;
          break;
        }
        if (l > maxDep) maxDep = l;
      }
      if (ready) {
        layerOf.set(g.id, maxDep + 1);
        pending.delete(g.id);
      }
    }
  }
  if (pending.size > 0) {
    for (const id of pending) layerOf.set(id, 1);
  }
  const outputLayer = Math.max(0, ...Array.from(layerOf.values())) + 1;
  const outTermId = (o) => `$out$${o.id}`;
  const portOutputs = ast.outputs.map((o) => ({
    ...o,
    termId: outTermId(o),
    source: o.from
  }));
  for (const o of portOutputs) layerOf.set(o.termId, outputLayer);
  const layers = /* @__PURE__ */ new Map();
  const addToLayer = (id, layer) => {
    if (!layers.has(layer)) layers.set(layer, []);
    layers.get(layer).push(id);
  };
  for (const i of ast.inputs) addToLayer(i.id, 0);
  for (const g of ast.gates) addToLayer(g.id, layerOf.get(g.id));
  for (const o of portOutputs) addToLayer(o.termId, outputLayer);
  const gateGeoms = /* @__PURE__ */ new Map();
  for (const g of ast.gates) {
    gateGeoms.set(g.id, getGateGeometry(g.gateType, g.inputs.length));
  }
  const nodes = [];
  const sortedLayers = Array.from(layers.keys()).sort((a, b) => a - b);
  const layerWidth = /* @__PURE__ */ new Map();
  for (const [layerIdx, ids] of layers) {
    let maxW = 60;
    for (const id of ids) {
      const g = gateGeoms.get(id);
      if (g && g.width > maxW) maxW = g.width;
      if (!g && layerIdx === 0) maxW = Math.max(maxW, PORT_SIZE);
      if (!g && layerIdx === outputLayer) maxW = Math.max(maxW, PORT_SIZE);
    }
    layerWidth.set(layerIdx, maxW);
  }
  let cursorX = 20;
  const layerStartMap = /* @__PURE__ */ new Map();
  for (const layerIdx of sortedLayers) {
    layerStartMap.set(layerIdx, cursorX);
    cursorX += (layerWidth.get(layerIdx) ?? 60) + LAYER_GAP;
  }
  const totalW = cursorX;
  const heightOf = (id) => {
    const g = gateGeoms.get(id);
    if (g) return g.height;
    return PORT_H;
  };
  let maxColH = 0;
  for (const ids of layers.values()) {
    const total = ids.reduce((s, id) => s + heightOf(id), 0) + (ids.length - 1) * ROW_GAP;
    if (total > maxColH) maxColH = total;
  }
  const totalH = maxColH + 80;
  const nodeInfo = /* @__PURE__ */ new Map();
  for (const [layerIdx, ids] of layers) {
    const xStart = layerStartMap.get(layerIdx);
    const total = ids.reduce((s, id) => s + heightOf(id), 0) + (ids.length - 1) * ROW_GAP;
    let y = 40 + (maxColH - total) / 2;
    for (const id of ids) {
      const h = heightOf(id);
      const g = gateGeoms.get(id);
      let node;
      if (layerIdx === 0) {
        const inp = ast.inputs.find((i) => i.id === id);
        node = {
          id,
          kind: "input",
          x: xStart,
          y,
          layer: 0,
          label: inp.label,
          isActiveLow: inp.isActiveLow
        };
      } else if (layerIdx === outputLayer && !g && id.startsWith("$out$")) {
        const out = portOutputs.find((o) => o.termId === id);
        node = {
          id,
          kind: "output",
          x: xStart,
          y,
          layer: outputLayer,
          label: out.label,
          isActiveLow: out.isActiveLow
        };
      } else {
        node = {
          id,
          kind: "gate",
          x: xStart,
          y,
          layer: layerIdx,
          geometry: g,
          gateType: ast.gates.find((gg) => gg.id === id).gateType,
          rawType: ast.gates.find((gg) => gg.id === id).rawType,
          label: id
        };
      }
      nodes.push(node);
      nodeInfo.set(id, node);
      y += h + ROW_GAP;
    }
  }
  const wires = [];
  const getSourcePoint = (id) => {
    const n = nodeInfo.get(id);
    if (!n) return null;
    if (n.kind === "input") return { x: n.x + PORT_SIZE, y: n.y + PORT_H / 2 };
    if (n.kind === "gate" && n.geometry) {
      const out = n.geometry.outputPins[0];
      return { x: n.x + out.x, y: n.y + out.y };
    }
    return null;
  };
  for (const g of ast.gates) {
    const target = nodeInfo.get(g.id);
    if (!target || !target.geometry) continue;
    g.inputs.forEach((rawInp, idx) => {
      const isLow = rawInp.startsWith("~");
      const srcId = isLow ? rawInp.slice(1) : rawInp;
      const src = getSourcePoint(srcId);
      if (!src) return;
      const pin = target.geometry.inputPins[idx];
      if (!pin) return;
      const toX = target.x + pin.x;
      const toY = target.y + pin.y;
      const midX = (src.x + toX) / 2;
      const path2 = `M ${src.x},${src.y} L ${midX},${src.y} L ${midX},${toY} L ${toX},${toY}`;
      wires.push({
        fromNode: srcId,
        fromX: src.x,
        fromY: src.y,
        toNode: g.id,
        toX,
        toY,
        isActiveLow: isLow,
        path: path2
      });
    });
  }
  for (const o of portOutputs) {
    const src = getSourcePoint(o.source);
    const target = nodeInfo.get(o.termId);
    if (!src || !target || target.kind !== "output") continue;
    const toX = target.x;
    const toY = target.y + PORT_H / 2;
    let path2;
    if (Math.abs(src.y - toY) < 0.5) {
      path2 = `M ${src.x},${src.y} L ${toX},${toY}`;
    } else {
      const midX = (src.x + toX) / 2;
      path2 = `M ${src.x},${src.y} L ${midX},${src.y} L ${midX},${toY} L ${toX},${toY}`;
    }
    wires.push({
      fromNode: o.source,
      fromX: src.x,
      fromY: src.y,
      toNode: o.termId,
      toX,
      toY,
      path: path2
    });
  }
  const modules = [];
  if (ast.modules && ast.modules.length > 0) {
    const PAD = 14;
    for (const mod of ast.modules) {
      const memberIds = new Set(
        ast.gates.filter((g) => g.moduleId === mod.id).map((g) => g.id)
      );
      if (memberIds.size === 0) continue;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of nodes) {
        if (!memberIds.has(n.id)) continue;
        const w = n.geometry?.width ?? 60;
        const h = n.geometry?.height ?? 60;
        if (n.x < minX) minX = n.x;
        if (n.y < minY) minY = n.y;
        if (n.x + w > maxX) maxX = n.x + w;
        if (n.y + h > maxY) maxY = n.y + h;
      }
      if (!isFinite(minX)) continue;
      modules.push({
        id: mod.id,
        label: mod.label,
        x: minX - PAD,
        y: minY - PAD - 4,
        width: maxX - minX + PAD * 2,
        height: maxY - minY + PAD * 2 + 4
      });
    }
  }
  return { width: totalW, height: totalH, nodes, wires, modules };
}

// src/diagrams/logic/renderer.ts
var PORT_SIZE2 = 40;
var PORT_H2 = 30;
function renderGateBody(n, style) {
  const out = [];
  if (!n.geometry) return out;
  const g = n.geometry;
  if (style === "iec") {
    out.push(
      chunk7ZEDTSU3_cjs.el("rect", {
        x: 0,
        y: 0,
        width: g.width,
        height: g.height,
        class: "schematex-logic-gate-body"
      })
    );
    if (g.iecLabel) {
      out.push(
        chunk7ZEDTSU3_cjs.text(
          {
            x: g.width / 2,
            y: g.height / 2 + 4,
            class: "schematex-logic-gate-iec-label",
            "text-anchor": "middle"
          },
          g.iecLabel
        )
      );
    }
  } else {
    out.push(
      chunk7ZEDTSU3_cjs.el("path", { d: g.ansiPath, class: "schematex-logic-gate-body" })
    );
  }
  if (n.gateType === "unknown" && style !== "iec") {
    out.push(
      chunk7ZEDTSU3_cjs.text(
        {
          x: g.width / 2,
          y: g.height / 2 + 6,
          class: "schematex-logic-gate-iec-label",
          "text-anchor": "middle"
        },
        "?"
      )
    );
  }
  if (g.outputBubble) {
    const op = g.outputPins[0];
    out.push(
      chunk7ZEDTSU3_cjs.circle({
        cx: op.x - 4,
        cy: op.y,
        r: 4,
        class: "schematex-logic-bubble"
      })
    );
  }
  if (g.clockPin) {
    const cp = g.inputPins.find((p) => p.id === g.clockPin);
    if (cp) {
      out.push(
        chunk7ZEDTSU3_cjs.polygon({
          points: `${cp.x},${cp.y - 5} ${cp.x + 8},${cp.y} ${cp.x},${cp.y + 5}`,
          class: "schematex-logic-clock-tri"
        })
      );
    }
  }
  for (const op of g.outputPins) {
    if (op.bubble && op.id !== "out") {
      out.push(
        chunk7ZEDTSU3_cjs.circle({
          cx: op.x + 4,
          cy: op.y,
          r: 4,
          class: "schematex-logic-bubble"
        })
      );
    }
  }
  for (const pin of g.inputPins) {
    if (pin.label && pin.id !== g.clockPin) {
      out.push(
        chunk7ZEDTSU3_cjs.text(
          {
            x: pin.x + 5,
            y: pin.y + 3,
            class: "schematex-logic-pin-label"
          },
          pin.label
        )
      );
    }
  }
  for (const pin of g.outputPins) {
    if (pin.label) {
      out.push(
        chunk7ZEDTSU3_cjs.text(
          {
            x: pin.x - 6,
            y: pin.y + 3,
            class: "schematex-logic-pin-label",
            "text-anchor": "end"
          },
          pin.label
        )
      );
    }
  }
  if (style === "ansi" && g.iecLabel && g.height >= 60) {
    const labelX = g.width / 2;
    const labelY = g.height + 14;
    out.push(
      chunk7ZEDTSU3_cjs.text(
        {
          x: labelX,
          y: labelY,
          class: "schematex-logic-gate-type",
          "text-anchor": "middle"
        },
        n.gateType === "unknown" ? n.rawType ?? "?" : n.gateType ?? ""
      )
    );
  }
  return out;
}
function renderLogic(ast, config) {
  const style = ast.style ?? "ansi";
  const layout = layoutLogic(ast);
  const { width, height } = layout;
  const t = chunk7ZEDTSU3_cjs.resolveIndustrialTheme(config?.theme ?? "default");
  const gateSvgs = [];
  const portSvgs = [];
  const moduleSvgs = [];
  for (const m of layout.modules) {
    moduleSvgs.push(
      chunk7ZEDTSU3_cjs.group({ "data-module-id": m.id }, [
        chunk7ZEDTSU3_cjs.el("rect", {
          x: m.x,
          y: m.y,
          width: m.width,
          height: m.height,
          rx: 6,
          class: "schematex-logic-module"
        }),
        chunk7ZEDTSU3_cjs.text(
          {
            x: m.x + 10,
            y: m.y + 14,
            class: "schematex-logic-module-label"
          },
          m.label
        )
      ])
    );
  }
  for (const n of layout.nodes) {
    if (n.kind === "gate") {
      gateSvgs.push(
        chunk7ZEDTSU3_cjs.group(
          {
            transform: `translate(${n.x}, ${n.y})`,
            "data-gate-id": n.id,
            "data-gate-type": n.gateType ?? ""
          },
          renderGateBody(n, style)
        )
      );
    } else if (n.kind === "input") {
      const cy = PORT_H2 / 2;
      portSvgs.push(
        chunk7ZEDTSU3_cjs.group({ transform: `translate(${n.x}, ${n.y})`, "data-port": "input" }, [
          chunk7ZEDTSU3_cjs.text(
            {
              x: 0,
              y: cy + 4,
              "text-anchor": "start",
              class: "schematex-logic-port-label"
            },
            n.label
          ),
          chunk7ZEDTSU3_cjs.el("line", {
            x1: PORT_SIZE2 - 12,
            y1: cy,
            x2: n.isActiveLow ? PORT_SIZE2 - 8 : PORT_SIZE2,
            y2: cy,
            class: "schematex-logic-wire"
          }),
          n.isActiveLow ? chunk7ZEDTSU3_cjs.circle({
            cx: PORT_SIZE2 - 4,
            cy,
            r: 4,
            class: "schematex-logic-bubble"
          }) : ""
        ])
      );
    } else if (n.kind === "output") {
      const cy = PORT_H2 / 2;
      portSvgs.push(
        chunk7ZEDTSU3_cjs.group({ transform: `translate(${n.x}, ${n.y})`, "data-port": "output" }, [
          chunk7ZEDTSU3_cjs.el("line", {
            x1: 0,
            y1: cy,
            x2: 12,
            y2: cy,
            class: "schematex-logic-wire"
          }),
          chunk7ZEDTSU3_cjs.text(
            {
              x: 16,
              y: cy + 4,
              "text-anchor": "start",
              class: "schematex-logic-port-label"
            },
            n.label
          )
        ])
      );
    }
  }
  const wireSvgs = layout.wires.map((w) => {
    const extras = [];
    if (w.isActiveLow) {
      extras.push(
        chunk7ZEDTSU3_cjs.circle({
          cx: w.toX - 4,
          cy: w.toY,
          r: 4,
          class: "schematex-logic-bubble"
        })
      );
    }
    return [
      chunk7ZEDTSU3_cjs.path({
        d: w.path,
        class: "schematex-logic-wire",
        "data-from": w.fromNode,
        "data-to": w.toNode
      }),
      ...extras
    ].join("");
  });
  const css = `
.schematex-logic { font-family: system-ui, -apple-system, sans-serif; }
.schematex-logic-gate-body { fill: none; stroke: ${t.strokeHeavy}; stroke-width: 1.75; stroke-linejoin: round; }
.schematex-logic-bubble { fill: ${t.bg}; stroke: ${t.strokeHeavy}; stroke-width: 1.5; }
.schematex-logic-clock-tri { fill: none; stroke: ${t.strokeHeavy}; stroke-width: 1.5; stroke-linejoin: round; }
.schematex-logic-wire { stroke: ${t.strokeHeavy}; stroke-width: 1.5; fill: none; stroke-linecap: square; }
.schematex-logic-port-label { font: 13px system-ui, sans-serif; fill: ${t.text}; }
.schematex-logic-pin-label { font: 9px sans-serif; fill: ${t.stroke}; }
.schematex-logic-gate-type { font: 10px sans-serif; fill: ${t.textMuted}; }
.schematex-logic-gate-iec-label { font: bold 13px sans-serif; fill: ${t.text}; }
.schematex-logic-title { font: 700 16px sans-serif; fill: ${t.text}; }
.schematex-logic-module { fill: none; stroke: ${t.textMuted}; stroke-width: 1.25; stroke-dasharray: 6 4; }
.schematex-logic-module-label { font: 11px sans-serif; fill: ${t.textMuted}; font-style: italic; }
[data-gate-type="unknown"] .schematex-logic-gate-body { stroke: ${t.accent}; stroke-dasharray: 5 3; }
[data-gate-type="unknown"] .schematex-logic-gate-iec-label { fill: ${t.accent}; }
`.trim();
  const titleSvg = ast.title ? chunk7ZEDTSU3_cjs.text(
    {
      x: width / 2,
      y: 18,
      "text-anchor": "middle",
      class: "schematex-logic-title"
    },
    ast.title
  ) : "";
  return chunk7ZEDTSU3_cjs.svgRoot(
    {
      class: "schematex-logic",
      viewBox: `0 0 ${width} ${height + (ast.title ? 20 : 0)}`,
      width,
      height: height + (ast.title ? 20 : 0),
      role: "img",
      "data-diagram-type": "logic"
    },
    [
      chunk7ZEDTSU3_cjs.title(ast.title ?? "Logic Gate Diagram"),
      chunk7ZEDTSU3_cjs.desc(
        `Logic gate diagram with ${ast.gates.length} gates, ${ast.inputs.length} inputs, ${ast.outputs.length} outputs`
      ),
      chunk7ZEDTSU3_cjs.defs([chunk7ZEDTSU3_cjs.el("style", {}, css)]),
      chunk7ZEDTSU3_cjs.group(
        { transform: `translate(0, ${ast.title ? 20 : 0})` },
        [
          chunk7ZEDTSU3_cjs.group({ class: "schematex-logic-modules" }, moduleSvgs),
          chunk7ZEDTSU3_cjs.group({ class: "schematex-logic-wires" }, wireSvgs),
          chunk7ZEDTSU3_cjs.group({ class: "schematex-logic-gates" }, gateSvgs),
          chunk7ZEDTSU3_cjs.group({ class: "schematex-logic-ports" }, portSvgs)
        ]
      ),
      titleSvg
    ]
  );
}

// src/diagrams/logic/lint.ts
var KNOWN_GATES = [
  "AND",
  "OR",
  "NOT",
  "NAND",
  "NOR",
  "XOR",
  "XNOR",
  "BUF",
  "TRISTATE_BUF",
  "TRISTATE_INV",
  "OPEN_DRAIN",
  "SCHMITT",
  "DFF",
  "JKFF",
  "SRFF",
  "TFF",
  "LATCH_SR",
  "LATCH_D",
  "MUX",
  "DEMUX",
  "DECODER",
  "ENCODER",
  "COUNTER",
  "SHIFT_REG"
];
function lintLogic(text2) {
  let ast;
  try {
    ast = parseLogic(text2);
  } catch {
    return [];
  }
  return lintLogicAst(ast);
}
function lintLogicAst(ast) {
  const out = [];
  for (const g of ast.gates) {
    if (g.gateType !== "unknown") continue;
    const raw = g.rawType ?? "";
    out.push({
      severity: "warning",
      code: "LOGIC_UNKNOWN_GATE",
      message: `gate "${g.id}" has unrecognised type "${raw}"; drawn as a flagged placeholder`,
      hint: `"${raw}" is not a known logic gate.${chunkSBB6C4OP_cjs.didYouMean(raw.toUpperCase(), KNOWN_GATES)} Valid gates include AND, OR, NOT, NAND, NOR, XOR, DFF, MUX. See docs/reference.`,
      fatal: false
    });
  }
  return out;
}

// src/diagrams/logic/index.ts
var logic = {
  type: "logic",
  detect(text2) {
    const first = text2.trim().split("\n")[0]?.trim().toLowerCase() ?? "";
    return first.startsWith("logic");
  },
  parse: parseLogic,
  lint: lintLogic,
  render(text2, config) {
    const ast = parseLogic(text2);
    return renderLogic(ast, config);
  }
};

exports.getGateGeometry = getGateGeometry;
exports.layoutLogic = layoutLogic;
exports.lintLogic = lintLogic;
exports.lintLogicAst = lintLogicAst;
exports.logic = logic;
exports.parseLogic = parseLogic;
exports.renderLogic = renderLogic;
//# sourceMappingURL=chunk-MPA7DBNQ.cjs.map
//# sourceMappingURL=chunk-MPA7DBNQ.cjs.map