// Pictures of parts for the UI (cards, reward rows, the fitting screen),
// rendered once and cached. Most are the part's own model; a few read
// better shown fitted on the tank (the dozer blade, from the front).
import * as THREE from 'three';
import { createTank } from '../models/tank.js';
import { createLightTank } from '../models/lightTank.js';
import { PARTS, attachPart, partModel } from '../game/parts.js';
import { snapshotCanvas, upArrow } from './snapshot.js';

const cache = new Map();
let dozerTank = null;
let vulcanTank = null;

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
  } else if (id === 'vulcan') {
    // on the light tank, from the front three-quarters, firing: a flash
    // out of the spinning barrels
    if (!vulcanTank) {
      vulcanTank = createLightTank();
      const g = attachPart(vulcanTank, 'vulcan');
      vulcanTank.update(0.016, 0, {});
      const hot = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
      const warm = new THREE.MeshBasicMaterial({ color: 0xffb347 });
      const flash = new THREE.Group();
      flash.position.set(0.9, 0, 0);
      flash.add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.16), hot));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const ray = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.05), i % 2 ? warm : hot);
        ray.position.set(0.12, Math.cos(a) * 0.12, Math.sin(a) * 0.12);
        ray.rotation.set(a, 0, Math.cos(a) * 0.5);
        flash.add(ray);
      }
      const core = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.08), warm);
      core.position.x = 0.35;
      flash.add(core);
      g.add(flash);
    }
    pic = snapshotCanvas(renderer, vulcanTank.group, W, H, null, { target: new THREE.Vector3(1.0, 1.0, 0), dir: new THREE.Vector3(1, 0.55, 0.85), half: 1.2 });
  } else {
    pic = snapshotCanvas(renderer, partModel(id), W, H, PARTS[id].badge === 'up' ? upArrow : null);
  }
  const url = pic.toDataURL();
  cache.set(key, url);
  return url;
}
