// app/lib/render.js
// SVG rendering helpers for the Command Auspex.
// Convention: 1 inch = 10 pixels.

import { baseDiameterPx, clusterOffsets } from './base-geometry.js';

export const INCH_PX = 10;

const SVG_NS = 'http://www.w3.org/2000/svg';

export function clearSvg(svg) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
}

export function setBoardSize(svg, widthIn, heightIn) {
  svg.setAttribute('width', widthIn * INCH_PX);
  svg.setAttribute('height', heightIn * INCH_PX);
  svg.setAttribute('viewBox', `0 0 ${widthIn * INCH_PX} ${heightIn * INCH_PX}`);
}

export function renderBoard(svg, mission) {
  clearSvg(svg);
  const { width_in, height_in } = mission.board;
  setBoardSize(svg, width_in, height_in);

  // background (always visible, not in a togglable layer)
  const bg = document.createElementNS(SVG_NS, 'rect');
  bg.setAttribute('x', 0);
  bg.setAttribute('y', 0);
  bg.setAttribute('width', width_in * INCH_PX);
  bg.setAttribute('height', height_in * INCH_PX);
  bg.setAttribute('fill', '#0f1413');
  bg.setAttribute('stroke', '#3a8a4d');
  bg.setAttribute('stroke-width', '2');
  svg.appendChild(bg);

  // Radial auspex sweep — slow rotating phosphor line emanating from board center.
  const sweep = document.createElementNS(SVG_NS, 'g');
  sweep.setAttribute('id', 'layer-auspex-sweep');
  sweep.style.pointerEvents = 'none';
  const cxSw = (width_in * INCH_PX) / 2;
  const cySw = (height_in * INCH_PX) / 2;
  const maxR = Math.hypot(cxSw, cySw);
  const sweepLine = document.createElementNS(SVG_NS, 'line');
  sweepLine.setAttribute('x1', cxSw); sweepLine.setAttribute('y1', cySw);
  sweepLine.setAttribute('x2', cxSw + maxR); sweepLine.setAttribute('y2', cySw);
  sweepLine.setAttribute('stroke', '#6fff8e');
  sweepLine.setAttribute('stroke-width', '1');
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

  // grid (in its own layer)
  const gridLayer = document.createElementNS(SVG_NS, 'g');
  gridLayer.setAttribute('id', 'layer-grid');
  for (let x = 10; x < width_in; x += 10) {
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', x * INCH_PX); line.setAttribute('x2', x * INCH_PX);
    line.setAttribute('y1', 0); line.setAttribute('y2', height_in * INCH_PX);
    line.setAttribute('stroke', 'rgba(111,255,142,0.15)');
    line.setAttribute('stroke-width', '0.8');
    gridLayer.appendChild(line);
  }
  for (let y = 10; y < height_in; y += 10) {
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('y1', y * INCH_PX); line.setAttribute('y2', y * INCH_PX);
    line.setAttribute('x1', 0); line.setAttribute('x2', width_in * INCH_PX);
    line.setAttribute('stroke', 'rgba(111,255,142,0.15)');
    line.setAttribute('stroke-width', '0.8');
    gridLayer.appendChild(line);
  }
  svg.appendChild(gridLayer);

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
  poly.setAttribute('points', vertices.map(([x, y]) => `${x * INCH_PX},${y * INCH_PX}`).join(' '));
  poly.setAttribute('fill', fill);
  poly.setAttribute('stroke', stroke);
  poly.setAttribute('stroke-width', '1.5');
  if (dashed) poly.setAttribute('stroke-dasharray', '4 3');
  parent.appendChild(poly);
}

function drawSegment(parent, [[x1, y1], [x2, y2]], stroke, width) {
  const line = document.createElementNS(SVG_NS, 'line');
  line.setAttribute('x1', x1 * INCH_PX); line.setAttribute('y1', y1 * INCH_PX);
  line.setAttribute('x2', x2 * INCH_PX); line.setAttribute('y2', y2 * INCH_PX);
  line.setAttribute('stroke', stroke);
  line.setAttribute('stroke-width', width);
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

export function makeUnitDraggable(group, onDragEnd) {
  let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
  group.style.cursor = 'grab';
  group.addEventListener('mousedown', (e) => {
    dragging = true;
    sx = e.clientX; sy = e.clientY;
    const transform = group.transform.baseVal.consolidate();
    [ox, oy] = transform ? [transform.matrix.e, transform.matrix.f] : [0, 0];
    group.style.cursor = 'grabbing';
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    group.setAttribute('transform', `translate(${ox + dx}, ${oy + dy})`);
  });
  window.addEventListener('mouseup', (e) => {
    if (!dragging) return;
    dragging = false;
    group.style.cursor = 'grab';
    const transform = group.transform.baseVal.consolidate();
    onDragEnd?.(transform ? [transform.matrix.e, transform.matrix.f] : [0, 0]);
  });
}

export function renderThreatRanges(svg, placements) {
  const layer = svg.querySelector('#layer-threat');
  if (!layer) return;
  while (layer.firstChild) layer.removeChild(layer.firstChild);
  for (const p of placements) {
    const range = p.datasheet?.max_range_in;
    if (!range || range === 0) continue;
    const [cx, cy] = [p.centerIn[0] * INCH_PX, p.centerIn[1] * INCH_PX];
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', cx);
    circle.setAttribute('cy', cy);
    circle.setAttribute('r', range * INCH_PX);
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', p.role === 'attacker' ? '#ff5d6c' : '#6fff8e');
    circle.setAttribute('stroke-width', '0.8');
    circle.setAttribute('stroke-dasharray', '3 3');
    circle.setAttribute('opacity', '0.45');
    layer.appendChild(circle);
  }
}

function renderUnit({ unit, datasheet, centerIn, role }) {
  const color = role === 'attacker' ? '#ff5d6c' : '#6fff8e';
  const fill  = role === 'attacker' ? 'rgba(255,93,108,0.6)' : 'rgba(111,255,142,0.55)';

  const group = document.createElementNS(SVG_NS, 'g');
  group.setAttribute('class', `unit unit-${role}`);
  group.dataset.unitName = unit.name;

  const defaultMm = datasheet?.base?.diameter_mm ?? 32;
  const perModel = datasheet?.base?.per_model ?? null;

  const [cx, cy] = [centerIn[0] * INCH_PX, centerIn[1] * INCH_PX];

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

  models.forEach((m, i) => {
    const isSergeant = (i === 0);
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', cx + offsets[i][0]);
    circle.setAttribute('cy', cy + offsets[i][1]);
    circle.setAttribute('r', baseDiameterPx(m.mm) / 2);
    circle.setAttribute('fill', fill);
    circle.setAttribute('stroke', color);
    circle.setAttribute('stroke-width', isSergeant ? 2 : 1);
    group.appendChild(circle);
  });

  return group;
}
