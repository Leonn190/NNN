const assert = require('node:assert/strict');
const { test } = require('node:test');
global.window = {};
for (const file of ['data/game-data', 'data/camera-layers', 'data/complex-layers', 'scene-art', 'gameplay/routes',
  'gameplay/effects', 'gameplay/threats', 'gameplay/gates', 'gameplay/electrical', 'gameplay/resources', 'gameplay/shadow', 'movement'])
  require('../src/' + file + '.js');
const N = window.NathGame;
const base = Object.fromEntries(['night', 'map', 'movement', 'characters', 'effects', 'threats', 'controls', 'sanity', 'power', 'shadow']
  .map(key => [key, require('../config/' + key + '.json')]));
const near = (actual, expected) => assert(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);
function scenario(moving = false) {
  const config = structuredClone(base);
  config.night.movementDelay = 0;
  config.night.powerEnabled = false;
  config.sanity.initial = 90;
  config.sanity.recovery.passive = 0;
  config.movement.jitter = { min: 0, max: 0 };
  Object.assign(config.characters.padrao, { start: 6, positions: [6, 15], interval: moving ? .2 : 1000, routes: { CV: 100 } });
  const events = [];
  const game = N.createMovement(config, { random: () => 0, emit: (...event) => events.push(event) });
  const input = { camera: 'CAM05', view: 'cameras' };
  game.reset({ padrao: 1 }, input);
  return { config, game, input, events };
}

test('gate static shares the configured deadline on opening, closing and repeated changes without a special penalty', () => {
  for (const initiallyClosed of [false, true]) {
    const { game, input, events } = scenario();
    if (initiallyClosed) game.advance(0, input, { type: 'gate', id: 'G05' });
    game.advance(1, input);
    const sanity = game.snapshot().sanity;
    assert(game.snapshot().observingCamera);
    game.advance(1, input, { type: 'gate', id: 'G05' });
    const pulse = events.filter(([event]) => event === 'gateInterference').at(-1)[1];
    near(pulse.until - pulse.at, base.effects.static.visual.gate.durationMs / 1000);
    near(game.snapshot().sanity, sanity);
    assert(!game.snapshot().observingCamera);
    game.advance(1.3, input, { type: 'gate', id: 'G04' });
    game.advance(1.949, input);
    assert(!game.snapshot().observingCamera);
    near(game.snapshot().sanity, sanity);
    game.advance(events.filter(([event]) => event === 'gateInterference').at(-1)[1].until, input);
    assert(game.snapshot().observingCamera);
    assert(!events.some(([event]) => event === 'cameraInterference'));
  }
});

test('unrelated gates and invisible camera feeds do not trigger mechanical static', () => {
  for (const extra of [{}, { cameraObservationBlocked: true }, { camera: null, view: 'desktop' }]) {
    const { game, input, events } = scenario();
    const next = { ...input, ...extra };
    game.advance(0, next, { type: 'gate', id: extra.cameraObservationBlocked || extra.camera === null ? 'G05' : 'G08' });
    assert(!events.some(([event]) => event === 'gateInterference'));
  }
});

test('gate static releases normal navigation while background observation blocks neither movement nor sanity', () => {
  for (const action of ['gate', 'background']) {
    const { game, input } = scenario(true);
    game.advance(1, input);
    assert.equal(game.diagnostics().find(actor => actor.key === 'padrao').position, 6);
    const next = action === 'gate' ? input : { ...input, cameraObservationBlocked: true };
    const sanity = game.snapshot().sanity;
    game.advance(1, next, action === 'gate' ? { type: 'gate', id: 'G05' } : undefined);
    game.advance(1.64, next);
    assert.equal(game.diagnostics().find(actor => actor.key === 'padrao').position, 15);
    near(game.snapshot().sanity, sanity);
  }
});

test('camera losses preserve the doubled feeds and direct loss; radio reduction preserves closet growth', () => {
  near(base.sanity.loss.camera, .13);
  near(base.sanity.loss.yandereCamera, .18);
  near(base.sanity.loss.direct, .44);
  for (const [key, overrides] of Object.entries(base.sanity.cameraLossOverrides))
    for (const value of Object.values(overrides)) near(value, 2 * base.sanity.loss[key === 'yandere' ? 'yandereCamera' : 'camera']);
  for (const hidden of [false, true]) for (const clownLight of [false, true]) {
    const config = structuredClone(base);
    config.threats.clown.initial = 40;
    const threats = N.createThreats(config, { palhaca: 1 }, () => 0, () => {});
    if (hidden) threats.enterCloset(0, true);
    threats.integrate(1, { radio: true, clownLight });
    near(threats.snapshot().counter, 40 - 1.85 + (hidden ? .8 * (clownLight ? 1.625 : 3.25) : 0));
  }
});

test('Shadow cannot be found through a background feed and its search timer keeps running', () => {
  for (const letTimerExpire of [false, true]) {
    const config = structuredClone(base);
    config.night.movementDelay = 0;
    config.night.powerEnabled = false;
    config.sanity.initial = 30;
    const game = N.createMovement(config, { random: () => 0 });
    game.reset({ shadow: 1 }, { computerInterface: true, view: 'desktop' });
    game.advance(0, { view: 'office' });
    const camera = game.snapshot().shadow.camera;
    assert(camera);
    game.advance(1, { camera, cameraObservationBlocked: true, view: 'desktop' });
    assert.notEqual(game.snapshot().shadow.phase, 'found');
    if (letTimerExpire) {
      game.advance(16, { camera: null, view: 'desktop' });
      assert.equal(game.snapshot().outcome, 'loss');
    } else {
      game.advance(1.1, { camera, view: 'cameras' });
      assert.equal(game.snapshot().shadow.phase, 'found');
    }
  }
});

test('real attack debug and prediction use the individual route duration', () => {
  for (const [key, objective, duration] of [
    ['gotica', 'corridor', 30], ['gotica', 'stock', 24], ['maid', 'corridor', 30],
    ['padrao', 'corridor', 24], ['padrao', 'stock', 24]
  ]) {
    const config = structuredClone(base);
    config.night.movementDelay = 0;
    config.movement.jitter = { min: 0, max: 0 };
    const start = objective === 'stock' ? config.map.leftApproach : config.map.back;
    const route = objective === 'stock' ? 'EL' : 'CV';
    Object.assign(config.characters[key], { start, interval: 1, routes: { [route]: 100 }, initialStationaryAttempts: 0 });
    config.movement.routes.definitions[route].paths = [[start]];
    const game = N.createMovement(config, { random: () => key === 'maid' ? 0 : .99 });
    game.reset({ [key]: 1 }, { view: 'office' });
    game.advance(2, { view: 'office' });
    const actor = game.debugSnapshot().actors.find(actor => actor.key === key);
    assert(actor.attackActive, JSON.stringify({ key, objective, actor }));
    near(actor.attackDuration, duration);
    near(actor.attackRemaining + actor.attackElapsed, duration);
    assert(actor.attackPrediction);
  }
});
