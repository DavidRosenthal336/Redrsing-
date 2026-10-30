// ---------------------------------------------------------------------------
// Story: backdrops, cards, title, credits, chapter flow
// ---------------------------------------------------------------------------
const STARS = Array.from({ length: 180 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 1.6 + 0.3, tw: Math.random() * TAU }));
const MOTES = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: rand(6, 22), s: rand(1, 2.6), ph: Math.random() * TAU }));

function drawStars(t, alpha = 1) {
  for (const s of STARS) {
    ctx.globalAlpha = alpha * (0.45 + 0.55 * Math.abs(Math.sin(t * 0.8 + s.tw)));
    ctx.fillStyle = '#f6eadb';
    ctx.fillRect(s.x, s.y, s.s, s.s);
  }
  ctx.globalAlpha = 1;
}
function drawMotes(t, color = 'rgba(255,160,110,.5)', drift = 1) {
  ctx.fillStyle = color;
  for (const m of MOTES) {
    const x = (m.x + t * m.v * drift + Math.sin(t + m.ph) * 8) % W;
    const y = (m.y + Math.sin(t * 0.6 + m.ph) * 12 + t * m.v * 0.3) % H;
    ctx.fillRect(x, y, m.s, m.s);
  }
}
function drawMars(cx, cy, r, t) {
  ctx.save();
  const halo = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.25);
  halo.addColorStop(0, 'rgba(255,110,60,.35)'); halo.addColorStop(1, 'rgba(255,110,60,0)');
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, r * 1.25, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#e9894f'); g.addColorStop(0.55, '#b44421'); g.addColorStop(1, '#4a1209');
  ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  // drifting surface features
  const rng = mulberry32(42);
  for (let i = 0; i < 26; i++) {
    const fx = ((rng() * 2.4 * r + t * 6) % (2.4 * r)) - 1.2 * r;
    const fy = (rng() - 0.5) * 1.8 * r;
    const w = rng() * r * 0.35 + 10, h = w * (0.3 + rng() * 0.4);
    ctx.fillStyle = rng() < 0.6 ? 'rgba(90,25,12,.35)' : 'rgba(255,190,140,.12)';
    ctx.beginPath(); ctx.ellipse(cx + fx, cy + fy, w, h, rng(), 0, TAU); ctx.fill();
  }
  // Valles Marineris-ish scar
  ctx.strokeStyle = 'rgba(70,18,8,.5)'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(cx - r * 0.7, cy + r * 0.05); ctx.bezierCurveTo(cx - r * 0.2, cy - r * 0.1, cx + r * 0.1, cy + r * 0.15, cx + r * 0.6, cy + r * 0.02); ctx.stroke();
  // terminator
  const sh = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  sh.addColorStop(0.45, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.85)');
  ctx.fillStyle = sh; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
  // Phobos
  const a = t * 0.4;
  const px = cx + Math.cos(a) * r * 1.45, py = cy + Math.sin(a) * r * 0.35;
  ctx.fillStyle = '#8a7d72'; ctx.beginPath(); ctx.ellipse(px, py, 9, 7, 0.4, 0, TAU); ctx.fill();
}
function drawFlower(x, y, s, t) {
  // Haemanthus: Eo's flower. A spray of thin red petals on a single stem.
  ctx.strokeStyle = '#3b5a2a'; ctx.lineWidth = 4 * s;
  ctx.beginPath(); ctx.moveTo(x, y + 220 * s); ctx.quadraticCurveTo(x + 14 * s, y + 110 * s, x, y); ctx.stroke();
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * TAU + Math.sin(t * 0.8 + i) * 0.04;
    const len = (52 + (i * 37) % 26) * s;
    const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
    ctx.strokeStyle = i % 3 ? '#d42a2a' : '#a8161b'; ctx.lineWidth = 2.2 * s;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.arc(ex, ey, 2.4 * s, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = '#7d0f14'; ctx.beginPath(); ctx.arc(x, y, 12 * s, 0, TAU); ctx.fill();
}
function drawHills(t, cols, base, amp) {
  cols.forEach((c, i) => {
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 16) ctx.lineTo(x, base + i * 50 - Math.sin(x * 0.006 + i * 2.1) * amp - Math.sin(x * 0.017 + i) * amp * 0.4);
    ctx.lineTo(W, H); ctx.fill();
  });
}
function drawCastleSil(x, y, s, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x - 60 * s, y - 40 * s, 120 * s, 40 * s);
  for (let i = -3; i <= 3; i++) ctx.fillRect(x + i * 18 * s - 5 * s, y - 50 * s, 10 * s, 10 * s);
  ctx.fillRect(x - 70 * s, y - 80 * s, 26 * s, 80 * s);
  ctx.fillRect(x + 44 * s, y - 80 * s, 26 * s, 80 * s);
  ctx.fillRect(x - 12 * s, y - 110 * s, 24 * s, 70 * s);
  ctx.beginPath(); ctx.moveTo(x - 16 * s, y - 110 * s); ctx.lineTo(x, y - 140 * s); ctx.lineTo(x + 16 * s, y - 110 * s); ctx.fill();
}
const COLOR_TIERS = [
  ['Gold', '#e0b552'], ['Silver', '#c9ccd2'], ['White', '#eeeae2'], ['Copper', '#b8733d'], ['Blue', '#3f6fc4'],
  ['Yellow', '#e3cf4a'], ['Green', '#4e9d55'], ['Violet', '#8b5ac8'], ['Orange', '#e07b2e'], ['Grey', '#8a8a8a'],
  ['Obsidian', '#2a2a30'], ['Brown', '#6e4a2e'], ['Pink', '#e48aa8'], ['Red', '#c0262d'],
];
function drawPyramid(t) {
  const cx = 726, top = 70, rowH = 30;
  COLOR_TIERS.forEach(([name, col], i) => {
    const w = 56 + i * 26, y = top + i * rowH;
    ctx.fillStyle = col; ctx.globalAlpha = i === 13 ? 1 : 0.85;
    ctx.fillRect(cx - w / 2, y, w, rowH - 4);
    ctx.globalAlpha = 1;
    txt(name.toUpperCase(), cx, y + 19, { size: 13, font: FH, weight: 700, align: 'center', color: ['Obsidian', 'Brown', 'Blue', 'Violet', 'Red'].includes(name) ? '#f1e4cc' : '#1a0d08' });
  });
  // the base is cracking
  const y = top + 13 * rowH;
  ctx.strokeStyle = `rgba(255,220,160,${0.5 + 0.4 * Math.sin(t * 3)})`; ctx.lineWidth = 2;
  ctx.beginPath();
  let x = cx - 40; ctx.moveTo(x, y + 26);
  for (let i = 0; i < 6; i++) { x += 14; ctx.lineTo(x, y + (i % 2 ? 20 : 4)); }
  ctx.stroke();
  ctx.shadowColor = '#ff3b2f'; ctx.shadowBlur = 30 + 10 * Math.sin(t * 2);
  ctx.strokeStyle = 'rgba(255,60,40,.6)'; ctx.strokeRect(cx - (56 + 13 * 26) / 2, y, 56 + 13 * 26, rowH - 4);
  ctx.shadowBlur = 0;
}
function drawHelm(cx, cy, s, t) {
  // Sons of Ares: a spiked helm like a burning sun.
  ctx.save(); ctx.translate(cx, cy);
  ctx.shadowColor = '#ff4a2a'; ctx.shadowBlur = 40 + 12 * Math.sin(t * 2);
  ctx.fillStyle = '#7a1612';
  for (let i = 0; i < 14; i++) {
    const a = -Math.PI + (i / 13) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a - 0.1) * 70 * s, Math.sin(a - 0.1) * 70 * s);
    ctx.lineTo(Math.cos(a) * 150 * s, Math.sin(a) * 150 * s);
    ctx.lineTo(Math.cos(a + 0.1) * 70 * s, Math.sin(a + 0.1) * 70 * s);
    ctx.fill();
  }
  ctx.fillStyle = '#2a0b09';
  ctx.beginPath(); ctx.arc(0, 0, 80 * s, Math.PI, 0); ctx.lineTo(80 * s, 70 * s); ctx.lineTo(-80 * s, 70 * s); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ff5a3a';
  ctx.fillRect(-55 * s, 0, 110 * s, 12 * s);
  ctx.fillStyle = '#120403';
  ctx.fillRect(-6 * s, 12 * s, 12 * s, 58 * s);
  ctx.restore();
}

