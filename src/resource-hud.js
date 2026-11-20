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

const volumeSamples = Array(40).fill(0);
const volumeStepSeconds = .2;
let volumeBars;
let lastVolumeBucket = 0;

function paintVolumeBar(bar, level) {
  bar.style.height = `${Math.max(1, Math.round(level))}%`;
  bar.dataset.level = level >= 65 ? 'high' : level >= 30 ? 'mid' : level > 2 ? 'low' : 'idle';
}

function resetVolumeHistory(dom) {
  if (!volumeBars) {
    const fragment = document.createDocumentFragment();
    volumeBars = volumeSamples.map(() => {
      const bar = document.createElement('span');
      bar.className = 'volume-bar';
      fragment.append(bar);
      return bar;
    });
    dom.volumeTimeline.replaceChildren(fragment);
  }
  volumeSamples.fill(0);
  lastVolumeBucket = 0;
  for (const bar of volumeBars) paintVolumeBar(bar, 0);
}

function renderVolume(dom, intensity, elapsedSeconds = 0, reset = false) {
  if (!volumeBars || reset || elapsedSeconds < lastVolumeBucket * volumeStepSeconds) resetVolumeHistory(dom);
  const level = Math.min(100, Math.max(0, Number(intensity) || 0));
  const bucket = Math.floor(Math.max(0, elapsedSeconds) / volumeStepSeconds);
  if (bucket > lastVolumeBucket) {
    const passed = Math.min(volumeSamples.length, bucket - lastVolumeBucket);
    volumeSamples.copyWithin(0, passed);
    volumeSamples.fill(0, volumeSamples.length - passed);
    lastVolumeBucket = bucket;
    for (let i = 0; i < volumeBars.length; i++) paintVolumeBar(volumeBars[i], volumeSamples[i]);
  }
  const newest = volumeSamples.length - 1;
  if (level > volumeSamples[newest]) {
    volumeSamples[newest] = level;
    paintVolumeBar(volumeBars[newest], level);
  }
  const value = String(Math.round(level));
  if (dom.volumeDetector.getAttribute('aria-valuenow') !== value) {
    dom.volumeDetector.setAttribute('aria-valuenow', value);
    dom.volumeValue.textContent = value;
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
