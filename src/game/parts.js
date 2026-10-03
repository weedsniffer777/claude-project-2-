// Parts bolted onto the tank at checkpoints during a run. Each one changes a
// stat and shows up on the model; all of them are lost when the run ends.
// The boost (the fuel drums rigged as boosters) is the zone's fixed one-time
// find: an ability, not a pick.
import * as THREE from 'three';
import { box, cyl, put } from '../models/kit.js';
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
      const g = new THREE.Group();
      put(g, box(0.62, 0.36, 1.1, DARKOLIVE, { r: 0.05 }), -1.12, 0.26, 0);
      put(g, box(0.5, 0.06, 0.9, OLIVE, { r: 0.02 }), -1.12, 0.46, 0);
      put(g, cyl(0.07, 0.5, STEEL, { axis: 'x', seg: 8 }), -0.8, 0.18, 0.4);
      t.turret.add(g);
      return g;
    },
    // on its pallet: the whole loader, carousel and rammer behind a breech
    model() {
      const g = new THREE.Group();
      put(g, box(0.5, 0.5, 0.55, DARK, { r: 0.04 }), 0.75, 0.45, 0); // breech block
      put(g, cyl(0.1, 0.5, STEEL, { axis: 'x', seg: 10 }), 1.2, 0.5, 0); // gun stub
      put(g, box(0.9, 0.62, 1.1, DARKOLIVE, { r: 0.06 }), 0, 0.42, 0); // bustle housing
      const drum = put(g, cyl(0.42, 0.6, STEEL, { axis: 'x', seg: 12 }), 0, 0.47, 0); // carousel
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        put(drum, cyl(0.07, 0.62, 0xc9a24a, { seg: 6 }), 0, Math.cos(a) * 0.3, Math.sin(a) * 0.3); // shell bases
      }
      put(g, box(1.1, 0.08, 0.12, 0xc99a2e, { r: 0.02 }), 0.3, 0.86, 0); // rammer rail
      put(g, box(0.18, 0.18, 0.18, DARK, { r: 0.03 }), -0.2, 0.86, 0);
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
      // tan bricks with dark gaps: a row across the glacis, and chevrons on
      // the turret cheeks
      const g = new THREE.Group();
      for (let i = 0; i < 6; i++) {
        const z = -0.75 + i * 0.3;
        const b = put(g, box(0.4, 0.13, 0.26, ERA_TAN, { r: 0.02 }), 1.5, 0.99, z);
        b.rotation.z = -0.5;
        put(g, box(0.42, 0.05, 0.03, ERA_EDGE), 1.52, 1.05, z + 0.14).rotation.z = -0.5;
      }
      t.chassis.add(g);
      const tg = new THREE.Group();
      for (const s of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const b = put(tg, box(0.3, 0.26, 0.12, ERA_TAN, { r: 0.02 }), 0.62 - i * 0.16, 0.2, s * (0.48 + i * 0.2));
          b.rotation.y = s * (0.75 + i * 0.12);
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
    name: 'Afterburner',
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
      const g = new THREE.Group();
      put(g, cyl(0.4, 1.0, OLIVE, { axis: 'x', seg: 16 }), 0, 0.42, 0);
      put(g, cyl(0.42, 0.12, 0x3b3f6a, { axis: 'x', seg: 16 }), -0.55, 0.42, 0); // heat-blued nozzle ring
      put(g, cyl(0.26, 0.05, 0x9fe4ff, { axis: 'x', seg: 12, glow: true }), -0.62, 0.42, 0);
      put(g, cyl(0.14, 0.06, 0xff5fd0, { axis: 'x', seg: 10, glow: true }), -0.65, 0.42, 0);
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
      const g = new THREE.Group();
      put(g, box(0.34, 0.2, 0.2, DARK, { r: 0.03 }), 0.2, 0.62, 0.15);
      put(g, cyl(0.07, 0.12, 0x5fe6ff, { axis: 'x', seg: 10, glow: true }), 0.38, 0.62, 0.15);
      put(g, box(0.1, 0.18, 0.1, STEEL, { r: 0.02 }), 0.12, 0.5, 0.15);
      t.turret.add(g);
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
