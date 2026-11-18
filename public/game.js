import { road, COLORS, GATES, KEYS, courseLength } from './world.js';
import { createScene } from './scene.js';

const $ = (id) => document.getElementById(id);
const menu = $('menu'),
  map = $('map').getContext('2d');
let socket,
  id,
  snapshots = [],
  keys = 0;
const downCodes = new Set(),
  pointers = new Map();
let render;
try {
  render = createScene($('scene'));
} catch {
  $('fault').hidden = false;
  $('fault').textContent =
    'Для трёхмерной поездки нужен WebGL 2. Включи аппаратное ускорение в браузере и обнови страницу.';
}

function network(label, online = false) {
  if ($('network').textContent !== label) $('network').textContent = label;
  $('status-dot').classList.toggle('online', online);
}
function sendKeys() {
  if (socket?.readyState === WebSocket.OPEN) socket.send(String(keys));
}
function updateKeys() {
  keys = 0;
  for (const c of downCodes) keys |= bindings[c];
  for (const k of pointers.values()) keys |= k;
  if (keys) $('prompt').hidden = true;
  sendKeys();
}
function release() {
  downCodes.clear();
  pointers.clear();
  for (const b of document.querySelectorAll('.pressed')) b.classList.remove('pressed');
  updateKeys();
}
function reset() {
  release();
  if (socket?.readyState === WebSocket.OPEN) socket.send('reset');
}
const bindings = {
  KeyW: 1,
  ArrowUp: 1,
  KeyS: 2,
  ArrowDown: 2,
  KeyA: 4,
  ArrowLeft: 4,
  KeyD: 8,
  ArrowRight: 8,
};
function keyboard(e, on) {
  if (menu.open || e.ctrlKey || e.altKey || e.metaKey) return;
  if (e.code === 'KeyR' && on && !e.repeat) {
    reset();
    return;
  }
  if (!bindings[e.code]) return;
  e.preventDefault();
  if (e.repeat) return;
  if (on) downCodes.add(e.code);
  else downCodes.delete(e.code);
  updateKeys();
}
window.addEventListener('keydown', (e) => keyboard(e, true));
window.addEventListener('keyup', (e) => keyboard(e, false));
window.addEventListener('blur', release);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) release();
});
for (const b of document.querySelectorAll('[data-key]')) {
  b.onpointerdown = (e) => {
    b.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, KEYS[b.dataset.key]);
    b.classList.add('pressed');
    updateKeys();
  };
  b.onlostpointercapture = (e) => {
    pointers.delete(e.pointerId);
    b.classList.remove('pressed');
    updateKeys();
  };
}
$('help').onclick = () => {
  release();
  menu.showModal();
};
$('reset').onclick = () => {
  reset();
  menu.close();
};
function connect() {
  network('Подключение…');
  socket = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/drive');
  socket.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'hello') {
      id = msg.id;
      return;
    }
    if (msg.type === 'state') {
      snapshots.push({ ...msg, received: performance.now() });
      if (snapshots.length > 2) snapshots.shift();
      network('В сети · ' + msg.cars.length, true);
    }
  };
  socket.onclose = () => {
    snapshots = [];
    id = null;
    release();
    network('Связь потеряна · повтор…');
    setTimeout(connect, 1800);
  };
}
if (render) connect();
setInterval(() => {
  if (keys) sendKeys();
}, 200);

function mapPoint(x, z) {
  return [174 + x * 0.57, 123 + z * 0.55];
}
function drawMap(cars, me) {
  map.fillStyle = '#232b2d';
  map.fillRect(0, 0, 360, 240);
  map.beginPath();
  road.forEach((p, i) => {
    const [x, y] = mapPoint(p.x * 1.24, p.z * 1.24);
    i ? map.lineTo(x, y) : map.moveTo(x, y);
  });
  map.closePath();
  map.fillStyle = '#3d4540';
  map.fill();
  map.beginPath();
  road.forEach((p, i) => {
    const [x, y] = mapPoint(p.x, p.z);
    i ? map.lineTo(x, y) : map.moveTo(x, y);
  });
  map.closePath();
  map.strokeStyle = '#dad9c9';
  map.lineWidth = 4;
  map.stroke();
  const gate = road[GATES[me?.nextGate ?? 0]],
    [gx, gy] = mapPoint(gate.x, gate.z);
  map.strokeStyle = '#ffad64';
  map.lineWidth = 3;
  map.strokeRect(gx - 5, gy - 5, 10, 10);
  for (const p of cars) {
    const [x, y] = mapPoint(p.x, p.z);
    map.save();
    map.translate(x, y);
    if (p.id === id) {
      map.rotate(-p.yaw);
      map.beginPath();
      map.moveTo(0, 10);
      map.lineTo(-7, -6);
      map.lineTo(0, -3.5);
      map.lineTo(7, -6);
      map.closePath();
      map.fillStyle = '#ff8a42';
      map.strokeStyle = '#222';
      map.lineWidth = 2;
      map.fill();
      map.stroke();
    } else {
      map.beginPath();
      map.arc(0, 0, 5.5, 0, 2 * Math.PI);
      map.fillStyle = '#' + COLORS[p.slot % COLORS.length].toString(16).padStart(6, '0');
      map.fill();
      map.strokeStyle = '#fff';
      map.lineWidth = 2;
      map.stroke();
    }
    map.restore();
  }
}
function timeLabel(ms) {
  const tenths = Math.floor(Math.max(0, ms) / 100);
  return (
    Math.floor(tenths / 600) +
    ':' +
    String(Math.floor(tenths / 10) % 60).padStart(2, '0') +
    '.' +
    (tenths % 10)
  );
}
let last = performance.now();
function frame(now) {
  const next = snapshots.at(-1),
    prev = snapshots[0],
    blend = next && prev !== next ? Math.min(1, (now - next.received) / Math.max(1, next.now - prev.now)) : 1;
  const drivers = (next?.cars ?? []).map((p) => {
    const old = prev.cars.find((d) => d.id === p.id);
    if (!old || Math.hypot(old.x - p.x, old.z - p.z) > 10) return p;
    const da = Math.atan2(Math.sin(p.yaw - old.yaw), Math.cos(p.yaw - old.yaw));
    return {
      ...p,
      x: old.x + (p.x - old.x) * blend,
      z: old.z + (p.z - old.z) * blend,
      yaw: old.yaw + da * blend,
    };
  });
  const me = drivers.find((p) => p.id === id);
  render(drivers, id, Math.min(0.1, (now - last) / 1000));
  last = now;
  drawMap(drivers, me);
  const speed = Math.abs(me?.speed ?? 0) * 3.6;
  $('speed').textContent = String(Math.round(speed)).padStart(3, '0');
  $('fill').style.width = (speed / 176.4) * 100 + '%';
  $('timing').textContent =
    me?.lapStart != null
      ? 'Круг ' +
        (me.laps + 1) +
        ' · ' +
        timeLabel(next.now - me.lapStart) +
        ' · ' +
        (me.nextGate ? 'точка ' + me.nextGate + '/3' : 'финиш')
      : Math.round(courseLength) + ' м · Пересеки линию старта';
  $('best').textContent = 'Лучший круг ' + (me?.best == null ? '—' : timeLabel(me.best));
  requestAnimationFrame(frame);
}
if (render) requestAnimationFrame(frame);
