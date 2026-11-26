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
  let targetNoise = 0;
  let globalNoise = 0;
  let cachedDt = -1, cachedMean = 0;

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

  function noiseRate(input) {
    let rate = 0;
    for (const [key, value] of noiseRates) if (input[key]) rate += value;
    return clamp(rate, 0, noise.max);
  }

  // Integral of a first-order response: shared by every actor, HUD and diagnostics.
  function meanNoise(dt) {
    if (!(dt > 0)) return globalNoise;
    if (dt === cachedDt) return cachedMean;
    cachedDt = dt;
    const blend = -Math.expm1(-dt / noise.responseSeconds);
    cachedMean = targetNoise + (globalNoise - targetNoise) * noise.responseSeconds * blend / dt;
    return cachedMean;
  }

  function meanLight(actor, dt) {
    if (!(dt > 0)) return actor.light ?? 0;
    const rate = actor.lightRate ?? 0;
    const start = actor.light ?? 0;
    if (!rate) return start;
    const ramp = Math.min(dt, Math.max(0, ((rate > 0 ? 1 : 0) - start) / rate));
    return ((start + start + rate * ramp) * ramp / 2
      + clamp(start + rate * dt, 0, 1) * (dt - ramp)) / dt;
  }

  function prepare(input) {
    const next = noiseRate(input);
    if (next !== targetNoise) cachedDt = -1;
    targetNoise = next;
    for (const actor of actors) {
      const light = flashlight.modifiers[actor.key];
      const lit = actor.approach?.objective === 'corridor' && input.corridorLight && corridor.includes(actor.position);
      actor.lightRate = light ? (lit ? 1 / light.secondsToMax : -flashlight.decayPerSecond) : 0;
      actor.lit = Boolean(lit);
    }
  }

  function integrate(dt, input) {
    prepare(input);
    cachedDt = -1;
    globalNoise = clamp(targetNoise + (globalNoise - targetNoise)
      * Math.exp(-dt / noise.responseSeconds), 0, noise.max);
    for (const actor of actors) {
      actor.noise = globalNoise;
      if (!actor.approach) continue;
      const light = flashlight.modifiers[actor.key];
      if (!light) continue;
      const previousLight = actor.light;
      actor.light = clamp(previousLight + actor.lightRate * dt, 0, 1);
      if (actor.key === 'gotica') {
        const secondsAtMax = actor.lit ? Math.max(0, dt - (1 - previousLight) * light.secondsToMax) : 0;
        actor.goticaExposure = actor.lit ? (actor.goticaExposure ?? 0) + secondsAtMax : 0;
      }
    }
  }

  function attackBar(actor, objective, leftLook, now = 0, dt = 0, atEnd = false) {
    const rules = config.movement.attack.bar;
    const [base, coefficient] = rules.speeds[actor.key][objective];
    const heard = atEnd ? targetNoise + (globalNoise - targetNoise) * Math.exp(-dt / noise.responseSeconds) : meanNoise(dt);
    const exposure = atEnd ? clamp((actor.light ?? 0) + (actor.lightRate ?? 0) * dt, 0, 1) : meanLight(actor, dt);
    const light = objective === 'corridor' ? (rules.light[actor.key] ?? 0) * exposure : 0;
    const look = objective === 'stock' && leftLook ? -rules.lookPenalty : 0;
    let audioSpeed = 0;
    const stimulus = audio && now < audio.ends ? audio : null;
    // Keep attack acoustics anchored to its route origin: the visual advanced-stage change
    // must not change range, direction or speed. Navigation still uses real positions.
    const origin = actor.approach ? (objective === 'stock' ? config.map.leftApproach : back) : actor.position;
    const from = stimulus?.distance.get(origin) ?? Infinity;
    if (from <= 2) {
      // Direction is measured against the final destination, never against a bar phase.
      const next = stimulus.distance.get(config.map.office) ?? Infinity;
      if (actor.key === 'padrao') {
        if (objective === 'stock' && stimulus.camera === 'CAM08' && from <= 1) audioSpeed = rules.audio.padraoStock;
      } else audioSpeed = next < from ? rules.audio.toward : from <= 1 ? rules.audio.near : rules.audio.far;
    }
    return { speed: base + coefficient * heard + light + look + audioSpeed,
      noise: heard, modifiers: { light, look, audio: audioSpeed } };
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
    startAudio, prepare, integrate, weight, stayWeight, attackBar,
    perceivedNoise: () => globalNoise,
    audioDeadline: now => now < audio?.ends ? audio.ends : Infinity,
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
    noiseIntensity: () => globalNoise,
    addNoiseEvent(event) {
      cachedDt = -1;
      globalNoise = clamp(globalNoise + (noise.events[event] ?? 0), 0, noise.max);
      for (const actor of actors) actor.noise = globalNoise;
    },
    retain(actor) {
      const retain = config.movement.failedModifierRetention;
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
