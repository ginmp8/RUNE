'use strict';

var chunkEQMWWNB3_cjs = require('./chunk-EQMWWNB3.cjs');
var chunk54Q7JDQB_cjs = require('./chunk-54Q7JDQB.cjs');
var chunk4M6OFAHM_cjs = require('./chunk-4M6OFAHM.cjs');
var chunk7ZEDTSU3_cjs = require('./chunk-7ZEDTSU3.cjs');

// src/diagrams/circuit/symbols.ts
var BODY = 'class="schematex-circuit-body"';
var FILL = 'class="schematex-circuit-fill"';
var WIRE = 'class="schematex-circuit-wire"';
function lineWire(x1, y1, x2, y2) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${WIRE}/>`;
}
var resistor = {
  length: 40,
  anchors: { start: { x: 0, y: 0 }, end: { x: 40, y: 0 } },
  svg: () => `<path d="M 0,0 L 5,0 L 8,-8 L 12,8 L 16,-8 L 20,8 L 24,-8 L 28,8 L 32,-8 L 35,0 L 40,0" ${BODY}/>`
};
var capacitor = {
  length: 20,
  anchors: { start: { x: 0, y: 0 }, end: { x: 20, y: 0 } },
  svg: () => [
    lineWire(0, 0, 8, 0),
    `<line x1="8" y1="-10" x2="8" y2="10" ${BODY}/>`,
    `<line x1="12" y1="-10" x2="12" y2="10" ${BODY}/>`,
    lineWire(12, 0, 20, 0)
  ].join("")
};
var electrolytic_cap = {
  length: 20,
  anchors: { start: { x: 0, y: 0 }, end: { x: 20, y: 0 } },
  svg: () => [
    lineWire(0, 0, 8, 0),
    `<line x1="8" y1="-10" x2="8" y2="10" ${BODY}/>`,
    `<path d="M 12,-10 Q 16,0 12,10" fill="none" class="schematex-circuit-body"/>`,
    lineWire(12, 0, 20, 0),
    `<text x="5" y="-12" class="schematex-circuit-pol">\u2212</text>`,
    `<text x="15" y="-12" class="schematex-circuit-pol">+</text>`
  ].join("")
};
var inductor = {
  length: 40,
  anchors: { start: { x: 0, y: 0 }, end: { x: 40, y: 0 } },
  svg: () => `<path d="M 0,0 L 5,0 A 5,5 0 0 1 15,0 A 5,5 0 0 1 25,0 A 5,5 0 0 1 35,0 L 40,0" fill="none" ${BODY}/>`
};
var fuse = {
  length: 30,
  anchors: { start: { x: 0, y: 0 }, end: { x: 30, y: 0 } },
  svg: () => [
    lineWire(0, 0, 5, 0),
    `<rect x="5" y="-5" width="20" height="10" rx="5" fill="none" ${BODY}/>`,
    `<line x1="5" y1="0" x2="25" y2="0" ${BODY}/>`,
    lineWire(25, 0, 30, 0)
  ].join("")
};
var crystal = {
  length: 40,
  anchors: { start: { x: 0, y: 0 }, end: { x: 40, y: 0 } },
  svg: () => [
    lineWire(0, 0, 10, 0),
    `<line x1="10" y1="-9" x2="10" y2="9" ${BODY}/>`,
    `<rect x="14" y="-7" width="12" height="14" fill="none" ${BODY}/>`,
    `<line x1="30" y1="-9" x2="30" y2="9" ${BODY}/>`,
    lineWire(30, 0, 40, 0)
  ].join("")
};
var transformer = {
  length: 60,
  netlistPins: ["p1", "p2", "s1", "s2"],
  anchors: {
    start: { x: 0, y: 0 },
    end: { x: 60, y: 0 },
    p1: { x: 0, y: 0 },
    p2: { x: 0, y: 0 },
    s1: { x: 60, y: 0 },
    s2: { x: 60, y: 0 }
  },
  svg: () => [
    // Primary coils (left)
    `<path d="M 5,-18 A 5,5 0 0 1 5,-8 A 5,5 0 0 1 5,2 A 5,5 0 0 1 5,12 A 5,5 0 0 1 5,22" fill="none" ${BODY}/>`,
    lineWire(0, 0, 5, 0),
    // Core lines
    `<line x1="28" y1="-20" x2="28" y2="22" ${BODY}/>`,
    `<line x1="32" y1="-20" x2="32" y2="22" ${BODY}/>`,
    // Secondary coils (right)
    `<path d="M 55,-18 A 5,5 0 0 0 55,-8 A 5,5 0 0 0 55,2 A 5,5 0 0 0 55,12 A 5,5 0 0 0 55,22" fill="none" ${BODY}/>`,
    lineWire(55, 0, 60, 0)
  ].join("")
};
var voltage_source = {
  length: 40,
  netlistPins: ["plus", "minus"],
  // plus/minus aliases: end = +, start = − (matches on-symbol label)
  anchors: {
    start: { x: 0, y: 0 },
    end: { x: 40, y: 0 },
    minus: { x: 0, y: 0 },
    plus: { x: 40, y: 0 }
  },
  svg: () => [
    lineWire(0, 0, 8, 0),
    `<circle cx="20" cy="0" r="12" fill="white" ${BODY}/>`,
    `<text x="16" y="-2" class="schematex-circuit-pol">+</text>`,
    `<text x="23" y="8" class="schematex-circuit-pol">\u2212</text>`,
    lineWire(32, 0, 40, 0)
  ].join("")
};
var current_source = {
  length: 40,
  netlistPins: ["plus", "minus"],
  anchors: {
    start: { x: 0, y: 0 },
    end: { x: 40, y: 0 },
    minus: { x: 0, y: 0 },
    plus: { x: 40, y: 0 }
  },
  svg: () => [
    lineWire(0, 0, 8, 0),
    `<circle cx="20" cy="0" r="12" fill="white" ${BODY}/>`,
    `<line x1="14" y1="0" x2="24" y2="0" ${BODY}/>`,
    `<polygon points="26,0 20,-4 20,4" ${FILL}/>`,
    lineWire(32, 0, 40, 0)
  ].join("")
};
var ac_source = {
  length: 40,
  netlistPins: ["plus", "minus"],
  anchors: {
    start: { x: 0, y: 0 },
    end: { x: 40, y: 0 },
    minus: { x: 0, y: 0 },
    plus: { x: 40, y: 0 }
  },
  svg: () => [
    lineWire(0, 0, 8, 0),
    `<circle cx="20" cy="0" r="12" fill="white" ${BODY}/>`,
    `<path d="M 14,0 Q 17,-6 20,0 Q 23,6 26,0" fill="none" ${BODY}/>`,
    lineWire(32, 0, 40, 0)
  ].join("")
};
var battery = {
  length: 24,
  netlistPins: ["plus", "minus"],
  anchors: {
    start: { x: 0, y: 0 },
    end: { x: 24, y: 0 },
    minus: { x: 0, y: 0 },
    plus: { x: 24, y: 0 }
  },
  svg: () => [
    lineWire(0, 0, 8, 0),
    `<line x1="8" y1="-8" x2="8" y2="8" ${BODY}/>`,
    `<line x1="12" y1="-4" x2="12" y2="4" ${BODY}/>`,
    `<line x1="14" y1="-8" x2="14" y2="8" ${BODY}/>`,
    `<line x1="18" y1="-4" x2="18" y2="4" ${BODY}/>`,
    lineWire(18, 0, 24, 0)
  ].join("")
};
var ground = {
  length: 20,
  anchors: { start: { x: 0, y: 0 }, end: { x: 20, y: 0 } },
  // Drawn as a "terminal" — vertical connection at start, earth lines below
  svg: () => [
    `<line x1="0" y1="0" x2="10" y2="0" ${WIRE}/>`,
    `<line x1="10" y1="-8" x2="10" y2="8" ${BODY}/>`,
    `<line x1="6" y1="4" x2="14" y2="4" ${BODY}/>`,
    `<line x1="8" y1="8" x2="12" y2="8" ${BODY}/>`
  ].join("")
};
var gnd_signal = {
  length: 20,
  anchors: { start: { x: 0, y: 0 }, end: { x: 20, y: 0 } },
  svg: () => [
    `<line x1="0" y1="0" x2="8" y2="0" ${WIRE}/>`,
    `<polygon points="8,-6 8,6 16,0" ${FILL}/>`
  ].join("")
};
var vcc = {
  length: 20,
  anchors: { start: { x: 0, y: 0 }, end: { x: 20, y: 0 } },
  svg: () => [
    `<line x1="0" y1="0" x2="10" y2="0" ${WIRE}/>`,
    `<line x1="4" y1="-6" x2="16" y2="-6" ${BODY}/>`
  ].join("")
};
var diode = {
  length: 30,
  anchors: { start: { x: 0, y: 0 }, end: { x: 30, y: 0 } },
  svg: () => [
    lineWire(0, 0, 8, 0),
    `<polygon points="8,-8 8,8 22,0" ${FILL}/>`,
    `<line x1="22" y1="-8" x2="22" y2="8" ${BODY}/>`,
    lineWire(22, 0, 30, 0)
  ].join("")
};
var zener = {
  length: 30,
  anchors: { start: { x: 0, y: 0 }, end: { x: 30, y: 0 } },
  svg: () => [
    lineWire(0, 0, 8, 0),
    `<polygon points="8,-8 8,8 22,0" ${FILL}/>`,
    `<path d="M 18,-10 L 22,-8 L 22,8 L 26,10" fill="none" ${BODY}/>`,
    lineWire(22, 0, 30, 0)
  ].join("")
};
var schottky = {
  length: 30,
  anchors: { start: { x: 0, y: 0 }, end: { x: 30, y: 0 } },
  svg: () => [
    lineWire(0, 0, 8, 0),
    `<polygon points="8,-8 8,8 22,0" ${FILL}/>`,
    `<path d="M 18,-4 L 18,-8 L 22,-8 L 22,8 L 26,8 L 26,4" fill="none" ${BODY}/>`,
    lineWire(22, 0, 30, 0)
  ].join("")
};
var led = {
  length: 30,
  anchors: { start: { x: 0, y: 0 }, end: { x: 30, y: 0 } },
  svg: () => [
    lineWire(0, 0, 8, 0),
    `<polygon points="8,-8 8,8 22,0" ${FILL}/>`,
    `<line x1="22" y1="-8" x2="22" y2="8" ${BODY}/>`,
    lineWire(22, 0, 30, 0),
    // outward light arrows
    `<path d="M 12,-10 L 20,-18 M 18,-18 L 20,-18 L 20,-16" fill="none" ${BODY}/>`,
    `<path d="M 16,-10 L 24,-18 M 22,-18 L 24,-18 L 24,-16" fill="none" ${BODY}/>`
  ].join("")
};
var photodiode = {
  length: 30,
  anchors: { start: { x: 0, y: 0 }, end: { x: 30, y: 0 } },
  svg: () => [
    lineWire(0, 0, 8, 0),
    `<polygon points="8,-8 8,8 22,0" ${FILL}/>`,
    `<line x1="22" y1="-8" x2="22" y2="8" ${BODY}/>`,
    lineWire(22, 0, 30, 0),
    // inward light arrows
    `<path d="M 20,-18 L 12,-10 M 12,-12 L 12,-10 L 14,-10" fill="none" ${BODY}/>`,
    `<path d="M 24,-18 L 16,-10 M 16,-12 L 16,-10 L 18,-10" fill="none" ${BODY}/>`
  ].join("")
};
var npn = {
  length: 40,
  netlistPins: ["c", "b", "e"],
  // base at left, collector up-right, emitter down-right
  anchors: {
    start: { x: 0, y: 0 },
    end: { x: 40, y: -16 },
    base: { x: 0, y: 0 },
    collector: { x: 40, y: -16 },
    emitter: { x: 40, y: 16 },
    b: { x: 0, y: 0 },
    c: { x: 40, y: -16 },
    e: { x: 40, y: 16 }
  },
  svg: () => [
    `<circle cx="20" cy="0" r="16" fill="white" ${BODY}/>`,
    `<line x1="14" y1="-10" x2="14" y2="10" ${BODY}/>`,
    lineWire(0, 0, 14, 0),
    `<line x1="14" y1="-6" x2="30" y2="-12" ${BODY}/>`,
    lineWire(30, -12, 40, -16),
    `<line x1="14" y1="6" x2="30" y2="12" ${BODY}/>`,
    lineWire(30, 12, 40, 16),
    // NPN arrow (outward on emitter)
    `<polygon points="30,12 24,10 26,16" ${FILL}/>`
  ].join("")
};
var pnp = {
  length: 40,
  netlistPins: ["c", "b", "e"],
  anchors: {
    start: { x: 0, y: 0 },
    end: { x: 40, y: -16 },
    base: { x: 0, y: 0 },
    collector: { x: 40, y: 16 },
    emitter: { x: 40, y: -16 },
    b: { x: 0, y: 0 },
    c: { x: 40, y: 16 },
    e: { x: 40, y: -16 }
  },
  svg: () => [
    `<circle cx="20" cy="0" r="16" fill="white" ${BODY}/>`,
    `<line x1="14" y1="-10" x2="14" y2="10" ${BODY}/>`,
    lineWire(0, 0, 14, 0),
    `<line x1="14" y1="-6" x2="30" y2="-12" ${BODY}/>`,
    lineWire(30, -12, 40, -16),
    `<line x1="14" y1="6" x2="30" y2="12" ${BODY}/>`,
    lineWire(30, 12, 40, 16),
    // PNP arrow (inward on emitter → toward base line)
    `<polygon points="14,-6 20,-4 18,-10" ${FILL}/>`
  ].join("")
};
var nmos = {
  length: 40,
  netlistPins: ["d", "g", "s"],
  anchors: {
    start: { x: 0, y: 0 },
    end: { x: 40, y: -16 },
    gate: { x: 0, y: 0 },
    drain: { x: 40, y: -16 },
    source: { x: 40, y: 16 },
    g: { x: 0, y: 0 },
    d: { x: 40, y: -16 },
    s: { x: 40, y: 16 }
  },
  svg: () => [
    lineWire(0, 0, 14, 0),
    `<line x1="14" y1="-12" x2="14" y2="12" ${BODY}/>`,
    `<line x1="18" y1="-10" x2="18" y2="-4" ${BODY}/>`,
    `<line x1="18" y1="-2" x2="18" y2="2" ${BODY}/>`,
    `<line x1="18" y1="4" x2="18" y2="10" ${BODY}/>`,
    `<line x1="18" y1="-8" x2="32" y2="-8" ${BODY}/>`,
    lineWire(32, -8, 40, -16),
    `<line x1="18" y1="8" x2="32" y2="8" ${BODY}/>`,
    lineWire(32, 8, 40, 16),
    `<polygon points="22,0 18,-4 18,4" ${FILL}/>`
  ].join("")
};
var pmos = {
  length: 40,
  netlistPins: ["d", "g", "s"],
  anchors: {
    start: { x: 0, y: 0 },
    end: { x: 40, y: -16 },
    gate: { x: 0, y: 0 },
    source: { x: 40, y: -16 },
    drain: { x: 40, y: 16 },
    g: { x: 0, y: 0 },
    s: { x: 40, y: -16 },
    d: { x: 40, y: 16 }
  },
  svg: () => [
    lineWire(0, 0, 14, 0),
    `<line x1="14" y1="-12" x2="14" y2="12" ${BODY}/>`,
    `<line x1="18" y1="-10" x2="18" y2="-4" ${BODY}/>`,
    `<line x1="18" y1="-2" x2="18" y2="2" ${BODY}/>`,
    `<line x1="18" y1="4" x2="18" y2="10" ${BODY}/>`,
    `<line x1="18" y1="-8" x2="32" y2="-8" ${BODY}/>`,
    lineWire(32, -8, 40, -16),
    `<line x1="18" y1="8" x2="32" y2="8" ${BODY}/>`,
    lineWire(32, 8, 40, 16),
    `<polygon points="14,0 18,-4 18,4" ${FILL}/>`
  ].join("")
};
var jfet_n = {
  length: 40,
  netlistPins: ["d", "g", "s"],
  anchors: {
    start: { x: 0, y: 0 },
    end: { x: 40, y: -16 },
    gate: { x: 0, y: 0 },
    drain: { x: 40, y: -16 },
    source: { x: 40, y: 16 },
    g: { x: 0, y: 0 },
    d: { x: 40, y: -16 },
    s: { x: 40, y: 16 }
  },
  svg: () => [
    lineWire(0, 0, 14, 0),
    `<line x1="14" y1="-12" x2="14" y2="12" ${BODY}/>`,
    `<line x1="14" y1="-8" x2="32" y2="-8" ${BODY}/>`,
    lineWire(32, -8, 40, -16),
    `<line x1="14" y1="8" x2="32" y2="8" ${BODY}/>`,
    lineWire(32, 8, 40, 16),
    `<polygon points="14,0 10,-4 10,4" ${FILL}/>`
  ].join("")
};
var jfet_p = {
  length: 40,
  netlistPins: ["d", "g", "s"],
  anchors: {
    start: { x: 0, y: 0 },
    end: { x: 40, y: -16 },
    gate: { x: 0, y: 0 },
    drain: { x: 40, y: -16 },
    source: { x: 40, y: 16 },
    g: { x: 0, y: 0 },
    d: { x: 40, y: -16 },
    s: { x: 40, y: 16 }
  },
  svg: () => [
    lineWire(0, 0, 14, 0),
    `<line x1="14" y1="-12" x2="14" y2="12" ${BODY}/>`,
    `<line x1="14" y1="-8" x2="32" y2="-8" ${BODY}/>`,
    lineWire(32, -8, 40, -16),
    `<line x1="14" y1="8" x2="32" y2="8" ${BODY}/>`,
    lineWire(32, 8, 40, 16),
    `<polygon points="10,0 14,-4 14,4" ${FILL}/>`
  ].join("")
};
var opamp = {
  length: 50,
  netlistPins: ["plus", "minus", "out"],
  anchors: {
    start: { x: 0, y: 0 },
    end: { x: 50, y: 0 },
    plus: { x: 0, y: -10 },
    minus: { x: 0, y: 10 },
    out: { x: 50, y: 0 },
    "supply+": { x: 25, y: -20 },
    "supply-": { x: 25, y: 20 }
  },
  svg: () => [
    `<polygon points="0,-20 0,20 50,0" fill="white" ${BODY}/>`,
    `<text x="5" y="-6" class="schematex-circuit-pol">+</text>`,
    `<text x="5" y="14" class="schematex-circuit-pol">\u2212</text>`
  ].join("")
};
var comparator = {
  length: 50,
  netlistPins: ["plus", "minus", "out"],
  anchors: {
    start: { x: 0, y: 0 },
    end: { x: 50, y: 0 },
    plus: { x: 0, y: -10 },
    minus: { x: 0, y: 10 },
    out: { x: 50, y: 0 }
  },
  svg: () => [
    `<polygon points="0,-20 0,20 50,0" fill="white" ${BODY}/>`,
    `<text x="5" y="-6" class="schematex-circuit-pol">+</text>`,
    `<text x="5" y="14" class="schematex-circuit-pol">\u2212</text>`,
    `<circle cx="48" cy="0" r="3" fill="white" ${BODY}/>`
  ].join("")
};
var switch_spst = {
  length: 40,
  anchors: { start: { x: 0, y: 0 }, end: { x: 40, y: 0 } },
  svg: () => [
    lineWire(0, 0, 10, 0),
    `<line x1="10" y1="0" x2="30" y2="-10" ${BODY}/>`,
    `<circle cx="10" cy="0" r="2" ${FILL}/>`,
    `<circle cx="30" cy="0" r="2" ${FILL}/>`,
    lineWire(30, 0, 40, 0)
  ].join("")
};
var push_no = {
  length: 40,
  anchors: { start: { x: 0, y: 0 }, end: { x: 40, y: 0 } },
  svg: () => [
    lineWire(0, 0, 12, 0),
    lineWire(28, 0, 40, 0),
    `<circle cx="12" cy="0" r="2" ${FILL}/>`,
    `<circle cx="28" cy="0" r="2" ${FILL}/>`,
    `<line x1="12" y1="-4" x2="28" y2="-4" ${BODY}/>`,
    `<line x1="20" y1="-4" x2="20" y2="-12" ${BODY}/>`,
    `<line x1="14" y1="-12" x2="26" y2="-12" ${BODY}/>`
  ].join("")
};
var meterSvg = (letter) => () => [
  lineWire(0, 0, 8, 0),
  `<circle cx="20" cy="0" r="12" fill="white" ${BODY}/>`,
  `<text x="20" y="4" text-anchor="middle" class="schematex-circuit-meter">${letter}</text>`,
  lineWire(32, 0, 40, 0)
].join("");
var ammeter = { length: 40, anchors: { start: { x: 0, y: 0 }, end: { x: 40, y: 0 } }, svg: meterSvg("A") };
var voltmeter = { length: 40, anchors: { start: { x: 0, y: 0 }, end: { x: 40, y: 0 } }, svg: meterSvg("V") };
var wattmeter = { length: 40, anchors: { start: { x: 0, y: 0 }, end: { x: 40, y: 0 } }, svg: meterSvg("W") };
var motor = { length: 40, anchors: { start: { x: 0, y: 0 }, end: { x: 40, y: 0 } }, svg: meterSvg("M") };
var lamp = {
  length: 40,
  anchors: { start: { x: 0, y: 0 }, end: { x: 40, y: 0 } },
  svg: () => [
    lineWire(0, 0, 8, 0),
    `<circle cx="20" cy="0" r="12" fill="white" ${BODY}/>`,
    `<line x1="12" y1="-8" x2="28" y2="8" ${BODY}/>`,
    `<line x1="12" y1="8" x2="28" y2="-8" ${BODY}/>`,
    lineWire(32, 0, 40, 0)
  ].join("")
};
var buzzer = {
  length: 40,
  anchors: { start: { x: 0, y: 0 }, end: { x: 40, y: 0 } },
  svg: () => [
    lineWire(0, 0, 8, 0),
    `<path d="M 8,0 A 12,12 0 0 1 32,0 L 8,0 Z" fill="white" ${BODY}/>`,
    lineWire(32, 0, 40, 0)
  ].join("")
};
var speaker = {
  length: 40,
  anchors: { start: { x: 0, y: 0 }, end: { x: 40, y: 0 } },
  svg: () => [
    lineWire(0, 0, 6, 0),
    `<rect x="6" y="-8" width="10" height="16" fill="white" ${BODY}/>`,
    `<path d="M 16,-8 L 28,-16 L 28,16 L 16,8 Z" fill="white" ${BODY}/>`,
    lineWire(0, 8, 6, 8)
  ].join("")
};
var microphone = {
  length: 40,
  anchors: { start: { x: 0, y: 0 }, end: { x: 40, y: 0 } },
  svg: () => [
    lineWire(0, 0, 8, 0),
    `<circle cx="20" cy="0" r="12" fill="white" ${BODY}/>`,
    `<line x1="20" y1="-10" x2="20" y2="10" ${BODY}/>`,
    lineWire(32, 0, 40, 0)
  ].join("")
};
var rheostat = {
  length: 50,
  anchors: { start: { x: 0, y: 0 }, end: { x: 50, y: 0 } },
  svg: () => [
    `<path d="M 0,0 L 10,0 L 13,-8 L 18,8 L 23,-8 L 28,8 L 33,-8 L 38,8 L 40,0 L 50,0" ${BODY}/>`,
    `<line x1="5" y1="12" x2="45" y2="-12" ${BODY}/>`,
    `<polygon points="45,-12 40,-9 44,-5" ${FILL}/>`
  ].join("")
};
var thermistor_ntc = {
  length: 50,
  anchors: { start: { x: 0, y: 0 }, end: { x: 50, y: 0 } },
  svg: () => [
    `<path d="M 0,0 L 10,0 L 13,-8 L 18,8 L 23,-8 L 28,8 L 33,-8 L 38,8 L 40,0 L 50,0" ${BODY}/>`,
    `<line x1="5" y1="10" x2="45" y2="-10" ${BODY}/>`,
    `<text x="40" y="-14" class="schematex-circuit-pol">-t\xB0</text>`
  ].join("")
};
var thermistor_ptc = {
  length: 50,
  anchors: { start: { x: 0, y: 0 }, end: { x: 50, y: 0 } },
  svg: () => [
    `<path d="M 0,0 L 10,0 L 13,-8 L 18,8 L 23,-8 L 28,8 L 33,-8 L 38,8 L 40,0 L 50,0" ${BODY}/>`,
    `<line x1="5" y1="10" x2="45" y2="-10" ${BODY}/>`,
    `<text x="40" y="-14" class="schematex-circuit-pol">+t\xB0</text>`
  ].join("")
};
var ldr = {
  length: 50,
  anchors: { start: { x: 0, y: 0 }, end: { x: 50, y: 0 } },
  svg: () => [
    `<path d="M 0,0 L 10,0 L 13,-8 L 18,8 L 23,-8 L 28,8 L 33,-8 L 38,8 L 40,0 L 50,0" ${BODY}/>`,
    `<circle cx="25" cy="-2" r="14" fill="none" ${BODY}/>`,
    `<path d="M 10,-24 L 18,-16 M 14,-16 L 18,-16 L 18,-20" fill="none" ${BODY}/>`,
    `<path d="M 20,-24 L 28,-16 M 24,-16 L 28,-16 L 28,-20" fill="none" ${BODY}/>`
  ].join("")
};
var variable_cap = {
  length: 24,
  anchors: { start: { x: 0, y: 0 }, end: { x: 24, y: 0 } },
  svg: () => [
    lineWire(0, 0, 10, 0),
    `<line x1="10" y1="-10" x2="10" y2="10" ${BODY}/>`,
    `<line x1="14" y1="-10" x2="14" y2="10" ${BODY}/>`,
    lineWire(14, 0, 24, 0),
    `<line x1="3" y1="10" x2="21" y2="-12" ${BODY}/>`,
    `<polygon points="21,-12 15,-10 19,-6" ${FILL}/>`
  ].join("")
};
var variable_inductor = {
  length: 40,
  anchors: { start: { x: 0, y: 0 }, end: { x: 40, y: 0 } },
  svg: () => [
    `<path d="M 0,0 L 5,0 A 5,5 0 0 1 15,0 A 5,5 0 0 1 25,0 A 5,5 0 0 1 35,0 L 40,0" fill="none" ${BODY}/>`,
    `<line x1="0" y1="10" x2="38" y2="-14" ${BODY}/>`,
    `<polygon points="38,-14 32,-12 36,-8" ${FILL}/>`
  ].join("")
};
var switch_spdt = {
  length: 50,
  netlistPins: ["common", "nc", "no"],
  anchors: {
    start: { x: 0, y: 0 },
    end: { x: 50, y: 0 },
    common: { x: 0, y: 0 },
    nc: { x: 50, y: -12 },
    no: { x: 50, y: 12 }
  },
  svg: () => [
    lineWire(0, 0, 10, 0),
    `<circle cx="10" cy="0" r="2" ${FILL}/>`,
    `<line x1="10" y1="0" x2="40" y2="-12" ${BODY}/>`,
    `<circle cx="42" cy="-12" r="2" ${FILL}/>`,
    lineWire(42, -12, 50, -12),
    `<circle cx="42" cy="12" r="2" ${FILL}/>`,
    lineWire(42, 12, 50, 12)
  ].join("")
};
var push_nc = {
  length: 40,
  anchors: { start: { x: 0, y: 0 }, end: { x: 40, y: 0 } },
  svg: () => [
    lineWire(0, 0, 12, 0),
    lineWire(28, 0, 40, 0),
    `<circle cx="12" cy="0" r="2" ${FILL}/>`,
    `<circle cx="28" cy="0" r="2" ${FILL}/>`,
    `<line x1="10" y1="0" x2="30" y2="0" ${BODY}/>`,
    `<line x1="20" y1="0" x2="20" y2="-10" ${BODY}/>`,
    `<line x1="14" y1="-10" x2="26" y2="-10" ${BODY}/>`
  ].join("")
};
var gnd_chassis = {
  length: 20,
  anchors: { start: { x: 0, y: 0 }, end: { x: 20, y: 0 } },
  svg: () => [
    `<line x1="0" y1="0" x2="10" y2="0" ${WIRE}/>`,
    `<line x1="10" y1="-6" x2="10" y2="6" ${BODY}/>`,
    `<line x1="10" y1="6" x2="14" y2="10" ${BODY}/>`,
    `<line x1="10" y1="2" x2="14" y2="6" ${BODY}/>`,
    `<line x1="10" y1="-2" x2="14" y2="2" ${BODY}/>`
  ].join("")
};
var gnd_digital = {
  length: 20,
  anchors: { start: { x: 0, y: 0 }, end: { x: 20, y: 0 } },
  svg: () => [
    `<line x1="0" y1="0" x2="10" y2="0" ${WIRE}/>`,
    `<polygon points="8,-6 8,6 16,0" fill="none" ${BODY}/>`
  ].join("")
};
var test_point = {
  length: 16,
  anchors: { start: { x: 0, y: 0 }, end: { x: 16, y: 0 } },
  svg: () => [
    lineWire(0, 0, 6, 0),
    `<circle cx="10" cy="0" r="4" fill="white" ${BODY}/>`
  ].join("")
};
var no_connect = {
  length: 0,
  anchors: { start: { x: 0, y: 0 }, end: { x: 0, y: 0 } },
  svg: () => [
    `<line x1="-5" y1="-5" x2="5" y2="5" ${BODY}/>`,
    `<line x1="5" y1="-5" x2="-5" y2="5" ${BODY}/>`
  ].join("")
};
var antenna = {
  length: 30,
  anchors: { start: { x: 0, y: 0 }, end: { x: 30, y: 0 } },
  svg: () => [
    lineWire(0, 0, 0, -10),
    `<line x1="0" y1="-10" x2="-10" y2="-24" ${BODY}/>`,
    `<line x1="0" y1="-10" x2="10" y2="-24" ${BODY}/>`
  ].join("")
};
function icSymbol(defaultLeft, defaultRight, bodyLabel) {
  const BODY_W = 80;
  return {
    length: BODY_W,
    netlistPins: [],
    anchors: {
      start: { x: 0, y: 0 },
      end: { x: BODY_W, y: 0 }
    },
    svg: (_label, _value, attrs) => {
      const left = attrs?.pins_left ? attrs.pins_left.split(",").map((s) => s.trim()) : defaultLeft;
      const right = attrs?.pins_right ? attrs.pins_right.split(",").map((s) => s.trim()) : defaultRight;
      const n = Math.max(left.length, right.length, 2);
      const pitch = 16;
      const bodyH = pitch * (n + 1);
      const topY = -bodyH / 2;
      const parts = [];
      parts.push(`<rect x="0" y="${topY}" width="${BODY_W}" height="${bodyH}" fill="white" ${BODY}/>`);
      const labelText = attrs?.ic_label ?? bodyLabel ?? "";
      if (labelText) {
        parts.push(`<text x="${BODY_W / 2}" y="3" text-anchor="middle" class="schematex-circuit-meter">${labelText}</text>`);
      }
      for (let i = 0; i < left.length; i++) {
        const y = topY + pitch * (i + 1);
        parts.push(`<line x1="-8" y1="${y}" x2="0" y2="${y}" ${WIRE}/>`);
        parts.push(`<text x="4" y="${y + 3}" class="schematex-circuit-pol">${left[i]}</text>`);
      }
      for (let i = 0; i < right.length; i++) {
        const y = topY + pitch * (i + 1);
        parts.push(`<line x1="${BODY_W}" y1="${y}" x2="${BODY_W + 8}" y2="${y}" ${WIRE}/>`);
        parts.push(`<text x="${BODY_W - 4}" y="${y + 3}" text-anchor="end" class="schematex-circuit-pol">${right[i]}</text>`);
      }
      return parts.join("");
    }
  };
}
var generic_ic = icSymbol(
  ["1", "2", "3", "4"],
  ["8", "7", "6", "5"],
  "IC"
);
var timer_555 = (() => {
  const left = ["GND", "TRG", "OUT", "RST"];
  const right = ["VCC", "DIS", "THR", "CTL"];
  const sym = icSymbol(left, right, "555");
  const BODY_W = 80;
  const pitch = 16;
  const n = 4;
  const topY = -80 / 2;
  const anchors = {
    start: { x: 0, y: 0 },
    end: { x: BODY_W, y: 0 }
  };
  const leftNames = ["gnd", "trg", "out", "rst"];
  const rightNames = ["vcc", "dis", "thr", "ctl"];
  for (let i = 0; i < n; i++) {
    const y = topY + pitch * (i + 1);
    anchors[leftNames[i]] = { x: -8, y };
    anchors[rightNames[i]] = { x: BODY_W + 8, y };
  }
  return { ...sym, anchors };
})();
var voltage_regulator = {
  length: 60,
  netlistPins: ["in", "gnd", "out"],
  anchors: {
    start: { x: 0, y: 0 },
    end: { x: 60, y: 0 },
    in: { x: 0, y: 0 },
    out: { x: 60, y: 0 },
    gnd: { x: 30, y: 20 }
  },
  svg: (_l, _v, attrs) => [
    lineWire(0, 0, 10, 0),
    `<rect x="10" y="-15" width="40" height="30" fill="white" ${BODY}/>`,
    `<text x="30" y="4" text-anchor="middle" class="schematex-circuit-meter">${attrs?.model ?? "REG"}</text>`,
    lineWire(50, 0, 60, 0),
    lineWire(30, 15, 30, 20)
  ].join("")
};
var potentiometer = {
  length: 50,
  netlistPins: ["start", "wiper", "end"],
  anchors: {
    start: { x: 0, y: 0 },
    end: { x: 50, y: 0 },
    wiper: { x: 25, y: -22 }
  },
  svg: () => [
    `<path d="M 0,0 L 10,0 L 13,-8 L 18,8 L 23,-8 L 28,8 L 33,-8 L 38,8 L 40,0 L 50,0" ${BODY}/>`,
    `<line x1="25" y1="-22" x2="25" y2="-10" ${BODY}/>`,
    `<polygon points="25,-10 21,-16 29,-16" ${FILL}/>`
  ].join("")
};
var terminal_block = {
  length: 80,
  netlistPins: [],
  anchors: { start: { x: 0, y: 0 }, end: { x: 80, y: 0 } },
  svg: (label, _value, attrs) => {
    const pinsAttr = attrs?.pins ?? attrs?.terminals ?? "1,2,3,4";
    const pins = pinsAttr.split(",").map((s) => s.trim()).filter(Boolean);
    const n = Math.max(pins.length, 1);
    const BODY_W = 80;
    const pitch = 18;
    const bodyH = pitch * (n + 1);
    const topY = -bodyH / 2;
    const parts = [];
    parts.push(
      `<rect x="0" y="${topY}" width="${BODY_W}" height="${bodyH}" rx="3" fill="white" stroke-width="2" ${BODY}/>`
    );
    if (label) {
      parts.push(
        `<text x="${BODY_W / 2}" y="${topY + 14}" text-anchor="middle" class="schematex-circuit-meter">${label}</text>`
      );
    }
    for (let i = 0; i < n; i++) {
      const y = topY + pitch * (i + 1) + (label ? 8 : 0);
      parts.push(`<line x1="-8" y1="${y}" x2="0" y2="${y}" ${WIRE}/>`);
      parts.push(`<circle cx="6" cy="${y}" r="2" ${FILL}/>`);
      parts.push(
        `<text x="12" y="${y + 3}" class="schematex-circuit-pol">${pins[i] ?? `T${i + 1}`}</text>`
      );
    }
    return parts.join("");
  }
};
function numAttr(attrs, key, fallback) {
  const v = Number(attrs?.[key]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}
function effectiveSymbolDef(type, attrs) {
  const sym = getSymbol(type);
  if (!sym) return void 0;
  if (type !== "enclosure" && type !== "din_rail" && type !== "wire_duct") return sym;
  if (type === "enclosure") {
    const w = numAttr(attrs, "width", numAttr(attrs, "w", 240));
    const h2 = numAttr(attrs, "height", numAttr(attrs, "h", 160));
    return {
      ...sym,
      length: w,
      anchors: {
        start: { x: 0, y: 0 },
        end: { x: w, y: 0 },
        center: { x: w / 2, y: h2 / 2 },
        bottom_left: { x: 0, y: h2 },
        bottom_right: { x: w, y: h2 }
      }
    };
  }
  const length = numAttr(attrs, "length", 180);
  const h = type === "wire_duct" ? 22 : 14;
  return {
    ...sym,
    length,
    anchors: {
      start: { x: 0, y: 0 },
      end: { x: length, y: 0 },
      center: { x: length / 2, y: 0 },
      bottom_right: { x: length, y: h }
    }
  };
}
var enclosure = {
  length: 240,
  anchors: { start: { x: 0, y: 0 }, end: { x: 240, y: 0 }, bottom_right: { x: 240, y: 160 } },
  svg: (label, _value, attrs) => {
    const w = numAttr(attrs, "width", numAttr(attrs, "w", 240));
    const h = numAttr(attrs, "height", numAttr(attrs, "h", 160));
    const title2 = label ?? attrs?.title ?? "Panel";
    return [
      `<rect x="0" y="0" width="${w}" height="${h}" rx="8" fill="none" class="schematex-circuit-enclosure"/>`,
      `<rect x="10" y="20" width="${Math.max(10, w - 20)}" height="${Math.max(10, h - 30)}" rx="3" fill="none" class="schematex-circuit-enclosure-inner"/>`,
      `<text x="${w / 2}" y="15" text-anchor="middle" class="schematex-circuit-panel-label">${title2}</text>`
    ].join("");
  }
};
var din_rail = {
  length: 180,
  anchors: { start: { x: 0, y: 0 }, end: { x: 180, y: 0 } },
  svg: (_label, _value, attrs) => {
    const l = numAttr(attrs, "length", 180);
    const slots = [];
    for (let x = 8; x < l - 4; x += 16) {
      slots.push(`<rect x="${x}" y="-3" width="8" height="6" rx="2" class="schematex-circuit-din-slot"/>`);
    }
    return [
      `<rect x="0" y="-7" width="${l}" height="14" rx="2" class="schematex-circuit-din"/>`,
      ...slots
    ].join("");
  }
};
var wire_duct = {
  length: 180,
  anchors: { start: { x: 0, y: 0 }, end: { x: 180, y: 0 }, bottom_right: { x: 180, y: 22 } },
  svg: (_label, _value, attrs) => {
    const l = numAttr(attrs, "length", 180);
    const teeth = [];
    for (let x = 8; x < l - 4; x += 12) {
      teeth.push(`<line x1="${x}" y1="0" x2="${x}" y2="22" class="schematex-circuit-duct-tooth"/>`);
    }
    return [
      `<rect x="0" y="0" width="${l}" height="22" rx="2" class="schematex-circuit-duct"/>`,
      ...teeth
    ].join("");
  }
};
var plc = {
  length: 70,
  anchors: { start: { x: 0, y: 0 }, end: { x: 70, y: 0 }, pwr: { x: 0, y: 24 }, out: { x: 70, y: 24 } },
  svg: (label, _value, attrs) => {
    const title2 = label ?? attrs?.model ?? "PLC";
    const leds = [12, 24, 36, 48, 60].map((x) => `<circle cx="${x}" cy="28" r="2.2" class="schematex-circuit-panel-led"/>`).join("");
    return [
      `<rect x="0" y="-20" width="70" height="56" rx="4" fill="white" ${BODY}/>`,
      `<text x="35" y="-2" text-anchor="middle" class="schematex-circuit-meter">${title2}</text>`,
      leds
    ].join("");
  }
};
var pilot_light = {
  length: 22,
  anchors: { start: { x: 0, y: 0 }, end: { x: 22, y: 0 } },
  svg: (label, _value) => [
    `<circle cx="11" cy="0" r="10" class="schematex-circuit-panel-light"/>`,
    `<circle cx="11" cy="0" r="4" class="schematex-circuit-panel-led"/>`,
    label ? `<text x="11" y="20" text-anchor="middle" class="schematex-circuit-pol">${label}</text>` : ""
  ].join("")
};
var selector_switch = {
  length: 26,
  anchors: { start: { x: 0, y: 0 }, end: { x: 26, y: 0 } },
  svg: (label) => [
    `<circle cx="13" cy="0" r="12" fill="white" ${BODY}/>`,
    `<line x1="7" y1="5" x2="19" y2="-5" ${BODY}/>`,
    label ? `<text x="13" y="22" text-anchor="middle" class="schematex-circuit-pol">${label}</text>` : ""
  ].join("")
};
var emergency_stop = {
  length: 30,
  anchors: { start: { x: 0, y: 0 }, end: { x: 30, y: 0 } },
  svg: (label) => [
    `<circle cx="15" cy="0" r="14" class="schematex-circuit-estop"/>`,
    `<text x="15" y="4" text-anchor="middle" class="schematex-circuit-meter">E</text>`,
    label ? `<text x="15" y="25" text-anchor="middle" class="schematex-circuit-pol">${label}</text>` : ""
  ].join("")
};
var relay_coil = {
  length: 40,
  anchors: { start: { x: 0, y: 0 }, end: { x: 40, y: 0 } },
  svg: () => [
    lineWire(0, 0, 8, 0),
    `<rect x="8" y="-10" width="24" height="20" fill="white" ${BODY}/>`,
    // Diagonal slash inside the box = coil winding indicator
    `<line x1="8" y1="-10" x2="32" y2="10" ${BODY}/>`,
    lineWire(32, 0, 40, 0)
  ].join("")
};
var relay_no = {
  length: 40,
  anchors: { start: { x: 0, y: 0 }, end: { x: 40, y: 0 } },
  svg: () => [
    lineWire(0, 0, 10, 0),
    `<line x1="10" y1="0" x2="30" y2="-10" ${BODY}/>`,
    `<circle cx="10" cy="0" r="2" ${FILL}/>`,
    `<circle cx="30" cy="0" r="2" ${FILL}/>`,
    // Small dashed bar above to denote actuator-driven (vs hand switch)
    `<line x1="14" y1="-14" x2="26" y2="-14" stroke-dasharray="2,2" ${BODY}/>`,
    lineWire(30, 0, 40, 0)
  ].join("")
};
var relay_nc = {
  length: 40,
  anchors: { start: { x: 0, y: 0 }, end: { x: 40, y: 0 } },
  svg: () => [
    lineWire(0, 0, 10, 0),
    `<line x1="10" y1="-10" x2="30" y2="-10" ${BODY}/>`,
    // NC slash: line crosses both contact endpoints (closed by default)
    `<line x1="8" y1="2" x2="32" y2="-12" ${BODY}/>`,
    `<circle cx="10" cy="0" r="2" ${FILL}/>`,
    `<circle cx="30" cy="0" r="2" ${FILL}/>`,
    `<line x1="14" y1="-14" x2="26" y2="-14" stroke-dasharray="2,2" ${BODY}/>`,
    lineWire(30, 0, 40, 0)
  ].join("")
};
var contactor = {
  length: 44,
  anchors: { start: { x: 0, y: 0 }, end: { x: 44, y: 0 } },
  svg: () => [
    lineWire(0, 0, 10, 0),
    // Two parallel diagonal contacts = double-break (typical of contactors)
    `<line x1="10" y1="0" x2="30" y2="-10" stroke-width="2.5" ${BODY}/>`,
    `<line x1="14" y1="2" x2="34" y2="-8" stroke-width="2.5" ${BODY}/>`,
    `<circle cx="10" cy="0" r="2" ${FILL}/>`,
    `<circle cx="34" cy="0" r="2" ${FILL}/>`,
    // Solid bar above = electromagnetic-driven actuator
    `<line x1="14" y1="-14" x2="30" y2="-14" stroke-width="2" ${BODY}/>`,
    lineWire(34, 0, 44, 0)
  ].join("")
};
var solenoid_valve = {
  length: 50,
  anchors: { start: { x: 0, y: 0 }, end: { x: 50, y: 0 } },
  svg: () => [
    lineWire(0, 0, 8, 0),
    // Solenoid box on top
    `<rect x="8" y="-22" width="14" height="12" fill="white" ${BODY}/>`,
    `<line x1="8" y1="-22" x2="22" y2="-10" ${BODY}/>`,
    // Valve body (triangle pair = IEC valve symbol)
    `<polygon points="22,0 38,-8 38,8" fill="white" ${BODY}/>`,
    `<polygon points="22,0 8,-8 8,8" fill="white" ${BODY}/>`,
    // Connect solenoid to valve body (actuator line)
    `<line x1="15" y1="-10" x2="22" y2="0" ${BODY}/>`,
    lineWire(38, 0, 50, 0)
  ].join("")
};
var thermal_overload = {
  length: 40,
  anchors: { start: { x: 0, y: 0 }, end: { x: 40, y: 0 } },
  svg: () => [
    lineWire(0, 0, 8, 0),
    `<rect x="8" y="-12" width="24" height="24" fill="white" ${BODY}/>`,
    // Bimetal element: bent line inside box
    `<path d="M 12,-6 L 16,4 L 20,-6 L 24,4 L 28,-6" fill="none" ${BODY}/>`,
    lineWire(32, 0, 40, 0)
  ].join("")
};
var disconnect_switch = {
  length: 48,
  anchors: { start: { x: 0, y: 0 }, end: { x: 48, y: 0 } },
  svg: () => [
    lineWire(0, 0, 10, 0),
    `<line x1="10" y1="0" x2="34" y2="-12" ${BODY}/>`,
    `<circle cx="10" cy="0" r="2" ${FILL}/>`,
    // Hollow square at top of arm = visible-isolation indicator
    `<rect x="30" y="-16" width="8" height="8" fill="white" ${BODY}/>`,
    `<circle cx="38" cy="0" r="2" ${FILL}/>`,
    lineWire(38, 0, 48, 0)
  ].join("")
};
var varistor = {
  length: 40,
  anchors: { start: { x: 0, y: 0 }, end: { x: 40, y: 0 } },
  svg: () => [
    lineWire(0, 0, 6, 0),
    `<rect x="6" y="-8" width="28" height="16" fill="white" ${BODY}/>`,
    // voltage-dependence diagonal through the body
    `<line x1="9" y1="9" x2="31" y2="-9" ${BODY}/>`,
    `<text x="12" y="-1" class="schematex-circuit-pol">U</text>`,
    lineWire(34, 0, 40, 0)
  ].join("")
};
var fuse_slow = {
  length: 30,
  anchors: { start: { x: 0, y: 0 }, end: { x: 30, y: 0 } },
  svg: () => [
    lineWire(0, 0, 5, 0),
    `<rect x="5" y="-5" width="20" height="10" rx="5" fill="none" ${BODY}/>`,
    `<line x1="5" y1="0" x2="25" y2="0" ${BODY}/>`,
    `<text x="11" y="-8" class="schematex-circuit-pol">T</text>`,
    lineWire(25, 0, 30, 0)
  ].join("")
};
var inductor_iron = {
  length: 40,
  anchors: { start: { x: 0, y: 0 }, end: { x: 40, y: 0 } },
  svg: () => [
    `<path d="M 0,0 L 5,0 A 5,5 0 0 1 15,0 A 5,5 0 0 1 25,0 A 5,5 0 0 1 35,0 L 40,0" fill="none" ${BODY}/>`,
    // iron core: two parallel lines above the humps
    `<line x1="6" y1="-8" x2="34" y2="-8" ${BODY}/>`,
    `<line x1="6" y1="-11" x2="34" y2="-11" ${BODY}/>`
  ].join("")
};
var inductor_ferrite = {
  length: 40,
  anchors: { start: { x: 0, y: 0 }, end: { x: 40, y: 0 } },
  svg: () => [
    `<path d="M 0,0 L 5,0 A 5,5 0 0 1 15,0 A 5,5 0 0 1 25,0 A 5,5 0 0 1 35,0 L 40,0" fill="none" ${BODY}/>`,
    // ferrite core: one heavy line above the humps
    `<line x1="6" y1="-9" x2="34" y2="-9" stroke-width="2.5" ${BODY}/>`
  ].join("")
};
var ferrite_bead = {
  length: 30,
  anchors: { start: { x: 0, y: 0 }, end: { x: 30, y: 0 } },
  svg: () => [
    lineWire(0, 0, 7, 0),
    `<rect x="7" y="-6" width="16" height="12" rx="2" ${FILL}/>`,
    lineWire(23, 0, 30, 0)
  ].join("")
};
var varactor = {
  length: 32,
  anchors: { start: { x: 0, y: 0 }, end: { x: 32, y: 0 } },
  svg: () => [
    lineWire(0, 0, 8, 0),
    `<polygon points="8,-8 8,8 20,0" ${FILL}/>`,
    // cathode bar + parallel capacitor plate (voltage-variable capacitance)
    `<line x1="20" y1="-8" x2="20" y2="8" ${BODY}/>`,
    `<line x1="24" y1="-8" x2="24" y2="8" ${BODY}/>`,
    lineWire(24, 0, 32, 0)
  ].join("")
};
var tvs_diode = {
  length: 36,
  anchors: { start: { x: 0, y: 0 }, end: { x: 36, y: 0 } },
  svg: () => [
    lineWire(0, 0, 6, 0),
    // two triangles back-to-back onto a shared bar (bidirectional clamp)
    `<polygon points="6,-8 6,8 16,0" ${FILL}/>`,
    `<polygon points="30,-8 30,8 20,0" ${FILL}/>`,
    `<line x1="18" y1="-9" x2="18" y2="9" ${BODY}/>`,
    lineWire(30, 0, 36, 0)
  ].join("")
};
var bridge_rectifier = {
  length: 48,
  netlistPins: ["ac1", "ac2", "dcp", "dcn"],
  anchors: {
    start: { x: 0, y: 0 },
    end: { x: 48, y: 0 },
    ac1: { x: 0, y: 0 },
    // left corner
    ac2: { x: 48, y: 0 },
    // right corner
    dcp: { x: 24, y: -24 },
    // top corner (+)
    dcn: { x: 24, y: 24 }
    // bottom corner (−)
  },
  svg: () => [
    `<polygon points="0,0 24,-24 48,0 24,24" fill="white" ${BODY}/>`,
    // four diode triangles, all conducting toward DC+ (top)
    `<polygon points="8,-10 15,-10 11,-3" ${FILL}/>`,
    `<polygon points="33,-10 40,-10 36,-3" ${FILL}/>`,
    `<polygon points="8,10 15,10 11,3" ${FILL}/>`,
    `<polygon points="33,10 40,10 36,3" ${FILL}/>`,
    `<text x="24" y="-10" text-anchor="middle" class="schematex-circuit-pol">+</text>`,
    `<text x="24" y="20" text-anchor="middle" class="schematex-circuit-pol">\u2212</text>`
  ].join("")
};
var darlington_npn = {
  length: 40,
  netlistPins: ["c", "b", "e"],
  anchors: {
    start: { x: 0, y: 0 },
    end: { x: 40, y: -16 },
    base: { x: 0, y: 0 },
    collector: { x: 40, y: -16 },
    emitter: { x: 40, y: 16 },
    b: { x: 0, y: 0 },
    c: { x: 40, y: -16 },
    e: { x: 40, y: 16 }
  },
  svg: () => [
    `<circle cx="20" cy="0" r="16" fill="white" ${BODY}/>`,
    lineWire(0, 0, 10, 0),
    `<line x1="10" y1="-9" x2="10" y2="9" ${BODY}/>`,
    // shared base plate
    // Q1: base → collector, base → Q2 base node
    `<line x1="10" y1="-5" x2="26" y2="-11" ${BODY}/>`,
    `<line x1="10" y1="4" x2="19" y2="7" ${BODY}/>`,
    // Q2: emitter out (NPN arrow outward)
    `<line x1="19" y1="7" x2="28" y2="11" ${BODY}/>`,
    `<polygon points="28,11 21,9 23,15" ${FILL}/>`,
    lineWire(26, -11, 40, -16),
    lineWire(28, 11, 40, 16)
  ].join("")
};
var darlington_pnp = {
  length: 40,
  netlistPins: ["c", "b", "e"],
  anchors: {
    start: { x: 0, y: 0 },
    end: { x: 40, y: -16 },
    base: { x: 0, y: 0 },
    collector: { x: 40, y: -16 },
    emitter: { x: 40, y: 16 },
    b: { x: 0, y: 0 },
    c: { x: 40, y: -16 },
    e: { x: 40, y: 16 }
  },
  svg: () => [
    `<circle cx="20" cy="0" r="16" fill="white" ${BODY}/>`,
    lineWire(0, 0, 10, 0),
    `<line x1="10" y1="-9" x2="10" y2="9" ${BODY}/>`,
    `<line x1="10" y1="-5" x2="26" y2="-11" ${BODY}/>`,
    `<line x1="10" y1="4" x2="19" y2="7" ${BODY}/>`,
    `<line x1="19" y1="7" x2="28" y2="11" ${BODY}/>`,
    // PNP arrow pointing inward (toward base node)
    `<polygon points="12,5 19,7 14,11" ${FILL}/>`,
    lineWire(26, -11, 40, -16),
    lineWire(28, 11, 40, 16)
  ].join("")
};
var nmos_depletion = {
  length: 40,
  netlistPins: ["d", "g", "s"],
  anchors: {
    start: { x: 0, y: 0 },
    end: { x: 40, y: -16 },
    gate: { x: 0, y: 0 },
    drain: { x: 40, y: -16 },
    source: { x: 40, y: 16 },
    g: { x: 0, y: 0 },
    d: { x: 40, y: -16 },
    s: { x: 40, y: 16 }
  },
  svg: () => [
    lineWire(0, 0, 14, 0),
    `<line x1="14" y1="-12" x2="14" y2="12" ${BODY}/>`,
    // gate plate
    // solid channel bar (depletion mode) vs the segmented enhancement bar
    `<line x1="18" y1="-10" x2="18" y2="10" ${BODY}/>`,
    `<line x1="18" y1="-8" x2="32" y2="-8" ${BODY}/>`,
    lineWire(32, -8, 40, -16),
    `<line x1="18" y1="8" x2="32" y2="8" ${BODY}/>`,
    lineWire(32, 8, 40, 16),
    `<polygon points="22,0 18,-4 18,4" ${FILL}/>`
  ].join("")
};
var igbt = {
  length: 40,
  netlistPins: ["c", "g", "e"],
  anchors: {
    start: { x: 0, y: 0 },
    end: { x: 40, y: -16 },
    gate: { x: 0, y: 0 },
    collector: { x: 40, y: -16 },
    emitter: { x: 40, y: 16 },
    g: { x: 0, y: 0 },
    c: { x: 40, y: -16 },
    e: { x: 40, y: 16 }
  },
  svg: () => [
    lineWire(0, 0, 10, 0),
    `<line x1="10" y1="-12" x2="10" y2="12" ${BODY}/>`,
    // insulated gate plate
    `<line x1="14" y1="-10" x2="14" y2="10" ${BODY}/>`,
    // channel
    `<line x1="14" y1="-8" x2="32" y2="-8" ${BODY}/>`,
    lineWire(32, -8, 40, -16),
    `<line x1="14" y1="8" x2="28" y2="8" ${BODY}/>`,
    // IGBT emitter arrow (BJT-like, pointing out)
    `<polygon points="28,8 22,5 23,11" ${FILL}/>`,
    lineWire(28, 8, 40, 16)
  ].join("")
};
var scr = {
  length: 36,
  netlistPins: ["a", "k", "g"],
  anchors: {
    start: { x: 0, y: 0 },
    end: { x: 36, y: 0 },
    a: { x: 0, y: 0 },
    k: { x: 36, y: 0 },
    g: { x: 30, y: 16 },
    gate: { x: 30, y: 16 }
  },
  svg: () => [
    lineWire(0, 0, 8, 0),
    `<polygon points="8,-8 8,8 22,0" ${FILL}/>`,
    `<line x1="22" y1="-8" x2="22" y2="8" ${BODY}/>`,
    lineWire(22, 0, 36, 0),
    // gate lead off the cathode side
    `<line x1="22" y1="4" x2="30" y2="12" ${BODY}/>`,
    lineWire(30, 12, 30, 16)
  ].join("")
};
var triac = {
  length: 40,
  netlistPins: ["mt1", "mt2", "g"],
  anchors: {
    start: { x: 0, y: 0 },
    end: { x: 40, y: 0 },
    mt1: { x: 0, y: 0 },
    mt2: { x: 40, y: 0 },
    g: { x: 6, y: 16 },
    gate: { x: 6, y: 16 }
  },
  svg: () => [
    lineWire(0, 0, 8, 0),
    // two triangles back-to-back, offset vertically (bidirectional)
    `<polygon points="8,-9 8,3 22,-3" ${FILL}/>`,
    `<polygon points="32,-3 32,9 18,3" ${FILL}/>`,
    `<line x1="8" y1="-9" x2="8" y2="3" ${BODY}/>`,
    `<line x1="32" y1="-3" x2="32" y2="9" ${BODY}/>`,
    lineWire(32, 0, 40, 0),
    // gate lead
    `<line x1="10" y1="6" x2="6" y2="12" ${BODY}/>`,
    lineWire(6, 12, 6, 16)
  ].join("")
};
var diac = {
  length: 36,
  anchors: { start: { x: 0, y: 0 }, end: { x: 36, y: 0 } },
  svg: () => [
    lineWire(0, 0, 6, 0),
    // two triangles back-to-back, no gate (bidirectional trigger)
    `<polygon points="6,-9 6,3 20,-3" ${FILL}/>`,
    `<polygon points="30,-3 30,9 16,3" ${FILL}/>`,
    `<line x1="6" y1="-9" x2="6" y2="3" ${BODY}/>`,
    `<line x1="30" y1="-3" x2="30" y2="9" ${BODY}/>`,
    lineWire(30, 0, 36, 0)
  ].join("")
};
var phototransistor = {
  length: 40,
  netlistPins: ["c", "b", "e"],
  anchors: {
    start: { x: 0, y: 0 },
    end: { x: 40, y: -16 },
    base: { x: 0, y: 0 },
    collector: { x: 40, y: -16 },
    emitter: { x: 40, y: 16 },
    b: { x: 0, y: 0 },
    c: { x: 40, y: -16 },
    e: { x: 40, y: 16 }
  },
  svg: () => [
    `<circle cx="20" cy="0" r="16" fill="white" ${BODY}/>`,
    `<line x1="14" y1="-10" x2="14" y2="10" ${BODY}/>`,
    lineWire(0, 0, 14, 0),
    `<line x1="14" y1="-6" x2="30" y2="-12" ${BODY}/>`,
    lineWire(30, -12, 40, -16),
    `<line x1="14" y1="6" x2="30" y2="12" ${BODY}/>`,
    lineWire(30, 12, 40, 16),
    `<polygon points="30,12 24,10 26,16" ${FILL}/>`,
    // inward light arrows striking the base
    `<path d="M 2,-20 L 9,-13 M 9,-15 L 9,-13 L 7,-13" fill="none" ${BODY}/>`,
    `<path d="M 7,-22 L 14,-15 M 14,-17 L 14,-15 L 12,-15" fill="none" ${BODY}/>`
  ].join("")
};
var optocoupler = {
  length: 56,
  netlistPins: ["a", "k", "c", "e"],
  anchors: {
    start: { x: 0, y: 0 },
    end: { x: 56, y: 0 },
    a: { x: 0, y: -12 },
    k: { x: 0, y: 12 },
    c: { x: 56, y: -12 },
    e: { x: 56, y: 12 }
  },
  svg: () => [
    `<rect x="10" y="-22" width="36" height="44" fill="none" class="schematex-circuit-body" stroke-dasharray="4,3"/>`,
    // LED (left): anode top, cathode bottom — drawn pointing down
    lineWire(0, -12, 16, -12),
    lineWire(0, 12, 16, 12),
    `<polygon points="16,-6 24,-6 20,2" ${FILL}/>`,
    `<line x1="16" y1="2" x2="24" y2="2" ${BODY}/>`,
    // isolation light arrows
    `<path d="M 26,-4 L 32,-4 M 30,-6 L 32,-4 L 30,-2" fill="none" ${BODY}/>`,
    `<path d="M 26,2 L 32,2 M 30,0 L 32,2 L 30,4" fill="none" ${BODY}/>`,
    // phototransistor (right)
    `<line x1="36" y1="-8" x2="36" y2="8" ${BODY}/>`,
    `<line x1="36" y1="-4" x2="46" y2="-12" ${BODY}/>`,
    lineWire(46, -12, 56, -12),
    `<line x1="36" y1="4" x2="46" y2="12" ${BODY}/>`,
    lineWire(46, 12, 56, 12),
    `<polygon points="46,12 40,10 42,16" ${FILL}/>`
  ].join("")
};
var schmitt_buffer = {
  length: 44,
  netlistPins: ["in", "out"],
  anchors: {
    start: { x: 0, y: 0 },
    end: { x: 44, y: 0 },
    in: { x: 0, y: 0 },
    out: { x: 44, y: 0 }
  },
  svg: () => [
    lineWire(0, 0, 6, 0),
    `<polygon points="6,-14 6,14 38,0" fill="white" ${BODY}/>`,
    // hysteresis glyph inside
    `<path d="M 12,4 L 18,4 L 18,-4 L 24,-4 M 14,-2 L 20,-2 L 20,6 L 26,6" fill="none" ${BODY}/>`,
    lineWire(38, 0, 44, 0)
  ].join("")
};
var tri_state_buffer = {
  length: 44,
  netlistPins: ["in", "out", "en"],
  anchors: {
    start: { x: 0, y: 0 },
    end: { x: 44, y: 0 },
    in: { x: 0, y: 0 },
    out: { x: 44, y: 0 },
    en: { x: 19, y: -14 },
    enable: { x: 19, y: -14 }
  },
  svg: () => [
    lineWire(0, 0, 6, 0),
    `<polygon points="6,-14 6,14 38,0" fill="white" ${BODY}/>`,
    // enable pin on top
    `<line x1="19" y1="-7" x2="19" y2="-14" ${BODY}/>`,
    lineWire(38, 0, 44, 0)
  ].join("")
};
var instrumentation_amp = {
  length: 50,
  netlistPins: ["inp", "inn", "out"],
  anchors: {
    start: { x: 0, y: 0 },
    end: { x: 50, y: 0 },
    inp: { x: 0, y: -12 },
    inn: { x: 0, y: 12 },
    out: { x: 50, y: 0 }
  },
  svg: () => [
    lineWire(0, -12, 4, -12),
    lineWire(0, 12, 4, 12),
    `<polygon points="4,-22 4,22 50,0" fill="white" ${BODY}/>`,
    // double left edge marks the instrumentation (3-opamp) block
    `<line x1="8" y1="-20" x2="8" y2="20" ${BODY}/>`,
    `<text x="6" y="-7" class="schematex-circuit-pol">+</text>`,
    `<text x="6" y="15" class="schematex-circuit-pol">\u2212</text>`,
    `<text x="18" y="4" class="schematex-circuit-pol">INA</text>`
  ].join("")
};
var dc_dc_converter = {
  length: 50,
  netlistPins: ["vin", "gin", "vout", "gout"],
  anchors: {
    start: { x: 0, y: 0 },
    end: { x: 50, y: 0 },
    vin: { x: 0, y: -12 },
    gin: { x: 0, y: 12 },
    vout: { x: 50, y: -12 },
    gout: { x: 50, y: 12 }
  },
  svg: () => [
    lineWire(0, -12, 8, -12),
    lineWire(0, 12, 8, 12),
    `<rect x="8" y="-20" width="34" height="40" fill="white" ${BODY}/>`,
    `<line x1="14" y1="14" x2="36" y2="-14" ${BODY}/>`,
    `<text x="12" y="-8" class="schematex-circuit-pol">DC</text>`,
    `<text x="24" y="17" class="schematex-circuit-pol">DC</text>`,
    lineWire(42, -12, 50, -12),
    lineWire(42, 12, 50, 12)
  ].join("")
};
var switch_dpdt = {
  length: 52,
  netlistPins: ["p1", "nc1", "no1", "p2", "nc2", "no2"],
  anchors: {
    start: { x: 0, y: 0 },
    end: { x: 52, y: 0 },
    p1: { x: 0, y: -16 },
    nc1: { x: 52, y: -28 },
    no1: { x: 52, y: -8 },
    p2: { x: 0, y: 16 },
    nc2: { x: 52, y: 4 },
    no2: { x: 52, y: 24 }
  },
  svg: () => [
    // pole 1 (upper)
    lineWire(0, -16, 10, -16),
    `<circle cx="10" cy="-16" r="2" ${FILL}/>`,
    `<line x1="10" y1="-16" x2="40" y2="-26" ${BODY}/>`,
    `<circle cx="42" cy="-28" r="2" ${FILL}/>`,
    lineWire(42, -28, 52, -28),
    `<circle cx="42" cy="-8" r="2" ${FILL}/>`,
    lineWire(42, -8, 52, -8),
    // pole 2 (lower)
    lineWire(0, 16, 10, 16),
    `<circle cx="10" cy="16" r="2" ${FILL}/>`,
    `<line x1="10" y1="16" x2="40" y2="6" ${BODY}/>`,
    `<circle cx="42" cy="4" r="2" ${FILL}/>`,
    lineWire(42, 4, 52, 4),
    `<circle cx="42" cy="24" r="2" ${FILL}/>`,
    lineWire(42, 24, 52, 24),
    // ganged actuator (dashed link between the two arms)
    `<line x1="25" y1="-21" x2="25" y2="11" class="schematex-circuit-body" stroke-dasharray="3,3"/>`
  ].join("")
};
var oscilloscope = {
  length: 40,
  anchors: { start: { x: 0, y: 0 }, end: { x: 40, y: 0 } },
  svg: () => [
    lineWire(0, 0, 8, 0),
    `<circle cx="20" cy="0" r="12" fill="white" ${BODY}/>`,
    // sine trace
    `<path d="M 12,2 Q 16,-9 20,0 Q 24,9 28,-2" fill="none" ${BODY}/>`,
    lineWire(32, 0, 40, 0)
  ].join("")
};
var port = {
  length: 16,
  anchors: { start: { x: 0, y: 0 }, end: { x: 16, y: 0 } },
  svg: () => [
    lineWire(0, 0, 6, 0),
    `<circle cx="11" cy="0" r="5" fill="white" ${BODY}/>`
  ].join("")
};
var SYMBOLS = {
  resistor,
  capacitor,
  electrolytic_cap,
  inductor,
  fuse,
  crystal,
  transformer,
  voltage_source,
  current_source,
  ac_source,
  battery,
  ground,
  gnd_signal,
  vcc,
  diode,
  zener,
  schottky,
  led,
  photodiode,
  npn,
  pnp,
  nmos,
  pmos,
  jfet_n,
  jfet_p,
  opamp,
  comparator,
  switch_spst,
  push_no,
  ammeter,
  voltmeter,
  wattmeter,
  motor,
  lamp,
  speaker,
  microphone,
  buzzer,
  potentiometer,
  rheostat,
  thermistor_ntc,
  thermistor_ptc,
  ldr,
  variable_cap,
  variable_inductor,
  switch_spdt,
  push_nc,
  gnd_chassis,
  gnd_digital,
  test_point,
  no_connect,
  antenna,
  generic_ic,
  terminal_block,
  enclosure,
  din_rail,
  wire_duct,
  plc,
  pilot_light,
  selector_switch,
  emergency_stop,
  "555_timer": timer_555,
  voltage_regulator,
  // Industrial control / power electrical (IEC 60617)
  relay_coil,
  relay_no,
  relay_nc,
  contactor,
  solenoid_valve,
  thermal_overload,
  disconnect_switch,
  // Previously-missing glyphs (v0.6.7) — passives / diodes / power semis / ICs
  varistor,
  fuse_slow,
  inductor_iron,
  inductor_ferrite,
  ferrite_bead,
  varactor,
  tvs_diode,
  bridge_rectifier,
  darlington_npn,
  darlington_pnp,
  nmos_depletion,
  igbt,
  scr,
  triac,
  diac,
  phototransistor,
  optocoupler,
  schmitt_buffer,
  tri_state_buffer,
  instrumentation_amp,
  dc_dc_converter,
  switch_dpdt,
  oscilloscope,
  port
};
function getSymbol(t) {
  return SYMBOLS[t];
}
function getNetlistPinOrder(t) {
  const sym = getSymbol(t);
  if (!sym) return void 0;
  if (sym.netlistPins) return [...sym.netlistPins];
  if (sym.anchors.start && sym.anchors.end) return ["start", "end"];
  return Object.keys(sym.anchors);
}

// src/diagrams/circuit/netlist.ts
var NetlistParseError = class extends Error {
  constructor(message, line) {
    super(message);
    this.line = line;
    this.name = "NetlistParseError";
  }
  line;
};
var PREFIX_MAP = {
  R: { type: "resistor", pins: ["start", "end"] },
  C: { type: "capacitor", pins: ["start", "end"] },
  L: { type: "inductor", pins: ["start", "end"] },
  D: { type: "diode", pins: ["start", "end"] },
  // anode → start, cathode → end
  V: { type: "voltage_source", pins: ["plus", "minus"] },
  I: { type: "current_source", pins: ["plus", "minus"] },
  Q: { type: "npn", pins: ["c", "b", "e"] },
  M: { type: "nmos", pins: ["d", "g", "s"] },
  J: { type: "jfet_n", pins: ["d", "g", "s"] },
  S: { type: "switch_spst", pins: ["start", "end"] },
  F: { type: "fuse", pins: ["start", "end"] },
  B: { type: "battery", pins: ["plus", "minus"] },
  K: { type: "relay_coil", pins: ["start", "end"] },
  U: { type: "generic_ic", pins: [] },
  // pins declared via pins="..." attr
  X: { type: "generic_ic", pins: [] },
  W: { type: "wire", pins: ["start", "end"] },
  // explicit wire (non-SPICE convention, common in EE textbooks)
  T: { type: "terminal_block", pins: [] }
  // pins via pins="..."
};
var TYPE_ALIASES = {
  vsource: "voltage_source",
  isource: "current_source",
  acsource: "ac_source",
  ecap: "electrolytic_cap",
  pot: "potentiometer",
  gnd: "ground",
  ic: "generic_ic",
  reg: "voltage_regulator",
  timer555: "555_timer",
  transistor: "npn",
  tb: "terminal_block",
  junction_box: "terminal_block",
  jbox: "terminal_block",
  enclosure: "enclosure",
  cabinet: "enclosure",
  panel: "enclosure",
  dinrail: "din_rail",
  din_rail: "din_rail",
  wireduct: "wire_duct",
  wire_duct: "wire_duct",
  trunking: "wire_duct",
  plc: "plc",
  lamp: "lamp",
  light: "lamp",
  bulb: "lamp"
};
var GROUND_REF = /^(0|gnd|ground|earth|pe|agnd|dgnd|gnda|gndd|vss|com)(_\w+|\d+)?$/i;
function isGroundRef(s) {
  return GROUND_REF.test(s);
}
function tokenize(line) {
  const tokens = [];
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === " " || ch === "	") {
      i++;
      continue;
    }
    if (ch === '"') {
      const end = line.indexOf('"', i + 1);
      tokens.push(line.slice(i, end < 0 ? line.length : end + 1));
      i = end < 0 ? line.length : end + 1;
      continue;
    }
    let j = i;
    while (j < line.length && line[j] !== " " && line[j] !== "	") {
      if (line[j] === "=" && line[j + 1] === '"') {
        const end = line.indexOf('"', j + 2);
        j = end < 0 ? line.length : end + 1;
        break;
      }
      j++;
    }
    tokens.push(line.slice(i, j));
    i = j;
  }
  return tokens;
}
function isKeyEqVal(tok) {
  const eq = tok.indexOf("=");
  return eq > 0 && /^[a-zA-Z_][\w]*$/.test(tok.slice(0, eq));
}
function parseKV(tok) {
  const eq = tok.indexOf("=");
  const key = tok.slice(0, eq).trim();
  let val = tok.slice(eq + 1).trim();
  if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
  return [key, val];
}
function parseNetlist(body, title2) {
  const components = [];
  const netByName = /* @__PURE__ */ new Map();
  const pinMap = {};
  let autoGnd = 0;
  const underspecified = [];
  const ensureNet = (name) => {
    let n = netByName.get(name);
    if (!n) {
      n = { id: name, anchors: [] };
      netByName.set(name, n);
    }
    return n;
  };
  const lines = body.split("\n").map((l) => l.replace(/\r$/, ""));
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const raw = lines[lineIdx];
    if (/^\s*\*/.test(raw)) continue;
    const stripped = raw.replace(/[#;].*$/, "").trim();
    if (!stripped) continue;
    const tokens = tokenize(stripped);
    if (tokens.length < 2) {
      throw new NetlistParseError(
        `Netlist line must have at least ID + one net: "${stripped}"`,
        lineIdx + 1
      );
    }
    const id = tokens[0];
    if (!/^[a-zA-Z_][\w]*$/.test(id)) {
      throw new NetlistParseError(`Invalid component id: "${id}"`, lineIdx + 1);
    }
    let cursor = 1;
    const netRefs = [];
    while (cursor < tokens.length && !isKeyEqVal(tokens[cursor])) {
      netRefs.push(tokens[cursor]);
      cursor++;
    }
    const kv = {};
    for (; cursor < tokens.length; cursor++) {
      if (!isKeyEqVal(tokens[cursor])) {
        throw new NetlistParseError(
          `Expected key=value after nets, got "${tokens[cursor]}"`,
          lineIdx + 1
        );
      }
      const [k, v] = parseKV(tokens[cursor]);
      kv[k] = v;
    }
    const prefix = id[0].toUpperCase();
    const defaults = PREFIX_MAP[prefix];
    let cType;
    let pinOrder;
    if (kv.type) {
      const t = kv.type.toLowerCase();
      cType = TYPE_ALIASES[t] ?? t;
      pinOrder = getNetlistPinOrder(cType) ?? defaults?.pins ?? ["start", "end"];
    } else if (defaults) {
      cType = defaults.type;
      pinOrder = defaults.pins;
    } else if (isGroundRef(id)) {
      cType = "ground";
      pinOrder = ["start"];
    } else {
      throw new NetlistParseError(
        `Cannot infer type from id "${id}". Either rename to a SPICE-prefix id (R*, C*, L*, D*, V*, I*, Q*, M*, J*, S*, F*, B*, K*, U*, X*, W*, T*) or pass an explicit \`type=<name>\` attribute (e.g. \`${id} ... type=resistor\`). Schematex circuit covers electrical schematics only \u2014 hydraulic/pneumatic prefixes (EV*, BOMBA*, TANK*, etc.) are not supported.`,
        lineIdx + 1
      );
    }
    const expectedPins = pinOrder.length;
    let valueFromTail;
    if (netRefs.length > expectedPins && expectedPins > 0) {
      const tail = netRefs.slice(expectedPins);
      netRefs.length = expectedPins;
      const first = tail[0].toLowerCase();
      if (TYPE_ALIASES[first]) {
        cType = TYPE_ALIASES[first];
        pinOrder = getNetlistPinOrder(cType) ?? pinOrder;
      } else if (first === "npn" || first === "pnp" || first === "nmos" || first === "pmos" || first === "jfet_n" || first === "jfet_p" || first === "zener" || first === "schottky" || first === "led" || first === "photodiode") {
        cType = first;
        pinOrder = getNetlistPinOrder(cType) ?? pinOrder;
      } else {
        valueFromTail = tail.join(" ");
      }
      if (tail.length > 1 && !valueFromTail) {
        valueFromTail = tail.slice(1).join(" ");
      }
    }
    if (cType === "ground" || cType === "gnd_signal" || cType === "gnd_chassis" || cType === "gnd_digital") {
      pinOrder = ["start"];
    }
    if (cType === "terminal_block") {
      const pinsAttr = kv.pins ?? kv.terminals;
      const labels = pinsAttr ? pinsAttr.split(",").map((s) => s.trim()).filter(Boolean) : Array.from({ length: Math.max(netRefs.length, 1) }, (_, i) => `t${i + 1}`);
      pinOrder = labels.map(
        (label, idx) => label.toLowerCase().replace(/[^a-z0-9]+/g, "_") || `t${idx + 1}`
      );
    }
    if (netRefs.length < pinOrder.length) {
      const got = netRefs.length;
      for (let k = got; k < pinOrder.length; k++) {
        netRefs.push(`${id}_nc${k + 1}`);
      }
      underspecified.push({ id, type: cType, expected: pinOrder.length, got });
    }
    const pins = {};
    for (let p = 0; p < pinOrder.length; p++) {
      let net = netRefs[p];
      if (isGroundRef(net)) net = "GND";
      pins[pinOrder[p]] = net;
      ensureNet(net).anchors.push(`${id}.${pinOrder[p]}`);
    }
    pinMap[id] = pins;
    const dirHint = (kv.dir ?? kv.orient ?? kv.direction)?.toLowerCase();
    const explicitDir = dirHint === "right" || dirHint === "left" || dirHint === "up" || dirHint === "down" ? dirHint : void 0;
    const comp = {
      id,
      stableId: true,
      componentType: cType,
      direction: explicitDir ?? "right",
      label: kv.label ?? id,
      value: kv.value ?? valueFromTail,
      attrs: explicitDir ? { dirExplicit: "true" } : {}
    };
    for (const [k, v] of Object.entries(kv)) {
      if (k === "label" || k === "value" || k === "type") continue;
      if (k === "dir" || k === "orient" || k === "direction") continue;
      comp.attrs[k] = v;
    }
    components.push(comp);
  }
  if (netByName.has("GND")) {
    const hasGroundSym = components.some(
      (c) => c.componentType === "ground" || c.componentType === "gnd_signal" || c.componentType === "gnd_chassis" || c.componentType === "gnd_digital"
    );
    if (!hasGroundSym) {
      const gId = `_GND${autoGnd++}`;
      components.push({
        id: gId,
        stableId: false,
        componentType: "ground",
        direction: "down",
        label: void 0,
        value: void 0,
        attrs: { auto: "true" }
      });
      pinMap[gId] = { start: "GND" };
      ensureNet("GND").anchors.push(`${gId}.start`);
    }
  }
  const nets = Array.from(netByName.values());
  const ast = {
    type: "circuit",
    title: title2,
    components,
    nets,
    pinMap,
    mode: "netlist"
  };
  if (underspecified.length) ast.recovered = { underspecified };
  return ast;
}

