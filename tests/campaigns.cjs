const assert = require('node:assert/strict');
const { test } = require('node:test');

global.window = { NathGame: {} };
require('../src/campaigns.js');
require('../src/data/notes-content.js');
require('../src/notes-system.js');
const { createCampaignStore, createNotesSystem, notesCatalog } = window.NathGame;
const storage = new Map();
global.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key)
};
const storeAdapter = global.localStorage;

test('two independent campaigns and notes; evict lowest progress, then oldest', () => {
  const campaigns = createCampaignStore(storeAdapter);
  const notes = createNotesSystem(notesCatalog);
  assert.deepEqual(campaigns.all(), []);
  const a = campaigns.create().slot;
  notes.selectCampaign(a.id);
  assert.equal(notes.recordDeath(1, 'gotica').remaining, 11);
  assert.equal(notes.completeNight(1).length, 3);
  campaigns.advance(a.id, 1);
  campaigns.advance(a.id, 2);
  const b = campaigns.create().slot;
  notes.selectCampaign(b.id);
  assert.equal(notes.remaining(), 12);
  assert.equal(notes.files().length, 0);
  assert.equal(notes.completeNight(1).length, 3);
  notes.selectCampaign(a.id);
  assert.equal(notes.remaining(), 11);
  assert.equal(notes.files().length, 7);
  // Despite being created first, a is further along, so b must go.
  assert.equal(campaigns.eviction().id, b.id);
  const c = campaigns.create();
  assert.equal(c.removed.id, b.id);
  notes.deleteCampaign(b.id);
  assert.deepEqual(campaigns.all().map(slot => slot.id), [a.id, c.slot.id]);
  notes.selectCampaign(c.slot.id);
  assert.equal(notes.files().length, 0);
  assert.equal(notes.remaining(), 12);
  assert.equal(createCampaignStore(storeAdapter).all().length, 2);
  // Same progress: older ID loses.
  assert.equal(campaigns.eviction().id, c.slot.id);
  campaigns.advance(c.slot.id, 1);
  campaigns.advance(c.slot.id, 2);
  assert.equal(campaigns.eviction().id, a.id);
});

test('nine-night completion closes slot; stars persist across campaigns', () => {
  storage.clear();
  const campaigns = createCampaignStore(storeAdapter);
  const first = campaigns.create().slot;
  for (let night = 1; night <= 9; night++) {
    const result = campaigns.advance(first.id, night);
    assert.equal(result.closed, night === 9);
  }
  assert.equal(campaigns.all().length, 0);
  assert.equal(campaigns.stars(), 0);
  campaigns.awardCampaign(3);
  assert.equal(campaigns.stars(), 3);
  const next = campaigns.create().slot;
  assert.equal(campaigns.advance(next.id, 3), null, 'cannot skip nights');
  campaigns.awardMaxNight();
  assert.equal(campaigns.stars(), 7);
  assert.equal(createCampaignStore(storeAdapter).stars(), 7);
  assert.equal(campaigns.remove(next.id).id, next.id);
});

test('migrate legacy campaign progress and notes, without overwriting other slots', () => {
  storage.clear();
  storeAdapter.setItem('nnn.campaign.completed', '4');
  const legacy = createNotesSystem(notesCatalog);
  legacy.recordDeath(4, 'gotica');
  const campaigns = createCampaignStore(storeAdapter);
  assert.equal(campaigns.all().length, 1);
  assert.equal(campaigns.all()[0].completed, 4);
  const notes = createNotesSystem(notesCatalog);
  notes.selectCampaign(1);
  assert.equal(notes.remaining(), 11);
  const second = campaigns.create().slot;
  notes.selectCampaign(second.id);
  assert.equal(notes.remaining(), 12);
  notes.selectCampaign(1);
  assert.equal(notes.remaining(), 11);
  storage.clear();
  storeAdapter.setItem('nnn.campaign.completed', '9');
  assert.equal(createCampaignStore(storeAdapter).stars(), 3);
  assert.equal(createCampaignStore(storeAdapter).all().length, 0);
});

test('custom-night/extras UI and achievements remain in static site', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const menu = fs.readFileSync(path.join(root, 'src/night-menu.js'), 'utf8');
  const style = fs.readFileSync(path.join(root, 'src/styles/main.css'), 'utf8');
  for (const id of ['open-extras', 'extras-list', 'extras-preview', 'custom-max',
    'continue-game-2', 'campaign-stars', 'start-custom', 'custom-levels']) {
    assert(html.includes('id="' + id + '"'), id + ' missing');
  }
  assert(menu.includes("store.awardMaxNight()"));
  assert(menu.includes("select.value = String(target)"));
  assert(style.includes('title-screen[data-submenu] .title-actions{visibility:hidden;pointer-events:none}'));
});

test('extras use game scare layers and submenus preserve title and fast static', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const menu = fs.readFileSync(path.join(root, 'src/night-menu.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'src/styles/main.css'), 'utf8');
  const extras = html.slice(html.indexOf('id="extras-menu"'), html.indexOf('</section>', html.indexOf('id="extras-menu"')));
  assert(extras.includes('data-scare="palhaca-direita.gif">Palhaça 1'));
  assert(extras.includes('data-scare="palhaca-baixo.gif">Palhaça 2'));
  assert(!extras.includes('data-scare="yandere-camera.gif"'));
  assert(extras.indexOf('Palhaça 1') < extras.indexOf('Palhaça 2'));
  assert(html.includes('<div class="jumpscare" aria-hidden="true">'));
  assert(html.includes('class="jumpscare-art" id="extras-jumpscare-image"'));
  assert(html.includes('<div class="death-flash" aria-hidden="true"></div>'));
  assert(!css.includes('.title-screen[data-submenu] .title-content h1'));
  assert(!css.includes('.title-screen[data-submenu] .title-content{'));
  assert(css.includes('.title-screen[data-submenu] .title-actions{visibility:hidden;pointer-events:none}'));
  assert(css.includes('--noise-period:.34s'));
  assert(css.includes('animation:noise-drift .22s'));
  for (const state of ['blackout', 'scare', 'flash']) assert(menu.includes("title.dataset.defeat = '" + state + "'"));
  assert(menu.includes('timing.clownBottomCycleMs'));
});
