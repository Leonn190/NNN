(() => {
'use strict';

const { uniform, difficultyProgress, interpolate } = window.NathGame;

function createSmores(rules, level, maxLevel, random, emit) {
  if (!rules || level <= 0) return {
    integrate() {}, resolve() {}, resolveRoomSound() {}, nextDeadline: () => Infinity, phase: () => 'idle',
    diagnostics: () => ({ phase: 'disabled' }),
    intervalReduction: () => 0, reactionReduction: () => 0, targetBonusMultiplier: () => 1
  };

  const progress = difficultyProgress(level, maxLevel);
  const { ventChance, roomSeconds, intervalReduction, reactionReduction } = Object.fromEntries(
    Object.entries(rules.level1).map(([key, value]) => [key, interpolate([value, rules.maxLevel[key]], progress)])
  );
  const tolerance = 1e-9;
  const roomSpeed = radio => radio ? 1 : rules.quietRoomSpeed;
  let phase = 'idle';
  let radioTime = 0;
  let radioOffTime = 0;
  let radioOffLimit;
  let radioWasOn = false;
  let silenceTime = 0;
  let ignoredTime = 0;
  let retreatReady = false;
  let looking = false;
  let roomRemaining = 0;
  let roomSoundRemaining = Infinity;
  const entrySeconds = rules.ignoredSeconds + rules.finalSeconds;

  function setPhase(next) {
    phase = next;
    radioWasOn = false;
    roomSoundRemaining = next === 'room' ? rules.roomSoundSeconds : Infinity;
    emit('smores', phase);
  }

  function updateRadioReset(radio) {
    if (radio) {
      radioOffTime = 0;
      radioOffLimit = undefined;
    } else if (radioWasOn) {
      radioOffLimit = uniform(random, rules.radioResetSeconds);
    }
    radioWasOn = Boolean(radio);
  }

  function integrate(dt, radio) {
    if (phase === 'idle') {
      updateRadioReset(radio);
      if (radio) {
        radioTime += dt;
      } else if (radioTime > 0) {
        radioOffTime += dt;
        if (radioOffTime >= radioOffLimit - tolerance) radioTime = 0;
      }
    }
    if (phase === 'vent') {
      if (!looking) ignoredTime += dt;
      if (!retreatReady) {
        silenceTime = radio ? 0 : silenceTime + dt;
        retreatReady = silenceTime >= rules.silenceSeconds - tolerance;
      }
    }
    if (phase === 'room') {
      roomRemaining -= dt * roomSpeed(radio);
      roomSoundRemaining -= dt;
    }
  }

  function nextDeadline(now, radio) {
    if (phase === 'idle' && radio) return now + (rules.radioSeconds - radioTime);
    if (phase === 'idle' && radioTime > 0 && radioOffLimit !== undefined) return now + (radioOffLimit - radioOffTime);
    if (phase === 'vent' && !looking) {
      const threshold = ignoredTime < rules.ignoredSeconds - tolerance ? rules.ignoredSeconds : entrySeconds;
      return now + Math.max(0, threshold - ignoredTime);
    }
    if (phase === 'room') return now + Math.min(roomRemaining / roomSpeed(radio), roomSoundRemaining);
    return Infinity;
  }

  function resolve(input, radio, ventOpportunity) {
    if (phase === 'idle') {
      if (radioTime >= rules.radioSeconds - tolerance) {
        radioTime = 0;
        if (random() * 100 < ventChance) setPhase('pre-vent');
      }
      updateRadioReset(radio);
    }
    if (phase === 'pre-vent') {
      if (ventOpportunity) {
        looking = Boolean(input.smoresLooking);
        silenceTime = 0;
        ignoredTime = 0;
        retreatReady = false;
        setPhase('vent');
      }
      return;
    }
    if (phase === 'vent') {
      if (radio) silenceTime = 0;
      const lookedAway = looking && !input.smoresLooking;
      if (ignoredTime >= entrySeconds - tolerance || (lookedAway && !retreatReady && radio)) {
        roomRemaining = roomSeconds;
        setPhase('room');
      } else if (lookedAway && retreatReady) {
        setPhase('idle');
      }
      looking = Boolean(input.smoresLooking);
      if (looking) ignoredTime = 0;
    } else if (phase === 'room' && roomRemaining <= tolerance) {
      setPhase('idle');
    }
  }

  return {
    integrate, nextDeadline, resolve, phase: () => phase,
    resolveRoomSound() {
      if (phase !== 'room' || roomSoundRemaining > tolerance) return;
      roomSoundRemaining += rules.roomSoundSeconds;
      if (random() < rules.roomSoundChance) emit('smoresRoomSound');
    },
    diagnostics: radio => ({
      phase, looking, retreatReady, radio,
      ignoredRemaining: phase === 'vent' && !looking ? Math.max(0, entrySeconds - ignoredTime) : null,
      finalApproach: phase === 'vent' && ignoredTime >= rules.ignoredSeconds - tolerance,
      remaining: phase === 'idle' && radio ? Math.max(0, rules.radioSeconds - radioTime)
        : phase === 'vent' ? Math.max(0, rules.silenceSeconds - silenceTime)
        : phase === 'room' ? Math.max(0, roomRemaining / roomSpeed(radio)) : null
    }),
    intervalReduction: () => phase === 'room' ? intervalReduction : 0,
    reactionReduction: () => phase === 'room' ? reactionReduction : 0,
    targetBonusMultiplier: () => phase === 'room' ? rules.targetBonusMultiplier : 1
  };
}

function createThreats(config, levels, random, emit, reactionReduction = () => 0, maxLevel = config.night.levels[1]) {
  const { attack, clown } = config.threats;
  const clownEnabled = levels.palhaca > 0;
  const growth = interpolate(clown.growth, difficultyProgress(levels.palhaca, maxLevel));
  const invasions = new Map();
  const invasionCounts = new Map();
  const thresholds = [];
  let hidden = false;
  let counter = clownEnabled ? clown.initial : 0;
  let floor = clownEnabled ? clown.min : 0;
  let entries = 0;
  let clownDeath = false;

  const invasionCount = actor => invasionCounts.get(actor.key) ?? 0;
  const instantInvasion = (actor, previous = invasionCount(actor)) => actor.key !== 'padrao' && previous >= 2;
  const entryAttacker = (actor, roomWasEmpty) => instantInvasion(actor) ? actor.key
    : hidden && roomWasEmpty ? 'palhaca' : null;

  function reactionTime(actor, previous = invasionCount(actor)) {
    if (instantInvasion(actor, previous)) return 0;
    const multiplier = previous === 0 ? 1 : Math.max(attack.padraoMinReactionFactor,
      attack.secondReactionFactor - (previous - 1) * attack.padraoReactionStep);
    const seconds = actor.reaction * multiplier - reactionReduction();
    const minimum = actor.key === 'padrao' ? actor.reaction * attack.padraoMinReactionFactor : 0;
    return Number.isFinite(seconds) ? Math.max(minimum, seconds) : 0;
  }

  const reactionDeadline = (actor, invasion) => invasion.arrived + reactionTime(actor, invasion.previous);

  function protect(invasion, now) {
    const late = reactionDeadline(invasion.actor, invasion) - now <= attack.lateThreshold;
    const stay = late ? attack.lateStay : attack.stay;
    invasion.leaveAt = Math.max(now, invasion.arrived + stay + uniform(random, attack.jitter));
  }

  function enterCloset(now, peaceful = false) {
    if (!peaceful && clownEnabled && counter > clown.entryDeathAbove) {
      clownDeath = true;
      return false;
    }
    hidden = true;
    if (!peaceful && clownEnabled) {
      const threshold = Math.min(clown.max, ++entries * clown.floorPerEntry);
      if (!thresholds.includes(threshold)) thresholds.push(threshold);
    }
    for (const invasion of invasions.values()) if (invasion.leaveAt === null) protect(invasion, now);
    return true;
  }

  function invade(actor, now, visibleAt = now, roomWasEmpty = invasions.size === 0) {
    if (invasions.has(actor)) return;
    const previous = invasionCount(actor);
    const attacker = entryAttacker(actor, roomWasEmpty);
    invasionCounts.set(actor.key, previous + 1);
    if (attacker === 'palhaca') clownDeath = true;
    if (attacker) return attacker;
    const invasion = { actor, arrived: visibleAt, previous, leaveAt: null };
    invasions.set(actor, invasion);
    if (hidden) protect(invasion, now);
    emit('invasion', actor);
  }

  function clownRate(radio, light) {
    const factor = hidden ? (light ? clown.litClosetGrowthFactor : clown.closetGrowthFactor) : Number(!radio);
    return growth * factor - (radio ? clown.musicReduction : 0);
  }

  function integrate(dt, input) {
    if (!clownEnabled) return;
    const rate = clownRate(input.radio, input.clownLight);
    let next = Math.max(floor, Math.min(clown.max, counter + dt * rate));
    if (rate > 0 && counter < clown.warningAt && clown.warningAt - next <= 1e-9) {
      next = Math.max(next, clown.warningAt);
      emit('clownWarning');
    }
    for (const threshold of thresholds) {
      if (counter <= threshold && next > threshold) floor = Math.max(floor, threshold);
    }
    counter = next;
  }

  function clownDeadline(now, radio, light) {
    const rate = clownEnabled ? clownRate(radio, light) : 0;
    return rate > 0 ? now + (clown.max - counter) / rate : Infinity;
  }

  function nextDeadline(now, radio, light) {
    let due = clownDeadline(now, radio, light);
    if (clownEnabled && counter < clown.warningAt) {
      const rate = clownRate(radio, light);
      if (rate > 0) due = Math.min(due, now + (clown.warningAt - counter) / rate);
    }
    for (const [actor, invasion] of invasions) {
      due = Math.min(due, hidden ? invasion.leaveAt : reactionDeadline(actor, invasion));
    }
    return due;
  }

  function resolve(now, retreat, lose, radio, light) {
    if (clownEnabled && (clownDeath || clown.max - counter <= Number.EPSILON * clown.max
        || clownDeadline(now, radio, light) <= now)) return lose('palhaca');
    for (const [actor, invasion] of invasions) {
      if (!hidden && now >= reactionDeadline(actor, invasion)) return lose(actor.key);
      if (hidden && now >= invasion.leaveAt) {
        invasions.delete(actor);
        retreat(actor);
      }
    }
  }

  const clownStage = () => clownEnabled ? clown.stages.findLastIndex(threshold => counter >= threshold) : -1;
  return {
    enterCloset, exitCloset: () => { hidden = false; },
    delayReactions(seconds) {
      for (const invasion of invasions.values()) invasion.arrived += seconds;
    },
    invade, integrate, nextDeadline, resolve, clownStage, reactionTime, invasionCount, instantInvasion, entryAttacker,
    snapshot: () => ({ hidden, counter, floor, clownStage: clownStage() }),
    invasionStatus(actor, now) {
      const invasion = invasions.get(actor);
      if (!invasion) return null;
      const deadline = hidden ? invasion.leaveAt : reactionDeadline(actor, invasion);
      return { retreat: hidden, remaining: Math.max(0, deadline - now), reaction: reactionTime(actor, invasion.previous) };
    },
    clownStatus: (radio, light) => clownDeath || counter >= clown.max ? 'ataque'
      : !clownEnabled ? 'dormindo'
      : clownRate(radio, light) > 0 ? (hidden && light ? 'avançando sob a lanterna' : 'avançando')
      : clownRate(radio, light) < 0 && counter > floor ? 'recuando com a música' : 'no piso'
  };
}

function createApproach(map, effects, random, observingLeft = () => false, currentTime = () => 0, rules = {}) {
  const stages = {
    corridor: [map.back, map.front, map.office],
    stock: [map.leftApproach, map.left, map.office]
  };
  const fullSeconds = rules.secondsAtFull ?? 7;
  const limit = rules.maxPhaseSeconds ?? 55;
  const stallLimit = rules.stallSeconds ?? 15;

  function begin(actor, objective) {
    if (actor.position !== stages[objective][0]) return false;
    actor.light = 0;
    actor.approach = { objective, phase: 'approach', progress: 0, elapsed: 0, stalled: 0 };
    actor.due = Infinity;
    return true;
  }

  function options(actor) {
    const { objective, phase, progress } = actor.approach;
    return { to: stages[objective][phase === 'approach' ? 1 : 2], objective, progress,
      ...effects.attackBar(actor, objective, phase, observingLeft(), currentTime()) };
  }

  function integrate(actor, dt) {
    if (!actor.approach || actor.approach.phase === 'invasion' || dt <= 0) return;
    const { intensity, progressPerSecond } = options(actor);
    const speed = intensity * 100 / fullSeconds + progressPerSecond;
    const attack = actor.approach;
    const previous = attack.progress;
    attack.progress = Math.min(100, Math.max(0, previous + dt * speed));
    attack.elapsed += dt;
    attack.stalled = Math.abs(attack.progress - previous) < 1e-9 ? attack.stalled + dt : 0;
  }

  function completed(actor) {
    return actor.approach && actor.approach.phase !== 'invasion' && actor.approach.progress >= 100 - 1e-9;
  }

  function expired(actor) {
    return actor.approach && actor.approach.phase !== 'invasion'
      && (actor.approach.elapsed >= (actor.approach.phase === 'entry' ? rules.maxEntrySeconds ?? limit : limit)
        || actor.approach.stalled >= stallLimit);
  }

  function arrive(actor) {
    if (!actor.approach) return;
    if (actor.position === map.office) actor.approach.phase = 'invasion';
    else if (actor.position === stages[actor.approach.objective][1]) {
      Object.assign(actor.approach, { phase: 'entry', progress: 0, elapsed: 0, stalled: 0 });
      actor.due = Infinity;
    }
  }

  return { begin, options, integrate, completed, expired, arrive };
}

Object.assign(window.NathGame, { createThreats, createSmores, createApproach });
})();
