(() => {
'use strict';

// Créditos cinematográficos: 25 cartelas de 8s = 3min20s, com 11 cenas distintas.
// Nomes musicais identificam os respectivos criadores, sem implicar licenciamento.
const ASSETS = Object.freeze({
  credits: Object.freeze({
    image: './public/images/ending/creditos.png',
    audio: './public/audio/ending/creditos.mp3'
  }),
  death: Object.freeze({
    image: './public/images/ending/armarios.png',
    audio: './public/audio/ending/morte.mp3'
  }),
  newRadioTrack: 'musica-nova.mp3',
  creditsRadioTrack: 'creditos.mp3'
});

const DEATH_MESSAGE = 'Agora só falta um para termos certeza de que ele foi morto.\nOs outros poderão aproveitar a festa para sempre.';
// A duração e a última despedida vêm do MP3; 200s é apenas a escala de referência.
const CREDIT_REFERENCE_SECONDS = 200;
const CREDIT_SILENT_OUTRO_SECONDS = 7;
const CREDIT_DIR = './public/images/ending/';
const CREDIT_SHOTS = Object.freeze([
  { image: CREDIT_DIR + 'creditos.png', motion: 'float', layout: 'title', pages: [
    { at: 0, pair: [['NINE NIGHTS AT NATH\'S', ''], ['', '']] }
  ] },
  { image: CREDIT_DIR + 'recepcao.png', motion: 'drift-left', pages: [
    { at: 9, pair: [['CRIAÇÃO E DIREÇÃO', 'Leon Soto'], ['PROGRAMAÇÃO', 'Leon Soto']] },
    { at: 17, pair: [['GAME DESIGN', 'Leon Soto'], ['INTELIGÊNCIA ARTIFICIAL', 'Leon Soto']] }
  ] },
  { image: CREDIT_DIR + 'vip-bonecas.png', motion: 'drift-right', pages: [
    { at: 25, pair: [['HISTÓRIA E ROTEIRO', 'Leon Soto'], ['DESIGN DE MECÂNICAS', 'Leon Soto']] },
    { at: 33, pair: [['INSPIRAÇÃO PARA OS SEGURANÇAS', 'Pedro Garcia · Pedro Babugia'], ['BALANCEAMENTO DAS NOITES', 'Leon Soto']] }
  ] },
  { image: CREDIT_DIR + 'gotica-vip-roxo.png', motion: 'pull-back', pages: [
    { at: 41, pair: [['ARTE E AMBIENTAÇÃO', 'Leon Soto'], ['DESIGN DAS ANIMATRÔNICAS', 'Leon Soto']] },
    { at: 49, pair: [['INSPIRAÇÃO PARA OS SEGURANÇAS', 'Henrique Baatalha · Caio Pontes'], ['ARQUITETURA DO RESTAURANTE', 'Leon Soto']] }
  ] },
  { image: CREDIT_DIR + 'maid-gatinha-cozinha.png', motion: 'drift-up', pages: [
    { at: 57, pair: [['ANIMAÇÕES E CINEMÁTICAS', 'Leon Soto'], ['INTERFACE E UX', 'Leon Soto']] },
    { at: 65, pair: [['INSPIRAÇÃO PARA NATHZINHA', 'Nathali Thomazine'], ['INSPIRAÇÃO ARTÍSTICA', 'Nathali Thomazine']] }
  ] },
  { image: CREDIT_DIR + 'maid-oficina.png', motion: 'creep-in', pages: [
    { at: 73, pair: [['DESIGN DE SOM', 'Leon Soto'], ['CURADORIA MUSICAL', 'Leon Soto']] },
    { at: 81, pair: [['INSPIRAÇÃO PARA OS SEGURANÇAS', 'Felipe Riva · Felipe Lima'], ['DIREÇÃO DE ARTE', 'Leon Soto']] }
  ] },
  { image: CREDIT_DIR + 'fliperama.png', motion: 'drift-right', pages: [
    { at: 89, pair: [['MÚSICA · SHIKAIRO DAYS', 'Shika-bu · Yūki Waga\nKana Yaginuma'], ['MÚSICA · KAWAIKUTE GOMEN', 'HoneyWorks · shito']] },
    { at: 97, pair: [['MÚSICA · CARAMELLDANSEN', 'Caramell\nJorge Vasconcelo · Juha Myllylä'], ['MÚSICA · IT\'S NOT LIKE I LIKE YOU!!', 'Static-P · Amree']] }
  ] },
  { image: CREDIT_DIR + 'yandere-corredor-leste.png', motion: 'drift-left', pages: [
    { at: 105, pair: [['INSPIRADO EM', 'Five Nights at Freddy\'s\nScott Cawthon'], ['SONS E REFERÊNCIAS', 'Five Nights at Freddy\'s']] },
    { at: 113, pair: [['INSPIRAÇÃO PARA OS SEGURANÇAS', 'Arthur Ramos · Rafael Ferraz'], ['MÚSICA · JOIN US FOR A BITE', 'JT Music\nAndrea Storm Kaden']] }
  ] },
  { image: CREDIT_DIR + 'palhaca-escritorio.png', motion: 'creep-in', pages: [
    { at: 121, pair: [['MÚSICA · THE AMAZING DIGITAL CIRCUS', 'Gooseworx (tema)\nEvan Alderete (trilha)'], ['ASSISTÊNCIA CRIATIVA', 'ChatGPT (GPT) · OpenAI']] },
    { at: 129, pair: [['ASSISTÊNCIA À PROGRAMAÇÃO', 'OpenAI Codex'], ['TECNOLOGIAS DE DESENVOLVIMENTO', 'HTML · CSS · JavaScript']] }
  ] },
  { image: CREDIT_DIR + 'corredor-bonecas.png', motion: 'drift-up', pages: [
    { at: 137, pair: [['INSPIRAÇÃO PARA OS SEGURANÇAS', 'Paulo Ventura · Arthur Guedes'], ['VERSIONAMENTO E PUBLICAÇÃO', 'GitHub · GitHub Pages']] },
    { at: 145, pair: [['INSPIRAÇÃO PARA NATHZINHA', 'Nathali Thomazine'], ['PERSONAGENS E AMBIENTES', 'Concepção do universo NNN']] }
  ] },
  { image: CREDIT_DIR + 'lounge-rosa-roxo.png', motion: 'pull-back', pages: [
    { at: 153, pair: [['INSPIRAÇÃO PARA OS SEGURANÇAS', 'Alexandre Do Bim · João Gannoun'], ['', '']] },
    { at: 161, pair: [['AGRADECIMENTO ESPECIAL', 'Nathali Thomazine'], ['', '']] },
    { at: 169, pair: [['A TODOS QUE INSPIRARAM ESSA HISTÓRIA', 'Obrigado por fazerem parte dela.'], ['', '']] }
  ] },
  // Era a segunda cena dos créditos; agora fecha a história com o palco vazio.
  { image: CREDIT_DIR + 'restaurante-vazio.png', motion: 'stage-finale', layout: 'finale', pages: [
    { at: 177, pair: [['OBRIGADO POR JOGAR', ''], ['', '']] },
    { at: 185, pair: [['NINE NIGHTS AT NATH\'S', 'Até a próxima noite.'], ['', '']] }
  ] }
]);
const CREDIT_PAGES = Object.freeze(CREDIT_SHOTS.flatMap((shot, shotIndex) =>
  shot.pages.map(page => Object.freeze({ ...page, shotIndex, pair: page.pair }))));
const CREDIT_PAIRS = Object.freeze(CREDIT_PAGES.map(page => page.pair));
const CREDIT_MOTIONS = ['float', 'creep-in', 'drift-left', 'drift-right', 'pull-back', 'drift-up', 'stage-finale'];
function creditCueTime(at, duration = CREDIT_REFERENCE_SECONDS) {
  const safeDuration = Number.isFinite(duration) && duration > CREDIT_SILENT_OUTRO_SECONDS + 15
    ? duration : CREDIT_REFERENCE_SECONDS;
  return at * (safeDuration - CREDIT_SILENT_OUTRO_SECONDS)
    / (CREDIT_REFERENCE_SECONDS - CREDIT_SILENT_OUTRO_SECONDS);
}

function panoramaWidth(naturalWidth, naturalHeight, viewportWidth, viewportHeight) {
  if (!(naturalWidth > 0 && naturalHeight > 0 && viewportWidth > 0 && viewportHeight > 0)) {
    return Math.max(0, viewportWidth);
  }
  return Math.max(viewportWidth * 1.12, naturalWidth / naturalHeight * viewportHeight);
}

// Pan cerca de 20% mais rápido, reservando a leitura do texto após a travessia.
function deathPanDuration(audioSeconds) {
  return Number.isFinite(audioSeconds) && audioSeconds > 18
    ? Math.max(12000, Math.min(60000, (audioSeconds * 1000 - 13000) * .8))
    : 23000;
}

function createCinematics() {
  const root = document.querySelector('#cinematic');
  const image = document.querySelector('#cinematic-image');
  const nextImage = document.querySelector('#cinematic-image-next');
  const audio = document.querySelector('#cinematic-audio');
  const missing = document.querySelector('#cinematic-missing');
  const quote = document.querySelector('#cinematic-quote');
  const credits = document.querySelector('#cinematic-credits');
  const cards = [...credits.querySelectorAll('.cinematic-credit')];
  const closeButton = document.querySelector('#cinematic-close');
  const enableAudio = document.querySelector('#cinematic-enable-audio');
  let mode = null;
  let onClose = null;
  let previousFocus = null;
  let timers = [];
  let token = 0;
  let creditsShot = -1;
  let creditsPage = -1;
  let creditsFrame = null;
  let creditFallbackTimer = null;
  let creditFallbackStart = 0;
  let creditsEpilogue = false;
  let rhythm = null;
  let activeImage = image;
  let preload = null;
  let soundEnded = false;
  let soundFailed = false;
  let deathTyped = false;
  let deathPanStarted = false;

  function later(callback, ms) {
    const id = setTimeout(() => {
      timers = timers.filter(item => item !== id);
      callback();
    }, ms);
    timers.push(id);
  }

  function missingAsset(assetPath) {
    if (!mode) return;
    const item = document.createElement('span');
    item.textContent = 'Arquivo pendente: ' + assetPath.replace(/^\.\/public\//, 'public/');
    missing.append(item);
    missing.hidden = false;
  }

  function clearImageState(img) {
    img.onload = img.onerror = null;
    img.removeAttribute('src');
    img.style.removeProperty('width');
    img.style.removeProperty('height');
    img.style.removeProperty('top');
    img.style.removeProperty('--pan-distance');
    img.style.removeProperty('--pan-ms');
    img.classList.remove('is-panning', 'is-current', ...CREDIT_MOTIONS.map(motion => 'is-' + motion));
  }

  function stop(notify = true) {
    if (!mode) return;
    token++;
    mode = null;
    for (const id of timers) clearTimeout(id);
    timers = [];
    if (creditsFrame != null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(creditsFrame);
    creditsFrame = null;
    if (creditFallbackTimer != null) clearTimeout(creditFallbackTimer);
    creditFallbackTimer = null;
    if (rhythm) {
      const source = rhythm;
      rhythm = null;
      source.stream.getTracks().forEach(track => track.stop());
      source.context.close().catch(() => {});
    }
    audio.pause();
    audio.onended = audio.onerror = audio.onloadedmetadata = null;
    audio.removeAttribute('src');
    audio.load();
    clearImageState(image);
    clearImageState(nextImage);
    root.hidden = true;
    root.classList.remove('is-finale', 'is-epilogue');
    root.style.removeProperty('--outro-ms');
    delete root.dataset.mode;
    delete credits.dataset.layout;
    quote.textContent = '';
    missing.replaceChildren();
    missing.hidden = true;
    enableAudio.hidden = true;
    creditsShot = -1;
    creditsPage = -1;
    creditsEpilogue = false;
    activeImage = image;
    preload = null;
    const callback = onClose;
    onClose = null;
    if (notify) {
      previousFocus?.focus?.({ preventScroll: true });
      callback?.();
    }
    previousFocus = null;
  }

  function creditsDuration() {
    return Number.isFinite(audio.duration) && audio.duration > 22
      ? audio.duration : CREDIT_REFERENCE_SECONDS;
  }

  function showCreditsShot(index) {
    const shot = CREDIT_SHOTS[index];
    const incoming = creditsShot === -1 ? image : (activeImage === image ? nextImage : image);
    incoming.classList.remove('is-current', ...CREDIT_MOTIONS.map(motion => 'is-' + motion));
    incoming.src = shot.image;
    const nextShot = CREDIT_SHOTS[index + 1];
    const begin = creditCueTime(shot.pages[0].at, creditsDuration());
    const end = nextShot ? creditCueTime(nextShot.pages[0].at, creditsDuration()) : creditsDuration();
    incoming.style.setProperty('--shot-ms', Math.round(Math.max(1500, (end - begin) * 1000)) + 'ms');
    void incoming.offsetWidth;
    incoming.classList.add('is-current', 'is-' + shot.motion);
    if (creditsShot !== -1) activeImage.classList.remove('is-current');
    activeImage = incoming;
    creditsShot = index;
    // Apenas a próxima imagem é preparada; evita carregar todos os PNGs juntos.
    preload = nextShot ? document.createElement('img') : null;
    if (preload) preload.src = nextShot.image;
  }

  function showCreditsPage(index) {
    if (mode !== 'credits' || creditsEpilogue || index === creditsPage) return;
    const page = CREDIT_PAGES[index];
    if (!page) return;
    if (page.shotIndex !== creditsShot) showCreditsShot(page.shotIndex);
    const shot = CREDIT_SHOTS[page.shotIndex];
    credits.dataset.layout = shot.layout || 'standard';
    creditsPage = index;
    const endAt = index + 1 < CREDIT_PAGES.length
      ? creditCueTime(CREDIT_PAGES[index + 1].at, creditsDuration())
      : creditsDuration() - CREDIT_SILENT_OUTRO_SECONDS;
    const pageAt = creditCueTime(page.at, creditsDuration());
    credits.style.setProperty('--credit-page-ms', Math.max(900, (endAt - pageAt) * 1000) + 'ms');
    cards.forEach((card, i) => {
      const [role, name] = page.pair[i];
      card.querySelector('.cinematic-credit-role').textContent = role;
      card.querySelector('.cinematic-credit-name').textContent = name;
      card.classList.toggle('is-empty', !role && !name);
      card.classList.toggle('is-compact', name.length > 32 || role.length > 34);
      card.classList.toggle('is-roster', name.split('\n').length > 2);
    });
    credits.classList.remove('is-visible');
    void credits.offsetWidth;
    credits.classList.add('is-visible');
  }

  function enterCreditsEpilogue() {
    if (creditsEpilogue) return;
    creditsEpilogue = true;
    credits.classList.remove('is-visible');
    root.classList.add('is-epilogue');
    root.style.setProperty('--outro-ms', (CREDIT_SILENT_OUTRO_SECONDS * 1000) + 'ms');
  }

  // Captura o som da música sem redirecionar nem silenciar o áudio original.
  // Onde captureStream / Web Audio não estão disponíveis, as marcas de frase
  // continuam exatas porque usam audio.currentTime.
  function startCreditsRhythm(sceneToken) {
    if (mode !== 'credits' || token !== sceneToken || rhythm) return;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context || typeof audio.captureStream !== 'function') return;
    let context;
    let stream;
    try {
      stream = audio.captureStream();
      if (!stream.getAudioTracks().length) return;
      context = new Context();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = .58;
      source.connect(analyser);
      // Nó de ganho mudo: mantém o analisador ativo sem duplicar a trilha.
      const mute = context.createGain();
      mute.gain.value = 0;
      analyser.connect(mute);
      mute.connect(context.destination);
      rhythm = {
        context, stream, analyser, data: new Uint8Array(analyser.frequencyBinCount),
        baseline: 0, lastPulse: -10
      };
      context.resume().catch(() => {});
    } catch {
      if (context) context.close().catch(() => {});
      if (stream) stream.getTracks().forEach(track => track.stop());
    }
  }

  function hasRhythmPulse(position) {
    if (!rhythm || rhythm.context.state !== 'running') return true;
    const { analyser, data } = rhythm;
    analyser.getByteFrequencyData(data);
    let sum = 0;
    // Banda entre graves e médios, onde batidas e ataques vocais aparecem.
    for (let i = 2; i < 31; i++) sum += data[i];
    const energy = sum / 29;
    const average = rhythm.baseline || energy;
    const onset = energy > 32 && energy > average * 1.16
      && position - rhythm.lastPulse > .29;
    rhythm.baseline = average * .92 + energy * .08;
    if (onset) rhythm.lastPulse = position;
    return onset || position - rhythm.lastPulse <= .10;
  }

  function creditsTick() {
    if (mode !== 'credits') return;
    const duration = creditsDuration();
    // O áudio, e não um contador de setTimeout, é o relógio principal.
    const position = soundFailed
      ? (Date.now() - creditFallbackStart) / 1000
      : Math.max(0, Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
    if (position >= duration - CREDIT_SILENT_OUTRO_SECONDS) enterCreditsEpilogue();
    else {
      let page = 0;
      while (page + 1 < CREDIT_PAGES.length
        && position >= creditCueTime(CREDIT_PAGES[page + 1].at, duration)) page++;
      // Uma cartela aguarda até 0,48s um ataque do áudio próximo à marca
      // para que o corte coincida com o pulso, sem atrasar o roteiro se faltar sinal.
      const cue = creditCueTime(CREDIT_PAGES[page].at, duration);
      if (page > creditsPage && creditsPage >= 0 && rhythm
        && position < cue + .48 && !hasRhythmPulse(position)) page = creditsPage;
      else if (rhythm) hasRhythmPulse(position);
      showCreditsPage(page);
    }
    if (soundFailed && position >= duration) { stop(); return; }
    if (typeof requestAnimationFrame === 'function') {
      creditsFrame = requestAnimationFrame(creditsTick);
    } else {
      creditFallbackTimer = setTimeout(creditsTick, 100);
    }
  }

  function resizeDeathImage() {
    if (mode !== 'death' || !image.naturalWidth) return;
    const height = root.clientHeight * 1.10;
    const width = panoramaWidth(image.naturalWidth, image.naturalHeight,
      root.clientWidth, root.clientHeight) * 1.10;
    image.style.width = width + 'px';
    image.style.height = height + 'px';
    image.style.top = (root.clientHeight - height) / 2 + 'px';
    image.style.setProperty('--pan-distance', (root.clientWidth - width) + 'px');
  }

  function typeDeathLine() {
    if (mode !== 'death') return;
    let length = 0;
    function addLetter() {
      if (mode !== 'death') return;
      quote.textContent = DEATH_MESSAGE.slice(0, ++length);
      if (length < DEATH_MESSAGE.length) later(addLetter, 62);
      else {
        deathTyped = true;
        if (soundEnded || soundFailed) later(() => stop(), 6200);
      }
    }
    addLetter();
  }

  function startDeathPan() {
    if (mode !== 'death' || deathPanStarted) return;
    deathPanStarted = true;
    resizeDeathImage();
    const panMs = deathPanDuration(audio.duration);
    image.style.setProperty('--pan-ms', panMs + 'ms');
    image.classList.remove('is-panning');
    void image.offsetWidth;
    image.classList.add('is-panning');
    later(typeDeathLine, panMs);
  }

  function play(kind, { onFinish } = {}) {
    if (!ASSETS[kind]) throw new Error('Cena desconhecida: ' + kind);
    stop(false);
    const sceneToken = ++token;
    mode = kind;
    onClose = onFinish || null;
    previousFocus = document.activeElement;
    creditsShot = -1;
    creditsPage = -1;
    creditsEpilogue = false;
    activeImage = image;
    preload = null;
    creditFallbackStart = Date.now();
    soundEnded = soundFailed = deathTyped = deathPanStarted = false;
    root.dataset.mode = kind;
    root.hidden = false;
    root.classList.remove('is-finale', 'is-epilogue');
    quote.textContent = '';
    credits.hidden = kind !== 'credits';
    quote.hidden = kind !== 'death';
    nextImage.hidden = kind !== 'credits';
    missing.hidden = true;
    missing.replaceChildren();
    enableAudio.hidden = true;
    closeButton.textContent = kind === 'credits' ? 'PULAR CRÉDITOS' : 'CONTINUAR';
    closeButton.focus({ preventScroll: true });

    image.onload = () => {
      if (sceneToken !== token) return;
      if (kind === 'death') startDeathPan();
    };
    image.onerror = () => {
      if (sceneToken !== token) return;
      missingAsset(ASSETS[kind].image);
      if (kind === 'death') startDeathPan();
    };
    image.src = ASSETS[kind].image;

    audio.onloadedmetadata = () => {
      if (sceneToken !== token) return;
      // Duração real do áudio ajusta automaticamente os tempos das cartelas.
    };
    audio.onerror = () => {
      if (sceneToken !== token) return;
      soundFailed = true;
      missingAsset(ASSETS[kind].audio);
      // Sem a trilha, encerra rapidamente em vez de reproduzir créditos longos em silêncio.
      if (kind === 'credits') later(() => stop(), 5000);
      if (kind === 'death' && deathTyped) later(() => stop(), 6200);
    };
    audio.onended = () => {
      if (sceneToken !== token) return;
      soundEnded = true;
      if (kind === 'credits') { stop(); return; }
      if (kind === 'death' && deathTyped) later(() => stop(), 6200);
    };
    audio.src = ASSETS[kind].audio;
    audio.volume = kind === 'death' ? .72 : .65;
    audio.currentTime = 0;
    const playback = audio.play();
    if (playback?.then && kind === 'credits') {
      playback.then(() => startCreditsRhythm(sceneToken), () => {});
    }
    if (playback?.catch) playback.catch(() => {
      if (sceneToken === token && !soundFailed) enableAudio.hidden = false;
    });
    if (kind === 'credits') {
      showCreditsPage(0);
      creditsTick();
    } else later(startDeathPan, 2000);
  }

  enableAudio.addEventListener('click', () => {
    audio.play().then(() => {
      enableAudio.hidden = true;
      if (mode === 'credits') startCreditsRhythm(token);
    }).catch(() => {});
  });
  closeButton.addEventListener('click', () => stop());
  document.addEventListener('keydown', event => {
    if (mode && event.key === 'Escape') {
      event.preventDefault();
      stop();
    }
  });
  window.addEventListener('resize', resizeDeathImage);
  return { play, stop, active: () => Boolean(mode) };
}

window.NathGame.endingAssets = ASSETS;
window.NathGame.CINEMATIC_DEATH_MESSAGE = DEATH_MESSAGE;
window.NathGame.cinematicCreditPairs = CREDIT_PAIRS;
window.NathGame.cinematicCreditShots = CREDIT_SHOTS;
window.NathGame.cinematicCreditsDuration = CREDIT_REFERENCE_SECONDS * 1000;
window.NathGame.cinematicCreditCueTime = creditCueTime;
window.NathGame.cinematicCreditsOutroSeconds = CREDIT_SILENT_OUTRO_SECONDS;
window.NathGame.panoramaWidth = panoramaWidth;
window.NathGame.deathPanDuration = deathPanDuration;
window.NathGame.createCinematics = createCinematics;
})();