// Shared level-building helpers: one place that collects the meshes shells
// hit (colliders), the 2D boxes the tank collides with (blocks), the light
// emitters, per-frame animations, and an instanced batch for the hundreds of
// small debris pieces (one draw call instead of hundreds).
import * as THREE from 'three';
import { toon, gradientMap } from '../models/kit.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export function rng(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return [c, c.getContext('2d')];
}

export function tex(c, color = true) {
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}

// Irregular blob (shell holes, slush, stains).
export function blob(g, cx, cy, rx, ry, rand, pts = 9) {
  g.beginPath();
  for (let i = 0; i < pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const k = 0.6 + rand() * 0.5;
    const x = cx + Math.cos(a) * rx * k;
    const y = cy + Math.sin(a) * ry * k;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.closePath();
  g.fill();
}

export function speckle(g, w, h, colors, n, rand, y0 = 0) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[(rand() * colors.length) | 0];
    g.fillRect((rand() * w) | 0, (y0 + rand() * h) | 0, 1, 1);
  }
}

// A light pool on the ground: a dithered, lumpy patch rather than a clean
// disc, so lamps don't read as stamped circles.
let poolTex = null;
function poolTexture() {
  if (poolTex) return poolTex;
  const S = 64;
  const [c, g] = canvas(S, S);
  const img = g.createImageData(S, S);
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (x - S / 2) / (S / 2);
      const dy = (y - S / 2) / (S / 2);
      const a = Math.atan2(dy, dx);
      const wobble = 1 + 0.12 * Math.sin(a * 3 + 1) + 0.08 * Math.sin(a * 5 + 2);
      const r = Math.hypot(dx, dy) / wobble;
      let v = Math.max(0, 1 - r) ** 1.6;
      const threshold = (bayer[(y % 4) * 4 + (x % 4)] + 0.5) / 16;
      v = Math.floor(v * 4 + threshold) / 4; // four dithered steps
      const i = (y * S + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.min(255, v * 255);
    }
  }
  g.putImageData(img, 0, 0);
  poolTex = tex(c, false);
  return poolTex;
}

// Merged geometry is split into slices this wide along the street, so the
// camera and the sun's shadow camera can skip slices that are off screen.
const CHUNK = 16;
const chunkOf = (x) => Math.floor(x / CHUNK);

export class LevelBuilder {
  constructor(scene, seed) {
    this.rand = rng(seed);
    this.root = new THREE.Group();
    scene.add(this.root);
    this.colliders = [];
    this.blocks = [];
    this.emitters = [];
    this.animated = [];
    this.pieces = [];
    this.lumps = [];
    this.lineMat = new THREE.LineBasicMaterial({ color: 0x17181b });
    this.rustMat = new THREE.LineBasicMaterial({ color: 0x5e4535 });
  }

  add(obj) {
    this.root.add(obj);
    return obj;
  }
  solid(mesh) {
    this.colliders.push(mesh);
    return mesh;
  }
  // every mesh in a group becomes a shell collider
  solidGroup(group) {
    group.traverse((m) => m.isMesh && this.colliders.push(m));
    return group;
  }
  // Blocks and emitters are given in the root's frame like everything else
  // (the root may be offset, as the depot's is), and stored in world space.
  block(x, z, hx, hz, yaw = 0) {
    const b = { x: x + this.root.position.x, z: z + this.root.position.z, hx, hz, yaw };
    this.blocks.push(b);
    return b;
  }
  // invisible box that shells burst on (for heaps made of instanced pieces)
  hitBox(x, y, z, w, h, d, yaw = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
    m.position.set(x, y, z);
    m.rotation.y = yaw;
    m.userData.noDecal = true;
    this.root.add(m);
    this.colliders.push(m);
    return m;
  }
  emit(pos, color, intensity, distance = 9, extra = {}) {
    const e = { pos: pos.clone().add(this.root.position), color: new THREE.Color(color), intensity, distance, level: 1, ...extra };
    this.emitters.push(e);
    return e;
  }
  animate(fn) {
    this.animated.push(fn);
  }

