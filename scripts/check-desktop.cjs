// Integration check against the real DOM/CSS and game loop, without dependencies.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { setTimeout: wait } = require('node:timers/promises');
const root = path.resolve(__dirname, '..');
const chrome = process.argv[2];
if (!chrome) throw Error('Uso: node scripts/check-desktop.cjs <chrome.exe>');
const types = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const uri = new URL(req.url, 'http://localhost').pathname;
  const file = path.resolve(root, '.' + (uri === '/' ? '/index.html' : decodeURIComponent(uri)));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return res.writeHead(404).end();
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  if (file === path.join(root, 'src', 'main.js')) {
    // Expose the existing engine only in this test server; ship no debugging API.
    return res.end(fs.readFileSync(file, 'utf8').replace('const movement = createMovement(', 'const movement = window.testMovement = createMovement('));
  }
  const stream = fs.createReadStream(file);
  res.on('close', () => stream.destroy());
  stream.pipe(res);
});

async function scenario() {
  const $ = id => document.getElementById(id);
  const click = id => {
    if (id.startsWith('taskbar-')) {
      const rect = $(id).getBoundingClientRect();
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      if (!hit || !$(id).contains(hit)) throw Error('Barra de tarefas encoberta: ' + id);
    }
    $(id).click();
  };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const check = (condition, message) => { if (!condition) throw Error(message); };
  const visible = id => !!$(id).getClientRects().length && getComputedStyle($(id)).visibility === 'visible';
  const key = value => document.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true }));
  click('enter-game');
  click('open-custom');
  for (const select of document.querySelectorAll('#custom-levels select')) select.value = '0';
  $('custom-form').requestSubmit();
  for (let i = 0; i < 100 && ($('game').hidden || $('game').inert || !$('night-intro').hidden); i++) await sleep(100);
  click('office-monitor');
  click('open-file-explorer');
  check(visible('file-explorer-window'), 'Arquivos não abriu');
  click('file-explorer-minimize');
  check(!visible('file-explorer-window') && $('taskbar-explorer').hasAttribute('data-open'), 'Minimização de arquivos');
  click('open-cameras');
  await sleep(1800);
  check(visible('cameras-view'), 'Câmeras não abriu');
  const mapClick = selector => document.querySelector(selector).dispatchEvent(new MouseEvent('click', { bubbles: true }));
  mapClick('[data-cam="CAM05"]');
  await sleep(400);
  mapClick('[data-gate="G05"]');
  await sleep(30);
  check(!$('camera-static').hidden && $('camera-static').dataset.kind === 'gate', 'Portão sem estática visual');
  await sleep(700);
  check($('camera-static').hidden, 'Estática ultrapassou o prazo');
  click('taskbar-explorer');
  check(visible('file-explorer-window') && visible('cameras-view'), 'Janelas não coexistem');
  check($('game').dataset.mode === 'desktop', 'Câmera em segundo plano continua ativa');
  check(!$('cameras-view').hasAttribute('data-active'), 'Foco duplicado');
  check(Number($('file-explorer-window').style.zIndex) > Number($('cameras-view').style.zIndex), 'Profundidade incorreta');
  const selected = $('cam-number').textContent;
  key('d');
  check($('cam-number').textContent === selected, 'Atalho atravessou arquivos');
  await sleep(100);
  check(!window.testMovement.snapshot().observingCamera, 'Observação de feed encoberto');
  click('taskbar-cameras');
  check($('game').dataset.mode === 'cameras' && visible('file-explorer-window'), 'Restauração de câmeras fechou arquivos');
  check($('camera-launch').hidden, 'Aplicativo foi reiniciado');
  click('taskbar-cameras');
  check(!visible('cameras-view') && $('taskbar-cameras').hasAttribute('data-open'), 'Barra não minimiza câmeras');
  click('taskbar-cameras');
  check($('cam-number').textContent === selected, 'Câmera selecionada perdida');
  click('taskbar-notes');
  $('personal-notes-input').value = 'q wasd';
  $('personal-notes-input').dispatchEvent(new KeyboardEvent('keydown', { key: 'q', bubbles: true }));
  check(visible('computer-desktop'), 'Digitar Q fechou monitor');
  click('taskbar-cameras');
  click('taskbar-notes');
  check($('personal-notes-input').value === 'q wasd', 'Texto perdido ao restaurar notas');
  click('monitor-exit');
  click('office-monitor');
  check(visible('notes-editor-window') && $('personal-notes-input').value === 'q wasd', 'Sair do monitor encerrou aplicativos');
  click('notes-editor-close');
  check(!$('taskbar-notes').hasAttribute('data-open'), 'Fechar deixou indicador');
  click('taskbar-cameras');
  click('desktop-power');
  check(!visible('taskbar-cameras') && !visible('file-explorer-window'), 'Sistema visível durante desligamento');
  check($('computer-screen').inert, 'Sistema interativo desligado');
  check(!$('taskbar-explorer').hasAttribute('data-open'), 'Desligamento não encerrou arquivos');
  await sleep(2200);
  check(!visible('open-start'), 'Barra visível desligado');
  click('desktop-power');
  await sleep(6800);
  check(visible('open-start') && !visible('cameras-view') && !visible('file-explorer-window'), 'Boot não voltou à área de trabalho');
  check(!$('computer-screen').inert, 'Boot manteve bloqueio');
  check($('personal-notes-input').value === '', 'Desligamento não limpou estado');
  click('open-file-explorer');
  const frame = window.testMovement.snapshot();
  const rules = { ...await (await fetch('/config/night.json')).json(), movementDelay: 0, hoursToWin: 10000 };
  window.testMovement.reset({}, {}, rules);
  window.testMovement.advance(frame.now + 20000, { computer: true });
  await sleep(100);
  check($('game').hasAttribute('data-blackout'), 'Apagão não foi integrado');
  check(!visible('open-start') && !visible('file-explorer-window') && $('computer-screen').inert, 'Apagão deixou sistema visível ou interativo');
  return 'Arquivos, câmeras e notas; sobreposição, atalhos, barra acessível, estática, saída do monitor, desligamento, boot e apagão verificados.';
}

