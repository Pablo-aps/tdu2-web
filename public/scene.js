import * as T from '/vendor/three.module.js';
import { atRoad, road, ROAD_WIDTH, COLORS, GATES } from './world.js';

const asphaltY = 3;
const up = new T.Vector3(0, 1, 0);
const box = new T.BoxGeometry(1, 1, 1),
  stone = new T.IcosahedronGeometry(1, 0);
const pine = new T.IcosahedronGeometry(1, 1),
  trunk = new T.CylinderGeometry(0.8, 1, 1, 6);
const cypress = new T.ConeGeometry(1, 1, 7);
const wheel = new T.CylinderGeometry(1, 1, 1, 12).rotateZ(Math.PI / 2);
let seed = 237;
function rand() {
  seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
  return seed / 4294967296;
}
const matte = (color) => new T.MeshStandardMaterial({ color, roughness: 0.88, flatShading: true });
const dark = matte(0x24262b),
  glass = matte(0x34404a),
  trim = matte(0x4e5054);
const tail = new T.MeshBasicMaterial({ color: 0xff3931 }),
  headlight = new T.MeshBasicMaterial({ color: 0xffe4a9 });

function solid(parent, geometry, material, x, y, z, w, h, d) {
  const obj = new T.Mesh(geometry, material);
  obj.position.set(x, y, z);
  obj.scale.set(w, h, d);
  parent.add(obj);
  return obj;
}

// Cross sections run from rear to nose. The same silhouette is used by every driver.
function shell(sections) {
  const v = [],
    indices = [];
  for (const [z, bottom, top, lowWidth, topWidth] of sections)
    v.push(-lowWidth, bottom, z, lowWidth, bottom, z, topWidth, top, z, -topWidth, top, z);
  for (let n = 0; n < sections.length - 1; n++) {
    for (let j = 0; j < 4; j++) {
      const a = n * 4 + j,
        b = n * 4 + ((j + 1) % 4);
      indices.push(a, b, b + 4, a, b + 4, a + 4);
    }
  }
  const end = 4 * (sections.length - 1);
  indices.push(0, 3, 2, 0, 2, 1, end, end + 1, end + 2, end, end + 2, end + 3);
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(v, 3));
  g.setIndex(indices);
  // The contour is wound in the local XY plane.
  g.computeVertexNormals();
  return g.toNonIndexed();
}
const bodyMesh = shell([
  [-2.26, 0.39, 0.92, 0.98, 1.05],
  [-1.55, 0.35, 1.07, 1.04, 1.06],
  [0.9, 0.35, 0.96, 1.03, 1.01],
  [2.18, 0.42, 0.7, 0.91, 0.94],
]);
const cabinMesh = shell([
  [-1.31, 1.01, 1.04, 0.91, 0.9],
  [-0.55, 1.01, 1.54, 0.91, 0.74],
  [0.4, 0.96, 1.53, 0.88, 0.72],
  [1.19, 0.93, 0.96, 0.88, 0.85],
]);
const roofMesh = shell([
  [-0.59, 1.5, 1.55, 0.75, 0.73],
  [0.38, 1.5, 1.55, 0.74, 0.71],
]);
const paints = COLORS.map(matte);
const shadeCanvas = document.createElement('canvas');
shadeCanvas.width = shadeCanvas.height = 64;
const ink = shadeCanvas.getContext('2d'),
  fade = ink.createRadialGradient(32, 32, 10, 32, 32, 32);
fade.addColorStop(0, 'rgba(25,20,24,.74)');
fade.addColorStop(1, 'rgba(25,20,24,0)');
ink.fillStyle = fade;
ink.fillRect(0, 0, 64, 64);
const shadowMaterial = new T.MeshBasicMaterial({
  map: new T.CanvasTexture(shadeCanvas),
  transparent: true,
  depthWrite: false,
});
const shadowShape = new T.PlaneGeometry(3.4, 5.8).rotateX(-Math.PI / 2);
function coupe(slot) {
  const car = new T.Group(),
    paint = paints[slot % paints.length];
  car.add(new T.Mesh(bodyMesh, paint), new T.Mesh(cabinMesh, glass), new T.Mesh(roofMesh, paint));
  solid(car, box, dark, 0, 0.69, -2.275, 1.96, 0.29, 0.055);
  solid(car, box, trim, 0, 0.43, -2.28, 2.03, 0.12, 0.12);
  solid(car, box, mattePlate, 0, 0.68, -2.316, 0.46, 0.13, 0.025);
  solid(car, box, paint, 0, 1.0, -2.18, 2.13, 0.07, 0.22);
  solid(car, box, dark, 0, 0.32, -1.8, 1.68, 0.2, 0.75);
  solid(car, wheel, trim, -0.53, 0.29, -2.16, 0.22, 0.075, 0.075).rotation.y = Math.PI / 2;
  for (let i = 1; i <= 5; i++) {
    const t = i / 7;
    solid(car, box, trim, 0, 1.053 + 0.5 * t, -1.31 + 0.76 * t, 1.72 - 0.29 * t, 0.011, 0.016);
  }
  for (const side of [-1, 1]) {
    solid(car, box, tail, side * 0.72, 0.74, -2.313, 0.42, 0.15, 0.035);
    solid(car, box, dark, side * 0.74, 0.74, -2.336, 0.018, 0.15, 0.012);
    solid(car, box, dark, side * 0.72, 0.745, -2.336, 0.42, 0.012, 0.012);
    solid(car, box, headlight, side * 0.67, 0.64, 2.18, 0.39, 0.1, 0.04);
    solid(car, box, paint, side * 1.03, 1.09, 0.46, 0.22, 0.14, 0.23);
    for (const z of [-1.46, 1.35]) {
      solid(car, wheel, dark, side * 0.98, 0.4, z, 0.25, 0.4, 0.4);
      solid(car, wheel, trim, side * 1.113, 0.4, z, 0.025, 0.24, 0.24);
    }
  }
  const shadow = new T.Mesh(shadowShape, shadowMaterial);
  shadow.position.y = 0.006;
  car.add(shadow);
  return car;
}
const mattePlate = matte(0xebdfbd);

