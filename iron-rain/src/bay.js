// ---------------------------------------------------------------------------
// Phase 1: the launch bay. Walk to your pod, talk to Sevro, climb in, launch.
// ---------------------------------------------------------------------------
const BAY = { minX: -10.5, maxX: 10.5, minZ: -39, maxZ: 9, H: 12 };
const DIALOGUE = [
  ['SEVRO', 'Howler', 'Look who finally showed. I bet Pax you\'d try to take the shuttle down like a Pink.'],
  ['DARROW', 'The Reaper', 'And miss the view?'],
  ['SEVRO', 'Howler', 'Ten thousand of us in tin cans, about to drop on the Society\'s head. The Howlers fall right behind you. Try to land on something soft.'],
  ['ORION', 'Fleet comms', 'Fleet holding position over Agea. Flak batteries are hot below the cloud line. Pods arm on your mark, Reaper.'],
  ['DARROW', 'The Reaper', 'For Eo. For every Red still in the dark. Break the chains.'],
  ['SEVRO', 'Howler', 'Hail, Reaper. See you on the ground.'],
];

function volumetricCone(radius, height, color, strength = 0.35) {
  const geo = new THREE.ConeGeometry(radius, height, 32, 1, true); geo.translate(0, -height / 2, 0);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { color: { value: new THREE.Color(color) }, h: { value: height }, k: { value: strength }, time: { value: 0 } },
    vertexShader: 'varying vec3 vP; varying vec3 vN; varying vec3 vW; void main(){ vP = position; vN = normalize(normalMatrix*normal); vec4 w = modelViewMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*w; }',
    fragmentShader: `uniform vec3 color; uniform float h, k, time; varying vec3 vP; varying vec3 vN; varying vec3 vW;
      ${GLSL_NOISE}
      void main(){ float along = clamp(-vP.y/h, 0.0, 1.0); float edge = pow(abs(dot(normalize(-vW), vN)), 1.5);
        float dust = 0.65 + 0.35*vnoise(vP*1.8 + vec3(0.0, time*0.3, 0.0));
        gl_FragColor = vec4(color * k * edge * (1.0-along) * (1.0-along) * dust, 1.0); }`,
  });
  return new THREE.Mesh(geo, mat);
}

