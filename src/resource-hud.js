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

// Keep the eight-second waveform in a tiny canvas. No per-frame SVG parsing or allocations.
const volumeSamples = new Float32Array(81);
const volumeStepSeconds = .1;
let volumeContext;
let lastVolumeBucket = 0;
let bucketPeak = 0;
let lastSoundBucket = -Infinity;
let hadVisibleWave = false;
let lastReading = -1;

function renderVolume(dom, intensity, elapsedSeconds = 0, reset = false) {
  const bucket = Math.floor(Math.max(0, elapsedSeconds) / volumeStepSeconds + .000001);
  let redraw = reset;
  if (reset || bucket < lastVolumeBucket) {
    volumeSamples.fill(0);
    lastVolumeBucket = bucket;
    bucketPeak = 0;
    lastSoundBucket = -Infinity;
    hadVisibleWave = false;
  }
  if (bucket > lastVolumeBucket) {
    const passed = Math.min(volumeSamples.length, bucket - lastVolumeBucket);
    volumeSamples.copyWithin(0, passed);
    volumeSamples.fill(0, volumeSamples.length - passed);
    lastVolumeBucket = bucket;
    bucketPeak = 0;
    redraw = true;
  }

  const level = Math.min(100, Math.max(0, Number(intensity) || 0));
  if (level > bucketPeak) {
    bucketPeak = level;
    const pulse = Math.sin(bucket * 2.4) * .78 + Math.sin(bucket * 1.23) * .22;
    const amplitude = level < 4 ? 0 : 14 * Math.pow(level / 100, .8);
    volumeSamples[volumeSamples.length - 1] = amplitude * pulse;
    if (amplitude > 0) lastSoundBucket = bucket;
    redraw = true;
  }

  const reading = Math.round(level);
  if (reading !== lastReading) {
    dom.volumeDetector.setAttribute('aria-valuenow', String(reading));
    lastReading = reading;
  }

  // Once the history is flat, leave the canvas alone until another sound occurs.
  const visible = bucket - lastSoundBucket < volumeSamples.length;
  if (!redraw || (!visible && !hadVisibleWave && !reset)) return;
  hadVisibleWave = visible;

  if (!volumeContext) {
    volumeContext = dom.volumeCanvas.getContext('2d', { alpha: false });
    volumeContext.lineWidth = 1.5;
    volumeContext.lineJoin = 'round';
    volumeContext.lineCap = 'round';
    volumeContext.strokeStyle = '#a9f6c9';
    volumeContext.fillStyle = '#07140f';
  }
  volumeContext.fillRect(0, 0, 160, 32);
  volumeContext.beginPath();
  volumeContext.moveTo(0, 16);
  for (let i = 1; i < volumeSamples.length; i++) {
    volumeContext.lineTo(i * 2, 16 - volumeSamples[i]);
  }
  volumeContext.stroke();
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
