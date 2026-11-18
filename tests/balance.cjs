const assert = require('node:assert/strict');
const { test } = require('node:test');
const { existsSync } = require('node:fs');

global.window = {};
for (const file of ['data/game-data', 'data/camera-layers', 'data/complex-layers', 'gameplay/routes',
  'gameplay/effects', 'gameplay/threats', 'gameplay/gates', 'gameplay/electrical', 'gameplay/resources',
  'gameplay/shadow', 'scene-art', 'movement']) require('../src/' + file + '.js');

const { createMovement, createThreats, createAttackRoutes, createRoutes, createEffects, cameraActorFrame, CAMERAS } = window.NathGame;
const base = Object.fromEntries(['night', 'map', 'movement', 'characters', 'effects', 'threats',
  'controls', 'sanity', 'power', 'shadow'].map(name => [name, require('../config/' + name + '.json')]));
const near = (actual, expected) => assert(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

function scenario(levels, input = {}, tune = () => {}, draws = []) {
  const config = structuredClone(base);
  config.movement.jitter = { min: 0, max: 0 };
  config.threats.attack.jitter = { min: 0, max: 0 };
  tune(config);
  const events = [];
  let calls = 0;
  const game = createMovement(config, { emit: (...args) => events.push(args),
    random: () => { calls++; return draws.shift() ?? 0; } });
  game.reset(levels, input);
  return { game, events, calls: () => calls,
    at: (time, next = input, action) => game.advance(time, next, action),
    actor: key => game.diagnostics().find(actor => actor.key === key),
    debug: key => game.debugSnapshot().actors.find(actor => actor.key === key),
    emitted: name => events.filter(([event]) => event === name).map(([, value]) => value) };
}

test('route bonuses interpolate independently and interval reductions accumulate at MAX', () => {
  const { actor } = scenario({ padrao: 11, gotica: 11, yandere: 11, gatinha: 11, maid: 11 });
  near(actor('padrao').remaining, 23 * .45);
  near(actor('gotica').remaining, 26 * .45);
  near(actor('yandere').remaining, 21 * .45 * .4);
  near(actor('gatinha').remaining, 19 * .45 * .95);
  near(actor('maid').remaining, 30 * .45 * .9);
  const routes = createAttackRoutes(base, createRoutes(base.map));
  for (const [key, low, mid, high] of [
    ['padrao', 40, 50, 60], ['gotica', 30, 39, 48], ['yandere', 30, 39, 48], ['gatinha', 30, 39, 48]
  ]) {
    near(routes.bonus(1, 0, key), low);
    near(routes.bonus(6, 0, key), mid);
    near(routes.bonus(11, 0, key), high);
    near(routes.bonus(11, 2, key), high + 2 * (key === 'padrao' ? 8 : 6));
  }
  const hunt = scenario({ padrao: 1, gotica: 1, maid: 1 }, {}, config => {
    Object.assign(config.characters.padrao, { start: 7, interval: 1, routes: { CV: 100 } });
  });
  near(hunt.debug('padrao').bonus, 40 + 40);
  hunt.at(1);
  near(hunt.debug('padrao').bonus, 40 + 5 - 20);
  near(hunt.debug('gotica').bonus, 30 + 40);
  near(hunt.debug('maid').bonus, 10);
});

function corridor(config) {
  Object.assign(config.characters.gotica, { start: 7, interval: 1, routes: { CV: 100 } });
  config.movement.recovery.freeMoves = 0;
  config.movement.retreat.office = [7];
}

test('third invasion kills immediately, including when hiding would trigger the clown', () => {
  for (const hidden of [true, false]) {
    const threats = createThreats(base, { palhaca: 1 }, () => 0, () => {});
    const actor = { key: 'gotica', reaction: 4 };
    for (const arrival of [0, 12]) {
      assert.equal(threats.invade(actor, arrival), undefined);
      threats.enterCloset(arrival + 1);
      threats.resolve(arrival + 9, () => {}, assert.fail);
      threats.exitCloset();
    }
    assert.equal(threats.invasionCount(actor), 2);
    assert.equal(threats.instantInvasion(actor), true);
    if (hidden) threats.enterCloset(23);
    assert.equal(threats.entryAttacker(actor, true), 'gotica');
    assert.equal(threats.invade(actor, 24, 24, true), 'gotica');
    assert.equal(threats.invasionCount(actor), 3);
  }
});

test('Padrão reaction decreases to 5%, and other invaders keep independent counts', () => {
  let smoresReduction = 0;
  const threats = createThreats(base, { palhaca: 0 }, () => 0, () => {}, () => smoresReduction);
  const padrao = { key: 'padrao', reaction: 2.4 };
  for (let previous = 0; previous < 20; previous++) {
    const time = previous * 10;
    const multiplier = previous === 0 ? 1 : Math.max(.05, .75 - (previous - 1) * .05);
    assert.equal(threats.invade(padrao, time), undefined);
    near(threats.invasionStatus(padrao, time).reaction, padrao.reaction * multiplier);
    threats.enterCloset(time);
    threats.resolve(time + 8.5, () => {}, assert.fail);
    threats.exitCloset();
  }
  smoresReduction = .4;
  near(threats.reactionTime(padrao), .12);
  near(threats.reactionTime({ key: 'maid', reaction: 2 }), 1.6);
  assert.equal(threats.instantInvasion(padrao), false);
  for (const key of ['maid', 'yandere', 'gatinha']) {
    const actor = { key, reaction: 4 };
    for (const time of [200, 210]) {
      assert.equal(threats.invade(actor, time), undefined);
      threats.enterCloset(time);
      threats.resolve(time + 8.5, () => {}, assert.fail);
      threats.exitCloset();
    }
    assert.equal(threats.invade(actor, 220), key);
  }
});

test('hiding before an empty-office entry triggers the clown, even when clown difficulty is zero', () => {
  const threats = createThreats(base, { palhaca: 0 }, () => 0, () => {});
  const actor = { key: 'gotica', reaction: 4 };
  threats.enterCloset(0);
  assert.equal(threats.invade(actor, 2, 2, true), 'palhaca');

  const safe = createThreats(base, { palhaca: 0 }, () => 0, () => {});
  safe.invade({ key: 'padrao', reaction: 3 }, 0);
  safe.enterCloset(1);
  assert.equal(safe.invade(actor, 2, 2, false), undefined);
  assert.equal(safe.invasionStatus(actor, 2).retreat, true);
});

test('the radio offsets clown growth in every closet lighting state', () => {
  for (const hidden of [false, true]) {
    for (const radio of [false, true]) {
      for (const clownLight of [false, true]) {
        const input = { radio, clownLight };
        const run = scenario({ palhaca: 1 }, input, config => { config.threats.clown.initial = 20; });
        if (hidden) run.at(0, input, { type: 'closetEnter' });
        run.at(1);
        const growth = base.threats.clown.growth[0];
        const normal = growth * Number(!radio) - (radio ? 2 : 0);
        const hiddenRate = growth * (clownLight ? 1.625 : 3.25) - (radio ? 2 : 0);
        near(run.game.snapshot().counter, hidden ? 20 + normal * .35 + hiddenRate * .65 : 20 + normal);
      }
    }
  }
});

test('Parts & Service retries in both directions and displays only the current occupant pose', () => {
  const camera = CAMERAS.find(({ id }) => id === 'CAM09');
  const frame = game => cameraActorFrame(camera, game.cameraActors(camera.id), base, game.isGateClosed);
  assert.equal(base.map.capacities[16], 1);
  for (const side of [15, 17]) {
    const run = scenario({ yandere: 1, maid: 1 }, {}, config => {
      Object.assign(config.characters.yandere, { start: side, positions: [side, 16], interval: 18,
        routes: undefined, firstIntervalReduction: [0, 0] });
      Object.assign(config.characters.maid, { positions: [16, 17], interval: 10 });
    });
    assert.equal(frame(run.game).key, 'maid');
    run.at(18);
    assert.equal(frame(run.game).key, 'maid-saindo');
    assert.match(run.actor('yandere').stopped, /posição lotada/);
    run.at(20);
    assert.equal(run.actor('maid').position, 17);
    assert.equal(run.actor('yandere').position, 16);
    assert.equal(frame(run.game).key, 'yandere');
    assert.equal(frame(run.game).layers.length, 1);
    run.at(30);
    assert.match(run.actor('maid').stopped, /posição lotada/);
    run.at(38.5);
    assert.equal(run.actor('yandere').position, side);
    assert.equal(run.actor('maid').position, 16);
    assert.equal(frame(run.game).key, 'maid-retorno');
    assert.equal(frame(run.game).layers.length, 1);
  }
  const maid = scenario({ maid: 1 }, {}, config => {
    Object.assign(config.characters.maid, { positions: [15, 16], interval: 1 });
  });
  maid.at(2);
  assert.equal(maid.actor('maid').position, 15);
  // A high navigation draw chooses the service detour from the rear corridor.
  const detour = scenario({ maid: 1 }, {}, config => {
    Object.assign(config.characters.maid, { positions: [15, 16], interval: 1 });
  }, [0, 0, 0, 0, .8]);
  detour.at(3);
  assert.equal(frame(detour.game).key, 'maid-retorno');

  const blocked = scenario({ yandere: 1, maid: 1 }, {}, config => {
    Object.assign(config.characters.yandere, { start: 15, positions: [15, 16, 17], interval: 1,
      routes: { EE: 100 }, firstIntervalReduction: [0, 0] });
    config.movement.routes.definitions.EE.target = 17;
    config.characters.maid.interval = 100;
  }, [0, 0, 0, .6]);
  blocked.at(1);
  assert.match(blocked.actor('yandere').stopped, /posição lotada/);
  assert.deepEqual(blocked.emitted('corridorAttack'), []);
  blocked.at(6);
  assert.equal(blocked.actor('yandere').position, 15);
  assert.deepEqual(blocked.emitted('corridorAttack'), ['yandere']);
});

test('passing routes convert a stay or a blocked exit into one local attack', () => {
  for (const [position, objective, route, blockedGate] of [[10, 'stock', 'CV', 'G09'], [15, 'corridor', 'EV', 'G04']]) {
    for (const stay of [true, false]) {
      const start = { gates: stay ? [] : [blockedGate] };
      const nexts = position === 10 ? [9, 10, 12, 13, 15, 6] : [6, 10, 12, 13, 14, 15];
      const run = scenario({ gotica: 1 }, start, config => {
        Object.assign(config.characters.gotica, { start: position, positions: nexts, interval: 1, routes: { [route]: 100 } });
      }, [0, 0, stay ? .99 : position === 10 ? .65 : .1]);
      run.at(1);
      assert.equal(run.actor('gotica').position, position);
      assert.equal(run.actor('gotica').objective, objective);
      assert.equal(run.actor('gotica').route, null);
      assert.deepEqual(run.emitted(objective + 'Attack'), ['gotica']);
      run.at(1.5);
      assert.deepEqual(run.emitted(objective + 'Attack'), ['gotica']);
    }
  }
});

test('Smores samples each continuous radio interruption once and preserves short gaps', () => {
  const radio = { radio: true, computer: true, computerInterface: true };
  const shortGap = scenario({ smores: 1 }, radio, () => {}, [.75, 0]);
  shortGap.at(10, {});
  shortGap.at(13);
  shortGap.at(20.999);
  assert.equal(shortGap.game.officeState().smores, 'idle');
  shortGap.at(21);
  assert.equal(shortGap.game.officeState().smores, 'vent');
  assert.equal(shortGap.calls(), 2);

  const run = scenario({ smores: 1 }, radio, () => {}, [.75, 0, 0]);
  run.at(10, {});
  run.at(12, {});
  assert.equal(run.calls(), 1);
  run.at(13);
  run.at(14, {});
  assert.equal(run.calls(), 2);
  run.at(16);
  run.at(33.999);
  assert.equal(run.game.officeState().smores, 'idle');
  run.at(34);
  assert.equal(run.game.officeState().smores, 'vent');
  assert.equal(run.calls(), 3);
});

test('campaign delay and control limits still apply while Custom Night accepts map closures', () => {
  const run = scenario({ gotica: 1 });
  const { levels, ...rules } = base.night.campaign[0];
  run.game.reset(levels, {}, { ...base.night, ...rules });
  run.at(39);
  assert.equal(run.actor('gotica').position, 1);
  assert.equal(run.at(39, {}, { type: 'gate', id: 'G09', source: 'cameras' }), false);
  assert.deepEqual(run.emitted('gatesChanged'), []);
  run.game.reset({ gotica: 1 });
  assert.equal(run.at(0, {}, { type: 'gate', id: 'G09', source: 'cameras' }), true);
  assert.equal(run.at(0, {}, { type: 'gate', id: 'G09', source: 'office' }), true);
  assert.deepEqual(run.emitted('gatesChanged'), [[{ id: 'G09', closed: true }], [{ id: 'G09', closed: false }]]);
});

test('Smores rolls on room deadlines, stops on room exit and stops when the shift ends', () => {
  const radio = { radio: true, computer: true, computerInterface: true };
  const run = scenario({ smores: 1 }, radio, () => {}, [0, .649, .65, 0]);
  run.at(18);
  run.at(18.5, { ...radio, smoresLooking: true });
  run.at(19);
  assert.equal(run.game.officeState().smores, 'room');
  run.at(23.499);
  assert.equal(run.emitted('smoresRoomSound').length, 0);
  run.at(28);
  assert.equal(run.calls(), 3);
  assert.equal(run.emitted('smoresRoomSound').length, 1);
  run.at(32.5, {});
  assert.equal(run.emitted('smoresRoomSound').length, 2);
  run.at(60, {});
  assert.equal(run.game.officeState().smores, 'idle');
  const calls = run.calls();
  run.at(99, {});
  assert.equal(run.calls(), calls);
  assert(existsSync('./public/' + base.effects.smoresRoomSound.file));

  const stopped = scenario({ smores: 1 }, radio);
  stopped.at(18);
  stopped.at(18.5, { ...radio, smoresLooking: true });
  stopped.at(19);
  stopped.game.stop();
  stopped.at(30);
  assert.equal(stopped.emitted('smoresRoomSound').length, 0);
});

test('Shadow rolls once per real computer return, including while powered off', () => {
  const camera = { view: 'cameras', camera: 'CAM01', computer: true, computerInterface: true };
  const office = { view: 'office' };
  const run = scenario({ shadow: 1 }, camera, config => { config.sanity.initial = 20; }, [.99, 0, .99]);
  run.at(0, office);
  assert.equal(run.calls(), 1);
  run.at(0, office, { type: 'returnToOffice', source: 'computer' });
  assert.equal(run.calls(), 1);
  run.at(0, { computerInterface: true }, { type: 'computerPower' });
  assert.equal(run.game.snapshot().computerOn, false);
  run.at(0, office);
  assert.equal(run.game.snapshot().shadow.phase, 'manifested');
  assert.equal(run.calls(), 3);
  run.at(0, office, { type: 'computerPower' });
  assert.equal(run.game.snapshot().computerOn, false);
  run.at(0, { ...camera, camera: 'CAM12' }, { type: 'computerPower' });
  assert.equal(run.game.snapshot().shadow.phase, 'found');
  run.at(0, office);
  assert.equal(run.game.snapshot().shadow.phase, 'inactive');
  assert.equal(run.calls(), 3);
});

test('Palhaça uses the adjusted growth, wardrobe floor and warning limits', () => {
  assert.deepEqual(base.threats.clown.growth, [.8, 1.56]);
  assert.equal(base.threats.clown.floorPerEntry, 8);
  assert.equal(base.threats.clown.warningAt, 79);
  assert.equal(base.threats.clown.entryDeathAbove, 82);
  const run = scenario({ palhaca: 1 }, {}, config => { config.threats.clown.initial = 78; });
  run.at(1.25);
  assert.equal(run.emitted('clownWarning').length, 1);
});

test('camera audio modestly changes corridor retreat and same-camera stay odds', () => {
  assert.equal(base.effects.cameraAudio.cooldown, 9);
  assert.equal(base.effects.cameraAudio.factors[2], .25);
  const graph = createRoutes(base.map);
  const yandere = { key: 'yandere', rule: base.characters.yandere,
    allowed: new Set(base.characters.yandere.positions), position: 14, noise: 0, light: 0 };
  const effect = createEffects(base, graph, [yandere]);
  assert(effect.startAudio(0, 'CAM05'));
  const active = effect.attackOdds(yandere, 'corridor', 'entry', false, 1);
  const expired = effect.attackOdds(yandere, 'corridor', 'entry', false, 3.01);
  assert(active.advance < expired.advance);
  assert(active.abandon > expired.abandon);
  assert(effect.weight(yandere, 6, 1) > effect.weight(yandere, 7, 1));
  assert.equal(effect.audioStimulus(yandere, 3.01), null);
  yandere.position = 6;
  assert.equal(effect.startAudio(8.99, 'CAM05'), false);
  assert(effect.startAudio(9, 'CAM05'));
  near(effect.stayWeight(yandere, 9), 1.75);
  assert(effect.attackOdds(yandere, 'corridor', 'entry', false, 9).stay
    > effect.attackOdds(yandere, 'corridor', 'entry', false, 12.01).stay);

  const padrao = { key: 'padrao', rule: base.characters.padrao,
    allowed: new Set(base.characters.padrao.positions), position: 10, noise: 0, light: 0 };
  const repulsion = createEffects(base, graph, [padrao]);
  assert(repulsion.startAudio(0, 'CAM08'));
  const stock = repulsion.attackOdds(padrao, 'stock', 'approach', false, 1);
  assert(stock.advance < .25);
  assert(stock.stay < (1 - stock.advance) * .3);
  near(repulsion.stayWeight(padrao, 1), .5);
});

test('Yandere surprise requires ongoing sanity below 75', () => {
  assert.equal(base.threats.yandereSurprise.sanityThreshold, 75);
  const tune = config => {
    config.characters.yandere.interval = 1000;
    config.sanity.initial = 76;
  };
  const run = scenario({ yandere: 6 }, { view: 'closet', closet: true }, tune);
  run.at(40);
  assert.equal(run.emitted('yandereSabotage').length, 0);
  run.at(55);
  assert.equal(run.emitted('yandereSabotage').length, 1);

  const recovered = scenario({ yandere: 6 }, { view: 'office', radio: true }, config => {
    config.characters.yandere.interval = 1000;
    config.sanity.initial = 74;
  });
  recovered.at(100);
  assert.equal(recovered.emitted('yandereSabotage').length, 0);
  assert(recovered.game.snapshot().sanity >= 75);
});


test('nine-night campaign honors the new roster, MAX and peaceful opening', () => {
  const roster = {
    gotica:  [5, 8, 4, 5, 5, 6, 11, 6, 7],
    yandere: [4, 4, 9, 2, 3, 5, 11, 6, 7],
    palhaca: [1, 2, 2, 3, 5, 8, 3, 5, 6],
    padrao:  [0, 1, 2, 3, 4, 5, 6, 10, 11],
    gatinha: [0, 0, 0, 2, 10, 4, 5, 5, 7],
    maid:    [0, 0, 1, 9, 2, 4, 5, 6, 7],
    smores:  [0, 0, 0, 0, 3, 5, 3, 10, 3],
    shadow:  [0, 0, 0, 0, 0, 1, 2, 10, 11]
  };
  const delays = [45, 40, 35, 30, 25, 20, 15, 10, 10];
  assert.equal(base.night.campaign.length, 9);
  assert.equal(base.night.campaignMaxLevel, 11);
  for (const [index, entry] of base.night.campaign.entries()) {
    assert.equal(entry.movementDelay, delays[index]);
    assert.equal(entry.maxClosedGates, index);
    assert.equal(entry.powerEnabled, index >= 1);
    assert.equal(entry.sanityEnabled, index >= 2);
    assert.equal(entry.hoursToWin, index === 8 ? 7 : 6);
    for (const [key, levels] of Object.entries(roster)) assert.equal(entry.levels[key], levels[index]);
    const config = structuredClone(base);
    const game = createMovement(config, { random: () => .99 });
    const input = { view: 'office', computer: true, radio: false, flashlight: true };
    const { levels, ...nightRules } = entry;
    game.reset(levels, input, { ...config.night, ...nightRules, maxLevel: config.night.campaignMaxLevel });
    const initialPositions = game.diagnostics().map(actor => actor.position);
    game.advance(delays[index] - .01, input);
    const before = game.snapshot();
    assert.equal(before.outcome, null);
    assert.equal(before.hours, 0);
    assert.equal(before.energy, 100);
    assert.equal(before.sanity, 100);
    assert.equal(before.counter, 1);
    assert.deepEqual(game.diagnostics().map(actor => actor.position), initialPositions);
    assert.equal(game.snapshot({ hud: true }).energyLossPerSecond, 0);
    assert.equal(game.snapshot({ hud: true }).sanityLossPerSecond, 0);
    game.advance(delays[index], input);
    assert.equal(game.snapshot().hours, 0);
    game.advance(delays[index] + .1, input);
    assert(game.snapshot().hours > 0);
  }
});

test('Yandere keeps her early first move after the protected delay', () => {
  const config = structuredClone(base);
  config.movement.jitter = { min: 0, max: 0 };
  Object.assign(config.characters.yandere, { start: 19, positions: [19, 21], interval: 5 });
  const night = config.night.campaign[1];
  const { levels, ...rules } = night;
  const game = createMovement(config, { random: () => 0 });
  game.reset(levels, {}, { ...config.night, ...rules, maxLevel: 11 });
  const roster = game.diagnostics();
  const yandere = roster.find(actor => actor.key === 'yandere');
  const gotica = roster.find(actor => actor.key === 'gotica');
  assert(yandere.remaining < gotica.remaining);
  game.advance(night.movementDelay + yandere.remaining - .001, {});
  assert.equal(game.diagnostics().find(actor => actor.key === 'yandere').position, 19);
  game.advance(night.movementDelay + yandere.remaining + .001, {});
  assert.equal(game.diagnostics().find(actor => actor.key === 'yandere').position, 21);
});

test('the final campaign night cannot end at 6 AM', () => {
  const config = structuredClone(base);
  const night = config.night.campaign[8];
  const { levels, ...rules } = night;
  const game = createMovement(config, { random: () => .99 });
  game.reset({}, {}, { ...config.night, ...rules, maxLevel: 11 });
  game.advance(night.movementDelay + 360, {});
  assert.equal(game.snapshot().outcome, null);
  near(game.snapshot().hours, 6);
  game.advance(night.movementDelay + 420, {});
  assert.equal(game.snapshot().outcome, 'win');
  near(game.snapshot().hours, 7);
});

test('closet protection and camera effects remain inactive during the opening', () => {
  const config = structuredClone(base);
  const game = createMovement(config, { random: () => .99 });
  const rule = { ...config.night, movementDelay: 45 };
  const input = { view: 'closet-back', closet: true, clownLight: true, camera: 'CAM03' };
  game.reset({ palhaca: 1, gotica: 5, yandere: 4 }, input, rule);
  game.advance(0, input, { type: 'closetEnter' });
  game.advance(44.9, input);
  assert.equal(game.snapshot().counter, 1);
  assert.equal(game.snapshot().floor, 1);
  assert.equal(game.snapshot().sanity, 100);
  assert.equal(game.snapshot().hours, 0);
  assert.equal(game.advance(44.9, input, { type: 'cameraAudio' }), false);
});


test('noise-driven attack progress is independent of character level', () => {
  const rules = base.movement.attack.bar;
  const effects = { attackBar: () => ({ intensity: 1, progressPerSecond: 0 }) };
  const { createApproach } = window.NathGame;
  for (const level of [1, 5, 11]) {
    const approach = createApproach(base.map, effects, () => 0, () => false, () => 0, rules);
    const actor = { key: 'padrao', level, position: base.map.back, light: 0, due: 0 };
    assert.equal(approach.begin(actor, 'corridor'), true);
    approach.integrate(actor, 3.5);
    near(actor.approach.progress, 50);
    approach.integrate(actor, 3.5);
    assert.equal(approach.completed(actor), true);
    actor.position = base.map.front;
    approach.arrive(actor);
    near(actor.approach.progress, 0);
    assert.equal(actor.approach.phase, 'entry');
  }
});

test('Gatinha is attracted to silence, common attacks require noise to start', () => {
  const config = structuredClone(base);
  const makeActor = key => ({ key, rule: config.characters[key], allowed: new Set(config.characters[key].positions),
    position: config.map.leftApproach, approach: { objective: 'stock', phase: 'approach' }, light: 0 });
  const actors = ['gotica', 'gatinha', 'padrao'].map(makeActor);
  const effects = createEffects(config, createRoutes(config.map), actors);
  near(effects.attackBar(actors[0], 'stock', 'approach', false, 0).intensity, 0);
  near(effects.attackBar(actors[1], 'stock', 'approach', false, 0).intensity, .55);
  for (let i = 0; i < 12; i++) effects.addNoiseEvent('gateClose', 0);
  const noisyCommon = effects.attackBar(actors[0], 'stock', 'approach', false, 0).intensity;
  const noisyCat = effects.attackBar(actors[1], 'stock', 'approach', false, 0).intensity;
  assert(noisyCommon > .9);
  assert(noisyCat < .2);
  assert(effects.attackBar(actors[2], 'stock', 'entry', false, 0).intensity > 1);
});

test('blocking clock, route bonuses and counterattack probabilities use the approved values', () => {
  near(base.movement.failedIntervalFactor, .7);
  near(base.movement.retryWindow, 4);
  near(base.movement.routes.huntBonus, 40);
  assert.deepEqual(base.movement.routes.padraoBonus, [40, 60]);
  assert.deepEqual(base.movement.routes.counterattack, {
    yandere: .20, gatinha: .23, gotica: .30, cooldownSeconds: 25
  });
  near(base.threats.attack.closetProtectionDelaySeconds, .35);
});
