const assert = require('node:assert/strict');

const storage = new Map();
global.window = { NathGame: {} };
global.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key)
};

require('../src/data/notes-content.js');
require('../src/notes-system.js');

const { notesCatalog, createNotesSystem } = window.NathGame;
assert.equal(notesCatalog.lembretes.length, 22);
assert.equal(notesCatalog.recuperadas.length, 46);
assert.equal(new Set([...notesCatalog.lembretes, ...notesCatalog.recuperadas].map(note => note.id)).size, 68);
const system = createNotesSystem(notesCatalog);
assert.deepEqual(system.guards, [
  'Pedro Garcia', 'Pedro Babugia', 'Henrique Baatalha', 'Caio Pontes',
  'Felipe Riva', 'Felipe Lima', 'Arthur Ramos', 'Rafael Ferraz',
  'Paulo Ventura', 'Arthur Guedes', 'Alexandre Do Bim', 'João Gannoun'
]);
assert(!system.guards.includes('Rafael Vasques'));
assert.deepEqual(system.folders, [
  'Gerais', 'Principal', 'Yandere', 'Gotica', 'Gatinha', 'Maid',
  'Palhaça', 'Smores', 'Alucinações', 'Energia', 'Outras'
]);
assert.equal(system.counter(), '12/12');
assert.equal(system.activeGuard(), 'Pedro Garcia');

assert.equal(system.completeNight(1).length, 3);
assert.equal(system.completeNight(1).length, 0);
assert.equal(system.completeNight(2).length, 3);
assert.equal(system.completeNight(8).length, 0);
assert.equal(system.completeNight(9).length, 1);
assert.equal(system.files().length, 7);
assert.equal(system.files()[0].nome_visivel, 'Anotação_1.txt');
assert.equal(system.files()[6].nome_visivel, 'Anotação_7.txt');

const first = system.recordDeath(2, 'principal');
assert.equal(first.deadGuard, 'Pedro Garcia');
assert.equal(first.nextGuard, 'Pedro Babugia');
assert.equal(first.counter, '11/12');
assert.equal(first.unlocked.length, 4);
assert(first.unlocked.every(file => file.autor_nome === 'Pedro Garcia'));
assert(!first.unlocked.some(file => file.id_do_conteudo_ou_id_de_nota_pessoal === 'R46'));

const second = system.recordDeath(2, 'yandere');
assert.equal(second.deadGuard, 'Pedro Babugia');
assert.equal(second.nextGuard, 'Henrique Baatalha');
assert.equal(second.counter, '10/12');
assert.equal(second.unlocked.length, 6);
assert.equal(second.unlocked.filter(file => file.id_do_conteudo_ou_id_de_nota_pessoal === 'R46').length, 1);

const third = system.recordDeath(2, 'gotica');
assert.equal(third.counter, '09/12');
assert.equal(third.unlocked.length, 5);
assert(!third.unlocked.some(file => file.id_do_conteudo_ou_id_de_nota_pessoal === 'R46'));

const personal = system.savePersonal('A última porta ficou aberta.\nOuvi passos.');
assert.equal(personal.file.pasta, 'Outras');
assert.equal(personal.file.tipo, 'Pessoal');
assert.equal(personal.file.autor_nome, 'Caio Pontes');
assert.equal(personal.file.nome_visivel, 'Anotação_23.txt');
assert.equal(system.savePersonal('  ').error, 'Escreva alguma coisa antes de salvar.');

const restored = createNotesSystem(notesCatalog);
assert.equal(restored.counter(), '09/12');
assert.equal(restored.files().length, system.files().length);
assert.deepEqual(restored.deathsByNight(), { '2': 3 });
for (let i = 0; i < 9; i++) {
  const dead = restored.recordDeath(2, 'maid');
  assert.equal(dead.deadGuard, system.guards[3 + i]);
  assert.equal(dead.counter, String(8 - i).padStart(2, '0') + '/12');
}
assert.equal(restored.counter(), '00/12');
assert.equal(restored.activeGuard(), null);
assert.equal(restored.recordDeath(2, 'maid'), null);
assert.equal(restored.completeNight(2).length, 0);
assert(restored.files().every((file, i) => file.numero_global === i + 1));
assert.equal(new Set(restored.files().map(file => file.id_do_conteudo_ou_id_de_nota_pessoal)).size, restored.files().length);

restored.reset();
assert.equal(restored.counter(), '12/12');
assert.equal(restored.activeGuard(), 'Pedro Garcia');
assert.equal(restored.files().length, 0);
assert.equal(restored.completeNight(1).length, 3);
// The static deployment must include both new apps and preserve the computer shell.
const fs = require('node:fs');
const html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
for (const id of [
  'open-file-explorer', 'open-notes-editor', 'file-explorer-window',
  'notes-editor-window', 'file-explorer-content', 'personal-notes-input',
  'taskbar-explorer', 'taskbar-notes', 'game-over-guards',
  'file-explorer-titlebar', 'notes-editor-titlebar',
  'file-explorer-sidebar', 'file-explorer-search', 'file-explorer-status',
  'file-explorer-back', 'file-explorer-forward', 'file-explorer-up',
  'file-explorer-minimize', 'file-explorer-maximize',
  'notes-editor-minimize', 'notes-editor-maximize'
]) assert(html.includes('id="' + id + '"'), 'missing desktop id ' + id);
for (const script of ['data/notes-content.js', 'notes-system.js', 'notes-ui.js']) {
  assert(html.includes('./src/' + script), 'missing script ' + script);
}
assert(html.includes('./src/styles/notes.css'));
assert(!html.includes('id="guard-hud"'), 'guard HUD must not appear while playing');
assert(!html.includes('id="game-over-next-guard"'), 'guard identities must stay off the game-over screen');
for (const icon of ['folder', 'notes', 'file', 'pc']) {
  assert(html.includes('id="icon-' + icon + '"'), 'missing vector icon ' + icon);
}
const notesUi = fs.readFileSync(require('node:path').join(__dirname, '../src/notes-ui.js'), 'utf8');
assert(notesUi.includes("setPointerCapture(event.pointerId)"), 'window dragging and resizing must support pointer capture');
assert(notesUi.includes("function toggleMaximize()"), 'application windows must maximize and restore');
assert(notesUi.includes("search.addEventListener('input', render)"), 'explorer search must be interactive');
const gameSource = fs.readFileSync(require('node:path').join(__dirname, '../src/main.js'), 'utf8');
assert(!gameSource.includes('guardHud'), 'guard HUD logic must be removed');
assert(gameSource.includes('guardCounter.hidden = !death'), 'only campaign deaths should show the counter');
assert(gameSource.includes('guardCounter.textContent = death.counter'), 'game over should show only the remaining-guards counter');
const style = fs.readFileSync(require('node:path').join(__dirname, '../src/styles/main.css'), 'utf8');
assert(style.includes('min(10.6cqw,20cqh)'), 'title should be slightly larger on desktop');

// Check the campaign clock and the approved route-balancing parameters.
require('../src/gameplay/resources.js');
const night = require('../config/night.json');
const movement = require('../config/movement.json');
const { hourDuration, clockProgress } = window.NathGame;
assert.equal(hourDuration(night.clock, 90), 60);
assert.equal(hourDuration(night.clock, 5), 180);
assert.equal(clockProgress(night.clock, 5, 0, 180), 1);
assert.equal(clockProgress(night.clock, 4.99, 0, 3600), 0);
assert.equal(movement.routes.huntBonus, 40);
assert.deepEqual(movement.routes.bonus, [30, 48]);
console.log('Notas, arquivos, guardas e limites de balanceamento: OK');
