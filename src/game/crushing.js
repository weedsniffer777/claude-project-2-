// Things the tank drives through. Levels register crushables (see
// LevelBuilder.crushable); on contact the game breaks them:
//  - props burst into tumbling bits that settle and shrink away
//  - cars squash flat and stay as a low wreck you can drive over
//  - poles topple away from the tank, their lamps going dark
// Heavy ones (a barricade of wrecks) only give way to a rocket ram.
import * as THREE from 'three';
import { separate } from './collide.js';
import { toon } from '../models/kit.js';

const dark = toon(0x262729);

export class Crushing {
  constructor(list, { combat, removeBlock, removeCollider }) {
    this.list = list || [];
    this.combat = combat;
    this.removeBlock = removeBlock;
    this.removeCollider = removeCollider;
    this.anims = [];
  }

  // tankBox: the tank's 2D box; ram: 'boost' or 'dozer' (a blade), so heavy
  // things break too (breakables only to the boost). Returns the props crushed this frame.
  update(dt, tankBox, { ram = false, speed = 0, onCrush } = {}) {
    const out = [];
    if (Math.abs(speed) > 0.6 || ram) {
      const reach = 4;
      const probe = { ...tankBox, hx: tankBox.hx + 0.12, hz: tankBox.hz + 0.12 };
      for (const c of this.list) {
        if (c.done) continue;
        const f = c.footprint;
        if (Math.abs(f.x - tankBox.x) > reach + f.hx || Math.abs(f.z - tankBox.z) > reach + f.hz) continue;
        if (c.armored || (c.heavy && !ram)) continue;
        if (c.breakable && ram !== 'boost') continue; // barricades and gates: a shell or the boost, not the blade
        if (!separate(probe, f)) continue;
        this.crush(c, tankBox);
        out.push(c);
        onCrush?.(c);
      }
    }
    for (let i = this.anims.length - 1; i >= 0; i--) if (!this.anims[i](dt)) this.anims.splice(i, 1);
    return out;
  }

  crush(c, from) {
    c.done = true;
    for (const b of c.blocks) this.removeBlock(b);
    for (const m of c.colliders) this.removeCollider(m);
    if (c.onBreak?.(from) === true) return; // the level broke it its own way (the gate, the end wall)
    const { combat } = this;
    const g = c.group;
    const f = c.footprint;
    const at = new THREE.Vector3(f.x, 0.3, f.z);
    const away = new THREE.Vector3(f.x - from.x, 0, f.z - from.z);
    if (away.lengthSq() < 0.01) away.set(Math.cos(from.yaw), 0, -Math.sin(from.yaw));
    away.normalize();
    const pick = () => c.colors[(Math.random() * c.colors.length) | 0] ?? 0x5e5a52;
    const bits = (n, speed, size) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = new THREE.Vector3(Math.cos(a) * speed * Math.random() + away.x * speed, 2.5 + Math.random() * 4, Math.sin(a) * speed * Math.random() + away.z * speed);
        combat.debris.spawn(at.clone().add(new THREE.Vector3((Math.random() - 0.5) * f.hx, Math.random() * 0.5, (Math.random() - 0.5) * f.hz)), v, { color: pick(), size: size * (0.6 + Math.random() * 0.8), life: 3.5 + Math.random() });
      }
    };
    const dust = (n, color = 0xa8a49a) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        combat.puffs.spawn(at.clone().setY(0.2), new THREE.Vector3(Math.cos(a) * 2.4, 0.5, Math.sin(a) * 2.4), { color, s0: 0.15, s1: 0.5 + Math.random() * 0.3, life: 0.8, drag: 3, lift: 0.5, fadeAt: 0.3 });
      }
    };
    for (const e of c.emitters) {
      e.level = 0;
      e.dead = true;
    }
    for (const m of c.fx) if (!m.userData.soot) m.visible = false;

    if (c.kind === 'car') {
      // squash flat, then a little settle; it stays as a low wreck
      const y0 = g.position.y;
      const roll = (Math.random() - 0.5) * 0.12;
      let t = 0;
      this.anims.push((dt) => {
        t += dt;
        const k = Math.min(1, t / 0.14);
        g.scale.y = 1 - k * 0.68;
        g.position.y = y0 - k * 0.02;
        g.rotation.x = roll * k;
        return t < 0.14;
      });
      bits(12, 3, 0.16);
      combat.fx.burst(at.clone().setY(0.6), { count: 10, speed: 5, color: 0xffd36b, life: 0.3, size: 0.06, gravity: 12 });
      dust(8);
      combat.shake = Math.max(combat.shake, 0.18);
    } else if (c.kind === 'topple') {
      // falls over away from the hit, lies there a moment, sinks away
      const axis = new THREE.Vector3(0, 1, 0).cross(away).normalize();
      const q0 = g.quaternion.clone();
      const q = new THREE.Quaternion();
      const y0 = g.position.y;
      let t = 0;
      this.anims.push((dt) => {
        t += dt;
        const k = Math.min(1, (t / 0.55) ** 2);
        q.setFromAxisAngle(axis, 1.5 * k);
        g.quaternion.copy(q).multiply(q0);
        if (t > 3) g.position.y = y0 - (t - 3) * 2;
        if (t > 4.2) g.visible = false;
        return t <= 4.2;
      });
      bits(14, 3.5, 0.18);
      dust(10, 0x9d988c);
      combat.shake = Math.max(combat.shake, 0.3);
    } else if (c.kind === 'pole') {
      // topple away from the tank around its foot
      const axis = new THREE.Vector3(0, 1, 0).cross(away).normalize();
      const q0 = g.quaternion.clone();
      const fallTo = 1.45 + Math.random() * 0.1;
      let t = 0;
      let landed = false;
      const q = new THREE.Quaternion();
      this.anims.push((dt) => {
        t += dt;
        const k = Math.min(1, (t / 0.6) ** 2);
        q.setFromAxisAngle(axis, fallTo * k);
        g.quaternion.copy(q).multiply(q0);
        if (k >= 1 && !landed) {
          landed = true;
          const tip = new THREE.Vector3(f.x, 0.2, f.z).addScaledVector(away, 4);
          for (let i = 0; i < 6; i++) {
            const a = Math.random() * Math.PI * 2;
            combat.puffs.spawn(tip.clone().addScaledVector(away, (Math.random() - 0.5) * 3), new THREE.Vector3(Math.cos(a) * 1.5, 0.4, Math.sin(a) * 1.5), { color: 0xb6b3aa, s0: 0.12, s1: 0.4, life: 0.7, drag: 3, lift: 0.4, fadeAt: 0.3 });
          }
          combat.shake = Math.max(combat.shake, 0.12);
        }
        return k < 1;
      });
      g.traverse((m) => {
        if (m.userData.glow) m.material = dark; // the lamp dies
      });
      combat.fx.burst(at.clone().setY(1), { count: 8, speed: 4, color: 0xfff3c4, life: 0.25, size: 0.06, gravity: 10 });
      dust(4);
    } else {
      g.visible = false;
      bits(Math.min(14, 6 + Math.round((f.hx + f.hz) * 3)), 2.6, 0.14);
      dust(5);
      combat.shake = Math.max(combat.shake, 0.08);
    }
  }
}
