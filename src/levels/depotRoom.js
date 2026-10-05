// Inside the depot: the big garage you fade into from a depot shack on the
// street. No enemies, no red. The tank rolls itself onto the repair plate,
// a part can be picked (an overhead crane lifts it off its pallet and bolts
// it on), then the far roller door opens and it rolls out.
//
// Built once, far from the street in the same scene, and reused for every
// stop. Cutaway like a dollhouse: tall walls at the back and the far end, low
// walls toward the camera; the roof is gone apart from its beams, and the
// low sun comes in through the hole.
import * as THREE from 'three';
import { DUSK_SUN } from '../render/setup.js';
import { box, cyl, put, toon, glowMat, gradientMap } from '../models/kit.js';
import { LevelBuilder, canvas, tex, blob, speckle } from './builder.js';
import { partModel } from '../game/parts.js';
import * as P from './props.js';

export const DEPOT = { x: 0, z: 240 }; // origin, far from everything
const W = 26; // inside length (x)
const D = 9; // half depth (z)
const H = 6.4;
const SODIUM = 0xffa245;
const SUN = 0xffc98a;
const COLD = 0xcfe8ff;

function floorTexture(rand) {
  const S = 10;
  const [c, g] = canvas(70 * S, 50 * S);
  g.fillStyle = '#5d5b57';
  g.fillRect(0, 0, c.width, c.height);
  speckle(g, c.width, c.height, ['#55534f', '#66645f', '#4d4b48', '#6b6863'], c.width * c.height * 0.05, rand);
  // slab joints
  g.fillStyle = '#4a4845';
  for (let x = 0; x < c.width; x += 4 * S) g.fillRect(x, 0, 1, c.height);
  for (let y = 0; y < c.height; y += 4 * S) g.fillRect(0, y, c.width, 1);
  // oil stains
  for (let i = 0; i < 40; i++) {
    g.fillStyle = rand() < 0.5 ? '#3c3a38' : '#45423f';
    blob(g, rand() * c.width, rand() * c.height, 8 + rand() * 30, 6 + rand() * 20, rand, 11);
  }
  // painted bay lines (faded yellow)
  const X = (x) => (x + 22) * S; // texture spans x -22..48 of the room
  const Z = (z) => (z + 25) * S; // and z -25..25
  g.fillStyle = '#a58a3e';
  for (const z of [-3.2, 3.2]) for (let x = 2; x < 24; x += 1.4) if (rand() > 0.2) g.fillRect(X(x), Z(z), 0.8 * S, 0.15 * S);
  // (the squares round the pallets come and go with them: see the pallets)
  // outside the garage: dark slush
  g.fillStyle = '#2a2a2e';
  g.fillRect(0, 0, X(-0.3), c.height);
  g.fillRect(X(W + 0.3), 0, c.width, c.height);
  g.fillRect(0, 0, c.width, Z(-D - 0.3));
  g.fillRect(0, Z(D + 0.3), c.width, c.height);
  return tex(c);
}

