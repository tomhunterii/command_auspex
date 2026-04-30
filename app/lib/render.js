// app/lib/render.js
// SVG rendering helpers for the Command Auspex.
// Convention: SVG user unit = 1 inch. All coordinates are in inches.

import { baseDiameterPx, clusterOffsets, formationOffsets } from './base-geometry.js';
import { parseMovement } from './movement.js';

// Movement-line color thresholds.
const MOVE_COLOR_GUARANTEED = '#6fff8e'; // green
const MOVE_COLOR_VARIABLE   = '#ffb347'; // amber
const MOVE_COLOR_OVER       = '#ff5d6c'; // red

// Codex Astartes role markings for Space Marine model circles.
// Per the 10th-edition unit role classification.
const SM_ROLE_CLOSE_SUPPORT_SLUGS = /^(assault[\-_]intercessor|inceptor|reiver|vanguard|bladeguard|jump[\-_]pack)/i;
const SM_ROLE_FIRE_SUPPORT_SLUGS  = /^(hellblaster|eradicator|devastator|heavy[\-_]intercessor|aggressor)/i;
const SM_ROLE_VETERAN_SLUGS       = /^(sternguard|vanguard[\-_]veteran|bladeguard|company[\-_]heroes|victrix[\-_]honour[\-_]guard|terminator|assault[\-_]terminator)/i;

function isSpaceMarine(keywords) {
  for (const k of keywords) {
    const u = String(k).toUpperCase();
    if (u === 'ADEPTUS ASTARTES' || u === 'SPACE MARINES') return true;
  }
  return false;
}

function isUltramarines(keywords) {
  for (const k of keywords) {
    if (String(k).toUpperCase() === 'ULTRAMARINES') return true;
  }
  return false;
}

function hasKeyword(keywords, ...wanted) {
  const set = new Set(keywords.map(k => String(k).toUpperCase()));
  return wanted.some(w => set.has(w.toUpperCase()));
}

function isTyranid(keywords) {
  for (const k of keywords) {
    if (String(k).toUpperCase() === 'TYRANIDS') return true;
  }
  return false;
}

function tyranidRoleSymbol(unit) {
  if (!unit) return null;
  const kws = (unit.keywords ?? []).map(k => (typeof k === 'string' ? k : k?.keyword ?? '')).filter(Boolean);
  if (!isTyranid(kws)) return null;
  // Priority: EPIC HERO > MONSTER (creature class) > INFILTRATORS
  // (deployment role) > INFANTRY (the swarm — all foot infantry, not just
  // Battleline) > FLY (non-infantry flyers). Epic Heroes (Old One Eye,
  // Swarmlord, etc.) are typically also Monsters — disease wins so the
  // named character reads distinctly from the rank-and-file Carnifex.
  if (hasKeyword(kws, 'EPIC HERO')) return 'icon:disease';
  if (hasKeyword(kws, 'MONSTER')) return 'icon:bug';
  if (hasKeyword(kws, 'INFILTRATORS')) return 'icon:spider';
  if (hasKeyword(kws, 'INFANTRY')) return 'icon:bugs';
  if (hasKeyword(kws, 'FLY')) return 'icon:mosquito';
  return null;
}

