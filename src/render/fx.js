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
const spikeGeo = new THREE.OctahedronGeometry(1, 0);

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

  // Anime starburst blade: a long thin diamond from pos along dir.
  spike(pos, dir, color, len, width, life) {
    const it = this.next();
    Object.assign(it, { kind: 'spike', life, max: life, len, width });
    it.mesh.geometry = spikeGeo;
    it.mesh.material.color.set(color);
    it.mesh.position.copy(pos).addScaledVector(dir, len * 0.5);
    it.mesh.lookAt(pos.clone().addScaledVector(dir, len));
    it.mesh.scale.set(width, width, len * 0.5);
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
      if (it.kind === 'spike') {
        const w = it.width * k;
        it.mesh.scale.set(w, w, it.len * 0.5 * (0.7 + 0.3 * u));
      } else if (it.kind === 'tracer') {
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

// ---------------------------------------------------------------------------
// Anime-style effects. Everything here is cel-shaded (toon ramp) and drawn
// with depth, so the pixel pass inks its silhouette. Smoke swells and then
// shrinks away instead of fading; rocks tumble, bounce and settle.
const puffGeo = new THREE.IcosahedronGeometry(1, 1);
const rockGeo = new THREE.DodecahedronGeometry(1, 0);

function easeOut(u) {
  return 1 - Math.pow(1 - u, 3);
}

export class Puffs {
  constructor(scene, size = 200) {
    this.pool = [];
    for (let i = 0; i < size; i++) {
      const mesh = new THREE.Mesh(puffGeo, toon(0xffffff));
      mesh.visible = false;
      mesh.castShadow = true;
      scene.add(mesh);
      this.pool.push({ mesh, vel: new THREE.Vector3(), life: 0, max: 1, delay: 0, s0: 0.2, s1: 0.5, drag: 3, lift: 0.5, stretch: 1 });
    }
    this.cursor = 0;
  }

  // One puff. s0 -> s1 is its swell; it shrinks to nothing over its last third.
  spawn(pos, vel, { color = 0xd9dcd6, s0 = 0.15, s1 = 0.5, life = 1, drag = 3, lift = 0.5, delay = 0, stretch = 1 } = {}) {
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.pool.length;
    p.mesh.material = toon(color);
    p.mesh.position.copy(pos);
    p.mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    p.mesh.visible = delay <= 0;
    p.mesh.scale.setScalar(s0);
    p.vel.copy(vel);
    Object.assign(p, { life, max: life, delay, s0, s1, drag, lift, stretch });
  }

  update(dt) {
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      if (p.delay > 0) {
        p.delay -= dt;
        if (p.delay <= 0) p.mesh.visible = true;
        continue;
      }
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        continue;
      }
      const u = 1 - p.life / p.max;
      p.vel.multiplyScalar(Math.exp(-p.drag * dt));
      p.vel.y += p.lift * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.y += dt * 0.6;
      let s = p.s0 + (p.s1 - p.s0) * easeOut(Math.min(1, u / 0.3));
      if (u > 0.65) s *= 1 - easeOut((u - 0.65) / 0.35);
      p.mesh.scale.set(s, s * (1 / p.stretch), s);
    }
  }
}

export class Debris {
  constructor(scene, size = 90) {
    this.pool = [];
    for (let i = 0; i < size; i++) {
      const mesh = new THREE.Mesh(rockGeo, toon(0x6b5a45));
      mesh.visible = false;
      mesh.castShadow = true;
      scene.add(mesh);
      this.pool.push({ mesh, vel: new THREE.Vector3(), spin: new THREE.Vector3(), life: 0, max: 1, size: 0.1, gravity: 14, drag: 0 });
    }
    this.cursor = 0;
  }

  spawn(pos, vel, { color = 0x6b5a45, size = 0.1, life = 2.5, gravity = 14, drag = 0 } = {}) {
    const d = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.pool.length;
    d.mesh.material = toon(color);
    d.mesh.position.copy(pos);
    d.mesh.visible = true;
    d.vel.copy(vel);
    d.spin.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
    Object.assign(d, { life, max: life, size, gravity, drag });
    d.mesh.scale.set(size, size * (0.6 + Math.random() * 0.5), size * (0.7 + Math.random() * 0.5));
  }

