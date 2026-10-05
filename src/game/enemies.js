// Enemy machines in a level. For now: robot dogs that rush the tank, stop
// at rifle range, strafe and fire bursts. The roof MG and cannon splash kill
// them; their wrecks stay where they fall.
import * as THREE from 'three';
import { createDog } from '../models/dog.js';
import { createWalker } from '../models/walker.js';
import { createBridgeGun } from '../models/bridgeGun.js';
import { createDrone } from '../models/drone.js';
import { createSpider } from '../models/spider.js';
import { pushOut } from './collide.js';
import { ENEMY_LAYER } from '../render/pixel.js';

const DOG = {
  hp: 24,
  runSpeed: 6.2,
  walkSpeed: 2.2,
  range: 8.5, // stops and shoots inside this
  tooClose: 4.5, // backs off inside this
  burst: 3,
  burstGap: 0.13,
  reload: 1.7,
  damage: 1.5,
  accuracy: 0.5,
  box: { hx: 0.55, hz: 0.3 },
  scale: 1,
  scrap: 3,
  windup: 0.6, // seconds the red firing funnel shows before a burst
  spread: 0.06, // radians either side
  boltSpeed: 22,
};

// The large drone: the zone's boss, a walker twice the size that comes
// in slowly and hoses the tank with long bursts. (Small ones in the game's
// text are "quadruped walkers"; in code they're dogs.)
const HOUND = {
  ...DOG,
  hp: 600,
  runSpeed: 3.2,
  walkSpeed: 1.5,
  range: 11,
  tooClose: 6,
  burst: 7,
  burstGap: 0.08,
  reload: 2.0,
  damage: 1.6,
  accuracy: 0.55,
  box: { hx: 1.2, hz: 0.66 },
  scale: 2.2,
  scrap: 30,
  windup: 0.9,
  spread: 0.1,
  boltSpeed: 20,
};

// The anti-tank walker: a tall biped with one long gun. It closes to long
// range, stops, and lines up a shot: its funnel narrows to a line and blinks
// white faster and faster, its aim creeping after the tank, then a beam goes
// straight down the line, through anything on it until something solid.
// Breaking its line of sight, smoke, or a stun spoils the shot.
const HULL_Y = 0.7; // where an anti-tank beam is laid: on the tank's hull

const WALKER = {
  ...DOG,
  model: createWalker,
  sniper: true,
  hp: 55,
  runSpeed: 3.4,
  walkSpeed: 1.6,
  range: 17,
  tooClose: 9,
  charge: 2.2, // seconds lining up a shot
  track: 0.55, // how fast (rad/s) its aim creeps after the tank meanwhile
  lock: 0.55, // the last seconds of the charge its aim holds still (the line goes solid white): the moment to dodge
  reload: 3.2,
  damage: 24,
  box: { hx: 0.6, hz: 0.4 },
  scale: 1.2,
  aimY: 1.5,
  muzzleY: 1.9,
  hit: [1.0, 2.1, 0.9, 1.3],
  scrap: 8,
};

// The bridge gun: level 2's boss, a heavy anti-tank gun dug in at the far
// end of the bridge. Doesn't move; charges like the walker but faster and
// harder, its aim sweeping after the tank.
const BRIDGE_GUN = {
  ...WALKER,
  model: createBridgeGun,
  static: true,
  shatterOnDeath: true, // blown to pieces when destroyed: nothing left standing
  hp: 900,
  range: 44,
  tooClose: 0,
  charge: 2.4,
  track: 0.9,
  lock: 0.6,
  reload: 1.7,
  damage: 28,
  box: { hx: 1.9, hz: 1.9 },
  scale: 2.2,
  modelScale: 1,
  aimY: 1.3,
  muzzleY: 2.4,
  hit: [4.4, 1.9, 4.4, 0.95], // the whole emplacement, sandbags and all: a shell into the bags is a hit
  scrap: 40,
};

// The attack drone: flies (over walls and wrecks), quick, darting from spot
// to spot round the tank. To shoot it has to stop: it hangs in the air, its
// pods glow, then it looses a salvo of slow rockets one after another at
// where the tank was. Side-step and they miss; catch it while it hangs
// there and it's an easy kill. Then it darts off somewhere else.
// A drone's rocket, nose along +x: a grey body with fins, a red seeker
// eye in its nose throwing a thin red beam ahead, and the motor's flame
// (white-hot core, orange plume) out the back.
const ROCKET_MATS = {
  body: new THREE.MeshBasicMaterial({ color: 0x6f747a }),
  fin: new THREE.MeshBasicMaterial({ color: 0x3a3f36 }),
  seeker: new THREE.MeshBasicMaterial({ color: 0xff2a1f }),
  beam: new THREE.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }),
  core: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  plume: new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }),
  halo: new THREE.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }),
  glow: new THREE.MeshBasicMaterial({ color: 0xffb050, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }),
};
const ROCKET_GEO = {
  body: new THREE.CylinderGeometry(0.055, 0.055, 0.36, 8).rotateZ(Math.PI / 2),
  nose: new THREE.ConeGeometry(0.055, 0.1, 8).rotateZ(-Math.PI / 2),
  fin: new THREE.BoxGeometry(0.1, 0.2, 0.015),
  seeker: new THREE.SphereGeometry(0.032, 6, 4),
  halo: new THREE.SphereGeometry(0.13, 8, 6),
  glow: new THREE.SphereGeometry(0.38, 10, 8),
  beam: new THREE.CylinderGeometry(0.008, 0.008, 1.6, 4).rotateZ(Math.PI / 2),
  core: new THREE.SphereGeometry(0.07, 6, 4),
  plume: new THREE.ConeGeometry(0.1, 0.7, 8).rotateZ(Math.PI / 2),
};
function droneRocket() {
  const g = new THREE.Group();
  const add = (geo, mat, x, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  add(ROCKET_GEO.body, ROCKET_MATS.body, 0);
  add(ROCKET_GEO.nose, ROCKET_MATS.body, 0.23);
  add(ROCKET_GEO.fin, ROCKET_MATS.fin, -0.14);
  add(ROCKET_GEO.fin, ROCKET_MATS.fin, -0.14).rotation.x = Math.PI / 2;
  add(ROCKET_GEO.seeker, ROCKET_MATS.seeker, 0.28);
  add(ROCKET_GEO.halo, ROCKET_MATS.halo, 0.28);
  add(ROCKET_GEO.beam, ROCKET_MATS.beam, 0.28 + 0.8);
  add(ROCKET_GEO.core, ROCKET_MATS.core, -0.2);
  add(ROCKET_GEO.glow, ROCKET_MATS.glow, -0.3); // the motor's glow round the tail
  const plume = add(ROCKET_GEO.plume, ROCKET_MATS.plume, -0.38);
  // the flame flickers: scaled about its base at the nozzle
  const flame = new THREE.Group();
  flame.position.x = -0.2;
  plume.position.x = -0.33;
  flame.add(plume);
  g.add(flame);
  g.userData.flame = flame;
  g.scale.setScalar(1.4);
  return g;
}

// The mech: level 4's boss. A low, wide four-legged walking tank with
// two weapons: its main gun (lines up like the walker's beam, a red funnel,
// but fires a slow explosive shell you can see coming), and rocket
// artillery from the launchers on its sides (red rings mark exactly where
// each rocket comes down).
const SPIDER = {
  ...WALKER,
  model: createSpider,
  spider: true,
  kinetic: true,
  shatterOnDeath: true,
  hp: 6000,
  runSpeed: 2.0,
  walkSpeed: 1.3,
  turnRate: 1.2,
  range: 26,
  tooClose: 11,
  charge: 2.2,
  track: 0.5,
  lock: 0.55,
  reload: 4.2,
  damage: 28, // the shell, a direct hit
  shellSpeed: 12,
  shellBlast: 2.4, // its burst
  shellSplash: 14,
  box: { hx: 3.0, hz: 3.0 },
  scale: 1,
  modelScale: 1,
  aimY: 2.3,
  muzzleY: 2.4,
  hit: [5.6, 2.6, 4.8, 1.5],
  scrap: 80,
  artyEvery: 7.5,
  artyRockets: 6,
  artyFall: [1.7, 2.5], // seconds in the air (the first lands soonest)
  artyBlast: 1.9,
  artyDamage: 12,
  // stage 2 (below half): no artillery; a quicker gun, and dashes
  charge2: 1.6,
  dashEvery: [8, 10],
  dashPlant: 1.2, // the red path showing before it goes
  dashSpeed: 18,
  dashWidth: 3.6,
  dashDamage: 40,
  daze: 2, // stunned after it hits the wall: takes extra damage
  dazeTaken: 1.5,
};

const DRONE = {
  ...DOG,
  model: createDrone,
  flying: true,
  hp: 32,
  runSpeed: 7.5,
  walkSpeed: 3,
  fly: 3.4, // height it flies at (over the ground, or the tank's, whichever's higher)
  range: 15, // how far it'll fire from
  orbit: [9, 13], // how far from the tank it darts about
  windup: 0.9, // hanging still, pods glowing, its red funnel on the ground, before the salvo
  salvo: 3,
  salvoGap: 0.28,
  reload: 3.4,
  damage: 11, // each rocket (and a little splash)
  rocketSpeed: 10,
  box: { hx: 0.5, hz: 0.5 },
  scale: 1.3,
  modelScale: 1.3,
  aimY: 2.6,
  hit: [1.2, 0.7, 1.2, 0],
  scrap: 5,
};

// The red funnel a machine shows while winding up a burst: where the rounds
// will go. Unit length along +x, opening to ±0.5; scaled per shot.
const funnelGeo = (() => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, -0.5, 1, 0, 0.5], 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute([1, 1, 1, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25], 3));
  return g;
})();
// its outline: a crisp red edge drawn over the soft fill, so it still reads
// against the machines' own red glow
const funnelEdgeGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, -0.5), new THREE.Vector3(1, 0, 0.5)]);

