// Pictures of parts for the UI (cards, reward rows, the fitting screen),
// rendered once and cached. Most are the part's own model; a few read
// better shown fitted on the tank (the dozer blade, from the front).
import * as THREE from 'three';
import { createTank } from '../models/tank.js';
import { createLightTank } from '../models/lightTank.js';
import { PARTS, attachPart, partModel } from '../game/parts.js';
import { snapshotCanvas, upArrow } from './snapshot.js';
import { mirvCanvas } from '../ui/icons.js';

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
      // the muzzle flash like the game's: a white-hot core, a short cross of
      // flame, a soft orange bloom; and red tracers streaking out ahead
      const hot = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const yellow = new THREE.MeshBasicMaterial({ color: 0xffe9a0 });
      const orange = new THREE.MeshBasicMaterial({ color: 0xffa040 });
      const flash = new THREE.Group();
      flash.position.set(0.86, 0, 0); // just past the barrel ends
      const core = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.16), hot);
      core.position.x = 0.12;
      flash.add(core);
      for (const [ry, rz] of [[0, 0.8], [0, -0.8], [0.8, 0], [-0.8, 0]]) {
        const ray = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.05), yellow);
        ray.position.set(0.12 + Math.cos(rz + ry) * 0.04, Math.sin(rz) * 0.12, Math.sin(ry) * 0.12);
        ray.rotation.set(0, -ry, rz);
        flash.add(ray);
      }
      const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.08), orange);
      tongue.position.x = 0.36;
      flash.add(tongue);
      const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.3, depthWrite: false }));
      bloom.position.x = 0.14;
      flash.add(bloom);
      g.add(flash);
      // three tracers on their way, a little spread
      const tracerCore = new THREE.MeshBasicMaterial({ color: 0xffc4ae });
      const tracerGlow = new THREE.MeshBasicMaterial({ color: 0xff5a3a, transparent: true, opacity: 0.55, depthWrite: false });
      for (const [x, y, z] of [[1.45, 0.02, 0.0], [1.95, -0.03, 0.05], [2.45, 0.04, -0.04]]) {
        const t1 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.05), tracerCore);
        t1.position.set(x, y, z);
        g.add(t1);
        const t2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.11, 0.11), tracerGlow);
        t2.position.set(x, y, z);
        g.add(t2);
      }
    }
    vulcanTank.group.updateMatrixWorld(true);
    // framed on the barrels and what's coming out of them (the turret's
    // mostly off to the side)
    const at = vulcanTank.gunPivot.localToWorld(new THREE.Vector3(1.0, 0, 0));
    pic = snapshotCanvas(renderer, vulcanTank.group, W, H, null, { target: at, dir: new THREE.Vector3(0.55, 0.5, 1), half: 1.0 });
  } else if (id === 'magnet') {
    // the horseshoe face on, a little from above
    pic = snapshotCanvas(renderer, partModel(id), W, H, null, { target: new THREE.Vector3(-0.08, 0.36, 0), dir: new THREE.Vector3(0.1, 0.35, 1), half: 0.46 });
  } else if (id === 'mirv') {
    // nothing on the tank to show: its pixel picture, scaled up whole
    const art = mirvCanvas(1);
    pic = document.createElement('canvas');
    pic.width = W;
    pic.height = H;
    const g = pic.getContext('2d');
    const k = Math.max(1, Math.floor(Math.min(W / art.width, H / art.height)));
    g.imageSmoothingEnabled = false;
    g.drawImage(art, Math.round((W - art.width * k) / 2), Math.round((H - art.height * k) / 2), art.width * k, art.height * k);
  } else {
    pic = snapshotCanvas(renderer, partModel(id), W, H, PARTS[id].badge === 'up' ? upArrow : null);
  }
  const url = pic.toDataURL();
  cache.set(key, url);
  return url;
}
