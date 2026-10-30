// ---------------------------------------------------------------------------
// Chapter III: The War of Houses. Top-down conquest of the Institute.
// ---------------------------------------------------------------------------
const TS = 32, MW = 72, MH = 52;
const IT = { GRASS: 0, FOREST: 1, WATER: 2, MOUNT: 3, WALL: 4, BRIDGE: 5, FLOOR: 6, ROAD: 7, GATE: 8 };
const ISOLID = [false, false, true, true, true, false, false, false, true];
const HOUSES = {
  mars: { name: 'Mars', color: '#c0262d', cx: 12, cy: 40, gate: 'n' },
  minerva: { name: 'Minerva', color: '#3d6fd6', cx: 12, cy: 11, gate: 's' },
  ceres: { name: 'Ceres', color: '#d9b23a', cx: 38, cy: 42, gate: 'n' },
  diana: { name: 'Diana', color: '#3f9b4a', cx: 61, cy: 38, gate: 'w' },
  jupiter: { name: 'Jupiter', color: '#8c4fd1', cx: 60, cy: 11, gate: 's' },
  olympus: { name: 'Olympus', color: '#f0ead8', cx: 36, cy: 9, gate: 's' },
};
const ALLY_DEFS = [
  { name: 'Sevro', hp: 90, dmg: 14, cd: 0.5, speed: 190, r: 10, color: '#8e1a1e', trim: '#4a3a2a' },
  { name: 'Pax', hp: 220, dmg: 16, cd: 1.0, speed: 140, r: 15, color: '#c0262d', trim: '#e0b552' },
  { name: 'Quinn', hp: 75, dmg: 10, cd: 0.75, speed: 165, r: 11, color: '#c0262d', trim: '#e8e2d0' },
  { name: 'Roque', hp: 75, dmg: 10, cd: 0.8, speed: 160, r: 11, color: '#c0262d', trim: '#9fb7c9' },
];

class InstituteScene {
  constructor() {
    this.pausable = true;
    this.parts = new Particles(); this.floats = new Floaters();
    this.units = []; this.effects = []; this.banners = [];
    this.time = 0; this.huntT = 70; this.winter = false; this.state = 'play'; this.stT = 0; this.deadT = 0;
    this.flow = new Int16Array(MW * MH); this.flowT = 0; this.shake = 0;
    this.buildMap();
    this.renderTerrain();
    this.spawn();
    this.cam = { x: this.player.x - W / 2, y: this.player.y - H / 2 };
    this.snow = Array.from({ length: 140 }, () => ({ x: rand(0, W), y: rand(0, H), v: rand(30, 80), s: rand(1, 3) }));
  }
  enter() { AudioSys.drone('institute'); setButtons('Strike', 'Dash'); }

  // ------------------------------------------------------------------ map --
  tget(x, y) { if (x < 0 || y < 0 || x >= MW || y >= MH) return IT.MOUNT; return this.g[y * MW + x]; }
  tset(x, y, t) { if (x < 0 || y < 0 || x >= MW || y >= MH) return; this.g[y * MW + x] = t; }
  solidAt(px, py) { return ISOLID[this.tget(Math.floor(px / TS), Math.floor(py / TS))]; }

