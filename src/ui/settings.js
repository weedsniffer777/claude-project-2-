// Settings: what's saved, and the menu to change it (from the base's gear
// button or the pause menu). PC and touch get different menus: PC has key
// bindings; touch has the stick and buttons. Every choice is one of our own
// dropdowns or toggles, styled like the rest of the game.

import { fitInside } from './scale.js';

const KEY = 'scavenger.settings';
export const ACTIONS = [
  ['up', 'Drive forward'],
  ['down', 'Reverse'],
  ['left', 'Turn left'],
  ['right', 'Turn right'],
  ['fire', 'Fire'],
  ['boost', 'Boost / Dash / Retreat'],
  ['ability', 'Ability'],
  ['equip', 'Equipment'],
  ['reload', 'Reload'],
];
const DEFAULTS = {
  quality: 'auto', // 'auto' or a tier index ('0' best .. '3' Potato)
  fps: 60, // frame cap: 60, 30, or 0 (as fast as the screen goes)
  shake: 'on', // 'on' | 'reduced' | 'off'
  showFps: false,
  keys: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', fire: 'Space', boost: 'ShiftLeft', ability: 'KeyE', equip: 'KeyQ', reload: 'KeyR' },
  // touch
  aimAssist: true, // touch: lock onto a machine (again after each reload); off: drag to aim
  buttons: 'normal', // 'small' | 'normal' | 'large'
  hand: 'right', // 'right': stick left, FIRE right; 'left': mirrored
  stick: 1, // stick sensitivity
};

