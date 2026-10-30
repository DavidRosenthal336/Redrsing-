'use strict';
// ---------------------------------------------------------------------------
// Core: canvas, input, audio, particles, helpers, scene manager
// ---------------------------------------------------------------------------
const W = 960, H = 540;
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
let viewScale = 1, dpr = 1;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  viewScale = Math.min(innerWidth / W, innerHeight / H);
  cv.style.width = Math.floor(W * viewScale) + 'px';
  cv.style.height = Math.floor(H * viewScale) + 'px';
  cv.width = Math.round(W * viewScale * dpr);
  cv.height = Math.round(H * viewScale * dpr);
}
addEventListener('resize', resize);
resize();

const FD = 'Cinzel, "Trajan Pro", "Times New Roman", serif';
const FB = 'Spectral, Georgia, "Times New Roman", serif';
const FH = '"Barlow Condensed", "Arial Narrow", Arial, sans-serif';

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- drawing --
function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function txt(s, x, y, o = {}) {
  ctx.font = `${o.weight || 600} ${o.size || 18}px ${o.font || FD}`;
  ctx.textAlign = o.align || 'left';
  ctx.textBaseline = o.base || 'alphabetic';
  if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.blur || 16; }
  if (o.stroke) { ctx.lineWidth = o.strokeW || 4; ctx.strokeStyle = o.stroke; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
  ctx.fillStyle = o.color || '#f1e4cc';
  ctx.fillText(s, x, y);
  ctx.shadowBlur = 0;
}
function bar(x, y, w, h, frac, color, bg = 'rgba(0,0,0,.55)', border = 'rgba(241,228,204,.25)') {
  ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color; ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
  ctx.strokeStyle = border; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}
function wrapLines(s, maxW, font) {
  ctx.font = font;
  const out = [];
  for (const para of s.split('\n')) {
    const words = para.split(' ');
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test;
    }
    out.push(line);
  }
  return out;
}
function panel(x, y, w, h, alpha = 0.72) {
  ctx.fillStyle = `rgba(12,5,4,${alpha})`;
  rr(x, y, w, h, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(224,181,82,.28)'; ctx.lineWidth = 1; ctx.stroke();
}

// ------------------------------------------------------------------ input --
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  KeyJ: 'a', Space: 'a', KeyZ: 'a', Enter: 'a',
  KeyK: 'b', ShiftLeft: 'b', ShiftRight: 'b', KeyX: 'b',
  Escape: 'pause', KeyP: 'pause', KeyM: 'mute',
};
const BTN_NAMES = ['left', 'right', 'up', 'down', 'a', 'b', 'pause', 'mute'];
const keys = {};
const touch = { ax: 0, ay: 0, a: false, b: false, pauseQ: false };
const btn = {}, prevBtn = {};
let tapPt = null, pendingTap = null;

addEventListener('keydown', (e) => {
  const k = KEYMAP[e.code];
  if (k) { keys[k] = true; e.preventDefault(); }
  AudioSys.init();
});
addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

cv.addEventListener('pointerdown', (e) => {
  AudioSys.init();
  const r = cv.getBoundingClientRect();
  pendingTap = { x: (e.clientX - r.left) / viewScale, y: (e.clientY - r.top) / viewScale };
  cv.focus();
});

function markTouch() { document.body.classList.add('touch'); }
addEventListener('touchstart', markTouch, { once: true, passive: true });
if (window.matchMedia && matchMedia('(pointer:coarse)').matches) markTouch();

