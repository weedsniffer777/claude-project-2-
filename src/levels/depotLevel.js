// Level 4: the depot, on a late winter afternoon, the sun low behind the
// far side. On along the highway from level 3, down off it into the city,
// and through a tram depot.
//
// Layout (world +X runs bottom-left to top-right on screen):
//  1 The highway: on along the elevated deck, wrecks and barricades, the
//    city below either side; then an off-ramp down to the street, and a
//    checkpoint across the street at its foot.
//  2 The streets: a street of panel blocks and works buildings, lamps and
//    trolley wires, heat pipes along the near side; across a crossroads
//    whose side streets are barricaded off (machines come over them); to a
//    checkpoint built into the depot's front wall.
//  3 The depot: its back door opens straight into the tram hall. Dim and
//    dingy, the trams parked in their bays on the rails set in the floor;
//    the low sun comes in through the high windows along the back wall in
//    long dusty beams. The far end's gate is shut: going for it brings out
//    the artillery drone. Kill it, the gate goes up, out into the light.
import * as THREE from 'three';
import { addAfternoon, AFTERNOON_SUN } from '../render/setup.js';
import { box, cyl, put, toon, gradientMap, setLowPoly } from '../models/kit.js';
import { LevelBuilder, canvas, tex, blob, speckle } from './builder.js';
import * as P from './props.js';
import { buildShack } from './depot.js';
import { buildDepotRoom } from './depotRoom.js';
import { rails } from './rails.js';
import { deckTexture, roadSign } from './highway.js';
import { sidewalkTexture, glyphSign, mapMat } from './cityTextures.js';
import { cityKit, CONCRETE, BURNT_PAINT, CONTAINERS } from './cityKit.js';
import { streetKit } from './streetKit.js';

const GPX = 5;
const MAP = { x0: -80, x1: 352, z0: -60, z1: 50 };
const START_X = -40;
const CURB = { n: -7.5, s: 6.5 };
const WALK = { n: -10, s: 9 };
const SW = 0.16;
// the highway
const DECK = 4.5;
const DZ = -0.5;
const DECK_Z = 8.6;
const RAMP = { x0: 72, x1: 108 }; // the off-ramp, down to the street
const SIDE = { n: -14, s: 13 }; // the streets beside and under the deck: their blocks
const TRACKS = [-4.4, 3.4];
const SHACK_A = { x0: 116, x1: 123.6 }; // across the street at the ramp's foot
// the streets
const CROSS = { x0: 158, x1: 180 }; // the crossroads: the side streets' width
const CROSS_Z = 24; // how far up and down them the barricades are
const SHACK_B = { x0: 214, x1: 221.6 }; // built into the depot's front wall
// the hall
const HALL = { x0: 222, x1: 306, n: -17, s: 15 };
const HALL_H = 9.5;
const DOOR = { z: -1, half: 4 }; // the gate out, in the far wall
const BAYS = { n: -12, mid: DOOR.z, s: 10.8 }; // the tracks down the hall

const onDeckZ = (z) => Math.abs(z - DZ) < DECK_Z;
const inCross = (x) => x > CROSS.x0 && x < CROSS.x1;
function heightAt(x, z) {
  if (x < RAMP.x0 && onDeckZ(z)) return DECK;
  if (x >= RAMP.x0 && x < RAMP.x1 && onDeckZ(z)) return (DECK * (RAMP.x1 - x)) / (RAMP.x1 - RAMP.x0);
  if (x < RAMP.x1) return z <= SIDE.n + 2 || z >= SIDE.s - 2 ? SW : 0;
  if (x >= HALL.x0 - 0.5 || inCross(x)) return 0;
  return z <= CURB.n || z >= CURB.s ? SW : 0;
}
// where the sun comes from: rays through a point, down to the floor
const SUN_DIR = AFTERNOON_SUN.clone().negate().normalize();
const toGround = (p, h = 0) => {
  const t = (p.y - h) / -SUN_DIR.y;
  return new THREE.Vector3(p.x + SUN_DIR.x * t, h, p.z + SUN_DIR.z * t);
};

// The outdoor ground: snowy sidewalks, slushy asphalt under and beside the
// highway, the street after it, the cross street.
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
    [MAP.x0, SIDE.n + 2, RAMP.x1, SIDE.s - 2],
    [RAMP.x1, CURB.n, HALL.x0, CURB.s],
    [CROSS.x0 + 2, MAP.z0, CROSS.x1 - 2, MAP.z1],
  ];
  for (const [x0, z0, x1, z1] of asphalt) {
    rect(x0, z0, x1, z1, '#5e5f64');
    speckle(g, X(x1) - X(x0), Z(z1) - Z(z0), ['#68696e', '#54555a', '#6e6e72'], (X(x1) - X(x0)) * (Z(z1) - Z(z0)) * 0.05, rand, Z(z0), X(x0));
    const n = ((x1 - x0) * (z1 - z0)) / 2.5;
    for (let i = 0; i < n; i++) {
      const x = x0 + rand() * (x1 - x0);
      const z = z0 + 0.3 + rand() * (z1 - z0 - 0.6);
      const nearEdge = Math.min(z - z0, z1 - z) < 1.3;
      g.fillStyle = nearEdge ? (rand() < 0.5 ? '#a9a8a6' : '#9a9996') : rand() < 0.5 ? '#88867f' : '#78766f';
      blob(g, X(x), Z(z), (0.5 + rand() * 1.3) * GPX, (0.35 + rand() * 0.6) * GPX, rand, 9);
    }
  }
  // dark wet patches and oil under the highway (out of the snow)
  for (let i = 0; i < 90; i++) {
    g.fillStyle = rand() < 0.5 ? 'rgba(40,40,44,0.35)' : 'rgba(70,60,50,0.25)';
    blob(g, X(MAP.x0 + rand() * (RAMP.x1 - MAP.x0)), Z(DZ + (rand() - 0.5) * DECK_Z * 2), (1 + rand() * 3) * GPX, (0.6 + rand() * 2) * GPX, rand, 10);
  }
  // the crossing: worn zebra stripes either side
  g.fillStyle = '#c9c6bd';
  for (const x of [CROSS.x0 + 0.6, CROSS.x1 - 2.4])
    for (let z = CURB.n + 0.6; z < CURB.s - 0.6; z += 1.1) for (let k = 0; k < 9; k++) if (rand() > 0.15) g.fillRect(X(x) + k * 2, Z(z), 2, 0.55 * GPX);
  // centre dashes, worn
  g.fillStyle = '#aaa79e';
  for (let x = RAMP.x1; x < HALL.x0; x += 1) if (rand() > 0.45 && !inCross(x)) g.fillRect(X(x), Z(-0.6), GPX, 2);
  // the yard in front of the depot: oil, tyre tracks into it
  g.fillStyle = 'rgba(30,28,26,0.4)';
  for (let i = 0; i < 30; i++) blob(g, X(200 + rand() * 20), Z(CURB.n + rand() * (CURB.s - CURB.n)), (0.5 + rand() * 1.5) * GPX, (0.4 + rand()) * GPX, rand, 9);
  return tex(c);
}

// The hall's floor: old dark concrete in slabs, grime and oil, grease down
// the tracks, faded bay lines either side of them, hazard stripes at the
// doors, two inspection pits on the middle track.
function hallFloor(rand) {
  const K = 6;
  const W = (HALL.x1 - HALL.x0 + 1) * K;
  const H = (HALL.s - HALL.n) * K;
  const [c, g] = canvas(W, H);
  const X = (x) => (x - HALL.x0) * K;
  const Z = (z) => (z - HALL.n) * K;
  g.fillStyle = '#55534f';
  g.fillRect(0, 0, W, H);
  speckle(g, W, H, ['#4d4b48', '#5e5c58', '#474542', '#625f5a'], W * H * 0.08, rand);
  g.fillStyle = '#42403d';
  for (let x = 0; x < W; x += 4 * K) g.fillRect(x, 0, 1, H);
  for (let z = 0; z < H; z += 4 * K) g.fillRect(0, z, W, 1);
  for (let i = 0; i < 50; i++) {
    g.fillStyle = rand() < 0.5 ? '#4a4845' : '#5a5853';
    g.fillRect((((rand() * W) / (4 * K)) | 0) * 4 * K + 1, (((rand() * H) / (4 * K)) | 0) * 4 * K + 1, 4 * K - 2, 4 * K - 2);
  }
  for (let i = 0; i < 180; i++) {
    g.fillStyle = ['rgba(20,18,16,0.5)', 'rgba(30,26,22,0.4)', 'rgba(90,60,35,0.3)'][(rand() * 3) | 0];
    blob(g, rand() * W, rand() * H, (0.5 + rand() * 2.2) * K, (0.4 + rand() * 1.4) * K, rand, 10);
  }
  for (const z of Object.values(BAYS)) {
    g.fillStyle = 'rgba(18,16,14,0.45)';
    for (let x = 0; x < W; x += 2) if (rand() > 0.2) g.fillRect(x, Z(z) - 0.3 * K, 2, 0.6 * K);
  }
  g.fillStyle = '#a58a3e';
  for (const z of [BAYS.n - 2, BAYS.n + 2, BAYS.s - 2, BAYS.s + 2]) for (let x = 2; x < HALL.x1 - HALL.x0 - 2; x += 1.4) if (rand() > 0.25) g.fillRect(X(HALL.x0 + x), Z(z), 0.8 * K, 0.18 * K);
  const hazard = (x0, z0, x1, z1) => {
    for (let x = X(x0); x < X(x1); x++)
      for (let z = Z(z0); z < Z(z1); z++) {
        g.fillStyle = ((x + z) / 6) % 2 < 1 ? '#c99a2e' : '#26272a';
        g.fillRect(x, z, 1, 1);
      }
  };
  hazard(HALL.x0 + 0.3, CURB.n + 0.6, HALL.x0 + 1.3, CURB.s - 0.6);
  hazard(HALL.x1 - 1.6, DOOR.z - DOOR.half, HALL.x1 - 0.4, DOOR.z + DOOR.half);
  for (const x of [256, 282]) {
    g.fillStyle = '#121214';
    g.fillRect(X(x - 3.2), Z(BAYS.mid - 0.45), 6.4 * K, 0.9 * K);
    hazard(x - 3.4, BAYS.mid - 0.9, x + 3.4, BAYS.mid - 0.6);
    hazard(x - 3.4, BAYS.mid + 0.6, x + 3.4, BAYS.mid + 0.9);
  }
  return tex(c);
}

