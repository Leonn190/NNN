/* Explorador de Arquivos e editor de notas do computador do NNN. */
(() => {
  'use strict';

  const catalog = window.NathNotesCatalog;
  if (!catalog) return;

  const STORAGE_KEY = 'nnn.notes.v1';
  const MAX_USER_NOTE = 6000;
  const $ = selector => document.querySelector(selector);
  const workspace = $('.desktop-workspace');
  const startMenu = $('#start-menu');
  const taskbar = $('.computer-taskbar');
  if (!workspace || !startMenu || !taskbar) return;

  function newSave() {
    return { version: 1, nextNumber: 1, guardIndex: 0, entries: [] };
  }
  function readSave() {
    let value;
    try { value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch {}
    if (!value || !Array.isArray(value.entries)) return newSave();
    const entries = value.entries.filter(item => item && Number.isInteger(item.number)
      && typeof item.text === 'string' && catalog.folders.includes(item.folder));
    const biggest = Math.max(0, ...entries.map(item => item.number));
    return {
      version: 1,
      nextNumber: Math.max(biggest + 1, Number(value.nextNumber) || 1),
      guardIndex: Math.max(0, Math.min(catalog.roster.length, Number(value.guardIndex) || 0)),
      entries: entries.sort((a, b) => a.number - b.number)
    };
  }
  let save = readSave();
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(save)); }
    catch (error) { console.warn('Não foi possível salvar as notas.', error); }
  }
  function activeGuard() {
    return catalog.roster[save.guardIndex] || 'Operador não identificado';
  }
  function takenIds() { return new Set(save.entries.map(item => item.catalogId).filter(Boolean)); }
  function createEntry(type, folder, text, author, night, catalogId = null) {
    const number = save.nextNumber++;
    const entry = {
      number,
      filename: 'Anotação_' + number + '.txt',
      type,
      folder,
      text,
      author,
      night: Number.isInteger(night) ? night : null,
      catalogId,
      createdAt: new Date().toISOString()
    };
    save.entries.push(entry);
    return entry;
  }

  function chooseFrom(pool, count, night, preferredFolder = null) {
    const used = takenIds();
    const remaining = pool.filter(note => !used.has(note.id));
    const available = remaining.filter(note => note.minNight <= night);
    const ordered = [
      ...available.filter(note => note.folder === preferredFolder),
      ...available.filter(note => note.folder !== preferredFolder)
    ];
    // Se todas as notas relacionadas à etapa se esgotarem, completar a cota
    // com as demais evita que mortes repetidas deixem de conceder quatro arquivos.
    if (ordered.length < count) ordered.push(...remaining.filter(note => !ordered.includes(note)));
    return ordered.slice(0, count);
  }

  function awardVictory(night) {
    if (!Number.isInteger(night) || night < 1 || night >= 9) return [];
    const awarded = chooseFrom(catalog.reminders, 2, night);
    const author = activeGuard();
    for (const note of awarded) createEntry('Lembrete', note.folder, note.text, author, night, note.id);
    persist();
    refresh();
    return awarded;
  }
  const causeFolder = {
    original: 'Principal', padrao: 'Principal', gotica: 'Gotica',
    yandere: 'Yandere', platinada: 'Gatinha', gatinha: 'Gatinha',
    maid: 'Maid', palhaca: 'Palhaça', clown: 'Palhaça',
    smores: 'Smores', shadow: 'Alucinações'
  };
  function awardDeath(night, cause) {
    if (!Number.isInteger(night) || night < 1 || night > 9) return [];
    const author = activeGuard();
    const awarded = chooseFrom(catalog.recovered, 4, night, causeFolder[cause] || null);
    for (const note of awarded) createEntry('Recuperada', note.folder, note.text, author, night, note.id);
    save.guardIndex = Math.min(catalog.roster.length, save.guardIndex + 1);
    persist();
    refresh();
    return awarded;
  }
  function beginCampaign() {
    save.guardIndex = 0;
    persist();
    refresh();
  }

  const icon = { explorer: '📁', notes: '📝', cameras: '📹' };
  function element(tag, className, textValue) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (textValue !== undefined) el.textContent = textValue;
    return el;
  }
  function makeShortcut(id, label, glyph, open) {
    const btn = element('button', 'desktop-shortcut nnn-shortcut');
    btn.id = id;
    btn.type = 'button';
    const symbol = element('span', 'nnn-shortcut-icon', glyph);
    btn.append(symbol, document.createTextNode(label));
    btn.addEventListener('click', open);
    workspace.querySelector('.desktop-shortcuts').append(btn);
  }
  function menuEntry(id, label, glyph, open) {
    const btn = element('button', 'nnn-start-entry');
    btn.id = id; btn.type = 'button';
    btn.append(element('span', 'nnn-menu-icon', glyph), document.createTextNode(label));
    btn.addEventListener('click', open);
    startMenu.insertBefore(btn, $('#shutdown-desktop'));
  }
  function taskButton(id, label, glyph, open) {
    const btn = element('button', 'task-app nnn-task-app', glyph);
    btn.id = id; btn.type = 'button';
    btn.title = label; btn.setAttribute('aria-label', label);
    btn.addEventListener('click', open);
    taskbar.insertBefore(btn, $('.task-tray'));
    return btn;
  }
  function makeWindow(name, label, glyph) {
    const panel = element('section', 'desktop-window nnn-notes-window');
    panel.id = 'nnn-window-' + name;
    panel.hidden = true;
    panel.setAttribute('aria-label', label);
    const head = element('header', 'window-titlebar');
    const mark = element('span', 'nnn-title-icon', glyph);
    const title = element('span', null, label);
    const minimize = element('button', 'window-minimize');
    const maximize = element('button', 'window-maximize');
    const close = element('button', 'window-close');
    for (const [button, verb] of [[minimize,'Minimizar'],[maximize,'Maximizar'],[close,'Fechar']]) {
      button.type = 'button';
      button.title = verb;
      button.setAttribute('aria-label', verb + ' ' + label);
    }
    head.append(mark, title, minimize, maximize, close);
    const body = element('div', 'nnn-notes-body');
    panel.append(head, body);
    workspace.append(panel);
    const app = { name, panel, body, head, task: null };
    panel.addEventListener('pointerdown', () => focusApp(app));
    minimize.addEventListener('click', () => hideApp(app));
    close.addEventListener('click', () => hideApp(app));
    maximize.addEventListener('click', () => {
      panel.toggleAttribute('data-maximized');
      focusApp(app);
    });
    head.addEventListener('dblclick', event => {
      if (!event.target.closest('button')) panel.toggleAttribute('data-maximized');
    });
    return app;
  }

  const explorer = makeWindow('explorer', 'Explorador de Arquivos', icon.explorer);
  const editor = makeWindow('notes', 'Notas', icon.notes);
  let currentFolder = null;
  let openFile = null;
  let status = '';
  let draft = '';

  function permitted() {
    return !$('#game').hidden && !$('#computer-desktop').hidden
      && !$('#computer-screen').inert && !$('#game').dataset.defeat;
  }
  function hideStart() {
    startMenu.hidden = true;
    $('#open-start')?.setAttribute('aria-expanded', 'false');
  }
  function focusApp(app) {
    for (const a of [explorer, editor]) delete a.panel.dataset.active;
    if (!app.panel.hidden) app.panel.dataset.active = '';
  }
  function hideApp(app) {
    app.panel.hidden = true;
    app.task?.removeAttribute('data-open');
    app.task?.setAttribute('aria-pressed', 'false');
    if (app === explorer) openFile = null;
  }
  function hideAll() {
    hideApp(explorer); hideApp(editor);
  }
  function showApp(app) {
    if (!permitted()) return;
    // Devolve a interface ao modo desktop antes de abrir outra janela.
    $('#show-desktop')?.click();
    hideStart();
    app.panel.hidden = false;
    app.task?.setAttribute('data-open', '');
    app.task?.setAttribute('aria-pressed', 'true');
    focusApp(app);
  }
  function showExplorer(folder = null) {
    showApp(explorer);
    if (explorer.panel.hidden) return;
    currentFolder = folder;
    openFile = null;
    renderExplorer();
  }
  function showEditor() {
    showApp(editor);
    if (editor.panel.hidden) return;
    renderEditor();
  }
  function renderExplorer() {
    const body = explorer.body;
    body.replaceChildren();
    const toolbar = element('div', 'nnn-browser-toolbar');
    const home = element('button', null, '⌂  Este computador');
    const path = element('span', 'nnn-browser-path',
      currentFolder === '__notes_root__' ? 'Este computador / Notas'
        : currentFolder ? 'Este computador / Notas / ' + currentFolder
          : 'Este computador');
    home.type = 'button';
    home.addEventListener('click', () => { currentFolder = null; openFile = null; renderExplorer(); });
    toolbar.append(home, path);
    body.append(toolbar);

    if (openFile) {
      const entry = save.entries.find(item => item.number === openFile);
      if (!entry) { openFile = null; renderExplorer(); return; }
      const back = element('button', 'nnn-browser-back', '← Voltar à pasta ' + entry.folder);
      back.addEventListener('click', () => { openFile = null; renderExplorer(); });
      const heading = element('h3', null, entry.filename);
      const meta = element('div', 'nnn-file-meta');
      meta.append(
        element('span', null, 'Tipo: ' + entry.type),
        element('span', null, 'Autor: ' + entry.author),
        element('span', null, 'Noite: ' + (entry.night || '—'))
      );
      const contents = element('pre', 'nnn-file-contents', entry.text);
      body.append(back, heading, meta, contents);
      return;
    }

    const info = element('p', 'nnn-browser-info', currentFolder
      ? currentFolder + ' — anotações por ordem de descoberta'
      : 'Aplicativos e arquivos locais');
    body.append(info);
    const list = element('div', 'nnn-file-list');
    body.append(list);
    function entry(glyph, label, details, handler) {
      const btn = element('button', 'nnn-file-tile');
      btn.type = 'button';
      const art = element('span', 'nnn-file-icon', glyph);
      const copy = element('span', 'nnn-file-copy');
      copy.append(element('span', 'nnn-file-name', label),
        element('small', null, details));
      btn.append(art, copy);
      btn.addEventListener('click', handler);
      list.append(btn);
    }
    if (currentFolder === null) {
      entry(icon.cameras, 'Câmeras', 'Aplicativo', () => {
        hideAll(); $('#open-cameras')?.click();
      });
      entry(icon.explorer, 'Explorador de Arquivos', 'Aplicativo', () => showExplorer());
      entry(icon.notes, 'Notas', 'Aplicativo', showEditor);
      entry('📁', 'Notas', 'Pasta', () => {
        currentFolder = '__notes_root__'; renderExplorer();
      });
    } else if (currentFolder === '__notes_root__') {
      for (const folder of catalog.folders) {
        const count = save.entries.filter(item => item.folder === folder).length;
        entry('📁', folder, count + (count === 1 ? ' arquivo' : ' arquivos'), () => {
          currentFolder = folder; renderExplorer();
        });
      }
    } else {
      const files = save.entries.filter(item => item.folder === currentFolder)
        .sort((a, b) => a.number - b.number);
      for (const file of files) {
        entry('📄', file.filename, file.type + ' • ' + file.author, () => {
          openFile = file.number; renderExplorer();
        });
      }
      if (!files.length) body.append(element('p', 'nnn-empty', 'Nenhuma anotação disponível nesta pasta.'));
    }
  }
  function renderEditor() {
    const body = editor.body;
    body.replaceChildren();
    const headline = element('h3', null, 'Criar anotação');
    const hint = element('p', 'nnn-browser-info', 'A anotação será salva automaticamente na pasta Outras.');
    const textarea = element('textarea', 'nnn-user-textarea');
    textarea.placeholder = 'Escreva suas observações...';
    textarea.maxLength = MAX_USER_NOTE;
    textarea.value = draft;
    textarea.addEventListener('input', () => { draft = textarea.value; });
    textarea.setAttribute('aria-label', 'Conteúdo da anotação');
    textarea.addEventListener('keydown', event => event.stopPropagation());
    const footer = element('div', 'nnn-editor-footer');
    const statusText = element('span', 'nnn-editor-status', status);
    const saveButton = element('button', 'nnn-save-button', 'Salvar anotação');
    saveButton.type = 'button';
    saveButton.addEventListener('click', () => {
      const text = textarea.value.trim();
      if (!text) { statusText.textContent = 'Escreva algo antes de salvar.'; return; }
      const entry = createEntry('Pessoal', 'Outras', text, activeGuard(), null);
      persist();
      textarea.value = '';
      draft = '';
      status = entry.filename + ' foi salvo em Notas / Outras.';
      statusText.textContent = status;
      refresh();
    });
    footer.append(statusText, saveButton);
    body.append(headline, hint, textarea, footer);
  }
  function refresh() {
    if (!explorer.panel.hidden) renderExplorer();
    const unread = save.entries.length;
    explorer.task.title = 'Explorador de Arquivos (' + unread + ' anotações)';
  }

  makeShortcut('open-explorer', 'Explorador', icon.explorer, () => showExplorer());
  makeShortcut('open-notes', 'Notas', icon.notes, showEditor);
  menuEntry('start-explorer', 'Explorador de Arquivos', icon.explorer, () => showExplorer());
  menuEntry('start-notes', 'Notas', icon.notes, showEditor);
  explorer.task = taskButton('taskbar-explorer', 'Explorador de Arquivos', icon.explorer,
    () => explorer.panel.hidden ? showExplorer(currentFolder) : hideApp(explorer));
  editor.task = taskButton('taskbar-notes', 'Notas', icon.notes,
    () => editor.panel.hidden ? showEditor() : hideApp(editor));

  // O botão "Mostrar área de trabalho" e o aplicativo Câmeras seguem sendo os do jogo.
  $('#show-desktop')?.addEventListener('click', hideAll);
  for (const id of ['#open-cameras', '#start-cameras', '#taskbar-cameras']) {
    $(id)?.addEventListener('click', hideAll);
  }
  $('#start-game')?.addEventListener('click', beginCampaign);
  refresh();

  window.NathNotes = {
    awardVictory, awardDeath, beginCampaign, hideAll,
    getGuard: activeGuard, getEntries: () => save.entries.map(item => ({ ...item })),
    getTotals: () => ({
      reminders: save.entries.filter(item => item.type === 'Lembrete').length,
      recovered: save.entries.filter(item => item.type === 'Recuperada').length,
      statisticsReady: 0,
      statisticsPlanned: catalog.statistics.length,
      user: save.entries.filter(item => item.type === 'Pessoal').length
    })
  };
})();