  update(dt) {
    for (const d of this.pool) {
      if (d.life <= 0) continue;
      d.life -= dt;
      if (d.life <= 0) {
        d.mesh.visible = false;
        continue;
      }
      d.vel.y -= d.gravity * dt;
      if (d.drag) d.vel.multiplyScalar(Math.exp(-d.drag * dt));
      d.mesh.position.addScaledVector(d.vel, dt);
      d.mesh.rotation.x += d.spin.x * dt;
      d.mesh.rotation.y += d.spin.y * dt;
      d.mesh.rotation.z += d.spin.z * dt;
      const floor = d.size * 0.5;
      if (d.mesh.position.y < floor) {
        d.mesh.position.y = floor;
        d.vel.y = Math.abs(d.vel.y) * 0.3;
        d.vel.x *= 0.55;
        d.vel.z *= 0.55;
        d.spin.multiplyScalar(0.5);
      }
      const k = d.life / d.max;
      if (k < 0.2) d.mesh.scale.multiplyScalar(0.92); // settle and vanish
    }
  }
}

// Fragmented craters: a jagged dark pit, cracks radiating out, and rubble
// on the rim. Each lives a while, then sinks away.
export class Craters {
  constructor(scene, size = 8) {
    this.scene = scene;
    this.size = size;
    this.items = [];
  }

  add(at, radius = 1) {
    if (this.items.length >= this.size) this.remove(0);
    const g = new THREE.Group();
    g.position.set(at.x, 0, at.z);
    g.rotation.y = Math.random() * Math.PI * 2;
    const flat = (pts, color, y) => {
      const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z)));
      const geo = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2); // face up
      const mesh = new THREE.Mesh(geo, toon(color));
      mesh.position.y = y;
      mesh.receiveShadow = true;
      g.add(mesh);
      return mesh;
    };
    // jagged pit
    const pit = [];
    const n = 13;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = radius * (i % 2 ? 0.42 + Math.random() * 0.12 : 0.6 + Math.random() * 0.2);
      pit.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    flat(pit, 0x3a332b, 0.014);
    const inner = pit.map(([x, z]) => [x * 0.55, z * 0.55]);
    flat(inner, 0x1f1b17, 0.018);
    // radiating cracks: long thin shards
    const cracks = 6 + Math.floor(Math.random() * 4);
    for (let i = 0; i < cracks; i++) {
      const a = (i / cracks) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const r0 = radius * 0.45;
      const r1 = radius * (0.9 + Math.random() * 0.6);
      const w = 0.07 + Math.random() * 0.06;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const kink = (Math.random() - 0.5) * 0.25;
      const mid = (r0 + r1) / 2;
      flat(
        [
          [ca * r0 - sa * w, sa * r0 + ca * w],
          [ca * mid - sa * kink, sa * mid + ca * kink],
          [ca * r1, sa * r1],
          [ca * r0 + sa * w, sa * r0 - ca * w],
        ],
        0x2e2923,
        0.012,
      );
    }
    // rubble on the rim
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = radius * (0.6 + Math.random() * 0.35);
      const s = 0.06 + Math.random() * 0.1;
      const rock = new THREE.Mesh(rockGeo, toon(Math.random() < 0.5 ? 0x6b6258 : 0x57504a));
      rock.position.set(Math.cos(a) * r, s * 0.3, Math.sin(a) * r);
      rock.scale.set(s, s * 0.7, s);
      rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      rock.castShadow = rock.receiveShadow = true;
      g.add(rock);
    }
    this.scene.add(g);
    this.items.push({ g, life: 9, max: 9 });
  }

  remove(i) {
    const { g } = this.items[i];
    this.scene.remove(g);
    g.traverse((o) => {
      if (o.geometry && o.geometry !== rockGeo) o.geometry.dispose();
    });
    this.items.splice(i, 1);
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const c = this.items[i];
      c.life -= dt;
      if (c.life <= 0) {
        this.remove(i);
        continue;
      }
      if (c.life < 1.5) c.g.position.y = -(1 - c.life / 1.5) * 0.3; // sink away
    }
  }
}
