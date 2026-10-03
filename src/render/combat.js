// Combat effects shared by the game and the model viewer: the cannon's tracer
// shell, muzzle blast and explosion, the roof MG's tracers and brass, and
// camera shake. One instance per scene.
import * as THREE from 'three';
import { Fx, Glow, Puffs, Debris, Craters } from './fx.js';

const SHELL_SPEED = 90; // near-instant: a bright streak, not a lobbed ball

// Two unit vectors perpendicular to d (for rings and fans around a direction).
function basis(d) {
  const u = new THREE.Vector3().crossVectors(d, Math.abs(d.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize();
  const v = new THREE.Vector3().crossVectors(u, d).normalize();
  return { u, v };
}

export class CombatFx {
  constructor(scene) {
    this.scene = scene;
    this.fx = new Fx(scene, 220);
    this.glow = new Glow(scene);
    this.puffs = new Puffs(scene);
    this.debris = new Debris(scene);
    this.craters = new Craters(scene);
    this.shells = [];
    this.shake = 0;
    this.offset = new THREE.Vector3();
    this.ray = new THREE.Raycaster();
  }

  // Fires the tank's cannon toward aimPoint (or straight out when null). The
  // shell flies along the gun's bearing to the aim distance and height, and
  // stops at the first collider in its way. Returns false when the tank
  // refuses to fire (gun lifted over the drums).
  fireCannon(tank, aimPoint, colliders = []) {
    const shot = tank.fire();
    if (!shot) return false;
    const { glow, puffs, fx } = this;
    const { position: m, direction: d, breech } = shot;
    const { u, v } = basis(d);

    // starburst: one long blade forward, shorter blades fanning out
    glow.flash(m, 0xfff6d6, 0.12, 0.55, 0.05);
    glow.flash(m, 0xffb347, 0.25, 1.0, 0.1);
    glow.spike(m, d, 0xfff0b0, 2.2, 0.26, 0.09);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.random() * 0.4;
      const dir = d.clone().multiplyScalar(0.9).addScaledVector(u, Math.cos(a) * 0.75).addScaledVector(v, Math.sin(a) * 0.75).normalize();
      glow.spike(m, dir, i % 2 ? 0xffc24a : 0xffe08a, 0.7 + Math.random() * 0.5, 0.13, 0.07 + Math.random() * 0.03);
    }
    glow.light(m, 0xffa24a, 45, 0.16);

    // blast cone of cel smoke pushed out the muzzle
    for (let i = 0; i < 7; i++) {
      const at = m.clone().addScaledVector(d, 0.2 + i * 0.22);
      const vel = d.clone().multiplyScalar(6 - i * 0.6).addScaledVector(u, (Math.random() - 0.5) * 1.2).addScaledVector(v, (Math.random() - 0.5) * 1.2);
      puffs.spawn(at, vel, { color: i < 2 ? 0xf2efe6 : 0xd2d4cc, s0: 0.12, s1: 0.32 + i * 0.05, life: 0.5 + Math.random() * 0.2, drag: 4, lift: 1.2, fadeAt: 0.3 });
    }
    // smoke ring around the muzzle
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const r = u.clone().multiplyScalar(Math.cos(a)).addScaledVector(v, Math.sin(a));
      puffs.spawn(m.clone().addScaledVector(r, 0.15), r.multiplyScalar(3).addScaledVector(d, 0.8), { color: 0xc4c7bf, s0: 0.1, s1: 0.26, life: 0.45, drag: 4, lift: 0.8, fadeAt: 0.3 });
    }
    // the purge: the fume extractor vents in pulses for about a second,
    // then a few lazy wisps curl off the muzzle
    const vent = m.clone().addScaledVector(d, -0.76);
    for (let pulse = 0; pulse < 5; pulse++) {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + pulse * 0.7;
        const r = u.clone().multiplyScalar(Math.cos(a)).addScaledVector(v, Math.sin(a));
        puffs.spawn(vent.clone().addScaledVector(r, 0.17), r.multiplyScalar(0.9 - pulse * 0.1).addScaledVector(d, 0.6), {
          color: pulse < 2 ? 0xc6c9c0 : 0xadb1a8, s0: 0.05, s1: 0.15 - pulse * 0.015, life: 0.7, drag: 2.5, lift: 0.9, delay: 0.1 + pulse * 0.22, fadeAt: 0.35,
        });
      }
    }
    for (let i = 0; i < 4; i++) {
      puffs.spawn(m.clone().addScaledVector(d, 0.1 + Math.random() * 0.3), new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.7, (Math.random() - 0.5) * 0.4), { color: 0xa9ada4, s0: 0.05, s1: 0.16 + Math.random() * 0.06, life: 0.9, drag: 1.5, lift: 0.9, delay: 0.3 + i * 0.25, fadeAt: 0.35 });
    }
    // dust kicked up off the ground under the muzzle
    const ground = new THREE.Vector3(m.x, 0.08, m.z);
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      puffs.spawn(ground, new THREE.Vector3(Math.cos(a) * 2.6, 0.4, Math.sin(a) * 2.6), { color: 0xb3a27e, s0: 0.08, s1: 0.24, life: 0.5, drag: 4, lift: 0.4, fadeAt: 0.3 });
    }
    fx.burst(m, { count: 6, speed: 5, color: 0xffd060, life: 0.12, size: 0.1 });
    this.shake = Math.max(this.shake, 0.12);

    const flat = new THREE.Vector3(d.x, 0, d.z).normalize();
    const dist = aimPoint ? THREE.MathUtils.clamp(Math.hypot(aimPoint.x - m.x, aimPoint.z - m.z), 2, 18) : 12;
    let target = new THREE.Vector3(m.x, aimPoint ? aimPoint.y : 0, m.z).addScaledVector(flat, dist);
    let hit = null;
    if (colliders.length) {
      // cast from the breech so a muzzle already poking into a wall still hits it
      const origin = breech || m;
      const dir = target.clone().sub(origin);
      const len = dir.length();
      this.ray.set(origin, dir.normalize());
      this.ray.far = len + 0.5;
      const hits = this.ray.intersectObjects(colliders, false);
      if (hits.length) {
        const h = hits[0];
        target = h.point.clone();
        const normal = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
        hit = { normal, mesh: h.object };
      }
    }
    if (target.clone().sub(m).dot(d) <= 0.05) {
      this.explode(target, hit?.normal, hit?.mesh); // point blank: the muzzle is at (or in) the wall
      return true;
    }
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 1.1), new THREE.MeshBasicMaterial({ color: 0xfff0b0 }));
    mesh.position.copy(m);
    mesh.lookAt(target);
    this.scene.add(mesh);
    this.shells.push({ mesh, from: m.clone(), target, hit, travelled: 0, total: Math.max(0.01, m.distanceTo(target)) });
    return true;
  }

  // at: impact point; normal/mesh: the surface hit (null for an airburst).
  explode(at, normal = null, mesh = null) {
    const { fx, glow, puffs, debris, craters } = this;
    const n = normal ? normal.clone().normalize() : new THREE.Vector3(0, 1, 0);
    const p = at.clone().addScaledVector(n, 0.3);
    const out = () => new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().addScaledVector(n, 1.1).normalize();
    // flash and starburst, fanned out from the surface
    glow.flash(p, 0xffffff, 0.3, 1.5, 0.08);
    glow.flash(p, 0xffb347, 0.6, 2.4, 0.26);
    if (n.y > 0.7) glow.ring(new THREE.Vector3(at.x, at.y + 0.06, at.z), 0xffd59a, 0.4, 3.8, 0.38);
    for (let i = 0; i < 10; i++) glow.spike(p, out(), i % 2 ? 0xffd36b : 0xfff3c4, 1.3 + Math.random() * 1.1, 0.24, 0.1 + Math.random() * 0.05);
    glow.spike(p, n, 0xfff3c4, 2.6, 0.3, 0.12);
    glow.light(p, 0xff8c3a, 110, 0.35);
    // cel fireballs, then a rising smoke cluster
    for (let i = 0; i < 10; i++) {
      const dir = out();
      puffs.spawn(p, dir.multiplyScalar(3 + Math.random() * 2.5), { color: i % 3 ? 0xff9b3c : 0xffd35a, s0: 0.2, s1: 0.45 + Math.random() * 0.25, life: 0.35 + Math.random() * 0.15, drag: 5, lift: 1.2, fadeAt: 0.3 });
    }
    for (let i = 0; i < 14; i++) {
      const dir = out();
      puffs.spawn(p, dir.multiplyScalar(2.2 + Math.random() * 2.2), { color: i % 2 ? 0x55585c : 0x6e7073, s0: 0.15, s1: 0.45 + Math.random() * 0.35, life: 0.9 + Math.random() * 0.4, drag: 2, lift: 2.2, delay: 0.04 + Math.random() * 0.1, fadeAt: 0.3 });
    }
    // rocks thrown out, and lighter chunks that hang in the air before falling
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 3 + Math.random() * 4.5;
      const vel = new THREE.Vector3(Math.cos(a) * sp, 5 + Math.random() * 5, Math.sin(a) * sp).addScaledVector(n, 3);
      debris.spawn(p, vel, { color: Math.random() < 0.5 ? 0x6b5a45 : 0x58524a, size: 0.07 + Math.random() * 0.1, life: 2.5 });
    }
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2;
      const vel = new THREE.Vector3(Math.cos(a) * 1.4, 3 + Math.random() * 2, Math.sin(a) * 1.4).addScaledVector(n, 1.5);
      debris.spawn(p, vel, { color: 0x7a6a52, size: 0.12 + Math.random() * 0.08, life: 3, gravity: 2.2, drag: 1.4 });
    }
    // sparks: a hot spray that arcs out and rains down
    fx.burst(p, { count: 30, speed: 10, color: 0xffd36b, life: 0.55, size: 0.09, gravity: 12 });
    fx.burst(p, { count: 14, speed: 6, color: 0xfff3c4, life: 0.3, size: 0.07, gravity: 6 });
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const dir = out();
      glow.tracer(p, p.clone().addScaledVector(dir, 1 + Math.random() * 1.2), 0xffc24a, 0.05, 0.12); // spark streaks
    }
    if (mesh) craters.add(at, n, mesh, 1.0);
    this.shake = Math.max(this.shake, 0.35);
  }

  // Roof MG shots reported by the tank: tracer, glow, impact sparks, brass.
  handleTankEvents(tank) {
    const { fx, glow } = this;
    for (const e of tank.events || []) {
      if (e.type !== 'mg') continue;
      const hit = e.target.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.35, (Math.random() - 0.3) * 0.2, (Math.random() - 0.5) * 0.35));
      glow.tracer(e.muzzle, hit, 0xffe08a, 0.05, 0.07);
      glow.flash(e.muzzle, 0xffc860, 0.08, 0.38, 0.05);
      glow.light(e.muzzle, 0xffc060, 9, 0.06);
      glow.flash(hit, 0xffe9a0, 0.05, 0.25, 0.06);
      fx.burst(hit, { count: 4, speed: 3.5, color: 0xffd36b, life: 0.18, size: 0.06, gravity: 9 });
      const v = e.ejectDir.clone().multiplyScalar(1.6 + Math.random()).add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 1.8 + Math.random(), (Math.random() - 0.5) * 0.6));
      fx.spawn(e.eject, v, { color: 0xd9a743, life: 1.6, size: 0.065, gravity: 10 });
    }
  }

  update(dt) {
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i];
      const prev = s.mesh.position.clone();
      s.travelled = Math.min(s.total, s.travelled + SHELL_SPEED * dt);
      s.mesh.position.lerpVectors(s.from, s.target, s.travelled / s.total);
      this.glow.tracer(prev, s.mesh.position, 0xffd27a, 0.12, 0.12); // hot trail
      if (s.travelled >= s.total) {
        this.explode(s.target, s.hit?.normal, s.hit?.mesh);
        this.removeShell(i);
      }
    }
    this.fx.update(dt);
    this.glow.update(dt);
    this.puffs.update(dt);
    this.debris.update(dt);
    this.craters.update(dt);
    this.shake *= Math.exp(-dt * 9);
  }

  removeShell(i) {
    const s = this.shells[i];
    this.scene.remove(s.mesh);
    s.mesh.geometry.dispose();
    s.mesh.material.dispose();
    this.shells.splice(i, 1);
  }

  // Wrap a render: offset the camera for this frame only.
  beginShake(camera) {
    const k = this.shake;
    this.offset.set((Math.random() - 0.5) * k, (Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
    camera.position.add(this.offset);
  }

  endShake(camera) {
    camera.position.sub(this.offset);
  }
}
