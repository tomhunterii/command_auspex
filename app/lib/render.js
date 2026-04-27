// app/lib/render.js
// SVG rendering helpers for the Command Auspex.
// Convention: SVG user unit = 1 inch. All coordinates are in inches.

import { baseDiameterPx, clusterOffsets } from './base-geometry.js';

// Filler words skipped when computing character initials.
const LABEL_FILLERS = new Set(['the', 'of', 'and', 'a', 'an']);

/**
 * Derive a short label string for a single model circle.
 *
 * Rules:
 *  - Single-model units → '' (no label; don't clutter vehicles / solo heroes).
 *  - submodelCount > 1 → numbered within submodel scope (1, 2, 3…).
 *    Prefix with first letter of submodel name when the unit has >1 distinct
 *    submodels so e.g. Sergeant + Tactical Marines read "S1" vs "1,2,3…".
 *  - submodelCount == 1, multi-word name → initials of non-filler words, max 3.
 *  - submodelCount == 1, single-word name → first letter only.
 */
export function modelLabel({ submodelName, indexInSubmodel, submodelCount, totalUnitModels, distinctSubmodelNames }) {
  if (totalUnitModels <= 1) return '';
  if (submodelCount > 1) {
    const prefix = distinctSubmodelNames > 1
      ? (submodelName?.[0]?.toUpperCase() ?? '') : '';
    return `${prefix}${indexInSubmodel + 1}`;
  }
  if (!submodelName) return '';
  const words = submodelName.split(/\s+/).filter(w => w && !LABEL_FILLERS.has(w.toLowerCase()));
  if (words.length === 0) return '';
  if (words.length === 1) return words[0][0].toUpperCase();
  return words.slice(0, 3).map(w => w[0].toUpperCase()).join('');
}

// INCH_PX is kept as 1 so all "pixel" math reduces to inches directly.
export const INCH_PX = 1;

const SVG_NS = 'http://www.w3.org/2000/svg';

export function clearSvg(svg) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
}

// Padding around the board edge so ruler labels are visible.
const RULER_PAD = 1.5;

