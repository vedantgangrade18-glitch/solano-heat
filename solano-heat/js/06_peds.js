// ---------- Humans: models, pedestrians, officers ----------
const PMAT = {};
const PED_PAL = {
  skin: [0x5c3a1e, 0x8d5524, 0xa0663a, 0xc68642, 0xe0ac69, 0xf1c27d, 0xffdbac],
  shirt: [0xe8412c, 0x3a7bd5, 0xf2f2ee, 0x58b368, 0xe8a33d, 0x8e7cc3, 0x16a3a3, 0xff8ab0, 0x2a2d33, 0xf2c230, 0x7fd4ff],
  pants: [0x23324a, 0x3b3b3b, 0x6b5a45, 0xd9d2c5, 0x1f1f22, 0x4a6a8a, 0x8a6a4a],
  hair: [0x1a1410, 0x3b2a1a, 0x6b4a2a, 0xc9a46b, 0x8a8a8a, 0x2a1a10, 0xa0522d],
  shoes: [0x111111, 0xf2f2ee, 0x6b3a1a, 0x2a4a8a],
};
// simple = arms baked into the torso (fewer draw calls for NPCs)
function buildHuman(c, simple = false) {
  if (!PMAT.body) PMAT.body = new THREE.MeshLambertMaterial({ vertexColors: true });
  const C = k => hexRgb(c[k]);
  const root = new THREE.Group();
  const gb = new GeoBuilder();
  gb.box(0, 1.15, 0, 0.5, 0.62, 0.28, C('shirt'));
  gb.box(0, 0.86, 0, 0.46, 0.2, 0.26, C('pants'));
  gb.box(0, 1.5, 0, 0.14, 0.1, 0.14, C('skin'));
  gb.box(0, 1.67, 0, 0.27, 0.29, 0.27, C('skin'));
  gb.box(0, 1.83, -0.01, 0.29, 0.07, 0.29, C('hair'));
  gb.box(0, 1.72, -0.13, 0.29, 0.22, 0.05, C('hair'));
  gb.box(0.065, 1.69, 0.137, 0.045, 0.035, 0.01, [0.08, 0.08, 0.1]);
  gb.box(-0.065, 1.69, 0.137, 0.045, 0.035, 0.01, [0.08, 0.08, 0.1]);
  if (c.cap) { gb.box(0, 1.86, 0, 0.31, 0.09, 0.31, C('cap')); gb.box(0, 1.83, 0.19, 0.27, 0.03, 0.13, C('cap')); }
  if (c.badge) gb.box(0.12, 1.3, 0.142, 0.07, 0.08, 0.01, [0.95, 0.8, 0.3]);
  const armBoxes = (g, ox, oy, rz) => {
    const m = new THREE.Matrix4().makeRotationZ(rz).setPosition(ox, oy, 0);
    const parts = [[0, -0.12, 0.14, 0.26, 0.15, C('shirt')], [0, -0.4, 0.12, 0.32, 0.12, C('skin')], [0, -0.6, 0.11, 0.09, 0.12, C('skin')]];
    for (const [x, y, sx, sy, sz, col] of parts) { const bg = new THREE.BoxGeometry(sx, sy, sz); bg.translate(x, y, 0); g.merge(bg, m, col); bg.dispose(); }
  };
  if (simple) { armBoxes(gb, 0.32, 1.43, 0.08); armBoxes(gb, -0.32, 1.43, -0.08); }
  const body = new THREE.Mesh(gb.build(), PMAT.body);
  body.castShadow = true;
  root.add(body);
  const limb = (isArm) => {
    const g = new GeoBuilder();
    if (isArm) armBoxes(g, 0, 0, 0);
    else { g.box(0, -0.38, 0, 0.18, 0.76, 0.2, C('pants')); g.box(0, -0.8, 0.045, 0.19, 0.1, 0.29, C('shoes')); }
    const m = new THREE.Mesh(g.build(), PMAT.body); m.castShadow = !simple;
    const p = new THREE.Group(); p.add(m); return p;
  };
  const legL = limb(false), legR = limb(false);
  legL.position.set(0.12, 0.86, 0); legR.position.set(-0.12, 0.86, 0);
  root.add(legL, legR);
  let armL = null, armR = null;
  if (!simple) { armL = limb(true); armR = limb(true); armL.position.set(0.32, 1.43, 0); armR.position.set(-0.32, 1.43, 0); root.add(armL, armR); }
  return { root, body, armL, armR, legL, legR };
}
function disposeHuman(h) { h.root.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); }
function animateHuman(H, phase, amp, punch = 0, carryArms = false) {
  const s = Math.sin(phase) * amp;
  H.legL.rotation.x = s; H.legR.rotation.x = -s;
  if (H.armL) {
    H.armL.rotation.x = -s * 0.8; H.armR.rotation.x = s * 0.8;
    H.armL.rotation.z = 0.06; H.armR.rotation.z = -0.06;
    if (punch > 0) { const k = Math.sin(clamp(punch, 0, 1) * Math.PI); H.armR.rotation.x = -1.5 * k; H.armR.rotation.z = -0.1; }
    if (carryArms) { H.armL.rotation.x = -0.9; H.armR.rotation.x = -0.9; }
  }
  H.body.position.y = Math.abs(Math.cos(phase)) * amp * 0.06;
}
function randomLook() {
  return { skin: pick(PED_PAL.skin), shirt: pick(PED_PAL.shirt), pants: pick(PED_PAL.pants), hair: pick(PED_PAL.hair), shoes: pick(PED_PAL.shoes) };
}

