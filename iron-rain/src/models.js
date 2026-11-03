// ---------------------------------------------------------------------------
// Models and effects, all built from primitives and procedural textures
// ---------------------------------------------------------------------------

// Environment map for metals: a warm Mars-lit hall with a bright key light
const pmrem = new THREE.PMREMGenerator(renderer);
function makeEnv(top, bottom, keyColor, keyDir) {
  const s = new THREE.Scene();
  const geo = new THREE.SphereGeometry(50, 32, 16);
  const mat = new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { top: { value: new THREE.Color(top) }, bot: { value: new THREE.Color(bottom) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top, bot; varying vec3 vP; void main(){ float h = normalize(vP).y*0.5+0.5; gl_FragColor = vec4(mix(bot, top, smoothstep(0.2,0.8,h)), 1.0); }' });
  s.add(new THREE.Mesh(geo, mat));
  const key = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(keyColor).multiplyScalar(14) }));
  key.position.copy(keyDir).multiplyScalar(40); s.add(key);
  const rim = new THREE.Mesh(new THREE.BoxGeometry(80, 2, 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3020).multiplyScalar(3) }));
  rim.position.set(0, -10, -40); s.add(rim);
  return pmrem.fromScene(s, 0.02).texture;
}
const ENV_BAY = makeEnv(0x1a1416, 0x3a1a10, 0xffd8b0, V3(0.4, 1, 0.3));
const ENV_SPACE = makeEnv(0x02030a, 0x4a1a0c, 0xfff2dd, V3(-0.6, 0.4, 0.5));

