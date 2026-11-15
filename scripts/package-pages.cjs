// Monta o site estático para publicação. Execute com node scripts/package-pages.cjs.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const destination = path.resolve(process.argv[2] ?? path.join(root, 'dist'));
const files = [
  '.nojekyll', 'index.html',
  'public/images/Anúncio Vintage de Contratação Animatrônica.png',
  'public/images/Smores nas Frestas do Escritório.png',
  'public/NNN_Yandere_Jumpscare_1080p.gif',

];

function include(directory, pattern) {
  for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    const relative = path.relative(root, path.join(entry.parentPath, entry.name)).split(path.sep).join('/');
    if (pattern.test(relative)) files.push(relative);
  }
}

include('src', /\.(js|css)$/);
include('config', /\.json$/);
include('public/images', /(?:\.(webp|gif|svg)$|\/cameras\/CAM\d{2}\/technical\.png$)/);
include('public/audio', /\.(mp3|ogg|wav)$/);

// As variantes iluminadas e os dois recortes antigos do armário servem aos testes de arte.
const runtimeFiles = files.filter(file => !/^public\/images\/office\/(?:states\/(?:open-lit|corridor)\/|closet\/layers\/(?:yandere|platinada)\.webp$)/.test(file));
fs.mkdirSync(destination, { recursive: true });
if (fs.readdirSync(destination).length) throw new Error(`Use uma pasta vazia para publicar: ${destination}`);

let bytes = 0;
for (const file of runtimeFiles) {
  const source = path.join(root, file);
  const output = path.join(destination, file);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.copyFileSync(source, output);
  bytes += fs.statSync(source).size;
}
console.log(`${runtimeFiles.length} arquivos, ${(bytes / 1e6).toFixed(2)} MB em ${destination}`);