export function createScene(canvas) {
  const renderer = new T.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera(58, 1, 0.2, 1800);
  scene.fog = new T.FogExp2(0xd5adab, 0.0021);
  scene.add(new T.HemisphereLight(0xffe8cb, 0xb5a2a8, 1.75));
  const sunlight = new T.DirectionalLight(0xffdec3, 2.2);
  sunlight.position.set(110, 95, -160);
  scene.add(sunlight);
  const sky = new T.Mesh(
    new T.SphereGeometry(1300, 48, 24),
    new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      vertexShader:
        'varying vec3 dir; void main(){dir=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `varying vec3 dir; void main(){
      vec3 d=normalize(dir), sun=normalize(vec3(.58,.115,-.81));
      float h=max(d.y,0.), s=max(dot(sun,d),0.);
      vec3 col=mix(vec3(.99,.67,.43),vec3(.68,.47,.60),smoothstep(0.,.35,h));
      col=mix(col,vec3(.27,.46,.63),smoothstep(.27,.88,h));
      col+=vec3(.22,.12,.046)*pow(s,20.);
      col=mix(col,vec3(1.,.95,.69),smoothstep(.99945,.99972,s));
      gl_FragColor=vec4(col,1.);}`,
    }),
  );
  scene.add(sky);

  const batches = new Map(),
    dummy = new T.Object3D();
  function piece(g, color, x, y, z, w, h, d, ry = 0, rz = 0) {
    if (!batches.has(g)) batches.set(g, []);
    dummy.position.set(x, y, z);
    dummy.scale.set(w, h, d);
    dummy.rotation.set(0, ry, rz);
    dummy.updateMatrix();
    batches.get(g).push([dummy.matrix.clone(), new T.Color(color)]);
  }
  // Terrain, shoulder markings and asphalt share one vertex-coloured mesh.
  const coords = [],
    colors = [],
    uv = [];
  function triangle(a, b, c, hex, shade = 1) {
    const color = new T.Color(hex).multiplyScalar(shade);
    for (const p of [a, b, c]) {
      coords.push(p.x, p.y, p.z);
      colors.push(color.r, color.g, color.b);
      uv.push(p.x / 5, p.z / 5);
    }
  }
  function strip(left, right, hex, variation = 0, skip = 0) {
    for (let i = 0; i < road.length; i++) {
      if (skip && i % skip) continue;
      const j = (i + 1) % road.length,
        a = left[i],
        b = left[j],
        c = right[j],
        d = right[i];
      triangle(a, d, b, hex, 1 - rand() * variation);
      triangle(b, d, c, hex, 1 - rand() * variation);
    }
  }
  const ring = (side, y) => road.map((_, i) => ({ ...atRoad(i, side), y }));
  const inner = ring(-6.6, asphaltY - 0.04),
    outer = ring(6.6, asphaltY - 0.04);
  const landRing = (scale, height, noise) =>
    road.map((p, i) => ({
      x: p.x * scale,
      z: p.z * scale,
      y: height + noise * (0.5 + 0.33 * Math.sin(i * 0.081 + 1) + 0.13 * Math.cos(i * 0.17) + 0.04 * rand()),
    }));
  strip(inner, outer, 0xceaf87);
  strip(ring(-ROAD_WIDTH / 2, asphaltY), ring(ROAD_WIDTH / 2, asphaltY), 0x454148, 0.018);
  for (const side of [-1, 1]) strip(ring(side * 5.61, 3.015), ring(side * 5.72, 3.015), 0xf7e2c8);
  strip(ring(-0.072, 3.02), ring(0.072, 3.02), 0xf5dfbf, 0, 3);
  const verge = ring(-13, 2.98),
    lip = ring(13, 2.98),
    high = landRing(0.73, 5, 12);
  strip(verge, inner, 0xa59263, 0.17);
  strip(outer, lip, 0xb69f70, 0.14);
  strip(high, verge, 0xaa805c, 0.2);
  const ridge = landRing(0.48, 24, 33),
    middle = landRing(0.18, 32, 12);
  strip(ridge, high, 0x8d8258, 0.25);
  strip(middle, ridge, 0x92865e, 0.28);
  strip(landRing(0, 38, 0), middle, 0x90855c, 0.14);
  const edge = landRing(1.22, -0.5, 1.2);
  strip(lip, edge, 0xb68f67, 0.22);
  strip(edge, landRing(1.29, -1.8, 0.3), 0xd0b079, 0.14);
  const terrain = new T.BufferGeometry();
  terrain.setAttribute('position', new T.Float32BufferAttribute(coords, 3));
  terrain.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  terrain.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  terrain.computeVertexNormals();
  const grain = new Uint8Array(128 * 128 * 4);
  for (let i = 0; i < grain.length; i += 4) {
    grain[i] = grain[i + 1] = grain[i + 2] = 205 + Math.floor(rand() * 50);
    grain[i + 3] = 255;
  }
  const gravel = new T.DataTexture(grain, 128, 128);
  gravel.wrapS = gravel.wrapT = T.RepeatWrapping;
  gravel.generateMipmaps = true;
  gravel.minFilter = T.LinearMipmapLinearFilter;
  gravel.magFilter = T.LinearFilter;
  gravel.needsUpdate = true;
  scene.add(
    new T.Mesh(terrain, new T.MeshLambertMaterial({ map: gravel, vertexColors: true, side: T.DoubleSide })),
  );
  const sea = new T.Mesh(
    new T.PlaneGeometry(2600, 2600),
    new T.ShaderMaterial({
      vertexShader:
        'varying vec3 p;void main(){p=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}',
      fragmentShader: `varying vec3 p;void main(){vec3 ray=normalize(p-cameraPosition);
      float band=sin(p.z*1.1+p.x*.23+sin(p.x*.39))*.5+.5;
      float glint=smoothstep(.83,1.,band)*(.45+.55*sin(p.x*.22+p.z*.65));
      float sun=pow(max(0.,dot(normalize(ray.xz),normalize(vec2(.58,-.81)))),65.);
      vec3 c=mix(vec3(.27,.51,.57),vec3(.58,.67,.70),smoothstep(30.,340.,distance(p,cameraPosition)));
      c+=glint*vec3(.035,.045,.04)+sun*glint*vec3(.53,.32,.12);
      gl_FragColor=vec4(c,1.);}`,
    }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -1.6;
  scene.add(sea);
  for (let i = 0; i < 28; i++) {
    const a = i * 2.4,
      radius = 460 + rand() * 200;
    piece(
      stone,
      rand() > 0.5 ? 0x697587 : 0x81778b,
      Math.cos(a) * radius,
      -12,
      Math.sin(a) * radius,
      25 + rand() * 68,
      9 + rand() * 34,
      25 + rand() * 49,
      a,
    );
  }
  function tree(x, y, z, s) {
    const angle = rand() * 6.28;
    piece(trunk, 0x685642, x, y + 2.4 * s, z, 0.38 * s, 5.1 * s, 0.4 * s, angle, 0.07);
    for (let j = 0; j < 3; j++) {
      const t = angle + j * 2.1;
      piece(
        trunk,
        0x685642,
        x + Math.cos(t) * 0.7 * s,
        y + 4 * s,
        z + Math.sin(t) * 0.7 * s,
        0.19 * s,
        2.6 * s,
        0.22 * s,
        -t,
        -0.85,
      );
      piece(
        pine,
        [0x566440, 0x697348, 0x4a5c40][j],
        x + Math.cos(t) * 1.55 * s,
        y + (5.1 + rand()) * s,
        z + Math.sin(t) * 1.55 * s,
        2.7 * s,
        1.38 * s,
        2.52 * s,
        t,
      );
    }
  }
  for (let i = 0; i < road.length; i++) {
    if (i % 4 === 0) {
      const p = atRoad(i, -9.5 - rand() * 2.8);
      tree(p.x, 3, p.z, 0.65 + rand() * 0.75);
    }
    if (i % 9 === 3) {
      const p = atRoad(i + 1, -11.8);
      piece(cypress, 0x3a5840, p.x, 6, p.z, 0.86, 6, 0.9, i);
    }
    if (i % 3 === 1) {
      const p = atRoad(i, 8.4 + rand() * 3);
      piece(stone, 0x8c885d, p.x, 3.3, p.z, 1.4 + rand(), 0.7 + rand(), 1, i);
    }
    if (i % 21 < 13 && i % 2 === 0) {
      const p = atRoad(i, 7.5);
      piece(box, 0xcbb99b, p.x, 3.42, p.z, 0.65, 0.86, 3.6, p.yaw);
    }
    if (i % 13 === 2) {
      const p = { ...high[i], yaw: road[i].yaw },
        h = 4 + rand() * 2.3;
      piece(box, 0xf1dfb9, p.x, p.y + h / 2 - 1, p.z, 6, h + 2, 5, p.yaw);
      piece(box, 0xd6b69c, p.x, p.y + h + 0.13, p.z, 6.4, 0.26, 5.4, p.yaw);
      piece(box, 0xe3caaa, p.x + 1.4, p.y + h + 1.2, p.z, 3, 2.4, 3, p.yaw);
      for (const q of [-1.65, 1.65]) {
        piece(
          box,
          0x526b70,
          p.x - Math.cos(p.yaw) * 3.025 + Math.sin(p.yaw) * q,
          p.y + h * 0.54,
          p.z + Math.sin(p.yaw) * 3.025 + Math.cos(p.yaw) * q,
          0.08,
          1.1,
          1.05,
          p.yaw,
        );
      }
    }
    for (const side of [-1, 1]) {
      const p = atRoad(i, side * (7.2 + rand() * 5));
      piece(stone, side > 0 ? 0x9d945d : 0x807e4c, p.x, 3.12, p.z, 1.05, 0.45 + rand() * 0.45, 0.9, i);
    }
  }
  for (const index of GATES) {
    for (const side of [-1, 1]) {
      const p = atRoad(index, side * 6.4);
      piece(box, 0xe9d7b1, p.x, 4.15, p.z, 0.18, 2.3, 0.18, p.yaw);
      piece(box, 0xee633d, p.x, 5.03, p.z, 0.25, 0.65, 0.25, p.yaw);
    }
  }
  const start = atRoad(0);
  for (let i = 0; i < 16; i++)
    for (let j = 0; j < 2; j++) {
      const p = atRoad(0, (i - 7.5) * 0.73);
      piece(
        box,
        (i + j) % 2 ? 0x4d4950 : 0xe6d7bd,
        p.x + Math.sin(start.yaw) * j * 0.72,
        3.027,
        p.z + Math.cos(start.yaw) * j * 0.72,
        0.73,
        0.018,
        0.72,
        start.yaw,
      );
    }
  const staticMaterial = matte(0xffffff);
  for (const [g, items] of batches) {
    const mesh = new T.InstancedMesh(g, staticMaterial, items.length);
    items.forEach(([matrix, color], i) => {
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, color);
    });
    scene.add(mesh);
  }
  const vehicles = new Map(),
    preview = coupe(0);
  const initial = atRoad(-3, 2.6);
  preview.position.set(initial.x, 3.04, initial.z);
  preview.rotation.y = initial.yaw;
  scene.add(preview);
  const target = new T.Vector3(),
    look = new T.Vector3();
  let lastW = 0,
    lastH = 0;
  function render(drivers, id, dt) {
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    if (w !== lastW || h !== lastH) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      lastW = w;
      lastH = h;
    }
    const ids = new Set(drivers.map((p) => p.id));
    for (const [key, mesh] of vehicles)
      if (!ids.has(key)) {
        scene.remove(mesh);
        vehicles.delete(key);
      }
    let local = null;
    for (const p of drivers) {
      let mesh = vehicles.get(p.id);
      if (!mesh) {
        mesh = coupe(p.slot);
        vehicles.set(p.id, mesh);
        scene.add(mesh);
      }
      mesh.position.set(p.x, 3.04, p.z);
      mesh.rotation.y = p.yaw;
      if (p.id === id) local = mesh;
    }
    preview.visible = !local;
    const subject = local || preview,
      a = subject.rotation.y,
      sx = Math.sin(a),
      sz = Math.cos(a);
    const scale = w / h < 0.85 ? 1.26 : 1;
    target.copy(subject.position).addScaledVector(up, 2.75 * scale);
    target.x -= sx * 7.35 * scale;
    target.z -= sz * 7.35 * scale;
    const blend = 1 - Math.exp(-12 * dt);
    if (camera.position.lengthSq() < 1 || camera.position.distanceTo(target) > 22)
      camera.position.copy(target);
    else camera.position.lerp(target, blend);
    look.copy(subject.position);
    look.x += sx * 12;
    look.z += sz * 12;
    look.y += 1.75;
    camera.lookAt(look);
    sky.position.copy(camera.position);
    renderer.render(scene, camera);
  }
  return render;
}
