'use strict';

// src/core/quotes.ts
var QUOTE_PAIRS = {
  '"': '"',
  "'": "'",
  "\u201C": "\u201D",
  // " "
  "\u2018": "\u2019",
  // ' '
  "\xAB": "\xBB",
  // « »
  "\u300C": "\u300D",
  // 「 」
  "\u300E": "\u300F"
  // 『 』
};
var OPEN_QUOTES = new Set(Object.keys(QUOTE_PAIRS));
function isOpenQuote(ch) {
  return OPEN_QUOTES.has(ch);
}
function findClosingQuote(s, openIdx) {
  const open = s[openIdx];
  if (open === void 0 || !OPEN_QUOTES.has(open)) return -1;
  const close = QUOTE_PAIRS[open];
  const escapable = open === '"' || open === "'";
  for (let i = openIdx + 1; i < s.length; i++) {
    const ch = s[i];
    if (escapable && ch === "\\" && i + 1 < s.length) {
      i++;
      continue;
    }
    if (ch === close) return i;
  }
  return -1;
}
function extractQuotedString(s, start) {
  const open = s[start];
  if (open === void 0 || !OPEN_QUOTES.has(open)) return null;
  const closeIdx = findClosingQuote(s, start);
  if (closeIdx < 0) {
    throw new Error(`unterminated quoted string starting at index ${start}`);
  }
  const raw = s.slice(start + 1, closeIdx);
  const value = open === '"' || open === "'" ? unescapeAscii(raw, open) : raw;
  return { value, end: closeIdx + 1 };
}
function unescapeAscii(s, quote) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\\" && i + 1 < s.length) {
      const next = s[i + 1];
      if (next === quote || next === "\\") {
        out += next;
        i++;
        continue;
      }
    }
    out += ch;
  }
  return out;
}
function matchQuotedTitle(line) {
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (OPEN_QUOTES.has(ch)) {
      try {
        const r = extractQuotedString(line, i);
        if (r) return r.value;
      } catch {
        return void 0;
      }
    }
  }
  return void 0;
}
function stripQuotes(s) {
  const t = s.trim();
  if (t.length < 2) return t;
  const open = t[0];
  if (!OPEN_QUOTES.has(open)) return t;
  const expected = QUOTE_PAIRS[open];
  if (t[t.length - 1] !== expected) return t;
  const inner = t.slice(1, -1);
  return open === '"' || open === "'" ? unescapeAscii(inner, open) : inner;
}

exports.QUOTE_PAIRS = QUOTE_PAIRS;
exports.extractQuotedString = extractQuotedString;
exports.findClosingQuote = findClosingQuote;
exports.isOpenQuote = isOpenQuote;
exports.matchQuotedTitle = matchQuotedTitle;
exports.stripQuotes = stripQuotes;
//# sourceMappingURL=chunk-4M6OFAHM.cjs.map
//# sourceMappingURL=chunk-4M6OFAHM.cjs.map