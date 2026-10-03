// The tank crewman walking round the base. The body is a rigged low-poly
// figure ("Stickman Low Poly" by studentsimf, CC-BY-4.0, see CREDITS.md),
// dressed here: coloured by bone (olive jacket, dark trousers and boots,
// gloves), with a padded tanker's helmet (ribs, ear pads, goggles pushed up),
// a fur collar, a belt and a map case added onto its bones. No face.
//
// Animated in code: a walk/jog cycle locked to the distance covered (no
// foot sliding), arms swinging opposite the legs with bent elbows, a bob and
// a twist through the body, a lean into the walk; when standing, breathing,
// a weight shift and an occasional look round.
//
// +X is forward (like the other models). The model loads async; update()
// does nothing until it is in.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { box, gradientMap } from './kit.js';

const URL_MODEL = new URL('../assets/crew.gltf.json', import.meta.url).href;
const HEIGHT = 1.45; // world units, head top
const MODEL_H = 620; // the model's own units, feet to head top
const LEG = 223; // hip to sole, model units
const STRIDE = 4 * LEG * Math.sin(0.55); // ground covered per walk cycle (two steps)

const C = {
  jacket: 0x5f6b46,
  sleeve: 0x56613f,
  trousers: 0x3d4146,
  boots: 0x1f1f20,
  gloves: 0x2c2723,
  skin: 0xc49a7a,
  helmet: 0x2f2b26,
  rib: 0x24211d,
  pad: 0x1c1a18,
  goggles: 0x8fa4a8,
  fur: 0xa48a66,
  belt: 0x4a3a2a,
  brass: 0xb08a3e,
};

let loading = null;
const load = () => (loading ??= new GLTFLoader().loadAsync(URL_MODEL));

function toonMat(color, opts = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap, ...opts });
}
function mesh(geo, color) {
  const m = new THREE.Mesh(geo, toonMat(color));
  m.castShadow = true;
  return m;
}
function at(parent, obj, x, y, z) {
  obj.position.set(x, y, z);
  parent.add(obj);
  return obj;
}

