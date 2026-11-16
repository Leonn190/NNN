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
    ['padrao', 32, 40, 48], ['gotica', 25, 32.5, 40], ['yandere', 25, 32.5, 40], ['gatinha', 25, 32.5, 40]
  ]) {
    near(routes.bonus(1, 0, key), low);
    near(routes.bonus(6, 0, key), mid);
    near(routes.bonus(11, 0, key), high);
    near(routes.bonus(11, 2, key), high + 2 * (key === 'padrao' ? 6 : 5));
  }
  const hunt = scenario({ padrao: 1, gotica: 1, maid: 1 }, {}, config => {
    Object.assign(config.characters.padrao, { start: 7, interval: 1, routes: { CV: 100 } });
  });
  near(hunt.debug('padrao').bonus, 32 + 25);
  hunt.at(1);
  near(hunt.debug('padrao').bonus, 32 + 4 - 20);
  near(hunt.debug('gotica').bonus, 25 + 25);
  near(hunt.debug('maid').bonus, 10);
});

function corridor(config) {
  Object.assign(config.characters.gotica, { start: 7, interval: 1, routes: { CV: 100 } });
  config.movement.recovery.freeMoves = 0;
  config.movement.retreat.office = [7];
}

test('third invasion kills immediately and takes priority over the closet clown', () => {
  const input = { view: 'cameras', computerInterface: true };
  for (const hidden of [true, false]) {
    const run = scenario({ gotica: 1 }, input, corridor);
    for (const [arrival, reaction] of [[3, 4], [11.75, 3]]) {
      run.at(arrival);
      assert.equal(run.actor('gotica').position, 13);
      near(run.debug('gotica').reaction, reaction);
      const closet = { view: 'closet-door', closet: true };
      run.at(arrival, closet, { type: 'closetEnter' });
      run.at(arrival + 5.5, closet);
      run.at(arrival + 5.5, { view: 'office' }, { type: 'closetExit' });
      assert.equal(run.game.snapshot().outcome, null);
    }
    assert.equal(run.debug('gotica').instantInvasion, true);
    if (hidden) run.at(18, { view: 'closet-door', closet: true }, { type: 'closetEnter' });
    run.at(20.5, hidden ? { view: 'closet-door', closet: true } : input);
    assert.deepEqual(run.emitted('loss'), ['gotica']);
    assert.equal(run.debug('gotica').invasions, 3);
    run.at(22);
    assert.deepEqual(run.emitted('loss'), ['gotica']);
    run.game.reset({ gotica: 1 }, input);
    assert.equal(run.debug('gotica').invasions, 0);
    near(run.debug('gotica').reaction, 4);
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

test('a hidden player triggers the closet clown on the first entry into an empty office, even at level zero', () => {
  const closet = { view: 'closet-door', closet: true };
  const run = scenario({ gotica: 1, yandere: 1, palhaca: 0 }, closet, config => {
    corridor(config);
    Object.assign(config.characters.yandere, { ...config.characters.gotica, firstIntervalReduction: [0, 0] });
  });
  run.at(0, closet, { type: 'closetEnter' });
  run.at(3);
  assert.deepEqual(run.emitted('loss'), ['palhaca']);
  assert.equal(run.game.snapshot().hidden, true);
  assert.equal(run.debug('gotica').invasions + run.debug('yandere').invasions, 1);

  const threats = createThreats(base, { palhaca: 0 }, () => 0, () => {});
  threats.invade({ key: 'padrao', reaction: 3 }, 0);
  threats.enterCloset(1);
  const other = { key: 'gotica', reaction: 4 };
  assert.equal(threats.invade(other, 2), undefined);
  assert.equal(threats.invasionStatus(other, 2).retreat, true);
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
        const factor = hidden ? (clownLight ? 1.625 : 3.25) : Number(!radio);
        near(run.game.snapshot().counter, 20 + growth * factor - (radio ? 2 : 0));
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
  run.at(55);
  assert.equal(run.emitted('yandereSabotage').length, 0);
  run.at(58);
  assert.equal(run.emitted('yandereSabotage').length, 1);

  const recovered = scenario({ yandere: 6 }, { view: 'office', radio: true }, config => {
    config.characters.yandere.interval = 1000;
    config.sanity.initial = 74;
  });
  recovered.at(100);
  assert.equal(recovered.emitted('yandereSabotage').length, 0);
  assert(recovered.game.snapshot().sanity >= 75);
});
