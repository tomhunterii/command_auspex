#!/usr/bin/env node
// scripts/build-icons.js
// Copies the 7 role-marker SVG files from @fortawesome/fontawesome-free into
// app/vendor/icons/ so the desktop build bundles them without a node_modules
// runtime dependency.
//
// Pro upgrade path: swap FA_DIR to point at the Pro package and update
// ICONS (e.g. 'helmet-battle', 'sword', 'crown') — no other changes needed.

import { copyFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = dirname(HERE);
const FA_DIR = join(REPO, 'node_modules', '@fortawesome', 'fontawesome-free', 'svgs', 'solid');
const OUT = join(REPO, 'app', 'vendor', 'icons');

const ICONS = [
  'chevron-up',  // Battleline
  'xmark',       // Close Support
  'angle-up',    // Fire Support
  'skull',       // Leader
  'shield',      // Vehicle / Walker
  'star',        // Sergeant
  // Veterans use unicode ✠ rendered as <text> — no SVG icon needed.
];

mkdirSync(OUT, { recursive: true });
// Clear stale SVGs so renames don't leave dead files behind.
for (const f of readdirSync(OUT)) {
  if (f.endsWith('.svg')) unlinkSync(join(OUT, f));
}
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
