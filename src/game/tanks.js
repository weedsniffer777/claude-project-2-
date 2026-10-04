// The tanks you can drive. Each has its own model, gun, movement ability
// (Shift) and signature ability (E), its number of part slots, and the
// stats it changes from the base.
import { createTank } from '../models/tank.js';
import { createLightTank } from '../models/lightTank.js';

export const TANKS = {
  battle: {
    id: 'battle',
    name: 'Battle tank',
    create: createTank,
    slots: 3,
    gun: 'cannon',
    move: 'boost',
    moveName: 'Boost',
    ability: 'pierce',
    abilityName: 'Piercing shot',
    blurb: 'Heavy and slow, with a big gun. Boost to ram, Piercing shot to punch through a line of enemies.',
    stats: {},
    // footprint for collisions (hull, covers, the rear drums), tank-local
    box: { cx: -0.25, hx: 2.25, hz: 1.15 },
    // its picture (carousel, rewards): framed on the hull, antennas aside
    pic: { target: [-0.1, 0.95, 0], half: 1.45 },
    // where each part sits on the tank (tank-local), for the fitting
    // screen's lines
    anchors: {
      dozer: [2.1, 0.5, 0],
      autoloader: [-1.0, 1.35, 0],
      era: [1.45, 0.95, -0.3],
      twinmg: [-0.15, 1.75, -0.42],
      afterburner: [-2.05, 0.95, 0.55],
      optics: [0.25, 1.7, 0.45],
      he: [2.6, 1.42, 0],
      plating: [0, 0.85, 1.1],
    },
  },
  light: {
    id: 'light',
    name: 'Light tank',
    create: createLightTank,
    slots: 2,
    gun: 'autocannon',
    move: 'boost',
    moveName: 'Boost',
    ability: 'breakthrough',
    abilityName: 'Breakthrough',
    blurb: 'Fast and fragile. Hold to fire the autocannon; boost on its exhaust rockets; Breakthrough dashes through enemies, knocks them aside and spoils their aim.',
    unlockText: 'Beat level 1 to unlock',
    // reload: seconds between rounds; mag rounds, then magReload to refill
    stats: { maxHp: 70, speed: 1.3, reload: 0.45, cannonDamage: 22, splash: 1.5, mag: 10, magReload: 2.6, boostCooldown: 5 },
    box: { cx: 0.2, hx: 1.55, hz: 0.88 },
    pic: { target: [0.15, 0.8, 0], half: 1.0 },
    anchors: {
      dozer: [1.95, 0.4, 0],
      autoloader: [-0.53, 1.36, -0.66],
      era: [1.68, 0.66, -0.3],
      twinmg: [-0.24, 1.75, 0.2],
      afterburner: [-1.4, 0.78, 0.84],
      optics: [-0.95, 1.5, 0],
      he: [1.0, 0.92, 0.1],
      plating: [0.6, 0.6, 0.95],
    },
  },
};
export const TANK_ORDER = ['battle', 'light'];
export const tankDef = (id) => TANKS[id] || TANKS.battle;
