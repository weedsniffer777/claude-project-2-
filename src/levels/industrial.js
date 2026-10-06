// Level 8: the industrial district, under a yellow smog. Out of the last of
// the slums' scrap into the works, and into a factory, where the way on is
// shut by a defence wall.
//
// Layout (world +X runs bottom-left to top-right on screen):
//  1 The scrapyards: a dirt road between scrap heaps and sheet fences, a
//    yard crane with its magnet, wrecks stacked, sheds; containers stacked
//    on the near side; the first brick works. A checkpoint.
//  2 The works: cracked asphalt between warehouses and their loading docks,
//    chimneys smoking, storage tanks, pipe racks over the road, a rail spur
//    crossing it, a container yard under a gantry crane. A checkpoint built
//    into the factory's front.
//  3 The factory: a short, tall hall, assembly lines either side with
//    half-built machines on them, presses, an overhead crane; and across
//    its far end the defence wall: steel bulkheads, cameras, gun turrets
//    riding rails on its face, a blast door in the middle. Every turret
//    destroyed, the door blows: drive on out.
import * as THREE from 'three';
import { addSmog } from '../render/setup.js';
import { box, cyl, put, gradientMap, setLowPoly } from '../models/kit.js';
import { LevelBuilder, canvas, tex, blob, speckle } from './builder.js';
import * as P from './props.js';
import { buildShack } from './depot.js';
import { buildDepotRoom } from './depotRoom.js';
import { rails } from './rails.js';
import { glyphSign, mapMat, hazardTexture } from './cityTextures.js';
import { cityKit, BURNT_PAINT, CONTAINERS } from './cityKit.js';
import { streetKit } from './streetKit.js';

const GPX = 6;
const MAP = { x0: -60, x1: 300, z0: -50, z1: 46 };
const START_X = -30;
const CURB = { n: -5, s: 5 }; // the road
const WALK = { n: -7.5, s: 7.5 }; // where the buildings' fronts stand
const SHACK_A = { x0: 90, x1: 97.6 };
const SPUR_X = 150; // the rail spur across the road
const SHACK_B = { x0: 190, x1: 197.6 }; // built into the factory's front
const HALL = { x0: 198, x1: 246, n: -19, s: 19 };
const HALL_H = 10;
const WALL_X = HALL.x1 - 3; // the defence wall's face
const DOOR = { z: 0, half: 3.5, h: 6 }; // its blast door
const heightAt = () => 0;

const SCRAP = [0x5a5e62, 0x3a3c3f, 0x6a6458, 0x7a5a42, 0x6b4a38, 0x8a8f96, 0x2f4f7a];
const BRICK = [0x7a4e3c, 0x8a5a44, 0x6e4636];

