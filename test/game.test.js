import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { createGameServer } from '../server.js';
import { spawn, advance, nearestRoad, road, KEYS, atRoad } from '../public/world.js';

test('газ, тормоз, задний ход и возврат на асфальт', () => {
  const car = spawn();
  for (let i = 0; i < 33; i++) advance(car, KEYS.gas, 1 / 30, (i * 1000) / 30);
  assert(car.speed > 10);
  const angle = car.yaw;
  advance(car, KEYS.left, 1 / 30, 1200);
  assert(car.yaw > angle);
  for (let i = 0; i < 90; i++) advance(car, KEYS.brake, 1 / 30, 1300 + (i * 1000) / 30);
  assert(car.speed < 0 && car.speed >= -8);
  car.x = 1000;
  advance(car, 0, 1 / 30, 4500);
  assert(car.speed === 0 && nearestRoad(car.x, car.z).distance < 4);
});

test('машина проходит полный круг через три точки в правильном порядке', () => {
  const car = spawn();
  for (let i = 0; i < 9000 && !car.laps; i++) {
    const nearest = nearestRoad(car.x, car.z);
    const goal = atRoad(nearest.index + 2, 2);
    const target = Math.atan2(goal.x - car.x, goal.z - car.z);
    const turn = Math.atan2(Math.sin(target - car.yaw), Math.cos(target - car.yaw));
    const mask =
      (car.speed < 16 ? KEYS.gas : 0) | (turn > 0.035 ? KEYS.left : turn < -0.035 ? KEYS.right : 0);
    advance(car, mask, 1 / 30, (i * 1000) / 30);
  }
  assert.equal(car.laps, 1);
  assert(car.best > 30000 && car.best < 100000);
});

test('финиш в обратном направлении или повторное пересечение старта не завершает круг', () => {
  const gate = road[0],
    dx = Math.sin(gate.yaw),
    dz = Math.cos(gate.yaw);
  const car = { ...spawn(), x: gate.x + dx * 0.1, z: gate.z + dz * 0.1, yaw: gate.yaw, speed: -6 };
  advance(car, 0, 1 / 30, 100);
  assert.equal(car.lapStart, null);
  car.speed = 12;
  advance(car, 0, 1 / 30, 133);
  assert.equal(car.nextGate, 1);
  car.x = gate.x - dx * 0.1;
  car.z = gate.z - dz * 0.1;
  advance(car, 0, 1 / 30, 166);
  assert.equal(car.laps, 0);
  assert.equal(car.best, null);
});

async function startServer(t) {
  const game = createGameServer();
  await new Promise((resolve) => game.server.listen(0, '127.0.0.1', resolve));
  t.after(() => game.close());
  return '127.0.0.1:' + game.server.address().port;
}

function next(ws, match) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', receive);
      reject(Error('Timed out waiting for state'));
    }, 3000);
    function receive(bytes) {
      const message = JSON.parse(bytes);
      if (!match(message)) return;
      clearTimeout(timer);
      ws.off('message', receive);
      resolve(message);
    }
    ws.on('message', receive);
  });
}

test('второй клиент видит движение, сброс и выход первого', async (t) => {
  const host = await startServer(t);
  const a = new WebSocket('ws://' + host + '/drive');
  const { id } = await next(a, (m) => m.type === 'hello');
  const b = new WebSocket('ws://' + host + '/drive');
  const before = await next(b, (m) => m.type === 'state' && m.cars.length === 2);
  const original = before.cars.find((p) => p.id === id);
  a.send(String(KEYS.gas));
  const after = await next(b, (m) => m.type === 'state' && m.cars.some((p) => p.id === id && p.speed > 3));
  const moved = after.cars.find((p) => p.id === id);
  assert(Math.hypot(moved.x - original.x, moved.z - original.z) > 0.4);
  a.send('reset');
  await next(
    b,
    (m) => m.type === 'state' && m.cars.some((p) => p.id === id && p.speed === 0 && p.x === original.x),
  );
  a.close();
  await next(b, (m) => m.type === 'state' && m.cars.length === 1 && m.cars[0].id !== id);
});

test('публичные маршруты и входные сообщения ограничены', async (t) => {
  const host = await startServer(t);
  assert.equal((await fetch('http://' + host + '/')).status, 200);
  assert.equal((await fetch('http://' + host + '/server.js')).status, 404);
  const ws = new WebSocket('ws://' + host + '/drive');
  await next(ws, (m) => m.type === 'hello');
  const closed = new Promise((resolve) => ws.once('close', resolve));
  ws.send('{"x":200}');
  assert.equal(await closed, 1008);
});

test('потерянная команда отпускания педали перестаёт разгонять машину', async (t) => {
  const host = await startServer(t),
    ws = new WebSocket('ws://' + host + '/drive');
  await next(ws, (m) => m.type === 'hello');
  ws.send('1');
  const fast = await next(ws, (m) => m.type === 'state' && m.cars[0].speed > 7);
  await next(
    ws,
    (m) => m.type === 'state' && m.now > fast.now + 1000 && m.cars[0].speed < fast.cars[0].speed,
  );
});

test('16 слотов уникальны, после выхода место снова доступно', async (t) => {
  const host = await startServer(t),
    url = 'ws://' + host + '/drive';
  const clients = [];
  for (let i = 0; i < 16; i++) {
    const ws = new WebSocket(url);
    clients.push(ws);
    await next(ws, (m) => m.type === 'hello');
  }
  const full = await next(clients[0], (m) => m.type === 'state' && m.cars.length === 16);
  assert.equal(new Set(full.cars.map((p) => p.slot)).size, 16);
  const extra = new WebSocket(url);
  const error = await new Promise((resolve) => extra.once('error', resolve));
  assert.match(error.message, /503/);
  clients[1].close();
  await next(clients[0], (m) => m.type === 'state' && m.cars.length === 15);
  const replacement = new WebSocket(url);
  const hello = await next(replacement, (m) => m.type === 'hello');
  const room = await next(replacement, (m) => m.type === 'state' && m.cars.length === 16);
  assert.equal(room.cars.find((p) => p.id === hello.id).slot, 1);
});
