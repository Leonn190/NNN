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
    this.mediaEpoch = 0;
    this.nightMedia = new Map();
    this.radioSources = new WeakMap();
    this.pendingSampleEvents = new Set();
    this.lastSampleVoice = new Map();
  }
  prepareShift(settings, number, effects) {
    this.stopNightAudio();
    this.nightAudio = settings;
    const file = settings.phone.files[number];
    this.phone = { file, status: file ? 'pending' : 'unavailable', finishedAt: -Infinity };
    this.eventSounds = effects?.eventSounds;
    this.specialVoiceRules = effects?.specialVoices;
    this.specialVoices = { enabled: effects?.specialVoices?.campaignNights.includes(number) ?? false,
      used: new Set(), absentSince: 0, absenceRolled: false, padraoInvasion: false };
  }
  playConfiguredEffect(name) {
    const rule = this.eventSounds?.[name];
    if (!rule || !this.active) return;
    const file = rule.file ?? rule.files[Math.floor(Math.random() * rule.files.length)];
    this.playSample(file, rule.volume);
  }
  playAfterSample(name, callback) {
    const audio = this.lastSampleVoice.get(name);
    if (!audio || audio.paused || audio.ended) { if (this.active) callback(); return; }
    const epoch = this.mediaEpoch;
    const cancel = () => {
      audio.removeEventListener('ended', ended);
      audio.removeEventListener('error', ended);
      this.pendingSampleEvents.delete(cancel);
    };
    const ended = () => { cancel(); if (this.active && epoch === this.mediaEpoch) callback(); };
    this.pendingSampleEvents.add(cancel);
    audio.addEventListener('ended', ended, { once: true });
    audio.addEventListener('error', ended, { once: true });
  }
  playSpecialVoice(name, chance = 1) {
    const state = this.specialVoices, rule = this.specialVoiceRules?.[name];
    if (!this.active || !state?.enabled || !rule) return false;
    const available = (rule.files ?? [rule.file]).filter(file => !state.used.has(file));
    if (!available.length || (chance < 1 && Math.random() >= chance)) return false;
    const file = available[Math.floor(Math.random() * available.length)];
    state.used.add(file);
    this.playSample(file, rule.volume);
    return true;
  }
  handleGameAudioEvent(event, value) {
    if (event === 'defended') this.playSpecialVoice('defense');
    else if (event === 'padraoAttackWarning') this.playSpecialVoice('attackWarning');
    else if (event === 'invasion' && value.key === 'padrao' && this.specialVoices) {
      this.specialVoices.padraoInvasion = this.playSpecialVoice('invasion', this.specialVoiceRules?.invasion.chance);
    } else if (event === 'move' && value.actor.key === 'padrao' && value.from !== value.to) {
      this.playSpecialVoice('birthday', this.specialVoiceRules?.birthday.chance);
    }
  }
  updateSpecialVoices(now, observing) {
    const state = this.specialVoices;
    if (!this.active || !state?.enabled) return;
    if (observing) { state.absentSince = undefined; state.absenceRolled = false; return; }
    state.absentSince ??= now;
    const rule = this.specialVoiceRules.cameraAbsence;
    if (!state.absenceRolled && now - state.absentSince >= rule.seconds) {
      state.absenceRolled = true;
      this.playSpecialVoice('cameraAbsence', rule.chance);
    }
  }
  randomInterval(range) { return range[0] + Math.random() * (range[1] - range[0]); }
  nightClip(file) {
    if (!this.nightMedia.has(file)) {
      const audio = new Audio(`./public/${file}`);
      audio.preload = 'metadata';
      audio.onerror = () => { audio.nightPlaybackFailed = true; };
      this.nightMedia.set(file, audio);
    }
    return this.nightMedia.get(file);
  }
  playNightClip(audio) {
    const epoch = this.mediaEpoch;
    audio.nightPlaybackFailed = false;
    audio.play().then(() => {
      // A late play promise must not revive an ended attempt or a retired voice.
      if (epoch !== this.mediaEpoch || !this.active || !this.isNightClipActive(audio)) audio.pause();
    }, () => { if (epoch === this.mediaEpoch) audio.nightPlaybackFailed = true; });
  }
  isNightClipActive(audio) {
    return this.ambienceVoice?.audio === audio || this.retiringAmbience?.audio === audio
      || this.sanityMusicBox?.audio === audio;
  }
  stopNightAudio() {
    this.mediaEpoch++;
    for (const cancel of this.pendingSampleEvents) cancel();
    this.specialVoices = null;
    for (const audio of this.nightMedia.values()) {
      audio.pause();
      audio.onerror = null;
      audio.removeAttribute('src');
      audio.load?.();
    }
    this.nightMedia.clear();
    this.ambienceVoice = this.retiringAmbience = this.sanityMusicBox = null;
    this.nextAmbienceAt = Infinity;
    this.lastNightUpdate = undefined;
    this.lastAmbience = undefined;
    this.criticalUntil = 0;
    this.ambienceDuck = 1;
    if (this.phone) this.phone.status = 'stopped';
    if (this.radioMedia) {
      this.radioMedia.pause();
      this.disconnectRadio();
    }
  }
  markCritical() {
    if (this.nightAudio) this.criticalUntil = performance.now() / 1000 + this.nightAudio.mix.criticalHoldSeconds;
  }
  beginAmbience(now, sanity) {
    const options = this.nightAudio.ambience;
    const choices = options.tracks.map((track, index) => ({ ...track, index }))
      .filter(track => track.index !== this.lastAmbience
        && (track.index !== 2 || sanity < options.sanityThreshold));
    const weight = track => track.index === 2
      ? 1 + options.lowSanityWeight * (1 - sanity / options.sanityThreshold) : 1;
    let draw = Math.random() * choices.reduce((sum, track) => sum + weight(track), 0);
    const track = choices.find(track => (draw -= weight(track)) <= 0) ?? choices.at(-1);
    if (!track) return;
    if (this.retiringAmbience) this.retiringAmbience.audio.pause();
    this.retiringAmbience = null;
    if (this.ambienceVoice) {
      this.retiringAmbience = this.ambienceVoice;
      this.retiringAmbience.releaseAt = now;
      this.retiringAmbience.releaseSeconds = options.crossfadeSeconds;
    }
    const audio = this.nightClip(track.file);
    audio.currentTime = 0;
    audio.volume = 0;
    this.ambienceVoice = { audio, track, startedAt: now, envelope: 0,
      attackSeconds: this.retiringAmbience ? options.crossfadeSeconds : options.fadeInSeconds };
    this.lastAmbience = track.index;
    this.nextAmbienceAt = Infinity;
    this.playNightClip(audio);
  }
  updateNightAudio(sanity, now, critical = false) {
    if (!this.active || !this.nightAudio) return;
    const { ambience: options, sanityMusicBox: box, mix } = this.nightAudio;
    const dt = Math.max(0, now - (this.lastNightUpdate ?? now));
    this.lastNightUpdate = now;
    const intensity = Math.max(0, Math.min(1, 1 - sanity));
    if (sanity <= 1 && !this.sanityMusicBox) {
      const audio = this.nightClip(box.file);
      audio.loop = true;
      audio.currentTime = 0;
      audio.volume = 0;
      this.sanityMusicBox = { audio };
      this.playNightClip(audio);
    }
    if (this.sanityMusicBox) {
      const { audio } = this.sanityMusicBox;
      const target = box.maxVolume * intensity;
      const seconds = sanity > 1 ? box.releaseSeconds : box.transitionSeconds;
      audio.volume += (target - audio.volume) * (1 - Math.exp(-dt / seconds));
      if (sanity > 1 && audio.volume < .0001) {
        audio.pause();
        audio.currentTime = 0;
        this.sanityMusicBox = null;
      }
    }
    const targetDuck = Math.min(['playing', 'ending'].includes(this.phone?.status) ? mix.phoneDuck : 1,
      critical || now < this.criticalUntil ? mix.criticalDuck : 1,
      this.sanityMusicBox ? 1 - intensity * (1 - mix.musicBoxDuck) : 1);
    this.ambienceDuck += (targetDuck - this.ambienceDuck)
      * (1 - Math.exp(-dt / (targetDuck < this.ambienceDuck ? mix.duckSeconds : mix.releaseSeconds)));
    if (this.ambient) this.ambient.gain.gain.setTargetAtTime(options.humVolume * this.ambienceDuck, this.context.currentTime, .1);
    if (now >= this.nextAmbienceAt) this.beginAmbience(now, sanity);
    for (const key of ['ambienceVoice', 'retiringAmbience']) {
      const voice = this[key];
      if (!voice) continue;
      const { audio, track } = voice;
      if (voice.releaseAt === undefined && (audio.ended
          || (Number.isFinite(audio.duration) && audio.duration - audio.currentTime <= options.fadeOutSeconds)
          || (track.index === 2 && sanity >= options.sanityThreshold))) {
        voice.releaseAt = now;
        voice.releaseSeconds = Math.min(options.fadeOutSeconds,
          Number.isFinite(audio.duration) ? Math.max(.01, audio.duration - audio.currentTime) : options.fadeOutSeconds);
      }
      if (voice.releaseAt !== undefined) {
        voice.releaseEnvelope ??= voice.envelope;
        voice.envelope = voice.releaseEnvelope * Math.max(0, 1 - (now - voice.releaseAt) / voice.releaseSeconds);
      } else voice.envelope = Math.min(1, (now - voice.startedAt) / voice.attackSeconds);
      audio.volume = track.volume * voice.envelope * this.ambienceDuck;
      if (audio.ended || audio.nightPlaybackFailed || (voice.releaseAt !== undefined && voice.envelope === 0)) {
        audio.pause();
        this[key] = null;
        if (key === 'ambienceVoice') this.nextAmbienceAt = now + this.randomInterval(options.intervalSeconds);
      }
    }
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
    if (['nightmare', 'vent'].includes(name) || /\/(invasion|jumpscares|characters)\//.test(file)) this.markCritical();
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
    this.lastSampleVoice.set(file, audio);
    audio.play().catch(() => {});
  }
  playPannedSample(name, volume, pan, polyphony = 1) {
    this.markCritical();
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
    this.markCritical();
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
    this.stopNightAudio();
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
        if (this.radioMedia) this.connectRadio(this.radioMedia, this.radioMixRequest?.[3]);
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
    gain.gain.value=this.nightAudio?.ambience.humVolume ?? .018;
    osc.connect(filter).connect(gain).connect(this.context.destination);
    osc.start();
    this.ambient = { osc, filter, gain };
  }
  startShift() {
    this.active = true;
    if (this.nightAudio) {
      this.nextAmbienceAt = performance.now() / 1000 + this.randomInterval(this.nightAudio.ambience.firstSeconds);
      this.lastNightUpdate = performance.now() / 1000;
    }
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
  connectRadio(media, profile = 'normal') {
    // Keep pending playback so the radio is rerouted after the AudioContext is unlocked.
    this.radioMedia = media;
    const context = this.context;
    // Chromium cannot reliably route local file:// audio through Web Audio.
    if (window.location?.protocol === 'file:' || this.radio || !this.enabled || !context?.createStereoPanner) return;
    // Each media element can have only one source node in its AudioContext.
    if (!this.radioSources.has(media)) this.radioSources.set(media, context.createMediaElementSource(media));
    this.radioSource = this.radioSources.get(media);
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
    const phone = profile === 'phone' ? this.nightAudio.phone : null;
    let saturation, noise, noiseGain, noiseFilter;
    if (phone) {
      compressor.threshold.value = phone.thresholdDb;
      compressor.ratio.value = phone.ratio;
      saturation = context.createWaveShaper();
      saturation.curve = Float32Array.from({ length: 512 }, (_, i) => {
        const x = i * 2 / 511 - 1;
        return Math.tanh(x * (1 + phone.saturation)) / Math.tanh(1 + phone.saturation);
      });
      // One small shared noise buffer; no decoded copies of long recordings.
      if (!this.phoneNoiseBuffer) {
        this.phoneNoiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
        const data = this.phoneNoiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      noise = context.createBufferSource();
      noise.buffer = this.phoneNoiseBuffer;
      noise.loop = true;
      noiseFilter = context.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.value = 1300;
      noiseGain = context.createGain();
      noiseGain.gain.value = phone.noiseVolume;
      noise.connect(noiseFilter).connect(noiseGain).connect(compressor);
    }
    const panner = context.createStereoPanner();
    const gain = context.createGain();
    gain.gain.value = 0;
    this.radioSource.connect(highpass).connect(lowpass).connect(compressor);
    if (saturation) compressor.connect(saturation).connect(panner);
    else compressor.connect(panner);
    panner.connect(gain).connect(context.destination);
    this.radio = { highpass, lowpass, compressor, panner, gain, saturation, noise, noiseGain, noiseFilter };
    if (noise) { noise.start(); this.phoneConnectionNoise(phone.connectionSeconds); }
    media.volume = 1;
    // Apply the last requested mix even when AudioContext was enabled late.
    if (this.radioMixRequest) this.mixRadio(media, ...this.radioMixRequest);
  }

  disconnectRadio() {
    this.radioMedia = null;
    this.radioMixRequest = null;
    if (!this.radio) return;
    const { highpass, lowpass, compressor, panner, gain } = this.radio;
    this.radio.noise?.stop();
    for (const key of ['noise', 'noiseGain', 'noiseFilter', 'saturation']) this.radio[key]?.disconnect();
    this.radioSource.disconnect();
    highpass.disconnect();
    lowpass.disconnect();
    compressor.disconnect();
    panner.disconnect();
    gain.disconnect();
    this.radio = null;
  }

  phoneConnectionNoise(seconds) {
    if (!this.radio?.noiseGain) return;
    const now = this.context.currentTime;
    const { noiseVolume } = this.nightAudio.phone;
    const gain = this.radio.noiseGain.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(noiseVolume * 3, now);
    gain.linearRampToValueAtTime(noiseVolume, now + seconds);
    this.nextPhoneNoiseAt = performance.now() / 1000 + seconds;
  }

  updatePhoneNoise(now) {
    if (!this.radio?.noiseGain || now < this.nextPhoneNoiseAt) return;
    this.radio.noiseGain.gain.setTargetAtTime(this.nightAudio.phone.noiseVolume * (.7 + Math.random() * .6), this.context.currentTime, .2);
    this.nextPhoneNoiseAt = now + .3 + Math.random() * .7;
  }

  mixRadio(media, pan, behindDoor, normalization = 1, profile = 'normal') {
    this.radioMixRequest = [pan, behindDoor, normalization, profile];
    const recordingGain = profile === 'tsundere' ? .82 : 1;
    const phone = profile === 'phone' ? this.nightAudio.phone : null;
    const volume = (behindDoor ? (phone?.closetVolume ?? .035) : (phone?.volume ?? .13) * (1 - .4 * Math.abs(pan)))
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
    highpass.frequency.setTargetAtTime(phone ? phone.highpassHz : behindDoor ? 240 : 170, now, .045);
    lowpass.frequency.setTargetAtTime(phone ? (behindDoor ? phone.closetLowpassHz : phone.lowpassHz)
      : behindDoor ? 1100 : profile === 'tsundere' ? 2600 : 4400, now, .045);
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
