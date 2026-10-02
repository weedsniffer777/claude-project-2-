// "3D pixel art" pipeline: render the scene into a small render target, then
// upscale it with nearest-neighbour filtering and draw a 1-low-res-pixel outline
// wherever depth jumps. Works with orthographic (isometric) and perspective cameras.
import * as THREE from 'three';

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
  varying vec2 vUv;

  float viewZ(vec2 uv) {
    float d = texture2D(tDepth, uv).x;
    if (ortho > 0.5) return near + d * (far - near);
    float z = d * 2.0 - 1.0;
    return 2.0 * near * far / (far + near - z * (far - near));
  }

  void main() {
    vec3 c = texture2D(tColor, vUv).rgb;
    if (useOutline > 0.5) {
      float z = viewZ(vUv);
      float hit = 0.0;
      hit = max(hit, step(edge, z - viewZ(vUv + vec2(texel.x, 0.0))));
      hit = max(hit, step(edge, z - viewZ(vUv - vec2(texel.x, 0.0))));
      hit = max(hit, step(edge, z - viewZ(vUv + vec2(0.0, texel.y))));
      hit = max(hit, step(edge, z - viewZ(vUv - vec2(0.0, texel.y))));
      c = mix(c, outlineColor, hit);
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
      },
    });
    this.quadScene = new THREE.Scene();
    this.quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.size = { w: 1, h: 1 };
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
    this.material.uniforms.texel.value.set(1 / tw, 1 / th);
  }

  render(scene, camera) {
    const u = this.material.uniforms;
    u.near.value = camera.near;
    u.far.value = camera.far;
    u.ortho.value = camera.isOrthographicCamera ? 1 : 0;
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.quadScene, this.quadCamera);
  }
}
