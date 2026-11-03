// ---------------------------------------------------------------------------
// UI, phase flow, boot
// ---------------------------------------------------------------------------
const UI = {
  subT: 0, warnT: 0,
  objective(title, sub) { const el = $('objective'); if (!title) { el.hidden = true; return; } el.hidden = false; el.innerHTML = `${title}<span>${sub || ''}</span>`; },
  prompt(text) { const el = $('prompt'); el.hidden = !text; if (text) el.textContent = text; },
  subtitle(text, dur = 2.5, big = false) {
    const el = $('subtitle'); if (!text) { el.hidden = true; return; }
    el.hidden = false; el.textContent = text; this.subT = dur;
    el.style.fontFamily = big ? 'Cinzel, Georgia, serif' : ''; el.style.fontSize = big ? 'clamp(34px,6vw,72px)' : ''; el.style.fontWeight = big ? '900' : '';
    el.style.color = big ? 'var(--gold)' : ''; el.style.letterSpacing = big ? '.12em' : ''; el.style.bottom = big ? '42%' : '';
  },
  dialogue(who, role, text) { const el = $('dialogue'); if (!who) { el.hidden = true; return; } el.hidden = false; el.querySelector('.who').innerHTML = `${who}<em>${role}</em>`; el.querySelector('.line').textContent = text; },
  dialogueText(t) { $('dialogue').querySelector('.line').textContent = t; },
  visor(on) { $('visor').hidden = !on; },
  count(s) { $('count').textContent = s; },
  letterbox(on) { $('letterbox').classList.toggle('off', !on); },
  hud(on) { $('hud').hidden = !on; },
  hudUpdate(o) {
    $('hpbar').style.width = o.hp + '%'; $('hpbar').style.background = o.hp < 35 ? '#ff4a3a' : '';
    $('boostbar').style.width = Math.round(o.boost * 100) + '%';
    $('altv').textContent = o.alt.toFixed(1) + ' km'; $('spd').textContent = o.ms.toLocaleString('en-US') + ' m/s';
    $('phase').textContent = o.phase;
    const t = $('target');
    if (o.tgt) { t.hidden = false; t.style.left = clamp(o.tgt.x, 30, innerWidth - 30) + 'px'; t.style.top = clamp(o.tgt.y, 60, innerHeight - 40) + 'px'; t.querySelector('b').textContent = `DROP ZONE · ${o.tgt.d} m`; }
    else t.hidden = true;
  },
  warn(text, dur) { const el = $('warn'); el.hidden = false; el.textContent = text; this.warnT = dur; },
  podTag(world, label) {
    const el = $('podtag'); if (!world) { el.hidden = true; return; }
    const v = world.clone().project(camera); if (v.z > 1) { el.hidden = true; return; }
    $('hud').hidden = false; el.hidden = false; el.textContent = label;
    el.style.left = (v.x * 0.5 + 0.5) * innerWidth + 'px'; el.style.top = (-v.y * 0.5 + 0.5) * innerHeight + 'px';
    for (const id of ['hp', 'alt', 'phase']) $(id).style.visibility = 'hidden';
  },
  end(win, s) {
    for (const id of ['hp', 'alt', 'phase']) $(id).style.visibility = '';
    $('end').hidden = false;
    $('end').querySelector('h2').textContent = win ? 'IRON RAIN' : 'SHELL BREACHED';
    $('endtext').textContent = win ? 'The Iron Rain falls on Mars. Where it lands, the chains come apart.' : 'The Rain falls on without you. Somewhere above, Sevro swears.';
    const cells = win
      ? [['Shell', s.hp + '%'], ['Pods beside you', s.allies + ' / 22'], ['From the drop zone', s.miss + ' m']]
      : [['Altitude reached', s.alt.toFixed(1) + ' km'], ['Pods still falling', s.allies + ' / 22']];
    $('stats').innerHTML = cells.map(([k, v]) => `<div><b>${v}</b>${k}</div>`).join('');
    $('again').focus();
  },
  update(dt) {
    if (this.subT > 0 && (this.subT -= dt) <= 0) $('subtitle').hidden = true;
    if (this.warnT > 0 && (this.warnT -= dt) <= 0) $('warn').hidden = true;
  },
};

