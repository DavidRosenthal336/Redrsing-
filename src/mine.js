// ---------------------------------------------------------------------------
// Chapter I: The Helldiver. Pilot the clawDrill through the deep mine.
// ---------------------------------------------------------------------------
const MT = { EMPTY: 0, DIRT: 1, ROCK: 2, BASALT: 3, VEIN: 4, GAS: 5, BED: 6 };
const HARD = [0, 0.2, 0.42, 0.95, 0.35, 0.42, Infinity];

class MineScene {
  constructor() {
    this.pausable = true;
    this.T = 24; this.cols = 40; this.rows = 96;
    this.gen();
    const T = this.T;
    this.p = { gx: 20, gy: 2, x: 20 * T + T / 2, y: 2 * T + T / 2, face: [0, 1], prog: 0, heat: 0, hull: 100, over: 0, drilling: false, careful: false, hurtT: 0 };
    this.total = 170; this.timeLeft = this.total; this.he3 = 0; this.quota = 60;
    this.rivals = [
      { name: 'Gamma', v: 0, target: randi(92, 104) },
      { name: 'Upsilon', v: 0, target: randi(48, 58) },
      { name: 'Omega', v: 0, target: randi(30, 40) },
    ];
    this.parts = new Particles(); this.floats = new Floaters();
    this.shake = 0; this.cam = 0; this.time = 0;
    this.pending = []; this.flow = new Int16Array(this.cols * this.rows); this.flowAt = -1; this.flowT = 0;
    this.state = 'intro'; this.stT = 0;
    this.ping = { t: 99, cd: 0 }; this.crumbleCD = 0; this.maxDepth = 0;
  }
  enter() { AudioSys.drone('mine'); setButtons('Ping', 'Careful'); }

  idx(x, y) { return y * this.cols + x; }
  get(x, y) { if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return MT.BED; return this.g[y * this.cols + x]; }
  set(x, y, t) { if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return; this.g[y * this.cols + x] = t; }

