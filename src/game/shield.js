// The Shield (equipment): a curved panel of energy bowed out in front of the
// turret, a slice of a cylinder, leaning out a little at the top. A hex grid
// of cells across it, bright rims round its edges, a scan line climbing it,
// and a ripple ringing out from wherever a round strikes it. Rounds that
// cross it from the front are stopped there.
import * as THREE from 'three';

const MAX_HITS = 6;

const VERT = `
varying vec2 vUv;
varying vec3 vPos;
void main() {
  vUv = uv;
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = `
uniform float uOn;
uniform float uTime;
uniform float uArc;
uniform float uH;
uniform vec4 uHits[${MAX_HITS}];
varying vec2 vUv;
varying vec3 vPos;
// distance to the nearest hex cell's edge (0 on an edge)
float hexEdge(vec2 p) {
  vec2 s = vec2(1.0, 1.7320508);
  vec2 a = mod(p, s) - s * 0.5;
  vec2 b = mod(p - s * 0.5, s) - s * 0.5;
  vec2 g = dot(a, a) < dot(b, b) ? a : b;
  g = abs(g);
  return 0.5 - max(dot(g, normalize(s)), g.x);
}
void main() {
  // across the panel in world units
  vec2 p = vec2(vUv.x * uArc, vUv.y * uH);
  float cell = hexEdge(p / 0.42);
  float grid = 1.0 - smoothstep(0.0, 0.09, cell);
  // the rims: top, bottom and both ends
  float ex = min(vUv.x, 1.0 - vUv.x) * uArc;
  float ey = min(vUv.y, 1.0 - vUv.y) * uH;
  float rim = 1.0 - smoothstep(0.0, 0.14, min(ex, ey));
  float inner = 1.0 - smoothstep(0.18, 0.3, min(ex, ey));
  // a scan line climbing it
  float scan = 1.0 - smoothstep(0.0, 0.1, abs(fract(uTime * 0.6) * uH - p.y));
  // ripples from hits: a bright ring going out, and the cells round it lit
  float rip = 0.0;
  for (int i = 0; i < ${MAX_HITS}; i++) {
    vec4 h = uHits[i];
    if (h.w <= 0.0) continue;
    float age = 1.0 - h.w;
    float d = distance(vPos, h.xyz);
    float ring = 1.0 - smoothstep(0.0, 0.16, abs(d - age * 2.6));
    rip += ring * h.w * 1.6 + (1.0 - smoothstep(0.0, 0.9, d)) * h.w * h.w * 1.4;
  }
  // flickering while it's going up or coming down
  float flick = uOn < 0.999 ? step(0.35, fract(sin(floor(uTime * 30.0) * 12.9898) * 43758.5453)) : 1.0;
  float a = 0.07 + grid * 0.32 + rim * 0.9 + inner * 0.08 + scan * 0.18 + rip;
  vec3 col = mix(vec3(0.18, 0.75, 1.0), vec3(0.85, 1.0, 1.0), clamp(rim + rip * 0.6 + grid * 0.2, 0.0, 1.0));
  gl_FragColor = vec4(col * a * uOn * flick, 1.0);
}`;

export function createShield(scene, { radius = 3.1, height = 2.6 } = {}) {
  const group = new THREE.Group();
  const arc = Math.PI; // the front half
  const uniforms = {
    uOn: { value: 0 },
    uTime: { value: 0 },
    uArc: { value: radius * arc },
    uH: { value: height },
    uHits: { value: Array.from({ length: MAX_HITS }, () => new THREE.Vector4()) },
  };
  // a slice of a cylinder round the +x side (the way the turret points),
  // leaning out a touch at the top
  const geo = new THREE.CylinderGeometry(radius + 0.3, radius, height, 40, 6, true, 0, arc);
  geo.translate(0, height / 2, 0);
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  group.add(mesh);
  // the emitters along its foot: a row of glowing studs on the ground arc
  const studMat = new THREE.MeshBasicMaterial({ color: 0x9ff4ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * arc;
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), studMat);
    s.position.set(Math.sin(a) * radius, 0.07, Math.cos(a) * radius);
    group.add(s);
  }
  group.visible = false;
  scene.add(group);
  let next = 0;
  const local = new THREE.Vector3();
  return {
    radius,
    height,
    group,
    // on: 0..1 (fading), at: the tank's middle (ground level), yaw: which way it faces
    update(dt, t, on, at, yaw) {
      uniforms.uOn.value = on;
      uniforms.uTime.value = t;
      studMat.opacity = on;
      group.visible = on > 0.01;
      group.position.copy(at);
      group.rotation.y = yaw; // (the slice runs round +z..+x..-z: its middle faces +x, the way yaw points)
      for (const h of uniforms.uHits.value) if (h.w > 0) h.w = Math.max(0, h.w - dt * 1.6);
    },
    // a round struck it here (world space): a ripple there
    hit(point) {
      group.updateMatrixWorld();
      local.copy(point);
      group.worldToLocal(local);
      uniforms.uHits.value[next].set(local.x, local.y, local.z, 1);
      next = (next + 1) % MAX_HITS;
    },
    dispose() {
      group.removeFromParent();
      geo.dispose();
      mat.dispose();
    },
  };
}

// Where a round going a -> b crosses into the shield (or null): the panel is
// the circle of radius r round (cx, cz), its front half facing yaw, from y0
// up to y0 + h. Returns the point and how far along a -> b (0..1).
export function shieldCross(sh, a, b) {
  if (!sh) return null;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const fx = a.x - sh.x;
  const fz = a.z - sh.z;
  const A = dx * dx + dz * dz;
  if (A < 1e-9) return null;
  const B = 2 * (fx * dx + fz * dz);
  const C = fx * fx + fz * fz - sh.r * sh.r;
  if (C < 0) return null; // (already inside: it was fired from in there)
  const disc = B * B - 4 * A * C;
  if (disc < 0) return null;
  const k = (-B - Math.sqrt(disc)) / (2 * A);
  if (k < 0 || k > 1) return null;
  const p = new THREE.Vector3(a.x + dx * k, a.y + (b.y - a.y) * k, a.z + dz * k);
  // on the front half, and not over the top or under it
  if ((p.x - sh.x) * Math.cos(sh.yaw) - (p.z - sh.z) * Math.sin(sh.yaw) < -0.05) return null;
  if (p.y < sh.y - 0.4 || p.y > sh.y + sh.h) return null;
  return { point: p, k };
}
