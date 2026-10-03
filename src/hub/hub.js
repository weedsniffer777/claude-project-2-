// The base between runs: a bunker under the city, seen whole from the usual
// corner. Three rooms off a central hall:
//  - quarters (back left): bunks, lockers, a stove going
//  - briefing (front left): the CIC table, where you pick where to go next
//  - hangar (right): the tank up on its lift, the workshop round it
//
// Hover a room and it lights its outline; click it (anywhere in it) and the
// camera eases in and its screen opens straight away, wherever the crewman
// is. Walking into a room opens it too. The crewman walks with WASD /
// arrows, or click the hall floor where to go. Esc or Back closes a screen.
import * as THREE from 'three';
import { LevelBuilder, canvas, tex, blob, speckle } from '../levels/builder.js';
import { box, cyl, put, toon, gradientMap, setLowPoly, approachAngle } from '../models/kit.js';
import { createCrew } from '../models/crew.js';
import { createTank } from '../models/tank.js';
import { pushOut } from '../game/collide.js';
import { PLAYER_LAYER } from '../render/pixel.js';
import { CURSOR } from '../game/hud.js';

const VIEW_FAR = 23; // the whole base in view
const ROWS = 680; // pixel rows (fixed, so the pixels don't swim as the camera zooms)
const CAM_OFFSET = new THREE.Vector3(-10, 8.2, 10).multiplyScalar(4);
const WALK = 3.4;
const H = 4.2; // wall height
const HH = 5.2; // the hangar's
const SODIUM = 0xffa245;
const HOLO = 0x5fe0f0;
const INPUT_FORWARD = new THREE.Vector3(1, 0, -1).normalize();
const INPUT_RIGHT = new THREE.Vector3(1, 0, 1).normalize();
const BASE_CENTER = new THREE.Vector3(7.5, 0, -3.2);
export const BANK_KEY = 'scavenger.bank';

// The tank's own name: no real-world designations anywhere on screen.
const TANK = { name: 'Battle tank', blurb: 'Old, slow to start, hard to kill. Everything on it has been replaced at least once.' };

// The campaign: the levels in order, bottom of the map to the top. Each
// level is made of zones (the avenue, the bridge, ...). Only the first is
// scouted.
const LEVELS = [
  { n: 1, id: 'avenue', name: 'Ruined city street', at: [0.3, 0.84], open: true, text: 'Panel blocks along a wide avenue, a bridge over the river and the intersection beyond. A large quadruped holds it.', zones: ['The avenue', 'The bridge', 'The intersection'], threats: ['Quadruped walkers', 'Large quadruped'] },
  { n: 2, name: 'Not scouted', at: [0.66, 0.62], text: 'Across the river. Clear level 1 to scout it.' },
  { n: 3, name: 'Not scouted', at: [0.34, 0.38], text: 'Clear level 2 to scout it.' },
  { n: 4, name: 'Not scouted', at: [0.68, 0.15], text: 'Clear level 3 to scout it.' },
];

const CSS = `
.base { position: fixed; inset: 0; pointer-events: none; z-index: 10; color: #f1e9d8; font: 400 15px/1.3 'Pixelify Sans', 'Silkscreen', ui-monospace, monospace; --amber: #ffb347; --holo: #5fe0f0; }
.base .panel { background: rgba(12, 11, 13, 0.88); box-shadow: 0 0 0 2px #000, 0 0 0 4px #f1e9d8, 4px 4px 0 4px #000; }
.base .px { font-family: 'Silkscreen', 'Pixelify Sans', monospace; text-transform: uppercase; letter-spacing: 0.06em; }
.base-bank { position: absolute; left: 50%; top: calc(14px + env(safe-area-inset-top, 0px)); transform: translateX(-50%); padding: 6px 14px; display: flex; gap: 10px; align-items: center; font-size: 14px; color: var(--amber); }
.base-bank i { width: 10px; height: 14px; background: var(--amber); clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); }
.base-bank b { font-weight: 400; color: #f1e9d8; font-variant-numeric: tabular-nums; }
.base-tag { position: absolute; left: 0; top: 0; transform: translate(-50%, -100%); padding: 3px 8px 4px; font: 400 11px/1 'Silkscreen', monospace; text-transform: uppercase;
  color: var(--amber); background: rgba(12, 11, 13, 0.75); box-shadow: 0 0 0 2px #000; white-space: nowrap; pointer-events: auto; cursor: var(--cursor); }
.base-tag.hot { color: #111; background: var(--amber); }
.base-menu { position: absolute; right: calc(24px + env(safe-area-inset-right, 0px)); top: 50%; transform: translateY(-50%); width: min(340px, calc(100vw - 48px)); padding: 16px 18px 18px;
  display: grid; gap: 12px; pointer-events: auto; }
.base h2 { margin: 0; font: 400 20px/1.1 'Silkscreen', monospace; text-transform: uppercase; color: var(--amber); }
.base .sub { margin: -6px 0 0; color: #b9b0a0; font-size: 13px; }
.base .zone { display: grid; gap: 6px; padding: 10px 12px 12px; background: #1d1b1e; box-shadow: 0 0 0 2px #000, 0 0 0 4px #6d655a; }
.base .zone.locked { opacity: 0.5; }
.base .zone b { font: 400 13px/1.1 'Silkscreen', monospace; text-transform: uppercase; color: var(--amber); font-weight: 400; }
.base .zone span { font-size: 13px; color: #d8d0c0; }
.base button.go, .base button.back { justify-self: start; padding: 8px 16px 9px; border: 0; cursor: var(--cursor); font: 400 13px/1 'Silkscreen', monospace; text-transform: uppercase; color: #111; background: #6be08a; box-shadow: 0 3px 0 #2f6b40; }
.base button.back { background: #2a2628; color: #f1e9d8; box-shadow: 0 0 0 2px #000, 0 0 0 4px #6d655a; }
.base button:hover { filter: brightness(1.15); }
.base button:disabled { filter: grayscale(1) brightness(0.6); }
.base .stats { display: grid; grid-template-columns: auto 1fr; gap: 6px 10px; align-items: center; font-size: 12px; color: #b9b0a0; }
.base .stats i { display: block; height: 8px; background: linear-gradient(90deg, var(--amber) var(--v), #2a2628 var(--v)); box-shadow: 0 0 0 2px #000; }
/* briefing: the campaign map in the middle, the zone's details to its right */
.base-brief { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 22px; padding: 64px 24px 24px; pointer-events: auto; background: rgba(5, 9, 12, 0.55); }
.base-brief .map { position: relative; height: min(78vh, 680px); aspect-ratio: 2 / 3; box-shadow: 0 0 0 2px #000, 0 0 0 4px #d8d4cb, 4px 4px 0 4px #000; }
.base-brief .map canvas { position: static; inset: auto; width: 100%; height: 100%; display: block; image-rendering: pixelated; }
.base-brief .node { position: absolute; transform: translate(-50%, -50%); width: 34px; height: 34px; border: 0; padding: 0; cursor: var(--cursor); font: 400 15px/1 'Silkscreen', monospace;
  color: #141416; background: #f1e9d8; box-shadow: 0 0 0 2px #000; }
.base-brief .node.open { background: var(--amber); box-shadow: 0 0 0 2px #000, 0 0 0 4px #f1e9d8, 0 0 16px #ffb347aa; }
.base-brief .node.locked { background: #3a3b3f; color: #8a8a8e; box-shadow: 0 0 0 2px #000, 0 0 0 4px #7a2a26; }
.base-brief .node.sel { outline: 3px solid #f1e9d8; outline-offset: 3px; }
.base-brief .info { width: min(300px, 32vw); padding: 16px 18px 18px; display: grid; gap: 10px; align-self: center; }
.base-brief .info .tagline { font-size: 11px; color: #ff6a5a; }
.base-brief .info p { margin: 0; font-size: 13px; color: #d8d0c0; }
.base-brief .info ul { margin: 0; padding: 0 0 0 14px; font-size: 13px; color: #d8d0c0; }
.base-brief .info .row { display: flex; gap: 10px; flex-wrap: wrap; }
@media (max-width: 760px) {
  .base-brief { flex-direction: column; gap: 14px; padding: 56px 16px 16px; overflow-y: auto; justify-content: flex-start; }
  .base-brief .map { width: 100%; height: auto; }
  .base-brief .info { width: auto; align-self: stretch; }
}
.base-hint { position: absolute; left: 50%; bottom: calc(18px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); padding: 6px 12px; font-size: 13px; color: #b9b0a0; white-space: nowrap; }
.base-fade { position: absolute; inset: 0; background: #070609; opacity: 1; transition: opacity 0.45s steps(5); }
.base-fade.off { opacity: 0; }
.base [hidden] { display: none !important; }
`;

