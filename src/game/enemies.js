// Enemy machines in a level. For now: robot dogs that rush the tank, stop
// at rifle range, strafe and fire bursts. The roof MG and cannon splash kill
// them; their wrecks stay where they fall.
import * as THREE from 'three';
import { createDog } from '../models/dog.js';
import { pushOut } from './collide.js';

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
};

export class Enemies {
  constructor(scene, combat) {
    this.scene = scene;
    this.combat = combat;
    this.list = [];
    this.parts = [];
    this.killed = 0;
    this.hitMat = new THREE.MeshBasicMaterial({ visible: false });
  }

  // a dog appears at (x, z), already running toward the tank
  // via: waypoints [[x, z], ...] it runs through first (out of side streets)
  spawnDog(x, z, { delay = 0, via = [] } = {}) {
    const model = createDog();
    model.group.position.set(x, 0, z);
    model.group.visible = delay <= 0;
    this.scene.add(model.group);
    // invisible box shells and the aim ray can hit
    const hit = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 0.7), this.hitMat);
    hit.position.y = 0.55;
    hit.userData.noDecal = true;
    model.group.add(hit);
    const e = {
      kind: 'dog',
      model,
      hit,
      pos: model.group.position,
      hp: DOG.hp,
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
    };
    hit.userData.enemy = e;
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
  nearest(p, range) {
    let best = null;
    let bestD = range * range;
    for (const e of this.list) {
      if (!e.alive || e.delay > 0) continue;
      const d = (e.pos.x - p.x) ** 2 + (e.pos.z - p.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  aimPoint(e) {
    return new THREE.Vector3(e.pos.x, 0.65, e.pos.z);
  }

  // Returns true when this killed it. blastFrom: a heavy hit that blows the
  // machine apart instead of dropping it.
  damage(e, amount, blastFrom = null) {
    if (!e.alive) return false;
    e.hp -= amount;
    e.model.hitFlash();
    if (e.hp > 0) return false;
    this.kill(e, blastFrom);
    return true;
  }

  kill(e, blastFrom = null) {
    e.alive = false;
    e.model.kill();
    e.hit.removeFromParent();
    this.killed++;
    this.combat.machineDeath(new THREE.Vector3(e.pos.x, 0.6, e.pos.z));
    if (blastFrom) this.shatter(e, blastFrom);
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
      const dx = tankPos.x - e.pos.x;
      const dz = tankPos.z - e.pos.z;
      const dist = Math.hypot(dx, dz) || 1;
      const tx = dx / dist;
      const tz = dz / dist;

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
      } else if (dist > DOG.range) {
        vx = tx;
        vz = tz;
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
      const len = Math.hypot(vx, vz) || 1;
      const before = e.pos.clone();
      e.pos.x += (vx / len) * speed * dt;
      e.pos.z += (vz / len) * speed * dt;
      // keep out of walls, wrecks and each other
      pushOut(e.pos, () => ({ x: e.pos.x, z: e.pos.z, hx: DOG.box.hx, hz: DOG.box.hz, yaw: e.model.group.rotation.y }), blocks, 1);
      for (const o of this.list) {
        if (o === e || !o.alive || o.delay > 0) continue;
        const ox = e.pos.x - o.pos.x;
        const oz = e.pos.z - o.pos.z;
        const d = Math.hypot(ox, oz);
        if (d < 1.1 && d > 0.001) {
          e.pos.x += (ox / d) * (1.1 - d) * 0.5;
          e.pos.z += (oz / d) * (1.1 - d) * 0.5;
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
      const facing = moved > 0.002 ? Math.atan2(-(e.pos.z - before.z), e.pos.x - before.x) : e.model.group.rotation.y;
      const g = e.model.group;
      let diff = facing - g.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      g.rotation.y += diff * Math.min(1, dt * 8);
      let aimYaw = Math.atan2(-tz, tx) - g.rotation.y;
      aimYaw = Math.atan2(Math.sin(aimYaw), Math.cos(aimYaw));

      // shooting: bursts once in range and roughly facing the tank
      e.recoil = Math.max(0, e.recoil - dt * 8);
      e.fireTimer -= dt;
      if (dist < DOG.range + 1.5) {
        if (e.burstLeft <= 0 && e.fireTimer <= 0) {
          e.burstLeft = DOG.burst;
          e.fireTimer = 0;
        }
        if (e.burstLeft > 0 && e.fireTimer <= 0) {
          e.burstLeft--;
          e.fireTimer = e.burstLeft > 0 ? DOG.burstGap : DOG.reload + Math.random() * 0.6;
          e.recoil = 1;
          const from = e.model.muzzle();
          const hit = Math.random() < DOG.accuracy;
          const to = hit
            ? new THREE.Vector3(tankPos.x + (Math.random() - 0.5) * 1.6, 0.7 + Math.random() * 0.7, tankPos.z + (Math.random() - 0.5) * 1.2)
            : new THREE.Vector3(tankPos.x + (Math.random() - 0.5) * 5, 0.05, tankPos.z + (Math.random() - 0.5) * 5);
          this.combat.enemyShot(from, to, hit);
          if (hit) ctx.onTankHit?.(DOG.damage, to);
        }
      }
      e.pos.y = ctx.heightAt ? ctx.heightAt(e.pos.x, e.pos.z) : 0;
      e.model.update(dt, t, { speed: Math.min(1, e.speed), aimYaw, aimPitch: 0.05, recoil: e.recoil });
    }
  }

  // the machine under the reticle gets a white outline
  setHover(target) {
    for (const e of this.list) e.model.setOutline(e === target && e.alive);
  }

  dispose() {
    for (const e of this.list) e.model.group.removeFromParent();
    for (const p of this.parts) p.m.removeFromParent();
    this.list = [];
    this.parts = [];
  }
}
