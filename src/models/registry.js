// Every model the dev tools can show. Add enemies, props and tank variants here.
import { createTank } from './tank.js';
import { createDog } from './dog.js';
import { createLightTank } from './lightTank.js';
import { createWalker } from './walker.js';
import { createBridgeGun } from './bridgeGun.js';
import { createDrone } from './drone.js';

export const MODELS = [
  { id: 't55', name: 'Battle tank', create: createTank },
  { id: 'light', name: 'Light tank', create: createLightTank },
  { id: 'dog', name: 'Robot dog', create: createDog },
  { id: 'walker', name: 'Anti-tank walker', create: createWalker },
  { id: 'bridgegun', name: 'Bridge gun', create: createBridgeGun },
  { id: 'drone', name: 'Attack drone', create: createDrone },
];
