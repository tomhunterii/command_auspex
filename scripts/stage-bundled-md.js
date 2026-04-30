#!/usr/bin/env node
// scripts/stage-bundled-md.js
//
// Mirrors `datasheets/` and `missions/` from the repo root into
// `src-tauri/resources/` so Tauri can ship them as bundle resources.
// Run from `tauri:build` ahead of `tauri build`. The destination trees
// are wiped first to keep them byte-equivalent to the source — no stale
// files survive a deletion in the canonical directory.
//
// At runtime, the Rust `seed` module copies these out of the resource
// dir into `<app_data>/datasheets/` and `<app_data>/missions/` on first
// launch (Phase 1B), where they become the user-editable source of
// truth for catalogue rebuilds (Phase 1C).

import { readdirSync, statSync, mkdirSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = dirname(HERE);
const STAGE_ROOT = join(REPO, 'src-tauri', 'resources');

const TREES = ['datasheets', 'missions'];

function copyTree(src, dst) {
  mkdirSync(dst, { recursive: true });
  for (const entry of readdirSync(src)) {
    const sp = join(src, entry);
    const dp = join(dst, entry);
    const st = statSync(sp);
    if (st.isDirectory()) {
      copyTree(sp, dp);
    } else if (st.isFile()) {
      copyFileSync(sp, dp);
    }
  }
}

let totalFiles = 0;
function countMd(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) countMd(p);
    else if (st.isFile() && entry.endsWith('.md')) totalFiles += 1;
  }
}

for (const tree of TREES) {
  const src = join(REPO, tree);
  const dst = join(STAGE_ROOT, tree);
  if (!existsSync(src)) {
    console.warn(`stage-bundled-md: source missing, skipping: ${relative(REPO, src)}`);
    continue;
  }
  if (existsSync(dst)) rmSync(dst, { recursive: true, force: true });
  copyTree(src, dst);
  countMd(dst);
}

console.log(`stage-bundled-md: ${totalFiles} markdown files staged → ${relative(REPO, STAGE_ROOT)}/{${TREES.join(',')}}`);
