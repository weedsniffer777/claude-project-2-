// Endless: Outskirts. A crossroads on the edge of the city at dusk, ringed
// by panel blocks and stacked containers; wrecks, barricades and rubble
// heaps for cover; a fortified base (a checkpoint shed) on the south side.
//
// Waves come in from the edges and never stop. Between waves the base's
// door opens: drive in to repair and change the loadout (the next wave
// waits while you're inside). Each wave is bigger than the last, and the
// machines in it get tougher and hit harder over the first five minutes
// (to about Hard), then keep creeping up. No revive: the run ends when the
// tank does, or when you leave (the pause menu); either way it pays out.
import * as THREE from 'three';
import { addDusk } from '../render/setup.js';
import { box, cyl, put, toon, gradientMap, setLowPoly } from '../models/kit.js';
import { LevelBuilder, canvas, tex, blob, speckle } from './builder.js';
import * as P from './props.js';
import { cityKit, CONTAINERS, PANELS, ACCENTS, CONCRETE } from './cityKit.js';
import { streetKit } from './streetKit.js';
import { rails } from './rails.js';
import { buildShack } from './depot.js';
import { buildDepotRoom } from './depotRoom.js';
import { FH, glyphSign, facadeTextures, endTexture, facadeMat, mapMat } from './cityTextures.js';
import { pushOut } from '../game/collide.js';

const GPX = 6;
const MAP = { x0: -92, x1: 92, z0: -72, z1: 66 };
const ARENA = { minX: -58, maxX: 60, minZ: -35, maxZ: 38 };
// the avenue (east-west, tram tracks down it) and the cross street
const AVE = { n: -9, s: 9, wn: -12, ws: 12, x0: -76, x1: 46 };
const CROSS = { x0: -8, x1: 8, w0: -11, w1: 11, n: -16, s: 46 };
// the base: a shed across the avenue's far (east) end
const BASE = { x0: 46, x1: 53.6, z0: -9, z1: 9 };
// the park square on the south-west corner
const PARK = { x0: -54, x1: -14, z0: 15, z1: 38 };
// the elevated road along the north side: a ramp up from the west, a
// landing, the deck running the arena's width, both ends choked with rubble
const DECK = 4.5;
const DECKZ = { n: -36, s: -24 };
const DECKX = { x0: -66, x1: 54 };
const RAMP = { x0: -50, x1: -24, n: -24, s: -16 };
const LAND = { x0: -24, x1: -16, n: -24, s: -16 };

function heightAt(x, z) {
  if (x >= DECKX.x0 && x <= DECKX.x1 && z >= DECKZ.n && z < DECKZ.s) return DECK;
  if (x >= LAND.x0 && x <= LAND.x1 && z >= LAND.n && z <= LAND.s) return DECK;
  if (x >= RAMP.x0 && x < LAND.x0 && z >= RAMP.n && z <= RAMP.s) return (DECK * (x - RAMP.x0)) / (LAND.x0 - RAMP.x0);
  return 0;
}