// Line of sight through the level's solid shapes (walls, trams, containers,
// wrecks): is anything in the way between a and b?
const losRay = new THREE.Raycaster();
const losDir = new THREE.Vector3();
export function sightBlocked(a, b, colliders) {
  if (!colliders?.length) return false;
  losDir.subVectors(b, a);
  const len = losDir.length();
  if (len < 0.5) return false;
  losRay.set(a, losDir.divideScalar(len));
  losRay.far = len - 0.4;
  return losRay.intersectObjects(colliders, false).length > 0;
}

export class Enemies {
  constructor(scene, combat) {
    this.scene = scene;
    this.combat = combat;
    this.list = [];
    this.parts = [];
    this.killed = 0;
    this.bolts = []; // rounds in flight
    this.hitMat = new THREE.MeshBasicMaterial({ visible: false });
  }

  // a dog appears at (x, z), already running toward the tank
  // via: waypoints [[x, z], ...] it runs through first (out of side streets)
  spawnDog(x, z, opts) {
    return this.spawn(DOG, 'dog', x, z, opts);
  }
  spawnHound(x, z, opts) {
    return this.spawn(HOUND, 'hound', x, z, opts);
  }
  spawnDrone(x, z, opts) {
    const e = this.spawn(DRONE, 'drone', x, z, opts);
    e.pos.y = DRONE.fly + 6; // dropping in from higher up
    return e;
  }
  spawnSpider(x, z, opts = {}) {
    const e = this.spawn(SPIDER, 'spider', x, z, opts);
    e.model.group.rotation.y = opts.yaw ?? Math.PI;
    e.arena = opts.arena || null; // (x, z) => inside where it can dash
    e.mctx = {};
    return e;
  }
  spawnWalker(x, z, opts) {
    return this.spawn(WALKER, 'walker', x, z, opts);
  }
  // yaw: which way the gun faces to start with
  spawnBridgeGun(x, z, opts = {}) {
    const e = this.spawn(BRIDGE_GUN, 'gun', x, z, opts);
    e.model.group.rotation.y = opts.yaw ?? Math.PI;
    return e;
  }

