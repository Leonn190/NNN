(() => {
'use strict';

const { factor, difficultyProgress, interpolate, uniform, weightedChoices, drawWeighted, createRoutes, createAttackRoutes,
  createEffects, createHallucinations, createApproach, createThreats, createSmores,
  createResources, createShadow, shadowDifficulty, createGates, canControlGate, createElectrical, CAMERAS } = window.NathGame;

function createMovement(config, { random = Math.random, hallucinationRandom = Math.random, emit = () => {} } = {}) {
  const { map, movement, characters, night } = config;
  const { left, leftApproach, office, front, back, closetVent } = map;
  const { difficulty, retreat, recovery } = movement;
  const { yandereCameraScare: cameraScare, yandereSurprise: surpriseRules } = config.threats;
  const closetVentRules = config.threats.closetVent;
  const service = map.positions.find(position => position.cameras.includes('CAM09'))?.id;
  const routes = createRoutes(map);
  const officeGate = routes.gate(front, office);
  const cameraIds = CAMERAS.map(cam => cam.id);
  let roster, actors, effects, threats, resources, shadow, smores, gates, electrical, input, now, outcome, sanityEnabled;
  let movementDelay, maxClosedGates, approach, hallucinations, stopped;
  let watchedCamera, watchedSince, cameraScareEnds, cameraScareSeconds;
  let closetAttack, flashUntil, smoresVisibleAt;
  let hunters, favored, penalized;
  let yandere, surpriseLimit, surprisesUsed, inactivityEnds, surprise;

  const movementPaused = () => now < movementDelay;
  const gateControlsAvailable = id => maxClosedGates > 0 && !electrical.failed()
    && canControlGate(id, undefined, resources.snapshot(now).blackout);
  const officeLightAvailable = () => !gates.closed.has(officeGate) && !actors.some(actor => actor.position === office);
  const corridorLit = () => input.corridorLight && resources.flashlightAvailable(now) && officeLightAvailable();
  const lightIntervalFactor = actor => actor.key !== 'gotica' && (actor.position === back || actor.position === front)
    && corridorLit() ? config.effects.flashlight.corridorIntervalFactor : 1;
  const moveDue = actor => {
    const reduction = smores.intervalReduction();
    const due = reduction < actor.scheduledSeconds ? actor.due - reduction : actor.due;
    return now + (due - now) * lightIntervalFactor(actor);
  };
  const camerasAvailable = () => resources.computerOn() && !electrical.failed();
  const canUse = (actor, edge) => edge && (!edge.actors || edge.actors.includes(actor.key))
    && (!edge.route || edge.route === actor.route?.id);
  const passable = (actor, edge) => canUse(actor, edge) && !gates.closed.has(edge.gateId);
  const clear = (actor, edge, from, to) => passable(actor, edge) && !isFull(to) && !observed(from, to);
  const attackRoutes = createAttackRoutes(config, routes, random, passable, clear);

  function flickerCorridor(from, to) {
    if (corridorLit()
        && (from === front || from === back || to === front || to === back)) emit('corridorFlicker');
  }

  function interval(actor, first = false) {
    const initial = actor.rule.initialStationaryAttempts !== undefined && actor.position === actor.rule.start && !actor.leftStart;
    const extra = actor.rule.extraIntervalReduction ?? 0;
    const acceleration = initial ? actor.rule.initialIntervalReduction ?? 0 : 0;
    const firstFactor = first ? 1 - actor.firstIntervalReduction : 1;
    const regularFactor = (1 - difficulty.maxIntervalReduction * actor.progress)
      * factor(-extra * actor.progress) * factor(-acceleration * actor.progress);
    const intervalFactor = regularFactor * firstFactor;
    const seconds = actor.rule.interval * intervalFactor
      + uniform(random, movement.jitter) * Math.min(1, intervalFactor / regularFactor);
    const baseSeconds = actor.rule.interval * intervalFactor;
    if (!(baseSeconds > 0 && Number.isFinite(seconds))) throw new Error(`Intervalo inválido para ${actor.rule.name}.`);
    return seconds > 0 ? seconds : baseSeconds;
  }

  function schedule(actor, intervalFactor = 1, first = false) {
    actor.scheduledSeconds = interval(actor, first) * intervalFactor;
    actor.due = now + actor.scheduledSeconds;
    actor.intervalPenalty = intervalFactor === recovery.intervalFactor ? intervalFactor : 1;
  }

  function reset(levels = {}, initialInput = {}, rules = night) {
    now = 0;
    outcome = null;
    stopped = false;
    closetAttack = null;
    flashUntil = smoresVisibleAt = 0;
    watchedCamera = watchedSince = cameraScareEnds = undefined;
    sanityEnabled = rules.sanityEnabled;
    hallucinations = createHallucinations(config.sanity.hallucinations, sanityEnabled, hallucinationRandom,
      () => emit('hallucinationLaugh'));
    movementDelay = rules.movementDelay ?? 0;
    maxClosedGates = rules.maxClosedGates ?? map.maxClosedMapGates;
    const { gates: initialGates, ...startingInput } = initialInput;
    input = startingInput;
    gates = createGates(maxClosedGates, changes => {
      if (changes.some(({ id, closed }) => id === map.workshopGate && closed)) effects.addNoiseEvent('workshopDoorClose', now);
      emit('gatesChanged', changes);
    }, initialGates);
    electrical = createElectrical();
    const maxLevel = night.levels[1];
    const effectiveMax = rules.maxLevel ?? maxLevel;
    const levelFor = key => Math.max(0, Math.min(effectiveMax, levels[key] ?? night.defaultLevel));
    roster = Object.entries(characters).map(([key, rule]) => {
      const level = levelFor(key);
      const character = { key, rule, level, position: rule.start, stage: 0 };
      if (level === 0) return character;
      const progress = difficultyProgress(level, maxLevel);
      const allowed = new Set(rule.positions);
      return {
        ...character, allowed, previous: null, pending: null,
        noise: 0, light: 0, audioStimulus: null, progress,
        reaction: rule.reaction * (1 - difficulty.maxReactionReduction * progress),
        targetBonus: rule.targetBonus ? interpolate(rule.targetBonus, progress) : 0,
        firstIntervalReduction: rule.firstIntervalReduction ? interpolate(rule.firstIntervalReduction, progress) : 0,
        staticChance: rule.staticChance && interpolate(rule.staticChance, progress),
        doorChance: rule.doorChance && interpolate(rule.doorChance, progress),
        route: null, lastRoute: null, approach: null, freeMoves: 0, retreat: null
      };
    });
    actors = roster.filter(actor => actor.level > 0);
    hunters = actors.filter(actor => actor.rule.routes).map(actor => actor.key);
    favored = drawHunter();
    penalized = null;
    yandere = actors.find(actor => actor.key === 'yandere');
    const yandereLevel = yandere?.level ?? 0;
    surpriseLimit = yandereLevel < surpriseRules.firstLevel ? 0 : yandereLevel === effectiveMax ? surpriseRules.uses.max
      : yandereLevel >= surpriseRules.secondLevel ? surpriseRules.uses.second : surpriseRules.uses.first;
    surprisesUsed = 0;
    surprise = null;
    inactivityEnds = Infinity;
    cameraScareSeconds = interpolate(cameraScare.observationSeconds, difficultyProgress(levelFor('yandere'), maxLevel));
    effects = createEffects(config, routes, actors);
    approach = createApproach(map, effects, random, () => input.leftLook, () => now);
    for (const actor of actors) {
      schedule(actor, 1, true);
      actor.due += movementDelay;
    }
    smores = createSmores(config.threats.smores, levelFor('smores'), maxLevel, random, (event, phase) => {
      if (phase === 'room') smoresVisibleAt = invasionRevealTime();
      emit(event, phase);
    });
    threats = createThreats(config, { palhaca: levelFor('palhaca') }, random, emit, smores.reactionReduction, effectiveMax);
    resources = createResources(config, rules, () => gates.open(officeGate));
    resetInactivity();
    if (resources.snapshot(now).blackout) gates.open(officeGate);
    const shadowLevel = sanityEnabled ? levelFor('shadow') : 0;
    shadow = createShadow(config.shadow, shadowDifficulty(config.shadow, shadowLevel, effectiveMax), cameraIds, random);
  }

  function drawHunter(exclude) {
    const eligible = hunters.filter(key => key !== exclude);
    return eligible.length > 1 ? eligible[Math.floor(random() * eligible.length)] : eligible[0];
  }

  function resetInactivity(start = now, sanity = resources.snapshot(now).sanity) {
    surprise = null;
    inactivityEnds = surprisesUsed < surpriseLimit && sanityEnabled && sanity < surpriseRules.sanityThreshold
      ? start + uniform(random, surpriseRules.inactivity) : Infinity;
  }

  function updateSurpriseSanity(before, after, start, end) {
    if (!sanityEnabled || surprisesUsed >= surpriseLimit) return;
    const threshold = surpriseRules.sanityThreshold;
    if (after >= threshold) {
      if (inactivityEnds !== Infinity || surprise) resetInactivity(end, after);
    } else if (before >= threshold) {
      const crossing = start + (end - start) * (before - threshold) / (before - after);
      resetInactivity(crossing, after);
    }
  }

  function attackStarted(actor, objective, surpriseAttack = false) {
    if (actor.key === favored && hunters.length > 1) {
      penalized = favored;
      favored = drawHunter(penalized);
    }
    if (objective === 'closetVent') {
      emit('closetVent', actor);
      return;
    }
    resetInactivity();
    const event = objective === 'corridor' ? 'corridorAttack' : 'stockAttack';
    if (surpriseAttack) emit(event, actor.key, true);
    else emit(event, actor.key);
  }

  function triggerInterference(actor, surpriseAttack = false) {
    effects.triggerStatic(now);
    emit('cameraInterference', now);
    if (actor.key === 'yandere') emit('yandereSabotage', surpriseAttack);
  }

  const surpriseEntries = { stock: leftApproach, corridor: back };
  function canSurprise(objective) {
    if (!yandere || yandere.approach || yandere.position === office || cameraScareEnds !== undefined) return false;
    const entry = surpriseEntries[objective];
    return yandere.allowed.has(entry) && (yandere.position === entry || !isFull(entry));
  }

  function surpriseDeadline() {
    if (surprise) return surprise.startsAt;
    if (inactivityEnds > now) return inactivityEnds;
    return Object.keys(surpriseEntries).some(canSurprise) ? now : Infinity;
  }

  function resolveSurprise() {
    if (surprise) {
      if (now < surprise.startsAt) return;
      const { objective } = surprise;
      if (!canSurprise(objective)) {
        surprise = null;
        inactivityEnds = effects.staticActive(now) ? effects.staticDeadline(now) : now;
        return;
      }
      const actor = yandere;
      const from = actor.position;
      const to = surpriseEntries[objective];
      actor.previous = from;
      actor.position = to;
      actor.pending = actor.audioStimulus = actor.retreat = null;
      recover(actor, 1);
      approach.begin(actor, objective);
      actor.approach.surprise = true;
      if (from !== to) emit('move', { actor, from, to, teleport: true });
      surprisesUsed++;
      attackStarted(actor, objective, true);
    } else if (now >= inactivityEnds) {
      const eligible = Object.keys(surpriseEntries).filter(canSurprise);
      if (!eligible.length) return;
      const objective = eligible[Math.floor(random() * eligible.length)];
      surprise = { objective, startsAt: now + surpriseRules.warningSeconds };
      triggerInterference(yandere, true);
    }
  }

  function occupants(position) {
    return actors.filter(actor => actor.position === position);
  }

  const officeVacant = () => occupants(office).length === 0 && smores.phase() !== 'room';

  function invasionRevealTime() {
    if (input.view !== 'office' || input.closet || threats.snapshot().hidden || input.invasionFlashBlocked) return now;
    if (flashUntil <= now) {
      const seconds = config.effects.invasion.flashMs / 1000;
      flashUntil = now + seconds;
      threats.delayReactions(seconds);
    }
    return flashUntil;
  }

  function resolveClosetVent() {
    if (closetAttack?.phase !== 'closetVent') return;
    const { actor, due, litSince, lightSeconds } = closetAttack;
    const repelAt = litSince + lightSeconds;
    if (repelAt <= Math.min(now, due)) {
      closetAttack = null;
      actor.previous = closetVent;
      actor.position = actor.rule.start;
      recover(actor);
      emit('move', { actor, from: closetVent, to: actor.position, retreat: 'closetVent' });
    } else if (now >= due) {
      closetAttack.phase = 'compromised';
      if (threats.snapshot().hidden) finish('loss', actor.key);
    }
  }

  function recover(actor, intervalFactor = recovery.intervalFactor) {
    actor.route = null;
    actor.retainedRouteMoves = 0;
    actor.approach = null;
    actor.noise = 0;
    actor.light = 0;
    actor.freeMoves = actor.rule.routes && intervalFactor === recovery.intervalFactor ? recovery.freeMoves : 0;
    schedule(actor, intervalFactor);
  }

  function retreatChoices(actor, kind) {
    return weightedChoices(retreat[kind].filter(id => actor.allowed.has(id) && !isFull(id)),
      id => effects.weight(actor, id, now));
  }

  function withdraw(actor, kind, intervalFactor) {
    const from = actor.position;
    const to = drawWeighted(random, retreatChoices(actor, kind));
    if (to !== undefined) {
      flickerCorridor(from, to);
      actor.previous = from;
      actor.position = to;
    }
    recover(actor, intervalFactor);
    actor.retreat = kind;
    if (to !== undefined) emit('move', { actor, from, to, retreat: kind });
  }

  function reachCheckpoint(actor, from) {
    if (!attackRoutes.reach(actor, from)) return false;
    if (actor.route.objective === 'closetVent') {
      actor.due = Infinity;
      closetAttack = { actor, phase: 'closetVent', due: now + closetVentRules.waitSeconds, litSince: Infinity,
        lightSeconds: uniform(random, closetVentRules.lightSeconds) };
      attackStarted(actor, 'closetVent');
      return true;
    }
    if (actor.route.objective === 'electrical') {
      recover(actor);
      if (electrical.trip()) {
        resources.applyEvent('electricalFault', now);
        emit('electricalFault');
        emit('yandereSabotage', false);
      }
      return true;
    } else {
      const { objective } = actor.route;
      if (approach.begin(actor, objective)) attackStarted(actor, objective);
    }
    return false;
  }

  const navigationTarget = actor => actor.rule.routes ? attackRoutes.checkpoint(actor) : back;
  const navigationBonus = actor => actor.rule.routes
    ? attackRoutes.bonus(actor.level, actor.route?.moves ?? actor.retainedRouteMoves, actor.key) : actor.targetBonus;
  function effectiveNavigationBonus(actor) {
    const bonus = navigationBonus(actor) * smores.targetBonusMultiplier();
    if (actor.key === favored) return bonus + movement.routes.huntBonus;
    if (actor.key === penalized) return bonus - movement.routes.huntPenalty;
    return bonus;
  }

  function navigationChoices(actor) {
    const { position: from } = actor;
    const target = actor.route?.paths ? actor.route.lastReached ?? actor.route.required : navigationTarget(actor);
    const next = target === undefined ? [] : attackRoutes.nextSteps(actor, target);
    const progress = new Set(next);
    const neighbors = routes.neighbors.get(from).filter(id =>
      attackRoutes.canNavigate(actor, id) && canUse(actor, routes.connection(from, id)));
    const choices = actor.route
      ? [...neighbors.filter(id => progress.has(id)), ...neighbors.filter(id => !progress.has(id))]
      : neighbors;
    const bonus = factor(effectiveNavigationBonus(actor));
    const weighted = weightedChoices([...choices, from], id => {
      if (id === from) return movement.weight * movement.stayFactor * effects.stayWeight(actor, now);
      const progresses = progress.has(id);
      return movement.weight * (id === actor.previous && !progresses ? movement.backtrackFactor : 1)
        * (progresses ? bonus : 1) * effects.weight(actor, id, now);
    });
    if (!actor.rule.watchedNeighborBonus || !watchingCamera()) return weighted;
    const watched = new Set(neighbors.filter(to => cameraObserves(to)
      && passable(actor, routes.connection(from, to)) && !isFull(to)));
    const share = weighted.weights.reduce((sum, weight, index) =>
      sum + (watched.has(weighted.items[index]) ? weight : 0), 0) / weighted.total;
    if (!(share > 0 && share < 1)) return weighted;
    // Shift probability between groups while preserving the ratios within each group.
    const boost = Math.min(actor.rule.watchedNeighborBonus, 1 - share);
    const weights = weighted.weights.map((weight, index) => weight
      * (watched.has(weighted.items[index]) ? 1 + boost / share : 1 - boost / (1 - share)));
    return { ...weighted, weights, total: weights.reduce((sum, weight) => sum + weight, 0) };
  }

  function choose(actor) {
    if (actor.stage < actor.rule.initialStationaryAttempts) return { to: actor.position, stationary: true };
    if (actor.approach) return approach.choose(actor);
    const serviceChoices = maidServiceChoices(actor);
    if (serviceChoices) {
      const to = drawWeighted(random, serviceChoices);
      if (to !== back) return { to };
      approach.begin(actor, 'corridor');
      attackStarted(actor, 'corridor');
      return approach.choose(actor);
    }
    const free = actor.freeMoves > 0;
    if (actor.rule.routes && !actor.route && !free) attackRoutes.select(actor);
    if (reachCheckpoint(actor)) return null;
    if (actor.approach) return approach.choose(actor);
    if (actor.route?.objective === 'closetVent' && actor.position === actor.route.lastReached) return { to: closetVent };
    const to = drawWeighted(random, navigationChoices(actor));
    return { to, stay: to === actor.position, free };
  }

  function cameraObserves(position) {
    return routes.positions.get(position).cameras.includes(input.camera);
  }

  function observed(from, to) {
    return watchingCamera() && (cameraObserves(from) || cameraObserves(to));
  }

  const watchingCamera = () => camerasAvailable() && input.camera && !effects.staticActive(now);

  function isFull(position) {
    const capacity = map.capacities[position];
    if (capacity === undefined) return false;
    // Attacks at the front keep their return slot until they leave the corridor.
    const reserved = position === back ? occupants(front).filter(actor => actor.approach?.objective === 'corridor').length : 0;
    return occupants(position).length + reserved >= capacity;
  }

  function transition(actor, choice, to) {
    const from = actor.position;
    const roomWasEmpty = to === office && officeVacant();
    actor.pending = null;
    if (choice.stationary) actor.stage++;
    else {
      flickerCorridor(from, to);
      actor.previous = from;
      actor.position = to;
      if (actor.rule.initialStationaryAttempts !== undefined && from === actor.rule.start) actor.leftStart = true;
      if (actor.route) actor.route.moves++;
    }
    if (choice.free) actor.freeMoves--;
    if (to === office) actor.due = Infinity;
    approach.arrive(actor);
    const recovered = reachCheckpoint(actor, from);
    if (to !== office && !recovered) schedule(actor);
    emit('move', { actor, from, to });
    if (to === office) {
      const fatal = threats.entryAttacker(actor, roomWasEmpty);
      actor.visibleAt = fatal ? now : invasionRevealTime();
      const attacker = threats.invade(actor, now, actor.visibleAt, roomWasEmpty);
      if (attacker) finish('loss', attacker);
    }
  }

  function maidServiceChoices(actor) {
    if (actor.key !== 'maid' || actor.position !== back) return;
    // A Maid pode desviar para a manutenção antes de iniciar a aproximação central.
    const canEnter = attackRoutes.canNavigate(actor, service) && canUse(actor, routes.connection(back, service));
    return weightedChoices(canEnter ? [back, service] : [back], to =>
      movement.weight * (to === back ? factor(actor.targetBonus) : effects.weight(actor, to, now)));
  }

  function passingAttack(actor) {
    if (!actor.route || actor.approach) return;
    const objective = actor.position === leftApproach ? 'stock' : actor.position === back ? 'corridor' : null;
    if (objective && actor.route.objective !== objective) return objective;
  }

  function startPassingAttack(actor, choice, objective) {
    actor.pending = null;
    actor.route = null;
    actor.retainedRouteMoves = 0;
    if (choice.free) actor.freeMoves--;
    approach.begin(actor, objective);
    attackStarted(actor, objective);
    schedule(actor);
  }

  function attemptConditions(actor, choice) {
    const from = actor.position;
    const to = choice.to;
    const edge = routes.connection(from, to);
    if (!routes.positions.has(from) || !routes.positions.has(to) || !actor.allowed.has(to)
        || (choice.stationary ? to !== from : !canUse(actor, edge))
        || (!choice.stationary && !actor.approach && !attackRoutes.canNavigate(actor, to))) return null;
    const gate = edge?.gateId;
    const watched = observed(from, to);
    return {
      gate, observed: watched,
      staticChance: watched && !choice.rolledStatic && (actor.key !== 'yandere' || cameraObserves(to))
        ? actor.staticChance : undefined,
      doorChance: gates.closed.has(gate) && actor.key === 'padrao' && choice.rolledGate !== gate
        ? actor.doorChance : undefined,
      full: !choice.stationary && isFull(to),
      invasion: from === leftApproach && to === left && occupants(office).length > 0
    };
  }

  function tryPending(actor) {
    const choice = actor.pending;
    const conditions = attemptConditions(actor, choice);
    if (!conditions) {
      choice.reason = 'passagem indisponível';
      return false;
    }
    const { gate, observed, staticChance, doorChance, full, invasion } = conditions;
    if (staticChance !== undefined) {
      choice.rolledStatic = true;
      if (random() * 100 < staticChance) {
        triggerInterference(actor);
      }
    }
    const blockers = [
      observed && !effects.staticActive(now) && 'câmera observada'
    ].filter(Boolean);
    if (!blockers.length && doorChance !== undefined) {
      choice.rolledGate = gate;
      if (random() * 100 < doorChance) {
        gates.open(gate);
        emit('openGate', gate);
      }
    }
    if (gates.closed.has(gate)) {
      blockers.push('porta fechada');
    }
    if (full) blockers.push('posição lotada');
    if (invasion) blockers.push('invasão em andamento');
    if (blockers.length) {
      choice.blockedByGate = gates.closed.has(gate);
      choice.reason = blockers.join(' · ');
      const objective = passingAttack(actor);
      // Na CAM09 ocupada, aguarde a vaga antes de converter o bloqueio em ataque.
      if (objective && !(choice.to === service && full && now < choice.expires)) {
        startPassingAttack(actor, choice, objective);
        return true;
      }
      return false;
    }
    transition(actor, choice, choice.to);
    return true;
  }

  function expire(actor) {
    const { to, free, blockedByGate } = actor.pending;
    actor.pending = null;
    if (free) actor.freeMoves--;
    effects.retain(actor);
    const retainedMoves = actor.route
      ? actor.route.moves * (blockedByGate ? movement.routes.blockedProgressRetention : 0)
      : actor.retainedRouteMoves ?? 0;
    if (blockedOfficeGate(actor, to)) {
      flickerCorridor(front, back);
      actor.previous = front;
      actor.position = back;
      recover(actor);
      actor.retainedRouteMoves = retainedMoves;
      actor.retreat = 'corridor';
      emit('move', { actor, from: front, to: back, retreat: 'corridor' });
      return;
    }
    const previousRoute = actor.route?.id;
    const kind = blockedAttackRetreat(actor);
    if (kind) {
      withdraw(actor, kind, movement.failedIntervalFactor);
      actor.retainedRouteMoves = retainedMoves;
    }
    if (actor.rule.routes && !actor.approach) attackRoutes.select(actor, previousRoute, retainedMoves);
    if (!kind) schedule(actor, movement.failedIntervalFactor);
  }

  function blockedAttackRetreat(actor) {
    if (actor.approach && (actor.rule.routes || actor.approach.surprise || actor.key === 'maid')) return actor.approach.objective;
  }

  const blockedOfficeGate = (actor, to) => actor.approach?.objective === 'corridor'
    && actor.position === front && to === office && gates.closed.has(officeGate);

  function finish(result, source) {
    if (outcome) return;
    outcome = result;
    shadow.stop();
    hallucinations.stop();
    emit(result, source);
  }

  function settle(action) {
    const { computerOn, radioAvailable, flashlightAvailable } = resources.snapshot(now);
    if (action?.type === 'closetEnter' && closetAttack?.phase === 'compromised') {
      finish('loss', closetAttack.actor.key);
      return;
    }
    if (!movementPaused()) {
      const ventOpportunity = !input.smoresLooking
        && (input.leftLook || (input.computer && computerOn) || action?.type === 'closetExit');
      smores.resolve(input, input.radio && radioAvailable, ventOpportunity);
    }
    if (action?.type === 'closetEnter' && !threats.snapshot().hidden && threats.enterCloset(now)) {
      effects.addNoiseEvent('closetEnter', now);
      resources.applyEvent('closetEnter', now);
    }
    if (movementPaused()) return;
    const radio = input.radio && radioAvailable;
    const resolveThreats = () => threats.resolve(now, actor => withdraw(actor, 'office'),
      source => finish('loss', source), radio, flashlightAvailable && input.clownLight);
    resolveThreats();
    if (outcome) return;
    for (const actor of actors) {
      if (actor.pending || moveDue(actor) > now) continue;
      actor.retreat = null;
      const choice = choose(actor);
      if (!choice) continue;
      if (actor.approach || (!choice.stationary && !choice.stay)) flickerCorridor(actor.position, choice.to);
      if (choice.abandon || (actor.key === 'maid' && actor.approach && choice.stay)) {
        withdraw(actor, choice.abandon ?? actor.approach.objective);
        continue;
      }
      if (choice.to === undefined || choice.stay) {
        const objective = choice.stay && passingAttack(actor);
        if (objective) {
          startPassingAttack(actor, choice, objective);
          continue;
        }
        if (choice.free) actor.freeMoves--;
        schedule(actor);
        continue;
      }
      if (actor.key === 'maid' && actor.approach) {
        actor.pending = choice;
        if (!tryPending(actor)) expire(actor);
        if (outcome) return;
      } else {
        actor.pending = { ...choice, expires: now + movement.retryWindow };
      }
    }
    // A traversal, a forced door or the onset of static can release other pending moves.
    let changed;
    do {
      const staticBefore = effects.staticActive(now);
      const gatesBefore = gates.closed.size;
      const signalBefore = camerasAvailable();
      changed = false;
      for (const actor of actors) {
        if (actor.pending && tryPending(actor)) changed = true;
        if (outcome) return;
      }
      changed ||= staticBefore !== effects.staticActive(now) || gatesBefore !== gates.closed.size
        || signalBefore !== camerasAvailable();
    } while (changed && actors.some(actor => actor.pending));
    for (const actor of actors) {
      if (!actor.pending || actor.pending.expires > now) continue;
      expire(actor);
    }
    resolveSurprise();
    if (closetAttack?.phase === 'closetVent') {
      const lit = threats.snapshot().hidden && input.view === 'closet-back'
        && input.closetVentLight && flashlightAvailable;
      closetAttack.litSince = lit ? Math.min(now, closetAttack.litSince) : Infinity;
    }
    if (occupants(office).length) resolveThreats();
    if (outcome) return;
    const available = camerasAvailable();
    if (shadow.update(now, available && input.findShadow !== false ? input.camera : null,
      resources.snapshot(now).blackout)) {
      finish('loss', 'shadow');
    }
    if (!outcome) smores.resolveRoomSound();
  }

  function observeCamera() {
    if (!input.camera || cameraScareEnds !== undefined || !camerasAvailable() || effects.staticActive(now)) return;
    return window.NathGame.cameraObservation(config, cameraActors, { ...input, gates: gates.closed });
  }

  function updateCameraScare(camera, until = now) {
    if (cameraScareEnds !== undefined) {
      if (now >= cameraScareEnds || !resources.computerOn()) {
        const wasOn = resources.computerOn();
        resources.turnComputerOff();
        electrical.powerChanged(wasOn, false);
        cameraScareEnds = undefined;
        emit('cameraScareEnd');
      }
      return cameraScareEnds ?? Infinity;
    }
    const observedCamera = !input.cameraObservationBlocked && camera?.yandereVisible ? input.camera : undefined;
    if (observedCamera !== watchedCamera) {
      watchedCamera = observedCamera;
      watchedSince = now;
    }
    if (!watchedCamera) return Infinity;
    const deadline = watchedSince + cameraScareSeconds;
    // At the exact threshold the player can still break observation.
    if (now < deadline || until <= deadline) return deadline;
    watchedCamera = undefined;
    // Keep the full animation visible when a frame crosses the deadline late.
    cameraScareEnds = until + cameraScare.durationSeconds;
    resources.applyEvent('yandereCameraScare', now);
    emit('cameraScareStart');
    return cameraScareEnds;
  }

  function observeSanity(computerOn, corridorLight, clownLight, camera) {
    return sanityEnabled && window.NathGame.sanityObservation(config, actors, {
      ...input, gates: gates.closed,
      view: !computerOn && input.computer ? 'office' : input.view,
      corridorLight, clownLight, clownStage: threats.clownStage()
    }, camera);
  }

  const noiseInput = (radio, computerOn) => ({ ...input, radio, computer: computerOn && input.computer });

  function integrate(until, camera) {
    const computerOn = resources.computerOn();
    const flashlightAvailable = resources.flashlightAvailable(now);
    const corridorLight = flashlightAvailable && input.corridorLight;
    const clownLight = flashlightAvailable && input.clownLight;
    const effectiveCorridorLight = corridorLight && officeLightAvailable();
    const observation = observeSanity(computerOn, corridorLight, clownLight, camera);
    const previousSanity = resources.snapshot(now).sanity;
    const { end, radio, won } = resources.segment(now, until, input, observation, gates.closed);
    updateSurpriseSanity(previousSanity, resources.snapshot(end).sanity, now, end);
    if (effectiveCorridorLight && !movementPaused()) {
      // Advance the lit actors' timers by dt / factor, in their original time units.
      const extension = (end - now) * (1 - 1 / config.effects.flashlight.corridorIntervalFactor);
      for (const actor of actors) {
        if (!actor.pending && actor.key !== 'gotica' && (actor.position === front || actor.position === back)) {
          actor.due += extension;
        }
      }
    }
    const activeInput = { ...noiseInput(radio, computerOn), corridorLight, clownLight };
    effects.integrate(end - now, { ...activeInput, corridorLight: effectiveCorridorLight });
    if (!movementPaused()) {
      threats.integrate(end - now, activeInput);
      smores.integrate(end - now, radio);
    }
    now = end;
    if (won) finish('win');
  }

  function advance(until, nextInput, action, { hallucinationsAudible = true } = {}) {
    if (outcome || stopped) return;
    until = Math.max(now, until);
    while (now < until) {
      let due = Math.min(until, movementDelay);
      if (!movementPaused()) {
        const radio = input.radio && resources.radioAvailable(now);
        due = Math.min(until, shadow.nextDeadline(), effects.staticDeadline(now), surpriseDeadline(),
          threats.nextDeadline(now, radio, resources.flashlightAvailable(now) && input.clownLight), smores.nextDeadline(now, radio));
        for (const actor of actors) due = Math.min(due, actor.pending?.expires ?? moveDue(actor));
        if (closetAttack?.phase === 'closetVent') {
          due = Math.min(due, closetAttack.due, closetAttack.litSince + closetAttack.lightSeconds);
        }
      }
      const camera = observeCamera();
      const scareDeadline = updateCameraScare(camera, until);
      due = Math.min(due, scareDeadline, hallucinations.nextDeadline());
      // A modifier or a power boundary can leave work due at this instant.
      // Resolve it without integrating backward or skipping intervening events.
      integrate(Math.max(now, due), cameraScareEnds === undefined && camerasAvailable() ? camera : undefined);
      // Resolve elapsed closet time before accepting a light or door action at this instant.
      if (!outcome) resolveClosetVent();
      if (outcome) return;
      if (now < until) {
        settle();
        if (outcome) return;
        hallucinations.resolve(now, resources.snapshot(now).sanity, hallucinationsAudible);
      }
    }
    const current = typeof nextInput === 'function' ? nextInput() : nextInput;
    const flashlightActivated = current?.flashlight && !input.flashlight;
    const computerReturn = input.computerInterface && current?.view === 'office' && !current.computerInterface;
    input = { ...current };
    if (flashlightActivated && resources.flashlightAvailable(now)
        && (input.clownLight || officeLightAvailable())) {
      effects.addNoiseEvent('flashlightOn', now);
    }
    if (action?.type === 'closetEnter') input.smoresLooking = false;
    let accepted = false;
    switch (action?.type) {
      case 'closetExit':
        threats.exitCloset();
        effects.addNoiseEvent('closetExit', now);
        break;
      case 'cameraAudio':
        accepted = camerasAvailable() && effects.startAudio(now, input.camera);
        break;
      case 'gate': {
        const source = input.view === 'cameras' || input.camera ? 'cameras' : action.source;
        accepted = gateControlsAvailable() && gates.toggle(action.id, source, resources.snapshot(now).blackout);
        break;
      }
      case 'computerPower': {
        if (!input.computerInterface || input.view === 'office' || input.closet || cameraScareEnds !== undefined) break;
        const wasOn = resources.computerOn();
        resources.toggleComputer();
        const on = resources.computerOn();
        if (!wasOn && on) effects.addNoiseEvent('computerOn', now);
        if (electrical.powerChanged(wasOn, on)) emit('electricalRestored');
        break;
      }
      case 'returnToOffice': {
        const { sanity, blackout } = resources.snapshot(now);
        if (action.source === 'closet' && input.view === 'office' && !movementPaused()) {
          shadow.returnToOffice(now, 'closet', sanity, blackout);
        }
        break;
      }
    }
    if (computerReturn && !movementPaused()) {
      const { sanity, blackout } = resources.snapshot(now);
      shadow.returnToOffice(now, 'computer', sanity, blackout);
    }
    settle(action);
    if (!outcome) {
      updateCameraScare(observeCamera());
      hallucinations.resolve(now, resources.snapshot(now).sanity, hallucinationsAudible);
    }
    return accepted;
  }

  function cameraActors(camera) {
    const visible = roster.filter(actor => actor.rule.cameras.includes(camera) && routes.positions.get(actor.position).cameras.includes(camera));
    if (camera === 'CAM09' && visible.some(actor => actor.level > 0)) return visible.filter(actor => actor.level > 0);
    return visible;
  }

  function diagnostics() {
    return actors.map(actor => {
      const position = routes.positions.get(actor.position);
      return {
        id: actor.rule.artId, key: actor.key, name: actor.rule.name,
        position: actor.position, level: actor.level, location: position.name,
        camera: position.cameras.join('/') || 'sem câmera',
        previous: routes.positions.get(actor.previous)?.name,
        destination: routes.positions.get(actor.pending?.to)?.name,
        remaining: Math.max(0, (actor.pending?.expires ?? moveDue(actor)) - Math.max(now, movementDelay)),
        stopped: actor.pending?.reason ?? (actor.position === office ? 'invasão' : 'intervalo'),
        route: actor.route?.id ?? null, lastRoute: actor.lastRoute,
        objective: actor.approach?.objective ?? actor.route?.objective ?? null,
        checkpoint: attackRoutes.checkpoint(actor) ?? null, routeCompleted: actor.route?.completed ?? false,
        required: actor.route?.required ?? null, lastReached: actor.route?.lastReached ?? null,
        routeBonus: navigationBonus(actor), approach: actor.approach?.phase ?? null,
        freeMoves: actor.freeMoves, intervalPenalty: actor.intervalPenalty,
        light: actor.light, noise: actor.noise, audioCamera: effects.audioStimulus(actor, now)?.camera ?? null
      };
    });
  }

  function attemptOdds(actor, choice) {
    const conditions = attemptConditions(actor, choice);
    if (!conditions) return { pass: 0, reasons: ['passagem indisponível'] };
    const { gate, observed, staticChance, doorChance, full, invasion } = conditions;
    const reasons = [
      observed && 'câmera observada',
      gates.closed.has(gate) && gate, full && 'posição lotada', invasion && 'invasão em andamento'
    ].filter(Boolean);
    const signalOdds = observed ? (staticChance ?? 0) / 100 : 1;
    const gateOdds = gates.closed.has(gate) ? (doorChance ?? 0) / 100 : 1;
    return { pass: full || invasion ? 0 : signalOdds * gateOdds, reasons };
  }

  function addOdds(odds, label, probability) {
    if (probability > 0) odds[label] = (odds[label] ?? 0) + probability;
  }

  function addAttempt(odds, actor, choice, probability) {
    const { pass, reasons } = attemptOdds(actor, choice);
    const destination = routes.positions.get(choice.to)?.name;
    const attacker = choice.to === office && threats.entryAttacker(actor, officeVacant());
    const label = attacker === 'palhaca' ? 'Jumpscare da Palhaça'
      : attacker ? `${destination} (invasão letal)` : destination;
    addOdds(odds, choice.stationary ? 'Ficar' : label, probability * pass);
    const objective = passingAttack(actor);
    const converts = objective && !(choice.to === service && isFull(service));
    addOdds(odds, `Bloqueio em ${destination} (${reasons.join(', ')})${converts ? ` → ${attackLabel(objective)}` : ''}`,
      probability * (1 - pass));
  }

  const attackLabel = objective => objective === 'stock' ? 'atacar pela esquerda' : 'atacar pelo corredor';

  function addRetreat(odds, actor, kind, probability) {
    const { items, weights, total } = retreatChoices(actor, kind);
    if (!total) addOdds(odds, 'Ficar (recuo sem destino)', probability);
    items.forEach((id, index) => addOdds(odds, `Recuar para ${routes.positions.get(id).name}`, probability * weights[index] / total));
  }

  function plannedOdds(odds, actor, probability) {
    if (actor.stage < actor.rule.initialStationaryAttempts) {
      addAttempt(odds, actor, { to: actor.position, stationary: true }, probability);
      return;
    }
    if (!actor.approach && actor.key === 'maid' && actor.position === back) {
      const { items, weights, total } = maidServiceChoices(actor);
      if (items.includes(service)) addAttempt(odds, actor, { to: service }, probability * weights[1] / total);
      probability *= weights[0] / total;
      actor = { ...actor };
      approach.begin(actor, 'corridor');
    }
    if (!actor.approach && attackRoutes.checkpoint(actor) === actor.position) {
      // Advance an independent route cursor exactly as choose() does.
      actor = { ...actor, route: { ...actor.route } };
      if (attackRoutes.reach(actor)) {
        if (actor.route.objective === 'electrical') {
          addOdds(odds, 'Ficar (ação na elétrica)', probability);
          return;
        }
        approach.begin(actor, actor.route.objective);
      }
    }
    if (actor.approach) {
      const { to, objective, advance, stay, abandon } = approach.options(actor);
      addAttempt(odds, actor, { to }, probability * advance);
      if (actor.key !== 'maid') addOdds(odds, 'Ficar', probability * stay);
      addRetreat(odds, actor, objective, probability * (abandon + (actor.key === 'maid' ? stay : 0)));
      return;
    }
    if (actor.route?.objective === 'closetVent' && actor.position === actor.route.lastReached) {
      addAttempt(odds, actor, { to: closetVent }, probability);
      return;
    }
    if (actor.route?.counterattack) {
      addAttempt(odds, actor, { to: attackRoutes.checkpoint(actor) }, probability);
      return;
    }
    const { items, weights, total } = navigationChoices(actor);
    if (!total) addOdds(odds, 'Ficar', probability);
    items.forEach((to, index) => {
      const share = total ? probability * weights[index] / total : 0;
      if (to === actor.position) {
        const objective = passingAttack(actor);
        addOdds(odds, objective ? `Ficar → ${attackLabel(objective)}` : 'Ficar', share);
      } else if (share > 0) addAttempt(odds, actor, { to }, share);
    });
  }

  function actorDebug(actor) {
    const { pending, position } = actor;
    const odds = { Ficar: 0 };
    const expiryOdds = {};
    const attackActive = Boolean(actor.approach) && !outcome;
    let status;
    let target;
    let attackOdds = null;
    if (attackActive && position !== office) {
      const options = pending ? { to: pending.to, advance: 1, stay: 0, abandon: 0 } : approach.options(actor);
      const { pass } = attemptOdds(actor, pending ?? { to: options.to });
      const instant = actor.key === 'maid';
      attackOdds = { advance: options.advance * pass, stay: instant ? 0 : options.stay,
        abandon: options.abandon + (instant ? options.stay : 0), blocked: options.advance * (1 - pass) };
    }
    const selections = actor.level && actor.rule.routes && !outcome && position !== closetVent
      ? attackRoutes.selectionOdds(actor) : [];
    if (!actor.level || outcome) {
      status = actor.level ? 'turno encerrado' : 'parada · nível 0';
      addOdds(odds, 'Ficar', 1);
    } else if (position === closetVent) {
      status = closetAttack.phase === 'compromised' ? 'armário comprometido'
        : `ventilação do armário · ${Math.max(0, closetAttack.due - now).toFixed(1)} s`;
      addOdds(odds, 'Ficar', 1);
    } else if (position === office) {
      const invasion = threats.invasionStatus(actor, now);
      status = invasion?.retreat ? `invasão · recuo em ${invasion.remaining.toFixed(1)} s`
        : invasion ? `invasão · ataque em ${invasion.remaining.toFixed(1)} s` : 'invasão';
      if (invasion?.retreat) addRetreat(odds, actor, 'office', 1);
      else addOdds(odds, 'Ficar', 1);
    } else if (pending) {
      target = pending.to;
      status = `bloqueada · ${pending.reason} · ${Math.max(0, pending.expires - now).toFixed(1)} s`;
      addAttempt(odds, actor, pending, 1);
      const kind = blockedAttackRetreat(actor);
      const objective = passingAttack(actor);
      if (objective && target === service && isFull(service)) {
        addOdds(expiryOdds, attackLabel(objective), 1);
      } else if (blockedOfficeGate(actor, target)) {
        addOdds(expiryOdds, `Recuar para ${routes.positions.get(back).name}`, 1);
      } else if (kind) {
        addRetreat(expiryOdds, actor, kind, 1);
      } else if (!actor.approach) {
        for (const { route, probability } of attackRoutes.selectionOdds(actor, actor.route?.id)) {
          addOdds(expiryOdds, route.id, probability);
        }
        if (!Object.keys(expiryOdds).length) addOdds(expiryOdds, 'Ficar', 1);
      } else addOdds(expiryOdds, 'Ficar', 1);
    } else {
      const remaining = Math.max(0, moveDue(actor) - now).toFixed(1);
      const phase = actor.retreat ? 'recuou · recuperação' : actor.approach?.phase === 'entry' ? 'entrada'
        : actor.approach ? 'aproximação'
        : actor.freeMoves ? 'movimento livre' : movementPaused() ? 'pausa inicial'
        : actor.stage < actor.rule.initialStationaryAttempts ? 'parada inicial' : 'aguardando tentativa';
      status = `${phase} · ${remaining} s`;
      target = actor.approach ? approach.options(actor).to : navigationTarget(actor);
      if (actor.rule.routes && !actor.route && !actor.approach && !actor.freeMoves) {
        if (!selections.length) plannedOdds(odds, actor, 1);
        for (const { route, probability } of selections) plannedOdds(odds, { ...actor, route }, probability);
      } else plannedOdds(odds, actor, 1);
    }
    const routeOdds = Object.fromEntries(selections.map(({ route, probability }) => [route.id, probability]));
    return { key: actor.key, name: actor.rule.name, position, level: actor.level, location: routes.positions.get(position).name,
      route: actor.rule.routes ? (actor.route?.id ?? 'A sortear') : 'Sem rota',
      routeOdds, required: actor.route?.required, lastReached: actor.route?.lastReached,
      completed: actor.route?.completed, bonus: actor.level ? effectiveNavigationBonus(actor) : null,
      target, status, odds, expiryOdds, attackActive, attackPath: actor.approach?.objective ?? null,
      noise: actor.noise ?? 0, light: actor.light ?? 0, attackOdds,
      audio: effects.audioStimulus(actor, now),
      invasions: threats.invasionCount(actor),
      instantInvasion: actor.level > 0 && !outcome && position !== office && threats.instantInvasion(actor),
      reaction: actor.level ? threats.invasionStatus(actor, now)?.reaction ?? threats.reactionTime(actor) : null };
  }

  function debugSnapshot() {
    const radio = input.radio && resources.radioAvailable(now);
    const clownLight = input.clownLight && resources.flashlightAvailable(now);
    return {
      actors: roster.map(actorDebug),
      clown: { ...threats.snapshot(), max: config.threats.clown.max, status: threats.clownStatus(radio, clownLight) },
      smores: smores.diagnostics(radio)
    };
  }

  function hudSnapshot() {
    const computerOn = resources.computerOn();
    const lightAvailable = resources.flashlightAvailable(now);
    const observation = observeSanity(computerOn, lightAvailable && input.corridorLight, lightAvailable && input.clownLight, observeCamera());
    const frame = resources.snapshot(now, input, observation, gates.closed);
    return { ...frame, noiseIntensity: outcome ? 0 : effects.noiseIntensity(now,
      noiseInput(input.radio && frame.radioAvailable, computerOn)) };
  }

  reset();
  return {
    reset, advance, cameraActors, diagnostics, debugSnapshot,
    interruptCameraObservation() {
      watchedCamera = undefined;
      input.cameraObservationBlocked = true;
    },
    stop() {
      stopped = true;
      shadow.stop();
      hallucinations.stop();
      watchedCamera = watchedSince = cameraScareEnds = undefined;
    },
    isGateClosed: id => gates.closed.has(id),
    electricalFault: () => electrical.failed(), gateControlsAvailable,
    camerasAvailable, flashlightAvailable: () => resources.flashlightAvailable(now),
    officeState() {
      const phase = smores.phase();
      const invaders = occupants(office);
      return {
        smores: phase,
        smoresVisible: phase === 'room' && now >= smoresVisibleAt,
        room: invaders.filter(actor => now >= actor.visibleAt).map(actor => actor.rule.artId),
        invasionActive: phase === 'room' || invaders.length > 0,
        flash: now < flashUntil,
        doorway: occupants(left)[0]?.rule.artId ?? null,
        front: occupants(front).map(actor => actor.rule.artId),
        back: occupants(back).map(actor => actor.rule.artId)
      };
    },
    snapshot: ({ hud = false } = {}) => ({ now, outcome, ...(hud ? hudSnapshot() : resources.snapshot(now)),
      shadow: shadow.snapshot(), ...threats.snapshot(), closetVent: closetAttack?.phase ?? null,
      electricalFault: electrical.failed(),
      audio: effects.audioStatus(now), static: effects.staticActive(now), hallucination: hallucinations.visual(now) })
  };
}

window.NathGame.createMovement = createMovement;
})();
