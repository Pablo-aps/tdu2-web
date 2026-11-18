export const ROAD_WIDTH = 12;
export const COLORS = [0xe44132, 0x2997be, 0xf2b632, 0x5bb589, 0xa087cb, 0xeb8048, 0xe1d3bf, 0x5464ab];
const TAU = 2 * Math.PI;
const COUNT = 240;

function center(t) {
  const a = t * TAU;
  const r = 1 + 0.14 * Math.sin(3 * a + 0.4) + 0.08 * Math.sin(5 * a);
  return { x: 120 * r * Math.cos(a), z: -163 * r * Math.sin(a) };
}

export const road = Array.from({ length: COUNT }, (_, i) => {
  const p = center(i / COUNT);
  const before = center((i - 0.01) / COUNT);
  const after = center((i + 0.01) / COUNT);
  const yaw = Math.atan2(after.x - before.x, after.z - before.z);
  return { ...p, yaw };
});

export function atRoad(index, side = 0) {
  const p = road[((index % COUNT) + COUNT) % COUNT];
  return { x: p.x - Math.cos(p.yaw) * side, z: p.z + Math.sin(p.yaw) * side, yaw: p.yaw };
}

export const courseLength = road.reduce((sum, p, i) => {
  const next = atRoad(i + 1);
  return sum + Math.hypot(p.x - next.x, p.z - next.z);
}, 0);

export function nearestRoad(x, z) {
  let index = 0,
    distance2 = Infinity;
  for (let i = 0; i < COUNT; i++) {
    const p = road[i];
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < distance2) {
      distance2 = d;
      index = i;
    }
  }
  return { index, distance: Math.sqrt(distance2) };
}

export const KEYS = { gas: 1, brake: 2, left: 4, right: 8 };
export const GATES = [0, 60, 120, 180];

export function spawn(slot = 0) {
  const p = atRoad(-3 - 2 * Math.floor(slot / 2), slot % 2 ? -2.6 : 2.6);
  return { ...p, speed: 0, nextGate: 0, lapStart: null, best: null, laps: 0 };
}

export function advance(car, input, dt, now) {
  const near = nearestRoad(car.x, car.z);
  const offRoad = near.distance > ROAD_WIDTH / 2 + 1;
  const gas = !!(input & KEYS.gas),
    brake = !!(input & KEYS.brake);
  const speedLimit = offRoad ? 10 : 49;
  let v = car.speed;
  if (gas && !brake) v += (v < 0 ? 18 : 11 * Math.max(0, 1 - (v / speedLimit) ** 2)) * dt;
  else if (brake && !gas) v -= (v > 0 ? 22 : 5) * dt;
  const drag = (gas || brake ? 0.2 : 2.8) + (offRoad && v > speedLimit ? 14 : 0);
  v = Math.sign(v) * Math.max(0, Math.abs(v) - drag * dt);
  car.speed = Math.max(-8, Math.min(49, v));
  const steer = Number(!!(input & KEYS.left)) - Number(!!(input & KEYS.right));
  car.yaw += steer * Math.sign(v) * Math.min(Math.abs(v) / 6, 1) * (1.65 - 0.016 * Math.abs(v)) * dt;
  const oldX = car.x,
    oldZ = car.z;
  car.x += Math.sin(car.yaw) * car.speed * dt;
  car.z += Math.cos(car.yaw) * car.speed * dt;
  if (near.distance > 13) {
    const p = atRoad(near.index, 2.6);
    Object.assign(car, p, { speed: 0, lapStart: null, nextGate: 0 });
    return;
  }
  const gate = road[GATES[car.nextGate]];
  const dx = Math.sin(gate.yaw),
    dz = Math.cos(gate.yaw);
  const before = (oldX - gate.x) * dx + (oldZ - gate.z) * dz;
  const after = (car.x - gate.x) * dx + (car.z - gate.z) * dz;
  const across = Math.abs((car.x - gate.x) * dz - (car.z - gate.z) * dx);
  if (before < 0 && after >= 0 && across <= ROAD_WIDTH / 2 + 0.5) {
    if (car.nextGate === 0) {
      if (car.lapStart !== null) {
        car.best = Math.min(car.best ?? Infinity, now - car.lapStart);
        car.laps++;
      }
      car.lapStart = now;
    }
    car.nextGate = (car.nextGate + 1) % GATES.length;
  }
}
