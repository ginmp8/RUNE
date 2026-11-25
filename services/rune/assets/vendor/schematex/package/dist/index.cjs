'use strict';

var chunkGOHAZF4E_cjs = require('./chunk-GOHAZF4E.cjs');
var chunkH5EDPYH7_cjs = require('./chunk-H5EDPYH7.cjs');
var chunkSRCHQ5FQ_cjs = require('./chunk-SRCHQ5FQ.cjs');
var chunk5A6CVYMM_cjs = require('./chunk-5A6CVYMM.cjs');
var chunk5ZC74S6U_cjs = require('./chunk-5ZC74S6U.cjs');
var chunkRETPPUXH_cjs = require('./chunk-RETPPUXH.cjs');
var chunkFDQVLYPZ_cjs = require('./chunk-FDQVLYPZ.cjs');
var chunk3SMTOXJD_cjs = require('./chunk-3SMTOXJD.cjs');
var chunkOLKFF6SV_cjs = require('./chunk-OLKFF6SV.cjs');
var chunkI75B52F2_cjs = require('./chunk-I75B52F2.cjs');
var chunkVZAMNYRV_cjs = require('./chunk-VZAMNYRV.cjs');
var chunkGUCP6AKN_cjs = require('./chunk-GUCP6AKN.cjs');
var chunkNTS45SH6_cjs = require('./chunk-NTS45SH6.cjs');
var chunk3GSIJMSI_cjs = require('./chunk-3GSIJMSI.cjs');
var chunkOO27E4GU_cjs = require('./chunk-OO27E4GU.cjs');
var chunkJXJQEYL3_cjs = require('./chunk-JXJQEYL3.cjs');
require('./chunk-VGO4AJ4K.cjs');
var chunkICLXRCSE_cjs = require('./chunk-ICLXRCSE.cjs');
var chunkJNSP3SUJ_cjs = require('./chunk-JNSP3SUJ.cjs');
require('./chunk-2JVEMVHO.cjs');
var chunkQPXUX7WK_cjs = require('./chunk-QPXUX7WK.cjs');
require('./chunk-EQMWWNB3.cjs');
require('./chunk-54Q7JDQB.cjs');
var chunkMPA7DBNQ_cjs = require('./chunk-MPA7DBNQ.cjs');
require('./chunk-SBB6C4OP.cjs');
require('./chunk-4M6OFAHM.cjs');
var chunk7ZEDTSU3_cjs = require('./chunk-7ZEDTSU3.cjs');

