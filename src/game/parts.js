// Parts bolted onto the tank at depots during a run. Each one changes a stat
// and shows up on the model; all of them are lost when the run ends. The
// fuel-can rockets are the zone's fixed one-time find (an ability, not a pick).
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
};

const RUST = 0x6d5a48;
const STEEL = 0x676e75;
const OLIVE = 0x5f6f47;
const DARKOLIVE = 0x4a5638;
const DARK = 0x262b32;

// icon: a few pixel rows for the depot cards (# = ink, + = accent)
export const PARTS = {
  dozer: {
    name: 'Dozer blade',
    text: 'Ram machines for heavy damage. Plows through wrecks.',
    icon: ['..........', '##########', '#++++++++#', '#++++++++#', '##########', '.#......#.', '.#......#.'],
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
    icon: ['..######..', '.#++++++#.', '.#+####+#.', '.#+#..#+#.', '.#+####+#.', '.#++++++#.', '..######..'],
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
  },
  era: {
    name: 'Reactive armour',
    text: 'Take 30% less damage.',
    icon: ['##.##.##..', '##.##.##..', '..........', '.##.##.##.', '.##.##.##.', '..........', '##.##.##..'],
    apply(s) {
      s.armor *= 0.7;
    },
    build(t) {
      const g = new THREE.Group();
      for (let i = 0; i < 5; i++) {
        const b = put(g, box(0.34, 0.1, 0.3, 0x7a7f62, { r: 0.02 }), 1.45, 0.98, -0.66 + i * 0.33);
        b.rotation.z = -0.5;
      }
      t.chassis.add(g);
      const tg = new THREE.Group();
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
        const b = put(tg, box(0.28, 0.24, 0.1, 0x7a7f62, { r: 0.02 }), 0.55 - i * 0.02, 0.18, s * (0.62 + i * 0.12));
        b.rotation.y = s * (0.9 + i * 0.15);
      }
      t.turret.add(tg);
      return g;
    },
  },
  twinmg: {
    name: 'Twin MG',
    text: 'Roof MG deals double damage.',
    icon: ['..........', '########..', '..##......', '..........', '########..', '..##......', '..........'],
    apply(s) {
      s.mgDamage *= 2;
    },
    build(t) {
      const g = new THREE.Group();
      put(g, box(0.4, 0.12, 0.12, DARK, { r: 0.02 }), 0.2, 0.4, -0.72);
      put(g, cyl(0.035, 0.8, DARK, { axis: 'x', seg: 8 }), 0.75, 0.4, -0.72);
      put(g, box(0.18, 0.14, 0.12, OLIVE, { r: 0.02 }), 0.15, 0.32, -0.6);
      t.turret.add(g);
      return g;
    },
  },
  he: {
    name: 'HE-frag shells',
    text: 'Bigger blast and +20 damage per shot.',
    icon: ['....#.....', '...#+#....', '..#+++#...', '..#+++#...', '..#####...', '..#+++#...', '..#####...'],
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
    icon: ['#########.', '#+#+++#+#.', '#########.', '#+++#+++#.', '#########.', '..........', '..........'],
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
  g.traverse((o) => o.isMesh && o.layers.enable(PLAYER_LAYER));
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
  const fake = { chassis: g, turret: g };
  const built = PARTS[id].build(fake);
  // centre it on the pallet
  const bb = new THREE.Box3().setFromObject(built);
  const c = bb.getCenter(new THREE.Vector3());
  built.position.sub(new THREE.Vector3(c.x, bb.min.y, c.z));
  return g;
}
