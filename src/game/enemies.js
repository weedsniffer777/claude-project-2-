// Enemy machines in a level. For now: robot dogs that rush the tank, stop
// at rifle range, strafe and fire bursts. The roof MG and cannon splash kill
// them; their wrecks stay where they fall.
import * as THREE from 'three';
import { createDog } from '../models/dog.js';
import { createWalker } from '../models/walker.js';
import { createBridgeGun } from '../models/bridgeGun.js';
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

// The large quadruped: the zone's boss, a walker twice the size that comes
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
  hit: [3.4, 1.8, 3.4, 0.9],
  scrap: 40,
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
    if (e.markT > 0) amount *= 1.3; // spotted (Spotter): takes extra
    e.hp -= amount;
    e.model.hitFlash();
    if (e.hp > 0) return false;
    this.kill(e, blastFrom);
    return true;
  }

  kill(e, blastFrom = null) {
    e.alive = false;
    e.markMesh?.removeFromParent();
    e.markMesh = null;
    e.funnel.visible = false;
    e.burstLeft = 0;
    e.windup = 0;
    e.model.group.traverse((o) => o.layers.disable(ENEMY_LAYER)); // wrecks lose the outline
    e.model.kill();
    e.hit.removeFromParent();
    this.killed++;
    this.combat.machineDeath(new THREE.Vector3(e.pos.x, 0.6 * e.stats.scale, e.pos.z));
    if (e.stats.scale > 1.5) {
      // the big one goes up in a chain of blasts
      for (let i = 0; i < 3; i++) this.combat.explode(new THREE.Vector3(e.pos.x + (Math.random() - 0.5) * 2, 0.8 + Math.random(), e.pos.z + (Math.random() - 0.5) * 1.5));
    }
    if (blastFrom) this.shatter(e, blastFrom);
    this.onKill?.(e, !!blastFrom);
  }

  // Ram: machines the tank's box touches take damage and are thrown aside.
  // push: how hard they're shoved along the tank's way (Breakthrough
  // ploughs them ahead of it); stun: seconds they're knocked senseless.
  // Returns [{ e, amount, killed }].
  ram(tankBox, amount, tankVel, { push = 0.5, side = 5, stun = 0 } = {}) {
    const hits = [];
    const now = performance.now();
    for (const e of this.list) {
      if (!e.alive || e.delay > 0 || (e.rammedAt && now - e.rammedAt < 500)) continue;
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
      if (!e.alive || e.delay > 0 || e.stats.scale > 1.5) continue;
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
      if (!e.alive || e.delay > 0 || e.stats.scale > 1.5) continue;
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
  shatter(e, from) {
    const g = e.model.group;
    g.updateWorldMatrix(true, true);
    const meshes = [];
    g.traverse((m) => m.isMesh && m.visible && meshes.push(m));
    for (const m of meshes) {
      this.scene.attach(m);
      const p = m.position;
      const away = new THREE.Vector3(p.x - from.x, 0, p.z - from.z);
      if (away.lengthSq() < 0.01) away.set(Math.random() - 0.5, 0, Math.random() - 0.5);
      away.normalize().multiplyScalar(3 + Math.random() * 5);
      if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
      const r = m.geometry.boundingSphere.radius * Math.max(m.scale.x, m.scale.y, m.scale.z);
      this.parts.push({
        m,
        vel: new THREE.Vector3(away.x + (Math.random() - 0.5) * 2, 4 + Math.random() * 5, away.z + (Math.random() - 0.5) * 2),
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
  blast(at, radius, amount) {
    const hits = [];
    for (const e of this.list) {
      if (!e.alive || e.delay > 0) continue;
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
        e.los = !sightBlocked(new THREE.Vector3(e.pos.x, gy + 0.9 * e.stats.scale, e.pos.z), new THREE.Vector3(tankPos.x, ty + 1.0, tankPos.z), ctx.colliders);
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
      if (e.markT > 0 && !e.markMesh) {
        e.markMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }));
        this.scene.add(e.markMesh);
      }
      if (e.markMesh) {
        e.markMesh.visible = e.markT > 0;
        e.markMesh.position.set(e.pos.x, 2.2 * e.stats.scale + Math.sin(t * 4) * 0.08, e.pos.z);
        e.markMesh.rotation.y = t * 3;
        e.markMesh.material.opacity = Math.min(1, e.markT * 2);
      }
      // keep out of walls, wrecks and each other
      if (!DOG.static && !(e.noclip && e.via.length)) pushOut(e.pos, () => ({ x: e.pos.x, z: e.pos.z, hx: DOG.box.hx, hz: DOG.box.hz, yaw: e.model.group.rotation.y }), blocks, 1);
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
      g.rotation.y += diff * Math.min(1, dt * 8);
      // the rifle holds on the locked line while it winds up and fires
      const locked = e.lock && (e.windup > 0 || e.burstLeft > 0);
      let aimYaw = (DOG.sniper && e.charge > 0 ? e.lockYaw : locked ? Math.atan2(-(e.lock.z - e.pos.z), e.lock.x - e.pos.x) : Math.atan2(-tz, tx)) - g.rotation.y;
      aimYaw = Math.atan2(Math.sin(aimYaw), Math.cos(aimYaw));
      if (DOG.sniper) {
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
        vel.y = (0.25 - from.y) / time; // dipping down to hit the ground past the target
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
      } else if (e.charge <= 0) this.fireBeam(e, ctx);
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
    e.model.update(dt, t, { speed: Math.min(1, e.speed), aimYaw, aimPitch: pitch, recoil: e.recoil, charge: k });
  }
  // how far a beam from the muzzle along the lock goes before something solid stops it
  // The beam is laid on the hull, not the turret top: it runs along at
  // HULL_Y, so cover as high as the hull stops it.
  beamLength(e, from, colliders, max) {
    losRay.set(new THREE.Vector3(from.x, HULL_Y, from.z), new THREE.Vector3(Math.cos(e.lockYaw), 0, -Math.sin(e.lockYaw)));
    losRay.far = max;
    const hit = colliders?.length ? losRay.intersectObjects(colliders, false)[0] : null;
    return hit ? hit.distance : max;
  }
  fireBeam(e, ctx) {
    const S = e.stats;
    const from = e.model.muzzle();
    const dir = new THREE.Vector3(Math.cos(e.lockYaw), 0, -Math.sin(e.lockYaw));
    const len = this.beamLength(e, from, ctx.colliders, S.range + 4);
    const end = from.clone().addScaledVector(dir, len).setY(HULL_Y);
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
        this.combat.fx.burst(from.clone().addScaledVector(dir, along).setY(HULL_Y), { count: 18, speed: 7, color: 0xffd9c8, life: 0.35, size: 0.08, gravity: 10 });
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
  updateBolts(dt, ctx) {
    const tb = ctx.tankBox;
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
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
            this.bolts.splice(i, 1);
            continue;
          }
        }
      }
      // a long bright streak with a hot core, so a round in flight is easy to
      // see (and to dodge)
      const tail = b.pos.clone().addScaledVector(b.vel, -0.055);
      if (b.pos.distanceToSquared(b.origin) < 0.055 * 0.055 * b.vel.lengthSq()) tail.copy(b.origin);
      this.combat.glow.tracer(tail, b.pos, 0xff2414, 0.16, 0.04);
      this.combat.glow.tracer(tail.lerp(b.pos, 0.4), b.pos, 0xffb8a0, 0.06, 0.04);
      let hit = false;
      if (tb && b.pos.y < 1.8) {
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
        this.bolts.splice(i, 1);
      } else if (b.life <= 0 || b.pos.y <= 0.05) {
        this.combat.fx.burst(b.pos.clone().setY(0.08), { count: 3, speed: 2.5, color: 0x8d8b86, glow: false, life: 0.3, size: 0.06, gravity: 9 });
        this.bolts.splice(i, 1);
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
    }
    this.list = this.list.filter((e) => !e.alive);
    this.bolts = [];
  }

  dispose() {
    for (const e of this.list) {
      e.model.group.removeFromParent();
      e.funnel.removeFromParent();
      e.markMesh?.removeFromParent();
    }
    this.bolts = [];
    for (const p of this.parts) p.m.removeFromParent();
    this.list = [];
    this.parts = [];
  }
}
