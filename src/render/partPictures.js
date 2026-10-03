// Pictures of parts for the UI (cards, reward rows, the fitting screen),
// rendered once and cached. Most are the part's own model; a few read
// better shown fitted on the tank (the dozer blade, from the front).
import * as THREE from 'three';
import { createTank } from '../models/tank.js';
import { PARTS, attachPart, partModel } from '../game/parts.js';
import { snapshotCanvas, upArrow } from './snapshot.js';

const cache = new Map();
let dozerTank = null;

export function partPicture(renderer, id, W = 84, H = 56) {
  const key = `${id}|${W}|${H}`;
  if (cache.has(key)) return cache.get(key);
  let pic;
  if (id === 'dozer') {
    // the blade on the tank's nose, from the front three-quarters
    if (!dozerTank) {
      dozerTank = createTank();
      attachPart(dozerTank, 'dozer');
      dozerTank.update(0.016, 0, {});
    }
    pic = snapshotCanvas(renderer, dozerTank.group, W, H, null, { target: new THREE.Vector3(1.55, 0.75, 0), dir: new THREE.Vector3(1, 0.55, 0.85), half: 1.15 });
  } else {
    pic = snapshotCanvas(renderer, partModel(id), W, H, PARTS[id].badge === 'up' ? upArrow : null);
  }
  const url = pic.toDataURL();
  cache.set(key, url);
  return url;
}
