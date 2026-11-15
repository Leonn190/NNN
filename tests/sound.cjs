const assert = require('node:assert/strict');
const { test } = require('node:test');

class AudioNode {
  connections = new Set();
  frequency = this.parameter();
  gain = this.parameter();
  pan = this.parameter();
  parameter() { return { setValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} }; }
  connect(node) { this.connections.add(node); return node; }
  disconnect() { this.connections.clear(); }
  start() { this.started = true; }
  stop() { assert(this.started); this.stopped = true; }
}

const contexts = [];
class AudioContext {
  currentTime = 0;
  state = 'suspended';
  destination = new AudioNode();
  nodes = [];
  constructor() { contexts.push(this); }
  createOscillator() { return this.makeNode(); }
  createGain() { return this.makeNode(); }
  createBiquadFilter() { return this.makeNode(); }
  createStereoPanner() { return this.makeNode(); }
  createMediaElementSource() {
    assert(!this.radioSource);
    return this.radioSource = this.makeNode();
  }
  makeNode() { const node = new AudioNode(); this.nodes.push(node); return node; }
  async suspend() { this.state = 'suspended'; }
  async resume() { this.state = 'running'; }
}
global.window = { NathGame: {}, AudioContext };
require('../src/sound.js');
const { SoundEngine } = window.NathGame;

test('one context, finite voices, radio reuse, and no connected shift nodes after stop', async () => {
  const sound = new SoundEngine();
  await sound.enable();
  assert.equal(sound.context.state, 'suspended');
  sound.startShift();
  await Promise.resolve();
  assert.equal(contexts.length, 1);
  assert.equal(sound.stats().ambience, true);
  const [ambient, filter, ambientGain] = sound.context.nodes;
  sound.monitor();
  const [, , , osc, gain] = sound.context.nodes;
  assert.equal(sound.stats().tones, 1);
  const ended = osc.onended;
  ended();
  assert.equal(sound.stats().tones, 0);
  assert.equal(osc.onended, null);
  assert.equal(osc.connections.size + gain.connections.size, 0);

  sound.switch();
  const [, , , , , pending, pendingGain] = sound.context.nodes;
  const staleEnded = pending.onended;
  const media = {};
  sound.connectRadio(media);
  sound.disconnectRadio();
  sound.connectRadio(media);
  assert.equal(sound.stats().radio, true);
  sound.stopShift();
  staleEnded();
  assert.equal(sound.stats().tones, 0);
  assert.equal(sound.stats().ambience, false);
  assert.equal(sound.stats().radio, false);
  assert.equal(sound.context.state, 'suspended');
  assert.equal(ambient.stopped && pending.stopped, true);
  for (const node of [ambient, filter, ambientGain, pending, pendingGain, ...sound.context.nodes]) {
    assert.equal(node.connections.size, 0);
  }
  sound.startShift();
  await Promise.resolve();
  sound.connectRadio(media);
  assert.equal(contexts.length, 1);
  assert.equal(sound.stats().radio, true);
  sound.stopShift();
});

test('a pending audio resume cannot recreate ambience after a shift stops', async () => {
  const sound = new SoundEngine();
  await sound.enable();
  let resume;
  sound.context.resume = () => new Promise(resolve => { resume = resolve; });
  sound.startShift();
  sound.stopShift();
  resume();
  await Promise.resolve();
  assert.equal(sound.stats().ambience, false);
  assert.equal(sound.context.nodes.length, 0);
});

test('invasions share a loop that fades, resumes and cleans up on shift stop', ({ mock }) => {
  mock.timers.enable({ apis: ['setInterval'] });
  let now = 0;
  mock.method(performance, 'now', () => now);
  const sound = new SoundEngine();
  const invasion = require('../config/effects.json').invasion;
  const sample = {
    paused: true, plays: 0,
    async play() { this.paused = false; this.plays++; },
    pause() { this.paused = true; }
  };
  sound.samples.set(invasion.file, sample);
  sound.startShift();
  sound.setInvasionLoop(true, invasion);
  sound.setInvasionLoop(true, invasion);
  assert.equal(sample.plays, 1);
  assert.equal(sample.loop, true);

  sound.setInvasionLoop(false, invasion);
  now = 500;
  mock.timers.tick(500);
  assert.equal(sample.paused, false);
  assert.equal(sample.volume, invasion.volume / 2);
  sound.setInvasionLoop(true, invasion);
  assert.equal(sample.volume, invasion.volume);
  assert.equal(sample.plays, 1);
  sound.setInvasionLoop(false, invasion);
  now = 1499;
  mock.timers.tick(999);
  assert.equal(sample.paused, false);
  now = 1500;
  mock.timers.tick(1);
  assert.equal(sample.volume, 0);
  assert.equal(sample.loop, false);
  assert.equal(sample.paused, true);

  sound.setInvasionLoop(true, invasion);
  sound.setInvasionLoop(false, invasion);
  sound.stopShift();
  assert.equal(sound.invasionFade, undefined);
  assert.equal(sample.paused, true);
});

test('spatial gate closures overlap with independent pan and preserve the central gate sample', ({ mock }) => {
  const previousAudio = global.Audio;
  global.Audio = class {
    paused = true;
    constructor(src) { this.src = src; }
    async play() { this.paused = false; }
    pause() { this.paused = true; }
  };
  try {
    const sound = new SoundEngine();
    sound.enabled = true;
    sound.context = new AudioContext();
    sound.context.state = 'running';
    mock.method(sound.context, 'createMediaElementSource', () => new AudioNode());
    sound.preloadSamples();
    const file = 'audio/effects/doors/portao-fechando.ogg';
    sound.playSample('officeGateClose');
    sound.playPannedSample('officeGateClose', .31, -.82, 2);
    sound.playPannedSample('officeGateClose', .19, .14, 2);
    sound.playPannedSample('officeGateClose', .13, .08, 2);
    assert.deepEqual(sound.pannedSamples.get(file).map(({ audio, panner }) => [audio.volume, panner.pan.value]),
      [[.31, -.82], [.19, .14]]);
    assert.equal(sound.samples.get(file).volume, .45);
    sound.context.state = 'suspended';
    sound.playPannedSample('officeGateClose', .07, .42, 2);
    const fallback = sound.pannedSamples.get(file).at(-1);
    assert.equal(fallback.panner, null);
    assert.equal(fallback.audio.volume, .07);
    assert.equal(sound.samples.get(file).volume, .45);
    sound.stopSamples();
    assert(sound.pannedSamples.get(file).every(({ audio }) => audio.paused));
  } finally {
    global.Audio = previousAudio;
  }
});
