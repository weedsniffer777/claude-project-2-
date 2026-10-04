// Level 4: the stadium, on a grey winter afternoon. A short level: a run
// up one more city street to a checkpoint, then the stadium itself, and in
// it the siege spider.
//
// Layout (world +X runs bottom-left to top-right on screen):
//  1 The approach: a street of panel blocks and works buildings, a wide
//    plaza at its end. Dogs, walkers, a drone. A checkpoint across the
//    street.
//  2 The stadium: in through the west gate onto the pitch, a big oval of
//    snow-patched grass inside a running track, stands all round (tall on
//    the far side, low on the near one), floodlight towers at the corners.
//    The gate shuts behind you and the siege spider comes for you. Kill it;
//    the east gate opens; out and done.
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

const GPX = 6;
const MAP = { x0: -60, x1: 250, z0: -70, z1: 60 };
const START_X = -20;
const CURB = { n: -7.5, s: 6.5 };
const WALK = { n: -10, s: 9 };
const SW = 0.16;
const SHACK_A = { x0: 90, x1: 97.6 };
const PLAZA = { x0: 104, x1: 132, n: -22, s: 20 };
const ARENA = { cx: 170, cz: -1, rx: 32, rz: 25 }; // the pitch and track inside the stands
const GATE_W = ARENA.cx - ARENA.rx; // the west gate's x (the way in)
const GATE_E = ARENA.cx + ARENA.rx; // the east gate (the way out)
const END_X = GATE_E + 10;

const inStreet = (x) => x < PLAZA.x0;
function heightAt(x, z) {
  if (inStreet(x)) return z <= CURB.n || z >= CURB.s ? SW : 0;
  return 0;
}

