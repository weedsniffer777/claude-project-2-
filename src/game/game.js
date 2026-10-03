// The game, for now: a proving ground. Drive the starter tank with WASD or
// arrows, aim with the pointer, click or Space to fire. Fixed isometric game
// camera that follows the tank. Concrete blocks are solid: the tank collides
// with them and shells burst on them.
import * as THREE from 'three';
import { createTank } from '../models/tank.js';
import { CombatFx } from '../render/combat.js';
import { addDaylight, groundTexture } from '../render/setup.js';
import { box, put, wrapAngle, approachAngle } from '../models/kit.js';
import { injectDevKitStyles } from '../devkit/style.js';

const VIEW_H = 13; // world units visible vertically
const CAM_OFFSET = new THREE.Vector3(-10, 8.2, 10); // ~30 deg down; tank forward runs up-right on screen
const MAX_SPEED = 5.5;
const ACCEL = 12;
const TURN_RATE = 3.4;
const ARENA = 38;

// World-relative input: W drives forward along the level (world +X, up-right
// on screen), D drives to the world's right (+Z, down-right on screen).
const INPUT_FORWARD = new THREE.Vector3(1, 0, 0);
const INPUT_RIGHT = new THREE.Vector3(0, 0, 1);

// Tank footprint for collisions: hull, covers and the rear drums.
const TANK_BOX = { cx: -0.25, hx: 2.25, hz: 1.15 };

export function createGame({ renderer, pixel }) {
  injectDevKitStyles();
  const canvas = renderer.domElement;
  const scene = new THREE.Scene();
  const daylight = addDaylight(scene, { shadowSize: 13, shadowMap: 2048 });

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(ARENA * 2 + 4, ARENA * 2 + 4), new THREE.MeshToonMaterial({ map: groundTexture(40) }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Solid concrete blocks. Each keeps a 2D oriented box for collisions.
  const props = new THREE.Group();
  scene.add(props);
  const blocks = [];
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 46; i++) {
    const x = (rand() - 0.5) * 66;
    const z = (rand() - 0.5) * 66;
    if (Math.hypot(x, z) < 7) continue;
    const w = 0.8 + rand() * 1.8;
    const d = 0.8 + rand() * 1.6;
    const h = 0.6 + rand() * 1.6;
    const mesh = put(props, box(w, h, d, rand() < 0.5 ? 0x8c8a80 : 0x6f7378, { r: 0.08 }), x, h / 2, z);
    mesh.rotation.y = rand() * Math.PI;
    blocks.push({ mesh, x, z, hx: w / 2, hz: d / 2, yaw: mesh.rotation.y });
  }
  const colliders = [ground, ...blocks.map((b) => b.mesh)];

  const tank = createTank();
  scene.add(tank.group);
  const combat = new CombatFx(scene);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 120);
  const camTarget = new THREE.Vector3(0.6, 0.8, 0);

  const hint = document.createElement('div');
  hint.className = 'dk-hint';
  const HINT = 'WASD or arrows to drive (W is forward) · move the pointer to aim · click or Space to fire';
  hint.textContent = HINT;
  let hintTimer = 0;

  // ------------------------------------------------------------ input
  const keys = new Set();
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const aimPoint = new THREE.Vector3();
  let hasAim = false;
  let pointer = null;

  function fire() {
    if (!combat.fireCannon(tank, hasAim ? aimPoint : null, colliders)) {
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

  // ------------------------------------------------------- collisions
  // 2D separating-axis test between the tank's box and a block's box.
  // Returns the push (x, z) that moves the tank out, or null.
  const axesOf = (yaw) => [
    [Math.cos(yaw), -Math.sin(yaw)],
    [Math.sin(yaw), Math.cos(yaw)],
  ];
  function separate(a, b) {
    const axA = axesOf(a.yaw);
    const axB = axesOf(b.yaw);
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    let best = null;
    for (const [ux, uz] of [...axA, ...axB]) {
      const ra = a.hx * Math.abs(axA[0][0] * ux + axA[0][1] * uz) + a.hz * Math.abs(axA[1][0] * ux + axA[1][1] * uz);
      const rb = b.hx * Math.abs(axB[0][0] * ux + axB[0][1] * uz) + b.hz * Math.abs(axB[1][0] * ux + axB[1][1] * uz);
      const dist = dx * ux + dz * uz;
      const overlap = ra + rb - Math.abs(dist);
      if (overlap <= 0) return null;
      if (!best || overlap < best.overlap) best = { overlap, x: -Math.sign(dist) * ux, z: -Math.sign(dist) * uz };
    }
    return best;
  }
  function tankBox() {
    const yaw = tank.group.rotation.y;
    return {
      x: pos.x + Math.cos(yaw) * TANK_BOX.cx,
      z: pos.z - Math.sin(yaw) * TANK_BOX.cx,
      hx: TANK_BOX.hx,
      hz: TANK_BOX.hz,
      yaw,
    };
  }
  // Push the tank out of any block it overlaps; returns true on contact.
  function resolveCollisions() {
    let hit = false;
    for (let pass = 0; pass < 2; pass++) {
      for (const b of blocks) {
        if (Math.abs(b.x - pos.x) > 5 || Math.abs(b.z - pos.z) > 5) continue;
        const push = separate(tankBox(), b);
        if (!push) continue;
        pos.x += push.x * push.overlap;
        pos.z += push.z * push.overlap;
        hit = true;
      }
    }
    return hit;
  }

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
      const viewH = Math.max(VIEW_H, 15 / aspect);
      camera.left = (-viewH * aspect) / 2;
      camera.right = (viewH * aspect) / 2;
      camera.top = viewH / 2;
      camera.bottom = -viewH / 2;
      camera.updateProjectionMatrix();
    },
    frame(dt, t) {
      // the hull turns toward the input direction and slows while turning
      input.set(0, 0, 0);
      if (keys.has('KeyW') || keys.has('ArrowUp')) input.add(INPUT_FORWARD);
      if (keys.has('KeyS') || keys.has('ArrowDown')) input.sub(INPUT_FORWARD);
      if (keys.has('KeyD') || keys.has('ArrowRight')) input.add(INPUT_RIGHT);
      if (keys.has('KeyA') || keys.has('ArrowLeft')) input.sub(INPUT_RIGHT);
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
      pos.x = THREE.MathUtils.clamp(pos.x, -ARENA, ARENA);
      pos.z = THREE.MathUtils.clamp(pos.z, -ARENA, ARENA);
      if (resolveCollisions()) speed *= 0.85; // scrape along blocks instead of sticking

      // camera follows; the aim is re-cast every frame so it tracks while driving
      camTarget.lerp(new THREE.Vector3(pos.x + 0.6, 0.8, pos.z), 1 - Math.exp(-dt * 6));
      camera.position.copy(camTarget).add(CAM_OFFSET);
      camera.lookAt(camTarget);
      if (pointer) {
        ndc.set(pointer[0], pointer[1]);
        camera.updateMatrixWorld();
        raycaster.setFromCamera(ndc, camera);
        const hits = raycaster.intersectObjects(colliders, false);
        if (hits.length) {
          aimPoint.copy(hits[0].point);
          hasAim = true;
        }
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
    // for tests and dev tools
    debug: {
      tank,
      blocks,
      fire,
      combat,
      setAim(v) {
        aimPoint.copy(v);
        hasAim = true;
      },
      press: (code, down) => (down ? keys.add(code) : keys.delete(code)),
    },
  };
}
