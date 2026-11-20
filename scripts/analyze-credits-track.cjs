// Analisa a duração e os ataques rítmicos do MP3 dos créditos, para afinar as marcas de montagem.
// Utilitário de desenvolvimento: não faz parte do bundle e não precisa de dependências npm.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const source = path.join(__dirname, '../public/audio/ending/creditos.mp3');
const probe = spawnSync('ffprobe', ['-v','error','-show_entries','format=duration',
  '-of','default=noprint_wrappers=1:nokey=1',source],{encoding:'utf8'});
if (probe.error || probe.status !== 0) {
  console.log('ffprobe indisponível; análise musical opcional ignorada.');
  process.exit(0);
}
const duration = Number.parseFloat(probe.stdout);
console.log('TRILHA DOS CRÉDITOS: duração =', duration.toFixed(3), 'segundos');
const decode = spawnSync('ffmpeg',['-v','error','-i',source,'-ac','1','-ar','8000',
  '-f','s16le','pipe:1'],{encoding:null,maxBuffer:12*1024*1024});
if (decode.error || decode.status !== 0) {
  console.log('ffmpeg indisponível; análise de pulso opcional ignorada.');
  process.exit(0);
}
const raw = decode.stdout;
const rate = 8000, step = 800;
const bins = [];
for (let i = 0; i + step * 2 <= raw.length; i += step * 2) {
  let sum = 0;
  for (let j = i; j < i + step * 2; j += 2) {
    const s = raw.readInt16LE(j) / 32768;
    sum += s * s;
  }
  bins.push(Math.sqrt(sum / step));
}
const cues = [9,17,25,33,41,49,57,65,73,81,89,97,105,113,121,129,
  137,145,153,161,169,177,185];
for (const cue of cues) {
  const center = Math.round(cue * 10);
  let best = -1, bestVal = -1;
  for (let i = Math.max(4,center-12); i <= Math.min(bins.length-4,center+12); i++) {
    const prev = (bins[i-2]+bins[i-1]) / 2;
    const onset = Math.max(0,bins[i]-prev);
    const distancePenalty = .0008 * Math.abs(i-center);
    const score = onset-distancePenalty;
    if (score > bestVal) { bestVal=score;best=i; }
  }
  console.log('PULSO PRÓXIMO DE',cue+'s:',(best/10).toFixed(1)+'s');
}
