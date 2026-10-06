// Endless: Outskirts. A crossroads on the edge of the city at dusk, ringed
// by panel blocks and stacked containers; wrecks, barricades and rubble
// heaps for cover; a fortified base (a checkpoint shed) off the avenue's
// north side; an elevated road along the north side, an on-ramp up to it.
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
const MAP = { x0: -140, x1: 140, z0: -72, z1: 66 };
const ARENA = { minX: -58, maxX: 60, minZ: -35, maxZ: 38 };
// the avenue (east-west, tram tracks down it) and the cross street
const AVE = { n: -9, s: 9, wn: -12, ws: 12, x0: -76, x1: 46 };
const CROSS = { x0: -8, x1: 8, w0: -11, w1: 11, n: -16, s: 46 };
// the base: a shed off the north side of the avenue, its back to the
// elevated road, its door facing down the square (the world box it covers)
const BASE = { x: 24, z: -19.5, x0: 18, x1: 30, z0: -23.3, z1: -15.7 };
// the park square on the south-west corner
const PARK = { x0: -54, x1: -14, z0: 15, z1: 38 };
// the elevated road along the north side, running off out of sight both
// ways (rubble across it at the arena's edges)
const DECK = 4.5;
const DECKZ = { n: -36, s: -24 };
const DECKX = { x0: -130, x1: 130 };
// The on-ramp: it peels off the avenue's north lane, curves up and round
// and merges into the elevated road's south lane, the merge lane tapering
// off into it. Sampled along its centreline: point, height, width.
const RAMP_W = 7;
const MERGE = { x0: -10, x1: 14 }; // where it runs alongside the deck (no rail between)
const RAMP = (() => {
  const curve = new THREE.CatmullRomCurve3([[-54, -5.5], [-40, -8], [-28, -14], [-16, -19.6], [-4, -20.5], [6, -21.1], [13.5, -22.9]].map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const N = 64;
  const pts = curve.getSpacedPoints(N);
  const top = pts.findIndex((p) => p.x >= -6); // up at the deck's height from here
  return pts.map((p, i) => {
    const k = Math.min(1, i / top);
    const h = DECK * k * k * (3 - 2 * k); // (eases on and off the slope)
    const w = p.x <= 4 ? RAMP_W : RAMP_W - (RAMP_W - 1.2) * Math.min(1, (p.x - 4) / 9.5); // the merge lane narrowing
    return { x: p.x, z: p.z, h, w };
  });
})();
const RAMP_BOX = { x0: -60, x1: 18, z0: -27, z1: -1 };
// where on the ramp (x, z) is: its height, or null when off it
function rampAt(x, z) {
  if (x < RAMP_BOX.x0 || x > RAMP_BOX.x1 || z < RAMP_BOX.z0 || z > RAMP_BOX.z1) return null;
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < RAMP.length - 1; i++) {
    const a = RAMP[i];
    const b = RAMP[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const L2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L2));
    const d = Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t));
    if (d < bestD) {
      bestD = d;
      best = { d, h: a.h + (b.h - a.h) * t, w: a.w + (b.w - a.w) * t };
    }
  }
  return best && best.d <= best.w / 2 ? best.h : null;
}

