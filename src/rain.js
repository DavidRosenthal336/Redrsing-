// ---------------------------------------------------------------------------
// Chapter V: Iron Rain. Free-fall from orbit in a starShell. Dodge flak,
// shoot down ripWings and missiles, gather falling soldiers, hit the drop zone.
// ---------------------------------------------------------------------------
class RainScene {
  constructor() {
    this.pausable = true;
    this.parts = new Particles(); this.floats = new Floaters();
    this.p = { x: W / 2, y: 200, vx: 0, vy: 0, hp: 100, inv: 0, dashT: 0, dashCD: 0, fireCD: 0, hurtT: 0, face: 0 };
    this.allies = []; this.drifters = []; this.shots = []; this.foes = []; this.bolts = []; this.flak = []; this.debris = [];
    this.total = 95; this.alt = 60; this.time = 0; this.stT = 0; this.state = 'intro';
    this.spawnT = { flak: 3, wing: 6, missile: 14, debris: 1, drifter: 2 };
    this.zoneX = rand(220, W - 220); this.landed = 0; this.kills = 0; this.shake = 0;
    this.clouds = Array.from({ length: 14 }, () => ({ x: rand(-100, W), y: rand(0, H), w: rand(120, 320), v: rand(0.6, 1.4) }));
    this.streaks = Array.from({ length: 60 }, () => ({ x: rand(0, W), y: rand(0, H), l: rand(20, 80), v: rand(0.7, 1.5) }));
  }
  enter() { AudioSys.drone('rain'); setButtons('Fire', 'Boost'); }

  phase() { return this.alt > 42 ? 0 : this.alt > 22 ? 1 : this.alt > 5 ? 2 : 3; }

  update(dt) {
    this.time += dt; this.stT += dt;
    this.parts.update(dt); this.floats.update(dt);
    this.shake = Math.max(0, this.shake - dt * 30);
    const fall = this.fallSpeed();
    for (const s of this.streaks) { s.y -= s.v * fall * 2.2 * dt; if (s.y < -s.l) { s.y = H + rand(0, 40); s.x = rand(0, W); } }
    for (const c of this.clouds) { c.y -= c.v * fall * 1.4 * dt; if (c.y < -120) { c.y = H + rand(20, 200); c.x = rand(-100, W); } }
    if (this.state === 'intro') { if (this.stT > 2.6 || (this.stT > 0.6 && I.pressed('a'))) { this.state = 'fall'; this.stT = 0; } return; }
    if (this.state !== 'fall') {
      if (this.stT > 2) {
        if (this.state === 'landed' && (I.pressed('a') || I.tap())) chapterWon(5, { rank: this.rankIdx });
        if (this.state === 'lost' && (I.pressed('a') || I.tap())) go(new RainScene());
        if (this.state === 'lost' && I.pressed('b')) go(new TitleScene());
      }
      return;
    }
    this.alt = Math.max(0, this.alt - dt * 60 / this.total);
    this.updatePlayer(dt);
    this.spawn(dt);
    this.updateThings(dt, fall);
    if (this.p.hp <= 0) { this.p.hp = 0; this.state = 'lost'; this.stT = 0; sfx.boom(); this.shake = 20; this.parts.burst(this.p.x, this.p.y, 60, ['#ffd27a', '#ff6a3a', '#c0262d'], 300, 1, 5); }
    else if (this.alt <= 0) this.land();
  }
  fallSpeed() { return 260 + (60 - this.alt) * 4; }

