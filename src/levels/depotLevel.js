// Level 4: the depot, on a bright cold midday. Two more city streets, then
// in through a checkpoint into a big old depot hall, and out the far end.
//
// Layout (world +X runs bottom-left to top-right on screen):
//  1 The street: panel blocks and works buildings, snow. Dogs, walkers, a
//    drone. A checkpoint across its end.
//  2 The crossroads: on down the street, across a crossing whose side
//    streets are barricaded off (machines come over them), to a second
//    checkpoint built into the depot's front wall.
//  3 The depot: its back door opens straight into the hall. Dim and dingy:
//    a high roof on steel trusses, light only through dirty skylights and
//    a band of high windows, sodium lamps hanging. Columns, pallet racks,
//    parked buses, containers, a gantry crane. The way out is a bright
//    doorway at the far end; going for it, the door slams down and the
//    artillery drone comes. Kill it, the door goes up, out into the light.
import * as THREE from 'three';
import { addNoon, NOON_SUN } from '../render/setup.js';
import { box, cyl, put, toon, gradientMap, setLowPoly } from '../models/kit.js';
import { LevelBuilder, canvas, tex, blob, speckle } from './builder.js';
import * as P from './props.js';
import { buildShack } from './depot.js';
import { buildDepotRoom } from './depotRoom.js';
import { rails } from './rails.js';
import { sidewalkTexture, glyphSign, mapMat } from './cityTextures.js';
import { cityKit, CONCRETE, BURNT_PAINT, CONTAINERS } from './cityKit.js';

const GPX = 5;
const MAP = { x0: -60, x1: 330, z0: -60, z1: 50 };
const START_X = -20;
const CURB = { n: -7.5, s: 6.5 };
const WALK = { n: -10, s: 9 };
const SW = 0.16;
const SHACK_A = { x0: 96, x1: 103.6 };
const CROSS = { x0: 142, x1: 164 }; // the crossroads: the side streets' width
const CROSS_Z = 24; // how far up and down them the barricades are
const SHACK_B = { x0: 200, x1: 207.6 }; // built into the depot's front wall
// the hall
const HALL = { x0: 208, x1: 292, n: -17, s: 15 };
const HALL_H = 9.5; // up to the roof
const DOOR = { z: -1, half: 4 }; // the way out, in the far wall
const SKY = [222, 236, 250, 264, 278]; // skylight strips across the roof (their middles)
const SKY_W = 3.2;
const SKY_Z = [-12, 10]; // and how far across

const inHall = (x, z) => x > HALL.x0 && x < HALL.x1 && z > HALL.n && z < HALL.s;
const inCross = (x) => x > CROSS.x0 && x < CROSS.x1;
function heightAt(x, z) {
  if (x >= HALL.x0) return 0;
  if (inCross(x)) return 0;
  return z <= CURB.n || z >= CURB.s ? SW : 0;
}

// The ground: snowy sidewalks and slushy asphalt outside; inside the hall,
// old dark concrete in slabs, oil and grime, faded yellow bay lines,
// hazard stripes at the doors, two inspection pits, tyre tracks.
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
  // the roads: the street, and the cross street at the crossroads
  const asphalt = [
    [MAP.x0, CURB.n, HALL.x0, CURB.s],
    [CROSS.x0 + 2, MAP.z0, CROSS.x1 - 2, MAP.z1],
  ];
  for (const [x0, z0, x1, z1] of asphalt) {
    rect(x0, z0, x1, z1, '#5e5f64');
    speckle(g, X(x1) - X(x0), Z(z1) - Z(z0), ['#68696e', '#54555a', '#6e6e72'], (X(x1) - X(x0)) * (Z(z1) - Z(z0)) * 0.05, rand, Z(z0), X(x0));
    const n = ((x1 - x0) * (z1 - z0)) / 2.5;
    for (let i = 0; i < n; i++) {
      const x = x0 + rand() * (x1 - x0);
      const z = z0 + 0.3 + rand() * (z1 - z0 - 0.6);
      g.fillStyle = rand() < 0.5 ? '#88867f' : '#78766f';
      blob(g, X(x), Z(z), (0.5 + rand() * 1.3) * GPX, (0.35 + rand() * 0.6) * GPX, rand, 9);
    }
  }
  // the crossing: worn zebra stripes either side
  g.fillStyle = '#c9c6bd';
  for (const x of [CROSS.x0 + 0.6, CROSS.x1 - 2.4])
    for (let z = CURB.n + 0.6; z < CURB.s - 0.6; z += 1.1) for (let k = 0; k < 9; k++) if (rand() > 0.15) g.fillRect(X(x) + k * 2, Z(z), 2, 0.55 * GPX);
  g.fillStyle = '#aaa79e';
  for (let x = MAP.x0; x < HALL.x0; x += 1) if (rand() > 0.45 && !inCross(x)) g.fillRect(X(x), Z(-0.6), GPX, 2);

  // ---------------------------------------------------- the hall's floor
  rect(HALL.x0, HALL.n, HALL.x1, HALL.s, '#55534f');
  speckle(g, X(HALL.x1) - X(HALL.x0), Z(HALL.s) - Z(HALL.n), ['#4d4b48', '#5e5c58', '#474542', '#625f5a'], (X(HALL.x1) - X(HALL.x0)) * (Z(HALL.s) - Z(HALL.n)) * 0.08, rand, Z(HALL.n), X(HALL.x0));
  // slab joints
  g.fillStyle = '#42403d';
  for (let x = HALL.x0; x < HALL.x1; x += 4) g.fillRect(X(x), Z(HALL.n), 1, Z(HALL.s) - Z(HALL.n));
  for (let z = HALL.n; z < HALL.s; z += 4) g.fillRect(X(HALL.x0), Z(z), X(HALL.x1) - X(HALL.x0), 1);
  // a few slabs cracked and sunk darker
  for (let i = 0; i < 40; i++) {
    const x = HALL.x0 + ((rand() * (HALL.x1 - HALL.x0)) / 4 | 0) * 4;
    const z = HALL.n + ((rand() * (HALL.s - HALL.n)) / 4 | 0) * 4;
    g.fillStyle = rand() < 0.5 ? '#4a4845' : '#5a5853';
    g.fillRect(X(x) + 1, Z(z) + 1, 4 * GPX - 2, 4 * GPX - 2);
  }
  // oil, grime, rust stains
  for (let i = 0; i < 160; i++) {
    g.fillStyle = ['rgba(20,18,16,0.5)', 'rgba(30,26,22,0.4)', 'rgba(90,60,35,0.3)'][(rand() * 3) | 0];
    blob(g, X(HALL.x0 + rand() * (HALL.x1 - HALL.x0)), Z(HALL.n + rand() * (HALL.s - HALL.n)), (0.5 + rand() * 2.2) * GPX, (0.4 + rand() * 1.4) * GPX, rand, 10);
  }
  // tyre tracks down the middle, in and out
  g.fillStyle = 'rgba(25,24,22,0.35)';
  for (const z of [-3.2, -1.4, 0.8, 2.6]) for (let x = HALL.x0; x < HALL.x1; x += 0.5) if (rand() > 0.2) g.fillRect(X(x), Z(z + Math.sin(x / 9) * 0.4), 0.6 * GPX, 0.25 * GPX);
  // the bays: faded yellow lines along both sides, numbered boxes
  g.fillStyle = '#a58a3e';
  for (const z of [-6.5, 5]) for (let x = HALL.x0 + 2; x < HALL.x1 - 2; x += 1.4) if (rand() > 0.25) g.fillRect(X(x), Z(z), 0.8 * GPX, 0.18 * GPX);
  for (let x = HALL.x0 + 6; x < HALL.x1 - 4; x += 10) {
    for (const [z0, z1] of [[HALL.n + 1, -6.5], [5, HALL.s - 1]]) for (let z = z0; z < z1; z += 1) if (rand() > 0.3) g.fillRect(X(x), Z(z), 0.18 * GPX, 0.7 * GPX);
  }
  // hazard stripes across both doorways
  const hazard = (x0, z0, x1, z1) => {
    for (let x = X(x0); x < X(x1); x++)
      for (let z = Z(z0); z < Z(z1); z++) {
        g.fillStyle = ((x + z) / 6) % 2 < 1 ? '#c99a2e' : '#26272a';
        g.fillRect(x, z, 1, 1);
      }
  };
  hazard(HALL.x0 + 0.3, CURB.n + 0.6, HALL.x0 + 1.3, CURB.s - 0.6);
  hazard(HALL.x1 - 1.6, DOOR.z - DOOR.half, HALL.x1 - 0.4, DOOR.z + DOOR.half);
  // the inspection pits: black slots with hazard edges
  for (const x of [244, 270]) {
    hazard(x - 3.4, -2.6, x + 3.4, -2.1);
    hazard(x - 3.4, 0.1, x + 3.4, 0.6);
    rect(x - 3.2, -2.1, x + 3.2, 0.1, '#121214');
  }
  return tex(c);
}

