(() => {
'use strict';

function createNotesUI(system, { openCameras } = {}) {
  const $ = id => document.getElementById(id);
  const explorer = $('file-explorer-window');
  const editor = $('notes-editor-window');
  const explorerContent = $('file-explorer-content');
  const explorerLocation = $('file-explorer-location');
  const backButton = $('file-explorer-back');
  const input = $('personal-notes-input');
  const feedback = $('personal-notes-feedback');
  const taskExplorer = $('taskbar-explorer');
  const taskNotes = $('taskbar-notes');
  let view = { kind: 'root' };

  const node = (tag, className, label) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (label !== undefined) element.textContent = label;
    return element;
  };

  function item(icon, name, detail, callback) {
    const button = node('button', 'file-explorer-item');
    button.type = 'button';
    button.append(node('span', 'file-explorer-icon', icon));
    const label = node('span', 'file-explorer-item-label');
    label.append(node('strong', '', name));
    if (detail) label.append(node('small', '', detail));
    button.append(label);
    button.addEventListener('click', callback);
    return button;
  }

  function navigate(next) {
    view = next;
    render();
  }

  function render() {
    explorerContent.replaceChildren();
    let title = 'Este computador';
    let canBack = view.kind !== 'root';
    if (view.kind === 'root') {
      explorerContent.append(node('div', 'file-explorer-heading', 'Aplicativos'));
      explorerContent.append(
        item('📹', 'Câmeras', 'Vigilância', () => { hide(); openCameras?.(); }),
        item('📝', 'Notas', 'Criar uma anotação', openEditor)
      );
      explorerContent.append(node('div', 'file-explorer-heading', 'Pastas'));
      explorerContent.append(item('📁', 'Notas', 'Arquivos recuperados', () => navigate({ kind: 'folders' })));
    } else if (view.kind === 'folders') {
      title = 'Este computador / Notas';
      for (const folder of system.folders) {
        const count = system.files().filter(file => file.pasta === folder).length;
        explorerContent.append(item('📁', folder, count + (count === 1 ? ' arquivo' : ' arquivos'),
          () => navigate({ kind: 'folder', folder })));
      }
    } else if (view.kind === 'folder') {
      title = 'Notas / ' + view.folder;
      const entries = system.files().filter(file => file.pasta === view.folder);
      if (!entries.length) explorerContent.append(node('p', 'file-explorer-empty', 'Esta pasta está vazia.'));
      for (const file of entries) {
        explorerContent.append(item('📄', file.nome_visivel, file.tipo + ' · ' + file.autor_nome,
          () => navigate({ kind: 'file', folder: view.folder, file })));
      }
    } else if (view.kind === 'file') {
      title = 'Notas / ' + view.folder + ' / ' + view.file.nome_visivel;
      const file = view.file;
      const heading = node('h3', 'file-note-title', file.nome_visivel);
      const meta = node('p', 'file-note-meta', 'Tipo: ' + file.tipo + '  ·  Autor: ' + file.autor_nome);
      const text = node('pre', 'file-note-text', file.texto);
      explorerContent.append(heading, meta, text);
    }
    explorerLocation.textContent = title;
    backButton.disabled = !canBack;
  }

  function back() {
    if (view.kind === 'file') navigate({ kind: 'folder', folder: view.folder });
    else if (view.kind === 'folder') navigate({ kind: 'folders' });
    else navigate({ kind: 'root' });
  }

  function hide() {
    explorer.hidden = true;
    editor.hidden = true;
    taskExplorer.setAttribute('aria-pressed', 'false');
    taskNotes.setAttribute('aria-pressed', 'false');
  }

  function openExplorer() {
    hide();
    render();
    explorer.hidden = false;
    taskExplorer.setAttribute('aria-pressed', 'true');
    $('file-explorer-close').focus({ preventScroll: true });
  }

  function openEditor() {
    hide();
    feedback.textContent = '';
    editor.hidden = false;
    taskNotes.setAttribute('aria-pressed', 'true');
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
    view = { kind: 'folder', folder: 'Outras' };
  }

  backButton.addEventListener('click', back);
  $('file-explorer-close').addEventListener('click', hide);
  $('notes-editor-close').addEventListener('click', hide);
  $('personal-notes-save').addEventListener('click', savePersonal);
  $('personal-notes-open-folder').addEventListener('click', () => {
    view = { kind: 'folder', folder: 'Outras' };
    openExplorer();
  });
  explorer.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.stopPropagation(); hide(); }
  });
  editor.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.stopPropagation(); hide(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      savePersonal();
    }
  });
  system.subscribe(() => { if (!explorer.hidden) render(); });
  return { openExplorer, openEditor, hide, render };
}

window.NathGame.createNotesUI = createNotesUI;
})();
