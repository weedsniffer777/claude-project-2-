// Level 6: the city gates, at winter dusk. The last streets of the city,
// out to the great wall round it and through its gate. The low sun is
// behind the far side again, as on the first day: the street in the
// blocks' long shadow, light spilling through the gaps.
//
// Layout (world +X runs bottom-left to top-right on screen):
//  1 The ring road: panel blocks on the far side with alleys between them
//    (the sun comes through them in shafts), garages and heat pipes on the
//    near side, lamps and trolley wires; a signalled crossroads, its side
//    streets barricaded. A checkpoint across the road at its end.
//  2 The wall district: older brick works and warehouses, the wall looming
//    ahead over the roofs; the road fortified, tank traps across it in
//    staggered rows, sandbag nests, a heavy gun dug in. A checkpoint.
//  3 The gate: out onto the paved square inside the wall. The wall right
//    across, its two gate towers, the gate shut. The gunship comes in over
//    the wall. Bring it down; the gate swings open onto the open country
//    beyond, the last light on the snow; out.
import * as THREE from 'three';
import { addDusk, DUSK_SUN } from '../render/setup.js';
import { box, cyl, put, toon, gradientMap, setLowPoly } from '../models/kit.js';
import { LevelBuilder, canvas, tex, blob, speckle } from './builder.js';
import * as P from './props.js';
import { buildShack } from './depot.js';
import { buildDepotRoom } from './depotRoom.js';
import { rails } from './rails.js';
import { sidewalkTexture, glyphSign, mapMat } from './cityTextures.js';
import { cityKit, CONCRETE, BURNT_PAINT, CONTAINERS } from './cityKit.js';
import { streetKit } from './streetKit.js';

const GPX = 5;
const MAP = { x0: -70, x1: 340, z0: -72, z1: 60 };
const START_X = -30;
const CURB = { n: -7.5, s: 6.5 };
const WALK = { n: -10, s: 9 };
const SW = 0.16;
const CROSS = { x0: 30, x1: 42 }; // the crossroads on the ring road
const CROSS_Z = 22;
const SHACK_A = { x0: 96, x1: 103.6 };
const SHACK_B = { x0: 196, x1: 203.6 };
const PLAZA = { x0: 206, z: 28 }; // the square inside the wall
const WALL_X = 262; // the wall's inner face
const WALL_T = 6; // its thickness
const WALL_H = 12;
const GATE = { z: -0.5, half: 5 }; // the gateway through it
const TOWER = 9; // the gate towers' size
const SUN = 0xffc98a;

const inCross = (x) => x > CROSS.x0 && x < CROSS.x1;
const inPlaza = (x) => x > PLAZA.x0;
function heightAt(x, z) {
  if (inPlaza(x) || inCross(x)) return 0;
  return z <= CURB.n || z >= CURB.s ? SW : 0;
}
// where a sun ray through p lands at height h
const SUN_DIR = DUSK_SUN.clone().negate().normalize();
const toGround = (p, h = 0) => {
  const t = (p.y - h) / -SUN_DIR.y;
  return new THREE.Vector3(p.x + SUN_DIR.x * t, h, p.z + SUN_DIR.z * t);
};
// an additive light volume between a polygon in the air and its sun
// projection on the ground: bright where it enters, fading down
function sunVolume(B, top, opacity) {
  const bottom = top.map((p) => toGround(p, 0.03));
  const pos = [];
  const col = [];
  for (let i = 0; i < top.length; i++) {
    const a = top[i];
    const b = top[(i + 1) % top.length];
    const c = bottom[(i + 1) % top.length];
    const d = bottom[i];
    for (const [p, k] of [[a, 1], [b, 1], [c, 0.15], [a, 1], [c, 0.15], [d, 0.15]]) {
      pos.push(p.x, p.y, p.z);
      col.push(k, k, k);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  B.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: SUN, vertexColors: true, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })));
}

