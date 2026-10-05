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
export function addDaylight(scene, { shadowSize = 7, shadowMap = 1024 } = {}) {
  scene.background = new THREE.Color(0xa9bdd1);
  scene.add(new THREE.HemisphereLight(0xe4eeff, 0x8d8a82, 1.15));
  const sun = new THREE.DirectionalLight(0xfff0d6, 2.3);
  sun.position.set(-5, 10, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowMap, shadowMap);
  Object.assign(sun.shadow.camera, { left: -shadowSize, right: shadowSize, top: shadowSize, bottom: -shadowSize, near: 1, far: 40 });
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

// Night rig for the Neon Ruins: cold moonlight with soft shadows, a deep
// blue ambient, and fog so the far end of the street falls into the dark.
export function addNight(scene, { shadowSize = 14, shadowMap = 2048 } = {}) {
  scene.background = new THREE.Color(0x0e1322);
  scene.fog = new THREE.Fog(0x0e1322, 26, 58);
  scene.add(new THREE.HemisphereLight(0x5a6aa0, 0x1c1a22, 1.0));
  const moon = new THREE.DirectionalLight(0xa9bbff, 1.2);
  moon.position.set(-6, 12, 5);
  moon.castShadow = true;
  moon.shadow.mapSize.set(shadowMap, shadowMap);
  Object.assign(moon.shadow.camera, { left: -shadowSize, right: shadowSize, top: shadowSize, bottom: -shadowSize, near: 1, far: 40 });
  moon.shadow.bias = -0.0006;
  scene.add(moon, moon.target);
  const offset = moon.position.clone();
  return {
    sun: moon,
    follow(p) {
      moon.target.position.copy(p);
      moon.position.copy(p).add(offset);
    },
  };
}

// How far back along its direction the dusk sun's shadow camera sits.
const SUN_BACK = 150;

// A follow function for a shadow-casting light: centres its shadow box on a
// point (the camera's target), snapped to whole shadow-map texels in the
// light's own frame so shadow edges hold still instead of crawling as the
// view moves.
function shadowFollower(light, offset, size) {
  const z = offset.clone().normalize();
  const x = new THREE.Vector3(0, 1, 0).cross(z).normalize();
  const y = z.clone().cross(x);
  const q = new THREE.Vector3();
  const cam = light.shadow.camera;
  // k: how much further out than usual the view reaches (wide-view parts,
  // a salvo's pull-back): the shadow box grows to keep up
  return (p, k = 1) => {
    const sz = size * Math.max(1, k);
    if (Math.abs(cam.right - sz) > 0.01) {
      Object.assign(cam, { left: -sz, right: sz, top: sz, bottom: -sz });
      cam.updateProjectionMatrix();
    }
    const texel = (2 * sz) / light.shadow.mapSize.x;
    const a = Math.round(p.dot(x) / texel) * texel;
    const b = Math.round(p.dot(y) / texel) * texel;
    q.copy(x).multiplyScalar(a).addScaledVector(y, b).addScaledVector(z, p.dot(z));
    light.target.position.copy(q);
    light.position.copy(q).add(offset);
  };
}

// Where the dusk sun sits relative to its target: low, from behind the far
// (north) side of the street. Levels use it to aim fake light shafts.
export const DUSK_SUN = new THREE.Vector3(7, 8.5, -30);

// Dusk rig for the first zones: a low golden sun behind the far-side
// buildings, so their long shadows fill the street and light spills through
// the gaps between them. A violet-to-amber sky, warm haze, and a cool ambient
// that keeps the shaded street readable.
export function addDusk(scene, { shadowSize = 18, shadowMap = 2048 } = {}) {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#2b2d55');
  grad.addColorStop(0.55, '#7a5a78');
  grad.addColorStop(1, '#e39a62');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 128);
  const sky = new THREE.CanvasTexture(c);
  sky.colorSpace = THREE.SRGBColorSpace;
  scene.background = sky;
  scene.fog = new THREE.Fog(0x6b5568, 79, 121); // the game camera sits ~65 units back
  scene.add(new THREE.HemisphereLight(0x9d97c8, 0x5a4a44, 2.1));
  const sun = new THREE.DirectionalLight(0xffbf7a, 5.2);
  // the sun sits far back along its direction, so every tall building
  // between it and the view is inside the shadow volume: with it close, a
  // far-side block was behind the near plane until you drove up to it, and
  // then its whole long shadow popped in at once
  const offset = DUSK_SUN.clone().setLength(SUN_BACK);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowMap, shadowMap);
  Object.assign(sun.shadow.camera, { left: -shadowSize, right: shadowSize, top: shadowSize, bottom: -shadowSize, near: 1, far: SUN_BACK + 60 });
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  sun.position.copy(offset);
  return { sun, follow: shadowFollower(sun, offset, shadowSize) };
}

// Where the dawn sun sits relative to its target: low in the east-north-east,
// so long cold-edged shadows reach back down the streets.
export const DAWN_SUN = new THREE.Vector3(28, 9, -14);

// Dawn rig (level 2): a pale rose-and-steel sky, a low warm sun just up,
// cool blue ambient and a pale haze.
export function addDawn(scene, { shadowSize = 22, shadowMap = 2048 } = {}) {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#34405e');
  grad.addColorStop(0.5, '#8d86a4');
  grad.addColorStop(1, '#f2c4a0');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 128);
  const sky = new THREE.CanvasTexture(c);
  sky.colorSpace = THREE.SRGBColorSpace;
  scene.background = sky;
  scene.fog = new THREE.Fog(0x9a96ac, 79, 121);
  scene.add(new THREE.HemisphereLight(0xb4c4e4, 0x56545e, 2.3));
  const sun = new THREE.DirectionalLight(0xffd6b4, 4.4);
  const offset = DAWN_SUN.clone().setLength(SUN_BACK);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowMap, shadowMap);
  Object.assign(sun.shadow.camera, { left: -shadowSize, right: shadowSize, top: shadowSize, bottom: -shadowSize, near: 1, far: SUN_BACK + 60 });
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  sun.position.copy(offset);
  return { sun, follow: shadowFollower(sun, offset, shadowSize) };
}

// Midday: a high sun from the south-west, a clear pale sky deepening to blue
// overhead, a light haze far off. Crisp, short shadows.
export const NOON_SUN = new THREE.Vector3(-17, 17, 13);
export function addNoon(scene, { shadowSize = 22, shadowMap = 2048 } = {}) {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#3f7fd0');
  grad.addColorStop(0.55, '#7fb0e4');
  grad.addColorStop(1, '#c4dcef');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 128);
  const sky = new THREE.CanvasTexture(c);
  sky.colorSpace = THREE.SRGBColorSpace;
  scene.background = sky;
  // a clear blue day: bluish sky light and haze, a warm sun low enough
  // for the buildings to throw long shadows across the street
  scene.fog = new THREE.Fog(0x9fc2e4, 80, 135);
  scene.add(new THREE.HemisphereLight(0x8fbcff, 0x4a5262, 1.5));
  const sun = new THREE.DirectionalLight(0xffe2b0, 3.4);
  const offset = NOON_SUN.clone().setLength(SUN_BACK);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowMap, shadowMap);
  Object.assign(sun.shadow.camera, { left: -shadowSize, right: shadowSize, top: shadowSize, bottom: -shadowSize, near: 1, far: SUN_BACK + 60 });
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  sun.position.copy(offset);
  return { sun, follow: shadowFollower(sun, offset, shadowSize) };
}
