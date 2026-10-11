// ---------- Player ----------
const Player = {
  x: 0, z: 0, y: 0, vx: 0, vz: 0, vy: 0, h: 0, health: 100, car: null, state: 'foot',
  r: 0.32, isPlayer: true, punchT: 0, punchDone: false, phase: 0, downT: 0, tumble: 0, tumbleAx: 0, hurtT: 99, enterCD: 0,
  init(x, z, h) {
    this.H = buildHuman({ skin: 0xb5733f, shirt: 0xff6a4d, pants: 0x2b3a55, hair: 0x15100c, shoes: 0xf2f2ee });
    Game.scene.add(this.H.root);
    this.place(x, z, h);
  },
  place(x, z, h) {
    this.x = x; this.z = z; this.y = groundHeight(x, z); this.h = h; this.vx = this.vz = this.vy = 0;
    this.state = 'foot'; this.car = null; this.H.root.visible = true; this.downT = 0;
    this.H.root.rotation.order = 'XYZ';
    this.H.root.rotation.set(0, h, 0);
  },
  get speed() { return this.car ? this.car.speed : Math.hypot(this.vx, this.vz); },
  get onFoot() { return !this.car; },
  update(dt, ctl, camYaw) {
    this.hurtT += dt;
    if (this.hurtT > 6 && this.health < 100 && this.health > 0) this.health = Math.min(100, this.health + 4 * dt);
    this.enterCD -= dt;
    if (this.car) {
      const c = this.car;
      this.x = c.x; this.z = c.z; this.y = c.y; this.vx = c.vx; this.vz = c.vz; this.h = c.h;
      c.input.acc = ctl.accel; c.input.steer = ctl.steer; c.input.hb = ctl.hb;
      if (ctl.enterPressed && this.enterCD <= 0) this.exitVehicle();
      return;
    }
    const H = this.H;
    if (this.state === 'down') {
      this.vy -= GRAV * dt; this.y += this.vy * dt;
      const g = groundHeight(this.x, this.z), air = this.y > g + 0.02;
      if (!air) { this.y = g; this.vy = 0; const f = Math.exp(-6 * dt); this.vx *= f; this.vz *= f; }
      this.x += this.vx * dt; this.z += this.vz * dt;
      staticContacts(this.x, this.z, this.r, this.y, (nx, nz, d) => { this.x += nx * d; this.z += nz * d; const vn = this.vx * nx + this.vz * nz; if (vn < 0) { this.vx -= vn * nx * 1.3; this.vz -= vn * nz * 1.3; } });
      this.tumble = air ? this.tumble + dt * 9 : damp(this.tumble, Math.round(this.tumble / Math.PI) * Math.PI, 10, dt);
      this.downT -= dt;
      H.root.rotation.order = 'YXZ';
      H.root.rotation.set(-Math.PI / 2 + Math.sin(this.tumble) * 0.3, this.tumbleAx, 0);
      H.root.position.set(this.x, this.y + 0.14, this.z);
      animateHuman(H, 0, 0, 0); H.armL.rotation.z = 1.1; H.armR.rotation.z = -1.1;
      if (this.downT <= 0 && !air) { this.state = 'getup'; this.downT = 0.6; }
      return;
    }
    if (this.state === 'getup') {
      this.downT -= dt;
      H.root.rotation.order = 'YXZ';
      H.root.rotation.set(-(Math.max(0, this.downT) / 0.6) * Math.PI / 2 * 0.9, this.h, 0);
      H.root.position.set(this.x, this.y, this.z);
      if (this.downT <= 0) this.state = 'foot';
      return;
    }
    // Movement relative to camera
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw), rx = -fz, rz = fx;
    let mx = ctl.moveX, my = ctl.moveY;
    const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
    const dirX = fx * my + rx * mx, dirZ = fz * my + rz * mx;
    const spd = (ctl.sprint ? 6.6 : 3.3) * Math.min(1, ml);
    const ground = groundHeight(this.x, this.z);
    const onGround = this.y <= ground + 0.03;
    const accel = onGround ? 12 : 2.5;
    this.vx = damp(this.vx, dirX * spd, accel, dt); this.vz = damp(this.vz, dirZ * spd, accel, dt);
    if (onGround && ctl.jumpPressed) { this.vy = 6.0; Audio2.blip(180, 0.05, 'triangle', 0.06); }
    if (!onGround || this.vy > 0) { this.vy -= GRAV * dt; this.y += this.vy * dt; if (this.y < ground) { this.y = ground; this.vy = 0; } }
    else { this.y = damp(this.y, ground, 25, dt); this.vy = 0; }
    this.x += this.vx * dt; this.z += this.vz * dt;
    staticContacts(this.x, this.z, this.r, this.y, (nx, nz, d) => { this.x += nx * d; this.z += nz * d; });
    for (const v of VEHICLES) {
      const dx = this.x - v.x, dz = this.z - v.z; if (dx * dx + dz * dz > 16) continue;
      if (this.y > v.y + v.t.H - 0.2) continue;
      const vfx = Math.sin(v.h), vfz = Math.cos(v.h);
      for (let k = 0; k < 3; k++) {
        const cx = v.x + vfx * v.offs[k], cz = v.z + vfz * v.offs[k], ddx = this.x - cx, ddz = this.z - cz, rr = v.r + this.r, d2 = ddx * ddx + ddz * ddz;
        if (d2 < rr * rr && d2 > 1e-8) { const d = Math.sqrt(d2); this.x += ddx / d * (rr - d); this.z += ddz / d * (rr - d); }
      }
    }
    const sp = Math.hypot(this.vx, this.vz);
    if (sp > 0.3) this.h = dampAngle(this.h, Math.atan2(this.vx, this.vz), 12, dt);
    // Punch
    if (ctl.attackPressed && this.punchT <= 0) { this.punchT = 0.38; this.punchDone = false; }
    if (this.punchT > 0) {
      this.punchT -= dt;
      if (!this.punchDone && this.punchT < 0.22) { this.punchDone = true; this.doPunch(); }
    }
    if (ctl.enterPressed && this.enterCD <= 0) this.tryEnter();
    this.phase += sp * dt * 3.0;
    animateHuman(H, this.phase, clamp(sp / 6, 0, 1) * 0.95 + (sp > 0.3 ? 0.2 : 0), this.punchT > 0 ? 1 - this.punchT / 0.38 : 0);
    H.root.rotation.order = 'XYZ';
    H.root.rotation.set(0, this.h, 0);
    H.root.position.set(this.x, this.y, this.z);
  },
  doPunch() {
    const fx = Math.sin(this.h), fz = Math.cos(this.h);
    let hit = false;
    Audio2.whoosh();
    for (const p of PEDS) {
      if (p.state === 'ko') continue;
      const dx = p.x - this.x, dz = p.z - this.z, d = Math.hypot(dx, dz);
      if (d > 1.5 || (dx * fx + dz * fz) / (d || 1) < 0.45) continue;
      p.knock(fx * 3.5, fz * 3.5, 2.2, p.cop ? 20 : 40);
      hit = true;
      Audio2.punch();
      Police.crime(p.cop ? 'hitCop' : 'punch', this.x, this.z);
      PedManager.scare(this.x, this.z, 18);
      break;
    }
    if (!hit) {
      for (const v of VEHICLES) {
        const dx = v.x - this.x, dz = v.z - this.z; if (dx * dx + dz * dz > 9) continue;
        if (Math.hypot(dx, dz) < v.t.L / 2 + 0.9) { Audio2.thud(0.3); v.damage(1); break; }
      }
    }
  },
  nearestEnterable() {
    let best = null, bd = 1e9;
    for (const v of VEHICLES) {
      if (v.wrecked || v.burning) continue;
      const d = Math.hypot(v.x - this.x, v.z - this.z);
      if (d < v.t.L / 2 + 1.8 && d < bd && Math.abs(v.y - this.y) < 1.5) { bd = d; best = v; }
    }
    return best;
  },
  tryEnter() {
    const v = this.nearestEnterable();
    if (!v) return;
    this.enterCD = 0.5;
    const lx = Math.cos(v.h), lz = -Math.sin(v.h);
    if (v.driver === 'ai' || v.driver === 'police') {
      const ped = new Ped(v.x + lx * (v.t.W / 2 + 0.6), v.z + lz * (v.t.W / 2 + 0.6), { cop: v.police, car: null });
      if (v.police) { ped.state = 'chase'; Police.crime('stealCopCar', this.x, this.z); }
      else { ped.knock(lx * 2.5, lz * 2.5, 1.8, 0); ped.stateT = 1.2; Police.crime('carjack', this.x, this.z); }
      Audio2.thud(0.4);
    } else if (v.police) Police.crime('stealCopCar', this.x, this.z);
    else if (!v.mission) Police.crime('steal', this.x, this.z);
    v.driver = 'player'; v.ai = null; v.siren = false; v.parked = false; v.keep = false;
    if (v.slot) { v.slot.used = false; v.slot = null; }
    if (v.officer) { v.officer.car = null; v.officer = null; }
    v.input.acc = 0; v.input.hb = false;
    this.car = v; this.state = 'car'; this.H.root.visible = false;
    Audio2.door();
    Game.onEnterVehicle(v);
  },
  exitVehicle() {
    const v = this.car; if (!v) return;
    const lx = Math.cos(v.h), lz = -Math.sin(v.h), off = v.t.W / 2 + 0.65;
    const fx = Math.sin(v.h), fz = Math.cos(v.h);
    const cands = [[lx * off, lz * off], [-lx * off, -lz * off], [fx * (v.t.L / 2 + 0.8), fz * (v.t.L / 2 + 0.8)], [-fx * (v.t.L / 2 + 0.8), -fz * (v.t.L / 2 + 0.8)]];
    let pos = null;
    for (const [ox, oz] of cands) { if (!pointBlocked(v.x + ox, v.z + oz, 0.35)) { pos = [v.x + ox, v.z + oz]; break; } }
    if (!pos) pos = [v.x + cands[0][0], v.z + cands[0][1]];
    const sp = v.speed;
    v.driver = null; v.input.acc = 0; v.input.steer = 0; v.input.hb = sp < 6;
    this.car = null; this.enterCD = 0.5;
    this.x = pos[0]; this.z = pos[1]; this.y = groundHeight(pos[0], pos[1]); this.h = v.h;
    this.H.root.visible = true;
    if (sp > 9) { this.state = 'foot'; Game.playerKnocked(v.vx * 0.55, v.vz * 0.55, 2.5, 4); }
    else { this.state = 'foot'; this.vx = 0; this.vz = 0; }
    Audio2.door();
    Game.onExitVehicle(v);
  },
  knock(vx, vz, up, dmg) {
    if (this.car) return;
    this.state = 'down'; this.downT = 1.6; this.vx = vx; this.vz = vz; this.vy = up; this.y += 0.05;
    this.tumble = 0; this.tumbleAx = Math.atan2(vx, vz);
    this.hurt(dmg);
  },
  hurt(dmg) {
    if (dmg <= 0) return;
    this.health -= dmg; this.hurtT = 0;
    Hud.flashDamage();
    if (this.health <= 0) { this.health = 0; Game.hospitalize(); }
  },
};