  // A plain box mesh (own geometry, any size).
  chunk(w, h, d, color, x, y, z, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toon(color));
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = m.receiveShadow = true;
    this.root.add(m);
    return m;
  }
  // A small box batched into the shared instanced debris mesh.
  piece(w, h, d, color, x, y, z, rx = 0, ry = 0, rz = 0) {
    this.pieces.push({ w, h, d, color, x, y, z, rx, ry, rz });
  }

  // A rounded lump (snow bank, slush heap, bin bag) batched like pieces.
  lump(x, y, z, sx, sy, sz, color, ry = 0) {
    this.lumps.push({ w: sx, h: sy, d: sz, color, x, y, z, rx: 0, ry, rz: 0 });
  }

  line(points, mat = this.lineMat) {
    return this.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), mat));
  }
  sagging(a, b, sag, mat) {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      pts.push(new THREE.Vector3().lerpVectors(a, b, t).add(new THREE.Vector3(0, -sag * 4 * t * (1 - t), 0)));
    }
    return this.line(pts, mat);
  }
  groundCable(x, z, heading, segs = 18, step = 0.55) {
    const pts = [];
    for (let i = 0; i < segs; i++) {
      pts.push(new THREE.Vector3(x, 0.035, z));
      heading += (this.rand() - 0.5) * 0.7;
      x += Math.cos(heading) * step;
      z += Math.sin(heading) * step;
    }
    return this.line(pts);
  }
  heavyCable(points, r = 0.05, color = 0x1d1f22) {
    const curve = new THREE.CatmullRomCurve3(points);
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, points.length * 8, r, 5), toon(color));
    m.castShadow = true;
    return this.add(m);
  }
  rebar(x, y, z, n = 3) {
    const segs = [];
    const r = this.rand;
    for (let i = 0; i < n; i++) {
      const a = new THREE.Vector3(x + (r() - 0.5) * 0.6, y, z + (r() - 0.5) * 0.6);
      const b = a.clone().add(new THREE.Vector3((r() - 0.5) * 1.0, 0.3 + r() * 0.6, (r() - 0.5) * 1.0));
      segs.push(a, b);
    }
    return this.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(segs), this.rustMat));
  }
  // Additive light on the ground. sx/sz stretch it; yaw turns it.
  pool(x, z, radius, color, opacity, { sx = 1, sz = 1, yaw = 0, y = 0.03 } = {}) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(radius * 2 * sx, radius * 2 * sz),
      new THREE.MeshBasicMaterial({ map: poolTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    m.rotation.set(-Math.PI / 2, 0, yaw);
    m.position.set(x, y, z);
    return this.add(m);
  }

  // Bake the batched pieces into one instanced mesh.
  finish() {
    const material = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap });
    const bake = (all, geometry) => {
      const chunks = new Map();
      for (const p of all) {
        const k = chunkOf(p.x);
        if (!chunks.has(k)) chunks.set(k, []);
        chunks.get(k).push(p);
      }
      for (const list of chunks.values()) bakeOne(list, geometry);
    };
    const bakeOne = (list, geometry) => {
      const inst = new THREE.InstancedMesh(geometry, material, list.length);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const e = new THREE.Euler();
      const c = new THREE.Color();
      list.forEach((p, i) => {
        q.setFromEuler(e.set(p.rx, p.ry, p.rz));
        m.compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(p.w, p.h, p.d));
        inst.setMatrixAt(i, m);
        inst.setColorAt(i, c.set(p.color));
      });
      inst.castShadow = inst.receiveShadow = true;
      inst.computeBoundingSphere();
      this.root.add(inst);
    };
    bake(this.pieces, new THREE.BoxGeometry(1, 1, 1));
    bake(this.lumps, new THREE.IcosahedronGeometry(1, 0));
    this.pieces = [];
    this.lumps = [];
  }

  // Mark a mesh (or group) as animated or swapped at runtime, so the static
  // merge leaves it alone.
  keep(obj) {
    obj.traverse((o) => (o.userData.dynamic = true));
    return obj;
  }

  // Bake every static, opaque mesh into as few meshes as possible: all
  // flat-coloured toon parts become one vertex-coloured mesh (two, split by
  // shadow casting), textured parts one mesh per material, glowing parts one
  // more, and every wire one line set per material. Colliders are baked too;
  // the original stays behind invisible so shells and the aim ray still hit
  // its exact shape (and craters still land on it).
  mergeStatic() {
    this.root.updateMatrixWorld(true);
    // baked into the root's own frame (a root can sit anywhere in the world)
    const toRoot = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    const local = new THREE.Matrix4();
    const solid = new Set(this.colliders);
    const hidden = new THREE.MeshBasicMaterial({ visible: false });
    const buckets = new Map();
    const lines = new Map();
    const remove = [];
    const color = new THREE.Color();
    const bucket = (key, make) => {
      if (!buckets.has(key)) buckets.set(key, { ...make(), geos: [] });
      return buckets.get(key);
    };
    this.root.traverse((o) => {
      if (o.userData.dynamic || !o.visible) return;
      if (o.isMesh && !o.isInstancedMesh && !Array.isArray(o.material) && !o.material.transparent && o.material.visible !== false) {
        const mat = o.material;
        let b;
        let tint = null;
        if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
        const centre = o.geometry.boundingSphere.center.clone().applyMatrix4(o.matrixWorld);
        const ck = chunkOf(centre.x);
        if (mat.isMeshToonMaterial && !mat.map && !mat.emissiveMap) {
          b = bucket(`toon|${o.castShadow}|${ck}`, () => ({ material: (this.vtoon ||= new THREE.MeshToonMaterial({ vertexColors: true, gradientMap })), cast: o.castShadow }));
          tint = mat.color;
        } else if (mat.isMeshBasicMaterial && !mat.map) {
          b = bucket(`basic|${ck}`, () => ({ material: (this.vbasic ||= new THREE.MeshBasicMaterial({ vertexColors: true })), cast: false }));
          tint = mat.color;
        } else {
          b = bucket(`${mat.uuid}|${o.castShadow}|${ck}`, () => ({ material: mat, cast: o.castShadow }));
        }
        let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
        if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        if (!g.attributes.normal) g.computeVertexNormals();
        if (tint) {
          color.copy(tint);
          const n = g.attributes.position.count;
          const c = new Float32Array(n * 3);
          for (let i = 0; i < n; i++) c.set([color.r, color.g, color.b], i * 3);
          g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
        }
        g.clearGroups();
        g.applyMatrix4(local.multiplyMatrices(toRoot, o.matrixWorld));
        b.geos.push(g);
        if (solid.has(o)) {
          o.material = hidden;
          o.castShadow = o.receiveShadow = false;
        } else remove.push(o);
      } else if (o.isLine) {
        const pos = o.geometry.attributes.position;
        o.geometry.computeBoundingSphere();
        const lk = `${o.material.uuid}|${chunkOf(o.geometry.boundingSphere.center.clone().applyMatrix4(o.matrixWorld).x)}`;
        if (!lines.has(lk)) lines.set(lk, { material: o.material, pts: [] });
        const out = lines.get(lk).pts;
        const a = new THREE.Vector3();
        const step = o.isLineSegments ? 2 : 1;
        for (let i = 0; i < pos.count - 1; i += step) {
          local.multiplyMatrices(toRoot, o.matrixWorld);
          out.push(a.fromBufferAttribute(pos, i).applyMatrix4(local).clone(), a.fromBufferAttribute(pos, i + 1).applyMatrix4(local).clone());
        }
        remove.push(o);
      }
    });
    for (const o of remove) o.removeFromParent();
    for (const { material, cast, geos } of buckets.values()) {
      // vertex-coloured buckets need every geometry to carry colours
      const m = new THREE.Mesh(mergeGeometries(geos, false), material);
      m.castShadow = cast;
      m.receiveShadow = true;
      this.root.add(m);
    }
    for (const { material, pts } of lines.values()) this.root.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), material));
  }

  update(dt, t, ctx) {
    for (const f of this.animated) f(dt, t, ctx);
  }

  // Something the tank can drive through: everything `build()` adds (meshes,
  // batched pieces, blocks, shell colliders, light emitters) is gathered into
  // one prop that the game breaks, flattens or knocks over on contact.
  //  kind: 'prop' (bursts into debris and is gone), 'car' (flattens and
  //  stays), 'pole' (topples over at `pivot`, its light dies)
  //  heavy: only a rocket ram (or a dozer blade) gets through it
  //  footprint: { x, z, hx, hz, yaw } for contact when it has no block
  crushable(build, { kind = 'prop', heavy = false, pivot = null, footprint = null, scrap = 0 } = {}) {
    const n0 = this.root.children.length;
    const b0 = this.blocks.length;
    const c0 = this.colliders.length;
    const e0 = this.emitters.length;
    const p0 = this.pieces.length;
    const l0 = this.lumps.length;
    build();
    const g = new THREE.Group();
    if (pivot) g.position.set(pivot.x, pivot.y ?? 0, pivot.z);
    this.root.add(g);
    const fx = []; // transparent bits (light pools, soot): stay put, hidden on crush
    for (const o of this.root.children.slice(n0)) {
      if (o === g) continue;
      if (o.isMesh && o.material.transparent) fx.push(o);
      else g.attach(o);
    }
    // batched pieces made during build() become real meshes of this prop
    const asMesh = (p, geo) => {
      const m = new THREE.Mesh(geo, toon(p.color));
      m.position.set(p.x, p.y, p.z);
      m.rotation.set(p.rx, p.ry, p.rz);
      m.scale.set(p.w, p.h, p.d);
      m.castShadow = m.receiveShadow = true;
      g.attach(m);
    };
    for (const p of this.pieces.splice(p0)) asMesh(p, (this.unitBox ||= new THREE.BoxGeometry(1, 1, 1)));
    for (const p of this.lumps.splice(l0)) asMesh(p, (this.unitLump ||= new THREE.IcosahedronGeometry(1, 0)));
    const blocks = this.blocks.slice(b0);
    const colliders = this.colliders.slice(c0);
    const emitters = this.emitters.slice(e0);
    // colours for the debris it bursts into
    const colors = [];
    g.traverse((m) => m.isMesh && m.material.color && m.material.visible !== false && colors.push(m.material.color.getHex()));
    mergeProp(g, new Set(colliders));
    this.keep(g);
    let fp = footprint;
    if (!fp && blocks.length) fp = blocks[0];
    if (!fp) {
      const bb = new THREE.Box3().setFromObject(g);
      fp = { x: (bb.min.x + bb.max.x) / 2, z: (bb.min.z + bb.max.z) / 2, hx: Math.max(0.2, (bb.max.x - bb.min.x) / 2), hz: Math.max(0.2, (bb.max.z - bb.min.z) / 2), yaw: 0 };
    }
    const c = { kind, heavy, group: g, blocks, colliders, emitters, fx, colors, footprint: fp, scrap, done: false };
    (this.crushables ||= []).push(c);
    return c;
  }
}