// src/symbols-catalog.ts
function humanize(id) {
  return id.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function svgDoc(viewBox, css, inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" class="lt-symbol"><style>${css}</style>${inner}</svg>`;
}
var CIRCUIT_CSS = ".schematex-circuit-body{stroke:#0f172a;stroke-width:1.75;fill:none;stroke-linejoin:round;stroke-linecap:round}.schematex-circuit-fill{stroke:#0f172a;stroke-width:1.5;fill:#0f172a}.schematex-circuit-wire{stroke:#0f172a;stroke-width:1.75;fill:none;stroke-linecap:square}";
function circuitCatalog() {
  const symbols = chunk5ZC74S6U_cjs.SYMBOLS;
  const out = [];
  for (const [id, def] of Object.entries(symbols)) {
    if (!def) continue;
    const L = def.length || 40;
    const inner = def.svg();
    out.push({ id, label: humanize(id), svg: svgDoc(`-10 -24 ${L + 20} 48`, CIRCUIT_CSS, inner) });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}
var SLD_CSS = ".lt-sld-stroke{stroke:#0f172a;stroke-width:1.8;fill:none}.lt-sld-stroke-thick{stroke:#0f172a;stroke-width:2.4;fill:none;stroke-linecap:round}.lt-sld-fill{fill:#ffffff;stroke:#0f172a;stroke-width:2}.lt-sld-fill-dark{fill:#0f172a;stroke:#0f172a;stroke-width:1}.lt-sld-dot{fill:#0f172a;stroke:none}.lt-sld-wire{stroke:#0f172a;stroke-width:2;fill:none}.lt-sld-bus{stroke:#0f172a;stroke-width:6;stroke-linecap:square}.lt-sld-symbol-text{font:11px sans-serif;fill:#0f172a;dominant-baseline:middle}.lt-sld-wdg{font:bold 10px sans-serif;fill:#0f172a;dominant-baseline:middle}";
var SLD_TYPES = [
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
  "breaker",
  "breaker_vacuum",
  "recloser",
  "switch",
  "switch_load",
  "ground_switch",
  "sectionalizer",
  "fuse",
  "fuse_cl",
  "motor",
  "load",
  "capacitor_bank",
  "harmonic_filter",
  "vfd",
  "ats",
  "ct",
  "pt",
  "relay",
  "surge_arrester",
  "watthour_meter",
  "demand_meter",
  "ground_fault",
  "bus",
  "bus_tie",
  "hub"
];
function sldCatalog() {
  const out = [];
  for (const type of SLD_TYPES) {
    let inner;
    try {
      inner = chunk3SMTOXJD_cjs.renderSymbol(type);
    } catch {
      continue;
    }
    const g = chunk3SMTOXJD_cjs.geometryFor(type);
    const w = Math.max(g.halfWidth, 18) + 12;
    const top = Math.min(g.topY, -22) - 8;
    const bot = Math.max(g.bottomY, 22) + 8;
    out.push({
      id: type,
      label: humanize(type),
      svg: svgDoc(`${-w} ${top} ${2 * w} ${bot - top}`, SLD_CSS, inner)
    });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}
var PID_CSS = ".lt-pid-equip{fill:#ffffff;stroke:#1d1d1d;stroke-width:1.6}.lt-pid-equip-tag{font:600 11px system-ui,sans-serif;fill:#1d1d1d}.lt-pid-process{stroke:#1d1d1d;stroke-width:2.6;fill:none}.lt-pid-process-min{stroke:#1d1d1d;stroke-width:1.5;fill:none}";
function pidCatalog() {
  const out = [];
  const pad = 12;
  for (const [id, g] of Object.entries(chunkH5EDPYH7_cjs.GEOMETRY)) {
    let inner;
    try {
      inner = chunkH5EDPYH7_cjs.renderEquip(id, "");
    } catch {
      continue;
    }
    out.push({
      id,
      label: humanize(id),
      svg: svgDoc(
        `${-g.width / 2 - pad} ${-g.height / 2 - pad} ${g.width + 2 * pad} ${g.height + 2 * pad}`,
        PID_CSS,
        inner
      )
    });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}
var FC_ICON_CSS = ".sx-fc-icon{stroke:#0f172a;fill:none}.sx-fc-icon-fill{fill:#0f172a}";
function flowchartIconCatalog() {
  return chunkGUCP6AKN_cjs.iconNames().map((name) => ({
    id: name,
    label: humanize(name),
    svg: svgDoc("-13 -13 26 26", FC_ICON_CSS, chunkGUCP6AKN_cjs.renderIcon(name))
  })).sort((a, b) => a.label.localeCompare(b.label));
}
var LOGIC_CSS = ".schematex-logic-gate-body{fill:none;stroke:#0f172a;stroke-width:1.75;stroke-linejoin:round}.schematex-logic-bubble{fill:#ffffff;stroke:#0f172a;stroke-width:1.5}.schematex-logic-wire{stroke:#0f172a;stroke-width:1.5;fill:none;stroke-linecap:square}.schematex-logic-gate-iec-label{font:bold 13px sans-serif;fill:#0f172a}";
var LOGIC_TYPES = [
  "AND",
  "OR",
  "NOT",
  "NAND",
  "NOR",
  "XOR",
  "XNOR",
  "BUF",
  "TRISTATE_BUF",
  "OPEN_DRAIN",
  "SCHMITT",
  "DFF",
  "JKFF",
  "SRFF",
  "TFF",
  "LATCH_D",
  "LATCH_SR",
  "MUX",
  "DEMUX",
  "DECODER",
  "ENCODER",
  "COUNTER",
  "SHIFT_REG"
];
var SINGLE_INPUT = /* @__PURE__ */ new Set(["NOT", "BUF", "SCHMITT", "TRISTATE_BUF", "TRISTATE_INV", "OPEN_DRAIN", "DFF", "TFF"]);
function logicCatalog() {
  const out = [];
  for (const type of LOGIC_TYPES) {
    let g;
    try {
      g = chunkMPA7DBNQ_cjs.getGateGeometry(type, SINGLE_INPUT.has(type) ? 1 : 2);
    } catch {
      continue;
    }
    const parts = [`<path d="${g.ansiPath}" class="schematex-logic-gate-body"/>`];
    for (const p of g.inputPins) parts.push(`<line x1="${p.x - 10}" y1="${p.y}" x2="${p.x}" y2="${p.y}" class="schematex-logic-wire"/>`);
    for (const p of g.outputPins) {
      const bub = p.bubble || g.outputBubble;
      const ox = bub ? p.x + 6 : p.x;
      if (bub) parts.push(`<circle cx="${p.x + 3}" cy="${p.y}" r="3" class="schematex-logic-bubble"/>`);
      parts.push(`<line x1="${ox}" y1="${p.y}" x2="${ox + 10}" y2="${p.y}" class="schematex-logic-wire"/>`);
    }
    out.push({
      id: type,
      label: humanize(type),
      svg: svgDoc(`-14 -6 ${g.width + 28} ${g.height + 12}`, LOGIC_CSS, parts.join(""))
    });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}
var NETWORK_CSS = ".sx-net-body{fill:#ffffff;stroke:#0f172a;stroke-width:2}.sx-net-detail{fill:none;stroke:#0f172a;stroke-width:1}.sx-net-glyph{fill:#2563eb;stroke:none}.sx-net-glyph-line{fill:none;stroke:#2563eb;stroke-width:1.4}.sx-net-icontext{font:700 8px sans-serif;fill:#2563eb}.sx-net-cloud-body{fill:#f1f5f9;stroke:#0f172a;stroke-width:2}.sx-net-cloudtext{font:600 13px sans-serif;fill:#0f172a}.sx-net-bus{stroke:#0f172a;stroke-width:4;stroke-linecap:round}";
var NETWORK_KINDS = [
  "router",
  "switch",
  "l3switch",
  "poeswitch",
  "firewall",
  "loadbalancer",
  "ap",
  "wlc",
  "gateway",
  "modem",
  "ids",
  "proxy",
  "vpngw",
  "server",
  "serverfarm",
  "pc",
  "laptop",
  "mobile",
  "ipphone",
  "printer",
  "storage",
  "camera",
  "nvr",
  "dvr",
  "encoder",
  "monitor",
  "internet",
  "cloud"
];
function networkCatalog() {
  const out = [];
  for (const kind of NETWORK_KINDS) {
    const { w, h } = chunkH5EDPYH7_cjs.iconSize(kind);
    const device = { id: kind, kind, label: humanize(kind), groups: [] };
    let inner;
    try {
      inner = chunkH5EDPYH7_cjs.drawDeviceIcon(device, { x: 0, y: 0, w, h });
    } catch {
      continue;
    }
    out.push({
      id: kind,
      label: humanize(kind),
      svg: svgDoc(`-6 -6 ${w + 12} ${h + 12}`, NETWORK_CSS, inner)
    });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}
var FLOORPLAN_CSS = ".sx-fp-furn{fill:#ffffff;stroke:#475569;stroke-width:1.2}.sx-fp-furn-nofill{fill:none;stroke:#475569;stroke-width:1.2}.sx-fp-furn-line{fill:none;stroke:#475569;stroke-width:1}.sx-fp-furn-dash{fill:none;stroke:#475569;stroke-width:1;stroke-dasharray:4 3}.sx-fp-furn-dot{fill:#475569;stroke:none}.sx-fp-furn-solid{fill:#334155;stroke:none}.sx-fp-board-inner{fill:#ffffff;stroke:none}.sx-fp-chair{fill:#f1f5f9;stroke:#475569;stroke-width:1}.sx-fp-rug{fill:none;stroke:#94a3b8;stroke-width:1.2;stroke-dasharray:5 4}.sx-fp-hatch{fill:none;stroke:#cbd5e1;stroke-width:1}.sx-fp-furn-text{font-weight:600;font-family:sans-serif;fill:#475569}";
function floorplanCatalog() {
  const scale = 40;
  const px = (m) => Math.round(m * scale * 100) / 100;
  const out = [];
  for (const [id, def] of Object.entries(chunkH5EDPYH7_cjs.FLOORPLAN_SYMBOLS)) {
    const [mt, mr, mb, ml] = def.envelope ?? [0, 0, 0, 0];
    const pad = 5;
    const x0 = -px(ml) - pad;
    const y0 = -px(mt) - pad;
    const w = px(def.w + ml + mr) + 2 * pad;
    const h = px(def.h + mt + mb) + 2 * pad;
    out.push({
      id,
      label: humanize(id),
      svg: svgDoc(`${x0} ${y0} ${w} ${h}`, FLOORPLAN_CSS, def.draw({ w: def.w, h: def.h, px }))
    });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}
var CATALOGS = {
  circuit: () => ({
    type: "circuit",
    label: "Circuit components",
    note: "IEEE 315 / ANSI Y32.2 schematic symbols the netlist/positional engine draws.",
    entries: circuitCatalog()
  }),
  sld: () => ({
    type: "sld",
    label: "Single-line apparatus",
    note: "IEEE 315 power-apparatus symbols \u2014 sources, transformers, switching, protection, loads.",
    entries: sldCatalog()
  }),
  pid: () => ({
    type: "pid",
    label: "P&ID equipment",
    note: "ANSI/ISA-5.1 process equipment \u2014 tanks, columns, exchangers, pumps, and more.",
    entries: pidCatalog()
  }),
  logic: () => ({
    type: "logic",
    label: "Logic gates",
    note: "IEEE 91 ANSI gate bodies \u2014 combinational gates, flip-flops, latches, MUX/decoder, counters.",
    entries: logicCatalog()
  }),
  network: () => ({
    type: "network",
    label: "Network devices",
    note: "Cisco-convention topology icons \u2014 routers, switches, firewalls, servers, cameras, clouds.",
    entries: networkCatalog()
  }),
  flowchart: () => ({
    type: "flowchart",
    label: "Node icons",
    note: "Inline node icons (servers, databases, cloud, gear\u2026) usable on any flowchart node.",
    entries: flowchartIconCatalog()
  }),
  floorplan: () => ({
    type: "floorplan",
    label: "Floor plan furniture & fixtures",
    note: "AGS plan-view symbols \u2014 auto-seated tables, beds, kitchen/bath fixtures, classroom and event/banquet furniture.",
    entries: floorplanCatalog()
  })
};
var SYMBOL_CATALOG_TYPES = Object.keys(CATALOGS);
function getSymbolCatalog(type) {
  const factory = CATALOGS[type];
  return factory ? factory() : null;
}

Object.defineProperty(exports, "INTERACTIVE_CAPABILITIES", {
  enumerable: true,
  get: function () { return chunkGOHAZF4E_cjs.INTERACTIVE_CAPABILITIES; }
});
Object.defineProperty(exports, "INTERACTIVE_DIAGRAM_COUNT", {
  enumerable: true,
  get: function () { return chunkGOHAZF4E_cjs.INTERACTIVE_DIAGRAM_COUNT; }
});
Object.defineProperty(exports, "POSITION_EDITABLE_DIAGRAM_COUNT", {
  enumerable: true,
  get: function () { return chunkGOHAZF4E_cjs.POSITION_EDITABLE_DIAGRAM_COUNT; }
});
Object.defineProperty(exports, "getInteractiveCapabilities", {
  enumerable: true,
  get: function () { return chunkGOHAZF4E_cjs.getInteractiveCapabilities; }
});
Object.defineProperty(exports, "isInteractiveDiagramType", {
  enumerable: true,
  get: function () { return chunkGOHAZF4E_cjs.isInteractiveDiagramType; }
});
Object.defineProperty(exports, "bowtie", {
  enumerable: true,
  get: function () { return chunkH5EDPYH7_cjs.bowtie; }
});
Object.defineProperty(exports, "causalloop", {
  enumerable: true,
  get: function () { return chunkH5EDPYH7_cjs.causalloop; }
});
Object.defineProperty(exports, "comparison", {
  enumerable: true,
  get: function () { return chunkH5EDPYH7_cjs.comparison; }
});
Object.defineProperty(exports, "decisiontree", {
  enumerable: true,
  get: function () { return chunkH5EDPYH7_cjs.decisiontree; }
});
Object.defineProperty(exports, "epc", {
  enumerable: true,
  get: function () { return chunkH5EDPYH7_cjs.epc; }
});
Object.defineProperty(exports, "eventtree", {
  enumerable: true,
  get: function () { return chunkH5EDPYH7_cjs.eventtree; }
});
Object.defineProperty(exports, "faulttree", {
  enumerable: true,
  get: function () { return chunkH5EDPYH7_cjs.faulttree; }
});
Object.defineProperty(exports, "floorplan", {
  enumerable: true,
  get: function () { return chunkH5EDPYH7_cjs.floorplan; }
});
Object.defineProperty(exports, "fmea", {
  enumerable: true,
  get: function () { return chunkH5EDPYH7_cjs.fmea; }
});
Object.defineProperty(exports, "gitgraph", {
  enumerable: true,
  get: function () { return chunkH5EDPYH7_cjs.gitgraph; }
});
Object.defineProperty(exports, "idef0", {
  enumerable: true,
  get: function () { return chunkH5EDPYH7_cjs.idef0; }
});
Object.defineProperty(exports, "markov", {
  enumerable: true,
  get: function () { return chunkH5EDPYH7_cjs.markov; }
});
Object.defineProperty(exports, "network", {
  enumerable: true,
  get: function () { return chunkH5EDPYH7_cjs.network; }
});
Object.defineProperty(exports, "parse", {
  enumerable: true,
  get: function () { return chunkH5EDPYH7_cjs.parse; }
});
Object.defineProperty(exports, "parseResult", {
  enumerable: true,
  get: function () { return chunkH5EDPYH7_cjs.parseResult; }
});
Object.defineProperty(exports, "pert", {
  enumerable: true,
  get: function () { return chunkH5EDPYH7_cjs.pert; }
});
Object.defineProperty(exports, "petri", {
  enumerable: true,
  get: function () { return chunkH5EDPYH7_cjs.petri; }
});
Object.defineProperty(exports, "pid", {
  enumerable: true,
  get: function () { return chunkH5EDPYH7_cjs.pid; }
});
Object.defineProperty(exports, "playbook", {
  enumerable: true,
  get: function () { return chunkH5EDPYH7_cjs.playbook; }
});
Object.defineProperty(exports, "prisma", {
  enumerable: true,
  get: function () { return chunkH5EDPYH7_cjs.prisma; }
});
Object.defineProperty(exports, "rbd", {
  enumerable: true,
  get: function () { return chunkH5EDPYH7_cjs.rbd; }
});
Object.defineProperty(exports, "render", {
  enumerable: true,
  get: function () { return chunkH5EDPYH7_cjs.render; }
});
Object.defineProperty(exports, "renderPreview", {
  enumerable: true,
  get: function () { return chunkH5EDPYH7_cjs.renderPreview; }
});
Object.defineProperty(exports, "renderResult", {
  enumerable: true,
  get: function () { return chunkH5EDPYH7_cjs.renderResult; }
});
Object.defineProperty(exports, "sequence", {
  enumerable: true,
  get: function () { return chunkH5EDPYH7_cjs.sequence; }
});
Object.defineProperty(exports, "state", {
  enumerable: true,
  get: function () { return chunkH5EDPYH7_cjs.state; }
});
Object.defineProperty(exports, "threatmodel", {
  enumerable: true,
  get: function () { return chunkH5EDPYH7_cjs.threatmodel; }
});
Object.defineProperty(exports, "timeline", {
  enumerable: true,
  get: function () { return chunkH5EDPYH7_cjs.timeline; }
});
Object.defineProperty(exports, "umlclass", {
  enumerable: true,
  get: function () { return chunkH5EDPYH7_cjs.umlclass; }
});
Object.defineProperty(exports, "usecase", {
  enumerable: true,
  get: function () { return chunkH5EDPYH7_cjs.usecase; }
});
Object.defineProperty(exports, "welding", {
  enumerable: true,
  get: function () { return chunkH5EDPYH7_cjs.welding; }
});
Object.defineProperty(exports, "orgchart", {
  enumerable: true,
  get: function () { return chunkSRCHQ5FQ_cjs.orgchart; }
});
Object.defineProperty(exports, "siteplan", {
  enumerable: true,
  get: function () { return chunk5A6CVYMM_cjs.siteplan; }
});
Object.defineProperty(exports, "circuit", {
  enumerable: true,
  get: function () { return chunk5ZC74S6U_cjs.circuit; }
});
Object.defineProperty(exports, "blockdiagram", {
  enumerable: true,
  get: function () { return chunkRETPPUXH_cjs.blockdiagram; }
});
Object.defineProperty(exports, "ladder", {
  enumerable: true,
  get: function () { return chunkFDQVLYPZ_cjs.ladder; }
});
Object.defineProperty(exports, "sld", {
  enumerable: true,
  get: function () { return chunk3SMTOXJD_cjs.sld; }
});
Object.defineProperty(exports, "entity", {
  enumerable: true,
  get: function () { return chunkOLKFF6SV_cjs.entity; }
});
Object.defineProperty(exports, "fishbone", {
  enumerable: true,
  get: function () { return chunkI75B52F2_cjs.fishbone; }
});
Object.defineProperty(exports, "venn", {
  enumerable: true,
  get: function () { return chunkVZAMNYRV_cjs.venn; }
});
Object.defineProperty(exports, "flowchart", {
  enumerable: true,
  get: function () { return chunkGUCP6AKN_cjs.flowchart; }
});
Object.defineProperty(exports, "applyPins", {
  enumerable: true,
  get: function () { return chunkNTS45SH6_cjs.applyPins; }
});
Object.defineProperty(exports, "prunePins", {
  enumerable: true,
  get: function () { return chunkNTS45SH6_cjs.prunePins; }
});
Object.defineProperty(exports, "reattachPins", {
  enumerable: true,
  get: function () { return chunkNTS45SH6_cjs.reattachPins; }
});
Object.defineProperty(exports, "setLabel", {
  enumerable: true,
  get: function () { return chunkNTS45SH6_cjs.setLabel; }
});
Object.defineProperty(exports, "setPosition", {
  enumerable: true,
  get: function () { return chunkNTS45SH6_cjs.setPosition; }
});
Object.defineProperty(exports, "stripPins", {
  enumerable: true,
  get: function () { return chunkNTS45SH6_cjs.stripPins; }
});
Object.defineProperty(exports, "genogram", {
  enumerable: true,
  get: function () { return chunk3GSIJMSI_cjs.genogram; }
});
Object.defineProperty(exports, "ecomap", {
  enumerable: true,
  get: function () { return chunkOO27E4GU_cjs.ecomap; }
});
Object.defineProperty(exports, "pedigree", {
  enumerable: true,
  get: function () { return chunkJXJQEYL3_cjs.pedigree; }
});
Object.defineProperty(exports, "phylo", {
  enumerable: true,
  get: function () { return chunkICLXRCSE_cjs.phylo; }
});
Object.defineProperty(exports, "sociogram", {
  enumerable: true,
  get: function () { return chunkJNSP3SUJ_cjs.sociogram; }
});
Object.defineProperty(exports, "timing", {
  enumerable: true,
  get: function () { return chunkQPXUX7WK_cjs.timing; }
});
Object.defineProperty(exports, "logic", {
  enumerable: true,
  get: function () { return chunkMPA7DBNQ_cjs.logic; }
});
Object.defineProperty(exports, "BASE_THEMES", {
  enumerable: true,
  get: function () { return chunk7ZEDTSU3_cjs.BASE_THEMES; }
});
Object.defineProperty(exports, "BIOLOGY_TOKENS", {
  enumerable: true,
  get: function () { return chunk7ZEDTSU3_cjs.BIOLOGY_TOKENS; }
});
Object.defineProperty(exports, "NETWORK_TOKENS", {
  enumerable: true,
  get: function () { return chunk7ZEDTSU3_cjs.NETWORK_TOKENS; }
});
Object.defineProperty(exports, "PERSON_TOKENS", {
  enumerable: true,
  get: function () { return chunk7ZEDTSU3_cjs.PERSON_TOKENS; }
});
Object.defineProperty(exports, "PETRI_TOKENS", {
  enumerable: true,
  get: function () { return chunk7ZEDTSU3_cjs.PETRI_TOKENS; }
});
Object.defineProperty(exports, "VENN_TOKENS", {
  enumerable: true,
  get: function () { return chunk7ZEDTSU3_cjs.VENN_TOKENS; }
});
Object.defineProperty(exports, "resolveBaseTheme", {
  enumerable: true,
  get: function () { return chunk7ZEDTSU3_cjs.resolveBaseTheme; }
});
Object.defineProperty(exports, "resolveBiologyTheme", {
  enumerable: true,
  get: function () { return chunk7ZEDTSU3_cjs.resolveBiologyTheme; }
});
Object.defineProperty(exports, "resolveFishboneTheme", {
  enumerable: true,
  get: function () { return chunk7ZEDTSU3_cjs.resolveFishboneTheme; }
});
Object.defineProperty(exports, "resolveGenogramTheme", {
  enumerable: true,
  get: function () { return chunk7ZEDTSU3_cjs.resolveGenogramTheme; }
});
Object.defineProperty(exports, "resolveNetworkTheme", {
  enumerable: true,
  get: function () { return chunk7ZEDTSU3_cjs.resolveNetworkTheme; }
});
Object.defineProperty(exports, "resolvePersonTheme", {
  enumerable: true,
  get: function () { return chunk7ZEDTSU3_cjs.resolvePersonTheme; }
});
Object.defineProperty(exports, "resolvePetriTheme", {
  enumerable: true,
  get: function () { return chunk7ZEDTSU3_cjs.resolvePetriTheme; }
});
Object.defineProperty(exports, "resolveTimelineTheme", {
  enumerable: true,
  get: function () { return chunk7ZEDTSU3_cjs.resolveTimelineTheme; }
});
Object.defineProperty(exports, "resolveVennTheme", {
  enumerable: true,
  get: function () { return chunk7ZEDTSU3_cjs.resolveVennTheme; }
});
exports.SYMBOL_CATALOG_TYPES = SYMBOL_CATALOG_TYPES;
exports.getSymbolCatalog = getSymbolCatalog;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map