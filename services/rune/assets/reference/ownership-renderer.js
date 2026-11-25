(function (global) {
  'use strict';

  const DEFAULT_ZOOM = 1;
  const MIN_ZOOM = 0.45;
  const MAX_ZOOM = 2.2;
  const ZOOM_STEP = 0.15;
  const NODE_WIDTH = 220;
  const NODE_HEIGHT = 96;
  const HORIZONTAL_GAP = 58;
  const VERTICAL_GAP = 175;
  const MARGIN_X = 56;
  const MARGIN_TOP = 34;
  const MARGIN_BOTTOM = 52;

  const relationLabels = {
    ownership: 'Ownership',
    'indirect-ownership': 'Indirect ownership',
    control: 'Controle',
    management: 'Gestao',
    contract: 'Contrato',
    'board-seat': 'Assento no conselho',
    nominee: 'Nominee',
    option: 'Opcao',
  };

  function decodePayload(value) {
    return JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(value), (character) => character.charCodeAt(0)),
      ),
    );
  }

  function xmlEscape(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function isOwnershipKind(kind) {
    return kind === 'ownership' || kind === 'indirect-ownership';
  }

  function isDirectOwnership(relation) {
    return relation.kind === 'ownership' && relation.status === 'active';
  }

  function formatPercent(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '';
    return Number.isInteger(number)
      ? String(number)
      : number.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  }

  function entityKindLabel(entity) {
    const subtype = String(entity.subtype || '').replace(/[-_]+/g, ' ').trim();
    if (subtype) return subtype.toUpperCase();
    return ({
      person: 'INDIVIDUAL',
      company: 'COMPANY',
      fund: 'FUND',
      foundation: 'FUNDACAO',
      trust: 'TRUST',
      government: 'GOVERNO',
      pool: 'POOL',
    })[entity.kind] || String(entity.kind || 'ENTIDADE').toUpperCase();
  }

  function entityClass(entity) {
    const kind = String(entity.kind || 'company').replace(/[^a-z0-9_-]/gi, '-');
    return `ownership-node ownership-node-${kind}`;
  }

  function wrapText(value, maxLength, maxLines) {
    const words = String(value || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [''];
    const lines = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length <= maxLength || !line) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
      if (lines.length === maxLines - 1) break;
    }
    if (line && lines.length < maxLines) lines.push(line);
    const consumed = lines.join(' ').length;
    const original = words.join(' ');
    if (consumed < original.length && lines.length) {
      const index = lines.length - 1;
      lines[index] = `${lines[index].slice(0, Math.max(1, maxLength - 1)).trimEnd()}...`;
    }
    return lines.slice(0, maxLines);
  }

  function descendantsOf(id, relations) {
    const outgoing = new Map();
    relations.filter(isDirectOwnership).forEach((relation) => {
      if (!outgoing.has(relation.source)) outgoing.set(relation.source, []);
      outgoing.get(relation.source).push(relation.target);
    });
    const seen = new Set();
    const queue = [id];
    while (queue.length) {
      const current = queue.shift();
      for (const target of outgoing.get(current) || []) {
        if (!seen.has(target)) {
          seen.add(target);
          queue.push(target);
        }
      }
    }
    return seen;
  }

  function ancestorsOf(id, relations) {
    const incoming = new Map();
    relations.filter(isDirectOwnership).forEach((relation) => {
      if (!incoming.has(relation.target)) incoming.set(relation.target, []);
      incoming.get(relation.target).push(relation.source);
    });
    const seen = new Set();
    const queue = [id];
    while (queue.length) {
      const current = queue.shift();
      for (const source of incoming.get(current) || []) {
        if (!seen.has(source)) {
          seen.add(source);
          queue.push(source);
        }
      }
    }
    return seen;
  }

  function viewSet(view, documentModel) {
    if (!view || view.mode === 'full') return new Set(documentModel.entities.map((entity) => entity.id));
    const id = view.root || view.target;
    if (!id) return new Set(documentModel.entities.map((entity) => entity.id));
    const result = new Set([id]);
    if (view.descendants === 'all' || view.mode === 'participations') {
      descendantsOf(id, documentModel.relations).forEach((item) => result.add(item));
    }
    if (view.ancestors === 'all' || view.mode === 'ultimate-beneficiaries' || view.mode === 'shareholders') {
      ancestorsOf(id, documentModel.relations).forEach((item) => result.add(item));
    }
    return result;
  }

  function searchContext(query, documentModel) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return null;
    const matches = documentModel.entities.filter((entity) =>
      `${entity.id} ${entity.name} ${entity.registration || ''} ${entity.role || ''}`
        .toLowerCase()
        .includes(normalized),
    );
    if (!matches.length) return new Set();
    const result = new Set();
    for (const entity of matches) {
      result.add(entity.id);
      ancestorsOf(entity.id, documentModel.relations).forEach((item) => result.add(item));
      descendantsOf(entity.id, documentModel.relations).forEach((item) => result.add(item));
    }
    return result;
  }

  function filterModel(documentModel, state) {
    let ids = viewSet(state.view, documentModel);
    const searchIds = searchContext(state.search, documentModel);
    if (searchIds) ids = new Set([...ids].filter((id) => searchIds.has(id)));

    let entities = documentModel.entities.filter((entity) => ids.has(entity.id));
    const depthLimit = state.view?.maxDepth != null
      ? state.view.maxDepth
      : documentModel.chart.maxVisibleDepth;
    if (depthLimit != null) {
      entities = entities.filter(
        (entity) => (documentModel.analysis?.levels?.[entity.id] ?? 0) <= Number(depthLimit),
      );
    }
    if (state.group) entities = entities.filter((entity) => entity.group === state.group);
    if (state.country) entities = entities.filter((entity) => entity.country === state.country);

    const visible = new Set(entities.map((entity) => entity.id));
    let relations = documentModel.relations.filter((relation) =>
      visible.has(relation.source) &&
      visible.has(relation.target) &&
      (!state.relation || relation.kind === state.relation) &&
      (state.showSecondary || isOwnershipKind(relation.kind) || Boolean(state.relation)) &&
      (!isOwnershipKind(relation.kind) || (relation.economic || 0) >= state.minimum),
    );

    if (state.showIndirect && documentModel.analysis?.indirectStatus === 'available') {
      relations = relations.concat(
        (documentModel.analysis.indirectOwnership || []).filter((relation) =>
          visible.has(relation.source) &&
          visible.has(relation.target) &&
          relation.economic >= state.minimum,
        ),
      );
    }
    return { entities, relations };
  }

  function relationStrength(relation) {
    const voting = Number(relation.voting);
    const economic = Number(relation.economic);
    return (Number.isFinite(voting) ? voting : Number.isFinite(economic) ? economic : 0) * 1000
      + (Number.isFinite(economic) ? economic : 0);
  }

  function choosePrimaryRelations(entities, relations) {
    const ids = new Set(entities.map((entity) => entity.id));
    const direct = relations.filter((relation) =>
      isDirectOwnership(relation) && ids.has(relation.source) && ids.has(relation.target),
    );
    const incoming = new Map();
    for (const relation of direct) {
      if (!incoming.has(relation.target)) incoming.set(relation.target, []);
      incoming.get(relation.target).push(relation);
    }
    for (const list of incoming.values()) {
      list.sort((left, right) => relationStrength(right) - relationStrength(left) || left.source.localeCompare(right.source));
    }

    const primaryByTarget = new Map();
    function wouldCreateCycle(source, target) {
      let current = source;
      const seen = new Set([target]);
      while (current) {
        if (seen.has(current)) return true;
        seen.add(current);
        current = primaryByTarget.get(current)?.source;
      }
      return false;
    }

    const targets = [...incoming.keys()].sort();
    for (const target of targets) {
      for (const relation of incoming.get(target) || []) {
        if (!wouldCreateCycle(relation.source, target)) {
          primaryByTarget.set(target, relation);
          break;
        }
      }
    }

    const additionalByTarget = new Map();
    for (const [target, list] of incoming.entries()) {
      const primary = primaryByTarget.get(target);
      const additional = list.filter((relation) => !primary || relation.id !== primary.id);
      if (additional.length) additionalByTarget.set(target, additional);
    }
    return { direct, primaryByTarget, additionalByTarget };
  }

  function layoutModel(documentModel, entities, relations) {
    const entityById = new Map(entities.map((entity) => [entity.id, entity]));
    const selected = choosePrimaryRelations(entities, relations);
    const children = new Map(entities.map((entity) => [entity.id, []]));
    for (const relation of selected.primaryByTarget.values()) {
      if (children.has(relation.source)) children.get(relation.source).push(relation.target);
    }
    for (const list of children.values()) {
      list.sort((left, right) => String(entityById.get(left)?.name || left).localeCompare(String(entityById.get(right)?.name || right)));
    }

    const referenceOnly = new Set(entities
      .filter((entity) => !selected.primaryByTarget.has(entity.id)
        && !(children.get(entity.id) || []).length
        && selected.direct.some((relation) => relation.source === entity.id)
        && !relations.some((relation) =>
          !isDirectOwnership(relation)
          && (relation.source === entity.id || relation.target === entity.id),
        ))
      .map((entity) => entity.id));
    const roots = entities
      .filter((entity) => !selected.primaryByTarget.has(entity.id) && !referenceOnly.has(entity.id))
      .map((entity) => entity.id)
      .sort((left, right) => String(entityById.get(left)?.name || left).localeCompare(String(entityById.get(right)?.name || right)));
    if (!roots.length && entities.length) roots.push(entities[0].id);

    const COOWNER_WIDTH = 168;
    const COOWNER_GAP = 12;
    const TREE_GAP = 48;
    const widthMemo = new Map();
    const visiting = new Set();

    function ownBlockWidth(id) {
      const count = selected.additionalByTarget.get(id)?.length || 0;
      return Math.max(NODE_WIDTH, count ? count * COOWNER_WIDTH + (count - 1) * COOWNER_GAP : NODE_WIDTH);
    }

    function subtreeWidth(id) {
      if (widthMemo.has(id)) return widthMemo.get(id);
      if (visiting.has(id)) return ownBlockWidth(id);
      visiting.add(id);
      const childIds = children.get(id) || [];
      const childWidth = childIds.length
        ? childIds.reduce((total, childId) => total + subtreeWidth(childId), 0) + (childIds.length - 1) * TREE_GAP
        : 0;
      const value = Math.max(ownBlockWidth(id), childWidth, NODE_WIDTH);
      visiting.delete(id);
      widthMemo.set(id, value);
      return value;
    }

    const forestWidth = roots.reduce((total, id) => total + subtreeWidth(id), 0)
      + Math.max(0, roots.length - 1) * TREE_GAP;
    const width = Math.max(NODE_WIDTH + MARGIN_X * 2, forestWidth + MARGIN_X * 2);
    const nodes = [];
    const nodeById = new Map();
    let maxDepth = 0;

    function place(id, left, depth) {
      const totalWidth = subtreeWidth(id);
      const centerX = left + totalWidth / 2;
      const entity = entityById.get(id);
      if (!entity) return;
      const node = {
        id,
        entity,
        level: depth,
        x: centerX - NODE_WIDTH / 2,
        y: MARGIN_TOP + depth * (NODE_HEIGHT + VERTICAL_GAP),
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        centerX,
      };
      nodes.push(node);
      nodeById.set(id, node);
      maxDepth = Math.max(maxDepth, depth);
      const childIds = children.get(id) || [];
      if (!childIds.length) return;
      const childTotal = childIds.reduce((total, childId) => total + subtreeWidth(childId), 0)
        + (childIds.length - 1) * TREE_GAP;
      let cursor = left + (totalWidth - childTotal) / 2;
      for (const childId of childIds) {
        place(childId, cursor, depth + 1);
        cursor += subtreeWidth(childId) + TREE_GAP;
      }
    }

    let cursor = MARGIN_X;
    for (const root of roots) {
      place(root, cursor, 0);
      cursor += subtreeWidth(root) + TREE_GAP;
    }
    for (const entity of entities) {
      if (!nodeById.has(entity.id) && !referenceOnly.has(entity.id)) {
        place(entity.id, cursor, 0);
        cursor += subtreeWidth(entity.id) + TREE_GAP;
      }
    }

    const height = MARGIN_TOP + (maxDepth + 1) * NODE_HEIGHT + maxDepth * VERTICAL_GAP + MARGIN_BOTTOM;
    const primaryRelations = [...selected.primaryByTarget.values()];
    const primaryChildren = new Map();
    for (const relation of primaryRelations) {
      if (!primaryChildren.has(relation.source)) primaryChildren.set(relation.source, []);
      primaryChildren.get(relation.source).push(relation);
    }
    for (const list of primaryChildren.values()) {
      list.sort((left, right) => (nodeById.get(left.target)?.centerX || 0) - (nodeById.get(right.target)?.centerX || 0));
    }

    return {
      width,
      height,
      nodes,
      nodeById,
      roots,
      primaryRelations,
      primaryChildren,
      additionalByTarget: selected.additionalByTarget,
      coOwnerWidth: COOWNER_WIDTH,
      coOwnerGap: COOWNER_GAP,
      entityById,
      referenceOnly,
    };
  }

  function relationLines(relation, showEconomic, showVoting) {
    const lines = [];
    if (isOwnershipKind(relation.kind)) {
      const percentages = [];
      if (showEconomic && relation.economic != null) percentages.push(`E ${formatPercent(relation.economic)}%`);
      if (showVoting && relation.voting != null) percentages.push(`V ${formatPercent(relation.voting)}%`);
      if (!percentages.length && relation.voting != null) percentages.push(`V ${formatPercent(relation.voting)}%`);
      if (percentages.length) lines.push(percentages.join(' / '));
      if (relation.shareClass) lines.push(String(relation.shareClass));
      if (relation.label) lines.push(String(relation.label));
    } else {
      lines.push(relationLabels[relation.kind] || relation.kind);
      if (relation.label) lines.push(String(relation.label));
    }
    if (relation.status && relation.status !== 'active') lines.push(String(relation.status));
    return lines.slice(0, 3);
  }

  function labelMarkup(lines, x, y, relationId, cssClass) {
    if (!lines.length) return '';
    const longest = Math.max(...lines.map((line) => String(line).length));
    const width = Math.max(48, Math.min(176, longest * 5.65 + 16));
    const height = lines.length * 12 + 9;
    const left = x - width / 2;
    const top = y - height / 2;
    const tspans = lines.map((line, index) =>
      `<tspan x="${x.toFixed(1)}" dy="${index === 0 ? '0' : '12'}">${xmlEscape(line)}</tspan>`,
    ).join('');
    return `<g class="ownership-edge-label ${cssClass}" data-label-for="${xmlEscape(relationId)}">`
      + `<rect x="${left.toFixed(1)}" y="${top.toFixed(1)}" width="${width.toFixed(1)}" height="${height.toFixed(1)}" rx="4"/>`
      + `<text x="${x.toFixed(1)}" y="${(top + 12).toFixed(1)}" text-anchor="middle">${tspans}</text></g>`;
  }

  function nodeMarkup(node) {
    const entity = node.entity;
    const nameLines = wrapText(entity.name, 29, 2);
    const detail = entity.role || entity.registration || entity.group || '';
    const country = entity.country ? String(entity.country).toUpperCase() : '';
    const radius = entity.kind === 'person' ? 18 : 5;
    const titleY = nameLines.length === 1 ? 47 : 40;
    const nameText = nameLines.map((line, index) =>
      `<tspan x="${(node.width / 2).toFixed(1)}" dy="${index === 0 ? '0' : '15'}">${xmlEscape(line)}</tspan>`,
    ).join('');
    const detailY = titleY + (nameLines.length - 1) * 15 + 20;
    return `<g class="${entityClass(entity)}" data-entity-id="${xmlEscape(entity.id)}" transform="translate(${node.x.toFixed(1)} ${node.y.toFixed(1)})">`
      + `<title>${xmlEscape(entity.name)}</title>`
      + `<rect class="ownership-node-card" width="${node.width}" height="${node.height}" rx="${radius}"/>`
      + `<rect class="ownership-node-accent" width="${node.width}" height="5" rx="${Math.min(radius, 5)}"/>`
      + `<text class="ownership-node-kind" x="14" y="21">${xmlEscape(entityKindLabel(entity))}</text>`
      + (country ? `<g class="ownership-country"><rect x="${node.width - 43}" y="10" width="30" height="18" rx="9"/><text x="${node.width - 28}" y="23" text-anchor="middle">${xmlEscape(country)}</text></g>` : '')
      + `<text class="ownership-node-name" x="${node.width / 2}" y="${titleY}" text-anchor="middle">${nameText}</text>`
      + (detail ? `<text class="ownership-node-detail" x="${node.width / 2}" y="${detailY}" text-anchor="middle">${xmlEscape(String(detail).slice(0, 44))}</text>` : '')
      + '</g>';
  }

  function coOwnerChipMarkup(layout, target, relation, index, count, showEconomic, showVoting) {
    const owner = layout.entityById.get(relation.source);
    const width = layout.coOwnerWidth;
    const height = 44;
    const totalWidth = count * width + Math.max(0, count - 1) * layout.coOwnerGap;
    const left = target.centerX - totalWidth / 2 + index * (width + layout.coOwnerGap);
    const top = target.y - 82;
    const centerX = left + width / 2;
    const ownerName = wrapText(owner?.name || relation.source, 28, 1)[0];
    const detail = relationLines(relation, showEconomic, showVoting).slice(0, 2).join(' - ');
    const markup = `<g class="ownership-coowner" data-entity-ref="${xmlEscape(relation.source)}" transform="translate(${left.toFixed(1)} ${top.toFixed(1)})">`
      + `<title>${xmlEscape(owner?.name || relation.source)}: ${xmlEscape(detail)}</title>`
      + `<rect width="${width}" height="${height}" rx="5"/>`
      + `<text class="ownership-coowner-name" x="${width / 2}" y="17" text-anchor="middle">${xmlEscape(ownerName)}</text>`
      + `<text class="ownership-coowner-detail" x="${width / 2}" y="33" text-anchor="middle">${xmlEscape(detail)}</text></g>`;
    return { markup, centerX, bottomY: top + height };
  }

  function directEdgesMarkup(layout, relations, showEconomic, showVoting) {
    const paths = [];
    const buses = [];
    const labels = [];
    const chips = [];

    for (const [parentId, childRelations] of layout.primaryChildren.entries()) {
      const parent = layout.nodeById.get(parentId);
      if (!parent || !childRelations.length) continue;
      const parentCenter = parent.centerX;
      const parentBottom = parent.y + parent.height;
      const fanoutY = parentBottom + 32;
      const childCenters = childRelations
        .map((relation) => layout.nodeById.get(relation.target)?.centerX)
        .filter(Number.isFinite);
      if (!childCenters.length) continue;
      const minX = Math.min(parentCenter, ...childCenters);
      const maxX = Math.max(parentCenter, ...childCenters);
      buses.push(`<path class="ownership-bus ownership-primary-bus" d="M ${parentCenter.toFixed(1)} ${parentBottom.toFixed(1)} V ${fanoutY.toFixed(1)} M ${minX.toFixed(1)} ${fanoutY.toFixed(1)} H ${maxX.toFixed(1)}"/>`);

      for (const relation of childRelations) {
        const child = layout.nodeById.get(relation.target);
        if (!child) continue;
        const childBusY = child.y - 22;
        paths.push(`<path class="ownership-edge ownership-edge-direct" data-relation-id="${xmlEscape(relation.id)}" d="M ${child.centerX.toFixed(1)} ${fanoutY.toFixed(1)} V ${childBusY.toFixed(1)}"/>`);
        const labelY = fanoutY + Math.min(38, Math.max(24, (childBusY - fanoutY) * 0.3));
        labels.push(labelMarkup(relationLines(relation, showEconomic, showVoting), child.centerX, labelY, relation.id, 'ownership-label-direct'));
      }
    }

    for (const target of layout.nodes) {
      const primary = layout.primaryRelations.find((relation) => relation.target === target.id);
      const additional = layout.additionalByTarget.get(target.id) || [];
      if (!primary && !additional.length) continue;
      const targetBusY = target.y - 22;
      const chipItems = additional.map((relation, index) =>
        ({ relation, ...coOwnerChipMarkup(layout, target, relation, index, additional.length, showEconomic, showVoting) }),
      );
      const endpoints = [target.centerX, ...chipItems.map((item) => item.centerX)];
      const minX = Math.min(...endpoints);
      const maxX = Math.max(...endpoints);
      buses.push(`<path class="ownership-bus ownership-target-bus" d="M ${minX.toFixed(1)} ${targetBusY.toFixed(1)} H ${maxX.toFixed(1)} M ${target.centerX.toFixed(1)} ${targetBusY.toFixed(1)} V ${target.y.toFixed(1)}"/>`);
      buses.push(`<path class="ownership-target-arrow" d="M ${(target.centerX - 3.2).toFixed(1)} ${(target.y - 6).toFixed(1)} L ${target.centerX.toFixed(1)} ${target.y.toFixed(1)} L ${(target.centerX + 3.2).toFixed(1)} ${(target.y - 6).toFixed(1)} Z"/>`);
      for (const item of chipItems) {
        paths.push(`<path class="ownership-edge ownership-edge-coowner" data-relation-id="${xmlEscape(item.relation.id)}" d="M ${item.centerX.toFixed(1)} ${item.bottomY.toFixed(1)} V ${targetBusY.toFixed(1)}"/>`);
        chips.push(item.markup);
      }
    }

    return { paths, buses, labels, chips };
  }

  function secondaryRelationsPanelMarkup(layout, relations, showEconomic, showVoting) {
    const secondary = relations.filter((relation) => !isDirectOwnership(relation));
    if (!secondary.length) return { markup: '', height: 0 };

    const columns = layout.width >= 980 ? 2 : 1;
    const columnGap = 22;
    const panelX = MARGIN_X;
    const panelWidth = layout.width - MARGIN_X * 2;
    const columnWidth = (panelWidth - (columns - 1) * columnGap) / columns;
    const rowHeight = 50;
    const headerHeight = 48;
    const rows = Math.ceil(secondary.length / columns);
    const panelHeight = headerHeight + rows * rowHeight + 18;
    const top = layout.height + 18;
    const parts = [
      `<g class="ownership-secondary-panel" transform="translate(${panelX.toFixed(1)} ${top.toFixed(1)})">`,
      `<rect class="ownership-secondary-panel-bg" width="${panelWidth.toFixed(1)}" height="${panelHeight.toFixed(1)}" rx="6"/>`,
      '<text class="ownership-secondary-title" x="16" y="22">RELACOES COMPLEMENTARES</text>',
      '<text class="ownership-secondary-subtitle" x="16" y="38">Controle, gestao, conselho, opcoes e participacoes indiretas — sem alterar a arvore societaria direta.</text>',
    ];

    secondary.forEach((relation, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = column * (columnWidth + columnGap);
      const y = headerHeight + row * rowHeight;
      const source = layout.entityById.get(relation.source);
      const target = layout.entityById.get(relation.target);
      const sourceName = wrapText(source?.name || relation.source, 25, 1)[0];
      const targetName = wrapText(target?.name || relation.target, 25, 1)[0];
      const details = relationLines(relation, showEconomic, showVoting).join(' · ');
      const kind = relationLabels[relation.kind] || relation.kind;
      const centerY = y + 22;
      const leftTextX = x + 12;
      const rightTextX = x + columnWidth - 12;
      const lineStart = x + columnWidth * 0.34;
      const lineEnd = x + columnWidth * 0.66;
      parts.push(
        `<g class="ownership-secondary-row ownership-secondary-${xmlEscape(relation.kind)}" data-relation-id="${xmlEscape(relation.id)}">`,
        `<rect class="ownership-secondary-row-bg" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${columnWidth.toFixed(1)}" height="42" rx="4"/>`,
        `<text class="ownership-secondary-entity" x="${leftTextX.toFixed(1)}" y="${(centerY - 4).toFixed(1)}">${xmlEscape(sourceName)}</text>`,
        `<text class="ownership-secondary-kind" x="${((lineStart + lineEnd) / 2).toFixed(1)}" y="${(centerY - 8).toFixed(1)}" text-anchor="middle">${xmlEscape(kind)}</text>`,
        `<path class="ownership-secondary-mini-edge" marker-end="url(#ownership-small-arrow)" d="M ${lineStart.toFixed(1)} ${centerY.toFixed(1)} H ${lineEnd.toFixed(1)}"/>`,
        `<text class="ownership-secondary-entity" x="${rightTextX.toFixed(1)}" y="${(centerY - 4).toFixed(1)}" text-anchor="end">${xmlEscape(targetName)}</text>`,
        `<text class="ownership-secondary-detail" x="${(x + columnWidth / 2).toFixed(1)}" y="${(centerY + 12).toFixed(1)}" text-anchor="middle">${xmlEscape(details)}</text>`,
        '</g>',
      );
    });
    parts.push('</g>');
    return { markup: parts.join(''), height: panelHeight + 36 };
  }

  function renderSvgString(documentModel, entities, relations, options) {
    const settings = options || {};
    const layout = layoutModel(documentModel, entities, relations);
    const showEconomic = documentModel.chart.showEconomic !== false;
    const showVoting = Boolean(settings.showVoting);
    const direct = directEdgesMarkup(layout, relations, showEconomic, showVoting);
    const secondary = secondaryRelationsPanelMarkup(layout, relations, showEconomic, showVoting);
    const nodes = layout.nodes.map(nodeMarkup).join('');
    const title = xmlEscape(documentModel.chart.title || 'Ownership chart');
    const finalHeight = layout.height + secondary.height;
    const style = '<style>'
      + '.ownership-tree-bg{fill:#fff}.ownership-edge,.ownership-bus{fill:none;stroke:#64748b;stroke-width:1.2;stroke-linecap:square;stroke-linejoin:miter}.ownership-bus{stroke:#475569}.ownership-target-arrow{fill:#475569}.ownership-edge-coowner{stroke:#94a3b8}.ownership-edge-secondary{stroke:#7c3aed;stroke-dasharray:5 4}.ownership-edge-indirect{stroke:#0f766e;stroke-dasharray:4 4}.ownership-edge-label rect{fill:#fff;stroke:#cbd5e1;stroke-width:.8}.ownership-edge-label text{font:600 9.5px Inter,Segoe UI,Arial,sans-serif;fill:#334155}.ownership-coowner rect{fill:#f8fafc;stroke:#94a3b8;stroke-width:.9}.ownership-coowner-name{font:700 9.5px Inter,Segoe UI,Arial,sans-serif;fill:#0f172a}.ownership-coowner-detail{font:600 8.5px Inter,Segoe UI,Arial,sans-serif;fill:#475569}.ownership-node-card{fill:#fff;stroke:#64748b;stroke-width:1.15}.ownership-node-accent{fill:#475569}.ownership-node-person .ownership-node-accent{fill:#2563eb}.ownership-node-fund .ownership-node-accent{fill:#7c3aed}.ownership-node-trust .ownership-node-accent,.ownership-node-foundation .ownership-node-accent{fill:#0f766e}.ownership-node-kind{font:700 9px Inter,Segoe UI,Arial,sans-serif;letter-spacing:.7px;fill:#64748b}.ownership-node-name{font:700 12px Inter,Segoe UI,Arial,sans-serif;fill:#0f172a}.ownership-node-detail{font:400 9.5px Inter,Segoe UI,Arial,sans-serif;fill:#64748b}.ownership-country rect{fill:#f1f5f9;stroke:#cbd5e1;stroke-width:.7}.ownership-country text{font:700 8.5px Inter,Segoe UI,Arial,sans-serif;fill:#334155}.ownership-secondary-panel-bg{fill:#f8fafc;stroke:#cbd5e1;stroke-width:1}.ownership-secondary-title{font:700 10px Inter,Segoe UI,Arial,sans-serif;letter-spacing:.8px;fill:#334155}.ownership-secondary-subtitle{font:400 9px Inter,Segoe UI,Arial,sans-serif;fill:#64748b}.ownership-secondary-row-bg{fill:#fff;stroke:#e2e8f0;stroke-width:.8}.ownership-secondary-entity{font:600 9px Inter,Segoe UI,Arial,sans-serif;fill:#0f172a}.ownership-secondary-kind{font:700 8px Inter,Segoe UI,Arial,sans-serif;fill:#7c3aed}.ownership-secondary-detail{font:400 8px Inter,Segoe UI,Arial,sans-serif;fill:#64748b}.ownership-secondary-mini-edge{fill:none;stroke:#7c3aed;stroke-width:1;stroke-dasharray:4 3}'
      + '</style>';
    return `<svg xmlns="http://www.w3.org/2000/svg" class="ownership-formal-svg" viewBox="0 0 ${layout.width.toFixed(1)} ${finalHeight.toFixed(1)}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${title}">`
      + `<title>${title}</title><desc>${entities.length} entidades e ${relations.length} relacoes.</desc>${style}`
      + '<defs><marker id="ownership-small-arrow" viewBox="0 0 6 6" refX="5.5" refY="3" markerWidth="5" markerHeight="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 L6 3 L0 6 Z" fill="#7c3aed"/></marker></defs>'
      + `<rect class="ownership-tree-bg" width="${layout.width.toFixed(1)}" height="${finalHeight.toFixed(1)}"/>`
      + `<g class="ownership-tree-edges">${direct.paths.join('')}${direct.buses.join('')}</g>`
      + `<g class="ownership-tree-labels">${direct.labels.join('')}</g>`
      + `<g class="ownership-tree-coowners">${direct.chips.join('')}</g>`
      + `<g class="ownership-tree-nodes">${nodes}</g>${secondary.markup}</svg>`;
  }

  function parseSvg(svgText) {
    const parsed = new DOMParser().parseFromString(String(svgText), 'image/svg+xml');
    if (parsed.querySelector('parsererror')) throw new Error('The ownership renderer produced invalid SVG.');
    return document.importNode(parsed.documentElement, true);
  }

  function validateRenderedSvg(svg, entities, relations) {
    const entityIds = new Set([...svg.querySelectorAll('[data-entity-id],[data-entity-ref]')]
      .map((element) => element.getAttribute('data-entity-id') || element.getAttribute('data-entity-ref'))
      .filter(Boolean));
    const entityCount = entityIds.size;
    const relationCount = svg.querySelectorAll('[data-relation-id]').length;
    if (entityCount !== entities.length) {
      throw new Error(`O SVG contem ${entityCount} de ${entities.length} entidades esperadas.`);
    }
    if (relationCount !== relations.length) {
      throw new Error(`O SVG contem ${relationCount} de ${relations.length} relacoes esperadas.`);
    }
    const values = String(svg.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
    if (values.length !== 4 || values.some((value) => !Number.isFinite(value)) || values[2] <= 0 || values[3] <= 0) {
      throw new Error('The ownership SVG does not have a valid viewBox.');
    }
  }

  function cloneForPrint(svg, entities, relations) {
    const clone = svg.cloneNode(true);
    clone.classList.add('ownership-print-svg');
    clone.removeAttribute('width');
    clone.removeAttribute('height');
    clone.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    clone.dataset.nodeCount = String(entities.length);
    clone.dataset.edgeCount = String(relations.length);
    return clone;
  }

  async function nextFrames(count) {
    for (let index = 0; index < (count || 2); index += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }

  async function waitStable(element) {
    let previous = '';
    let stable = 0;
    for (let iteration = 0; iteration < 60; iteration += 1) {
      await nextFrames(1);
      const rect = element.getBoundingClientRect();
      const current = `${Math.round(rect.width)}x${Math.round(rect.height)}:${element.querySelectorAll('svg').length}`;
      if (current === previous && rect.width > 0 && rect.height > 0) stable += 1;
      else stable = 0;
      previous = current;
      if (stable >= 3) return true;
    }
    return false;
  }

  function exportSvg(svg, title) {
    const content = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([content], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${String(title || 'ownership-chart').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'ownership-chart'}.svg`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function control(tag, attributes, children) {
    const element = document.createElement(tag);
    Object.entries(attributes || {}).forEach(([key, value]) => {
      if (key === 'className') element.className = value;
      else if (key === 'text') element.textContent = value;
      else if (key === 'checked') element.checked = Boolean(value);
      else if (key === 'value') element.value = value;
      else element.setAttribute(key, value);
    });
    (children || []).forEach((child) => element.appendChild(child));
    return element;
  }

  function option(value, text) {
    return control('option', { value, text });
  }

  function checkbox(labelText, checked, onChange) {
    const input = control('input', { type: 'checkbox', checked });
    input.addEventListener('change', () => onChange(input.checked));
    return control('label', { className: 'ownership-toggle' }, [input, document.createTextNode(labelText)]);
  }

  function debounce(callback, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => callback(...args), delay);
    };
  }

  async function renderFigure(figure, index) {
    if (figure.dataset.renderState === 'ready') return { ok: true };
    figure.dataset.renderState = 'loading';
    figure.dataset.printState = 'loading';
    figure.dataset.ownershipIndex = String(index || 0);

    let payload;
    try {
      payload = decodePayload(figure.dataset.ownershipPayload || '');
    } catch (error) {
      figure.dataset.renderState = 'error';
      figure.dataset.printState = 'error';
      figure.querySelector('.ownership-loading').textContent = 'Invalid ownership payload.';
      return { ok: false, error: String(error) };
    }
    if (!payload.ok || !payload.document) {
      const errors = (payload.errors || []).map((item) => `${item.code}: ${item.message}`).join('; ');
      figure.dataset.renderState = 'error';
      figure.dataset.printState = 'error';
      figure.querySelector('.ownership-loading').textContent = errors || 'Invalid ownership chart.';
      return { ok: false, error: errors || 'invalid ownership chart' };
    }

    const documentModel = payload.document;
    const views = [{ name: 'Completo', mode: 'full' }, ...(documentModel.views || [])];
    const groups = [...new Set(documentModel.entities.map((entity) => entity.group).filter(Boolean))].sort();
    const countries = [...new Set(documentModel.entities.map((entity) => entity.country).filter(Boolean))].sort();
    const hiddenSecondaryCount = documentModel.relations.filter((relation) => !isOwnershipKind(relation.kind)).length;
    const state = {
      search: '', relation: '', minimum: 0, view: views[0], group: '', country: '',
      showVoting: Boolean(documentModel.chart.showVoting),
      showSecondary: Boolean(documentModel.chart.showSecondary),
      showIndirect: Boolean(documentModel.chart.showIndirect),
      zoom: DEFAULT_ZOOM,
    };

    const host = figure.querySelector('.ownership-canvas');
    host.replaceChildren();
    host.classList.add('ownership-formal-host');
    const toolbar = control('div', { className: 'ownership-controls' });
    const viewport = control('div', { className: 'ownership-formal-viewport' });
    const canvas = control('div', { className: 'ownership-formal-canvas' });
    const empty = control('div', { className: 'ownership-empty', text: 'Organizando estrutura societaria...' });
    const summary = control('div', { className: 'ownership-summary' });
    const printSnapshot = control('div', { className: 'ownership-print-snapshot', 'data-print-state': 'loading' });
    viewport.appendChild(canvas);
    host.append(toolbar, viewport, summary, printSnapshot);

    let currentSvg = null;
    let generation = 0;

    function applyZoom() {
      canvas.style.width = `${Math.round(state.zoom * 100)}%`;
      if (currentSvg) {
        currentSvg.style.width = '100%';
        currentSvg.style.height = 'auto';
      }
    }

    async function refresh() {
      const ownGeneration = ++generation;
      figure.dataset.renderState = 'loading';
      figure.dataset.printState = 'loading';
      empty.hidden = false;
      empty.textContent = 'Organizando entidades, niveis e participacoes...';
      canvas.replaceChildren(empty);
      printSnapshot.replaceChildren();
      printSnapshot.dataset.printState = 'loading';

      try {
        const filtered = filterModel(documentModel, state);
        if (!filtered.entities.length) {
          empty.textContent = 'Nenhuma entidade corresponde aos filtros atuais.';
          summary.textContent = '0 entidades - 0 relacoes';
          figure.dataset.renderState = 'ready';
          figure.dataset.printState = 'ready';
          return { entities: 0, relations: 0 };
        }
        const svg = parseSvg(renderSvgString(documentModel, filtered.entities, filtered.relations, { showVoting: state.showVoting }));
        if (ownGeneration !== generation) return null;
        validateRenderedSvg(svg, filtered.entities, filtered.relations);
        canvas.replaceChildren(svg);
        currentSvg = svg;
        applyZoom();

        const printSvg = cloneForPrint(svg, filtered.entities, filtered.relations);
        printSnapshot.replaceChildren(printSvg);
        printSnapshot.dataset.printState = 'ready';
        summary.textContent = `${filtered.entities.length} entidades - ${filtered.relations.length} relacoes${!state.showSecondary && hiddenSecondaryCount ? ` - ${hiddenSecondaryCount} secundarias ocultas` : ''}`;

        if (document.fonts?.ready) await document.fonts.ready;
        await nextFrames(3);
        if (!await waitStable(canvas)) throw new Error('The ownership chart did not become visually stable.');
        figure.dataset.renderState = 'ready';
        figure.dataset.printState = 'ready';
        figure.dataset.renderSummary = JSON.stringify({
          entities: filtered.entities.length,
          relations: filtered.relations.length,
          renderer: 'native-ownership-tree-svg',
        });
        return { entities: filtered.entities.length, relations: filtered.relations.length };
      } catch (error) {
        if (ownGeneration !== generation) return null;
        const message = error instanceof Error ? error.message : String(error);
        figure.dataset.renderState = 'error';
        figure.dataset.printState = 'error';
        empty.hidden = false;
        empty.textContent = `Ownership chart rendering failed: ${message}`;
        printSnapshot.dataset.printState = 'error';
        throw error;
      }
    }

    const search = control('input', { type: 'search', placeholder: 'Pesquisar entidade...', 'aria-label': 'Pesquisar entidade' });
    search.addEventListener('input', debounce(() => { state.search = search.value; refresh().catch(() => {}); }, 250));
    toolbar.appendChild(search);

    const relation = control('select', { 'aria-label': 'Filtrar relacao' }, [
      option('', 'Participacoes societarias'),
      ...['ownership', 'control', 'management', 'contract', 'board-seat', 'nominee', 'option'].map((kind) => option(kind, relationLabels[kind] || kind)),
    ]);
    relation.addEventListener('change', () => { state.relation = relation.value; refresh().catch(() => {}); });
    toolbar.appendChild(relation);

    const minimum = control('input', { type: 'number', min: '0', max: '100', step: '0.1', value: '0', title: 'Percentual economico minimo', 'aria-label': 'Percentual economico minimo' });
    minimum.className = 'ownership-minimum';
    minimum.addEventListener('change', () => { state.minimum = Number(minimum.value) || 0; refresh().catch(() => {}); });
    toolbar.appendChild(minimum);

    const view = control('select', { 'aria-label': 'Selecionar visao' }, views.map((item) => option(item.name, item.name)));
    view.addEventListener('change', () => { state.view = views.find((item) => item.name === view.value) || views[0]; refresh().catch(() => {}); });
    toolbar.appendChild(view);

    if (groups.length) {
      const group = control('select', { 'aria-label': 'Filtrar grupo' }, [option('', 'Todos os grupos'), ...groups.map((item) => option(item, item))]);
      group.addEventListener('change', () => { state.group = group.value; refresh().catch(() => {}); });
      toolbar.appendChild(group);
    }
    if (countries.length) {
      const country = control('select', { 'aria-label': 'Filtrar pais' }, [option('', 'Todos os paises'), ...countries.map((item) => option(item, item))]);
      country.addEventListener('change', () => { state.country = country.value; refresh().catch(() => {}); });
      toolbar.appendChild(country);
    }

    toolbar.appendChild(checkbox('Voto', state.showVoting, (value) => { state.showVoting = value; refresh().catch(() => {}); }));
    toolbar.appendChild(checkbox('Outras relacoes', state.showSecondary, (value) => { state.showSecondary = value; refresh().catch(() => {}); }));
    if (documentModel.analysis?.indirectStatus === 'available') {
      toolbar.appendChild(checkbox('Indiretas', state.showIndirect, (value) => { state.showIndirect = value; refresh().catch(() => {}); }));
    }

    const zoomOut = control('button', { type: 'button', text: '-', title: 'Reduzir zoom', 'aria-label': 'Reduzir zoom' });
    zoomOut.addEventListener('click', () => { state.zoom = Math.max(MIN_ZOOM, state.zoom - ZOOM_STEP); applyZoom(); });
    const fit = control('button', { type: 'button', text: 'Ajustar', title: 'Ajustar a largura' });
    fit.addEventListener('click', () => { state.zoom = DEFAULT_ZOOM; applyZoom(); viewport.scrollTo({ left: 0, top: 0, behavior: 'smooth' }); });
    const zoomIn = control('button', { type: 'button', text: '+', title: 'Aumentar zoom', 'aria-label': 'Aumentar zoom' });
    zoomIn.addEventListener('click', () => { state.zoom = Math.min(MAX_ZOOM, state.zoom + ZOOM_STEP); applyZoom(); });
    toolbar.append(zoomOut, fit, zoomIn);

    const exportButton = control('button', { type: 'button', text: 'Exportar SVG' });
    exportButton.addEventListener('click', () => { if (currentSvg) exportSvg(currentSvg, documentModel.chart.title); });
    toolbar.appendChild(exportButton);

    try {
      const result = await refresh();
      return { ok: true, ...result };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async function renderAll() {
    const figures = [...document.querySelectorAll('.ownership-chart[data-ownership-payload]')];
    const results = [];
    for (let index = 0; index < figures.length; index += 1) {
      results.push(await renderFigure(figures[index], index));
    }
    return {
      expected: figures.length,
      completed: results.filter((item) => item.ok).length,
      failed: results.filter((item) => !item.ok).length,
      results,
    };
  }

  async function prepareForPrint() {
    const figures = [...document.querySelectorAll('.ownership-chart[data-ownership-payload]')];
    if (document.fonts?.ready) await document.fonts.ready;
    await nextFrames(3);
    const results = figures.map((figure) => {
      const svg = figure.querySelector('.ownership-print-svg');
      const rect = svg?.getBoundingClientRect();
      const viewBox = svg?.getAttribute('viewBox');
      const nodes = Number(svg?.dataset.nodeCount || 0);
      const edges = Number(svg?.dataset.edgeCount || 0);
      const renderedNodes = svg ? new Set([...svg.querySelectorAll('[data-entity-id],[data-entity-ref]')]
        .map((element) => element.getAttribute('data-entity-id') || element.getAttribute('data-entity-ref'))
        .filter(Boolean)).size : 0;
      const renderedEdges = svg?.querySelectorAll('[data-relation-id]').length || 0;
      const ok = Boolean(
        svg && figure.dataset.printState === 'ready' && viewBox && rect && rect.width > 0 && rect.height > 0
        && nodes === renderedNodes && edges === renderedEdges,
      );
      figure.dataset.printState = ok ? 'ready' : 'error';
      return {
        ok,
        width: Math.round(rect?.width || 0),
        height: Math.round(rect?.height || 0),
        nodes,
        edges,
        error: ok ? undefined : 'o SVG completo de impressao esta ausente ou incompleto',
      };
    });
    await nextFrames(2);
    return {
      expected: figures.length,
      completed: results.filter((item) => item.ok).length,
      failed: results.filter((item) => !item.ok).length,
      results,
    };
  }

  global.MarkdownPdfOwnership = {
    renderAll,
    renderFigure,
    prepareForPrint,
    renderSvgString,
    layoutModel,
    filterModel,
  };
})(typeof window !== 'undefined' ? window : globalThis);
