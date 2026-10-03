// The game: drive the starter tank through a level with WASD or arrows, aim
// with the pointer, click or Space to fire. Fixed isometric game camera that
// follows the tank. Levels (src/levels) supply the scene, its lighting, the
// solid blocks the tank collides with, the colliders shells burst on, light
// emitters that share a small fixed pool of point lights, and optionally a
// script (tutorial prompts, enemy waves, objectives) driven through `api`.
import * as THREE from 'three';
import { createTank } from '../models/tank.js';
import { CombatFx } from '../render/combat.js';
import { wrapAngle, approachAngle } from '../models/kit.js';
import { injectDevKitStyles } from '../devkit/style.js';
import { LEVELS } from '../levels/index.js';
import { Enemies } from './enemies.js';
import { createHud } from './hud.js';
import { pushOut } from './collide.js';

const VIEW_H = 13; // world units visible vertically
// ~30 deg down; tank forward runs up-right on screen. The camera sits far
// back along this line (orthographic, so distance doesn't change the view)
// so tall foreground props never cross the near plane.
const CAM_OFFSET = new THREE.Vector3(-10, 8.2, 10).multiplyScalar(4);
const MAX_SPEED = 7.2;
const ACCEL = 15;
const TURN_RATE = 4;
const LAMP_LIGHTS = 6; // point lights shared by the level's emitters nearest the tank

const TANK_HP = 100;
const RELOAD = 1.8; // seconds between cannon shots
const CANNON_DAMAGE = 60;
const CANNON_SPLASH = 2.4;
const MG_RANGE = 12;
const MG_DAMAGE = 3;
const MG_ACCURACY = 0.8;

// Screen-relative input: W drives straight up the screen, D straight right.
const INPUT_FORWARD = new THREE.Vector3(1, 0, -1).normalize();
const INPUT_RIGHT = new THREE.Vector3(1, 0, 1).normalize();

// Tank footprint for collisions: hull, covers and the rear drums.
const TANK_BOX = { cx: -0.25, hx: 2.25, hz: 1.15 };

