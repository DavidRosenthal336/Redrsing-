// ---------------------------------------------------------------------------
// Space: the fleet above Mars, the launch cinematic, and the playable fall
// ---------------------------------------------------------------------------
const PLANET_R = 20000, KM = 60; // world units per kilometre of altitude

function trailMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { time: { value: 0 }, tint: { value: new THREE.Color(1, 1, 1) } },
    vertexShader: `uniform vec3 tint; varying float vY; varying vec3 vC; void main(){ vY = position.y; vC = tint;
      #ifdef USE_INSTANCING_COLOR
        vC = instanceColor;
      #endif
      vec4 p = vec4(position,1.0);
      #ifdef USE_INSTANCING
        p = instanceMatrix * p;
      #endif
      gl_Position = projectionMatrix * modelViewMatrix * p; }`,
    fragmentShader: 'varying float vY; varying vec3 vC; void main(){ float k = pow(1.0 - clamp(vY,0.0,1.0), 2.2); gl_FragColor = vec4(vC * k, 1.0); }',
  });
}
const TRAIL_GEO = (() => { const g = new THREE.CylinderGeometry(0.04, 0.85, 1, 10, 1, true); g.translate(0, 0.5, 0); return g; })();

function plasmaShell() {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { time: { value: 0 }, heat: { value: 0 } },
    vertexShader: 'varying vec3 vP; varying vec3 vN; varying vec3 vV; void main(){ vP = position; vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
    fragmentShader: `uniform float time, heat; varying vec3 vP; varying vec3 vN; varying vec3 vV;
      ${GLSL_NOISE}
      void main(){ float f = 1.0 - abs(dot(vN, vV)); float n = fbm3(vP*2.5 + vec3(0.0, time*9.0, 0.0));
        float lead = (1.0 - smoothstep(-1.0, 0.6, vP.y));
        vec3 c = mix(vec3(1.0,0.25,0.05), vec3(1.0,0.85,0.55), n*lead);
        gl_FragColor = vec4(c * heat * (pow(f,1.5)*1.6 + lead*0.6) * (0.5 + n) * 1.3, 1.0); }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), mat); m.scale.set(1.7, 2.6, 1.7); m.position.y = -0.7;
  const flameMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: mat.uniforms,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform float time, heat; varying vec3 vP; ${GLSL_NOISE}
      void main(){ float along = clamp(vP.y, 0.0, 1.0); float n = fbm3(vec3(vP.x*3.0, vP.y*4.0 - time*6.0, vP.z*3.0));
        float a = (1.0-along)*(1.0-along) * smoothstep(0.25, 0.7, n + (1.0-along)*0.4);
        gl_FragColor = vec4(mix(vec3(1.0,0.3,0.05), vec3(1.0,0.8,0.5), 1.0-along) * a * heat * 1.4, 1.0); }`,
  });
  const fg = new THREE.CylinderGeometry(0.2, 1.9, 1, 18, 8, true); fg.translate(0, 0.5, 0);
  const flame = new THREE.Mesh(fg, flameMat); flame.position.y = 1.2; flame.scale.set(1, 16, 1);
  const g = new THREE.Group(); g.add(m, flame); g.userData.u = mat.uniforms;
  return g;
}

