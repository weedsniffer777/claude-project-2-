// Small pictures of models, rendered once off screen: part icons, the boost
// close-up. view (optional) frames a close-up: { target, dir, half }.
import * as THREE from 'three';

export function snapshotCanvas(renderer, model, W = 72, H = 48, decorate = null, view = null) {
  const rt = new THREE.WebGLRenderTarget(W, H);
  rt.texture.colorSpace = THREE.SRGBColorSpace; // read back display colours, not linear
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight(0xdfe6f0, 0x504a44, 2.4));
  const sun = new THREE.DirectionalLight(0xffe2c0, 3.2);
  sun.position.set(-2, 4, 3);
  const parent = model.parent;
  sc.add(sun, model);
  const bb = new THREE.Box3().setFromObject(model);
  const c = view ? view.target : bb.getCenter(new THREE.Vector3());
  const size = view ? view.half : bb.getSize(new THREE.Vector3()).length() * 0.5 || 1;
  const cam = view ? new THREE.OrthographicCamera((-size * W) / H, (size * W) / H, size, -size, 0.1, 100) : new THREE.OrthographicCamera(-size * 1.05, size * 1.05, size * 0.7, -size * 0.7, 0.1, 100);
  cam.position.copy(c).add((view ? view.dir.clone() : new THREE.Vector3(-1, 0.85, 1)).normalize().multiplyScalar(20));
  cam.lookAt(c);
  const was = renderer.getRenderTarget();
  const clear = renderer.getClearColor(new THREE.Color());
  const alpha = renderer.getClearAlpha();
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(sc, cam);
  const px = new Uint8Array(W * H * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, W, H, px);
  renderer.setRenderTarget(was);
  renderer.setClearColor(clear, alpha);
  rt.dispose();
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const img = cv.getContext('2d').createImageData(W, H);
  for (let y = 0; y < H; y++) img.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4); // flip rows
  cv.getContext('2d').putImageData(img, 0, 0);
  decorate?.(cv.getContext('2d'), W, H);
  sc.remove(model);
  parent?.add(model);
  return cv;
}

// a white pixel arrow on the right of a picture: an improved version
export function upArrow(g, W) {
  const x = W - 11;
  const y = 8;
  const rows = ['....X....', '...XXX...', '..XXXXX..', '.XXXXXXX.', 'XXXXXXXXX', '...XXX...', '...XXX...', '...XXX...', '...XXX...'];
  rows.forEach((r, j) => [...r].forEach((ch, i) => {
    if (ch !== 'X') return;
    g.fillStyle = '#000';
    g.fillRect(x + i - 1, y + j - 1, 3, 3);
  }));
  g.fillStyle = '#ffffff';
  rows.forEach((r, j) => [...r].forEach((ch, i) => ch === 'X' && g.fillRect(x + i, y + j, 1, 1)));
}