const Fader = {
  k: 0, dir: 0, cb: null,
  to(cb) { if (this.dir === 1) return; this.cb = cb; this.dir = 1; },
  update(dt) {
    if (this.dir === 1) { this.k += dt * 2.2; if (this.k >= 1) { this.k = 1; this.dir = -1; const cb = this.cb; this.cb = null; cb && cb(); } }
    else if (this.dir === -1) { this.k -= dt * 1.6; if (this.k <= 0) { this.k = 0; this.dir = 0; } }
    post.fade.value = smooth(this.k);
  },
};

class TitlePhase {
  constructor(world) { this.w = world; this.t = 0; }
  enter() { renderPass.scene = this.w.scene; camera.fov = 45; camera.near = 0.5; camera.far = 400000; camera.updateProjectionMatrix(); bloom.strength = 1.0; post.vig.value = 0.75; this.w.updateRainLaunch(-10); Input.setTouch(false, false, false); }
  update(dt) {
    const t = (this.t += dt), a = 2.3 + t * 0.025;
    // frame the flagship against the curve of Mars below
    camera.position.set(Math.cos(a) * 420, 60 + Math.sin(t * 0.1) * 20, Math.sin(a) * 420);
    camera.lookAt(Math.cos(a + 0.4) * 120, -520, Math.sin(a + 0.4) * 120);
    this.w.fx.update(dt);
  }
}

const Game = {
  phase: null, skipReq: false,
  set(p, arg) { if (this.phase && this.phase.exit) this.phase.exit(); this.phase = p; p.enter(arg); },
  toBay() { Fader.to(() => { this.bay = new BayPhase(); renderer.compile(this.bay.scene, camera); this.set(this.bay); }); },
  toCinematic() { Fader.to(() => this.set(new CinematicPhase(this.world))); },
  toFall() { Fader.to(() => this.set(this.fall)); },
};

$('skip').addEventListener('click', (e) => { e.stopPropagation(); Game.skipReq = true; });
$('again').addEventListener('click', () => { $('end').hidden = true; Sound.unlock(); Fader.to(() => Game.set(Game.fall)); });
addEventListener('keydown', (e) => { if (!$('end').hidden && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); $('again').click(); } });

let last = performance.now(), capture = false, simTime = 0;
function step(dt, now, render = true) {
  Input.poll();
  if (Input.pressed('mute')) Sound.setMuted(!Sound.muted);
  Fader.update(dt);
  if (Game.phase) Game.phase.update(dt);
  UI.update(dt);
  post.time.value = now / 1000;
  if (render) composer.render(dt);
}
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!capture) step(dt, now);
  requestAnimationFrame(loop);
}

// Boot: build the fleet first so the title screen can orbit it, then the rest.
(function boot() {
  const bar = $('loadbar').firstElementChild, btn = $('begin');
  const steps = [
    () => { Game.world = new SpaceWorld(); Game.title = new TitlePhase(Game.world); Game.set(Game.title); },
    () => { renderer.compile(Game.world.scene, camera); },
    () => { Game.fall = new FallPhase(Game.world); },
    () => { renderer.compile(Game.world.scene, camera); },
  ];
  let i = 0;
  const next = () => {
    if (i < steps.length) { steps[i++](); bar.style.width = Math.round(i / steps.length * 100) + '%'; setTimeout(next, 30); return; }
    btn.disabled = false; btn.textContent = 'Enter the Bay';
    const h = location.hash.slice(1);
    if (h === 'fall' || h === 'launch') { $('title').hidden = true; if (h === 'fall') Game.set(Game.fall); else Game.set(new CinematicPhase(Game.world)); }
  };
  requestAnimationFrame(loop);
  setTimeout(next, 50);
  btn.addEventListener('click', () => { Sound.unlock(); $('title').hidden = true; Game.toBay(); });
})();
// Film capture: freeze the real-time loop and advance exactly one fixed step per call.
window.__ir = { Game, UI, Input, camera, renderer, bloom, post, THREE, capture(on) { capture = on; }, tick(dt, render = true) { simTime += dt; step(dt, simTime * 1000, render); } };
