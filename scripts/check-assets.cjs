const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root, listFiles, readConfig, configAssets, publicationFiles, mediaExtension } = require('./pages-files.cjs');
const legacyPaths = require('./legacy-asset-paths.json');

const sourceFiles = ['index.html', 'README.md', ...['src', 'config', 'scripts', 'tests', 'docs', '.github']
  .flatMap(directory => fs.existsSync(path.join(root, directory)) ? listFiles(root, directory) : [])];
const siteCode = sourceFiles.filter(file => /^src\/.*\.(?:js|css)$/.test(file));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const references = [];
const errors = new Set();

function reference(url, origin, directory = '.', publicRelative = false) {
  if (/^(?:#|[a-z]+:|\/\/)/i.test(url)) return;
  if (url.startsWith('/')) {
    errors.add(`${origin}: use um caminho relativo ao site em vez de ${url}`);
    return;
  }
  const file = decodeURIComponent(url.split(/[?#]/)[0]);
  references.push({ file: path.posix.join(publicRelative ? 'public' : directory, file), origin });
}

const config = readConfig();
references.push(...configAssets(config));
for (const [, url] of read('index.html').matchAll(/\b(?:src|href|poster)\s*=\s*["']([^"']+)["']/gi)) {
  reference(url, 'index.html');
}
for (const file of siteCode.filter(file => file.endsWith('.css'))) {
  for (const [, single, double, bare] of read(file).matchAll(/url\(\s*(?:'([^']+)'|"([^"]+)"|([^\s)]+))\s*\)/gi)) {
    reference(single ?? double ?? bare, file, path.posix.dirname(file));
  }
}
for (const file of siteCode.filter(file => file.endsWith('.js') && file !== 'src/data/local-config.js')) {
  for (const [, url] of read(file).matchAll(/['"`]((?:\.\/)?(?:public|audio|images)\/[^'"`\r\n]+)['"`]/g)) {
    if (!url.includes('${') && mediaExtension.test(url)) reference(url, file, '.', !/^(?:\.\/)?public\//.test(url));
  }
}

async function dynamicAssets() {
  const scope = vm.createContext({ window: {}, URL, document: {
    currentScript: { src: 'https://example.invalid/NNN/src/config.js' }
  }, Audio: class {
    constructor(url) { reference(url, 'src/sound.js → preloadSamples'); }
  } });
  const run = file => vm.runInContext(read('src/' + file), scope, { filename: file });
  for (const file of ['data/game-data.js', 'data/camera-layers.js', 'data/complex-layers.js',
    'scene-art.js', 'sound.js', 'config.js']) run(file);
  const game = scope.window.NathGame;

  function verifyData(data, origin) {
    if (typeof data === 'string' && /^(?:\.\/)?public\//.test(data)) reference(data, origin);
    if (data && typeof data === 'object') {
      for (const [key, value] of Object.entries(data)) verifyData(value, `${origin} → ${key}`);
    }
  }
  assert.deepEqual(Array.from(game.CAMERAS, cam => cam.id),
    Array.from({ length: 12 }, (_, i) => 'CAM' + String(i + 1).padStart(2, '0')));
  for (const cam of game.CAMERAS) verifyData(cam, 'src/data/game-data.js → ' + cam.id);
  verifyData(game.OFFICE.images, 'src/data/game-data.js → OFFICE.images');
  verifyData(game.cameraLayers, 'src/data/camera-layers.js');
  verifyData(game.complexLayers, 'src/data/complex-layers.js');

  for (const id of game.OFFICE.characters) reference(game.officeCharacterImage('room', id), 'src/scene-art.js → escritório');
  for (const id of game.OFFICE.doorwayCharacters) reference(game.officeCharacterImage('doorway', id), 'src/scene-art.js → porta');
  for (const gate of ['open', 'closed']) reference(game.closetFrame(gate, [], null).source, 'src/scene-art.js → frestas');
  new game.SoundEngine().preloadSamples();

  const main = read('src/main.js');
  const folder = name => main.match(new RegExp(`const ${name} = '([^']+)'`))[1];
  for (const [, clip] of main.matchAll(/\baudio = '([^']+)'/g)) {
    reference(folder('JUMPSCARE_AUDIO') + clip, 'src/main.js → áudio de jumpscare');
  }
  for (const [, image] of main.matchAll(/\bart: '([^']+\.webp)'/g)) {
    reference(folder('CLOWN_ART') + image, 'src/main.js → poses da Palhaça');
  }
  const templates = [...main.matchAll(/`(\.\/public\/[^`]+)`/g)].map(([, url]) => url);
  const jumpscares = templates.filter(url => url.includes('${character}') || url.includes('${config.characters[value].artId}'));
  assert.equal(jumpscares.length, 2, 'Confira os padrões de jumpscare em src/main.js');
  for (const [id, { artId }] of Object.entries(config['config/characters.json'])) {
    for (const url of jumpscares) {
      reference(url.replace(/\$\{[^}]+\}/, artId), 'src/main.js + config/characters.json → ' + id + '.artId');
    }
  }
  const radio = templates.find(url => url.includes('${track}'));
  assert(radio, 'Confira o padrão das faixas de rádio em src/main.js');
  for (const track of config['config/controls.json'].radioTracks) {
    reference(radio.replace('${track}', track), 'src/main.js + config/controls.json → radioTracks');
  }

  scope.fetch = async url => {
    const file = url.pathname.replace(/^\/NNN\//, '');
    assert(url.pathname.startsWith('/NNN/config/'), `Caminho HTTP inválido: ${url}`);
    reference(file, 'src/config.js → configuração HTTP');
    return { ok: true, json: async () => ({}) };
  };
  await game.loadConfig();
  scope.document = {
    currentScript: { src: 'file:///NNN/src/config.js' },
    createElement: () => ({}),
    head: { append(script) {
      const url = new URL(script.src);
      assert(url.pathname.startsWith('/NNN/src/'), `Caminho file:// inválido: ${url}`);
      reference(url.pathname.slice('/NNN/'.length), 'src/config.js → configuração file://');
      script.onload();
    } }
  };
  run('config.js');
  await game.loadConfig();
}

function checkLegacyPaths() {
  const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?<![\\w.-])(?:${legacyPaths.map(escape).join('|')})(?![\\w.-])`, 'gu');
  for (const file of sourceFiles) {
    if (file === 'scripts/legacy-asset-paths.json' || !/\.(?:cjs|css|html|js|json|md|py|ya?ml)$/.test(file)) continue;
    for (const [name] of read(file).matchAll(match)) errors.add(`${file}: referência antiga: ${name}`);
  }
}

function checkCase(files, label) {
  const seen = new Map();
  for (const file of files) {
    for (let segment = file; segment !== '.'; segment = path.posix.dirname(segment)) {
      const key = segment.toLowerCase();
      if (!seen.has(key)) seen.set(key, segment);
      if (seen.get(key) !== segment) errors.add(`${label}: conflito de caixa: ${seen.get(key)} e ${segment}`);
    }
  }
}

function checkPublicLayout(files) {
  for (const file of files) {
    if (/^public\/[^/]+$/.test(file)) errors.add(`public/: arquivo solto na raiz: ${file}`);
    if (!/^public\/(?:images|audio)\//.test(file)) continue;
    const filename = path.posix.basename(file);
    if (/[A-Z\s\u0080-\uffff]/u.test(filename)) {
      errors.add(`public/: nome de mídia sem padronização: ${file}`);
    }
  }
}

async function check() {
  await dynamicAssets();
  checkLegacyPaths();
  const repoFiles = new Set(['.nojekyll', ...sourceFiles,
    ...['outros', 'public', 'reserva'].flatMap(directory => listFiles(root, directory))]);
  checkCase(repoFiles, 'Repositório');
  checkPublicLayout(repoFiles);

  const destination = process.argv[2] ? path.resolve(process.argv[2]) : null;
  const selected = new Set(publicationFiles());
  const packaged = destination ? new Set(listFiles(destination)) : selected;
  checkCase(packaged, 'Pacote');
  for (const file of selected) {
    if (!packaged.has(file)) errors.add(`Pacote: arquivo selecionado ausente: ${file}`);
  }
  for (const file of packaged) {
    if (!selected.has(file)) errors.add(`Pacote: arquivo fora das regras de publicação: ${file}`);
  }
  for (const { file, origin } of references) {
    if (!repoFiles.has(file)) errors.add(`${origin}: arquivo ausente ou com caixa incorreta: ${file}`);
    else if (!packaged.has(file)) errors.add(`${origin}: arquivo ausente do pacote: ${file}`);
  }
  if (errors.size) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
    return;
  }
  console.log(`${new Set(references.map(({ file }) => file)).size} caminhos verificados; ${packaged.size} arquivos ${destination ? 'no pacote' : 'na seleção'}.`);
}

check().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
