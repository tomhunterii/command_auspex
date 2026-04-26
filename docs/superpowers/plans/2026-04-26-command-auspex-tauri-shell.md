# Command Auspex — Tauri Shell (Milestone 0.1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap the existing static `app/command-auspex.html` in a Tauri 2.x desktop shell so it ships as a free, packaged `.dmg` / `.msi` / `.AppImage` with no behavioral regressions.

**Architecture:** A Tauri 2.x Rust shell hosts the existing HTML/JS frontend unchanged. A duck-typed `TauriDirectoryHandle` shim mimics the File System Access API surface that `app/lib/fs.js` already targets, so call sites need no edits. Bundled markdown ships as Tauri resources (read-only); user-mutable content (scenarios, paste-imported rosters) lives in the OS app-data directory, seeded from resources on first launch. GitHub Actions builds for macOS/Windows/Linux on tag push.

**Tech Stack:** Tauri 2.x · Rust stable · Node 20+ · `@tauri-apps/cli` · `tauri-plugin-fs` · `tauri-plugin-dialog` · existing Node `--test` runner · GitHub Actions + `tauri-apps/tauri-action`.

---

## File Structure

### Files created

```
src-tauri/
  Cargo.toml                       # Rust crate config + Tauri deps
  tauri.conf.json                  # window, bundle, security, resources
  build.rs                         # tauri-build runs at compile
  src/
    main.rs                        # entry: tauri::Builder + plugins
  capabilities/
    default.json                   # fs + dialog permissions
  icons/
    32x32.png                      # placeholders for v0.1.0
    128x128.png
    128x128@2x.png
    icon.icns
    icon.ico

app/lib/
  tauri-fs-shim.js                 # FSA-shaped wrapper over @tauri-apps/plugin-fs
  runtime.js                       # detect Tauri vs browser, return correct root

tests/
  tauri-fs-shim.test.js            # unit-test the shim with an injected mock
  runtime.test.js                  # smoke-test the detection branch logic

scripts/
  tauri-seed-paths.mjs             # build-time enumeration of markdown for the bundle resources list

.github/workflows/
  release.yml                      # tag-triggered cross-platform tauri build
```

### Files modified

```
package.json                       # +scripts (tauri:dev, tauri:build), +devDeps (@tauri-apps/cli)
app/command-auspex.html            # CONNECT REPO branches to runtime.js helper; preserves FSA fallback
.gitignore                         # +src-tauri/target/, +src-tauri/gen/
```

### Files unchanged (load-bearing for the no-regression goal)

```
app/lib/fs.js                      # already path-abstracted; shim conforms to its expectations
app/lib/{yaml-frontmatter,roster-parser,datasheet-parser,render,auto-placement,scenario,base-geometry,geometry}.js
tests/*.test.js                    # all 206 existing tests must pass
```

---

## Task 1: Tauri scaffolding — Cargo + main.rs + tauri.conf.json

**Files:**
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/capabilities/default.json`
- Modify: `.gitignore` (append `src-tauri/target/` and `src-tauri/gen/`)

- [ ] **Step 1: Create the Cargo crate manifest**

Create `src-tauri/Cargo.toml`:

```toml
[package]
name = "command-auspex"
version = "0.1.0"
description = "Command Auspex — list-building battle simulator"
authors = ["Tom Hunter"]
edition = "2021"
rust-version = "1.77"

[lib]
name = "command_auspex_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-fs = "2"
tauri-plugin-dialog = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"

[profile.release]
opt-level = "s"
lto = true
codegen-units = 1
strip = true
```

- [ ] **Step 2: Create the Rust build script**

Create `src-tauri/build.rs`:

```rust
fn main() {
    tauri_build::build()
}
```

- [ ] **Step 3: Create the Rust entry point**

Create `src-tauri/src/main.rs`:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("error while running Command Auspex");
}
```

- [ ] **Step 4: Create the Tauri configuration**

Create `src-tauri/tauri.conf.json`:

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Command Auspex",
  "version": "0.1.0",
  "identifier": "com.ultramarines.command-auspex",
  "build": {
    "frontendDist": "../app",
    "devUrl": "http://localhost:1420",
    "beforeDevCommand": "",
    "beforeBuildCommand": ""
  },
  "app": {
    "windows": [
      {
        "title": "Command Auspex // Hololith-Sigma",
        "width": 1440,
        "height": 900,
        "minWidth": 1024,
        "minHeight": 720,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": null
    },
    "withGlobalTauri": true
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "resources": [
      "../app/**/*",
      "../datasheets/**/*.md",
      "../ultramarines/**/*.md",
      "../500 Worlds Campaign/**/*",
      "../fonts/**/*"
    ],
    "category": "Utility",
    "shortDescription": "Command Auspex — list-building battle simulator",
    "longDescription": "Wargame planning tool for Warhammer 40,000 10th edition: place units on mission maps, see threat ranges, and assess list efficiency."
  }
}
```

- [ ] **Step 5: Create the capabilities manifest**

Create `src-tauri/capabilities/default.json`:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default capabilities: filesystem (resource + appdata) and dialogs.",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:default",
    "fs:default",
    "fs:allow-read-text-file",
    "fs:allow-write-text-file",
    "fs:allow-read-dir",
    "fs:allow-mkdir",
    "fs:allow-exists",
    {
      "identifier": "fs:scope",
      "allow": [
        { "path": "$RESOURCE/**" },
        { "path": "$APPDATA/**" }
      ]
    },
    "dialog:default",
    "dialog:allow-open",
    "dialog:allow-save"
  ]
}
```

- [ ] **Step 6: Generate placeholder icons via @tauri-apps/cli**

The Tauri CLI's `icon` subcommand generates every required size and format from one square source PNG. Bootstrap a placeholder source by writing a known-good 1024×1024 solid-fill PNG using Node (no ImageMagick dependency):

