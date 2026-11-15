(() => {
'use strict';

const clampPercent = value => Math.min(100, Math.max(0, value));

function sanityRate(rules, { cameraLoss = 0, direct, invasion, centralGate, closet, radio, blackout }) {
  const { loss, recovery, blackoutLossMultiplier } = rules;
  const totalLoss = cameraLoss
    + (invasion ? loss.invasion : 0) + (direct ? loss.direct : 0)
    + (centralGate ? loss.centralGate : 0) + (closet ? loss.closet : 0);
  return (radio ? recovery.music : 0) + (totalLoss === 0 ? recovery.passive : 0)
    - totalLoss * (blackout ? blackoutLossMultiplier : 1);
}

function hourDuration(clock, sanity) {
  const fraction = (clock.fastSanity - sanity) / (clock.fastSanity - clock.slowSanity);
  return clock.fastSecondsPerHour + Math.max(0, Math.min(1, fraction))
    * (clock.slowSecondsPerHour - clock.fastSecondsPerHour);
}

function clockProgress(clock, sanity, rate, seconds, pauseBelowMinimum = true) {
  if (rate === 0 || seconds === 0) {
    return pauseBelowMinimum && sanity < clock.slowSanity ? 0 : seconds / hourDuration(clock, sanity);
  }
  // Split where the hourly duration reaches a limit. Between limits it changes linearly.
  const slowAt = (clock.slowSanity - sanity) / rate;
  const fastAt = (clock.fastSanity - sanity) / rate;
  const cuts = [slowAt, fastAt].filter(time => time > 0 && time < seconds).sort((a, b) => a - b);
  let elapsed = 0;
  let hours = 0;
  for (const end of [...cuts, seconds]) {
    const belowMinimum = rate > 0 ? end <= slowAt : elapsed >= slowAt;
    if (!pauseBelowMinimum || !belowMinimum) {
      const startDuration = hourDuration(clock, sanity + rate * elapsed);
      const endDuration = hourDuration(clock, sanity + rate * end);
      const change = (endDuration - startDuration) / startDuration;
      hours += (end - elapsed) / startDuration * (change ? Math.log1p(change) / change : 1);
    }
    elapsed = end;
  }
  return hours;
}

function firstTime(low, high, reached) {
  for (let i = 0; i < 42; i++) {
    const mid = (low + high) / 2;
    if (reached(mid)) high = mid;
    else low = mid;
  }
  return high;
}

function createResources({ night: defaults, sanity: sanityRules, power }, night = defaults, onBlackout = () => {}) {
  const { hoursToWin, powerEnabled, sanityEnabled, secondsPerHour } = night;
  const fastestHour = secondsPerHour ?? night.clock.fastSecondsPerHour;
  const clock = { ...night.clock, fastSecondsPerHour: fastestHour };
  let sanity = sanityEnabled ? clampPercent(sanityRules.initial) : 100;
  let energy = powerEnabled ? clampPercent(power.initial) : 100;
  let computerOn = energy > 0;
  let blackoutAt = energy === 0 ? 0 : Infinity;
  let hours = 0;

  const radioAvailable = now => now < blackoutAt + power.radioGraceSeconds;
  const flashlightAvailable = now => now < blackoutAt + power.flashlightGraceSeconds;

  function drainEnergy(amount, now) {
    if (!powerEnabled || energy === 0) return;
    energy = clampPercent(energy - amount);
    if (energy === 0) {
      blackoutAt = now;
      computerOn = false;
      onBlackout();
    }
  }

  function applyEvent(event, now) {
    if (sanityEnabled) sanity = clampPercent(sanity - (sanityRules.eventLoss[event] ?? 0));
    drainEnergy(power.eventDrain[event] ?? 0, now);
  }

  const computerDrain = input => computerOn
    ? power.computerDrain * (input.computer || input.camera ? 1 : power.computerIdleFactor) : 0;
  const energyDrain = (input, gates, radio) => powerEnabled && energy > 0
    ? computerDrain(input) + gates.size * power.gateDrain
      + (radio ? power.radioDrain : 0) + (input.flashlight ? power.flashlightDrain : 0) : 0;
  const sanityChange = (observation, radio) => sanityEnabled
    ? sanityRate(sanityRules, { ...observation, radio, blackout: energy === 0 }) : 0;
  const consumptionMultiplier = () => sanityEnabled ? fastestHour / hourDuration(clock, sanity) : 1;

  function segment(now, until, input, observation, gates = input.gates) {
    const radioUntil = blackoutAt + power.radioGraceSeconds;
    const flashlightUntil = blackoutAt + power.flashlightGraceSeconds;
    const radio = input.radio && radioAvailable(now);
    const drain = energyDrain(input, gates, radio);
    const rate = sanityChange(observation, radio);
    const progress = seconds => sanityEnabled ? clockProgress(clock, sanity, rate, seconds)
      : seconds / fastestHour;
    const drainPerSecond = drain * consumptionMultiplier();
    // A paused clock still uses the slowest hourly duration for energy.
    const spent = seconds => rate !== 0
      ? drain * fastestHour * clockProgress(clock, sanity, rate, seconds, false)
      : drainPerSecond * seconds;
    const limit = Math.min(until, radioUntil > now ? radioUntil : Infinity,
      flashlightUntil > now ? flashlightUntil : Infinity);
    const available = limit - now;
    let powerEnds = Infinity;
    if (drain > 0 && spent(available) >= energy) {
      const elapsed = rate !== 0
        ? firstTime(0, Math.min(available, energy * clock.slowSecondsPerHour / (drain * fastestHour)),
          seconds => spent(seconds) >= energy)
        : energy / drainPerSecond;
      powerEnds = Math.min(limit, now + elapsed);
    }
    const endLimit = Math.min(limit, powerEnds);
    const duration = endLimit - now;
    const remaining = hoursToWin - hours;
    let dt = duration;
    let won = false;
    const thresholdAt = rate === 0 ? Infinity : (clock.slowSanity - sanity) / rate;
    const eligibleFrom = sanityEnabled && sanity < clock.slowSanity ? (rate > 0 ? thresholdAt : Infinity) : 0;
    const eligibleUntil = sanityEnabled && rate < 0 ? Math.min(duration, thresholdAt) : duration;
    const reached = seconds => progress(seconds) >= remaining - 1e-12;
    if (eligibleFrom <= eligibleUntil && reached(eligibleUntil)) {
      dt = reached(eligibleFrom) ? eligibleFrom : firstTime(eligibleFrom, eligibleUntil, reached);
      won = true;
    }
    const end = dt === duration ? endLimit : now + dt;
    const consumed = end >= powerEnds ? energy : spent(dt);
    hours += progress(dt);
    if (won) hours = Math.max(hours, hoursToWin);
    if (sanityEnabled) sanity = clampPercent(sanity + rate * dt);
    if (won && sanityEnabled) sanity = Math.max(clock.slowSanity, sanity);
    drainEnergy(consumed, end);
    return { end, radio, won };
  }

  return {
    segment,
    applyEvent,
    radioAvailable,
    flashlightAvailable,
    computerOn: () => computerOn,
    turnComputerOff() { computerOn = false; },
    toggleComputer() { if (energy > 0) computerOn = !computerOn; },
    snapshot(now, input, observation, gates = input?.gates) {
      const radio = radioAvailable(now);
      const frame = { sanity, energy, hours, computerOn, blackout: energy === 0,
        radioAvailable: radio, flashlightAvailable: flashlightAvailable(now) };
      if (input) {
        const radioActive = input.radio && radio;
        frame.energyLossPerSecond = energyDrain(input, gates, radioActive) * consumptionMultiplier();
        frame.sanityLossPerSecond = Math.max(0, -sanityChange(observation, radioActive));
      }
      return frame;
    }
  };
}

Object.assign(window.NathGame, { createResources, sanityRate, hourDuration, clockProgress });
})();