export function setBoardSize(svg, widthIn, heightIn) {
  // Width/height attributes removed — CSS controls sizing (width:100%; height:auto).
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  const vbX = -RULER_PAD;
  const vbY = -RULER_PAD;
  const vbW = widthIn + RULER_PAD * 2;
  const vbH = heightIn + RULER_PAD * 2;
  svg.setAttribute('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
}

export function renderBoard(svg, mission) {
  clearSvg(svg);
  const { width_in, height_in } = mission.board;
  setBoardSize(svg, width_in, height_in);

  // background (always visible, not in a togglable layer)
  const bg = document.createElementNS(SVG_NS, 'rect');
  bg.setAttribute('x', 0);
  bg.setAttribute('y', 0);
  bg.setAttribute('width', width_in);
  bg.setAttribute('height', height_in);
  bg.setAttribute('fill', '#0f1413');
  bg.setAttribute('stroke', '#3a8a4d');
  bg.setAttribute('stroke-width', '0.12');
  svg.appendChild(bg);

  // Radial auspex sweep — slow rotating phosphor line emanating from board center.
  const sweep = document.createElementNS(SVG_NS, 'g');
  sweep.setAttribute('id', 'layer-auspex-sweep');
  sweep.style.pointerEvents = 'none';
  const cxSw = width_in / 2;
  const cySw = height_in / 2;
  const maxR = Math.hypot(cxSw, cySw);
  const sweepLine = document.createElementNS(SVG_NS, 'line');
  sweepLine.setAttribute('x1', cxSw); sweepLine.setAttribute('y1', cySw);
  sweepLine.setAttribute('x2', cxSw + maxR); sweepLine.setAttribute('y2', cySw);
  sweepLine.setAttribute('stroke', '#6fff8e');
  sweepLine.setAttribute('stroke-width', '0.1');
  sweepLine.setAttribute('opacity', '0.25');
  const animT = document.createElementNS(SVG_NS, 'animateTransform');
  animT.setAttribute('attributeName', 'transform');
  animT.setAttribute('type', 'rotate');
  animT.setAttribute('from', `0 ${cxSw} ${cySw}`);
  animT.setAttribute('to', `360 ${cxSw} ${cySw}`);
  animT.setAttribute('dur', '8s');
  animT.setAttribute('repeatCount', 'indefinite');
  sweepLine.appendChild(animT);
  sweep.appendChild(sweepLine);
  svg.appendChild(sweep);

  // 1″ grid with accent lines every 6″
  const gridLayer = document.createElementNS(SVG_NS, 'g');
  gridLayer.setAttribute('id', 'layer-grid');
  gridLayer.setAttribute('pointer-events', 'none');
  for (let x = 0; x <= width_in; x++) {
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', x); line.setAttribute('y1', 0);
    line.setAttribute('x2', x); line.setAttribute('y2', height_in);
    line.setAttribute('stroke', x % 6 === 0 ? 'rgba(111,255,142,0.25)' : 'rgba(111,255,142,0.08)');
    line.setAttribute('stroke-width', x % 6 === 0 ? '0.04' : '0.02');
    gridLayer.appendChild(line);
  }
  for (let y = 0; y <= height_in; y++) {
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', 0); line.setAttribute('y1', y);
    line.setAttribute('x2', width_in); line.setAttribute('y2', y);
    line.setAttribute('stroke', y % 6 === 0 ? 'rgba(111,255,142,0.25)' : 'rgba(111,255,142,0.08)');
    line.setAttribute('stroke-width', y % 6 === 0 ? '0.04' : '0.02');
    gridLayer.appendChild(line);
  }
  svg.appendChild(gridLayer);

  // Edge rulers — labels every 6″ along all four edges
  const rulerGroup = document.createElementNS(SVG_NS, 'g');
  rulerGroup.setAttribute('id', 'layer-ruler');
  rulerGroup.setAttribute('pointer-events', 'none');
  rulerGroup.setAttribute('font-family', "'JetBrains Mono', monospace");
  rulerGroup.setAttribute('fill', 'var(--phosphor-dim)');
  rulerGroup.setAttribute('font-size', '0.8');
  rulerGroup.setAttribute('font-weight', '700');
  for (let x = 6; x < width_in; x += 6) {
    for (const yPos of [-0.5, height_in + 0.8]) {
      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('x', x); text.setAttribute('y', yPos);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'central');
      text.textContent = String(x);
      rulerGroup.appendChild(text);
    }
  }
  for (let y = 6; y < height_in; y += 6) {
    for (const xPos of [-0.8, width_in + 0.8]) {
      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('x', xPos); text.setAttribute('y', y);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'central');
      text.textContent = String(y);
      rulerGroup.appendChild(text);
    }
  }
  svg.appendChild(rulerGroup);

  // deployment zones
  const zonesLayer = document.createElementNS(SVG_NS, 'g');
  zonesLayer.setAttribute('id', 'layer-deployment');
  (mission.deployment?.attacker?.polygons ?? []).forEach(p =>
    drawPolygon(zonesLayer, p.vertices, 'rgba(255,93,108,0.25)', '#ff5d6c')
  );
  (mission.deployment?.defender?.polygons ?? []).forEach(p =>
    drawPolygon(zonesLayer, p.vertices, 'rgba(111,255,142,0.22)', '#6fff8e')
  );
  svg.appendChild(zonesLayer);

  // battlefield edges
  const edgesLayer = document.createElementNS(SVG_NS, 'g');
  edgesLayer.setAttribute('id', 'layer-edges');
  (mission.battlefield_edges?.attacker ?? []).forEach(e =>
    drawSegment(edgesLayer, e.segment, '#ff5d6c', 6)
  );
  (mission.battlefield_edges?.defender ?? []).forEach(e =>
    drawSegment(edgesLayer, e.segment, '#6fff8e', 6)
  );
  svg.appendChild(edgesLayer);

  // scoring zones
  const scoringLayer = document.createElementNS(SVG_NS, 'g');
  scoringLayer.setAttribute('id', 'layer-scoring');
  (mission.scoring?.objectives ?? []).forEach(obj => {
    if (obj.scoring_zone?.polygon) {
      drawPolygon(scoringLayer, obj.scoring_zone.polygon, 'rgba(255,179,71,0.07)', '#ffb347', { dashed: true });
    }
  });
  svg.appendChild(scoringLayer);

  // threat ranges layer (hidden by default; populated by renderThreatRanges in Task 16)
  const threatLayer = document.createElementNS(SVG_NS, 'g');
  threatLayer.setAttribute('id', 'layer-threat');
  threatLayer.style.display = 'none';
  svg.appendChild(threatLayer);

  // coherency layer (debug; hidden by default)
  const coherencyLayer = document.createElementNS(SVG_NS, 'g');
  coherencyLayer.setAttribute('id', 'layer-coherency');
  coherencyLayer.style.display = 'none';
  svg.appendChild(coherencyLayer);
}

