// Shared helpers for building the chunky "brick" models in code.
// Everything is a rounded box or a low-sided cylinder with a 3-step toon ramp,
// so the pixel pipeline (src/render/pixel.js) turns it into crisp 3D pixel art.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const ramp = new Uint8Array([105, 175, 255]);
const gradientMap = new THREE.DataTexture(ramp, ramp.length, 1, THREE.RedFormat);
gradientMap.minFilter = gradientMap.magFilter = THREE.NearestFilter;
gradientMap.needsUpdate = true;

const toonCache = new Map();
const glowCache = new Map();
const boxGeoCache = new Map();
const cylGeoCache = new Map();

export function toon(color) {
  if (!toonCache.has(color)) {
    toonCache.set(color, new THREE.MeshToonMaterial({ color, gradientMap }));
  }
  return toonCache.get(color);
}

// Unlit, always-bright material for lenses, lamps, muzzle flashes.
export function glowMat(color) {
  if (!glowCache.has(color)) glowCache.set(color, new THREE.MeshBasicMaterial({ color }));
  return glowCache.get(color);
}

function shadowed(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function box(w, h, d, color, { r = 0.06, glow = false } = {}) {
  const radius = Math.min(r, Math.min(w, h, d) / 2 - 0.002);
  const key = `${w}|${h}|${d}|${radius}`;
  if (!boxGeoCache.has(key)) {
    boxGeoCache.set(key, new RoundedBoxGeometry(w, h, d, 2, Math.max(radius, 0.001)));
  }
  const mesh = new THREE.Mesh(boxGeoCache.get(key), glow ? glowMat(color) : toon(color));
  return glow ? mesh : shadowed(mesh);
}

// Cylinder along Y by default; axis 'x' or 'z' lays it down.
export function cyl(radius, height, color, { axis = 'y', seg = 10, glow = false, radiusEnd } = {}) {
  const key = `${radius}|${radiusEnd ?? radius}|${height}|${seg}`;
  if (!cylGeoCache.has(key)) {
    cylGeoCache.set(key, new THREE.CylinderGeometry(radius, radiusEnd ?? radius, height, seg));
  }
  const mesh = new THREE.Mesh(cylGeoCache.get(key), glow ? glowMat(color) : toon(color));
  if (axis === 'x') mesh.rotation.z = Math.PI / 2;
  if (axis === 'z') mesh.rotation.x = Math.PI / 2;
  return glow ? mesh : shadowed(mesh);
}

export function put(parent, obj, x = 0, y = 0, z = 0) {
  obj.position.set(x, y, z);
  parent.add(obj);
  return obj;
}

export function clear(group) {
  while (group.children.length) group.remove(group.children[0]);
}

export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function approachAngle(current, target, maxStep) {
  const diff = wrapAngle(target - current);
  if (Math.abs(diff) <= maxStep) return target;
  return wrapAngle(current + Math.sign(diff) * maxStep);
}

// Four small rivets on the outward face of a thin plate. `face` is '+y', '-z', '+x', ...
export function rivets(parent, [x, y, z], [w, h, d], face, color = 0x2b2f36) {
  const sign = face[0] === '-' ? -1 : 1;
  const axis = face[1];
  const s = 0.045;
  const inset = 0.09;
  const spots = [];
  const [a, b] = axis === 'y' ? [w, d] : axis === 'x' ? [d, h] : [w, h];
  for (const ia of [-1, 1]) for (const ib of [-1, 1]) spots.push([ia * (a / 2 - inset), ib * (b / 2 - inset)]);
  for (const [p, q] of spots) {
    const rv = box(s, s, s, color, { r: 0.01 });
    if (axis === 'y') put(parent, rv, x + p, y + sign * (h / 2 + s / 2 - 0.01), z + q);
    else if (axis === 'x') put(parent, rv, x + sign * (w / 2 + s / 2 - 0.01), y + q, z + p);
    else put(parent, rv, x + p, y + q, z + sign * (d / 2 + s / 2 - 0.01));
  }
}

// A thin plate with rivets, for the mismatched-scrap look.
export function plate(parent, pos, size, color, face) {
  const m = put(parent, box(size[0], size[1], size[2], color, { r: 0.03 }), ...pos);
  rivets(parent, pos, size, face);
  return m;
}

const sphereGeoCache = new Map();

// Squashed low-poly sphere, for dome turrets and bustles.
export function ellipsoid(rx, ry, rz, color, { wseg = 14, hseg = 9 } = {}) {
  const key = `${wseg}|${hseg}`;
  if (!sphereGeoCache.has(key)) sphereGeoCache.set(key, new THREE.SphereGeometry(1, wseg, hseg));
  const mesh = new THREE.Mesh(sphereGeoCache.get(key), toon(color));
  mesh.scale.set(rx, ry, rz);
  return shadowed(mesh);
}