  // noclip: ignore walls and rubble until the waypoints are done (climbing in
  // over a rubble heap from off screen)
  spawn(stats, kind, x, z, { delay = 0, via = [], noclip = false } = {}) {
    const model = (stats.model || createDog)();
    model.group.scale.setScalar(stats.modelScale ?? stats.scale);
    model.group.position.set(x, 0, z);
    model.group.visible = delay <= 0;
    this.scene.add(model.group);
    // solid parts go into the team mask for the red outline
    model.group.traverse((o) => {
      if (o.isMesh && !o.material.transparent && !o.userData.outline) o.layers.enable(ENEMY_LAYER);
    });
    // invisible box shells and the aim ray can hit
    const [hw, hh, hd, hy] = stats.hit || [1.2, 1.0, 0.7, 0.55];
    const hit = new THREE.Mesh(new THREE.BoxGeometry(hw, hh, hd), this.hitMat);
    hit.position.y = hy;
    hit.userData.noDecal = true;
    model.group.add(hit);
    const e = {
      kind,
      stats,
      model,
      hit,
      pos: model.group.position,
      hp: stats.hp,
      maxHp: stats.hp,
      alive: true,
      delay,
      fireTimer: 0.6 + Math.random() * 0.8,
      burstLeft: 0,
      strafe: Math.random() < 0.5 ? -1 : 1,
      strafeTimer: 1 + Math.random(),
      stuck: 0,
      sidestep: 0,
      recoil: 0,
      speed: 0,
      via: via.map(([wx, wz]) => ({ x: wx, z: wz })),
      noclip,
      los: false, // can it see the tank (and the tank it)?
      losT: Math.random() * 0.25,
    };
    hit.userData.enemy = e;
    // the firing funnel, on the ground in front of it
    e.funnel = new THREE.Mesh(funnelGeo, new THREE.MeshBasicMaterial({ color: 0xff3b2f, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    e.funnel.visible = false;
    e.funnel.frustumCulled = false;
    e.funnelEdge = new THREE.LineLoop(funnelEdgeGeo, new THREE.LineBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0, depthWrite: false }));
    e.funnelEdge.position.y = 0.02;
    e.funnelEdge.frustumCulled = false;
    e.funnel.add(e.funnelEdge);
    this.scene.add(e.funnel);
    e.windup = 0;
    e.lock = null;
    e.funnelK = 0;
    this.list.push(e);
    return e;
  }

  get alive() {
    return this.list.filter((e) => e.alive && e.delay <= 0);
  }

  hitMeshes() {
    return this.list.filter((e) => e.alive && e.delay <= 0).map((e) => e.hit);
  }

  // Nearest live machine within range of p (for the roof MG).
  nearest(p, range, needSight = false) {
    let best = null;
    let bestD = range * range;
    for (const e of this.list) {
      if (!e.alive || e.delay > 0 || (needSight && !e.los)) continue;
      const d = (e.pos.x - p.x) ** 2 + (e.pos.z - p.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  aimPoint(e) {
    return new THREE.Vector3(e.pos.x, e.stats.aimY ?? 0.65 * e.stats.scale, e.pos.z);
  }

  // Returns true when this killed it. blastFrom: a heavy hit that blows the
  // machine apart instead of dropping it.
  damage(e, amount, blastFrom = null) {
    if (!e.alive) return false;
    if (e.invuln) return false; // (the mech, mid-overload)
    if (e.dazed > 0) amount *= e.stats.dazeTaken || 1;
    // the mech doesn't just go: blasts all over it, pieces torn off, then
    // it comes apart
    if (e.stats.spider && e.hp - amount <= 0 && !e.dying) {
      e.hp = 1;
      e.dying = 1.8;
      e.invuln = true;
      e.hold = true;
      e.charge = 0;
      e.artyLeft = 0;
      e.funnel.visible = false;
      if (e.warn) e.warn.visible = false;
      this.clearShells(e);
      e.model.hitFlash();
      return false;
    }
    if (e.markT > 0) amount *= 1.3; // spotted (Spotter): takes extra
    e.hp -= amount;
    e.model.hitFlash();
    if (e.hp > 0) return false;
    this.kill(e, blastFrom);
    return true;
  }

  kill(e, blastFrom = null) {
    e.alive = false;
    this.clearShells(e);
    e.markMesh?.removeFromParent();
    e.warn?.removeFromParent();
    e.warnLine?.removeFromParent();
    e.markMesh = null;
    e.funnel.visible = false;
    e.burstLeft = 0;
    e.windup = 0;
    e.model.group.traverse((o) => o.layers.disable(ENEMY_LAYER)); // wrecks lose the outline
    e.model.kill(e.ground ?? 0);
    e.hit.removeFromParent();
    this.killed++;
    this.combat.machineDeath(new THREE.Vector3(e.pos.x, 0.6 * e.stats.scale, e.pos.z));
    if (e.stats.scale > 1.5) {
      // the big one goes up in a chain of blasts
      for (let i = 0; i < 3; i++) this.combat.explode(new THREE.Vector3(e.pos.x + (Math.random() - 0.5) * 2, 0.8 + Math.random(), e.pos.z + (Math.random() - 0.5) * 1.5));
    }
    // the bridge gun: blown to pieces, however it died (no wreck left
    // standing to block the way)
    if (e.stats.shatterOnDeath) {
      this.shatter(e, new THREE.Vector3(e.pos.x, -1, e.pos.z), 1.8);
      for (let i = 0; i < 4; i++) this.combat.explode(new THREE.Vector3(e.pos.x + (Math.random() - 0.5) * 3.5, 0.6 + Math.random() * 1.6, e.pos.z + (Math.random() - 0.5) * 3.5));
      this.combat.shake = Math.max(this.combat.shake, 0.8);
    } else if (blastFrom) this.shatter(e, blastFrom);
    this.onKill?.(e, !!blastFrom || !!e.stats.shatterOnDeath);
  }

  // Ram: machines the tank's box touches take damage and are thrown aside.
  // push: how hard they're shoved along the tank's way (Breakthrough
  // ploughs them ahead of it); stun: seconds they're knocked senseless.
  // Returns [{ e, amount, killed }].
  ram(tankBox, amount, tankVel, { push = 0.5, side = 5, stun = 0 } = {}) {
    const hits = [];
    const now = performance.now();
    for (const e of this.list) {
      if (!e.alive || e.delay > 0 || e.stats.flying || (e.rammedAt && now - e.rammedAt < 500)) continue; // (fliers are over the tank's head)
      const r = e.stats.box.hx + 0.3;
      // tank-local position of the machine
      const dx = e.pos.x - tankBox.x;
      const dz = e.pos.z - tankBox.z;
      const c = Math.cos(tankBox.yaw);
      const sn = Math.sin(tankBox.yaw);
      const lx = dx * c - dz * sn;
      const lz = dx * sn + dz * c;
      if (Math.abs(lx) > tankBox.hx + r || Math.abs(lz) > tankBox.hz + r) continue;
      e.rammedAt = now;
      const killed = this.damage(e, amount, e.stats.scale < 1.5 ? new THREE.Vector3(tankBox.x, 0, tankBox.z) : null);
      if (!killed && e.stats.scale < 1.5) {
        // knocked back: thrown along the way the tank's going and off to its side
        e.kb ??= new THREE.Vector3();
        e.kb.x += tankVel.x * push + Math.sign(lz || 1) * -sn * side;
        e.kb.z += tankVel.z * push + Math.sign(lz || 1) * -c * side;
        if (stun) {
          e.stun = Math.max(e.stun || 0, stun);
          e.windup = 0;
          e.burstLeft = 0;
        }
      }
      hits.push({ e, amount, killed });
    }
    return hits;
  }

  // The tank's body: machines it drives into are nudged out of its way
  // (they never stop it), harder the faster it's going.
  nudge(tankBox, tankVel) {
    const c = Math.cos(tankBox.yaw);
    const sn = Math.sin(tankBox.yaw);
    for (const e of this.list) {
      if (!e.alive || e.delay > 0 || e.stats.scale > 1.5 || e.stats.flying) continue;
      const r = e.stats.box.hx * 0.8;
      const dx = e.pos.x - tankBox.x;
      const dz = e.pos.z - tankBox.z;
      const lx = dx * c - dz * sn;
      const lz = dx * sn + dz * c;
      if (Math.abs(lx) > tankBox.hx + r || Math.abs(lz) > tankBox.hz + r) continue;
      // out the nearer side, plus a little of the tank's way
      const s = Math.sign(lz || 1);
      const k = 2 + Math.hypot(tankVel.x, tankVel.z) * 0.5;
      e.kb ??= new THREE.Vector3();
      e.kb.x += (-sn * s * k + tankVel.x * 0.15) * 0.3;
      e.kb.z += (-c * s * k + tankVel.z * 0.15) * 0.3;
    }
  }

  // Smoke (the light tank's Breakthrough): machines within radius lose
  // their aim: a wind-up or burst in progress is dropped, and they can't
  // lock on again for a moment.
  breakLocks(at, radius, blind = 1.2) {
    for (const e of this.list) {
      if (!e.alive || Math.hypot(e.pos.x - at.x, e.pos.z - at.z) > radius) continue;
      e.windup = 0;
      e.burstLeft = 0;
      e.charge = 0;
      e.fireTimer = Math.max(e.fireTimer, blind);
      e.blind = blind;
    }
  }

  // A shockwave: machines within radius are shoved away from its centre.
  shove(at, radius, dist) {
    for (const e of this.list) {
      if (!e.alive || e.delay > 0 || e.stats.scale > 1.5 || e.stats.flying) continue;
      const dx = e.pos.x - at.x;
      const dz = e.pos.z - at.z;
      const d = Math.hypot(dx, dz);
      if (d > radius || d < 0.01) continue;
      const k = dist * (1 - d / radius) + 0.3;
      e.pos.x += (dx / d) * k;
      e.pos.z += (dz / d) * k;
    }
  }

  // Blow a machine into its parts: every mesh becomes a loose piece thrown
  // away from the blast, tumbling, bouncing and settling on the ground.
  shatter(e, from, power = 1) {
    const g = e.model.group;
    g.updateWorldMatrix(true, true);
    const meshes = [];
    g.traverse((m) => m.isMesh && m.visible && meshes.push(m));
    for (const m of meshes) {
      this.scene.attach(m);
      const p = m.position;
      const away = new THREE.Vector3(p.x - from.x, 0, p.z - from.z);
      if (away.lengthSq() < 0.01) away.set(Math.random() - 0.5, 0, Math.random() - 0.5);
      away.normalize().multiplyScalar((3 + Math.random() * 5) * power);
      if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
      const r = m.geometry.boundingSphere.radius * Math.max(m.scale.x, m.scale.y, m.scale.z);
      this.parts.push({
        m,
        vel: new THREE.Vector3(away.x + (Math.random() - 0.5) * 2, (4 + Math.random() * 5) * Math.sqrt(power), away.z + (Math.random() - 0.5) * 2),
        spin: new THREE.Vector3((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16),
        r: Math.min(0.25, r * 0.6),
        rest: false,
      });
    }
    g.visible = false;
    if (this.parts.length > 400) {
      for (const p of this.parts.splice(0, this.parts.length - 400)) p.m.removeFromParent();
    }
  }

  updateParts(dt, heightAt) {
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    for (const p of this.parts) {
      if (p.rest) continue;
      p.vel.y -= 18 * dt;
      p.m.position.addScaledVector(p.vel, dt);
      q.setFromEuler(e.set(p.spin.x * dt, p.spin.y * dt, p.spin.z * dt));
      p.m.quaternion.multiply(q);
      const floor = (heightAt ? heightAt(p.m.position.x, p.m.position.z) : 0) + p.r * 0.5;
      if (p.m.position.y < floor) {
        p.m.position.y = floor;
        p.vel.y = Math.abs(p.vel.y) * 0.3;
        p.vel.x *= 0.55;
        p.vel.z *= 0.55;
        p.spin.multiplyScalar(0.5);
        if (p.vel.lengthSq() < 0.4) p.rest = true;
      }
    }
  }

  // Cannon splash. Returns [{ e, amount, killed }] for every machine hit.
  blast(at, radius, amount, skip = null) {
    const hits = [];
    for (const e of this.list) {
      if (!e.alive || e.delay > 0 || e === skip) continue;
      const d = Math.hypot(e.pos.x - at.x, e.pos.z - at.z);
      if (d >= radius) continue;
      const dmg = Math.round(amount * (d < radius * 0.5 ? 1 : 0.6));
      hits.push({ e, amount: dmg, killed: this.damage(e, dmg, at) });
    }
    return hits;
  }

  // ctx: { tankPos, blocks, heightAt, onTankHit(damage, point) }
  update(dt, t, ctx) {
    const { tankPos, blocks } = ctx;
    this.updateParts(dt, ctx.heightAt);
    // the run's over (won, or the tank's gone up): nobody fires any more
    if (ctx.over) for (const e of this.list) Object.assign(e, { windup: 0, burstLeft: 0, charge: 0, fireTimer: Math.max(e.fireTimer || 0, 1) });
    this.updateBolts(dt, ctx);
    for (const e of this.list) {
      if (e.delay > 0) {
        e.delay -= dt;
        if (e.delay <= 0) e.model.group.visible = true;
        continue;
      }
      if (!e.alive) {
        e.model.update(dt, t);
        continue;
      }
      const DOG = e.stats;
      const dx = tankPos.x - e.pos.x;
      const dz = tankPos.z - e.pos.z;
      const dist = Math.hypot(dx, dz) || 1;
      const tx = dx / dist;
      const tz = dz / dist;
      // line of sight to the tank, checked a few times a second
      e.losT -= dt;
      if (e.losT <= 0) {
        e.losT = 0.25;
        const gy = ctx.heightAt ? ctx.heightAt(e.pos.x, e.pos.z) : 0;
        const ty = ctx.heightAt ? ctx.heightAt(tankPos.x, tankPos.z) : 0;
        const eyeY = e.stats.flying ? e.pos.y : gy + 0.9 * e.stats.scale; // (a flier looks down from up there, over low cover)
        e.los = !sightBlocked(new THREE.Vector3(e.pos.x, eyeY, e.pos.z), new THREE.Vector3(tankPos.x, ty + 1.0, tankPos.z), ctx.colliders);
      }

      if (DOG.flying) {
        this.droneFrame(e, dt, t, ctx, dist);
        continue;
      }

      // where to go: close in to rifle range, then circle-strafe; back off
      // if the tank gets too close
      let vx = 0;
      let vz = 0;
      let speed = 0;
      if (e.via.length) {
        const w = e.via[0];
        const wx = w.x - e.pos.x;
        const wz = w.z - e.pos.z;
        if (Math.hypot(wx, wz) < 1.2) e.via.shift();
        vx = wx;
        vz = wz;
        speed = DOG.runSpeed;
      } else if (dist > DOG.range || !e.los) {
        // closing in, or something's in the way: keep moving, edging round it
        vx = tx + (e.los ? 0 : -tz * e.strafe * 0.9);
        vz = tz + (e.los ? 0 : tx * e.strafe * 0.9);
        speed = DOG.runSpeed;
      } else {
        e.strafeTimer -= dt;
        if (e.strafeTimer <= 0) {
          e.strafe *= -1;
          e.strafeTimer = 1.2 + Math.random() * 1.4;
        }
        vx = -tz * e.strafe;
        vz = tx * e.strafe;
        if (dist < DOG.tooClose) {
          vx -= tx * 1.5;
          vz -= tz * 1.5;
        }
        speed = DOG.walkSpeed;
      }
      if (e.sidestep > 0) {
        // stuck on something: slide sideways for a moment
        e.sidestep -= dt;
        const s = e.strafe;
        vx = -tz * s + tx * 0.3;
        vz = tx * s + tz * 0.3;
        speed = DOG.runSpeed * 0.7;
      }
      if (DOG.sniper && (e.charge > 0 || DOG.static)) speed = 0; // planted while it lines up a shot
      if (e.hold) speed = 0; // (the mech: down, or planted for / in a dash)
      const len = Math.hypot(vx, vz) || 1;
      const before = e.pos.clone();
      if (e.stun > 0) {
        e.stun -= dt;
        speed = 0; // knocked senseless: it just stands there
      }
      e.pos.x += (vx / len) * speed * dt;
      e.pos.z += (vz / len) * speed * dt;
      // knockback, dying away
      if (e.kb) {
        e.pos.addScaledVector(e.kb, dt);
        e.kb.multiplyScalar(Math.exp(-dt * 6));
        if (e.kb.lengthSq() < 0.01) e.kb = null;
      }
      if (e.markT > 0) e.markT -= dt;
      // the Spotter's mark: a white diamond spinning over it
      // Ranging's mark: a reticle on it, hard to miss: a ring on the ground
      // round it, four brackets closing in and turning, a diamond over it
      if (e.markT > 0 && !e.markMesh) {
        const mat = new THREE.MeshBasicMaterial({ color: 0xff9a3a, transparent: true, depthWrite: false });
        const g = new THREE.Group();
        const r = Math.max(1, (e.stats.box?.hx || 0.6) * 1.5);
        const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.12, 32).rotateX(-Math.PI / 2), mat);
        ring.position.y = 0.06;
        g.add(ring);
        const br = new THREE.Group();
        br.position.y = 0.08;
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          for (const [w, d, dx, dz] of [[0.55, 0.12, 0, 0.22], [0.12, 0.55, 0.22, 0]]) {
            const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), mat);
            const k = new THREE.Group();
            k.rotation.y = -a + Math.PI / 4;
            k.position.set(Math.cos(a) * (r + 0.5), 0, Math.sin(a) * (r + 0.5));
            b.position.set(-dx, 0, -dz);
            k.add(b);
            br.add(k);
          }
        }
        g.add(br);
        const dia = new THREE.Mesh(new THREE.OctahedronGeometry(0.32), mat);
        g.add(dia);
        g.userData = { br, dia, mat, r };
        e.markMesh = g;
        this.scene.add(g);
      }
      if (e.markMesh) {
        const m = e.markMesh.userData;
        e.markMesh.visible = e.markT > 0;
        e.markMesh.position.set(e.pos.x, e.pos.y || 0, e.pos.z);
        m.dia.position.y = 2.4 * e.stats.scale + Math.sin(t * 4) * 0.1;
        m.dia.rotation.y = t * 3;
        m.br.rotation.y = t * 1.2;
        m.br.scale.setScalar(1 + Math.max(0, 0.6 - (5 - e.markT)) * 1.2); // (closing in as it's marked)
        m.mat.opacity = Math.min(1, e.markT * 2) * (0.75 + Math.sin(t * 8) * 0.25);
      }
      // keep out of walls, wrecks and each other
      if (!DOG.static && !(e.noclip && e.via.length) && e.stage2 !== 'dash' && e.stage2 !== 'plant') pushOut(e.pos, () => ({ x: e.pos.x, z: e.pos.z, hx: DOG.box.hx, hz: DOG.box.hz, yaw: e.model.group.rotation.y }), blocks, 1);
      for (const o of DOG.static ? [] : this.list) {
        if (o === e || !o.alive || o.delay > 0) continue;
        const ox = e.pos.x - o.pos.x;
        const oz = e.pos.z - o.pos.z;
        const d = Math.hypot(ox, oz);
        const min = 0.55 * (e.stats.scale + o.stats.scale);
        if (d < min && d > 0.001) {
          e.pos.x += (ox / d) * (min - d) * 0.5;
          e.pos.z += (oz / d) * (min - d) * 0.5;
        }
      }
      const moved = Math.hypot(e.pos.x - before.x, e.pos.z - before.z);
      e.speed += ((moved / Math.max(dt, 1e-4)) / DOG.runSpeed - e.speed) * Math.min(1, dt * 8);
      if (speed > 0 && moved < speed * dt * 0.25) {
        e.stuck += dt;
        if (e.stuck > 0.4) {
          e.sidestep = 0.7;
          e.stuck = 0;
          e.strafe *= -1;
        }
      } else e.stuck = 0;

      // the body always faces the way it walks (no sliding sideways); the
      // head and rifle turn to keep the tank in their sights
      const facing = moved > 0.002 && !DOG.static ? Math.atan2(-(e.pos.z - before.z), e.pos.x - before.x) : e.model.group.rotation.y;
      const g = e.model.group;
      let diff = facing - g.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      g.rotation.y += diff * Math.min(1, dt * (DOG.turnRate || 8));
      // the rifle holds on the locked line while it winds up and fires
      const locked = e.lock && (e.windup > 0 || e.burstLeft > 0);
      let aimYaw = (DOG.sniper && e.charge > 0 ? e.lockYaw : locked ? Math.atan2(-(e.lock.z - e.pos.z), e.lock.x - e.pos.x) : Math.atan2(-tz, tx)) - g.rotation.y;
      aimYaw = Math.atan2(Math.sin(aimYaw), Math.cos(aimYaw));
      if (DOG.sniper) {
        if (DOG.spider) {
          this.spiderWeapons(e, dt, t, ctx, dist);
          if (this.mechStage2(e, dt, t, ctx, dist, aimYaw)) continue;
        }
        this.sniperFrame(e, dt, t, ctx, dist, aimYaw);
        continue;
      }

      // shooting: in range, it locks onto where the tank is (and a little of
      // where it's heading), shows a red funnel while it winds up, then fires
      // a burst of real rounds down that line. Drive out of the funnel and
      // they miss.
      e.recoil = Math.max(0, e.recoil - dt * 8);
      e.fireTimer -= dt;
      if (e.windup > 0 && !e.los) {
        e.windup = 0; // lost sight of it: no shot (never fires into a wall)
        e.fireTimer = 0.3;
      }
      if (e.blind > 0) e.blind -= dt;
      if (e.burstLeft <= 0 && e.windup <= 0 && e.fireTimer <= 0 && dist < DOG.range + 1.5 && e.los && !(e.blind > 0) && !(e.stun > 0)) {
        e.windup = DOG.windup;
        const lead = ctx.tankVel || { x: 0, z: 0 };
        e.lock = new THREE.Vector3(tankPos.x + lead.x * 0.2, 0, tankPos.z + lead.z * 0.2);
      }
      if (e.windup > 0) {
        e.windup -= dt;
        if (e.windup <= 0) {
          e.burstLeft = DOG.burst;
          e.fireTimer = 0;
        }
      }
      if (e.burstLeft > 0 && e.fireTimer <= 0) {
        e.burstLeft--;
        e.fireTimer = e.burstLeft > 0 ? DOG.burstGap : DOG.reload + Math.random() * 0.6;
        e.recoil = 1;
        const from = e.model.muzzle();
        const dir = new THREE.Vector3(e.lock.x - from.x, 0, e.lock.z - from.z).normalize();
        dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * 2 * DOG.spread);
        const reach = Math.hypot(e.lock.x - from.x, e.lock.z - from.z) + 6;
        const time = reach / DOG.boltSpeed;
        const vel = dir.multiplyScalar(DOG.boltSpeed);
        vel.y = (tankPos.y + 0.25 - from.y) / time; // dipping down to hit the ground past the target
        this.bolts.push({ pos: from.clone(), origin: from.clone(), vel, life: time, damage: DOG.damage });
        this.combat.glow.flash(from, 0xff6a3a, 0.06, 0.3, 0.05);
        this.combat.glow.light(from, 0xff4a30, 6, 0.06);
        if (e.stats.scale > 1.5) this.combat.shake = Math.max(this.combat.shake, 0.05);
      }
      // the funnel: brightening through the wind-up, flaring on the burst
      const showing = e.windup > 0 || e.burstLeft > 0;
      e.funnelK = showing ? 1 : Math.max(0, e.funnelK - dt * 6); // on at once, quick to fade after
      e.funnel.visible = e.funnelK > 0.02 && !!e.lock;
      if (e.funnel.visible) {
        const from = e.model.muzzle();
        const len = Math.hypot(e.lock.x - from.x, e.lock.z - from.z) + 3;
        const width = Math.tan(DOG.spread) * 2 * len + 0.9 * e.stats.scale;
        e.funnel.position.set(from.x, (ctx.heightAt ? ctx.heightAt(from.x, from.z) : 0) + 0.06, from.z);
        e.funnel.rotation.y = Math.atan2(-(e.lock.z - from.z), e.lock.x - from.x);
        e.funnel.scale.set(len, 1, width);
        const pulse = e.windup > 0 ? 0.5 + 0.5 * Math.sin((1 - e.windup / DOG.windup) * Math.PI * 6) : 1;
        e.funnel.material.opacity = e.funnelK * (e.windup > 0 ? 0.22 + 0.25 * pulse * (1 - e.windup / DOG.windup) : 0.5);
        e.funnelEdge.material.opacity = e.funnelK * (e.windup > 0 ? 0.65 + 0.35 * pulse : 1);
      }
      e.pos.y = ctx.heightAt ? ctx.heightAt(e.pos.x, e.pos.z) : 0;
      e.model.update(dt, t, { speed: Math.min(1, e.speed), aimYaw, aimPitch: 0.05, recoil: e.recoil });
    }
  }

  // The drone: dart to a spot near the tank, and when it's ready to shoot,
  // hang there, glow, and fire the salvo; then dart off again.
  droneFrame(e, dt, t, ctx, dist) {
    const S = e.stats;
    const { tankPos } = ctx;
    const ground = ctx.heightAt ? ctx.heightAt(e.pos.x, e.pos.z) : 0;
    e.fireTimer -= dt;
    if (e.blind > 0) e.blind -= dt;
    const pickSpot = (far = false) => {
      // round the tank, a fair way off, not too far round from where it is
      const from = Math.atan2(e.pos.z - tankPos.z, e.pos.x - tankPos.x);
      const a = from + (Math.random() - 0.5) * (far ? 2.4 : 1.4);
      const r = S.orbit[0] + Math.random() * (S.orbit[1] - S.orbit[0]);
      e.spot = { x: tankPos.x + Math.cos(a) * r, z: tankPos.z + Math.sin(a) * r };
      e.hold = 0.2 + Math.random() * 0.4;
    };
    if (!e.spot) pickSpot();
    let vx = 0;
    let vz = 0;
    let want = 0;
    if (e.via.length) {
      const w = e.via[0];
      vx = w.x - e.pos.x;
      vz = w.z - e.pos.z;
      if (Math.hypot(vx, vz) < 1.2) e.via.shift();
      want = S.runSpeed;
    } else if (e.windup > 0 || e.burstLeft > 0) {
      want = 0; // hanging there to shoot
    } else {
      vx = e.spot.x - e.pos.x;
      vz = e.spot.z - e.pos.z;
      const d = Math.hypot(vx, vz);
      if (d < 0.6) {
        e.hold -= dt;
        if (e.hold <= 0) pickSpot();
      } else want = Math.min(S.runSpeed, 2 + d * 2);
      // too far from the tank (it drove off): a new spot near it
      if (dist > S.orbit[1] + 6 && Math.random() < dt) pickSpot();
    }
    if (e.stun > 0) {
      e.stun -= dt;
      want = 0;
    }
    // a quick, darting flyer: speeds up and stops sharply
    const len = Math.hypot(vx, vz) || 1;
    e.vel ??= new THREE.Vector3();
    e.vel.x += ((vx / len) * want - e.vel.x) * Math.min(1, dt * 5);
    e.vel.z += ((vz / len) * want - e.vel.z) * Math.min(1, dt * 5);
    e.pos.x += e.vel.x * dt;
    e.pos.z += e.vel.z * dt;
    if (e.kb) {
      e.pos.addScaledVector(e.kb, dt);
      e.kb.multiplyScalar(Math.exp(-dt * 6));
      if (e.kb.lengthSq() < 0.01) e.kb = null;
    }
    // up at its flying height (it drops in from above): over the ground
    // under it, and never below the tank's (a tank up on a highway deck has
    // them climbing up to it, never hanging underneath)
    let floor = ground;
    for (const [dx, dz] of [[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]]) floor = Math.max(floor, ctx.heightAt ? ctx.heightAt(e.pos.x + dx, e.pos.z + dz) : 0);
    const fly = Math.max(floor, tankPos.y) + S.fly;
    const rate = fly > e.pos.y ? 2.2 : 1.4;
    e.pos.y += (fly - e.pos.y) * Math.min(1, dt * rate);
    e.ground = ground;
    // the shot: in range and in sight, it stops, glows, then fires
    if (e.windup <= 0 && e.burstLeft <= 0 && e.fireTimer <= 0 && !e.via.length && dist < S.range && e.los && !(e.blind > 0) && !(e.stun > 0)) {
      e.windup = S.windup;
      e.lock = new THREE.Vector3(tankPos.x, 0, tankPos.z);
    }
    if (e.windup > 0) {
      e.windup -= dt;
      e.lock.set(tankPos.x, 0, tankPos.z); // it watches the tank right up to the first rocket
      if (e.blind > 0 || e.stun > 0) e.windup = 0;
      else if (e.windup <= 0) {
        e.burstLeft = S.salvo;
        e.fireTimer = 0;
      }
    }
    if (e.burstLeft > 0 && e.fireTimer <= 0) {
      e.burstLeft--;
      e.fireTimer = e.burstLeft > 0 ? S.salvoGap : S.reload + Math.random() * 1.2;
      // each rocket at where the tank is as it launches (a little scatter)
      const from = e.model.muzzle();
      const aim = new THREE.Vector3(tankPos.x + (Math.random() - 0.5) * 0.8, tankPos.y + 0.9, tankPos.z + (Math.random() - 0.5) * 0.8);
      const to = aim.clone().sub(from);
      const time = to.length() / S.rocketSpeed;
      // past the aim point, on into the ground behind it
      const vel = to.multiplyScalar(1 / time);
      const mesh = droneRocket();
      mesh.position.copy(from);
      this.scene.add(mesh);
      this.bolts.push({ pos: from.clone(), origin: from.clone(), vel, life: time * 1.6, damage: S.damage, rocket: mesh });
      this.combat.glow.flash(from, 0xffb070, 0.12, 0.7, 0.06);
      this.combat.puffs.spawn(from, new THREE.Vector3((Math.random() - 0.5) * 1.5, 0.6, (Math.random() - 0.5) * 1.5), { color: 0xb8b2a6, s0: 0.12, s1: 0.4, life: 0.5, drag: 3, lift: 0.4, fadeAt: 0.3 });
      // salvo done: dart off somewhere else
      if (e.burstLeft === 0) pickSpot(true);
    }
    // the funnel: where the salvo's going, while it lines up
    const showing = e.windup > 0 || e.burstLeft > 0;
    e.funnelK = showing ? 1 : Math.max(0, e.funnelK - dt * 6);
    e.funnel.visible = e.funnelK > 0.02 && !!e.lock;
    if (e.funnel.visible) {
      const len2 = Math.hypot(e.lock.x - e.pos.x, e.lock.z - e.pos.z) + 2;
      e.funnel.position.set(e.pos.x, ground + 0.06, e.pos.z);
      e.funnel.rotation.y = Math.atan2(-(e.lock.z - e.pos.z), e.lock.x - e.pos.x);
      e.funnel.scale.set(len2, 1, 1.6);
      const k = e.windup > 0 ? 1 - e.windup / S.windup : 1;
      e.funnel.material.opacity = e.funnelK * (0.2 + 0.3 * k);
      e.funnelEdge.material.opacity = e.funnelK * (0.6 + 0.4 * k);
    }
    // facing: where it's flying, the body turning to the tank
    const g = e.model.group;
    const moving = Math.hypot(e.vel.x, e.vel.z);
    if (moving > 0.3) {
      let diff = Math.atan2(-e.vel.z, e.vel.x) - g.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      g.rotation.y += diff * Math.min(1, dt * 8);
    }
    let aimYaw = Math.atan2(-(tankPos.z - e.pos.z), tankPos.x - e.pos.x) - g.rotation.y;
    aimYaw = Math.atan2(Math.sin(aimYaw), Math.cos(aimYaw));
    e.speed = moving / S.runSpeed;
    const charge = e.windup > 0 ? 1 - e.windup / S.windup : e.burstLeft > 0 ? 1 : 0;
    e.model.update(dt, t, { speed: e.speed, tilt: Math.min(0.35, moving * 0.05), aimYaw, charge, height: e.pos.y - ground });
  }

  // The walker and the bridge gun: line up, then fire a beam.
  sniperFrame(e, dt, t, ctx, dist, aimYaw) {
    const S = e.stats;
    const { tankPos } = ctx;
    e.recoil = Math.max(0, e.recoil - dt * 3);
    e.fireTimer -= dt;
    if (e.blind > 0) e.blind -= dt;
    const want = Math.atan2(-(tankPos.z - e.pos.z), tankPos.x - e.pos.x);
    if (e.charge > 0) {
      // its aim creeps after the tank, until the last moment when it holds
      // still: keep moving across the line and it misses
      if (e.charge > S.lock) {
        let d = want - e.lockYaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        e.lockYaw += THREE.MathUtils.clamp(d, -S.track * dt, S.track * dt);
      }
      e.lostT = e.los ? 0 : (e.lostT || 0) + dt;
      e.charge -= dt;
      if (e.blind > 0 || e.stun > 0 || e.lostT > 0.6) {
        e.charge = 0; // lost it: the shot's spoiled
        e.fireTimer = 1.2;
      } else if (e.charge <= 0) {
        e.shotSinceDash = true;
        if (S.kinetic) this.fireShell(e, ctx);
        else this.fireBeam(e, ctx);
      }
    } else if (e.fireTimer <= 0 && dist < S.range && e.los && !(e.blind > 0) && !(e.stun > 0)) {
      e.charge = S.charge;
      e.lockYaw = want;
      e.lostT = 0;
    }
    // the funnel: wide at first, narrowing to a line, blinking white faster
    // and faster as the shot comes
    const k = e.charge > 0 ? 1 - e.charge / S.charge : 0;
    e.funnelK = e.charge > 0 ? 1 : Math.max(0, e.funnelK - dt * 6);
    e.funnel.visible = e.funnelK > 0.02;
    if (e.funnel.visible) {
      const from = e.model.muzzle();
      const len = this.beamLength(e, from, ctx.colliders, S.range + 4);
      const width = THREE.MathUtils.lerp(Math.tan(0.22) * 2 * len, 0.25, Math.min(1, k * 1.15));
      e.funnel.position.set(from.x, (ctx.heightAt ? ctx.heightAt(from.x, from.z) : 0) + 0.06, from.z);
      e.funnel.rotation.y = e.lockYaw;
      e.funnel.scale.set(len, 1, width);
      const freq = 2 + k * k * 16;
      const white = (e.charge > 0 && e.charge <= S.lock) || (Math.sin(t * freq * Math.PI * 2) > 0 && k > 0.15); // solid white: locked, about to fire
      e.funnel.material.color.set(white ? 0xffffff : 0xff3b2f);
      e.funnelEdge.material.color.set(white ? 0xffffff : 0xff2a1a);
      e.funnel.material.opacity = e.funnelK * (0.2 + 0.3 * k);
      e.funnelEdge.material.opacity = e.funnelK * (0.7 + 0.3 * k);
    }
    e.pos.y = ctx.heightAt ? ctx.heightAt(e.pos.x, e.pos.z) : 0;
    // the barrel dips to lay on the hull
    const pitch = -Math.atan2(Math.max(0, (S.muzzleY || 1.8) - HULL_Y), Math.max(4, dist));
    e.model.update(dt, t, { speed: Math.min(1, e.speed), aimYaw, aimPitch: pitch, recoil: e.recoil, charge: k, rockets: e.rocketK || 0, ...e.mctx });
  }

  // The mech's rocket artillery, on top of its main gun (sniperFrame):
  // the side launchers glow, then a volley goes up; each rocket flies a
  // high arc that comes down exactly on its red ring (round the tank and
  // where it's heading). Drive out of the rings.
  spiderWeapons(e, dt, t, ctx, dist) {
    const S = e.stats;
    const { tankPos } = ctx;
    if (e.stage2) return; // (stage 2: no artillery)
    const pace = 1;
    e.artyT = (e.artyT ?? 3) - dt;
    const gy = (x, z) => (ctx.heightAt ? ctx.heightAt(x, z) : 0);
    if (e.artyT <= 0 && !(e.charge > 0) && !(e.artyLeft > 0) && !ctx.over && dist < S.range + 8) {
      e.artyT = S.artyEvery * pace;
      e.artyWind = 0.7;
      // the volley's rings: one on the tank, one where it's heading, the
      // rest scattered round them
      const lead = ctx.tankVel || { x: 0, z: 0 };
      e.artyAt = [];
      for (let i = 0; i < S.artyRockets; i++) {
        const ahead = i % 2 ? 1.4 : 0;
        const a = Math.random() * Math.PI * 2;
        const r = i < 2 ? 0 : 2 + Math.random() * 3;
        const x = tankPos.x + lead.x * ahead + Math.cos(a) * r;
        const z = tankPos.z + lead.z * ahead + Math.sin(a) * r;
        e.artyAt.push(new THREE.Vector3(x, gy(x, z), z));
      }
      e.artyLeft = S.artyRockets;
      e.artyGap = 0;
    }
    if (e.artyWind > 0) e.artyWind -= dt;
    e.rocketK = e.artyWind > 0 || e.artyLeft > 0 ? 1 : 0;
    if (!(e.artyWind > 0) && e.artyLeft > 0) {
      e.artyGap -= dt;
      if (e.artyGap <= 0) {
        e.artyGap = 0.14;
        const at = e.artyAt[S.artyRockets - e.artyLeft];
        e.artyLeft--;
        const from = e.model.rocketMuzzle();
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
        ring.position.set(at.x, at.y + 0.07, at.z);
        ring.scale.setScalar(S.artyBlast);
        this.scene.add(ring);
        const dot = new THREE.Mesh(new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, opacity: 0.18, depthWrite: false }));
        dot.position.set(at.x, at.y + 0.06, at.z);
        this.scene.add(dot);
        const mesh = droneRocket();
        mesh.position.copy(from);
        this.scene.add(mesh);
        const total = THREE.MathUtils.lerp(S.artyFall[0], S.artyFall[1], Math.random());
        const apex = Math.max(from.y, at.y) + 5 + from.distanceTo(at) * 0.35;
        e.shells ??= [];
        e.shells.push({ from, at, ring, dot, mesh, t: 0, total, apex });
        this.combat.glow.flash(from, 0xffb070, 0.2, 1.1, 0.08);
        this.combat.puffs.spawn(from, new THREE.Vector3((Math.random() - 0.5) * 1.5, 1.2, (Math.random() - 0.5) * 1.5), { color: 0xb8b2a6, s0: 0.2, s1: 0.7, life: 0.8, drag: 2, lift: 0.8, fadeAt: 0.3 });
      }
    }
    // rockets in the air: along their arcs, onto their rings
    const arc = (sh, u) => {
      const p = sh.from.clone().lerp(sh.at, u);
      // a parabola from the launcher's height to the ring's, peaking at apex
      const base = THREE.MathUtils.lerp(sh.from.y, sh.at.y, u);
      const top = sh.apex - THREE.MathUtils.lerp(sh.from.y, sh.at.y, 0.5);
      p.y = base + 4 * top * u * (1 - u);
      return p;
    };
    for (let i = (e.shells?.length || 0) - 1; i >= 0; i--) {
      const sh = e.shells[i];
      sh.t += dt;
      const u = Math.min(1, sh.t / sh.total);
      const p = arc(sh, u);
      const ahead = arc(sh, Math.min(1, u + 0.02));
      sh.mesh.position.copy(p);
      if (ahead.distanceToSquared(p) > 1e-6) {
        sh.mesh.lookAt(ahead);
        sh.mesh.rotateY(-Math.PI / 2);
      }
      sh.mesh.userData.flame.scale.set(0.75 + Math.random() * 0.5, 1, 1);
      if (sh.last) this.combat.glow.tracer(sh.last, p, 0xffc070, 0.16, 0.16);
      if (Math.random() < 0.6) this.combat.puffs.spawn(p.clone(), new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.2, (Math.random() - 0.5) * 0.5), { color: 0xd0cabe, s0: 0.12, s1: 0.5, life: 0.7, drag: 2, lift: 0.2, fadeAt: 0.2 });
      sh.last = p;
      // the ring tightens and blinks faster as it comes down
      sh.ring.scale.setScalar(S.artyBlast * (1 + 0.35 * (1 - u)));
      sh.ring.material.opacity = Math.sin(t * (10 + u * 30)) > 0 ? 0.95 : 0.45;
      sh.dot.scale.setScalar(S.artyBlast * u);
      if (u >= 1) {
        sh.ring.removeFromParent();
        sh.dot.removeFromParent();
        sh.mesh.removeFromParent();
        e.shells.splice(i, 1);
        const at = sh.at.clone().setY(sh.at.y + 0.2);
        this.combat.explode(at);
        this.combat.shake = Math.max(this.combat.shake, 0.25);
        const tb = ctx.tankBox;
        if (tb && !ctx.over && Math.hypot(at.x - tb.x, at.z - tb.z) < S.artyBlast + Math.max(tb.hx, tb.hz) * 0.5) ctx.onTankHit?.(S.artyDamage, at);
      }
    }
  }
  // The mech's second stage. At half health it goes down: legs limp,
  // lights flickering out (it can't be hurt meanwhile), then the lights come
  // back, armour flaps swing open over glowing vents, an engine on its back.
  // From then on: a quicker gun, and dashes: it plants, a red path shows
  // from it through the tank to the wall, then it charges down it; at the
  // wall it's stunned a moment (and takes extra damage).
  // Returns true while it has the frame to itself (down, planted, dashing).
  mechStage2(e, dt, t, ctx, dist, aimYaw) {
    const S = e.stats;
    const gy = (x, z) => (ctx.heightAt ? ctx.heightAt(x, z) : 0);
    const own = (mctx) => {
      e.mctx = mctx;
      e.pos.y = gy(e.pos.x, e.pos.z);
      e.model.update(dt, t, { speed: mctx.dash ? 3 : 0, aimYaw, aimPitch: 0, recoil: e.recoil, charge: 0, ...mctx });
      return true;
    };
    const hull = (spread = 2.2) => new THREE.Vector3(e.pos.x + (Math.random() - 0.5) * spread * 1.6, 1.4 + Math.random() * 1.4, e.pos.z + (Math.random() - 0.5) * spread);
    // dying: a string of blasts over the hull, pieces flung off, then apart
    if (e.dying > 0) {
      e.dying -= dt;
      if (Math.random() < dt * 7) {
        const at = hull();
        this.combat.explode(at);
        this.fling(e, at, 1 + ((Math.random() * 2) | 0));
        this.combat.shake = Math.max(this.combat.shake, 0.45);
      }
      if (e.dying <= 0) {
        e.invuln = false;
        e.dying = -1;
        this.kill(e, null);
        return true;
      }
      return own({ ...e.mctx, dark: Math.random() < 0.4, dash: false });
    }
    if (!e.stage2 && e.hp < e.maxHp * 0.5) {
      e.stage2 = 'down';
      e.st = 0;
      e.invuln = true;
      e.hold = true;
      e.charge = 0;
      e.funnel.visible = false;
      this.clearShells(e);
      this.onStage?.(e);
    }
    if (!e.stage2) return false;
    e.st += dt;
    if (e.stage2 === 'down') {
      // slump, flicker out, dark, lights back on, stand, open up
      const T = e.st;
      // knocked out: blasts across the hull, then it drops like a dead weight
      if (T < 0.7 && Math.random() < dt * 9) {
        const at = hull();
        this.combat.explode(at);
        this.combat.shake = Math.max(this.combat.shake, 0.5);
      }
      if (T >= 0.55 && !e.thudDone) {
        e.thudDone = true;
        this.combat.shake = Math.max(this.combat.shake, 0.9);
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          this.combat.puffs.spawn(new THREE.Vector3(e.pos.x + Math.cos(a) * 3, 0.3, e.pos.z + Math.sin(a) * 3), new THREE.Vector3(Math.cos(a) * 4, 0.6, Math.sin(a) * 4), { color: 0x9a948a, s0: 0.5, s1: 1.8, life: 1.2, drag: 3, lift: 0.3, fadeAt: 0.3 });
        }
      }
      const dark = T < 0.6 ? Math.random() < 0.5 : T < 2.2 ? Math.random() < 0.15 + (T - 0.6) * 0.5 : T < 3.2;
      if (T > 0.3 && T < 0.4) this.combat.puffs.spawn(e.pos.clone().setY(1), new THREE.Vector3(0, 1, 0), { color: 0x8f8b84, s0: 0.6, s1: 2, life: 1.2, drag: 2, lift: 0.5, fadeAt: 0.3 });
      if (T > 3.6 && Math.random() < dt * 20) this.combat.puffs.spawn(e.pos.clone().setY(1.8), new THREE.Vector3((Math.random() - 0.5) * 3, 1.5, (Math.random() - 0.5) * 3), { color: 0xd0cabe, s0: 0.2, s1: 0.8, life: 0.8, drag: 2, lift: 0.8, fadeAt: 0.3 }); // venting steam
      if (T >= 4.8) {
        e.stage2 = 'fight';
        e.invuln = false;
        e.hold = false;
        e.stats = { ...S, charge: S.charge2 };
        e.fireTimer = 1.2;
        e.dashT = 3;
        e.shotSinceDash = true;
        e.mctx = { open: true };
        return false;
      }
      return own({ limp: T > 0.15 && T < 3.4, dark, open: T > 3.6 });
    }
    // planted, the path showing
    if (e.stage2 === 'plant') {
      const k = e.st / S.dashPlant;
      e.warn.material.opacity = (0.25 + 0.25 * k) * (Math.sin(t * (14 + k * 30)) > 0 ? 1 : 0.55);
      e.model.group.rotation.y = Math.atan2(-e.dashDir.z, e.dashDir.x);
      if (e.st >= S.dashPlant) {
        e.stage2 = 'dash';
        e.st = 0;
        e.dashGone = 0;
        e.dashHit = false;
        this.combat.shake = Math.max(this.combat.shake, 0.3);
      }
      this.mechExhaust(e, dt, 0.25 + 0.5 * (e.st / S.dashPlant)); // (spooling up)
      return own({ open: true, dash: e.st > S.dashPlant - 0.3 });
    }
    if (e.stage2 === 'dash') {
      const step = Math.min(S.dashSpeed * dt, e.dashLen - e.dashGone);
      e.pos.addScaledVector(e.dashDir, step);
      e.dashGone += step;
      if (Math.random() < 0.7) this.combat.puffs.spawn(e.pos.clone().addScaledVector(e.dashDir, -2.5).setY(0.6), new THREE.Vector3((Math.random() - 0.5) * 2, 0.6, (Math.random() - 0.5) * 2), { color: 0x8f8b84, s0: 0.4, s1: 1.4, life: 0.8, drag: 2, lift: 0.4, fadeAt: 0.3 });
      // running the tank down
      const tb = ctx.tankBox;
      if (tb && !e.dashHit && !ctx.over) {
        const rx = tb.x - e.pos.x;
        const rz = tb.z - e.pos.z;
        const along = rx * e.dashDir.x + rz * e.dashDir.z;
        const off = Math.abs(rx * e.dashDir.z - rz * e.dashDir.x);
        if (along > -2 && along < 3.2 && off < S.dashWidth / 2 + Math.max(tb.hx, tb.hz) * 0.6) {
          e.dashHit = true;
          ctx.onTankHit?.(S.dashDamage, new THREE.Vector3(tb.x, 1, tb.z));
          this.combat.shake = Math.max(this.combat.shake, 0.6);
        }
      }
      if (e.dashGone >= e.dashLen - 1e-3) {
        // into the wall: a crash, then it's stunned
        e.warn.visible = false;
        e.stage2 = 'fight';
        e.hold = false;
        e.dazed = S.daze;
        e.stun = S.daze;
        e.dashT = THREE.MathUtils.lerp(S.dashEvery[0], S.dashEvery[1], Math.random());
        e.shotSinceDash = false;
        const at = e.pos.clone().addScaledVector(e.dashDir, 2.6).setY(1);
        this.combat.explode(at);
        this.combat.fx.burst(at, { count: 30, speed: 8, color: 0xc9c2b4, life: 0.6, size: 0.12, gravity: 12 });
        this.combat.shake = Math.max(this.combat.shake, 0.7);
        return false;
      }
      this.mechExhaust(e, dt, 1);
      return own({ open: true, dash: true });
    }
    // fighting: count down to the next dash (only after a shot in between)
    if (e.dazed > 0) {
      e.dazed -= dt;
      if (Math.random() < dt * 12) this.combat.puffs.spawn(e.pos.clone().setY(2.2), new THREE.Vector3((Math.random() - 0.5), 1.2, (Math.random() - 0.5)), { color: 0x4a4744, s0: 0.3, s1: 1, life: 1, drag: 2, lift: 0.8, fadeAt: 0.3 });
    }
    e.dashT -= dt;
    if (e.dashT <= 0 && e.shotSinceDash && !(e.charge > 0) && !(e.dazed > 0) && e.los && !ctx.over) {
      const tp = ctx.tankPos;
      const dir = new THREE.Vector3(tp.x - e.pos.x, 0, tp.z - e.pos.z);
      if (dir.lengthSq() < 1) return false;
      dir.normalize();
      // the path: on until the wall
      let L = 2;
      while (L < 80 && (e.arena ? e.arena(e.pos.x + dir.x * (L + 0.5), e.pos.z + dir.z * (L + 0.5)) : L < 30)) L += 0.5;
      if (L < 6) {
        e.dashT = 1; // (too close to the wall that way: try again in a moment)
        return false;
      }
      e.dashDir = dir;
      e.dashLen = L;
      e.stage2 = 'plant';
      e.st = 0;
      e.hold = true;
      e.charge = 0;
      e.funnel.visible = false;
      if (!e.warn) {
        e.warn = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0.5, 0, 0), new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.4, depthWrite: false }));
        this.scene.add(e.warn);
      }
      e.warn.visible = true;
      e.warn.position.set(e.pos.x, gy(e.pos.x, e.pos.z) + 0.07, e.pos.z);
      e.warn.rotation.y = Math.atan2(-dir.z, dir.x);
      e.warn.scale.set(L + 2.5, 1, S.dashWidth);
      return own({ open: true });
    }
    return false;
  }
  // the dash engine burning: like our own rockets, a hot orange core at the
  // nozzles, grey smoke rolling out behind, sparks, its glow on the ground
  mechExhaust(e, dt, k) {
    const back = new THREE.Vector3(-Math.cos(e.model.group.rotation.y), 0, Math.sin(e.model.group.rotation.y));
    for (const n of e.model.engineNozzles()) {
      for (let i = 0; i < 4; i++) {
        if (Math.random() > k) continue;
        const smoke = i > 1;
        this.combat.puffs.spawn(n.clone().addScaledVector(back, 0.6 + Math.random() * 0.6), back.clone().multiplyScalar(5 + Math.random() * 5).add(new THREE.Vector3((Math.random() - 0.5) * 2.5, 0.8 + Math.random(), (Math.random() - 0.5) * 2.5)), {
          color: smoke ? [0x6b6a6f, 0x55545a, 0x807f84][(Math.random() * 3) | 0] : [0xffa040, 0xffc070, 0xff7a2a][(Math.random() * 3) | 0],
          s0: smoke ? 0.45 : 0.35,
          s1: smoke ? 1.1 + Math.random() * 0.6 : 0.8,
          life: smoke ? 1.1 + Math.random() * 0.6 : 0.25,
          drag: 2.5,
          lift: 0.9,
          fadeAt: 0.3,
        });
      }
      this.combat.glow.flash(n, 0xffd08a, 0.3, 1.6 * k, 0.08);
      if (Math.random() < 0.6 * k) this.combat.fx.spawn(n, back.clone().multiplyScalar(8).add(new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3)), { color: 0xffd36b, life: 0.3, size: 0.09, gravity: 6, glow: true });
      this.combat.glow.light(n, 0xff8a2a, 30 * k, 0.05);
    }
  }
  // pieces torn off a machine (still standing) by a blast at `from`
  fling(e, from, n = 1) {
    const g = e.model.group;
    g.updateWorldMatrix(true, true);
    const meshes = [];
    g.traverse((m) => m.isMesh && m.visible && !m.userData.outline && m.parent !== this.scene && meshes.push(m));
    for (let i = 0; i < n && meshes.length; i++) {
      const m = meshes.splice((Math.random() * meshes.length) | 0, 1)[0];
      this.scene.attach(m);
      const away = new THREE.Vector3(m.position.x - from.x, 0, m.position.z - from.z);
      if (away.lengthSq() < 0.01) away.set(Math.random() - 0.5, 0, Math.random() - 0.5);
      away.normalize().multiplyScalar(4 + Math.random() * 5);
      this.parts.push({ m, vel: new THREE.Vector3(away.x, 6 + Math.random() * 5, away.z), spin: new THREE.Vector3((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16), r: 0.2, rest: false });
    }
  }
  // The mech's main gun: a slow explosive shell down the locked line
  // (a glowing slug you can see coming; it bursts on whatever it hits)
  fireShell(e, ctx) {
    const S = e.stats;
    const from = e.model.muzzle();
    from.y = e.pos.y + HULL_Y + 0.3;
    const dir = new THREE.Vector3(Math.cos(e.lockYaw), 0, -Math.sin(e.lockYaw));
    e.recoil = 1;
    e.fireTimer = S.reload + Math.random() * 0.8;
    const mesh = new THREE.Group();
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.26, 0.26), new THREE.MeshBasicMaterial({ color: 0xfff2d8 }));
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff6a2a, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    mesh.add(core, halo);
    mesh.position.copy(from);
    this.scene.add(mesh);
    const range = S.range + 6;
    this.bolts.push({ pos: from.clone(), origin: from.clone(), vel: dir.multiplyScalar(S.shellSpeed), life: range / S.shellSpeed, damage: S.damage, rocket: mesh, shell: { blast: S.shellBlast, splash: S.shellSplash } });
    const c = this.combat;
    c.glow.flash(from, 0xffe0b0, 0.3, 2, 0.12);
    c.glow.light(from, 0xffa060, 40, 0.15);
    for (let i = 0; i < 6; i++) c.puffs.spawn(from, new THREE.Vector3(dir.x * 2 + (Math.random() - 0.5) * 2, 0.5 + Math.random(), dir.z * 2 + (Math.random() - 0.5) * 2), { color: 0x8f8b84, s0: 0.3, s1: 1, life: 0.9, drag: 3, lift: 0.6, fadeAt: 0.3 });
    c.shake = Math.max(c.shake, 0.3);
  }
  // how far a beam from the muzzle along the lock goes before something solid stops it
  // The beam is laid on the hull, not the turret top: it runs along at
  // HULL_Y, so cover as high as the hull stops it.
  beamLength(e, from, colliders, max) {
    losRay.set(new THREE.Vector3(from.x, e.pos.y + HULL_Y, from.z), new THREE.Vector3(Math.cos(e.lockYaw), 0, -Math.sin(e.lockYaw))); // (over the ground it stands on)
    losRay.far = max;
    const hit = colliders?.length ? losRay.intersectObjects(colliders, false)[0] : null;
    return hit ? hit.distance : max;
  }
  fireBeam(e, ctx) {
    const S = e.stats;
    const from = e.model.muzzle();
    const dir = new THREE.Vector3(Math.cos(e.lockYaw), 0, -Math.sin(e.lockYaw));
    const len = this.beamLength(e, from, ctx.colliders, S.range + 4);
    const end = from.clone().addScaledVector(dir, len).setY(e.pos.y + HULL_Y);
    e.recoil = 1;
    e.fireTimer = S.reload + Math.random() * 0.8;
    // did it catch the tank? (its footprint against the line)
    const tb = ctx.tankBox;
    if (tb) {
      const rx = tb.x - from.x;
      const rz = tb.z - from.z;
      const along = rx * dir.x + rz * dir.z;
      const off = Math.abs(rx * dir.z - rz * dir.x);
      if (along > 0 && along < len + 0.5 && off < tb.hz + 0.4) {
        ctx.onTankHit?.(S.damage, from.clone().addScaledVector(dir, along));
        this.combat.fx.burst(from.clone().addScaledVector(dir, along).setY(e.pos.y + HULL_Y), { count: 18, speed: 7, color: 0xffd9c8, life: 0.35, size: 0.08, gravity: 10 });
      }
    }
    // the beam: a white-hot core in a red glow, a flash at each end
    const c = this.combat;
    c.glow.tracer(from, end, 0xffffff, S.static ? 0.45 : 0.3, 0.3);
    c.glow.tracer(from, end, 0xff3b2f, S.static ? 1.1 : 0.8, 0.22);
    c.glow.flash(from, 0xffffff, 0.3, S.static ? 2.2 : 1.4, 0.12);
    c.glow.light(from, 0xff6a50, 40, 0.15);
    // where it stops: a hot splash of sparks and a puff (scenery only: it's no player's shell)
    c.glow.flash(end, 0xfff0e0, 0.2, 1.2, 0.1);
    c.fx.burst(end, { count: 16, speed: 6, color: 0xffd9c8, life: 0.35, size: 0.07, gravity: 10 });
    for (let i = 0; i < 4; i++) c.puffs.spawn(end, new THREE.Vector3((Math.random() - 0.5) * 2, 0.8 + Math.random(), (Math.random() - 0.5) * 2), { color: 0x8f8b84, s0: 0.12, s1: 0.4, life: 0.6, drag: 3, lift: 0.8, fadeAt: 0.3 });
    c.shake = Math.max(c.shake, S.static ? 0.4 : 0.2);
  }

  // Rounds in flight: red streaks; a round that passes through the tank's
  // footprint (low enough) hits it, the rest go on into the ground.
  // a round's done: a rocket bursts (a small blast, a little splash on the
  // tank if it's close) and its body goes
  endBolt(i, ctx) {
    const b = this.bolts[i];
    if (!b) return;
    this.bolts.splice(i, 1);
    if (!b.rocket) return;
    b.rocket.removeFromParent();
    const at = b.pos.clone().setY(Math.max(0.2, b.pos.y));
    if (b.shell) {
      // the mech's shell: a big burst, splash on the tank if it's close
      this.combat.explode(at);
      this.combat.shake = Math.max(this.combat.shake, 0.35);
      const tb = ctx.tankBox;
      if (tb && !b.hitTank && !ctx.over && Math.hypot(at.x - tb.x, at.z - tb.z) < b.shell.blast + Math.max(tb.hx, tb.hz) * 0.5) ctx.onTankHit?.(b.shell.splash, at);
      return;
    }
    this.combat.glow.flash(at, 0xffb070, 0.15, 1.2, 0.08);
    this.combat.fx.burst(at, { count: 12, speed: 5, color: 0xffb347, life: 0.3, size: 0.07, gravity: 10 });
    for (let k = 0; k < 3; k++) this.combat.puffs.spawn(at, new THREE.Vector3((Math.random() - 0.5) * 2, 1 + Math.random(), (Math.random() - 0.5) * 2), { color: 0x6f6a62, s0: 0.2, s1: 0.6, life: 0.7, drag: 3, lift: 0.5, fadeAt: 0.3 });
    const tb = ctx.tankBox;
    if (tb && !b.hitTank && Math.hypot(at.x - tb.x, at.z - tb.z) < Math.max(tb.hx, tb.hz) + 0.6) ctx.onTankHit?.(Math.round(b.damage * 0.4), at);
  }
  // the mech's artillery rockets still in the air: gone with it
  clearShells(e) {
    for (const sh of e.shells || []) {
      sh.ring.removeFromParent();
      sh.dot.removeFromParent();
      sh.mesh.removeFromParent();
    }
    e.artyLeft = 0;
    e.shells = [];
  }
  // the run's over: every round and rocket still in the air just goes
  // (a little puff where a rocket was), none left hanging there
  clearBolts() {
    for (const b of this.bolts) {
      if (!b.rocket) continue;
      b.rocket.removeFromParent();
      this.combat.puffs.spawn(b.pos.clone(), new THREE.Vector3(0, 0.5, 0), { color: 0x8d8b86, s0: 0.15, s1: 0.4, life: 0.5, drag: 3, lift: 0.4, fadeAt: 0.3 });
    }
    this.bolts.length = 0;
  }
  updateBolts(dt, ctx) {
    const tb = ctx.tankBox;
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      if (!b) continue; // (a hit just ended the run and cleared them all)
      const prev = b.pos.clone();
      b.pos.addScaledVector(b.vel, dt);
      b.life -= dt;
      // a round stops on anything solid in its way
      if (ctx.colliders?.length) {
        losDir.subVectors(b.pos, prev);
        const step = losDir.length();
        if (step > 0) {
          losRay.set(prev, losDir.divideScalar(step));
          losRay.far = step;
          const wall = losRay.intersectObjects(ctx.colliders, false)[0];
          if (wall) {
            this.combat.fx.burst(wall.point, { count: 4, speed: 3, color: 0xffb08a, life: 0.2, size: 0.06, gravity: 9 });
            this.endBolt(i, ctx);
            continue;
          }
        }
      }
      if (b.rocket) {
        // a rocket: its body pointing along its flight, the motor's flame
        // flickering, a smoke trail behind
        b.rocket.position.copy(b.pos);
        b.rocket.lookAt(b.pos.clone().add(b.vel));
        b.rocket.rotateY(-Math.PI / 2); // (its length runs along x)
        const fl = b.rocket.userData.flame;
        if (fl) fl.scale.set(0.75 + Math.random() * 0.5, 1, 1);
        // the trail, like a real rocket's (and our own missiles'): a bright
        // hot streak, and smoke puffs thrown out unevenly, some bigger, some
        // drifting, that billow and linger
        const tail = b.pos.clone().addScaledVector(b.vel, -0.04);
        b.last ??= tail.clone();
        this.combat.glow.tracer(b.last, tail, 0xffc070, 0.16, 0.16);
        this.combat.glow.tracer(b.last, tail, 0xffffff, 0.06, 0.07);
        if (Math.random() < 0.85) {
          const big = Math.random() < 0.25;
          this.combat.puffs.spawn(tail.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.12)), new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.2 + Math.random() * 0.3, (Math.random() - 0.5) * 0.6), { color: Math.random() < 0.3 ? 0xb8b2a6 : 0xd0cabe, s0: big ? 0.16 : 0.1, s1: big ? 0.7 : 0.45, life: 0.7 + Math.random() * 0.5, drag: 2, lift: 0.2, fadeAt: 0.2 });
        }
        b.last.copy(tail);
      }
      // a long bright streak with a hot core, so a round in flight is easy to
      // see (and to dodge)
      if (!b.rocket) {
        const tail = b.pos.clone().addScaledVector(b.vel, -0.055);
        if (b.pos.distanceToSquared(b.origin) < 0.055 * 0.055 * b.vel.lengthSq()) tail.copy(b.origin);
        this.combat.glow.tracer(tail, b.pos, 0xff2414, 0.16, 0.04);
        this.combat.glow.tracer(tail.lerp(b.pos, 0.4), b.pos, 0xffb8a0, 0.06, 0.04);
      }
      let hit = false;
      const ty = ctx.tankPos?.y ?? 0; // (the tank may be up on a deck)
      if (tb && b.pos.y < ty + 1.8 && b.pos.y > ty - 0.3) {
        const dx = b.pos.x - tb.x;
        const dz = b.pos.z - tb.z;
        const c = Math.cos(tb.yaw);
        const sn = Math.sin(tb.yaw);
        hit = Math.abs(dx * c - dz * sn) < tb.hx + 0.1 && Math.abs(dx * sn + dz * c) < tb.hz + 0.1;
      }
      if (hit) {
        this.combat.glow.flash(b.pos, 0xffd9a0, 0.06, 0.3, 0.06);
        this.combat.fx.burst(b.pos, { count: 6, speed: 4, color: 0xffd36b, life: 0.2, size: 0.06, gravity: 9 });
        ctx.onTankHit?.(b.damage, b.pos);
        b.hitTank = true;
        this.endBolt(i, ctx);
      } else if (b.life <= 0 || b.pos.y <= (ctx.heightAt ? ctx.heightAt(b.pos.x, b.pos.z) : 0) + 0.05) {
        this.combat.fx.burst(b.pos.clone(), { count: 3, speed: 2.5, color: 0x8d8b86, glow: false, life: 0.3, size: 0.06, gravity: 9 });
        this.endBolt(i, ctx);
      }
    }
  }

  // the machine under the reticle gets a white outline
  setHover(target) {
    for (const e of this.list) e.model.setOutline(e === target && e.alive);
  }

  // drop every machine still standing (left behind when the tank goes into
  // a checkpoint); wrecks stay
  retire() {
    for (const e of this.list) {
      if (!e.alive) continue;
      e.model.group.removeFromParent();
      e.funnel.removeFromParent();
      e.markMesh?.removeFromParent();
      e.warn?.removeFromParent();
      e.warnLine?.removeFromParent();
      this.clearShells(e);
    }
    this.list = this.list.filter((e) => !e.alive);
    this.clearBolts();
  }

  dispose() {
    for (const e of this.list) {
      e.model.group.removeFromParent();
      e.funnel.removeFromParent();
      e.markMesh?.removeFromParent();
      e.warn?.removeFromParent();
      e.warnLine?.removeFromParent();
    }
    this.bolts = [];
    for (const p of this.parts) p.m.removeFromParent();
    this.list = [];
    this.parts = [];
  }
}
