(() => {
'use strict';

const GUARDS = Object.freeze([
  'Pedro Garcia', 'Pedro Babugia', 'Henrique Baatalha', 'Caio Pontes',
  'Felipe Riva', 'Felipe Lima', 'Arthur Ramos', 'Rafael Ferraz',
  'Paulo Ventura', 'Arthur Guedes', 'Alexandre Do Bim', 'João Gannoun'
]);
const STORAGE_KEY = 'nnn.notes.v1';
const FOLDERS = Object.freeze([
  'Gerais', 'Principal', 'Yandere', 'Gotica', 'Gatinha', 'Maid',
  'Palhaça', 'Smores', 'Alucinações', 'Energia', 'Outras'
]);
const REMINDER_TYPE = 'Lembrete';
const RECOVERED_TYPE = 'Recuperada';

function newSave() {
  return { version: 1, deaths: 0, deathsByNight: {}, files: [], nextNumber: 1 };
}

function restore(key = STORAGE_KEY, allowLegacy = false) {
  try {
    const value = localStorage.getItem(key);
    const loaded = JSON.parse(value === null && allowLegacy ? localStorage.getItem(STORAGE_KEY) : value);
    if (!loaded || loaded.version !== 1 || !Array.isArray(loaded.files)) return newSave();
    const files = loaded.files.filter(file => file && typeof file === 'object'
      && typeof file.nome_visivel === 'string' && typeof file.texto === 'string'
      && FOLDERS.includes(file.pasta));
    const numbers = files.map(file => Number(file.numero_global)).filter(Number.isSafeInteger);
    return {
      version: 1,
      deaths: Math.max(0, Math.min(GUARDS.length, Number(loaded.deaths) || 0)),
      deathsByNight: loaded.deathsByNight && typeof loaded.deathsByNight === 'object'
        ? loaded.deathsByNight : {},
      files,
      nextNumber: Math.max(1, Number(loaded.nextNumber) || 1, ...numbers.map(n => n + 1))
    };
  } catch {
    return newSave();
  }
}

function createNotesSystem(catalog) {
  if (!catalog || catalog.lembretes?.length !== 22 || catalog.recuperadas?.length !== 46) {
    throw new Error('Catálogo de notas do NNN incompleto.');
  }
  let save = restore();
  let currentKey = STORAGE_KEY;
  const listeners = new Set();
  const notify = () => { for (const callback of listeners) callback(); };
  const campaignKey = id => 'nnn.notes.v2.' + id;

  function selectCampaign(id) {
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('Campanha inválida.');
    currentKey = campaignKey(id);
    save = restore(currentKey, id === 1);
    // Preserve the pre-migration save on the first selection.
    persist();
  }

  function deleteCampaign(id) {
    if (!Number.isSafeInteger(id) || id < 1) return;
    try { localStorage.removeItem(campaignKey(id)); } catch {}
  }

  function persist() {
    try {
      localStorage.setItem(currentKey, JSON.stringify(save));
      notify();
      return true;
    } catch {
      notify();
      return false;
    }
  }

  function remaining() {
    return Math.max(0, GUARDS.length - save.deaths);
  }
  function counter() {
    return String(remaining()).padStart(2, '0') + '/' + GUARDS.length;
  }
  function activeGuard() {
    return GUARDS[save.deaths] || null;
  }
  function files() {
    return save.files.map(file => ({ ...file }));
  }
  function add(content, type, name, event) {
    if (content.id && save.files.some(file => file.id_do_conteudo_ou_id_de_nota_pessoal === content.id)) {
      return null;
    }
    const n = save.nextNumber++;
    const file = {
      uid_unico: 'nnn-' + n,
      id_do_conteudo_ou_id_de_nota_pessoal: content.id || 'P' + n,
      nome_visivel: 'Anotação_' + n + '.txt',
      numero_global: n,
      ordem_de_obtencao: n,
      tipo: type,
      pasta: content.pasta,
      autor_nome: name,
      autor_tipo: type === 'Pessoal' ? 'guarda_atual' : type === REMINDER_TYPE
        ? 'guarda_sobrevivente' : 'guarda_desaparecido',
      texto: content.texto,
      evento_que_liberou: event
    };
    save.files.push(file);
    return file;
  }

  function completeNight(night) {
    if (!Number.isInteger(night) || night < 1 || night > 9 || !activeGuard()) return [];
    const unlocked = catalog.lembretes.filter(note => note.etapa === night)
      .map(note => add(note, REMINDER_TYPE, activeGuard(), 'noite_' + night + '_concluida'))
      .filter(Boolean);
    if (unlocked.length) persist();
    return unlocked;
  }

  function recordDeath(night, cause) {
    if (!Number.isInteger(night) || night < 1 || night > 9 || remaining() === 0) return null;
    const deadGuard = activeGuard();
    const prior = Math.max(0, Number(save.deathsByNight[night]) || 0);
    const repeated = prior > 0;
    save.deathsByNight[night] = prior + 1;
    save.deaths++;

    const matchingCause = String(cause || '').toLowerCase();
    const chosen = [];
    const folderCounts = new Map();
    let candidates = catalog.recuperadas.filter(note => note.id !== 'R46'
      && note.etapaMinima <= night
      && !save.files.some(file => file.id_do_conteudo_ou_id_de_nota_pessoal === note.id));
    const count = 4 + Number(repeated);
    while (chosen.length < count && candidates.length) {
      candidates.sort((a, b) => {
        const score = note => (note.causas.includes(matchingCause) ? 100 : 0)
          + (note.causas.includes('geral') ? 4 : 0) - (folderCounts.get(note.pasta) || 0) * 12;
        return score(b) - score(a) || a.id.localeCompare(b.id, 'pt-BR');
      });
      const note = candidates.shift();
      chosen.push(note);
      folderCounts.set(note.pasta, (folderCounts.get(note.pasta) || 0) + 1);
    }
    const unlocked = chosen.map(note => add(note, RECOVERED_TYPE, deadGuard,
      'morte_noite_' + night)).filter(Boolean);
    if (prior === 1) {
      const special = catalog.recuperadas.find(note => note.id === 'R46');
      if (special) {
        const file = add(special, RECOVERED_TYPE, deadGuard, 'segunda_morte_na_mesma_noite');
        if (file) unlocked.push(file);
      }
    }
    const saved = persist();
    return { deadGuard, nextGuard: activeGuard(), remaining: remaining(), counter: counter(),
      unlocked, saved, exhausted: remaining() === 0 };
  }

  function savePersonal(text) {
    if (!activeGuard()) return { error: 'Não há guarda disponível para assinar a anotação.' };
    if (typeof text !== 'string' || !text.trim()) return { error: 'Escreva alguma coisa antes de salvar.' };
    const next = save.nextNumber;
    const file = add({ pasta: 'Outras', texto: text }, 'Pessoal', activeGuard(), 'nota_criada');
    if (!persist()) {
      save.files.pop();
      save.nextNumber = next;
      return { error: 'Não foi possível salvar. Verifique o espaço disponível no navegador.' };
    }
    return { file };
  }

  function reset() {
    save = newSave();
    persist();
  }
  function subscribe(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
  }

  return { guards: GUARDS, folders: FOLDERS, files, remaining, counter, activeGuard,
    completeNight, recordDeath, savePersonal, reset, subscribe, selectCampaign, deleteCampaign,
    deathsByNight: () => ({ ...save.deathsByNight }) };
}

window.NathGame.createNotesSystem = createNotesSystem;
})();
