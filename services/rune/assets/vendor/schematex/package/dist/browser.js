import { render, renderPreview } from './chunk-S5SCBZQA.js';
export { render, renderPreview, renderResult } from './chunk-S5SCBZQA.js';
import './chunk-HHD67KEI.js';
import './chunk-LVOQHHOY.js';
import './chunk-IIB6MJVI.js';
import './chunk-UCXYF6LN.js';
import './chunk-2KX4J7KX.js';
import './chunk-R6GGQWDH.js';
import './chunk-5IJDNJUJ.js';
import './chunk-K2L56KX2.js';
import './chunk-OASHF7KX.js';
import './chunk-227KJGLB.js';
import './chunk-NRSOPIUR.js';
import './chunk-XWMX2GWP.js';
import './chunk-FKNZ3DJB.js';
import './chunk-6HBNH3AK.js';
import './chunk-BTVWLNZ5.js';
import './chunk-YC56U42M.js';
import './chunk-QLXTXIFY.js';
import './chunk-S5MF733M.js';
import './chunk-IC64LCKF.js';
import './chunk-AVFHQLGW.js';
import './chunk-KO55AXPI.js';
import './chunk-QDQTH6HV.js';
import './chunk-PIV2A3HG.js';
import './chunk-ISQCUPQR.js';
import './chunk-ZUMTE4E7.js';

// src/browser.ts
function renderToElement(text, config) {
  return svgStringToElement(render(text, config));
}
function renderPreviewToElement(text, config) {
  return svgStringToElement(renderPreview(text, config));
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
  container.innerHTML = render(text, config);
}
function renderPreviewToContainer(text, container, config) {
  container.innerHTML = renderPreview(text, config);
}

export { renderPreviewToContainer, renderPreviewToElement, renderToContainer, renderToElement };
//# sourceMappingURL=browser.js.map
//# sourceMappingURL=browser.js.map