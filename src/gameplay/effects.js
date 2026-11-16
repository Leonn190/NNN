(() => {
'use strict';

const { factor } = window.NathGame;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function createEffects(config, routes, actors) {
  const { cameraAudio, flashlight, noise } = config.effects;
  const noiseRates = Object.entries(noise.rates);
  const { front, back } = config.map;
  const corridor = [front, back];
  let audio;
  let readyAt = 0;
  let staticUntil = 0;
  let volumePeak = 0;
  let volumePeakAt = 0;
  const transientVolume = now => volumePeak * Math.exp(-(now - volumePeakAt) / .22);
  const activeAudio = (actor, now = 0) => actor.audioStimulus && now < actor.audioStimulus.ends
    ? actor.audioStimulus : null;
  const audibleNeighbors = actor => routes.neighbors.get(actor.position).filter(to => {
    const edge = routes.connection(actor.position, to);
    return actor.allowed.has(to) && (!edge.actors || edge.actors.includes(actor.key));
  });

  function startAudio(now, camera) {
    if (!camera || now < readyAt) return false;
    const origins = [...routes.positions.values()].filter(p => p.cameras.includes(camera)).map(p => p.id);
    const distance = routes.distances(origins, () => true, cameraAudio.factors.length - 1, undefined, true);
    const stimulus = { camera, distance, ends: now + cameraAudio.duration };
    audio = stimulus;
    readyAt = now + cameraAudio.cooldown;
    for (const actor of actors) {
      const fromDistance = distance.get(actor.position) ?? Infinity;
      actor.audioStimulus = fromDistance === 0
        || audibleNeighbors(actor).some(to => (distance.get(to) ?? Infinity) < fromDistance)
        ? stimulus : null;
    }
    return true;
  }

  function addNoise(actor, amount) {
    actor.noise = clamp(actor.noise + amount, 0, noise.max);
  }

  const noiseMultiplier = actor => actor.approach.objective === 'corridor' ? noise.corridorMultiplier : 1;

  function noiseRate(input) {
    let rate = 0;
    for (const [key, value] of noiseRates) if (input[key]) rate += value;
    return rate;
  }

  function integrate(dt, input) {
    const equilibrium = noiseRate(input) * noise.max / noise.decay;
    const blend = -Math.expm1(-dt * noise.decay / noise.max);
    for (const actor of actors) {
      if (!actor.approach) continue;
      addNoise(actor, (equilibrium * noiseMultiplier(actor) - actor.noise) * blend);
      const light = flashlight.modifiers[actor.key];
      if (!light) continue;
      const lit = actor.approach.objective === 'corridor' && input.corridorLight && corridor.includes(actor.position);
      const lightRate = lit ? 1 / light.secondsToMax : -flashlight.decayPerSecond;
      actor.light = clamp(actor.light + lightRate * dt, 0, 1);
    }
  }

  function attackAudio(actor, objective, now) {
    const stimulus = activeAudio(actor, now);
    if (!stimulus) return { retreat: 0, stay: 0 };
    const distance = stimulus.distance;
    const from = distance.get(actor.position) ?? Infinity;
    const modifier = (actor.rule.audioModifier ?? 0) / 100;
    const intensity = cameraAudio.factors[from] ?? 0;
    const retreat = config.movement.retreat[objective].some(to => actor.allowed.has(to)
      && (modifier > 0 ? (distance.get(to) ?? Infinity) < from
        : modifier < 0 && (distance.get(to) ?? Infinity) > from));
    return {
      retreat: retreat ? Math.min(.04, Math.abs(modifier) * .05 * intensity) : 0,
      stay: from === 0 ? modifier * .12 : 0
    };
  }

  function attackOdds(actor, objective, phase, leftLook, now = 0) {
    const { corridor, stock, stayShare } = config.movement.attack;
    const [quiet, loud] = (objective === 'corridor' ? corridor[actor.key] : stock)[phase];
    const intensity = clamp(actor.noise / noise.max, 0, 1);
    const light = objective === 'corridor' && actor.light > 0 && flashlight.modifiers[actor.key];
    const doorObserved = objective === 'stock' && leftLook;
    const modifier = doorObserved ? -stock.observationPenalty : light ? light.advanceDelta * actor.light : 0;
    const minimum = doorObserved ? stock.minimumObservedAdvance : light ? flashlight.minimumAdvance : 0;
    const audioEffect = attackAudio(actor, objective, now);
    const advance = clamp(quiet + (loud - quiet) * intensity + modifier - audioEffect.retreat,
      minimum, light ? flashlight.maximumAdvance : 1);
    const failure = 1 - advance;
    const share = clamp(stayShare + audioEffect.stay, 0, 1);
    return { advance, stay: failure * share, abandon: failure * (1 - share) };
  }

  function stayWeight(actor, now = 0) {
    const stimulus = activeAudio(actor, now);
    return stimulus?.distance.get(actor.position) === 0 ? factor(actor.rule.audioModifier) : 1;
  }

  function weight(actor, to, now = 0) {
    const from = actor.position;
    let result = 1;
    const stimulus = activeAudio(actor, now);
    if (stimulus) {
      const distance = stimulus.distance.get(to) ?? Infinity;
      const fromDistance = stimulus.distance.get(from) ?? Infinity;
      if (distance < fromDistance) {
        result *= factor(actor.rule.audioModifier * cameraAudio.factors[distance]);
      } else if (to === from && distance === 0) {
        result *= factor(actor.rule.audioModifier);
      }
    }
    if (actor.rule.hidingPlaces?.includes(to)) result *= factor(actor.rule.hidingBonus);
    return result;
  }

  return {
    startAudio, integrate, weight, stayWeight, attackOdds,
    staticActive: now => now < staticUntil,
    staticDeadline: now => now < staticUntil ? staticUntil : Infinity,
    triggerStatic: now => { staticUntil = now + config.effects.static.duration; },
    audioStatus: now => ({ remaining: Math.max(0, readyAt - now), camera: now < audio?.ends ? audio.camera : null,
      activeRemaining: Math.max(0, (audio?.ends ?? now) - now) }),
    audioStimulus(actor, now = 0) {
      const stimulus = activeAudio(actor, now);
      if (!stimulus) return null;
      const distance = stimulus.distance.get(actor.position) ?? Infinity;
      const modifiers = Object.fromEntries(audibleNeighbors(actor).flatMap(to => {
        const ring = stimulus.distance.get(to) ?? Infinity;
        return ring < distance ? [[to, actor.rule.audioModifier * cameraAudio.factors[ring]]] : [];
      }));
      return { camera: stimulus.camera, modifiers };
    },
    // HUD gains map continuous rates and brief events onto the same 0–100 scale.
    noiseIntensity: (now, input) => clamp(noiseRate(input) * 12 + transientVolume(now), 0, 100),
    addNoiseEvent(event, now = volumePeakAt) {
      const amount = noise.events[event] ?? 0;
      volumePeak = transientVolume(now) + amount * 7;
      volumePeakAt = now;
      for (const actor of actors) {
        if (actor.approach) addNoise(actor, amount * noiseMultiplier(actor));
      }
    },
    retain(actor) {
      const retain = config.movement.failedModifierRetention;
      actor.noise *= retain;
      actor.light *= retain;
    }
  };
}

function createHallucinations(rules, enabled, random, laugh) {
  const effects = enabled ? Object.entries(rules).map(([key, rule]) => ({
    key, rule, next: rule.interval, ends: 0
  })) : [];
  return {
    nextDeadline: () => Math.min(...effects.map(effect => effect.next)),
    resolve(now, sanity, audible) {
      for (const effect of effects) {
        if (now < effect.next) continue;
        const { key, rule } = effect;
        effect.next += rule.interval;
        if (now < effect.ends || sanity >= rule.below) continue;
        const chance = rule.chance + (rule.chancePerPoint ?? 0) * (rule.below - sanity);
        if (random() * 100 >= chance) continue;
        if (key === 'laugh') {
          if (audible) laugh();
        } else effect.ends = now + rule.duration;
      }
    },
    visual(now) {
      const active = key => effects.some(effect => effect.key === key && now < effect.ends);
      return active('apparition') ? 'apparition' : active('blur') ? 'blur' : null;
    },
    stop() { effects.length = 0; }
  };
}

Object.assign(window.NathGame, { createEffects, createHallucinations });
})();
