// ---------- Missions, collectibles, stunts, shops ----------
const MISSIONS = [
  {
    title: 'Corner Store Run', pay: 400,
    intro: 'Dolores: Mijo! My van is parked out front. Run these crates to the hotels on Ocean Boulevard. Hotels hate waiting.',
    stages: [
      { type: 'car', key: 'van', vtype: 'pelican', paint: 0xf2f2ee, at: () => [759, 418, Math.PI], text: 'Get in the delivery van' },
      { type: 'goto', at: () => [World.poi.hotel1.x, World.poi.hotel1.z], needCar: 'van', timer: 75, text: 'Deliver the crates to Hotel Marisol', done: 'Crates dropped at Hotel Marisol' },
      { type: 'goto', at: () => [World.poi.hotel2.x, World.poi.hotel2.z], needCar: 'van', timer: 55, text: 'Now La Palma, south on Ocean Boulevard', done: 'Last crate delivered' },
    ],
  },
  {
    title: 'The Collector', pay: 900,
    intro: 'Dolores: A collector downtown wants a Tarpon GT. One sits parked in Palmetto Heights. Bring it to the Drydock Garage, no cops attached.',
    stages: [
      { type: 'car', key: 'tarpon', vtype: 'tarpon', paint: 0xf2c230, at: () => [133, 181, -Math.PI / 2], text: 'Steal the yellow Tarpon GT in Palmetto Heights', onEnter: () => { Police.setWanted(2); Hud.toast('The alarm tripped'); } },
      { type: 'goto', at: () => [World.poi.garage.x, World.poi.garage.z], needCar: 'tarpon', noWanted: true, text: 'Deliver the Tarpon to the Drydock Garage', done: 'The collector is pleased', consume: 'tarpon' },
    ],
  },
  {
    title: 'Coastline Sprint', pay: 700,
    intro: 'Dolores: My nephew says you drive like a tourist. Prove him wrong. Ocean Boulevard to Downtown and back, against the clock.',
    stages: [
      { type: 'car', key: 'racer', vtype: 'tarpon', paint: 0xe8412c, at: () => [759, 432, Math.PI], text: 'Get in the red Tarpon' },
      { type: 'goto', at: () => [937, 70], needCar: 'racer', text: 'Drive to the starting line on Ocean Boulevard' },
      { type: 'checkpoints', needCar: 'racer', timer: 105, text: 'Hit every checkpoint', pts: [[937, 250], [937, 520], [937, 770], [870, 843], [660, 843], [473, 760], [473, 520], [473, 290], [473, 110], [660, 97], [850, 97], [937, 210]] },
    ],
  },
  {
    title: 'Hot Package', pay: 1200,
    intro: 'Dolores: Somebody left a package at the end of the pier. Bring it to my cousin in Palmetto Heights. Police love that pier.',
    stages: [
      { type: 'goto', at: () => [World.poi.pierEnd.x, World.poi.pierEnd.z], text: 'Pick up the package at the end of the pier', prop: 'package', onArrive: () => { Police.setWanted(3); Hud.toast('Cops spotted you'); } },
      { type: 'goto', at: () => [49, 181], timer: 150, text: 'Deliver the package to Palmetto Heights', done: 'Package delivered' },
    ],
  },
  {
    title: 'Last Call', pay: 3000,
    intro: 'Dolores: One last job. A briefcase is waiting at the Solano Tower plaza. Get it to the boat at the docks. It will get loud.',
    stages: [
      { type: 'goto', at: () => [World.poi.tower.x, World.poi.tower.z], text: 'Collect the briefcase at Solano Tower', prop: 'case', onArrive: () => { Police.setWanted(4); Hud.toast('Every cop in Port Solano is coming'); } },
      { type: 'goto', at: () => [World.poi.dock.x, World.poi.dock.z], text: 'Reach the boat at the docks', done: 'The boat slips out of the harbor', onArrive: () => Police.setWanted(0) },
    ],
  },
];
const TAPES = () => [
  [World.poi.fountain.x + 7, World.poi.fountain.z + 7], [SHORE_X + 146, PIER_Z - 16], [990, -45], [425, 966], [4 * SP + HALF_ROAD + 36, 4 * SP + HALF_ROAD + 34.5],
  [11, 11], [World.poi.lighthouse.x - 6, World.poi.lighthouse.z - 6], [3 * SP + HALF_ROAD + 38, 8 * SP - HALF_ROAD - 2], [-40, 500], [974, 181],
];

