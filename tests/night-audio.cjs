const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const controls = require('../config/controls.json');
let clock = 0;
class Media {
  constructor(src) { this.src = src ?? ''; this.paused = true; this.volume = 1; this.currentTime = 0; this.duration = 30; this.dataset = {}; this.listeners = {}; this.plays = 0; }
  play() { this.paused = false; this.ended = false; this.plays++; return Promise.resolve(); }
  pause() { this.paused = true; }
  getAttribute() { return this.src || null; }
  removeAttribute() { this.src = ''; }
  load() { this.paused = true; this.ended = false; this.currentTime = 0; }
  addEventListener(name, fn) { this.listeners[name] = fn; }
}
const window = { NathGame: {}, location: { protocol: 'https:' } };
const env = { window, Audio: Media, performance: { now: () => clock }, Math, Float32Array, setInterval, clearInterval };
vm.runInNewContext(fs.readFileSync(require.resolve('../src/sound.js'), 'utf8'), env);
const { SoundEngine } = window.NathGame;
function engine(number = 1) {
  const sound = new SoundEngine();
  clock = 0;
  sound.prepareShift(controls.nightAudio, number);
  sound.startShift();
  return sound;
}
function radioHarness(number) {
  const sound = engine(number ?? null), radioMusic = new Media();
  const state = { shift: { number }, mode: 'office', startedAt: 0, radioAutoPending: true, pan: 0, closetPan: 0 };
  const context = { sound, radioMusic, state, controls, performance: env.performance,
    radioPlayback: null, radioMixPan: undefined, radioMixHiding: undefined, radioMixNormalization: undefined, radioMixProfile: undefined,
    viewport: { width: 1000, panoramaWidth: 3000 }, endingAssets: { newRadioTrack: 'new.mp3' },
    window: { NathGame: { createCampaignStore: () => ({ stars: () => 0 }) } },
    movement: { snapshot: () => ({ radioAvailable: true }) },
    dom: { officeRadio: { setAttribute() {}, listeners: {}, addEventListener(name, fn) { this.listeners[name] = fn; } } }, advanceGame() {} };
  vm.createContext(context);
  const main = fs.readFileSync(require.resolve('../src/main.js'), 'utf8');
  vm.runInContext(main.slice(main.indexOf('function updateRadioMix()'), main.indexOf('function setClownPhase(')), context);
  vm.runInContext(main.slice(main.indexOf('let radioMutedOnPointerDown ='), main.indexOf('function setRadioPlaying(')), context);
  const start = main.indexOf('function setRadioPlaying(');
  const end = main.indexOf("radioMusic.addEventListener('error', fallbackRadio);") + "radioMusic.addEventListener('error', fallbackRadio);".length;
  vm.runInContext(main.slice(start, end), context);
  return context;
}
test('campaign calls start after the actual shift delay; unsupported nights do not substitute', () => {
  for (const night of [1, 2, 3, 4, 5, 6, 7, 8, 9, undefined]) {
    const c = radioHarness(night);
    c.updatePhoneCall(1999, true);
    assert.equal(c.radioMusic.plays, 0);
    c.updatePhoneCall(2000, true);
    assert.equal(c.radioMusic.plays, night <= 5 ? 1 : 0);
    if (night <= 5) {
      assert(c.radioMusic.src.endsWith(`noite-0${night}.ogg`));
      c.radioMusic.listeners.playing();
      assert.equal(c.state.radioPlaying, false);
      c.autoStartRadio(20000);
      assert.equal(c.radioMusic.plays, 1);
    } else {
      c.autoStartRadio(15000);
      assert.equal(c.radioMusic.plays, 1);
    }
    c.sound.stopShift();
  }
});
test('muting is immediate, consumes the click and leaves music off until the next click', () => {
  const c = radioHarness(1);
  c.updatePhoneCall(2000, true);
  c.toggleRadio();
  assert.equal(c.sound.phone.status, 'muted');
  assert(c.radioMusic.paused);
  assert.equal(c.radioMusic.plays, 1);
  c.autoStartRadio(60000);
  c.updatePhoneCall(60000, true);
  assert.equal(c.radioMusic.plays, 1);
  c.toggleRadio();
  assert.equal(c.radioMusic.plays, 2);
  assert.equal(c.radioMusic.loop, true);
  c.radioMusic.listeners.playing();
  assert.equal(c.state.radioPlaying, true);
  c.sound.stopShift();
});
test('natural ending respects the original 15 seconds and a pause; blackout cancels calls', () => {
  const c = radioHarness(2);
  c.updatePhoneCall(2000, true);
  clock = 20000;
  c.radioMusic.ended = true;
  c.radioMusic.listeners.ended();
  c.autoStartRadio(20000);
  assert.equal(c.radioMusic.plays, 1);
  c.updatePhoneCall(20180, true);
  c.autoStartRadio(21179);
  assert.equal(c.radioMusic.plays, 1);
  c.autoStartRadio(21180);
  assert.equal(c.radioMusic.plays, 2);
  c.sound.stopShift();
  const early = radioHarness(1);
  early.updatePhoneCall(2000, false);
  assert.equal(early.radioMusic.plays, 0);
  early.updatePhoneCall(3000, true);
  assert.equal(early.radioMusic.plays, 0);
});
test('ambience eligibility, non-repetition, fades before file end, recovery and silence intervals', () => {
  const sound = engine();
  assert(sound.nextAmbienceAt >= 8 && sound.nextAmbienceAt <= 18);
  sound.beginAmbience(20, 100);
  assert.notEqual(sound.ambienceVoice.track.index, 2);
  const first = sound.ambienceVoice.track.index;
  sound.updateNightAudio(100, 23);
  assert(sound.ambienceVoice.audio.volume > 0);
  sound.ambienceVoice.audio.currentTime = 27;
  sound.updateNightAudio(100, 24);
  assert.equal(sound.ambienceVoice.releaseAt, 24);
  sound.updateNightAudio(100, 27);
  assert.equal(sound.ambienceVoice, null);
  assert(sound.nextAmbienceAt >= 32 && sound.nextAmbienceAt <= 47);
  sound.beginAmbience(48, 100);
  assert.notEqual(sound.ambienceVoice.track.index, first);
  // Drive the random draw to the low-sanity track without changing the game RNG.
  const random = Math.random;
  try { Math.random = () => .999; sound.beginAmbience(50, .5); } finally { Math.random = random; }
  assert.equal(sound.ambienceVoice.track.index, 2);
  sound.updateNightAudio(.5, 53);
  sound.updateNightAudio(65, 54);
  assert.equal(sound.ambienceVoice.releaseAt, 54);
  sound.updateNightAudio(65, 58);
  assert.equal(sound.ambienceVoice, null);
  sound.stopShift();
});
test('sanity music box follows fractional values, loops without restart, ducks only ambience and resets', () => {
  const sound = engine();
  sound.updateNightAudio(1.01, 1);
  assert.equal(sound.sanityMusicBox, null);
  sound.updateNightAudio(1, 2);
  const audio = sound.sanityMusicBox.audio;
  assert.equal(audio.volume, 0);
  sound.updateNightAudio(.5, 4);
  assert(Math.abs(audio.volume - controls.nightAudio.sanityMusicBox.maxVolume / 2) < .00001);
  audio.currentTime = 12;
  sound.updateNightAudio(0, 6);
  assert.equal(audio.currentTime, 12);
  assert.equal(audio.plays, 1);
  assert.equal(audio.loop, true);
  assert(sound.ambienceDuck < .21);
  sound.updateNightAudio(.5, 8);
  assert(Math.abs(audio.volume - .12) < .00001);
  sound.updateNightAudio(2, 13);
  assert.equal(sound.sanityMusicBox, null);
  sound.updateNightAudio(0, 13.016);
  assert(sound.sanityMusicBox.audio.volume > 0 && sound.sanityMusicBox.audio.volume < .24);
  const media = [...sound.nightMedia.values()];
  sound.stopSamples();
  assert(media.every(audio => audio.paused && audio.src === ''));
  assert.equal(sound.nightMedia.size, 0);
  assert.equal(sound.sanityMusicBox, null);
});
test('pending media playback is silenced after shutdown; autoplay rejection is contained', async () => {
  const sound = engine();
  sound.updateNightAudio(1, 1);
  const audio = sound.sanityMusicBox.audio;
  let resolve;
  audio.play = () => new Promise(done => { resolve = () => { audio.paused = false; done(); }; });
  sound.playNightClip(audio);
  sound.stopShift();
  resolve();
  await Promise.resolve();
  assert(audio.paused);
});


