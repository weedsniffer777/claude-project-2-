// Model viewer dev tool. Shows any registered model on a turntable stage with
// the pixel renderer, an orbit camera and per-slot part toggles. Models that
// can fire (tanks) get aim, fire and roof-MG demos through the shared combat
// effects. Used inside the game's dev kit and standalone (viewer.html).
//
// It is a "mode": enter() attaches its UI and input to the shared renderer,
// exit() removes them, frame() runs one tick.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CombatFx } from '../render/combat.js';
import { addDaylight, groundTexture } from '../render/setup.js';
import { glowMat } from '../models/kit.js';
import { injectDevKitStyles } from './style.js';

const VIEW_H = 7.2;
const HOME = { position: new THREE.Vector3(-10, 11.5, 10), target: new THREE.Vector3(0.2, 0.8, 0) };

export function createModelViewer({ renderer, pixel, models, params = new URLSearchParams(), onExit = null }) {
  injectDevKitStyles();
  const canvas = renderer.domElement;

  // ------------------------------------------------------------- stage
  const scene = new THREE.Scene();
  addDaylight(scene);
  const ground = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 0.4, 48), [
    new THREE.MeshToonMaterial({ color: 0x59606b }),
    new THREE.MeshToonMaterial({ map: groundTexture(10) }),
    new THREE.MeshToonMaterial({ color: 0x59606b }),
  ]);
  ground.position.y = -0.2;
  ground.receiveShadow = true;
  scene.add(ground);
  const target = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), glowMat(0xff3b3b)); // for the roof MG to chase
  scene.add(target);
  const combat = new CombatFx(scene);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 80);
  camera.position.copy(HOME.position);
  let controls = null;

  // ------------------------------------------------------------- model
  let modelIndex = 0;
  let model = null;
  function loadModel(i) {
    if (model) scene.remove(model.group);
    modelIndex = i;
    model = models[i].create();
    scene.add(model.group);
    buildParts();
  }

  // ---------------------------------------------------------------- UI
  const panel = document.createElement('details');
  panel.className = 'dk-panel';
  panel.open = window.innerWidth >= 640; // folded on phones so the model is visible
  panel.innerHTML = `
    <summary>Model viewer <small></small></summary>
    <div class="dk-body">
      <label for="mv-model" ${models.length > 1 ? '' : 'hidden'}>Model</label>
      <select id="mv-model" ${models.length > 1 ? '' : 'hidden'}>${models.map((m, i) => `<option value="${i}">${m.name}</option>`).join('')}</select>
      <h2>Render</h2>
      <label for="mv-px">Pixel height <span class="dk-value" data-px></span></label>
      <input id="mv-px" type="range" min="135" max="540" step="1" />
      <label><input id="mv-outline" type="checkbox" checked /> Outline</label>
      <label><input id="mv-turntable" type="checkbox" /> Turntable</label>
      <h2>Demo</h2>
      <label><input id="mv-drive" type="checkbox" /> Drive in a circle</label>
      <label data-weapons><input id="mv-mg" type="checkbox" checked /> Roof MG tracks target</label>
      <button id="mv-fire" type="button" data-weapons>Fire cannon</button>
      <h2>Loadout slots</h2>
      <div class="dk-parts"></div>
      <button id="mv-reset" class="dk-quiet" type="button">Reset camera</button>
      ${onExit ? '<button id="mv-back" class="dk-quiet" type="button">Back to game</button>' : ''}
    </div>`;
  const hint = document.createElement('div');
  hint.className = 'dk-hint';
  const HINT = 'Drag to orbit · scroll or pinch to zoom · move the pointer to aim · click, tap or Space to fire';
  hint.textContent = HINT;
  let hintTimer = 0;
  const q = (sel) => panel.querySelector(sel);

  q('#mv-turntable').checked = params.get('turntable') === '1';
  q('#mv-drive').checked = params.get('drive') === '1';
  q('#mv-mg').checked = params.get('mg') !== '0';
  q('#mv-model').addEventListener('change', (e) => loadModel(Number(e.target.value)));
  q('#mv-px').addEventListener('input', (e) => {
    pixel.setHeight(Number(e.target.value));
    showPx();
  });
  q('#mv-outline').addEventListener('change', (e) => pixel.setOutline(e.target.checked));
  q('#mv-fire').addEventListener('click', () => fire());
  q('#mv-reset').addEventListener('click', resetCamera);
  if (onExit) q('#mv-back').addEventListener('click', () => onExit());
  const showPx = () => (q('[data-px]').textContent = pixel.height + 'p');

  function buildParts() {
    const parts = q('.dk-parts');
    parts.textContent = '';
    for (const name of Object.keys(model.slotGroups || {})) {
      const label = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = true;
      cb.addEventListener('change', () => model.setSlotVisible(name, cb.checked));
      label.append(cb, name);
      parts.append(label);
    }
    for (const el of panel.querySelectorAll('[data-weapons]')) el.hidden = !model.fire;
  }

  function note(text) {
    hint.textContent = text;
    hintTimer = 1.6;
  }

  // ------------------------------------------------------------ input
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.6);
  const aimPoint = new THREE.Vector3(6, 0.6, -2.5);
  let hasAim = false;
  let downAt = null;

  function fire() {
    if (!model.fire) return;
    if (!combat.fireCannon(model, hasAim || params.has('shot') ? aimPoint : null)) {
      note('The gun is lifted over the fuel drums. Traverse off the rear to fire.');
    }
  }
  const onMove = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    if (raycaster.ray.intersectPlane(aimPlane, aimPoint)) hasAim = true;
  };
  const onDown = (e) => (downAt = [e.clientX, e.clientY]);
  const onUp = (e) => {
    if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 5) fire();
    downAt = null;
  };
  const onKey = (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      fire();
    }
  };

  function resetCamera() {
    camera.position.copy(HOME.position);
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    if (controls) {
      controls.target.copy(HOME.target);
      controls.update();
    }
  }

  // ------------------------------------------------------------ mode
  let saved = null;
  let driveAngle = 0;
  const api = {
    camera,
    aimPoint,
    fireCannon: fire,
    get model() {
      return model;
    },
    enter() {
      saved = { height: pixel.height, outline: pixel.material.uniforms.useOutline.value > 0.5 };
      if (!model) loadModel(modelIndex);
      if (params.get('pixel')) pixel.setHeight(Number(params.get('pixel')));
      q('#mv-px').value = pixel.height;
      showPx();
      pixel.setOutline(q('#mv-outline').checked);
      controls = new OrbitControls(camera, canvas);
      controls.target.copy(HOME.target);
      controls.enableDamping = true;
      controls.enablePan = false;
      controls.minZoom = 0.6;
      controls.maxZoom = 3.5;
      controls.minPolarAngle = THREE.MathUtils.degToRad(20);
      controls.maxPolarAngle = THREE.MathUtils.degToRad(85);
      resetCamera();
      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('pointerdown', onDown);
      canvas.addEventListener('pointerup', onUp);
      window.addEventListener('keydown', onKey);
      document.body.append(panel, hint);
      window.__viewer = api;
    },
    exit() {
      controls?.dispose();
      controls = null;
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKey);
      panel.remove();
      hint.remove();
      pixel.setHeight(saved.height);
      pixel.setOutline(saved.outline);
      if (window.__viewer === api) delete window.__viewer;
    },
    resize(w, h) {
      const aspect = w / h;
      const viewH = Math.max(VIEW_H, 8.5 / aspect); // tall (phone) screens: keep the whole model in frame
      camera.left = (-viewH * aspect) / 2;
      camera.right = (viewH * aspect) / 2;
      camera.top = viewH / 2;
      camera.bottom = -viewH / 2;
      camera.updateProjectionMatrix();
    },
    frame(dt, t) {
      let speed = 0;
      if (q('#mv-drive').checked) {
        driveAngle += dt * 0.5;
        const R = 3;
        model.group.position.set(Math.cos(driveAngle) * R, 0, -Math.sin(driveAngle) * R);
        model.group.rotation.y = driveAngle + Math.PI / 2;
        speed = R * 0.5;
      } else if (model.group.position.lengthSq() > 0) {
        model.group.position.set(0, 0, 0);
        model.group.rotation.y = 0;
      }

      const mgOn = !!model.fire && q('#mv-mg').checked;
      const a = t * 0.9;
      target.position.set(Math.cos(a) * 5.5, 0.4 + Math.sin(t * 3) * 0.08, -Math.sin(a * 1.3) * 5.5);
      target.rotation.y = t * 2;
      target.visible = mgOn;

      if (!hasAim && params.has('shot')) {
        if (params.get('aim') === 'front') aimPoint.set(30, 0.6, 0);
        else if (params.get('aim') === 'back') aimPoint.set(-30, 0.6, 0.5);
        else aimPoint.set(6, 0.6, -2.5);
      }
      model.update(dt, t, {
        aimPoint: hasAim || params.has('shot') ? aimPoint : null,
        mgPoint: mgOn ? target.position : null,
        speed,
      });
      combat.handleTankEvents(model);
      combat.update(dt);
      if (hintTimer > 0) {
        hintTimer -= dt;
        if (hintTimer <= 0) hint.textContent = HINT;
      }

      if (q('#mv-turntable').checked && controls) {
        const p = camera.position.clone().sub(controls.target);
        p.applyAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.5);
        camera.position.copy(controls.target).add(p);
      }
      controls?.update();
      combat.beginShake(camera);
      pixel.render(scene, camera);
      combat.endShake(camera);
    },
  };
  return api;
}
