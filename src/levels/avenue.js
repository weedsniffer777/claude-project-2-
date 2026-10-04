// Zone 1, first segment: a wide avenue through a ruined panel-block district
// at winter dusk. Far future and deliberately placeless: no readable text,
// only worn glyph panels.
//
// Layout (world +X runs bottom-left to top-right on screen):
//  - tall panel blocks on the far (north, -Z) side, facades facing the street,
//    the low sun behind them: the street sits in their shadow, and sunlight
//    spills through the cross street, the alleys and gutted windows
//  - the avenue: slush over wet asphalt between raised, snow-banked
//    sidewalks; overhead trolley wires; sodium and cold-white lamps; a
//    signalled intersection; burnt-out cars and a trolleybus
//  - the near (south) side kept low: heat pipes, garages, fences, ruined
//    walls and street clutter, backlit so it frames the street in silhouette
//  - a heat-pipe arch over the road halfway, and a gated checkpoint at the end
import * as THREE from 'three';
import { addDusk, DUSK_SUN } from '../render/setup.js';
import { box, cyl, put, toon, glowMat, gradientMap, setLowPoly } from '../models/kit.js';
import { LevelBuilder, canvas, tex, blob, speckle } from './builder.js';
import * as P from './props.js';
import { buildShack } from './depot.js';
import { buildDepotRoom } from './depotRoom.js';

const FH = 1.35; // floor height
const PX = 12; // facade texels per world unit
const GPX = 10; // ground texels per world unit
const MAP = { x0: -80, x1: 176, z0: -84, z1: 50 }; // ground extent
const RIVER = { x0: 60, x1: 78, y: -3.4 }; // the river the avenue bridges
const BRIDGE = { n: -10.4, s: 9.8 }; // deck edges
const GX = 100; // the gate across the street
const START_X = -32; // the barricade behind the start
const CURB = { n: -7.5, s: 6.5 };
const WALK = { n: -10, s: 9 };
const SW = 0.16; // sidewalk height
const CROSS = { x0: 17, x1: 27 }; // the cross street running north
const JUNCTION = { x0: 128, x1: 144 }; // the intersection at the end of the zone
const END_X = 156; // the shipping-container wall the airstrike opens
// the open square on the far corner of the intersection: the fight's arena
// the two squares on the far corners of the intersection, back edges in line
// with the side streets' rubble; in line with the end wall a row of low
// anti-tank obstacles crosses each, with more square behind before the blocks
const PLAZA = { x0: 144, x1: 167, z: 25 };
const SHACKS = [{ x0: 50, x1: 57.6 }, { x0: 105.4, x1: 113 }]; // checkpoint shacks across the street

const SODIUM = [0xffa245, 0xff9636, 0xffb15a];
const COLD = 0xcfe8ff;
const SUN = 0xffc98a;
const NEON = 0x5fd0ff;

const PANELS = ['#9a978f', '#a5a095', '#91959a', '#aca393', '#8b8e92'];
const ACCENTS = ['#5f8784', '#a3874e', '#5c6f8c', '#8f8550', '#6f7f6a'];
const PAINT = [0x8a8172, 0x6d7a72, 0x5d6b80, 0x9b9277, 0x707a5c, 0xb3ad9c];
const CONCRETE = [0x8d8b86, 0x7d7c78, 0x9a978f, 0x6f6e6b, 0x85898c];
const BURNT_PAINT = [0x5d6b80, 0x8a8172, 0x6f7f6a, 0x9b9277, null, 0x7a6a5a];

// Where a sun ray through p lands at height h.
const SUN_DIR = DUSK_SUN.clone().negate().normalize();
function toGround(p, h = 0) {
  const t = (p.y - h) / -SUN_DIR.y;
  return new THREE.Vector3(p.x + SUN_DIR.x * t, h, p.z + SUN_DIR.z * t);
}

const inJunction = (x) => x > JUNCTION.x0 && x < JUNCTION.x1;
const JROAD = { x0: JUNCTION.x0 + 2, x1: JUNCTION.x1 - 2 }; // the cross road, sidewalks either side
const onSidewalk = (x, z) => {
  const off = z >= CURB.s || z <= CURB.n;
  if (inJunction(x)) return off && !(x > JROAD.x0 && x < JROAD.x1);
  return z >= CURB.s || (z <= CURB.n && !(x > CROSS.x0 && x < CROSS.x1));
};
const heightAt = (x, z) => (onSidewalk(x, z) ? SW : 0);
const inRiver = (x) => x > RIVER.x0 - 0.5 && x < RIVER.x1 + 0.5;
const overWater = (x, z) => inRiver(x) && (z < BRIDGE.n || z > BRIDGE.s);

// ---------------------------------------------------------------- textures
function glyphs(g, x, y, w, h, cells, color, rand) {
  const cw = w / cells;
  g.fillStyle = color;
  for (let i = 0; i < cells; i++) {
    if (rand() < 0.18) continue;
    const gx = x + i * cw + cw * 0.15;
    const gw = cw * 0.7;
    const strokes = 2 + ((rand() * 3) | 0);
    for (let s = 0; s < strokes; s++) {
      if (rand() < 0.5) g.fillRect(Math.round(gx + rand() * gw * 0.6), y, Math.max(1, Math.round(gw * 0.22)), h);
      else g.fillRect(gx, Math.round(y + rand() * h * 0.8), Math.round(gw * (0.5 + rand() * 0.5)), Math.max(1, Math.round(h * 0.2)));
    }
  }
}

// Worn sign panel with abstract glyphs: reads as signage, is no real script.
function glyphSign(w, h, { board = '#2c3034', ink = '#c9c1a8', rand }) {
  const S = 16;
  const [c, g] = canvas(w * S, h * S);
  g.fillStyle = board;
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = 'rgba(255,255,255,0.08)';
  g.fillRect(0, 0, c.width, 2);
  const cells = Math.max(2, Math.round(w / (h * 0.75)));
  glyphs(g, c.width * 0.06, c.height * 0.22, c.width * 0.88, c.height * 0.56, cells, ink, rand);
  for (let i = 0; i < 6; i++) {
    g.fillStyle = board;
    blob(g, rand() * c.width, rand() * c.height, 3 + rand() * 8, 2 + rand() * 6, rand);
  }
  g.fillStyle = 'rgba(110,70,40,0.5)';
  for (let i = 0; i < 5; i++) g.fillRect((rand() * c.width) | 0, (rand() * c.height * 0.5) | 0, 1, 4 + rand() * 10);
  return tex(c);
}

