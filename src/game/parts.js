// Parts bolted onto the tank at checkpoints during a run. Each one changes a
// stat and shows up on the model; all of them are lost when the run ends.
// The boost (the fuel drums rigged as boosters) is the zone's fixed one-time
// find: an ability, not a pick.
import * as THREE from 'three';
import { box, cyl, put, toon } from '../models/kit.js';
import { PLAYER_LAYER } from '../render/pixel.js';

export const BASE_STATS = {
  maxHp: 100,
  reload: 1.8,
  cannonDamage: 60,
  splash: 2.4,
  mgDamage: 3,
  mgRange: 12,
  armor: 1, // damage taken multiplier
  ramDamage: 0, // contact damage at speed (dozer)
  crushHeavy: false,
  twinMg: false,
  view: 1, // camera view scale (optics)
  boostSpeed: 1, // x the base boost speed
  boostTime: 1.0,
  boostCooldown: 6,
  afterburner: false,
};

const RUST = 0x6d5a48;
const STEEL = 0x676e75;
const OLIVE = 0x5f6f47;
const DARKOLIVE = 0x4a5638;
const DARK = 0x262b32;

// icon: 16x10 pixel art for the end screen ('.' clear, '#' bone, '+' amber,
// '-' steel, '*' cyan, '%' pink)
const ERA_TAN = 0xb59d63;
const ERA_EDGE = 0x3a3626;
export const PARTS = {
  dozer: {
    name: 'Dozer blade',
    text: 'Ram walkers for heavy damage. Plows through wrecks.',
    icon: ['................', '.##############.', '.#++++++++++++#.', '.#++++++++++++#.', '.#++++++++++++#.', '.##############.', '...-........-...', '...--......--...', '....--------....', '................'],
    apply(s) {
      s.ramDamage = 45;
      s.crushHeavy = true;
    },
    build(t) {
      const g = new THREE.Group();
      const blade = put(g, box(0.16, 0.7, 2.5, RUST, { r: 0.03 }), 2.3, 0.42, 0);
      blade.rotation.z = 0.18;
      put(g, box(0.05, 0.12, 2.52, 0xc99a2e, { r: 0.01 }), 2.39, 0.72, 0);
      for (const z of [-0.85, 0.85]) {
        const arm = put(g, box(0.9, 0.12, 0.12, STEEL, { r: 0.02 }), 1.85, 0.48, z);
        arm.rotation.z = -0.1;
      }
      t.chassis.add(g);
      return g;
    },
  },
  autoloader: {
    name: 'Autoloader',
    text: 'Main gun reloads 40% faster.',
    icon: ['................', '..-----.........', '.-#####-######..', '.-#+#+#-#----#..', '.-#####-#----###', '.-#+#+#-#----#..', '.-#####-######..', '..-----.........', '................', '................'],
    apply(s) {
      s.reload *= 0.6;
    },
    build(t) {
      // a welded bustle box on the turret rear: the magazine lives in here
      const g = new THREE.Group();
      put(g, box(0.75, 0.42, 1.3, DARKOLIVE, { r: 0.04 }), -1.15, 0.24, 0);
      put(g, box(0.7, 0.05, 1.24, OLIVE, { r: 0.02 }), -1.15, 0.47, 0); // lid
      t.turret.add(g);
      return g;
    },
    // on its pallet: the magazine module, shells racked crosswise in a frame
    // with coloured side plates, and the breech it feeds
    model() {
      const g = new THREE.Group();
      const F = 0x8a6a3a; // frame
      // frame: corner posts and rails
      for (const x of [-0.55, 0.55]) for (const z of [-0.45, 0.45]) put(g, box(0.06, 0.62, 0.06, F, { r: 0.01 }), x, 0.33, z);
      for (const y of [0.05, 0.62]) for (const z of [-0.45, 0.45]) put(g, box(1.16, 0.05, 0.05, F, { r: 0.01 }), 0, y, z);
      // side plates (an orange service panel on one)
      put(g, box(0.04, 0.56, 0.86, 0xd06a2a, { r: 0.01 }), 0.57, 0.33, 0);
      put(g, box(0.04, 0.4, 0.5, 0x3a8fb0, { r: 0.01 }), 0.6, 0.36, 0.05);
      put(g, box(0.04, 0.56, 0.86, 0x6a6e74, { r: 0.01 }), -0.57, 0.33, 0);
      // racked rounds, two layers of four, brass bases toward the gun
      for (const y of [0.2, 0.46]) {
        for (let i = 0; i < 4; i++) {
          const z = -0.3 + i * 0.2;
          put(g, cyl(0.07, 1.0, 0x5d6650, { axis: 'x', seg: 8 }), 0, y, z);
          put(g, cyl(0.075, 0.12, 0xc9a24a, { axis: 'x', seg: 8 }), 0.5, y, z);
        }
      }
      // feed tray, then the breech ring and a stub of the gun
      put(g, box(0.5, 0.06, 0.24, STEEL, { r: 0.02 }), 0.85, 0.33, 0);
      put(g, box(0.44, 0.46, 0.5, 0x8e96a0, { r: 0.04 }), 1.3, 0.33, 0);
      put(g, cyl(0.17, 0.3, 0x8e96a0, { axis: 'x', seg: 12 }), 1.65, 0.33, 0);
      put(g, cyl(0.1, 0.8, 0x9aa2ac, { axis: 'x', seg: 10 }), 2.15, 0.33, 0);
      return g;
    },
  },
  era: {
    name: 'Reactive armour',
    text: 'Take 30% less damage.',
    icon: ['................', '.###.###.###.###', '.#+#.#+#.#+#.#+#', '.###.###.###.###', '................', '...###.###.###..', '...#+#.#+#.#+#..', '...###.###.###..', '................', '................'],
    apply(s) {
      s.armor *= 0.7;
    },
    build(t) {
      // T-72 style: a grid of green tiles over the glacis, and on the turret
      // a sharp clamshell V of tiles fanning back from the gun mantlet
      const G = 0x56653a;
      const EDGE = 0x333d22;
      const g = new THREE.Group();
      for (let r = 0; r < 2; r++) {
        for (let i = 0; i < 6; i++) {
          const z = -0.72 + i * 0.29;
          const tile = put(g, box(0.3, 0.07, 0.26, G, { r: 0.01 }), 1.42 + r * 0.26, 0.93 + r * 0.12, z);
          tile.rotation.z = -0.42;
          put(g, box(0.31, 0.02, 0.02, EDGE), 1.42 + r * 0.26, 0.97 + r * 0.12, z + 0.135).rotation.z = -0.42;
        }
      }
      t.chassis.add(g);
      const tg = new THREE.Group();
      for (const side of [-1, 1]) {
        // each arm of the V: tiles stepping back and out from the mantlet,
        // tipped up toward the front like a raised clam shell
        for (let i = 0; i < 5; i++) {
          const holder = new THREE.Group();
          holder.position.set(0.82 - i * 0.17, 0.33 + i * 0.012, side * (0.24 + i * 0.13));
          holder.rotation.y = side * -0.62;
          const tile = put(holder, box(0.32, 0.07, 0.22, G, { r: 0.01 }), 0, 0, 0);
          tile.rotation.z = 0.32;
          put(holder, box(0.33, 0.02, 0.02, EDGE), 0, 0.045, 0.11).rotation.z = 0.32;
          tg.add(holder);
        }
        // and a short row down each cheek
        for (let i = 0; i < 3; i++) {
          const holder = new THREE.Group();
          holder.rotation.y = side * (0.55 + i * 0.22);
          holder.position.y = 0.13;
          put(holder, box(0.08, 0.17, 0.24, G, { r: 0.01 }), 1.0, 0, 0).rotation.z = -0.2;
          tg.add(holder);
        }
      }
      t.turret.add(tg);
      g.userData.extra = [tg];
      return g;
    },
    model() {
      const g = new THREE.Group();
      const plate = put(g, box(1.3, 0.08, 0.9, OLIVE, { r: 0.02 }), 0, 0.3, 0);
      plate.rotation.z = 0.35;
      for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
        const b = put(plate, box(0.36, 0.14, 0.36, ERA_TAN, { r: 0.02 }), -0.42 + c * 0.42, 0.11, -0.2 + r * 0.42);
        b.userData.era = true;
      }
      return g;
    },
  },
  twinmg: {
    name: 'Twin MG',
    text: 'A second MG on the cupola. It picks its own target.',
    icon: ['................', '.....------.....', '.....-####-.....', '#########-#.....', '.....-####-.....', '.....------.....', '#########-#.....', '.....-####-.....', '.....------.....', '................'],
    apply(s) {
      s.twinMg = true;
    },
    // a pintle mount on the commander's cupola; the game turns its pivot
    build(t) {
      const g = new THREE.Group();
      const at = t.commanderTop || new THREE.Vector3(-0.15, 0.45, -0.42);
      g.position.copy(at);
      put(g, cyl(0.2, 0.04, DARK, { seg: 14 }), 0, -0.08, 0); // ring
      put(g, cyl(0.035, 0.18, STEEL, { seg: 8 }), 0, 0.02, 0); // pintle
      const pivot = new THREE.Group();
      pivot.position.y = 0.14;
      g.add(pivot);
      put(pivot, box(0.38, 0.11, 0.11, DARK, { r: 0.025 }), 0.02, 0, 0);
      put(pivot, cyl(0.03, 0.7, DARK, { axis: 'x', seg: 8 }), 0.5, 0.01, 0);
      put(pivot, cyl(0.045, 0.1, DARK, { axis: 'x', seg: 8 }), 0.82, 0.01, 0);
      put(pivot, box(0.16, 0.12, 0.08, OLIVE, { r: 0.015 }), 0.02, -0.03, -0.1);
      put(pivot, box(0.14, 0.2, 0.03, OLIVE, { r: 0.01 }), 0.12, 0.08, 0); // gun shield
      g.userData.pivot = pivot;
      g.userData.muzzle = new THREE.Vector3(0.9, 0.01, 0);
      t.turret.add(g);
      return g;
    },
  },
  afterburner: {
    name: 'Improved boost',
    badge: 'up', // its picture gets an up arrow: an improved ability
    text: 'Boost burns hotter: faster and longer, but a longer recharge.',
    icon: ['................', '......-----.....', '%%%***-###-.....', '.%%%**-###-.....', '%%%***-###-.....', '......-----.....', '................', '................', '................', '................'],
    apply(s) {
      s.boostSpeed *= 1.25;
      s.boostTime *= 1.35;
      s.boostCooldown += 2;
      s.afterburner = true;
    },
    build(t) {
      // nothing new to see until it fires: the flame burns blue and pink
      const g = new THREE.Group();
      t.chassis.add(g);
      return g;
    },
    model() {
      // one of the T-55's own rear drums, re-rigged: rolled rims, straps
      // and buckles, the filler cap; on one end a rocket nozzle bolted on
      const g = new THREE.Group();
      const DR = 0.41;
      const DL = 1.0;
      const y = DR + 0.02;
      put(g, cyl(DR, DL, OLIVE, { axis: 'x', seg: 20 }), 0, y, 0);
      for (const s of [-1, 1]) {
        put(g, cyl(DR + 0.014, 0.05, DARKOLIVE, { axis: 'x', seg: 20 }), s * (DL / 2 - 0.03), y, 0); // rolled rims
        put(g, cyl(DR + 0.01, 0.04, DARK, { axis: 'x', seg: 20 }), s * DL * 0.24, y, 0); // straps
        put(g, box(0.07, 0.07, 0.09, STEEL, { r: 0.014 }), s * DL * 0.24, y + DR + 0.02, 0); // buckles
      }
      put(g, cyl(0.075, 0.03, DARKOLIVE, { axis: 'x', seg: 10 }), DL / 2 + 0.02, y + 0.22, 0.1); // filler cap
      // the engine end: a mounting collar, a flared bell, a dark throat
      const end = -DL / 2;
      put(g, cyl(DR - 0.04, 0.12, STEEL, { axis: 'x', seg: 18 }), end - 0.05, y, 0);
      const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.2, 0.42, 16, 1, true), toon(0x3b3f6a));
      bell.material.side = THREE.DoubleSide;
      bell.rotation.z = Math.PI / 2; // wide end facing out the back (-x)
      bell.position.set(end - 0.31, y, 0);
      g.add(bell);
      put(g, cyl(0.19, 0.04, 0x1d1f22, { axis: 'x', seg: 14 }), end - 0.12, y, 0);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        put(g, box(0.34, 0.03, 0.03, STEEL, { r: 0.005 }), end - 0.2, y + Math.cos(a) * 0.27, Math.sin(a) * 0.27); // braces
      }
      return g;
    },
  },
  optics: {
    name: 'Optics',
    text: 'A better sight: see further around you, MG reaches further.',
    icon: ['................', '....######......', '...#------#.....', '..#--****--#####', '..#--*##*--#....', '..#--****--#####', '...#------#.....', '....######......', '................', '................'],
    apply(s) {
      s.view *= 1.14;
      s.mgRange += 2;
    },
    build(t) {
      const g = sightHead();
      g.position.set(0.15, 0.52, 0.3);
      g.scale.setScalar(0.62);
      t.turret.add(g);
      return g;
    },
    model() {
      const g = new THREE.Group();
      const head = sightHead();
      head.rotation.y = -Math.PI * 0.75; // lens toward the camera (and the results picture)
      head.position.y = 0.05;
      g.add(head);
      return g;
    },
  },
  he: {
    name: 'HE-frag shells',
    text: 'Bigger blast and +20 damage per shot.',
    icon: ['................', '......+.........', '.....+++........', '.....+++........', '.....###........', '.....+++........', '.....###........', '................', '................', '................'],
    apply(s) {
      s.splash *= 1.5;
      s.cannonDamage += 20;
    },
    build(t) {
      const g = new THREE.Group();
      put(g, box(0.62, 0.3, 0.42, 0x6b5a3e, { r: 0.03 }), -1.25, 1.2, 0.45);
      put(g, box(0.63, 0.06, 0.43, 0xc99a2e, { r: 0.01 }), -1.25, 1.24, 0.45);
      t.chassis.add(g);
      return g;
    },
  },
  plating: {
    name: 'Scrap plating',
    text: '+30 max HP, and repairs 30 now.',
    icon: ['................', '.#########......', '.#+#+++#+#......', '.#########......', '.#+++#+++#......', '.#########......', '................', '................', '................', '................'],
    apply(s) {
      s.maxHp += 30;
    },
    heal: 30,
    build(t) {
      const g = new THREE.Group();
      for (const z of [-1.2, 1.2]) {
        put(g, box(1.5, 0.42, 0.05, RUST, { r: 0.01 }), 0.5, 0.72, z).rotation.x = z > 0 ? 0.08 : -0.08;
        put(g, box(1.3, 0.38, 0.05, 0x5d6650, { r: 0.01 }), -0.95, 0.7, z).rotation.x = z > 0 ? 0.05 : -0.05;
      }
      t.chassis.add(g);
      return g;
    },
  },
};

