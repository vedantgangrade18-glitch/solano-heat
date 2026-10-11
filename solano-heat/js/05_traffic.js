// ---------- Road graph, driver AI, traffic spawning ----------
function nodeOk(a, b) { return a >= 0 && b >= 0 && a <= NB && b <= NB; }
function laneStopPoint(A, B, off) { // stop line before B on lane of A->B
  const dx = Math.sign(B.a - A.a), dz = Math.sign(B.b - A.b), rx = -dz, rz = dx;
  return { x: B.a * SP - dx * STOP_DIST + rx * off, z: B.b * SP - dz * STOP_DIST + rz * off };
}
function nearestNode(x, z) { return { a: clamp(Math.round(x / SP), 0, NB), b: clamp(Math.round(z / SP), 0, NB) }; }
function distPointSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
  const t = L2 > 1e-6 ? clamp(((px - ax) * dx + (pz - az) * dz) / L2, 0, 1) : 0;
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

class DriverAI {
  constructor(v, mode = 'traffic') {
    this.v = v; this.mode = mode; this.q = [];
    this.cruise = mode === 'police' ? 30 : rnd(10.5, 14);
    this.laneOff = mode === 'police' ? 1.2 : LANE;
    this.waitT = 0; this.stuckT = 0; this.passT = 0; this.reverseT = 0; this.replanT = 0; this.lostCD = 0; this.prevWp = null;
    this.braking = false; this.pullOver = 0;
    this.target = null; // police target {x,z}
    this.initRoute();
  }
  initRoute() {
    const v = this.v, fx = Math.sin(v.h), fz = Math.cos(v.h);
    let A, B;
    if (Math.abs(fz) >= Math.abs(fx)) {
      const a = clamp(Math.round(v.x / SP), 0, NB);
      const b0 = clamp(Math.floor(v.z / SP), 0, NB - 1);
      if (fz >= 0) { A = { a, b: b0 }; B = { a, b: b0 + 1 }; } else { A = { a, b: b0 + 1 }; B = { a, b: b0 }; }
    } else {
      const b = clamp(Math.round(v.z / SP), 0, NB);
      const a0 = clamp(Math.floor(v.x / SP), 0, NB - 1);
      if (fx >= 0) { A = { a: a0, b }; B = { a: a0 + 1, b }; } else { A = { a: a0 + 1, b }; B = { a: a0, b }; }
    }
    this.A = A; this.B = B; this.q.length = 0;
    this.prevWp = { x: v.x, z: v.z };
    while (this.q.length < 8) this.appendSegment();
  }
  chooseNext(A, B) {
    const dx = Math.sign(B.a - A.a), dz = Math.sign(B.b - A.b);
    const rx = -dz, rz = dx;
    const opts = [];
    const S = { a: B.a + dx, b: B.b + dz }, Rr = { a: B.a + rx, b: B.b + rz }, Lf = { a: B.a - rx, b: B.b - rz };
    if (nodeOk(S.a, S.b)) opts.push([S, 0.55]);
    if (nodeOk(Rr.a, Rr.b)) opts.push([Rr, 0.3]);
    if (nodeOk(Lf.a, Lf.b)) opts.push([Lf, 0.15]);
    if (!opts.length) return { a: A.a, b: A.b };
    if (this.mode === 'police' && this.target) {
      const tn = nearestNode(this.target.x, this.target.z);
      let best = null, bd = 1e9;
      for (const [n] of opts) { const d = Math.abs(n.a - tn.a) + Math.abs(n.b - tn.b) + Math.random() * 0.5; if (d < bd) { bd = d; best = n; } }
      return best;
    }
    let tot = 0; for (const o of opts) tot += o[1];
    let r = Math.random() * tot;
    for (const o of opts) { r -= o[1]; if (r <= 0) return o[0]; }
    return opts[0][0];
  }
  appendSegment() {
    const A = this.A, B = this.B, C = this.chooseNext(A, B);
    const d1x = Math.sign(B.a - A.a), d1z = Math.sign(B.b - A.b), d2x = Math.sign(C.a - B.a), d2z = Math.sign(C.b - B.b);
    const r1x = -d1z, r1z = d1x, r2x = -d2z, r2z = d2x;
    const cross = d1x * d2z - d1z * d2x;
    const turn = (d1x === d2x && d1z === d2z) ? 'S' : (d1x === -d2x && d1z === -d2z) ? 'U' : (cross > 0 ? 'R' : 'L');
    const o = this.laneOff, Bx = B.a * SP, Bz = B.b * SP;
    const stop = laneStopPoint(A, B, o);
    this.q.push({ x: stop.x, z: stop.z, stop: { axis: d1x === 0 ? 'NS' : 'EW', turn, Bx, Bz, d1x, d1z } });
    const P0 = { x: Bx - d1x * HALF_ROAD + r1x * o, z: Bz - d1z * HALF_ROAD + r1z * o };
    const P2 = { x: Bx + d2x * HALF_ROAD + r2x * o, z: Bz + d2z * HALF_ROAD + r2z * o };
    if (turn === 'S') { this.q.push(P0); this.q.push(P2); }
    else if (turn === 'U') {
      this.q.push(P0); this.q.push({ x: Bx, z: Bz, slow: 4 }); this.q.push(P2);
    } else {
      const P1 = { x: Bx + r1x * o + r2x * o, z: Bz + r1z * o + r2z * o };
      this.q.push(Object.assign(P0, { slow: turn === 'R' ? 6.5 : 8 }));
      for (const t of [0.25, 0.5, 0.75, 1]) {
        const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
        this.q.push({ x: a * P0.x + b * P1.x + c * P2.x, z: a * P0.z + b * P1.z + c * P2.z, slow: turn === 'R' ? 6.5 : 8 });
      }
    }
    this.A = B; this.B = C;
  }
  update(dt) {
    const v = this.v;
    if (v.wrecked || v.health <= 0) { v.input.acc = 0; v.input.hb = true; v.input.steer = 0; return; }
    if (this.mode === 'police') return this.updatePolice(dt);
    this.drive(dt, false);
  }
  // Follow the queued lane path
  drive(dt, aggressive) {
    const v = this.v, sp = Math.max(0, v.vF);
    const fx = Math.sin(v.h), fz = Math.cos(v.h), rx = -fz, rz = fx;
    // Advance waypoints
    let guard = 0;
    while (this.q.length > 1 && guard++ < 10) {
      const p = this.q[0], dx = p.x - v.x, dz = p.z - v.z, d = Math.hypot(dx, dz), ahead = dx * fx + dz * fz;
      if (d < 2.2 || (ahead < 0.5 && d < 26)) this.prevWp = this.q.shift(); else break;
    }
    while (this.q.length < 8) this.appendSegment();
    // Lost? (well off the lane we should be following) -> replan from where we are
    this.lostCD -= dt;
    let q0 = this.q[0];
    const pw = this.prevWp || q0;
    if (this.lostCD <= 0 && (distPointSeg(v.x, v.z, pw.x, pw.z, q0.x, q0.z) > 14 || Math.hypot(q0.x - v.x, q0.z - v.z) > 110)) {
      this.lostCD = 2; this.initRoute(); q0 = this.q[0];
    }
    // Lookahead target
    const Ld = 5.5 + sp * 0.45;
    let px = v.x, pz = v.z, remain = Ld, tx = q0.x, tz = q0.z;
    for (let i = 0; i < this.q.length; i++) {
      const w = this.q[i], sx = w.x - px, sz = w.z - pz, sl = Math.hypot(sx, sz);
      if (sl >= remain) { tx = px + sx / sl * remain; tz = pz + sz / sl * remain; break; }
      remain -= sl; px = w.x; pz = w.z; tx = w.x; tz = w.z;
    }
    let lateralShift = 0;
    if (this.passT > 0) { this.passT -= dt; lateralShift = -4.2; }
    if (this.pullOver > 0) { this.pullOver -= dt; lateralShift = 2.4; }
    if (lateralShift) { tx += rx * lateralShift; tz += rz * lateralShift; }
    const ddx = tx - v.x, ddz = tz - v.z;
    const lf = ddx * fx + ddz * fz, lr = ddx * rx + ddz * rz;
    const L2 = Math.max(4, lf * lf + lr * lr);
    const curv = 2 * lr / L2;
    const steerAng = Math.atan(curv * v.t.wb);
    const maxS = v.t.steer / (1 + Math.abs(v.vF) / 16);
    v.input.steer = clamp(steerAng / maxS, -1, 1);
    // Target speed
    let vt = this.cruise;
    for (let i = 0; i < Math.min(8, this.q.length); i++) {
      const w = this.q[i];
      if (w.slow) { const sl = aggressive ? w.slow * 1.7 : w.slow, d = Math.hypot(w.x - v.x, w.z - v.z); vt = Math.min(vt, Math.sqrt(sl * sl + 2 * (aggressive ? 7 : 4) * Math.max(0, d - 2))); }
    }
    if (this.pullOver > 0) vt = Math.min(vt, 3.5);
    // Traffic lights & left-turn yield
    if (!aggressive) {
      for (let i = 0; i < Math.min(3, this.q.length); i++) {
        const w = this.q[i]; if (!w.stop) continue;
        const d = Math.hypot(w.x - v.x, w.z - v.z), free = d - v.t.L / 2 - 0.6;
        const st = lightState(w.stop.axis);
        let mustStop = st === 'R' || (st === 'Y' && free > 9);
        if (!mustStop && w.stop.turn === 'L') mustStop = this.oncoming(w.stop);
        if (!mustStop && st === 'G' && lightTimeLeft(w.stop.axis) < 1.2 && free > 14) mustStop = true;
        if (mustStop && free > -1.5) vt = Math.min(vt, free < 0.4 ? 0 : Math.sqrt(2 * 5 * free));
        break;
      }
    }
    // Obstacles ahead (vehicles, people)
    let gap = 1e9, blocker = null;
    for (const o of VEHICLES) {
      if (o === v) continue;
      const dx = o.x - v.x, dz = o.z - v.z;
      if (dx > 34 || dx < -34 || dz > 34 || dz < -34) continue;
      const f = dx * fx + dz * fz; if (f < 0 || f > 32) continue;
      const lat = dx * rx + dz * rz - lateralShift;
      if (Math.abs(lat) > (v.t.W + o.t.W) / 2 + 0.35) continue;
      const c = f - v.t.L / 2 - o.t.L / 2;
      if (c < gap) { gap = c; blocker = o; }
    }
    for (const p of Game.walkers()) {
      const dx = p.x - v.x, dz = p.z - v.z;
      if (dx > 20 || dx < -20 || dz > 20 || dz < -20) continue;
      const f = dx * fx + dz * fz; if (f < 0 || f > 16) continue;
      const lat = dx * rx + dz * rz - lateralShift;
      if (Math.abs(lat) > v.t.W / 2 + 0.9) continue;
      const c = f - v.t.L / 2 - 0.4;
      if (c < gap) { gap = c; blocker = p; }
    }
    if (aggressive && blocker && gap < 18 && this.passT <= 0) this.passT = 1.4; // pursuit: swing out and overtake
    if (gap < 1e8) vt = Math.min(vt, Math.max(0, gap - 2.2) * (aggressive ? 1.2 : 0.85));
    // Stuck behind something stationary? Pass it.
    if (blocker && gap < 9 && sp < 0.5 && blocker.speed !== undefined && blocker.speed < 0.4 && !aggressive) {
      this.waitT += dt;
      if (blocker === Game.playerVehicle() || blocker.isPlayer) { this.honk(dt); }
      if (this.waitT > 5 && this.passT <= 0) { this.passT = 5; this.waitT = 0; }
    } else if (sp > 1) this.waitT = Math.max(0, this.waitT - dt);
    // Speed control
    const err = vt - sp;
    this.braking = false;
    if (vt < 0.15 && sp < 0.6) { v.input.acc = 0; v.input.hb = true; this.braking = true; }
    else if (err > 0) { v.input.acc = clamp(err * 0.5, 0.15, 1); v.input.hb = false; }
    else { v.input.acc = clamp(err * 0.35, -1, 0); v.input.hb = false; this.braking = err < -0.6; }
    // stuck detection
    if (sp < 0.3 && vt > 2) this.stuckT += dt; else this.stuckT = 0;
    if (this.stuckT > 2.5) { this.reverseT = 1.4; this.stuckT = 0; }
    if (this.reverseT > 0) { this.reverseT -= dt; v.input.acc = -0.8; v.input.steer = -v.input.steer; v.input.hb = false; }
  }
  honk(dt) {
    this.honkCD = (this.honkCD || 0) - dt;
    if (this.honkCD <= 0) { this.honkCD = rnd(2.5, 5); Audio2.horn(this.v.x, this.v.z); }
  }
  oncoming(stop) {
    for (const o of VEHICLES) {
      if (o === this.v || o.speed < 0.5) continue;
      const rx = o.x - stop.Bx, rz = o.z - stop.Bz;
      const along = rx * stop.d1x + rz * stop.d1z; // positive = beyond junction from our view
      if (along < -4 || along > 45) continue;
      const ofx = Math.sin(o.h), ofz = Math.cos(o.h);
      if (ofx * stop.d1x + ofz * stop.d1z > -0.7) continue;
      const lat = Math.abs(rx * -stop.d1z + rz * stop.d1x);
      if (lat > 7) continue;
      return true;
    }
    return false;
  }
  updatePolice(dt) {
    const v = this.v;
    const tgt = Game.playerPos();
    this.target = tgt;
    v.siren = true;
    const dx = tgt.x - v.x, dz = tgt.z - v.z, dist = Math.hypot(dx, dz);
    const playerOnFoot = !Game.playerVehicle();
    // Stop to let the officer out
    if (playerOnFoot && dist < 24) {
      v.input.acc = 0; v.input.hb = true; v.input.steer = 0;
      if (v.speed < 2.5) Police.deployOfficer(v);
      return;
    }
    if (this.reverseT > 0) { this.reverseT -= dt; v.input.acc = -1; v.input.hb = false; v.input.steer = this.revSteer; return; }
    const direct = dist < 55 && losClear(v.x, v.z, tgt.x, tgt.z);
    if (direct) {
      const pv = Game.playerVel();
      const lead = clamp(dist / 30, 0, 1.2);
      const px = tgt.x + pv.x * lead, pz = tgt.z + pv.z * lead;
      const fx = Math.sin(v.h), fz = Math.cos(v.h), rx = -fz, rz = fx;
      const lx = (px - v.x) * fx + (pz - v.z) * fz, lr = (px - v.x) * rx + (pz - v.z) * rz;
      const ang = Math.atan2(lr, lx);
      v.input.steer = clamp(ang * 2.2, -1, 1);
      const tsp = Math.hypot(pv.x, pv.z);
      let want = dist < 9 ? Math.max(tsp * 1.05, 3) : 40;
      if (Math.abs(ang) > 1.2 && dist < 25) want = 8;
      if (tsp < 6) want = Math.min(want, Math.sqrt(2 * 12 * Math.max(0, dist - 7)) + tsp); // ease in on a slow target
      if (dist < 9 && tsp < 3) want = 0; // suspect has stopped: box them in instead of ramming
      const err = want - Math.max(0, v.vF);
      v.input.acc = err > 0 ? 1 : clamp(err * 0.3, -1, 0);
      v.input.hb = (Math.abs(ang) > 1.0 && v.speed > 14) || (want === 0 && v.speed < 1.5);
      this.q.length = 0; this.replanT = 0;
    } else {
      this.replanT -= dt;
      if (this.replanT <= 0 || this.q.length === 0) { this.replanT = 2.5; this.initRoute(); }
      this.cruise = 34;
      this.drive(dt, true);
    }
    // stuck recovery
    if (v.speed < 1.2 && v.input.acc > 0.3) this.stuckT += dt; else this.stuckT = Math.max(0, this.stuckT - dt);
    if (this.stuckT > 1.4) { this.stuckT = 0; this.reverseT = 1.3; this.revSteer = v.input.steer > 0 ? -1 : 1; }
  }
}

