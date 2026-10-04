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
    // close in on the light tank's turret alone, the six barrels blazing
    if (!vulcanTank) {
      vulcanTank = createLightTank();
      const g = attachPart(vulcanTank, 'vulcan');
      vulcanTank.update(0.016, 0, {});
      // only the turret (and what's on it) shows
      vulcanTank.group.updateMatrixWorld(true);
      const keep = new Set();
      vulcanTank.turret.traverse((o) => keep.add(o));
      vulcanTank.group.traverse((o) => {
        if ((o.isMesh || o.isInstancedMesh) && !keep.has(o)) o.visible = false;
      });
      // the muzzle flash: a white-hot core, a starburst of rays, a big warm glow
      const hot = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const yellow = new THREE.MeshBasicMaterial({ color: 0xffe27a });
      const orange = new THREE.MeshBasicMaterial({ color: 0xffa040 });
      const flash = new THREE.Group();
      flash.position.set(0.95, 0, 0);
      flash.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.26, 0.26), hot));
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const ray = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.07, 0.07), i % 2 ? orange : yellow);
        ray.position.set(0.2 + Math.abs(Math.cos(a)) * 0.15, Math.cos(a) * 0.2, Math.sin(a) * 0.2);
        ray.rotation.set(a, 0, Math.cos(a) * 0.6);
        flash.add(ray);
      }
      const core = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.12), yellow);
      core.position.x = 0.6;
      flash.add(core);
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0.45, depthWrite: false }));
      glow.position.x = 0.15;
      flash.add(glow);
      g.add(flash);
    }
    vulcanTank.group.updateMatrixWorld(true);
    const at = vulcanTank.turret.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(1.35, 0.1, 0));
    pic = snapshotCanvas(renderer, vulcanTank.group, W, H, null, { target: at, dir: new THREE.Vector3(0.8, 0.5, 1), half: 1.1 });
  } else {
    pic = snapshotCanvas(renderer, partModel(id), W, H, PARTS[id].badge === 'up' ? upArrow : null);
  }
  const url = pic.toDataURL();
  cache.set(key, url);
  return url;
}