// ------------------------------------------------------------- textures
function floorTexture(rand, w, d, { base = '#4f4d4a', specks = ['#55534f', '#47453f', '#5b5954'], seam = '#403e3b', tile = 3, stains = 0.15 } = {}) {
  const S = 10;
  const [c, g] = canvas(w * S, d * S);
  g.fillStyle = base;
  g.fillRect(0, 0, c.width, c.height);
  speckle(g, c.width, c.height, specks, c.width * c.height * 0.05, rand);
  g.fillStyle = seam;
  for (let x = 0; x < c.width; x += tile * S) g.fillRect(x, 0, 1, c.height);
  for (let y = 0; y < c.height; y += tile * S) g.fillRect(0, y, c.width, 1);
  for (let i = 0; i < w * d * stains; i++) {
    g.fillStyle = rand() < 0.5 ? '#383633' : '#3f3c38';
    blob(g, rand() * c.width, rand() * c.height, 6 + rand() * 20, 4 + rand() * 14, rand, 11);
  }
  return tex(c);
}
// plank floor for the quarters
function planksTexture(rand, w, d) {
  const S = 10;
  const [c, g] = canvas(w * S, d * S);
  const tones = ['#5a4632', '#54412e', '#614b35', '#4e3c2a'];
  for (let y = 0; y < c.height; y += 5) {
    let x = -((rand() * 40) | 0);
    while (x < c.width) {
      const len = 30 + ((rand() * 40) | 0);
      g.fillStyle = tones[(rand() * tones.length) | 0];
      g.fillRect(x, y, len, 5);
      g.fillStyle = '#3a2c1f';
      g.fillRect(x, y, 1, 5);
      x += len;
    }
    g.fillStyle = '#3a2c1f';
    g.fillRect(0, y + 4, c.width, 1);
  }
  speckle(g, c.width, c.height, ['#6a5440', '#46362a'], c.width * c.height * 0.02, rand);
  return tex(c);
}