async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nnn-desktop-'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const child = spawn(chrome, ['--headless=new', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', '--user-data-dir=' + profile, '--window-size=1280,800', 'about:blank'],
  { stdio: 'ignore', windowsHide: true });
  let socket;
  try {
    const portFile = path.join(profile, 'DevToolsActivePort');
    for (let i = 0; i < 100 && !fs.existsSync(portFile); i++) await wait(100);
    const port = fs.readFileSync(portFile, 'utf8').split('\n')[0];
    const target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page');
    socket = new WebSocket(target.webSocketDebuggerUrl);
    const pending = new Map(), errors = [];
    let sequence = 0;
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
      if (pending.has(message.id)) {
        const { resolve, reject } = pending.get(message.id);
        pending.delete(message.id);
        message.error ? reject(Error(message.error.message)) : resolve(message.result);
      }
    });
    await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
    const call = (method, params) => new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(Error('Timeout: ' + method)); }, 30000);
      pending.set(id, { resolve: result => { clearTimeout(timer); resolve(result); }, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = expression => call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    await call('Runtime.enable');
    await call('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/?debug=1` });
    for (let i = 0; i < 100; i++) {
      if ((await evaluate("document.getElementById('enter-game')?.disabled === false")).result.value) break;
      await wait(100);
    }
    const result = await evaluate('(' + scenario + ')()');
    if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
    if (errors.length) throw Error(JSON.stringify(errors));
    console.log(result.result.value);
  } finally {
    socket?.close();
    child.kill();
    server.closeAllConnections();
    server.close();
    for (let i = 0; i < 10; i++) {
      try { fs.rmSync(profile, { recursive: true, force: true }); break; } catch { await wait(200); }
    }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
