// Upgrade celebrations, shared by the workshop (parts, tanks) and the crew
// room. Everything here sits on document.body in plain screen pixels.
//  - fountain(rect, color): pixel sparks shooting straight up off a picture
//  - popFrames(el): the picture pops in a few hard frames, white outlines
//    flying off it
//  - ascend({...}): the big one (an evolve, a promotion): the screen goes
//    dark, the card comes to the middle, glows and shakes as it charges,
//    a white flash and it's the new tier; then what got better flies in
//    under it one line at a time ("Hull [24 → 30]", "[Legendary perk]")
const CSS = `
.cel-spark { position: fixed; z-index: 60; pointer-events: none; box-shadow: 0 0 0 2px #000; }
.cel-outline { position: fixed; z-index: 59; pointer-events: none; box-shadow: 0 0 0 3px #fff, 0 0 0 5px #000; }
.cel-ov { position: fixed; inset: 0; z-index: 58; display: grid; place-items: center; cursor: pointer; }
.cel-dark { position: absolute; inset: 0; background: #000; opacity: 0.9; }
.cel-flash { position: absolute; inset: 0; background: #fff; opacity: 0; pointer-events: none; }
.cel-stage { position: relative; display: grid; justify-items: center; gap: 14px; width: min(92vw, 420px); }
.cel-title { min-height: 30px; font: 400 26px/1 'Silkscreen', monospace; color: var(--c); text-transform: uppercase; text-shadow: 3px 3px 0 #000; opacity: 0; }
.cel-card { --c: #fff; position: relative; display: grid; justify-items: center; gap: 6px; padding: 10px 12px 12px; background: #17151a; box-shadow: 0 0 0 3px #000, 0 0 0 6px var(--c), 0 0 26px 4px var(--c); }
.cel-card img { display: block; width: 216px; height: 144px; image-rendering: pixelated; background: #1d1b1e; }
.cel-card img.sq { width: 144px; height: 144px; }
.cel-aura { position: absolute; inset: -18px; z-index: -1; background: radial-gradient(circle, var(--c) 0%, transparent 70%); opacity: 0; }
.cel-nm { font: 400 14px/1.1 'Silkscreen', monospace; color: #f1e9d8; text-transform: uppercase; }
.cel-tier { display: flex; align-items: center; gap: 6px; font: 400 11px/1 'Silkscreen', monospace; color: var(--c); text-transform: uppercase; }
.cel-tier canvas { width: 22px; height: 22px; image-rendering: pixelated; }
.cel-lines { display: grid; gap: 7px; justify-items: center; min-height: 10px; }
.cel-line { display: flex; gap: 10px; align-items: baseline; padding: 5px 10px; background: #121014; box-shadow: 0 0 0 2px #000, 0 0 0 4px #3a3540; font: 400 14px/1.2 'Pixelify Sans', monospace; color: #d8d0c0; white-space: nowrap; }
.cel-line b { font: 400 13px/1 'Silkscreen', monospace; color: #6be08a; }
.cel-line.perk { box-shadow: 0 0 0 2px #000, 0 0 0 4px #ffc24a, 0 0 14px #ffc24a99; color: #f1e9d8; }
.cel-line.perk b { color: #ffc24a; }
.cel-tap { font: 400 11px/1 'Silkscreen', monospace; color: #b9b0a0; text-transform: uppercase; opacity: 0; }
`;
let styled = false;
function style() {
  if (styled) return;
  styled = true;
  const s = document.createElement('style');
  s.textContent = CSS;
  document.head.append(s);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (a, b) => a + Math.random() * (b - a);

// sparks shooting straight up off the top of a box (screen rect), a little
// spread, slowing as they go and blinking out
export function fountain(rect, color, count = 24, power = 1) {
  style();
  for (let i = 0; i < count; i++) {
    const s = document.createElement('i');
    s.className = 'cel-spark';
    s.style.background = i % 3 ? color : '#ffffff';
    const size = Math.round(rnd(4, 9));
    s.style.width = s.style.height = `${size}px`;
    s.style.left = `${rect.left + rnd(0.08, 0.92) * rect.width}px`;
    s.style.top = `${rect.top + rnd(0.15, 0.6) * rect.height}px`;
    document.body.append(s);
    const up = rnd(110, 300) * power;
    const dx = rnd(-14, 14);
    s.animate(
      [
        { transform: 'translate(-50%, -50%)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx * 0.7}px), calc(-50% - ${up * 0.8}px))`, opacity: 1, offset: 0.6 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% - ${up}px)) scale(0.4)`, opacity: 0 },
      ],
      { duration: rnd(650, 1100), delay: rnd(0, 260), easing: 'cubic-bezier(.15,.75,.35,1)', fill: 'backwards' },
    ).finished.then(() => s.remove());
  }
}
// the picture pops in hard frames; white outlines fly off it
export function popFrames(el) {
  if (!el) return;
  style();
  const f = (t, b) => ({ transform: `scale(${t})`, filter: `brightness(${b})`, easing: 'steps(1, end)' });
  el.animate([f(1.16, 2.2), f(0.93, 1.5), f(1.07, 1.2), f(0.98, 1), f(1, 1)], { duration: 380 });
  const r = el.getBoundingClientRect();
  for (let k = 0; k < 2; k++) {
    const o = document.createElement('i');
    o.className = 'cel-outline';
    Object.assign(o.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    document.body.append(o);
    o.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: `scale(${1.25 + k * 0.2})`, opacity: 0 }], { duration: 420, delay: k * 120, easing: 'ease-out', fill: 'backwards' }).finished.then(() => o.remove());
  }
}

