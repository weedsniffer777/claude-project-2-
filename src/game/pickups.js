// Drops: amber scrap shards (the run's currency), bigger blue scrap
// crystals (worth five), green medkits (repairs) and, rarely, a violet
// upgrade token. They burst out of a kill, hang for a beat, then fly to the
// tank once it's close; out of reach they wait, bobbing, and fade out after a
// while. An instanced mesh per shape (plus a soft halo each). They never
// settle outside the area the tank can drive in (bounds).
import * as THREE from 'three';
import { tokenCanvas } from '../ui/icons.js';

const MAX = 120;
const GRAVITY = 16;
const MAGNET = 7; // reach at which drops start flying to the tank
const GRAB = 1.3;
const LIFE = 22;
export const SCRAP_COLOR = 0xffb347;
export const BIG_SCRAP_COLOR = 0x5fb8ff;
export const REPAIR_COLOR = 0x4fdc6a;
export const TOKEN_COLOR = 0xc77dff;
const COLORS = { scrap: SCRAP_COLOR, bigscrap: BIG_SCRAP_COLOR, repair: 0xffffff, token: 0xffffff };
const HALO = { scrap: SCRAP_COLOR, bigscrap: BIG_SCRAP_COLOR, repair: REPAIR_COLOR, token: TOKEN_COLOR };
const SIZE = { scrap: 0.17, bigscrap: 0.3, repair: 0.24, token: 0.24 };

// the token coin's faces: the token icon (a violet coin, an up arrow)
let faceMat = null;
function coinFace() {
  if (faceMat) return faceMat;
  const t = new THREE.CanvasTexture(tokenCanvas(1));
  t.magFilter = t.minFilter = THREE.NearestFilter;
  faceMat = new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.5 });
  return faceMat;
}

// the medkit: a green box, a white cross on every face
let kitTex = null;
function medkitTexture() {
  if (kitTex) return kitTex;
  const c = document.createElement('canvas');
  c.width = c.height = 8;
  const g = c.getContext('2d');
  g.fillStyle = '#3fbf58';
  g.fillRect(0, 0, 8, 8);
  g.fillStyle = '#2a8a3c';
  g.fillRect(0, 7, 8, 1);
  g.fillStyle = '#ffffff';
  g.fillRect(3, 1, 2, 6);
  g.fillRect(1, 3, 6, 2);
  kitTex = new THREE.CanvasTexture(c);
  kitTex.magFilter = kitTex.minFilter = THREE.NearestFilter;
  return kitTex;
}

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
    // a mesh per shape: shards and crystals, medkits, tokens (coins)
    const coin = new THREE.CylinderGeometry(1, 1, 0.35, 16);
    coin.rotateX(Math.PI / 2);
    this.meshes = {
      shard: new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX),
      kit: new THREE.InstancedMesh(new THREE.BoxGeometry(1.3, 0.9, 1.3), new THREE.MeshBasicMaterial({ map: medkitTexture() }), MAX),
      coin: new THREE.InstancedMesh(coin, [new THREE.MeshBasicMaterial({ color: 0x6a2fa8 }), coinFace(), coinFace()], MAX),
    };
    for (const m of Object.values(this.meshes)) {
      m.frustumCulled = false;
      m.count = 0;
      m.setColorAt(0, new THREE.Color(1, 1, 1));
      scene.add(m);
    }
    this.mesh = this.meshes.shard;
    this.bounds = null; // where the tank can drive: drops settle inside it
    this.halo = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: haloTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffffff }),
      MAX,
    );
    this.halo.frustumCulled = false;
    this.halo.count = 0;
    this.halo.setColorAt(0, new THREE.Color(1, 1, 1)); // colour buffers exist from the first frame
    scene.add(this.halo);
    this.list = [];
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
    this.c = new THREE.Color();
  }

  // a burst of n drops of `kind` ('scrap' | 'bigscrap' | 'repair' |
  // 'token'), each worth `value`
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
        size: SIZE[kind] * (0.9 + Math.random() * 0.2),
      });
    }
  }

  // Pull everything in (between sectors nothing gets left behind).
  collectAll(onCollect) {
    for (const p of this.list) onCollect(p);
    this.list.length = 0;
    for (const m of Object.values(this.meshes)) m.count = 0;
    this.halo.count = 0;
  }

  update(dt, t, tankPos, camera, onCollect) {
    const { m, q, e, c } = this;
    let n = 0;
    const counts = { shard: 0, kit: 0, coin: 0 };
    const b = this.bounds;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.t += dt;
      const dx = tankPos.x - p.pos.x;
      const dz = tankPos.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      if (!p.homing && p.t > p.hang && d < MAGNET * (this.magnet || 1)) {
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
        // out where the tank can't go (a side street, over a wall): it
        // bounces back in
        if (b) {
          const lo = (v, min) => (min != null && v < min + 0.6 ? min + 0.6 : v);
          const hi = (v, max) => (max != null && v > max - 0.6 ? max - 0.6 : v);
          p.pos.x = hi(lo(p.pos.x, b.minX), b.maxX);
          p.pos.z = hi(lo(p.pos.z, b.minZ), b.maxZ);
        }
        const floor = (this.heightAt ? this.heightAt(p.pos.x, p.pos.z) : 0) + 0.35 + Math.sin(t * 4 + p.spin) * 0.08; // (on a raised deck, on the deck)
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
      const shape = p.kind === 'repair' ? 'kit' : p.kind === 'token' ? 'coin' : 'shard';
      const mesh = this.meshes[shape];
      if (shape === 'kit') q.setFromEuler(e.set(0, t * 1.5 + p.spin, 0));
      else if (shape === 'coin') q.setFromEuler(e.set(0, t * 3 + p.spin, 0));
      else q.setFromEuler(e.set(0.3, t * 4 + p.spin, 0.2));
      m.compose(p.pos, q, new THREE.Vector3(s, shape === 'shard' ? s * 1.4 : s, s));
      mesh.setMatrixAt(counts[shape], m);
      mesh.setColorAt(counts[shape]++, c.set(COLORS[p.kind]));
      // halo faces the camera
      m.compose(p.pos, camera.quaternion, new THREE.Vector3(s * 5, s * 5, s * 5));
      this.halo.setMatrixAt(n, m);
      this.halo.setColorAt(n, c.set(HALO[p.kind]).multiplyScalar(p.kind === 'token' ? 0.8 : 0.55));
      n++;
    }
    for (const [k, mesh] of Object.entries(this.meshes)) {
      mesh.count = counts[k];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    this.halo.count = n;
    this.halo.instanceMatrix.needsUpdate = true;
    if (this.halo.instanceColor) this.halo.instanceColor.needsUpdate = true;
  }

  dispose() {
    for (const m of Object.values(this.meshes)) m.removeFromParent();
    this.halo.removeFromParent();
  }
}
