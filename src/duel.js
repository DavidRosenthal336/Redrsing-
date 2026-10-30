// ---------------------------------------------------------------------------
// Chapters II and IV: duels. Timing, parries, stamina.
// ---------------------------------------------------------------------------
const FLOOR = 440;
const PAL = {
  darrow: { armor: '#2a2224', trim: '#c0262d', cloak: '#8e1a1e', skin: '#e6c39a', hair: '#d9a63a', blade: '#e8eef2' },
  julian: { armor: '#3a3f46', trim: '#9fb7c9', cloak: '#4a5d70', skin: '#efcfaa', hair: '#e7c76a', blade: '#d8dee4' },
  jackal: { armor: '#2c2a22', trim: '#e0b552', cloak: '#a07a2a', skin: '#f0d8b8', hair: '#f3e2a0', blade: '#f6f0dc' },
};
const FOES = {
  julian: {
    chapter: 2, name: 'Julian au Bellona', pal: PAL.julian, hp: 115, speed: 150, arena: 'passage', drone: 'duel',
    lightWind: 0.55, heavyWind: 0.95, lightDmg: 9, heavyDmg: 20, heavyChance: 0.25, feintChance: 0, comboMax: 1,
    blockChance: 0.3, parryChance: 0.06, dodgeChance: 0.08, aggression: 0.85, knife: false,
    taunts: ['I don\'t want to do this.', 'Please. Yield.', 'Cassius will know.'],
  },
  jackal: {
    chapter: 4, name: 'The Jackal', pal: PAL.jackal, hp: 210, speed: 215, arena: 'ridge', drone: 'jackal',
    lightWind: 0.38, heavyWind: 0.8, lightDmg: 11, heavyDmg: 24, heavyChance: 0.25, feintChance: 0.28, comboMax: 3,
    blockChance: 0.35, parryChance: 0.12, dodgeChance: 0.12, aggression: 1.05, knife: true,
    taunts: ['You were never one of us.', 'Every man has a price.', 'Come, Reaper.'],
  },
};
const P_LIGHT = { kind: 'light', wind: 0.12, act: 0.1, rec: 0.26, dmg: 11, range: 98 };

class Fighter {
  constructor(o) {
    Object.assign(this, { x: 300, face: 1, hp: 100, st: 100, state: 'idle', t: 0, atk: null, hitDone: false, stunDur: 0, speed: 230, atkId: 0, flash: 0, blockT: 0, walkPh: 0, isPlayer: false, chain: 0, chainT: 0 }, o);
    this.maxHp = this.hp;
  }
  canAct() { return this.state === 'idle' || this.state === 'walk'; }
  startAttack(atk) { this.state = 'windup'; this.t = 0; this.atk = atk; this.hitDone = false; this.atkId++; }
}

class DuelScene {
  constructor(cfg) {
    this.cfg = cfg; this.pausable = true;
    this.P = new Fighter({ x: 300, face: 1, hp: 120, isPlayer: true, name: 'Darrow', pal: PAL.darrow, speed: 240 });
    this.E = new Fighter({ x: 660, face: -1, hp: cfg.hp, name: cfg.name, pal: cfg.pal, speed: cfg.speed });
    this.parts = new Particles(); this.floats = new Floaters();
    this.knives = []; this.shake = 0; this.slowT = 0; this.time = 0;
    this.state = 'intro'; this.stT = 0;
    this.ai = { think: 1.2, reacted: -1, combo: 0, knifeCD: 2.5, phase2: false, taunt: null, tauntT: 0 };
    this.stats = { parries: 0 };
    this.snow = cfg.arena === 'ridge' ? Array.from({ length: 120 }, () => ({ x: rand(0, W), y: rand(0, H), v: rand(30, 90), s: rand(1, 3) })) : null;
  }
  enter() { AudioSys.drone(this.cfg.drone); setButtons('Strike', 'Block'); }

