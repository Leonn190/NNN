(() => {
'use strict';

// One stack for every monitor application; hiding the monitor does not close it.
function createDesktopWindows(changed = () => {}) {
  const apps = new Map();
  const stack = [];
  const foreground = () => stack.filter(id => !apps.get(id).panel.hidden).at(-1);
  function render() {
    const active = foreground();
    for (const [id, app] of apps) {
      app.panel.toggleAttribute('data-active', id === active);
      app.panel.style.zIndex = String(1 + Math.max(0, stack.indexOf(id)));
      app.task.toggleAttribute('data-open', app.open);
      app.task.setAttribute('aria-pressed', String(id === active));
    }
  }
  function notify() { render(); changed(foreground()); }
  function raise(id) {
    const app = apps.get(id);
    app.open = true;
    app.panel.hidden = false;
    const index = stack.indexOf(id);
    if (index >= 0) stack.splice(index, 1);
    stack.push(id);
    notify();
  }
  function minimize(id) { apps.get(id).panel.hidden = true; notify(); }
  function close(id) {
    const app = apps.get(id);
    app.open = false;
    app.panel.hidden = true;
    const index = stack.indexOf(id);
    if (index >= 0) stack.splice(index, 1);
    notify();
  }
  return {
    register(id, panel, task) {
      apps.set(id, { panel, task, open: false });
      panel.hidden = true;
      panel.addEventListener('pointerdown', () => { if (foreground() !== id) raise(id); });
      panel.addEventListener('focusin', () => { if (foreground() !== id) raise(id); });
      render();
    },
    raise, minimize, close, foreground, render,
    isOpen: id => apps.get(id).open,
    toggle(id, open) { if (foreground() === id) minimize(id); else if (apps.get(id).open) raise(id); else open(); },
    minimizeAll() { for (const app of apps.values()) app.panel.hidden = true; notify(); },
    reset() {
      stack.length = 0;
      for (const app of apps.values()) {
        app.open = false;
        app.panel.hidden = true;
        delete app.panel.dataset.maximized;
        delete app.panel.dataset.snapped;
        for (const key of ['left', 'top', 'width', 'height']) app.panel.style[key] = '';
      }
      notify();
    }
  };
}

function createNotesUI(system, { openCameras, windowManager = createDesktopWindows() } = {}) {
  const $ = id => document.getElementById(id);
  const explorer = $('file-explorer-window');
  const editor = $('notes-editor-window');
  const explorerContent = $('file-explorer-content');
  const explorerLocation = $('file-explorer-location');
  const explorerStatus = $('file-explorer-status');
  const explorerSidebar = $('file-explorer-sidebar');
  const search = $('file-explorer-search');
  const backButton = $('file-explorer-back');
  const forwardButton = $('file-explorer-forward');
  const upButton = $('file-explorer-up');
  const input = $('personal-notes-input');
  const feedback = $('personal-notes-feedback');
  const taskExplorer = $('taskbar-explorer');
  const taskNotes = $('taskbar-notes');
  const windows = [explorer, editor];
  const tasks = new Map([[explorer, taskExplorer], [editor, taskNotes]]);
  for (const panel of windows) windowManager.register(panel.id, panel, tasks.get(panel));
  const history = [{ kind: 'root' }];
  let historyIndex = 0;
  const resetWindows = [];


  const view = () => history[historyIndex];
  const node = (tag, className, label) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (label !== undefined) element.textContent = label;
    return element;
  };
  const icon = (name, className = '') => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    if (className) svg.setAttribute('class', className);
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#icon-' + name);
    svg.append(use);
    return svg;
  };
  const normalized = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  function navigate(next) {
    history.splice(historyIndex + 1);
    history.push(next);
    historyIndex = history.length - 1;
    search.value = '';
    render();
  }

  function goBack() {
    if (historyIndex > 0) {
      historyIndex--;
      search.value = '';
      render();
    }
  }

  function goForward() {
    if (historyIndex < history.length - 1) {
      historyIndex++;
      search.value = '';
      render();
    }
  }

  function goUp() {
    const current = view();
    if (current.kind === 'file') navigate({ kind: 'folder', folder: current.folder });
    else if (current.kind === 'folder') navigate({ kind: 'folders' });
    else if (current.kind === 'folders') navigate({ kind: 'root' });
  }

  function entry(symbol, name, type, details, callback) {
    const button = node('button', 'file-explorer-item');
    button.type = 'button';
    button.title = name;
    button.append(icon(symbol, 'file-explorer-icon'));
    const label = node('span', 'file-explorer-name');
    label.textContent = name;
    button.append(label, node('span', 'file-explorer-type', type), node('span', 'file-explorer-detail', details || ''));
    button.addEventListener('click', callback);
    return button;
  }

  function sidebarButton(symbol, name, next, active) {
    const button = node('button', 'file-explorer-sidebar-link');
    button.type = 'button';
    button.append(icon(symbol), node('span', '', name));
    if (active) button.setAttribute('aria-current', 'page');
    button.addEventListener('click', () => navigate(next));
    explorerSidebar.append(button);
  }

  function renderSidebar() {
    const current = view();
    explorerSidebar.replaceChildren(node('div', 'file-explorer-sidebar-title', 'Acesso rápido'));
    sidebarButton('pc', 'Este computador', { kind: 'root' }, current.kind === 'root');
    sidebarButton('folder', 'Notas', { kind: 'folders' }, current.kind === 'folders');
    explorerSidebar.append(node('div', 'file-explorer-sidebar-title', 'Pastas'));
    for (const folder of system.folders) {
      sidebarButton('folder', folder, { kind: 'folder', folder },
        (current.kind === 'folder' || current.kind === 'file') && current.folder === folder);
    }
  }

  function render() {
    const current = view();
    explorerContent.replaceChildren();
    renderSidebar();
    backButton.disabled = historyIndex === 0;
    forwardButton.disabled = historyIndex === history.length - 1;
    upButton.disabled = current.kind === 'root';
    const parts = ['Este computador'];
    if (current.kind !== 'root') parts.push('Notas');
    if (current.folder) parts.push(current.folder);
    if (current.kind === 'file') parts.push(current.file.nome_visivel);
    explorerLocation.textContent = parts.join('  ›  ');
    const term = normalized(search.value.trim());
    const matches = (...values) => !term || values.some(value => normalized(value || '').includes(term));
    let count = 0;

    if (current.kind === 'file') {
      const file = current.file;
      explorerContent.classList.add('is-file');
      explorerContent.append(
        node('h3', 'file-note-title', file.nome_visivel),
        node('p', 'file-note-meta', file.tipo + ' · ' + file.autor_nome),
        node('pre', 'file-note-text', file.texto)
      );
      explorerStatus.textContent = 'Documento de texto · Somente leitura';
      return;
    }

    explorerContent.classList.remove('is-file');
    if (current.kind === 'root') {
      explorerContent.append(node('div', 'file-explorer-heading', 'Aplicativos'));
      for (const [symbol, name, description, action] of [
        ['cameras', 'Câmeras', 'Aplicativo', () => openCameras?.()],
        ['notes', 'Notas', 'Aplicativo', openEditor]
      ]) {
        if (matches(name, description)) { explorerContent.append(entry(symbol, name, description, '', action)); count++; }
      }
      explorerContent.append(node('div', 'file-explorer-heading', 'Pastas'));
      if (matches('Notas', 'Pasta de arquivos')) {
        explorerContent.append(entry('folder', 'Notas', 'Pasta de arquivos', '', () => navigate({ kind: 'folders' })));
        count++;
      }
    } else if (current.kind === 'folders') {
      for (const folder of system.folders) {
        if (!matches(folder, 'Pasta de arquivos')) continue;
        const total = system.files().filter(file => file.pasta === folder).length;
        explorerContent.append(entry('folder', folder, 'Pasta de arquivos',
          total + (total === 1 ? ' arquivo' : ' arquivos'), () => navigate({ kind: 'folder', folder })));
        count++;
      }
    } else {
      for (const file of system.files().filter(file => file.pasta === current.folder)) {
        if (!matches(file.nome_visivel, file.tipo, file.autor_nome, file.texto)) continue;
        explorerContent.append(entry('file', file.nome_visivel, 'Documento de texto', file.autor_nome,
          () => navigate({ kind: 'file', folder: current.folder, file })));
        count++;
      }
    }
    if (!count) explorerContent.append(node('p', 'file-explorer-empty',
      term ? 'Nenhum item corresponde à pesquisa.' : 'Esta pasta está vazia.'));
    explorerStatus.textContent = count + (count === 1 ? ' item' : ' itens');
  }

  function raise(panel) {
    windowManager.raise(panel.id);
  }

  function close(panel) {
    windowManager.close(panel.id);
  }

  function minimize(panel) {
    windowManager.minimize(panel.id);
  }

  function show(panel) {
    raise(panel);
    // Window positions are stored in pixels after dragging. Keep them visible on resize.
    if (!panel.hasAttribute('data-maximized') && panel.style.left) {
      const bounds = panel.parentElement.getBoundingClientRect();
      panel.style.left = Math.max(0, Math.min(parseFloat(panel.style.left), bounds.width - panel.offsetWidth)) + 'px';
      panel.style.top = Math.max(0, Math.min(parseFloat(panel.style.top), bounds.height - panel.offsetHeight)) + 'px';
    }
  }

  function hide() {
    for (const panel of windows) close(panel);
  }

  function openExplorer() {
    render();
    show(explorer);
    $('file-explorer-close').focus({ preventScroll: true });
  }

  function openEditor() {
    show(editor);
    input.focus({ preventScroll: true });
  }

  function savePersonal() {
    const result = system.savePersonal(input.value);
    if (result.error) {
      feedback.textContent = result.error;
      return;
    }
    feedback.textContent = result.file.nome_visivel + ' salvo em Notas / Outras.';
    input.value = '';
  }

  function bindWindow(panel, { titlebar, minimizeId, maximizeId, closeId }) {
    const bar = $(titlebar);
    const maximizeButton = $(maximizeId);
    const resizeHandle = panel.querySelector('.notes-resize-handle');
    let gesture;
    let oldGeometry;

    function bounds() { return panel.parentElement.getBoundingClientRect(); }
    function toggleMaximize() {
      if (panel.hasAttribute('data-maximized')) {
        panel.removeAttribute('data-maximized');
        for (const key of ['left', 'top', 'width', 'height']) panel.style[key] = oldGeometry?.[key] || '';
        maximizeButton.setAttribute('aria-label', 'Maximizar janela');
        maximizeButton.title = 'Maximizar';
      } else {
        oldGeometry = Object.fromEntries(['left', 'top', 'width', 'height'].map(key => [key, panel.style[key]]));
        panel.setAttribute('data-maximized', '');
        maximizeButton.setAttribute('aria-label', 'Restaurar janela');
        maximizeButton.title = 'Restaurar';
      }
      raise(panel);
    }

    panel.addEventListener('pointerdown', () => raise(panel));
    $(closeId).addEventListener('click', () => close(panel));
    $(minimizeId).addEventListener('click', () => minimize(panel));
    maximizeButton.addEventListener('click', toggleMaximize);
    bar.addEventListener('dblclick', event => {
      if (!event.target.closest('button')) toggleMaximize();
    });

    function start(event, mode, handle) {
      if (event.button !== 0 || panel.hasAttribute('data-maximized')) return;
      const area = bounds();
      const rect = panel.getBoundingClientRect();
      gesture = { mode, handle, id: event.pointerId, x: event.clientX, y: event.clientY,
        left: rect.left - area.left, top: rect.top - area.top,
        width: rect.width, height: rect.height };
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
      raise(panel);
    }

    bar.addEventListener('pointerdown', event => {
      if (event.target.closest('button')) return;
      start(event, 'move', bar);
    });
    resizeHandle.addEventListener('pointerdown', event => start(event, 'resize', resizeHandle));

    const move = event => {
      if (!gesture || event.pointerId !== gesture.id) return;
      const area = bounds();
      const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
      if (gesture.mode === 'move') {
        panel.style.left = Math.max(0, Math.min(gesture.left + dx, area.width - gesture.width)) + 'px';
        panel.style.top = Math.max(0, Math.min(gesture.top + dy, area.height - gesture.height)) + 'px';
      } else {
        const minWidth = Math.min(300, area.width);
        const minHeight = Math.min(190, area.height);
        panel.style.width = Math.max(minWidth, Math.min(gesture.width + dx, area.width - gesture.left)) + 'px';
        panel.style.height = Math.max(minHeight, Math.min(gesture.height + dy, area.height - gesture.top)) + 'px';
      }
    };
    const finish = event => {
      if (gesture?.id !== event.pointerId) return;
      gesture = null;
    };
    for (const handle of [bar, resizeHandle]) {
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', finish);
      handle.addEventListener('pointercancel', finish);
      handle.addEventListener('lostpointercapture', finish);
    }
    resetWindows.push(() => {
      const previous = gesture;
      gesture = oldGeometry = undefined;
      if (previous?.handle.hasPointerCapture?.(previous.id)) previous.handle.releasePointerCapture(previous.id);
      maximizeButton.setAttribute('aria-label', 'Maximizar janela');
      maximizeButton.title = 'Maximizar';
    });
  }

  bindWindow(explorer, {
    titlebar: 'file-explorer-titlebar', minimizeId: 'file-explorer-minimize',
    maximizeId: 'file-explorer-maximize', closeId: 'file-explorer-close'
  });
  bindWindow(editor, {
    titlebar: 'notes-editor-titlebar', minimizeId: 'notes-editor-minimize',
    maximizeId: 'notes-editor-maximize', closeId: 'notes-editor-close'
  });
  backButton.addEventListener('click', goBack);
  forwardButton.addEventListener('click', goForward);
  upButton.addEventListener('click', goUp);
  search.addEventListener('input', render);
  $('personal-notes-save').addEventListener('click', savePersonal);
  $('personal-notes-open-folder').addEventListener('click', () => {
    navigate({ kind: 'folder', folder: 'Outras' });
    openExplorer();
  });
  for (const panel of windows) {
    panel.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.stopPropagation(); close(panel); }
    });
  }
  editor.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      savePersonal();
    }
  });
  system.subscribe(() => { if (!explorer.hidden) render(); });
  return { openExplorer, openEditor, hide, render,
    reset() {
      for (const reset of resetWindows) reset();
      history.splice(0, history.length, { kind: 'root' });
      historyIndex = 0;
      search.value = input.value = feedback.textContent = '';
      render();
    }
  };
}

Object.assign(window.NathGame, { createNotesUI, createDesktopWindows });
})();