// The hall's long back wall, seen from inside: grimy concrete in panels,
// the lower part painted a tired green, a band of tall windows high up
// (bright afternoon beyond: the panes glow), rust and soot streaks.
const WIN = { y0: HALL_H - 4.2, y1: HALL_H - 1.4, w: 2.6, every: 5, first: 3 }; // sills and heads, width, spacing
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
  const top = (h - WIN.y1) * S;
  const wh = (WIN.y1 - WIN.y0) * S;
  for (let x = WIN.first; x + WIN.w < w - 1; x += WIN.every) {
    const wx = x * S;
    const pw = WIN.w * S;
    for (let k = 0; k < 3; k++)
      for (let r = 0; r < 4; r++) {
        const gone = rand() < 0.2;
        g.fillStyle = ge.fillStyle = gone ? '#fff2d8' : rand() < 0.5 ? '#c9c2b0' : '#a8a596';
        const px = wx + (k * pw) / 3 + 1;
        const py = top + (r * wh) / 4 + 1;
        g.fillRect(px, py, pw / 3 - 2, wh / 4 - 2);
        ge.fillRect(px, py, pw / 3 - 2, wh / 4 - 2);
      }
    g.fillStyle = '#2a2b2d';
    g.fillRect(wx - 2, top - 2, pw + 4, 2);
    g.fillRect(wx - 2, top + wh, pw + 4, 3);
    for (let i = 0; i < 4; i++) {
      g.fillStyle = rand() < 0.5 ? 'rgba(80,55,35,0.4)' : 'rgba(25,24,22,0.35)';
      g.fillRect(wx + rand() * pw, top + wh + 3, 1 + ((rand() * 2) | 0), (rand() * 3 * S) | 0);
    }
  }
  g.fillStyle = 'rgba(20,20,20,0.35)';
  g.fillRect(0, 0, c.width, 0.8 * S);
  return { map: tex(c), emissiveMap: tex(ce) };
}
// the windows' spans along x (world), matching the texture
function windowsX() {
  const out = [];
  const x0 = HALL.x0 - 0.5;
  const w = HALL.x1 - HALL.x0 + 1;
  for (let x = WIN.first; x + WIN.w < w - 1; x += WIN.every) out.push([x0 + x, x0 + x + WIN.w]);
  return out;
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
  const B = new LevelBuilder(scene, 4207); // the city
  const rand = B.rand;
  const D = new LevelBuilder(scene, 4211); // up on the highway deck
  D.root.position.y = DECK;
  const H = new LevelBuilder(scene, 4219); // the hall (all that's left in view inside it)
  const light = addAfternoon(scene, { shadowSize: 24, shadowMap: 2048 });
  const K = cityKit(B, { WALK, SW, heightAt });
  const sign = (w, h, o = {}) => mapMat(glyphSign(w, h, { rand, ...o }));
  const ST = streetKit(B, { CURB, WALK, SW, heightAt, sign });

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
  slab(MAP.x0, RAMP.x1, -34, SIDE.n + 2);
  slab(MAP.x0, RAMP.x1, SIDE.s - 2, 34);
  for (const [x0, x1] of [[RAMP.x1, CROSS.x0], [CROSS.x1, HALL.x0 - 0.5]]) {
    slab(x0, x1, -34, CURB.n);
    slab(x0, x1, CURB.s, 34);
  }
  for (const [z, dir] of [[CURB.n - 0.35, -1], [CURB.s + 0.35, 1]]) {
    for (let x = RAMP.x1; x < HALL.x0 - 2; x += 0.6) {
      if (inCross(x) || (x > SHACK_A.x0 - 1 && x < SHACK_A.x1 + 1)) continue;
      if (rand() < 0.15) x += 2;
      B.lump(x, SW, z + dir * rand() * 0.25, 0.5 + rand() * 0.4, 0.18 + rand() * 0.15, 0.35 + rand() * 0.2, rand() < 0.3 ? 0xa9aaac : 0xc7cacf, rand() * 3);
    }
  }
  for (let i = 0; i < 360; i++) {
    const x = RAMP.x1 + rand() * (HALL.x0 - RAMP.x1);
    const z = WALK.n + rand() * (WALK.s - WALK.n);
    const s = 0.08 + rand() * 0.22;
    B.piece(s * (1 + rand()), s * 0.6, s, rand() < 0.25 ? 0x7a5e50 : CONCRETE[(rand() * 5) | 0], x, heightAt(x, z) + s * 0.25, z, rand(), rand() * 3, rand());
  }
  {
    const R = rails(B, rand);
    R.track(R.straight(RAMP.x1 + 2, BAYS.mid - 1.2, HALL.x0, BAYS.mid - 1.2));
    R.track([...R.straight(RAMP.x1 + 2, 1.55, CROSS.x0 - 2, 1.55), ...R.bend({ x: CROSS.x0 - 2, z: 1.55 }, { x: CROSS.x0 + 9, z: 1.55 }, { x: CROSS.x0 + 9, z: 14 }).slice(1), ...R.straight(CROSS.x0 + 9, 14, CROSS.x0 + 9, CROSS_Z + 4).slice(1)]);
  }

  // ======================================================= 1: the highway
  const sideMat = toon(0x8a8780);
  {
    const x0 = MAP.x0 + 4;
    const len = RAMP.x0 - x0;
    const cx = (x0 + RAMP.x0) / 2;
    const top = new THREE.MeshToonMaterial({ map: deckTexture(rand, len), gradientMap });
    const slabM = new THREE.Mesh(new THREE.BoxGeometry(len, 0.9, DECK_Z * 2), [sideMat, sideMat, top, toon(0x6a675f), sideMat, sideMat]);
    slabM.position.set(cx, -0.45, DZ);
    slabM.receiveShadow = slabM.castShadow = true;
    D.add(slabM);
    D.solid(slabM);
    for (const s of [-1, 1]) D.piece(len, 0.5, 0.2, 0x7a776f, cx, -0.7, DZ + s * (DECK_Z + 0.05));
    for (const s of [-1, 1]) {
      const z = DZ + s * (DECK_Z - 0.25);
      for (let x = x0; x < RAMP.x0; x += 2) {
        const bent = rand() < 0.06;
        D.piece(0.1, 0.8, 0.1, 0x6f7276, x, 0.4, z, bent ? s * 0.4 : 0, 0, 0);
        if (rand() > 0.05) D.piece(2.02, 0.28, 0.06, 0xa9adb2, x + 1, bent ? 0.45 : 0.62, z + (bent ? s * 0.15 : 0), 0, 0, bent ? 0.08 : 0);
      }
      D.block(cx, z, len / 2, 0.3);
    }
    for (let x = x0 + 6; x < RAMP.x0; x += 16) {
      for (const z of [DZ - 5, DZ + 5]) put(B.root, box(1.3, DECK - 0.9, 1.3, 0x8a8780, { r: 0.04 }), x, (DECK - 0.9) / 2, z).castShadow = true;
      put(B.root, box(1.5, 0.8, DECK_Z * 2 - 1, 0x7d7a73, { r: 0.04 }), x, DECK - 1.3, DZ);
    }
    for (let x = START_X + 8; x + 3 < RAMP.x0 - 6; x += 12) {
      if (x > 20 && x < 34) continue;
      const l = Math.min(9, RAMP.x0 - 6 - x);
      const m = put(D.root, box(l, 0.8, 0.5, 0x9a978f, { r: 0.04 }), x + l / 2, 0.4, DZ);
      D.solid(m);
      D.block(x + l / 2, DZ, l / 2, 0.25);
      D.lump(x + l / 2, 0.82, DZ, l / 2.4, 0.06, 0.2, 0xd0d3d8);
    }
    const R = rails(D, rand);
    for (const z of TRACKS) R.track(R.straight(x0 + 1, z, RAMP.x0, z));
    for (let x = START_X + 6; x < RAMP.x0; x += 22) {
      for (const s of [-1, 1]) {
        const z = DZ + s * (DECK_Z - 0.1);
        put(D.root, cyl(0.1, 7, 0x8b8984, { seg: 8, radiusEnd: 0.14 }), x, 3.5, z);
        put(D.root, box(0.1, 0.1, 2.2, 0x4a4c50, { r: 0.02 }), x, 6.9, z - s * 1.05);
        put(D.root, box(0.5, 0.16, 0.7, 0x3c3e42, { r: 0.05 }), x, 6.85, z - s * 2.1);
        put(D.root, box(0.36, 0.05, 0.5, 0xffb15a, { r: 0.01, glow: true }), x, 6.75, z - s * 2.1);
        D.emit(new THREE.Vector3(x, 5.4, z - s * 2.1), 0xffa245, 14, 10);
        D.pool(x, z - s * 2.4, 3, 0xffa245, 0.18);
        D.block(x, z, 0.2, 0.2);
      }
    }
    for (let z = DZ - DECK_Z + 1; z < DZ + DECK_Z - 1; z += 2.4) K.rubble(D, START_X - 4 + (rand() - 0.5), z, 2.4 + rand(), 2 + rand() * 1.4, { slabs: 2 });
    D.block(START_X - 4, DZ, 2, DECK_Z);
  }
  function gantry(x, boards) {
    for (const z of [DZ - DECK_Z + 0.6, DZ + DECK_Z - 0.6]) {
      put(D.root, box(0.3, 6.2, 0.3, 0x6f7276, { r: 0.03 }), x, 3.1, z).castShadow = true;
      D.block(x, z, 0.3, 0.3);
    }
    put(D.root, box(0.4, 0.5, DECK_Z * 2 - 1, 0x5a5d61, { r: 0.03 }), x, 6.2, DZ);
    for (const [z, w, kind] of boards) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.8), new THREE.MeshToonMaterial({ map: roadSign(w, 1.8, rand, kind), gradientMap }));
      m.rotation.y = -Math.PI / 2;
      m.position.set(x - 0.25, 5.2, z);
      D.add(m);
      put(D.root, box(0.08, 1.85, w + 0.05, 0x3a3c3f, { r: 0.01 }), x - 0.18, 5.2, z).castShadow = true;
    }
  }
  gantry(4, [[DZ - 3.8, 5, 'ahead'], [DZ + 3.6, 5, 'exit']]);
  gantry(58, [[DZ, 7, 'exit']]);
  const wreck = (BB, x, z, yaw, o) => BB.crushable(() => P.car(BB, x, z, yaw, o), { kind: 'car', scrap: 2 });
  wreck(D, -26, 3.6, 0.3, { kind: 'sedan', paint: BURNT_PAINT[2], snow: false });
  wreck(D, -12, -5.6, -0.4, { kind: 'van', paint: 0x6b7458, snow: false });
  wreck(D, 8, 4.8, 0.6, { kind: 'hatch', paint: BURNT_PAINT[1], snow: false, flipped: true });
  wreck(D, 40, -6, -0.2, { kind: 'sedan', paint: BURNT_PAINT[3], snow: false });
  wreck(D, 50, 5.4, 0.9, { kind: 'van', paint: 0x7b7f78, snow: false });
  P.tram(D, 24, TRACKS[0], 0.03, { tilt: 0.04, burn: 0.8, snow: false });
  K.container(D, 32, 0, 4.4, 0.5, CONTAINERS[0]);
  for (const [x, z, yaw] of [[-4, -1.5, 1.5], [16, 1, 1.6], [46, -1.2, 1.4], [62, 6.2, 1.5]]) K.jersey(D, x, z, yaw, 1.0, 1.8);
  for (const [x, z, r] of [[-18, -3, 1.4], [38, -2.2, 1.6]]) K.rubble(D, x, z, r, 1.0, { slabs: 2, solid: true });
  for (let i = 0; i < 260; i++) {
    const x = START_X + rand() * (RAMP.x0 - START_X);
    const z = DZ + (rand() - 0.5) * (DECK_Z * 2 - 1.6);
    const s = 0.08 + rand() * 0.25;
    D.piece(s * (1 + rand()), s * 0.6, s, rand() < 0.2 ? 0x2a2b2e : CONCRETE[(rand() * 5) | 0], x, s * 0.25, z, rand(), rand() * 3, rand());
  }
  for (const [x, z, r] of [[-20, 1, 1.1], [12, -3, 0.9], [44, 2, 1.2]]) {
    D.pool(x, z, r, 0x2a2b2f, 0.85, { sx: 1, sz: 0.8, y: 0.02 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + rand() * 0.4;
      D.piece(0.35 + rand() * 0.3, 0.1, 0.3, 0x4c4d52, x + Math.cos(a) * r, 0.06, z + Math.sin(a) * r * 0.8, Math.sin(a) * 0.5, -a, Math.cos(a) * 0.5);
    }
  }
  for (const [x, z, r] of [[-30, -4, 2], [20, 2, 1.6], [54, -3, 2.2]]) P.scorch(D, x, z, r);
  // the off-ramp down to the street
  {
    const len = RAMP.x1 - RAMP.x0;
    const ang = Math.atan2(DECK, len);
    const L = Math.hypot(len, DECK);
    const top = new THREE.MeshToonMaterial({ map: deckTexture(rand, L), gradientMap });
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(L, 0.6, DECK_Z * 2), [sideMat, sideMat, top, sideMat, sideMat, sideMat]);
    ramp.position.set((RAMP.x0 + RAMP.x1) / 2, DECK / 2 - 0.3 * Math.cos(ang), DZ);
    ramp.rotation.z = -ang;
    ramp.receiveShadow = ramp.castShadow = true;
    B.add(ramp);
    B.solid(ramp);
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(len, 0);
    shape.lineTo(0, DECK - 0.55);
    const wedge = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: DECK_Z * 2 - 0.1, bevelEnabled: false }), toon(0x8d8a83));
    wedge.position.set(RAMP.x0, 0, DZ - DECK_Z + 0.05);
    wedge.receiveShadow = true;
    B.add(wedge);
    for (const s of [-1, 1]) {
      const z = DZ + s * (DECK_Z - 0.2);
      const wall = new THREE.Mesh(new THREE.BoxGeometry(L, 0.9, 0.35), toon(0x9a978f));
      wall.position.set((RAMP.x0 + RAMP.x1) / 2, DECK / 2 + 0.45, z);
      wall.rotation.z = -ang;
      wall.castShadow = true;
      B.add(wall);
      B.solid(wall);
      for (let x = RAMP.x0 + 3; x < RAMP.x1; x += 3) B.piece(0.06, 0.92, 0.37, 0x86837c, x, heightAt(x, DZ) + 0.45, z, 0, 0, -ang);
      for (let x = RAMP.x0; x < RAMP.x1; x += 2) B.block(x + 1, z, 1, 0.25);
      for (let x = RAMP.x0 + 1; x < RAMP.x1; x += 1.4) B.lump(x, heightAt(x, DZ) + 0.05, z - s * 0.4, 0.5 + rand() * 0.4, 0.12, 0.25, 0xc7cacf, rand() * 3);
      put(B.root, box(0.8, 1.4, 0.8, 0x8d8a83, { r: 0.04 }), RAMP.x1 + 0.4, 0.7, z);
    }
  }
  // the city either side of the highway, down at street level
  {
    let x = MAP.x0 + 2;
    let k = 0;
    while (x < RAMP.x1 - 4) {
      const x1 = Math.min(RAMP.x1 - 2, x + 16 + rand() * 12);
      if (k % 3 === 1) K.works({ x0: x, x1, zf: SIDE.n, roof: ['saw', 'flat', 'gable'][k % 3], wall: [0x8a9a8e, K.BRICK, 0x9a8f7a][k % 3], tin: k % 2 === 0, doors: 2 });
      else K.building({ x0: x, x1, zf: SIDE.n, floors: 6 + ((rand() * 4) | 0), shop: rand() < 0.4, holes: 1 + ((rand() * 2) | 0) });
      x = x1 + 2 + rand() * 3;
      k++;
    }
    x = MAP.x0 + 2;
    k = 0;
    while (x < RAMP.x1 - 4) {
      const x1 = Math.min(RAMP.x1 - 2, x + 14 + rand() * 10);
      if (k % 2) ST.garages(x + 1.5, Math.max(1, Math.floor((x1 - x) / 3.1)), SIDE.s);
      else K.southBlock(x, x1, 2, SIDE.s);
      x = x1 + 2 + rand() * 2;
      k++;
    }
    for (let x2 = MAP.x0 + 14; x2 < RAMP.x1 - 6; x2 += 20 + rand() * 14) P.car(B, x2, rand() < 0.5 ? SIDE.n + 3.2 : SIDE.s - 3.2, rand() * 0.6 - 0.3, { kind: ['sedan', 'hatch', 'van'][(rand() * 3) | 0], paint: BURNT_PAINT[(rand() * 6) | 0], solidBlock: false });
  }

  // ======================================================= 2: the streets
  K.building({ x0: RAMP.x1 - 2, x1: SHACK_A.x0, floors: 7, shop: true });
  K.building({ x0: SHACK_A.x1, x1: 138, floors: 8, shop: true, sign: '#ffcf8a' });
  K.works({ x0: 141, x1: CROSS.x0, zf: WALK.n, roof: 'saw', wall: 0x8a9a8e, doors: 2 });
  K.building({ x0: CROSS.x1, x1: 194, floors: 7, holes: 2, mural: true });
  K.works({ x0: 197, x1: SHACK_B.x0, zf: WALK.n, roof: 'flat', wall: K.BRICK, tin: false, doors: 1, dock: true });
  ST.garages(RAMP.x1 + 1, 2, WALK.s + 4);
  K.southBlock(SHACK_A.x1, 132, 2);
  ST.pipes(132.5, CROSS.x0 - 1);
  ST.garages(CROSS.x1 + 3, 6, WALK.s + 4);
  ST.pipes(CROSS.x1 + 0.5, SHACK_B.x0 - 0.5);
  ST.pipeArch(202);
  ST.ruinedWall(136, 150, WALK.s + 6);
  ST.kiosk(150, WALK.s - 0.7);
  ST.shelter(186, WALK.n + 1.1, 1);
  ST.barrelFire(146, WALK.n + 1.2);
  ST.barrelFire(192, WALK.s + 4.2);
  for (const [x, z, h] of [[128, WALK.s + 3.5, 4.2], [134, WALK.s + 4.4, 3.6], [196, WALK.s + 3.4, 4.4]]) ST.birch(x, z, h);
  for (const [x, ry] of [[130, 0.2], [190, -0.3]]) ST.fallenSlab(x, ry);
  P.billboard(B, 140, WALK.s + 9, 0.15, (w, h) => sign(w, h, { board: '#4f5b62', ink: '#c6bfa8' }));
  ST.lights({ xs: [112, 126, 140, 154, 184, 198, 210], skip: (x) => x > SHACK_A.x0 - 2 && x < SHACK_A.x1 + 2 });
  ST.signal(CROSS.x0 - 1, CURB.s + 0.5, -1, 'cycle');
  ST.signal(CROSS.x1 + 1, CURB.n - 0.5, 1, 'blink');
  ST.clutter(SHACK_A.x1 + 2, SHACK_B.x0 - 2, 8, (x) => (x > CROSS.x0 - 2 && x < CROSS.x1 + 2) || (x > 148 && x < 152) || (x > 184 && x < 188));
  for (const s of [-1, 1]) {
    for (let x = CROSS.x0 + 1; x < CROSS.x1; x += 2.2) {
      const r = rand();
      if (r < 0.45) K.jersey(B, x + 0.6, s * CROSS_Z, (rand() - 0.5) * 0.3, 0.9, 2);
      else if (r < 0.7) K.rubble(B, x + 0.6, s * (CROSS_Z + 0.4), 1.4, 1.1, { slabs: 1 });
      else for (const a of [0.8, -0.8, 0]) B.piece(1.9, 0.18, 0.18, 0x4a4c50, x + 0.6, 0.6, s * CROSS_Z, a, 0.8, a ? 0.7 : 1.57);
    }
    B.block((CROSS.x0 + CROSS.x1) / 2, s * CROSS_Z, (CROSS.x1 - CROSS.x0) / 2, 0.8);
    K.container(B, CROSS.x0 + 6, 0, s * (CROSS_Z + 2.4), 0.05, CONTAINERS[(rand() * 5) | 0]);
    if (s < 0) {
      K.building({ x0: CROSS.x0 - 22, x1: CROSS.x0 - 1, zf: -CROSS_Z - 6, floors: 9 });
      K.building({ x0: CROSS.x1 + 1, x1: CROSS.x1 + 24, zf: -CROSS_Z - 6, floors: 8 });
    } else {
      K.southBlock(CROSS.x0 - 22, CROSS.x0 - 1, 2, CROSS_Z + 6);
      K.southBlock(CROSS.x1 + 1, CROSS.x1 + 24, 2, CROSS_Z + 6);
    }
    for (const x of [CROSS.x0 - 1.4, CROSS.x1 + 1.4]) for (let k = 0; k < 4; k++) B.piece(0.18, 0.7, 0.18, 0x55575b, x, SW + 0.35, s * (WALK.s + 1 + k * 1.6));
  }
  B.crushable(() => P.bus(B, 166, -4.2, 0.55), { kind: 'prop', heavy: true, armored: true });
  wreck(B, 160, 4.5, -0.6, { kind: 'van', paint: 0x7b7f78 });
  wreck(B, 174, 13, 0.4, { kind: 'sedan', paint: BURNT_PAINT[2] });
  wreck(B, 162, -16, 1.2, { kind: 'hatch', paint: BURNT_PAINT[0], flipped: true });
  wreck(B, 132, -4.6, 0.4, { kind: 'sedan', paint: BURNT_PAINT[1] });
  wreck(B, 144, 3.8, -0.3, { kind: 'hatch', paint: BURNT_PAINT[5] });
  wreck(B, 200, 4.2, 0.2, { kind: 'sedan', paint: BURNT_PAINT[3], flipped: true });
  K.rubble(B, 171, 6, 1.6, 1.2, { slabs: 2, solid: true });
  for (const [x, z, yaw] of [[188, -4, 0.3], [194, 3.5, 1.4], [208, -1.2, 0.2]]) K.jersey(B, x, z, yaw, 1.0, 1.8);
  const junk = (BB, fn, scrap = 0) => BB.crushable(fn, { kind: 'prop', scrap });
  junk(B, () => P.tires(B, 210, SW, WALK.n + 1.1, 4));

  // ======================================================== 3: the depot
  // Its shell from outside: a tin hall on a brick plinth, tall all round, a
  // pitched corrugated roof, gable ends, the checkpoint shack built into
  // its front. Hidden once you're in (the cutaway takes over).
  const LEN = HALL.x1 - HALL.x0;
  const MIDX = (HALL.x0 + HALL.x1) / 2;
  const MIDZ = (HALL.n + HALL.s) / 2;
  const WID = HALL.s - HALL.n;
  const shell = new THREE.Group();
  {
    const add = (m) => {
      m.traverse((o) => o.isMesh && (o.castShadow = o.receiveShadow = true));
      shell.add(m);
      return m;
    };
    const wallBox = (w, h, d, mat, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      return add(m);
    };
    wallBox(LEN + 1, HALL_H, 0.6, K.ribMat(LEN, HALL_H, 0x7d8a82), MIDX, HALL_H / 2, HALL.s + 0.3);
    add(put(new THREE.Group(), box(LEN + 1.02, 1.4, 0.64, K.BRICK, { r: 0.02 }), MIDX, 0.7, HALL.s + 0.3));
    for (const [x0, x1] of windowsX()) shell.add(put(new THREE.Group(), box(x1 - x0, WIN.y1 - WIN.y0, 0.05, 0x1d2024, { r: 0 }), (x0 + x1) / 2, (WIN.y0 + WIN.y1) / 2, HALL.s + 0.62));
    // the front: full height around the checkpoint
    for (const [za, zb] of [[HALL.n - 0.8, CURB.n + 0.1], [CURB.s - 0.1, HALL.s + 0.6]]) wallBox(0.8, HALL_H, zb - za, K.ribMat(zb - za, HALL_H, 0x7d8a82), HALL.x0 - 0.4, HALL_H / 2, (za + zb) / 2);
    wallBox(0.8, HALL_H - 3.6, CURB.s - CURB.n, K.ribMat(CURB.s - CURB.n, HALL_H, 0x7d8a82), HALL.x0 - 0.4, 3.6 + (HALL_H - 3.6) / 2, (CURB.n + CURB.s) / 2);
    wallBox(0.8, HALL_H, WID + 1.4, K.ribMat(WID, HALL_H, 0x7d8a82), HALL.x1 + 0.4, HALL_H / 2, MIDZ);
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-WID / 2 - 0.7, 0);
    gableShape.lineTo(WID / 2 + 0.7, 0);
    gableShape.lineTo(0, 4.2);
    for (const x of [HALL.x0 - 0.8, HALL.x1]) {
      const gm = new THREE.Mesh(new THREE.ExtrudeGeometry(gableShape, { depth: 0.8, bevelEnabled: false }), toon(0x7d8a82));
      gm.rotation.y = Math.PI / 2;
      gm.position.set(x, HALL_H, MIDZ);
      add(gm);
    }
    const board = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.3), sign(10, 1.3, { board: '#2f3a35', ink: '#d9cfa8' }));
    board.rotation.y = -Math.PI / 2;
    board.position.set(HALL.x0 - 0.82, HALL_H + 1.3, MIDZ);
    shell.add(board);
    const pitch = Math.atan2(4.2, WID / 2 + 0.7);
    const slope = Math.hypot(4.2, WID / 2 + 0.7);
    for (const s of [-1, 1]) {
      const sheet = wallBox(LEN + 2.4, 0.14, slope + 0.3, K.ribMat(LEN, slope, 0x6d6a66), MIDX, HALL_H + 2.1, MIDZ + s * (slope / 2) * Math.cos(pitch));
      sheet.rotation.x = s * pitch;
      const snowy = put(shell, box(LEN * 0.8, 0.06, slope * 0.5, 0xd6d9dd), MIDX - 4, HALL_H + 2.25, MIDZ + s * (slope / 2) * Math.cos(pitch));
      snowy.rotation.x = s * pitch;
    }
    add(put(new THREE.Group(), box(LEN + 2.6, 0.3, 0.5, 0x45484c, { r: 0.02 }), MIDX, HALL_H + 4.25, MIDZ));
    for (let x = HALL.x0 + 6; x < HALL.x1 - 4; x += 10) {
      const rl = put(shell, box(4, 0.1, 3, 0x8fa4b0, { r: 0.01 }), x, HALL_H + 1.6, MIDZ - (slope / 2) * Math.cos(pitch));
      rl.rotation.x = -pitch;
    }
    put(shell, cyl(0.5, 3, 0x6b5843, { seg: 10 }), HALL.x1 - 12, HALL_H + 5, MIDZ - 4);
    for (const x of [HALL.x0 + 20, HALL.x0 + 44]) put(shell, cyl(0.4, 1.2, 0x7d8085, { seg: 8 }), x, HALL_H + 4.6, MIDZ + 1);
    B.add(shell);
    B.keep(shell);
  }

  // ---- the hall inside: everything in H ----
  {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(LEN + 1, WID), new THREE.MeshToonMaterial({ map: hallFloor(rand), gradientMap }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(MIDX + 0.5, 0.012, MIDZ);
    m.receiveShadow = true;
    H.add(m);
    H.solid(m);
    const v = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshBasicMaterial({ color: 0x07080a }));
    v.rotation.x = -Math.PI / 2;
    v.position.set(MIDX, -0.06, MIDZ);
    H.add(v);
    H.keep(v);
  }
  const shadowOnly = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const shade = (w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), shadowOnly);
    m.position.set(x, y, z);
    m.castShadow = true;
    H.add(m);
    H.keep(m);
    return m;
  };
  // the back wall with its windows: drawn whole; its shadow has holes where
  // the windows are, so the sun comes in through them
  {
    const tx = hallWall(LEN + 1, HALL_H, rand);
    const face = new THREE.MeshToonMaterial({ map: tx.map, emissiveMap: tx.emissiveMap, emissive: 0xffffff, emissiveIntensity: 0.85, gradientMap });
    const plain = toon(0x6f6d68);
    const back = new THREE.Mesh(new THREE.BoxGeometry(LEN + 1, HALL_H, 0.8), [plain, plain, toon(0x5a5955), plain, face, plain]);
    back.position.set(MIDX, HALL_H / 2, HALL.n - 0.4);
    back.receiveShadow = true;
    back.castShadow = false;
    H.add(back);
    H.solid(back);
    H.keep(back); // (kept out of the merge: the merge would make it cast)
    H.block(MIDX, HALL.n - 0.4, LEN / 2 + 0.5, 0.4);
    const z = HALL.n - 0.4;
    shade(LEN + 1, WIN.y0, 0.8, MIDX, WIN.y0 / 2, z);
    shade(LEN + 1, HALL_H - WIN.y1 + 0.4, 0.8, MIDX, (WIN.y1 + HALL_H + 0.4) / 2, z);
    let x = HALL.x0 - 0.5;
    for (const [x0, x1] of [...windowsX(), [HALL.x1 + 0.5, HALL.x1 + 0.5]]) {
      if (x0 > x) shade(x0 - x, WIN.y1 - WIN.y0, 0.8, (x + x0) / 2, (WIN.y0 + WIN.y1) / 2, z);
      x = x1;
    }
    for (const [x0, x1] of windowsX()) {
      for (let k = 1; k < 3; k++) shade(0.08, WIN.y1 - WIN.y0, 0.2, x0 + ((x1 - x0) * k) / 3, (WIN.y0 + WIN.y1) / 2, z + 0.3);
      for (let k = 1; k < 4; k++) shade(x1 - x0, 0.06, 0.2, (x0 + x1) / 2, WIN.y0 + ((WIN.y1 - WIN.y0) * k) / 4, z + 0.3);
    }
  }
  shade(LEN + 3, 0.3, WID + 3, MIDX, HALL_H + 0.2, MIDZ); // the roof
  {
    const low = put(H.root, box(LEN + 1, 1.3, 0.6, 0x77756f, { r: 0.02 }), MIDX, 0.65, HALL.s + 0.3);
    low.castShadow = true;
    H.solid(low);
    H.block(MIDX, HALL.s + 0.3, LEN / 2 + 0.5, 0.3);
    for (let x = HALL.x0 + 2; x < HALL.x1; x += 3 + rand() * 4) H.piece(1 + rand() * 1.5, 0.3 + rand() * 0.4, 0.62, 0x6a6863, x, 1.3 + rand() * 0.2, HALL.s + 0.3, 0, 0, (rand() - 0.5) * 0.3);
    shade(LEN + 1, HALL_H - 1.3, 0.6, MIDX, 1.3 + (HALL_H - 1.3) / 2, HALL.s + 0.3);
  }
  {
    const sideN = DOOR.z - DOOR.half - HALL.n;
    const sideS = HALL.s - (DOOR.z + DOOR.half);
    for (const [z, d] of [[HALL.n + sideN / 2, sideN], [HALL.s - sideS / 2, sideS]]) {
      const w = put(H.root, box(1, HALL_H, d, 0x6f6d68, { r: 0.02 }), HALL.x1 + 0.5, HALL_H / 2, z);
      w.castShadow = true;
      H.solid(w);
      H.block(HALL.x1 + 0.5, z, 0.5, d / 2);
    }
    put(H.root, box(1, HALL_H - 5.2, DOOR.half * 2 + 0.2, 0x6f6d68, { r: 0.02 }), HALL.x1 + 0.5, 5.2 + (HALL_H - 5.2) / 2, DOOR.z).castShadow = true;
  }
  {
    for (const [za, zb] of [[HALL.n, CURB.n + 0.1], [CURB.s - 0.1, HALL.s]]) {
      const zc = (za + zb) / 2;
      const w = put(H.root, box(1, 2.2, zb - za, 0x6f6d68, { r: 0.02 }), HALL.x0 - 0.5, 1.1, zc);
      w.castShadow = true;
      H.solid(w);
      H.block(HALL.x0 - 0.5, zc, 0.5, (zb - za) / 2);
      for (let z = za + 1; z < zb - 1; z += 2 + rand() * 3) H.piece(0.9, 0.25 + rand() * 0.4, 1 + rand() * 1.4, 0x5f5d58, HALL.x0 - 0.5, 2.2, z, 0, 0, (rand() - 0.5) * 0.4);
    }
    for (const s of [-1, 1]) put(H.root, box(0.4, 2.6, 0.4, 0x3a3c40, { r: 0.02 }), HALL.x0 - 0.3, 1.3, -0.5 + s * 3.0);
    for (let k = 0; k < 6; k++) put(H.root, box(0.42, 0.3, 0.42, k % 2 ? 0x26272a : 0xc99a2e), HALL.x0 - 0.3, 0.15 + k * 0.3, -0.5 + (k < 3 ? -3 : 3)); // hazard banding up the posts
    shade(1, HALL_H - 2.2, WID, HALL.x0 - 0.5, 2.2 + (HALL_H - 2.2) / 2, MIDZ);
  }
  {
    const STEEL = 0x4a4f55;
    const TZ = -3;
    for (let x = HALL.x0 + 7; x < HALL.x1 - 2; x += 14) {
      const span = TZ - HALL.n;
      put(H.root, box(0.22, 0.22, span, STEEL, { r: 0.01 }), x, HALL_H - 1.6, (HALL.n + TZ) / 2);
      put(H.root, box(0.2, 0.2, span, STEEL, { r: 0.01 }), x, HALL_H - 0.6, (HALL.n + TZ) / 2);
      for (let k = 0; k <= 6; k++) {
        const z = HALL.n + (k * span) / 6;
        put(H.root, box(0.1, 1.0, 0.1, STEEL), x, HALL_H - 1.1, z);
        if (k < 6) {
          const d = put(H.root, box(0.08, 0.08, Math.hypot(span / 6, 1), STEEL), x, HALL_H - 1.1, z + span / 12);
          d.rotation.x = (k % 2 ? 1 : -1) * Math.atan2(1, span / 6);
        }
      }
    }
    for (const z of [HALL.n + 4, HALL.n + 9]) put(H.root, box(LEN, 0.14, 0.14, 0x3e4247), MIDX, HALL_H - 0.45, z);
  }
  for (let x = HALL.x0 + 7; x < HALL.x1 - 2; x += 14)
    for (const z of [-8.2, 6.8]) {
      const ch = z > 0 ? 3.0 : HALL_H - 1.6;
      put(H.root, box(1.0, 0.5, 1.0, 0x8a8780, { r: 0.03 }), x, 0.25, z);
      const c = put(H.root, box(0.45, ch, 0.6, 0x4a4f55, { r: 0.01 }), x, ch / 2 + 0.5, z);
      c.castShadow = true;
      H.solid(c);
      for (const s of [-1, 1]) put(H.root, box(0.7, ch, 0.06, 0x41464c), x, ch / 2 + 0.5, z + s * 0.32);
      for (let k = 0; k < 4; k++) put(H.root, box(0.74, 0.12, 0.74, k % 2 ? 0x26272a : 0xc99a2e), x, 0.6 + k * 0.12, z);
      if (z > 0) {
        put(H.root, box(0.74, 0.08, 0.68, 0x2a2c30), x, ch + 0.52, z);
        shade(0.5, HALL_H - ch - 0.5, 0.6, x, ch + 0.5 + (HALL_H - ch - 0.5) / 2, z);
      }
      H.block(x, z, 0.5, 0.5);
    }
  // the tracks down the hall, in the floor; overhead wires on the back two
  {
    const R = rails(H, rand, { y: () => 0.012 });
    for (const z of Object.values(BAYS)) R.track(R.straight(HALL.x0 + 1, z, z === BAYS.mid ? HALL.x1 + 6 : HALL.x1 - 2, z));
    for (const z of [BAYS.n, BAYS.mid]) for (let x = HALL.x0 + 7; x + 14 < HALL.x1 - 2; x += 14) H.sagging(new THREE.Vector3(x, 6.4, z), new THREE.Vector3(x + 14, 6.4, z), 0.1);
    for (const z of [BAYS.n, BAYS.s]) {
      put(H.root, box(0.6, 0.8, 1.6, 0x3c3e42, { r: 0.03 }), HALL.x1 - 1.6, 0.4, z);
      put(H.root, box(0.2, 0.3, 1.7, 0xc99a2e), HALL.x1 - 1.95, 0.6, z);
      H.block(HALL.x1 - 1.6, z, 0.3, 0.8);
    }
  }
  // the trams in their bays; one up on jacks, its wheelsets out beside it
  P.tram(H, 236, BAYS.s, 0.0, { trailer: true, tilt: 0, burn: 0.15, snow: false });
  P.tram(H, 270, BAYS.s, 0.0, { tilt: 0, burn: 0.3, snow: false });
  P.tram(H, 264, BAYS.n, 0.0, { tilt: 0, burn: 0.1, snow: false });
  {
    const tr = P.tram(H, 238, BAYS.n, 0.0, { tilt: 0, burn: 0.05, snow: false });
    tr.position.y += 0.7;
    for (const dx of [-2.4, 2.4]) for (const dz of [-0.9, 0.9]) put(H.root, box(0.4, 0.75, 0.4, 0xc99a2e, { r: 0.03 }), 238 + dx, 0.37, BAYS.n + dz);
    for (const x of [244.5, 246.2]) {
      for (const dz of [-0.55, 0.55]) put(H.root, cyl(0.42, 0.1, 0x3a3c3f, { axis: 'z', seg: 12 }), x, 0.42, BAYS.n + 2.6 + dz);
      put(H.root, cyl(0.07, 1.2, 0x2a2b2d, { axis: 'z', seg: 6 }), x, 0.42, BAYS.n + 2.6);
    }
    H.block(245.3, BAYS.n + 2.6, 1.2, 0.7);
  }
  {
    const px = 290;
    const pz = BAYS.n + 2.4;
    put(H.root, box(1.6, 0.14, 1.2, 0x7a5f3e), px, 0.07, pz);
    for (const a of [-0.5, 0.5]) put(H.root, box(1.4, 0.05, 0.05, 0x2a2b2d), px, 0.45, pz + a * 0.6).rotation.z = a;
    put(H.root, box(0.12, 0.06, 1.3, 0x8d9196), px, 0.75, pz);
    H.block(px, pz, 0.8, 0.6);
  }
  function rack(x0, x1, z) {
    const Dp = 1.4;
    for (let x = x0; x <= x1 + 0.01; x += 2.8) for (const dz of [-Dp / 2, Dp / 2]) put(H.root, box(0.12, 4.6, 0.12, 0x3a5a8a), x, 2.3, z + dz);
    for (const y of [0.3, 1.8, 3.3]) {
      for (const dz of [-Dp / 2, Dp / 2]) put(H.root, box(x1 - x0 + 0.1, 0.14, 0.08, 0xc8742e), (x0 + x1) / 2, y, z + dz);
      for (let x = x0 + 1.4; x < x1; x += 2.8) {
        if (rand() < 0.25) continue;
        put(H.root, box(1.1, 0.12, 1.1, 0x7a5f3e), x, y + 0.13, z);
        const h = 0.5 + rand() * 0.8;
        put(H.root, box(1.0, h, 1.0, [0x8a7a5a, 0x6b6f72, 0x5a6b5a, 0x9a8a6a][(rand() * 4) | 0], { r: 0.02 }), x + (rand() - 0.5) * 0.1, y + 0.19 + h / 2, z);
      }
    }
    H.block((x0 + x1) / 2, z, (x1 - x0) / 2 + 0.1, Dp / 2 + 0.1);
    H.hitBox((x0 + x1) / 2, 2.3, z, x1 - x0, 4.6, Dp);
  }
  rack(224, 229.6, HALL.n + 1.6);
  rack(276, 284.4, HALL.n + 1.6);
  const drum = (x, z, color) =>
    junk(
      H,
      () => {
        put(H.root, cyl(0.32, 0.9, color, { seg: 10 }), x, 0.45, z);
        put(H.root, cyl(0.33, 0.06, 0x2a2b2d, { seg: 10 }), x, 0.3, z);
        put(H.root, cyl(0.33, 0.06, 0x2a2b2d, { seg: 10 }), x, 0.65, z);
        H.block(x, z, 0.32, 0.32);
      },
      1,
    );
  for (const [x, z, c] of [[226, -5.4, 0x8a3a2e], [226.7, -4.8, 0x3a5a7a], [227.4, -5.6, 0x8a3a2e], [251, 5.4, 0x5a6a3a], [251.7, 5.9, 0x8a3a2e], [287, -5, 0x3a5a7a], [298, 4, 0x8a3a2e], [298.6, 4.6, 0x5a6a3a]]) drum(x, z, c);
  for (const x of [252, 296]) {
    H.chunk(2.6, 0.12, 0.9, 0x6b5640, x, 1.0, HALL.n + 1.4);
    for (const dx of [-1.1, 1.1]) H.piece(0.1, 1.0, 0.8, 0x45484c, x + dx, 0.5, HALL.n + 1.4);
    for (let i = 0; i < 4; i++) H.piece(0.3, 0.2 + rand() * 0.2, 0.25, [0x3c5a7a, 0x6b6f72, 0xc99a2e][i % 3], x - 0.8 + i * 0.5, 1.15, HALL.n + 1.4);
    H.block(x, HALL.n + 1.4, 1.3, 0.45);
  }
  junk(H, () => P.crates(H, 225, 0, 4.5), 2);
  junk(H, () => P.crates(H, 274, 0, -5.4), 2);
  junk(H, () => P.tires(H, 248, 0, 13.4, 5));
  junk(H, () => P.tires(H, 300, 0, -9.5, 4));
  K.container(H, 296, 0, BAYS.s, 0.02, CONTAINERS[4]);
  for (const [x, z, h] of [[232, -3, 0.4], [262, 2.5, 2.6], [284, -6, 1.2]]) H.groundCable(x, z, h, 14, 0.5);
  const SODIUM = 0xffa245;
  for (let x = HALL.x0 + 14; x < HALL.x1 - 4; x += 14)
    for (const z of [-4.5, 3.5]) {
      if ((x / 14) % 2 && z > 0) continue;
      H.line([new THREE.Vector3(x, z > 0 ? 6.6 : HALL_H - 1.6, z), new THREE.Vector3(x, 5.4, z)]);
      put(H.root, cyl(0.42, 0.24, 0x2e3034, { seg: 8, radiusEnd: 0.14 }), x, 5.3, z);
      put(H.root, cyl(0.24, 0.05, SODIUM, { seg: 8, glow: true }), x, 5.17, z);
      H.emit(new THREE.Vector3(x, 4.2, z), SODIUM, 16, 10);
      H.pool(x, z, 3.2, SODIUM, 0.15);
    }
  // the sun through the windows: dusty beams from each one down onto the
  // floor (the real light lands there, through the holes in the wall's
  // shadow), motes drifting in them
  {
    const SUN = 0xffd6a0;
    const pos = [];
    const col = [];
    const z = HALL.n + 0.02;
    const beams = [];
    for (const [x0, x1] of windowsX()) {
      const top = [new THREE.Vector3(x0, WIN.y1, z), new THREE.Vector3(x1, WIN.y1, z), new THREE.Vector3(x1, WIN.y0, z), new THREE.Vector3(x0, WIN.y0, z)];
      const bottom = top.map((p) => toGround(p, 0.02));
      if (bottom.some((p) => p.x > HALL.x1 - 0.5 || p.z > HALL.s - 0.5)) continue;
      beams.push({ top, bottom });
      for (let i = 0; i < 4; i++) {
        const a = top[i];
        const b = top[(i + 1) % 4];
        const c = bottom[(i + 1) % 4];
        const d = bottom[i];
        for (const [p, k] of [[a, 1], [b, 1], [c, 0.25], [a, 1], [c, 0.25], [d, 0.25]]) {
          pos.push(p.x, p.y, p.z);
          col.push(k, k, k);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const shafts = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: SUN, vertexColors: true, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    H.add(shafts);
    H.keep(shafts);
    const dust = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: 0xfff1d0, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }), Math.max(1, beams.length * 18));
    const motes = [];
    for (const bm of beams)
      for (let i = 0; i < 18; i++) {
        const u = rand();
        const top = new THREE.Vector3().lerpVectors(bm.top[0], bm.top[1], u).lerp(new THREE.Vector3().lerpVectors(bm.top[3], bm.top[2], u), rand());
        motes.push({ top, ground: toGround(top, 0.05), k: rand(), v: 0.02 + rand() * 0.03, w: rand() * 6 });
      }
    const m4 = new THREE.Matrix4();
    const at = new THREE.Vector3();
    H.add(dust);
    H.keep(dust);
    H.animate((dt, t) => {
      motes.forEach((d, i) => {
        d.k = (d.k + d.v * dt) % 1;
        at.lerpVectors(d.top, d.ground, 0.1 + d.k * 0.85);
        at.x += Math.sin(t * 0.7 + d.w) * 0.25;
        at.y += Math.sin(t * 0.4 + d.w * 2) * 0.15;
        m4.makeTranslation(at.x, at.y, at.z);
        dust.setMatrixAt(i, m4);
      });
      dust.instanceMatrix.needsUpdate = true;
    });
  }
  // the gate out: a roller door in the far wall, shut till the drone's
  // dead; bright daylight beyond it once it's up
  const EXIT_X = HALL.x1 + 0.5;
  const exitDoor = new THREE.Group();
  const exitGlow = new THREE.Mesh(new THREE.PlaneGeometry(DOOR.half * 2, 5.2), new THREE.MeshBasicMaterial({ color: 0xfff6e4, fog: false }));
  {
    const slats = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5.2, DOOR.half * 2 + 0.1), toon(0x5a626c));
    slats.position.y = 2.6;
    slats.castShadow = true;
    exitDoor.add(slats);
    for (let y = 0.3; y < 5.1; y += 0.34) put(exitDoor, box(0.04, 0.05, DOOR.half * 2 - 0.1, 0x434b54), -0.12, y, 0);
    put(exitDoor, box(0.26, 0.3, DOOR.half * 2, 0xc99a2e), -0.02, 0.15, 0);
    exitDoor.position.set(EXIT_X, 0, DOOR.z);
    H.add(exitDoor);
    H.keep(exitDoor);
    exitGlow.rotation.y = -Math.PI / 2;
    exitGlow.position.set(EXIT_X + 0.6, 2.6, DOOR.z);
    exitGlow.visible = false;
    H.add(exitGlow);
    H.keep(exitGlow);
    for (const s of [-1, 1]) {
      put(H.root, box(0.3, 1.2, 0.3, 0xc99a2e), HALL.x1 - 0.4, 0.6, DOOR.z + s * (DOOR.half + 0.3));
      put(H.root, box(0.32, 0.2, 0.32, 0x26272a), HALL.x1 - 0.4, 0.8, DOOR.z + s * (DOOR.half + 0.3));
    }
    const sgn = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), sign(2.4, 0.6, { board: '#1f5a36', ink: '#e6f0dc' }));
    sgn.rotation.y = -Math.PI / 2;
    sgn.position.set(HALL.x1 - 0.02, 6.1, DOOR.z);
    H.add(sgn);
  }
  const exitPool = H.pool(HALL.x1 - 5, DOOR.z, 6, 0xfff1d6, 0.0, { sx: 1.3, sz: 0.8 });
  H.keep(exitPool);
  const exitLight = H.emit(new THREE.Vector3(HALL.x1 - 3, 3, DOOR.z), 0xfff1d6, 30, 16, { level: 0, priority: true });
  const exitBlock = H.block(EXIT_X, DOOR.z, 0.4, DOOR.half);

  const shackA = buildShack(B, { x0: SHACK_A.x0, x1: SHACK_A.x1, z0: CURB.n + 0.1, z1: CURB.s - 0.1, fill: { n: WALK.n - 0.5, s: WALK.s + 1.2 }, heightAt });
  const shackB = buildShack(B, { x0: SHACK_B.x0, x1: SHACK_B.x1, z0: CURB.n + 0.1, z1: CURB.s - 0.1, fill: { n: WALK.n - 0.5, s: WALK.s + 1.2 }, heightAt });

  for (const BB of [B, D, H]) {
    BB.finish();
    BB.mergeStatic();
  }

  const room = buildDepotRoom(scene);
  const blocks = [...B.blocks, ...D.blocks, ...H.blocks, ...room.blocks];
  const colliders = [...B.colliders, ...D.colliders, ...H.colliders, ...room.colliders];
  const emitters = [...B.emitters, ...D.emitters, ...H.emitters, ...room.emitters];
  const crushables = [...(B.crushables || []), ...(D.crushables || []), ...(H.crushables || [])];
  room.bindBlocks(blocks);
  for (const k of [shackA, shackB]) k.bindBlocks(blocks);
  const exit = { open: 0, want: 0 };
  const setExit = (open) => {
    exit.want = open ? 1 : 0;
    const i = blocks.indexOf(exitBlock);
    if (!open && i < 0) blocks.push(exitBlock);
    if (open && i >= 0) blocks.splice(i, 1);
  };
  // inside the hall: the city hidden (only the hall, in black), the shell
  // off, the ambient down: dim in there
  const sky = scene.background;
  const fog = scene.fog;
  const hemi0 = light.hemi.intensity;
  let inside = null;
  function setInside(on) {
    if (on === inside) return;
    inside = on;
    B.root.visible = !on;
    D.root.visible = !on;
    shell.visible = !on;
    scene.background = on ? new THREE.Color(0x07080a) : sky;
    scene.fog = on ? null : fog;
    light.hemi.intensity = on ? hemi0 * 0.55 : hemi0;
  }

  // ---------------------------------------------------- the level script
  const SECTORS = ['The highway', 'The streets', 'The depot'];
  const B1 = { minX: START_X + 2, maxX: shackA.x0 - 0.8, minZ: DZ - DECK_Z + 0.6, maxZ: DZ + DECK_Z - 0.6 };
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
  const ahead = (api, x) => Math.min(Math.max(x, api.tankPos.x + 14), RAMP.x0 - 2);
  const deckDog = (api, x, z, delay = 0) => api.spawnDog(ahead(api, x), z, { delay });
  const sideDrone = (api, x, s, delay = 0) => {
    const ax = ahead(api, x);
    api.spawnDrone(ax, DZ + s * 20, { delay, via: [[ax - 2, DZ + s * 4]] });
  };
  function zoneBounds(api) {
    const x = api.tankPos.x;
    if (inCross(x)) setBounds(api, { minZ: -CROSS_Z + 1.2, maxZ: CROSS_Z - 1.2 });
    else if (Math.abs(api.tankPos.z) < WALK.s - 0.6) setBounds(api, { minZ: WALK.n + 0.4, maxZ: WALK.s - 0.4 });
  }
  const overBarricade = (api, kind, s, delay = 0) => {
    const x = CROSS.x0 + 4 + rand() * (CROSS.x1 - CROSS.x0 - 8);
    const spawn = kind === 'walker' ? api.spawnWalker : api.spawnDog;
    spawn(x, s * (CROSS_Z + 4), { delay, via: [[x, s * (CROSS_Z - 3)]], noclip: true });
  };
  const hallSpawn = (api, kind, x, z, delay = 0) => {
    const ax = Math.min(Math.max(x, api.tankPos.x + 14), HALL.x1 - 4);
    if (kind === 'drone') return api.spawnDrone(ax, -6, { delay });
    return (kind === 'walker' ? api.spawnWalker : api.spawnDog)(ax, z, { delay });
  };

  function start(api) {
    Object.assign(S, { sector: 0, step: 0, t: 0, boss: null, waveT: 0 });
    setBounds(api, B1);
    setExit(false);
    exit.open = 0;
    setInside(false);
    api.enableGun();
    api.revealScraps(false);
    api.giveRockets();
    if (api.tank.ability) api.giveAbility();
    api.sectors(SECTORS, 0, 'Level 4');
    api.objective('Off the highway');
  }

  // 1: the highway, down the ramp, the checkpoint at its foot
  function sector1(api) {
    const x = api.tankPos.x;
    if (x > RAMP.x1 - 2) setBounds(api, { minZ: WALK.n + 0.4, maxZ: WALK.s - 0.4 });
    else setBounds(api, { minZ: B1.minZ, maxZ: B1.maxZ });
    if (S.step < 6 && x > shackA.x0 - 9) {
      openShack(api, shackA);
      go(6);
    }
    switch (S.step) {
      case 0:
        if (x > START_X + 10 || S.t > 4) {
          for (const [dx, z, d] of [[0, -4, 0], [2, 3, 0.4], [4, -1, 0.8]]) deckDog(api, START_X + 30 + dx, z, d);
          go(1);
        }
        break;
      case 1:
        if (x > 2) {
          api.spawnWalker(ahead(api, 20), -3.6);
          deckDog(api, 22, 4, 0.5);
          sideDrone(api, 14, -1, 1);
          go(2);
        }
        break;
      case 2:
        if (x > 28) {
          for (const [dx, z, d] of [[0, -5, 0], [2, 4, 0.3], [3, 0, 0.6]]) deckDog(api, 46 + dx, z, d);
          api.spawnWalker(ahead(api, 52), 5, { delay: 0.8 });
          go(3);
        }
        break;
      case 3:
        if (x > 64) {
          api.spawnWalker(Math.max(x + 18, 104), -3);
          api.spawnWalker(Math.max(x + 20, 108), 3, { delay: 0.6 });
          sideDrone(api, Math.max(x + 14, 60), 1, 0.4);
          for (const [dx, z, d] of [[0, 0, 0.3], [2, -4, 0.7]]) api.spawnDog(Math.max(x + 16, 100) + dx, z, { delay: d });
          go(4);
        }
        break;
      case 4:
        if (api.enemiesAlive === 0 && S.t > 1.5) {
          openShack(api, shackA);
          go(6);
        }
        break;
      case 6:
        if (atDoor(api, shackA)) {
          go(7);
          if (api.enemiesAlive) api.clearEnemies();
          api.depot(shackA, { offers: PARTS4, count: 3, onLeave: () => startSector2(api) });
        }
        break;
    }
  }

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
        if (x > SHACK_A.x1 + 6 || S.t > 4) {
          for (const [dx, z, d] of [[0, -3, 0], [2, 3, 0.4], [4, 0, 0.8]]) api.spawnDog(Math.min(x + 18, CROSS.x0 - 4) + dx, z, { delay: d });
          api.spawnWalker(Math.min(x + 22, CROSS.x0 - 2), -4, { delay: 1 });
          go(1);
        }
        break;
      case 1:
        if (x > CROSS.x0 - 14) {
          for (const [kind, s, d] of [['dog', -1, 0], ['dog', -1, 0.5], ['walker', 1, 0.3], ['dog', 1, 0.9]]) overBarricade(api, kind, s, d);
          go(2);
        }
        break;
      case 2:
        if (x > CROSS.x0 + 6) {
          api.spawnDrone(CROSS.x1 + 4, -28, { via: [[CROSS.x1, -8]] });
          overBarricade(api, 'walker', -1, 0.4);
          overBarricade(api, 'dog', 1, 0.8);
          overBarricade(api, 'dog', 1, 1.2);
          go(3);
        }
        break;
      case 3:
        if (x > CROSS.x1 + 6) {
          api.spawnWalker(Math.max(x + 16, 196), -3);
          api.spawnWalker(Math.max(x + 18, 198), 3.5, { delay: 0.7 });
          for (const [dx, z, d] of [[0, 0, 0.3], [2, -5, 0.6], [3, 5, 1]]) api.spawnDog(Math.min(206, Math.max(x + 14, 190)) + dx, z, { delay: d });
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

  function startSector3(api) {
    S.sector = 2;
    go(0);
    setBounds(api, B3);
    setExit(false);
    setInside(true);
    api.sectors(SECTORS, 2, 'Level 4');
    api.objective('Reach the far gate');
    api.arrow(new THREE.Vector3(HALL.x1 - 2, 1.6, DOOR.z), 'Gate');
  }
  function sector3(api, dt) {
    const x = api.tankPos.x;
    // at the gate: the drone comes out
    if (S.step < 4 && x > HALL.x1 - 22) {
      api.arrow(null);
      S.boss = api.spawnArty(HALL.x1 - 8, BAYS.n + 2.5, { yaw: Math.PI });
      api.boss(S.boss, 'Artillery drone');
      api.objective('Destroy the artillery drone');
      api.spotlight({ targets: [() => (S.boss.alive ? new THREE.Vector3(S.boss.pos.x, 2, S.boss.pos.z) : null)], r: 170 }, () => S.t > 2.2, { maxTime: 2.6, frame: () => (S.boss.alive ? S.boss.pos.clone() : null), frameK: 1 });
      S.waveT = 16;
      go(4);
      return;
    }
    switch (S.step) {
      case 0:
        if (S.t > 1.2) {
          for (const [kind, dx, z, d] of [['dog', 0, -4, 0], ['dog', 2, 3, 0.4], ['dog', 4, -1, 0.8], ['walker', 8, 4, 1.2]]) hallSpawn(api, kind, 240 + dx, z, d);
          go(1);
        }
        break;
      case 1:
        if (x > 236) {
          hallSpawn(api, 'walker', 256, -5);
          hallSpawn(api, 'walker', 258, 4, 0.6);
          hallSpawn(api, 'dog', 252, 0, 0.3);
          hallSpawn(api, 'dog', 254, -2, 1);
          go(2);
        }
        break;
      case 2:
        if (x > 254) {
          hallSpawn(api, 'drone', 266, 0);
          for (const [kind, dx, z, d] of [['dog', 0, 4, 0.3], ['dog', 2, -5, 0.6], ['walker', 4, 0, 1]]) hallSpawn(api, kind, 270 + dx, z, d);
          go(3);
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
          api.cameraTo(new THREE.Vector3(HALL.x1, 0, DOOR.z), 2.2);
          setBounds(api, { maxX: HALL.x1 + 8 });
          api.objective('Out through the gate');
          api.arrow(new THREE.Vector3(HALL.x1 - 2, 1.6, DOOR.z), 'Exit');
          go(5);
        }
        break;
      case 5:
        if (exit.open > 0.7 && x > HALL.x1 - 4 && Math.abs(api.tankPos.z - DOOR.z) < DOOR.half) {
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
      if (S.sector === 0) setBounds(api, { minZ: WALK.n + 0.4, maxZ: WALK.s - 0.4 });
      api.teleport(shack.door.x - 7, shack.door.z, 0);
      openShack(api, shack);
      go(S.sector === 0 ? 6 : 5);
      return true;
    }
    if (S.step < 4) {
      api.teleport(HALL.x1 - 26, DOOR.z, 0);
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
    D.update(dt, t, ctx);
    H.update(dt, t, ctx);
    for (const k of [shackA, shackB]) k.update(dt, t);
    room.update(dt, t, ctx);
    // the gate: goes up slowly once the drone's dead, dust off its foot,
    // the light beyond showing as it opens
    const was = exit.open;
    exit.open += THREE.MathUtils.clamp(exit.want - exit.open, -dt * 3.5, dt * 0.5);
    exitDoor.position.y = exit.open * 4.9;
    exitDoor.scale.y = 1 - exit.open * 0.92;
    exitGlow.visible = exit.open > 0.01;
    exitPool.material.opacity = 0.32 * exit.open;
    exitLight.level = exit.open;
    if (ctx.combat && exit.open > was && rand() < dt * 12) ctx.combat.puffs.spawn(new THREE.Vector3(EXIT_X - 0.4, 0.3, DOOR.z + (rand() - 0.5) * DOOR.half * 2), new THREE.Vector3(-0.8, 0.4, 0), { color: 0x8d8b86, s0: 0.3, s1: 0.9, life: 1.2, drag: 2, lift: 0.3, fadeAt: 0.3 });
    if (ctx.api) {
      setInside(S.sector === 2 && ctx.api.run.mode === 'field');
      script(ctx.api, dt);
    }
  }

  return {
    light,
    colliders,
    blocks,
    emitters,
    crushables,
    depotRoom: room,
    heightAt: (x, z) => (z > 150 ? 0 : heightAt(x, z)),
    spawn: { x: START_X + 5, z: DZ, yaw: 0 },
    bounds,
    script: S,
    shacks: [shackA, shackB],
    start,
    update,
    skipStage,
  };
}
