// Standalone model viewer (viewer.html and the published artifact). The same
// dev tool the game opens from its dev kit, without the game around it.
import * as THREE from 'three';
import { createRenderer } from './render/setup.js';
import { createModelViewer } from './devkit/modelViewer.js';
import { MODELS } from './models/registry.js';

const params = new URLSearchParams(location.search);
if (params.has('shot')) document.body.classList.add('dk-shot');

const { renderer, pixel } = createRenderer({ pixelHeight: 400 });
const viewer = createModelViewer({ renderer, pixel, models: MODELS, params });
viewer.enter();

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  pixel.setSize(w, h);
  viewer.resize(w, h);
}
window.addEventListener('resize', resize);
resize();

const clock = new THREE.Timer();
clock.connect(document);
function frame() {
  clock.update();
  viewer.frame(Math.min(clock.getDelta(), 0.05), clock.getElapsed());
  window.__ready = true;
  requestAnimationFrame(frame);
}
frame();