// The ground: snowy paving on the sidewalks and the square, slushy asphalt
// down the two streets (zebra crossings at the junction), the park's
// trodden snow and gravel paths, the base's yard in hazard paint.
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
  // paving everywhere: worn slabs, snow in the joints
  rect(MAP.x0, MAP.z0, MAP.x1, MAP.z1, '#a3a39f');
  speckle(g, W, H, ['#999995', '#aeaea9', '#8f8f8b', '#c3c6ca'], W * H * 0.05, rand);
  g.fillStyle = 'rgba(205,210,216,0.55)';
  for (let x = MAP.x0; x < MAP.x1; x += 1.5) g.fillRect(X(x), 0, 1, H);
  for (let z = MAP.z0; z < MAP.z1; z += 1.5) g.fillRect(0, Z(z), W, 1);
  // the park: trodden snow, a gravel cross of paths and a ring round the
  // monument
  rect(PARK.x0, PARK.z0, PARK.x1, PARK.z1, '#c9ccd0');
  speckle(g, X(PARK.x1) - X(PARK.x0), Z(PARK.z1) - Z(PARK.z0), ['#bfc2c6', '#d6d9dc', '#b2b5b8'], (X(PARK.x1) - X(PARK.x0)) * (Z(PARK.z1) - Z(PARK.z0)) * 0.08, rand, Z(PARK.z0), X(PARK.x0));
  const pcx = (PARK.x0 + PARK.x1) / 2;
  const pcz = (PARK.z0 + PARK.z1) / 2;
  g.strokeStyle = '#8f8a80';
  g.lineWidth = 2.4 * GPX;
  g.beginPath();
  g.moveTo(X(PARK.x0), Z(PARK.z0));
  g.lineTo(X(PARK.x1), Z(PARK.z1));
  g.moveTo(X(PARK.x1), Z(PARK.z0));
  g.lineTo(X(PARK.x0), Z(PARK.z1));
  g.stroke();
  g.beginPath();
  g.arc(X(pcx), Z(pcz), 6 * GPX, 0, Math.PI * 2);
  g.stroke();
  // the two streets: asphalt, slush at the edges, faded lane paint
  const road = (x0, z0, x1, z1) => {
    rect(x0, z0, x1, z1, '#4f5257');
    speckle(g, X(x1) - X(x0), Z(z1) - Z(z0), ['#46494d', '#5a5d62', '#55585c', '#6a6d72'], (X(x1) - X(x0)) * (Z(z1) - Z(z0)) * 0.14, rand, Z(z0), X(x0));
  };
  road(AVE.x0 - 20, AVE.n, BASE.x1 + 10, AVE.s);
  road(CROSS.x0, CROSS.n - 30, CROSS.x1, CROSS.s + 20);
  // curbs: a pale line along every road edge
  g.fillStyle = '#c4c2bc';
  for (const z of [AVE.n, AVE.s]) for (let x = AVE.x0 - 20; x < BASE.x0; x += 0.5) if (x < CROSS.x0 || x > CROSS.x1) g.fillRect(X(x), Z(z) - 1, 0.5 * GPX + 1, 3);
  for (const x of [CROSS.x0, CROSS.x1]) for (let z = CROSS.n - 30; z < CROSS.s + 20; z += 0.5) if (z < AVE.n || z > AVE.s) g.fillRect(X(x) - 1, Z(z), 3, 0.5 * GPX + 1);
  // slush along the curbs, a broken centre line
  g.fillStyle = 'rgba(214,218,224,0.6)';
  for (let x = AVE.x0 - 20; x < BASE.x0; x += 0.7) for (const z of [AVE.n + 0.3, AVE.s - 0.9]) if (rand() < 0.7) blob(g, X(x), Z(z + rand() * 0.6), (0.3 + rand() * 0.6) * GPX, (0.2 + rand() * 0.3) * GPX, rand, 6);
  g.fillStyle = '#d9d2b4';
  for (let x = AVE.x0 - 20; x < BASE.x0; x += 6) if (x < CROSS.w0 - 2 || x > CROSS.w1 + 2) g.fillRect(X(x), Z(-0.1), 3 * GPX, 2);
  // zebra crossings on all four sides of the junction
  g.fillStyle = 'rgba(232,230,220,0.85)';
  for (let z = AVE.n + 0.6; z < AVE.s - 0.6; z += 1.2) for (const x of [CROSS.w0 - 3.2, CROSS.w1 + 0.8]) g.fillRect(X(x), Z(z), 2.4 * GPX, 0.6 * GPX);
  for (let x = CROSS.x0 + 0.6; x < CROSS.x1 - 0.6; x += 1.2) for (const z of [AVE.wn - 3.2, AVE.ws + 0.8]) g.fillRect(X(x), Z(z), 0.6 * GPX, 2.4 * GPX);
  // the base's yard: concrete, hazard stripes round the doors
  rect(BASE.x0 - 6, AVE.wn, BASE.x1 + 8, AVE.ws, '#7d8186');
  g.fillStyle = '#c9a23a';
  for (const x of [BASE.x0 - 5, BASE.x1 + 3]) for (let z = -3; z < 3; z += 1.3) g.fillRect(X(x), Z(z), 2.2 * GPX, 0.6 * GPX);
  // potholes, scorch, snow drifts
  for (let i = 0; i < 90; i++) {
    const x = MAP.x0 + rand() * (MAP.x1 - MAP.x0);
    const z = MAP.z0 + rand() * (MAP.z1 - MAP.z0);
    g.fillStyle = rand() < 0.45 ? 'rgba(32,30,28,0.35)' : 'rgba(222,226,232,0.55)';
    blob(g, X(x), Z(z), (0.6 + rand() * 2.2) * GPX, (0.5 + rand() * 1.4) * GPX, rand, 10);
  }
  return mapMat(tex(c));
}
function deckTexture(rand, len, wd) {
  const [c, g] = canvas(Math.round(len * 4), Math.round(wd * 4));
  g.fillStyle = '#5a5d61';
  g.fillRect(0, 0, c.width, c.height);
  speckle(g, c.width, c.height, ['#505357', '#65686c', '#6e7175'], c.width * c.height * 0.15, rand);
  g.fillStyle = '#d9d2b4';
  for (let x = 0; x < c.width; x += 24) g.fillRect(x, (c.height / 2) | 0, 12, 1);
  g.fillStyle = 'rgba(220,224,230,0.6)';
  for (let i = 0; i < len; i++) blob(g, rand() * c.width, rand() < 0.5 ? 2 + rand() * 4 : c.height - 2 - rand() * 4, 2 + rand() * 4, 1 + rand() * 2, rand, 6);
  return tex(c);
}