const PEDS = [];
const PED_CORNER_INSET = 2.6;
function ringCorner(blk, k) {
  const I = PED_CORNER_INSET;
  return k === 0 ? { x: blk.x0 + I, z: blk.z0 + I } : k === 1 ? { x: blk.x1 - I, z: blk.z0 + I } : k === 2 ? { x: blk.x1 - I, z: blk.z1 - I } : { x: blk.x0 + I, z: blk.z1 - I };
}
const CROSS_OPTS = [ // corner -> [di, dj, targetCorner, roadAxisCrossed]
  [[-1, 0, 1, 'NS'], [0, -1, 3, 'EW']],
  [[1, 0, 0, 'NS'], [0, -1, 2, 'EW']],
  [[1, 0, 3, 'NS'], [0, 1, 1, 'EW']],
  [[-1, 0, 2, 'NS'], [0, 1, 0, 'EW']],
];
class Ped {
  constructor(x, z, opts = {}) {
    this.x = x; this.z = z; this.y = groundHeight(x, z); this.vx = 0; this.vz = 0; this.vy = 0;
    this.h = opts.h != null ? opts.h : rnd(-Math.PI, Math.PI);
    this.cop = !!opts.cop; this.car = opts.car || null;
    this.look = this.cop ? { skin: pick(PED_PAL.skin), shirt: 0x1f3a66, pants: 0x14213a, hair: pick(PED_PAL.hair), shoes: 0x111111, cap: 0x14213a, badge: true } : randomLook();
    this.H = buildHuman(this.look, true);
    Game.scene.add(this.H.root);
    this.state = 'walk'; this.stateT = 0; this.phase = Math.random() * TAU; this.speed = 0;
    this.walkSpeed = rnd(1.15, 1.6);
    this.hp = 100; this.blk = opts.blk || null; this.k = opts.k || 0; this.dir = Math.random() < 0.5 ? 1 : -1;
    this.target = opts.target || null; this.fleeX = 0; this.fleeZ = 0; this.tumble = 0; this.tumbleAx = 0;
    this.r = 0.32;
    PEDS.push(this);
  }
  dispose() {
    if (this.car && this.car.officer === this) this.car.officer = null;
    Game.scene.remove(this.H.root); disposeHuman(this.H);
    const i = PEDS.indexOf(this); if (i >= 0) PEDS.splice(i, 1);
  }
  flee(x, z, t = rnd(6, 10)) {
    if (this.state === 'down' || this.state === 'ko' || this.cop) return;
    this.state = 'flee'; this.stateT = t; this.fleeX = x; this.fleeZ = z;
  }
  knock(vx, vz, up, dmg) {
    if (this.state === 'ko') { this.vx = vx; this.vz = vz; this.vy = up * 0.5; return; }
    this.state = 'down'; this.stateT = rnd(2.6, 3.8); this.vx = vx; this.vz = vz; this.vy = up; this.y += 0.05;
    this.tumble = 0; this.tumbleAx = Math.atan2(vx, vz);
    this.hp -= dmg;
  }
  update(dt) {
    const H = this.H;
    let wantX = 0, wantZ = 0, spd = 0;
    this.stateT -= dt;
    switch (this.state) {
      case 'walk': {
        if (!this.target) this.pickTarget();
        const dx = this.target.x - this.x, dz = this.target.z - this.z, d = Math.hypot(dx, dz);
        if (d < 0.4) this.arrive();
        else { wantX = dx / d; wantZ = dz / d; spd = this.walkSpeed; }
        break;
      }
      case 'wait': {
        const opt = this.crossing;
        const other = opt[3] === 'NS' ? 'EW' : 'NS';
        if (lightState(opt[3]) === 'R' && lightState(other) === 'G' && lightTimeLeft(other) > 4) {
          this.state = 'cross'; this.target = ringCorner(World.blocks[(this.blk.j + opt[1]) * NB + this.blk.i + opt[0]], opt[2]);
        } else if (this.stateT <= 0) { this.state = 'walk'; this.target = null; }
        break;
      }
      case 'cross': {
        const dx = this.target.x - this.x, dz = this.target.z - this.z, d = Math.hypot(dx, dz);
        if (d < 0.5) {
          const o = this.crossing; this.blk = World.blocks[(this.blk.j + o[1]) * NB + this.blk.i + o[0]]; this.k = o[2];
          this.state = 'walk'; this.target = null; this.pickTarget();
        } else { wantX = dx / d; wantZ = dz / d; spd = this.walkSpeed * 1.25; }
        break;
      }
      case 'idle': if (this.stateT <= 0) { this.state = 'walk'; } break;
      case 'flee': {
        const dx = this.x - this.fleeX, dz = this.z - this.fleeZ, d = Math.hypot(dx, dz) || 1;
        wantX = dx / d; wantZ = dz / d; spd = 5.0;
        if (this.stateT <= 0) { this.state = 'return'; this.target = null; }
        break;
      }
      case 'return': {
        if (this.cop) break;
        const b = blockAt(this.x, this.z) || this.blk;
        if (b) {
          if (!this.target) { this.blk = b; let best = 0, bd = 1e9; for (let k = 0; k < 4; k++) { const c = ringCorner(b, k); const dd = dist2(c.x, c.z, this.x, this.z); if (dd < bd) { bd = dd; best = k; } } this.k = best; this.target = ringCorner(b, best); }
          const dx = this.target.x - this.x, dz = this.target.z - this.z, d = Math.hypot(dx, dz);
          if (d < 0.6) { this.state = 'walk'; this.target = null; } else { wantX = dx / d; wantZ = dz / d; spd = this.walkSpeed * 1.2; }
        }
        break;
      }
      case 'down': case 'ko': {
        this.vy -= GRAV * dt; this.y += this.vy * dt;
        const g = groundHeight(this.x, this.z);
        const air = this.y > g + 0.02;
        if (!air) { this.y = g; this.vy = 0; const f = Math.exp(-6 * dt); this.vx *= f; this.vz *= f; }
        this.x += this.vx * dt; this.z += this.vz * dt;
        this.tumble = air ? this.tumble + dt * 9 : damp(this.tumble, Math.round(this.tumble / Math.PI) * Math.PI, 10, dt);
        if (this.state === 'down' && this.stateT <= 0 && !air) {
          if (this.hp <= 0) { this.state = 'ko'; this.stateT = 1e9; }
          else { this.state = 'getup'; this.stateT = 0.7; }
        }
        break;
      }
      case 'getup': if (this.stateT <= 0) { if (this.cop) this.state = 'chase'; else this.flee(Game.playerPos().x, Game.playerPos().z); } break;
      case 'chase': {
        const p = Game.playerPos();
        if (Game.playerVehicle() || Police.wanted === 0) { this.state = 'return'; this.target = null; break; }
        const dx = p.x - this.x, dz = p.z - this.z, d = Math.hypot(dx, dz);
        if (d > 1.0) { wantX = dx / d; wantZ = dz / d; spd = d > 4 ? 5.7 : 3.2; }
        else { this.h = dampAngle(this.h, Math.atan2(dx, dz), 10, dt); }
        break;
      }
    }
    if (this.cop && this.state === 'return') {
      const c = this.car;
      if (!Game.playerVehicle() && Police.wanted > 0) this.state = 'chase';
      else if (c && !c.wrecked && !c.driver && dist2(c.x, c.z, this.x, this.z) < 140 * 140) {
        const dx = c.x - this.x, dz = c.z - this.z, d = Math.hypot(dx, dz);
        if (d < 2.6) { Police.reenter(this); return; }
        wantX = dx / d; wantZ = dz / d; spd = 5.5;
      } else { wantX = 0; wantZ = 0; spd = 0; this.noCar = true; }
    }
    // Avoid speeding cars nearby (dodge)
    if (this.state === 'walk' || this.state === 'idle' || this.state === 'wait' || this.state === 'cross') {
      const pv = Game.playerVehicle();
      if (pv && pv.speed > 7) {
        const dx = this.x - pv.x, dz = this.z - pv.z, d2 = dx * dx + dz * dz;
        if (d2 < 14 * 14) {
          const vx = pv.vx / pv.speed, vz = pv.vz / pv.speed, along = dx * vx + dz * vz, lat = dx * -vz + dz * vx;
          if (along > 0 && Math.abs(lat) < 2.6) {
            const side = lat >= 0 ? 1 : -1;
            this.vx = -vz * side * 7; this.vz = vx * side * 7;
            this.flee(pv.x, pv.z);
            this.dodgeT = 0.35;
          }
        }
      }
    }
    // Movement
    const moving = this.state !== 'down' && this.state !== 'ko' && this.state !== 'getup';
    if (moving) {
      if (this.dodgeT > 0) { this.dodgeT -= dt; }
      else {
        const tvx = wantX * spd, tvz = wantZ * spd;
        this.vx = damp(this.vx, tvx, 10, dt); this.vz = damp(this.vz, tvz, 10, dt);
      }
      this.x += this.vx * dt; this.z += this.vz * dt;
      const g = groundHeight(this.x, this.z); this.y = damp(this.y, g, 20, dt);
      staticContacts(this.x, this.z, this.r, this.y, (nx, nz, d) => { this.x += nx * d; this.z += nz * d; });
      const sp = Math.hypot(this.vx, this.vz);
      this.speed = sp;
      if (sp > 0.2) this.h = dampAngle(this.h, Math.atan2(this.vx, this.vz), 10, dt);
      this.phase += sp * dt * 3.2;
      animateHuman(H, this.phase, clamp(sp / 5, 0, 1) * 0.9 + (sp > 0.2 ? 0.25 : 0), 0);
      H.root.rotation.order = 'XYZ';
      H.root.rotation.set(0, this.h, 0);
    } else {
      this.speed = Math.hypot(this.vx, this.vz);
      animateHuman(H, 0, 0, 0);
      H.root.rotation.order = 'YXZ';
      if (this.state === 'getup') H.root.rotation.set(-(Math.max(0, this.stateT) / 0.7) * Math.PI / 2 * 0.9, this.h, 0);
      else H.root.rotation.set(-Math.PI / 2 + Math.sin(this.tumble) * 0.3, this.tumbleAx + this.tumble * 0.3, 0);
      if (H.armL) { H.armL.rotation.z = 1.2; H.armR.rotation.z = -1.2; }
    }
    H.root.position.set(this.x, this.y + (moving || this.state === 'getup' ? 0 : 0.14), this.z);
  }
  pickTarget() {
    if (!this.blk) { this.blk = blockAt(this.x, this.z); if (!this.blk) { this.target = { x: this.x + rnd(-5, 5), z: this.z + rnd(-5, 5) }; return; } }
    this.target = ringCorner(this.blk, this.k);
  }
  arrive() {
    if (!this.blk) { this.target = null; return; }
    const r = Math.random();
    if (r < 0.06) { this.state = 'idle'; this.stateT = rnd(2, 6); this.target = null; return; }
    if (r < 0.32) {
      const opts = CROSS_OPTS[this.k].filter(o => { const i = this.blk.i + o[0], j = this.blk.j + o[1]; return i >= 0 && j >= 0 && i < NB && j < NB; });
      if (opts.length) { this.crossing = pick(opts); this.state = 'wait'; this.stateT = rnd(10, 16); this.target = null; return; }
    }
    if (Math.random() < 0.08) this.dir = -this.dir;
    this.k = (this.k + this.dir + 4) % 4;
    this.target = ringCorner(this.blk, this.k);
  }
}