  updatePlayer(dt) {
    const p = this.p;
    p.inv -= dt; p.dashCD -= dt; p.fireCD -= dt; p.hurtT -= dt;
    let ax = I.ax(), ay = I.ay();
    const m = Math.hypot(ax, ay); if (m > 1) { ax /= m; ay /= m; }
    if (I.pressed('b') && p.dashCD <= 0) {
      p.dashT = 0.18; p.dashCD = 0.9; p.inv = 0.3; sfx.whoosh();
      p.dashA = m > 0.15 ? Math.atan2(ay, ax) : -Math.PI / 2;
    }
    if (p.dashT > 0) { p.dashT -= dt; p.vx = Math.cos(p.dashA) * 620; p.vy = Math.sin(p.dashA) * 620; }
    else { p.vx = lerp(p.vx, ax * 330, Math.min(1, dt * 9)); p.vy = lerp(p.vy, ay * 300, Math.min(1, dt * 9)); }
    p.x = clamp(p.x + p.vx * dt, 30, W - 30); p.y = clamp(p.y + p.vy * dt, 70, H - 40);
    p.face = p.vx / 330;
    if (I.down('a') && p.fireCD <= 0) {
      p.fireCD = 0.16; AudioSys.tone(880, 0.06, 'square', 0.03, 0.5);
      this.shots.push({ x: p.x, y: p.y + 20, vy: 720, mine: true });
      for (const a of this.allies) if (Math.random() < 0.5) this.shots.push({ x: a.x, y: a.y + 12, vy: 680, mine: true });
    }
    // allies hold a loose V above and behind
    this.allies.forEach((a, i) => {
      const side = i % 2 ? 1 : -1, row = Math.floor(i / 2) + 1;
      const tx = p.x + side * row * 34, ty = p.y - row * 26;
      a.x = lerp(a.x, tx, Math.min(1, dt * 5)); a.y = lerp(a.y, ty, Math.min(1, dt * 5));
    });
    // re-entry heat trails
    if (this.phase() === 1 && Math.random() < 0.8) this.parts.add(p.x + rand(-8, 8), p.y - 18, rand(-20, 20), -rand(120, 220), 0.35, pick(['#ffd27a', '#ff8a3a', '#ff4a1a']), rand(3, 6));
    else if (Math.random() < 0.3) this.parts.add(p.x, p.y - 16, 0, -160, 0.3, 'rgba(220,230,255,.4)', 4);
  }

  spawn(dt) {
    const ph = this.phase(), S = this.spawnT, p = this.p;
    for (const k in S) S[k] -= dt;
    if (S.debris <= 0) {
      S.debris = ph === 0 ? 0.55 : 1.4;
      this.debris.push({ x: rand(20, W - 20), y: H + 40, r: rand(10, 26), vy: rand(0.9, 1.4), rot: rand(0, TAU), vr: rand(-2, 2), hp: 3 });
    }
    if (S.drifter <= 0 && ph < 3) {
      S.drifter = rand(2.4, 4.2);
      this.drifters.push({ x: rand(60, W - 60), y: H + 30, vy: rand(0.35, 0.6), bob: rand(0, TAU), cell: Math.random() < 0.2 });
    }
    if (ph >= 1 && S.flak <= 0) {
      S.flak = ph === 1 ? 1.7 : ph === 2 ? 1.05 : 1.3;
      const near = Math.random() < 0.6;
      const x = near ? p.x + rand(-90, 90) : rand(40, W - 40), y = near ? p.y + rand(-70, 90) : rand(90, H - 60);
      this.flak.push({ x: clamp(x, 30, W - 30), y: clamp(y, 80, H - 30), t: 0, fuse: ph === 2 ? 0.8 : 1.0, r: 52 });
    }
    if (ph >= 1 && ph < 3 && S.wing <= 0) {
      S.wing = ph === 1 ? 6 : 4;
      const fromLeft = Math.random() < 0.5;
      this.foes.push({ type: 'wing', x: fromLeft ? -40 : W + 40, y: rand(260, H - 60), vx: fromLeft ? 170 : -170, hp: 4, fireT: 0.8, r: 18 });
    }
    if (ph >= 2 && S.missile <= 0) {
      S.missile = ph === 2 ? 3.2 : 4.5;
      this.foes.push({ type: 'missile', x: rand(60, W - 60), y: H + 20, vx: 0, vy: -200, hp: 1, r: 9, life: 6 });
    }
  }

  hurt(dmg, x, y) {
    const p = this.p;
    if (p.inv > 0 || this.state !== 'fall') return;
    p.hp -= dmg; p.inv = 0.6; p.hurtT = 0.4; this.shake = 8; sfx.hurt();
    this.floats.add(p.x, p.y - 30, `-${dmg} SHELL`, '#ff4a3a', 16);
    this.parts.burst(x, y, 16, ['#ffd27a', '#ff8a3a'], 220, 0.5, 4);
  }
  hitAllies(x, y, r) {
    for (let i = this.allies.length - 1; i >= 0; i--) {
      const a = this.allies[i];
      if (dist(a.x, a.y, x, y) < r + 10) {
        this.allies.splice(i, 1);
        this.floats.add(a.x, a.y - 16, 'SOLDIER LOST', '#ff9a6a', 13);
        this.parts.burst(a.x, a.y, 14, ['#ff8a3a', '#c0262d'], 180, 0.6, 3);
      }
    }
  }

