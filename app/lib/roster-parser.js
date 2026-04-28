// app/lib/roster-parser.js
// JS port of scripts/parse_gw_roster.py
// Parses GW Companion App roster exports.

/**
 * Lowercase a name and replace runs of non-word characters with dashes.
 * Matches Python: re.sub(r'[^\w]+', '-', name.lower()).strip('-')
 * @param {string} name
 * @returns {string}
 */
export function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^\w]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Resolve a unit name to a "<faction>/<slug>" string using a pre-built candidates list.
 * Pure function — no filesystem access.
 * @param {string} unitName
 * @param {Array<{faction: string, slug: string}>} candidates
 * @returns {string|null}
 */
export function resolveSlug(unitName, candidates) {
  const slug = slugify(unitName);
  const toTry = [slug];
  if (slug.endsWith('-squad')) {
    toTry.push(slug.slice(0, -'-squad'.length));
  }
  for (const cand of toTry) {
    const match = candidates.find(c => c.slug === cand);
    if (match) return `${match.faction}/${cand}`;
  }
  return null;
}

const SECTION_HEADERS = new Set([
  'CHARACTERS', 'EPIC HEROES', 'BATTLELINE',
  'DEDICATED TRANSPORTS', 'OTHER DATASHEETS',
  'INFANTRY', 'VEHICLES', 'MONSTERS', 'WALKERS',
  'ALLIED UNITS', 'FORTIFICATIONS', 'SWARMS',
]);

const UNIT_HEADER_RE = /^(.+?) \(([\d,]+) (?:Points|pts)\)$/i;
// GW Companion App format: 2-space indented top bullets, 5-space hollow nested.
const TOP_BULLET_RE = /^  • (.+?)\s*$/;
const NESTED_BULLET_RE = /^\s{5}◦ (.+?)\s*$/;
// New Recruit format: column-0 top bullets, 4-space indented nested (same • glyph).
const TOP_BULLET_NR_RE = /^• (.+?)\s*$/;
const NESTED_BULLET_NR_RE = /^    • (.+?)\s*$/;
const NX_ITEM_RE = /^(\d+)x (.+)$/;
const ENHANCEMENT_RE = /^enhancements?:\s*(.+)$/i;
const EXPORT_FOOTER_RE = /^Exported with App Version:\s*(.+?),\s*Data Version:\s*(.+?)\s*$/;

function isSectionHeader(line) {
  const s = line.trim();
  if (!s || s.length < 2) return false;
  if (SECTION_HEADERS.has(s)) return true;
  return /^[A-Z ]+$/.test(s) && /[A-Z]/.test(s);
}

// Parse a New Recruit-format header block. Layout:
//   +++++++++++++...
//   + FACTION KEYWORD: <faction> - <subfaction>
//   + DETACHMENT: <detachment>
//   + TOTAL ARMY POINTS: <N>pts
//   + ENHANCEMENT: <name>          (optional)
//   + NUMBER OF UNITS: <N>         (informational)
//   + SECONDARY: <text>            (informational)
//   +++++++++++++...
// Returns { list_name, list_points, faction, subfaction, detachment,
//           battle_size_name, max_points, i }.
function parseHeaderNewRecruit(lines, i) {
  // Skip leading divider line(s).
  while (i < lines.length && lines[i].trim().startsWith('+++')) i++;

  let list_points = null;
  let faction = null;
  let subfaction = null;
  let detachment = null;

  while (i < lines.length) {
    const s = lines[i].trim();
    if (s.startsWith('+++')) { i++; break; }
    if (!s.startsWith('+')) {
      if (s === '' || s === '+') { i++; continue; }
      break;
    }
    const body = s.replace(/^\++/, '').trim();
    const colonIdx = body.indexOf(':');
    if (colonIdx > 0) {
      const key = body.slice(0, colonIdx).trim().toUpperCase();
      const val = body.slice(colonIdx + 1).trim();
      if (key === 'FACTION KEYWORD') {
        if (val.includes(' - ')) {
          const [sub, ...rest] = val.split(' - ');
          subfaction = sub.trim();
          faction = rest.join(' - ').trim();
        } else {
          faction = val;
          subfaction = '';
        }
      } else if (key === 'DETACHMENT') {
        detachment = val;
      } else if (key === 'TOTAL ARMY POINTS') {
        const m = val.match(/(\d+)\s*pts?/i);
        if (m) list_points = parseInt(m[1], 10);
      }
    }
    i++;
  }

  const list_name = `${faction || 'Unnamed'} ${list_points || ''}pt list`.trim();
  const battle_size_name = list_points != null ? `${list_points} Points` : 'Unknown';
  return {
    list_name,
    list_points: list_points || 0,
    faction: faction || '',
    subfaction: subfaction || '',
    detachment: detachment || '',
    battle_size_name,
    max_points: list_points,
    i,
  };
}