function drawBackdrop(kind, t) {
  const bg = (a, b) => { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, a); g.addColorStop(1, b); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); };
  switch (kind) {
    case 'mars': bg('#030106', '#1a0605'); drawStars(t); drawMars(700, 300, 230, t); break;
    case 'mine': {
      bg('#1a0806', '#050101');
      for (let i = 0; i < 9; i++) {
        ctx.fillStyle = i % 2 ? 'rgba(90,40,24,.35)' : 'rgba(50,20,14,.4)';
        ctx.beginPath(); ctx.moveTo(0, 40 + i * 60);
        for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 40 + i * 60 + Math.sin(x * 0.01 + i) * 14);
        ctx.lineTo(W, 70 + i * 60); ctx.lineTo(0, 70 + i * 60); ctx.fill();
      }
      for (let i = 0; i < 40; i++) {
        const x = (i * 197) % W, y = (i * 131) % H;
        ctx.fillStyle = `rgba(120,220,255,${0.3 + 0.3 * Math.sin(t * 2 + i)})`;
        ctx.fillRect(x, y, 3, 3);
      }
      const bx = 480 + Math.sin(t * 0.5) * 200;
      const beam = ctx.createRadialGradient(bx, 300, 10, bx, 300, 260);
      beam.addColorStop(0, 'rgba(255,210,140,.25)'); beam.addColorStop(1, 'rgba(255,210,140,0)');
      ctx.fillStyle = beam; ctx.fillRect(0, 0, W, H);
      drawMotes(t);
      break;
    }
    case 'eo': bg('#1c0405', '#060101'); drawFlower(720, 230, 1.15, t); drawMotes(t, 'rgba(212,42,42,.6)', 0.6); break;
    case 'dark': {
      bg('#050101', '#000');
      const v = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, 600);
      v.addColorStop(0, 'rgba(90,10,10,.25)'); v.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
      drawMotes(t, 'rgba(255,90,60,.35)', 0.4);
      break;
    }
    case 'sons': bg('#0d0303', '#000'); drawHelm(700, 250, 1, t); break;
    case 'carve': {
      bg('#03060a', '#000');
      ctx.strokeStyle = 'rgba(120,180,220,.07)';
      for (let y = (t * 30) % 8; y < H; y += 8) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      const blink = Math.abs(Math.sin(t * 0.7)) > 0.04 ? 1 : 0.1;
      for (const ex of [630, 790]) {
        ctx.shadowColor = '#ffcf5a'; ctx.shadowBlur = 40;
        ctx.fillStyle = '#e0b552'; ctx.beginPath(); ctx.ellipse(ex, 250, 52, 22 * blink, 0, 0, TAU); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#5a3a08'; ctx.beginPath(); ctx.arc(ex, 250, 13 * blink, 0, TAU); ctx.fill();
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(ex, 250, 6 * blink, 0, TAU); ctx.fill();
      }
      break;
    }
    case 'space': {
      bg('#020108', '#120408');
      drawStars(t);
      drawMars(W / 2 + 120, H + 520, 720, t * 0.2);
      for (let i = 0; i < 7; i++) {
        const x = 120 + i * 120 + Math.sin(t * 0.3 + i) * 10, y = 90 + (i % 3) * 50, s = 0.6 + (i % 2) * 0.5;
        ctx.fillStyle = '#1c1218'; ctx.beginPath(); ctx.moveTo(x - 80 * s, y); ctx.lineTo(x + 90 * s, y - 10 * s); ctx.lineTo(x + 70 * s, y + 14 * s); ctx.lineTo(x - 70 * s, y + 12 * s); ctx.fill();
        ctx.fillStyle = '#ff6a3a'; ctx.fillRect(x - 84 * s, y + 2, 5, 5);
      }
      ctx.fillStyle = 'rgba(255,200,140,.8)';
      for (let i = 0; i < 40; i++) { const x = (i * 211) % W, y = ((i * 97 + t * 120) % (H + 100)) - 50; ctx.fillRect(x, y, 2, 7); }
      break;
    }
    case 'pyramid': bg('#0a0405', '#020101'); drawStars(t, 0.3); drawPyramid(t); break;
    case 'institute': {
      bg('#2b1636', '#d0723e');
      drawStars(t, 0.4);
      ctx.fillStyle = '#f2dcc0'; ctx.beginPath(); ctx.arc(760, 120, 26, 0, TAU); ctx.fill();
      ctx.fillStyle = '#c9b8a4'; ctx.beginPath(); ctx.arc(840, 80, 12, 0, TAU); ctx.fill();
      drawHills(t, ['#5a2c3a', '#3a1c2a'], 330, 40);
      drawCastleSil(690, 360, 0.9, '#2a1420');
      drawHills(t, ['#1c0d16'], 420, 30);
      drawMotes(t, 'rgba(255,220,180,.35)', 0.5);
      break;
    }
    case 'snow': {
      bg('#0b1424', '#4a5a74');
      drawStars(t, 0.6);
      drawCastleSil(680, 300, 1.1, '#1a2232');
      drawHills(t, ['#c8d2e0', '#e8eef6'], 380, 30);
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      for (const m of MOTES) ctx.fillRect((m.x + Math.sin(t + m.ph) * 20) % W, (m.y + t * m.v * 2) % H, m.s + 1, m.s + 1);
      break;
    }
    case 'controls': {
      bg('#140605', '#050101');
      ctx.strokeStyle = 'rgba(192,38,45,.25)'; ctx.lineWidth = 1;
      for (let i = -H; i < W; i += 28) { ctx.beginPath(); ctx.moveTo(i, H); ctx.lineTo(i + H, 0); ctx.stroke(); }
      break;
    }
    default: bg('#000', '#000');
  }
}

