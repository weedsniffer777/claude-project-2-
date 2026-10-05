// Street dressing shared by the city levels: what makes a street read as
// lived-in and fought over, the way level 1's does. Lamp poles in pairs with
// trolley wires slung between them (sodium and cold-white, some dead, some
// hanging, some flickering), heat pipes on their trestles along the near
// side, kiosks, bus shelters, garage rows, barrel fires, traffic signals,
// bent sign posts, birches, ruined walls, slabs of facade come down.
//   const S = streetKit(B, { CURB, WALK, SW, heightAt, sign });
//   S.lights({ xs, skip }); S.pipes(xa, xb); S.kiosk(x, z); ...
//   in update: (B.update runs its animations)
import * as THREE from 'three';
import { box, cyl, put, toon, glowMat } from '../models/kit.js';
import * as P from './props.js';
import { CONCRETE } from './cityKit.js';

const SODIUM = [0xffa245, 0xff9636, 0xffb15a];
const COLD = 0xcfe8ff;

export function streetKit(B, { CURB, WALK, SW = 0.16, heightAt = () => 0, sign }) {
  const rand = B.rand;
  const flickers = [];
  const junk = (fn, scrap = 0) => B.crushable(fn, { kind: 'prop', scrap });

  // One lamp pole: a tapered post (some leaning), an arm out over the road
  // with a cobra head, a globe, or a lamp hanging by its cable; lit or dead
  function lampPole(x, z, side, idx, tops) {
    const tilt = rand() < 0.3 ? (rand() - 0.5) * 0.45 : (rand() - 0.5) * 0.06;
    const y0 = heightAt(x, z);
    const pole = cyl(0.09, 6.6, 0x8b8984, { seg: 8, radiusEnd: 0.14 });
    pole.position.set(x, y0 + 3.3, z);
    pole.rotation.x = tilt;
    B.add(pole);
    B.solid(pole);
    B.block(x, z, 0.2, 0.2);
    const top = new THREE.Vector3(x, y0 + 6.25, z - Math.sin(tilt) * 3.2);
    tops?.set(`${x},${side}`, top);
    const dir = -side;
    const kind = idx % 7 === 3 ? 'globe' : idx % 9 === 5 ? 'hanging' : 'cobra';
    const dead = idx % 6 === 4;
    const cold = idx % 3 === 1;
    const color = cold ? COLD : SODIUM[idx % 3];
    const armLen = 1.6 + (idx % 3) * 0.3;
    const arm = put(B.root, box(0.08, 0.08, armLen, 0x4a4c50, { r: 0.02 }), top.x, top.y, top.z + (dir * armLen) / 2);
    arm.rotation.x = -dir * 0.12;
    let head = new THREE.Vector3(top.x, top.y - 0.05, top.z + dir * armLen);
    let lens;
    if (kind === 'globe') {
      head = new THREE.Vector3(top.x, top.y + 0.1, top.z + dir * armLen);
      lens = put(B.root, cyl(0.24, 0.38, dead ? 0x2a2b2e : color, { seg: 8, glow: !dead }), head.x, head.y - 0.15, head.z);
      put(B.root, cyl(0.28, 0.08, 0x3c3e42, { seg: 8 }), head.x, head.y + 0.08, head.z);
    } else if (kind === 'hanging') {
      const hz = top.z + dir * armLen;
      B.line([new THREE.Vector3(top.x, top.y, hz), new THREE.Vector3(top.x + 0.1, top.y - 1.1, hz + 0.1)]);
      head = new THREE.Vector3(top.x + 0.1, top.y - 1.4, hz + 0.1);
      put(B.root, box(0.34, 0.6, 0.14, 0x3c3e42, { r: 0.05 }), head.x, head.y, head.z).rotation.z = 0.3;
      lens = put(B.root, box(0.04, 0.44, 0.24, dead ? 0x2a2b2e : color, { r: 0.01, glow: !dead }), head.x + 0.18, head.y, head.z);
      lens.rotation.z = 0.3;
    } else {
      put(B.root, box(0.34, 0.14, 0.6, 0x3c3e42, { r: 0.05 }), head.x, head.y, head.z);
      lens = put(B.root, box(0.24, 0.04, 0.44, dead ? 0x2a2b2e : color, { r: 0.01, glow: !dead }), head.x, head.y - 0.08, head.z);
    }
    if (!dead) {
      const power = (cold ? 13 : 17) * (0.7 + rand() * 0.5);
      const e = B.emit(head.clone().add(new THREE.Vector3(0, -0.7, 0)), color, power, 9 + rand() * 3);
      const p = B.pool(head.x + (rand() - 0.5) * 0.6, head.z + (rand() - 0.5) * 0.6, 2.6 + rand() * 1.4, color, (cold ? 0.16 : 0.22) * (0.7 + rand() * 0.5), { sx: 0.8 + rand() * 0.5, sz: 0.8 + rand() * 0.4, yaw: rand() * 3, y: heightAt(head.x, head.z) + 0.03 });
      if (idx % 7 === 6 || kind === 'hanging') flickers.push({ e, p, base: p.material.opacity, seed: idx });
    }
  }

  // Lamp poles in pairs along both curbs, a span wire across between each
  // pair, the trolley wires (two pairs) slung pole to pole down the street,
  // a few down and trailing on the road; service cables off to the facades.
  // xs: where the pairs stand; skip(x, side): leave one out (a checkpoint,
  // a side street's mouth)
  function lights({ xs, skip = () => false, wires = true, spanY = 5.9 }) {
    const tops = new Map();
    let idx = (rand() * 5) | 0;
    for (const x of xs) {
      for (const side of [-1, 1]) {
        if (skip(x, side)) continue;
        const z = side < 0 ? CURB.n - 0.45 : CURB.s + 0.45;
        const i = idx++;
        B.crushable(() => lampPole(x, z, side, i, tops), { kind: 'pole', pivot: { x, y: heightAt(x, z), z }, footprint: { x, z, hx: 0.25, hz: 0.25, yaw: 0 } });
      }
      if (wires && tops.has(`${x},-1`) && tops.has(`${x},1`)) B.sagging(tops.get(`${x},-1`).clone().setY(spanY), tops.get(`${x},1`).clone().setY(spanY), 0.25);
    }
    if (!wires) return;
    const paired = xs.filter((x) => tops.has(`${x},-1`) && tops.has(`${x},1`));
    for (let i = 0; i < paired.length - 1; i++) {
      const xa = paired[i];
      const xb = paired[i + 1];
      if (xb - xa > 30) continue;
      for (const z of [-4.4, -3.9, 2.6, 3.1]) {
        const y = spanY - 0.3;
        if (rand() < 0.12) {
          // down: hanging off one span and trailing over the road
          const from = rand() < 0.5 ? xa : xb;
          const toward = from === xa ? 1 : -1;
          const len = 2 + rand() * 3;
          const pts = [];
          for (let k = 0; k <= 12; k++) {
            const t = k / 12;
            pts.push(new THREE.Vector3(from + toward * len * t * 0.7, Math.max(0.03, y * (1 - t * 1.3)), z + Math.sin(t * 4) * 0.4 * t));
          }
          let px = from + toward * len * 0.7;
          let pz = z;
          for (let k = 0; k < 8; k++) {
            px += toward * (0.3 + rand() * 0.4);
            pz += (rand() - 0.5) * 0.8;
            pts.push(new THREE.Vector3(px, 0.035, pz));
          }
          B.line(pts);
        } else B.sagging(new THREE.Vector3(xa, y, z), new THREE.Vector3(xb, y, z), 0.12);
      }
    }
    // service cables from the poles to the far side's facades
    for (const x of paired) if (rand() < 0.45) B.sagging(new THREE.Vector3(x + (rand() - 0.5) * 4, 3 + rand() * 4, WALK.n), tops.get(`${x},-1`).clone().setY(4.8), 0.6 + rand() * 1.2);
  }

  // heat pipes: two foil-wrapped pipes on concrete trestles, along the near
  // side of the street (they block, and stop shells)
  const FOIL = 0xb4b8bd;
  const TORN = 0x6d604d;
  function pipes(xa, xb, z = WALK.s + 1.5, y = 1.05) {
    const y0 = heightAt((xa + xb) / 2, z);
    for (const dz of [-0.28, 0.28]) {
      let x = xa;
      while (x < xb) {
        const len = Math.min(xb - x, 3 + rand() * 5);
        put(B.root, cyl(0.2, len, rand() < 0.2 ? TORN : FOIL, { axis: 'x', seg: 10 }), x + len / 2, y0 + y, z + dz);
        x += len;
      }
    }
    for (let x = xa + 1; x < xb; x += 4) {
      B.piece(0.22, y - 0.1, 0.22, 0x7e7c78, x, y0 + (y - 0.1) / 2, z);
      B.piece(0.2, 0.12, 1.0, 0x7e7c78, x, y0 + y - 0.2, z);
    }
    for (let x = xa + 3; x < xb; x += 6 + rand() * 6) B.lump(x, y0 + y + 0.22, z, 1.2 + rand(), 0.08, 0.35, 0xd0d3d8);
    B.block((xa + xb) / 2, z, (xb - xa) / 2, 0.45);
    B.hitBox((xa + xb) / 2, y0 + (y + 0.25) / 2, z, xb - xa, y + 0.25, 0.9);
  }
  // an arch: the pipes go up and over the road and down the far side
  function pipeArch(x, zNear = WALK.s + 1.5, zFar = WALK.n - 1.5, h = 6.6) {
    for (const dx of [-0.28, 0.28]) {
      put(B.root, cyl(0.2, h - 1.05, FOIL, { seg: 10 }), x + dx, SW + (h + 1.05) / 2, zNear);
      put(B.root, cyl(0.2, zNear - zFar, FOIL, { axis: 'z', seg: 10 }), x + dx, h, (zNear + zFar) / 2);
      put(B.root, cyl(0.2, h, FOIL, { seg: 10 }), x + dx, h / 2, zFar);
    }
    for (let i = 0; i < 4; i++) put(B.root, cyl(0.21, 0.6, TORN, { axis: 'z', seg: 10 }), x + (i % 2 ? 0.28 : -0.28), h, zFar + 3 + i * ((zNear - zFar - 6) / 3));
    for (const z of [zNear, zFar]) {
      for (const dx of [-0.7, 0.7]) put(B.root, box(0.16, h + 0.3, 0.16, 0x4b4e52, { r: 0.02 }), x + dx, (h + 0.3) / 2, z);
      put(B.root, box(1.6, 0.16, 0.2, 0x4b4e52, { r: 0.02 }), x, h - 0.32, z);
      B.block(x, z, 0.9, 0.3);
    }
  }

  // a kiosk with a cold tube over its hatch, flickering
  function kiosk(x, z, face = -1) {
    const y = heightAt(x, z);
    const k = put(B.root, box(2.4, 2.2, 1.6, [0x58707a, 0x7a6a50, 0x5a6a52][(rand() * 3) | 0], { r: 0.08 }), x, y + 1.1, z);
    put(B.root, box(2.0, 1.0, 0.04, 0x75736e, { r: 0.01 }), x, y + 1.2, z + face * 0.82);
    put(B.root, box(2.6, 0.08, 1.9, 0x3e4043, { r: 0.02 }), x, y + 2.25, z);
    put(B.root, box(2.4, 0.06, 1.7, 0xd2d5da, { r: 0.02 }), x, y + 2.32, z);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.34), sign(2.0, 0.34, { board: '#2c3a40', ink: '#bfe0e8' }));
    s.position.set(x, y + 1.92, z + face * 0.83);
    if (face < 0) s.rotation.y = Math.PI;
    B.add(s);
    const tube = B.keep(put(B.root, box(1.8, 0.05, 0.05, COLD, { r: 0.01, glow: true }), x, y + 2.12, z + face * 0.9));
    const e = B.emit(new THREE.Vector3(x, y + 2.0, z + face * 1.4), COLD, 9, 6);
    const p = B.pool(x, z + face * 1.6, 2.0, COLD, 0.2, { sx: 1.4, sz: 0.8, y: y + 0.03 });
    flickers.push({ e, p, base: 0.2, seed: 99 + x, fast: true, tube });
    B.block(x, z, 1.2, 0.8);
    B.solid(k);
  }

  // a bus shelter: back wall, a side wall, a slumped roof, a bench
  function shelter(x, z, face = -1) {
    const y = heightAt(x, z);
    const back = put(B.root, box(3.6, 2.1, 0.18, 0x8d8b86, { r: 0.02 }), x, y + 1.05, z - face * 0.45);
    back.castShadow = true;
    put(B.root, box(0.18, 2.1, 1.0, 0x8d8b86, { r: 0.02 }), x - 1.7, y + 1.05, z);
    const roof = put(B.root, box(4.0, 0.18, 1.4, 0x7e7c78, { r: 0.03 }), x + 0.1, y + 2.18, z);
    roof.rotation.z = 0.12;
    put(B.root, box(3.9, 0.06, 1.3, 0xd2d5da, { r: 0.02 }), x + 0.1, y + 2.3, z);
    // its lightbox: a poster panel, lit
    const lb = put(B.root, box(1.1, 1.5, 0.12, 0x2a2b2e, { r: 0.02 }), x + 1.0, y + 1.1, z - face * 0.35);
    lb.castShadow = true;
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.3), sign(0.9, 1.3, { board: '#d8d0b8', ink: '#5a4a3a' }));
    panel.position.set(x + 1.0, y + 1.1, z - face * 0.35 + face * 0.07);
    if (face > 0) panel.rotation.y = Math.PI;
    B.add(panel);
    B.emit(new THREE.Vector3(x + 1.0, y + 1.2, z + face * 0.6), 0xfff0d0, 5, 4);
    P.bench(B, x, y, z - face * 0.1, face > 0 ? Math.PI : 0);
    B.solid(back);
    B.solid(roof);
    B.block(x, z, 1.9, 0.7);
  }

  // a row of lock-up garages with their doors on the street (some up, some
  // gone to rubble), snow on the roofs
  function garages(x0, count, z) {
    const doors = [0x6b5a48, 0x56606a, 0x5f6b5a, 0x6e6152, 0x4d5560];
    const y = heightAt(x0, z);
    for (let i = 0; i < count; i++) {
      const x = x0 + i * 3.1;
      if (rand() < 0.15) {
        rubble(x, z + 2, 1.4, 1.0);
        continue;
      }
      const h = 2.1 + (rand() - 0.5) * 0.2;
      put(B.root, box(3.0, h, 5, 0x7f7d79, { r: 0.04 }), x, y + h / 2, z + 2.5).castShadow = true;
      const open = rand() < 0.3;
      put(B.root, box(2.3, open ? 0.5 : 1.7, 0.06, doors[(rand() * 5) | 0], { r: 0.01 }), x, y + (open ? 1.55 : 0.9), z - 0.01);
      if (open) put(B.root, box(2.2, 1.2, 0.02, 0x141415, { r: 0.005 }), x, y + 0.65, z + 0.02);
      const roof = put(B.root, box(3.1, 0.12, 5.2, 0x45474a, { r: 0.02 }), x, y + h + 0.06, z + 2.5);
      if (rand() < 0.25) roof.rotation.x = 0.18;
      B.lump(x, y + h + 0.12, z + 2.5, 1.4, 0.12, 2.4, 0xd0d3d8, 0);
    }
    B.block(x0 + (count - 1) * 1.55, z + 2.5, count * 1.55, 2.5);
  }

  function rubble(x, z, radius, height) {
    const y = heightAt(x, z);
    for (let i = 0; i < Math.round(radius * radius * 6) + 8; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * radius;
      const s = 0.25 + rand() * 0.6;
      B.piece(s * (1 + rand()), s * 0.7, s, CONCRETE[(rand() * 5) | 0], x + Math.cos(a) * r, y + (1 - r / radius) * height * (0.4 + rand() * 0.6), z + Math.sin(a) * r * 0.8, rand() * 3, rand() * 3, rand() * 3);
    }
    B.lump(x, y + height * 0.7, z, radius * 0.3, 0.1, radius * 0.25, 0xc9ccd1, rand() * 3);
  }

  // a ruined wall: stubs of different heights, gaps, a rubble heap at its foot
  function ruinedWall(x0, x1, z) {
    const y = heightAt(x0, z);
    let x = x0;
    while (x < x1) {
      const w = 0.5 + rand() * 0.7;
      const h = 1.2 + rand() * 2.6;
      if (rand() < 0.8) put(B.root, box(w, h, 0.4, CONCRETE[(rand() * 5) | 0], { r: 0.02 }), x + w / 2, y + h / 2, z).castShadow = true;
      if (rand() < 0.35) B.piece(1.6, 0.3, 0.42, CONCRETE[0], x + w, y + Math.min(h, 2.4), z, 0, 0, (rand() - 0.5) * 0.6);
      x += w + 0.4 + rand() * 0.9;
    }
    rubble((x0 + x1) / 2, z - 1, (x1 - x0) * 0.22, 0.8);
  }

  // a burning barrel: flames, its glow and light, sparks going up
  function barrelFire(x, z) {
    const y = heightAt(x, z);
    put(B.root, cyl(0.3, 0.8, 0x5a4636, { seg: 10 }), x, y + 0.4, z);
    B.block(x, z, 0.32, 0.32);
    const flames = [0xffb347, 0xffd27a, 0xff8a35].map((c, i) => {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.22 - i * 0.04, 0.6, 6), glowMat(c));
      f.position.set(x + (i - 1) * 0.08, y + 0.95, z);
      B.add(f);
      B.keep(f);
      return f;
    });
    const e = B.emit(new THREE.Vector3(x, y + 1.3, z), 0xff9a40, 12, 7);
    const p = B.pool(x, z, 2.2, 0xff9a40, 0.3, { y: y + 0.03, yaw: rand() * 3 });
    const phase = rand() * 10;
    B.animate((dt, t, ctx) => {
      flames.forEach((f, i) => {
        const s = 0.75 + Math.sin(t * (11 + i * 3) + phase + i) * 0.25 + Math.sin(t * 23 + i) * 0.1;
        f.scale.set(1, s, 1);
        f.position.y = y + 0.8 + s * 0.3;
      });
      const k = 0.8 + Math.sin(t * 13 + phase) * 0.12 + Math.sin(t * 29) * 0.08;
      e.level = k;
      p.material.opacity = 0.3 * k;
      if (ctx?.combat && rand() < dt * 3) ctx.combat.fx.spawn(new THREE.Vector3(x, y + 1.2, z), new THREE.Vector3((rand() - 0.5) * 0.6, 1.4 + rand(), (rand() - 0.5) * 0.6), { color: 0xffb347, life: 0.9, size: 0.05, glow: true });
    });
  }

  // a traffic signal on its pole, the arm out over the road; 'cycle' runs
  // red-amber-green, 'blink' flashes amber
  function signal(x, z, armDir, mode = 'blink') {
    const y = heightAt(x, z);
    put(B.root, cyl(0.1, 5.2, 0x5a5d61, { seg: 8 }), x, y + 2.6, z);
    B.block(x, z, 0.2, 0.2);
    const armLen = 4.6;
    put(B.root, box(0.1, 0.1, armLen, 0x4d5054, { r: 0.02 }), x, y + 4.9, z + (armDir * armLen) / 2);
    const hz = z + armDir * armLen * 0.8;
    put(B.root, box(0.34, 0.42, 1.36, 0x2e3033, { r: 0.06 }), x, y + 4.6, hz);
    const lamps = [0x3fe0b4, 0xffb428, 0xff3b30].map((c, i) => ({ c, meshes: [-1, 1].map((sx) => B.keep(put(B.root, cyl(0.14, 0.04, 0x1f2124, { axis: 'x', seg: 10 }), x + sx * 0.18, y + 4.6, hz + (i - 1) * 0.42 * -armDir))) }));
    const e = B.emit(new THREE.Vector3(x - 0.5, y + 4.2, hz), 0xffffff, 3, 5);
    const dark = toon(0x1f2124);
    const lit = lamps.map((l) => glowMat(l.c));
    B.animate((dt, t) => {
      let on;
      if (mode === 'blink') on = Math.sin(t * 3.4) > 0 ? 1 : -1;
      else on = [0, 0, 1, 2, 2][Math.floor(t / 1.6) % 5];
      lamps.forEach((l, i) => {
        for (const m of l.meshes) m.material = i === on ? lit[i] : dark;
      });
      e.color.set(on >= 0 ? lamps[on].c : 0x000000);
      e.level = on >= 0 ? 1 : 0;
    });
  }

  // a sign post knocked crooked
  function bentSign(x, z, color = '#3d5f86') {
    B.crushable(
      () => {
        const top = P.bentPole(B, x, heightAt(x, z), z, 2.7, rand() * 3, (rand() - 0.5) * 1.6, 0x5a5d61);
        const plate = new THREE.Mesh(new THREE.CircleGeometry(0.34, 12), sign(0.7, 0.7, { board: color, ink: '#dfe2e4' }));
        plate.material.side = THREE.DoubleSide;
        plate.position.set(0, 1.0, 0.08);
        top.add(plate);
      },
      { kind: 'pole', pivot: { x, y: heightAt(x, z), z }, footprint: { x, z, hx: 0.3, hz: 0.3, yaw: 0 } },
    );
  }

  // a bare birch: white trunk with dark marks, thin branches
  function birch(x, z, h = 4) {
    const y = heightAt(x, z);
    put(B.root, cyl(0.1, h, 0xd9d6cc, { seg: 6, radiusEnd: 0.14 }), x, y + h / 2, z);
    for (let i = 0; i < 4; i++) B.piece(0.1, 0.03, 0.1, 0x2a2826, x, y + 0.4 + i * h * 0.22, z + 0.12);
    for (let i = 0; i < 6; i++) {
      const b = cyl(0.035, 1.2 + rand(), 0x4a4440, { seg: 4, radiusEnd: 0.05 });
      b.position.set(x, y + h * (0.45 + rand() * 0.5), z);
      b.rotation.set((rand() - 0.5) * 1.6, rand() * 3, (rand() - 0.5) * 1.6);
      b.translateY(0.5);
      B.add(b);
    }
  }

  // a slab of facade come down whole, leaning on the far sidewalk
  function fallenSlab(x, ry = 0) {
    const s = B.chunk(2.4, 1.6, 0.2, CONCRETE[1], x, SW + 0.7, WALK.n + 0.9, -0.55, ry, 0.05);
    B.solid(s);
    B.block(x, WALK.n + 0.9, 1.2, 0.5, ry);
    B.rebar(x - 1, SW + 0.2, WALK.n + 1.2, 3);
  }

  // sidewalk clutter between xa and xb on both sides: benches, bins,
  // planters, cabinets, crates (all crushable)
  function clutter(xa, xb, every = 9, avoid = () => false) {
    for (let x = xa + rand() * every; x < xb; x += every * (0.6 + rand() * 0.8)) {
      if (avoid(x)) continue;
      const far = rand() < 0.6;
      const z = far ? WALK.n + 1.1 + rand() * 0.3 : WALK.s - 0.9 - rand() * 0.3;
      const y = heightAt(x, z);
      const r = rand();
      if (r < 0.2) junk(() => P.bench(B, x, y, z, far ? 0 : Math.PI, { tipped: rand() < 0.3 }));
      else if (r < 0.4) junk(() => P.bin(B, x, y, z, { tipped: rand() < 0.5 }), 1);
      else if (r < 0.55) junk(() => P.planter(B, x, y, z));
      else if (r < 0.7) junk(() => P.cabinet(B, x, y, far ? WALK.n + 0.6 : WALK.s - 0.6, far ? 0 : Math.PI), 1);
      else if (r < 0.85) junk(() => P.crates(B, x, y, z), 2);
      else bentSign(x, far ? CURB.n - 0.5 : CURB.s + 0.6, ['#3d5f86', '#8c7a3e', '#7a3d3a'][(rand() * 3) | 0]);
    }
  }

  // the flickering lamps and tubes: now and then they stutter
  B.animate((dt, t) => {
    for (const f of flickers) {
      const n = Math.sin(t * (f.fast ? 9.1 : 3.7) + f.seed) + Math.sin(t * (f.fast ? 23 : 7.9) + f.seed * 2.3);
      const on = n > -1.4 || Math.sin(t * 50 + f.seed) > 0.3;
      f.e.level = on ? 1 : 0.1;
      f.p.material.opacity = f.base * (on ? 1 : 0.15);
      if (f.tube) f.tube.visible = on;
    }
  });

  return { lights, lampPole, pipes, pipeArch, kiosk, shelter, garages, ruinedWall, barrelFire, signal, bentSign, birch, fallenSlab, clutter, rubble };
}