// The ground: the street's asphalt, the plaza's paving and snow, and in
// the stadium a red running track round a grass pitch under thin snow,
// its white lines faded.
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
  rect(MAP.x0, MAP.z0, MAP.x1, MAP.z1, '#b9bcc2');
  speckle(g, W, H, ['#a9acb2', '#c6c9ce', '#9fa2a8'], W * H * 0.02, rand);
  // the street and the plaza
  rect(MAP.x0, CURB.n, PLAZA.x0, CURB.s, '#5e5f64');
  rect(PLAZA.x0, PLAZA.n, PLAZA.x1, PLAZA.s, '#8d8e92');
  speckle(g, X(PLAZA.x1) - X(MAP.x0), Z(CURB.s) - Z(CURB.n), ['#68696e', '#54555a', '#6e6e72'], (X(PLAZA.x1) - X(MAP.x0)) * (Z(CURB.s) - Z(CURB.n)) * 0.05, rand, Z(CURB.n), 0);
  // the plaza's paving joints
  g.fillStyle = '#7a7b80';
  for (let x = PLAZA.x0; x < PLAZA.x1; x += 2) g.fillRect(X(x), Z(PLAZA.n), 1, Z(PLAZA.s) - Z(PLAZA.n));
  for (let z = PLAZA.n; z < PLAZA.s; z += 2) g.fillRect(X(PLAZA.x0), Z(z), X(PLAZA.x1) - X(PLAZA.x0), 1);
  // slush over the street
  for (let i = 0; i < 900; i++) {
    const x = MAP.x0 + rand() * (PLAZA.x1 - MAP.x0);
    const z = CURB.n + 0.3 + rand() * (CURB.s - CURB.n - 0.6);
    g.fillStyle = Math.min(z - CURB.n, CURB.s - z) < 1.3 ? '#a9a8a6' : rand() < 0.5 ? '#88867f' : '#78766f';
    blob(g, X(x), Z(z), (0.5 + rand() * 1.3) * GPX, (0.35 + rand() * 0.6) * GPX, rand, 9);
  }
  g.fillStyle = '#aaa79e';
  for (let x = MAP.x0; x < PLAZA.x0; x += 1) if (rand() > 0.45) g.fillRect(X(x), Z(-0.6), GPX, 2);
  // the stadium: the track, then the pitch inside it
  const ell = (rx, rz, color) => {
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(X(ARENA.cx), Z(ARENA.cz), rx * GPX, rz * GPX, 0, 0, Math.PI * 2);
    g.fill();
  };
  ell(ARENA.rx + 1, ARENA.rz + 1, '#7d4a3a');
  ell(ARENA.rx, ARENA.rz, '#8c5444');
  // track lanes
  g.strokeStyle = '#c9b6a8';
  g.lineWidth = 1;
  for (let k = 1; k < 5; k++) {
    g.beginPath();
    g.ellipse(X(ARENA.cx), Z(ARENA.cz), (ARENA.rx - k * 1.1) * GPX, (ARENA.rz - k * 1.1) * GPX, 0, 0, Math.PI * 2);
    g.stroke();
  }
  // the pitch: a rectangle of grass, mown stripes, snow over it in patches
  const PX = ARENA.rx - 7;
  const PZ = ARENA.rz - 7;
  rect(ARENA.cx - PX, ARENA.cz - PZ, ARENA.cx + PX, ARENA.cz + PZ, '#5f7a46');
  for (let i = 0; i < 14; i++) if (i % 2) rect(ARENA.cx - PX + (i * 2 * PX) / 14, ARENA.cz - PZ, ARENA.cx - PX + ((i + 1) * 2 * PX) / 14, ARENA.cz + PZ, '#678350');
  for (let i = 0; i < 260; i++) {
    g.fillStyle = rand() < 0.6 ? '#d6dadf' : '#c3c8cd';
    blob(g, X(ARENA.cx + (rand() - 0.5) * 2 * PX), Z(ARENA.cz + (rand() - 0.5) * 2 * PZ), (0.8 + rand() * 3) * GPX, (0.5 + rand() * 1.6) * GPX, rand, 9);
  }
  // the lines: touchlines, halfway line, centre circle, the boxes
  g.strokeStyle = 'rgba(240,240,236,0.8)';
  g.lineWidth = 2;
  g.strokeRect(X(ARENA.cx - PX + 1), Z(ARENA.cz - PZ + 1), (PX * 2 - 2) * GPX, (PZ * 2 - 2) * GPX);
  g.beginPath();
  g.moveTo(X(ARENA.cx), Z(ARENA.cz - PZ + 1));
  g.lineTo(X(ARENA.cx), Z(ARENA.cz + PZ - 1));
  g.stroke();
  g.beginPath();
  g.arc(X(ARENA.cx), Z(ARENA.cz), 4.5 * GPX, 0, Math.PI * 2);
  g.stroke();
  for (const s of [-1, 1]) g.strokeRect(X(ARENA.cx + s * (PX - 1) - (s > 0 ? 7 : 0)), Z(ARENA.cz - 8), 7 * GPX, 16 * GPX);
  // scorch and craters from the fighting
  for (let i = 0; i < 18; i++) {
    const x = ARENA.cx + (rand() - 0.5) * 2 * PX;
    const z = ARENA.cz + (rand() - 0.5) * 2 * PZ;
    g.fillStyle = 'rgba(30,26,22,0.55)';
    blob(g, X(x), Z(z), (1 + rand() * 1.5) * GPX, (0.8 + rand()) * GPX, rand, 11);
    g.fillStyle = '#3b3532';
    blob(g, X(x), Z(z), (0.4 + rand() * 0.5) * GPX, (0.3 + rand() * 0.4) * GPX, rand, 9);
  }
  return tex(c);
}

