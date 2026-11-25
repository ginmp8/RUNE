'use strict';

// src/export.ts
function withWhiteSvgBackground(svgString) {
  if (svgString.includes('data-sx-export-background="true"')) return svgString;
  const open = svgString.match(/<svg\b[^>]*>/)?.[0];
  if (!open) return svgString;
  const descEnd = svgString.indexOf("</desc>");
  const titleEnd = svgString.indexOf("</title>");
  const insertAt = descEnd >= 0 ? descEnd + "</desc>".length : titleEnd >= 0 ? titleEnd + "</title>".length : svgString.indexOf(open) + open.length;
  const background = '<rect width="100%" height="100%" fill="#ffffff" data-sx-export-background="true"/>';
  return `${svgString.slice(0, insertAt)}${background}${svgString.slice(insertAt)}`;
}
function svgToPngBlob(svgString, options = {}) {
  const { scale = 2, background = null } = options;
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || img.width || 800;
      const h = img.naturalHeight || img.height || 600;
      const canvas = document.createElement("canvas");
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Could not get 2D canvas context"));
        return;
      }
      ctx.scale(scale, scale);
      if (background) {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (pngBlob) => {
          if (pngBlob) resolve(pngBlob);
          else reject(new Error("canvas.toBlob returned null"));
        },
        "image/png"
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load SVG as image"));
    };
    img.src = url;
  });
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function printSvgAsPdf(svgString, title = "Schematex Diagram") {
  const printSvg = withWhiteSvgBackground(svgString);
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: #fff; color: #111; }
  body { display: flex; justify-content: center; align-items: flex-start; }
  svg { max-width: 100%; height: auto; display: block; }
  @media print {
    body { display: block; }
    svg { width: 100%; page-break-inside: avoid; }
  }
</style>
</head>
<body>${printSvg}</body>
</html>`;
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    window.open(URL.createObjectURL(blob), "_blank");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.onload = () => win.print();
}

exports.downloadBlob = downloadBlob;
exports.printSvgAsPdf = printSvgAsPdf;
exports.svgToPngBlob = svgToPngBlob;
exports.withWhiteSvgBackground = withWhiteSvgBackground;
//# sourceMappingURL=export.cjs.map
//# sourceMappingURL=export.cjs.map