const PedManager = {
  target: 30, spawnCD: 0,
  spawnOne(px, pz) {
    for (let tries = 0; tries < 10; tries++) {
      const i = clamp(Math.floor(px / SP) + rndi(-2, 2), 0, NB - 1), j = clamp(Math.floor(pz / SP) + rndi(-2, 2), 0, NB - 1);
      const blk = World.blocks[j * NB + i];
      const k = rndi(0, 3), t = Math.random();
      const a = ringCorner(blk, k), b = ringCorner(blk, (k + 1) % 4);
      const x = lerp(a.x, b.x, t), z = lerp(a.z, b.z, t);
      const d = Math.hypot(x - px, z - pz);
      if (d < 45 || d > 150) continue;
      if (Traffic.visible(x, z) && d < 110) continue;
      const p = new Ped(x, z, { blk, k: (k + 1) % 4 });
      p.dir = 1;
      return p;
    }
    return null;
  },
  update(dt, px, pz) {
    for (let i = PEDS.length - 1; i >= 0; i--) {
      const p = PEDS[i];
      const d2 = dist2(p.x, p.z, px, pz);
      if ((d2 > 175 * 175 || (p.state === 'ko' && d2 > 60 * 60) || (p.noCar && d2 > 90 * 90)) && !Traffic.visible(p.x, p.z)) { p.dispose(); continue; }
      if (d2 > 260 * 260) { p.dispose(); continue; }
    }
    this.spawnCD -= dt;
    if (this.spawnCD <= 0) {
      this.spawnCD = 0.3;
      let civ = 0; for (const p of PEDS) if (!p.cop) civ++;
      if (civ < this.target) this.spawnOne(px, pz);
    }
    for (let i = PEDS.length - 1; i >= 0; i--) { const p = PEDS[i]; if (p) p.update(dt); }
  },
  scare(x, z, r) {
    for (const p of PEDS) if (!p.cop && dist2(p.x, p.z, x, z) < r * r && p.state !== 'down' && p.state !== 'ko') p.flee(x, z);
  },
};

