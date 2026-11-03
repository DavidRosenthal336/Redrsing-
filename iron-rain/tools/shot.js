// Screenshots Iron Rain at chosen moments, headlessly.
// usage: node iron-rain/tools/shot.js <three-npm-dir> <outdir> <hash> [alt=62] [t=4] [eval=code] [wait=ms] [key=KeyW:1500] ...
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const [THREE_DIR, OUT, HASH, ...steps] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const pg = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  pg.on('pageerror', (e) => errs.push('PAGE ' + e.message));
  pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  await pg.route('https://cdn.jsdelivr.net/npm/three@0.147.0/**', (r) => r.fulfill({ body: fs.readFileSync(path.join(THREE_DIR, r.request().url().split('three@0.147.0/')[1])), contentType: 'application/javascript' }));
  await pg.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
  await pg.goto('file://' + path.resolve(__dirname, '../index.html') + (HASH && HASH !== '-' ? '#' + HASH : ''));
  await pg.waitForFunction(() => !document.getElementById('begin').disabled, null, { timeout: 120000 });
  await pg.waitForTimeout(800);
  let n = 0;
  for (const st of steps) {
    const i = st.indexOf('='), k = st.slice(0, i), v = st.slice(i + 1);
    if (k === 'wait') { await pg.waitForTimeout(+v); continue; }
    if (k === 'key') { const [code, ms] = v.split(':'); await pg.keyboard.down(code); await pg.waitForTimeout(+ms || 100); await pg.keyboard.up(code); continue; }
    if (k === 'click') { await pg.click(v); continue; }
    await pg.evaluate(([k, v]) => {
      const p = __ir.Game.phase;
      if (k === 'alt') { p.alt = +v; p.hp = 100; } else if (k === 't') p.t = +v; else if (k === 'eval') (0, eval)(v);
    }, [k, v]);
    if (k === 'eval' && !v.includes('SHOT')) continue;
    await pg.waitForTimeout(1400);
    await pg.evaluate(() => { const p = __ir.Game.phase; if (p && p.hp !== undefined && p.state === 'fall') p.hp = 100; });
    const name = `${OUT}/${String(++n).padStart(2, '0')}-${(HASH || 'title').replace(/\W/g, '')}-${st.replace(/[^a-z0-9.]/gi, '_').slice(0, 24)}.png`;
    await pg.screenshot({ path: name }); console.log('saved', name);
  }
  console.log('ERRORS:', errs.length ? [...new Set(errs)].join('\n') : 'none');
  await b.close();
})();