// The ground: snowy sidewalks, wet asphalt, the cross street; the square's
// old stone setts in fans, frozen puddles; outside the wall the open
// country, snow over fields, the road on out.
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
  rect(MAP.x0, MAP.z0, MAP.x1, MAP.z1, '#b4b8be');
  speckle(g, W, H, ['#a7abb1', '#c2c6cb', '#9c9fa5'], W * H * 0.02, rand);
  const asphalt = [
    [MAP.x0, CURB.n, PLAZA.x0, CURB.s],
    [CROSS.x0 + 2, MAP.z0, CROSS.x1 - 2, MAP.z1],
  ];
  for (const [x0, z0, x1, z1] of asphalt) {
    rect(x0, z0, x1, z1, '#55565b');
    speckle(g, X(x1) - X(x0), Z(z1) - Z(z0), ['#5f6065', '#4b4c51', '#66666b'], (X(x1) - X(x0)) * (Z(z1) - Z(z0)) * 0.05, rand, Z(z0), X(x0));
    const n = ((x1 - x0) * (z1 - z0)) / 2.5;
    for (let i = 0; i < n; i++) {
      const x = x0 + rand() * (x1 - x0);
      const z = z0 + 0.3 + rand() * (z1 - z0 - 0.6);
      const nearEdge = Math.min(z - z0, z1 - z) < 1.3;
      g.fillStyle = nearEdge ? (rand() < 0.5 ? '#a9a8a6' : '#9a9996') : rand() < 0.5 ? '#7f7d77' : '#6f6d68';
      blob(g, X(x), Z(z), (0.5 + rand() * 1.3) * GPX, (0.35 + rand() * 0.6) * GPX, rand, 9);
    }
  }
  g.fillStyle = '#c9c6bd';
  for (const x of [CROSS.x0 + 0.6, CROSS.x1 - 2.4])
    for (let z = CURB.n + 0.6; z < CURB.s - 0.6; z += 1.1) for (let k = 0; k < 9; k++) if (rand() > 0.15) g.fillRect(X(x) + k * 2, Z(z), 2, 0.55 * GPX);
  g.fillStyle = '#aaa79e';
  for (let x = MAP.x0; x < PLAZA.x0; x += 1) if (rand() > 0.45 && !inCross(x)) g.fillRect(X(x), Z(-0.6), GPX, 2);
  // the square: stone setts laid in fans, grey and buff, snow in the joints
  rect(PLAZA.x0, -PLAZA.z - 6, WALL_X, PLAZA.z + 6, '#8a8780');
  for (let x = PLAZA.x0; x < WALL_X; x += 3)
    for (let z = -PLAZA.z - 6; z < PLAZA.z + 6; z += 3) {
      for (let k = 0; k < 5; k++) {
        const a = Math.PI * (0.15 + k * 0.18);
        g.fillStyle = rand() < 0.5 ? '#7a776f' : '#95918a';
        g.beginPath();
        g.arc(X(x + 1.5), Z(z + 3), (1.2 + k * 0.35) * GPX, Math.PI + a - 0.2, Math.PI + a + 0.2);
        g.lineTo(X(x + 1.5), Z(z + 3));
        g.fill();
      }
    }
  speckle(g, X(WALL_X) - X(PLAZA.x0), Z(PLAZA.z + 6) - Z(-PLAZA.z - 6), ['#d6d9dd', '#c4c8cc', '#6f6c66'], (X(WALL_X) - X(PLAZA.x0)) * (Z(PLAZA.z + 6) - Z(-PLAZA.z - 6)) * 0.04, rand, Z(-PLAZA.z - 6), X(PLAZA.x0));
  for (let i = 0; i < 40; i++) {
    g.fillStyle = rand() < 0.5 ? 'rgba(160,180,200,0.35)' : 'rgba(40,40,44,0.3)';
    blob(g, X(PLAZA.x0 + rand() * (WALL_X - PLAZA.x0)), Z((rand() - 0.5) * PLAZA.z * 2), (0.8 + rand() * 2) * GPX, (0.5 + rand() * 1.2) * GPX, rand, 10);
  }
  // the old road through the gateway and on out over the fields
  rect(WALL_X - 4, GATE.z - 4, MAP.x1, GATE.z + 4, '#6a6964');
  speckle(g, X(MAP.x1) - X(WALL_X - 4), 8 * GPX, ['#74736d', '#605f5a', '#d0d3d8'], (X(MAP.x1) - X(WALL_X - 4)) * 8 * GPX * 0.08, rand, Z(GATE.z - 4), X(WALL_X - 4));
  // the fields: snow, darker furrows showing through, hedges
  for (let i = 0; i < 260; i++) {
    g.fillStyle = rand() < 0.5 ? '#c6cacf' : '#a9aaa4';
    blob(g, X(WALL_X + WALL_T + rand() * (MAP.x1 - WALL_X)), Z(MAP.z0 + rand() * (MAP.z1 - MAP.z0)), (1 + rand() * 4) * GPX, (0.4 + rand() * 1.2) * GPX, rand, 9);
  }
  g.fillStyle = 'rgba(90,85,70,0.25)';
  for (let z = MAP.z0; z < MAP.z1; z += 2.4) if (Math.abs(z - GATE.z) > 5) g.fillRect(X(WALL_X + WALL_T + 8), Z(z), X(MAP.x1) - X(WALL_X + WALL_T + 8), 2);
  return tex(c);
}

export const gates = {
  id: 'gates',
  name: 'Level 6 · City gates',
  build(scene) {
    setLowPoly(true);
    try {
      return buildGates(scene);
    } finally {
      setLowPoly(false);
    }
  },
};

