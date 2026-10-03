// The base between runs: an underground garage-bunker under the city. A
// crewman walks around it (WASD / arrows, or click or tap where to go); each
// station opens its menu when you walk up and press E, or click it. The
// camera eases over to whatever is open.
//
// Stations (first pass):
//  - planning table: pick a zone and deploy (only Zone 1 for now)
//  - repair bay: the tank up on its lift (upgrades come later)
//  - quarters: bunks and lockers (later)
//
// Layout, an L of rooms seen from the usual corner: the long hall along the
// front, the repair bay in a wing behind its east end, the quarters in a nook
// behind its west end. Walls toward the camera are kept low (cutaway).
import * as THREE from 'three';
import { LevelBuilder, canvas, tex, blob, speckle } from '../levels/builder.js';
import { box, cyl, put, toon, glowMat, gradientMap, setLowPoly, approachAngle } from '../models/kit.js';
import { createCrew } from '../models/crew.js';
import { createTank } from '../models/tank.js';
import { pushOut } from '../game/collide.js';
import { PLAYER_LAYER } from '../render/pixel.js';
import { CURSOR } from '../game/hud.js';

const VIEW_H = 10; // a closer view than in the field
const PIXEL_ROWS = 540;
const ROWS_PER_UNIT = PIXEL_ROWS / 13; // same pixel size as in the game
const CAM_OFFSET = new THREE.Vector3(-10, 8.2, 10).multiplyScalar(4);
const WALK = 3.4;
const H = 4.2; // wall height
const SODIUM = 0xffa245;
const COLD = 0xcfe8ff;
const INPUT_FORWARD = new THREE.Vector3(1, 0, -1).normalize();
const INPUT_RIGHT = new THREE.Vector3(1, 0, 1).normalize();

const CSS = `
.base { position: fixed; inset: 0; pointer-events: none; z-index: 10; color: #f1e9d8; font: 400 15px/1.3 'Pixelify Sans', 'Silkscreen', ui-monospace, monospace; }
.base .panel { background: rgba(12, 11, 13, 0.88); box-shadow: 0 0 0 2px #000, 0 0 0 4px #f1e9d8, 4px 4px 0 4px #000; }
.base-tag { position: absolute; left: 0; top: 0; transform: translate(-50%, -100%); padding: 3px 8px 4px; font: 400 11px/1 'Silkscreen', monospace; text-transform: uppercase;
  color: #ffb347; background: rgba(12, 11, 13, 0.75); box-shadow: 0 0 0 2px #000; white-space: nowrap; transition: transform 0.1s steps(2); }
.base-tag.near { color: #111; background: #6be08a; transform: translate(-50%, -100%) scale(1.15); }
.base-tag kbd { font: inherit; padding: 0 4px; margin-right: 4px; background: #111; color: #6be08a; }
.base-menu { position: absolute; right: calc(24px + env(safe-area-inset-right, 0px)); top: 50%; transform: translateY(-50%); width: min(340px, calc(100vw - 48px)); padding: 16px 18px 18px;
  display: grid; gap: 12px; pointer-events: auto; }
.base-menu h2 { margin: 0; font: 400 20px/1.1 'Silkscreen', monospace; text-transform: uppercase; color: #ffb347; }
.base-menu .sub { margin: -6px 0 0; color: #b9b0a0; font-size: 13px; }
.base-menu .zone { display: grid; gap: 6px; padding: 10px 12px 12px; background: #1d1b1e; box-shadow: 0 0 0 2px #000, 0 0 0 4px #6d655a; }
.base-menu .zone.locked { opacity: 0.5; }
.base-menu .zone b { font: 400 13px/1.1 'Silkscreen', monospace; text-transform: uppercase; color: #ffb347; font-weight: 400; }
.base-menu .zone span { font-size: 13px; color: #d8d0c0; }
.base-menu button { justify-self: start; padding: 8px 16px 9px; border: 0; cursor: var(--cursor); font: 400 13px/1 'Silkscreen', monospace; text-transform: uppercase; color: #111; background: #6be08a; box-shadow: 0 3px 0 #2f6b40; }
.base-menu button.back { background: #2a2628; color: #f1e9d8; box-shadow: 0 0 0 2px #000, 0 0 0 4px #6d655a; }
.base-menu button:hover { filter: brightness(1.15); }
.base-hint { position: absolute; left: 50%; bottom: calc(18px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); padding: 6px 12px; font-size: 13px; color: #b9b0a0; }
.base-fade { position: absolute; inset: 0; background: #070609; opacity: 1; transition: opacity 0.45s steps(5); }
.base-fade.off { opacity: 0; }
.base [hidden] { display: none !important; }
`;

