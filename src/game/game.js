// The game: drive the starter tank through a level with WASD or arrows, aim
// with the pointer, click or Space to fire. Fixed isometric game camera that
// follows the tank. Levels (src/levels) supply the scene, its lighting, the
// solid blocks the tank collides with, the colliders shells burst on, light
// emitters that share a small fixed pool of point lights, and optionally a
// script (tutorial prompts, enemy waves, objectives) driven through `api`.
import * as THREE from 'three';
import { createTank } from '../models/tank.js';
import { TANKS, tankDef } from './tanks.js';
import { campaignLevel, clearKey } from './campaign.js';
import { createFitting } from '../ui/fitting.js';
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
import { PARTS, attachPart, statsFor, BASE_STATS, tierOf, effectsHtml } from './parts.js';
import { save } from './save.js';
import { snapshotCanvas as sharedSnapshot } from '../render/snapshot.js';
import { partPicture } from '../render/partPictures.js';

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
const bank = (add = 0) => save.addBank(add);

// Screen-relative input: W drives straight up the screen, D straight right.
const INPUT_FORWARD = new THREE.Vector3(1, 0, -1).normalize();
const INPUT_RIGHT = new THREE.Vector3(1, 0, 1).normalize();

// Piercing shot (the battle tank's E): a line along the gun
const PIERCE_LEN = 32;
const PIERCE_HALF = 1.0; // how close to the line a machine must be (x its scale)
// Breakthrough (the light tank's Shift): the shockwave at the end of the dash
const SHOCK_R = 3.2;
const SHOCK_DAMAGE = 45;
const REPAIR_SHARE = 0.5; // a checkpoint on Easy repairs up to this much of the hull
const AIM_TIME = 4; // seconds (real time) to aim a Piercing shot before it fires itself
const AIM_SLOW = 0.25; // game speed while aiming it

