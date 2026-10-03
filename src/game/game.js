// The game, for now: a proving ground. Drive the starter tank with
// screen-relative WASD/arrows (W = up the screen), aim with the pointer,
// click or Space to fire. Fixed isometric game camera that follows the tank.
import * as THREE from 'three';
import { createTank } from '../models/tank.js';
import { CombatFx } from '../render/combat.js';
import { addDaylight, groundTexture } from '../render/setup.js';
import { box, put, wrapAngle, approachAngle } from '../models/kit.js';
import { injectDevKitStyles } from '../devkit/style.js';

const VIEW_H = 9;
const CAM_OFFSET = new THREE.Vector3(-10, 11.5, 10); // tank forward runs up-right on screen
const MAX_SPEED = 3.2;
const ACCEL = 6;
const TURN_RATE = 2.6;
// screen-relative input directions on the ground
const SCREEN_UP = new THREE.Vector3(1, 0, -1).normalize();
const SCREEN_RIGHT = new THREE.Vector3(1, 0, 1).normalize();

export function createGame({ renderer, pixel }) {
  injectDevKitStyles();
  const canvas = renderer.domElement;
  const scene = new THREE.Scene();
  const daylight = addDaylight(scene);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshToonMaterial({ map: groundTexture(40) }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  // scattered concrete blocks so movement reads
  const props = new THREE.Group();
  scene.add(props);
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 40; i++) {
    const x = (rand() - 0.5) * 60;
    const z = (rand() - 0.5) * 60;
    if (Math.hypot(x, z) < 6) continue;
    const s = 0.5 + rand() * 1.2;
    const h = s * (0.5 + rand());
    const b = put(props, box(s, h, s * (0.6 + rand() * 0.8), rand() < 0.5 ? 0x8c8a80 : 0x6f7378, { r: 0.08 }), x, h / 2, z);
    b.rotation.y = rand() * Math.PI;
  }

  const tank = createTank();
  scene.add(tank.group);
  const combat = new CombatFx(scene);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const camTarget = new THREE.Vector3(0.6, 0.8, 0);

  const hint = document.createElement('div');
  hint.className = 'dk-hint';
  const HINT = 'WASD or arrows to drive · move the pointer to aim · click or Space to fire';
  hint.textContent = HINT;
  let hintTimer = 0;

  // ------------------------------------------------------------ input
  const keys = new Set();
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.6);
  const aimPoint = new THREE.Vector3();
  let hasAim = false;
  let pointer = null;

  function fire() {
    if (!combat.fireCannon(tank, hasAim ? aimPoint : null)) {
      hint.textContent = 'The gun is lifted over the fuel drums. Traverse off the rear to fire.';
      hintTimer = 1.6;
    }
  }
  const onKeyDown = (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      fire();
      return;
    }
    keys.add(e.code);
  };
  const onKeyUp = (e) => keys.delete(e.code);
  const onMove = (e) => {
    const r = canvas.getBoundingClientRect();
    pointer = [((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1];
  };
  const onDown = (e) => {
    if (e.button === 0) fire();
  };
  const onBlur = () => keys.clear();

  // ------------------------------------------------------------ motion
  let speed = 0;
  const pos = tank.group.position;
  const input = new THREE.Vector3();

  return {
    enter() {
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', onBlur);
      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('pointerdown', onDown);
      document.body.append(hint);
    },
    exit() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      keys.clear();
      hint.remove();
    },
    resize(w, h) {
      const aspect = w / h;
      const viewH = Math.max(VIEW_H, 11 / aspect);
      camera.left = (-viewH * aspect) / 2;
      camera.right = (viewH * aspect) / 2;
      camera.top = viewH / 2;
      camera.bottom = -viewH / 2;
      camera.updateProjectionMatrix();
    },
    frame(dt, t) {
      // screen-relative drive: the hull turns toward the input, and slows
      // while it is still turning
      input.set(0, 0, 0);
      if (keys.has('KeyW') || keys.has('ArrowUp')) input.add(SCREEN_UP);
      if (keys.has('KeyS') || keys.has('ArrowDown')) input.sub(SCREEN_UP);
      if (keys.has('KeyD') || keys.has('ArrowRight')) input.add(SCREEN_RIGHT);
      if (keys.has('KeyA') || keys.has('ArrowLeft')) input.sub(SCREEN_RIGHT);
      let want = 0;
      if (input.lengthSq() > 0) {
        input.normalize();
        const heading = Math.atan2(-input.z, input.x);
        tank.group.rotation.y = approachAngle(tank.group.rotation.y, heading, TURN_RATE * dt);
        const off = Math.abs(wrapAngle(heading - tank.group.rotation.y));
        want = MAX_SPEED * Math.max(0, Math.cos(off));
      }
      speed += THREE.MathUtils.clamp(want - speed, -ACCEL * dt, ACCEL * dt);
      const yaw = tank.group.rotation.y;
      pos.x += Math.cos(yaw) * speed * dt;
      pos.z += -Math.sin(yaw) * speed * dt;
      pos.x = THREE.MathUtils.clamp(pos.x, -38, 38);
      pos.z = THREE.MathUtils.clamp(pos.z, -38, 38);

      // camera follows; aim is re-cast every frame so it tracks while driving
      camTarget.lerp(new THREE.Vector3(pos.x + 0.6, 0.8, pos.z), 1 - Math.exp(-dt * 6));
      camera.position.copy(camTarget).add(CAM_OFFSET);
      camera.lookAt(camTarget);
      if (pointer) {
        ndc.set(pointer[0], pointer[1]);
        camera.updateMatrixWorld();
        raycaster.setFromCamera(ndc, camera);
        if (raycaster.ray.intersectPlane(aimPlane, aimPoint)) hasAim = true;
      }
      daylight.follow(pos);

      tank.update(dt, t, { aimPoint: hasAim ? aimPoint : null, mgPoint: null, speed });
      combat.handleTankEvents(tank);
      combat.update(dt);
      if (hintTimer > 0) {
        hintTimer -= dt;
        if (hintTimer <= 0) hint.textContent = HINT;
      }
      combat.beginShake(camera);
      pixel.render(scene, camera);
      combat.endShake(camera);
    },
  };
}