// ------------------------------------------------------------- the story --
const KEYS_MINE = [
  ['Move / drill', 'WASD · Arrows · Stick. Push into rock to drill it.'],
  ['Careful drill', 'Hold B (K / Shift). Slower, but vents gas pockets safely.'],
  ['Sonar ping', 'A (J / Space). Lights up helium-3 veins nearby.'],
  ['Gas sense', 'The GAS meter climbs when a hidden pocket is close.'],
  ['Pitvipers', 'Drill straight into them before they bite.'],
  ['Heat', 'Drill too long and the motor seizes. Let it breathe.'],
  ['Goal', 'Dig at least 60 kg of helium-3 before the shift ends. Beat Gamma.'],
];
const KEYS_DUEL = [
  ['Move', 'Left / Right (A·D · Arrows · Stick)'],
  ['Strike', 'A (J / Space). Chain strikes while recovering.'],
  ['Block', 'Hold B (K / Shift). Costs stamina per blow.'],
  ['Parry', 'Tap B just as a blow lands. Staggers the enemy; your next hits deal far more.'],
  ['Dodge', 'Up (W · Arrow Up · Stick up)'],
  ['Red glint', 'A heavy blow. It breaks any block. Parry it or dodge it.'],
];
const KEYS_RAIN = [
  ['Steer', 'WASD · Arrows · Stick'],
  ['Fire', 'A (hold). Shoots down ripWings and missiles below you.'],
  ['Boost', 'B. A burst of thrust with a moment of invulnerability.'],
  ['Flak', 'Red rings mark shells about to burst. Get out before they fill.'],
  ['Your stick', 'Fly through falling soldiers (green rings) to gather them. They fire with you, and die if the flak finds them.'],
  ['Repair cells', 'Blue pods restore 25% of your shell.'],
  ['Landing', 'Near the ground, steer for the green ring.'],
];
const KEYS_INST = [
  ['Move', 'WASD · Arrows · Stick'],
  ['Strike', 'A (J / Space). Hold to keep swinging.'],
  ['Dash', 'B (K / Shift). Brief invulnerability.'],
  ['Your pack', 'Sevro, Pax, Quinn and Roque follow you and fight on their own.'],
  ['Take a castle', 'Kill its defenders, then stand by the standard until it is yours.'],
  ['Freedom', 'Captured students are freed, not enslaved. They join House Mars.'],
  ['Goal', 'Take three Houses, then storm Olympus. Gold arrow points the way.'],
];

