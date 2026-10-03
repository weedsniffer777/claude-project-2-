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
import { PLAYER_LAYER } from '../render/pixel.js';
import { Pickups } from './pickups.js';
import { Crushing } from './crushing.js';
import { PARTS, attachPart, statsFor, partModel, BASE_STATS } from './parts.js';

const VIEW_H = 13; // world units visible vertically
const PIXEL_ROWS = 540; // the game's pixel grid, fixed on every screen
// ~30 deg down; tank forward runs up-right on screen. The camera sits far
// back along this line (orthographic, so distance doesn't change the view)
// so tall foreground props never cross the near plane.
const CAM_OFFSET = new THREE.Vector3(-10, 8.2, 10).multiplyScalar(4);
const MAX_SPEED = 7.2;
const ACCEL = 15;
const TURN_RATE = 4;
const LAMP_LIGHTS = 6; // max point lights shared by the level's emitters nearest the tank

const MG_ACCURACY = 0.8;
// boost (the fuel drums as rockets); time, cooldown and speed scale with parts
const BOOST_SPEED = MAX_SPEED * 2.2;
const RAM_DAMAGE = 80;
// the multiplier: each kill adds one (up to x5); when no kill comes for a
// while it steps down one at a time
const MULT_HOLD = 4; // seconds a fresh kill keeps it
const MULT_STEP = 2.2; // seconds per step down after that
const MULT_MAX = 5;
const SLOW_MO = 0.15; // game speed under a tutorial spotlight
const BANK_KEY = 'scavenger.bank';
function bank(add = 0) {
  try {
    const n = (parseInt(localStorage.getItem(BANK_KEY), 10) || 0) + add;
    if (add) localStorage.setItem(BANK_KEY, String(n));
    return n;
  } catch {
    return null;
  }
}

// Screen-relative input: W drives straight up the screen, D straight right.
const INPUT_FORWARD = new THREE.Vector3(1, 0, -1).normalize();
const INPUT_RIGHT = new THREE.Vector3(1, 0, 1).normalize();

// Tank footprint for collisions: hull, covers and the rear drums.
const TANK_BOX = { cx: -0.25, hx: 2.25, hz: 1.15 };

