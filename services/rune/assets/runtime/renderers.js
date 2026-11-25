(() => {
  const decode = (element) => {
    const encoded = element.dataset.sourceBase64 || element.dataset.reactflowPayload;
    if (encoded) {
      const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    }
    return element.querySelector('script[type="application/json"]')?.textContent?.trim()
      || element.querySelector('.diagram-source')?.textContent?.trim()
      || '';
  };
  const set = (element, state, error) => {
    element.dataset.renderState = state;
    if (error) element.dataset.renderError = String(error);
  };
  const escapeXml = (value) => String(value ?? '').replace(/[<>&'\"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','\"':'&quot;'}[c]));

  async function renderMermaid(element) {
    if (!window.mermaid) throw new Error('Mermaid asset is not installed. Run scripts/install.');
    window.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
    await window.mermaid.run({ nodes: [element] });
  }

  async function renderMath(element) {
    if (!window.katex) throw new Error('KaTeX asset is not installed. Run scripts/install.');
    const source = element.textContent || '';
    window.katex.render(source, element, { throwOnError: false, displayMode: element.dataset.display !== 'false' });
  }



  function splitAttributes(source) {
    const values = [];
    let current = '', quoted = false, quote = '';
    for (const char of source) {
      if ((char === '"' || char === "'") && (!quoted || quote === char)) {
        quoted = !quoted; quote = quoted ? char : ''; current += char;
      } else if (char === ',' && !quoted) { if (current.trim()) values.push(current.trim()); current = ''; }
      else current += char;
    }
    if (current.trim()) values.push(current.trim());
    return values;
  }

  function parseValue(value) {
    const text = String(value ?? '').trim();
    if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) return text.slice(1, -1);
    if (/^(true|false)$/i.test(text)) return text.toLowerCase() === 'true';
    if (/^-?\d+(?:\.\d+)?$/.test(text)) return Number(text);
    return text;
  }

  function parseAttributes(source) {
    const result = {};
    for (const item of splitAttributes(source || '')) {
      const index = item.indexOf('=');
      if (index < 0) result[item] = true;
      else result[item.slice(0, index).trim()] = parseValue(item.slice(index + 1));
    }
    return result;
  }

  function ownershipAnalysis(entities, relations) {
    const active = relations.filter(r => r.kind === 'ownership' && r.status === 'active');
    const targets = new Set(active.map(r => r.target));
    const roots = entities.map(e => e.id).filter(id => !targets.has(id));
    const levels = Object.fromEntries(entities.map(e => [e.id, 0]));
    const outgoing = new Map();
    for (const relation of active) {
      if (!outgoing.has(relation.source)) outgoing.set(relation.source, []);
      outgoing.get(relation.source).push(relation.target);
    }
    const queue = roots.map(id => [id, 0]);
    const seen = new Set();
    while (queue.length) {
      const [id, level] = queue.shift();
      if (seen.has(`${id}:${level}`) || level > entities.length) continue;
      seen.add(`${id}:${level}`); levels[id] = Math.max(levels[id] || 0, level);
      for (const target of outgoing.get(id) || []) queue.push([target, level + 1]);
    }
    const connected = new Set([...active.flatMap(r => [r.source, r.target])]);
    return {
      roots,
      orphans: entities.map(e => e.id).filter(id => !connected.has(id)),
      levels,
      cycle: [],
      indirectStatus: 'disabled',
      indirectOwnership: [],
      entityCount: entities.length,
      relationCount: relations.length,
    };
  }

  function parseOwnershipDsl(source) {
    const chart = { title: 'Ownership chart', direction: 'down', ownershipValidation: 'partial', showEconomic: true, showVoting: false, showIndirect: false, showSecondary: false, edgeRouting: 'orthogonal', maxVisibleDepth: null, cycleSeverity: 'warning' };
    const entities = [], relations = [], groups = [], views = [], errors = [], warnings = [];
    let version = 1;
    const location = line => ({ line, column: 1, endLine: line, endColumn: 1 });
    const physicalLines = source.split(/\r?\n/);
    const lines = [];
    let buffer = '', bufferLine = 1, bracketDepth = 0;
    for (let offset = 0; offset < physicalLines.length; offset++) {
      const part = physicalLines[offset].trim();
      if (!buffer) bufferLine = offset + 1;
      buffer += (buffer ? ' ' : '') + part;
      bracketDepth += (part.match(/\[/g) || []).length - (part.match(/\]/g) || []).length;
      if (bracketDepth <= 0) { lines.push([bufferLine, buffer]); buffer = ''; bracketDepth = 0; }
    }
    if (buffer) lines.push([bufferLine, buffer]);
    for (const [lineNumber, rawLine] of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || line.startsWith('//')) continue;
      let match;
      if ((match = line.match(/^version\s+(\d+)$/i))) { version = Number(match[1]); continue; }
      if ((match = line.match(/^chart\s+"([^"]+)"\s*(?:\[(.*)\])?$/i))) {
        chart.title = match[1]; Object.assign(chart, parseAttributes(match[2])); continue;
      }
      if ((match = line.match(/^group\s+([\w.-]+)\s+"([^"]+)"\s*(?:\[(.*)\])?$/i))) {
        const attrs = parseAttributes(match[3]); groups.push({ id: match[1], name: match[2], kind: attrs.kind || null, parent: attrs.parent || null, attributes: attrs, sourceLocation: location(lineNumber) }); continue;
      }
      if ((match = line.match(/^entity\s+([\w.-]+)\s+"([^"]+)"\s*(?:\[(.*)\])?$/i))) {
        const attrs = parseAttributes(match[3]); entities.push({ id: match[1], name: match[2], kind: attrs.kind || 'company', subtype: attrs.subtype || null, country: attrs.country || null, registration: attrs.registration || null, role: attrs.role || null, group: attrs.group || null, attributes: attrs, sourceLocation: location(lineNumber) }); continue;
      }
      if ((match = line.match(/^([\w.-]+)\s*->\s*([\w.-]+)\s*(?:\[(.*)\])?$/))) {
        const attrs = parseAttributes(match[3]); relations.push({ id: attrs.id || `relation-${relations.length + 1}`, source: match[1], target: match[2], kind: attrs.relation || attrs.kind || 'ownership', economic: attrs.economic ?? null, voting: attrs.voting ?? null, shareClass: attrs.class || attrs.shareClass || null, label: attrs.label || null, effectiveFrom: attrs.effectiveFrom || null, effectiveTo: attrs.effectiveTo || null, status: attrs.status || 'active', notes: attrs.notes || null, attributes: attrs, sourceLocation: location(lineNumber) }); continue;
      }
      if ((match = line.match(/^view\s+"([^"]+)"\s*(?:\[(.*)\])?$/i))) {
        const attrs = parseAttributes(match[2]); views.push({ name: match[1], mode: attrs.mode || 'full', root: attrs.root || null, target: attrs.target || null, ancestors: attrs.ancestors ?? null, descendants: attrs.descendants ?? null, maxDepth: attrs.maxDepth ?? null, attributes: attrs }); continue;
      }
      warnings.push({ code: 'ownership.unrecognized-line', severity: 'warning', message: `Unrecognized line: ${line}`, location: location(lineNumber), relatedEntityIds: [] });
    }
    const ids = new Set(entities.map(e => e.id));
    for (const relation of relations) {
      if (!ids.has(relation.source) || !ids.has(relation.target)) errors.push({ code: 'ownership.unknown-entity', severity: 'error', message: `Relation ${relation.source} -> ${relation.target} references an unknown entity.`, location: relation.sourceLocation, relatedEntityIds: [relation.source, relation.target] });
    }
    if (!entities.length) errors.push({ code: 'ownership.no-entities', severity: 'error', message: 'No entity was declared.', location: location(1), relatedEntityIds: [] });
    const document = { version, chart, entities, relations, groups, views, analysis: ownershipAnalysis(entities, relations) };
    return { ok: errors.length === 0, document: errors.length ? null : document, errors, warnings };
  }

  function utf8Base64(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }

  async function renderOwnership(element, diagramIndex) {
    if (!window.MarkdownPdfOwnership) throw new Error('Ownership renderer is unavailable.');
    const source = decode(element);
    let payload;
    if (element.dataset.ownershipPayload) {
      const bytes = Uint8Array.from(atob(element.dataset.ownershipPayload), character => character.charCodeAt(0));
      payload = JSON.parse(new TextDecoder().decode(bytes));
    } else payload = parseOwnershipDsl(source);
    element.className = 'ownership-chart';
    element.dataset.ownershipPayload = utf8Base64(JSON.stringify(payload));
    element.innerHTML = `<figcaption>${escapeXml(payload.document?.chart?.title || 'Ownership chart')}</figcaption><div class="ownership-loading" role="status">Preparing ownership chart...</div><div class="ownership-toolbar" aria-label="Ownership chart controls"></div><div class="ownership-canvas" aria-label="Ownership chart"></div><details class="ownership-source-fallback"><summary>Ownership chart source</summary><pre><code>${escapeXml(source)}</code></pre></details>`;
    const result = await window.MarkdownPdfOwnership.renderFigure(element, diagramIndex);
    if (!result?.ok) throw new Error(result?.error || 'Ownership chart rendering failed.');
  }

  function prepareStatic(element) {
    const kind = element.dataset.kind || 'diagram';
    const classes = {
      geojson: 'diagram-geojson', map: 'diagram-geojson', leaflet: 'diagram-geojson',
      topojson: 'diagram-topojson', stl: 'diagram-stl', chart: 'diagram-chart', echarts: 'diagram-chart',
    };
    const targetClass = classes[kind];
    if (!targetClass) return false;
    element.classList.add('static-diagram', targetClass);
    element.innerHTML = `<pre>${escapeXml(decode(element))}</pre>`;
    return true;
  }

  function renderGeneric(element) {
    const kind = element.dataset.kind || 'diagram';
    const source = decode(element);
    element.innerHTML = `<figure class="rune-generic-diagram"><figcaption>${escapeXml(kind)}</figcaption><pre>${escapeXml(source)}</pre></figure>`;
  }

  window.__RUNE_RENDER_ALL__ = async () => {
    const failures = [];
    const mermaid = [...document.querySelectorAll('.mermaid[data-render-state]')];
    for (const element of mermaid) { try { set(element, 'loading'); await renderMermaid(element); set(element, 'ready'); } catch (e) { set(element, 'error', e); failures.push(e); } }
    const math = [...document.querySelectorAll('.rune-math[data-render-state]')];
    for (const element of math) { try { set(element, 'loading'); await renderMath(element); set(element, 'ready'); } catch (e) { set(element, 'error', e); failures.push(e); } }
    const diagrams = [...document.querySelectorAll('rune-diagram[data-render-state]')];
    let hasStatic = false;
    for (const [diagramIndex, element] of diagrams.entries()) {
      try {
        set(element, 'loading');
        if (element.dataset.kind === 'ownership-chart') { await renderOwnership(element, diagramIndex); }
        else if (prepareStatic(element)) { hasStatic = true; }
        else { renderGeneric(element); set(element, 'ready'); }
      } catch (e) { element.innerHTML = `<div class="rune-render-error">${escapeXml(e)}</div>`; set(element, 'error', e); failures.push(e); }
    }
    const reactFlowCount = document.querySelectorAll('.reactflow-document[data-reactflow-payload]').length;
    if (reactFlowCount) {
      try {
        if (!window.MarkdownPdfReactFlow) throw new Error('The local static React Flow renderer is unavailable.');
        const summary = await window.MarkdownPdfReactFlow.renderAll();
        if (summary.failed) failures.push(...summary.results.filter(item => item && !item.ok).map(item => new Error(item.error)));
      } catch (error) { failures.push(error); }
    }
    if (hasStatic) {
      if (!window.MarkdownPdfStaticDiagrams) failures.push(new Error('Static diagram renderer is unavailable.'));
      else {
        const staticErrors = [];
        const summary = await window.MarkdownPdfStaticDiagrams.render(staticErrors);
        if (summary.failed) failures.push(...staticErrors.map(value => new Error(value)));
      }
    }
    if (failures.length) throw new Error(failures.map(String).join('\n'));
  };
})();