class SpaceWorld {
  constructor() {
    const s = this.scene = new THREE.Scene(); s.background = new THREE.Color(0x000000);
    this.sunDir = V3(-0.55, 0.42, -0.72).normalize();
    s.add(makeStars(7000, 150000));
    s.add(makeSun(this.sunDir, 140000));
    const key = new THREE.DirectionalLight(0xfff0e0, 3.2); key.position.copy(this.sunDir).multiplyScalar(1000); s.add(key);
    s.add(new THREE.HemisphereLight(0x302040, 0x6a2a10, 0.5));
    this.planet = new THREE.Group(); s.add(this.planet);
    this.mars = makeMars(PLANET_R); this.mars.userData.uniforms.sunDir.value.copy(this.sunDir); this.planet.add(this.mars);
    // tilt the globe so the drop lands in the temperate lowlands, not on the polar cap
    this.mars.rotation.set(1.15, 0.6, 0.2);
    this.fleet = new THREE.Group(); s.add(this.fleet);
    this.flagship = makeShip(1); this.fleet.add(this.flagship);
    this.ships = [this.flagship];
    for (const [x, y, z, sc, ry] of [[-520, 60, -380, 0.8, 0.15], [560, -40, -260, 0.9, -0.1], [-300, 140, 520, 0.7, 0.3], [700, 120, 480, 0.75, -0.2], [-900, -60, 120, 0.6, 0.05], [1100, 30, -700, 0.6, 0.1]]) {
      const sh = makeShip(sc); sh.position.set(x, y, z); sh.rotation.y = ry; this.fleet.add(sh); this.ships.push(sh);
    }
    this.fleet.updateMatrixWorld(true);
    this.fx = new FX(s);
    this.buildRain();
    this.setAlt(100);
  }
  setAlt(km) { this.alt = km; this.planet.position.y = -(PLANET_R + km * KM + 2.05); }
  buildRain() {
    const N = this.rainN = 320;
    this.rainPods = new THREE.InstancedMesh(POD_GEO, MAT.podSpace, N);
    this.rainTrails = new THREE.InstancedMesh(TRAIL_GEO, trailMaterial(), N);
    this.rainTrails.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    this.rainPods.frustumCulled = this.rainTrails.frustumCulled = false;
    this.scene.add(this.rainPods, this.rainTrails);
    this.rain = [];
    const tubes = [];
    for (const sh of this.ships) for (const t of sh.userData.tubes) tubes.push(sh.localToWorld(t.clone()));
    for (let i = 0; i < N; i++) {
      const o = tubes[i % tubes.length], wave = Math.floor(i / tubes.length);
      this.rain.push({ o: o.clone(), t0: 0.5 + (i % tubes.length) * 0.035 + wave * 2.2 + rand(0, 0.3), dx: rand(-3, 3), dz: rand(-3, 3), alive: true });
    }
  }
  podPos(r, t, out) { const tau = t - r.t0; out.set(r.o.x + r.dx * tau, r.o.y - (40 * tau + 45 * tau * tau), r.o.z + r.dz * tau); return tau; }
  // Launch mode: pods fall out of the tubes along a fixed curve
  updateRainLaunch(t) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = V3(), sc = V3(), c = new THREE.Color();
    for (let i = 0; i < this.rainN; i++) {
      const r = this.rain[i], tau = this.podPos(r, t, p);
      const on = tau > 0;
      sc.setScalar(on ? 1 : 0); m.compose(p, q, sc); this.rainPods.setMatrixAt(i, m);
      const speed = 40 + 90 * Math.max(0, tau), len = on ? clamp(speed * 0.35, 1, 160) : 0;
      sc.set(on ? 1 : 0, len, on ? 1 : 0); p.y += 1.6; m.compose(p, q, sc); this.rainTrails.setMatrixAt(i, m);
      const heat = clamp((tau - 2.5) / 3, 0, 1);
      c.setRGB(lerp(0.25, 3.0, heat), lerp(0.35, 1.0, heat), lerp(0.7, 0.22, heat)); this.rainTrails.setColorAt(i, c);
    }
    this.rainPods.instanceMatrix.needsUpdate = this.rainTrails.instanceMatrix.needsUpdate = true; this.rainTrails.instanceColor.needsUpdate = true;
  }
  // Fall mode: the rain falls alongside the player, laid out relative to them
  layoutRainFall() {
    for (let i = 0; i < this.rainN; i++) {
      const near = i < 22, a = rand(0, TAU), d = near ? rand(14, 70) : rand(90, 1400);
      this.rain[i] = { x: Math.cos(a) * d, y: near ? rand(-25, 30) : rand(-900, 900), z: Math.sin(a) * d - (near ? 10 : 0), vy: rand(-6, 6), near, alive: true, wob: rand(0, TAU) };
    }
  }
  updateRainFall(dt, heat, playerVel) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = V3(), sc = V3(), c = new THREE.Color();
    for (let i = 0; i < this.rainN; i++) {
      const r = this.rain[i];
      r.y += r.vy * dt; r.wob += dt; if (!r.near) { if (r.y > 1200) r.y = -1200; if (r.y < -1200) r.y = 1200; }
      r.x -= playerVel.x * dt * 0.15; r.z -= playerVel.z * dt * 0.15;
      p.set(r.x + Math.sin(r.wob) * 0.6, r.y, r.z);
      sc.setScalar(r.alive ? 1 : 0); m.compose(p, q, sc); this.rainPods.setMatrixAt(i, m);
      // nearby pods keep short trails so they never sweep past the camera
      const len = r.near ? 5 + heat * 12 : 30 + heat * 60;
      p.y += 1.6; sc.set(r.alive ? 1 : 0, r.alive ? len : 0, r.alive ? 1 : 0); m.compose(p, q, sc); this.rainTrails.setMatrixAt(i, m);
      c.setRGB(lerp(0.1, 2.6, heat), lerp(0.13, 0.8, heat), lerp(0.28, 0.15, heat)); this.rainTrails.setColorAt(i, c);
    }
    this.rainPods.instanceMatrix.needsUpdate = this.rainTrails.instanceMatrix.needsUpdate = true; this.rainTrails.instanceColor.needsUpdate = true;
  }
}

