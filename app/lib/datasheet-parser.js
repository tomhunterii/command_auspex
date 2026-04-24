// app/lib/datasheet-parser.js
// Parse a markdown datasheet into structured data.
// Datasheets follow the repo convention: `# Name`, then sections like
// `## Base`, `## Profile`, `## Ranged Weapons`, etc.

/**
 * Extract a section's raw body by heading name.
 * Returns the text between `## Heading` and the next `## ` heading (or EOF).
 * Uses split-based extraction to avoid multiline regex `$` anchor issues.
 */
function extractSection(text, heading) {
  const parts = text.split(/^## /m);
  for (const p of parts) {
    if (p.startsWith(heading + '\n') || p.startsWith(heading + '\r')) {
      const nl = p.indexOf('\n');
      return p.slice(nl + 1).trim();
    }
  }
  return null;
}

function parseBase(body) {
  if (!body) return null;
  const result = { shape: null, flight_stem: false };

  const shapeMatch = /\*\*Shape:\*\*\s*(\S+)/i.exec(body);
  if (shapeMatch) result.shape = shapeMatch[1].toLowerCase();

  const diaMatch = /\*\*Diameter:\*\*\s*([\d.]+)\s*mm/i.exec(body);
  if (diaMatch) result.diameter_mm = parseFloat(diaMatch[1]);

  // Handle both Unicode × (U+00D7) and ASCII x as the separator
  const dimMatch = /\*\*Dimensions:\*\*\s*([\d.]+)\s*mm\s*[×x]\s*([\d.]+)\s*mm/i.exec(body);
  if (dimMatch) {
    result.length_mm = parseFloat(dimMatch[1]);
    result.width_mm = parseFloat(dimMatch[2]);
  }

  const flightMatch = /\*\*Flight stem:\*\*\s*(yes|no)/i.exec(body);
  if (flightMatch) result.flight_stem = flightMatch[1].toLowerCase() === 'yes';

  // Per-model bases (optional). Format under `- **Per-model bases:**`:
  //   `  - <Submodel>: <shape>, <N>mm`
  // e.g. Wardens of Ultramar has mixed 40mm + 28.5mm bases across 6 named models.
  const perModelMatches = [...body.matchAll(/^\s{2,}-\s+(.+?):\s+(\w+),\s+([\d.]+)\s*mm/gim)];
  if (perModelMatches.length > 0) {
    result.per_model = perModelMatches.map(m => ({
      submodel: m[1].trim(),
      shape: m[2].toLowerCase(),
      diameter_mm: parseFloat(m[3]),
    }));
  }

  return result;
}

function parseProfile(body) {
  if (!body) return null;
  const lines = body.split('\n').map(l => l.trim()).filter(l => l.startsWith('|'));
  if (lines.length < 3) return null;
  const headers = lines[0].split('|').map(s => s.trim()).filter(Boolean);
  const data = lines[2].split('|').map(s => s.trim()).filter(Boolean);
  const profile = {};
  for (let i = 0; i < headers.length; i++) {
    const key = headers[i];
    let value = data[i];
    const n = parseInt(value, 10);
    profile[key] = Number.isNaN(n) ? value : (String(n) === value ? n : value);
  }
  return profile;
}

function parseMaxRange(body) {
  if (!body) return null;
  const lines = body.split('\n').filter(l => l.trim().startsWith('|') && !l.includes('---') && !/Weapon/i.test(l));
  let max = 0;
  for (const line of lines) {
    const cells = line.split('|').map(s => s.trim());
    if (cells.length < 3) continue;
    const rangeCell = cells[2];
    const m = /(\d+)/.exec(rangeCell);
    if (m) {
      const r = parseInt(m[1], 10);
      if (r > max) max = r;
    }
  }
  return max || null;
}

export function parseDatasheet(text) {
  const titleMatch = /^#\s+(.+)$/m.exec(text);
  const name = titleMatch ? titleMatch[1].trim() : null;

  const base = parseBase(extractSection(text, 'Base'));
  const profile = parseProfile(extractSection(text, 'Profile'));
  const ranged = extractSection(text, 'Ranged Weapons');
  const max_range_in = parseMaxRange(ranged);

  return { name, base, profile, max_range_in };
}
