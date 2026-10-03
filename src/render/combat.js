// Combat effects shared by the game and the model viewer: the cannon's tracer
// shell, muzzle blast and explosion, the roof MG's tracers and brass, and
// camera shake. One instance per scene.
import * as THREE from 'three';
import { Fx, Glow } from './fx.js';

const SHELL_SPEED = 90; // near-instant: a bright streak, not a lobbed ball

export class CombatFx {
  constructor(scene) {
    this.scene = scene;
    this.fx = new Fx(scene, 220);
    this.glow = new Glow(scene);
    this.shells = [];
    this.shake = 0;
    this.offset = new THREE.Vector3();
  }

  // Fires the tank's cannon toward aimPoint (or straight out when null).
  // Returns false when the tank refuses to fire (gun lifted over the drums).
  fireCannon(tank, aimPoint) {
    const shot = tank.fire();
    if (!shot) return false;
    const { fx, glow } = this;
    const { position, direction } = shot;
    glow.flash(position, 0xfff4cf, 0.15, 0.7, 0.07);
    glow.flash(position, 0xffa640, 0.3, 1.35, 0.14);
    glow.flash(position.clone().addScaledVector(direction, 0.7), 0xffc35a, 0.2, 0.75, 0.1);
    glow.light(position, 0xffa24a, 45, 0.16);
    fx.burst(position, { count: 10, speed: 5, color: 0xffd060, life: 0.16, size: 0.13 });
    fx.burst(position, { count: 12, speed: 2.4, color: 0x8b9099, glow: false, life: 1.3, size: 0.28, grow: 0.9, gravity: -0.6 });
    fx.burst(new THREE.Vector3(position.x, 0.08, position.z), { count: 10, speed: 2.5, color: 0x9a8a6a, glow: false, life: 0.8, size: 0.2, grow: 0.8, gravity: -0.2 });
    this.shake = Math.max(this.shake, 0.12);

    // Land where the gun points, at the aim point's distance (or 9 units out).
    const flat = new THREE.Vector3(direction.x, 0, direction.z).normalize();
    const dist = aimPoint ? THREE.MathUtils.clamp(Math.hypot(aimPoint.x - position.x, aimPoint.z - position.z), 2.5, 14) : 9;
    const target = new THREE.Vector3(position.x, 0.05, position.z).addScaledVector(flat, dist);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 1.1), new THREE.MeshBasicMaterial({ color: 0xfff0b0 }));
    mesh.position.copy(position);
    mesh.lookAt(target);
    this.scene.add(mesh);
    this.shells.push({ mesh, from: position.clone(), target, travelled: 0, total: position.distanceTo(target) });
    return true;
  }

  explode(at) {
    const { fx, glow } = this;
    const p = new THREE.Vector3(at.x, 0.25, at.z);
    glow.flash(p, 0xffffff, 0.3, 1.6, 0.1);
    glow.flash(p, 0xffb347, 0.6, 2.6, 0.32);
    glow.flash(p, 0xff6a2a, 0.8, 2.1, 0.5);
    glow.ring(new THREE.Vector3(at.x, 0.06, at.z), 0xffd59a, 0.4, 3.6, 0.4);
    glow.light(p, 0xff8c3a, 110, 0.35);
    glow.scorch(at, 1.1);
    fx.burst(p, { count: 18, speed: 7, color: 0xffd36b, life: 0.35, size: 0.24 });
    fx.burst(p, { count: 22, speed: 6, color: 0xff7a2e, life: 0.6, size: 0.22, gravity: 7 });
    fx.burst(p, { count: 16, speed: 2.6, color: 0x4a4e55, glow: false, life: 1.6, size: 0.42, grow: 0.8, gravity: -1.4 });
    fx.burst(p, { count: 14, speed: 7.5, color: 0x6b5a45, glow: false, life: 1.1, size: 0.12, gravity: 15 });
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
        this.explode(s.target);
        this.removeShell(i);
      }
    }
    this.fx.update(dt);
    this.glow.update(dt);
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
