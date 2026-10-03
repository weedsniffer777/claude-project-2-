// "3D pixel art" pipeline: render the scene into a small render target, then
// upscale it with nearest-neighbour filtering and draw a 1-low-res-pixel outline
// wherever depth jumps. Works with orthographic (isometric) and perspective cameras.
//
// Actor outlines (optional): objects on layer 1 (the player) and layer 2
// (machines) are also drawn flat into a small mask. The post pass gives them
// a black outer outline and a team-coloured inner rim, shows them as a faint
// tinted silhouette where scenery hides them, and dims the background a
// touch so units always read against busy streets.
import * as THREE from 'three';

export const PLAYER_LAYER = 1;
export const ENEMY_LAYER = 2;

const vert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const frag = /* glsl */ `
  uniform sampler2D tColor;
  uniform sampler2D tDepth;
  uniform vec2 texel;
  uniform float near;
  uniform float far;
  uniform float ortho;
  uniform float edge;
  uniform float useOutline;
  uniform vec3 outlineColor;
  uniform sampler2D tMask;
  uniform sampler2D tMaskDepth;
  uniform float useActors;
  uniform vec3 playerRim;
  uniform vec3 enemyRim;
  varying vec2 vUv;

  float maskZ(vec2 uv) {
    float d = texture2D(tMaskDepth, uv).x;
    if (ortho > 0.5) return near + d * (far - near);
    float z = d * 2.0 - 1.0;
    return 2.0 * near * far / (far + near - z * (far - near));
  }

  float viewZ(vec2 uv) {
    float d = texture2D(tDepth, uv).x;
    if (ortho > 0.5) return near + d * (far - near);
    float z = d * 2.0 - 1.0;
    return 2.0 * near * far / (far + near - z * (far - near));
  }

  void main() {
    vec3 c = texture2D(tColor, vUv).rgb;
    if (useOutline > 0.5) {
      // Second derivative of depth: a steep but smooth slope (ground at a low
      // camera angle) is not an edge; a depth jump is.
      float z = viewZ(vUv);
      float zl = viewZ(vUv - vec2(texel.x, 0.0));
      float zr = viewZ(vUv + vec2(texel.x, 0.0));
      float zu = viewZ(vUv + vec2(0.0, texel.y));
      float zd = viewZ(vUv - vec2(0.0, texel.y));
      float hit = max(step(edge, 2.0 * z - zl - zr), step(edge, 2.0 * z - zu - zd));
      c = mix(c, outlineColor, hit);
    }
    if (useActors > 0.5) {
      vec2 m = texture2D(tMask, vUv).rg;
      bool isActor = m.r + m.g > 0.5;
      bool shown = isActor && maskZ(vUv) <= viewZ(vUv) + 0.08;
      // neighbours: is there a visible actor beside this pixel, or open ground?
      vec2 offs[4];
      offs[0] = vec2(texel.x, 0.0); offs[1] = vec2(-texel.x, 0.0);
      offs[2] = vec2(0.0, texel.y); offs[3] = vec2(0.0, -texel.y);
      vec2 near2 = vec2(0.0);
      float openNear = 0.0;
      for (int i = 0; i < 4; i++) {
        vec2 uv2 = vUv + offs[i];
        vec2 n = texture2D(tMask, uv2).rg;
        bool nActor = n.r + n.g > 0.5;
        if (nActor && maskZ(uv2) <= viewZ(uv2) + 0.08) near2 = max(near2, n);
        if (!nActor) openNear = 1.0;
      }
      vec3 team = m.g > 0.5 ? enemyRim : playerRim;
      if (!isActor) {
        // the background, a little darker and greyer than the units
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        c = mix(c, vec3(l), 0.14) * 0.9;
        if (near2.r + near2.g > 0.5) c = vec3(0.02, 0.02, 0.03); // outer outline
      } else if (!shown) {
        c = mix(c * 0.85, team * 0.55, 0.5); // hidden behind scenery: tinted silhouette
      } else if (openNear > 0.5) {
        c = team; // inner rim
      }
    }
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }
`;