// The CIC table's glass: a lit map in cold glowing lines.
function holoTexture(rand) {
  const [c, g] = canvas(128, 80);
  g.fillStyle = '#06161c';
  g.fillRect(0, 0, 128, 80);
  g.fillStyle = '#0d2c36';
  for (let x = 0; x < 128; x += 8) g.fillRect(x, 0, 1, 80);
  for (let y = 0; y < 80; y += 8) g.fillRect(0, y, 128, 1);
  // contour rings
  g.strokeStyle = '#13505e';
  g.lineWidth = 1;
  for (let k = 0; k < 4; k++) {
    g.beginPath();
    g.ellipse(92, 26, 10 + k * 7, 6 + k * 5, 0.4, 0, Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = '#16465a';
  for (let i = 0; i < 46; i++) g.fillRect((rand() * 124) | 0, (rand() * 76) | 0, 2 + rand() * 7, 2 + rand() * 5); // blocks
  g.fillStyle = '#2aa6c4';
  g.fillRect(0, 44, 128, 2); // the avenue
  g.fillRect(84, 0, 2, 80); // the cross road
  g.fillStyle = '#1d6f86';
  for (let y = 0; y < 80; y++) g.fillRect(50 + Math.round(Math.sin(y / 9) * 4), y, 5, 1); // the river
  g.fillStyle = '#9ef2ff';
  for (let x = 6; x < 84; x += 4) g.fillRect(x, 42, 2, 1); // the route
  g.fillStyle = '#ffb347';
  for (const [x, y] of [[12, 45], [44, 45], [70, 45], [86, 45]]) g.fillRect(x - 1, y - 2, 3, 3);
  g.fillStyle = '#ff3b2f';
  g.fillRect(96, 40, 3, 3);
  // frame ticks
  g.fillStyle = '#5fe0f0';
  for (let x = 0; x < 128; x += 16) {
    g.fillRect(x, 0, 1, 3);
    g.fillRect(x, 77, 1, 3);
  }
  return tex(c);
}

// The briefing screen's campaign map, drawn small and shown big: a grey
// city plan in white roads, the river through it, enemy ground hatched red,
// the route north from level to level.
function campaignMap() {
  const W = 160;
  const Hc = 240;
  const [c, g] = canvas(W, Hc);
  let seed = 41;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  g.fillStyle = '#1b1c1f';
  g.fillRect(0, 0, W, Hc);
  g.fillStyle = '#232428';
  for (let x = 0; x < W; x += 10) g.fillRect(x, 0, 1, Hc);
  for (let y = 0; y < Hc; y += 10) g.fillRect(0, y, W, 1);
  // city blocks, in districts
  for (const [cx, cy, n, r] of [[44, 200, 46, 30], [110, 150, 40, 30], [50, 92, 40, 28], [112, 40, 34, 26], [130, 214, 14, 16], [20, 140, 16, 16]]) {
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * r;
      g.fillStyle = ['#3a3b3f', '#44454a', '#34353a'][(rand() * 3) | 0];
      g.fillRect((cx + Math.cos(a) * d) | 0, (cy + Math.sin(a) * d * 0.9) | 0, 3 + ((rand() * 6) | 0), 2 + ((rand() * 5) | 0));
    }
  }
  // the river, winding across low down
  const riverY = (x) => 172 + Math.sin(x / 22) * 10 + Math.sin(x / 7) * 2;
  g.fillStyle = '#2b3740';
  for (let x = 0; x < W; x++) g.fillRect(x, riverY(x) | 0, 1, 6);
  // roads in off-white: the avenue up the middle, cross streets
  g.fillStyle = '#c9c6bd';
  for (let y = 0; y < Hc; y++) g.fillRect((48 + Math.sin(y / 30) * 6) | 0, y, 2, 1);
  for (const y of [60, 128, 206]) g.fillRect(0, y, W, 1);
  g.fillStyle = '#8a877f';
  for (let x = 0; x < W; x++) g.fillRect(x, (20 + x * 0.25) | 0, 1, 1);
  // enemy ground: red hatching over the north, the front line dashed
  g.fillStyle = '#5a1f1c';
  for (let y = 0; y < 118; y += 4) for (let x = (y / 2) % 4 | 0; x < W; x += 6) if (rand() < 0.8) g.fillRect(x, y, 1, 1);
  g.fillStyle = '#ff3b2f';
  for (let x = 0; x < W; x += 6) g.fillRect(x, (118 + Math.sin(x / 15) * 4) | 0, 4, 1);
  for (const [x, y] of [[40, 186], [70, 196], [58, 176], [118, 140], [92, 160], [44, 80], [120, 30]]) {
    g.fillRect(x - 1, y - 1, 1, 1);
    g.fillRect(x + 1, y - 1, 1, 1);
    g.fillRect(x, y, 1, 1);
    g.fillRect(x - 1, y + 1, 1, 1);
    g.fillRect(x + 1, y + 1, 1, 1);
  }
  // the route between the levels: dashed white
  g.fillStyle = '#f1e9d8';
  for (let i = 0; i < LEVELS.length - 1; i++) {
    const [ax, ay] = LEVELS[i].at;
    const [bx, by] = LEVELS[i + 1].at;
    for (let s = 0; s <= 40; s += 2) {
      const t = s / 40;
      g.fillRect(Math.round((ax + (bx - ax) * t) * W), Math.round((ay + (by - ay) * t) * Hc), 2, 2);
    }
  }
  // north arrow and corner brackets
  g.fillStyle = '#d8d4cb';
  g.fillRect(W - 12, 8, 1, 10);
  g.fillRect(W - 13, 9, 3, 1);
  g.fillRect(W - 14, 10, 5, 1);
  for (const [x, y, sx, sy] of [[2, 2, 1, 1], [W - 3, 2, -1, 1], [2, Hc - 3, 1, -1], [W - 3, Hc - 3, -1, -1]]) {
    g.fillRect(Math.min(x, x + sx * 8), y, 8, 1);
    g.fillRect(x, Math.min(y, y + sy * 8), 1, 8);
  }
  return c;
}

export function createHub({ renderer, pixel, onDeploy }) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);

  // ------------------------------------------------------------ scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0a0e);
  setLowPoly(true);
  const B = new LevelBuilder(scene, 777);
  const rand = B.rand;
  scene.add(new THREE.HemisphereLight(0x6c7590, 0x1c1814, 1.15));
  const key = new THREE.DirectionalLight(0xffe0b8, 0.8);
  key.position.set(0, 16, 8);
  key.target.position.set(6, 0, -5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 50 });
  scene.add(key, key.target);

  // ------------------------------------------------------------ rooms
  // rect: [x0, x1, z0, z1]. Walls toward the camera (west and south) are
  // kept low, the far ones full height.
  const ROOMS = [
    { id: 'quarters', name: 'Quarters', rect: [-8, 4, -17, -6], focus: new THREE.Vector3(-2, 0, -11.5), view: 12, label: new THREE.Vector3(-2, 4.4, -16.8), entry: new THREE.Vector3(1, 0, -7.2) },
    { id: 'briefing', name: 'Briefing', rect: [-12, -2, -5, 7], focus: new THREE.Vector3(-7, 0, 1), view: 11, label: new THREE.Vector3(-7, 3.0, -4.6), entry: new THREE.Vector3(-3.2, 0, 1.5) },
    { id: 'hangar', name: 'Hangar', rect: [6, 24, -8, 8], focus: new THREE.Vector3(15, 0, 0), view: 14, label: new THREE.Vector3(15, 5.8, -7.8), entry: new THREE.Vector3(7.4, 0, 0.5) },
  ];
  const HALL = [-2, 6, -6, 8];
  const floorMeshes = [];
  const floor = (rect, map, room = null) => {
    const [x0, x1, z0, z1] = rect;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), new THREE.MeshToonMaterial({ map, gradientMap }));
    m.rotation.x = -Math.PI / 2;
    m.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    m.receiveShadow = true;
    m.userData.room = room;
    B.add(m);
    floorMeshes.push(m);
    return m;
  };
  const size = (r) => [r[1] - r[0], r[3] - r[2]];
  floor(ROOMS[0].rect, planksTexture(rand, ...size(ROOMS[0].rect)), ROOMS[0]);
  floor(ROOMS[1].rect, floorTexture(rand, ...size(ROOMS[1].rect), { base: '#3f4a48', specks: ['#46524f', '#38423f'], seam: '#323b39', tile: 1.5, stains: 0.05 }), ROOMS[1]);
  floor(ROOMS[2].rect, floorTexture(rand, ...size(ROOMS[2].rect), { stains: 0.25 }), ROOMS[2]);
  floor(HALL, floorTexture(rand, ...size(HALL), { base: '#4a4844', tile: 2 }));
  floor([-12, -2, -6, -5], floorTexture(rand, 10, 1, {})); // under the broken wall
  const under = new THREE.Mesh(new THREE.PlaneGeometry(120, 90), toon(0x141316));
  under.rotation.x = -Math.PI / 2;
  under.position.set(6, -0.02, -5);
  B.add(under);

  const WALL = 0x6f6c66;
  const wall = (x0, z0, x1, z1, h = H) => {
    const w = Math.max(0.4, Math.abs(x1 - x0));
    const d = Math.max(0.4, Math.abs(z1 - z0));
    const m = B.chunk(w, h, d, WALL, (x0 + x1) / 2, h / 2, (z0 + z1) / 2);
    B.block((x0 + x1) / 2, (z0 + z1) / 2, w / 2, d / 2);
    if (h > 2) B.piece(w + 0.01, 1.2, d + 0.01, 0x4e5a52, (x0 + x1) / 2, 0.6, (z0 + z1) / 2);
    B.piece(w + 0.02, 0.08, d + 0.02, 0x8d8b86, (x0 + x1) / 2, h, (z0 + z1) / 2);
    return m;
  };
  // tall far walls
  wall(-8, -17.2, 4, -17.2); // quarters back
  wall(4.2, -17, 4.2, -6); // quarters' east side
  wall(4, -6.2, 6, -6.2); // hall back
  wall(6, -8.2, 24, -8.2, HH); // hangar back
  wall(5.8, -8, 5.8, -4, HH); // hangar / hall
  wall(24.2, -8, 24.2, -3.4, HH); // hangar east, either side of the blast door
  wall(24.2, 3.4, 24.2, 8, HH);
  B.chunk(0.4, HH - 4, 6.8, WALL, 24.2, 4 + (HH - 4) / 2, 0);
  // low walls toward the camera (cutaway)
  wall(-8.2, -17, -8.2, -6, 0.9);
  wall(-12.2, -5, -12.2, 7, 0.9);
  wall(-12, 7.2, -2, 7.2, 0.9);
  wall(-2, 8.2, 6, 8.2, 0.9);
  wall(6, 8.2, 24, 8.2, 0.9);
  wall(5.8, 5, 5.8, 8, 0.9);
  // the broken wall between quarters and briefing: a ragged top, rubble
  {
    const z = -5.5;
    let x = -12;
    while (x < -2) {
      const w = Math.min(-2 - x, 0.8 + rand() * 1.2);
      const h = 1.2 + rand() * 1.6;
      B.chunk(w, h, 0.5, WALL, x + w / 2, h / 2, z);
      B.piece(w, 0.6, 0.52, 0x4e5a52, x + w / 2, 0.3, z);
      x += w;
    }
    B.block(-7, z, 5, 0.3);
    for (let i = 0; i < 10; i++) B.lump(-11 + rand() * 9, 0.12, z + (rand() < 0.5 ? -0.6 : 0.6), 0.22 + rand() * 0.2, 0.14, 0.2, 0x6f6c66, rand() * 3);
  }
  // pillars at the openings
  for (const [x, z, h] of [[-2, -5.5, H], [-2, 7, 0.9], [4, -6, H], [5.8, -4, HH], [5.8, 5, HH]]) {
    B.chunk(0.6, h + 0.2, 0.6, 0x8d8b86, x, (h + 0.2) / 2, z);
    B.block(x, z, 0.3, 0.3);
  }

  // ceiling beams with pendant lamps hung off them (no lamps in mid-air)
  const pendant = (x, z, beamY, drop = 1.2, warm = SODIUM, power = 14) => {
    B.line([new THREE.Vector3(x, beamY, z), new THREE.Vector3(x, beamY - drop, z)]);
    put(B.root, cyl(0.28, 0.16, 0x2e3034, { seg: 8, radiusEnd: 0.1 }), x, beamY - drop - 0.04, z);
    put(B.root, cyl(0.16, 0.05, warm, { seg: 8, glow: true }), x, beamY - drop - 0.12, z);
    B.emit(new THREE.Vector3(x, beamY - drop - 0.6, z), warm, power, 8);
    B.pool(x, z, 2.4, warm, 0.14);
  };
  const beamZ = (x, z0, z1, y) => {
    B.chunk(0.26, 0.3, z1 - z0, 0x3a3c3f, x, y, (z0 + z1) / 2);
    B.piece(0.4, 0.05, z1 - z0, 0x2c2e31, x, y - 0.16, (z0 + z1) / 2);
  };
  const beamX = (z, x0, x1, y) => {
    B.chunk(x1 - x0, 0.3, 0.26, 0x3a3c3f, (x0 + x1) / 2, y, z);
    B.piece(x1 - x0, 0.05, 0.4, 0x2c2e31, (x0 + x1) / 2, y - 0.16, z);
  };

  // -------------------------------------------------------------- props
  const crate = (x, y, z, s = 0.8, color = 0x7a5f3e, yaw = 0) => {
    const g = new THREE.Group();
    put(g, box(s, s * 0.8, s, color, { r: 0.02 }), 0, s * 0.4, 0);
    for (const dz of [-1, 1]) put(g, box(s + 0.02, 0.06, 0.06, 0x5c472e, { r: 0.01 }), 0, s * 0.4, dz * (s / 2 - 0.03));
    g.position.set(x, y, z);
    g.rotation.y = yaw;
    return B.add(g);
  };
  // an ammo box, open with the rounds in it, or shut
  const ammoBox = (x, z, yaw, open = true) => {
    const g = new THREE.Group();
    put(g, box(1.1, 0.34, 0.5, 0x4f5a3a, { r: 0.02 }), 0, 0.17, 0);
    put(g, box(1.0, 0.04, 0.44, 0x2b2c2a), 0, 0.34, 0);
    if (open) {
      for (let i = 0; i < 4; i++) {
        put(g, cyl(0.055, 0.7, 0xb08a3e, { axis: 'x', seg: 8 }), -0.08, 0.36, -0.15 + i * 0.1);
        put(g, cyl(0.05, 0.22, 0x3f4144, { axis: 'x', seg: 8, radiusEnd: 0.02 }), 0.4, 0.36, -0.15 + i * 0.1);
      }
      put(g, box(1.1, 0.04, 0.5, 0x4f5a3a, { r: 0.01 }), 0, 0.5, -0.36).rotation.x = -1.1; // the lid up
    } else put(g, box(1.12, 0.05, 0.52, 0x46502f, { r: 0.01 }), 0, 0.36, 0);
    put(g, box(0.3, 0.02, 0.01, 0xc9b98a), 0.2, 0.2, 0.255); // stencilled band
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    return B.add(g);
  };
  const shell = (x, z, yaw, up = false) => {
    const g = new THREE.Group();
    put(g, cyl(0.06, 0.6, 0xb08a3e, { seg: 8 }), 0, 0.3, 0);
    put(g, cyl(0.055, 0.2, 0x3f4144, { seg: 8, radiusEnd: 0.015 }), 0, 0.7, 0);
    g.position.set(x, up ? 0 : 0.06, z);
    if (!up) g.rotation.set(0, yaw, Math.PI / 2);
    return B.add(g);
  };
  const roadWheel = (x, y, z, yaw = 0, lean = 0) => {
    const g = new THREE.Group();
    put(g, cyl(0.42, 0.16, 0x4a4f3a, { axis: 'z', seg: 12 }), 0, 0, 0);
    put(g, cyl(0.44, 0.1, 0x1f2022, { axis: 'z', seg: 12 }), 0, 0, 0); // rubber tyre
    put(g, cyl(0.12, 0.2, 0x3a3c3f, { axis: 'z', seg: 8 }), 0, 0, 0);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      put(g, box(0.06, 0.06, 0.18, 0x3a4030), Math.cos(a) * 0.26, Math.sin(a) * 0.26, 0);
    }
    g.position.set(x, y, z);
    g.rotation.set(lean, yaw, 0, 'YXZ');
    return B.add(g);
  };
  const drum = (x, z, color = 0x6b5843, tipped = false) => {
    const m = put(B.root, cyl(0.3, 0.85, color, { seg: 10 }), x, tipped ? 0.3 : 0.425, z);
    if (tipped) m.rotation.set(Math.PI / 2, 0, rand() * 3);
    else put(B.root, cyl(0.31, 0.04, 0x2b2c2e, { seg: 10 }), x, 0.6, z);
    B.block(x, z, 0.32, 0.32);
    return m;
  };
  // tall steel shelving, loaded with 'parts', 'boxes' or 'files'
  const shelving = (x, z, yaw, w = 2.2, fill = 'boxes', levels = 4) => {
    const g = new THREE.Group();
    const D = 0.55;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(g, box(0.05, levels * 0.55 + 0.1, 0.05, 0x5a5e62), sx * (w / 2 - 0.03), (levels * 0.55 + 0.1) / 2, sz * (D / 2 - 0.03));
    for (let l = 0; l < levels; l++) {
      const y = 0.12 + l * 0.55;
      put(g, box(w, 0.04, D, 0x4a4e52), 0, y, 0);
      let px = -w / 2 + 0.1;
      while (px < w / 2 - 0.25) {
        const r = rand();
        const pw = 0.18 + rand() * 0.4;
        if (px + pw > w / 2 - 0.08) break;
        if (r < 0.15) {
          px += pw;
          continue;
        }
        const cx = px + pw / 2;
        if (fill === 'files') {
          const n = 2 + ((rand() * 4) | 0);
          for (let k = 0; k < n; k++) put(g, box(0.06, 0.32 + rand() * 0.06, 0.34, [0xa89f84, 0x6d7a6a, 0x8a6a4a, 0x5a6a7a][(rand() * 4) | 0], { r: 0.005 }), px + k * 0.07, y + 0.2, 0).rotation.z = k === n - 1 ? 0.25 : 0;
          px += n * 0.07 + 0.08;
          continue;
        }
        if (fill === 'parts' && r < 0.4) {
          put(g, cyl(0.18, 0.12, 0x3f4436, { axis: 'z', seg: 10 }), cx, y + 0.2, 0); // a sprocket ring
        } else if (fill === 'parts' && r < 0.6) {
          put(g, cyl(0.1, 0.25, [0x8a5a3a, 0x56604f, 0x6a6e72][(rand() * 3) | 0], { seg: 8 }), cx, y + 0.15, 0); // cans
          put(g, cyl(0.1, 0.25, 0x56604f, { seg: 8 }), cx + 0.12, y + 0.15, 0.1);
        } else {
          const h = 0.18 + rand() * 0.25;
          put(g, box(pw, h, 0.4, [0x7a5f3e, 0x6b6045, 0x8a8172, 0x4f5a3a][(rand() * 4) | 0], { r: 0.01 }), cx, y + 0.02 + h / 2, 0);
        }
        px += pw + 0.05;
      }
    }
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    B.add(g);
    const along = Math.abs(Math.cos(yaw)) > 0.5;
    B.block(x, z, along ? w / 2 : D / 2, along ? D / 2 : w / 2);
    return g;
  };
  // loose sheets of paper on a surface
  const papers = (x, y, z, n = 3) => {
    for (let i = 0; i < n; i++) B.piece(0.26, 0.01, 0.34, [0xe2dccb, 0xd2c9b0, 0xc4b896][i % 3], x + (rand() - 0.5) * 0.3, y + 0.005 + i * 0.004, z + (rand() - 0.5) * 0.3, 0, rand() * 1.4, 0);
  };
  const table = (x, z, w, d, h = 0.8, color = 0x4a3a2a) => {
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.piece(0.08, h, 0.08, 0x3a3c3f, x + sx * (w / 2 - 0.1), h / 2, z + sz * (d / 2 - 0.1));
    B.chunk(w, 0.08, d, color, x, h, z);
    B.block(x, z, w / 2, d / 2);
    return h + 0.04;
  };

  // -------------------------------------------------------- the hangar
  const tank = createTank();
  {
    const lx = 15;
    const lz = 0;
    // the lift, hazard-striped, and the painted bay round it
    B.chunk(6.8, 0.3, 4.6, 0x3d4044, lx, 0.15, lz);
    for (const s of [-1, 1]) B.piece(6.8, 0.04, 0.25, 0xc99a2e, lx, 0.32, lz + s * 2.15);
    for (let i = 0; i < 9; i++) B.piece(0.28, 0.02, 0.5, i % 2 ? 0x1f2022 : 0xc99a2e, lx - 4.1, 0.015, lz - 2.4 + i * 0.6);
    for (const s of [-1, 1]) B.piece(9.2, 0.02, 0.12, 0xc99a2e, lx, 0.015, lz + s * 3.4);
    B.block(lx, lz, 3.4, 2.3);
    tank.group.position.set(lx, 0.3, lz);
    tank.group.rotation.y = Math.PI * 0.86;
    tank.update(0.016, 0, {});
    scene.add(tank.group);
    // gantry crane over it: four legs, two runway beams, the bridge, a hoist
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        B.chunk(0.26, 4.4, 0.26, 0xc99a2e, lx + sx * 4.3, 2.2, lz + sz * 3.2);
        B.block(lx + sx * 4.3, lz + sz * 3.2, 0.2, 0.2);
      }
    }
    for (const sz of [-1, 1]) B.chunk(8.9, 0.3, 0.3, 0xc99a2e, lx, 4.4, lz + sz * 3.2);
    B.chunk(0.36, 0.34, 6.7, 0xb08826, lx - 1.2, 4.7, lz);
    B.chunk(0.5, 0.4, 0.5, 0x2b2c2e, lx - 1.2, 4.35, lz - 0.6);
    B.line([new THREE.Vector3(lx - 1.2, 4.15, lz - 0.6), new THREE.Vector3(lx - 1.2, 2.9, lz - 0.6)]);
    put(B.root, box(0.22, 0.26, 0.16, 0xc99a2e), lx - 1.2, 2.8, lz - 0.6);
    // beams across the roof carrying the lamps, clear of the gantry
    for (const x of [8.6, 21.4]) {
      beamZ(x, -8, 8, HH - 0.2);
      pendant(x, -4.5, HH - 0.35, 1.4, SODIUM, 16);
      pendant(x, 4.5, HH - 0.35, 1.4, SODIUM, 16);
    }
    B.emit(new THREE.Vector3(lx, 3.4, lz), SODIUM, 18, 9);

    // back wall: two workbenches with a pegboard of tools, then shelving
    for (const bx of [8.4, 11.4]) {
      const top = table(bx, -7.45, 2.6, 0.9, 0.9, 0x5c4a34);
      B.chunk(2.6, 1.3, 0.06, 0x6b5d48, bx, 1.95, -8.0); // pegboard
      for (let k = 0; k < 7; k++) B.piece(0.05, 0.3 + rand() * 0.25, 0.04, [0x8d9196, 0xa3423a, 0x3a3c3f][k % 3], bx - 1.0 + k * 0.33, 1.95 + (rand() - 0.5) * 0.4, -7.95, 0, 0, (rand() - 0.5) * 0.6);
      put(B.root, box(0.5, 0.26, 0.3, 0xa3423a, { r: 0.02 }), bx + 0.7, top + 0.13, -7.4); // toolbox
      put(B.root, box(0.2, 0.22, 0.2, 0x3a4048, { r: 0.02 }), bx - 0.9, top + 0.11, -7.35); // vice
      papers(bx - 0.2, top, -7.35, 2);
      put(B.root, cyl(0.05, 0.16, 0x6b8a5a, { seg: 6 }), bx + 0.1, top + 0.08, -7.2); // a bottle
    }
    shelving(15.6, -7.6, 0, 2.4, 'parts');
    shelving(18.4, -7.6, 0, 2.4, 'parts');
    shelving(21.6, -7.6, 0, 2.6, 'boxes');
    // east wall: the blast door out, ammo stacked by it, spare road wheels
    {
      const dx = 24.0;
      B.chunk(0.3, 3.8, 6.6, 0x56606a, dx, 1.9, 0);
      for (let y = 0.3; y < 3.7; y += 0.34) B.piece(0.05, 0.05, 6.5, 0x434b54, dx - 0.18, y, 0);
      B.piece(0.1, 0.3, 7.0, 0xc99a2e, dx - 0.2, 4.0, 0);
      for (let i = 0; i < 12; i++) B.piece(0.06, 0.12, 0.5, i % 2 ? 0x1f2022 : 0xc99a2e, dx - 0.22, 0.2, -2.9 + i * 0.53);
      const beacon = B.keep(put(B.root, box(0.24, 0.2, 0.24, 0xffb02a, { glow: true }), dx - 0.2, 4.4, 3.6));
      B.animate((dt, t) => (beacon.rotation.y = t * 4));
    }
    ammoBox(22.6, -5.6, 0.1);
    ammoBox(22.7, -4.8, -0.05, false);
    ammoBox(22.6, -4.8, 0.05, false).position.y = 0.36;
    ammoBox(21.2, -5.3, 1.4);
    B.block(22.4, -5.1, 0.9, 0.7);
    for (let i = 0; i < 6; i++) shell(20.2 + (i % 3) * 0.16, -4.2 - (i >> 1) * 0.12, 0, true);
    shell(20.9, -3.7, 0.4);
    for (let i = 0; i < 3; i++) roadWheel(23.6, 0.44, 4.6 + i * 0.5, Math.PI / 2, -0.25);
    roadWheel(22.6, 0.08, 6.4, 0, -Math.PI / 2);
    roadWheel(22.6, 0.24, 6.4, 0.6, -Math.PI / 2);
    B.block(23.2, 5.4, 0.8, 1.4);
    // a run of spare track laid out on the floor
    for (let i = 0; i < 12; i++) B.piece(0.24, 0.06, 0.62, 0x3a3936, 16.6 + i * 0.26, 0.03, 6.6, 0, 0.05, 0);
    // an engine on a stand, drums, a tool cart, the welding set, crates
    {
      const ex = 19.8;
      const ez = 4.4;
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.piece(0.08, 0.6, 0.08, 0xc99a2e, ex + sx * 0.6, 0.3, ez + sz * 0.35);
      B.chunk(1.4, 0.7, 0.8, 0x4a4f52, ex, 0.95, ez);
      for (let k = 0; k < 6; k++) B.piece(0.14, 0.22, 0.7, 0x3a3e42, ex - 0.5 + k * 0.2, 1.42, ez);
      put(B.root, cyl(0.16, 0.5, 0x3a3e42, { axis: 'x', seg: 8 }), ex + 0.9, 1.0, ez);
      B.block(ex, ez, 0.75, 0.45);
    }
    drum(7.0, 6.8, 0x6b5843);
    drum(7.7, 7.1, 0x56604f);
    drum(7.3, 6.0, 0x6b5843, true);
    put(B.root, box(0.9, 0.8, 0.55, 0xa3423a, { r: 0.03 }), 11.2, 0.45, 6.6); // tool cart
    for (const s of [-1, 1]) put(B.root, cyl(0.08, 0.1, 0x1f2022, { axis: 'z', seg: 6 }), 11.2 + s * 0.35, 0.08, 6.6);
    B.block(11.2, 6.6, 0.45, 0.3);
    for (const dx of [0, 0.3]) put(B.root, cyl(0.14, 1.3, dx ? 0x3f6b4a : 0x56606a, { seg: 8 }), 9.2 + dx, 0.65, 6.9); // gas bottles
    put(B.root, box(0.7, 0.6, 0.5, 0x4a5a6a, { r: 0.03 }), 9.4, 0.3, 6.3); // welder
    B.block(9.35, 6.6, 0.45, 0.45);
    crate(13.6, 0, 7.0, 0.9);
    crate(14.5, 0, 7.1, 0.8, 0x6b6045, 0.3);
    crate(13.8, 0.72, 7.0, 0.7, 0x7a5f3e, -0.2);
    B.block(14.0, 7.0, 0.95, 0.5);
    B.groundCable(10.2, 6.0, -1.2, 14, 0.5);
  }

  // ------------------------------------------------------- the briefing
  // The CIC table: a thick steel console with a lit glass top, a cold
  // holographic city standing over it, cyan rails round its edge.
  const holo = [];
  {
    const tx = -7;
    const tz = 1;
    const TW = 4.4;
    const TD = 2.8;
    B.chunk(TW, 0.9, TD, 0x2f3438, tx, 0.45, tz);
    B.chunk(TW - 0.5, 0.12, TD - 0.5, 0x23272a, tx, 0.06, tz); // plinth
    B.chunk(TW + 0.2, 0.12, TD + 0.2, 0x3d4449, tx, 0.96, tz); // rim
    for (const s of [-1, 1]) {
      for (let k = 0; k < 6; k++) B.piece(0.4, 0.3, 0.02, 0x262b2e, tx - 1.6 + k * 0.64, 0.5, tz + s * (TD / 2 + 0.005)); // panels
      put(B.root, box(TW - 0.4, 0.03, 0.03, HOLO, { glow: true }), tx, 0.82, tz + s * (TD / 2 + 0.02)); // light strips
      put(B.root, box(0.03, 0.03, TD - 0.4, HOLO, { glow: true }), tx + s * (TW / 2 + 0.02), 0.82, tz);
    }
    for (let k = 0; k < 8; k++) put(B.root, box(0.06, 0.05, 0.02, [0xffb347, 0x6be08a, HOLO][k % 3], { glow: true }), tx - 1.9 + k * 0.12, 0.66, tz + TD / 2 + 0.02); // status lamps
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(TW - 0.3, TD - 0.3), new THREE.MeshBasicMaterial({ map: holoTexture(rand) }));
    glass.rotation.x = -Math.PI / 2;
    glass.position.set(tx, 1.03, tz);
    B.add(glass);
    B.block(tx, tz, TW / 2 + 0.1, TD / 2 + 0.1);
    // the hologram: blocks of the zone in cyan edges, a scan line sweeping
    const city = new THREE.Group();
    city.position.set(tx, 1.06, tz);
    const edgeMat = new THREE.LineBasicMaterial({ color: HOLO, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });
    const fillMat = new THREE.MeshBasicMaterial({ color: HOLO, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 14; i++) {
      const w = 0.25 + rand() * 0.35;
      const d = 0.2 + rand() * 0.3;
      const h = 0.15 + rand() * 0.5;
      const geo = new THREE.BoxGeometry(w, h, d);
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat);
      const f = new THREE.Mesh(geo, fillMat);
      e.position.set(-1.7 + rand() * 3.4, h / 2, (rand() < 0.5 ? -1 : 1) * (0.35 + rand() * 0.7));
      f.position.copy(e.position);
      city.add(e, f);
    }
    // the objective marker over the far end
    const mark = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.OctahedronGeometry(0.16)), new THREE.LineBasicMaterial({ color: 0xffb347 }));
    mark.position.set(1.5, 0.9, 0);
    city.add(mark);
    const scan = new THREE.Mesh(new THREE.PlaneGeometry(0.06, TD - 0.4), new THREE.MeshBasicMaterial({ color: HOLO, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    scan.rotation.x = -Math.PI / 2;
    scan.position.y = 0.01;
    city.add(scan);
    scene.add(city);
    holo.push({ mark, scan, edgeMat });
    B.emit(new THREE.Vector3(tx, 1.8, tz), HOLO, 10, 5);
    B.pool(tx, tz, 3.2, HOLO, 0.1, { sx: 1.3 });
    // chairs round it, documents on its rim
    for (const [x, z, yaw] of [[tx - 2.7, tz, 0], [tx + 0.6, tz + 1.95, 1.4], [tx - 0.9, tz - 1.95, -1.6]]) {
      put(B.root, box(0.5, 0.08, 0.5, 0x3a3226, { r: 0.02 }), x, 0.48, z);
      put(B.root, box(0.08, 0.5, 0.5, 0x3a3226, { r: 0.02 }), x - Math.cos(yaw) * 0.22, 0.75, z + Math.sin(yaw) * 0.22).rotation.y = yaw;
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.piece(0.05, 0.46, 0.05, 0x2b2c2e, x + sx * 0.2, 0.23, z + sz * 0.2);
    }
    papers(tx + 1.9, 1.02, tz - 1.25, 3);
    papers(tx - 2.0, 1.02, tz + 1.25, 2);
    // consoles along the broken wall: desks of screens
    for (let k = 0; k < 3; k++) {
      const cx = -10.6 + k * 1.6;
      const top = table(cx, -4.6, 1.4, 0.7, 0.8, 0x3a3e42);
      put(B.root, box(0.9, 0.62, 0.4, 0x2a2e31, { r: 0.03 }), cx, top + 0.31, -4.75);
      put(B.root, box(0.74, 0.46, 0.02, k === 1 ? 0xffb347 : HOLO, { glow: true }), cx, top + 0.33, -4.54);
      B.piece(0.5, 0.03, 0.16, 0x1f2022, cx, top + 0.02, -4.35); // keyboard
      papers(cx + 0.5, top, -4.4, 1);
    }
    // the radio set on the end, its handset, wires to the floor
    {
      const top = table(-4.0, -4.6, 1.3, 0.7, 0.8, 0x3a3e42);
      put(B.root, box(0.8, 0.5, 0.4, 0x4d5a52, { r: 0.03 }), -4.1, top + 0.25, -4.7);
      for (let k = 0; k < 4; k++) put(B.root, cyl(0.04, 0.03, 0xd8d0b8, { axis: 'z', seg: 6 }), -4.4 + k * 0.18, top + 0.3, -4.49);
      B.keep(put(B.root, box(0.06, 0.06, 0.02, 0x6be08a, { glow: true }), -3.8, top + 0.4, -4.49));
      put(B.root, box(0.2, 0.08, 0.14, 0x2b2c2e, { r: 0.02 }), -3.6, top + 0.04, -4.3);
      B.groundCable(-3.6, -4.2, 1.2, 8, 0.4);
    }
    // filing cabinets and a shelf of binders in the west corner, a map board
    for (let k = 0; k < 2; k++) {
      B.chunk(0.6, 1.3, 0.6, 0x5a6060, -11.5, 0.65, 3.0 + k * 0.65);
      for (let d = 0; d < 3; d++) B.piece(0.02, 0.05, 0.25, 0x2b2c2e, -11.19, 0.3 + d * 0.4, 3.0 + k * 0.65);
    }
    B.block(-11.5, 3.3, 0.3, 0.65);
    papers(-11.5, 1.31, 3.0, 3);
    shelving(-11.6, 5.6, Math.PI / 2, 2.0, 'files', 3);
    {
      const g = new THREE.Group();
      put(g, box(1.8, 1.2, 0.06, 0x3a3226, { r: 0.02 }), 0, 1.5, 0);
      for (let i = 0; i < 7; i++) put(g, box(0.36, 0.28, 0.01, [0xe2dccb, 0xd2c9b0, 0xc4b896][i % 3]), -0.6 + (i % 4) * 0.4, 1.7 - (i >> 2) * 0.4, 0.04).rotation.z = (rand() - 0.5) * 0.2;
      put(g, box(0.06, 1.0, 0.06, 0x2b2c2e), -0.7, 0.5, 0);
      put(g, box(0.06, 1.0, 0.06, 0x2b2c2e), 0.7, 0.5, 0);
      g.position.set(-3.4, 0, 5.8);
      g.rotation.y = -0.5;
      B.add(g);
      B.block(-3.4, 5.8, 0.8, 0.3, -0.5);
    }
    crate(-11.3, 0, -0.2, 0.7, 0x4f5a3a);
    crate(-11.3, 0.56, -0.3, 0.55, 0x4f5a3a, 0.4);
    B.block(-11.3, -0.2, 0.4, 0.4);
    beamX(1, -12, -2, H - 0.2);
    pendant(-9.6, 1, H - 0.35, 1.0, SODIUM, 10);
    pendant(-4.4, 1, H - 0.35, 1.0, SODIUM, 10);
  }

  // ------------------------------------------------------- the quarters
  {
    // three double bunks along the back wall, a footlocker at each
    for (const x of [-6.4, -3.0, 0.4]) {
      for (const y of [0.45, 1.55]) {
        B.chunk(2.4, 0.16, 1.0, 0x3d4434, x, y, -16.4);
        B.piece(2.2, 0.12, 0.9, [0x6d7458, 0x5f6a4a, 0x6a6650][(rand() * 3) | 0], x, y + 0.14, -16.4);
        B.piece(0.5, 0.12, 0.7, 0xb8b4a8, x - 0.8, y + 0.22, -16.4);
        if (rand() < 0.6) B.piece(1.0, 0.08, 0.92, 0x4a5a3a, x + 0.3 + rand() * 0.3, y + 0.24, -16.35, 0, (rand() - 0.5) * 0.3, 0); // a blanket
      }
      for (const dx of [-1.15, 1.15]) B.piece(0.08, 1.9, 0.08, 0x3a3c3f, x + dx, 0.95, -15.95);
      B.block(x, -16.4, 1.2, 0.55);
      put(B.root, box(0.9, 0.42, 0.5, 0x4f5a3a, { r: 0.03 }), x, 0.21, -15.4);
      B.block(x, -15.4, 0.45, 0.25);
    }
    // lockers down the east wall, coats on hooks, a helmet on top
    for (let i = 0; i < 4; i++) {
      B.chunk(0.5, 1.9, 0.6, [0x4f5a55, 0x56606a][i % 2], 3.7, 0.95, -15.6 + i * 0.65);
      B.piece(0.02, 0.6, 0.02, 0x2b2c2e, 3.44, 1.3, -15.6 + i * 0.65 + 0.2);
    }
    B.block(3.7, -14.6, 0.3, 1.3);
    put(B.root, box(0.3, 0.16, 0.3, 0x2f2b26, { r: 0.06 }), 3.7, 1.98, -14.9);
    for (let i = 0; i < 3; i++) B.piece(0.1, 0.9, 0.42, [0x5f6b46, 0x4a553a, 0x6a5a40][i], 3.95, 1.6, -11.6 + i * 0.6, 0, 0, 0.05);
    // the stove in the corner, its flue going up, a kettle on it
    put(B.root, cyl(0.36, 0.9, 0x3a3634, { seg: 10 }), -7.2, 0.45, -8.0);
    put(B.root, cyl(0.1, 3.4, 0x2b2c2e, { seg: 8 }), -7.2, 2.6, -8.0);
    put(B.root, cyl(0.14, 0.18, 0x6a6e72, { seg: 8 }), -7.15, 1.0, -7.9);
    B.block(-7.2, -8.0, 0.4, 0.4);
    const glowDoor = B.keep(put(B.root, box(0.24, 0.16, 0.04, 0xff8a3a, { glow: true }), -7.0, 0.4, -7.66));
    const fire = B.emit(new THREE.Vector3(-6.8, 0.8, -7.6), 0xff9a40, 12, 6);
    B.animate((dt, t) => {
      const k = 0.8 + Math.sin(t * 13) * 0.12 + Math.sin(t * 29) * 0.08;
      fire.level = k;
      glowDoor.scale.y = k;
    });
    for (let i = 0; i < 6; i++) B.piece(0.4 + rand() * 0.2, 0.1, 0.12, 0x6b5640, -7.6 + rand() * 0.4, 0.05 + i * 0.1, -9.2, 0, rand() * 0.4, 0); // firewood
    // the table: mugs, cards, a lamp; benches either side
    const top = table(-1.6, -10.2, 2.4, 1.2, 0.78, 0x5a4632);
    for (const s of [-1, 1]) {
      B.chunk(2.2, 0.08, 0.36, 0x4a3a2a, -1.6, 0.46, -10.2 + s * 0.95);
      for (const dx of [-0.9, 0.9]) B.piece(0.06, 0.44, 0.3, 0x3a2c1f, -1.6 + dx, 0.22, -10.2 + s * 0.95);
    }
    for (const [x, z] of [[-2.2, -10.0], [-0.9, -10.4], [-1.4, -9.85]]) put(B.root, cyl(0.07, 0.12, [0xd8d0b8, 0x56604f, 0x8a5a3a][(rand() * 3) | 0], { seg: 8 }), x, top + 0.06, z);
    for (let i = 0; i < 5; i++) B.piece(0.12, 0.01, 0.17, 0xe2dccb, -1.8 + rand() * 0.6, top + 0.005, -10.3 + rand() * 0.4, 0, rand() * 3, 0); // cards
    put(B.root, box(0.2, 0.3, 0.2, 0x3a3634, { r: 0.03 }), -0.7, top + 0.15, -10.0);
    B.keep(put(B.root, box(0.1, 0.12, 0.1, 0xffc070, { glow: true }), -0.7, top + 0.24, -9.88));
    B.emit(new THREE.Vector3(-0.7, top + 0.6, -10.0), SODIUM, 6, 4);
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.4), toon(0x5a3a2a));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(-1.6, 0.01, -10.2);
    B.add(rug);
    // crates with a radio on them, a washing line across the corner
    crate(-6.9, 0, -13.2, 0.8);
    crate(-6.9, 0.64, -13.2, 0.7, 0x6b6045, 0.3);
    put(B.root, box(0.4, 0.26, 0.2, 0x4d5a52, { r: 0.03 }), -6.9, 1.33, -13.2);
    B.block(-6.9, -13.2, 0.45, 0.45);
    B.sagging(new THREE.Vector3(-7.9, 2.5, -14.6), new THREE.Vector3(-4.6, 2.5, -16.9), 0.3);
    for (let i = 0; i < 3; i++) B.piece(0.45, 0.55, 0.04, [0x8a8578, 0x5f6b46, 0xb8b4a8][i], -7.3 + i * 0.8, 1.98, -15.0 - i * 0.56, 0, 0.6, 0);
    beamX(-11.5, -8, 4, H - 0.2);
    pendant(-4.5, -11.5, H - 0.35, 1.1, SODIUM, 10);
    pendant(1.2, -11.5, H - 0.35, 1.1, SODIUM, 10);
  }

  // ----------------------------------------------------------- the hall
  {
    crate(4.6, 0, -5.3, 0.9);
    crate(5.3, 0, -5.4, 0.7, 0x6b6045, 0.4);
    crate(4.8, 0.72, -5.3, 0.6, 0x7a5f3e, -0.3);
    B.block(4.9, -5.3, 0.8, 0.5);
    for (let i = 0; i < 6; i++) B.lump(-1.2 + i * 0.55, 0.2 + (i % 2) * 0.25, 7.5, 0.36, 0.18, 0.24, 0x8a7b5c);
    B.block(0.2, 7.5, 1.7, 0.3);
    for (let i = 0; i < 3; i++) put(B.root, box(0.24, 0.4, 0.14, 0x4f5a3a, { r: 0.02 }), 5.2, 0.2, 6.6 + i * 0.3); // fuel cans
    B.block(5.2, 6.9, 0.2, 0.5);
    B.groundCable(-1.5, 3, 0.1, 18, 0.5);
    beamX(1, -2, 6, H - 0.2);
    pendant(2, 1, H - 0.35, 1.0, SODIUM, 12);
  }
  B.finish();
  B.mergeStatic();
  setLowPoly(false);

  // lights: a fixed set at the emitters
  for (const e of B.emitters) {
    const l = new THREE.PointLight(e.color, e.intensity, e.distance, 1.4);
    l.position.copy(e.pos);
    scene.add(l);
    e.light = l;
  }

  // room outlines, lit while hovered
  for (const r of ROOMS) {
    const [x0, x1, z0, z1] = r.rect;
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.9, depthWrite: false });
    const T = 0.14;
    for (const [w, d, x, z] of [[x1 - x0, T, (x0 + x1) / 2, z0 + T / 2], [x1 - x0, T, (x0 + x1) / 2, z1 - T / 2], [T, z1 - z0, x0 + T / 2, (z0 + z1) / 2], [T, z1 - z0, x1 - T / 2, (z0 + z1) / 2]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.05, z);
      g.add(m);
    }
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false }));
    fill.rotation.x = -Math.PI / 2;
    fill.position.set((x0 + x1) / 2, 0.04, (z0 + z1) / 2);
    g.add(fill);
    g.visible = false;
    scene.add(g);
    r.outline = g;
    r.outlineMat = mat;
  }

  // ----------------------------------------------------------- crewman
  const crew = createCrew({ layer: PLAYER_LAYER });
  scene.add(crew.group);
  // a soft light that goes with him, so he reads anywhere in the gloom
  const fillLight = new THREE.PointLight(0xffe2c0, 6, 3.6, 1.6);
  fillLight.position.set(0.3, 2.0, 0.4);
  crew.group.add(fillLight);
  const me = crew.group.position;
  const HOME = new THREE.Vector3(2, 0, 2.5);
  me.copy(HOME);
  crew.group.rotation.y = Math.PI * 0.75;
  const crewBox = () => ({ x: me.x, z: me.z, hx: 0.25, hz: 0.25, yaw: 0 });
  const roomAt = (p) => ROOMS.find((r) => p.x > r.rect[0] + 0.3 && p.x < r.rect[1] - 0.3 && p.z > r.rect[2] + 0.3 && p.z < r.rect[3] - 0.3) || null;

  // -------------------------------------------------------------- UI
  const root = document.createElement('div');
  root.className = 'base';
  root.style.setProperty('--cursor', CURSOR);
  root.innerHTML = `
    <div class="base-bank panel px"><i></i>Scraps <b>0</b></div>
    ${ROOMS.map((r) => `<div class="base-tag" data-id="${r.id}">${r.name}</div>`).join('')}
    <div class="base-menu panel" hidden></div>
    <div class="base-brief" hidden></div>
    <div class="base-hint panel">Click a room to open it, or walk in · <b>WASD</b> or click the floor to walk</div>
    <div class="base-fade"></div>
  `;
  const tags = new Map(ROOMS.map((r) => [r.id, root.querySelector(`.base-tag[data-id="${r.id}"]`)]));
  const menu = root.querySelector('.base-menu');
  const brief = root.querySelector('.base-brief');
  const hint = root.querySelector('.base-hint');
  const fade = root.querySelector('.base-fade');
  const bankEl = root.querySelector('.base-bank b');
  let open = null;
  let hover = null;
  let hoverTag = null;
  let lastRoom = null;
  let walkTo = null;
  for (const r of ROOMS) {
    const tag = tags.get(r.id);
    tag.addEventListener('pointerenter', () => (hoverTag = r));
    tag.addEventListener('pointerleave', () => hoverTag === r && (hoverTag = null));
    tag.addEventListener('click', () => clickRoom(r));
  }

  function bankTotal() {
    try {
      return parseInt(localStorage.getItem(BANK_KEY), 10) || 0;
    } catch {
      return 0;
    }
  }
  function openRoom(r) {
    open = r;
    hint.hidden = true;
    if (r.id === 'briefing') return openBriefing();
    menu.hidden = false;
    if (r.id === 'hangar') {
      const stat = (label, v) => `<span>${label}</span><i style="--v:${Math.round(v * 100)}%"></i>`;
      menu.innerHTML = `
        <h2>Hangar</h2><p class="sub">The tank is up on the lift.</p>
        <div class="zone"><b>${TANK.name}</b><span>${TANK.blurb}</span>
          <div class="stats">${stat('Armour', 0.55)}${stat('Gun', 0.5)}${stat('Speed', 0.45)}${stat('Boost', 0.4)}</div></div>
        <div class="zone"><b>Parts</b><span>Found at checkpoints during a run, lost when it ends.</span></div>
        <div class="zone locked"><b>Workshop</b><span>Coming soon: spend scraps on the tank for good.</span></div>
        <button type="button" class="back">Back</button>`;
    } else {
      menu.innerHTML = `
        <h2>Quarters</h2><p class="sub">Bunks, lockers, a stove going.</p>
        <div class="zone locked"><b>Crew</b><span>Coming soon.</span></div>
        <button type="button" class="back">Back</button>`;
    }
    menu.querySelector('.back').addEventListener('click', closeRoom);
  }
  // the briefing: the campaign map in the middle, the zone's details beside it
  let selLevel = LEVELS[0];
  const mapCanvas = campaignMap();
  function openBriefing() {
    brief.hidden = false;
    brief.innerHTML = `
      <div class="map">${LEVELS.map((z) => `<button type="button" class="node ${z.open ? 'open' : 'locked'}" data-n="${z.n}" style="left:${z.at[0] * 100}%;top:${z.at[1] * 100}%">${z.n}</button>`).join('')}</div>
      <div class="info panel"></div>`;
    brief.querySelector('.map').prepend(mapCanvas);
    for (const b of brief.querySelectorAll('.node')) b.addEventListener('click', () => showLevel(LEVELS[b.dataset.n - 1]));
    showLevel(selLevel);
  }
  function showLevel(z) {
    selLevel = z;
    for (const b of brief.querySelectorAll('.node')) b.classList.toggle('sel', +b.dataset.n === z.n);
    const info = brief.querySelector('.info');
    info.innerHTML = `
      <span class="tagline px">Level ${z.n} · ${z.open ? 'Ready' : 'Locked'}</span>
      <h2>${z.name}</h2>
      <p>${z.text}</p>
      ${z.zones ? `<div class="zone"><b>Zones</b><ul>${z.zones.map((s) => `<li>${s}</li>`).join('')}</ul></div>` : ''}
      ${z.threats ? `<div class="zone"><b>Threats</b><ul>${z.threats.map((s) => `<li>${s}</li>`).join('')}</ul></div>` : ''}
      <div class="row"><button type="button" class="go" ${z.open ? '' : 'disabled'}>Deploy</button><button type="button" class="back">Back</button></div>`;
    info.querySelector('.back').addEventListener('click', closeRoom);
    if (z.open) info.querySelector('.go').addEventListener('click', () => deploy(z.id));
  }
  function closeRoom() {
    open = null;
    menu.hidden = true;
    brief.hidden = true;
    hint.hidden = false;
    walkTo = null;
  }
  function clickRoom(r) {
    if (open) return;
    openRoom(r);
    // and the crewman heads over there meanwhile
    if (roomAt(me) !== r) walkTo = r.entry.clone();
  }
  function deploy(id) {
    fade.classList.remove('off');
    setTimeout(() => onDeploy(id), 480);
  }

  // ---------------------------------------------------------- input
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400);
  const camTarget = BASE_CENTER.clone();
  let view = VIEW_FAR;
  let aspect = 16 / 9;
  const keys = new Set();
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const canvasEl = renderer.domElement;
  const pick = (e) => {
    const r = canvasEl.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects(floorMeshes, false)[0];
  };
  const onKeyDown = (e) => {
    if (e.code === 'Escape' && open) return closeRoom();
    keys.add(e.code);
  };
  const onKeyUp = (e) => keys.delete(e.code);
  const onDown = (e) => {
    if (open) return;
    const hit = pick(e);
    if (!hit) return;
    const r = hit.object.userData.room;
    if (r) return clickRoom(r);
    walkTo = hit.point.clone().setY(0);
  };
  const onMove = (e) => {
    if (open || e.pointerType === 'touch') return void (hover = null);
    hover = pick(e)?.object.userData.room || null;
  };
  const onBlur = () => keys.clear();

  // ----------------------------------------------------------- frame
  const input = new THREE.Vector3();
  const camWant = new THREE.Vector3();
  const v = new THREE.Vector3();
  let speed = 0;

  return {
    enter() {
      document.body.append(root);
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', onBlur);
      canvasEl.addEventListener('pointerdown', onDown);
      canvasEl.addEventListener('pointermove', onMove);
      canvasEl.style.cursor = CURSOR;
      pixel.setActorOutlines(true);
      closeRoom();
      me.copy(HOME);
      lastRoom = null;
      bankEl.textContent = bankTotal();
      fade.classList.remove('off');
      requestAnimationFrame(() => requestAnimationFrame(() => fade.classList.add('off')));
    },
    exit() {
      root.remove();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvasEl.removeEventListener('pointerdown', onDown);
      canvasEl.removeEventListener('pointermove', onMove);
      canvasEl.style.cursor = '';
      keys.clear();
    },
    resize(w, h) {
      aspect = w / h;
      pixel.setHeight(ROWS);
    },
    debug: { crew, scene },
    // for the dev kit's data reset
    refresh() {
      bankEl.textContent = bankTotal();
    },
    frame(dt, t) {
      // walking: keys (screen-relative), or toward a clicked spot
      input.set(0, 0, 0);
      if (!open) {
        if (keys.has('KeyW') || keys.has('ArrowUp')) input.add(INPUT_FORWARD);
        if (keys.has('KeyS') || keys.has('ArrowDown')) input.sub(INPUT_FORWARD);
        if (keys.has('KeyD') || keys.has('ArrowRight')) input.add(INPUT_RIGHT);
        if (keys.has('KeyA') || keys.has('ArrowLeft')) input.sub(INPUT_RIGHT);
        if (input.lengthSq() > 0) walkTo = null;
      }
      if (!input.lengthSq() && walkTo) {
        input.set(walkTo.x - me.x, 0, walkTo.z - me.z);
        if (input.length() < 0.2) {
          walkTo = null;
          input.set(0, 0, 0);
        }
      }
      const moving = input.lengthSq() > 0.001;
      speed += ((moving ? 1 : 0) - speed) * Math.min(1, dt * 10);
      if (moving) {
        input.normalize();
        crew.group.rotation.y = approachAngle(crew.group.rotation.y, Math.atan2(-input.z, input.x), dt * 12);
        me.addScaledVector(input, WALK * dt * speed);
        // walked into something on the way to a click: give up rather than grind
        if (pushOut(me, crewBox, B.blocks) && walkTo && Math.random() < dt * 2) walkTo = null;
      }
      crew.update(dt, t, speed, WALK);
      B.update(dt, t, {});
      for (const e of B.emitters) if (e.light) e.light.intensity = e.intensity * e.level;
      for (const h of holo) {
        h.mark.rotation.y = t * 1.5;
        h.mark.position.y = 0.9 + Math.sin(t * 2) * 0.06;
        h.scan.position.x = ((t * 0.6) % 1) * 3.8 - 1.9;
        h.edgeMat.opacity = 0.6 + Math.sin(t * 7) * 0.08 + (Math.random() < 0.02 ? -0.3 : 0);
      }

      // walking into a room opens it
      const inRoom = roomAt(me);
      if (inRoom !== lastRoom) {
        lastRoom = inRoom;
        if (inRoom && !open) openRoom(inRoom);
      }

      // camera: the whole base, leaning a little toward the crewman; eased
      // in close on an open room
      view += ((open ? open.view : VIEW_FAR) - view) * (1 - Math.exp(-dt * 4));
      if (open) camWant.copy(open.focus);
      else camWant.copy(BASE_CENTER).lerp(me, aspect < 1.2 ? 0.7 : 0.15);
      camWant.setY(0.8);
      camTarget.lerp(camWant, 1 - Math.exp(-dt * 4));
      const viewH = aspect < 1.2 ? view * Math.min(1.6, 1.2 / aspect) : view;
      camera.left = (-viewH * aspect) / 2;
      camera.right = (viewH * aspect) / 2;
      camera.top = viewH / 2;
      camera.bottom = -viewH / 2;
      camera.updateProjectionMatrix();
      camera.position.copy(camTarget).add(CAM_OFFSET);
      camera.lookAt(camTarget);
      camera.updateMatrixWorld();
      pixel.render(scene, camera);

      // the hovered room lights its outline; tags over each room
      const lit = open ? null : hover || hoverTag;
      for (const r of ROOMS) {
        r.outline.visible = r === lit;
        if (r === lit) r.outlineMat.opacity = 0.75 + Math.sin(t * 8) * 0.2;
      }
      const rect = canvasEl.getBoundingClientRect();
      for (const r of ROOMS) {
        const tag = tags.get(r.id);
        v.copy(r.label).project(camera);
        tag.hidden = !!open || v.z > 1;
        tag.style.left = `${Math.round(rect.left + ((v.x + 1) / 2) * rect.width)}px`;
        tag.style.top = `${Math.round(rect.top + ((1 - v.y) / 2) * rect.height)}px`;
        tag.classList.toggle('hot', r === lit);
      }
    },
  };
}
