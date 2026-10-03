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
import { PARTS, attachPart, statsFor, BASE_STATS } from './parts.js';

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
// fuel-can rockets
const BOOST_TIME = 1.0;
const BOOST_COOLDOWN = 6;
const BOOST_SPEED = MAX_SPEED * 2.2;
const RAM_DAMAGE = 80;
// kill chains: kills within this many seconds of each other
const CHAIN_WINDOW = 3;
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

export function createGame({ renderer, pixel, level: startLevel }) {
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
    level.depot?.bindBlocks(blocks);
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
    });
    speed = 0;
    reload = 1;
    hasAim = false;
    queued = 0;
    tank.setRocket(0, false);
    camTarget.set(level.spawn.x + 0.6, 0.8, level.spawn.z);
    hud.reset();
    hud.setHull(run.hp, stats.maxHp);
    hud.setScrap(0);
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
    spotlight(spec, until, { maxTime = 12 } = {}) {
      run.spot = { until, t: 0, maxTime };
      hud.setSpot(spec);
    },
    get spotlit() {
      return !!run.spot;
    },
    sectors: (names, current) => hud.setSectors(names, current),
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
        run.locked = false;
        run.fading = false;
      }, 420);
    },
    giveRockets() {
      run.rockets = true;
    },
    boss(e, name = 'Heavy machine') {
      run.boss = e ? { e, name } : null;
      if (!e) hud.setBoss(null, null);
    },
    // Drive into the depot: repair pit, a pick of parts, then the door.
    // gift: 'rockets' bolts the fuel-can rockets on first. onLeave: when the
    // tank drives out the far door.
    depot({ offers, gift = null, onLeave }) {
      const d = level.depot;
      api.transition(() => {
        enemies.dispose();
        d.reset();
        d.setOffers(offers);
        level.bounds = d.bounds;
        api.teleport(d.entry.x, d.entry.z, d.entry.yaw);
        run.mode = 'depot';
        run.depot = { step: 'repair', offers, gift, onLeave, repaired: false, t: 0 };
        hud.setObjective('Repair, then pick a part');
        hud.prompt('Depot', 'Safe for now. Drive over the <b>pit</b> to repair.', { go: true });
        hud.setArrow(new THREE.Vector3((d.pit.x0 + d.pit.x1) / 2, 0.6, (d.pit.z0 + d.pit.z1) / 2), 'Repair');
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
      hud.showEnd(
        'win',
        title,
        [['Time', `${m}:${s}`], ['Machines destroyed', killedTotal + enemies.killed], ['Parts fitted', run.parts.length], ['Scrap', run.scrap]],
        'Play again',
        () => loadLevel(levelDef.id),
        `+${run.scrap} scrap banked${total != null ? ` · ${total} total` : ''}`,
      );
      canvas.style.cursor = '';
    },
  };
  const killedTotal = 0;
  let mgActive = false;

  // A machine died: kill chain, scrap and the odd repair spark, and a
  // freeze-frame when the cannon blew it apart.
  function onKill(e, blasted) {
    run.chain = run.chainT > 0 ? run.chain + 1 : 1;
    run.chainT = CHAIN_WINDOW;
    const mult = Math.min(5, run.chain);
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
      [['Machines destroyed', killedTotal + enemies.killed], ['Scrap collected', run.scrap]],
      'Retry',
      () => loadLevel(levelDef.id),
      `Half recovered: +${kept} scrap banked${total != null ? ` · ${total} total` : ''}`,
    );
    canvas.style.cursor = '';
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
    if (run.over || run.mode !== 'field' || run.locked) return;
    queued = 0.7;
  }
  function boost() {
    if (!run.rockets || run.over || run.mode !== 'field' || run.locked || run.boostCd > 0) return;
    run.boost = BOOST_TIME;
    run.boostCd = BOOST_COOLDOWN;
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
  const onKeyDown = (e) => {
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

  // The depot stop: repair over the pit, pick a part (drive onto its pallet
  // or click its card), the crane fits it, the door opens, drive out.
  function depotFrame(dt) {
    const d = level.depot;
    const st = run.depot;
    st.t += dt;
    const onPit = pos.x > d.pit.x0 - 0.5 && pos.x < d.pit.x1 + 0.5 && pos.z > d.pit.z0 - 1.2 && pos.z < d.pit.z1 + 1.2;
    if (onPit && run.hp < stats.maxHp) {
      run.hp = Math.min(stats.maxHp, run.hp + dt * 45);
      hud.setHull(run.hp, stats.maxHp);
      if (Math.random() < dt * 30) combat.fx.spawn(new THREE.Vector3(pos.x + (Math.random() - 0.5) * 3, 0.1, pos.z + (Math.random() - 0.5) * 1.6), new THREE.Vector3((Math.random() - 0.5) * 2, 3 + Math.random() * 3, (Math.random() - 0.5) * 2), { color: 0xffd36b, life: 0.4, size: 0.06, gravity: 12, glow: true });
    }
    if (st.step === 'repair' && (onPit || pos.x > d.pit.x1 + 1)) {
      if (run.hp >= stats.maxHp - 0.01 || pos.x > d.pit.x1 + 1) {
        st.step = st.gift ? 'gift' : 'pick';
        st.t = 0;
        if (st.gift === 'rockets') {
          // the zone's salvage find: the fuel drums get rigged as rockets
          run.rockets = true;
          for (const n of tank.rocketNozzles()) combat.fx.burst(n, { count: 14, speed: 4, color: 0xffd36b, life: 0.4, size: 0.06, gravity: 10 });
          combat.shake = Math.max(combat.shake, 0.1);
          hud.prompt('Salvage', `Found: <b>fuel-can rockets</b>! Your fuel drums now fire as boosters. ${api.touch ? 'Tap the <b>rocket</b> button' : '<kbd>Shift</kbd> or right-click'} to boost and ram.`, { go: true });
        }
        if (!st.gift) showCards();
      }
    }
    if (st.step === 'gift' && st.t > 4) {
      st.step = 'pick';
      showCards();
    }
    if (st.step === 'pick') {
      // driving onto a pallet takes that part
      d.pads.forEach((p, i) => {
        if (p.offer && st.step === 'pick' && Math.hypot(pos.x - p.x, pos.z - p.z) < 1.6) pick(i);
      });
    }
    if (st.step === 'out' && pos.x > d.exitX) {
      st.step = 'gone';
      hud.setArrow(null);
      api.transition(() => {
        run.mode = 'field';
        run.depot = null;
        st.onLeave();
      });
    }
  }
  function showCards() {
    const d = level.depot;
    hud.prompt('Depot', `Pick <b>one</b> part: ${api.touch ? 'tap its card' : 'click its card'} or drive onto its pallet.`, { go: true });
    hud.setArrow(null);
    hud.setCards(
      d.pads.filter((p) => p.offer).map((p) => ({ at: new THREE.Vector3(p.x, 1.4, p.z), ...PARTS[p.offer] })),
      (i) => pick(i),
    );
  }
  function pick(i) {
    const d = level.depot;
    const st = run.depot;
    if (!st || st.step !== 'pick') return;
    const pad = d.pads.filter((p) => p.offer)[i];
    if (!pad) return;
    st.step = 'fit';
    hud.setCards(null);
    hud.prompt('Depot', `Fitting the <b>${PARTS[pad.offer].name}</b>...`, { go: true });
    run.locked = true;
    speed = 0;
    d.install(d.pads.indexOf(pad), () => new THREE.Vector3(pos.x, 0, pos.z), {
      onFit() {
        const id = pad.offer;
        run.parts.push(id);
        partMeshes.push(attachPart(tank, id));
        const was = stats.maxHp;
        stats = statsFor(run.parts);
        run.hp = Math.min(stats.maxHp, run.hp + (stats.maxHp - was) + (PARTS[id].heal || 0));
        hud.setHull(run.hp, stats.maxHp);
        combat.fx.burst(pos.clone().setY(1.6), { count: 30, speed: 6, color: 0xffd36b, life: 0.45, size: 0.07, gravity: 12 });
        combat.glow.flash(pos.clone().setY(1.6), 0xfff0c8, 0.2, 1.4, 0.1);
        combat.shake = Math.max(combat.shake, 0.15);
      },
      onDone() {
        run.locked = false;
        st.step = 'out';
        d.openDoor();
        hud.prompt('Depot', 'Fitted. The door is opening. On to the next sector!', { go: true });
        hud.setObjective('Drive out of the depot');
        hud.setArrow(d.exitPoint, 'Exit');
      },
    });
  }

  const input = new THREE.Vector3();
  let dustCarry = 0;
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
      canvas.addEventListener('contextmenu', onContext);
      canvas.addEventListener('pointerleave', onLeave);
      canvas.addEventListener('pointerup', onUp);
      canvas.addEventListener('pointercancel', onUp);
      canvas.style.cursor = run.over ? '' : 'none';
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
      const aspect = w / h;
      const viewH = Math.max(VIEW_H, 15 / aspect);
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
      run.chainT = Math.max(0, run.chainT - dt);
      if (run.chainT <= 0) run.chain = 0;

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
      const throttle = stick.id !== null ? Math.min(1, Math.hypot(stick.x, stick.y) * 1.4) : 1;
      if (input.lengthSq() > 0.02) {
        input.normalize();
        const heading = Math.atan2(-input.z, input.x);
        tank.group.rotation.y = approachAngle(tank.group.rotation.y, heading, TURN_RATE * (boosting ? 0.45 : 1) * dt);
        const off = Math.abs(wrapAngle(heading - tank.group.rotation.y));
        want = MAX_SPEED * throttle * Math.max(0, Math.cos(off));
      }
      if (boosting) {
        run.boost -= dt;
        want = BOOST_SPEED;
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
            combat.puffs.spawn(n.clone().addScaledVector(back, 0.3), back.clone().multiplyScalar(4 + Math.random() * 3).add(new THREE.Vector3((Math.random() - 0.5) * 1.5, 0.6, (Math.random() - 0.5) * 1.5)), {
              color: i ? 0x6b6a6f : 0xffa040,
              s0: 0.14,
              s1: i ? 0.5 : 0.28,
              life: i ? 0.7 : 0.18,
              drag: 3,
              lift: 0.8,
              fadeAt: 0.3,
            });
          }
          if (Math.random() < 0.5) combat.fx.spawn(n, back.clone().multiplyScalar(6).add(new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3)), { color: 0xffd36b, life: 0.3, size: 0.07, gravity: 6, glow: true });
          combat.glow.light(n, 0xff8a2a, 12, 0.05);
        }
        combat.shake = Math.max(combat.shake, 0.06);
      }

      // tracks kick up slush and dust behind them
      const moving = Math.abs(speed);
      if (moving > 0.8 && dt > 0) {
        dustCarry += dt * (moving / MAX_SPEED) * 13;
        const c = Math.cos(yaw);
        const sn = Math.sin(yaw);
        while (dustCarry > 1) {
          dustCarry -= 1;
          for (const side of [-1, 1]) {
            const lx = speed > 0 ? -1.85 : 1.8;
            const lz = side * 0.95;
            const at = new THREE.Vector3(pos.x + lx * c + lz * sn, pos.y + 0.15, pos.z - lx * sn + lz * c);
            const v = new THREE.Vector3(-c * Math.sign(speed) * (0.6 + Math.random()), 0.5 + Math.random() * 0.6, sn * Math.sign(speed) * (0.6 + Math.random())).add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0, (Math.random() - 0.5) * 0.8));
            combat.puffs.spawn(at, v, {
              color: Math.random() < 0.5 ? 0xc4c3c0 : 0xa6a39c,
              s0: 0.07,
              s1: 0.18 + Math.random() * 0.12 + (moving / MAX_SPEED) * 0.08,
              life: 0.45 + Math.random() * 0.25,
              drag: 3,
              lift: 0.35,
              fadeAt: 0.35,
            });
          }
        }
      }

      // camera follows; the aim is re-cast every frame so it tracks while driving
      camWant.set(pos.x + 0.6, 0.8 + pos.y, pos.z);
      if (run.mode === 'depot') camWant.lerp(level.depot.focus, 0.55); // frame the room, not just the tank
      camTarget.lerp(camWant, 1 - Math.exp(-realDt * 6));
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
      tryFire(dt);
      combat.handleTankEvents(tank);
      combat.update(dt);
      pickups.update(dt, t, pos, camera, collect);
      level.update(dt, t, { combat, focus: camTarget, api });
      if (run.mode === 'depot') depotFrame(dt);
      assignLamps();

      // aim line and landing mark
      const showAim = hasAim && !run.over && run.mode === 'field';
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
      hud.setKills(enemies.killed);
      hud.setChain(run.chain, run.chainT / CHAIN_WINDOW);
      hud.setAbility(run.rockets && !run.over ? { k: 1 - run.boostCd / BOOST_COOLDOWN, lit: boosting } : null);
      if (run.boss) {
        const e = run.boss.e;
        hud.setBoss(run.boss.name, e.alive ? e.hp / e.maxHp : 0);
        if (!e.alive) run.boss = null;
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
}
