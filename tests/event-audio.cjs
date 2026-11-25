const assert = require('node:assert/strict');
const { test } = require('node:test');
global.window = { NathGame: {} };
for (const file of ['data/game-data', 'data/camera-layers', 'data/complex-layers', 'scene-art', 'gameplay/routes', 'gameplay/effects',
  'gameplay/threats', 'gameplay/gates', 'gameplay/electrical', 'gameplay/resources', 'gameplay/shadow', 'movement', 'sound']) require('../src/' + file + '.js');
const N = window.NathGame;
const base = Object.fromEntries(['night', 'map', 'movement', 'characters', 'effects', 'threats', 'controls', 'sanity', 'power', 'shadow']
  .map(name => [name, require('../config/' + name + '.json')]));
function audioScenario(number = 5) {
  const sound = new N.SoundEngine(), played = [];
  sound.prepareShift(base.controls.nightAudio, number, base.effects);
  sound.playSample = (file, volume) => played.push({ file, volume });
  sound.startShift();
  return { sound, played };
}
function draws(mock, values, task) {
  const random = mock.method(Math, 'random', () => values.shift() ?? .99);
  try { return task(); } finally { random.mock.restore(); }
}
test('special voices are exclusive to campaign 5–9, unique per file, and reset on retry', ({ mock }) => {
  for (const number of [undefined, null, 0, 1, 2, 3, 4, 10]) {
    const { sound, played } = audioScenario(number === undefined ? null : number);
    sound.handleGameAudioEvent('defended', {});
    sound.handleGameAudioEvent('padraoAttackWarning');
    sound.handleGameAudioEvent('invasion', { key: 'padrao' });
    sound.updateSpecialVoices(30, false);
    assert.equal(played.length, 0);
  }
  for (const number of [5, 6, 7, 8, 9]) {
    const { sound, played } = audioScenario(number);
    for (let i = 0; i < 10; i++) sound.handleGameAudioEvent('defended', {});
    assert.equal(played.length, 4);
    assert.equal(new Set(played.map(p => p.file)).size, 4);
    sound.handleGameAudioEvent('padraoAttackWarning');
    sound.handleGameAudioEvent('padraoAttackWarning');
    sound.handleGameAudioEvent('padraoAttackWarning');
    assert.equal(played.length, 6);
    sound.stopShift();
    sound.handleGameAudioEvent('defended', {});
    assert.equal(played.length, 6);
    sound.prepareShift(base.controls.nightAudio, number, base.effects);
    sound.startShift();
    sound.handleGameAudioEvent('defended', {});
    assert.equal(played.length, 7);
  }
});
test('absence rolls once per camera absence; failed invasion rolls retry on the next invasion', ({ mock }) => {
  const { sound, played } = audioScenario();
  draws(mock, [.6, .599, 0], () => {
    sound.updateSpecialVoices(24.99, false);
    assert.equal(played.length, 0);
    sound.updateSpecialVoices(25, false); // 60% boundary fails.
    sound.updateSpecialVoices(100, false);
    assert.equal(played.length, 0);
    sound.updateSpecialVoices(101, true);
    sound.updateSpecialVoices(102, false);
    sound.updateSpecialVoices(126.99, false);
    assert.equal(played.length, 0);
    sound.updateSpecialVoices(127, false);
    assert.equal(played.length, 1);
    sound.updateSpecialVoices(200, true);
    sound.updateSpecialVoices(201, false);
    sound.updateSpecialVoices(300, false);
    assert.equal(played.length, 1);
  });
  draws(mock, [.8, .799, 0], () => {
    sound.handleGameAudioEvent('invasion', { key: 'padrao' });
    assert.equal(sound.specialVoices.padraoInvasion, false);
    sound.handleGameAudioEvent('invasion', { key: 'padrao' });
    assert.equal(sound.specialVoices.padraoInvasion, true);
    sound.handleGameAudioEvent('invasion', { key: 'padrao' });
    assert.equal(sound.specialVoices.padraoInvasion, false);
  });
  assert.equal(played.length, 2);
});
test('birthday rolls only on an actual Padrao move and never repeats after success', ({ mock }) => {
  const { sound, played } = audioScenario();
  draws(mock, [.01, .009, 0], () => {
    sound.handleGameAudioEvent('move', { actor: { key: 'padrao' }, from: 1, to: 1 });
    sound.handleGameAudioEvent('move', { actor: { key: 'gotica' }, from: 1, to: 2 });
    sound.handleGameAudioEvent('move', { actor: { key: 'padrao' }, from: 1, to: 2 });
    assert.equal(played.length, 0);
    sound.handleGameAudioEvent('move', { actor: { key: 'padrao' }, from: 2, to: 3 });
    sound.handleGameAudioEvent('move', { actor: { key: 'padrao' }, from: 3, to: 4 });
    assert.equal(played.length, 1);
  });
});
test('clown max starts exactly one irreversible 8–12 second finale and retains other lethal entry rules', () => {
  for (const draw of [0, .5, .999]) {
    const config = structuredClone(base), events = [], losses = [];
    Object.assign(config.threats.clown, { initial: 99, growth: [1, 1] });
    let calls = 0;
    const threats = N.createThreats(config, { palhaca: 1 }, () => { calls++; return draw; }, (...e) => events.push(e));
    threats.integrate(1, {});
    threats.resolve(1, () => {}, key => losses.push(key), false, false);
    const end = 1 + 8 + draw * 4;
    assert.equal(threats.snapshot().clownFinaleAt, end);
    assert.equal(threats.clownStage(), -1);
    assert.equal(events.filter(e => e[0] === 'clownFinale').length, 1);
    threats.integrate(50, { radio: true, clownLight: true });
    threats.enterCloset(2);
    threats.resolve(end - .001, () => {}, key => losses.push(key), true, true);
    assert.equal(losses.length, 0);
    assert.equal(threats.snapshot().counter, 100);
    assert.equal(calls, 1);
    threats.resolve(end, () => {}, key => losses.push(key), true, true);
    assert.deepEqual(losses, ['palhaca']);
  }
  const config = structuredClone(base); config.threats.clown.initial = 83;
  const losses = [], threats = N.createThreats(config, { palhaca: 1 }, () => .5, () => {});
  assert.equal(threats.enterCloset(0), false);
  threats.resolve(0, () => {}, key => losses.push(key), false, false);
  assert.deepEqual(losses, ['palhaca']);
});
function movementScenario(key = 'padrao', tune = () => {}, initial = {}, random = () => .99) {
  const config = structuredClone(base), events = [];
  config.movement.jitter = { min: 0, max: 0 };
  config.night.movementDelay = 0;
  config.night.hoursToWin = 100;
  Object.assign(config.characters[key], { start: config.map.back, interval: .1, initialStationaryAttempts: 0,
    routes: { CV: 100 }, firstRoutes: { CV: 100 }, firstIntervalReduction: [0, 0] });
  config.movement.routes.definitions.CV.paths = [[config.map.back]];
  for (const loss of Object.keys(config.sanity.loss)) config.sanity.loss[loss] = 0;
  config.sanity.recovery = { passive: 0, music: 0 };
  tune(config);
  const game = N.createMovement(config, { random, emit: (...e) => events.push(e) });
  const input = { view: 'office', ...initial };
  game.reset({ [key]: 1 }, input);
  return { game, events, input, config, actor: () => game.debugSnapshot().actors.find(a => a.key === key) };
}
test('late corridor flashlight costs exactly one sanity point per attack; early light prevents the penalty', () => {
  const late = movementScenario();
  let at = 0;
  while (late.actor().position !== base.map.front && at < 20) late.game.advance(at += .1, late.input);
  assert.equal(late.actor().position, base.map.front);
  const lit = { ...late.input, flashlight: true, corridorLight: true };
  late.game.advance(at, lit);
  assert.equal(late.game.snapshot().sanity, 99);
  late.game.advance(at + .1, late.input); late.game.advance(at + .1, lit);
  assert.equal(late.game.snapshot().sanity, 99);
  assert.equal(late.events.filter(e => e[0] === 'lateFlashlight').length, 1);
  const early = movementScenario('padrao', () => {}, { flashlight: true, corridorLight: true });
  early.game.advance(10, early.input);
  assert.equal(early.game.snapshot().sanity, 100);
  assert.equal(early.events.filter(e => e[0] === 'lateFlashlight').length, 0);
});
test('Padrao 85% warning fires once even if the bar regresses, and blackout is immediate and unique', () => {
  const s = movementScenario('padrao', () => {}, { radio: true });
  let at = 0;
  while (s.events.every(e => e[0] !== 'padraoAttackWarning') && at < 20) s.game.advance(at += .1, s.input);
  assert.equal(s.events.filter(e => e[0] === 'padraoAttackWarning').length, 1);
  assert(s.actor().attackProgress >= 85 && s.actor().attackProgress < 87);
  s.game.advance(at + .2, s.input);
  assert.equal(s.events.filter(e => e[0] === 'padraoAttackWarning').length, 1);
  const off = movementScenario('padrao', c => { c.power.initial = .001; });
  off.game.advance(.1, off.input);
  assert.equal(off.game.snapshot().energy, 0);
  assert.equal(off.events.filter(e => e[0] === 'powerdown').length, 1);
  off.game.advance(1, off.input);
  assert.equal(off.events.filter(e => e[0] === 'powerdown').length, 1);
});
test('defense events come from an actual repelled attack, not ordinary movement', () => {
  const s = movementScenario('gotica', () => {}, { flashlight: true, corridorLight: true });
  s.game.advance(10.2, s.input);
  assert(s.events.some(e => e[0] === 'defended' && e[1].reason === 'flashlight'));
  assert.equal(s.events.filter(e => e[0] === 'defended').length, 1);
  s.game.advance(10.25, s.input);
  assert.equal(s.events.filter(e => e[0] === 'defended').length, 1);
});

