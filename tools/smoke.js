const { chromium } = require('playwright');
const OUT = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await pg.goto('file://' + require('path').resolve(__dirname, '../index.html'));
  await pg.waitForTimeout(1500);
  await pg.screenshot({ path: OUT + '/1-title.png' });
  const goScene = async (code) => { await pg.evaluate(code); await pg.waitForTimeout(900); };
  // story card
  await goScene(`__btc.go(new __btc.StoryScene(__btc.CARDS.intro, ()=>{}))`);
  await pg.keyboard.press('KeyJ'); await pg.waitForTimeout(300); await pg.keyboard.press('KeyJ'); await pg.waitForTimeout(1200);
  await pg.screenshot({ path: OUT + '/2-story.png' });
  await goScene(`__btc.go(new __btc.StoryScene(__btc.CARDS.mineWin(80,70).slice(4), ()=>{}))`);
  await pg.waitForTimeout(2500);
  await pg.screenshot({ path: OUT + '/2b-pyramid.png' });
  // mine
  await goScene(`__btc.go(new __btc.MineScene())`);
  await pg.waitForTimeout(2800);
  await pg.keyboard.down('ArrowDown'); await pg.waitForTimeout(5000); await pg.keyboard.up('ArrowDown');
  await pg.keyboard.press('KeyJ'); await pg.waitForTimeout(400);
  await pg.screenshot({ path: OUT + '/3-mine.png' });
  // duel
  await goScene(`__btc.go(new __btc.DuelScene(__btc.FOES.julian))`);
  await pg.waitForTimeout(2600);
  for (let i = 0; i < 6; i++) { await pg.keyboard.press('KeyD'); await pg.keyboard.down('KeyD'); await pg.waitForTimeout(200); await pg.keyboard.up('KeyD'); await pg.keyboard.press('KeyJ'); await pg.waitForTimeout(250); }
  await pg.screenshot({ path: OUT + '/4-duel.png' });
  await goScene(`__btc.go(new __btc.DuelScene(__btc.FOES.jackal))`);
  await pg.waitForTimeout(4200);
  await pg.screenshot({ path: OUT + '/5-jackal.png' });
  // institute
  await goScene(`__btc.go(new __btc.InstituteScene())`);
  await pg.waitForTimeout(3200);
  await pg.keyboard.down('KeyD'); await pg.keyboard.down('KeyW'); await pg.waitForTimeout(2500); await pg.keyboard.up('KeyD'); await pg.keyboard.up('KeyW');
  await pg.screenshot({ path: OUT + '/6-institute.png' });
  // headless simulation of the conquest: teleport to each castle, let the fight play out
  const sim = await pg.evaluate(() => {
    const s = __btc.scene; const log = [];
    const p = s.player; p.maxHp = 99999; p.hp = 99999; p.dmg = 400;
    const step = (n) => { for (let i = 0; i < n; i++) s.update(1 / 30); };
    for (const id of ['ceres', 'minerva', 'diana', 'jupiter', 'olympus']) {
      const c = s.castles.find(c => c.id === id);
      for (let k = 0; k < 40 && c.owner !== 'mars'; k++) {
        // kill nearby enemies, then stand on the standard
        for (const u of s.units) if (s.hostile(p, u) && s.active(u) && Math.hypot(u.x - c.x, u.y - c.y) < 400) s.damage(u, 99999, p);
        p.x = c.x; p.y = c.y + 20; step(30);
      }
      log.push(id + ':' + c.owner + ' open=' + s.olympusOpen + ' units=' + s.units.length + ' state=' + s.state);
    }
    return log;
  });
  console.log(sim.join('\n'));
  await pg.waitForTimeout(500);
  await pg.screenshot({ path: OUT + '/7-institute-end.png' });
  // mine simulation: drill a lot, make sure nothing throws
  const m = await pg.evaluate(() => {
    __btc.go(new __btc.MineScene()); return 'ok';
  });
  await pg.waitForTimeout(1200);
  const mr = await pg.evaluate(() => {
    const s = __btc.scene; s.state = 'play';
    for (let i = 0; i < 3000; i++) { s.p.hull = 100; s.update(1 / 30); if (i % 7 === 0) s.breakTile(Math.floor(Math.random()*38)+1, Math.floor(Math.random()*90)+4, Math.random()<.5); }
    return `he3=${s.he3} vipers=${s.vipers.length} state=${s.state} gamma=${Math.floor(s.rivals[0].v)}`;
  });
  console.log('mine sim', mr);
  await goScene(`__btc.go(new __btc.CreditsScene())`);
  await pg.waitForTimeout(4000);
  await pg.screenshot({ path: OUT + '/8-credits.png' });
  console.log('ERRORS:', errs.length ? errs.join('\n') : 'none');
  await b.close();
})();
