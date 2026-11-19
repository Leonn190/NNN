(() => {
'use strict';

// Mídias originais do NNN, movidas da raiz de public/ para pastas padronizadas.
// Os arquivos PNG/MP3 são preservados sem reencodificação.
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

const DEATH_MESSAGE = 'Agora só falta 1 para termos certeza que ele foi morto, o outros poderão aproveitar a festa para sempre';

const CREDIT_PAIRS = Object.freeze([
  [['UM JOGO DE', 'Leon Soto'], ['CRIAÇÃO E DIREÇÃO', 'Leon Soto']],
  [['PROGRAMAÇÃO', 'Leon Soto'], ['GAME DESIGN', 'Leon Soto']],
  [['ARTE E AMBIENTAÇÃO', 'Leon Soto'], ['ANIMATRÔNICAS', 'Leon Soto']],
  [['HISTÓRIA E ROTEIRO', 'Leon Soto'], ['EDIÇÃO E PRODUÇÃO', 'Leon Soto']],
  [['DESIGN DE SOM', 'Leon Soto'], ['CURADORIA MUSICAL', 'Leon Soto']],
  [['NINE NIGHTS AT NATH\'S', 'Leon Soto'], ['OBRIGADO POR JOGAR', 'Leon Soto']]
]);

// Proporção real da foto determina o quanto a câmera pode deslizar para a direita.
function panoramaWidth(naturalWidth, naturalHeight, viewportWidth, viewportHeight) {
  if (!(naturalWidth > 0 && naturalHeight > 0 && viewportWidth > 0 && viewportHeight > 0)) {
    return Math.max(0, viewportWidth);
  }
  return Math.max(viewportWidth * 1.12, naturalWidth / naturalHeight * viewportHeight);
}

function deathPanDuration(audioSeconds) {
  return Number.isFinite(audioSeconds) && audioSeconds > 18
    ? Math.max(14000, Math.min(75000, audioSeconds * 1000 - 13000)) : 28000;
}

function createCinematics() {
  const root = document.querySelector('#cinematic');
  const image = document.querySelector('#cinematic-image');
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
  let creditsPage = -1;
  let creditsShownAll = false;
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

  function missingAsset(path) {
    if (!mode) return;
    const item = document.createElement('span');
    item.textContent = 'Arquivo pendente: ' + path.replace(/^\.\/public\//, 'public/');
    missing.append(item);
    missing.hidden = false;
  }

  function stop(notify = true) {
    if (!mode) return;
    token++;
    mode = null;
    for (const id of timers) clearTimeout(id);
    timers = [];
    audio.pause();
    audio.onended = audio.onerror = audio.onloadedmetadata = null;
    audio.removeAttribute('src');
    audio.load();
    image.onload = image.onerror = null;
    image.removeAttribute('src');
    image.style.removeProperty('width');
    image.style.removeProperty('height');
    image.style.removeProperty('--pan-distance');
    image.style.removeProperty('--pan-ms');
    image.classList.remove('is-panning');
    root.hidden = true;
    delete root.dataset.mode;
    quote.textContent = '';
    missing.replaceChildren();
    missing.hidden = true;
    enableAudio.hidden = true;
    const callback = onClose;
    onClose = null;
    if (notify) {
      previousFocus?.focus?.({ preventScroll: true });
      callback?.();
    }
    previousFocus = null;
  }

  function showCreditsPage(index) {
    if (mode !== 'credits') return;
    creditsPage = index;
    const pair = CREDIT_PAIRS[index];
    cards.forEach((card, i) => {
      card.querySelector('.cinematic-credit-role').textContent = pair[i][0];
      card.querySelector('.cinematic-credit-name').textContent = pair[i][1];
    });
    credits.classList.remove('is-visible');
    void credits.offsetWidth;
    credits.classList.add('is-visible');
    if (index + 1 < CREDIT_PAIRS.length) {
      later(() => showCreditsPage(index + 1), 7200);
    } else {
      creditsShownAll = true;
      if (soundEnded || soundFailed) later(() => stop(), 4400);
      else later(() => {
        // Uma música longa nunca deixa os créditos sumirem: repetimos as duplas.
        if (mode === 'credits' && !soundEnded && !soundFailed) showCreditsPage(0);
      }, 7200);
    }
  }

  function resizeDeathImage() {
    if (mode !== 'death' || !image.naturalWidth) return;
    const width = panoramaWidth(image.naturalWidth, image.naturalHeight,
      root.clientWidth, root.clientHeight);
    image.style.width = width + 'px';
    image.style.height = root.clientHeight + 'px';
    image.style.setProperty('--pan-distance', (root.clientWidth - width) + 'px');
  }

  function typeDeathLine() {
    if (mode !== 'death') return;
    let length = 0;
    function addLetter() {
      if (mode !== 'death') return;
      quote.textContent = DEATH_MESSAGE.slice(0, ++length);
      if (length < DEATH_MESSAGE.length) later(addLetter, 74);
      else {
        deathTyped = true;
        if (soundEnded || soundFailed) later(() => stop(), 6500);
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
    creditsPage = -1;
    creditsShownAll = soundEnded = soundFailed = deathTyped = deathPanStarted = false;
    root.dataset.mode = kind;
    root.hidden = false;
    quote.textContent = '';
    credits.hidden = kind !== 'credits';
    quote.hidden = kind !== 'death';
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
      // O panorama começa com a imagem pronta; metadata disponível ajusta sua duração.
    };
    audio.onerror = () => {
      if (sceneToken !== token) return;
      soundFailed = true;
      missingAsset(ASSETS[kind].audio);
      if (kind === 'credits' && creditsShownAll) later(() => stop(), 4400);
      if (kind === 'death' && deathTyped) later(() => stop(), 6500);
    };
    audio.onended = () => {
      if (sceneToken !== token) return;
      soundEnded = true;
      if (kind === 'credits' && creditsShownAll) stop();
      if (kind === 'death' && deathTyped) later(() => stop(), 6500);
    };
    audio.src = ASSETS[kind].audio;
    audio.volume = kind === 'death' ? 0.72 : 0.65;
    audio.currentTime = 0;
    const playback = audio.play();
    if (playback?.catch) playback.catch(() => {
      if (sceneToken === token && !soundFailed) enableAudio.hidden = false;
    });
    if (kind === 'credits') showCreditsPage(0);
    else later(startDeathPan, 2000); // Sem travar a cena caso o arquivo ainda esteja ausente.
  }

  enableAudio.addEventListener('click', () => {
    audio.play().then(() => { enableAudio.hidden = true; }).catch(() => {});
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
window.NathGame.panoramaWidth = panoramaWidth;
window.NathGame.deathPanDuration = deathPanDuration;
window.NathGame.createCinematics = createCinematics;
})();