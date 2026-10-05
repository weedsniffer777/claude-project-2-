// Level 5: the destroyed stadium, on a grey winter afternoon. A short
// level: one more city street to a checkpoint, a huge empty plaza, and the
// ruined stadium standing in it, the mech inside.
//
// Layout (world +X runs bottom-left to top-right on screen):
//  1 The approach: a street of panel blocks and works buildings. Dogs,
//    walkers, a drone. A checkpoint across the street at its end.
//  2 The stadium: out onto a wide, empty plaza (fenced off to either side,
//    the open ground going on beyond), the stadium across it. A pill-shaped
//    bowl: long straight sides, rounded ends, stepped concrete terraces all
//    round (deep on the far side under a concourse and a broken canopy,
//    shallow on the near side), moss and snow on the steps, a few seats
//    left, whole sections collapsed. In through the west gate onto the
//    churned-up ground inside; the gate shuts and the mech comes.
//    Kill it; the east gate opens; out and done.
import * as THREE from 'three';
import { addDawn } from '../render/setup.js';
import { box, cyl, put, toon, gradientMap, setLowPoly } from '../models/kit.js';
import { LevelBuilder, canvas, tex, blob, speckle } from './builder.js';
import * as P from './props.js';
import { buildShack } from './depot.js';
import { buildDepotRoom } from './depotRoom.js';
import { rails } from './rails.js';
import { sidewalkTexture } from './cityTextures.js';
import { cityKit, CONCRETE, BURNT_PAINT } from './cityKit.js';

const GPX = 5;
const MAP = { x0: -60, x1: 320, z0: -90, z1: 80 };
const START_X = -20;
const CURB = { n: -7.5, s: 6.5 };
const WALK = { n: -10, s: 9 };
const SW = 0.16;
const SHACK_A = { x0: 90, x1: 97.6 };
const STREET_END = 106; // the street opens onto the plaza here
const PLAZA_Z = 34; // about how far either side the plaza's barricade lines run
// the stadium: a pill. Straight sides HL either side of the middle, round
// ends of radius R. The field inside; terraces outside it.
const CX = 214;
const CZ = 0;
const HL = 20;
const R = 19;
const W_IN = CX - HL - R; // the inside's west end (the gate's inner mouth)
const E_IN = CX + HL + R;
const GATE_HALF = 5.2; // half width of the gates' openings
const GATE_DEPTH = 1.4 + 8 * 1.15 + 1; // the gatehouses' depth
const END_X = E_IN + GATE_DEPTH; // out through the east gate: done

// a point on the pill's boundary pushed out by off, at parameter u in
// [0, 1) going round from the west apex: { x, z, nx, nz } (outward normal)
function pillAt(u, off = 0) {
  const straight = HL * 2;
  const arc = Math.PI * R;
  const total = 2 * straight + 2 * arc;
  let d = (((u % 1) + 1) % 1) * total;
  // west arc (from the apex, going round to the north side)
  if (d < arc / 2) {
    const a = Math.PI + d / R;
    return { x: CX - HL + Math.cos(a) * (R + off), z: CZ + Math.sin(a) * (R + off), nx: Math.cos(a), nz: Math.sin(a) };
  }
  d -= arc / 2;
  if (d < straight) return { x: CX - HL + d, z: CZ - R - off, nx: 0, nz: -1 }; // north side
  d -= straight;
  if (d < arc) {
    const a = -Math.PI / 2 + d / R;
    return { x: CX + HL + Math.cos(a) * (R + off), z: CZ + Math.sin(a) * (R + off), nx: Math.cos(a), nz: Math.sin(a) };
  }
  d -= arc;
  if (d < straight) return { x: CX + HL - d, z: CZ + R + off, nx: 0, nz: 1 }; // south side
  d -= straight;
  const a = Math.PI / 2 + d / R;
  return { x: CX - HL + Math.cos(a) * (R + off), z: CZ + Math.sin(a) * (R + off), nx: Math.cos(a), nz: Math.sin(a) };
}
const PILL_LEN = 4 * HL + 2 * Math.PI * R;
// inside the pill (shrunk by m)?
function inPill(x, z, m = 0) {
  const dx = Math.max(0, Math.abs(x - CX) - HL);
  return Math.hypot(dx, z - CZ) < R - m;
}
const inStreet = (x) => x < STREET_END;
function heightAt(x, z) {
  if (inStreet(x)) return z <= CURB.n || z >= CURB.s ? SW : 0;
  return 0;
}