// ------------------------------------------------------------- textures --
const panelTex = (() => {
  const nz = cnoise(7);
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#6f6a66'; g.fillRect(0, 0, w, h);
    const img = g.getImageData(0, 0, w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, n = nz(x / 40, y / 40, 4) * 60 - 30; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
    g.putImageData(img, 0, 0);
    g.strokeStyle = 'rgba(20,16,14,.85)'; g.lineWidth = 2;
    const cut = (x, y, ww, hh) => { g.strokeRect(x + 0.5, y + 0.5, ww, hh); if (Math.random() < 0.3) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},.06)`; g.fillRect(x, y, ww, hh); } };
    const split = (x, y, ww, hh, d) => { if (d > 3 || (d > 1 && Math.random() < 0.3)) { cut(x, y, ww, hh); return; } if (ww > hh) { const k = Math.round(ww * rand(0.3, 0.7)); split(x, y, k, hh, d + 1); split(x + k, y, ww - k, hh, d + 1); } else { const k = Math.round(hh * rand(0.3, 0.7)); split(x, y, ww, k, d + 1); split(x, y + k, ww, hh - k, d + 1); } };
    split(0, 0, w, h, 0);
    g.fillStyle = 'rgba(20,16,14,.8)'; for (let i = 0; i < 160; i++) g.fillRect(Math.random() * w, Math.random() * h, 3, 3);
    g.fillStyle = 'rgba(160,40,30,.55)'; g.fillRect(0, h * 0.72, w, 10);
  }, { repeat: 1 });
})();
const floorTex = (() => {
  const nz = cnoise(3);
  return canvasTex(512, 512, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, n = nz(x / 30, y / 30, 5); const v = 38 + n * 40; img.data[i] = v + 6; img.data[i + 1] = v + 2; img.data[i + 2] = v; img.data[i + 3] = 255; }
    g.putImageData(img, 0, 0);
    g.strokeStyle = 'rgba(0,0,0,.7)'; g.lineWidth = 3; for (let k = 0; k <= 512; k += 128) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, h); g.stroke(); g.beginPath(); g.moveTo(0, k); g.lineTo(w, k); g.stroke(); }
    g.fillStyle = 'rgba(224,181,82,.55)'; for (let k = 0; k < 512; k += 32) { g.fillRect(k, 250, 16, 12); }
    g.fillStyle = 'rgba(255,255,255,.05)'; for (let i = 0; i < 400; i++) g.fillRect(Math.random() * w, Math.random() * h, rand(4, 30), 1);
  }, { repeat: 1 });
})();
floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(8, 16);
const bannerTex = canvasTex(512, 1024, (g, w, h) => {
  g.fillStyle = '#7a1414'; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(0,0,0,.25)'; for (let x = 0; x < w; x += 24) g.fillRect(x, 0, 10, h);
  // Sons of Ares: a spiked helm like a burning sun
  g.save(); g.translate(w / 2, 380); g.fillStyle = '#e0b552';
  for (let i = 0; i < 13; i++) { const a = -Math.PI + (i / 12) * Math.PI; g.beginPath(); g.moveTo(Math.cos(a - 0.09) * 110, Math.sin(a - 0.09) * 110); g.lineTo(Math.cos(a) * 210, Math.sin(a) * 210); g.lineTo(Math.cos(a + 0.09) * 110, Math.sin(a + 0.09) * 110); g.fill(); }
  g.beginPath(); g.arc(0, 0, 118, Math.PI, 0); g.lineTo(118, 100); g.lineTo(-118, 100); g.fill();
  g.fillStyle = '#7a1414'; g.fillRect(-80, 0, 160, 18); g.fillRect(-9, 18, 18, 80);
  g.restore();
  g.fillStyle = '#e0b552'; g.font = '900 64px Cinzel, Georgia, serif'; g.textAlign = 'center';
  g.fillText('BREAK', w / 2, 700); g.fillText('THE', w / 2, 780); g.fillText('CHAINS', w / 2, 860);
  g.fillStyle = '#5a0c0c'; g.beginPath(); g.moveTo(0, h); g.lineTo(w / 2, h - 80); g.lineTo(w, h); g.fill();
});
function labelTex(text, color = '#e0b552') {
  return canvasTex(512, 128, (g, w, h) => { g.font = '700 64px "Barlow Condensed", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(40, 24, w - 80, 80); g.fillStyle = color; g.fillText(text, w / 2, 66); });
}
function labelSprite(text, color) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(text, color), transparent: true, depthWrite: false }));
  s.scale.set(1.6, 0.4, 1); return s;
}

// ------------------------------------------------------------- materials --
const MAT = {
  hull: new THREE.MeshStandardMaterial({ color: 0x8a8580, map: panelTex, metalness: 0.75, roughness: 0.42, envMap: ENV_SPACE, envMapIntensity: 1.1 }),
  pod: new THREE.MeshStandardMaterial({ color: 0x4a4446, map: panelTex, metalness: 0.85, roughness: 0.32, envMap: ENV_BAY, envMapIntensity: 1.2 }),
  podSpace: new THREE.MeshStandardMaterial({ color: 0x4a4446, map: panelTex, metalness: 0.85, roughness: 0.32, envMap: ENV_SPACE, envMapIntensity: 1.3 }),
  armor: new THREE.MeshStandardMaterial({ color: 0x2c2729, metalness: 0.8, roughness: 0.3, envMap: ENV_BAY, envMapIntensity: 1.3 }),
  armorRed: new THREE.MeshStandardMaterial({ color: 0x7a1416, metalness: 0.6, roughness: 0.35, envMap: ENV_BAY }),
  gold: new THREE.MeshStandardMaterial({ color: 0xc8962e, metalness: 1, roughness: 0.25, envMap: ENV_BAY, envMapIntensity: 1.4 }),
  fur: new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 1, metalness: 0 }),
  visor: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff4a20).multiplyScalar(4) }),
  redLight: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2a10).multiplyScalar(6) }),
  goldLight: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc060).multiplyScalar(6) }),
  whiteLight: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff0dd).multiplyScalar(5) }),
  dark: new THREE.MeshStandardMaterial({ color: 0x0c0a0a, roughness: 0.8 }),
};

// ------------------------------------------------------------------- pod --
const POD_PROFILE = [[0, -2.05], [0.42, -1.95], [0.8, -1.55], [0.98, -0.9], [1.02, 0], [1.0, 0.9], [0.9, 1.45], [0.62, 1.82], [0.3, 2.02], [0, 2.08]].map(([x, y]) => new THREE.Vector2(x, y));
const POD_GEO = new THREE.LatheGeometry(POD_PROFILE, 28);
const POD_BOTTOM = [[0, -2.05], [0.42, -1.95], [0.8, -1.55], [0.924, -1.1]].map(([x, y]) => new THREE.Vector2(x, y));
const POD_MIDDLE = [[0.924, -1.1], [0.98, -0.9], [1.02, 0], [1.0, 0.9], [0.909, 1.4]].map(([x, y]) => new THREE.Vector2(x, y));
const POD_TOP = [[0.909, 1.4], [0.62, 1.82], [0.3, 2.02], [0, 2.08]].map(([x, y]) => new THREE.Vector2(x, y));
function makePod({ space = false, open = false, beacon = false } = {}) {
  const g = new THREE.Group();
  const th0 = Math.PI * 0.62, th1 = Math.PI * 0.76;
  const bodyMat = space ? MAT.podSpace : MAT.pod;
  if (!open) { const body = new THREE.Mesh(POD_GEO, bodyMat); body.castShadow = true; body.receiveShadow = true; g.add(body); }
  else {
    // shell in three parts so the middle can leave a doorway
    for (const [pts, phiS, phiL] of [[POD_BOTTOM, 0, TAU], [POD_MIDDLE, th0 + th1, TAU - th1], [POD_TOP, 0, TAU]]) {
      const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 28, phiS, phiL), bodyMat); m.castShadow = true; m.receiveShadow = true;
      if (pts === POD_MIDDLE) m.material = bodyMat.clone(), m.material.side = THREE.DoubleSide;
      g.add(m);
    }
  }
  const band = new THREE.Mesh(new THREE.CylinderGeometry(1.035, 1.035, 0.12, 28, 1, true), MAT.redLight); band.position.y = 0.55; g.add(band);
  const shield = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 10, 0, TAU, Math.PI * 0.62, Math.PI * 0.38), MAT.gold); shield.position.y = -1.42; g.add(shield);
  for (let i = 0; i < 4; i++) { const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 0.5), MAT.armor); const a = i / 4 * TAU + 0.4; fin.position.set(Math.cos(a) * 0.95, 1.1, Math.sin(a) * 0.95); fin.rotation.y = -a; g.add(fin); }
  if (open) {
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.6, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0x1a0c0a, emissive: 0xff5a20, emissiveIntensity: 0.1, side: THREE.BackSide, roughness: 0.7 }));
    inner.position.y = 0.1; g.add(inner);
    // the hatch: a curved door hinged at one edge
    const doorGeo = new THREE.CylinderGeometry(1.04, 1.04, 2.5, 20, 1, true, th0, th1);
    const hx = Math.sin(th0) * 1.04, hz = Math.cos(th0) * 1.04;
    doorGeo.translate(-hx, 0, -hz);
    const door = new THREE.Mesh(doorGeo, new THREE.MeshStandardMaterial({ color: 0x4a4446, map: panelTex, metalness: 0.85, roughness: 0.32, envMap: ENV_BAY, side: THREE.DoubleSide }));
    const hinge = new THREE.Group(); hinge.position.set(hx, 0.15, hz); hinge.add(door); hinge.rotation.y = -1.9; g.add(hinge);
    g.userData.hinge = hinge;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.2, 0.25), MAT.armor); seat.position.set(0, 0.2, 0.62); g.add(seat);
    for (const y of [-0.6, 0.4, 1.1]) { const strip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.02), MAT.redLight); strip.position.set(0, y, 0.48); g.add(strip); }
  }
  if (beacon) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), MAT.goldLight); b.position.y = 2.15; g.add(b); g.userData.beacon = b; }
  return g;
}

// ---------------------------------------------------------- starShell suit --
function makeSoldier({ scale = 1, sevro = false, cape = false } = {}) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const A = MAT.armor;
  const add = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, parent = body) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; parent.add(m); return m; };
  const legGeo = new THREE.CapsuleGeometry(0.13, 0.62, 4, 10);
  const legL = add(legGeo, A, -0.14, 0.5, 0), legR = add(legGeo, A, 0.14, 0.5, 0);
  add(new THREE.BoxGeometry(0.34, 0.18, 0.24), A, 0, 0.92, 0);
  add(new THREE.CapsuleGeometry(0.27, 0.42, 4, 12), A, 0, 1.28, 0, 1, 1, 0.72);
  add(new THREE.BoxGeometry(0.42, 0.34, 0.08), MAT.armorRed, 0, 1.38, 0.17);
  add(new THREE.BoxGeometry(0.36, 0.5, 0.2), A, 0, 1.3, -0.24);
  add(new THREE.BoxGeometry(0.06, 0.24, 0.04), MAT.redLight, 0.1, 1.32, -0.35);
  for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.17, 14, 10), A, s * 0.33, 1.56, 0, 1.15, 0.8, 1);
  const armGeo = new THREE.CapsuleGeometry(0.09, 0.5, 4, 8);
  const armL = new THREE.Group(), armR = new THREE.Group(); armL.position.set(-0.36, 1.52, 0); armR.position.set(0.36, 1.52, 0); body.add(armL, armR);
  add(armGeo, A, 0, -0.33, 0, 1, 1, 1, armL); add(armGeo, A, 0, -0.33, 0, 1, 1, 1, armR);
  const head = new THREE.Group(); head.position.set(0, 1.78, 0); body.add(head);
  add(new THREE.SphereGeometry(0.17, 18, 14), A, 0, 0, 0, 1, 1.12, 1.08, head);
  add(new THREE.BoxGeometry(0.22, 0.045, 0.06), MAT.visor, 0, 0.02, 0.16, 1, 1, 1, head);
  add(new THREE.BoxGeometry(0.03, 0.14, 0.3), sevro ? MAT.fur : MAT.armorRed, 0, 0.16, -0.02, 1, 1, 1, head);
  if (sevro || cape) {
    // a cloak over the back only: half a cone, open toward the front
    const pelt = add(new THREE.ConeGeometry(0.46, 1.25, 10, 1, true, Math.PI / 2, Math.PI), sevro ? MAT.fur : MAT.armorRed, 0, 1.02, -0.12, 1, 1, 0.7);
    pelt.material.side = THREE.DoubleSide;
    if (sevro) { const ears = add(new THREE.ConeGeometry(0.06, 0.16, 5), MAT.fur, -0.1, 0.22, -0.02, 1, 1, 1, head); add(new THREE.ConeGeometry(0.06, 0.16, 5), MAT.fur, 0.1, 0.22, -0.02, 1, 1, 1, head); ears.rotation.z = 0.2; }
  }
  g.scale.setScalar(scale);
  g.userData = { body, head, armL, armR, legL, legR, phase: Math.random() * TAU, salute: 0 };
  return g;
}
function animateSoldier(s, t, dt) {
  const u = s.userData, ph = t * 1.6 + u.phase;
  u.body.position.y = Math.sin(ph) * 0.008;
  u.head.rotation.y = Math.sin(ph * 0.3) * 0.25 + (u.look || 0);
  u.armL.rotation.x = Math.sin(ph) * 0.03;
  // right fist to the chest when saluting
  u.armR.rotation.x = lerp(Math.sin(ph + 1) * 0.03, -1.9, u.salute);
  u.armR.rotation.z = lerp(0, 0.9, u.salute);
}

// ------------------------------------------------------------- torchShip --
function makeShip(scale = 1) {
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m; };
  add(new THREE.CylinderGeometry(14, 18, 320, 10), MAT.hull, 0, 0, 0, Math.PI / 2);
  add(new THREE.BoxGeometry(46, 16, 240), MAT.hull, 0, -10, 10);
  add(new THREE.ConeGeometry(14, 90, 10), MAT.hull, 0, 0, -205, -Math.PI / 2);
  add(new THREE.BoxGeometry(80, 4, 70), MAT.hull, 0, 4, 80);
  add(new THREE.BoxGeometry(10, 30, 50), MAT.hull, 0, 22, 110);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(14, 22, 120), MAT.hull, s * 30, -4, 40);
  // engines
  for (const [x, y] of [[-16, -6], [16, -6], [0, 10], [0, -18]]) {
    add(new THREE.CylinderGeometry(7, 9, 26, 16), MAT.hull, x, y, 170, Math.PI / 2);
    add(new THREE.CircleGeometry(6.4, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x9fd0ff).multiplyScalar(9) }), x, y, 183.2);
  }
  // greebles and lit windows as instanced boxes
  const greb = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), MAT.hull, 420);
  const lit = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd8a0).multiplyScalar(4) }), 500);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = V3(), sc = V3();
  for (let i = 0; i < 420; i++) { const z = rand(-150, 150), side = Math.random() < 0.5 ? -1 : 1; p.set(side * rand(10, 24), rand(-2, 12), z); sc.set(rand(1, 5), rand(1, 4), rand(2, 14)); m.compose(p, q, sc); greb.setMatrixAt(i, m); }
  for (let i = 0; i < 500; i++) { const z = rand(-140, 150), side = Math.random() < 0.5 ? -1 : 1; p.set(side * rand(14.2, 24), rand(-12, 6), z); sc.set(0.3, 0.5, rand(0.8, 2)); m.compose(p, q, sc); lit.setMatrixAt(i, m); }
  g.add(greb, lit);
  // drop tubes along the belly
  const tubes = [];
  const ringMat = MAT.redLight;
  for (let i = 0; i < 14; i++) for (const s of [-1, 1]) {
    const x = s * 12, z = -80 + i * 13;
    add(new THREE.CircleGeometry(2.6, 18), new THREE.MeshBasicMaterial({ color: 0x050202 }), x, -18.1, z, Math.PI / 2);
    add(new THREE.TorusGeometry(2.8, 0.25, 6, 20), ringMat, x, -18.15, z, Math.PI / 2);
    tubes.push(V3(x, -19, z));
  }
  g.scale.setScalar(scale);
  g.userData.tubes = tubes;
  return g;
}

// ---------------------------------------------------------------- planet --
// Terraformed Mars as the Society keeps it: rust highlands, dark basalt, green-blue
// lowland seas, polar ice, and city lights scattered through the night side.
function makeMars(radius) {
  const uniforms = { sunDir: { value: V3(-0.6, 0.35, 0.7).normalize() }, time: { value: 0 }, detail: { value: 1 } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `varying vec3 vN; varying vec3 vObj; varying vec3 vWorld;
      void main(){ vObj = normalize(position); vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 sunDir; uniform float time, detail; varying vec3 vN; varying vec3 vObj; varying vec3 vWorld;
      ${GLSL_NOISE}
      void main(){
        vec3 n = vObj;
        float cont = fbm(n*2.2 + 4.0);
        float h = fbm(n*6.0) ;
        float fine = fbm(n*28.0*detail + 2.0);
        float sea = (1.0 - smoothstep(0.37, 0.40, cont));
        vec3 rust = vec3(0.50,0.17,0.07), dark = vec3(0.16,0.07,0.045), sand = vec3(0.74,0.43,0.24), basalt = vec3(0.11,0.07,0.06);
        vec3 col = mix(dark, rust, smoothstep(0.35,0.62,h));
        col = mix(col, sand, smoothstep(0.55,0.78,fine) * 0.55);
        col = mix(col, basalt, smoothstep(0.58,0.72,fbm(n*9.0+7.0)) * 0.55);
        float rift = 1.0 - smoothstep(0.0, 0.025, abs(fbm(n*3.0+11.0) - 0.5));
        col = mix(col, dark*0.6, rift*0.8);
        vec3 green = vec3(0.12,0.20,0.08);
        col = mix(col, green, (1.0 - smoothstep(0.40, 0.46, cont)) * 0.55);
        vec3 water = mix(vec3(0.01,0.03,0.06), vec3(0.02,0.07,0.11), fine);
        col = mix(col, water, sea);
        float ice = smoothstep(0.80, 0.88, abs(n.y) + (fine-0.5)*0.12);
        col = mix(col, vec3(0.92,0.90,0.88), ice);
        col *= 0.42; // real Mars is dark: keep albedo low so the sunlit side does not wash out
        float d = dot(normalize(vN), sunDir);
        float light = smoothstep(-0.15, 0.6, d);
        vec3 lit = col * (0.03 + 1.6*light);
        float spec = sea * pow(max(dot(reflect(-sunDir, normalize(vN)), normalize(cameraPosition - vWorld)), 0.0), 40.0) * light;
        lit += vec3(1.0,0.85,0.7) * spec * 0.6;
        float city = step(0.78, vnoise(n*180.0)) * (1.0 - smoothstep(0.45, 0.55, cont)) * (1.0 - sea) * (1.0 - ice);
        city *= 0.6 + 0.4*vnoise(n*700.0);
        lit += vec3(1.0,0.62,0.3) * city * (1.0 - smoothstep(-0.25, 0.05, d)) * 2.2;
        float rim = pow(1.0 - max(dot(normalize(vN), normalize(cameraPosition - vWorld)),0.0), 3.0);
        lit += vec3(0.9,0.45,0.25) * rim * smoothstep(-0.3,0.4,d) * 0.6;
        gl_FragColor = vec4(lit, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 160, 96), mat);
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.035, 96, 64), new THREE.ShaderMaterial({
    uniforms, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide,
    vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
    fragmentShader: `uniform vec3 sunDir; varying vec3 vN; varying vec3 vW;
      void main(){ vec3 v = normalize(cameraPosition - vW); float f = pow(1.0 - abs(dot(v, vN)), 2.2); float day = smoothstep(-0.35, 0.5, dot(-vN, sunDir));
        vec3 c = mix(vec3(1.0,0.45,0.2), vec3(1.0,0.75,0.5), f); gl_FragColor = vec4(c * f * day * 1.6, 1.0); }`,
  }));
  const g = new THREE.Group(); g.add(mesh, atmo); g.userData.uniforms = uniforms;
  return g;
}