(function setupTouch() {
  const stick = document.getElementById('stick'), knob = document.getElementById('knob');
  let sid = null;
  const upd = (e) => {
    const r = stick.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const m = Math.hypot(dx, dy), max = r.width / 2;
    if (m > max) { dx *= max / m; dy *= max / m; }
    touch.ax = dx / max; touch.ay = dy / max;
    knob.style.transform = `translate(${dx}px,${dy}px)`;
  };
  stick.addEventListener('pointerdown', (e) => { sid = e.pointerId; stick.setPointerCapture(sid); upd(e); AudioSys.init(); e.preventDefault(); });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === sid) upd(e); });
  const end = (e) => { if (e.pointerId !== sid) return; sid = null; touch.ax = touch.ay = 0; knob.style.transform = ''; };
  stick.addEventListener('pointerup', end);
  stick.addEventListener('pointercancel', end);
  const hook = (id, key) => {
    const el = document.getElementById(id);
    el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); touch[key] = true; el.classList.add('on'); AudioSys.init(); e.preventDefault(); });
    const off = () => { touch[key] = false; el.classList.remove('on'); };
    el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off);
  };
  hook('btnA', 'a');
  hook('btnB', 'b');
  document.getElementById('btnP').addEventListener('pointerdown', (e) => { touch.pauseQ = true; e.preventDefault(); });
})();

function pollInput() {
  for (const n of BTN_NAMES) prevBtn[n] = btn[n];
  btn.left = !!keys.left || touch.ax < -0.45;
  btn.right = !!keys.right || touch.ax > 0.45;
  btn.up = !!keys.up || touch.ay < -0.5;
  btn.down = !!keys.down || touch.ay > 0.5;
  btn.a = !!keys.a || touch.a;
  btn.b = !!keys.b || touch.b;
  btn.pause = !!keys.pause || touch.pauseQ;
  btn.mute = !!keys.mute;
  touch.pauseQ = false;
  tapPt = pendingTap; pendingTap = null;
}
const I = {
  ax() { if (Math.abs(touch.ax) > 0.15) return touch.ax; return (keys.right ? 1 : 0) - (keys.left ? 1 : 0); },
  ay() { if (Math.abs(touch.ay) > 0.15) return touch.ay; return (keys.down ? 1 : 0) - (keys.up ? 1 : 0); },
  down: (n) => !!btn[n],
  pressed: (n) => !!btn[n] && !prevBtn[n],
  tap: () => tapPt,
  inRect: (x, y, w, h) => !!tapPt && tapPt.x >= x && tapPt.x <= x + w && tapPt.y >= y && tapPt.y <= y + h,
};
const elA = document.getElementById('btnA'), elB = document.getElementById('btnB');
function setButtons(a, b) { elA.textContent = a; elB.textContent = b; }