// src/diagrams/circuit/parser.ts
var CircuitParseError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "CircuitParseError";
  }
};
var COMPONENT_TYPES = /* @__PURE__ */ new Set([
  "resistor",
  "potentiometer",
  "rheostat",
  "thermistor_ntc",
  "thermistor_ptc",
  "ldr",
  "varistor",
  "fuse",
  "fuse_slow",
  "capacitor",
  "electrolytic_cap",
  "variable_cap",
  "inductor",
  "inductor_iron",
  "inductor_ferrite",
  "variable_inductor",
  "ferrite_bead",
  "crystal",
  "transformer",
  "diode",
  "zener",
  "schottky",
  "led",
  "photodiode",
  "varactor",
  "tvs_diode",
  "bridge_rectifier",
  "npn",
  "pnp",
  "darlington_npn",
  "darlington_pnp",
  "nmos",
  "pmos",
  "nmos_depletion",
  "jfet_n",
  "jfet_p",
  "igbt",
  "scr",
  "triac",
  "diac",
  "phototransistor",
  "optocoupler",
  "opamp",
  "comparator",
  "schmitt_buffer",
  "tri_state_buffer",
  "instrumentation_amp",
  "generic_ic",
  "voltage_regulator",
  "dc_dc_converter",
  "555_timer",
  "terminal_block",
  "enclosure",
  "din_rail",
  "wire_duct",
  "plc",
  "pilot_light",
  "selector_switch",
  "emergency_stop",
  "voltage_source",
  "current_source",
  "ac_source",
  "battery",
  "vcc",
  "ground",
  "gnd_signal",
  "gnd_chassis",
  "gnd_digital",
  "switch_spst",
  "switch_spdt",
  "switch_dpdt",
  "push_no",
  "push_nc",
  "relay_coil",
  "relay_no",
  "relay_nc",
  "contactor",
  "solenoid_valve",
  "thermal_overload",
  "disconnect_switch",
  "motor",
  "lamp",
  "speaker",
  "microphone",
  "buzzer",
  "ammeter",
  "voltmeter",
  "wattmeter",
  "oscilloscope",
  "wire",
  "dot",
  "label",
  "port",
  "test_point",
  "no_connect",
  "antenna"
]);
var ALIASES = {
  vsource: "voltage_source",
  isource: "current_source",
  acsource: "ac_source",
  ecap: "electrolytic_cap",
  pot: "potentiometer",
  xtal: "crystal",
  xfmr: "transformer",
  transistor: "npn",
  bjt_npn: "npn",
  bjt_pnp: "pnp",
  mosfet_n: "nmos",
  mosfet_p: "pmos",
  gnd: "ground",
  ic: "generic_ic",
  reg: "voltage_regulator",
  timer555: "555_timer",
  terminal: "terminal_block",
  tb: "terminal_block",
  junction_box: "terminal_block",
  jbox: "terminal_block",
  cabinet: "enclosure",
  panel: "enclosure",
  backplate: "enclosure",
  dinrail: "din_rail",
  "din-rail": "din_rail",
  duct: "wire_duct",
  wireduct: "wire_duct",
  trunking: "wire_duct",
  controller: "plc",
  indicator: "pilot_light",
  pilot: "pilot_light",
  selector: "selector_switch",
  estop: "emergency_stop",
  e_stop: "emergency_stop",
  "e-stop": "emergency_stop",
  therm: "thermistor_ntc",
  ntc: "thermistor_ntc",
  ptc: "thermistor_ptc",
  ths: "thermistor_ntc",
  // Industrial control aliases (IEC letter codes)
  coil: "relay_coil",
  relay: "relay_coil",
  km: "contactor",
  solenoid: "solenoid_valve",
  ev: "solenoid_valve",
  overload: "thermal_overload",
  thermal: "thermal_overload",
  disconnect: "disconnect_switch",
  isolator: "disconnect_switch",
  light: "lamp",
  bulb: "lamp"
};
function normalizeType(raw) {
  const lower = raw.toLowerCase();
  if (ALIASES[lower]) return ALIASES[lower];
  if (COMPONENT_TYPES.has(lower)) {
    return lower;
  }
  return null;
}
var DIRECTIONS = /* @__PURE__ */ new Set(["right", "left", "up", "down"]);
function assignedValueRange(rest, key, absoluteStart, locator) {
  const match = new RegExp(`(?:^|\\s)${key}=("[^"]*"|\\S+)`).exec(rest);
  if (!match) return void 0;
  const token = match[1];
  const start = match.index + match[0].lastIndexOf(token);
  return locator.range(absoluteStart + start, absoluteStart + start + token.length);
}
function parseAttrs(rest, absoluteStart, locator) {
  const out = { attrs: {} };
  const tokens = [];
  let i = 0;
  while (i < rest.length) {
    const ch = rest[i];
    if (ch === " " || ch === "	") {
      i++;
      continue;
    }
    if (ch === '"') {
      const end = rest.indexOf('"', i + 1);
      const tok = rest.slice(i, end < 0 ? rest.length : end + 1);
      tokens.push(tok);
      i = end < 0 ? rest.length : end + 1;
      continue;
    }
    let j = i;
    while (j < rest.length && rest[j] !== " " && rest[j] !== "	") {
      if (rest[j] === "=" && rest[j + 1] === '"') {
        const end = rest.indexOf('"', j + 2);
        j = end < 0 ? rest.length : end + 1;
        break;
      }
      j++;
    }
    tokens.push(rest.slice(i, j));
    i = j;
  }
  for (const tok of tokens) {
    if (!tok) continue;
    if (DIRECTIONS.has(tok.toLowerCase())) {
      out.direction = tok.toLowerCase();
      continue;
    }
    const eq = tok.indexOf("=");
    if (eq > 0) {
      const key = tok.slice(0, eq).trim();
      let val = tok.slice(eq + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1);
      }
      if (key === "label") out.label = val;
      else if (key === "value") out.value = val;
      else if (key === "at") out.at = val;
      else if (key === "length") out.length = val;
      else out.attrs[key] = val;
      continue;
    }
    out.attrs[tok] = "true";
  }
  return {
    ...out,
    labelSourceRange: assignedValueRange(rest, "label", absoluteStart, locator),
    valueSourceRange: assignedValueRange(rest, "value", absoluteStart, locator)
  };
}
function parseCircuit(text2) {
  const locator = chunk54Q7JDQB_cjs.createSourceLocator(text2);
  const rawLines = text2.split("\n");
  const firstMeaningful = rawLines.map((l) => l.replace(/[#;].*$/, "").trim()).find((l) => l.length > 0) ?? "";
  if (/^circuit\b.*\bnetlist\s*$/i.test(firstMeaningful)) {
    const netlistTitle = chunk4M6OFAHM_cjs.matchQuotedTitle(firstMeaningful);
    let headerIdx = -1;
    for (let i = 0; i < rawLines.length; i++) {
      const s = rawLines[i].replace(/[#;].*$/, "").trim();
      if (s.length > 0) {
        headerIdx = i;
        break;
      }
    }
    const body = rawLines.slice(headerIdx + 1).join("\n");
    const ast = parseNetlist(body, netlistTitle);
    const header = rawLines[headerIdx].replace(/\r$/, "");
    const token = chunk54Q7JDQB_cjs.findFirstQuotedRange(header);
    if (token) {
      const headerStart = rawLines.slice(0, headerIdx).reduce((sum, line) => sum + line.length + 1, 0);
      ast.titleSourceRange = locator.range(headerStart + token.start, headerStart + token.end);
    }
    let sourceOffset = rawLines.slice(0, headerIdx + 1).reduce((sum, line) => sum + line.length + 1, 0);
    for (const line of rawLines.slice(headerIdx + 1)) {
      const id = /^\s*([a-zA-Z_][\w]*)/.exec(line)?.[1];
      const component = id ? ast.components.find((candidate) => candidate.id === id) : void 0;
      if (component) {
        for (const key of ["label", "value"]) {
          const match = new RegExp(`(?:^|\\s)${key}=("[^"]*"|\\S+)`).exec(line);
          if (!match) continue;
          const valueToken = match[1];
          const valueStart = match.index + match[0].lastIndexOf(valueToken);
          component[key === "label" ? "labelSourceRange" : "valueSourceRange"] = locator.range(
            sourceOffset + valueStart,
            sourceOffset + valueStart + valueToken.length
          );
        }
      }
      sourceOffset += line.length + 1;
    }
    return ast;
  }
  const lines = text2.split("\n").map((l) => l.replace(/\r$/, ""));
  let title2;
  let titleSourceRange;
  const components = [];
  const nets = [];
  const netByName = /* @__PURE__ */ new Map();
  let autoId = 0;
  let pendingAt;
  const mkId = (prefix) => `${prefix}_${autoId++}`;
  let lineStart = 0;
  for (const rawLine of lines) {
    const stripped = rawLine.replace(/[#;].*$/, "").trim();
    const absoluteStrippedStart = lineStart + Math.max(0, rawLine.indexOf(stripped));
    lineStart += rawLine.length + 1;
    if (!stripped) continue;
    if (/^circuit\b/i.test(stripped)) {
      const t = chunk4M6OFAHM_cjs.matchQuotedTitle(stripped);
      if (t !== void 0) {
        title2 = t;
        const token = chunk54Q7JDQB_cjs.findFirstQuotedRange(stripped);
        if (token) titleSourceRange = locator.range(absoluteStrippedStart + token.start, absoluteStrippedStart + token.end);
      }
      continue;
    }
    const atMatch = stripped.match(/^at:\s*(.+)$/i);
    if (atMatch) {
      pendingAt = atMatch[1].trim();
      continue;
    }
    const netDecl = stripped.match(/^net\s+([a-zA-Z_][\w]*)\s*$/i);
    if (netDecl) {
      const name = netDecl[1];
      if (!netByName.has(name)) {
        const n = { id: name, anchors: [] };
        netByName.set(name, n);
        nets.push(n);
      }
      continue;
    }
    const netDotMatch = stripped.match(/^net\s+([a-zA-Z_][\w]*)\s*:\s*dot\s*$/i);
    if (netDotMatch) {
      const name = netDotMatch[1];
      let n = netByName.get(name);
      if (!n) {
        n = { id: name, anchors: [] };
        netByName.set(name, n);
        nets.push(n);
      }
      const id = mkId("dot");
      components.push({
        id,
        stableId: false,
        componentType: "dot",
        direction: "right",
        at: pendingAt,
        attrs: { net: name }
      });
      n.anchors.push(`${id}.end`);
      pendingAt = `${id}.end`;
      continue;
    }
    const labelMatch = stripped.match(/^label\s+"([^"]*)"(?:\s+(right|left|up|down))?\s*$/i);
    if (labelMatch) {
      const id = mkId("lbl");
      components.push({
        id,
        stableId: false,
        componentType: "label",
        direction: labelMatch[2]?.toLowerCase() ?? "right",
        at: pendingAt,
        label: labelMatch[1],
        labelSourceRange: (() => {
          const token = chunk54Q7JDQB_cjs.findFirstQuotedRange(stripped);
          return token ? locator.range(absoluteStrippedStart + token.start, absoluteStrippedStart + token.end) : void 0;
        })()
      });
      continue;
    }
    const wireMatch = stripped.match(/^wire(?:\s+(right|left|up|down))?(?:\s+(\d+)(?:px)?)?\s*$/i);
    if (wireMatch) {
      const id = mkId("w");
      components.push({
        id,
        stableId: false,
        componentType: "wire",
        direction: wireMatch[1]?.toLowerCase() ?? "right",
        at: pendingAt,
        attrs: wireMatch[2] ? { length: wireMatch[2] } : {}
      });
      pendingAt = `${id}.end`;
      continue;
    }
    const bareMatch = stripped.match(/^([a-zA-Z_][\w]*)(\s+.*)?$/);
    const colonMatch = stripped.match(/^([a-zA-Z_][\w]*)\s*:\s*([a-zA-Z_][\w]*)(\s+.*)?$/);
    if (colonMatch) {
      const id = colonMatch[1];
      const typeStr = colonMatch[2];
      const norm = normalizeType(typeStr);
      if (!norm) {
        throw new CircuitParseError(`Unknown component type: ${typeStr}`);
      }
      const rest = colonMatch[3] ?? "";
      const parsed = parseAttrs(rest, absoluteStrippedStart + stripped.length - rest.length, locator);
      const comp = {
        id,
        stableId: true,
        componentType: norm,
        direction: parsed.direction ?? "right",
        at: parsed.at ?? pendingAt,
        label: parsed.label,
        labelSourceRange: parsed.labelSourceRange,
        value: parsed.value,
        valueSourceRange: parsed.valueSourceRange,
        attrs: parsed.attrs
      };
      if (parsed.length) {
        comp.attrs = { ...comp.attrs, length: parsed.length };
      }
      components.push(comp);
      pendingAt = `${id}.end`;
      continue;
    }
    if (bareMatch) {
      const typeStr = bareMatch[1];
      const norm = normalizeType(typeStr);
      if (!norm) {
        throw new CircuitParseError(
          `Unknown component type: "${typeStr}". For SPICE-style connectivity (Id net1 net2 [value]), start the diagram with the \`netlist\` header: circuit "..." netlist.`
        );
      }
      const rest = bareMatch[2] ?? "";
      const parsed = parseAttrs(rest, absoluteStrippedStart + stripped.length - rest.length, locator);
      const id = mkId(norm);
      const comp = {
        id,
        stableId: false,
        componentType: norm,
        direction: parsed.direction ?? "right",
        at: parsed.at ?? pendingAt,
        label: parsed.label,
        labelSourceRange: parsed.labelSourceRange,
        value: parsed.value,
        valueSourceRange: parsed.valueSourceRange,
        attrs: parsed.attrs
      };
      components.push(comp);
      pendingAt = `${id}.end`;
      continue;
    }
  }
  return {
    type: "circuit",
    title: title2,
    titleSourceRange,
    components,
    nets,
    mode: "positional"
  };
}

// src/diagrams/circuit/lint.ts
var INTENTIONAL_SINGLE_PIN = /* @__PURE__ */ new Set([
  "ground",
  "gnd_signal",
  "gnd_chassis",
  "gnd_digital",
  "vcc",
  "antenna",
  "no_connect",
  "test_point",
  "label",
  "port"
]);
var SOURCE_TYPES = /* @__PURE__ */ new Set([
  "voltage_source",
  "ac_source",
  "battery",
  "current_source"
]);
var GROUND_TYPES = /* @__PURE__ */ new Set([
  "ground",
  "gnd_signal",
  "gnd_chassis",
  "gnd_digital"
]);
var NC_NET = /_nc\d+$/;
var CONVENTIONAL_OPEN_NET = [
  // power rails: vcc vdd vee vss vbat vbus vref vcore avcc avdd dvdd dvss agnd dgnd
  /^(vcc|vdd|vee|vss|vbat|vbus|vref|vcore|avcc|avdd|dvdd|dvss|agnd|dgnd)\d*$/i,
  // voltage-literal rails: +5V, -12v, 3.3V, 3V3, 1V8
  /^[+-]?\d+(\.\d+)?v$/i,
  /^\d+v\d+$/i,
  // I/O ports: in, out, input, output, vin, vout, io (optionally numbered)
  /^(v?in|v?out|input|output|io)\d*$/i,
  // compound port suffixes: pwm_in, sig_out, audio_in2
  /(^|[_.])(in|out|input|output)\d*$/i,
  // serial/control pins broken out to headers: sda1, tx, clk, rst …
  /^(sda|scl|tx|rx|txd|rxd|clk|sck|xtal|mosi|miso|cs|ss|en|rst|reset|nrst|int|irq|pwm)\d*$/i
];
function isConventionalOpenNet(id) {
  return CONVENTIONAL_OPEN_NET.some((re) => re.test(id));
}
function componentIdOfAnchor(anchor) {
  const dot = anchor.lastIndexOf(".");
  return dot < 0 ? anchor : anchor.slice(0, dot);
}
function editDistanceWithin(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return false;
  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return false;
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length] <= max;
}
function lintCircuit(text2) {
  let ast;
  try {
    ast = parseCircuit(text2);
  } catch {
    return [];
  }
  const out = [];
  const idCounts = /* @__PURE__ */ new Map();
  for (const c of ast.components) {
    if (c.id.startsWith("_")) continue;
    idCounts.set(c.id, (idCounts.get(c.id) ?? 0) + 1);
  }
  for (const [id, n] of idCounts) {
    if (n > 1) {
      out.push({
        severity: "error",
        code: "CIRCUIT_DUPLICATE_ID",
        message: `component id "${id}" is declared ${n} times; each reference designator must be unique`,
        hint: `Rename the duplicates (e.g. ${id}, ${id}B). With a repeated id only the last line's connections are kept.`,
        fatal: false
      });
    }
  }
  for (const u of ast.recovered?.underspecified ?? []) {
    out.push({
      severity: "warning",
      code: "CIRCUIT_PIN_UNDERSPECIFIED",
      message: `component ${u.id} (${u.type}) needs ${u.expected} nets but got ${u.got}; the missing terminal(s) were left floating`,
      hint: `Give ${u.id} all ${u.expected} net connections (e.g. a transformer is \`${u.id} p1 p2 s1 s2 type=transformer\`). Unconnected pins are drawn but not wired.`,
      fatal: false
    });
  }
  if (ast.mode !== "netlist") return out;
  const compById = /* @__PURE__ */ new Map();
  for (const c of ast.components) compById.set(c.id, c);
  const hasGround = ast.nets.some((n) => n.id === "GND") || ast.components.some((c) => GROUND_TYPES.has(c.componentType));
  const sources = ast.components.filter((c) => SOURCE_TYPES.has(c.componentType));
  if (sources.length > 0 && !hasGround) {
    out.push({
      severity: "warning",
      code: "CIRCUIT_NO_GROUND",
      message: `circuit has ${sources.length} source(s) (e.g. ${sources[0].id}) but no ground reference; node voltages are undefined`,
      hint: `Tie a return node to ground \u2014 name a net \`0\`/\`GND\` (e.g. \`${sources[0].id} ${sources[0].id.toLowerCase()}_out 0\`) or add a ground symbol.`,
      fatal: false
    });
  }
  const wired = ast.nets.filter(
    (n) => n.anchors.length >= 2 && !NC_NET.test(n.id)
  );
  for (const net of ast.nets) {
    if (net.id === "GND") continue;
    if (NC_NET.test(net.id)) continue;
    if (net.anchors.length !== 1) continue;
    if (isConventionalOpenNet(net.id)) continue;
    const comp = compById.get(componentIdOfAnchor(net.anchors[0]));
    if (comp && INTENTIONAL_SINGLE_PIN.has(comp.componentType)) continue;
    const lower = net.id.toLowerCase();
    const typoTarget = wired.find(
      (w) => w.id.toLowerCase() !== lower && Math.max(w.id.length, net.id.length) >= 3 && editDistanceWithin(lower, w.id.toLowerCase(), 1)
    );
    if (typoTarget) {
      out.push({
        severity: "warning",
        code: "CIRCUIT_NET_TYPO",
        message: `net "${net.id}" connects to only one pin and is one character from "${typoTarget.id}" \u2014 likely a misspelled connection`,
        hint: `If they are the same node, rename "${net.id}" to "${typoTarget.id}" so the pins join.`,
        fatal: false
      });
    } else {
      out.push({
        severity: "warning",
        code: "CIRCUIT_FLOATING_NET",
        message: `net "${net.id}" connects to only one pin (${net.anchors[0]}); nothing else joins this node`,
        hint: `Wire "${net.id}" to another pin, or mark the pin as intentionally open with a no-connect.`,
        fatal: false
      });
    }
  }
  return out;
}

// src/diagrams/circuit/layout.ts
function rotationDeg(d) {
  return d === "right" ? 0 : d === "down" ? 90 : d === "left" ? 180 : 270;
}
function rotatePoint(p, angleDeg) {
  const r = angleDeg * Math.PI / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}
function resolveAnchorRef(ref, byId, nets) {
  if (ref === "origin") return { x: 0, y: 0 };
  const coord = /^@?(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(ref.trim());
  if (coord) return { x: Number(coord[1]), y: Number(coord[2]) };
  if (nets.has(ref)) return nets.get(ref);
  const dot = ref.indexOf(".");
  if (dot < 0) {
    const c2 = byId.get(ref);
    if (c2) return c2.anchors.end ?? c2.anchors.center ?? { x: c2.x, y: c2.y };
    return void 0;
  }
  const id = ref.slice(0, dot);
  const pin = ref.slice(dot + 1);
  const c = byId.get(id);
  if (!c) return void 0;
  return c.anchors[pin];
}
function layoutCircuit(ast) {
  const items = [];
  const byId = /* @__PURE__ */ new Map();
  const nets = /* @__PURE__ */ new Map();
  let cursor = { x: 0, y: 0 };
  for (const comp of ast.components) {
    let startPt = cursor;
    if (comp.at) {
      const resolved = resolveAnchorRef(comp.at, byId, nets);
      if (resolved) startPt = resolved;
    }
    const sym = effectiveSymbolDef(comp.componentType, comp.attrs) ?? getSymbol(comp.componentType);
    const rot = rotationDeg(comp.direction);
    if (comp.componentType === "wire") {
      const len = parseInt(comp.attrs?.length ?? "20", 10);
      const endOffset = rotatePoint({ x: len, y: 0 }, rot);
      const end = { x: startPt.x + endOffset.x, y: startPt.y + endOffset.y };
      const laid2 = {
        component: comp,
        x: startPt.x,
        y: startPt.y,
        rotation: rot,
        length: len,
        anchors: { start: startPt, end }
      };
      items.push(laid2);
      byId.set(comp.id, laid2);
      cursor = end;
      continue;
    }
    if (comp.componentType === "dot") {
      const laid2 = {
        component: comp,
        x: startPt.x,
        y: startPt.y,
        rotation: 0,
        length: 0,
        anchors: { start: startPt, end: startPt, center: startPt }
      };
      items.push(laid2);
      byId.set(comp.id, laid2);
      if (comp.attrs?.net) nets.set(comp.attrs.net, startPt);
      cursor = startPt;
      continue;
    }
    if (comp.componentType === "label") {
      const laid2 = {
        component: comp,
        x: startPt.x,
        y: startPt.y,
        rotation: rot,
        length: 0,
        anchors: { start: startPt, end: startPt }
      };
      items.push(laid2);
      byId.set(comp.id, laid2);
      continue;
    }
    if (!sym) {
      const endOffset = rotatePoint({ x: 30, y: 0 }, rot);
      const end = { x: startPt.x + endOffset.x, y: startPt.y + endOffset.y };
      const laid2 = {
        component: comp,
        x: startPt.x,
        y: startPt.y,
        rotation: rot,
        length: 30,
        anchors: { start: startPt, end }
      };
      items.push(laid2);
      byId.set(comp.id, laid2);
      cursor = end;
      continue;
    }
    const worldAnchors = {};
    for (const [name, pt] of Object.entries(sym.anchors)) {
      const rp = rotatePoint(pt, rot);
      worldAnchors[name] = { x: startPt.x + rp.x, y: startPt.y + rp.y };
    }
    const laid = {
      component: comp,
      x: startPt.x,
      y: startPt.y,
      rotation: rot,
      length: sym.length,
      anchors: worldAnchors
    };
    items.push(laid);
    byId.set(comp.id, laid);
    cursor = worldAnchors.end ?? startPt;
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const it of items) {
    for (const a of Object.values(it.anchors)) {
      if (a.x < minX) minX = a.x;
      if (a.y < minY) minY = a.y;
      if (a.x > maxX) maxX = a.x;
      if (a.y > maxY) maxY = a.y;
    }
  }
  if (!isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 100;
    maxY = 100;
  }
  const pad = 40;
  minX -= pad;
  minY -= pad;
  maxX += pad;
  maxY += pad;
  const width = maxX - minX;
  const height = maxY - minY;
  return {
    width,
    height,
    offsetX: -minX,
    offsetY: -minY,
    items
  };
}

// src/diagrams/circuit/autolayout.ts
var COL_W = 96;
var ROW_H = 80;
var LEFT_MARGIN = 70;
var TOP_MARGIN = 56;
var SHUNT_OFFSET = 28;
var AC_LEFT_MARGIN = 96;
var AC_LIVE_Y = 56;
var AC_RETURN_Y = 150;
var AC_SERIES_GAP = 58;
var AC_TRAVELER_SPAN = 128;
function isPowerSource(c) {
  return c.componentType === "voltage_source" || c.componentType === "current_source" || c.componentType === "ac_source" || c.componentType === "battery" || c.componentType === "vcc";
}
function isGround(c) {
  return c.componentType === "ground" || c.componentType === "gnd_signal" || c.componentType === "gnd_chassis" || c.componentType === "gnd_digital";
}
function rotatePt(p, angleDeg) {
  const r = angleDeg * Math.PI / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}
function rotationOf(dir) {
  return dir === "right" ? 0 : dir === "down" ? 90 : dir === "left" ? 180 : 270;
}
function defaultDirection(c) {
  if (isPowerSource(c)) return "up";
  if (isGround(c)) return "down";
  return "right";
}
function extendBBox(bbox, pt) {
  if (pt.x < bbox.minX) bbox.minX = pt.x;
  if (pt.y < bbox.minY) bbox.minY = pt.y;
  if (pt.x > bbox.maxX) bbox.maxX = pt.x;
  if (pt.y > bbox.maxY) bbox.maxY = pt.y;
}
function placeComponent(comp, x, y, fallbackDir) {
  const direction = comp.attrs?.dirExplicit === "true" ? comp.direction : fallbackDir ?? defaultDirection(comp);
  comp.direction = direction;
  const rot = rotationOf(direction);
  const sym = getSymbol(comp.componentType);
  const worldAnchors = {};
  if (sym) {
    for (const [name, pt] of Object.entries(sym.anchors)) {
      const rp = rotatePt(pt, rot);
      worldAnchors[name] = { x: x + rp.x, y: y + rp.y };
    }
  } else {
    worldAnchors.start = { x, y };
    worldAnchors.end = { x: x + 30, y };
  }
  return {
    component: comp,
    x,
    y,
    rotation: rot,
    length: sym?.length ?? 30,
    anchors: worldAnchors
  };
}
function placeMirroredComponent(comp, x, y) {
  const sym = getSymbol(comp.componentType);
  const length = sym?.length ?? 30;
  const worldAnchors = {};
  comp.direction = "left";
  if (sym) {
    for (const [name, pt] of Object.entries(sym.anchors)) {
      worldAnchors[name] = { x: x + length - pt.x, y: y + pt.y };
    }
  } else {
    worldAnchors.start = { x: x + length, y };
    worldAnchors.end = { x, y };
  }
  return {
    component: comp,
    x,
    y,
    rotation: 0,
    mirrorX: true,
    length,
    anchors: worldAnchors
  };
}
function pinEntries(pinMap, comp) {
  return Object.entries(pinMap[comp.id] ?? {});
}
function anchorForNet(pinMap, laid, netId) {
  const pin = Object.entries(pinMap[laid.component.id] ?? {}).find(
    ([, net]) => net === netId
  )?.[0];
  return pin ? laid.anchors[pin] : void 0;
}
function compactPoints(points) {
  const out = [];
  for (const p of points) {
    const prev = out[out.length - 1];
    if (!prev || Math.abs(prev.x - p.x) > 0.5 || Math.abs(prev.y - p.y) > 0.5) {
      out.push(p);
    }
  }
  return out;
}
function routeViaY(netId, a, b, y) {
  if (Math.abs(a.y - b.y) < 0.5) return { netId, points: [a, b] };
  return {
    netId,
    points: compactPoints([a, { x: a.x, y }, { x: b.x, y }, b])
  };
}
function routeViaX(netId, a, b, x) {
  if (Math.abs(a.x - b.x) < 0.5) return { netId, points: [a, b] };
  return {
    netId,
    points: compactPoints([a, { x, y: a.y }, { x, y: b.y }, b])
  };
}
function isAutoGround(c) {
  return isGround(c) && c.attrs?.auto === "true";
}
function isTwoTerminal(pinMap, comp) {
  return pinEntries(pinMap, comp).length === 2;
}
function isLightingLoad(c) {
  return c.componentType === "lamp" || c.componentType === "pilot_light" || c.componentType === "motor" || c.componentType === "buzzer" || c.componentType === "speaker";
}
function traceTwoTerminalChain(pinMap, candidates, startNet, endNet) {
  const remaining = new Set(candidates.map((c) => c.id));
  const steps = [];
  const seenNets = /* @__PURE__ */ new Set([startNet]);
  let current = startNet;
  for (let guard = 0; guard <= candidates.length; guard++) {
    if (current === endNet) return { steps, used: new Set(steps.map((s) => s.comp.id)) };
    const hits = candidates.filter((c) => {
      if (!remaining.has(c.id) || !isTwoTerminal(pinMap, c)) return false;
      return pinEntries(pinMap, c).some(([, net]) => net === current);
    });
    if (hits.length !== 1) return null;
    const comp = hits[0];
    const nets = pinEntries(pinMap, comp).map(([, net]) => net);
    const next = nets[0] === current ? nets[1] : nets[0];
    if (!next || seenNets.has(next) && next !== endNet) return null;
    steps.push({ comp, inNet: current, outNet: next });
    remaining.delete(comp.id);
    seenNets.add(next);
    current = next;
  }
  return null;
}
function finalizeAutoLayout(items, routes) {
  const bbox = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity
  };
  for (const it of items) {
    for (const a of Object.values(it.anchors)) extendBBox(bbox, a);
  }
  for (const r of routes) {
    for (const p of r.points) extendBBox(bbox, p);
  }
  if (!isFinite(bbox.minX)) {
    bbox.minX = 0;
    bbox.minY = 0;
    bbox.maxX = 200;
    bbox.maxY = 200;
  }
  const pad = 52;
  const minX = bbox.minX - pad;
  const minY = bbox.minY - pad;
  const maxX = bbox.maxX + pad;
  const maxY = bbox.maxY + pad;
  return {
    width: maxX - minX,
    height: maxY - minY,
    offsetX: -minX,
    offsetY: -minY,
    items,
    routes
  };
}
function appendReturnRail(routes, pinMap, sourceLaid, loadLaid, returnNet) {
  const sourceReturn = anchorForNet(pinMap, sourceLaid, returnNet);
  const loadReturn = anchorForNet(pinMap, loadLaid, returnNet);
  if (!sourceReturn || !loadReturn) return false;
  routes.push({
    netId: returnNet,
    points: [
      { x: sourceReturn.x, y: AC_RETURN_Y },
      { x: loadReturn.x, y: AC_RETURN_Y }
    ]
  });
  routes.push({
    netId: `${returnNet}.${sourceLaid.component.id}`,
    points: compactPoints([sourceReturn, { x: sourceReturn.x, y: AC_RETURN_Y }])
  });
  routes.push({
    netId: `${returnNet}.${loadLaid.component.id}`,
    points: compactPoints([loadReturn, { x: loadReturn.x, y: AC_RETURN_Y }])
  });
  return true;
}
function sourceLiveReturnNets(pinMap, source) {
  const pins = pinMap[source.id];
  if (!pins) return null;
  const liveNet = pins.plus ?? pins.end ?? Object.values(pins)[0];
  const returnNet = pins.minus ?? pins.start ?? Object.values(pins)[1];
  if (!liveNet || !returnNet || liveNet === returnNet) return null;
  return { liveNet, returnNet };
}
function layoutTwoWireSeriesLoop(ast, source, chain, load, liveNet, returnNet, loadLiveNet) {
  const pinMap = ast.pinMap ?? {};
  const items = [];
  const routes = [];
  const put = (comp, x, y, fallbackDir) => {
    const laid = placeComponent(comp, x, y, fallbackDir);
    items.push(laid);
    return laid;
  };
  const sourceLaid = put(source, AC_LEFT_MARGIN, AC_LIVE_Y + 62, "up");
  let cursorX = AC_LEFT_MARGIN + 86;
  let prevPt = anchorForNet(pinMap, sourceLaid, liveNet);
  if (!prevPt) return null;
  for (const step of chain) {
    const laid = put(step.comp, cursorX, AC_LIVE_Y, "right");
    const inPt = anchorForNet(pinMap, laid, step.inNet);
    const outPt = anchorForNet(pinMap, laid, step.outNet);
    if (!inPt || !outPt) return null;
    routes.push(routeViaY(step.inNet, prevPt, inPt, AC_LIVE_Y));
    prevPt = outPt;
    cursorX += laid.length + AC_SERIES_GAP;
  }
  const loadLaid = put(load, cursorX, AC_LIVE_Y, "right");
  const loadLive = anchorForNet(pinMap, loadLaid, loadLiveNet);
  if (!loadLive) return null;
  routes.push(routeViaY(loadLiveNet, prevPt, loadLive, AC_LIVE_Y));
  if (!appendReturnRail(routes, pinMap, sourceLaid, loadLaid, returnNet)) return null;
  return finalizeAutoLayout(items, routes);
}
function layoutTwoWayLightingLoop(ast, source, preChain, leftSwitch, rightSwitch, postChain, load, liveNet, returnNet, loadLiveNet) {
  const pinMap = ast.pinMap ?? {};
  const leftPins = pinMap[leftSwitch.id] ?? {};
  const rightPins = pinMap[rightSwitch.id] ?? {};
  const travelerNets = [leftPins.nc, leftPins.no].filter(Boolean);
  if (travelerNets.length !== 2 || !travelerNets.every((n) => n === rightPins.nc || n === rightPins.no)) {
    return null;
  }
  const items = [];
  const routes = [];
  const put = (comp, x, y, fallbackDir) => {
    const laid = placeComponent(comp, x, y, fallbackDir);
    items.push(laid);
    return laid;
  };
  const sourceLaid = put(source, AC_LEFT_MARGIN, AC_LIVE_Y + 62, "up");
  let cursorX = AC_LEFT_MARGIN + 86;
  let prevPt = anchorForNet(pinMap, sourceLaid, liveNet);
  if (!prevPt) return null;
  for (const step of preChain) {
    const laid = put(step.comp, cursorX, AC_LIVE_Y, "right");
    const inPt = anchorForNet(pinMap, laid, step.inNet);
    const outPt = anchorForNet(pinMap, laid, step.outNet);
    if (!inPt || !outPt) return null;
    routes.push(routeViaY(step.inNet, prevPt, inPt, AC_LIVE_Y));
    prevPt = outPt;
    cursorX += laid.length + AC_SERIES_GAP;
  }
  const leftLaid = put(leftSwitch, cursorX, AC_LIVE_Y, "right");
  const leftCommon = leftLaid.anchors.common;
  if (!leftCommon) return null;
  routes.push(routeViaY(leftPins.common ?? liveNet, prevPt, leftCommon, AC_LIVE_Y));
  const rightCommonX = leftLaid.x + leftLaid.length + AC_TRAVELER_SPAN + leftLaid.length;
  const sameTravelerOrder = leftPins.nc === rightPins.nc && leftPins.no === rightPins.no;
  const rightLength = getSymbol(rightSwitch.componentType)?.length ?? 30;
  const rightLaid = sameTravelerOrder ? placeMirroredComponent(rightSwitch, rightCommonX - rightLength, AC_LIVE_Y) : placeComponent(rightSwitch, rightCommonX, AC_LIVE_Y, "left");
  items.push(rightLaid);
  for (const net of travelerNets) {
    const a = anchorForNet(pinMap, leftLaid, net);
    const b = anchorForNet(pinMap, rightLaid, net);
    if (!a || !b) return null;
    routes.push(routeViaX(net, a, b, (a.x + b.x) / 2));
  }
  prevPt = rightLaid.anchors.common;
  if (!prevPt) return null;
  cursorX = rightCommonX + AC_SERIES_GAP;
  for (const step of postChain) {
    const laid = put(step.comp, cursorX, AC_LIVE_Y, "right");
    const inPt = anchorForNet(pinMap, laid, step.inNet);
    const outPt = anchorForNet(pinMap, laid, step.outNet);
    if (!inPt || !outPt) return null;
    routes.push(routeViaY(step.inNet, prevPt, inPt, AC_LIVE_Y));
    prevPt = outPt;
    cursorX += laid.length + AC_SERIES_GAP;
  }
  const loadLaid = put(load, cursorX, AC_LIVE_Y, "right");
  const loadLive = anchorForNet(pinMap, loadLaid, loadLiveNet);
  if (!loadLive) return null;
  routes.push(routeViaY(loadLiveNet, prevPt, loadLive, AC_LIVE_Y));
  if (!appendReturnRail(routes, pinMap, sourceLaid, loadLaid, returnNet)) return null;
  return finalizeAutoLayout(items, routes);
}
function tryLayoutTwoWireLighting(ast) {
  const pinMap = ast.pinMap ?? {};
  const sources = ast.components.filter(isPowerSource);
  if (sources.length !== 1) return null;
  const source = sources[0];
  const nets = sourceLiveReturnNets(pinMap, source);
  if (!nets || nets.liveNet === "GND" || nets.returnNet === "GND") return null;
  const { liveNet, returnNet } = nets;
  const loads = ast.components.filter((c) => {
    if (!isLightingLoad(c)) return false;
    const pins = pinEntries(pinMap, c);
    return pins.length === 2 && pins.some(([, net]) => net === returnNet);
  });
  if (loads.length !== 1) return null;
  const load = loads[0];
  const loadLiveNet = pinEntries(pinMap, load).find(([, net]) => net !== returnNet)?.[1];
  if (!loadLiveNet) return null;
  const excluded = /* @__PURE__ */ new Set([source.id, load.id]);
  const middle = ast.components.filter((c) => !excluded.has(c.id) && !isAutoGround(c));
  const spdts = middle.filter((c) => c.componentType === "switch_spdt");
  if (spdts.length === 0) {
    if (!middle.every((c) => isTwoTerminal(pinMap, c))) return null;
    const traced = traceTwoTerminalChain(pinMap, middle, liveNet, loadLiveNet);
    if (!traced || traced.used.size !== middle.length) return null;
    return layoutTwoWireSeriesLoop(ast, source, traced.steps, load, liveNet, returnNet, loadLiveNet);
  }
  if (spdts.length === 2) {
    const twoTerminal = middle.filter((c) => c.componentType !== "switch_spdt");
    if (!twoTerminal.every((c) => isTwoTerminal(pinMap, c))) return null;
    for (const [leftSwitch, rightSwitch] of [
      [spdts[0], spdts[1]],
      [spdts[1], spdts[0]]
    ]) {
      const leftCommon = pinMap[leftSwitch.id]?.common;
      const rightCommon = pinMap[rightSwitch.id]?.common;
      if (!leftCommon || !rightCommon) continue;
      const pre = traceTwoTerminalChain(pinMap, twoTerminal, liveNet, leftCommon);
      if (!pre) continue;
      const postCandidates = twoTerminal.filter((c) => !pre.used.has(c.id));
      const post = traceTwoTerminalChain(pinMap, postCandidates, rightCommon, loadLiveNet);
      if (!post) continue;
      if (pre.used.size + post.used.size !== twoTerminal.length) continue;
      const rendered = layoutTwoWayLightingLoop(
        ast,
        source,
        pre.steps,
        leftSwitch,
        rightSwitch,
        post.steps,
        load,
        liveNet,
        returnNet,
        loadLiveNet
      );
      if (rendered) return rendered;
    }
  }
  return null;
}
function layoutCircuitNetlist(ast) {
  const pinMap = ast.pinMap ?? {};
  const twoWireLighting = tryLayoutTwoWireLighting(ast);
  if (twoWireLighting) return twoWireLighting;
  const isShunt = (c) => {
    if (isPowerSource(c) || isGround(c)) return false;
    const pins = pinMap[c.id];
    if (!pins) return false;
    const nets = Object.values(pins);
    return nets.length === 2 && nets.filter((n) => n === "GND").length === 1;
  };
  const powerComps = [];
  const groundComps = [];
  const shuntComps = [];
  const middleComps = [];
  for (const c of ast.components) {
    if (isPowerSource(c)) powerComps.push(c);
    else if (isGround(c)) groundComps.push(c);
    else if (isShunt(c)) shuntComps.push(c);
    else middleComps.push(c);
  }
  const spine = [...powerComps, ...middleComps];
  const placed = /* @__PURE__ */ new Map();
  const items = [];
  const place = (comp, x, y, fallbackDir) => {
    const laid = placeComponent(comp, x, y, fallbackDir);
    items.push(laid);
    placed.set(comp.id, laid);
    return laid;
  };
  if (spine.length === 0 && shuntComps.length === 0) {
    ast.components.forEach(
      (comp, i) => place(comp, LEFT_MARGIN + i * COL_W, TOP_MARGIN)
    );
  } else {
    const spineY = TOP_MARGIN;
    spine.forEach((comp, i) => place(comp, LEFT_MARGIN + i * COL_W, spineY));
    const spinePinX = /* @__PURE__ */ new Map();
    for (const comp of spine) {
      const pins = pinMap[comp.id];
      const laid = placed.get(comp.id);
      if (!pins || !laid) continue;
      for (const [pinName, net] of Object.entries(pins)) {
        if (net === "GND") continue;
        const a = laid.anchors[pinName];
        if (a && !spinePinX.has(net)) spinePinX.set(net, a.x);
      }
    }
    const shuntY = spineY + ROW_H;
    const sharedNode = /* @__PURE__ */ new Map();
    shuntComps.forEach((comp, idx) => {
      const pins = pinMap[comp.id];
      const sigNet = Object.values(pins).find((n) => n !== "GND");
      let x = (sigNet !== void 0 ? spinePinX.get(sigNet) : void 0) ?? LEFT_MARGIN + (spine.length + idx) * COL_W;
      const used = sharedNode.get(x) ?? 0;
      sharedNode.set(x, used + 1);
      x += used * SHUNT_OFFSET;
      place(comp, x, shuntY, "down");
    });
    const baseY = shuntComps.length ? shuntY : spineY;
    const groundY = baseY + ROW_H;
    const xs = items.map((it) => it.x);
    const gx = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : LEFT_MARGIN;
    groundComps.forEach((comp, i) => place(comp, gx + i * COL_W, groundY, "down"));
  }
  const netPins = /* @__PURE__ */ new Map();
  for (const comp of ast.components) {
    const pins = pinMap[comp.id];
    if (!pins) continue;
    const laid = placed.get(comp.id);
    if (!laid) continue;
    for (const [pinName, netId] of Object.entries(pins)) {
      const pt = laid.anchors[pinName];
      if (!pt) continue;
      if (!netPins.has(netId)) netPins.set(netId, []);
      netPins.get(netId).push({ compId: comp.id, pinName, pt });
    }
  }
  const routes = [];
  const bbox = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity
  };
  for (const it of items) {
    for (const a of Object.values(it.anchors)) extendBBox(bbox, a);
  }
  if (!isFinite(bbox.minX)) {
    bbox.minX = 0;
    bbox.minY = 0;
    bbox.maxX = 200;
    bbox.maxY = 200;
  }
  for (const [netId, pins] of netPins) {
    if (pins.length < 2) continue;
    if (netId === "GND") {
      const railY = bbox.maxY + 30;
      const minX2 = Math.min(...pins.map((p) => p.pt.x));
      const maxX2 = Math.max(...pins.map((p) => p.pt.x));
      if (pins.length > 1) {
        routes.push({
          netId,
          points: [
            { x: minX2, y: railY },
            { x: maxX2, y: railY }
          ]
        });
      }
      for (const p of pins) {
        routes.push({
          netId: `${netId}.${p.compId}`,
          points: [
            p.pt,
            { x: p.pt.x, y: railY }
          ]
        });
      }
      bbox.maxY = Math.max(bbox.maxY, railY);
      continue;
    }
    const touchesPowerSource = pins.some((p) => {
      const comp = ast.components.find((c) => c.id === p.compId);
      return !!comp && isPowerSource(comp);
    });
    if (touchesPowerSource && pins.length > 1) {
      const railY = bbox.minY - 30;
      const minX2 = Math.min(...pins.map((p) => p.pt.x));
      const maxX2 = Math.max(...pins.map((p) => p.pt.x));
      routes.push({
        netId,
        points: [
          { x: minX2, y: railY },
          { x: maxX2, y: railY }
        ]
      });
      for (const p of pins) {
        routes.push({
          netId: `${netId}.${p.compId}`,
          points: [p.pt, { x: p.pt.x, y: railY }]
        });
      }
      bbox.minY = Math.min(bbox.minY, railY);
      continue;
    }
    if (pins.length === 2) {
      const [a, b] = pins;
      const points = Math.abs(a.pt.y - b.pt.y) < 0.5 ? [a.pt, b.pt] : Math.abs(a.pt.x - b.pt.x) < 0.5 ? [a.pt, b.pt] : [a.pt, { x: a.pt.x, y: b.pt.y }, b.pt];
      routes.push({ netId, points });
    } else {
      const ys = pins.map((p) => p.pt.y).sort((x, y) => x - y);
      const spineY = ys[Math.floor(ys.length / 2)];
      const xs = pins.map((p) => p.pt.x).sort((x, y) => x - y);
      const spineLeft = xs[0];
      const spineRight = xs[xs.length - 1];
      routes.push({
        netId,
        points: [
          { x: spineLeft, y: spineY },
          { x: spineRight, y: spineY }
        ]
      });
      const junctions = [];
      for (const p of pins) {
        if (Math.abs(p.pt.y - spineY) < 0.5) {
          if (p.pt.x > spineLeft && p.pt.x < spineRight) {
            junctions.push(p.pt);
          }
          continue;
        }
        routes.push({
          netId: `${netId}.${p.compId}`,
          points: [p.pt, { x: p.pt.x, y: spineY }]
        });
        if (p.pt.x > spineLeft && p.pt.x < spineRight) {
          junctions.push({ x: p.pt.x, y: spineY });
        }
      }
      if (junctions.length > 0) {
        routes[routes.length - 1 - pins.filter(
          (p) => Math.abs(p.pt.y - spineY) >= 0.5
        ).length].junctions = junctions;
      }
    }
  }
  for (const r of routes) {
    for (const p of r.points) extendBBox(bbox, p);
  }
  const pad = 40;
  const minX = bbox.minX - pad;
  const minY = bbox.minY - pad;
  const maxX = bbox.maxX + pad;
  const maxY = bbox.maxY + pad;
  return {
    width: maxX - minX,
    height: maxY - minY,
    offsetX: -minX,
    offsetY: -minY,
    items,
    routes
  };
}
function rerouteCircuitNetlist(ast, items, previousRoutes) {
  const placed = new Map(items.map((item) => [item.component.id, item]));
  const componentById = new Map(ast.components.map((component) => [component.id, component]));
  const netPins = /* @__PURE__ */ new Map();
  for (const [componentId, pins] of Object.entries(ast.pinMap ?? {})) {
    const item = placed.get(componentId);
    if (!item) continue;
    for (const [pinName, netId] of Object.entries(pins)) {
      const pt = item.anchors[pinName];
      if (!pt) continue;
      const entries = netPins.get(netId) ?? [];
      entries.push({ compId: componentId, pt });
      netPins.set(netId, entries);
    }
  }
  const priorHorizontal = (netId) => previousRoutes.find((route) => route.netId === netId && route.points.length >= 2 && route.points.every((point) => Math.abs(point.y - route.points[0].y) < 0.1));
  const priorPrimary = (netId) => previousRoutes.find((route) => route.netId === netId && route.points.length >= 2);
  const result = [];
  for (const [netId, pins] of netPins) {
    if (pins.length < 2) continue;
    const points = pins.map((pin) => pin.pt);
    const touchesPowerSource = pins.some((pin) => {
      const component = componentById.get(pin.compId);
      return component ? isPowerSource(component) : false;
    });
    if (netId === "GND" || touchesPowerSource) {
      const oldRail = priorHorizontal(netId);
      const fallbackY = netId === "GND" ? Math.max(...points.map((point) => point.y)) + 30 : Math.min(...points.map((point) => point.y)) - 30;
      const railY = oldRail?.points[0]?.y ?? fallbackY;
      const minX2 = Math.min(...points.map((point) => point.x));
      const maxX2 = Math.max(...points.map((point) => point.x));
      if (maxX2 - minX2 >= 0.1) {
        result.push({ netId, points: [{ x: minX2, y: railY }, { x: maxX2, y: railY }] });
      }
      for (const pin of pins) {
        result.push({
          netId: `${netId}.${pin.compId}`,
          points: compactPoints([pin.pt, { x: pin.pt.x, y: railY }])
        });
      }
      continue;
    }
    if (pins.length === 2) {
      const [a, b] = points;
      if (Math.abs(a.x - b.x) < 0.1 || Math.abs(a.y - b.y) < 0.1) {
        result.push({ netId, points: [a, b] });
        continue;
      }
      const old = priorPrimary(netId)?.points;
      const horizontalFirst = old && old.length >= 2 ? Math.abs(old[0].y - old[1].y) < 0.1 : Math.abs(a.x - b.x) >= Math.abs(a.y - b.y);
      result.push({
        netId,
        points: compactPoints(horizontalFirst ? [a, { x: b.x, y: a.y }, b] : [a, { x: a.x, y: b.y }, b])
      });
      continue;
    }
    const oldSpine = priorHorizontal(netId);
    const sortedY = points.map((point) => point.y).sort((a, b) => a - b);
    const spineY = oldSpine?.points[0]?.y ?? sortedY[Math.floor(sortedY.length / 2)];
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const spine = {
      netId,
      points: [{ x: minX, y: spineY }, { x: maxX, y: spineY }],
      junctions: []
    };
    result.push(spine);
    for (const pin of pins) {
      if (Math.abs(pin.pt.y - spineY) >= 0.1) {
        result.push({
          netId: `${netId}.${pin.compId}`,
          points: [pin.pt, { x: pin.pt.x, y: spineY }]
        });
      }
      if (pin.pt.x > minX && pin.pt.x < maxX) {
        spine.junctions.push({ x: pin.pt.x, y: spineY });
      }
    }
    if (spine.junctions?.length === 0) delete spine.junctions;
  }
  return result;
}

// src/diagrams/circuit/renderer.ts
function itemBBox(it, offX, offY, topOff) {
  const points = Object.values(it.anchors);
  const xs = points.length ? points.map((point) => point.x + offX) : [it.x + offX];
  const ys = points.length ? points.map((point) => point.y + offY + topOff) : [it.y + offY + topOff];
  const minX = Math.min(...xs) - 18;
  const minY = Math.min(...ys) - 22;
  const maxX = Math.max(...xs) + 18;
  const maxY = Math.max(...ys) + 22;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
function samePoint(a, b) {
  return Math.abs(a.x - b.x) < 0.1 && Math.abs(a.y - b.y) < 0.1;
}
function applyCircuitPins(layout, pins, topOff) {
  if (!pins?.size) return;
  for (const item of layout.items) {
    if (!item.component.stableId) continue;
    const pin = pins.get(item.component.id);
    if (!pin) continue;
    const bbox = itemBBox(item, layout.offsetX, layout.offsetY, topOff);
    const dx = pin.x - bbox.x;
    const dy = pin.y - bbox.y;
    if (!dx && !dy) continue;
    const oldAnchors = Object.values(item.anchors).map((point) => ({ ...point }));
    item.x += dx;
    item.y += dy;
    for (const anchor of Object.values(item.anchors)) {
      anchor.x += dx;
      anchor.y += dy;
    }
    for (const wire of layout.items) {
      if (wire.component.componentType !== "wire" || wire === item) continue;
      for (const [name, anchor] of Object.entries(wire.anchors)) {
        if (!oldAnchors.some((old) => samePoint(old, anchor))) continue;
        anchor.x += dx;
        anchor.y += dy;
        if (name === "start") {
          wire.x += dx;
          wire.y += dy;
        }
      }
    }
  }
}
function renderItem(it, offX, offY, topOff, scene) {
  const comp = it.component;
  const tx = it.x + offX;
  const ty = it.y + offY;
  const key = `node:${comp.id}`;
  const bbox = itemBBox(it, offX, offY, topOff);
  const position = comp.stableId ? "free" : "none";
  scene?.push({
    key,
    kind: "node",
    semanticId: comp.stableId ? comp.id : void 0,
    label: comp.label,
    sourceRange: comp.labelSourceRange,
    bbox,
    editable: { label: comp.labelSourceRange !== void 0, position }
  });
  const wrap = (children) => scene ? chunk7ZEDTSU3_cjs.group(
    { "data-sx-key": key, "data-sx-owner": key, "data-id": comp.id, "data-type": comp.componentType },
    [
      chunk7ZEDTSU3_cjs.rect({
        class: "schematex-circuit-hit",
        x: bbox.x,
        y: bbox.y - topOff,
        width: bbox.width,
        height: bbox.height
      }),
      ...Array.isArray(children) ? children : [children]
    ]
  ) : Array.isArray(children) ? children.join("") : children;
  if (comp.componentType === "wire") {
    const x2 = it.anchors.end.x + offX;
    const y2 = it.anchors.end.y + offY;
    return wrap(`<line x1="${tx}" y1="${ty}" x2="${x2}" y2="${y2}" class="schematex-circuit-wire"/>`);
  }
  if (comp.componentType === "dot") {
    return wrap(chunk7ZEDTSU3_cjs.circle({
      cx: tx,
      cy: ty,
      r: 3.5,
      class: "schematex-circuit-dot",
      "data-id": comp.id
    }));
  }
  if (comp.componentType === "label") {
    const dir = comp.direction;
    const anchor = dir === "left" ? "end" : dir === "right" ? "start" : "middle";
    const dx = dir === "right" ? 6 : dir === "left" ? -6 : 0;
    const dy = dir === "down" ? 14 : dir === "up" ? -6 : 4;
    return wrap(chunk7ZEDTSU3_cjs.text(
      {
        x: tx + dx,
        y: ty + dy,
        class: "schematex-circuit-net-label",
        "text-anchor": anchor,
        "data-sx-role": scene && comp.labelSourceRange ? "label" : void 0
      },
      comp.label ?? ""
    ));
  }
  const sym = getSymbol(comp.componentType);
  if (!sym) {
    return wrap(`<rect x="${tx - 10}" y="${ty - 10}" width="20" height="20" fill="none" class="schematex-circuit-err" stroke-dasharray="3,2"/><text x="${tx}" y="${ty + 3}" text-anchor="middle" font-size="9" class="schematex-circuit-err">?${chunk7ZEDTSU3_cjs.escapeXml(comp.componentType)}</text>`);
  }
  const body = sym.svg(comp.label, comp.value, comp.attrs);
  const transform = it.mirrorX ? `translate(${tx + it.length}, ${ty}) scale(-1, 1)` : `translate(${tx}, ${ty}) rotate(${it.rotation})`;
  const labels = [];
  if (comp.label || comp.value) {
    const angle = it.rotation * Math.PI / 180;
    const midpointX = it.x + offX + it.length * Math.cos(angle) / 2;
    const midpointY = it.y + offY + it.length * Math.sin(angle) / 2;
    const vertical = Math.abs(Math.sin(angle)) > 0.5;
    const labelX = midpointX + (vertical ? 34 : 0);
    const labelY = midpointY - (vertical ? 2 : 18);
    if (comp.label) {
      labels.push(
        chunk7ZEDTSU3_cjs.text(
          {
            x: labelX,
            y: labelY,
            class: "schematex-circuit-label",
            "text-anchor": "middle",
            "data-sx-role": scene && comp.labelSourceRange ? "label" : void 0
          },
          comp.label
        )
      );
    }
    if (comp.value) {
      const valueKey = `${key}:value`;
      scene?.push({
        key: valueKey,
        kind: "label",
        label: comp.value,
        sourceRange: comp.valueSourceRange,
        bbox: { x: labelX - Math.max(24, comp.value.length * 3.2), y: labelY, width: Math.max(48, comp.value.length * 6.4), height: 14 },
        editable: { label: comp.valueSourceRange !== void 0, position: "none" }
      });
      labels.push(
        chunk7ZEDTSU3_cjs.text(
          {
            x: labelX,
            y: labelY + 12,
            class: "schematex-circuit-value",
            "text-anchor": "middle",
            "data-sx-key": scene && comp.valueSourceRange ? valueKey : void 0,
            "data-sx-role": scene && comp.valueSourceRange ? "label" : void 0
          },
          comp.value
        )
      );
    }
  }
  const bodyGroup = scene ? chunk7ZEDTSU3_cjs.group({ transform, "data-id": comp.id, "data-type": comp.componentType }, [body]) : `<g transform="${transform}" data-id="${chunk7ZEDTSU3_cjs.escapeXml(comp.id)}" data-type="${chunk7ZEDTSU3_cjs.escapeXml(comp.componentType)}">${body}</g>`;
  return wrap([
    bodyGroup,
    labels.join("")
  ]);
}
function renderRoute(r, offX, offY, index, ast, items, scene) {
  if (r.points.length < 2) return "";
  const pts = r.points.map((point) => `${point.x + offX},${point.y + offY}`).join(" ");
  const d = r.points.map((point, pointIndex) => `${pointIndex === 0 ? "M" : "L"}${point.x + offX} ${point.y + offY}`).join(" ");
  const line = scene ? chunk7ZEDTSU3_cjs.path({ d, class: "schematex-circuit-wire", "data-sx-live-edge": "true" }) : `<polyline points="${pts}" class="schematex-circuit-wire" fill="none"/>`;
  const dots = (r.junctions ?? []).map(
    (j) => `<circle cx="${j.x + offX}" cy="${j.y + offY}" r="3.5" class="schematex-circuit-dot"/>`
  ).join("");
  if (!scene) return line + dots;
  const net = [...ast.nets].sort((a, b) => b.id.length - a.id.length).find(
    (candidate) => r.netId === candidate.id || r.netId.startsWith(`${candidate.id}.`)
  );
  const ids = [...new Set((net?.anchors ?? []).map((anchor) => anchor.split(".")[0]))];
  const branchId = net && r.netId.startsWith(`${net.id}.`) ? r.netId.slice(net.id.length + 1).split(".")[0] : void 0;
  const ownersAt = (point) => [
    ...new Set(items.flatMap(
      (item) => Object.values(item.anchors).some((anchor) => samePoint(anchor, point)) ? [item.component.id] : []
    ))
  ];
  const startOwners = ownersAt(r.points[0]);
  const endOwners = ownersAt(r.points[r.points.length - 1]);
  const liveStartOwners = startOwners.length ? startOwners : branchId ? [branchId] : ids.length === 2 ? [ids[0]] : [];
  const liveEndOwners = endOwners.length ? endOwners : branchId ? [] : ids.length === 2 ? [ids[1]] : [];
  const liveStart = liveStartOwners.join(",") || void 0;
  const liveEnd = liveEndOwners.join(",") || void 0;
  const key = `edge:${index}`;
  scene?.push({ key, kind: "edge", path: d, editable: { label: false, position: "none" } });
  return chunk7ZEDTSU3_cjs.group({
    "data-sx-key": scene ? key : void 0,
    "data-from": liveStartOwners[0],
    "data-to": liveEndOwners[0],
    "data-sx-live-explicit": "true",
    "data-sx-live-start": liveStart,
    "data-sx-live-end": liveEnd,
    "data-sx-live-mode": "orthogonal"
  }, [line, dots]);
}
function renderCircuit(ast, config) {
  const isNetlist = ast.mode === "netlist";
  const topOff = ast.title ? 24 : 0;
  const layout = isNetlist ? layoutCircuitNetlist(ast) : layoutCircuit(ast);
  const baseRoutes = layout.routes?.map((route) => ({
    ...route,
    points: route.points.map((point) => ({ ...point })),
    junctions: route.junctions?.map((point) => ({ ...point }))
  })) ?? [];
  applyCircuitPins(layout, config?.__pins, topOff);
  if (isNetlist && config?.__pins?.size) {
    layout.routes = rerouteCircuitNetlist(ast, layout.items, baseRoutes);
  }
  const { width, height, offsetX, offsetY } = layout;
  const t = chunk7ZEDTSU3_cjs.resolveIndustrialTheme(config?.theme ?? "default");
  const routeSvg = (layout.routes ?? []).map((r, index) => renderRoute(r, offsetX, offsetY, index, ast, layout.items, config?.__scene)).join("");
  const items = layout.items.map((it) => renderItem(it, offsetX, offsetY, topOff, config?.__scene)).join("");
  const css = `
.schematex-circuit { font-family: system-ui, -apple-system, sans-serif; }
.schematex-circuit-hit { fill: transparent; stroke: none; pointer-events: all; }
.schematex-circuit-body { stroke: ${t.stroke}; stroke-width: 1.75; fill: none; stroke-linejoin: round; stroke-linecap: round; }
.schematex-circuit-fill { stroke: ${t.stroke}; stroke-width: 1.5; fill: ${t.stroke}; }
.schematex-circuit-wire { stroke: ${t.stroke}; stroke-width: 1.75; fill: none; stroke-linecap: square; }
.schematex-circuit-dot { fill: ${t.stroke}; stroke: none; }
.schematex-circuit-label { font: 600 11px system-ui, sans-serif; fill: ${t.text}; }
.schematex-circuit-value { font: italic 10px system-ui, sans-serif; fill: ${t.textMuted}; }
.schematex-circuit-net-label { font: 600 11px system-ui, sans-serif; fill: ${t.accent}; }
.schematex-circuit-pol { font: 9px sans-serif; fill: ${t.stroke}; }
.schematex-circuit-meter { font: bold 12px sans-serif; fill: ${t.stroke}; }
.schematex-circuit-title { font: 700 16px sans-serif; fill: ${t.text}; }
.schematex-circuit-err { stroke: ${t.error}; fill: ${t.error}; }
.schematex-circuit-enclosure { stroke: ${t.stroke}; stroke-width: 2; stroke-dasharray: 8 5; fill: ${t.bg}; }
.schematex-circuit-enclosure-inner { stroke: ${t.textMuted}; stroke-width: 1; stroke-dasharray: 4 3; fill: none; }
.schematex-circuit-panel-label { font: 700 11px system-ui, sans-serif; fill: ${t.text}; }
.schematex-circuit-din { fill: ${t.bg}; stroke: ${t.stroke}; stroke-width: 1.4; }
.schematex-circuit-din-slot { fill: ${t.textMuted}; opacity: 0.5; }
.schematex-circuit-duct { fill: none; stroke: ${t.textMuted}; stroke-width: 1.2; stroke-dasharray: 3 2; }
.schematex-circuit-duct-tooth { stroke: ${t.textMuted}; stroke-width: 0.8; opacity: 0.65; }
.schematex-circuit-panel-led { fill: ${t.accent}; stroke: ${t.stroke}; stroke-width: 0.8; }
.schematex-circuit-panel-light { fill: ${t.bg}; stroke: ${t.stroke}; stroke-width: 1.5; }
.schematex-circuit-estop { fill: ${t.error}; stroke: ${t.stroke}; stroke-width: 1.4; }
`.trim();
  const titleScene = ast.title ? chunkEQMWWNB3_cjs.resolveSceneTitle(ast.title, ast.titleSourceRange, width / 2, 18, config) : void 0;
  const titleBar = ast.title && titleScene ? chunk7ZEDTSU3_cjs.text(
    {
      x: titleScene.x,
      y: titleScene.y,
      "text-anchor": "middle",
      class: "schematex-circuit-title",
      ...titleScene.attrs
    },
    ast.title
  ) : "";
  return chunk7ZEDTSU3_cjs.svgRoot(
    {
      class: "schematex-circuit",
      viewBox: `0 0 ${Math.round(width)} ${Math.round(height + topOff)}`,
      width: Math.round(width),
      height: Math.round(height + topOff),
      role: "img",
      "data-diagram-type": "circuit"
    },
    [
      chunk7ZEDTSU3_cjs.title(ast.title ?? "Circuit Schematic"),
      chunk7ZEDTSU3_cjs.desc(
        `Circuit schematic with ${ast.components.length} components`
      ),
      chunk7ZEDTSU3_cjs.defs([chunk7ZEDTSU3_cjs.el("style", {}, css)]),
      ...config?.__scene ? [chunk7ZEDTSU3_cjs.group({ transform: `translate(0, ${topOff})` }, [routeSvg + items]), titleBar] : [titleBar, chunk7ZEDTSU3_cjs.group({ transform: `translate(0, ${topOff})` }, [routeSvg + items])]
    ]
  );
}

// src/diagrams/circuit/index.ts
var circuit = {
  type: "circuit",
  capabilities: { scene: true, editablePosition: true },
  detect(text2) {
    const first = text2.trim().split("\n")[0]?.trim().toLowerCase() ?? "";
    return first.startsWith("circuit");
  },
  parse: parseCircuit,
  lint: lintCircuit,
  render(text2, config) {
    const ast = parseCircuit(text2);
    return renderCircuit(ast, config);
  }
};

exports.SYMBOLS = SYMBOLS;
exports.circuit = circuit;
exports.layoutCircuit = layoutCircuit;
exports.layoutCircuitNetlist = layoutCircuitNetlist;
exports.lintCircuit = lintCircuit;
exports.parseCircuit = parseCircuit;
exports.parseNetlist = parseNetlist;
exports.renderCircuit = renderCircuit;
//# sourceMappingURL=chunk-5ZC74S6U.cjs.map
//# sourceMappingURL=chunk-5ZC74S6U.cjs.map