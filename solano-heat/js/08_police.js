// ---------- Wanted level & police ----------
const Police = {
  wanted: 0, heat: 0, unseenT: 0, seen: false, arrestT: 0, spawnCD: 0, pending: 0, pendingT: 0, heli: null, flash: 0,
  reset() {
    this.wanted = 0; this.heat = 0; this.unseenT = 0; this.arrestT = 0; this.pending = 0; this.pendingT = 0;
    for (const v of VEHICLES) if (v.police && v.ai) { v.ai.mode = 'traffic'; v.ai.cruise = 12; v.ai.laneOff = LANE; v.siren = false; v.ai.initRoute(); }
  },
  copsWitness(x, z) {
    for (const v of VEHICLES) if (v.police && v.driver && dist2(v.x, v.z, x, z) < 65 * 65 && losClear(v.x, v.z, x, z)) return true;
    for (const p of PEDS) if (p.cop && p.state !== 'ko' && dist2(p.x, p.z, x, z) < 50 * 50 && losClear(p.x, p.z, x, z)) return true;
    if (this.heli && dist2(this.heli.x, this.heli.z, x, z) < 70 * 70) return true;
    return false;
  },
  crime(kind, x, z) {
    if (Game.state !== 'play') return;
    const sev = { punch: 0.7, hitPed: 1.2, carjack: 1.0, steal: 0.6, hitCop: 2.2, hitPoliceCar: 1.4, stealCopCar: 2.2, explosion: 1.6, ramCar: 0.25 }[kind] || 1;
    const witnessed = this.copsWitness(x, z);
    if (kind === 'hitCop' || kind === 'stealCopCar' || kind === 'hitPoliceCar') {
      this.setWanted(Math.max(this.wanted + (this.wanted > 0 && kind !== 'hitPoliceCar' ? 1 : 0), kind === 'hitPoliceCar' ? Math.max(1, this.wanted) : 2));
      if (kind === 'hitPoliceCar') this.addHeat(sev);
      this.seenNow(x, z); return;
    }
    if (this.wanted > 0) { if (witnessed) { this.addHeat(sev); this.seenNow(x, z); } return; }
    if (witnessed) { this.setWanted(1); this.seenNow(x, z); return; }
    const reportChance = { punch: 0.3, hitPed: 0.45, carjack: 0.35, steal: 0, explosion: 0.5, ramCar: 0.04 }[kind] || 0;
    if (Math.random() < reportChance && !this.pending) { this.pending = 1; this.pendingT = 3; }
  },
  addHeat(h) {
    this.heat += h;
    const need = 2.2 + this.wanted * 0.8;
    if (this.heat >= need && this.wanted < 5) { this.heat = 0; this.setWanted(this.wanted + 1); }
  },
  setWanted(n) {
    n = clamp(n, 0, 5);
    if (n > this.wanted) { Audio2.wantedUp(); this.flash = 1.2; }
    const was = this.wanted;
    this.wanted = n;
    if (n === 0 && was > 0) this.reset();
    this.unseenT = 0;
  },
  seenNow(x, z) { this.unseenT = 0; this.lastX = x; this.lastZ = z; },
  deployOfficer(car) {
    if (car.officer || !car.driver) return;
    const lx = Math.cos(car.h), lz = -Math.sin(car.h);
    let ox = car.x + lx * (car.t.W / 2 + 0.6), oz = car.z + lz * (car.t.W / 2 + 0.6);
    if (pointBlocked(ox, oz, 0.3)) { ox = car.x - lx * (car.t.W / 2 + 0.6); oz = car.z - lz * (car.t.W / 2 + 0.6); }
    const p = new Ped(ox, oz, { cop: true, car });
    p.state = 'chase';
    car.officer = p; car.driver = null; car.savedAI = car.ai; car.ai = null; car.input.acc = 0; car.input.hb = true;
    Audio2.door(ox, oz);
  },
  reenter(p) {
    const c = p.car;
    p.dispose();
    if (!c || c.wrecked || c.driver) return;
    c.driver = 'ai'; c.ai = c.savedAI || new DriverAI(c, 'police'); c.savedAI = null;
    c.ai.mode = this.wanted > 0 ? 'police' : 'traffic';
    if (c.ai.mode === 'traffic') { c.siren = false; c.ai.laneOff = LANE; c.ai.cruise = 12; }
    c.ai.initRoute();
    c.input.hb = false;
  },
  spawnUnit(px, pz) {
    const s = Traffic.randomLaneSpot(px, pz, 70, 160);
    if (!s) return;
    const v = new Vehicle('police', s.x, s.z, s.h);
    v.driver = 'police'; v.ai = new DriverAI(v, 'police');
    v.vx = Math.sin(s.h) * 15; v.vz = Math.cos(s.h) * 15; v.siren = true;
  },
  update(dt) {
    const pp = Game.playerPos();
    this.flash = Math.max(0, this.flash - dt);
    if (this.pending) { this.pendingT -= dt; if (this.pendingT <= 0) { this.pending = 0; if (this.wanted === 0) { this.setWanted(1); this.seenNow(pp.x, pp.z); } } }
    // Convert patrols into pursuers
    if (this.wanted > 0) {
      for (const v of VEHICLES) if (v.police && v.ai && v.driver && v.ai.mode !== 'police') { v.ai.mode = 'police'; v.ai.laneOff = 1.2; v.ai.cruise = 30; v.siren = true; }
    }
    if (this.wanted === 0) { this.arrestT = 0; this.updateHeli(dt, false); return; }
    // Seen?
    let seen = false, closest = 1e9;
    const seeR = this.wanted >= 3 ? 90 : 75;
    for (const v of VEHICLES) {
      if (!v.police || (!v.driver && !v.officer)) continue;
      const d2 = dist2(v.x, v.z, pp.x, pp.z); if (d2 < closest) closest = d2;
      if (d2 < seeR * seeR && losClear(v.x, v.z, pp.x, pp.z)) { seen = true; break; }
    }
    if (!seen) for (const p of PEDS) if (p.cop && p.state !== 'ko' && dist2(p.x, p.z, pp.x, pp.z) < 55 * 55 && losClear(p.x, p.z, pp.x, pp.z)) { seen = true; break; }
    if (!seen && this.heli && dist2(this.heli.x, this.heli.z, pp.x, pp.z) < 42 * 42) seen = true;
    this.seen = seen;
    // Out of sight counts fully only once units are in the area; before that the search is slower
    if (seen) this.seenNow(pp.x, pp.z); else this.unseenT += dt * (closest < 160 * 160 ? 1 : 0.35);
    const need = 9 + this.wanted * 5;
    if (this.unseenT > need) { this.setWanted(0); Hud.toast('You lost the cops'); Audio2.blip(660, 0.12, 'sine', 0.08); return; }
    // Spawn
    const want = [0, 1, 2, 4, 5, 7][this.wanted];
    let units = 0; for (const v of VEHICLES) if (v.police && (v.driver === 'police' || (v.ai && v.ai.mode === 'police') || v.officer)) units++;
    this.spawnCD -= dt;
    if (units < want && this.spawnCD <= 0) { this.spawnCD = 2.2; this.spawnUnit(pp.x, pp.z); }
    this.updateHeli(dt, this.wanted >= 4);
    // Arrest
    const pv = Game.playerVehicle();
    let near = false;
    if (pv) {
      if (pv.speed < 1.6) for (const v of VEHICLES) if (v.police && v !== pv && (v.driver || v.officer) && dist2(v.x, v.z, pv.x, pv.z) < 7.5 * 7.5) { near = true; break; }
      if (!near && pv.speed < 1.6) for (const p of PEDS) if (p.cop && p.state === 'chase' && dist2(p.x, p.z, pv.x, pv.z) < 3.4 * 3.4) { near = true; break; }
    } else {
      for (const p of PEDS) if (p.cop && (p.state === 'chase') && dist2(p.x, p.z, pp.x, pp.z) < 1.6 * 1.6) { near = true; break; }
    }
    const rate = pv ? 1 : (Player.state === 'down' ? 2 : 1.2);
    if (near) this.arrestT += dt * rate; else this.arrestT = Math.max(0, this.arrestT - dt * 1.5);
    if (this.arrestT >= 3) { this.arrestT = 0; Game.arrest(); }
  },
  updateHeli(dt, active) {
    if (active && !this.heli) this.heli = makeHeli();
    const h = this.heli; if (!h) return;
    const pp = Game.playerPos();
    if (!active) { h.leaving = true; }
    h.t += dt;
    let tx, tz, ty = 48;
    if (h.leaving) { tx = h.x + (h.x - pp.x); tz = h.z + (h.z - pp.z); ty = 90; }
    else { tx = pp.x + Math.cos(h.t * 0.35) * 22; tz = pp.z + Math.sin(h.t * 0.35) * 22; }
    const dx = tx - h.x, dz = tz - h.z, d = Math.hypot(dx, dz), sp = Math.min(23, d * 0.8);
    if (d > 0.01) { h.vx = damp(h.vx, dx / d * sp, 1.2, dt); h.vz = damp(h.vz, dz / d * sp, 1.2, dt); }
    h.x += h.vx * dt; h.z += h.vz * dt; h.y = damp(h.y, ty, 0.6, dt);
    h.g.position.set(h.x, h.y, h.z);
    h.g.rotation.y = dampAngle(h.g.rotation.y, Math.atan2(pp.x - h.x, pp.z - h.z), 1.5, dt);
    h.g.rotation.x = clamp(Math.hypot(h.vx, h.vz) * 0.012, 0, 0.25);
    h.rotor.rotation.y += dt * 28; h.tail.rotation.x += dt * 40;
    h.beam.visible = Game.nightK > 0.2 && !h.leaving;
    if (h.beam.visible) { h.beam.position.set(h.x, h.y - 1.2, h.z); h.beam.lookAt(pp.x, 0, pp.z); }
    if (h.leaving && dist2(h.x, h.z, pp.x, pp.z) > 400 * 400) {
      Game.scene.remove(h.g); Game.scene.remove(h.beam); this.heli = null;
    }
  },
};
function makeHeli() {
  const pp = Game.playerPos();
  const g = new THREE.Group();
  const navy = new THREE.MeshLambertMaterial({ color: 0x1b2a44 }), white = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2, 4.4), navy); body.position.y = 0;
  const nose = new THREE.Mesh(new THREE.BoxGeometry(2, 1.5, 1.2), VMAT.glass); nose.position.set(0, -0.1, 2.6);
  const boom = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 5), white); boom.position.set(0, 0.3, -4.4);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.6, 1), navy); fin.position.set(0, 1, -6.8);
  const skidG = new THREE.BoxGeometry(0.15, 0.15, 4);
  const sk1 = new THREE.Mesh(skidG, white), sk2 = new THREE.Mesh(skidG, white); sk1.position.set(1, -1.4, 0); sk2.position.set(-1, -1.4, 0);
  const rotor = new THREE.Group(); rotor.position.y = 1.3;
  for (let k = 0; k < 2; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, 11), new THREE.MeshLambertMaterial({ color: 0x222222 })); b.rotation.y = k * Math.PI / 2; rotor.add(b); }
  const tail = new THREE.Group(); tail.position.set(0.25, 1, -6.8);
  const tb = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.2, 0.2), new THREE.MeshLambertMaterial({ color: 0x222222 })); tail.add(tb);
  g.add(body, nose, boom, fin, sk1, sk2, rotor, tail);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  Game.scene.add(g);
  const bg = new THREE.ConeGeometry(9, 60, 18, 1, true); bg.translate(0, -30, 0); bg.rotateX(-Math.PI / 2);
  const beam = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: 0xfff6d8, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.visible = false;
  Game.scene.add(beam);
  const ang = Math.random() * TAU;
  return { g, rotor, tail, beam, x: pp.x + Math.cos(ang) * 260, z: pp.z + Math.sin(ang) * 260, y: 70, vx: 0, vz: 0, t: 0, leaving: false };
}