```bash
cd "/Users/tomhunterii/Documents/Warhammer 40k/src-tauri/icons"

# Write a 1024×1024 solid-color PNG using only Node's zlib (no extra deps).
node --input-type=module -e "
  import { writeFileSync } from 'node:fs';
  import { deflateSync } from 'node:zlib';
  const W = 1024, H = 1024;
  // 4 bytes per pixel: deep-blue background.
  const row = Buffer.alloc(W * 4 + 1);
  row[0] = 0; // filter type 'None'
  for (let x = 0; x < W; x++) { row[1 + x*4 + 0] = 0x00; row[1 + x*4 + 1] = 0x1a; row[1 + x*4 + 2] = 0x33; row[1 + x*4 + 3] = 0xff; }
  const raw = Buffer.concat(Array.from({ length: H }, () => row));
  const compressed = deflateSync(raw);
  const sig = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type);
    const crcInput = Buffer.concat([t, data]);
    let crc = 0xffffffff;
    for (let i = 0; i < crcInput.length; i++) {
      crc = crc ^ crcInput[i];
      for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    const c = Buffer.alloc(4); c.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 0);
    return Buffer.concat([len, t, data, c]);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  writeFileSync('source.png', Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]));
"

# Now expand to every Tauri-required icon size/format:
npx -y @tauri-apps/cli icon source.png -o .
```

Expected output: `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico` all present in the icons directory. Verify with `ls -1`.

A real branded icon is a v0.1.x polish item; a solid-color placeholder is acceptable for the first tagged build.

- [ ] **Step 7: Update `.gitignore`**

Append to `/Users/tomhunterii/Documents/Warhammer 40k/.gitignore`:

```
# Tauri build artifacts
src-tauri/target/
src-tauri/gen/
src-tauri/icons/source.png
```

- [ ] **Step 8: Commit**

```bash
cd "/Users/tomhunterii/Documents/Warhammer 40k"
git add src-tauri/Cargo.toml src-tauri/build.rs src-tauri/src/main.rs \
        src-tauri/tauri.conf.json src-tauri/capabilities/default.json \
        src-tauri/icons/32x32.png src-tauri/icons/128x128.png \
        src-tauri/icons/128x128@2x.png src-tauri/icons/icon.icns \
        src-tauri/icons/icon.ico .gitignore
git commit -m "$(cat <<'EOF'
tauri: scaffold Tauri 2.x shell + fs/dialog plugins

Cargo manifest, tauri.conf.json with bundled markdown resources,
capabilities allowing $RESOURCE and $APPDATA reads/writes, placeholder
app icons. No frontend wiring yet.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: npm wiring — devDeps + scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Read current package.json**

Confirm current `package.json` contents (already in context — `type: module`, scripts.test = `node --test tests/*.test.js`, devDeps `js-yaml`, deps `bootstrap`).

- [ ] **Step 2: Add Tauri CLI and frontend dep entries**

Replace the entire file at `/Users/tomhunterii/Documents/Warhammer 40k/package.json`:

```json
{
  "name": "warhammer-40k",
  "version": "0.1.0",
  "description": "Command Auspex — list-building battle simulator",
  "main": "index.js",
  "directories": {
    "doc": "docs",
    "test": "tests"
  },
  "scripts": {
    "test": "node --test tests/*.test.js",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build"
  },
  "type": "module",
  "devDependencies": {
    "@tauri-apps/cli": "^2",
    "js-yaml": "^4.1.1"
  },
  "dependencies": {
    "@tauri-apps/api": "^2",
    "@tauri-apps/plugin-dialog": "^2",
    "@tauri-apps/plugin-fs": "^2",
    "bootstrap": "^5.3.8"
  }
}
```

- [ ] **Step 3: Install**

```bash
cd "/Users/tomhunterii/Documents/Warhammer 40k"
npm install
```

Expected: `package-lock.json` updated; `node_modules/@tauri-apps/cli/`, `node_modules/@tauri-apps/api/`, `node_modules/@tauri-apps/plugin-fs/`, `node_modules/@tauri-apps/plugin-dialog/` all present. No errors.

- [ ] **Step 4: Verify existing tests still pass**

```bash
npm test 2>&1 | tail -5
```

Expected: `# pass 206` (or whatever the current passing count is — must match pre-change).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "$(cat <<'EOF'
build: add @tauri-apps/{cli,api,plugin-fs,plugin-dialog} deps

CLI as devDep; api + plugin-fs + plugin-dialog as runtime deps so the
frontend can import them when running inside the Tauri shell. Adds
tauri:dev and tauri:build npm scripts. All 206 existing tests still pass.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Smoke test — `tauri:dev` opens existing app

This is a manual integration check (no automated test). The goal: confirm the Tauri scaffolding is wired correctly before adding any new logic.

**Files:** none modified.

- [ ] **Step 1: Run dev server**

```bash
cd "/Users/tomhunterii/Documents/Warhammer 40k"
npm run tauri:dev
```

Expected: Rust compiles (~2-5 min cold), then a native window opens titled "Command Auspex // Hololith-Sigma" rendering `app/command-auspex.html`. The boot overlay animation plays. Topbar shows `CONNECT REPO`, mission/force selects, etc.

The CONNECT REPO button currently fails inside Tauri because `window.showDirectoryPicker` does not exist in the WebView2/WKWebView. **This is expected** — Task 7 fixes it. The smoke test only verifies the chrome renders.

- [ ] **Step 2: Take a screenshot for the commit log**

```bash
mkdir -p "/Users/tomhunterii/Documents/Warhammer 40k/docs/screenshots"
# After window opens, take a system screenshot:
# macOS: cmd+shift+4, then space, click window
# Save to: docs/screenshots/tauri-shell-boot.png
```

- [ ] **Step 3: Quit dev server**

Press `cmd+q` (Mac) or close the window. The Rust process exits cleanly.

- [ ] **Step 4: No commit needed**

This is verification only; no source changes were made. Move to Task 4.

---

## Task 4: TauriDirectoryHandle shim — TDD with injected mock

**Files:**
- Create: `app/lib/tauri-fs-shim.js`
- Create: `tests/tauri-fs-shim.test.js`

The shim mimics the File System Access API surface that `app/lib/fs.js` consumes (`getDirectoryHandle`, `getFileHandle`, async `entries()`, `getFile().text()`, `createWritable()` with `write()` + `close()`). It is parameterized over a filesystem driver — production wires the real `@tauri-apps/plugin-fs` API, tests wire a Map-backed in-memory mock. This isolation means the shim is pure-JS-testable without a Tauri runtime.

- [ ] **Step 1: Write failing test for directory traversal**

Create `tests/tauri-fs-shim.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert';
import { TauriDirectoryHandle } from '../app/lib/tauri-fs-shim.js';

// In-memory FS driver for tests.
// Files: Map<absolutePath, string>. Directories are implicit (any prefix that has children).
function makeDriver(files) {
  const fs = new Map(Object.entries(files));
  return {
    async exists(path) { return fs.has(path) || [...fs.keys()].some(k => k.startsWith(path + '/')); },
    async isFile(path) { return fs.has(path); },
    async readTextFile(path) {
      if (!fs.has(path)) {
        const err = new Error('not found');
        err.name = 'NotFoundError';
        throw err;
      }
      return fs.get(path);
    },
    async writeTextFile(path, content) { fs.set(path, content); },
    async mkdir(_path) { /* implicit; no-op for in-memory driver */ },
    async readDir(path) {
      const out = [];
      const seen = new Set();
      const prefix = path === '' ? '' : path + '/';
      for (const k of fs.keys()) {
        if (!k.startsWith(prefix)) continue;
        const rest = k.slice(prefix.length);
        if (rest === '') continue;
        const head = rest.split('/')[0];
        if (seen.has(head)) continue;
        seen.add(head);
        const isFile = rest === head;
        out.push({ name: head, isDirectory: !isFile, isFile });
      }
      return out;
    },
  };
}

