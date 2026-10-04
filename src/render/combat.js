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
    this.glow = new Glow(scene, { size: 96 });
    this.puffs = new Puffs(scene, 380);
    this.debris = new Debris(scene, 160);
    this.craters = new Craters(scene);
    this.shells = [];
    this.purges = [];
    this.shake = 0;
    this.offset = new THREE.Vector3();
    this.ray = new THREE.Raycaster();
  }

  // Fires the tank's cannon toward aimPoint (or straight out when null). The
  // shell flies along the gun's bearing to the aim distance and height, and
  // stops at the first collider in its way. Returns false if the tank
  // could not fire.
  // small: an autocannon round (a sharp little flash, a spray of sparks, a
  // light shell, a small hit; hardly any smoke and no fume purge), otherwise
  // the main gun's big show. Defaults to the tank's own gun.
  fireCannon(tank, aimPoint, colliders = [], { small = !!tank.autocannon } = {}) {
    const shot = tank.fire();
    if (!shot) return false;
    const { glow, puffs, fx } = this;
    const { position: m, direction: d, breech } = shot;
    const { u, v } = basis(d);
    if (small) {
      // a small cannon's bark: a hot flash, a starburst, a short blast of smoke
      glow.flash(m, 0xfff6d6, 0.1, 0.45, 0.05);
      glow.flash(m, 0xffb347, 0.15, 0.65, 0.08);
      glow.spike(m, d, 0xffc2a8, 1.4, 0.18, 0.07);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.random() * 0.5;
        glow.spike(m, d.clone().multiplyScalar(0.9).addScaledVector(u, Math.cos(a) * 0.8).addScaledVector(v, Math.sin(a) * 0.8).normalize(), 0xffc24a, 0.5, 0.1, 0.06);
      }
      glow.light(m, 0xffa24a, 22, 0.08);
      for (let i = 0; i < 3; i++) puffs.spawn(m.clone().addScaledVector(d, 0.15 + i * 0.18), d.clone().multiplyScalar(5 - i).addScaledVector(u, (Math.random() - 0.5)).addScaledVector(v, (Math.random() - 0.5)), { color: i ? 0xd2d4cc : 0xf2efe6, s0: 0.08, s1: 0.22 + i * 0.04, life: 0.35, drag: 4, lift: 1, fadeAt: 0.3 });
      // a spray of sparks out the muzzle, mostly forward
      for (let i = 0; i < 7; i++) {
        const vel = d.clone().multiplyScalar(5 + Math.random() * 5).addScaledVector(u, (Math.random() - 0.5) * 4).addScaledVector(v, (Math.random() - 0.5) * 4);
        fx.spawn(m.clone().addScaledVector(d, 0.05), vel, { color: i % 3 ? 0xffd36b : 0xfff3c4, life: 0.12 + Math.random() * 0.1, size: 0.05, gravity: 6, glow: true });
      }
      // the spent case flicked out of the turret side
      const tr = tank.muzzle?.().breech;
      if (tr) fx.spawn(tr.clone().addScaledVector(v, 0.1), v.clone().multiplyScalar(2.2).add(new THREE.Vector3(0, 2.5, 0)), { color: 0xc9a24a, life: 0.5, size: 0.05, gravity: 14 });
      this.shake = Math.max(this.shake, 0.06);
      const { target, hit } = this.traceShot(m, d, breech, aimPoint, colliders);
      if (target.clone().sub(m).dot(d) <= 0.05) {
        this.smallHit(target, hit?.normal, hit?.mesh);
        return true;
      }
      const w = tank.tracerScale ?? 1; // (the Vulcan's rounds: thinner)
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.14 * w, 0.14 * w, 1.5), new THREE.MeshBasicMaterial({ color: 0xffc4ae })); // a red-tinted tracer: its own character, still warmer and paler than enemy bolts
      mesh.position.copy(m);
      mesh.lookAt(target);
      this.scene.add(mesh);
      this.shells.push({ mesh, from: m.clone(), target, hit, travelled: 0, total: Math.max(0.01, m.distanceTo(target)), small: true, w });
      return true;
    }

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
    // the purge: the fume extractor keeps venting for a while after the shot;
    // update() emits it from wherever the barrel is now (see emitPurge)
    this.purges.push({ tank, t: 0, carry: 0 });
    // dust kicked up off the ground under the muzzle
    const ground = new THREE.Vector3(m.x, 0.08, m.z);
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      puffs.spawn(ground, new THREE.Vector3(Math.cos(a) * 2.6, 0.4, Math.sin(a) * 2.6), { color: 0xb3a27e, s0: 0.08, s1: 0.24, life: 0.5, drag: 4, lift: 0.4, fadeAt: 0.3 });
    }
    fx.burst(m, { count: 6, speed: 5, color: 0xffd060, life: 0.12, size: 0.1 });
    this.shake = Math.max(this.shake, 0.12);

    const { target, hit } = this.traceShot(m, d, breech, aimPoint, colliders);
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

  // Where a shell fired now would land: along the gun's bearing to the aim
  // distance and height, stopped by the first collider in the way.
  traceShot(m, d, breech, aimPoint, colliders = []) {
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
    return { target, hit };
  }

  // An enemy rifle shot: red tracer from the muzzle; sparks where it lands.
  enemyShot(from, to, hitTank) {
    const { glow, fx } = this;
    glow.flash(from, 0xff6a3a, 0.06, 0.3, 0.05);
    glow.tracer(from, to, 0xff3b2f, 0.06, 0.08);
    glow.light(from, 0xff4a30, 6, 0.06);
    if (hitTank) {
      glow.flash(to, 0xffd9a0, 0.06, 0.3, 0.06);
      fx.burst(to, { count: 6, speed: 4, color: 0xffd36b, life: 0.2, size: 0.06, gravity: 9 });
    } else {
      fx.burst(to, { count: 3, speed: 2.5, color: 0x8d8b86, glow: false, life: 0.3, size: 0.06, gravity: 9 });
    }
  }

  // A machine blowing apart: a sharp flash, sparks, its own parts thrown,
  // a puff of dark smoke.
  machineDeath(at, color = 0x3e4247) {
    const { glow, fx, puffs, debris } = this;
    glow.flash(at, 0xfff0c8, 0.2, 1.1, 0.08);
    glow.flash(at, 0xff9a40, 0.3, 1.4, 0.14);
    glow.light(at, 0xff9a40, 40, 0.2);
    fx.burst(at, { count: 22, speed: 8, color: 0xffd36b, life: 0.45, size: 0.08, gravity: 12 });
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * Math.PI * 2;
      debris.spawn(at, new THREE.Vector3(Math.cos(a) * (2 + Math.random() * 3), 4 + Math.random() * 4, Math.sin(a) * (2 + Math.random() * 3)), { color: i % 3 ? color : 0x1f2124, size: 0.06 + Math.random() * 0.07, life: 2.2 });
    }
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2;
      puffs.spawn(at, new THREE.Vector3(Math.cos(a) * 1.5, 1 + Math.random(), Math.sin(a) * 1.5), { color: i % 2 ? 0x3d3c40 : 0x55545a, s0: 0.12, s1: 0.4 + Math.random() * 0.2, life: 0.9, drag: 2.5, lift: 1.4, fadeAt: 0.3 });
    }
    this.shake = Math.max(this.shake, 0.12);
  }

  // at: impact point; normal/mesh: the surface hit (null for an airburst).
  // an autocannon round landing: a pop of sparks, a small flash and puff
  // an autocannon shell landing: a small cannon burst (flash, fireball,
  // smoke, thrown grit, sparks, a little scorch), a third the size of the
  // main gun's
  smallHit(at, normal = null, mesh = null) {
    this.onImpact?.(at, mesh, true);
    const { fx, glow, puffs, debris, craters } = this;
    const n = normal ? normal.clone().normalize() : new THREE.Vector3(0, 1, 0);
    const p = at.clone().addScaledVector(n, 0.2);
    const out = () => new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().addScaledVector(n, 1.1).normalize();
    glow.flash(p, 0xffffff, 0.15, 0.7, 0.06);
    glow.flash(p, 0xffb347, 0.3, 1.1, 0.16);
    if (n.y > 0.7) glow.ring(new THREE.Vector3(at.x, at.y + 0.06, at.z), 0xffd59a, 0.2, 1.6, 0.25);
    for (let i = 0; i < 5; i++) glow.spike(p, out(), i % 2 ? 0xffd36b : 0xfff3c4, 0.6 + Math.random() * 0.5, 0.14, 0.08);
    glow.light(p, 0xff8c3a, 40, 0.18);
    for (let i = 0; i < 4; i++) puffs.spawn(p, out().multiplyScalar(2 + Math.random() * 1.5), { color: i % 2 ? 0xff9b3c : 0xffd35a, s0: 0.12, s1: 0.28 + Math.random() * 0.12, life: 0.25 + Math.random() * 0.1, drag: 5, lift: 1.2, fadeAt: 0.3 });
    for (let i = 0; i < 5; i++) puffs.spawn(p, out().multiplyScalar(1.4 + Math.random() * 1.4), { color: i % 2 ? 0x55585c : 0x6e7073, s0: 0.1, s1: 0.3 + Math.random() * 0.2, life: 0.6 + Math.random() * 0.3, drag: 2, lift: 1.8, delay: 0.03, fadeAt: 0.3 });
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 2.5;
      debris.spawn(p, new THREE.Vector3(Math.cos(a) * sp, 3 + Math.random() * 3, Math.sin(a) * sp).addScaledVector(n, 2), { color: Math.random() < 0.5 ? 0x6b5a45 : 0x58524a, size: 0.05 + Math.random() * 0.06, life: 1.8 });
    }
    fx.burst(p, { count: 16, speed: 7, color: 0xffd36b, life: 0.4, size: 0.07, gravity: 12 });
    fx.burst(p, { count: 6, speed: 4, color: 0xfff3c4, life: 0.2, size: 0.05, gravity: 6 });
    if (mesh && !mesh.isInstancedMesh && !mesh.userData.noDecal) craters.add(at, n, mesh, 0.45);
    this.shake = Math.max(this.shake, 0.12);
  }

  // A Piercing shot going through a machine: a big, bright, sparky burst,
  // white-hot, with a shock ring
  sparkBlast(p) {
    const { fx, glow } = this;
    glow.flash(p, 0xffffff, 0.4, 2.2, 0.1);
    glow.flash(p, 0xfff0c8, 0.6, 3.0, 0.22);
    glow.ring(new THREE.Vector3(p.x, 0.1, p.z), 0xffffff, 0.4, 3.4, 0.3);
    for (let i = 0; i < 12; i++) {
      const d = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 - 0.1, Math.random() - 0.5).normalize();
      glow.spike(p, d, i % 3 ? 0xffffff : 0xffe08a, 1.4 + Math.random() * 1.4, 0.22, 0.12);
    }
    glow.light(p, 0xfff0d0, 120, 0.2);
    fx.burst(p, { count: 40, speed: 13, color: 0xffffff, life: 0.5, size: 0.08, gravity: 9 });
    fx.burst(p, { count: 30, speed: 8, color: 0xffd36b, life: 0.7, size: 0.09, gravity: 12 });
    for (let i = 0; i < 10; i++) {
      const d = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.6, Math.random() - 0.5).normalize();
      glow.tracer(p, p.clone().addScaledVector(d, 1.5 + Math.random() * 1.5), 0xfff3c4, 0.06, 0.18); // spark streaks
    }
  }

  // Piercing shot: a glowing round flying down the line like a meteor, a
  // white-hot head and a long trail of light behind it that lingers and
  // fades. onPass(a0, a1) as it covers each stretch of the line, onEnd(at)
  // where it stops.
  pierceShot(from, dir, len, { onPass, onEnd }) {
    const mat = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    const g = new THREE.Group();
    const layers = [
      [0.16, mat(0xffffff, 1)],
      [0.38, mat(0xfff6e0, 0.6)],
      [0.8, mat(0xffe2b0, 0.22)],
    ].map(([w, m]) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), m);
      mesh.userData = { w, base: m.opacity };
      g.add(mesh);
      return mesh;
    });
    const head = [
      [0.32, mat(0xffffff, 1)],
      [0.6, mat(0xfff6e0, 0.55)],
      [1.0, mat(0xffe8c0, 0.2)],
    ].map(([r, m]) => {
      const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), m);
      g.add(mesh);
      return mesh;
    });
    // the sound barrier breaking at the head: a pale cone opening back from
    // it, and rings of pressure peeling off behind
    const machMat = mat(0xffffff, 0.35);
    machMat.side = THREE.DoubleSide;
    const mach = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.6, 16, 1, true), machMat);
    const aim = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    mach.quaternion.copy(aim);
    g.add(mach);
    head.push(mach);
    const rings = [];
    for (let i = 0; i < 10; i++) {
      const rm = mat(0xffffff, 0);
      rm.side = THREE.DoubleSide;
      const r = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 20), rm);
      r.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize());
      r.visible = false;
      g.add(r);
      rings.push({ mesh: r, t: 1 });
    }
    this.scene.add(g);
    this.pierces ??= [];
    this.pierces.push({ from: from.clone(), dir: dir.clone(), len, along: 0, onPass, onEnd, g, layers, head, rings, ringT: 0, ringI: 0, fade: 0 });
  }
  updatePierces(dt) {
    const SPEED = 55;
    const FADE = 1.1;
    for (let i = (this.pierces?.length || 0) - 1; i >= 0; i--) {
      const s = this.pierces[i];
      const flying = s.along < s.len;
      if (flying) {
        const a0 = s.along;
        s.along = Math.min(s.len, s.along + SPEED * dt);
        s.onPass(a0, s.along);
        const at = s.from.clone().addScaledVector(s.dir, s.along);
        for (const h of s.head) h.position.copy(at);
        s.head[3].position.addScaledVector(s.dir, -0.6); // the cone sits just behind the round
        // a pressure ring left behind every few hundredths of a second
        s.ringT -= dt;
        if (s.ringT <= 0) {
          s.ringT = 0.03;
          const r = s.rings[s.ringI++ % s.rings.length];
          r.t = 0;
          r.mesh.position.copy(at);
          r.mesh.visible = true;
        }
        s.head[0].scale.setScalar(0.9 + Math.random() * 0.25);
        this.glow.light(at, 0xffc070, 30, 0.06);
        // embers shed off the head, a few wisps of smoke
        for (let k = 0; k < 4; k++) this.fx.spawn(at, new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2.5, (Math.random() - 0.5) * 3).addScaledVector(s.dir, -2), { color: k % 2 ? 0xffd36b : 0xff9a3a, life: 0.3 + Math.random() * 0.3, size: 0.07, gravity: 5, glow: true });
        if (Math.random() < 0.5) this.puffs.spawn(at, new THREE.Vector3(0, 0.6, 0), { color: 0xcfcac0, s0: 0.15, s1: 0.45, life: 0.7, drag: 2, lift: 0.8, fadeAt: 0.4 });
        if (s.along >= s.len) {
          for (const h of s.head) h.visible = false;
          s.onEnd(at);
        }
      } else s.fade += dt;
      for (const r of s.rings) {
        if (r.t >= 1) {
          r.mesh.visible = false;
          continue;
        }
        r.t = Math.min(1, r.t + dt / 0.35);
        r.mesh.scale.setScalar(0.4 + r.t * 1.8);
        r.mesh.material.opacity = (1 - r.t) * 0.7;
      }
      // the trail: from the muzzle to the head, thinning and fading once it's landed
      const k = 1 - Math.min(1, s.fade / FADE);
      const mid = s.from.clone().addScaledVector(s.dir, s.along / 2);
      for (const m of s.layers) {
        m.position.copy(mid);
        m.lookAt(s.from.clone().addScaledVector(s.dir, s.along + 0.001));
        const w = m.userData.w * (0.35 + 0.65 * k);
        m.scale.set(w, w, Math.max(0.01, s.along));
        m.material.opacity = m.userData.base * k * k;
      }
      if (k <= 0) {
        s.g.traverse((o) => {
          if (o.isMesh) {
            o.geometry.dispose();
            o.material.dispose();
          }
        });
        this.scene.remove(s.g);
        this.pierces.splice(i, 1);
      }
    }
  }

  explode(at, normal = null, mesh = null) {
    this.onImpact?.(at, mesh);
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
    if (mesh && !mesh.isInstancedMesh && !mesh.userData.noDecal) craters.add(at, n, mesh, 1.0);
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
    this.updatePierces(dt);
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i];
      const prev = s.mesh.position.clone();
      s.travelled = Math.min(s.total, s.travelled + SHELL_SPEED * dt);
      s.mesh.position.lerpVectors(s.from, s.target, s.travelled / s.total);
      const w = s.w ?? 1;
      this.glow.tracer(prev, s.mesh.position, s.small ? 0xff9a7a : 0xffd27a, 0.12 * w, s.small ? 0.22 : 0.12); // hot trail
      if (s.small) this.glow.tracer(prev, s.mesh.position, 0xff6a4a, 0.26 * w, 0.12); // and a red glow round it
      if (s.travelled >= s.total) {
        if (s.small) this.smallHit(s.target, s.hit?.normal, s.hit?.mesh);
        else this.explode(s.target, s.hit?.normal, s.hit?.mesh);
        this.removeShell(i);
      }
    }
    for (let i = this.purges.length - 1; i >= 0; i--) {
      if (!this.emitPurge(this.purges[i], dt)) this.purges.splice(i, 1);
    }
    this.fx.update(dt);
    this.glow.update(dt);
    this.puffs.update(dt);
    this.debris.update(dt);
    this.craters.update(dt);
    this.shake *= Math.exp(-dt * 9);
  }

  // Fume-extractor purge, emitted from the barrel's current position so it
  // stays on the gun while the tank drives and the turret turns. Dense at the
  // start (overlapping puffs read as one plume, not a trail of dots), then
  // thinning to lazy wisps off the muzzle. Returns false when done.
  emitPurge(p, dt) {
    const PURGE = 1.5;
    p.t += dt;
    if (p.t > PURGE) return false;
    const { position: m, direction: d } = p.tank.muzzle();
    const { u, v } = basis(d);
    const vent = m.clone().addScaledVector(d, -0.76);
    const k = p.t / PURGE;
    const rate = 70 * (1 - k) ** 1.5 + 6; // puffs per second
    p.carry += rate * dt;
    while (p.carry >= 1) {
      p.carry -= 1;
      const a = Math.random() * Math.PI * 2;
      const r = u.clone().multiplyScalar(Math.cos(a)).addScaledVector(v, Math.sin(a));
      const fromMuzzle = k > 0.45 && Math.random() < 0.5;
      const at = fromMuzzle ? m.clone().addScaledVector(d, 0.05) : vent.clone().addScaledVector(r, 0.12).addScaledVector(d, (Math.random() - 0.5) * 0.2);
      const vel = r.clone().multiplyScalar(fromMuzzle ? 0.2 : 0.7 * (1 - k)).addScaledVector(d, fromMuzzle ? 0.3 : 0.4);
      const big = 1 - k * 0.6;
      this.puffs.spawn(at, vel, {
        color: k < 0.3 ? 0xd3d5cc : k < 0.6 ? 0xbcbfb6 : 0xa9ada4,
        s0: 0.09 * big,
        s1: (0.2 + Math.random() * 0.08) * big,
        life: 0.55 + Math.random() * 0.25,
        drag: 2.5,
        lift: 0.9,
        fadeAt: 0.4,
      });
    }
    return true;
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