// Vehicles vs walkers (peds + player on foot)
function collideVehicleWalker(v, w, isPlayer) {
  if (w.state === 'down' && w.y > groundHeight(w.x, w.z) + 0.4) return;
  if (Math.abs(v.y - w.y) > 1.6) return;
  const dx = w.x - v.x, dz = w.z - v.z;
  if (dx * dx + dz * dz > (v.t.L / 2 + 1) * (v.t.L / 2 + 1)) return;
  const fx = Math.sin(v.h), fz = Math.cos(v.h);
  for (let k = 0; k < 3; k++) {
    const cx = v.x + fx * v.offs[k], cz = v.z + fz * v.offs[k];
    const ddx = w.x - cx, ddz = w.z - cz, rr = v.r + w.r, d2 = ddx * ddx + ddz * ddz;
    if (d2 >= rr * rr || d2 < 1e-8) continue;
    const d = Math.sqrt(d2), nx = ddx / d, nz = ddz / d;
    const rel = (v.vx - w.vx) * nx + (v.vz - w.vz) * nz;
    const sp = v.speed;
    if (sp > 4.2 && rel > 2.5 && w.state !== 'ko') {
      const dmg = (sp - 3) * 4.2;
      if (isPlayer) Game.playerKnocked(v.vx * 0.7 + nx * 3, v.vz * 0.7 + nz * 3, 2.5 + sp * 0.12, dmg);
      else { w.knock(v.vx * 0.75 + nx * 3, v.vz * 0.75 + nz * 3, 2.5 + sp * 0.14, dmg); Game.onPedHit(v, w, sp); }
      v.vx *= 0.94; v.vz *= 0.94;
      return;
    }
    // gentle push
    w.x += nx * (rr - d); w.z += nz * (rr - d);
    if (w.state === 'ko' || w.state === 'down') { w.vx += nx * 1; w.vz += nz * 1; }
  }
}