function makeStars(n = 7000, R = 150000) {
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const u = Math.random() * 2 - 1, a = Math.random() * TAU, s = Math.sqrt(1 - u * u);
    // thicken a band to suggest the galaxy
    const band = Math.random() < 0.45; const y = band ? rand(-0.18, 0.18) : u;
    const ss = Math.sqrt(1 - y * y);
    pos.set([Math.cos(a) * ss * R, y * R, Math.sin(a) * ss * R], i * 3);
    const t = Math.random(); col.set(t < 0.15 ? [1, 0.75, 0.6] : t < 0.3 ? [0.7, 0.8, 1] : [1, 0.97, 0.92], i * 3);
    size[i] = Math.pow(Math.random(), 9) * 3.5 + 0.9;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { map: { value: softDot }, k: { value: DPR } },
    vertexShader: 'attribute float size; attribute vec3 color; varying vec3 vC; uniform float k; void main(){ vC = color * (0.5 + size*0.35); gl_PointSize = size * k; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform sampler2D map; varying vec3 vC; void main(){ gl_FragColor = vec4(vC, 1.0) * texture2D(map, gl_PointCoord).a; }' });
  return new THREE.Points(geo, mat);
}
function makeSun(dir, dist) {
  const tex = canvasTex(256, 256, (g) => { const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.08, 'rgba(255,240,220,1)'); gr.addColorStop(0.2, 'rgba(255,200,150,.35)'); gr.addColorStop(1, 'rgba(255,150,80,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); }, { srgb: false });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(1, 0.95, 0.9).multiplyScalar(12), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  s.position.copy(dir).multiplyScalar(dist); s.scale.setScalar(dist * 0.08);
  return s;
}

// ------------------------------------------------------------------- FX --
// Pooled sprites for fire, smoke and sparks, plus pooled flash lights.
class FX {
  constructor(scene, n = 260) {
    this.scene = scene; this.items = [];
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex, transparent: true, depthWrite: false }));
      s.visible = false; scene.add(s); this.items.push({ s, life: 0 });
    }
    this.lights = [];
    for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xffa060, 0, 120, 2); scene.add(l); this.lights.push(l); }
    this.li = 0; this.i = 0;
  }
  spawn(o) {
    const it = this.items[this.i]; this.i = (this.i + 1) % this.items.length;
    const m = it.s.material;
    m.map = o.tex || fireTex; m.blending = o.add ? THREE.AdditiveBlending : THREE.NormalBlending;
    m.color.set(o.color || 0xffffff); if (o.hdr) m.color.multiplyScalar(o.hdr);
    m.rotation = Math.random() * TAU;
    it.s.position.copy(o.pos); it.vel = (o.vel || V3()).clone(); it.life = it.max = o.life || 1; it.s0 = o.size || 1; it.s1 = o.grow || it.s0 * 2;
    it.alpha = o.alpha ?? 1; it.drag = o.drag ?? 1; it.spin = rand(-1, 1); it.s.visible = true;
    return it;
  }
  flash(pos, intensity = 30, dist = 120) { const l = this.lights[this.li]; this.li = (this.li + 1) % this.lights.length; l.position.copy(pos); l.intensity = intensity; l.distance = dist; l.userData.k = intensity; }
  explode(pos, scale = 1, drift = V3()) {
    for (let k = 0; k < 9; k++) this.spawn({ pos: pos.clone().add(V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(scale * 0.8)), vel: V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(scale * 6).add(drift), tex: fireTex, add: true, hdr: 5, life: rand(0.5, 0.9), size: scale * rand(2, 4), grow: scale * rand(6, 10), drag: 2.5 });
    for (let k = 0; k < 8; k++) this.spawn({ pos: pos.clone().add(V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(scale)), vel: V3(rand(-1, 1), rand(-0.5, 1), rand(-1, 1)).multiplyScalar(scale * 3).add(drift), tex: smokeTex, color: 0x40342e, life: rand(1.6, 2.6), size: scale * 4, grow: scale * rand(10, 16), alpha: 0.85, drag: 1.2 });
    for (let k = 0; k < 18; k++) this.spawn({ pos: pos.clone(), vel: V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(scale * rand(18, 40)).add(drift), tex: softDot, add: true, color: 0xffc070, hdr: 8, life: rand(0.3, 0.7), size: scale * 0.5, grow: scale * 0.1, drag: 1.5 });
    this.flash(pos, 60 * scale, 80 * scale);
  }
  update(dt, worldVel) {
    for (const it of this.items) {
      if (!it.s.visible) continue;
      it.life -= dt; if (it.life <= 0) { it.s.visible = false; continue; }
      const k = 1 - it.life / it.max;
      it.vel.multiplyScalar(Math.max(0, 1 - it.drag * dt));
      it.s.position.addScaledVector(it.vel, dt); if (worldVel) it.s.position.addScaledVector(worldVel, dt);
      const sc = lerp(it.s0, it.s1, 1 - Math.pow(1 - k, 2.2)); it.s.scale.set(sc, sc, 1);
      it.s.material.opacity = it.alpha * Math.min(1, (1 - k) * 1.8) * Math.min(1, k * 12 + 0.3);
      it.s.material.rotation += it.spin * dt;
    }
    for (const l of this.lights) if (l.intensity > 0) { l.intensity = Math.max(0, l.intensity - (l.userData.k || 1) * dt * 3.5); if (worldVel) l.position.addScaledVector(worldVel, dt); }
  }
  clear() { for (const it of this.items) it.s.visible = false; for (const l of this.lights) l.intensity = 0; }
}