const CARDS = {
  intro: [
    { bg: 'mars', title: 'Mars', text: 'Beneath the red crust, the Reds dig. They are told they are pioneers: that the helium-3 they mine will one day make this planet livable for the rest of humanity.' },
    { bg: 'mine', title: 'Lykos', text: 'Darrow of Lambda clan is sixteen, and the best Helldiver the mining colony of Lykos has ever had. He rides the clawDrill down where the gas pockets and the pitvipers wait.' },
    { bg: 'eo', title: 'Eo', text: 'His wife Eo wants more than survival. She talks of chains, and of breaking them. Darrow just wants to win the Laurel, and the extra food it brings his clan.', onShow: () => AudioSys.lament() },
    { bg: 'mine', title: 'The Laurel', text: 'Gamma clan has won the Laurel every quarter for as long as anyone can remember. Today Darrow means to take it from them.\n\nFill the quota. Beat Gamma. Come home alive.' },
    { bg: 'controls', title: 'Chapter I · Controls', keys: KEYS_MINE },
  ],
  mineWin: (he3, gamma) => [
    { bg: 'mine', title: 'The Laurel', text: he3 > gamma
      ? `Lambda hauls ${he3} kg. Gamma hauls ${gamma}. No clan in Lykos has ever beaten them so badly.\n\nThe Gold overseers give the Laurel to Gamma anyway. They always do.`
      : `Lambda hauls ${he3} kg and makes quota. Gamma hauls ${gamma}.\n\nIt would not have mattered. The Laurel always goes to Gamma. The Golds decide who wins.` },
    { bg: 'eo', title: 'The Garden', text: 'That night Eo leads Darrow to a forbidden garden. They are caught and flogged in the square. Eo does not cry out. She sings the forbidden song, and the ArchGovernor, Nero au Augustus, has her hanged for it.', onShow: () => AudioSys.lament() },
    { bg: 'dark', title: 'The Gallows', text: 'Darrow cuts her body down and buries her, knowing the law. They hang him too.\n\nHe wakes up alive.' },
    { bg: 'sons', title: 'The Sons of Ares', text: 'Dancer of the Sons of Ares shows him the truth. Mars was made livable centuries ago. Cities glitter on the surface. The Reds below were never pioneers. They are slaves who were never told.' },
    { bg: 'pyramid', title: 'The Society', text: 'Every human is born into a Color. Golds rule from the top. Reds hold up the whole pyramid from the bottom and are taught to be grateful for it.' },
    { bg: 'carve', title: 'The Carver', text: 'Mickey the Carver rebuilds him: bone, skin, and eyes of gold. Darrow of Lykos will become Darrow au Andromedus, enter the Institute, and rise high enough to break the Society from within.' },
  ],
  passage: [
    { bg: 'institute', title: 'The Institute', text: 'The Institute is where the Society forges its young Golds. One hundred students per House, sorted under the old gods. Darrow is chosen for House Mars.' },
    { bg: 'dark', title: 'The Passage', text: 'The first test happens on the first night. Each student is paired with another and sealed in a room. Only one walks out.' },
    { bg: 'dark', title: 'Julian au Bellona', text: 'Darrow\'s partner is Julian: gentle, unsure of himself, the brother of Cassius au Bellona, the first Gold who offered Darrow friendship.' },
    { bg: 'controls', title: 'Chapter II · Controls', keys: KEYS_DUEL },
  ],
  institute: [
    { bg: 'dark', title: 'After', text: 'Julian falls. He was kind, and it did not save him. Cassius is told his brother failed the Passage. He is not told who killed him.' },
    { bg: 'institute', title: 'The War of Houses', text: 'Then the real game begins. Each House holds a castle in the highlands. Capture a rival\'s standard and its students become your slaves.\n\nDarrow means to win without becoming a master.' },
    { bg: 'institute', title: 'The Howlers', text: 'He has Sevro, small and feral, who runs with a pack of his own. Pax, a mountain in armor. Quinn and Roque. It will have to be enough.' },
    { bg: 'controls', title: 'Chapter III · Controls', keys: KEYS_INST },
  ],
  jackal: [
    { bg: 'snow', title: 'Olympus Falls', text: 'Apollo, the Proctor who bent the game against House Mars, kneels in the snow. The Proctors watching from Olympus are not supposed to lose.' },
    { bg: 'snow', title: 'The Jackal', text: 'One player never kneels. Adrius au Augustus, the son of the man who hanged Eo, has been the Proctors\' favorite all along. He waits on the frozen ridge.\n\nHe is clever, he feints, and he carries knives.' },
    { bg: 'controls', title: 'Chapter IV · The Jackal', keys: [
      ['Feints', 'A red glint that suddenly snaps into a quick strike. Don\'t parry on reflex.'],
      ['Knives', 'He throws them from range. Parry to send them back, or dodge.'],
      ['Second wind', 'Below half health he gets faster. Stay patient.'],
    ] },
  ],
  ending: [
    { bg: 'snow', title: 'The Hand', text: 'The Jackal\'s hand lies in the snow. Darrow lets him live.' },
    { bg: 'institute', title: 'Primus', text: 'House Mars wins the Institute. Nero au Augustus, the man who murdered Eo, offers Darrow a place in his House as his lancer.\n\nDarrow accepts.' },
    { bg: 'pyramid', title: 'Break the Chains', text: 'He will rise until he stands among them. And then he will break the chains.' },
  ],
  rain: [
    { bg: 'space', title: 'Years Later', text: 'The lancer became a legend, and the legend became a war. The Reaper of Mars no longer hides what he is. The Rising has begun.' },
    { bg: 'space', title: 'The Fleet', text: 'Above Mars hangs the Rising\'s fleet: Reds and Obsidians, Blues and Greys, and the Golds who chose to stand with them. Thousands of soldiers wait in the drop tubes, sealed in starShells.' },
    { bg: 'space', title: 'Iron Rain', text: 'When a legion falls from orbit onto a planet, they call it the Iron Rain. The Reaper falls first. He always does.' },
    { bg: 'controls', title: 'Chapter V · Controls', keys: KEYS_RAIN },
  ],
  epilogue: [
    { bg: 'mars', title: 'Mars', text: 'The Iron Rain falls on Mars, and where it lands the chains come apart.' },
    { bg: 'eo', title: 'Eo', text: 'A girl in Lykos once sang a forbidden song about a valley where no one was a slave. Her husband carried it from the bottom of the mines to the sky.', onShow: () => AudioSys.lament() },
  ],
};

