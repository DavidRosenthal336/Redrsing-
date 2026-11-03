'use strict';
// ---------------------------------------------------------------------------
// Engine: renderer + post chain, input, audio, shared shaders and helpers
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const IS_TOUCH = (window.matchMedia && matchMedia('(pointer:coarse)').matches) || 'ontouchstart' in window;
if (IS_TOUCH) document.body.classList.add('touch');

THREE.ColorManagement.legacyMode = false;

const renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: false, powerPreference: 'high-performance' });
const DPR = Math.min(window.devicePixelRatio || 1, IS_TOUCH ? 1.25 : 1.6);
renderer.setPixelRatio(DPR);
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputEncoding = THREE.LinearEncoding;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 400000);

// HDR render target so emissive plasma and sunlight can exceed 1.0 and bloom properly.
const hdrRT = new THREE.WebGLRenderTarget(innerWidth * DPR, innerHeight * DPR, { type: THREE.HalfFloatType });
const composer = new THREE.EffectComposer(renderer, hdrRT);
const renderPass = new THREE.RenderPass(new THREE.Scene(), camera);
const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.85, 0.55, 0.9);
const FinalShader = {
  uniforms: {
    tDiffuse: { value: null }, time: { value: 0 }, exposure: { value: 1 }, aberr: { value: 0.006 },
    vig: { value: 0.55 }, grain: { value: 0.045 }, flash: { value: 0 }, fade: { value: 0 }, tint: { value: new THREE.Color(1, 1, 1) },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, exposure, aberr, vig, grain, flash, fade; uniform vec3 tint; varying vec2 vUv;
    vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
    void main(){
      vec2 d = vUv - 0.5; float r = dot(d,d);
      vec3 col;
      col.r = texture2D(tDiffuse, vUv - d*aberr*r*2.5).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv + d*aberr*r*2.5).b;
      col = aces(col * exposure * tint);
      col = pow(col, vec3(1.0/2.2));
      col *= 1.0 - vig * smoothstep(0.12, 0.62, r * 1.6);
      float n = fract(sin(dot(vUv*vec2(12.9898,78.233) + fract(time)*91.7, vec2(1.0))) * 43758.5453);
      col += (n - 0.5) * grain;
      col = mix(col, vec3(1.0, 0.97, 0.92), flash);
      col *= 1.0 - fade;
      gl_FragColor = vec4(col, 1.0);
    }`,
};
const finalPass = new THREE.ShaderPass(FinalShader);
composer.addPass(renderPass);
composer.addPass(bloom);
composer.addPass(finalPass);
const post = finalPass.uniforms;

function onResize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloom.setSize(w / 2, h / 2);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', onResize);

// Camera shake shared by every phase
const Shake = { amt: 0, add(v) { this.amt = Math.max(this.amt, v); }, apply(cam, dt, t) {
  this.amt = Math.max(0, this.amt - dt * 1.6);
  const a = this.amt * this.amt;
  cam.rotation.x += (Math.sin(t * 37.1) + Math.sin(t * 53.7)) * 0.012 * a;
  cam.rotation.y += (Math.sin(t * 41.3) + Math.sin(t * 29.9)) * 0.012 * a;
  cam.rotation.z += Math.sin(t * 47.9) * 0.01 * a;
} };

// ------------------------------------------------------------------ input --
const Input = {
  keys: {}, hits: {}, prev: {}, cur: {}, look: { x: 0, y: 0 }, stick: { x: 0, y: 0 }, touchA: false, touchB: false, tap: false, pendingTap: false,
  locked: false,
  map: { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    Space: 'a', KeyJ: 'a', Enter: 'a', KeyE: 'a', ShiftLeft: 'b', ShiftRight: 'b', KeyK: 'b', KeyM: 'mute', Escape: 'esc' },
  poll() {
    for (const k of ['up', 'down', 'left', 'right', 'a', 'b', 'mute', 'esc']) this.prev[k] = this.cur[k];
    // keydown latches a hit until the next poll, so a tap shorter than one frame still counts
    for (const k of ['up', 'down', 'left', 'right', 'mute', 'esc']) this.cur[k] = !!this.keys[k] || !!this.hits[k];
    this.cur.a = !!this.keys.a || !!this.hits.a || this.touchA; this.cur.b = !!this.keys.b || !!this.hits.b || this.touchB;
    this.hits = {};
    this.tap = this.pendingTap; this.pendingTap = false;
  },
  down(k) { return !!this.cur[k]; },
  pressed(k) { return !!this.cur[k] && !this.prev[k]; },
  axis() {
    if (Math.abs(this.stick.x) + Math.abs(this.stick.y) > 0.15) return { x: this.stick.x, y: -this.stick.y };
    return { x: (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0), y: (this.keys.up ? 1 : 0) - (this.keys.down ? 1 : 0) };
  },
  consumeLook() { const l = { x: this.look.x, y: this.look.y }; this.look.x = this.look.y = 0; return l; },
  setTouch(stick, a, b, aLabel, bLabel) {
    $('stick').classList.toggle('on', stick); $('btnA').classList.toggle('on', a); $('btnB').classList.toggle('on', b);
    if (aLabel) $('btnA').textContent = aLabel; if (bLabel) $('btnB').textContent = bLabel;
  },
};
addEventListener('keydown', (e) => { const k = Input.map[e.code]; if (k) { if (!e.repeat) Input.hits[k] = true; Input.keys[k] = true; if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault(); } Sound.unlock(); });
addEventListener('keyup', (e) => { const k = Input.map[e.code]; if (k) Input.keys[k] = false; });
addEventListener('blur', () => { for (const k in Input.keys) Input.keys[k] = false; });
const glEl = $('gl');
glEl.addEventListener('click', () => { Input.pendingTap = true; if (Input.wantLock && !IS_TOUCH && glEl.requestPointerLock) { try { const p = glEl.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {} } });
document.addEventListener('pointerlockchange', () => { Input.locked = document.pointerLockElement === glEl; });
addEventListener('mousemove', (e) => { if (Input.locked) { Input.look.x += e.movementX; Input.look.y += e.movementY; } });
// drag-to-look for mouse without pointer lock, and for touch on the right side of the screen
let dragId = null, dragX = 0, dragY = 0;
glEl.addEventListener('pointerdown', (e) => {
  Sound.unlock();
  if (Input.locked) return;
  if (e.pointerType === 'touch' && e.clientX < innerWidth * 0.4) return;
  dragId = e.pointerId; dragX = e.clientX; dragY = e.clientY;
});
addEventListener('pointermove', (e) => { if (e.pointerId !== dragId) return; Input.look.x += (e.clientX - dragX) * 1.4; Input.look.y += (e.clientY - dragY) * 1.4; dragX = e.clientX; dragY = e.clientY; });
addEventListener('pointerup', (e) => { if (e.pointerId === dragId) dragId = null; });
(function touchControls() {
  const stick = $('stick'), knob = $('knob'); let sid = null;
  const upd = (e) => {
    const r = stick.getBoundingClientRect(); let dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2;
    const m = Math.hypot(dx, dy), max = r.width / 2; if (m > max) { dx *= max / m; dy *= max / m; }
    Input.stick.x = dx / max; Input.stick.y = dy / max; knob.style.transform = `translate(${dx}px,${dy}px)`;
  };
  stick.addEventListener('pointerdown', (e) => { sid = e.pointerId; stick.setPointerCapture(sid); upd(e); e.preventDefault(); e.stopPropagation(); });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === sid) upd(e); });
  const end = (e) => { if (e.pointerId !== sid) return; sid = null; Input.stick.x = Input.stick.y = 0; knob.style.transform = ''; };
  stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
  for (const [id, key] of [['btnA', 'touchA'], ['btnB', 'touchB']]) {
    const el = $(id);
    el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); Input[key] = true; Sound.unlock(); e.preventDefault(); e.stopPropagation(); });
    const off = () => { Input[key] = false; };
    el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off);
  }
})();

// ------------------------------------------------------------------ sound --
const Sound = {
  ctx: null, master: null, verb: null, muted: false, loops: {},
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext; this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.7;
      const comp = this.ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      this.master.connect(comp); comp.connect(this.ctx.destination);
      const sr = this.ctx.sampleRate, len = sr * 2;
      this.nbuf = this.ctx.createBuffer(1, len, sr); const d = this.nbuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      // a big metallic hall for the bay and a long tail for explosions
      const ir = this.ctx.createBuffer(2, sr * 3, sr);
      for (let c = 0; c < 2; c++) { const ch = ir.getChannelData(c); for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 3.2); }
      this.verb = this.ctx.createConvolver(); this.verb.buffer = ir;
      this.verbGain = this.ctx.createGain(); this.verbGain.gain.value = 0.35;
      this.verb.connect(this.verbGain); this.verbGain.connect(this.master);
    } catch (e) { this.ctx = null; }
  },
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.7; },
  out(wet) { const g = this.ctx.createGain(); g.connect(this.master); if (wet) { const s = this.ctx.createGain(); s.gain.value = wet; g.connect(s); s.connect(this.verb); } return g; },
  tone(f, dur, { type = 'sine', vol = 0.15, slide = 0, delay = 0, wet = 0.2, attack = 0.01 } = {}) {
    const c = this.ctx; if (!c) return; const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.out(wet)); o.start(t); o.stop(t + dur + 0.05);
  },
  noise(dur, { vol = 0.3, freq = 1200, type = 'lowpass', q = 0.8, delay = 0, wet = 0.3, attack = 0.005, sweep = 0 } = {}) {
    const c = this.ctx; if (!c) return; const t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.nbuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(30, freq * sweep), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.out(wet)); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  },
  // continuous beds: name -> {gain, filter}; level and pitch are steered every frame
  loop(name, { type = 'noise', freq = 400, q = 1, osc = 0 } = {}) {
    const c = this.ctx; if (!c || this.loops[name]) return this.loops[name];
    const g = c.createGain(); g.gain.value = 0; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; f.Q.value = q;
    const nodes = [];
    if (type === 'noise') { const s = c.createBufferSource(); s.buffer = this.nbuf; s.loop = true; s.connect(f); s.start(); nodes.push(s); }
    if (osc) { for (const [fr, ty, v] of osc) { const o = c.createOscillator(); o.type = ty; o.frequency.value = fr; const og = c.createGain(); og.gain.value = v; o.connect(og); og.connect(f); o.start(); nodes.push(o); } }
    f.connect(g); g.connect(this.out(0.15));
    return (this.loops[name] = { g, f, nodes });
  },
  set(name, level, freq) { const L = this.loops[name]; if (!L) return; const t = this.ctx.currentTime; L.g.gain.setTargetAtTime(level, t, 0.15); if (freq) L.f.frequency.setTargetAtTime(freq, t, 0.2); },
  stopAll() { for (const k in this.loops) this.set(k, 0); },
  boom(dist = 0) {
    const v = clamp(1 - dist / 400, 0.08, 1);
    this.noise(1.8, { vol: 0.7 * v, freq: 900, sweep: 0.15, wet: 0.6 }); this.tone(55, 1.2, { type: 'sine', vol: 0.5 * v, slide: 0.5, wet: 0.4 });
    this.noise(0.15, { vol: 0.4 * v, freq: 4000, type: 'highpass', wet: 0.2 });
  },
  beep(f = 1200, n = 1, gap = 0.12) { for (let i = 0; i < n; i++) this.tone(f, 0.08, { type: 'square', vol: 0.05, delay: i * gap, wet: 0.1 }); },
  clank() { this.tone(220, 0.6, { type: 'square', vol: 0.06, slide: 0.6, wet: 0.7 }); this.noise(0.3, { vol: 0.3, freq: 2400, type: 'bandpass', q: 2, wet: 0.7 }); },
  step() { this.noise(0.09, { vol: 0.1, freq: 380, wet: 0.5 }); this.tone(70, 0.08, { vol: 0.08, wet: 0.4 }); },
};

// ----------------------------------------------------------------- music --
// Original score: low brass drones and war drums. Scheduled ahead on the audio clock.
const Music = {
  cue: null, step: 0, nextT: 0, timer: null,
  play(cue) { this.cue = cue; this.step = 0; if (Sound.ctx) this.nextT = Sound.ctx.currentTime + 0.1; if (!this.timer) this.timer = setInterval(() => this.tick(), 50); },
  stop() { this.cue = null; },
  tick() {
    const c = Sound.ctx; if (!c || !this.cue || Sound.muted || document.hidden) { if (c) this.nextT = c.currentTime + 0.1; return; }
    const S = SCORE[this.cue]; const spb = 60 / S.bpm / 2;
    if (this.nextT < c.currentTime) this.nextT = c.currentTime + 0.05;
    while (this.nextT < c.currentTime + 0.25) { S.play(this.step, this.nextT - c.currentTime, spb); this.nextT += spb; this.step++; }
  },
};
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
function brass(n, d, delay, vol = 0.05) {
  Sound.tone(NOTE(n), d, { type: 'sawtooth', vol, delay, wet: 0.5, attack: 0.25 });
  Sound.tone(NOTE(n - 12), d, { type: 'triangle', vol: vol * 1.4, delay, wet: 0.5, attack: 0.3 });
}
function drum(delay, vol = 0.4, f = 70) { Sound.tone(f, 0.5, { vol, slide: 0.45, delay, wet: 0.5 }); Sound.noise(0.25, { vol: vol * 0.25, freq: 600, delay, wet: 0.5 }); }
const SCORE = {
  bay: { bpm: 60, play(i, d, spb) {
    const bar = Math.floor(i / 8) % 4, s = i % 8;
    if (s === 0) brass([38, 34, 36, 33][bar], spb * 7.5, d, 0.03);
    if (s === 0 || s === 5) drum(d, 0.16, 55);
  } },
  launch: { bpm: 100, play(i, d) { if (i % 2 === 0) drum(d, 0.35, 60); if (i % 8 === 0) brass(38, 2.2, d, 0.05); } },
  fall: { bpm: 132, play(i, d, spb) {
    const s = i % 16, bar = Math.floor(i / 16) % 4;
    if (s === 0 || s === 6 || s === 10) drum(d, 0.42, 62);
    if (s === 4 || s === 12) Sound.noise(0.18, { vol: 0.12, freq: 2200, type: 'bandpass', delay: d, wet: 0.3 });
    if (s % 2 === 0) Sound.noise(0.04, { vol: 0.03, freq: 8000, type: 'highpass', delay: d, wet: 0 });
    if (s === 0) brass([50, 46, 48, 45][bar], spb * 15, d, 0.035);
    const mel = [[62, 0], [65, 4], [69, 8], [67, 12]][Math.floor(s / 4)];
    if (s % 4 === 0 && bar % 2 === 1) Sound.tone(NOTE(mel[0]), spb * 3.6, { type: 'square', vol: 0.018, delay: d, wet: 0.5, attack: 0.05 });
  } },
  end: { bpm: 56, play(i, d, spb) { const s = i % 8, bar = Math.floor(i / 8) % 4; if (s === 0) { brass([50, 53, 57, 55][bar], spb * 7.8, d, 0.04); brass([38, 41, 45, 43][bar], spb * 7.8, d, 0.03); } } },
};

// ------------------------------------------------------- shader helpers --
const GLSL_NOISE = `
  float hash3(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
  float vnoise(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x), mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x), mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y), f.z); }
  float fbm(vec3 p){ float a = 0.5, s = 0.0; for(int i=0;i<6;i++){ s += a*vnoise(p); p = p*2.03 + 1.7; a *= 0.5; } return s; }
  float fbm3(vec3 p){ float a = 0.5, s = 0.0; for(int i=0;i<3;i++){ s += a*vnoise(p); p = p*2.07 + 3.1; a *= 0.5; } return s; }