// ------------------------------------------------------------------ audio --
const DRONES = {
  title: { notes: [55, 82.5, 110], type: 'sawtooth', cut: 520, vol: 0.05 },
  story: { notes: [73.4, 110, 146.8], type: 'triangle', cut: 900, vol: 0.045 },
  mine: { notes: [41.2, 61.7], type: 'sawtooth', cut: 300, vol: 0.07 },
  duel: { notes: [49, 73.4], type: 'sawtooth', cut: 420, vol: 0.06 },
  institute: { notes: [65.4, 98, 130.8], type: 'sawtooth', cut: 620, vol: 0.045 },
  jackal: { notes: [46.2, 69.3, 92.5], type: 'sawtooth', cut: 460, vol: 0.06 },
  rain: { notes: [36.7, 55, 73.4], type: 'sawtooth', cut: 380, vol: 0.06 },
};
const AudioSys = {
  ctx: null, master: null, muted: false, droneNodes: null, want: null, drillG: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.nbuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.nbuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      if (this.want) this.drone(this.want, true);
    } catch (e) { this.ctx = null; }
  },
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.55; },
  // `delay` is seconds from now; the sequencer schedules ahead with it.
  tone(f, dur, type = 'square', vol = 0.12, slide = 0, delay = 0) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  },
  noise(dur, vol = 0.25, freq = 1200, type = 'lowpass', q = 0.8, delay = 0) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.nbuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  },
  drone(name, force) {
    Music.play(name);
    if (this.want === name && !force) return;
    this.want = name;
    const c = this.ctx; if (!c) return;
    if (this.droneNodes) {
      const old = this.droneNodes;
      old.g.gain.setTargetAtTime(0.0001, c.currentTime, 0.5);
      setTimeout(() => old.oscs.forEach((o) => { try { o.stop(); } catch (e) {} }), 3000);
      this.droneNodes = null;
    }
    const cfg = DRONES[name]; if (!cfg) return;
    const g = c.createGain(); g.gain.value = 0.0001;
    g.gain.setTargetAtTime(cfg.vol * (Music.on ? 0.55 : 1), c.currentTime, 1.2);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cfg.cut;
    f.connect(g); g.connect(this.master);
    const oscs = cfg.notes.map((n, i) => {
      const o = c.createOscillator(); o.type = cfg.type; o.frequency.value = n; o.detune.value = i % 2 ? 6 : -6;
      o.connect(f); o.start(); return o;
    });
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07;
    const lg = c.createGain(); lg.gain.value = cfg.cut * 0.45;
    lfo.connect(lg); lg.connect(f.frequency); lfo.start(); oscs.push(lfo);
    this.droneNodes = { g, oscs };
  },
  drill(level) {
    const c = this.ctx; if (!c) return;
    if (!this.drillG) {
      const s = c.createBufferSource(); s.buffer = this.nbuf; s.loop = true;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 380; f.Q.value = 1.4;
      const g = c.createGain(); g.gain.value = 0;
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 58;
      const og = c.createGain(); og.gain.value = 0.25;
      o.connect(og); og.connect(f);
      s.connect(f); f.connect(g); g.connect(this.master); s.start(); o.start();
      this.drillG = g; this.drillF = f;
    }
    this.drillG.gain.setTargetAtTime(level * 0.16, c.currentTime, 0.05);
    this.drillF.frequency.setTargetAtTime(level > 0.6 ? 420 : 260, c.currentTime, 0.1);
  },
  // Original melody standing in for Eo's forbidden song (the books give no tune).
  lament() {
    const N = { D4: 293.7, E4: 329.6, F4: 349.2, G4: 392, A4: 440, C5: 523.3, D5: 587.3, A3: 220 };
    const seq = [['D4', .5], ['F4', .5], ['A4', 1], ['G4', .5], ['F4', .5], ['E4', 1], ['D4', .5], ['E4', .5], ['F4', .5], ['A4', .5], ['D5', 1.5], ['C5', .5], ['A4', 1], ['G4', .5], ['F4', .5], ['E4', .5], ['D4', 2]];
    let t = 0.2;
    for (const [n, d] of seq) { this.tone(N[n], d * 0.62, 'triangle', 0.09, 0, t); this.tone(N[n] / 2, d * 0.62, 'sine', 0.05, 0, t); t += d * 0.6; }
  },
};
const sfx = {
  blip: () => AudioSys.tone(660, 0.05, 'square', 0.05),
  select: () => { AudioSys.tone(440, 0.07, 'square', 0.06); AudioSys.tone(880, 0.1, 'square', 0.05, 0, 0.06); },
  crumble: () => AudioSys.noise(0.12, 0.12, 700),
  gem: () => { AudioSys.tone(988, 0.1, 'triangle', 0.09); AudioSys.tone(1480, 0.16, 'triangle', 0.07, 0, 0.06); },
  boom: () => { AudioSys.noise(1.1, 0.55, 420); AudioSys.tone(70, 0.7, 'sawtooth', 0.22, 0.4); },
  hiss: () => AudioSys.noise(0.6, 0.12, 3800, 'highpass'),
  overheat: () => { AudioSys.tone(220, 0.25, 'square', 0.08, 0.5); AudioSys.tone(180, 0.35, 'square', 0.08, 0.5, 0.2); },
  bite: () => { AudioSys.noise(0.08, 0.2, 2200, 'bandpass', 2); AudioSys.tone(140, 0.12, 'sawtooth', 0.1, 0.6); },
  squish: () => { AudioSys.noise(0.15, 0.2, 900, 'bandpass', 1.5); AudioSys.tone(90, 0.15, 'sine', 0.15, 0.5); },
  slash: () => AudioSys.noise(0.12, 0.14, 3200, 'bandpass', 1.8),
  whoosh: () => AudioSys.noise(0.22, 0.1, 1400, 'bandpass', 0.7),
  hit: () => { AudioSys.noise(0.09, 0.25, 1800, 'bandpass', 1.2); AudioSys.tone(150, 0.1, 'square', 0.1, 0.5); },
  clang: () => { AudioSys.tone(1150, 0.22, 'square', 0.05, 0.97); AudioSys.tone(1730, 0.28, 'triangle', 0.06); AudioSys.noise(0.05, 0.18, 6000, 'highpass'); },
  parry: () => { AudioSys.tone(1568, 0.5, 'triangle', 0.1); AudioSys.tone(2349, 0.6, 'sine', 0.07); AudioSys.noise(0.07, 0.25, 7000, 'highpass'); },
  hurt: () => AudioSys.tone(220, 0.18, 'sawtooth', 0.1, 0.45),
  fanfare: () => { [392, 494, 587, 784].forEach((f, i) => AudioSys.tone(f, 0.35, 'square', 0.06, 0, i * 0.12)); },
  horn: () => { AudioSys.tone(110, 0.9, 'sawtooth', 0.09); AudioSys.tone(165, 0.9, 'sawtooth', 0.06, 0, 0.05); },
  ping: () => { AudioSys.tone(1320, 0.6, 'sine', 0.08, 0.5); },
};

