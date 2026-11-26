const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
global.window = {};
for (const file of ['data/game-data', 'data/camera-layers', 'data/complex-layers', 'scene-art', 'gameplay/routes', 'gameplay/effects', 'gameplay/threats',
  'gameplay/gates', 'gameplay/electrical', 'gameplay/resources', 'gameplay/shadow', 'movement']) require('../src/' + file + '.js');
const N = window.NathGame;
const base = Object.fromEntries(['night', 'map', 'movement', 'characters', 'effects', 'threats',
  'controls', 'sanity', 'power', 'shadow'].map(name => [name, require('../config/' + name + '.json')]));
const near = (a, b, tolerance = 1e-7) => assert(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const attacks = Object.entries(base.movement.attack.bar.speeds).flatMap(([key, routes]) =>
  Object.entries(routes).map(([route, [speed, coefficient]]) => ({ key, route, speed, coefficient })));
const noiseLevels = [0, 5, 10, 15, 20, 30, 40, 50, 60, 70, 85, 100];
const delays = [0, 1, 2, 3, 4, 5, 6, 8];
function seeded(seed) {
  return () => {
    let value = seed += 0x6D2B79F5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 2 ** 32;
  };
}
function bar(key, route, config = base) {
  const actor = { key, rule: config.characters[key], allowed: new Set(config.characters[key].positions),
    position: route === 'stock' ? config.map.leftApproach : config.map.back, light: 0 };
  const effects = N.createEffects(config, N.createRoutes(config.map), [actor]);
  let now = 0, leftLook = false;
  const approach = N.createApproach(config.map, effects, () => .99, () => leftLook, () => now, config.movement.attack.bar);
  approach.begin(actor, route);
  return { actor, effects, approach, look(value) { leftLook = value; },
    step(dt, input = {}) {
      effects.prepare(input);
      approach.integrate(actor, dt);
      effects.integrate(dt, input);
      now += dt;
    } };
}
const matrix = [];
test('all 108 fixed-noise cases match their analytical speeds and first terminal event', () => {
  for (const attack of attacks) for (const noise of noiseLevels) {
    const config = structuredClone(base);
    config.effects.noise.rates.radio = noise;
    const b = bar(attack.key, attack.route, config);
    b.effects.integrate(100, { radio: true });
    const speed = attack.speed + attack.coefficient * noise;
    near(b.effects.attackBar(b.actor, attack.route, false).speed, speed);
    b.step(60, { radio: true });
    const limit = b.approach.duration(b.actor);
    const invasion = 100 / speed <= limit;
    near(b.actor.approach.elapsed, invasion ? 100 / speed : limit);
    near(b.actor.approach.progress, Math.min(100, speed * limit));
    assert.equal(Boolean(b.approach.completed(b.actor)), invasion);
    assert.equal(Boolean(b.approach.expired(b.actor)), !invasion);
    matrix.push({ ...attack, noise, measuredSpeed: speed, invasionSeconds: invasion ? b.actor.approach.elapsed : null,
      retreatSeconds: invasion ? null : limit, progress: b.actor.approach.progress });
  }
});

test('noise and integrated progress agree across 15/30/60/144 FPS and long frames', () => {
  for (const { key, route } of attacks) {
    const results = [];
    for (const dt of [1 / 15, 1 / 30, 1 / 60, 1 / 144, 4]) {
      const b = bar(key, route);
      b.effects.integrate(20, { radio: true });
      let time = 0;
      while (time < 8 - 1e-9) { const step = Math.min(dt, 8 - time); b.step(step); time += step; }
      results.push(b.actor.approach.progress);
    }
    results.forEach(value => near(value, results[0]));
  }
});

test('100% before, at, and after 24 seconds preserves event order on a 60-second frame', () => {
  for (const seconds of [23.999, 24, 24.001]) {
    const actor = { position: base.map.back };
    const a = N.createApproach(base.map, { attackBar: () => ({ speed: 100 / seconds }) });
    a.begin(actor, 'corridor'); a.integrate(actor, 60);
    assert.equal(Boolean(a.completed(actor)), seconds <= 24);
    near(actor.approach.elapsed, Math.min(24, seconds));
  }
});

test('regression clamped at zero remains independent of FPS when the speed changes sign', () => {
  const results = [];
  for (const dt of [1 / 15, 1 / 60, 1 / 144, .4]) {
    const b = bar('padrao', 'stock'); b.effects.startAudio(0, 'CAM08');
    for (let time = 0; time < .4 - 1e-9;) {
      const step = Math.min(dt, .4 - time); b.step(step, { radio: true }); time += step;
    }
    results.push(b.actor.approach.progress);
  }
  results.forEach(value => near(value, results[0], 1e-4));
});

test('a transient crossing of 100% cannot be hidden by later regression in a long frame', () => {
  const results = [];
  for (const dt of [1 / 60, 3]) {
    const config = structuredClone(base); config.effects.noise.rates.radio = 100;
    const b = bar('padrao', 'stock', config);
    b.effects.integrate(20, { radio: true }); b.effects.startAudio(0, 'CAM08');
    b.actor.approach.progress = 99.5;
    for (let time = 0; time < 3 - 1e-9 && !b.approach.completed(b.actor); time += dt) b.step(dt);
    assert(b.approach.completed(b.actor)); results.push(b.actor.approach.elapsed);
  }
  near(results[0], results[1]);
});

test('radio, HUD and inactive actor diagnostics share noise; action peaks decay promptly', () => {
  const b = bar('gotica', 'corridor');
  b.effects.integrate(10, { radio: true }); near(b.effects.perceivedNoise(), 70);
  b.effects.integrate(1, {}); assert(b.effects.perceivedNoise() < 3.5);
  for (const event of Object.keys(base.effects.noise.events)) {
    b.effects.addNoiseEvent(event);
    near(b.effects.noiseIntensity(), b.effects.perceivedNoise());
    b.effects.integrate(2, {}); assert(b.effects.perceivedNoise() < .05);
  }
  const game = N.createMovement(base); game.reset({}, { radio: true }); game.advance(2, { radio: true });
  const noise = game.snapshot({ hud: true }).noiseIntensity;
  assert(noise > 69); game.debugSnapshot().actors.forEach(actor => near(actor.noise, noise));
});

test('flashlight, observation and camera audio modify actual progress on both halves', () => {
  for (const key of ['gotica', 'yandere', 'gatinha']) for (const progress of [20, 65]) {
    const b = bar(key, 'corridor'); b.actor.light = 1; b.actor.approach.progress = progress;
    const speed = b.effects.attackBar(b.actor, 'corridor', false).speed;
    near(speed, base.movement.attack.bar.speeds[key].corridor[0] + base.movement.attack.bar.light[key]);
    b.step(1, { corridorLight: true }); near(b.actor.approach.progress, progress + speed);
  }
  for (const { key, route } of attacks.filter(a => a.route === 'stock')) {
    const b = bar(key, route); b.look(true); b.step(2); near(b.actor.approach.progress, 2 * (base.movement.attack.bar.speeds[key].stock[0] - .65));
    b.actor.approach.progress = 60;
    b.effects.startAudio(2, 'CAM08');
    const speed = b.effects.attackBar(b.actor, route, true, 2).speed;
    b.step(1); near(b.actor.approach.progress, 60 + speed);
    near(b.effects.attackBar(b.actor, route, true, 5).modifiers.audio, 0);
  }
  // A synthetic distance map isolates direction, while the real graph tests above cover reach.
  for (const direction of ['toward', 'away']) {
    const config = structuredClone(base), actor = bar('yandere', 'corridor').actor;
    const graph = N.createRoutes(config.map);
    graph.distances = () => new Map([[base.map.back, 1], [base.map.office, direction === 'toward' ? 0 : 2]]);
    const fx = N.createEffects(config, graph, [actor]); fx.startAudio(0, 'CAM05');
    near(fx.attackBar(actor, 'corridor', false, 1).modifiers.audio, direction === 'toward' ? 3 : -3);
  }
});

function movementScenario(keys, radio, gate = false, route = 'corridor') {
  const config = structuredClone(base), events = [];
  config.night.movementDelay = 0;
  config.movement.jitter = { min: 0, max: 0 };
  const start = route === 'stock' ? config.map.leftApproach : config.map.back;
  const routeId = route === 'stock' ? 'EL' : 'CV';
  for (const key of keys) Object.assign(config.characters[key], { start, interval: 1,
    initialStationaryAttempts: 0, routes: { [routeId]: 100 }, firstIntervalReduction: [0, 0] });
  config.movement.routes.definitions[routeId].paths = [[start]];
  const game = N.createMovement(config, { random: () => .99, emit: (...event) => events.push(event) });
  const input = { view: 'office', radio, gates: gate ? ['G01'] : [] };
  game.reset(Object.fromEntries(keys.map(key => [key, 1])), input);
  return { game, input, events, config };
}

test('real visual transition occurs at 55% without reset or duplicated attack audio', () => {
  const { game, input, events } = movementScenario(['gotica'], true);
  for (let time = 0; time <= 16; time += .025) {
    game.advance(time, input);
    const a = game.debugSnapshot().actors.find(a => a.key === 'gotica');
    if (a.position === base.map.front) {
      near(a.attackProgress, base.movement.attack.bar.advancedProgress, .3); assert(a.attackElapsed > 5);
      assert.equal(events.filter(e => e[0] === 'corridorAttack').length, 1); return;
    }
  }
  assert.fail('no visual transition');
});

test('closed central gate blocks entry; opening it releases the same completed bar', () => {
  const { game, input } = movementScenario(['gotica'], true, true);
  game.advance(15, input);
  const a = game.debugSnapshot().actors.find(a => a.key === 'gotica');
  assert.equal(a.position, base.map.front); near(a.attackProgress, 100);
  assert.equal(game.snapshot().outcome, null);
  assert(game.advance(15, input, { type: 'gate', id: 'G01', source: 'office' }));
  assert.equal(game.debugSnapshot().actors.find(a => a.key === 'gotica').position, base.map.office);
});

test('opening or closing the gate during an unfinished attack preserves progress and blocks correctly', () => {
  for (const closed of [false, true]) {
    const { game, input } = movementScenario(['gotica'], true, closed);
    game.advance(8, input);
    const before = game.debugSnapshot().actors.find(a => a.key === 'gotica');
    assert(before.attackProgress > 50 && before.attackProgress < 100);
    assert(game.advance(8, input, { type: 'gate', id: 'G01', source: 'office' }));
    const after = game.debugSnapshot().actors.find(a => a.key === 'gotica');
    near(after.attackProgress, before.attackProgress); near(after.attackElapsed, before.attackElapsed);
    game.advance(15, input);
    const actor = game.debugSnapshot().actors.find(a => a.key === 'gotica');
    assert.equal(actor.position, closed ? base.map.office : base.map.front);
    assert.equal(game.isGateClosed('G01'), !closed);
  }
});

test('Gothic flashlight retreat is exactly 5 + 5 seconds, independent of bar half', () => {
  const { game, input, events } = movementScenario(['gotica'], false);
  game.advance(1, input); const lit = { ...input, corridorLight: true };
  game.advance(1, lit); game.advance(10.99, lit);
  assert(game.debugSnapshot().actors.find(a => a.key === 'gotica').attackActive);
  game.advance(11.001, lit);
  assert(events.some(e => e[0] === 'move' && e[1].retreat === 'corridor'));
});

test('all stock attacks use the existing doorway and withdraw at the original timeout', () => {
  for (const key of ['padrao', 'gotica', 'yandere', 'gatinha']) {
    const { game, input } = movementScenario([key], key === 'gatinha', false, 'stock');
    game.advance(20, input);
    const actor = game.debugSnapshot().actors.find(a => a.key === key);
    assert.equal(actor.position, base.map.left);
    assert(actor.attackProgress > 50 && actor.attackProgress < 100);
    near(actor.attackElapsed, 19);
    game.advance(25.001, input);
    assert.equal(game.debugSnapshot().actors.find(a => a.key === key).attackActive, false);
  }
});

test('regression below 55% keeps one consistent visual position and one bar', () => {
  const b = bar('padrao', 'stock');
  b.step(17); assert(b.actor.approach.advanced);
  b.actor.position = base.map.left; b.approach.arrive(b.actor);
  b.effects.startAudio(17, 'CAM08'); b.step(2);
  assert(b.actor.approach.progress < base.movement.attack.bar.advancedProgress);
  assert(b.actor.approach.advanced);
  assert.equal(b.actor.position, base.map.left);
  near(b.actor.approach.elapsed, 19);
});

test('the visual midpoint does not change attack acoustics or speed', () => {
  for (const { key, route } of attacks) for (const camera of ['CAM08', 'CAM05', 'CAM09']) {
    const b = bar(key, route); b.effects.startAudio(0, camera);
    const before = b.effects.attackBar(b.actor, route, false, 1).speed;
    b.actor.position = route === 'stock' ? base.map.left : base.map.front;
    b.actor.approach.progress = 50; b.approach.arrive(b.actor);
    near(b.effects.attackBar(b.actor, route, false, 1).speed, before);
  }
});

test('real pairs and trios share the original map; a blocked visual move never stops its timeout', () => {
  for (const keys of [['padrao', 'gatinha'], ['gotica', 'gatinha'], ['yandere', 'gatinha'],
    ['padrao', 'gotica', 'gatinha'], ['gotica', 'yandere', 'gatinha'], ['padrao', 'yandere', 'gatinha']]) {
    for (const radio of [false, true]) {
      const { game, input, events } = movementScenario(keys, radio, true);
      game.advance(25.001, input);
      assert.equal(game.snapshot().outcome, null);
      assert(game.isGateClosed('G01'));
      assert(!events.some(e => e[0] === 'invasion'));
      const diagnostics = game.diagnostics();
      for (const [position, capacity] of Object.entries(base.map.capacities))
        assert(diagnostics.filter(a => a.position === Number(position)).length <= capacity);
      if (!radio) for (const key of keys.filter(key => key !== 'gatinha')) {
        assert(events.some(e => e[0] === 'move' && e[1].actor.key === key && e[1].retreat === 'corridor'));
        assert.equal(game.debugSnapshot().actors.find(a => a.key === key).attackActive, false);
      }
    }
  }
});

test('simultaneous invaders retain independent closet reactions and the three-second exit protection', () => {
  for (const keys of [['padrao', 'gatinha'], ['gotica', 'gatinha', 'yandere']]) {
    const events = [];
    const threats = N.createThreats(base, { palhaca: 0 }, () => .5, event => events.push(event));
    const actors = keys.map(key => ({ key, reaction: base.characters[key].reaction }));
    actors.forEach((actor, i) => assert.equal(threats.invade(actor, i * .1, i * .1, i === 0), undefined));
    assert(threats.enterCloset(.5));
    threats.resolve(20, () => {}, assert.fail);
    actors.forEach(actor => assert.equal(threats.invasionStatus(actor, 20), null));
    assert.equal(events.filter(event => event === 'fearRecovery').length, 1);
    assert.equal(threats.entryAttacker({ key: 'maid' }, true, 22.99), null);
    assert.equal(threats.entryAttacker({ key: 'maid' }, true, 23), 'palhaca');
  }
});

function reaction(attack, delay, wasOn, background, seed = 1) {
  const b = bar(attack.key, attack.route), random = seeded(seed);
  const extra = background ? base.effects.noise.rates.computer + base.effects.noise.rates.viewMoving : 0;
  b.effects.integrate(20, { radio: wasOn, computer: background, viewMoving: background });
  if (background) b.effects.addNoiseEvent('gateClose');
  // Scripted action at the requested time; no inspection of progress to decide actions.
  // Radio access/UI costs are excluded and this is explicitly an isolated bar model.
  const limit = b.approach.duration(b.actor);
  let time = 0;
  while (time < limit - 1e-9 && !b.approach.completed(b.actor)) {
    const reacting = time >= delay - 1e-9;
    const radio = reacting ? attack.key === 'gatinha' : wasOn;
    const dt = Math.min(.1 + random() * .05, limit - time, !reacting ? delay - time : Infinity);
    b.step(dt, { radio, computer: background, viewMoving: background }); time += dt;
  }
  return { defended: !b.approach.completed(b.actor), progress: b.actor.approach.progress, extra };
}
const reactions = [];
test('288 delayed-reaction scenarios cover both prior radio states and background actions', () => {
  for (const attack of attacks) for (const delay of delays) for (const wasOn of [false, true]) for (const background of [false, true]) {
    const result = reaction(attack, delay, wasOn, background);
    assert(Number.isFinite(result.progress));
    if (delay <= 3 && attack.key !== 'maid') assert(result.defended, JSON.stringify({ attack, delay, wasOn, background, result }));
    reactions.push({ key: attack.key, route: attack.route, delay, wasOn, background, ...result });
  }
});

const stress = [];
test('1000 seeded isolated trials per delay reproduce the modeled success/failure rates', () => {
  for (const attack of attacks) for (const delay of delays) {
    let defended = 0;
    for (let seed = 1; seed <= 1000; seed++) {
      const random = seeded(seed);
      const result = reaction(attack, delay, random() < .5, true, seed);
      defended += Number(result.defended);
    }
    stress.push({ key: attack.key, route: attack.route, delay, trials: 1000, defended, invasions: 1000 - defended });
  }
});

const passiveNights = [];
test('1000 seeded passive engine runs per Night 6/MAX and prior radio state respect gates and map capacities', () => {
  for (const kind of ['night6', 'MAX']) for (const radio of [false, true]) {
    let wins = 0, losses = 0;
    const causes = {};
    let firstLoss = Infinity, lastLoss = 0;
    for (let seed = 1; seed <= 1000; seed++) {
      const random = seeded(seed);
      let game;
      game = N.createMovement(base, { random, hallucinationRandom: seeded(seed + 10000), emit: (event, data) => {
        if (event === 'move' && data.from === base.map.front && data.to === base.map.office)
          assert.equal(game.isGateClosed('G01'), false);
        if (event === 'loss') causes[data] = (causes[data] ?? 0) + 1;
      } });
      const rules = kind === 'night6' ? { ...base.night, ...base.night.campaign[5] } : base.night;
      const levels = kind === 'night6' ? rules.levels : Object.fromEntries(
        [...Object.keys(base.characters), 'palhaca', 'smores', 'shadow'].map(key => [key, 11]));
      // Passive controls need no UI transitions or privileged observations.
      // These are negative controls, NOT a simulated competent human strategy.
      const input = { view: 'office', radio };
      game.reset(levels, input, rules);
      for (let time = 5; time <= 1200 && !game.snapshot().outcome; time += 5) {
        game.advance(time, input);
        const actors = game.diagnostics();
        for (const [position, capacity] of Object.entries(base.map.capacities))
          assert(actors.filter(a => a.position === Number(position)).length <= capacity);
      }
      const result = game.snapshot();
      assert(result.outcome, `unterminated ${kind} seed ${seed}`);
      wins += Number(result.outcome === 'win'); losses += Number(result.outcome === 'loss');
      if (result.outcome === 'loss') { firstLoss = Math.min(firstLoss, result.now); lastLoss = Math.max(lastLoss, result.now); }
    }
    passiveNights.push({ kind, radio, trials: 1000, wins, losses, causes, firstLoss, lastLoss,
      scope: 'Passive engine negative control. Does not estimate human win rate or reactive UI play.' });
  }
});

test('bounded noise state remains finite through 24 simulated hours', () => {
  const b = bar('gatinha', 'corridor');
  for (let i = 0; i < 86400; i++) {
    if (i % 3 === 0) b.effects.addNoiseEvent('gateClose');
    b.effects.integrate(1, { radio: i % 7 < 3, computer: true, viewMoving: i % 2 === 0 });
    assert(b.effects.perceivedNoise() >= 0 && b.effects.perceivedNoise() <= 100);
  }
});

test('write reproducible measurements when explicitly requested', () => {
  if (process.env.NNN_BALANCE_REPORT) fs.writeFileSync(process.env.NNN_BALANCE_REPORT,
    JSON.stringify({ matrix, reactions, stress, passiveNights,
      scope: 'Isolated attack model and passive engine controls; not human night win rates.' }, null, 2) + '\n');
});