export function createGame({ renderer, pixel, level: startLevel }) {
  injectDevKitStyles();
  const canvas = renderer.domElement;
  const tank = createTank();
  const hud = createHud();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400);
  const camTarget = new THREE.Vector3();
  let scene, level, levelDef, combat, enemies, colliders, blocks, lamps, aimLine, aimMark;
  const run = { hp: TANK_HP, time: 0, over: false, won: false };
  let reload = 1;
  let speed = 0;
  let hasAim = false;
  let pointer = null;
  let client = null;
  let hovered = null;
  let touch = matchMedia('(pointer: coarse)').matches;
  hud.setTouch(touch);
  const pos = tank.group.position;

  // ------------------------------------------------------- level loading
  function loadLevel(id) {
    enemies?.dispose();
    levelDef = LEVELS.find((l) => l.id === id) || LEVELS[0];
    scene = new THREE.Scene();
    level = levelDef.build(scene);
    colliders = level.colliders;
    blocks = level.blocks;
    scene.add(tank.group);
    combat = new CombatFx(scene);
    combat.onImpact = onImpact;
    enemies = new Enemies(scene, combat);
    lamps = [];
    for (let i = 0; i < LAMP_LIGHTS; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 9, 1.4);
      scene.add(l);
      lamps.push(l);
    }
    // faint line from the barrel to where the shell would land
    aimLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]),
      new THREE.LineBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    aimLine.frustumCulled = false;
    aimMark = new THREE.Mesh(
      new THREE.RingGeometry(0.22, 0.34, 12),
      new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }),
    );
    scene.add(aimLine, aimMark);
    tank.group.position.set(level.spawn.x, 0, level.spawn.z);
    tank.group.rotation.y = level.spawn.yaw;
    Object.assign(run, { hp: TANK_HP, time: 0, over: false, won: false });
    speed = 0;
    reload = 1;
    hasAim = false;
    camTarget.set(level.spawn.x + 0.6, 0.8, level.spawn.z);
    hud.reset();
    hud.setHull(run.hp, TANK_HP);
    if (level.start) level.start(api);
    else if (touch) hud.prompt('Controls', 'Drag on the left to drive · tap to aim and fire', { seconds: 8 });
    else hud.prompt('Controls', '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> drive · pointer aims · click or <kbd>Space</kbd> fires', { seconds: 8 });
    if (canvas.isConnected && hud.root.isConnected) canvas.style.cursor = 'none';
    return levelDef.id;
  }

  // What level scripts can do.
  const api = {
    get tankPos() {
      return pos;
    },
    get touch() {
      return touch;
    },
    get killed() {
      return enemies.killed;
    },
    get enemiesAlive() {
      return enemies.alive.length;
    },
    spawnDog: (x, z, opts) => enemies.spawnDog(x, z, opts),
    prompt: (tag, html, opts) => hud.prompt(tag, html, opts),
    clearPrompt: () => hud.clearPrompt(),
    objective: (text) => hud.setObjective(text),
    marker: (p, label) => hud.setMarker(p, label),
    arrow: (target, html) => hud.setArrow(target, html),
    nearestEnemy: () => enemies.nearest(pos, 60),
    removeBlock(b) {
      const i = blocks.indexOf(b);
      if (i >= 0) blocks.splice(i, 1);
    },
    removeCollider(m) {
      const i = colliders.indexOf(m);
      if (i >= 0) colliders.splice(i, 1);
    },
    shake: (k) => (combat.shake = Math.max(combat.shake, k)),
    get combat() {
      return combat;
    },
    win() {
      if (run.over) return;
      run.over = true;
      run.won = true;
      hud.clearPrompt();
      hud.setMarker(null);
      const m = Math.floor(run.time / 60);
      const s = String(Math.floor(run.time % 60)).padStart(2, '0');
      hud.showEnd('win', 'Breakthrough', [['Time', `${m}:${s}`], ['Machines destroyed', enemies.killed], ['Hull', Math.ceil(run.hp)]], 'Play again', () => loadLevel(levelDef.id));
      canvas.style.cursor = '';
    },
  };

  // A shell burst: splash the machines, then let the level react (the gate).
  function onImpact(at, mesh) {
    for (const h of enemies.blast(at, CANNON_SPLASH, CANNON_DAMAGE)) {
      const p = new THREE.Vector3(h.e.pos.x, 1.2, h.e.pos.z);
      hud.damage(p, h.amount, 'big');
      if (h.killed) hud.damage(p.clone().setY(1.9), 0, 'kill');
    }
    level.onImpact?.(at, mesh, api);
  }

  function lose() {
    run.over = true;
    hud.clearPrompt();
    hud.setMarker(null);
    hud.showEnd('lose', 'Tank disabled', [['Machines destroyed', enemies.killed]], 'Retry', () => loadLevel(levelDef.id));
    canvas.style.cursor = '';
    combat.explode(pos.clone().setY(1.2));
  }

  function tankHit(damage) {
    if (run.over) return;
    run.hp -= damage;
    hud.setHull(run.hp, TANK_HP);
    hud.hurt();
    combat.shake = Math.max(combat.shake, 0.08);
    if (run.hp <= 0) lose();
  }

  // ------------------------------------------------------------ input
  const keys = new Set();
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const aimPoint = new THREE.Vector3();

  function fire() {
    if (run.over || reload < 1) return;
    reload = 0;
    combat.fireCannon(tank, hasAim ? aimPoint : null, [...colliders, ...enemies.hitMeshes()]);
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
  function aimAt(x, y) {
    const r = canvas.getBoundingClientRect();
    pointer = [((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1];
    client = [x, y];
  }

  // Touch: a floating stick on the left side drives; touching anywhere else
  // aims there (drag to adjust) and fires.
  const STICK_R = 56;
  const stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
  let fireOnAim = false;
  function setTouch(on) {
    if (touch === on) return;
    touch = on;
    hud.setTouch(on);
  }

  const onMove = (e) => {
    if (e.pointerType === 'touch') {
      if (e.pointerId === stick.id) {
        let dx = e.clientX - stick.ox;
        let dy = e.clientY - stick.oy;
        const len = Math.hypot(dx, dy);
        if (len > STICK_R) {
          dx *= STICK_R / len;
          dy *= STICK_R / len;
        }
        stick.x = dx / STICK_R;
        stick.y = dy / STICK_R;
        hud.setStick(true, stick.ox, stick.oy, stick.ox + dx, stick.oy + dy);
      } else aimAt(e.clientX, e.clientY);
      return;
    }
    aimAt(e.clientX, e.clientY);
  };
  const onDown = (e) => {
    if (e.pointerType === 'touch') {
      setTouch(true);
      const r = canvas.getBoundingClientRect();
      if (stick.id === null && e.clientX < r.left + r.width * 0.42) {
        Object.assign(stick, { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 });
        hud.setStick(true, e.clientX, e.clientY, e.clientX, e.clientY);
      } else {
        aimAt(e.clientX, e.clientY);
        fireOnAim = true; // fire once this frame's aim ray has landed
      }
      return;
    }
    setTouch(false);
    if (e.button === 0) fire();
  };
  const onUp = (e) => {
    if (e.pointerId !== stick.id) return;
    Object.assign(stick, { id: null, x: 0, y: 0 });
    hud.setStick(false);
  };
  const onBlur = () => {
    keys.clear();
    onUp({ pointerId: stick.id });
  };
  const onLeave = (e) => {
    if (e.pointerType !== 'touch') client = null;
  };

  function tankBox() {
    const yaw = tank.group.rotation.y;
    return { x: pos.x + Math.cos(yaw) * TANK_BOX.cx, z: pos.z - Math.sin(yaw) * TANK_BOX.cx, hx: TANK_BOX.hx, hz: TANK_BOX.hz, yaw };
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

  const input = new THREE.Vector3();
  const camWant = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  loadLevel(startLevel);

  return {
    enter() {
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', onBlur);
      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('pointerdown', onDown);
      canvas.addEventListener('pointerleave', onLeave);
      canvas.addEventListener('pointerup', onUp);
      canvas.addEventListener('pointercancel', onUp);
      canvas.style.cursor = run.over ? '' : 'none';
      hud.mount();
    },
    exit() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      onUp({ pointerId: stick.id });
      canvas.style.cursor = '';
      keys.clear();
      hud.unmount();
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
      if (!run.over) run.time += dt;
      reload = Math.min(1, reload + dt / RELOAD);

      // the hull turns toward the input direction and slows while turning
      input.set(0, 0, 0);
      if (!run.over) {
        if (keys.has('KeyW') || keys.has('ArrowUp')) input.add(INPUT_FORWARD);
        if (keys.has('KeyS') || keys.has('ArrowDown')) input.sub(INPUT_FORWARD);
        if (keys.has('KeyD') || keys.has('ArrowRight')) input.add(INPUT_RIGHT);
        if (keys.has('KeyA') || keys.has('ArrowLeft')) input.sub(INPUT_RIGHT);
        if (stick.id !== null) input.addScaledVector(INPUT_RIGHT, stick.x).addScaledVector(INPUT_FORWARD, -stick.y);
      }
      let want = 0;
      const throttle = stick.id !== null ? Math.min(1, Math.hypot(stick.x, stick.y) * 1.4) : 1;
      if (input.lengthSq() > 0.02) {
        input.normalize();
        const heading = Math.atan2(-input.z, input.x);
        tank.group.rotation.y = approachAngle(tank.group.rotation.y, heading, TURN_RATE * dt);
        const off = Math.abs(wrapAngle(heading - tank.group.rotation.y));
        want = MAX_SPEED * throttle * Math.max(0, Math.cos(off));
      }
      speed += THREE.MathUtils.clamp(want - speed, -ACCEL * dt, ACCEL * dt);
      const yaw = tank.group.rotation.y;
      pos.x += Math.cos(yaw) * speed * dt;
      pos.z += -Math.sin(yaw) * speed * dt;
      const bounds = level.bounds;
      pos.x = THREE.MathUtils.clamp(pos.x, bounds.minX, bounds.maxX);
      pos.z = THREE.MathUtils.clamp(pos.z, bounds.minZ, bounds.maxZ);
      if (pushOut(pos, tankBox, blocks)) speed *= 0.85; // scrape along blocks instead of sticking
      // ride up onto sidewalks and other raised ground
      const groundY = level.heightAt ? level.heightAt(pos.x, pos.z) : 0;
      pos.y += (groundY - pos.y) * (1 - Math.exp(-dt * 14));

      // camera follows; the aim is re-cast every frame so it tracks while driving
      camTarget.lerp(camWant.set(pos.x + 0.6, 0.8 + pos.y, pos.z), 1 - Math.exp(-dt * 6));
      camera.position.copy(camTarget).add(CAM_OFFSET);
      camera.lookAt(camTarget);
      camera.updateMatrixWorld();
      const targets = [...colliders, ...enemies.hitMeshes()];
      if (pointer) {
        ndc.set(pointer[0], pointer[1]);
        raycaster.setFromCamera(ndc, camera);
        const hits = raycaster.intersectObjects(targets, false);
        hovered = null;
        if (hits.length) {
          aimPoint.copy(hits[0].point);
          hasAim = true;
          hovered = hits[0].object.userData.enemy || null;
        }
      }
      level.light.follow(pos);
      if (fireOnAim) {
        fireOnAim = false;
        fire();
      }

      // machines
      enemies.update(dt, t, { tankPos: pos, blocks, heightAt: level.heightAt, onTankHit: tankHit });
      const mgTarget = run.over ? null : enemies.nearest(pos, MG_RANGE);
      const mgPoint = mgTarget ? enemies.aimPoint(mgTarget) : null;

      tank.update(dt, t, { aimPoint: hasAim && !run.over ? aimPoint : null, mgPoint, speed });
      // roof MG rounds: most of them land on the machine it's tracking
      for (const e of tank.events) {
        if (e.type !== 'mg' || !mgTarget?.alive || Math.random() > MG_ACCURACY) continue;
        const killed = enemies.damage(mgTarget, MG_DAMAGE);
        const p = e.target.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.4 + Math.random() * 0.3, (Math.random() - 0.5) * 0.4));
        hud.damage(p, MG_DAMAGE, 'mg');
        combat.fx.burst(e.target, { count: 5, speed: 5, color: 0xfff3c4, life: 0.2, size: 0.06, gravity: 10 });
        if (killed) hud.damage(p.clone().setY(p.y + 0.6), 0, 'kill');
      }
      combat.handleTankEvents(tank);
      combat.update(dt);
      level.update(dt, t, { combat, focus: camTarget, api });
      assignLamps();

      // aim line and landing mark
      const showAim = hasAim && !run.over;
      aimLine.visible = aimMark.visible = showAim;
      if (showAim) {
        const { position: m, direction: d, breech } = tank.muzzle();
        const shot = combat.traceShot(m, d, breech, aimPoint, targets);
        const a = aimLine.geometry.attributes.position;
        a.setXYZ(0, m.x, m.y, m.z);
        a.setXYZ(1, shot.target.x, shot.target.y, shot.target.z);
        a.needsUpdate = true;
        const n = shot.hit?.normal || tmp.set(0, 1, 0);
        aimMark.position.copy(shot.target).addScaledVector(n, 0.04);
        aimMark.lookAt(aimMark.position.clone().add(n));
        aimMark.material.opacity = reload >= 1 ? 0.65 : 0.25;
        aimLine.material.opacity = reload >= 1 ? 0.35 : 0.15;
      }
      // outline the machine under the reticle if the gun has a clear shot
      let outlined = null;
      if (hovered?.alive && !run.over) {
        const { position: m, direction: d, breech } = tank.muzzle();
        const toward = new THREE.Vector3(hovered.pos.x, 0.6, hovered.pos.z);
        const shot = combat.traceShot(m, toward.clone().sub(m).normalize(), breech, toward, targets);
        if (shot.hit?.mesh === hovered.hit) outlined = hovered;
      }
      enemies.setHover(outlined);
      hud.showReticle(!!client && !run.over);
      if (client) hud.setReticle(client[0], client[1], reload);
      hud.setKills(enemies.killed);

      combat.beginShake(camera);
      pixel.render(scene, camera);
      combat.endShake(camera);
      hud.update(dt, camera, canvas);
    },
    loadLevel,
    get levelId() {
      return levelDef.id;
    },
    // for tests and dev tools
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
      get enemies() {
        return enemies;
      },
      get run() {
        return run;
      },
      api,
      renderer,
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
