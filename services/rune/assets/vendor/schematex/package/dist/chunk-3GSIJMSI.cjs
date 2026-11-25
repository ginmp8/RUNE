'use strict';

var chunkVGO4AJ4K_cjs = require('./chunk-VGO4AJ4K.cjs');
var chunk2JVEMVHO_cjs = require('./chunk-2JVEMVHO.cjs');
var chunkEQMWWNB3_cjs = require('./chunk-EQMWWNB3.cjs');
var chunk54Q7JDQB_cjs = require('./chunk-54Q7JDQB.cjs');
var chunk7ZEDTSU3_cjs = require('./chunk-7ZEDTSU3.cjs');

// src/diagrams/genogram/parser.ts
var ParseError = class extends Error {
  constructor(message, line2, column, source) {
    super(`Line ${line2}, col ${column}: ${message}
  \u2192 ${source}`);
    this.line = line2;
    this.column = column;
    this.source = source;
    this.name = "ParseError";
  }
  line;
  column;
  source;
};
var COUPLE_OPS = [
  { token: "~/~", type: "cohabiting-ended" },
  { token: "~x~", type: "divorced" },
  // the form the grammar advertises; `-x-` is the ASCII alias
  { token: "-//", type: "separated" },
  // alias for -/-
  { token: "-x-", type: "divorced" },
  { token: "-/-", type: "separated" },
  { token: "-o-", type: "engaged" },
  { token: "==", type: "consanguineous" },
  { token: "--", type: "married" },
  { token: "~", type: "cohabiting" }
];
var VALID_SEX = /* @__PURE__ */ new Set(["male", "female", "unknown", "other"]);
var VALID_STATUS = /* @__PURE__ */ new Set([
  "deceased",
  "stillborn",
  "miscarriage",
  "abortion"
]);
var STATUS_ALIASES = {
  stillbirth: "stillborn",
  stillbirths: "stillborn",
  miscarried: "miscarriage",
  miscarry: "miscarriage",
  aborted: "abortion",
  dead: "deceased",
  died: "deceased",
  decd: "deceased"
};
var SPECIAL_CHILD_PROPS = /* @__PURE__ */ new Set([
  "adopted",
  "foster",
  "twin-identical",
  "twin-fraternal"
]);
var SECONDARY_LINK_PROPS = /* @__PURE__ */ new Set(["foster", "adopted", "guardian"]);
var VALID_FILLS = /* @__PURE__ */ new Set([
  "full",
  "half-left",
  "half-right",
  "half-top",
  "half-bottom",
  "quad-tl",
  "quad-tr",
  "quad-bl",
  "quad-br",
  "quarter",
  "striped",
  "dotted"
]);
var EMOTIONAL_TYPES = /* @__PURE__ */ new Set([
  "harmony",
  "close",
  "bestfriends",
  "love",
  "inlove",
  "friendship",
  "hostile",
  "conflict",
  "enmity",
  "distant-hostile",
  "cutoff",
  "close-hostile",
  "fused",
  "fused-hostile",
  "distant",
  "normal",
  "nevermet",
  "abuse",
  "physical-abuse",
  "emotional-abuse",
  "sexual-abuse",
  "neglect",
  "manipulative",
  "controlling",
  "jealous",
  "focused",
  "focused-neg",
  "distrust",
  "admirer",
  "limerence"
]);
function parseGenogram(text2) {
  const locator = chunk54Q7JDQB_cjs.createSourceLocator(text2);
  const rawLines = text2.split("\n");
  const state = { lines: rawLines, currentLine: 0 };
  skipBlankAndComments(state);
  const metadata = {};
  const headerLine = currentLineText(state);
  if (headerLine === void 0) {
    throw new ParseError("Empty input", 1, 1, "");
  }
  const headerTrimmed = headerLine.trim();
  if (!headerTrimmed.toLowerCase().startsWith("genogram")) {
    throw new ParseError(
      'Expected "genogram" header',
      state.currentLine + 1,
      1,
      headerLine
    );
  }
  const titleMatch = headerTrimmed.match(/^genogram\s+"([^"]*)"$/i);
  if (titleMatch) {
    metadata.title = titleMatch[1];
  }
  const headerToken = chunk54Q7JDQB_cjs.findFirstQuotedRange(headerLine);
  const headerStart = rawLines.slice(0, state.currentLine).reduce((sum, line2) => sum + line2.length + 1, 0);
  const titleSourceRange = headerToken ? locator.range(headerStart + headerToken.start, headerStart + headerToken.end) : void 0;
  state.currentLine++;
  const individualsMap = /* @__PURE__ */ new Map();
  const relationships = [];
  const childSpecialProps = /* @__PURE__ */ new Map();
  const legendOverrides = {};
  const childrenWithPrimary = /* @__PURE__ */ new Set();
  let unknownSibCounter = 0;
  skipBlankAndComments(state);
  while (state.currentLine < state.lines.length) {
    skipBlankAndComments(state);
    if (state.currentLine >= state.lines.length) break;
    const lineText = state.lines[state.currentLine];
    const trimmed = lineText.trim();
    if (trimmed === "" || trimmed.startsWith("#") || trimmed.startsWith("//") || trimmed.startsWith("%%")) {
      state.currentLine++;
      continue;
    }
    if (chunk2JVEMVHO_cjs.parseLegendDirective(trimmed, legendOverrides)) {
      state.currentLine++;
      continue;
    }
    const emotionalMatch = detectEmotionalOp(trimmed);
    if (emotionalMatch) {
      const { leftId, emotionalType, rightId: emRightId, directional, label: emLabel } = emotionalMatch;
      const lineNum = state.currentLine + 1;
      const leftKey = leftId.toLowerCase();
      const rightKey = emRightId.toLowerCase();
      if (!individualsMap.has(leftKey)) {
        throw new ParseError(`Unknown individual '${leftId}'`, lineNum, 1, lineText);
      }
      if (!individualsMap.has(rightKey)) {
        throw new ParseError(`Unknown individual '${emRightId}'`, lineNum, 1, lineText);
      }
      const rel = {
        type: emotionalType,
        from: leftKey,
        to: rightKey
      };
      if (directional) rel.directional = true;
      if (emLabel) rel.label = emLabel;
      relationships.push(rel);
      state.currentLine++;
      continue;
    }
    const coupleMatch = detectCoupleOp(trimmed);
    if (coupleMatch) {
      const { leftId, op, rightRaw } = coupleMatch;
      const lineNum = state.currentLine + 1;
      const { cleaned: rightCleaned, label: relLabel } = extractRelLabel(rightRaw);
      const { id: rightId, props: rightProps } = parseIdWithOptionalProps(rightCleaned);
      const leftKey = leftId.toLowerCase();
      if (!individualsMap.has(leftKey)) {
        throw new ParseError(
          `Unknown individual '${leftId}'`,
          lineNum,
          1,
          lineText
        );
      }
      const rightKey = rightId.toLowerCase();
      if (rightProps) {
        const incoming = buildIndividual(rightId, rightProps, lineNum, lineText);
        const existing = individualsMap.get(rightKey);
        individualsMap.set(
          rightKey,
          existing ? mergeIndividual(existing, incoming, lineNum, lineText) : incoming
        );
      } else if (!individualsMap.has(rightKey)) {
        throw new ParseError(
          `Unknown individual '${rightId}'`,
          lineNum,
          1,
          lineText
        );
      }
      const rel = { type: op.type, from: leftKey, to: rightKey };
      if (relLabel) rel.label = relLabel;
      relationships.push(rel);
      const coupleIndent = getIndent(lineText);
      state.currentLine++;
      while (state.currentLine < state.lines.length) {
        const childLine = state.lines[state.currentLine];
        const childTrimmed = childLine.trim();
        if (childTrimmed === "" || childTrimmed.startsWith("#") || childTrimmed.startsWith("//") || childTrimmed.startsWith("%%")) {
          state.currentLine++;
          continue;
        }
        const childIndent = getIndent(childLine);
        if (childIndent <= coupleIndent) break;
        const childLineNum = state.currentLine + 1;
        let parsedId;
        let parsedProps;
        if (childTrimmed === "?" || childTrimmed.startsWith("? ")) {
          parsedId = `__unknown_siblings_${++unknownSibCounter}`;
          parsedProps = "unknown, unknown-siblings";
        } else {
          const split = splitIdAndProps(childTrimmed);
          parsedId = split.id;
          parsedProps = split.propsStr;
        }
        const childKey = parsedId.toLowerCase();
        const incoming = buildIndividual(
          parsedId,
          parsedProps,
          childLineNum,
          childLine
        );
        const tokens = parsedProps ? propsTokens(parsedProps) : [];
        for (const sp of SPECIAL_CHILD_PROPS) {
          if (tokens.includes(sp)) childSpecialProps.set(childKey, sp);
        }
        const isSecondaryDecl = tokens.some((t) => SECONDARY_LINK_PROPS.has(t));
        const existing = individualsMap.get(childKey);
        individualsMap.set(
          childKey,
          existing ? mergeIndividual(existing, incoming, childLineNum, childLine) : incoming
        );
        const coupleKey = `${leftKey}+${rightKey}`;
        const lineChildType = tokens.find(
          (t) => SPECIAL_CHILD_PROPS.has(t)
        );
        const relType = lineChildType === "adopted" || lineChildType === "foster" ? lineChildType : "parent-child";
        const isSecondary = isSecondaryDecl && childrenWithPrimary.has(childKey);
        const rel2 = {
          type: relType,
          from: coupleKey,
          to: childKey
        };
        if (isSecondary) rel2.secondary = true;
        relationships.push(rel2);
        if (!isSecondary) childrenWithPrimary.add(childKey);
        state.currentLine++;
      }
    } else {
      const lineNum = state.currentLine + 1;
      const { id, propsStr } = splitIdAndProps(trimmed);
      const key = id.toLowerCase();
      const individual = buildIndividual(id, propsStr, lineNum, lineText);
      const existing = individualsMap.get(key);
      if (existing) {
        individualsMap.set(
          key,
          mergeIndividual(existing, individual, lineNum, lineText)
        );
      } else {
        individualsMap.set(key, individual);
      }
      state.currentLine++;
    }
  }
  const twinGroups = /* @__PURE__ */ new Map();
  for (const [childKey, prop] of childSpecialProps) {
    if (prop === "twin-identical" || prop === "twin-fraternal") {
      const pcRel = relationships.find(
        (r) => r.to === childKey && (r.type === "parent-child" || r.type === "adopted" || r.type === "foster")
      );
      if (pcRel) {
        const groupKey = `${pcRel.from}:${prop}`;
        const group2 = twinGroups.get(groupKey) ?? [];
        group2.push(childKey);
        twinGroups.set(groupKey, group2);
      }
    }
  }
  for (const [groupKey, members] of twinGroups) {
    const twinType = groupKey.split(":")[1];
    for (let i = 0; i < members.length - 1; i++) {
      relationships.push({
        type: twinType,
        from: members[i],
        to: members[i + 1]
      });
    }
  }
  normalizePrimaryParentRels(relationships);
  const hasLegendOverrides = Object.keys(legendOverrides).length > 0 && Object.values(legendOverrides).some((v) => v !== void 0);
  let sourceOffset = 0;
  for (const line2 of rawLines) {
    const labelMatch = /\blabel\s*:\s*("[^"]*"|[^,\]\s]+)/i.exec(line2);
    if (labelMatch) {
      const token = labelMatch[1];
      const tokenStart = labelMatch.index + labelMatch[0].lastIndexOf(token);
      const before = line2.slice(0, labelMatch.index);
      const id = [...before.matchAll(/[a-zA-Z][a-zA-Z0-9_-]*/g)].map((match) => match[0].toLowerCase()).filter((candidate) => individualsMap.has(candidate)).at(-1);
      const individual = id ? individualsMap.get(id) : void 0;
      if (individual) {
        individual.labelSourceRange = locator.range(
          sourceOffset + tokenStart,
          sourceOffset + tokenStart + token.length
        );
      }
    }
    sourceOffset += line2.length + 1;
  }
  return {
    type: "genogram",
    individuals: Array.from(individualsMap.values()),
    relationships,
    metadata: Object.keys(metadata).length > 0 ? metadata : void 0,
    titleSourceRange,
    legendOverrides: hasLegendOverrides ? legendOverrides : void 0
  };
}
function normalizePrimaryParentRels(relationships) {
  const PARENT_CHILD_TYPES = /* @__PURE__ */ new Set([
    "parent-child",
    "adopted",
    "foster"
  ]);
  const byChild = /* @__PURE__ */ new Map();
  for (let i = 0; i < relationships.length; i++) {
    const r = relationships[i];
    if (!PARENT_CHILD_TYPES.has(r.type)) continue;
    const arr = byChild.get(r.to) ?? [];
    arr.push(i);
    byChild.set(r.to, arr);
  }
  for (const indices of byChild.values()) {
    if (indices.length < 2) continue;
    let primaryIdx = indices.find((i) => relationships[i].type === "parent-child");
    if (primaryIdx === void 0) primaryIdx = indices[0];
    for (const i of indices) {
      if (i === primaryIdx) {
        delete relationships[i].secondary;
      } else {
        relationships[i].secondary = true;
      }
    }
  }
}
function currentLineText(state) {
  return state.lines[state.currentLine];
}
function skipBlankAndComments(state) {
  while (state.currentLine < state.lines.length) {
    const t = state.lines[state.currentLine].trim();
    if (t === "" || t.startsWith("#") || t.startsWith("//") || t.startsWith("%%")) {
      state.currentLine++;
    } else {
      break;
    }
  }
}
function getIndent(line2) {
  const match = line2.match(/^(\s*)/);
  return match ? match[1].length : 0;
}
function detectEmotionalOp(trimmed) {
  const match = trimmed.match(
    /^([a-zA-Z][a-zA-Z0-9_-]*)\s+-([\w-]+)->(.*)|^([a-zA-Z][a-zA-Z0-9_-]*)\s+-([\w-]+)-\s+(.*)/
  );
  if (!match) return null;
  const directional = !!match[1];
  const leftId = directional ? match[1] : match[4];
  const emotionalType = directional ? match[2] : match[5];
  const rest = (directional ? match[3] : match[6]).trim();
  if (!EMOTIONAL_TYPES.has(emotionalType)) return null;
  const { id: rightId, label } = extractIdAndLabel(rest);
  if (!rightId || !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(rightId)) return null;
  return { leftId, emotionalType, rightId, directional, label };
}
function extractIdAndLabel(raw) {
  const labelMatch = raw.match(/^([a-zA-Z][a-zA-Z0-9_-]*)\s+"([^"]*)"$/);
  if (labelMatch) return { id: labelMatch[1], label: labelMatch[2] };
  const idOnly = raw.match(/^([a-zA-Z][a-zA-Z0-9_-]*)$/);
  if (idOnly) return { id: idOnly[1], label: null };
  return { id: raw.trim(), label: null };
}
function extractRelLabel(rightRaw) {
  const match = rightRaw.match(/^(.*?)\s+"([^"]*)"$/);
  if (match) return { cleaned: match[1].trim(), label: match[2] };
  return { cleaned: rightRaw, label: null };
}
function detectCoupleOp(trimmed) {
  for (const op of COUPLE_OPS) {
    const parts = splitByOperator(trimmed, op.token);
    if (parts) {
      return { leftId: parts.left.trim(), op, rightRaw: parts.right.trim() };
    }
  }
  return null;
}
function splitByOperator(line2, op) {
  let bracketDepth = 0;
  for (let i = 0; i < line2.length; i++) {
    if (line2[i] === "[") bracketDepth++;
    if (line2[i] === "]") bracketDepth--;
    if (bracketDepth > 0) continue;
    if (line2.substring(i, i + op.length) === op) {
      const left = line2.substring(0, i).trim();
      const right = line2.substring(i + op.length).trim();
      if (left && right) {
        const leftId = left.match(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
        if (leftId) return { left, right };
      }
    }
  }
  return null;
}
function parseIdWithOptionalProps(raw) {
  const bracketIdx = raw.indexOf("[");
  if (bracketIdx === -1) {
    return { id: raw.trim(), props: null };
  }
  const id = raw.substring(0, bracketIdx).trim();
  const endBracket = raw.lastIndexOf("]");
  const propsStr = raw.substring(bracketIdx + 1, endBracket === -1 ? raw.length : endBracket);
  return { id, props: propsStr };
}
function splitIdAndProps(trimmed) {
  const bracketIdx = trimmed.indexOf("[");
  if (bracketIdx === -1) {
    return { id: trimmed.trim(), propsStr: null };
  }
  const id = trimmed.substring(0, bracketIdx).trim();
  const endBracket = trimmed.lastIndexOf("]");
  const propsStr = trimmed.substring(
    bracketIdx + 1,
    endBracket === -1 ? trimmed.length : endBracket
  );
  return { id, propsStr };
}
function propsTokens(propsStr) {
  return splitProps(propsStr).map((t) => t.trim().toLowerCase());
}
function unquote(value) {
  return value.replace(/^["'“「『]|["'”」』]$/g, "").trim();
}
function yearOf(value) {
  const m = value.match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : void 0;
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
function buildIndividual(id, propsStr, lineNum, lineText) {
  const individual = {
    id: id.toLowerCase(),
    label: id,
    sex: "unknown",
    status: "alive"
  };
  if (!propsStr) return individual;
  const tokens = splitProps(propsStr);
  for (const rawToken of tokens) {
    const token = rawToken.trim();
    const tokenLower = token.toLowerCase();
    if (VALID_SEX.has(tokenLower)) {
      individual.sex = tokenLower;
    } else if (VALID_STATUS.has(tokenLower) || STATUS_ALIASES[tokenLower]) {
      individual.status = STATUS_ALIASES[tokenLower] ?? tokenLower;
    } else if (tokenLower === "index") {
      if (!individual.markers) individual.markers = [];
      individual.markers.push("index-person");
    } else if (tokenLower === "unknown-siblings") {
      if (!individual.markers) individual.markers = [];
      individual.markers.push("unknown-siblings");
      if (!individual.label || individual.label === id) individual.label = "?";
    } else if (SPECIAL_CHILD_PROPS.has(tokenLower) || tokenLower === "guardian") {
      continue;
    } else if (/^\d{1,3}$/.test(tokenLower)) {
      individual.age = parseInt(token, 10);
    } else if (/^\d{4}$/.test(tokenLower)) {
      if (individual.birthYear !== void 0) {
        individual.deathYear = parseInt(token, 10);
      } else {
        individual.birthYear = parseInt(token, 10);
      }
    } else if (tokenLower.startsWith("conditions:")) {
      individual.conditions = parseConditions(
        token.substring("conditions:".length).trim(),
        lineNum,
        lineText
      );
    } else if (token.includes(":")) {
      const colonIdx = token.indexOf(":");
      const key = token.substring(0, colonIdx).trim().toLowerCase();
      const value = token.substring(colonIdx + 1).trim();
      if (key === "age") {
        const ageNum = parseInt(value, 10);
        if (!isNaN(ageNum)) individual.age = ageNum;
      } else if (key === "death") {
        const deathNum = parseInt(value, 10);
        if (!isNaN(deathNum)) individual.deathYear = deathNum;
      } else if (key === "dob") {
        const v = unquote(value);
        individual.dob = v;
        const yr = yearOf(v);
        if (yr !== void 0 && individual.birthYear === void 0) {
          individual.birthYear = yr;
        }
      } else if (key === "dod") {
        const v = unquote(value);
        individual.dod = v;
        const yr = yearOf(v);
        if (yr !== void 0 && individual.deathYear === void 0) {
          individual.deathYear = yr;
        }
        if (individual.status === "alive") individual.status = "deceased";
      } else if (key === "note") {
        individual.note = unquote(value);
      } else if (key === "birth") {
        const v = value.trim().toLowerCase();
        if (v === "out-of-wedlock" || v === "adopted" || v === "legitimate") {
          individual.birthStatus = v;
        } else {
          throw new ParseError(
            `Invalid birth status '${value}'. Valid: legitimate, out-of-wedlock, adopted`,
            lineNum,
            1,
            lineText
          );
        }
      } else if (key === "label") {
        individual.label = value.replace(/^"|"$/g, "");
      } else if (key === "sibling-of") {
        individual.siblingOf = value.toLowerCase();
      } else if (key === "shape") {
        const v = value.toLowerCase();
        if (v === "square" || v === "circle" || v === "diamond" || v === "triangle" || v === "triangle-down") {
          individual.shape = v;
        } else {
          throw new ParseError(
            `Invalid shape '${value}'. Valid: square, circle, diamond, triangle, triangle-down`,
            lineNum,
            1,
            lineText
          );
        }
      } else {
        if (!individual.properties) individual.properties = {};
        individual.properties[key] = value;
      }
    } else {
      throw new ParseError(
        `Unknown property '${token}'. Valid: male, female, unknown, deceased, stillborn, miscarriage, abortion, adopted, foster, guardian, twin-identical, twin-fraternal, index, unknown-siblings, a 4-digit year, conditions:..., age:N, death:YYYY, dob:"YYYY-MM-DD", dod:"YYYY-MM-DD", note:"...", birth:out-of-wedlock|adopted, label:"...", sibling-of:ID, or key:value`,
        lineNum,
        1,
        lineText
      );
    }
  }
  return individual;
}
function parseConditions(raw, lineNum, lineText) {
  const parts = raw.split("+").map((s) => s.trim());
  const conditions = [];
  for (const part of parts) {
    const match = part.match(/^([^(]+)\(([^)]+)\)$/);
    if (!match) {
      throw new ParseError(
        `Invalid condition format '${part}'. Expected: name(fill) or name(fill, #color)`,
        lineNum,
        1,
        lineText
      );
    }
    const label = match[1].trim();
    const innerRaw = match[2];
    const innerParts = innerRaw.split(",").map((s) => s.trim());
    const fill = innerParts[0];
    const color = innerParts[1];
    if (!VALID_FILLS.has(fill)) {
      throw new ParseError(
        `Invalid fill pattern '${fill}'. Valid: full, half-left, half-right, half-top, half-bottom, quad-tl, quad-tr, quad-bl, quad-br, quarter, striped, dotted`,
        lineNum,
        1,
        lineText
      );
    }
    const cond = { label, fill };
    if (color) cond.color = color;
    conditions.push(cond);
  }
  return conditions;
}
function mergeIndividual(existing, incoming, lineNum, lineText) {
  let mergedSex = existing.sex;
  if (incoming.sex !== "unknown") {
    if (existing.sex !== "unknown" && existing.sex !== incoming.sex) {
      throw new ParseError(
        `Conflicting sex for '${existing.id}': previously '${existing.sex}', now '${incoming.sex}'`,
        lineNum,
        1,
        lineText
      );
    }
    mergedSex = incoming.sex;
  }
  let mergedStatus = existing.status;
  if (incoming.status !== "alive") {
    if (existing.status !== "alive" && existing.status !== incoming.status) {
      throw new ParseError(
        `Conflicting status for '${existing.id}': previously '${existing.status}', now '${incoming.status}'`,
        lineNum,
        1,
        lineText
      );
    }
    mergedStatus = incoming.status;
  }
  if (incoming.birthYear !== void 0 && existing.birthYear !== void 0 && incoming.birthYear !== existing.birthYear) {
    throw new ParseError(
      `Conflicting birth year for '${existing.id}': previously ${existing.birthYear}, now ${incoming.birthYear}`,
      lineNum,
      1,
      lineText
    );
  }
  if (incoming.deathYear !== void 0 && existing.deathYear !== void 0 && incoming.deathYear !== existing.deathYear) {
    throw new ParseError(
      `Conflicting death year for '${existing.id}': previously ${existing.deathYear}, now ${incoming.deathYear}`,
      lineNum,
      1,
      lineText
    );
  }
  const incomingHasExplicitLabel = incoming.label !== incoming.id && incoming.label !== "";
  const existingHasExplicitLabel = existing.label !== existing.id && existing.label !== "";
  const mergedLabel = incomingHasExplicitLabel ? incoming.label : existingHasExplicitLabel ? existing.label : existing.label;
  const mergedMarkers = mergeArrayUnique(existing.markers, incoming.markers);
  return {
    ...existing,
    sex: mergedSex,
    status: mergedStatus,
    label: mergedLabel,
    birthYear: incoming.birthYear ?? existing.birthYear,
    deathYear: incoming.deathYear ?? existing.deathYear,
    dob: incoming.dob ?? existing.dob,
    dod: incoming.dod ?? existing.dod,
    note: incoming.note ?? existing.note,
    birthStatus: incoming.birthStatus ?? existing.birthStatus,
    age: incoming.age ?? existing.age,
    conditions: incoming.conditions ?? existing.conditions,
    heritage: incoming.heritage ?? existing.heritage,
    siblingOf: incoming.siblingOf ?? existing.siblingOf,
    markers: mergedMarkers,
    properties: {
      ...existing.properties,
      ...incoming.properties
    }
  };
}
function mergeArrayUnique(a, b) {
  if (!a && !b) return void 0;
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const v of [...a ?? [], ...b ?? []]) {
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out.length ? out : void 0;
}

// src/diagrams/genogram/layout.ts
function layoutGenogram(ast, config, pins) {
  const graph = buildGraph(ast);
  assignGenerations(graph);
  const ordered = orderNodesInGenerations(graph);
  const positions = assignPositions(ordered, graph, config);
  if (pins?.size) {
    const padding = 40;
    for (const position of positions.values()) {
      const pin = pins.get(position.id);
      if (pin) position.x = pin.x + config.nodeWidth / 2 - padding;
    }
  }
  const edges = computeEdges(graph, positions, config);
  const secondaryEdges = computeSecondaryParentEdges(
    ast.relationships,
    graph,
    positions,
    config
  );
  const emotionalEdges = computeEmotionalEdges(ast.relationships, positions, config);
  return packageResult(
    positions,
    [...edges, ...secondaryEdges, ...emotionalEdges],
    graph,
    config
  );
}
function buildGraph(ast) {
  const individuals = /* @__PURE__ */ new Map();
  for (const ind of ast.individuals) {
    individuals.set(ind.id, ind);
  }
  const familyUnits = [];
  const childOf = /* @__PURE__ */ new Map();
  const coupleRels = ast.relationships.filter(
    (r) => r.type === "married" || r.type === "divorced" || r.type === "separated" || r.type === "engaged" || r.type === "cohabiting" || r.type === "cohabiting-ended" || r.type === "consanguineous"
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
        const yearA = indA.birthYear ?? 9999;
        const yearB = indB.birthYear ?? 9999;
        partners = yearA <= yearB ? [rel.from, rel.to] : [rel.to, rel.from];
      }
    } else {
      partners = [rel.from, rel.to];
    }
    const children = [];
    for (const r of ast.relationships) {
      if ((r.type === "parent-child" || r.type === "adopted" || r.type === "foster") && r.from === fuId && !r.secondary) {
        children.push(r.to);
        childOf.set(r.to, fuId);
      }
    }
    children.sort((a, b) => {
      const indChildA = individuals.get(a);
      const indChildB = individuals.get(b);
      return (indChildA?.birthYear ?? 9999) - (indChildB?.birthYear ?? 9999);
    });
    familyUnits.push({
      id: fuId,
      partners,
      relationship: rel.type,
      label: rel.label,
      children
    });
  }
  return { individuals, familyUnits, generations: /* @__PURE__ */ new Map(), childOf };
}
function assignGenerations(graph) {
  const { individuals, familyUnits, childOf, generations } = graph;
  const allIds = Array.from(individuals.keys());
  const roots = allIds.filter((id) => {
    if (childOf.has(id)) return false;
    const ind = individuals.get(id);
    if (ind?.siblingOf) return false;
    return true;
  });
  if (roots.length === 0 && allIds.length > 0) {
    for (const id of allIds) generations.set(id, 0);
    return;
  }
  for (const root of roots) {
    if (!generations.has(root)) {
      generations.set(root, 0);
    }
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
  let siblingChanged = true;
  let safety = 0;
  while (siblingChanged && safety++ < allIds.length + 1) {
    siblingChanged = false;
    for (const id of allIds) {
      if (generations.has(id)) continue;
      const ind = individuals.get(id);
      if (!ind?.siblingOf) continue;
      const refGen = generations.get(ind.siblingOf);
      if (refGen !== void 0) {
        generations.set(id, refGen);
        siblingChanged = true;
      }
    }
  }
  for (const id of allIds) {
    if (!generations.has(id)) {
      generations.set(id, 0);
    }
  }
}
function orderNodesInGenerations(graph, _config) {
  const { generations, familyUnits } = graph;
  const genGroups = /* @__PURE__ */ new Map();
  for (const [id, gen] of generations) {
    const group2 = genGroups.get(gen) ?? [];
    group2.push(id);
    genGroups.set(gen, group2);
  }
  const genIndices = Array.from(genGroups.keys()).sort((a, b) => a - b);
  const result = [];
  for (const genIdx of genIndices) {
    const nodeIds = genGroups.get(genIdx) ?? [];
    const ordered = orderGeneration(nodeIds, genIdx, graph, familyUnits);
    result.push({ index: genIdx, nodeIds: ordered });
  }
  return result;
}
function orderGeneration(nodeIds, _genIdx, graph, familyUnits) {
  if (nodeIds.length <= 1) return [...nodeIds];
  const nodeSet = new Set(nodeIds);
  const placed = /* @__PURE__ */ new Set();
  const ordered = [];
  const fuInGen = familyUnits.filter(
    (fu) => nodeSet.has(fu.partners[0]) || nodeSet.has(fu.partners[1])
  );
  const personToFUs = /* @__PURE__ */ new Map();
  for (const fu of fuInGen) {
    for (const p of fu.partners) {
      if (nodeSet.has(p)) {
        const arr = personToFUs.get(p) ?? [];
        arr.push(fu);
        personToFUs.set(p, arr);
      }
    }
  }
  function placePersonAndExpand(id) {
    if (placed.has(id)) return;
    ordered.push(id);
    placed.add(id);
    const fus = personToFUs.get(id) ?? [];
    const sortedFUs = [...fus].sort((a, b) => {
      const scoreA = a.relationship === "divorced" || a.relationship === "separated" ? 0 : 1;
      const scoreB = b.relationship === "divorced" || b.relationship === "separated" ? 0 : 1;
      return scoreA - scoreB;
    });
    for (const fu of sortedFUs) {
      const partner = fu.partners[0] === id ? fu.partners[1] : fu.partners[0];
      if (!placed.has(partner) && nodeSet.has(partner)) {
        ordered.push(partner);
        placed.add(partner);
        const partnerFUs = personToFUs.get(partner) ?? [];
        for (const pfu of partnerFUs) {
          if (pfu.id !== fu.id) {
            const otherPartner = pfu.partners[0] === partner ? pfu.partners[1] : pfu.partners[0];
            placePersonAndExpand(otherPartner);
          }
        }
      }
    }
  }
  for (const fu of fuInGen) {
    if (!placed.has(fu.partners[0]) && nodeSet.has(fu.partners[0])) {
      placePersonAndExpand(fu.partners[0]);
    }
    if (!placed.has(fu.partners[1]) && nodeSet.has(fu.partners[1])) {
      placePersonAndExpand(fu.partners[1]);
    }
  }
  const remaining = nodeIds.filter((id) => !placed.has(id));
  const siblingOfRemaining = remaining.filter((id) => {
    const ind = graph.individuals.get(id);
    return ind?.siblingOf && placed.has(ind.siblingOf);
  });
  const otherRemaining = remaining.filter(
    (id) => !siblingOfRemaining.includes(id)
  );
  otherRemaining.sort((a, b) => {
    const indA = graph.individuals.get(a);
    const indB = graph.individuals.get(b);
    return (indA?.birthYear ?? 9999) - (indB?.birthYear ?? 9999);
  });
  for (const id of otherRemaining) {
    ordered.push(id);
    placed.add(id);
  }
  for (const id of siblingOfRemaining) {
    const ind = graph.individuals.get(id);
    if (!ind?.siblingOf) continue;
    const refIdx = ordered.indexOf(ind.siblingOf);
    if (refIdx === -1) {
      ordered.push(id);
    } else {
      ordered.splice(refIdx + 1, 0, id);
    }
    placed.add(id);
  }
  return ordered;
}
var LABEL_HEIGHT = 20;
var LABEL_GAP = 6;
var CAPTION_LINE = 13;
function captionExtra(graph) {
  let maxLines = 0;
  for (const ind of graph.individuals.values()) {
    let lines = 0;
    if (ind.dob || ind.dod || ind.birthStatus) lines++;
    if (ind.note) lines++;
    if (lines > maxLines) maxLines = lines;
  }
  return maxLines * CAPTION_LINE;
}
function assignPositions(orderedGens, graph, config) {
  const positions = /* @__PURE__ */ new Map();
  const { nodeWidth, nodeSpacingX } = config;
  const half = nodeWidth / 2;
  const coupleGap = nodeWidth + nodeSpacingX * 0.6;
  const familyGap = nodeWidth + nodeSpacingX * 1.5;
  const genStepY = config.nodeHeight + LABEL_HEIGHT + LABEL_GAP + config.nodeSpacingY + captionExtra(graph);
  for (const gen of orderedGens) {
    const y = gen.index * genStepY + half;
    const segments = buildSegments(gen.nodeIds, gen.index, graph);
    let xCursor = half;
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
  resolveOverlaps(positions, orderedGens, config, graph);
  centerChildrenUnderParents(positions, graph, config);
  unscrambleSibships(positions, graph, config);
  resolveOverlaps(positions, orderedGens, config, graph);
  return positions;
}
function buildSegments(nodeIds, _genIdx, graph) {
  const nodeSet = new Set(nodeIds);
  const personFUs = /* @__PURE__ */ new Map();
  for (const fu of graph.familyUnits) {
    if (nodeSet.has(fu.partners[0]) && nodeSet.has(fu.partners[1])) {
      for (const p of fu.partners) {
        const arr = personFUs.get(p) ?? [];
        arr.push(fu);
        personFUs.set(p, arr);
      }
    }
  }
  const multiMarried = /* @__PURE__ */ new Set();
  for (const [id, fus] of personFUs) {
    if (fus.length > 1) multiMarried.add(id);
  }
  const segments = [];
  const placed = /* @__PURE__ */ new Set();
  for (const id of nodeIds) {
    if (placed.has(id)) continue;
    if (multiMarried.has(id)) {
      const fus = personFUs.get(id) ?? [];
      const sorted = [...fus].sort((a, b) => {
        const sa = a.relationship === "divorced" || a.relationship === "separated" ? 0 : 1;
        const sb = b.relationship === "divorced" || b.relationship === "separated" ? 0 : 1;
        return sa - sb;
      });
      for (const fu2 of sorted) {
        const partner = fu2.partners[0] === id ? fu2.partners[1] : fu2.partners[0];
        if (!placed.has(partner)) {
          if (!placed.has(id)) {
            segments.push({ type: "couple", ids: [partner, id], fuId: fu2.id });
            placed.add(partner);
            placed.add(id);
          } else {
            segments.push({ type: "couple", ids: [id, partner], fuId: fu2.id });
            placed.add(partner);
          }
        }
      }
      if (!placed.has(id)) {
        segments.push({ type: "single", ids: [id] });
        placed.add(id);
      }
      continue;
    }
    const fu = graph.familyUnits.find(
      (f) => (f.partners[0] === id || f.partners[1] === id) && !placed.has(f.partners[0]) && !placed.has(f.partners[1]) && nodeSet.has(f.partners[0]) && nodeSet.has(f.partners[1])
    );
    if (fu) {
      segments.push({
        type: "couple",
        ids: [fu.partners[0], fu.partners[1]],
        fuId: fu.id
      });
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
      const sortedChildren = [...fu.children].sort((a, b) => {
        const indA = graph.individuals.get(a);
        const indB = graph.individuals.get(b);
        return (indA?.birthYear ?? 9999) - (indB?.birthYear ?? 9999);
      });
      const childSpacing = config.nodeSpacingX + config.nodeWidth;
      if (sortedChildren.length > 1) {
        const gaps = [];
        for (let gi = 0; gi < sortedChildren.length - 1; gi++) {
          let gap = childSpacing;
          const nextChild = sortedChildren[gi + 1];
          const nextFUs = personToFUs.get(nextChild) ?? [];
          for (const cfu of nextFUs) {
            const pid = cfu.partners[0] === nextChild ? cfu.partners[1] : cfu.partners[0];
            const cInd = graph.individuals.get(nextChild);
            const pInd = graph.individuals.get(pid);
            if (!(cInd?.sex === "male" || cInd?.sex !== "female" && pInd?.sex === "female")) {
              gap += coupleGap;
            }
          }
          const currChild = sortedChildren[gi];
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
        for (let i = 0; i < sortedChildren.length; i++) {
          const pos = positions.get(sortedChildren[i]);
          if (pos) pos.x = cx;
          if (i < gaps.length) cx += gaps[i];
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
function unscrambleSibships(positions, graph, config) {
  const familyGap = config.nodeWidth + config.nodeSpacingX * 1.5;
  const childSpacing = config.nodeWidth + config.nodeSpacingX;
  const byGen = /* @__PURE__ */ new Map();
  for (const [id, pos] of positions) {
    const arr = byGen.get(pos.generation) ?? [];
    arr.push(id);
    byGen.set(pos.generation, arr);
  }
  for (const [, ids] of byGen) {
    const sibshipMap = /* @__PURE__ */ new Map();
    for (const id of ids) {
      const fu = graph.childOf.get(id);
      if (!fu) continue;
      const arr = sibshipMap.get(fu) ?? [];
      arr.push(id);
      sibshipMap.set(fu, arr);
    }
    if (sibshipMap.size <= 1) continue;
    const sibships = [...sibshipMap.entries()].map(([fuId, children]) => {
      const fu = graph.familyUnits.find((f) => f.id === fuId);
      if (!fu) return null;
      const pa = positions.get(fu.partners[0]);
      const pb = positions.get(fu.partners[1]);
      if (!pa || !pb) return null;
      return { fuId, children, midX: (pa.x + pb.x) / 2 };
    }).filter((x) => x !== null).sort((a, b) => a.midX - b.midX);
    let cursor = null;
    for (const ss of sibships) {
      const sortedKids = [...ss.children].sort((a, b) => {
        const ya = graph.individuals.get(a)?.birthYear ?? 9999;
        const yb = graph.individuals.get(b)?.birthYear ?? 9999;
        return ya - yb;
      });
      const totalWidth = Math.max(0, (sortedKids.length - 1) * childSpacing);
      let startX = ss.midX - totalWidth / 2;
      if (cursor !== null && startX < cursor) startX = cursor;
      for (let i = 0; i < sortedKids.length; i++) {
        const pos = positions.get(sortedKids[i]);
        if (pos) pos.x = startX + i * childSpacing;
      }
      cursor = startX + totalWidth + familyGap;
    }
  }
}
function resolveOverlaps(positions, orderedGens, config, graph) {
  const minGap = config.nodeWidth + config.nodeSpacingX;
  const familyGap = config.nodeWidth + config.nodeSpacingX * 1.5;
  const cluster = /* @__PURE__ */ new Map();
  if (graph) {
    for (const [id] of positions) {
      const fu = graph.childOf.get(id);
      if (fu) cluster.set(id, fu);
    }
    for (const fu of graph.familyUnits) {
      for (const p of fu.partners) {
        if (cluster.has(p)) continue;
        const other = fu.partners[0] === p ? fu.partners[1] : fu.partners[0];
        const otherCluster = cluster.get(other);
        if (otherCluster) cluster.set(p, otherCluster);
      }
    }
  }
  for (const gen of orderedGens) {
    const genNodes = gen.nodeIds.map((id) => positions.get(id)).filter((p) => p !== void 0);
    genNodes.sort((a, b) => a.x - b.x);
    for (let i = 1; i < genNodes.length; i++) {
      const prev = genNodes[i - 1];
      const cur = genNodes[i];
      const cPrev = cluster.get(prev.id);
      const cCur = cluster.get(cur.id);
      const required = cPrev && cCur && cPrev !== cCur ? familyGap : minGap;
      const gap = cur.x - prev.x;
      if (gap < required) {
        const shift = required - gap;
        for (let j = i; j < genNodes.length; j++) {
          genNodes[j].x += shift;
        }
      }
    }
  }
  let minX = Infinity;
  for (const pos of positions.values()) {
    if (pos.x < minX) minX = pos.x;
  }
  if (minX < config.nodeWidth / 2) {
    const shift = config.nodeWidth / 2 - minX;
    for (const pos of positions.values()) {
      pos.x += shift;
    }
  }
}
function computeEdges(graph, positions, config) {
  const edges = [];
  const half = config.nodeWidth / 2;
  const dropY_offset = config.nodeHeight / 2 + LABEL_HEIGHT + LABEL_GAP + config.nodeSpacingY * 0.35 + captionExtra(graph);
  for (const fu of graph.familyUnits) {
    const posA = positions.get(fu.partners[0]);
    const posB = positions.get(fu.partners[1]);
    if (!posA || !posB) continue;
    const leftPos = posA.x < posB.x ? posA : posB;
    const rightPos = posA.x < posB.x ? posB : posA;
    const leftId = posA.x < posB.x ? fu.partners[0] : fu.partners[1];
    const rightId = posA.x < posB.x ? fu.partners[1] : fu.partners[0];
    const coupleRel = {
      type: fu.relationship,
      from: leftId,
      to: rightId,
      label: fu.label
    };
    const couplePath = `M ${leftPos.x + half} ${leftPos.y} L ${rightPos.x - half} ${rightPos.y}`;
    edges.push({
      from: leftId,
      to: rightId,
      relationship: coupleRel,
      path: couplePath
    });
    if (fu.children.length > 0) {
      const midX = (posA.x + posB.x) / 2;
      const coupleY = posA.y;
      const dropY = coupleY + dropY_offset;
      const childPositions = fu.children.map((cid) => ({
        id: cid,
        pos: positions.get(cid)
      })).filter(
        (c) => c.pos !== void 0
      );
      if (childPositions.length === 0) continue;
      childPositions.sort((a, b) => a.pos.x - b.pos.x);
      const leftX = childPositions[0].pos.x;
      const rightX = childPositions[childPositions.length - 1].pos.x;
      const dropPath = `M ${midX} ${coupleY} L ${midX} ${dropY}`;
      edges.push({
        from: fu.partners[0],
        to: fu.partners[1],
        relationship: { type: "parent-child", from: fu.id, to: "_drop" },
        path: dropPath
      });
      if (childPositions.length > 1) {
        const sibLeft = Math.min(leftX, midX);
        const sibRight = Math.max(rightX, midX);
        const sibPath = `M ${sibLeft} ${dropY} L ${sibRight} ${dropY}`;
        edges.push({
          from: sibLeft < leftX - 0.1 ? fu.id : childPositions[0].id,
          to: sibRight > rightX + 0.1 ? fu.id : childPositions[childPositions.length - 1].id,
          relationship: { type: "parent-child", from: fu.id, to: "_sibship" },
          path: sibPath
        });
      }
      for (const child of childPositions) {
        const childTop = child.pos.y - config.nodeHeight / 2;
        let childPath;
        if (childPositions.length === 1) {
          if (Math.abs(child.pos.x - midX) < 1) {
            childPath = `M ${midX} ${coupleY} L ${midX} ${childTop}`;
          } else {
            childPath = `M ${midX} ${dropY} L ${child.pos.x} ${dropY} L ${child.pos.x} ${childTop}`;
          }
        } else {
          childPath = `M ${child.pos.x} ${dropY} L ${child.pos.x} ${childTop}`;
        }
        const pcRel = findParentChildRel(graph, fu.id, child.id);
        edges.push({
          from: fu.id,
          to: child.id,
          relationship: pcRel ?? {
            type: "parent-child",
            from: fu.id,
            to: child.id
          },
          path: childPath
        });
      }
    }
  }
  return edges;
}
function findParentChildRel(graph, _fuId, childId) {
  const fuId = graph.childOf.get(childId);
  if (!fuId) return void 0;
  return {
    type: "parent-child",
    from: fuId,
    to: childId
  };
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
    const labelText = estimateLabelText(node.individual);
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
    height: maxY + padding + LABEL_GAP + LABEL_HEIGHT + 10 + captionExtra(graph),
    nodes,
    edges: shiftedEdges
  };
}
function estimateLabelText(ind) {
  const name = ind.label || ind.id;
  if (ind.dob || ind.dod || ind.birthStatus || ind.note) {
    const candidates = [name];
    const born = ind.dob ?? (ind.birthYear ? String(ind.birthYear) : void 0);
    const died = ind.dod ?? (ind.deathYear ? String(ind.deathYear) : void 0);
    const dateParts = [];
    if (born) dateParts.push(`[*] ${born}`);
    if (died || ind.status === "deceased") dateParts.push(`\u2020 ${died ?? ""}`);
    if (dateParts.length) candidates.push(dateParts.join("  "));
    if (ind.note) candidates.push(ind.note);
    return candidates.reduce((a, b) => b.length > a.length ? b : a, name);
  }
  if (ind.birthYear && ind.deathYear) return `${name} (${ind.birthYear}\u2013${ind.deathYear})`;
  if (ind.birthYear) return `${name} (b. ${ind.birthYear})`;
  return name;
}
var EMOTIONAL_REL_TYPES = /* @__PURE__ */ new Set([
  "harmony",
  "close",
  "bestfriends",
  "love",
  "inlove",
  "friendship",
  "hostile",
  "conflict",
  "enmity",
  "distant-hostile",
  "cutoff",
  "close-hostile",
  "fused",
  "fused-hostile",
  "distant",
  "normal",
  "nevermet",
  "abuse",
  "physical-abuse",
  "emotional-abuse",
  "sexual-abuse",
  "neglect",
  "manipulative",
  "controlling",
  "jealous",
  "focused",
  "focused-neg",
  "distrust",
  "admirer",
  "limerence"
]);
function computeEmotionalEdges(relationships, positions, config) {
  const edges = [];
  const half = config.nodeWidth / 2;
  const emotionalRels = relationships.filter((r) => EMOTIONAL_REL_TYPES.has(r.type));
  for (const rel of emotionalRels) {
    const posA = positions.get(rel.from);
    const posB = positions.get(rel.to);
    if (!posA || !posB) continue;
    const ax = posA.x;
    const ay = posA.y;
    const bx = posB.x;
    const by = posB.y;
    let pathData;
    if (posA.generation === posB.generation) {
      const midX = (ax + bx) / 2;
      const curveY = ay + half + 30;
      pathData = `M ${ax} ${ay + half} Q ${midX} ${curveY} ${bx} ${by + half}`;
    } else {
      const midY = (ay + by) / 2;
      const maxX = Math.max(ax, bx);
      const curveX = maxX + half + 30;
      pathData = `M ${ax} ${ay} Q ${curveX} ${midY} ${bx} ${by}`;
    }
    edges.push({
      from: rel.from,
      to: rel.to,
      relationship: rel,
      path: pathData
    });
  }
  return edges;
}
function computeSecondaryParentEdges(relationships, graph, positions, config) {
  const edges = [];
  const half = config.nodeHeight / 2;
  for (const rel of relationships) {
    if (!rel.secondary) continue;
    if (rel.type !== "parent-child" && rel.type !== "foster" && rel.type !== "adopted")
      continue;
    const fu = graph.familyUnits.find((f) => f.id === rel.from);
    if (!fu) continue;
    const posA = positions.get(fu.partners[0]);
    const posB = positions.get(fu.partners[1]);
    const childPos = positions.get(rel.to);
    if (!posA || !posB || !childPos) continue;
    const coupleMidX = (posA.x + posB.x) / 2;
    const coupleY = posA.y;
    const startX = coupleMidX;
    const startY = coupleY + half + 4;
    const childTopY = childPos.y - half - 4;
    const path2 = childPos.y === coupleY ? `M ${startX} ${startY} L ${startX} ${startY + 16} L ${childPos.x} ${startY + 16} L ${childPos.x} ${childPos.y - half - 4}` : `M ${startX} ${startY} L ${startX} ${(startY + childTopY) / 2} L ${childPos.x} ${(startY + childTopY) / 2} L ${childPos.x} ${childTopY}`;
    edges.push({
      from: rel.from,
      to: rel.to,
      relationship: rel,
      path: path2
    });
  }
  return edges;
}
function shiftPath(pathData, dx, dy) {
  return pathData.replace(
    /([\d.-]+)\s+([\d.-]+)/g,
    (_match, xStr, yStr) => {
      const x = parseFloat(xStr) + dx;
      const y = parseFloat(yStr) + dy;
      return `${x} ${y}`;
    }
  );
}

// src/diagrams/genogram/symbols.ts
function renderIndividualSymbol(individual, x, y, size) {
  const half = size / 2;
  const classes = [
    "schematex-genogram-node",
    `schematex-genogram-${individual.sex === "other" ? "unknown" : individual.sex}`
  ];
  if (individual.status === "deceased") classes.push("schematex-genogram-deceased");
  const titleText = formatTitle(individual);
  const children = [chunk7ZEDTSU3_cjs.title(titleText)];
  const isIndex = individual.markers?.includes("index-person");
  if (isIndex) {
    children.push(indexBorder(individual.sex, half));
    classes.push("schematex-genogram-index-person");
  }
  children.push(baseShape(individual.sex, half, individual.shape));
  if (individual.conditions?.length) {
    for (const cond of individual.conditions) {
      children.push(conditionFillElement(individual.sex, half, cond));
    }
  }
  if (individual.status === "deceased") {
    children.push(...deceasedOverlay(individual.sex, half));
  }
  const ageToShow = individual.age ?? calcAge(individual);
  if (ageToShow !== void 0) {
    children.push(
      chunk7ZEDTSU3_cjs.text(
        {
          x: 0,
          y: 5,
          class: "schematex-genogram-age",
          "text-anchor": "middle",
          "font-size": "11"
        },
        String(ageToShow)
      )
    );
  }
  const isUnknownSiblings = individual.markers?.includes("unknown-siblings");
  if (isUnknownSiblings) {
    classes.push("schematex-genogram-unknown-siblings");
    children.push(
      chunk7ZEDTSU3_cjs.text(
        {
          x: 0,
          y: 5,
          class: "schematex-genogram-unknown-siblings-mark",
          "text-anchor": "middle",
          "font-size": "16",
          "font-weight": "bold"
        },
        "?"
      )
    );
  }
  return chunk7ZEDTSU3_cjs.group(
    {
      class: classes.join(" "),
      "data-individual-id": individual.id,
      transform: `translate(${x}, ${y})`
    },
    children
  );
}
function getRequiredDefs(individuals, includeArrowMarker = false) {
  const neededFills = /* @__PURE__ */ new Set();
  for (const ind of individuals) {
    if (ind.conditions) {
      for (const cond of ind.conditions) {
        neededFills.add(cond.fill);
      }
    }
  }
  const children = [];
  function quadClips(suffix, x, y, w, h) {
    const r = chunk7ZEDTSU3_cjs.rect({ x, y, width: w, height: h });
    children.push(
      chunk7ZEDTSU3_cjs.el(
        "clipPath",
        { id: `schematex-genogram-clip-${suffix}-rect`, clipPathUnits: "objectBoundingBox" },
        [r]
      ),
      chunk7ZEDTSU3_cjs.el(
        "clipPath",
        { id: `schematex-genogram-clip-${suffix}-circle`, clipPathUnits: "objectBoundingBox" },
        [r]
      )
    );
  }
  if (neededFills.has("half-left")) quadClips("half-left", 0, 0, 0.5, 1);
  if (neededFills.has("half-right")) quadClips("half-right", 0.5, 0, 0.5, 1);
  if (neededFills.has("half-top")) quadClips("half-top", 0, 0, 1, 0.5);
  if (neededFills.has("half-bottom")) quadClips("half-bottom", 0, 0.5, 1, 0.5);
  if (neededFills.has("quarter")) quadClips("quarter", 0, 0, 0.5, 0.5);
  if (neededFills.has("quad-tl")) quadClips("quad-tl", 0, 0, 0.5, 0.5);
  if (neededFills.has("quad-tr")) quadClips("quad-tr", 0.5, 0, 0.5, 0.5);
  if (neededFills.has("quad-bl")) quadClips("quad-bl", 0, 0.5, 0.5, 0.5);
  if (neededFills.has("quad-br")) quadClips("quad-br", 0.5, 0.5, 0.5, 0.5);
  if (neededFills.has("striped")) {
    children.push(
      chunk7ZEDTSU3_cjs.pattern(
        {
          id: "schematex-genogram-pattern-striped",
          patternUnits: "userSpaceOnUse",
          width: "4",
          height: "4"
        },
        [
          chunk7ZEDTSU3_cjs.path({
            d: "M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2",
            stroke: "#333",
            "stroke-width": "1"
          })
        ]
      )
    );
  }
  if (neededFills.has("dotted")) {
    children.push(
      chunk7ZEDTSU3_cjs.pattern(
        {
          id: "schematex-genogram-pattern-dotted",
          patternUnits: "userSpaceOnUse",
          width: "6",
          height: "6"
        },
        [
          chunk7ZEDTSU3_cjs.circle({ cx: "3", cy: "3", r: "1", fill: "#333" })
        ]
      )
    );
  }
  if (includeArrowMarker) {
    children.push(
      chunk7ZEDTSU3_cjs.el("marker", {
        id: "schematex-genogram-arrow",
        viewBox: "0 0 10 10",
        refX: "10",
        refY: "5",
        markerWidth: "6",
        markerHeight: "6",
        orient: "auto"
      }, [
        chunk7ZEDTSU3_cjs.path({ d: "M 0 0 L 10 5 L 0 10 z", fill: "#333" })
      ])
    );
  }
  return chunk7ZEDTSU3_cjs.defs(children);
}
function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function formatTitle(ind) {
  const name = capitalize(ind.label || ind.id);
  if (ind.birthYear && ind.deathYear) {
    return `${name} (${ind.birthYear}-${ind.deathYear})`;
  }
  if (ind.birthYear) {
    return `${name} (${ind.birthYear})`;
  }
  return name;
}
function calcAge(ind) {
  if (!ind.birthYear) return void 0;
  if (ind.deathYear) return ind.deathYear - ind.birthYear;
  if (ind.status === "deceased") return void 0;
  return void 0;
}
function indexBorder(sex, half) {
  const outer = half + 4;
  switch (sex) {
    case "male":
      return chunk7ZEDTSU3_cjs.rect({
        x: -outer,
        y: -outer,
        width: outer * 2,
        height: outer * 2,
        class: "schematex-genogram-index-border"
      });
    case "female":
      return chunk7ZEDTSU3_cjs.circle({
        cx: 0,
        cy: 0,
        r: outer,
        class: "schematex-genogram-index-border"
      });
    case "unknown":
    case "other":
    case "nonbinary":
    case "intersex":
      return chunk7ZEDTSU3_cjs.polygon({
        points: `0,${-outer} ${outer},0 0,${outer} ${-outer},0`,
        class: "schematex-genogram-index-border"
      });
  }
}
function baseShape(sex, half, shape) {
  const cls = "schematex-genogram-shape";
  switch (shape) {
    case "square":
      return chunk7ZEDTSU3_cjs.rect({ x: -half, y: -half, width: half * 2, height: half * 2, class: cls });
    case "circle":
      return chunk7ZEDTSU3_cjs.circle({ cx: 0, cy: 0, r: half, class: cls });
    case "diamond":
      return chunk7ZEDTSU3_cjs.polygon({ points: `0,${-half} ${half},0 0,${half} ${-half},0`, class: cls });
    case "triangle":
      return chunk7ZEDTSU3_cjs.polygon({ points: `0,${-half} ${half},${half} ${-half},${half}`, class: cls });
    case "triangle-down":
      return chunk7ZEDTSU3_cjs.polygon({ points: `${-half},${-half} ${half},${-half} 0,${half}`, class: cls });
  }
  switch (sex) {
    case "male":
      return chunk7ZEDTSU3_cjs.rect({ x: -half, y: -half, width: half * 2, height: half * 2, class: cls });
    case "female":
      return chunk7ZEDTSU3_cjs.circle({ cx: 0, cy: 0, r: half, class: cls });
    case "unknown":
    case "other":
    case "nonbinary":
    case "intersex":
      return chunk7ZEDTSU3_cjs.polygon({ points: `0,${-half} ${half},0 0,${half} ${-half},0`, class: cls });
  }
}
function deceasedOverlay(sex, half) {
  const extend = sex === "female" ? half * 0.707 : half;
  return [
    chunk7ZEDTSU3_cjs.line({
      x1: -extend,
      y1: -extend,
      x2: extend,
      y2: extend,
      class: "schematex-genogram-deceased-mark",
      stroke: "#333",
      "stroke-width": "2"
    }),
    chunk7ZEDTSU3_cjs.line({
      x1: extend,
      y1: -extend,
      x2: -extend,
      y2: extend,
      class: "schematex-genogram-deceased-mark",
      stroke: "#333",
      "stroke-width": "2"
    })
  ];
}
function conditionFillElement(sex, half, cond) {
  const fillColor = cond.color ?? "#333";
  const attrs = {};
  if (cond.fill === "full") {
    attrs.fill = fillColor;
  } else if (cond.fill === "striped") {
    attrs.fill = "url(#schematex-genogram-pattern-striped)";
  } else if (cond.fill === "dotted") {
    attrs.fill = "url(#schematex-genogram-pattern-dotted)";
  } else {
    const clipSuffix = sex === "female" ? "circle" : "rect";
    attrs["clip-path"] = `url(#schematex-genogram-clip-${cond.fill}-${clipSuffix})`;
    attrs.fill = fillColor;
  }
  attrs.class = `schematex-genogram-condition-fill schematex-genogram-condition-${cond.label}`;
  switch (sex) {
    case "male":
      return chunk7ZEDTSU3_cjs.rect({ x: -half, y: -half, width: half * 2, height: half * 2, ...attrs });
    case "female":
      return chunk7ZEDTSU3_cjs.circle({ cx: 0, cy: 0, r: half, ...attrs });
    case "unknown":
    case "other":
    case "nonbinary":
    case "intersex":
    default:
      return chunk7ZEDTSU3_cjs.polygon({
        points: `0,${-half} ${half},0 0,${half} ${-half},0`,
        ...attrs
      });
  }
}

// src/diagrams/genogram/legend.ts
var EMOTIONAL_TYPES2 = /* @__PURE__ */ new Set([
  "harmony",
  "close",
  "bestfriends",
  "love",
  "inlove",
  "friendship",
  "hostile",
  "conflict",
  "enmity",
  "distant-hostile",
  "cutoff",
  "close-hostile",
  "fused",
  "fused-hostile",
  "distant",
  "normal",
  "nevermet",
  "abuse",
  "physical-abuse",
  "emotional-abuse",
  "sexual-abuse",
  "neglect",
  "manipulative",
  "controlling",
  "jealous",
  "focused",
  "focused-neg",
  "distrust",
  "admirer",
  "limerence"
]);
var STRUCTURAL_TYPES = /* @__PURE__ */ new Set([
  "married",
  "divorced",
  "separated",
  "engaged",
  "cohabiting",
  "cohabiting-ended",
  "domestic-partnership",
  "consanguineous",
  "parent-child",
  "adopted",
  "foster",
  "twin-identical",
  "twin-fraternal"
]);
var HERITAGE_PALETTE = [
  "#2563eb",
  "#059669",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#ca8a04",
  "#db2777"
];
var SECTIONS = [
  { id: "symbols", title: "Symbols" },
  { id: "structural", title: "Structural" },
  { id: "relationships", title: "Relationships" },
  { id: "conditions", title: "Conditions" },
  { id: "heritage", title: "Heritage" },
  { id: "markers", title: "Markers" }
];
function buildGenogramLegend(ast, theme) {
  const items = [];
  items.push(...buildSymbolItems(ast.individuals, theme));
  items.push(...buildStructuralItems(ast.relationships, theme));
  items.push(...buildRelationshipItems(ast.relationships));
  items.push(...buildConditionItems(ast.individuals));
  items.push(...buildHeritageItems(ast.individuals));
  items.push(...buildMarkerItems(ast.individuals, theme));
  return {
    mode: "auto",
    title: "Legend",
    position: "bottom-inline",
    columns: 1,
    sections: SECTIONS,
    items
  };
}
var OBVIOUS_SEX = /* @__PURE__ */ new Set(["male", "female"]);
function buildSymbolItems(individuals, theme) {
  const items = [];
  const sexUsed = /* @__PURE__ */ new Set();
  const statusUsed = /* @__PURE__ */ new Set();
  for (const ind of individuals) {
    sexUsed.add(ind.sex);
    if (ind.status && ind.status !== "alive") statusUsed.add(ind.status);
  }
  const sexOrder = [
    "unknown",
    "other",
    "nonbinary",
    "intersex"
  ];
  for (const s of sexOrder) {
    if (!sexUsed.has(s)) continue;
    if (OBVIOUS_SEX.has(s)) continue;
    items.push({
      key: `sex.${s}`,
      label: sexLabel(s),
      kind: "shape",
      shape: sexShape(s),
      fill: theme ? sexFill(s, theme) : void 0,
      color: theme?.stroke,
      section: "symbols"
    });
  }
  const statusOrder = [
    "deceased",
    "stillborn",
    "miscarriage",
    "abortion",
    "pregnancy",
    "sab",
    "tab",
    "ectopic"
  ];
  for (const st of statusOrder) {
    if (!statusUsed.has(st)) continue;
    items.push({
      key: `status.${st}`,
      label: statusLabel(st),
      kind: "marker",
      marker: statusMarker(st),
      color: theme?.deceasedMark,
      section: "symbols"
    });
  }
  return items;
}
function sexFill(s, theme) {
  switch (s) {
    case "male":
      return theme.maleFill;
    case "female":
      return theme.femaleFill;
    default:
      return theme.unknownFill;
  }
}
function sexShape(s) {
  switch (s) {
    case "male":
      return "square";
    case "female":
      return "circle";
    case "unknown":
      return "diamond";
    case "other":
    case "nonbinary":
      return "diamond";
    case "intersex":
      return "diamond";
    default:
      return "square";
  }
}
function sexLabel(s) {
  switch (s) {
    case "male":
      return "Male";
    case "female":
      return "Female";
    case "unknown":
      return "Unknown";
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
function statusMarker(s) {
  switch (s) {
    case "deceased":
    case "stillborn":
      return "X";
    case "miscarriage":
    case "sab":
    case "tab":
    case "abortion":
    case "ectopic":
      return "slash";
    default:
      return "dot";
  }
}
function statusLabel(s) {
  switch (s) {
    case "deceased":
      return "Deceased";
    case "stillborn":
      return "Stillborn";
    case "miscarriage":
      return "Miscarriage";
    case "abortion":
      return "Abortion";
    case "pregnancy":
      return "Pregnancy";
    case "sab":
      return "Spontaneous abortion";
    case "tab":
      return "Therapeutic abortion";
    case "ectopic":
      return "Ectopic pregnancy";
    default:
      return s;
  }
}
var OBVIOUS_STRUCTURAL = /* @__PURE__ */ new Set([
  "married",
  // single horizontal line — universal McGoldrick
  "parent-child"
  // single vertical line — universal
]);
function buildStructuralItems(rels, theme) {
  const used = /* @__PURE__ */ new Set();
  for (const r of rels) {
    if (STRUCTURAL_TYPES.has(r.type)) used.add(r.type);
  }
  const order = [
    "divorced",
    "separated",
    "engaged",
    "cohabiting",
    "cohabiting-ended",
    "domestic-partnership",
    "consanguineous",
    "adopted",
    "foster",
    "twin-identical",
    "twin-fraternal"
  ];
  const items = [];
  for (const t of order) {
    if (!used.has(t)) continue;
    if (OBVIOUS_STRUCTURAL.has(t)) continue;
    items.push(structuralItem(t, theme));
  }
  return items;
}
function structuralItem(t, theme) {
  const base = {
    key: t,
    label: humanize(t),
    kind: "line",
    color: theme?.stroke,
    section: "structural",
    pattern: "solid"
  };
  switch (t) {
    case "divorced":
      return { ...base, kind: "edge", marker: "X", pattern: "solid" };
    case "separated":
      return { ...base, kind: "edge", marker: "slash", pattern: "solid" };
    case "cohabiting-ended":
      return {
        ...base,
        label: "Cohabiting (ended)",
        kind: "edge",
        marker: "slash",
        pattern: "dashed"
      };
    case "engaged":
    case "cohabiting":
    case "adopted":
    case "foster":
      return { ...base, pattern: "dashed" };
    case "consanguineous":
      return { ...base, pattern: "double" };
    case "twin-identical":
    case "twin-fraternal":
      return { ...base, pattern: "solid" };
    default:
      return base;
  }
}
function buildRelationshipItems(rels) {
  const used = /* @__PURE__ */ new Set();
  for (const r of rels) {
    if (EMOTIONAL_TYPES2.has(r.type)) used.add(r.type);
  }
  const order = [
    "harmony",
    "close",
    "bestfriends",
    "love",
    "inlove",
    "friendship",
    "hostile",
    "conflict",
    "enmity",
    "distant-hostile",
    "cutoff",
    "close-hostile",
    "fused",
    "fused-hostile",
    "distant",
    "normal",
    "nevermet",
    "abuse",
    "physical-abuse",
    "emotional-abuse",
    "sexual-abuse",
    "neglect",
    "manipulative",
    "controlling",
    "jealous",
    "focused",
    "focused-neg",
    "distrust",
    "admirer",
    "limerence"
  ];
  const items = [];
  for (const t of order) {
    if (!used.has(t)) continue;
    items.push({
      key: t,
      label: humanize(t),
      kind: "line",
      color: emotionalColor(t),
      pattern: emotionalPattern(t),
      strokeWidth: emotionalStrokeWidth(t),
      section: "relationships"
    });
  }
  return items;
}
function emotionalColor(t) {
  if (["harmony", "close", "bestfriends", "love", "inlove", "friendship"].includes(t)) return "#4caf50";
  if (["hostile", "conflict", "enmity", "distant-hostile", "cutoff"].includes(t)) return "#e53935";
  if (["close-hostile", "fused", "fused-hostile"].includes(t)) return "#9c27b0";
  if (["distant", "normal", "nevermet"].includes(t)) return "#9e9e9e";
  if (["abuse", "physical-abuse", "emotional-abuse", "sexual-abuse", "neglect"].includes(t)) return "#b71c1c";
  if (["manipulative", "controlling", "jealous"].includes(t)) return "#e65100";
  return "#1565c0";
}
function emotionalPattern(t) {
  if (["hostile", "conflict", "enmity", "distant-hostile", "close-hostile", "fused-hostile"].includes(t)) return "zigzag";
  if (["distant", "nevermet"].includes(t)) return "dashed";
  if (t === "cutoff") return "broken";
  return "solid";
}
function emotionalStrokeWidth(t) {
  if (["fused", "fused-hostile", "bestfriends"].includes(t)) return 4;
  if (["close", "close-hostile", "love", "inlove"].includes(t)) return 3;
  return 2;
}
function buildConditionItems(individuals) {
  const seen = /* @__PURE__ */ new Map();
  for (const ind of individuals) {
    if (!ind.conditions) continue;
    for (const c of ind.conditions) {
      if (seen.has(c.label)) continue;
      const color = c.color ?? defaultCategoryColor(c.category);
      const isFull = c.fill === "full";
      seen.set(c.label, {
        key: c.label,
        label: humanize(c.label),
        kind: isFull ? "fill" : "fill-pattern",
        color,
        shape: isFull ? void 0 : c.fill,
        section: "conditions"
      });
    }
  }
  return Array.from(seen.values());
}
function defaultCategoryColor(cat) {
  if (!cat) return "#9ca3af";
  const map = {
    cardiovascular: "#dc2626",
    cancer: "#a21caf",
    diabetes: "#d97706",
    "mental-health": "#2563eb",
    depression: "#1d4ed8",
    anxiety: "#0ea5e9",
    bipolar: "#6366f1",
    ptsd: "#475569",
    "substance-alcohol": "#92400e",
    "substance-drugs": "#7c2d12",
    "substance-tobacco": "#854d0e",
    neurological: "#7e22ce",
    respiratory: "#0891b2",
    autoimmune: "#be185d",
    genetic: "#0f766e",
    reproductive: "#db2777",
    "eating-disorder": "#9333ea",
    "learning-developmental": "#0369a1",
    kidney: "#b45309",
    "liver-gi": "#ca8a04",
    obesity: "#ea580c",
    other: "#9ca3af"
  };
  return map[cat] ?? "#9ca3af";
}
function buildHeritageItems(individuals) {
  const all = /* @__PURE__ */ new Set();
  for (const ind of individuals) {
    if (!ind.heritage) continue;
    for (const h of ind.heritage) all.add(h);
  }
  const ordered = Array.from(all).sort();
  return ordered.map((id, i) => ({
    key: id,
    label: humanize(id),
    kind: "fill",
    color: HERITAGE_PALETTE[i % HERITAGE_PALETTE.length],
    section: "heritage"
  }));
}
function buildMarkerItems(individuals, theme) {
  const used = /* @__PURE__ */ new Set();
  for (const ind of individuals) {
    if (!ind.markers) continue;
    for (const m of ind.markers) used.add(m);
  }
  const order = [
    "proband",
    "consultand",
    "evaluated",
    "index-person",
    "transgender",
    "no-children",
    "infertile",
    "unknown-siblings"
  ];
  const items = [];
  for (const m of order) {
    if (!used.has(m)) continue;
    items.push(markerItem(m, theme));
  }
  return items;
}
function markerItem(m, theme) {
  switch (m) {
    case "proband":
      return { key: `marker.${m}`, label: "Proband (P)", kind: "marker", marker: "P", section: "markers" };
    case "consultand":
      return { key: `marker.${m}`, label: "Consultand (C)", kind: "marker", marker: "C", section: "markers" };
    case "evaluated":
      return { key: `marker.${m}`, label: "Evaluated (E)", kind: "marker", marker: "E", section: "markers" };
    case "index-person":
      return {
        key: `marker.${m}`,
        label: "Index person (focal subject)",
        kind: "shape",
        shape: "concentric-square",
        fill: "#fef3c7",
        color: theme?.stroke,
        section: "markers"
      };
    case "transgender":
      return { key: `marker.${m}`, label: "Transgender", kind: "marker", marker: "star", section: "markers" };
    case "no-children":
      return { key: `marker.${m}`, label: "No children (by choice)", kind: "marker", marker: "slash", section: "markers" };
    case "infertile":
      return { key: `marker.${m}`, label: "Infertile", kind: "marker", marker: "X", section: "markers" };
    case "unknown-siblings":
      return {
        key: `marker.${m}`,
        label: "Sibling(s) \u2014 unknown count",
        kind: "shape",
        shape: "diamond",
        fill: theme?.fill,
        color: theme?.stroke,
        section: "markers"
      };
    default:
      return { key: `marker.${m}`, label: humanize(m), kind: "marker", marker: "dot", section: "markers" };
  }
}
function humanize(s) {
  return s.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// src/diagrams/genogram/renderer.ts
function renderGenogram(layout, config, ast) {
  const hasDirectional = layout.edges.some((e) => e.relationship.directional);
  const defsStr = getRequiredDefs(layout.nodes.map((n) => n.individual), hasDirectional);
  const styleStr = buildStyles(config);
  const genGroups = groupByGeneration(layout.nodes);
  const structuralEdges = layout.edges.filter((e) => !EMOTIONAL_REL_TYPES2.has(e.relationship.type));
  const emotionalEdges = layout.edges.filter((e) => EMOTIONAL_REL_TYPES2.has(e.relationship.type));
  const edgeLayers = renderEdges(structuralEdges, config.__scene);
  const emotionalLayer = renderEmotionalEdges(emotionalEdges, config.__scene);
  const labelEdges = structuralEdges.filter(
    (e) => !e.relationship.secondary
  );
  const edgeLabelLayer = renderEdgeLabels(labelEdges, config);
  const siblingOfLayer = renderSiblingOfBrackets(layout, ast, config.__scene);
  const nodeCount = layout.nodes.length;
  const genCount = genGroups.size;
  const chartTitle = ast?.metadata?.title;
  const titleHeight = chartTitle ? 40 : 0;
  const totalHeight = layout.height + titleHeight;
  const nodeLayers = renderNodes(genGroups, titleHeight, config.__scene);
  const labelLayer = renderLabels(layout.nodes, config, config.__scene);
  const layers = [
    chunk7ZEDTSU3_cjs.title(chartTitle ? `Genogram: ${chartTitle}` : "Genogram"),
    chunk7ZEDTSU3_cjs.desc(
      `Genogram diagram with ${nodeCount} individuals across ${genCount} generations`
    ),
    defsStr,
    styleStr
  ];
  const chartContent = [];
  const titleScene = chartTitle ? chunkEQMWWNB3_cjs.resolveSceneTitle(chartTitle, ast?.titleSourceRange, layout.width / 2, 28, config) : void 0;
  const titleNode = chartTitle && titleScene ? chunk7ZEDTSU3_cjs.text(
    {
      x: titleScene.x,
      y: titleScene.y,
      class: "schematex-genogram-title",
      "text-anchor": "middle",
      "font-size": "20",
      "font-weight": "bold",
      "font-family": config.fontFamily,
      ...titleScene.attrs
    },
    chartTitle
  ) : "";
  if (titleNode && !config.__scene) chartContent.push(titleNode);
  chartContent.push(
    chunk7ZEDTSU3_cjs.group(
      { transform: titleHeight > 0 ? `translate(0, ${titleHeight})` : void 0 },
      [edgeLayers, siblingOfLayer, emotionalLayer, ...nodeLayers, labelLayer, edgeLabelLayer]
    )
  );
  if (titleNode && config.__scene) chartContent.push(titleNode);
  let finalWidth = layout.width;
  let finalHeight = totalHeight;
  let legendSvg = "";
  if (ast) {
    const themeBase = chunk7ZEDTSU3_cjs.resolveGenogramTheme(config.theme);
    const autoSpec = buildGenogramLegend(ast, themeBase);
    const finalSpec = chunk2JVEMVHO_cjs.applyLegendOverrides(autoSpec, ast.legendOverrides);
    if (finalSpec.mode === "on" && finalSpec.items.length > 0) {
      const { svg, bbox: lb } = chunk2JVEMVHO_cjs.renderLegend(
        finalSpec,
        {
          canvasWidth: layout.width,
          canvasHeight: totalHeight,
          padding: 16,
          titleHeight
        },
        themeBase,
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
      class: "schematex-diagram schematex-genogram",
      width: finalWidth,
      height: finalHeight
    },
    layers
  );
}
function buildStyles(config) {
  const t = chunk7ZEDTSU3_cjs.resolveGenogramTheme(config.theme);
  const css = `
.schematex-genogram {${chunk7ZEDTSU3_cjs.cssCustomProperties(t)}
}
.schematex-genogram-shape { fill: ${t.fill}; stroke: ${t.stroke}; stroke-width: ${chunk7ZEDTSU3_cjs.STROKE_WIDTH.normal}; stroke-linejoin: round; }
.schematex-genogram-male .schematex-genogram-shape { fill: ${t.maleFill}; }
.schematex-genogram-female .schematex-genogram-shape { fill: ${t.femaleFill}; }
.schematex-genogram-unknown .schematex-genogram-shape { fill: ${t.unknownFill}; }
.schematex-genogram-label { font-family: ${config.fontFamily}; font-size: ${config.fontSize}px; text-anchor: middle; fill: ${t.text}; }
.schematex-genogram-vitals { font-family: ${config.fontFamily}; font-size: ${Math.max(9, config.fontSize - 1)}px; text-anchor: middle; fill: ${t.textMuted}; }
.schematex-genogram-note { font-family: ${config.fontFamily}; font-size: ${Math.max(9, config.fontSize - 1)}px; font-style: italic; text-anchor: middle; fill: ${t.textMuted}; }
.schematex-genogram-edge { stroke: ${t.neutral}; stroke-width: ${chunk7ZEDTSU3_cjs.STROKE_WIDTH.normal}; fill: none; stroke-linecap: round; stroke-linejoin: round; }
.schematex-genogram-edge-cohabiting path { stroke-dasharray: 6,4; }
.schematex-genogram-edge-cohabiting-ended path { stroke-dasharray: 6,4; }
.schematex-genogram-edge-divorced .schematex-genogram-divorce-mark { stroke: ${t.neutral}; stroke-width: ${chunk7ZEDTSU3_cjs.STROKE_WIDTH.normal}; }
.schematex-genogram-edge-separated .schematex-genogram-separation-mark { stroke: ${t.neutral}; stroke-width: ${chunk7ZEDTSU3_cjs.STROKE_WIDTH.normal}; }
.schematex-genogram-edge-cohabiting-ended .schematex-genogram-separation-mark { stroke: ${t.neutral}; stroke-width: ${chunk7ZEDTSU3_cjs.STROKE_WIDTH.normal}; }
/* Secondary parent-child link (foster/adopted "current caregiver") \u2014 dotted, muted */
.schematex-genogram-edge-secondary path { stroke: ${t.neutral}; stroke-width: ${chunk7ZEDTSU3_cjs.STROKE_WIDTH.normal}; stroke-dasharray: 2,4; fill: none; opacity: 0.85; }
/* Sibling-of bracket (known relative, unknown ancestry) \u2014 dashed */
.schematex-genogram-sibling-of path { stroke: ${t.neutral}; stroke-width: ${chunk7ZEDTSU3_cjs.STROKE_WIDTH.normal}; stroke-dasharray: 4,3; fill: none; opacity: 0.7; }
.schematex-genogram-unknown-siblings-mark { fill: ${t.text}; pointer-events: none; }
.schematex-genogram-deceased-mark { stroke: ${t.deceasedMark}; stroke-width: ${chunk7ZEDTSU3_cjs.STROKE_WIDTH.normal}; stroke-linecap: round; }
/* Inline fill on each .schematex-genogram-condition-fill element comes from cond.color. The CSS only sets a default for elements that did not receive an inline fill attribute. */
.schematex-genogram-condition-fill:not([fill]) { fill: ${t.conditionFill}; }
.schematex-genogram-age { font-family: ${config.fontFamily}; fill: ${t.text}; pointer-events: none; }
.schematex-genogram-title { fill: ${t.text}; }
.schematex-genogram-edge-label { font-family: ${config.fontFamily}; fill: ${t.text}; }
.schematex-genogram-index-border { stroke: ${t.warn}; stroke-width: ${chunk7ZEDTSU3_cjs.STROKE_WIDTH.thick}; fill: none; }
`;
  return chunk7ZEDTSU3_cjs.el("style", {}, css);
}
var EMOTIONAL_REL_TYPES2 = /* @__PURE__ */ new Set([
  "harmony",
  "close",
  "bestfriends",
  "love",
  "inlove",
  "friendship",
  "hostile",
  "conflict",
  "enmity",
  "distant-hostile",
  "cutoff",
  "close-hostile",
  "fused",
  "fused-hostile",
  "distant",
  "normal",
  "nevermet",
  "abuse",
  "physical-abuse",
  "emotional-abuse",
  "sexual-abuse",
  "neglect",
  "manipulative",
  "controlling",
  "jealous",
  "focused",
  "focused-neg",
  "distrust",
  "admirer",
  "limerence"
]);
function getEmotionalColor(type) {
  if (["harmony", "close", "bestfriends", "love", "inlove", "friendship"].includes(type)) return "#4caf50";
  if (["hostile", "conflict", "enmity", "distant-hostile", "cutoff"].includes(type)) return "#e53935";
  if (["close-hostile", "fused", "fused-hostile"].includes(type)) return "#9c27b0";
  if (["distant", "normal", "nevermet"].includes(type)) return "#9e9e9e";
  if (["abuse", "physical-abuse", "emotional-abuse", "sexual-abuse", "neglect"].includes(type)) return "#b71c1c";
  if (["manipulative", "controlling", "jealous"].includes(type)) return "#e65100";
  return "#1565c0";
}
function getEmotionalLineStyle(type) {
  if (["hostile", "conflict", "enmity", "distant-hostile", "close-hostile", "fused-hostile"].includes(type)) {
    return "stroke-dasharray: 8,3,2,3;";
  }
  if (["distant", "distant-hostile", "nevermet"].includes(type)) {
    return "stroke-dasharray: 6,4;";
  }
  if (type === "cutoff") {
    return "stroke-dasharray: 2,8;";
  }
  return "";
}
function getEmotionalStrokeWidth(type) {
  if (["fused", "fused-hostile", "bestfriends"].includes(type)) return 4;
  if (["close", "close-hostile", "love", "inlove"].includes(type)) return 3;
  return 2;
}
function renderEmotionalEdges(edges, scene) {
  if (edges.length === 0) return chunk7ZEDTSU3_cjs.group({ class: "schematex-genogram-emotional-edges" }, []);
  const children = [];
  for (const [index, edge] of edges.entries()) {
    const type = edge.relationship.type;
    const color = getEmotionalColor(type);
    const lineStyle = getEmotionalLineStyle(type);
    const strokeWidth = getEmotionalStrokeWidth(type);
    const directional = edge.relationship.directional;
    const elements = [
      chunk7ZEDTSU3_cjs.el("path", {
        d: edge.path,
        fill: "none",
        stroke: color,
        "stroke-width": strokeWidth,
        style: lineStyle || void 0,
        "marker-end": directional ? "url(#schematex-genogram-arrow)" : void 0,
        "data-sx-live-edge": scene ? "true" : void 0
      })
    ];
    if (edge.relationship.label) {
      const mid = pathMidpoint(edge.path);
      if (mid) {
        elements.push(
          chunk7ZEDTSU3_cjs.text(
            {
              x: mid.x,
              y: mid.y - 6,
              class: "schematex-genogram-edge-label",
              "text-anchor": "middle",
              "font-size": "10",
              fill: color,
              "data-sx-live-midpoint": scene ? "true" : void 0
            },
            edge.relationship.label
          )
        );
      }
    }
    const key = `edge:emotional:${index}`;
    scene?.push({ key, kind: "edge", path: edge.path, editable: { label: false, position: "none" } });
    children.push(
      chunk7ZEDTSU3_cjs.group(
        {
          "data-sx-key": scene ? key : void 0,
          class: `schematex-genogram-emotional schematex-genogram-emotional-${type}`,
          "data-from": edge.from,
          "data-to": edge.to,
          "data-sx-live-explicit": scene ? "true" : void 0,
          "data-sx-live-start": scene ? edge.from : void 0,
          "data-sx-live-end": scene ? edge.to : void 0,
          "data-sx-live-mode": scene ? "quadratic" : void 0,
          "data-relationship-type": type
        },
        elements
      )
    );
  }
  return chunk7ZEDTSU3_cjs.group({ class: "schematex-genogram-emotional-edges" }, children);
}
function renderEdgeLabels(edges, config) {
  const labels = [];
  for (const edge of edges) {
    if (!edge.relationship.label) continue;
    const mid = pathMidpoint(edge.path);
    if (!mid) continue;
    labels.push(
      chunk7ZEDTSU3_cjs.text(
        {
          x: mid.x,
          y: mid.y - 6,
          class: "schematex-genogram-edge-label",
          "text-anchor": "middle",
          "font-size": "10",
          "font-family": config.fontFamily
        },
        edge.relationship.label
      )
    );
  }
  return chunk7ZEDTSU3_cjs.group({ class: "schematex-genogram-edge-labels" }, labels);
}
function structuralLiveAttrs(edge, scene) {
  if (!scene) return {};
  const relationshipFrom = edge.relationship.from;
  const relationshipTo = edge.relationship.to;
  if (edge.relationship.type === "parent-child" && relationshipFrom.includes("+")) {
    const partners = relationshipFrom.split("+").filter(Boolean);
    const midpointOwners = partners.map((id) => `${id}:0.5`).join(",");
    if (relationshipTo === "_drop") {
      return {
        "data-sx-live-explicit": "true",
        "data-sx-live-all": midpointOwners,
        "data-sx-live-mode": "orthogonal",
        "data-sx-live-kind": "family-drop"
      };
    }
    if (relationshipTo === "_sibship") {
      const startOwners = edge.from.includes("+") ? midpointOwners : edge.from;
      const endOwners = edge.to.includes("+") ? midpointOwners : edge.to;
      return {
        "data-sx-live-explicit": "true",
        "data-sx-live-start": startOwners,
        "data-sx-live-end": endOwners,
        "data-sx-live-mode": "orthogonal",
        "data-sx-live-kind": "sibship"
      };
    }
    return {
      "data-sx-live-explicit": "true",
      "data-sx-live-start": midpointOwners,
      "data-sx-live-end": edge.to,
      "data-sx-live-mode": "orthogonal"
    };
  }
  return {
    "data-sx-live-explicit": "true",
    "data-sx-live-start": edge.from,
    "data-sx-live-end": edge.to,
    "data-sx-live-mode": "orthogonal"
  };
}
function structuralPublicEndpoints(edge) {
  if (edge.relationship.type === "parent-child" && edge.relationship.to === "_sibship" && edge.relationship.from.includes("+")) {
    const [from, to] = edge.relationship.from.split("+");
    if (from && to) return { from, to };
  }
  return { from: edge.from, to: edge.to };
}
function renderEdges(edges, scene) {
  const children = [];
  for (const [index, edge] of edges.entries()) {
    const relType = edge.relationship.type;
    const isSecondary = edge.relationship.secondary === true;
    const cssClass = isSecondary ? `schematex-genogram-edge schematex-genogram-edge-secondary schematex-genogram-edge-secondary-${relType}` : `schematex-genogram-edge schematex-genogram-edge-${relType}`;
    const elements = [
      chunk7ZEDTSU3_cjs.el("path", { d: edge.path, class: "schematex-genogram-edge-path", "data-sx-live-edge": scene ? "true" : void 0 })
    ];
    if (relType === "cohabiting-ended" && !isSecondary) {
      const mid = pathMidpoint(edge.path);
      if (mid) {
        elements.push(
          chunk7ZEDTSU3_cjs.el("line", {
            x1: mid.x - 4,
            y1: mid.y - 6,
            x2: mid.x + 4,
            y2: mid.y + 6,
            class: "schematex-genogram-separation-mark",
            stroke: "#333",
            "stroke-width": "2",
            "data-sx-live-midpoint": scene ? "true" : void 0
          })
        );
      }
    }
    if (relType === "divorced") {
      const mid = pathMidpoint(edge.path);
      if (mid) {
        elements.push(
          chunk7ZEDTSU3_cjs.el("line", {
            x1: mid.x - 4,
            y1: mid.y - 6,
            x2: mid.x + 4,
            y2: mid.y + 6,
            class: "schematex-genogram-divorce-mark",
            stroke: "#333",
            "stroke-width": "2",
            "data-sx-live-midpoint": scene ? "true" : void 0
          }),
          chunk7ZEDTSU3_cjs.el("line", {
            x1: mid.x - 4 + 6,
            y1: mid.y - 6,
            x2: mid.x + 4 + 6,
            y2: mid.y + 6,
            class: "schematex-genogram-divorce-mark",
            stroke: "#333",
            "stroke-width": "2",
            "data-sx-live-midpoint": scene ? "true" : void 0
          })
        );
      }
    }
    if (relType === "separated") {
      const mid = pathMidpoint(edge.path);
      if (mid) {
        elements.push(
          chunk7ZEDTSU3_cjs.el("line", {
            x1: mid.x - 4,
            y1: mid.y - 6,
            x2: mid.x + 4,
            y2: mid.y + 6,
            class: "schematex-genogram-separation-mark",
            stroke: "#333",
            "stroke-width": "2",
            "data-sx-live-midpoint": scene ? "true" : void 0
          })
        );
      }
    }
    const key = `edge:structural:${index}`;
    scene?.push({ key, kind: "edge", path: edge.path, editable: { label: false, position: "none" } });
    const publicEndpoints = structuralPublicEndpoints(edge);
    children.push(
      chunk7ZEDTSU3_cjs.group(
        {
          "data-sx-key": scene ? key : void 0,
          class: cssClass,
          "data-from": publicEndpoints.from,
          "data-to": publicEndpoints.to,
          ...structuralLiveAttrs(edge, scene)
        },
        elements
      )
    );
  }
  return chunk7ZEDTSU3_cjs.group({ class: "schematex-genogram-edges" }, children);
}
function pathMidpoint(pathData) {
  const coords = pathData.match(/[\d.-]+/g);
  if (!coords || coords.length < 4) return null;
  const x1 = parseFloat(coords[0]);
  const y1 = parseFloat(coords[1]);
  const x2 = parseFloat(coords[2]);
  const y2 = parseFloat(coords[3]);
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
}
function groupByGeneration(nodes) {
  const groups = /* @__PURE__ */ new Map();
  for (const node of nodes) {
    const gen = node.generation;
    const group2 = groups.get(gen) ?? [];
    group2.push(node);
    groups.set(gen, group2);
  }
  return groups;
}
function renderNodes(genGroups, titleHeight, scene) {
  const layers = [];
  const sortedGens = Array.from(genGroups.keys()).sort((a, b) => a - b);
  for (const genIdx of sortedGens) {
    const nodes = genGroups.get(genIdx) ?? [];
    const nodeElements = [];
    for (const node of nodes) {
      const cx = node.x + node.width / 2;
      const cy = node.y + node.height / 2;
      const key = `node:${node.id}`;
      scene?.push({
        key,
        kind: "node",
        semanticId: node.id,
        label: node.individual.label,
        sourceRange: node.individual.labelSourceRange,
        bbox: { x: node.x, y: node.y + titleHeight, width: node.width, height: node.height },
        editable: { label: node.individual.labelSourceRange !== void 0, position: "move-x" }
      });
      const symbol = renderIndividualSymbol(node.individual, cx, cy, node.width);
      nodeElements.push(scene ? chunk7ZEDTSU3_cjs.group({ "data-sx-key": key, "data-sx-owner": key, "data-individual-id": node.id }, [symbol]) : symbol);
    }
    layers.push(
      chunk7ZEDTSU3_cjs.group(
        {
          class: `schematex-genogram-generation schematex-genogram-generation-${genIdx}`,
          "data-generation": genIdx
        },
        nodeElements
      )
    );
  }
  return layers;
}
function renderSiblingOfBrackets(layout, ast, scene) {
  if (!ast) return chunk7ZEDTSU3_cjs.group({ class: "schematex-genogram-sibling-of-edges" }, []);
  const elements = [];
  const nodeById = new Map(layout.nodes.map((n) => [n.id, n]));
  let edgeIndex = 0;
  for (const ind of ast.individuals) {
    if (!ind.siblingOf) continue;
    const fromNode = nodeById.get(ind.id);
    const toNode = nodeById.get(ind.siblingOf);
    if (!fromNode || !toNode) continue;
    if (fromNode.generation !== toNode.generation) continue;
    const fromCx = fromNode.x + fromNode.width / 2;
    const fromTopY = fromNode.y;
    const toCx = toNode.x + toNode.width / 2;
    const toTopY = toNode.y;
    const bracketY = Math.min(fromTopY, toTopY) - 12;
    const path2 = `M ${fromCx} ${fromTopY} L ${fromCx} ${bracketY} L ${toCx} ${bracketY} L ${toCx} ${toTopY}`;
    const key = `edge:sibling-of:${edgeIndex++}`;
    scene?.push({ key, kind: "edge", path: path2, editable: { label: false, position: "none" } });
    elements.push(
      chunk7ZEDTSU3_cjs.group(
        {
          "data-sx-key": scene ? key : void 0,
          class: "schematex-genogram-sibling-of",
          "data-from": ind.id,
          "data-to": ind.siblingOf,
          "data-sx-live-explicit": scene ? "true" : void 0,
          "data-sx-live-start": scene ? ind.id : void 0,
          "data-sx-live-end": scene ? ind.siblingOf : void 0,
          "data-sx-live-mode": scene ? "orthogonal" : void 0
        },
        [chunk7ZEDTSU3_cjs.el("path", { d: path2, "data-sx-live-edge": scene ? "true" : void 0 })]
      )
    );
  }
  return chunk7ZEDTSU3_cjs.group({ class: "schematex-genogram-sibling-of-edges" }, elements);
}
function renderLabels(nodes, config, scene) {
  const labels = [];
  const captionStep = config.fontSize + 1;
  for (const node of nodes) {
    const ind = node.individual;
    const label = ind.label || ind.id;
    const cx = node.x + node.width / 2;
    const labelY = node.y + node.height + 6 + config.fontSize;
    const nameText = label.charAt(0).toUpperCase() + label.slice(1);
    const datesLine = vitalDatesLine(ind);
    const usesGenealogy = datesLine !== null || !!ind.note;
    let nameLabel = nameText;
    if (!usesGenealogy) {
      if (ind.birthYear && ind.deathYear) {
        nameLabel += ` (${ind.birthYear}\u2013${ind.deathYear})`;
      } else if (ind.birthYear) {
        nameLabel += ` (b. ${ind.birthYear})`;
      }
    }
    labels.push(
      chunk7ZEDTSU3_cjs.text(
        {
          x: cx,
          y: labelY,
          class: "schematex-genogram-label",
          "data-individual-id": ind.id,
          "data-sx-owner": scene ? `node:${ind.id}` : void 0,
          "data-sx-role": scene && ind.labelSourceRange ? "label" : void 0
        },
        nameLabel
      )
    );
    let lineY = labelY;
    if (datesLine !== null) {
      lineY += captionStep;
      labels.push(
        chunk7ZEDTSU3_cjs.text(
          {
            x: cx,
            y: lineY,
            class: "schematex-genogram-vitals",
            "data-individual-id": ind.id,
            "data-sx-owner": scene ? `node:${ind.id}` : void 0
          },
          datesLine
        )
      );
    }
    if (ind.note) {
      lineY += captionStep;
      labels.push(
        chunk7ZEDTSU3_cjs.text(
          {
            x: cx,
            y: lineY,
            class: "schematex-genogram-note",
            "data-individual-id": ind.id,
            "data-sx-owner": scene ? `node:${ind.id}` : void 0
          },
          ind.note
        )
      );
    }
  }
  return chunk7ZEDTSU3_cjs.group({ class: "schematex-genogram-labels" }, labels);
}
function vitalDatesLine(ind) {
  const bornText = ind.dob ?? (ind.birthYear ? String(ind.birthYear) : void 0);
  const diedText = ind.dod ?? (ind.deathYear ? String(ind.deathYear) : void 0);
  const isDeceased = ind.status === "deceased" || diedText !== void 0;
  const hasFullDate = !!ind.dob || !!ind.dod;
  if (!hasFullDate && !ind.birthStatus) return null;
  const bornGlyph = ind.birthStatus === "adopted" ? "[*]" : ind.birthStatus === "out-of-wedlock" ? "(*)" : "*";
  const parts = [];
  if (bornText) parts.push(`${bornGlyph} ${bornText}`);
  else if (ind.birthStatus) parts.push(bornGlyph);
  if (isDeceased) parts.push(diedText ? `\u2020 ${diedText}` : "\u2020");
  return parts.length > 0 ? parts.join("  ") : null;
}

// src/diagrams/genogram/index.ts
var genogram = {
  type: "genogram",
  capabilities: { scene: true, editablePosition: true },
  detect(text2) {
    const firstLine = chunkVGO4AJ4K_cjs.firstContentLine(text2)?.toLowerCase() ?? "";
    return firstLine === "genogram" || firstLine.startsWith("genogram ");
  },
  parse: parseGenogram,
  render(text2, config) {
    const ast = parseGenogram(text2);
    const layoutConfig = {
      nodeSpacingX: 80,
      nodeSpacingY: 100,
      nodeWidth: 40,
      nodeHeight: 40
    };
    const layout = layoutGenogram(ast, layoutConfig, config?.__pins);
    const renderConfig = {
      fontFamily: config?.fontFamily ?? "system-ui, -apple-system, sans-serif",
      fontSize: config?.fontSize ?? 12,
      theme: config?.theme ?? "default",
      padding: config?.padding ?? 20,
      __scene: config?.__scene,
      __pins: config?.__pins
    };
    return renderGenogram(layout, renderConfig, ast);
  }
};

exports.ParseError = ParseError;
exports.genogram = genogram;
exports.getRequiredDefs = getRequiredDefs;
exports.layoutGenogram = layoutGenogram;
exports.parseGenogram = parseGenogram;
exports.renderGenogram = renderGenogram;
exports.renderIndividualSymbol = renderIndividualSymbol;
//# sourceMappingURL=chunk-3GSIJMSI.cjs.map
//# sourceMappingURL=chunk-3GSIJMSI.cjs.map