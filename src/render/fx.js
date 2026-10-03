// Tiny pooled cube-particle system for muzzle smoke, blasts and debris.
import * as THREE from 'three';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
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
      this.pool.push({ mesh, vel: new THREE.Vector3(), life: 0, max: 1, delay: 0, s0: 0.2, s1: 0.5, drag: 3, lift: 0.5, stretch: 1, fadeAt: 0.4 });
    }
    this.cursor = 0;
  }

  // One puff. It swells s0 -> s1 quickly, then from `fadeAt` (fraction of its
  // life) it keeps spreading but shrinks away, so smoke thins out and drifts
  // off instead of sitting there.
  spawn(pos, vel, { color = 0xd9dcd6, s0 = 0.15, s1 = 0.5, life = 1, drag = 3, lift = 0.5, delay = 0, stretch = 1, fadeAt = 0.4 } = {}) {
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.pool.length;
    p.mesh.material = toon(color);
    p.mesh.position.copy(pos);
    p.mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    p.mesh.visible = delay <= 0;
    p.mesh.scale.setScalar(s0);
    p.vel.copy(vel);
    Object.assign(p, { life, max: life, delay, s0, s1, drag, lift, stretch, fadeAt });
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
      let s = p.s0 + (p.s1 - p.s0) * easeOut(Math.min(1, u / 0.25));
      if (u > p.fadeAt) s *= 1 - easeOut((u - p.fadeAt) / (1 - p.fadeAt));
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

// Fragmented craters, projected onto whatever was hit. A DecalGeometry is
// cut from the target mesh's own triangles inside a small projector box, so
// a crater on a wall sits on (and wraps round the edges of) that wall, and a
// crater on the ground lies on the ground. Ground hits also leave rim rubble.
const craterTexture = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const cx = 64;
  // soft scorch
  const grad = g.createRadialGradient(cx, cx, 10, cx, cx, 62);
  grad.addColorStop(0, 'rgba(24,19,14,0.85)');
  grad.addColorStop(0.6, 'rgba(30,24,18,0.45)');
  grad.addColorStop(1, 'rgba(30,24,18,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const poly = (pts, fill) => {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fillStyle = fill;
    g.fill();
  };
  // radiating cracks
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + Math.random() * 0.4;
    const r0 = 18;
    const r1 = 40 + Math.random() * 22;
    const w = 2.5 + Math.random() * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const mid = (r0 + r1) / 2;
    const kink = (Math.random() - 0.5) * 8;
    poly([[cx + ca * r0 - sa * w, cx + sa * r0 + ca * w], [cx + ca * mid - sa * kink, cx + sa * mid + ca * kink], [cx + ca * r1, cx + sa * r1], [cx + ca * r0 + sa * w, cx + sa * r0 - ca * w]], '#231d17');
  }
  // jagged pit, darker core
  const pit = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const r = i % 2 ? 17 + Math.random() * 5 : 26 + Math.random() * 7;
    pit.push([cx + Math.cos(a) * r, cx + Math.sin(a) * r]);
  }
  poly(pit, '#3a322a');
  poly(pit.map(([x, y]) => [cx + (x - cx) * 0.55, cx + (y - cx) * 0.55]), '#15120f');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  return tex;
})();

export class Craters {
  constructor(scene, size = 12) {
    this.scene = scene;
    this.size = size;
    this.items = [];
  }

  // at: hit point, normal: world-space surface normal, mesh: what was hit.
  add(at, normal, mesh, radius = 1) {
    if (this.items.length >= this.size) this.remove(0);
    const parts = [];
    if (mesh) {
      mesh.updateMatrixWorld();
      const helper = new THREE.Object3D();
      helper.position.copy(at);
      helper.lookAt(at.clone().add(normal));
      const orientation = helper.rotation.clone();
      orientation.z = Math.random() * Math.PI * 2;
      const geo = new DecalGeometry(mesh, at, orientation, new THREE.Vector3(radius * 2, radius * 2, 0.8));
      const mat = new THREE.MeshToonMaterial({
        map: craterTexture, transparent: true, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
      });
      const decal = new THREE.Mesh(geo, mat);
      decal.receiveShadow = true;
      decal.renderOrder = 2;
      this.scene.add(decal);
      parts.push(decal);
    }
    if (normal.y > 0.7) {
      // rubble kicked up round the rim (ground hits only)
      for (let i = 0; i < 9; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = radius * (0.55 + Math.random() * 0.4);
        const sz = 0.06 + Math.random() * 0.1;
        const rock = new THREE.Mesh(rockGeo, toon(Math.random() < 0.5 ? 0x6b6258 : 0x57504a));
        rock.position.set(at.x + Math.cos(a) * r, at.y + sz * 0.3, at.z + Math.sin(a) * r);
        rock.scale.set(sz, sz * 0.7, sz);
        rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
        rock.castShadow = rock.receiveShadow = true;
        this.scene.add(rock);
        parts.push(rock);
      }
    }
    this.items.push({ parts, life: 10, max: 10 });
  }

  remove(i) {
    for (const o of this.items[i].parts) {
      this.scene.remove(o);
      if (o.geometry !== rockGeo) {
        o.geometry.dispose();
        o.material.dispose();
      }
    }
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
      if (c.life < 2) {
        const k = c.life / 2;
        for (const o of c.parts) {
          if (o.geometry === rockGeo) o.scale.multiplyScalar(0.97);
          else o.material.opacity = k;
        }
      }
    }
  }
}
