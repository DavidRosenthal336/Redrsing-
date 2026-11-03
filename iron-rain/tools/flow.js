// Plays the whole experience with scripted input and no rendering, checking every phase is reached.
// usage: node iron-rain/tools/flow.js <three-npm-dir>
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const THREE_DIR = process.argv[2];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 320, height: 180 } });
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.route('https://cdn.jsdelivr.net/npm/three@0.147.0/**', (r) => r.fulfill({ body: fs.readFileSync(path.join(THREE_DIR, r.request().url().split('three@0.147.0/')[1])), contentType: 'application/javascript' }));
  await pg.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '' }));
  await pg.goto('file://' + path.resolve(__dirname, '../index.html'));
  await pg.waitForFunction(() => !document.getElementById('begin').disabled, null, { timeout: 120000 });
  await pg.click('#begin');
  const log = await pg.evaluate(async () => {
    const ir = __ir, out = [], G = ir.Game, I = ir.Input; ir.capture(true);
    const name = () => (G.phase ? G.phase.constructor.name + (G.phase.state ? ':' + G.phase.state : '') : 'none');
    let lastName = '';
    const run = (sec, each) => { for (let i = 0; i < sec * 30; i++) { if (each) each(i); ir.tick(1 / 30, false); const n = name(); if (n !== lastName) { out.push(`${(i / 30).toFixed(1)}s ${n}`); lastName = n; } } };
    run(1.5);
    const bay = G.phase; bay.pos.set(0.5, 1.72, -29.8); bay.yaw = 0;
    run(8, (i) => { if (i % 9 === 0) I.hits.a = true; });
    out.push('dialogue done: ' + (bay.talked && bay.state === 'walk') + ' objective: ' + document.getElementById('objective').textContent);
    bay.pos.set(0, 1.72, -33.6);
    run(1.5, (i) => { if (i === 10) I.hits.a = true; });
    run(12);
    out.push('cinematic reached: ' + name());
    run(12);
    const fall = G.phase; out.push('fall: ' + name() + ' alt ' + (fall.alt && fall.alt.toFixed(1)));
    // dive with invulnerability so the whole descent can be checked
    run(110, () => { fall.inv = 1; });
    out.push('after fall: ' + name() + ' alt ' + fall.alt.toFixed(2));
    run(8);
    out.push('end card visible: ' + !document.getElementById('end').hidden + ' stats: ' + document.getElementById('stats').textContent);
    // retry path, then die on purpose
    document.getElementById('again').click(); run(2);
    out.push('retry: ' + name() + ' alt ' + G.phase.alt.toFixed(1));
    G.phase.hp = 1; G.phase.damage(10, G.phase.pp.clone()); run(4);
    out.push('death card: ' + document.querySelector('#end h2').textContent + ' visible ' + !document.getElementById('end').hidden);
    return out;
  });
  console.log(log.join('\n')); console.log('ERRORS:', errs.length ? errs.join('\n') : 'none');
  await b.close();
})();
