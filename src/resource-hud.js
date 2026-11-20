(() => {
'use strict';

const energyLossStops = [0, .12, .32, .65, .95];
const sanityLossStops = [0, .20, .45, .90, 1.50];
const lossColors = [[70, 217, 135], [190, 221, 89], [230, 185, 39], [243, 139, 67], [240, 75, 86]];

function lossColor(rate, stops) {
  const end = stops.findIndex(stop => stop >= rate);
  if (end === 0) return '#46D987';
  if (end === -1) return '#F04B56';
  const fraction = (rate - stops[end - 1]) / (stops[end] - stops[end - 1]);
  const channels = lossColors[end - 1].map((start, i) => Math.round(start + (lossColors[end][i] - start) * fraction));
  return `rgb(${channels.join(', ')})`;
}

// The waveform scrolls for eight seconds; quiet periods are exactly flat.
const volumeSamples = new Float32Array(81);
const volumeStepSeconds = .1;
let lastVolumeBucket = 0;
let bucketPeak = 0;

function renderVolume(dom, intensity, elapsedSeconds = 0, reset = false) {
  const time = Math.max(0, elapsedSeconds);
  const bucket = Math.floor(time / volumeStepSeconds + .000001);
  if (reset || bucket < lastVolumeBucket) {
    volumeSamples.fill(0);
    lastVolumeBucket = 0;
    bucketPeak = 0;
  }

  if (bucket > lastVolumeBucket) {
    const passed = Math.min(volumeSamples.length, bucket - lastVolumeBucket);
    volumeSamples.copyWithin(0, passed);
    volumeSamples.fill(0, volumeSamples.length - passed);
    lastVolumeBucket = bucket;
    bucketPeak = 0;
  }

  const level = Math.min(100, Math.max(0, Number(intensity) || 0));
  bucketPeak = Math.max(bucketPeak, level);
  // Irregular oscillations around the central line, not bars or a cumulative meter.
  const pulse = Math.sin(bucket * 2.4) * .78 + Math.sin(bucket * 1.23) * .22;
  const amplitude = bucketPeak < 4 ? 0 : 14 * Math.pow(bucketPeak / 100, .8);
  volumeSamples[volumeSamples.length - 1] = amplitude * pulse;

  let trace = 'M0 16';
  for (let i = 1; i < volumeSamples.length; i++) {
    trace += `L${i * 2} ${(16 - volumeSamples[i]).toFixed(1)}`;
  }
  dom.volumeTrace.setAttribute('d', trace);
  const value = String(Math.round(level));
  if (dom.volumeDetector.getAttribute('aria-valuenow') !== value) {
    dom.volumeDetector.setAttribute('aria-valuenow', value);
  }
}

function renderResources(dom, { sanity, energy, sanityLossPerSecond, energyLossPerSecond }) {
  for (const [meter, label, value, rate, stops] of [
    [dom.sanityMeter, dom.sanityValue, sanity, sanityLossPerSecond, sanityLossStops],
    [dom.energyMeter, dom.energyValue, energy, energyLossPerSecond, energyLossStops]
  ]) {
    if (meter.hidden) continue;
    const color = lossColor(rate, stops);
    if (meter.style.getPropertyValue('--meter-color') !== color) meter.style.setProperty('--meter-color', color);
    const rounded = Math.round(value * 10) / 10;
    const text = value > 0 && rounded === 0 ? '<0,1%' : `${String(rounded).replace('.', ',')}%`;
    if (label.textContent === text) continue;
    label.textContent = text;
    meter.value = rounded;
    meter.style.setProperty('--meter-fill', `${rounded}%`);
  }
}

Object.assign(window.NathGame, { renderVolume, renderResources });
})();