// An armoured sight head: a boxy housing, a big blue main lens and two
// small ones in a recessed face, an armoured shutter swung open to the side.
function sightHead() {
  const g = new THREE.Group();
  const SAND = 0x8f8358;
  const DARKSAND = 0x6f6644;
  put(g, box(0.34, 0.1, 0.42, DARK, { r: 0.02 }), -0.05, 0.05, 0); // traverse ring
  put(g, box(0.6, 0.46, 0.5, SAND, { r: 0.05 }), 0, 0.33, 0); // housing
  put(g, box(0.5, 0.06, 0.52, DARKSAND, { r: 0.02 }), -0.03, 0.58, 0); // brow plate over the face
  // armoured face: a frame round a dark window, the glass set back in it
  put(g, box(0.06, 0.4, 0.42, DARKSAND, { r: 0.02 }), 0.31, 0.33, 0);
  put(g, box(0.03, 0.32, 0.34, 0x16181b), 0.34, 0.33, 0);
  put(g, cyl(0.12, 0.04, 0x2f5fd0, { axis: 'x', seg: 14, glow: true }), 0.355, 0.3, 0.05); // main lens
  put(g, cyl(0.07, 0.045, 0x9fe4ff, { axis: 'x', seg: 12, glow: true }), 0.36, 0.3, 0.05);
  put(g, cyl(0.045, 0.04, 0x5fe6a0, { axis: 'x', seg: 10, glow: true }), 0.355, 0.42, -0.1); // rangefinder
  // shutter hinged on the face's edge, swung open
  const hinge = new THREE.Group();
  hinge.position.set(0.34, 0.33, 0.21);
  hinge.rotation.y = -1.25;
  put(hinge, box(0.04, 0.38, 0.36, DARKSAND, { r: 0.015 }), 0.02, 0, 0.18);
  g.add(hinge);
  return g;
}

// Mark a freshly built part for the player's team outline.
export function attachPart(tank, id) {
  const g = PARTS[id].build(tank);
  for (const o of [g, ...(g.userData.extra || [])]) o.traverse((m) => m.isMesh && m.layers.enable(PLAYER_LAYER));
  g.userData.part = id;
  return g;
}

export function statsFor(parts) {
  const s = { ...BASE_STATS };
  for (const id of parts) PARTS[id].apply(s);
  return s;
}

// A small model of the part, for its pallet in the depot.
export function partModel(id) {
  const g = new THREE.Group();
  const fake = { chassis: g, turret: g, commanderTop: new THREE.Vector3() };
  const built = PARTS[id].model ? PARTS[id].model() : PARTS[id].build(fake);
  if (built.parent !== g) g.add(built);
  // centre it on the pallet
  const bb = new THREE.Box3().setFromObject(built);
  const c = bb.getCenter(new THREE.Vector3());
  built.position.sub(new THREE.Vector3(c.x, bb.min.y, c.z));
  return g;
}
