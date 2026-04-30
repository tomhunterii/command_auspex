// Phase 2A — user-save.md round-trip + migration coverage.
//
// user-save.js talks to the Rust backend via window.__TAURI_INTERNALS__.invoke.
// We fake that with an in-memory file map so the module's load/save/migrate
// paths run end-to-end without spawning a Tauri runtime.

import { test } from 'node:test';
import assert from 'node:assert';

function setupFakeTauri() {
  const files = new Map(); // relPath → string contents
  const dirs = new Map();  // relPath → string[]
  const invoke = async (cmd, args) => {
    switch (cmd) {
      case 'user_file_exists':
        return files.has(args.path);
      case 'user_read_text': {
        if (!files.has(args.path)) throw new Error(`ENOENT: ${args.path}`);
        return files.get(args.path);
      }
      case 'user_write_text': {
        files.set(args.path, args.contents);
        // Track parent dir membership so user_list_dir can find files.
        const parent = args.path.includes('/') ? args.path.split('/').slice(0, -1).join('/') : '';
        const name = args.path.split('/').pop();
        const list = dirs.get(parent) ?? [];
        if (!list.includes(name)) list.push(name);
        dirs.set(parent, list);
        return undefined;
      }
      case 'user_list_dir':
        return dirs.get(args.path) ?? [];
      case 'user_mkdir':
        if (!dirs.has(args.path)) dirs.set(args.path, []);
        return undefined;
      case 'user_delete': {
        files.delete(args.path);
        return undefined;
      }
      default:
        throw new Error(`unmocked invoke: ${cmd}`);
    }
  };
  globalThis.window = { __TAURI_INTERNALS__: { invoke } };
  return { files, dirs };
}

function teardownFakeTauri() {
  delete globalThis.window;
}

async function freshModule() {
  // Cache-bust the import so each test gets module-state isolation.
  return import(`../app/lib/user-save.js?t=${Math.random()}`);
}

test('loadUserSave returns empty save when file is missing', async () => {
  setupFakeTauri();
  try {
    const { loadUserSave } = await freshModule();
    const save = await loadUserSave();
    assert.deepStrictEqual(save, { schema_version: 1, rosters: [] });
  } finally {
    teardownFakeTauri();
  }
});

test('saveUserSave then loadUserSave round-trips a multi-roster save', async () => {
  setupFakeTauri();
  try {
    const { saveUserSave, loadUserSave } = await freshModule();
    const input = {
      schema_version: 1,
      rosters: [
        {
          slug: 'ultramarines-2nd',
          name: '2nd Company',
          faction_slug: 'space-marines',
          detachment_slug: 'gladius',
          points_cap: 2000,
          body_md: '## CAPTAIN (×1) [80]\n- bolt pistol\n- master-crafted power weapon',
        },
        {
          slug: 'tyranid-vanguard',
          name: 'Vanguard Swarm',
          faction_slug: 'tyranids',
          detachment_slug: null,
          points_cap: 1000,
          body_md: '## ZOANTHROPES (×3) [110]\n- warp blast',
        },
      ],
    };
    await saveUserSave(input);
    const loaded = await loadUserSave();
    assert.strictEqual(loaded.schema_version, 1);
    assert.strictEqual(loaded.rosters.length, 2);
    assert.deepStrictEqual(loaded.rosters[0], input.rosters[0]);
    assert.deepStrictEqual(loaded.rosters[1], input.rosters[1]);
  } finally {
    teardownFakeTauri();
  }
});

test('body_md containing literal --- survives round-trip', async () => {
  // The whole reason user-save.md is pure YAML (not frontmatter-delimited):
  // body_md may contain '---' lines and the outer parser must not choke.
  setupFakeTauri();
  try {
    const { saveUserSave, loadUserSave } = await freshModule();
    const trickyBody = '## SQUAD (×5) [100]\n---\n- bolter\n---\n- chainsword';
    await saveUserSave({
      schema_version: 1,
      rosters: [{
        slug: 'tricky',
        name: 'Tricky',
        faction_slug: null,
        detachment_slug: null,
        points_cap: null,
        body_md: trickyBody,
      }],
    });
    const loaded = await loadUserSave();
    assert.strictEqual(loaded.rosters[0].body_md, trickyBody);
  } finally {
    teardownFakeTauri();
  }
});

test('migrateLegacyRostersIfNeeded folds rosters/*.md into user-save.md', async () => {
  const { files } = setupFakeTauri();
  try {
    // Pre-seed two legacy rosters in app-data.
    files.set('rosters/foo.md', [
      '---',
      'list_name: Foo Squad',
      'faction: Space Marines',
      'list_points: 500',
      '---',
      '',
      '## CAPTAIN (×1) [80]',
      '- bolt pistol',
    ].join('\n'));
    files.set('rosters/bar.md', [
      '---',
      'list_name: Bar Swarm',
      'faction: Tyranids',
      '---',
      '',
      '## ZOANTHROPES (×3) [110]',
    ].join('\n'));
    // Make user_list_dir return them.
    globalThis.window.__TAURI_INTERNALS__.invoke('user_write_text', { path: 'rosters/foo.md', contents: files.get('rosters/foo.md') });
    globalThis.window.__TAURI_INTERNALS__.invoke('user_write_text', { path: 'rosters/bar.md', contents: files.get('rosters/bar.md') });

    const { migrateLegacyRostersIfNeeded, loadUserSave } = await freshModule();
    const migrated = await migrateLegacyRostersIfNeeded();
    assert.strictEqual(migrated, 2);

    const save = await loadUserSave();
    assert.strictEqual(save.rosters.length, 2);
    const foo = save.rosters.find(r => r.slug === 'foo');
    assert.strictEqual(foo.name, 'Foo Squad');
    assert.strictEqual(foo.faction_slug, 'space-marines');
    assert.strictEqual(foo.points_cap, 500);
    assert.match(foo.body_md, /CAPTAIN/);
    assert.doesNotMatch(foo.body_md, /^---/);
  } finally {
    teardownFakeTauri();
  }
});

