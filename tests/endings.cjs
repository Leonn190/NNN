const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

global.window = { NathGame: {}, addEventListener() {} };
require('../src/ending-sequences.js');

const { createCinematics, endingAssets, CINEMATIC_DEATH_MESSAGE,
  cinematicCreditPairs, panoramaWidth, deathPanDuration } = window.NathGame;

function mockScene() {
  const entries = new Map();
  const create = () => ({
    hidden: true, textContent: '', dataset: {}, naturalWidth: 0, naturalHeight: 0,
    clientWidth: 1000, clientHeight: 500,
    style: {
      properties: {},
      setProperty(key, value) { this.properties[key] = value; },
      removeProperty(key) { delete this.properties[key]; }
    },
    classList: { add() {}, remove() {} },
    handlers: {},
    addEventListener(event, callback) { this.handlers[event] = callback; },
    removeAttribute(key) { delete this[key]; },
    replaceChildren() { this.children = []; },
    append(element) { (this.children ??= []).push(element); },
    load() {}, pause() {}, play() { return Promise.resolve(); },
    focus() { this.focused = true; },
    get offsetWidth() { return 1; }
  });
  for (const id of ['cinematic', 'cinematic-image', 'cinematic-audio', 'cinematic-missing',
    'cinematic-quote', 'cinematic-credits', 'cinematic-close', 'cinematic-enable-audio']) {
    entries.set('#' + id, create());
  }
  const credits = entries.get('#cinematic-credits');
  const cards = Array.from({ length: 2 }, () => {
    const role = create(), name = create();
    return { role, name, querySelector(selector) {
      return selector === '.cinematic-credit-role' ? role : name;
    } };
  });
  credits.querySelectorAll = () => cards;
  let focusCount = 0;
  let now = 0;
  let nextId = 1;
  const pending = new Map();
  const originalTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;
  const originalDocument = global.document;
  global.setTimeout = (callback, ms) => {
    const id = nextId++;
    pending.set(id, { callback, when: now + ms });
    return id;
  };
  global.clearTimeout = id => pending.delete(id);
  global.document = {
    activeElement: { focus() { focusCount++; } },
    querySelector: selector => entries.get(selector),
    createElement: () => create(),
    addEventListener() {}
  };
  const advance = ms => {
    const until = now + ms;
    let loops = 0;
    while (true) {
      const next = [...pending].filter(([, item]) => item.when <= until)
        .sort((a, b) => a[1].when - b[1].when)[0];
      if (!next) break;
      if (++loops > 10000) throw new Error('loop de timers');
      pending.delete(next[0]);
      now = next[1].when;
      next[1].callback();
    }
    now = until;
  };
  return {
    entries, cards, advance,
    focusCount: () => focusCount,
    cleanup() {
      global.setTimeout = originalTimeout;
      global.clearTimeout = originalClearTimeout;
      global.document = originalDocument;
    }
  };
}

test('media manifest, pair credits, quote and panoramic geometry', () => {
  assert.equal(endingAssets.credits.audio, './public/audio/ending/creditos.mp3');
  assert.equal(endingAssets.death.audio, './public/audio/ending/morte.mp3');
  assert.equal(endingAssets.newRadioTrack, 'musica-nova.mp3');
  assert.equal(cinematicCreditPairs.length, 6);
  assert(cinematicCreditPairs.every(pair => pair.length === 2
    && pair.every(([, credited]) => credited === 'Leon Soto')));
  assert(CINEMATIC_DEATH_MESSAGE.includes('Agora só falta 1'));
  assert.equal(panoramaWidth(4000, 1000, 1000, 500), 2000);
  assert.equal(panoramaWidth(1000, 2000, 1000, 500), 1120);
  assert.equal(deathPanDuration(NaN), 28000);
  assert.equal(deathPanDuration(50), 37000);
});

test('credits show only two credits at a time and finish on music end', () => {
  const mock = mockScene();
  try {
    const cinematic = createCinematics();
    let finished = 0;
    cinematic.play('credits', { onFinish: () => finished++ });
    assert(cinematic.active());
    assert.equal(mock.cards[0].name.textContent, 'Leon Soto');
    assert.equal(mock.cards[1].name.textContent, 'Leon Soto');
    assert.equal(mock.cards[0].role.textContent, 'UM JOGO DE');
    mock.advance(7200);
    assert.equal(mock.cards[0].role.textContent, 'PROGRAMAÇÃO');
    mock.advance(7200 * 4);
    assert.equal(mock.cards[0].role.textContent, 'NINE NIGHTS AT NATH\'S');
    mock.entries.get('#cinematic-audio').onended();
    assert.equal(finished, 1);
    assert.equal(mock.entries.get('#cinematic').hidden, true);
    assert.equal(cinematic.active(), false);
  } finally { mock.cleanup(); }
});

test('death sequence reaches right edge before typing each character and returns to game over', () => {
  const mock = mockScene();
  try {
    const cinematic = createCinematics();
    let finished = 0;
    cinematic.play('death', { onFinish: () => finished++ });
    const image = mock.entries.get('#cinematic-image');
    image.naturalWidth = 4000;
    image.naturalHeight = 1000;
    image.onload();
    assert.equal(image.style.properties['--pan-distance'], '-1000px');
    assert.equal(image.style.properties['--pan-ms'], '28000ms');
    assert.equal(mock.entries.get('#cinematic-quote').textContent, '');
    mock.advance(27999);
    assert.equal(mock.entries.get('#cinematic-quote').textContent, '');
    mock.advance(1);
    assert.equal(mock.entries.get('#cinematic-quote').textContent, 'A');
    mock.advance(10000);
    assert.equal(mock.entries.get('#cinematic-quote').textContent, CINEMATIC_DEATH_MESSAGE);
    mock.entries.get('#cinematic-audio').onended();
    mock.advance(6500);
    assert.equal(finished, 1);
    assert.equal(cinematic.active(), false);
  } finally { mock.cleanup(); }
});

test('finish/death hooks, Extras buttons and radio unlock persist', () => {
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const main = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');
  const menu = fs.readFileSync(path.join(root, 'src/night-menu.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'src/styles/endings.css'), 'utf8');
  assert(html.includes('data-cinematic="credits"'));
  assert(html.includes('data-cinematic="death"'));
  assert(html.includes('src/ending-sequences.js'));
  assert(html.includes('id="cinematic-close"'));
  assert(css.includes('@keyframes cinematic-pan'));
  assert(css.includes('@keyframes cinematic-float'));
  assert(main.includes("cinematics.play('credits'"));
  assert(main.includes("cinematics.play('death'"));
  assert(main.includes('campaignResult?.closed'));
  assert(main.includes('deathCinematicPending = Boolean(death?.exhausted)'));
  assert(main.includes('canPlayCampaign: () => true'));
  assert(main.includes('endingAssets.newRadioTrack'));
  assert(main.includes('createCampaignStore().stars() & 1'));
  assert(main.includes('endingAssets.credits.audio'));
  assert(menu.includes('onPlayCinematic(cinematic.dataset.cinematic'));
  assert(!main.includes('endExhaustedCampaign('));
});