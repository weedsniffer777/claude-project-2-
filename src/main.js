// Game entry. Runs the game, with a dev kit button in the corner that opens
// developer tools (model viewer for now). Esc or "Back to game" returns.
import * as THREE from 'three';
import { createRenderer } from './render/setup.js';
import { createGame } from './game/game.js';
import { createModelViewer } from './devkit/modelViewer.js';
import { createDevKit } from './devkit/devkit.js';
import { MODELS } from './models/registry.js';
import { LEVELS } from './levels/index.js';

const params = new URLSearchParams(location.search);
if (params.has('shot')) document.body.classList.add('dk-shot');

const { renderer, pixel } = createRenderer({ pixelHeight: 540 }) // zoomed-out game camera: more pixels keep the tank's detail;
const game = createGame({ renderer, pixel, level: params.get('level') });
const viewer = createModelViewer({ renderer, pixel, models: MODELS, params, onExit: () => setMode(game) });
// The pixel grid is part of the art: always 540 rows, whatever the screen.
// Quality tiers only trade shadow detail and lamp lights. Auto starts phones one tier down and steps down whenever the
// frame rate stays low; it never steps back up (no flicker between tiers).
const TIERS = [
  { name: 'High', shadow: 2048, lamps: 6 },
  { name: 'Medium', shadow: 1024, lamps: 4 },
  { name: 'Low', shadow: 1024, lamps: 2 },
  { name: 'Potato', shadow: 512, lamps: 0 },
];
const mobile = matchMedia('(pointer: coarse)').matches;
let autoQuality = true;
let tier = -1;
function setTier(i) {
  i = Math.max(0, Math.min(TIERS.length - 1, i));
  if (i === tier) return;
  tier = i;
  const q = TIERS[i];
  game.setQuality(q);
}
setTier(params.has('quality') ? +params.get('quality') : mobile ? 1 : 0);
const perf = { t: 0, frames: 0, warm: 3 };
function watchFrameRate(dt) {
  if (!autoQuality || mode !== game) return;
  if (perf.warm > 0) return void (perf.warm -= dt); // let shaders compile first
  perf.t += dt;
  perf.frames++;
  if (perf.t < 2.5) return;
  const fps = perf.frames / perf.t;
  perf.t = perf.frames = 0;
  if (fps < 48 && tier < TIERS.length - 1) {
    setTier(tier + 1);
    perf.warm = 1.5;
  }
}

// Dev-only frame counter in the bottom-right corner (with the quality tier).
const fpsEl = document.createElement('div');
fpsEl.className = 'dk-fps';
document.body.append(fpsEl);
const fpsMeter = { t: 0, frames: 0 };
function countFrame(dt) {
  fpsMeter.t += dt;
  fpsMeter.frames++;
  if (fpsMeter.t < 0.5) return;
  fpsEl.textContent = `${Math.round(fpsMeter.frames / fpsMeter.t)} fps · ${TIERS[tier].name}${autoQuality ? ' (auto)' : ''}`;
  fpsMeter.t = fpsMeter.frames = 0;
}

const devkit = createDevKit({
  tools: [{ id: 'model-viewer', label: 'Model viewer', detail: 'Inspect models, loadout slots and weapon effects', open: () => setMode(viewer) }],
  settings: [
    {
      id: 'level',
      label: 'Level',
      options: LEVELS.map((l) => ({ value: l.id, label: l.name })),
      value: game.levelId,
      onChange: (id) => {
        game.loadLevel(id);
        setMode(game);
      },
    },
    {
      id: 'quality',
      label: 'Quality',
      options: [{ value: 'auto', label: 'Auto' }, ...TIERS.map((q, i) => ({ value: String(i), label: q.name }))],
      value: 'auto',
      onChange: (v) => {
        autoQuality = v === 'auto';
        if (!autoQuality) setTier(+v);
      },
    },
  ],
});

let mode = null;
function setMode(next) {
  if (next === mode) return;
  mode?.exit();
  mode = next;
  mode.enter();
  resize();
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  pixel.setSize(w, h);
  mode.resize(w, h);
}
window.addEventListener('resize', resize);
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Escape') return;
  if (devkit.isOpen) devkit.close();
  else if (mode === viewer) setMode(game);
});

setMode(params.get('devkit') === 'viewer' ? viewer : game);
window.__game = game.debug; // dev/test hook

const clock = new THREE.Timer();
clock.connect(document);
function frame() {
  clock.update();
  const raw = clock.getDelta();
  const dt = Math.min(raw, 0.05);
  watchFrameRate(raw);
  countFrame(raw);
  mode.frame(dt, clock.getElapsed());
  window.__ready = true;
  requestAnimationFrame(frame);
}
frame();
