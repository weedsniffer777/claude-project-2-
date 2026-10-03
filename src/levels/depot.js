// The depot: a corrugated garage shack built right across the street at the
// border between two sectors, walled in on both sides so it's the only way
// through. Closed until the sector is clear; then the front roller door goes
// up, the tank rolls in onto the repair plate, a part can be fitted by the
// overhead crane, and it drives out the back door into the next sector.
//
// While the tank is inside, the roof and the two walls facing the camera
// are hidden, dollhouse-style, so you can see in.
import * as THREE from 'three';
import { box, cyl, put, toon, glowMat, gradientMap } from '../models/kit.js';
import { canvas, tex, speckle } from './builder.js';
import { partModel } from '../game/parts.js';

const H = 3.4; // wall height
const SODIUM = 0xffa245;
const COLD = 0xcfe8ff;

let tinTex = null;
// Corrugated sheet: vertical ribs, a few rust runs.
function tinTexture() {
  if (tinTex) return tinTex;
  const [c, g] = canvas(32, 32);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 32, 32);
  for (let x = 0; x < 32; x += 4) {
    g.fillStyle = '#c7c7c7';
    g.fillRect(x, 0, 2, 32);
    g.fillStyle = '#e6e6e6';
    g.fillRect(x + 2, 0, 1, 32);
  }
  let s = 7;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#a0805f';
  for (let i = 0; i < 6; i++) g.fillRect((r() * 32) | 0, (r() * 10) | 0, 1, 6 + r() * 16);
  speckle(g, 32, 32, ['#00000020', '#ffffff30'], 60, r);
  tinTex = tex(c);
  tinTex.wrapS = tinTex.wrapT = THREE.RepeatWrapping;
  return tinTex;
}
function tin(w, h, color) {
  const t = tinTexture().clone();
  t.needsUpdate = true;
  t.repeat.set(w / 1.6, h / 1.6);
  return new THREE.MeshToonMaterial({ map: t, color, gradientMap });
}

let hazTex = null;
function hazard(w) {
  if (!hazTex) {
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
    hazTex = tex(c);
    hazTex.wrapS = hazTex.wrapT = THREE.RepeatWrapping;
  }
  const t = hazTex.clone();
  t.needsUpdate = true;
  t.repeat.set(w / 0.7, 1);
  return new THREE.MeshToonMaterial({ map: t, gradientMap });
}

// A roller door hanging in an opening of width w, facing along x.
function rollerDoor(B, x, z, w) {
  const door = new THREE.Group();
  const slats = new THREE.Mesh(new THREE.BoxGeometry(0.12, H - 0.5, w), toon(0x56606a));
  slats.position.y = (H - 0.5) / 2;
  slats.castShadow = true;
  door.add(slats);
  for (let y = 0.25; y < H - 0.6; y += 0.3) put(door, box(0.16, 0.04, w - 0.05, 0x434b54), 0, y, 0);
  const band = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.32), hazard(w));
  band.rotation.y = -Math.PI / 2;
  band.position.set(-0.09, 0.3, 0);
  door.add(band);
  door.position.set(x, 0, z);
  B.add(door);
  B.keep(door);
  return door;
}