  update(rawDt) {
    let dt = rawDt;
    if (this.slowT > 0) { this.slowT -= rawDt; dt *= 0.3; }
    this.time += dt; this.stT += rawDt;
    this.parts.update(dt); this.floats.update(rawDt);
    this.shake = Math.max(0, this.shake - rawDt * 30);
    if (this.snow) for (const s of this.snow) { s.y += s.v * dt; s.x += Math.sin(this.time + s.v) * 10 * dt - 12 * dt; if (s.y > H) { s.y = -4; s.x = rand(0, W); } if (s.x < 0) s.x += W; }
    const P = this.P, E = this.E;
    if (this.state === 'intro') { if (this.stT > 2.4 || (this.stT > 0.6 && I.pressed('a'))) { this.state = 'fight'; this.stT = 0; this.say(pick(this.cfg.taunts)); } return; }
    if (this.state === 'won' || this.state === 'lost') {
      this.updateFighter(P, dt, E); this.updateFighter(E, dt, P);
      if (this.stT > 2.2) {
        if (this.state === 'won' && (I.pressed('a') || I.tap())) chapterWon(this.cfg.chapter);
        if (this.state === 'lost' && (I.pressed('a') || I.tap())) go(new DuelScene(this.cfg));
        if (this.state === 'lost' && I.pressed('b')) go(new TitleScene());
      }
      return;
    }
    this.ai.tauntT -= rawDt;
    this.controlPlayer(dt);
    this.controlAI(dt);
    this.updateFighter(P, dt, E);
    this.updateFighter(E, dt, P);
    this.updateKnives(dt);
    // keep them apart and inside the arena
    const gap = E.x - P.x;
    if (Math.abs(gap) < 56) { const push = (56 - Math.abs(gap)) / 2 * Math.sign(gap || 1); P.x -= push; E.x += push; }
    P.x = clamp(P.x, 60, W - 60); E.x = clamp(E.x, 60, W - 60);
    if (!this.ai.phase2 && E.hp < E.maxHp / 2 && this.cfg.knife) {
      this.ai.phase2 = true; this.say('Enough games.'); sfx.horn();
      this.floats.add(E.x, FLOOR - 140, 'THE JACKAL GROWS DESPERATE', '#ff4a3a', 18, 2);
    }
  }
  say(s) { this.ai.taunt = s; this.ai.tauntT = 2.6; }

  controlPlayer(dt) {
    const P = this.P, E = this.E;
    if (P.state !== 'dodge' && P.state !== 'dead') P.face = Math.sign(E.x - P.x) || 1;
    const ax = I.ax();
    if (P.canAct()) {
      if (Math.abs(ax) > 0.2) { P.x += ax * P.speed * dt * (Math.sign(ax) !== P.face ? 0.8 : 1); P.state = 'walk'; P.walkPh += dt * 12 * Math.abs(ax); }
      else P.state = 'idle';
    }
    const chain = P.state === 'recover' && P.t > 0.1;
    if (I.pressed('a') && (P.canAct() || chain) && P.st >= 6) { P.st -= 12; P.startAttack(P_LIGHT); }
    if (I.pressed('b') && (P.canAct() || P.state === 'recover' || P.state === 'block')) { P.state = 'parry'; P.t = 0; }
    if ((I.pressed('up') || I.pressed('down')) && (P.canAct() || P.state === 'block') && P.st >= 18) {
      P.st -= 22; P.state = 'dodge'; P.t = 0; sfx.whoosh();
    }
    P.blockHeld = I.down('b');
  }

