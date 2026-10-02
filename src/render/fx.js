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
