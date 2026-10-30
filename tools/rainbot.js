const { chromium } = require('playwright');
const OUT = process.argv[2];
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await pg.goto('file://' + require('path').resolve(__dirname, '../index.html')); await pg.waitForTimeout(500);
  const res = await pg.evaluate(() => {
    const G = __btc, k = G.keys, out = [];
    function run(skill) {
      const s = new G.RainScene(); s.state = 'fall';
      for (let f = 0; f < 30 * 100 && s.state === 'fall'; f++) {
        for (const n in k) k[n] = false;
        const p = s.p; let tx = p.x, ty = 300;
        const d = s.drifters.filter(d => d.y < 520).sort((a, b) => a.y - b.y)[0];
        if (d) { tx = d.x; ty = d.y; }
        if (s.phase() === 3) tx = s.zoneX;
        let fx = 0, fy = 0;
        for (const fl of s.flak) if (!fl.boomed && Math.random() < skill) { const dd = Math.hypot(p.x - fl.x, p.y - fl.y); if (dd < fl.r + 30) { fx += (p.x - fl.x) / (dd + 1) * 3; fy += (p.y - fl.y) / (dd + 1) * 3; } }
        for (const o of [...s.debris, ...s.foes, ...s.bolts]) { const dd = Math.hypot(p.x - o.x, p.y - o.y); if (dd < 70 && Math.random() < skill) { fx += (p.x - o.x) / (dd + 1) * 2; fy += (p.y - o.y) / (dd + 1) * 2; } }
        const mx = (tx - p.x) / 80 + fx, my = (ty - p.y) / 80 + fy;
        if (mx > 0.3) k.right = true; if (mx < -0.3) k.left = true; if (my > 0.3) k.down = true; if (my < -0.3) k.up = true;
        if (Math.abs(fx) + Math.abs(fy) > 2 && Math.random() < skill * 0.1) k.b = true;
        k.a = true;
        G.pollInput(); s.update(1 / 30);
      }
      return { state: s.state, hp: Math.round(s.p.hp), landed: s.landed, kills: s.kills, score: s.score, rank: s.rankIdx };
    }
    for (const skill of [0.5, 0.75, 0.95]) {
      const rs = []; for (let i = 0; i < 15; i++) rs.push(run(skill));
      const ok = rs.filter(r => r.state === 'landed');
      const avg = (f) => ok.length ? Math.round(ok.reduce((a, r) => a + f(r), 0) / ok.length) : 0;
      out.push(`skill ${skill}: landed ${ok.length}/15  hp ${avg(r => r.hp)}  stick ${avg(r => r.landed)}  kills ${avg(r => r.kills)}  score ${avg(r => r.score)}  ranks ${ok.map(r => ['G','S','C','g','R'][r.rank]).join('')}`);
    }
    return out;
  });
  console.log(res.join('\n'));
  // screenshots at each altitude
  for (const alt of [55, 32, 12, 2]) {
    await pg.evaluate((alt) => { const s = new __btc.RainScene(); __btc.go(s); window.__rs = s; }, alt);
    await pg.waitForTimeout(700);
    await pg.evaluate((alt) => { const s = __btc.scene; s.state = 'fall'; s.alt = alt; for (let i = 0; i < 150; i++) { s.p.hp = 100; __btc.pollInput(); s.update(1/30); } }, alt);
    await pg.keyboard.down('KeyJ'); await pg.waitForTimeout(900); await pg.keyboard.up('KeyJ');
    await pg.screenshot({ path: `${OUT}/rain-${alt}.png` });
  }
  await pg.evaluate(() => { __btc.go(new __btc.TitleScene()); }); await pg.waitForTimeout(800);
  await pg.evaluate(() => { const s = __btc.scene; s.mode = 'chapters'; __btc.Save.unlock(5); __btc.Ranks.record(1, 0); __btc.Ranks.record(2, 2); __btc.Ranks.record(4, 4); });
  await pg.waitForTimeout(300); await pg.screenshot({ path: `${OUT}/title-chapters.png` });
  await pg.evaluate(() => { __btc.go(new __btc.StoryScene(__btc.CARDS.rain, () => {})); }); await pg.waitForTimeout(2500);
  await pg.screenshot({ path: `${OUT}/story-space.png` });
  console.log('ERRORS:', errs.length ? errs.join('\n') : 'none');
  await b.close();
})();