  controlAI(dt) {
    const P = this.P, E = this.E, cfg = this.cfg, ai = this.ai;
    if (E.state !== 'dodge') E.face = Math.sign(P.x - E.x) || -1;
    const aggr = cfg.aggression * (ai.phase2 ? 1.4 : 1);
    const speed = cfg.speed * (ai.phase2 ? 1.15 : 1);
    E.blockHeld = E.blockT > 0;
    if (E.state === 'block') { E.blockT -= dt; if (E.blockT <= 0) E.state = 'idle'; }
    ai.knifeCD -= dt;
    const d = Math.abs(P.x - E.x);
    if (!E.canAct()) return;
    // react to the player winding up
    if (P.state === 'windup' && P.atkId !== ai.reacted && d < 150) {
      ai.reacted = P.atkId;
      const r = Math.random();
      if (r < cfg.parryChance) { E.state = 'parry'; E.t = 0; return; }
      if (r < cfg.parryChance + cfg.blockChance) { E.state = 'block'; E.t = 0; E.blockT = 0.5; return; }
      if (r < cfg.parryChance + cfg.blockChance + cfg.dodgeChance && E.st > 25) { E.st -= 22; E.state = 'dodge'; E.t = 0; return; }
    }
    if (cfg.knife && d > 240 && ai.knifeCD <= 0 && Math.random() < dt * 1.2) {
      ai.knifeCD = ai.phase2 ? 2.2 : 3.4;
      E.state = 'throw'; E.t = 0;
      return;
    }
    if (ai.counter) { ai.counter = false; if (d < 150) { E.startAttack({ kind: 'light', wind: 0.24, act: 0.1, rec: 0.34, dmg: cfg.lightDmg, range: 108 }); return; } }
    if (ai.combo > 0 && d < 140) { ai.combo--; E.startAttack(this.mkAtk('light', 0.7)); return; }
    ai.think -= dt;
    if (d > 110) { E.x += E.face * speed * dt; E.state = 'walk'; E.walkPh += dt * 10; }
    else if (d < 70 && Math.random() < dt * 2) { E.x -= E.face * speed * 0.7 * dt; E.state = 'walk'; E.walkPh -= dt * 10; }
    else E.state = 'idle';
    if (ai.think <= 0 && d < 150) {
      ai.think = rand(0.5, 1.15) / aggr;
      const r = Math.random();
      if (r < cfg.heavyChance) E.startAttack(this.mkAtk('heavy'));
      else if (r < cfg.heavyChance + cfg.feintChance) E.startAttack(this.mkAtk('feint'));
      else { E.startAttack(this.mkAtk('light')); ai.combo = randi(0, cfg.comboMax - 1); }
    }
  }
  mkAtk(kind, windMul = 1) {
    const c = this.cfg, f = this.ai.phase2 ? 0.82 : 1;
    if (kind === 'light') return { kind, wind: c.lightWind * windMul * f, act: 0.1, rec: 0.34, dmg: c.lightDmg, range: 102 };
    if (kind === 'heavy') return { kind, wind: c.heavyWind * f, act: 0.14, rec: 0.6, dmg: c.heavyDmg, range: 118, unblock: true };
    return { kind: 'feint', wind: c.heavyWind * 0.55 * f, act: 0, rec: 0, dmg: 0, range: 0 };
  }

  updateFighter(F, dt, O) {
    F.t += dt; F.flash = Math.max(0, F.flash - dt);
    F.chainT -= dt; if (F.chainT <= 0) F.chain = 0;
    if (F.state !== 'block' && F.state !== 'dead') F.st = Math.min(100, F.st + dt * 26);
    switch (F.state) {
      case 'windup':
        if (F.t >= F.atk.wind) {
          if (F.atk.kind === 'feint') { F.startAttack({ kind: 'light', wind: 0.16, act: 0.1, rec: 0.34, dmg: this.cfg.lightDmg + 3, range: 104 }); break; }
          F.state = 'active'; F.t = 0; sfx.slash();
        }
        break;
      case 'active':
        F.x += F.face * 260 * dt * (F.atk.kind === 'heavy' ? 1.4 : 1);
        if (!F.hitDone && Math.abs(O.x - F.x) < F.atk.range && Math.sign(O.x - F.x) === F.face) { F.hitDone = true; this.resolveHit(F, O, F.atk); }
        if (F.t >= F.atk.act) { F.state = 'recover'; F.t = 0; }
        break;
      case 'recover': if (F.t >= F.atk.rec) F.state = 'idle'; break;
      case 'parry': if (F.t >= 0.17) { if (F.blockHeld) { F.state = 'block'; F.t = 0; if (!F.isPlayer) F.blockT = 0.3; } else { F.state = 'precover'; F.t = 0; } } break;
      case 'precover': if (F.t >= 0.2) F.state = 'idle'; break;
      case 'block': if (F.isPlayer && !F.blockHeld) F.state = 'idle'; break;
      case 'stagger': case 'hit': if (F.t >= F.stunDur) F.state = 'idle'; break;
      case 'dodge': F.x -= F.face * 380 * dt * Math.max(0, 1 - F.t / 0.34); if (F.t >= 0.34) F.state = 'idle'; break;
      case 'throw':
        if (F.t >= 0.32 && !F.thrown) { F.thrown = true; this.knives.push({ x: F.x + F.face * 30, y: FLOOR - 78, vx: F.face * 560, from: F, back: false, rot: 0 }); sfx.whoosh(); }
        if (F.t >= 0.6) { F.state = 'idle'; F.thrown = false; }
        break;
    }
  }

