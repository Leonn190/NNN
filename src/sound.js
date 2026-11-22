(() => {
'use strict';
const sampleFiles = {
  musicBox: 'audio/characters/palhaca/caixa-de-musica.mp3',
  vent: 'audio/characters/smores/duto.mp3',
  doorCreak: 'audio/effects/doors/porta-rangendo.mp3',
  officeGateClose: 'audio/effects/doors/portao-fechando.ogg',
  running: 'audio/effects/movement/corrida-armario.mp3',
  flashlight: 'audio/effects/interface/lanterna.mp3',
  nightmare: 'audio/characters/shadow/confronto.mp3',
  reboot: 'audio/effects/interface/reinicio-computador.mp3',
  chimes: 'audio/effects/interface/fim-do-turno.mp3'
};
const cameraMeows = [
  'audio/cameras/sinistra',
  'audio/cameras/pesadelo'
].map(folder => [
  `${folder}/01-miado-agudo.wav`,
  `${folder}/02-miado-longo.wav`,
  `${folder}/03-miado-curto.wav`
]);

// Efeitos do jogo e mixagem do rádio da mesa.
class SoundEngine {
  constructor() {
    this.enabled = false;
    this.context = null;
    this.ambient = null;
    this.samples = new Map();
    this.sampleVoices = new Map();
    this.pannedSamples = new Map();
    this.tones = new Set();
    this.active = false;
  }
  preloadSamples(extraFiles = []) {
    for (const file of [...Object.values(sampleFiles), ...cameraMeows.flat(), ...extraFiles]) {
      if (this.samples.has(file)) continue;
      const audio = new Audio(`./public/${file}`);
      audio.preload = 'auto';
      this.samples.set(file, audio);
    }
  }
  playSample(name, volume = .45, polyphony = 1) {
    const file = sampleFiles[name] ?? name;
    let audio = this.samples.get(file);
    if (!audio) return;
    if (polyphony > 1 && !audio.paused) {
      if (!this.sampleVoices.has(file)) this.sampleVoices.set(file, []);
      const voices = this.sampleVoices.get(file);
      const available = voices.find(voice => voice.paused);
      if (available) audio = available;
      else if (voices.length < polyphony - 1) {
        audio = new Audio(audio.src);
        voices.push(audio);
      }
    }
    audio.volume = volume;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }
  playPannedSample(name, volume, pan, polyphony = 1) {
    const context = this.context;
    const file = sampleFiles[name] ?? name;
    const sample = this.samples.get(file);
    if (!sample) return;
    const spatial = window.location?.protocol !== 'file:' && this.enabled
      && context?.state === 'running' && Boolean(context.createStereoPanner);
    if (!spatial && polyphony === 1) return this.playSample(name, volume);
    if (!this.pannedSamples.has(file)) this.pannedSamples.set(file, []);
    const voices = this.pannedSamples.get(file);
    const compatible = voices.filter(({ panner }) => Boolean(panner) === spatial);
    let voice = compatible.find(({ audio }) => audio.paused);
    if (!voice && compatible.length >= polyphony) {
      if (polyphony > 1) return;
      [voice] = compatible;
    }
    if (!voice) {
      const audio = new Audio(sample.src);
      const panner = spatial ? context.createStereoPanner() : null;
      if (panner) context.createMediaElementSource(audio).connect(panner).connect(context.destination);
      voice = { audio, panner };
      voices.push(voice);
    }
    if (voice.panner) voice.panner.pan.value = pan;
    voice.audio.volume = volume;
    voice.audio.currentTime = 0;
    voice.audio.play().catch(() => {});
  }
  playExclusiveSample(files, volume) {
    if (this.exclusiveSample && !this.exclusiveSample.paused) return;
    const file = files[Math.floor(Math.random() * files.length)];
    const sample = this.samples.get(file);
    if (!sample) return;
    this.exclusiveSample = new Audio(sample.src);
    this.exclusiveSample.volume = volume;
    this.exclusiveSample.play().catch(() => {});
  }
  stopExclusiveSample() {
    this.exclusiveSample?.pause();
    this.exclusiveSample = undefined;
  }
  setSampleLoop(name, volume) {
    const audio = this.samples.get(sampleFiles[name]);
    if (!audio) return;
    if (volume === 0) {
      if (audio.loop) this.stopSample(name);
      return;
    }
    if (audio.loop) {
      if (audio.volume !== volume) audio.volume = volume;
      return;
    }
    audio.loop = true;
    this.playSample(name, volume);
  }
  stopSample(name) {
    const audio = this.samples.get(sampleFiles[name] ?? name);
    if (!audio) return;
    audio.loop = false;
    audio.pause();
  }
  stopSamples() {
    this.stopInvasionLoop();
    this.stopExclusiveSample();
    for (const file of this.samples.keys()) this.stopSample(file);
    for (const voices of this.sampleVoices.values()) for (const audio of voices) audio.pause();
    for (const voices of this.pannedSamples.values()) for (const { audio } of voices) audio.pause();
  }
  setInvasionLoop(active, { file, volume, fadeOutSeconds }) {
    const audio = this.samples.get(file);
    if (!audio || !this.active) return;
    if (active) {
      if (this.invasionAudio === audio && this.invasionFade === undefined) return;
      if (this.invasionFade !== undefined) {
        clearInterval(this.invasionFade);
        this.invasionFade = undefined;
      }
      audio.volume = volume;
      if (this.invasionAudio === audio) return;
      this.invasionAudio = audio;
      audio.loop = true;
      this.playSample(file, volume);
    } else if (this.invasionAudio && this.invasionFade === undefined) {
      const start = performance.now();
      const initialVolume = audio.volume;
      this.invasionFade = setInterval(() => {
        const remaining = Math.max(0, 1 - (performance.now() - start) / (fadeOutSeconds * 1000));
        audio.volume = initialVolume * remaining;
        if (remaining === 0) this.stopInvasionLoop();
      }, 20);
    }
  }
  stopInvasionLoop() {
    if (this.invasionFade !== undefined) {
      clearInterval(this.invasionFade);
      this.invasionFade = undefined;
    }
    if (!this.invasionAudio) return;
    this.invasionAudio.loop = false;
    this.invasionAudio.pause();
    this.invasionAudio = undefined;
  }
  cameraMeow(sanity) {
    const clips = cameraMeows[Number(sanity < 50)];
    this.playSample(clips[Math.floor(Math.random() * clips.length)]);
  }
  async enable() {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return false;
    try {
      if (!this.context) this.context = new Ctor();
      await this.context.resume();
      this.enabled = true;
      if (this.active) {
        this.startAmbience();
        // A click may start radio playback before AudioContext unlocking ends.
        if (this.radioMedia) this.connectRadio(this.radioMedia);
      } else this.context.suspend().catch(() => {});
      return true;
    } catch { return false; }
  }
  startAmbience() {
    if (!this.active || this.context?.state !== 'running' || this.ambient) return;
    const osc = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    osc.type='sine'; osc.frequency.value=55;
    filter.type='lowpass';filter.frequency.value=155;
    gain.gain.value=.018;
    osc.connect(filter).connect(gain).connect(this.context.destination);
    osc.start();
    this.ambient = { osc, filter, gain };
  }
  startShift() {
    this.active = true;
    if (!this.enabled) return;
    this.context.resume().then(() => this.startAmbience(), () => {});
  }
  stopShift() {
    this.active = false;
    this.stopSamples();
    for (const voice of this.tones) {
      voice.cleanup();
      voice.osc.stop();
    }
    if (this.ambient) {
      const { osc, filter, gain } = this.ambient;
      this.ambient = null;
      osc.stop();
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
    }
    this.disconnectRadio();
    if (this.enabled) this.context.suspend().catch(() => {});
  }
  tone({frequency=330, endingFrequency=120, duration=.12, volume=.06, wave='triangle'}={}) {
    if (!this.active || this.context?.state !== 'running') return;
    const osc=this.context.createOscillator();
    const gain=this.context.createGain();
    const t=this.context.currentTime;
    osc.type=wave;
    osc.frequency.setValueAtTime(frequency,t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40,endingFrequency),t+duration);
    gain.gain.setValueAtTime(.0001,t);
    gain.gain.exponentialRampToValueAtTime(volume,t+Math.min(.008,duration/2));
    gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
    const voice = { osc, cleanup: () => {
      if (!this.tones.delete(voice)) return;
      osc.onended = null;
      osc.disconnect();
      gain.disconnect();
    } };
    this.tones.add(voice);
    osc.onended = voice.cleanup;
    osc.connect(gain).connect(this.context.destination);
    osc.start(t);
    osc.stop(t+duration+.01);
  }
  monitor(){this.tone({frequency:160,endingFrequency:70,duration:.21,volume:.07,wave:'sawtooth'});}
  switch(){this.tone({frequency:520,endingFrequency:180,duration:.08,volume:.055,wave:'square'});}
  connectRadio(media) {
    // Keep pending playback so the radio is rerouted after the AudioContext is unlocked.
    this.radioMedia = media;
    const context = this.context;
    // Chromium cannot reliably route local file:// audio through Web Audio.
    if (window.location?.protocol === 'file:' || this.radio || !this.enabled || !context?.createStereoPanner) return;
    // Each media element can have only one source node in its AudioContext.
    this.radioSource ??= context.createMediaElementSource(media);
    const highpass = context.createBiquadFilter();
    highpass.type = 'highpass';
    // Downmix stereo to a single speaker before filtering and spatial panning.
    highpass.channelCount = 1;
    highpass.channelCountMode = 'explicit';
    highpass.frequency.value = 170;
    const lowpass = context.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 4400;
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -23;
    compressor.knee.value = 16;
    compressor.ratio.value = 3;
    compressor.attack.value = .008;
    compressor.release.value = .17;
    const panner = context.createStereoPanner();
    const gain = context.createGain();
    gain.gain.value = 0;
    this.radioSource.connect(highpass).connect(lowpass).connect(compressor)
      .connect(panner).connect(gain).connect(context.destination);
    this.radio = { highpass, lowpass, compressor, panner, gain };
    media.volume = 1;
    // Apply the last requested mix even when AudioContext was enabled late.
    if (this.radioMixRequest) this.mixRadio(media, ...this.radioMixRequest);
  }

  disconnectRadio() {
    this.radioMedia = null;
    this.radioMixRequest = null;
    if (!this.radio) return;
    const { highpass, lowpass, compressor, panner, gain } = this.radio;
    this.radioSource.disconnect();
    highpass.disconnect();
    lowpass.disconnect();
    compressor.disconnect();
    panner.disconnect();
    gain.disconnect();
    this.radio = null;
  }

  mixRadio(media, pan, behindDoor, normalization = 1, profile = 'normal') {
    this.radioMixRequest = [pan, behindDoor, normalization, profile];
    const recordingGain = profile === 'tsundere' ? .82 : 1;
    const volume = (behindDoor ? .035 : .13 * (1 - .4 * Math.abs(pan)))
      * normalization * recordingGain;
    if (!this.radio) {
      if (media.volume !== volume) media.volume = volume;
      return;
    }
    const { highpass, lowpass, panner, gain } = this.radio;
    if (this.radio.pan === pan && this.radio.behindDoor === behindDoor
        && this.radio.normalization === normalization && this.radio.profile === profile) return;
    this.radio.pan = pan;
    this.radio.behindDoor = behindDoor;
    this.radio.normalization = normalization;
    this.radio.profile = profile;
    const now = this.context.currentTime;
    highpass.frequency.setTargetAtTime(behindDoor ? 240 : 170, now, .045);
    lowpass.frequency.setTargetAtTime(behindDoor ? 1100 : profile === 'tsundere' ? 2600 : 4400, now, .045);
    panner.pan.setTargetAtTime(pan * .85, now, .045);
    gain.gain.setTargetAtTime(volume, now, .045);
  }

  stats() {
    let playingSamples = 0;
    let samples = this.samples.size;
    for (const audio of this.samples.values()) if (!audio.paused) playingSamples++;
    for (const voices of this.sampleVoices.values()) {
      samples += voices.length;
      for (const audio of voices) if (!audio.paused) playingSamples++;
    }
    return { context: this.context?.state ?? 'unavailable', tones: this.tones.size,
      ambience: Boolean(this.ambient), radio: Boolean(this.radio), playingSamples, samples };
  }
}

window.NathGame.SoundEngine = SoundEngine;

})();