export const stadium = {
  id: 'stadium',
  name: 'Level 4 · Destroyed stadium',
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
  slab(MAP.x0, PLAZA.x0, -30, CURB.n);
  slab(MAP.x0, PLAZA.x0, CURB.s, 30);
  for (const [z, dir] of [[CURB.n - 0.35, -1], [CURB.s + 0.35, 1]]) {
    for (let x = START_X - 2; x < PLAZA.x0 - 2; x += 0.6) {
      if (rand() < 0.15) x += 2;
      B.lump(x, SW, z + dir * rand() * 0.25, 0.5 + rand() * 0.4, 0.18 + rand() * 0.15, 0.35 + rand() * 0.2, rand() < 0.3 ? 0xa9aaac : 0xc7cacf, rand() * 3);
    }
  }
  for (let i = 0; i < 300; i++) {
    const x = START_X + rand() * (PLAZA.x1 - START_X);
    const z = WALK.n + rand() * (WALK.s - WALK.n);
    const s = 0.08 + rand() * 0.22;
    B.piece(s * (1 + rand()), s * 0.6, s, rand() < 0.25 ? 0x7a5e50 : CONCRETE[(rand() * 5) | 0], x, heightAt(x, z) + s * 0.25, z, rand(), rand() * 3, rand());
  }
  {
    const R = rails(B, rand);
    for (const z of [-2.25, 1.55]) R.track(R.straight(START_X - 1, z, PLAZA.x0 + 2, z));
  }

  // --------------------------------------------------- 1: the approach
  // behind the start: a mountain of rubble from a fallen block
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
  K.southBlock(-52, -6, 2);
  K.southBlock(-4, 20, 3);
  K.works({ x0: 22, x1: 42, zf: WALK.s + 0.3, side: 's', roof: 'flat', wall: K.BRICK, tin: false, doors: 2 });
  K.southBlock(44, 66, 2);
  K.southBlock(68, 88, 3);
  // either side of the checkpoint, out to the plaza
  K.building({ x0: 97.6, x1: PLAZA.x0 - 0.5, floors: 6 });
  K.southBlock(97.6, PLAZA.x0 - 0.5, 2);
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
  for (let x = START_X + 4; x < PLAZA.x0 - 2; x += 16) {
    if (x > SHACK_A.x0 - 3 && x < SHACK_A.x1 + 3) continue;
    for (const s of [-1, 1]) {
      const z = s < 0 ? CURB.n - 0.45 : CURB.s + 0.45;
      B.crushable(
        () => {
          const pole = cyl(0.09, 6.4, 0x8b8984, { seg: 8, radiusEnd: 0.14 });
          pole.position.set(x, SW + 3.2, z);
          B.add(pole);
          B.solid(pole);
          B.block(x, z, 0.2, 0.2);
          put(B.root, box(0.08, 0.08, 1.7, 0x4a4c50, { r: 0.02 }), x, SW + 6.1, z - s * 0.85).rotation.x = s * 0.12;
          put(B.root, box(0.34, 0.14, 0.6, 0x3c3e42, { r: 0.05 }), x, SW + 6.05, z - s * 1.7);
        },
        { kind: 'pole', pivot: { x, y: SW, z }, footprint: { x, z, hx: 0.25, hz: 0.25, yaw: 0 } },
      );
    }
  }

  // ------------------------------------------------------------ the plaza
  // a wide paved square before the stadium: ticket kiosks, a dry fountain,
  // barriers, a burnt-out bus, banners
  {
    const fx = 116;
    put(B.root, cyl(3, 0.6, 0x9a978f, { seg: 16 }), fx, 0.3, -12);
    put(B.root, cyl(2.6, 0.62, 0xc7cacf, { seg: 16 }), fx, 0.32, -12);
    put(B.root, cyl(0.5, 1.6, 0x8a877f, { seg: 10 }), fx, 0.9, -12);
    B.block(fx, -12, 3, 3);
    for (const [x, z] of [[108, 13], [112, 13], [126, 13]]) {
      put(B.root, box(2.2, 2.4, 2.2, 0x6d7a72, { r: 0.06 }), x, 1.2, z);
      put(B.root, box(2.4, 0.2, 2.4, 0x4e5a52, { r: 0.04 }), x, 2.5, z);
      put(B.root, box(1.6, 0.6, 0.04, 0x1d1f22), x, 1.5, z - 1.12);
      B.block(x, z, 1.1, 1.1);
    }
    B.crushable(() => P.bus(B, 124, -10, 0.4), { kind: 'prop', heavy: true, armored: true });
    for (const [x, z, yaw] of [[110, -3, 1.5], [120, 4, 1.4], [128, -2, 1.6]]) K.jersey(B, x, z, yaw, 1.0, 1.8);
    // buildings round the plaza's sides
    K.building({ x0: PLAZA.x0, x1: PLAZA.x1 + 4, zf: PLAZA.n, floors: 7, shop: true });
    K.southBlock(PLAZA.x0, PLAZA.x1 + 4, 2, PLAZA.s + 0.3);
  }

  // ----------------------------------------------------------- the stadium
  // Stands all the way round the oval, in segments: concrete terraces
  // stepping up and back, rows of coloured seats (many missing), a back
  // wall; tall on the far (north) side with a roof over it, low on the
  // near side so you can see in. Gaps at the west and east ends for the
  // gates. Blocks round the inner edge keep the fight on the pitch.
  const SEATS = [0x3c63a6, 0xc42a20, 0xd8b84a, 0xe8e4da];
  const SEG = 56;
  const gateGap = 0.24; // radians either end left open for the gates
  const standY = [];
  for (let i = 0; i < SEG; i++) {
    const a0 = (i / SEG) * Math.PI * 2;
    const a1 = ((i + 1) / SEG) * Math.PI * 2;
    const am = (a0 + a1) / 2;
    const atGate = Math.abs(Math.atan2(Math.sin(am), Math.cos(am))) < gateGap || Math.abs(Math.atan2(Math.sin(am - Math.PI), Math.cos(am - Math.PI))) < gateGap;
    if (atGate) continue;
    // north (z < 0, far) is tall; south (near) low
    const north = Math.sin(am) < 0;
    const tiers = north ? 9 : 3;
    const cx = Math.cos(am);
    const sz = Math.sin(am);
    const r0x = ARENA.rx + 2;
    const r0z = ARENA.rz + 2;
    const segLen = Math.hypot((Math.cos(a1) - Math.cos(a0)) * r0x, (Math.sin(a1) - Math.sin(a0)) * r0z) + 0.3;
    const yaw = Math.atan2(-(sz * r0x), cx * r0z) + Math.PI / 2; // tangent to the oval
    for (let k = 0; k < tiers; k++) {
      const out = 1 + k * 1.15;
      const x = ARENA.cx + cx * (r0x + out);
      const z = ARENA.cz + sz * (r0z + out);
      const h = 0.9 + k * 0.85;
      const len = segLen * (1 + out / ((r0x + r0z) / 2));
      const step = put(B.root, box(len, h, 1.2, k % 2 ? 0x8d8b86 : 0x9a978f, { r: 0.02 }), x, h / 2, z);
      step.rotation.y = -yaw;
      step.receiveShadow = step.castShadow = true;
      // its row of seats: blocks of colour, gaps where they've gone
      if (k > 0) {
        const col = SEATS[(i + k) % 4];
        for (let j = 0; j < 4; j++) {
          if (rand() < 0.3) continue;
          const t = (j + 0.5) / 4 - 0.5;
          const sx = x + Math.cos(yaw) * t * len * 0.95;
          const sz2 = z - Math.sin(yaw) * t * len * 0.95;
          B.piece(len * 0.22, 0.3, 0.5, rand() < 0.15 ? 0x2a2b2e : col, sx, h + 0.15, sz2, 0, -yaw, 0);
        }
        if (rand() < 0.4) B.lump(x, h + 0.05, z, len * 0.3, 0.08, 0.4, 0xd6d9dd, -yaw);
      }
    }
    // the back wall
    const outW = 1 + tiers * 1.15;
    const wh = 1.5 + tiers * 0.85;
    const bw = put(B.root, box(segLen * (1 + outW / ((r0x + r0z) / 2)), wh, 0.6, 0x7d7a73, { r: 0.03 }), ARENA.cx + cx * (r0x + outW), wh / 2, ARENA.cz + sz * (r0z + outW));
    bw.rotation.y = -yaw;
    bw.castShadow = true;
    standY.push(wh);
    // the pitch-side wall: a low advertising board, solid
    const ix = ARENA.cx + cx * (r0x - 0.6);
    const iz = ARENA.cz + sz * (r0z - 0.6);
    const board = put(B.root, box(segLen, 0.9, 0.3, [0x3c63a6, 0x2b2d30, 0xc99a2e][i % 3], { r: 0.02 }), ix, 0.45, iz);
    board.rotation.y = -yaw;
    B.solid(board);
    B.block(ix, iz, segLen / 2, 0.3, -yaw);
    // the roof over the tall side: a canopy on posts
    if (north) {
      const rx = ARENA.cx + cx * (r0x + outW * 0.55);
      const rz = ARENA.cz + sz * (r0z + outW * 0.55);
      const roof = put(B.root, box(segLen * 1.4, 0.25, outW * 0.9, 0x5a5d61, { r: 0.02 }), rx, wh + 1.6, rz);
      roof.rotation.y = -yaw;
      roof.rotation.x = 0.06;
      if (i % 3 === 0) put(B.root, box(0.3, wh + 1.6, 0.3, 0x4a4c50), ARENA.cx + cx * (r0x + outW - 0.4), (wh + 1.6) / 2, ARENA.cz + sz * (r0z + outW - 0.4));
    }
  }
  // floodlight towers at the four corners, one fallen across the stands
  for (const [a, fallen] of [[-0.75, false], [-2.4, false], [0.8, true], [2.35, false]]) {
    const x = ARENA.cx + Math.cos(a) * (ARENA.rx + 14);
    const z = ARENA.cz + Math.sin(a) * (ARENA.rz + 12);
    const tower = new THREE.Group();
    tower.position.set(x, 0, z);
    B.add(tower);
    put(tower, box(0.8, 20, 0.8, 0x6f7276, { r: 0.04 }), 0, 10, 0);
    for (let y = 2; y < 19; y += 2.5) put(tower, box(1.1, 0.12, 1.1, 0x5a5d61), 0, y, 0);
    const head = put(tower, box(4, 2.4, 0.4, 0x3a3c3f, { r: 0.04 }), 0, 20.5, 0);
    head.rotation.y = Math.atan2(z - ARENA.cz, -(x - ARENA.cx));
    for (let r = 0; r < 3; r++) for (let c2 = 0; c2 < 5; c2++) put(head, box(0.55, 0.55, 0.1, rand() < 0.3 ? 0x1d1f22 : 0xdfe6ee, { r: 0.04 }), -1.6 + c2 * 0.8, -0.8 + r * 0.8, 0.22);
    if (fallen) {
      tower.rotation.z = 1.2;
      tower.rotation.y = 0.6;
      tower.position.y = 0.3;
    }
  }
  // the scoreboard over the west end of the north stand: a dead screen
  {
    const sx = ARENA.cx - 14;
    const sz = ARENA.cz - ARENA.rz - 16;
    put(B.root, box(12, 5, 0.6, 0x2b2d30, { r: 0.05 }), sx, 13, sz);
    put(B.root, box(11, 4, 0.1, 0x101214), sx, 13, sz + 0.32);
    for (let i = 0; i < 40; i++) if (rand() < 0.3) put(B.root, box(0.4, 0.4, 0.05, rand() < 0.5 ? 0xff3b2f : 0xffc24a, { glow: true, r: 0.01 }), sx - 5 + (i % 10) * 1.1, 11.4 + ((i / 10) | 0) * 1, sz + 0.38);
    for (const dx of [-4, 4]) put(B.root, box(0.5, 11, 0.5, 0x4a4c50), sx + dx, 5.5, sz - 0.3);
  }
  // on the pitch: cover from the beam. Goalposts, a burnt-out bus, wrecks,
  // heaps, concrete blocks, a fallen floodlight head
  {
    const cover = (x, z, yaw, w = 2.6, h = 1.4) => {
      const j = put(B.root, box(w, h, 0.9, 0x9a978f, { r: 0.05 }), x, h / 2, z);
      j.rotation.y = yaw;
      j.castShadow = true;
      B.solid(j);
      B.block(x, z, w / 2, 0.45, yaw);
    };
    for (const [x, z, yaw] of [[156, -9, 0.3], [160, 8, -0.4], [176, -12, 1.2], [182, 6, 0.2], [170, 14, 1.5], [166, -18, 0.1]]) cover(x, z, yaw);
    K.rubble(B, 172, 1, 2.2, 1.6, { solid: true, slabs: 3 });
    K.rubble(B, 150, 12, 1.8, 1.2, { solid: true });
    B.crushable(() => P.bus(B, 188, -6, 1.1), { kind: 'prop', heavy: true, armored: true });
    wreckOn(162, -2, 0.8);
    wreckOn(184, 12, -0.6);
    for (const s of [-1, 1]) {
      // goalposts at either end
      const gx = ARENA.cx + s * (ARENA.rx - 8);
      for (const dz of [-3.6, 3.6]) put(B.root, box(0.18, 2.4, 0.18, 0xe8e4da, { r: 0.02 }), gx, 1.2, ARENA.cz + dz);
      put(B.root, box(0.18, 0.18, 7.4, 0xe8e4da, { r: 0.02 }), gx, 2.4, ARENA.cz);
    }
    function wreckOn(x, z, yaw) {
      B.crushable(() => P.car(B, x, z, yaw, { kind: rand() < 0.5 ? 'sedan' : 'van', paint: BURNT_PAINT[(rand() * 6) | 0], snow: true }), { kind: 'car', scrap: 2 });
    }
  }
  // the gates: tunnels through the stands at each end; a roller shutter in
  // each that comes down / goes up
  const gates = [];
  for (const [gx, s] of [[GATE_W, -1], [GATE_E, 1]]) {
    const g = { x: gx + s * 2.6, open: 1, want: 1 };
    for (const side of [-1, 1]) {
      const w = put(B.root, box(9, 6, 1.0, 0x7d7a73, { r: 0.04 }), gx + s * 3.5, 3, ARENA.cz + side * 6.2);
      w.castShadow = true;
      B.solid(w);
      B.block(gx + s * 3.5, ARENA.cz + side * 6.2, 4.5, 0.5);
    }
    put(B.root, box(9, 1.2, 13.4, 0x6d6a64, { r: 0.04 }), gx + s * 3.5, 6.6, ARENA.cz); // the tunnel's roof
    const shutter = new THREE.Group();
    shutter.position.set(g.x, 0, ARENA.cz);
    B.add(shutter);
    B.keep(shutter);
    put(shutter, box(0.2, 5.8, 11.4, 0x5f6670, { r: 0.02 }), 0, 2.9, 0);
    for (let y = 0.4; y < 5.6; y += 0.34) put(shutter, box(0.24, 0.04, 11.4, 0x4d535b), 0, y, 0);
    put(shutter, box(0.28, 0.3, 11.4, 0xc99a2e), 0, 0.15, 0);
    g.shutter = shutter;
    g.block = { x: g.x, z: ARENA.cz, hx: 0.4, hz: 5.8, yaw: 0 };
    gates.push(g);
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
  // both gates start open (the way in), the east one shut
  setGate(gates[1], false);

  // ---------------------------------------------------- the level script
  const SECTORS = ['The approach', 'The stadium'];
  const B1 = { minX: START_X + 2, maxX: shackA.x0 - 0.8, minZ: WALK.n + 0.4, maxZ: WALK.s - 0.4 };
  // the plaza and the stadium: the pitch (inside the boards), the plaza
  // before it, the west tunnel between
  const B2 = { minX: shackA.x1 + 1.2, maxX: GATE_E - 2, minZ: ARENA.cz - ARENA.rz + 0.5, maxZ: ARENA.cz + ARENA.rz - 0.5 };
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
  const PARTS4 = ['twinmg', 'optics', 'autoloader', 'he', 'era', 'afterburner', 'dozer'];
  // the plaza's walls and the stadium keep the tank in; until it's past the
  // gate, the plaza and street widths apply
  function streetBounds(api) {
    const x = api.tankPos.x;
    if (x < PLAZA.x0) setBounds(api, { minZ: WALK.n + 0.4, maxZ: WALK.s - 0.4 });
    else if (x < GATE_W - 1) setBounds(api, { minZ: PLAZA.n + 0.5, maxZ: PLAZA.s - 0.5 });
    else if (x < GATE_W + 7) setBounds(api, { minZ: ARENA.cz - 5.4, maxZ: ARENA.cz + 5.4 }); // the tunnel
    else setBounds(api, { minZ: ARENA.cz - ARENA.rz + 0.5, maxZ: ARENA.cz + ARENA.rz - 0.5 });
  }

  function start(api) {
    Object.assign(S, { sector: 0, step: 0, t: 0, boss: null, waveT: 0 });
    setBounds(api, B1);
    setGate(gates[0], true);
    setGate(gates[1], false);
    api.enableGun();
    api.revealScraps(false);
    api.giveRockets();
    if (api.tank.ability) api.giveAbility();
    api.sectors(SECTORS, 0, 'Level 4');
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
          api.spawnWalker(48, -4);
          api.spawnWalker(52, 4, { delay: 0.8 });
          api.spawnDog(44, 0, { delay: 0.4 });
          go(2);
        }
        break;
      case 2:
        if (api.enemiesAlive === 0 && S.t > 1.5) {
          api.spawnDrone(Math.max(x + 16, 64), -20, { via: [[Math.max(x + 12, 60), -4]] });
          for (const [dx, z, d] of [[0, -3, 0.5], [2, 3, 0.9]]) api.spawnDog(74 + dx, z, { delay: d });
          go(3);
        }
        break;
      case 3:
        if (api.enemiesAlive === 0 && S.t > 1.5) {
          api.spawnWalker(84, -3);
          for (const [dx, z, d] of [[0, 3, 0.3], [2, -5, 0.6], [3, 1, 1]]) api.spawnDog(80 + dx, z, { delay: d });
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

  // 2: the stadium and the siege spider
  function startSector2(api) {
    S.sector = 1;
    go(0);
    setBounds(api, B2);
    api.sectors(SECTORS, 1, 'Level 4');
    api.objective('Enter the stadium');
    api.arrow(new THREE.Vector3(GATE_W + 2, 1.2, ARENA.cz), 'Stadium');
  }
  function sector2(api, dt) {
    const x = api.tankPos.x;
    streetBounds(api);
    switch (S.step) {
      case 0:
        // a few out on the plaza first
        if (x > PLAZA.x0 - 2) {
          for (const [dx, z, d] of [[0, -8, 0], [2, 8, 0.4], [4, 0, 0.8]]) api.spawnDog(PLAZA.x1 - 4 + dx, z, { delay: d });
          go(1);
        }
        break;
      case 1:
        if (x > GATE_W + 8) {
          // in: the gate comes down behind, and the spider comes for you
          setGate(gates[0], false);
          setBounds(api, { minX: GATE_W + 4 });
          api.arrow(null);
          if (api.enemiesAlive) api.clearEnemies();
          S.boss = api.spawnSpider(ARENA.cx + 18, ARENA.cz, { yaw: Math.PI });
          api.boss(S.boss, 'Siege spider');
          api.objective('Destroy the siege spider');
          api.prompt('Siege spider', 'A <b>siege spider</b>! Watch for its <b>beam</b> (red funnel), its <b>mortar rings</b> and its <b>rocket salvos</b>. Keep moving and use cover!', { danger: true, seconds: 8 });
          api.spotlight({ targets: [() => (S.boss.alive ? new THREE.Vector3(S.boss.pos.x, 4, S.boss.pos.z) : null)], r: 190 }, () => S.t > 2.4, { maxTime: 3, frame: () => (S.boss.alive ? S.boss.pos.clone() : null), frameK: 1 });
          S.waveT = 18;
          go(2);
        }
        break;
      case 2:
        // the fight: now and then a few dogs come in from the far tunnel
        S.waveT -= dt;
        if (S.boss.alive && S.waveT <= 0 && api.enemiesAlive < 4) {
          S.waveT = 22;
          for (const [dz, d] of [[-3, 0], [3, 0.5]]) api.spawnDog(GATE_E - 2, ARENA.cz + dz, { delay: d });
        }
        if (!S.boss.alive) {
          api.clearEnemies();
          setGate(gates[1], true);
          api.prompt('Siege spider destroyed', 'The east gate is opening. <b>Drive out!</b>', { go: true, seconds: 5 });
          setBounds(api, { maxX: END_X + 6 });
          api.arrow(new THREE.Vector3(GATE_E + 4, 1.2, ARENA.cz), 'Exit');
          go(3);
        }
        break;
      case 3:
        if (x > END_X) {
          api.arrow(null);
          api.sectors(SECTORS, 2, 'Level 4');
          api.win('Level clear', { path: [[END_X + 6, ARENA.cz], [END_X + 18, ARENA.cz]] });
          go(4);
        }
        break;
    }
  }

  function skipStage(api) {
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
      api.teleport(GATE_W + 9, ARENA.cz, 0);
      return true;
    }
    if (S.step === 2 && S.boss?.alive) {
      api.blast(S.boss.pos.clone().setY(1), 0.5, 99999);
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
    // the gate shutters roll up and down
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
