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
export function renderUnits(svg, placements) {
  // Remove any existing unit group
  const old = svg.querySelector('#layer-units');
  if (old) old.remove();

  const layer = document.createElementNS(SVG_NS, 'g');
  layer.setAttribute('id', 'layer-units');
  svg.appendChild(layer);

  for (const p of placements) {
    const group = renderUnit(p);
    makeUnitDraggable(group);
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

function renderUnit({ unit, datasheet, centerIn, role }) {
  const color = role === 'attacker' ? '#ff5d6c' : '#6fff8e';
  const fill  = role === 'attacker' ? 'rgba(255,93,108,0.6)' : 'rgba(111,255,142,0.55)';

  const group = document.createElementNS(SVG_NS, 'g');
  group.setAttribute('class', `unit unit-${role}`);
  group.dataset.unitName = unit.name;

  const baseMm = datasheet?.base?.diameter_mm ?? 32;
  const basePx = baseDiameterPx(baseMm);
  const r = basePx / 2;

  const [cx, cy] = [centerIn[0] * INCH_PX, centerIn[1] * INCH_PX];

  const models = [];
  for (const sub of unit.models) {
    for (let k = 0; k < sub.count; k++) {
      models.push({ sub });
    }
  }
  const offsets = clusterOffsets(models.length, basePx);

  models.forEach((m, i) => {
    const isSergeant = (i === 0);
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', cx + offsets[i][0]);
    circle.setAttribute('cy', cy + offsets[i][1]);
    circle.setAttribute('r', r);
    circle.setAttribute('fill', fill);
    circle.setAttribute('stroke', color);
    circle.setAttribute('stroke-width', isSergeant ? 2 : 1);
    group.appendChild(circle);
  });

  return group;
}