let cur = null;
const listeners = new Set();
function load() {
  let s = {};
  try {
    s = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch {
    // storage blocked: defaults
  }
  cur = { ...DEFAULTS, ...s, keys: { ...DEFAULTS.keys, ...(s.keys || {}) } };
}
export function settings() {
  if (!cur) load();
  return cur;
}
export function setSetting(k, v) {
  settings()[k] = v;
  try {
    localStorage.setItem(KEY, JSON.stringify(cur));
  } catch {
    // storage blocked: this session only
  }
  for (const fn of listeners) fn(k, v);
}
export const onSettings = (fn) => (listeners.add(fn), () => listeners.delete(fn));
// the action a key code is bound to (Shift either side counts)
export function actionFor(code) {
  const k = settings().keys;
  const c = code === 'ShiftRight' ? 'ShiftLeft' : code;
  return Object.keys(k).find((a) => k[a] === c || (k[a] === 'ShiftLeft' && code === 'ShiftRight')) || null;
}
// a key code as a short label
export function keyLabel(code) {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Arrow')) return { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' }[code];
  return { Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', ControlRight: 'Ctrl', AltLeft: 'Alt', AltRight: 'Alt', Tab: 'Tab', Enter: 'Enter', Backspace: 'Bksp', CapsLock: 'Caps' }[code] || code;
}

const CSS = `
.set { position: fixed; inset: 0; z-index: 40; display: grid; place-items: center; padding: calc(12px + env(safe-area-inset-top, 0px)) 12px calc(12px + env(safe-area-inset-bottom, 0px)); background: rgba(6, 5, 8, 0.72);
  color: #f1e9d8; font: 400 15px/1.3 'Pixelify Sans', 'Silkscreen', ui-monospace, monospace; --amber: #ffb347; --go: #6be08a; box-sizing: border-box; }
.set[hidden] { display: none !important; }
.set * { box-sizing: border-box; }
.set .box { width: min(520px, 100%); max-height: 100%; overflow-y: auto; padding: 16px 18px 18px; display: grid; gap: 14px; background: rgba(12, 11, 13, 0.96); box-shadow: 0 0 0 2px #000, 0 0 0 4px #f1e9d8, 4px 4px 0 4px #000; }
.set h2 { margin: 0; font: 400 22px/1 'Silkscreen', monospace; text-transform: uppercase; color: var(--amber); }
.set h3 { margin: 4px 0 0; font: 400 11px/1 'Silkscreen', monospace; text-transform: uppercase; letter-spacing: 0.08em; color: #b9b0a0; }
.set .row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 12px; min-height: 34px; }
.set .row > span { font-size: 14px; }
.set .row small { display: block; font-size: 12px; color: #8f877a; }
.set button { border: 0; color: #f1e9d8; font: 400 12px/1 'Silkscreen', monospace; text-transform: uppercase; }
.set .dd { position: relative; }
.set .ddb { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-width: 150px; padding: 8px 10px; background: #1d1b1e; box-shadow: 0 0 0 2px #000, 0 0 0 4px #6d655a; }
.set .ddb::after { content: ''; width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 6px solid var(--amber); }
.set .ddb:hover, .set .dd.open .ddb { box-shadow: 0 0 0 2px #000, 0 0 0 4px var(--amber); }
.set .ddl { position: absolute; right: 0; top: calc(100% + 8px); z-index: 2; min-width: 100%; display: grid; background: #121014; box-shadow: 0 0 0 2px #000, 0 0 0 4px #f1e9d8; }
.set .ddl button { padding: 9px 12px; text-align: left; white-space: nowrap; background: none; }
.set .ddl button:hover { background: #2a2628; }
.set .ddl button.on { color: var(--amber); }
.set .tog { position: relative; width: 52px; height: 26px; background: #2a2628; box-shadow: 0 0 0 2px #000, 0 0 0 4px #6d655a; }
.set .tog::after { content: ''; position: absolute; left: 4px; top: 4px; width: 18px; height: 18px; background: #6d655a; transition: left 0.12s steps(3); }
.set .tog.on { background: #24402c; box-shadow: 0 0 0 2px #000, 0 0 0 4px var(--go); }
.set .tog.on::after { left: 30px; background: var(--go); }
.set .key { min-width: 88px; padding: 8px 10px; background: #f1e9d8; color: #111; box-shadow: 0 0 0 2px #000; }
.set .key.wait { background: var(--amber); animation: setWait 0.8s steps(2) infinite; }
@keyframes setWait { 50% { filter: brightness(1.25); } }
.set .bar { display: flex; gap: 12px; justify-content: flex-end; flex-wrap: wrap; }
.set .bar button { padding: 10px 16px 11px; background: #2a2628; box-shadow: 0 0 0 2px #000, 0 0 0 4px #6d655a; }
.set .bar .done { color: #111; background: var(--go); box-shadow: 0 4px 0 #2f6b40, 0 0 0 2px #000; }
.set .note { font-size: 12px; color: #8f877a; }
@media (max-width: 420px) { .set .ddb { min-width: 120px; } .set .key { min-width: 70px; } }
`;
let injected = false;

// touch: whether this is a touch device's menu
export function createSettingsMenu({ touch = () => false } = {}) {
  if (!injected) {
    injected = true;
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.append(st);
  }
  const root = document.createElement('div');
  root.className = 'set';
  root.hidden = true;
  document.body.append(root);
  let onClose = null;
  let waiting = null; // the action whose key is being rebound
  let openDd = null;

  const dropdown = (value, options, onPick) => {
    const dd = document.createElement('div');
    dd.className = 'dd';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ddb';
    b.textContent = options.find(([v]) => String(v) === String(value))?.[1] ?? String(value);
    dd.append(b);
    b.onclick = (e) => {
      e.stopPropagation();
      const was = openDd === dd;
      closeDd();
      if (was) return;
      openDd = dd;
      dd.classList.add('open');
      const list = document.createElement('div');
      list.className = 'ddl';
      for (const [v, label] of options) {
        const o = document.createElement('button');
        o.type = 'button';
        o.textContent = label;
        if (String(v) === String(value)) o.classList.add('on');
        o.onclick = (ev) => {
          ev.stopPropagation();
          closeDd();
          onPick(v);
          render();
        };
        list.append(o);
      }
      dd.append(list);
    };
    return dd;
  };
  function closeDd() {
    if (!openDd) return;
    openDd.classList.remove('open');
    openDd.querySelector('.ddl')?.remove();
    openDd = null;
  }
  const toggle = (on, onFlip) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `tog${on ? ' on' : ''}`;
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.onclick = () => {
      onFlip(!on);
      render();
    };
    return b;
  };
  const row = (label, control, sub = '') => {
    const r = document.createElement('div');
    r.className = 'row';
    const l = document.createElement('span');
    l.textContent = label;
    if (sub) {
      const s = document.createElement('small');
      s.textContent = sub;
      l.append(s);
    }
    r.append(l, control);
    return r;
  };
  const head = (t) => {
    const h = document.createElement('h3');
    h.textContent = t;
    return h;
  };

  function render() {
    const s = settings();
    root.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'box';
    const h = document.createElement('h2');
    h.textContent = 'Settings';
    box.append(h);

    box.append(head('Graphics'));
    box.append(
      row(
        'Quality',
        dropdown(s.quality, [['auto', 'Auto (best for 60 fps)'], ['0', 'High'], ['1', 'Medium'], ['2', 'Low'], ['3', 'Potato']], (v) => setSetting('quality', v)),
        s.quality === 'auto' ? 'Picks the best look that keeps it smooth' : '',
      ),
    );
    box.append(row('Frame rate', dropdown(s.fps, [[60, '60 fps'], [30, '30 fps (saves battery)'], [0, 'Unlimited']], (v) => setSetting('fps', +v))));
    box.append(row('Screen shake', dropdown(s.shake, [['on', 'On'], ['reduced', 'Reduced'], ['off', 'Off']], (v) => setSetting('shake', v))));
    box.append(row('Show frame rate', toggle(s.showFps, (v) => setSetting('showFps', v))));

    if (touch()) {
      box.append(head('Touch controls'));
      box.append(row('Aiming', dropdown(s.aimAssist ? 'assist' : 'manual', [['assist', 'Aim assist'], ['manual', 'Manual aim']], (v) => setSetting('aimAssist', v === 'assist')), s.aimAssist ? 'Locks onto an enemy, and a new one after each reload. Drag to aim yourself.' : 'Drag on the screen to aim; FIRE shoots there.'));
      box.append(row('Button size', dropdown(s.buttons, [['small', 'Small'], ['normal', 'Normal'], ['large', 'Large']], (v) => setSetting('buttons', v))));
      box.append(row('Layout', dropdown(s.hand, [['right', 'Stick left, fire right'], ['left', 'Stick right, fire left']], (v) => setSetting('hand', v))));
      box.append(row('Stick sensitivity', dropdown(s.stick, [[0.7, 'Low'], [1, 'Normal'], [1.35, 'High']], (v) => setSetting('stick', +v))));
    } else {
      box.append(head('Keys'));
      for (const [a, label] of ACTIONS) {
        const k = document.createElement('button');
        k.type = 'button';
        k.className = `key${waiting === a ? ' wait' : ''}`;
        k.textContent = waiting === a ? 'Press a key' : keyLabel(s.keys[a]);
        k.onclick = () => {
          waiting = waiting === a ? null : a;
          render();
        };
        box.append(row(label, k));
      }
      const note = document.createElement('div');
      note.className = 'note';
      note.textContent = 'The arrow keys always drive too. Esc pauses. Aim with the mouse; click fires as well.';
      box.append(note);
    }

    const bar = document.createElement('div');
    bar.className = 'bar';
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = 'Defaults';
    reset.onclick = () => {
      for (const k of Object.keys(DEFAULTS)) setSetting(k, k === 'keys' ? { ...DEFAULTS.keys } : DEFAULTS[k]);
      waiting = null;
      render();
    };
    const done = document.createElement('button');
    done.type = 'button';
    done.className = 'done';
    done.textContent = 'Done';
    done.onclick = () => close();
    bar.append(reset, done);
    box.append(bar);
    root.append(box);
    fitBox();
  }
  // the whole menu on screen at once, shrunk to fit if it must
  function fitBox() {
    const box = root.querySelector('.box');
    if (!box || root.hidden) return;
    box.style.maxHeight = 'none';
    fitInside(box, window.innerWidth - 24, window.innerHeight - 24);
  }
  window.addEventListener('resize', fitBox);

  // rebinding: the next key pressed (Esc cancels); a key already used
  // elsewhere swaps over
  window.addEventListener(
    'keydown',
    (e) => {
      if (root.hidden) return;
      e.stopPropagation();
      e.preventDefault();
      if (!waiting) {
        if (e.code === 'Escape') close();
        return;
      }
      if (e.code !== 'Escape') {
        const keys = { ...settings().keys };
        const code = e.code === 'ShiftRight' ? 'ShiftLeft' : e.code;
        const other = Object.keys(keys).find((a) => keys[a] === code && a !== waiting);
        if (other) keys[other] = keys[waiting];
        keys[waiting] = code;
        setSetting('keys', keys);
      }
      waiting = null;
      render();
    },
    true,
  );
  root.addEventListener('pointerdown', (e) => {
    if (openDd && !openDd.contains(e.target)) closeDd();
    if (e.target === root) close(); // a tap outside the box
  });

  function close() {
    root.hidden = true;
    waiting = null;
    closeDd();
    onClose?.();
    onClose = null;
  }
  return {
    open(cb = null) {
      onClose = cb;
      waiting = null;
      root.hidden = false;
      render();
    },
    close,
    get isOpen() {
      return !root.hidden;
    },
  };
}

// the one menu, made on first use
let menu = null;
export function openSettings(onClose = null) {
  menu ??= createSettingsMenu({ touch: () => matchMedia('(pointer: coarse)').matches });
  menu.open(onClose);
}
export const settingsOpen = () => !!menu?.isOpen;

// a prompt's key hints in the keys you've bound (written with the defaults)
const DEFAULT_HINT = { W: 'up', A: 'left', S: 'down', D: 'right', Space: 'fire', Shift: 'boost', E: 'ability', Q: 'equip', R: 'reload' };
export function rebindHints(html) {
  const k = settings().keys;
  return html.replace(/<kbd>(W|A|S|D|Space|Shift|E|Q|R)<\/kbd>/g, (m, d) => `<kbd>${keyLabel(k[DEFAULT_HINT[d]])}</kbd>`);
}
