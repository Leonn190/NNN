const assert = require('node:assert/strict');
const { test } = require('node:test');

class AudioNode {
  connections = new Set();
  frequency = this.parameter();
  gain = this.parameter();
  pan = this.parameter();
  threshold = this.parameter();
  knee = this.parameter();
  ratio = this.parameter();
  attack = this.parameter();
  release = this.parameter();
  parameter() { return { setValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {}, linearRampToValueAtTime() {} }; }
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
  createDynamicsCompressor() { return this.makeNode(); }
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
  const media = { pause() {} };
  sound.connectRadio(media);
  sound.disconnectRadio();
  sound.connectRadio(media);
  assert.equal(sound.stats().radio, true);
  assert.equal(sound.radio.highpass.channelCount, 1);
  assert.equal(sound.radio.highpass.channelCountMode, 'explicit');
  sound.mixRadio(media, .5, false, 1.38);
  assert.equal(sound.radio.normalization, 1.38);
  sound.mixRadio(media, .5, false);
  assert.equal(sound.radio.normalization, 1);
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

test('fear priority, continuous invasion, reversible release, loop crossfade and shutdown', async t => {
  const { mock } = t;
  const previousAudio = global.Audio;
  t.after(() => { global.Audio = previousAudio; });
  let now = 0;
  mock.method(performance, 'now', () => now * 1000);
  const effects = require('../config/effects.json');
  const settings = require('../config/controls.json').nightAudio;
  const voices = [];
  global.Audio = class {
    paused = true; currentTime = 0; duration = 10; plays = 0;
    constructor(src) { this.src = src; voices.push(this); }
    async play() { this.paused = false; this.plays++; }
    pause() { this.paused = true; }
    removeAttribute() {}
    load() {}
  };
  const sound = new SoundEngine();
  sound.prepareShift(settings, 5, effects);
  sound.startShift();
  const update = (seconds, invasion, imminent) => { now = seconds; sound.updateFear(invasion, imminent, now); };
  update(0, false, false);
  update(.1, false, true);
  const danger = sound.fearLayers.get('imminent').voices[0].audio;
  update(.11, false, false);
  update(.12, false, true);
  update(.13, false, false);
  update(.14, false, true);
  assert.equal(danger.plays, 1);
  update(.4, false, true);
  assert.equal(danger.plays, 1);
  update(.5, false, false);
  update(.6, false, true);
  assert.equal(danger.plays, 1); // Tiny threshold oscillations reverse the release.
  update(.7, true, true);
  update(.9, true, false); // Closet/camera changes have no separate audio condition.
  const layer = sound.fearLayers.get('invasion');
  const first = layer.voices[0].audio, second = layer.voices[1].audio;
  assert.equal(sound.fearState, 'invasion');
  assert.equal(first.plays, 1);
  first.currentTime = 9.7;
  update(1, true, true);
  assert.equal(second.plays, 1);
  second.currentTime = .2;
  update(1.2, true, false);
  assert(Math.abs(first.volume - effects.fear.tracks.invasion.volume / 2) < 1e-9);
  second.currentTime = .4;
  update(1.4, true, false);
  assert(first.paused);
  assert(!second.paused);
  sound.requestFearRecovery();
  update(1.5, false, true);
  assert.equal(sound.fearState, 'imminent');
  update(2.5, false, false);
  assert.equal(sound.fearState, null); // Recovery suppressed by real danger is discarded.
  sound.requestFearRecovery();
  update(2.6, false, false);
  assert.equal(sound.fearState, 'recovery');
  update(9.6, false, false);
  assert.equal(sound.fearState, null);
  update(10.5, false, false);
  assert(voices.every(audio => audio.paused));
  let resolvePlay;
  first.play = () => { first.paused = false; return new Promise(resolve => { resolvePlay = resolve; }); };
  update(11, true, false);
  sound.stopShift();
  resolvePlay();
  await Promise.resolve();
  assert(voices.every(audio => audio.paused));
  assert.equal(sound.fearLayers.size, 0);
  assert.equal(sound.fearRecoveryUntil, 0);
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