// -------------------------------------------------------------- particles --
class Particles {
  constructor() { this.list = []; }
  add(x, y, vx, vy, life, color, size, g = 0, drag = 0) { this.list.push({ x, y, vx, vy, life, max: life, color, size, g, drag }); }
  burst(x, y, n, color, spd, life, size, g = 0, drag = 1.5) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = spd * (0.25 + Math.random() * 0.75);
      this.add(x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.5 + Math.random() * 0.5), Array.isArray(color) ? pick(color) : color, size * (0.5 + Math.random()), g, drag);
    }
  }
  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.vy += p.g * dt;
      if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.life <= 0) { L[i] = L[L.length - 1]; L.pop(); }
    }
  }
  draw() {
    for (const p of this.list) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }
}
class Floaters {
  constructor() { this.list = []; }
  add(x, y, text, color = '#f1e4cc', size = 16, life = 1.1) { this.list.push({ x, y, text, color, size, life, max: life }); }
  update(dt) { for (const f of this.list) { f.life -= dt; f.y -= 28 * dt; } this.list = this.list.filter((f) => f.life > 0); }
  draw() {
    for (const f of this.list) {
      ctx.globalAlpha = clamp(f.life / f.max * 1.6, 0, 1);
      txt(f.text, f.x, f.y, { size: f.size, font: FH, weight: 700, align: 'center', color: f.color, stroke: 'rgba(0,0,0,.8)', strokeW: 3 });
    }
    ctx.globalAlpha = 1;
  }
}

// ------------------------------------------------------------------- save --
const Save = {
  mem: 1,
  get() { let v = 1; try { v = +localStorage.getItem('btc_unlocked') || 1; } catch (e) {} return Math.max(v, this.mem); },
  unlock(n) { this.mem = Math.max(this.mem, n); try { if (n > (+localStorage.getItem('btc_unlocked') || 1)) localStorage.setItem('btc_unlocked', n); } catch (e) {} },
};

// ------------------------------------------------------------ scene flow --
let scene = null, nextScene = null, fade = 1, fadeDir = -1, paused = false, pauseSel = 0;
function go(s) { if (fadeDir === 1) return; nextScene = s; fadeDir = 1; paused = false; }