// ------------------------------------------------------------ cinematic --
class CinematicPhase {
  constructor(world) {
    this.w = world; this.t = 0;
    this.pod = makePod({ space: true, beacon: true }); world.scene.add(this.pod);
    this.trail = new THREE.Mesh(TRAIL_GEO, trailMaterial()); world.scene.add(this.trail);
    this.plasma = plasmaShell(); this.pod.add(this.plasma);
    const fs = world.flagship;
    this.tube = fs.localToWorld(fs.userData.tubes[19].clone());
    this.me = { o: this.tube.clone(), t0: 1.5, dx: 0.4, dz: -0.6 };
  }
  enter() {
    const w = this.w; renderPass.scene = w.scene; w.setAlt(100); w.fleet.position.set(0, 0, 0);
    camera.fov = 50; camera.near = 0.5; camera.far = 400000; camera.updateProjectionMatrix();
    bloom.strength = 0.6; bloom.threshold = 1.0; bloom.radius = 0.45; post.vig.value = 0.7; post.aberr.value = 0.008;
    UI.letterbox(true); UI.visor(false); UI.count(''); $('skip').hidden = false; post.exposure.value = 1;
    Input.setTouch(false, false, false);
    Music.play('launch');
    Sound.set('hum', 0); Sound.loop('wind', { type: 'noise', freq: 600, q: 0.7 }); Sound.set('wind', 0.12, 500);
    this.flashOut = 1;
  }
  exit() { UI.letterbox(false); $('skip').hidden = true; UI.podTag(null); this.pod.visible = false; this.trail.visible = false; UI.subtitle(null); }
  update(dt) {
    const t = (this.t += dt), w = this.w;
    post.flash.value = Math.max(0, (this.flashOut -= dt * 1.4));
    w.updateRainLaunch(t);
    const pp = V3(); const tau = w.podPos(this.me, t, pp);
    this.pod.position.copy(pp); this.pod.visible = tau > 0;
    const speed = 40 + 90 * Math.max(0, tau);
    this.trail.position.copy(pp).y += 1.6; this.trail.scale.set(1, clamp(speed * 0.35, 1, 160), 1); this.trail.visible = tau > 0;
    this.trail.material.uniforms.tint.value.setRGB(lerp(0.3, 3.0, clamp((tau - 2.6) / 2.5, 0, 1)), 0.4, 0.6);
    this.trail.material.uniforms.time.value = t;
    const heat = clamp((tau - 2.6) / 2.5, 0, 1);
    this.plasma.userData.u.heat.value = heat; this.plasma.userData.u.time.value = t;
    this.pod.userData.beacon.visible = Math.sin(t * 10) > 0;
    if (tau > 0 && !this.ejected) { this.ejected = true; Sound.boom(30); Shake.add(0.6); w.fx.explode(this.tube.clone().add(V3(0, -2, 0)), 0.8); }
    const fs = w.flagship;
    let camPos, look;
    if (t < 3.6) {
      // Shot 1: under the flagship's belly as the tubes fire
      const k = t / 3.6;
      // low and to the side, looking up the belly so the hull and the falling pods share the frame
      camPos = fs.localToWorld(V3(70 - k * 10, -62 - k * 14, 150 - k * 20));
      look = fs.localToWorld(V3(4, -40 - k * 30, 10 - k * 20));
      camera.fov = 58; camera.updateProjectionMatrix();
      if (Math.random() < dt * 6) Shake.add(0.25);
      if (t > 0.6 && !this.s1) { this.s1 = true; UI.subtitle('The tubes fire in sequence, a thousand hearts at once.', 2.8); }
    } else if (t < 7.4) {
      if (camera.fov !== 50) { camera.fov = 50; camera.updateProjectionMatrix(); }
      // Shot 2: chase camera on your own pod
      const k = (t - 3.6) / 3.8;
      const ang = 0.6 + k * 0.9;
      camPos = pp.clone().add(V3(Math.cos(ang) * 9, 6 - k * 2, Math.sin(ang) * 9));
      look = pp.clone().add(V3(0, -9, 0));
      UI.podTag(pp.clone().add(V3(0, 2.6, 0)), 'DARROW · POD 01');
      if (!this.s2) { this.s2 = true; UI.subtitle(null); }
      Shake.add(0.15 + heat * 0.5);
    } else {
      // Shot 3: the whole Rain between the fleet and Mars
      UI.podTag(null);
      const k = (t - 7.4) / 3.6;
      camPos = V3(1500 - k * 200, -1800 - k * 900, 2600 - k * 300);
      look = V3(-200, -2600 - k * 900, -300);
      if (!this.s3) { this.s3 = true; UI.subtitle('THE IRON RAIN', 3.2, true); Sound.boom(200); }
    }
    camera.position.copy(camPos); camera.lookAt(look);
    Shake.apply(camera, dt, t);
    w.fx.update(dt);
    Sound.set('wind', 0.1 + heat * 0.3, 400 + heat * 1500);
    if (t > 11 || (t > 1 && (Input.pressed('a') || Game.skipReq))) { Game.skipReq = false; Game.toFall(); }
  }
}

