// app/lib/fs-tauri.js
//
// AppData-relative file IO via custom Tauri commands defined in
// src-tauri/src/main.rs (user_write_text, user_read_text, user_list_dir,
// user_file_exists, user_mkdir). Bypasses tauri-plugin-fs's request-body
// IPC pattern (which mismatches the plain `invoke(cmd, args)` pattern this
// app uses everywhere else). All paths are relative to app_data_dir; the
// Rust side rejects absolute paths and traversal.

import { parseFrontmatter } from './yaml-frontmatter.js';
import { slugify } from './roster-parser.js';

function ipc() {
  if (typeof window === 'undefined' || !window.__TAURI_INTERNALS__) {
    throw new Error('Tauri runtime not detected — fs-tauri is desktop-only');
  }
  return window.__TAURI_INTERNALS__.invoke;
}

async function ensureDir(relPath) {
  await ipc()('user_mkdir', { path: relPath });
}

async function readTextFile(relPath) {
  return ipc()('user_read_text', { path: relPath });
}

async function writeTextFile(relPath, contents) {
  return ipc()('user_write_text', { path: relPath, contents });
}

async function readDirEntries(relPath) {
  try {
    const names = await ipc()('user_list_dir', { path: relPath });
    return names.map(name => ({ name }));
  } catch {
    return [];
  }
}

async function exists(relPath) {
  try {
    return await ipc()('user_file_exists', { path: relPath });
  } catch {
    return false;
  }
}

async function deleteFile(relPath) {
  await ipc()('user_delete', { path: relPath });
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

// Permanently remove a user-pasted roster from app-data. Idempotent —
// missing files return success. Bundled (catalogue-baked) rosters CANNOT
// be deleted via this path; the UI is responsible for gating the affordance.
export async function deleteFilesystemRoster(slug) {
  await deleteFile(`${ROSTER_DIR}/${slug}.md`);
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

// Permanently remove a saved scenario from app-data. Idempotent — a
// missing file returns success.
export async function deleteFilesystemScenario(slug) {
  await deleteFile(`${SCENARIO_DIR}/${slug}.md`);
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
