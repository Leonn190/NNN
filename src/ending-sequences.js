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
const CREDIT_PAGE_MS = 8000;
const CREDIT_TOTAL_MS = 200000;
const CREDIT_DIR = './public/images/ending/';
const CREDIT_SHOTS = Object.freeze([
  {
    image: CREDIT_DIR + 'creditos.png', motion: 'float', layout: 'title',
    pages: [
      [['NINE NIGHTS AT NATH\'S', ''], ['UM JOGO DE', 'Leon Soto']]
    ]
  },
  {
    image: CREDIT_DIR + 'restaurante-vazio.png', motion: 'creep-in',
    pages: [
      [['CRIAÇÃO ORIGINAL', 'Leon Soto'], ['DIREÇÃO CRIATIVA', 'Leon Soto']],
      [['DESENVOLVIMENTO INDEPENDENTE', 'Leon Soto'], ['DIREÇÃO DE TERROR', 'Leon Soto']]
    ]
  },
  {
    image: CREDIT_DIR + 'recepcao.png', motion: 'drift-left',
    pages: [
      [['PROGRAMAÇÃO PRINCIPAL', 'Leon Soto'], ['ARQUITETURA DE SISTEMAS', 'Leon Soto']],
      [['GAME DESIGN', 'Leon Soto'], ['DESIGN DE MECÂNICAS', 'Leon Soto']]
    ]
  },
  {
    image: CREDIT_DIR + 'vip-bonecas.png', motion: 'drift-right',
    pages: [
      [['INTELIGÊNCIA ARTIFICIAL', 'Leon Soto'], ['ROTAS E CAÇADA', 'Leon Soto']],
      [['BALANCEAMENTO DAS NOITES', 'Leon Soto'], ['SANIDADE E ENERGIA', 'Leon Soto']]
    ]
  },
  {
    image: CREDIT_DIR + 'gotica-vip-roxo.png', motion: 'pull-back',
    pages: [
      [['DIREÇÃO DE ARTE', 'Leon Soto'], ['DESIGN DE PERSONAGENS', 'Leon Soto']],
      [['ARTE E AMBIENTAÇÃO', 'Leon Soto'], ['CENOGRAFIA DO RESTAURANTE', 'Leon Soto']]
    ]
  },
  {
    image: CREDIT_DIR + 'maid-gatinha-cozinha.png', motion: 'drift-up',
    pages: [
      [['LEVEL DESIGN', 'Leon Soto'], ['POSICIONAMENTO DE CÂMERAS', 'Leon Soto']],
      [['INTERFACE E UX', 'Leon Soto'], ['EFEITOS VISUAIS', 'Leon Soto']]
    ]
  },
  {
    image: CREDIT_DIR + 'maid-oficina.png', motion: 'creep-in',
    pages: [
      [['JUMPSCARES', 'Leon Soto'], ['ANIMAÇÕES', 'Leon Soto']],
      [['HISTÓRIA ORIGINAL', 'Leon Soto'], ['ROTEIRO E LORE', 'Leon Soto']]
    ]
  },
  {
    image: CREDIT_DIR + 'fliperama.png', motion: 'drift-right',
    pages: [
      [['DIREÇÃO DE SOM', 'Leon Soto'], ['CURADORIA MUSICAL', 'Leon Soto']],
      [['CINEMÁTICAS E CRÉDITOS', 'Leon Soto'], ['TESTES E PRODUÇÃO', 'Leon Soto']]
    ]
  },
  {
    image: CREDIT_DIR + 'yandere-corredor-leste.png', motion: 'drift-left',
    pages: [
      [['INSPIRADO EM', 'Five Nights at Freddy\'s\nScott Cawthon'], ['INSPIRAÇÃO SONORA', 'Five Nights at Freddy\'s\nScott Cawthon']],
      [['MÚSICA · SHIKAIRO DAYS', 'Shika-bu · Yūki Waga\nKana Yaginuma'], ['MÚSICA · KAWAIKUTE GOMEN', 'HoneyWorks · shito']]
    ]
  },
  {
    image: CREDIT_DIR + 'palhaca-escritorio.png', motion: 'creep-in',
    pages: [
      [['MÚSICA · CARAMELLDANSEN', 'Caramell\nJorge Vasconcelo · Juha Myllylä'], ['MÚSICA · IT\'S NOT LIKE I LIKE YOU!!', 'Static-P · Amree']],
      [['MÚSICA · JOIN US FOR A BITE', 'JT Music\nVoz: Andrea Storm Kaden'], ['MÚSICA · THE AMAZING DIGITAL CIRCUS', 'Gooseworx (tema)\nEvan Alderete (trilha)']]
    ]
  },
  {
    image: CREDIT_DIR + 'corredor-bonecas.png', motion: 'drift-up',
    pages: [
      [['ASSISTÊNCIA CRIATIVA', 'ChatGPT (GPT) · OpenAI'], ['ASSISTÊNCIA DE PROGRAMAÇÃO', 'OpenAI Codex']],
      [['TECNOLOGIAS', 'HTML · CSS · JavaScript'], ['VERSIONAMENTO E PUBLICAÇÃO', 'GitHub · GitHub Pages']]
    ]
  },
  {
    image: CREDIT_DIR + 'lounge-rosa-roxo.png', motion: 'pull-back', layout: 'roster',
    pages: [
      [['INSPIRAÇÃO PARA OS GUARDAS · I', 'Pedro Garcia · Pedro Babugia\nHenrique Baatalha · Caio Pontes\nFelipe Riva · Felipe Lima'], ['INSPIRAÇÃO PARA OS GUARDAS · II', 'Arthur Ramos · Rafael Ferraz\nPaulo Ventura · Arthur Guedes\nAlexandre Do Bim · João Gannoun']],
      [['INSPIRAÇÃO PARA NATHZINHA', 'Nathali Tomazine'], ['AGRADECIMENTO ESPECIAL', 'Nathali Tomazine']]
    ]
  },
  {
    image: CREDIT_DIR + 'creditos.png', motion: 'float', layout: 'finale',
    pages: [
      [['PARA QUEM CHEGOU ATÉ AQUI', 'Obrigado por cada noite.'], ['UMA CRIAÇÃO DE', 'Leon Soto']],
      [['OBRIGADO POR JOGAR', ''], ['NINE NIGHTS AT NATH\'S', 'Leon Soto']]
    ]
  }
]);
const CREDIT_PAGES = Object.freeze(CREDIT_SHOTS.flatMap((shot, shotIndex) =>
  shot.pages.map(pair => Object.freeze({ shotIndex, pair }))));
