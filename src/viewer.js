import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PixelRenderer } from './render/pixel.js';
import { Fx, Glow } from './render/fx.js';
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
  const viewH = Math.max(VIEW_H, 8.5 / aspect); // tall (phone) screens: keep the whole tank in frame
  camera.left = (-viewH * aspect) / 2;
  camera.right = (viewH * aspect) / 2;
  camera.top = viewH / 2;
  camera.bottom = -viewH / 2;
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
const fx = new Fx(scene, 220);
const glow = new Glow(scene);
const shells = [];
let shake = 0;
const hintEl = document.getElementById('hint');
const hintText = hintEl ? hintEl.innerHTML : '';
let hintTimer = 0;
function note(text) {
  if (!hintEl) return;
  hintEl.textContent = text;
  hintTimer = 1.6;
}
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

const SHELL_SPEED = 90; // near-instant: a bright streak, not a lobbed ball
const tmpV = new THREE.Vector3();

function fireCannon() {
  const shot = tank.fire();
  if (!shot) {
    note('The gun is lifted over the fuel drums. Traverse off the rear to fire.');
    return;
  }
  const { position, direction } = shot;
  // muzzle: hot core, big flash, forward tongue of flame, smoke, ground dust
  glow.flash(position, 0xfff4cf, 0.15, 0.7, 0.07);
  glow.flash(position, 0xffa640, 0.3, 1.35, 0.14);
  glow.flash(tmpV.copy(position).addScaledVector(direction, 0.7), 0xffc35a, 0.2, 0.75, 0.1);
  glow.light(position, 0xffa24a, 45, 0.16);
  fx.burst(position, { count: 10, speed: 5, color: 0xffd060, life: 0.16, size: 0.13 });
  fx.burst(position, { count: 12, speed: 2.4, color: 0x8b9099, glow: false, life: 1.3, size: 0.28, grow: 0.9, gravity: -0.6 });
  const dust = new THREE.Vector3(position.x, 0.08, position.z);
  fx.burst(dust, { count: 10, speed: 2.5, color: 0x9a8a6a, glow: false, life: 0.8, size: 0.2, grow: 0.8, gravity: -0.2 });
  shake = Math.max(shake, 0.12);

  // Land where the gun points, at the cursor's distance (or 9 units out).
  const flat = new THREE.Vector3(direction.x, 0, direction.z).normalize();
  let dist = 9;
  if (hasAim || params.has('shot')) dist = THREE.MathUtils.clamp(Math.hypot(aimPoint.x - position.x, aimPoint.z - position.z), 2.5, 14);
  const target = new THREE.Vector3(position.x, 0.05, position.z).addScaledVector(flat, dist);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 1.1), new THREE.MeshBasicMaterial({ color: 0xfff0b0 }));
  mesh.position.copy(position);
  mesh.lookAt(target);
  scene.add(mesh);
  shells.push({ mesh, from: position.clone(), target, travelled: 0, total: position.distanceTo(target) });
}

function explode(at) {
  const p = new THREE.Vector3(at.x, 0.25, at.z);
  glow.flash(p, 0xffffff, 0.3, 1.6, 0.1);
  glow.flash(p, 0xffb347, 0.6, 2.6, 0.32);
  glow.flash(p, 0xff6a2a, 0.8, 2.1, 0.5);
  glow.ring(new THREE.Vector3(at.x, 0.06, at.z), 0xffd59a, 0.4, 3.6, 0.4);
  glow.light(p, 0xff8c3a, 110, 0.35);
  glow.scorch(at, 1.1);
  fx.burst(p, { count: 18, speed: 7, color: 0xffd36b, life: 0.35, size: 0.24 });
  fx.burst(p, { count: 22, speed: 6, color: 0xff7a2e, life: 0.6, size: 0.22, gravity: 7 });
  fx.burst(p, { count: 16, speed: 2.6, color: 0x4a4e55, glow: false, life: 1.6, size: 0.42, grow: 0.8, gravity: -1.4 });
  fx.burst(p, { count: 14, speed: 7.5, color: 0x6b5a45, glow: false, life: 1.1, size: 0.12, gravity: 15 });
  shake = Math.max(shake, 0.35);
}

// Roof MG shots reported by the tank: star flash is on the tank; here go the
// tracer, the muzzle glow, the impact sparks and the brass flying out.
function handleTankEvents() {
  for (const e of tank.events) {
    if (e.type !== 'mg') continue;
    const hit = e.target.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.35, (Math.random() - 0.3) * 0.2, (Math.random() - 0.5) * 0.35));
    glow.tracer(e.muzzle, hit, 0xffe08a, 0.05, 0.07);
    glow.flash(e.muzzle, 0xffc860, 0.08, 0.38, 0.05);
    glow.light(e.muzzle, 0xffc060, 9, 0.06);
    glow.flash(hit, 0xffe9a0, 0.05, 0.25, 0.06);
    fx.burst(hit, { count: 4, speed: 3.5, color: 0xffd36b, life: 0.18, size: 0.06, gravity: 9 });
    const v = e.ejectDir.clone().multiplyScalar(1.6 + Math.random()).add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 1.8 + Math.random(), (Math.random() - 0.5) * 0.6));
    fx.spawn(e.eject, v, { color: 0xd9a743, life: 1.6, size: 0.065, gravity: 10 });
  }
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
    else if (params.get('aim') === 'back') aimPoint.set(-30, 0.6, 0.5);
    else aimPoint.set(6, 0.6, -2.5);
  }
  tank.update(dt, t, {
    aimPoint: hasAim || params.has('shot') ? aimPoint : null,
    mgPoint: $('mg').checked ? mgPoint : null,
    speed,
  });

  handleTankEvents();
  for (let i = shells.length - 1; i >= 0; i--) {
    const s = shells[i];
    const prev = s.mesh.position.clone();
    s.travelled = Math.min(s.total, s.travelled + SHELL_SPEED * dt);
    s.mesh.position.lerpVectors(s.from, s.target, s.travelled / s.total);
    glow.tracer(prev, s.mesh.position, 0xffd27a, 0.12, 0.12); // hot trail
    if (s.travelled >= s.total) {
      explode(s.target);
      scene.remove(s.mesh);
      s.mesh.geometry.dispose();
      shells.splice(i, 1);
    }
  }
  fx.update(dt);
  glow.update(dt);
  if (hintTimer > 0) {
    hintTimer -= dt;
    if (hintTimer <= 0 && hintEl) hintEl.innerHTML = hintText;
  }

  if ($('turntable').checked) {
    const p = camera.position.clone().sub(controls.target);
    p.applyAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.5);
    camera.position.copy(controls.target).add(p);
  }
  controls.update();
  // camera shake: offset only for this frame's render
  const shakeOffset = new THREE.Vector3((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  camera.position.add(shakeOffset);
  pixel.render(scene, camera);
  camera.position.sub(shakeOffset);
  shake *= Math.exp(-dt * 9);

  if (!ready) {
    ready = true;
    window.__ready = true;
  }
  requestAnimationFrame(frame);
}
frame();

window.__viewer = { camera, controls, pixel, tank, fireCannon, aimPoint };