function drawPolygon(parent, vertices, fill, stroke, { dashed = false } = {}) {
  const poly = document.createElementNS(SVG_NS, 'polygon');
  poly.setAttribute('points', vertices.map(([x, y]) => `${x},${y}`).join(' '));
  poly.setAttribute('fill', fill);
  poly.setAttribute('stroke', stroke);
  poly.setAttribute('stroke-width', '0.12');
  if (dashed) poly.setAttribute('stroke-dasharray', '0.4 0.3');
  parent.appendChild(poly);
}

function drawSegment(parent, [[x1, y1], [x2, y2]], stroke, widthIn) {
  const line = document.createElementNS(SVG_NS, 'line');
  line.setAttribute('x1', x1); line.setAttribute('y1', y1);
  line.setAttribute('x2', x2); line.setAttribute('y2', y2);
  line.setAttribute('stroke', stroke);
  line.setAttribute('stroke-width', widthIn * 0.1); // convert old px-width to inches
  line.setAttribute('stroke-linecap', 'round');
  parent.appendChild(line);
}

/**
 * Render units as per-model bases. `placements` is an array of:
 *   { unit, datasheet, centerIn: [x, y], role: 'attacker'|'defender' }
 */
export function renderUnits(svg, placements, onDragEnd) {
  // Remove any existing unit group
  const old = svg.querySelector('#layer-units');
  if (old) old.remove();

  const layer = document.createElementNS(SVG_NS, 'g');
  layer.setAttribute('id', 'layer-units');
  svg.appendChild(layer);

  for (const p of placements) {
    const group = renderUnit(p);
    makeUnitDraggable(group, onDragEnd);
    layer.appendChild(group);
  }
}

/**
 * Convert a CSS-pixel point to SVG user units (inches) via the SVG's CTM.
 * Falls back to identity if getScreenCTM is unavailable (e.g. in Node tests).
 */
function clientToSvgPoint(svg, clientX, clientY) {
  if (!svg || typeof svg.getScreenCTM !== 'function') return [clientX, clientY];
  const ctm = svg.getScreenCTM();
  if (!ctm) return [clientX, clientY];
  const inv = ctm.inverse();
  const pt = svg.createSVGPoint();
  pt.x = clientX; pt.y = clientY;
  const svgPt = pt.matrixTransform(inv);
  return [svgPt.x, svgPt.y];
}

export function makeUnitDraggable(group, onDragEnd) {
  let dragging = false;
  let startSvg = [0, 0]; // mouse-down position in SVG user units
  let ox = 0, oy = 0;   // group origin (translate) at mouse-down
  // Track whether the pointer moved enough to be considered a drag.
  // The model-circle click handler reads group.__dragged to skip toggle on drag-end.
  group.__dragged = false;
  group.style.cursor = 'grab';
  group.addEventListener('mousedown', (e) => {
    dragging = true;
    group.__dragged = false;
    const svg = group.ownerSVGElement;
    startSvg = clientToSvgPoint(svg, e.clientX, e.clientY);
    const transform = group.transform.baseVal.consolidate();
    [ox, oy] = transform ? [transform.matrix.e, transform.matrix.f] : [0, 0];
    group.style.cursor = 'grabbing';
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const svg = group.ownerSVGElement;
    const [curX, curY] = clientToSvgPoint(svg, e.clientX, e.clientY);
    const dx = curX - startSvg[0], dy = curY - startSvg[1];
    if (Math.hypot(dx, dy) > 0.3) group.__dragged = true; // 0.3" threshold
    group.setAttribute('transform', `translate(${ox + dx}, ${oy + dy})`);
  });
  window.addEventListener('mouseup', (e) => {
    if (!dragging) return;
    dragging = false;
    group.style.cursor = 'grab';
    const transform = group.transform.baseVal.consolidate();
    onDragEnd?.(transform ? [transform.matrix.e, transform.matrix.f] : [0, 0]);
    // Reset the drag flag after a short delay so the click event (which fires
    // after mouseup) can still read it before we clear it.
    setTimeout(() => { group.__dragged = false; }, 50);
  });
}

export function renderThreatRanges(svg, placements) {
  const layer = svg.querySelector('#layer-threat');
  if (!layer) return;
  while (layer.firstChild) layer.removeChild(layer.firstChild);
  for (const p of placements) {
    // Prefer per-weapon ranges; fall back to legacy max_range_in (single ring).
    const ranges = (p.datasheet?.ranges_in?.length ?? 0) > 0
      ? p.datasheet.ranges_in
      : (p.datasheet?.max_range_in ? [p.datasheet.max_range_in] : []);
    if (ranges.length === 0) continue;
    const [cx, cy] = [p.centerIn[0], p.centerIn[1]];
    const stroke = p.role === 'attacker' ? '#ff5d6c' : '#6fff8e';
    for (const range of ranges) {
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('cx', cx);
      circle.setAttribute('cy', cy);
      circle.setAttribute('r', range);
      circle.setAttribute('fill', 'none');
      circle.setAttribute('stroke', stroke);
      circle.setAttribute('stroke-width', '0.06');
      circle.setAttribute('stroke-dasharray', '0.3 0.3');
      circle.setAttribute('opacity', '0.35');
      layer.appendChild(circle);
    }
  }
}