function buildGates(scene) {
  const B = new LevelBuilder(scene, 6061);
  const rand = B.rand;
  const light = addDusk(scene, { shadowSize: 22, shadowMap: 2048 });
  const K = cityKit(B, { WALK, SW, heightAt });
  const sign = (w, h, o = {}) => mapMat(glyphSign(w, h, { rand, ...o }));
  const ST = streetKit(B, { CURB, WALK, SW, heightAt, sign });
  const junk = (fn, scrap = 0) => B.crushable(fn, { kind: 'prop', scrap });
  const wreck = (x, z, yaw, o) => B.crushable(() => P.car(B, x, z, yaw, o), { kind: 'car', scrap: 2 });

  // ------------------------------------------------------------ ground
  {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(MAP.x1 - MAP.x0, MAP.z1 - MAP.z0), new THREE.MeshToonMaterial({ map: groundTexture(rand), gradientMap }));
    m.rotation.x = -Math.PI / 2;
    m.position.set((MAP.x0 + MAP.x1) / 2, 0, (MAP.z0 + MAP.z1) / 2);
    m.receiveShadow = true;
    B.add(m);
    B.solid(m);
  }
  const walkTex = sidewalkTexture(rand);
  const curbMat = toon(0x9a9893);
  function slab(x0, x1, z0, z1) {
    const t = walkTex.clone();
    t.needsUpdate = true;
    t.repeat.set((x1 - x0) / 3.2, (z1 - z0) / 3.2);
    const top = new THREE.MeshToonMaterial({ map: t, gradientMap });
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, SW, z1 - z0), [curbMat, curbMat, top, curbMat, curbMat, curbMat]);
    m.position.set((x0 + x1) / 2, SW / 2, (z0 + z1) / 2);
    m.receiveShadow = true;
    B.add(m);
    B.solid(m);
  }
  for (const [x0, x1] of [[MAP.x0, CROSS.x0], [CROSS.x1, PLAZA.x0]]) {
    slab(x0, x1, -34, CURB.n);
    slab(x0, x1, CURB.s, 34);
  }
  for (const [z, dir] of [[CURB.n - 0.35, -1], [CURB.s + 0.35, 1]]) {
    for (let x = START_X - 2; x < PLAZA.x0 - 2; x += 0.55) {
      if (inCross(x) || (x > SHACK_A.x0 - 1 && x < SHACK_A.x1 + 1) || (x > SHACK_B.x0 - 1 && x < SHACK_B.x1 + 1)) continue;
      if (rand() < 0.12) x += 2;
      B.lump(x, SW, z + dir * rand() * 0.25, 0.5 + rand() * 0.4, 0.2 + rand() * 0.18, 0.35 + rand() * 0.2, rand() < 0.3 ? 0xa9aaac : 0xc7cacf, rand() * 3);
    }
  }
  for (let i = 0; i < 420; i++) {
    const x = START_X + rand() * (PLAZA.x0 - START_X);
    const z = WALK.n + rand() * (WALK.s - WALK.n);
    const s = 0.08 + rand() * 0.22;
    B.piece(s * (1 + rand()), s * 0.6, s, rand() < 0.25 ? 0x7a5e50 : CONCRETE[(rand() * 5) | 0], x, heightAt(x, z) + s * 0.25, z, rand(), rand() * 3, rand());
  }
  {
    const R = rails(B, rand);
    for (const z of [-2.25, 1.55]) R.track(R.straight(START_X - 1, z, WALL_X + WALL_T + 30, z));
  }
  // behind the start: a heap across the road
  for (let z = -14; z < 16; z += 2.6) K.rubble(B, START_X - 3.5 + (rand() - 0.5) * 1.5, z + (rand() - 0.5), 2.6 + rand() * 1.2, 2.4 + rand() * 1.6, { slabs: 3 });
  B.block(START_X - 3.5, 0.5, 2.2, 22);

  // ===================================================== 1: the ring road
  // far side: tall panel blocks, alleys between them; the low sun comes
  // down through the alleys in shafts across the road
  const ALLEYS = [[12, 16], [58, 62], [80, 83]];
  K.building({ x0: -64, x1: ALLEYS[0][0], floors: 9, shop: true });
  K.building({ x0: ALLEYS[0][1], x1: CROSS.x0, floors: 8, sign: '#ffcf8a' });
  K.building({ x0: CROSS.x1, x1: ALLEYS[1][0], floors: 9, shop: true, mural: true });
  K.works({ x0: ALLEYS[1][1], x1: ALLEYS[2][0], zf: WALK.n, roof: 'saw', wall: 0x8a9a8e, doors: 2 });
  K.building({ x0: ALLEYS[2][1], x1: SHACK_A.x0, floors: 8, holes: 2 });
  for (const [a, b] of ALLEYS) {
    const top = WALL_H + 12;
    sunVolume(B, [new THREE.Vector3(a, top, WALK.n - 13), new THREE.Vector3(b, top, WALK.n - 13), new THREE.Vector3(b, 0.2, WALK.n - 1), new THREE.Vector3(a, 0.2, WALK.n - 1)].map((p) => p), 0.06);
    // its patch on the road: the light lands in a long slanting strip
    const pts = [new THREE.Vector3(a, 22, WALK.n - 6), new THREE.Vector3(b, 22, WALK.n - 6)].map((p) => toGround(p, 0.03));
    const strip = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a, 0.04, WALK.n), new THREE.Vector3(b, 0.04, WALK.n), pts[1].setY(0.04), new THREE.Vector3(a, 0.04, WALK.n), pts[1], pts[0].setY(0.04)]);
    B.add(new THREE.Mesh(strip, new THREE.MeshBasicMaterial({ color: SUN, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
    // the alley itself: bins and a fence across its back
    junk(() => P.bin(B, (a + b) / 2, SW, WALK.n - 2, { tipped: rand() < 0.5 }), 1);
    P.fence(B, a, b, SW, WALK.n - 11);
  }
  // near side: low, garages, heat pipes, a pipe arch, kiosk and shelter
  ST.garages(-62, 10, WALK.s + 4);
  ST.pipes(START_X - 2, CROSS.x0 - 1);
  ST.pipeArch(6);
  ST.pipes(CROSS.x1 + 1, SHACK_A.x0 - 0.5);
  K.southBlock(-30, -10, 2, WALK.s + 4.5);
  ST.ruinedWall(46, 58, WALK.s + 6);
  ST.garages(64, 7, WALK.s + 4);
  ST.kiosk(20, WALK.s - 0.7);
  ST.shelter(52, WALK.n + 1.1, 1);
  ST.barrelFire(-8, WALK.n + 1.2);
  ST.barrelFire(74, WALK.s + 4.2);
  for (const [x, z, h] of [[-22, WALK.s + 3.5, 4.2], [-18, WALK.s + 4.2, 3.6], [24, WALK.s + 3.4, 4.4], [70, WALK.s + 3.4, 3.8]]) ST.birch(x, z, h);
  for (const [x, ry] of [[-14, 0.2], [48, -0.3], [90, 0.3]]) ST.fallenSlab(x, ry);
  P.billboard(B, 4, WALK.s + 9, 0.15, (w, h) => sign(w, h, { board: '#4f5b62', ink: '#c6bfa8' }));
  P.billboard(B, 84, WALK.s + 9.5, -0.2, (w, h) => sign(w, h, { board: '#5d5546', ink: '#9fb5b3' }));
  ST.lights({ xs: [-26, -12, 2, 16, 48, 62, 76, 90], skip: (x, side) => (side < 0 && ALLEYS.some(([a, b]) => x > a - 1 && x < b + 1)) });
  ST.signal(CROSS.x0 - 1, CURB.s + 0.5, -1, 'cycle');
  ST.signal(CROSS.x1 + 1, CURB.n - 0.5, 1, 'blink');
  ST.clutter(START_X + 4, SHACK_A.x0 - 2, 8, (x) => inCross(x) || inCross(x - 2) || inCross(x + 2) || ALLEYS.some(([a, b]) => x > a - 1 && x < b + 1) || (x > 18 && x < 22) || (x > 50 && x < 54));
  // the crossroads' side streets: barricaded a little way up
  for (const s of [-1, 1]) {
    for (let x = CROSS.x0 + 0.5; x < CROSS.x1; x += 2.2) {
      if (rand() < 0.6) K.jersey(B, x + 0.6, s * CROSS_Z, (rand() - 0.5) * 0.3, 0.9, 2);
      else K.rubble(B, x + 0.6, s * (CROSS_Z + 0.4), 1.4, 1.1, { slabs: 1 });
    }
    B.block((CROSS.x0 + CROSS.x1) / 2, s * CROSS_Z, (CROSS.x1 - CROSS.x0) / 2, 0.8);
    if (s < 0) K.building({ x0: CROSS.x0 - 18, x1: CROSS.x1 + 18, zf: -CROSS_Z - 5, floors: 9 });
    else K.southBlock(CROSS.x0 - 18, CROSS.x1 + 18, 2, CROSS_Z + 5);
  }
  // wrecks: a trolleybus burnt out across the crossing, cars
  P.tram(B, 36, -2.25, 0.18, { trailer: true, tilt: 0.05 });
  wreck(-12, -1.5, 0.35, { kind: 'sedan', paint: BURNT_PAINT[0] });
  wreck(6, 4.4, 0.3, { kind: 'hatch', paint: BURNT_PAINT[1], flipped: true });
  wreck(22, -5.2, -0.35, { kind: 'sedan', paint: BURNT_PAINT[2] });
  wreck(54, 4.6, 0.55, { kind: 'van', paint: 0x6b7458 });
  wreck(70, -4.6, 1.4, { kind: 'sedan', paint: BURNT_PAINT[3] });
  wreck(86, 4.8, -1.7, { kind: 'sedan', paint: BURNT_PAINT[5], flipped: true });
  K.rubble(B, 28, 5.2, 1.6, 1.2, { slabs: 2 });
  K.rubble(B, 78, -5.6, 1.8, 1.3, { slabs: 2 });

  // ================================================ 2: the wall district
  // older brick: warehouses and works on both sides, the near side low;
  // the road fortified: rows of tank traps across it with a lane left
  // through each (staggered), sandbag nests, a heavy gun dug in
  K.works({ x0: SHACK_A.x1, x1: 128, zf: WALK.n, roof: 'gable', wall: K.BRICK, tin: false, doors: 2, H: 6 });
  K.works({ x0: 131, x1: 152, zf: WALK.n, roof: 'flat', wall: 0x7a4e3c, tin: false, doors: 3, dock: true, H: 6.5 });
  K.building({ x0: 155, x1: 176, floors: 6, panel: '#9a8a78', accent: '#7a5a44' });
  K.works({ x0: 179, x1: SHACK_B.x0, zf: WALK.n, roof: 'saw', wall: K.BRICK, tin: false, doors: 2, H: 6 });
  K.works({ x0: SHACK_A.x1, x1: 124, zf: WALK.s + 0.3, side: 's', roof: 'flat', wall: 0x7a4e3c, tin: false, doors: 2 });
  ST.ruinedWall(127, 140, WALK.s + 5);
  ST.garages(143, 6, WALK.s + 4);
  K.works({ x0: 164, x1: 184, zf: WALK.s + 0.3, side: 's', roof: 'gable', wall: K.BRICK, tin: false, doors: 1 });
  ST.pipes(186, SHACK_B.x0 - 0.5);
  ST.lights({ xs: [110, 124, 138, 152, 166, 180, 192], wires: false });
  ST.barrelFire(134, WALK.n + 1.2);
  ST.barrelFire(172, WALK.s - 1.2);
  ST.clutter(SHACK_A.x1 + 3, SHACK_B.x0 - 3, 11);
  // tank traps: rows across the road, each with a gap (staggered)
  const hedgehog = (x, z, yaw) => {
    for (const [rx, rz] of [[0.8, 0], [-0.8, 0], [0, 1.57]]) B.piece(1.9, 0.18, 0.18, 0x4a4c50, x, 0.6, z, rx, yaw + 0.8 + rz, 0.7 * Math.sign(rx || 1));
    B.lump(x, 0.05, z, 0.5, 0.08, 0.5, 0xd6d9dd);
    B.block(x, z, 0.75, 0.75, yaw);
  };
  for (const [x, gap] of [[118, 2.5], [146, -3], [170, 1.5]]) {
    for (let z = CURB.n + 0.5; z < CURB.s - 0.5; z += 2.1) if (Math.abs(z - gap) > 2.4) hedgehog(x + (rand() - 0.5) * 0.6, z, rand());
  }
  // sandbag nests either side
  const bags = (x, z, len, yaw, layers = 3) => {
    const c = Math.cos(yaw);
    const sn = Math.sin(yaw);
    for (let k = 0; k < layers; k++)
      for (let i = 0; i < len / 0.5; i++) {
        const u = -len / 2 + 0.25 + i * 0.5 + (k % 2) * 0.12;
        if (u > len / 2 - 0.2) continue;
        B.piece(0.52, 0.22, 0.34, k % 2 ? 0x8a7b5c : 0x7f7254, x + c * u, heightAt(x, z) + 0.11 + k * 0.21, z - sn * u, 0, yaw + (rand() - 0.5) * 0.1, 0);
      }
    B.block(x, z, len / 2, 0.3, yaw);
    B.hitBox(x, 0.35, z, len, 0.7, 0.6, yaw);
  };
  for (const [x, z, l, y] of [[124, -5, 4, 0.2], [140, 4.5, 4, -0.3], [158, -4.5, 5, 0.1], [178, 5, 4, 0.4]]) bags(x, z, l, y);
  wreck(112, -4, 0.6, { kind: 'van', paint: 0x6b7458 });
  wreck(152, 4.6, -0.4, { kind: 'hatch', paint: BURNT_PAINT[2] });
  B.crushable(() => P.bus(B, 162, -3.6, 0.3), { kind: 'prop', heavy: true, armored: true });
  // the wall above the roofs ahead: its line all along (built below)

  // ========================================================= 3: the gate
  // The square: open, paved, ringed by the backs of low buildings and the
  // wall itself; tank traps scattered, lamp standards, a statue's plinth
  // (no statue), the customs booths by the gate, a burnt lorry.
  {
    // its sides: low blocks and fences, closing it in
    for (const s of [-1, 1]) {
      const z = s * (PLAZA.z + 1);
      for (let x = PLAZA.x0 + 1; x < WALL_X - 2; x += 8 + rand() * 4) {
        if (s > 0) ST.garages(x, 2, z);
        else K.works({ x0: x, x1: Math.min(WALL_X - 2, x + 10), zf: z, roof: ['flat', 'gable'][(rand() * 2) | 0], wall: [K.BRICK, 0x8a9a8e][(rand() * 2) | 0], tin: rand() < 0.5, doors: 1, H: 4.6 });
      }
      B.block((PLAZA.x0 + WALL_X) / 2, z + s * 2, (WALL_X - PLAZA.x0) / 2, 2.5);
      // the square's corners off the street: walls from the street's
      // blocks out to the square's sides
      put(B.root, box(1, 3, PLAZA.z - WALK.s, 0x7d7a73, { r: 0.02 }), PLAZA.x0 - 0.5, 1.5, s * (WALK.s + (PLAZA.z - WALK.s) / 2)).castShadow = true;
      B.block(PLAZA.x0 - 0.5, s * (WALK.s + (PLAZA.z - WALK.s) / 2), 0.5, (PLAZA.z - WALK.s) / 2);
    }
    for (let i = 0; i < 9; i++) hedgehog(PLAZA.x0 + 10 + rand() * 40, (rand() - 0.5) * PLAZA.z * 1.6, rand() * 3);
    // the plinth
    put(B.root, box(4, 1.8, 4, 0x8d8b86, { r: 0.05 }), 232, 0.9, -12);
    put(B.root, box(3.2, 0.4, 3.2, 0x7d7a73, { r: 0.05 }), 232, 2.0, -12);
    B.lump(232, 2.25, -12, 1.4, 0.12, 1.4, 0xd6d9dd);
    B.block(232, -12, 2, 2);
    // lamp standards round the square: tall, a cluster of globes each
    for (const [x, z] of [[214, -18], [214, 18], [242, -20], [242, 20], [254, -10], [254, 10]]) {
      put(B.root, cyl(0.14, 7.5, 0x45484c, { seg: 8, radiusEnd: 0.2 }), x, 3.75, z).castShadow = true;
      for (const [dx, dz] of [[0.5, 0], [-0.5, 0], [0, 0.5]]) put(B.root, cyl(0.2, 0.32, rand() < 0.3 ? 0x2a2b2e : 0xffc890, { seg: 8, glow: true }), x + dx, 7.4, z + dz);
      B.emit(new THREE.Vector3(x, 6.4, z), 0xffb060, 16, 11);
      B.pool(x, z, 3.4, 0xffa245, 0.2);
      B.block(x, z, 0.25, 0.25);
    }
    // the customs booths: two little huts by the gate, striped barrier arms
    for (const s of [-1, 1]) {
      const z = GATE.z + s * (GATE.half + 4);
      const hut = put(B.root, box(2.4, 2.6, 2.4, 0x6f7f74, { r: 0.05 }), WALL_X - 6, 1.3, z);
      hut.castShadow = true;
      B.solid(hut);
      put(B.root, box(2.6, 0.12, 2.6, 0x3e4043, { r: 0.02 }), WALL_X - 6, 2.66, z);
      put(B.root, box(0.05, 0.9, 1.8, 0xffd9a0, { glow: true }), WALL_X - 7.23, 1.6, z);
      B.emit(new THREE.Vector3(WALL_X - 8, 1.8, z), 0xffd9a0, 6, 5);
      B.block(WALL_X - 6, z, 1.2, 1.2);
      const arm = put(B.root, box(0.12, 0.12, GATE.half + 1, 0xd8d2c0), WALL_X - 6, 1.1, z - s * (GATE.half / 2 + 1.4));
      arm.rotation.x = s * 0.15;
      for (let k = 0; k < 4; k++) put(B.root, box(0.14, 0.14, 0.5, 0xc42a20), WALL_X - 6, 1.1, z - s * (1.6 + k * 1.2));
    }
    K.container(B, 222, 0, 20, 0.3, CONTAINERS[1]);
    K.container(B, 248, 0, -22, -0.2, CONTAINERS[3]);
    B.crushable(() => P.car(B, 236, 14, 0.8, { kind: 'van', paint: 0x5d6b80 }), { kind: 'car', scrap: 2 });
    for (const [x, z, l, y] of [[226, -6, 5, 0.3], [244, 7, 5, -0.2], [250, -16, 4, 1.2]]) bags(x, z, l, y);
    for (let i = 0; i < 160; i++) {
      const x = PLAZA.x0 + rand() * (WALL_X - PLAZA.x0);
      const z = (rand() - 0.5) * PLAZA.z * 2;
      const s = 0.08 + rand() * 0.2;
      B.piece(s * (1 + rand()), s * 0.6, s, CONCRETE[(rand() * 5) | 0], x, s * 0.25, z, rand(), rand() * 3, rand());
    }
  }
  // The wall: old stone, battered (sloping) at its foot, a walkway with
  // crenellations along its top, buttresses; the two gate towers either
  // side of the gateway, an arch over it, the gate's two great leaves.
  const STONE = [0x8d8577, 0x857d70, 0x958d80];
  {
    const wallSeg = (z0, z1) => {
      const len = z1 - z0;
      const zc = (z0 + z1) / 2;
      const w = put(B.root, box(WALL_T, WALL_H, len, STONE[0], { r: 0.03 }), WALL_X + WALL_T / 2, WALL_H / 2, zc);
      w.castShadow = w.receiveShadow = true;
      B.solid(w);
      B.block(WALL_X + WALL_T / 2, zc, WALL_T / 2, len / 2);
      // the battered foot
      const foot = put(B.root, box(1.4, 3, len, STONE[1], { r: 0.03 }), WALL_X - 0.2, 1.2, zc);
      foot.rotation.z = -0.3;
      B.block(WALL_X - 0.4, zc, 0.6, len / 2);
      // courses of stone, darker lines; moss and soot streaks; the crenels
      for (let y = 1.6; y < WALL_H; y += 0.9) B.piece(0.04, 0.06, len, 0x6f685c, WALL_X - 0.01, y, zc);
      for (let z = z0 + 1; z < z1; z += 2 + rand() * 3) B.piece(0.04, 2 + rand() * 4, 0.3 + rand() * 0.8, rand() < 0.5 ? 0x4f5a3a : 0x3a3633, WALL_X - 0.02, WALL_H - 2 - rand() * 3, z);
      for (let z = z0 + 0.6; z < z1 - 0.4; z += 1.8) put(B.root, box(1.0, 1.1, 1.0, STONE[2], { r: 0.02 }), WALL_X + 0.5, WALL_H + 0.55, z);
      put(B.root, box(WALL_T, 0.3, len, 0x6f685c, { r: 0.02 }), WALL_X + WALL_T / 2, WALL_H + 0.15, zc);
      B.lump(WALL_X + WALL_T / 2, WALL_H + 0.32, zc, WALL_T / 2.2, 0.1, len / 2.2, 0xd6d9dd);
      for (let z = z0 + 8; z < z1 - 4; z += 16) {
        const bt = put(B.root, box(2.4, WALL_H - 1, 2.6, STONE[1], { r: 0.03 }), WALL_X - 0.9, (WALL_H - 1) / 2, z);
        bt.castShadow = true;
        B.block(WALL_X - 0.9, z, 1.2, 1.3);
      }
    };
    const tz = GATE.half + TOWER / 2;
    wallSeg(MAP.z0, GATE.z - tz - TOWER / 2);
    wallSeg(GATE.z + tz + TOWER / 2, MAP.z1);
    // the towers
    for (const s of [-1, 1]) {
      const z = GATE.z + s * tz;
      const TH = WALL_H + 5;
      const t = put(B.root, box(TOWER + 1, TH, TOWER, STONE[2], { r: 0.04 }), WALL_X + WALL_T / 2 - 0.5, TH / 2, z);
      t.castShadow = t.receiveShadow = true;
      B.solid(t);
      B.block(WALL_X + WALL_T / 2 - 0.5, z, (TOWER + 1) / 2, TOWER / 2);
      for (let y = 1.6; y < TH; y += 0.9) B.piece(0.04, 0.06, TOWER, 0x6f685c, WALL_X - 1.01, y, z);
      for (let k = -1; k <= 1; k++) put(B.root, box(1.2, 1.2, 1.2, STONE[0], { r: 0.02 }), WALL_X - 0.5, TH + 0.6, z + k * 3);
      for (const k of [-1, 1]) put(B.root, box(1.2, 1.2, 1.2, STONE[0], { r: 0.02 }), WALL_X + 3, TH + 0.6, z + k * 3.5);
      put(B.root, box(TOWER + 1.2, 0.3, TOWER + 0.2, 0x6f685c, { r: 0.02 }), WALL_X + WALL_T / 2 - 0.5, TH + 0.15, z);
      // arrow slits, dark; a lit window high up
      for (const y of [5, 9, 13]) put(B.root, box(0.06, 1.4, 0.4, 0x141416), WALL_X - 1.02, y, z + (y === 9 ? 1.5 : -1.5));
      put(B.root, box(0.06, 1.0, 0.8, 0xffc070, { glow: true }), WALL_X - 1.03, 11, z + 2.2);
      // a floodlight on top, glaring down onto the square
      put(B.root, box(0.6, 0.5, 0.6, 0x2a2b2e, { r: 0.04 }), WALL_X - 0.6, TH + 1.6, z - s * 2);
      put(B.root, box(0.08, 0.4, 0.5, 0xe8f4ff, { glow: true }), WALL_X - 0.95, TH + 1.6, z - s * 2);
      B.emit(new THREE.Vector3(WALL_X - 5, TH - 3, z - s * 2), 0xcfe8ff, 22, 18);
      B.pool(WALL_X - 12, z - s * 2, 5, 0xcfe8ff, 0.14, { sx: 1.6 });
      // banners, torn
      const ban = put(B.root, box(0.06, 5, 2.2, 0x5a1f1c), WALL_X - 1.05, TH - 4, z);
      ban.rotation.x = 0.03;
    }
    // the arch over the gateway
    const arch = put(B.root, box(WALL_T + 1, WALL_H - 7, GATE.half * 2 + 0.4, STONE[1], { r: 0.03 }), WALL_X + WALL_T / 2, 7 + (WALL_H - 7) / 2, GATE.z);
    arch.castShadow = true;
    put(B.root, box(0.3, 0.6, GATE.half * 2 + 0.8, STONE[2], { r: 0.02 }), WALL_X - 0.1, 7.1, GATE.z); // the keystone course
    // the dark of the passage, and its far mouth's light (once open)
    put(B.root, box(0.1, 7, GATE.half * 2, 0x0e0f11), WALL_X + WALL_T + 0.6, 3.5, GATE.z);
  }
  // the gate's two leaves: heavy timber, iron straps and studs; they swing
  // out (away from the square) to open
  const leaves = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(WALL_X + 0.4, 0, GATE.z + s * GATE.half);
    const leaf = new THREE.Group();
    leaf.position.z = -s * GATE.half / 2;
    pivot.add(leaf);
    put(leaf, box(0.5, 6.8, GATE.half, 0x5a4636, { r: 0.02 }), 0, 3.4, 0);
    for (const y of [0.8, 2.6, 4.4, 6.2]) put(leaf, box(0.56, 0.22, GATE.half + 0.02, 0x2a2b2d), 0, y, 0);
    for (let k = 0; k < 5; k++) put(leaf, box(0.06, 6.6, 0.06, 0x3f342a), -0.27, 3.4, -GATE.half / 2 + 0.5 + k * ((GATE.half - 1) / 4));
    for (let y = 0.8; y < 6.5; y += 1.8) for (let k = 0; k < 4; k++) put(leaf, box(0.08, 0.1, 0.1, 0x8a8a86), -0.3, y, -GATE.half / 2 + 0.6 + k * 1.2);
    pivot.traverse((m) => m.isMesh && (m.castShadow = true));
    B.add(pivot);
    B.keep(pivot);
    leaves.push({ pivot, s });
  }
  const gateBlock = B.block(WALL_X + 0.4, GATE.z, 0.4, GATE.half);
  // beyond the wall: the open country in the last light. A glow down the
  // passage, the road on out, telegraph poles, bare trees, a far treeline.
  {
    const glow = B.pool(WALL_X + WALL_T + 4, GATE.z, 5, SUN, 0.25, { sx: 1.4 });
    B.keep(glow);
    for (let x = WALL_X + WALL_T + 10; x < MAP.x1 - 4; x += 14) {
      for (const s of [-1, 1]) {
        put(B.root, cyl(0.1, 6, 0x4a3f34, { seg: 6 }), x, 3, GATE.z + s * 6);
        put(B.root, box(0.1, 0.1, 1.4, 0x4a3f34), x, 5.6, GATE.z + s * 6);
      }
      B.sagging(new THREE.Vector3(x, 5.6, GATE.z + 6), new THREE.Vector3(x + 14, 5.6, GATE.z + 6), 0.3);
    }
    for (let i = 0; i < 40; i++) {
      const x = WALL_X + WALL_T + 8 + rand() * (MAP.x1 - WALL_X - 20);
      const z = MAP.z0 + rand() * (MAP.z1 - MAP.z0);
      if (Math.abs(z - GATE.z) < 7) continue;
      ST.birch(x, z, 3 + rand() * 3);
    }
    for (let z = MAP.z0; z < MAP.z1; z += 3) B.lump(MAP.x1 - 6 + (rand() - 0.5) * 3, 1.2, z, 2 + rand(), 1.6 + rand(), 1.6, [0x3a3f33, 0x434a3a, 0x353a30][(rand() * 3) | 0]);
  }

  // the checkpoints
  const shackA = buildShack(B, { x0: SHACK_A.x0, x1: SHACK_A.x1, z0: CURB.n + 0.1, z1: CURB.s - 0.1, fill: { n: WALK.n - 0.5, s: WALK.s + 1.2 }, heightAt });
  const shackB = buildShack(B, { x0: SHACK_B.x0, x1: SHACK_B.x1, z0: CURB.n + 0.1, z1: CURB.s - 0.1, fill: { n: WALK.n - 0.5, s: WALK.s + 1.2 }, heightAt });

  B.finish();
  B.mergeStatic();

  const room = buildDepotRoom(scene);
  B.blocks.push(...room.blocks);
  B.colliders.push(...room.colliders);
  B.emitters.push(...room.emitters);
  room.bindBlocks(B.blocks);
  const blocks = B.blocks;
  for (const k of [shackA, shackB]) k.bindBlocks(blocks);
  const gate = { open: 0, want: 0 };
  const setGate = (open) => {
    gate.want = open ? 1 : 0;
    const i = blocks.indexOf(gateBlock);
    if (!open && i < 0) blocks.push(gateBlock);
    if (open && i >= 0) blocks.splice(i, 1);
  };

  // ---------------------------------------------------- the level script
  const SECTORS = ['The ring road', 'The wall district', 'The gate'];
  const B1 = { minX: START_X + 2, maxX: shackA.x0 - 0.8, minZ: WALK.n + 0.4, maxZ: WALK.s - 0.4 };
  const B2 = { minX: shackA.x1 + 1.2, maxX: shackB.x0 - 0.8, minZ: WALK.n + 0.4, maxZ: WALK.s - 0.4 };
  const S = { sector: 0, step: 0, t: 0, boss: null, waveT: 0 };
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
  const PARTS6 = ['era', 'afterburner', 'rangefinder']; // (its own parts only: campaign.js rewards)
  function zoneBounds(api) {
    if (inCross(api.tankPos.x)) setBounds(api, { minZ: -CROSS_Z + 1.2, maxZ: CROSS_Z - 1.2 });
    else if (Math.abs(api.tankPos.z) < WALK.s - 0.6) setBounds(api, { minZ: WALK.n + 0.4, maxZ: WALK.s - 0.4 });
  }
  const overBarricade = (api, kind, s, delay = 0) => {
    const x = CROSS.x0 + 2 + rand() * (CROSS.x1 - CROSS.x0 - 4);
    (kind === 'walker' ? api.spawnWalker : api.spawnDog)(x, s * (CROSS_Z + 4), { delay, via: [[x, s * (CROSS_Z - 3)]], noclip: true });
  };
  const ahead = (api, x, lim) => Math.min(Math.max(x, api.tankPos.x + 16), lim);

  function start(api) {
    Object.assign(S, { sector: 0, step: 0, t: 0, boss: null, waveT: 0 });
    setBounds(api, B1);
    setGate(false);
    gate.open = 0;
    api.enableGun();
    api.revealScraps(false);
    api.giveRockets();
    if (api.tank.ability) api.giveAbility();
    api.sectors(SECTORS, 0, 'Level 6');
    api.objective('Make for the city gates');
  }

  // 1: the ring road (each wave as the tank reaches it)
  function sector1(api) {
    const x = api.tankPos.x;
    zoneBounds(api);
    if (S.step < 5 && x > shackA.x0 - 9) {
      openShack(api, shackA);
      go(5);
    }
    switch (S.step) {
      case 0:
        if (x > START_X + 8 || S.t > 4) {
          for (const [dx, z, d] of [[0, -4, 0], [2, 3, 0.4], [4, -1, 0.8], [6, 4, 1.2]]) api.spawnDog(ahead(api, 4, 24) + dx, z, { delay: d });
          go(1);
        }
        break;
      case 1:
        if (x > CROSS.x0 - 12) {
          for (const [kind, s, d] of [['dog', -1, 0], ['walker', 1, 0.3], ['dog', 1, 0.6], ['dog', -1, 0.9]]) overBarricade(api, kind, s, d);
          api.spawnDrone(ahead(api, 50, 60), -24, { via: [[ahead(api, 48, 58), -6]], delay: 1.2 });
          go(2);
        }
        break;
      case 2:
        if (x > 52) {
          api.spawnWalker(ahead(api, 70, 84), -4);
          api.spawnWalker(ahead(api, 74, 88), 4, { delay: 0.6 });
          for (const [dx, z, d] of [[0, 0, 0.3], [2, -3, 0.7]]) api.spawnDog(ahead(api, 68, 82) + dx, z, { delay: d });
          go(3);
        }
        break;
      case 3:
        if (x > 72) {
          for (const [dx, z, d] of [[0, -5, 0], [1, 4, 0.3], [2, 0, 0.6]]) api.spawnDog(ahead(api, 88, 92) + dx, z, { delay: d });
          api.spawnDrone(ahead(api, 90, 94), 24, { via: [[ahead(api, 88, 92), 5]], delay: 0.6 });
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
          api.depot(shackA, { offers: PARTS6, count: 3, onLeave: () => startSector2(api) });
        }
        break;
    }
  }

  // 2: the wall district
  function startSector2(api) {
    S.sector = 1;
    go(0);
    setBounds(api, B2);
    api.sectors(SECTORS, 1, 'Level 6');
    api.objective('Make for the city gates');
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
          // the heavy gun dug in behind the second row of traps
          api.spawnBridgeGun(150, -6.4, { yaw: Math.PI });
          for (const [dx, z, d] of [[0, -3, 0.2], [2, 3, 0.6]]) api.spawnDog(ahead(api, 124, 130) + dx, z, { delay: d });
          go(1);
        }
        break;
      case 1:
        if (x > 128) {
          api.spawnWalker(ahead(api, 142, 156), 4);
          for (const [dx, z, d] of [[0, -4, 0.3], [2, 1, 0.7], [3, 5, 1]]) api.spawnDog(ahead(api, 140, 154) + dx, z, { delay: d });
          go(2);
        }
        break;
      case 2:
        if (x > 152) {
          api.spawnDrone(ahead(api, 170, 186), -26, { via: [[ahead(api, 168, 184), -6]] });
          api.spawnWalker(ahead(api, 176, 190), -3, { delay: 0.5 });
          api.spawnWalker(ahead(api, 178, 192), 4, { delay: 1 });
          go(3);
        }
        break;
      case 3:
        if (x > 174) {
          for (const [dx, z, d] of [[0, -5, 0], [1, 4, 0.3], [2, -1, 0.6], [3, 2, 0.9]]) api.spawnDog(ahead(api, 188, 192) + dx, z, { delay: d });
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
          api.depot(shackB, { offers: PARTS6, count: 2, onLeave: () => startSector3(api) });
        }
        break;
    }
  }

  // 3: the square and the gate
  function startSector3(api) {
    S.sector = 2;
    go(0);
    setBounds(api, { minX: shackB.x1 + 1.2, maxX: WALL_X - 1.6, minZ: WALK.n + 0.4, maxZ: WALK.s - 0.4 });
    setGate(false);
    api.sectors(SECTORS, 2, 'Level 6');
    api.objective('The gate');
    api.arrow(new THREE.Vector3(WALL_X - 2, 2, GATE.z), 'Gate');
  }
  function sector3(api, dt) {
    const x = api.tankPos.x;
    // out on the square: its full width
    if (x > PLAZA.x0 + 1) setBounds(api, { minZ: -PLAZA.z + 1, maxZ: PLAZA.z - 1 });
    switch (S.step) {
      case 0:
        if (x > PLAZA.x0 + 8) {
          // in over the wall: the gunship
          api.arrow(null);
          S.boss = api.spawnGunship(WALL_X + 14, GATE.z - 6, { via: [[WALL_X - 14, GATE.z - 4]] });
          api.boss(S.boss, 'Gunship');
          api.objective('Bring down the gunship');
          api.spotlight({ targets: [() => (S.boss.alive ? S.boss.pos.clone() : null)], r: 170 }, () => S.t > 2.6, { maxTime: 3, frame: () => (S.boss.alive ? S.boss.pos.clone().setY(0) : null), frameK: 1 });
          S.waveT = 12;
          go(1);
        }
        break;
      case 1:
        S.waveT -= dt;
        if (S.boss.alive && S.waveT <= 0 && api.enemiesAlive < 4) {
          S.waveT = 18;
          for (const [dz, d] of [[-PLAZA.z + 4, 0], [PLAZA.z - 4, 0.5]]) api.spawnDog(WALL_X - 8, dz, { delay: d });
        }
        if (!S.boss.alive) {
          api.clearEnemies();
          setGate(true);
          api.cameraTo(new THREE.Vector3(WALL_X + 2, 0, GATE.z), 2.4);
          setBounds(api, { maxX: WALL_X + WALL_T + 10, minZ: -PLAZA.z + 1, maxZ: PLAZA.z - 1 });
          api.objective('Out of the city');
          api.arrow(new THREE.Vector3(WALL_X + WALL_T, 2, GATE.z), 'Exit');
          go(2);
        }
        break;
      case 2:
        if (gate.open > 0.7 && x > WALL_X + WALL_T - 1 && Math.abs(api.tankPos.z - GATE.z) < GATE.half) {
          api.arrow(null);
          api.sectors(SECTORS, 3, 'Level 6');
          api.win('Level clear', { path: [[WALL_X + WALL_T + 10, GATE.z], [WALL_X + WALL_T + 60, GATE.z]] });
          go(3);
        }
        break;
    }
  }

  function skipStage(api) {
    if (S.sector === 2 && S.step === 1 && S.boss?.alive) {
      api.clearSpot();
      api.blast(S.boss.pos.clone(), 0.5, 99999);
      return true;
    }
    api.clearSpot();
    api.arrow(null);
    api.clearPrompt();
    api.clearEnemies();
    if (S.sector < 2) {
      const shack = S.sector === 0 ? shackA : shackB;
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

  function update(dt, t, ctx = {}) {
    B.update(dt, t, ctx);
    for (const k of [shackA, shackB]) k.update(dt, t);
    room.update(dt, t, ctx);
    // the gate's leaves: swing slowly out
    gate.open += THREE.MathUtils.clamp(gate.want - gate.open, -dt * 2, dt * 0.35);
    const e = gate.open * gate.open * (3 - 2 * gate.open);
    for (const l of leaves) l.pivot.rotation.y = -l.s * e * 1.45; // (out, away from the square)
    if (ctx.api) script(ctx.api, dt);
  }

  return {
    light,
    colliders: B.colliders,
    blocks,
    emitters: B.emitters,
    crushables: B.crushables,
    depotRoom: room,
    heightAt: (x, z) => (z > 150 ? 0 : heightAt(x, z)),
    spawn: { x: START_X + 5, z: -0.5, yaw: 0 },
    bounds,
    script: S,
    shacks: [shackA, shackB],
    start,
    update,
    skipStage,
  };
}
