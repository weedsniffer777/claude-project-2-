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
  const dt = Math.min(clock.getDelta(), 0.05);
  mode.frame(dt, clock.getElapsed());
  window.__ready = true;
  requestAnimationFrame(frame);
}
frame();
