// Endless: Outskirts. A crossroads on the edge of the city at dusk, ringed
// by panel blocks and stacked containers; wrecks, barricades and rubble
// heaps for cover; a fortified base (a checkpoint shed) on the south side.
//
// Waves come in from the edges and never stop. Between waves the base's
// door opens: drive in to repair and change the loadout (the next wave
// waits while you're inside). Each wave is bigger than the last, and the
// machines in it get tougher and hit harder over the first five minutes
// (to about Hard), then keep creeping up. No revive: the run ends when the
// tank does, or when you leave (the pause menu); either way it pays out.
import * as THREE from 'three';
import { addDusk } from '../render/setup.js';
import { setLowPoly } from '../models/kit.js';
import { LevelBuilder, canvas, tex, blob, speckle } from './builder.js';
import * as P from './props.js';
import { cityKit, CONTAINERS } from './cityKit.js';
import { buildShack } from './depot.js';
import { buildDepotRoom } from './depotRoom.js';
import { mapMat } from './cityTextures.js';
import { pushOut } from '../game/collide.js';

const GPX = 5;
const MAP = { x0: -84, x1: 84, z0: -62, z1: 62 };
const ARENA = { minX: -54, maxX: 54, minZ: -32, maxZ: 32 };
const ROAD = 6; // half-width of both roads
const BASE = { x0: -3.8, x1: 3.8, z0: 15, z1: 25 }; // the base shed, across the south road

function groundTexture(rand) {
  const W = (MAP.x1 - MAP.x0) * GPX;
  const H = (MAP.z1 - MAP.z0) * GPX;
  const [c, g] = canvas(W, H);
  const X = (x) => (x - MAP.x0) * GPX;
  const Z = (z) => (z - MAP.z0) * GPX;
  const rect = (x0, z0, x1, z1, color) => {
    g.fillStyle = color;
    g.fillRect(X(x0), Z(z0), X(x1) - X(x0), Z(z1) - Z(z0));
  };
  // old concrete yards, grey with snow ground into it
  rect(MAP.x0, MAP.z0, MAP.x1, MAP.z1, '#a9adb2');
  speckle(g, W, H, ['#9da1a6', '#b8bcc1', '#92969b', '#c6c9cd'], W * H * 0.05, rand);
  // slabs: faint joints
  g.fillStyle = 'rgba(70,72,76,0.25)';
  for (let x = MAP.x0; x < MAP.x1; x += 4) g.fillRect(X(x), 0, 1, H);
  for (let z = MAP.z0; z < MAP.z1; z += 4) g.fillRect(0, Z(z), W, 1);
  // the two roads: asphalt, lane lines, patches
  for (const [x0, z0, x1, z1] of [
    [MAP.x0, -ROAD, MAP.x1, ROAD],
    [-ROAD, MAP.z0, ROAD, MAP.z1],
  ]) {
    rect(x0, z0, x1, z1, '#55585d');
    speckle(g, X(x1) - X(x0), Z(z1) - Z(z0), ['#4b4e52', '#606368', '#585b60'], (X(x1) - X(x0)) * (Z(z1) - Z(z0)) * 0.12, rand, Z(z0), X(x0));
  }
  g.fillStyle = '#d9d2b4';
  for (let x = MAP.x0; x < MAP.x1; x += 5) if (Math.abs(x) > ROAD + 1) g.fillRect(X(x), Z(-0.1), 2.5 * GPX, 2);
  for (let z = MAP.z0; z < MAP.z1; z += 5) if (Math.abs(z) > ROAD + 1) g.fillRect(X(-0.1), Z(z), 2, 2.5 * GPX);
  // a stop line round the crossing, faded
  g.fillStyle = 'rgba(230,226,210,0.5)';
  for (const s of [-1, 1]) {
    g.fillRect(X(s * (ROAD + 0.6)), Z(-ROAD), 3, ROAD * 2 * GPX);
    g.fillRect(X(-ROAD), Z(s * (ROAD + 0.6)), ROAD * 2 * GPX, 3);
  }
  // the base's apron: painted bays, hazard stripes at its doors
  rect(BASE.x0 - 8, BASE.z0 - 4, BASE.x1 + 8, BASE.z1 + 4, '#7d8186');
  g.fillStyle = '#c9a23a';
  for (const x of [BASE.x0 - 6, BASE.x1 + 3]) for (let z = BASE.z0; z < BASE.z1; z += 1.4) g.fillRect(X(x), Z(z), 2.5 * GPX, 0.6 * GPX);
  // scorch marks, potholes, slush
  for (let i = 0; i < 70; i++) {
    const x = MAP.x0 + rand() * (MAP.x1 - MAP.x0);
    const z = MAP.z0 + rand() * (MAP.z1 - MAP.z0);
    g.fillStyle = rand() < 0.5 ? 'rgba(30,28,26,0.35)' : 'rgba(210,214,220,0.5)';
    blob(g, X(x), Z(z), (0.8 + rand() * 2.5) * GPX, (0.6 + rand() * 1.8) * GPX, rand, 10);
  }
  return mapMat(tex(c));
}

