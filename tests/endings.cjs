const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

global.window = { NathGame: {}, addEventListener() {} };
require('../src/ending-sequences.js');

const { createCinematics, endingAssets, CINEMATIC_DEATH_MESSAGE,
  cinematicCreditPairs, cinematicCreditShots, cinematicCreditsDuration, cinematicCreditCueTime, cinematicCreditsOutroSeconds, panoramaWidth, deathPanDuration } = window.NathGame;

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
    classList: { add() {}, remove() {}, toggle() {} },
    handlers: {},
    addEventListener(event, callback) { this.handlers[event] = callback; },
    removeAttribute(key) { delete this[key]; },
    replaceChildren() { this.children = []; },
    append(element) { (this.children ??= []).push(element); },
    load() {}, pause() { this.playing = false; }, play() { this.playing = true; return Promise.resolve(); },
    focus() { this.focused = true; },
    get offsetWidth() { return 1; }
  });
  for (const id of ['cinematic', 'cinematic-image', 'cinematic-audio', 'cinematic-missing',
    'cinematic-quote', 'cinematic-credits', 'cinematic-close', 'cinematic-enable-audio', 'cinematic-image-next']) {
    entries.set('#' + id, create());
  }
  const credits = entries.get('#cinematic-credits');
  const cards = Array.from({ length: 2 }, () => {
    const role = create(), name = create();
    return { role, name, classList: { add() {}, remove() {}, toggle() {} }, querySelector(selector) {
      return selector === '.cinematic-credit-role' ? role : name;
    } };
  });
  credits.querySelectorAll = () => cards;
  const audio = entries.get('#cinematic-audio');
  audio.currentTime = 0;
  audio.playing = false;
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
      if (audio.playing) audio.currentTime = now / 1000;
      next[1].callback();
    }
    now = until;
    if (audio.playing) audio.currentTime = now / 1000;
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
  assert.equal(endingAssets.credits.image, './public/images/ending/creditos.png');
  assert.equal(endingAssets.death.image, './public/images/ending/armarios.png');
  // Confere que as cinco mídias reais, inclusive os PNG sem conversão, foram
  // incluídas e podem ser usadas pelo site sem depender de arquivos pendentes.
  for (const media of [endingAssets.credits.image, endingAssets.death.image,
    endingAssets.credits.audio, endingAssets.death.audio,
    './public/audio/radio/' + endingAssets.newRadioTrack]) {
    const full = path.join(__dirname, '..', media);
    assert(fs.existsSync(full), 'Mídia não encontrada: ' + media);
    assert(fs.statSync(full).size > 100_000, 'Mídia incompleta: ' + media);
  }
  assert.equal(cinematicCreditPairs.length, 24);
  assert.equal(cinematicCreditShots.length, 12);
  assert.equal(cinematicCreditsDuration, 200000);
  assert.equal(cinematicCreditsOutroSeconds, 7);
  assert.equal(cinematicCreditCueTime(193, 210), 203);
  assert.equal(cinematicCreditShots.at(-1).image, './public/images/ending/restaurante-vazio.png');
  assert.equal(cinematicCreditShots[0].pages[0].pair[1][1], '');
  assert(!cinematicCreditShots[0].pages.flatMap(p => p.pair)
    .some(([, name]) => name.includes('Leon')));
  const guards = ['Pedro Garcia', 'Pedro Babugia', 'Henrique Baatalha', 'Caio Pontes',
    'Felipe Riva', 'Felipe Lima', 'Arthur Ramos', 'Rafael Ferraz', 'Paulo Ventura',
    'Arthur Guedes', 'Alexandre Do Bim', 'João Gannoun'];
  const guardPages = cinematicCreditShots.flatMap(s => s.pages)
    .filter(p => p.pair.some(([role]) => role === 'INSPIRAÇÃO PARA OS SEGURANÇAS'));
  assert.equal(guardPages.length, 6);
  assert(guardPages.every(p => p.pair.some(([role, name]) =>
    role === 'INSPIRAÇÃO PARA OS SEGURANÇAS' && name.split(' · ').length === 2)));
  for (const guard of guards) {
    assert.equal(guardPages.filter(p => p.pair.some(([, name]) => name.includes(guard))).length, 1);
  }
  assert(cinematicCreditPairs.every(pair => pair.length === 2));
  const credits = cinematicCreditPairs.flat(2).join(' ');
  for (const expected of ['Leon Soto', 'Nathali Thomazine', 'Scott Cawthon',
    'Five Nights at Freddy', 'Shikairo Days', 'Kawaikute Gomen', 'Caramelldansen',
    'Static-P', 'Amree', 'JT Music', 'Gooseworx', 'Evan Alderete',
    'ChatGPT (GPT)', 'OpenAI Codex', 'João Gannoun', 'Pedro Garcia']) {
    assert(credits.toLowerCase().includes(expected.toLowerCase()), expected);
  }
  for (const shot of cinematicCreditShots) {
    assert(fs.existsSync(path.join(__dirname, '..', shot.image)), shot.image);
    assert(shot.pages.length >= 1 && shot.pages.length <= 3);
  }
  assert(CINEMATIC_DEATH_MESSAGE.includes('Agora só falta um'));
  assert(CINEMATIC_DEATH_MESSAGE.includes(String.fromCharCode(10)));
  assert.equal(panoramaWidth(4000, 1000, 1000, 500), 2000);
  assert.equal(panoramaWidth(1000, 2000, 1000, 500), 1120);
  assert.equal(deathPanDuration(NaN), 23000);
  assert.equal(deathPanDuration(50), 29600);
});