export function createGame({ renderer, pixel, level: startLevel, onExit = null }) {
  injectDevKitStyles();
  const canvas = renderer.domElement;
  let debug = null;
  let bowShock = null; // Breakthrough's shock cone, on the light tank
  // the tank you drive: the one picked in the hangar (swapped on loading a
  // level)
  let tank = null;
  let tankId = null;
  let def = null;
  let pos = null;
  let TANK_BOX = null;
  function useTank(id) {
    if (id === tankId) return;
    tank?.group.removeFromParent();
    bowShock = null;
    tankId = id;
    def = tankDef(id);
    tank = TANKS[def.id].create();
    TANK_BOX = def.box;
    pos = tank.group.position;
    // drawn into the team mask for its outline (solid parts only)
    tank.group.traverse((o) => {
      if ((o.isMesh || o.isInstancedMesh) && !o.material.transparent && !o.userData.fx) o.layers.enable(PLAYER_LAYER);
    });
    if (def.ability === 'breakthrough') tank.group.add((bowShock = makeBowShock()));
  }
  useTank(save.tank());
  const hud = createHud();
  const fitting = createFitting({ renderer, cursor: hud.cursor });
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400);
  const camTarget = new THREE.Vector3();
  let scene, level, levelDef, combat, enemies, colliders, blocks, lamps, aimLine, aimMark, aimBeam, pickups, crushing;
  const run = { hp: 100, time: 0, over: false, won: false };
  let stats = { ...BASE_STATS };
  const partMeshes = [];
  let lastSize = null; // the last resize, replayed when the view size changes (optics)
  let reload = 1;
  let speed = 0;
  let hasAim = false;
  let pointer = null;
  let client = null;
  let hovered = null;
  let touch = matchMedia('(pointer: coarse)').matches;
  hud.setTouch(touch);

  // ------------------------------------------------------- level loading
  function loadLevel(id) {
    enemies?.dispose();
    levelDef = LEVELS.find((l) => l.id === id) || LEVELS[0];
    scene = new THREE.Scene();
    level = levelDef.build(scene);
    colliders = level.colliders;
    blocks = level.blocks;
    for (const m of partMeshes) m.removeFromParent();
    partMeshes.length = 0;
    if (run.dying) tankId = null; // it was blown apart: a fresh one
    useTank(save.tank());
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
    // Piercing shot's aim: a glowing line down the barrel to where it'll stop
    aimBeam = new THREE.Group();
    for (const [color, opacity] of [[0xfff6d6, 0.85], [0xffb347, 0.3]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
      m.userData.base = opacity;
      aimBeam.add(m);
    }
    aimBeam.visible = false;
    scene.add(aimLine, aimMark, aimBeam);
    tank.group.position.set(level.spawn.x, 0, level.spawn.z);
    tank.group.rotation.y = level.spawn.yaw;
    // a fresh run: the tank as it finished its last level (its saved
    // loadout), no rockets until the level hands them out
    const loadout = save.loadout(tankId).filter((id) => PARTS[id]).slice(0, def.slots);
    fitParts(loadout);
    Object.assign(run, {
      hp: stats.maxHp,
      time: 0,
      over: false,
      won: false,
      scrap: 0,
      parts: [...loadout],
      pendingTips: [], // tips shown this run, saved when it's finished
      found: [], // parts picked at checkpoints this run
      hard: save.difficulty() === 'hard',
      dying: null,
      rockets: false,
      ability: false, // the signature ability (E), once the level hands it over
      abilityCd: 0,
      aiming: 0, // Piercing shot: seconds left to aim it
      dash: 0, // Dash (light tank's Shift): seconds left
      brk: 0, // Breakthrough: seconds of charge left
      shield: 0, // Breakthrough: damage taken is cut while it lasts
      mag: stats.mag,
      spotT: 1,
      reactT: 0,
      pulse: {}, // passive perks: bumped each time one goes off (the HUD icon pops)
      magT: 0,
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
      autoPath: null,
      paused: false,
    });
    hud.showPause(null);
    hud.showContinue(null);
    hud.showPicker(null);
    fitting.hide();
    trigger = false;
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
    // (once its tips have been seen, the level hands them over at the start)
    const all = !level.start;
    run.gun = all;
    run.rockets = all;
    run.ability = all;
    hud.showScrap(all);
    if (level.start) level.start(api);
    else if (touch) hud.prompt('Controls', 'Stick drives · tap anywhere to aim and fire', { seconds: 8 });
    else hud.prompt('Controls', '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> drive · pointer aims · click or <kbd>Space</kbd> fires', { seconds: 8 });
    if (canvas.isConnected && hud.root.isConnected) canvas.style.cursor = 'none';
    return levelDef.id;
  }

  // Put a loadout on the tank: its part models, and the stats they give.
  function fitParts(list) {
    for (const m of partMeshes) m.removeFromParent();
    partMeshes.length = 0;
    for (const id of list) {
      const g = attachPart(tank, id);
      partMeshes.push(g, ...(g.userData.extra || []));
    }
    stats = statsFor(list, tankId);
    tank.setFlameStyle(stats.afterburner ? 'afterburner' : 'normal');
    if (lastSize) game.resize(...lastSize); // optics widen the view
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
    // on Hard, most groups come with extra machines alongside
    spawnDog(x, z, opts = {}) {
      const e = enemies.spawnDog(x, z, opts);
      if (run.hard && hardCount++ % 5 < 3) {
        const dx = (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random());
        const dz = (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random());
        enemies.spawnDog(x + dx, z + dz, { ...opts, delay: (opts.delay || 0) + 0.5, via: (opts.via || []).map(([vx, vz]) => [vx + dx * 0.5, vz + dz * 0.5]) });
      }
      return e;
    },
    spawnHound: (x, z, opts) => enemies.spawnHound(x, z, opts),
    spawnWalker: (x, z, opts) => enemies.spawnWalker(x, z, opts),
    spawnBridgeGun: (x, z, opts) => enemies.spawnBridgeGun(x, z, opts),
    get run() {
      return run;
    },
    get mgActive() {
      return mgActive;
    },
    // tutorial tips: each one shows once, ever. lesson(id) is true the
    // first time (and marks it seen); seen(id) just asks.
    // On a level's first playthrough the tips seen are only kept if it's
    // finished: quit halfway and they all come up again next time.
    seen: (id) => save.tips().includes(id) || run.pendingTips.includes(id),
    // this level beaten before (either difficulty): the generic callouts
    // ("Enemies!") stay quiet, the level's own ones still show
    get cleared() {
      return save.cleared().some((k) => k === levelDef.id || k === `${levelDef.id}:hard`);
    },
    lesson(id) {
      if (api.seen(id)) return false;
      run.pendingTips.push(id);
      return true;
    },
    // the tank being driven: { name, moveName, ability, abilityName, gun }
    get tank() {
      return def;
    },
    // the signature ability (E): Piercing shot
    giveAbility() {
      run.ability = true;
    },
    ability2Screen: () => {
      const c = hud.ability2Center();
      return { screen: [c.x, c.y], r: 70 };
    },
    // can the camera see a point (nothing tall in front of it)?
    clearView(p, height = 1.5) {
      const at = new THREE.Vector3(p.x, height, p.z);
      const dir = CAM_OFFSET.clone().normalize();
      const from = at.clone().addScaledVector(dir, 60);
      const ray = new THREE.Raycaster(from, dir.negate(), 0, 59.5);
      return ray.intersectObjects(colliders, false).length === 0;
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
    // frame: () => a world point the camera leans toward meanwhile (so a boss
    // spotlit off screen comes into view, not necessarily centred);
    // frameK: how far it leans (1: all the way, for something far off)
    spotlight(spec, until, { maxTime = 3, frame = null, frameK = 0.45 } = {}) {
      run.spot = { until, t: 0, maxTime: Math.min(maxTime, 3), frame, frameK }; // never holds the game up for long
      hud.setSpot(spec);
    },
    get spotlit() {
      return !!run.spot;
    },
    clearSpot() {
      run.spot = null;
      hud.setSpot(null);
    },
    // dev tools: every enemy on the field gone, no drops, no kills counted
    clearEnemies: () => enemies.retire(),
    sectors: (names, current, zone) => hud.setSectors(names, current, zone),
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
    // the scraps counter appears, glowing for a moment (no slow-down)
    revealScraps(highlight = true) {
      hud.showScrap(true, highlight);
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
    // offers: the parts this checkpoint can hand out (only ones not found
    // yet are shown, at most count of them; none: a repair stop)
    depot(shack, { offers, count = 3, gift = null, onLeave }) {
      if (run.mode === 'depot') return;
      const room = level.depotRoom;
      offers = offers.filter((id) => !save.owned().includes(id)).slice(0, count); // only parts not found yet
      run.mode = 'depot';
      run.locked = true;
      queued = 0;
      // no rockets into the shack: the tank rolls in at driving speed and stops on the pad
      run.boost = run.dash = run.brk = 0;
      speed = Math.min(speed, MAX_SPEED * stats.speed);
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
        const keep = Math.min(speed, MAX_SPEED * stats.speed);
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
    // path: [[x, z], ...] the tank then drives off along (clear of obstacles)
    win(title = 'Level clear', { path = null } = {}) {
      if (run.over) return;
      run.over = true;
      run.won = true;
      // first clears pay out: the level's tank, and on Hard its bonus
      const lvl = campaignLevel(levelDef.id);
      const rewards = [];
      for (const id of run.pendingTips) save.seeTip(id);
      const diff = run.hard ? 'hard' : 'easy';
      const first = lvl?.first?.[diff];
      if (save.clear(clearKey(levelDef.id, diff)) && first) {
        if (first.tank && !save.tanks().includes(first.tank)) {
          save.unlockTank(first.tank);
          save.addNews([{ kind: 'tank', id: first.tank }]);
          rewards.push(['First clear reward', TANKS[first.tank].name]);
        }
        if (first.scraps) {
          bank(first.scraps);
          rewards.push(['First clear reward', `+${first.scraps} scraps`]);
        }
      }
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
      run.autoPath = path ? path.map(([x, z]) => new THREE.Vector3(x, 0, z)) : [new THREE.Vector3(pos.x + Math.cos(yaw) * 40, 0, pos.z - Math.sin(yaw) * 40)];
      run.auto = run.autoPath.shift();
      run.autoKeep = true;
      setTimeout(() => {
        hud.showEnd(
          'win',
          title,
          [['Time', `${m}:${s}`], ['Enemies destroyed', enemies.killed], ['Scraps picked up', run.scrap], ...rewards],
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
  let hardCount = 0;
  let speedK = 0; // eased 0..1 while boosting (camera and speed lines)
  let deathK = 0; // eased 0..1 while the tank goes up

  // A machine died: kill chain, scrap and the odd repair spark, and a
  // freeze-frame when the cannon blew it apart.
  function onKill(e, blasted) {
    // Hot loader: a kill reloads the main gun
    if (stats.hotLoader) {
      if (stats.mag) {
        if (run.magT > 0) {
          run.magT = 0;
          run.mag = Math.min(stats.mag, 3);
        } else run.mag = Math.min(stats.mag, run.mag + 3);
      } else reload = 1;
      pulse('autoloader');
    }
    // Afterburn: kills while boosting take time off the recharge
    if (stats.boostRefund && (run.boost > 0 || run.dash > 0) && run.boostCd > 0) {
      run.boostCd = Math.max(0, run.boostCd - stats.boostRefund);
      pulse('afterburner');
    }
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
  // small: an autocannon round. It breaks junk it lands right on; a
  // barricade or the gate takes a few of them.
  function onImpact(at, mesh, small = false) {
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
      const reach = c.breakable ? (small ? 0.9 : 1.2) : 0.7;
      if (Math.abs(at.x - f.x) < f.hx + reach && Math.abs(at.z - f.z) < f.hz + reach) {
        if (small && (c.chips = (c.chips || 0) + 1) < (c.shots || 1)) continue; // (the gate takes two autocannon rounds)
        crushing.crush(c, { x: at.x - (f.x - at.x || 0.5), z: at.z - (f.z - at.z), yaw: 0 });
        if (c.scrap) pickups.spawn(new THREE.Vector3(f.x, 0.8, f.z), c.scrap, 'scrap', 1);
      }
    }
    level.onImpact?.(at, mesh, api);
  }

  // Destroyed: the HUD fades away, the camera leans in, and in slow motion
  // the tank goes up, its turret and parts thrown off; then the results.
  function lose() {
    run.over = true;
    run.dying = { t: 0, bangs: 0, flung: [] };
    hud.clearPrompt();
    hud.setMarker(null);
    hud.setSpot(null);
    hud.setBoss(null, null);
    hud.setGone(true);
    run.spot = null;
    run.aiming = 0;
    aimBeam.visible = false;
    trigger = false;
    combat.explode(pos.clone().setY(1.2));
    // the turret and the parts come away and fly
    const fling = (obj, up, spread) => {
      scene.attach(obj);
      run.dying.flung.push({ obj, vel: new THREE.Vector3((Math.random() - 0.5) * spread, up, (Math.random() - 0.5) * spread), spin: new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6) });
    };
    tank.group.updateMatrixWorld(true);
    fling(tank.turret, 9, 3);
    for (const m of partMeshes) if (m.parent && m.parent !== tank.turret) fling(m, 5 + Math.random() * 4, 6);
    // what's left: scorched
    tank.group.traverse((o) => {
      if (o.isMesh && o.material?.color) {
        o.material = o.material.clone();
        o.material.color.multiplyScalar(0.35);
      }
    });
  }
  function dyingFrame(realDt) {
    const d = run.dying;
    d.t += realDt;
    // a chain of blasts going off through the hull
    if (d.bangs < 4 && d.t > d.bangs * 0.35) {
      d.bangs++;
      combat.explode(pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 0.8 + Math.random() * 0.8, (Math.random() - 0.5) * 1.6)));
      combat.shake = Math.max(combat.shake, 0.5);
    }
    if (Math.random() < realDt * 20) combat.puffs.spawn(pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.6, 1.0, (Math.random() - 0.5) * 1.2)), new THREE.Vector3((Math.random() - 0.5) * 0.6, 1.6, (Math.random() - 0.5) * 0.6), { color: Math.random() < 0.5 ? 0x3a393d : 0x2a292c, s0: 0.3, s1: 0.9, life: 2.2, drag: 0.6, lift: 0.4, fadeAt: 0.35 });
    if (Math.random() < realDt * 10) combat.glow.light(pos.clone().setY(1.2), 0xff8a35, 30, 0.12);
    if (d.t > 2.4 && !d.shown) {
      d.shown = true;
      const kept = Math.floor(run.scrap / 2);
      const total = bank(kept);
      hud.showEnd(
        'lose',
        'Destroyed',
        [['Enemies destroyed', enemies.killed], ['Scraps picked up', run.scrap]],
        'Retry',
        () => loadLevel(levelDef.id),
        `Half recovered: +${kept} scraps${total != null ? ` · ${total} total` : ''}`,
        partCards(),
        onExit ? ['Exit', () => onExit()] : null,
      );
      setCursor();
    }
  }
  function flungFrame(dt) {
    for (const f of run.dying?.flung || []) {
      if (f.rest) continue;
      f.vel.y -= 16 * dt;
      f.obj.position.addScaledVector(f.vel, dt);
      f.obj.rotation.x += f.spin.x * dt;
      f.obj.rotation.y += f.spin.y * dt;
      f.obj.rotation.z += f.spin.z * dt;
      if (f.obj.position.y < 0.2 && f.vel.y < 0) {
        f.obj.position.y = 0.2;
        if (Math.abs(f.vel.y) < 2.5) f.rest = true;
        f.vel.y *= -0.3;
        f.vel.x *= 0.5;
        f.vel.z *= 0.5;
        f.spin.multiplyScalar(0.4);
        combat.puffs.spawn(f.obj.position.clone(), new THREE.Vector3(0, 0.5, 0), { color: 0x8f8a80, s0: 0.2, s1: 0.6, life: 0.6, drag: 3, lift: 0.3, fadeAt: 0.3 });
      }
    }
  }

  function tankHit(damage) {
    if (run.over || run.mode !== 'field') return;
    // Reactive burst: the next hit after a few quiet seconds is blocked, and
    // the brick it hits blasts the machines round the tank
    if (stats.reactive && !(run.reactT > 0)) {
      run.reactT = 8;
      pulse('era');
      const at = pos.clone().setY(1);
      combat.explode(at);
      api.blast(at, 3.2, 30);
      hud.damage(at.clone().setY(2.4), 0, 'heal', 'Blocked');
      return;
    }
    run.hp -= damage * stats.armor * (run.shield > 0 ? 0.2 : 1);
    hud.setHull(run.hp, stats.maxHp);
    hud.hurt();
    combat.shake = Math.max(combat.shake, 0.22);
    // sparks and a red flash off the hull where it was hit
    const at = pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.4, 1.0, (Math.random() - 0.5) * 1.2));
    combat.glow.flash(at, 0xff5a3a, 0.12, 1.1, 0.1);
    combat.glow.light(at, 0xff4a30, 18, 0.12);
    combat.fx.burst(at, { count: 12, speed: 6, color: 0xffd36b, life: 0.3, size: 0.07, gravity: 12 });
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
  // Shift: boost. The battle tank's drums swing round and light, the light
  // tank's exhausts flare; either way it charges.
  function boost() {
    if (!run.rockets || run.over || run.mode !== 'field' || run.locked || run.boostCd > 0) return;
    if (def.move === 'dash') {
      // the light tank's Dash: an instant, hard burst, over in a moment
      run.boostCd = stats.boostCooldown;
      run.boosts++;
      run.dash = stats.dashTime;
      run.shield = stats.dashTime + 0.15;
      speed = BOOST_SPEED * stats.dashSpeed;
      tank.setRocket(1, true, 0); // the exhausts light at full flame at once
      for (const n of tank.rocketNozzles()) combat.glow.flash(n, 0xfff0c8, 0.25, 1.4, 0.12);
      combat.shake = Math.max(combat.shake, 0.22);
      return launch(0.8);
    }
    run.boost = stats.boostTime;
    run.boostCd = stats.boostCooldown;
    run.boosts++;
    combat.shake = Math.max(combat.shake, 0.2);
    for (const n of tank.rocketNozzles()) combat.glow.flash(n, 0xffd08a, 0.2, 1.2, 0.12);
    launch(0.45);
  }
  // The kick of a boost or dash starting: a beat of slowed time, the camera
  // punching out, a ring of dust blown off the ground behind the tank.
  function launch(power) {
    run.dilate = 0.12 + 0.08 * power;
    run.punch = Math.max(run.punch || 0, power);
    const yaw = tank.group.rotation.y;
    const back = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
    const at = pos.clone().addScaledVector(back, TANK_BOX.hx * 0.8).setY(pos.y + 0.1);
    combat.glow.ring(at, 0xffe2b0, 0.4, 2.2 + power * 1.5, 0.3);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).addScaledVector(back, 1.2);
      combat.puffs.spawn(at, dir.multiplyScalar(4 + Math.random() * 3).setY(0.6), { color: [0x9a958b, 0x8f8a80, 0xb3ad9f][i % 3], s0: 0.15, s1: 0.5 + Math.random() * 0.3, life: 0.6 + Math.random() * 0.3, drag: 4, lift: 0.4, fadeAt: 0.4 });
    }
    combat.glow.light(at, 0xffb060, 30 + power * 30, 0.15);
  }
  // and its end: the tank digs in, throwing slush forward, a little jolt
  function landing() {
    const yaw = tank.group.rotation.y;
    const fwd = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const side = new THREE.Vector3(-fwd.z, 0, fwd.x);
    for (const s of [-1, 1]) {
      const at = pos.clone().addScaledVector(side, s * TANK_BOX.hz * 0.8).addScaledVector(fwd, TANK_BOX.cx + TANK_BOX.hx * 0.6).setY(pos.y + 0.1);
      for (let i = 0; i < 5; i++) combat.puffs.spawn(at, fwd.clone().multiplyScalar(3 + Math.random() * 2).addScaledVector(side, s * (1 + Math.random())).setY(0.8 + Math.random()), { color: [0x9a958b, 0x8f8a80, 0x7d786f][i % 3], s0: 0.1, s1: 0.4 + Math.random() * 0.2, life: 0.5 + Math.random() * 0.3, drag: 4, lift: 0.3, stretch: 1.6, fadeAt: 0.3 });
    }
    combat.shake = Math.max(combat.shake, 0.18);
    run.punch = Math.max(run.punch || 0, 0.25);
  }

  // E: the tank's signature ability.
  function ability() {
    if (!run.ability || run.over || run.mode !== 'field' || run.locked) return;
    if (def.ability === 'pierce') {
      if (run.aiming > 0) return firePierce(); // E again: fire now
      if (run.abilityCd > 0) return;
      run.aiming = AIM_TIME; // time slows; aim, then click (or let go) to fire
      trigger = false;
      queued = 0;
    } else if (def.ability === 'breakthrough') breakthrough();
  }

  // Breakthrough (the light tank's E): a deliberate charge on full rockets,
  // shielded, a shock cone off the nose ploughing through whatever's in the
  // way (barricades and all), knocking machines aside; smoke where it set
  // off spoils their aim. It ends in a shockwave.
  function breakthrough() {
    if (run.abilityCd > 0) return;
    run.abilityCd = stats.breakCooldown;
    run.abilities = (run.abilities || 0) + 1;
    run.brk = stats.breakTime;
    run.shield = stats.breakTime + 0.4;
    launch(1);
    enemies.breakLocks(pos, 10);
    combat.shake = Math.max(combat.shake, 0.3);
    for (const n of tank.rocketNozzles()) combat.glow.flash(n, 0xfff0c8, 0.3, 1.6, 0.14);
    // a ragged bank of smoke left where it set off, thinning away slowly
    const yaw = tank.group.rotation.y;
    const back = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
    const side = new THREE.Vector3(-back.z, 0, back.x);
    for (let i = 0; i < 14; i++) {
      const at = pos.clone().addScaledVector(back, 0.5 + Math.random() * 2.5).addScaledVector(side, (Math.random() - 0.5) * 3.5).setY(0.3 + Math.random() * 0.9);
      combat.puffs.spawn(at, side.clone().multiplyScalar((Math.random() - 0.5) * 2.5).addScaledVector(back, 0.5 + Math.random() * 1.5).setY(0.3 + Math.random() * 0.5), {
        color: [0xd8d9d2, 0xc4c6be, 0xe6e7e1][i % 3],
        s0: 0.25 + Math.random() * 0.2,
        s1: 0.8 + Math.random() * 0.9,
        life: 2.2 + Math.random() * 1.6,
        drag: 2,
        lift: 0.25,
        delay: Math.random() * 0.15,
        fadeAt: 0.2 + Math.random() * 0.15, // a long, gentle thinning out
      });
    }
  }
  // The shock cone Breakthrough drives in front of it: a big pale wedge
  // reaching back past the nose, brightest down its middle (nested cones,
  // each smaller and whiter), rings of pressure sliding back over it, and
  // white sparks streaming off it.
  function makeBowShock() {
    const g = new THREE.Group();
    const cone = (r, h, opacity) => {
      const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }));
      m.rotation.z = -Math.PI / 2; // apex forward (+x)
      m.position.x = -h / 2;
      m.userData.base = opacity;
      g.add(m);
      return m;
    };
    const cones = [cone(1.25, 2.2, 0.16), cone(0.8, 1.9, 0.24), cone(0.42, 1.6, 0.42)];
    const rings = [];
    for (let i = 0; i < 5; i++) {
      const r = new THREE.Mesh(new THREE.RingGeometry(0.88, 1, 22), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
      r.rotation.y = Math.PI / 2;
      g.add(r);
      rings.push(r);
    }
    g.userData = { fx: true, cones, rings };
    g.visible = false;
    return g;
  }
  const bowTmp = new THREE.Vector3();
  function updateBowShock(t, on, dt) {
    if (!bowShock) return;
    bowShock.userData.k = THREE.MathUtils.clamp((bowShock.userData.k || 0) + (on ? 0.12 : -0.08), 0, 1);
    const k = bowShock.userData.k;
    bowShock.visible = k > 0.01;
    if (!bowShock.visible) return;
    const size = TANK_BOX.hz * 1.9; // wider than the tank
    bowShock.position.set(TANK_BOX.cx + TANK_BOX.hx + 0.6, 0.8, 0);
    bowShock.scale.setScalar(size);
    for (const c of bowShock.userData.cones) c.material.opacity = c.userData.base * k * (0.85 + Math.random() * 0.3);
    bowShock.userData.rings.forEach((r, i) => {
      const u = (t * 2.4 + i / 5) % 1; // sliding back from the apex
      r.position.x = -u * 2.2;
      r.scale.setScalar(0.05 + u * 1.25);
      r.material.opacity = (1 - u) * 0.55 * k;
    });
    // white sparks streaming back off the cone
    if (on && dt > 0) {
      bowShock.updateWorldMatrix(true, false);
      for (let i = 0; i < 3; i++) {
        const u = Math.random();
        const a = Math.random() * Math.PI * 2;
        bowTmp.set(-u * 2.2, Math.cos(a) * u * 1.25, Math.sin(a) * u * 1.25);
        bowShock.localToWorld(bowTmp);
        const yaw = tank.group.rotation.y;
        const vel = new THREE.Vector3(-Math.cos(yaw) * (4 + Math.random() * 4), 1 + Math.random() * 2, Math.sin(yaw) * (4 + Math.random() * 4)).add(new THREE.Vector3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3));
        combat.fx.spawn(bowTmp.clone(), vel, { color: i ? 0xffffff : 0xfff3c4, life: 0.25 + Math.random() * 0.2, size: 0.06, gravity: 4, glow: true });
      }
    }
  }
  // the end of the dash: a ring of force, machines knocked away and hurt
  function shockwave() {
    const at = pos.clone().setY(0.4);
    api.blast(at, SHOCK_R, SHOCK_DAMAGE);
    enemies.shove(at, SHOCK_R + 0.5, 1.6);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      combat.puffs.spawn(at.clone().addScaledVector(dir, 0.6), dir.multiplyScalar(7), { color: 0xd8d2c0, s0: 0.15, s1: 0.4, life: 0.35, drag: 5, lift: 0.2, fadeAt: 0.3 });
    }
    combat.glow.ring(new THREE.Vector3(at.x, pos.y + 0.08, at.z), 0xffe2b0, 0.5, SHOCK_R * 1.2, 0.3);
    combat.glow.flash(at, 0xfff0c8, 0.3, SHOCK_R, 0.12);
    combat.glow.light(at, 0xffc070, 20, 0.12);
    combat.shake = Math.max(combat.shake, 0.3);
  }

  // Piercing shot (the battle tank). E: time slows for a few seconds while
  // you aim (a glowing line shows where it'll go); click, press E again, or
  // on touch let go, to fire. If you wait too long it fires by itself. The
  // round flies down the line like a meteor, through every machine on it,
  // through junk, barricades and the gate, until something solid stops it,
  // and leaves a glowing trail behind.
  function pierceLine() {
    const { position: m, direction: d } = tank.muzzle();
    const dir = new THREE.Vector3(d.x, 0, d.z).normalize();
    const from = new THREE.Vector3(m.x, Math.max(0.6, m.y), m.z);
    const soft = new Set();
    for (const c of level.crushables || []) if (!c.done && !c.armored) for (const k of c.colliders) soft.add(k);
    const ray = new THREE.Raycaster(from, dir, 0, PIERCE_LEN);
    const wall = ray.intersectObjects(colliders, false).find((h) => !soft.has(h.object));
    return { from, dir, len: wall ? wall.distance : PIERCE_LEN, wall };
  }
  function firePierce() {
    if (!(run.aiming > 0)) return;
    run.aiming = 0;
    run.levelT = 0.5; // the barrel stays level through the shot
    pierceTouch = null;
    aimBeam.visible = false;
    run.abilityCd = stats.pierceCooldown;
    run.abilities = (run.abilities || 0) + 1;
    tank.fire(); // the recoil
    const { from, dir, len, wall } = pierceLine();
    const hit = new Set();
    const broke = new Set();
    // the launch: a huge flash, blades of light, a ring of smoke at the muzzle
    combat.glow.flash(from, 0xffffff, 0.4, 2.2, 0.12);
    combat.glow.flash(from, 0xffb347, 0.6, 3.0, 0.25);
    combat.glow.spike(from, dir, 0xfff6d6, 4.5, 0.5, 0.14);
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    for (const s2 of [-1, 1]) combat.glow.spike(from, dir.clone().addScaledVector(side, s2 * 0.8).normalize(), 0xffc24a, 1.6, 0.25, 0.1);
    combat.glow.light(from, 0xffc070, 90, 0.25);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r = side.clone().multiplyScalar(Math.cos(a)).add(new THREE.Vector3(0, Math.sin(a), 0));
      combat.puffs.spawn(from.clone().addScaledVector(r, 0.2), r.multiplyScalar(3.5).addScaledVector(dir, 1.5), { color: 0xd8d6cc, s0: 0.15, s1: 0.4, life: 0.5, drag: 4, lift: 0.6, fadeAt: 0.3 });
    }
    combat.shake = Math.max(combat.shake, 0.6);
    run.hitstop = Math.max(run.hitstop, 0.06);
    combat.pierceShot(from, dir, len, {
      // as the round passes along the line from a0 to a1
      onPass(a0, a1) {
        for (const e of [...enemies.alive]) {
          if (hit.has(e)) continue;
          const rx = e.pos.x - from.x;
          const rz = e.pos.z - from.z;
          const along = rx * dir.x + rz * dir.z;
          if (along < a0 - 0.6 || along > a1 + 0.6) continue;
          if (Math.abs(rx * dir.z - rz * dir.x) > PIERCE_HALF * e.stats.scale + 0.3) continue;
          hit.add(e);
          const killed = enemies.damage(e, stats.pierceDamage, from.clone());
          const p = new THREE.Vector3(e.pos.x, 1.4 * e.stats.scale, e.pos.z);
          hud.damage(p, stats.pierceDamage, 'big');
          if (killed) hud.damage(p.clone().setY(p.y + 0.7), 0, 'kill');
          combat.sparkBlast(p);
          combat.shake = Math.max(combat.shake, 0.5);
          run.hitstop = Math.max(run.hitstop, 0.05);
          run.dilate = Math.max(run.dilate || 0, 0.45); // and time drags for a moment
        }
        for (const c of level.crushables || []) {
          if (c.done || c.armored || broke.has(c)) continue;
          const f = c.footprint;
          for (let k = a0; k <= a1; k += 0.4) {
            const x = from.x + dir.x * k;
            const z = from.z + dir.z * k;
            if (Math.abs(x - f.x) < f.hx + 0.5 && Math.abs(z - f.z) < f.hz + 0.5) {
              broke.add(c);
              crushing.crush(c, { x: x - dir.x, z: z - dir.z, yaw: Math.atan2(-dir.z, dir.x) });
              if (c.scrap) pickups.spawn(new THREE.Vector3(f.x, 0.8, f.z), c.scrap, 'scrap', 1);
              break;
            }
          }
        }
      },
      onEnd(end) {
        level.onImpact?.(end, wall?.object, api);
        combat.explode(end, wall?.face?.normal || null, wall?.object || null);
      },
    });
  }

  // the autocannon: holding the trigger fires a round every reload until the
  // magazine's empty, then it changes magazines
  let trigger = false;
  function autoFire(dt) {
    if (!stats.mag) return;
    if (run.magT > 0) {
      run.magT -= dt;
      if (run.magT <= 0) run.mag = stats.mag;
      return;
    }
    if (!trigger || run.over || run.mode !== 'field' || run.locked || !run.gun || reload < 1) return;
    if (hasAim && tank.aimError() > 0.12) return;
    reload = 0;
    run.shots++;
    combat.fireCannon(tank, hasAim ? aimPoint : null, [...colliders, ...enemies.hitMeshes()]);
    if (--run.mag <= 0) run.magT = stats.magReload;
  }
  function reloadMag() {
    if (stats.mag && run.magT <= 0 && run.mag < stats.mag) run.magT = stats.magReload;
  }
  const holdFire = () => def.gun === 'autocannon';
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
      if (run.aiming > 0) firePierce();
      else if (holdFire()) trigger = true;
      else fire();
      return;
    }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      if (!e.repeat) boost();
      return;
    }
    if (e.code === 'KeyE') {
      if (!e.repeat) ability();
      return;
    }
    if (e.code === 'KeyR') {
      reloadMag();
      return;
    }
    keys.add(e.code);
  };
  const onKeyUp = (e) => {
    keys.delete(e.code);
    if (e.code === 'Space') trigger = false;
  };
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
      const a2 = hud.ability2Center();
      if (run.ability && def.ability && Math.hypot(e.clientX - a2.x, e.clientY - a2.y) < 56) {
        ability();
        return;
      }
      if (stick.id === null && Math.hypot(e.clientX - c.x, e.clientY - c.y) < STICK_GRAB) {
        Object.assign(stick, { id: e.pointerId, ox: c.x, oy: c.y, x: 0, y: 0 });
        onMove(e); // the knob jumps straight to the thumb
      } else {
        aimAt(e.clientX, e.clientY);
        if (run.aiming > 0) pierceTouch = e.pointerId; // drag to aim, let go to fire
        else if (holdFire()) {
          trigger = true; // held down: keeps firing
          aimTouch = e.pointerId;
        } else fireOnAim = true; // fire once this frame's aim ray has landed
      }
      return;
    }
    setTouch(false);
    if (e.button !== 0) return;
    if (run.aiming > 0) firePierce();
    else if (holdFire()) trigger = true;
    else fire();
  };
  let aimTouch = null;
  let pierceTouch = null;
  const onWinUp = (e) => {
    if (e.pointerType !== 'touch' && e.button === 0) trigger = false;
  };
  const onContext = (e) => e.preventDefault();
  const onUp = (e) => {
    if (e.pointerType === 'mouse' && e.button === 0) trigger = false;
    if (e.pointerId === pierceTouch) firePierce();
    if (e.pointerId === aimTouch) {
      trigger = false;
      aimTouch = null;
    }
    if (e.pointerId !== stick.id) return;
    Object.assign(stick, { id: null, x: 0, y: 0 });
    hud.setStick(false);
  };
  const onBlur = () => {
    keys.clear();
    trigger = false;
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
      if (d < 26 * 26) nearest.push([e.priority ? 0 : d, e]); // (priority only counts in reach)
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
    // Easy: a repair of up to half the hull, said out loud; Hard: none (and
    // that's said too). It runs on while the screens are up.
    if (st.step !== 'enter' && st.step !== 'in' && st.repairTo == null) {
      st.repairTo = run.hard ? run.hp : Math.min(stats.maxHp, run.hp + stats.maxHp * REPAIR_SHARE);
      st.repaired = st.repairTo - run.hp;
      if (run.hard) hud.prompt('Repairs', 'No repairs in hard mode.', { danger: true, seconds: 3 });
    }
    if (st.repairTo != null && run.hp < st.repairTo) {
      run.hp = Math.min(st.repairTo, run.hp + dt * 80);
      hud.setHull(run.hp, stats.maxHp);
      if (Math.random() < dt * 30) combat.fx.spawn(new THREE.Vector3(pos.x + (Math.random() - 0.5) * 3.5, 0.1, pos.z + (Math.random() - 0.5) * 2), new THREE.Vector3((Math.random() - 0.5) * 2, 3 + Math.random() * 3, (Math.random() - 0.5) * 2), { color: 0xffd36b, life: 0.4, size: 0.06, gravity: 12, glow: true });
      if (run.hp >= st.repairTo - 0.01 && st.repaired > 0.5) {
        hud.damage(pos.clone().setY(2.4), st.repaired, 'heal');
        hud.prompt('Repairs', `Repaired <b>+${Math.round(st.repaired)}</b> HP`, { go: true, seconds: 3 });
      }
    }
    if (st.step === 'repair') {
      // parts on the pallets: a beat for the repair to show first; none:
      // the fitting screen comes up the moment it's parked
      if (!st.offers.length || st.t > 0.8) {
        if (st.gift === 'boost') run.rockets = true; // the drums get rigged as boosters
        st.step = 'pick';
        if (st.offers.length) showPicker();
        else openFit();
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
      st.offers.map((id) => ({ id, ...PARTS[id], lines: effectsHtml(id, tankId, tierOf(id)) })),
      (id) => pick(id),
      null, // no skip: a part is always worth taking (it goes to storage)
      // hovering a card swings the camera over to that part's pallet
      (id) => {
        const pad = id && st.room.pads.find((p) => p.offer === id);
        st.focus = pad ? new THREE.Vector3(pad.x, 0, pad.z) : null;
        st.room.hover(id); // only its pallet lit
      },
    );
  }
  // A card picked: the part goes into storage, and the fitting screen opens
  // with it ready to equip.
  function pick(id) {
    const st = run.depot;
    if (!st || st.step !== 'pick') return;
    st.focus = null;
    hud.showPicker(null);
    save.own(id);
    if (!run.found.includes(id)) run.found.push(id);
    st.found = id;
    st.room.choose(id); // the other pallets fade away
    openFit();
  }
  // The checkpoint's fitting screen. Equipping the part found here brings
  // the crane over with it; anything else goes on (or comes off) at once.
  function openFit() {
    const st = run.depot;
    if (!st) return;
    st.step = 'edit';
    fitting.show({
      tag: 'Checkpoint',
      tankId,
      loadout: run.parts,
      owned: save.owned(),
      highlight: st.found,
      buttons: [['Continue', () => leaveDepot(), true]],
      onSet(list, added) {
        const crane = added && !run.parts.includes(added) && st.room.pads.some((p) => p.offer === added);
        if (!crane) {
          applyLoadout(list, added);
          return openFit();
        }
        fitting.hide();
        st.step = 'fit';
        st.room.install(added, () => new THREE.Vector3(pos.x, 0, pos.z), {
          onFit: () => applyLoadout(list, added),
          onDone: () => openFit(),
        });
      },
    });
  }
  // a new loadout on the tank, mid-run
  function applyLoadout(list, added = null) {
    const was = stats.maxHp;
    run.parts = [...list];
    save.setLoadout(list, tankId); // the tank keeps it for next time
    fitParts(list);
    run.healed ??= [];
    const heal = added && list.includes(added) && !run.healed.includes(added) ? PARTS[added].heal || 0 : 0;
    if (heal) run.healed.push(added);
    run.hp = Math.min(stats.maxHp, run.hp + Math.max(0, stats.maxHp - was) + heal);
    hud.setHull(run.hp, stats.maxHp);
    if (!added) return;
    combat.fx.burst(pos.clone().setY(1.6), { count: 30, speed: 6, color: 0xffd36b, life: 0.45, size: 0.07, gravity: 12 });
    combat.glow.flash(pos.clone().setY(1.6), 0xfff0c8, 0.2, 1.4, 0.1);
    combat.shake = Math.max(combat.shake, 0.15);
  }
  // Continue: the door goes up and the tank rolls out
  function leaveDepot() {
    const st = run.depot;
    if (!st || st.step !== 'edit') return;
    fitting.hide();
    st.step = 'opening';
    st.focus = null;
    st.room.clearPads(); // a part left unequipped fades away (it's in storage)
    st.room.openDoor();
    const wait = () => {
      if (st.room.doorOpen < 0.35) return void setTimeout(wait, 60);
      st.step = 'out';
      run.auto = st.room.outside;
      run.autoKeep = true;
    };
    wait();
  }
  // The parts fitted this run, each with a little pre-rendered picture of
  // its model for the results screen.
  const partShots = new Map();
  function partShot(id) {
    if (!partShots.has(id)) partShots.set(id, id === 'afterburner' ? boostPicture(true, 'afterburner', 72, 48, bigUpArrow).toDataURL() : partPicture(renderer, id, 72, 48));
    return partShots.get(id);
  }
  function partCards() {
    return run.found.map((id) => ({ ...PARTS[id], image: partShot(id) }));
  }
  const pulse = (id) => ((run.pulse ||= {})[id] = (run.pulse[id] || 0) + 1);
  // the Legendary perks working away by themselves: small icons by the
  // ability buttons, with their timers
  function passives() {
    const list = [];
    const add = (id, name, o = {}) => list.push({ id, name, img: partShot(id), pulse: run.pulse?.[id] || 0, ...o });
    if (stats.spotter) add('optics', 'Spotter', { k: 1 - Math.max(0, run.spotT) / 5, left: run.spotT });
    if (stats.reactive) add('era', 'Reactive', { k: 1 - run.reactT / 8, left: run.reactT, ready: !(run.reactT > 0) });
    if (stats.hotLoader) add('autoloader', 'Hot loader');
    if (stats.boostRefund) add('afterburner', 'Afterburn');
    if (stats.dozerStun) add('dozer', 'Plough');
    return list;
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
  // (the light tank's: its exhaust outlet, the flame flaring out of it)
  const boostPics = new Map();
  const boostTanks = {};
  function boostPicture(firing, style = 'normal', W = 32, H = 32, decorate = null, id = tankId) {
    const key = `${id}|${firing}|${style}|${W}|${H}|${!!decorate}`;
    if (boostPics.has(key)) return boostPics.get(key);
    const tk = (boostTanks[id] ??= id === 'battle' ? createTank() : TANKS[id].create());
    tk.setFlameStyle(style);
    tk.setRocket(1, firing, 0.3);
    tk.group.updateWorldMatrix(true, true);
    const nozzle = tk.rocketNozzles().reduce((a, b) => (b.z > a.z ? b : a)); // the near one
    const light = id === 'light';
    const target = nozzle.clone().add(new THREE.Vector3(light ? (firing ? -0.55 : 0.3) : firing ? 0.15 : 0.45, 0.05, 0));
    const half = light ? (firing ? 0.85 : 0.5) : firing ? 0.95 : 0.75;
    const pic = snapshotCanvas(tk.group, W, H, decorate, { target, dir: new THREE.Vector3(0.12, 0.3, 1), half, aspectFit: true });
    boostPics.set(key, pic);
    return pic;
  }
  // Piercing shot's icon: a white-hot trail rising from bottom left to top
  // right, rings of shock along it, the round at its head
  let pierceCanvas = null;
  function pierceArt() {
    if (pierceCanvas) return pierceCanvas;
    const c = (pierceCanvas = document.createElement('canvas'));
    c.width = c.height = 26;
    const g = c.getContext('2d');
    g.fillStyle = '#1d1b1e';
    g.fillRect(0, 0, 26, 26);
    const A = [3, 23];
    const B = [18, 8];
    const at = (k) => [A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k];
    // the trail: a pale glow, then the white core, both fading toward the tail
    for (let i = 0; i < 12; i++) {
      const k0 = i / 12;
      const [x0, y0] = at(k0);
      const [x1, y1] = at(k0 + 1 / 12);
      g.globalAlpha = 0.25 + 0.75 * k0;
      g.strokeStyle = '#ffd9a0';
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.stroke();
      g.strokeStyle = '#ffffff';
      g.lineWidth = 2.5;
      g.stroke();
    }
    g.globalAlpha = 1;
    // the shock rings across it
    g.strokeStyle = '#ffffff';
    g.lineWidth = 1.5;
    for (const [k, r] of [[0.42, 4.5], [0.72, 6]]) {
      const [x, y] = at(k);
      g.globalAlpha = 0.55 + k * 0.4;
      g.beginPath();
      g.ellipse(x, y, 1.6, r, -Math.PI / 4, 0, Math.PI * 2);
      g.stroke();
    }
    g.globalAlpha = 1;
    // the round
    g.save();
    g.translate(20, 6);
    g.rotate(-Math.PI / 4);
    g.fillStyle = '#9aa2ac';
    g.fillRect(-4, -2, 6, 4);
    g.fillStyle = '#c9a24a';
    g.fillRect(-4, -2, 2, 4);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(2, -2);
    g.lineTo(5, 0);
    g.lineTo(2, 2);
    g.fill();
    g.restore();
    return c;
  }
  // Breakthrough's icon: the light tank charging on its rockets, three
  // white chevrons of shock ahead of its nose
  let breakCanvas = null;
  function breakArt() {
    if (breakCanvas) return breakCanvas;
    const c = (breakCanvas = document.createElement('canvas'));
    c.width = c.height = 26;
    const g = c.getContext('2d');
    g.fillStyle = '#1d1b1e';
    g.fillRect(0, 0, 26, 26);
    const px = (x, y, w, h, col) => ((g.fillStyle = col), g.fillRect(x, y, w, h));
    // rocket flame out the back
    px(0, 13, 3, 3, '#ff9a3a');
    px(1, 14, 3, 1, '#fff3c4');
    // tracks and wheels
    px(3, 18, 12, 3, '#2b2b25');
    for (const x of [4, 7, 10, 13]) px(x, 19, 1, 1, '#6a6e58');
    // hull: a low box with a sloped nose
    px(3, 14, 12, 4, '#5b6a3c');
    px(15, 15, 1, 3, '#5b6a3c');
    px(5, 15, 3, 1, '#6e5639'); // camo
    px(10, 16, 2, 1, '#2b2b25');
    // turret and gun
    px(5, 11, 7, 3, '#4a5731');
    px(7, 10, 3, 1, '#4a5731');
    px(12, 12, 4, 1, '#232426');
    // three chevrons of shock ahead of the nose
    for (const x0 of [16, 19, 22]) {
      for (let i = 0; i < 3; i++) {
        px(x0 + i, 12 + i, 2, 1, '#ffffff');
        px(x0 + i, 18 - i, 2, 1, '#ffffff');
      }
    }
    return c;
  }
  // view: optional { target, dir, half } framing a close-up instead of the
  // whole model
  function snapshotCanvas(model, W = 72, H = 48, decorate = null, view = null) {
    return sharedSnapshot(renderer, model, W, H, decorate, view);
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
    const g = partMeshes.find((m) => m.userData.mounts);
    if (!g || run.over || run.mode !== 'field' || dt <= 0) return;
    // each mount takes the nearest machine nobody else is on yet (or, with
    // none left, doubles up on the first MG's)
    const taken = new Set([first]);
    for (const mt of g.userData.mounts) {
      let best = null;
      let bd = stats.mgRange ** 2;
      for (const e of enemies.alive) {
        if (taken.has(e) || !e.los) continue;
        const d = (e.pos.x - pos.x) ** 2 + (e.pos.z - pos.z) ** 2;
        if (d < bd) {
          bd = d;
          best = e;
        }
      }
      const target = best || first;
      if (!target) continue;
      taken.add(target);
      const pivot = mt.pivot;
      pivot.getWorldPosition(mgWorld);
      const aim = enemies.aimPoint(target);
      const want = wrapAngle(Math.atan2(-(aim.z - mgWorld.z), aim.x - mgWorld.x) - tank.group.rotation.y - tank.turret.rotation.y);
      pivot.rotation.y = approachAngle(pivot.rotation.y, want, 9 * dt);
      pivot.rotation.z = THREE.MathUtils.clamp(Math.atan2(aim.y - mgWorld.y, Math.hypot(aim.x - mgWorld.x, aim.z - mgWorld.z)), -0.3, 0.9);
      if (Math.abs(wrapAngle(want - pivot.rotation.y)) > 0.3) continue;
      mt.timer -= dt;
      if (mt.timer > 0 || Math.sin(t * 2.4 + 1.5 + mt.pivot.id) < -0.3) continue;
      mt.timer = 0.08;
      const muzzle = pivot.localToWorld(mt.muzzle.clone());
      const hit = aim.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.35, (Math.random() - 0.3) * 0.2, (Math.random() - 0.5) * 0.35));
      combat.glow.tracer(muzzle, hit, 0xffe08a, 0.05, 0.07);
      combat.glow.flash(muzzle, 0xffc860, 0.08, 0.38, 0.05);
      combat.fx.burst(hit, { count: 4, speed: 3.5, color: 0xffd36b, life: 0.18, size: 0.06, gravity: 9 });
      if (Math.random() > MG_ACCURACY) continue;
      const killed = enemies.damage(target, stats.mgDamage);
      const p = hit.clone().add(new THREE.Vector3(0, 0.5, 0));
      hud.damage(p, stats.mgDamage, 'mg');
      if (killed) hud.damage(p.clone().setY(p.y + 0.6), 0, 'kill');
    }
  }

  // Spotter (Legendary Wider view): every few seconds the farthest machines
  // in sight are marked; marked ones take extra damage until it wears off
  function spotter(dt) {
    if (!stats.spotter || run.over || run.mode !== 'field') return;
    run.spotT = (run.spotT ?? 1) - dt;
    if (run.spotT > 0) return;
    run.spotT = 5;
    const reach = 24 * stats.view;
    const seen = enemies.alive.filter((e) => e.los && Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z) < reach);
    seen.sort((a, b) => Math.hypot(b.pos.x - pos.x, b.pos.z - pos.z) - Math.hypot(a.pos.x - pos.x, a.pos.z - pos.z));
    if (seen.length) pulse('optics');
    for (const e of seen.slice(0, stats.spotter)) {
      e.markT = 5;
      combat.glow.flash(new THREE.Vector3(e.pos.x, 1.6 * e.stats.scale, e.pos.z), 0xffffff, 0.2, 1.0, 0.15);
    }
  }


  const input = new THREE.Vector3();
  let dustCarry = 0;
  const camWant = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  loadLevel(startLevel);


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
      document.body.append(fitting.el);
      window.addEventListener('pointerup', onWinUp);
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
      trigger = false;
      hud.unmount();
      fitting.hide();
      fitting.el.remove();
      window.removeEventListener('pointerup', onWinUp);
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
      if (run.dying) {
        dyingFrame(realDt);
        dt = realDt * 0.3; // the end, in slow motion
        flungFrame(dt);
      } else if (run.hitstop > 0) {
        run.hitstop -= realDt;
        dt = 0;
      } else if (run.spot) dt = realDt * SLOW_MO;
      else if (run.dilate > 0) {
        run.dilate -= realDt;
        dt = realDt * 0.35; // a beat of slow motion as a boost kicks in
      }
      if (run.aiming > 0) {
        dt = realDt * AIM_SLOW;
        run.aiming -= realDt;
        if (run.aiming <= 0 || run.over || run.mode !== 'field') {
          run.aiming = 0.001;
          if (run.over || run.mode !== 'field') {
            run.aiming = 0;
            aimBeam.visible = false;
          } else firePierce(); // out of time: it fires where it points
        }
      }
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
      run.abilityCd = Math.max(0, run.abilityCd - dt);
      run.shield = Math.max(0, run.shield - dt);
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
      const boosting = run.boost > 0 || run.dash > 0 || run.brk > 0;
      let want = 0;
      let accel = ACCEL;
      let throttle = stick.id !== null ? Math.min(1, Math.hypot(stick.x, stick.y) * 1.4) : 1;
      // driven by the game (into and out of depots)
      if (run.auto) {
        const dx = run.auto.x - pos.x;
        const dz = run.auto.z - pos.z;
        const dist = Math.hypot(dx, dz);
        if (run.autoPath?.length && dist < 2.5) {
          run.auto = run.autoPath.shift(); // on to the next point, without stopping
        } else if (dist < 0.35) {
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
        tank.group.rotation.y = approachAngle(tank.group.rotation.y, heading, TURN_RATE * (boosting ? (run.dash > 0 ? 0.15 : run.brk > 0 ? 0.6 : 0.45) : 1) * dt);
        const off = Math.abs(wrapAngle(heading - tank.group.rotation.y));
        want = MAX_SPEED * stats.speed * throttle * Math.max(0, Math.cos(off));
      }
      if (run.boost > 0) {
        run.boost -= dt;
        want = BOOST_SPEED * stats.boostSpeed;
        accel = 60;
        if (run.boost <= 0) landing();
      }
      if (run.dash > 0) {
        run.dash -= dt;
        want = BOOST_SPEED * stats.dashSpeed;
        accel = 200;
        if (run.dash <= 0) {
          speed = Math.min(speed, MAX_SPEED * stats.speed * 1.2); // straight back to (nearly) driving speed
          landing();
        }
      }
      if (run.brk > 0) {
        run.brk -= dt;
        want = BOOST_SPEED * stats.breakSpeed;
        accel = 40;
        if (run.brk <= 0) shockwave();
      }
      updateBowShock(t, run.brk > 0, dt);
      // Breakthrough's burn: big white clouds pouring out of the exhausts
      if (run.brk > 0 && dt > 0) {
        for (const n of tank.rocketNozzles()) {
          if (Math.random() > dt * 22) continue;
          const back = new THREE.Vector3(-Math.cos(tank.group.rotation.y), 0, Math.sin(tank.group.rotation.y));
          combat.puffs.spawn(n.clone().addScaledVector(back, 0.4), back.multiplyScalar(2 + Math.random() * 2).add(new THREE.Vector3((Math.random() - 0.5) * 1.5, 0.4 + Math.random() * 0.4, (Math.random() - 0.5) * 1.5)), {
            color: [0xe6e7e1, 0xd8d9d2, 0xf2f2ee][(Math.random() * 3) | 0],
            s0: 0.3,
            s1: 0.9 + Math.random() * 0.6,
            life: 1.6 + Math.random() * 0.8,
            drag: 2.5,
            lift: 0.4,
            fadeAt: 0.25,
          });
        }
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
      const ram = boosting ? 'boost' : stats.crushHeavy && Math.abs(speed) > 2.5 ? 'dozer' : false;
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
        enemies.nudge(tankBox(), vel); // and anything it drives into is shoved aside
        const ramDmg = boosting ? RAM_DAMAGE : Math.abs(speed) > 3 ? stats.ramDamage : 0;
        if (ramDmg > 0) {
          // Breakthrough ploughs them on ahead of the tank, knocked senseless;
          // a boost or the blade throws them aside
          const brk = run.brk > 0;
          const opts = brk ? { push: 1.3, side: 2, stun: 1.2 } : stats.dozerStun && !boosting ? { push: 0.8, side: 4, stun: stats.dozerStun } : { push: 0.5, side: 5 };
          for (const h of enemies.ram({ ...tankBox(), hx: TANK_BOX.hx + (brk ? 1.2 : 0.3) }, ramDmg, vel, opts)) {
            const p = new THREE.Vector3(h.e.pos.x, 1.3, h.e.pos.z);
            if (opts.stun && !brk) pulse('dozer');
            hud.damage(p, h.amount, 'big');
            if (h.killed) hud.damage(p.clone().setY(2), 0, 'kill');
            if (brk) {
              combat.sparkBlast(p);
              run.dilate = Math.max(run.dilate || 0, 0.3);
            } else combat.fx.burst(p, { count: 12, speed: 6, color: 0xffd36b, life: 0.3, size: 0.07, gravity: 12 });
            combat.shake = Math.max(combat.shake, brk ? 0.45 : 0.25);
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
        dustCarry += dt * Math.min(1.5, moving / MAX_SPEED) * (8 + Math.random() * 10); // irregular, not a steady stream
        const c = Math.cos(yaw);
        const sn = Math.sin(yaw);
        while (dustCarry > 1) {
          dustCarry -= 1;
          for (const side of [-1, 1]) {
            const lx = speed > 0 ? TANK_BOX.cx - TANK_BOX.hx + 0.4 : TANK_BOX.cx + TANK_BOX.hx - 0.45;
            const lz = side * (TANK_BOX.hz - 0.2);
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
      const lean = run.spot?.frame?.();
      if (lean) camWant.lerp(lean.setY(camWant.y), run.spot.frameK);
      // in the checkpoint: frame the room and its pallets (or the part
      // hovered) while there's a pick to make; for the refit, the tank
      const refit = run.depot && ['edit', 'fit', 'opening'].includes(run.depot.step) && !run.depot.focus;
      if (run.depot && run.mode === 'depot' && run.depot.step !== 'enter' && !refit) camWant.lerp(run.depot.focus || run.depot.room.focus, run.depot.focus ? 0.6 : 0.5);
      if (!run.won) camTarget.lerp(camWant, 1 - Math.exp(-realDt * (run.depot?.focus ? 4 : 6))); // once the zone's won the camera stays put
      // boosting: the view pulls back a touch (and punches out as it kicks
      // in), speed lines rush in from the edges
      speedK += ((boosting ? 1 : 0) - speedK) * (1 - Math.exp(-realDt * (boosting ? 8 : 4)));
      run.punch = Math.max(0, (run.punch || 0) - realDt * 3);
      deathK += ((run.dying ? 1 : 0) - deathK) * (1 - Math.exp(-realDt * 2));
      const zoom = (1 + 0.3 * deathK) / (1 + 0.06 * speedK + 0.05 * run.punch); // and leaning in on the wreck
      if (Math.abs(camera.zoom - zoom) > 1e-4) {
        camera.zoom = zoom;
        camera.updateProjectionMatrix();
      }
      // a rush at the kick, then just a few faint streaks; Breakthrough's
      // streak the whole way
      hud.setSpeed(run.over ? 0 : Math.min(1, Math.max(speedK * 0.22, run.brk > 0 ? 0.7 : 0) + run.punch * 1.2));
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
      level.light.follow(camTarget); // the shadow box follows the view, not the tank
      if (fireOnAim) {
        fireOnAim = false;
        fire();
      }

      // machines
      enemies.update(dt, t, { tankPos: pos, tankBox: tankBox(), tankVel: vel, blocks, colliders, heightAt: level.heightAt, onTankHit: tankHit });
      // the roof MG only takes machines it can see (not through trams and walls)
      const mgTarget = run.over || run.mode !== 'field' ? null : enemies.nearest(pos, stats.mgRange, true);
      const mgPoint = mgTarget ? enemies.aimPoint(mgTarget) : null;
      mgActive = !!mgTarget;

      tank.update(dt, t, { aimPoint: hasAim && !run.over ? aimPoint : null, mgPoint, speed, turretRate: run.aiming > 0 ? 1 / AIM_SLOW : 1, levelGun: run.aiming > 0 || run.levelT > 0 });
      run.levelT = Math.max(0, (run.levelT || 0) - realDt); // the turret keeps its real speed while time's slowed
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
      spotter(dt);
      run.reactT = Math.max(0, (run.reactT || 0) - dt);
      tryFire(dt);
      autoFire(dt);
      combat.handleTankEvents(tank);
      combat.update(dt);
      pickups.update(dt, t, pos, camera, collect);
      level.update(dt, t, { combat, focus: camTarget, api });
      if (run.mode === 'depot') depotFrame(dt);
      assignLamps();

      // aim line and landing mark
      aimBeam.visible = run.aiming > 0;
      if (aimBeam.visible) {
        const L = pierceLine();
        const mid = L.from.clone().addScaledVector(L.dir, L.len / 2);
        const pulse = 0.75 + 0.25 * Math.sin(t * 18);
        aimBeam.children.forEach((m, i) => {
          m.position.copy(mid);
          m.lookAt(L.from.clone().addScaledVector(L.dir, L.len));
          const w = i ? 0.42 : 0.1;
          m.scale.set(w, w, L.len);
          m.material.opacity = m.userData.base * pulse;
        });
      }
      const showAim = hasAim && !run.over && run.mode === 'field' && run.gun && !(run.aiming > 0);
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
      if (client) {
        const reloading = stats.mag && run.magT > 0;
        if (run.aiming > 0) hud.setReticle(client[0], client[1], Math.min(0.999, run.aiming / AIM_TIME)); // the ring counts down the aim
        else hud.setReticle(client[0], client[1], reloading ? 1 - run.magT / stats.magReload : reload);
      }
      if (run.gun) hud.setKills(enemies.killed);
      hud.setChain(run.chain, run.chainT / (run.chainT > MULT_STEP ? MULT_HOLD : MULT_STEP));
      const live = !run.over && run.mode === 'field';
      if (!run.gun || !live) hud.setAmmo(null);
      else if (stats.mag) hud.setAmmo({ n: run.mag, max: stats.mag, load: run.magT > 0 ? 1 - run.magT / stats.magReload : null });
      else hud.setAmmo({ n: reload >= 1 ? 1 : 0, max: 1, load: reload >= 1 ? null : reload });
      hud.setPassives(live ? passives() : []);
      hud.setAbility(run.rockets && live ? { k: 1 - run.boostCd / stats.boostCooldown, left: run.boostCd, lit: boosting, art: boostPicture(boosting, stats.afterburner ? 'afterburner' : 'normal') } : null);
      const abilityCd = def.ability === 'pierce' ? stats.pierceCooldown : stats.breakCooldown;
      hud.setAbility(def.ability && run.ability && live ? { k: 1 - run.abilityCd / abilityCd, left: run.abilityCd, lit: run.aiming > 0 || run.brk > 0, art: def.ability === 'pierce' ? pierceArt() : breakArt() } : null, 1);
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
    // Dev kit: beat the current stage of the level and stand at the door of
    // the next checkpoint (or, in the last stage, bring the boss on now).
    skipStage() {
      if (run.mode !== 'field' || run.over || run.won || run.fading) return false;
      return !!level.skipStage?.(api);
    },
    // for tests and dev tools
    debug: (debug = {
      boostPicture: (...a) => boostPicture(...a).toDataURL(),
      sightHits(a, b) {
        const A = new THREE.Vector3(...a);
        const d = new THREE.Vector3(...b).sub(A);
        const r = new THREE.Raycaster(A, d.clone().normalize(), 0, d.length());
        return r.intersectObjects(colliders, false).map((h) => ({ d: h.distance.toFixed(2), p: h.point.toArray().map((v) => v.toFixed(2)), geo: h.object.geometry.type, pos: h.object.getWorldPosition(new THREE.Vector3()).toArray().map((v) => v.toFixed(1)), vis: h.object.material.visible }));
      },
      get tank() {
        return tank;
      },
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
      skipStage: () => game.skipStage(),
      hurt: (n) => tankHit(n),
    }),
  };
  return game;
}
