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
// after `python3 -m http.server` from the repo root. The bundled catalogue
// auto-loads on DOMContentLoaded — no manual connect step.

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
  assert.match(HTML, /DEFENDER FORCE/);
  assert.match(HTML, /ATTACKER FORCE/);
  assert.match(HTML, /MACHINE-SPIRIT OBJECTS/);
  assert.match(HTML, /COGITATOR LINK/);
});

test('smoke: layer toggle buttons present', () => {
  for (const layer of ['deployment', 'edges', 'scoring', 'auspex-sweep']) {
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

test('smoke: catalogue.js wired and auto-loaded on DOMContentLoaded', () => {
  assert.match(HTML, /import\s*\{[^}]*openCatalogue[^}]*\}\s*from\s*'\.\/lib\/catalogue\.js'/,
    'openCatalogue not imported from ./lib/catalogue.js');
  assert.match(HTML, /catalogue = await openCatalogue\(\)/,
    'catalogue load handler must call openCatalogue()');
  assert.match(HTML, /DOMContentLoaded[\s\S]*?loadCatalogueAndPopulate/,
    'catalogue must auto-load on DOMContentLoaded (no manual connect step)');
  assert.match(HTML, /import\s*\{[^}]*isTauri[^}]*\}\s*from\s*'\.\/lib\/runtime\.js'/,
    'isTauri not imported from ./lib/runtime.js');
});

test('smoke: combat sim panel + controls present', () => {
  for (const id of ['sim-panel', 'sim-gate', 'sim-body', 'sim-attacker', 'sim-attacker-models', 'sim-defender', 'sim-models', 'sim-kind', 'sim-run', 'sim-result', 'sim-weapon-detail']) {
    assert.match(HTML, new RegExp(`id="${id}"`), `missing combat-sim id="${id}"`);
  }
  assert.match(HTML, /COMBAT AUSPEX/);
  assert.match(HTML, /SELECT BOTH FORCES TO ENGAGE/);
});

test('smoke: combat sim gates on both rosters being selected', () => {
  assert.match(HTML, /async function refreshSimGate/);
  assert.match(HTML, /populateSimDropdownFromRoster/);
});