function drawPause() {
  ctx.fillStyle = 'rgba(5,2,2,.78)'; ctx.fillRect(0, 0, W, H);
  txt('PAUSED', W / 2, 190, { size: 46, weight: 800, align: 'center', color: '#e0b552', glow: 'rgba(192,38,45,.8)' });
  const items = ['Resume', 'Sound: ' + (AudioSys.muted ? 'Off' : 'On'), 'Music: ' + (Music.on ? 'On' : 'Off'), 'Quit to Title'];
  items.forEach((s, i) => {
    const y = 270 + i * 50, sel = i === pauseSel;
    if (sel) { ctx.fillStyle = 'rgba(192,38,45,.35)'; ctx.fillRect(W / 2 - 160, y - 30, 320, 42); }
    txt(s, W / 2, y, { size: 24, align: 'center', color: sel ? '#f1e4cc' : 'rgba(241,228,204,.6)' });
  });
}
function updatePause() {
  if (I.pressed('up')) { pauseSel = (pauseSel + 3) % 4; sfx.blip(); }
  if (I.pressed('down')) { pauseSel = (pauseSel + 1) % 4; sfx.blip(); }
  for (let i = 0; i < 4; i++) if (I.inRect(W / 2 - 160, 240 + i * 50, 320, 42)) { pauseSel = i; doPause(i); return; }
  if (I.pressed('a')) doPause(pauseSel);
  if (I.pressed('pause') || I.pressed('b')) paused = false;
}
function doPause(i) {
  sfx.select();
  if (i === 0) paused = false;
  else if (i === 1) AudioSys.setMuted(!AudioSys.muted);
  else if (i === 2) Music.setOn(!Music.on);
  else { paused = false; AudioSys.drill(0); go(new TitleScene()); }
}