// Bake a prop's meshes into one vertex-coloured mesh (plus one per textured
// material, plus one for glowing parts), in the prop's own frame, so a
// crushable costs a draw call or two instead of dozens. Shell colliders stay
// as invisible copies for exact hits.
function mergeProp(g, solid) {
  g.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
  const buckets = new Map();
  const remove = [];
  const hidden = new THREE.MeshBasicMaterial({ visible: false });
  const m4 = new THREE.Matrix4();
  g.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || o.material.visible === false || o.material.transparent || o.material.alphaTest) return;
    const mat = o.material;
    let key;
    let tint = null;
    if (mat.isMeshToonMaterial && !mat.map) {
      key = `toon|${o.castShadow}`;
      tint = mat.color;
    } else if (mat.isMeshBasicMaterial && !mat.map) {
      key = 'glow';
      tint = mat.color;
    } else key = mat.uuid;
    if (!buckets.has(key)) buckets.set(key, { mat, tint: !!tint, cast: o.castShadow, geos: [] });
    let geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    if (!geo.attributes.normal) geo.computeVertexNormals();
    if (tint) {
      const n = geo.attributes.position.count;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) col.set([tint.r, tint.g, tint.b], i * 3);
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    }
    geo.clearGroups();
    geo.applyMatrix4(m4.multiplyMatrices(inv, o.matrixWorld));
    buckets.get(key).geos.push(geo);
    if (solid.has(o)) {
      o.material = hidden;
      o.castShadow = o.receiveShadow = false;
    } else remove.push(o);
  });
  for (const o of remove) o.removeFromParent();
  // drop now-empty groups
  const empty = [];
  g.traverse((o) => o !== g && !o.isMesh && !o.isLine && o.children.length === 0 && empty.push(o));
  for (const o of empty) o.removeFromParent();
  for (const [key, b] of buckets) {
    if (!b.geos.length) continue;
    let material = b.mat;
    if (key === 'glow') material = new THREE.MeshBasicMaterial({ vertexColors: true });
    else if (b.tint) material = (mergeProp.vtoon ||= new THREE.MeshToonMaterial({ vertexColors: true, gradientMap }));
    const m = new THREE.Mesh(mergeGeometries(b.geos, false), material);
    m.castShadow = key === 'glow' ? false : b.cast;
    m.receiveShadow = key !== 'glow';
    if (key === 'glow') m.userData.glow = true;
    g.add(m);
  }
}
