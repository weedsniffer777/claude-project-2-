// The game: drive the starter tank through a level with WASD or arrows, aim
// with the pointer, click or Space to fire. Fixed isometric game camera that
// follows the tank. Levels (src/levels) supply the scene, its lighting, the
// solid blocks the tank collides with, the colliders shells burst on, light
// emitters that share a small fixed pool of point lights, and optionally a
// script (tutorial prompts, enemy waves, objectives) driven through `api`.
import { Glow } from '../render/fx.js';
import * as THREE from 'three';
import { createTank } from '../models/tank.js';
import { TANKS, tankDef } from './tanks.js';
import { campaignLevel, clearKey } from './campaign.js';
import { createFitting } from '../ui/fitting.js';
import { CombatFx } from '../render/combat.js';
import { wrapAngle, approachAngle } from '../models/kit.js';
import { injectDevKitStyles } from '../devkit/style.js';
import { CG } from '../platform.js';
import { sfx } from '../audio.js';
import { LEVELS } from '../levels/index.js';
import { Enemies } from './enemies.js';
import { createHud } from './hud.js';
import { pushOut } from './collide.js';
import { PLAYER_LAYER } from '../render/pixel.js';
import { Pickups } from './pickups.js';
import { Crushing } from './crushing.js';
import { PARTS, attachPart, statsFor, BASE_STATS, effectsHtml, improveTo, improvementHtml, levelOf, gmgLauncher } from './parts.js';
import { save } from './save.js';
import { runXp, bankRun } from './endless.js';
import { snapshotCanvas as sharedSnapshot } from '../render/snapshot.js';
import { partPicture } from '../render/partPictures.js';
import { buildLauncher } from '../models/launchers.js';
import { EQUIPMENT, equipmentArt } from './equipment.js';
import { createShield } from './shield.js';
import { settings, actionFor, openSettings, onSettings, rebindHints } from '../ui/settings.js';

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
const PIERCE_HALF = 1.4; // how close to the line a machine must be (x its scale)
// Breakthrough (the light tank's Shift): the shockwave at the end of the dash
const SHOCK_R = 3.2;
const SHOCK_DAMAGE = 45;
const REPAIR_SHARE = 0.5; // a checkpoint on Easy repairs up to this much of the hull
const AIM_TIME = 4; // seconds (real time) to aim a Piercing shot before it fires itself
const AIM_SLOW = 0.25; // game speed while aiming it
const HUNT_SLOW = 0.2; // game speed while Hunter-killer marks its targets
const HUNT_MARK = 0.24; // real seconds between its locks
const HUNT_DWELL = 0.22; // real seconds the gun stays on each target after its shot
const HUNT_FIRE_SLOW = 0.4; // game speed while it fires