// The ground: the street's asphalt, then a great sweep of old concrete
// paving round the stadium (cracked, weeds in the joints, snow in drifts),
// and inside it the churned ground of the old pitch: mud, dead grass,
// snow, craters. Nothing of the game left on it.
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
  // the paving everywhere
  rect(MAP.x0, MAP.z0, MAP.x1, MAP.z1, '#8f9094');
  speckle(g, W, H, ['#85868a', '#9a9b9f', '#7e7f83', '#a3a4a8'], W * H * 0.05, rand);
  g.fillStyle = '#7c7d81';
  for (let x = STREET_END; x < MAP.x1; x += 4) g.fillRect(X(x), 0, 1, H);
  for (let z = MAP.z0; z < MAP.z1; z += 4) g.fillRect(X(STREET_END), Z(z), W - X(STREET_END), 1);
  // grass and moss come up in the joints, and in big patches where the
  // paving's gone
  for (let x = STREET_END; x < MAP.x1; x += 4)
    for (let z = MAP.z0; z < MAP.z1; z += 4) {
      if (rand() < 0.35) {
        g.fillStyle = rand() < 0.5 ? '#5e6340' : '#6d6a46';
        if (rand() < 0.5) g.fillRect(X(x) - 1, Z(z), 3, 4 * GPX * (0.3 + rand() * 0.7));
        else g.fillRect(X(x), Z(z) - 1, 4 * GPX * (0.3 + rand() * 0.7), 3);
      }
      if (rand() < 0.08) {
        // a slab sunk and stained darker
        g.fillStyle = rand() < 0.5 ? '#828387' : '#77787b';
        g.fillRect(X(x) + 1, Z(z) + 1, 4 * GPX - 2, 4 * GPX - 2);
      }
    }
  for (let i = 0; i < 160; i++) {
    const cx = X(STREET_END + rand() * (MAP.x1 - STREET_END));
    const cz = rand() * H;
    for (let k = 0; k < 6; k++) {
      g.fillStyle = ['#59603b', '#686844', '#4d5634', '#77714a'][(rand() * 4) | 0];
      blob(g, cx + (rand() - 0.5) * 5 * GPX, cz + (rand() - 0.5) * 4 * GPX, (0.8 + rand() * 2.2) * GPX, (0.6 + rand() * 1.5) * GPX, rand, 9);
    }
  }
  // cracks with weeds in them, drifts of snow, dark stains
  for (let i = 0; i < 700; i++) {
    let x = X(STREET_END + rand() * (MAP.x1 - STREET_END));
    let z = rand() * H;
    let a = rand() * Math.PI * 2;
    g.fillStyle = rand() < 0.4 ? '#4d5a3a' : '#5d5e62';
    for (let k = 0; k < 10 + rand() * 30; k++) {
      g.fillRect(x, z, 1, 1);
      a += (rand() - 0.5) * 0.8;
      x += Math.cos(a);
      z += Math.sin(a);
    }
  }
  for (let i = 0; i < 600; i++) {
    g.fillStyle = rand() < 0.6 ? '#d4d8dd' : '#c1c6cb';
    blob(g, X(STREET_END + rand() * (MAP.x1 - STREET_END)), rand() * H, (0.8 + rand() * 4) * GPX, (0.5 + rand() * 2) * GPX, rand, 9);
  }
  // the street
  rect(MAP.x0, MAP.z0, STREET_END, MAP.z1, '#b9bcc2');
  rect(MAP.x0, CURB.n, STREET_END, CURB.s, '#5e5f64');
  speckle(g, X(STREET_END) - X(MAP.x0), Z(CURB.s) - Z(CURB.n), ['#68696e', '#54555a', '#6e6e72'], (X(STREET_END) - X(MAP.x0)) * (Z(CURB.s) - Z(CURB.n)) * 0.05, rand, Z(CURB.n), 0);
  for (let i = 0; i < 700; i++) {
    const x = MAP.x0 + rand() * (STREET_END - MAP.x0);
    const z = CURB.n + 0.3 + rand() * (CURB.s - CURB.n - 0.6);
    g.fillStyle = Math.min(z - CURB.n, CURB.s - z) < 1.3 ? '#a9a8a6' : rand() < 0.5 ? '#88867f' : '#78766f';
    blob(g, X(x), Z(z), (0.5 + rand() * 1.3) * GPX, (0.35 + rand() * 0.6) * GPX, rand, 9);
  }
  g.fillStyle = '#aaa79e';
  for (let x = MAP.x0; x < STREET_END; x += 1) if (rand() > 0.45) g.fillRect(X(x), Z(-0.6), GPX, 2);
  // inside the stadium: mud, dead grass, snow, scorch, craters
  g.save();
  g.beginPath();
  for (let i = 0; i <= 120; i++) {
    const p = pillAt(i / 120, 0.5);
    if (i) g.lineTo(X(p.x), Z(p.z));
    else g.moveTo(X(p.x), Z(p.z));
  }
  g.closePath();
  g.clip();
  rect(CX - HL - R - 2, CZ - R - 2, CX + HL + R + 2, CZ + R + 2, '#5f6140');
  // the old pitch gone to rough grass: dry yellows and dull greens, bare
  // mud where the machines have churned it
  for (let i = 0; i < 900; i++) {
    g.fillStyle = ['#6b6a44', '#5a5f3a', '#77724a', '#4f5734', '#62603e'][(rand() * 5) | 0];
    blob(g, X(CX + (rand() - 0.5) * 2 * (HL + R)), Z(CZ + (rand() - 0.5) * 2 * R), (0.5 + rand() * 2) * GPX, (0.4 + rand() * 1.2) * GPX, rand, 9);
  }
  for (let i = 0; i < 260; i++) {
    g.fillStyle = ['#5f5c42', '#524a3a', '#5c5440'][(rand() * 3) | 0];
    blob(g, X(CX + (rand() - 0.5) * 2 * (HL + R)), Z(CZ + (rand() - 0.5) * 2 * R), (0.6 + rand() * 2.5) * GPX, (0.4 + rand() * 1.4) * GPX, rand, 9);
  }
  for (let i = 0; i < 140; i++) {
    g.fillStyle = rand() < 0.6 ? '#c9cdd2' : '#b4b9bf';
    blob(g, X(CX + (rand() - 0.5) * 2 * (HL + R)), Z(CZ + (rand() - 0.5) * 2 * R), (0.8 + rand() * 3) * GPX, (0.5 + rand() * 1.6) * GPX, rand, 9);
  }
  for (let i = 0; i < 26; i++) {
    const x = CX + (rand() - 0.5) * 2 * (HL + R * 0.6);
    const z = CZ + (rand() - 0.5) * 1.6 * R;
    g.fillStyle = 'rgba(30,26,22,0.6)';
    blob(g, X(x), Z(z), (1.2 + rand() * 1.8) * GPX, (1 + rand()) * GPX, rand, 11);
    g.fillStyle = '#2f2a27';
    blob(g, X(x), Z(z), (0.5 + rand() * 0.6) * GPX, (0.4 + rand() * 0.4) * GPX, rand, 9);
  }
  g.restore();
  return tex(c);
}

export const stadium = {
  id: 'stadium',
  name: 'Level 5 · Destroyed stadium',
  build(scene) {
    setLowPoly(true);
    try {
      return buildStadium(scene);
    } finally {
      setLowPoly(false);
    }
  },
};