function floorTexture(rand, w, d) {
  const S = 10;
  const [c, g] = canvas(w * S, d * S);
  g.fillStyle = '#4f4d4a';
  g.fillRect(0, 0, c.width, c.height);
  speckle(g, c.width, c.height, ['#55534f', '#47453f', '#5b5954'], c.width * c.height * 0.05, rand);
  g.fillStyle = '#403e3b';
  for (let x = 0; x < c.width; x += 3 * S) g.fillRect(x, 0, 1, c.height);
  for (let y = 0; y < c.height; y += 3 * S) g.fillRect(0, y, c.width, 1);
  for (let i = 0; i < w * d * 0.15; i++) {
    g.fillStyle = rand() < 0.5 ? '#383633' : '#3f3c38';
    blob(g, rand() * c.width, rand() * c.height, 6 + rand() * 20, 4 + rand() * 14, rand, 11);
  }
  return tex(c);
}

// The planning table's top: a lit map of the zone, in cold lines and amber marks.
function mapTexture(rand) {
  const [c, g] = canvas(96, 64);
  g.fillStyle = '#0d1a22';
  g.fillRect(0, 0, 96, 64);
  g.fillStyle = '#1c3a48';
  for (let i = 0; i < 40; i++) g.fillRect((rand() * 92) | 0, (rand() * 60) | 0, 2 + rand() * 8, 2 + rand() * 6); // blocks
  g.fillStyle = '#5fc8e8';
  g.fillRect(0, 30, 96, 3); // the avenue
  g.fillRect(56, 0, 3, 64); // the cross road
  g.fillRect(34, 22, 6, 18); // the river
  g.fillStyle = '#ffb347';
  for (const [x, y] of [[10, 31], [44, 31], [62, 31], [80, 31]]) g.fillRect(x, y - 1, 3, 5);
  g.fillStyle = '#ff3b2f';
  g.fillRect(70, 26, 4, 4);
  return tex(c);
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
  scene.add(new THREE.HemisphereLight(0x6c7590, 0x1c1814, 1.25));
  const key = new THREE.DirectionalLight(0xffe0b8, 0.9);
  key.position.set(4, 14, 6);
  key.target.position.set(12, 0, -4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 40 });
  scene.add(key, key.target);

  // floor: the hall, the repair wing behind its east end, the quarters nook
  // behind its west end
  const floor = (x0, x1, z0, z1) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), new THREE.MeshToonMaterial({ map: floorTexture(rand, x1 - x0, z1 - z0), gradientMap }));
    m.rotation.x = -Math.PI / 2;
    m.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    m.receiveShadow = true;
    B.add(m);
    return m;
  };
  const floors = [floor(0, 24, -5, 5), floor(13, 24, -15, -5), floor(0, 7, -11, -5)];
  // the dark beyond the walls
  const under = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), toon(0x141316));
  under.rotation.x = -Math.PI / 2;
  under.position.set(12, -0.02, -5);
  B.add(under);

  const WALL = 0x6f6c66;
  const wall = (x0, z0, x1, z1, h = H, color = WALL) => {
    const w = Math.max(0.4, Math.abs(x1 - x0));
    const d = Math.max(0.4, Math.abs(z1 - z0));
    const m = B.chunk(w, h, d, color, (x0 + x1) / 2, h / 2, (z0 + z1) / 2);
    m.castShadow = m.receiveShadow = true;
    B.block((x0 + x1) / 2, (z0 + z1) / 2, w / 2, d / 2);
    // a darker band low down, a lighter cap
    if (h > 2) B.piece(w + 0.01, 1.2, d + 0.01, 0x4e5a52, (x0 + x1) / 2, 0.6, (z0 + z1) / 2);
    B.piece(w + 0.02, 0.08, d + 0.02, 0x8d8b86, (x0 + x1) / 2, h, (z0 + z1) / 2);
    return m;
  };
  // tall back walls
  wall(0, -11.2, 7, -11.2); // quarters back
  wall(7.2, -11, 7.2, -5); // quarters' east side
  wall(7, -5.2, 13, -5.2); // the hall's back wall between the two wings
  wall(13, -15.2, 24, -15.2); // repair bay back
  wall(24.2, -15, 24.2, 5); // east end
  // low walls toward the camera (cutaway), with a doorway gap into the bay
  wall(0, 5.2, 24, 5.2, 0.9);
  wall(-0.2, -11, -0.2, 5, 0.9);
  wall(12.8, -15, 12.8, -10.5, 1.2);
  // pillars carrying the low ceiling that isn't drawn
  for (const [x, z] of [[13, -5], [7, -5], [18.5, -5.2], [24, -5]]) {
    B.chunk(0.6, H + 0.2, 0.6, 0x8d8b86, x, (H + 0.2) / 2, z);
    B.block(x, z, 0.3, 0.3);
  }
  // the blast door up the ramp at the back of the repair bay: the way out
  {
    const dx = 18.5;
    B.chunk(5.2, 3.6, 0.3, 0x56606a, dx, 1.8, -14.9);
    for (let y = 0.3; y < 3.5; y += 0.32) B.piece(5.1, 0.05, 0.05, 0x434b54, dx, y, -14.7);
    for (const s of [-1, 1]) B.chunk(0.5, 4.2, 0.6, 0x45484c, dx + s * 2.85, 2.1, -14.85);
    B.piece(5.6, 0.3, 0.1, 0xc99a2e, dx, 3.85, -14.6);
    const beacon = B.keep(put(B.root, box(0.24, 0.2, 0.24, 0xffb02a, { glow: true }), dx + 3.1, 3.9, -14.4));
    B.animate((dt, t) => (beacon.rotation.y = t * 4));
  }

  // ------------------------------------------------------- repair bay
  const tank = createTank();
  {
    const lx = 18.5;
    const lz = -10;
    B.chunk(6.4, 0.3, 4.2, 0x3d4044, lx, 0.15, lz); // the lift
    for (const s of [-1, 1]) B.piece(6.4, 0.04, 0.25, 0xc99a2e, lx, 0.32, lz + s * 1.95);
    B.block(lx, lz, 3.2, 2.1);
    tank.group.position.set(lx, 0.3, lz);
    tank.group.rotation.y = Math.PI * 0.85;
    tank.update(0.016, 0, {});
    scene.add(tank.group);
    // a gantry over it with a chain hoist
    for (const s of [-1, 1]) B.chunk(0.25, 4, 0.25, 0xc99a2e, lx + s * 3.6, 2, lz - 2.4);
    B.chunk(7.6, 0.3, 0.3, 0xc99a2e, lx, 4, lz - 2.4);
    B.line([new THREE.Vector3(lx - 0.5, 3.9, lz - 2.4), new THREE.Vector3(lx - 0.5, 2.6, lz - 1.6)]);
    put(B.root, box(0.3, 0.3, 0.3, 0x2b2c2e), lx - 0.5, 2.5, lz - 1.6);
    // tool cart, tyres, drums, a workbench against the back wall
    B.chunk(1.0, 0.9, 0.6, 0xa3423a, 15, 0.45, -13.6);
    B.block(15, -13.6, 0.5, 0.3);
    for (let i = 0; i < 4; i++) B.piece(0.5, 0.18, 0.5, 0x1f2022, 22.8, 0.1 + i * 0.2, -13.8, 0, i * 0.4, 0);
    B.block(22.8, -13.8, 0.4, 0.4);
    for (const [x, z] of [[23.3, -6.5], [22.6, -6.2]]) put(B.root, cyl(0.3, 0.8, 0x6b5843, { seg: 10 }), x, 0.4, z);
    B.block(23, -6.4, 0.7, 0.4);
    B.emit(new THREE.Vector3(lx, 3.4, lz), SODIUM, 26, 10);
    B.pool(lx, lz, 3.6, SODIUM, 0.2, { sx: 1.3 });
  }

  // ------------------------------------------------------ planning table
  {
    const tx = 20;
    const tz = 1.6;
    for (const [dx, dz] of [[-1.4, -0.8], [1.4, -0.8], [-1.4, 0.8], [1.4, 0.8]]) B.piece(0.12, 0.9, 0.12, 0x3a3c3f, tx + dx, 0.45, tz + dz);
    B.chunk(3.2, 0.12, 2.0, 0x3a3226, tx, 0.95, tz);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.8), new THREE.MeshBasicMaterial({ map: mapTexture(rand) }));
    top.rotation.x = -Math.PI / 2;
    top.position.set(tx, 1.02, tz);
    B.add(top);
    B.block(tx, tz, 1.6, 1.0);
    // lamp hanging over it, a cold glow off the map
    B.line([new THREE.Vector3(tx, H, tz), new THREE.Vector3(tx, 2.8, tz)]);
    put(B.root, cyl(0.4, 0.22, 0x2e3034, { seg: 10, radiusEnd: 0.14 }), tx, 2.7, tz);
    put(B.root, cyl(0.24, 0.05, SODIUM, { seg: 10, glow: true }), tx, 2.58, tz);
    B.emit(new THREE.Vector3(tx, 2.2, tz), SODIUM, 16, 6);
    B.emit(new THREE.Vector3(tx, 1.4, tz), 0x5fc8e8, 8, 4);
    // chairs, a board of pinned sheets on the end wall, a radio set
    for (const [x, z] of [[tx - 2.0, tz], [tx + 0.5, tz + 1.5]]) B.chunk(0.5, 0.5, 0.5, 0x4a3a2a, x, 0.25, z);
    B.chunk(0.1, 1.6, 2.6, 0x3a3226, 23.95, 1.9, tz);
    for (let i = 0; i < 6; i++) B.piece(0.02, 0.4, 0.3, [0xd8d0b8, 0xc9c0a4, 0xb8b09a][i % 3], 23.88, 1.6 + (i % 2) * 0.5, tz - 0.9 + (i >> 1) * 0.6);
    B.chunk(0.7, 0.5, 0.5, 0x4d5a52, 23.5, 1.15, -2.6);
    B.chunk(0.9, 0.9, 0.6, 0x3a3c3f, 23.5, 0.45, -2.6);
    B.block(23.5, -2.6, 0.45, 0.3);
    B.keep(put(B.root, box(0.06, 0.06, 0.06, 0x6be08a, { glow: true }), 23.2, 1.3, -2.4));
  }

  // --------------------------------------------------------- quarters
  {
    // two bunks along the back wall, lockers by the door, a stove
    for (const x of [1.6, 4.6]) {
      for (const y of [0.45, 1.5]) {
        B.chunk(2.4, 0.18, 1.0, 0x3d4434, x, y, -10.2);
        B.piece(2.2, 0.12, 0.9, 0x6d7458, x, y + 0.14, -10.2);
        B.piece(0.5, 0.12, 0.7, 0xb8b4a8, x - 0.8, y + 0.22, -10.2);
      }
      for (const dx of [-1.15, 1.15]) B.piece(0.08, 1.8, 0.08, 0x3a3c3f, x + dx, 0.9, -9.75);
      B.block(x, -10.2, 1.2, 0.55);
    }
    for (let i = 0; i < 3; i++) B.chunk(0.6, 1.9, 0.5, [0x4f5a55, 0x56606a, 0x4f5a55][i], 6.6, 0.95, -9.8 + i * 0.65);
    B.block(6.6, -9.15, 0.3, 1.0);
    put(B.root, cyl(0.32, 0.8, 0x5a4636, { seg: 10 }), 1.0, 0.4, -6.4);
    B.block(1.0, -6.4, 0.34, 0.34);
    const flame = B.keep(put(B.root, cyl(0.18, 0.5, 0xffb347, { seg: 6, glow: true, radiusEnd: 0.02 }), 1.0, 1.0, -6.4));
    const fire = B.emit(new THREE.Vector3(1.0, 1.4, -6.4), 0xff9a40, 14, 7);
    B.animate((dt, t) => {
      const k = 0.8 + Math.sin(t * 13) * 0.12 + Math.sin(t * 29) * 0.08;
      fire.level = k;
      flame.scale.y = k;
    });
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), toon(0x6a3a2a));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(3.5, 0.01, -7.6);
    B.add(rug);
    B.emit(new THREE.Vector3(3.5, 2.6, -8.4), SODIUM, 10, 6);
  }

  // ------------------------------------------------------- the hall
  {
    // crates and drums, sandbags by the bay's doorway, cable along the floor
    for (const [x, z, s] of [[9.5, 3.8, 0.9], [10.4, 3.9, 0.7], [9.9, 3.8, 0.6]]) B.piece(s, s, s, 0x7a5f3e, x, s / 2 + (s < 0.65 ? 0.9 : 0), z, 0, rand(), 0);
    B.block(10, 3.9, 0.9, 0.5);
    for (let i = 0; i < 6; i++) B.lump(13.6 + i * 0.55, 0.2 + (i % 2) * 0.25, -4.4, 0.36, 0.18, 0.24, 0x8a7b5c);
    B.block(15, -4.4, 1.7, 0.3);
    B.groundCable(6, 2, 0.3, 20, 0.6);
    for (const x of [4, 11, 17]) {
      B.line([new THREE.Vector3(x, H, 0), new THREE.Vector3(x, 3.1, 0)]);
      put(B.root, cyl(0.26, 0.15, 0x2e3034, { seg: 8, radiusEnd: 0.1 }), x, 3.0, 0);
      put(B.root, cyl(0.15, 0.05, SODIUM, { seg: 8, glow: true }), x, 2.92, 0);
      B.emit(new THREE.Vector3(x, 2.4, 0), SODIUM, 12, 7);
      B.pool(x, 0, 2.4, SODIUM, 0.16);
    }
    // a cold strip light over the bay doorway
    B.keep(put(B.root, box(1.6, 0.05, 0.05, COLD, { glow: true }), 15.5, 3.4, -5.2));
  }
  B.finish();
  B.mergeStatic();
  setLowPoly(false);

  // lights: a small fixed set at the emitters (the base is small)
  for (const e of B.emitters) {
    const l = new THREE.PointLight(e.color, e.intensity, e.distance, 1.4);
    l.position.copy(e.pos);
    scene.add(l);
    e.light = l;
  }

  // ----------------------------------------------------------- crewman
  const crew = createCrew();
  crew.group.traverse((o) => o.isMesh && o.layers.enable(PLAYER_LAYER));
  scene.add(crew.group);
  const me = crew.group.position;
  me.set(10, 0, 0.5);
  const crewBox = () => ({ x: me.x, z: me.z, hx: 0.25, hz: 0.25, yaw: 0 });

  // ----------------------------------------------------------- stations
  const STATIONS = [
    { id: 'planning', name: 'Planning', at: new THREE.Vector3(17.6, 0, 1.8), focus: new THREE.Vector3(19.5, 0, 1.2), label: new THREE.Vector3(20, 2.3, 1.6), hit: [16.5, 0, -1, 23.5, 2, 4] },
    { id: 'repair', name: 'Repair bay', at: new THREE.Vector3(15.5, 0, -6.4), focus: new THREE.Vector3(18, 0, -9), label: new THREE.Vector3(18.5, 3.2, -10), hit: [14.5, 0, -13, 22.5, 3, -7] },
    { id: 'quarters', name: 'Quarters', at: new THREE.Vector3(4, 0, -4.2), focus: new THREE.Vector3(3.5, 0, -7.4), label: new THREE.Vector3(3.2, 2.6, -9), hit: [0.3, 0, -11, 7, 2.4, -5.5] },
  ];
  for (const s of STATIONS) {
    const [x0, y0, z0, x1, y1, z1] = s.hit;
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), new THREE.MeshBasicMaterial({ visible: false }));
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    m.userData.station = s;
    scene.add(m);
    s.mesh = m;
  }

  // -------------------------------------------------------------- UI
  const root = document.createElement('div');
  root.className = 'base';
  root.style.setProperty('--cursor', CURSOR);
  root.innerHTML = `
    ${STATIONS.map((s) => `<div class="base-tag" data-id="${s.id}">${s.name}</div>`).join('')}
    <div class="base-menu panel" hidden></div>
    <div class="base-hint panel">Walk with <b>WASD</b> or click where to go · walk up to a station and press <b>E</b>, or click it</div>
    <div class="base-fade"></div>
  `;
  const tags = new Map(STATIONS.map((s) => [s.id, root.querySelector(`.base-tag[data-id="${s.id}"]`)]));
  const menu = root.querySelector('.base-menu');
  const fade = root.querySelector('.base-fade');
  let open = null;
  let pending = null; // a station clicked: walk there, then open it

  function bankTotal() {
    try {
      return parseInt(localStorage.getItem('scavenger.bank'), 10) || 0;
    } catch {
      return 0;
    }
  }
  function openStation(s) {
    open = s;
    pending = null;
    walkTo = null;
    menu.hidden = false;
    hint.hidden = true;
    if (s.id === 'planning') {
      menu.innerHTML = `
        <h2>Planning</h2><p class="sub">Pick where to go next.</p>
        <div class="zone"><b>Zone 1 · The avenue</b><span>Panel blocks, a bridge, and the intersection beyond. A large quadruped holds it.</span><button type="button" data-deploy="avenue">Deploy</button></div>
        <div class="zone locked"><b>Zone 2 · ???</b><span>Not scouted yet.</span></div>
        <button type="button" class="back">Back</button>`;
    } else if (s.id === 'repair') {
      menu.innerHTML = `
        <h2>Repair bay</h2><p class="sub">Your T-55, up on the lift.</p>
        <div class="zone"><b>Scraps</b><span>${bankTotal()} in the bank.</span></div>
        <div class="zone locked"><b>Upgrades</b><span>Coming soon: spend scraps on the tank for good.</span></div>
        <button type="button" class="back">Back</button>`;
    } else {
      menu.innerHTML = `
        <h2>Quarters</h2><p class="sub">Bunks, lockers, a stove going.</p>
        <div class="zone locked"><b>Crew</b><span>Coming soon.</span></div>
        <button type="button" class="back">Back</button>`;
    }
    menu.querySelector('.back').addEventListener('click', closeStation);
    menu.querySelector('[data-deploy]')?.addEventListener('click', (e) => deploy(e.target.dataset.deploy));
  }
  function closeStation() {
    open = null;
    menu.hidden = true;
    hint.hidden = false;
  }
  const hint = root.querySelector('.base-hint');
  function deploy(id) {
    fade.classList.remove('off');
    setTimeout(() => onDeploy(id), 480);
  }

  // ---------------------------------------------------------- input
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400);
  const camTarget = new THREE.Vector3(10, 0.8, 0);
  const keys = new Set();
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let walkTo = null;
  const canvas = renderer.domElement;
  const onKeyDown = (e) => {
    if (e.code === 'Escape' && open) return closeStation();
    if ((e.code === 'KeyE' || e.code === 'Enter') && !open && near) return openStation(near);
    keys.add(e.code);
  };
  const onKeyUp = (e) => keys.delete(e.code);
  const onDown = (e) => {
    if (open) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(STATIONS.map((s) => s.mesh), false)[0];
    if (hit) {
      pending = hit.object.userData.station;
      walkTo = pending.at.clone();
      return;
    }
    const f = ray.intersectObjects(floors, false)[0];
    if (f) {
      walkTo = f.point.clone().setY(0);
      pending = null;
    }
  };
  const onBlur = () => keys.clear();

  // ----------------------------------------------------------- frame
  let near = null;
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
      canvas.addEventListener('pointerdown', onDown);
      canvas.style.cursor = CURSOR;
      pixel.setActorOutlines(true);
      closeStation();
      fade.classList.remove('off');
      requestAnimationFrame(() => requestAnimationFrame(() => fade.classList.add('off')));
    },
    exit() {
      root.remove();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.style.cursor = '';
      keys.clear();
    },
    resize(w, h) {
      const aspect = w / h;
      const viewH = Math.max(VIEW_H, 13 / aspect);
      camera.left = (-viewH * aspect) / 2;
      camera.right = (viewH * aspect) / 2;
      camera.top = viewH / 2;
      camera.bottom = -viewH / 2;
      camera.updateProjectionMatrix();
      pixel.setHeight(Math.round(viewH * ROWS_PER_UNIT));
    },
    frame(dt, t) {
      // walking: keys (screen-relative), or toward a clicked spot
      input.set(0, 0, 0);
      if (!open) {
        if (keys.has('KeyW') || keys.has('ArrowUp')) input.add(INPUT_FORWARD);
        if (keys.has('KeyS') || keys.has('ArrowDown')) input.sub(INPUT_FORWARD);
        if (keys.has('KeyD') || keys.has('ArrowRight')) input.add(INPUT_RIGHT);
        if (keys.has('KeyA') || keys.has('ArrowLeft')) input.sub(INPUT_RIGHT);
        if (input.lengthSq() > 0) {
          walkTo = null;
          pending = null;
        } else if (walkTo) {
          input.set(walkTo.x - me.x, 0, walkTo.z - me.z);
          if (input.length() < 0.2) {
            walkTo = null;
            input.set(0, 0, 0);
            if (pending) openStation(pending);
          }
        }
      }
      const moving = input.lengthSq() > 0.001;
      speed += ((moving ? 1 : 0) - speed) * Math.min(1, dt * 10);
      if (moving) {
        input.normalize();
        crew.group.rotation.y = approachAngle(crew.group.rotation.y, Math.atan2(-input.z, input.x), dt * 12);
        me.addScaledVector(input, WALK * dt);
        if (pushOut(me, crewBox, B.blocks)) {
          // walked into something on the way to a click: give up rather than grind
          if (walkTo && Math.random() < dt * 2) walkTo = null;
        }
      }
      crew.update(dt, t, speed);
      B.update(dt, t, {});
      for (const e of B.emitters) if (e.light) e.light.intensity = e.intensity * e.level;

      // the nearest station in reach
      near = null;
      for (const s of STATIONS) if (Math.hypot(me.x - s.at.x, me.z - s.at.z) < 2.2) near = s;

      // camera: on the crewman, or eased over to the open station
      camWant.copy(open ? open.focus : me).setY(0.8);
      camTarget.lerp(camWant, 1 - Math.exp(-dt * (open ? 4 : 6)));
      camera.position.copy(camTarget).add(CAM_OFFSET);
      camera.lookAt(camTarget);
      camera.updateMatrixWorld();
      pixel.render(scene, camera);

      // station tags over each, the near one lit with its key
      const rect = canvas.getBoundingClientRect();
      for (const s of STATIONS) {
        const tag = tags.get(s.id);
        v.copy(s.label).project(camera);
        tag.hidden = !!open || v.z > 1;
        tag.style.left = `${Math.round(rect.left + ((v.x + 1) / 2) * rect.width)}px`;
        tag.style.top = `${Math.round(rect.top + ((1 - v.y) / 2) * rect.height)}px`;
        const isNear = s === near;
        if (tag.classList.contains('near') !== isNear) {
          tag.classList.toggle('near', isNear);
          tag.innerHTML = isNear ? `<kbd>E</kbd>${s.name}` : s.name;
        }
      }
    },
  };
}