let last = performance.now();
function frame(now) {
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  pollInput();
  if (I.pressed('mute')) AudioSys.setMuted(!AudioSys.muted);
  if (scene && scene.pausable && fadeDir === 0 && I.pressed('pause')) { paused = !paused; pauseSel = 0; if (paused) AudioSys.drill(0); }
  else if (paused) updatePause();
  if (fadeDir === 1) {
    fade += dt * 3.2;
    if (fade >= 1) { fade = 1; scene = nextScene; nextScene = null; if (scene.enter) scene.enter(); fadeDir = -1; }
  } else if (fadeDir === -1) {
    fade -= dt * 2.4;
    if (fade <= 0) { fade = 0; fadeDir = 0; }
  }
  if (scene && !paused && fadeDir !== 1) scene.update(dt);

  ctx.setTransform(viewScale * dpr, 0, 0, viewScale * dpr, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (scene) { ctx.save(); scene.draw(); ctx.restore(); }
  if (paused) drawPause();
  if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, W, H); }
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ music --
// A tiny step sequencer. Songs are original; each sits in the key of its scene's drone.
const NOTE_IDX = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
function n2f(n) { const m = n.match(/^([A-G]#?)(\d)$/); return 440 * Math.pow(2, (NOTE_IDX[m[1]] + (+m[2] + 1) * 12 - 69) / 12); }
function pat(str) { return str.trim().split(/\s+/).map((t) => (t === '.' ? null : t)); }
const INSTR = {
  bass: (f, t, d, v) => { AudioSys.tone(f, d, 'sawtooth', 0.07 * v, 0, t); AudioSys.tone(f / 2, d, 'sine', 0.06 * v, 0, t); },
  pluck: (f, t, d, v) => AudioSys.tone(f, Math.min(d, 0.35), 'triangle', 0.06 * v, 0, t),
  lead: (f, t, d, v) => { AudioSys.tone(f, d, 'square', 0.028 * v, 0, t); AudioSys.tone(f * 1.003, d, 'triangle', 0.04 * v, 0, t); },
  horn: (f, t, d, v) => { AudioSys.tone(f, d, 'sawtooth', 0.03 * v, 0, t); AudioSys.tone(f / 2, d, 'triangle', 0.04 * v, 0, t); },
  pad: (f, t, d, v) => { AudioSys.tone(f, d, 'sine', 0.035 * v, 0, t); AudioSys.tone(f * 1.5, d, 'sine', 0.018 * v, 0, t); },
  kick: (f, t, d, v) => AudioSys.tone(110, 0.22, 'sine', 0.22 * v, 0.3, t),
  tom: (f, t, d, v) => AudioSys.tone(f || 90, 0.3, 'sine', 0.16 * v, 0.55, t),
  snare: (f, t, d, v) => AudioSys.noise(0.12, 0.09 * v, 2400, 'bandpass', 0.9, t),
  hat: (f, t, d, v) => AudioSys.noise(0.035, 0.035 * v, 8000, 'highpass', 0.7, t),
  clank: (f, t, d, v) => { AudioSys.tone(f || 1800, 0.08, 'square', 0.025 * v, 0.9, t); AudioSys.noise(0.04, 0.04 * v, 5000, 'highpass', 1, t); },
};
const SONGS = {
  title: { bpm: 72, tracks: [
    ['pad', pat('A2:16 . . . . . . . . . . . . . . . F2:16 . . . . . . . . . . . . . . . C3:16 . . . . . . . . . . . . . . . G2:16 . . . . . . . . . . . . . . .')],
    ['pluck', pat('A3 . E4 . A4 . C5 . B4 . A4 . E4 . . . F3 . C4 . F4 . A4 . G4 . F4 . C4 . . . C4 . G4 . C5 . E5 . D5 . C5 . G4 . . . G3 . D4 . G4 . B4 . A4 . G4 . D4 . . .')],
    ['lead', pat('. . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . E5:6 . . . . . D5:2 . C5:4 . . . B4:4 . . . A4:12 . . . . . . . . . . . . . . . .')],
  ] },
  story: { bpm: 60, tracks: [
    ['pad', pat('D3:16 . . . . . . . . . . . . . . . A2:16 . . . . . . . . . . . . . . . A#2:16 . . . . . . . . . . . . . . . F2:16 . . . . . . . . . . . . . . .')],
    ['pluck', pat('D4 . . . F4 . . . A4 . . . F4 . . . C#4 . . . E4 . . . A4 . . . E4 . . . D4 . . . F4 . . . A#4 . . . F4 . . . C4 . . . F4 . . . A4 . . . C5 . . .')],
  ] },
  mine: { bpm: 96, tracks: [
    ['kick', pat('x . . . . . . . x . . x . . . . x . . . . . . . x . . . . . x .')],
    ['hat', pat('. . x . . . x . . . x . . . x . . . x . . . x . . . x . . . x x')],
    ['clank', pat('. . . . x . . . . . . . . . . . . . . . x . . . . . . . . . . .')],
    ['bass', pat('E2:2 . E2 . G2:2 . E2 . . . E2 . A#1:3 . . . E2:2 . E2 . G2:2 . E2 . . . D2:2 . B1:3 . . .')],
  ] },
  duel: { bpm: 120, tracks: [
    ['tom', pat('x . . x . . x . x . . . x . x . x . . x . . x . x . . . x x x x')],
    ['bass', pat('G1:2 . . G1 . . G1 . G#1:2 . . . G1:4 . . . G1:2 . . G1 . . G1 . D2:2 . . . C#2:4 . . .')],
    ['lead', pat('. . . . . . . . . . . . . . . . G4:4 . . . G#4:4 . . . G4:3 . . D4:5 . . . .')],
  ] },
  institute: { bpm: 104, tracks: [
    ['snare', pat('x . . . x . x x x . . . x . x . x . . . x . x x x . x . x x x x')],
    ['kick', pat('x . . . . . . . x . . . . . . . x . . . . . . . x . . . . . . .')],
    ['bass', pat('C2:4 . . . C2:4 . . . A#1:4 . . . G1:4 . . . C2:4 . . . C2:4 . . . F1:4 . . . G1:4 . . .')],
    ['horn', pat('C4:6 . . . . . D#4:2 . F4:8 . . . . . . . G4:4 . . . F4:2 . D#4:2 . D4:4 . . . C4:4 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .')],
  ] },
  jackal: { bpm: 132, tracks: [
    ['kick', pat('x . . x . . x . x . . x . . x .')],
    ['snare', pat('. . . . x . . . . . . . x . . x')],
    ['hat', pat('x x . x x x . x x x . x x x x x')],
    ['bass', pat('F#1:2 . F#2 . F#1 . C#2 . F#1:2 . E2 . F#1 . D2 . F#1:2 . F#2 . F#1 . C#2 . G1:2 . F#1:2 . E1:2 . . .')],
    ['lead', pat('. . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . F#4:3 . . A4:3 . . G#4:2 . F#4:6 . . . . . C#5:3 . . B4:3 . . A4:2 . G#4:6 . . . . .')],
  ] },
  rain: { bpm: 140, tracks: [
    ['kick', pat('x . . . x . . . x . . . x . . .')],
    ['snare', pat('. . . . x . . . . . . . x . . .')],
    ['hat', pat('. . x . . . x . . . x . . . x x')],
    ['bass', pat('D2 D2 D3 D2 D2 D3 D2 D2 A#1 A#1 A#2 A#1 A#1 A#2 A#1 A#1 F1 F1 F2 F1 F1 F2 F1 F1 C2 C2 C3 C2 C2 C3 E2 E2')],
    ['lead', pat('D4:4 . . . F4:4 . . . A4:6 . . . . . G4:2 . F4:4 . . . D4:4 . . . C4:8 . . . . . . . D4:4 . . . F4:4 . . . A4:4 . . . C5:4 . . . D5:12 . . . . . . . . . . . E5:2 . F5:2 .')],
  ] },
};
const Music = {
  on: true, cur: null, step: 0, nextT: 0, timer: null,
  play(name) {
    if (this.cur === name) return;
    this.cur = name; this.step = 0; this.nextT = 0;
    if (!this.timer) this.timer = setInterval(() => this.tick(), 40);
  },
  setOn(v) { this.on = v; try { localStorage.setItem('btc_music', v ? '1' : '0'); } catch (e) {} },
  tick() {
    const c = AudioSys.ctx, S = SONGS[this.cur];
    if (!c || !S || !this.on || AudioSys.muted || document.hidden) { if (c) this.nextT = c.currentTime + 0.05; return; }
    const spb = 60 / S.bpm / 4;
    if (this.nextT < c.currentTime) this.nextT = c.currentTime + 0.05;
    while (this.nextT < c.currentTime + 0.18) {
      for (const [inst, steps] of S.tracks) {
        const ev = steps[this.step % steps.length];
        if (!ev) continue;
        const [note, len] = ev.split(':');
        const f = /^[A-G]/.test(note) ? n2f(note) : 0;
        INSTR[inst](f, this.nextT - c.currentTime, (+len || 1) * spb * 0.95, note === 'X' ? 1.4 : 1);
      }
      this.nextT += spb; this.step++;
    }
  },
};
try { if (localStorage.getItem('btc_music') === '0') Music.on = false; } catch (e) {}

// ------------------------------------------------------------------ ranks --
// Grades use the Society's own Colors, best first.
const RANKS = [['Gold', '#e0b552'], ['Silver', '#c9ccd2'], ['Copper', '#b8733d'], ['Grey', '#8a8a8a'], ['Red', '#c0262d']];
const Ranks = {
  mem: {},
  best(ch) { let v = this.mem[ch]; try { const s = localStorage.getItem('btc_rank_' + ch); if (s !== null) v = Math.min(v ?? 9, +s); } catch (e) {} return v ?? null; },
  record(ch, r) { const b = this.best(ch); const isBest = b === null || r < b; if (isBest) { this.mem[ch] = r; try { localStorage.setItem('btc_rank_' + ch, r); } catch (e) {} } return isBest; },
  grade(value, cuts) { for (let i = 0; i < cuts.length; i++) if (value >= cuts[i]) return i; return 4; },
};
function drawRank(x, y, r, label = 'RANK', newBest = false) {
  const [name, col] = RANKS[r];
  txt(label, x - 8, y, { size: 16, font: FH, weight: 700, align: 'right', color: 'rgba(241,228,204,.7)' });
  ctx.fillStyle = col; rr(x, y - 22, 120, 30, 4); ctx.fill();
  txt(name.toUpperCase(), x + 60, y - 1, { size: 20, weight: 800, align: 'center', color: r === 4 || r === 3 ? '#f6eadb' : '#140806' });
  if (newBest) txt('NEW BEST', x + 130, y, { size: 14, font: FH, weight: 700, color: '#e0b552' });
}