test('central gate counterattack emits one run after the knock and suppresses the subsequent stock laugh', () => {
  const s = movementScenario('padrao', c => {
    c.movement.routes.counterattack.padrao = 1;
    c.characters.padrao.doorChance = [0, 0];
  }, { radio: true, gates: [N.OFFICE.gate] }, () => 0);
  s.game.advance(18, s.input);
  const knock = s.events.findIndex(e => e[0] === 'officeGateKnock');
  const run = s.events.findIndex(e => e[0] === 'stockCounterattack');
  assert(knock >= 0 && run > knock);
  assert.equal(s.events.filter(e => e[0] === 'stockCounterattack').length, 1);
  // Counterattack navigation remains governed by its original wait and route.
  s.game.advance(25, s.input);
  const stock = s.events.find(e => e[0] === 'stockAttack');
  assert(stock && stock[2] === 'counterattack');
});
test('after-knock playback waits for the actual media end and is canceled on shutdown', () => {
  const { sound, played } = audioScenario();
  const listeners = new Set();
  const knock = { paused: false, ended: false,
    addEventListener(name, fn) { listeners.add(fn); }, removeEventListener(name, fn) { listeners.delete(fn); } };
  const file = base.effects.officeGateKnockSound.file;
  sound.lastSampleVoice.set(file, knock);
  sound.playAfterSample(file, () => sound.playConfiguredEffect('stockCounterattack'));
  assert.equal(played.length, 0);
  for (const fn of [...listeners]) fn();
  assert.equal(played.length, 1);
  assert.equal(listeners.size, 0);
  sound.playAfterSample(file, () => sound.playConfiguredEffect('stockCounterattack'));
  const stale = [...listeners][0];
  sound.stopShift();
  stale();
  assert.equal(played.length, 1);
  assert.equal(listeners.size, 0);
});