function spaceMarineRoleSymbol(unit) {
  if (!unit) return null;
  // unit.keywords may be an array of {keyword, ...} or strings — normalize.
  const kws = (unit.keywords ?? []).map(k => (typeof k === 'string' ? k : k?.keyword ?? '')).filter(Boolean);
  if (!isSpaceMarine(kws)) return null;
  // Ultramarines-locked datasheets (Calgar, Titus, Tigurius, Uriel, Wardens of
  // Ultramar, Victrix Honour Guard, Sicarius, etc.) — inverted omega (℧,
  // U+2127). The '^1.4' suffix horizontally stretches the glyph by 1.4× to
  // restore its natural aspect ratio; without it, JetBrains Mono's monospace
  // cell crushes ℧ into a narrow column.
  // Tested first so chapter identity overrides every role-class symbol below.
  // Warlord crown still wins because that branch lives in modelLabel above
  // this call.
  if (isUltramarines(kws)) return '℧^1.4#400';
  // Dreadnoughts (Ballistus, Redemptor, Brutalis, Contemptor, etc.) — Captain
  // groups them with the veteran caste, so they share the templar cross (✠).
  // Tested before VEHICLE because all dreadnoughts carry both keywords.
  if (hasKeyword(kws, 'DREADNOUGHT', 'WALKER')) return '✠';
  if (hasKeyword(kws, 'VEHICLE')) return 'icon:shield';
  // Captains, Lieutenants, Apothecaries, Epic Heroes — leaders read as skull.
  // Tested before veteran so a leader who is also tagged as a veteran unit
  // still reads as leader.
  if (hasKeyword(kws, 'CHARACTER', 'EPIC HERO') && !SM_ROLE_VETERAN_SLUGS.test(unit.slug ?? '')) return 'icon:skull';
  // Veteran units (Sternguard, Bladeguard, Vanguard veterans, Terminators).
  // Uses the unicode templar cross (✠) — Captain prefers the typographic glyph
  // over the FA cross/plus SVGs for the veteran caste.
  if (hasKeyword(kws, 'VETERAN', 'TERMINATOR') || SM_ROLE_VETERAN_SLUGS.test(unit.slug ?? '')) return '✠';
  if (SM_ROLE_FIRE_SUPPORT_SLUGS.test(unit.slug ?? '')) return 'icon:angle-up';
  if (hasKeyword(kws, 'GRAVIS', 'JUMP PACK', 'PHOBOS') || SM_ROLE_CLOSE_SUPPORT_SLUGS.test(unit.slug ?? '')) return 'icon:arrows-up-down-left-right@45';
  if (hasKeyword(kws, 'BATTLELINE')) return 'icon:chevron-up';
  return null;
}

// Curated short codes for common weapon systems. The lookup is by lowercase
// substring match — order matters when multiple substrings could hit (the
// FIRST match wins). Keep specific entries before generic ones.
const WEAPON_ABBREV = [
  // Aggressor / Gravis
  { match: 'auto boltstorm gauntlets', code: 'AB' },
  { match: 'flamestorm gauntlets',     code: 'FS' },
  { match: 'fragstorm grenade launcher', code: 'FG' },
  { match: 'twin power fists',         code: 'TPF' },
  { match: 'power fist',               code: 'PF' },
  // Plasma / energy
  { match: 'plasma incinerator',       code: 'Pl' },
  { match: 'plasma pistol',            code: 'pp' },
  { match: 'plasma',                   code: 'Pl' },
  // Bolt-line
  { match: 'heavy bolter',             code: 'HB' },
  { match: 'storm bolter',             code: 'SB' },
  { match: 'bolt rifle',               code: 'BR' },
  { match: 'boltgun',                  code: 'B' },
  { match: 'bolter',                   code: 'B' },
  // Special / heavy
  { match: 'lascannon',                code: 'LC' },
  { match: 'multi-melta',              code: 'MM' },
  { match: 'meltagun',                 code: 'MG' },
  { match: 'flamer',                   code: 'F' },
  { match: 'thunder hammer',           code: 'TH' },
  { match: 'power weapon',             code: 'PW' },
  { match: 'power sword',              code: 'PS' },
  { match: 'chainsword',               code: 'CS' },
  // Default fallthrough handled by initials.
];

const SIDEARMS = [
  'bolt pistol', 'plasma pistol', 'absolvor bolt pistol', 'master-crafted bolter',
  'close combat weapon', 'combat knife', 'astartes chainsword',
];

function isSidearm(name) {
  if (!name) return true;
  const lower = name.toLowerCase();
  return SIDEARMS.some(s => lower === s || lower.includes(s));
}