test('TauriDirectoryHandle.getDirectoryHandle traverses one level', async () => {
  const driver = makeDriver({ 'datasheets/space-marines/units/intercessor-squad.md': 'body' });
  const root = new TauriDirectoryHandle({ driver, path: '' });
  const ds = await root.getDirectoryHandle('datasheets');
  assert.strictEqual(ds.name, 'datasheets');
  assert.strictEqual(ds.kind, 'directory');
});

test('TauriDirectoryHandle.getDirectoryHandle throws NotFoundError on missing dir', async () => {
  const driver = makeDriver({});
  const root = new TauriDirectoryHandle({ driver, path: '' });
  await assert.rejects(
    () => root.getDirectoryHandle('nope'),
    err => err.name === 'NotFoundError'
  );
});

test('TauriDirectoryHandle.getDirectoryHandle with create:true does not throw on missing', async () => {
  const driver = makeDriver({});
  const root = new TauriDirectoryHandle({ driver, path: '' });
  const made = await root.getDirectoryHandle('newdir', { create: true });
  assert.strictEqual(made.path, 'newdir');
});

test('TauriDirectoryHandle.getFileHandle returns a handle whose getFile().text() reads content', async () => {
  const driver = makeDriver({ 'a/b.md': 'hello' });
  const root = new TauriDirectoryHandle({ driver, path: '' });
  const a = await root.getDirectoryHandle('a');
  const fh = await a.getFileHandle('b.md');
  const file = await fh.getFile();
  assert.strictEqual(await file.text(), 'hello');
});

test('TauriDirectoryHandle.getFileHandle throws NotFoundError on missing file', async () => {
  const driver = makeDriver({});
  const root = new TauriDirectoryHandle({ driver, path: '' });
  await assert.rejects(
    () => root.getFileHandle('missing.md'),
    err => err.name === 'NotFoundError'
  );
});

test('TauriDirectoryHandle createWritable round-trips content via close()', async () => {
  const driver = makeDriver({});
  const root = new TauriDirectoryHandle({ driver, path: '' });
  const fh = await root.getFileHandle('out.md', { create: true });
  const w = await fh.createWritable();
  await w.write('SAVED');
  await w.close();
  const fh2 = await root.getFileHandle('out.md');
  assert.strictEqual(await (await fh2.getFile()).text(), 'SAVED');
});

test('TauriDirectoryHandle.entries() yields [name, {kind}] tuples', async () => {
  const driver = makeDriver({
    'a/x.md': '1',
    'a/y.md': '2',
    'a/sub/deep.md': '3',
  });
  const root = new TauriDirectoryHandle({ driver, path: '' });
  const a = await root.getDirectoryHandle('a');
  const collected = [];
  for await (const [name, entry] of a.entries()) {
    collected.push([name, entry.kind]);
  }
  collected.sort();
  assert.deepStrictEqual(collected, [['sub', 'directory'], ['x.md', 'file'], ['y.md', 'file']]);
});

