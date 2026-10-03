// Every model the dev tools can show. Add enemies, props and tank variants here.
import { createTank } from './tank.js';
import { createDog } from './dog.js';
import { createLightTank } from './lightTank.js';

export const MODELS = [
  { id: 't55', name: 'Battle tank', create: createTank },
  { id: 'light', name: 'Light tank', create: createLightTank },
  { id: 'dog', name: 'Robot dog', create: createDog },
];
