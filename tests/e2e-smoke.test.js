// tests/e2e-smoke.test.js
//
// Lightweight smoke test for app/command-auspex.html.
//
// The plan originally called for Playwright. A live-browser smoke was run via
// the Playwright MCP at Task 22 and verified the app renders correctly. This
// test captures the same structural invariants without requiring a 250MB
// Playwright install: it reads the HTML from disk and asserts the key IDs,
// imports, and liturgical strings are present. If any are missing, something
// has regressed in the controls / boot sequence / polish layers.
//
// To run: `npm test`
// To run live-browser smoke: navigate to `http://localhost:<port>/app/command-auspex.html`
// after `python3 -m http.server` from the repo root, then click CONNECT REPO.

import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const HTML = readFileSync(new URL('../app/command-auspex.html', import.meta.url), 'utf8');

test('smoke: page title and meta', () => {
  assert.match(HTML, /<title>COMMAND AUSPEX \/\/ HOLOLITH-SIGMA<\/title>/);
});

test('smoke: topbar chrome — title, subtitle, status, LED', () => {
  assert.match(HTML, /class="title">COMMAND AUSPEX</);
  assert.match(HTML, /HOLOLITH-SIGMA · VOX-CHANNEL SIGMA-09/);
  assert.match(HTML, /id="status"/);
  assert.match(HTML, /class="led"/);
});

test('smoke: all control element IDs exist', () => {
  for (const id of [
    'pick-repo',
    'mission-select',
    'defender-select',
    'attacker-select',
    'load-scenario',
    'open-scenario',
    'save-scenario',
    'paste-defender',
    'paste-attacker',
    'paste-modal',
    'paste-textarea',
    'paste-cancel',
    'paste-confirm',
    'board',
    'sidebar',
    'tooltip',
    'boot-overlay',
  ]) {
    assert.match(HTML, new RegExp(`id="${id}"`), `missing id="${id}"`);
  }
});

test('smoke: liturgical UI strings applied', () => {
  assert.match(HTML, />ENGAGE</);
  assert.match(HTML, />RECALL SCENARIO</);
  assert.match(HTML, />COMMIT TO ARCHIVE</);
  assert.match(HTML, />\+ VOX-SCRIBE DEFENDER</);
  assert.match(HTML, />\+ VOX-SCRIBE ATTACKER</);
  assert.match(HTML, /ENGAGEMENT/);
  assert.match(HTML, /FRIENDLY FORCE/);
  assert.match(HTML, /HOSTILE FORCE/);
  assert.match(HTML, /MACHINE-SPIRIT OBJECTS/);
  assert.match(HTML, /COGITATOR LINK/);
});

test('smoke: layer toggle buttons present', () => {
  for (const layer of ['deployment', 'edges', 'scoring', 'threat', 'coherency', 'auspex-sweep']) {
    assert.match(HTML, new RegExp(`data-layer="${layer}"`), `missing layer button ${layer}`);
  }
});

test('smoke: all lib/ modules imported', () => {
  for (const mod of [
    './lib/yaml-frontmatter.js',
    './lib/roster-parser.js',
    './lib/datasheet-parser.js',
    './lib/render.js',
    './lib/auto-placement.js',
    './lib/scenario.js',
    './lib/runtime.js',
    './lib/catalogue.js',
  ]) {
    assert.match(HTML, new RegExp(`from '${mod.replace(/\./g, '\\.')}'`), `missing import from ${mod}`);
  }
});

test('smoke: resolveSlug is imported from roster-parser.js', () => {
  assert.match(HTML, /import\s*\{[^}]*resolveSlug[^}]*\}\s*from\s*'\.\/lib\/roster-parser\.js'/,
    'resolveSlug not imported from ./lib/roster-parser.js');
});

test('smoke: four corner reticles + hex sidebar background', () => {
  for (const cls of ['reticle-tl', 'reticle-tr', 'reticle-bl', 'reticle-br']) {
    assert.match(HTML, new RegExp(`class="reticle ${cls}"`), `missing reticle ${cls}`);
  }
  assert.match(HTML, /background-image:\s*\n?\s*linear-gradient.*\n.*url\("data:image\/svg\+xml/s);
});

test('smoke: boot sequence markup + animation', () => {
  assert.match(HTML, /AUSPEX PRIMARIS \/\/ COGITATOR HANDSHAKE/);
  assert.match(HTML, /AUSPEX ONLINE ✠ BY THE EMPEROR'S WILL/);
  assert.match(HTML, /@keyframes boot-fade/);
});

test('smoke: auto-save wired', () => {
  assert.match(HTML, /scheduleAutoSave/, 'scheduleAutoSave function missing');
  assert.match(HTML, /currentScenarioPath/, 'currentScenarioPath state missing');
});

test('smoke: catalogue.js wired and CONNECT REPO loads via openCatalogue', () => {
  assert.match(HTML, /import\s*\{[^}]*openCatalogue[^}]*\}\s*from\s*'\.\/lib\/catalogue\.js'/,
    'openCatalogue not imported from ./lib/catalogue.js');
  assert.match(HTML, /catalogue = await openCatalogue\(\)/,
    'CONNECT REPO handler must call openCatalogue()');
  assert.match(HTML, /import\s*\{[^}]*isTauri[^}]*\}\s*from\s*'\.\/lib\/runtime\.js'/,
    'isTauri not imported from ./lib/runtime.js');
});

test('smoke: combat sim panel + controls present', () => {
  for (const id of ['sim-attacker', 'sim-defender', 'sim-models', 'sim-kind', 'sim-run', 'sim-result']) {
    assert.match(HTML, new RegExp(`id="${id}"`), `missing combat-sim id="${id}"`);
  }
  assert.match(HTML, /COMBAT AUSPEX/);
});

test('smoke: combat sim wired — simulate import + click handler + buildSimInputs', () => {
  assert.match(HTML, /import\s*\{[^}]*simulate[^}]*\}\s*from\s*'\.\/lib\/sim\/combat\.js'/);
  assert.match(HTML, /import\s*\{[^}]*buildSimInputs[^}]*\}\s*from\s*'\.\/lib\/catalogue\.js'/);
  assert.match(HTML, /getElementById\(['"]sim-run['"]\)\.addEventListener/);
});

test('smoke: native menu listener wired (Tauri-only path present)', () => {
  assert.match(HTML, /listen\(['"]menu-action['"]/,
    'menu-action listener missing');
  // Each menu action must click its corresponding existing button id.
  assert.match(HTML, /e\.payload === 'connect_repo'[\s\S]*?getElementById\(['"]pick-repo['"]\)/,
    'connect_repo must click #pick-repo');
  assert.match(HTML, /e\.payload === 'save_scenario'[\s\S]*?getElementById\(['"]save-scenario['"]\)/,
    'save_scenario must click #save-scenario');
  assert.match(HTML, /e\.payload === 'recall_scenario'[\s\S]*?getElementById\(['"]open-scenario['"]\)/,
    'recall_scenario must click #open-scenario (the RECALL SCENARIO button); load-scenario is ENGAGE');
});
