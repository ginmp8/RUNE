(() => {
  const NS = "http://www.w3.org/2000/svg";
  const MAX_MAP_POINTS = 100000;
  const MAX_STL_VERTICES = 100000;
  const MAX_CHART_ITEMS = 100;

  function svgElement(name, attributes = {}) {
    const element = document.createElementNS(NS, name);
    for (const [key, value] of Object.entries(attributes)) {
      element.setAttribute(key, String(value));
    }
    return element;
  }

  function readSource(node) {
    const pre = node.querySelector("pre");
    return (pre ? pre.textContent : node.textContent || "").trim();
  }

  function coordinatesFromGeometry(geometry, output) {
    if (!geometry) return;
    if (output.length > MAX_MAP_POINTS) throw new Error("Limite de pontos do mapa excedido.");
    const type = geometry.type;
    const coordinates = geometry.coordinates;
    if (type === "Point") output.push(coordinates);
    else if (type === "MultiPoint" || type === "LineString") output.push(...coordinates);
    else if (type === "MultiLineString" || type === "Polygon") {
      for (const line of coordinates) output.push(...line);
    } else if (type === "MultiPolygon") {
      for (const polygon of coordinates) for (const line of polygon) output.push(...line);
    } else if (type === "GeometryCollection") {
      for (const item of geometry.geometries || []) coordinatesFromGeometry(item, output);
    }
  }

  function normalizeGeoJSON(value) {
    if (!value || typeof value !== "object") throw new Error("Invalid GeoJSON.");
    if (value.type === "FeatureCollection") return value.features || [];
    if (value.type === "Feature") return [value];
    return [{ type: "Feature", properties: {}, geometry: value }];
  }

  function topologyToFeatures(topology) {
    if (!topology || topology.type !== "Topology") throw new Error("Invalid TopoJSON.");
    const transform = topology.transform || null;
    let decodedPointCount = 0;
    const decodedArcs = (topology.arcs || []).map((arc) => {
      let x = 0;
      let y = 0;
      return arc.map((point) => {
        decodedPointCount += 1;
        if (decodedPointCount > MAX_MAP_POINTS) throw new Error("Limite de pontos do TopoJSON excedido.");
        x += Number(point[0]);
        y += Number(point[1]);
        if (!transform) return [x, y];
        return [
          x * Number(transform.scale[0]) + Number(transform.translate[0]),
          y * Number(transform.scale[1]) + Number(transform.translate[1]),
        ];
      });
    });

    function arcAt(index) {
      if (index >= 0) return decodedArcs[index] || [];
      return [...(decodedArcs[~index] || [])].reverse();
    }

    function joinArcs(indices) {
      const output = [];
      for (const index of indices) {
        const arc = arcAt(index);
        if (output.length && arc.length) output.push(...arc.slice(1));
        else output.push(...arc);
      }
      return output;
    }

    function transformPoint(point) {
      if (!transform) return point;
      return [
        Number(point[0]) * Number(transform.scale[0]) + Number(transform.translate[0]),
        Number(point[1]) * Number(transform.scale[1]) + Number(transform.translate[1]),
      ];
    }

    function geometryToGeoJSON(geometry) {
      if (!geometry) return null;
      switch (geometry.type) {
        case "Point":
          return { type: "Point", coordinates: transformPoint(geometry.coordinates) };
        case "MultiPoint":
          return { type: "MultiPoint", coordinates: (geometry.coordinates || []).map(transformPoint) };
        case "LineString":
          return { type: "LineString", coordinates: joinArcs(geometry.arcs) };
        case "MultiLineString":
          return { type: "MultiLineString", coordinates: geometry.arcs.map(joinArcs) };
        case "Polygon":
          return { type: "Polygon", coordinates: geometry.arcs.map(joinArcs) };
        case "MultiPolygon":
          return {
            type: "MultiPolygon",
            coordinates: geometry.arcs.map((polygon) => polygon.map(joinArcs)),
          };
        case "GeometryCollection":
          return {
            type: "GeometryCollection",
            geometries: (geometry.geometries || []).map(geometryToGeoJSON),
          };
        default:
          return null;
      }
    }

    const features = [];
    for (const [name, object] of Object.entries(topology.objects || {})) {
      const geometries = object.type === "GeometryCollection" ? object.geometries || [] : [object];
      for (const geometry of geometries) {
        features.push({
          type: "Feature",
          properties: { ...(geometry.properties || {}), __topologyObject: name },
          geometry: geometryToGeoJSON(geometry),
        });
      }
    }
    return features;
  }

  function createProjection(features, width, height, padding) {
    const coordinates = [];
    for (const feature of features) coordinatesFromGeometry(feature.geometry, coordinates);
    const valid = coordinates.filter(
      (point) => Array.isArray(point) && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1]))
    );
    if (!valid.length) throw new Error("The diagram does not contain valid coordinates.");
    if (valid.length > MAX_MAP_POINTS) throw new Error("Limite de pontos do mapa excedido.");
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const point of valid) {
      const x = Number(point[0]);
      const y = Number(point[1]);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const spanX = Math.max(maxX - minX, 1e-9);
    const spanY = Math.max(maxY - minY, 1e-9);
    const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY);
    const renderedWidth = spanX * scale;
    const renderedHeight = spanY * scale;
    const offsetX = (width - renderedWidth) / 2;
    const offsetY = (height - renderedHeight) / 2;
    return ([x, y]) => [
      offsetX + (Number(x) - minX) * scale,
      height - (offsetY + (Number(y) - minY) * scale),
    ];
  }

  function linePath(line, project, close = false) {
    if (!Array.isArray(line) || !line.length) return "";
    const points = line.map(project);
    return points.map((point, index) => `${index ? "L" : "M"}${point[0].toFixed(2)},${point[1].toFixed(2)}`).join(" ") + (close ? " Z" : "");
  }

  function drawGeometry(svg, geometry, project, properties = {}) {
    if (!geometry) return;
    const common = { "vector-effect": "non-scaling-stroke" };
    if (geometry.type === "Point") {
      const [cx, cy] = project(geometry.coordinates);
      svg.appendChild(svgElement("circle", { cx, cy, r: 4, class: "geo-point", ...common }));
      if (properties.name || properties.title) {
        const text = svgElement("text", { x: cx + 7, y: cy - 7, class: "geo-label" });
        text.textContent = String(properties.name || properties.title);
        svg.appendChild(text);
      }
    } else if (geometry.type === "MultiPoint") {
      for (const point of geometry.coordinates) drawGeometry(svg, { type: "Point", coordinates: point }, project, properties);
    } else if (geometry.type === "LineString") {
      svg.appendChild(svgElement("path", { d: linePath(geometry.coordinates, project), class: "geo-line", ...common }));
    } else if (geometry.type === "MultiLineString") {
      for (const line of geometry.coordinates) drawGeometry(svg, { type: "LineString", coordinates: line }, project, properties);
    } else if (geometry.type === "Polygon") {
      const d = geometry.coordinates.map((ring) => linePath(ring, project, true)).join(" ");
      svg.appendChild(svgElement("path", { d, class: "geo-polygon", "fill-rule": "evenodd", ...common }));
    } else if (geometry.type === "MultiPolygon") {
      for (const polygon of geometry.coordinates) drawGeometry(svg, { type: "Polygon", coordinates: polygon }, project, properties);
    } else if (geometry.type === "GeometryCollection") {
      for (const item of geometry.geometries || []) drawGeometry(svg, item, project, properties);
    }
  }

  function renderMap(node, kind) {
    const parsed = JSON.parse(readSource(node));
    const features = kind === "topojson" ? topologyToFeatures(parsed) : normalizeGeoJSON(parsed);
    const width = 800;
    const height = 450;
    const svg = svgElement("svg", {
      viewBox: `0 0 ${width} ${height}`,
      role: "img",
      "aria-label": kind === "topojson" ? "Mapa TopoJSON" : "Mapa GeoJSON",
      class: "static-map",
    });
    const background = svgElement("rect", { x: 0, y: 0, width, height, class: "geo-background" });
    svg.appendChild(background);
    const project = createProjection(features, width, height, 28);
    for (const feature of features) drawGeometry(svg, feature.geometry, project, feature.properties || {});
    node.replaceChildren(svg);
    node.classList.add("diagram-rendered");
  }

  function renderStl(node) {
    const source = readSource(node);
    const vertices = [];
    const pattern = /\bvertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)/g;
    let match;
    while ((match = pattern.exec(source)) !== null) {
      vertices.push([Number(match[1]), Number(match[2]), Number(match[3])]);
      if (vertices.length > MAX_STL_VERTICES) throw new Error("STL vertex limit exceeded.");
    }
    if (vertices.length < 3) throw new Error("ASCII STL does not contain valid triangles.");
    const projected = vertices.map(([x, y, z]) => [(x - z) * 0.8660254, (x + z) * 0.5 - y]);
    const xs = projected.map((point) => point[0]);
    const ys = projected.map((point) => point[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const width = 800;
    const height = 500;
    const padding = 30;
    const scale = Math.min(
      (width - padding * 2) / Math.max(maxX - minX, 1e-9),
      (height - padding * 2) / Math.max(maxY - minY, 1e-9)
    );
    const mapPoint = ([x, y]) => [
      padding + (x - minX) * scale,
      height - padding - (y - minY) * scale,
    ];
    const svg = svgElement("svg", {
      viewBox: `0 0 ${width} ${height}`,
      role: "img",
      "aria-label": "STL model projection",
      class: "static-stl",
    });
    svg.appendChild(svgElement("rect", { x: 0, y: 0, width, height, class: "stl-background" }));
    for (let index = 0; index + 2 < projected.length; index += 3) {
      const points = [projected[index], projected[index + 1], projected[index + 2]].map(mapPoint);
      svg.appendChild(svgElement("polygon", {
        points: points.map((point) => `${point[0].toFixed(2)},${point[1].toFixed(2)}`).join(" "),
        class: "stl-facet",
        "vector-effect": "non-scaling-stroke",
      }));
    }
    node.replaceChildren(svg);
    node.classList.add("diagram-rendered");
  }

  function renderChart(node) {
    const config = JSON.parse(readSource(node));
    const type = String(config.type || "bar").toLowerCase();
    const labels = Array.isArray(config.labels) ? config.labels.map(String) : [];
    const values = Array.isArray(config.values) ? config.values.map(Number) : [];
    if (!labels.length || labels.length !== values.length || values.some((value) => !Number.isFinite(value))) {
      throw new Error("Use numeric labels and values with the same length.");
    }
    if (labels.length > MAX_CHART_ITEMS) throw new Error("The chart limit of 100 items was exceeded.");
    if ((type === "pie" || type === "donut") && labels.length > 20) {
      throw new Error("Pie charts accept at most 20 items.");
    }
    if (!new Set(["bar", "line", "pie", "donut"]).has(type)) {
      throw new Error("Tipo suportado: bar, line, pie ou donut.");
    }
    const width = 800;
    const height = 460;
    const title = String(config.title || "Chart");
    const svg = svgElement("svg", {
      viewBox: `0 0 ${width} ${height}`,
      role: "img",
      "aria-label": title,
      class: `static-chart chart-${type}`,
    });
    const titleNode = svgElement("text", { x: 400, y: 30, class: "chart-title", "text-anchor": "middle" });
    titleNode.textContent = title;
    svg.appendChild(titleNode);

    if (type === "pie" || type === "donut") {
      const total = values.reduce((sum, value) => sum + Math.max(value, 0), 0);
      if (total <= 0) throw new Error("Charts circulares exigem valores positivos.");
      const cx = 275;
      const cy = 245;
      const radius = 150;
      let angle = -Math.PI / 2;
      values.forEach((rawValue, index) => {
        const value = Math.max(rawValue, 0);
        const next = angle + (value / total) * Math.PI * 2;
        const x1 = cx + Math.cos(angle) * radius;
        const y1 = cy + Math.sin(angle) * radius;
        const x2 = cx + Math.cos(next) * radius;
        const y2 = cy + Math.sin(next) * radius;
        const large = next - angle > Math.PI ? 1 : 0;
        const path = svgElement("path", {
          d: `M${cx},${cy} L${x1},${y1} A${radius},${radius} 0 ${large} 1 ${x2},${y2} Z`,
          class: `chart-series chart-series-${index % 8}`,
        });
        const label = svgElement("title");
        label.textContent = `${labels[index]}: ${rawValue}`;
        path.appendChild(label);
        svg.appendChild(path);
        angle = next;
      });
      if (type === "donut") {
        svg.appendChild(svgElement("circle", { cx, cy, r: 72, class: "chart-donut-hole" }));
      }
      labels.forEach((labelText, index) => {
        const y = 95 + index * 30;
        svg.appendChild(svgElement("rect", { x: 500, y: y - 13, width: 18, height: 18, class: `chart-series chart-series-${index % 8}` }));
        const label = svgElement("text", { x: 528, y: y + 1, class: "chart-label" });
        label.textContent = `${labelText}: ${values[index]}`;
        svg.appendChild(label);
      });
    } else {
      const left = 70;
      const right = 770;
      const top = 65;
      const bottom = 390;
      const minValue = Math.min(0, ...values);
      const maxValue = Math.max(0, ...values);
      const span = Math.max(maxValue - minValue, 1e-9);
      const yFor = (value) => bottom - ((value - minValue) / span) * (bottom - top);
      const zeroY = yFor(0);
      svg.appendChild(svgElement("line", { x1: left, y1: top, x2: left, y2: bottom, class: "chart-axis" }));
      svg.appendChild(svgElement("line", { x1: left, y1: zeroY, x2: right, y2: zeroY, class: "chart-axis" }));
      const step = (right - left) / labels.length;
      const points = [];
      labels.forEach((labelText, index) => {
        const center = left + step * index + step / 2;
        const y = yFor(values[index]);
        if (type === "bar") {
          const barTop = Math.min(y, zeroY);
          const barHeight = Math.max(Math.abs(zeroY - y), 1);
          const rect = svgElement("rect", {
            x: center - step * 0.32,
            y: barTop,
            width: step * 0.64,
            height: barHeight,
            class: `chart-series chart-series-${index % 8}`,
          });
          const tooltip = svgElement("title");
          tooltip.textContent = `${labelText}: ${values[index]}`;
          rect.appendChild(tooltip);
          svg.appendChild(rect);
        } else {
          points.push([center, y]);
        }
        const label = svgElement("text", { x: center, y: 420, class: "chart-label", "text-anchor": "middle" });
        label.textContent = labelText.length > 14 ? labelText.slice(0, 13) + "…" : labelText;
        svg.appendChild(label);
      });
      if (type === "line") {
        const polyline = svgElement("polyline", {
          points: points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" "),
          class: "chart-line",
          fill: "none",
        });
        svg.appendChild(polyline);
        points.forEach(([cx, cy], index) => {
          const point = svgElement("circle", { cx, cy, r: 5, class: `chart-series chart-series-${index % 8}` });
          const tooltip = svgElement("title");
          tooltip.textContent = `${labels[index]}: ${values[index]}`;
          point.appendChild(tooltip);
          svg.appendChild(point);
        });
      }
      const minLabel = svgElement("text", { x: 60, y: bottom + 4, class: "chart-value", "text-anchor": "end" });
      minLabel.textContent = String(minValue);
      svg.appendChild(minLabel);
      const maxLabel = svgElement("text", { x: 60, y: top + 4, class: "chart-value", "text-anchor": "end" });
      maxLabel.textContent = String(maxValue);
      svg.appendChild(maxLabel);
    }
    node.replaceChildren(svg);
    node.classList.add("diagram-rendered");
  }

  async function renderStaticDiagrams(errorSink) {
    let expected = 0;
    let completed = 0;
    let failed = 0;
    let fallback = 0;
    const jobs = [
      [".diagram-geojson", (node) => renderMap(node, "geojson"), "GeoJSON"],
      [".diagram-topojson", (node) => renderMap(node, "topojson"), "TopoJSON"],
      [".diagram-stl", renderStl, "STL"],
      [".diagram-chart", renderChart, "Chart"],
    ];
    for (const [selector, renderer, label] of jobs) {
      for (const node of document.querySelectorAll(selector)) {
        expected += 1;
        node.dataset.renderState = "loading";
        try {
          await Promise.resolve(renderer(node));
          node.dataset.renderState = "ready";
          completed += 1;
        } catch (error) {
          node.dataset.renderState = "error";
          node.classList.add("diagram-error");
          errorSink.push(label + ": " + String(error));
          failed += 1;
        }
      }
    }
    for (const node of document.querySelectorAll(".diagram-source-only")) {
      expected += 1;
      completed += 1;
      fallback += 1;
      node.dataset.renderState = "ready";
      const kind = node.dataset.diagramType || "diagrama";
      node.classList.add("diagram-fallback");
      errorSink.push(`${kind}: native rendering is unavailable; the source was preserved.`);
    }
    return { expected, completed, failed, fallback };
  }

  window.MarkdownPdfStaticDiagrams = { render: renderStaticDiagrams };
})();