// The hall's long back wall: grimy concrete in panels, the lower part
// painted a tired green, a band of high windows (bright daylight beyond,
// panes gone or filthy), rust and soot streaks down it.
function hallWall(w, h, rand) {
  const S = 10;
  const [c, g] = canvas(w * S, h * S);
  const [ce, ge] = canvas(w * S, h * S);
  ge.fillStyle = '#000';
  ge.fillRect(0, 0, ce.width, ce.height);
  g.fillStyle = '#7c7a74';
  g.fillRect(0, 0, c.width, c.height);
  speckle(g, c.width, c.height, ['#00000016', '#ffffff0c', '#5a4a3a18'], c.width * c.height * 0.08, rand);
  g.fillStyle = '#52645a';
  g.fillRect(0, c.height - 2.4 * S, c.width, 2.4 * S);
  g.fillStyle = '#3f4d45';
  g.fillRect(0, c.height - 2.45 * S, c.width, 3);
  g.fillStyle = '#00000038';
  for (let x = 0; x < c.width; x += 6 * S) g.fillRect(x, 0, 2, c.height);
  // high windows
  const wy = 1.4 * S;
  const wh = 2.4 * S;
  for (let x = 1.5; x < w - 3; x += 4) {
    const wx = x * S;
    const pw = 3 * S;
    for (let k = 0; k < 4; k++)
      for (let r = 0; r < 2; r++) {
        const gone = rand() < 0.2;
        const col = gone ? '#e8f0f4' : rand() < 0.5 ? '#9fb0b8' : '#7d8e96';
        g.fillStyle = ge.fillStyle = col;
        const px = wx + (k * pw) / 4 + 1;
        const py = wy + (r * wh) / 2 + 1;
        g.fillRect(px, py, pw / 4 - 2, wh / 2 - 2);
        ge.fillRect(px, py, pw / 4 - 2, wh / 2 - 2);
      }
    g.fillStyle = '#2a2b2d';
    g.fillRect(wx - 2, wy - 2, pw + 4, 2);
    g.fillRect(wx - 2, wy + wh, pw + 4, 3);
  }
  // streaks down from the window sills, soot up top
  for (let i = 0; i < w * 2; i++) {
    g.fillStyle = rand() < 0.5 ? 'rgba(80,55,35,0.35)' : 'rgba(25,24,22,0.3)';
    g.fillRect((rand() * c.width) | 0, wy + wh, 1 + ((rand() * 2) | 0), (rand() * 4 * S) | 0);
  }
  g.fillStyle = 'rgba(20,20,20,0.35)';
  g.fillRect(0, 0, c.width, 0.8 * S);
  return { map: tex(c), emissiveMap: tex(ce) };
}

export const depotLevel = {
  id: 'depot',
  name: 'Level 4 · Depot',
  build(scene) {
    setLowPoly(true);
    try {
      return buildDepot(scene);
    } finally {
      setLowPoly(false);
    }
  },
};