const CREDIT_PAIRS = Object.freeze(CREDIT_PAGES.map(page => page.pair));
if (CREDIT_PAGES.length * CREDIT_PAGE_MS !== CREDIT_TOTAL_MS) {
  throw new Error('Os créditos devem durar exatamente 3min20s.');
}
const CREDIT_MOTIONS = ['float', 'creep-in', 'drift-left', 'drift-right', 'pull-back', 'drift-up'];

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
    audio.pause();
    audio.onended = audio.onerror = audio.onloadedmetadata = null;
    audio.removeAttribute('src');
    audio.load();
    clearImageState(image);
    clearImageState(nextImage);
    root.hidden = true;
    root.classList.remove('is-finale');
    delete root.dataset.mode;
    delete credits.dataset.layout;
    quote.textContent = '';
    missing.replaceChildren();
    missing.hidden = true;
    enableAudio.hidden = true;
    creditsShot = -1;
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

  function showCreditsShot(index) {
    const shot = CREDIT_SHOTS[index];
    const incoming = creditsShot === -1 ? image : (activeImage === image ? nextImage : image);
    incoming.classList.remove('is-current', ...CREDIT_MOTIONS.map(motion => 'is-' + motion));
    incoming.src = shot.image;
    void incoming.offsetWidth;
    incoming.classList.add('is-current', 'is-' + shot.motion);
    if (creditsShot !== -1) activeImage.classList.remove('is-current');
    activeImage = incoming;
    creditsShot = index;
    // Somente a próxima cena é aquecida, evitando manter 11 PNGs em memória.
    preload = index + 1 < CREDIT_SHOTS.length ? document.createElement('img') : null;
    if (preload) preload.src = CREDIT_SHOTS[index + 1].image;
  }

  function showCreditsPage(index) {
    if (mode !== 'credits') return;
    if (index >= CREDIT_PAGES.length) {
      stop();
      return;
    }
    const page = CREDIT_PAGES[index];
    if (page.shotIndex !== creditsShot) showCreditsShot(page.shotIndex);
    const shot = CREDIT_SHOTS[page.shotIndex];
    credits.dataset.layout = shot.layout || 'standard';
    root.classList.toggle('is-finale', index === CREDIT_PAGES.length - 1);
    cards.forEach((card, i) => {
      const [role, name] = page.pair[i];
      card.querySelector('.cinematic-credit-role').textContent = role;
      card.querySelector('.cinematic-credit-name').textContent = name;
      card.classList.toggle('is-compact', name.length > 30 || role.length > 34);
      card.classList.toggle('is-roster', name.split('\n').length > 2);
    });
    credits.classList.remove('is-visible');
    void credits.offsetWidth;
    credits.classList.add('is-visible');
    later(() => showCreditsPage(index + 1), CREDIT_PAGE_MS);
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
    activeImage = image;
    preload = null;
    soundEnded = soundFailed = deathTyped = deathPanStarted = false;
    root.dataset.mode = kind;
    root.hidden = false;
    root.classList.remove('is-finale');
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
      // Se o áudio da morte carregar depois, o panorama ainda tem um tempo seguro.
    };
    audio.onerror = () => {
      if (sceneToken !== token) return;
      soundFailed = true;
      missingAsset(ASSETS[kind].audio);
      // Créditos têm relógio próprio e nunca terminam antes de 3min20s.
      if (kind === 'death' && deathTyped) later(() => stop(), 6200);
    };
    audio.onended = () => {
      if (sceneToken !== token) return;
      soundEnded = true;
      if (kind === 'death' && deathTyped) later(() => stop(), 6200);
    };
    audio.src = ASSETS[kind].audio;
    audio.volume = kind === 'death' ? .72 : .65;
    audio.currentTime = 0;
    const playback = audio.play();
    if (playback?.catch) playback.catch(() => {
      if (sceneToken === token && !soundFailed) enableAudio.hidden = false;
    });
    if (kind === 'credits') showCreditsPage(0);
    else later(startDeathPan, 2000);
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
window.NathGame.cinematicCreditShots = CREDIT_SHOTS;
window.NathGame.cinematicCreditsDuration = CREDIT_TOTAL_MS;
window.NathGame.panoramaWidth = panoramaWidth;
window.NathGame.deathPanDuration = deathPanDuration;
window.NathGame.createCinematics = createCinematics;
})();