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

function renderVolume(dom, intensity) {
  const value = String(Math.round(intensity));
  if (dom.volumeDetector.getAttribute('aria-valuenow') === value) return;
  dom.volumeDetector.setAttribute('aria-valuenow', value);
  dom.volumeTrace.style.transform = `scaleY(${Math.max(.025, Number(value) / 100)})`;
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
