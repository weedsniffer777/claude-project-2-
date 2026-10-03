// The game: drive the starter tank through a level with WASD or arrows, aim
// with the pointer, click or Space to fire. Fixed isometric game camera that
// follows the tank. Levels (src/levels) supply the scene, its lighting, the
// solid blocks the tank collides with, the colliders shells burst on, and
// light emitters that share a small fixed pool of point lights.
import * as THREE from 'three';
import { createTank } from '../models/tank.js';
import { CombatFx } from '../render/combat.js';
import { wrapAngle, approachAngle } from '../models/kit.js';
import { injectDevKitStyles } from '../devkit/style.js';
import { LEVELS } from '../levels/index.js';

const VIEW_H = 13; // world units visible vertically
const CAM_OFFSET = new THREE.Vector3(-10, 8.2, 10); // ~30 deg down; tank forward runs up-right on screen
const MAX_SPEED = 5.5;
const ACCEL = 12;
const TURN_RATE = 3.4;
const LAMP_LIGHTS = 6; // point lights shared by the level's emitters nearest the tank

// Screen-relative input: W drives straight up the screen, D straight right.
// (The camera looks along world (1, 0, -1), so "up the screen" on the ground
// is that direction, and "right" is (1, 0, 1).)
const INPUT_FORWARD = new THREE.Vector3(1, 0, -1).normalize();
const INPUT_RIGHT = new THREE.Vector3(1, 0, 1).normalize();

// Tank footprint for collisions: hull, covers and the rear drums.
const TANK_BOX = { cx: -0.25, hx: 2.25, hz: 1.15 };

export function createGame({ renderer, pixel, level: startLevel }) {
  injectDevKitStyles();
  const canvas = renderer.domElement;
  const tank = createTank();
  let scene, level, levelDef, combat, colliders, blocks, lamps;

  // Builds a fresh scene for the level and drops the tank at its spawn.
  function loadLevel(id) {
    levelDef = LEVELS.find((l) => l.id === id) || LEVELS[0];
    scene = new THREE.Scene();
    level = levelDef.build(scene);
    colliders = level.colliders;
    blocks = level.blocks;
    scene.add(tank.group);
    combat = new CombatFx(scene);
    lamps = [];
    for (let i = 0; i < LAMP_LIGHTS; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 9, 1.4);
      scene.add(l);
      lamps.push(l);
    }
    tank.group.position.set(level.spawn.x, 0, level.spawn.z);
    tank.group.rotation.y = level.spawn.yaw;
    speed = 0;
    hasAim = false;
    camTarget.set(level.spawn.x + 0.6, 0.8, level.spawn.z);
    return levelDef.id;
  }

  // Hand the pooled point lights to the lit emitters nearest the tank.
  const nearest = [];
  function assignLamps() {
    nearest.length = 0;
    for (const e of level.emitters) {
      if (e.level <= 0.01) continue;
      const d = (e.pos.x - pos.x) ** 2 + (e.pos.z - pos.z) ** 2;
      if (d < 26 * 26) nearest.push([d, e]);
    }
    nearest.sort((a, b) => a[0] - b[0]);
    lamps.forEach((l, i) => {
      const e = nearest[i]?.[1];
      if (!e) {
        l.intensity = 0;
        return;
      }
      l.position.copy(e.pos);
      l.color.copy(e.color);
      l.distance = e.distance;
      l.intensity = e.intensity * e.level;
    });
  }

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 120);
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
  const aimPoint = new THREE.Vector3();
  let hasAim = false;
  let pointer = null;

  function fire() {
    combat.fireCannon(tank, hasAim ? aimPoint : null, colliders);
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
        const reach = 3 + Math.max(b.hx, b.hz);
        if (Math.abs(b.x - pos.x) > reach || Math.abs(b.z - pos.z) > reach) continue;
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
  loadLevel(startLevel);

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
      const bounds = level.bounds;
      pos.x = THREE.MathUtils.clamp(pos.x, bounds.minX, bounds.maxX);
      pos.z = THREE.MathUtils.clamp(pos.z, bounds.minZ, bounds.maxZ);
      if (resolveCollisions()) speed *= 0.85; // scrape along blocks instead of sticking
      // ride up onto sidewalks and other raised ground
      const groundY = level.heightAt ? level.heightAt(pos.x, pos.z) : 0;
      pos.y += (groundY - pos.y) * (1 - Math.exp(-dt * 14));

      // camera follows; the aim is re-cast every frame so it tracks while driving
      camTarget.lerp(new THREE.Vector3(pos.x + 0.6, 0.8 + pos.y, pos.z), 1 - Math.exp(-dt * 6));
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
      level.light.follow(pos);
      level.update(dt, t, { combat, focus: camTarget });
      assignLamps();

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
    loadLevel,
    get levelId() {
      return levelDef.id;
    },
    debug: {
      tank,
      get blocks() {
        return blocks;
      },
      get combat() {
        return combat;
      },
      get scene() {
        return scene;
      },
      loadLevel,
      fire,
      setAim(v) {
        aimPoint.copy(v);
        hasAim = true;
      },
      press: (code, down) => (down ? keys.add(code) : keys.delete(code)),
    },
  };
}
