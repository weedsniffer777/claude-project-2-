// Drops: glowing amber scrap shards (the run's currency) and the odd cyan
// repair spark. They burst out of a kill, hang for a beat, then fly to the
// tank once it's close; out of reach they wait, bobbing, and fade out after a
// while. One instanced mesh for all of them (plus a soft halo each).
import * as THREE from 'three';

const MAX = 120;
const GRAVITY = 16;
const MAGNET = 7; // reach at which drops start flying to the tank
const GRAB = 1.3;
const LIFE = 22;
export const SCRAP_COLOR = 0xffb347;
export const REPAIR_COLOR = 0x5fe6ff;

let haloTex = null;
function haloTexture() {
  if (haloTex) return haloTex;
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  // stepped, pixel-style glow
  for (const [r, a] of [[8, 0.18], [6, 0.32], [4, 0.6]]) {
    g.fillStyle = `rgba(255,255,255,${a})`;
    g.beginPath();
    g.arc(8, 8, r, 0, Math.PI * 2);
    g.fill();
  }
  haloTex = new THREE.CanvasTexture(c);
  haloTex.magFilter = haloTex.minFilter = THREE.NearestFilter;
  return haloTex;
}

export class Pickups {
  constructor(scene) {
    this.mesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.halo = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: haloTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffffff }),
      MAX,
    );
    this.halo.frustumCulled = false;
    this.halo.count = 0;
    this.mesh.setColorAt(0, new THREE.Color(1, 1, 1)); // colour buffers exist from the first frame
    this.halo.setColorAt(0, new THREE.Color(1, 1, 1));
    scene.add(this.mesh, this.halo);
    this.list = [];
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
    this.c = new THREE.Color();
  }

  // a burst of n drops of `kind` ('scrap' | 'repair'), each worth `value`
  spawn(at, n, kind = 'scrap', value = 1) {
    for (let i = 0; i < n; i++) {
      if (this.list.length >= MAX) this.list.shift();
      const a = Math.random() * Math.PI * 2;
      const s = 2 + Math.random() * 3;
      this.list.push({
        kind,
        value,
        pos: new THREE.Vector3(at.x, Math.max(0.5, at.y), at.z),
        vel: new THREE.Vector3(Math.cos(a) * s, 5 + Math.random() * 4, Math.sin(a) * s),
        t: 0,
        hang: 0.35 + Math.random() * 0.25,
        homing: false,
        spin: Math.random() * 6,
        size: kind === 'repair' ? 0.26 : 0.15 + Math.random() * 0.05,
      });
    }
  }

  // Pull everything in (between sectors nothing gets left behind).
  collectAll(onCollect) {
    for (const p of this.list) onCollect(p);
    this.list.length = 0;
    this.mesh.count = this.halo.count = 0;
  }

  update(dt, t, tankPos, camera, onCollect) {
    const { m, q, e, c } = this;
    let n = 0;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.t += dt;
      const dx = tankPos.x - p.pos.x;
      const dz = tankPos.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      if (!p.homing && p.t > p.hang && d < MAGNET) {
        p.homing = true;
        p.vel.y = Math.max(p.vel.y, 3);
      }
      if (p.homing) {
        // accelerate toward the tank's deck, curving in
        const k = 14 + p.t * 30;
        const to = new THREE.Vector3(dx, tankPos.y + 1.2 - p.pos.y, dz);
        const len = to.length() || 1;
        p.vel.addScaledVector(to, (k * dt) / len);
        p.vel.multiplyScalar(Math.exp(-dt * 3));
        p.pos.addScaledVector(p.vel, dt);
        if (len < GRAB) {
          onCollect(p);
          this.list.splice(i, 1);
          continue;
        }
      } else {
        p.vel.y -= GRAVITY * dt;
        p.pos.addScaledVector(p.vel, dt);
        const floor = 0.35 + Math.sin(t * 4 + p.spin) * 0.08;
        if (p.pos.y < floor) {
          p.pos.y = floor;
          p.vel.y = Math.abs(p.vel.y) * 0.35;
          p.vel.x *= 0.5;
          p.vel.z *= 0.5;
          if (Math.abs(p.vel.y) < 1) p.vel.y = 0;
        }
        if (p.t > LIFE) {
          this.list.splice(i, 1);
          continue;
        }
      }
      // blink before vanishing
      if (!p.homing && p.t > LIFE - 3 && Math.sin(p.t * 20) < 0) continue;
      const s = p.size * (p.t < 0.1 ? 1.6 : 1);
      q.setFromEuler(e.set(0.3, t * 4 + p.spin, 0.2));
      m.compose(p.pos, q, new THREE.Vector3(s, s * 1.4, s));
      this.mesh.setMatrixAt(n, m);
      this.mesh.setColorAt(n, c.set(p.kind === 'repair' ? REPAIR_COLOR : SCRAP_COLOR));
      // halo faces the camera
      m.compose(p.pos, camera.quaternion, new THREE.Vector3(s * 5, s * 5, s * 5));
      this.halo.setMatrixAt(n, m);
      this.halo.setColorAt(n, c.multiplyScalar(0.55));
      n++;
    }
    this.mesh.count = this.halo.count = n;
    this.mesh.instanceMatrix.needsUpdate = this.halo.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    if (this.halo.instanceColor) this.halo.instanceColor.needsUpdate = true;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.halo.removeFromParent();
  }
}