function hazardTexture() {
  const [c, g] = canvas(32, 32);
  g.fillStyle = '#2a2b2d';
  g.fillRect(0, 0, 32, 32);
  g.fillStyle = '#c99a2e';
  for (let i = -32; i < 64; i += 16) {
    g.beginPath();
    g.moveTo(i, 32);
    g.lineTo(i + 8, 32);
    g.lineTo(i + 40, 0);
    g.lineTo(i + 32, 0);
    g.fill();
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function wallTexture(w, h, rand, windows) {
  const S = 12;
  const [c, g] = canvas(w * S, h * S);
  const [ce, ge] = canvas(w * S, h * S);
  ge.fillStyle = '#000';
  ge.fillRect(0, 0, ce.width, ce.height);
  g.fillStyle = '#86837c';
  g.fillRect(0, 0, c.width, c.height);
  speckle(g, c.width, c.height, ['#00000018', '#ffffff10'], c.width * c.height * 0.06, rand);
  // lower half painted a tired green, grime above it
  g.fillStyle = '#5f7066';
  g.fillRect(0, c.height - 1.6 * S, c.width, 1.6 * S);
  g.fillStyle = '#4c5a52';
  g.fillRect(0, c.height - 1.65 * S, c.width, 2);
  g.fillStyle = '#00000022';
  for (let i = 0; i < 30; i++) g.fillRect((rand() * c.width) | 0, (c.height - 1.6 * S) | 0, 2, (rand() * 1.2 * S) | 0);
  // panel joints
  g.fillStyle = '#00000030';
  for (let x = 0; x < c.width; x += 3 * S) g.fillRect(x, 0, 1, c.height);
  if (windows) {
    // a band of high windows: cold dusk outside, some panes gone
    for (let x = 1; x < w - 2; x += 2.6) {
      const wx = x * S;
      const wy = 1.0 * S;
      g.fillStyle = ge.fillStyle = rand() < 0.3 ? '#9fb6cf' : '#6d7f99';
      g.fillRect(wx, wy, 2.0 * S, 1.3 * S);
      ge.fillRect(wx, wy, 2.0 * S, 1.3 * S);
      g.fillStyle = ge.fillStyle = '#1d1e22';
      for (let k = 1; k < 4; k++) {
        g.fillRect(wx + (k * 2.0 * S) / 4, wy, 2, 1.3 * S);
        ge.fillRect(wx + (k * 2.0 * S) / 4, wy, 2, 1.3 * S);
      }
      g.fillRect(wx, wy + 0.65 * S, 2.0 * S, 2);
      ge.fillRect(wx, wy + 0.65 * S, 2.0 * S, 2);
    }
  }
  return { map: tex(c), emissiveMap: tex(ce) };
}

export function buildDepotRoom(scene) {
  const B = new LevelBuilder(scene, 5150);
  const rand = B.rand;
  B.root.position.set(DEPOT.x, 0, DEPOT.z);
  const O = new THREE.Vector3(DEPOT.x, 0, DEPOT.z);
  const at = (x, y, z) => new THREE.Vector3(x, y, z).add(O);
  const hazard = hazardTexture();

  // floor (inside and a margin of dark slush round it)
  {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(70, 50), new THREE.MeshToonMaterial({ map: floorTexture(rand), gradientMap }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(13, 0, 0);
    m.receiveShadow = true;
    B.add(m);
    B.solid(m);
  }
  // walls: tall at the back (north) and far end (east), low toward the camera
  const wall = (x, z, w, h, d, map) => {
    const mat = map ? new THREE.MeshToonMaterial({ map: map.map, emissiveMap: map.emissiveMap, emissive: 0xffffff, emissiveIntensity: 1, gradientMap }) : toon(0x7f7c75);
    const plain = toon(0x7f7c75);
    const top = toon(0xc6c9ce);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), map ? [plain, plain, top, plain, mat, plain] : mat);
    m.position.set(x, h / 2, z);
    m.castShadow = m.receiveShadow = true;
    B.add(m);
    B.solid(m);
    B.block(x, z, w / 2, d / 2);
    return m;
  };
  wall(W / 2, -D - 0.3, W + 1.2, H, 0.6, wallTexture(W + 1.2, H, rand, true));
  // east end: the exit door opening in the middle (z -3..3)
  for (const s of [-1, 1]) {
    const m = wall(W + 0.3, s * 6.1, 0.6, H, 5.8, null);
    m.rotation.y = 0;
  }
  B.add(put(new THREE.Group(), box(0.6, H - 4.2, 6.6, 0x7f7c75), W + 0.3, 4.2 + (H - 4.2) / 2, 0));
  // low walls on the near side and the west end (the way in)
  wall(W / 2, D + 0.3, W + 1.2, 1.0, 0.6, null);
  for (const s of [-1, 1]) wall(-0.3, s * 6.1, 0.6, 1.0, 5.8, null);
  // tunnel mouth west: dark walls framing the way in
  for (const s of [-1, 1]) {
    B.chunk(6, 1.0, 0.6, 0x4a4845, -3.3, 0.5, s * 3.3);
    B.block(-3.3, s * 3.3, 3, 0.3);
  }
  // pillars along the back, stubs of the lost roof's beams on them
  for (let x = 0; x <= W; x += 6.5) {
    B.chunk(0.6, H + 0.4, 0.6, 0x8d8b86, x, (H + 0.4) / 2, -D + 0.1);
    B.block(x, -D + 0.1, 0.3, 0.3);
    B.chunk(0.22, 0.4, 2.2, 0x45484c, x, H + 0.2, -D + 1.2);
  }
  // crane runway rail along the back wall
  B.chunk(W, 0.25, 0.3, 0x3c3e42, W / 2, H - 0.35, -D + 0.5);

  // ------------------------------------------------------ repair pit
  const PIT = { x0: 8.5, x1: 14, z0: -1.6, z1: 1.6 };
  {
    const pit = new THREE.Mesh(new THREE.PlaneGeometry(PIT.x1 - PIT.x0, PIT.z1 - PIT.z0), toon(0x141416));
    pit.rotation.x = -Math.PI / 2;
    pit.position.set((PIT.x0 + PIT.x1) / 2, 0.015, 0);
    B.add(pit);
    for (const z of [PIT.z0 - 0.15, PIT.z1 + 0.15]) {
      const t = hazard.clone();
      t.needsUpdate = true;
      t.repeat.set((PIT.x1 - PIT.x0) / 0.6, 1);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(PIT.x1 - PIT.x0, 0.3), new THREE.MeshToonMaterial({ map: t, gradientMap }));
      m.rotation.x = -Math.PI / 2;
      m.position.set((PIT.x0 + PIT.x1) / 2, 0.02, z);
      B.add(m);
    }
    // work lamps at the pit
    for (const [x, z] of [[PIT.x0 - 0.6, PIT.z1 + 1.2], [PIT.x1 + 0.6, PIT.z0 - 1.2]]) {
      for (let k = 0; k < 3; k++) B.piece(0.04, 1.4, 0.04, 0x3a3c3f, x + Math.cos(k * 2.1) * 0.25, 0.7, z + Math.sin(k * 2.1) * 0.25, -Math.sin(k * 2.1) * 0.2, 0, Math.cos(k * 2.1) * 0.2); // (feet out, tops in)
      put(B.root, box(0.4, 0.3, 0.2, 0x2e3034, { r: 0.03 }), x, 1.45, z);
      put(B.root, box(0.3, 0.22, 0.04, COLD, { glow: true }), x, 1.45, z + (z > 0 ? -0.11 : 0.11));
    }
    B.emit(new THREE.Vector3((PIT.x0 + PIT.x1) / 2, 2.2, 0), COLD, 14, 7);
    B.pool((PIT.x0 + PIT.x1) / 2, 0, 3.2, COLD, 0.16, { sx: 1.3 });
  }

  // ---------------------------------------------------------- pallets
  const PAD_X = 19;
  // Up to three pallets, each with its own lamp. They only appear with a
  // part on them (three: all of them; two: the outer pair; one: the middle)
  // and fade away again once you've picked, or leave without equipping.
  const lampOff = toon(0x2a2b2e);
  const lampOn = glowMat(SODIUM);
  const pads = [-5.6, 0, 5.6].map((z) => {
    const pallet = new THREE.Group();
    pallet.position.set(PAD_X, 0, z);
    const mats = [0x7a5f3e, 0x5c472e].map((c) => new THREE.MeshToonMaterial({ color: c, gradientMap, transparent: true }));
    // the painted square round it on the floor
    const paint = new THREE.MeshBasicMaterial({ color: 0x8c7434, transparent: true, depthWrite: false });
    mats.push(paint);
    for (const [w, d, x, dz] of [[2.4, 0.06, 0, -1.2], [2.4, 0.06, 0, 1.2], [0.06, 2.4, -1.2, 0], [0.06, 2.4, 1.2, 0]]) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(w, d), paint);
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, 0.015, dz);
      pallet.add(line);
    }
    // (slats and runners never share a face: no flicker)
    for (let i = 0; i < 3; i++) put(pallet, box(1.7, 0.08, 0.32, 0x7a5f3e), 0, 0.165, -0.6 + i * 0.6).material = mats[0];
    for (const dz of [-0.62, 0, 0.62]) put(pallet, box(1.56, 0.12, 0.14, 0x5c472e), 0, 0.06, dz).material = mats[1];
    pallet.visible = false;
    B.add(pallet);
    B.keep(pallet);
    // hanging lamp over each pallet
    B.line([at(PAD_X, H, z).sub(O), new THREE.Vector3(PAD_X, 3.4, z)]);
    put(B.root, cyl(0.3, 0.18, 0x2e3034, { seg: 8, radiusEnd: 0.12 }), PAD_X, 3.3, z);
    const bulb = B.keep(put(B.root, cyl(0.18, 0.05, SODIUM, { seg: 8, glow: true }), PAD_X, 3.2, z));
    bulb.material = lampOff;
    const e = B.emit(new THREE.Vector3(PAD_X, 2.4, z), SODIUM, 16, 6, { priority: true, level: 0 }); // gets a real light while it's lit
    const p = B.pool(PAD_X, z, 1.8, SODIUM, 0);
    const holder = new THREE.Group();
    holder.position.set(PAD_X, 0.24, z);
    B.add(holder);
    B.keep(holder);
    // k: how much it's there (fading), lit: how lit its lamp is
    return { x: PAD_X + O.x, z: z + O.z, local: new THREE.Vector3(PAD_X, 0.24, z), holder, pallet, mats, bulb, light: e, pool: p, offer: null, model: null, modelMats: [], k: 0, vis: 0, lit: 0, litWant: 0 };
  });
  const SLOT_ORDER = { 1: [1], 2: [0, 2], 3: [0, 1, 2] };

  // ---------------------------------------------------------- exit door
  const door = new THREE.Group();
  {
    const t = hazard.clone();
    t.needsUpdate = true;
    t.repeat.set(4, 0.4);
    const slats = new THREE.Mesh(new THREE.BoxGeometry(0.16, 4.2, 6.4), toon(0x56606a));
    slats.position.y = 2.1;
    slats.castShadow = true;
    door.add(slats);
    for (let y = 0.3; y < 4.1; y += 0.35) put(door, box(0.04, 0.05, 6.3, 0x434b54), -0.09, y, 0);
    const band = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 0.4), new THREE.MeshToonMaterial({ map: t, gradientMap }));
    band.position.set(-0.09, 0.4, 0);
    band.rotation.y = -Math.PI / 2;
    door.add(band);
    door.position.set(W + 0.15, 0, 0);
    B.add(door);
    B.keep(door);
  }
  const doorBlock = B.block(W + 0.15, 0, 0.3, 3.3);
  // amber beacon over the door
  const beacon = B.keep(put(B.root, box(0.24, 0.2, 0.24, 0xffb02a, { glow: true }), W - 0.2, 4.6, -3.6));
  const beaconE = B.emit(new THREE.Vector3(W - 1, 4.4, -3.6), 0xffa21f, 10, 7);
  // light spilling in once it's open: cold dusk
  const outside = B.pool(W - 2, 0, 4.2, COLD, 0, { sx: 1.1, sz: 0.9 });
  const outsideE = B.emit(new THREE.Vector3(W - 1.5, 2.5, 0), COLD, 18, 9, { level: 0 });

  // ------------------------------------------------------------ crane
  // A bridge crane on the runway rails: the bridge rides along x, the trolley
  // across it, the hook up and down on its cable.
  // (the bridge and trolley run high above, out of the picture: only the
  // cable and hook come down into view)
  const crane = { x: PAD_X, z: 0, y: 4.6 };
  const hook = new THREE.Group();
  put(hook, box(0.5, 0.32, 0.36, 0xc99a2e, { r: 0.04 }), 0, 0.1, 0);
  put(hook, box(0.12, 0.3, 0.08, 0x2b2c2e), 0, -0.2, 0);
  B.add(hook);
  B.keep(hook);
  const cableGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 1, 0)]);
  const cable = new THREE.Line(cableGeo, new THREE.LineBasicMaterial({ color: 0x17181b }));
  cable.frustumCulled = false;
  B.add(cable);
  B.keep(cable);
  const placeCrane = () => {
    hook.position.set(crane.x, crane.y, crane.z);
    const a = cableGeo.attributes.position;
    a.setXYZ(0, crane.x, 16, crane.z);
    a.setXYZ(1, crane.x, crane.y + 0.25, crane.z);
    a.needsUpdate = true;
  };
  placeCrane();

  // ------------------------------------------------------------ props
  P.tram(B, 9, -6.6, 0.02, { tilt: 0, burn: 0.35, snow: false }); // the old tram, in for repairs
  for (const x of [7, 11]) for (const z of [-5.8, -7.4]) B.piece(0.4, 0.5, 0.4, 0xc99a2e, x, 0.25, z);
  // workbench and tool racks along the back
  B.chunk(2.6, 0.12, 0.9, 0x6b5640, 20.5, 1.0, -8.2);
  for (const x of [19.4, 21.6]) B.piece(0.1, 1.0, 0.8, 0x45484c, x, 0.5, -8.2);
  B.block(20.5, -8.2, 1.3, 0.45);
  // things on the bench, spaced apart (no two share a face)
  for (let i = 0; i < 5; i++) {
    const h = 0.16 + rand() * 0.26;
    B.piece(0.26 + rand() * 0.08, h, 0.24 + i * 0.013, [0x3c5a7a, 0x6b6f72, 0xc99a2e][i % 3], 19.6 + i * 0.44, 1.06 + h / 2, -8.25 + (i % 2) * 0.07, 0, (rand() - 0.5) * 0.3, 0);
  }
  for (const x of [23.5, 24.8]) {
    B.chunk(1.1, 2.8, 0.5, 0x4f5a55, x, 1.4, -8.5);
    // (shelves stand proud of the rack's face, boxes sit forward of it: no shared faces)
    for (let k = 0; k < 4; k++) B.piece(1.0, 0.05, 0.56, 0x3a3c3f, x, 0.5 + k * 0.7, -8.36);
    for (let k = 0; k < 6; k++) B.piece(0.25, 0.22, 0.3, [0x6b5a3e, 0x56606a, 0x7a7f62][k % 3], x - 0.35 + (k % 3) * 0.35, 0.65 + Math.floor(k / 3) * 0.7, -8.22);
  }
  B.block(24.15, -8.5, 1.3, 0.3);
  // scrap heaps in the corners, tires, a burning barrel by the way in
  for (const [x, z, r] of [[2, -7.2, 1.4], [24, 7.4, 1.2], [1.6, 7.2, 1.0]]) {
    for (let i = 0; i < 26; i++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * r;
      const s = 0.2 + rand() * 0.4;
      B.piece(s * (1 + rand()), s * 0.6, s, [0x6d5a48, 0x56606a, 0x4a4c50, 0x7a6a52][(rand() * 4) | 0], x + Math.cos(a) * d, (1 - d / r) * 0.8 + 0.1, z + Math.sin(a) * d, rand() * 3, rand() * 3, rand() * 3);
    }
    B.block(x, z, r * 0.8, r * 0.7);
  }
  P.tires(B, 21.5, 0, 7.4, 6);
  B.block(21.5, 7.4, 0.8, 0.8);
  {
    const x = 3.2;
    const z = 6.2;
    put(B.root, cyl(0.3, 0.8, 0x5a4636, { seg: 10 }), x, 0.4, z);
    B.block(x, z, 0.32, 0.32);
    const flames = [0xffb347, 0xffd27a, 0xff8a35].map((c, i) => {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.22 - i * 0.04, 0.6, 6), glowMat(c));
      f.position.set(x + (i - 1) * 0.08, 0.95, z);
      B.add(f);
      B.keep(f);
      return f;
    });
    const e = B.emit(new THREE.Vector3(x, 1.3, z), 0xff9a40, 12, 7);
    const p = B.pool(x, z, 2.2, 0xff9a40, 0.3);
    B.animate((dt, t) => {
      flames.forEach((f, i) => {
        const s = 0.75 + Math.sin(t * (11 + i * 3) + i) * 0.25 + Math.sin(t * 23 + i) * 0.1;
        f.scale.set(1, s, 1);
        f.position.y = 0.8 + s * 0.3;
      });
      const k = 0.8 + Math.sin(t * 13) * 0.12 + Math.sin(t * 29) * 0.08;
      e.level = k;
      p.material.opacity = 0.3 * k;
    });
  }
  // the low sun through one of the back wall's high windows: a shaft from
  // the window's pane down onto the floor
  {
    const dir = DUSK_SUN.clone().negate().normalize();
    const ground = (p) => {
      const t = p.y / -dir.y;
      return new THREE.Vector3(p.x + dir.x * t, 0.03, p.z + dir.z * t);
    };
    // (the fifth window along: the wall's texture puts them every 2.6 from x 0.4, 4.1 to 5.4 up)
    const wx = 0.4 + 2.6 * 4;
    const wz = -D + 0.02;
    const top = [new THREE.Vector3(wx, H - 1.0, wz), new THREE.Vector3(wx + 2, H - 1.0, wz), new THREE.Vector3(wx + 2, H - 2.3, wz), new THREE.Vector3(wx, H - 2.3, wz)];
    const bottom = top.map(ground);
    const pos = [];
    const col = [];
    for (let i = 0; i < 4; i++) {
      const a = top[i];
      const b = top[(i + 1) % 4];
      const c = bottom[(i + 1) % 4];
      const d = bottom[i];
      for (const [p, k] of [[a, 1], [b, 1], [c, 0.15], [a, 1], [c, 0.15], [d, 0.15]]) {
        pos.push(p.x, p.y, p.z);
        col.push(k, k, k);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    B.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: SUN, vertexColors: true, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })));
    const patch = new THREE.BufferGeometry().setFromPoints([bottom[0], bottom[1], bottom[2], bottom[0], bottom[2], bottom[3]]);
    B.add(new THREE.Mesh(patch, new THREE.MeshBasicMaterial({ color: SUN, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
  }
  // warm lamps hanging along the bay
  let bayLamp = null; // the one by the pallets: off while parts are on offer (it favoured the middle one)
  for (const x of [4, 10, 22]) {
    B.line([new THREE.Vector3(x, H, 2.5), new THREE.Vector3(x, 3.8, 2.5)]);
    put(B.root, cyl(0.28, 0.16, 0x2e3034, { seg: 8, radiusEnd: 0.1 }), x, 3.7, 2.5);
    put(B.root, cyl(0.16, 0.05, SODIUM, { seg: 8, glow: true }), x, 3.61, 2.5);
    const e = B.emit(new THREE.Vector3(x, 2.8, 2.5), SODIUM, 13, 7);
    if (x === 22) bayLamp = e;
    B.pool(x, 2.5, 2.2, SODIUM, 0.2);
  }

  B.finish();
  B.mergeStatic();

  // --------------------------------------------------------- behaviour
  const state = { doorOpen: 0, opening: false, crane: null, sparks: 0 };
  function reset() {
    state.doorOpen = 0;
    state.opening = false;
    state.crane = null;
    door.position.y = 0;
    if (blocksRef && !blocksRef.includes(doorBlock)) blocksRef.push(doorBlock);
    outside.material.opacity = 0;
    outsideE.level = 0;
    Object.assign(crane, { x: PAD_X, z: 0, y: 4.6 });
    placeCrane();
    for (const p of pads) {
      p.holder.clear();
      p.offer = null;
      p.model = null;
      p.modelMats = [];
      p.k = p.vis = p.lit = p.litWant = 0;
      showPad(p);
    }
  }
  let blocksRef = null; // the game's live block list (the door is in it)
  // the pallets on show: no parts (everything here's been found) and there
  // are none at all
  function setOffers(ids) {
    ids = ids.slice(0, 3);
    if (bayLamp) bayLamp.level = ids.length ? 0 : 1;
    for (const p of pads) {
      p.holder.clear();
      p.offer = null;
      p.model = null;
      p.modelMats = [];
      p.vis = p.litWant = 0;
    }
    (SLOT_ORDER[ids.length] || []).forEach((slot, i) => {
      const p = pads[slot];
      p.offer = ids[i];
      p.model = partModel(p.offer);
      // its own see-through materials, so it can fade with its pallet
      p.model.traverse((m) => {
        if (!m.isMesh) return;
        m.material = m.material.clone();
        m.material.transparent = true;
        p.modelMats.push(m.material);
      });
      p.holder.add(p.model);
      p.vis = 1;
      p.litWant = 1; // every one on offer lit
    });
  }
  // the card under the pointer: only its pallet lit (null: all of them)
  function hover(id) {
    for (const p of pads) if (p.offer && p.vis) p.litWant = !id || p.offer === id ? 1 : 0;
  }
  // a part picked: the rest fade away, only its lamp stays on
  function choose(id) {
    for (const p of pads) {
      if (!p.offer) continue;
      const mine = p.offer === id;
      p.vis = mine ? 1 : 0;
      p.litWant = mine ? 1 : 0;
    }
  }
  // leaving: whatever's still on a pallet fades away (nothing left to drive into)
  function clearPads() {
    for (const p of pads) {
      p.vis = 0;
      p.litWant = 0;
    }
  }
  function showPad(p) {
    const on = p.k > 0.01;
    p.pallet.visible = on;
    p.holder.visible = on;
    for (const m of p.mats) m.opacity = p.k;
    for (const m of p.modelMats) m.opacity = p.k;
    const l = p.k * p.lit;
    p.light.level = l;
    p.pool.material.opacity = 0.26 * l;
    p.bulb.material = l > 0.5 ? lampOn : lampOff;
  }
  // The crane lifts the chosen part off its pallet and lowers it onto the
  // tank. onFit fires when it touches the hull; onDone when the hook is back.
  function install(id, getTank, { onFit, onDone }) {
    const pad = pads.find((p) => p.offer === id);
    choose(id);
    state.crane = { t: 0, pad, getTank, onFit, onDone, fitted: false };
  }
  function openDoor() {
    state.opening = true;
  }

  const lerp = THREE.MathUtils.lerp;
  function update(dt, t, ctx = {}) {
    B.update(dt, t, ctx);
    beacon.rotation.y = t * 5;
    beaconE.level = 0.45 + 0.55 * Math.max(0, Math.cos(t * 5));
    for (const p of pads) {
      p.k += THREE.MathUtils.clamp(p.vis - p.k, -dt * 2, dt * 3);
      p.lit += THREE.MathUtils.clamp(p.litWant - p.lit, -dt * 4, dt * 4);
      showPad(p);
      if (p.model && p.model.parent === p.holder) {
        p.model.rotation.y = Math.sin(t * 0.8) * 0.5;
        p.model.position.y = 0.05 + Math.sin(t * 2) * 0.04;
      }
    }
    if (state.opening && state.doorOpen < 1) {
      state.doorOpen = Math.min(1, state.doorOpen + dt * 0.7);
      door.position.y = state.doorOpen * 4.0;
      outside.material.opacity = 0.2 * state.doorOpen;
      outsideE.level = state.doorOpen;
      if (state.doorOpen > 0.6 && blocksRef) {
        const i = blocksRef.indexOf(doorBlock);
        if (i >= 0) blocksRef.splice(i, 1);
      }
    }
    const c = state.crane;
    if (c) {
      c.t += dt;
      const tank = c.getTank(); // world position of the tank deck
      const tx = tank.x - O.x;
      const tz = tank.z - O.z;
      const px = c.pad.local.x;
      const pz = c.pad.local.z;
      // 0-0.5 over the pad and down; 0.5-0.8 hook up with the part; 0.8-1.6
      // across to the tank; 1.6-2.0 down onto it; then back up
      const T = c.t;
      const ease = (k) => k * k * (3 - 2 * k);
      if (T < 0.5) {
        const k = ease(T / 0.5);
        crane.x = lerp(crane.x, px, k);
        crane.z = lerp(crane.z, pz, k);
        crane.y = lerp(4.6, 1.0, k);
      } else if (T < 0.8) {
        if (c.pad.model && c.pad.model.parent === c.pad.holder) hook.attach(c.pad.model);
        crane.y = lerp(1.0, 4.4, ease((T - 0.5) / 0.3));
      } else if (T < 1.6) {
        const k = ease((T - 0.8) / 0.8);
        crane.x = lerp(px, tx, k);
        crane.z = lerp(pz, tz, k);
      } else if (T < 2.0) {
        crane.x = tx;
        crane.z = tz;
        crane.y = lerp(4.4, 2.0, ease((T - 1.6) / 0.4));
      } else if (!c.fitted) {
        c.fitted = true;
        if (c.pad.model) c.pad.model.removeFromParent();
        c.pad.model = null;
        c.pad.offer = null;
        c.pad.vis = 0; // the empty pallet goes too
        c.pad.litWant = 0;
        c.onFit?.();
      } else if (T < 2.7) {
        crane.y = lerp(2.0, 4.6, ease((T - 2.0) / 0.7));
      } else {
        state.crane = null;
        c.onDone?.();
      }
      placeCrane();
    }
  }

  return {
    origin: O,
    builder: B,
    colliders: B.colliders,
    blocks: B.blocks,
    emitters: B.emitters,
    crushables: B.crushables || [],
    pads,
    pit: { x0: PIT.x0 + O.x, x1: PIT.x1 + O.x, z0: PIT.z0 + O.z, z1: PIT.z1 + O.z },
    entry: { x: O.x + 1.0, z: O.z, yaw: 0 },
    plate: at((PIT.x0 + PIT.x1) / 2, 0, 0),
    outside: at(W + 3, 0, 0),
    bounds: { minX: O.x - 1, maxX: O.x + W + 4, minZ: O.z - D + 1.2, maxZ: O.z + D - 1.2 },
    // where the camera looks while you're inside: the room, leaning toward the tank
    focus: new THREE.Vector3(O.x + 17.5, 0, O.z + 4), // with the tank on the plate, all three pads in view
    bindBlocks(list) {
      blocksRef = list;
    },
    reset,
    setOffers,
    hover,
    choose,
    clearPads,
    install,
    openDoor,
    get doorOpen() {
      return state.doorOpen;
    },
    get busy() {
      return !!state.crane;
    },
    update,
  };
}
