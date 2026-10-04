// City building blocks shared by the levels: panel blocks with their
// facade on a street, low shopfront blocks on the near side, works
// buildings (sawtooth, gable or flat roofs, tin or brick), containers,
// jersey barriers, rubble heaps.
//   const K = cityKit(B, { WALK, SW, heightAt });
//   K.building({ x0, x1, zf, floors, ... }); K.southBlock(x0, x1, floors, zf);
//   K.works({ x0, x1, zf, side, roof, wall, tin, doors, dock });
import * as THREE from 'three';
import { box, cyl, put, toon, gradientMap } from '../models/kit.js';
import { canvas, tex } from './builder.js';
import * as P from './props.js';
import { FH, glyphSign, facadeTextures, endTexture, facadeMat, mapMat } from './cityTextures.js';

export const PANELS = ['#9a978f', '#a5a095', '#91959a', '#aca393', '#8b8e92'];
export const ACCENTS = ['#5f8784', '#a3874e', '#5c6f8c', '#8f8550', '#6f7f6a'];
export const PAINT = [0x8a8172, 0x6d7a72, 0x5d6b80, 0x9b9277, 0x707a5c, 0xb3ad9c];
export const CONCRETE = [0x8d8b86, 0x7d7c78, 0x9a978f, 0x6f6e6b, 0x85898c];
export const BURNT_PAINT = [0x5d6b80, 0x8a8172, 0x6f7f6a, 0x9b9277, null, 0x7a6a5a];
export const CONTAINERS = [0x7a4a36, 0x4f6b6a, 0x6b6f72, 0x8a6a3a, 0x3f5470];

