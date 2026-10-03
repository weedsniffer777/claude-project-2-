// Shared renderer setup for every page (game, standalone viewer).
import * as THREE from 'three';
import { PixelRenderer } from './pixel.js';

export function createRenderer({ pixelHeight = 270 } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  document.body.appendChild(renderer.domElement);
  const pixel = new PixelRenderer(renderer, { height: pixelHeight });
  return { renderer, pixel };
}

// Tiny noisy asphalt tile, nearest-filtered so it reads as pixel art.
export function groundTexture(repeat = 10) {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#7a828d';
  g.fillRect(0, 0, 32, 32);
  for (let i = 0; i < 90; i++) {
    g.fillStyle = Math.random() < 0.5 ? '#6f7782' : '#868e99';
    g.fillRect((Math.random() * 32) | 0, (Math.random() * 32) | 0, 1, 1);
  }
  g.fillStyle = '#6b727c';
  g.fillRect(0, 0, 32, 1);
  g.fillRect(0, 0, 1, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  return tex;
}

// Daylight rig used by the proving ground and the viewer. The sun's shadow
// box can follow a moving subject via `follow`.
export function addDaylight(scene) {
  scene.background = new THREE.Color(0xa9bdd1);
  scene.add(new THREE.HemisphereLight(0xe4eeff, 0x8d8a82, 1.15));
  const sun = new THREE.DirectionalLight(0xfff0d6, 2.3);
  sun.position.set(-5, 10, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 30 });
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);
  const offset = sun.position.clone();
  return {
    sun,
    follow(p) {
      sun.target.position.copy(p);
      sun.position.copy(p).add(offset);
    },
  };
}
