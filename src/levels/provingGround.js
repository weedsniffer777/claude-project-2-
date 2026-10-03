// The original proving ground: flat asphalt, daylight, scattered concrete
// blocks. Kept as a test level for weapons and handling.
import * as THREE from 'three';
import { addDaylight, groundTexture } from '../render/setup.js';
import { box, put } from '../models/kit.js';

const ARENA = 38;

export const provingGround = {
  id: 'proving',
  name: 'Proving ground',
  build(scene) {
    const light = addDaylight(scene, { shadowSize: 13, shadowMap: 2048 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(ARENA * 2 + 4, ARENA * 2 + 4), new THREE.MeshToonMaterial({ map: groundTexture(40) }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const blocks = [];
    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 46; i++) {
      const x = (rand() - 0.5) * 66;
      const z = (rand() - 0.5) * 66;
      if (Math.hypot(x, z) < 7) continue;
      const w = 0.8 + rand() * 1.8;
      const d = 0.8 + rand() * 1.6;
      const h = 0.6 + rand() * 1.6;
      const mesh = put(scene, box(w, h, d, rand() < 0.5 ? 0x8c8a80 : 0x6f7378, { r: 0.08 }), x, h / 2, z);
      mesh.rotation.y = rand() * Math.PI;
      blocks.push({ mesh, x, z, hx: w / 2, hz: d / 2, yaw: mesh.rotation.y });
    }
    return {
      light,
      colliders: [ground, ...blocks.map((b) => b.mesh)],
      blocks,
      emitters: [],
      spawn: { x: 0, z: 0, yaw: 0 },
      bounds: { minX: -ARENA, maxX: ARENA, minZ: -ARENA, maxZ: ARENA },
      update() {},
    };
  },
};
