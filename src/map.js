(() => {
'use strict';
const { CAMERAS, OFFICE, VENUE } = window.NathGame;

const SVG_NS = 'http://www.w3.org/2000/svg';
const SCALE = 10.5;
const PAD_X = 18;
const PAD_Y = 18;
const X = value => PAD_X + value * SCALE;
const Y = value => PAD_Y + (VENUE.height - value) * SCALE;
// O teclado segue as fileiras do minimapa, sem pular câmeras próximas.
const directions = { w: [-1, 0], s: [1, 0], a: [0, -1], d: [0, 1] };
const cameraGrid = [
  ['CAM10', 'CAM11', 'CAM12'],
  ['CAM09', 'CAM05', 'CAM03'],
  ['CAM08', 'CAM06', 'CAM04'],
  ['CAM01', 'CAM02', 'CAM07'],
];
// Pinos são pontos de seleção no mapa, não a localização física das lentes.
const cameraPinPositions = {
  CAM01: [4.6, 2.8],
  CAM02: [17.0, 2.4],
  CAM03: [19.5, 19.9],
  CAM04: [19.5, 10.1],
  CAM05: [9.5, 19.2],
  CAM06: [9.5, 12.8],
  CAM07: [30.0, 5.6],
  CAM08: [2.2, 12.9],
  CAM09: [2.2, 19.1],
  CAM10: [5.2, 26.1],
  CAM11: [14.5, 26.2],
  CAM12: [31.2, 23.5],
};

function makeSvg(tag, attrs = {}, content = null) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, String(value));
  if (content !== null) element.textContent = content;
  return element;
}

function bindMapButton(node, activate) {
  node.addEventListener('click', activate);
  node.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (!event.repeat) activate();
  });
}

function setGateClosed(gate, closed) {
  gate.classList.toggle('closed', closed);
  gate.setAttribute('aria-pressed', String(closed));
}