function heightAt(x, z) {
  if (x >= DECKX.x0 && x <= DECKX.x1 && z >= DECKZ.n && z < DECKZ.s) return DECK;
  return rampAt(x, z) ?? 0;
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
  road(MAP.x0, AVE.n, MAP.x1, AVE.s);
  road(CROSS.x0, MAP.z0, CROSS.x1, MAP.z1);
  // the ramp's foot, cut across the north sidewalk, and its footprint
  g.strokeStyle = '#4f5257';
  g.lineWidth = RAMP_W * GPX;
  g.beginPath();
  RAMP.forEach((p, i) => (i ? g.lineTo(X(p.x), Z(p.z)) : g.moveTo(X(p.x), Z(p.z))));
  g.stroke();
  // curbs: a pale line along every road edge
  g.fillStyle = '#c4c2bc';
  for (const z of [AVE.n, AVE.s]) for (let x = MAP.x0; x < MAP.x1; x += 0.5) if ((x < CROSS.x0 || x > CROSS.x1) && !(z < 0 && x > -58 && x < -46)) g.fillRect(X(x), Z(z) - 1, 0.5 * GPX + 1, 3);
  for (const x of [CROSS.x0, CROSS.x1]) for (let z = MAP.z0; z < MAP.z1; z += 0.5) if (z < AVE.n || z > AVE.s) g.fillRect(X(x) - 1, Z(z), 3, 0.5 * GPX + 1);
  // slush along the curbs, a broken centre line
  g.fillStyle = 'rgba(214,218,224,0.6)';
  for (let x = MAP.x0; x < MAP.x1; x += 0.7) for (const z of [AVE.n + 0.3, AVE.s - 0.9]) if (rand() < 0.7) blob(g, X(x), Z(z + rand() * 0.6), (0.3 + rand() * 0.6) * GPX, (0.2 + rand() * 0.3) * GPX, rand, 6);
  g.fillStyle = '#d9d2b4';
  for (let x = MAP.x0; x < MAP.x1; x += 6) if (x < CROSS.w0 - 2 || x > CROSS.w1 + 2) g.fillRect(X(x), Z(-0.1), 3 * GPX, 2);
  // zebra crossings on all four sides of the junction
  g.fillStyle = 'rgba(232,230,220,0.85)';
  for (let z = AVE.n + 0.6; z < AVE.s - 0.6; z += 1.2) for (const x of [CROSS.w0 - 3.2, CROSS.w1 + 0.8]) g.fillRect(X(x), Z(z), 2.4 * GPX, 0.6 * GPX);
  for (let x = CROSS.x0 + 0.6; x < CROSS.x1 - 0.6; x += 1.2) for (const z of [AVE.wn - 3.2, AVE.ws + 0.8]) g.fillRect(X(x), Z(z), 0.6 * GPX, 2.4 * GPX);
  // the cross street's paint: a double yellow down the middle, dashed lane
  // lines, solid edge lines; stop lines and lane arrows at every approach;
  // the junction box hatched yellow
  const crossZ = [[MAP.z0, AVE.wn - 3.6], [AVE.ws + 3.6, MAP.z1]];
  for (const [za, zb] of crossZ) {
    g.fillStyle = '#d6b445';
    for (const dx of [-0.3, 0.15]) g.fillRect(X(dx), Z(za), 0.15 * GPX + 1, Z(zb) - Z(za));
    g.fillStyle = 'rgba(232,230,220,0.8)';
    for (const dx of [-7.4, 7.25]) g.fillRect(X(dx), Z(za), 0.15 * GPX + 1, Z(zb) - Z(za));
    for (let z = za; z < zb; z += 4) for (const dx of [-3.9, 3.75]) g.fillRect(X(dx), Z(z), 0.15 * GPX + 1, 2 * GPX);
  }
  // (the avenue: edge lines too, either side of the tracks)
  g.fillStyle = 'rgba(232,230,220,0.7)';
  for (const dz of [AVE.n + 0.6, AVE.s - 0.75]) for (const [xa, xb] of [[MAP.x0, CROSS.w0 - 3.6], [CROSS.w1 + 3.6, MAP.x1]]) g.fillRect(X(xa), Z(dz), X(xb) - X(xa), 0.15 * GPX + 1);
  // stop lines (across the near half of each approach)
  g.fillStyle = 'rgba(240,238,228,0.9)';
  g.fillRect(X(CROSS.x0), Z(AVE.wn - 4.2), X(0) - X(CROSS.x0), 0.5 * GPX);
  g.fillRect(X(0), Z(AVE.ws + 3.7), X(CROSS.x1) - X(0), 0.5 * GPX);
  g.fillRect(X(CROSS.w1 + 3.7), Z(AVE.n), 0.5 * GPX, Z(0) - Z(AVE.n));
  g.fillRect(X(CROSS.w0 - 4.2), Z(0), 0.5 * GPX, Z(AVE.s) - Z(0));
  // lane arrows: a shaft and a head, pointing the way traffic went
  const arrow = (x, z, dx, dz, turn = 0) => {
    g.save();
    g.translate(X(x), Z(z));
    g.rotate(Math.atan2(dz, dx));
    g.fillStyle = 'rgba(240,238,228,0.85)';
    const u = GPX;
    g.fillRect(-2.2 * u, -0.18 * u, 2.4 * u, 0.36 * u);
    g.beginPath();
    g.moveTo(0.9 * u, 0);
    g.lineTo(0, -0.7 * u);
    g.lineTo(0, 0.7 * u);
    g.fill();
    if (turn) {
      g.fillRect(-1.2 * u, 0, 0.36 * u, turn * 1.4 * u);
      g.beginPath();
      g.moveTo(-1.02 * u, turn * 2.1 * u);
      g.lineTo(-1.6 * u, turn * 1.3 * u);
      g.lineTo(-0.44 * u, turn * 1.3 * u);
      g.fill();
    }
    g.restore();
  };
  for (const [x, turn] of [[-5.8, -1], [-2, 0]]) arrow(x, AVE.wn - 9, 0, 1, turn);
  for (const [x, turn] of [[5.8, 1], [2, 0]]) arrow(x, AVE.ws + 9, 0, -1, -turn);
  for (const [z, turn] of [[-6, 1], [-2.6, 0]]) arrow(CROSS.w1 + 9, z, -1, 0, turn);
  for (const [z, turn] of [[6, -1], [2.6, 0]]) arrow(CROSS.w0 - 9, z, 1, 0, turn);
  // the yellow box: an edge and criss-cross hatching (worn)
  g.strokeStyle = 'rgba(214,180,69,0.75)';
  g.lineWidth = 0.22 * GPX;
  g.strokeRect(X(CROSS.x0 + 0.6), Z(AVE.n + 0.6), X(CROSS.x1 - 0.6) - X(CROSS.x0 + 0.6), Z(AVE.s - 0.6) - Z(AVE.n + 0.6));
  g.save();
  g.beginPath();
  g.rect(X(CROSS.x0 + 0.6), Z(AVE.n + 0.6), X(CROSS.x1 - 0.6) - X(CROSS.x0 + 0.6), Z(AVE.s - 0.6) - Z(AVE.n + 0.6));
  g.clip();
  g.lineWidth = 0.14 * GPX;
  for (let k = -20; k <= 20; k += 2.6) {
    g.beginPath();
    g.moveTo(X(k - 10), Z(-10));
    g.lineTo(X(k + 10), Z(10));
    g.moveTo(X(k + 10), Z(-10));
    g.lineTo(X(k - 10), Z(10));
    g.stroke();
  }
  g.restore();
  // worn patches over the paint, so it isn't too crisp
  for (let i = 0; i < 40; i++) {
    g.fillStyle = rand() < 0.5 ? 'rgba(79,82,87,0.7)' : 'rgba(214,218,224,0.5)';
    blob(g, X(-10 + rand() * 20), Z(-26 + rand() * 60), (0.4 + rand()) * GPX, (0.3 + rand() * 0.6) * GPX, rand, 8);
  }
  // the base's apron: concrete, hazard stripes either side of the door
  rect(BASE.x0 - 2, BASE.z1, BASE.x1 + 2, AVE.wn, '#7d8186');
  g.fillStyle = '#c9a23a';
  for (const x of [BASE.x - 4.6, BASE.x + 3.2]) for (let z = BASE.z1 + 0.3; z < AVE.wn - 0.3; z += 1.3) g.fillRect(X(x), Z(z), 1.4 * GPX, 0.6 * GPX);
  // a car park on the south-east corner: painted bays, worn
  g.fillStyle = 'rgba(232,230,220,0.65)';
  for (const z of [17.5, 29]) for (let x = 41; x <= 57; x += 2.8) g.fillRect(X(x), Z(z), 0.12 * GPX + 1, 5 * GPX);
  for (const z of [22.5, 29]) g.fillRect(X(41), Z(z), 16 * GPX, 0.12 * GPX + 1);
  // drains and manhole covers
  for (const [x, z] of [[-30, -8.6], [-30, 8.2], [20, -8.6], [20, 8.2], [40, -8.6], [-48, 8.2], [-7.6, 24], [7.2, -14], [7.2, 30]]) {
    g.fillStyle = '#2e3033';
    g.fillRect(X(x), Z(z), 0.5 * GPX, 0.4 * GPX);
  }
  for (const [x, z] of [[-14, -4], [14, 4], [0, 20], [-40, 4.5], [34, -4.5], [0, -14]]) {
    g.fillStyle = '#3a3c3f';
    g.beginPath();
    g.arc(X(x), Z(z), 0.45 * GPX, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#55585c';
    g.fillRect(X(x) - 0.3 * GPX, Z(z) - 1, 0.6 * GPX, 2);
  }
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

  // A clump of overgrowth: dead scrub and dry weeds pushing up through the
  // snow (no block: the tank rolls through it)
  const SCRUB = [0x4f5a3a, 0x5d6644, 0x6b5a3e, 0x56603f, 0x7a6a48];
  function scrub(x, z, r = 1) {
    const y = heightAt(x, z);
    for (let i = 0; i < 3 + r * 3; i++) B.lump(x + (rand() - 0.5) * r * 1.6, y + 0.12 * r, z + (rand() - 0.5) * r * 1.6, (0.35 + rand() * 0.45) * r, 0.3 * r, 0.35 * r, SCRUB[(rand() * 5) | 0], rand() * 3);
    for (let i = 0; i < 6 * r; i++) B.piece(0.04, 0.4 + rand() * 0.6, 0.04, rand() < 0.5 ? 0x8a7a52 : 0x6b6040, x + (rand() - 0.5) * r * 2, y + 0.3, z + (rand() - 0.5) * r * 2, (rand() - 0.5) * 0.6, 0, (rand() - 0.5) * 0.6);
    if (rand() < 0.6) B.lump(x, y + 0.3 * r, z, 0.5 * r, 0.1, 0.4 * r, 0xd8dce2, rand() * 3);
  }
  // ivy on a wall: a patch of dark leaves (a flat plane just off the face)
  function ivy(x, y, z, w, h, yaw) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), toon(rand() < 0.5 ? 0x3f4a30 : 0x4a5236));
    m.position.set(x, y, z);
    m.rotation.y = yaw;
    B.add(m);
  }

  // ------------------------------------------------------------ the ring
  // north, beyond the elevated road: tall blocks along the skyline, on
  // past both edges
  for (const [x0, x1, f] of [[-140, -112, 7], [-108, -84, 8], [-80, -62, 8], [-58, -30, 9], [-26, -10, 7], [10, 24, 8], [28, 54, 9], [58, 80, 7], [84, 110, 8], [114, 140, 6]]) K.building({ x0, x1, zf: -40, depth: 16, floors: f, holes: 2, broken: 0.35, shop: false });
  // The arena's edge is the buildings themselves: their fronts stand on it,
  // turned a little this way and that and stepped in and out, so the
  // square closes round. West (facing in, east):
  block(-65.5, -18.5, 11, 13, 6, Math.PI / 2 + 0.04);
  block(-65.8, 19.5, 14, 13, 5, Math.PI / 2 - 0.05, { shop: true });
  block(-64.5, 33.5, 12, 12, 4, Math.PI / 2 - 0.35, { mural: true });
  // south (low, toward the camera, so the square shows over them)
  block(-50, 46.2, 17, 12, 3, Math.PI + 0.06, { shop: true });
  block(-30, 46.8, 18, 12, 2, Math.PI - 0.04);
  block(-15, 47.5, 8, 12, 3, Math.PI + 0.1);
  block(16, 47.2, 9, 12, 3, Math.PI - 0.08, { shop: true });
  block(31, 46.4, 18, 12, 2, Math.PI + 0.03);
  block(50, 45.4, 14, 12, 3, Math.PI + 0.42, { mural: true });
  // east, past the base's yard (facing in, west)
  block(67.5, -19, 12, 13, 6, -Math.PI / 2 - 0.05);
  block(67.6, 20, 14, 13, 5, -Math.PI / 2 + 0.06, { shop: true });
  block(65.8, 33.5, 11, 12, 3, -Math.PI / 2 + 0.38);
  // ivy up some of the faces
  ivy(-58.9, 2.2, -16, 4, 3.5, Math.PI / 2);
  ivy(-59.1, 1.6, 22, 5, 2.6, Math.PI / 2);
  ivy(-36, 1.8, 40.1, 6, 2.8, Math.PI);
  ivy(26, 1.4, 40.3, 4, 2.2, Math.PI);
  ivy(61.1, 2.4, 17, 4, 4, -Math.PI / 2);
  // where the streets run out of the square: blocked, wreckage and rubble
  // heaped across from building to building
  {
    // the avenue, west: a burnt bus slewed across, rubble, hedgehogs of jersey
    P.bus(B, -60.5, 1, Math.PI / 2 + 0.25);
    K.rubble(B, -61, -8, 4, 2.2, { solid: true, slabs: 3 });
    K.rubble(B, -61, 9, 3.6, 1.8, { solid: true, slabs: 3 });
    for (const z of [-11, -5.5, 5, 11.5]) K.jersey(B, -57.4, z, Math.PI / 2 + (rand() - 0.5) * 0.4);
    B.block(-60.5, 0, 2.5, 13);
    // the cross street, south: a slab heap and a wrecked tram nose
    K.rubble(B, -2, 41.5, 5.5, 2.4, { solid: true, slabs: 4 });
    K.rubble(B, 7, 42, 3.4, 1.6, { solid: true, slabs: 2 });
    for (const x of [-10, -6.5, 3.5]) K.jersey(B, x, 39.2, (rand() - 0.5) * 0.4);
    B.block(0, 41.5, 12, 2.2);
    // the avenue, east (past the base's yard): a container wall
    for (const z of [-8.5, -2.6, 3.3, 9.2]) K.container(B, 62.5, 0, z, Math.PI / 2 + (rand() - 0.5) * 0.06, CONTAINERS[(rand() * 5) | 0]);
    K.container(B, 62.6, 2.6, 0.4, Math.PI / 2 + 0.05, CONTAINERS[(rand() * 5) | 0]);
    B.block(62.5, 0, 1.4, 13);
  }
  // the streets run on past the blockages, between more blocks, out of sight
  for (const [x, w, f] of [[-80, 13, 5], [-95, 14, 6], [-110, 13, 4], [-125, 15, 6]]) {
    block(x, -18.5, w, 13, f, 0.02 * (rand() - 0.5), { shop: rand() < 0.5 });
    block(x - 3, 18.5, w, 13, f - 1, Math.PI + 0.02 * (rand() - 0.5), { shop: rand() < 0.5 });
  }
  for (const [x, w, f] of [[82, 13, 5], [97, 14, 4], [112, 13, 6], [127, 14, 5]]) {
    block(x, -18.5, w, 13, f, 0.02 * (rand() - 0.5), { shop: rand() < 0.5 });
    block(x + 2, 18.5, w, 13, f - 1, Math.PI + 0.02 * (rand() - 0.5), { shop: rand() < 0.5 });
  }
  for (const [z, f] of [[60, 3], [74, 4]]) {
    block(-19, z, 12, 13, f, -Math.PI / 2, { shop: true });
    block(19, z + 3, 12, 13, f, Math.PI / 2);
  }
  // and more junk in the road out there: wrecks, a jack-knifed tram, heaps
  P.car(B, -72, -4, 0.6, { kind: 'sedan' });
  P.car(B, -86, 5, 2.4, { kind: 'van' });
  P.tram(B, -100, 0, 0.35, { burn: 0.8 });
  K.rubble(B, -118, -2, 4, 1.8, { solid: true, slabs: 3 });
  P.car(B, 74, 4, 2.9, { kind: 'hatch', flipped: true });
  P.bus(B, 90, -3, 0.4);
  K.rubble(B, 106, 2, 4.5, 2, { solid: true, slabs: 3 });
  P.car(B, 2, 52, 1.2, { kind: 'van' });
  K.rubble(B, -3, 62, 4, 1.6, { solid: true, slabs: 2 });
  P.car(B, -3, -48, 0.4, { kind: 'sedan' });
  // (and behind all that, in case: a hard edge)
  B.block(ARENA.minX - 3.5, 8, 0.5, 40);
  B.block(ARENA.maxX + 3.5, 8, 0.5, 40);
  B.block(0, ARENA.maxZ + 4, 80, 0.5);
  // a works shed out on the west edge, under the elevated road
  K.works({ x0: 43, x1: 59, zf: AVE.wn - 0.3, side: 'n', roof: 'saw', wall: 0x8a9a8e, doors: 2, H: 4.2, depth: 8 });

  // ------------------------------------------------------ the elevated road
  {
    const dl = DECKX.x1 - DECKX.x0;
    const dw = DECKZ.s - DECKZ.n;
    const SIDE = 0x8a8780;
    const side = toon(SIDE);
    const under = toon(0x6a675f);
    const deckTex = deckTexture(rand, dl, dw);
    // the on-ramp: the same road surface and the same concrete, walled in
    // down to the ground (an embankment), its edge beams and rails along
    // both sides, the north rail stopping where it merges
    {
      const n = RAMP.length;
      const total = RAMP.reduce((a, p, i) => a + (i ? Math.hypot(p.x - RAMP[i - 1].x, p.z - RAMP[i - 1].z) : 0), 0);
      const side = (i) => {
        const a = RAMP[Math.max(0, i - 1)];
        const b = RAMP[Math.min(n - 1, i + 1)];
        const L = Math.hypot(b.x - a.x, b.z - a.z);
        return { nx: -(b.z - a.z) / L, nz: (b.x - a.x) / L }; // (to the left, going up: north)
      };
      const edge = (i, s) => {
        const p = RAMP[i];
        const { nx, nz } = side(i);
        return new THREE.Vector3(p.x + nx * s * (p.w / 2), p.h, p.z + nz * s * (p.w / 2));
      };
      // the road surface
      const pos = [];
      const uv = [];
      const idx = [];
      let run = 0;
      for (let i = 0; i < n; i++) {
        if (i) run += Math.hypot(RAMP[i].x - RAMP[i - 1].x, RAMP[i].z - RAMP[i - 1].z);
        const l = edge(i, 1);
        const r = edge(i, -1);
        pos.push(l.x, l.y + 0.02, l.z, r.x, r.y + 0.02, r.z);
        uv.push(run / total, 1, run / total, 0);
        if (i) idx.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i - 1, 2 * i + 1, 2 * i);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const road = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ map: deckTexture(rand, total, RAMP_W), gradientMap, side: THREE.DoubleSide }));
      road.receiveShadow = true;
      B.add(road);
      B.solid(road);
      // the walls down to the ground either side
      for (const s of [1, -1]) {
        const wp = [];
        const wi = [];
        for (let i = 0; i < n; i++) {
          const e = edge(i, s);
          wp.push(e.x, e.y + 0.02, e.z, e.x, 0, e.z);
          if (i) wi.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i - 1, 2 * i + 1, 2 * i);
        }
        const wg = new THREE.BufferGeometry();
        wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
        wg.setIndex(wi);
        wg.computeVertexNormals();
        const w = new THREE.Mesh(wg, new THREE.MeshToonMaterial({ color: SIDE, gradientMap, side: THREE.DoubleSide }));
        w.castShadow = w.receiveShadow = true;
        B.add(w);
      }
      // rails and the blocks behind them, where it's high enough to fall
      // off (and not along the merge, on the north side)
      const railMat = toon(0xa9adb2);
      const postMat = toon(0x6f7276);
      const beamMat = toon(SIDE);
      for (let i = 0; i < n - 1; i++) {
        for (const s of [1, -1]) {
          const a = edge(i, s);
          const b = edge(i + 1, s);
          if (Math.max(a.y, b.y) < 0.6) continue;
          if (s > 0 && RAMP[i].x > MERGE.x0) continue;
          const len = a.distanceTo(b);
          const mid = a.clone().add(b).multiplyScalar(0.5);
          const up = new THREE.Vector3(0, 0.62, 0);
          const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, len + 0.05), railMat);
          bar.position.copy(mid).add(up);
          bar.lookAt(b.clone().add(up));
          B.add(bar);
          const beam = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.5, len + 0.05), beamMat);
          beam.position.copy(mid).add(new THREE.Vector3(0, -0.15, 0));
          beam.lookAt(b.clone().add(new THREE.Vector3(0, -0.15, 0)));
          B.add(beam);
          if (i % 2 === 0) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.1), postMat);
            post.position.copy(a).add(new THREE.Vector3(0, 0.4, 0));
            B.add(post);
          }
          B.block(mid.x, mid.z, len / 2 + 0.1, 0.3, -Math.atan2(b.z - a.z, b.x - a.x));
        }
      }
    }
    // the deck's slab and the landing, worn asphalt, edge beams, guard
    // rails, piers to the ground
    const top = new THREE.MeshToonMaterial({ map: deckTex, gradientMap });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(dl, 0.9, dw), [side, side, top, under, side, side]);
    slab.position.set((DECKX.x0 + DECKX.x1) / 2, -0.45, (DECKZ.n + DECKZ.s) / 2);
    slab.castShadow = slab.receiveShadow = true;
    D.add(slab);
    D.solid(slab);
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
      D.piece(len, 0.5, 0.2, SIDE, (x0 + x1) / 2, -0.7, (z0 + z1) / 2, 0, yaw, 0);
    };
    rail(DECKX.x0, DECKZ.n + 0.25, DECKX.x1, DECKZ.n + 0.25);
    rail(DECKX.x0, DECKZ.s - 0.25, MERGE.x0, DECKZ.s - 0.25);
    rail(MERGE.x1, DECKZ.s - 0.25, DECKX.x1, DECKZ.s - 0.25);
    // where the deck's edges stop things
    B.block((DECKX.x0 + DECKX.x1) / 2, DECKZ.n, dl / 2, 0.35);
    B.block((DECKX.x0 + MERGE.x0) / 2, DECKZ.s, (MERGE.x0 - DECKX.x0) / 2, 0.35);
    B.block((MERGE.x1 + DECKX.x1) / 2, DECKZ.s, (DECKX.x1 - MERGE.x1) / 2, 0.35);
    // piers under it
    for (let x = DECKX.x0 + 4; x < DECKX.x1; x += 14) {
      for (const z of [DECKZ.n + 3, DECKZ.s - 3]) put(B.root, box(1.3, DECK - 0.9, 1.3, 0x8a8780, { r: 0.04 }), x, (DECK - 0.9) / 2, z).castShadow = true;
      put(B.root, box(1.5, 0.8, dw - 1, 0x7d7a73, { r: 0.04 }), x, DECK - 1.3, (DECKZ.n + DECKZ.s) / 2);
    }
    // on the deck: lamp posts, wrecks, debris; rubble and barricades across
    // it at the arena's edges (it runs on beyond, out of sight)
    for (let x = DECKX.x0 + 6; x < DECKX.x1 - 4; x += 18) {
      put(D.root, cyl(0.1, 6, 0x8b8984, { seg: 8, radiusEnd: 0.14 }), x, 3, DECKZ.n + 0.6);
      put(D.root, box(0.1, 0.1, 2.2, 0x4a4c50, { r: 0.02 }), x, 5.9, DECKZ.n + 1.6);
      put(D.root, box(0.5, 0.16, 0.7, 0x3c3e42, { r: 0.05 }), x, 5.85, DECKZ.n + 2.7);
      D.block(x, DECKZ.n + 0.6, 0.2, 0.2);
    }
    P.car(D, -40, -29, 0.4, { kind: 'sedan', snow: false });
    P.car(D, -14, -32, -0.2, { kind: 'hatch', flipped: true, snow: false });
    P.bus(D, 4, -31, 0.25);
    P.car(D, 52, -27, 2.9, { kind: 'van', snow: false });
    P.car(D, -90, -30, 0.2, { kind: 'sedan', snow: false });
    P.car(D, 96, -28, 2.6, { kind: 'hatch', snow: false });
    for (const x of [ARENA.minX + 1, ARENA.maxX - 1]) {
      K.rubble(D, x, (DECKZ.n + DECKZ.s) / 2, 4, 2, { solid: true, slabs: 4 });
      for (let z = DECKZ.n + 1; z < DECKZ.s; z += 1.7) K.jersey(D, x + (x < 0 ? 4.5 : -4.5), z, Math.PI / 2 + (rand() - 0.5) * 0.3);
      D.block(x, (DECKZ.n + DECKZ.s) / 2, 3, dw / 2);
    }
    for (let i = 0; i < 300; i++) {
      const x = DECKX.x0 + 4 + rand() * (dl - 8);
      const z = DECKZ.n + 0.8 + rand() * (dw - 1.6);
      const sz = 0.08 + rand() * 0.22;
      D.piece(sz * (1 + rand()), sz * 0.6, sz, CONCRETE[(rand() * 5) | 0], x, sz * 0.25, z, rand(), rand() * 3, rand());
    }
  }

  // ------------------------------------------------- streets: lamps, tracks
  ST.lights({ xs: [-52, -38, -24, 20, 32, 44, 56], skip: (x, side) => Math.abs(x) < 14 || (side < 0 && (x < -14 || (x > BASE.x0 - 4 && x < BASE.x1 + 4))) });
  for (const [x, z, dir] of [[CROSS.w0 - 0.6, AVE.wn + 0.4, 1], [CROSS.w1 + 0.6, AVE.ws - 0.4, -1], [CROSS.w1 + 0.6, AVE.wn + 0.4, 1], [CROSS.w0 - 0.6, AVE.ws - 0.4, -1]]) ST.signal(x, z, dir, rand() < 0.5 ? 'blink' : 'dead');
  {
    const R = rails(B, rand);
    for (const z of [-2.4, 2.4]) R.track(R.straight(MAP.x0, z, MAP.x1, z));
    // one track turns off down the cross street toward the square
    R.track([...R.bend({ x: -14, z: 2.4 }, { x: -2, z: 2.4 }, { x: -2, z: 14 }), ...R.straight(-2, 14, -2, CROSS.s + 10)]);
  }
  // overhead wires across the avenue: a few spans, sagging
  for (const x of [-56, -40, 24, 36]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, AVE.ws - AVE.wn, 3), toon(0x2a2b2e));
    m.rotation.x = Math.PI / 2;
    m.position.set(x, 6.1, 0);
    B.add(m);
  }
  // heat pipes along the south sidewalk, up and over the avenue on an arch
  ST.pipes(-44, -31, AVE.ws + 1.6);
  ST.pipes(44, 60, AVE.ws + 1.6);
  ST.pipeArch(39, AVE.ws + 1.6, AVE.wn - 1.6);
  // utility poles leaning down the cross street, one down across the road
  for (const [x, z] of [[-9.6, 20], [-9.6, 33], [9.6, 26], [9.6, -14]]) P.bentPole(B, x, 0, z, 5.4 + rand(), rand() * 3, rand() < 0.3 ? 0.9 : 0.15, 0x5a5d61);
  P.fallenPole(B, -50, 6.5, 0.35);
  // sidewalk furniture: kiosks (their tubes flicker), a shelter, a bent
  // sign, fires, bins, benches, dumpsters, junk
  ST.kiosk(-14, AVE.wn - 1.8, 1);
  ST.kiosk(20, AVE.ws + 2.4, -1);
  ST.kiosk(-50, PARK.z0 + 1.6, -1);
  ST.shelter(-18, AVE.ws - 1.0, -1);
  ST.shelter(-2, AVE.wn + 1.0, 1);
  ST.bentSign(-14, AVE.wn + 0.6);
  ST.barrelFire(12, AVE.ws + 2.2);
  ST.barrelFire(14, -14.5);
  ST.barrelFire(42, 30);
  ST.clutter(14, 40, 9);
  for (const [x, z, yaw] of [[34.5, AVE.wn - 1.2, 0], [28, AVE.ws + 1.3, Math.PI], [-24, AVE.ws + 1.4, Math.PI + 0.2]]) P.bench(B, x, 0, z, yaw, { tipped: rand() < 0.3 });
  for (const [x, z] of [[31, AVE.wn - 1], [26, AVE.ws + 1.2], [14, -13]]) P.bin(B, x, 0, z, { tipped: rand() < 0.4 });
  P.dumpster(B, -54, 37, 0.3, 0x4e6355);
  P.dumpster(B, 44, 37.5, -0.2, 0x4f5d73);
  P.dumpster(B, 37, -21, 1.4, 0x5e5a4c);
  for (const [x, z] of [[-52, 36], [46, 36], [38, -16.5], [-56, 13.5]]) P.crates(B, x, 0, z);
  P.billboard(B, 30, 38.6, 0.08, (w, h) => sign(w, h, { board: true }));
  P.billboard(B, -40, 38.8, -0.1, (w, h) => sign(w, h, { board: true }));
  // the scrub: in the park, along the building fronts, up through the
  // paving where nobody's swept for years
  for (const [x, z, r] of [
    [-56, 16, 1.2], [-55, 28, 1], [-48, 37, 1.3], [-22, 37, 1], [-16, 16, 0.9], [-44, 30, 0.7],
    [-57, -14, 1], [-44, -22, 0.8], [-30, -24, 0.9], [-20, -14, 0.7], [4, -14, 0.7], [16, -22, 0.8], [33, -14.5, 0.7],
    [58, 24, 1.2], [57, 36, 1], [36, 37, 1.1], [20, 37, 0.9], [44, 18, 0.8], [14, 30, 0.7],
    [58, -22, 1], [-56, -23, 0.8], [-56, 10, 0.6], [-6, 37, 0.8], [12, 18, 0.6],
  ]) scrub(x, z, r);

  // ---------------------------------------------------------- the park
  {
    const pcx = (PARK.x0 + PARK.x1) / 2;
    const pcz = (PARK.z0 + PARK.z1) / 2;
    // the fountain: a round basin, iced over, a column and bowl in the
    // middle with icicles hanging off it
    put(B.root, cyl(3.4, 0.7, 0x8d8b86, { seg: 24 }), pcx, 0.35, pcz).castShadow = true;
    put(B.root, cyl(3.0, 0.08, 0xbcd4e0, { seg: 24 }), pcx, 0.68, pcz);
    put(B.root, cyl(3.45, 0.14, 0x9a978f, { seg: 24 }), pcx, 0.74, pcz);
    put(B.root, cyl(0.45, 1.8, 0x9a978f, { seg: 12 }), pcx, 1.5, pcz).castShadow = true;
    put(B.root, cyl(1.2, 0.3, 0x8d8b86, { seg: 16, radiusEnd: 0.7 }), pcx, 2.45, pcz).castShadow = true;
    put(B.root, cyl(0.25, 0.6, 0x9a978f, { seg: 10 }), pcx, 2.9, pcz);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      put(B.root, cyl(0.05, 0.35 + rand() * 0.4, 0xdbe8ef, { seg: 4, radiusEnd: 0.01 }), pcx + Math.cos(a) * 1.1, 2.1, pcz + Math.sin(a) * 1.1).rotation.x = Math.PI;
    }
    B.lump(pcx + 0.6, 0.78, pcz - 0.8, 1.2, 0.08, 0.7, 0xd8dce2, 0.4);
    B.block(pcx, pcz, 3.3, 3.3);
    // birches in clumps, benches round the paths, planters, lamp posts,
    // a low fence
    for (const [x, z] of [[-50, 18], [-47, 21], [-50, 33], [-45, 35], [-20, 18], [-18, 22], [-24, 35], [-17, 33], [-40, 18], [-30, 36], [-53, 24], [-36, 37]]) ST.birch(x + (rand() - 0.5), z + (rand() - 0.5), 3.6 + rand() * 1.6);
    for (const [x, z, yaw] of [[-40, 24, 0.8], [-28, 30, -2.3], [-28, 22.5, 2.4], [-40, 30, -0.8]]) P.bench(B, x, 0, z, yaw, { tipped: rand() < 0.25 });
    for (const [x, z] of [[-52, 26], [-16, 26], [-34, 16.5], [-34, 37]]) P.planter(B, x, 0, z);
    let i = 0;
    for (const [x, z] of [[-44, 21], [-24, 32], [-44, 33]]) ST.lampPole(x, z, i % 2 ? 1 : -1, 6 + 7 * i++);
    P.fence(B, PARK.x0, PARK.x0 + 14, 0, PARK.z0 - 0.4);
    P.fence(B, PARK.x1 - 12, PARK.x1, 0, PARK.z0 - 0.4);
    for (let k = 0; k < 3; k++) P.bin(B, -46 + k * 12, 0, PARK.z0 + 0.6, { tipped: rand() < 0.4 });
  }
  // a smaller green on the south-east corner: birches, a bench, scrub
  for (const [x, z] of [[26, 30], [30, 33], [22, 34], [38, 22]]) ST.birch(x, z, 3.4 + rand() * 1.5);
  P.bench(B, 28, 0, 26.5, 0.3);
  P.planter(B, 34, 0, 30);

  // ------------------------------------------------------------- cover
  // kept out toward the edges, so the middle of the square is open ground:
  // a stranded tram, wrecks, barricade lines, heaps, a container lot
  P.tram(B, -40, 2.4, 0.03, { burn: 0.7 });
  P.bus(B, -22, -5.5, 0.12);
  for (const [x, z, yaw, kind] of [
    [-52, -6, 0.3, 'sedan'],
    [22, -7, 2.9, 'hatch'],
    [38, 7, 0.2, 'sedan'],
    [24, 24, 2.6, 'van'],
    [-6, 32, 1.4, 'hatch'],
    [44, 26, 0.6, 'hatch'],
    [52, -5, 1.3, 'sedan'],
    [-48, 8, 2.8, 'hatch'],
  ]) P.car(B, x, z, yaw, { kind, flipped: rand() < 0.15 });
  for (const [cx, cz, n, yaw] of [[30, 17, 3, -0.4], [48, 5, 3, 1.4], [16, 34, 3, 1.2]]) {
    for (let k = 0; k < n; k++) K.jersey(B, cx + Math.cos(yaw) * k * 1.7, cz - Math.sin(yaw) * k * 1.7, yaw + (rand() - 0.5) * 0.2);
  }
  for (const [x, z, r, h] of [[40, 33, 2, 1.1]]) K.rubble(B, x, z, r, h, { solid: true, slabs: 3 });
  for (const [x, z, yaw] of [[-52, -20, 0.1], [-44, -21, 1.55]]) K.container(B, x, 0, z, yaw, CONTAINERS[(rand() * 5) | 0]);
  K.container(B, -52.2, 2.6, -20.1, 0.12, CONTAINERS[(rand() * 5) | 0]);
  for (let k = 0; k < 5; k++) P.tires(B, -50 + rand() * 90, 0, rand() < 0.5 ? AVE.wn - 2 - rand() * 2 : AVE.ws + 2 + rand() * 6, 3);
  for (const [x, z, r] of [[-12, 4, 2], [8, -4, 1.6], [30, 10, 1.8], [-50, 4, 1.4]]) P.scorch(B, x, z, r);

  // ------------------------------------------------- the grey corners
  // the car park (south-east): wrecks left in the bays, a barrier arm, a
  // booth, a lamp
  for (const [x, z, yaw, kind] of [[42.5, 20, Math.PI / 2, 'sedan'], [48, 20, Math.PI / 2 + 0.2, 'hatch'], [53.6, 31.5, Math.PI / 2, 'van'], [45, 31.5, Math.PI / 2 - 0.15, 'sedan']]) P.car(B, x, z, yaw, { kind, flipped: rand() < 0.15 });
  put(B.root, box(1.6, 2.2, 1.6, 0x58707a, { r: 0.06 }), 39.5, 1.1, 16.2).castShadow = true;
  B.block(39.5, 16.2, 0.8, 0.8);
  put(B.root, box(3.2, 0.12, 0.12, 0xd8c050), 41.5, 1.0, 14.6).rotation.z = 0.5;
  ST.lampPole(57.5, 25, 1, 13);
  // the junction's corners: bollards along the curbs, electrical cabinets,
  // planters, a phone box
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    P.bollards(B, sx > 0 ? CROSS.w1 + 0.4 : CROSS.w0 - 5.4, sx > 0 ? CROSS.w1 + 5.4 : CROSS.w0 - 0.4, 0, sz * (AVE.ws - 0.5));
    P.planter(B, sx * (CROSS.w1 + 1.6), 0, sz * (AVE.ws + 1.8));
  }
  P.cabinet(B, -12.6, 0, 16, Math.PI / 2);
  P.cabinet(B, 12.6, 0, -13.4, -Math.PI / 2);
  P.cabinet(B, -12.6, 0, 27, Math.PI / 2);
  {
    const ph = put(B.root, box(1.0, 2.3, 1.0, 0x8a2f28, { r: 0.05 }), 12.8, 1.15, 20);
    ph.rotation.y = 0.2;
    ph.castShadow = true;
    put(B.root, box(0.8, 1.5, 0.04, 0x9fc3d0, { glow: true }), 12.8 - 0.52, 1.25, 20).rotation.y = Math.PI / 2 + 0.2;
    B.block(12.8, 20, 0.55, 0.55);
  }
  // the strip beside the park (west of the cross street): a newsstand,
  // benches, a bin, scrub
  ST.kiosk(-12.4, 33, 1);
  P.bench(B, -12.6, 0, 22, Math.PI / 2);
  P.bin(B, -12.4, 0, 24.5);
  // round the base: sandbag walls either side of its apron, a floodlight
  // mast, fuel drums, a guard post
  for (const s of [-1, 1]) {
    for (let z = BASE.z1 - 0.5; z < AVE.wn - 0.4; z += 1.1) B.piece(0.6, 0.5, 1.05, 0x8a7d62, BASE.x + s * 7.4, 0.25, z, 0, (rand() - 0.5) * 0.15, 0);
    for (let z = BASE.z1 - 0.5; z < AVE.wn - 1; z += 1.1) B.piece(0.6, 0.45, 1.0, 0x7f735a, BASE.x + s * 7.4, 0.72, z + 0.5, 0, (rand() - 0.5) * 0.15, 0);
    B.block(BASE.x + s * 7.4, (BASE.z1 + AVE.wn) / 2, 0.4, (AVE.wn - BASE.z1) / 2);
  }
  {
    const mx = BASE.x1 + 3.5;
    const mz = BASE.z0 + 2;
    put(B.root, cyl(0.14, 7.5, 0x6a6d70, { seg: 8 }), mx, 3.75, mz).castShadow = true;
    put(B.root, box(1.6, 0.12, 0.3, 0x45484c), mx, 7.4, mz);
    for (const dx of [-0.55, 0.55]) put(B.root, box(0.45, 0.35, 0.3, 0xfff2c8, { glow: true }), mx + dx, 7.65, mz + 0.1).rotation.x = 0.5;
    B.emit(new THREE.Vector3(mx, 6.5, mz + 3), 0xfff2c8, 20, 14);
    B.pool(mx - 4, mz + 7, 5, 0xfff2c8, 0.12, { sx: 1.2, sz: 0.9 });
    B.block(mx, mz, 0.25, 0.25);
  }
  for (let i = 0; i < 5; i++) put(B.root, cyl(0.32, 0.9, [0x3f5a3a, 0x7a3a2a, 0x3a4a6a][i % 3], { seg: 10 }), BASE.x0 - 2.4 + (i % 3) * 0.7, 0.45, BASE.z0 + 1.2 + ((i / 3) | 0) * 0.7).castShadow = true;
  B.block(BASE.x0 - 1.7, BASE.z0 + 1.6, 1.2, 0.8);

  // the base: a shed of its own off the avenue's north side, its back to
  // the elevated road, its door facing down the square (in and out the same
  // door)
  const BB = new LevelBuilder(scene, 9095);
  const base = buildShack(BB, { x0: -3.8, x1: 3.8, z0: -6, z1: 6, fill: { n: -6, s: 6 }, heightAt: () => 0, label: 'BASE', exitFront: true });
  base.place(BASE.x, BASE.z, Math.PI / 2);

  B.finish();
  B.mergeStatic();
  D.finish();
  D.mergeStatic();
  BB.finish();
  BB.mergeStatic();
  const room = buildDepotRoom(scene);
  const blocks = [...B.blocks, ...D.blocks, ...BB.blocks, ...room.blocks];
  const colliders = [...B.colliders, ...D.colliders, ...BB.colliders, ...room.colliders];
  const emitters = [...B.emitters, ...D.emitters, ...BB.emitters, ...room.emitters];
  room.bindBlocks(blocks);
  base.bindBlocks(blocks);

  // ------------------------------------------------------------ the waves
  const BREAK = 5; // seconds between waves
  const S = { t: 0, time: 0, wave: 0, phase: 'intro', left: BREAK, queue: [], groupT: 0, inBase: false, shut: 0 };
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
      if (x > BASE.x0 - 10 && x < BASE.x1 + 10 && z < AVE.wn + 4) continue; // (not by the base)
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
    Object.assign(S, { t: 0, time: 0, wave: 0, phase: 'intro', left: BREAK + 3, queue: [], groupT: 0, inBase: false, shut: 0 });
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
      api.waveHud({ wave: S.wave, next: Math.max(0, S.left) });
      // into the base (open between waves)
      if (S.out > 0) S.out -= dt;
      if (S.phase === 'break' && !(S.out > 0) && base.inDoor > 0.6 && near(api) < 5) {
        closeBase(api);
        S.phase = 'inbase';
        api.depot(base, {
          offers: [],
          onLeave: () => {
            S.phase = 'break';
            S.left = Math.max(S.left, 3);
            S.shut = 1.2;
            S.out = 4; // (out the same door: not straight back in)
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
      const left = api.enemiesAlive + S.queue.reduce((a, q) => a + q.list.length, 0);
      api.objective(`Wave ${S.wave} · ${left} left · ${mm}:${ss}`);
      api.waveHud({ wave: S.wave, left, next: null });
      if (!S.queue.length && api.enemiesAlive === 0) {
        run.endlessWaves = S.wave; // (waves cleared)
        S.phase = 'break';
        S.left = BREAK;
        openBase(api);
        api.prompt(`Wave ${S.wave} cleared`, 'The <b>base</b> is open: drive in to repair and change your loadout.', { go: true, seconds: 3 });
      }
    }
  }

  function update(dt, t, ctx = {}) {
    B.update(dt, t, ctx);
    D.update(dt, t, ctx);
    BB.update(dt, t, ctx);
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