test('migration is idempotent: second call is a no-op', async () => {
  setupFakeTauri();
  try {
    const { migrateLegacyRostersIfNeeded, saveUserSave } = await freshModule();
    await saveUserSave({ schema_version: 1, rosters: [{
      slug: 'existing', name: 'Existing', faction_slug: null,
      detachment_slug: null, points_cap: null, body_md: 'body',
    }] });
    const result = await migrateLegacyRostersIfNeeded();
    assert.strictEqual(result, 0);
  } finally {
    teardownFakeTauri();
  }
});

test('upsertRosterInUserSave inserts then replaces by slug', async () => {
  setupFakeTauri();
  try {
    const { upsertRosterInUserSave, loadUserSave } = await freshModule();
    const md1 = '---\nlist_name: First\nfaction: Space Marines\nlist_points: 1000\n---\n\n## CAPTAIN (×1) [80]';
    await upsertRosterInUserSave('first', md1);
    let save = await loadUserSave();
    assert.strictEqual(save.rosters.length, 1);
    assert.strictEqual(save.rosters[0].name, 'First');

    const md2 = '---\nlist_name: First Renamed\nfaction: Space Marines\nlist_points: 1500\n---\n\n## NEW BODY';
    await upsertRosterInUserSave('first', md2);
    save = await loadUserSave();
    assert.strictEqual(save.rosters.length, 1, 'upsert should replace, not duplicate');
    assert.strictEqual(save.rosters[0].name, 'First Renamed');
    assert.strictEqual(save.rosters[0].points_cap, 1500);
    assert.match(save.rosters[0].body_md, /NEW BODY/);
  } finally {
    teardownFakeTauri();
  }
});

test('deleteRosterFromUserSave removes by slug; missing slug is no-op', async () => {
  setupFakeTauri();
  try {
    const { upsertRosterInUserSave, deleteRosterFromUserSave, loadUserSave } = await freshModule();
    await upsertRosterInUserSave('keep', '---\nlist_name: Keep\n---\n\nbody');
    await upsertRosterInUserSave('drop', '---\nlist_name: Drop\n---\n\nbody');
    await deleteRosterFromUserSave('drop');
    const save = await loadUserSave();
    assert.strictEqual(save.rosters.length, 1);
    assert.strictEqual(save.rosters[0].slug, 'keep');

    // Idempotent: deleting a missing slug doesn't throw.
    await deleteRosterFromUserSave('nonexistent');
    const after = await loadUserSave();
    assert.strictEqual(after.rosters.length, 1);
  } finally {
    teardownFakeTauri();
  }
});

test('entryToRosterMarkdown + upsert round-trips through editor flow', async () => {
  setupFakeTauri();
  try {
    const { upsertRosterInUserSave, loadUserSave, entryToRosterMarkdown } = await freshModule();
    // Seed an existing roster.
    await upsertRosterInUserSave('alpha', [
      '---',
      'list_name: Alpha Squad',
      'faction: Space Marines',
      'list_points: 1000',
      '---',
      '',
      '## CAPTAIN (×1) [80]',
      '- bolt pistol',
    ].join('\n'));

    // Open the editor: render to text, mutate, save back.
    const before = await loadUserSave();
    const md = entryToRosterMarkdown(before.rosters[0]);
    assert.match(md, /^---\n/);
    assert.match(md, /list_name: Alpha Squad/);
    assert.match(md, /list_points: 1000/);
    assert.match(md, /CAPTAIN/);

    const edited = md.replace('Alpha Squad', 'Alpha Squad MK II').replace('1000', '1500');
    await upsertRosterInUserSave('alpha', edited);

    const after = await loadUserSave();
    assert.strictEqual(after.rosters.length, 1);
    assert.strictEqual(after.rosters[0].name, 'Alpha Squad MK II');
    assert.strictEqual(after.rosters[0].points_cap, 1500);
    // Body preserved through the round-trip.
    assert.match(after.rosters[0].body_md, /CAPTAIN/);
  } finally {
    teardownFakeTauri();
  }
});

test('listUserSaveRosters returns origin-tagged rows in legacy shape', async () => {
  setupFakeTauri();
  try {
    const { upsertRosterInUserSave, listUserSaveRosters } = await freshModule();
    await upsertRosterInUserSave('alpha', '---\nlist_name: Alpha Squad\nfaction: Space Marines\nlist_points: 750\n---\n\nbody');
    const rows = await listUserSaveRosters();
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].slug, 'alpha');
    assert.strictEqual(rows[0].name, 'Alpha Squad');
    assert.strictEqual(rows[0].faction_slug, 'space-marines');
    assert.strictEqual(rows[0].points_cap, 750);
    assert.strictEqual(rows[0].origin, 'user-save');
    assert.strictEqual(rows[0].source_path, 'user-save.md#alpha');
  } finally {
    teardownFakeTauri();
  }
});