// ---------- Traffic manager ----------
const Traffic = {
  target: 22, parkedTarget: 12, spawnCD: 0,
  visible(x, z) {
    const cdx = x - Game.camX, cdz = z - Game.camZ, d = Math.hypot(cdx, cdz);
    if (d > 230) return false;
    if (d < 25) return true;
    const dot = (cdx * Game.camFX + cdz * Game.camFZ) / d;
    return dot > 0.45;
  },
  randomLaneSpot(px, pz, dmin, dmax) {
    for (let tries = 0; tries < 20; tries++) {
      const s = World.segs[(Math.random() * World.segs.length) | 0];
      const fwd = Math.random() < 0.5;
      const A = fwd ? { a: s.ax / SP, b: s.az / SP } : { a: s.bx / SP, b: s.bz / SP };
      const B = fwd ? { a: s.bx / SP, b: s.bz / SP } : { a: s.ax / SP, b: s.az / SP };
      const dx = Math.sign(B.a - A.a), dz = Math.sign(B.b - A.b), rx = -dz, rz = dx;
      const t = rnd(HALF_ROAD + 10, SP - STOP_DIST - 8);
      const x = A.a * SP + dx * t + rx * LANE, z = A.b * SP + dz * t + rz * LANE;
      const d = Math.hypot(x - px, z - pz);
      if (d < dmin || d > dmax) continue;
      if (this.visible(x, z)) continue;
      if (VEHICLES.some(v => dist2(v.x, v.z, x, z) < 14 * 14)) continue;
      return { x, z, h: Math.atan2(dx, dz), A, B };
    }
    return null;
  },
  spawnTraffic(px, pz) {
    const s = this.randomLaneSpot(px, pz, 110, 240);
    if (!s) return;
    const v = new Vehicle(pick(TRAFFIC_MIX), s.x, s.z, s.h);
    v.driver = 'ai'; v.ai = new DriverAI(v);
    const sp = v.ai.cruise * 0.7; v.vx = Math.sin(s.h) * sp; v.vz = Math.cos(s.h) * sp;
    v.updateMesh(0);
  },
  spawnParked(px, pz) {
    for (let tries = 0; tries < 12; tries++) {
      const slot = World.parkSlots[(Math.random() * World.parkSlots.length) | 0];
      if (slot.used) continue;
      const d = Math.hypot(slot.x - px, slot.z - pz);
      if (d < 60 || d > 190 || this.visible(slot.x, slot.z)) continue;
      if (VEHICLES.some(v => dist2(v.x, v.z, slot.x, slot.z) < 6 * 6)) continue;
      const type = pick(['brisa', 'marlin', 'marlin', 'gator', 'pelican', 'tarpon', 'brisa']);
      const v = new Vehicle(type, slot.x, slot.z, slot.h);
      v.slot = slot; slot.used = true; v.parked = true;
      return;
    }
  },
  update(dt, px, pz) {
    // Despawn
    for (let i = VEHICLES.length - 1; i >= 0; i--) {
      const v = VEHICLES[i];
      if (v === Game.playerVehicle() || v.mission || v.keep) continue;
      const d2 = dist2(v.x, v.z, px, pz);
      const far = v.police ? 260 : v.parked ? 230 : 280;
      const stale = v.wrecked && (v.wreckT || 0) > 40;
      if ((d2 > far * far && !this.visible(v.x, v.z)) || (stale && !this.visible(v.x, v.z))) v.dispose();
    }
    this.spawnCD -= dt;
    if (this.spawnCD > 0) return;
    this.spawnCD = 0.25;
    let traffic = 0, parked = 0;
    for (const v of VEHICLES) { if (v.parked && !v.driver) parked++; else if (v.driver === 'ai' && !v.police) traffic++; }
    if (traffic < this.target) this.spawnTraffic(px, pz);
    if (parked < this.parkedTarget) this.spawnParked(px, pz);
  },
  // Make traffic yield to sirens
  yieldToSirens() {
    for (const p of VEHICLES) {
      if (!p.police || !p.siren) continue;
      const pfx = Math.sin(p.h), pfz = Math.cos(p.h);
      for (const v of VEHICLES) {
        if (!v.ai || v.ai.mode !== 'traffic') continue;
        const dx = v.x - p.x, dz = v.z - p.z;
        if (dx * dx + dz * dz > 30 * 30) continue;
        const along = dx * pfx + dz * pfz;
        if (along < 0) continue;
        const vfx = Math.sin(v.h), vfz = Math.cos(v.h);
        if (vfx * pfx + vfz * pfz > 0.6) v.ai.pullOver = 2.5;
      }
    }
  },
};
