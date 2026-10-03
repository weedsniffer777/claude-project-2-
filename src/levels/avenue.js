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
import { buildDepot } from './depot.js';

const FH = 1.35; // floor height
const PX = 12; // facade texels per world unit
const GPX = 10; // ground texels per world unit
const MAP = { x0: -80, x1: 140, z0: -46, z1: 40 }; // ground extent
const RIVER = { x0: 60, x1: 78, y: -3.4 }; // the river the avenue bridges
const BRIDGE = { n: -10.4, s: 9.8 }; // deck edges
const GX = 100; // the checkpoint gate
const START_X = -32; // the barricade behind the start
const CURB = { n: -7.5, s: 6.5 };
const WALK = { n: -10, s: 9 };
const SW = 0.16; // sidewalk height
const CROSS = { x0: 17, x1: 27 }; // the cross street running north

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

const onSidewalk = (x, z) => z >= CURB.s || (z <= CURB.n && !(x > CROSS.x0 && x < CROSS.x1));
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
  speckle(g, W, Z(CURB.s) - Z(CURB.n), ['#66676c', '#525358', '#6c6c70'], W * 40, rand, Z(CURB.n));

  g.fillStyle = '#aaa79e';
  for (const z of [-4, -0.6, -0.3, 3]) {
    const center = z === -0.6 || z === -0.3;
    for (let x = MAP.x0; x < MAP.x1; x += center ? 1 : 4) {
      if (rand() < 0.45) continue;
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
      if (rand() < 0.55) g.fillRect(X(x), Z(z + (rand() - 0.5) * 0.2), len * GPX, 2);
      x += len + rand() * 2;
    }
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
  name: 'Zone 1 · The avenue (tutorial)',
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
    slab(RIVER.x1, MAP.x1, -16, CURB.n);
    slab(MAP.x0, RIVER.x0, CURB.s, MAP.z1);
    slab(RIVER.x0, RIVER.x1, CURB.s, BRIDGE.s);
    slab(RIVER.x1, MAP.x1, CURB.s, MAP.z1);

    // snow banks plowed up along both curbs, with gaps where paths were cut
    for (const [z, dir] of [[CURB.n - 0.35, -1], [CURB.s + 0.35, 1]]) {
      for (let x = MAP.x0; x < MAP.x1; x += 0.55) {
        if (dir < 0 && x > CROSS.x0 - 0.5 && x < CROSS.x1 + 0.5) continue;
        if (rand() < 0.12) x += 2;
        B.lump(x, SW, z + dir * rand() * 0.25, 0.5 + rand() * 0.4, 0.2 + rand() * 0.18, 0.35 + rand() * 0.2, rand() < 0.3 ? 0xa9aaac : 0xc7cacf, rand() * 3);
      }
    }
    for (const z of [CURB.n + 0.3, CURB.s - 0.3]) {
      for (let x = MAP.x0; x < MAP.x1; x += 0.8) {
        if (rand() < 0.35) continue;
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
      const west = o.cutaway ? mapMat(cutawayTexture(depth, floors, rand)) : o.mural ? mapMat(endTexture(depth, floors, look, rand, true)) : end;
      const roof = toon(0xc6c9ce);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, depth), [end, west, roof, roof, front, end]);
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

    // North side, with gaps the sun comes through.
    building({ x0: -40, x1: -20, floors: 9, panel: PANELS[0], accent: ACCENTS[0], pierce: 0 });
    building({ x0: -15, x1: 4, floors: 5, panel: PANELS[3], accent: null, holes: 3, broken: 0.35, pierce: 3 });
    building({ x0: 4, x1: CROSS.x0, floors: 5, panel: PANELS[1], shop: true, sign: '#b7c9c4', letters: true, holes: 1 });
    building({ x0: CROSS.x1, x1: 39, floors: 9, panel: PANELS[2], accent: ACCENTS[2], mural: true, bite: { w: 4.5, floors: 4 }, holes: 3, pierce: 3 });
    building({ x0: 44, x1: 58, floors: 12, panel: PANELS[0], accent: ACCENTS[1], holes: 4, broken: 0.3, pierce: 4 });
    building({ x0: 80, x1: 97, floors: 9, panel: PANELS[4], accent: ACCENTS[4], holes: 3, broken: 0.4, pierce: 3 });
    building({ x0: 103, x1: 132, floors: 9, panel: PANELS[1], accent: ACCENTS[3], holes: 2, pierce: 3 });
    // west of the start: more blocks so the street doesn't end in a void
    building({ x0: -78, x1: -44, floors: 9, panel: PANELS[3], accent: ACCENTS[2], holes: 3, pierce: 0 });
    building({ x0: 8, x1: 36, zf: -29, depth: 8, floors: 2, panel: PANELS[2], broken: 0.6, pierce: 0 });

    // haze in the gaps: light pouring through between the blocks
    for (const [gx0, gx1, h] of [[CROSS.x0, CROSS.x1, 9], [39, 44, 12], [58, 80, 12], [97, 103, 9]]) {
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
    for (const [x0, x1] of [[START_X, CROSS.x0 - 0.6], [CROSS.x1 + 0.6, 48.4], [53.6, RIVER.x0], [RIVER.x1, 107.4], [112.6, 136]]) B.block((x0 + x1) / 2, WALK.n + 0.55, (x1 - x0) / 2, 0.3);

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
    // the cross street ends in a clean container wall: a straight corridor
    for (let k = 0; k < 2; k++) {
      container(19.8, k * 2.6, -23, 0, CONTAINERS[(k + 1) % 5]);
      container(25.2, k * 2.6, -23.1, 0, CONTAINERS[(k + 3) % 5]);
    }
    B.block(22, -23, 6, 1.5);

    // jersey barriers sealing the side gaps off the street
    for (const [x0, x1] of [[-20, -15], [39, 44], [57.6, 60]]) {
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
    for (let x = -34; x < 124; x += 14) poleXs.push(x);
    const spanY = 5.9;
    const flickers = [];
    let lampIndex = 0;
    const poleTops = new Map();
    for (const x of poleXs) {
      for (const side of [-1, 1]) {
        if (side < 0 && x > CROSS.x0 - 1 && x < CROSS.x1 + 1) continue; // keep the corridor mouth clear
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
    for (const x of poleXs) {
      if (rand() < 0.5) continue;
      B.sagging(new THREE.Vector3(x + (rand() - 0.5) * 4, 3 + rand() * 4, WALK.n), new THREE.Vector3(x, 4.8, CURB.n - 0.45), 0.6 + rand() * 1.2);
    }
    for (let i = 0; i < 12; i++) B.groundCable(-30 + rand() * 128, CURB.n + rand() * (CURB.s - CURB.n), rand() * Math.PI * 2, 8 + ((rand() * 10) | 0));

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
    pipeRun(44.4, 132, PZ, 1.05);
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
    wreck(-8, -5.5, 0.12, { kind: 'sedan', paint: BURNT_PAINT[0] });
    wreck(1.5, 4.8, 0.3, { kind: 'hatch', paint: BURNT_PAINT[1], flipped: true });
    wreck(11, -5.4, -0.35, { kind: 'sedan', paint: BURNT_PAINT[2] });
    wreck(24.5, 4.5, 0.55, { kind: 'van', paint: 0x6b7458 });
    P.bus(B, 33, -2.4, 0.18);
    wreck(45, 3.8, 2.75, { kind: 'hatch', paint: BURNT_PAINT[3] });
    wreck(67, 4.6, -0.2, { kind: 'van', paint: 0x7b7f78 });
    wreck(72.5, -5.2, 0.35, { kind: 'sedan', paint: BURNT_PAINT[5] });
    wreck(83, 5.0, 0.2, { kind: 'sedan', paint: BURNT_PAINT[1] });
    wreck(88, -5.8, -0.5, { kind: 'hatch', paint: BURNT_PAINT[0] });
    wreck(96.6, -4.6, 1.4, { kind: 'sedan', paint: BURNT_PAINT[2] });
    wreck(96.4, 4.8, -1.7, { kind: 'sedan', paint: BURNT_PAINT[3], flipped: true });
    wreck(118, -5.5, 0.4, { kind: 'sedan', paint: BURNT_PAINT[4] });
    wreck(124, 4.6, -0.3, { kind: 'van', paint: 0x6b7458 });
    wreck(129, -2, 1.3, { kind: 'hatch', paint: BURNT_PAINT[2] });
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
    junk(() => P.bench(B, 52.5, SW, WALK.n + 1.3, -0.1));
    junk(() => P.bin(B, -25, SW, WALK.n + 1.0), 1);
    junk(() => P.bin(B, 2, SW, WALK.n + 1.4, { tipped: true }), 1);
    junk(() => P.bin(B, 55, SW, WALK.n + 1.1, { tipped: true }), 1);
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
    junk(() => P.crates(B, 120, SW, WALK.n + 1.3), 2);
    junk(() => P.crates(B, 127, SW, CURB.s + 1.2), 2);
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
      const kx = 49.5;
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
    for (let i = 0; i < 18; i++) {
      const x = -60 + i * 10 + rand() * 4;
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
          B.chunk(0.5, -RIVER.y + SW, z1 - z0, 0x77736c, x, (RIVER.y + SW) / 2, (z0 + z1) / 2);
          B.block(x - side * 0.1, (z0 + z1) / 2, 0.4, (z1 - z0) / 2);
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
      for (const [x, z, yaw] of [[57.5, CURB.n + 0.8, 0.6], [79.5, CURB.s - 0.8, -2.5]]) {
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
      gate.blocks.push({ x: GX, z: 0, hx: 0.3, hz: 2.5, yaw: 0 });
      B.blocks.push(...gate.blocks);

      for (let i = 0; i < 16; i++) {
        const z = (i % 2 ? -1 : 1) * (4 + (i >> 1) * 0.55);
        if (Math.abs(z) > 7) continue;
        B.lump(GX - 1.5, 0.16 + (i % 3) * 0.28, z, 0.38, 0.16, 0.22, 0x7d7158);
      }
      function hedgehog(x, z) {
        const g = new THREE.Group();
        put(g, box(1.8, 0.14, 0.14, 0x3f4144, { r: 0.02 }), 0, 0.55, 0).rotation.set(0, 0, 0.62);
        put(g, box(1.8, 0.14, 0.14, 0x3f4144, { r: 0.02 }), 0, 0.55, 0).rotation.set(0, Math.PI / 2, 0.62);
        put(g, box(0.14, 0.14, 1.8, 0x3f4144, { r: 0.02 }), 0, 0.55, 0).rotation.set(0.62, 0.6, 0);
        g.position.set(x, heightAt(x, z), z);
        g.rotation.y = rand() * 3;
        B.add(g);
        B.hitBox(x, 0.5, z, 1.4, 1.0, 1.4);
        B.block(x, z, 0.7, 0.7);
      }
      // spaced so there is always a way round, never a pocket to get stuck in
      for (const [x, z] of [[86, -4.4], [89, 3.2], [93.5, 4.4], [94, -5.8]]) hedgehog(x, z);
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

    function hitGate(at, api) {
      if (gate.down) return false;
      if (Math.abs(at.x - GX) > 2.2 || Math.abs(at.z) > 3 || at.y > 3.6) return false;
      gate.hp--;
      const c = api.combat;
      const center = new THREE.Vector3(GX - 0.3, 1.3, 0);
      c.fx.burst(center, { count: 24, speed: 7, color: 0xffd36b, life: 0.4, size: 0.08, gravity: 12 });
      // buckle the leaves with the hit
      gate.leaves.forEach((l, i) => {
        l.hinge.rotation.z = -0.1;
        l.hinge.rotation.y = (i ? 1 : -1) * 0.08;
      });
      if (gate.hp > 0) {
        api.shake(0.2);
        api.prompt('Main gun', 'Good hit! One more!');
        return true;
      }
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
      return true;
    }

    // ------------------------------------------- depot doors (one per sector)
    // A roller door in a block's ground floor: closed until the sector is
    // clear, then it rolls up and the depot's lights show inside.
    function depotDoor(x) {
      const d = { x, open: 0, opening: false };
      const z = WALK.n + 0.05;
      // dark bay behind the door
      put(B.root, box(5.2, 3.3, 0.1, 0x0d0c0e), x, SW + 1.65, WALK.n - 0.2);
      for (const s of [-1, 1]) put(B.root, box(0.35, 3.6, 0.4, 0x45484c, { r: 0.03 }), x + s * 2.75, SW + 1.8, z + 0.1);
      put(B.root, box(5.9, 0.4, 0.45, 0x45484c, { r: 0.03 }), x, SW + 3.6, z + 0.1);
      const t = hazard.clone();
      t.needsUpdate = true;
      t.repeat.set(4, 0.5);
      const band = new THREE.Mesh(new THREE.PlaneGeometry(5.9, 0.36), new THREE.MeshToonMaterial({ map: t, gradientMap }));
      band.position.set(x, SW + 3.6, z + 0.34);
      B.add(band);
      const door = new THREE.Group();
      put(door, box(5.2, 3.3, 0.12, 0x56606a), 0, 1.65, 0);
      for (let y = 0.25; y < 3.2; y += 0.32) put(door, box(5.1, 0.05, 0.04, 0x434b54), 0, y, 0.08);
      door.position.set(x, SW, z + 0.12);
      B.add(door);
      B.keep(door);
      // warm light from inside once it's open, and a green go-lamp
      const inside = B.pool(x, WALK.n + 1.6, 2.6, 0xffa245, 0, { sx: 1.2, sz: 0.7, y: SW + 0.03 });
      const insideE = B.emit(new THREE.Vector3(x, 1.6, WALK.n + 1.4), 0xffa245, 16, 8, { level: 0 });
      const lamp = B.keep(put(B.root, box(0.3, 0.22, 0.12, 0x2a2b2e, { r: 0.03 }), x, SW + 4.0, z + 0.4));
      d.update = (dt, t2) => {
        if (d.opening && d.open < 1) d.open = Math.min(1, d.open + dt * 0.8);
        door.position.y = SW + d.open * 3.1;
        door.scale.y = 1 - d.open * 0.85;
        inside.material.opacity = 0.22 * d.open;
        insideE.level = d.open;
        lamp.material = d.opening && Math.sin(t2 * 6) > 0 ? glowMat(0x6be08a) : toon(0x2a2b2e);
      };
      B.animate((dt, t2) => d.update(dt, t2));
      return d;
    }
    const doorA = depotDoor(51);
    const doorB = depotDoor(110);

    // ---------------------------------- the bridgehead barricade (sector 2)
    // Wrecks chained across the approach to the bridge: too heavy to drive
    // through. A rocket ram (or a dozer blade) bursts each section.
    {
      const BX = 58.6;
      for (const [z0, z1] of [[WALK.n, -3.3], [-3.3, 3.3], [3.3, WALK.s + 1]]) {
        const zc = (z0 + z1) / 2;
        B.crushable(
          () => {
            const y = heightAt(BX, zc);
            P.car(B, BX, zc, Math.PI / 2 + (rand() - 0.5) * 0.3, { kind: rand() < 0.5 ? 'sedan' : 'hatch', paint: BURNT_PAINT[(rand() * 6) | 0], solidBlock: false, snow: false });
            const top = P.car(B, BX + 0.2, zc + 0.3, Math.PI / 2 + 0.4, { kind: 'hatch', paint: BURNT_PAINT[(rand() * 6) | 0], solidBlock: false, flipped: true, snow: false });
            top.position.y = 1.0 + y;
            top.rotation.z = 0.2;
            for (const s of [-1, 1]) {
              const j = put(B.root, box(0.7, 0.9, 1.6, 0x9a978f), BX + s * 1.1, y + 0.45, zc + s * 1.2);
              j.rotation.y = s * 0.4;
            }
            for (let i = 0; i < 6; i++) B.piece(0.3 + rand() * 0.5, 0.2, 0.3, CONCRETE[i % 5], BX + (rand() - 0.5) * 2.4, y + 0.1, zc + (rand() - 0.5) * (z1 - z0), rand(), rand() * 3, rand());
            put(B.root, box(0.12, 0.6, z1 - z0 - 0.4, 0xc99a2e), BX - 0.9, y + 1.0, zc).rotation.x = 0.05; // hazard rail
            B.hitBox(BX, y + 1.1, zc, 1.8, 2.2, z1 - z0);
            B.block(BX, zc, 1.0, (z1 - z0) / 2);
          },
          { kind: 'car', heavy: true, scrap: 3 },
        );
      }
    }

    // ------------------------------------- the end of the zone (east wall)
    {
      const X = 136;
      let i = 0;
      for (let z = -15; z < 20; z += 6.2, i++) {
        container(X, 0, z, Math.PI / 2, CONTAINERS[(i + 1) % 5]);
        if (i % 2 === 0) container(X + 0.1, 2.6, z + 0.3, Math.PI / 2, CONTAINERS[(i + 3) % 5]);
      }
      B.block(X, 2, 1.4, 22);
      rubble(X - 2.2, 4, 1.8, 1.2, { slabs: 2 });
      rubble(X - 2.0, -7, 1.4, 1.0, { slabs: 2 });
    }

    B.finish();
    B.mergeStatic();

    // the depot lives in this scene too, out of sight
    const depot = buildDepot(scene);
    const blocks = [...B.blocks, ...depot.blocks];
    const colliders = [...B.colliders, ...depot.colliders];
    const emitters = [...B.emitters, ...depot.emitters];

    // ---------------------------------------------------- the zone script
    // Three sectors with a depot stop between each:
    //  1 The avenue: learn to drive, shoot, crush, collect scrap
    //  2 The bridge: rocket-ram the barricade, cross, blow the gate
    //  3 The checkpoint: hold out, then the heavy machine
    const SECTORS = ['The avenue', 'The bridge', 'The checkpoint'];
    const B1 = { minX: START_X + 2, maxX: 57, minZ: -21, maxZ: 9.9 };
    const B2 = { minX: 44, maxX: GX + 12, minZ: -12, maxZ: 9.9 };
    const B3 = { minX: GX + 1.5, maxX: 133, minZ: -12, maxZ: 9.9 };
    const S = { sector: 0, step: 0, t: 0, spawnX: 0, n: 0, shots: 0, hold: 0, boss: null, waveT: 0 };
    const gateMark = new THREE.Vector3(GX - 0.3, 1.6, 0);
    let CLICK = '<kbd>Click</kbd>';
    const bounds = { ...B1 };
    const setBounds = (b) => Object.assign(bounds, b);
    // the arrow that follows the nearest machine
    const onEnemy = (api) => () => {
      const e = api.nearestEnemy();
      return e ? new THREE.Vector3(e.pos.x, 1.4 * e.stats.scale, e.pos.z) : null;
    };
    const go = (step) => {
      S.step = step;
      S.t = 0;
    };

    function start(api) {
      CLICK = api.touch ? '<kbd>Tap</kbd>' : '<kbd>Click</kbd>';
      Object.assign(S, { sector: 0, step: 0, t: 0, spawnX: api.tankPos.x, n: 0, hold: 0, boss: null });
      setBounds(B1);
      api.setBounds(bounds);
      gate.hp = 2;
      api.sectors(SECTORS, 0);
      api.objective('Drive up the street and destroy all enemies');
      if (api.touch) api.prompt('Controls', 'Use the <b>stick</b> in the bottom left to drive.');
      else api.prompt('Controls', 'Drive with <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or the arrow keys.');
      api.arrow(new THREE.Vector3(S.spawnX + 12, 0.4, 0), 'This way');
    }

    // ------------------------------------------------- sector 1: the avenue
    function sector1(api, dt) {
      const x = api.tankPos.x;
      const run = api.run;
      switch (S.step) {
        case 0:
          if (x > S.spawnX + 6) {
            api.prompt('Crush', 'Tanks <b>crush</b> wrecks and junk. Drive right through it!');
            api.arrow(new THREE.Vector3(-8, 1.6, -5.5), 'Crush it!');
            go(1);
          }
          break;
        case 1:
          if (run.crushed > 0 || x > -3 || S.t > 7) {
            api.arrow(null);
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
            api.prompt('Contact', `Enemies incoming! Destroy them with your <b>cannon</b>! ${api.touch ? `${CLICK} on one to fire.` : `Aim and ${CLICK} (or <kbd>Space</kbd>) to fire.`}`, { danger: true });
            api.arrow(onEnemy(api), api.touch ? `${CLICK} it!` : `${CLICK} to fire!`);
            api.spotlight({ targets: [onEnemy(api), () => api.tankPos.clone().setY(1)], r: 100 }, () => run.shots > S.shots, { maxTime: 20 });
            go(3);
          } else if (!e && S.t > 3) {
            // already dealt with (shot from long range): skip the lesson
            S.shots = -1;
            go(3);
          }
          break;
        }
        case 3:
          // after the first shot, while the cannon reloads, the MG takes over
          if (run.shots > S.shots && (api.mgActive || S.t > 4)) {
            api.prompt('Machine gun', 'Your <b>machine gun</b> automatically attacks enemies while your cannon reloads!');
            api.arrow(onEnemy(api), 'Auto MG');
            go(4);
          }
          break;
        case 4:
          // the first scrap on the ground
          if (run.drops > 0 && !api.spotlit) {
            const d = api.nearestDrop();
            if (d) {
              const at = d.clone();
              api.prompt('Scrap', 'Machines drop <b>scrap</b>. Drive close to collect it.', { go: true });
              api.spotlight({ targets: [at, () => api.tankPos.clone().setY(1)], r: 90 }, () => run.scrap > 0, { maxTime: 3.5 });
              go(5);
            }
          }
          if (api.enemiesAlive === 0 && S.t > 2 && run.drops === 0) go(5);
          break;
        case 5:
          if (api.enemiesAlive === 0 && S.t > 1.5) {
            api.arrow(null);
            api.spawnDog(40, -5.5, { delay: 0.5 });
            api.spawnDog(41, 4.5, { delay: 1.0 });
            api.spawnDog(43, 0, { delay: 1.4 });
            const out = [[22, -9], [18, -3]];
            api.spawnDog(22, -19, { delay: 2.5, via: out });
            api.spawnDog(23.5, -19.5, { delay: 3, via: out });
            api.prompt('Contact', 'More of them! Kill them in quick succession for a <b>chain</b>: more scrap per kill.', { danger: true });
            go(6);
          }
          break;
        case 6:
          if (api.enemiesAlive === 0 && S.t > 3 && x > 22) {
            api.clearPrompt();
            api.spawnDog(55, -4, { delay: 0.3 });
            api.spawnDog(55, 4, { delay: 0.6 });
            api.spawnDog(54, 0, { delay: 0.9 });
            api.spawnDog(x - 16, -4, { delay: 2 });
            api.spawnDog(x - 16, 4, { delay: 2.4 });
            api.prompt('Contact', 'They are coming from the bridge, and from behind!', { danger: true, seconds: 5 });
            go(7);
          } else if (api.enemiesAlive === 0 && S.t > 3 && S.n === 0) {
            S.n = 1;
            api.prompt('Orders', 'Push on up the street.');
            api.arrow(new THREE.Vector3(30, 0.4, 0), 'This way');
          }
          break;
        case 7:
          if (api.enemiesAlive === 0 && S.t > 3) {
            doorA.opening = true;
            api.objective('Enter the depot');
            api.prompt('Sector clear', 'Nice work. Get into the <b>depot</b> for repairs and parts.', { go: true });
            api.arrow(new THREE.Vector3(51, 1.6, WALK.n + 1), 'Depot');
            go(8);
          }
          break;
        case 8:
          if (doorA.open > 0.6 && Math.hypot(x - 51, api.tankPos.z - (WALK.n + 1)) < 3.6) {
            go(9);
            api.depot({ offers: ['dozer', 'autoloader', 'era'], gift: 'rockets', onLeave: () => startSector2(api) });
          }
          break;
      }
    }

    // ------------------------------------------------- sector 2: the bridge
    function startSector2(api) {
      S.sector = 1;
      go(0);
      setBounds(B2);
      api.setBounds(bounds);
      api.teleport(50, -6.2, 0);
      api.sectors(SECTORS, 1);
      api.objective('Break through and cross the bridge');
      api.prompt('Sector 2', 'Wrecks block the bridge. Too heavy to crush.', { danger: false });
      api.arrow(new THREE.Vector3(58.6, 1.8, 0), 'Barricade');
    }
    function sector2(api) {
      const x = api.tankPos.x;
      const run = api.run;
      switch (S.step) {
        case 0:
          if (S.t > 1.6 && !api.spotlit) {
            S.shots = run.boosts;
            api.prompt('Rockets', api.touch ? 'Tap the <b>rocket</b> button to boost and <b>ram</b> through the barricade!' : 'Press <kbd>Shift</kbd> (or right-click) to fire your rockets and <b>ram</b> through!', { go: true });
            api.spotlight({ targets: [new THREE.Vector3(58.6, 1.2, -0.5), api.abilityScreen()], r: 110 }, () => run.boosts > S.shots, { maxTime: 15 });
            go(1);
          }
          break;
        case 1:
          if (x > 61) {
            api.arrow(null);
            api.objective('Cross the bridge and destroy all enemies');
            api.prompt('Contact', 'Machines on the far bank! Rockets ram machines too.', { danger: true, seconds: 5 });
            api.spawnDog(82, -3);
            api.spawnDog(83, 2, { delay: 0.4 });
            api.spawnDog(84.5, 5, { delay: 0.8 });
            api.spawnDog(44, -4, { delay: 2.5 });
            api.spawnDog(44, 4, { delay: 3 });
            go(2);
          } else if (S.t > 6 && run.boosts > 0 && S.n !== 2) {
            S.n = 2;
            api.prompt('Rockets', 'Missed? The rockets recharge in a few seconds. Try again!', { seconds: 5 });
          }
          break;
        case 2:
          if (x > 79) {
            api.spawnDog(97.5, -7.5);
            api.spawnDog(97.5, 7.6, { delay: 0.4 });
            api.spawnDog(96, 0, { delay: 0.9 });
            api.spawnDog(92, -3, { delay: 1.5 });
            go(3);
          }
          break;
        case 3:
          if (x > 82 && api.enemiesAlive === 0 && S.t > 1) {
            api.objective('Blow down the checkpoint gate');
            api.prompt('Main gun', api.touch ? `${CLICK} the gate to fire at it. Two hits bring it down.` : `Aim at the gate and ${CLICK} to fire. Two hits bring it down.`);
            api.arrow(gateMark, `${CLICK} to shoot the gate!`);
            go(4);
          }
          break;
        // 4: waiting for the gate (onImpact)
        case 5:
          if (x > GX + 2) {
            doorB.opening = true;
            api.objective('Enter the depot');
            api.prompt('Sector clear', 'Through! Another <b>depot</b> on the left. Patch up before the checkpoint.', { go: true });
            api.arrow(new THREE.Vector3(110, 1.6, WALK.n + 1), 'Depot');
            go(6);
          }
          break;
        case 6:
          if (doorB.open > 0.6 && Math.hypot(x - 110, api.tankPos.z - (WALK.n + 1)) < 3.6) {
            go(7);
            const pool = ['twinmg', 'he', 'plating', 'dozer', 'autoloader', 'era'].filter((id) => !run.parts.includes(id));
            api.depot({ offers: pool.slice(0, 3), onLeave: () => startSector3(api) });
          }
          break;
      }
    }

    // --------------------------------------------- sector 3: the checkpoint
    const HOLD = 40;
    function startSector3(api) {
      S.sector = 2;
      go(0);
      setBounds(B3);
      api.setBounds(bounds);
      api.teleport(110, -6.4, -Math.PI / 2);
      api.sectors(SECTORS, 2);
      S.hold = HOLD;
      S.waveT = 1.5;
      S.n = 0;
      api.objective(`Hold the checkpoint: 0:${HOLD}`);
      api.prompt('Sector 3', 'They know we are here. <b>Hold the checkpoint</b> until the street is ours.', { danger: true, seconds: 6 });
    }
    function sector3(api, dt) {
      switch (S.step) {
        case 0: {
          S.hold -= dt;
          S.waveT -= dt;
          const sec = Math.max(0, Math.ceil(S.hold));
          api.objective(`Hold the checkpoint: 0:${String(sec).padStart(2, '0')}`);
          if (S.waveT <= 0 && S.hold > 4 && api.enemiesAlive < 7) {
            S.waveT = 5.5;
            S.n++;
            const k = S.n % 3;
            if (k === 1) {
              api.spawnDog(133, -6);
              api.spawnDog(133, 0, { delay: 0.3 });
              api.spawnDog(133, 6, { delay: 0.6 });
            } else if (k === 2) {
              api.spawnDog(95, -2, { via: [[GX + 3, 0]] });
              api.spawnDog(95, 2, { delay: 0.4, via: [[GX + 3, 0]] });
              api.spawnDog(132, 7, { delay: 1 });
            } else {
              api.spawnDog(133, -3);
              api.spawnDog(133, 3, { delay: 0.3 });
              api.spawnDog(130, -8, { delay: 0.8 });
              api.spawnDog(95, 0, { delay: 1.2, via: [[GX + 3, 0]] });
            }
          }
          if (S.hold <= 0) {
            api.objective('Destroy all enemies');
            go(1);
          }
          break;
        }
        case 1:
          if (api.enemiesAlive === 0) {
            api.objective('Destroy the heavy machine');
            S.boss = api.spawnHound(134, 0);
            api.spawnDog(133, -6, { delay: 1.5 });
            api.spawnDog(133, 6, { delay: 2 });
            api.boss(S.boss, 'Hound');
            api.prompt('Warning', 'A <b>heavy machine</b>! Pound it with the cannon. Ram it when it gets close!', { danger: true, seconds: 7 });
            api.spotlight({ targets: [() => (S.boss.alive ? new THREE.Vector3(S.boss.pos.x, 1.6, S.boss.pos.z) : null), () => api.tankPos.clone().setY(1)], r: 120 }, () => S.t > 0.5, { maxTime: 2.5 });
            go(2);
          }
          break;
        case 2:
          if (!S.boss.alive) {
            api.prompt('Zone clear', 'The heavy machine is down. <b>Zone 1 is ours.</b>', { go: true });
            api.objective('');
            go(3);
          }
          break;
        case 3:
          if (S.t > 3.2 && api.enemiesAlive === 0) {
            api.win('Zone 1 cleared');
            go(4);
          } else if (S.t > 3.2 && S.n !== -1) {
            S.n = -1;
            api.objective('Destroy all enemies');
          }
          break;
      }
    }

    function script(api, dt) {
      S.t += dt;
      if (api.run.mode !== 'field') return;
      if (S.sector === 0) sector1(api, dt);
      else if (S.sector === 1) sector2(api, dt);
      else sector3(api, dt);
    }
    function onImpact(at, mesh, api) {
      if (!hitGate(at, api) || !gate.down) return;
      api.objective('Drive through the gate');
      api.prompt('Breakthrough', 'The gate is down. Drive through!', { seconds: 5 });
      api.arrow(new THREE.Vector3(GX + 5, 0.4, 0), 'Go!');
      if (S.sector === 1) go(5);
    }

    function update(dt, t, ctx = {}) {
      B.update(dt, t, ctx);
      depot.update(dt, t, ctx);
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
      colliders,
      blocks,
      emitters,
      crushables: B.crushables,
      depot,
      heightAt: (x, z) => (z > 100 ? 0 : heightAt(x, z)),
      spawn: { x: START_X + 7, z: -0.5, yaw: 0 },
      bounds,
      script: S, // for tests
      start,
      onImpact,
      update,
    };
  }
}
