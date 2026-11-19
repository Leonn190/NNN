(() => {
'use strict';

function createNightMenu(config, { prepareShift, startShift, onEnter,
  canPlayCampaign = () => true, onSelectCampaign = () => {},
  onDeleteCampaign = () => {}, remainingGuards = () => 12 }) {
  const $ = selector => document.querySelector(selector);
  const entry = $('#entry-screen');
  const entryButton = $('#enter-game');
  const title = $('#title-screen');
  const game = $('#game');
  const intro = $('#night-intro');
  const introTitle = $('#night-intro-title');
  const music = $('#menu-music');
  const titleContent = $('.title-content');
  const start = $('#start-game');
  const continuation = [
    { button: $('#continue-game'), label: $('#continue-game-label') },
    { button: $('#continue-game-2'), label: $('#continue-game-label-2') }
  ];
  const starsDisplay = $('#campaign-stars');
  const customButton = $('#open-custom');
  const extrasButton = $('#open-extras');
  const customScreen = $('#custom-night');
  const extrasScreen = $('#extras-menu');
  const preview = $('#extras-preview');
  const previewImage = $('#extras-jumpscare-image');
  const previewSound = $('#extras-jumpscare-sound');
  const maxButton = $('#custom-max');
  const debugButton = $('#custom-debug');
  const fields = $('#custom-levels');
  const settings = config.controls.menuMusic;
  const { campaign, campaignMaxLevel, levels: [min, max], defaultLevel, ...defaults } = config.night;
  const store = window.NathGame.createCampaignStore();
  const inputs = new Map();
  let selectedId = null;
  let pendingShift;
  let musicFrame;
  let glitchTimer;
  let lastGlitchArt;
  let previewToken = 0;
  let previewTimer;
  let previewRequest;
  let previewObjectUrl;
  let debug = false;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');

  for (const [id, { name }] of Object.entries({
    ...config.characters, palhaca: config.threats.clown, shadow: config.shadow, smores: config.threats.smores
  })) {
    const label = document.createElement('label');
    const nameElement = document.createElement('span');
    const select = document.createElement('select');
    label.className = 'custom-character';
    nameElement.className = 'custom-character-name';
    nameElement.textContent = name;
    select.name = id;
    select.setAttribute('aria-label', 'Dificuldade: ' + name);
    for (let level = min; level <= max; level++) {
      const option = document.createElement('option');
      option.value = String(level);
      option.textContent = level === max ? 'MAX' : option.value;
      select.append(option);
    }
    select.value = String(defaultLevel);
    select.addEventListener('change', updateMaxButton);
    label.append(nameElement, select);
    fields.append(label);
    inputs.set(id, select);
  }

  function updateMaxButton() {
    const allMax = [...inputs.values()].every(select => Number(select.value) === max);
    maxButton.setAttribute('aria-pressed', String(allMax));
    maxButton.textContent = allMax ? 'ZERAR TODAS' : 'MAX NIGHT';
  }

  function renderStars() {
    const bits = store.stars();
    starsDisplay.hidden = bits === 0;
    starsDisplay.querySelectorAll('[data-star]').forEach(star => {
      star.hidden = !(bits & Number(star.dataset.star));
    });
    starsDisplay.setAttribute('aria-label', [bits & 1 ? 'Nove noites concluídas' : '',
      bits & 2 ? 'Campanha vencida com guardas restantes' : '',
      bits & 4 ? 'Custom Night MAX vencida' : ''].filter(Boolean).join('; '));
  }

  function stopPreview({ resumeMusic = true } = {}) {
    previewToken++;
    clearTimeout(previewTimer);
    previewRequest?.abort();
    previewRequest = undefined;
    previewSound.pause();
    previewSound.removeAttribute('src');
    previewSound.load();
    previewImage.removeAttribute('src');
    previewImage.onload = null;
    previewImage.onerror = null;
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = undefined;
    delete title.dataset.defeat;
    delete title.dataset.scare;
    preview.hidden = true;
    if (resumeMusic && !title.hidden && !title.inert && music.paused) music.play().catch(() => {});
  }

  function showScare(file) {
    stopPreview({ resumeMusic: false });
    const token = previewToken;
    const timing = config.controls.jumpscare;
    const isShadow = file === 'shadow.gif';
    const isBottomClown = file === 'palhaca-baixo.gif';
    const sound = isShadow ? 'shadow.ogg'
      : file.startsWith('palhaca-') ? 'palhaca.ogg' : 'scream.wav';
    const source = './public/images/jumpscares/' + file;
    preview.hidden = false;
    title.dataset.scare = isShadow ? 'shadow' : isBottomClown ? 'clown-bottom' : 'default';
    title.dataset.defeat = 'blackout';
    preview.focus({ preventScroll: true });
    music.pause();
    previewSound.src = './public/audio/jumpscares/' + sound;
    previewSound.volume = timing.volume;
    previewSound.currentTime = 0;
    previewSound.play().catch(() => {});

    const request = previewRequest = new AbortController();
    let loaded = false;
    let failed = false;
    previewImage.onload = () => { if (token === previewToken) loaded = true; };
    previewImage.onerror = () => { if (token === previewToken) failed = true; };
    fetch(source, { signal: request.signal }).then(response => {
      if (!response.ok) throw new Error('Imagem indisponível');
      return response.blob();
    }).then(blob => {
      if (token !== previewToken) return;
      previewObjectUrl = URL.createObjectURL(blob);
      previewImage.src = previewObjectUrl;
    }).catch(() => {
      if (token !== previewToken) return;
      previewImage.src = source + '?extras=' + token;
    }).finally(() => {
      if (previewRequest === request) previewRequest = undefined;
    });

    const deadline = performance.now() + timing.blackoutMs + timing.imageLoadWaitMs;
    function flash() {
      if (token !== previewToken) return;
      title.dataset.defeat = 'flash';
      previewImage.removeAttribute('src');
      previewTimer = setTimeout(() => {
        if (token !== previewToken) return;
        stopPreview();
        $('#extras-list button').focus({ preventScroll: true });
      }, timing.flashMs);
    }
    function reveal() {
      if (token !== previewToken) return;
      if (!loaded && !failed && performance.now() < deadline) {
        previewTimer = setTimeout(reveal, 30);
        return;
      }
      if (!loaded) return flash();
      title.dataset.defeat = 'scare';
      const cycle = isShadow ? config.shadow.jumpscareMs
        : isBottomClown ? timing.clownBottomCycleMs : timing.cycleMs;
      previewTimer = setTimeout(flash, cycle + timing.finalHoldMs);
    }
    previewTimer = setTimeout(reveal, timing.blackoutMs);
  }

  function showSubmenu(mode, focus) {
    stopPreview();
    if (mode) title.dataset.submenu = mode;
    else delete title.dataset.submenu;
    customScreen.hidden = mode !== 'custom';
    extrasScreen.hidden = mode !== 'extras';
    titleContent.querySelector('.title-actions').inert = Boolean(mode);
    updateGlitches();
    focus?.focus();
  }

  function updateGlitches() {
    clearTimeout(glitchTimer);
    delete title.dataset.glitch;
    delete title.dataset.doubleGlitch;
    title.toggleAttribute('data-page-hidden', Boolean(document.hidden));
    if (title.hidden || title.inert || document.hidden || reducedMotion?.matches) return;
    const random = window.crypto.getRandomValues(new Uint16Array(4));
    glitchTimer = setTimeout(() => {
      lastGlitchArt = lastGlitchArt === undefined ? random[0] % 3 : (lastGlitchArt + 1 + random[0] % 2) % 3;
      const double = random[1] < 16384;
      const duration = (double ? 410 : 230) + random[2] / 65535 * 165;
      title.style.setProperty('--glitch-duration', duration + 'ms');
      title.toggleAttribute('data-double-glitch', double);
      title.dataset.glitch = String(lastGlitchArt);
      glitchTimer = setTimeout(updateGlitches, duration);
    }, 4800 + random[3] / 65535 * 10500);
  }

  function fadeMusic() {
    musicFrame = undefined;
    if (title.hidden || title.inert || music.paused) return;
    const progress = Math.min(1, Math.max(0, (music.currentTime - settings.startSeconds) / settings.fadeSeconds));
    music.volume = settings.initialVolume + (settings.volume - settings.initialVolume) * progress;
    if (progress < 1) musicFrame = requestAnimationFrame(fadeMusic);
  }
  function startMusicFade() {
    if (musicFrame === undefined && music.volume !== settings.volume) fadeMusic();
  }
  function cancelMusicFade() {
    if (musicFrame !== undefined) cancelAnimationFrame(musicFrame);
    musicFrame = undefined;
  }

  function show() {
    const slots = store.all();
    continuation.forEach(({ button, label }, index) => {
      const slot = slots[index];
      button.hidden = !slot;
      if (!slot) return;
      label.textContent = 'Campanha ' + (index + 1) + ' · Noite ' + (slot.completed + 1);
    });
    renderStars();
    title.hidden = false;
    title.inert = false;
    showSubmenu(null, slots.length ? continuation[0].button : start);
    music.currentTime = settings.startSeconds;
    music.volume = settings.initialVolume;
    cancelMusicFade();
    music.play().catch(() => {});
  }

  function play(shift, { newspaper = false } = {}) {
    if (pendingShift) return;
    pendingShift = shift;
    introTitle.textContent = shift.label;
    title.inert = true;
    game.inert = true;
    stopPreview();
    updateGlitches();
    cancelMusicFade();
    music.pause();
    intro.dataset.phase = newspaper ? 'newspaper' : 'cover';
    intro.hidden = false;
  }

  function playCampaign(number, options = {}, id = selectedId) {
    const slot = store.get(id);
    if (!slot || !Number.isInteger(number) || number < 1 || number > slot.completed + 1) return;
    if (selectedId !== id) {
      onSelectCampaign(id);
      selectedId = id;
    }
    if (!canPlayCampaign()) return;
    const night = campaign[number - 1];
    if (!night) return;
    const { levels, ...rules } = night;
    play({ campaignId: id, number, label: 'NOITE ' + number,
      levels, rules: { ...defaults, ...rules, maxLevel: campaignMaxLevel } }, options);
  }

  function restartCampaign() {
    if (pendingShift) return;
    if (store.all().length === 2) {
      const victim = store.eviction();
      const index = store.all().findIndex(slot => slot.id === victim.id) + 1;
      if (!window.confirm('Limite de duas campanhas. Criar outra vai apagar a Campanha '
          + index + ' (Noite ' + (victim.completed + 1) + ') e suas notas. Continuar?')) return;
    }
    const { slot, removed } = store.create();
    if (removed) onDeleteCampaign(removed.id);
    selectedId = null;
    playCampaign(1, { newspaper: true }, slot.id);
  }

  function recordWin(number, shift) {
    const id = shift?.campaignId ?? selectedId;
    const result = store.advance(id, number);
    if (!result) return;
    if (result.closed) {
      store.awardCampaign(remainingGuards());
      onDeleteCampaign(id);
      if (selectedId === id) selectedId = null;
      renderStars();
    }
  }

  function recordCustomWin(shift) {
    if (shift?.customMax && !shift.debug) {
      store.awardMaxNight();
      renderStars();
    }
  }

  function endExhaustedCampaign(id) {
    if (!id) return;
    if (!store.remove(id)) return;
    onDeleteCampaign(id);
    if (selectedId === id) selectedId = null;
  }

  introTitle.addEventListener('animationend', event => {
    if (event.animationName !== 'night-card' || intro.dataset.phase !== 'card') return;
    title.hidden = true;
    title.inert = false;
    prepareShift(pendingShift);
    intro.dataset.phase = 'reveal';
  });
  intro.addEventListener('animationend', event => {
    if (event.target !== intro) return;
    const phase = intro.dataset.phase;
    if ((phase === 'newspaper' && event.animationName === 'night-intro')
        || (phase === 'cover' && event.animationName === 'night-cover')) intro.dataset.phase = 'card';
    else if (phase === 'reveal' && event.animationName === 'night-reveal') {
      intro.hidden = true;
      delete intro.dataset.phase;
      pendingShift = undefined;
      startShift();
    }
  });

  function enter() {
    entry.hidden = true;
    show();
    onEnter();
  }
  start.addEventListener('click', restartCampaign);
  continuation.forEach(({ button }, index) => button.addEventListener('click', () => {
    const slot = store.all()[index];
    if (slot) playCampaign(slot.completed + 1, {}, slot.id);
  }));
  customButton.addEventListener('click', () => {
    updateMaxButton();
    showSubmenu('custom', inputs.values().next().value);
  });
  extrasButton.addEventListener('click', () => showSubmenu('extras', $('#extras-list button')));
  $('#close-custom').addEventListener('click', () => showSubmenu(null, customButton));
  $('#close-extras').addEventListener('click', () => showSubmenu(null, extrasButton));
  maxButton.addEventListener('click', () => {
    const target = [...inputs.values()].every(select => Number(select.value) === max) ? 0 : max;
    inputs.forEach(select => { select.value = String(target); });
    updateMaxButton();
  });
  debugButton.addEventListener('click', () => {
    debug = !debug;
    debugButton.setAttribute('aria-pressed', String(debug));
    debugButton.textContent = debug ? 'Debug ativado' : 'Debug desativado';
  });
  $('#custom-form').addEventListener('submit', event => {
    event.preventDefault();
    const levels = Object.fromEntries([...inputs].map(([id, select]) => [id, Number(select.value)]));
    const customMax = Object.values(levels).every(level => level === max);
    play({ label: 'CUSTOM NIGHT', levels, rules: defaults, debug, customMax });
  });

  $('#extras-list').addEventListener('click', event => {
    const button = event.target.closest('button[data-scare]');
    if (!button) return;
    const file = button.dataset.scare;
    const allowed = ['original.gif', 'gotica.gif', 'yandere.gif', 'maid.gif',
      'platinada.gif', 'palhaca-direita.gif', 'palhaca-baixo.gif', 'shadow.gif'];
    if (!allowed.includes(file)) return;
    showScare(file);
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || title.hidden || title.inert) return;
    if (!preview.hidden) { stopPreview(); $('#extras-list button').focus(); }
    else if (!customScreen.hidden) showSubmenu(null, customButton);
    else if (!extrasScreen.hidden) showSubmenu(null, extrasButton);
  });
  entryButton.disabled = false;
  music.addEventListener('playing', startMusicFade);
  music.addEventListener('waiting', cancelMusicFade);
  music.addEventListener('pause', cancelMusicFade);
  document.addEventListener('visibilitychange', updateGlitches);
  reducedMotion?.addEventListener('change', updateGlitches);
  entryButton.addEventListener('click', enter, { once: true });

  return { show, play, playCampaign, recordWin, recordCustomWin, restartCampaign,
    endExhaustedCampaign, hasCampaign: id => Boolean(store.get(id)) };
}

window.NathGame.createNightMenu = createNightMenu;
})();
