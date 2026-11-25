'use strict';

var chunkH5EDPYH7_cjs = require('./chunk-H5EDPYH7.cjs');
require('./chunk-SRCHQ5FQ.cjs');
require('./chunk-5A6CVYMM.cjs');
require('./chunk-5ZC74S6U.cjs');
require('./chunk-RETPPUXH.cjs');
require('./chunk-FDQVLYPZ.cjs');
require('./chunk-3SMTOXJD.cjs');
require('./chunk-OLKFF6SV.cjs');
require('./chunk-I75B52F2.cjs');
require('./chunk-VZAMNYRV.cjs');
require('./chunk-GUCP6AKN.cjs');
require('./chunk-NTS45SH6.cjs');
require('./chunk-3GSIJMSI.cjs');
require('./chunk-OO27E4GU.cjs');
require('./chunk-JXJQEYL3.cjs');
require('./chunk-VGO4AJ4K.cjs');
require('./chunk-ICLXRCSE.cjs');
require('./chunk-JNSP3SUJ.cjs');
require('./chunk-2JVEMVHO.cjs');
require('./chunk-QPXUX7WK.cjs');
require('./chunk-EQMWWNB3.cjs');
require('./chunk-54Q7JDQB.cjs');
require('./chunk-MPA7DBNQ.cjs');
require('./chunk-SBB6C4OP.cjs');
require('./chunk-4M6OFAHM.cjs');
require('./chunk-7ZEDTSU3.cjs');

// src/browser.ts
function renderToElement(text, config) {
  return svgStringToElement(chunkH5EDPYH7_cjs.render(text, config));
}
function renderPreviewToElement(text, config) {
  return svgStringToElement(chunkH5EDPYH7_cjs.renderPreview(text, config));
}
function svgStringToElement(svgString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, "image/svg+xml");
  const el = doc.documentElement;
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error(`SVG parse error: ${parseError.textContent}`);
  }
  return el;
}
function renderToContainer(text, container, config) {
  container.innerHTML = chunkH5EDPYH7_cjs.render(text, config);
}
function renderPreviewToContainer(text, container, config) {
  container.innerHTML = chunkH5EDPYH7_cjs.renderPreview(text, config);
}

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
exports.renderPreviewToContainer = renderPreviewToContainer;
exports.renderPreviewToElement = renderPreviewToElement;
exports.renderToContainer = renderToContainer;
exports.renderToElement = renderToElement;
//# sourceMappingURL=browser.cjs.map
//# sourceMappingURL=browser.cjs.map