  resolveHit(att, def, atk) {
    const hx = (att.x + def.x) / 2, hy = FLOOR - 80;
    if (def.state === 'dodge' && def.t < 0.28) { this.floats.add(def.x, FLOOR - 140, 'DODGE', '#c8d8ff', 16); return; }
    if (def.state === 'parry') {
      att.state = 'stagger'; att.t = 0; att.stunDur = atk.kind === 'heavy' ? 1.35 : 1.0;
      sfx.parry(); this.shake = 7; this.slowT = 0.22;
      this.parts.burst(hx, hy, 26, ['#fff6d0', '#ffd27a', '#ffffff'], 380, 0.4, 3, 300, 2);
      this.floats.add(def.x, FLOOR - 150, 'PARRY', '#e0b552', 26, 1.2);
      if (def.isPlayer) this.stats.parries++;
      return;
    }
    if (def.state === 'block' && !atk.unblock && Math.sign(att.x - def.x) === def.face) {
      def.st -= atk.dmg * 1.9; def.hp -= atk.dmg * 0.12;
      sfx.clang(); this.parts.burst(hx, hy, 10, ['#ffd27a', '#ffffff'], 220, 0.3, 2, 300);
      def.x -= def.face * 14;
      if (!def.isPlayer) { this.ai.counter = true; def.blockT = Math.min(def.blockT, 0.12); }
      if (def.st <= 0) { def.st = 0; def.state = 'stagger'; def.t = 0; def.stunDur = 0.9; this.floats.add(def.x, FLOOR - 150, 'GUARD BROKEN', '#ff6a3a', 20); }
      this.checkDeath(def);
      return;
    }
    let dmg = atk.dmg;
    if (def.state === 'stagger') { dmg *= 2; this.floats.add(def.x, FLOOR - 165, att.isPlayer ? 'RIPOSTE' : 'PUNISHED', '#ff4a3a', 20); }
    def.hp -= dmg; def.flash = 0.15; sfx.hit(); this.shake = atk.kind === 'heavy' ? 10 : 5;
    this.parts.burst(hx, hy, 14, ['#b0141c', '#e02a2a', '#6a0a0e'], 220, 0.6, 3, 500);
    this.floats.add(def.x, FLOOR - 130, `-${Math.round(dmg)}`, def.isPlayer ? '#ff4a3a' : '#f1e4cc', 18);
    const poise = def.state === 'windup' && def.atk && def.atk.kind === 'heavy';
    if (!def.isPlayer && def.state !== 'stagger') { def.chain++; def.chainT = 1.1; }
    if (!def.isPlayer && def.chain >= 3) {
      // nobody stands still for a fourth blow: guard up, then counter
      def.chain = 0; def.state = 'block'; def.t = 0; def.blockT = 0.55; this.ai.counter = true;
      this.floats.add(def.x, FLOOR - 165, 'GUARD UP', '#c8d8ff', 16);
    } else if (!poise && def.state !== 'stagger') { def.state = 'hit'; def.t = 0; def.stunDur = 0.26; }
    def.x += att.face * 20;
    this.checkDeath(def);
  }
  checkDeath(F) {
    if (F.hp > 0 || this.state !== 'fight') return;
    F.hp = 0; F.state = 'dead'; F.t = 0;
    this.slowT = 1.4; this.stT = 0;
    this.state = F.isPlayer ? 'lost' : 'won';
    if (this.state === 'won') {
      sfx.fanfare();
      this.rankIdx = Ranks.grade(this.P.hp / this.P.maxHp, [0.7, 0.45, 0.25, 0.1]);
      this.newBest = Ranks.record(this.cfg.chapter, this.rankIdx);
    } else sfx.hurt();
  }

  updateKnives(dt) {
    for (const k of this.knives) {
      k.x += k.vx * dt; k.rot += dt * 30;
      const target = k.back ? this.E : this.P;
      if (Math.abs(k.x - target.x) < 22 && !k.dead) {
        if (!k.back && target.state === 'parry') {
          k.back = true; k.vx = -k.vx * 1.25; sfx.parry(); this.slowT = 0.15;
          this.floats.add(target.x, FLOOR - 150, 'DEFLECTED', '#e0b552', 22); this.stats.parries++;
        } else if (target.state === 'dodge' && target.t < 0.28) {
          // passes through
        } else if (target.state === 'block' && Math.sign(k.x - target.x) === target.face) {
          k.dead = true; sfx.clang(); target.st -= 12;
        } else {
          k.dead = true; const dmg = k.back ? 14 : 8;
          target.hp -= dmg; target.flash = 0.15; sfx.hit();
          this.parts.burst(target.x, FLOOR - 78, 10, ['#b0141c', '#e02a2a'], 160, 0.5, 3, 400);
          this.floats.add(target.x, FLOOR - 130, `-${dmg}`, target.isPlayer ? '#ff4a3a' : '#f1e4cc', 18);
          if (target.canAct()) { target.state = 'hit'; target.t = 0; target.stunDur = 0.2; }
          this.checkDeath(target);
        }
      }
    }
    this.knives = this.knives.filter((k) => !k.dead && k.x > -40 && k.x < W + 40);
  }