class StoryScene {
  constructor(cards, done, drone = 'story') { this.cards = cards; this.done = done; this.drone = drone; this.i = 0; this.chars = 0; this.t = 0; this.finished = false; }
  enter() { AudioSys.drone(this.drone); setButtons('Next', 'Skip'); this.show(); }
  show() { const c = this.cards[this.i]; if (c && c.onShow) c.onShow(); }
  finish() { if (this.finished) return; this.finished = true; sfx.select(); this.done(); }
  update(dt) {
    this.t += dt;
    const c = this.cards[this.i];
    const len = c.text ? c.text.length : 999;
    this.chars += dt * 52;
    if (I.pressed('a') || (I.tap() && !I.inRect(W - 120, 0, 120, 60))) {
      if (this.chars < len) this.chars = len;
      else { this.i++; this.chars = 0; this.t = 0; sfx.blip(); if (this.i >= this.cards.length) { this.i--; this.finish(); } else this.show(); }
    }
    if (I.pressed('b') || I.inRect(W - 120, 0, 120, 60)) this.finish();
  }
  draw() {
    const c = this.cards[this.i];
    drawBackdrop(c.bg, this.t + this.i * 3);
    const x = 64, w = c.keys ? 832 : 480;
    const g = ctx.createLinearGradient(0, 0, w + 160, 0);
    g.addColorStop(0, 'rgba(0,0,0,.82)'); g.addColorStop(0.75, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w + 160, H);
    txt(c.title.toUpperCase(), x, 110, { size: 34, weight: 800, color: '#e0b552', glow: 'rgba(192,38,45,.7)', blur: 18 });
    ctx.fillStyle = '#c0262d'; ctx.fillRect(x, 126, 64, 3);
    if (c.keys) {
      c.keys.forEach(([k, v], i) => {
        const y = 180 + i * 46;
        txt(k.toUpperCase(), x, y, { size: 20, font: FH, weight: 700, color: '#e0b552' });
        const lines = wrapLines(v, 620, `400 20px ${FB}`);
        lines.forEach((l, j) => txt(l, x + 190, y + j * 22, { size: 20, font: FB, weight: 400 }));
      });
    } else {
      const shown = c.text.slice(0, Math.floor(this.chars));
      const lines = wrapLines(shown, w, `400 23px ${FB}`);
      lines.forEach((l, j) => txt(l, x, 180 + j * 34, { size: 23, font: FB, weight: 400 }));
    }
    // progress pips and prompts
    for (let j = 0; j < this.cards.length; j++) {
      ctx.fillStyle = j === this.i ? '#e0b552' : 'rgba(241,228,204,.25)';
      ctx.fillRect(x + j * 18, H - 52, 12, 3);
    }
    const blink = 0.55 + 0.45 * Math.sin(this.t * 4);
    ctx.globalAlpha = blink;
    txt('A / TAP  CONTINUE', x, H - 24, { size: 16, font: FH, weight: 700, color: '#f1e4cc' });
    ctx.globalAlpha = 1;
    txt('SKIP ▸', W - 30, 40, { size: 16, font: FH, weight: 700, align: 'right', color: 'rgba(241,228,204,.6)' });
  }
}