function buildDepot(scene) {
  const B = new LevelBuilder(scene, 4207);
  const rand = B.rand;
  const light = addNoon(scene, { shadowSize: 24, shadowMap: 2048 });
  const K = cityKit(B, { WALK, SW, heightAt });
  const sign = (w, h, o = {}) => mapMat(glyphSign(w, h, { rand, ...o }));

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
  // sidewalks, broken by the crossroads
  for (const [x0, x1] of [[MAP.x0, CROSS.x0], [CROSS.x1, HALL.x0]]) {
    slab(x0, x1, -34, CURB.n);
    slab(x0, x1, CURB.s, 34);
  }
  for (const [z, dir] of [[CURB.n - 0.35, -1], [CURB.s + 0.35, 1]]) {
    for (let x = START_X - 2; x < HALL.x0 - 2; x += 0.6) {
      if (inCross(x)) continue;
      if (rand() < 0.15) x += 2;
      B.lump(x, SW, z + dir * rand() * 0.25, 0.5 + rand() * 0.4, 0.18 + rand() * 0.15, 0.35 + rand() * 0.2, rand() < 0.3 ? 0xa9aaac : 0xc7cacf, rand() * 3);
    }
  }
  for (let i = 0; i < 380; i++) {
    const x = START_X + rand() * (HALL.x0 - START_X);
    const z = WALK.n + rand() * (WALK.s - WALK.n);
    const s = 0.08 + rand() * 0.22;
    B.piece(s * (1 + rand()), s * 0.6, s, rand() < 0.25 ? 0x7a5e50 : CONCRETE[(rand() * 5) | 0], x, heightAt(x, z) + s * 0.25, z, rand(), rand() * 3, rand());
  }
  // tram rails down the street, a pair turning off up the cross street
  {
    const R = rails(B, rand);
    R.track(R.straight(START_X - 1, -2.25, HALL.x0 - 3, -2.25));
    R.track([...R.straight(START_X - 1, 1.55, CROSS.x0 - 2, 1.55), ...R.bend({ x: CROSS.x0 - 2, z: 1.55 }, { x: CROSS.x0 + 9, z: 1.55 }, { x: CROSS.x0 + 9, z: 14 }).slice(1), ...R.straight(CROSS.x0 + 9, 14, CROSS.x0 + 9, CROSS_Z + 4).slice(1)]);
  }

  // -------------------------------------------------- 1: the street
  {
    const X = START_X - 2.5;
    for (let z = -14; z < 16; z += 2.6) K.rubble(B, X - 1 + (rand() - 0.5) * 1.5, z + (rand() - 0.5), 2.6 + rand() * 1.2, 2.4 + rand() * 1.6, { slabs: 3 });
    B.block(X - 1, 0.5, 2.2, 22);
  }
  K.building({ x0: -52, x1: -6, floors: 8, shop: true });
  K.works({ x0: -4, x1: 18, zf: WALK.n, roof: 'saw', wall: 0x8a9a8e, doors: 3 });
  K.building({ x0: 20, x1: 42, floors: 6, holes: 2, sign: '#ffcf8a' });
  K.works({ x0: 44, x1: 62, zf: WALK.n, roof: 'flat', wall: K.BRICK, tin: false, doors: 2, dock: true });
  K.building({ x0: 64, x1: 94, floors: 7, shop: true, mural: true });
  K.building({ x0: SHACK_A.x1, x1: 124, floors: 6 });
  K.southBlock(-52, -4, 2);
  K.works({ x0: -2, x1: 18, zf: WALK.s + 0.3, side: 's', roof: 'gable', wall: 0x7d8a92, doors: 2 });
  K.southBlock(20, 44, 3);
  K.southBlock(46, 66, 2);
  K.works({ x0: 68, x1: 94, zf: WALK.s + 0.3, side: 's', roof: 'saw', wall: 0xa38d6a, doors: 3 });
  K.southBlock(SHACK_A.x1, 124, 2);
  const wreck = (x, z, yaw, o) => B.crushable(() => P.car(B, x, z, yaw, o), { kind: 'car', scrap: 2 });
  wreck(-2, -1.5, 0.35, { kind: 'sedan', paint: BURNT_PAINT[0] });
  wreck(16, 3.6, 0.2, { kind: 'van', paint: 0x6b7458 });
  wreck(34, -4.6, -0.4, { kind: 'hatch', paint: BURNT_PAINT[1], flipped: true });
  wreck(57, 2.4, 0.5, { kind: 'sedan', paint: BURNT_PAINT[2] });
  wreck(84, -3.4, 0.7, { kind: 'hatch', paint: BURNT_PAINT[3] });
  P.tram(B, 46, -2.25, 0.02, { tilt: 0.04, burn: 0.7 });
  K.rubble(B, 26, 5.2, 1.6, 1.2, { slabs: 2 });
  K.rubble(B, 72, -5.6, 1.8, 1.3, { slabs: 2 });
  for (const [x, z, yaw] of [[8, -4, 0.3], [64, 1.5, 1.4], [65.8, 2.2, 1.3], [90, 4.5, 0.6]]) K.jersey(B, x, z, yaw);
  const junk = (fn, scrap = 0) => B.crushable(fn, { kind: 'prop', scrap });
  junk(() => P.crates(B, 24, SW, WALK.n + 1.2), 2);
  junk(() => P.tires(B, 40, SW, CURB.s + 1, 4));
  junk(() => P.bin(B, 4, SW, WALK.n + 1.3, { tipped: true }), 1);
  junk(() => P.bench(B, 60, SW, WALK.s - 1, Math.PI, { tipped: true }));
  junk(() => P.dumpster(B, 78, SW, WALK.n + 1.2, 0.1));
  const lamp = (x, z, s, y = SW) =>
    B.crushable(
      () => {
        const pole = cyl(0.09, 6.4, 0x8b8984, { seg: 8, radiusEnd: 0.14 });
        pole.position.set(x, y + 3.2, z);
        B.add(pole);
        B.solid(pole);
        B.block(x, z, 0.2, 0.2);
        put(B.root, box(0.08, 0.08, 1.7, 0x4a4c50, { r: 0.02 }), x, y + 6.1, z - s * 0.85).rotation.x = s * 0.12;
        put(B.root, box(0.34, 0.14, 0.6, 0x3c3e42, { r: 0.05 }), x, y + 6.05, z - s * 1.7);
      },
      { kind: 'pole', pivot: { x, y, z }, footprint: { x, z, hx: 0.25, hz: 0.25, yaw: 0 } },
    );
  for (let x = START_X + 4; x < HALL.x0 - 4; x += 16) {
    if ((x > SHACK_A.x0 - 3 && x < SHACK_A.x1 + 3) || (x > CROSS.x0 - 2 && x < CROSS.x1 + 2)) continue;
    for (const s of [-1, 1]) lamp(x, s < 0 ? CURB.n - 0.45 : CURB.s + 0.45, s);
  }

  // ----------------------------------------------- 2: the crossroads
  // on from the checkpoint: blocks to the crossing, the side streets
  // either way closed off a little way up by barricades (the machines climb
  // over them), then blocks again up to the depot's front
  K.building({ x0: 126, x1: CROSS.x0, floors: 7, shop: true });
  K.southBlock(126, CROSS.x0, 1); // (low: up the side street it's between the camera and the tank)
  K.building({ x0: CROSS.x1, x1: 184, floors: 8, holes: 2 });
  K.works({ x0: 186, x1: SHACK_B.x0, zf: WALK.n, roof: 'gable', wall: 0x9a8f7a, doors: 1 });
  K.southBlock(CROSS.x1, 182, 2);
  K.works({ x0: 184, x1: SHACK_B.x0, zf: WALK.s + 0.3, side: 's', roof: 'flat', wall: 0x6f7f74, doors: 1 });
  // the side streets' far blocks (the corners beyond the barricades)
  for (const s of [-1, 1]) {
    const z = s * (CROSS_Z + 3);
    K.rubble(B, CROSS.x0 + 4, z, 2.4, 1.8, { slabs: 2 });
    for (let x = CROSS.x0 + 1; x < CROSS.x1; x += 2.2) {
      const r = rand();
      if (r < 0.45) K.jersey(B, x + 0.6, s * CROSS_Z, (rand() - 0.5) * 0.3, 0.9, 2);
      else if (r < 0.7) K.rubble(B, x + 0.6, s * (CROSS_Z + 0.4), 1.4, 1.1, { slabs: 1 });
      else {
        for (const [dx, a] of [[0, 0.8], [0, -0.8], [0, 0]]) B.piece(1.9, 0.18, 0.18, 0x4a4c50, x + 0.6 + dx, 0.6, s * CROSS_Z, a, 0.8, a ? 0.7 : 1.57); // a tank trap
      }
    }
    B.block((CROSS.x0 + CROSS.x1) / 2, s * CROSS_Z, (CROSS.x1 - CROSS.x0) / 2, 0.8);
    K.container(B, CROSS.x0 + 6, 0, s * (CROSS_Z + 2.4), 0.05, CONTAINERS[(rand() * 5) | 0]);
    // the blocks either side of the side street, set back behind it
    // (tall on the far side; low on the near side, so they don't hide the street)
    if (s < 0) {
      K.building({ x0: CROSS.x0 - 22, x1: CROSS.x0 - 1, zf: -CROSS_Z - 6, floors: 9 });
      K.building({ x0: CROSS.x1 + 1, x1: CROSS.x1 + 24, zf: -CROSS_Z - 6, floors: 8 });
    } else {
      K.southBlock(CROSS.x0 - 22, CROSS.x0 - 1, 2, CROSS_Z + 6);
      K.southBlock(CROSS.x1 + 1, CROSS.x1 + 24, 2, CROSS_Z + 6);
    }
    // corners: sidewalk islands with posts
    for (const x of [CROSS.x0 - 1.4, CROSS.x1 + 1.4]) for (let k = 0; k < 4; k++) B.piece(0.18, 0.7, 0.18, 0x55575b, x, SW + 0.35, s * (WALK.s + 1 + k * 1.6));
  }
  // in the crossing: wrecks, a bus slewed across, sandbags, a burnt tram
  // car off its rails
  B.crushable(() => P.bus(B, 152, -4.2, 0.55), { kind: 'prop', heavy: true, armored: true });
  wreck(146, 4.5, -0.6, { kind: 'van', paint: 0x7b7f78 });
  wreck(160, 13, 0.4, { kind: 'sedan', paint: BURNT_PAINT[2] });
  wreck(148, -16, 1.2, { kind: 'hatch', paint: BURNT_PAINT[0], flipped: true });
  K.rubble(B, 157, 6, 1.6, 1.2, { slabs: 2, solid: true });
  for (const [x, z, yaw] of [[172, -4, 0.3], [178, 3.5, 1.4], [192, -1.2, 0.2]]) K.jersey(B, x, z, yaw, 1.0, 1.8);
  wreck(186, 4.2, 0.2, { kind: 'hatch', paint: BURNT_PAINT[5] });
  junk(() => P.crates(B, 170, SW, WALK.s - 1.2), 2);
  junk(() => P.tires(B, 194, SW, WALK.n + 1.1, 4));

  // ------------------------------------------------------ 3: the depot
  // Its walls. The far (north) wall and the far end stand full height; the
  // near (south) wall is cut down low so you can see in (the dollhouse
  // trick, as in the checkpoint's garage), but carries on up as a shadow
  // only, with the roof: the hall stays dim inside, lit through its
  // skylights and windows.
  const shadowOnly = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const shade = (w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), shadowOnly);
    m.position.set(x, y, z);
    m.castShadow = true;
    B.add(m);
    B.keep(m); // (left out of the merge: nothing to draw)
    return m;
  };
  const LEN = HALL.x1 - HALL.x0;
  const MIDX = (HALL.x0 + HALL.x1) / 2;
  {
    // the back wall, windows high up
    const tx = hallWall(LEN + 1, HALL_H, rand);
    const face = new THREE.MeshToonMaterial({ map: tx.map, emissiveMap: tx.emissiveMap, emissive: 0xffffff, emissiveIntensity: 0.9, gradientMap });
    const plain = toon(0x6f6d68);
    const back = new THREE.Mesh(new THREE.BoxGeometry(LEN + 1, HALL_H, 0.8), [plain, plain, toon(0x5a5955), plain, face, plain]);
    back.position.set(MIDX, HALL_H / 2, HALL.n - 0.4);
    back.castShadow = back.receiveShadow = true;
    B.add(back);
    B.solid(back);
    B.block(MIDX, HALL.n - 0.4, LEN / 2 + 0.5, 0.4);
    // the near wall: low, its top broken in places
    const low = put(B.root, box(LEN + 1, 1.3, 0.6, 0x77756f, { r: 0.02 }), MIDX, 0.65, HALL.s + 0.3);
    low.castShadow = true;
    B.solid(low);
    B.block(MIDX, HALL.s + 0.3, LEN / 2 + 0.5, 0.3);
    for (let x = HALL.x0 + 2; x < HALL.x1; x += 3 + rand() * 4) B.piece(1 + rand() * 1.5, 0.3 + rand() * 0.4, 0.62, 0x6a6863, x, 1.3 + rand() * 0.2, HALL.s + 0.3, 0, 0, (rand() - 0.5) * 0.3);
    shade(LEN + 1, HALL_H - 1.3, 0.6, MIDX, 1.3 + (HALL_H - 1.3) / 2, HALL.s + 0.3);
    // the far end: full height, the doorway out in it
    const endH = HALL_H;
    const sideN = DOOR.z - DOOR.half - HALL.n;
    const sideS = HALL.s - (DOOR.z + DOOR.half);
    for (const [z, d] of [[HALL.n + sideN / 2, sideN], [HALL.s - sideS / 2, sideS]]) {
      const w = put(B.root, box(1, endH, d, 0x6f6d68, { r: 0.02 }), HALL.x1 + 0.5, endH / 2, z);
      w.castShadow = true;
      B.solid(w);
      B.block(HALL.x1 + 0.5, z, 0.5, d / 2);
    }
    put(B.root, box(1, endH - 5.2, DOOR.half * 2 + 0.2, 0x6f6d68, { r: 0.02 }), HALL.x1 + 0.5, 5.2 + (endH - 5.2) / 2, DOOR.z).castShadow = true;
    // the front: the checkpoint's in the middle of it; the wall each side
    // (cut down to the checkpoint's height, like the near wall: it stands
    // between the camera and the hall's first bay. Up to the roof it's a
    // shadow only.)
    for (const [za, zb, h] of [[HALL.n, CURB.n + 0.1, 3.6], [CURB.s - 0.1, HALL.s, 2.2]]) {
      const zc = (za + zb) / 2;
      const w = put(B.root, box(1, h, zb - za, 0x6f6d68, { r: 0.02 }), HALL.x0 - 0.5, h / 2, zc);
      w.castShadow = true;
      B.solid(w);
      B.block(HALL.x0 - 0.5, zc, 0.5, (zb - za) / 2);
      for (let z = za + 1; z < zb - 1; z += 2 + rand() * 3) B.piece(0.9, 0.25 + rand() * 0.4, 1 + rand() * 1.4, 0x5f5d58, HALL.x0 - 0.5, h, z, 0, 0, (rand() - 0.5) * 0.4); // its broken top
    }
    shade(1, HALL_H - 2.2, HALL.s - HALL.n, HALL.x0 - 0.5, 2.2 + (HALL_H - 2.2) / 2, (HALL.n + HALL.s) / 2);
    // its name, faded, on a board along the front wall's top
    const board = new THREE.Mesh(new THREE.PlaneGeometry(7, 0.9), sign(7, 0.9, { board: '#2f3a35', ink: '#d9cfa8' }));
    board.rotation.y = -Math.PI / 2;
    board.position.set(HALL.x0 - 1.02, 2.9, (HALL.n + CURB.n) / 2);
    B.add(board);
  }
  // the roof: steel trusses across on columns; the roof itself only casts
  // its shadow (it's not drawn, so the camera sees in), with the skylight
  // strips left open
  {
    const ROOF_Y = HALL_H + 0.2;
    const xs = [HALL.x0, ...SKY.flatMap((x) => [x - SKY_W / 2, x + SKY_W / 2]), HALL.x1];
    for (let i = 0; i < xs.length; i += 2) shade(xs[i + 1] - xs[i], 0.3, HALL.s - HALL.n + 1, (xs[i] + xs[i + 1]) / 2, ROOF_Y, (HALL.n + HALL.s) / 2);
    for (const x of SKY) {
      // either side of each skylight's open strip
      shade(SKY_W, 0.3, SKY_Z[0] - HALL.n, x, ROOF_Y, (HALL.n + SKY_Z[0]) / 2);
      shade(SKY_W, 0.3, HALL.s - SKY_Z[1] + 0.5, x, ROOF_Y, (SKY_Z[1] + HALL.s) / 2);
      // the glazing bars over the strip (casting their thin shadows too)
      for (let z = SKY_Z[0] + 1.5; z < SKY_Z[1]; z += 1.5) shade(SKY_W, 0.08, 0.12, x, ROOF_Y - 0.1, z);
    }
    // trusses: bottom and top chords, verticals, a zig-zag of diagonals
    // (drawn over the back half only: over the near half they'd cut across
    // the fighting; it reads as the roof going on out of the picture)
    const STEEL = 0x4a4f55;
    const TZ = -3; // where they stop
    for (let x = HALL.x0 + 7; x < HALL.x1 - 2; x += 14) {
      const span = TZ - HALL.n;
      put(B.root, box(0.22, 0.22, span, STEEL, { r: 0.01 }), x, HALL_H - 1.6, (HALL.n + TZ) / 2);
      put(B.root, box(0.2, 0.2, span, STEEL, { r: 0.01 }), x, HALL_H - 0.6, (HALL.n + TZ) / 2);
      for (let k = 0; k <= 6; k++) {
        const z = HALL.n + (k * span) / 6;
        put(B.root, box(0.1, 1.0, 0.1, STEEL), x, HALL_H - 1.1, z);
        if (k < 6) {
          const d = put(B.root, box(0.08, 0.08, Math.hypot(span / 6, 1), STEEL), x, HALL_H - 1.1, z + span / 12);
          d.rotation.x = (k % 2 ? 1 : -1) * Math.atan2(1, span / 6);
        }
      }
    }
    for (const z of [HALL.n + 4, HALL.n + 9]) put(B.root, box(LEN, 0.14, 0.14, 0x3e4247), MIDX, HALL_H - 0.45, z);
  }
  // columns: two rows, I-beams on concrete footings, a hazard band round
  // each foot (good cover, and in the way)
  const COLS = [];
  for (let x = HALL.x0 + 7; x < HALL.x1 - 2; x += 14)
    for (const z of [-9.5, 7.5]) {
      COLS.push([x, z]);
      // (the near row is cut off part way up, like the near walls: the
      // cutaway; a shadow carries on up to the roof)
      const ch = z > 0 ? 4.6 : HALL_H - 1.6;
      put(B.root, box(1.0, 0.5, 1.0, 0x8a8780, { r: 0.03 }), x, 0.25, z);
      const c = put(B.root, box(0.45, ch, 0.6, 0x4a4f55, { r: 0.01 }), x, ch / 2 + 0.5, z);
      c.castShadow = true;
      B.solid(c);
      for (const s of [-1, 1]) put(B.root, box(0.7, ch, 0.06, 0x41464c), x, ch / 2 + 0.5, z + s * 0.32);
      if (z > 0) {
        put(B.root, box(0.74, 0.08, 0.68, 0x2a2c30), x, ch + 0.52, z);
        shade(0.5, HALL_H - ch - 0.5, 0.6, x, ch + 0.5 + (HALL_H - ch - 0.5) / 2, z);
      }
      for (let k = 0; k < 4; k++) put(B.root, box(0.74, 0.12, 0.74, k % 2 ? 0x26272a : 0xc99a2e), x, 0.6 + k * 0.12, z);
      B.block(x, z, 0.5, 0.5);
    }
  // the gantry crane: runway rails along the back wall and over the near
  // wall's line, its bridge across the hall, a hook hanging
  // jib cranes off the back wall: a yellow arm out over the floor on a
  // bracket, a trolley, a hook on its cable
  {
    const RY = HALL_H - 3;
    put(B.root, box(LEN, 0.3, 0.35, 0x3c3e42, { r: 0.01 }), MIDX, RY + 0.9, HALL.n + 0.5); // a runway rail along the wall
    for (const [cx, reach, hz] of [[246, 9, -10], [274, 7, -11]]) {
      put(B.root, box(0.5, 1.4, 0.5, 0x3c3e42, { r: 0.02 }), cx, RY, HALL.n + 0.5);
      const arm = put(B.root, box(0.5, 0.6, reach, 0xc99a2e, { r: 0.02 }), cx, RY + 0.3, HALL.n + 0.5 + reach / 2);
      arm.castShadow = true;
      for (let z = HALL.n + 1; z < HALL.n + reach; z += 1.2) put(B.root, box(0.52, 0.16, 0.45, 0x26272a), cx, RY + 0.3, z);
      const brace = put(B.root, box(0.16, 0.16, Math.hypot(reach * 0.5, 2), 0x3c3e42), cx, RY - 0.7, HALL.n + 0.5 + reach * 0.25);
      brace.rotation.x = Math.atan2(2, reach * 0.5);
      put(B.root, box(0.8, 0.5, 0.8, 0x3c3e42, { r: 0.03 }), cx, RY - 0.2, hz);
      B.line([new THREE.Vector3(cx, RY - 0.4, hz), new THREE.Vector3(cx, 3.2, hz)]);
      put(B.root, box(0.6, 0.4, 0.4, 0xc99a2e, { r: 0.04 }), cx, 3.0, hz);
      put(B.root, box(0.14, 0.4, 0.1, 0x2b2c2e), cx, 2.65, hz);
    }
  }
  // hanging sodium lamps over the bays, their pools on the floor
  const SODIUM = 0xffa245;
  for (let x = HALL.x0 + 14; x < HALL.x1 - 4; x += 14)
    for (const z of [-4.5, 3.5]) {
      if ((x / 14) % 2 && z > 0) continue; // (one missing here and there)
      B.line([new THREE.Vector3(x, z > 0 ? 6.6 : HALL_H - 1.6, z), new THREE.Vector3(x, 5.4, z)]);
      put(B.root, cyl(0.42, 0.24, 0x2e3034, { seg: 8, radiusEnd: 0.14 }), x, 5.3, z);
      put(B.root, cyl(0.24, 0.05, SODIUM, { seg: 8, glow: true }), x, 5.17, z);
      B.emit(new THREE.Vector3(x, 4.2, z), SODIUM, 18, 10);
      B.pool(x, z, 3.2, SODIUM, 0.16);
    }
  // light coming down through the skylights: dusty shafts onto bright
  // patches on the floor (the real light lands there too, through the gaps)
  {
    const SUN = 0xffe2b0;
    const dir = NOON_SUN.clone().negate().normalize();
    const ground = (p) => {
      const t = p.y / -dir.y;
      return new THREE.Vector3(p.x + dir.x * t, 0.03, p.z + dir.z * t);
    };
    const pos = [];
    const col = [];
    for (const x of SKY) {
      const y = HALL_H;
      const top = [new THREE.Vector3(x - SKY_W / 2, y, SKY_Z[0]), new THREE.Vector3(x + SKY_W / 2, y, SKY_Z[0]), new THREE.Vector3(x + SKY_W / 2, y, SKY_Z[1]), new THREE.Vector3(x - SKY_W / 2, y, SKY_Z[1])];
      const bottom = top.map(ground);
      for (let i = 0; i < 4; i++) {
        const a = top[i];
        const b = top[(i + 1) % 4];
        const c = bottom[(i + 1) % 4];
        const d = bottom[i];
        for (const [p, k] of [[a, 1], [b, 1], [c, 0.1], [a, 1], [c, 0.1], [d, 0.1]]) {
          pos.push(p.x, p.y, p.z);
          col.push(k, k, k);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const shafts = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: SUN, vertexColors: true, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    B.add(shafts);
    // dust drifting in the shafts
    const dust = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: 0xfff1d0, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }), SKY.length * 22);
    const motes = [];
    for (const x of SKY)
      for (let i = 0; i < 22; i++) {
        const top = new THREE.Vector3(x + (rand() - 0.5) * SKY_W, HALL_H, SKY_Z[0] + rand() * (SKY_Z[1] - SKY_Z[0]));
        motes.push({ top, k: rand(), v: 0.02 + rand() * 0.03, w: rand() * 6 });
      }
    const m4 = new THREE.Matrix4();
    const at = new THREE.Vector3();
    B.add(dust);
    B.keep(dust);
    B.animate((dt, t) => {
      motes.forEach((d, i) => {
        d.k = (d.k + d.v * dt) % 1;
        const g = ground(d.top);
        at.lerpVectors(d.top, g, 0.15 + d.k * 0.8);
        at.x += Math.sin(t * 0.7 + d.w) * 0.3;
        at.z += Math.cos(t * 0.5 + d.w) * 0.3;
        m4.makeTranslation(at.x, at.y, at.z);
        dust.setMatrixAt(i, m4);
      });
      dust.instanceMatrix.needsUpdate = true;
    });
  }
  // things in the hall
  // pallet racks along the back wall: blue uprights, orange beams, loads
  function rack(x0, x1, z) {
    const D = 1.4;
    for (let x = x0; x <= x1 + 0.01; x += 2.8) for (const dz of [-D / 2, D / 2]) put(B.root, box(0.12, 4.6, 0.12, 0x3a5a8a), x, 2.3, z + dz);
    for (const y of [0.3, 1.8, 3.3]) {
      for (const dz of [-D / 2, D / 2]) put(B.root, box(x1 - x0 + 0.1, 0.14, 0.08, 0xc8742e), (x0 + x1) / 2, y, z + dz);
      for (let x = x0 + 1.4; x < x1; x += 2.8) {
        if (rand() < 0.25) continue;
        put(B.root, box(1.1, 0.12, 1.1, 0x7a5f3e), x, y + 0.13, z);
        const h = 0.5 + rand() * 0.8;
        put(B.root, box(1.0, h, 1.0, [0x8a7a5a, 0x6b6f72, 0x5a6b5a, 0x9a8a6a][(rand() * 4) | 0], { r: 0.02 }), x + (rand() - 0.5) * 0.1, y + 0.19 + h / 2, z);
      }
    }
    B.block((x0 + x1) / 2, z, (x1 - x0) / 2 + 0.1, D / 2 + 0.1);
    B.hitBox((x0 + x1) / 2, 2.3, z, x1 - x0, 4.6, D);
  }
  rack(212, 226, HALL.n + 1.6);
  rack(236, 250, HALL.n + 1.6);
  rack(262, 273, HALL.n + 1.6);
  // a double rack out on the floor: an island to fight round
  rack(228, 236.4, -12.5);
  // parked buses in the bays, a lorry, containers
  B.crushable(() => P.bus(B, 222, 10.2, 0.04), { kind: 'prop', heavy: true, armored: true });
  B.crushable(() => P.bus(B, 252, 10.6, -0.03), { kind: 'prop', heavy: true, armored: true });
  K.container(B, 280, 0, 10.4, 0.02, CONTAINERS[4]);
  K.container(B, 282, 0, -13.8, 0.05, CONTAINERS[0]);
  K.container(B, 282.4, 2.6, -13.6, -0.04, CONTAINERS[1]);
  wreck(240, 4, 0.1, { kind: 'van', paint: 0x6b7458, snow: false });
  wreck(266, -6.8, -0.2, { kind: 'van', paint: 0x5d6b80, snow: false });
  // oil drums, workbenches, a compressor, crates
  const drum = (x, z, color) =>
    B.crushable(
      () => {
        put(B.root, cyl(0.32, 0.9, color, { seg: 10 }), x, 0.45, z);
        put(B.root, cyl(0.33, 0.06, 0x2a2b2d, { seg: 10 }), x, 0.3, z);
        put(B.root, cyl(0.33, 0.06, 0x2a2b2d, { seg: 10 }), x, 0.65, z);
        B.block(x, z, 0.32, 0.32);
      },
      { kind: 'prop', scrap: 1 },
    );
  for (const [x, z, c] of [[216, -5.4, 0x8a3a2e], [216.7, -4.8, 0x3a5a7a], [217.4, -5.6, 0x8a3a2e], [247, 6.4, 0x5a6a3a], [247.7, 6.9, 0x8a3a2e], [275, -5, 0x3a5a7a], [286, 4, 0x8a3a2e], [286.6, 4.6, 0x5a6a3a]]) drum(x, z, c);
  for (const [x, z] of [[244, -13.3], [268, -13.3]]) {
    B.chunk(2.6, 0.12, 0.9, 0x6b5640, x, 1.0, z);
    for (const dx of [-1.1, 1.1]) B.piece(0.1, 1.0, 0.8, 0x45484c, x + dx, 0.5, z);
    for (let i = 0; i < 4; i++) B.piece(0.3, 0.2 + rand() * 0.2, 0.25, [0x3c5a7a, 0x6b6f72, 0xc99a2e][i % 3], x - 0.8 + i * 0.5, 1.15, z);
    B.block(x, z, 1.3, 0.45);
  }
  junk(() => P.crates(B, 214, 0, 11), 2);
  junk(() => P.crates(B, 262, 0, -10.8), 2);
  junk(() => P.tires(B, 236, 0, 12.4, 5));
  junk(() => P.tires(B, 288, 0, -8, 4));
  junk(() => P.cabinet(B, 290.6, 0, 9, -Math.PI / 2));
  // hoses and cables over the floor
  for (const [x, z, h] of [[224, -3, 0.4], [250, 2, 2.6], [272, -9, 1.2]]) B.groundCable(x, z, h, 14, 0.5);

  // the way out: a roller door in the far wall, bright daylight beyond it
  const EXIT_X = HALL.x1 + 0.5;
  const exitDoor = new THREE.Group();
  {
    const slats = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5.1, DOOR.half * 2), toon(0x5a626c));
    slats.position.y = 2.55;
    slats.castShadow = true;
    exitDoor.add(slats);
    for (let y = 0.3; y < 5; y += 0.34) put(exitDoor, box(0.04, 0.05, DOOR.half * 2 - 0.1, 0x434b54), -0.12, y, 0);
    put(exitDoor, box(0.26, 0.3, DOOR.half * 2, 0xc99a2e), -0.02, 0.15, 0);
    exitDoor.position.set(EXIT_X, 0, DOOR.z);
    B.add(exitDoor);
    B.keep(exitDoor);
    // the light outside: a glowing white wall of it in the opening, a
    // spill on the floor inside, hazard posts each side
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(DOOR.half * 2, 5.2), new THREE.MeshBasicMaterial({ color: 0xfff6e4, fog: false }));
    glow.rotation.y = -Math.PI / 2;
    glow.position.set(EXIT_X + 1.2, 2.6, DOOR.z);
    B.add(glow);
    B.keep(glow);
    for (const s of [-1, 1]) {
      put(B.root, box(0.3, 1.2, 0.3, 0xc99a2e), HALL.x1 - 0.4, 0.6, DOOR.z + s * (DOOR.half + 0.3));
      put(B.root, box(0.32, 0.2, 0.32, 0x26272a), HALL.x1 - 0.4, 0.8, DOOR.z + s * (DOOR.half + 0.3));
    }
    const sgn = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), sign(2.4, 0.6, { board: '#1f5a36', ink: '#e6f0dc' }));
    sgn.rotation.y = -Math.PI / 2;
    sgn.position.set(HALL.x1 - 0.02, 6.1, DOOR.z);
    B.add(sgn);
  }
  const exitPool = B.pool(HALL.x1 - 5, DOOR.z, 6, 0xfff1d6, 0.0, { sx: 1.3, sz: 0.8 });
  const exitLight = B.emit(new THREE.Vector3(HALL.x1 - 3, 3, DOOR.z), 0xfff1d6, 30, 16, { level: 0, priority: true });
  const exitBlock = B.block(EXIT_X, DOOR.z, 0.4, DOOR.half);

  // the checkpoints: one across the street; one in the depot's front wall
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
  // the exit: 0 shut .. 1 open
  const exit = { open: 0, want: 0 };
  const setExit = (open) => {
    exit.want = open ? 1 : 0;
    const i = blocks.indexOf(exitBlock);
    if (!open && i < 0) blocks.push(exitBlock);
    if (open && i >= 0) blocks.splice(i, 1);
  };

  // ---------------------------------------------------- the level script
  const SECTORS = ['The street', 'The crossroads', 'The depot'];
  const B1 = { minX: START_X + 2, maxX: shackA.x0 - 0.8, minZ: WALK.n + 0.4, maxZ: WALK.s - 0.4 };
  const B2 = { minX: shackA.x1 + 1.2, maxX: shackB.x0 - 0.8, minZ: WALK.n + 0.4, maxZ: WALK.s - 0.4 };
  const B3 = { minX: shackB.x1 + 1.2, maxX: HALL.x1 - 1.5, minZ: HALL.n + 1, maxZ: HALL.s - 0.8 };
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
  const PARTS4 = ['dozer', 'autoloader', 'he']; // (its own parts only: campaign.js rewards)
  // at the crossroads the tank can go up the side streets to their barricades
  function zoneBounds(api) {
    const x = api.tankPos.x;
    if (inCross(x)) setBounds(api, { minZ: -CROSS_Z + 1.2, maxZ: CROSS_Z - 1.2 });
    else if (Math.abs(api.tankPos.z) < WALK.s - 0.6) setBounds(api, { minZ: WALK.n + 0.4, maxZ: WALK.s - 0.4 });
  }
  // a machine coming in over a side street's barricade
  const overBarricade = (api, kind, s, delay = 0) => {
    const x = CROSS.x0 + 4 + rand() * (CROSS.x1 - CROSS.x0 - 8);
    const spawn = kind === 'walker' ? api.spawnWalker : api.spawnDog;
    spawn(x, s * (CROSS_Z + 4), { delay, via: [[x, s * (CROSS_Z - 3)]], noclip: true });
  };
  // in the hall: machines come out of the far end and the dark corners
  const hallSpawn = (api, kind, x, z, delay = 0) => {
    const ax = Math.max(x, api.tankPos.x + 14);
    if (kind === 'drone') return api.spawnDrone(Math.min(ax, HALL.x1 - 6), -6, { delay }); // (dropping in through a skylight)
    return (kind === 'walker' ? api.spawnWalker : api.spawnDog)(Math.min(ax, HALL.x1 - 3), z, { delay });
  };

  function start(api) {
    Object.assign(S, { sector: 0, step: 0, t: 0, boss: null, waveT: 0 });
    setBounds(api, B1);
    setExit(false);
    exit.open = 0;
    api.enableGun();
    api.revealScraps(false);
    api.giveRockets();
    if (api.tank.ability) api.giveAbility();
    api.sectors(SECTORS, 0, 'Level 4');
    api.objective('Reach the depot');
  }

  // 1: the street
  function sector1(api) {
    const x = api.tankPos.x;
    if (S.step < 5 && x > shackA.x0 - 9) {
      openShack(api, shackA);
      go(5);
    }
    switch (S.step) {
      case 0:
        if (x > START_X + 12 || S.t > 4) {
          for (const [dx, z, d] of [[0, -4, 0], [2, 3, 0.4], [4, -1, 0.8], [6, 4, 1.2]]) api.spawnDog(Math.max(x + 18, 10) + dx, z, { delay: d });
          go(1);
        }
        break;
      case 1:
        if (api.enemiesAlive === 0 && S.t > 1.5) {
          api.spawnWalker(Math.max(46, x + 16), -4);
          api.spawnDog(Math.max(42, x + 14), 2, { delay: 0.4 });
          api.spawnDog(Math.max(44, x + 15), -1, { delay: 0.8 });
          go(2);
        }
        break;
      case 2:
        if (api.enemiesAlive === 0 && S.t > 1.5) {
          api.spawnDrone(Math.max(x + 16, 62), -20, { via: [[Math.max(x + 14, 60), -4]] });
          api.spawnWalker(Math.max(x + 18, 70), 4, { delay: 0.6 });
          go(3);
        }
        break;
      case 3:
        if (api.enemiesAlive === 0 && S.t > 1.5) {
          api.spawnWalker(Math.min(88, Math.max(x + 14, 82)), -3);
          for (const [dx, z, d] of [[0, 3, 0.3], [2, -5, 0.6], [3, 1, 1]]) api.spawnDog(Math.min(88, Math.max(x + 12, 78)) + dx, z, { delay: d });
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
          api.depot(shackA, { offers: PARTS4, count: 3, onLeave: () => startSector2(api) });
        }
        break;
    }
  }

  // 2: the crossroads, on to the depot
  function startSector2(api) {
    S.sector = 1;
    go(0);
    setBounds(api, B2);
    api.sectors(SECTORS, 1, 'Level 4');
    api.objective('Reach the depot');
  }
  function sector2(api) {
    const x = api.tankPos.x;
    zoneBounds(api);
    if (S.step < 5 && x > shackB.x0 - 9) {
      openShack(api, shackB);
      go(5);
    }
    switch (S.step) {
      case 0:
        if (x > 120 || S.t > 4) {
          for (const [dx, z, d] of [[0, -3, 0], [2, 3, 0.4], [4, 0, 0.8]]) api.spawnDog(Math.min(x + 18, CROSS.x0 - 4) + dx, z, { delay: d });
          go(1);
        }
        break;
      case 1:
        if (api.enemiesAlive <= 1 && S.t > 2 && x > CROSS.x0 - 14) {
          // at the crossing: over both barricades at once
          for (const [kind, s, d] of [['dog', -1, 0], ['dog', -1, 0.5], ['walker', 1, 0.3], ['dog', 1, 0.9]]) overBarricade(api, kind, s, d);
          go(2);
        }
        break;
      case 2:
        if (api.enemiesAlive <= 1 && S.t > 3) {
          api.spawnDrone(CROSS.x1 + 4, -28, { via: [[CROSS.x1, -8]] });
          overBarricade(api, 'walker', -1, 0.4);
          overBarricade(api, 'dog', 1, 0.8);
          overBarricade(api, 'dog', 1, 1.2);
          go(3);
        }
        break;
      case 3:
        if (api.enemiesAlive === 0 && S.t > 1.5) {
          // the last stretch: they come out of the depot's yard to meet you
          api.spawnWalker(Math.max(x + 16, 190), -3);
          api.spawnWalker(Math.max(x + 18, 192), 3.5, { delay: 0.7 });
          for (const [dx, z, d] of [[0, 0, 0.3], [2, -5, 0.6], [3, 5, 1]]) api.spawnDog(Math.min(196, Math.max(x + 14, 182)) + dx, z, { delay: d });
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
          api.depot(shackB, { offers: PARTS4, count: 2, onLeave: () => startSector3(api) });
        }
        break;
    }
  }

  // 3: the depot hall, its boss, the way out
  function startSector3(api) {
    S.sector = 2;
    go(0);
    setBounds(api, { ...B3, maxX: 244 });
    setExit(true); // (the light from the far end, in view all the way down)
    api.sectors(SECTORS, 2, 'Level 4');
    api.objective('Get through the depot');
    api.arrow(new THREE.Vector3(HALL.x1 - 2, 1.6, DOOR.z), 'Exit');
  }
  function sector3(api, dt) {
    const x = api.tankPos.x;
    switch (S.step) {
      case 0:
        if (S.t > 1.2) {
          for (const [kind, dx, z, d] of [['dog', 0, -4, 0], ['dog', 2, 3, 0.4], ['dog', 4, -1, 0.8], ['walker', 8, 4, 1.2]]) hallSpawn(api, kind, 228 + dx, z, d);
          go(1);
        }
        break;
      case 1:
        if (api.enemiesAlive <= 1 && S.t > 3) {
          hallSpawn(api, 'walker', 240, -6);
          hallSpawn(api, 'walker', 242, 5, 0.6);
          hallSpawn(api, 'dog', 238, 0, 0.3);
          hallSpawn(api, 'dog', 240, -2, 1);
          setBounds(api, { maxX: B3.maxX });
          go(2);
        }
        break;
      case 2:
        if (api.enemiesAlive <= 1 && S.t > 3) {
          hallSpawn(api, 'drone', 246, 0);
          for (const [kind, dx, z, d] of [['dog', 0, 4, 0.3], ['dog', 2, -5, 0.6], ['walker', 4, 0, 1]]) hallSpawn(api, kind, 250 + dx, z, d);
          go(3);
        }
        break;
      case 3:
        if (api.enemiesAlive === 0 && S.t > 1.5 && x > 244) {
          // on for the light: the door slams down, and the drone comes out
          // from behind the containers at the far end
          setExit(false);
          api.arrow(null);
          setBounds(api, { minX: 240 });
          S.boss = api.spawnArty(280, -6, { yaw: Math.PI });
          api.boss(S.boss, 'Artillery drone');
          api.objective('Destroy the artillery drone');
          api.spotlight({ targets: [() => (S.boss.alive ? new THREE.Vector3(S.boss.pos.x, 2, S.boss.pos.z) : null)], r: 170 }, () => S.t > 2.2, { maxTime: 2.6, frame: () => (S.boss.alive ? S.boss.pos.clone() : null), frameK: 1 });
          S.waveT = 16;
          go(4);
        }
        break;
      case 4:
        S.waveT -= dt;
        if (S.boss.alive && S.waveT <= 0 && api.enemiesAlive < 4) {
          S.waveT = 20;
          for (const [dz, d] of [[-5, 0], [5, 0.5]]) api.spawnDog(HALL.x1 - 3, DOOR.z + dz, { delay: d });
        }
        if (!S.boss.alive) {
          api.clearEnemies();
          setExit(true);
          api.cameraTo(new THREE.Vector3(HALL.x1, 0, DOOR.z), 2.2); // (over to the way out, then back)
          setBounds(api, { maxX: HALL.x1 + 8 });
          api.objective('Out into the light');
          api.arrow(new THREE.Vector3(HALL.x1 - 2, 1.6, DOOR.z), 'Exit');
          go(5);
        }
        break;
      case 5:
        // out through the light: gone, as into a checkpoint
        if (x > HALL.x1 - 4 && Math.abs(api.tankPos.z - DOOR.z) < DOOR.half) {
          api.arrow(null);
          api.sectors(SECTORS, 3, 'Level 4');
          api.win('Level clear', { path: [[HALL.x1 + 6, DOOR.z], [HALL.x1 + 40, DOOR.z]] });
          go(6);
        }
        break;
    }
  }

  function skipStage(api) {
    if (S.sector === 2 && S.step === 4 && S.boss?.alive) {
      api.clearSpot();
      api.blast(S.boss.pos.clone().setY(1), 0.5, 99999);
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
    if (S.step < 3) {
      go(3);
      setBounds(api, { maxX: B3.maxX });
      api.teleport(246, DOOR.z, 0);
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
    // the exit door: slams down fast, goes up slowly
    exit.open += THREE.MathUtils.clamp(exit.want - exit.open, -dt * 3.5, dt * 0.8);
    exitDoor.position.y = exit.open * 4.8;
    exitDoor.scale.y = 1 - exit.open * 0.9;
    exitPool.material.opacity = 0.32 * exit.open;
    exitLight.level = exit.open;
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
    inHall, // (for tests)
    start,
    update,
    skipStage,
  };
}
