'use strict';

// src/core/dsl-suggest.ts
function distance(a, b, cap) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const al = a.length;
  const bl = b.length;
  const prev = new Array(bl + 1);
  const curr = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) prev[j] = j;
  for (let i = 1; i <= al; i++) {
    curr[0] = i;
    let rowMin = i;
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        // deletion
        curr[j - 1] + 1,
        // insertion
        prev[j - 1] + cost
        // substitution
      );
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > cap) return cap + 1;
    for (let j = 0; j <= bl; j++) prev[j] = curr[j];
  }
  return prev[bl];
}
function suggestKeyword(input, candidates) {
  const needle = input.toLowerCase();
  let best = null;
  let secondBest = Infinity;
  for (const c of candidates) {
    const d = distance(needle, c.toLowerCase(), 2);
    if (d > 2) continue;
    if (best === null || d < best.dist) {
      secondBest = best?.dist ?? Infinity;
      best = { word: c, dist: d };
    } else if (d < secondBest) {
      secondBest = d;
    }
  }
  if (best === null) return null;
  if (secondBest <= best.dist) return null;
  return best.word;
}
function didYouMean(input, candidates) {
  const s = suggestKeyword(input, candidates);
  return s ? ` (did you mean '${s}'?)` : "";
}

exports.didYouMean = didYouMean;
//# sourceMappingURL=chunk-SBB6C4OP.cjs.map
//# sourceMappingURL=chunk-SBB6C4OP.cjs.map