  buildMap() {
    const g = this.g = new Uint8Array(MW * MH);
    const rng = mulberry32(1847);
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      let n = Math.sin(x * 0.35) * Math.cos(y * 0.3) + Math.sin(x * 0.13 + y * 0.21 + 1.7) * 0.8 + Math.sin(x * 0.7 + y * 0.9) * 0.3;
      const thr = x > 52 && y > 26 ? 0.25 : 1.05;
      g[y * MW + x] = n > thr ? IT.FOREST : IT.GRASS;
    }
    const river = (base, freq, ph, bridges) => {
      for (let y = 0; y < MH; y++) {
        const x0 = base + Math.round(Math.sin(y * freq + ph) * 2);
        const isBridge = bridges.some((b) => y === b || y === b + 1);
        for (let x = x0 - (isBridge ? 1 : 0); x <= x0 + (isBridge ? 2 : 1); x++) this.tset(x, y, isBridge ? IT.BRIDGE : IT.WATER);
      }
    };
    river(24, 0.25, 0, [8, 25, 41]);
    river(49, 0.2, 1, [13, 27, 40]);
    for (let y = 22; y <= 34; y++) for (let x = 30; x <= 42; x++) if (((x - 36) / 4.2) ** 2 + ((y - 28) / 3.2) ** 2 <= 1) this.tset(x, y, IT.WATER);
    for (const [cx, cy, r] of [[19, 22, 2.2], [30, 38, 1.8], [56, 22, 2.4], [44, 47, 1.6], [6, 26, 2.2], [67, 25, 2], [28, 48, 1.5], [16, 31, 1.4], [43, 20, 1.5]]) {
      for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if (Math.hypot(x - cx, y - cy) <= r + rng() * 0.6) this.tset(x, y, IT.MOUNT);
    }
    // Olympus sits in a mountain massif with one pass
    for (let y = 0; y < 20; y++) for (let x = 25; x < 48; x++) if (((x - 36) / 10.5) ** 2 + ((y - 9) / 8.5) ** 2 <= 1 + rng() * 0.08) this.tset(x, y, IT.MOUNT);
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (x < 2 || y < 2 || x >= MW - 2 || y >= MH - 2) this.tset(x, y, IT.MOUNT);
    this.castles = [];
    for (const id of Object.keys(HOUSES)) {
      const h = HOUSES[id];
      if (id !== 'olympus') {
        for (let y = h.cy - 7; y <= h.cy + 7; y++) for (let x = h.cx - 7; x <= h.cx + 7; x++) {
          if (x < 2 || y < 2 || x >= MW - 2 || y >= MH - 2) continue;
          if (Math.hypot(x - h.cx, y - h.cy) <= 7.2) this.tset(x, y, Math.hypot(x - h.cx, y - h.cy) > 6 && rng() < 0.4 ? IT.ROAD : IT.GRASS);
        }
      }
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) this.tset(h.cx + dx, h.cy + dy, Math.abs(dx) === 4 || Math.abs(dy) === 4 ? IT.WALL : IT.FLOOR);
      const gateT = id === 'olympus' ? IT.GATE : IT.FLOOR;
      for (let k = -1; k <= 1; k++) {
        if (h.gate === 'n') { this.tset(h.cx + k, h.cy - 4, gateT); this.tset(h.cx + k, h.cy - 5, IT.ROAD); }
        if (h.gate === 's') { this.tset(h.cx + k, h.cy + 4, gateT); this.tset(h.cx + k, h.cy + 5, IT.ROAD); }
        if (h.gate === 'w') { this.tset(h.cx - 4, h.cy + k, gateT); this.tset(h.cx - 5, h.cy + k, IT.ROAD); }
        if (h.gate === 'e') { this.tset(h.cx + 4, h.cy + k, gateT); this.tset(h.cx + 5, h.cy + k, IT.ROAD); }
      }
      this.castles.push({ id, h, x: h.cx * TS + TS / 2, y: h.cy * TS + TS / 2, owner: id, prog: 0, flagPh: rng() * 6 });
    }
    for (let y = 14; y <= 21; y++) for (let x = 35; x <= 37; x++) this.tset(x, y, IT.ROAD);
    this.olympusOpen = false;
  }

  renderTerrain() {
    const c = this.tc = document.createElement('canvas');
    c.width = MW * TS; c.height = MH * TS;
    const g = c.getContext('2d');
    const rng = mulberry32(99);
    const grassCol = () => `hsl(${78 + rng() * 14},${24 + rng() * 8}%,${26 + rng() * 5}%)`;
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) this.paintTile(g, x, y, rng, grassCol);
    const m = this.mini = document.createElement('canvas');
    m.width = MW * 2; m.height = MH * 2;
    const mg = m.getContext('2d');
    const MC = ['#556a34', '#2f4a22', '#2b4f73', '#6a5d52', '#9a948a', '#7a5532', '#8b8170', '#7b6a4a', '#9a948a'];
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { mg.fillStyle = MC[this.g[y * MW + x]]; mg.fillRect(x * 2, y * 2, 2, 2); }
  }
  paintTile(g, x, y, rng, grassCol) {
    rng = rng || Math.random; grassCol = grassCol || (() => '#56683a');
    const t = this.g[y * MW + x], px = x * TS, py = y * TS;
    switch (t) {
      case IT.GRASS:
        g.fillStyle = grassCol(); g.fillRect(px, py, TS, TS);
        g.fillStyle = 'rgba(30,40,10,.35)';
        for (let k = 0; k < 3; k++) g.fillRect(px + rng() * 28, py + rng() * 28, 2, 4);
        if (rng() < 0.05) { g.fillStyle = '#c0262d'; g.fillRect(px + rng() * 26 + 2, py + rng() * 26 + 2, 3, 3); }
        break;
      case IT.FOREST:
        g.fillStyle = '#34461f'; g.fillRect(px, py, TS, TS);
        for (let k = 0; k < 3; k++) {
          const tx = px + 6 + rng() * 20, ty = py + 6 + rng() * 20, r = 7 + rng() * 5;
          g.fillStyle = '#1e2c14'; g.beginPath(); g.arc(tx + 2, ty + 3, r, 0, TAU); g.fill();
          g.fillStyle = rng() < 0.5 ? '#2c4420' : '#36502a'; g.beginPath(); g.arc(tx, ty, r, 0, TAU); g.fill();
          g.fillStyle = 'rgba(160,200,110,.15)'; g.beginPath(); g.arc(tx - 2, ty - 3, r * 0.5, 0, TAU); g.fill();
        }
        break;
      case IT.WATER:
        g.fillStyle = '#2b4f73'; g.fillRect(px, py, TS, TS);
        g.strokeStyle = 'rgba(160,200,230,.25)'; g.lineWidth = 1.5;
        g.beginPath(); const wy = py + 8 + rng() * 16; g.moveTo(px + 4, wy); g.quadraticCurveTo(px + 16, wy - 4, px + 28, wy); g.stroke();
        break;
      case IT.MOUNT: {
        g.fillStyle = '#4e443e'; g.fillRect(px, py, TS, TS);
        g.fillStyle = '#6e6058'; g.beginPath(); g.moveTo(px + 2, py + TS); g.lineTo(px + 14 + rng() * 6, py + 2 + rng() * 6); g.lineTo(px + TS - 2, py + TS); g.fill();
        g.fillStyle = '#3a322d'; g.beginPath(); g.moveTo(px + 18, py + 8); g.lineTo(px + TS - 2, py + TS); g.lineTo(px + 18, py + TS); g.fill();
        if (y < 14 && x > 24 && x < 48) { g.fillStyle = '#e8e8ec'; g.beginPath(); g.moveTo(px + 12, py + 9); g.lineTo(px + 17, py + 3); g.lineTo(px + 22, py + 10); g.fill(); }
        break;
      }
      case IT.WALL:
        g.fillStyle = '#7d776e'; g.fillRect(px, py, TS, TS);
        g.strokeStyle = '#5d5850'; g.lineWidth = 1;
        for (let r = 0; r < 4; r++) { g.beginPath(); g.moveTo(px, py + r * 8); g.lineTo(px + TS, py + r * 8); g.stroke(); for (let k = (r % 2) * 8; k < TS; k += 16) { g.beginPath(); g.moveTo(px + k, py + r * 8); g.lineTo(px + k, py + r * 8 + 8); g.stroke(); } }
        g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(px, py, TS, 3);
        g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(px, py + TS - 4, TS, 4);
        break;
      case IT.FLOOR:
        g.fillStyle = '#8b8170'; g.fillRect(px, py, TS, TS);
        g.strokeStyle = '#766d5e'; g.strokeRect(px + 0.5, py + 0.5, 16, 16); g.strokeRect(px + 16.5, py + 16.5, 15, 15);
        break;
      case IT.BRIDGE:
        g.fillStyle = '#2b4f73'; g.fillRect(px, py, TS, TS);
        g.fillStyle = '#7a5532'; g.fillRect(px, py + 1, TS, TS - 2);
        g.strokeStyle = '#5a3d22'; for (let k = 4; k < TS; k += 7) { g.beginPath(); g.moveTo(px + k, py); g.lineTo(px + k, py + TS); g.stroke(); }
        break;
      case IT.ROAD:
        g.fillStyle = '#7b6a4a'; g.fillRect(px, py, TS, TS);
        g.fillStyle = 'rgba(0,0,0,.12)'; for (let k = 0; k < 4; k++) g.fillRect(px + rng() * 28, py + rng() * 28, 3, 2);
        break;
      case IT.GATE:
        g.fillStyle = '#8b8170'; g.fillRect(px, py, TS, TS);
        g.fillStyle = '#2a2a2e'; for (let k = 3; k < TS; k += 7) g.fillRect(px + k, py, 3, TS);
        g.fillRect(px, py + 6, TS, 3); g.fillRect(px, py + 22, TS, 3);
        break;
    }
  }
  openOlympus() {
    this.olympusOpen = true;
    const g = this.tc.getContext('2d'), mg = this.mini.getContext('2d');
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (this.g[y * MW + x] === IT.GATE) {
      this.g[y * MW + x] = IT.FLOOR; this.paintTile(g, x, y); mg.fillStyle = '#8b8170'; mg.fillRect(x * 2, y * 2, 2, 2);
    }
    this.banner('THE GATES OF OLYMPUS OPEN', 'The Proctors are waiting. Take their standard.');
    sfx.horn();
  }

  // ---------------------------------------------------------------- units --
  mk(o) {
    const u = Object.assign({
      x: 0, y: 0, r: 11, hp: 40, dmg: 7, cd: 1, atkCD: Math.random(), speed: 110, team: 'x', origin: 'x', kind: 'soldier', name: null,
      home: null, role: 'defender', target: null, tgtT: Math.random() * 0.4, swing: 0, face: Math.random() * TAU, downT: 0, hurtT: 0,
      stuckT: 0, detour: 0, detourA: 0, lastX: 0, lastY: 0, leash: 360, aggro: 190, alive: true, kbx: 0, kby: 0, inv: 0, wander: null, wanderT: 0, color: '#888', trim: '#444',
    }, o);
    u.maxHp = u.hp; u.lastX = u.x; u.lastY = u.y;
    this.units.push(u); return u;
  }
  freeSpot(cx, cy, spread) {
    for (let k = 0; k < 40; k++) {
      const x = cx + rand(-spread, spread), y = cy + rand(-spread, spread);
      if (!this.solidAt(x, y) && !this.solidAt(x + 12, y) && !this.solidAt(x - 12, y) && !this.solidAt(x, y + 12) && !this.solidAt(x, y - 12)) return [x, y];
    }
    return [cx, cy];
  }
  spawn() {
    const mars = this.castles.find((c) => c.id === 'mars');
    this.player = this.mk({ x: mars.x, y: mars.y + 50, r: 13, hp: 150, dmg: 26, speed: 180, team: 'mars', origin: 'mars', kind: 'player', name: 'Darrow', role: 'player', color: '#c0262d', trim: '#e0b552', dashCD: 0, dashT: 0, swingT: 0 });
    for (const d of ALLY_DEFS) {
      const [x, y] = this.freeSpot(mars.x, mars.y + 30, 60);
      this.mk(Object.assign({ x, y, team: 'mars', origin: 'mars', kind: 'ally', role: 'squad', named: true, aggro: 180 }, d));
    }
    for (let k = 0; k < 2; k++) { const [x, y] = this.freeSpot(mars.x, mars.y, 60); this.mk({ x, y, hp: 60, dmg: 9, cd: 0.9, speed: 150, team: 'mars', origin: 'mars', kind: 'ally', role: 'squad', color: '#c0262d', trim: '#7a1a1a', aggro: 180 }); }
    const tiers = { minerva: 1, ceres: 0, diana: 1.4, jupiter: 2 };
    for (const c of this.castles) {
      if (c.id === 'mars') continue;
      const h = c.h;
      if (c.id === 'olympus') {
        for (let k = 0; k < 5; k++) { const [x, y] = this.freeSpot(c.x, c.y + 30, 70); this.mk({ x, y, home: { x, y }, hp: 100, dmg: 12, cd: 0.9, speed: 120, team: 'olympus', origin: 'olympus', kind: 'guard', aggro: 260, leash: 300, color: '#f0ead8', trim: '#e0b552' }); }
        this.boss = this.mk({ x: c.x, y: c.y - 20, home: { x: c.x, y: c.y }, r: 22, hp: 1300, dmg: 20, cd: 1.2, speed: 105, team: 'olympus', origin: 'olympus', kind: 'boss', name: 'Proctor Apollo', aggro: 300, leash: 260, color: '#f6e7b8', trim: '#e0b552', bState: 'idle', bT: 0, specialCD: 4, z: 0 });
        continue;
      }
      const tier = tiers[c.id];
      const cap = this.mk({ x: c.x, y: c.y + 20, home: { x: c.x, y: c.y + 20 }, r: 14, hp: 120 + tier * 40, dmg: 12 + tier * 2, cd: 0.9, speed: 118, team: c.id, origin: c.id, kind: 'captain', name: `Primus of ${h.name}`, aggro: 240, leash: 320, color: h.color, trim: '#e0b552' });
      cap.home = { x: cap.x, y: cap.y };
      for (let k = 0; k < 4 + Math.floor(tier); k++) { const [x, y] = this.freeSpot(c.x, c.y, 70); this.mk({ x, y, home: { x, y }, hp: 40 + tier * 10, dmg: 7 + tier * 1.5, team: c.id, origin: c.id, color: h.color, trim: '#2a2a2a' }); }
      for (let k = 0; k < 3; k++) { const [x, y] = this.freeSpot(c.x, c.y, 230); this.mk({ x, y, home: { x: c.x, y: c.y }, role: 'roamer', leash: 460, hp: 40 + tier * 10, dmg: 7 + tier * 1.5, team: c.id, origin: c.id, color: h.color, trim: '#2a2a2a' }); }
    }
  }
  hostile(a, b) { return a.team !== b.team && b.team !== 'neutral' && a.team !== 'neutral'; }
  active(u) { return u.alive && u.downT <= 0 && !u.yielded; }

  banner(title, sub) { this.banners.push({ title, sub, t: 3.4 }); }

  // --------------------------------------------------------------- update --
  update(dt) {
    this.time += dt; this.stT += dt;
    this.parts.update(dt); this.floats.update(dt);
    this.shake = Math.max(0, this.shake - dt * 30);
    if (this.banners.length) { this.banners[0].t -= dt; if (this.banners[0].t <= 0) this.banners.shift(); }
    for (const s of this.snow) { s.y += s.v * dt; s.x += Math.sin(this.time + s.v) * 12 * dt; if (s.y > H) { s.y = -4; s.x = rand(0, W); } }
    if (this.state === 'won') { this.updateCam(dt); if (this.stT > 3.5) chapterWon(3); return; }
    if (this.state === 'dead') {
      this.deadT -= dt; this.updateCam(dt);
      if (this.deadT <= 0) this.respawn();
      return;
    }
    this.flowT -= dt; if (this.flowT <= 0) { this.computeFlow(); this.flowT = 0.35; }
    this.updatePlayer(dt);
    this.assignSquad();
    for (const u of this.units) if (u !== this.player) this.updateUnit(u, dt);
    this.separate();
    this.updateEffects(dt);
    this.updateCastles(dt);
    this.updateHunts(dt);
    this.units = this.units.filter((u) => u.alive);
    this.updateCam(dt);
  }
  updateCam(dt) {
    const tx = clamp(this.player.x - W / 2, 0, MW * TS - W), ty = clamp(this.player.y - H / 2, 0, MH * TS - H);
    this.cam.x = lerp(this.cam.x, tx, Math.min(1, dt * 8)); this.cam.y = lerp(this.cam.y, ty, Math.min(1, dt * 8));
  }

  terrainMul(x, y) { const t = this.tget(Math.floor(x / TS), Math.floor(y / TS)); return t === IT.FOREST ? 0.72 : t === IT.ROAD ? 1.1 : 1; }

  updatePlayer(dt) {
    const p = this.player;
    p.dashCD -= dt; p.atkCD -= dt; p.inv -= dt; p.hurtT -= dt; p.swingT -= dt;
    let ax = I.ax(), ay = I.ay();
    const m = Math.hypot(ax, ay); if (m > 1) { ax /= m; ay /= m; }
    if (m > 0.15) p.face = Math.atan2(ay, ax);
    if (I.pressed('b') && p.dashCD <= 0) {
      p.dashT = 0.17; p.dashCD = 0.75; p.inv = 0.24; p.dashA = m > 0.15 ? Math.atan2(ay, ax) : p.face; sfx.whoosh();
    }
    if (p.dashT > 0) {
      p.dashT -= dt; this.moveCircle(p, Math.cos(p.dashA) * 560 * dt, Math.sin(p.dashA) * 560 * dt);
      this.parts.add(p.x, p.y, 0, 0, 0.3, 'rgba(192,38,45,.5)', 10);
    } else if (m > 0.1) {
      const sp = p.speed * this.terrainMul(p.x, p.y);
      this.moveCircle(p, ax * sp * dt, ay * sp * dt);
    }
    this.applyKnock(p, dt);
    if (I.down('a') && p.atkCD <= 0) {
      p.atkCD = 0.32; p.swingT = 0.18; sfx.slash();
      this.effects.push({ type: 'slash', x: p.x, y: p.y, a: p.face, t: 0.18 });
      for (const u of this.units) {
        if (!this.hostile(p, u) || !this.active(u)) continue;
        const d = dist(p.x, p.y, u.x, u.y);
        if (d < 64 + u.r && Math.abs(angDiff(Math.atan2(u.y - p.y, u.x - p.x), p.face)) < 1.15) this.damage(u, p.dmg, p);
      }
    }
    // regeneration: fast in owned castles, slow out of combat
    const inCastle = this.castles.some((c) => c.owner === 'mars' && Math.abs(p.x - c.x) < 4 * TS && Math.abs(p.y - c.y) < 4 * TS);
    p.calm = (p.calm || 0) + dt;
    if (inCastle) p.hp = Math.min(p.maxHp, p.hp + 22 * dt);
    else if (p.calm > 4) p.hp = Math.min(p.maxHp, p.hp + 4 * dt);
  }

  damage(u, amt, src) {
    if (u.inv > 0 || !this.active(u) || (u.kind === 'boss' && u.z > 4)) return;
    u.hp -= amt; u.hurtT = 0.15;
    if (u === this.player) { u.calm = 0; this.shake = Math.max(this.shake, 5); sfx.hurt(); }
    else if (src === this.player) sfx.hit();
    if (src) { const a = Math.atan2(u.y - src.y, u.x - src.x), kb = u.kind === 'boss' ? 40 : 170; u.kbx += Math.cos(a) * kb; u.kby += Math.sin(a) * kb; }
    this.parts.burst(u.x, u.y, 6, ['#b0141c', '#e02a2a'], 120, 0.4, 3);
    if (u.kind === 'boss' || u === this.player) this.floats.add(u.x, u.y - 26, `-${Math.round(amt)}`, u === this.player ? '#ff4a3a' : '#f1e4cc', 15, 0.8);
    if (u.hp <= 0) this.kill(u);
  }
  kill(u) {
    if (u === this.player) { this.state = 'dead'; this.deadT = 3; u.hp = 0; sfx.hurt(); return; }
    if (u.kind === 'boss') {
      u.hp = 0; u.yielded = true; u.team = 'neutral'; u.z = 0; sfx.horn(); this.shake = 14;
      this.banner('APOLLO YIELDS', 'The Proctor kneels. Take the standard of Olympus.');
      return;
    }
    if (u.named && u.team === 'mars') { u.downT = 12; u.hp = 0; this.floats.add(u.x, u.y - 20, `${u.name} is down`, '#ff9a6a', 14, 1.6); return; }
    u.alive = false;
    this.parts.burst(u.x, u.y, 14, ['#6a0a0e', '#b0141c', u.color], 160, 0.6, 4);
  }
  respawn() {
    const mars = this.castles.find((c) => c.id === 'mars'), p = this.player;
    p.x = mars.x; p.y = mars.y + 20; p.hp = p.maxHp; p.inv = 2; this.state = 'play';
    let lost = 0;
    for (const u of this.units) {
      if (u.team !== 'mars' || u.role !== 'squad') continue;
      if (!u.named && Math.random() < 0.5) { u.alive = false; lost++; continue; }
      [u.x, u.y] = this.freeSpot(p.x, p.y, 60); u.downT = 0; u.hp = Math.max(u.hp, u.maxHp * 0.6);
    }
    this.cam = { x: clamp(p.x - W / 2, 0, MW * TS - W), y: clamp(p.y - H / 2, 0, MH * TS - H) };
    this.banner('THE REAPER RISES', lost ? `${lost} of your followers were lost.` : 'Your pack drags you home.');
  }

  assignSquad() {
    const p = this.player;
    const sq = this.units.filter((u) => u.role === 'squad' && u.alive);
    const behind = p.face + Math.PI;
    sq.forEach((u, i) => {
      const ring = i < 6 ? 0 : 1, idx = ring ? i - 6 : i, n = ring ? sq.length - 6 : Math.min(6, sq.length);
      const spread = ring ? 0.42 : 0.6, rad = ring ? 92 : 54;
      const a = behind + (idx - (n - 1) / 2) * spread;
      u.slot = { x: p.x + Math.cos(a) * rad, y: p.y + Math.sin(a) * rad };
    });
  }

  findTarget(u) {
    const p = this.player;
    let best = null, bd = u.hunter ? 99999 : u.aggro;
    if (u.hunter && this.active(p)) return p;
    for (const o of this.units) {
      if (!this.hostile(u, o) || !this.active(o)) continue;
      const d = dist(u.x, u.y, o.x, o.y);
      if (d >= bd) continue;
      if (u.role === 'squad' && dist(o.x, o.y, p.x, p.y) > 330) continue;
      if (u.home && dist(o.x, o.y, u.home.x, u.home.y) > u.leash + 60) continue;
      best = o; bd = d;
    }
    return best;
  }

  updateUnit(u, dt) {
    if (!u.alive) return;
    if (u.downT > 0) { u.downT -= dt; if (u.downT <= 0) { u.hp = u.maxHp * 0.5; this.floats.add(u.x, u.y - 20, `${u.name} rises`, '#e0b552', 14); } return; }
    if (u.yielded) return;
    u.atkCD -= dt; u.hurtT -= dt; u.inv -= dt;
    this.applyKnock(u, dt);
    if (u.kind === 'boss') { this.updateBoss(u, dt); return; }
    if (u.team === 'mars' && u.hp < u.maxHp) {
      const inCastle = this.castles.some((c) => c.owner === 'mars' && Math.abs(u.x - c.x) < 4 * TS && Math.abs(u.y - c.y) < 4 * TS);
      if (inCastle) u.hp = Math.min(u.maxHp, u.hp + 15 * dt);
      else if (!u.target) u.hp = Math.min(u.maxHp, u.hp + 2 * dt);
    }
    if (u.swing > 0) {
      u.swing -= dt;
      if (u.swing <= 0 && u.target && this.active(u.target) && dist(u.x, u.y, u.target.x, u.target.y) < u.r + u.target.r + 20) this.damage(u.target, u.dmg, u);
      return;
    }
    u.tgtT -= dt;
    if (u.tgtT <= 0 || (u.target && !this.active(u.target))) { u.tgtT = 0.3 + Math.random() * 0.2; u.target = this.findTarget(u); }
    // leash: defenders drop the chase when dragged too far from home
    if (u.target && u.home && !u.hunter && dist(u.x, u.y, u.home.x, u.home.y) > u.leash) u.target = null;
    if (u.role === 'squad' && dist(u.x, u.y, this.player.x, this.player.y) > 640) {
      [u.x, u.y] = this.freeSpot(this.player.x, this.player.y, 70); u.target = null;
    }
    if (u.target) {
      const t = u.target, d = dist(u.x, u.y, t.x, t.y);
      u.face = Math.atan2(t.y - u.y, t.x - u.x);
      if (d < u.r + t.r + 12) { if (u.atkCD <= 0) { u.swing = 0.22; u.atkCD = u.cd; } }
      else this.moveToward(u, t.x, t.y, 1, dt);
      return;
    }
    if (u.role === 'squad' && u.slot) {
      const d = dist(u.x, u.y, u.slot.x, u.slot.y);
      if (d > 14) this.moveToward(u, u.slot.x, u.slot.y, d > 120 ? 1.25 : clamp(d / 60, 0.4, 1.1), dt);
      return;
    }
    if (u.home) {
      u.wanderT -= dt;
      if (!u.wander || u.wanderT <= 0) {
        const rad = u.role === 'roamer' ? 240 : u.role === 'garrison' ? 80 : 50;
        const [x, y] = this.freeSpot(u.home.x, u.home.y, rad);
        u.wander = { x, y }; u.wanderT = rand(2, 5);
      }
      if (dist(u.x, u.y, u.wander.x, u.wander.y) > 8) this.moveToward(u, u.wander.x, u.wander.y, 0.45, dt);
    }
  }

  updateBoss(u, dt) {
    const p = this.player;
    u.bT += dt; u.specialCD -= dt;
    const phase2 = u.hp < u.maxHp * 0.5;
    if (!u.target || !this.active(u.target)) { u.target = this.findTarget(u); }
    if (!u.target) { if (dist(u.x, u.y, u.home.x, u.home.y) > 10) this.moveToward(u, u.home.x, u.home.y, 0.6, dt); return; }
    const t = u.target, d = dist(u.x, u.y, t.x, t.y);
    switch (u.bState) {
      case 'idle':
        u.face = Math.atan2(t.y - u.y, t.x - u.x);
        if (u.specialCD <= 0) {
          u.specialCD = phase2 ? 3.4 : 5;
          if (Math.random() < 0.5 || d < 120) { u.bState = 'pulseWind'; u.bT = 0; }
          else { u.bState = 'leapWind'; u.bT = 0; u.leapTo = { x: p.x, y: p.y }; u.leapFrom = { x: u.x, y: u.y }; }
          break;
        }
        if (d < u.r + t.r + 22) { if (u.atkCD <= 0) { u.bState = 'swing'; u.bT = 0; u.atkCD = u.cd; } }
        else this.moveToward(u, t.x, t.y, 1, dt);
        break;
      case 'swing':
        if (u.bT >= 0.5) {
          u.bState = 'idle';
          this.effects.push({ type: 'slash', x: u.x, y: u.y, a: u.face, t: 0.2, big: true });
          for (const o of this.units) if (this.hostile(u, o) && this.active(o) && dist(u.x, u.y, o.x, o.y) < 70 + o.r && Math.abs(angDiff(Math.atan2(o.y - u.y, o.x - u.x), u.face)) < 1.2) this.damage(o, u.dmg, u);
          sfx.slash();
        }
        break;
      case 'pulseWind':
        if (u.bT >= 0.9) { u.bState = 'idle'; this.effects.push({ type: 'wave', x: u.x, y: u.y, r: 20, max: 250, t: 0, hit: new Set(), src: u }); sfx.boom(); this.shake = 10; }
        break;
      case 'leapWind': {
        const k = clamp(u.bT / 1.0, 0, 1);
        u.z = Math.sin(k * Math.PI) * 140;
        u.x = lerp(u.leapFrom.x, u.leapTo.x, k); u.y = lerp(u.leapFrom.y, u.leapTo.y, k);
        if (k >= 1) {
          u.z = 0; u.bState = 'idle'; this.collide(u);
          this.effects.push({ type: 'ring', x: u.x, y: u.y, r: 90, t: 0.4 });
          for (const o of this.units) if (this.hostile(u, o) && this.active(o) && dist(u.x, u.y, o.x, o.y) < 90 + o.r) this.damage(o, 28, u);
          this.parts.burst(u.x, u.y, 30, ['#e6dcc8', '#a89a80'], 260, 0.6, 5);
          sfx.boom(); this.shake = 14;
        }
        break;
      }
    }
  }

  updateEffects(dt) {
    for (const e of this.effects) {
      if (e.type === 'wave') {
        e.t += dt; e.r = 20 + (e.max - 20) * clamp(e.t / 0.7, 0, 1);
        for (const o of this.units) {
          if (e.hit.has(o) || !this.hostile(e.src, o) || !this.active(o)) continue;
          if (Math.abs(dist(e.x, e.y, o.x, o.y) - e.r) < 18 + o.r) { e.hit.add(o); this.damage(o, 24, e.src); }
        }
        if (e.t >= 0.7) e.done = true;
      } else { e.t -= dt; if (e.t <= 0) e.done = true; }
    }
    this.effects = this.effects.filter((e) => !e.done);
  }

  updateCastles(dt) {
    const p = this.player;
    for (const c of this.castles) {
      if (c.owner === 'mars') continue;
      if (c.id === 'olympus' && (!this.olympusOpen || !this.boss.yielded)) { c.prog = 0; continue; }
      const near = dist(p.x, p.y, c.x, c.y) < 52;
      const contested = this.units.some((u) => this.hostile(p, u) && this.active(u) && dist(u.x, u.y, c.x, c.y) < 5 * TS);
      if (near && !contested) {
        c.prog += dt / 2.4;
        if (Math.random() < 0.3) this.parts.add(c.x + rand(-20, 20), c.y + rand(-10, 10), 0, -40, 0.6, '#e0b552', 3);
        if (c.prog >= 1) this.capture(c);
      } else c.prog = Math.max(0, c.prog - dt * 0.6);
      c.contested = near && contested;
    }
  }
  conquered() { return this.castles.filter((c) => c.owner === 'mars' && c.id !== 'mars' && c.id !== 'olympus').length; }
  capture(c) {
    c.owner = 'mars'; c.prog = 0;
    sfx.fanfare(); this.shake = 8;
    this.parts.burst(c.x, c.y, 50, ['#c0262d', '#e0b552', '#ffffff'], 260, 1.0, 4);
    if (c.id === 'olympus') { this.state = 'won'; this.stT = 0; this.banner('OLYMPUS FALLS', 'House Mars has taken the Institute.'); return; }
    let freed = 0;
    const squadCount = () => this.units.filter((u) => u.role === 'squad' && u.alive).length;
    for (const u of this.units) {
      if (u.team !== c.id || !u.alive) continue;
      freed++;
      u.team = 'mars'; u.hp = u.maxHp; u.target = null; u.hunter = false;
      if (squadCount() < 14) { u.role = 'squad'; u.home = null; }
      else { u.role = 'garrison'; u.home = { x: c.x, y: c.y }; u.leash = 300; }
    }
    let sub = `${freed} students freed. They choose to follow you.`;
    if (c.id === 'minerva') {
      const [x, y] = this.freeSpot(c.x, c.y, 40);
      this.mk({ x, y, name: 'Mustang', hp: 120, dmg: 14, cd: 0.6, speed: 175, r: 11, team: 'mars', origin: 'minerva', kind: 'ally', role: 'squad', named: true, aggro: 190, color: '#e0b552', trim: '#3d6fd6' });
      sub = 'Mustang joins House Mars, and Minerva\'s students follow her.';
    }
    if (c.id === 'ceres') {
      this.player.maxHp += 30; this.player.hp = this.player.maxHp;
      for (const u of this.units) if (u.team === 'mars') u.hp = u.maxHp;
      sub = 'Ceres\' granaries feed your army. Everyone is healed; Darrow grows stronger.';
    }
    this.banner(`HOUSE ${c.h.name.toUpperCase()} FALLS`, sub);
    const n = this.conquered();
    if (n === 2 && !this.winter) { this.winter = true; this.banner('WINTER COMES', 'Snow falls on the highlands. The Proctors grow nervous.'); }
    if (n >= 3 && !this.olympusOpen) this.openOlympus();
  }

  updateHunts(dt) {
    this.huntT -= dt;
    if (this.huntT > 0) return;
    this.huntT = 75;
    const open = this.castles.filter((c) => c.owner === c.id && c.id !== 'olympus' && c.id !== 'mars');
    if (!open.length) return;
    const c = pick(open);
    for (let k = 0; k < 3; k++) { const [x, y] = this.freeSpot(c.x, c.y, 60); this.mk({ x, y, hp: 45, dmg: 8, team: c.id, origin: c.id, role: 'hunter', hunter: true, speed: 125, color: c.h.color, trim: '#2a2a2a' }); }
    this.banner(`${c.h.name.toUpperCase()} SENDS A HUNTING PARTY`, 'Three of their students are tracking you.');
    sfx.horn();
  }

  // ------------------------------------------------------------ movement --
  applyKnock(u, dt) {
    if (Math.abs(u.kbx) + Math.abs(u.kby) < 1) { u.kbx = u.kby = 0; return; }
    this.moveCircle(u, u.kbx * dt, u.kby * dt);
    const k = Math.max(0, 1 - dt * 8); u.kbx *= k; u.kby *= k;
  }
  moveCircle(u, dx, dy) { u.x += dx; this.collide(u); u.y += dy; this.collide(u); }
  collide(u) {
    const r = u.r;
    u.x = clamp(u.x, r, MW * TS - r); u.y = clamp(u.y, r, MH * TS - r);
    const x0 = Math.floor((u.x - r) / TS), x1 = Math.floor((u.x + r) / TS), y0 = Math.floor((u.y - r) / TS), y1 = Math.floor((u.y + r) / TS);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (!ISOLID[this.tget(tx, ty)]) continue;
      const nx = clamp(u.x, tx * TS, tx * TS + TS), ny = clamp(u.y, ty * TS, ty * TS + TS);
      const dx = u.x - nx, dy = u.y - ny, d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      if (d2 === 0) { u.y = ty * TS - r; continue; }
      const d = Math.sqrt(d2), push = r - d;
      u.x += dx / d * push; u.y += dy / d * push;
    }
  }
  los(x0, y0, x1, y1) {
    const d = dist(x0, y0, x1, y1), n = Math.ceil(d / 14);
    for (let i = 1; i < n; i++) { const k = i / n; if (this.solidAt(lerp(x0, x1, k), lerp(y0, y1, k))) return false; }
    return true;
  }
  computeFlow() {
    const f = this.flow, p = this.player;
    f.fill(-1);
    const start = Math.floor(p.y / TS) * MW + Math.floor(p.x / TS);
    const q = new Int32Array(MW * MH); let qh = 0, qt = 0;
    q[qt++] = start; f[start] = 0;
    while (qh < qt) {
      const i = q[qh++], x = i % MW, y = (i / MW) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
        const j = ny * MW + nx; if (f[j] !== -1 || ISOLID[this.g[j]]) continue;
        f[j] = f[i] + 1; q[qt++] = j;
      }
    }
  }
  flowDir(x, y) {
    const tx = Math.floor(x / TS), ty = Math.floor(y / TS), here = this.flow[ty * MW + tx];
    if (here < 0) return null;
    let best = here, bx = 0, by = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = tx + dx, ny = ty + dy; if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
      if (dx && dy && (ISOLID[this.tget(tx + dx, ty)] || ISOLID[this.tget(tx, ty + dy)])) continue;
      const v = this.flow[ny * MW + nx];
      if (v >= 0 && v < best) { best = v; bx = dx; by = dy; }
    }
    if (!bx && !by) return null;
    return Math.atan2((ty + by) * TS + TS / 2 - y, (tx + bx) * TS + TS / 2 - x);
  }
  moveToward(u, gx, gy, mul, dt) {
    const p = this.player;
    let a = Math.atan2(gy - u.y, gx - u.x);
    if (dist(gx, gy, p.x, p.y) < 260 && dist(u.x, u.y, gx, gy) > 40 && !this.los(u.x, u.y, gx, gy)) {
      const fa = this.flowDir(u.x, u.y); if (fa !== null) a = fa;
    } else if (u.detour > 0) { u.detour -= dt; a += u.detourA; }
    const sp = u.speed * mul * this.terrainMul(u.x, u.y);
    this.moveCircle(u, Math.cos(a) * sp * dt, Math.sin(a) * sp * dt);
    if (!u.target) u.face = a;
    u.stuckT += dt;
    if (u.stuckT > 0.5) {
      if (dist(u.x, u.y, u.lastX, u.lastY) < sp * 0.5 * 0.25) { u.detour = 0.7; u.detourA = (Math.random() < 0.5 ? 1 : -1) * 1.4; }
      u.stuckT = 0; u.lastX = u.x; u.lastY = u.y;
    }
  }
  separate() {
    const U = this.units;
    for (let i = 0; i < U.length; i++) {
      const a = U[i]; if (!a.alive || a.downT > 0) continue;
      for (let j = i + 1; j < U.length; j++) {
        const b = U[j]; if (!b.alive || b.downT > 0) continue;
        const dx = b.x - a.x, dy = b.y - a.y, rr2 = a.r + b.r, d2 = dx * dx + dy * dy;
        if (d2 >= rr2 * rr2 || d2 === 0) continue;
        const d = Math.sqrt(d2), push = (rr2 - d) / 2, nx = dx / d, ny = dy / d;
        const wa = a.kind === 'boss' ? 0.1 : a === this.player ? 0.3 : 1, wb = b.kind === 'boss' ? 0.1 : b === this.player ? 0.3 : 1;
        a.x -= nx * push * wa; a.y -= ny * push * wa; b.x += nx * push * wb; b.y += ny * push * wb;
        this.collide(a); this.collide(b);
      }
    }
  }

  // --------------------------------------------------------------- render --
  objective() {
    const p = this.player;
    if (this.olympusOpen) return this.castles.find((c) => c.id === 'olympus');
    let best = null, bd = 1e9;
    for (const c of this.castles) {
      if (c.owner === 'mars' || c.id === 'olympus') continue;
      const d = dist(p.x, p.y, c.x, c.y); if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  draw() {
    const cx = Math.round(clamp(this.cam.x, 0, MW * TS - W)), cy = Math.round(clamp(this.cam.y, 0, MH * TS - H));
    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    ctx.save(); ctx.translate(sx, sy);
    ctx.drawImage(this.tc, cx, cy, W, H, 0, 0, W, H);
    ctx.translate(-cx, -cy);
    // water shimmer
    ctx.fillStyle = 'rgba(200,230,255,.08)';
    for (let k = 0; k < 30; k++) {
      const x = cx + ((k * 173 + this.time * 20) % W), y = cy + ((k * 97) % H);
      if (this.tget(Math.floor(x / TS), Math.floor(y / TS)) === IT.WATER) ctx.fillRect(x, y, 10, 2);
    }
    for (const c of this.castles) this.drawStandard(c);
    const vis = this.units.filter((u) => u.x > cx - 60 && u.x < cx + W + 60 && u.y > cy - 80 && u.y < cy + H + 60).sort((a, b) => a.y - b.y);
    for (const u of vis) this.drawUnit(u);
    for (const e of this.effects) this.drawEffect(e);
    const b = this.boss;
    if (b && b.bState === 'leapWind') {
      ctx.fillStyle = 'rgba(255,60,40,.15)'; ctx.strokeStyle = 'rgba(255,60,40,.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(b.leapTo.x, b.leapTo.y, 90 * clamp(b.bT, 0.2, 1), 0, TAU); ctx.fill(); ctx.stroke();
    }
    this.parts.draw(); this.floats.draw();
    ctx.restore();
    if (this.winter) {
      ctx.fillStyle = 'rgba(220,232,255,.13)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,.85)'; for (const s of this.snow) ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    if (this.player.hurtT > 0) { ctx.fillStyle = `rgba(200,20,20,${this.player.hurtT * 1.2})`; ctx.fillRect(0, 0, W, H); }
    this.drawArrow(cx, cy);
    this.drawHUD();
    drawChapterBanner(3, this.stT, 2.8);
    if (this.banners.length && this.stT > 2.8) {
      const b = this.banners[0], a = clamp(Math.min(b.t, 3.4 - b.t) * 3, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 96, W, 74);
      txt(b.title, W / 2, 132, { size: 30, weight: 800, align: 'center', color: '#e0b552', glow: 'rgba(192,38,45,.8)' });
      txt(b.sub, W / 2, 158, { size: 17, font: FB, weight: 400, align: 'center' });
      ctx.globalAlpha = 1;
    }
    if (this.state === 'dead') {
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, H);
      txt('THE REAPER FALLS', W / 2, H / 2, { size: 46, weight: 800, align: 'center', color: '#ff4a3a', glow: 'rgba(192,38,45,.8)' });
      txt('Your pack carries you back to the castle of Mars...', W / 2, H / 2 + 36, { size: 18, font: FB, align: 'center' });
    }
  }
  drawStandard(c) {
    const col = c.owner === 'mars' ? HOUSES.mars.color : c.h.color;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(c.x, c.y + 2, 14, 5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a2a1a'; ctx.fillRect(c.x - 2, c.y - 54, 4, 56);
    ctx.fillStyle = '#e0b552'; ctx.beginPath(); ctx.arc(c.x, c.y - 56, 4, 0, TAU); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(c.x + 2, c.y - 52);
    for (let k = 0; k <= 6; k++) ctx.lineTo(c.x + 2 + k * 5, c.y - 52 + Math.sin(this.time * 4 + k * 0.8 + c.flagPh) * 3);
    for (let k = 6; k >= 0; k--) ctx.lineTo(c.x + 2 + k * 5, c.y - 30 + Math.sin(this.time * 4 + k * 0.8 + c.flagPh) * 3);
    ctx.fill();
    txt((c.owner === 'mars' ? 'M' : c.h.name[0]), c.x + 17, c.y - 36, { size: 12, weight: 800, align: 'center', color: '#0a0505' });
    if (c.prog > 0) {
      ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(c.x, c.y - 20, 34, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#e0b552'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(c.x, c.y - 20, 34, -Math.PI / 2, -Math.PI / 2 + TAU * c.prog); ctx.stroke();
    }
    if (c.contested) txt('CLEAR THE DEFENDERS', c.x, c.y - 66, { size: 13, font: FH, weight: 700, align: 'center', color: '#ff6a5a', stroke: 'rgba(0,0,0,.8)', strokeW: 3 });
  }
  drawUnit(u) {
    const down = u.downT > 0;
    const z = u.z || 0;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(u.x, u.y + u.r * 0.7, u.r * (1 + z / 300), u.r * 0.45, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(u.x, u.y - z);
    if (down || u.yielded) { ctx.globalAlpha = 0.6; ctx.scale(1, 0.6); }
    if (u === this.player) {
      ctx.fillStyle = '#7a1214';
      ctx.beginPath(); ctx.moveTo(Math.cos(u.face + 2.5) * 10, Math.sin(u.face + 2.5) * 10); ctx.lineTo(Math.cos(u.face + Math.PI) * 26, Math.sin(u.face + Math.PI) * 26); ctx.lineTo(Math.cos(u.face - 2.5) * 10, Math.sin(u.face - 2.5) * 10); ctx.fill();
    }
    if (u.kind === 'boss' && (u.bState === 'pulseWind')) {
      ctx.strokeStyle = `rgba(255,220,140,${0.4 + 0.4 * Math.sin(this.time * 30)})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, u.r + 10 + u.bT * 20, 0, TAU); ctx.stroke();
    }
    ctx.fillStyle = u.hurtT > 0 ? '#ffffff' : u.team === 'mars' && u.origin !== 'mars' ? HOUSES.mars.color : u.color;
    ctx.beginPath(); ctx.arc(0, 0, u.r, 0, TAU); ctx.fill();
    ctx.fillStyle = u.team === 'mars' && u.origin !== 'mars' ? HOUSES[u.origin].color : u.trim;
    ctx.beginPath(); ctx.arc(0, 0, u.r * 0.55, 0, TAU); ctx.fill();
    if (u === this.player || u.kind === 'boss' || u.kind === 'captain') {
      ctx.fillStyle = '#e0b552'; ctx.beginPath(); ctx.arc(0, -u.r * 0.15, u.r * 0.42, Math.PI, 0); ctx.fill();
    }
    // weapon
    const a = u.face, sw = u === this.player ? u.swingT > 0 : u.swing > 0 || u.bState === 'swing';
    ctx.strokeStyle = u.kind === 'boss' ? '#ffe7a0' : '#dfe6ee'; ctx.lineWidth = u.kind === 'boss' ? 4 : 2.5;
    const ba = sw ? a + 0.9 : a - 0.6, L = u.r + (u.kind === 'boss' ? 22 : 14);
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * u.r * 0.7, Math.sin(a) * u.r * 0.7); ctx.lineTo(Math.cos(ba) * L, Math.sin(ba) * L); ctx.stroke();
    ctx.restore();
    if (u.name && !down && (u.kind !== 'soldier')) txt(u.name, u.x, u.y - u.r - 10 - z, { size: 12, font: FH, weight: 700, align: 'center', color: u.team === 'mars' ? '#f1e4cc' : '#ffb0a0', stroke: 'rgba(0,0,0,.7)', strokeW: 3 });
    if (down) txt(`${Math.ceil(u.downT)}`, u.x, u.y - 16, { size: 12, font: FH, align: 'center', color: '#ff9a6a' });
    if (u.hp < u.maxHp && u.kind !== 'boss' && !down && u !== this.player && !u.yielded) bar(u.x - 14, u.y - u.r - 7, 28, 3, u.hp / u.maxHp, u.team === 'mars' ? '#9dff9a' : '#ff4a3a', 'rgba(0,0,0,.6)', 'rgba(0,0,0,0)');
  }
  drawEffect(e) {
    if (e.type === 'slash') {
      const k = e.t / 0.18, R = e.big ? 74 : 62;
      ctx.strokeStyle = e.big ? `rgba(255,220,140,${k})` : `rgba(255,240,220,${k * 0.9})`; ctx.lineWidth = e.big ? 10 : 7;
      ctx.beginPath(); ctx.arc(e.x, e.y, R * 0.85, e.a - 1.1, e.a + 1.1); ctx.stroke();
    } else if (e.type === 'wave') {
      ctx.strokeStyle = `rgba(255,220,140,${1 - e.t / 0.7})`; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, TAU); ctx.stroke();
    } else if (e.type === 'ring') {
      ctx.strokeStyle = `rgba(230,220,200,${e.t / 0.4})`; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (1.3 - e.t), 0, TAU); ctx.stroke();
    }
  }
  drawArrow(cx, cy) {
    const o = this.objective(); if (!o) return;
    const sx = o.x - cx, sy = o.y - cy;
    if (sx > 30 && sx < W - 30 && sy > 30 && sy < H - 30) return;
    const a = Math.atan2(sy - H / 2, sx - W / 2);
    const ex = clamp(W / 2 + Math.cos(a) * 1000, 40, W - 40), ey = clamp(H / 2 + Math.sin(a) * 1000, 40, H - 40);
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
    ctx.fillStyle = `rgba(224,181,82,${0.7 + 0.3 * Math.sin(this.time * 5)})`;
    ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -12); ctx.lineTo(-4, 0); ctx.lineTo(-10, 12); ctx.fill();
    ctx.restore();
    txt(o.h.name, ex - Math.cos(a) * 30, ey - Math.sin(a) * 30 + 5, { size: 13, font: FH, weight: 700, align: 'center', color: '#e0b552', stroke: 'rgba(0,0,0,.8)', strokeW: 3 });
  }
  drawHUD() {
    const p = this.player;
    panel(12, 12, 290, 92);
    txt('DARROW · HOUSE MARS', 26, 34, { size: 15, weight: 800, color: '#e0b552' });
    bar(26, 42, 262, 11, p.hp / p.maxHp, '#c0262d');
    bar(26, 57, 80, 5, 1 - clamp(p.dashCD / 0.75, 0, 1), '#e0b552');
    const squad = this.units.filter((u) => u.role === 'squad' && u.alive).length;
    txt(`PACK ${squad}`, 288, 63, { size: 13, font: FH, weight: 700, align: 'right', color: 'rgba(241,228,204,.8)' });
    const n = this.conquered();
    const obj = this.olympusOpen ? (this.boss.yielded ? 'Take the standard of Olympus' : 'Storm Olympus. Defeat Proctor Apollo') : `Conquer Houses ${n} / 3`;
    txt(obj, 26, 90, { size: 16, font: FH, weight: 700, color: '#f1e4cc' });
    // minimap (top right, clear of the touch buttons)
    const mx = W - MW * 2 - 14, my = 12;
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(mx - 3, my - 3, MW * 2 + 6, MH * 2 + 6);
    ctx.drawImage(this.mini, mx, my);
    for (const c of this.castles) { ctx.fillStyle = c.owner === 'mars' ? '#c0262d' : c.h.color; ctx.fillRect(mx + c.x / TS * 2 - 4, my + c.y / TS * 2 - 4, 8, 8); ctx.strokeStyle = '#000'; ctx.strokeRect(mx + c.x / TS * 2 - 4, my + c.y / TS * 2 - 4, 8, 8); }
    for (const u of this.units) {
      if (!u.alive || u === p) continue;
      ctx.fillStyle = u.team === 'mars' ? '#ff9a8a' : u.team === 'neutral' ? '#888' : '#ffffff';
      ctx.fillRect(mx + u.x / TS * 2 - 1, my + u.y / TS * 2 - 1, 2, 2);
    }
    ctx.fillStyle = '#e0b552'; ctx.fillRect(mx + p.x / TS * 2 - 2, my + p.y / TS * 2 - 2, 4, 4);
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.strokeRect(mx + this.cam.x / TS * 2, my + this.cam.y / TS * 2, W / TS * 2, H / TS * 2);
    if (this.boss && this.olympusOpen && !this.boss.yielded && dist(p.x, p.y, this.boss.x, this.boss.y) < 600) {
      const b = this.boss;
      panel(W / 2 - 200, H - 52, 400, 40);
      txt('PROCTOR APOLLO', W / 2, H - 36, { size: 14, weight: 800, align: 'center', color: '#f6e7b8' });
      bar(W / 2 - 186, H - 28, 372, 8, b.hp / b.maxHp, '#f6e7b8');
    }
  }
}
