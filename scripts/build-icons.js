#!/usr/bin/env node
// scripts/build-icons.js
// Copies the 7 role-marker SVG files from @fortawesome/fontawesome-free into
// app/vendor/icons/ so the desktop build bundles them without a node_modules
// runtime dependency.
//
// Pro upgrade path: swap FA_DIR to point at the Pro package and update
// ICONS (e.g. 'helmet-battle', 'sword', 'crown') — no other changes needed.

import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = dirname(HERE);
const FA_DIR = join(REPO, 'node_modules', '@fortawesome', 'fontawesome-free', 'svgs', 'solid');
const OUT = join(REPO, 'app', 'vendor', 'icons');

// tank-rectangle is Pro-only; using truck-monster (FA Free) as fallback.
// The sprite loader and renderer key off the filename, so the HTML and
// render.js use 'truck-monster' to match. See commit message for Pro swap.
const ICONS = [
  'chevron-up',    // Battleline
  'chess-knight',  // Close Support
  'crosshairs',    // Fire Support
  'shield-halved', // Veteran
  'skull',         // Leader (solid skull, no crossbones — FA Free)
  'truck-monster', // Vehicle / Walker (tank-rectangle is Pro-only)
  'star',          // Sergeant
];

mkdirSync(OUT, { recursive: true });
let copied = 0;
for (const name of ICONS) {
  const src = join(FA_DIR, `${name}.svg`);
  if (!existsSync(src)) {
    console.warn(`[build-icons] missing ${name}.svg in FA Free — skipping; check Pro/Free status`);
    continue;
  }
  copyFileSync(src, join(OUT, `${name}.svg`));
  copied++;
}
console.log(`[build-icons] copied ${copied}/${ICONS.length} icons to app/vendor/icons/`);