  // --------------------------------------------------------------- render --
  drawArena() {
    const t = this.time;
    if (this.cfg.arena === 'passage') {
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#120a08'); g.addColorStop(1, '#2a1a12');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2;
      for (let y = 40; y < FLOOR; y += 46) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        for (let x = ((y / 46) % 2) * 60; x < W; x += 120) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 46); ctx.stroke(); }
      }
      for (const tx of [150, 810]) {
        const fl = 0.8 + 0.2 * Math.sin(t * 13 + tx) + 0.1 * Math.sin(t * 31);
        const lg = ctx.createRadialGradient(tx, 200, 5, tx, 200, 260 * fl);
        lg.addColorStop(0, 'rgba(255,170,80,.4)'); lg.addColorStop(1, 'rgba(255,170,80,0)');
        ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#3a2418'; ctx.fillRect(tx - 4, 205, 8, 40);
        ctx.fillStyle = '#ffb04a'; ctx.beginPath(); ctx.ellipse(tx, 195, 7 * fl, 14 * fl, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff0b0'; ctx.beginPath(); ctx.ellipse(tx, 199, 3, 7 * fl, 0, 0, TAU); ctx.fill();
      }
      // the sealed door
      ctx.fillStyle = '#0a0605'; ctx.fillRect(W / 2 - 50, 230, 100, FLOOR - 230);
      ctx.strokeStyle = '#4a2f1c'; ctx.lineWidth = 4; ctx.strokeRect(W / 2 - 50, 230, 100, FLOOR - 230);
      ctx.fillStyle = '#c0262d'; ctx.beginPath(); ctx.arc(W / 2, 290, 10, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1c120d'; ctx.fillRect(0, FLOOR, W, H - FLOOR);
      ctx.fillStyle = '#2e2018'; ctx.fillRect(0, FLOOR, W, 4);
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#08101e'); g.addColorStop(1, '#3a4660');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      drawStars(t, 0.6);
      ctx.fillStyle = '#e8e2d4'; ctx.beginPath(); ctx.arc(780, 90, 30, 0, TAU); ctx.fill();
      drawCastleSil(250, 330, 1.2, '#1a2232');
      ctx.fillStyle = '#ff9a4a'; for (const [x, y] of [[210, 290], [290, 290], [250, 240]]) ctx.fillRect(x, y, 5, 8);
      drawHills(t, ['#7a8aa4', '#aab6c8'], 360, 22);
      ctx.fillStyle = '#e6ecf4'; ctx.fillRect(0, FLOOR, W, H - FLOOR);
      ctx.fillStyle = '#c4ccd8'; ctx.fillRect(0, FLOOR, W, 3);
    }
  }

  drawFighter(F) {
    const pal = F.pal, t = F.t;
    ctx.save();
    ctx.translate(F.x, FLOOR);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, 2, 34, 6, 0, 0, TAU); ctx.fill();
    ctx.scale(F.face, 1);
    let lean = 0, blade = -0.9, crouch = 0, legA = 0, glint = null, trail = false, handX = 14, handY = -66;
    const k = F.atk ? clamp(t / Math.max(0.01, F.state === 'windup' ? F.atk.wind : F.state === 'active' ? F.atk.act : F.atk.rec), 0, 1) : 0;
    switch (F.state) {
      case 'idle': crouch = Math.sin(this.time * 3) * 1.5; break;
      case 'walk': legA = Math.sin(F.walkPh) * 0.5; crouch = Math.abs(Math.sin(F.walkPh)) * 2; break;
      case 'windup':
        if (F.atk.kind === 'light') { blade = lerp(-0.9, -2.3, k); lean = -0.08 * k; glint = '#ffffff'; }
        else { blade = lerp(-0.9, -3.0, k); lean = -0.14 * k; crouch = 6 * k; glint = '#ff2a1a'; handY = -78; handX = 4; }
        break;
      case 'active': blade = lerp(-2.4, 0.9, k); lean = 0.18; trail = true; handX = 24; legA = 0.4; break;
      case 'recover': blade = lerp(0.9, -0.9, k); lean = 0.1 * (1 - k); break;
      case 'parry': case 'block': blade = -1.45; handX = 22; handY = -74; lean = -0.04; break;
      case 'precover': blade = -1.2; handX = 16; break;
      case 'stagger': lean = -0.32 + Math.sin(this.time * 18) * 0.05; blade = -0.1; handX = 4; break;
      case 'hit': lean = -0.22; blade = -0.4; break;
      case 'dodge': lean = -0.38; crouch = 12; blade = -1.0; break;
      case 'throw': blade = -0.6; handX = lerp(-6, 30, clamp(t / 0.32, 0, 1)); handY = -76; break;
      case 'dead': ctx.rotate(-Math.min(1.45, t * 3)); ctx.translate(0, Math.min(16, t * 30)); break;
    }
    ctx.rotate(lean);
    const hipY = -44 + crouch;
    // cloak
    ctx.fillStyle = pal.cloak;
    ctx.beginPath(); ctx.moveTo(-8, -76 + crouch);
    ctx.quadraticCurveTo(-30 - Math.sin(this.time * 4) * 4, -40, -34 - Math.sin(this.time * 3) * 6, -6 + crouch);
    ctx.lineTo(-12, -10 + crouch); ctx.closePath(); ctx.fill();
    // legs
    ctx.strokeStyle = pal.armor; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-4, hipY); ctx.lineTo(-10 - Math.sin(legA) * 16, -2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, hipY); ctx.lineTo(12 + Math.sin(legA) * 16, -2); ctx.stroke();
    // torso
    ctx.fillStyle = F.flash > 0 ? '#ffffff' : pal.armor;
    ctx.beginPath(); ctx.moveTo(-12, -80 + crouch); ctx.lineTo(12, -80 + crouch); ctx.lineTo(9, hipY); ctx.lineTo(-9, hipY); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = pal.trim; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = pal.trim; ctx.fillRect(-9, hipY - 6, 18, 4);
    // head
    ctx.fillStyle = pal.skin; ctx.beginPath(); ctx.arc(3, -92 + crouch, 10, 0, TAU); ctx.fill();
    ctx.fillStyle = pal.hair; ctx.beginPath(); ctx.arc(1, -95 + crouch, 10.5, Math.PI * 0.95, Math.PI * 2.1); ctx.fill();
    ctx.fillStyle = '#e0b552'; ctx.fillRect(8, -94 + crouch, 3, 2);
    // arm and blade
    const sx = 6, sy = -74 + crouch, hx = handX, hy = handY + crouch;
    ctx.strokeStyle = pal.armor; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke();
    const L = this.cfg.knife && !F.isPlayer ? 74 : 66;
    const bx = hx + Math.cos(blade) * L, by = hy + Math.sin(blade) * L;
    if (trail) {
      ctx.strokeStyle = 'rgba(255,240,210,.35)'; ctx.lineWidth = 16;
      ctx.beginPath(); ctx.arc(hx, hy, L * 0.8, blade - 1.4, blade); ctx.stroke();
    }
    ctx.strokeStyle = pal.blade; ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.moveTo(hx, hy);
    // slingBlades curve like a sickle
    const cxp = hx + Math.cos(blade - 0.35) * L * 0.6, cyp = hy + Math.sin(blade - 0.35) * L * 0.6;
    ctx.quadraticCurveTo(cxp, cyp, bx, by); ctx.stroke();
    ctx.strokeStyle = '#2a2224'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx - Math.cos(blade) * 10, hy - Math.sin(blade) * 10); ctx.stroke();
    if (glint) {
      const s = 6 + 6 * Math.sin(this.time * 30);
      ctx.fillStyle = glint; ctx.shadowColor = glint; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.moveTo(bx, by - s); ctx.lineTo(bx + 2, by - 2); ctx.lineTo(bx + s, by); ctx.lineTo(bx + 2, by + 2); ctx.lineTo(bx, by + s); ctx.lineTo(bx - 2, by + 2); ctx.lineTo(bx - s, by); ctx.lineTo(bx - 2, by - 2); ctx.fill();
      ctx.shadowBlur = 0;
    }
    if (F.state === 'stagger') { txt('✶', 2, -116, { size: 18, align: 'center', color: '#ffd27a', font: FH }); }
    ctx.restore();
  }

  draw() {
    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    ctx.save(); ctx.translate(sx, sy);
    this.drawArena();
    this.drawFighter(this.E); this.drawFighter(this.P);
    for (const k of this.knives) {
      ctx.save(); ctx.translate(k.x, k.y); ctx.rotate(k.rot);
      ctx.fillStyle = k.back ? '#ffd27a' : '#e8eef2'; ctx.fillRect(-10, -1.5, 20, 3); ctx.fillStyle = '#3a2a1a'; ctx.fillRect(-10, -2.5, 6, 5);
      ctx.restore();
    }
    this.parts.draw(); this.floats.draw();
    ctx.restore();
    if (this.snow) { ctx.fillStyle = 'rgba(255,255,255,.8)'; for (const s of this.snow) ctx.fillRect(s.x, s.y, s.s, s.s); }
    this.drawHUD();
  }
  drawHUD() {
    const P = this.P, E = this.E;
    panel(12, 12, 340, 64);
    txt('DARROW', 26, 36, { size: 18, weight: 800, color: '#e0b552' });
    bar(26, 44, 312, 12, P.hp / P.maxHp, '#c0262d');
    bar(26, 60, 312 * 0.7, 6, P.st / 100, P.st < 20 ? '#ff6a3a' : '#e0b552');
    panel(W - 352, 12, 340, 52);
    txt(this.cfg.name.toUpperCase(), W - 26, 36, { size: 18, weight: 800, align: 'right', color: '#f1e4cc' });
    ctx.save(); ctx.translate(W - 26, 0); ctx.scale(-1, 1); bar(0, 44, 312, 12, E.hp / E.maxHp, '#d8d0c0'); ctx.restore();
    if (this.ai.tauntT > 0 && this.state === 'fight') {
      ctx.globalAlpha = clamp(this.ai.tauntT, 0, 1);
      txt(`“${this.ai.taunt}”`, E.x, FLOOR - 150, { size: 18, font: FB, weight: 400, align: 'center', color: '#f1e4cc', stroke: 'rgba(0,0,0,.7)', strokeW: 4 });
      ctx.globalAlpha = 1;
    }
    if (this.state === 'fight' && this.stT < 9 && this.cfg.chapter === 2) {
      txt('Tap B the instant a blow lands to PARRY.  Red glint = heavy: parry or dodge (Up).', W / 2, H - 22, { size: 17, font: FB, align: 'center', color: '#e0b552', stroke: 'rgba(0,0,0,.8)' });
    }
    if (this.state === 'intro') {
      drawChapterBanner(this.cfg.chapter, this.stT, 2.4);
    }
    if ((this.state === 'won' || this.state === 'lost') && this.stT > 1.0) {
      const a = clamp((this.stT - 1) * 2, 0, 1);
      ctx.fillStyle = `rgba(0,0,0,${0.6 * a})`; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = a;
      const won = this.state === 'won';
      const title = won ? (this.cfg.knife ? 'THE JACKAL FALLS' : 'ONE WALKS OUT') : 'YOU FALL';
      const sub = won ? `Parries: ${this.stats.parries}` : (this.cfg.knife ? 'The Jackal laughs. The Society endures.' : 'The Carver\'s work, wasted.');
      txt(title, W / 2, H / 2 - 10, { size: 52, weight: 800, align: 'center', color: won ? '#e0b552' : '#ff4a3a', glow: 'rgba(192,38,45,.8)' });
      txt(sub, W / 2, H / 2 + 30, { size: 20, font: FB, weight: 400, align: 'center' });
      if (won) drawRank(W / 2 - 40, H / 2 + 76, this.rankIdx, 'RANK', this.newBest);
      if (this.stT > 2.2) txt(won ? 'A / TAP  CONTINUE' : 'A / TAP  TRY AGAIN    ·    B  TITLE', W / 2, H / 2 + (won ? 124 : 86), { size: 16, font: FH, weight: 700, align: 'center', color: 'rgba(241,228,204,.7)' });
      ctx.globalAlpha = 1;
    }
  }
}