function buildStadium(scene) {
  const B = new LevelBuilder(scene, 4409);
  const rand = B.rand;
  const light = addDawn(scene, { shadowSize: 24, shadowMap: 2048 });
  const K = cityKit(B, { WALK, SW, heightAt });

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
  slab(MAP.x0, STREET_END, -30, CURB.n);
  slab(MAP.x0, STREET_END, CURB.s, 30);
  for (const [z, dir] of [[CURB.n - 0.35, -1], [CURB.s + 0.35, 1]]) {
    for (let x = START_X - 2; x < STREET_END - 2; x += 0.6) {
      if (rand() < 0.15) x += 2;
      B.lump(x, SW, z + dir * rand() * 0.25, 0.5 + rand() * 0.4, 0.18 + rand() * 0.15, 0.35 + rand() * 0.2, rand() < 0.3 ? 0xa9aaac : 0xc7cacf, rand() * 3);
    }
  }
  for (let i = 0; i < 260; i++) {
    const x = START_X + rand() * (STREET_END - START_X);
    const z = WALK.n + rand() * (WALK.s - WALK.n);
    const s = 0.08 + rand() * 0.22;
    B.piece(s * (1 + rand()), s * 0.6, s, rand() < 0.25 ? 0x7a5e50 : CONCRETE[(rand() * 5) | 0], x, heightAt(x, z) + s * 0.25, z, rand(), rand() * 3, rand());
  }
  {
    const R2 = rails(B, rand);
    // on past the street's end, where the two tracks part: one curving off
    // north, one south, out beyond the barricades
    for (const [z, s] of [[-2.25, -1], [1.55, 1]]) {
      const turnX = STREET_END + 10 + (s < 0 ? 4 : 0);
      R2.track([...R2.straight(START_X - 1, z, STREET_END, z), ...R2.bend({ x: STREET_END, z }, { x: turnX + 14, z }, { x: turnX + 14, z: z + s * 16 }).slice(1), ...R2.straight(turnX + 14, z + s * 16, turnX + 14, s < 0 ? MAP.z0 + 2 : MAP.z1 - 2).slice(1)]);
    }
  }

  // --------------------------------------------------- 1: the approach
  {
    const X = START_X - 2.5;
    for (let z = -14; z < 16; z += 2.6) K.rubble(B, X - 1 + (rand() - 0.5) * 1.5, z + (rand() - 0.5), 2.6 + rand() * 1.2, 2.4 + rand() * 1.6, { slabs: 3 });
    B.block(X - 1, 0.5, 2.2, 22);
  }
  K.building({ x0: -52, x1: -8, floors: 7, shop: true });
  K.works({ x0: -6, x1: 14, zf: WALK.n, roof: 'gable', wall: 0x9a8f7a, doors: 2 });
  K.building({ x0: 16, x1: 38, floors: 6, holes: 2 });
  K.building({ x0: 40, x1: 62, floors: 8, shop: true });
  K.works({ x0: 64, x1: 88, zf: WALK.n, roof: 'saw', wall: 0x8a9a8e, doors: 3, dock: true });
  K.building({ x0: 97.6, x1: STREET_END, floors: 7 });
  K.southBlock(-52, -6, 2);
  K.southBlock(-4, 20, 3);
  K.works({ x0: 22, x1: 42, zf: WALK.s + 0.3, side: 's', roof: 'flat', wall: K.BRICK, tin: false, doors: 2 });
  K.southBlock(44, 66, 2);
  K.southBlock(68, 88, 3);
  K.southBlock(97.6, STREET_END, 2);
  const wreck = (x, z, yaw, o) => B.crushable(() => P.car(B, x, z, yaw, o), { kind: 'car', scrap: 2 });
  wreck(-2, -1.5, 0.35, { kind: 'sedan', paint: BURNT_PAINT[0] });
  wreck(18, 3.6, 0.2, { kind: 'van', paint: 0x6b7458 });
  wreck(36, -4.6, -0.4, { kind: 'hatch', paint: BURNT_PAINT[1], flipped: true });
  wreck(58, 2.4, 0.5, { kind: 'sedan', paint: BURNT_PAINT[2] });
  wreck(80, -3.4, 0.7, { kind: 'hatch', paint: BURNT_PAINT[3] });
  P.tram(B, 46, -2.25, 0.02, { tilt: 0.04, burn: 0.7 });
  K.rubble(B, 28, 5.2, 1.6, 1.2, { slabs: 2 });
  K.rubble(B, 70, -5.6, 1.8, 1.3, { slabs: 2 });
  for (const [x, z, yaw] of [[10, -4, 0.3], [52, 1.5, 1.4], [53.8, 2.2, 1.3], [86, 4.5, 0.6]]) K.jersey(B, x, z, yaw);
  const junk = (fn, scrap = 0) => B.crushable(fn, { kind: 'prop', scrap });
  junk(() => P.crates(B, 24, SW, WALK.n + 1.2), 2);
  junk(() => P.tires(B, 42, SW, CURB.s + 1, 4));
  junk(() => P.bin(B, 6, SW, WALK.n + 1.3, { tipped: true }), 1);
  junk(() => P.bench(B, 62, SW, WALK.s - 1, Math.PI, { tipped: true }));
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
  for (let x = START_X + 4; x < STREET_END - 2; x += 16) {
    if (x > SHACK_A.x0 - 3 && x < SHACK_A.x1 + 3) continue;
    for (const s of [-1, 1]) lamp(x, s < 0 ? CURB.n - 0.45 : CURB.s + 0.45, s);
  }

  // ------------------------------------------------------------ overgrowth
  // dry grass in tufts, low shrubs, bare saplings: the city's been left to it
  const GRASS = [0x7a7448, 0x8a8250, 0x6b6a44, 0x5e6340];
  const SHRUB = [0x4f5a34, 0x46502f, 0x56603c, 0x5d5a3a];
  function tuft(x, y, z, s = 1) {
    for (let i = 0; i < 4; i++) {
      const a = rand() * Math.PI * 2;
      B.piece(0.05 * s, (0.25 + rand() * 0.35) * s, 0.05 * s, GRASS[(rand() * 4) | 0], x + Math.cos(a) * 0.12 * s, y + 0.15 * s, z + Math.sin(a) * 0.12 * s, (rand() - 0.5) * 0.9, rand() * 3, (rand() - 0.5) * 0.9);
    }
    B.lump(x, y + 0.03, z, 0.32 * s, 0.1 * s, 0.28 * s, GRASS[(rand() * 4) | 0], rand() * 3);
  }
  function shrub(x, y, z, s = 1) {
    for (let i = 0; i < 4; i++) B.lump(x + (rand() - 0.5) * 0.7 * s, y + (0.15 + rand() * 0.3) * s, z + (rand() - 0.5) * 0.7 * s, (0.4 + rand() * 0.35) * s, (0.3 + rand() * 0.25) * s, (0.4 + rand() * 0.35) * s, SHRUB[(rand() * 4) | 0], rand() * 3);
  }
  function sapling(x, y, z, s = 1) {
    const h = (1.6 + rand() * 1.4) * s;
    B.piece(0.09 * s, h, 0.09 * s, 0x4a3f34, x, y + h / 2, z, (rand() - 0.5) * 0.15, 0, (rand() - 0.5) * 0.15);
    for (let i = 0; i < 5; i++) {
      const a = rand() * Math.PI * 2;
      const l = (0.5 + rand() * 0.6) * s;
      B.piece(0.04 * s, l, 0.04 * s, 0x4a3f34, x + Math.cos(a) * l * 0.35, y + h * (0.55 + rand() * 0.4), z + Math.sin(a) * l * 0.35, Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
    }
    if (rand() < 0.6) shrub(x, y + h * 0.75, z, 0.6 * s);
  }
  const overgrow = (x, y, z, s = 1) => {
    const r = rand();
    if (r < 0.6) tuft(x, y, z, s);
    else if (r < 0.9) shrub(x, y, z, s * 0.8);
    else sapling(x, y, z, s);
  };

  // ------------------------------------------------------------ the plaza
  // A huge open square of old paving round the stadium, gone to weeds. You
  // can drive a wide stretch of it; either side it's closed off by ragged
  // lines of whatever was to hand (jersey barriers, sandbags, containers,
  // wrecks, heaps of rubble, tank traps), and the open ground goes on
  // beyond. Planters with dead trees, lamp posts, a dry fountain, a toppled
  // statue, sandbag positions, wrecks.
  // outer edge of the stands at a point: how far out from the pill's
  // boundary the terraces (and their walls) reach that way
  const ROW_W = 1.15; // how far each terrace row steps back
  const ROW_H = 0.62; // and up
  const rowsAt = (nz) => (nz < -0.6 ? 12 : nz > 0.6 ? 4 : 8); // north deep, south shallow, ends between
  const outside = (x, z) => {
    const dx = Math.max(0, Math.abs(x - CX) - HL);
    const d = Math.hypot(dx, z - CZ);
    return d - (R + 1.4 + rowsAt((z - CZ) / Math.max(d, 1e-3)) * ROW_W + 0.4);
  };
  // a barricade line along a polyline: pieces end to end with no gaps, each
  // with its own block (nothing invisible)
  const bags = (x, z, len, yaw, layers = 3) => {
    const c = Math.cos(yaw);
    const sn = Math.sin(yaw);
    for (let k = 0; k < layers; k++)
      for (let i = 0; i < len / 0.5; i++) {
        const u = -len / 2 + 0.25 + i * 0.5 + (k % 2) * 0.12;
        if (u > len / 2 - 0.2) continue;
        B.piece(0.52, 0.22, 0.34, k % 2 ? 0x8a7b5c : 0x7f7254, x + c * u, 0.11 + k * 0.21, z - sn * u, 0, yaw + (rand() - 0.5) * 0.1, 0);
      }
    B.block(x, z, len / 2, 0.3, yaw);
    B.hitBox(x, 0.35, z, len, 0.7, 0.6, yaw);
  };
  const hedgehog = (x, z, yaw) => {
    for (const [rx, rz] of [[0.8, 0], [-0.8, 0], [0, 1.57]]) B.piece(1.9, 0.18, 0.18, 0x4a4c50, x, 0.6, z, rx, yaw + 0.8 + rz, 0.7 * Math.sign(rx || 1));
    B.block(x, z, 0.75, 0.75, yaw);
  };
  function barricade(pts) {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const L = Math.hypot(b.x - a.x, b.z - a.z);
      const yaw = -Math.atan2(b.z - a.z, b.x - a.x);
      const ux = (b.x - a.x) / L;
      const uz = (b.z - a.z) / L;
      let u = 0;
      while (u < L) {
        const r = rand();
        const len = r < 0.32 ? 1.9 : r < 0.5 ? 3 : r < 0.64 ? 6 : r < 0.76 ? 4.4 : r < 0.9 ? 3.2 : 1.6;
        const m = Math.min(len, L - u + 0.4);
        const cx = a.x + ux * (u + m / 2);
        const cz = a.z + uz * (u + m / 2);
        const w = (rand() - 0.5) * 0.2;
        if (len === 1.9) {
          K.jersey(B, cx, cz, yaw + w, 0.9, Math.max(1, m));
          if (rand() < 0.4) for (let k = -1; k <= 1; k++) B.piece(0.04, 0.8, 0.04, 0x3a3c3f, cx + ux * k * 0.6, 1.3, cz + uz * k * 0.6); // wire posts
        } else if (len === 3) bags(cx, cz, m, yaw + w);
        else if (len === 6 && m > 5) K.container(B, cx, 0, cz, yaw + w * 0.5, [0x7a4a3a, 0x4f6a5a, 0x6a6f74, 0x8a7a4a][(rand() * 4) | 0]);
        else if (len === 4.4 && m > 4) P.car(B, cx, cz, yaw + Math.PI * (rand() < 0.5 ? 0 : 1) + w, { kind: ['sedan', 'van', 'hatch'][(rand() * 3) | 0], paint: BURNT_PAINT[(rand() * 6) | 0], flipped: rand() < 0.2 });
        else if (len === 3.2) {
          K.rubble(B, cx, cz, 1.7, 1.2, { slabs: 2 });
          B.block(cx, cz, m / 2, 0.9, yaw);
        } else hedgehog(cx, cz, yaw);
        if (rand() < 0.5) overgrow(cx + (rand() - 0.5) * m, 0, cz + (rand() < 0.5 ? -1 : 1) * (0.9 + rand() * 0.5));
        u += m;
      }
    }
  }
  // run a line on from its last point till it meets the stands
  const dock = (pts) => {
    const p = { ...pts[pts.length - 1] };
    const tx = THREE.MathUtils.clamp(p.x, CX - HL, CX + HL);
    const d = Math.hypot(tx - p.x, CZ - p.z);
    for (let k = 0; k < 80 && outside(p.x, p.z) > -0.8; k++) {
      p.x += ((tx - p.x) / d) * 0.5;
      p.z += ((CZ - p.z) / d) * 0.5;
    }
    pts.push(p);
    return pts;
  };
  {
    for (const s of [-1, 1]) {
      const zs = s < 0 ? -WALK.n : WALK.s; // (the street's buildings end here)
      const line = [{ x: STREET_END + 1.2, z: s * (zs + 0.2) }, { x: STREET_END + 1.4, z: s * (PLAZA_Z - 3) }];
      // out along the side, kinking in and out
      for (let x = STREET_END + 8; x < CX - HL - R - 4; x += 10 + rand() * 6) line.push({ x, z: s * (PLAZA_Z + (rand() - 0.5) * 7) });
      barricade(dock(line));
    }
    // lamp posts in rows down the plaza, planters with dead trees between
    for (let x = STREET_END + 9; x < W_IN - 16; x += 15) {
      for (const s of [-1, 1]) {
        lamp(x, s * (PLAZA_Z - 9), s, 0);
        const px = x + 7;
        const pz = s * (PLAZA_Z - 9);
        put(B.root, box(2.4, 0.6, 2.4, 0x9a978f, { r: 0.05 }), px, 0.3, pz);
        B.lump(px, 0.6, pz, 1.0, 0.12, 1.0, 0x4d4436);
        B.block(px, pz, 1.2, 1.2);
        if (rand() < 0.7) sapling(px, 0.6, pz, 1.3);
        else shrub(px, 0.6, pz, 1.3);
      }
    }
    // a dry fountain, a toppled statue on its plinth
    put(B.root, cyl(3.4, 0.7, 0x9a978f, { seg: 18 }), 128, 0.35, -12);
    put(B.root, cyl(3.0, 0.72, 0x6d6a4c, { seg: 18 }), 128, 0.37, -12);
    put(B.root, cyl(0.7, 2.2, 0x8a877f, { seg: 10 }), 128, 1.1, -12);
    for (let i = 0; i < 6; i++) tuft(128 + (rand() - 0.5) * 4, 0.72, -12 + (rand() - 0.5) * 4, 1.2);
    B.block(128, -12, 3.4, 3.4);
    put(B.root, box(2.6, 1.6, 2.6, 0x8d8b86, { r: 0.05 }), 150, 0.8, 12);
    const st = put(B.root, box(0.9, 3.6, 0.9, 0x6f7a74, { r: 0.12 }), 152.4, 0.5, 13);
    st.rotation.z = Math.PI / 2 - 0.1;
    put(B.root, box(0.8, 0.8, 0.8, 0x6f7a74, { r: 0.2 }), 154.8, 0.45, 13.2);
    B.block(151, 12.5, 2.4, 1.6);
    // sandbag positions and wrecks
    bags(118, 6, 4, 0.4);
    bags(140, -6, 5, -0.3);
    bags(158, 4, 4, 1.2);
    bags(166, -20, 4, 0.2);
    bags(122, 22, 5, -0.6);
    wreck(124, 14, 0.9, { kind: 'van', paint: 0x6b7458 });
    wreck(146, -16, -0.5, { kind: 'sedan', paint: BURNT_PAINT[3] });
    wreck(162, 22, 0.3, { kind: 'hatch', paint: BURNT_PAINT[1] });
    B.crushable(() => P.bus(B, 136, 6, 0.25), { kind: 'prop', heavy: true, armored: true });
    for (const [x, z, yaw] of [[112, -6, 1.5], [132, 16, 1.4], [162, -12, 1.6], [144, 26, 0.3]]) K.jersey(B, x, z, yaw, 1.0, 1.8);
    K.rubble(B, 120, -20, 2, 1.3, { slabs: 2, solid: true });
    K.rubble(B, 156, -28, 1.8, 1.1, { slabs: 2, solid: true });
    // weeds all over
    for (let i = 0; i < 420; i++) {
      const x = STREET_END + 2 + rand() * (CX + HL + R - STREET_END);
      const z = (rand() - 0.5) * 2 * (PLAZA_Z + 20);
      if (outside(x, z) < 1) continue;
      if (rand() < 0.75) tuft(x, 0, z, 0.8 + rand() * 0.6);
      else shrub(x, 0, z, 0.6 + rand() * 0.6);
    }
    // far off beyond the barricades: the city's edge, blocks set well back
    K.building({ x0: 112, x1: 150, zf: -PLAZA_Z - 22, floors: 9 });
    K.building({ x0: 156, x1: 186, zf: -PLAZA_Z - 30, floors: 8 });
    K.southBlock(110, 140, 3, PLAZA_Z + 20);
    // a few abandoned things out on the open ground beyond
    for (const [x, z, yaw] of [[136, -44, 0.5], [170, 46, -0.3], [150, 50, 1.2], [118, 44, 0.2]]) P.car(B, x, z, yaw, { kind: ['sedan', 'van', 'hatch'][(rand() * 3) | 0], paint: BURNT_PAINT[(rand() * 6) | 0], solidBlock: false });
    for (let i = 0; i < 12; i++) K.rubble(B, STREET_END + 10 + rand() * 80, (rand() < 0.5 ? -1 : 1) * (PLAZA_Z + 7 + rand() * 14), 1 + rand() * 1.5, 0.8 + rand(), { slabs: 1 });
    for (let i = 0; i < 30; i++) sapling(STREET_END + 6 + rand() * 90, 0, (rand() < 0.5 ? -1 : 1) * (PLAZA_Z + 5 + rand() * 18), 1 + rand() * 0.5);
  }

  // ----------------------------------------------------------- the stadium
  // terraces: around the pill, rows of stepped concrete going up and back.
  // Deep on the far (north) side, medium at the ends, shallow on the near
  // side so you can see in. Sections collapsed into rubble here and there.
  // Gaps at the west and east ends for the gates.
  const atGate = (p) => Math.abs(p.nz) < 0.3 && Math.abs(p.z - CZ) < GATE_HALF + 0.5;
  const N = Math.round(PILL_LEN / 2.4);
  const segs = [];
  for (let i = 0; i < N; i++) {
    const u0 = i / N;
    const u1 = (i + 1) / N;
    const pm = pillAt((u0 + u1) / 2);
    if (atGate(pm)) continue;
    const a = pillAt(u0);
    const b = pillAt(u1);
    const yaw = -Math.atan2(b.z - a.z, b.x - a.x);
    const rows = rowsAt(pm.nz);
    segs.push({ pm, a, b, yaw, rows, broken: rows, sag: 0 });
  }
  // a few whole sections collapsed (the upper rows come down in a heap),
  // and the sections beside them sagging towards the gap
  for (let i = 0; i < segs.length; i++) {
    if (rand() > 0.07) continue;
    const s = segs[i];
    s.broken = 1 + ((rand() * Math.max(1, s.rows - 3)) | 0);
    for (const j of [i - 1, i + 1]) if (segs[j] && segs[j].broken === segs[j].rows) segs[j].sag = j < i ? 1 : -1;
  }
  const STEP = [0x8f8d88, 0x8a8883, 0x94928c];
  // the seats: plastic shells, faded; a colour to each block of sections
  const SEATS = [0x9c5546, 0x5f6f86, 0x9c5546, 0x8f8a6a];
  const len = (s, off) => Math.hypot(s.b.x - s.a.x, s.b.z - s.a.z) * (Math.abs(s.pm.nz) === 1 ? 1 : (R + off) / R) + 0.06;
  segs.forEach((s, si) => {
    const { pm, yaw } = s;
    const seat = SEATS[Math.floor(si / 6) % SEATS.length];
    const c = Math.cos(yaw);
    const sn = Math.sin(yaw);
    const outer = 1.4 + s.rows * ROW_W;
    for (let k = 0; k < s.broken; k++) {
      const off = 1.4 + k * ROW_W;
      const L = len(s, off);
      // sagging: the upper rows dropped a little and tilted, towards the gap
      const drop = s.sag ? Math.max(0, k - 1) * 0.12 : 0;
      const h = 0.7 + k * ROW_H - drop;
      const p = { x: pm.x + pm.nx * off, z: pm.z + pm.nz * off };
      const step = put(B.root, box(L, h, ROW_W + 0.02, STEP[k % 3], { r: 0.015 }), p.x, h / 2, p.z);
      step.rotation.order = 'YXZ';
      step.rotation.set(0, yaw, s.sag * Math.min(0.06, drop * 0.08));
      step.castShadow = step.receiveShadow = true;
      // the seats along the row: shell and back, many gone, some knocked flat
      const n = Math.floor(L / 0.62);
      for (let q = 0; q < n; q++) {
        if (rand() < 0.42) {
          if (rand() < 0.15) B.piece(0.08, 0.05, 0.08, 0x4a4c50, p.x + c * (-L / 2 + 0.31 + q * 0.62), h + 0.03, p.z - sn * (-L / 2 + 0.31 + q * 0.62)); // a bare stub
          continue;
        }
        const u = -L / 2 + 0.31 + q * 0.62;
        const sx = p.x + c * u + pm.nx * 0.05;
        const sz = p.z - sn * u + pm.nz * 0.05;
        const col = rand() < 0.1 ? 0xb4b1a9 : seat;
        B.piece(0.06, 0.26, 0.06, 0x4a4c50, sx, h + 0.13, sz, 0, yaw, 0);
        B.piece(0.44, 0.07, 0.38, col, sx, h + 0.3, sz, 0, yaw, 0);
        const knocked = rand() < 0.12;
        B.piece(0.44, 0.36, 0.06, col, sx + pm.nx * (knocked ? 0.05 : 0.2), h + (knocked ? 0.36 : 0.5), sz + pm.nz * (knocked ? 0.05 : 0.2), knocked ? 1.3 : 0.12, yaw, 0);
      }
      // overgrowth on the treads, the odd drift of snow
      if (rand() < 0.3) tuft(p.x + c * (rand() - 0.5) * L, h, p.z - sn * (rand() - 0.5) * L, 0.8);
      if (rand() < 0.06) shrub(p.x + c * (rand() - 0.5) * L, h, p.z - sn * (rand() - 0.5) * L, 0.6);
      if (rand() < 0.12) B.lump(p.x + c * (rand() - 0.5) * L * 0.5, h + 0.02, p.z - sn * (rand() - 0.5) * L * 0.5, L * 0.25, 0.04, 0.3, 0xd6d9dd, yaw);
    }
    if (s.broken < s.rows) {
      // collapsed: the broken rows' slabs slid down onto each other, tilted,
      // rebar out of the break, a heap of rubble down the front
      const off = 1.4 + s.broken * ROW_W;
      for (let k = s.broken; k < s.rows; k++) {
        const o = off + (k - s.broken) * ROW_W * 0.7;
        const m = B.chunk(len(s, o) * (0.5 + rand() * 0.35), 0.35, ROW_W * 1.2, STEP[k % 3], pm.x + pm.nx * o + c * (rand() - 0.5) * 0.8, 0.5 + (k - s.broken) * 0.35 + s.broken * ROW_H * 0.4, pm.z + pm.nz * o - sn * (rand() - 0.5) * 0.8, 0, 0, 0);
        m.rotation.order = 'YXZ';
        m.rotation.set((rand() - 0.5) * 0.5, yaw + (rand() - 0.5) * 0.4, (rand() - 0.5) * 0.3);
      }
      K.rubble(B, pm.x + pm.nx * (off + 1), pm.z + pm.nz * (off + 1), 2.3, 0.6 + s.broken * ROW_H * 0.7, { slabs: 2 });
      for (const side of [-1, 1]) B.rebar(pm.x + pm.nx * off + c * side * len(s, off) * 0.45, 0.6 + s.broken * ROW_H, pm.z + pm.nz * off - sn * side * len(s, off) * 0.45, 3);
      for (let i = 0; i < 3; i++) overgrow(pm.x + pm.nx * (off + rand() * 3) + c * (rand() - 0.5) * 2, 0.3, pm.z + pm.nz * (off + rand() * 3) - sn * (rand() - 0.5) * 2);
    } else {
      // the back wall behind the top row, its top broken here and there,
      // ivy up it
      const h = 1.6 + s.rows * ROW_H - (rand() < 0.2 ? 0.6 + rand() : 0);
      const w = put(B.root, box(len(s, outer) + 0.1, h, 0.45, 0x7d7a73, { r: 0.02 }), pm.x + pm.nx * outer, h / 2, pm.z + pm.nz * outer);
      w.rotation.y = yaw;
      w.castShadow = true;
      if (rand() < 0.45) {
        const ih = 1 + rand() * (h - 1);
        const iv = put(B.root, box(0.8 + rand() * 1.4, ih, 0.08, SHRUB[(rand() * 4) | 0], { r: 0.03 }), pm.x + pm.nx * (outer + 0.27), ih / 2, pm.z + pm.nz * (outer + 0.27));
        iv.rotation.y = yaw;
      }
      if (rand() < 0.4) overgrow(pm.x + pm.nx * (outer + 0.9), 0, pm.z + pm.nz * (outer + 0.9));
    }
    // a block over the whole stand, from just behind the pitch-side wall to
    // its back: no driving into it from either side
    const mo = (0.75 + outer + 0.3) / 2;
    B.block(pm.x + pm.nx * mo, pm.z + pm.nz * mo, len(s, outer) / 2 + 0.1, (outer + 0.3 - 0.75) / 2, yaw);
    // the pitch-side wall: a low concrete wall round the inside, solid
    const L0 = Math.hypot(s.b.x - s.a.x, s.b.z - s.a.z);
    const w = put(B.root, box(L0 + 0.08, 1.1, 0.4, 0x8d8b86, { r: 0.02 }), pm.x + pm.nx * 0.5, 0.55, pm.z + pm.nz * 0.5);
    w.rotation.y = yaw;
    B.solid(w);
    B.block(pm.x + pm.nx * 0.5, pm.z + pm.nz * 0.5, L0 / 2 + 0.05, 0.25, yaw);
    if (rand() < 0.35) tuft(pm.x - pm.nx * 0.3, 0, pm.z - pm.nz * 0.3, 1.1);
    // a run of rusted fence above it here and there
    if (rand() < 0.4) for (let k = -1; k <= 1; k++) put(B.root, box(0.05, 1.6, 0.05, 0x5a3f30), pm.x + pm.nx * 0.5 + c * k * L0 * 0.4, 1.9, pm.z + pm.nz * 0.5 - sn * k * L0 * 0.4);
  });
  // the north side: a concourse building along the top (brick, rows of
  // windows, graffiti), and a canopy roof cantilevered over the top rows,
  // half of it gone
  {
    const top = 1.4 + 12 * ROW_W;
    const zf = CZ - R - top;
    const H = 1.6 + 12 * ROW_H + 4;
    const x0 = CX - HL - 4;
    const x1 = CX + HL + 4;
    const wall = put(B.root, box(x1 - x0, H, 3, 0x8a5a44, { r: 0.03 }), (x0 + x1) / 2, H / 2, zf - 1.5);
    wall.castShadow = true;
    for (let x = x0 + 1.5; x < x1 - 1; x += 2.4) {
      for (const y of [H - 2.2, H - 4.6]) put(B.root, box(1.3, 1.4, 0.06, rand() < 0.3 ? 0x2a2b2e : 0x1d1f22), x, y, zf + 0.02);
      if (rand() < 0.25) {
        const ih = 1.5 + rand() * 4;
        put(B.root, box(1.2 + rand() * 1.5, ih, 0.08, SHRUB[(rand() * 4) | 0], { r: 0.03 }), x + 0.6, ih / 2, zf + 0.05); // ivy
      }
    }
    put(B.root, box(x1 - x0, 0.3, 3.4, 0x6d6a64, { r: 0.02 }), (x0 + x1) / 2, H + 0.15, zf - 1.5);
    // the canopy: cantilever beams out over the rows, panels on them, many missing
    for (let x = x0 + 2; x < x1 - 1; x += 4) {
      const beam = put(B.root, box(0.3, 0.4, top * 0.7, 0x5a5d61, { r: 0.02 }), x, H + 0.8, zf + top * 0.35);
      beam.rotation.x = -0.12;
      if (rand() < 0.65) {
        const panel = put(B.root, box(3.9, 0.12, top * 0.65, 0x8f9496, { r: 0.01 }), x + 2, H + 1.0, zf + top * 0.33);
        panel.rotation.x = -0.12;
      } else if (rand() < 0.5) {
        // one hanging down off its beam
        const panel = put(B.root, box(3.9, 0.12, top * 0.4, 0x8f9496, { r: 0.01 }), x + 2, H - 1.5, zf + top * 0.6);
        panel.rotation.x = 0.9;
      }
    }
    // tall lamp posts along the top, one bent
    for (const [x, bent] of [[x0 + 6, 0], [CX, 0.5], [x1 - 6, 0]]) {
      const p = put(B.root, box(0.3, 8, 0.3, 0x6f7276, { r: 0.03 }), x, H + 4, zf + 0.6);
      p.rotation.x = bent;
    }
  }
  // the gates: a concrete gatehouse over each end's opening, a dark tunnel
  // through it, a roller shutter at the inside mouth
  const gates = [];
  for (const [gx, s] of [[W_IN, -1], [E_IN, 1]]) {
    const depth = 1.4 + 8 * ROW_W + 1;
    const cx = gx + s * (depth / 2);
    for (const side of [-1, 1]) {
      const w = put(B.root, box(depth, 6.2, 1.4, 0x7d7a73, { r: 0.04 }), cx, 3.1, CZ + side * (GATE_HALF + 0.7));
      w.castShadow = true;
      B.solid(w);
      B.block(cx, CZ + side * (GATE_HALF + 0.7), depth / 2, 0.7);
    }
    put(B.root, box(depth, 1.4, GATE_HALF * 2 + 2.8, 0x6d6a64, { r: 0.04 }), cx, 6.9, CZ); // the lintel
    put(B.root, box(0.2, 0.5, GATE_HALF * 2, 0x2a2b2e), gx + s * depth, 6.0, CZ); // the dark mouth's top
    for (let i = 0; i < 2; i++) {
      const ih = 2 + rand() * 3;
      put(B.root, box(1.2 + rand(), ih, 0.08, SHRUB[(rand() * 4) | 0], { r: 0.03 }), cx + (rand() - 0.5) * depth * 0.6, ih / 2, CZ + (i ? -1 : 1) * (GATE_HALF + 1.44)); // ivy
    }
    const shutter = new THREE.Group();
    shutter.position.set(gx + s * 0.6, 0, CZ);
    B.add(shutter);
    put(shutter, box(0.2, 5.8, GATE_HALF * 2, 0x5f6670, { r: 0.02 }), 0, 2.9, 0);
    for (let y = 0.4; y < 5.6; y += 0.34) put(shutter, box(0.24, 0.04, GATE_HALF * 2, 0x4d535b), 0, y, 0);
    put(shutter, box(0.28, 0.3, GATE_HALF * 2, 0xc99a2e), 0, 0.15, 0);
    B.keep(shutter); // (after its parts are on: the static merge would bake them in place, shut)
    gates.push({ shutter, open: 1, want: 1, block: { x: gx + s * 0.6, z: CZ, hx: 0.4, hz: GATE_HALF, yaw: 0 } });
  }
  // inside: the ground churned up, and the wreckage of the fighting to use
  // as cover: concrete blocks, heaps, a fallen canopy panel, burnt-out
  // vehicles, sandbags, a crater or two
  {
    const cover = (x, z, yaw, w = 2.6, h = 1.4) => {
      const j = put(B.root, box(w, h, 0.9, 0x9a978f, { r: 0.05 }), x, h / 2, z);
      j.rotation.y = yaw;
      j.castShadow = true;
      B.solid(j);
      B.block(x, z, w / 2, 0.45, yaw);
    };
    for (const [x, z, yaw] of [[CX - 26, -7, 0.3], [CX - 4, -12, 1.2], [CX + 16, -6, 1.5]]) cover(x, z, yaw);
    bags(CX - 18, 9, 4, -0.4);
    bags(CX + 6, 8, 3.5, 0.2);
    K.container(B, CX + 28, 0, 8, 0.15, 0x4f6a5a);
    for (const [x, z, yaw] of [[CX - 8, 2, 0.8], [CX - 9.4, 3.6, 0.9]]) K.jersey(B, x, z, yaw, 1.0, 1.8);
    hedgehog(CX - 30, -12, 0.3);
    hedgehog(CX + 32, -9, 1.1);
    K.rubble(B, CX + 2, -1, 2.4, 1.6, { solid: true, slabs: 3 });
    K.rubble(B, CX - 30, 10, 1.8, 1.2, { solid: true });
    K.rubble(B, CX + 22, 13, 2, 1.4, { solid: true });
    // a big slab of the canopy, come down onto the ground at an angle
    const fall = put(B.root, box(9, 0.25, 4, 0x8f9496, { r: 0.02 }), CX + 10, 1.0, -14);
    fall.rotation.set(0.25, 0.4, 0.12);
    fall.castShadow = true;
    B.solid(fall);
    B.block(CX + 10, -14, 4.2, 1.8, -0.4);
    B.crushable(() => P.bus(B, CX - 14, -14, 1.1), { kind: 'prop', heavy: true, armored: true });
    for (const [x, z, yaw] of [[CX - 22, 0, 0.8], [CX + 20, -12, -0.6], [CX + 30, -2, 1.4]]) wreck(x, z, yaw, { kind: rand() < 0.5 ? 'sedan' : 'van', paint: BURNT_PAINT[(rand() * 6) | 0] });
    for (let i = 0; i < 260; i++) {
      const x = CX + (rand() - 0.5) * 2 * (HL + R - 3);
      const z = CZ + (rand() - 0.5) * 2 * (R - 3);
      if (!inPill(x, z, 2)) continue;
      const s = 0.1 + rand() * 0.3;
      B.piece(s * (1 + rand()), s * 0.6, s, CONCRETE[(rand() * 5) | 0], x, s * 0.25, z, rand(), rand() * 3, rand());
    }
    // the pitch gone wild: grass in tufts and clumps, shrubs, a few
    // saplings up against the walls
    for (let i = 0; i < 380; i++) {
      const x = CX + (rand() - 0.5) * 2 * (HL + R - 1);
      const z = CZ + (rand() - 0.5) * 2 * (R - 1);
      if (!inPill(x, z, 1.2)) continue;
      if (rand() < 0.85) tuft(x, 0, z, 0.8 + rand() * 0.7);
      else shrub(x, 0, z, 0.6 + rand() * 0.5);
    }
    for (let i = 0; i < 14; i++) {
      const p = pillAt(rand(), -2.2);
      if (Math.abs(p.z - CZ) > GATE_HALF + 1) sapling(p.x, 0, p.z, 1 + rand() * 0.4);
    }
  }

  // the checkpoint across the street
  const shackA = buildShack(B, { x0: SHACK_A.x0, x1: SHACK_A.x1, z0: CURB.n + 0.1, z1: CURB.s - 0.1, fill: { n: WALK.n - 0.5, s: WALK.s + 1.2 }, heightAt });

  B.finish();
  B.mergeStatic();

  const room = buildDepotRoom(scene);
  B.blocks.push(...room.blocks);
  B.colliders.push(...room.colliders);
  B.emitters.push(...room.emitters);
  room.bindBlocks(B.blocks);
  const blocks = B.blocks;
  const setGate = (g, open) => {
    g.want = open ? 1 : 0;
    const i = blocks.indexOf(g.block);
    if (!open && i < 0) blocks.push(g.block);
    if (open && i >= 0) blocks.splice(i, 1);
  };
  setGate(gates[1], false);

  // ---------------------------------------------------- the level script
  const SECTORS = ['The approach', 'The stadium'];
  const B1 = { minX: START_X + 2, maxX: shackA.x0 - 0.8, minZ: WALK.n + 0.4, maxZ: WALK.s - 0.4 };
  const B2 = { minX: shackA.x1 + 1.2, maxX: E_IN, minZ: WALK.n + 0.4, maxZ: WALK.s - 0.4 };
  const S = { sector: 0, step: 0, t: 0, boss: null, waveT: 0 };
  const bounds = { ...B1 };
  const setBounds = (api, b) => api.setBounds(Object.assign(bounds, b));
  const go = (step) => {
    S.step = step;
    S.t = 0;
  };
  const near = (api, shack) => Math.hypot(api.tankPos.x - shack.door.x, api.tankPos.z - shack.door.z);
  const atDoor = (api, shack) => shack.inDoor > 0.6 && near(api, shack) < 5;
  const contact = (api, text, seconds = 3) => !api.cleared && api.prompt('Contact', text, { danger: true, seconds });
  function openShack(api, shack, text = null) {
    shack.openIn();
    api.objective('Enter the checkpoint');
    if (text) api.prompt('Zone clear', text, { go: true });
    api.arrow(shack.door, 'Checkpoint');
  }
  const PARTS4 = ['rangefinder', 'twinmg', 'optics']; // (its own parts only: campaign.js rewards)
  // where the tank can go: on the plaza, out to just past its barricade
  // lines (the barricades and the stands hold it, nothing invisible);
  // inside the stadium, its walls
  const PLAZA_B = { minZ: -PLAZA_Z - 6, maxZ: PLAZA_Z + 6, maxX: E_IN };
  function zoneBounds(api) {
    const x = api.tankPos.x;
    if (x < STREET_END - 1) setBounds(api, { minZ: WALK.n + 0.4, maxZ: WALK.s - 0.4 });
    else if (S.step < 2) setBounds(api, PLAZA_B);
  }

  function start(api) {
    Object.assign(S, { sector: 0, step: 0, t: 0, boss: null, waveT: 0, overload: false });
    setBounds(api, B1);
    setGate(gates[0], true);
    setGate(gates[1], false);
    api.enableGun();
    api.revealScraps(false);
    api.giveRockets();
    if (api.tank.ability) api.giveAbility();
    api.sectors(SECTORS, 0, 'Level 5');
    api.objective('Reach the stadium');
  }

  // 1: the approach
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
          contact(api, 'Enemies ahead!');
          go(1);
        }
        break;
      case 1:
        if (api.enemiesAlive === 0 && S.t > 1.5) {
          api.spawnWalker(Math.max(48, x + 16), -4);
          api.spawnWalker(Math.max(52, x + 20), 4, { delay: 0.8 });
          api.spawnDog(Math.max(44, x + 14), 0, { delay: 0.4 });
          go(2);
        }
        break;
      case 2:
        if (api.enemiesAlive === 0 && S.t > 1.5) {
          api.spawnDrone(Math.max(x + 16, 64), -20, { via: [[Math.max(x + 14, 62), -4]] });
          for (const [dx, z, d] of [[0, -3, 0.5], [2, 3, 0.9]]) api.spawnDog(Math.max(74, x + 16) + dx, z, { delay: d });
          go(3);
        }
        break;
      case 3:
        if (api.enemiesAlive === 0 && S.t > 1.5) {
          api.spawnWalker(Math.min(84, Math.max(x + 14, 80)), -3);
          for (const [dx, z, d] of [[0, 3, 0.3], [2, -5, 0.6], [3, 1, 1]]) api.spawnDog(Math.min(84, Math.max(x + 12, 78)) + dx, z, { delay: d });
          go(4);
        }
        break;
      case 4:
        if (api.enemiesAlive === 0 && S.t > 1.5) {
          openShack(api, shackA, 'Area cleared.');
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

  // 2: the plaza, the stadium, the mech
  function startSector2(api) {
    S.sector = 1;
    go(0);
    setBounds(api, B2);
    api.sectors(SECTORS, 1, 'Level 5');
    api.objective('Enter the stadium');
    api.arrow(new THREE.Vector3(W_IN - 4, 1.4, CZ), 'Stadium');
  }
  function sector2(api, dt) {
    const x = api.tankPos.x;
    zoneBounds(api);
    switch (S.step) {
      case 0:
        if (x > STREET_END + 4) {
          for (const [dx, z, d] of [[0, -10, 0], [2, 10, 0.4], [4, 0, 0.8], [6, -4, 1.2]]) api.spawnDog(x + 26 + dx, z, { delay: d });
          api.spawnWalker(x + 34, 8, { delay: 1.4 });
          contact(api, 'Enemies on the plaza!');
          api.cameraTo(new THREE.Vector3(W_IN - 4, 0, CZ), 2.2); // (a look at the way in)
          go(1);
        }
        break;
      case 1:
        if (x > W_IN + 6) {
          // in: the gate comes down behind, and the spider comes for you
          setGate(gates[0], false);
          setBounds(api, { minX: W_IN + 1.5, minZ: CZ - R + 1, maxZ: CZ + R - 1 });
          api.arrow(null);
          if (api.enemiesAlive) api.clearEnemies();
          // (its dashes stop short of the gates: never out through one)
          S.boss = api.spawnSpider(CX + 14, CZ, { yaw: Math.PI, arena: (x, z) => inPill(x, z, 3.2) && !(Math.abs(x - CX) > HL + R - 9 && Math.abs(z - CZ) < GATE_HALF + 3) });
          api.boss(S.boss, 'Mech');
          api.objective('Destroy the mech');
          api.prompt('Mech', 'A <b>mech</b>! Its <b>main gun</b> lines up like a beam (red funnel), then fires a slow explosive shell: get out of the line. Its <b>rocket artillery</b> lands on the <b>red rings</b>. Keep moving and use cover!', { danger: true, seconds: 8 });
          api.spotlight({ targets: [() => (S.boss.alive ? new THREE.Vector3(S.boss.pos.x, 4, S.boss.pos.z) : null)], r: 190 }, () => S.t > 2.4, { maxTime: 3, frame: () => (S.boss.alive ? S.boss.pos.clone() : null), frameK: 1 });
          S.waveT = 18;
          go(2);
        }
        break;
      case 2:
        // at half health it goes down and comes back up overloaded: the
        // camera on it, the HUD away, the world at full speed
        if (S.boss.alive && S.boss.stage2 === 'down' && !S.overload) {
          S.overload = true;
          api.spotlight({ targets: [() => (S.boss.alive ? new THREE.Vector3(S.boss.pos.x, 3, S.boss.pos.z) : null)], r: 190 }, () => S.boss.stage2 !== 'down', { maxTime: 5.6, slow: false, hideHud: true, lock: true, camRate: 1.4, frame: () => (S.boss.alive ? S.boss.pos.clone() : null), frameK: 1 });
        }
        S.waveT -= dt;
        if (S.boss.alive && S.waveT <= 0 && api.enemiesAlive < 4) {
          S.waveT = 22;
          for (const [dz, d] of [[-3, 0], [3, 0.5]]) api.spawnDog(E_IN - 2, CZ + dz, { delay: d });
        }
        if (!S.boss.alive) {
          api.clearEnemies();
          setGate(gates[1], true);
          api.prompt('Mech destroyed', 'The east gate is open!', { go: true, seconds: 5 });
          api.cameraTo(new THREE.Vector3(E_IN + 2, 0, CZ), 2.2); // (over to the way out, then back)
          setBounds(api, { maxX: END_X + 4 });
          api.arrow(new THREE.Vector3(E_IN + 6, 1.4, CZ), 'Exit');
          go(3);
        }
        break;
      case 3:
        if (x > END_X) {
          api.arrow(null);
          api.sectors(SECTORS, 2, 'Level 5');
          api.win('Level clear', { path: [[END_X + 30, CZ], [END_X + 200, CZ]] }); // (on out of the shot)
          go(4);
        }
        break;
    }
  }

  function skipStage(api) {
    // the boss first (before the rest are cleared away, it with them)
    if (S.sector === 1 && S.step === 2 && S.boss?.alive) {
      api.clearSpot();
      api.blast(S.boss.pos.clone().setY(1), 0.5, 99999);
      return true;
    }
    api.clearSpot();
    api.arrow(null);
    api.clearPrompt();
    api.clearEnemies();
    if (S.sector === 0) {
      api.teleport(shackA.door.x - 7, shackA.door.z, 0);
      openShack(api, shackA);
      go(5);
      return true;
    }
    if (S.step < 2) {
      go(1);
      api.teleport(W_IN + 7, CZ, 0);
      return true;
    }
    return false;
  }

  function script(api, dt) {
    S.t += dt;
    if (api.run.mode !== 'field') return;
    if (S.sector === 0) sector1(api);
    else sector2(api, dt);
  }

  function update(dt, t, ctx = {}) {
    B.update(dt, t, ctx);
    shackA.update(dt, t);
    room.update(dt, t, ctx);
    for (const g of gates) {
      g.open += THREE.MathUtils.clamp(g.want - g.open, -dt * 1.2, dt * 1.2);
      g.shutter.position.y = g.open * 5.6;
      g.shutter.scale.y = 1 - g.open * 0.85;
    }
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
    shacks: [shackA],
    start,
    update,
    skipStage,
  };
}
