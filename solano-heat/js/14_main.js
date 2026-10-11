// ---------- Game: loop, camera, events, state ----------
const Game = {
  state: 'boot', time: 0, hour: 17.3, money: 500, nightK: 0,
  camX: 0, camZ: 0, camFX: 0, camFZ: 1, camYaw: Math.PI, camPitch: 0.28, carYaw: 0, lookOffYaw: 0, lookOffPitch: 0, freeLookT: 9, camZoom: 1, shake: 0, fov: 62,
  _pp: { x: 0, z: 0 }, _pv: { x: 0, z: 0 }, _walkers: [], hitCD: 0, hornCD: 0, saveT: 0, suppressPauseOnUnlock: false,
  manual: false, forceRender: 0,
  playerVehicle() { return Player.car; },
  playerPos() { this._pp.x = Player.x; this._pp.z = Player.z; return this._pp; },
  playerVel() { this._pv.x = Player.car ? Player.car.vx : Player.vx; this._pv.z = Player.car ? Player.car.vz : Player.vz; return this._pv; },
  walkers() { return this._walkers; },
  init(hot) {
    this.touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (this.touch && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
    Store.load(hot);
    const renderer = new THREE.WebGLRenderer({ antialias: !this.touch, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.touch ? 1.25 : 1.6));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    $('game').appendChild(renderer.domElement);
    this.renderer = renderer;
    const scene = new THREE.Scene(); this.scene = scene;
    const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 2400); this.camera = camera;
    buildTextures();
    buildWorld(scene);
    initVehicleMaterials();
    Sky.init(scene);
    FX.init(scene);
    Player.init(World.poi.spawn.x, World.poi.spawn.z, World.poi.spawn.h);
    Missions.idx = Store.data.mission;
    this.money = Store.data.money;
    Missions.init(scene);
    Hud.init();
    Input.init(renderer.domElement);
    const sh = Store.data.shadows != null ? Store.data.shadows : !this.touch;
    this.setShadows(sh);
    if (Store.data.music != null) Audio2.musicVol = Store.data.music;
    $('optMusic').value = Math.round(Audio2.musicVol * 100);
    if (this.touch) { Traffic.target = 15; Traffic.parkedTarget = 9; PedManager.target = 20; }
    this.onResize();
    window.addEventListener('resize', () => this.onResize());
    // Populate the city around the start point
    this.titleCam(0);
    this.prefill();
    this.bindUI();
    this.state = 'title';
    this.showTitle();
    this.last = performance.now();
    requestAnimationFrame(t => this.frame(t));
  },
  prefill() {
    const px = Player.x, pz = Player.z;
    for (let i = 0; i < Traffic.target * 3 && VEHICLES.filter(v => v.ai).length < Traffic.target; i++) {
      const s = World.segs[(Math.random() * World.segs.length) | 0];
      const fwd = Math.random() < 0.5;
      const A = fwd ? { a: s.ax / SP, b: s.az / SP } : { a: s.bx / SP, b: s.bz / SP }, B = fwd ? { a: s.bx / SP, b: s.bz / SP } : { a: s.ax / SP, b: s.az / SP };
      const dx = Math.sign(B.a - A.a), dz = Math.sign(B.b - A.b), t = rnd(HALF_ROAD + 10, SP - STOP_DIST - 8);
      const x = A.a * SP + dx * t - dz * LANE, z = A.b * SP + dz * t + dx * LANE;
      const d = Math.hypot(x - px, z - pz);
      if (d < 30 || d > 210 || VEHICLES.some(v => dist2(v.x, v.z, x, z) < 14 * 14)) continue;
      const v = new Vehicle(Math.random() < 0.06 ? 'police' : pick(TRAFFIC_MIX), x, z, Math.atan2(dx, dz));
      v.driver = v.police ? 'police' : 'ai'; v.ai = new DriverAI(v, 'traffic'); if (v.police) { v.ai.cruise = 12; }
      const sp = v.ai.cruise * 0.6; v.vx = dx * sp; v.vz = dz * sp;
    }
    for (let i = 0; i < 60; i++) {
      const slot = World.parkSlots[(Math.random() * World.parkSlots.length) | 0];
      if (slot.used || Math.hypot(slot.x - px, slot.z - pz) > 170 || VEHICLES.some(v => dist2(v.x, v.z, slot.x, slot.z) < 36)) continue;
      const v = new Vehicle(pick(['brisa', 'marlin', 'gator', 'pelican', 'tarpon', 'brisa']), slot.x, slot.z, slot.h); v.slot = slot; slot.used = true; v.parked = true;
      if (VEHICLES.filter(q => q.parked).length >= Traffic.parkedTarget) break;
    }
    for (let i = 0; i < 200 && PEDS.length < PedManager.target; i++) {
      const bi = clamp(Math.floor(px / SP) + rndi(-2, 2), 0, NB - 1), bj = clamp(Math.floor(pz / SP) + rndi(-2, 2), 0, NB - 1);
      const blk = World.blocks[bj * NB + bi], k = rndi(0, 3), tt = Math.random();
      const a = ringCorner(blk, k), b = ringCorner(blk, (k + 1) % 4);
      const x = lerp(a.x, b.x, tt), z = lerp(a.z, b.z, tt);
      if (Math.hypot(x - px, z - pz) < 6) continue;
      const p = new Ped(x, z, { blk, k: (k + 1) % 4 }); p.dir = 1;
    }
  },
  setShadows(on) { Sky.sun.castShadow = on; $('optShadows').checked = on; Store.data.shadows = on; },
  onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    FX.setScale(this.renderer.getDrawingBufferSize(new THREE.Vector2()).y);
    Hud.resize(); if (this.state === 'map') Hud.resizeBigMap();
  },
  bindUI() {
    const click = (id, fn) => $(id).addEventListener('click', fn);
    click('btnPlay', () => this.start(false));
    click('btnNew', () => { $('confirmNew').hidden = false; });
    click('btnNewYes', () => { this.resetProgress(); $('confirmNew').hidden = true; this.start(true); });
    click('btnNewNo', () => { $('confirmNew').hidden = true; });
    click('btnControls', () => { $('controlsPanel').hidden = !$('controlsPanel').hidden; });
    click('btnResume', () => this.resume());
    click('btnPauseControls', () => { $('pauseControls').hidden = !$('pauseControls').hidden; });
    click('btnQuit', () => this.quitToTitle());
    click('btnReset', () => { $('confirmReset').hidden = false; });
    click('btnResetYes', () => { this.resetProgress(); $('confirmReset').hidden = true; Hud.toast('Progress erased'); this.resume(); });
    click('btnResetNo', () => { $('confirmReset').hidden = true; });
    click('btnMapClose', () => this.closeMap());
    $('optShadows').addEventListener('change', e => { this.setShadows(e.target.checked); Store.save(); });
    $('optMusic').addEventListener('input', e => { Audio2.musicVol = e.target.value / 100; Store.data.music = Audio2.musicVol; Store.save(); });
  },
  resetProgress() {
    Store.reset(); this.money = 500; Missions.idx = 0;
    if (Missions.active) Missions.cleanup(false);
    for (const t of Missions.tapes) { t.got = false; t.g.visible = true; }
  },
  showTitle() {
    $('title').hidden = false; $('hud').classList.add('hidden');
    const hasSave = Store.data.mission > 0 || Store.data.tapes.length > 0 || Store.data.money !== 500;
    $('btnPlay').textContent = hasSave ? 'Continue' : 'Play';
    $('btnNew').hidden = !hasSave;
    $('saveLine').textContent = hasSave ? `${fmtMoney(Store.data.money)} · ${Store.data.mission} of ${MISSIONS.length} jobs done · ${Store.data.tapes.length} of 10 tapes` : '';
  },
  start(fresh) {
    Audio2.init();
    $('title').hidden = true; $('hud').classList.remove('hidden');
    this.state = 'play';
    const b = World.poi.spawn;
    if (fresh || !this.started) { Player.place(b.x, b.z, b.h); this.camYaw = b.h; this.camPitch = 0.25; }
    this.started = true;
    this.requestLock();
    if (Missions.available()) setTimeout(() => { if (Missions.available()) Hud.phone('Dolores', 'You made it. Come see me at the bodega, I have work for you. Look for the D.'); }, 1500);
    Hud.subtitle(this.touch ? 'Left thumb moves, right thumb looks. Tap Car to get in.' : 'WASD to move, mouse to look, F to get in a car. Esc pauses.', 6);
  },
  requestLock() {
    if (this.touch || Input.lockFailed) return;
    const c = this.renderer.domElement;
    try { const r = c.requestPointerLock && c.requestPointerLock(); if (r && r.catch) r.catch(() => { Input.lockFailed = true; }); } catch (e) { Input.lockFailed = true; }
  },
  pause() {
    if (this.state !== 'play') return;
    this.state = 'pause'; $('pause').hidden = false; Input.release();
  },
  resume() {
    $('pause').hidden = true; $('confirmReset').hidden = true; this.state = 'play'; this.requestLock(); this.last = performance.now();
  },
  openMap() { if (this.state !== 'play') return; this.state = 'map'; Input.release(); Hud.openMap(); $('mapHint').textContent = 'Click the map to set a waypoint. M closes.'; },
  closeMap() { Hud.closeMap(); this.state = 'play'; this.requestLock(); },
  quitToTitle() {
    $('pause').hidden = true;
    if (Missions.active) Missions.cleanup(false);
    if (Player.car) Player.exitVehicle();
    Police.setWanted(0);
    Store.save();
    this.state = 'title'; this.showTitle();
  },
  addMoney(n) { this.money = Math.max(0, this.money + n); Store.save(); },
  // ---------- Events ----------
  onEnterVehicle(v) {
    document.body.classList.add('in-car');
    this.carYaw = this.camYaw; this.lookOffYaw = 0; this.lookOffPitch = 0;
    const st = Radio.stations[Radio.idx]; Hud.radio(st.name, st.tag);
  },
  onExitVehicle() { document.body.classList.remove('in-car'); this.camYaw = this.carYaw + this.lookOffYaw; },
  onVehicleHit(v, other, imp, kind, x, z) {
    const pv = Player.car;
    const mul = kind === 'car' ? 1.9 * clamp(other.mass / v.mass, 0.5, 2) : kind === 'prop' ? 0.6 : 2.3;
    v.damage((imp - 3) * mul * (v === pv ? 0.75 : 1));
    const primary = !other || v.id < other.id;
    if (primary && imp > 4.5 && dist2(x, z, this.camX, this.camZ) < 120 * 120) FX.sparks(x, v.y + 0.6, z, imp > 12 ? 16 : 7);
    if (primary) Audio2.crash(imp, x, z);
    if ((v === pv || other === pv) && primary) this.shake = Math.min(1, this.shake + imp * 0.03);
    if (v === pv && other && this.hitCD <= 0) {
      if (other.police && (other.driver || other.officer) && imp > 3.5) { this.hitCD = 1.2; Police.crime('hitPoliceCar', x, z); }
      else if (other.driver && imp > 6) { this.hitCD = 2; Police.crime('ramCar', x, z); }
    }
    if (imp > 9) PedManager.scare(x, z, 20);
  },
  onPedHit(v, ped, sp) {
    Audio2.thud(0.6, ped.x, ped.z);
    if (v === Player.car) { Police.crime(ped.cop ? 'hitCop' : 'hitPed', ped.x, ped.z); PedManager.scare(ped.x, ped.z, 22); }
  },
  playerKnocked(vx, vz, up, dmg) { Player.knock(vx, vz, up, dmg); },
  explodeVehicle(v) {
    if (v.wrecked) return;
    v.wrecked = true; v.burning = false; v.health = 0; v.wreckT = 0; v.siren = false;
    v.paintMesh.material = VMAT.burnt;
    v.vy = 5; v.air = true; v.av += rnd(-1, 1);
    FX.explosion(v.x, v.y, v.z);
    Audio2.explosion(v.x, v.z);
    this.shake = Math.min(1.5, this.shake + clamp(1 - Math.hypot(v.x - this.camX, v.z - this.camZ) / 80, 0, 1) * 1.2);
    PedManager.scare(v.x, v.z, 40);
    if (Player.car === v) { Player.exitVehicle(); Player.knock(rnd(-4, 4), rnd(-4, 4), 6, 200); }
    else if (!Player.car) {
      const d = Math.hypot(Player.x - v.x, Player.z - v.z);
      if (d < 9) { const k = 1 - d / 9; Player.knock((Player.x - v.x) / (d || 1) * 8 * k, (Player.z - v.z) / (d || 1) * 8 * k, 4 * k + 1, 90 * k); }
    }
    for (const p of PEDS) { const d = Math.hypot(p.x - v.x, p.z - v.z); if (d < 9) { const k = 1 - d / 9; p.knock((p.x - v.x) / (d || 1) * 9 * k, (p.z - v.z) / (d || 1) * 9 * k, 4 * k + 1, 120 * k); } }
    for (const o of VEHICLES) {
      if (o === v) continue;
      const dx = o.x - v.x, dz = o.z - v.z, d = Math.hypot(dx, dz);
      if (d < 10) { const k = 1 - d / 10; o.vx += dx / (d || 1) * 9 * k / o.mass; o.vz += dz / (d || 1) * 9 * k / o.mass; o.damage(55 * k); }
    }
    if (v.lastDriverPlayer || dist2(v.x, v.z, Player.x, Player.z) < 30 * 30) Police.crime('explosion', v.x, v.z);
  },
  arrest() {
    if (this.state !== 'play') return;
    const fee = Math.min(this.money, Math.round(100 + this.money * 0.1));
    this.endLife('ARRESTED', `Bail ${fmtMoney(fee)}`, fee, World.poi.police);
  },
  hospitalize() {
    if (this.state !== 'play') return;
    const fee = Math.min(this.money, Math.round(100 + this.money * 0.08));
    this.endLife('HOSPITALIZED', `Hospital bill ${fmtMoney(fee)}`, fee, World.poi.hospital);
  },
  endLife(title, sub, fee, spot) {
    this.state = 'down';
    Missions.fail(title === 'ARRESTED' ? 'You were arrested' : 'You ended up in hospital');
    setTimeout(() => Hud.big(title, sub, 'fail'), 250);
    Audio2.missionFail();
    setTimeout(() => {
      Hud.fade(() => {
        if (Player.car) { const c = Player.car; Player.car = null; c.driver = null; c.input.acc = 0; document.body.classList.remove('in-car'); }
        Police.setWanted(0);
        this.addMoney(-fee);
        Player.health = 100; Player.place(spot.x, spot.z, spot.h);
        this.camYaw = spot.h; this.camPitch = 0.25;
        for (let i = VEHICLES.length - 1; i >= 0; i--) { const v = VEHICLES[i]; if (v.police && !v.mission && dist2(v.x, v.z, spot.x, spot.z) > 30 * 30) v.dispose(); }
        for (let i = PEDS.length - 1; i >= 0; i--) if (PEDS[i].cop) PEDS[i].dispose();
        if (Police.heli) { Police.heli.leaving = true; }
        this.state = 'play';
      });
    }, 3200);
  },
  // ---------- Simulation ----------
  step(dt, ctl) {
    this.time += dt;
    lightClock += dt;
    this.hour = (this.hour + dt / 30) % 24;
    this.hitCD -= dt; this.hornCD -= dt;
    const W = this._walkers; W.length = 0;
    for (const p of PEDS) W.push(p);
    if (!Player.car) W.push(Player);
    if (this.state === 'play') {
      Player.update(dt, ctl, this.camYaw);
      if (Player.car) Player.car.lastDriverPlayer = true;
      if (ctl.horn && Player.car && this.hornCD <= 0) { this.hornCD = 0.45; Audio2.horn(Player.x, Player.z); PedManager.scare(Player.x, Player.z, 8); }
    } else if (Player.car) { Player.car.input.acc = 0; Player.car.input.hb = true; }
    else if (this.state === 'down' && Player.state === 'down') Player.update(dt, { moveX: 0, moveY: 0 }, this.camYaw);
    this.sirenT = (this.sirenT || 0) - dt;
    if (this.sirenT <= 0) { this.sirenT = 0.5; Traffic.yieldToSirens(); }
    for (const v of VEHICLES) {
      if (v === Player.car) continue;
      if (v.ai && v.driver) v.ai.update(dt);
      else { v.input.acc = 0; v.input.steer = 0; if (v.speed < 3) v.input.hb = true; }
    }
    for (let i = VEHICLES.length - 1; i >= 0; i--) { const v = VEHICLES[i]; if (v) v.step(dt); }
    for (const v of VEHICLES) v.collideStatic();
    for (let i = 0; i < VEHICLES.length; i++) for (let j = i + 1; j < VEHICLES.length; j++) collideVehiclePair(VEHICLES[i], VEHICLES[j]);
    for (const v of VEHICLES) {
      if (v.speed < 0.3) continue;
      for (const p of PEDS) collideVehicleWalker(v, p, false);
      if (!Player.car && this.state === 'play') collideVehicleWalker(v, Player, true);
    }
    const px = Player.x, pz = Player.z;
    PedManager.update(dt, px, pz);
    if (this.state === 'play') { Police.update(dt); Missions.update(dt); }
    Traffic.update(dt, px, pz);
    // Vehicle effects
    for (const v of VEHICLES) {
      if (v.wrecked) { v.wreckT = (v.wreckT || 0) + dt; if (v.wreckT < 20 && Math.random() < 0.3) FX.smoke(v.x, v.y + 1, v.z, 1.3); continue; }
      const near = dist2(v.x, v.z, this.camX, this.camZ) < 150 * 150;
      if (!near) continue;
      const fx = Math.sin(v.h), fz = Math.cos(v.h);
      if (v.burning) { if (Math.random() < 0.8) FX.fire(v.x + fx * v.t.L * 0.3, v.y + 1, v.z + fz * v.t.L * 0.3, 1.2); if (Math.random() < 0.4) FX.smoke(v.x, v.y + 1.4, v.z, 1.2); }
      else if (v.health < 35 && Math.random() < (35 - v.health) / 50) FX.smoke(v.x + fx * v.t.L * 0.38, v.y + 1.0, v.z + fz * v.t.L * 0.38, 0.8);
      if (!v.air && v.slip > 4.5 && v.speed > 5 && Math.random() < 0.6) {
        const col = v.surf === 'sand' ? [0.85, 0.76, 0.55] : v.surf === 'grass' ? [0.5, 0.45, 0.3] : [0.85, 0.85, 0.86];
        FX.dust(v.x - fx * v.t.wb / 2, v.y + 0.3, v.z - fz * v.t.wb / 2, col);
      }
      if (!v.air && (v.surf === 'sand' || v.surf === 'grass') && v.speed > 9 && Math.random() < 0.4) FX.dust(v.x - fx * v.t.wb / 2, v.y + 0.3, v.z - fz * v.t.wb / 2, v.surf === 'sand' ? [0.85, 0.76, 0.55] : [0.5, 0.45, 0.3]);
    }
    this.saveT += dt; if (this.saveT > 20) { this.saveT = 0; Store.save(); }
  },
  frame(now) {
    requestAnimationFrame(t => this.frame(t));
    let dt = (now - this.last) / 1000; this.last = now;
    if (!(dt > 0)) dt = 0;
    if (dt > 0.1) dt = 0.1;
    const ctl = Input.frame();
    Input.lookIdle += dt;
    // Edge-triggered presses wait until a physics step consumes them (frames can run without a step)
    const P = this.pend || (this.pend = this.clearEdges(ctl));
    const edges = { jumpPressed: P.jumpPressed || ctl.jumpPressed, enterPressed: P.enterPressed || ctl.enterPressed, attackPressed: P.attackPressed || ctl.attackPressed };
    this.pend = Object.assign({}, ctl, edges, { radioPressed: false, mapPressed: false, pausePressed: false, camPressed: false, lookX: 0, lookY: 0 });
    // UI keys
    if (this.state === 'play') {
      if (ctl.pausePressed) { this.pause(); }
      else if (ctl.mapPressed) this.openMap();
      if (ctl.radioPressed && Player.car) { const st = Radio.cycle(); Hud.radio(st.name, st.tag); }
      if (ctl.camPressed) { this.camZoom = this.camZoom === 1 ? 1.45 : this.camZoom === 1.45 ? 0.75 : 1; }
    } else if (this.state === 'pause') { if (ctl.pausePressed) this.resume(); }
    else if (this.state === 'map') { if (ctl.mapPressed || ctl.pausePressed) this.closeMap(); }
    if (this.state !== 'play') this.pend = this.clearEdges(this.pend);
    const simulate = !this.manual && (this.state === 'play' || this.state === 'title' || this.state === 'down');
    if (simulate) {
      this.acc = (this.acc || 0) + dt;
      const h = 1 / 60;
      let n = 0;
      while (this.acc >= h && n < 5) {
        this.step(h, this.pend);
        this.pend = this.clearEdges(this.pend);
        this.acc -= h; n++;
      }
      if (n === 5) this.acc = 0;
    }
    if (this.manual) { if (!(this.forceRender > 0)) return; this.forceRender--; }
    this.updateCamera(dt, this.state === 'play' ? ctl : null);
    const fog = Sky.update(this.hour, this.camera, this.state === 'title' ? this.camX : Player.x, this.state === 'title' ? this.camZ : Player.z);
    this.nightK = Sky.nightK;
    this.renderer.setClearColor(fog);
    updateWorld(simulate ? dt : 0, this.nightK, Player.x, Player.z, this.scene, this.time);
    VMAT.head.color.setRGB(lerp(0.85, 1, this.nightK), lerp(0.86, 0.98, this.nightK), lerp(0.87, 0.9, this.nightK));
    VMAT.tail.color.setRGB(lerp(0.42, 1, this.nightK), lerp(0.06, 0.12, this.nightK), lerp(0.06, 0.1, this.nightK));
    VMAT.beam.opacity = this.nightK * 0.32;
    for (const v of VEHICLES) v.updateMesh(simulate ? dt : 0);
    if (simulate) FX.update(dt);
    if (this.state !== 'title') Hud.update(dt);
    Audio2.update(dt);
    this.renderer.render(this.scene, this.camera);
  },
  clearEdges(c) {
    return Object.assign({}, c, { jumpPressed: false, enterPressed: false, attackPressed: false, radioPressed: false, mapPressed: false, pausePressed: false, camPressed: false, lookX: 0, lookY: 0 });
  },
  titleCam(dt) {
    // Slow drift along the coast, offshore, looking back at the skyline
    this.titleT = (this.titleT || 0) + dt;
    const a = this.titleT * 0.018, cam = this.camera;
    const z = 330 + Math.sin(a) * 230, lx = 560, lz = 360 + Math.sin(a) * 150;
    cam.position.set(1105, 46 + Math.sin(this.titleT * 0.05) * 6, z);
    cam.lookAt(lx, 30, lz);
    const dx = lx - cam.position.x, dz = lz - cam.position.z, d = Math.hypot(dx, dz);
    this.camX = cam.position.x; this.camZ = cam.position.z; this.camFX = dx / d; this.camFZ = dz / d; this.camYaw = Math.atan2(dx, dz);
  },
  updateCamera(dt, ctl) {
    if (this.state === 'title') { this.titleCam(dt); return; }
    const cam = this.camera, sens = 0.0024;
    let tx, ty, tz, dist, yaw, pitch;
    const v = Player.car;
    if (v) {
      if (ctl && (ctl.lookX || ctl.lookY)) { this.lookOffYaw -= ctl.lookX * sens; this.lookOffPitch += ctl.lookY * sens; this.freeLookT = 0; }
      this.freeLookT += dt;
      if (this.freeLookT > 1.4) { this.lookOffYaw = damp(wrapAngle(this.lookOffYaw), 0, 2.5, dt); this.lookOffPitch = damp(this.lookOffPitch, 0, 2.5, dt); }
      this.lookOffPitch = clamp(this.lookOffPitch, -0.3, 0.9);
      const sp = v.speed;
      let targetYaw = v.h;
      if (sp > 3 && v.vF > 0) { const vel = Math.atan2(v.vx, v.vz); targetYaw = v.h + wrapAngle(vel - v.h) * 0.5; }
      this.carYaw = dampAngle(this.carYaw, targetYaw, v.air ? 1.5 : 4.2, dt);
      yaw = this.carYaw + this.lookOffYaw; pitch = 0.2 + this.lookOffPitch;
      dist = (6.2 + v.t.L * 0.55 + Math.min(sp, 50) * 0.045) * this.camZoom;
      const fx = Math.sin(v.h), fz = Math.cos(v.h);
      tx = v.x + fx * Math.min(sp, 40) * 0.05; ty = v.y + 1.2 + v.t.H * 0.35; tz = v.z + fz * Math.min(sp, 40) * 0.05;
      this.camYaw = yaw;
    } else {
      if (ctl) { this.camYaw -= ctl.lookX * sens; this.camPitch += ctl.lookY * sens; }
      this.camPitch = clamp(this.camPitch, -0.35, 1.25);
      yaw = this.camYaw; pitch = this.camPitch; dist = 4.8 * this.camZoom;
      tx = Player.x; ty = Player.y + 1.55; tz = Player.z;
      if (Player.state === 'down') ty = Player.y + 0.8;
    }
    const cp = Math.cos(pitch);
    let cx = tx - Math.sin(yaw) * cp * dist, cy = ty + Math.sin(pitch) * dist, cz = tz - Math.cos(yaw) * cp * dist;
    const hit = rayBuildings(tx, ty, tz, cx, cy, cz);
    if (hit < 1) { const k = Math.max(0.06, hit - 0.04); cx = tx + (cx - tx) * k; cy = ty + (cy - ty) * k; cz = tz + (cz - tz) * k; }
    cy = Math.max(cy, groundHeight(cx, cz) + 0.35);
    if (this.shake > 0) { const s = this.shake * 0.35; cx += rnd(-s, s); cy += rnd(-s, s); cz += rnd(-s, s); this.shake = Math.max(0, this.shake - dt * 2.2); }
    cam.position.set(cx, cy, cz);
    cam.lookAt(tx, ty, tz);
    const wantFov = 62 + (v ? clamp(v.speed * 0.32, 0, 18) : 0);
    this.fov = damp(this.fov, wantFov, 3, dt);
    if (Math.abs(cam.fov - this.fov) > 0.05) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
    this.camX = cx; this.camZ = cz; this.camFX = Math.sin(yaw); this.camFZ = Math.cos(yaw);
  },
};

// ---------- Boot ----------
function bootGame(hotData) {
  try {
    Game.init(hotData || {});
    if (location.hash === '#debug') window.__solano = { Game, Player, VEHICLES, PEDS, Police, Missions, World, Traffic, Vehicle, DriverAI, Store, Hud, Sky, Radio, Audio2 };
  } catch (err) {
    console.error(err);
    const e = document.getElementById('bootError');
    if (e) { e.hidden = false; e.querySelector('span').textContent = String((err && err.message) || err); }
  }
}
if (window.claude && window.claude.hot && window.claude.hot.snapshot) {
  try { window.claude.hot.snapshot(() => ({ save: Object.assign({}, Store.data, { money: Math.round(Game.money) }) })); } catch (e) { /* optional */ }
}
if (typeof THREE === 'undefined') {
  const e = document.getElementById('bootError');
  if (e) { e.hidden = false; e.querySelector('span').textContent = 'The 3D engine could not load. Check your connection and reload.'; }
} else if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(bootGame);
else bootGame((window.claude && window.claude.hot && window.claude.hot.data) || {});