// the big show. { pic (image URL), square (a square picture), name,
// from: { name, color }, to: { name, color }, title, badge (an element
// shown by the tier line after, e.g. a rank icon), lines: [{ label, from,
// to }], perk: { name } }. Resolves once it's been clicked away.
export function ascend({ pic, square = false, name, from, to, title, badge = null, lines = [], perk = null }) {
  style();
  const ov = document.createElement('div');
  ov.className = 'cel-ov';
  ov.innerHTML = `<div class="cel-dark"></div><div class="cel-stage"><div class="cel-title"></div><div class="cel-card"><div class="cel-aura"></div><img alt=""${square ? ' class="sq"' : ''}><div class="cel-nm"></div><div class="cel-tier"><span></span></div></div><div class="cel-lines"></div><div class="cel-tap">Tap to continue</div></div><div class="cel-flash"></div>`;
  const $ = (s) => ov.querySelector(s);
  const card = $('.cel-card');
  card.style.setProperty('--c', from.color);
  $('.cel-title').style.setProperty('--c', to.color);
  $('.cel-title').textContent = title;
  $('img').src = pic;
  $('.cel-nm').textContent = name;
  $('.cel-tier span').textContent = from.name;
  document.body.append(ov);
  let skip = false;
  let done = false;
  let close;
  const closed = new Promise((r) => (close = r));
  ov.addEventListener('click', () => {
    if (done) {
      done = false;
      ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220 }).finished.then(() => (ov.remove(), close()));
    } else skip = true;
  });
  const wait = (ms) => (skip ? Promise.resolve() : sleep(ms));
  (async () => {
    $('.cel-dark').animate([{ opacity: 0 }, { opacity: 0.9 }], { duration: 260, easing: 'ease-out' });
    card.animate([{ transform: 'scale(0.5)', opacity: 0 }, { transform: 'scale(1.06)', opacity: 1, offset: 0.7 }, { transform: 'scale(1)', opacity: 1 }], { duration: 340, easing: 'ease-out' });
    await wait(380);
    // charging: it glows harder and shakes, sparks rising off it
    if (!skip) {
      $('.cel-aura').animate([{ opacity: 0, transform: 'scale(0.8)' }, { opacity: 0.9, transform: 'scale(1.25)' }], { duration: 1000, easing: 'ease-in', fill: 'forwards' });
      card.animate(
        Array.from({ length: 12 }, (_, i) => ({ transform: `translate(${((i * 7) % 5) - 2}px, ${((i * 3) % 3) - 1}px) scale(${1 + i * 0.006})` })),
        { duration: 1000, easing: 'steps(12)' },
      );
      const r = card.getBoundingClientRect();
      for (let k = 0; k < 4; k++) setTimeout(() => !skip && fountain(r, from.color, 8, 0.7), k * 220);
    }
    await wait(1000);
    // the flash: and it's the new one
    $('.cel-flash').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 650, easing: 'ease-out' });
    card.style.setProperty('--c', to.color);
    $('.cel-tier span').textContent = to.name;
    if (badge) $('.cel-tier').prepend(badge);
    $('.cel-aura').getAnimations().forEach((a) => a.cancel());
    $('.cel-aura').animate([{ opacity: 1, transform: 'scale(1.6)' }, { opacity: 0.35, transform: 'scale(1)' }], { duration: 700, easing: 'ease-out', fill: 'forwards' });
    card.animate([{ transform: 'scale(1.28)' }, { transform: 'scale(0.95)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'ease-out' });
    $('.cel-title').animate([{ opacity: 0, transform: 'scale(2.4)' }, { opacity: 1, transform: 'scale(0.94)', offset: 0.6 }, { opacity: 1, transform: 'scale(1)' }], { duration: 360, easing: 'ease-out', fill: 'forwards' });
    const r = card.getBoundingClientRect();
    fountain(r, to.color, 50, 1.6);
    popFrames($('img'));
    await wait(520);
    // what got better, one line at a time
    const all = [...lines.map((l) => ({ html: `<span></span><b></b>`, l })), ...(perk ? [{ perk }] : [])];
    for (const it of all) {
      const el = document.createElement('div');
      el.className = `cel-line${it.perk ? ' perk' : ''}`;
      if (it.perk) {
        el.innerHTML = '<b>[Legendary perk]</b><span></span>';
        el.querySelector('span').textContent = it.perk.name;
      } else {
        el.innerHTML = it.html;
        el.querySelector('span').textContent = it.l.label;
        el.querySelector('b').textContent = `[${it.l.from} → ${it.l.to}]`;
      }
      $('.cel-lines').append(el);
      el.animate([{ opacity: 0, transform: 'translateX(70px) scale(1.4)' }, { opacity: 1, transform: 'translateX(-4px) scale(0.98)', offset: 0.7 }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'ease-out' });
      fountain(el.getBoundingClientRect(), it.perk ? '#ffc24a' : to.color, 6, 0.4);
      await wait(it.perk ? 420 : 300);
    }
    await wait(250);
    $('.cel-tap').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, fill: 'forwards' });
    done = true;
  })();
  return closed;
}
