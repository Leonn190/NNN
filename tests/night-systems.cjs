const assert = require('node:assert/strict');
const fs = require('node:fs');

global.window = {};
for (const file of ['data/game-data', 'data/camera-layers', 'data/complex-layers', 'gameplay/routes', 'gameplay/effects', 'gameplay/threats',
  'gameplay/gates', 'gameplay/electrical', 'gameplay/resources', 'gameplay/shadow', 'scene-art', 'movement']) {
  require('../src/' + file + '.js');
}
const { createMovement, sanityRate, hourDuration, clockProgress, shadowDifficulty, CAMERAS } = window.NathGame;
const base = Object.fromEntries(['night', 'map', 'movement', 'characters', 'effects', 'threats',
  'controls', 'sanity', 'power', 'shadow'].map(name => [name, require('../config/' + name + '.json')]));
const near = (actual, expected, tolerance = 1e-8) => assert(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

function scenario({ levels, input, draws = [], tune = () => {}, nightNumber } = {}) {
  const config = structuredClone(base);
  tune(config);
  const events = [];
  let calls = 0;
  const game = createMovement(config, { hallucinationRandom: () => .99, random: () => { calls++; return draws.shift() ?? 0; },
    emit: (...args) => events.push(args) });
  if (nightNumber) {
    const { levels: campaignLevels, ...rules } = config.night.campaign[nightNumber - 1];
    game.reset(campaignLevels, input, { ...config.night, ...rules });
  } else game.reset(levels, input);
  return { game, events, calls: () => calls, state: game.snapshot, hud: () => game.snapshot({ hud: true }),
    at: (time, next = {}, action) => game.advance(time, next, action),
    returnAt: (time, source = 'computer') => game.advance(time, { view: 'office' }, { type: 'returnToOffice', source }) };
}

const campaignLevels = {
  gotica:  [5, 5, 3, 3, 3, 4, 5, 7, 7],
  yandere: [3, 7, 5, 4, 4, 5, 5, 7, 7],
  palhaca: [0, 2, 1, 2, 5, 8, 4, 5, 5],
  padrao:  [0, 0, 1, 2, 3, 4, 8, 9, 10],
  gatinha: [0, 0, 0, 1, 2, 10, 7, 7, 7],
  maid:    [0, 0, 0, 0, 9, 2, 5, 7, 7],
  smores:  [0, 0, 0, 0, 0, 3, 2, 5, 6],
  shadow:  [0, 0, 0, 0, 0, 0, 1, 3, 10]
};
assert.equal(base.night.campaign.length, 9);
const movementDelays = [40, 40, 30, 25, 20, 20, 15, 12, 12];
for (const [index, entry] of base.night.campaign.entries()) {
  const nightNumber = index + 1;
  const secondsPerHour = [50, 55][index] ?? 60;
  const delay = movementDelays[index];
  assert.equal(entry.movementDelay, delay);
  assert.deepEqual(entry.levels, Object.fromEntries(Object.entries(campaignLevels).map(([id, row]) => [id, row[index]])));
  const input = { closet: true, radio: true, computer: true, gates: ['G01'] };
  const test = scenario({ nightNumber, input, tune(config) { config.power.initial = 1; } });
  const expectedActors = Object.entries(entry.levels).filter(([id, level]) => level > 0 && id in base.characters);
  assert.deepEqual(test.game.diagnostics().map(({ key, level }) => [key, level]).sort(), expectedActors.sort());
  assert.equal(test.state().sanity, 100);
  assert.equal(test.state().clownStage >= 0, nightNumber >= 2);
  test.at(1, input);
  assert.equal(test.state().sanity < 100, nightNumber >= 4);
  near(test.state().hours, 1 / secondsPerHour);
  near(test.state().energy, nightNumber >= 3 ? 1 - .025 - .30 - .06 : 100);
  test.at(10, input);
  assert.equal(test.state().blackout, nightNumber >= 3);
  assert.equal(test.state().computerOn, nightNumber <= 2);
  if (nightNumber <= 2) {
    assert.equal(test.state().sanity, 100);
    assert(test.game.camerasAvailable());
    assert.equal(test.game.isGateClosed('G01'), nightNumber === 2);
    test.at(10, input, { type: 'computerPower' });
    assert.equal(test.state().computerOn, false);
    test.at(10, input, { type: 'computerPower' });
    assert.equal(test.state().computerOn, true);
    assert.equal(test.state().radioAvailable, true);
  }
  const watching = { computer: true, radio: true };
  const encounter = scenario({ nightNumber, input: watching, tune(config) {
    config.sanity.initial = 20;
    config.power.initial = 100;
    for (const actor of Object.values(config.characters)) actor.interval = 1000;
  } });
  const actors = encounter.game.diagnostics();
  const initialCounter = encounter.state().counter;
  encounter.at(delay - .01, watching);
  assert.deepEqual(encounter.game.diagnostics().map(({ position, remaining }) => [position, remaining]),
    actors.map(({ position, remaining }) => [position, remaining]));
  assert.equal(encounter.state().counter, initialCounter);
  assert.equal(encounter.game.officeState().smores, 'idle');
  encounter.returnAt(delay - .01);
  assert.equal(encounter.state().shadow.phase, 'inactive');
  encounter.at(delay, watching);
  encounter.at(delay + 15, watching);
  near(encounter.state().hours, nightNumber >= 4
    ? clockProgress(base.night.clock, 20, .14, delay - .01)
      + clockProgress(base.night.clock, 20 + .14 * (delay - .01), .04, .01)
      + clockProgress(base.night.clock, 20 + .14 * (delay - .01) + .0004, .14, 15) : (delay + 15) / secondsPerHour);
  near(encounter.game.diagnostics()[0].remaining, actors[0].remaining - 15);
  assert.equal(encounter.game.officeState().smores, nightNumber >= 6 ? 'vent' : 'idle');
  encounter.returnAt(delay + 15);
  assert.equal(encounter.state().shadow.phase, nightNumber >= 7 ? 'manifested' : 'inactive');

  const gates = scenario({ nightNumber });
  const gateIds = window.NathGame.VENUE.openings.filter(({ type }) => type === 'portao').map(({ id }) => id);
  for (const id of gateIds) {
    assert.equal(gates.at(0, {}, { type: 'gate', id }), index > 0);
  }
  assert.equal(gateIds.filter(gates.game.isGateClosed).length, index);
}

const firstYandereMove = scenario({ nightNumber: 2, tune(config) {
  Object.assign(config.characters.yandere, { start: 19, positions: [19, 21], interval: 5 });
  config.movement.jitter = { min: 0, max: 0 };
} });
const yandere = () => firstYandereMove.game.diagnostics().find(actor => actor.key === 'yandere');
const firstInterval = 5 * .70 * .52;
near(yandere().remaining, firstInterval);
firstYandereMove.at(40 + firstInterval - .001);
assert.equal(yandere().position, 19);
firstYandereMove.at(40 + firstInterval + .001);
assert.equal(yandere().position, 21);

// Constant inputs should yield the same resources and discrete events at any frame cadence.
const cadences = [1 / 144, 1 / 30, 8.7, 180];
const progress = cadences.map(interval => {
  const input = { view: 'closet', computer: true, radio: true, flashlight: true, gates: ['G01'] };
  const run = scenario({ input, levels: { padrao: 1, gotica: 1 } });
  run.at(0, input, { type: 'closetEnter' });
  for (let index = 1; index * interval < 170; index++) run.at(index * interval, input);
  run.at(170, input);
  return { frame: run.state(), moves: run.events.filter(([event]) => event === 'move')
    .map(([, { from, to }]) => [from, to]) };
});
assert(progress[0].moves.length > 0);
for (const { frame, moves } of progress) {
  assert.equal(frame.now, 170);
  for (const key of ['hours', 'energy', 'sanity']) near(frame[key], progress[0].frame[key]);
  assert.deepEqual(moves, progress[0].moves);
}

for (const [conditions, rate] of [
  [{ cameraLoss: .20 }, -.20], [{ cameraLoss: .25 }, -.25],
  [{ direct: true }, -.45], [{ closet: true }, -.60],
  [{ direct: true, invasion: true }, -2.95], [{ centralGate: true }, -.12],
  [{ radio: true, cameraLoss: .20 }, -.10], [{}, .04], [{ radio: true }, .14],
  [{ radio: true, direct: true, closet: true, blackout: true }, -2.00],
  [{ radio: true, blackout: true }, .14]
]) near(sanityRate(base.sanity, conditions), rate);

const stageFeed = { camera: 'CAM03', visibleCameraSource: './public/images/cameras/CAM03/states/todas.webp' };
const empty = scenario({ input: stageFeed, tune: config => { config.sanity.initial = 50; } });
empty.at(10);
near(empty.state().sanity, 50.4);
const stage = scenario({ levels: { padrao: 1, gotica: 1 }, input: stageFeed });
stage.at(10, { camera: 'CAM01' });
near(stage.state().sanity, 98);
stage.at(12);
near(stage.state().sanity, 98.08);
const yandereOnStage = scenario({ levels: { padrao: 1, yandere: 1 }, input: stageFeed });
yandereOnStage.at(8);
near(yandereOnStage.state().sanity, 98);

function observation(start, input, expected, key = 'padrao') {
  const test = scenario({ levels: { [key]: 1 }, input, tune(config) {
    config.characters[key].start = start;
    config.characters[key].interval = 100;
  } });
  near(test.hud().sanityLossPerSecond, (100 - expected) / 2);
  test.at(2);
  near(test.state().sanity, expected);
}
const { left, front, office } = base.map;
observation(left, { view: 'office', officeBounds: [0, 480] }, 99.1);
observation(left, { view: 'office', officeBounds: [800, 1300] }, 100);
observation(left, { view: 'closet-door', closet: true, closetBounds: [500, 900] }, 97.90);
observation(office, { view: 'office', officeBounds: [800, 1300] }, 95);
observation(office, { view: 'closet-door', closet: true, closetBounds: [400, 900] }, 93.80);
observation(front, { view: 'office', officeBounds: [800, 1300], corridorLight: true }, 99.1);
observation(front, { view: 'office', officeBounds: [800, 1300] }, 100);
observation(16, { camera: 'CAM09' }, 99.6, 'maid');
observation(1, { camera: 'CAM03' }, 99.5, 'yandere');
observation(1, { camera: 'CAM03', visibleCameraSource: null }, 100);
const { cameraActorFrame, cameraObservation } = window.NathGame;
const service = CAMERAS.find(cam => cam.id === 'CAM09');
const maid = { key: 'maid', level: 1, position: 16, stage: 1, rule: { artId: 'maid' } };
const leaving = cameraActorFrame(service, [maid], base, () => false);
const seated = cameraActorFrame(service, [{ ...maid, stage: 0 }], base, () => false);
assert.equal(leaving.source, seated.source);
assert.equal(leaving.key, 'maid-saindo');
assert.equal(seated.key, 'maid');
const maidInput = { camera: service.id, gates: new Set(), visibleCameraSource: leaving.source };
assert.equal(cameraObservation(base, () => [maid], { ...maidInput, visibleCameraLayers: [] }), undefined);
assert.equal(cameraObservation(base, () => [maid], {
  ...maidInput, visibleCameraLayers: seated.layers.map(([source]) => source)
}), undefined);
assert.equal(cameraObservation(base, () => [maid], {
  ...maidInput, visibleCameraLayers: leaving.layers.map(([source]) => source)
}).cameraLoss, base.sanity.loss.camera);
for (const [key, position, camera, loss] of [
  ['yandere', 17, 'CAM10', .50], ['yandere', 4, 'CAM07', .50], ['yandere', 19, 'CAM12', .50],
  ['padrao', 17, 'CAM10', .40], ['gotica', 18, 'CAM11', .40], ['gotica', 3, 'CAM04', .40]
]) observation(position, { camera }, 100 - loss * 2, key);

for (const [position, camera, gates, loss] of [
  [17, 'CAM10', [], .50], [3, 'CAM04', ['G01'], .52]
]) {
  const test = scenario({ levels: { padrao: 1, gotica: 1, yandere: 1 }, input: { camera, gates }, tune(config) {
    for (const key of ['padrao', 'gotica', 'yandere']) config.characters[key].start = position;
  } });
  near(test.hud().sanityLossPerSecond, loss);
}

function stareScenario(level = 1) {
  return scenario({ levels: { yandere: level }, tune(config) {
    config.night.movementDelay = 40;
    config.characters.yandere.start = 17;
    config.characters.yandere.interval = 100;
  } });
}
const kitchen = { camera: 'CAM10' };
for (const [level, seconds] of [[6, 5.5], [11, 3]]) {
  const test = stareScenario(level);
  test.at(0, kitchen);
  test.at(seconds, kitchen);
  assert(!test.events.some(([event]) => event === 'cameraScareStart'));
  test.at(seconds + .001, kitchen);
  assert(test.events.some(([event]) => event === 'cameraScareStart'));
}
{
  const test = stareScenario();
  test.at(0, { ...kitchen, gates: ['G01'] }, { type: 'gate', id: 'G01' });
  test.at(8, kitchen);
  near(test.state().sanity, 95.04);
  assert.equal(test.events.filter(([event]) => event === 'cameraScareStart').length, 0);
  test.at(8.001, kitchen);
  near(test.state().sanity, 80.04 - .00012);
  assert.equal(test.state().computerOn, true);
  test.at(9.211, kitchen);
  assert.equal(test.state().computerOn, false);
  assert.equal(test.state().electricalFault, false);
  assert.equal(test.state().outcome, null);
  assert(test.game.isGateClosed('G01'));
  test.at(30, kitchen);
  assert.deepEqual(test.events.filter(([event]) => event.startsWith('cameraScare')).map(([event]) => event),
    ['cameraScareStart', 'cameraScareEnd']);
  test.at(30, {}, { type: 'computerPower' });
  test.at(36.5, kitchen);
  test.at(44.5, kitchen);
  assert.equal(test.events.filter(([event]) => event === 'cameraScareStart').length, 1);
  test.at(44.501, kitchen);
  assert.equal(test.events.filter(([event]) => event === 'cameraScareStart').length, 2);
}
for (const interruption of [
  { camera: 'CAM07' }, {}, { ...kitchen, visibleCameraSource: null },
  { ...kitchen, cameraObservationBlocked: true }
]) {
  const test = stareScenario();
  test.at(0, kitchen);
  test.at(7, interruption);
  test.at(25, kitchen);
  test.at(33, kitchen);
  assert(!test.events.some(([event]) => event === 'cameraScareStart'));
  test.at(33.001, kitchen);
  assert(test.events.some(([event]) => event === 'cameraScareStart'));
}
{
  const test = stareScenario();
  test.at(0, kitchen);
  test.at(20, kitchen);
  assert.equal(test.state().computerOn, true);
  assert(test.events.some(([event]) => event === 'cameraScareStart'));
  assert(!test.events.some(([event]) => event === 'cameraScareEnd'));
  test.at(21.21, kitchen);
  assert.equal(test.state().computerOn, false);
}
{
  const test = stareScenario();
  test.at(0, kitchen);
  test.game.interruptCameraObservation();
  test.at(20, { ...kitchen, cameraObservationBlocked: true });
  test.at(50, kitchen);
  assert(!test.events.some(([event]) => event === 'cameraScareStart'));
  test.game.reset({ yandere: 0 }, { camera: 'CAM03' });
  test.at(20, { camera: 'CAM03' });
  assert(!test.events.some(([event]) => event === 'cameraScareStart'));
}

const clown = scenario({ levels: { palhaca: 1 } });
clown.at(0, { view: 'closet-back', closet: true, clownLight: true }, { type: 'closetEnter' });
clown.at(2);
near(clown.state().sanity, 95.90);
near(clown.state().counter, 1 + 2 * .88 * 1.625);
for (const [hidden, radio, clownLight, rate] of [
  [false, true, false, -2], [true, false, false, .88 * 3.25], [true, false, true, .88 * 1.625],
  [true, true, false, -2], [true, true, true, .88 * 1.625 - 2]
]) {
  const test = scenario({ levels: { palhaca: 1 } });
  test.at(5, { radio, clownLight }, hidden ? { type: 'closetEnter' } : undefined);
  const initial = test.state().counter;
  test.at(6);
  near(test.state().counter, initial + rate);
}
const entries = scenario();
entries.at(0, {}, { type: 'closetEnter' });
entries.at(0, {}, { type: 'closetEnter' });
near(entries.state().sanity, 98);
entries.at(0, {}, { type: 'closetExit' });
entries.at(0, {}, { type: 'closetEnter' });
near(entries.state().sanity, 96);
const inactive = scenario({ input: { view: 'closet-back', closet: true, clownLight: true } });
const cameraRoster = () => CAMERAS.flatMap(cam => inactive.game.cameraActors(cam.id)
  .map(({ key, level, position, stage }) => [cam.id, key, level, position, stage]));
const startingRoster = [
  ['CAM03', 'padrao', 0, 1, 0],
  ['CAM03', 'gotica', 0, 1, 0],
  ['CAM03', 'yandere', 0, 1, 0],
  ['CAM04', 'gatinha', 0, 3, 0],
  ['CAM09', 'maid', 0, 16, 0]
];
assert.deepEqual(cameraRoster(), startingRoster);
inactive.at(2);
near(inactive.state().sanity, 98.80);
assert(inactive.at(5, { camera: 'CAM02' }, { type: 'cameraAudio' }));
inactive.at(100, {}, { type: 'closetEnter' });
inactive.at(1000);
assert.equal(inactive.state().clownStage, -1);
assert.equal(inactive.state().counter, 0);
assert.deepEqual(inactive.game.diagnostics(), []);
assert.deepEqual(cameraRoster(), startingRoster);
assert.deepEqual(inactive.events, [['win', undefined]]);
assert.equal(inactive.calls(), 0);

for (const [sanity, seconds] of [[100, 60], [90, 60], [70, 92], [50, 124], [30, 156], [15, 180]]) {
  near(hourDuration(base.night.clock, sanity), seconds);
  const test = scenario({ tune(config) {
    config.sanity.initial = sanity;
    config.sanity.recovery.passive = 0;
  } });
  test.at(seconds);
  near(test.state().hours, 1);
  test.at(6 * seconds - .001);
  assert.equal(test.state().outcome, null);
  test.at(6 * seconds + 1);
  near(test.state().now, 6 * seconds);
  assert.deepEqual(test.events, [['win', undefined]]);
  assert.equal(test.state().hours, 6);
}

const dynamic = scenario({ input: { closet: true }, tune: config => { config.sanity.initial = 70; } });
dynamic.at(10, { radio: true });
near(dynamic.state().hours, Math.log(101.6 / 92) / .96);
const first = dynamic.state().hours;
dynamic.at(20);
near(dynamic.state().hours - first, Math.log(101.6 / 99.36) / .224);

for (const target of [6, 7]) {
  const overtime = scenario({ input: { closet: true }, tune(config) {
    config.night.hoursToWin = target;
    config.night.secondsPerHour = 60;
    config.night.powerEnabled = false;
  } });
  overtime.at((target + 4) * 180, { radio: true });
  assert.equal(overtime.state().outcome, null);
  assert.equal(overtime.state().sanity, 0);
  assert(overtime.state().hours > target + 3);
  const recoveryAt = overtime.state().now + 15 / .14;
  overtime.at(recoveryAt - .001, { radio: true });
  assert.equal(overtime.state().outcome, null);
  overtime.at(recoveryAt + 1);
  near(overtime.state().now, recoveryAt);
  near(overtime.state().sanity, 15);
  assert.equal(overtime.state().outcome, 'win');
  assert(overtime.state().hours > target + 3);
}
const nineClock = scenario({ tune(config) { config.night.hoursToWin = 7; } });
nineClock.at(360);
assert.equal(nineClock.state().outcome, null);
nineClock.at(420);
assert.equal(nineClock.state().outcome, 'win');

{
  const { createHallucinations } = window.NathGame;
  const rules = base.sanity.hallucinations;
  for (const [sanity, chance] of [[74, 11], [60, 25], [40, 45], [20, 65], [0, 85]]) {
    for (const [draw, expected] of [[(chance - .01) / 100, 'blur'], [(chance + .01) / 100, null]]) {
      const effects = createHallucinations(rules, true, () => draw, () => {});
      effects.resolve(19.999, sanity, true);
      assert.equal(effects.visual(19.999), null);
      effects.resolve(20, sanity, true);
      assert.equal(effects.visual(21.249), expected);
      assert.equal(effects.visual(21.25), null);
    }
  }
  for (const [sanity, draw, laughs, apparition] of [
    [40, 0, 0, false], [30, 0, 1, false], [29, .3999, 1, true], [29, .40, 0, true], [29, .45, 0, false]
  ]) {
    let heard = 0;
    const effects = createHallucinations(rules, true, () => draw, () => heard++);
    effects.resolve(20, 75, true);
    assert.equal(effects.visual(20), null);
    effects.resolve(30, sanity, true);
    assert.equal(heard, laughs);
    assert.equal(effects.visual(31.499), apparition ? 'apparition' : null);
    assert.equal(effects.visual(31.5), null);
  }
  const events = [];
  const game = createMovement({ ...base, sanity: { ...base.sanity, initial: 20 } }, {
    hallucinationRandom: () => 0, emit: event => events.push(event)
  });
  game.advance(30, {}, undefined, { hallucinationsAudible: false });
  assert.equal(game.snapshot().hallucination, 'apparition');
  assert.deepEqual(events, []);
  game.advance(60, {});
  assert.equal(game.snapshot().hallucination, 'apparition'); // Coincides with the blur roll.
  assert.deepEqual(events, ['hallucinationLaugh']);
  assert.deepEqual(game.officeState().room, []);
  game.advance(61.5, {});
  assert.equal(game.snapshot().hallucination, null);
  game.reset();
  assert.equal(game.snapshot().hallucination, null);
  game.advance(19, {});
  assert.equal(game.snapshot().hallucination, null);
  for (const file of base.effects.stockAttackSound.files) assert(fs.existsSync('./public/' + file));
}
const testMovement = sanity => scenario({ levels: { padrao: 9, palhaca: 9 }, tune(config) { config.sanity.initial = sanity; } });
const fast = testMovement(100);
const slow = testMovement(10);
fast.at(14.4);
slow.at(14.4);
assert.deepEqual(fast.game.diagnostics(), slow.game.diagnostics());
near(fast.state().counter, slow.state().counter);
assert(fast.state().hours > slow.state().hours);
for (const key of [...Object.keys(base.characters), 'palhaca']) {
  const nine = scenario({ levels: { [key]: 9 } });
  const ten = scenario({ levels: { [key]: 10 } });
  if (key === 'palhaca') {
    nine.at(10); ten.at(10);
    assert(ten.state().counter > nine.state().counter);
  } else {
    assert(ten.game.diagnostics()[0].remaining > 0);
    assert(ten.game.diagnostics()[0].remaining < nine.game.diagnostics()[0].remaining);
  }
}

const powerInput = { radio: true, corridorLight: true, flashlight: true, gates: ['G01'] };
const power = scenario({ input: powerInput });
power.at(10, powerInput, { type: 'computerPower' });
near(power.state().energy, 100 - 10 * (.025 + .30 + .06 + .12));
power.at(20, {}, { type: 'gate', id: 'G01' });
power.at(20, {}, { type: 'gate', id: 'G06' });
power.at(20, {}, { type: 'gate', id: 'G01' });
near(power.state().energy, 90.15);
power.at(30, {}, { type: 'computerPower' });
near(power.state().energy, 84.15);
assert.equal(power.state().computerOn, true);
near(power.state().sanity, 98.4);

const outage = scenario({ input: { gates: ['G01'], closet: true, radio: true }, tune(config) {
  config.power.initial = .385 * 10;
} });
outage.at(10, { closet: true });
assert.equal(outage.state().blackout, true);
assert.equal(outage.state().computerOn, false);
near(outage.state().sanity, 93.8);
near(outage.hud().energyLossPerSecond, 0);
near(outage.hud().sanityLossPerSecond, 1.44);
outage.at(15, { closet: true, radio: true }, { type: 'computerPower' });
assert.equal(outage.state().computerOn, false);
near(outage.state().sanity, 86.6);
near(outage.hud().sanityLossPerSecond, 1.34);
near(outage.hud().noiseIntensity, 72);
outage.at(39.99, { closet: true, radio: true });
assert.equal(outage.state().radioAvailable, true);
outage.at(41, { closet: true, radio: true });
assert.equal(outage.state().radioAvailable, false);
near(outage.state().sanity, 51.66);
near(outage.hud().noiseIntensity, 0);
outage.at(69.99);
assert.equal(outage.state().flashlightAvailable, true);
outage.at(70.01);
assert.equal(outage.state().flashlightAvailable, false);
outage.game.reset();
assert.deepEqual([outage.state().energy, outage.state().sanity, outage.state().hours, outage.state().computerOn], [3.85, 100, 0, true]);

const hudGates = scenario({ input: { gates: ['G01', 'G06', 'G09'] } });
near(hudGates.hud().energyLossPerSecond, .925);
hudGates.at(0, { radio: true, flashlight: true });
near(hudGates.hud().energyLossPerSecond, 1.105);
hudGates.at(0, { radio: true }, { type: 'computerPower' });
hudGates.at(0, { radio: true }, { type: 'computerPower' });
near(hudGates.hud().noiseIntensity, 100);

const hudCamera = scenario({ levels: { padrao: 1, gotica: 1 }, input: stageFeed });
near(hudCamera.hud().sanityLossPerSecond, .20);
hudCamera.at(0, { ...stageFeed, radio: true });
near(hudCamera.hud().sanityLossPerSecond, .10);

for (const nightNumber of [1, 2]) {
  const test = scenario({ nightNumber });
  near(test.hud().noiseIntensity, 0);
  test.at(0, { viewMoving: true });
  near(test.hud().noiseIntensity, 3);
  test.at(0, { computer: true });
  near(test.hud().noiseIntensity, 9);
  test.at(0, { radio: true });
  near(test.hud().noiseIntensity, 72);
  near(test.hud().energyLossPerSecond, 0);
  near(test.hud().sanityLossPerSecond, 0);
  test.at(1);
  near(test.hud().noiseIntensity, 0);
}

const hudPeaks = scenario();
assert.deepEqual(hudPeaks.game.diagnostics(), []);
hudPeaks.at(0, {}, { type: 'computerPower' });
hudPeaks.at(0, {}, { type: 'computerPower' });
near(hudPeaks.hud().noiseIntensity, 84);
hudPeaks.at(.22);
near(hudPeaks.hud().noiseIntensity, 84 / Math.E);
hudPeaks.at(5, {}, { type: 'closetEnter' });
near(hudPeaks.hud().noiseIntensity, 35, 1e-6);
hudPeaks.at(10, {}, { type: 'closetExit' });
near(hudPeaks.hud().noiseIntensity, 35, 1e-6);
hudPeaks.at(15, { flashlight: true });
near(hudPeaks.hud().noiseIntensity, 56, 1e-6);
hudPeaks.game.reset();
near(hudPeaks.hud().noiseIntensity, 0);
near(hudPeaks.hud().energyLossPerSecond, .025);

const flashlightInput = { flashlight: true, clownLight: true, view: 'closet-back', closet: true };
const flashlight = scenario({ levels: { palhaca: 1 }, tune(config) { config.power.initial = .145; } });
flashlight.at(0, flashlightInput, { type: 'closetEnter' });
flashlight.at(60.99, flashlightInput);
assert.equal(flashlight.state().energy, 0);
near(flashlight.state().counter, 1 + 60.99 * .88 * 1.625);
flashlight.at(62, flashlightInput);
near(flashlight.state().counter, 1 + 61 * .88 * 1.625 + .88 * 3.25);

const shadowTest = (level, sanity, draws = [0, .99], tune = () => {}) => scenario({
  levels: { shadow: level }, draws, tune(config) { config.sanity.initial = sanity; tune(config); }
});
assert.equal(shadowDifficulty(base.shadow, 0, 10), null);
const disabledShadow = shadowTest(0, 0);
disabledShadow.returnAt(0);
assert.equal(disabledShadow.state().shadow.phase, 'inactive');
assert.equal(disabledShadow.calls(), 0);
for (let level = 1; level <= 10; level++) {
  const { sanityLimit, chance, searchSeconds } = shadowDifficulty(base.shadow, level, 10);
  const fraction = (level - 1) / 9;
  near(sanityLimit, 40 + 20 * fraction, 1e-12);
  near(chance, 10 + 5 * fraction);
  near(searchSeconds, 10 - 2.5 * fraction);
  const below = shadowTest(level, sanityLimit - 1e-6);
  below.returnAt(0);
  assert.equal(below.state().shadow.phase, 'manifested');
  const atLimit = shadowTest(level, sanityLimit);
  atLimit.returnAt(0);
  assert.equal(atLimit.state().shadow.phase, 'inactive');
  assert.equal(atLimit.calls(), 0);
}
for (const [sanity, draw, expected] of [[39, .109, 'manifested'], [39, .111, 'inactive'], [20, .299, 'manifested'], [20, .301, 'inactive']]) {
  const test = shadowTest(1, sanity, [draw, 0]);
  test.at(0);
  assert.equal(test.state().shadow.phase, 'inactive');
  test.returnAt(0, 'closet');
  assert.equal(test.state().shadow.phase, expected);
  assert.equal(test.calls(), expected === 'manifested' ? 2 : 1);
}
for (const [level, sanity, duration] of [[1, 34, 10], [10, 49, 7.5]]) {
  const test = shadowTest(level, sanity);
  test.returnAt(0);
  assert.deepEqual(test.state().shadow, { phase: 'manifested', camera: 'CAM12' });
  test.returnAt(.5, 'closet');
  assert.equal(test.calls(), 2);
  test.at(2, { camera: 'CAM01' });
  assert.deepEqual(test.state().shadow, { phase: 'searching', camera: 'CAM12' });
  test.at(duration - .001);
  assert.equal(test.state().outcome, null);
  test.at(duration, { camera: 'CAM12' });
  assert.deepEqual(test.events, [['loss', 'shadow']]);
  assert.equal(test.state().shadow.phase, 'inactive');
}
const found = shadowTest(1, 20);
found.returnAt(0);
found.at(1, {}, { type: 'computerPower' });
assert.equal(found.state().shadow.phase, 'manifested');
found.returnAt(2);
assert.equal(found.calls(), 2);
found.at(3, { camera: 'CAM12' }, { type: 'computerPower' });
assert.equal(found.state().shadow.phase, 'found');
found.at(3.65, { camera: 'CAM12' });
assert.equal(found.state().shadow.phase, 'inactive');
const computerOff = shadowTest(1, 20);
computerOff.returnAt(0);
computerOff.at(1, {}, { type: 'computerPower' });
computerOff.at(9.999, { camera: 'CAM12' });
assert.equal(computerOff.state().shadow.phase, 'searching');
computerOff.at(10, { camera: 'CAM12' });
assert.equal(computerOff.state().outcome, 'loss');
found.returnAt(4);
assert.equal(found.calls(), 2);
found.returnAt(5, 'closet');
assert.equal(found.state().shadow.phase, 'manifested');
found.game.reset({ shadow: 1 });
assert.equal(found.state().shadow.phase, 'inactive');
const interrupted = shadowTest(10, 20, [0, .25], config => { config.power.initial = .025 * 3; });
interrupted.returnAt(0);
interrupted.at(10);
assert.equal(interrupted.state().blackout, true);
assert.equal(interrupted.state().shadow.phase, 'inactive');
assert.deepEqual(interrupted.events, []);
interrupted.returnAt(11);
assert.equal(interrupted.calls(), 2);
for (const asset of [base.shadow.officeArt, base.shadow.sprite, base.shadow.jumpscare]) assert(fs.existsSync(asset));

console.log('PASS: sanity and visibility, dynamic clock, zero and maximum levels, power and radio, Shadow deadlines and reset.');

const ventLook = { radio: true, smoresLooking: true };
const pc = { radio: true, computer: true };
const smoresPhase = test => test.game.officeState().smores;
for (const radio of [true, false]) {
  const test = scenario({ levels: { smores: 1 }, input: pc });
  test.at(15, pc);
  test.at(15, { radio, view: 'cameras', camera: 'CAM01' });
  test.at(29.999, { radio, view: 'cameras', camera: 'CAM04' });
  assert.equal(test.game.debugSnapshot().smores.finalApproach, false);
  test.at(30, { radio, view: 'office' });
  assert.equal(test.game.debugSnapshot().smores.finalApproach, true);
  near(test.game.debugSnapshot().smores.ignoredRemaining, 10);
  test.at(39.999, { radio, view: 'office' });
  assert.equal(smoresPhase(test), 'vent');
  test.at(40, { radio, view: 'office' });
  assert.equal(smoresPhase(test), 'room');
  assert(test.game.officeState().invasionActive);
  assert(test.game.officeState().flash);
  assert(!test.game.officeState().smoresVisible);
  test.at(40.12, { radio, view: 'office' });
  assert(test.game.officeState().smoresVisible);
}
const vent = scenario({ levels: { smores: 1 }, input: ventLook, draws: [.15, .1499] });
vent.at(15, ventLook);
assert.equal(smoresPhase(vent), 'idle');
vent.at(30, ventLook);
assert.equal(smoresPhase(vent), 'pre-vent');
vent.at(31, { radio: true, closet: true }, { type: 'closetEnter' });
assert.equal(smoresPhase(vent), 'pre-vent');
vent.at(32, { radio: true, closet: true }, { type: 'closetExit' });
assert.equal(smoresPhase(vent), 'vent');
vent.at(33, {});
assert.equal(smoresPhase(vent), 'vent');
vent.at(34, { smoresLooking: true });
vent.at(42.99, {});
assert.equal(smoresPhase(vent), 'vent');
vent.at(43, { smoresLooking: true });
vent.at(44, {});
assert.equal(smoresPhase(vent), 'idle');
assert.deepEqual(vent.events, [['smores', 'pre-vent'], ['smores', 'vent'], ['smores', 'idle']]);

const interruptedRadio = scenario({ levels: { smores: 1 }, input: ventLook });
interruptedRadio.at(14, {});
interruptedRadio.at(15, ventLook);
interruptedRadio.at(29.99, ventLook);
assert.equal(smoresPhase(interruptedRadio), 'idle');
interruptedRadio.at(30, { radio: true, leftLook: true });
assert.equal(smoresPhase(interruptedRadio), 'vent');

for (const [level, ticket, duration] of [[1, .1499, 35], [11, .1999, 50]]) {
  const test = scenario({ levels: { smores: level }, input: pc, draws: [ticket] });
  test.at(15, pc);
  test.at(16, pc);
  assert.equal(smoresPhase(test), 'vent');
  test.at(17, ventLook);
  test.at(18, pc);
  assert.equal(smoresPhase(test), 'room');
  test.at(23, {});
  const end = 23 + (duration - 5) / 2;
  test.at(end - .01);
  assert.equal(smoresPhase(test), 'room');
  test.at(end);
  assert.equal(smoresPhase(test), 'idle');
  test.game.reset({ smores: 0 }, pc);
  test.at(30, pc);
  assert.equal(smoresPhase(test), 'idle');
}

for (const [level, reduction] of [[1, 1], [6, 1.5], [10, 1.9], [11, 2]]) {
  const smores = window.NathGame.createSmores(base.threats.smores, level, base.night.levels[1], () => 0, () => {});
  smores.integrate(15, true);
  smores.resolve(pc, true, true);
  smores.resolve(ventLook, true, false);
  smores.resolve(pc, true, false);
  near(smores.intervalReduction(), reduction);
  assert.equal(smores.targetBonusMultiplier(), base.threats.smores.targetBonusMultiplier);
}

const boosted = scenario({
  levels: { smores: 1, padrao: 1 }, input: pc,
  tune(config) {
    config.characters.padrao.start = 5;
    config.characters.padrao.routes = { EL: 100 };
    config.characters.padrao.interval = 25 / 3;
    config.movement.jitter = { min: 0, max: 0 };
  }
});
boosted.at(15, pc);
boosted.at(16, ventLook);
boosted.at(17, pc);
near(boosted.game.diagnostics()[0].remaining, 7);
boosted.at(31.32, pc);
assert.deepEqual(boosted.game.officeState().room, []);
boosted.at(31.34, pc);
assert.deepEqual(boosted.game.officeState().room, ['original']);
boosted.at(34.03, pc);
assert.equal(boosted.state().outcome, null);
boosted.at(34.04, pc);
assert.equal(boosted.state().outcome, 'loss');
console.log('PASS: Smores radio rolls, vent timing, silence, room duration and movement/reaction reductions.');

function tuneElectrical(config) {
  Object.assign(config.characters.yandere, {
    start: 19, positions: [19, 21], interval: 5, routes: { EE: 24 }
  });
  config.movement.jitter = { min: 0, max: 0 };
}

const disabled = scenario({ levels: { yandere: 0 }, tune: tuneElectrical });
disabled.at(120);
assert.equal(disabled.game.diagnostics().length, 0);
assert.equal(disabled.state().electricalFault, false);

for (const level of [1, 4]) {
  const run = scenario({ levels: { yandere: level }, tune: tuneElectrical, input: { gates: ['G01', 'G09'] } });
  const first = run.game.diagnostics()[0].remaining;
  run.at(0, { camera: 'CAM12' });
  run.at(first, { camera: 'CAM12' });
  assert.equal(run.state().electricalFault, false); // Leaving the watched camera does not produce static.
  const arrival = first + .5;
  run.at(arrival, { camera: 'CAM12' });
  const beforeFault = run.state();
  run.at(arrival, { radio: true });
  near(run.state().energy, beforeFault.energy - 10);
  near(run.state().sanity, beforeFault.sanity - 5);
  assert.deepEqual(run.events.map(([type]) => type), ['electricalFault', 'move']);
  assert.equal(run.game.diagnostics()[0].position, 21);
  assert.equal(run.state().computerOn, true);
  assert.equal(run.state().radioAvailable, true);
  assert.equal(run.game.camerasAvailable(), false);
  assert(!run.at(arrival, { camera: 'CAM01', radio: true }, { type: 'cameraAudio' }));
  near(run.state().energy, beforeFault.energy - 10);
  near(run.state().sanity, beforeFault.sanity - 5);
  assert(run.game.isGateClosed('G01') && run.game.isGateClosed('G09'));
  for (const { id, type } of window.NathGame.VENUE.openings) {
    if (type === 'portao') assert(!run.at(arrival, { camera: 'CAM01', radio: true }, { type: 'gate', id }));
  }
  assert(run.game.isGateClosed('G01') && run.game.isGateClosed('G09'));
  assert(!run.game.isGateClosed('G06'));
  run.at(arrival + .5, {}, { type: 'computerPower' });
  assert.equal(run.state().computerOn, false);
  assert.equal(run.state().electricalFault, true);
  run.at(arrival + 1, {}, { type: 'computerPower' });
  assert.equal(run.game.camerasAvailable(), true);
  assert.equal(run.state().electricalFault, false);
  assert.equal(run.game.diagnostics()[0].position, 21);
  assert(run.at(arrival + 1, { camera: 'CAM01' }, { type: 'cameraAudio' }));
  assert.equal(run.events.filter(([type]) => type === 'electricalFault').length, 1);
  const next = run.game.diagnostics()[0].remaining;
  run.at(arrival + 1 + next + .001, { camera: 'CAM12' });
  assert.equal(run.game.diagnostics()[0].position, 19);
  // Release the next unplanned move from observation. Electrical is still the last route.
  run.at(arrival + 1 + next * 2 + 2, { radio: true });
  assert.equal(run.state().electricalFault, false);
  assert.equal(run.game.diagnostics()[0].lastRoute, 'EE');
  assert.equal(run.events.filter(([type]) => type === 'electricalFault').length, 1);
}

const offBeforeFault = scenario({ levels: { yandere: 1 }, tune: tuneElectrical });
offBeforeFault.at(0, {}, { type: 'computerPower' });
offBeforeFault.at(5);
assert.equal(offBeforeFault.state().electricalFault, true);
assert.equal(offBeforeFault.game.diagnostics()[0].position, 21);
offBeforeFault.at(6, {}, { type: 'computerPower' });
assert.equal(offBeforeFault.state().electricalFault, true);
offBeforeFault.at(6, {}, { type: 'computerPower' });
offBeforeFault.at(6, {}, { type: 'computerPower' });
assert.equal(offBeforeFault.state().electricalFault, false);

const faultDuringBlackout = scenario({ levels: { yandere: 1 }, tune(config) {
  tuneElectrical(config);
  config.power.initial = .12;
} });
faultDuringBlackout.at(8);
assert.equal(faultDuringBlackout.state().blackout, true);
faultDuringBlackout.at(8, {}, { type: 'computerPower' });
assert.equal(faultDuringBlackout.state().electricalFault, true);
assert.equal(faultDuringBlackout.state().computerOn, false);

const faultCausesBlackout = scenario({ levels: { yandere: 1 }, tune(config) {
  tuneElectrical(config);
  config.power.initial = 5;
  config.sanity.initial = 3;
} });
const sabotageAt = faultCausesBlackout.game.diagnostics()[0].remaining;
faultCausesBlackout.at(sabotageAt);
assert.equal(faultCausesBlackout.state().energy, 0);
assert.equal(faultCausesBlackout.state().sanity, 0);
assert.equal(faultCausesBlackout.state().computerOn, false);
faultCausesBlackout.at(sabotageAt + 30 - .01);
assert.equal(faultCausesBlackout.state().radioAvailable, true);
faultCausesBlackout.at(sabotageAt + 30);
assert.equal(faultCausesBlackout.state().radioAvailable, false);
faultCausesBlackout.at(sabotageAt + 60 - .01);
assert.equal(faultCausesBlackout.state().flashlightAvailable, true);
faultCausesBlackout.at(sabotageAt + 60);
assert.equal(faultCausesBlackout.state().flashlightAvailable, false);

for (const find of [true, false]) {
  const run = scenario({
    levels: { shadow: 1, yandere: 1 },
    draws: [0, 0, .99, 0, .5, .5, ...Array(100).fill(.99)],
    tune(config) { tuneElectrical(config); config.sanity.initial = 20; }
  });
  run.returnAt(0);
  assert.deepEqual(run.state().shadow, { phase: 'manifested', camera: 'CAM12' });
  run.at(8, { camera: 'CAM12', radio: true });
  assert.equal(run.state().electricalFault, true);
  assert.equal(run.state().shadow.phase, 'searching');
  assert.equal(run.state().outcome, null);
  run.at(8, {}, { type: 'computerPower' });
  run.at(9, {}, { type: 'computerPower' });
  const deadline = base.shadow.firstLevel.searchSeconds;
  run.at(deadline - .01, find ? { camera: 'CAM12' } : {});
  assert.equal(run.state().outcome, null);
  if (find) assert.equal(run.state().shadow.phase, 'found');
  run.at(deadline + .01);
  assert.equal(run.state().outcome, find ? null : 'loss');
}
console.log('PASS: electrical route, gate and camera controls, manual power cycle, no immediate repeat, blackout and uninterrupted Shadow search.');
