import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { advance, spawn } from './public/world.js';

const assets = new Map();
for (const name of [
  'index.html',
  'style.css',
  'game.js',
  'world.js',
  'scene.js',
  'compat.html',
  'compat.js',
  'inspect.js',
]) {
  assets.set('/' + name, new URL('./public/' + name, import.meta.url));
}
assets.set('/', assets.get('/index.html'));
for (const name of ['three.module.js', 'three.core.js']) {
  assets.set('/vendor/' + name, new URL('./node_modules/three/build/' + name, import.meta.url));
}

export function createGameServer() {
  const server = createServer(async (req, res) => {
    const path = req.url.split('?')[0];
    const file = assets.get(path);
    if (!file || !['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(file ? 405 : 404).end();
      return;
    }
    try {
      const mime = file.pathname.endsWith('.js')
        ? 'text/javascript'
        : file.pathname.endsWith('.css')
          ? 'text/css'
          : 'text/html';
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': mime + '; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
      res.writeHead(500).end('Game file unavailable');
    }
  });
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 128, perMessageDeflate: false });
  const players = new Map();
  server.on('upgrade', (req, socket, head) => {
    let allowedOrigin = !req.headers.origin;
    try {
      if (req.headers.origin) allowedOrigin = new URL(req.headers.origin).host === req.headers.host;
    } catch {
      /* Invalid origins are rejected below. */
    }
    if (req.url !== '/drive' || !allowedOrigin || players.size >= 16) {
      const status = players.size >= 16 ? '503 Service Unavailable' : '403 Forbidden';
      socket.end('HTTP/1.1 ' + status + '\r\nConnection: close\r\n\r\n');
      return;
    }
    sockets.handleUpgrade(req, socket, head, (ws) => sockets.emit('connection', ws));
  });
  sockets.on('connection', (ws) => {
    const occupied = new Set([...players.values()].map((p) => p.slot));
    let slot = 0;
    while (occupied.has(slot)) slot++;
    const p = {
      id: randomUUID(),
      slot,
      car: spawn(slot),
      input: 0,
      last: 0,
      window: 0,
      messages: 0,
      alive: true,
    };
    players.set(ws, p);
    ws.send(JSON.stringify({ type: 'hello', id: p.id }));
    ws.on('error', () => ws.terminate());
    ws.on('pong', () => {
      p.alive = true;
    });
    ws.on('close', () => players.delete(ws));
    ws.on('message', (bytes, binary) => {
      const now = performance.now();
      if (now - p.window >= 1000) {
        p.window = now;
        p.messages = 0;
      }
      if (++p.messages > 80) return ws.close(1008, 'Input rate exceeded');
      const text = bytes.toString();
      if (binary || !/^(?:[0-9]|1[0-5]|reset)$/.test(text)) return ws.close(1008, 'Unknown input');
      if (text === 'reset') {
        p.car = { ...spawn(slot), best: p.car.best, laps: p.car.laps };
        p.input = 0;
      } else {
        p.input = Number(text);
      }
      p.last = now;
    });
  });
  const stepMs = 1000 / 30;
  let simulated = performance.now(),
    broadcastAt = simulated,
    pingAt = simulated + 15000;
  const timer = setInterval(() => {
    const now = performance.now();
    simulated = Math.max(simulated, now - 6 * stepMs);
    while (simulated + stepMs <= now) {
      simulated += stepMs;
      for (const p of players.values())
        advance(p.car, simulated - p.last <= 800 ? p.input : 0, 1 / 30, simulated);
    }
    if (now < broadcastAt || !players.size) return;
    broadcastAt = Math.max(broadcastAt + 2 * stepMs, now);
    const ping = now >= pingAt;
    if (ping) pingAt = now + 15000;
    const state = JSON.stringify({
      type: 'state',
      now,
      cars: [...players.values()].map((p) => ({ ...p.car, id: p.id, slot: p.slot })),
    });
    for (const [ws, p] of players) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      if (ws.bufferedAmount > 64 * 1024 || (ping && !p.alive)) {
        ws.terminate();
        continue;
      }
      if (ping) {
        p.alive = false;
        ws.ping();
      }
      ws.send(state);
    }
  }, stepMs);
  return {
    server,
    close() {
      clearInterval(timer);
      for (const ws of sockets.clients) ws.terminate();
      sockets.close();
      return new Promise((resolve) => server.close(resolve));
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { server } = createGameServer();
  const port = Number(process.env.PORT || 8080);
  server.listen(port, process.env.HOST || '0.0.0.0', () =>
    console.log('TDU2 Web • http://localhost:' + server.address().port),
  );
}