const CHAPTERS = [
  { num: 'I', name: 'The Helldiver', where: 'Lykos, Mars' },
  { num: 'II', name: 'The Passage', where: 'The Institute' },
  { num: 'III', name: 'War of Houses', where: 'The Highlands' },
  { num: 'IV', name: 'The Jackal', where: 'Below Olympus' },
  { num: 'V', name: 'Iron Rain', where: 'Sixty kilometers above Mars' },
];
function chapterCard(n) {
  // big title card shown at the start of each playable chapter
  return { num: CHAPTERS[n - 1].num, name: CHAPTERS[n - 1].name, where: CHAPTERS[n - 1].where };
}
function drawChapterBanner(n, t, dur = 2.6) {
  if (t > dur) return;
  const a = t < 0.3 ? t / 0.3 : t > dur - 0.5 ? (dur - t) / 0.5 : 1;
  const c = chapterCard(n);
  ctx.globalAlpha = clamp(a, 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, H / 2 - 80, W, 150);
  txt('CHAPTER ' + c.num, W / 2, H / 2 - 30, { size: 20, font: FH, weight: 700, align: 'center', color: '#c0262d' });
  txt(c.name.toUpperCase(), W / 2, H / 2 + 22, { size: 50, weight: 800, align: 'center', color: '#e0b552', glow: 'rgba(192,38,45,.8)', blur: 20 });
  txt(c.where, W / 2, H / 2 + 54, { size: 18, font: FB, weight: 400, align: 'center', color: 'rgba(241,228,204,.75)' });
  ctx.globalAlpha = 1;
}