// colour each vertex by the bone that moves it most (and by height for the
// boots), so the plain figure reads as jacket, trousers, gloves, boots, face
function paint(skinned) {
  const geo = skinned.geometry;
  const names = skinned.skeleton.bones.map((b) => b.name);
  const pos = geo.attributes.position;
  const idx = geo.attributes.skinIndex;
  const wt = geo.attributes.skinWeight;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    let best = 0;
    for (let k = 1; k < 4; k++) if (wt.getComponent(i, k) > wt.getComponent(i, best)) best = k;
    const name = names[idx.getComponent(i, best)] || '';
    const y = pos.getY(i);
    let hex = C.jacket;
    if (name.startsWith('head')) hex = C.skin;
    else if (/hand_[lr]_3/.test(name)) hex = C.gloves;
    else if (/hand_[lr]_2/.test(name)) hex = C.sleeve;
    else if (name.startsWith('foot')) hex = y < 46 ? C.boots : C.trousers;
    else if (name.startsWith('body_00') && y < 250) hex = C.trousers;
    c.setHex(hex); // (setHex already gives linear values)
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

// the helmet, collar, belt and the rest, on the bones (model units)
function dress(bone) {
  // padded tanker's helmet over the round head (centre ~77 above the bone)
  {
    const h = new THREE.Group();
    h.position.y = 77;
    h.rotation.x = -0.22; // sits back a little, more over the back of the head
    bone.head.add(h);
    const shell = mesh(new THREE.SphereGeometry(114, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), C.helmet);
    h.add(shell);
    // the padded ribs running front to back over the top
    for (const x of [-38, 0, 38]) {
      // from low at the back, over the top, to the brow
      const r = Math.sqrt(119 * 119 - x * x);
      const rib = at(h, mesh(new THREE.TorusGeometry(r, 9, 5, 14, 2.75), C.rib), x, 0, 0);
      rib.rotation.set(-0.45, Math.PI / 2, 0);
    }
    // ear pads and the flaps they sit on
    for (const s of [-1, 1]) {
      at(h, mesh(new THREE.BoxGeometry(18, 70, 66), C.helmet), s * 100, -24, -6);
      const pad = at(h, mesh(new THREE.CylinderGeometry(30, 30, 16, 10), C.pad), s * 108, -20, -4);
      pad.rotation.z = Math.PI / 2;
    }
    // goggles pushed up on the brow: the strap round, two lenses in frames
    const strap = at(h, mesh(new THREE.TorusGeometry(108, 6, 4, 22), C.rib), 0, 34, 0);
    strap.rotation.x = Math.PI / 2 - 0.35;
    for (const s of [-1, 1]) {
      const g = new THREE.Group();
      g.position.set(s * 34, 52, 92);
      g.rotation.x = 0.9;
      h.add(g);
      g.add(mesh(new THREE.CylinderGeometry(25, 27, 18, 10), C.rib));
      at(g, new THREE.Mesh(new THREE.CylinderGeometry(19, 19, 4, 10), toonMat(C.goggles)), 0, 9, 0);
    }
  }
  // fur collar round the neck, the belt with its buckle, a map case on its
  // strap, two chest pockets
  const collar = at(bone.chest, mesh(new THREE.TorusGeometry(52, 18, 6, 14), C.fur), 0, 38, 2);
  collar.rotation.x = Math.PI / 2;
  collar.scale.set(1.1, 1, 1);
  const belt = at(bone.hips, mesh(new THREE.TorusGeometry(66, 11, 4, 16), C.belt), 0, 12, 0);
  belt.rotation.x = Math.PI / 2;
  belt.scale.set(1.04, 0.92, 1);
  at(bone.hips, box(26, 22, 8, C.brass, { r: 3 }), 0, 12, 62);
  at(bone.hips, box(18, 70, 62, C.belt, { r: 6 }), -76, -14, 6);
  const sling = at(bone.spine, box(10, 170, 8, C.belt, { r: 3 }), 6, 18, 54);
  sling.rotation.z = -0.62;
  for (const s of [-1, 1]) at(bone.spine, box(34, 30, 8, C.sleeve, { r: 4 }), s * 30, 40, 50);
  // boot tops
  for (const shin of bone.shins) {
    const cuff = at(shin, mesh(new THREE.TorusGeometry(26, 9, 4, 10), C.boots), 0, -70, -4);
    cuff.rotation.x = Math.PI / 2;
  }
}

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const qa = new THREE.Quaternion();
const qb = new THREE.Quaternion();

export function createCrew({ layer = null } = {}) {
  const group = new THREE.Group();
  const holder = new THREE.Group();
  holder.rotation.y = Math.PI / 2; // the model faces +Z; ours face +X
  holder.scale.setScalar(HEIGHT / MODEL_H);
  group.add(holder);

  let rig = null;
  load().then((gltf) => {
    const root = cloneSkinned(gltf.scene);
    let skinned = null;
    root.traverse((o) => {
      if (o.isSkinnedMesh) skinned = o;
    });
    const bones = {};
    root.traverse((o) => {
      if (o.isBone) bones[o.name] = o;
    });
    paint(skinned);
    skinned.material = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap });
    skinned.castShadow = true;
    skinned.frustumCulled = false;
    const b = (n) => bones[n];
    const bone = {
      hips: b('body_00'),
      spine: b('body2_01'),
      chest: b('body3_02'),
      neck: b('neck_013'),
      head: b('head_014'),
      arms: [
        { shoulder: b('shoulder_l_03'), upper: b('hand_l_1_04'), fore: b('hand_l_2_05'), hand: b('hand_l_3_06'), side: -1 },
        { shoulder: b('shoulder_r_08'), upper: b('hand_r_1_09'), fore: b('hand_r_2_010'), hand: b('hand_r_3_011'), side: 1 },
      ],
      legs: [
        { thigh: b('foot_l_1_019'), shin: b('foot_l_2_020'), foot: b('foot_l_3_021'), side: -1 },
        { thigh: b('foot_r_1_015'), shin: b('foot_r_2_016'), foot: b('foot_r_3_017'), side: 1 },
      ],
    };
    bone.shins = bone.legs.map((l) => l.shin);
    dress(bone);
    const bind = new Map();
    root.traverse((o) => o.isBone && bind.set(o, o.quaternion.clone()));
    rig = { bone, bind, hipY: bone.hips.position.y };
    root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        if (layer != null) o.layers.enable(layer);
      }
    });
    holder.add(root);
  });

  // bone.quaternion = bind * (rotations about the bone's own axes, in order)
  function pose(b, ...rots) {
    const q = b.quaternion.copy(rig.bind.get(b));
    for (const [axis, a] of rots) if (a) q.multiply(qa.setFromAxisAngle(axis, a));
  }
  // the upper arm: hanging down at the side, swung forward/back, set in the
  // chest's frame whatever the shoulder bone's own rest turn
  function armTo(arm, down, swing, out) {
    const s = arm.side; // -1: the arm that rests along -x
    qb.setFromAxisAngle(X, -swing).multiply(qa.setFromAxisAngle(Z, -s * (down - out)));
    arm.upper.quaternion.copy(arm.shoulder.quaternion).invert().multiply(qb);
  }

  let phase = 0;
  let look = 0;
  let lookT = 2;
  let lookTo = 0;
  // speed: 0..1 of walkSpeed (world units/s)
  function update(dt, t, speed = 0, walkSpeed = 3.4) {
    if (!rig) return;
    const { bone } = rig;
    const s = Math.min(1, Math.max(0, speed));
    const idle = 1 - s;
    // the cycle advances with the ground covered
    phase += ((s * walkSpeed * dt) / ((STRIDE * HEIGHT) / MODEL_H)) * Math.PI * 2;
    if (s < 0.05) phase += (Math.round(phase / Math.PI) * Math.PI - phase) * Math.min(1, dt * 6); // settle feet together
    const sn = Math.sin(phase);
    const cs = Math.cos(phase);

    // legs: the thigh swings, the knee folds through the swing, the foot
    // stays near flat and rolls off the toe
    for (const leg of bone.legs) {
      const p = leg.side < 0 ? sn : -sn;
      const c = leg.side < 0 ? cs : -cs;
      const thigh = -0.55 * p * s;
      const knee = (0.12 + 0.95 * Math.max(0, c) * Math.max(0, -p + 0.6)) * s + 0.04 * idle;
      const foot = -(thigh + knee) * 0.85 + 0.15 * Math.max(0, p) * s;
      pose(leg.thigh, [X, thigh], [Z, -leg.side * 0.03 * idle]);
      pose(leg.shin, [X, knee]);
      pose(leg.foot, [X, foot]);
    }
    // body: up at mid-stance, down as the feet pass; a twist with the hips,
    // a lean into the walk; breathing and a slow sway standing still
    bone.hips.position.y = rig.hipY + (Math.abs(cs) * 9 - 6) * s - Math.sin(t * 1.6) * 1.2 * idle;
    pose(bone.hips, [Y, 0.12 * sn * s], [Z, 0.04 * Math.sin(t * 0.6) * idle]);
    pose(bone.spine, [X, 0.16 * s], [Y, -0.2 * sn * s], [Z, -0.04 * Math.sin(t * 0.6) * idle]);
    pose(bone.chest, [X, 0.025 * Math.sin(t * 1.6) * idle - 0.05 * s]);
    // head steady against the body's twist, looking round now and then
    lookT -= dt;
    if (lookT <= 0) {
      lookT = 2 + Math.random() * 3;
      lookTo = idle > 0.5 && Math.random() < 0.6 ? (Math.random() - 0.5) * 1.2 : 0;
    }
    look += ((idle > 0.5 ? lookTo : 0) - look) * Math.min(1, dt * 3);
    pose(bone.neck, [Y, 0.08 * sn * s]);
    pose(bone.head, [Y, look], [X, -0.08 * s + 0.03 * Math.sin(t * 0.8) * idle]);

    // arms: opposite the legs, elbows bending more as he picks up speed
    for (const arm of bone.arms) {
      const p = arm.side < 0 ? -sn : sn;
      armTo(arm, 1.32 - 0.04 * Math.sin(t * 1.6) * idle, 0.6 * p * s + 0.05 * s, 0.1 * s);
      pose(arm.fore, [Y, -arm.side * (0.35 + 0.55 * s + 0.3 * Math.max(0, p) * s)]);
      pose(arm.hand, [Y, -arm.side * 0.15]);
    }
  }
  return { group, update };
}
