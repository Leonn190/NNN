// Regras de seleção do site estático e leitura de assets declarados nos JSONs.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const essentialFiles = ['.nojekyll', 'index.html'];
const mediaExtension = /\.(?:avif|gif|jpe?g|mp3|ogg|png|svg|wav|webp)$/i;
// Quadros e recortes mantidos para os testes de composição.
const artOnly = /^public\/images\/office\/(?:states\/(?:open-lit|corridor)\/|closet\/layers\/(?:yandere|platinada)\.webp$)/;

function listFiles(base, directory = '.') {
  return fs.readdirSync(path.join(base, directory), { withFileTypes: true, recursive: true })
    .filter(entry => entry.isFile())
    .map(entry => path.relative(base, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'))
    .sort();
}

function readConfig() {
  return Object.fromEntries(listFiles(root, 'config').filter(file => file.endsWith('.json'))
    .map(file => [file, JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))]));
}

function configAssets(config) {
  const assets = [];
  function visit(value, file, keys = []) {
    if (typeof value === 'string') {
      const assetField = keys.some(key => /^(?:file|files|image|sound|radioTracks)$/.test(key));
      if (!assetField && !mediaExtension.test(value) && !/^(?:\.\/)?(?:public|audio|images)\//.test(value)) return;
      const url = keys[0] === 'radioTracks' ? 'audio/radio/' + value : value;
      const relative = decodeURIComponent(url.split(/[?#]/)[0]).replace(/^\.\//, '');
      assets.push({ file: relative.startsWith('public/') ? relative : 'public/' + relative,
        origin: [file, ...keys].join(' → ') });
    } else if (value && typeof value === 'object') {
      for (const [key, entry] of Object.entries(value)) visit(entry, file, [...keys, key]);
    }
  }
  for (const [file, data] of Object.entries(config)) visit(data, file);
  return assets;
}

function publicationFiles() {
  const code = listFiles(root, 'src').filter(file => /\.(?:js|css)$/.test(file));
  const config = readConfig();
  const audio = listFiles(root, 'public/audio').filter(file => /\.(?:mp3|ogg|wav)$/.test(file));
  const images = listFiles(root, 'public/images').filter(file => {
    if (artOnly.test(file)) return false;
    return /\.(?:webp|gif|svg)$/.test(file)
      || /^public\/images\/(?:intro\/[^/]+|cameras\/CAM\d{2}\/technical|office\/closet\/smores-frestas)\.png$/.test(file);
  });
  const declared = configAssets(config);
  const publicFiles = new Set(listFiles(root, 'public'));
  for (const { file, origin } of declared) {
    if (!publicFiles.has(file)) throw new Error(`${origin}: asset ausente ou com caixa incorreta: ${file}`);
  }
  return [...new Set([...essentialFiles, ...code, ...Object.keys(config), ...audio, ...images,
    ...declared.map(({ file }) => file)])];
}

module.exports = { root, listFiles, readConfig, configAssets, publicationFiles, mediaExtension };
