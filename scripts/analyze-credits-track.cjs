// Analisa o MP3 dos créditos sem bibliotecas externas para calibrar o storyboard.
// Útil no GitHub Actions (runners que não possuem ffmpeg ou ffprobe).
const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname, '../public/audio/ending/creditos.mp3');
const mp3 = fs.readFileSync(file);
let pos = 0;
if (mp3.subarray(0,3).toString() === 'ID3') {
  const id3Size = (mp3[6] << 21) | (mp3[7] << 14) | (mp3[8] << 7) | mp3[9];
  const end = Math.min(mp3.length, 10 + id3Size);
  const version = mp3[3];
  let off = 10;
  const textTags = [];
  while (off + 10 <= end && version >= 3 && version <= 4) {
    const id = mp3.subarray(off, off + 4).toString('ascii');
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    let size = mp3.readUInt32BE(off + 4);
    if (version === 4) size = ((mp3[off+4]&127)<<21)|((mp3[off+5]&127)<<14)|((mp3[off+6]&127)<<7)|(mp3[off+7]&127);
    if (!size || size > end-off-10) break;
    if (['TIT2','TPE1','TALB','TDRC','TYER'].includes(id)) {
      const encoding = mp3[off+10];
      const chunk = mp3.subarray(off+11,off+10+size);
      const value = (encoding === 3 ? chunk.toString('utf8')
        : encoding === 0 ? chunk.toString('latin1') : '').replace(/\0+/g,' ').trim();
      if (value) textTags.push(id+'='+value.slice(0,120));
    }
    off += 10 + size;
  }
  if (textTags.length) console.log('METADADOS ID3:',textTags.join(' | '));
  pos = end + ((mp3[5] & 0x10) ? 10 : 0);
}
let frames=0,seconds=0,firstBitrate=null,firstSampleRate=null,bitrateChanges=0,prevBitrate=null;
const v1Rates=[0,32,40,48,56,64,80,96,112,128,160,192,224,256,320,0];
const v2Rates=[0,8,16,24,32,40,48,56,64,80,96,112,128,144,160,0];
while(pos+4<mp3.length){
  const b1=mp3[pos+1],b2=mp3[pos+2];
  if(mp3[pos]!==0xff || (b1&0xe0)!==0xe0){pos++;continue}
  const ver=(b1>>3)&3,layer=(b1>>1)&3,bitrateIdx=(b2>>4)&15,srIdx=(b2>>2)&3;
  if(ver===1 || layer!==1 || srIdx===3 || bitrateIdx===0 || bitrateIdx===15){pos++;continue}
  const sr=[44100,48000,32000][srIdx]/(ver===3?1:ver===2?2:4);
  const kbps=(ver===3?v1Rates:v2Rates)[bitrateIdx];
  const size=Math.floor((ver===3?144000:72000)*kbps/sr)+((b2>>1)&1);
  if (size<24 || pos+size>mp3.length) {pos++;continue}
  // Reduz falsos positivos: o cabeçalho do próximo frame costuma iniciar no próximo deslocamento.
  const next=pos+size;
  if(next+4<mp3.length && (mp3[next]!==0xff || (mp3[next+1]&0xe0)!==0xe0)){
    if(frames===0){pos++;continue}
    // Tenta recuperar posição entre um frame defeituoso ou tag no fim.
  }
  seconds+=(ver===3?1152:576)/sr;
  if(firstBitrate===null)firstBitrate=kbps;
  if(firstSampleRate===null)firstSampleRate=sr;
  if(prevBitrate!==null&&prevBitrate!==kbps)bitrateChanges++;
  prevBitrate=kbps;
  frames++;
  pos+=size;
}
if(frames<200)throw new Error('Não foram encontrados frames MPEG suficientes na trilha');
console.log('TRILHA DOS CRÉDITOS: duração MPEG =',seconds.toFixed(3),'segundos',
  '| frames =',frames,'| sample rate =',firstSampleRate,
  '| bitrate inicial =',firstBitrate,'kbps','| mudanças VBR =',bitrateChanges);
console.log('ÚLTIMOS 7s SEM TEXTO: de', Math.max(0,seconds-7).toFixed(3),
  'até',seconds.toFixed(3),'segundos');
