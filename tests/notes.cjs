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
console.log('Notas, arquivos e guardas: OK');