function hazardTexture() {
  const [c, g] = canvas(32, 32);
  g.fillStyle = '#2a2b2d';
  g.fillRect(0, 0, 32, 32);
  g.fillStyle = '#c99a2e';
  for (let i = -32; i < 64; i += 16) {
    g.beginPath();
    g.moveTo(i, 32);
    g.lineTo(i + 8, 32);
    g.lineTo(i + 40, 0);
    g.lineTo(i + 32, 0);
    g.fill();
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Road surface: wet asphalt under slush, ruts, faded markings, craters.
function roadTexture(rand, craters) {
  const W = (MAP.x1 - MAP.x0) * GPX;
  const H = (MAP.z1 - MAP.z0) * GPX;
  const [c, g] = canvas(W, H);
  const X = (x) => (x - MAP.x0) * GPX;
  const Z = (z) => (z - MAP.z0) * GPX;
  const rect = (x0, z0, x1, z1, color) => {
    g.fillStyle = color;
    g.fillRect(X(x0), Z(z0), X(x1) - X(x0), Z(z1) - Z(z0));
  };
  rect(MAP.x0, MAP.z0, MAP.x1, MAP.z1, '#c3c6cc');
  rect(MAP.x0, CURB.n, MAP.x1, CURB.s, '#5c5d62');
  rect(CROSS.x0, -32, CROSS.x1, CURB.n, '#5c5d62');
  rect(JROAD.x0, MAP.z0, JROAD.x1, MAP.z1, '#5c5d62');
  speckle(g, W, Z(CURB.s) - Z(CURB.n), ['#66676c', '#525358', '#6c6c70'], W * 40, rand, Z(CURB.n));

  g.fillStyle = '#aaa79e';
  for (const z of [-4, -0.6, -0.3, 3]) {
    const center = z === -0.6 || z === -0.3;
    for (let x = MAP.x0; x < MAP.x1; x += center ? 1 : 4) {
      if (rand() < 0.45 || (x > JROAD.x0 - 2.5 && x < JROAD.x1 + 2.5)) continue;
      g.fillRect(X(x), Z(z), (center ? 1 : 2) * GPX, 2);
    }
  }
  g.fillStyle = '#a19e95';
  for (const x of [CROSS.x0 - 2.2, CROSS.x1 + 0.4]) {
    for (let z = CURB.n + 0.4; z < CURB.s - 0.4; z += 1.1) {
      if (rand() < 0.3) continue;
      g.fillRect(X(x), Z(z), 1.8 * GPX, 0.55 * GPX);
    }
  }
  for (let i = 0; i < 1300; i++) {
    const x = MAP.x0 + rand() * (MAP.x1 - MAP.x0);
    const z = CURB.n + 0.3 + rand() * (CURB.s - CURB.n - 0.6);
    const nearCurb = Math.min(z - CURB.n, CURB.s - z) < 1.3;
    g.fillStyle = nearCurb ? (rand() < 0.5 ? '#a9a8a6' : '#9a9996') : rand() < 0.5 ? '#86847f' : '#76746f';
    blob(g, X(x), Z(z), (0.5 + rand() * 1.3) * GPX, (0.35 + rand() * 0.6) * GPX, rand, 9);
  }
  g.fillStyle = '#44454a';
  for (const z of [-6.2, -5.1, -2.8, -1.7, 1.0, 2.1, 4.1, 5.2]) {
    let x = MAP.x0;
    while (x < MAP.x1) {
      const len = 2 + rand() * 9;
      if (rand() < 0.55 && (x + len < JROAD.x0 || x > JROAD.x1)) g.fillRect(X(x), Z(z + (rand() - 0.5) * 0.2), len * GPX, 2);
      x += len + rand() * 2;
    }
  }
  // the cross road at the intersection, worn the same way as the avenue
  {
    const jx = (JROAD.x0 + JROAD.x1) / 2;
    const zs = [[MAP.z0, CURB.n], [CURB.s, MAP.z1]];
    for (const [za, zb] of zs) {
      for (let i = 0; i < (Z(zb) - Z(za)) * 40; i++) {
        g.fillStyle = ['#66676c', '#525358', '#6c6c70'][(rand() * 3) | 0];
        g.fillRect((X(JROAD.x0) + rand() * (X(JROAD.x1) - X(JROAD.x0))) | 0, (Z(za) + rand() * (Z(zb) - Z(za))) | 0, 1, 1);
      }
      for (let i = 0; i < 160; i++) {
        const x = JROAD.x0 + 0.3 + rand() * (JROAD.x1 - JROAD.x0 - 0.6);
        const z = za + rand() * (zb - za);
        const nearCurb = Math.min(x - JROAD.x0, JROAD.x1 - x) < 1.3;
        g.fillStyle = nearCurb ? (rand() < 0.5 ? '#a9a8a6' : '#9a9996') : rand() < 0.5 ? '#86847f' : '#76746f';
        blob(g, X(x), Z(z), (0.35 + rand() * 0.6) * GPX, (0.5 + rand() * 1.3) * GPX, rand, 9);
      }
      g.fillStyle = '#aaa79e';
      for (const x of [jx - 0.15, jx + 0.15, jx - 3, jx + 3]) {
        const center = Math.abs(x - jx) < 1;
        for (let z = za; z < zb; z += center ? 1 : 4) if (rand() > 0.45) g.fillRect(X(x), Z(z), 2, (center ? 1 : 2) * GPX);
      }
      g.fillStyle = '#44454a';
      for (const x of [jx - 4.6, jx - 3.5, jx + 3.5, jx + 4.6]) {
        for (let z = za; z < zb; z += 3 + rand() * 6) if (rand() < 0.6) g.fillRect(X(x + (rand() - 0.5) * 0.2), Z(z), 2, (2 + rand() * 4) * GPX);
      }
    }
    // zebra crossings on all four sides of the crossing
    g.fillStyle = '#b9b6ad';
    const stripe = (x, z, w, h) => rand() > 0.12 && g.fillRect(X(x), Z(z), w * GPX, h * GPX);
    for (const x of [JROAD.x0 - 2.0, JROAD.x1 + 0.4]) for (let z = CURB.n + 0.4; z < CURB.s - 0.6; z += 0.95) stripe(x, z, 1.6, 0.5);
    for (const z of [CURB.n - 2.0, CURB.s + 0.4]) for (let x = JROAD.x0 + 0.4; x < JROAD.x1 - 0.6; x += 0.95) stripe(x, z, 0.5, 1.6);
  }
  for (let i = 0; i < 50; i++) {
    const x = MAP.x0 + 30 + rand() * 120;
    const z = CURB.n + 1 + rand() * (CURB.s - CURB.n - 2);
    g.fillStyle = rand() < 0.5 ? '#4d5568' : '#43475a';
    blob(g, X(x), Z(z), (0.4 + rand() * 1.0) * GPX, (0.3 + rand() * 0.6) * GPX, rand);
  }
  for (let x = -30; x < 110; x += 17) {
    g.fillStyle = '#3c3d40';
    g.beginPath();
    g.arc(X(x), Z(-2.3), 0.4 * GPX, 0, Math.PI * 2);
    g.fill();
  }
  for (const { x, z, r } of craters) {
    g.fillStyle = '#3b3836';
    blob(g, X(x), Z(z), r * 1.8 * GPX, r * 1.5 * GPX, rand, 13);
    g.fillStyle = '#6f6c66';
    blob(g, X(x), Z(z), r * 1.15 * GPX, r * GPX, rand, 11);
    g.fillStyle = '#242427';
    blob(g, X(x), Z(z), r * 0.85 * GPX, r * 0.7 * GPX, rand, 11);
  }
  for (let i = 0; i < 900; i++) {
    g.fillStyle = ['#bdb7a6', '#8d7c62', '#3d3f44', '#6c7a74'][(rand() * 4) | 0];
    g.fillRect(X(MAP.x0 + rand() * (MAP.x1 - MAP.x0)), Z(CURB.n + rand() * (CURB.s - CURB.n)), 2, 1);
  }
  return tex(c);
}

function sidewalkTexture(rand) {
  const [c, g] = canvas(64, 64);
  g.fillStyle = '#b9bbbf';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#a7a8aa';
  for (let i = 0; i < 26; i++) blob(g, rand() * 64, rand() * 64, 3 + rand() * 8, 2 + rand() * 5, rand);
  g.fillStyle = '#8f8f8f';
  for (let i = 0; i < 6; i++) blob(g, rand() * 64, rand() * 64, 2 + rand() * 4, 1 + rand() * 3, rand);
  g.fillStyle = '#00000018';
  for (let x = 0; x < 64; x += 16) g.fillRect(x, 0, 1, 64);
  for (let y = 0; y < 64; y += 16) g.fillRect(0, y, 64, 1);
  speckle(g, 64, 64, ['#9d9ea1', '#c9cbcf', '#7b7a78', '#d3d5d9'], 520, rand);
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// pierce: windows the sun shines straight through (gutted rooms), as
// [{ f, k }] (floor from the ground, column from the west end).
function facadeTextures(w, floors, o, rand, pierce = []) {
  const H = floors * FH + 0.5;
  const [c, g] = canvas(w * PX, H * PX);
  const [ce, ge] = canvas(w * PX, H * PX);
  ge.fillStyle = '#000';
  ge.fillRect(0, 0, ce.width, ce.height);
  g.fillStyle = o.panel;
  g.fillRect(0, 0, c.width, c.height);
  speckle(g, c.width, c.height, ['#00000018', '#ffffff10', '#00000010'], c.width * c.height * 0.08, rand);

  const cols = Math.max(2, Math.round(w / 1.7));
  const cw = (w / cols) * PX;
  const fh = FH * PX;
  const top = 0.5 * PX;
  const doors = new Set();
  for (let i = 1; i < cols; i += 4) doors.add(i);
  const pierced = new Set(pierce.map((p) => `${p.f},${p.k}`));
  const R = (x, y, ww, hh, ctx) => ctx.fillRect(Math.round(x), Math.round(y), Math.round(ww), Math.round(hh));

  for (let f = 0; f < floors; f++) {
    const fy = c.height - (f + 1) * fh;
    g.fillStyle = '#00000030';
    g.fillRect(0, Math.round(fy + fh - 1), c.width, 1);
    if (o.accent && f > 0) {
      g.fillStyle = o.accent;
      g.fillRect(0, Math.round(fy + fh - 0.32 * PX), c.width, Math.round(0.24 * PX));
    }
    for (let k = 0; k < cols; k++) {
      const x0 = k * cw;
      g.fillStyle = '#00000022';
      g.fillRect(Math.round(x0), Math.round(fy), 1, Math.round(fh));
      let wx = x0 + cw * 0.22;
      let ww = cw * 0.56;
      let wy = fy + 0.28 * PX;
      let wh = 0.62 * PX;
      if (f === 0 && o.shop) {
        wx = x0 + 0.12 * PX;
        ww = cw - 0.24 * PX;
        wy = fy + 0.3 * PX;
        wh = 0.8 * PX;
      } else if (f === 0 && doors.has(k)) {
        g.fillStyle = '#2b2a2a';
        R(x0 + cw * 0.3, fy + 0.2 * PX, cw * 0.4, fh - 0.2 * PX, g);
        continue;
      }
      if (pierced.has(`${f},${k}`)) {
        // sun blazing straight through a gutted room
        g.fillStyle = ge.fillStyle = '#ffe2b0';
        R(wx, wy, ww, wh, g);
        R(wx, wy, ww, wh, ge);
        g.fillStyle = ge.fillStyle = '#ffc77e';
        R(wx, wy + wh * 0.6, ww, wh * 0.4, g);
        R(wx, wy + wh * 0.6, ww, wh * 0.4, ge);
        continue;
      }
      const roll = rand();
      let glass = '#2c3242';
      let lit = null;
      if (roll < o.broken) glass = '#111215';
      else if (roll < o.broken + 0.05) lit = '#ffbe72';
      else if (roll < o.broken + 0.08) lit = '#cfe6ff';
      g.fillStyle = lit || glass;
      R(wx, wy, ww, wh, g);
      if (lit) {
        ge.fillStyle = lit;
        R(wx, wy, ww, wh, ge);
        if (rand() < 0.5) {
          g.fillStyle = ge.fillStyle = '#2a2622';
          R(wx, wy, ww * 0.3, wh, g);
          R(wx, wy, ww * 0.3, wh, ge);
        }
      } else if (glass === '#111215') {
        g.fillStyle = '#1b1b1d55';
        blob(g, wx + ww / 2, wy - wh * 0.3, ww * 0.7, wh * 0.9, rand);
      } else {
        g.fillStyle = '#4a5366';
        g.fillRect(Math.round(wx), Math.round(wy), Math.round(ww * 0.3), 1);
      }
      g.fillStyle = '#d5d8dc';
      g.fillRect(Math.round(wx - 1), Math.round(wy + wh), Math.round(ww + 2), 1);
      g.fillStyle = '#00000020';
      g.fillRect(Math.round(wx + ww * 0.4), Math.round(wy + wh + 1), 2, Math.round(fh * (0.3 + rand() * 0.5)));
    }
  }
  g.fillStyle = '#00000038';
  g.fillRect(0, 0, c.width, Math.round(top));
  g.fillStyle = '#d6d9de';
  g.fillRect(0, 0, c.width, 1);
  for (let i = 0; i < o.holes; i++) {
    const hx = rand() * c.width;
    const hy = top + rand() * (c.height - top - fh);
    const r = (0.5 + rand() * 0.9) * PX;
    g.fillStyle = '#26262833';
    blob(g, hx, hy - r * 0.6, r * 2, r * 1.8, rand, 11);
    g.fillStyle = '#6f6c66';
    blob(g, hx, hy, r * 1.25, r * 1.1, rand, 11);
    g.fillStyle = '#121214';
    blob(g, hx, hy, r, r * 0.85, rand, 11);
  }
  return { map: tex(c), emissiveMap: tex(ce) };
}

function endTexture(d, floors, o, rand, mural) {
  const H = floors * FH + 0.5;
  const [c, g] = canvas(d * PX, H * PX);
  g.fillStyle = o.panel;
  g.fillRect(0, 0, c.width, c.height);
  speckle(g, c.width, c.height, ['#00000018', '#ffffff10'], c.width * c.height * 0.08, rand);
  g.fillStyle = '#00000028';
  for (let y = c.height; y > 0; y -= FH * PX) g.fillRect(0, Math.round(y), c.width, 1);
  for (let x = 0; x < c.width; x += 2.4 * PX) g.fillRect(Math.round(x), 0, 1, c.height);
  if (mural) {
    const cx = c.width * 0.5;
    const cy = c.height * 0.42;
    const Rr = Math.min(c.width, c.height) * 0.28;
    const tile = 3;
    for (let y = 0; y < c.height; y += tile) {
      for (let x = 0; x < c.width; x += tile) {
        const dx = x - cx;
        const dy = y - cy;
        const r = Math.hypot(dx, dy);
        const a = Math.atan2(dy, dx);
        let col = null;
        if (r < Rr) col = r < Rr * 0.55 ? '#c6a35a' : '#5f8a9a';
        else if (r < Rr * 1.9 && Math.sin(a * 9) > 0.55 && y < cy) col = '#a3874e';
        else if (y > c.height * 0.72 && y < c.height * 0.8) col = '#4e6f86';
        else if (Math.abs(y - (cy + Rr * 1.2 + Math.sin(x * 0.05) * 12)) < 5) col = '#7b8f6e';
        if (!col || rand() < 0.16) continue;
        g.fillStyle = col;
        g.fillRect(x, y, tile - 1, tile - 1);
      }
    }
    for (let i = 0; i < 7; i++) {
      g.fillStyle = o.panel;
      blob(g, rand() * c.width, rand() * c.height, 6 + rand() * 14, 5 + rand() * 12, rand);
    }
  }
  return tex(c);
}

function cutawayTexture(d, floors, rand) {
  const H = floors * FH + 0.5;
  const [c, g] = canvas(d * PX, H * PX);
  g.fillStyle = '#1d1c1e';
  g.fillRect(0, 0, c.width, c.height);
  const papers = ['#5d6a5a', '#6e6250', '#56607a', '#7a6c5e', '#4f5a5c'];
  for (let f = 0; f < floors; f++) {
    const y = c.height - (f + 1) * FH * PX;
    for (let x = 0; x < c.width; x += 2.6 * PX) {
      if (rand() < 0.3) continue;
      g.fillStyle = papers[(rand() * papers.length) | 0];
      g.fillRect(Math.round(x + 2), Math.round(y + 3), Math.round(2.6 * PX - 4), Math.round(FH * PX - 6));
      g.fillStyle = '#00000044';
      g.fillRect(Math.round(x + 2), Math.round(y + 3), 3, Math.round(FH * PX - 6));
    }
    g.fillStyle = '#8c8a85';
    g.fillRect(0, Math.round(y + FH * PX - 3), c.width, 3);
  }
  return tex(c);
}

const facadeMat = (t) => new THREE.MeshToonMaterial({ map: t.map, emissiveMap: t.emissiveMap, emissive: 0xffffff, emissiveIntensity: 1.1, gradientMap });
const mapMat = (map) => new THREE.MeshToonMaterial({ map, gradientMap });

// Additive light volume between a polygon in the air and its sun-projection
// on the ground: bright where the light enters, fading toward the ground.
function sunVolume(B, top, opacity, groundY = 0) {
  const bottom = top.map((p) => toGround(p, groundY));
  const pos = [];
  const col = [];
  const n = top.length;
  for (let i = 0; i < n; i++) {
    const a = top[i];
    const b = top[(i + 1) % n];
    const c = bottom[(i + 1) % n];
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
  return bottom;
}

// Hard-edged patch of sunlight on the ground (a quad from 4 ground points).
function sunPatch(B, pts, opacity) {
  const geo = new THREE.BufferGeometry().setFromPoints([pts[0], pts[1], pts[2], pts[0], pts[2], pts[3]].map((p) => p.clone().setY(p.y + 0.03)));
  B.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: SUN, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
}

// ------------------------------------------------------------- the level
export const avenue = {
  id: 'avenue',
  name: 'Level 1 · Ruined city street (tutorial)',
  build(scene) {
    setLowPoly(true);
    try {
      return buildAvenue(scene);
    } finally {
      setLowPoly(false);
    }
  },
};

function buildAvenue(scene) {
  {
    const B = new LevelBuilder(scene, 20241);
    const rand = B.rand;
    const light = addDusk(scene, { shadowSize: 22, shadowMap: 2048 });
    const hazard = hazardTexture();
    const sign = (w, h, o = {}) => mapMat(glyphSign(w, h, { rand, ...o }));

    // ------------------------------------------------- ground and sidewalks
    const craters = [];
    while (craters.length < 12) {
      const x = -20 + rand() * 120;
      if (!inRiver(x)) craters.push({ x, z: CURB.n + 2 + rand() * (CURB.s - CURB.n - 4), r: 0.6 + rand() * 0.6 });
    }
    // the ground is one big painted texture, laid in pieces around the river
    const groundMat = mapMat(roadTexture(rand, craters));
    function groundPiece(x0, x1, z0, z1) {
      const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
      const uv = geo.attributes.uv;
      const p = geo.attributes.position;
      for (let i = 0; i < uv.count; i++) {
        const x = p.getX(i) + (x0 + x1) / 2;
        const z = -p.getY(i) + (z0 + z1) / 2;
        uv.setXY(i, (x - MAP.x0) / (MAP.x1 - MAP.x0), 1 - (z - MAP.z0) / (MAP.z1 - MAP.z0));
      }
      const m = new THREE.Mesh(geo, groundMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
      m.receiveShadow = true;
      B.add(m);
      B.solid(m);
    }
    groundPiece(MAP.x0, RIVER.x0, MAP.z0, MAP.z1);
    groundPiece(RIVER.x1, MAP.x1, MAP.z0, MAP.z1);
    groundPiece(RIVER.x0, RIVER.x1, CURB.n, CURB.s); // the bridge roadway

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
    slab(MAP.x0, CROSS.x0, -16, CURB.n);
    slab(CROSS.x1, RIVER.x0, -16, CURB.n);
    slab(RIVER.x0, RIVER.x1, BRIDGE.n, CURB.n);
    slab(RIVER.x1, JUNCTION.x0, -16, CURB.n);
    slab(JUNCTION.x1, PLAZA.x1, -PLAZA.z - 1.5, CURB.n); // the north plaza, one wide paved square
    slab(PLAZA.x1, MAP.x1, -16, CURB.n);
    slab(MAP.x0, RIVER.x0, CURB.s, MAP.z1);
    slab(RIVER.x0, RIVER.x1, CURB.s, BRIDGE.s);
    slab(RIVER.x1, JUNCTION.x0, CURB.s, MAP.z1);
    slab(JUNCTION.x1, MAP.x1, CURB.s, MAP.z1);
    // the embankments: paved the whole way along both banks
    slab(RIVER.x0 - 3.5, RIVER.x0, MAP.z0, -16);
    slab(RIVER.x1, RIVER.x1 + 3.5, MAP.z0, -16);
    // the cross road's own sidewalks
    for (const [xa, xb] of [[JUNCTION.x0, JROAD.x0], [JROAD.x1, JUNCTION.x1]]) {
      slab(xa, xb, MAP.z0, CURB.n);
      slab(xa, xb, CURB.s, MAP.z1);
    }

    // snow banks plowed up along both curbs, with gaps where paths were cut
    for (const [z, dir] of [[CURB.n - 0.35, -1], [CURB.s + 0.35, 1]]) {
      for (let x = MAP.x0; x < MAP.x1; x += 0.55) {
        if (dir < 0 && x > CROSS.x0 - 0.5 && x < CROSS.x1 + 0.5) continue;
        if (x > JUNCTION.x0 - 0.5 && x < JUNCTION.x1 + 0.5) continue;
        if (x > PLAZA.x0 && x < PLAZA.x1 && rand() < 0.75) continue; // the plazas' edges: mostly cleared
        if (rand() < 0.12) x += 2;
        B.lump(x, SW, z + dir * rand() * 0.25, 0.5 + rand() * 0.4, 0.2 + rand() * 0.18, 0.35 + rand() * 0.2, rand() < 0.3 ? 0xa9aaac : 0xc7cacf, rand() * 3);
      }
    }
    // snow banks along the cross road's curbs too
    for (const [x, dir] of [[JROAD.x0 - 0.35, -1], [JROAD.x1 + 0.35, 1]]) {
      for (const [za, zb] of [[MAP.z0 + 2, CURB.n - 0.6], [CURB.s + 0.6, MAP.z1 - 2]]) {
        for (let z = za; z < zb; z += 0.55) if (!(dir > 0 && Math.abs(z) < PLAZA.z && rand() < 0.75)) B.lump(x + dir * rand() * 0.25, SW, z, 0.35 + rand() * 0.2, 0.2 + rand() * 0.18, 0.5 + rand() * 0.4, rand() < 0.3 ? 0xa9aaac : 0xc7cacf, rand() * 3);
      }
    }
    for (const z of [CURB.n + 0.3, CURB.s - 0.3]) {
      for (let x = MAP.x0; x < MAP.x1; x += 0.8) {
        if (rand() < 0.35 || (x > JROAD.x0 - 0.5 && x < JROAD.x1 + 0.5)) continue;
        B.lump(x, 0, z, 0.45 + rand() * 0.4, 0.08 + rand() * 0.08, 0.25, 0x8f8e8b, rand() * 3);
      }
    }
    // broken asphalt slabs tipped up around the craters
    for (const { x, z, r } of craters) {
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + rand() * 0.4;
        const d = r * (0.95 + rand() * 0.3);
        B.piece(0.35 + rand() * 0.35, 0.1, 0.3 + rand() * 0.25, rand() < 0.6 ? 0x4c4d52 : 0x5e5c58, x + Math.cos(a) * d, 0.06, z + Math.sin(a) * d * 0.85, Math.sin(a) * 0.5, -a, Math.cos(a) * 0.5);
      }
    }
    // chunks and bricks scattered across the whole street
    for (let i = 0; i < 420; i++) {
      const x = MAP.x0 + 8 + rand() * 150;
      const z = WALK.n + rand() * (WALK.s - WALK.n + 6);
      if (overWater(x, z)) continue;
      const s = 0.08 + rand() * 0.22;
      B.piece(s * (1 + rand()), s * 0.6, s, rand() < 0.25 ? 0x7a5e50 : CONCRETE[(rand() * 5) | 0], x, heightAt(x, z) + s * 0.25, z, rand(), rand() * 3, rand());
    }

    function rubble(x, z, radius, height, { solid = false, slabs = 2, y = heightAt(x, z) } = {}) {
      const n = Math.round(radius * radius * 6) + 8;
      for (let i = 0; i < n; i++) {
        const a = rand() * Math.PI * 2;
        const r = Math.sqrt(rand()) * radius;
        const k = 1 - r / radius;
        const s = 0.25 + rand() * 0.6;
        B.piece(s * (1 + rand()), s * 0.7, s, CONCRETE[(rand() * 5) | 0], x + Math.cos(a) * r, y + k * height * (0.4 + rand() * 0.6), z + Math.sin(a) * r * 0.8, rand() * 3, rand() * 3, rand() * 3);
      }
      for (let i = 0; i < slabs; i++) {
        const m = B.chunk(1.4 + rand() * 1.4, 0.16, 1 + rand() * 0.8, CONCRETE[(rand() * 5) | 0], x + (rand() - 0.5) * radius, y + height * 0.5, z + (rand() - 0.5) * radius * 0.6, (rand() - 0.5) * 1.2, rand() * 3, (rand() - 0.5) * 1.4);
        if (solid) B.solid(m);
      }
      for (let i = 0; i < 3; i++) B.lump(x + (rand() - 0.5) * radius, y + height * 0.7, z + (rand() - 0.5) * radius * 0.5, radius * 0.3, 0.12, radius * 0.25, 0xc9ccd1, rand() * 3);
      if (rand() < 0.6) B.rebar(x, y + height * 0.5, z, 2 + ((rand() * 3) | 0));
      if (solid) {
        B.hitBox(x, y + height * 0.4, z, radius * 1.4, height * 0.8, radius * 1.1);
        B.block(x, z, radius * 0.8, radius * 0.65);
      }
    }

    // ---------------------------------------------------------- buildings
    function building(o) {
      const { x0, x1, zf = WALK.n, depth = 13, floors } = o;
      if (o.bite) {
        const bx = x0 + o.bite.w;
        building({ ...o, x1: bx, floors: floors - o.bite.floors, bite: null, mural: false, sign: null, letters: false, pierce: 0 });
        building({ ...o, x0: bx, bite: null, cutaway: true, mural: false });
        rubble(x0 + o.bite.w * 0.5, zf - 1.5, o.bite.w * 0.45, 1.2, { slabs: 3 });
        const lowH = (floors - o.bite.floors) * FH + 0.5;
        for (let i = 0; i < 6; i++) B.piece(0.6 + rand(), 0.4, 0.8, CONCRETE[i % 5], x0 + rand() * o.bite.w, lowH + 0.15, zf - 1 - rand() * depth * 0.6, rand(), rand() * 3, rand() * 0.5);
        B.rebar(bx - 0.2, lowH, zf - 1, 5);
        return;
      }
      const w = x1 - x0;
      const H = floors * FH + 0.5;
      const cols = Math.max(2, Math.round(w / 1.7));
      const cw = w / cols;
      const pierce = [];
      for (let i = 0; i < (o.pierce ?? 2); i++) pierce.push({ f: 1 + ((rand() * Math.min(3, floors - 1)) | 0), k: (rand() * cols) | 0 });
      const look = { panel: o.panel, accent: o.accent, broken: o.broken ?? 0.25, holes: o.holes ?? 2, shop: o.shop };
      const front = facadeMat(facadeTextures(w, floors, look, rand, pierce));
      const end = mapMat(endTexture(depth, floors, look, rand, false));
      let west = o.cutaway ? mapMat(cutawayTexture(depth, floors, rand)) : o.mural ? mapMat(endTexture(depth, floors, look, rand, true)) : end;
      let east = end;
      // corner blocks: the side on the cross street is a full facade too
      if (o.sideFacade === 'east') east = facadeMat(facadeTextures(depth, floors, look, rand));
      if (o.sideFacade === 'west') west = facadeMat(facadeTextures(depth, floors, look, rand));
      const roof = toon(0xc6c9ce);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, depth), [east, west, roof, roof, front, end]);
      m.position.set((x0 + x1) / 2, H / 2, zf - depth / 2);
      m.castShadow = m.receiveShadow = true;
      B.add(m);
      B.solid(m);
      B.block((x0 + x1) / 2, zf - depth / 2, w / 2, depth / 2);

      // sun shafts out of the gutted windows, landing as bright patches
      for (const { f, k } of pierce) {
        const cx = x0 + (k + 0.5) * cw;
        const cy = (f + 1) * FH - 0.59;
        const hw = cw * 0.28;
        const hh = 0.31;
        const z = zf + 0.02;
        const corners = [new THREE.Vector3(cx - hw, cy + hh, z), new THREE.Vector3(cx + hw, cy + hh, z), new THREE.Vector3(cx + hw, cy - hh, z), new THREE.Vector3(cx - hw, cy - hh, z)];
        const landing = toGround(corners[0]);
        const bottom = sunVolume(B, corners, 0.15, heightAt(landing.x, landing.z));
        sunPatch(B, bottom, 0.3);
      }

      for (let k = 0; k < cols; k++) {
        if (k % 3 !== 1 || rand() < 0.3) continue;
        const bx = x0 + (k + 0.5) * cw;
        for (let f = 1; f < floors; f++) {
          if (rand() < 0.12) continue;
          const y = f * FH + 0.28;
          const glazed = rand() < 0.4;
          B.piece(cw * 0.8, 0.55, 0.45, glazed ? 0xb9b4a6 : PAINT[(rand() * PAINT.length) | 0], bx, y, zf + 0.22, 0, 0, rand() < 0.05 ? 0.4 : 0);
          B.piece(cw * 0.86, 0.07, 0.55, 0x7b7a76, bx, y - 0.3, zf + 0.26);
          if (rand() < 0.5) B.piece(cw * 0.7, 0.05, 0.4, 0xd5d8dc, bx, y + 0.3, zf + 0.22);
        }
      }
      for (let k = 1; k < cols; k += 4) {
        B.piece(cw * 0.7, 0.1, 0.8, 0x7e7c78, x0 + (k + 0.5) * cw, 1.25, zf + 0.4);
        B.piece(cw * 0.6, 0.06, 0.7, 0xd5d8dc, x0 + (k + 0.5) * cw, 1.33, zf + 0.4);
      }
      if (o.shop) {
        for (let k = 0; k < cols; k++) {
          if (rand() < 0.3) continue;
          B.piece(cw * 0.9, 0.05, 0.9, [0x5c6f8c, 0x6f7f6a, 0x8f8550][k % 3], x0 + (k + 0.5) * cw, 1.45 - rand() * 0.3, zf + 0.42, -0.35 - rand() * 0.5, 0, (rand() - 0.5) * 0.3);
        }
      }
      P.facadeClutter(B, x0, x1, zf, H);
      for (let i = 0; i < 3; i++) B.piece(0.6 + rand(), 0.5 + rand() * 0.6, 0.6 + rand(), 0x7b7a76, x0 + 1 + rand() * (w - 2), H + 0.3, zf - 2 - rand() * (depth - 4));
      put(B.root, cyl(0.03, 2.4, 0x3a3c3f, { seg: 4 }), x0 + rand() * w, H + 1.2, zf - 3);

      if (o.sign) {
        const sw = Math.min(w * 0.6, 8);
        const s = new THREE.Mesh(new THREE.PlaneGeometry(sw, 0.55), sign(sw, 0.55, { ink: o.sign }));
        s.position.set(x0 + w * 0.35, 1.08, zf + 0.06);
        B.add(s);
      }
      if (o.letters) {
        const fx = x0 + w * 0.25;
        const span = w * 0.5;
        const n = 5;
        for (let i = 0; i <= n; i++) B.piece(0.08, 2.0, 0.08, 0x3b3d40, fx + (i / n) * span, H + 1.0, zf - 1.2);
        B.piece(span, 0.08, 0.08, 0x3b3d40, fx + span / 2, H + 0.25, zf - 1.2);
        B.piece(span, 0.08, 0.08, 0x3b3d40, fx + span / 2, H + 1.9, zf - 1.2);
        for (let i = 0; i < n; i++) {
          if (i === 2) continue;
          const panel = new THREE.Mesh(new THREE.PlaneGeometry(span / n - 0.2, 1.5), sign(span / n - 0.2, 1.5, { board: '#3a3d40', ink: '#bdb49a' }));
          panel.material.side = THREE.DoubleSide;
          panel.position.set(fx + ((i + 0.5) / n) * span, H + 1.08, zf - 1.12);
          if (i === 3) {
            panel.rotation.z = -0.5;
            panel.position.y -= 0.35;
            panel.position.x += 0.2;
          }
          panel.castShadow = true;
          B.add(panel);
        }
      }
    }

    // Low blocks on the south side (two or three floors, so they don't hide
    // the street from the camera), shopfronts facing north onto it. side:
    // the end that's a corner on the cross road gets a facade too.
    function southBlock(x0, x1, floors, side, zf = WALK.s + 0.3) {
      const depth = 13;
      const w = x1 - x0;
      const H = floors * FH + 0.5;
      const look = { panel: PANELS[(rand() * 5) | 0], accent: ACCENTS[(rand() * 5) | 0], broken: 0.35, holes: 1, shop: true };
      const front = facadeMat(facadeTextures(w, floors, look, rand));
      const end = mapMat(endTexture(depth, floors, look, rand, false));
      const sideMat = facadeMat(facadeTextures(depth, floors, { ...look, shop: false }, rand));
      const roof = toon(0xc6c9ce);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, depth), [side === 'east' ? sideMat : end, side === 'west' ? sideMat : end, roof, roof, end, front]);
      m.position.set((x0 + x1) / 2, H / 2, zf + depth / 2);
      m.castShadow = m.receiveShadow = true;
      B.add(m);
      B.solid(m);
      B.block((x0 + x1) / 2, zf + depth / 2, w / 2, depth / 2);
      // awnings, a parapet with snow
      for (let x = x0 + 1.2; x < x1 - 1; x += 2.6) if (rand() < 0.7) B.piece(1.8, 0.06, 0.9, [0x5c6f8c, 0x6f7f6a, 0x8f8550][(rand() * 3) | 0], x, 1.45, zf - 0.42, 0.4, 0, 0);
      B.piece(w, 0.3, 0.2, 0x8d8b86, (x0 + x1) / 2, H + 0.15, zf + 0.1);
      B.lump((x0 + x1) / 2, H + 0.05, zf + depth / 2, w / 2.2, 0.12, depth / 2.6, 0xd0d3d8);
    }

    // North side, with gaps the sun comes through.
    building({ x0: -40, x1: -20, floors: 9, panel: PANELS[0], accent: ACCENTS[0], pierce: 0 });
    building({ x0: -15, x1: 4, floors: 5, panel: PANELS[3], accent: null, holes: 3, broken: 0.35, pierce: 3 });
    building({ x0: 4, x1: CROSS.x0, floors: 5, panel: PANELS[1], shop: true, sign: '#b7c9c4', letters: true, holes: 1 });
    building({ x0: CROSS.x1, x1: 39, floors: 9, panel: PANELS[2], accent: ACCENTS[2], mural: true, bite: { w: 4.5, floors: 4 }, holes: 3, pierce: 3 });
    building({ x0: 44, x1: 58, floors: 12, panel: PANELS[0], accent: ACCENTS[1], holes: 4, broken: 0.3, pierce: 4 });
    building({ x0: 80, x1: 97, floors: 9, panel: PANELS[4], accent: ACCENTS[4], holes: 3, broken: 0.4, pierce: 3 });
    building({ x0: 103, x1: JUNCTION.x0 - 0.5, floors: 9, panel: PANELS[1], accent: ACCENTS[3], holes: 2, pierce: 2, sideFacade: 'east' });
    // the north plaza's far side: a block set back behind its own sidewalk;
    // past the square the street's own blocks stand on the avenue again
    building({ x0: JUNCTION.x1 + 0.5, x1: PLAZA.x1, zf: -PLAZA.z - 1.5, depth: 12, floors: 8, panel: PANELS[3], accent: ACCENTS[0], holes: 3, broken: 0.4, pierce: 0, sideFacade: 'west' });
    building({ x0: PLAZA.x1, x1: 176, floors: 9, panel: PANELS[2], accent: ACCENTS[1], holes: 3, pierce: 2, sideFacade: 'west', depth: 16 });
    // blocks lining the north side street on out, past where any sight reaches
    for (const [zf, depth, floors, k] of [[-23.5, 14, 8, 0], [-38, 16, 10, 1], [-55, 15, 7, 2], [-71, 13, 9, 3]]) {
      building({ x0: 110, x1: JUNCTION.x0 - 0.5, zf, depth, floors, panel: PANELS[k % 5], accent: ACCENTS[(k + 2) % 5], holes: 3, broken: 0.35, pierce: 0, sideFacade: 'east' });
    }
    for (const [zf, depth, floors, k] of [[-39, 15, 9, 1], [-55, 15, 8, 4], [-71, 13, 10, 2]]) {
      building({ x0: JUNCTION.x1 + 0.5, x1: 160, zf, depth, floors, panel: PANELS[k % 5], accent: ACCENTS[(k + 1) % 5], holes: 3, broken: 0.35, pierce: 0, sideFacade: 'west' });
    }
    // west of the start: more blocks so the street doesn't end in a void
    building({ x0: -78, x1: -44, floors: 9, panel: PANELS[3], accent: ACCENTS[2], holes: 3, pierce: 0 });
    building({ x0: 8, x1: 36, zf: -29, depth: 8, floors: 2, panel: PANELS[2], broken: 0.6, pierce: 0 });

    // haze in the gaps: light pouring through between the blocks
    for (const [gx0, gx1, h] of [[CROSS.x0, CROSS.x1, 9], [39, 44, 12], [58, 80, 12], [97, 103, 9], [JUNCTION.x0, JUNCTION.x1, 9]]) {
      const y = h * FH;
      sunVolume(B, [new THREE.Vector3(gx0, y, WALK.n - 13), new THREE.Vector3(gx1, y, WALK.n - 13), new THREE.Vector3(gx1, y, WALK.n), new THREE.Vector3(gx0, y, WALK.n)], 0.05);
    }

    rubble(41.5, -12.5, 1.8, 1.4, { solid: true });
    rubble(-17.5, -12.2, 1.6, 1.0, { solid: true });
    rubble(100, -12.4, 2.4, 1.8, { solid: true, slabs: 3 });
    B.block(41.5, -14, 2.4, 3);
    B.block(-17.5, -14, 2.4, 3);
    B.block(100, -14, 3.2, 4);
    // rubble heaped against the facades (behind the sidewalk rail, so the
    // tank slides along a straight edge instead of snagging on heaps)
    for (const [x, r] of [[-24, 1.1], [-4, 0.8], [33, 1.3], [86, 1.0]]) rubble(x, WALK.n + 0.35, r, 0.8);
    // the north edge of the drivable street: one straight invisible rail
    for (const [x0, x1] of [[START_X, CROSS.x0 - 0.6], [CROSS.x1 + 0.6, RIVER.x0], [RIVER.x1, JUNCTION.x0 - 0.6], [PLAZA.x1, 176]]) B.block((x0 + x1) / 2, WALK.n + 0.55, (x1 - x0) / 2, 0.3);

    // Containers: stacked into walls where the street is closed off.
    const ribs = (() => {
      const [c, g] = canvas(16, 16);
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, 16, 16);
      g.fillStyle = '#c9c9c9';
      for (let x = 0; x < 16; x += 4) g.fillRect(x, 0, 2, 16);
      g.fillStyle = '#9a9a9a';
      g.fillRect(0, 0, 16, 1);
      g.fillRect(0, 15, 16, 1);
      const t = tex(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(5, 1);
      return t;
    })();
    const CONTAINERS = [0x7a4a36, 0x4f6b6a, 0x6b6f72, 0x8a6a3a, 0x3f5470];
    function container(x, y, z, yaw, color, tilt = 0) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 2.45), new THREE.MeshToonMaterial({ map: ribs, color, gradientMap }));
      m.position.set(x, y + 1.3, z);
      m.rotation.set(0, yaw, tilt);
      m.castShadow = m.receiveShadow = true;
      B.add(m);
      B.solid(m);
      B.lump(x, y + 2.62, z, 2.4, 0.1, 1.0, 0xd0d3d8, yaw);
      return m;
    }
    // the start: a container wall across the avenue, rubble heaped against it
    {
      const X = START_X - 1.3;
      let i = 0;
      for (let z = -15; z < 20; z += 6.2, i++) {
        container(X, 0, z, Math.PI / 2, CONTAINERS[i % 5]);
        if (i % 3 !== 1) container(X - 0.1, 2.6, z + (i % 2 ? 0.4 : -0.3), Math.PI / 2 + (rand() - 0.5) * 0.1, CONTAINERS[(i + 2) % 5]);
      }
      container(X + 2.2, 0, -2.2, Math.PI / 2 + 0.5, CONTAINERS[3], 0.05);
      B.block(X, 2, 1.4, 22);
      rubble(X + 2.4, 5.5, 2.2, 1.4, { slabs: 3 });
      rubble(X + 2.0, -9, 1.6, 1.0, { slabs: 2 });
      for (let z = -6; z < 6; z += 1.7) B.piece(0.7, 0.9, 1.6, 0x9a978f, X + 3.6, 0.45, z, 0, (rand() - 0.5) * 0.3, 0);
      B.block(X + 3.6, 0, 0.45, 6);
      // the dead ground behind it: collapsed blocks and rubble mountains
      for (let k = 0; k < 9; k++) rubble(START_X - 8 - rand() * 36, -8 + rand() * 22, 2 + rand() * 2.5, 1.5 + rand() * 2.5, { slabs: 4 });
    }
    // the cross street: rubble and junk along both sides, a lane left down
    // the middle for whatever comes out of it
    rubble(18.4, -13, 1.3, 1.0, { solid: true });
    rubble(25.7, -16.5, 1.6, 1.3, { solid: true });
    rubble(18.6, -19.8, 1.2, 0.9, { solid: true });
    rubble(25.9, -21, 1.1, 0.8);
    B.chunk(3, 1.8, 0.25, CONCRETE[2], 26.2, 0.8, -12.5, -0.4, 1.4, 0.1);
    B.block(26.2, -12.5, 0.6, 1.5);
    B.rebar(18.8, 0.6, -13.4, 4);
    B.groundCable(20, -15, 1.2, 14);
    B.groundCable(23, -11, 2.8, 10);
    // the cross street ends in a clean container wall: a straight corridor
    for (let k = 0; k < 2; k++) {
      container(19.8, k * 2.6, -23, 0, CONTAINERS[(k + 1) % 5]);
      container(25.2, k * 2.6, -23.1, 0, CONTAINERS[(k + 3) % 5]);
    }
    B.block(22, -23, 6, 1.5);

    // jersey barriers sealing the side gaps off the street
    // the gap near the start is walled up with containers, two high
    for (let k = 0; k < 2; k++) container(-17.5, k * 2.6, WALK.n - 1.3, 0, CONTAINERS[(k + 2) % 5]);
    B.block(-17.5, WALK.n - 1.3, 3.1, 1.3);
    for (const [x0, x1] of [[39, 44], [57.6, 60]]) {
      for (let x = x0 + 0.4; x < x1; x += 1.7) {
        const j = put(B.root, box(1.6, 0.9, 0.7, 0x9a978f, { r: 0.06 }), x + 0.4, SW + 0.45, WALK.n - 0.35);
        j.rotation.y = (rand() - 0.5) * 0.12;
        B.solid(j);
      }
      B.block((x0 + x1) / 2, WALK.n - 0.35, (x1 - x0) / 2 + 0.3, 0.45);
    }

    // facade slabs that came down whole, leaning on the sidewalk
    for (const [x, ry] of [[-30, 0.2], [12, -0.3], [49, 0.4], [92, -0.2]]) {
      const s = B.chunk(2.4, 1.6, 0.2, CONCRETE[1], x, SW + 0.7, WALK.n + 0.9, -0.55, ry, 0.05);
      B.solid(s);
      B.block(x, WALK.n + 0.9, 1.2, 0.5, ry);
      B.rebar(x - 1, SW + 0.2, WALK.n + 1.2, 3);
    }

    // ------------------------------------------- poles, lamps and wires
    const poleXs = [];
    for (let x = -34; x < 166; x += 14) poleXs.push(x);
    const spanY = 5.9;
    const flickers = [];
    let lampIndex = 0;
    const poleTops = new Map();
    for (const x of poleXs) {
      for (const side of [-1, 1]) {
        if (side < 0 && x > CROSS.x0 - 1 && x < CROSS.x1 + 1) continue; // keep the corridor mouth clear
        if (SHACKS.some((k) => x > k.x0 - 1 && x < k.x1 + 1)) continue; // the depot shacks stand here
        if (inJunction(x) || Math.abs(x - END_X) < 2) continue;
        const z = side < 0 ? CURB.n - 0.45 : CURB.s + 0.45;
        const idx = lampIndex++;
        B.crushable(() => lampPole(x, z, side, idx), { kind: 'pole', pivot: { x, y: SW, z }, footprint: { x, z, hx: 0.25, hz: 0.25, yaw: 0 } });
      }
      if (poleTops.has(`${x},-1`)) B.sagging(poleTops.get(`${x},-1`).clone().setY(spanY), poleTops.get(`${x},1`).clone().setY(spanY), 0.25);
    }
    function lampPole(x, z, side, idx) {
      {
        const tilt = rand() < 0.35 ? (rand() - 0.5) * 0.5 : (rand() - 0.5) * 0.06;
        const pole = cyl(0.09, 6.6, 0x8b8984, { seg: 8, radiusEnd: 0.14 });
        pole.position.set(x, SW + 3.3, z);
        pole.rotation.x = tilt;
        B.add(pole);
        B.solid(pole);
        B.block(x, z, 0.2, 0.2);
        const top = new THREE.Vector3(x, SW + 6.25, z - Math.sin(tilt) * 3.2);
        poleTops.set(`${x},${side}`, top);
        // mostly cobra heads, a few older globes; some dead, some hanging
        // off their arms by the cable
        const dir = -side;
        const kind = idx % 7 === 3 ? 'globe' : idx % 9 === 5 ? 'hanging' : 'cobra';
        const dead = [1, 4, 12, 15].includes(idx);
        const cold = idx % 3 === 1;
        const color = cold ? COLD : SODIUM[idx % 3];
        const armLen = 1.6 + (idx % 3) * 0.3;
        const arm = put(B.root, box(0.08, 0.08, armLen, 0x4a4c50, { r: 0.02 }), top.x, top.y, top.z + (dir * armLen) / 2);
        arm.rotation.x = -dir * 0.12;
        let head = new THREE.Vector3(top.x, top.y - 0.05, top.z + dir * armLen);
        let lens;
        if (kind === 'globe') {
          head = new THREE.Vector3(top.x, top.y + 0.1, top.z + dir * armLen);
          lens = put(B.root, cyl(0.24, 0.38, dead ? 0x2a2b2e : color, { seg: 8, glow: !dead }), head.x, head.y - 0.15, head.z);
          put(B.root, cyl(0.28, 0.08, 0x3c3e42, { seg: 8 }), head.x, head.y + 0.08, head.z);
        } else if (kind === 'hanging') {
          const hz = top.z + dir * armLen;
          B.line([new THREE.Vector3(top.x, top.y, hz), new THREE.Vector3(top.x + 0.1, top.y - 1.1, hz + 0.1)]);
          head = new THREE.Vector3(top.x + 0.1, top.y - 1.4, hz + 0.1);
          put(B.root, box(0.34, 0.6, 0.14, 0x3c3e42, { r: 0.05 }), head.x, head.y, head.z).rotation.z = 0.3;
          lens = put(B.root, box(0.04, 0.44, 0.24, dead ? 0x2a2b2e : color, { r: 0.01, glow: !dead }), head.x + 0.18, head.y, head.z);
          lens.rotation.z = 0.3;
        } else {
          put(B.root, box(0.34, 0.14, 0.6, 0x3c3e42, { r: 0.05 }), head.x, head.y, head.z);
          lens = put(B.root, box(0.24, 0.04, 0.44, dead ? 0x2a2b2e : color, { r: 0.01, glow: !dead }), head.x, head.y - 0.08, head.z);
        }
        if (!dead) {
          const power = (cold ? 13 : 17) * (0.7 + rand() * 0.5);
          const e = B.emit(head.clone().add(new THREE.Vector3(0, -0.7, 0)), color, power, 9 + rand() * 3);
          const groundY = heightAt(head.x, head.z);
          const p = B.pool(head.x + (rand() - 0.5) * 0.6, head.z + (rand() - 0.5) * 0.6, 2.6 + rand() * 1.4, color, (cold ? 0.16 : 0.22) * (0.7 + rand() * 0.5), { sx: 0.8 + rand() * 0.5, sz: 0.8 + rand() * 0.4, yaw: rand() * 3, y: groundY + 0.03 });
          if (idx === 6 || idx === 13 || kind === 'hanging') {
            flickers.push({ e, lens: null, p, color, base: p.material.opacity, seed: idx });
          }
        }
      }
    }
    for (let i = 0; i < poleXs.length - 1; i++) {
      const xa = poleXs[i];
      const xb = poleXs[i + 1];
      if (inJunction(xa) || inJunction(xb)) continue; // wired separately below
      for (const z of [-4.4, -3.9, 2.6, 3.1]) {
        const y = spanY - 0.3;
        if (rand() < 0.2) {
          for (const [from, toward] of [[xa, 1], [xb, -1]]) {
            const len = 2 + rand() * 3;
            const pts = [];
            for (let k = 0; k <= 12; k++) {
              const t = k / 12;
              pts.push(new THREE.Vector3(from + toward * len * t * 0.7, Math.max(0.03, y * (1 - t * 1.3)), z + Math.sin(t * 4) * 0.4 * t));
            }
            let px = from + toward * len * 0.7;
            let pz = z;
            for (let k = 0; k < 8; k++) {
              px += toward * (0.3 + rand() * 0.4);
              pz += (rand() - 0.5) * 0.8;
              pts.push(new THREE.Vector3(px, 0.035, pz));
            }
            B.line(pts);
          }
        } else {
          B.sagging(new THREE.Vector3(xa, y, z), new THREE.Vector3(xb, y, z), 0.12);
        }
      }
    }
    // the intersection: the trolley wires run straight on, and branch off
    // in curves into both side streets
    {
      const y = spanY - 0.3;
      const xa = poleXs.filter((x) => x < JUNCTION.x0).pop();
      const xb = poleXs.find((x) => x > JUNCTION.x1);
      const jx = (JROAD.x0 + JROAD.x1) / 2;
      const curve = (a, c, b) => {
        const pts = [];
        for (let k = 0; k <= 20; k++) {
          const t = k / 20;
          pts.push(new THREE.Vector3((1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, y - Math.sin(t * Math.PI) * 0.15, (1 - t) ** 2 * a.z + 2 * (1 - t) * t * c.z + t * t * b.z));
        }
        B.line(pts);
      };
      for (const z of [-4.4, -3.9, 2.6, 3.1]) {
        B.sagging(new THREE.Vector3(xa, y, z), new THREE.Vector3(xb, y, z), 0.2);
        const north = z < 0;
        const off = north ? -4.4 - z : z - 2.6; // keep the pair's spacing through the bend
        const sx = jx + (north ? -1 : 1) * (2 + off * 1.5);
        curve(new THREE.Vector3(xa, y, z), new THREE.Vector3(sx, y, z), new THREE.Vector3(sx, y, north ? -16 : 16)); // ends on a span wire
      }
      // span wires across the side streets, hung off the corner blocks
      for (const z of [-12, -16]) B.sagging(new THREE.Vector3(JUNCTION.x0 - 0.5, 6, z), new THREE.Vector3(JUNCTION.x1 + 0.5, 6, z), 0.4);
      // the south side's blocks are low: the span there hangs off two poles
      for (const x of [JROAD.x0 - 0.7, JROAD.x1 + 0.7]) {
        put(B.root, cyl(0.1, 6.4, 0x6f6e6a, { seg: 8, radiusEnd: 0.14 }), x, SW + 3.2, 16);
        B.block(x, 16, 0.2, 0.2);
      }
      B.sagging(new THREE.Vector3(JROAD.x0 - 0.7, 6.1, 16), new THREE.Vector3(JROAD.x1 + 0.7, 6.1, 16), 0.35);
      // street lamps on the four corners
      let idx = 40;
      for (const x of [JUNCTION.x0 + 0.8, JUNCTION.x1 - 0.8]) {
        for (const side of [-1, 1]) {
          const z = side < 0 ? CURB.n - 0.6 : CURB.s + 0.6;
          const i = idx++;
          B.crushable(() => lampPole(x, z, side, i), { kind: 'pole', pivot: { x, y: SW, z }, footprint: { x, z, hx: 0.25, hz: 0.25, yaw: 0 } });
        }
      }
    }
    const FACADES = [[-78, -44], [-40, -20], [-15, 39], [44, 58], [80, 97], [103, JUNCTION.x0 - 0.5], [PLAZA.x1 + 0.5, 176]];
    for (const x of poleXs) {
      if (rand() < 0.5) continue;
      const fx = x + (rand() - 0.5) * 4;
      if (!FACADES.some(([a, b]) => fx > a + 0.5 && fx < b - 0.5) || !poleTops.has(`${x},-1`)) continue;
      B.sagging(new THREE.Vector3(fx, 3 + rand() * 4, WALK.n), new THREE.Vector3(x, 4.8, CURB.n - 0.45), 0.6 + rand() * 1.2);
    }
    for (let i = 0; i < 12; i++) B.groundCable(-30 + rand() * 128, CURB.n + rand() * (CURB.s - CURB.n), rand() * Math.PI * 2, 8 + ((rand() * 10) | 0));

    // --------------------------------------------------------- tram rails
    // Two tracks set in the road, steel rails standing a little proud of a
    // dark groove; at the intersection one track bends off into each side
    // street. Worn: a rail section is missing here and there.
    {
      const GAUGE = 0.55;
      const rail = (a, b, groove = true) => {
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const len = Math.hypot(dx, dz);
        const yaw = -Math.atan2(dz, dx);
        const mx = (a.x + b.x) / 2;
        const mz = (a.z + b.z) / 2;
        if (groove) B.piece(len + 0.02, 0.012, 0.2, 0x2a2b2f, mx, 0.008, mz, 0, yaw, 0);
        B.piece(len + 0.02, 0.05, 0.07, 0x8d9196, mx, 0.03, mz, 0, yaw, 0);
      };
      // a track along a centreline polyline: two rails either side
      const track = (pts) => {
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i];
          const b = pts[i + 1];
          const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
          const nx = -(b.z - a.z) / len;
          const nz = (b.x - a.x) / len;
          for (const s of [-1, 1]) {
            if (rand() < 0.04) continue; // a missing section
            rail({ x: a.x + nx * GAUGE * s, z: a.z + nz * GAUGE * s }, { x: b.x + nx * GAUGE * s, z: b.z + nz * GAUGE * s });
          }
        }
      };
      const straight = (x0, z0, x1, z1, step = 3) => {
        const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / step));
        const pts = [];
        for (let i = 0; i <= n; i++) pts.push({ x: x0 + ((x1 - x0) * i) / n, z: z0 + ((z1 - z0) * i) / n });
        return pts;
      };
      const bend = (p0, c, p2, n = 14) => {
        const pts = [];
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          pts.push({ x: (1 - t) ** 2 * p0.x + 2 * (1 - t) * t * c.x + t * t * p2.x, z: (1 - t) ** 2 * p0.z + 2 * (1 - t) * t * c.z + t * t * p2.z });
        }
        return pts;
      };
      const TN = -2.25;
      const TS = 1.55;
      for (const z of [TN, TS]) track(straight(START_X + 1, z, MAP.x1 - 1, z));
      const jx = (JROAD.x0 + JROAD.x1) / 2;
      // one track turns left into the north street, the other right into the south one
      track([...bend({ x: jx - 8, z: TN }, { x: jx - 1.6, z: TN }, { x: jx - 1.6, z: CURB.n - 4 }), ...straight(jx - 1.6, CURB.n - 4, jx - 1.6, -24).slice(1)]);
      track([...bend({ x: jx - 8, z: TS }, { x: jx + 1.6, z: TS }, { x: jx + 1.6, z: CURB.s + 4 }), ...straight(jx + 1.6, CURB.s + 4, jx + 1.6, 24).slice(1)]);
    }

    // ------------------------------------------------- the intersection
    const signals = [];
    function signal(x, z, armDir, mode) {
      put(B.root, cyl(0.1, 5.2, 0x5a5d61, { seg: 8 }), x, SW + 2.6, z);
      B.block(x, z, 0.2, 0.2);
      const armLen = 4.6;
      put(B.root, box(0.1, 0.1, armLen, 0x4d5054, { r: 0.02 }), x, SW + 4.9, z + (armDir * armLen) / 2);
      const hz = z + armDir * armLen * 0.8;
      put(B.root, box(0.34, 0.42, 1.36, 0x2e3033, { r: 0.06 }), x, SW + 4.6, hz);
      const lamps = [0x3fe0b4, 0xffb428, 0xff3b30].map((c, i) => {
        const z2 = hz + (i - 1) * 0.42 * -armDir;
        return { c, meshes: [-1, 1].map((sx) => B.keep(put(B.root, cyl(0.14, 0.04, 0x1f2124, { axis: 'x', seg: 10 }), x + sx * 0.18, SW + 4.6, z2))) };
      });
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.36), sign(1.2, 0.36, { board: '#3c5a7a', ink: '#d4d9de' }));
      plate.material.side = THREE.DoubleSide;
      plate.position.set(x - 0.12, SW + 3.2, z);
      plate.rotation.set(0, -Math.PI / 2, 0.18);
      B.add(plate);
      const e = B.emit(new THREE.Vector3(x - 0.5, 4.2, hz), 0xffffff, 3, 5);
      const p = B.pool(x - 0.8, hz, 1.4, 0xffffff, 0);
      signals.push({ lamps, mode, e, p });
    }
    signal(CROSS.x0 - 1, CURB.s + 0.5, -1, 'cycle');
    signal(CROSS.x1 + 1, CURB.n - 0.5, 1, 'blink');
    const dark = toon(0x1f2124);
    const setLamp = (lamp, on) => {
      for (const m of lamp.meshes) m.material = on ? glowMat(lamp.c) : dark;
    };

    // ------------------------------------------------ heat pipes + arch
    const FOIL = 0xb4b8bd;
    const TORN = 0x6d604d;
    const PZ = WALK.s + 1.5;
    function pipeRun(xa, xb, z, y) {
      for (const dz of [-0.28, 0.28]) {
        let x = xa;
        while (x < xb) {
          const len = Math.min(xb - x, 3 + rand() * 5);
          put(B.root, cyl(0.2, len, rand() < 0.2 ? TORN : FOIL, { axis: 'x', seg: 10 }), x + len / 2, SW + y, z + dz);
          x += len;
        }
      }
      for (let x = xa + 1; x < xb; x += 4) {
        B.piece(0.22, y - 0.1, 0.22, 0x7e7c78, x, SW + (y - 0.1) / 2, z);
        B.piece(0.2, 0.12, 1.0, 0x7e7c78, x, SW + y - 0.2, z);
      }
      B.block((xa + xb) / 2, z, (xb - xa) / 2, 0.45);
      B.hitBox((xa + xb) / 2, SW + (y + 0.25) / 2, z, xb - xa, y + 0.25, 0.9);
    }
    pipeRun(START_X - 2, 38.6, PZ, 1.05);
    pipeRun(44.4, SHACKS[1].x0 - 0.3, PZ, 1.05);
    for (const x of [64, 69, 74]) B.piece(0.3, 1.05 - RIVER.y + SW, 0.3, 0x6e6c68, x, (RIVER.y + 1.05 + SW) / 2, PZ);
    const AX = 41.5;
    const AY = 6.6;
    for (const dx of [-0.28, 0.28]) {
      put(B.root, cyl(0.2, AY - 1.05, FOIL, { seg: 10 }), AX + dx, SW + (AY + 1.05) / 2, PZ);
      put(B.root, cyl(0.2, PZ + 11.5, FOIL, { axis: 'z', seg: 10 }), AX + dx, AY, (PZ - 11.5) / 2);
      put(B.root, cyl(0.2, AY, FOIL, { seg: 10 }), AX + dx, AY / 2, -11.5);
    }
    for (const dz of [-0.28, 0.28]) put(B.root, cyl(0.2, 44.4 - 38.6, FOIL, { axis: 'x', seg: 10 }), 41.5, SW + 1.05, PZ + dz);
    for (let i = 0; i < 4; i++) put(B.root, cyl(0.21, 0.6, TORN, { axis: 'z', seg: 10 }), AX + (i % 2 ? 0.28 : -0.28), AY, -6 + i * 4.3);
    for (const z of [PZ, -11.5]) {
      for (const dx of [-0.7, 0.7]) put(B.root, box(0.16, AY + 0.3, 0.16, 0x4b4e52, { r: 0.02 }), AX + dx, (AY + 0.3) / 2, z);
      put(B.root, box(1.6, 0.16, 0.2, 0x4b4e52, { r: 0.02 }), AX, AY - 0.32, z);
      B.block(AX, z, 0.9, 0.3);
    }
    const sheet = B.keep(put(B.root, box(0.6, 1.1, 0.03, 0x8d8f91, { r: 0.01 }), AX + 0.2, AY - 0.75, -1.2));
    B.animate((dt, t) => (sheet.rotation.x = Math.sin(t * 1.3) * 0.18));

    // ------------------------------------------------------------- wrecks
    // burnt-out cars: the tank flattens them
    const wreck = (x, z, yaw, o) => B.crushable(() => P.car(B, x, z, yaw, o), { kind: 'car', scrap: 2 });
    const FIRST_WRECK = { x: -13, z: -0.6 }; // dead ahead of the start: the first thing to crush
    wreck(FIRST_WRECK.x, FIRST_WRECK.z, 0.35, { kind: 'sedan', paint: BURNT_PAINT[0] });
    wreck(1.5, 4.8, 0.3, { kind: 'hatch', paint: BURNT_PAINT[1], flipped: true });
    wreck(11, -5.4, -0.35, { kind: 'sedan', paint: BURNT_PAINT[2] });
    wreck(24.5, 4.5, 0.55, { kind: 'van', paint: 0x6b7458 });
    P.tram(B, 34.5, -2.6, 0.12, { trailer: true, tilt: 0.05 });
    wreck(45, 3.8, 2.75, { kind: 'hatch', paint: BURNT_PAINT[3] });
    wreck(67, 4.6, -0.2, { kind: 'van', paint: 0x7b7f78 });
    wreck(72.5, -5.2, 0.35, { kind: 'sedan', paint: BURNT_PAINT[5] });
    wreck(85.6, 5.0, 0.2, { kind: 'sedan', paint: BURNT_PAINT[1] });
    wreck(88, -5.8, -0.5, { kind: 'hatch', paint: BURNT_PAINT[0] });
    wreck(96.6, -4.6, 1.4, { kind: 'sedan', paint: BURNT_PAINT[2] });
    wreck(96.4, 4.8, -1.7, { kind: 'sedan', paint: BURNT_PAINT[3], flipped: true });
    wreck(119, -5.5, 0.4, { kind: 'sedan', paint: BURNT_PAINT[4] });
    wreck(124, 4.6, -0.3, { kind: 'van', paint: 0x6b7458 });
    wreck(134, -4, 1.3, { kind: 'hatch', paint: BURNT_PAINT[2] });
    wreck(139.5, 9, 2.2, { kind: 'sedan', paint: BURNT_PAINT[1] });
    wreck(147, 4.8, -0.2, { kind: 'sedan', paint: BURNT_PAINT[3], flipped: true });
    {
      // the trolleybus is still smouldering
      const fire = B.emit(new THREE.Vector3(33.4, 1.5, -1.0), 0xff8a35, 16, 8);
      const smokeAt = new THREE.Vector3(32.6, 2.8, -1.4);
      let carry = 0;
      B.animate((dt, t, ctx) => {
        fire.level = 0.75 + Math.sin(t * 17) * 0.12 + Math.sin(t * 7.3) * 0.13;
        carry += dt * 11;
        while (carry > 1 && ctx?.combat) {
          carry -= 1;
          ctx.combat.puffs.spawn(smokeAt.clone().add(new THREE.Vector3((rand() - 0.5) * 1.6, 0, (rand() - 0.5) * 0.9)), new THREE.Vector3(0.6 + rand() * 0.3, 1.3 + rand() * 0.6, 0.2), {
            color: rand() < 0.5 ? 0x45444a : 0x37373c,
            s0: 0.18,
            s1: 0.45 + rand() * 0.25,
            life: 2.4,
            drag: 0.2,
            lift: 0.3,
            fadeAt: 0.35,
          });
        }
      });
    }

    function barrelFire(x, z) {
      const y = heightAt(x, z);
      put(B.root, cyl(0.3, 0.8, 0x5a4636, { seg: 10 }), x, y + 0.4, z);
      B.block(x, z, 0.32, 0.32);
      const flames = [0xffb347, 0xffd27a, 0xff8a35].map((c, i) => {
        const f = new THREE.Mesh(new THREE.ConeGeometry(0.22 - i * 0.04, 0.6, 6), glowMat(c));
        f.position.set(x + (i - 1) * 0.08, y + 0.95, z);
        B.add(f);
        B.keep(f);
        return f;
      });
      const e = B.emit(new THREE.Vector3(x, y + 1.3, z), 0xff9a40, 12, 7);
      const p = B.pool(x, z, 2.2, 0xff9a40, 0.3, { y: y + 0.03, yaw: rand() * 3 });
      const phase = rand() * 10;
      B.animate((dt, t, ctx) => {
        flames.forEach((f, i) => {
          const s = 0.75 + Math.sin(t * (11 + i * 3) + phase + i) * 0.25 + Math.sin(t * 23 + i) * 0.1;
          f.scale.set(1, s, 1);
          f.position.y = y + 0.8 + s * 0.3;
        });
        const k = 0.8 + Math.sin(t * 13 + phase) * 0.12 + Math.sin(t * 29) * 0.08;
        e.level = k;
        p.material.opacity = 0.3 * k;
        if (ctx?.combat && rand() < dt * 3) ctx.combat.fx.spawn(new THREE.Vector3(x, y + 1.2, z), new THREE.Vector3((rand() - 0.5) * 0.6, 1.4 + rand(), (rand() - 0.5) * 0.6), { color: 0xffb347, life: 0.9, size: 0.05, glow: true });
      });
    }
    barrelFire(46.5, WALK.s - 0.9);
    barrelFire(8, WALK.s + 4.2);
    barrelFire(91, WALK.n + 1.2);

    // ------------------------------------------------------ street clutter
    // street clutter: all of it breaks under the tracks
    const junk = (fn, scrap = 0) => B.crushable(fn, { kind: 'prop', scrap });
    junk(() => P.bench(B, -27, SW, WALK.n + 1.2, 0));
    junk(() => P.bench(B, -1, SW, WALK.n + 1.1, 0.2, { tipped: true }));
    junk(() => P.bench(B, 46.5, SW, WALK.n + 1.3, -0.1));
    junk(() => P.bin(B, -25, SW, WALK.n + 1.0), 1);
    junk(() => P.bin(B, 2, SW, WALK.n + 1.4, { tipped: true }), 1);
    junk(() => P.bin(B, 48.5, SW, WALK.n + 1.1, { tipped: true }), 1);
    junk(() => P.planter(B, -12, SW, WALK.n + 1.2));
    junk(() => P.planter(B, 30, SW, WALK.n + 1.4));
    junk(() => P.cabinet(B, 15.5, SW, WALK.n + 0.6, 0), 1);
    junk(() => P.cabinet(B, 84, SW, WALK.n + 0.6, 0.3), 1);
    junk(() => P.crates(B, 8, SW, WALK.n + 1.2), 2);
    P.dumpster(B, 42, SW, WALK.n + 1.2, 0.3, 0x4e6355);
    P.dumpster(B, 81.5, SW, WALK.n + 1.1, -0.4, 0x4f5d73);
    junk(() => P.tires(B, 94, SW, WALK.n + 1.4, 5));
    junk(() => P.fallenPole(B, 48, CURB.s + 0.4, -2.5));
    junk(() => P.crates(B, -6, SW, CURB.s + 1.3), 2);
    junk(() => P.crates(B, 20, 0, -3.5), 2);
    junk(() => P.tires(B, 13, 0, 2.6, 4));
    junk(() => P.crates(B, 19, 0, -16.5), 2);
    junk(() => P.tires(B, 25.6, 0, -19, 5));
    B.crushable(() => P.car(B, 25.4, -10.4, 1.45, { kind: 'hatch', paint: BURNT_PAINT[5] }), { kind: 'car', scrap: 2 });
    junk(() => P.crates(B, 120, SW, WALK.n + 1.3), 2);
    junk(() => P.crates(B, 125, SW, CURB.s + 1.2), 2);
    junk(() => P.crates(B, 150, SW, WALK.n + 1.3), 2);
    junk(() => P.tires(B, 140, 0, -13, 5));
    for (const [x, z, bend, color] of [[5, CURB.s + 0.6, 0.5, '#3d5f86'], [37, CURB.n - 0.5, -0.4, '#3d5f86'], [-20, CURB.s + 0.6, 0.25, '#8c7a3e'], [77, CURB.n - 0.5, 1.2, '#3d5f86']]) {
      B.crushable(
        () => {
          const top = P.bentPole(B, x, heightAt(x, z), z, 2.7, rand() * 3, bend, 0x5a5d61);
          const plate = new THREE.Mesh(new THREE.CircleGeometry(0.34, 12), sign(0.7, 0.7, { board: color, ink: '#dfe2e4' }));
          plate.material.side = THREE.DoubleSide;
          plate.position.set(0, 1.0, 0.08);
          top.add(plate);
        },
        { kind: 'pole', pivot: { x, y: heightAt(x, z), z }, footprint: { x, z, hx: 0.3, hz: 0.3, yaw: 0 } },
      );
    }

    {
      // kiosk with a dying cold tube
      const kx = 44.6;
      const kz = WALK.s - 0.7;
      const kiosk = put(B.root, box(2.4, 2.2, 1.6, 0x58707a, { r: 0.08 }), kx, SW + 1.1, kz);
      put(B.root, box(2.0, 1.0, 0.04, 0x75736e, { r: 0.01 }), kx, SW + 1.2, kz - 0.82);
      put(B.root, box(2.6, 0.08, 1.9, 0x3e4043, { r: 0.02 }), kx, SW + 2.25, kz);
      put(B.root, box(2.4, 0.06, 1.7, 0xd2d5da, { r: 0.02 }), kx, SW + 2.32, kz);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.34), sign(2.0, 0.34, { board: '#2c3a40', ink: '#bfe0e8' }));
      s.position.set(kx, SW + 1.92, kz - 0.83);
      s.rotation.y = Math.PI;
      B.add(s);
      const tube = B.keep(put(B.root, box(1.8, 0.05, 0.05, COLD, { r: 0.01, glow: true }), kx, SW + 2.12, kz - 0.9));
      const e = B.emit(new THREE.Vector3(kx, 2.0, kz - 1.4), COLD, 9, 6);
      const p = B.pool(kx, kz - 1.6, 2.0, COLD, 0.2, { sx: 1.4, sz: 0.8 });
      flickers.push({ e, lens: tube, p, color: COLD, base: 0.2, seed: 99, fast: true });
      B.block(kx, kz, 1.2, 0.8);
      B.solid(kiosk);
    }
    {
      // bus shelter, roof slumped, a flaking mosaic on the back wall
      const sx = -2;
      const sz = WALK.s - 0.9;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.1, 0.18), [toon(0x8d8b86), toon(0x8d8b86), toon(0xc6c9ce), toon(0x8d8b86), mapMat(endTexture(3.6, 1, { panel: '#8d8b86' }, rand, true)), toon(0x8d8b86)]);
      wall.position.set(sx, SW + 1.05, sz + 0.45);
      wall.castShadow = wall.receiveShadow = true;
      B.add(wall);
      put(B.root, box(0.18, 2.1, 1.0, 0x8d8b86, { r: 0.02 }), sx - 1.7, SW + 1.05, sz);
      const roofSlab = put(B.root, box(4.0, 0.18, 1.4, 0x7e7c78, { r: 0.03 }), sx + 0.1, SW + 2.18, sz);
      roofSlab.rotation.z = 0.12;
      put(B.root, box(3.9, 0.06, 1.3, 0xd2d5da, { r: 0.02 }), sx + 0.1, SW + 2.3, sz);
      P.bench(B, sx, SW, sz + 0.1, 0);
      B.solid(wall);
      B.solid(roofSlab);
      B.block(sx, sz, 1.9, 0.7);
    }

    // ------------------------------------------- the near side (foreground)
    function garages(x0, count, z) {
      const doors = [0x6b5a48, 0x56606a, 0x5f6b5a, 0x6e6152, 0x4d5560];
      for (let i = 0; i < count; i++) {
        const x = x0 + i * 3.1;
        if (rand() < 0.15) {
          rubble(x, z + 2, 1.4, 1.0, { slabs: 2 });
          continue;
        }
        const h = 2.1 + (rand() - 0.5) * 0.2;
        put(B.root, box(3.0, h, 5, 0x7f7d79, { r: 0.04 }), x, SW + h / 2, z + 2.5);
        const open = rand() < 0.3;
        put(B.root, box(2.3, open ? 0.5 : 1.7, 0.06, doors[(rand() * 5) | 0], { r: 0.01 }), x, SW + (open ? 1.55 : 0.9), z - 0.01);
        if (open) put(B.root, box(2.2, 1.2, 0.02, 0x141415, { r: 0.005 }), x, SW + 0.65, z + 0.02);
        const roofSlab = put(B.root, box(3.1, 0.12, 5.2, 0x45474a, { r: 0.02 }), x, SW + h + 0.06, z + 2.5);
        if (rand() < 0.25) roofSlab.rotation.x = 0.18;
        B.lump(x, SW + h + 0.12, z + 2.5, 1.4, 0.12, 2.4, 0xd0d3d8, 0);
      }
    }
    garages(-62, 19, WALK.s + 4);
    garages(46, 4, WALK.s + 4);
    garages(81, 6, WALK.s + 4);
    // past the second checkpoint the pipes end: a row of garages closes the
    // south side of the street instead, open only where the cross road runs
    southBlock(113.4, JUNCTION.x0 - 0.3, 2, 'east');
    // the south-east corner is the plaza: its far side is a block set back
    // behind its own sidewalk, in line with the rubble; past it the street's
    // own blocks start again
    southBlock(JUNCTION.x1 + 0.5, PLAZA.x1, 2, 'west', PLAZA.z + 1.5);
    southBlock(PLAZA.x1, 176, 3, 'west');
    P.fence(B, -2, 22, SW, WALK.s + 4.4);
    P.fence(B, 100, 112, SW, WALK.s + 4.4);

    function ruinedWall(x0, x1, z) {
      let x = x0;
      while (x < x1) {
        const w = 0.5 + rand() * 0.7;
        const h = 1.2 + rand() * 2.6;
        if (rand() < 0.8) put(B.root, box(w, h, 0.4, CONCRETE[(rand() * 5) | 0], { r: 0.02 }), x + w / 2, SW + h / 2, z);
        if (rand() < 0.35) B.piece(1.6, 0.3, 0.42, CONCRETE[0], x + w, SW + Math.min(h, 2.4), z, 0, 0, (rand() - 0.5) * 0.6);
        x += w + 0.4 + rand() * 0.9;
      }
      rubble((x0 + x1) / 2, z - 1, (x1 - x0) * 0.22, 0.8, { slabs: 2 });
    }
    ruinedWall(26, 37, WALK.s + 6);
    ruinedWall(102, 114, WALK.s + 5);

    function birch(x, z, h) {
      put(B.root, cyl(0.1, h, 0xd9d6cc, { seg: 6, radiusEnd: 0.14 }), x, SW + h / 2, z);
      for (let i = 0; i < 4; i++) B.piece(0.1, 0.03, 0.1, 0x2a2826, x, SW + 0.4 + i * h * 0.22, z + 0.12);
      for (let i = 0; i < 6; i++) {
        const b = cyl(0.035, 1.2 + rand(), 0x4a4440, { seg: 4, radiusEnd: 0.05 });
        b.position.set(x, SW + h * (0.45 + rand() * 0.5), z);
        b.rotation.set((rand() - 0.5) * 1.6, rand() * 3, (rand() - 0.5) * 1.6);
        b.translateY(0.5);
        B.add(b);
      }
    }
    for (const [x, z, h] of [[-12, 12.8, 4.2], [-9.5, 13.4, 3.6], [15, 12.5, 4.4], [39, 13.2, 3.8], [57, 12.6, 4.0], [99, 12.8, 4.2]]) birch(x, z, h);
    {
      const t = cyl(0.12, 5, 0xd9d6cc, { seg: 6 });
      t.position.set(20, SW + 1.1, WALK.s + 1.5);
      t.rotation.set(0.3, 0.4, 1.45);
      B.add(t);
    }

    // foreground clutter along the bottom edge of the screen
    for (let i = 0; i < 23; i++) {
      const x = -60 + i * 10 + rand() * 4;
      if (inJunction(x) || inJunction(x + 3)) continue;
      if (!inRiver(x)) rubble(x, WALK.s + 7.5 + rand() * 4, 1 + rand() * 1.3, 0.8 + rand() * 1.1, { slabs: 2 });
    }
    P.billboard(B, 6, WALK.s + 9, 0.15, (w, h) => sign(w, h, { board: '#4f5b62', ink: '#c6bfa8' }));
    P.billboard(B, 90, WALK.s + 9.5, -0.2, (w, h) => sign(w, h, { board: '#5d5546', ink: '#9fb5b3' }));
    P.crates(B, -18, SW, WALK.s + 3.4);
    P.crates(B, 35, SW, WALK.s + 3.6);
    P.tires(B, 44, SW, WALK.s + 3.2, 6);
    P.dumpster(B, 86, SW, WALK.s + 2.6, 0.5, 0x5e5a4c);
    junk(() => P.cabinet(B, 12, SW, WALK.s + 0.6, Math.PI), 1);
    junk(() => P.bench(B, 28, SW, WALK.s - 0.8, Math.PI + 0.3, { tipped: true }));
    junk(() => P.bin(B, 26.5, SW, WALK.s - 0.6), 1);
    junk(() => P.bin(B, 70, SW, WALK.s - 0.6, { tipped: true }), 1);
    for (let i = 0; i < 5; i++) {
      const x = -24 + i * 26 + rand() * 6;
      if (inRiver(x)) continue;
      const drum = put(B.root, cyl(0.85, 0.7, 0x6b5843, { axis: 'z', seg: 12 }), x, SW + 0.85, WALK.s + 3.6);
      drum.rotation.y = rand();
      put(B.root, cyl(0.45, 0.72, 0x1d1f22, { axis: 'z', seg: 10 }), x, SW + 0.85, WALK.s + 3.6).rotation.y = drum.rotation.y;
    }
    for (let i = 0; i < 6; i++) {
      const x = -30 + i * 22 + rand() * 6;
      if (inRiver(x) || inRiver(x + 5)) continue;
      B.heavyCable([
        new THREE.Vector3(x, SW + 0.05, WALK.s + 4.5),
        new THREE.Vector3(x + 0.8, SW + 1.3, PZ),
        new THREE.Vector3(x + 1.6, SW + 0.4, WALK.s + 0.3),
        new THREE.Vector3(x + 2.6 + rand() * 2, 0.05, CURB.s - 0.4 - rand() * 2),
      ]);
    }

    // ---------------------------------------------------------- the river
    {
      const W = RIVER.x1 - RIVER.x0;
      const cx = (RIVER.x0 + RIVER.x1) / 2;
      const cz = (MAP.z0 + MAP.z1) / 2;
      const depth = MAP.z1 - MAP.z0;
      // dark water, half frozen: ice sheets along the banks, floes drifting
      const [c, g] = canvas(W * 8, depth * 8);
      g.fillStyle = '#2b3b4b';
      g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = '#34485a';
      for (let i = 0; i < 160; i++) g.fillRect((rand() * c.width) | 0, (rand() * c.height) | 0, 3 + rand() * 10, 1);
      g.fillStyle = '#c9d0d8';
      for (const edge of [0, c.width]) for (let y = 0; y < c.height; y += 6) blob(g, edge, y, 10 + rand() * 18, 6 + rand() * 6, rand);
      g.fillStyle = '#9fadba';
      for (let i = 0; i < 40; i++) blob(g, rand() * c.width, rand() * c.height, 3 + rand() * 8, 2 + rand() * 6, rand);
      const water = new THREE.Mesh(new THREE.PlaneGeometry(W, depth), mapMat(tex(c)));
      water.rotation.x = -Math.PI / 2;
      water.position.set(cx, RIVER.y, cz);
      water.receiveShadow = true;
      B.add(water);
      B.solid(water);
      for (let i = 0; i < 26; i++) {
        const z = MAP.z0 + rand() * depth;
        B.lump(RIVER.x0 + 2 + rand() * (W - 4), RIVER.y, z, 0.5 + rand() * 1.2, 0.08, 0.4 + rand() * 0.9, rand() < 0.5 ? 0xd5dade : 0xb5c0ca, rand() * 3);
      }
      // embankment walls, with the bank's snow on top
      for (const [x, side] of [[RIVER.x0 - 0.25, -1], [RIVER.x1 + 0.25, 1]]) {
        for (const [z0, z1] of [[MAP.z0, BRIDGE.n], [BRIDGE.s, MAP.z1]]) {
          // (its top just under the sidewalk's, so the two never flicker)
          B.chunk(0.5, -RIVER.y + SW - 0.02, z1 - z0, 0x77736c, x, (RIVER.y + SW - 0.02) / 2, (z0 + z1) / 2);
          B.block(x - side * 0.1, (z0 + z1) / 2, 0.4, (z1 - z0) / 2);
          // a railing along the bank's edge, a post every couple of metres
          const rx = x + side * 0.3; // on the land side of the wall
          const len = z1 - z0;
          for (let z = z0 + 0.6; z < z1 - 0.3; z += 1.8) {
            const bent = rand() < 0.08;
            B.piece(0.07, 0.9, 0.07, 0x4c4f53, rx, SW + 0.45, z, bent ? 0.35 : 0, 0, 0);
          }
          B.piece(0.06, 0.06, len - 0.4, 0x5a5d61, rx, SW + 0.88, (z0 + z1) / 2);
          B.piece(0.05, 0.05, len - 0.4, 0x5a5d61, rx, SW + 0.48, (z0 + z1) / 2);
        }
      }
      // the bridge: deck, fascia beams, two piers, railings
      B.chunk(W + 0.4, 0.98, BRIDGE.s - BRIDGE.n, 0x6e6b66, cx, -0.51, (BRIDGE.n + BRIDGE.s) / 2);
      for (const z of [BRIDGE.n + 0.1, BRIDGE.s - 0.1]) B.chunk(W + 0.6, 0.55, 0.3, 0x5d5a55, cx, -0.75, z);
      for (const x of [65, 73]) {
        B.chunk(1.3, -1 - RIVER.y, BRIDGE.s - BRIDGE.n - 2, 0x7a766f, x, (RIVER.y - 1) / 2, (BRIDGE.n + BRIDGE.s) / 2);
        B.lump(x, RIVER.y, BRIDGE.s - 1.5, 1.2, 0.12, 0.8, 0xd5dade);
      }
      for (const z of [BRIDGE.n + 0.25, BRIDGE.s - 0.25]) {
        for (let x = RIVER.x0 + 0.3; x < RIVER.x1; x += 1.2) {
          const bent = rand() < 0.12;
          B.piece(0.08, 0.95, 0.08, 0x4c4f53, x, SW + 0.47, z, bent ? 0.4 : 0, 0, bent ? 0.3 : 0);
        }
        B.piece(W, 0.07, 0.07, 0x5a5d61, cx, SW + 0.92, z);
        B.piece(W, 0.05, 0.05, 0x5a5d61, cx, SW + 0.5, z);
        B.block(cx, z, W / 2 + 0.6, 0.3);
      }
      // a torn section of railing hanging over the edge
      B.piece(3, 0.07, 0.07, 0x5a5d61, 70, SW + 0.2, BRIDGE.s + 0.1, 0.6, 0, 0.3);
      // work lights at the bridgehead: cold white on tripods
      for (const [x, z, yaw] of [[59, CURB.n + 0.8, 0.6], [76.5, CURB.s - 0.8, -2.5]]) {
        for (let k = 0; k < 3; k++) B.piece(0.04, 1.7, 0.04, 0x3a3c3f, x + Math.cos(k * 2.1) * 0.3, 0.8, z + Math.sin(k * 2.1) * 0.3, Math.sin(k * 2.1) * 0.2, 0, -Math.cos(k * 2.1) * 0.2);
        const head = put(B.root, box(0.5, 0.4, 0.2, 0x2e3034, { r: 0.04 }), x, 1.75, z);
        head.rotation.set(0, yaw, -0.4);
        const lens = put(B.root, box(0.42, 0.32, 0.04, COLD, { r: 0.01, glow: true }), x + Math.cos(yaw) * 0.12, 1.72, z - Math.sin(yaw) * 0.12);
        lens.rotation.copy(head.rotation);
        B.block(x, z, 0.4, 0.4);
        const ax = x + Math.cos(yaw) * 3.5;
        const az = z - Math.sin(yaw) * 3.5;
        B.emit(new THREE.Vector3(ax, 1.6, az), COLD, 16, 9);
        B.pool(ax, az, 3.2, COLD, 0.2, { sx: 1.5, yaw: -yaw });
      }
    }

    // ---------------------------------- more cold light along the way
    {
      // a cyan neon tube sign on the shop, still somehow powered
      const nx = 10.5;
      const ny = 2.25;
      const nz = WALK.n + 0.08;
      const tubes = [];
      for (let i = 0; i < 6; i++) {
        const vertical = i % 2 === 0;
        tubes.push(put(B.root, box(vertical ? 0.07 : 0.6, vertical ? 0.55 : 0.07, 0.05, NEON, { r: 0.01, glow: true }), nx - 2 + i * 0.75, ny + (vertical ? 0 : (i % 4) * 0.12 - 0.12), nz));
      }
      tubes.forEach((m) => B.keep(m));
      const e = B.emit(new THREE.Vector3(nx, ny, nz + 1.2), NEON, 10, 7);
      const p = B.pool(nx, WALK.n + 1.6, 2.6, NEON, 0.2, { sx: 1.6, sz: 0.7, y: SW + 0.03 });
      flickers.push({ e, lens: tubes[2], p, color: NEON, base: 0.2, seed: 41 });
      // a lit lightbox on the bus shelter
      const lb = put(B.root, box(0.06, 1.3, 0.9, COLD, { r: 0.01, glow: true }), -3.9, SW + 1.1, WALK.s - 0.9);
      B.keep(lb);
      B.emit(new THREE.Vector3(-4.4, 1.2, WALK.s - 1.4), COLD, 8, 6);
      B.pool(-4.6, WALK.s - 1.6, 1.8, COLD, 0.18, { y: SW + 0.03 });
      // fluorescent tubes inside two open garages
      for (const gx of [-20.5, 49.3]) {
        B.keep(put(B.root, box(1.6, 0.05, 0.05, COLD, { r: 0.01, glow: true }), gx, SW + 1.6, WALK.s + 4.4));
        B.emit(new THREE.Vector3(gx, 1.2, WALK.s + 3), COLD, 9, 6);
        B.pool(gx, WALK.s + 2.6, 2.0, COLD, 0.2, { sx: 1.2, y: SW + 0.03 });
      }
    }

    // ------------------------------------------------------ the checkpoint
    // A wall of jersey barriers from the buildings to the heat pipes, one
    // heavy gate in the middle. The gate takes three cannon hits.
    const gate = { hp: 2, down: false, leaves: [], blocks: [], fall: 0, beacons: [] };
    {
      for (let z = WALK.n + 0.1; z < WALK.s + 0.6; z += 1.7) {
        if (z > -2.6 && z < 2.6) continue;
        const y = heightAt(GX, z);
        const j = put(B.root, box(0.7, 0.9, 1.6, 0x9a978f, { r: 0.06 }), GX, y + 0.45, z);
        j.rotation.y = (rand() - 0.5) * 0.12;
        B.solid(j);
      }
      B.block(GX, -6.25, 0.45, 3.9);
      B.block(GX, 6.1, 0.45, 3.7);
      for (const z of [-2.9, 2.9]) {
        B.solid(put(B.root, box(0.9, 3.2, 0.9, 0x7d7c78, { r: 0.06 }), GX, 1.6, z));
        B.block(GX, z, 0.45, 0.45);
        put(B.root, cyl(0.16, 0.24, 0x2b2c2e, { seg: 8 }), GX, 3.32, z);
        const lens = B.keep(put(B.root, box(0.26, 0.2, 0.08, 0xffb02a, { r: 0.02, glow: true }), GX, 3.4, z));
        gate.beacons.push({ lens, e: B.emit(new THREE.Vector3(GX - 0.6, 3.2, z), 0xffa21f, 14, 9) });
      }
      // the leaves hinge at their bottom far edge, so they fall away from the tank
      const hz = new THREE.MeshToonMaterial({ map: hazard, gradientMap });
      hazard.repeat.set(3, 1);
      for (const z of [-1.25, 1.25]) {
        const hinge = new THREE.Group();
        hinge.position.set(GX + 0.15, 0, z);
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.6, 2.4), toon(0x3e4247));
        leaf.position.set(-0.15, 1.3, 0);
        leaf.castShadow = leaf.receiveShadow = true;
        hinge.add(leaf);
        for (const y of [0.6, 2.2]) {
          const band = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.4), hz);
          band.position.set(-0.31, y, 0);
          band.rotation.y = -Math.PI / 2;
          hinge.add(band);
        }
        for (const y of [0.3, 1.3, 2.3]) put(hinge, box(0.08, 0.12, 2.3, 0x2f3236, { r: 0.02 }), -0.32, y, 0);
        B.add(hinge);
        B.keep(hinge);
        B.solid(leaf);
        gate.leaves.push({ hinge, leaf, z });
      }
      const warn = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.7), sign(1.6, 0.7, { board: '#b08a2a', ink: '#1f2022' }));
      warn.position.set(-0.32, 1.45, 0);
      warn.rotation.set(0, -Math.PI / 2, 0.06);
      gate.leaves[0].hinge.add(warn);
      B.keep(warn); // falls with its leaf (added after the leaf was marked dynamic)
      gate.blocks.push({ x: GX, z: 0, hx: 0.3, hz: 2.5, yaw: 0 });
      B.blocks.push(...gate.blocks);

      for (let i = 0; i < 16; i++) {
        const z = (i % 2 ? -1 : 1) * (4 + (i >> 1) * 0.55);
        if (Math.abs(z) > 7) continue;
        B.lump(GX - 1.5, 0.16 + (i % 3) * 0.28, z, 0.38, 0.16, 0.22, 0x7d7158);
      }
      // (no obstacles between the barricade and the gate: the first boost
      // runs on clear road all the way to it)
      // floodlight tower: cold white over the approach
      const tx = GX - 2.4;
      const tz = WALK.s - 0.4;
      for (const [dx, dz] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) B.piece(0.08, 6, 0.08, 0x45484c, tx + dx, SW + 3, tz + dz);
      B.piece(1.1, 0.12, 1.1, 0x45484c, tx, SW + 6, tz);
      put(B.root, box(0.5, 0.5, 0.9, 0x2e3034, { r: 0.05 }), tx - 0.2, SW + 6.35, tz).rotation.z = -0.5;
      put(B.root, box(0.04, 0.4, 0.8, COLD, { r: 0.01, glow: true }), tx - 0.47, SW + 6.2, tz).rotation.z = -0.5;
      B.block(tx, tz, 0.5, 0.5);
      B.emit(new THREE.Vector3(tx - 4, 3.5, tz - 3), COLD, 26, 14);
      B.pool(tx - 5, tz - 4.5, 4.2, COLD, 0.2, { sx: 1.3, yaw: 0.6 });
      // guard booth behind the gate, a blue strobe on its roof
      put(B.root, box(1.6, 2.4, 1.6, 0x6f7a72, { r: 0.08 }), GX + 2.4, SW + 1.2, CURB.n - 1.2);
      put(B.root, box(1.8, 0.1, 1.8, 0xd0d3d8, { r: 0.02 }), GX + 2.4, SW + 2.46, CURB.n - 1.2);
      const strobe = B.keep(put(B.root, box(0.22, 0.16, 0.22, 0x3f8cff, { r: 0.03, glow: true }), GX + 2.4, SW + 2.6, CURB.n - 1.2));
      const strobeE = B.emit(new THREE.Vector3(GX + 1.4, 2.8, CURB.n - 1.2), 0x3f8cff, 12, 8);
      B.block(GX + 2.4, CURB.n - 1.2, 0.8, 0.8);
      B.animate((dt, t) => {
        const on = t % 0.9 < 0.12 || (t % 0.9 > 0.22 && t % 0.9 < 0.32);
        strobe.material = on ? glowMat(0x3f8cff) : toon(0x1d2a44);
        strobeE.level = on ? 1 : 0;
        if (gate.down) return;
        gate.beacons.forEach((b, i) => {
          b.lens.rotation.y = t * 5 + i * Math.PI;
          b.e.level = 0.45 + 0.55 * Math.max(0, Math.cos(t * 5 + i * Math.PI));
        });
      });
    }
    // gate toppling once it's broken
    B.animate((dt) => {
      if (!gate.down || gate.fall >= 1) return;
      gate.fall = Math.min(1, gate.fall + dt * 1.6);
      const k = gate.fall;
      const ease = k < 0.8 ? (k / 0.8) ** 2 : 1 - Math.sin(((k - 0.8) / 0.2) * Math.PI) * 0.06;
      gate.leaves.forEach((l, i) => {
        l.hinge.rotation.z = -ease * (Math.PI / 2 - 0.08);
        l.hinge.rotation.x = (i ? 1 : -1) * ease * 0.12;
      });
    });

    // the gate is a breakable like the barricades: one shell or a boost ram
    B.crushable(() => {}, { kind: 'prop', heavy: true, breakable: true, footprint: { x: GX, z: 0, hx: 0.4, hz: 2.5, yaw: 0 }, onBreak: () => (S.api ? breakGate(S.api) : false) });
    function breakGate(api) {
      if (gate.down) return true;
      gate.hp = 0;
      const c = api.combat;
      const center = new THREE.Vector3(GX - 0.3, 1.3, 0);
      c.fx.burst(center, { count: 24, speed: 7, color: 0xffd36b, life: 0.4, size: 0.08, gravity: 12 });
      // buckle the leaves with the hit
      gate.leaves.forEach((l, i) => {
        l.hinge.rotation.z = -0.1;
        l.hinge.rotation.y = (i ? 1 : -1) * 0.08;
      });
      // down it goes
      gate.down = true;
      for (const b of gate.blocks) api.removeBlock(b);
      for (const l of gate.leaves) api.removeCollider(l.leaf);
      for (const b of gate.beacons) {
        b.e.level = 0;
        b.lens.material = toon(0x3a2a14);
      }
      c.explode(center.clone().setY(1.6));
      c.machineDeath(center.clone().setY(2.6), 0x3e4247);
      for (let i = 0; i < 18; i++) {
        const a = Math.random() * Math.PI * 2;
        c.puffs.spawn(new THREE.Vector3(GX + 1, 0.3, (Math.random() - 0.5) * 4), new THREE.Vector3(Math.cos(a) * 3, 0.6, Math.sin(a) * 3), { color: 0xa9a8a6, s0: 0.3, s1: 0.9, life: 1.4, drag: 2, lift: 0.4, fadeAt: 0.3 });
      }
      api.shake(0.5);
      api.prompt('Breakthrough', 'The gate is down. Drive through!', { seconds: 4 });
      api.arrow(new THREE.Vector3(GX + 5, 0.4, 0), 'Go!');
      if (S.sector === 1) go(5);
      return true;
    }

    // ------------------------------------- depot shacks (sector borders)
    // A garage shack across the whole street between sectors: the way on is
    // through it. Its sides are walled off to the buildings and the pipes.
    const shacks = SHACKS.map((k) => buildShack(B, { x0: k.x0, x1: k.x1, z0: CURB.n + 0.1, z1: CURB.s - 0.1, fill: { n: WALK.n - 0.5, s: PZ - 0.45 }, heightAt }));

    // ----------------------------------------------- breakable barricades
    // Wrecks, jersey blocks and planks nailed across: a boost ram or one
    // shell from the main gun bursts a section. (Shipping containers are
    // for what can't be broken through.)
    const barricadeParts = [];
    function barricade(x, sections) {
      for (const [z0, z1] of sections) {
        const zc = (z0 + z1) / 2;
        const len = z1 - z0;
        B.crushable(
          () => {
            const y = heightAt(x, zc);
            P.car(B, x, zc, Math.PI / 2 + (rand() - 0.5) * 0.3, { kind: rand() < 0.5 ? 'sedan' : 'hatch', paint: BURNT_PAINT[(rand() * 6) | 0], solidBlock: false, snow: false });
            const top = P.car(B, x + 0.2, zc + 0.3, Math.PI / 2 + 0.4, { kind: 'hatch', paint: BURNT_PAINT[(rand() * 6) | 0], solidBlock: false, flipped: true, snow: false });
            top.position.y = 1.0 + y;
            top.rotation.z = 0.2;
            for (const s of [-1, 1]) {
              const j = put(B.root, box(0.7, 0.9, 1.6, 0x9a978f), x + s * 1.1, y + 0.45, zc + s * 1.2);
              j.rotation.y = s * 0.4;
            }
            // planks nailed across the face, crossed
            for (const [h, tilt] of [[0.6, 0.18], [1.2, -0.14], [1.75, 0.1]]) {
              const p = put(B.root, box(0.08, 0.22, len - 0.5, [0x7a5f3e, 0x6b5640, 0x84694a][(rand() * 3) | 0]), x - 1.0, y + h, zc);
              p.rotation.x = tilt;
            }
            for (const zz of [z0 + 0.5, z1 - 0.5]) put(B.root, box(0.12, 2.2, 0.16, 0x5c472e), x - 0.95, y + 1.1, zz);
            for (let i = 0; i < 6; i++) B.piece(0.3 + rand() * 0.5, 0.2, 0.3, CONCRETE[i % 5], x + (rand() - 0.5) * 2.4, y + 0.1, zc + (rand() - 0.5) * len, rand(), rand() * 3, rand());
            put(B.root, box(0.12, 0.3, len - 0.4, 0xc99a2e), x - 1.06, y + 0.95, zc); // hazard board
            B.hitBox(x, y + 1.1, zc, 2.2, 2.2, len);
            B.block(x, zc, 1.0, len / 2);
          },
          { kind: 'prop', heavy: true, breakable: true, scrap: 3, onBreak: () => burst(new THREE.Vector3(x, 1.2, zc)) },
        );
        barricadeParts.push(B.crushables[B.crushables.length - 1]);
      }
    }
    // a section going up: a blast, then it scatters (the default break)
    let comb = null;
    const burst = (at) => {
      comb?.explode(at);
      comb?.machineDeath(at.clone().setY(2), 0x4a4440);
    };
    barricade(81.5, [[WALK.n, -3.3], [-3.3, 3.3], [3.3, WALK.s + 1]]);

    // The end of the zone: a two-high wall of shipping containers. Only the
    // airstrike gets through it; it collapses into a heap of torn metal.
    function containerWall(x, sections) {
      return sections.map(([z0, z1, high = 1]) => {
        const zc = (z0 + z1) / 2;
        const len = z1 - z0;
        const c = B.crushable(
          () => {
            for (let k = 0; k < high; k++) {
              const m = container(x + (rand() - 0.5) * 0.3, k * 2.6, zc + (rand() - 0.5) * 0.4, Math.PI / 2 + (rand() - 0.5) * 0.06, CONTAINERS[(rand() * 5) | 0], k ? (rand() - 0.5) * 0.05 : 0);
              m.scale.x = Math.min(1.2, len / 6);
            }
            if (high === 1) rubble(x - 1.4, zc + (rand() - 0.5) * 2, 1.0, 0.8); // a heap at its foot
            B.hitBox(x, 1.3 * high, zc, 2.6, 2.6 * high, len);
            B.block(x, zc, 1.25, len / 2);
          },
          { kind: 'prop', heavy: true, armored: true, pivot: { x, y: 0, z: zc } },
        );
        c.onBreak = () => {
          collapse(c, x, zc, len);
          return true;
        };
        return c;
      });
    }
    // a container section torn apart: the boxes vanish into the blast and a
    // low heap of crumpled sheet, frames and rubble is left lying there
    function collapse(c, x, zc, len) {
      c.group.visible = false;
      const heap = new THREE.Group();
      const colors = [...new Set(c.colors)].filter((col) => col !== 0xd0d3d8);
      for (let i = 0; i < 9; i++) {
        const sheet = new THREE.Mesh(new THREE.BoxGeometry(1.4 + Math.random() * 1.6, 0.12, 1 + Math.random() * 1.4), toon(colors[i % colors.length] ?? 0x6b6f72));
        // lying on the ground (or propped on each other), never hanging in the air
        sheet.position.set(x + (Math.random() - 0.5) * 3.5, 0.08 + (i % 3) * 0.1, zc + (Math.random() - 0.5) * len);
        sheet.rotation.set((Math.random() - 0.5) * 0.25, Math.random() * 3, (Math.random() - 0.5) * 0.25);
        sheet.castShadow = sheet.receiveShadow = true;
        heap.add(sheet);
      }
      for (let i = 0; i < 6; i++) {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(2 + Math.random() * 2, 0.14, 0.14), toon(0x3a3c3f));
        beam.position.set(x + (Math.random() - 0.5) * 3, 0.1 + Math.random() * 0.15, zc + (Math.random() - 0.5) * len);
        beam.rotation.set(0, Math.random() * 3, (Math.random() - 0.5) * 0.15);
        heap.add(beam);
      }
      B.root.add(heap);
      const at = new THREE.Vector3(x, 1.5, zc);
      if (comb) {
        for (let i = 0; i < 26; i++) {
          const a = Math.random() * Math.PI * 2;
          comb.debris.spawn(at.clone().add(new THREE.Vector3(0, Math.random() * 2, (Math.random() - 0.5) * len)), new THREE.Vector3(Math.cos(a) * (2 + Math.random() * 5), 4 + Math.random() * 6, Math.sin(a) * (2 + Math.random() * 5)), { color: colors[i % colors.length] ?? 0x6b6f72, size: 0.12 + Math.random() * 0.2, life: 3 + Math.random() });
        }
        for (let i = 0; i < 12; i++) {
          const a = Math.random() * Math.PI * 2;
          comb.puffs.spawn(at.clone().setY(0.4), new THREE.Vector3(Math.cos(a) * 3, 0.8, Math.sin(a) * 3), { color: 0x8f8b84, s0: 0.3, s1: 1.0, life: 1.6, drag: 2, lift: 0.5, fadeAt: 0.3 });
        }
      }
    }

    // ------------------------------ the end of the zone: the intersection
    // A broad crossing; both side streets run on until rubble from collapsed
    // blocks chokes them. Past it, a two-high container wall seals the street:
    // the airstrike opens it.
    {
      const jx = (JUNCTION.x0 + JUNCTION.x1) / 2;
      // north: a block came down across the side street
      rubble(jx, -25.5, 6, 3.6, { slabs: 7 });
      rubble(jx - 5, -23, 2.4, 1.6, { slabs: 2 });
      rubble(jx + 5.5, -23.5, 2, 1.3, { slabs: 2 });
      B.rebar(jx + 2, 1.5, -24, 6);
      B.hitBox(jx, 1.6, -25.5, 14, 3.2, 6);
      B.block(jx, -25.5, 8.5, 2.6);
      // south: rubble and a burnt bus nose-down in it
      rubble(jx, 25.5, 5.4, 2.8, { slabs: 6 });
      rubble(jx + 5, 23.5, 2.2, 1.4, { slabs: 2 });
      B.hitBox(jx, 1.3, 25.5, 13, 2.6, 5.4);
      B.block(jx, 25.2, 8.5, 2.4);
      P.tram(B, jx - 2, 29, 0.6, { nose: -0.14, tilt: 0.1, burn: 0.9 });
      // both plazas: the back edge in line with the rubble (containers, a
      // heap, jersey blocks in front of the block behind), and in line with
      // the end wall a row of hedgehogs and broken concrete across the square
      const py = SW;
      const hedgehog = (x, z, yaw) => {
        const g = new THREE.Group();
        put(g, box(1.8, 0.14, 0.14, 0x3f4144, { r: 0.02 }), 0, 0.55, 0).rotation.set(0, 0, 0.62);
        put(g, box(1.8, 0.14, 0.14, 0x3f4144, { r: 0.02 }), 0, 0.55, 0).rotation.set(0, Math.PI / 2, 0.62);
        put(g, box(0.14, 0.14, 1.8, 0x3f4144, { r: 0.02 }), 0, 0.55, 0).rotation.set(0.62, 0.6, 0);
        g.position.set(x, py, z);
        g.rotation.y = yaw;
        B.add(g);
      };
      for (const side of [-1, 1]) {
        const back = side * (PLAZA.z - 0.6);
        container(PLAZA.x0 + 3.5, py, back, 0, CONTAINERS[side < 0 ? 4 : 1]);
        container(PLAZA.x0 + 3.3, py + 2.6, back - side * 0.2, 0.06, CONTAINERS[side < 0 ? 0 : 3]);
        B.block(PLAZA.x0 + 3.5, back, 3.1, 1.3);
        rubble(PLAZA.x0 + 8.5, back - side * 0.3, 1.8, 1.4, { solid: true });
        for (let x = PLAZA.x0 + 6; x < PLAZA.x1 - 0.5; x += 1.7) {
          if (Math.abs(x - (PLAZA.x0 + 8.5)) < 2 || Math.abs(x - END_X) < 1.2) continue;
          const j = put(B.root, box(1.6, 0.9, 0.7, 0x9a978f, { r: 0.06 }), x, py + 0.45, back + side * 0.3);
          j.rotation.y = (rand() - 0.5) * 0.15;
          B.solid(j);
        }
        B.block((PLAZA.x0 + PLAZA.x1) / 2 + 2.5, back + side * 0.3, (PLAZA.x1 - PLAZA.x0) / 2 - 2.5, 0.45);
        // the end wall carries on across the square, out to its back edge:
        // a dead tram and a container on one side, containers single and
        // doubled with a heap between on the other, hedgehogs at the foot
        if (side < 0) {
          P.tram(B, END_X, -14.6, Math.PI / 2 + 0.06, { tilt: -0.06 });
          container(END_X + 0.2, py, -21, Math.PI / 2, CONTAINERS[2]);
          B.block(END_X + 0.2, -21, 1.25, 3);
          rubble(END_X - 0.8, -18, 1.3, 1.2, { slabs: 2 });
        } else {
          container(END_X, py, 13.9, Math.PI / 2, CONTAINERS[0]);
          container(END_X + 0.1, py + 2.6, 13.6, Math.PI / 2 + 0.05, CONTAINERS[4]);
          B.block(END_X, 13.9, 1.25, 3);
          rubble(END_X, 17.8, 1.6, 1.5, { solid: true, slabs: 3 });
          B.block(END_X, 17.8, 1.2, 1.1);
          const m = container(END_X + 0.3, py, 21.6, Math.PI / 2 - 0.12, CONTAINERS[3]);
          m.scale.x = 0.9;
          B.block(END_X + 0.3, 21.6, 1.25, 2.8, -0.12);
        }
        for (const dz of [2.2, 6.8, 11]) hedgehog(END_X - 2.2, side * (CURB.s + 2 + dz), rand() * 3);
        // a few things left about on the squares
        B.crushable(() => P.car(B, PLAZA.x0 + 6.5, side * 15, 0.7, { kind: 'sedan', paint: BURNT_PAINT[side < 0 ? 2 : 4] }), { kind: 'car', scrap: 2 });
        B.crushable(() => P.crates(B, END_X - 2.5, py, side * 19), { kind: 'prop', scrap: 2 });
        B.crushable(() => P.bench(B, PLAZA.x0 + 2.5, py, side * 12.5, side > 0 ? Math.PI + 0.3 : 0.3), { kind: 'prop' });
        B.crushable(() => P.bin(B, PLAZA.x0 + 3.6, py, side * 12.2, { tipped: true }), { kind: 'prop', scrap: 1 });
        // and beyond the line, more square: a wreck and a kiosk shell
        P.car(B, END_X + 5, side * 16, 2.3, { kind: 'van', paint: 0x6b7458, solidBlock: false });
        put(B.root, box(2.2, 2.0, 1.6, 0x58707a, { r: 0.06 }), END_X + 7.5, py + 1.0, side * 21);
      }
      // the north street beyond the rubble: more wrecks and heaps on into the dusk
      for (const [x, z, r] of [[jx - 3, -36, 1.6], [jx + 3.5, -48, 2.2], [jx - 2, -60, 1.8], [jx + 2, -74, 2.4]]) rubble(x, z, r, r * 0.7, { slabs: 2 });
      P.car(B, jx + 2.5, -41, 1.9, { kind: 'van', paint: 0x6b7458, solidBlock: false });
      P.car(B, jx - 2.5, -53, 1.2, { kind: 'sedan', paint: BURNT_PAINT[1], solidBlock: false });
      P.car(B, jx + 1.5, -66, 1.6, { kind: 'hatch', paint: BURNT_PAINT[4], solidBlock: false });
    }
    // across the street: single and doubled containers, varying (the airstrike's target)
    const endWall = containerWall(END_X, [[WALK.n - 0.5, -3.4, 1], [-3.4, 3.4, 2], [3.4, WALK.s + 1.6, 1]]);
    // past the wall the street runs on into a last heap of rubble
    // past the wall the street runs on (the tank drives off down it at the
    // end, nothing in the way): heaps only along its edges
    rubble(170, -8.6, 2.2, 1.6, { slabs: 2 });
    rubble(172, 8, 2.4, 1.8, { slabs: 2 });

    B.finish();
    B.mergeStatic();

    // the depot interior, built far off in the same scene
    const room = buildDepotRoom(scene);
    B.blocks.push(...room.blocks);
    B.colliders.push(...room.colliders);
    B.emitters.push(...room.emitters);
    room.bindBlocks(B.blocks);

    // ---------------------------------------------------- the zone script
    // Three sectors, a depot shack across the street between each:
    //  1 The avenue: learn to drive, shoot, crush, collect scrap
    //  2 The bridge: rocket-ram the barricade, blow the gate
    //  3 The intersection: hold out, the airstrike, the large quadruped
    const SECTORS = ['The avenue', 'The bridge', 'The intersection'];
    const [shackA, shackB] = shacks;
    const B1 = { minX: START_X + 2, maxX: shackA.x0 - 0.8, minZ: -21, maxZ: 9.9 };
    const B2 = { minX: shackA.x1 + 1.2, maxX: shackB.x0 - 0.8, minZ: -12, maxZ: 9.9 };
    const B3 = { minX: shackB.x1 + 1.2, maxX: END_X + 6, minZ: -22.5, maxZ: 22.5 };
    const BARRICADE_X = 81.5;
    const S = { sector: 0, step: 0, t: 0, spawnX: 0, n: 0, shots: 0, hold: 0, boss: null, waveT: 0, strike: null };
    const gateMark = new THREE.Vector3(GX - 0.3, 1.6, 0);
    let CLICK = '<kbd>Click</kbd>';
    const bounds = { ...B1 };
    const setBounds = (api, b) => api.setBounds(Object.assign(bounds, b));
    // the arrow that follows the nearest enemy
    const onEnemy = (api) => () => {
      const e = api.nearestEnemy();
      return e ? new THREE.Vector3(e.pos.x, 1.4 * e.stats.scale, e.pos.z) : null;
    };
    const go = (step) => {
      S.step = step;
      S.t = 0;
    };
    // the sector is clear: open the shack ahead and point at it
    function openShack(api, shack, text) {
      shack.openIn();
      api.objective('Enter the checkpoint');
      api.prompt('Zone clear', text, { go: true });
      api.arrow(shack.door, 'Checkpoint');
    }
    const atDoor = (api, shack) => shack.inDoor > 0.6 && Math.hypot(api.tankPos.x - shack.door.x, api.tankPos.z - shack.door.z) < 5;

    function start(api) {
      CLICK = api.touch ? '<kbd>Tap</kbd>' : '<kbd>Click</kbd>';
      Object.assign(S, { sector: 0, step: 0, t: 0, spawnX: api.tankPos.x, n: 0, hold: 0, boss: null, strike: null, warned: false, taught: false });
      setBounds(api, B1);
      S.api = api;
      comb = api.combat;
      api.sectors(SECTORS, 0);
      api.objective('Drive up the street and destroy all enemies');
      // Every tip shows once, the first time it comes up, and never again
      // (Replay tutorial in the quarters brings them back). What they
      // introduce is there from the start once you've seen them.
      if (api.seen('fire')) api.enableGun();
      if (api.seen('scraps')) api.revealScraps(false);
      if (api.seen('boost')) api.giveRockets();
      // the battle tank's Piercing shot comes online at the boss the first
      // time; any other tank has its ability from the start
      if (api.tank.ability && (api.tank.ability !== 'pierce' || api.seen('ability-pierce'))) api.giveAbility();
      if (api.lesson('controls')) {
        if (api.touch) api.prompt('Controls', 'Use the <b>stick</b> in the bottom left to drive.');
        else api.prompt('Controls', 'Drive with <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or the arrow keys.');
        api.arrow(new THREE.Vector3(S.spawnX + 12, 0.4, 0), 'This way');
      }
    }

    // ------------------------------------------------- sector 1: the avenue
    function sector1(api) {
      const x = api.tankPos.x;
      const run = api.run;
      switch (S.step) {
        // 1: crush the wreck ahead -> scraps are introduced
        case 0:
          if (api.seen('crush')) {
            if (S.t > 1.5) go(1); // seen it: straight to the first enemies
          } else if (x > S.spawnX + 3 || S.t > 4) {
            api.lesson('crush');
            api.prompt('Crush', 'Drive over debris to <b>crush</b> it. Flatten that wreck!');
            api.arrow(new THREE.Vector3(FIRST_WRECK.x, 1.6, FIRST_WRECK.z), 'Crush it!');
            go(-1);
          }
          break;
        case -1:
          if (run.crushed > 0 || x > FIRST_WRECK.x + 6) {
            api.arrow(null);
            if (api.lesson('scraps')) api.prompt('Scraps', 'Destroying obstacles gives <b>scraps</b>, a valuable currency.', { go: true });
            api.revealScraps();
            go(-2);
          }
          break;
        // 2: then the first walkers, and the main gun comes online
        case -2:
          if (S.t > 3.5) go(1);
          break;
        case 1:
          {
            api.arrow(null);
            api.enableGun();
            const out = [[22, -9], [16, -3]];
            api.spawnDog(22, -18.5, { via: out });
            api.spawnDog(20.5, -19.5, { delay: 0.6, via: out });
            api.spawnDog(23.5, -19.5, { delay: 1.2, via: out });
            go(2);
          }
          break;
        case 2: {
          // first sight of them: slow it all down and point at them
          const e = api.nearestEnemy();
          if (e && Math.hypot(e.pos.x - x, e.pos.z - api.tankPos.z) < 12.5) {
            S.shots = run.shots;
            const hold = api.tank.gun === 'autocannon';
            const how = api.touch ? `${hold ? 'Touch and hold' : CLICK} on one to fire.` : `Aim and ${hold ? 'hold the mouse button' : CLICK} (or <kbd>Space</kbd>) to fire.`;
            api.enableGun();
            if (api.lesson('fire')) {
              api.prompt('Contact', `Enemies incoming! Destroy them with your <b>${hold ? 'autocannon' : 'cannon'}</b>! ${how}`, { danger: true });
              api.arrow(onEnemy(api), api.touch ? `${CLICK} it!` : `${CLICK} to fire!`);
              api.spotlight({ targets: [onEnemy(api), () => api.tankPos.clone().setY(1)], r: 100 }, () => run.shots > S.shots, { maxTime: 20 });
            } else if (api.tank.ability === 'breakthrough' && api.lesson('ability-breakthrough')) {
              api.prompt('Ability', api.touch ? 'Enemies incoming! Tap the <b>E</b> button to <b>Breakthrough</b>: charge through them, shielded, smashing anything in your way!' : 'Enemies incoming! Press <kbd>E</kbd> to <b>Breakthrough</b>: charge through them, shielded, smashing anything in your way!', { danger: true, seconds: 8 });
              api.spotlight({ targets: [api.ability2Screen(), onEnemy(api)], r: 110 }, () => (run.abilities || 0) > 0, { maxTime: 2.5 });
            } else if (!api.cleared) api.prompt('Contact', 'Enemies incoming!', { danger: true, seconds: 4 });
            go(3);
          } else if (!e && S.t > 3) {
            S.shots = -1; // already dealt with from long range: skip the lesson
            go(3);
          }
          break;
        }
        case 3:
          // after the first shot, while the cannon reloads, the MG takes over
          if (run.shots > S.shots && (api.mgActive || S.t > 4)) {
            if (api.lesson('mg')) {
              api.prompt('Machine gun', `Your <b>machine gun</b> automatically attacks enemies while your ${api.tank.gun === 'autocannon' ? 'autocannon' : 'cannon'} reloads!`);
              api.arrow(onEnemy(api), 'Auto MG');
            }
            go(4);
          }
          break;
        case 4:
          if (api.seen('drops')) go(5);
          else if (run.drops > 0 && !api.spotlit) {
            const d = api.nearestDrop();
            if (d) {
              api.lesson('drops');
              api.prompt('Scraps', 'Enemies drop <b>scraps</b> too. Drive close to collect them.', { go: true });
              api.spotlight({ targets: [d.clone(), () => api.tankPos.clone().setY(1)], r: 90 }, () => run.scrap > 0, { maxTime: 3.5 });
              go(5);
            }
          }
          if (api.enemiesAlive === 0 && S.t > 2 && run.drops === 0) go(5);
          break;
        // then two groups, each spawned well ahead up the street (none out of
        // side streets behind: nothing to wait around for)
        case 5:
          if (api.enemiesAlive === 0 && S.t > 1.5) {
            api.arrow(null);
            const gx = Math.min(38, Math.max(x + 17, 30));
            api.spawnDog(gx, -5.5, { delay: 0.3 });
            api.spawnDog(gx + 1, 4.5, { delay: 0.7 });
            api.spawnDog(gx + 2.5, -0.5, { delay: 1.1 });
            if (api.lesson('multiplier')) api.prompt('Contact', 'More of them! Kill them in quick succession to build your <b>multiplier</b>: more scraps per kill.', { danger: true });
            else if (!api.cleared) api.prompt('Contact', 'More of them!', { danger: true, seconds: 3 });
            go(6);
          }
          break;
        // the last stretch: an arrow on up the street; passing it brings the
        // last group out by the checkpoint, and the checkpoint opens as you
        // close in, whether or not they're all down (whatever's left behind
        // stays behind when you go in)
        case 6:
          if (api.enemiesAlive === 0 && S.t > 1.5 && S.n === 0) {
            S.n = 1;
            if (api.lesson('push')) {
              api.prompt('Orders', 'Push on up the street.');
              api.arrow(new THREE.Vector3(32, 0.4, 0), 'This way');
            }
          }
          if (x > 30 || (S.n === 1 && x > 28)) {
            api.arrow(null);
            const gx = Math.max(45, x + 15);
            api.spawnDog(gx + 2, -6.4, { delay: 0.2 });
            api.spawnDog(gx + 2.5, 5.2, { delay: 0.5 });
            api.spawnDog(gx, 0, { delay: 0.8 });
            if (!api.cleared) api.prompt('Contact', 'Enemies at the checkpoint!', { danger: true, seconds: 4 });
            go(7);
          }
          break;
        case 7:
          if (x > 40 || (api.enemiesAlive === 0 && S.t > 1)) {
            openShack(api, shackA, 'Roll into the <b>checkpoint</b> for repairs and parts.');
            go(8);
          }
          break;
        case 8:
          if (atDoor(api, shackA)) {
            go(9);
            api.depot(shackA, { offers: ['dozer', 'autoloader', 'era'], onLeave: () => startSector2(api) });
          }
          break;
      }
    }

    // ------------------------------------------------- sector 2: the bridge
    function startSector2(api) {
      S.sector = 1;
      go(0);
      setBounds(api, B2);
      api.sectors(SECTORS, 1);
      api.objective('Cross the bridge');
    }
    function sector2(api) {
      const x = api.tankPos.x;
      const run = api.run;
      switch (S.step) {
        case 0:
          // the boost comes online here, the first time it's needed
          if (x > BARRICADE_X - 9 && !api.spotlit) {
            api.giveRockets();
            S.shots = run.boosts;
            api.objective('Break through the barricade');
            const move = api.tank.moveName;
            const verb = `<b>${move.toLowerCase()}</b> and ram`;
            const teach = api.lesson('boost');
            if (teach) api.prompt(move, api.touch ? `Tap the <b>${move.toLowerCase()}</b> button to ram the barricade, or shoot to destroy it!` : `Press <kbd>Shift</kbd> to ${verb} the barricade, or shoot to destroy it!`, { go: true });
            api.arrow(new THREE.Vector3(BARRICADE_X, 1.8, 0), 'Break it!');
            S.n = run.shots;
            if (teach) api.spotlight({ targets: [new THREE.Vector3(BARRICADE_X, 1.2, -0.5), api.abilityScreen()], r: 110 }, () => run.boosts > S.shots || run.shots > S.n || barricadeParts.some((c) => c.done));
            go(1);
          }
          break;
        case 1:
          if (x > BARRICADE_X + 2) {
            api.arrow(null);
            api.objective('Destroy all enemies');
            if (api.lesson('ram')) api.prompt('Contact', 'Enemies! Boosting rams them too.', { danger: true, seconds: 4 });
            else if (!api.cleared) api.prompt('Contact', 'Enemies!', { danger: true, seconds: 4 });
            api.spawnDog(94, -3);
            api.spawnDog(95, 2, { delay: 0.4 });
            api.spawnDog(96.5, 5, { delay: 0.8 });
            api.spawnDog(92, -6, { delay: 1.2 });
            go(2);
          }
          break;
        case 2:
          if (api.enemiesAlive === 0 && S.t > 2) {
            api.spawnDog(97.5, -7.5);
            api.spawnDog(97.5, 7.6, { delay: 0.4 });
            api.spawnDog(96, 0, { delay: 0.9 });
            api.spawnDog(98, 3, { delay: 1.8 });
            go(3);
          }
          break;
        case 3:
          if (api.enemiesAlive === 0 && S.t > 1) {
            api.objective('Break the gate');
            if (api.lesson('gate')) api.prompt('Gate', api.touch ? `${CLICK} the gate to shoot it, or ${api.tank.moveName.toLowerCase()} into it.` : `Shoot the gate (${CLICK}), or ${api.tank.moveName.toLowerCase()} into it.`);
            api.arrow(gateMark, 'Break it!');
            go(4);
          }
          break;
        // 4: waiting for the gate (onImpact)
        case 5:
          if (x > GX + 1) {
            openShack(api, shackB, 'Through! Another <b>checkpoint</b>. Patch up before the intersection.');
            go(6);
          }
          break;
        case 6:
          if (atDoor(api, shackB)) {
            go(7);
            api.depot(shackB, { offers: ['afterburner', 'twinmg', 'optics'], onLeave: () => startSector3(api) });
          }
          break;
      }
    }

    // ------------------------------------------- sector 3: the intersection
    // Hold the crossing for a short while, then the large quadruped climbs
    // over the rubble; the moment it dies the airstrike opens the wall.
    const HOLD = 15;
    const JX = (JUNCTION.x0 + JUNCTION.x1) / 2;
    function startSector3(api) {
      S.sector = 2;
      go(0);
      setBounds(api, B3);
      api.sectors(SECTORS, 2);
      S.hold = HOLD;
      S.waveT = 1;
      S.n = 0;
      api.prompt('Zone 3', 'The street ahead is walled off. <b>Hold the intersection!</b>', { danger: true, seconds: 6 });
    }
    // walkers climbing in over the rubble in the side streets
    const fromNorth = (api, dx, delay = 0) => api.spawnDog(JX + dx, -20, { delay, via: [[JX + dx * 0.6, -9]] });
    const fromSouth = (api, dx, delay = 0) => api.spawnDog(JX + dx, 20, { delay, via: [[JX + dx * 0.6, 8]] });
    function sector3(api, dt) {
      switch (S.step) {
        case 0:
          S.hold -= dt;
          S.waveT -= dt;
          if (S.waveT <= 0 && S.hold > 2 && api.enemiesAlive < 8) {
            S.waveT = 4.5;
            S.n++;
            if (S.n % 2) {
              fromNorth(api, -3);
              fromNorth(api, 3, 0.4);
              fromSouth(api, 0, 0.8);
            } else {
              fromSouth(api, -4);
              fromSouth(api, 4, 0.4);
              fromNorth(api, 0, 0.8);
            }
          }
          if (S.hold <= 0) {
            // just out of sight up a side street, so it's on screen quickly;
            // it clambers in over the rubble. The street where the camera can
            // see it come in (no building in front of it), north first.
            const ways = [
              { from: new THREE.Vector3(JX, 0, -9), dir: new THREE.Vector3(0, 0, -1), via: [JX, -8] },
              { from: new THREE.Vector3(JX, 0, 9), dir: new THREE.Vector3(0, 0, 1), via: [JX, 8] },
            ].map((w) => ({ ...w, at: api.offscreen(w.from, w.dir) }));
            const seen = (w) => [0, 0.33, 0.66, 1].every((k) => api.clearView(w.at.clone().lerp(new THREE.Vector3(w.via[0], 0, w.via[1]), k), 2.2));
            const way = ways.find(seen) || ways[1];
            S.boss = api.spawnHound(way.at.x, way.at.z, { via: [way.via], noclip: true });
            fromSouth(api, -3, 1.5);
            fromSouth(api, 3, 2);
            api.boss(S.boss, 'Large quadruped');
            api.prompt('Warning', '<b>Defeat the boss</b> to complete the level!', { danger: true, seconds: 7 });
            api.spotlight({ targets: [() => (S.boss.alive ? new THREE.Vector3(S.boss.pos.x, 2, S.boss.pos.z) : null), () => api.tankPos.clone().setY(1)], r: 130 }, () => S.t > 1.4, { maxTime: 2.5, frame: () => (S.boss.alive ? S.boss.pos.clone() : null) });
            go(1);
          }
          break;
        case 1:
          // the first time through, the tank's own ability comes online for
          // the boss (played before, it's had it all along)
          if (S.t > 3 && !S.taught && api.tank.ability === 'pierce' && S.boss.alive && api.lesson('ability-pierce')) {
            S.taught = true;
            api.giveAbility();
            const how = api.touch ? 'Tap the <b>E</b> button, drag to aim and let go' : 'Press <kbd>E</kbd>, aim and click';
            api.prompt('Ability', `Your tank's ability is ready! ${how} to fire a <b>piercing shot</b> straight through the boss!`, { go: true, seconds: 9 });
            api.spotlight({ targets: [api.ability2Screen(), () => (S.boss.alive ? new THREE.Vector3(S.boss.pos.x, 2, S.boss.pos.z) : null)], r: 110 }, () => (api.run.abilities || 0) > 0, { maxTime: 2.5 });
          }
          if (!S.boss.alive) {
            S.strike = airstrike(api);
            go(2);
          }
          break;
        case 2:
          if (S.strike.update(dt)) {
            S.strike = null;
            api.arrow(new THREE.Vector3(END_X + 3, 0.6, 0), 'Exit');
            go(3);
          }
          break;
        case 3:
          // the level ends the moment the tank crosses the wall's line
          if (api.tankPos.x > END_X - 0.5) {
            api.arrow(null);
            api.sectors(SECTORS, 3); // the last one ticked off too
            // then off down the middle of the street, clear of the heaps
            const z = api.tankPos.z;
            api.win('Level clear', { path: [[END_X + 4, z * 0.4], [END_X + 9, 0], [END_X + 70, 0]] });
            go(4);
          }
          break;
      }
    }

    // Bombs walk along the container wall and anything still standing near
    // it. update() returns true when it's over.
    function airstrike(api) {
      const c = api.combat;
      const points = [];
      for (const w of endWall) for (const dz of [-1.5, 1.5]) points.push(new THREE.Vector3(w.footprint.x, 1.2, w.footprint.z + dz));
      for (const e of api.enemies) points.push(new THREE.Vector3(e.pos.x, 0.6, e.pos.z));
      for (let i = 0; i < 4; i++) points.push(new THREE.Vector3(END_X - 4 + Math.random() * 3, 0.4, -8 + Math.random() * 16));
      points.sort((a, b) => a.z - b.z);
      const bombs = points.map((p, i) => ({ p, at: 0.5 + i * 0.09, done: false }));
      let t = 0;
      return {
        update(dt) {
          t += dt;
          for (const b of bombs) {
            if (b.done || t < b.at) continue;
            b.done = true;
            c.glow.tracer(b.p.clone().setY(18), b.p, 0xfff0c8, 0.12, 0.12);
            c.explode(b.p);
            api.blast(b.p, 3.2, 999);
            for (const w of endWall) if (Math.abs(w.footprint.z - b.p.z) < 3.3 && Math.abs(w.footprint.x - b.p.x) < 3) api.crush(w, { x: w.footprint.x - 3, z: w.footprint.z, yaw: 0 });
            api.shake(0.6);
          }
          if (t > 2.6) {
            for (const w of endWall) api.crush(w, { x: w.footprint.x - 3, z: w.footprint.z, yaw: 0 });
            return true;
          }
          return false;
        },
      };
    }

    // Dev kit: beat the current stage. Sectors 1 and 2 end at their
    // checkpoint's door, open and ready to drive in; in sector 3 the hold is
    // cut short so the boss comes on straight away, and once it's out,
    // skipping again kills it.
    function skipStage(api) {
      api.clearSpot();
      api.arrow(null);
      api.clearPrompt();
      if (S.sector < 2) {
        const shack = S.sector === 0 ? shackA : shackB;
        api.clearEnemies();
        api.enableGun();
        api.revealScraps();
        if (S.sector === 1) api.giveRockets();
        api.teleport(shack.door.x - 7, shack.door.z, 0);
        openShack(api, shack, 'Skipped ahead. Roll into the <b>checkpoint</b>.');
        go(S.sector === 0 ? 8 : 6);
        return true;
      }
      if (S.step === 0) {
        api.clearEnemies();
        S.hold = 0;
        return true;
      }
      if (S.step === 1 && S.boss?.alive) {
        api.blast(S.boss.pos.clone().setY(1), 0.5, 99999);
        return true;
      }
      return false;
    }

    function script(api, dt) {
      S.t += dt;
      if (api.run.mode !== 'field') return;
      if (S.sector === 0) sector1(api, dt);
      else if (S.sector === 1) sector2(api, dt);
      else sector3(api, dt);
    }
    function onImpact() {}

    function update(dt, t, ctx = {}) {
      B.update(dt, t, ctx);
      for (const k of shacks) k.update(dt, t);
      room.update(dt, t, ctx);
      for (const f of flickers) {
        if (f.e.dead) continue;
        const n = Math.sin(t * (f.fast ? 31 : 13.7) + f.seed) + Math.sin(t * (f.fast ? 47 : 5.3) + f.seed * 0.7);
        const on = n > (f.fast ? -0.2 : -1.2) ? 1 : 0.08;
        f.e.level = on;
        f.p.material.opacity = f.base * on;
        if (f.lens) f.lens.material = on > 0.5 ? glowMat(f.color) : toon(0x2a2b2e);
      }
      const phase = t % 11;
      for (const s of signals) {
        const which = s.mode === 'cycle' ? (phase < 5 ? 0 : phase < 6.5 ? 1 : 2) : t % 1.2 < 0.6 ? 1 : -1;
        s.lamps.forEach((l, i) => setLamp(l, i === which));
        if (which >= 0) {
          s.e.color.set(s.lamps[which].c);
          s.e.level = 1;
          s.p.material.color.set(s.lamps[which].c);
          s.p.material.opacity = 0.1;
        } else {
          s.e.level = 0;
          s.p.material.opacity = 0;
        }
      }
      if (ctx.api) script(ctx.api, dt);
    }

    return {
      light,
      colliders: B.colliders,
      blocks: B.blocks,
      emitters: B.emitters,
      crushables: B.crushables,
      depotRoom: room,
      heightAt: (x, z) => (z > 150 ? 0 : heightAt(x, z)),
      spawn: { x: START_X + 7, z: -0.5, yaw: 0 },
      bounds,
      script: S, // for tests
      shacks, // for tests
      start,
      onImpact,
      update,
      skipStage,
    };
  }
}