export function createGame({ renderer, pixel, level: startLevel, onExit = null, adBreak = (go) => go() }) {
  if (!CG) injectDevKitStyles();
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
  let trailPool = null; // the grenades' trails: their own pool (per scene), so they never steal the flashes'
  let scene, level, levelDef, combat, enemies, colliders, blocks, lamps, aimLine, aimMark, aimBeam, artyRing, pickups, crushing, shield;
  const strikes = []; // artillery shells on their way: { at, t, marker }
  const run = { hp: 100, time: 0, over: false, won: false };
  let stats = { ...BASE_STATS };
  const partMeshes = [];
  let lastSize = null; // the last resize, replayed when the view size changes (optics)
  let reload = 1;
  let speed = 0;
  let vulcanOn = false; // (the light tank's Vulcan: its own whirring loop)
  let vulcanT = 0; // seconds its loop keeps going without another round
  let hasAim = false;
  let pointer = null;
  let client = null;
  let hovered = null;
  let touch = matchMedia('(pointer: coarse)').matches;
  hud.setTouch(touch);

  // ------------------------------------------------------- level loading
  function loadLevel(id) {
    // a fresh run: anything the last one found and didn't finish with is dropped
    save.discardRun();
    save.beginRun();
    enemies?.dispose();
    levelDef = LEVELS.find((l) => l.id === id) || LEVELS[0];
    scene = new THREE.Scene();
    trailPool = null;
    level = levelDef.build(scene);
    colliders = level.colliders;
    blocks = level.blocks;
    // far below everything, a plain ground going on past the level's own
    // edges, for when the view's pulled right out
    {
      const skirt = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: level.skirt ?? 0x8e8f93 }));
      skirt.position.y = -6;
      skirt.renderOrder = -10;
      scene.add(skirt);
    }
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
    // the artillery strike's designation: a cyan ring the size of the area
    // the shells land in, a cross in the middle
    artyRing = new THREE.Group();
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x5fe6ff, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 40), ringMat);
    ring.rotation.x = -Math.PI / 2;
    artyRing.add(ring);
    for (const r of [0, Math.PI / 2]) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.06), ringMat);
      bar.rotation.set(-Math.PI / 2, 0, r);
      artyRing.add(bar);
    }
    const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: 0x5fe6ff, transparent: true, opacity: 0.1, depthWrite: false }));
    fill.rotation.x = -Math.PI / 2;
    artyRing.add(fill);
    artyRing.visible = false;
    scene.add(aimLine, aimMark, aimBeam, artyRing);
    shield = createShield(scene, EQUIPMENT.shield);
    strikes.length = 0;
    missiles.length = 0;
    tank.group.position.set(level.spawn.x, 0, level.spawn.z);
    tank.group.rotation.y = level.spawn.yaw;
    // a fresh run: the tank as it finished its last level (its saved
    // loadout), no rockets until the level hands them out
    const loadout = save.loadout(tankId).filter((id) => PARTS[id]).slice(0, def.slots);
    fitParts(loadout);
    Object.assign(run, {
      endlessDone: false, // (a new run: Endless can end again, by death or End run)
      bossSlow: 0, // a boss down: slow motion (bossFinale)
      finaleCam: null,
      camShot: null, // api.cameraTo
      finaleQ: null,
      hp: stats.maxHp,
      time: 0,
      over: false,
      won: false,
      scrap: 0,
      parts: [...loadout],
      tokens: 0,
      checkpoint: null, // the last checkpoint entered (an Easy revive goes back there)
      revived: false,
      pendingTips: [], // tips shown this run, saved when it's finished
      found: [], // parts picked at checkpoints this run
      hard: save.difficulty() === 'hard',
      dying: null,
      rockets: false,
      ability: false, // the signature ability (E), once the level hands it over
      abilityCd: 0,
      equipCd: 0, // the equipment's (Q) recharge
      msl: null, // guided missiles locking on / going
      sal: null, // the missile tank's salvo, locking on
      arty: 0, // designating an artillery strike: seconds left to pick the spot
      aiming: 0, // Piercing shot: seconds left to aim it
      hunt: null, // Hunter-killer: { targets, marked, phase 'mark' | 'fire', fired, aim }
      dash: 0, // Dash (light tank's Shift): seconds left
      retreat: 0, // Retreat (missile tank's Shift): seconds left
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
    hud.setTokens(0);
    // a scripted level (the tutorial) hands out the main gun and the scraps
    // counter as it introduces them; anywhere else they're there from the start
    // (once its tips have been seen, the level hands them over at the start)
    const all = !level.start;
    run.gun = all;
    run.rockets = all;
    run.ability = all;
    hud.showScrap(all);
    if (level.start) level.start(api);
    else if (touch) hud.prompt('Controls', 'Stick drives · <b>FIRE</b> shoots (it aims for you) · drag on the screen to aim', { seconds: 8 });
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
    if (levelDef.endless) stats.view *= 1.5; // (Endless: a wide arena, every tank sees further)
    tank.setFlameStyle(stats.afterburner ? 'afterburner' : 'normal');
    // the Vulcan: thin tracers, barely a kick per round
    const vulcan = list.includes('vulcan') && tank.kind === 'light';
    vulcanOn = vulcan;
    tank.tracerScale = vulcan ? 0.5 : 1;
    tank.apRounds = !!stats.apRounds; // armour-piercing: white tracers, a sharp hit, no fireball
    if ('kick' in tank) tank.kick = vulcan ? 0.12 : 1;
    if (lastSize) game.resize(...lastSize); // optics widen the view
    fitLauncher();
  }
  // the guided missiles' launcher, if this tank carries them (its own look
  // on each tank; the missiles come out of it)
  let launcher = null;
  function fitLauncher() {
    launcher?.group.removeFromParent();
    launcher = equipId() === 'atgm' ? buildLauncher(tank) : null;
    // part of the tank: same layer (its outline and see-through behind cover)
    launcher?.group.traverse((m) => m.isMesh && m.layers.enable(PLAYER_LAYER));
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
    spawnDrone: (x, z, opts) => enemies.spawnDrone(x, z, opts),
    spawnBridgeGun: (x, z, opts) => enemies.spawnBridgeGun(x, z, opts),
    spawnSpider: (x, z, opts) => enemies.spawnSpider(x, z, opts),
    spawnArty: (x, z, opts) => enemies.spawnArty(x, z, opts),
    spawnWallTurret: (x, z, opts) => enemies.spawnWallTurret(x, z, opts),
    spawnGunship: (x, z, opts) => enemies.spawnGunship(x, z, opts),
    escape: (e, x, z) => enemies.escape(e, x, z),
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
    // The tutorial only runs on the very first playthrough, on Easy: on
    // Hard, or once the level's been beaten, every tip counts as seen (and
    // everything it would hand out is there from the start).
    seen: (id) => run.hard || api.cleared || save.tips().includes(id) || run.pendingTips.includes(id),
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
    // slow: false runs the world at full speed (a scene playing out);
    // hideHud fades the HUD away till it's done
    // lock: the player can't let it go or act till it's done; camRate: how
    // fast the camera glides over (and back)
    // slowK: how slow (the game's speed under it); long: may stay up past
    // the usual few seconds (a lesson with its own timer)
    // turretReal: the turret keeps turning at its real speed (a lesson in
    // aiming, in deep slow motion)
    spotlight(spec, until, { maxTime = 3, frame = null, frameK = 0.45, slow = true, hideHud = false, lock = false, camRate = 6, slowK = SLOW_MO, long = false, turretReal = false } = {}) {
      run.spot = { until, t: 0, maxTime: Math.min(maxTime, long ? 12 : slow ? 3 : 6), frame, frameK, slow, lock, slowK, turretReal }; // never holds the game up for long
      run.camRate = camRate;
      hud.setSpot(spec);
      if (hideHud) {
        run.spotHud = true;
        hud.setGone(true);
      }
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
    // the camera glides over to a spot, holds it a moment, glides back
    cameraTo(at, hold = 2) {
      run.camShot = { at: at.clone(), t: hold + 1 };
      run.camRate = 2.2; // (a slow glide)
    },
    boss(e, name = 'Large drone') {
      run.boss = e ? { e, name } : null;
      if (e) e.isBoss = true; // (a boss goes out slowly, in a string of blasts)
      // Hard: every boss tougher, and hitting harder while it's up
      if (e && run.hard && !e.hardened) {
        e.hardened = true;
        e.maxHp = Math.round(e.maxHp * 1.35);
        e.hp = e.maxHp;
      }
      if (!e) hud.setBoss(null, null);
    },
    // Into a checkpoint: the tank rolls on through the shack door as the
    // screen fades, and comes out in the checkpoint interior already driving
    // onto the repair plate. A pick of parts pops up (or skip), then Continue
    // drives it out; it fades back to the street still rolling, out of the
    // shack's back door. gift: 'boost' rigs the drums as boosters.
    // offers: the parts this checkpoint can hand out (only ones not found
    // yet are shown, at most count of them; none: a repair stop)
    // keepEnemies: the machines out there aren't cleared away, they're held
    // frozen just as they are till the tank comes back out (endless: no
    // ducking in to lose them); repair: false, no free repair either
    depot(shack, { offers, count = 3, gift = null, onLeave, keepEnemies = false, repair = true }) {
      if (run.mode === 'depot') return;
      const room = level.depotRoom;
      // parts not found yet first; then ones you own, as improvements
      // (free levels), if they can still go up
      const have = save.owned();
      // only the level's own parts, ever: each one once (found, or as an
      // improvement if you already had it); once they're all had, a
      // checkpoint just repairs
      const pool = campaignLevel(levelDef.id)?.rewards;
      if (pool) offers = offers.filter((id) => pool.includes(id));
      const already = save.levelFinds(levelDef.id); // already had from this level (as the part, or its improvement): once each, ever
      offers = [...offers.filter((id) => !have.includes(id)), ...offers.filter((id) => have.includes(id) && improveTo(id) && !already.includes(id))].slice(0, count);
      if (!keepEnemies) hud.banner('Checkpoint reached'); // (not the endless base)
      run.checkpoint = shack; // where an Easy revive puts you back
      run.mode = 'depot';
      run.locked = true;
      queued = 0;
      // no rockets into the shack: the tank rolls in at driving speed and stops on the pad
      run.boost = run.dash = run.brk = run.retreat = 0;
      speed = Math.min(speed, MAX_SPEED * stats.speed);
      hud.setArrow(null);
      hud.setSpot(null);
      hud.clearPrompt();
      run.spot = null;
      run.depot = { shack, room, step: 'enter', offers, gift, onLeave, t: 0, fieldBounds: level.bounds, focus: null, freeze: keepEnemies, noRepair: !repair };
      if (shack.inward) run.auto = shack.door.clone().setY(0).addScaledVector(shack.inward, 3.5); // (a shed turned some other way: straight in)
      else {
        level.bounds = { ...level.bounds, maxX: shack.x0 + 4 };
        run.auto = new THREE.Vector3(shack.x0 + 3, 0, shack.door.z + (pos.z - shack.door.z) * 0.5); // (in through the door, wherever it is across the street)
      }
      setCursor();
      api.transition(() => {
        if (keepEnemies) enemies.clearBolts(); // (held where they are; only the rounds in the air go)
        else enemies.retire(); // whatever was left behind stays behind
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
    banner: (text) => hud.banner(text),
    clearPrompt: () => hud.clearPrompt(),
    objective: (text) => hud.setObjective(text),
    marker: (p, label) => hud.setMarker(p, label),
    arrow: (target, html, big) => hud.setArrow(target, html && rebindHints(html), big),
    // the touch FIRE button on screen (for a spotlight / an arrow)
    fireScreen: () => {
      const c = hud.fireCenter();
      return { screen: [c.x, c.y], r: 72 };
    },
    // the gun's on what was tapped (locked on, or aimed by hand) and lined up
    // the tutorial's fallback: the turret latched on for you, and a shot
    lockOn(e) {
      if (!e?.alive) return;
      autoTarget = e;
      manualAim = false;
      aimTouch = null;
      forcedAim = e; // (with a mouse: the turret's swung onto it till it's down)
    },
    fireNow: () => fire(),
    waveHud: (o) => hud.setWave(o),
    // aim taps that took (a latch, or a tap in full manual mode): the
    // tutorial waits for one made after the enemies show up
    get aimTaps() {
      return aimTaps;
    },
    get aimLocked() {
      return hasAim && (!!autoTarget?.alive || manualAim) && tank.aimError() < 0.15;
    },
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
      enemies.clearBolts();
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
        if (first.part && PARTS[first.part] && !save.owned().includes(first.part)) {
          save.own(first.part);
          save.setPartLevel(first.part, PARTS[first.part].startLevel || 1);
          save.addNews([{ kind: 'part', id: first.part }]);
          rewards.push(['First clear reward', `${PARTS[first.part].name} (part)`]);
        }
        if (first.tokens) {
          save.addTokens(first.tokens);
          rewards.push(['First clear reward', `+${first.tokens} tokens`]);
        }
        if (first.equipment && EQUIPMENT[first.equipment] && !save.ownedEquipment().includes(first.equipment)) {
          save.ownEquipment(first.equipment);
          // (not fitted for you: the hangar points you to its slot)
          save.addNews([{ kind: 'equipment', id: first.equipment }]);
          rewards.push(['First clear reward', EQUIPMENT[first.equipment].name]);
        }
      }
      pickups.collectAll(collect);
      save.commitRun(); // the level's done: what it found is kept
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
          [['Time', `${m}:${s}`], ['Enemies destroyed', enemies.killed], ['Scraps picked up', run.scrap], ...(run.tokens ? [['Tokens picked up', run.tokens]] : []), ...rewards],
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
  let vigK = 0; // eased 0..1 while Hunter-killer runs (the vignette)
  let deathK = 0; // eased 0..1 while the tank goes up
  let rangeK = 0; // eased 0..1 while Ranging has the view opened out
  let salvoK = 0; // eased 0..1 while a missile salvo's out (the view pulled back)

  // A machine died: kill chain, scrap and the odd repair spark, and a
  // freeze-frame when the cannon blew it apart.
  function onKill(e, blasted) {
    // Ready rack: a kill reloads the main gun (autocannon: +3 rounds, but
    // not mid-reload: the reload just carries on)
    if (stats.hotLoader && !(stats.mag && run.magT > 0)) {
      if (stats.mag) run.mag = Math.min(stats.mag, run.mag + 3);
      else reload = 1;
      pulse('autoloader');
    }
    // Afterburner: kills while boosting take time off the recharge
    if (stats.boostRefund && (run.boost > 0 || run.dash > 0) && run.boostCd > 0) {
      run.boostCd = Math.max(0, run.boostCd - stats.boostRefund);
      pulse('afterburner');
    }
    run.chain = Math.min(MULT_MAX, Math.max(1, run.chain) + (run.chainT > 0 ? 1 : 0));
    run.chainT = MULT_HOLD;
    const mult = run.chain;
    const at = new THREE.Vector3(e.pos.x, 0.8 * e.stats.scale, e.pos.z);
    // scraps: a blue crystal per five, amber shards for the rest; the odd
    // medkit; rarely an upgrade token (bigger machines more often, the boss
    // always a couple)
    // (Endless: under half the scraps a kill, or it'd drown you in them)
    const sc = levelDef.endless ? Math.max(1, Math.round(e.stats.scrap * 0.4)) : e.stats.scrap;
    const big = Math.floor(sc / 5);
    if (big) pickups.spawn(at, big, 'bigscrap', 5 * mult);
    if (sc % 5) pickups.spawn(at, sc % 5, 'scrap', mult);
    run.drops++;
    if (e.stats.scale > 1.5) pickups.spawn(at, 3, 'repair', 15);
    else if (Math.random() < 0.12) pickups.spawn(at, 1, 'repair', 12);
    const tokenChance = (e.stats.scale > 1.5 ? 1 : e.kind === 'walker' ? 0.06 : 0.015) * (run.hard ? 1.5 : 1) * (levelDef.endless ? 0.5 : 1);
    if (Math.random() < tokenChance) pickups.spawn(at, e.stats.scale > 1.5 ? 2 : 1, 'token', 1);
    if (blasted) run.hitstop = Math.max(run.hitstop, e.stats.scale > 1.5 ? 0.25 : 0.075);
    if (run.chain >= 2) hud.damage(at.clone().setY(at.y + 1.2), 0, 'chain', `x${mult}`);
    if (run.boss?.e === e) bossFinale(e);
  }
  // A boss down: the world drops into slow motion and eases back, the
  // camera glides over to the wreck and holds there; the big ones go up in
  // a chain of huge bright blasts, sparks everywhere.
  const FINALE_SLOW = 2.4; // seconds (real) of slow motion, easing out
  function bossFinale(e) {
    run.bossSlow = FINALE_SLOW;
    run.finaleCam = { at: new THREE.Vector3(e.pos.x, 0, e.pos.z), t: 3 };
    if (e.stats.scale > 1.5 && !e.stats.spider) {
      const s = e.stats.scale;
      run.finaleQ = [0, 0.12, 0.26, 0.42, 0.6, 0.85].map((t, i) => ({ t, at: new THREE.Vector3(e.pos.x + (i ? (Math.random() - 0.5) * 2.4 * s : 0), (0.6 + Math.random() * 0.8) * s, e.pos.z + (i ? (Math.random() - 0.5) * 2 * s : 0)), big: i === 0 || i === 5 }));
    }
  }
  function finaleFrame(realDt) {
    if (!run.finaleQ?.length) return;
    for (let i = run.finaleQ.length - 1; i >= 0; i--) {
      const b = run.finaleQ[i];
      b.t -= realDt;
      if (b.t > 0) continue;
      run.finaleQ.splice(i, 1);
      const g = new THREE.Vector3(b.at.x, 0.06, b.at.z);
      combat.explode(b.at);
      combat.glow.flash(b.at, 0xffffff, b.big ? 1.4 : 0.8, b.big ? 10 : 6, b.big ? 0.35 : 0.2);
      combat.glow.flash(b.at, 0xffb347, b.big ? 1.8 : 1.1, b.big ? 13 : 8, b.big ? 0.6 : 0.4);
      combat.glow.ring(g, 0xffe2a0, 0.5, b.big ? 9 : 5, 0.5);
      combat.glow.light(b.at, 0xffc070, b.big ? 420 : 200, 0.5);
      combat.fx.burst(b.at, { count: b.big ? 140 : 60, speed: b.big ? 18 : 12, color: 0xffe08a, life: 0.9, size: 0.12, gravity: 9 });
      combat.fx.burst(b.at, { count: b.big ? 70 : 30, speed: b.big ? 24 : 15, color: 0xffffff, life: 0.5, size: 0.08, gravity: 6 });
      for (let k = 0; k < (b.big ? 14 : 6); k++) combat.puffs.spawn(b.at, new THREE.Vector3((Math.random() - 0.5) * 8, 2 + Math.random() * 4, (Math.random() - 0.5) * 8), { color: 0x5f5a54, s0: 0.6, s1: 2.4, life: 2, drag: 2, lift: 0.6, fadeAt: 0.3 });
      combat.shake = Math.max(combat.shake, b.big ? 1.3 : 0.7);
    }
  }

  function collect(p) {
    if (p.kind === 'repair') {
      const before = run.hp;
      run.hp = Math.min(stats.maxHp, run.hp + p.value);
      hud.setHull(run.hp, stats.maxHp);
      if (run.hp > before) hud.heal(run.hp - before);
      combat.fx.burst(pos.clone().setY(1.4), { count: 8, speed: 3, color: 0x4fdc6a, life: 0.3, size: 0.07, gravity: 4 });
    } else if (p.kind === 'token') {
      // tokens go straight into the save: rare enough never to lose one
      save.addTokens(p.value);
      run.tokens = (run.tokens || 0) + p.value;
      hud.setTokens(run.tokens, true); // this level's, like the scraps
      hud.damage(pos.clone().setY(2.4), 0, 'token', '+1 token');
      combat.glow.flash(pos.clone().setY(1.4), 0xc77dff, 0.3, 1.2, 0.12);
      combat.fx.burst(pos.clone().setY(1.6), { count: 16, speed: 4, color: 0xc77dff, life: 0.4, size: 0.08, gravity: 6 });
    } else {
      run.scrap += p.value;
      hud.setScrap(run.scrap);
      combat.glow.flash(pos.clone().setY(1.4), 0xffd08a, 0.1, 0.5, 0.06);
    }
  }

  // A shell burst: splash the machines, then let the level react (the gate).
  // small: an autocannon round. It breaks junk it lands right on; a
  // barricade or the gate takes a few of them.
  // shell: { radius, damage } instead of the gun's (an artillery shell)
  function onImpact(at, mesh, small = false, shell = null) {
    // armour-piercing: the machine it strikes takes the whole hit; a small
    // splash round it does a fraction to anything else close by
    // (and whatever a shell strikes takes its full hit, more with a Rangefinder)
    const struck = !shell ? mesh?.userData?.enemy : null;
    // (any round that strikes a machine hits it in full, wherever on it: a
    // big one's centre can be further off than a small round's splash)
    const direct = struck || null;
    const hits = [];
    if (direct?.alive) {
      const dmg = stats.cannonDamage * Math.max(1, stats.directHit);
      hits.push({ e: direct, amount: Math.round(dmg), killed: enemies.damage(direct, dmg, at) });
    }
    const amount = shell ? shell.damage : stats.apRounds ? stats.cannonDamage * 0.4 : stats.cannonDamage;
    hits.push(...enemies.blast(at, shell ? shell.radius : stats.splash, amount, direct));
    for (const h of hits) {
      const p = new THREE.Vector3(h.e.pos.x, 1.2, h.e.pos.z);
      hud.damage(p, h.amount, 'big');
      if (h.killed) hud.damage(p.clone().setY(1.9), 0, 'kill');
    }
    // a shell wrecks whatever it lands on or next to: barricades, the gate,
    // cars, junk, poles (not the container walls)
    for (const c of level.crushables || []) {
      if (c.armored || c.done || c.ramOnly) continue; // (ramOnly: the boost lesson's barricade)
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
    sfx.play('explosion', { gain: 0.9 });
    enemies.clearBolts();
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
      if (levelDef.endless) return void endlessEnd('Destroyed');
      // Easy, past a checkpoint, the first death: back to that checkpoint
      // (the revive takes Retry's place: just Revive or Exit)
      if (!run.hard && run.checkpoint && !run.revived && !levelDef.endless) {
        // (no results yet: the run's not over)
        hud.showEnd(
          'lose',
          'Destroyed',
          [],
          'Revive at checkpoint',
          () => revive(),
          '',
          [],
          onExit ? ['Exit', () => (save.commitRun(), bank(Math.floor(run.scrap / 2)), onExit())] : null,
          null,
        );
        setCursor();
        return;
      }
      const kept = Math.floor(run.scrap / 2);
      const total = bank(kept);
      save.commitRun(); // (destroyed: the level's over, the parts found are kept)
      hud.showEnd(
        'lose',
        'Destroyed',
        [['Enemies destroyed', enemies.killed], ['Scraps picked up', run.scrap]],
        'Retry',
        () => adBreak(() => loadLevel(levelDef.id)),
        `Half recovered: +${kept} scraps${total != null ? ` · ${total} total` : ''}`,
        partCards(),
        onExit ? ['Exit', () => onExit()] : null,
      );
      setCursor();
    }
  }
  // Endless over (destroyed, or left from the pause menu): everything picked
  // up is kept, the run's XP goes onto the reward track (paying out every
  // tier it reaches), and the end screen fills the track's bar.
  function endlessEnd(title) {
    if (run.endlessDone) return;
    run.endlessDone = true;
    run.over = true;
    fitting.hide(); // (ended from the base)
    if (run.paused) setPaused(false);
    enemies.clearBolts();
    const time = run.endlessT || 0;
    const waves = run.endlessWaves || 0;
    const kills = enemies.killed;
    const scraps = run.scrap;
    const total = bank(scraps);
    save.commitRun();
    const xp = runXp({ kills, waves, time });
    const res = bankRun({ xp, time, wave: waves, kills });
    hud.showEndless(
      { title, time, waves, kills, scraps, tokens: run.tokens || 0, xp, total, ...res },
      { retry: () => (hud.hideEndless(), adBreak(() => loadLevel(levelDef.id))), exit: onExit ? () => (hud.hideEndless(), onExit()) : null },
    );
    setCursor();
  }
  // The last one or two machines, stuck somewhere far off (behind a heap,
  // up a side street): after 10 s they're moved to just out of view
  // nearby, and come on from there. Never a boss, never mid-boss-fight.
  const ndcTmp = new THREE.Vector3();
  const offScreen = (x, y, z) => {
    ndcTmp.set(x, y, z).project(camera);
    return Math.abs(ndcTmp.x) > 1.08 || Math.abs(ndcTmp.y) > 1.08;
  };
  function stragglers(dt) {
    if (run.over || run.mode !== 'field' || run.spot) return;
    const live = enemies.alive.filter((e) => !(e.delay > 0));
    if (!live.length || live.length > 2 || live.some((e) => e.stats.static || e.stats.scale > 1.5)) {
      for (const e of live) e.strayT = 0;
      return;
    }
    for (const e of live) {
      const d = Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z);
      e.strayT = d > 16 || (!e.los && d > 10) ? (e.strayT || 0) + dt : 0;
      if (e.strayT < 10) continue;
      // somewhere round the tank, just off screen, inside the area and
      // clear of walls
      const b = level.bounds || {};
      const reach = (camera.top - camera.bottom) / camera.zoom;
      let best = null;
      for (let i = 0; i < 28; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = reach * (0.75 + Math.random() * 0.5);
        const p = new THREE.Vector3(pos.x + Math.cos(a) * r, 0, pos.z + Math.sin(a) * r);
        if ((b.minX != null && p.x < b.minX + 1) || (b.maxX != null && p.x > b.maxX - 1) || (b.minZ != null && p.z < b.minZ + 1) || (b.maxZ != null && p.z > b.maxZ - 1)) continue;
        if (!offScreen(p.x, 0.8, p.z)) continue;
        if (p.x < pos.x + 2) continue; // ahead only: never brought in behind (the way on is forward)
        if (level.heightAt && Math.abs(level.heightAt(p.x, p.z) - level.heightAt(pos.x, pos.z)) > 1.2) continue; // (on the tank's level, not under or over it)
        const q = p.clone();
        pushOut(q, () => ({ x: q.x, z: q.z, hx: 0.6, hz: 0.4, yaw: 0 }), blocks, 2);
        if (q.distanceTo(p) > 0.3) continue; // inside something
        if (!best || p.distanceTo(pos) < best.distanceTo(pos)) best = p;
      }
      if (!best) continue;
      e.pos.x = best.x;
      e.pos.z = best.z;
      e.via = [];
      e.strayT = 0;
    }
  }
  // red arrows on a ring round the middle of the screen, one for each
  // machine out of view, pointing the way to it (bigger when close)
  function enemyPointers() {
    if (run.over || run.mode !== 'field') return hud.setPointers([]);
    const out = [];
    for (const e of enemies.alive) {
      if (e.delay > 0) continue;
      ndcTmp.set(e.pos.x, 0.8 * (e.stats.scale || 1), e.pos.z).project(camera);
      if (Math.abs(ndcTmp.x) <= 1 && Math.abs(ndcTmp.y) <= 1) continue;
      const d = Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z);
      out.push({ a: Math.atan2(-ndcTmp.y * (canvas.clientHeight || 1), ndcTmp.x * (canvas.clientWidth || 1)), near: THREE.MathUtils.clamp(1 - (d - 10) / 40, 0, 1), boss: e.stats.scale > 1.5 });
    }
    // Endless: the base, always, when it's off screen
    const base = levelDef.endless && level.shacks?.[0];
    if (base) {
      ndcTmp.set(base.door.x + 3, 1, base.door.z).project(camera);
      if (Math.abs(ndcTmp.x) > 1 || Math.abs(ndcTmp.y) > 1) out.push({ a: Math.atan2(-ndcTmp.y * (canvas.clientHeight || 1), ndcTmp.x * (canvas.clientWidth || 1)), near: 1, base: true });
    }
    hud.setPointers(out);
  }

  // Back at the last checkpoint's door: a fresh tank with its parts, full
  // hull, the enemies where they've got to. Once per level.
  function revive() {
    const shack = run.checkpoint;
    hud.hideEnd();
    hud.setGone(false);
    for (const f of run.dying?.flung || []) f.obj.removeFromParent();
    run.dying = null;
    tank.group.removeFromParent();
    tankId = null;
    useTank(save.tank());
    scene.add(tank.group);
    fitParts(run.parts);
    tank.group.position.set(shack.outside.x - (shack.exitDir?.x ?? 1) * 2.5, 0, shack.outside.z - (shack.exitDir?.z ?? 0) * 2.5);
    tank.group.rotation.y = shack.exitYaw ?? 0;
    speed = 0;
    // the fight's still on: the enemies stay as they are (they kept going
    // while you were down); only the rounds in the air are gone, and a
    // moment's grace to get moving
    enemies.clearBolts();
    Object.assign(run, { grace: 2, over: false, revived: true, hp: stats.maxHp, boost: 0, dash: 0, brk: 0, aiming: 0, arty: 0, msl: null, sal: null, retreat: 0, magT: 0, mag: stats.mag, mReload: false, trickleT: 0, rangeT: 0 });
    reload = 1;
    hud.setHull(run.hp, stats.maxHp);
    camTarget.set(pos.x + 0.6, 0.8, pos.z);
    hud.banner('Revived');
    setCursor();
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
    // Explosion: the next hit after a few quiet seconds is blocked, and
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
    if (run.grace > 0) return; // (just revived)
    damage *= run.dmgMul || 1; // (Endless: they hit harder as the run goes on)
    if (run.hard && run.boss?.e?.alive) damage *= 1.15; // (Hard: a boss fight hits harder)
    run.hp -= damage * stats.armor * (run.shield > 0 ? 1 - stats.breakShield : 1);
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
  // the camera swung out to show a boss lets go when you act: the slow
  // motion and the spotlight end at once, the camera holds a beat (so a
  // quick strike on the boss still lands where you see it), then swings back
  const letGoFrame = () => {
    if (!run.spot?.frame || run.spot.hold != null || run.spot.lock) return;
    run.spot.hold = 0.5;
    hud.setSpot(null);
  };
  function fire() {
    letGoFrame();
    if (run.over || run.mode !== 'field' || run.locked || !run.gun || run.hunt) return; // (Hunter-killer has the gun)
    queued = 0.7;
  }
  // Shift: boost. The battle tank's drums swing round and light, the light
  // tank's exhausts flare; either way it charges.
  function boost() {
    if (run.spot?.lock) return; // (a scene playing: hands off)
    letGoFrame();
    if (!run.rockets || run.over || run.mode !== 'field' || run.locked || run.boostCd > 0) return;
    if (def.move === 'retreat') {
      // the missile tank's Retreat: the exhausts at the front swing forward
      // and fire, rocketing it straight back out of trouble
      run.boostCd = stats.boostCooldown;
      run.boosts++;
      run.retreat = stats.retreatTime;
      run.shield = stats.retreatTime + 0.1;
      speed = -BOOST_SPEED * stats.retreatSpeed;
      // and a quick patch-up on the way out
      if (run.hp < stats.maxHp) {
        run.hp = Math.min(stats.maxHp, run.hp + 5);
        hud.setHull(run.hp, stats.maxHp);
        hud.heal(5);
      }
      tank.setRocket(1, true, 0);
      for (const n of tank.rocketNozzles()) combat.glow.flash(n, 0xfff0c8, 0.25, 1.4, 0.12);
      combat.shake = Math.max(combat.shake, 0.22);
      return launch(0.7);
    }
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
  // the gun going off: the main cannon, the autocannon's crack, the Vulcan's whir
  function gunSound() {
    if (def.gun !== 'autocannon') return void sfx.play('cannon', { gain: 0.75, rate: 0.97 + Math.random() * 0.06 });
    if (vulcanOn) return void (vulcanT = 0.2);
    sfx.play('autocannon', { gain: 0.5, rate: 0.95 + Math.random() * 0.1 });
  }
  // The warning: the enemy nearest to letting off a big shot (a cannon or
  // beam charging, artillery winding up) counts down in tiny high beeps,
  // closer together and higher as it comes. One countdown at a time: when
  // that one fires, the next nearest carries straight on at its own pace.
  function warnBeeps(dt) {
    let best = null;
    let left = Infinity;
    let total = 1;
    for (const e of enemies.alive) {
      if (e.delay > 0) continue;
      if (e.charge > 0 && e.charge < left) [best, left, total] = [e, e.charge, e.stats.charge || 2];
      if (e.artyWind > 0 && e.artyWind < left) [best, left, total] = [e, e.artyWind, 0.7];
    }
    if (!best || !dt) return void (run.warnT = 0);
    run.warnT = (run.warnT || 0) - dt;
    if (run.warnT > 0) return;
    // (always the top pitch: only the pace climbs)
    sfx.at('beep', best.pos, { gain: 0.3, rate: 1.6 });
    run.warnT = Math.max(0.045, Math.min(0.4, left * 0.2));
  }
  // the tank's own sounds: the treads rattling, quiet, coming up from
  // silence as it gets moving; the rockets roaring while they burn
  function engineSounds(dt) {
    const live = !run.paused && !run.over && !run.dying;
    const k = live ? Math.min(1, Math.abs(speed) / (MAX_SPEED * stats.speed)) : 0;
    sfx.listen(pos);
    // (a faint idle rumble even standing still)
    sfx.loop('treads', live ? 0.025 + k * 0.09 : 0, 0.75 + 0.4 * Math.min(1.4, k), k > 0.02 ? 0.35 : 0.2);
    // the Vulcan: its whir while rounds keep coming, then its wind-down
    vulcanT -= dt;
    const spin = live && vulcanT > 0;
    // (spinning up: the burst's own start, then the steady loop takes over)
    if (spin && !run.vulcanSpin) sfx.play('vulcanStart', { gain: 0.4 });
    sfx.loop('vulcan', spin ? 0.4 : 0, 1, spin ? 0.015 : 0.03, spin && !run.vulcanSpin ? 0.22 : 0);
    if (!spin && run.vulcanSpin) sfx.play('vulcanTail', { gain: 0.4 });
    run.vulcanSpin = spin;
    warnBeeps(live ? dt : 0);
    const roar = live && (run.boost > 0 || run.dash > 0 || run.retreat > 0 || run.brk > 0);
    sfx.loop('rocket', roar ? 0.5 : 0, 1, roar ? 0.04 : 0.18);
    // a bang as the rockets light (sudden, not just a roar), a softer one as they cut
    if (roar && !run.roared) sfx.play('boom', { gain: 0.7, rate: 1.1 });
    else if (!roar && run.roared && live) sfx.play('boom', { gain: 0.25, rate: 1.3 });
    run.roared = roar;
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
    if (run.spot?.lock) return; // (a scene playing: hands off)
    letGoFrame();
    if (!run.ability || run.over || run.mode !== 'field' || run.locked) return;
    if (def.ability === 'pierce') {
      if (run.aiming > 0) return firePierce(); // E again: fire now
      if (run.abilityCd > 0) return;
      run.aiming = AIM_TIME; // time slows; aim, then click (or let go) to fire
      trigger = false;
      queued = 0;
    } else if (def.ability === 'breakthrough') breakthrough();
    else if (def.ability === 'salvo') lockSalvo();
    else if (def.ability === 'hunter') startHunt();
  }

  // Equipment (Q). The artillery strike: Q, then click (or tap) a spot; the
  // shells come down there a moment later. Q again (or Esc) calls it off.
  function equipId() {
    const id = save.equipment(tankId);
    return id && EQUIPMENT[id] && save.ownedEquipment().includes(id) ? id : null;
  }
  function equipment() {
    if (run.spot?.lock) return; // (a scene playing: hands off)
    letGoFrame();
    const id = equipId();
    if (!id || !run.gun || run.over || run.mode !== 'field' || run.locked) return;
    if (run.arty > 0) return void (run.arty = 0); // Q again: call it off
    if (run.equipCd > 0 || run.aiming > 0) return;
    // the guided missiles: no picking, they lock on by themselves
    if (id === 'atgm') return lockMissiles();
    if (id === 'shield') return raiseShield();
    // picking the spot
    sfx.play('beep2', { gain: 0.45 });
    run.armed = id;
    run.arty = DESIGNATE[id] || 6;
    trigger = false;
  }
  // The shield (Q): up at once in front of the turret, for a few seconds
  function raiseShield() {
    const E = EQUIPMENT.shield;
    sfx.play('beep2', { gain: 0.45 });
    run.barrier = E.time;
    run.equipCd = E.cooldown * stats.cooldownMul;
    const at = pos.clone().setY(pos.y + 1.2);
    combat.glow.flash(at, 0x9ff4ff, 0.25, 3.2, 0.15);
    combat.glow.light(at, 0x5fe6ff, 30, 0.3);
    combat.shake = Math.max(combat.shake, 0.15);
  }
  // where the shield stands, for the machines' rounds (null: it's down)
  const shieldNow = () => (run.barrier > 0 && run.mode === 'field' && !run.over ? { x: pos.x, z: pos.z, y: pos.y, yaw: tank.group.rotation.y + tank.turret.rotation.y, r: shield.radius, h: shield.height } : null);
  function shieldHit(point) {
    shield.hit(point);
    combat.glow.flash(point, 0xc8fbff, 0.12, 1.4, 0.08);
    combat.glow.light(point, 0x5fe6ff, 16, 0.12);
    combat.fx.burst(point, { count: 10, speed: 5, color: 0x9ff4ff, life: 0.25, size: 0.06, gravity: 6 });
  }
  const DESIGNATE = { artillery: 8 }; // seconds to pick before it's called off
  // the click while designating: the strike on the spot, or the missile at
  // the locked machine (no lock: nothing happens, keep pointing)
  function useEquipment() {
    if (!hasAim) return;
    callStrike(aimPoint.clone());
  }

  // The guided missiles (Q): they lock on to up to three machines in view
  // by themselves (nearest first; fewer machines: some get two), a red
  // MSL LOCK box over each, then three fire off the turret one after
  // another, white-hot on bright trails, and each lands with a big blast.
  const missiles = [];
  const mslAim = (e) => new THREE.Vector3(e.pos.x, e.pos.y + (e.stats.flying || e.stats.fly ? 0 : 0.8 * (e.stats.scale || 1)), e.pos.z);
  // o: { count, damage, blast, ability } (the missile tank's salvo: its own
  // numbers and cooldown; default the equipment's)
  function lockMissiles(o = {}) {
    const E = EQUIPMENT.atgm;
    const count = o.count || E.missiles;
    // the toughest machines within range (the most HP left to chew
    // through, not the most hurt)
    const inView = enemies.alive
      .filter((e) => Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z) < E.range * stats.view)
      .sort((a, b) => b.hp - a.hp)
      .slice(0, count);
    if (!inView.length) return void hud.damage(pos.clone().setY(pos.y + 2.4), 0, 'chain', 'MSL no targets!');
    if (o.ability) run.abilityCd = stats.salvoCooldown;
    else (run.equipCd = E.cooldown * stats.cooldownMul), sfx.play('beep2', { gain: 0.45 });
    const targets = [];
    for (let i = 0; i < count; i++) targets.push(inView[i % inView.length]);
    run.msl = { targets, t: E.lockTime, fired: 0, gap: 0, damage: o.damage, blast: o.blast };
  }
  // The missile tank's Missile salvo (E): eight lock boxes. One on each of
  // the toughest machines in range; any left over lock on to the ground
  // round the aim (or round them), like an artillery spot. Then all eight
  // fire at once, climb, and turn sharply to slam straight down on them.
  function lockSalvo() {
    if (run.abilityCd > 0 || run.sal || run.over || run.mode !== 'field') return;
    const E = EQUIPMENT.atgm;
    const N = 8;
    // the whole zoomed-out view: what's on screen once it pulls back
    const reach = ((camera.top - camera.bottom) / 2) * (stats.salvoZoom || 1) * 1.35;
    const foes = enemies.alive
      .filter((e) => !(e.delay > 0) && Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z) < reach)
      .sort((a, b) => b.hp - a.hp)
      .slice(0, N);
    // nothing on screen (the view as it'll be once zoomed right out): no salvo
    if (!foes.length) return void hud.damage(pos.clone().setY(pos.y + 2.4), 0, 'chain', 'MSL no targets!');
    const targets = foes.map((e) => ({ e }));
    const center = hasAim ? aimPoint.clone() : foes[0] ? foes[0].pos.clone() : pos.clone().add(new THREE.Vector3(Math.cos(tank.group.rotation.y) * 10, 0, -Math.sin(tank.group.rotation.y) * 10));
    for (let i = 0; targets.length < N; i++) {
      // the spares: clustered round the machines locked (like an artillery
      // strike's spread), the toughest first; only with nothing in sight do
      // they spread round the aim point
      const base = foes.length ? foes[i % foes.length].pos : center;
      const a = Math.random() * Math.PI * 2;
      const r = foes.length ? 0.6 + Math.random() * 1.9 : 1.2 + Math.random() * 3.2;
      const p = new THREE.Vector3(base.x + Math.cos(a) * r, 0, base.z + Math.sin(a) * r);
      p.y = (level.heightAt ? level.heightAt(p.x, p.z) : 0) + 0.2;
      targets.push({ point: p });
    }
    run.abilityCd = stats.salvoCooldown;
    run.sal = { salvo: true, targets, t: 0.7, fired: 0, gap: 0, damage: stats.cannonDamage * 1.81 * (stats.abilityPower || 1), blast: stats.splash * 1.15 }; // (the salvo keeps its punch: the single missiles are the weaker ones)
  }
  // e: the machine it homes on (or null: o.point, a spot); o: { damage,
  // blast, top (climb, then dive straight down on it) } (default the
  // equipment's)
  // The MIRV (the missile tank's Legendary): right out of the tube the
  // missile splits into three smaller ones that fly on together at the same
  // target, a little spread, like a shotgun: 45% of its damage each
  function splitWarheads(ms) {
    const from = ms.m.position.clone();
    const fwd = ms.vel.clone().normalize();
    combat.glow.flash(from, 0xffffff, 0.2, 1.2, 0.06);
    combat.fx.burst(from, { count: 6, speed: 4, color: 0xffe6b0, life: 0.2, size: 0.05, gravity: 2 });
    const e = ms.e?.alive ? ms.e : null;
    for (let k = 0; k < 3; k++) {
      // (no machine: three spots a step apart round where it was going)
      const point = e ? null : ms.aim.clone().add(new THREE.Vector3((k - 1) * 0.6, 0, (k - 1) * 0.6));
      launchMissile(e, k, { point, from, warhead: true, damage: ms.damage * 0.45, blast: ms.blast * 0.7 });
      const w = missiles[missiles.length - 1];
      w.t = 0.2;
      w.vel.copy(fwd).applyAxisAngle(UP, (k - 1) * 0.12).multiplyScalar(ms.vel.length() * 1.1);
    }
  }
  // the missile's meshes: one set of geometry and materials for every
  // missile there is (a full salvo is dozens of them)
  let mslParts = null;
  function mslKit() {
    if (mslParts) return mslParts;
    const add = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
    const part = (geo, color, o = {}) => ({ geo, mat: new THREE.MeshBasicMaterial({ color, ...o }) });
    return (mslParts = {
      body: part(new THREE.CylinderGeometry(0.1, 0.1, 0.8, 8).rotateX(Math.PI / 2), 0xd8dde2),
      nose: part(new THREE.ConeGeometry(0.1, 0.26, 8).rotateX(Math.PI / 2), 0xff3b2f),
      fin: part(new THREE.BoxGeometry(0.46, 0.03, 0.18), 0x5f6b48),
      core: part(new THREE.SphereGeometry(0.13, 8, 6), 0xffffff),
      glow: part(new THREE.SphereGeometry(0.45, 10, 8), 0xffb347, { ...add, opacity: 0.55 }),
      plume: part(new THREE.ConeGeometry(0.16, 0.9, 8).rotateX(-Math.PI / 2), 0xffe066, { ...add, opacity: 0.85 }),
    });
  }
  function splitDiving(ms) {
    const from = ms.m.position.clone();
    combat.glow.flash(from, 0xffffff, 0.2, 1.2, 0.06);
    const e = ms.e?.alive ? ms.e : null;
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + Math.random();
      const point = (e ? mslAim(e) : ms.aim.clone()).add(new THREE.Vector3(Math.cos(a) * 0.7, 0, Math.sin(a) * 0.7));
      launchMissile(k === 0 ? e : null, k, { point, from, warhead: true, top: true, damage: ms.damage * 0.45, blast: ms.blast * 0.7 });
      const w = missiles[missiles.length - 1];
      w.dived = true;
      w.t = 0.75;
      w.vel.copy(point).sub(from).normalize().multiplyScalar(EQUIPMENT.atgm.speed * 1.3);
    }
  }
  function launchMissile(e, k, o = {}) {
    const E = EQUIPMENT.atgm;
    // off the turret roof, left, right, centre
    const side = new THREE.Vector3(-Math.sin(tank.group.rotation.y), 0, -Math.cos(tank.group.rotation.y));
    let from = pos.clone().add(new THREE.Vector3(0, 2.0, 0)).addScaledVector(side, [-0.5, 0.5, 0][k % 3]);
    let out = null; // the way the tube points
    if (!o.warhead) sfx.play('launch', { gain: 0.5, rate: 0.95 + Math.random() * 0.1 }); // (not a MIRV's split)
    if (o.from) from = o.from.clone(); // (a MIRV warhead: from where it split)
    else if (tank.missile) {
      // the missile tank: out of its pack, one canister after another
      const f = tank.fire();
      from = f.position;
      out = f.direction;
    } else if (launcher) {
      tank.group.updateWorldMatrix(true, true);
      from = launcher.mouth.getWorldPosition(new THREE.Vector3());
      out = new THREE.Vector3(1, 0, 0).transformDirection(launcher.mouth.matrixWorld);
    }
    const m = new THREE.Group();
    const K = mslKit();
    const add = (part, z) => {
      const mesh = new THREE.Mesh(K[part].geo, K[part].mat);
      mesh.position.z = z;
      m.add(mesh);
      return mesh;
    };
    add('body', 0);
    add('nose', 0.53);
    for (const r of [0, Math.PI / 2]) add('fin', -0.3).rotation.z = r;
    // the motor: a white-hot core and a big soft glow round it
    add('core', -0.48);
    const glow = add('glow', -0.55);
    const plume = add('plume', -0.95);
    if (o.warhead) m.scale.setScalar(0.6);
    m.position.copy(from);
    scene.add(m);
    const aim = e ? mslAim(e) : o.point.clone();
    const dir = new THREE.Vector3(aim.x - from.x, 0, aim.z - from.z).normalize();
    if (out) dir.lerp(out, 0.6).setY(Math.max(0.5, out.y + 0.4)).normalize();
    else dir.addScaledVector(side, [-0.6, 0.6, 0][k % 3]).setY(1.1).normalize();
    if (o.top) dir.set((aim.x - from.x) * 0.04, 1, (aim.z - from.z) * 0.04).normalize(); // straight up first
    missiles.push({ m, glow, plume, e, vel: dir.multiplyScalar(o.top ? 16 : 9), t: 0, last: from.clone(), aim, damage: o.damage ?? E.damage, blast: o.blast ?? E.blast, top: !!o.top, equip: !!o.equip, split: !!o.split, splitDive: !!o.splitDive, fast: !!o.warhead, apex: from.y + 6 + Math.random() * 2.5 });
    if (o.warhead) return; // (split off in flight: no launch blast)
    // the launch: a hard white flash, a back-blast of smoke, a kick
    combat.glow.flash(from, 0xffffff, 0.3, 1.8, 0.1);
    combat.glow.flash(from, 0xffb347, 0.5, 2.6, 0.22);
    combat.glow.light(from, 0xffc070, 70, 0.2);
    combat.glow.spike(from, dir.clone().negate(), 0xffe6b0, 2.2, 0.35, 0.12);
    for (let i = 0; i < 8; i++) combat.puffs.spawn(from, new THREE.Vector3((Math.random() - 0.5) * 4, 0.6 + Math.random(), (Math.random() - 0.5) * 4), { color: 0xd8d6cc, s0: 0.2, s1: 0.8, life: 0.9, drag: 3, lift: 0.4, fadeAt: 0.3 });
    combat.shake = Math.max(combat.shake, 0.3);
  }
  function missileFrame(dt) {
    const E = EQUIPMENT.atgm;
    // locking on, then firing them off one by one
    // (the salvo, run.sal, and the guided missiles, run.msl, each go on
    // regardless of the other)
    const sv = run.sal;
    if (sv) {
      // the salvo: all eight at once
      sv.t -= dt;
      if (sv.t <= 0) {
        sv.targets.forEach((g, i) => launchMissile(g.e?.alive ? g.e : null, i, { point: g.point || (g.e ? mslAim(g.e) : null), damage: sv.damage, blast: sv.blast, top: true, splitDive: !!stats.mirv }));
        combat.shake = Math.max(combat.shake, 0.6);
        run.sal = null;
      }
    }
    const st = run.msl;
    if (st) {
      st.t -= dt;
      if (st.t <= 0) {
        st.gap -= dt;
        if (st.gap <= 0 && st.fired < st.targets.length) {
          const e = st.targets[st.fired];
          launchMissile(e.alive ? e : st.targets.find((x) => x.alive) || e, st.fired, { damage: st.damage, blast: st.blast, equip: true });
          st.fired++;
          st.gap = E.salvoGap;
        }
        if (st.fired >= st.targets.length) run.msl = null;
      }
    }
    if (launcher) {
      if (run.msl) run.mslUp = 1.2; // up while locking and firing, a beat after
      run.mslUp = Math.max(0, (run.mslUp || 0) - (run.msl ? 0 : dt));
      launcher.raise(run.mslUp > 0 ? 1 : 0, dt);
    }
    for (let i = missiles.length - 1; i >= 0; i--) {
      const ms = missiles[i];
      ms.t += dt;
      // where it's going: the machine (or, if that's gone, where it was)
      if (ms.e?.alive) ms.aim = mslAim(ms.e);
      const to = ms.aim.clone().sub(ms.m.position);
      const d = to.length();
      const speed = ms.fast ? Math.min(E.speed * 1.6, 26 + ms.t * 90) : Math.min(E.speed, 9 + ms.t * 70);
      // MIRV: a beat out of the tube, it splits into three
      if (ms.split && ms.t > 0.05) {
        ms.m.removeFromParent();
        missiles.splice(i, 1);
        splitWarheads(ms);
        continue;
      }
      if (ms.top && !ms.dived) {
        // climbing; at the top a sharp turn and straight down at it
        ms.vel.y += dt * 20;
        if (ms.splitDive && (ms.m.position.y >= ms.apex || ms.t > 0.7)) {
          // MIRV on the salvo: at the top each splits into three, diving
          // together onto its mark, a little spread
          ms.m.removeFromParent();
          missiles.splice(i, 1);
          splitDiving(ms);
          continue;
        }
        if (ms.m.position.y >= ms.apex || ms.t > 0.7) {
          ms.dived = true;
          ms.vel.copy(to).normalize().multiplyScalar(E.speed * 1.3);
          combat.glow.flash(ms.m.position, 0xffffff, 0.2, 1.2, 0.08);
        }
      } else if (ms.top) ms.vel.lerp(to.normalize().multiplyScalar(E.speed * 1.3), Math.min(1, dt * 25));
      // up and out of the launch, then a hard turn straight at it
      else ms.vel.lerp(to.normalize().multiplyScalar(speed), Math.min(1, dt * (ms.t < 0.2 ? 2.5 : 12)));
      ms.m.position.addScaledVector(ms.vel, dt);
      ms.m.lookAt(ms.m.position.clone().add(ms.vel));
      const f = 0.8 + Math.random() * 0.4;
      ms.glow.scale.setScalar(f);
      ms.plume.scale.set(1, 1, 0.7 + Math.random() * 0.6);
      combat.glow.tracer(ms.last, ms.m.position, 0xffc070, ms.fast ? 0.1 : 0.22, ms.fast ? 0.1 : 0.18);
      combat.glow.tracer(ms.last, ms.m.position, 0xffffff, ms.fast ? 0.04 : 0.08, 0.08);
      if (!ms.fast || Math.random() < 0.12) combat.puffs.spawn(ms.m.position.clone(), new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.2, (Math.random() - 0.5) * 0.4), { color: 0xd0cabe, s0: 0.16, s1: 0.6, life: 0.8, drag: 2, lift: 0.2, fadeAt: 0.2 });
      ms.last = ms.m.position.clone();
      const ground = level.heightAt ? level.heightAt(ms.m.position.x, ms.m.position.z) : 0;
      if (d < 0.9 || ms.t > 4 || (ms.t > 0.3 && ms.m.position.y < ground + 0.15)) {
        ms.m.removeFromParent();
        missiles.splice(i, 1);
        const at = ms.m.position.clone();
        const g = new THREE.Vector3(at.x, ground + 0.06, at.z);
        // the hit: a white flash, a fireball, a ring out to the blast's edge, sparks
        combat.explode(at);
        combat.glow.flash(at, 0xffffff, 0.6, 3.2, 0.12);
        combat.glow.flash(at, 0xff8a3a, 1.0, 4.2, 0.3);
        combat.glow.ring(g, 0xffd59a, 0.4, ms.blast * 1.1, 0.35);
        combat.glow.light(at, 0xffa060, 120, 0.35);
        combat.fx.burst(at.clone().setY(at.y + 0.4), { count: 34, speed: 10, color: 0xffd36b, life: 0.5, size: 0.09, gravity: 14 });
        for (let k = 0; k < 7; k++) combat.puffs.spawn(at, new THREE.Vector3((Math.random() - 0.5) * 5, 2 + Math.random() * 2, (Math.random() - 0.5) * 5), { color: 0x6f6a62, s0: 0.4, s1: 1.5, life: 1.4, drag: 2.5, lift: 0.6, fadeAt: 0.3 });
        combat.shake = Math.max(combat.shake, 0.45);
        // a missile right onto its machine: the Rangefinder's extra on it
        if (d < 0.9 && ms.e?.alive && stats.directHit > 1) enemies.damage(ms.e, ms.damage * (stats.directHit - 1), at);
        onImpact(at, null, false, { radius: ms.blast, damage: ms.damage });
      }
    }
    // the lock boxes: over every machine a missile is on its way to (or
    // about to be)
    const live = run.msl;
    const locks = [];
    if (run.sal) {
      for (const g of run.sal.targets) {
        if (g.e) g.e.alive && locks.push({ pos: g.e.pos.clone().setY(mslAim(g.e).y + 0.3), label: 'MSL LOCK', locked: true });
        else locks.push({ pos: g.point.clone(), label: '', locked: true });
      }
    }
    {
      const locked = new Set([...(live ? live.targets.slice(live.fired) : []), ...missiles.filter((ms) => !ms.top).map((ms) => ms.e)].filter((e) => e?.alive));
      for (const e of locked) locks.push({ pos: e.pos.clone().setY(mslAim(e).y + 0.3), label: 'MSL LOCK', locked: !!(st && st.t > 0) });
    }
    for (const ms of missiles) if (ms.top) locks.push(ms.e?.alive ? { pos: ms.e.pos.clone().setY(mslAim(ms.e).y + 0.3), label: 'MSL LOCK', locked: false } : { pos: ms.aim.clone(), label: '', locked: false });
    // Hunter-killer's locks: each stamped on as it marks them, red once it fires
    if (run.hunt) for (const e of run.hunt.targets.slice(0, run.hunt.marked)) if (e.alive) locks.push({ pos: e.pos.clone().setY(mslAim(e).y + 0.3), label: 'LOCK', locked: run.hunt.phase === 'fire' });
    hud.setLocks(locks);
    // a beep for each new lock (Hunter-killer's marks one by one, a missile's)
    const nLocks = locks.reduce((n, l) => n + (l.label ? 1 : 0), 0);
    if (nLocks > (run.lockN || 0)) sfx.play('lock', { gain: 0.45 });
    run.lockN = nLocks;
  }
  // the ground's height and tilt at a spot (markers lie along a ramp's slope)
  const UP = new THREE.Vector3(0, 1, 0);
  const spinQ = new THREE.Quaternion();
  const tiltQ = new THREE.Quaternion();
  const groundAt = (x, z) => (level.heightAt ? level.heightAt(x, z) : 0);
  function groundTilt(x, z) {
    const d = 0.8;
    const n = new THREE.Vector3(-(groundAt(x + d, z) - groundAt(x - d, z)) / (2 * d), 1, -(groundAt(x, z + d) - groundAt(x, z - d)) / (2 * d)).normalize();
    return tiltQ.setFromUnitVectors(UP, n);
  }
  function callStrike(at) {
    const E = EQUIPMENT.artillery;
    run.arty = 0;
    run.equipCd = E.cooldown * stats.cooldownMul;
    for (let i = 0; i < E.shells; i++) {
      // the first dead centre, the rest scattered round it
      const a = Math.random() * Math.PI * 2;
      const r = i ? E.radius * (0.35 + Math.random() * 0.65) : 0;
      const p = new THREE.Vector3(at.x + Math.cos(a) * r, 0, at.z + Math.sin(a) * r);
      p.y = level.heightAt ? level.heightAt(p.x, p.z) : 0;
      // its impact circle on the ground, closing in as it comes
      const marker = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 24), new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
      marker.quaternion.copy(groundTilt(p.x, p.z)).multiply(spinQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)); // (on a slope, along it)
      marker.position.set(p.x, groundAt(p.x, p.z) + 0.08, p.z);
      scene.add(marker);
      // each comes in from high up behind, on its own line
      const from = p.clone().add(new THREE.Vector3(-9 - Math.random() * 4, 22 + Math.random() * 4, 4 + (Math.random() - 0.5) * 6));
      strikes.push({ at: p, from, t: E.delay + i * 0.22 + Math.random() * 0.1, total: E.delay + i * 0.22, marker, shell: null, last: null });
    }
    hud.damage(at.clone().setY(2), 0, 'chain', 'Incoming!');
  }
  const SHELL_FLIGHT = 0.55; // seconds a shell is seen flying in
  function strikeFrame(dt, t) {
    const E = EQUIPMENT.artillery;
    for (let i = strikes.length - 1; i >= 0; i--) {
      const s = strikes[i];
      s.t -= dt;
      const k = Math.max(0, s.t / s.total);
      const r = E.blast * (0.4 + 0.9 * k);
      s.marker.scale.setScalar(r);
      s.marker.material.opacity = 0.5 + 0.5 * (Math.sin(t * (14 + (1 - k) * 30)) > 0 ? 1 : 0.3);
      // the shell itself: it flies the last stretch you can see, a bright
      // head on a smoke trail, dipping as it comes
      if (s.t < SHELL_FLIGHT) {
        if (!s.shell) {
          s.shell = new THREE.Group();
          s.shell.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.7), new THREE.MeshBasicMaterial({ color: 0xfff0c8 })));
          const glow = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.55, depthWrite: false }));
          s.shell.add(glow);
          scene.add(s.shell);
        }
        const k = 1 - Math.max(0, s.t) / SHELL_FLIGHT;
        const p = s.from.clone().lerp(s.at, k);
        p.y += Math.sin(k * Math.PI) * 2.5; // a little arc
        if (s.last) {
          s.shell.lookAt(s.shell.position.clone().add(p.clone().sub(s.last)));
          // the trail: smoke puffs and a hot streak behind it
          combat.glow.tracer(s.last, p, 0xffd9a0, 0.18, 0.12);
          combat.puffs.spawn(p, new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.3, (Math.random() - 0.5) * 0.4), { color: 0xb8b2a6, s0: 0.18, s1: 0.6, life: 0.9, drag: 2, lift: 0.3, fadeAt: 0.2 });
        }
        s.shell.position.copy(p);
        s.last = p;
      }
      if (s.t <= 0) {
        s.marker.removeFromParent();
        s.marker.geometry.dispose();
        s.shell?.removeFromParent();
        strikes.splice(i, 1);
        const at = s.at.clone().setY(s.at.y + 0.2);
        combat.explode(at);
        combat.fx.burst(at.clone().setY(at.y + 0.6), { count: 26, speed: 9, color: 0xffd36b, life: 0.5, size: 0.09, gravity: 14 });
        for (let k = 0; k < 6; k++) combat.puffs.spawn(at, new THREE.Vector3((Math.random() - 0.5) * 5, 2 + Math.random() * 2, (Math.random() - 0.5) * 5), { color: 0x6f6a62, s0: 0.4, s1: 1.4, life: 1.4, drag: 2.5, lift: 0.6, fadeAt: 0.3 });
        combat.shake = Math.max(combat.shake, 0.5);
        onImpact(at, null, false, { radius: E.blast, damage: E.damage });
      }
    }
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
    // each cone fades out toward its wide, trailing rim (an alpha ramp down
    // its length), so the wedge has soft edges instead of a hard lip
    const ramp = (() => {
      const c = document.createElement('canvas');
      c.width = 2;
      c.height = 32;
      const g2 = c.getContext('2d');
      const grad = g2.createLinearGradient(0, 32, 0, 0);
      grad.addColorStop(0, '#000');
      grad.addColorStop(0.55, '#fff');
      grad.addColorStop(1, '#fff');
      g2.fillStyle = grad;
      g2.fillRect(0, 0, 2, 32);
      return new THREE.CanvasTexture(c);
    })();
    const cone = (r, h, opacity) => {
      const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 18, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity, alphaMap: ramp, depthWrite: false, side: THREE.DoubleSide }));
      m.rotation.z = -Math.PI / 2; // apex forward (+x)
      m.position.x = -h / 2;
      m.userData.base = opacity;
      g.add(m);
      return m;
    };
    const cones = [cone(1.6, 2.6, 0.08), cone(1.3, 2.4, 0.14), cone(0.95, 2.1, 0.22), cone(0.55, 1.8, 0.32), cone(0.28, 1.5, 0.48)];
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
    bowShock.position.set(TANK_BOX.cx + TANK_BOX.hx + 1.4, 0.8, 0); // well out ahead of the nose
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
    // level 1's boss, only the Piercing shot can finish it: the shot always
    // goes at it, wherever it was aimed (a miss would leave it stuck at half
    // till the ability came round again)
    const fin = enemies.alive.find((e) => e.pierceKill);
    if (fin) {
      tank.turret.rotation.y = Math.atan2(-(fin.pos.z - pos.z), fin.pos.x - pos.x) - tank.group.rotation.y;
      tank.group.updateWorldMatrix(true, true);
    }
    tank.fire(); // the recoil
    sfx.play('cannon', { gain: 1, rate: 0.82 }); // (deeper: the big one)
    const { from, dir, len, wall } = pierceLine();
    // (and it dies, full stop: not left to the beam's hit test)
    if (fin) {
      const dmg = Math.ceil(fin.hp) + 1;
      enemies.damage(fin, dmg, from.clone());
      hud.damage(new THREE.Vector3(fin.pos.x, 1.4 * fin.stats.scale, fin.pos.z), dmg, 'big');
    }
    const hit = new Set();
    const broke = new Set();
    // the launch: a huge flash, blades of light, a ring of smoke at the muzzle
    combat.glow.flash(from, 0xffffff, 0.8, 4.0, 0.16);
    combat.glow.flash(from, 0xffb347, 1.2, 5.5, 0.32);
    combat.glow.spike(from, dir, 0xfff6d6, 7, 1.0, 0.18);
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    for (const s2 of [-1, 1]) combat.glow.spike(from, dir.clone().addScaledVector(side, s2 * 0.8).normalize(), 0xffc24a, 1.6, 0.25, 0.1);
    combat.glow.light(from, 0xffc070, 90, 0.25);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r = side.clone().multiplyScalar(Math.cos(a)).add(new THREE.Vector3(0, Math.sin(a), 0));
      combat.puffs.spawn(from.clone().addScaledVector(r, 0.2), r.multiplyScalar(3.5).addScaledVector(dir, 1.5), { color: 0xd8d6cc, s0: 0.15, s1: 0.4, life: 0.5, drag: 4, lift: 0.6, fadeAt: 0.3 });
    }
    combat.shake = Math.max(combat.shake, 0.8);
    run.hitstop = Math.max(run.hitstop, 0.08);
    run.dilate = Math.max(run.dilate || 0, 0.7); // the shot goes in slow motion
    for (let i = 0; i < 30; i++) combat.fx.spawn(from, dir.clone().multiplyScalar(4 + Math.random() * 8).add(new THREE.Vector3((Math.random() - 0.5) * 7, Math.random() * 5, (Math.random() - 0.5) * 7)), { color: i % 3 ? 0xffd36b : 0xffffff, life: 0.4 + Math.random() * 0.4, size: i < 6 ? 0.15 : 0.08, gravity: 9, glow: true });
    combat.pierceShot(from, dir, len, {
      // as the round passes along the line from a0 to a1
      onPass(a0, a1) {
        for (const e of [...enemies.alive]) {
          if (hit.has(e)) continue;
          const rx = e.pos.x - from.x;
          const rz = e.pos.z - from.z;
          const along = rx * dir.x + rz * dir.z;
          // (its real footprint: the mech is far wider than its scale says)
          const size = e.stats.box ? Math.max(e.stats.box.hx, e.stats.box.hz) * 0.8 : 0;
          if (along < a0 - 0.6 - size || along > a1 + 0.6 + size) continue;
          if (Math.abs(rx * dir.z - rz * dir.x) > Math.max(PIERCE_HALF * e.stats.scale + 0.3, PIERCE_HALF + size)) continue;
          hit.add(e);
          const dmg = stats.pierceDamage;
          const killed = enemies.damage(e, dmg, from.clone());
          const p = new THREE.Vector3(e.pos.x, 1.4 * e.stats.scale, e.pos.z);
          hud.damage(p, dmg, 'big');
          if (killed) hud.damage(p.clone().setY(p.y + 0.7), 0, 'kill');
          combat.sparkBlast(p);
          combat.shake = Math.max(combat.shake, 0.5);
          run.hitstop = Math.max(run.hitstop, 0.05);
          run.dilate = Math.max(run.dilate || 0, 0.6); // and time drags for a moment
        }
        for (const c of level.crushables || []) {
          if (c.done || c.armored || c.ramOnly || broke.has(c)) continue;
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
  // Legendary Optics (Spotter): a reload done, the view opens right out for a moment
  function ranging() {
    run.relock = true; // (touch aim assist: a fresh lock after every reload)
    if (!stats.rangeBurst || run.over || run.mode !== 'field') return;
    run.rangeT = 3;
    pulse('optics');
  }
  function autoFire(dt) {
    if (!stats.mag) return;
    if (def.gun === 'missile') {
      // the missile tank's pack reloads a missile at a time once it runs dry
      // or R is pressed (so a partial reload takes only as long as the
      // missing missiles); whatever's loaded can still fire mid-reload
      const per = stats.magReload / stats.mag;
      if (run.mag < 1) run.mReload = true;
      if (run.mReload && run.mag < stats.mag) {
        run.trickleT = (run.trickleT || 0) + dt;
        if (run.trickleT >= per) {
          run.trickleT -= per;
          run.mag++;
        }
      } else {
        if (run.mReload) ranging(); // (the pack's full again)
        run.trickleT = 0;
        run.mReload = false;
      }
      if (!trigger || run.over || run.mode !== 'field' || run.locked || !run.gun || reload < 1 || run.mag < 1) return;
      if (hasAim && tank.aimError() > 0.12) return;
      reload = 0;
      run.shots++;
      letGoFrame();
      fireMissileGun();
      run.mag--;
      return;
    }
    if (run.magT > 0) {
      run.magT -= dt;
      if (run.magT <= 0) {
        run.mag = stats.mag;
        ranging();
      }
      return;
    }
    if (!trigger || run.over || run.mode !== 'field' || run.locked || !run.gun || reload < 1) return;
    if (hasAim && tank.aimError() > 0.12) return;
    reload = 0;
    run.shots++;
    letGoFrame();
    if (def.gun === 'missile') fireMissileGun();
    else if (combat.fireCannon(tank, hasAim ? aimPoint : null, [...colliders, ...enemies.hitMeshes()]) !== false) gunSound();
    if (--run.mag <= 0) run.magT = stats.magReload;
  }
  function reloadMag() {
    if (def.gun === 'missile') {
      if (run.mag < stats.mag) run.mReload = true;
      return;
    }
    if (stats.mag && run.magT <= 0 && run.mag < stats.mag) run.magT = stats.magReload;
  }
  const holdFire = () => def.gun === 'autocannon' || def.gun === 'missile';
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
    if (def.gun === 'missile') fireMissileGun();
    else if (combat.fireCannon(tank, hasAim ? aimPoint : null, [...colliders, ...enemies.hitMeshes()]) !== false) gunSound();
  }
  // the missile tank's gun: a missile out of the pack, homing on the machine
  // under the aim (or flying to the spot aimed at)
  function fireMissileGun() {
    const e = hovered?.alive && !(hovered.delay > 0) ? hovered : null;
    const point = hasAim ? aimPoint.clone() : pos.clone().add(new THREE.Vector3(Math.cos(tank.group.rotation.y + tank.turret.rotation.y) * 12, 0.5, -Math.sin(tank.group.rotation.y + tank.turret.rotation.y) * 12));
    launchMissile(e, 0, { point, damage: stats.cannonDamage, blast: stats.splash, split: !!stats.mirv });
  }
  // Esc: pause (and resume)
  function setPaused(on) {
    if (on && (run.over || run.fading)) return;
    run.paused = on;
    keys.clear();
    // the cursor back on the game view before the menu appears over it: a
    // browser only rechecks the cursor under a still mouse when the element
    // it's on changes its own, so this way it shows without a nudge
    setCursor();
    hud.showPause(
      on
        ? {
            resume: () => setPaused(false),
            settings: () => openSettings(),
            restart: () => {
              setPaused(false);
              loadLevel(levelDef.id);
            },
            lost: [], // (parts found are saved the moment they're found: quitting loses none)
            endless: !!levelDef.endless,
            exit: onExit
              ? () => {
                  setPaused(false);
                  // Endless: leaving ends the run, and it pays out
                  if (levelDef.endless) return void endlessEnd('Run ended');
                  onExit();
                }
              : null,
          }
        : null,
    );
    setCursor();
  }
  // keys: whatever Settings has them bound to (the arrows always drive too)
  const onKeyDown = (e) => {
    if (e.code === 'Escape') {
      const devMenu = document.querySelector('.dk-menu');
      if (!devMenu || devMenu.hidden) setPaused(!run.paused); // (Esc closes the dev kit first)
      return;
    }
    // (P by default: in fullscreen, Esc only gets you out of fullscreen)
    if (actionFor(e.code) === 'pause') {
      if (!e.repeat) setPaused(!run.paused);
      return;
    }
    if (run.paused) return;
    const act = actionFor(e.code);
    if (act === 'fire') {
      e.preventDefault();
      if (run.arty > 0) return void useEquipment();
      if (run.aiming > 0) firePierce();
      else if (holdFire()) trigger = true;
      else fire();
      return;
    }
    if (act === 'boost') {
      if (!e.repeat) boost();
      return;
    }
    if (act === 'ability') {
      if (!e.repeat) ability();
      return;
    }
    if (act === 'equip') {
      if (!e.repeat) equipment();
      return;
    }
    if (act === 'reload') {
      reloadMag();
      return;
    }
    keys.add(act ? `act:${act}` : e.code);
  };
  const onKeyUp = (e) => {
    const act = actionFor(e.code);
    keys.delete(act ? `act:${act}` : e.code);
    if (act === 'fire') trigger = false;
  };
  // where a ray first dips under the level's surface (heightAt), short of
  // maxD; only when that surface is raised there (else the ground meshes
  // already answer it)
  const marchP = new THREE.Vector3();
  function surfaceHit(ray, maxD) {
    let prev = 0;
    for (let d = 1; d < maxD; d += 0.6) {
      ray.at(d, marchP);
      if (marchP.y > level.heightAt(marchP.x, marchP.z)) {
        prev = d;
        continue;
      }
      // narrow it down between the last point above and this one below
      let lo = prev;
      let hi = d;
      for (let i = 0; i < 8; i++) {
        const mid = (lo + hi) / 2;
        ray.at(mid, marchP);
        if (marchP.y > level.heightAt(marchP.x, marchP.z)) lo = mid;
        else hi = mid;
      }
      ray.at(hi, marchP);
      const h = level.heightAt(marchP.x, marchP.z);
      return h > 0.3 ? marchP.clone().setY(h) : null;
    }
    return null;
  }
  function aimAt(x, y) {
    const r = canvas.getBoundingClientRect();
    pointer = [((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1];
    client = [x, y];
  }

  // Touch: a stick on the left drives; a FIRE button in the bottom right
  // fires (it aims for you: the nearest machine in view); touching anywhere
  // else aims there instead (drag to adjust) without firing, and the aim
  // holds there a moment after you let go.
  const STICK_R = 56; // how far the knob travels
  const STICK_GRAB = 96; // touches this close to the stick grab it; anything else fires
  const stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
  let fireOnAim = false;
  let strikeOnAim = false;
  hud.onPause(() => setPaused(!run.paused));
  onSettings((k) => (k === 'hand' || k === 'buttons') && hud.placeStick());
  function setTouch(on) {
    if (touch === on) return;
    touch = on;
    hud.setTouch(on);
  }

  let fireTouch = null; // the finger on FIRE
  let manualAim = false; // touch: aimed by hand (held till the next reload)
  let aimTaps = 0;
  let autoTarget = null;
  let forcedAim = null;
  const onMove = (e) => {
    if (e.pointerType === 'touch') {
      if (e.pointerId === fireTouch) return;
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
      } else if (e.pointerId === dragTouch) {
        dragPos = [e.clientX, e.clientY];
        dragAim();
      } else aimAt(e.clientX, e.clientY);
      return;
    }
    aimAt(e.clientX, e.clientY);
  };
  const onDown = (e) => {
    if (e.pointerType === 'touch') {
      setTouch(true);
      const c = hud.stickCenter();
      const f = hud.fireCenter();
      const bs = { small: 0.82, normal: 1, large: 1.18 }[settings().buttons] || 1;
      if (run.gun && fireTouch === null && Math.hypot(e.clientX - f.x, e.clientY - f.y) < 58 * bs) // (a little past the button's edge) {
        fireTouch = e.pointerId;
        if (run.arty > 0) return; // (calling in a strike: the spot's tapped on the ground)
        if (run.aiming > 0) firePierce();
        else if (holdFire()) trigger = true;
        else fire();
        return;
      }
      const a = hud.abilityCenter();
      if (run.rockets && Math.hypot(e.clientX - a.x, e.clientY - a.y) < 40 * bs) {
        boost();
        return;
      }
      const a3 = hud.ability3Center();
      if (equipId() && Math.hypot(e.clientX - a3.x, e.clientY - a3.y) < 40 * bs) {
        equipment();
        return;
      }
      const a2 = hud.ability2Center();
      if (run.ability && def.ability && Math.hypot(e.clientX - a2.x, e.clientY - a2.y) < 40 * bs) {
        ability();
        return;
      }
      if (stick.id === null && Math.hypot(e.clientX - c.x, e.clientY - c.y) < STICK_GRAB) {
        Object.assign(stick, { id: e.pointerId, ox: c.x, oy: c.y, x: 0, y: 0 });
        onMove(e); // the knob jumps straight to the thumb
      } else {
        aimAt(e.clientX, e.clientY);
        if (run.arty > 0) strikeOnAim = true; // the spot tapped, once the aim ray's found it
        else if (run.aiming > 0) pierceTouch = e.pointerId; // drag to aim, let go to fire
        else if (settings().dragShoot && run.gun) {
          // drag to shoot: the aim follows the finger (snapping onto a
          // machine right under it); autocannons fire while it's down,
          // the rest fire as it lets go
          dragTouch = e.pointerId;
          dragPos = [e.clientX, e.clientY];
          autoTarget = null;
          manualAim = true;
          dragAim();
          if (holdFire()) trigger = true;
        } else if (!latch(e.clientX, e.clientY)) {
          aimTouch = e.pointerId; // just aiming at the spot (FIRE fires); drag to adjust
          manualAim = true;
          if (!settings().aimAssist) aimTaps++;
        } else aimTaps++;
      }
      return;
    }
    setTouch(false);
    if (e.button === 2 && run.arty > 0) return void (run.arty = 0); // right click: call it off
    if (e.button !== 0) return;
    if (run.arty > 0) return void useEquipment();
    if (run.aiming > 0) firePierce();
    else if (holdFire()) trigger = true;
    else fire();
  };
  let aimTouch = null;
  let pierceTouch = null;
  let dragTouch = null;
  let dragPos = null;
  const onWinUp = (e) => {
    if (e.pointerType !== 'touch' && e.button === 0) trigger = false;
  };
  const onContext = (e) => e.preventDefault();
  const onUp = (e) => {
    if (e.pointerType === 'mouse' && e.button === 0) trigger = false;
    if (e.pointerId === pierceTouch) firePierce();
    if (e.pointerId === aimTouch) aimTouch = null;
    if (e.pointerId === dragTouch) {
      dragTouch = null;
      if (holdFire()) trigger = false;
      else fire();
    }
    if (e.pointerId === fireTouch) {
      trigger = false;
      fireTouch = null;
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

  // Touch aiming: a tap near an enemy latches onto it (the one nearest the
  // tap, within about 35 degrees either side of the line from the tank to
  // the tap, and not too far from the tap on screen); the turret then
  // tracks it till it's gone or you tap somewhere else. A tap with nothing
  // near it aims at that spot. Manual aim (Settings): no latching.
  const LATCH_ARC = 0.61; // radians either side
  const toScreen = (v) => {
    const p = v.clone().project(camera);
    const r = canvas.getBoundingClientRect();
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
  };
  function latch(cx, cy) {
    if (!settings().aimAssist || run.mode !== 'field') return false;
    const tankS = toScreen(pos.clone().setY(pos.y + 1));
    const tapA = Math.atan2(cy - tankS.y, cx - tankS.x);
    const maxPx = Math.max(window.innerWidth, window.innerHeight) * 0.16;
    let best = null;
    let bestD = Infinity;
    const myY = level.heightAt ? level.heightAt(pos.x, pos.z) : 0;
    for (const e of enemies.alive) {
      if (e.delay > 0) continue;
      // (never one on another level with a floor between: up on the deck
      // from the street, or down under its edge)
      if (!e.los && !e.stats.flying && level.heightAt && Math.abs(level.heightAt(e.pos.x, e.pos.z) - myY) > 1.2) continue;
      const es = toScreen(enemies.aimPoint(e));
      const d = Math.hypot(es.x - cx, es.y - cy);
      let da = Math.atan2(es.y - tankS.y, es.x - tankS.x) - tapA;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) > LATCH_ARC || d > maxPx) continue;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    autoTarget = best;
    if (!best) return false;
    manualAim = false;
    aimTouch = null;
    hud.swapPulse?.();
    return true;
  }
  // drag to shoot: aim at the finger, or at a machine close under it
  function dragAim() {
    const [cx, cy] = dragPos;
    const maxPx = Math.max(window.innerWidth, window.innerHeight) * 0.07;
    let best = null;
    let bestD = maxPx;
    for (const e of enemies.alive) {
      if (e.delay > 0) continue;
      const es = toScreen(enemies.aimPoint(e));
      const d = Math.hypot(es.x - cx, es.y - cy);
      if (d < bestD) {
        bestD = d;
        best = es;
      }
    }
    aimAt(best ? best.x : cx, best ? best.y : cy);
  }
  function touchAim() {
    if (dragTouch !== null) return void dragAim(); // (the machine under it moves)
    if (pierceTouch !== null || run.arty > 0 || run.mode !== 'field') return;
    if (aimTouch !== null || manualAim) return;
    if (!autoTarget?.alive) {
      // the latched one's gone: hold the aim where it was till the next tap
      if (autoTarget) {
        autoTarget = null;
        manualAim = true;
      }
      return;
    }
    const s2 = toScreen(enemies.aimPoint(autoTarget));
    aimAt(s2.x, s2.y);
  }
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
      st.repairTo = run.hard || st.noRepair ? run.hp : Math.min(stats.maxHp, run.hp + stats.maxHp * REPAIR_SHARE);
      st.repaired = st.repairTo - run.hp;
      if (run.hard) hud.prompt('Repairs', 'No repairs in hard mode.', { danger: true, seconds: 3 });
    }
    if (st.repairTo != null && run.hp < st.repairTo) {
      run.hp = Math.min(st.repairTo, run.hp + dt * 80);
      hud.setHull(run.hp, stats.maxHp);
      if (Math.random() < dt * 30) combat.fx.spawn(new THREE.Vector3(pos.x + (Math.random() - 0.5) * 3.5, 0.1, pos.z + (Math.random() - 0.5) * 2), new THREE.Vector3((Math.random() - 0.5) * 2, 3 + Math.random() * 3, (Math.random() - 0.5) * 2), { color: 0xffd36b, life: 0.4, size: 0.06, gravity: 12, glow: true });
      if (run.hp >= st.repairTo - 0.01 && st.repaired > 0.5) {
        hud.heal(st.repaired);
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
        const d = st.shack.exitDir || { x: 1, z: 0 };
        api.teleport(st.shack.outside.x - d.x * 2.5, st.shack.outside.z - d.z * 2.5, st.shack.exitYaw ?? 0);
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
    // the first pick ever: spotlit, and then the Equip button's taught too
    if (st.teach == null) {
      st.teach = !save.tips().includes('pick');
      if (st.teach) save.seeTip('pick');
    }
    hud.showPicker(
      st.offers.map((id) =>
        save.owned().includes(id)
          ? { id, ...PARTS[id], name: `${PARTS[id].name} improvement`, text: `Your ${PARTS[id].name} gains levels, and a star.`, improve: true, lines: improvementHtml(id, tankId) }
          : { id, ...PARTS[id], lines: effectsHtml(id, tankId) },
      ),
      (id) => pick(id),
      null, // no skip: a part is always worth taking (it goes to storage)
      // hovering a card swings the camera over to that part's pallet
      (id) => {
        const pad = id && st.room.pads.find((p) => p.offer === id);
        st.focus = pad ? new THREE.Vector3(pad.x, 0, pad.z) : null;
        st.room.hover(id); // only its pallet lit
      },
      st.teach,
    );
  }
  // A card picked: the part goes into storage, and the fitting screen opens
  // with it ready to equip.
  function pick(id) {
    const st = run.depot;
    if (!st || st.step !== 'pick') return;
    st.focus = null;
    hud.showPicker(null);
    let improved = false;
    if (save.owned().includes(id)) {
      // an improvement: free levels and a star
      const from = levelOf(id);
      const to = improveTo(id);
      if (to) save.setPartLevel(id, to);
      save.addStar(id);
      if (run.parts.includes(id)) fitParts(run.parts);
      improved = true;
      // on its pallet: a burst of light and the levels popping up
      const pad = st.room.pads.find((p) => p.offer === id);
      if (pad) {
        const at = new THREE.Vector3(pad.x, 1.2, pad.z);
        combat.glow.flash(at, 0xffffff, 0.4, 2.4, 0.15);
        combat.glow.flash(at, 0x6be08a, 0.6, 3.2, 0.4);
        combat.glow.ring(new THREE.Vector3(pad.x, 0.08, pad.z), 0x6be08a, 0.3, 2.6, 0.5);
        combat.fx.burst(at, { count: 30, speed: 6, color: 0xa8f5b8, life: 0.6, size: 0.08, gravity: 6 });
        hud.damage(at.clone().setY(2.4), 0, 'heal', `▲ +${(to || from) - from} Lv ★`); // (green: gold is for Legendary)
      }
    } else save.own(id);
    if (!run.found.includes(id)) run.found.push(id);
    save.addLevelFind(levelDef.id, id);
    st.found = id;
    st.improved = improved ? id : null;
    st.room.choose(id); // the other pallets fade away
    // (an improvement: a beat to see it land before the editor comes up)
    if (improved) setTimeout(() => run.depot === st && openFit(), 900);
    else openFit();
  }
  // The checkpoint's fitting screen. Equipping the part found here brings
  // the crane over with it; anything else goes on (or comes off) at once.
  function openFit() {
    const st = run.depot;
    if (!st) return;
    st.step = 'edit';
    fitting.show({
      tag: levelDef.endless ? 'Base' : 'Checkpoint',
      tankId,
      loadout: run.parts,
      owned: save.owned(),
      highlight: st.found,
      teachEquip: st.teach && !st.improved && !run.parts.includes(st.found),
      teachContinue: st.teach && (st.improved || run.parts.includes(st.found)),
      improved: st.improved, // its icon glows and the new star flies on (the first time only)
      // (Endless: the base between waves can end the run too)
      buttons: [...(levelDef.endless ? [['End run', () => endlessEnd('Run ended')]] : []), ['Continue', () => leaveDepot(), true, true]],
      onSet(list, added) {
        const crane = added && !run.parts.includes(added) && st.room.pads.some((p) => p.offer === added);
        if (!crane) {
          applyLoadout(list, added);
          return openFit();
        }
        fitting.hide();
        st.step = 'fit';
        st.room.install(added, () => new THREE.Vector3(pos.x, 0, pos.z), {
          onFit: () => (sfx.play('clank', { gain: 0.8 }), applyLoadout(list, added)), // (set down on the tank)
          onDone: () => openFit(),
        });
      },
    });
    st.improved = null;
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
    const hp0 = run.hp;
    run.hp = Math.min(stats.maxHp, run.hp + Math.max(0, stats.maxHp - was) + heal);
    hud.setHull(run.hp, stats.maxHp);
    if (run.hp > hp0 + 0.5) hud.heal(run.hp - hp0);
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
    if (stats.spotter) add('rangefinder', 'Ranging', { k: 1 - Math.max(0, run.spotT) / 5, left: run.spotT });
    if (stats.reactive) add('era', 'Explosion', { k: 1 - run.reactT / 8, left: run.reactT, ready: !(run.reactT > 0) });
    if (stats.hotLoader) add('autoloader', 'Ready rack');
    if (stats.boostRefund) add('afterburner', 'Afterburner');
    if (stats.dozerStun) add('dozer', 'Disorient');
    if (stats.rangeBurst) add('optics', 'Spotter', { k: run.rangeT > 0 ? run.rangeT / 3 : 1, ready: run.rangeT > 0 });
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
    const msl = id === 'missile'; // (its exhausts are at the front, firing forward)
    const target = nozzle.clone().add(new THREE.Vector3(msl ? (firing ? 0.45 : -0.15) : light ? (firing ? -0.55 : 0.3) : firing ? 0.15 : 0.45, 0.05, 0));
    const half = msl ? (firing ? 0.85 : 0.55) : light ? (firing ? 0.85 : 0.5) : firing ? 0.95 : 0.75;
    const pic = snapshotCanvas(tk.group, W, H, decorate, { target, dir: new THREE.Vector3(0.12, 0.3, 1), half, aspectFit: true });
    boostPics.set(key, pic);
    return pic;
  }
  // Retreat's icon: the forward-firing exhausts (like the boost's icon),
  // and a white arrow pointing back on the right of it
  const retreatPics = new Map();
  function retreatArt(firing) {
    if (retreatPics.has(firing)) return retreatPics.get(firing);
    const base = boostPicture(firing, 'normal'); // (the missile tank's own boost picture)
    const c = document.createElement('canvas');
    c.width = base.width;
    c.height = base.height;
    const g = c.getContext('2d');
    g.drawImage(base, 0, 0);
    const k = c.width / 32;
    // a big white arrow pointing back, outlined in black so it stands out
    // against the white of the blast
    const arrow = (dx, dy, col) => {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo((14 + dx) * k, (16 + dy) * k);
      g.lineTo((22 + dx) * k, (8 + dy) * k);
      g.lineTo((22 + dx) * k, (13 + dy) * k);
      g.lineTo((30 + dx) * k, (13 + dy) * k);
      g.lineTo((30 + dx) * k, (19 + dy) * k);
      g.lineTo((22 + dx) * k, (19 + dy) * k);
      g.lineTo((22 + dx) * k, (24 + dy) * k);
      g.closePath();
      g.fill();
    };
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1], [1, 2], [2, 2]]) arrow(ox, oy, '#000');
    arrow(0, 0, '#ffffff');
    retreatPics.set(firing, c);
    return c;
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
  // The assault tank's Hunter-killer (E): the world all but stops and its
  // fire control stamps a lock on each of up to five machines in view, one
  // after another, nearest first (the turret holding still); then, still
  // in slow motion, the gun whips from one to the next, a round into each.
  // One press: it takes the gun until it's done
  function startHunt() {
    if (run.abilityCd > 0 || run.hunt || run.over || run.mode !== 'field') return;
    const reach = 22 * stats.view; // (about what's on screen)
    const d = (e) => Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z);
    const foes = enemies.alive.filter((e) => !(e.delay > 0) && d(e) < reach).sort((a, b) => d(a) - d(b)).slice(0, stats.hunterTargets);
    if (!foes.length) return void hud.damage(pos.clone().setY(pos.y + 2.4), 0, 'chain', 'No targets!');
    run.abilityCd = stats.hunterCooldown;
    run.abilities = (run.abilities || 0) + 1;
    // always five shots: fewer machines, some get more than one
    const targets = [];
    for (let i = 0; i < stats.hunterTargets; i++) targets.push(foes[i % foes.length]);
    run.hunt = { targets, marked: 0, t: 0, phase: 'mark', fired: 0, gap: 0, aim: null };
    trigger = false;
    queued = 0;
    combat.shake = Math.max(combat.shake, 0.15);
  }
  function huntFrame(realDt, dt) {
    const h = run.hunt;
    if (run.over || run.mode !== 'field') return void (run.hunt = null);
    if (h.phase === 'mark') {
      h.t += realDt;
      while (h.marked < h.targets.length && h.t >= h.marked * HUNT_MARK + 0.12) {
        const e = h.targets[h.marked++];
        if (!e.alive) continue;
        const at = enemies.aimPoint(e);
        combat.glow.flash(at, 0xff4a3a, 0.2, 1.6, 0.18);
        combat.glow.ring(at.clone().setY(0.08), 0xff4a3a, 0.4, 1.8, 0.3);
      }
      if (h.t >= h.targets.length * HUNT_MARK + 0.35) {
        h.phase = 'fire';
        h.gap = 0.02;
        combat.shake = Math.max(combat.shake, 0.25);
      }
      return;
    }
    // just fired: the gun stays on that spot a moment (steady, not
    // flicking about), then on to the next
    if (h.shot) {
      h.gap -= realDt;
      if (h.gap <= 0) {
        h.shot = false;
        h.fired++;
        h.settle = 0;
      }
      return;
    }
    if (h.fired >= h.targets.length) return void (run.hunt = null);
    // its mark gone already: the shot goes to another of the marked still up
    if (!h.targets[h.fired].alive) {
      const other = h.targets.find((x) => x.alive);
      if (!other) return void (run.hunt = null);
      h.targets[h.fired] = other;
    }
    const e = h.targets[h.fired];
    h.aim = enemies.aimPoint(e);
    // the turret whips straight onto it, settles a beat, fires
    const want = wrapAngle(Math.atan2(-(h.aim.z - pos.z), h.aim.x - pos.x) - tank.group.rotation.y);
    tank.turret.rotation.y = approachAngle(tank.turret.rotation.y, want, realDt * 14); // (at full speed, in the slowed world)
    h.settle = Math.abs(wrapAngle(want - tank.turret.rotation.y)) < 0.04 ? (h.settle || 0) + realDt : 0;
    if (h.settle > 0.08) {
      h.shot = true;
      h.gap = HUNT_DWELL;
      huntShot(e);
    }
  }
  function huntShot(e) {
    const m = tank.fire();
    sfx.play('cannon', { gain: 0.7, rate: 1.08 });
    const from = m.position;
    const at = enemies.aimPoint(e);
    // the shot: a white-hot line straight in, the muzzle blast, the hit
    combat.glow.tracer(from, at, 0xffc070, 0.32, 0.25);
    combat.glow.tracer(from, at, 0xffffff, 0.12, 0.18);
    combat.glow.flash(from, 0xffffff, 0.3, 1.6, 0.1);
    combat.glow.flash(from, 0xffb347, 0.5, 2.2, 0.2);
    combat.glow.spike(from, m.direction, 0xfff6d6, 2.6, 0.35, 0.1);
    combat.glow.light(from, 0xffc070, 60, 0.18);
    for (let i = 0; i < 6; i++) combat.puffs.spawn(from.clone(), new THREE.Vector3((Math.random() - 0.5) * 2, 0.4 + Math.random() * 0.6, (Math.random() - 0.5) * 2).addScaledVector(m.direction, 2), { color: 0xd8d6cc, s0: 0.15, s1: 0.45, life: 0.5, drag: 4, lift: 0.5, fadeAt: 0.3 });
    const dmg = Math.round(stats.cannonDamage * stats.hunterDamage * (stats.abilityPower || 1));
    const killed = enemies.damage(e, dmg, from.clone());
    hud.damage(at.clone().setY(at.y + 0.6), dmg, 'big');
    if (killed) hud.damage(at.clone().setY(at.y + 1.3), 0, 'kill');
    combat.explode(at);
    combat.shake = Math.max(combat.shake, 0.45);
    run.hitstop = Math.max(run.hitstop, 0.05);
    // every hit patches the hull up a little
    if (run.hp < stats.maxHp) {
      const was = run.hp;
      run.hp = Math.min(stats.maxHp, run.hp + 5);
      hud.setHull(run.hp, stats.maxHp);
      hud.heal(Math.round(run.hp - was));
    }
  }
  // its icon: a reticle, and lock brackets on three marks round it
  let hunterCanvas = null;
  function hunterArt() {
    if (hunterCanvas) return hunterCanvas;
    const c = (hunterCanvas = document.createElement('canvas'));
    c.width = c.height = 26;
    const g = c.getContext('2d');
    g.fillStyle = '#1d1b1e';
    g.fillRect(0, 0, 26, 26);
    const px = (x, y, w, h, col) => ((g.fillStyle = col), g.fillRect(x, y, w, h));
    const bracket = (x, y, s, col) => {
      px(x, y, 2, 1, col);
      px(x, y, 1, 2, col);
      px(x + s - 2, y, 2, 1, col);
      px(x + s - 1, y, 1, 2, col);
      px(x, y + s - 1, 2, 1, col);
      px(x, y + s - 2, 1, 2, col);
      px(x + s - 2, y + s - 1, 2, 1, col);
      px(x + s - 1, y + s - 2, 1, 2, col);
    };
    for (const [x, y] of [[2, 3], [17, 4], [15, 17]]) {
      bracket(x, y, 7, '#ff3b2f');
      px(x + 3, y + 3, 1, 1, '#ffd0c8');
    }
    // the reticle in the middle: a ring and its ticks
    for (let a = 0; a < 16; a++) px(Math.round(12 + Math.cos((a / 16) * Math.PI * 2) * 4.5), Math.round(13 + Math.sin((a / 16) * Math.PI * 2) * 4.5), 1, 1, '#ffffff');
    px(12, 6, 1, 3, '#ffffff');
    px(12, 18, 1, 3, '#ffffff');
    px(5, 13, 3, 1, '#ffffff');
    px(17, 13, 3, 1, '#ffffff');
    px(12, 13, 1, 1, '#ffd36b');
    return c;
  }
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
    // with the grenade launcher every extra gun's a launcher too
    for (const mt of g.userData.mounts) {
      if (stats.gmg && !mt.gmg?.parent) mt.pivot.add((mt.gmg = gmgLauncher()));
      if (mt.gmg) mt.gmg.visible = !!stats.gmg;
    }
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
      if (stats.gmg) {
        mt.timer = stats.gmgRate;
        lobGrenade(pivot.localToWorld(mt.muzzle.clone()), target);
        continue;
      }
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

  // The grenade launcher's grenades: lobbed at the target with a fair bit
  // of scatter, some falling short; each a little blast where it lands:
  // full damage on what it lands on (about an MG's, over time), half out to
  // the blast's edge
  const grenades = [];
  const grenadeTrail = () => (trailPool ??= new Glow(scene, { size: 200, lights: 0 }));
  // a 40 mm round: a black warhead on a pale brass base, big enough to
  // follow by eye; a white trail behind it
  const grenadeGeo = new THREE.CapsuleGeometry(0.1, 0.14, 3, 8).rotateX(Math.PI / 2);
  const grenadeMat = new THREE.MeshBasicMaterial({ color: 0x141416 });
  const grenadeBaseGeo = new THREE.CylinderGeometry(0.105, 0.105, 0.1, 8).rotateX(Math.PI / 2).translate(0, 0, -0.12);
  const grenadeBaseMat = new THREE.MeshBasicMaterial({ color: 0xc9a85a });
  function lobGrenade(from, target) {
    sfx.play('autocannon', { gain: 0.18, rate: 0.55 + Math.random() * 0.1 }); // (a soft thump, not the MG)
    const aim = enemies.aimPoint(target).clone();
    // led: where it'll be when the round comes down (its pace, measured
    // frame to frame), refined once for the longer flight
    const flight = (dd) => 0.31 + dd * 0.031;
    const v = target.gv || { x: 0, z: 0 };
    for (let k = 0, T = flight(Math.hypot(aim.x - from.x, aim.z - from.z)); k < 2; k++) {
      const lx = aim.x + v.x * T;
      const lz = aim.z + v.z * T;
      T = flight(Math.hypot(lx - from.x, lz - from.z));
      if (k) Object.assign(aim, { x: lx, z: lz });
    }
    const d = Math.hypot(aim.x - from.x, aim.z - from.z);
    // scatter grows with the range; one in four drops short
    const sc = 0.4 + d * 0.06;
    aim.x += (Math.random() - 0.5) * 2 * sc;
    aim.z += (Math.random() - 0.5) * 2 * sc;
    if (Math.random() < 0.25) aim.lerp(from, 0.15 + Math.random() * 0.2);
    aim.y = Math.min(aim.y, groundAt(aim.x, aim.z) + (target.stats.flying ? aim.y : 0.3));
    const m = new THREE.Mesh(grenadeGeo, grenadeMat);
    m.add(new THREE.Mesh(grenadeBaseGeo, grenadeBaseMat));
    m.position.copy(from);
    scene.add(m);
    grenades.push({ m, from: from.clone(), to: aim, t: 0, T: flight(d), apex: 0.7 + d * 0.08, last: from.clone() }); // (slowish: you watch it arc over)
    combat.glow.flash(from, 0xffc860, 0.08, 0.5, 0.06);
    combat.puffs.spawn(from.clone(), new THREE.Vector3(0, 0.6, 0), { color: 0x8f8a80, s0: 0.1, s1: 0.35, life: 0.4, drag: 3, lift: 0.4, fadeAt: 0.3 });
  }
  function grenadeFrame(dt) {
    trailPool?.update(dt);
    // each machine's pace on the ground, smoothed (for leading the rounds)
    if (stats.gmg && dt > 0) {
      for (const e of enemies.alive) {
        if (e.gp) {
          const k = Math.min(1, dt * 6);
          e.gv ??= { x: 0, z: 0 };
          e.gv.x += ((e.pos.x - e.gp.x) / dt - e.gv.x) * k;
          e.gv.z += ((e.pos.z - e.gp.z) / dt - e.gv.z) * k;
          const sp = Math.hypot(e.gv.x, e.gv.z);
          if (sp > 10) (e.gv.x *= 10 / sp), (e.gv.z *= 10 / sp); // (a shove or a jump isn't a pace)
        }
        e.gp = { x: e.pos.x, z: e.pos.z };
      }
    }
    for (let i = grenades.length - 1; i >= 0; i--) {
      const gr = grenades[i];
      gr.t += dt;
      const u = Math.min(1, gr.t / gr.T);
      const p = gr.from.clone().lerp(gr.to, u);
      p.y += 4 * gr.apex * u * (1 - u);
      gr.m.position.copy(p);
      if (p.distanceToSquared(gr.last) > 1e-6) gr.m.lookAt(p.clone().multiplyScalar(2).sub(gr.last)); // (nose along its flight)
      grenadeTrail().tracer(gr.last, p, 0xffffff, 0.2, 0.45); // a smooth white trail, the shell's width, fading
      gr.last.copy(p);
      if (u < 1) continue;
      gr.m.removeFromParent();
      grenades.splice(i, 1);
      const at = gr.to;
      sfx.at('boom', at, { gain: 0.3, rate: 1.25 + Math.random() * 0.15 }); // (a small pop)
      // a small blast wherever it lands (ground, wall, machine): a flash, a
      // ball of fire, dirt and sparks thrown up, smoke
      combat.glow.flash(at, 0xffe0a0, 0.16, 1.8, 0.1);
      combat.glow.light(at, 0xff9a40, 18, 0.16);
      combat.fx.burst(at, { count: 14, speed: 6, color: 0xffb347, life: 0.35, size: 0.08, gravity: 10 });
      combat.fx.burst(at, { count: 8, speed: 4, color: 0x5a4c3c, life: 0.6, size: 0.09, gravity: 14 });
      combat.puffs.spawn(at.clone().setY(at.y + 0.2), new THREE.Vector3(0, 0.6, 0), { color: 0xff9a40, s0: 0.3, s1: 0.7, life: 0.18, drag: 3, lift: 0, fadeAt: 0.1 });
      for (let k = 0; k < 4; k++) combat.puffs.spawn(at.clone(), new THREE.Vector3((Math.random() - 0.5) * 1.6, 0.8 + Math.random(), (Math.random() - 0.5) * 1.6), { color: k % 2 ? 0x5e5952 : 0x6f6a62, s0: 0.25, s1: 0.8, life: 0.9, drag: 3, lift: 0.5, fadeAt: 0.3 });
      const dmg = stats.gmgDamage * (stats.mgDamage / 3);
      for (const e of enemies.alive) {
        const ap = enemies.aimPoint(e);
        const r = Math.hypot(ap.x - at.x, ap.z - at.z) - (e.stats.box?.hx || 0.5) * 0.5;
        if (r > stats.gmgSplash || Math.abs(ap.y - at.y) > 2.2) continue;
        const amount = Math.round(r < 0.6 ? dmg : dmg * 0.5);
        const killed = enemies.damage(e, amount);
        hud.damage(ap.clone().setY(ap.y + 0.5), amount, 'mg');
        if (killed) hud.damage(ap.clone().setY(ap.y + 1.1), 0, 'kill');
      }
    }
  }

  // Ranging (Legendary Rangefinder): every few seconds the farthest machines
  // in sight are marked; marked ones take extra damage until it wears off
  function spotter(dt) {
    if (!stats.spotter || run.over || run.mode !== 'field') return;
    run.spotT = (run.spotT ?? 1) - dt;
    if (run.spotT > 0) return;
    run.spotT = 5;
    const reach = 24 * stats.view;
    const seen = enemies.alive.filter((e) => e.los && Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z) < reach);
    seen.sort((a, b) => Math.hypot(b.pos.x - pos.x, b.pos.z - pos.z) - Math.hypot(a.pos.x - pos.x, a.pos.z - pos.z));
    if (seen.length) pulse('rangefinder');
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
      sfx.loop('treads', 0, 1, 0.05);
      sfx.loop('vulcan', 0, 1, 0.05);
      run.vulcanSpin = false;
      sfx.loop('rocket', 0, 1, 0.05);
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
      save.discardRun(); // (left without finishing: nothing kept)
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
      engineSounds(realDt);
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
      } else if (run.bossSlow > 0) {
        // a boss down: slow motion, easing back to full speed
        run.bossSlow = Math.max(0, run.bossSlow - realDt);
        const k = 1 - run.bossSlow / FINALE_SLOW;
        dt = realDt * (0.15 + 0.85 * k * k);
      } else if (run.spot && run.spot.hold == null && run.spot.slow !== false) dt = realDt * (run.spot.slowK ?? SLOW_MO);
      else if (run.dilate > 0) {
        run.dilate -= realDt;
        dt = realDt * 0.35; // a beat of slow motion as a boost kicks in
      }
      if (run.hunt) dt = realDt * (run.hunt.phase === 'mark' ? HUNT_SLOW : HUNT_FIRE_SLOW); // (one slow-motion action: marking, then the shots)
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
        if (run.spot.hold != null) run.spot.hold -= realDt;
        if (run.spot.hold != null ? run.spot.hold <= 0 || run.over : run.spot.until() || run.spot.t > run.spot.maxTime || run.over) {
          run.spot = null;
          hud.setSpot(null);
        }
      }
      if (run.spotHud && !run.spot) {
        run.spotHud = false;
        if (!run.dying) hud.setGone(false); // (the HUD back after a scene)
      }
      if (!run.over) run.time += dt;
      if (!stats.mag && reload < 1 && reload + dt / stats.reload >= 1) ranging();
      reload = Math.min(1, reload + dt / stats.reload);
      run.rangeT = Math.max(0, (run.rangeT || 0) - dt);
      run.boostCd = Math.max(0, run.boostCd - dt);
      run.abilityCd = Math.max(0, run.abilityCd - dt);
      run.equipCd = Math.max(0, run.equipCd - dt);
      run.barrier = Math.max(0, (run.barrier || 0) - dt);
      if (run.over || run.mode !== 'field') run.barrier = 0;
      run.shieldOn = THREE.MathUtils.clamp((run.shieldOn || 0) + (run.barrier > 0 ? dt * 6 : -dt * 4), 0, 1);
      shield.update(dt, t, run.shieldOn, pos, tank.group.rotation.y + tank.turret.rotation.y);
      if (run.arty > 0) {
        run.arty -= realDt;
        if (run.over || run.mode !== 'field') run.arty = 0;
      }
      strikeFrame(dt, t);
      missileFrame(dt);
      run.shield = Math.max(0, run.shield - dt);
      if (run.grace > 0) run.grace -= dt;
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
        if (keys.has('act:up') || keys.has('ArrowUp')) input.add(INPUT_FORWARD);
        if (keys.has('act:down') || keys.has('ArrowDown')) input.sub(INPUT_FORWARD);
        if (keys.has('act:right') || keys.has('ArrowRight')) input.add(INPUT_RIGHT);
        if (keys.has('act:left') || keys.has('ArrowLeft')) input.sub(INPUT_RIGHT);
        if (stick.id !== null) input.addScaledVector(INPUT_RIGHT, stick.x).addScaledVector(INPUT_FORWARD, -stick.y);
      }
      const boosting = run.boost > 0 || run.dash > 0 || run.brk > 0;
      let want = 0;
      let accel = ACCEL;
      let throttle = stick.id !== null ? Math.min(1, Math.hypot(stick.x, stick.y) * 1.4 * settings().stick) : 1;
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
      if (input.lengthSq() > 0.02 && !(run.retreat > 0)) {
        input.normalize();
        const heading = Math.atan2(-input.z, input.x);
        tank.group.rotation.y = approachAngle(tank.group.rotation.y, heading, TURN_RATE * stats.turn * (boosting ? (run.dash > 0 ? 0.15 : run.brk > 0 ? 0.6 : 0.45) : 1) * dt);
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
      if (run.retreat > 0) {
        run.retreat -= dt;
        want = -BOOST_SPEED * stats.retreatSpeed;
        accel = 200;
        if (run.retreat <= 0) {
          speed = Math.max(speed, -MAX_SPEED * stats.speed); // straight back to reversing speed
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
          sfx.play('crash', { gain: c.kind === 'car' ? 0.62 : 0.42, rate: (c.kind === 'car' ? 0.95 : 1.15) + Math.random() * 0.1 });
          speed *= c.kind === 'car' ? 0.75 : 0.9;
          if (c.scrap) pickups.spawn(new THREE.Vector3(c.footprint.x, 0.6, c.footprint.z), c.scrap, 'scrap', 1);
        },
      });
      if (pushOut(pos, tankBox, blocks)) speed *= boosting ? 0.97 : 0.85; // scrape along blocks instead of sticking
      // ride up onto sidewalks and other raised ground
      const groundY = level.heightAt ? level.heightAt(pos.x, pos.z) : 0;
      pos.y += (groundY - pos.y) * (1 - Math.exp(-dt * 14));
      // and lean with the ground under it: nose up a ramp, rolling on a camber
      if (level.heightAt) {
        const g = tank.group;
        g.rotation.order = 'YXZ'; // (yaw first: rotation.y stays the heading)
        const yw = g.rotation.y;
        const fx = Math.cos(yw);
        const fz = -Math.sin(yw);
        const L = 1.3;
        const W = 0.9;
        const pitch = Math.atan2(level.heightAt(pos.x + fx * L, pos.z + fz * L) - level.heightAt(pos.x - fx * L, pos.z - fz * L), 2 * L);
        const roll = -Math.atan2(level.heightAt(pos.x - fz * W, pos.z + fx * W) - level.heightAt(pos.x + fz * W, pos.z - fx * W), 2 * W);
        const k = 1 - Math.exp(-dt * 10);
        g.rotation.z += (THREE.MathUtils.clamp(pitch, -0.5, 0.5) - g.rotation.z) * k;
        g.rotation.x += (THREE.MathUtils.clamp(roll, -0.3, 0.3) - g.rotation.x) * k;
      }
      const vel = new THREE.Vector3((pos.x - bx) / Math.max(dt, 1e-4), 0, (pos.z - bz) / Math.max(dt, 1e-4));

      // rocket ram and dozer blade: machines in the way take a beating
      if (run.mode === 'field' && !run.over) {
        enemies.nudge(tankBox(), vel); // and anything it drives into is shoved aside
        const ramDmg = (boosting ? RAM_DAMAGE : Math.abs(speed) > 3 ? stats.ramDamage : 0) * (run.brk > 0 ? 0.8 * (stats.abilityPower || 1) : 1); // (Breakthrough's charge a little softer; harder with the tank's level)
        if (ramDmg > 0) {
          // Breakthrough ploughs them on ahead of the tank, knocked senseless;
          // a boost or the blade throws them aside
          const brk = run.brk > 0;
          const opts = brk ? { push: 1.3, side: 2, stun: 1.2, brk: true } : stats.dozerStun && !boosting ? { push: 0.8, side: 4, stun: stats.dozerStun } : { push: 0.5, side: 5 };
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
      const burning = boosting || run.retreat > 0;
      const rk = THREE.MathUtils.clamp(tank.rocketK + (burning ? dt * 8 : -dt * 3), 0, 1);
      tank.setRocket(rk, burning, t);
      if (burning && dt > 0) {
        for (const n of tank.rocketNozzles()) {
          const back = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw)).multiplyScalar(run.retreat > 0 ? -1 : 1); // (a retreat's blast goes out the front)
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
      // a boss down: over to the wreck, held there, then back
      finaleFrame(realDt);
      if (run.finaleCam) {
        run.finaleCam.t -= realDt;
        if (run.finaleCam.t <= 0) run.finaleCam = null;
        else camWant.lerp(run.finaleCam.at.clone().setY(camWant.y), Math.min(1, run.finaleCam.t) * 0.85);
      } else if (run.camShot) {
        run.camShot.t -= realDt;
        if (run.camShot.t <= 0) run.camShot = null;
        else camWant.lerp(run.camShot.at.clone().setY(camWant.y), Math.min(1, run.camShot.t) * 0.9);
      }
      // in the checkpoint: frame the room and its pallets (or the part
      // hovered) while there's a pick to make; for the refit, the tank
      const refit = run.depot && ['edit', 'fit', 'opening'].includes(run.depot.step) && !run.depot.focus;
      if (run.depot && run.mode === 'depot' && run.depot.step !== 'enter' && !refit) camWant.lerp(run.depot.focus || run.depot.room.focus, run.depot.focus ? 0.6 : 0.5);
      if (!run.spot && run.camRate !== 6) run.camRate = Math.min(6, (run.camRate || 6) + realDt * 1.2); // (eases back up after a scene's slow glide)
      if (!run.won) camTarget.lerp(camWant, 1 - Math.exp(-realDt * (run.depot?.focus ? 4 : run.camRate || 6))); // once the zone's won the camera stays put
      // boosting: the view pulls back a touch (and punches out as it kicks
      // in), speed lines rush in from the edges
      speedK += ((boosting ? 1 : 0) - speedK) * (1 - Math.exp(-realDt * (boosting ? 8 : 4)));
      run.punch = Math.max(0, (run.punch || 0) - realDt * 3);
      deathK += ((run.dying ? 1 : 0) - deathK) * (1 - Math.exp(-realDt * 2));
      // the missile tank's salvo: the view pulls right out (everything in
      // it gets locked) until the last missile's gone off
      const scanning = !!run.sal || missiles.some((ms) => ms.top);
      salvoK += ((scanning ? 1 : 0) - salvoK) * (1 - Math.exp(-realDt * (scanning ? 5 : 2)));
      rangeK += ((run.rangeT > 0 ? 1 : 0) - rangeK) * (1 - Math.exp(-realDt * (run.rangeT > 0 ? 4 : 1.5)));
      const zoom = (1 + 0.3 * deathK) / (1 + 0.06 * speedK + 0.05 * run.punch) / (1 + ((stats.salvoZoom || 1) - 1) * salvoK) / (1 + 0.5 * rangeK) * (run.depot ? stats.view : 1); // and leaning in on the wreck; (in a checkpoint the view parts don't count: the room's framed as it is)
      if (Math.abs(camera.zoom - zoom) > 1e-4) {
        camera.zoom = zoom;
        camera.updateProjectionMatrix();
      }
      // a rush at the kick, then just a few faint streaks; Breakthrough's
      // streak the whole way
      hud.setSpeed(run.over ? 0 : Math.min(1, Math.max(speedK * 0.22, run.brk > 0 ? 0.7 : 0, def.id === 'assault' && run.dash > 0 ? 1 : 0) + run.punch * 1.2)); // (the assault tank's dash: full speed lines)
      // Hunter-killer: a black vignette closing in while it works
      vigK += ((run.hunt ? 1 : 0) - vigK) * (1 - Math.exp(-realDt * (run.hunt ? 6 : 3)));
      hud.setVignette(vigK);
      camera.position.copy(camTarget).add(CAM_OFFSET);
      camera.lookAt(camTarget);
      camera.updateMatrixWorld();
      const targets = [...colliders, ...enemies.hitMeshes()];
      if (pointer) {
        ndc.set(pointer[0], pointer[1]);
        raycaster.setFromCamera(ndc, camera);
        const hits = raycaster.intersectObjects(targets, false);
        hovered = null;
        // raised ground (a ramp, a deck, a sidewalk) isn't in the colliders:
        // the ray stops where it first meets the level's own surface, if
        // that's nearer than anything it hit
        const raised = level.heightAt ? surfaceHit(raycaster.ray, hits[0]?.distance ?? 400) : null;
        if (raised) {
          aimPoint.copy(raised);
          hasAim = true;
        } else if (hits.length) {
          let pick = hits[0];
          // the pointer's on an enemy behind something only the camera's
          // view puts in the way (a low wall, a wreck): if the gun has a
          // clear shot at it, aim at the enemy, not the cover
          if (!pick.object.userData.enemy) {
            const behind = hits.find((h) => h.object.userData.enemy?.alive);
            if (behind) {
              const { position: m, breech } = tank.muzzle();
              const toward = behind.point.clone();
              const shot = combat.traceShot(m, toward.clone().sub(m).normalize(), breech, toward, targets);
              if (shot.hit?.mesh === behind.object) pick = behind;
            }
          }
          aimPoint.copy(pick.point);
          hasAim = true;
          hovered = pick.object.userData.enemy || null;
        }
      }
      level.light.follow(camTarget, stats.view / camera.zoom); // the shadow box follows the view (and grows with it), not the tank
      if (fireOnAim) {
        fireOnAim = false;
        fire();
      }
      if (strikeOnAim) {
        strikeOnAim = false;
        if (run.arty > 0) useEquipment();
      }
      // the strike's ring follows the aim while it's being called in
      artyRing.visible = run.arty > 0 && run.armed === 'artillery' && hasAim && !run.over;
      if (artyRing.visible) {
        artyRing.position.set(aimPoint.x, groundAt(aimPoint.x, aimPoint.z) + 0.08, aimPoint.z);
        artyRing.scale.setScalar(EQUIPMENT.artillery.radius + EQUIPMENT.artillery.blast * 0.5);
        artyRing.quaternion.copy(groundTilt(aimPoint.x, aimPoint.z)).multiply(spinQ.setFromAxisAngle(UP, t * 0.6)); // (lying on a ramp's slope)
      }

      // machines
      // the machines don't come into a checkpoint: each shack and the
      // ground just before its door are walls to them (not to the tank)
      const keepOut = (level.shacks || []).filter((k) => k.z1 != null).map((k) => k.keepOut || { x: (k.x0 + k.x1) / 2 - 1.5, z: k.door.z, hx: (k.x1 - k.x0) / 2 + 3, hz: (k.z1 - k.z0) / 2 + 0.6, yaw: 0 });
      if (!run.depot?.freeze) enemies.update(dt, t, { tankPos: pos, tankBox: tankBox(), tankVel: vel, blocks: keepOut.length ? blocks.concat(keepOut) : blocks, colliders, heightAt: level.heightAt, navGoal: level.navGoal, onTankHit: tankHit, over: run.over, shield: shieldNow(), onShieldHit: shieldHit });
      // the roof MG only takes machines it can see (not through trams and walls)
      const mgTarget = run.over || run.mode !== 'field' ? null : enemies.nearest(pos, stats.mgRange, true);
      const mgPoint = mgTarget ? enemies.aimPoint(mgTarget) : null;
      mgActive = !!mgTarget;

      if (run.hunt) huntFrame(realDt, dt);
      // (Hunter-killer marking: the turret holds still)
      tank.update(dt, t, { aimPoint: run.hunt ? (run.hunt.phase === 'fire' ? run.hunt.aim : null) : hasAim && !run.over ? aimPoint : null, mgPoint, speed, turretRate: (run.hunt ? 1 / HUNT_SLOW : run.aiming > 0 ? 1 / AIM_SLOW : 1) * (run.spot?.turretReal && dt > 0 ? realDt / dt : 1), levelGun: run.aiming > 0 || run.levelT > 0 });
      run.levelT = Math.max(0, (run.levelT || 0) - realDt); // the turret keeps its real speed while time's slowed
      // roof MG rounds: most of them land on the machine it's tracking
      run.gmgT = Math.max(0, (run.gmgT || 0) - dt);
      for (const e of tank.events) {
        if (e.type === 'mg' && stats.gmg) {
          // the grenade launcher: a grenade every so often instead of the bullets
          if (mgTarget?.alive && run.gmgT <= 0) {
            run.gmgT = stats.gmgRate;
            lobGrenade(e.muzzle, mgTarget);
          }
          continue;
        }
        if (e.type !== 'mg' || !mgTarget?.alive || Math.random() > MG_ACCURACY) continue;
        const killed = enemies.damage(mgTarget, stats.mgDamage);
        const p = e.target.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.4 + Math.random() * 0.3, (Math.random() - 0.5) * 0.4));
        hud.damage(p, stats.mgDamage, 'mg');
        combat.fx.burst(e.target, { count: 5, speed: 5, color: 0xfff3c4, life: 0.2, size: 0.06, gravity: 10 });
        if (killed) hud.damage(p.clone().setY(p.y + 0.6), 0, 'kill');
      }
      if (stats.twinMg) twinMg(dt, t, mgTarget);
      grenadeFrame(dt);
      spotter(dt);
      run.reactT = Math.max(0, (run.reactT || 0) - dt);
      tryFire(dt);
      autoFire(dt);
      if (!stats.gmg && tank.events?.some((ev) => ev.type === 'mg')) sfx.play('mg', { gain: 0.12, rate: 0.95 + Math.random() * 0.1 }); // (kept low: under the big guns)
      combat.handleTankEvents(tank);
      combat.update(dt);
      stragglers(dt);
      enemyPointers();
      pickups.bounds = run.mode === 'field' ? level.bounds : null;
      pickups.heightAt = level.heightAt;
      pickups.magnet = stats.magnet; // (the Magnet part: drops fly in from further)
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
      if (touch) touchAim();
      else if (forcedAim?.alive) {
        const s2 = toScreen(enemies.aimPoint(forcedAim));
        aimAt(s2.x, s2.y);
      } else forcedAim = null;
      if (client) {
        const reloading = stats.mag && run.magT > 0;
        if (run.aiming > 0) hud.setReticle(client[0], client[1], Math.min(0.999, run.aiming / AIM_TIME)); // the ring counts down the aim
        else hud.setReticle(client[0], client[1], reloading ? 1 - run.magT / stats.magReload : reload, !!stats.mag && !reloading);
      }
      if (run.gun) hud.setKills(enemies.killed);
      hud.setChain(run.chain, run.chainT / (run.chainT > MULT_STEP ? MULT_HOLD : MULT_STEP));
      const live = !run.over && run.mode === 'field';
      hud.setFire(live && !!run.gun, fireTouch !== null, reload < 1 && !stats.mag);
      hud.setSwap(false); // (tap-to-latch: no swap button)
      if (!run.gun || !live) hud.setAmmo(null);
      else if (def.gun === 'missile') hud.setAmmo({ n: run.mag, max: stats.mag, load: run.mReload && run.mag < stats.mag ? (run.mag + (run.trickleT || 0) / (stats.magReload / stats.mag)) / stats.mag : null, kind: 'missile' }); // (the next one filling as it reloads)
      else if (stats.mag) hud.setAmmo({ n: run.mag, max: stats.mag, load: run.magT > 0 ? 1 - run.magT / stats.magReload : null });
      else hud.setAmmo({ n: reload >= 1 ? 1 : 0, max: 1, load: reload >= 1 ? null : reload });
      hud.setPassives(live ? passives() : []);
      hud.setAbility(run.rockets && live ? { k: 1 - run.boostCd / stats.boostCooldown, left: run.boostCd, lit: boosting || run.retreat > 0, active: run.boost > 0 ? run.boost / stats.boostTime : run.dash > 0 ? run.dash / stats.dashTime : run.retreat > 0 ? run.retreat / stats.retreatTime : null, art: def.move === 'retreat' ? retreatArt(true) : boostPicture(true, stats.afterburner ? 'afterburner' : 'normal') } : null);
      const abilityCd = def.ability === 'pierce' ? stats.pierceCooldown : def.ability === 'salvo' ? stats.salvoCooldown : def.ability === 'hunter' ? stats.hunterCooldown : stats.breakCooldown;
      const eq = equipId();
      hud.setAbility(eq && run.gun && live ? { k: 1 - run.equipCd / EQUIPMENT[eq].cooldown, left: run.equipCd, lit: run.arty > 0 || !!run.msl || run.barrier > 0, active: run.arty > 0 ? run.arty / (DESIGNATE[run.armed] || 8) : run.barrier > 0 ? run.barrier / EQUIPMENT.shield.time : null, cancel: run.arty > 0, art: equipmentArt(eq) } : null, 2);
      hud.setAbility(def.ability && run.ability && live ? { k: 1 - run.abilityCd / abilityCd, left: run.abilityCd, lit: run.aiming > 0 || run.brk > 0 || !!run.hunt, active: run.aiming > 0 ? run.aiming / AIM_TIME : run.brk > 0 ? run.brk / stats.breakTime : null, art: def.ability === 'pierce' ? pierceArt() : def.ability === 'salvo' ? equipmentArt('atgm') : def.ability === 'hunter' ? hunterArt() : breakArt() } : null, 1);
      if (run.boss) {
        const e = run.boss.e;
        hud.setBoss(run.boss.name, e.alive ? e.hp / e.maxHp : 0);
        if (!e.alive) {
          sfx.play('explosion', { gain: 0.8, rate: 0.9 }); // (its last big bang)
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
    // the pause menu's up (the portal's told play has stopped)
    get paused() {
      return run.paused;
    },
    // (the phone's been turned upright: stop and show the pause menu)
    pause() {
      if (!run.paused && !run.over && run.mode === 'field') setPaused(true);
    },
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
