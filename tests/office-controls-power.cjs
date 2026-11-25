const assert = require('node:assert/strict');
const { test } = require('node:test');

global.window = {};
for (const file of ['data/game-data', 'gameplay/resources', 'gameplay/gates', 'gameplay/routes']) {
  require('../src/' + file + '.js');
}
const { createResources, createGates, createRoutes, OFFICE, VENUE } = window.NathGame;
const config = Object.fromEntries(['night', 'sanity', 'power', 'map'].map(name => [name, require('../config/' + name + '.json')]));
const near = (actual, expected) => assert(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('camera and office gates consume their own rates independently and together', () => {
  for (const [closed, rate] of [[[], 0], [['G04'], .24], [[OFFICE.gate], .34], [['G04', 'G05', OFFICE.gate], .82]]) {
    const resources = createResources(config, { ...config.night, powerEnabled: true, sanityEnabled: false });
    resources.turnComputerOff();
    const input = { gates: new Set(closed) };
    near(resources.snapshot(0, input, {}).energyLossPerSecond, rate);
    resources.segment(0, 10, input, {});
    near(resources.snapshot(10).energy, 100 - rate * 10);
  }
});

test('Parts and Service has a free passage in both directions and no controllable gate', () => {
  const routes = createRoutes(config.map);
  for (const [from, to] of [[15, 16], [16, 15]]) {
    assert.equal(routes.connection(from, to).type, 'free');
    assert.equal(routes.gate(from, to), undefined);
  }
  assert.equal(VENUE.openings.find(opening => opening.id === 'P04').type, 'livre');
  const gates = createGates(3, () => assert.fail('Passage must not toggle'), ['P04']);
  assert.equal(gates.closed.has('P04'), false);
  assert.equal(gates.toggle('P04', 'cameras', false), false);
});

test('Q and E dispatch the contextual actions without repeating toggles', () => {
  const fs = require('node:fs');
  const vm = require('node:vm');
  const main = fs.readFileSync(require('node:path').join(__dirname, '../src/main.js'), 'utf8');
  const start = main.indexOf('let lastCameraKeyAt =');
  const end = main.indexOf("document.addEventListener('keyup'", start);
  const actions = [];
  let handler;
  const state = { mode: 'office' };
  const dom = { game: {}, desktop: { hidden: true }, computerScreen: {} };
  const cameraApp = { panel: {} };
  const context = {
    document: { addEventListener: (_, callback) => handler = callback },
    state, dom, cameraApp, developerDebug: false,
    closeComputer: () => actions.push('exit'),
    toggleOfficeGate: () => actions.push('gate'),
    toggleRadio: () => actions.push('radio'),
    playCameraAudio: () => actions.push('cameraAudio'),
    watchingCameras: () => state.mode === 'cameras',
    flashlightTarget: () => false
  };
  vm.runInNewContext(main.slice(start, end), context);
  const press = (key, extra = {}) => handler({ key, preventDefault() {}, ...extra });
  press('q'); press('E');
  assert.deepEqual(actions.splice(0), ['gate', 'radio']);
  press('q', { repeat: true }); press('e', { repeat: true });
  press('e', { target: { isContentEditable: true } });
  press('q', { ctrlKey: true });
  assert.deepEqual(actions, []);
  state.mode = 'desktop'; dom.desktop.hidden = false;
  press('e'); press('q');
  assert.deepEqual(actions.splice(0), ['exit']);
  state.mode = 'cameras';
  press('e'); press('q');
  assert.deepEqual(actions.splice(0), ['cameraAudio', 'exit']);
  cameraApp.panel.inert = true;
  press('e');
  assert.deepEqual(actions, []);
  state.mode = 'closet'; dom.desktop.hidden = true;
  press('q'); press('e');
  assert.deepEqual(actions, []);
});

test('radio starts once at 12 seconds in any view, unless manually started earlier', () => {
  const fs = require('node:fs');
  const vm = require('node:vm');
  const main = fs.readFileSync(require('node:path').join(__dirname, '../src/main.js'), 'utf8');
  const source = main.slice(main.indexOf('function mutePhoneCall()'), main.indexOf('function setClownPhase('));
  for (const mode of ['office', 'desktop', 'cameras', 'closet']) {
    const state = { mode, startedAt: 1000, radioAutoPending: true };
    let starts = 0;
    const context = {
      state, radioPlayback: null,
      controls: { radioAutoStartSeconds: 12, radioTracks: ['track.mp3'] },
      endingAssets: { newRadioTrack: 'new.mp3' },
      movement: { snapshot: () => ({ radioAvailable: true }) },
      sound: { connectRadio() {} },
      window: { NathGame: { createCampaignStore: () => ({ stars: () => 0 }) } },
      radioMusic: { play: () => { starts++; return Promise.resolve(); } },
      dom: { officeRadio: { setAttribute() {} } },
      updateRadioMix() {}, fallbackRadio() {},
      stopRadio() { context.radioPlayback = null; }
    };
    vm.createContext(context);
    vm.runInContext(source, context);
    context.autoStartRadio(12999);
    assert.equal(starts, 0);
    context.autoStartRadio(13000);
    assert.equal(starts, 1, mode);
    context.stopRadio();
    context.autoStartRadio(25000);
    assert.equal(starts, 1);
    // Even a radio manually switched on and then off prevents automatic startup.
    state.mode = 'office'; state.radioAutoPending = true;
    context.toggleRadio();
    context.toggleRadio();
    assert.equal(starts, 2);
    context.autoStartRadio(13000);
    assert.equal(starts, 2);
    state.radioAutoPending = true; state.complete = true;
    context.autoStartRadio(13000);
    assert.equal(starts, 2);
  }
});

test('radio drain is 0.055 per second', () => {
  const resources = createResources(config, { ...config.night, powerEnabled: true, sanityEnabled: false });
  resources.turnComputerOff();
  const input = { radio: true, gates: new Set() };
  near(resources.snapshot(0, input, {}).energyLossPerSecond, .055);
  resources.segment(0, 10, input, {});
  near(resources.snapshot(10).energy, 99.45);
});
