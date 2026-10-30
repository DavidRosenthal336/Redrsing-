const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage();
  await pg.goto('file://' + require('path').resolve(__dirname, '../index.html')); await pg.waitForTimeout(500);
  const res = await pg.evaluate(() => {
    const G = __btc, out = {};
    // bot skill: reaction noise (s), chance to notice a telegraph
    function fight(foe, noise, notice) {
      const s = new G.DuelScene(foe); s.state = 'fight';
      const k = G.keys; let plannedParry = -1, seenAtk = -1, t = 0;
      for (let f = 0; f < 30 * 180; f++) {
        for (const n in k) k[n] = false;
        const P = s.P, E = s.E, d = Math.abs(E.x - P.x);
        if (E.state === 'windup' && E.atkId !== seenAtk) {
          seenAtk = E.atkId;
          plannedParry = Math.random() < notice ? t + E.atk.wind - 0.06 + (Math.random() * 2 - 1) * noise : -1;
          if (E.atk.kind === 'feint') plannedParry = t + E.atk.wind - 0.06 + (Math.random()*2-1)*noise; // fooled
        }
        if (plannedParry > 0 && t >= plannedParry) { k.b = true; plannedParry = -1; }
        else if (s.knives.some(kn => !kn.back && Math.abs(kn.x - P.x) < 70 && Math.abs(kn.x - P.x) > 40)) k.b = Math.random() < notice;
        else if (['stagger','recover','hit','idle','walk','throw'].includes(E.state) && d < 105 && P.st > 20) k.a = (f % 4 === 0);
        else if (d > 95) k[E.x > P.x ? 'right' : 'left'] = true;
        G.pollInput(); s.update(1 / 30); t += 1 / 30;
        if (s.state !== 'fight') return { win: s.state === 'won', hp: Math.round(P.hp), t: Math.round(t) };
      }
      return { win: false, hp: -1, t: 180 };
    }
    for (const [name, noise, notice] of [['novice', .2, .5], ['decent', .12, .75], ['good', .07, .9]]) {
      for (const foe of ['julian', 'jackal']) {
        let w = 0, hp = 0, tt = 0; const N = 40;
        for (let i = 0; i < N; i++) { const r = fight(G.FOES[foe], noise, notice); if (r.win) { w++; hp += r.hp; } tt += r.t; }
        out[name + ' vs ' + foe] = `win ${Math.round(w / N * 100)}%  avgHPleft ${w ? Math.round(hp / w) : 0}  avgTime ${Math.round(tt / N)}s`;
      }
    }
    return out;
  });
  console.log(res); await b.close();
})();
