import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PixelRenderer } from './render/pixel.js';
import { Fx } from './render/fx.js';
import { createTank, SLOT_NAMES } from './models/tank.js';
import { glowMat, toon } from './models/kit.js';

const params = new URLSearchParams(location.search);
if (params.has('shot')) document.body.classList.add('shot');

// ------------------------------------------------------------ renderer
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

const pixel = new PixelRenderer(renderer, { height: Number(params.get('pixel')) || 270 });

// --------------------------------------------------------------- scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa9bdd1);

scene.add(new THREE.HemisphereLight(0xe4eeff, 0x8d8a82, 1.15));
const sun = new THREE.DirectionalLight(0xfff0d6, 2.3);
sun.position.set(-5, 10, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 });
sun.shadow.bias = -0.0006;
scene.add(sun);

// Ground: asphalt-ish disc with a chunky rim, tiled with a tiny noise texture.
function groundTexture() {
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
  tex.repeat.set(10, 10);
  return tex;
}
const ground = new THREE.Mesh(
  new THREE.CylinderGeometry(7, 7, 0.4, 48),
  [new THREE.MeshToonMaterial({ color: 0x59606b }), new THREE.MeshToonMaterial({ map: groundTexture() }), new THREE.MeshToonMaterial({ color: 0x59606b })],
);
ground.position.y = -0.2;
ground.receiveShadow = true;
scene.add(ground);

// --------------------------------------------------------------- tank
const tank = createTank();
scene.add(tank.group);

const partsEl = document.getElementById('parts');
for (const name of SLOT_NAMES) {
  const label = document.createElement('label');
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = true;
  cb.addEventListener('change', () => tank.setSlotVisible(name, cb.checked));
  label.append(cb, name);
  partsEl.append(label);
}

// A target for the roof MG to chase.
const target = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), glowMat(0xff3b3b));
scene.add(target);

// -------------------------------------------------------------- camera
const VIEW_H = 7.2;
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 80);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0.2, 0.8, 0);
controls.enableDamping = true;
controls.enablePan = false;
controls.minZoom = 0.6;
controls.maxZoom = 3.5;
controls.minPolarAngle = THREE.MathUtils.degToRad(20);
controls.maxPolarAngle = THREE.MathUtils.degToRad(85);

// Isometric default: the tank's +X (forward) runs up and to the right on screen.
function resetCamera() {
  camera.position.set(-10, 11.5, 10);
  camera.zoom = 1;
  controls.target.set(0.2, 0.8, 0);
  camera.updateProjectionMatrix();
  controls.update();
}
resetCamera();

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = w / h;
  camera.left = (-VIEW_H * aspect) / 2;
  camera.right = (VIEW_H * aspect) / 2;
  camera.top = VIEW_H / 2;
  camera.bottom = -VIEW_H / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  pixel.setSize(w, h);
}
window.addEventListener('resize', resize);
resize();

// ----------------------------------------------------------------- UI
const $ = (id) => document.getElementById(id);
const pxSlider = $('px');
pxSlider.value = pixel.height;
const showPx = () => ($('pxv').textContent = pixel.height + 'p');
showPx();
pxSlider.addEventListener('input', () => {
  pixel.setHeight(Number(pxSlider.value));
  showPx();
});
$('outline').addEventListener('change', (e) => pixel.setOutline(e.target.checked));
$('turntable').checked = params.get('turntable') === '1';
$('drive').checked = params.get('drive') === '1';
$('mg').checked = params.get('mg') !== '0';
$('reset').addEventListener('click', resetCamera);

// --------------------------------------------------------- aiming & fire
const fx = new Fx(scene);
const shells = [];
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.6);
const aimPoint = new THREE.Vector3(6, 0.6, -6);
let hasAim = false;

renderer.domElement.addEventListener('pointermove', (e) => {
  ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  if (raycaster.ray.intersectPlane(groundPlane, aimPoint)) hasAim = true;
});

let downAt = null;
renderer.domElement.addEventListener('pointerdown', (e) => (downAt = [e.clientX, e.clientY]));
renderer.domElement.addEventListener('pointerup', (e) => {
  if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 5) fireCannon();
  downAt = null;
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    fireCannon();
  }
});
$('fire').addEventListener('click', fireCannon);

function fireCannon() {
  const { position, direction } = tank.fire();
  fx.burst(position, { count: 6, speed: 2.5, color: 0xffd24a, life: 0.2, size: 0.14 });
  fx.burst(position, { count: 5, speed: 1.5, color: 0x8b9099, glow: false, life: 0.8, size: 0.2, grow: 0.6, gravity: -0.5 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.14), glowMat(0xffe27a));
  mesh.position.copy(position);
  mesh.lookAt(position.clone().add(direction));
  mesh.rotateY(-Math.PI / 2);
  scene.add(mesh);
  shells.push({ mesh, dir: direction.clone(), travelled: 0 });
}

// --------------------------------------------------------------- loop
const clock = new THREE.Timer();
clock.connect(document);
const mgPoint = new THREE.Vector3();
let driveAngle = 0;
let ready = false;

function frame() {
  clock.update();
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.getElapsed();

  let speed = 0;
  if ($('drive').checked) {
    driveAngle += dt * 0.5;
    const R = 3;
    tank.group.position.set(Math.cos(driveAngle) * R, 0, -Math.sin(driveAngle) * R);
    tank.group.rotation.y = driveAngle + Math.PI / 2;
    speed = R * 0.5;
  } else if (tank.group.position.lengthSq() > 0) {
    tank.group.position.set(0, 0, 0);
    tank.group.rotation.y = 0;
  }

  const a = t * 0.9;
  target.position.set(Math.cos(a) * 5.5, 0.4 + Math.sin(t * 3) * 0.08, -Math.sin(a * 1.3) * 5.5);
  target.rotation.y = t * 2;
  target.visible = $('mg').checked;
  mgPoint.copy(target.position);

  if (!hasAim && params.has('shot')) {
    if (params.get('aim') === 'front') aimPoint.set(30, 0.6, 0);
    else aimPoint.set(6, 0.6, -2.5);
  }
  tank.update(dt, t, {
    aimPoint: hasAim || params.has('shot') ? aimPoint : null,
    mgPoint: $('mg').checked ? mgPoint : null,
    speed,
  });

  for (let i = shells.length - 1; i >= 0; i--) {
    const s = shells[i];
    const step = 22 * dt;
    s.mesh.position.addScaledVector(s.dir, step);
    s.travelled += step;
    if (s.travelled > 8 || s.mesh.position.y < 0.1) {
      fx.explosion(new THREE.Vector3(s.mesh.position.x, 0.2, s.mesh.position.z));
      scene.remove(s.mesh);
      shells.splice(i, 1);
    }
  }
  fx.update(dt);

  if ($('turntable').checked) {
    const p = camera.position.clone().sub(controls.target);
    p.applyAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.5);
    camera.position.copy(controls.target).add(p);
  }
  controls.update();
  pixel.render(scene, camera);

  if (!ready) {
    ready = true;
    window.__ready = true;
  }
  requestAnimationFrame(frame);
}
frame();

window.__viewer = { camera, controls, pixel, tank, fireCannon };