export const endless = {
  id: 'endless',
  name: 'Endless · Outskirts',
  endless: true, // (no revive; its own end screen; fewer scraps a kill)
  build(scene) {
    setLowPoly(true);
    try {
      return buildEndless(scene);
    } finally {
      setLowPoly(false);
    }
  },
};

function buildEndless(scene) {
  const B = new LevelBuilder(scene, 9091);
  const rand = B.rand;
  const light = addDusk(scene, { shadowSize: 24, shadowMap: 2048 });
  const heightAt = () => 0;

  // ground
  {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(MAP.x1 - MAP.x0, MAP.z1 - MAP.z0), groundTexture(rand));
    m.rotation.x = -Math.PI / 2;
    m.position.set((MAP.x0 + MAP.x1) / 2, 0, (MAP.z0 + MAP.z1) / 2);
    m.receiveShadow = true;
    B.add(m);
    B.solid(m);
  }
  const K = cityKit(B, { WALK: { n: -36, s: 36 }, heightAt });

  // the ring: panel blocks along the north and south, the roads running
  // out between them; stacked containers and heaps closing the east and
  // west, a wrecked tram in the gaps
  for (const [x0, x1, f] of [[-84, -40, 7], [-38, -8, 5], [8, 30, 6], [32, 84, 8]]) K.building({ x0, x1, zf: -36, depth: 16, floors: f, holes: 2, broken: 0.35 });
  for (const [x0, x1, f] of [[-84, -46, 4], [-44, -8, 3], [8, 40, 4], [42, 84, 3]]) K.southBlock(x0, x1, f, 36);
  for (const s of [-1, 1]) {
    const x = s * 61;
    for (let z = -34; z <= 34; z += 6.4) {
      if (Math.abs(z) < ROAD + 1) continue;
      K.container(B, x, 0, z, Math.PI / 2 + (rand() - 0.5) * 0.1, CONTAINERS[(rand() * 5) | 0]);
      if (rand() < 0.6) K.container(B, x + (rand() - 0.5) * 0.4, 2.6, z + (rand() - 0.5) * 0.6, Math.PI / 2 + (rand() - 0.5) * 0.2, CONTAINERS[(rand() * 5) | 0]);
    }
    // the roads out east and west: barricaded
    for (let z = -ROAD; z <= ROAD; z += 1.7) K.jersey(B, x, z, Math.PI / 2 + (rand() - 0.5) * 0.3);
    K.rubble(B, x - s * 3, (rand() - 0.5) * 6, 2.4, 1.2, { solid: true });
  }
  // the roads out north and south: rubble across them
  for (const z of [-40, 40]) K.rubble(B, 0, z, 4.5, 1.8, { solid: true, slabs: 4 });
  // a hard edge all round (where the blocks don't quite meet)
  for (const s of [-1, 1]) {
    B.block(0, s * (ARENA.maxZ + 2.6), 70, 0.5);
    B.block(s * (ARENA.maxX + 2.6), 0, 0.5, 40);
  }

  // cover in the arena: wrecks, a bus, containers, jersey lines, heaps
  const clearOfBase = (x, z) => !(Math.abs(x) < 16 && z > 8);
  for (const [x, z, yaw, kind] of [
    [-30, -10, 0.3, 'sedan'],
    [22, -14, 1.2, 'van'],
    [36, 8, 2.4, 'sedan'],
    [-40, 18, 0.8, 'sedan'],
    [44, -24, 0.5, 'van'],
    [-18, -26, 1.9, 'sedan'],
    [-46, -4, 2.8, 'sedan'],
    [28, 24, 0.2, 'sedan'],
  ]) if (clearOfBase(x, z)) P.car(B, x, z, yaw, { kind, flipped: rand() < 0.2 });
  P.bus(B, -26, 3.5, 0.08);
  P.bus(B, 40, -2, Math.PI + 0.15);
  for (const [x, z, yaw] of [[30, -26, 0.2], [-44, -22, 1.4], [46, 22, 0.8], [-8, -16, 1.57]]) K.container(B, x, 0, z, yaw, CONTAINERS[(rand() * 5) | 0]);
  for (const [cx, cz, n, yaw] of [[12, -20, 4, 0.1], [-14, 11, 3, 1.4], [22, 11, 4, 0.5], [-36, -6, 3, 1.7], [-22, 26, 3, 0.2], [18, 28, 3, -0.3]]) {
    for (let i = 0; i < n; i++) K.jersey(B, cx + Math.cos(yaw) * i * 1.7, cz - Math.sin(yaw) * i * 1.7, yaw + (rand() - 0.5) * 0.2);
  }
  for (const [x, z, r, h] of [[2, -24, 2.4, 1.2], [-48, 8, 2.6, 1.4], [44, -8, 2, 1.1], [-30, 26, 1.8, 1], [34, 18, 1.6, 0.9]]) K.rubble(B, x, z, r, h, { solid: true });
  for (let i = 0; i < 6; i++) P.tires(B, -50 + rand() * 100, 0, -28 + rand() * 20, 3);
  for (const [x, z, yaw] of [[-12, -30, 0.5], [26, -4, 2.2], [-50, 28, 1]]) P.fallenPole(B, x, z, yaw);

  // the base: a checkpoint shed across the south road, its own yard
  const base = buildShack(B, { x0: BASE.x0, x1: BASE.x1, z0: BASE.z0, z1: BASE.z1, fill: { n: BASE.z0, s: BASE.z1 }, heightAt, label: 'BASE' });
  // sandbag walls and floodlights round its yard
  for (const s of [-1, 1]) {
    for (let x = BASE.x0 - 6; x < BASE.x1 + 6; x += 1.1) if (Math.abs(x) > 1) B.piece(1.05, 0.5, 0.6, 0x8a7d62, x, 0.25, s > 0 ? BASE.z1 + 2.4 : BASE.z0 - 2.4, 0, (rand() - 0.5) * 0.15, 0);
  }

  B.finish();
  B.mergeStatic();
  const room = buildDepotRoom(scene);
  const blocks = [...B.blocks, ...room.blocks];
  const colliders = [...B.colliders, ...room.colliders];
  const emitters = [...B.emitters, ...room.emitters];
  room.bindBlocks(blocks);
  base.bindBlocks(blocks);

  // ------------------------------------------------------------ the waves
  const S = { t: 0, time: 0, wave: 0, phase: 'intro', left: 4, queue: [], groupT: 0, inBase: false, shut: 0 };
  const near = (api) => Math.hypot(api.tankPos.x - base.door.x, api.tankPos.z - base.door.z);
  // how tough each machine is by now: up to about Hard at five minutes,
  // creeping on after that
  const toughness = () => {
    const k = Math.min(1, S.time / 300);
    const late = Math.max(0, S.time - 300) / 600;
    return { hp: 0.7 + 0.6 * k + 0.3 * late, dmg: 0.75 + 0.45 * k + 0.2 * late };
  };
  // somewhere in from an edge, well away from the tank, on open ground
  const edgeSpot = (api) => {
    for (let i = 0; i < 40; i++) {
      const side = (rand() * 4) | 0;
      const along = rand();
      const inset = 2 + rand() * 6;
      const x = side === 0 ? ARENA.minX + inset : side === 1 ? ARENA.maxX - inset : ARENA.minX + 4 + along * (ARENA.maxX - ARENA.minX - 8);
      const z = side === 2 ? ARENA.minZ + inset : side === 3 ? ARENA.maxZ - inset : ARENA.minZ + 4 + along * (ARENA.maxZ - ARENA.minZ - 8);
      if (Math.hypot(x - api.tankPos.x, z - api.tankPos.z) < 22) continue;
      if (Math.abs(x) < 14 && z > 8) continue; // (not in the base's yard)
      const q = new THREE.Vector3(x, 0, z);
      pushOut(q, () => ({ x: q.x, z: q.z, hx: 0.9, hz: 0.7, yaw: 0 }), blocks, 2);
      if (Math.hypot(q.x - x, q.z - z) > 0.2) continue;
      return [x, z];
    }
    return [ARENA.minX + 3, ARENA.minZ + 3];
  };
  const KINDS = [
    { k: 'dog', cost: 1, from: 1 },
    { k: 'walker', cost: 2.5, from: 2 },
    { k: 'hound', cost: 1.5, from: 3 },
    { k: 'drone', cost: 2.2, from: 3 },
    { k: 'gunship', cost: 6, from: 7 },
    { k: 'arty', cost: 8, from: 9 },
  ];
  function spawnOne(api, k, x, z, delay) {
    const opts = { delay };
    const e =
      k === 'walker' ? api.spawnWalker(x, z, opts)
      : k === 'hound' ? api.spawnHound(x, z, opts)
      : k === 'drone' ? api.spawnDrone(x, z, opts)
      : k === 'gunship' ? api.spawnGunship(x, z, opts)
      : k === 'arty' ? api.spawnArty(x, z, { ...opts, hpScale: 0.3 })
      : api.spawnDog(x, z, opts);
    if (e) e.hp = e.maxHp = Math.round(e.maxHp * toughness().hp);
  }
  // a wave: a budget that grows with the wave and the time, spent on a mix
  // that widens as the waves go on, in groups a few seconds apart from
  // different edges
  function buildWave() {
    const n = S.wave;
    let budget = 3 + n * 1.6 + S.time / 60;
    const pool = KINDS.filter((d) => n >= d.from);
    const groups = [];
    let g = [];
    let gCost = 0;
    let heavy = 0;
    while (budget > 0.9) {
      const options = pool.filter((d) => d.cost <= budget && !(d.k === 'arty' && heavy) && !(d.k === 'gunship' && heavy > 1));
      if (!options.length) break;
      // dogs most of the time, the rest weighted toward the cheaper ones
      const d = rand() < 0.45 ? options[0] : options[(rand() * options.length) | 0];
      if (d.cost >= 6) heavy++;
      g.push(d.k);
      gCost += d.cost;
      budget -= d.cost;
      if (gCost >= 4 + n * 0.25) {
        groups.push(g);
        g = [];
        gCost = 0;
      }
    }
    if (g.length) groups.push(g);
    S.queue = groups.map((list, i) => ({ at: i * Math.max(2.5, 6 - n * 0.2), list }));
    S.groupT = 0;
  }
  function openBase(api) {
    base.openIn();
    api.arrow(base.door.clone().setY(2.2), 'Base');
  }
  function closeBase(api) {
    base.closeIn();
    api.arrow(null);
  }

  function start(api) {
    Object.assign(S, { t: 0, time: 0, wave: 0, phase: 'intro', left: 4, queue: [], groupT: 0, inBase: false, shut: 0 });
    api.enableGun();
    api.revealScraps(false);
    api.giveRockets();
    if (api.tank.ability) api.giveAbility();
    api.objective('Get ready');
    api.prompt('Endless', 'Hold out as long as you can! Between waves the <b>base</b> opens: drive in to repair and change your loadout.', { go: true, seconds: 6 });
  }

  function script(api, dt) {
    if (api.run.mode !== 'field') return;
    const run = api.run;
    S.t += dt;
    S.time += dt;
    run.endlessT = S.time;
    run.endlessWave = S.wave;
    run.dmgMul = toughness().dmg;
    // the base's back door shuts again a moment after you've come out
    if (S.shut > 0 && (S.shut -= dt) <= 0) base.closeOut();
    const mm = Math.floor(S.time / 60);
    const ss = String(Math.floor(S.time % 60)).padStart(2, '0');
    if (S.phase === 'intro' || S.phase === 'break') {
      S.left -= dt;
      api.objective(`${S.phase === 'intro' ? 'First wave' : `Wave ${S.wave + 1}`} in ${Math.ceil(Math.max(0, S.left))} s · ${mm}:${ss}`);
      // into the base (open between waves)
      if (S.phase === 'break' && base.inDoor > 0.6 && near(api) < 5) {
        closeBase(api);
        S.phase = 'inbase';
        api.depot(base, {
          offers: [],
          onLeave: () => {
            S.phase = 'break';
            S.left = Math.max(S.left, 4);
            S.shut = 2;
          },
        });
        return;
      }
      if (S.left <= 0) {
        closeBase(api);
        S.wave++;
        S.phase = 'fight';
        buildWave();
        api.prompt(`Wave ${S.wave}`, S.wave === 1 ? 'Here they come!' : 'Here comes the next wave!', { danger: true, seconds: 3 });
      }
      return;
    }
    if (S.phase === 'fight') {
      S.groupT += dt;
      while (S.queue.length && S.queue[0].at <= S.groupT) {
        const { list } = S.queue.shift();
        const [x, z] = edgeSpot(api);
        list.forEach((k, i) => spawnOne(api, k, x + (rand() - 0.5) * 4, z + (rand() - 0.5) * 4, i * 0.35));
      }
      api.objective(`Wave ${S.wave} · ${api.enemiesAlive + S.queue.reduce((a, q) => a + q.list.length, 0)} left · ${mm}:${ss}`);
      if (!S.queue.length && api.enemiesAlive === 0) {
        run.endlessWaves = S.wave; // (waves cleared)
        S.phase = 'break';
        S.left = 12 + Math.min(6, S.wave * 0.5);
        openBase(api);
        api.prompt(`Wave ${S.wave} cleared`, 'The <b>base</b> is open: repair and change your loadout, or hold your ground.', { go: true, seconds: 4 });
      }
    }
  }

  function update(dt, t, ctx = {}) {
    B.update(dt, t, ctx);
    base.update(dt, t);
    room.update(dt, t, ctx);
    if (ctx.api) script(ctx.api, dt);
  }

  return {
    light,
    colliders,
    blocks,
    emitters,
    crushables: B.crushables,
    depotRoom: room,
    heightAt,
    spawn: { x: -14, z: 0, yaw: 0 },
    bounds: { ...ARENA },
    shacks: [base],
    script: S,
    start,
    update,
  };
}
