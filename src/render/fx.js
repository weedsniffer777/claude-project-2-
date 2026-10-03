// Tiny pooled cube-particle system for muzzle smoke, blasts and debris.
import * as THREE from 'three';
import { glowMat, toon } from '../models/kit.js';

const geo = new THREE.BoxGeometry(1, 1, 1);

export class Fx {
  constructor(scene, size = 120) {
    this.pool = [];
    for (let i = 0; i < size; i++) {
      const mesh = new THREE.Mesh(geo, toon(0xffffff));
      mesh.visible = false;
      scene.add(mesh);
      this.pool.push({ mesh, vel: new THREE.Vector3(), life: 0, max: 1, size: 0.1, gravity: 0, grow: 0 });
    }
    this.cursor = 0;
  }

  spawn(pos, vel, { color = 0xffffff, life = 0.5, size = 0.12, gravity = 0, grow = 0, glow = false }) {
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.pool.length;
    p.mesh.material = glow ? glowMat(color) : toon(color);
    p.mesh.position.copy(pos);
    p.mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    p.vel.copy(vel);
    p.life = p.max = life;
    p.size = size;
    p.gravity = gravity;
    p.grow = grow;
    p.mesh.visible = true;
  }

  burst(pos, { count = 10, speed = 3, color = 0xffa733, glow = true, ...rest } = {}) {
    for (let i = 0; i < count; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.1, Math.random() - 0.5)
        .normalize()
        .multiplyScalar(speed * (0.4 + Math.random() * 0.8));
      this.spawn(pos, v, { color, glow, ...rest });
    }
  }

  explosion(pos) {
    this.burst(pos, { count: 8, speed: 4, color: 0xfff1a8, life: 0.25, size: 0.2 });
    this.burst(pos, { count: 12, speed: 5, color: 0xff8a2b, life: 0.45, size: 0.18, gravity: 6 });
    this.burst(pos, { count: 10, speed: 2.2, color: 0x4a4e55, glow: false, life: 0.9, size: 0.28, grow: 0.5, gravity: -1.5 });
    this.burst(pos, { count: 8, speed: 5, color: 0x6b5a45, glow: false, life: 0.7, size: 0.1, gravity: 14 });
  }

  update(dt) {
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.mesh.position.y < 0.05 && p.gravity > 0) {
        p.mesh.position.y = 0.05;
        p.vel.multiplyScalar(0.3);
      }
      const k = p.life / p.max;
      p.mesh.scale.setScalar(p.size * (k + p.grow * (1 - k)));
    }
  }
}

// ---------------------------------------------------------------------------
// Additive glow effects (flashes, shockwave rings, tracers), dark scorch
// decals, and a fixed pool of point lights for muzzle and blast glow.
// None of these write depth, so the pixel outline pass ignores them.
const sphereGeo = new THREE.IcosahedronGeometry(1, 1);
const ringGeo = new THREE.RingGeometry(0.82, 1, 32).rotateX(-Math.PI / 2);
const streakGeo = new THREE.BoxGeometry(1, 1, 1);
const discGeo = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);

export class Glow {
  constructor(scene, { size = 48, lights = 4 } = {}) {
    this.items = [];
    for (let i = 0; i < size; i++) {
      const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const mesh = new THREE.Mesh(sphereGeo, mat);
      mesh.visible = false;
      mesh.renderOrder = 10;
      scene.add(mesh);
      this.items.push({ mesh, life: 0, max: 1, s0: 1, s1: 1, kind: 'flash', len: 1, width: 1 });
    }
    this.decals = [];
    for (let i = 0; i < 10; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x1b1712, transparent: true, depthWrite: false });
      const mesh = new THREE.Mesh(discGeo, mat);
      mesh.visible = false;
      mesh.renderOrder = 1;
      scene.add(mesh);
      this.decals.push({ mesh, life: 0, max: 1 });
    }
    this.lights = [];
    for (let i = 0; i < lights; i++) {
      const light = new THREE.PointLight(0xffaa55, 0, 7, 1.6);
      scene.add(light);
      this.lights.push({ light, life: 0, max: 1, peak: 0 });
    }
    this.cursor = 0;
    this.decalCursor = 0;
    this.lightCursor = 0;
  }

  next() {
    const it = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.items.length;
    return it;
  }

  // Expanding, fading glow ball.
  flash(pos, color, from, to, life) {
    const it = this.next();
    Object.assign(it, { kind: 'flash', life, max: life, s0: from, s1: to });
    it.mesh.geometry = sphereGeo;
    it.mesh.material.color.set(color);
    it.mesh.position.copy(pos);
    it.mesh.rotation.set(0, 0, 0);
    it.mesh.visible = true;
  }

  // Flat shockwave ring on the ground.
  ring(pos, color, from, to, life) {
    const it = this.next();
    Object.assign(it, { kind: 'ring', life, max: life, s0: from, s1: to });
    it.mesh.geometry = ringGeo;
    it.mesh.material.color.set(color);
    it.mesh.position.copy(pos);
    it.mesh.rotation.set(0, 0, 0);
    it.mesh.visible = true;
  }

  // Bright streak from a to b that thins out as it fades.
  tracer(a, b, color, width, life) {
    const it = this.next();
    const len = a.distanceTo(b);
    Object.assign(it, { kind: 'tracer', life, max: life, len, width });
    it.mesh.geometry = streakGeo;
    it.mesh.material.color.set(color);
    it.mesh.position.copy(a).add(b).multiplyScalar(0.5);
    it.mesh.lookAt(b);
    it.mesh.scale.set(width, width, len);
    it.mesh.visible = true;
  }

  scorch(pos, radius, life = 5) {
    const d = this.decals[this.decalCursor];
    this.decalCursor = (this.decalCursor + 1) % this.decals.length;
    d.life = d.max = life;
    d.mesh.position.set(pos.x, 0.012, pos.z);
    d.mesh.scale.setScalar(radius);
    d.mesh.rotation.y = Math.random() * Math.PI;
    d.mesh.visible = true;
  }

  light(pos, color, peak, life) {
    const l = this.lights[this.lightCursor];
    this.lightCursor = (this.lightCursor + 1) % this.lights.length;
    l.light.position.copy(pos);
    l.light.color.set(color);
    Object.assign(l, { life, max: life, peak });
  }

  update(dt) {
    for (const it of this.items) {
      if (it.life <= 0) continue;
      it.life -= dt;
      if (it.life <= 0) {
        it.mesh.visible = false;
        continue;
      }
      const k = it.life / it.max; // 1 -> 0
      const u = 1 - k;
      it.mesh.material.opacity = k * k;
      if (it.kind === 'tracer') {
        const w = it.width * (0.4 + 0.6 * k);
        it.mesh.scale.set(w, w, it.len);
      } else {
        const ease = 1 - Math.pow(1 - u, 3);
        it.mesh.scale.setScalar(it.s0 + (it.s1 - it.s0) * ease);
      }
    }
    for (const d of this.decals) {
      if (d.life <= 0) continue;
      d.life -= dt;
      d.mesh.material.opacity = 0.55 * Math.min(1, d.life / (d.max * 0.5));
      if (d.life <= 0) d.mesh.visible = false;
    }
    for (const l of this.lights) {
      if (l.life <= 0) {
        l.light.intensity = 0;
        continue;
      }
      l.life -= dt;
      const k = Math.max(0, l.life / l.max);
      l.light.intensity = l.peak * k * k;
    }
  }
}
