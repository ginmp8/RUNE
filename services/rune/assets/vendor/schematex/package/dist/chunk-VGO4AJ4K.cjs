'use strict';

// src/core/dsl-preprocess.ts
var FRONTMATTER_DELIM = /^-{3,}\s*$/;
function parseFrontmatter(text) {
  const lines = text.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (i >= lines.length || !FRONTMATTER_DELIM.test(lines[i])) {
    return { data: {}, body: text };
  }
  const openIdx = i;
  i++;
  const data = {};
  while (i < lines.length && !FRONTMATTER_DELIM.test(lines[i])) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      i++;
      continue;
    }
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx <= 0) {
      return { data: {}, body: text };
    }
    const key = trimmed.slice(0, colonIdx).trim();
    let value = trimmed.slice(colonIdx + 1).trim();
    if (value.length >= 2 && (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'") || value.startsWith("\u201C") && value.endsWith("\u201D"))) {
      value = value.slice(1, -1);
    }
    data[key] = value;
    i++;
  }
  if (i >= lines.length) {
    return { data: {}, body: text };
  }
  const body = lines.slice(i + 1).join("\n");
  if (Object.keys(data).length === 0 && openIdx === 0) {
    return { data: {}, body: text };
  }
  return { data, body };
}
var DEFAULT_COMMENT_MARKERS = ["%%", "//", "#"];
var UNIVERSAL_COMMENT_MARKERS = ["%%"];
function stripLineComment(line, markers = DEFAULT_COMMENT_MARKERS) {
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (i > 0 && line[i - 1] === "\\") continue;
      inQuote = !inQuote;
      continue;
    }
    if (inQuote) continue;
    for (const marker of markers) {
      if (line.startsWith(marker, i)) return line.slice(0, i);
    }
  }
  return line;
}
function firstContentLine(text) {
  for (const raw of text.split(/\r?\n/)) {
    const line = stripLineComment(raw).trim();
    if (line !== "") return line;
  }
  return void 0;
}

exports.UNIVERSAL_COMMENT_MARKERS = UNIVERSAL_COMMENT_MARKERS;
exports.firstContentLine = firstContentLine;
exports.parseFrontmatter = parseFrontmatter;
exports.stripLineComment = stripLineComment;
//# sourceMappingURL=chunk-VGO4AJ4K.cjs.map
//# sourceMappingURL=chunk-VGO4AJ4K.cjs.map