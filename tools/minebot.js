const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage();
  await pg.goto('file://' + require('path').resolve(__dirname, '../index.html')); await pg.waitForTimeout(500);
  const res = await pg.evaluate(() => {
    const G = __btc, k = G.keys;
    const COST = [0.11, 0.2, 0.42, 0.95, 0.35, 1.0, 1e9];
    function run(greed) {
      const s = new G.MineScene(); s.state = 'play';
      const C = s.cols, R = s.rows; let path = [];
      for (let f = 0; f < 30 * 175 && s.state === 'play'; f++) {
        for (const n in k) k[n] = false;
        const p = s.p;
        if (!path.length || s.get(path[path.length - 1] % C, (path[path.length - 1] / C) | 0) !== 4) {
          // Dijkstra to best vein by yield/cost
          const dist = new Float32Array(C * R).fill(1e9), prev = new Int32Array(C * R).fill(-1), done = new Uint8Array(C * R);
          const st = p.gx + p.gy * C; dist[st] = 0; const open = [st]; let best = -1, bestScore = -1;
          while (open.length) {
            let bi = 0; for (let i = 1; i < open.length; i++) if (dist[open[i]] < dist[open[bi]]) bi = i;
            const i = open.splice(bi, 1)[0]; if (done[i]) continue; done[i] = 1;
            const t = s.g[i];
            if (t === 4 && i !== st) { const sc = Math.pow(s.yieldAt(i % C, (i / C) | 0), greed) / (dist[i] + 0.3); if (sc > bestScore) { bestScore = sc; best = i; } }
            if (dist[i] > 14) continue;
            const x = i % C, y = (i / C) | 0;
            for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
              const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= C || ny >= R) continue;
              const j = nx + ny * C, nd = dist[i] + COST[s.g[j]] + 0.11;
              if (nd < dist[j]) { dist[j] = nd; prev[j] = i; open.push(j); }
            }
          }
          path = []; for (let i = best; i >= 0 && i !== st; i = prev[i]) path.unshift(i);
        }
        const vip = s.vipers.find(v => Math.abs(v.gx - p.gx) + Math.abs(v.gy - p.gy) === 1);
        if (vip) { if (vip.gx > p.gx) k.right = true; else if (vip.gx < p.gx) k.left = true; else if (vip.gy > p.gy) k.down = true; else k.up = true; path = []; }
        else if (path.length) {
          const nx = path[0] % C, ny = (path[0] / C) | 0;
          if (nx === p.gx && ny === p.gy) path.shift();
          else {
            if (nx > p.gx) k.right = true; else if (nx < p.gx) k.left = true; else if (ny > p.gy) k.down = true; else k.up = true;
            if (s.get(nx, ny) === 5) k.b = true;
          }
        }
        if (f % 200 === 0) k.a = true;
        G.pollInput(); s.update(1 / 30);
      }
      return { he3: s.he3, gamma: Math.floor(s.rivals[0].v), hull: Math.round(s.p.hull), state: s.state, depth: s.maxDepth };
    }
    const out = [];
    for (const greed of [0, 1, 2]) {
      const rs = []; for (let i = 0; i < 12; i++) rs.push(run(greed));
      const avg = (f) => Math.round(rs.reduce((a, r) => a + f(r), 0) / rs.length);
      out.push(`greed${greed}: he3 avg ${avg(r => r.he3)} (min ${Math.min(...rs.map(r => r.he3))}, max ${Math.max(...rs.map(r => r.he3))})  gamma ${avg(r => r.gamma)}  hull ${avg(r => r.hull)}  won ${rs.filter(r => r.state === 'won').length}/12  lost ${rs.filter(r => r.state === 'lost').length}  depth ${avg(r=>r.depth)}`);
    }
    return out;
  });
  console.log(res.join('\n')); await b.close();
})();
