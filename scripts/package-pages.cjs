// Monta o site estático em uma pasta vazia. Uso: node scripts/package-pages.cjs [destino].
const fs = require('node:fs');
const path = require('node:path');
const { root, publicationFiles } = require('./pages-files.cjs');

const destination = path.resolve(process.argv[2] ?? path.join(root, 'dist'));
const files = publicationFiles();
fs.mkdirSync(destination, { recursive: true });
if (fs.readdirSync(destination).length) throw new Error(`Use uma pasta vazia para publicar: ${destination}`);

let bytes = 0;
for (const file of files) {
  const source = path.join(root, file);
  const output = path.join(destination, file);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.copyFileSync(source, output);
  bytes += fs.statSync(source).size;
}
console.log(`${files.length} arquivos, ${(bytes / 1e6).toFixed(2)} MB em ${destination}`);