`;

// Canvas textures (value noise on the CPU, done once at load)
function cnoise(seed) {
  const P = new Uint8Array(512); const r = (() => { let a = seed; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
  const g = new Float32Array(256); for (let i = 0; i < 256; i++) { P[i] = i; g[i] = r(); }
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [P[i], P[j]] = [P[j], P[i]]; }
  for (let i = 0; i < 256; i++) P[i + 256] = P[i];
  const n2 = (x, y) => { const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255, xf = x - Math.floor(x), yf = y - Math.floor(y); const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = g[P[P[xi] + yi]], b = g[P[P[xi + 1] + yi]], c = g[P[P[xi] + yi + 1]], d = g[P[P[xi + 1] + yi + 1]]; return lerp(lerp(a, b, u), lerp(c, d, u), v); };
  return (x, y, oct = 5) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += a * n2(x * f, y * f); f *= 2; a *= 0.5; } return s; };
}
function canvasTex(w, h, draw, { srgb = true, repeat = 1 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.encoding = THREE.sRGBEncoding;
  t.anisotropy = 8; if (repeat !== 1) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  return t;
}
// soft round sprite for haze, sparks and stars
const softDot = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }, { srgb: false });
// fireball / smoke puff with ragged edges
function puffTex(seed, hot) {
  const nz = cnoise(seed);
  return canvasTex(128, 128, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (x - 64) / 64, dy = (y - 64) / 64, r = Math.sqrt(dx * dx + dy * dy);
      const n = nz(x / 22, y / 22, 5);
      const a = clamp((1 - r * 1.15) + (n - 0.5) * 0.9, 0, 1);
      const i = (y * w + x) * 4;
      if (hot) { const k = clamp(1 - r * 1.3 + n * 0.4, 0, 1); img.data[i] = 255; img.data[i + 1] = 120 + 135 * k; img.data[i + 2] = 40 + 200 * k * k; }
      else { const v = 90 + n * 90; img.data[i] = v; img.data[i + 1] = v * 0.92; img.data[i + 2] = v * 0.86; }
      img.data[i + 3] = Math.pow(a, 1.4) * 255;
    }
    g.putImageData(img, 0, 0);
  }, { srgb: false });
}
const fireTex = puffTex(11, true), smokeTex = puffTex(29, false);