export function parseRoster(text) {
  const lines = text.split(/\r?\n/);
  let i = 0;

  while (i < lines.length && lines[i].trim() === '') i++;
  if (i >= lines.length) throw new Error('Empty export');

  // Route by format: '+++' divider line → New Recruit; otherwise GW Companion App.
  let list_name, list_points, faction, subfaction, detachment, battle_size_name, max_points = null;
  if (lines[i].trim().startsWith('+++')) {
    const h = parseHeaderNewRecruit(lines, i);
    ({ list_name, list_points, faction, subfaction, detachment,
       battle_size_name, max_points, i } = h);
  } else {
    const headerMatch = UNIT_HEADER_RE.exec(lines[i].trim());
    if (!headerMatch) throw new Error(`Expected list header at line ${i+1}, got: ${JSON.stringify(lines[i])}`);
    list_name = headerMatch[1];
    list_points = parseInt(headerMatch[2].replace(/,/g, ''), 10);
    i++;

    const nextNonblank = () => {
      while (i < lines.length && lines[i].trim() === '') i++;
      if (i >= lines.length) throw new Error('Unexpected end of input in header');
      const v = lines[i].trim();
      i++;
      return v;
    };

    faction = nextNonblank();
    subfaction = nextNonblank();
    detachment = nextNonblank();

    const bsLine = nextNonblank();
    const bsMatch = UNIT_HEADER_RE.exec(bsLine);
    if (bsMatch) {
      battle_size_name = bsMatch[1];
      max_points = parseInt(bsMatch[2].replace(/,/g, ''), 10);
    } else {
      battle_size_name = bsLine;
    }
  }

  const units = [];
  let current_section = null;
  let app_version = null;
  let data_version = null;

  while (i < lines.length) {
    const raw = lines[i];
    const stripped = raw.trim();

    if (stripped === '') { i++; continue; }

    const fm = EXPORT_FOOTER_RE.exec(stripped);
    if (fm) {
      app_version = fm[1].trim();
      data_version = fm[2].trim();
      break;
    }

    if (isSectionHeader(raw)) {
      current_section = stripped;
      i++;
      continue;
    }

    const um = UNIT_HEADER_RE.exec(stripped);
    if (um && !raw.startsWith('  ')) {
      const block = [raw];
      i++;
      while (i < lines.length) {
        const nxt = lines[i];
        if (nxt.trim() === '') { i++; continue; }
        // Companion (2-space + 5-space hollow) or New Recruit (col-0 + 4-space).
        if (nxt.startsWith('  •') || nxt.startsWith('     ◦') ||
            nxt.startsWith('• ') || nxt.startsWith('    • ')) {
          block.push(nxt);
          i++;
          continue;
        }
        break;
      }
      units.push(parseUnit(block, current_section));
    } else {
      i++;
    }
  }

  return {
    list_name, list_points, faction, subfaction, detachment,
    battle_size_name, max_points, app_version, data_version,
    units,
  };
}

function parseUnit(block, section) {
  const headerMatch = UNIT_HEADER_RE.exec(block[0].trim());
  if (!headerMatch) {
    throw new Error(`parseUnit: malformed block header: ${JSON.stringify(block[0])}`);
  }
  const name = headerMatch[1];
  const points = parseInt(headerMatch[2].replace(/,/g, ''), 10);

  const entries = [];
  let current_top = null;
  for (const raw of block.slice(1)) {
    // Try both Companion (2-space, hollow ◦) and New Recruit (col-0, 4-space •).
    // Check nested first because NR's col-0 regex would also accept the bullet
    // portion of an indented line if we anchored only on '•'.
    const nm = NESTED_BULLET_RE.exec(raw) ?? NESTED_BULLET_NR_RE.exec(raw);
    const tm = nm ? null : (TOP_BULLET_RE.exec(raw) ?? TOP_BULLET_NR_RE.exec(raw));
    if (tm) {
      current_top = { content: tm[1].trim(), children: [] };
      entries.push(current_top);
    } else if (nm && current_top !== null) {
      current_top.children.push(nm[1].trim());
    }
  }

  let warlord = false;
  let enhancement = null;
  const models = [];
  const flat_wargear = [];

  for (const entry of entries) {
    const content = entry.content;

    if (content === 'Warlord') { warlord = true; continue; }
    const enhMatch = ENHANCEMENT_RE.exec(content);
    if (enhMatch) { enhancement = enhMatch[1].trim(); continue; }

    const nx = NX_ITEM_RE.exec(content);
    if (entry.children.length > 0) {
      let count, submodel;
      if (nx) { count = parseInt(nx[1], 10); submodel = nx[2]; }
      else { count = 1; submodel = content; }
      const wargear = entry.children.map(child => {
        const cnx = NX_ITEM_RE.exec(child);
        return cnx
          ? { count: parseInt(cnx[1], 10), item: cnx[2] }
          : { count: 1, item: child };
      });
      models.push({ submodel, count, wargear });
    } else {
      if (nx) flat_wargear.push({ count: parseInt(nx[1], 10), item: nx[2] });
      else flat_wargear.push({ count: 1, item: content });
    }
  }

  if (models.length === 0 && flat_wargear.length > 0) {
    models.push({ submodel: name, count: 1, wargear: flat_wargear });
  }

  const total_models = models.reduce((a, m) => a + m.count, 0);

  return {
    name, section, points,
    warlord, enhancement,
    total_models, models,
  };
}