  updateThings(dt, fall) {
    const p = this.p;
    for (const s of this.shots) {
      s.y += s.vy * dt;
      for (const f of this.foes) if (!f.dead && dist(s.x, s.y, f.x, f.y) < f.r + 4) { s.dead = true; f.hp--; this.parts.burst(s.x, s.y, 4, '#ffd27a', 100, 0.2, 2); if (f.hp <= 0) this.killFoe(f); break; }
      for (const d of this.debris) if (!s.dead && dist(s.x, s.y, d.x, d.y) < d.r) { s.dead = true; d.hp--; if (d.hp <= 0) { d.dead = true; this.parts.burst(d.x, d.y, 10, ['#6a5d52', '#3a322d'], 140, 0.5, 4); } }
    }
    this.shots = this.shots.filter((s) => !s.dead && s.y < H + 20 && s.y > -20);
    for (const d of this.debris) {
      d.y -= d.vy * fall * dt; d.rot += d.vr * dt;
      if (!d.dead && dist(d.x, d.y, p.x, p.y) < d.r + 14) { d.dead = true; this.hurt(12, d.x, d.y); }
      if (!d.dead) this.hitAllies(d.x, d.y, d.r - 6);
    }
    this.debris = this.debris.filter((d) => !d.dead && d.y > -60);
    for (const d of this.drifters) {
      d.y -= d.vy * fall * dt * 0.35; d.bob += dt * 3;
      if (dist(d.x, d.y, p.x, p.y) < 34) {
        d.dead = true; sfx.gem();
        if (d.cell) { p.hp = Math.min(100, p.hp + 25); this.floats.add(d.x, d.y - 20, '+25 SHELL', '#7fd8ff', 15); }
        else { this.allies.push({ x: d.x, y: d.y }); this.floats.add(d.x, d.y - 20, 'SOLDIER JOINS', '#9dff9a', 14); }
      }
    }
    this.drifters = this.drifters.filter((d) => !d.dead && d.y > -40);
    for (const fl of this.flak) {
      fl.t += dt;
      if (fl.t >= fl.fuse && !fl.boomed) {
        fl.boomed = true; sfx.boom(); this.shake = Math.max(this.shake, 6);
        this.parts.burst(fl.x, fl.y, 30, ['#ffd27a', '#ff8a3a', '#2a2020', '#4a3a30'], 260, 0.7, 6);
        if (dist(fl.x, fl.y, p.x, p.y) < fl.r) this.hurt(14, fl.x, fl.y);
        this.hitAllies(fl.x, fl.y, fl.r * 0.55);
      }
    }
    this.flak = this.flak.filter((fl) => fl.t < fl.fuse + 0.3);
    for (const f of this.foes) {
      if (f.type === 'wing') {
        f.x += f.vx * dt; f.y -= fall * 0.05 * dt; f.fireT -= dt;
        if (f.fireT <= 0 && f.x > 20 && f.x < W - 20) {
          f.fireT = 1.3; const a = Math.atan2(p.y - f.y, p.x - f.x);
          this.bolts.push({ x: f.x, y: f.y, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300 });
          AudioSys.tone(300, 0.1, 'sawtooth', 0.04, 0.5);
        }
        if (f.x < -80 || f.x > W + 80) f.dead = true;
      } else {
        f.life -= dt;
        const a = Math.atan2(p.y - f.y, p.x - f.x);
        f.vx = lerp(f.vx, Math.cos(a) * 230, Math.min(1, dt * 1.6)); f.vy = lerp(f.vy, Math.sin(a) * 230, Math.min(1, dt * 1.6));
        f.x += f.vx * dt; f.y += f.vy * dt;
        if (Math.random() < 0.6) this.parts.add(f.x, f.y, 0, 0, 0.4, 'rgba(200,200,200,.5)', 4);
        if (f.life <= 0) { f.dead = true; this.parts.burst(f.x, f.y, 14, ['#ffd27a', '#ff8a3a'], 160, 0.4, 3); }
      }
      if (!f.dead && dist(f.x, f.y, p.x, p.y) < f.r + 14) { f.dead = true; this.hurt(f.type === 'missile' ? 20 : 15, f.x, f.y); this.parts.burst(f.x, f.y, 20, ['#ffd27a', '#ff8a3a'], 220, 0.5, 4); }
      if (!f.dead && f.type === 'missile') this.hitAllies(f.x, f.y, 6);
    }
    this.foes = this.foes.filter((f) => !f.dead);
    for (const b of this.bolts) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (dist(b.x, b.y, p.x, p.y) < 16) { b.dead = true; this.hurt(8, b.x, b.y); }
    }
    this.bolts = this.bolts.filter((b) => !b.dead && b.x > -20 && b.x < W + 20 && b.y > -20 && b.y < H + 20);
  }
  killFoe(f) {
    f.dead = true; this.kills++; sfx.boom();
    this.parts.burst(f.x, f.y, f.type === 'wing' ? 40 : 16, ['#ffd27a', '#ff8a3a', '#2a2020'], 260, 0.7, 5);
    this.floats.add(f.x, f.y - 20, f.type === 'wing' ? 'RIPWING DOWN' : 'MISSILE', '#e0b552', 14);
  }

  land() {
    const p = this.p;
    this.state = 'landed'; this.stT = 0; this.landed = this.allies.length;
    const miss = Math.abs(p.x - this.zoneX);
    this.accuracy = miss < 50 ? 'Dead center' : miss < 130 ? 'In the zone' : 'Off target';
    const score = this.landed * 12 + p.hp * 0.6 + (miss < 50 ? 40 : miss < 130 ? 20 : 0) + this.kills * 3;
    this.score = Math.round(score);
    this.rankIdx = Ranks.grade(this.score, [150, 115, 85, 55]);
    this.newBest = Ranks.record(5, this.rankIdx);
    this.shake = 22; sfx.boom(); sfx.fanfare();
    this.parts.burst(p.x, H - 60, 80, ['#c8a07a', '#8a5a3a', '#ffd27a'], 360, 1.2, 6, 300);
  }

  // --------------------------------------------------------------- render --
  draw() {
    const ph = this.phase(), a = this.alt;
    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    // the sky warms from black space through burning re-entry into a dusty Martian afternoon
    const k = clamp((60 - a) / 60, 0, 1);
    const top = k < 0.5 ? `hsl(${260 - k * 300},${30 + k * 60}%,${4 + k * 20}%)` : `hsl(${18 + (k - 0.5) * 20},${60 - (k - 0.5) * 40}%,${24 + (k - 0.5) * 50}%)`;
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(1, k < 0.3 ? '#0a0410' : `hsl(16,55%,${18 + k * 30}%)`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (ph === 0) {
      drawStars(this.time, 1 - k * 2);
      drawMars(W / 2, H + 900 - k * 600, 1000 + k * 300, this.time * 0.1);
      // the Rising's fleet above
      ctx.fillStyle = 'rgba(20,10,14,.85)';
      for (const [x, y, s] of [[120, 50, 1], [700, 30, 1.4], [420, 80, 0.7]]) { ctx.beginPath(); ctx.moveTo(x - 90 * s, y); ctx.lineTo(x + 90 * s, y - 8 * s); ctx.lineTo(x + 70 * s, y + 14 * s); ctx.lineTo(x - 80 * s, y + 10 * s); ctx.fill(); }
    }
    if (ph === 1) { const fl = ctx.createRadialGradient(this.p.x, this.p.y + 30, 10, this.p.x, this.p.y + 30, 260); fl.addColorStop(0, 'rgba(255,160,60,.35)'); fl.addColorStop(1, 'rgba(255,160,60,0)'); ctx.fillStyle = fl; ctx.fillRect(0, 0, W, H); }
    ctx.save(); ctx.translate(sx, sy);
    ctx.strokeStyle = ph === 1 ? 'rgba(255,200,140,.35)' : 'rgba(255,255,255,.18)'; ctx.lineWidth = 1.5;
    for (const s of this.streaks) { ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x, s.y + s.l); ctx.stroke(); }
    if (ph >= 2) for (const c of this.clouds) { ctx.fillStyle = `rgba(230,200,180,${ph === 3 ? 0.12 : 0.22})`; ctx.beginPath(); ctx.ellipse(c.x, c.y, c.w, c.w * 0.3, 0, 0, TAU); ctx.fill(); }
    if (ph === 3) this.drawGround();
    for (const fl of this.flak) {
      if (!fl.boomed) {
        const kk = fl.t / fl.fuse;
        ctx.strokeStyle = `rgba(255,70,40,${0.4 + 0.5 * kk})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(fl.x, fl.y, fl.r, 0, TAU); ctx.stroke();
        ctx.fillStyle = `rgba(255,70,40,${0.18 * kk})`; ctx.beginPath(); ctx.arc(fl.x, fl.y, fl.r * kk, 0, TAU); ctx.fill();
      }
    }
    for (const d of this.debris) {
      ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.rot);
      ctx.fillStyle = '#4a4440'; ctx.beginPath(); ctx.moveTo(-d.r, -d.r * 0.4); ctx.lineTo(d.r * 0.3, -d.r); ctx.lineTo(d.r, d.r * 0.2); ctx.lineTo(-d.r * 0.2, d.r); ctx.fill();
      ctx.fillStyle = '#6a625a'; ctx.fillRect(-d.r * 0.4, -d.r * 0.3, d.r * 0.6, d.r * 0.2);
      ctx.restore();
    }
    for (const d of this.drifters) {
      const dx = d.x + Math.sin(d.bob) * 6;
      if (d.cell) { ctx.fillStyle = '#7fd8ff'; rr(dx - 8, d.y - 11, 16, 22, 3); ctx.fill(); ctx.fillStyle = '#0a2a3a'; ctx.fillRect(dx - 2, d.y - 7, 4, 14); ctx.fillRect(dx - 6, d.y - 2, 12, 4); }
      else this.drawShell(dx, d.y, 0.7, '#7a6a5a', false);
      ctx.strokeStyle = d.cell ? `rgba(127,216,255,${0.5 + 0.4 * Math.sin(this.time * 6)})` : `rgba(157,255,154,${0.5 + 0.4 * Math.sin(this.time * 6)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(d.x + Math.sin(d.bob) * 6, d.y, 22, 0, TAU); ctx.stroke();
    }
    for (const f of this.foes) {
      if (f.type === 'wing') {
        ctx.save(); ctx.translate(f.x, f.y); ctx.scale(Math.sign(f.vx), 1);
        ctx.fillStyle = '#d8d0c0'; ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(-14, -14); ctx.lineTo(-8, 0); ctx.lineTo(-14, 14); ctx.fill();
        ctx.fillStyle = '#e0b552'; ctx.fillRect(-6, -2, 14, 4);
        ctx.fillStyle = '#ff8a3a'; ctx.fillRect(-16, -3, 5, 6);
        ctx.restore();
      } else {
        ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(Math.atan2(f.vy, f.vx));
        ctx.fillStyle = '#c8c8c8'; ctx.fillRect(-9, -3, 18, 6); ctx.fillStyle = '#c0262d'; ctx.fillRect(6, -3, 4, 6);
        ctx.restore();
      }
    }
    ctx.fillStyle = '#ff6a3a'; for (const b of this.bolts) { ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#ffd27a'; for (const s of this.shots) ctx.fillRect(s.x - 1.5, s.y - 6, 3, 12);
    for (const al of this.allies) this.drawShell(al.x, al.y, 0.75, '#8e1a1e', false);
    if (this.state !== 'lost') this.drawShell(this.p.x, this.p.y, 1, '#c0262d', true);
    this.parts.draw(); this.floats.draw();
    ctx.restore();
    if (this.p.hurtT > 0) { ctx.fillStyle = `rgba(200,20,20,${this.p.hurtT * 0.6})`; ctx.fillRect(0, 0, W, H); }
    this.drawHUD();
    if (this.state === 'intro') drawChapterBanner(5, this.stT);
    if (this.state === 'landed' || this.state === 'lost') this.drawEnd();
  }
  drawShell(x, y, s, col, me) {
    const p = this.p;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (me) ctx.rotate(p.face * 0.25);
    if (me && p.inv > 0 && Math.sin(this.time * 40) > 0) ctx.globalAlpha = 0.5;
    // a starShell falling head-down: helm below, limbs spread above
    ctx.strokeStyle = '#2a2224'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(-18, -22); ctx.moveTo(6, -6); ctx.lineTo(18, -22); ctx.moveTo(-8, 4); ctx.lineTo(-22, 2); ctx.moveTo(8, 4); ctx.lineTo(22, 2); ctx.stroke();
    ctx.fillStyle = col; rr(-10, -10, 20, 22, 5); ctx.fill();
    ctx.fillStyle = me ? '#e0b552' : '#a88a5a'; ctx.beginPath(); ctx.arc(0, 16, 8, 0, TAU); ctx.fill();
    if (me) {
      // the wolf cloak of the Reaper
      ctx.fillStyle = '#5a4a3a'; ctx.beginPath(); ctx.moveTo(-10, -10); ctx.quadraticCurveTo(0, -36 - Math.sin(this.time * 10) * 4, 10, -10); ctx.fill();
    }
    ctx.restore();
  }
  drawGround() {
    const k = clamp(1 - this.alt / 5, 0, 1);
    const gy = H + 60 - k * 140;
    ctx.fillStyle = '#7a3a22'; ctx.fillRect(0, gy, W, H - gy + 10);
    ctx.fillStyle = '#5a2a18';
    for (let x = 0; x < W; x += 60) ctx.fillRect(x + ((x * 7) % 23), gy + 10 + ((x * 13) % 30), 30, 10);
    // the drop zone
    ctx.strokeStyle = `rgba(157,255,154,${0.6 + 0.3 * Math.sin(this.time * 6)})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(this.zoneX, gy + 26, 130, 18, 0, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(this.zoneX, gy + 26, 50, 8, 0, 0, TAU); ctx.stroke();
  }
  drawHUD() {
    const p = this.p;
    panel(12, 12, 280, 78);
    txt('STARSHELL', 26, 34, { size: 14, font: FH, weight: 700, color: '#e0b552' });
    bar(26, 42, 252, 11, p.hp / 100, p.hp > 35 ? '#d8d0c0' : '#ff4a3a');
    bar(26, 57, 80, 5, 1 - clamp(p.dashCD / 0.9, 0, 1), '#e0b552');
    txt(`STICK ${this.allies.length}`, 278, 64, { size: 14, font: FH, weight: 700, align: 'right', color: '#9dff9a' });
    txt(['UPPER ORBIT', 'RE-ENTRY', 'FLAK BELT', 'DROP ZONE'][this.phase()], 26, 82, { size: 13, font: FH, weight: 700, color: 'rgba(241,228,204,.75)' });
    // altimeter
    panel(W - 86, 12, 74, H - 120);
    const top = 30, bot = H - 126;
    ctx.fillStyle = 'rgba(241,228,204,.25)'; ctx.fillRect(W - 50, top, 2, bot - top);
    for (let k2 = 0; k2 <= 60; k2 += 10) { const y = lerp(top, bot, 1 - k2 / 60); ctx.fillRect(W - 56, y, 14, 1); txt(String(k2), W - 60, y + 4, { size: 11, font: FH, align: 'right', color: 'rgba(241,228,204,.5)' }); }
    const ay = lerp(top, bot, 1 - this.alt / 60);
    ctx.fillStyle = '#e0b552'; ctx.beginPath(); ctx.moveTo(W - 46, ay); ctx.lineTo(W - 34, ay - 6); ctx.lineTo(W - 34, ay + 6); ctx.fill();
    txt(`${this.alt.toFixed(1)} km`, W - 49, bot + 24, { size: 14, font: FH, weight: 700, align: 'center', color: '#e0b552' });
    if (this.phase() === 3 && this.state === 'fall') txt('Steer for the green ring', W / 2, 40, { size: 20, font: FB, align: 'center', color: '#9dff9a', stroke: 'rgba(0,0,0,.7)' });
  }
  drawEnd() {
    if (this.stT < 0.8) return;
    ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(0, 0, W, H);
    if (this.state === 'lost') {
      txt('SHELL BREACHED', W / 2, H / 2 - 10, { size: 50, weight: 800, align: 'center', color: '#ff4a3a', glow: 'rgba(192,38,45,.8)' });
      txt('The Rain falls on without you.', W / 2, H / 2 + 30, { size: 20, font: FB, align: 'center' });
      if (this.stT > 2) txt('A / TAP  TRY AGAIN    ·    B  TITLE', W / 2, H / 2 + 86, { size: 16, font: FH, weight: 700, align: 'center', color: 'rgba(241,228,204,.7)' });
      return;
    }
    txt('BOOTS ON MARS', W / 2, H / 2 - 70, { size: 50, weight: 800, align: 'center', color: '#e0b552', glow: 'rgba(192,38,45,.8)' });
    txt(`${this.accuracy}  ·  ${this.landed} soldiers landed with you  ·  ${this.kills} kills  ·  shell ${Math.round(this.p.hp)}%`, W / 2, H / 2 - 28, { size: 19, font: FB, align: 'center' });
    drawRank(W / 2 - 40, H / 2 + 26, this.rankIdx, 'RANK', this.newBest);
    if (this.stT > 2) txt('A / TAP  CONTINUE', W / 2, H / 2 + 86, { size: 16, font: FH, weight: 700, align: 'center', color: 'rgba(241,228,204,.7)' });
  }
}
