// Sound: one shared Web Audio graph. Short sounds fire and forget; loops
// (treads, rockets) run silent all the time and get faded up and down.
// Nothing plays until the player's first tap or key (browsers insist), and
// everything goes quiet in a hidden tab, while the portal mutes, or with the
// volume setting at Off.
import { settings, onSettings } from './ui/settings.js';
import { platform } from './platform.js';

const FILES = {
  rocket: 'rocket.mp3',
  explosion: 'explosion.mp3',
  treads: 'treads.mp3',
  lock: 'lock.mp3',
  cannon: 'cannon.mp3',
  autocannon: 'autocannon.mp3',
  launch: 'launch.mp3',
  mg: 'mg.mp3',
  vulcan: 'vulcan.wav', // (a wav: cut to whole firing periods, already seamless)
  vulcanStart: 'vulcan-start.mp3',
  vulcanTail: 'vulcan-tail.mp3',
  beep: 'beep.mp3',
  beep2: 'beep2.mp3',
  crash: 'crash.mp3',
  boom: 'boom.mp3',
  clank: 'clank.mp3',
  click: 'click.mp3', // (level-ups and evolves)
};
const LOOPS = new Set(['rocket', 'treads', 'vulcan']);
const SEAMLESS = new Set(['vulcan']); // (loops made seamless offline: played as they are)
// (no machine gun drowning out the rest: each sound has a shortest gap
// between plays and a cap on how many ring at once)
const GAP = { mg: 0.035, lock: 0.05, launch: 0.07, autocannon: 0.05, cannon: 0.08, boom: 0.03, crash: 0.12, beep2: 0.15 };
const VOICES = { mg: 4, launch: 4, autocannon: 4, cannon: 3, explosion: 3, boom: 5, crash: 2 };
const lastAt = {};
const ringing = {};
// where the ears are (the tank): sounds out in the world fade with distance
const ear = { x: 0, z: 0 };

let ctx = null;
let master = null;
const buffers = {};
const loops = {};

// a loop that doesn't click or dip where it wraps: its tail crossfaded into
// its head at equal power (a straight fade sags in the middle)
function loopify(buf, fade = 0.25) {
  const f = Math.floor(fade * buf.sampleRate);
  // (skip the encoder's silent lead-in)
  const d0 = buf.getChannelData(0);
  let start = 0;
  while (start < 4000 && Math.abs(d0[start]) < 1e-3) start++;
  // (and its padded tail: a quiet end would sag the seam)
  let end = buf.length;
  while (end > start + 4000 && Math.abs(d0[end - 1]) < 2e-2) end--;
  end = Math.max(start + 1, end - Math.floor(0.015 * buf.sampleRate));
  const n = end - start;
  if (n < f * 3) return buf;
  const out = ctx.createBuffer(buf.numberOfChannels, n - f, buf.sampleRate);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const src = buf.getChannelData(c).subarray(start);
    const dst = out.getChannelData(c);
    dst.set(src.subarray(0, n - f));
    for (let i = 0; i < f; i++) {
      const k = i / f;
      dst[i] = src[i] * Math.sqrt(k) + src[n - f + i] * Math.sqrt(1 - k);
    }
  }
  return out;
}

async function load(name) {
  try {
    const res = await fetch(new URL(`./assets/sounds/${FILES[name]}`, import.meta.url));
    const raw = await ctx.decodeAudioData(await res.arrayBuffer());
    buffers[name] = LOOPS.has(name) && !SEAMLESS.has(name) ? loopify(raw) : raw;
    if (LOOPS.has(name)) startLoop(name);
  } catch (err) {
    console.warn('sound', name, err);
  }
}

function startLoop(name) {
  const l = loops[name];
  if (!l || l.src || !buffers[name]) return;
  l.src = ctx.createBufferSource();
  l.src.buffer = buffers[name];
  l.src.loop = true;
  l.src.playbackRate.value = l.rate;
  l.src.connect(l.gain);
  l.src.start();
}

