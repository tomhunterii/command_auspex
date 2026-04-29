// app/lib/fs-tauri.js
//
// Thin wrapper over tauri-plugin-fs. All paths are AppData-relative so user-
// pasted rosters and saved scenarios live in the writable app-data directory
// alongside the catalogue.db (see src-tauri/src/main.rs install_catalogue).
//
// AppData base directory. Matches @tauri-apps/api/path BaseDirectory.AppData.
const APP_DATA = 2;

import { parseFrontmatter } from './yaml-frontmatter.js';
import { slugify } from './roster-parser.js';

function ipc() {
  if (typeof window === 'undefined' || !window.__TAURI_INTERNALS__) {
    throw new Error('Tauri runtime not detected — fs-tauri is desktop-only');
  }
  return window.__TAURI_INTERNALS__.invoke;
}

async function ensureDir(relPath) {
  const invoke = ipc();
  // mkdir is idempotent with recursive: true.
  await invoke('plugin:fs|mkdir', {
    path: relPath,
    options: { baseDir: APP_DATA, recursive: true },
  });
}

async function readTextFile(relPath) {
  const invoke = ipc();
  return invoke('plugin:fs|read_text_file', {
    path: relPath,
    options: { baseDir: APP_DATA },
  });
}

async function writeTextFile(relPath, contents) {
  const invoke = ipc();
  return invoke('plugin:fs|write_text_file', {
    path: relPath,
    contents,
    options: { baseDir: APP_DATA },
  });
}

async function readDirEntries(relPath) {
  const invoke = ipc();
  try {
    return await invoke('plugin:fs|read_dir', {
      path: relPath,
      options: { baseDir: APP_DATA },
    });
  } catch {
    return [];
  }
}

async function exists(relPath) {
  const invoke = ipc();
  try {
    return await invoke('plugin:fs|exists', {
      path: relPath,
      options: { baseDir: APP_DATA },
    });
  } catch {
    return false;
  }
}

// ── Rosters (user-pasted, written by VOX-SCRIBE) ───────────────────────────

const ROSTER_DIR = 'rosters';

export async function writeFilesystemRoster(slug, md) {
  await ensureDir(ROSTER_DIR);
  await writeTextFile(`${ROSTER_DIR}/${slug}.md`, md);
}

export async function readFilesystemRoster(slug) {
  return readTextFile(`${ROSTER_DIR}/${slug}.md`);
}

export async function filesystemRosterExists(slug) {
  return exists(`${ROSTER_DIR}/${slug}.md`);
}

// Returns rows in the same shape as catalogue listRosters():
//   { slug, name, faction_slug, points_cap }
export async function listFilesystemRosters() {
  const entries = await readDirEntries(ROSTER_DIR);
  const out = [];
  for (const e of entries) {
    if (!e.name?.endsWith('.md')) continue;
    const slug = e.name.slice(0, -3);
    try {
      const text = await readFilesystemRoster(slug);
      const fm = await parseFrontmatter(text);
      if (!fm) continue;
      out.push({
        slug,
        name: fm.list_name ?? slug,
        faction_slug: slugify(fm.faction ?? ''),
        points_cap: fm.list_points ?? null,
      });
    } catch {
      // Malformed file — skip silently rather than break the dropdown.
    }
  }
  return out;
}

// ── Scenarios ──────────────────────────────────────────────────────────────

const SCENARIO_DIR = 'scenarios';

export async function writeFilesystemScenario(slug, md) {
  await ensureDir(SCENARIO_DIR);
  await writeTextFile(`${SCENARIO_DIR}/${slug}.md`, md);
}

export async function readFilesystemScenario(slug) {
  return readTextFile(`${SCENARIO_DIR}/${slug}.md`);
}

// Returns: Array<{ slug, name, last_modified }>
export async function listFilesystemScenarios() {
  const entries = await readDirEntries(SCENARIO_DIR);
  const out = [];
  for (const e of entries) {
    if (!e.name?.endsWith('.md')) continue;
    const slug = e.name.slice(0, -3);
    try {
      const text = await readFilesystemScenario(slug);
      const fm = await parseFrontmatter(text);
      if (!fm) continue;
      out.push({
        slug,
        name: fm.name ?? slug,
        last_modified: fm.last_modified ?? null,
      });
    } catch {
      // skip malformed
    }
  }
  out.sort((a, b) => (b.last_modified ?? '').localeCompare(a.last_modified ?? ''));
  return out;
}