export class PixelRenderer {
  constructor(renderer, { height = 270 } = {}) {
    this.renderer = renderer;
    this.height = height;
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
    });
    this.target.depthTexture = new THREE.DepthTexture(1, 1);
    // flat team mask for actor outlines
    this.mask = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
    this.mask.depthTexture = new THREE.DepthTexture(1, 1);
    this.maskMats = [new THREE.MeshBasicMaterial({ color: 0xff0000, fog: false }), new THREE.MeshBasicMaterial({ color: 0x00ff00, fog: false })];
    this.actors = false;

    this.material = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tColor: { value: this.target.texture },
        tDepth: { value: this.target.depthTexture },
        texel: { value: new THREE.Vector2(1, 1) },
        near: { value: 0.1 },
        far: { value: 100 },
        ortho: { value: 1 },
        edge: { value: 0.12 },
        useOutline: { value: 1 },
        outlineColor: { value: new THREE.Color(0x1a1f33) },
        tMask: { value: this.mask.texture },
        tMaskDepth: { value: this.mask.depthTexture },
        useActors: { value: 0 },
        playerRim: { value: new THREE.Color(0xf1e9d8) },
        enemyRim: { value: new THREE.Color(0xff3b2f) },
      },
    });
    this.quadScene = new THREE.Scene();
    this.quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.size = { w: 1, h: 1 };
  }

  // Team outlines for objects on PLAYER_LAYER / ENEMY_LAYER.
  setActorOutlines(on) {
    this.actors = on;
    this.material.uniforms.useActors.value = on ? 1 : 0;
  }

  setOutline(on) {
    this.material.uniforms.useOutline.value = on ? 1 : 0;
  }

  setEdgeThreshold(v) {
    this.material.uniforms.edge.value = v;
  }

  setHeight(px) {
    this.height = px;
    this.setSize(this.size.w, this.size.h);
  }

  // w/h = canvas size in CSS pixels. The internal resolution keeps the same aspect.
  setSize(w, h) {
    this.size = { w, h };
    const th = this.height;
    const tw = Math.max(1, Math.round((th * w) / h));
    this.target.setSize(tw, th);
    this.mask.setSize(tw, th);
    this.material.uniforms.texel.value.set(1 / tw, 1 / th);
  }

  render(scene, camera) {
    const u = this.material.uniforms;
    u.near.value = camera.near;
    u.far.value = camera.far;
    u.ortho.value = camera.isOrthographicCamera ? 1 : 0;
    const r = this.renderer;
    r.setRenderTarget(this.target);
    r.render(scene, camera);
    if (this.actors) {
      // flat masks: player in red, machines in green; no shadows, no sky
      const { background, fog, overrideMaterial } = scene;
      const layers = camera.layers.mask;
      const autoUpdate = r.shadowMap.autoUpdate;
      const autoClear = r.autoClear;
      const clear = r.getClearColor(new THREE.Color());
      const alpha = r.getClearAlpha();
      scene.background = null;
      scene.fog = null;
      r.shadowMap.autoUpdate = false;
      r.setRenderTarget(this.mask);
      r.setClearColor(0x000000, 1);
      r.clear();
      r.autoClear = false;
      [PLAYER_LAYER, ENEMY_LAYER].forEach((layer, i) => {
        camera.layers.set(layer);
        scene.overrideMaterial = this.maskMats[i];
        r.render(scene, camera);
      });
      camera.layers.mask = layers;
      Object.assign(scene, { background, fog, overrideMaterial });
      r.shadowMap.autoUpdate = autoUpdate;
      r.autoClear = autoClear;
      r.setClearColor(clear, alpha);
    }
    r.setRenderTarget(null);
    this.renderer.render(this.quadScene, this.quadCamera);
  }
}
