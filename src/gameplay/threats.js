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
        emit('defended', { key: 'smores', reason: 'vent' });
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
  let clownFinaleAt = Infinity;
  let lastOfficeExit = -Infinity;

  const invasionCount = actor => invasionCounts.get(actor.key) ?? 0;
  const instantInvasion = (actor, previous = invasionCount(actor)) => actor.key !== 'padrao' && previous >= 2;
  const entryAttacker = (actor, roomWasEmpty, now = 0) => instantInvasion(actor) ? actor.key
    : hidden && roomWasEmpty && now - lastOfficeExit >= 3 ? 'palhaca' : null;
  const officeExited = now => { lastOfficeExit = now; };

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
    if (!peaceful && clownEnabled && clownFinaleAt === Infinity && counter > clown.entryDeathAbove) {
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
    const attacker = entryAttacker(actor, roomWasEmpty, now);
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
    if (!clownEnabled || clownFinaleAt !== Infinity) return;
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
    if (clownFinaleAt !== Infinity) return clownFinaleAt;
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
    if (clownEnabled && (clownDeath || now >= clownFinaleAt)) return lose('palhaca');
    if (clownEnabled && clownFinaleAt === Infinity
        && (clown.max - counter <= Number.EPSILON * clown.max || clownDeadline(now, radio, light) <= now)) {
      counter = clown.max;
      clownFinaleAt = now + uniform(random, clown.finaleSeconds);
      emit('clownFinale');
    }
    for (const [actor, invasion] of invasions) {
      if (!hidden && now >= reactionDeadline(actor, invasion)) return lose(actor.key);
      if (hidden && now >= invasion.leaveAt) {
        invasions.delete(actor);
        officeExited(now);
        retreat(actor);
        if (invasions.size === 0) emit('fearRecovery');
      }
    }
  }

  const clownStage = () => clownFinaleAt !== Infinity ? -1
    : clownEnabled ? clown.stages.findLastIndex(threshold => counter >= threshold) : -1;
  return {
    enterCloset, exitCloset: () => { hidden = false; },
    delayReactions(seconds) {
      for (const invasion of invasions.values()) invasion.arrived += seconds;
    },
    invade, officeExited, integrate, nextDeadline, resolve, clownStage, reactionTime, invasionCount, instantInvasion, entryAttacker,
    snapshot: () => ({ hidden, counter, floor, clownStage: clownStage(),
      clownFinale: clownFinaleAt !== Infinity, clownFinaleAt }),
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
  const duration = actor => rules.durationOverrides?.[actor.key] ?? rules.durationSeconds ?? 24;
  const advancedProgress = rules.advancedProgress;

  function begin(actor, objective) {
    if (actor.position !== stages[objective]?.[0]) return false;
    actor.light = 0;
    actor.goticaExposure = 0;
    actor.approach = { objective, phase: 'attack', progress: 0, elapsed: 0, advanced: false };
    actor.due = Infinity;
    return true;
  }

  function options(actor, dt = 0, atEnd = false) {
    const attack = actor.approach;
    return { to: stages[attack.objective][actor.position === stages[attack.objective][0] ? 1 : 2],
      ...effects.attackBar(actor, attack.objective, observingLeft(), currentTime(), dt, atEnd) };
  }

  function progressAfter(actor, dt) {
    const start = actor.approach.progress;
    const delta = options(actor, dt).speed * dt;
    // Reflect at zero even if a decaying stimulus changes the sign inside a frame.
    if (options(actor).speed < 0 && options(actor, dt, true).speed > 0) {
      let low = 0, high = dt;
      for (let i = 0; i < 32; i++) {
        const mid = (low + high) / 2;
        if (options(actor, mid, true).speed < 0) low = mid;
        else high = mid;
      }
      const minimum = start + options(actor, high).speed * high;
      return Math.max(0, start + delta - Math.min(0, minimum));
    }
    return Math.max(0, start + delta);
  }

  function risingWindow(actor, dt) {
    if (!(options(actor).speed > 0 && options(actor, dt, true).speed < 0)) return dt;
    let low = 0, high = dt;
    for (let i = 0; i < 32; i++) {
      const mid = (low + high) / 2;
      if (options(actor, mid, true).speed > 0) low = mid;
      else high = mid;
    }
    return high;
  }

  function completed(actor) {
    return actor.approach && actor.approach.phase !== 'invasion' && actor.approach.progress >= 100 - 1e-9;
  }

  function expired(actor) {
    return actor.approach && actor.approach.phase !== 'invasion' && !completed(actor)
      && actor.approach.elapsed >= duration(actor) - 1e-9;
  }

  function integrate(actor, dt) {
    const attack = actor.approach;
    if (!attack || attack.phase === 'invasion' || completed(actor) || dt <= 0) return;
    dt = Math.min(dt, Math.max(0, duration(actor) - attack.elapsed));
    const rising = risingWindow(actor, dt);
    if (progressAfter(actor, rising) >= 100) {
      let low = 0, high = rising;
      for (let i = 0; i < 40; i++) {
        const mid = (low + high) / 2;
        if (progressAfter(actor, mid) >= 100) high = mid;
        else low = mid;
      }
      dt = high;
    }
    attack.progress = Math.min(100, progressAfter(actor, dt));
    attack.elapsed += dt;
    // One-way visual latch avoids flicker when defenses regress the same bar.
    if (attack.progress >= advancedProgress - 1e-9) attack.advanced = true;
  }

  function nextDeadline(actor, now) {
    const attack = actor.approach;
    if (!attack || attack.phase === 'invasion' || completed(actor)) return Infinity;
    let dt = Math.min(rules.stepSeconds ?? .1, Math.max(0, duration(actor) - attack.elapsed));
    const warning = rules.warningProgress;
    const target = !attack.advanced ? advancedProgress
      : actor.key === 'padrao' && warning && !attack.warningReported && attack.progress < warning - 1e-9 ? warning : 100;
    const rising = risingWindow(actor, dt);
    if (progressAfter(actor, rising) >= target) {
      let low = 0, high = rising;
      for (let i = 0; i < 32; i++) {
        const mid = (low + high) / 2;
        if (progressAfter(actor, mid) >= target) high = mid;
        else low = mid;
      }
      dt = high;
    }
    return now + dt;
  }

  function arrive(actor) {
    if (actor.approach && actor.position === map.office) actor.approach.phase = 'invasion';
  }

  return { begin, options, integrate, completed, expired, arrive, nextDeadline, duration };
}

Object.assign(window.NathGame, { createThreats, createSmores, createApproach });
})();
