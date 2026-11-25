'use strict';

// src/core/title-scene.ts
var TITLE_SCENE_ID = "@title";
function resolveSceneTitle(title, sourceRange, defaultCenterX, defaultBaselineY, config) {
  const width = Math.max(48, title.length * 9 + 10);
  const height = 22;
  const baselineOffset = 17;
  const pin = config?.__pins?.get(TITLE_SCENE_ID);
  const bbox = {
    x: pin?.x ?? defaultCenterX - width / 2,
    y: pin?.y ?? defaultBaselineY - baselineOffset,
    width,
    height
  };
  config?.__scene?.push({
    key: "title",
    kind: "label",
    semanticId: TITLE_SCENE_ID,
    label: title,
    sourceRange,
    bbox,
    editable: { label: sourceRange !== void 0, position: "free" }
  });
  return {
    x: bbox.x + width / 2,
    y: bbox.y + baselineOffset,
    bbox,
    attrs: {
      "data-sx-key": config?.__scene ? "title" : void 0,
      "data-sx-role": config?.__scene ? "label" : void 0
    }
  };
}

exports.TITLE_SCENE_ID = TITLE_SCENE_ID;
exports.resolveSceneTitle = resolveSceneTitle;
//# sourceMappingURL=chunk-EQMWWNB3.cjs.map
//# sourceMappingURL=chunk-EQMWWNB3.cjs.map