// x0..x1 along the street, z0..z1 across it (the roadway). fill: how far
// the side walls run out to seal the sidewalks ({ n, s } world z).
export function buildShack(B, { x0, x1, z0, z1, fill, heightAt }) {
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const L = x1 - x0;
  const Wd = z1 - z0;
  const DOOR = 5; // door opening width
  const near = []; // hidden while the tank is inside: west wall, south wall, roof
  const wall = (x, z, w, d, h, color, list) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), tin(Math.max(w, d), h, color));
    m.position.set(x, h / 2, z);
    m.castShadow = m.receiveShadow = true;
    B.add(m);
    B.solid(m);
    if (list) {
      B.keep(m);
      list.push(m);
    }
    return m;
  };
  const WALL = 0x8a9a8e;
  const DARK = 0x6d7a72;

  // floor slab inside
  {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(L, Wd), toon(0x5d5b57));
    f.rotation.x = -Math.PI / 2;
    f.position.set(cx, 0.02, cz);
    f.receiveShadow = true;
    B.add(f);
  }
  // back (north) wall: always shown
  wall(cx, z0 - 0.15, L + 0.3, 0.3, H, DARK);
  B.block(cx, z0 - 0.15, L / 2 + 0.15, 0.2);
  // south wall: hidden while inside
  wall(cx, z1 + 0.15, L + 0.3, 0.3, H, WALL, near);
  B.block(cx, z1 + 0.15, L / 2 + 0.15, 0.2);
  // end walls with the door openings
  const side = (Wd - DOOR) / 2;
  for (const [x, list] of [[x0 - 0.15, near], [x1 + 0.15, null]]) {
    wall(x, z0 + side / 2, 0.3, side, H, list ? WALL : DARK, list);
    wall(x, z1 - side / 2, 0.3, side, H, list ? WALL : DARK, list);
    wall(x, cz, 0.3, DOOR, 0.6, list ? WALL : DARK, list).position.y = H - 0.3;
    B.block(x, z0 + side / 2, 0.2, side / 2);
    B.block(x, z1 - side / 2, 0.2, side / 2);
  }
  // roof: a shallow pitch of corrugated sheet on a frame
  {
    const roof = new THREE.Group();
    for (const s of [-1, 1]) {
      const sheet = new THREE.Mesh(new THREE.BoxGeometry(L + 0.8, 0.08, Wd / 2 + 0.5), tin(L, Wd / 2, 0x7c7368));
      sheet.position.set(0, 0.3, (s * (Wd / 2 + 0.5)) / 2);
      sheet.rotation.x = s * 0.12;
      sheet.castShadow = sheet.receiveShadow = true;
      roof.add(sheet);
    }
    put(roof, box(L + 0.9, 0.12, 0.3, 0x45484c), 0, 0.58, 0);
    // a snow crust, and a hole where a sheet blew off
    put(roof, box(L * 0.6, 0.05, 1.6, 0xd3d6db), -L * 0.15, 0.48, -Wd * 0.22).rotation.x = -0.12;
    roof.position.set(cx, H, cz);
    B.add(roof);
    B.keep(roof);
    near.push(roof);
  }
  // the walls running out to seal the sidewalks either side
  for (const [za, zb] of [[fill.n, z0 - 0.3], [z1 + 0.3, fill.s]]) {
    if (zb - za < 0.1) continue;
    const zc = (za + zb) / 2;
    const y = heightAt(cx, zc);
    const m = wall(cx, zc, 1.2, zb - za, 2.6, 0x7b7a76);
    m.material = toon(0x85827b);
    m.position.y = y + 1.3;
    B.block(cx, zc, 0.6, (zb - za) / 2);
    // razor wire on top
    for (let z = za + 0.2; z < zb; z += 0.5) B.piece(0.05, 0.3, 0.05, 0x3a3c3f, cx, y + 2.75, z, 0.4, 0, 0.3);
  }

  // what makes it read from down the street: a lit sign, a beacon, work lights
  {
    const sign = new THREE.Group();
    put(sign, box(0.1, 0.9, 3.4, 0x2c3034), 0, 0, 0);
    // a wrench glyph in cold tube
    const tube = (w, h, y, z, rz = 0) => (put(sign, box(0.06, h, w, COLD, { glow: true }), -0.07, y, z).rotation.x = rz);
    tube(1.8, 0.08, 0, -0.5);
    tube(0.08, 0.5, 0, -1.4);
    tube(0.08, 0.5, 0, 0.4);
    tube(0.6, 0.08, 0.2, 0.9);
    tube(0.6, 0.08, -0.2, 0.9);
    sign.position.set(x0 - 0.35, H + 0.75, cz);
    B.add(sign);
    B.emit(new THREE.Vector3(x0 - 1.5, H, cz), COLD, 10, 8);
  }
  const beacon = B.keep(put(B.root, box(0.26, 0.2, 0.26, 0xffb02a, { glow: true }), cx, H + 0.95, cz));
  const beaconE = B.emit(new THREE.Vector3(cx, H + 1.4, cz), 0xffa21f, 10, 9);
  // green "go" lamps over both doors (lit once a door opens)
  const goLamps = [x0 - 0.35, x1 + 0.35].map((x) => B.keep(put(B.root, box(0.12, 0.2, 0.5, 0x1d2a20), x, H - 0.75, cz)));
  // floodlight pool on the apron in front
  B.pool(x0 - 2.2, cz, 3, SODIUM, 0.18, { sx: 0.9, sz: 1.3 });

  // ------------------------------------------------------ inside
  // repair plate in the middle
  const plate = new THREE.Vector3(cx, 0, cz);
  {
    const pit = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.6), toon(0x161618));
    pit.rotation.x = -Math.PI / 2;
    pit.position.set(cx, 0.03, cz);
    B.add(pit);
    for (const z of [cz - 1.45, cz + 1.45]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.3), hazard(4.6));
      m.rotation.x = -Math.PI / 2;
      m.position.set(cx, 0.035, z);
      B.add(m);
    }
  }
  // hanging lamps
  for (const x of [cx - L * 0.28, cx + L * 0.28]) {
    put(B.root, cyl(0.26, 0.15, 0x2e3034, { seg: 8, radiusEnd: 0.1 }), x, H - 0.5, cz);
    put(B.root, cyl(0.15, 0.05, SODIUM, { seg: 8, glow: true }), x, H - 0.59, cz);
    B.emit(new THREE.Vector3(x, H - 1.2, cz), SODIUM, 13, 7);
    B.pool(x, cz, 2.2, SODIUM, 0.2);
  }
  // pallets along the back wall, a part on each
  const pads = [-1, 0, 1].map((k) => {
    const x = cx + k * (L / 3.3);
    const z = z0 + 1.0;
    for (let i = 0; i < 3; i++) B.piece(1.6, 0.08, 0.3, 0x7a5f3e, x, 0.16, z - 0.5 + i * 0.5);
    for (const dz of [-0.6, 0, 0.6]) B.piece(1.6, 0.12, 0.14, 0x5c472e, x, 0.06, z + dz);
    const holder = new THREE.Group();
    holder.position.set(x, 0.22, z);
    B.add(holder);
    B.keep(holder);
    return { x, z, local: new THREE.Vector3(x, 0.22, z), holder, offer: null, model: null };
  });
  // a workbench, tool rack, oil drums in the corners
  B.piece(1.8, 0.1, 0.7, 0x6b5640, x1 - 1.3, 0.9, z1 - 0.6);
  for (const dx of [-0.8, 0.8]) B.piece(0.08, 0.9, 0.6, 0x45484c, x1 - 1.3 + dx, 0.45, z1 - 0.6);
  for (let i = 0; i < 3; i++) put(B.root, cyl(0.28, 0.8, [0x6b5843, 0x56606a, 0x5f6f47][i], { seg: 10 }), x0 + 0.6 + i * 0.62, 0.4, z1 - 0.5);

  // entry and exit roller doors (in the game's block list while shut)
  const doorIn = rollerDoor(B, x0 - 0.15, cz, DOOR);
  const doorOut = rollerDoor(B, x1 + 0.15, cz, DOOR);
  const blockIn = B.block(x0 - 0.15, cz, 0.25, DOOR / 2);
  const blockOut = B.block(x1 + 0.15, cz, 0.25, DOOR / 2);

  // ------------------------------------------------------ crane hook
  // (the crane itself runs high in the roof space; the cable and hook come
  // down into view)
  const crane = { x: cx, z: z0 + 1.0, y: H + 4 };
  const hook = new THREE.Group();
  put(hook, box(0.45, 0.3, 0.34, 0xc99a2e, { r: 0.04 }), 0, 0.1, 0);
  put(hook, box(0.1, 0.28, 0.08, 0x2b2c2e), 0, -0.18, 0);
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
    a.setXYZ(0, crane.x, 20, crane.z);
    a.setXYZ(1, crane.x, crane.y + 0.25, crane.z);
    a.needsUpdate = true;
    hook.visible = cable.visible = state.inside;
  };

  // ------------------------------------------------------ behaviour
  const state = { inDoor: 0, outDoor: 0, openIn: false, openOut: false, inside: false, crane: null };
  let blocksRef = B.blocks;
  const drop = (b) => {
    const i = blocksRef.indexOf(b);
    if (i >= 0) blocksRef.splice(i, 1);
  };
  const keepBlock = (b) => blocksRef.includes(b) || blocksRef.push(b);
  placeCrane();

  function setInside(on) {
    state.inside = on;
    for (const m of near) m.visible = !on;
    placeCrane();
  }
  function setOffers(ids) {
    pads.forEach((p, i) => {
      p.holder.clear();
      p.holder.visible = true;
      p.offer = ids[i] ?? null;
      p.model = null;
      if (p.offer) {
        p.model = partModel(p.offer);
        p.holder.add(p.model);
      }
    });
  }
  // The crane lifts the chosen part off its pallet and lowers it onto the
  // tank: onFit when it touches the hull, onDone when the hook is back up.
  function install(id, getTank, { onFit, onDone }) {
    const pad = pads.find((p) => p.offer === id);
    state.crane = { t: 0, pad, getTank, onFit, onDone, fitted: false };
    for (const p of pads) if (p !== pad) p.holder.visible = false;
  }
  const lerp = THREE.MathUtils.lerp;
  const ease = (k) => k * k * (3 - 2 * k);
  function update(dt, t) {
    beacon.rotation.y = t * 5;
    beaconE.level = 0.45 + 0.55 * Math.max(0, Math.cos(t * 5));
    if (state.openIn) state.inDoor = Math.min(1, state.inDoor + dt * 0.9);
    else state.inDoor = Math.max(0, state.inDoor - dt * 0.9);
    if (state.openOut) state.outDoor = Math.min(1, state.outDoor + dt * 0.9);
    doorIn.position.y = state.inDoor * (H - 0.6);
    doorIn.scale.y = 1 - state.inDoor * 0.8;
    doorOut.position.y = state.outDoor * (H - 0.6);
    doorOut.scale.y = 1 - state.outDoor * 0.8;
    if (state.inDoor > 0.6) drop(blockIn);
    else if (state.inDoor < 0.3) keepBlock(blockIn);
    if (state.outDoor > 0.6) drop(blockOut);
    goLamps[0].material = state.openIn && Math.sin(t * 6) > 0 ? glowMat(0x6be08a) : toon(0x1d2a20);
    goLamps[1].material = state.openOut && Math.sin(t * 6) > 0 ? glowMat(0x6be08a) : toon(0x1d2a20);
    for (const p of pads) if (p.model && p.model.parent === p.holder) {
      p.model.rotation.y = Math.sin(t * 0.8) * 0.5;
      p.model.position.y = 0.05 + Math.sin(t * 2) * 0.04;
    }
    const c = state.crane;
    if (!c) return;
    c.t += dt;
    const tank = c.getTank();
    const px = c.pad.local.x;
    const pz = c.pad.local.z;
    const T = c.t;
    // over the pallet and down, up with the part, across, down onto the tank
    if (T < 0.5) {
      const k = ease(T / 0.5);
      crane.x = lerp(crane.x, px, k);
      crane.z = lerp(crane.z, pz, k);
      crane.y = lerp(H + 4, 1.0, k);
    } else if (T < 0.8) {
      if (c.pad.model && c.pad.model.parent === c.pad.holder) hook.attach(c.pad.model);
      crane.y = lerp(1.0, H + 0.5, ease((T - 0.5) / 0.3));
    } else if (T < 1.5) {
      const k = ease((T - 0.8) / 0.7);
      crane.x = lerp(px, tank.x, k);
      crane.z = lerp(pz, tank.z, k);
    } else if (T < 1.9) {
      crane.x = tank.x;
      crane.z = tank.z;
      crane.y = lerp(H + 0.5, 2.0, ease((T - 1.5) / 0.4));
    } else if (!c.fitted) {
      c.fitted = true;
      c.pad.model?.removeFromParent();
      c.onFit?.();
    } else if (T < 2.6) {
      crane.y = lerp(2.0, H + 4, ease((T - 1.9) / 0.7));
    } else {
      state.crane = null;
      c.onDone?.();
    }
    placeCrane();
  }

  return {
    x0,
    x1,
    plate,
    pads,
    focus: new THREE.Vector3(cx, 0, cz),
    door: new THREE.Vector3(x0 - 0.5, 1.6, cz),
    // drive-in and drive-out points
    inside: new THREE.Vector3(cx, 0, cz),
    outside: new THREE.Vector3(x1 + 3.2, 0, cz),
    bindBlocks(list) {
      blocksRef = list;
    },
    openIn() {
      state.openIn = true;
    },
    closeIn() {
      state.openIn = false;
    },
    openOut() {
      state.openOut = true;
    },
    get inDoor() {
      return state.inDoor;
    },
    get outDoor() {
      return state.outDoor;
    },
    setInside,
    setOffers,
    install,
    get busy() {
      return !!state.crane;
    },
    update,
  };
}