// --------------------------------------------------------------- the fall --
class FallPhase {
  constructor(world) {
    this.w = world;
    const s = world.scene;
    this.pod = makePod({ space: true }); s.add(this.pod);
    this.plasma = plasmaShell(); this.pod.add(this.plasma);
    this.trail = new THREE.Mesh(TRAIL_GEO, trailMaterial()); s.add(this.trail);
    // speed lines
    const n = 260, pos = new Float32Array(n * 6);
    this.lines = []; for (let i = 0; i < n; i++) this.lines.push({ x: rand(-70, 70), y: rand(-300, 200), z: rand(-70, 50), l: rand(4, 16) });
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.lineMat = new THREE.LineBasicMaterial({ color: new THREE.Color(0.9, 0.9, 1).multiplyScalar(0.8), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
    this.streaks = new THREE.LineSegments(lg, this.lineMat); this.streaks.frustumCulled = false; s.add(this.streaks);
    // hazards
    this.debrisPool = []; for (let i = 0; i < 14; i++) { const g = new THREE.DodecahedronGeometry(1, 0); const m = new THREE.Mesh(g, MAT.hull); m.visible = false; s.add(m); this.debrisPool.push(m); }
    this.missilePool = [];
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group();
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 3.2, 10), MAT.hull); g.add(b);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1, 10), MAT.armorRed); nose.position.y = 2.1; g.add(nose);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot, color: new THREE.Color(1, 0.6, 0.3).multiplyScalar(8), blending: THREE.AdditiveBlending, depthWrite: false })); glow.position.y = -2; glow.scale.set(3, 3, 1); g.add(glow);
      g.visible = false; s.add(g); this.missilePool.push(g);
    }
    this.markers = [];
    for (let i = 0; i < 16; i++) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.15, 0.08).multiplyScalar(4), transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      ring.rotation.x = -Math.PI / 2; ring.visible = false; s.add(ring); this.markers.push(ring);
    }
    this.cloudPool = []; for (let i = 0; i < 40; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0xe8d2c0, transparent: true, depthWrite: false })); sp.visible = false; s.add(sp); this.cloudPool.push(sp); }
    // the drop zone and the city of Agea on the surface
    const zone = this.zone = new THREE.Group(); world.planet.add(zone);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(14, 0.5, 8, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1, 0.45).multiplyScalar(5) }));
    ring.rotation.x = Math.PI / 2; zone.add(ring);
    const ring2 = ring.clone(); ring2.scale.setScalar(0.35); zone.add(ring2);
    const beam = volumetricCone(10, 400, 0x9dff9a, 0.25); beam.rotation.x = Math.PI; beam.position.y = 0; zone.add(beam); this.beam = beam;
    const facade = (lit) => canvasTex(128, 256, (g, w, h) => {
      g.fillStyle = lit ? '#000' : '#4a403a'; g.fillRect(0, 0, w, h);
      for (let y = 6; y < h - 6; y += 12) for (let x = 6; x < w - 6; x += 10) {
        const on = Math.random() < 0.38;
        g.fillStyle = lit ? (on ? `rgba(255,${150 + Math.random() * 80},${70 + Math.random() * 60},1)` : '#000') : '#1c1816';
        g.fillRect(x, y, 6, 7);
      }
    });
    const city = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x8a7a70, map: facade(false), emissiveMap: facade(true), emissive: 0xffa060, emissiveIntensity: 1.6, roughness: 0.75, metalness: 0.25, envMap: ENV_SPACE, envMapIntensity: 0.4 }), 380);
    const lights = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.65, 0.35).multiplyScalar(2.2) }), 380);
    const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), p = V3(), sc = V3();
    for (let i = 0; i < 380; i++) {
      const a = rand(0, TAU), d = 40 + Math.pow(Math.random(), 0.7) * 520, h = rand(6, 60) * (1 - d / 700) + 4;
      p.set(Math.cos(a) * d, h / 2, Math.sin(a) * d); sc.set(rand(6, 22), h, rand(6, 22)); mm.compose(p, q, sc); city.setMatrixAt(i, mm);
      p.y = h + 0.2; sc.set(sc.x * 0.18, 0.4, sc.z * 0.18); mm.compose(p, q, sc); lights.setMatrixAt(i, mm);
    }
    zone.add(city, lights);
    // close-range terrain around Agea, fading into the planet at its edges, with a crater where you land
    this.groundU = { sunDir: { value: world.sunDir }, crater: { value: new THREE.Vector3(0, 0, -1) }, craterR: { value: 0 } };
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400, 1, 1), new THREE.ShaderMaterial({
      uniforms: this.groundU, transparent: true, depthWrite: false,
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
      fragmentShader: `uniform vec3 sunDir, crater; uniform float craterR; varying vec3 vW;
        ${GLSL_NOISE}
        float H(vec2 p){
          float h = fbm3(vec3(p*0.012, 1.0)) + 0.35*fbm3(vec3(p*0.09, 4.0)) + 0.12*vnoise(vec3(p*0.6, 7.0));
          if (craterR > 0.0) { float dc = length(p - crater.xz); h += exp(-pow((dc - craterR)/(craterR*0.35), 2.0))*0.9 - (1.0 - smoothstep(0.0, craterR, dc))*1.1; }
          return h;
        }
        void main(){
          vec2 p = vW.xz;
          float h = H(p), e = 1.2;
          // slope from sampled neighbours: smooth at every pixel, unlike screen-space derivatives
          vec3 n = normalize(vec3((h - H(p + vec2(e, 0.0))) * 6.0, 1.0, (h - H(p + vec2(0.0, e))) * 6.0));
          float dc = length(p - crater.xz);
          float l = clamp(dot(n, sunDir)*0.8 + 0.35, 0.0, 1.5);
          vec3 soil = mix(vec3(0.09,0.035,0.018), vec3(0.24,0.10,0.05), smoothstep(0.35,0.75,h));
          soil = mix(soil, vec3(0.05,0.03,0.025), smoothstep(0.62,0.8,fbm(vec3(p*0.03, 9.0)))*0.6);
          if (craterR > 0.0) soil *= mix(0.45, 1.0, smoothstep(craterR*0.4, craterR*1.6, dc));
          float edge = 1.0 - smoothstep(700.0, 1200.0, length(vW.xz));
          gl_FragColor = vec4(soil * l * 1.4, edge);
        }`,
    }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = 0.05; ground.renderOrder = -1; zone.add(ground); this.ground = ground;
    this.shock = new THREE.Mesh(new THREE.TorusGeometry(1, 0.35, 8, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.75, 0.5).multiplyScalar(3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.shock.rotation.x = Math.PI / 2; this.shock.visible = false; s.add(this.shock);
    this.darrow = makeSoldier({ cape: true, scale: 1.25 }); this.darrow.visible = false; s.add(this.darrow);
    this.incoming = [];
  }
  enter(fromRetry) {
    const w = this.w; renderPass.scene = w.scene;
    camera.fov = 66; camera.near = 0.5; camera.far = 400000; camera.updateProjectionMatrix();
    bloom.strength = 0.55; bloom.threshold = 1.05; bloom.radius = 0.4; post.vig.value = 0.55; post.aberr.value = 0.006; post.flash.value = 0.8;
    w.layoutRainFall(); w.fx.clear();
    this.t = 0; this.alt = 100; this.hp = 100; this.vel = V3(); this.boostCD = 0; this.boostT = 0; this.inv = 0;
    this.pp = V3(0, 0, 0); this.pod.position.set(0, 0, 0); this.pod.visible = true; this.pod.rotation.set(0, 0, 0);
    this.debris = []; this.missiles = []; this.flak = []; this.clouds = [];
    for (const d of this.debrisPool) d.visible = false; for (const m of this.missilePool) m.visible = false; for (const r of this.markers) r.visible = false; for (const c of this.cloudPool) c.visible = false;
    this.spawn = { debris: 2, flak: 1, missile: 4, cloud: 0, drama: 6 };
    this.hits = 0; this.state = 'fall'; this.endT = 0; this.darrow.visible = false; this.shock.visible = false; this.incoming = [];
    this.trail.visible = true; this.streaks.visible = true; this.shown = false; this.camP = null;
    if (this.inPods) { w.scene.remove(this.inPods, this.inTrails); this.inPods = null; }
    for (const id of ['hp', 'alt', 'phase']) $(id).style.visibility = '';
    this.zone.position.set(rand(-60, 60), PLANET_R + 0.2, rand(-80, -20));
    w.setAlt(100);
    UI.hud(true); Input.setTouch(true, false, true, '', 'Boost'); post.exposure.value = 1; UI.visor(false); UI.count('');
    this.groundU.craterR.value = 0;
    Music.play('fall');
    Sound.loop('wind', { type: 'noise', freq: 600, q: 0.7 }); Sound.loop('plasma', { type: 'noise', freq: 2400, q: 0.4 });
  }
  exit() { UI.hud(false); Sound.set('plasma', 0); Sound.set('wind', 0); }

  heat() { return clamp(1 - Math.abs(this.alt - 62) / 18, 0, 1); }
  update(dt) {
    const w = this.w;
    if (this.state === 'impact' || this.state === 'after') return this.updateAfter(dt);
    if (this.state === 'dead') { this.endT += dt; w.fx.update(dt); this.camFollow(dt); if (this.endT > 2.2 && !this.shown) { this.shown = true; UI.end(false, this.stats()); } return; }
    this.t += dt;
    post.flash.value = Math.max(0, post.flash.value - dt * 1.2);
    const rate = this.alt > 4 ? 1.1 : this.alt > 1.2 ? 0.6 : 0.35;
    this.alt = Math.max(0, this.alt - dt * rate);
    w.setAlt(this.alt);
    w.mars.userData.uniforms.detail.value = 1 + clamp((30 - this.alt) / 30, 0, 1) * 6;
    this.ground.visible = this.alt < 12;
    w.fleet.position.y = (100 - this.alt) * KM * 0.4;
    const heat = this.heat();
    // steering
    const a = Input.axis();
    const tx = a.x * 26, tz = -a.y * 26;
    this.boostCD -= dt; this.inv -= dt;
    if (Input.pressed('b') && this.boostCD <= 0) {
      const m = Math.hypot(a.x, a.y) || 1; this.boostV = V3(a.x / m * 70, 0, -a.y / m * 70); if (!a.x && !a.y) this.boostV.set(0, 0, -70);
      this.boostT = 0.22; this.boostCD = 1.3; this.inv = 0.3; Sound.noise(0.5, { vol: 0.3, freq: 900, sweep: 3, wet: 0.2 }); Shake.add(0.3);
    }
    if (this.boostT > 0) { this.boostT -= dt; this.vel.copy(this.boostV); }
    else { this.vel.x = damp(this.vel.x, tx, 4, dt); this.vel.z = damp(this.vel.z, tz, 4, dt); }
    this.pp.x = clamp(this.pp.x + this.vel.x * dt, -55, 55); this.pp.z = clamp(this.pp.z + this.vel.z * dt, -70, 25);
    this.pod.position.copy(this.pp);
    this.pod.rotation.z = damp(this.pod.rotation.z, -this.vel.x * 0.012, 6, dt);
    this.pod.rotation.x = damp(this.pod.rotation.x, this.vel.z * 0.012, 6, dt);
    this.pod.rotation.y += dt * 0.6;
    // re-entry glow and trail
    this.plasma.userData.u.heat.value = heat; this.plasma.userData.u.time.value = this.t;
    this.trail.position.copy(this.pp).y += 1.6; this.trail.scale.set(1.3, 6 + heat * 16, 1.3);
    this.trail.material.uniforms.tint.value.setRGB(lerp(0.06, 1.1, heat), lerp(0.08, 0.35, heat), lerp(0.18, 0.06, heat));
    this.trail.material.uniforms.time.value = this.t;
    if (heat > 0.2) Shake.add(heat * 0.35);
    // speed lines
    const sp = 260 + heat * 120 + (this.alt < 30 ? 100 : 0);
    const pos = this.streaks.geometry.attributes.position.array;
    this.lines.forEach((l, i) => {
      l.y += sp * dt; if (l.y > 220) { l.y = -300; l.x = this.pp.x + rand(-70, 70); l.z = this.pp.z + rand(-70, 50); }
      const len = l.l * (sp / 200);
      pos.set([l.x, l.y, l.z, l.x, l.y - len, l.z], i * 6);
    });
    this.streaks.geometry.attributes.position.needsUpdate = true;
    this.lineMat.color.setRGB(lerp(0.7, 2.4, heat), lerp(0.75, 1.0, heat), lerp(0.9, 0.4, heat));
    w.updateRainFall(dt, heat, this.vel);
    this.updateHazards(dt, sp);
    this.updateClouds(dt, sp);
    this.drama(dt);
    w.fx.update(dt, V3(0, sp * 0.15, 0));
    this.camFollow(dt);
    this.updateHUD(heat, sp);
    Sound.set('wind', 0.15 + clamp((60 - this.alt) / 60, 0, 1) * 0.25, 300 + (this.alt < 60 ? 900 : 0) + heat * 800);
    Sound.set('plasma', heat * 0.35, 1800 + heat * 2000);
    if (this.alt <= 0) this.impact();
  }
  camFollow(dt) {
    const p = this.pp, landing = clamp((6 - this.alt) / 6, 0, 1);
    const want = V3(p.x * 0.75, p.y + lerp(11, 7, landing), p.z + lerp(11, 15, landing));
    if (!this.camP) this.camP = want.clone();
    this.camP.x = damp(this.camP.x, want.x, 5, dt); this.camP.y = damp(this.camP.y, want.y, 5, dt); this.camP.z = damp(this.camP.z, want.z, 5, dt);
    camera.position.copy(this.camP);
    camera.lookAt(p.x, p.y - lerp(14, 6, landing), p.z - lerp(9, 6, landing));
    const fovWant = this.boostT > 0 ? 80 : 66 + this.heat() * 6;
    camera.fov = damp(camera.fov, fovWant, 6, dt); camera.updateProjectionMatrix();
    Shake.apply(camera, dt, this.t + this.endT);
  }

  marker(x, z, r, k) {
    const m = this.markers.find((mm) => !mm.visible); if (!m) return null;
    m.visible = true; m.position.set(x, 0, z); m.scale.setScalar(r); m.material.opacity = k; return m;
  }
  updateHazards(dt, sp) {
    const S = this.spawn, alt = this.alt, p = this.pp;
    for (const k in S) S[k] -= dt;
    for (const m of this.markers) m.visible = false;
    const aim = () => (Math.random() < 0.65 ? [p.x + this.vel.x * 1.2 + rand(-8, 8), p.z + this.vel.z * 1.2 + rand(-8, 8)] : [rand(-55, 55), rand(-70, 25)]);
    // debris from the space battle above the atmosphere
    if (alt > 50 && S.debris <= 0) {
      S.debris = alt > 78 ? 1.0 : 2.4;
      const m = this.debrisPool.find((d) => !d.visible);
      if (m) { const [x, z] = aim(); const r = rand(1.2, 3.2); m.visible = true; m.scale.set(r * rand(0.6, 1.4), r, r * rand(0.6, 1.4)); m.position.set(x, -460, z); this.debris.push({ m, r, vy: sp * 0.9 + rand(40, 120), spin: V3(rand(-2, 2), rand(-2, 2), rand(-2, 2)) }); }
    }
    for (const d of this.debris) {
      d.m.position.y += d.vy * dt; d.m.rotation.x += d.spin.x * dt; d.m.rotation.y += d.spin.y * dt;
      const y = d.m.position.y;
      if (y < 0 && y > -400) this.marker(d.m.position.x, d.m.position.z, d.r + 1.5, clamp(1 + y / 400, 0.15, 1));
      if (!d.hit && y > -2 && y < 3 && Math.hypot(d.m.position.x - p.x, d.m.position.z - p.z) < d.r + 1.4) { d.hit = true; this.damage(14, d.m.position.clone()); }
      if (y > 300) { d.m.visible = false; d.dead = true; }
    }
    this.debris = this.debris.filter((d) => !d.dead);
    // flak bursts at your altitude
    if (alt < 48 && alt > 1 && S.flak <= 0) {
      S.flak = alt > 30 ? 1.05 : alt > 8 ? 0.72 : 1.2;
      const [x, z] = aim(); this.flak.push({ x, z, t: 0, fuse: alt > 20 ? 1.15 : 0.95, r: 7.5 });
      Sound.tone(900, 0.06, { type: 'square', vol: 0.02, wet: 0 });
    }
    for (const f of this.flak) {
      f.t += dt;
      if (f.t < f.fuse) {
        const k = f.t / f.fuse;
        this.marker(f.x, f.z, f.r * k, 0.4 + 0.6 * k);
        this.marker(f.x, f.z, f.r, 0.25 + 0.25 * Math.sin(f.t * 30));
      } else if (!f.done) {
        f.done = true; const at = V3(f.x, 0, f.z);
        this.w.fx.explode(at, 2.2, V3(0, sp * 0.1, 0));
        const d = Math.hypot(f.x - p.x, f.z - p.z);
        Sound.boom(d * 4); Shake.add(clamp(1.2 - d / 40, 0.1, 1));
        if (d < f.r) this.damage(20, at);
        this.killAllies(f.x, f.z, f.r);
      }
    }
    this.flak = this.flak.filter((f) => !f.done);
    // missiles climbing from the batteries below
    if (alt < 40 && alt > 3 && S.missile <= 0) {
      S.missile = alt > 20 ? 4.2 : 3.0;
      const g = this.missilePool.find((m) => !m.visible);
      if (g) { g.visible = true; g.position.set(p.x + rand(-40, 40), -520, p.z + rand(-40, 20)); this.missiles.push({ g, vy: 170 }); UI.warn('MISSILE LOCK', 1.6); Sound.beep(2000, 4, 0.08); }
    }
    for (const m of this.missiles) {
      const g = m.g; g.position.y += m.vy * dt;
      if (g.position.y < -10) { const dx = p.x - g.position.x, dz = p.z - g.position.z, d = Math.hypot(dx, dz) || 1; g.position.x += dx / d * Math.min(d, 15 * dt); g.position.z += dz / d * Math.min(d, 15 * dt); }
      if (Math.random() < 0.7) this.w.fx.spawn({ pos: g.position.clone().add(V3(0, -2.2, 0)), vel: V3(rand(-1, 1), -10, rand(-1, 1)), tex: smokeTex, color: 0xb8b0a8, life: 1.4, size: 1.2, grow: 5, alpha: 0.5 });
      if (g.position.y < 0) this.marker(g.position.x, g.position.z, 4.5, clamp(1 + g.position.y / 520, 0.2, 1));
      if (!m.done && g.position.y > -1) {
        const d = Math.hypot(g.position.x - p.x, g.position.z - p.z);
        if (d < 4.8) { m.done = true; g.visible = false; this.w.fx.explode(g.position.clone(), 2); Sound.boom(0); this.damage(24, g.position.clone()); }
      }
      if (g.position.y > 60 && !m.done) { m.done = true; g.visible = false; this.w.fx.explode(g.position.clone(), 1.6); Sound.boom(120); }
    }
    this.missiles = this.missiles.filter((m) => !m.done);
  }
  updateClouds(dt, sp) {
    const alt = this.alt;
    if (alt < 36 && alt > 12 && this.spawn.cloud <= 0) {
      this.spawn.cloud = alt > 30 || alt < 16 ? 0.35 : 0.12;
      const c = this.cloudPool.find((x) => !x.visible);
      if (c) { c.visible = true; c.position.set(this.pp.x + rand(-160, 160), -650, this.pp.z + rand(-200, 80)); const s = rand(70, 220); c.scale.set(s, s * 0.6, 1); c.material.opacity = 0; c.material.rotation = rand(0, TAU); this.clouds.push({ c, op: rand(0.35, 0.75) }); }
    }
    for (const cl of this.clouds) {
      cl.c.position.y += sp * 0.8 * dt;
      const y = cl.c.position.y;
      cl.c.material.opacity = cl.op * clamp((y + 650) / 200, 0, 1) * clamp((120 - y) / 80, 0, 1);
      if (y > 140) { cl.c.visible = false; cl.dead = true; }
    }
    this.clouds = this.clouds.filter((c) => !c.dead);
  }
  killAllies(x, z, r) {
    for (const a of this.w.rain) if (a.near && a.alive && Math.abs(a.y) < 6 && Math.hypot(a.x - x, a.z - z) < r) { a.alive = false; this.w.fx.explode(V3(a.x, a.y, a.z), 1.4); }
  }
  drama(dt) {
    if (this.spawn.drama > 0 || this.alt > 50) return;
    this.spawn.drama = rand(3, 7);
    const far = this.w.rain.filter((r) => !r.near && r.alive && Math.abs(r.y) < 300);
    const r = far[Math.floor(Math.random() * far.length)];
    if (r) { r.alive = false; this.w.fx.explode(V3(r.x, r.y, r.z), 6); Sound.boom(Math.hypot(r.x, r.y, r.z) * 0.6); }
  }
  damage(n, at) {
    if (this.inv > 0 || this.state !== 'fall') return;
    this.hp -= n; this.hits++; this.inv = 0.5; Shake.add(1); post.flash.value = 0.25;
    Sound.noise(0.4, { vol: 0.5, freq: 2500, type: 'bandpass', q: 1.5, wet: 0.2 }); Sound.tone(110, 0.4, { type: 'square', vol: 0.12, slide: 0.5 });
    UI.warn(this.hp < 35 ? 'SHELL CRITICAL' : 'HULL BREACH', 1.2);
    if (this.hp <= 0) {
      this.hp = 0; this.state = 'dead'; this.endT = 0; this.shown = false;
      this.w.fx.explode(this.pp.clone(), 4); Sound.boom(0); this.pod.visible = false; this.trail.visible = false;
    }
  }
  stats() {
    const allies = this.w.rain.filter((r) => r.near && r.alive).length;
    const zoneW = this.zone.getWorldPosition(V3());
    const miss = Math.round(Math.hypot(zoneW.x - this.pp.x, zoneW.z - this.pp.z) * 16.7);
    return { hp: Math.round(this.hp), allies, miss, alt: this.alt };
  }
  updateHUD(heat, sp) {
    const alt = this.alt;
    const phase = alt > 72 ? 'HIGH ORBIT · DEBRIS FIELD' : alt > 48 ? 'RE-ENTRY' : alt > 12 ? 'FLAK BELT' : alt > 3 ? 'BELOW THE CLOUDS · AGEA' : 'BRACE FOR IMPACT';
    const ms = Math.round(alt > 4 ? 2400 - (100 - alt) * 14 : 300 * alt / 4 + 60);
    let tgt = null;
    if (alt < 24) { const zw = this.zone.getWorldPosition(V3()); const v = zw.clone().project(camera); if (v.z < 1) tgt = { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, d: Math.round(Math.hypot(zw.x - this.pp.x, zw.z - this.pp.z) * 16.7) }; }
    UI.hudUpdate({ hp: this.hp, boost: 1 - clamp(this.boostCD / 1.3, 0, 1), alt, ms, phase, tgt });
  }

  // ----------------------------------------------------------- landing --
  impact() {
    this.state = 'impact'; this.endT = 0; this.alt = 0;
    // put the ground at y = 0 for the aftermath
    this.w.setAlt(-2.05 / KM);
    const p = this.pp.clone(); p.y = 0.5;
    Sound.boom(0); Sound.noise(3, { vol: 0.8, freq: 200, wet: 0.8 }); Shake.add(1.6); post.flash.value = 1;
    for (let i = 0; i < 22; i++) this.w.fx.spawn({ pos: p.clone().add(V3(rand(-3, 3), rand(0, 2), rand(-3, 3))), vel: V3(rand(-1, 1), rand(0.1, 0.5), rand(-1, 1)).multiplyScalar(rand(25, 50)), tex: smokeTex, color: 0x8a5a3a, life: rand(1.8, 2.8), size: 3, grow: rand(10, 18), alpha: 0.55, drag: 1.6 });
    this.w.fx.explode(p, 2.5);
    this.shock.visible = true; this.shock.position.copy(p).y = 0.2; this.shock.scale.setScalar(1);
    this.plasma.userData.u.heat.value = 0; this.trail.visible = false; this.streaks.visible = false;
    for (const m of this.markers) m.visible = false;
    for (const c of this.clouds) c.c.visible = false;
    this.pod.rotation.set(0.12, this.pod.rotation.y, -0.08); this.pod.position.y = 1.4;
    // the rest of the Rain comes down around you
    for (let i = 0; i < 26; i++) { const a = rand(0, TAU), d = rand(60, 520); this.incoming.push({ x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d, y: rand(300, 2400), hit: false }); }
    UI.hud(false); Music.play('end');
    this.landedStats = this.stats();
    this.groundU.crater.value.set(p.x, 0, p.z); this.groundU.craterR.value = 7; this.ground.visible = true;
  }
  updateAfter(dt) {
    const t = (this.endT += dt), p = this.pp, w = this.w;
    const slow = t < 1.2 ? 0.3 : 1;
    w.fx.update(dt * slow);
    post.flash.value = Math.max(0, post.flash.value - dt * 1.5);
    this.shock.scale.setScalar(1 + t * 70); this.shock.material.opacity = Math.max(0, 1 - t / 1.4);
    // incoming pods: fire trails and impacts all around
    if (!this.inPods) {
      this.inPods = new THREE.InstancedMesh(POD_GEO, MAT.podSpace, this.incoming.length);
      this.inTrails = new THREE.InstancedMesh(TRAIL_GEO, trailMaterial(), this.incoming.length);
      this.inTrails.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.incoming.length * 3).fill(2), 3);
      this.inPods.frustumCulled = this.inTrails.frustumCulled = false; w.scene.add(this.inPods, this.inTrails);
    }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = V3(), sc = V3();
    this.incoming.forEach((r, i) => {
      if (!r.hit) { r.y -= 420 * dt * slow; if (r.y <= 0) { r.hit = true; w.fx.explode(V3(r.x, 0, r.z), 3.5); for (let k = 0; k < 5; k++) w.fx.spawn({ pos: V3(r.x, 1, r.z), vel: V3(rand(-1, 1), rand(0.3, 1), rand(-1, 1)).multiplyScalar(30), tex: smokeTex, color: 0x8a5a3a, life: 2.6, size: 5, grow: 24, alpha: 0.6 }); Sound.boom(Math.hypot(r.x - p.x, r.z - p.z)); } }
      const y = Math.max(r.y, 0.4);
      pos.set(r.x, y, r.z); sc.setScalar(1.4); m.compose(pos, q, sc); this.inPods.setMatrixAt(i, m);
      pos.y += 2; sc.set(r.hit ? 0 : 2, r.hit ? 0 : 140, r.hit ? 0 : 2); m.compose(pos, q, sc); this.inTrails.setMatrixAt(i, m);
      this.inTrails.setColorAt(i, new THREE.Color(3, 1.1, 0.3));
    });
    this.inPods.instanceMatrix.needsUpdate = this.inTrails.instanceMatrix.needsUpdate = true; this.inTrails.instanceColor.needsUpdate = true;
    // Darrow climbs out
    if (t > 2.4 && !this.darrow.visible) {
      this.darrow.visible = true; this.darrow.position.set(p.x + 2.6, 0, p.z + 1.4); this.darrow.rotation.y = 0.5;
      w.fx.explode(V3(p.x + 1, 1, p.z + 0.6), 0.6); Sound.clank();
    }
    if (this.darrow.visible) {
      const u = this.darrow.userData, k = smooth((t - 2.4) / 1.6);
      this.darrow.position.y = lerp(-0.8, 0, k);
      u.body.rotation.x = lerp(0.6, 0, k);
      u.armR.rotation.x = lerp(0, -2.6, smooth((t - 4.2) / 0.8)); u.armR.rotation.z = lerp(0, 0.3, smooth((t - 4.2) / 0.8));
    }
    // orbit the crater
    const ang = 0.9 + t * 0.12, rad = lerp(9, 18, smooth(t / 5));
    camera.position.set(p.x + Math.cos(ang) * rad, lerp(4, 6.5, smooth(t / 5)), p.z + Math.sin(ang) * rad);
    camera.lookAt(p.x + 1.2, 1.8, p.z + 0.6);
    camera.fov = damp(camera.fov, 55, 3, dt); camera.updateProjectionMatrix();
    Shake.apply(camera, dt, t);
    if (t > 7.5 && !this.shown) { this.shown = true; UI.end(true, this.landedStats); }
  }
}