test('credits follow the audio clock, end with the stage and preserve 7 seconds without titles', () => {
  const mock = mockScene();
  try {
    const audio = mock.entries.get('#cinematic-audio');
    audio.duration = 200;
    const cinematic = createCinematics();
    let finished = 0;
    cinematic.play('credits', { onFinish: () => finished++ });
    assert(cinematic.active());
    assert.equal(mock.cards[0].role.textContent, 'NINE NIGHTS AT NATH\'S');
    assert.equal(mock.cards[1].name.textContent, '');
    mock.advance(9000);
    assert.equal(mock.cards[0].role.textContent, 'CRIAÇÃO E DIREÇÃO');
    assert.equal(mock.entries.get('#cinematic-image-next').src,
      './public/images/ending/recepcao.png');
    mock.advance(168000);
    assert.equal(mock.cards[0].role.textContent, 'OBRIGADO POR JOGAR');
    assert.equal(mock.entries.get('#cinematic-image-next').src,
      './public/images/ending/restaurante-vazio.png');
    mock.advance(16000);
    assert.equal(mock.cards[0].role.textContent, 'NINE NIGHTS AT NATH\'S');
    assert.equal(finished, 0);
    audio.onended();
    assert.equal(finished, 1);
    assert.equal(mock.entries.get('#cinematic').hidden, true);
    assert.equal(cinematic.active(), false);
  } finally { mock.cleanup(); }
});

test('credit timestamps scale to the true MP3 length and do not end before the audio', () => {
  const mock = mockScene();
  try {
    const audio = mock.entries.get('#cinematic-audio');
    audio.duration = 212;
    const cinematic = createCinematics();
    cinematic.play('credits');
    const firstCue = cinematicCreditCueTime(9, 212);
    mock.advance(Math.round((firstCue - .3) * 1000));
    assert.equal(mock.cards[0].role.textContent, 'NINE NIGHTS AT NATH\'S');
    mock.advance(500);
    assert.equal(mock.cards[0].role.textContent, 'CRIAÇÃO E DIREÇÃO');
    mock.advance(198000);
    assert(cinematic.active());
    assert.equal(mock.entries.get('#cinematic').hidden, false);
    audio.onended();
    assert(!cinematic.active());
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
    assert.equal(image.style.properties['--pan-distance'], '-1200px');
    assert.equal(image.style.top, '-25px');
    assert.equal(image.style.properties['--pan-ms'], '23000ms');
    assert.equal(mock.entries.get('#cinematic-quote').textContent, '');
    mock.advance(22999);
    assert.equal(mock.entries.get('#cinematic-quote').textContent, '');
    mock.advance(1);
    assert.equal(mock.entries.get('#cinematic-quote').textContent, 'A');
    mock.advance(10000);
    assert.equal(mock.entries.get('#cinematic-quote').textContent, CINEMATIC_DEATH_MESSAGE);
    mock.entries.get('#cinematic-audio').onended();
    mock.advance(6200);
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
  assert(css.includes('@keyframes cinematic-creep-in'));
  assert(css.includes('max-width:177.777778dvh'));
  assert(css.includes('@keyframes cinematic-stage-finale'));
  assert(css.includes('.is-epilogue'));
  assert(html.includes('id="cinematic-image-next"'));
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