function renderUnit({ unit, datasheet, centerIn, role }) {
  const color = role === 'attacker' ? '#ff5d6c' : '#6fff8e';
  const fill  = role === 'attacker' ? 'rgba(255,93,108,0.6)' : 'rgba(111,255,142,0.55)';

  const group = document.createElementNS(SVG_NS, 'g');
  group.setAttribute('class', `unit unit-${role}`);
  group.dataset.unitName = unit.name;

  // Derive bare slug (e.g. 'aggressor-squad') from the datasheet field
  // ('space-marines/aggressor-squad') so it matches the unitsBySlug cache key.
  const rawDs = unit.datasheet ?? '';
  const unitSlug = rawDs.includes('/') ? rawDs.split('/').pop() : rawDs;
  group.dataset.unitSlug = unitSlug;

  const defaultMm = datasheet?.base?.diameter_mm ?? 32;
  const perModel = datasheet?.base?.per_model ?? null;

  const [cx, cy] = [centerIn[0], centerIn[1]];

  // Flatten to per-model list. When the datasheet enumerates per-model bases
  // (e.g., Wardens of Ultramar: 2 × 40mm + 4 × 28.5mm), each submodel carries
  // its own diameter; otherwise every model uses the unit's default.
  const models = [];
  for (const sub of unit.models) {
    const match = perModel?.find(pm => pm.submodel === sub.submodel);
    const mm = match?.diameter_mm ?? defaultMm;
    for (let k = 0; k < sub.count; k++) {
      models.push({ sub, mm });
    }
  }

  // Cluster spacing uses the largest base so smaller bases never collide.
  const maxMm = models.reduce((m, x) => Math.max(m, x.mm), defaultMm);
  const offsets = clusterOffsets(models.length, baseDiameterPx(maxMm));

  // Pre-compute label context values once for this unit.
  const totalUnitModels = models.length;
  const distinctSubmodelNames = new Set(unit.models.map(m => m.submodel)).size;
  // Track per-submodel iteration index for numbering.
  const submodelCounters = new Map();

  models.forEach((m, i) => {
    const isSergeant = (i === 0);
    const circleCx = cx + offsets[i][0];
    const circleCy = cy + offsets[i][1];
    const r = baseDiameterPx(m.mm) / 2;

    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', circleCx);
    circle.setAttribute('cy', circleCy);
    circle.setAttribute('r', r);
    circle.setAttribute('fill', fill);
    circle.setAttribute('stroke', color);
    circle.setAttribute('stroke-width', isSergeant ? 0.12 : 0.06);
    circle.classList.add('model-circle');
    circle.dataset.unitSlug = unitSlug;
    circle.dataset.modelIdx = String(i);
    group.appendChild(circle);

    // --- Model label ---
    const subName = m.sub.submodel;
    const subCount = m.sub.count;
    // Determine within-submodel index for this circle.
    const subIdx = submodelCounters.get(subName) ?? 0;
    submodelCounters.set(subName, subIdx + 1);

    const label = modelLabel({
      submodelName: subName,
      indexInSubmodel: subIdx,
      submodelCount: subCount,
      totalUnitModels,
      distinctSubmodelNames,
    });

    if (label) {
      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('x', String(circleCx));
      text.setAttribute('y', String(circleCy));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'central');
      text.setAttribute('font-family', "'JetBrains Mono', monospace");
      text.setAttribute('font-weight', '700');
      // font-size in inches: clamp between 0.35" and 0.8" (≈ 3.5–8px at 10px/in reference)
      const fontSize = Math.max(0.35, Math.min(0.8, r * 0.55));
      text.setAttribute('font-size', String(fontSize));
      text.setAttribute('fill', 'var(--phosphor)');
      text.setAttribute('pointer-events', 'none');
      text.classList.add('model-label');
      text.dataset.unitSlug = unitSlug;
      text.dataset.modelIdx = String(i);
      text.textContent = label;
      group.appendChild(text);

      // Hover tooltip — full submodel name.
      const titleEl = document.createElementNS(SVG_NS, 'title');
      titleEl.textContent = subName;
      circle.appendChild(titleEl);
    }
  });

  return group;
}