// The ground: dirt and scrap at the start, giving way to cracked asphalt,
// oil stains, faded lines; concrete yards; the spur's rails set in the road
function groundTexture(rand) {
  const W = (MAP.x1 - MAP.x0) * GPX;
  const H = (MAP.z1 - MAP.z0) * GPX;
  const [c, g] = canvas(W, H);
  const X = (x) => (x - MAP.x0) * GPX;
  const Z = (z) => (z - MAP.z0) * GPX;
  const rect = (x0, z0, x1, z1, color) => {
    g.fillStyle = color;
    g.fillRect(X(x0), Z(z0), X(x1) - X(x0), Z(z1) - Z(z0));
  };
  // dirt everywhere at first
  rect(MAP.x0, MAP.z0, MAP.x1, MAP.z1, '#6a5f4c');
  speckle(g, W, H, ['#625744', '#74684f', '#5a5040', '#7e7055', '#4e4636'], W * H * 0.07, rand);
  // concrete yards from the works on: pale, slabbed, stained
  rect(40, MAP.z0, MAP.x1, MAP.z1, '#7d7a72');
  speckle(g, X(MAP.x1) - X(40), H, ['#75726a', '#86837a', '#6e6b64', '#8d8a81'], (X(MAP.x1) - X(40)) * H * 0.06, rand, 0, X(40));
  g.fillStyle = 'rgba(40,38,34,0.35)';
  for (let x = 40; x < MAP.x1; x += 4) g.fillRect(X(x), 0, 1, H);
  for (let z = MAP.z0; z < MAP.z1; z += 4) g.fillRect(X(40), Z(z), W - X(40), 1);
  // the road: rutted dirt, then asphalt (a ragged edge where it starts)
  for (let x = MAP.x0; x < MAP.x1; x += 0.5) {
    const asphalt = x > 34 + Math.sin(x) * 3;
    const wob = Math.sin(x / 7) * 0.4 + Math.sin(x / 2.3) * 0.2;
    g.fillStyle = asphalt ? '#3f3e3c' : '#574b3b';
    g.fillRect(X(x), Z(CURB.n - wob), 0.5 * GPX + 1, (CURB.s - CURB.n + wob * 2) * GPX);
  }
  for (let i = 0; i < 260; i++) {
    const x = MAP.x0 + rand() * (MAP.x1 - MAP.x0);
    const z = CURB.n + rand() * (CURB.s - CURB.n);
    g.fillStyle = x > 36 ? (rand() < 0.5 ? '#2c2b2a' : '#4a4845') : '#4a4034';
    blob(g, X(x), Z(z), (0.5 + rand() * 1.4) * GPX, (0.3 + rand() * 0.8) * GPX, rand, 9);
  }
  // cracks in the asphalt, oil stains, a faded centre line
  g.strokeStyle = 'rgba(20,20,20,0.6)';
  g.lineWidth = 1;
  for (let i = 0; i < 120; i++) {
    let x = X(40 + rand() * (MAP.x1 - 40));
    let z = Z(CURB.n + rand() * (CURB.s - CURB.n));
    g.beginPath();
    g.moveTo(x, z);
    for (let k = 0; k < 6; k++) g.lineTo((x += (rand() - 0.5) * 14), (z += (rand() - 0.5) * 10));
    g.stroke();
  }
  for (let i = 0; i < 90; i++) {
    g.fillStyle = `rgba(16,14,12,${0.25 + rand() * 0.3})`;
    blob(g, X(40 + rand() * (MAP.x1 - 40)), Z(MAP.z0 + rand() * (MAP.z1 - MAP.z0)), (0.6 + rand() * 1.6) * GPX, (0.4 + rand() * 1) * GPX, rand, 10);
  }
  g.fillStyle = 'rgba(200,170,70,0.55)';
  for (let x = 44; x < MAP.x1; x += 3) if (rand() > 0.3) g.fillRect(X(x), Z(-0.12), 1.6 * GPX, 0.24 * GPX);
  // scrap ground into the dirt at the start
  for (let i = 0; i < 3000; i++) {
    g.fillStyle = ['#8a8f96', '#3a5a8a', '#b03a3a', '#2a2b2d', '#7a5a42'][(rand() * 5) | 0];
    g.fillRect(X(MAP.x0 + rand() * (40 - MAP.x0)), Z(MAP.z0 + rand() * (MAP.z1 - MAP.z0)), 1 + ((rand() * 2) | 0), 1);
  }
  return tex(c);
}
// the hall's floor: dark concrete, painted lanes and hazard edging,
// oil and grime, the line where the wall stands
function floorTexture(rand) {
  const K = 8;
  const W = (HALL.x1 - HALL.x0) * K;
  const H = (HALL.s - HALL.n) * K;
  const [c, g] = canvas(W, H);
  const X = (x) => (x - HALL.x0) * K;
  const Z = (z) => (z - HALL.n) * K;
  g.fillStyle = '#62605a';
  g.fillRect(0, 0, W, H);
  speckle(g, W, H, ['#5a5852', '#6a6862', '#55534d', '#706e67'], W * H * 0.1, rand);
  g.fillStyle = 'rgba(30,30,28,0.4)';
  for (let x = HALL.x0; x < HALL.x1; x += 6) g.fillRect(X(x), 0, 1, H);
  // the lanes: yellow edges either side of the middle
  g.fillStyle = '#b8962e';
  for (const z of [-6, 6]) for (let x = HALL.x0 + 1; x < WALL_X - 2; x += 1) if (rand() > 0.15) g.fillRect(X(x), Z(z) - 1, 0.8 * K, 3);
  // hazard stripes in front of the wall
  for (let z = HALL.n; z < HALL.s; z += 0.8) {
    g.fillStyle = Math.round((z - HALL.n) / 0.8) % 2 ? '#1d1e20' : '#c9a02a';
    g.beginPath();
    g.moveTo(X(WALL_X - 2.2), Z(z));
    g.lineTo(X(WALL_X - 2.2), Z(z + 0.4));
    g.lineTo(X(WALL_X - 1.2), Z(z + 0.8));
    g.lineTo(X(WALL_X - 1.2), Z(z + 0.4));
    g.fill();
  }
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(14,12,10,${0.3 + rand() * 0.3})`;
    blob(g, rand() * W, rand() * H, (0.5 + rand() * 1.4) * K, (0.3 + rand() * 0.8) * K, rand, 9);
  }
  return tex(c);
}

export const industrial = {
  id: 'industrial',
  name: 'Level 8 · Industrial district',
  build(scene) {
    setLowPoly(true);
    try {
      return buildIndustrial(scene);
    } finally {
      setLowPoly(false);
    }
  },
};

function buildIndustrial(scene) {
  const B = new LevelBuilder(scene, 8081); // outside
  const H = new LevelBuilder(scene, 8087); // the factory hall
  const rand = B.rand;
  const light = addSmog(scene, { shadowSize: 22, shadowMap: 2048 });
  const K = cityKit(B, { WALK, SW: 0, heightAt });
  const sign = (w, h, o = {}) => mapMat(glyphSign(w, h, { rand, ...o }));
  const ST = streetKit(B, { CURB, WALK, SW: 0, heightAt, sign });
  const pick = (a) => a[(rand() * a.length) | 0];
  const junk = (fn, scrap = 0) => B.crushable(fn, { kind: 'prop', scrap });
  const tin = (BB, w, h, d, x, y, z, col) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), K.ribMat(Math.max(w, d), h, col));
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    BB.add(m);
    return m;
  };
  // smoke going up (from chimneys, vents, fires): a puff every so often
  const smoke = (BB, x, y, z, { rate = 3, color = 0x5a5650, s1 = 2.2, life = 4 } = {}) => {
    let carry = rand();
    BB.animate((dt, t, ctx) => {
      carry += dt * rate;
      while (carry > 1 && ctx?.combat) {
        carry -= 1;
        ctx.combat.puffs.spawn(new THREE.Vector3(x + (rand() - 0.5) * 0.4, y, z + (rand() - 0.5) * 0.4), new THREE.Vector3(0.6 + rand() * 0.4, 1.4 + rand() * 0.6, 0.2), { color, s0: 0.5, s1, life, drag: 0.3, lift: 0.2, fadeAt: 0.35 });
      }
    });
  };

  // ------------------------------------------------------------ ground
  {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(MAP.x1 - MAP.x0, MAP.z1 - MAP.z0), new THREE.MeshToonMaterial({ map: groundTexture(rand), gradientMap }));
    m.rotation.x = -Math.PI / 2;
    m.position.set((MAP.x0 + MAP.x1) / 2, 0, (MAP.z0 + MAP.z1) / 2);
    m.receiveShadow = true;
    B.add(m);
    B.solid(m);
  }
  for (let i = 0; i < 500; i++) {
    const x = START_X - 4 + rand() * (HALL.x0 - START_X);
    const z = (rand() - 0.5) * 30;
    const sz = 0.06 + rand() * 0.16;
    B.piece(sz * (1 + rand()), sz * 0.6, sz, pick([0x6a6458, 0x7a7266, 0x4a4036, 0x8a8f96, 0x5a5e62]), x, sz * 0.25, z, rand(), rand() * 3, rand());
  }

  // a scrap heap: lumps of everything, sheets sticking out of it
  const heap = (x, z, r) => {
    for (let k = 0; k < r * 7; k++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * r;
      B.lump(x + Math.cos(a) * d, (1 - d / r) * r * 0.5, z + Math.sin(a) * d * 0.8, 0.5 + rand() * 0.8, 0.35 + rand() * 0.5, 0.5 + rand() * 0.7, pick(SCRAP), rand() * 3);
    }
    for (let k = 0; k < r * 2; k++) B.piece(0.5 + rand() * 1.2, 0.08, 0.4 + rand() * 0.8, pick(SCRAP), x + (rand() - 0.5) * r * 1.4, (0.3 + rand() * 0.5) * r * 0.5, z + (rand() - 0.5) * r, rand() - 0.5, rand() * 3, rand() - 0.5);
    B.block(x, z, r * 0.7, r * 0.55);
  };
  // a fence of sheet metal panels along x at z
  const sheetFence = (xa, xb, z) => {
    for (let x = xa; x < xb; x += 2.4) {
      const fh = 2.2 + rand() * 0.5;
      const f = tin(B, 2.3, fh, 0.06, x + 1.2, fh / 2, z + (rand() - 0.5) * 0.2, pick([0x6a6e72, 0x7a4a36, 0x5a5e62, 0x8a5a3a, 0x74777a]));
      f.rotation.z = (rand() - 0.5) * 0.1;
    }
    B.block((xa + xb) / 2, z, (xb - xa) / 2, 0.3);
  };

  // =================================================== 1: the scrapyards
  // north: the yards behind sheet fences, heaps over them, the crane;
  // south: containers stacked two and three high, a shed or two
  sheetFence(START_X - 30, 36, WALK.n + 0.5);
  for (let x = START_X - 20; x < 34; x += 7 + rand() * 5) {
    heap(x, WALK.n - 4 - rand() * 3, 2.5 + rand() * 2);
    if (rand() < 0.6) heap(x + 3, WALK.n - 13 - rand() * 8, 3 + rand() * 3);
  }
  // the yard crane: a tracked base, a tall lattice jib leaning over the
  // heaps, its electromagnet hanging off a cable, a car stuck to it
  {
    const cx = 8;
    const cz = WALK.n - 9;
    put(B.root, box(3.4, 1.6, 2.6, 0xb08a3a, { r: 0.05 }), cx, 1.5, cz).castShadow = true;
    put(B.root, box(1.4, 1.2, 1.6, 0x3a3c3f, { r: 0.04 }), cx + 1.2, 2.8, cz + 0.4); // the cab
    put(B.root, box(1.2, 0.7, 0.05, 0x1a1918), cx + 1.9, 2.9, cz + 0.4).rotation.y = Math.PI / 2;
    for (const s of [-1, 1]) put(B.root, box(4, 0.7, 0.6, 0x2a2b2d), cx, 0.35, cz + s * 1.2);
    const jib = new THREE.Group();
    jib.position.set(cx - 1, 2.4, cz);
    jib.rotation.z = 0.9;
    for (const [dy, dz] of [[0, -0.35], [0, 0.35], [0.6, 0]]) put(jib, box(13, 0.12, 0.12, 0xc99a2e), 6.5, dy, dz);
    for (let k = 0; k < 13; k++) put(jib, box(0.07, 0.7, 0.07, 0xc99a2e), 0.5 + k, 0.3, 0).rotation.x = k % 2 ? 0.5 : -0.5;
    B.add(jib);
    const tipX = cx - 1 + Math.cos(0.9) * 13;
    const tipY = 2.4 + Math.sin(0.9) * 13;
    B.line([new THREE.Vector3(tipX, tipY, cz), new THREE.Vector3(tipX, 5.2, cz)], B.lineMat);
    put(B.root, cyl(0.9, 0.35, 0x2a2b2d, { seg: 14 }), tipX, 5, cz);
    const car = P.car(B, tipX, cz, 0.6, { kind: 'hatch', paint: BURNT_PAINT[1], snow: false, solidBlock: false });
    car.position.y = 3.6;
    car.rotation.x = 0.25;
    B.block(cx, cz, 2, 1.6);
  }
  // wrecks stacked by the fence
  for (const [x, z] of [[-14, WALK.n - 2], [22, WALK.n - 2.2]]) {
    for (let k = 0; k < 3; k++) {
      const c = P.car(B, x + (rand() - 0.5) * 0.4, z, rand() * 0.2, { kind: pick(['sedan', 'hatch']), paint: pick(BURNT_PAINT), snow: false, solidBlock: k === 0 });
      c.position.y = k * 1.25;
    }
  }
  // the near side: containers stacked, a shed, a weighbridge office
  for (let x = START_X - 24; x < 36; x += 6.4) {
    if (rand() < 0.15) continue;
    const z = WALK.s + 3.4 + rand() * 0.4; // (set back, and low: the near side mustn't hide the road)
    const n = rand() < 0.7 ? 1 : 2;
    for (let k = 0; k < n; k++) K.container(B, x + (rand() - 0.5) * 0.4, k * 2.6, z + (k ? (rand() - 0.5) * 0.4 : 0), (rand() - 0.5) * 0.06, pick(CONTAINERS));
    B.block(x, z, 3, 1.25);
  }
  {
    const x = 26;
    const z = WALK.s + 6;
    tin(B, 4, 2.6, 3, x, 1.3, z, 0x6a6e72);
    put(B.root, box(4.4, 0.08, 3.4, 0x45484c), x, 2.65, z);
    put(B.root, box(1.6, 0.6, 0.05, 0x1a1918), x - 0.6, 1.6, z - 1.52);
    put(B.root, box(0.8, 1.8, 0.05, 0x2a2b2d), x + 1.1, 0.9, z - 1.52);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.5), sign(2.4, 0.5, { board: '#c9b03a', ink: '#1d1e20' }));
    s.position.set(x, 2.3, z - 1.53);
    s.rotation.y = Math.PI;
    B.add(s);
    B.block(x, z, 2, 1.5);
  }
  // the first works: brick, either side, where the asphalt starts
  K.works({ x0: 38, x1: 62, zf: WALK.n, roof: 'saw', wall: BRICK[0], tin: false, doors: 2, H: 6 });
  K.works({ x0: 66, x1: SHACK_A.x0, zf: WALK.n, roof: 'flat', wall: 0x7d8a82, doors: 2, dock: true, H: 5.5 });
  K.works({ x0: 40, x1: 58, zf: WALK.s + 1.5, side: 's', roof: 'flat', wall: BRICK[1], tin: false, doors: 1, H: 3.6 });
  K.works({ x0: 62, x1: SHACK_A.x0, zf: WALK.s + 1.5, side: 's', roof: 'flat', wall: 0x6f7a72, doors: 2, H: 3.6 });
  for (const [x, z] of [[-6, -3.4], [34, 3.2], [70, -3.6]]) ST.barrelFire(x, z);
  for (let x = START_X; x < SHACK_A.x0 - 4; x += 6 + rand() * 6) {
    const s = rand() < 0.5 ? -1 : 1;
    const z = s * (CURB.s + 0.8 + rand());
    const r = rand();
    if (r < 0.3) junk(() => P.tires(B, x, 0, z, 3 + ((rand() * 4) | 0)));
    else if (r < 0.55) junk(() => P.crates(B, x, 0, z), 2);
    else if (r < 0.75) {
      for (let k = 0; k < 3; k++) put(B.root, cyl(0.3, 0.9, pick([0x3a5a8a, 0xb03a3a, 0x5a5e62, 0x4e6355]), { seg: 10 }), x + k * 0.65, 0.45, z);
      B.block(x + 0.65, z, 1.1, 0.4);
    } else junk(() => P.dumpster(B, x, 0, z, (rand() - 0.5) * 0.4, pick([0x4e6355, 0x4f5d73, 0x7a4a36])));
  }
  const wreck = (x, z, yaw, o) => B.crushable(() => P.car(B, x, z, yaw, o), { kind: 'car', scrap: 2 });
  wreck(2, -3.2, 0.35, { kind: 'van', paint: BURNT_PAINT[0], snow: false });
  wreck(52, 3.4, -0.2, { kind: 'sedan', paint: BURNT_PAINT[2], snow: false });
  // behind the start: the way back blocked by scrap
  heap(START_X - 6, -2, 3);
  heap(START_X - 7, 3, 2.6);
  B.block(START_X - 6, 0, 1.6, 8);

  // ===================================================== 2: the works
  // warehouses with docks both sides; between them yards with chimneys,
  // tanks, pipe racks; the rail spur; the container yard and its gantry
  K.works({ x0: SHACK_A.x1, x1: 124, zf: WALK.n, roof: 'saw', wall: BRICK[2], tin: false, doors: 3, dock: true, H: 6.5 });
  K.works({ x0: 160, x1: 186, zf: WALK.n, roof: 'gable', wall: 0x7d8a82, doors: 2, dock: true, H: 6 });
  K.works({ x0: SHACK_A.x1, x1: 118, zf: WALK.s + 1.5, side: 's', roof: 'flat', wall: 0x6f7a72, doors: 2, H: 3.6 });
  K.works({ x0: 168, x1: SHACK_B.x0, zf: WALK.s + 1.5, side: 's', roof: 'flat', wall: BRICK[0], tin: false, doors: 2, H: 3.6 });
  // the chimneys: tall brick stacks, bands near the top, smoke rolling off
  for (const [x, z, h] of [[52, WALK.n - 12, 18], [130, WALK.n - 10, 22], [176, WALK.n - 16, 20]]) {
    const st = put(B.root, cyl(1.1, h, BRICK[1], { seg: 12, radiusEnd: 0.8 }), x, h / 2, z);
    st.castShadow = true;
    B.solid(st);
    for (const y of [h - 1.2, h - 2.4]) put(B.root, cyl(0.88, 0.25, 0x3a3634, { seg: 12 }), x, y, z);
    put(B.root, cyl(0.9, 0.5, 0x1d1e20, { seg: 12 }), x, h + 0.1, z);
    B.block(x, z, 1.1, 1.1);
    smoke(B, x, h + 0.6, z, { rate: 2.5, color: 0x4a4640, s1: 3, life: 6 });
  }
  // storage tanks in the gap north: big round, ladders, a catwalk between
  for (const [x, z, r, h] of [[128, WALK.n - 17, 3, 7], [136, WALK.n - 18, 2.6, 6], [160, WALK.n - 17.5, 3.2, 8]]) {
    const tk = put(B.root, cyl(r, h, pick([0xb8b4a8, 0x9aa0a4, 0xa89a7a]), { seg: 18 }), x, h / 2, z);
    tk.castShadow = true;
    B.solid(tk);
    put(B.root, cyl(r + 0.05, 0.3, 0x6a6e72, { seg: 18, radiusEnd: r * 0.7 }), x, h + 0.15, z);
    for (const y of [h * 0.33, h * 0.66]) put(B.root, cyl(r + 0.03, 0.08, 0x6a6e72, { seg: 18 }), x, y, z);
    for (const dz of [-0.2, 0.2]) put(B.root, box(0.05, h, 0.05, 0x3a3c3f), x + r * 0.7, h / 2, z + r * 0.7 + dz);
    for (let y = 0.5; y < h; y += 0.45) put(B.root, box(0.05, 0.04, 0.45, 0x3a3c3f), x + r * 0.7, y, z + r * 0.7);
    B.block(x, z, r, r);
    // a stain down it, a hazard sign
    B.piece(0.02, h * 0.6, 0.8, 0x6a5a42, x - r - 0.01, h * 0.55, z + 0.3);
  }
  ST.pipes(SHACK_A.x1 + 2, 128, WALK.n - 1.2, 2.2);
  ST.pipes(132, 186, WALK.s + 1.4, 1.4);
  for (const x of [112, 172]) ST.pipeArch(x);
  // the rail spur: rails set in the road, running north into the works
  // through a gate; a rusted wagon left on it
  {
    const R = rails(B, rand, { gauge: 0.72 });
    R.track(R.straight(SPUR_X, MAP.z0 + 8, SPUR_X, WALK.s + 6));
    const wx = SPUR_X;
    const wz = WALK.n - 9;
    tin(B, 2.8, 2.6, 8, wx, 2.0, wz, 0x6b4a38);
    put(B.root, box(3, 0.2, 8.4, 0x2a2b2d), wx, 0.65, wz);
    for (const dz of [-2.8, 2.8]) for (const dx of [-0.72, 0.72]) put(B.root, cyl(0.38, 0.12, 0x1d1e20, { axis: 'x', seg: 10 }), wx + dx, 0.38, wz + dz);
    B.block(wx, wz, 1.5, 4.2);
    for (const s of [-1, 1]) put(B.root, box(0.4, 3.2, 0.4, 0x8a8f96), SPUR_X + s * 2.4, 1.6, WALK.n - 0.4); // the gate posts
    put(B.root, box(5.2, 0.4, 0.3, 0x8a8f96), SPUR_X, 3.1, WALK.n - 0.4);
  }
  // the container yard (north, the far side), a gantry crane over it; a
  // gap left for the spur
  {
    for (let x = 122; x < 172; x += 6.6) {
      if (Math.abs(x - SPUR_X) < 5) continue;
      for (const z of [WALK.n - 2.4, WALK.n - 5.2, WALK.n - 8]) {
        const n = 1 + ((rand() * 3) | 0);
        for (let k = 0; k < n; k++) K.container(B, x, k * 2.6, z, 0, pick(CONTAINERS));
      }
      B.block(x, WALK.n - 5.2, 3, 4.2);
    }
    const gx = 133;
    for (const dx of [-11, 11]) {
      for (const dz of [WALK.n - 0.6, WALK.n - 10]) put(B.root, box(0.6, 10, 0.6, 0xc99a2e), gx + dx, 5, dz);
      put(B.root, box(0.5, 0.8, 10, 0xc99a2e), gx + dx, 10, WALK.n - 5.3);
    }
    put(B.root, box(23, 1, 0.8, 0xc99a2e), gx, 10.2, WALK.n - 0.6);
    put(B.root, box(23, 1, 0.8, 0xc99a2e), gx, 10.2, WALK.n - 10);
    put(B.root, box(2, 1.2, 10, 0x3a3c3f), gx + 3, 9.6, WALK.n - 5.3); // the trolley
    B.line([new THREE.Vector3(gx + 3, 9, WALK.n - 5.3), new THREE.Vector3(gx + 3, 6.5, WALK.n - 5.3)], B.lineMat);
    K.container(B, gx + 3, 5.2, WALK.n - 5.3, 0, CONTAINERS[0]);
    // a forklift with a pallet up
    const fx = 126;
    const fz = WALK.s + 1.2;
    put(B.root, box(1.6, 0.9, 1.0, 0xd9a22a, { r: 0.06 }), fx, 0.7, fz);
    put(B.root, box(0.9, 0.9, 0.9, 0x2a2b2d, { r: 0.04 }), fx - 0.2, 1.6, fz);
    for (const dz of [-0.35, 0.35]) put(B.root, box(0.08, 2.4, 0.08, 0x2a2b2d), fx + 0.85, 1.2, fz + dz);
    put(B.root, box(1.0, 0.12, 1.0, 0x7a5f3e), fx + 1.3, 1.4, fz);
    for (const [dx, dz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) put(B.root, cyl(0.22, 0.18, 0x1d1e20, { axis: 'z', seg: 10 }), fx + dx, 0.22, fz + dz);
    B.block(fx + 0.3, fz, 1.2, 0.6);
  }
  // pallets and drums along the docks
  for (let x = SHACK_A.x1 + 3; x < SHACK_B.x0 - 3; x += 5 + rand() * 6) {
    if (Math.abs(x - SPUR_X) < 4) continue;
    const s = rand() < 0.6 ? -1 : 1;
    const z = s < 0 ? CURB.n - 1.4 : CURB.s + 1.4;
    if (rand() < 0.5) {
      for (let k = 0; k < 1 + rand() * 3; k++) B.piece(1.1, 0.14, 1.1, 0x7a5f3e, x, 0.07 + k * 0.15, z, 0, rand() * 0.2, 0);
      if (rand() < 0.6) B.piece(1, 0.7, 1, pick([0xb8b4a8, 0x3a5a8a, 0x5a7a5e]), x, 0.75, z, 0, rand() * 0.2, 0);
    } else {
      for (let k = 0; k < 4; k++) put(B.root, cyl(0.3, 0.9, pick([0x3a5a8a, 0xb03a3a, 0x2f4f2a, 0x5a5e62]), { seg: 10 }), x + (k % 2) * 0.62, 0.45, z + ((k / 2) | 0) * 0.62);
    }
    B.block(x + 0.3, z + 0.3, 0.8, 0.8);
  }
  ST.lights({ xs: [48, 62, 76, 104, 118, 132, 160, 174], wires: false });
  for (const [x, z] of [[108, 3.4], [164, -3.6]]) ST.barrelFire(x, z);
  wreck(140, -3.6, 0.5, { kind: 'van', paint: BURNT_PAINT[3], snow: false });

  // =================================================== 3: the factory
  // Its outside: a tall tin hall on a brick plinth, a sawtooth roof, a
  // chimney; the checkpoint shack built into its front; hidden once in
  const LEN = HALL.x1 - HALL.x0;
  const MIDX = (HALL.x0 + HALL.x1) / 2;
  const WID = HALL.s - HALL.n;
  const shell = new THREE.Group();
  {
    const wallBox = (w, h, d, mat, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = m.receiveShadow = true;
      shell.add(m);
      return m;
    };
    for (const s of [-1, 1]) {
      wallBox(LEN + 1, HALL_H, 0.6, K.ribMat(LEN, HALL_H, 0x7d8a82), MIDX, HALL_H / 2, s < 0 ? HALL.n - 0.3 : HALL.s + 0.3);
      shell.add(put(new THREE.Group(), box(LEN + 1.02, 1.6, 0.64, BRICK[0], { r: 0.02 }), MIDX, 0.8, s < 0 ? HALL.n - 0.3 : HALL.s + 0.3));
    }
    // the front either side of the shack, above it, and the back
    for (const [za, zb] of [[HALL.n - 0.6, CURB.n + 0.1], [CURB.s - 0.1, HALL.s + 0.6]]) wallBox(0.8, HALL_H, zb - za, K.ribMat(zb - za, HALL_H, 0x7d8a82), HALL.x0 - 0.4, HALL_H / 2, (za + zb) / 2);
    wallBox(0.8, HALL_H - 3.6, CURB.s - CURB.n, K.ribMat(CURB.s - CURB.n, HALL_H, 0x7d8a82), HALL.x0 - 0.4, 3.6 + (HALL_H - 3.6) / 2, 0);
    wallBox(0.8, HALL_H, WID + 1.2, K.ribMat(WID, HALL_H, 0x7d8a82), HALL.x1 + 0.4, HALL_H / 2, 0);
    // the sawtooth roof: north-light teeth across it
    for (let x = HALL.x0; x < HALL.x1; x += 6) {
      const tooth = wallBox(6.2, 0.12, WID + 1.2, K.ribMat(6, WID, 0x6a6e72), x + 3, HALL_H + 1.2, 0);
      tooth.rotation.z = 0.38;
      shell.add(put(new THREE.Group(), box(0.1, 2.2, WID + 1.2, 0x8fa4b0, { r: 0 }), x + 5.8, HALL_H + 1.1, 0));
    }
    // the sign over the door, the chimney
    const board = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.4), sign(10, 1.4, { board: '#2c3034', ink: '#d9b23a' }));
    board.rotation.y = -Math.PI / 2;
    board.position.set(HALL.x0 - 0.82, HALL_H - 1.4, 0);
    shell.add(board);
    const ch = put(shell, cyl(1.3, 26, BRICK[1], { seg: 12, radiusEnd: 0.9 }), HALL.x1 - 8, 13, HALL.n + 4);
    ch.castShadow = true;
    smoke(B, HALL.x1 - 8, 26.5, HALL.n + 4, { rate: 3, color: 0x3a3632, s1: 3.4, life: 6 });
    B.add(shell);
    B.keep(shell);
    B.block(MIDX, HALL.n - 0.3, LEN / 2 + 0.5, 0.4);
    B.block(MIDX, HALL.s + 0.3, LEN / 2 + 0.5, 0.4);
  }

  // Inside (H): the floor, the walls, columns, the assembly lines either
  // side with half-built machines on them, presses, an overhead crane,
  // lamps hanging; and the defence wall
  {
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(LEN, WID), new THREE.MeshToonMaterial({ map: floorTexture(rand), gradientMap }));
    fl.rotation.x = -Math.PI / 2;
    fl.position.set(MIDX, 0.01, 0);
    fl.receiveShadow = true;
    H.add(fl);
    H.solid(fl);
    // the inside of the walls: tin over a brick plinth
    // (the near one, between the camera and the floor, only its plinth:
    // the rest of it there just for its shadow)
    for (const s of [-1, 1]) {
      if (s < 0) tin(H, LEN, HALL_H + 4, 0.3, MIDX, (HALL_H + 4) / 2, HALL.n - 0.15, 0x5d6660).receiveShadow = true;
      else {
        const ghost = new THREE.Mesh(new THREE.BoxGeometry(LEN, HALL_H - 1.6, 0.3), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
        ghost.position.set(MIDX, 1.6 + (HALL_H - 1.6) / 2, HALL.s + 0.15);
        ghost.castShadow = true;
        H.add(ghost);
      }
      put(H.root, box(LEN, 1.6, 0.34, BRICK[2], { r: 0.02 }), MIDX, 0.8, s < 0 ? HALL.n - 0.15 : HALL.s + 0.15);
    }
    // the ends, inside: the front wall either side of the checkpoint and
    // over it, the back wall behind the defence wall; tall, so nothing
    // outside shows; and dark ground all round beyond them
    const endH = HALL_H + 4;
    for (const [za, zb] of [[HALL.n - 0.3, CURB.n + 0.1], [CURB.s - 0.1, HALL.s + 0.3]]) tin(H, 0.6, endH, zb - za, HALL.x0 - 0.3, endH / 2, (za + zb) / 2, 0x5d6660);
    tin(H, 0.6, endH - 3.6, CURB.s - CURB.n, HALL.x0 - 0.3, 3.6 + (endH - 3.6) / 2, 0, 0x5d6660);
    for (const [za, zb] of [[HALL.n - 0.3, DOOR.z - DOOR.half - 1], [DOOR.z + DOOR.half + 1, HALL.s + 0.3]]) tin(H, 0.6, endH, zb - za, HALL.x1 + 0.3, endH / 2, (za + zb) / 2, 0x4a4f55);
    tin(H, 0.6, endH - DOOR.h - 0.5, DOOR.half * 2 + 2, HALL.x1 + 0.3, DOOR.h + 0.5 + (endH - DOOR.h - 0.5) / 2, DOOR.z, 0x4a4f55);
    {
      const dark = new THREE.Mesh(new THREE.PlaneGeometry(200, 160), new THREE.MeshBasicMaterial({ color: 0x0b0c0d }));
      dark.rotation.x = -Math.PI / 2;
      dark.position.set(MIDX, -0.05, 0);
      H.add(dark);
      // the corridor out beyond the door: walls either side, dim
      for (const s of [-1, 1]) tin(H, 18, 6, 0.4, HALL.x1 + 9, 3, DOOR.z + s * (DOOR.half + 1.2), 0x3a3c3f);
    }
    // columns, a crane rail on them each side, the crane across
    for (let x = HALL.x0 + 4; x < WALL_X - 3; x += 8) {
      for (const s of [-1, 1]) {
        const ch = s > 0 ? 1.6 : HALL_H; // (the near row: stumps, not to hide the floor)
        const c = put(H.root, box(0.5, ch, 0.5, 0x45484c, { r: 0.02 }), x, ch / 2, s * (WID / 2 - 0.6));
        c.castShadow = true;
        H.block(x, s * (WID / 2 - 0.6), 0.3, 0.3);
      }
    }
    put(H.root, box(LEN - 4, 0.5, 0.4, 0xc99a2e), MIDX - 1, HALL_H - 1.6, -(WID / 2 - 0.6));
    const crane = put(H.root, box(1.2, 0.8, WID - 1, 0xc99a2e, { r: 0.03 }), HALL.x0 + 14, HALL_H - 1.1, 0);
    crane.castShadow = true;
    put(H.root, box(1.4, 0.9, 1.4, 0x3a3c3f), HALL.x0 + 14, HALL_H - 1.9, -2);
    H.line([new THREE.Vector3(HALL.x0 + 14, HALL_H - 2.4, -2), new THREE.Vector3(HALL.x0 + 14, 3.2, -2)], H.lineMat);
    put(H.root, box(0.6, 0.3, 0.6, 0x2a2b2d), HALL.x0 + 14, 3.0, -2);
    // the assembly lines: belts on legs along the walls, machine frames on
    // them (dog skeletons: a body box, four bare legs), robot arms over them
    for (const s of [-1, 1]) {
      const z = s * (WID / 2 - 2.6);
      put(H.root, box(LEN - 12, 0.25, 1.6, 0x2a2b2d), MIDX - 4, 0.9, z);
      put(H.root, box(LEN - 12, 0.08, 1.4, 0x3a3c3f), MIDX - 4, 1.06, z);
      for (let x = HALL.x0 + 3; x < WALL_X - 8; x += 2.5) put(H.root, box(0.12, 0.8, 1.4, 0x45484c), x, 0.4, z);
      H.block(MIDX - 4, z, (LEN - 12) / 2, 0.9);
      for (let x = HALL.x0 + 4; x < WALL_X - 9; x += 3.2) {
        if (rand() < 0.2) continue;
        put(H.root, box(1.1, 0.45, 0.6, pick([0x5a5f66, 0x6b7078, 0x4a4f55]), { r: 0.05 }), x, 1.55, z);
        if (rand() < 0.7) for (const [dx, dz] of [[-0.4, -0.25], [0.4, -0.25], [-0.4, 0.25], [0.4, 0.25]]) put(H.root, box(0.07, 0.6, 0.07, 0x8a8f96), x + dx, 1.2, z + dz);
        if (rand() < 0.4) put(H.root, box(0.3, 0.25, 0.3, 0x3a3c3f), x + 0.6, 1.85, z);
      }
      for (let x = HALL.x0 + 8; x < WALL_X - 10; x += 10) {
        // a robot arm: base, upper arm, forearm, a welder's tip glowing
        put(H.root, cyl(0.4, 0.6, 0xd9a22a, { seg: 10 }), x, 0.3, z - s * 1.6);
        const up = put(H.root, box(0.3, 1.8, 0.3, 0xd9a22a, { r: 0.04 }), x, 1.4, z - s * 1.4);
        up.rotation.x = s * 0.4;
        const fore = put(H.root, box(1.4, 0.24, 0.24, 0xd9a22a, { r: 0.04 }), x + 0.4, 2.2, z - s * 0.7);
        fore.rotation.z = -0.5;
        put(H.root, box(0.1, 0.1, 0.1, 0xbfe8ff, { glow: true }), x + 0.9, 1.75, z - s * 0.4);
        H.emit(new THREE.Vector3(x + 0.9, 1.9, z - s * 0.4), 0x9fd8ff, 6, 4);
      }
    }
    // presses: big boxes on the floor, hazard banded
    for (const [x, z] of [[HALL.x0 + 22, -4.5], [HALL.x0 + 30, 4.8]]) {
      put(H.root, box(2.4, 3.6, 2.2, 0x4a5058, { r: 0.05 }), x, 1.8, z).castShadow = true;
      put(H.root, box(2.6, 0.5, 2.4, 0x2a2b2d), x, 3.8, z);
      for (let i = 0; i < 6; i++) put(H.root, box(0.42, 0.3, 2.26, i % 2 ? 0x1d1e20 : 0xc9a02a), x - 1.05 + i * 0.42, 0.4, z);
      H.block(x, z, 1.3, 1.2);
    }
    // the lamps hanging: shades and pools
    for (let x = HALL.x0 + 6; x < WALL_X - 2; x += 9) {
      for (const z of [-4, 4]) {
        H.line([new THREE.Vector3(x, HALL_H, z), new THREE.Vector3(x, HALL_H - 3, z)], H.lineMat);
        put(H.root, cyl(0.5, 0.3, 0x2a2b2d, { seg: 10, radiusEnd: 0.15 }), x, HALL_H - 3.1, z);
        put(H.root, cyl(0.3, 0.05, 0xffe6b0, { seg: 10, glow: true }), x, HALL_H - 3.27, z);
        H.emit(new THREE.Vector3(x, HALL_H - 3.6, z), 0xffdcae, 24, 12);
        H.pool(x, z, 3.4, 0xffd9a0, 0.16);
      }
    }
  }

  // The defence wall: steel bulkheads across the hall, two rails on its
  // face for the turrets, red light bars, cameras, vent slots; the blast
  // door in the middle (hazard-striped, a red beacon over it)
  const cams = [];
  const beacons = [];
  let door;
  const doorBlock = H.block(WALL_X + 1, DOOR.z, 1.2, DOOR.half);
  {
    const steel = [0x4a4f55, 0x52585e, 0x454a50];
    for (let z = HALL.n; z < HALL.s - 0.1; z += 2.6) {
      if (z + 2.6 > DOOR.z - DOOR.half && z < DOOR.z + DOOR.half) {
        // over the door: the lintel only
        const p = put(H.root, box(2.4, HALL_H - DOOR.h, Math.min(2.58, HALL.s - z), pick(steel), { r: 0.04 }), WALL_X + 1, DOOR.h + (HALL_H - DOOR.h) / 2, z + 1.3);
        p.castShadow = true;
        continue;
      }
      const p = put(H.root, box(2.4, HALL_H, Math.min(2.58, HALL.s - z), pick(steel), { r: 0.04 }), WALL_X + 1, HALL_H / 2, z + 1.3);
      p.castShadow = true;
      H.solid(p);
      // rivet rows, a vent slot low down
      for (const y of [0.4, HALL_H - 0.4]) put(H.root, box(0.04, 0.06, 2.4, 0x2a2b2d), WALL_X - 0.21, y, z + 1.3);
      put(H.root, box(0.04, 0.4, 1.4, 0x141416), WALL_X - 0.21, 1.2, z + 1.3);
    }
    for (const [za, zb] of [[HALL.n, DOOR.z - DOOR.half], [DOOR.z + DOOR.half, HALL.s]]) H.block(WALL_X + 1, (za + zb) / 2, 1.2, (zb - za) / 2);
    // the turrets' rails: two along the face, hazard-banded
    for (const y of [2.6, 5.2]) {
      put(H.root, box(0.3, 0.5, WID, 0x2a2b2d), WALL_X - 0.35, y, 0);
      for (let z = HALL.n; z < HALL.s; z += 1.2) put(H.root, box(0.32, 0.12, 0.6, 0xc9a02a), WALL_X - 0.36, y - 0.3, z + 0.3);
    }
    // red light bars across the top
    for (let z = HALL.n + 1; z < HALL.s - 1; z += 3) {
      const b = put(H.root, box(0.1, 0.15, 2.2, 0xff3b2f, { glow: true }), WALL_X - 0.25, HALL_H - 1, z + 1);
      beacons.push(b);
    }
    H.emit(new THREE.Vector3(WALL_X - 2, HALL_H - 2, 0), 0xff4a3a, 18, 14);
    // the cameras: on arms off the wall's top corners and either side of
    // the door, turning to follow the tank, a red eye each
    for (const [y, z] of [[HALL_H - 2.2, HALL.n + 1.5], [HALL_H - 2.2, HALL.s - 1.5], [DOOR.h + 0.6, DOOR.z - DOOR.half - 0.8], [DOOR.h + 0.6, DOOR.z + DOOR.half + 0.8]]) {
      put(H.root, box(0.6, 0.12, 0.12, 0x2a2b2d), WALL_X - 0.5, y + 0.3, z);
      const head = new THREE.Group();
      head.position.set(WALL_X - 0.9, y, z);
      put(head, box(0.6, 0.3, 0.32, 0xd8d6d0, { r: 0.04 }), -0.1, 0, 0);
      const eye = put(head, cyl(0.09, 0.05, 0xff2a1f, { axis: 'x', seg: 10, glow: true }), -0.42, 0, 0);
      put(head, box(0.3, 0.06, 0.4, 0x2a2b2d), 0.05, 0.19, 0);
      H.add(head);
      H.keep(head);
      cams.push({ head, eye });
    }
    // the blast door: a heavy plate, hazard stripes, a frame round it
    door = new THREE.Group();
    door.position.set(WALL_X + 0.6, 0, DOOR.z);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.8, DOOR.h, DOOR.half * 2), new THREE.MeshToonMaterial({ color: 0x5a6066, gradientMap }));
    plate.position.y = DOOR.h / 2;
    plate.castShadow = true;
    door.add(plate);
    const hz = hazardTexture();
    hz.wrapS = hz.wrapT = THREE.RepeatWrapping;
    hz.repeat.set(DOOR.half, 1);
    const band = new THREE.Mesh(new THREE.PlaneGeometry(DOOR.half * 2, 0.8), new THREE.MeshToonMaterial({ map: hz, gradientMap }));
    band.rotation.y = -Math.PI / 2;
    band.position.set(-0.41, 0.6, 0);
    door.add(band);
    for (const y of [2.2, 3.8]) put(door, box(0.1, 0.3, DOOR.half * 2 - 0.4, 0x3a3c3f), -0.42, y, 0);
    put(door, box(0.12, 0.5, 0.5, 0xff2a1f, { glow: true }), -0.45, DOOR.h - 0.7, 0);
    H.add(door);
    H.keep(door);
    for (const s of [-1, 1]) {
      for (let i = 0; i < 8; i++) put(H.root, box(0.5, 0.75, 0.5, i % 2 ? 0x1d1e20 : 0xc9a02a), WALL_X - 0.1, 0.375 + i * 0.75, DOOR.z + s * (DOOR.half + 0.25));
    }
    // beyond it: a dim corridor out, a glow at its end
    put(H.root, box(14, 0.1, DOOR.half * 2 + 2, 0x2a2a28), HALL.x1 + 7, 0.02, DOOR.z);
    H.emit(new THREE.Vector3(HALL.x1 + 10, 3, DOOR.z), 0xfff1d6, 0, 12, { level: 0, priority: true });
  }

  // the yards either side: off limits. Walls along both sides of the road
  // (behind the buildings' fronts, in the gaps between them), so nothing
  // runs off where the tank can't follow; the spur's gateway piled up
  for (const z of [WALK.n - 0.3, WALK.s + 0.9]) B.block((START_X - 10 + HALL.x0) / 2, z, (HALL.x0 - START_X + 10) / 2, 0.3);
  for (let k = 0; k < 4; k++) B.piece(1.6, 0.9, 0.7, pick([0x9a978f, 0x8d8b86]), SPUR_X + (k - 1.5) * 1.15, 0.45, WALK.n - 1.2 + (rand() - 0.5) * 0.4, 0, (rand() - 0.5) * 0.4, 0);
  heap(SPUR_X + 0.5, WALK.n - 3.2, 1.6);
  K.container(B, SPUR_X - 0.4, 0, WALK.n - 5.5, 0.35, CONTAINERS[2]);

  // the checkpoints
  const shackA = buildShack(B, { x0: SHACK_A.x0, x1: SHACK_A.x1, z0: CURB.n + 0.1, z1: CURB.s - 0.1, fill: { n: WALK.n - 0.5, s: WALK.s + 0.8 }, heightAt });
  const shackB = buildShack(B, { x0: SHACK_B.x0, x1: SHACK_B.x1, z0: CURB.n + 0.1, z1: CURB.s - 0.1, fill: { n: WALK.n - 0.5, s: WALK.s + 0.8 }, heightAt });

  for (const BB of [B, H]) {
    BB.finish();
    BB.mergeStatic();
  }

  const room = buildDepotRoom(scene);
  const blocks = [...B.blocks, ...H.blocks, ...room.blocks];
  const colliders = [...B.colliders, ...H.colliders, ...room.colliders];
  const emitters = [...B.emitters, ...H.emitters, ...room.emitters];
  const crushables = [...(B.crushables || []), ...(H.crushables || [])];
  room.bindBlocks(blocks);
  for (const k of [shackA, shackB]) k.bindBlocks(blocks);
  const exitLight = H.emitters[H.emitters.length - 1];

  // inside the hall: the outside hidden, black beyond, the ambient down
  const sky = scene.background;
  const fog = scene.fog;
  const hemi0 = light.hemi.intensity;
  let inside = false;
  function setInside(on) {
    if (on === inside) return;
    inside = on;
    B.root.visible = !on;
    shell.visible = !on;
    scene.background = on ? new THREE.Color(0x07080a) : sky;
    scene.fog = on ? null : fog;
    light.hemi.intensity = on ? hemi0 * 0.9 : hemi0;
  }

  // the wall's state: woken (cameras red, beacons flashing), the door
  // blown (it tips out into the corridor), every turret down
  const wall = { awake: false, blown: 0, blowing: false, boomT: 0 };

  // ---------------------------------------------------- the level script
  const SECTORS = ['The scrapyards', 'The works', 'The factory'];
  const ROADB = { minZ: CURB.n + 0.4, maxZ: CURB.s - 0.4 };
  const B1 = { minX: START_X - 3, maxX: shackA.x0 - 0.8, ...ROADB };
  const B2 = { minX: shackA.x1 + 1.2, maxX: shackB.x0 - 0.8, ...ROADB };
  const B3 = { minX: shackB.x1 + 1.2, maxX: WALL_X - 2.6, minZ: HALL.n + 2.4, maxZ: HALL.s - 2.4 };
  const S = { sector: 0, step: 0, t: 0, turrets: [], waveT: 0 };
  const bounds = { ...B1 };
  const setBounds = (api, b) => api.setBounds(Object.assign(bounds, b));
  const go = (step) => {
    S.step = step;
    S.t = 0;
  };
  const near = (api, shack) => Math.hypot(api.tankPos.x - shack.door.x, api.tankPos.z - shack.door.z);
  const atDoor = (api, shack) => shack.inDoor > 0.6 && near(api, shack) < 5;
  function openShack(api, shack) {
    shack.openIn();
    api.objective('Enter the checkpoint');
    api.arrow(shack.door, 'Checkpoint');
  }
  const PARTS8 = ['era', 'optics', 'rangefinder']; // (its own parts only: campaign.js rewards)
  const ahead = (api, x, lim) => Math.min(Math.max(x, api.tankPos.x + 16), lim);
  const onRoad = (s) => (s < 0 ? CURB.n + 0.8 : CURB.s - 0.8);
  const drone = (api, x, lim, delay = 0) => {
    const ax = ahead(api, x, lim);
    api.spawnDrone(ax, -24, { delay, via: [[ax - 2, -3]] });
  };

  function start(api) {
    Object.assign(S, { sector: 0, step: 0, t: 0, turrets: [], waveT: 0 });
    Object.assign(wall, { awake: false, blown: 0, blowing: false, boomT: 0 });
    setBounds(api, B1);
    api.enableGun();
    api.revealScraps(false);
    api.giveRockets();
    if (api.tank.ability) api.giveAbility();
    api.sectors(SECTORS, 0, 'Level 8');
    api.objective('Into the works');
  }

  // 1: the scrapyards (each wave as the tank gets there)
  function sector1(api) {
    const x = api.tankPos.x;
    if (S.step < 5 && x > shackA.x0 - 9) {
      openShack(api, shackA);
      go(5);
    }
    switch (S.step) {
      case 0:
        if (x > START_X + 8 || S.t > 4) {
          for (const [dz, d] of [[-1, 0], [1, 0.4], [-1, 0.8]]) api.spawnDog(ahead(api, 6, 30), onRoad(dz), { delay: d });
          go(1);
        }
        break;
      case 1:
        if (x > 14) {
          api.spawnWalker(ahead(api, 40, 52), -2);
          for (const [dz, d] of [[1, 0.3], [-1, 0.7]]) api.spawnDog(ahead(api, 36, 50), onRoad(dz), { delay: d });
          drone(api, 42, 56, 1.2);
          go(2);
        }
        break;
      case 2:
        if (x > 44) {
          for (const [dz, d] of [[-1, 0], [1, 0.3], [-1, 0.6], [1, 0.9]]) api.spawnDog(ahead(api, 66, 80), onRoad(dz), { delay: d });
          api.spawnWalker(ahead(api, 72, 84), 2, { delay: 0.6 });
          go(3);
        }
        break;
      case 3:
        if (x > 64) {
          api.spawnWalker(ahead(api, 82, 86), -2);
          drone(api, 80, 86, 0.6);
          drone(api, 82, 86, 1.4);
          go(4);
        }
        break;
      case 4:
        if (api.enemiesAlive === 0 && S.t > 1.5) {
          openShack(api, shackA);
          go(5);
        }
        break;
      case 5:
        if (atDoor(api, shackA)) {
          go(6);
          if (api.enemiesAlive) api.clearEnemies();
          api.depot(shackA, { offers: PARTS8, count: 3, onLeave: () => startSector2(api) });
        }
        break;
    }
  }

  // 2: the works
  function startSector2(api) {
    S.sector = 1;
    go(0);
    setBounds(api, B2);
    api.sectors(SECTORS, 1, 'Level 8');
    api.objective('To the factory');
  }
  function sector2(api) {
    const x = api.tankPos.x;
    if (S.step < 5 && x > shackB.x0 - 9) {
      openShack(api, shackB);
      go(5);
    }
    switch (S.step) {
      case 0:
        if (x > SHACK_A.x1 + 4 || S.t > 3) {
          for (const [dz, d] of [[-1, 0], [1, 0.4], [1, 0.8]]) api.spawnDog(ahead(api, 116, 124), onRoad(dz), { delay: d });
          api.spawnWalker(ahead(api, 122, 130), -2, { delay: 0.6 });
          go(1);
        }
        break;
      case 1:
        if (x > 118) {
          // an artillery drone up the spur, in the works' gateway
          api.spawnArty(SPUR_X + 4, -2, { yaw: Math.PI, hpScale: 0.21 });
          for (const [dz, d] of [[-1, 0.3], [1, 0.7]]) api.spawnDog(ahead(api, 140, 150), onRoad(dz), { delay: d });
          drone(api, 142, 152, 1);
          go(2);
        }
        break;
      case 2:
        if (x > 142) {
          api.spawnWalker(ahead(api, 160, 170), 2);
          api.spawnWalker(ahead(api, 164, 174), -2, { delay: 0.5 });
          for (const [dz, d] of [[-1, 0.2], [1, 0.6], [-1, 1]]) api.spawnDog(ahead(api, 158, 170), onRoad(dz), { delay: d });
          go(3);
        }
        break;
      case 3:
        if (x > 164) {
          for (const [dz, d] of [[1, 0], [-1, 0.3], [1, 0.6], [-1, 0.9]]) api.spawnDog(ahead(api, 180, 186), onRoad(dz), { delay: d });
          drone(api, 178, 186, 0.8);
          go(4);
        }
        break;
      case 4:
        if (api.enemiesAlive === 0 && S.t > 1.5) {
          openShack(api, shackB);
          go(5);
        }
        break;
      case 5:
        if (atDoor(api, shackB)) {
          go(6);
          if (api.enemiesAlive) api.clearEnemies();
          api.depot(shackB, { offers: PARTS8, count: 2, onLeave: () => startSector3(api) });
        }
        break;
    }
  }

  // 3: the factory, and the defence wall
  // its boss bar: every turret's HP together
  const grid = {
    name: 'Defense system',
    hardened: true, // (each turret toughened on Hard itself, below)
    get alive() {
      return S.turrets.some((e) => e.alive);
    },
    get hp() {
      return S.turrets.reduce((a, e) => a + (e.alive ? Math.max(0, e.hp) : 0), 0);
    },
    set hp(v) {},
    get maxHp() {
      return S.turrets.reduce((a, e) => a + e.maxHp, 0) || 1;
    },
    set maxHp(v) {},
  };
  function startSector3(api) {
    S.sector = 2;
    go(0);
    setBounds(api, B3);
    api.sectors(SECTORS, 2, 'Level 8');
    api.objective('Through the factory');
  }
  function wakeWall(api) {
    wall.awake = true;
    const T = [
      // two beam cannons low down, either side; machine guns on the rail above
      { heavy: true, slide: { mid: -10, amp: 3, speed: 0.4, phase: 0 } },
      { heavy: true, slide: { mid: 9, amp: 3, speed: 0.4, phase: Math.PI } },
      { heavy: false, slide: { mid: -6, amp: 6, speed: 0.35, phase: 0.6 } },
      { rockets: true, slide: { mid: 5, amp: 6, speed: 0.3, phase: 2.4 } },
    ];
    if (api.run.hard) T.push({ heavy: false, slide: { mid: 0, amp: 10, speed: 0.28, phase: 1.2 } });
    S.turrets = T.map((o, i) => api.spawnWallTurret(WALL_X - 1.1, o.slide.mid, { heavy: o.heavy, rockets: o.rockets, slide: o.slide, delay: 0.4 + i * 0.35 }));
    if (api.run.hard) for (const e of S.turrets) e.hp = e.maxHp = Math.round(e.maxHp * 1.35);
    api.boss(grid, 'Defense system');
    api.objective('Destroy the defense system');
    api.spotlight({ targets: [() => new THREE.Vector3(WALL_X, 4, 0)], r: 200 }, () => S.t > 2.4, { maxTime: 2.8, frame: () => new THREE.Vector3(WALL_X - 4, 0, 0), frameK: 1 });
    S.waveT = 10;
  }
  function sector3(api, dt) {
    const x = api.tankPos.x;
    switch (S.step) {
      case 0:
        if (x > HALL.x0 + 4) {
          // the line's guards: off the belts
          for (const [z, d] of [[-7.5, 0], [7.5, 0.4], [-7.5, 0.8], [7.5, 1.2]]) api.spawnDog(HALL.x0 + 22 + d * 4, z, { delay: d });
          go(1);
        }
        break;
      case 1:
        if (x > HALL.x0 + 16) {
          wakeWall(api);
          go(2);
        }
        break;
      case 2:
        // dogs out of the side hatches now and then while the wall's up
        S.waveT -= dt;
        if (grid.alive && S.waveT <= 0 && api.enemiesAlive < S.turrets.filter((e) => e.alive).length + 3) {
          S.waveT = 16;
          for (const [z, d] of [[HALL.n + 3, 0], [HALL.s - 3, 0.5]]) api.spawnDog(WALL_X - 4, z, { delay: d });
        }
        if (!grid.alive && S.t > 0.5) {
          wall.blowing = true;
          wall.boomT = 0;
          api.objective('');
          go(3);
        }
        break;
      case 3:
        // the blasts run along the wall, then the door goes
        if (wall.blown > 0.9) {
          api.clearEnemies();
          const i = blocks.indexOf(doorBlock);
          if (i >= 0) blocks.splice(i, 1);
          setBounds(api, { maxX: HALL.x1 + 40, minZ: -DOOR.half + 1, maxZ: DOOR.half - 1 });
          api.objective('Out through the wall');
          api.arrow(new THREE.Vector3(WALL_X + 1, 2, DOOR.z), 'Exit');
          api.cameraTo(new THREE.Vector3(WALL_X + 2, 0, DOOR.z), 2);
          go(4);
        }
        break;
      case 4:
        if (x > WALL_X + 2) {
          api.arrow(null);
          api.sectors(SECTORS, 3, 'Level 8');
          api.win('Level clear', { path: [[HALL.x1 + 8, DOOR.z], [HALL.x1 + 40, DOOR.z]] });
          go(5);
        }
        break;
    }
  }

  function skipStage(api) {
    if (S.sector === 2 && S.step === 2 && grid.alive) {
      api.clearSpot();
      for (const e of S.turrets) if (e.alive) api.blast(e.pos.clone().setY(e.stats.aimY), 0.5, 99999);
      return true;
    }
    api.clearSpot();
    api.arrow(null);
    api.clearPrompt();
    api.clearEnemies();
    if (S.sector < 2) {
      const shack = S.sector === 0 ? shackA : shackB;
      setBounds(api, ROADB);
      api.teleport(shack.door.x - 7, shack.door.z, 0);
      openShack(api, shack);
      go(5);
      return true;
    }
    return false;
  }

  function script(api, dt) {
    S.t += dt;
    if (api.run.mode !== 'field') return;
    if (S.sector === 0) sector1(api);
    else if (S.sector === 1) sector2(api);
    else sector3(api, dt);
  }

  const camAim = new THREE.Vector3();
  function update(dt, t, ctx = {}) {
    B.update(dt, t, ctx);
    H.update(dt, t, ctx);
    for (const k of [shackA, shackB]) k.update(dt, t);
    room.update(dt, t, ctx);
    // the cameras follow the tank once the wall's awake; red light bars
    // pulse; then the wall comes apart: blasts along it, the door tipping
    // out, light from the corridor beyond
    if (ctx.api && wall.awake && !wall.blowing) {
      const p = ctx.api.tankPos;
      for (const c of cams) {
        camAim.set(p.x, 0.8, p.z);
        const yaw = Math.atan2(-(camAim.z - c.head.position.z), camAim.x - c.head.position.x);
        c.head.rotation.y = yaw - Math.PI;
        c.head.rotation.z = Math.atan2(c.head.position.y - 0.8, c.head.position.x - camAim.x) * 0.6;
      }
      for (const b of beacons) b.visible = Math.sin(t * 6) > -0.2;
    }
    if (wall.blowing) {
      wall.boomT += dt;
      if (ctx.combat && wall.boomT < 2.2 && rand() < dt * 9) {
        const at = new THREE.Vector3(WALL_X - 0.4, 1 + rand() * (HALL_H - 2), HALL.n + 1 + rand() * (WID - 2));
        ctx.combat.explode(at);
        ctx.combat.shake = Math.max(ctx.combat.shake, 0.5);
      }
      if (wall.boomT > 1.8) {
        if (wall.blown === 0 && ctx.combat) {
          for (let i = 0; i < 4; i++) ctx.combat.explode(new THREE.Vector3(WALL_X, 1 + rand() * 4, DOOR.z + (rand() - 0.5) * DOOR.half * 2));
          ctx.combat.shake = Math.max(ctx.combat.shake, 1.0);
          for (const c of cams) c.eye.visible = false;
          for (const b of beacons) b.visible = false;
        }
        wall.blown = Math.min(1, wall.blown + dt * 1.4);
        const e = wall.blown * wall.blown;
        door.rotation.z = -e * (Math.PI / 2 - 0.08); // tipping out, away from the tank
        door.position.x = WALL_X + 0.6 + e * 1.4;
        exitLight.level = wall.blown;
      }
    }
    if (ctx.api) {
      setInside(S.sector === 2 && ctx.api.run.mode === 'field');
      script(ctx.api, dt);
    }
  }

  return {
    light,
    skirt: 0x6a5f4c,
    colliders,
    blocks,
    emitters,
    crushables,
    depotRoom: room,
    heightAt,
    spawn: { x: START_X + 5, z: -0.5, yaw: 0 },
    bounds,
    script: S,
    shacks: [shackA, shackB],
    start,
    update,
    skipStage,
  };
}