test('TauriDirectoryHandle is shape-compatible with fs.js readTextFile', async () => {
  const driver = makeDriver({ 'datasheets/space-marines/units/intercessor-squad.md': '# Intercessor Squad' });
  const root = new TauriDirectoryHandle({ driver, path: '' });
  const { readTextFile } = await import('../app/lib/fs.js');
  const text = await readTextFile(root, 'datasheets/space-marines/units/intercessor-squad.md');
  assert.strictEqual(text, '# Intercessor Squad');
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
cd "/Users/tomhunterii/Documents/Warhammer 40k"
npx node --test tests/tauri-fs-shim.test.js 2>&1 | tail -10
```

Expected: failure with `Cannot find module '../app/lib/tauri-fs-shim.js'`.

- [ ] **Step 3: Implement the shim**

Create `app/lib/tauri-fs-shim.js`:

```javascript
// app/lib/tauri-fs-shim.js
//
// Duck-types the File System Access API surface that app/lib/fs.js consumes,
// backed by a path-based filesystem driver (the production driver wraps
// @tauri-apps/plugin-fs; tests inject an in-memory driver).
//
// Why a shim and not a rewrite of fs.js: every existing call site already takes
// a (root, path) pair. The only thing that differs between FSA and Tauri is the
// `root` object. Producing an FSA-shaped object over Tauri keeps fs.js, all
// parsers, all tests, and command-auspex.html unchanged.

function notFound() {
  const err = new Error('not found');
  err.name = 'NotFoundError';
  return err;
}

function joinPath(parent, name) {
  return parent === '' ? name : `${parent}/${name}`;
}

export class TauriDirectoryHandle {
  constructor({ driver, path }) {
    this.driver = driver;
    this.path = path;
    this.name = path === '' ? '/' : path.split('/').pop();
    this.kind = 'directory';
  }

  async getDirectoryHandle(name, { create = false } = {}) {
    const childPath = joinPath(this.path, name);
    const exists = await this.driver.exists(childPath);
    if (!exists) {
      if (!create) throw notFound();
      await this.driver.mkdir(childPath);
    }
    return new TauriDirectoryHandle({ driver: this.driver, path: childPath });
  }

  async getFileHandle(name, { create = false } = {}) {
    const childPath = joinPath(this.path, name);
    const exists = await this.driver.exists(childPath);
    if (!exists && !create) throw notFound();
    return new TauriFileHandle({ driver: this.driver, path: childPath });
  }

  async *entries() {
    const items = await this.driver.readDir(this.path);
    for (const item of items) {
      const kind = item.isDirectory ? 'directory' : 'file';
      yield [item.name, { name: item.name, kind }];
    }
  }
}

export class TauriFileHandle {
  constructor({ driver, path }) {
    this.driver = driver;
    this.path = path;
    this.name = path.split('/').pop();
    this.kind = 'file';
  }

  async getFile() {
    const text = await this.driver.readTextFile(this.path);
    return {
      text: async () => text,
    };
  }

  async createWritable() {
    const driver = this.driver;
    const path = this.path;
    let buf = '';
    return {
      async write(content) { buf = content; },
      async close() { await driver.writeTextFile(path, buf); },
    };
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npx node --test tests/tauri-fs-shim.test.js 2>&1 | tail -10
```

Expected: `# pass 8`, `# fail 0`.

- [ ] **Step 5: Run the full suite to verify no regressions**

```bash
npm test 2>&1 | tail -5
```

Expected: total pass count = previous count + 8.

- [ ] **Step 6: Commit**

```bash
git add app/lib/tauri-fs-shim.js tests/tauri-fs-shim.test.js
git commit -m "$(cat <<'EOF'
app: add TauriDirectoryHandle FSA-shape shim with driver injection

Mimics the slice of FileSystemDirectoryHandle that fs.js consumes
(getDirectoryHandle, getFileHandle, entries(), getFile().text(),
createWritable). Production wires this to @tauri-apps/plugin-fs;
tests wire a Map-backed in-memory driver. This keeps fs.js and all
its callers unchanged when running under Tauri.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Production driver — wrap `@tauri-apps/plugin-fs`

**Files:**
- Create: `app/lib/tauri-driver.js`

The driver translates the shim's path-based API into `@tauri-apps/plugin-fs` calls with `BaseDirectory.AppData` (writable user data) or `BaseDirectory.Resource` (read-only bundled data). For milestone 0.1 we use a single base directory (AppData, seeded from Resource on first launch — that seed step is Task 6).

- [ ] **Step 1: Read the @tauri-apps/plugin-fs JS surface**

Confirm the named exports (`readTextFile`, `writeTextFile`, `readDir`, `exists`, `mkdir`, `BaseDirectory`) exist in `node_modules/@tauri-apps/plugin-fs/dist-js/index.js`:

```bash
cd "/Users/tomhunterii/Documents/Warhammer 40k"
grep -E '^export' node_modules/@tauri-apps/plugin-fs/dist-js/index.js | head -20
```

Expected: includes `export { readTextFile, writeTextFile, readDir, exists, mkdir, BaseDirectory, ... }`.

- [ ] **Step 2: Write the production driver**

Create `app/lib/tauri-driver.js`:

```javascript
// app/lib/tauri-driver.js
//
// Production filesystem driver for TauriDirectoryHandle.
// Backs the shim with @tauri-apps/plugin-fs. Anchored on a single
// BaseDirectory (BaseDirectory.AppData for milestone 0.1).

import {
  readTextFile,
  writeTextFile,
  readDir,
  exists,
  mkdir,
} from '@tauri-apps/plugin-fs';

export function makeTauriDriver(baseDir) {
  return {
    async exists(path) {
      try {
        return await exists(path, { baseDir });
      } catch {
        return false;
      }
    },
    async readTextFile(path) {
      return readTextFile(path, { baseDir });
    },
    async writeTextFile(path, content) {
      return writeTextFile(path, content, { baseDir });
    },
    async mkdir(path) {
      return mkdir(path, { baseDir, recursive: true });
    },
    async readDir(path) {
      const items = await readDir(path === '' ? '.' : path, { baseDir });
      return items.map(item => ({
        name: item.name,
        isDirectory: item.isDirectory ?? false,
        isFile: item.isFile ?? !item.isDirectory,
      }));
    },
  };
}
```

- [ ] **Step 3: No new tests at this step**

The driver is a thin pass-through to `@tauri-apps/plugin-fs`, which is owned by Tauri. Wrapping it in a contract test would require mocking the Tauri plugin — and the shim already has 8 tests proving the contract works through the driver interface. Coverage of the production driver happens via the e2e smoke when the app boots in Task 7.

- [ ] **Step 4: Run full suite to verify no regressions**

```bash
npm test 2>&1 | tail -5
```

Expected: same pass count as end of Task 4 (the new file imports an ESM module that Node would fail on, so do **not** import this file from a test).

- [ ] **Step 5: Commit**

```bash
git add app/lib/tauri-driver.js
git commit -m "$(cat <<'EOF'
app: add Tauri filesystem driver wrapping @tauri-apps/plugin-fs

Thin adapter that translates the shim's path-based driver interface
into @tauri-apps/plugin-fs calls anchored on a chosen BaseDirectory.
Used in production by command-auspex.html when running inside Tauri.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: First-launch seed — copy Resource → AppData

**Files:**
- Create: `app/lib/seed-appdata.js`
- Create: `tests/seed-appdata.test.js`

On first launch in a Tauri build, the AppData directory is empty. We populate it once by copying the markdown tree from `BaseDirectory.Resource` (read-only bundled) into `BaseDirectory.AppData` (writable). A `.seeded` marker file in AppData prevents re-copy on subsequent launches. This logic is pure JS, driver-injected, and unit-testable without Tauri.

- [ ] **Step 1: Write failing test for seedIfNeeded**

Create `tests/seed-appdata.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert';
import { seedIfNeeded } from '../app/lib/seed-appdata.js';

function makeDriver(initial) {
  const fs = new Map(Object.entries(initial));
  return {
    fs,
    async exists(path) {
      return fs.has(path) || [...fs.keys()].some(k => k.startsWith(path + '/'));
    },
    async isFile(path) { return fs.has(path); },
    async readTextFile(path) {
      if (!fs.has(path)) throw Object.assign(new Error('not found'), { name: 'NotFoundError' });
      return fs.get(path);
    },
    async writeTextFile(path, content) { fs.set(path, content); },
    async mkdir(_path) {},
    async readDir(path) {
      const prefix = path === '' || path === '.' ? '' : path + '/';
      const out = [];
      const seen = new Set();
      for (const k of fs.keys()) {
        if (prefix && !k.startsWith(prefix)) continue;
        const rest = prefix ? k.slice(prefix.length) : k;
        if (rest === '') continue;
        const head = rest.split('/')[0];
        if (seen.has(head)) continue;
        seen.add(head);
        const isFile = rest === head;
        out.push({ name: head, isDirectory: !isFile, isFile });
      }
      return out;
    },
  };
}

test('seedIfNeeded copies all files from resource → appdata when marker absent', async () => {
  const resource = makeDriver({
    'datasheets/space-marines/units/intercessor-squad.md': 'INT',
    'ultramarines/rosters/2000pt-norallus-orbital-assault.md': 'ROS',
    '500 Worlds Campaign/missions/purge-and-burn.md': 'PNB',
  });
  const appdata = makeDriver({});

  const result = await seedIfNeeded({
    resource,
    appdata,
    seedRoots: ['datasheets', 'ultramarines', '500 Worlds Campaign'],
  });

  assert.strictEqual(result.copied, 3);
  assert.strictEqual(appdata.fs.get('datasheets/space-marines/units/intercessor-squad.md'), 'INT');
  assert.strictEqual(appdata.fs.get('ultramarines/rosters/2000pt-norallus-orbital-assault.md'), 'ROS');
  assert.strictEqual(appdata.fs.get('500 Worlds Campaign/missions/purge-and-burn.md'), 'PNB');
  assert.ok(appdata.fs.has('.seeded'), 'marker should be written');
});

test('seedIfNeeded is a no-op when marker already present', async () => {
  const resource = makeDriver({ 'datasheets/foo.md': 'NEW' });
  const appdata = makeDriver({ '.seeded': '2026-04-25T00:00:00Z', 'datasheets/foo.md': 'OLD' });
  const result = await seedIfNeeded({
    resource,
    appdata,
    seedRoots: ['datasheets'],
  });
  assert.strictEqual(result.copied, 0);
  assert.strictEqual(appdata.fs.get('datasheets/foo.md'), 'OLD');
});

test('seedIfNeeded handles deeply nested directories', async () => {
  const resource = makeDriver({
    'a/b/c/d/e/leaf.md': 'X',
  });
  const appdata = makeDriver({});
  const result = await seedIfNeeded({
    resource,
    appdata,
    seedRoots: ['a'],
  });
  assert.strictEqual(result.copied, 1);
  assert.strictEqual(appdata.fs.get('a/b/c/d/e/leaf.md'), 'X');
});

test('seedIfNeeded skips seedRoot that does not exist in resource (graceful)', async () => {
  const resource = makeDriver({});
  const appdata = makeDriver({});
  const result = await seedIfNeeded({
    resource,
    appdata,
    seedRoots: ['datasheets', 'absent'],
  });
  assert.strictEqual(result.copied, 0);
  assert.ok(appdata.fs.has('.seeded'));
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
npx node --test tests/seed-appdata.test.js 2>&1 | tail -10
```

Expected: failure with `Cannot find module '../app/lib/seed-appdata.js'`.

- [ ] **Step 3: Implement seedIfNeeded**

Create `app/lib/seed-appdata.js`:

```javascript
// app/lib/seed-appdata.js
//
// First-launch one-time copy from the bundled Resource directory into the
// user's AppData directory. After seeding, AppData is the working "repo"
// the app reads and writes through Tauri filesystem APIs.
//
// Driver-injected so the logic is pure-JS testable without a Tauri runtime.
// Production wires `resource` to a driver over BaseDirectory.Resource and
// `appdata` to a driver over BaseDirectory.AppData.

const SEED_MARKER = '.seeded';

async function copyTree(src, dst, srcPath) {
  let copied = 0;
  if (!(await src.exists(srcPath))) return 0;
  const entries = await src.readDir(srcPath);
  for (const entry of entries) {
    const childSrc = srcPath === '' ? entry.name : `${srcPath}/${entry.name}`;
    if (entry.isDirectory) {
      await dst.mkdir(childSrc);
      copied += await copyTree(src, dst, childSrc);
    } else {
      const text = await src.readTextFile(childSrc);
      await dst.writeTextFile(childSrc, text);
      copied += 1;
    }
  }
  return copied;
}

export async function seedIfNeeded({ resource, appdata, seedRoots }) {
  const alreadySeeded = await appdata.exists(SEED_MARKER);
  if (alreadySeeded) return { copied: 0, alreadySeeded: true };

  let copied = 0;
  for (const root of seedRoots) {
    copied += await copyTree(resource, appdata, root);
  }
  await appdata.writeTextFile(SEED_MARKER, new Date().toISOString());
  return { copied, alreadySeeded: false };
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npx node --test tests/seed-appdata.test.js 2>&1 | tail -10
```

Expected: `# pass 4`, `# fail 0`.

- [ ] **Step 5: Run full suite**

```bash
npm test 2>&1 | tail -5
```

Expected: total pass count = end-of-Task-4 count + 4.

- [ ] **Step 6: Commit**

```bash
git add app/lib/seed-appdata.js tests/seed-appdata.test.js
git commit -m "$(cat <<'EOF'
app: add first-launch seed-appdata copy with driver injection

Copies datasheets/, ultramarines/, and "500 Worlds Campaign/" from the
bundled Resource directory into AppData on first launch, gated by a
.seeded marker file. Driver-injected and unit-testable; production
wires it to @tauri-apps/plugin-fs at boot.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Runtime detection + CONNECT REPO branch

**Files:**
- Create: `app/lib/runtime.js`
- Create: `tests/runtime.test.js`
- Modify: `app/command-auspex.html` (CONNECT REPO handler at line ~400)

The existing CONNECT REPO handler (line ~400) calls `window.showDirectoryPicker`. In Tauri it should instead: (a) seed AppData if needed, (b) construct a `TauriDirectoryHandle` over AppData, (c) assign it to `repoHandle` exactly like the FSA path does. The choice between the two paths is gated by runtime detection.

- [ ] **Step 1: Write failing test for runtime detection**

Create `tests/runtime.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert';
import { isTauri } from '../app/lib/runtime.js';

test('isTauri returns true when window has __TAURI_INTERNALS__', () => {
  const fakeWindow = { __TAURI_INTERNALS__: {} };
  assert.strictEqual(isTauri(fakeWindow), true);
});

test('isTauri returns false in plain browser', () => {
  const fakeWindow = {};
  assert.strictEqual(isTauri(fakeWindow), false);
});

test('isTauri tolerates missing window argument', () => {
  // Node has no window — function must not throw and must return false
  assert.strictEqual(isTauri(undefined), false);
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
npx node --test tests/runtime.test.js 2>&1 | tail -10
```

Expected: failure with `Cannot find module '../app/lib/runtime.js'`.

- [ ] **Step 3: Implement runtime detection**

Create `app/lib/runtime.js`:

```javascript
// app/lib/runtime.js
//
// Runtime detection helpers. The CONNECT REPO handler uses isTauri() to
// branch between FSA showDirectoryPicker (browser) and the Tauri shim
// (desktop app).

export function isTauri(win = (typeof window !== 'undefined' ? window : undefined)) {
  return Boolean(win && win.__TAURI_INTERNALS__);
}

// Connect a "repo handle" appropriate to the current runtime.
// In Tauri: seeds AppData if needed and returns a TauriDirectoryHandle.
// In a browser: opens the FSA directory picker.
//
// Both branches resolve to an object that conforms to the slice of
// FileSystemDirectoryHandle that app/lib/fs.js consumes.
export async function connectRepoHandle({
  win = (typeof window !== 'undefined' ? window : undefined),
  // Tauri-side wiring (lazy-imported only inside the Tauri branch
  // so a plain browser never tries to load @tauri-apps modules).
  loadTauriDeps = async () => {
    const [{ TauriDirectoryHandle }, { makeTauriDriver }, { seedIfNeeded }, fs] = await Promise.all([
      import('./tauri-fs-shim.js'),
      import('./tauri-driver.js'),
      import('./seed-appdata.js'),
      import('@tauri-apps/plugin-fs'),
    ]);
    return { TauriDirectoryHandle, makeTauriDriver, seedIfNeeded, BaseDirectory: fs.BaseDirectory };
  },
} = {}) {
  if (isTauri(win)) {
    const { TauriDirectoryHandle, makeTauriDriver, seedIfNeeded, BaseDirectory } = await loadTauriDeps();
    const resourceDriver = makeTauriDriver(BaseDirectory.Resource);
    const appdataDriver = makeTauriDriver(BaseDirectory.AppData);
    await seedIfNeeded({
      resource: resourceDriver,
      appdata: appdataDriver,
      seedRoots: ['datasheets', 'ultramarines', '500 Worlds Campaign'],
    });
    const handle = new TauriDirectoryHandle({ driver: appdataDriver, path: '' });
    handle.name = 'command-auspex';
    return handle;
  }
  // Browser fallback: keep existing FSA flow.
  return win.showDirectoryPicker({ mode: 'readwrite' });
}
```

- [ ] **Step 4: Run runtime tests**

```bash
npx node --test tests/runtime.test.js 2>&1 | tail -10
```

Expected: `# pass 3`, `# fail 0`.

- [ ] **Step 5: Modify CONNECT REPO handler in `app/command-auspex.html`**

Locate the CONNECT REPO handler (around line 397-410, which calls `window.showDirectoryPicker`). Find the import block at the top of the inline `<script type="module">` and add:

```javascript
import { connectRepoHandle } from './lib/runtime.js';
```

Then in the click handler, replace `repoHandle = await window.showDirectoryPicker({ mode: 'readwrite' });` with:

```javascript
repoHandle = await connectRepoHandle();
```

Concrete edit (find and replace):

**Find** (one of the existing import lines, near the top of the inline `<script type="module">` block):

```javascript
import { resolveSlug } from './lib/roster-parser.js';
```

**Replace with:**

```javascript
import { resolveSlug } from './lib/roster-parser.js';
import { connectRepoHandle } from './lib/runtime.js';
```

**Find** (in the CONNECT REPO click handler):

```javascript
    repoHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
```

**Replace with:**

```javascript
    repoHandle = await connectRepoHandle();
```

- [ ] **Step 6: Update e2e smoke test to assert the new import**

Open `tests/e2e-smoke.test.js`. Add a new assertion next to the existing "all lib/ modules imported" test:

```javascript
test('smoke: runtime.js imported and connectRepoHandle wired', () => {
  assert.match(HTML, /import\s*\{[^}]*connectRepoHandle[^}]*\}\s*from\s*'\.\/lib\/runtime\.js'/,
    'connectRepoHandle not imported from ./lib/runtime.js');
  assert.match(HTML, /repoHandle = await connectRepoHandle\(\)/,
    'CONNECT REPO handler must call connectRepoHandle()');
});
```

- [ ] **Step 7: Run full suite**

```bash
npm test 2>&1 | tail -5
```

Expected: pass count = previous count + 4 (3 runtime + 1 new smoke).

- [ ] **Step 8: Smoke-test by launching Tauri**

```bash
cd "/Users/tomhunterii/Documents/Warhammer 40k"
npm run tauri:dev
```

Expected: window opens, click CONNECT REPO. Status bar should show `COGITATOR LINK ESTABLISHED · REPOSITORY command-auspex · N ROSTER(S) RECOGNIZED · M UNSTRUCTURED SKIPPED`. Mission and force dropdowns populate. The first launch may take ~1s for the seed copy.

If the status reports an error: open DevTools (Tauri 2 supports `cmd+option+i` in dev), check the console.

- [ ] **Step 9: Commit**

```bash
git add app/lib/runtime.js tests/runtime.test.js app/command-auspex.html tests/e2e-smoke.test.js
git commit -m "$(cat <<'EOF'
app: branch CONNECT REPO between Tauri and FSA via runtime detection

isTauri() inspects window.__TAURI_INTERNALS__. connectRepoHandle()
returns a TauriDirectoryHandle anchored on AppData (seeding from
Resource on first launch) under Tauri, or falls through to
showDirectoryPicker in a plain browser. Existing browser dev workflow
preserved; existing tests preserved.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Verify scenario save/load round-trip in Tauri

This is a manual integration check — automated coverage of Tauri-runtime IO would require an in-process Tauri test harness, which is out of scope for milestone 0.1.

**Files:** none modified.

- [ ] **Step 1: Launch Tauri dev**

```bash
npm run tauri:dev
```

- [ ] **Step 2: Walk the captain's workflow**

In the running app:

1. Click `CONNECT REPO`. Expect: status `COGITATOR LINK ESTABLISHED · REPOSITORY command-auspex · 1 ROSTER RECOGNIZED · 5 UNSTRUCTURED SKIPPED` (matches current Norallus-only state).
2. Select mission `Purge and Burn`.
3. Select friendly + hostile force = `norallus-purge-and-burn`.
4. Click `ENGAGE`. Expect: 15 units render on the deployment map with concentric threat rings.
5. Drag any unit to a new position.
6. Click `COMMIT TO ARCHIVE`. Enter scenario name `tauri-smoke-1`. Confirm save.
7. Quit the app (`cmd+q`).
8. Re-launch `npm run tauri:dev`.
9. Click `CONNECT REPO` (status confirms previous seed: no new copy this time).
10. Click `RECALL SCENARIO`. Pick `tauri-smoke-1`. Expect: dragged position restored.

- [ ] **Step 3: Verify file location**

```bash
ls -la "$HOME/Library/Application Support/com.ultramarines.command-auspex/"
```

Expected on macOS: directory contains `.seeded`, `datasheets/`, `ultramarines/`, `500 Worlds Campaign/`, with the scenario file at `500 Worlds Campaign/scenarios/tauri-smoke-1.md`.

- [ ] **Step 4: Quit dev. No commit.**

Verification only.

---

## Task 9: Native application menu

**Files:**
- Modify: `src-tauri/src/main.rs`

Adds a native menu bar with File and Help groups. Menu items dispatch via Tauri events; the frontend listens and triggers existing handlers (CONNECT REPO, COMMIT TO ARCHIVE, RECALL SCENARIO).

- [ ] **Step 1: Replace `src-tauri/src/main.rs`**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    Emitter, Manager,
};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let handle = app.handle();

            let connect = MenuItem::with_id(handle, "connect_repo", "Connect Repo", true, None::<&str>)?;
            let save = MenuItem::with_id(handle, "save_scenario", "Save Scenario", true, Some("CmdOrCtrl+S"))?;
            let recall = MenuItem::with_id(handle, "recall_scenario", "Recall Scenario", true, Some("CmdOrCtrl+O"))?;
            let separator = PredefinedMenuItem::separator(handle)?;
            let quit = PredefinedMenuItem::quit(handle, None)?;

            let file_menu = Submenu::with_items(
                handle,
                "File",
                true,
                &[&connect, &save, &recall, &separator, &quit],
            )?;

            let menu = Menu::with_items(handle, &[&file_menu])?;
            app.set_menu(menu)?;

            app.on_menu_event(move |app_handle, event| {
                let id = event.id().0.as_str();
                let _ = app_handle.emit("menu-action", id);
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Command Auspex");
}
```

- [ ] **Step 2: Wire frontend listener in `app/command-auspex.html`**

Near the bottom of the inline `<script type="module">` block, after all other event wiring, append:

```javascript
// Native menu plumbing: in Tauri, menu items emit a 'menu-action' event.
if (window.__TAURI_INTERNALS__) {
  const { listen } = await import('@tauri-apps/api/event');
  await listen('menu-action', (e) => {
    if (e.payload === 'connect_repo') {
      document.getElementById('pick-repo').click();
    } else if (e.payload === 'save_scenario') {
      document.getElementById('save-scenario').click();
    } else if (e.payload === 'recall_scenario') {
      document.getElementById('load-scenario').click();
    }
  });
}
```

- [ ] **Step 3: Smoke-test**

```bash
npm run tauri:dev
```

Verify the native File menu shows Connect Repo, Save Scenario, Recall Scenario, separator, and Quit. Click each; confirm the corresponding button click fires (status bar updates).

- [ ] **Step 4: Update e2e smoke**

In `tests/e2e-smoke.test.js`:

```javascript
test('smoke: native menu listener wired (Tauri-only path present)', () => {
  assert.match(HTML, /listen\(['"]menu-action['"]/,
    'menu-action listener missing');
});
```

- [ ] **Step 5: Run full suite**

```bash
npm test 2>&1 | tail -5
```

Expected: pass count = previous + 1.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/main.rs app/command-auspex.html tests/e2e-smoke.test.js
git commit -m "$(cat <<'EOF'
tauri: add native File menu (Connect / Save / Recall / Quit)

Rust-side menu construction emits a 'menu-action' event with the item
id; the frontend listens and clicks the existing topbar button. Keeps
the menu thin and avoids duplicating handler logic.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: GitHub Actions release workflow

**Files:**
- Create: `.github/workflows/release.yml`

A tag-triggered workflow that builds for macOS, Windows, and Linux via the official `tauri-apps/tauri-action`. Uploads `.dmg`, `.msi`, and `.AppImage` artifacts to a GitHub Release. Free for public repos.

- [ ] **Step 1: Create the workflow**

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    permissions:
      contents: write
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: macos-latest
            target: aarch64-apple-darwin
          - platform: macos-latest
            target: x86_64-apple-darwin
          - platform: ubuntu-22.04
            target: ''
          - platform: windows-latest
            target: ''

    runs-on: ${{ matrix.platform }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Set up Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}

      - name: Cache cargo
        uses: swatinem/rust-cache@v2
        with:
          workspaces: src-tauri

      - name: Install Linux deps
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libwebkit2gtk-4.1-dev \
            libappindicator3-dev \
            librsvg2-dev \
            patchelf

      - name: Install Node deps
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Build (Tauri)
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          args: ${{ matrix.target != '' && format('--target {0}', matrix.target) || '' }}
          tagName: ${{ github.ref_name }}
          releaseName: 'Command Auspex ${{ github.ref_name }}'
          releaseBody: |
            Command Auspex desktop build.

            **First launch (macOS):** right-click the app → Open → confirm "Open Anyway".
            **First launch (Windows):** SmartScreen warning → "More info" → "Run anyway".
            **First launch (Linux):** `chmod +x` the AppImage, then run.

            Unsigned binaries; Gatekeeper / SmartScreen warnings are expected.
          releaseDraft: false
          prerelease: false
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "$(cat <<'EOF'
ci: tag-triggered cross-platform Tauri release workflow

Builds macOS (universal: aarch64 + x86_64), Linux AppImage, and Windows
MSI on every v* tag. Runs npm test before each build. Auto-creates a
GitHub Release with installation instructions for the unsigned binaries.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Push to remote (manual — Captain decision)**

```bash
git push origin main
```

If the repo has no `origin` remote yet, the Captain decides whether to create a public GitHub repo. Document the URL once created. **Do not** create a public remote without explicit Captain authorization.

---

## Task 11: First tagged release v0.1.0

**Files:** none modified.

- [ ] **Step 1: Local Tauri build sanity check**

```bash
cd "/Users/tomhunterii/Documents/Warhammer 40k"
npm run tauri:build
```

Expected: produces a `.dmg` (or `.app` bundle) at `src-tauri/target/release/bundle/`. The build takes ~5-10 min cold. Open the produced bundle, drag to Applications, run, accept the Gatekeeper prompt.

- [ ] **Step 2: Tag the release**

```bash
git tag -a v0.1.0 -m "$(cat <<'EOF'
v0.1.0 — Tauri shell milestone

First packaged Command Auspex build. Wraps the existing static HTML tool
in a Tauri 2.x desktop shell with bundled markdown resources, AppData
seeding on first launch, native File menu, and cross-platform CI.

No new gameplay features. Behavioral parity with the browser version.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Push tag (Captain authorization required)**

This step actually triggers the CI build and creates the public GitHub Release. **Do not run without Captain confirmation.**

```bash
git push origin v0.1.0
```

- [ ] **Step 4: Monitor CI**

Watch the workflow at `https://github.com/<owner>/<repo>/actions`. The matrix should produce four artifacts:
- `Command Auspex_0.1.0_aarch64.dmg`
- `Command Auspex_0.1.0_x64.dmg`
- `command-auspex_0.1.0_amd64.AppImage`
- `Command Auspex_0.1.0_x64_en-US.msi`

- [ ] **Step 5: Verify the Release page**

`https://github.com/<owner>/<repo>/releases/tag/v0.1.0` should list all four artifacts, Captain's release notes, and the install instructions.

- [ ] **Step 6: Tester download smoke test (optional, ideal)**

On a fresh machine (or VM), download one of the artifacts, install, launch. Confirm:
- Gatekeeper / SmartScreen warning appears (expected).
- After bypass, app launches and CONNECT REPO seeds AppData.
- Walking the captain's workflow (Task 8 steps 2.1–2.7) succeeds.

---

## Self-Review Pass

After completing tasks 1-11, run the spec ↔ plan check:

**Spec section: "Milestone 0.1 — Tauri Shell + Existing Tool"** lists:
- Create `tauri/` directory ✅ Task 1 (named `src-tauri/` per Tauri 2 convention)
- Move `app/command-auspex.html` and `app/lib/` ✅ no-op (Tauri loads them in place via `frontendDist`)
- Replace FSA in `app/lib/fs.js` behind existing abstraction ✅ Task 4 (shim) + Task 5 (driver) + Task 6 (seed) + Task 7 (runtime branch)
- Bundle datasheets / ultramarines / "500 Worlds Campaign" ✅ Task 1 step 4 (resources)
- Add native menus ✅ Task 9
- GitHub Actions workflow ✅ Task 10
- First tagged release v0.1.0 ✅ Task 11

**Deferred to milestone 0.1.x (not in this plan):**
- Native scenario open dialog via `tauri-plugin-dialog` — modal-based RECALL works fine through the AppData listing; native dialog is polish.
- Real branded icons — placeholder solid-color PNG ships v0.1.0; commission a real icon for v0.1.1.

**No gaps in milestone 0.1 scope.**

---

## Conventions

- **No `git add -A`.** Every commit stages files individually by name. (Per repo memory: prior subagent swept unrelated files into a commit.)
- **TDD:** every JS module has a failing test before implementation; tests live in `tests/<module>.test.js`.
- **Node `--test` runner only.** No new test framework introduced.
- **All 206 existing tests must continue to pass** at every commit.
- **Frontend stays static HTML + ES modules.** No Vite, no bundler. `withGlobalTauri` keeps Tauri APIs accessible without a bundler.
- **Browser dev workflow preserved.** `python3 -m http.server` + `app/command-auspex.html` continues to work for fast iteration.
- **No code signing.** Unsigned binaries; Gatekeeper / SmartScreen warnings documented in release notes.
- **No remote push without Captain authorization.** Tagging is local; pushing the tag (which triggers CI and public release) is a Captain decision.

---

## What ships at v0.1.0

A `.dmg` (mac universal), `.msi` (windows), and `.AppImage` (linux) of the existing Command Auspex tool, behavior-preserved, distributable via GitHub Releases at zero recurring cost. The Captain or any tester can install in three clicks (download → bypass warning → drag/run). All existing scenarios, rosters, and missions ship inside the bundle and seed into the user's app-data directory on first launch. No new features. No regressions.

The next milestone (0.2 — catalogue.db) gets its own implementation plan when v0.1.0 is in tester hands.