test('smoke: weapon detail panel refreshes on attacker/kind change', () => {
  assert.match(HTML, /sim-attacker.*addEventListener\(['"]change['"],\s*refreshWeaponDetail\)/s);
  assert.match(HTML, /sim-kind.*addEventListener\(['"]change['"],\s*refreshWeaponDetail\)/s);
});

test('smoke: combat sim wired — simulate import + click handler + buildSimInputs', () => {
  assert.match(HTML, /import\s*\{[^}]*simulate[^}]*\}\s*from\s*'\.\/lib\/sim\/combat\.js'/);
  assert.match(HTML, /import\s*\{[^}]*buildSimInputs[^}]*\}\s*from\s*'\.\/lib\/catalogue\.js'/);
  assert.match(HTML, /getElementById\(['"]sim-run['"]\)\.addEventListener/);
});

test('smoke: destroy/revive bookkeeping wired (right-click context menu)', () => {
  // Single-click destroy was removed; KILL is right-click-only via the
  // per-unit context menu. The destroyed-state bookkeeping must still exist
  // so the menu KILL/REVIVE action and scenario load can drive it.
  assert.match(HTML, /destroyedModels = new Map/);
  assert.match(HTML, /toggleDestroyed/);
  assert.match(HTML, /destroyedCountFor/);
  assert.match(HTML, /applyDestroyedVisual/);
  assert.match(HTML, /refreshSimModelCountsFor/);
  assert.match(HTML, /restoreDestroyedVisuals/);
  assert.match(HTML, /unit-ctx-menu/);
  assert.match(HTML, /data-act="kill"/);
});

test('smoke: native menu listener wired (Tauri-only path present)', () => {
  assert.match(HTML, /listen\(['"]menu-action['"]/,
    'menu-action listener missing');
  // Each menu action must click its corresponding existing button id.
  assert.match(HTML, /e\.payload === 'save_scenario'[\s\S]*?getElementById\(['"]save-scenario['"]\)/,
    'save_scenario must click #save-scenario');
  assert.match(HTML, /e\.payload === 'recall_scenario'[\s\S]*?getElementById\(['"]open-scenario['"]\)/,
    'recall_scenario must click #open-scenario (the RECALL SCENARIO button); load-scenario is ENGAGE');
});

test('smoke: model labels rendered on battlefield (renderer)', () => {
  const RENDER = readFileSync(new URL('../app/lib/render.js', import.meta.url), 'utf8');
  assert.match(RENDER, /modelLabel/);
  assert.match(RENDER, /text-anchor/);
  assert.match(RENDER, /classList\.add\(['"]model-label['"]\)/);
});

test('smoke: squad bracket + squad-name labels rendered', () => {
  const RENDER = readFileSync(new URL('../app/lib/render.js', import.meta.url), 'utf8');
  assert.match(RENDER, /squad-name/);
  assert.match(RENDER, /squad-bracket/);
  assert.match(RENDER, /WEAPON_ABBREV/);
  assert.match(RENDER, /isSidearm/);
});

test('smoke: press-hold threat rings + zone labels wired', () => {
  assert.match(HTML, /setupPressHoldThreat/);
  assert.match(HTML, /threat-rings-active/);
  // Threat layer toolbar button must be absent.
  assert.doesNotMatch(HTML, /data-layer="threat"/);
});

test('smoke: deployment zone labels rendered', () => {
  const RENDER = readFileSync(new URL('../app/lib/render.js', import.meta.url), 'utf8');
  assert.match(RENDER, /ATTACKER/);
  assert.match(RENDER, /DEFENDER/);
  assert.match(RENDER, /polygonCentroid/);
});

test('smoke: deployment-side language uses ATTACKER/DEFENDER', () => {
  assert.match(HTML, /DEFENDER FORCE/);
  assert.match(HTML, /ATTACKER FORCE/);
  assert.doesNotMatch(HTML, /FRIENDLY FORCE|HOSTILE FORCE/);
});

test('smoke: render emits data-side on unit groups', () => {
  const RENDER = readFileSync(new URL('../app/lib/render.js', import.meta.url), 'utf8');
  assert.match(RENDER, /dataset\.side|setAttribute\(['"]data-side['"]/);
});

test('smoke: refreshSimPairLine queries by per-unit-instance ID', () => {
  // clusterCenter takes (instanceId, side) so duplicate units on the board
  // — and instanceIds that collide across attacker/defender — resolve to
  // the specific clicked instance, not the first slug match.
  assert.match(HTML, /clusterCenter\(attackerInstanceId,\s*attackerSide\)/);
  assert.match(HTML, /data-instance-id=/);
});

test('smoke: shift+click drives the COMBAT AUSPEX pair', () => {
  // Pair lives in [attacker|null, defender|null]. Plain clicks open the
  // detail panel only — shift+click is the sim selector, with a same-side
  // rejection so a defender can't be picked from the attacker's roster.
  assert.match(HTML, /simClickPair\s*=\s*\[null,\s*null\]/);
  assert.match(HTML, /recordShiftClick\(/);
  assert.match(HTML, /e\.shiftKey/);
});

test('smoke: sim model-count inputs are read-only', () => {
  assert.match(HTML, /id="sim-attacker-models"[^>]*readonly/);
  assert.match(HTML, /id="sim-models"[^>]*readonly/);
});

test('smoke: sim-pair line wiring present', () => {
  assert.match(HTML, /refreshSimPairLine/);
  assert.match(HTML, /sim-pair-line/);
});

test('smoke: leader attachment wiring present', () => {
  assert.match(HTML, /attachments = \{[\s\S]*defender: new Map/);
  assert.match(HTML, /attach-leader/);
  assert.match(HTML, /attachedLeaderSlug/);
});

test('smoke: Space Marine role symbols wired in renderer', () => {
  const RENDER = readFileSync(new URL('../app/lib/render.js', import.meta.url), 'utf8');
  assert.match(RENDER, /spaceMarineRoleSymbol/);
  assert.match(RENDER, /SM_ROLE_CLOSE_SUPPORT_SLUGS/);
  assert.match(RENDER, /SM_ROLE_FIRE_SUPPORT_SLUGS/);
  assert.match(RENDER, /SM_ROLE_VETERAN_SLUGS/);
});

test('smoke: Tyranid role symbols wired in renderer', () => {
  const RENDER = readFileSync(new URL('../app/lib/render.js', import.meta.url), 'utf8');
  assert.match(RENDER, /tyranidRoleSymbol/);
  assert.match(RENDER, /icon:bug/);
  assert.match(RENDER, /icon:bugs/);
  assert.match(RENDER, /icon:mosquito/);
  assert.match(RENDER, /icon:spider/);
  assert.match(RENDER, /icon:disease/);
});

test('smoke: zoom/pan + FIT button wired', () => {
  assert.match(HTML, /id="fit-view"/);
  assert.match(HTML, /wireZoomPan/);
  assert.match(HTML, /resetView/);
  assert.match(HTML, /addEventListener\(['"]wheel['"]/);
});

test('smoke: SVG icon sprite system wired', () => {
  assert.match(HTML, /loadIconSprite/);
  assert.match(HTML, /icon-sprite/);
});

test('smoke: render emits use elements for icon-prefixed labels', () => {
  const RENDER = readFileSync(new URL('../app/lib/render.js', import.meta.url), 'utf8');
  assert.match(RENDER, /icon:skull/);
  assert.match(RENDER, /icon:shield/);
  assert.match(RENDER, /icon:angle-up/);
  assert.match(RENDER, /createElementNS\(SVG_NS,\s*['"]use['"]\)/);
});