  gen() {
    const C = this.cols, R = this.rows;
    const g = this.g = new Uint8Array(C * R);
    this.shade = new Float32Array(C * R).map(() => Math.random());
    this.rich = new Uint8Array(C * R);
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      let t;
      if (c === 0 || c === C - 1 || r === R - 1) t = MT.BED;
      else if (r < 4) t = MT.EMPTY;
      else {
        const d = r / R, n = Math.random();
        t = n < 0.58 - 0.45 * d ? MT.DIRT : n < 0.94 - 0.28 * d ? MT.ROCK : MT.BASALT;
      }
      g[r * C + c] = t;
    }
    // smooth the strata a little so it reads as layers instead of noise
    for (let k = 0; k < 2; k++) for (let r = 5; r < R - 1; r++) for (let c = 1; c < C - 1; c++) {
      if (Math.random() < 0.5) g[r * C + c] = g[r * C + c + (Math.random() < 0.5 ? -1 : 1)];
    }
    // veins: random walks, longer and richer the deeper they start
    for (let k = 0; k < 20; k++) {
      let r = Math.floor(9 + Math.pow(Math.random(), 0.75) * (R - 26)), c = randi(2, C - 3);
      const len = Math.floor(3 + (r / R) * 8 + Math.random() * 4);
      for (let s = 0; s < len; s++) {
        if (g[r * C + c] !== MT.BED) { g[r * C + c] = MT.VEIN; this.rich[r * C + c] = r / R > 0.55 ? 2 : 1; }
        if (Math.random() < 0.65) c += Math.random() < 0.5 ? -1 : 1; else r += Math.random() < 0.5 ? -1 : 1;
        c = clamp(c, 1, C - 2); r = clamp(r, 5, R - 2);
      }
    }
    // the mother vein: deep, rich, and ringed with gas
    const mc = randi(9, C - 10), mr = R - 15;
    this.mother = { c: mc, r: mr };
    for (let r = mr - 7; r <= mr + 7; r++) for (let c = mc - 8; c <= mc + 8; c++) {
      if (c < 1 || c > C - 2 || r < 5 || r > R - 2) continue;
      const d = Math.hypot((c - mc) / 1.4, r - mr);
      if (d < 3.1) { g[r * C + c] = MT.VEIN; this.rich[r * C + c] = 3; }
      else if (d < 5.2) g[r * C + c] = Math.random() < 0.42 ? MT.GAS : MT.BASALT;
    }
    // hidden gas pockets, thicker with depth and around veins
    for (let r = 12; r < R - 1; r++) for (let c = 1; c < C - 1; c++) {
      const i = r * C + c; if (g[i] === MT.VEIN || g[i] === MT.BED || g[i] === MT.GAS) continue;
      let p = 0.008 + 0.03 * (r / R);
      if (g[i - 1] === MT.VEIN || g[i + 1] === MT.VEIN || g[i - C] === MT.VEIN || g[i + C] === MT.VEIN) p += 0.07;
      if (Math.random() < p) g[i] = MT.GAS;
    }
    // caves, each a pitviper nest
    this.vipers = [];
    for (let k = 0; k < 10; k++) {
      const cr = randi(16, R - 22), cc = randi(4, C - 5), rx = rand(1.5, 3.8), ry = rand(0.8, 1.8);
      for (let r = Math.floor(cr - ry); r <= cr + ry; r++) for (let c = Math.floor(cc - rx); c <= cc + rx; c++) {
        if (c < 1 || c > C - 2 || r < 5 || r > R - 2) continue;
        if (((c - cc) / rx) ** 2 + ((r - cr) / ry) ** 2 <= 1 && g[r * C + c] !== MT.VEIN) g[r * C + c] = MT.EMPTY;
      }
      const n = cr / R > 0.45 ? 2 : 1;
      for (let j = 0; j < n; j++) this.addViper(cc + j, cr);
    }
    // a soft start below the shaft
    for (let c = 17; c <= 23; c++) for (let r = 4; r < 7; r++) if (g[r * C + c] !== MT.VEIN) g[r * C + c] = MT.DIRT;
  }
  addViper(gx, gy) {
    const T = this.T;
    this.vipers.push({ gx, gy, x: gx * T + T / 2, y: gy * T + T / 2, awake: false, stepT: rand(0, 0.3), biteT: 0.4, dig: 0, ph: Math.random() * TAU, trail: [] });
  }
  yieldAt(x, y) { return this.rich[this.idx(x, y)] || 1; }
  viperAt(x, y) { return this.vipers.find((v) => v.gx === x && v.gy === y); }

  update(dt) {
    this.time += dt; this.stT += dt;
    this.parts.update(dt); this.floats.update(dt);
    this.shake = Math.max(0, this.shake - dt * 30);
    if (this.state === 'intro') { if (this.stT > 2.6 || I.pressed('a')) { this.state = 'play'; this.stT = 0; } this.updateCam(dt); return; }
    if (this.state !== 'play') {
      AudioSys.drill(0);
      if (this.stT > 1.2) {
        if (this.state === 'won' && (I.pressed('a') || I.tap())) chapterWon(1, { he3: this.he3, gamma: Math.floor(this.rivals[0].v) });
        else if (this.state !== 'won' && (I.pressed('a') || I.tap())) go(new MineScene());
        else if (this.state !== 'won' && I.pressed('b')) go(new TitleScene());
      }
      return;
    }
    this.timeLeft -= dt;
    const prog = clamp(1 - this.timeLeft / this.total, 0, 1);
    for (const r of this.rivals) r.v = r.target * Math.pow(prog, 1.08) + Math.sin(this.time * 0.7 + r.target) * 0.6 * prog;

    this.updatePlayer(dt);
    this.updateVipers(dt);
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const e = this.pending[i]; e.t -= dt;
      if (e.t <= 0) { this.pending.splice(i, 1); this.explode(e.x, e.y); }
    }
    this.updateCam(dt);

    if (this.p.hull <= 0) { this.p.hull = 0; this.end('lost'); }
    else if (this.timeLeft <= 0) { this.timeLeft = 0; this.end(this.he3 >= this.quota ? 'won' : 'short'); }
  }
  end(state) {
    this.state = state; this.stT = 0; AudioSys.drill(0);
    if (state === 'won') { const gamma = Math.floor(this.rivals[0].v); this.rankIdx = Ranks.grade(this.he3, [160, 120, gamma + 1, 80]); this.newBest = Ranks.record(1, this.rankIdx); }
    if (state === 'won') sfx.fanfare(); else sfx.hurt();
  }
  updateCam(dt) {
    const target = clamp(this.p.y - H * 0.42, 0, this.rows * this.T - H);
    this.cam = lerp(this.cam, target, Math.min(1, dt * 6));
  }

  updatePlayer(dt) {
    const p = this.p, T = this.T;
    p.hurtT -= dt; this.crumbleCD -= dt; this.ping.t += dt; this.ping.cd -= dt;
    if (p.over > 0) { p.over -= dt; if (p.over <= 0) p.heat = 55; }
    if (I.pressed('a') && this.ping.cd <= 0) {
      this.ping.t = 0; this.ping.cd = 6; sfx.ping();
      this.floats.add(p.x, p.y - 20, 'SONAR', '#7fd8ff', 14);
    }
    const tx = p.gx * T + T / 2, ty = p.gy * T + T / 2;
    const sp = T * 9 * dt;
    const dx0 = tx - p.x, dy0 = ty - p.y, d0 = Math.hypot(dx0, dy0);
    if (d0 <= sp) { p.x = tx; p.y = ty; } else { p.x += dx0 / d0 * sp; p.y += dy0 / d0 * sp; }
    p.drilling = false;
    if (p.x === tx && p.y === ty) {
      const ax = I.ax(), ay = I.ay();
      let dx = 0, dy = 0;
      if (Math.abs(ax) > 0.35 || Math.abs(ay) > 0.35) { if (Math.abs(ax) > Math.abs(ay)) dx = Math.sign(ax); else dy = Math.sign(ay); }
      if (dx || dy) {
        if (p.face[0] !== dx || p.face[1] !== dy) p.prog = 0;
        p.face = [dx, dy];
        const nx = p.gx + dx, ny = p.gy + dy;
        const tile = this.get(nx, ny);
        const v = this.viperAt(nx, ny);
        if (v) this.killViper(v);
        else if (tile === MT.EMPTY) { p.gx = nx; p.gy = ny; p.prog = 0; }
        else if (tile !== MT.BED && p.over <= 0) {
          p.drilling = true; p.careful = I.down('b');
          p.prog += dt * (p.careful ? 0.42 : 1) / HARD[tile];
          p.heat += dt * (p.careful ? 8 : 17);
          if (Math.random() < 0.6) {
            const cx = p.x + dx * T * 0.55, cy = p.y + dy * T * 0.55;
            this.parts.add(cx, cy, rand(-60, 60) - dx * 40, rand(-60, 60) - dy * 40, 0.4, tile === MT.VEIN ? '#7fd8ff' : pick(['#7a4a30', '#5a3020', '#a06a44']), rand(2, 4), 120, 2);
          }
          if (p.prog >= 1) { this.breakTile(nx, ny, p.careful); p.prog = 0; }
          if (p.heat >= 100) { p.heat = 100; p.over = 2.4; sfx.overheat(); this.floats.add(p.x, p.y - 24, 'OVERHEAT', '#ff6a3a', 18); }
        }
      }
    }
    if (!p.drilling) p.heat = Math.max(0, p.heat - dt * (p.over > 0 ? 18 : 30));
    AudioSys.drill(p.drilling ? (p.careful ? 0.5 : 1) : 0);
    this.maxDepth = Math.max(this.maxDepth, p.gy);
  }

  breakTile(x, y, careful) {
    const T = this.T, t = this.get(x, y);
    const cx = x * T + T / 2, cy = y * T + T / 2;
    this.set(x, y, MT.EMPTY);
    if (t === MT.VEIN) {
      const amt = this.yieldAt(x, y);
      this.he3 += amt; sfx.gem();
      this.floats.add(cx, cy - 8, `+${amt} kg`, amt >= 3 ? '#e0b552' : '#7fd8ff', amt >= 3 ? 20 : 16);
      this.parts.burst(cx, cy, 14, ['#7fd8ff', '#c8f2ff', '#ffffff'], 140, 0.6, 3, 0, 2);
    } else if (t === MT.GAS) {
      if (careful) {
        sfx.hiss();
        this.floats.add(cx, cy - 8, 'GAS VENTED', '#9dff9a', 15);
        for (let i = 0; i < 24; i++) this.parts.add(cx, cy, rand(-40, 40), rand(-70, -10), rand(0.8, 1.6), 'rgba(160,255,150,.5)', rand(3, 7), -10, 1);
      } else this.explode(x, y);
    } else {
      if (this.crumbleCD <= 0) { sfx.crumble(); this.crumbleCD = 0.09; }
      this.parts.burst(cx, cy, 8, ['#7a4a30', '#5a3020', '#3a2018'], 110, 0.5, 4, 260, 1);
    }
  }

  explode(x, y) {
    const T = this.T, p = this.p;
    const cx = x * T + T / 2, cy = y * T + T / 2;
    sfx.boom(); this.shake = 16;
    let lost = 0;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      if (dx * dx + dy * dy > 6.8) continue;
      const tx = x + dx, ty = y + dy, t = this.get(tx, ty);
      if (t === MT.BED || ty < 4) continue;
      if (t === MT.GAS && (dx || dy)) this.pending.push({ x: tx, y: ty, t: 0.16 + Math.random() * 0.1 });
      if (t === MT.VEIN) lost++;
      this.set(tx, ty, MT.EMPTY);
    }
    if (lost) this.floats.add(cx, cy - 26, `${lost} vein tiles lost`, '#ff9a6a', 14, 1.6);
    this.vipers = this.vipers.filter((v) => { if (Math.hypot(v.gx - x, v.gy - y) < 3) { this.parts.burst(v.x, v.y, 10, '#5a0f10', 120, 0.6, 3, 200); return false; } return true; });
    const d = Math.hypot(p.gx - x, p.gy - y);
    if (d < 3.4) {
      const dmg = Math.round(38 * (1 - d / 4.4));
      p.hull -= dmg; p.hurtT = 0.5;
      this.floats.add(p.x, p.y - 30, `-${dmg} HULL`, '#ff4a3a', 20, 1.4);
    }
    this.parts.burst(cx, cy, 50, ['#ffd27a', '#ff8a3a', '#ff4a1a', '#fff2c0'], 340, 0.8, 5, 0, 2.5);
    for (let i = 0; i < 26; i++) this.parts.add(cx + rand(-30, 30), cy + rand(-30, 30), rand(-30, 30), rand(-50, -5), rand(1.2, 2.4), 'rgba(60,40,36,.6)', rand(6, 14), -8, 0.6);
  }

  killViper(v) {
    this.vipers.splice(this.vipers.indexOf(v), 1);
    sfx.squish();
    this.parts.burst(v.x, v.y, 18, ['#6a1414', '#3a0a0a', '#a02020'], 160, 0.7, 4, 200);
    this.floats.add(v.x, v.y - 14, 'PITVIPER SLAIN', '#e0b552', 14);
  }

  computeFlow() {
    const C = this.cols, R = this.rows, f = this.flow, p = this.p;
    f.fill(-1);
    const q = [p.gx + p.gy * C]; f[q[0]] = 0;
    for (let h = 0; h < q.length; h++) {
      const i = q[h], d = f[i]; if (d >= 22) continue;
      const x = i % C, y = (i / C) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= C || ny >= R) continue;
        const j = ny * C + nx;
        if (f[j] === -1 && this.g[j] === MT.EMPTY) { f[j] = d + 1; q.push(j); }
      }
    }
  }

  updateVipers(dt) {
    const p = this.p, T = this.T, C = this.cols;
    this.flowT -= dt;
    const at = p.gx + p.gy * C;
    if (at !== this.flowAt || this.flowT <= 0) { this.computeFlow(); this.flowAt = at; this.flowT = 0.4; }
    for (const v of this.vipers) {
      v.ph += dt * 8;
      const tx = v.gx * T + T / 2, ty = v.gy * T + T / 2;
      v.x = lerp(v.x, tx, Math.min(1, dt * 12)); v.y = lerp(v.y, ty, Math.min(1, dt * 12));
      const d = Math.hypot(v.gx - p.gx, v.gy - p.gy);
      if (!v.awake) { if (d < 7) { v.awake = true; sfx.hiss(); this.floats.add(v.x, v.y - 14, '!', '#ff4a3a', 22); } continue; }
      const adj = Math.abs(v.gx - p.gx) + Math.abs(v.gy - p.gy) <= 1;
      if (adj) {
        v.biteT -= dt;
        if (v.biteT <= 0) {
          v.biteT = 0.9; p.hull -= 6; p.hurtT = 0.3; sfx.bite();
          this.floats.add(p.x, p.y - 26, '-6 BITE', '#ff4a3a', 16);
          this.parts.burst(p.x, p.y, 6, '#ff4a3a', 80, 0.4, 3);
        }
        continue;
      }
      v.biteT = 0.35;
      v.stepT -= dt; if (v.stepT > 0) continue;
      v.stepT = 0.27;
      let best = null, bestD = this.flow[v.gx + v.gy * C];
      if (bestD < 0) bestD = 999;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = v.gx + dx, ny = v.gy + dy;
        if (nx === p.gx && ny === p.gy) continue;
        const fd = this.flow[nx + ny * C];
        if (fd >= 0 && fd < bestD && !this.viperAt(nx, ny)) { bestD = fd; best = [nx, ny]; }
      }
      if (best) { v.gx = best[0]; v.gy = best[1]; continue; }
      // no open path: burrow through soft rock toward the drill
      if (d > 16) continue;
      const sx = Math.sign(p.gx - v.gx), sy = Math.sign(p.gy - v.gy);
      const tries = Math.abs(p.gx - v.gx) > Math.abs(p.gy - v.gy) ? [[sx, 0], [0, sy]] : [[0, sy], [sx, 0]];
      for (const [dx, dy] of tries) {
        if (!dx && !dy) continue;
        const nx = v.gx + dx, ny = v.gy + dy, t = this.get(nx, ny);
        if (t === MT.EMPTY && !this.viperAt(nx, ny) && !(nx === p.gx && ny === p.gy)) { v.gx = nx; v.gy = ny; break; }
        if (t === MT.DIRT || t === MT.ROCK) {
          v.dig += 0.27 / HARD[t] * 0.35; v.stepT = 0.27;
          if (v.dig >= 1) { v.dig = 0; this.set(nx, ny, MT.EMPTY); this.parts.burst(nx * T + T / 2, ny * T + T / 2, 5, '#5a3020', 60, 0.4, 3, 200); }
          break;
        }
      }
    }
  }

  // --------------------------------------------------------------- render --
  draw() {
    const T = this.T, p = this.p;
    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    const cam = Math.round(this.cam);
    ctx.fillStyle = '#0b0504'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(sx, sy - cam);
    const r0 = Math.max(0, Math.floor(cam / T) - 1), r1 = Math.min(this.rows - 1, r0 + Math.ceil(H / T) + 2);
    const near = (x, y) => Math.abs(x - p.gx) <= 2 && Math.abs(y - p.gy) <= 2;
    for (let r = r0; r <= r1; r++) for (let c = 0; c < this.cols; c++) {
      const i = r * this.cols + c, t = this.g[i], s = this.shade[i], x = c * T, y = r * T;
      if (t === MT.EMPTY) {
        ctx.fillStyle = r < 4 ? '#1c0f0a' : `hsl(14,30%,${6 + s * 2}%)`; ctx.fillRect(x, y, T, T);
        continue;
      }
      let col;
      if (t === MT.DIRT) col = `hsl(18,42%,${24 + s * 6}%)`;
      else if (t === MT.ROCK || t === MT.GAS) col = `hsl(12,26%,${17 + s * 5}%)`;
      else if (t === MT.BASALT) col = `hsl(8,14%,${10 + s * 4}%)`;
      else if (t === MT.VEIN) col = '#24161a';
      else col = '#040202';
      ctx.fillStyle = col; ctx.fillRect(x, y, T, T);
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x + ((s * 97) % 18), y + ((s * 61) % 18), 4, 3);
      ctx.fillStyle = 'rgba(255,220,180,.05)'; ctx.fillRect(x, y, T, 2);
      if (t === MT.VEIN) {
        const rich = this.rich[i];
        ctx.fillStyle = rich >= 3 ? '#ffd27a' : '#7fd8ff';
        for (let k = 0; k < 3; k++) {
          const ox = x + 4 + ((s * 13 + k * 7) % 16), oy = y + 4 + ((s * 29 + k * 5) % 16);
          ctx.beginPath(); ctx.moveTo(ox, oy - 4); ctx.lineTo(ox + 3, oy); ctx.lineTo(ox, oy + 4); ctx.lineTo(ox - 3, oy); ctx.fill();
        }
      }
      if (t === MT.GAS && near(c, r)) {
        ctx.fillStyle = `rgba(140,255,130,${0.12 + 0.1 * Math.sin(this.time * 6 + s * 10)})`; ctx.fillRect(x, y, T, T);
      }
    }
    // shaft dressing
    for (let c = 2; c < this.cols; c += 6) {
      ctx.fillStyle = '#3a2418'; ctx.fillRect(c * T, 0, 4, 4 * T);
      ctx.fillStyle = `rgba(255,200,120,${0.6 + 0.2 * Math.sin(this.time * 3 + c)})`; ctx.fillRect(c * T - 3, 2 * T, 10, 6);
    }
    txt('SHAFT 17 · LAMBDA', 20 * T, 1.2 * T, { size: 14, font: FH, align: 'center', color: 'rgba(241,228,204,.5)' });
    // crack overlay on the tile being drilled
    if (p.drilling) {
      const cx = (p.gx + p.face[0]) * T, cy = (p.gy + p.face[1]) * T;
      ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 2; ctx.beginPath();
      const n = Math.floor(p.prog * 6);
      for (let k = 0; k < n; k++) { ctx.moveTo(cx + T / 2, cy + T / 2); ctx.lineTo(cx + T / 2 + Math.cos(k * 2.1) * T * 0.5, cy + T / 2 + Math.sin(k * 2.1) * T * 0.5); }
      ctx.stroke();
    }
    for (const v of this.vipers) this.drawViper(v);
    this.drawDrill(p.x, p.y);
    this.parts.draw();
    ctx.restore();

    // darkness and headlamp
    const px = p.x + sx, py = p.y - cam + sy;
    const lamp = ctx.createRadialGradient(px, py, 30, px, py, 300);
    lamp.addColorStop(0, 'rgba(0,0,0,0)'); lamp.addColorStop(0.55, 'rgba(0,0,0,.55)'); lamp.addColorStop(1, 'rgba(0,0,0,.94)');
    ctx.fillStyle = lamp; ctx.fillRect(0, 0, W, H);
    // sonar ping reveals veins through the dark
    if (this.ping.t < 3) {
      const pr = this.ping.t * 520, fadeA = clamp(1 - this.ping.t / 3, 0, 1);
      ctx.strokeStyle = `rgba(127,216,255,${0.5 * (1 - this.ping.t / 1.2)})`; ctx.lineWidth = 2;
      if (this.ping.t < 1.2) { ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.stroke(); }
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let r = r0; r <= r1; r++) for (let c = 0; c < this.cols; c++) {
        const i = r * this.cols + c; if (this.g[i] !== MT.VEIN) continue;
        const x = c * T + T / 2 + sx, y = r * T + T / 2 - cam + sy;
        if (Math.hypot(x - px, y - py) > pr) continue;
        ctx.fillStyle = this.rich[i] >= 3 ? `rgba(255,210,122,${0.55 * fadeA})` : `rgba(127,216,255,${0.45 * fadeA})`;
        ctx.fillRect(x - 7, y - 7, 14, 14);
      }
      ctx.restore();
    }
    if (p.hurtT > 0) { ctx.fillStyle = `rgba(200,20,20,${p.hurtT * 0.5})`; ctx.fillRect(0, 0, W, H); }
    ctx.save(); ctx.translate(sx, sy - cam); this.floats.draw(); ctx.restore();
    this.drawHUD();
    if (this.state === 'intro') drawChapterBanner(1, this.stT);
    if (this.state !== 'play' && this.state !== 'intro') this.drawEnd();
  }

  drawDrill(x, y) {
    const p = this.p;
    ctx.save(); ctx.translate(x, y);
    ctx.rotate(Math.atan2(p.face[1], p.face[0]));
    if (p.drilling) ctx.translate((Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.6);
    const beam = ctx.createLinearGradient(8, 0, 90, 0);
    beam.addColorStop(0, 'rgba(255,220,150,.35)'); beam.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(8, -4); ctx.lineTo(90, -34); ctx.lineTo(90, 34); ctx.lineTo(8, 4); ctx.fill();
    ctx.fillStyle = '#2a120c'; rr(-13, -11, 20, 22, 3); ctx.fill();
    ctx.fillStyle = p.over > 0 ? `hsl(10,80%,${40 + 15 * Math.sin(this.time * 20)}%)` : '#b8402a'; rr(-11, -9, 16, 18, 2); ctx.fill();
    ctx.fillStyle = '#e0b552'; ctx.fillRect(-11, -2, 16, 3);
    ctx.fillStyle = p.hurtT > 0 ? '#ff6050' : '#ffd27a'; ctx.fillRect(-7, -7, 5, 4);
    ctx.fillStyle = '#9aa0a6';
    ctx.beginPath(); ctx.moveTo(5, -8); ctx.lineTo(17, 0); ctx.lineTo(5, 8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#4a4e52'; ctx.lineWidth = 1.5;
    const sp = this.time * (p.drilling ? 40 : 3);
    for (let k = 0; k < 3; k++) {
      const o = 5 + ((sp + k * 4) % 12);
      const h = 8 * (1 - (o - 5) / 12);
      ctx.beginPath(); ctx.moveTo(o, -h); ctx.lineTo(o + 2, h); ctx.stroke();
    }
    ctx.strokeStyle = '#d8d0c0'; ctx.lineWidth = 2;
    const open = p.drilling ? 0.3 * Math.sin(this.time * 30) : 0;
    ctx.beginPath(); ctx.arc(4, -10, 6, -0.6 + open, 0.9); ctx.stroke();
    ctx.beginPath(); ctx.arc(4, 10, 6, -0.9, 0.6 - open); ctx.stroke();
    ctx.restore();
  }
  drawViper(v) {
    const seg = 7;
    ctx.fillStyle = v.awake ? '#3c4a38' : '#2a3228';
    for (let k = seg; k >= 0; k--) {
      const o = k * 2.4;
      const x = v.x + Math.sin(v.ph - k * 0.9) * 5 - o * 0.6, y = v.y + o - 8;
      ctx.beginPath(); ctx.arc(x, y, 4.5 - k * 0.35, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#2e3a2c'; ctx.beginPath(); ctx.ellipse(v.x + Math.sin(v.ph) * 5, v.y - 9, 6, 4.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = v.awake ? '#ff3b2f' : '#6a2a20';
    ctx.fillRect(v.x + Math.sin(v.ph) * 5 - 3, v.y - 11, 2, 2); ctx.fillRect(v.x + Math.sin(v.ph) * 5 + 1, v.y - 11, 2, 2);
  }

  gasLevel() {
    const p = this.p; let best = 9;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (this.get(p.gx + dx, p.gy + dy) === MT.GAS) best = Math.min(best, Math.abs(dx) + Math.abs(dy));
    return best > 4 ? 0 : (5 - best) / 4;
  }
  drawHUD() {
    const p = this.p;
    panel(12, 12, 300, 132);
    txt('HELIUM-3', 26, 36, { size: 14, font: FH, weight: 700, color: '#7fd8ff' });
    txt(`${this.he3} kg`, 298, 36, { size: 18, font: FH, weight: 700, align: 'right' });
    const maxV = 130;
    bar(26, 44, 272, 10, this.he3 / maxV, '#7fd8ff');
    const qx = 26 + 272 * this.quota / maxV, gx = 26 + 272 * clamp(this.rivals[0].v / maxV, 0, 1);
    ctx.fillStyle = '#f1e4cc'; ctx.fillRect(qx, 40, 2, 18);
    ctx.fillStyle = '#c0262d'; ctx.fillRect(gx, 40, 2, 18);
    txt('quota', qx, 70, { size: 12, font: FH, align: 'center', color: 'rgba(241,228,204,.7)' });
    txt('Gamma', gx, 70, { size: 12, font: FH, align: 'center', color: '#ff6a5a' });
    txt('HULL', 26, 92, { size: 13, font: FH, weight: 700 });
    bar(70, 83, 228, 9, p.hull / 100, p.hull > 35 ? '#d8d0c0' : '#ff4a3a');
    txt('HEAT', 26, 110, { size: 13, font: FH, weight: 700, color: p.over > 0 ? '#ff4a3a' : '#f1e4cc' });
    bar(70, 101, 228, 9, p.heat / 100, p.over > 0 ? (Math.sin(this.time * 20) > 0 ? '#ff2a1a' : '#ffaa3a') : `hsl(${40 - p.heat * 0.4},90%,55%)`);
    const gas = this.gasLevel();
    txt('GAS', 26, 131, { size: 13, font: FH, weight: 700, color: gas > 0.5 ? '#9dff9a' : '#f1e4cc' });
    for (let k = 0; k < 8; k++) {
      ctx.fillStyle = k < gas * 8 ? (k > 5 ? '#ff4a3a' : '#9dff9a') : 'rgba(255,255,255,.1)';
      ctx.fillRect(70 + k * 18, 122, 14, 10);
    }
    txt(`DEPTH ${Math.max(0, p.gy - 3) * 12} m`, 298, 131, { size: 13, font: FH, weight: 700, align: 'right', color: 'rgba(241,228,204,.75)' });

    panel(W - 192, 12, 180, 120);
    const m = Math.floor(this.timeLeft / 60), s = Math.floor(this.timeLeft % 60);
    txt('SHIFT ENDS', W - 178, 34, { size: 13, font: FH, weight: 700, color: 'rgba(241,228,204,.7)' });
    txt(`${m}:${String(s).padStart(2, '0')}`, W - 26, 36, { size: 22, font: FH, weight: 700, align: 'right', color: this.timeLeft < 20 ? '#ff4a3a' : '#e0b552' });
    const board = [{ name: 'Lambda', v: this.he3, me: true }, ...this.rivals.map((r) => ({ name: r.name, v: Math.floor(r.v) }))].sort((a, b) => b.v - a.v);
    board.forEach((b, i) => {
      const y = 60 + i * 18;
      txt(`${i + 1}. ${b.name}`, W - 178, y, { size: 15, font: FH, weight: b.me ? 700 : 500, color: b.me ? '#7fd8ff' : 'rgba(241,228,204,.75)' });
      txt(String(b.v), W - 26, y, { size: 15, font: FH, weight: 700, align: 'right', color: b.me ? '#7fd8ff' : 'rgba(241,228,204,.75)' });
    });
    const cd = this.ping.cd;
    txt(cd > 0 ? `PING ${cd.toFixed(1)}s` : 'PING READY', 18, H - 18, { size: 14, font: FH, weight: 700, color: cd > 0 ? 'rgba(241,228,204,.4)' : '#7fd8ff' });
    if (this.maxDepth < 60 && this.state === 'play' && this.time > 40 && this.time < 52) {
      txt('The richest veins lie deep, where the gas gathers.', W / 2, H - 20, { size: 18, font: FB, align: 'center', color: '#e0b552', stroke: 'rgba(0,0,0,.8)' });
    }
  }
  drawEnd() {
    ctx.fillStyle = 'rgba(0,0,0,.72)'; ctx.fillRect(0, 0, W, H);
    const gamma = Math.floor(this.rivals[0].v);
    let title, sub, prompt;
    if (this.state === 'won') { title = 'QUOTA MET'; sub = `Lambda ${this.he3} kg  ·  Gamma ${gamma} kg${this.he3 > gamma ? '  ·  You beat Gamma' : ''}`; prompt = 'A / TAP  CONTINUE'; }
    else if (this.state === 'short') { title = 'QUOTA MISSED'; sub = `Only ${this.he3} kg of ${this.quota}. Lambda goes hungry this quarter.`; prompt = 'A / TAP  TRY AGAIN    ·    B  TITLE'; }
    else { title = 'THE DRILL IS LOST'; sub = 'Lykos buries another Helldiver.'; prompt = 'A / TAP  TRY AGAIN    ·    B  TITLE'; }
    txt(title, W / 2, H / 2 - 20, { size: 52, weight: 800, align: 'center', color: this.state === 'won' ? '#e0b552' : '#ff4a3a', glow: 'rgba(192,38,45,.8)' });
    txt(sub, W / 2, H / 2 + 24, { size: 20, font: FB, weight: 400, align: 'center' });
    if (this.state === 'won') drawRank(W / 2 - 40, H / 2 + 72, this.rankIdx, 'RANK', this.newBest);
    if (this.stT > 1.2) txt(prompt, W / 2, H / 2 + (this.state === 'won' ? 124 : 80), { size: 16, font: FH, weight: 700, align: 'center', color: 'rgba(241,228,204,.7)' });
  }
}