function abbreviateWeapon(name) {
  if (!name) return '';
  const lower = name.toLowerCase();
  for (const entry of WEAPON_ABBREV) {
    if (lower.includes(entry.match)) return entry.code;
  }
  // Fallback: first letter of each significant word, max 2.
  const words = lower.split(/\s+/).filter(w => !['the', 'of', 'and', 'a', 'an'].includes(w));
  if (words.length === 0) return '?';
  return words.slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

/**
 * Derive a short label string for a single model circle.
 *
 * Rules:
 *  - Single-model units → '' (no label; don't clutter vehicles / solo heroes).
 *  - Sergeant detection: submodel name contains "Sergeant" or "Sgt" → 'S'.
 *  - Otherwise → abbreviation of the model's primary weapon (first non-sidearm
 *    in wargear list).
 */
export function modelLabel(submodel, unitMeta) {
  // unitMeta: { totalUnitModels, unit?, warlord?, isLeaderModel? }
  // Warlord crown wins over every other marking. Only one model per army carries
  // it: the attached leader of an attached squad, or the sole model of a solo
  // character unit. Squad members of a warlord-led unit do NOT get the crown.
  if (unitMeta.warlord && (unitMeta.isLeaderModel || unitMeta.totalUnitModels === 1)) {
    return 'icon:crown';
  }
  // Sergeant detection by submodel name — overrides unit-role / chapter symbols.
  // Captain's standing rule: the sergeant star always reads first so the
  // squad's leader is identifiable even inside chapter-locked Ultramarines
  // squads or class-marked Veteran/Battleline squads.
  const subName = (submodel.submodel ?? '').toLowerCase();
  if (subName.includes('sergeant') || subName.includes('sgt')) return 'icon:star';
  const roleSymbol = spaceMarineRoleSymbol(unitMeta.unit) ?? tyranidRoleSymbol(unitMeta.unit);
  if (roleSymbol) return roleSymbol;
  // Single-model units without a role symbol stay clean (no clutter on a
  // lone vehicle / character / monster from a faction we don't classify).
  if (unitMeta.totalUnitModels <= 1) return '';
  // Fall back to weapon-system letter for multi-model non-SM squads.
  const wargear = submodel.wargear ?? submodel.weapons ?? [];
  const primary = wargear.find(w => {
    const item = typeof w === 'string' ? w : (w.item ?? w.name ?? '');
    return !isSidearm(item);
  });
  if (!primary) return '';
  const itemName = typeof primary === 'string' ? primary : (primary.item ?? primary.name ?? '');
  return abbreviateWeapon(itemName);
}

// INCH_PX is kept as 1 so all "pixel" math reduces to inches directly.
export const INCH_PX = 1;

const SVG_NS = 'http://www.w3.org/2000/svg';

export function clearSvg(svg) {
  // Preserve the icon sprite <defs> so cross-SVG <use href="#icon-..."/>
  // references survive board re-renders (ENGAGE clears the rest).
  const sprite = svg.querySelector('#icon-sprite');
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  if (sprite) svg.appendChild(sprite);
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

  // deployment zones — fill, stroke, and centroid identity label
  const zonesLayer = document.createElementNS(SVG_NS, 'g');
  zonesLayer.setAttribute('id', 'layer-deployment');
  (mission.deployment?.attacker?.polygons ?? []).forEach(p => {
    drawPolygon(zonesLayer, p.vertices, 'rgba(255,93,108,0.25)', '#ff5d6c');
    drawZoneLabel(zonesLayer, p.vertices, 'ATTACKER', 'var(--hostile, #ff5d6c)');
  });
  (mission.deployment?.defender?.polygons ?? []).forEach(p => {
    drawPolygon(zonesLayer, p.vertices, 'rgba(111,255,142,0.22)', '#6fff8e');
    drawZoneLabel(zonesLayer, p.vertices, 'DEFENDER', 'var(--friendly, #6fff8e)');
  });
  svg.appendChild(zonesLayer);

  // battlefield edges — segments plus directional edge labels
  const edgesLayer = document.createElementNS(SVG_NS, 'g');
  edgesLayer.setAttribute('id', 'layer-edges');
  (mission.battlefield_edges?.attacker ?? []).forEach(e => {
    drawSegment(edgesLayer, e.segment, '#ff5d6c', 6);
    drawEdgeLabelFromSegment(edgesLayer, e.segment, 'ATTACKER EDGE', 'var(--hostile, #ff5d6c)', width_in, height_in);
  });
  (mission.battlefield_edges?.defender ?? []).forEach(e => {
    drawSegment(edgesLayer, e.segment, '#6fff8e', 6);
    drawEdgeLabelFromSegment(edgesLayer, e.segment, 'DEFENDER EDGE', 'var(--friendly, #6fff8e)', width_in, height_in);
  });
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

  // threat ranges layer — kept for legacy renderThreatRanges; press-hold rings
  // are appended directly to the unit <g> at interaction time instead.
  const threatLayer = document.createElementNS(SVG_NS, 'g');
  threatLayer.setAttribute('id', 'layer-threat');
  threatLayer.style.display = 'none';
  svg.appendChild(threatLayer);

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

/** Centroid of a simple polygon (average of vertices). */
function polygonCentroid(vertices) {
  let sx = 0, sy = 0;
  for (const [x, y] of vertices) { sx += x; sy += y; }
  return [sx / vertices.length, sy / vertices.length];
}

/**
 * Draw a centered identity label over a deployment polygon.
 * Uses Bank Gothic for the display-face call per project typography directive.
 */
function drawZoneLabel(parent, vertices, text, fill) {
  const [cx, cy] = polygonCentroid(vertices);
  const label = document.createElementNS(SVG_NS, 'text');
  label.setAttribute('x', cx);
  label.setAttribute('y', cy);
  label.setAttribute('text-anchor', 'middle');
  label.setAttribute('dominant-baseline', 'central');
  label.setAttribute('font-family', "'Bank Gothic', 'JetBrains Mono', monospace");
  label.setAttribute('font-weight', '700');
  label.setAttribute('font-size', '1.4');
  label.setAttribute('letter-spacing', '0.1');
  label.setAttribute('fill', fill);
  label.setAttribute('opacity', '0.55');
  label.setAttribute('pointer-events', 'none');
  label.textContent = text;
  parent.appendChild(label);
}

/**
 * Derive which board edge a segment lies on and place a label along it.
 * Works by detecting whether both segment endpoints share x=0, x=W, y=0, or y=H.
 * For non-axis-aligned segments (partial side gates, etc.) labels are placed
 * at the segment midpoint instead.
 */
function drawEdgeLabelFromSegment(parent, segment, text, fill, W, H) {
  const [[x1, y1], [x2, y2]] = segment;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const EPS = 0.5; // tolerance for "on the board edge"

  const onNorth = Math.abs(y1) < EPS && Math.abs(y2) < EPS;
  const onSouth = Math.abs(y1 - H) < EPS && Math.abs(y2 - H) < EPS;
  const onWest  = Math.abs(x1) < EPS && Math.abs(x2) < EPS;
  const onEast  = Math.abs(x1 - W) < EPS && Math.abs(x2 - W) < EPS;

  const t = document.createElementNS(SVG_NS, 'text');
  t.setAttribute('text-anchor', 'middle');
  t.setAttribute('dominant-baseline', 'central');
  t.setAttribute('font-family', "'Bank Gothic', 'JetBrains Mono', monospace");
  t.setAttribute('font-weight', '700');
  t.setAttribute('font-size', '0.7');
  t.setAttribute('letter-spacing', '0.15');
  t.setAttribute('fill', fill);
  t.setAttribute('opacity', '0.7');
  t.setAttribute('pointer-events', 'none');
  t.textContent = text;

  const OFFSET = 1.0; // inches outside the board edge
  if (onNorth) {
    t.setAttribute('x', mx);
    t.setAttribute('y', -OFFSET);
  } else if (onSouth) {
    t.setAttribute('x', mx);
    t.setAttribute('y', H + OFFSET);
  } else if (onWest) {
    const lx = -OFFSET - 0.2;
    t.setAttribute('x', lx);
    t.setAttribute('y', my);
    t.setAttribute('transform', `rotate(-90 ${lx} ${my})`);
  } else if (onEast) {
    const lx = W + OFFSET + 0.2;
    t.setAttribute('x', lx);
    t.setAttribute('y', my);
    t.setAttribute('transform', `rotate(90 ${lx} ${my})`);
  } else {
    // Partial or diagonal segment: label floats at midpoint inside the board
    t.setAttribute('x', mx);
    t.setAttribute('y', my - 0.8);
  }

  parent.appendChild(t);
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

// Lazy-create the movement-ruler layer (a <g> sibling of #layer-units holding
// a single <line> + <text> reused across drags). Returns the elements.
function ensureMoveRulerLayer(svg) {
  let layer = svg.querySelector('#layer-movement-ruler');
  if (!layer) {
    layer = document.createElementNS(SVG_NS, 'g');
    layer.setAttribute('id', 'layer-movement-ruler');
    layer.setAttribute('pointer-events', 'none');
    svg.appendChild(layer);
  }
  let line = layer.querySelector('line.move-ruler');
  let label = layer.querySelector('text.move-ruler-label');
  if (!line) {
    line = document.createElementNS(SVG_NS, 'line');
    line.classList.add('move-ruler');
    line.setAttribute('stroke-width', '0.08');
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('stroke-dasharray', '0.4 0.2');
    line.setAttribute('display', 'none');
    layer.appendChild(line);
  }
  if (!label) {
    label = document.createElementNS(SVG_NS, 'text');
    label.classList.add('move-ruler-label');
    label.setAttribute('font-family', "'JetBrains Mono', monospace");
    label.setAttribute('font-weight', '700');
    label.setAttribute('font-size', '0.6');
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('dominant-baseline', 'central');
    label.setAttribute('paint-order', 'stroke');
    label.setAttribute('stroke', '#0f1413');
    label.setAttribute('stroke-width', '0.05');
    label.setAttribute('display', 'none');
    layer.appendChild(label);
  }
  return { line, label };
}

function moveColor(dist, thresholds) {
  if (!thresholds) return MOVE_COLOR_GUARANTEED;
  if (dist <= thresholds.min) return MOVE_COLOR_GUARANTEED;
  if (dist <= thresholds.max) return MOVE_COLOR_VARIABLE;
  return MOVE_COLOR_OVER;
}

export function makeUnitDraggable(group, onDragEnd) {
  let dragging = false;
  let startSvg = [0, 0]; // mouse-down position in SVG user units
  let ox = 0, oy = 0;   // group origin (translate) at mouse-down
  let originSvg = [0, 0]; // pre-drag cluster center in SVG user units
  let thresholds = null;
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
    // Anchor the movement line at the cluster's pre-drag CENTER. The center
    // is captured at render time as data-center-x/y on the unit group.
    const cx = parseFloat(group.dataset.centerX ?? '0');
    const cy = parseFloat(group.dataset.centerY ?? '0');
    originSvg = [cx + ox, cy + oy];
    thresholds = parseMovement(group.dataset.movementM);
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
    // Update the movement-distance ruler.
    const newCx = originSvg[0] + dx;
    const newCy = originSvg[1] + dy;
    const dist = Math.hypot(newCx - originSvg[0], newCy - originSvg[1]);
    const { line, label } = ensureMoveRulerLayer(svg);
    const color = moveColor(dist, thresholds);
    line.setAttribute('x1', originSvg[0]);
    line.setAttribute('y1', originSvg[1]);
    line.setAttribute('x2', newCx);
    line.setAttribute('y2', newCy);
    line.setAttribute('stroke', color);
    line.setAttribute('display', '');
    label.setAttribute('x', newCx);
    label.setAttribute('y', newCy - 0.6);
    label.setAttribute('fill', color);
    label.textContent = `${dist.toFixed(1)}"`;
    label.setAttribute('display', '');
  });
  window.addEventListener('mouseup', (e) => {
    if (!dragging) return;
    dragging = false;
    group.style.cursor = 'grab';
    const transform = group.transform.baseVal.consolidate();
    const offset = transform ? [transform.matrix.e, transform.matrix.f] : [0, 0];
    // Hide the movement ruler BEFORE calling onDragEnd. onDragEnd typically
    // triggers a rerender that detaches `group` from the SVG, after which
    // group.ownerSVGElement is null and any cleanup-after-onDragEnd no-ops.
    const svg = group.ownerSVGElement;
    if (svg) {
      const layer = svg.querySelector('#layer-movement-ruler');
      const line = layer?.querySelector('line.move-ruler');
      const label = layer?.querySelector('text.move-ruler-label');
      if (line) line.setAttribute('display', 'none');
      if (label) label.setAttribute('display', 'none');
    }
    // Only fire onDragEnd if the pointer actually moved. A bare click
    // (including shift+click for the COMBAT AUSPEX selector) shouldn't
    // trigger a board rerender, because the rerender detaches `group`
    // from the DOM and the subsequent click event then fires on a
    // detached element — meaning the shift+click handler never sees
    // the unit and selection silently fails.
    if (group.__dragged) {
      onDragEnd?.(offset, { group, instanceId: group.dataset.instanceId, side: group.dataset.side });
    }
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

function renderUnit({ unit, datasheet, centerIn, role, _instanceId }) {
  const color = role === 'attacker' ? '#ff5d6c' : '#6fff8e';
  const fill  = role === 'attacker' ? 'rgba(255,93,108,0.6)' : 'rgba(111,255,142,0.55)';
  const labelColor = role === 'attacker' ? 'var(--hostile)' : 'var(--phosphor)';

  const group = document.createElementNS(SVG_NS, 'g');
  group.setAttribute('class', `unit unit-${role}`);
  group.dataset.unitName = unit.name;
  // Datasheet M (e.g. "6\"", "D6+2\"") flows through to the drag handler so
  // the live movement ruler can color-code distance against the unit's
  // movement characteristic.
  group.dataset.movementM = String(datasheet?.profile?.M ?? '');

  // Derive bare slug (e.g. 'aggressor-squad') from the datasheet field
  // ('space-marines/aggressor-squad') so it matches the unitsByInstanceId
  // cache key's slug portion.
  const rawDs = unit.datasheet ?? '';
  const unitSlug = rawDs.includes('/') ? rawDs.split('/').pop() : rawDs;
  group.dataset.unitSlug = unitSlug;
  // Per-unit-instance ID — distinguishes duplicate units (5× Hormagaunts)
  // for click-routing and per-instance state lookups.
  if (_instanceId) group.dataset.instanceId = _instanceId;
  // Tag with deployment side so sim-pair line can resolve by slug+side
  // when both rosters are the same list.
  group.dataset.side = role; // 'defender' or 'attacker'

  const defaultMm = datasheet?.base?.diameter_mm ?? 32;
  const perModel = datasheet?.base?.per_model ?? null;

  const [cx, cy] = [centerIn[0], centerIn[1]];
  // Anchor for the movement-distance line: the cluster center BEFORE any
  // drag translate is applied. The drag handler reads this back on mousedown.
  group.dataset.centerX = String(cx);
  group.dataset.centerY = String(cy);

  // Flatten to per-model list. When the datasheet enumerates per-model bases
  // (e.g., Wardens of Ultramar: 2 × 40mm + 4 × 28.5mm), each submodel carries
  // its own diameter; otherwise every model uses the unit's default. Submodels
  // tagged with `_sourceDatasheet` (attached leaders folded into a squad) use
  // their own datasheet's base size, not the host squad's.
  const models = [];
  for (const sub of unit.models) {
    const ownDs = sub._sourceDatasheet ?? null;
    const ownDefaultMm = ownDs?.base?.diameter_mm ?? defaultMm;
    const ownPerModel = ownDs?.base?.per_model ?? perModel;
    const match = ownPerModel?.find(pm => pm.submodel === sub.submodel);
    const mm = match?.diameter_mm ?? ownDefaultMm;
    for (let k = 0; k < sub.count; k++) {
      models.push({ sub, mm });
    }
  }

  // For non-cluster formations a single uniform step is correct (grid/line
  // layouts are explicit user choices and mixed bases there are rare); we
  // pass max so the lattice is sized to the largest model. For 'cluster' we
  // additionally pass per-model diameters so mixed-base squads (e.g., 40mm
  // Wolf Guard Terminators + 80mm Logan Grimnar) pack rank-and-file tightly
  // and only push the oversize leader outward enough to clear neighbors.
  const maxMm = models.reduce((m, x) => Math.max(m, x.mm), defaultMm);
  const formation = unit._formation ?? 'cluster';
  const perModelPx = models.map(m => baseDiameterPx(m.mm));
  // Per-unit overrides set by the right-click context menu:
  //   _spacingGapIn — base-edge-to-base-edge gap, 0..2" (cohesion cap)
  //   _rotationDeg  — rotates the cluster offsets about the unit center while
  //                   leaving the per-model icons upright (they're not parented
  //                   to a rotated <g>, so symbols stay readable)
  const gapIn = (typeof unit._spacingGapIn === 'number') ? unit._spacingGapIn : 0.5;
  const rotDeg = (typeof unit._rotationDeg === 'number') ? unit._rotationDeg : 0;
  // _modelPositions is an OPTIONAL absolute-position override the resolver
  // writes when the rigid formation can't fit (near edges, in tight pockets).
  // When present it replaces the formation lattice — each model is at
  // (cx, cy) directly, no centerIn-relative offsets. Cleared when the captain
  // changes formation/rotation/spacing so the cluster reverts to lattice.
  const overridePositions = Array.isArray(unit._modelPositions)
    && unit._modelPositions.length === models.length
    ? unit._modelPositions
    : null;
  let offsets;
  if (overridePositions) {
    offsets = overridePositions.map(([x, y]) => [x - cx, y - cy]);
  } else {
    const rawOffsets = formationOffsets(formation, models.length, baseDiameterPx(maxMm), perModelPx, gapIn);
    offsets = rotDeg
      ? rawOffsets.map(([x, y]) => {
          const rad = rotDeg * Math.PI / 180;
          const c = Math.cos(rad), s = Math.sin(rad);
          return [x * c - y * s, x * s + y * c];
        })
      : rawOffsets;
  }

  // Pre-compute label context values once for this unit.
  const totalUnitModels = models.length;

  // Collect circle geometry for bounding-box computation (squad bracket).
  const circles = [];

  models.forEach((m, i) => {
    const circleCx = cx + offsets[i][0];
    const circleCy = cy + offsets[i][1];
    const r = baseDiameterPx(m.mm) / 2;

    circles.push({ cx: circleCx, cy: circleCy, r });

    // Sergeant detection: thicker stroke for the sergeant circle.
    const subNameLower = (m.sub.submodel ?? '').toLowerCase();
    const isSergeant = subNameLower.includes('sergeant') || subNameLower.includes('sgt');

    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', circleCx);
    circle.setAttribute('cy', circleCy);
    circle.setAttribute('r', r);
    circle.setAttribute('fill', fill);
    circle.setAttribute('stroke', color);
    circle.setAttribute('stroke-width', isSergeant ? 0.12 : 0.06);
    circle.classList.add('model-circle');
    circle.dataset.unitSlug = unitSlug;
    if (_instanceId) circle.dataset.instanceId = _instanceId;
    circle.dataset.modelIdx = String(i);
    group.appendChild(circle);

    // --- Per-model label (role symbol / sergeant marker / weapon fallback) ---
    // Attached leaders carry their own datasheet on the submodel and must use
    // it for keyword-driven role markings, otherwise they inherit the host
    // squad's symbol (e.g., a Captain attached to Bladeguard would render
    // with Veteran markings).
    const ownDs = m.sub._sourceDatasheet ?? null;
    const labelKeywords = ownDs?.keywords ?? datasheet?.keywords ?? unit.keywords ?? [];
    // Slug also flows through ownDs so a Judiciar attached to Bladeguard does
    // not pick up the bladeguard-veteran-squad slug (which would match the
    // VETERAN regex and override the CHARACTER → leader-skull branch).
    const labelSlug = ownDs?.slug ?? unit.slug ?? unitSlug;
    const label = modelLabel(m.sub, {
      totalUnitModels,
      unit: {
        slug: labelSlug,
        keywords: labelKeywords,
      },
      warlord: unit.warlord === true,
      isLeaderModel: ownDs !== null,
    });

    if (label) {
      if (label.startsWith('icon:')) {
        // SVG sprite icon — emits <use href="#icon-NAME"/> centered on circle.
        // Optional rotation suffix: 'icon:NAME@DEG' rotates DEG degrees about
        // the circle center (used so close-support arrows-up-down-left-right
        // sits as an X-with-arrowheads at 45°).
        const spec = label.slice('icon:'.length);
        const atIdx = spec.indexOf('@');
        const iconName = atIdx >= 0 ? spec.slice(0, atIdx) : spec;
        const rotDeg = atIdx >= 0 ? parseFloat(spec.slice(atIdx + 1)) : 0;
        const useEl = document.createElementNS(SVG_NS, 'use');
        useEl.setAttribute('href', `#icon-${iconName}`);
        const size = Math.max(0.4, r * 1.4);
        useEl.setAttribute('x', String(circleCx - size / 2));
        useEl.setAttribute('y', String(circleCy - size / 2));
        useEl.setAttribute('width', String(size));
        useEl.setAttribute('height', String(size));
        useEl.setAttribute('fill', labelColor);
        useEl.setAttribute('pointer-events', 'none');
        if (rotDeg) useEl.setAttribute('transform', `rotate(${rotDeg} ${circleCx} ${circleCy})`);
        useEl.classList.add('model-label');
        useEl.dataset.unitSlug = unitSlug;
        useEl.dataset.modelIdx = String(i);
        group.appendChild(useEl);
      } else {
        // Existing <text> path for letter labels (weapon codes, fallback).
        // Optional decorator suffixes after the glyph, any combination, any order:
        //   '@DEG' — rotate DEG degrees about the circle center
        //   '^SX'  — horizontally stretch by factor SX about the circle center
        //            (so Ultramarines ℧ keeps its natural aspect ratio inside
        //            JetBrains Mono's monospace cell)
        //   '#W'   — font-weight W (e.g. '#400'); defaults to 700 (bold)
        const decoratorRe = /[@^#]/;
        const decoratorMatch = decoratorRe.exec(label);
        const glyph = decoratorMatch ? label.slice(0, decoratorMatch.index) : label;
        const readDecorator = (marker, fallback) => {
          const i = label.indexOf(marker);
          if (i < 0) return fallback;
          const rest = label.slice(i + 1);
          const next = decoratorRe.exec(rest);
          return parseFloat(next ? rest.slice(0, next.index) : rest);
        };
        const rotDeg = readDecorator('@', 0);
        const xScale = readDecorator('^', 1);
        const fontWeight = readDecorator('#', 700);
        const text = document.createElementNS(SVG_NS, 'text');
        text.setAttribute('x', String(circleCx));
        text.setAttribute('y', String(circleCy));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-family', "'JetBrains Mono', monospace");
        text.setAttribute('font-weight', String(fontWeight));
        // font-size in inches: single-character role glyphs (e.g. ✠) scale
        // to match FA icons; multi-character weapon codes stay tighter at
        // r * 0.55 so 2-3 letter codes still fit. Lower floor prevents
        // invisible glyphs.
        const isSingleGlyph = [...glyph].length === 1;
        const fontSize = isSingleGlyph
          ? Math.max(0.4, r * 1.6)
          : Math.max(0.25, r * 0.55);
        // Vertical centering: dominant-baseline is unreliable across SVG
        // implementations for symbol/cap glyphs. Use the classic dy=.35em
        // pattern instead — places the alphabetic baseline below cy so the
        // glyph's cap/symbol-middle aligns with the circle center.
        text.setAttribute('dy', '0.35em');
        text.setAttribute('font-size', String(fontSize));
        text.setAttribute('fill', labelColor);
        text.setAttribute('pointer-events', 'none');
        // Compose rotation + x-stretch about the circle center. Right-to-left
        // application order: translate to origin, scale, translate back, then
        // rotate. NaN-safe: parseFloat() failures fall through the truthy guard.
        const tParts = [];
        if (rotDeg) tParts.push(`rotate(${rotDeg} ${circleCx} ${circleCy})`);
        if (xScale && xScale !== 1) {
          tParts.push(`translate(${circleCx} 0) scale(${xScale} 1) translate(${-circleCx} 0)`);
        }
        if (tParts.length) text.setAttribute('transform', tParts.join(' '));
        text.classList.add('model-label');
        text.dataset.unitSlug = unitSlug;
        text.dataset.modelIdx = String(i);
        text.textContent = glyph;
        group.appendChild(text);
      }

      // Hover tooltip — full submodel name.
      const titleEl = document.createElementNS(SVG_NS, 'title');
      titleEl.textContent = m.sub.submodel;
      circle.appendChild(titleEl);
    }
  });

  // --- Squad-level identity: name label + bracket corners ---
  // Drawn for ALL units — single-model vehicles and characters included.
  {
    const xs = circles.map(c => c.cx);
    const ys = circles.map(c => c.cy);
    const rs = circles.map(c => c.r);
    const minX = Math.min(...xs.map((x, i) => x - rs[i]));
    const maxX = Math.max(...xs.map((x, i) => x + rs[i]));
    const minY = Math.min(...ys.map((y, i) => y - rs[i]));
    const maxY = Math.max(...ys.map((y, i) => y + rs[i]));
    const padding = 0.3; // inches around the cluster

    // Squad name floats above the cluster.
    const squadLabel = document.createElementNS(SVG_NS, 'text');
    squadLabel.setAttribute('x', (minX + maxX) / 2);
    squadLabel.setAttribute('y', minY - padding - 0.5);
    squadLabel.setAttribute('text-anchor', 'middle');
    squadLabel.setAttribute('dominant-baseline', 'central');
    squadLabel.setAttribute('font-family', "'JetBrains Mono', monospace");
    squadLabel.setAttribute('font-weight', '700');
    squadLabel.setAttribute('font-size', '0.6');
    squadLabel.setAttribute('fill', 'var(--phosphor)');
    squadLabel.setAttribute('pointer-events', 'none');
    squadLabel.setAttribute('letter-spacing', '0.04');
    squadLabel.classList.add('squad-name');
    squadLabel.textContent = (unit.name ?? '').toUpperCase();
    group.appendChild(squadLabel);

    // Bracket frame: four L-shaped corners around the bounding box.
    const bracketGroup = document.createElementNS(SVG_NS, 'g');
    bracketGroup.classList.add('squad-bracket');
    bracketGroup.setAttribute('pointer-events', 'none');
    const armLen = 0.4;
    const stroke = '0.04';
    const bracketColor = 'var(--phosphor-dim)';
    const corners = [
      // [x, y, dx1, dy1, dx2, dy2] — corner origin and two arm directions
      [minX - padding, minY - padding,  armLen, 0,  0,  armLen], // TL
      [maxX + padding, minY - padding, -armLen, 0,  0,  armLen], // TR
      [minX - padding, maxY + padding,  armLen, 0,  0, -armLen], // BL
      [maxX + padding, maxY + padding, -armLen, 0,  0, -armLen], // BR
    ];
    for (const [x, y, dx1, dy1, dx2, dy2] of corners) {
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', `M ${x + dx1} ${y + dy1} L ${x} ${y} L ${x + dx2} ${y + dy2}`);
      path.setAttribute('stroke', bracketColor);
      path.setAttribute('stroke-width', stroke);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke-linecap', 'round');
      bracketGroup.appendChild(path);
    }
    group.appendChild(bracketGroup);
  }

  return group;
}
