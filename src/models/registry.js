// Every model the dev tools can show. Add enemies, props and tank variants here.
import { createTank } from './tank.js';
import { createDog } from './dog.js';

export const MODELS = [
  { id: 't55', name: 'Starter T-55', create: createTank },
  { id: 'dog', name: 'Robot dog', create: createDog },
];