export const endless = {
  id: 'endless',
  name: 'Endless · Outskirts',
  endless: true, // (no revive; its own end screen; fewer scraps a kill)
  build(scene) {
    setLowPoly(true);
    try {
      return buildEndless(scene);
    } finally {
      setLowPoly(false);
    }
  },
};

function buildEndless(scene) {
  const B = new LevelBuilder(scene, 9091);
  const D = new LevelBuilder(scene, 9093); // up on the elevated road
  D.root.position.y = DECK;
  const rand = B.rand;
  const light = addDusk(scene, { shadowSize: 24, shadowMap: 2048 });
  const sign = (w, h, o = {}) => mapMat(glyphSign(w, h, { rand, ...o }));

  // ground
  {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(MAP.x1 - MAP.x0, MAP.z1 - MAP.z0), groundTexture(rand));
    m.rotation.x = -Math.PI / 2;
    m.position.set((MAP.x0 + MAP.x1) / 2, 0, (MAP.z0 + MAP.z1) / 2);
    m.receiveShadow = true;
    B.add(m);
    B.solid(m);
  }
  const K = cityKit(B, { WALK: { n: AVE.wn, s: AVE.ws }, heightAt });
  const ST = streetKit(B, { CURB: { n: AVE.n, s: AVE.s }, WALK: { n: AVE.wn, s: AVE.ws }, SW: 0, heightAt, sign });

  // A block turned to face any way (yaw: its facade's facing, 0 = +z):
  // panel facades, gutted windows, a snowy roof
  function block(cx, cz, w, d, floors, yaw, o = {}) {
    const H = floors * FH + 0.5;
    const look = { panel: PANELS[(rand() * 5) | 0], accent: ACCENTS[(rand() * 5) | 0], broken: o.broken ?? 0.3, holes: o.holes ?? 1, shop: o.shop ?? rand() < 0.5 };
    const front = facadeMat(facadeTextures(w, floors, look, rand));
    const end = mapMat(endTexture(d, floors, look, rand, !!o.mural));
    const roof = toon(0xc6c9ce);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), [end, end, roof, roof, front, end]);
    m.position.set(cx, H / 2, cz);
    m.rotation.y = yaw;
    m.castShadow = m.receiveShadow = true;
    B.add(m);
    B.solid(m);
    B.block(cx, cz, w / 2, d / 2, yaw);
    B.snowPatch(cx, H, cz, w * 0.85, d * 0.8, yaw);
    // rubble along its foot
    const fx = cx + Math.sin(yaw) * (d / 2 + 0.8);
    const fz = cz + Math.cos(yaw) * (d / 2 + 0.8);
    for (let i = 0; i < 4; i++) B.lump(fx + Math.cos(yaw) * (rand() - 0.5) * w * 0.8, 0.1, fz - Math.sin(yaw) * (rand() - 0.5) * w * 0.8, 0.4 + rand() * 0.5, 0.2, 0.3, rand() < 0.5 ? 0xc9ccd1 : CONCRETE[(rand() * 5) | 0], rand() * 3);
  }

  // ------------------------------------------------------------ the ring
  // north, beyond the elevated road: tall blocks along the skyline
  for (const [x0, x1, f] of [[-92, -62, 8], [-58, -30, 9], [-26, -4, 7], [0, 24, 8], [28, 54, 9], [58, 92, 7]]) K.building({ x0, x1, zf: -40, depth: 16, floors: f, holes: 2, broken: 0.35, shop: false });
  // west: blocks turned in toward the square, stepping round the corner
  block(-70, -16, 14, 12, 6, Math.PI / 2 + 0.06);
  block(-72, 2, 14, 12, 5, Math.PI / 2, { shop: true });
  block(-69, 22, 16, 12, 5, Math.PI / 2 - 0.22);
  block(-60, 44, 16, 12, 4, Math.PI - 0.55, { mural: true });
  // south, toward the camera: low blocks so the square shows over them
  block(-38, 50, 18, 12, 3, Math.PI - 0.12, { shop: true });
  block(-18, 52, 14, 12, 2, Math.PI + 0.05);
  block(18, 52, 16, 12, 3, Math.PI - 0.06, { shop: true });
  block(38, 48, 16, 12, 2, Math.PI + 0.32);
  block(56, 36, 14, 12, 3, Math.PI + 0.75);
  // east, behind the base
  block(72, -14, 16, 12, 6, -Math.PI / 2 + 0.1);
  block(74, 14, 16, 12, 5, -Math.PI / 2 - 0.12, { mural: true });
  // a works shed on the north-east lot, by the deck's foot
  K.works({ x0: 26, x1: 42, zf: AVE.wn - 0.3, side: 'n', roof: 'saw', wall: 0x8a9a8e, doors: 2, H: 4.2, depth: 8 });

  // ------------------------------------------------------ the elevated road
  {
    // the ramp: a wedge climbing east, a parapet on its open (south) side
    const len = LAND.x0 - RAMP.x0;
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.05);
    shape.lineTo(len, 0);
    shape.lineTo(len, DECK - 0.55);
    shape.lineTo(0, -0.05);
    const wedge = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: RAMP.s - RAMP.n, bevelEnabled: false }), toon(0x8d8a83));
    wedge.position.set(RAMP.x0, 0, RAMP.n);
    wedge.receiveShadow = true;
    B.add(wedge);
    B.solid(wedge);
    const ang = Math.atan2(DECK, len);
    const L = Math.hypot(len, DECK);
    const pz = RAMP.s - 0.2;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(L, 0.9, 0.35), toon(0x9a978f));
    wall.position.set((RAMP.x0 + LAND.x0) / 2, DECK / 2 + 0.45, pz);
    wall.rotation.z = ang;
    wall.castShadow = true;
    B.add(wall);
    B.solid(wall);
    for (let x = RAMP.x0; x < LAND.x0; x += 2) B.block(x + 1, pz + 0.2, 1, 0.3);
    for (let x = RAMP.x0 + 3; x < LAND.x0; x += 3) B.piece(0.06, 0.92, 0.37, 0x86837c, x, heightAt(x, -20) + 0.45, pz, 0, 0, ang);
    // the deck's slab (and the landing at the ramp's top), worn asphalt,
    // edge beams, guard rails, piers to the ground
    const dl = DECKX.x1 - DECKX.x0;
    const dw = DECKZ.s - DECKZ.n;
    const side = toon(0x8a8780);
    const top = new THREE.MeshToonMaterial({ map: deckTexture(rand, dl, dw), gradientMap });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(dl, 0.9, dw), [side, side, top, toon(0x6a675f), side, side]);
    slab.position.set((DECKX.x0 + DECKX.x1) / 2, -0.45, (DECKZ.n + DECKZ.s) / 2);
    slab.castShadow = slab.receiveShadow = true;
    D.add(slab);
    D.solid(slab);
    const land = new THREE.Mesh(new THREE.BoxGeometry(LAND.x1 - LAND.x0, 0.9, LAND.s - LAND.n), [side, side, toon(0x5a5d61), toon(0x6a675f), side, side]);
    land.position.set((LAND.x0 + LAND.x1) / 2, -0.45, (LAND.n + LAND.s) / 2);
    land.castShadow = land.receiveShadow = true;
    D.add(land);
    D.solid(land);
    const rail = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const yaw = -Math.atan2(z1 - z0, x1 - x0);
      for (let k = 0; k <= len; k += 2) {
        const x = x0 + ((x1 - x0) * k) / len;
        const z = z0 + ((z1 - z0) * k) / len;
        const bent = rand() < 0.06;
        D.piece(0.1, 0.8, 0.1, 0x6f7276, x, 0.4, z, bent ? 0.4 : 0, 0, 0);
        if (k + 2 <= len && rand() > 0.05) D.piece(2.02, 0.28, 0.06, 0xa9adb2, x + Math.cos(yaw) * 1, bent ? 0.45 : 0.62, z - Math.sin(yaw) * 1, 0, yaw, 0);
      }
      D.piece(len, 0.5, 0.2, 0x7a776f, (x0 + x1) / 2, -0.7, (z0 + z1) / 2, 0, yaw, 0);
    };
    rail(DECKX.x0, DECKZ.n + 0.25, DECKX.x1, DECKZ.n + 0.25);
    rail(DECKX.x0, DECKZ.s - 0.25, LAND.x0, DECKZ.s - 0.25);
    rail(LAND.x1, DECKZ.s - 0.25, DECKX.x1, DECKZ.s - 0.25);
    rail(LAND.x0, LAND.s - 0.25, LAND.x1, LAND.s - 0.25);
    rail(LAND.x1 - 0.25, LAND.n, LAND.x1 - 0.25, LAND.s);
    // where the deck's edges stop things: whole lengths in the block list
    B.block((DECKX.x0 + DECKX.x1) / 2, DECKZ.n, dl / 2, 0.35);
    B.block((DECKX.x0 + LAND.x0) / 2, DECKZ.s, (LAND.x0 - DECKX.x0) / 2, 0.35);
    B.block((LAND.x1 + DECKX.x1) / 2, DECKZ.s, (DECKX.x1 - LAND.x1) / 2, 0.35);
    B.block((LAND.x0 + LAND.x1) / 2, LAND.s, (LAND.x1 - LAND.x0) / 2, 0.35);
    B.block(LAND.x1, (LAND.n + LAND.s) / 2, 0.35, (LAND.s - LAND.n) / 2);
    // piers under it
    for (let x = DECKX.x0 + 6; x < DECKX.x1; x += 14) {
      for (const z of [DECKZ.n + 3, DECKZ.s - 3]) put(B.root, box(1.3, DECK - 0.9, 1.3, 0x8a8780, { r: 0.04 }), x, (DECK - 0.9) / 2, z).castShadow = true;
      put(B.root, box(1.5, 0.8, dw - 1, 0x7d7a73, { r: 0.04 }), x, DECK - 1.3, (DECKZ.n + DECKZ.s) / 2);
    }
    put(B.root, box(1.2, DECK - 0.9, 1.2, 0x8a8780, { r: 0.04 }), (LAND.x0 + LAND.x1) / 2, (DECK - 0.9) / 2, (LAND.n + LAND.s) / 2);
    // on the deck: lamp posts, wrecks, a jack-knifed bus, debris; both
    // ends choked with rubble and barricades
    for (let x = DECKX.x0 + 10; x < DECKX.x1 - 4; x += 18) {
      put(D.root, cyl(0.1, 6, 0x8b8984, { seg: 8, radiusEnd: 0.14 }), x, 3, DECKZ.n + 0.6);
      put(D.root, box(0.1, 0.1, 2.2, 0x4a4c50, { r: 0.02 }), x, 5.9, DECKZ.n + 1.6);
      put(D.root, box(0.5, 0.16, 0.7, 0x3c3e42, { r: 0.05 }), x, 5.85, DECKZ.n + 2.7);
      D.block(x, DECKZ.n + 0.6, 0.2, 0.2);
    }
    P.car(D, -40, -29, 0.4, { kind: 'sedan', snow: false });
    P.car(D, -6, -32, -0.2, { kind: 'hatch', flipped: true, snow: false });
    P.car(D, 20, -27, 2.9, { kind: 'van', snow: false });
    P.bus(D, 38, -31, 0.25);
    for (const x of [DECKX.x0 + 3, DECKX.x1 - 3]) {
      K.rubble(D, x, (DECKZ.n + DECKZ.s) / 2, 4, 2, { solid: true, slabs: 4 });
      for (let z = DECKZ.n + 1; z < DECKZ.s; z += 1.7) K.jersey(D, x + (x < 0 ? 4.5 : -4.5), z, Math.PI / 2 + (rand() - 0.5) * 0.3);
      D.block(x, (DECKZ.n + DECKZ.s) / 2, 3, dw / 2);
    }
    for (let i = 0; i < 160; i++) {
      const x = DECKX.x0 + 4 + rand() * (dl - 8);
      const z = DECKZ.n + 0.8 + rand() * (dw - 1.6);
      const sz = 0.08 + rand() * 0.22;
      D.piece(sz * (1 + rand()), sz * 0.6, sz, CONCRETE[(rand() * 5) | 0], x, sz * 0.25, z, rand(), rand() * 3, rand());
    }
  }

  // ------------------------------------------------- streets: lamps, tracks
  ST.lights({ xs: [-64, -48, -32, -18, 18, 30, 40], skip: (x) => Math.abs(x) < 14 });
  for (const [x, z, dir] of [[CROSS.w0 - 0.6, AVE.wn + 0.4, 1], [CROSS.w1 + 0.6, AVE.ws - 0.4, -1], [CROSS.w1 + 0.6, AVE.wn + 0.4, 1], [CROSS.w0 - 0.6, AVE.ws - 0.4, -1]]) ST.signal(x, z, dir, rand() < 0.5 ? 'blink' : 'dead');
  {
    const R = rails(B, rand);
    for (const z of [-2.4, 2.4]) R.track(R.straight(AVE.x0 - 10, z, BASE.x0 - 3, z));
    // one track turns off down the cross street toward the square
    R.track([...R.bend({ x: -14, z: 2.4 }, { x: -2, z: 2.4 }, { x: -2, z: 14 }), ...R.straight(-2, 14, -2, CROSS.s + 10)]);
  }
  // overhead wires across the avenue: a few spans, sagging
  for (const x of [-56, -40, -24, 24, 36]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, AVE.ws - AVE.wn, 3), toon(0x2a2b2e));
    m.rotation.x = Math.PI / 2;
    m.position.set(x, 6.1, 0);
    B.add(m);
  }
  // sidewalk furniture: a kiosk, a shelter, bins, benches, a bent sign
  ST.kiosk(24, AVE.wn + 1.2, 1);
  ST.shelter(-30, AVE.ws - 1.0, -1);
  ST.bentSign(-14, AVE.wn + 0.6);
  ST.barrelFire(12, AVE.ws + 2.2);
  ST.barrelFire(-46, AVE.wn - 2);
  ST.clutter(-70, -14, 11);
  ST.clutter(14, 40, 11);

  // ---------------------------------------------------------- the park
  {
    const pcx = (PARK.x0 + PARK.x1) / 2;
    const pcz = (PARK.z0 + PARK.z1) / 2;
    // the monument: a stepped plinth, a tank on it (a blocky old one), snow
    B.chunk(6, 0.5, 6, 0x8d8b86, pcx, 0.25, pcz);
    B.chunk(4.4, 0.9, 4.4, 0x9a978f, pcx, 0.95, pcz);
    B.chunk(3, 1.4, 3, 0x7d7c78, pcx, 2.1, pcz);
    const t = new THREE.Group();
    put(t, box(3.2, 0.7, 1.9, 0x5b6248, { r: 0.08 }), 0, 0.35, 0);
    put(t, box(1.5, 0.5, 1.3, 0x5b6248, { r: 0.12 }), -0.2, 0.95, 0);
    put(t, cyl(0.09, 1.9, 0x4e5540, { axis: 'x', seg: 8 }), 1.4, 1.0, 0);
    for (const s of [-1, 1]) put(t, box(3.3, 0.45, 0.4, 0x3e4234, { r: 0.06 }), 0, 0.22, s * 0.95);
    t.position.set(pcx, 2.8, pcz);
    t.rotation.y = 0.7;
    t.traverse((o) => o.isMesh && (o.castShadow = true));
    B.add(t);
    B.snowPatch(pcx, 3.55, pcz, 2.4, 1.4, 0.7);
    B.block(pcx, pcz, 3, 3);
    // birches in clumps, benches along the paths, planters, a low fence
    for (const [x, z] of [[-50, 18], [-47, 21], [-50, 33], [-45, 35], [-20, 18], [-18, 22], [-24, 35], [-17, 33], [-40, 18], [-30, 36]]) ST.birch(x + (rand() - 0.5), z + (rand() - 0.5), 3.6 + rand() * 1.6);
    for (const [x, z, yaw] of [[-42, 24, 0.8], [-26, 30, -2.3], [-28, 21, 2.4], [-41, 31, -0.8]]) P.bench(B, x, 0, z, yaw, { tipped: rand() < 0.25 });
    for (const [x, z] of [[-52, 26], [-16, 26], [-34, 16.5], [-34, 37]]) P.planter(B, x, 0, z);
    P.fence(B, PARK.x0, PARK.x0 + 14, 0, PARK.z0 - 0.4);
    P.fence(B, PARK.x1 - 12, PARK.x1, 0, PARK.z0 - 0.4);
    for (let i = 0; i < 4; i++) P.bin(B, -52 + i * 12, 0, PARK.z0 + 0.6, { tipped: rand() < 0.4 });
  }

  // ------------------------------------------------------------- cover
  // a stranded tram on the avenue, wrecks and a bus about the junction,
  // barricade lines, heaps, a container lot by the works
  P.tram(B, -40, -2.4, 0.03, { burn: 0.7 });
  P.bus(B, 18, 6, Math.PI - 0.35);
  for (const [x, z, yaw, kind] of [
    [-58, 5, 0.3, 'sedan'],
    [-20, -6, 2.9, 'hatch'],
    [12, -14, 1.2, 'van'],
    [-4, 24, 1.7, 'sedan'],
    [6, 32, 1.4, 'hatch'],
    [34, -6, 0.2, 'sedan'],
    [22, 24, 2.6, 'van'],
    [-62, 18, 1.2, 'sedan'],
    [40, 26, 0.6, 'hatch'],
  ]) P.car(B, x, z, yaw, { kind, flipped: rand() < 0.15 });
  for (const [cx, cz, n, yaw] of [[-8, 18, 3, 0.2], [14, 15, 3, 1.4], [-30, -14, 3, 0.1], [30, 18, 3, -0.4], [-56, -10, 3, 1.5]]) {
    for (let i = 0; i < n; i++) K.jersey(B, cx + Math.cos(yaw) * i * 1.7, cz - Math.sin(yaw) * i * 1.7, yaw + (rand() - 0.5) * 0.2);
  }
  for (const [x, z, r, h] of [[0, CROSS.n - 2, 4, 1.8], [0, CROSS.s - 3, 4.5, 2], [AVE.x0 + 2, 0, 5, 2.2], [24, 32, 2, 1.1], [-10, -20, 1.6, 0.9]]) K.rubble(B, x, z, r, h, { solid: true, slabs: 3 });
  for (const [x, z, yaw] of [[36, -18, 0.1], [42, -18, 0.15], [46, 30, 1.2]]) K.container(B, x, 0, z, yaw, CONTAINERS[(rand() * 5) | 0]);
  K.container(B, 39, 2.6, -18.2, 0.12, CONTAINERS[(rand() * 5) | 0]);
  for (let i = 0; i < 5; i++) P.tires(B, -50 + rand() * 90, 0, rand() < 0.5 ? AVE.wn - 2 - rand() * 6 : AVE.ws + 2 + rand() * 6, 3);
  for (const [x, z, r] of [[-12, 4, 2], [8, -4, 1.6], [30, 10, 1.8], [-50, -4, 1.4]]) P.scorch(B, x, z, r);
  // a hard edge round the arena where the ring doesn't quite close
  for (const s of [-1, 1]) B.block(s > 0 ? ARENA.maxX + 2.6 : ARENA.minX - 2.6, 0, 0.5, 50);
  B.block(0, ARENA.maxZ + 2.6, 80, 0.5);

  // the base: a shed across the avenue's far end, a sandbagged yard round
  // it; it can be driven round either side
  const base = buildShack(B, { x0: BASE.x0, x1: BASE.x1, z0: BASE.z0, z1: BASE.z1, fill: { n: BASE.z0, s: BASE.z1 }, heightAt, label: 'BASE' });
  for (const s of [-1, 1]) for (let x = BASE.x0 - 4; x < BASE.x1 + 6; x += 1.1) B.piece(1.05, 0.5, 0.6, 0x8a7d62, x, 0.25, s * (AVE.ws + 3), 0, (rand() - 0.5) * 0.15, 0);
  for (const s of [-1, 1]) B.block((BASE.x0 + BASE.x1 + 2) / 2, s * (AVE.ws + 3), 7, 0.4);

  B.finish();
  B.mergeStatic();
  D.finish();
  D.mergeStatic();
  const room = buildDepotRoom(scene);
  const blocks = [...B.blocks, ...D.blocks, ...room.blocks];
  const colliders = [...B.colliders, ...D.colliders, ...room.colliders];
  const emitters = [...B.emitters, ...D.emitters, ...room.emitters];
  room.bindBlocks(blocks);
  base.bindBlocks(blocks);

  // ------------------------------------------------------------ the waves
  const S = { t: 0, time: 0, wave: 0, phase: 'intro', left: 4, queue: [], groupT: 0, inBase: false, shut: 0 };
  const near = (api) => Math.hypot(api.tankPos.x - base.door.x, api.tankPos.z - base.door.z);
  // how tough each machine is by now: up to about Hard at five minutes,
  // creeping on after that
  const toughness = () => {
    const k = Math.min(1, S.time / 300);
    const late = Math.max(0, S.time - 300) / 600;
    return { hp: 0.7 + 0.6 * k + 0.3 * late, dmg: 0.75 + 0.45 * k + 0.2 * late };
  };
  // somewhere in from an edge, well away from the tank, on open ground
  const edgeSpot = (api) => {
    for (let i = 0; i < 40; i++) {
      const side = (rand() * 4) | 0;
      const along = rand();
      const inset = 2 + rand() * 6;
      const x = side === 0 ? ARENA.minX + inset : side === 1 ? ARENA.maxX - inset : ARENA.minX + 4 + along * (ARENA.maxX - ARENA.minX - 8);
      const z = side === 2 ? ARENA.minZ + inset : side === 3 ? ARENA.maxZ - inset : ARENA.minZ + 4 + along * (ARENA.maxZ - ARENA.minZ - 8);
      if (Math.hypot(x - api.tankPos.x, z - api.tankPos.z) < 22) continue;
      if (x > BASE.x0 - 8 && Math.abs(z) < AVE.ws + 4) continue; // (not in the base's yard)
      const q = new THREE.Vector3(x, 0, z);
      pushOut(q, () => ({ x: q.x, z: q.z, hx: 0.9, hz: 0.7, yaw: 0 }), blocks, 2);
      if (Math.hypot(q.x - x, q.z - z) > 0.2) continue;
      return [x, z];
    }
    return [ARENA.minX + 3, ARENA.minZ + 3];
  };
  const KINDS = [
    { k: 'dog', cost: 1, from: 1 },
    { k: 'walker', cost: 2.5, from: 2 },
    { k: 'hound', cost: 1.5, from: 3 },
    { k: 'drone', cost: 2.2, from: 3 },
    { k: 'gunship', cost: 6, from: 7 },
    { k: 'arty', cost: 8, from: 9 },
  ];
  function spawnOne(api, k, x, z, delay) {
    const opts = { delay };
    const e =
      k === 'walker' ? api.spawnWalker(x, z, opts)
      : k === 'hound' ? api.spawnHound(x, z, opts)
      : k === 'drone' ? api.spawnDrone(x, z, opts)
      : k === 'gunship' ? api.spawnGunship(x, z, opts)
      : k === 'arty' ? api.spawnArty(x, z, { ...opts, hpScale: 0.3 })
      : api.spawnDog(x, z, opts);
    if (e) e.hp = e.maxHp = Math.round(e.maxHp * toughness().hp);
  }
  // a wave: a budget that grows with the wave and the time, spent on a mix
  // that widens as the waves go on, in groups a few seconds apart from
  // different edges
  function buildWave() {
    const n = S.wave;
    let budget = 3 + n * 1.6 + S.time / 60;
    const pool = KINDS.filter((d) => n >= d.from);
    const groups = [];
    let g = [];
    let gCost = 0;
    let heavy = 0;
    while (budget > 0.9) {
      const options = pool.filter((d) => d.cost <= budget && !(d.k === 'arty' && heavy) && !(d.k === 'gunship' && heavy > 1));
      if (!options.length) break;
      // dogs most of the time, the rest weighted toward the cheaper ones
      const d = rand() < 0.45 ? options[0] : options[(rand() * options.length) | 0];
      if (d.cost >= 6) heavy++;
      g.push(d.k);
      gCost += d.cost;
      budget -= d.cost;
      if (gCost >= 4 + n * 0.25) {
        groups.push(g);
        g = [];
        gCost = 0;
      }
    }
    if (g.length) groups.push(g);
    S.queue = groups.map((list, i) => ({ at: i * Math.max(2.5, 6 - n * 0.2), list }));
    S.groupT = 0;
  }
  function openBase(api) {
    base.openIn();
    api.arrow(base.door.clone().setY(2.2), 'Base');
  }
  function closeBase(api) {
    base.closeIn();
    api.arrow(null);
  }

  function start(api) {
    Object.assign(S, { t: 0, time: 0, wave: 0, phase: 'intro', left: 4, queue: [], groupT: 0, inBase: false, shut: 0 });
    api.enableGun();
    api.revealScraps(false);
    api.giveRockets();
    if (api.tank.ability) api.giveAbility();
    api.objective('Get ready');
    api.prompt('Endless', 'Hold out! Between waves, drive into the <b>base</b> to repair and swap parts.', { go: true, seconds: 6 });
  }

  function script(api, dt) {
    if (api.run.mode !== 'field') return;
    const run = api.run;
    S.t += dt;
    S.time += dt;
    run.endlessT = S.time;
    run.endlessWave = S.wave;
    run.dmgMul = toughness().dmg;
    // the base's back door shuts again a moment after you've come out
    if (S.shut > 0 && (S.shut -= dt) <= 0) base.closeOut();
    const mm = Math.floor(S.time / 60);
    const ss = String(Math.floor(S.time % 60)).padStart(2, '0');
    if (S.phase === 'intro' || S.phase === 'break') {
      S.left -= dt;
      api.objective(`${S.phase === 'intro' ? 'First wave' : `Wave ${S.wave + 1}`} in ${Math.ceil(Math.max(0, S.left))} s · ${mm}:${ss}`);
      // into the base (open between waves)
      if (S.phase === 'break' && base.inDoor > 0.6 && near(api) < 5) {
        closeBase(api);
        S.phase = 'inbase';
        api.depot(base, {
          offers: [],
          onLeave: () => {
            S.phase = 'break';
            S.left = Math.max(S.left, 4);
            S.shut = 2;
          },
        });
        return;
      }
      if (S.left <= 0) {
        closeBase(api);
        S.wave++;
        S.phase = 'fight';
        buildWave();
        api.prompt(`Wave ${S.wave}`, S.wave === 1 ? 'Here they come!' : 'Here comes the next wave!', { danger: true, seconds: 3 });
      }
      return;
    }
    if (S.phase === 'fight') {
      S.groupT += dt;
      while (S.queue.length && S.queue[0].at <= S.groupT) {
        const { list } = S.queue.shift();
        const [x, z] = edgeSpot(api);
        list.forEach((k, i) => spawnOne(api, k, x + (rand() - 0.5) * 4, z + (rand() - 0.5) * 4, i * 0.35));
      }
      api.objective(`Wave ${S.wave} · ${api.enemiesAlive + S.queue.reduce((a, q) => a + q.list.length, 0)} left · ${mm}:${ss}`);
      if (!S.queue.length && api.enemiesAlive === 0) {
        run.endlessWaves = S.wave; // (waves cleared)
        S.phase = 'break';
        S.left = 12 + Math.min(6, S.wave * 0.5);
        openBase(api);
        api.prompt(`Wave ${S.wave} cleared`, 'The <b>base</b> is open: repair and change your loadout, or hold your ground.', { go: true, seconds: 4 });
      }
    }
  }

  function update(dt, t, ctx = {}) {
    B.update(dt, t, ctx);
    D.update(dt, t, ctx);
    base.update(dt, t);
    room.update(dt, t, ctx);
    if (ctx.api) script(ctx.api, dt);
  }

  return {
    light,
    colliders,
    blocks,
    emitters,
    crushables: [...B.crushables, ...(D.crushables || [])],
    depotRoom: room,
    heightAt,
    spawn: { x: 30, z: 0, yaw: Math.PI }, // (by the base, facing the junction)
    bounds: { ...ARENA },
    shacks: [base],
    script: S,
    start,
    update,
  };
}