function startChapter(n) {
  if (n === 1) go(new StoryScene(CARDS.intro, () => go(new MineScene())));
  else if (n === 2) go(new StoryScene(CARDS.passage, () => go(new DuelScene(FOES.julian))));
  else if (n === 3) go(new StoryScene(CARDS.institute, () => go(new InstituteScene())));
  else if (n === 4) go(new StoryScene(CARDS.jackal, () => go(new DuelScene(FOES.jackal)), 'jackal'));
  else if (n === 5) go(new StoryScene(CARDS.rain, () => go(new RainScene()), 'rain'));
}
function chapterWon(n, extra) {
  Save.unlock(n + 1);
  if (n === 1) go(new StoryScene(CARDS.mineWin(extra.he3, extra.gamma), () => startChapter(2)));
  else if (n === 2) startChapter(3);
  else if (n === 3) startChapter(4);
  else if (n === 4) go(new StoryScene(CARDS.ending, () => startChapter(5), 'jackal'));
  else go(new StoryScene(CARDS.epilogue, () => go(new CreditsScene())));
}

// ------------------------------------------------------------------ title --
class TitleScene {
  constructor() { this.t = 0; this.sel = 0; this.mode = 'main'; }
  enter() { AudioSys.drone('title'); setButtons('Select', 'Back'); }
  rowY(i) { return this.mode === 'main' ? 300 + i * 44 : 288 + i * 39; }
  items() {
    if (this.mode === 'main') {
      const u = Save.get();
      return [
        { label: 'Begin the Rise', act: () => startChapter(1) },
        { label: 'Chapter Select', act: () => { this.mode = 'chapters'; this.sel = 0; }, off: u < 2 },
        { label: 'Sound: ' + (AudioSys.muted ? 'Off' : 'On'), act: () => AudioSys.setMuted(!AudioSys.muted) },
        { label: 'Music: ' + (Music.on ? 'On' : 'Off'), act: () => Music.setOn(!Music.on) },
      ];
    }
    const u = Save.get();
    return CHAPTERS.map((c, i) => ({ label: `${c.num}.  ${c.name}`, off: i + 1 > u, act: () => startChapter(i + 1) }))
      .concat([{ label: 'Back', act: () => { this.mode = 'main'; this.sel = 1; } }]);
  }
  update(dt) {
    this.t += dt;
    const items = this.items();
    const step = (d) => { let s = this.sel; for (let k = 0; k < items.length; k++) { s = (s + d + items.length) % items.length; if (!items[s].off) break; } this.sel = s; sfx.blip(); };
    if (I.pressed('up')) step(-1);
    if (I.pressed('down')) step(1);
    items.forEach((it, i) => { if (!it.off && I.inRect(70, this.rowY(i) - 32, 420, 44)) { this.sel = i; sfx.select(); it.act(); } });
    if (I.pressed('a') && !items[this.sel].off) { sfx.select(); items[this.sel].act(); }
    if (I.pressed('b') && this.mode !== 'main') { this.mode = 'main'; this.sel = 1; sfx.blip(); }
  }
  draw() {
    const t = this.t;
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#040106'); g.addColorStop(1, '#1d0605');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    drawStars(t);
    drawMars(730, 300, 250, t);
    drawMotes(t, 'rgba(255,140,90,.35)', 0.6);
    const sh = ctx.createLinearGradient(0, 0, 620, 0);
    sh.addColorStop(0, 'rgba(0,0,0,.75)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh; ctx.fillRect(0, 0, 620, H);

    txt('A RED RISING FAN GAME', 72, 96, { size: 16, font: FH, weight: 700, color: '#c0262d' });
    txt('BREAK', 68, 160, { size: 74, weight: 800, color: '#e0b552', glow: 'rgba(192,38,45,.9)', blur: 24 });
    txt('THE CHAINS', 70, 214, { size: 46, weight: 800, color: '#f1e4cc', glow: 'rgba(192,38,45,.6)', blur: 14 });
    txt('From the mines of Lykos to the snows of Olympus.', 72, 248, { size: 17, font: FB, weight: 400, color: 'rgba(241,228,204,.7)' });

    this.items().forEach((it, i) => {
      const y = this.rowY(i), sel = i === this.sel;
      if (sel) {
        ctx.fillStyle = 'rgba(192,38,45,.4)'; ctx.fillRect(70, y - 29, 420, 38);
        ctx.fillStyle = '#e0b552'; ctx.fillRect(70, y - 29, 4, 38);
      }
      txt(it.label, 92, y, { size: 24, color: it.off ? 'rgba(241,228,204,.25)' : sel ? '#f6eadb' : 'rgba(241,228,204,.7)' });
      if (it.off && this.mode === 'chapters') txt('locked', 470, y, { size: 15, font: FH, align: 'right', color: 'rgba(241,228,204,.3)' });
      const best = this.mode === 'chapters' && i < CHAPTERS.length ? Ranks.best(i + 1) : null;
      if (best !== null) {
        const [name, col] = RANKS[best];
        ctx.fillStyle = col; rr(392, y - 20, 84, 24, 3); ctx.fill();
        txt(name.toUpperCase(), 434, y - 2, { size: 15, font: FH, weight: 700, align: 'center', color: best >= 3 ? '#f6eadb' : '#140806' });
      }
    });
    txt('Unofficial fan project inspired by the novels of Pierce Brown.  M mutes  ·  Esc pauses', 72, H - 22, { size: 14, font: FH, weight: 500, color: 'rgba(241,228,204,.4)' });
  }
}

// ---------------------------------------------------------------- credits --
class CreditsScene {
  constructor() { this.t = 0; }
  enter() { AudioSys.drone('story'); setButtons('Title', ''); sfx.fanfare(); }
  update(dt) { this.t += dt; if ((this.t > 3 && (I.pressed('a') || I.tap())) || this.t > 40) go(new TitleScene()); }
  draw() {
    drawBackdrop('mars', this.t);
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H);
    const lines = [
      ['h', 'BREAK THE CHAINS'], ['s', 'A Red Rising fan game'], ['g', ''],
      ['l', 'The Helldiver of Lykos'], ['l', 'The Passage'], ['l', 'The War of Houses'], ['l', 'The Jackal'], ['l', 'Iron Rain'], ['g', ''],
      ['s', 'Inspired by the Red Rising saga by Pierce Brown.'], ['s', 'All characters and the world belong to him.'], ['s', 'Unofficial and non-commercial.'], ['g', ''],
      ['s', 'Code, art, music and sound generated in your browser.'], ['g', ''],
      ['h', 'HAIL, REAPER'],
    ];
    let y = H + 20 - this.t * 38;
    for (const [k, s] of lines) {
      if (k === 'h') txt(s, W / 2, y, { size: 36, weight: 800, align: 'center', color: '#e0b552', glow: 'rgba(192,38,45,.8)' });
      else if (k === 'l') txt(s, W / 2, y, { size: 22, align: 'center', color: '#f1e4cc' });
      else if (k === 's') txt(s, W / 2, y, { size: 18, font: FB, weight: 400, align: 'center', color: 'rgba(241,228,204,.75)' });
      y += k === 'g' ? 30 : 44;
    }
    if (y < H / 2 - 40) txt('A / TAP  RETURN TO TITLE', W / 2, H - 30, { size: 16, font: FH, align: 'center', color: 'rgba(241,228,204,.6)' });
  }
}