const Missions = {
  idx: 0, active: null, stage: 0, timer: 0, timerOn: false, cp: 0, vehicles: {}, sprayCD: 0,
  init(scene) {
    const pillarGeo = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true); pillarGeo.translate(0, 0.5, 0);
    const pc = makeCanvas(4, 64), pg = pc.getContext('2d');
    const grd = pg.createLinearGradient(0, 64, 0, 0); grd.addColorStop(0, 'rgba(255,255,255,0.95)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    pg.fillStyle = grd; pg.fillRect(0, 0, 4, 64);
    const ptex = canvasTex(pc, false);
    const mk = (color, r, h) => {
      const g = new THREE.Group();
      const m = new THREE.Mesh(pillarGeo, new THREE.MeshBasicMaterial({ map: ptex, color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      m.scale.set(r, h, r); g.add(m);
      const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.82, r, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; g.add(ring);
      g.visible = false; scene.add(g); g.userData.ring = ring;
      return g;
    };
    this.mObj = mk(0xffb547, 3.2, 14);
    this.mNext = mk(0x2ee6c9, 3, 9);
    this.mContact = mk(0xffb547, 1.6, 8);
    this.mSpray = [mk(0x2ee6c9, 3, 6), mk(0x2ee6c9, 3, 6)];
    World.poi.spray.forEach((s, i) => { this.mSpray[i].position.set(s.x, groundHeight(s.x, s.z), s.z); this.mSpray[i].visible = true; });
    // Props carried in missions
    this.propMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), new THREE.MeshLambertMaterial({ color: 0xb08a5a }));
    this.propMesh.visible = false; scene.add(this.propMesh);
    // Tapes
    const tapeGeo = new THREE.BoxGeometry(0.9, 0.56, 0.14);
    const tc = makeCanvas(64, 40), tg = tc.getContext('2d');
    tg.fillStyle = '#1b1b1f'; tg.fillRect(0, 0, 64, 40); tg.fillStyle = '#ffb547'; tg.fillRect(4, 4, 56, 16); tg.fillStyle = '#2ee6c9'; tg.fillRect(4, 14, 56, 4);
    tg.fillStyle = '#ddd'; tg.beginPath(); tg.arc(20, 29, 5, 0, TAU); tg.arc(44, 29, 5, 0, TAU); tg.fill();
    const tmat = new THREE.MeshBasicMaterial({ map: canvasTex(tc, false) });
    const glowMat = new THREE.SpriteMaterial({ map: TEX.glow, color: 0xffb547, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
    this.tapes = TAPES().map(([x, z], i) => {
      const g = new THREE.Group(); const m = new THREE.Mesh(tapeGeo, tmat); g.add(m);
      const s = new THREE.Sprite(glowMat); s.scale.set(3, 3, 1); g.add(s);
      g.position.set(x, groundHeight(x, z) + 1.1, z); scene.add(g);
      return { x, z, g, got: Store.data.tapes.includes(i), i };
    });
    this.tapes.forEach(t => { t.g.visible = !t.got; });
  },
  available() { return !this.active && this.idx < MISSIONS.length && Game.state === 'play'; },
  start(i) {
    const M = MISSIONS[i];
    this.active = M; this.stage = -1; this.timer = 0; this.timerOn = false; this.vehicles = {};
    Hud.missionTitle(M.title);
    Hud.subtitle(M.intro, 7);
    Audio2.missionStart();
    this.nextStage();
  },
  cur() { return this.active ? this.active.stages[this.stage] : null; },
  nextStage() {
    this.stage++;
    const M = this.active;
    if (this.stage >= M.stages.length) return this.pass();
    const S = this.cur();
    this.cp = 0;
    if (S.timer) { this.timer = (this.timerOn ? this.timer : 0) + S.timer; this.timerOn = true; }
    if (S.type === 'car') {
      const [x, z, h] = S.at();
      for (const v of [...VEHICLES]) if (v !== Game.playerVehicle() && dist2(v.x, v.z, x, z) < 36 && !v.mission) v.dispose();
      const v = new Vehicle(S.vtype, x, z, h, { paint: S.paint });
      v.mission = true; this.vehicles[S.key] = v;
    }
    if (S.prop) {
      const [x, z] = S.at();
      this.propMesh.geometry.dispose();
      this.propMesh.geometry = S.prop === 'case' ? new THREE.BoxGeometry(0.7, 0.5, 0.18) : new THREE.BoxGeometry(0.8, 0.6, 0.8);
      this.propMesh.material.color.setHex(S.prop === 'case' ? 0x2a2a2a : 0xb08a5a);
      this.propMesh.position.set(x, groundHeight(x, z) + 0.5, z); this.propMesh.visible = true;
    }
    Hud.objective(S.text);
  },
  objectivePos() {
    const S = this.cur(); if (!S) return null;
    if (S.type === 'car') { const v = this.vehicles[S.key]; return v ? { x: v.x, z: v.z, car: true } : null; }
    if (S.needCar && Game.playerVehicle() !== this.vehicles[S.needCar] && this.vehicles[S.needCar]) { const v = this.vehicles[S.needCar]; return { x: v.x, z: v.z, car: true }; }
    if (S.noWanted && Police.wanted > 0) return null;
    if (S.type === 'checkpoints') { const p = S.pts[this.cp]; return { x: p[0], z: p[1] }; }
    const [x, z] = S.at(); return { x, z };
  },
  pass() {
    const M = this.active;
    Game.addMoney(M.pay);
    Hud.big('MISSION PASSED', fmtMoney(M.pay), 'pass');
    Audio2.missionPass();
    this.cleanup(true);
    this.idx++;
    Store.data.mission = this.idx; Store.save();
    if (this.idx >= MISSIONS.length) setTimeout(() => { Hud.subtitle('Port Solano is yours. Thanks for playing. The city keeps running; go make trouble.', 8); }, 4200);
    else setTimeout(() => { if (!this.active) Hud.phone('Dolores', 'Come by the bodega when you are ready. I have more work.'); }, 6000);
  },
  fail(reason) {
    if (!this.active) return;
    Hud.big('MISSION FAILED', reason, 'fail');
    Audio2.missionFail();
    this.cleanup(false);
  },
  cleanup(passed) {
    for (const k in this.vehicles) { const v = this.vehicles[k]; if (v && VEHICLES.includes(v)) { v.mission = false; } }
    this.vehicles = {}; this.active = null; this.timerOn = false;
    this.mObj.visible = false; this.mNext.visible = false; this.propMesh.visible = false;
    Hud.objective(''); Hud.timer(null);
  },
  update(dt) {
    const t = Game.time;
    const pp = Game.playerPos(), pv = Game.playerVehicle();
    // Contact marker
    const cpos = World.poi.bodega;
    this.mContact.visible = this.available();
    this.mContact.position.set(cpos.x, groundHeight(cpos.x, cpos.z), cpos.z);
    if (this.available() && dist2(pp.x, pp.z, cpos.x, cpos.z) < 2.2 * 2.2 && !pv) this.start(this.idx);
    // Collectibles
    for (const tp of this.tapes) {
      if (tp.got) continue;
      tp.g.children[0].rotation.y = t * 2; tp.g.position.y = groundHeight(tp.x, tp.z) + 1.1 + Math.sin(t * 2.4 + tp.i) * 0.15;
      const r = pv ? 3 : 1.6;
      if (dist2(pp.x, pp.z, tp.x, tp.z) < r * r && Math.abs(Player.y - tp.g.position.y) < 3) {
        tp.got = true; tp.g.visible = false; Store.data.tapes.push(tp.i); Store.save();
        Game.addMoney(100); Audio2.pickup();
        Hud.toast(`Lost Tape ${Store.data.tapes.length} of ${this.tapes.length}  +$100`);
        if (Store.data.tapes.length === this.tapes.length) { Game.addMoney(1000); Hud.big('ALL TAPES FOUND', '+$1,000', 'pass'); }
      }
    }
    // Stunt jumps
    if (pv && pv.landed) {
      const L = pv.landed; pv.landed = null;
      if (L.fromRamp && L.airT > 0.8) {
        let ramp = -1; World.ramps.forEach((r, i) => { if (dist2(pv.x, pv.z, (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2) < 90 * 90) ramp = i; });
        let pay = Math.round(L.airT * 60 / 10) * 10;
        let sub = `${L.airT.toFixed(1)}s of air`;
        if (ramp >= 0 && !Store.data.jumps.includes(ramp)) { Store.data.jumps.push(ramp); Store.save(); pay += 250; sub += ' · first time bonus'; }
        Game.addMoney(pay); Hud.big('STUNT JUMP', `+${fmtMoney(pay)}  ${sub}`, 'stunt'); Audio2.pickup();
      }
    }
    // Paint shops
    this.sprayCD -= dt;
    World.poi.spray.forEach((s, i) => {
      const m = this.mSpray[i]; m.visible = !!pv;
      if (pv && this.sprayCD <= 0 && dist2(pv.x, pv.z, s.x, s.z) < 3.2 * 3.2) {
        this.sprayCD = 6;
        if (Game.money < 100) { Hud.toast('Fresh Coat costs $100'); return; }
        if (Police.wanted > 0 && Police.seen) { Hud.toast('Lose the cops first. They can see you.'); return; }
        Game.addMoney(-100);
        Hud.fade(() => { pv.repair(); pv.setPaint(pick([0xe8412c, 0x16a3a3, 0xf2c230, 0x3a7bd5, 0xf2f2ee, 0x1b1b1f, 0x8e7cc3, 0x58b368])); Police.setWanted(0); });
        Hud.toast('Fresh Coat: repaired, repainted, forgotten  -$100'); Audio2.spray();
      }
    });
    // Markers pulse
    const pulse = 1 + Math.sin(t * 4) * 0.06;
    for (const m of [this.mObj, this.mNext, this.mContact, ...this.mSpray]) m.userData.ring.scale.set(pulse, pulse, 1);
    // Active mission
    if (!this.active) return;
    const S = this.cur();
    if (this.timerOn) {
      this.timer -= dt; Hud.timer(this.timer);
      if (this.timer <= 0) return this.fail('Out of time');
    }
    for (const k in this.vehicles) { const v = this.vehicles[k]; if (v && (v.wrecked || v.burning || !VEHICLES.includes(v))) return this.fail('The vehicle was wrecked'); }
    if (S.type === 'car') {
      const v = this.vehicles[S.key];
      this.mObj.visible = false;
      if (pv === v) { if (S.onEnter) S.onEnter(); this.nextStage(); }
      return;
    }
    const needV = S.needCar ? this.vehicles[S.needCar] : null;
    if (needV && pv !== needV) { Hud.objective(`Get back in the ${needV.t.name}`); this.mObj.visible = false; this.mNext.visible = false; return; }
    if (S.noWanted && Police.wanted > 0) { Hud.objective('Lose the cops first'); this.mObj.visible = false; return; }
    Hud.objective(S.text);
    let tx, tz;
    if (S.type === 'checkpoints') {
      [tx, tz] = S.pts[this.cp];
      const nx = S.pts[this.cp + 1];
      this.mNext.visible = !!nx; if (nx) this.mNext.position.set(nx[0], 0, nx[1]);
      Hud.objective(`${S.text}  ${this.cp}/${S.pts.length}`);
    } else [tx, tz] = S.at();
    this.mObj.visible = true; this.mObj.position.set(tx, groundHeight(tx, tz), tz);
    const r = S.type === 'checkpoints' ? 9 : (pv ? 4.5 : 2.4);
    if (dist2(pp.x, pp.z, tx, tz) < r * r) {
      if (S.type === 'checkpoints') {
        this.cp++; Audio2.checkpoint();
        if (this.cp >= S.pts.length) { this.mNext.visible = false; this.nextStage(); }
        return;
      }
      if (S.prop) { this.propMesh.visible = false; Audio2.pickup(); }
      if (S.onArrive) S.onArrive();
      if (S.consume) { const v = this.vehicles[S.consume]; delete this.vehicles[S.consume]; Hud.fade(() => { if (Player.car === v) Player.exitVehicle(); if (v) { v.mission = false; v.dispose(); } }); }
      if (S.done) Hud.toast(S.done);
      this.nextStage();
    }
  },
  blips() {
    const out = [];
    if (this.available()) out.push({ x: World.poi.bodega.x, z: World.poi.bodega.z, kind: 'contact' });
    const o = this.objectivePos(); if (o) out.push({ x: o.x, z: o.z, kind: o.car ? 'car' : 'objective' });
    return out;
  },
};

// ---------- Persistence (per viewer, best-effort) ----------
const Store = {
  key: 'solano-heat-save-v1',
  data: { money: 500, mission: 0, tapes: [], jumps: [] },
  load(hot) {
    let d = hot && hot.save ? hot.save : null;
    if (!d) { try { const raw = localStorage.getItem(this.key); if (raw) d = JSON.parse(raw); } catch (e) { d = null; } }
    if (d && typeof d === 'object') {
      this.data.money = Number.isFinite(d.money) ? d.money : 500;
      this.data.mission = Number.isInteger(d.mission) ? clamp(d.mission, 0, MISSIONS.length) : 0;
      this.data.tapes = Array.isArray(d.tapes) ? d.tapes.filter(n => Number.isInteger(n)) : [];
      this.data.jumps = Array.isArray(d.jumps) ? d.jumps.filter(n => Number.isInteger(n)) : [];
      this.data.shadows = typeof d.shadows === 'boolean' ? d.shadows : undefined;
      this.data.music = Number.isFinite(d.music) ? d.music : undefined;
    }
  },
  save() {
    this.data.money = Math.round(Game.money);
    try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) { /* storage unavailable */ }
  },
  reset() {
    this.data = { money: 500, mission: 0, tapes: [], jumps: [], shadows: this.data.shadows, music: this.data.music };
    try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) { /* ignore */ }
  },
};