function init() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  for (const name of LOOPS) {
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(master);
    loops[name] = { gain, src: null, rate: 1, target: 0 };
  }
  for (const name of Object.keys(FILES)) load(name);
}

// the first tap or key wakes it (and any later one, if the browser slept it)
const wake = () => {
  init();
  if (ctx?.state === 'suspended') ctx.resume().catch(() => {});
};
for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, wake, { capture: true, passive: true });

export const sfx = {
  // a one-shot: gain 0..1, rate (pitch and speed together)
  play(name, { gain = 1, rate = 1 } = {}) {
    if (!ctx || !buffers[name] || ctx.state !== 'running' || gain < 0.01) return;
    const now = ctx.currentTime;
    if (now - (lastAt[name] ?? -1) < (GAP[name] || 0)) return;
    // (voices counted by when they're due to end, not by their ended
    // events: a context the browser suspended mid-sound may never send those,
    // and a stuck count would silence that sound for good)
    const live = (ringing[name] = (ringing[name] || []).filter((end) => end > now));
    if (live.length >= (VOICES[name] || 8)) return;
    lastAt[name] = now;
    live.push(now + buffers[name].duration / rate);
    const src = ctx.createBufferSource();
    src.buffer = buffers[name];
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(master);
    src.start();
  },
  // a one-shot out in the world: quieter the further it is from the tank
  // (full up to 8 units, gone past about 60, or opts.reach for a big one)
  at(name, pos, opts = {}) {
    const d = Math.hypot(pos.x - ear.x, pos.z - ear.z);
    const k = Math.max(0, Math.min(1, 1 - (d - 8) / ((opts.reach || 60) - 8)));
    sfx.play(name, { ...opts, gain: (opts.gain ?? 1) * k * k });
  },
  listen(pos) {
    ear.x = pos.x;
    ear.z = pos.z;
  },
  // a loop's level (0..1) and rate, eased there over about tau seconds
  // (delay: start easing only that many seconds from now)
  loop(name, gain, rate = 1, tau = 0.15, delay = 0) {
    const l = loops[name];
    if (!l) return;
    if (Math.abs(gain - l.target) > 0.002) {
      l.target = gain;
      const g = l.gain.gain;
      (g.cancelAndHoldAtTime || g.cancelScheduledValues).call(g, ctx.currentTime); // (from where it is now)
      g.setTargetAtTime(gain, ctx.currentTime + delay, tau);
    }
    if (l.src && Math.abs(rate - l.rate) > 0.01) {
      l.rate = rate;
      const r = l.src.playbackRate;
      (r.cancelAndHoldAtTime || r.cancelScheduledValues).call(r, ctx.currentTime); // (no pile of old ramps)
      r.setTargetAtTime(rate, ctx.currentTime, 0.1);
    }
  },
  // every frame: the overall level
  update() {
    if (!master) return;
    // back after a long gap (a stall, a sleep, a hidden tab): put every
    // level straight where it should be, nothing left scheduled
    const t = performance.now();
    if (t - (lastUpdate || t) > 1000) resync();
    lastUpdate = t;
    const muted = document.hidden || platform.inAd || platform.muted;
    const v = muted ? 0 : settings().volume ?? 0.75;
    if (Math.abs(v - (master.v ?? -1)) > 0.001) {
      master.v = v;
      master.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
    }
  },
};

let lastUpdate = 0;
function resync() {
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const l of Object.values(loops)) {
    l.gain.gain.cancelScheduledValues(now);
    l.gain.gain.setValueAtTime(l.target, now);
    if (l.src) {
      l.src.playbackRate.cancelScheduledValues(now);
      l.src.playbackRate.setValueAtTime(l.rate, now);
    }
  }
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(master.v ?? 0, now);
  for (const k of Object.keys(ringing)) ringing[k] = [];
}
// a hidden tab: the whole audio graph sleeps (not just muted, so nothing
// keeps ticking); back: woken, everything put straight
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend().catch(() => {});
  else ctx.resume().then(resync, () => {});
});

// a beep at the new level, so you hear what you picked
onSettings((k) => k === 'volume' && sfx.play('beep2', { gain: 0.5 }));