function makeCameraMap({ canvas, onSelect, onToggleGate }) {
  const svg = makeSvg('svg', {
    viewBox: '0 0 380 332',
    role: 'group',
    'aria-label': 'Planta do restaurante: 12 câmeras e portões interativos',
  });

  const polygons = new Map();
  for (const room of VENUE.rooms) {
    const points = room.points.map(([x,y]) => `${X(x)},${Y(y)}`).join(' ');
    const polygon = makeSvg('polygon',{points,class:'map-room','data-room':room.id});
    svg.append(polygon);
    polygons.set(room.id,polygon);
  }

  for (const obj of VENUE.objects) {
    if (obj.id !== 'PALCO') continue;
    const [x0,y0,x1,y1] = obj.bounds;
    svg.append(makeSvg('rect',{x:X(x0),y:Y(y1),width:(x1-x0)*SCALE,height:(y1-y0)*SCALE,class:'map-stage'}));
  }

  const gateLayer = makeSvg('g', { role: 'group', 'aria-label': 'Portões' });
  const gateNodes = new Map();
  for (const {id,axis,at,start,end,type} of VENUE.openings) {
    const horizontal = axis === 'H';
    const coords = {
      x1: X(horizontal ? start : at),
      y1: Y(horizontal ? at : start),
      x2: X(horizontal ? end : at),
      y2: Y(horizontal ? at : end),
    };
    if (type === 'portao' && id !== OFFICE.gate) {
      const label = `Portão ${id}`;
      const gate = makeSvg('g', {
        class: 'map-gate', 'data-gate': id, tabindex: '0', role: 'button',
        'aria-label': label, 'aria-pressed': 'false',
      });
      gate.append(makeSvg('title', {}, label));
      gate.append(makeSvg('line', {...coords, class: 'gate-hit-area'}));
      bindMapButton(gate, () => { if (gate.getAttribute('aria-disabled') !== 'true') onToggleGate(id); });
      gate.append(makeSvg('line', {...coords, class: 'gate-line'}));
      gateNodes.set(id, gate);
      gateLayer.append(gate);
      continue;
    }
    svg.append(makeSvg('line', {
      ...coords,
      class:`map-opening ${type==='saida'?'exit':'passage'}`,
      'stroke-dasharray': type==='livre'?'3 2':'none',
    }));
  }

  const cameraNodes = new Map();
  for (const cam of CAMERAS) {
    const [pinX, pinY] = cameraPinPositions[cam.id] ?? [cam.x, cam.y];
    const px = X(pinX), py = Y(pinY);
    const g = makeSvg('g', {
      class:`map-camera ${cam.renderAvailable?'has-render':'no-render'}`,
      'data-cam':cam.id,
      tabindex:'0',
      role:'button',
      'aria-label':`${cam.id}${cam.renderAvailable?'':' (somente planta técnica)'}`,
    });
    const length = 20;
    const rads = cam.angle * Math.PI / 180;
    g.append(makeSvg('path',{
      d:`M ${px} ${py} L ${px+Math.sin(rads)*length} ${py-Math.cos(rads)*length}`,
      stroke:'#a8e5f1','stroke-width':'1.6','stroke-dasharray':'2 3',fill:'none',opacity:'.6',
    }));
    g.append(makeSvg('circle',{cx:px,cy:py,r:21.5,class:'pin-area'}));
    g.append(makeSvg('circle',{cx:px,cy:py,r:17.5,class:'pin-halo'}));
    const wave = makeSvg('circle', { cx: px, cy: py, r: 15.7, class: 'pin-audio-wave' });
    const echo = makeSvg('circle', { cx: px, cy: py, r: 15.7, class: 'pin-audio-wave pin-audio-echo' });
    echo.addEventListener('animationend', () => g.classList.remove('audio-pulse'));
    g.append(wave, echo);
    g.append(makeSvg('circle',{cx:px,cy:py,r:15.2,class:'pin-body'}));
    g.append(makeSvg('text',{x:px,y:py+4,class:'pin-number'},String(cam.number).padStart(2,'0')));
    bindMapButton(g, () => onSelect(cam.id));
    const tip = makeSvg('title',{},cam.id);
    g.append(tip);
    svg.append(g);
    cameraNodes.set(cam.id,g);
  }

  // The gate targets sit above camera halos where their coordinates are close.
  svg.append(gateLayer);
  canvas.append(svg);
  let activeCamera;
  return {
    moveSelection(key) {
      const direction = directions[key];
      if (!direction || !activeCamera) return;
      const row = cameraGrid.findIndex(cameras => cameras.includes(activeCamera.id));
      if (row < 0) return;
      const column = cameraGrid[row].indexOf(activeCamera.id);
      const [dr, dc] = direction;
      const next = cameraGrid[row + dr]?.[column + dc];
      if (next) onSelect(next);
    },
    pulseAudio(id) { cameraNodes.get(id)?.classList.add('audio-pulse'); },
    clearAudioPulses() {
      for (const node of cameraNodes.values()) node.classList.remove('audio-pulse');
    },
    setGate(id, closed) {
      const gate = gateNodes.get(id);
      if (gate) setGateClosed(gate, closed);
    },
    setGateControls(enabled) {
      for (const gate of gateNodes.values()) {
        gate.setAttribute('aria-disabled', String(!enabled));
        gate.setAttribute('tabindex', enabled ? '0' : '-1');
      }
    },
    setActive(camera) {
      if (activeCamera === camera) return;
      activeCamera = camera;
      for (const [id,node] of cameraNodes) {
        node.classList.toggle('active',id===camera.id);
        node.setAttribute('aria-pressed',String(id===camera.id));
      }
      for (const [id,polygon] of polygons) polygon.classList.toggle('highlight',id===camera.room);
    },
  };
}

window.NathGame.makeCameraMap = makeCameraMap;

})();