export function cityKit(B, { WALK, SW = 0.16, heightAt = () => 0 } = {}) {
  const rand = B.rand;
  const sign = (w, h, o = {}) => mapMat(glyphSign(w, h, { rand, ...o }));
  const ribs = (() => {
    const [c, g] = canvas(16, 16);
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 16, 16);
    g.fillStyle = '#c9c9c9';
    for (let x = 0; x < 16; x += 4) g.fillRect(x, 0, 2, 16);
    g.fillStyle = '#9a9a9a';
    g.fillRect(0, 0, 16, 1);
    g.fillRect(0, 15, 16, 1);
    const t = tex(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(5, 1);
    return t;
  })();
  const ribMat = (w, h, color) => {
    const t = ribs.clone();
    t.needsUpdate = true;
    t.repeat.set(w / 1.2, h / 2.6);
    return new THREE.MeshToonMaterial({ map: t, color, gradientMap });
  };
  // A panel block with its facade to the street (zf), going back depth.
  function building(o) {
    const { x0, x1, zf = WALK.n, depth = 13, floors } = o;
    const w = x1 - x0;
    const H = floors * FH + 0.5;
    const cols = Math.max(2, Math.round(w / 1.7));
    const cw = w / cols;
    const look = { panel: o.panel ?? PANELS[(rand() * 5) | 0], accent: o.accent ?? ACCENTS[(rand() * 5) | 0], broken: o.broken ?? 0.25, holes: o.holes ?? 1, shop: o.shop };
    const front = facadeMat(facadeTextures(w, floors, look, rand));
    const end = mapMat(endTexture(depth, floors, look, rand, !!o.mural));
    const roof = toon(0xc6c9ce);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, depth), [end, end, roof, roof, front, end]);
    m.position.set((x0 + x1) / 2, H / 2, zf - depth / 2);
    m.castShadow = m.receiveShadow = true;
    B.add(m);
    B.solid(m);
    B.block((x0 + x1) / 2, zf - depth / 2, w / 2, depth / 2);
    for (let k = 0; k < cols; k++) {
      if (k % 3 !== 1 || rand() < 0.3) continue;
      const bx = x0 + (k + 0.5) * cw;
      for (let f = 1; f < floors; f++) {
        if (rand() < 0.12) continue;
        const y = f * FH + 0.28;
        B.piece(cw * 0.8, 0.55, 0.45, rand() < 0.4 ? 0xb9b4a6 : PAINT[(rand() * PAINT.length) | 0], bx, y, zf + 0.22, 0, 0, rand() < 0.05 ? 0.4 : 0);
        B.piece(cw * 0.86, 0.07, 0.55, 0x7b7a76, bx, y - 0.3, zf + 0.26);
        if (rand() < 0.5) B.piece(cw * 0.7, 0.05, 0.4, 0xd5d8dc, bx, y + 0.3, zf + 0.22);
      }
    }
    if (o.shop) for (let k = 0; k < cols; k++) if (rand() > 0.3) B.piece(cw * 0.9, 0.05, 0.9, [0x5c6f8c, 0x6f7f6a, 0x8f8550][k % 3], x0 + (k + 0.5) * cw, 1.45 - rand() * 0.3, zf + 0.42, -0.35 - rand() * 0.5, 0, (rand() - 0.5) * 0.3);
    P.facadeClutter(B, x0, x1, zf, H);
    for (let i = 0; i < 3; i++) B.piece(0.6 + rand(), 0.5 + rand() * 0.6, 0.6 + rand(), 0x7b7a76, x0 + 1 + rand() * (w - 2), H + 0.3, zf - 2 - rand() * (depth - 4));
    B.lump((x0 + x1) / 2, H + 0.05, zf - depth / 2, w / 2.4, 0.12, depth / 2.8, 0xd0d3d8);
    if (o.sign) {
      const sw = Math.min(w * 0.6, 8);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(sw, 0.55), sign(sw, 0.55, { ink: o.sign }));
      s.position.set(x0 + w * 0.35, 1.08, zf + 0.06);
      B.add(s);
    }
  }
  // low blocks on the near (south) side, shopfronts facing the street
  function southBlock(x0, x1, floors, zf = WALK.s + 0.3) {
    const depth = 13;
    const w = x1 - x0;
    const H = floors * FH + 0.5;
    const look = { panel: PANELS[(rand() * 5) | 0], accent: ACCENTS[(rand() * 5) | 0], broken: 0.35, holes: 1, shop: true };
    const front = facadeMat(facadeTextures(w, floors, look, rand));
    const end = mapMat(endTexture(depth, floors, look, rand, false));
    const roof = toon(0xc6c9ce);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, depth), [end, end, roof, roof, end, front]);
    m.position.set((x0 + x1) / 2, H / 2, zf + depth / 2);
    m.castShadow = m.receiveShadow = true;
    B.add(m);
    B.solid(m);
    B.block((x0 + x1) / 2, zf + depth / 2, w / 2, depth / 2);
    for (let x = x0 + 1.2; x < x1 - 1; x += 2.6) if (rand() < 0.7) B.piece(1.8, 0.06, 0.9, [0x5c6f8c, 0x6f7f6a, 0x8f8550][(rand() * 3) | 0], x, 1.45, zf - 0.42, 0.4, 0, 0);
    B.piece(w, 0.3, 0.2, 0x8d8b86, (x0 + x1) / 2, H + 0.15, zf + 0.1);
    B.lump((x0 + x1) / 2, H + 0.05, zf + depth / 2, w / 2.2, 0.12, depth / 2.6, 0xd0d3d8);
  }
  // A works building in among the blocks, its front on the street (zf;
  // side 'n': it runs back north, 's' south). Ribbed tin or brick walls,
  // and one of three roofs: a sawtooth of north lights, a long gable, or
  // flat behind a parapet with vents and a water tank. Roller doors (some
  // part open), a loading dock, high windows, a name board, drainpipes.
  const BRICK = 0x8a5a44;
  function works(o) {
    const { x0, x1, zf, side = 'n', depth = 14, roof = 'saw', wall = 0x8a9a8e, tin = true, doors = 2, dock = false, H = 4.4 } = o;
    const w = x1 - x0;
    const s = side === 'n' ? -1 : 1; // the way back from the street
    const zc = zf + (s * depth) / 2;
    const out = -s; // the facade faces out this way
    const walls = new THREE.Mesh(new THREE.BoxGeometry(w, H, depth), tin ? ribMat(Math.max(w, depth), H, wall) : toon(wall));
    walls.position.set((x0 + x1) / 2, H / 2, zc);
    walls.castShadow = walls.receiveShadow = true;
    B.add(walls);
    B.solid(walls);
    B.block((x0 + x1) / 2, zc, w / 2, depth / 2);
    if (!tin) {
      // brick: courses and a darker plinth
      for (let y = 0.4; y < H; y += 0.5) B.piece(w + 0.02, 0.04, 0.03, 0x6f4636, (x0 + x1) / 2, y, zf + out * 0.01);
      B.piece(w + 0.04, 0.6, 0.06, 0x5a4a40, (x0 + x1) / 2, 0.3, zf + out * 0.02);
    }
    if (roof === 'saw') {
      for (let x = x0 + 1.5; x < x1 - 0.5; x += 3) {
        put(B.root, box(3.1, 0.12, depth, 0x6d6a64, { r: 0.02 }), x, H + 0.55, zc).rotation.z = 0.35;
        put(B.root, box(0.06, 0.9, depth - 0.2, 0x8fa4b0, { r: 0.01 }), x + 1.42, H + 0.5, zc);
        B.lump(x - 0.3, H + 0.7, zc, 1.2, 0.08, depth / 2.6, 0xd6d9dd);
      }
    } else if (roof === 'gable') {
      for (const k of [-1, 1]) {
        const p = put(B.root, box(w + 0.4, 0.14, depth / 2 + 0.6, 0x7a6f62, { r: 0.02 }), (x0 + x1) / 2, H + 0.9, zc + k * depth * 0.24);
        p.rotation.x = k * 0.32;
      }
      B.lump((x0 + x1) / 2, H + 1.4, zc, w / 2.4, 0.1, depth / 3, 0xd6d9dd);
    } else {
      B.piece(w, 0.5, 0.25, 0x6d6a64, (x0 + x1) / 2, H + 0.25, zf + out * 0.1);
      for (let i = 0; i < 3; i++) put(B.root, cyl(0.35, 0.9, 0x7d8085, { seg: 8 }), x0 + 2 + rand() * (w - 4), H + 0.45, zc + (rand() - 0.5) * depth * 0.6);
      put(B.root, cyl(1.1, 1.8, 0x6b5843, { seg: 10 }), x1 - 2.5, H + 1.6, zc);
      for (const dx of [-0.7, 0.7]) put(B.root, box(0.12, 1.2, 0.12, 0x3a3c3f), x1 - 2.5 + dx, H + 0.6, zc);
      B.lump((x0 + x1) / 2, H + 0.05, zc, w / 2.4, 0.1, depth / 2.8, 0xd6d9dd);
    }
    for (let x = x0 + 1.4; x < x1 - 1; x += 2.2) put(B.root, box(1.6, 0.6, 0.06, rand() < 0.25 ? 0x1d2024 : 0x8fa4b0, { r: 0.01 }), x, H - 0.8, zf + out * 0.04);
    const span = w / (doors + 1);
    for (let k = 1; k <= doors; k++) {
      const x = x0 + span * k;
      const up = rand() < 0.3 ? 0.6 + rand() * 0.8 : 0;
      put(B.root, box(3.2, 3.2, 0.05, 0x1d1f22, { r: 0 }), x, 1.6, zf + out * 0.03);
      const door = put(B.root, box(3.0, 3.0 - up, 0.08, [0x5f6670, 0x6b5a48, 0x4f6b6a][(rand() * 3) | 0], { r: 0.02 }), x, 1.5 + up / 2 + 0.05, zf + out * 0.06);
      door.rotation.z = (rand() - 0.5) * 0.04;
      for (let y = up + 0.3; y < 3.0; y += 0.32) put(B.root, box(3.0, 0.04, 0.1, 0x3d434b), x, y, zf + out * 0.07);
      put(B.root, box(3.3, 0.18, 0.2, 0x3a3c3f), x, 3.25, zf + out * 0.1);
    }
    if (dock) {
      const dz = zf + out * 1.0;
      const d = put(B.root, box(w * 0.8, 1.1, 2, 0x8a8780, { r: 0.03 }), (x0 + x1) / 2, 0.55, dz);
      B.solid(d);
      B.block((x0 + x1) / 2, dz, w * 0.4, 1);
      for (let x = x0 + w * 0.15; x < x1 - w * 0.15; x += 2) B.piece(0.4, 0.3, 0.12, 0x1d1f22, x, 0.9, dz + out * 1.0);
      B.lump((x0 + x1) / 2, 1.12, dz, w * 0.3, 0.08, 0.7, 0xd6d9dd);
    }
    const bw = Math.min(w * 0.5, 8);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(bw, 0.8), sign(bw, 0.8, { board: ['#3d4a58', '#58402e', '#3a4a3a'][(rand() * 3) | 0], ink: '#e6e0cc' }));
    board.position.set((x0 + x1) / 2, H - 0.05, zf + out * 0.09);
    if (out < 0) board.rotation.y = Math.PI;
    B.add(board);
    for (const x of [x0 + 0.3, x1 - 0.3]) put(B.root, cyl(0.07, H, 0x5a5e62, { seg: 6 }), x, H / 2, zf + out * 0.12);
  }
  function container(BB, x, y, z, yaw, color) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 2.45), new THREE.MeshToonMaterial({ map: ribs, color, gradientMap }));
    m.position.set(x, y + 1.3, z);
    m.rotation.set(0, yaw, 0);
    m.castShadow = m.receiveShadow = true;
    BB.add(m);
    BB.solid(m);
    BB.block(x, z, 3, 1.25, yaw);
    BB.lump(x, y + 2.62, z, 2.4, 0.1, 1.0, 0xd0d3d8, yaw);
    return m;
  }
  function jersey(BB, x, z, yaw = 0, h = 0.9, w = 1.6) {
    const j = put(BB.root, box(w, h, 0.7, 0x9a978f, { r: 0.06 }), x, (BB === B ? heightAt(x, z) : 0) + h / 2, z);
    j.rotation.y = yaw;
    BB.solid(j);
    BB.block(x, z, w / 2, 0.35, yaw);
    return j;
  }
  function rubble(BB, x, z, radius, height, { solid = false, slabs = 2 } = {}) {
    const y = BB === B ? heightAt(x, z) : 0;
    const n = Math.round(radius * radius * 6) + 8;
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * radius;
      const k = 1 - r / radius;
      const s = 0.25 + rand() * 0.6;
      BB.piece(s * (1 + rand()), s * 0.7, s, CONCRETE[(rand() * 5) | 0], x + Math.cos(a) * r, y + k * height * (0.4 + rand() * 0.6), z + Math.sin(a) * r * 0.8, rand() * 3, rand() * 3, rand() * 3);
    }
    for (let i = 0; i < slabs; i++) {
      const m = BB.chunk(1.4 + rand() * 1.4, 0.16, 1 + rand() * 0.8, CONCRETE[(rand() * 5) | 0], x + (rand() - 0.5) * radius, y + height * 0.5, z + (rand() - 0.5) * radius * 0.6, (rand() - 0.5) * 1.2, rand() * 3, (rand() - 0.5) * 1.4);
      if (solid) BB.solid(m);
    }
    for (let i = 0; i < 2; i++) BB.lump(x + (rand() - 0.5) * radius, y + height * 0.7, z + (rand() - 0.5) * radius * 0.5, radius * 0.3, 0.1, radius * 0.25, 0xc9ccd1, rand() * 3);
    if (rand() < 0.6) BB.rebar(x, y + height * 0.5, z, 2 + ((rand() * 3) | 0));
    if (solid) {
      BB.hitBox(x, y + height * 0.4, z, radius * 1.4, height * 0.8, radius * 1.1);
      BB.block(x, z, radius * 0.8, radius * 0.65);
    }
  }

  return { building, southBlock, works, container, jersey, rubble, ribMat, ribs, BRICK };
}