test('the sanity music box and Palhaca loop remain independent, including playback rejection', async () => {
  const sound = engine();
  const palhaca = new Media('./public/audio/characters/palhaca/caixa-de-musica.mp3');
  sound.samples.set('audio/characters/palhaca/caixa-de-musica.mp3', palhaca);
  sound.setSampleLoop('musicBox', .3);
  sound.updateNightAudio(1, 1);
  const sanity = sound.sanityMusicBox.audio;
  assert.notEqual(sanity, palhaca);
  sound.updateNightAudio(2, 8);
  assert(palhaca.loop && !palhaca.paused);
  assert(sanity.paused);
  sound.beginAmbience(9, 100);
  const ambience = sound.ambienceVoice.audio;
  ambience.play = () => Promise.reject(new Error('Autoplay blocked'));
  sound.playNightClip(ambience);
  await Promise.resolve();
  sound.updateNightAudio(100, 10);
  assert.equal(sound.ambienceVoice, null);
  assert(sound.nextAmbienceAt >= 15 && sound.nextAmbienceAt <= 30);
  sound.stopShift();
  assert(palhaca.paused);
});


test('pointer press mutes immediately and consumes its click; the next pointer click starts music', () => {
  const c = radioHarness(1);
  c.updatePhoneCall(2000, true);
  const handlers = c.dom.officeRadio.listeners;
  handlers.pointerdown({ button: 0 });
  assert.equal(c.sound.phone.status, 'muted');
  assert(c.radioMusic.paused);
  handlers.click({ detail: 1 });
  assert.equal(c.radioMusic.plays, 1);
  assert.equal(c.state.radioAutoPending, false);
  handlers.pointerdown({ button: 0 });
  handlers.click({ detail: 1 });
  assert.equal(c.radioMusic.plays, 2);
  c.sound.stopShift();
});

test('radio muting also recognizes a recording when its playback flag became stale', () => {
  const c = radioHarness(1);
  c.updatePhoneCall(2000, true);
  c.sound.phone.status = 'stopped';
  c.toggleRadio();
  assert(c.radioMusic.paused);
  assert.equal(c.sound.phone.status, 'muted');
  assert.equal(c.radioMusic.plays, 1);
  c.sound.stopShift();
});
