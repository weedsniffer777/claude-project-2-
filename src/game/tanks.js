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
    bars: { armour: 0.7, gun: 0.75, speed: 0.4 },
    stats: {},
  },
  light: {
    id: 'light',
    name: 'Light tank',
    create: createLightTank,
    slots: 2,
    gun: 'autocannon',
    move: 'dash',
    moveName: 'Breakthrough',
    ability: null,
    abilityName: null,
    blurb: 'Fast and fragile. Hold to fire the autocannon; Breakthrough dashes through, knocks enemies aside and breaks their aim.',
    bars: { armour: 0.35, gun: 0.5, speed: 0.85 },
    stats: { maxHp: 70, speed: 1.3, reload: 0.4, cannonDamage: 15, splash: 1.1, mag: 10, magReload: 2.6, boostCooldown: 4 },
  },
};
export const TANK_ORDER = ['battle', 'light'];
export const tankDef = (id) => TANKS[id] || TANKS.battle;