export function createGame({ renderer, pixel, level: startLevel, onExit = null }) {
  injectDevKitStyles();
  const canvas = renderer.domElement;
  const tank = createTank();
  // the tank is drawn into the team mask for its outline (solid parts only)
  tank.group.traverse((o) => {
    if ((o.isMesh || o.isInstancedMesh) && !o.material.transparent && !o.userData.fx) o.layers.enable(PLAYER_LAYER);
  });
  const hud = createHud();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400);
  const camTarget = new THREE.Vector3();
  let scene, level, levelDef, combat, enemies, colliders, blocks, lamps, aimLine, aimMark, pickups, crushing;
  const run = { hp: 100, time: 0, over: false, won: false };
  let stats = { ...BASE_STATS };
  const partMeshes = [];
  let debug = null;
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
    enemies.onKill = onKill;
    pickups?.dispose();
    pickups = new Pickups(scene);
    crushing = new Crushing(level.crushables, { combat, removeBlock: api.removeBlock, removeCollider: api.removeCollider });
    lamps = [];
    applyQuality();
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
    // a fresh run: bare tank, no parts, no rockets
    for (const m of partMeshes) m.removeFromParent();
    partMeshes.length = 0;
    tank.setFlameStyle('normal');
    stats = statsFor([]);
    Object.assign(run, {
      hp: stats.maxHp,
      time: 0,
      over: false,
      won: false,
      scrap: 0,
      parts: [],
      rockets: false,
      boost: 0,
      boostCd: 0,
      boosts: 0,
      shots: 0,
      crushed: 0,
      drops: 0,
      chain: 0,
      chainT: 0,
      mode: 'field',
      spot: null,
      locked: false,
      boss: null,
      hitstop: 0,
      depot: null,
      fading: false,
      auto: null,
      autoKeep: false,
      paused: false,
    });
    hud.showPause(null);
    hud.showContinue(null);
    hud.showPicker(null);
    speed = 0;
    reload = 1;
    hasAim = false;
    queued = 0;
    tank.setRocket(0, false);
    camTarget.set(level.spawn.x + 0.6, 0.8, level.spawn.z);
    hud.reset();
    hud.setHull(run.hp, stats.maxHp);
    hud.setScrap(0);
    // a scripted level (the tutorial) hands out the main gun and the scraps
    // counter as it introduces them; anywhere else they're there from the start
    run.gun = !level.start;
    hud.showScrap(!level.start);
    if (level.start) level.start(api);
    else if (touch) hud.prompt('Controls', 'Stick drives · tap anywhere to aim and fire', { seconds: 8 });
    else hud.prompt('Controls', '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> drive · pointer aims · click or <kbd>Space</kbd> fires', { seconds: 8 });
    if (canvas.isConnected && hud.root.isConnected) canvas.style.cursor = 'none';
    return levelDef.id;
  }

  // Quality: shadow-map size and how many point lights the lamps share.
  // Changing the light count recompiles shaders once, so it only happens on
  // a quality change, never per frame.
  const quality = { shadow: 2048, lamps: LAMP_LIGHTS };
  function applyQuality() {
    for (const l of lamps) l.removeFromParent();
    lamps = [];
    for (let i = 0; i < quality.lamps; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 9, 1.4);
      scene.add(l);
      lamps.push(l);
    }
    const sun = level.light.sun;
    if (sun.shadow.mapSize.x !== quality.shadow) {
      sun.shadow.mapSize.set(quality.shadow, quality.shadow);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
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
    spawnHound: (x, z, opts) => enemies.spawnHound(x, z, opts),
    get run() {
      return run;
    },
    get mgActive() {
      return mgActive;
    },
    get reloading() {
      return reload < 1;
    },
    // nearest scrap lying on the ground (for the tutorial)
    nearestDrop() {
      let best = null;
      let bd = Infinity;
      for (const p of pickups.list) {
        if (p.homing) continue;
        const d = p.pos.distanceToSquared(pos);
        if (d < bd) {
          bd = d;
          best = p.pos;
        }
      }
      return best;
    },
    abilityScreen: () => {
      const c = hud.abilityCenter();
      return { screen: [c.x, c.y], r: 70 };
    },
    // Slow the game and darken the screen except round the targets until
    // `until()` says the player has done the thing.
    spotlight(spec, until, { maxTime = 3 } = {}) {
      run.spot = { until, t: 0, maxTime: Math.min(maxTime, 3) }; // never holds the game up for long
      hud.setSpot(spec);
    },
    get spotlit() {
      return !!run.spot;
    },
    sectors: (names, current) => hud.setSectors(names, current),
    // Walk from `from` along `dir` until the point is just outside what the
    // camera shows (whatever the view size, optics included): a spawn point
    // that is out of sight but as close as possible.
    offscreen(from, dir, margin = 1.5, maxSteps = 80) {
      const p = from.clone();
      const v = new THREE.Vector3();
      for (let i = 0; i < maxSteps; i++) {
        v.copy(p).setY(1).project(camera);
        if (Math.abs(v.x) > 1 + margin * 0.06 || Math.abs(v.y) > 1 + margin * 0.1) return p;
        p.addScaledVector(dir, 0.5);
      }
      return p;
    },
    setBounds(b) {
      level.bounds = b;
    },
    teleport(x, z, yaw) {
      pos.set(x, level.heightAt ? level.heightAt(x, z) : 0, z);
      tank.group.rotation.y = yaw;
      speed = 0;
      camTarget.set(x + 0.6, 0.8 + pos.y, z);
    },
    // fade to black, run fn (move the tank, set up what's next), fade back
    transition(fn) {
      if (run.fading) return;
      run.fading = true;
      run.locked = true;
      hud.fade(true);
      setTimeout(() => {
        pickups.collectAll(collect);
        fn();
        hud.fade(false);
        if (run.mode === 'field') run.locked = false;
        run.fading = false;
      }, 420);
    },
    giveRockets() {
      run.rockets = true;
    },
    enableGun() {
      run.gun = true;
    },
    revealScraps() {
      hud.showScrap(true, true);
    },
    boss(e, name = 'Large quadruped') {
      run.boss = e ? { e, name } : null;
      if (!e) hud.setBoss(null, null);
    },
    // Into a checkpoint: the tank rolls on through the shack door as the
    // screen fades, and comes out in the checkpoint interior already driving
    // onto the repair plate. A pick of parts pops up (or skip), then Continue
    // drives it out; it fades back to the street still rolling, out of the
    // shack's back door. gift: 'boost' rigs the drums as boosters.
    depot(shack, { offers, gift = null, onLeave }) {
      if (run.mode === 'depot') return;
      const room = level.depotRoom;
      run.mode = 'depot';
      run.locked = true;
      queued = 0;
      hud.setArrow(null);
      hud.setSpot(null);
      hud.clearPrompt();
      run.spot = null;
      run.depot = { shack, room, step: 'enter', offers, gift, onLeave, t: 0, fieldBounds: level.bounds, focus: null };
      level.bounds = { ...level.bounds, maxX: shack.x0 + 4 };
      run.auto = new THREE.Vector3(shack.x0 + 3, 0, pos.z * 0.5);
      setCursor();
      api.transition(() => {
        enemies.retire(); // whatever was left behind stays behind
        room.reset();
        room.setOffers(offers);
        level.bounds = room.bounds;
        const keep = speed;
        api.teleport(room.entry.x - 2, room.entry.z, room.entry.yaw);
        speed = Math.max(keep, 4);
        run.depot.step = 'in';
        run.auto = room.plate;
      });
    },
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
    // break a crushable from the script (an airstrike, say)
    crush(c, from = { x: c.footprint.x - 1, z: c.footprint.z, yaw: 0 }) {
      if (!c.done) crushing.crush(c, from);
    },
    // splash damage from the script (bombs)
    blast(at, radius, damage) {
      for (const h of enemies.blast(at, radius, damage)) {
        const p = new THREE.Vector3(h.e.pos.x, 1.2, h.e.pos.z);
        hud.damage(p, h.amount, 'big');
        if (h.killed) hud.damage(p.clone().setY(1.9), 0, 'kill');
      }
    },
    get enemies() {
      return enemies.alive;
    },
    get combat() {
      return combat;
    },
    win(title = 'Zone cleared') {
      if (run.over) return;
      run.over = true;
      run.won = true;
      pickups.collectAll(collect);
      hud.clearPrompt();
      hud.setMarker(null);
      hud.setSpot(null);
      run.spot = null;
      const m = Math.floor(run.time / 60);
      const s = String(Math.floor(run.time % 60)).padStart(2, '0');
      const total = bank(run.scrap);
      hud.setBoss(null, null);
      hud.setArrow(null);
      // the tank drives on out of the shot; the camera stays where it is
      level.bounds = { minX: -1e4, maxX: 1e4, minZ: -1e4, maxZ: 1e4 };
      const yaw = tank.group.rotation.y;
      run.auto = new THREE.Vector3(pos.x + Math.cos(yaw) * 40, 0, pos.z - Math.sin(yaw) * 40);
      run.autoKeep = true;
      setTimeout(() => {
        hud.showEnd(
          'win',
          title,
          [['Time', `${m}:${s}`], ['Enemies destroyed', enemies.killed], ['Scraps picked up', run.scrap]],
          onExit ? 'Exit' : 'Play again',
          () => (onExit ? onExit() : loadLevel(levelDef.id)),
          `+${run.scrap} scraps${total != null ? ` · ${total} total` : ''}`,
          partCards(),
        );
        setCursor();
      }, 900);
    },
  };
  let mgActive = false;

  // A machine died: kill chain, scrap and the odd repair spark, and a
  // freeze-frame when the cannon blew it apart.
  function onKill(e, blasted) {
    run.chain = Math.min(MULT_MAX, Math.max(1, run.chain) + (run.chainT > 0 ? 1 : 0));
    run.chainT = MULT_HOLD;
    const mult = run.chain;
    const at = new THREE.Vector3(e.pos.x, 0.8 * e.stats.scale, e.pos.z);
    pickups.spawn(at, e.stats.scrap > 10 ? 16 : e.stats.scrap, 'scrap', e.stats.scrap > 10 ? Math.ceil(e.stats.scrap / 16) * mult : mult);
    run.drops++;
    if (e.stats.scale > 1.5) pickups.spawn(at, 3, 'repair', 15);
    else if (Math.random() < 0.12) pickups.spawn(at, 1, 'repair', 12);
    if (blasted) run.hitstop = Math.max(run.hitstop, e.stats.scale > 1.5 ? 0.25 : 0.075);
    if (run.chain >= 2) hud.damage(at.clone().setY(at.y + 1.2), 0, 'chain', `x${mult}`);
  }

  function collect(p) {
    if (p.kind === 'repair') {
      const before = run.hp;
      run.hp = Math.min(stats.maxHp, run.hp + p.value);
      hud.setHull(run.hp, stats.maxHp);
      if (run.hp > before) hud.damage(pos.clone().setY(2.2), run.hp - before, 'heal');
      combat.fx.burst(pos.clone().setY(1.4), { count: 8, speed: 3, color: 0x5fe6ff, life: 0.3, size: 0.07, gravity: 4 });
    } else {
      run.scrap += p.value;
      hud.setScrap(run.scrap);
      combat.glow.flash(pos.clone().setY(1.4), 0xffd08a, 0.1, 0.5, 0.06);
    }
  }

  // A shell burst: splash the machines, then let the level react (the gate).
  function onImpact(at, mesh) {
    for (const h of enemies.blast(at, stats.splash, stats.cannonDamage)) {
      const p = new THREE.Vector3(h.e.pos.x, 1.2, h.e.pos.z);
      hud.damage(p, h.amount, 'big');
      if (h.killed) hud.damage(p.clone().setY(1.9), 0, 'kill');
    }
    // a shell wrecks whatever it lands on or next to: barricades, the gate,
    // cars, junk, poles (not the container walls)
    for (const c of level.crushables || []) {
      if (c.armored || c.done) continue;
      const f = c.footprint;
      const reach = c.breakable ? 1.2 : 0.7;
      if (Math.abs(at.x - f.x) < f.hx + reach && Math.abs(at.z - f.z) < f.hz + reach) {
        crushing.crush(c, { x: at.x - (f.x - at.x || 0.5), z: at.z - (f.z - at.z), yaw: 0 });
        if (c.scrap) pickups.spawn(new THREE.Vector3(f.x, 0.8, f.z), c.scrap, 'scrap', 1);
      }
    }
    level.onImpact?.(at, mesh, api);
  }

  function lose() {
    run.over = true;
    hud.clearPrompt();
    hud.setMarker(null);
    hud.setSpot(null);
    hud.setBoss(null, null);
    run.spot = null;
    const kept = Math.floor(run.scrap / 2);
    const total = bank(kept);
    hud.showEnd(
      'lose',
      'Tank disabled',
      [['Enemies destroyed', enemies.killed], ['Scraps picked up', run.scrap]],
      'Retry',
      () => loadLevel(levelDef.id),
      `Half recovered: +${kept} scraps${total != null ? ` · ${total} total` : ''}`,
      partCards(),
      onExit ? ['Exit', () => onExit()] : null,
    );
    setCursor();
    combat.explode(pos.clone().setY(1.2));
  }

  function tankHit(damage) {
    if (run.over || run.mode !== 'field') return;
    run.hp -= damage * stats.armor;
    hud.setHull(run.hp, stats.maxHp);
    hud.hurt();
    combat.shake = Math.max(combat.shake, 0.08);
    if (run.hp <= 0) lose();
  }

  // ------------------------------------------------------------ input
  const keys = new Set();
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const aimPoint = new THREE.Vector3();

  // A click or tap queues the shot: the turret swings onto the aim point and
  // the cannon fires the moment it bears (or after a short wait at most), so
  // shots always go where you pointed, never where the barrel happened to be.
  let queued = 0; // seconds left on a queued shot
  function fire() {
    if (run.over || run.mode !== 'field' || run.locked || !run.gun) return;
    queued = 0.7;
  }
  function boost() {
    if (!run.rockets || run.over || run.mode !== 'field' || run.locked || run.boostCd > 0) return;
    run.boost = stats.boostTime;
    run.boostCd = stats.boostCooldown;
    run.boosts++;
    combat.shake = Math.max(combat.shake, 0.2);
    for (const n of tank.rocketNozzles()) combat.glow.flash(n, 0xffd08a, 0.2, 1.2, 0.12);
  }
  function tryFire(dt) {
    if (queued <= 0) return;
    queued -= dt;
    if (run.over) return void (queued = 0);
    const aligned = !hasAim || tank.aimError() < 0.06;
    if (reload < 1 || (!aligned && queued > 0)) {
      if (reload < 1 && queued <= 0) queued = 0; // don't keep a stale click through a reload
      return;
    }
    queued = 0;
    reload = 0;
    run.shots++;
    combat.fireCannon(tank, hasAim ? aimPoint : null, [...colliders, ...enemies.hitMeshes()]);
  }
  // Esc: pause (and resume)
  function setPaused(on) {
    if (on && (run.over || run.fading)) return;
    run.paused = on;
    keys.clear();
    hud.showPause(
      on
        ? {
            resume: () => setPaused(false),
            restart: () => {
              setPaused(false);
              loadLevel(levelDef.id);
            },
            exit: onExit
              ? () => {
                  setPaused(false);
                  onExit();
                }
              : null,
          }
        : null,
    );
    setCursor();
  }
  const onKeyDown = (e) => {
    if (e.code === 'Escape') {
      const devMenu = document.querySelector('.dk-menu');
      if (!devMenu || devMenu.hidden) setPaused(!run.paused); // (Esc closes the dev kit first)
      return;
    }
    if (run.paused) return;
    if (e.code === 'Space') {
      e.preventDefault();
      fire();
      return;
    }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyE') {
      if (!e.repeat) boost();
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
  const STICK_R = 56; // how far the knob travels
  const STICK_GRAB = 96; // touches this close to the stick grab it; anything else fires
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
        hud.setStick(true, dx, dy);
      } else aimAt(e.clientX, e.clientY);
      return;
    }
    aimAt(e.clientX, e.clientY);
  };
  const onDown = (e) => {
    if (e.pointerType === 'touch') {
      setTouch(true);
      const c = hud.stickCenter();
      const a = hud.abilityCenter();
      if (run.rockets && Math.hypot(e.clientX - a.x, e.clientY - a.y) < 64) {
        boost();
        return;
      }
      if (stick.id === null && Math.hypot(e.clientX - c.x, e.clientY - c.y) < STICK_GRAB) {
        Object.assign(stick, { id: e.pointerId, ox: c.x, oy: c.y, x: 0, y: 0 });
        onMove(e); // the knob jumps straight to the thumb
      } else {
        aimAt(e.clientX, e.clientY);
        fireOnAim = true; // fire once this frame's aim ray has landed
      }
      return;
    }
    setTouch(false);
    if (e.button === 0) fire();
    if (e.button === 2) boost();
  };
  const onContext = (e) => e.preventDefault();
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

  // The checkpoint stop, step by step: enter (fade) -> in (drive onto the
  // plate) -> repair -> pick (cards, or skip) -> fit (crane) -> done
  // (Continue) -> out (drive for the door, fading back to the street).
  function depotFrame(dt) {
    const st = run.depot;
    st.t += dt;
    if (st.step === 'in' && !run.auto) {
      st.step = 'repair';
      st.t = 0;
      speed = 0;
    }
    if (st.step === 'repair') {
      if (run.hp < stats.maxHp) {
        run.hp = Math.min(stats.maxHp, run.hp + dt * 80);
        hud.setHull(run.hp, stats.maxHp);
      }
      if (Math.random() < dt * 30) combat.fx.spawn(new THREE.Vector3(pos.x + (Math.random() - 0.5) * 3.5, 0.1, pos.z + (Math.random() - 0.5) * 2), new THREE.Vector3((Math.random() - 0.5) * 2, 3 + Math.random() * 3, (Math.random() - 0.5) * 2), { color: 0xffd36b, life: 0.4, size: 0.06, gravity: 12, glow: true });
      if (st.t > 0.8 && run.hp >= stats.maxHp - 0.01) {
        if (st.gift === 'boost') run.rockets = true; // the drums get rigged as boosters
        st.step = 'pick';
        showPicker();
      }
    }
    // leaving: start the fade while still rolling for the door
    if (st.step === 'out' && pos.x > st.room.outside.x - 4) {
      st.step = 'gone';
      api.transition(() => {
        const keep = Math.max(speed, 4);
        st.shack.openOut();
        level.bounds = st.fieldBounds;
        api.teleport(st.shack.outside.x - 2.5, st.shack.outside.z, 0);
        speed = keep;
        run.mode = 'field';
        run.locked = false;
        run.depot = null;
        run.auto = null;
        setCursor();
        st.onLeave();
      });
    }
  }
  function showPicker() {
    const st = run.depot;
    hud.showPicker(
      st.offers.map((id) => ({ id, ...PARTS[id] })),
      (id) => pick(id),
      () => done(),
      // hovering a card swings the camera over to that part's pallet
      (id) => {
        const pad = id && st.room.pads.find((p) => p.offer === id);
        st.focus = pad ? new THREE.Vector3(pad.x, 0, pad.z) : null;
      },
    );
  }
  function pick(id) {
    const st = run.depot;
    if (!st || st.step !== 'pick') return;
    st.step = 'fit';
    st.focus = null;
    hud.showPicker(null);
    st.room.install(id, () => new THREE.Vector3(pos.x, 0, pos.z), {
      onFit() {
        run.parts.push(id);
        const g = attachPart(tank, id);
        partMeshes.push(g, ...(g.userData.extra || []));
        const was = stats.maxHp;
        stats = statsFor(run.parts);
        tank.setFlameStyle(stats.afterburner ? 'afterburner' : 'normal');
        if (lastSize) game.resize(...lastSize); // optics widen the view
        run.hp = Math.min(stats.maxHp, run.hp + (stats.maxHp - was) + (PARTS[id].heal || 0));
        hud.setHull(run.hp, stats.maxHp);
        combat.fx.burst(pos.clone().setY(1.6), { count: 30, speed: 6, color: 0xffd36b, life: 0.45, size: 0.07, gravity: 12 });
        combat.glow.flash(pos.clone().setY(1.6), 0xfff0c8, 0.2, 1.4, 0.1);
        combat.shake = Math.max(combat.shake, 0.15);
      },
      onDone: () => done(),
    });
  }
  function done() {
    const st = run.depot;
    if (!st || (st.step !== 'pick' && st.step !== 'fit')) return;
    st.step = 'done';
    st.focus = null;
    hud.showPicker(null);
    hud.showContinue(() => {
      if (st.step !== 'done') return;
      hud.showContinue(null);
      st.step = 'opening';
      st.room.openDoor();
      // roll for the door as it goes up
      const wait = () => {
        if (st.room.doorOpen < 0.35) return void setTimeout(wait, 60);
        st.step = 'out';
        run.auto = st.room.outside;
        run.autoKeep = true;
      };
      wait();
    });
  }
  // The parts fitted this run, each with a little pre-rendered picture of
  // its model for the results screen.
  const partShots = new Map();
  function partCards() {
    return run.parts.map((id) => {
      if (!partShots.has(id)) partShots.set(id, id === 'afterburner' ? boostPicture(true, 'afterburner', 72, 48, bigUpArrow).toDataURL() : snapshot(partModel(id), 72, 48, PARTS[id].badge === 'up' ? upArrow : null));
      return { ...PARTS[id], image: partShots.get(id) };
    });
  }
  // a white pixel arrow on the right of a picture: an improved version
  function upArrow(g, W, H) {
    const x = W - 11;
    const y = 8;
    const rows = ['....X....', '...XXX...', '..XXXXX..', '.XXXXXXX.', 'XXXXXXXXX', '...XXX...', '...XXX...', '...XXX...', '...XXX...'];
    rows.forEach((r, j) => [...r].forEach((ch, i) => {
      if (ch !== 'X') return;
      g.fillStyle = '#000';
      g.fillRect(x + i - 1, y + j - 1, 3, 3);
    }));
    g.fillStyle = '#ffffff';
    rows.forEach((r, j) => [...r].forEach((ch, i) => ch === 'X' && g.fillRect(x + i, y + j, 1, 1)));
  }
  // a big white arrow up the right side: an improved version of an ability
  function bigUpArrow(g, W, H) {
    const s = Math.max(1, Math.floor(H / 22));
    const rows = ['.....X.....', '....XXX....', '...XXXXX...', '..XXXXXXX..', '.XXXXXXXXX.', 'XXXXXXXXXXX', '...XXXXX...', '...XXXXX...', '...XXXXX...', '...XXXXX...', '...XXXXX...'];
    const x = W - rows[0].length * s - 3;
    const y = Math.round((H - rows.length * s) / 2);
    for (const [col, pad] of [['#000', 1], ['#ffffff', 0]]) {
      g.fillStyle = col;
      rows.forEach((r, j) => [...r].forEach((ch, i) => ch === 'X' && g.fillRect(x + i * s - pad, y + j * s - pad, s + pad * 2, s + pad * 2)));
    }
  }
  // The boost, close up from the side: the tank's own rear drum swung out,
  // idle or firing (in the normal or the improved flame). Drawn once each.
  const boostPics = new Map();
  let boostTank = null;
  function boostPicture(firing, style = 'normal', W = 32, H = 32, decorate = null) {
    const key = `${firing}|${style}|${W}|${H}|${!!decorate}`;
    if (boostPics.has(key)) return boostPics.get(key);
    boostTank ??= createTank();
    const tk = boostTank;
    tk.setFlameStyle(style);
    tk.setRocket(1, firing, 0.3);
    tk.group.updateWorldMatrix(true, true);
    const nozzle = tk.rocketNozzles().reduce((a, b) => (b.z > a.z ? b : a)); // the near drum
    const target = nozzle.clone().add(new THREE.Vector3(firing ? 0.15 : 0.45, 0.05, 0));
    const half = firing ? 0.95 : 0.75;
    const pic = snapshotCanvas(tk.group, W, H, decorate, { target, dir: new THREE.Vector3(0.12, 0.3, 1), half, aspectFit: true });
    boostPics.set(key, pic);
    return pic;
  }
  function snapshot(model, W = 72, H = 48, decorate = null) {
    return snapshotCanvas(model, W, H, decorate).toDataURL();
  }
  // view: optional { target, dir, half } framing a close-up instead of the
  // whole model
  function snapshotCanvas(model, W = 72, H = 48, decorate = null, view = null) {
    const rt = new THREE.WebGLRenderTarget(W, H);
    rt.texture.colorSpace = THREE.SRGBColorSpace; // read back display colours, not linear
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xdfe6f0, 0x504a44, 2.4));
    const sun = new THREE.DirectionalLight(0xffe2c0, 3.2);
    sun.position.set(-2, 4, 3);
    sc.add(sun, model);
    const bb = new THREE.Box3().setFromObject(model);
    const c = view ? view.target : bb.getCenter(new THREE.Vector3());
    const size = view ? view.half : bb.getSize(new THREE.Vector3()).length() * 0.5 || 1;
    const cam = view ? new THREE.OrthographicCamera((-size * W) / H, (size * W) / H, size, -size, 0.1, 100) : new THREE.OrthographicCamera(-size * 1.05, size * 1.05, size * 0.7, -size * 0.7, 0.1, 100);
    cam.position.copy(c).add((view ? view.dir.clone() : new THREE.Vector3(-1, 0.85, 1)).normalize().multiplyScalar(20));
    cam.lookAt(c);
    const was = renderer.getRenderTarget();
    const clear = renderer.getClearColor(new THREE.Color());
    const alpha = renderer.getClearAlpha();
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(sc, cam);
    const px = new Uint8Array(W * H * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, W, H, px);
    renderer.setRenderTarget(was);
    renderer.setClearColor(clear, alpha);
    rt.dispose();
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const img = cv.getContext('2d').createImageData(W, H);
    for (let y = 0; y < H; y++) img.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4); // flip rows
    cv.getContext('2d').putImageData(img, 0, 0);
    decorate?.(cv.getContext('2d'), W, H);
    sc.remove(model);
    return cv;
  }

  // the pointer: the gun's reticle while fighting, a pixel arrow elsewhere
  function setCursor() {
    if (!canvas.isConnected) return;
    canvas.style.cursor = run.over || run.paused || run.mode === 'depot' ? hud.cursor : 'none';
  }

  // second roof MG (Twin MG part): turns on its own and takes the nearest
  // walker the first MG isn't already on
  const mg2 = { timer: 0, target: null };
  const mgWorld = new THREE.Vector3();
  function twinMg(dt, t, first) {
    const g = partMeshes.find((m) => m.userData.pivot);
    if (!g || run.over || run.mode !== 'field' || dt <= 0) return;
    let best = null;
    let bd = stats.mgRange ** 2;
    for (const e of enemies.alive) {
      if (e === first) continue;
      const d = (e.pos.x - pos.x) ** 2 + (e.pos.z - pos.z) ** 2;
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    const target = best || first;
    if (!target) return;
    const pivot = g.userData.pivot;
    pivot.getWorldPosition(mgWorld);
    const aim = enemies.aimPoint(target);
    const want = wrapAngle(Math.atan2(-(aim.z - mgWorld.z), aim.x - mgWorld.x) - tank.group.rotation.y - tank.turret.rotation.y);
    pivot.rotation.y = approachAngle(pivot.rotation.y, want, 9 * dt);
    pivot.rotation.z = THREE.MathUtils.clamp(Math.atan2(aim.y - mgWorld.y, Math.hypot(aim.x - mgWorld.x, aim.z - mgWorld.z)), -0.3, 0.9);
    if (Math.abs(wrapAngle(want - pivot.rotation.y)) > 0.3) return;
    mg2.timer -= dt;
    if (mg2.timer > 0 || Math.sin(t * 2.4 + 1.5) < -0.3) return;
    mg2.timer = 0.08;
    const muzzle = pivot.localToWorld(g.userData.muzzle.clone());
    const hit = aim.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.35, (Math.random() - 0.3) * 0.2, (Math.random() - 0.5) * 0.35));
    combat.glow.tracer(muzzle, hit, 0xffe08a, 0.05, 0.07);
    combat.glow.flash(muzzle, 0xffc860, 0.08, 0.38, 0.05);
    combat.fx.burst(hit, { count: 4, speed: 3.5, color: 0xffd36b, life: 0.18, size: 0.06, gravity: 9 });
    if (Math.random() > MG_ACCURACY) return;
    const killed = enemies.damage(target, stats.mgDamage);
    const p = hit.clone().add(new THREE.Vector3(0, 0.5, 0));
    hud.damage(p, stats.mgDamage, 'mg');
    if (killed) hud.damage(p.clone().setY(p.y + 0.6), 0, 'kill');
  }

  const input = new THREE.Vector3();
  let dustCarry = 0;
  const camWant = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  loadLevel(startLevel);


  let lastSize = null;
  const game = {
    enter() {
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', onBlur);
      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('pointerdown', onDown);
      canvas.addEventListener('contextmenu', onContext);
      canvas.addEventListener('pointerleave', onLeave);
      canvas.addEventListener('pointerup', onUp);
      canvas.addEventListener('pointercancel', onUp);
      setCursor();
      pixel.setActorOutlines(true);
      pixel.setHeight(PIXEL_ROWS); // the model viewer may have changed it
      hud.mount();
    },
    exit() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('contextmenu', onContext);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      onUp({ pointerId: stick.id });
      canvas.style.cursor = '';
      pixel.setActorOutlines(false);
      keys.clear();
      hud.unmount();
    },
    resize(w, h) {
      lastSize = [w, h];
      const aspect = w / h;
      const viewH = Math.max(VIEW_H, 15 / aspect) * stats.view;
      camera.left = (-viewH * aspect) / 2;
      camera.right = (viewH * aspect) / 2;
      camera.top = viewH / 2;
      camera.bottom = -viewH / 2;
      camera.updateProjectionMatrix();
      // keep the same pixels per world unit on every screen: portrait shows
      // more of the world, so it gets more rows, not bigger pixels
      pixel.setHeight(Math.round((viewH * PIXEL_ROWS) / VIEW_H));
    },
    frame(realDt, t) {
      if (debug?.timeScale) realDt *= debug.timeScale; // tests only
      if (run.paused) {
        // the world holds still under the menu
        pixel.render(scene, camera);
        hud.update(0, camera, canvas);
        return;
      }
      // world time: frozen for a beat on a cannon kill, crawling under a
      // tutorial spotlight
      let dt = realDt;
      if (run.hitstop > 0) {
        run.hitstop -= realDt;
        dt = 0;
      } else if (run.spot) dt = realDt * SLOW_MO;
      if (run.spot) {
        run.spot.t += realDt;
        if (run.spot.until() || run.spot.t > run.spot.maxTime || run.over) {
          run.spot = null;
          hud.setSpot(null);
        }
      }
      if (!run.over) run.time += dt;
      reload = Math.min(1, reload + dt / stats.reload);
      run.boostCd = Math.max(0, run.boostCd - dt);
      if (run.chain > 0) {
        run.chainT -= dt;
        if (run.chainT <= 0) {
          run.chain--;
          run.chainT = run.chain > 1 ? MULT_STEP : 0;
          if (run.chain <= 1) run.chain = 0;
        }
      }

      // the hull turns toward the input direction and slows while turning
      input.set(0, 0, 0);
      const canDrive = !run.over && !run.locked;
      if (canDrive) {
        if (keys.has('KeyW') || keys.has('ArrowUp')) input.add(INPUT_FORWARD);
        if (keys.has('KeyS') || keys.has('ArrowDown')) input.sub(INPUT_FORWARD);
        if (keys.has('KeyD') || keys.has('ArrowRight')) input.add(INPUT_RIGHT);
        if (keys.has('KeyA') || keys.has('ArrowLeft')) input.sub(INPUT_RIGHT);
        if (stick.id !== null) input.addScaledVector(INPUT_RIGHT, stick.x).addScaledVector(INPUT_FORWARD, -stick.y);
      }
      const boosting = run.boost > 0;
      let want = 0;
      let accel = ACCEL;
      let throttle = stick.id !== null ? Math.min(1, Math.hypot(stick.x, stick.y) * 1.4) : 1;
      // driven by the game (into and out of depots)
      if (run.auto) {
        const dx = run.auto.x - pos.x;
        const dz = run.auto.z - pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.35) {
          run.auto = null;
          if (!run.autoKeep) speed = 0;
          run.autoKeep = false;
        } else {
          input.set(dx, 0, dz);
          throttle = run.autoKeep ? 1 : THREE.MathUtils.clamp(dist / 2, 0.45, 1);
        }
      }
      if (input.lengthSq() > 0.02) {
        input.normalize();
        const heading = Math.atan2(-input.z, input.x);
        tank.group.rotation.y = approachAngle(tank.group.rotation.y, heading, TURN_RATE * (boosting ? 0.45 : 1) * dt);
        const off = Math.abs(wrapAngle(heading - tank.group.rotation.y));
        want = MAX_SPEED * throttle * Math.max(0, Math.cos(off));
      }
      if (boosting) {
        run.boost -= dt;
        want = BOOST_SPEED * stats.boostSpeed;
        accel = 60;
      }
      speed += THREE.MathUtils.clamp(want - speed, -accel * dt, accel * dt);
      const yaw = tank.group.rotation.y;
      const before = tmp.copy(pos);
      const bx = before.x;
      const bz = before.z;
      pos.x += Math.cos(yaw) * speed * dt;
      pos.z += -Math.sin(yaw) * speed * dt;
      const bounds = level.bounds;
      pos.x = THREE.MathUtils.clamp(pos.x, bounds.minX, bounds.maxX);
      pos.z = THREE.MathUtils.clamp(pos.z, bounds.minZ, bounds.maxZ);
      // drive through junk (before the blocks push back), rockets and the
      // dozer blade break heavy stuff too
      const ram = boosting || (stats.crushHeavy && Math.abs(speed) > 2.5);
      crushing.update(dt, tankBox(), {
        ram,
        speed,
        onCrush(c) {
          run.crushed++;
          speed *= c.kind === 'car' ? 0.75 : 0.9;
          if (c.scrap) pickups.spawn(new THREE.Vector3(c.footprint.x, 0.6, c.footprint.z), c.scrap, 'scrap', 1);
        },
      });
      if (pushOut(pos, tankBox, blocks)) speed *= boosting ? 0.97 : 0.85; // scrape along blocks instead of sticking
      // ride up onto sidewalks and other raised ground
      const groundY = level.heightAt ? level.heightAt(pos.x, pos.z) : 0;
      pos.y += (groundY - pos.y) * (1 - Math.exp(-dt * 14));
      const vel = new THREE.Vector3((pos.x - bx) / Math.max(dt, 1e-4), 0, (pos.z - bz) / Math.max(dt, 1e-4));

      // rocket ram and dozer blade: machines in the way take a beating
      if (run.mode === 'field' && !run.over) {
        const ramDmg = boosting ? RAM_DAMAGE : Math.abs(speed) > 3 ? stats.ramDamage : 0;
        if (ramDmg > 0) {
          for (const h of enemies.ram({ ...tankBox(), hx: TANK_BOX.hx + 0.3 }, ramDmg, vel)) {
            const p = new THREE.Vector3(h.e.pos.x, 1.3, h.e.pos.z);
            hud.damage(p, h.amount, 'big');
            if (h.killed) hud.damage(p.clone().setY(2), 0, 'kill');
            combat.fx.burst(p, { count: 12, speed: 6, color: 0xffd36b, life: 0.3, size: 0.07, gravity: 12 });
            combat.shake = Math.max(combat.shake, 0.25);
            if (h.killed) run.hitstop = Math.max(run.hitstop, 0.06);
          }
        }
      }

      // fuel-can rockets: drums swing round, flames and smoke out the back
      const rk = THREE.MathUtils.clamp(tank.rocketK + (boosting ? dt * 8 : -dt * 3), 0, 1);
      tank.setRocket(rk, boosting, t);
      if (boosting && dt > 0) {
        for (const n of tank.rocketNozzles()) {
          const back = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
          for (let i = 0; i < 2; i++) {
            if (i && stats.afterburner && Math.random() < 0.6) continue; // burns cleaner: less smoke
            combat.puffs.spawn(n.clone().addScaledVector(back, 0.3), back.clone().multiplyScalar(4 + Math.random() * 3).add(new THREE.Vector3((Math.random() - 0.5) * 1.5, 0.6, (Math.random() - 0.5) * 1.5)), {
              // improved boost: mostly the usual orange, hot blue/pink right at the nozzle
              color: i ? 0x6b6a6f : stats.afterburner ? [0xffa040, 0xff9a5a, 0xff7ad0, 0x9fdcff][(Math.random() * 4) | 0] : 0xffa040,
              s0: 0.14,
              s1: i ? 0.5 : 0.28,
              life: i ? 0.7 : 0.18,
              drag: 3,
              lift: 0.8,
              fadeAt: 0.3,
            });
          }
          if (Math.random() < 0.5) combat.fx.spawn(n, back.clone().multiplyScalar(6).add(new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3)), { color: 0xffd36b, life: 0.3, size: 0.07, gravity: 6, glow: true });
          combat.glow.light(n, stats.afterburner ? 0xff8f7a : 0xff8a2a, 12, 0.05);
        }
        combat.shake = Math.max(combat.shake, 0.06);
      }

      // tracks kick up slush and dust behind them
      const moving = Math.abs(speed);
      if (moving > 0.8 && dt > 0) {
        dustCarry += dt * (moving / MAX_SPEED) * (8 + Math.random() * 10); // irregular, not a steady stream
        const c = Math.cos(yaw);
        const sn = Math.sin(yaw);
        while (dustCarry > 1) {
          dustCarry -= 1;
          for (const side of [-1, 1]) {
            const lx = speed > 0 ? -1.85 : 1.8;
            const lz = side * 0.95;
            if (Math.random() < 0.35) continue; // one track or the other, not always both
            const jl = lx + (Math.random() - 0.5) * 0.8;
            const jz = lz + (Math.random() - 0.5) * 0.5;
            const at = new THREE.Vector3(pos.x + jl * c + jz * sn, pos.y + 0.06, pos.z - jl * sn + jz * c);
            const v = new THREE.Vector3(-c * Math.sign(speed) * (0.6 + Math.random()), 0.5 + Math.random() * 0.6, sn * Math.sign(speed) * (0.6 + Math.random())).add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0, (Math.random() - 0.5) * 0.8));
            combat.puffs.spawn(at, v, {
              // dirty slush and grit: muted, flattened, never two alike
              color: [0x8f8a80, 0x7d786f, 0x9a958b, 0x6f6b64][(Math.random() * 4) | 0],
              s0: 0.04 + Math.random() * 0.05,
              s1: 0.12 + Math.random() * 0.2 + (moving / MAX_SPEED) * 0.06,
              life: 0.3 + Math.random() * 0.45,
              drag: 2 + Math.random() * 3,
              lift: 0.1 + Math.random() * 0.25,
              stretch: 1.6 + Math.random() * 1.2,
              fadeAt: 0.2 + Math.random() * 0.3,
            });
          }
        }
      }

      // camera follows; the aim is re-cast every frame so it tracks while driving
      camWant.set(pos.x + 0.6, 0.8 + pos.y, pos.z);
      if (run.depot && run.mode === 'depot' && run.depot.step !== 'enter') camWant.lerp(run.depot.focus || run.depot.room.focus, run.depot.focus ? 0.6 : 0.5); // frame the room (or the part hovered)
      if (!run.won) camTarget.lerp(camWant, 1 - Math.exp(-realDt * (run.depot?.focus ? 4 : 6))); // once the zone's won the camera stays put
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
      enemies.update(dt, t, { tankPos: pos, tankBox: tankBox(), tankVel: vel, blocks, heightAt: level.heightAt, onTankHit: tankHit });
      const mgTarget = run.over || run.mode !== 'field' ? null : enemies.nearest(pos, stats.mgRange);
      const mgPoint = mgTarget ? enemies.aimPoint(mgTarget) : null;
      mgActive = !!mgTarget;

      tank.update(dt, t, { aimPoint: hasAim && !run.over ? aimPoint : null, mgPoint, speed });
      // roof MG rounds: most of them land on the machine it's tracking
      for (const e of tank.events) {
        if (e.type !== 'mg' || !mgTarget?.alive || Math.random() > MG_ACCURACY) continue;
        const killed = enemies.damage(mgTarget, stats.mgDamage);
        const p = e.target.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.4 + Math.random() * 0.3, (Math.random() - 0.5) * 0.4));
        hud.damage(p, stats.mgDamage, 'mg');
        combat.fx.burst(e.target, { count: 5, speed: 5, color: 0xfff3c4, life: 0.2, size: 0.06, gravity: 10 });
        if (killed) hud.damage(p.clone().setY(p.y + 0.6), 0, 'kill');
      }
      if (stats.twinMg) twinMg(dt, t, mgTarget);
      tryFire(dt);
      combat.handleTankEvents(tank);
      combat.update(dt);
      pickups.update(dt, t, pos, camera, collect);
      level.update(dt, t, { combat, focus: camTarget, api });
      if (run.mode === 'depot') depotFrame(dt);
      assignLamps();

      // aim line and landing mark
      const showAim = hasAim && !run.over && run.mode === 'field' && run.gun;
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
      hud.showReticle(!!client && !run.over && run.mode === 'field');
      if (client) hud.setReticle(client[0], client[1], reload);
      if (run.gun) hud.setKills(enemies.killed);
      hud.setChain(run.chain, run.chainT / (run.chainT > MULT_STEP ? MULT_HOLD : MULT_STEP));
      hud.setAbility(run.rockets && !run.over && run.mode === 'field' ? { k: 1 - run.boostCd / stats.boostCooldown, left: run.boostCd, lit: boosting, art: boostPicture(boosting, stats.afterburner ? 'afterburner' : 'normal') } : null);
      if (run.boss) {
        const e = run.boss.e;
        hud.setBoss(run.boss.name, e.alive ? e.hp / e.maxHp : 0);
        if (!e.alive) {
          run.boss = null;
          hud.setBoss(null, null);
        }
      }

      combat.beginShake(camera);
      if (!debug?.skipRender) pixel.render(scene, camera);
      combat.endShake(camera);
      hud.update(realDt, camera, canvas);
    },
    loadLevel,
    setQuality({ shadow, lamps: n }) {
      quality.shadow = shadow;
      quality.lamps = n;
      applyQuality();
    },
    get levelId() {
      return levelDef.id;
    },
    // for tests and dev tools
    debug: (debug = {
      boostPicture: (...a) => boostPicture(...a).toDataURL(),
      tank,
      skipRender: false,
      timeScale: 0,
      get pickups() {
        return pickups;
      },
      get level() {
        return level;
      },
      boost,
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
      camera,
      loadLevel,
      fire,
      setAim(v) {
        aimPoint.copy(v);
        hasAim = true;
      },
      press: (code, down) => (down ? keys.add(code) : keys.delete(code)),
    }),
  };
  return game;
}
