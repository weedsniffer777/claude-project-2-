// A depot shack: a corrugated garage built right across the street at the
// border between two sectors, walled in on both sides so it's the only way
// through. Closed until the sector is clear; then the front roller door goes
// up and driving in fades to the depot interior (see depotRoom.js). The tank
// comes back out of the back door into the next sector.
import * as THREE from 'three';
import { box, put, toon, glowMat, gradientMap } from '../models/kit.js';
import { canvas, tex, speckle } from './builder.js';

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

// CHECKPOINT (or another word), drawn letter by letter and snapped to hard
// pixels.
const signTexs = {};
function signTexture(label = 'CHECKPOINT') {
  if (signTexs[label]) return signTexs[label];
  const [c, g] = canvas(120, 24);
  g.fillStyle = '#1b1f24';
  g.fillRect(0, 0, 120, 24);
  g.fillStyle = '#cfe8ff';
  g.font = 'bold 15px monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(label, 60, 13);
  // threshold to hard pixels, with a dim glow fringe round the letters
  const img = g.getImageData(0, 0, 120, 24);
  const d = img.data;
  const lit = new Uint8Array(120 * 24);
  for (let i = 0; i < lit.length; i++) lit[i] = d[i * 4 + 2] > 150 ? 1 : 0;
  for (let y = 0; y < 24; y++) {
    for (let x = 0; x < 120; x++) {
      const i = y * 120 + x;
      let near = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) near |= lit[(y + dy) * 120 + x + dx] || 0;
      const [r, gg, b] = lit[i] ? [207, 232, 255] : near ? [52, 92, 120] : [27, 31, 36];
      d.set([r, gg, b, 255], i * 4);
    }
  }
  g.putImageData(img, 0, 0);
  signTexs[label] = tex(c);
  return signTexs[label];
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
export function buildShack(B, { x0, x1, z0, z1, fill, heightAt, label = 'CHECKPOINT' }) {
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const L = x1 - x0;
  const Wd = z1 - z0;
  const DOOR = 5; // door opening width
  const wall = (x, z, w, d, h, color) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), tin(Math.max(w, d), h, color));
    m.position.set(x, h / 2, z);
    m.castShadow = m.receiveShadow = true;
    B.add(m);
    B.solid(m);
    return m;
  };
  const WALL = 0x8a9a8e;
  const DARK = 0x6d7a72;

  let signMesh = null;
  let signGlow = null;
  // back (north) wall: always shown
  wall(cx, z0 - 0.15, L + 0.3, 0.3, H, DARK);
  B.block(cx, z0 - 0.15, L / 2 + 0.15, 0.2);
  // south wall: hidden while inside
  wall(cx, z1 + 0.15, L + 0.3, 0.3, H, WALL);
  B.block(cx, z1 + 0.15, L / 2 + 0.15, 0.2);
  // end walls with the door openings
  const side = (Wd - DOOR) / 2;
  for (const [x, list] of [[x0 - 0.15, true], [x1 + 0.15, false]]) {
    // (a touch taller than the long walls, so the corners don't share a top face)
    wall(x, z0 + side / 2, 0.3, side, H + 0.04, list ? WALL : DARK);
    wall(x, z1 - side / 2, 0.3, side, H + 0.04, list ? WALL : DARK);
    wall(x, cz, 0.3, DOOR, 0.6, list ? WALL : DARK).position.y = H - 0.28;
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
    // a lit sign over the door: CHECKPOINT in cold tube letters
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 0.8), new THREE.MeshBasicMaterial({ map: signTexture(label), color: 0xffffff }));
    sign.rotation.y = -Math.PI / 2;
    sign.position.set(x0 - 0.42, H + 0.7, cz); // clear of the backing board's face
    B.add(sign);
    B.keep(sign);
    put(B.root, box(0.12, 0.9, 4.0, 0x2c3034), x0 - 0.3, H + 0.7, cz);
    signGlow = B.emit(new THREE.Vector3(x0 - 1.5, H, cz), COLD, 10, 8);
    signMesh = sign;
  }
  const beacon = B.keep(put(B.root, box(0.26, 0.2, 0.26, 0xffb02a, { glow: true }), cx, H + 0.95, cz));
  const beaconE = B.emit(new THREE.Vector3(cx, H + 1.4, cz), 0xffa21f, 10, 9);
  // green "go" lamps over both doors (lit once a door opens)
  const goLamps = [x0 - 0.35, x1 + 0.35].map((x) => B.keep(put(B.root, box(0.12, 0.2, 0.5, 0x1d2a20), x, H - 0.75, cz)));
  // floodlight pool on the apron in front
  B.pool(x0 - 2.2, cz, 3, SODIUM, 0.18, { sx: 0.9, sz: 1.3 });

  // entry and exit roller doors (in the game's block list while shut)
  const doorIn = rollerDoor(B, x0 - 0.15, cz, DOOR);
  const doorOut = rollerDoor(B, x1 + 0.15, cz, DOOR);
  const blockIn = B.block(x0 - 0.15, cz, 0.25, DOOR / 2);
  const blockOut = B.block(x1 + 0.15, cz, 0.25, DOOR / 2);

  // locked (a level can lock a checkpoint until an area's cleared): a red
  // hologram over the entry door, dashed edge, LOCKED across it, and the
  // lamp over the door blinking red
  const holo = (() => {
    const c = document.createElement('canvas');
    c.width = 80;
    c.height = 56;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(255, 50, 40, 0.22)';
    g.fillRect(0, 0, 80, 56);
    g.fillStyle = 'rgba(255, 60, 45, 0.35)';
    for (let i = -56; i < 80; i += 10) {
      g.beginPath();
      g.moveTo(i, 56);
      g.lineTo(i + 4, 56);
      g.lineTo(i + 60, 0);
      g.lineTo(i + 56, 0);
      g.fill();
    }
    g.fillStyle = '#ff4a3a';
    for (let x = 0; x < 80; x += 8) {
      g.fillRect(x, 0, 5, 3);
      g.fillRect(x, 53, 5, 3);
    }
    for (let y = 0; y < 56; y += 8) {
      g.fillRect(0, y, 3, 5);
      g.fillRect(77, y, 3, 5);
    }
    g.fillStyle = '#1a0606';
    g.fillRect(10, 20, 60, 16);
    g.fillStyle = '#ff6a5a';
    g.font = 'bold 13px monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('LOCKED', 40, 29);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = t.minFilter = THREE.NearestFilter;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(DOOR, H - 0.7), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.rotation.y = -Math.PI / 2;
    m.position.set(x0 - 0.45, (H - 0.7) / 2 + 0.05, cz);
    m.visible = false;
    B.add(m);
    B.keep(m);
    return m;
  })();

  // ------------------------------------------------------ behaviour
  const state = { inDoor: 0, outDoor: 0, openIn: false, openOut: false, locked: false, lockK: 0 };
  let blocksRef = B.blocks;
  const drop = (b) => {
    const i = blocksRef.indexOf(b);
    if (i >= 0) blocksRef.splice(i, 1);
  };
  const keepBlock = (b) => blocksRef.includes(b) || blocksRef.push(b);
  function update(dt, t) {
    // the tube sign stutters now and then, like old neon does
    const n = Math.sin(t * 7.3 + x0) + Math.sin(t * 2.1 + x0 * 0.3) * 1.4;
    const on = n > -1.9 || Math.sin(t * 60) > 0;
    signMesh.material.color.setScalar(on ? 1 : 0.35);
    signGlow.level = on ? 1 : 0.2;
    beacon.rotation.y = t * 5;
    beaconE.level = 0.45 + 0.55 * Math.max(0, Math.cos(t * 5));
    state.inDoor = THREE.MathUtils.clamp(state.inDoor + (state.openIn && !state.locked ? dt : -dt) * 0.9, 0, 1);
    state.outDoor = THREE.MathUtils.clamp(state.outDoor + (state.openOut ? dt : -dt) * 0.9, 0, 1);
    doorIn.position.y = state.inDoor * (H - 0.6);
    doorIn.scale.y = 1 - state.inDoor * 0.8;
    doorOut.position.y = state.outDoor * (H - 0.6);
    doorOut.scale.y = 1 - state.outDoor * 0.8;
    if (state.inDoor > 0.6) drop(blockIn);
    else if (state.inDoor < 0.3) keepBlock(blockIn);
    if (state.outDoor > 0.6) drop(blockOut);
    else if (state.outDoor < 0.3) keepBlock(blockOut);
    state.lockK = THREE.MathUtils.clamp(state.lockK + (state.locked ? dt * 4 : -dt * 2.5), 0, 1);
    holo.visible = state.lockK > 0.01;
    if (holo.visible) holo.material.opacity = state.lockK * (0.75 + Math.sin(t * 9) * 0.12 + (Math.random() < 0.04 ? -0.4 : 0)); // a hologram's flicker
    if (state.locked) signMesh.material.color.setScalar(0.3); // the sign dims
    goLamps[0].material = state.locked ? (Math.sin(t * 7) > 0 ? glowMat(0xff3b2f) : toon(0x2a1414)) : state.openIn && Math.sin(t * 6) > 0 ? glowMat(0x6be08a) : toon(0x1d2a20);
    goLamps[1].material = state.openOut && Math.sin(t * 6) > 0 ? glowMat(0x6be08a) : toon(0x1d2a20);
  }

  return {
    x0,
    x1,
    z0,
    z1,
    door: new THREE.Vector3(x0 - 0.5, 1.6, cz),
    // where the tank comes back out (the back door, already up)
    outside: new THREE.Vector3(x1 + 3.2, 0, cz),
    // its door blocks live in this list (a level that merges several builders' lists)
    bindBlocks(list) {
      blocksRef = list;
    },
    openIn() {
      state.openIn = true;
    },
    closeIn() {
      state.openIn = false;
    },
    // locked: the door won't open (openIn waits) and says so
    setLocked(on) {
      state.locked = on;
    },
    get locked() {
      return state.locked;
    },
    // the tank leaves through the back: snap that door open
    openOut() {
      state.openOut = true;
      state.outDoor = 1;
    },
    // (the endless base: shut behind you again)
    closeOut() {
      state.openOut = false;
    },
    get inDoor() {
      return state.inDoor;
    },
    update,
  };
}