class BayPhase {
  constructor() {
    const s = this.scene = new THREE.Scene();
    s.fog = new THREE.FogExp2(0x0a0606, 0.019);
    s.background = new THREE.Color(0x030202);
    this.t = 0; this.state = 'walk'; this.cones = []; this.alarms = [];
    this.build();
    this.yaw = 0; this.pitch = -0.04; this.pos = V3(0, 1.72, 6.5); this.bob = 0; this.stepT = 0;
    this.dlg = -1; this.chars = 0;
  }
  build() {
    const s = this.scene, W = BAY.maxX - BAY.minX + 3, L = BAY.maxZ - BAY.minZ + 3, cz = (BAY.maxZ + BAY.minZ) / 2;
    s.add(new THREE.HemisphereLight(0x5a4440, 0x1a0c0a, 1.1));
    for (let z = -32; z <= 6; z += 9.5) { const f = new THREE.PointLight(0xffb080, 1.4, 16, 2); f.position.set(0, 5, z); s.add(f); }
    // floor and ceiling
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, L), new THREE.MeshStandardMaterial({ map: floorTex, metalness: 0.6, roughness: 0.55, envMap: ENV_BAY, envMapIntensity: 0.7 }));
    floor.rotation.x = -Math.PI / 2; floor.position.z = cz; floor.receiveShadow = true; s.add(floor);
    const wallMat = MAT.hull.clone(); wallMat.envMap = ENV_BAY; wallMat.map = panelTex.clone(); wallMat.map.wrapS = wallMat.map.wrapT = THREE.RepeatWrapping; wallMat.map.repeat.set(6, 3); wallMat.map.needsUpdate = true; wallMat.color.set(0x5a5450);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, L), wallMat); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, BAY.H, cz); s.add(ceil);
    const box = (w, h, d, x, y, z, mat = wallMat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.receiveShadow = true; s.add(m); return m; };
    // right wall solid, left wall with a long window onto Mars
    box(1, BAY.H, L, BAY.maxX + 2, BAY.H / 2, cz);
    box(1, 3, L, BAY.minX - 2, 1.5, cz); box(1, 3, L, BAY.minX - 2, BAY.H - 1.5, cz);
    for (let z = BAY.minZ; z <= BAY.maxZ; z += 6) box(1.2, BAY.H, 0.6, BAY.minX - 2, BAY.H / 2, z);
    box(W, BAY.H, 1, 0, BAY.H / 2, BAY.minZ - 2); box(W, BAY.H, 1, 0, BAY.H / 2, BAY.maxZ + 2);
    // ceiling ribs, light strips, gantry
    for (let z = BAY.minZ; z <= BAY.maxZ; z += 4) { box(W, 0.6, 0.5, 0, BAY.H - 0.3, z); }
    for (const x of [-6, 6]) box(0.25, 0.08, L, x, BAY.H - 0.7, cz, MAT.whiteLight);
    box(W, 0.3, 1.6, 0, 7.5, -20); box(W, 0.3, 1.6, 0, 7.5, -4);
    // floor guide stripes
    for (const x of [-2.2, 2.2]) box(0.12, 0.02, L, x, 0.011, cz, MAT.goldLight).material = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xe0b552).multiplyScalar(0.9) });
    // Mars through the window
    this.mars = makeMars(5200); this.mars.position.set(-9000, -3800, -9000); this.mars.userData.uniforms.sunDir.value.set(0.4, 0.5, 0.8).normalize(); s.add(this.mars);
    this.stars = makeStars(3000, 60000); s.add(this.stars);
    const marsLight = new THREE.DirectionalLight(0xff8a50, 1.1); marsLight.position.set(-10, 3, -6); s.add(marsLight);
    // the banner of the Rising
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 8.8), new THREE.MeshStandardMaterial({ map: bannerTex, roughness: 0.9, side: THREE.DoubleSide }));
    banner.position.set(0, 7.2, BAY.minZ - 1.4); s.add(banner); this.banner = banner;
    // pods in cradles along both sides, and the Reaper's pod at the end
    this.pods = [];
    const cradle = (x, z, rot) => {
      const pod = makePod({ open: true }); pod.position.set(x, 2.35, z); pod.rotation.y = rot; s.add(pod);
      for (const dx of [-1.3, 1.3]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.25, 5, 0.25), MAT.armor); f.position.set(dx, 0, 0.9); pod.add(f); }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.06, 6, 28), MAT.redLight); ring.rotation.x = Math.PI / 2; ring.position.set(x, 0.03, z); s.add(ring);
      this.pods.push(pod); return pod;
    };
    for (let i = 0; i < 8; i++) cradle(7.6, -32 + i * 4.6, Math.PI / 2);
    for (let i = 0; i < 6; i++) cradle(-7.6, -32 + i * 4.6, -Math.PI / 2);
    this.myPod = makePod({ open: true, beacon: true }); this.myPod.position.set(0, 2.35, -36); this.myPod.rotation.y = Math.PI; s.add(this.myPod);
    const goldRing = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.08, 6, 32), MAT.goldLight); goldRing.rotation.x = Math.PI / 2; goldRing.position.set(0, 0.03, -36); s.add(goldRing);
    const tag = labelSprite('POD 01 · REAPER'); tag.position.set(0, 5.1, -36); s.add(tag);
    // spot lights with visible shafts
    const spot = (x, z, color, intensity, shadow) => {
      const l = new THREE.SpotLight(color, intensity, 22, 0.42, 0.7, 1.6); l.position.set(x, BAY.H - 0.8, z); l.target.position.set(x, 0, z);
      if (shadow) { l.castShadow = true; l.shadow.mapSize.set(1024, 1024); l.shadow.bias = -0.0004; }
      s.add(l, l.target);
      const c = volumetricCone(4.6, BAY.H - 0.8, color, 0.22); c.position.set(x, BAY.H - 0.8, z); s.add(c); this.cones.push(c);
    };
    spot(0, -36, 0xffc070, 9, true);
    for (let z = -26; z <= 4; z += 10) spot(0, z, 0xffe6cc, 4.5, z === -16);
    spot(0, 8.5, 0xffd8b0, 3.5, false);
    const entry = new THREE.PointLight(0xffa070, 2.2, 18, 2); entry.position.set(0, 3, 2); s.add(entry);
    // rotating red alarms on the walls
    for (let z = -34; z <= 6; z += 10) for (const x of [BAY.maxX + 1.4, BAY.minX - 1.4]) {
      const l = new THREE.PointLight(0xff2a10, 0, 16, 2); l.position.set(x, 9, z); s.add(l);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), MAT.redLight); lamp.position.copy(l.position); s.add(lamp);
      this.alarms.push(l);
    }
    // soldiers waiting by their pods; Sevro by yours
    this.soldiers = [];
    const place = (x, z, ry, o) => { const m = makeSoldier(o); m.position.set(x, 0, z); m.rotation.y = ry; s.add(m); this.soldiers.push(m); return m; };
    for (let i = 0; i < 8; i++) if (i !== 3) place(5.4, -32 + i * 4.6 + rand(-0.5, 0.5), -Math.PI / 2 + rand(-0.3, 0.3), { scale: rand(0.97, 1.08) });
    for (let i = 0; i < 6; i++) if (i !== 1) place(-5.4, -32 + i * 4.6 + rand(-0.5, 0.5), Math.PI / 2 + rand(-0.3, 0.3), { scale: rand(0.97, 1.08), cape: i === 4 });
    place(4.2, -9, -2.4, { scale: 1.15 }); place(-3.6, -20.5, 2.2, {});
    this.sevro = place(1.9, -33.4, -0.35, { scale: 0.86, sevro: true });
    const st = labelSprite('SEVRO'); st.position.set(0, 2.25, 0); this.sevro.add(st); st.scale.set(1.3, 0.32, 1);
    // haze
    const n = 900, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pos.set([rand(BAY.minX, BAY.maxX), rand(0, BAY.H), rand(BAY.minZ, BAY.maxZ)], i * 3);
    const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.haze = new THREE.Points(hg, new THREE.PointsMaterial({ map: softDot, size: 0.09, color: new THREE.Color(0xffd0a0).multiplyScalar(1.2), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.add(this.haze);
    this.colliders = [...this.pods, this.myPod].map((p) => ({ x: p.position.x, z: p.position.z, r: 1.45 })).concat(this.soldiers.map((m) => ({ x: m.position.x, z: m.position.z, r: 0.45 })));
  }
  enter() {
    renderPass.scene = this.scene;
    camera.fov = 72; camera.near = 0.05; camera.far = 200000; camera.updateProjectionMatrix();
    bloom.strength = 0.7; bloom.threshold = 0.9; post.vig.value = 0.55; post.aberr.value = 0.004; post.exposure.value = 1.3;
    Input.wantLock = true;
    Input.setTouch(true, true, true, 'Act', 'Run');
    UI.objective('Report to your pod', 'Pod 01 · end of the bay');
    $('crosshair').hidden = false;
    Sound.loop('hum', { type: 'noise', freq: 180, osc: [[50, 'sawtooth', 0.25], [100.5, 'sine', 0.2]] }); Sound.set('hum', 0.22, 180);
    Music.play('bay');
  }
  exit() { $('crosshair').hidden = true; UI.objective(null); UI.prompt(null); Input.wantLock = false; if (document.exitPointerLock && Input.locked) document.exitPointerLock(); }

  update(dt) {
    this.t += dt;
    for (const c of this.cones) c.material.uniforms.time.value = this.t;
    const hp = this.haze.geometry.attributes.position;
    for (let i = 0; i < hp.count; i++) { let y = hp.getY(i) + dt * 0.06; if (y > BAY.H) y = 0; hp.setY(i, y); }
    hp.needsUpdate = true;
    this.myPod.userData.beacon.material = Math.sin(this.t * 6) > 0 ? MAT.goldLight : MAT.armor;
    this.mars.rotation.y += dt * 0.004;
    for (const m of this.soldiers) {
      const dx = this.pos.x - m.position.x, dz = this.pos.z - m.position.z, d = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz) - m.rotation.y;
      m.userData.look = damp(m.userData.look || 0, d < 7 ? clamp(Math.atan2(Math.sin(want), Math.cos(want)), -1, 1) : 0, 4, dt);
      if (m !== this.sevro) {
        const sal = d < 3.2 && this.state === 'walk';
        if (sal && !m.userData.saluted) { m.userData.saluted = true; UI.subtitle('“Hail, Reaper.”', 1.6); Sound.tone(180, 0.25, { type: 'sawtooth', vol: 0.02, wet: 0.5 }); }
        m.userData.salute = damp(m.userData.salute, sal || (m.userData.saluted && d < 5) ? 1 : 0, 5, dt);
      }
      animateSoldier(m, this.t, dt);
    }
    if (this.state === 'walk') this.walk(dt);
    else if (this.state === 'talk') this.talk(dt);
    else if (this.state === 'board') this.board(dt);
    camera.position.copy(this.pos);
    camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    if (this.state === 'walk') camera.position.y += Math.sin(this.bob) * 0.035;
    Shake.apply(camera, dt, this.t);
  }
  walk(dt) {
    const l = Input.consumeLook();
    this.yaw -= l.x * 0.0026; this.pitch = clamp(this.pitch - l.y * 0.0022, -1.2, 1.2);
    const a = Input.axis(), sp = Input.down('b') ? 5.4 : 3.1;
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    let vx = (fx * a.y + rx * a.x) * sp, vz = (fz * a.y + rz * a.x) * sp;
    const m = Math.hypot(a.x, a.y);
    this.pos.x += vx * dt; this.pos.z += vz * dt;
    this.pos.x = clamp(this.pos.x, BAY.minX + 0.5, BAY.maxX - 0.5); this.pos.z = clamp(this.pos.z, BAY.minZ + 0.6, BAY.maxZ);
    for (const c of this.colliders) { const dx = this.pos.x - c.x, dz = this.pos.z - c.z, d = Math.hypot(dx, dz), r = c.r + 0.35; if (d < r && d > 0) { this.pos.x = c.x + dx / d * r; this.pos.z = c.z + dz / d * r; } }
    if (m > 0.1) { this.bob += dt * sp * 2.6; this.stepT -= dt * sp; if (this.stepT <= 0) { this.stepT = 2.2; Sound.step(); } }
    const dS = Math.hypot(this.pos.x - this.sevro.position.x, this.pos.z - this.sevro.position.z);
    if (!this.talked && dS < 4.4) { this.startTalk(); return; }
    if (this.talked) {
      const dP = Math.hypot(this.pos.x - 0, this.pos.z - (-34.2));
      if (dP < 2.4) { UI.prompt(IS_TOUCH ? 'Tap ACT to enter the pod' : 'Press SPACE to enter the pod'); if (Input.pressed('a')) this.startBoard(); }
      else UI.prompt(null);
    }
  }
  startTalk() {
    this.state = 'talk'; this.dlg = -1; this.talked = true; this.nextLine();
    UI.objective(null); $('crosshair').hidden = true;
    this.sevro.userData.salute = 0;
  }
  nextLine() {
    this.dlg++; this.chars = 0;
    if (this.dlg >= DIALOGUE.length) { UI.dialogue(null); this.state = 'walk'; UI.objective('Enter your starShell', 'Pod 01 is open'); $('crosshair').hidden = false; return; }
    const [who, role] = DIALOGUE[this.dlg]; UI.dialogue(who, role, '');
    Sound.beep(who === 'ORION' ? 1500 : 900, who === 'ORION' ? 2 : 1, 0.09);
    if (this.dlg === DIALOGUE.length - 1) this.sevro.userData.salute = 1;
  }
  talk(dt) {
    // turn to face Sevro
    const dx = this.sevro.position.x - this.pos.x, dz = this.sevro.position.z - this.pos.z;
    const want = Math.atan2(-dx, -dz); let d = want - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * Math.min(1, dt * 4); this.pitch = damp(this.pitch, -0.08, 4, dt);
    const line = DIALOGUE[this.dlg][2];
    this.chars = Math.min(line.length, this.chars + dt * 48);
    UI.dialogueText(line.slice(0, Math.floor(this.chars)));
    if (Input.pressed('a') || Input.tap) { if (this.chars < line.length) this.chars = line.length; else this.nextLine(); }
    this.sevro.userData.body.rotation.z = Math.sin(this.t * 3) * 0.02;
  }
  startBoard() {
    this.state = 'board'; this.bt = 0; UI.prompt(null); UI.objective(null); $('crosshair').hidden = true;
    this.from = { pos: this.pos.clone(), yaw: this.yaw, pitch: this.pitch };
    Input.setTouch(false, false, false);
    $('skip').hidden = true;
  }
  board(dt) {
    this.bt += dt; const t = this.bt;
    const inside = V3(0, 2.45, -36.05);
    // walk in, turn around, hatch shuts, countdown, launch
    if (t < 2.2) {
      const k = smooth(t / 2.2);
      this.pos.lerpVectors(this.from.pos, inside, k);
      // end facing back out through the hatch (+z is yaw = PI)
      let dy = Math.PI - this.from.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      this.yaw = lerp(this.from.yaw, this.from.yaw + dy, smooth(clamp((t - 0.9) / 1.3, 0, 1)));
      this.pitch = lerp(this.from.pitch, -0.05, k);
    }
    const hinge = this.myPod.userData.hinge;
    if (t > 2.4 && !this.shut) { this.shut = true; Sound.tone(90, 1.3, { type: 'sawtooth', vol: 0.05, slide: 1.4, wet: 0.6 }); }
    if (t > 2.4) hinge.rotation.y = lerp(-1.9, 0, smooth((t - 2.4) / 1.3));
    if (t > 3.7 && !this.clanked) { this.clanked = true; Sound.clank(); Shake.add(0.35); UI.visor(true); Sound.set('hum', 0.08, 120); Music.play('launch'); }
    if (t > 4.2) {
      const c = Math.ceil(9.2 - t);
      UI.count(c > 0 && c <= 5 ? String(c) : '');
      if (c !== this.lastC && c > 0 && c <= 5) { this.lastC = c; Sound.beep(c === 1 ? 1800 : 1200, 1); for (const a of this.alarms) a.intensity = 6; }
      if (t > 4.4 && !this.said1) { this.said1 = true; UI.subtitle('ORION: All pods armed. Iron Rain on my mark.', 2.4); }
      if (t > 6.9 && !this.said2) { this.said2 = true; UI.subtitle('ORION: Iron Rain. Iron Rain. Iron Rain.', 2.2); }
    }
    for (const a of this.alarms) a.intensity = Math.max(0, a.intensity - dt * 7);
    if (t > 9.2 && !this.launched) {
      this.launched = true; UI.count(''); Shake.add(1.4); Sound.noise(3.5, { vol: 0.9, freq: 300, sweep: 8, wet: 0.4, attack: 0.05 }); Sound.boom(0);
    }
    if (t > 9.2) { post.flash.value = clamp((t - 9.6) / 0.6, 0, 1); this.pos.y -= dt * (t - 9.2) * 20; }
    if (t > 10.3) Game.toCinematic();
  }
}
