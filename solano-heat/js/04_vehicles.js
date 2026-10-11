// ---------- Vehicles: models, physics, collisions ----------
const VTYPES = {
  brisa: { name: 'Brisa', L: 3.9, W: 1.8, H: 1.45, wb: 2.45, wr: 0.32, maxSpeed: 40, accel: 9.5, brake: 17, grip: 13, mass: 1.0, steer: 0.62, drag: 0.0012, style: 'hatch', paints: [0xd94a3a, 0x3a7bd5, 0xf2f2ee, 0x58b368, 0xe8a33d, 0x8e7cc3, 0x2a2d33] },
  marlin: { name: 'Marlin', L: 4.7, W: 1.9, H: 1.46, wb: 2.85, wr: 0.34, maxSpeed: 46, accel: 10.5, brake: 17, grip: 13.5, mass: 1.2, steer: 0.58, drag: 0.0011, style: 'sedan', paints: [0x1e3d59, 0xbfc5cc, 0x7a1f2b, 0xf2f2ee, 0x2a2d33, 0x3d6b4f, 0xc9b28a] },
  cab: { name: 'Solano Cab', L: 4.7, W: 1.9, H: 1.46, wb: 2.85, wr: 0.34, maxSpeed: 46, accel: 10.5, brake: 17, grip: 13.5, mass: 1.2, steer: 0.58, drag: 0.0011, style: 'taxi', paints: [0xf2c230] },
  tarpon: { name: 'Tarpon GT', L: 4.5, W: 2.0, H: 1.2, wb: 2.7, wr: 0.35, maxSpeed: 64, accel: 17, brake: 21, grip: 16.5, mass: 1.1, steer: 0.55, drag: 0.0009, style: 'sports', paints: [0xf2c230, 0xe8412c, 0x16a3a3, 0xf2f2ee, 0x1b1b1f, 0xff7a1a] },
  pelican: { name: 'Pelican Van', L: 5.2, W: 2.1, H: 2.3, wb: 3.2, wr: 0.38, maxSpeed: 34, accel: 7.5, brake: 13, grip: 11.5, mass: 1.7, steer: 0.55, drag: 0.0016, style: 'van', paints: [0xf2f2ee, 0x6fa8dc, 0xe8a33d, 0x93c47d] },
  gator: { name: 'Gator Pickup', L: 5.3, W: 2.1, H: 1.85, wb: 3.3, wr: 0.42, maxSpeed: 44, accel: 10.5, brake: 15, grip: 12.5, mass: 1.6, steer: 0.56, drag: 0.0013, style: 'pickup', paints: [0x2f5d3a, 0x8a1c1c, 0x1f3550, 0xd9d2c5, 0x4a4a4a, 0xb5651d] },
  police: { name: 'Patrol Cruiser', L: 4.9, W: 2.0, H: 1.5, wb: 2.9, wr: 0.35, maxSpeed: 54, accel: 14, brake: 20, grip: 15, mass: 1.45, steer: 0.58, drag: 0.001, style: 'police', paints: [0x1b2a44] },
};
const TRAFFIC_MIX = ['brisa', 'brisa', 'marlin', 'marlin', 'marlin', 'cab', 'pelican', 'gator', 'gator', 'tarpon'];
const VEHICLES = [];
const VMAT = {};
function initVehicleMaterials() {
  VMAT.body = new THREE.MeshPhongMaterial({ vertexColors: true, specular: 0x555555, shininess: 60 });
  VMAT.head = new THREE.MeshBasicMaterial({ color: 0xd8dcdf });
  VMAT.tail = new THREE.MeshBasicMaterial({ color: 0x6a1010 });
  VMAT.brake = new THREE.MeshBasicMaterial({ color: 0xff3a30 });
  VMAT.wheel = new THREE.MeshLambertMaterial({ vertexColors: true });
  VMAT.burnt = new THREE.MeshLambertMaterial({ color: 0x1c1b1a });
  VMAT.glass = new THREE.MeshPhongMaterial({ color: 0x1a2430, specular: 0x9ab0c4, shininess: 90 });
  VMAT.beam = new THREE.MeshBasicMaterial({ map: TEX.beam, color: 0xfff1d0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -10 });
}
const VGEO = {};
const WGEO = {};
function wheelGeo(r) {
  const key = r.toFixed(2);
  if (WGEO[key]) return WGEO[key];
  const gb = new GeoBuilder();
  const rz = new THREE.Matrix4().makeRotationZ(Math.PI / 2);
  gb.merge(new THREE.CylinderGeometry(r, r, 0.26, 14), rz, [0.07, 0.07, 0.08]);
  gb.merge(new THREE.CylinderGeometry(r * 0.6, r * 0.6, 0.27, 10), rz, [0.72, 0.72, 0.75]);
  gb.box(0, 0, 0, 0.28, r * 1.15, 0.1, [0.35, 0.35, 0.38]);
  gb.box(0, 0, 0, 0.28, 0.1, r * 1.15, [0.35, 0.35, 0.38]);
  return (WGEO[key] = gb.build());
}
function vehicleGeo(type) {
  if (VGEO[type]) return VGEO[type];
  const t = VTYPES[type], L = t.L, W = t.W;
  const paint = new GeoBuilder(), det = new GeoBuilder(), glass = new GeoBuilder(), head = new GeoBuilder(), tail = new GeoBuilder();
  const dark = [0.07, 0.07, 0.08], trim = [0.18, 0.18, 0.2], white = [0.95, 0.95, 0.95];
  const M = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
  let bodyTop = 0.92, lightY = 0.72, tailY = 0.8;
  const st = t.style;
  if (st === 'hatch' || st === 'sedan' || st === 'taxi' || st === 'police') {
    bodyTop = st === 'hatch' ? 0.96 : 0.92;
    paint.merge(taperBox(W, L, W - 0.08, L - 0.3, bodyTop - 0.32, 0, 0.32), null, WHITE);
    const cabL0 = st === 'hatch' ? L * 0.56 : L * 0.5, cabL1 = cabL0 * (st === 'hatch' ? 0.72 : 0.6), cabZ = st === 'hatch' ? -L * 0.1 : -L * 0.04;
    const zo = st === 'hatch' ? -0.3 : -0.08;
    glass.merge(taperBox(W - 0.16, cabL0, W - 0.34, cabL1, t.H - bodyTop - 0.06, zo, bodyTop), M(0, 0, cabZ), WHITE);
    paint.merge(new THREE.BoxGeometry(W - 0.3, 0.07, cabL1 + 0.06), M(0, t.H - 0.03, cabZ + zo), WHITE);
    det.box(W / 2 - 0.05, bodyTop + 0.12, cabZ + cabL0 / 2 - 0.25, 0.16, 0.1, 0.18, dark);
    det.box(-W / 2 + 0.05, bodyTop + 0.12, cabZ + cabL0 / 2 - 0.25, 0.16, 0.1, 0.18, dark);
    if (st === 'taxi') {
      det.box(0, t.H + 0.14, cabZ + zo, 0.75, 0.22, 0.32, [1, 0.95, 0.6]);
      det.box(W / 2 + 0.004, 0.62, 0, 0.02, 0.09, L * 0.78, dark); det.box(-W / 2 - 0.004, 0.62, 0, 0.02, 0.09, L * 0.78, dark);
    }
    if (st === 'police') {
      det.box(W / 2 + 0.006, 0.62, 0.15, 0.02, 0.32, L * 0.42, white); det.box(-W / 2 - 0.006, 0.62, 0.15, 0.02, 0.32, L * 0.42, white);
      det.box(0, 0.58, L / 2 + 0.1, W * 0.62, 0.38, 0.08, dark);
      det.box(0, t.H + 0.05, cabZ + zo, W * 0.66, 0.06, 0.3, trim);
    }
  } else if (st === 'sports') {
    bodyTop = 0.8; lightY = 0.62; tailY = 0.7;
    paint.merge(taperBox(W, L, W - 0.12, L - 0.6, bodyTop - 0.3, -0.12, 0.3), null, WHITE);
    glass.merge(taperBox(W - 0.22, L * 0.42, W - 0.46, L * 0.2, t.H - bodyTop - 0.04, -0.22, bodyTop), M(0, 0, -0.3), WHITE);
    paint.merge(new THREE.BoxGeometry(W - 0.48, 0.05, L * 0.2 + 0.04), M(0, t.H - 0.02, -0.52), WHITE);
    paint.merge(new THREE.BoxGeometry(W - 0.15, 0.06, 0.38), M(0, 1.02, -L / 2 + 0.22), WHITE);
    det.box(0.6, 0.9, -L / 2 + 0.25, 0.08, 0.2, 0.08, dark); det.box(-0.6, 0.9, -L / 2 + 0.25, 0.08, 0.2, 0.08, dark);
    det.box(W / 2 + 0.004, 0.5, -0.4, 0.02, 0.16, 0.9, dark); det.box(-W / 2 - 0.004, 0.5, -0.4, 0.02, 0.16, 0.9, dark);
  } else if (st === 'van') {
    bodyTop = 1.15; lightY = 0.8; tailY = 1.0;
    paint.merge(new THREE.BoxGeometry(W, bodyTop - 0.34, L), M(0, (bodyTop + 0.34) / 2, 0), WHITE);
    const upL = L - 1.25;
    paint.merge(new THREE.BoxGeometry(W - 0.04, t.H - bodyTop, upL), M(0, (t.H + bodyTop) / 2, -L / 2 + upL / 2), WHITE);
    glass.merge(taperBox(W - 0.1, 1.25, W - 0.14, 0.35, t.H - bodyTop - 0.02, -0.45, bodyTop), M(0, 0, L / 2 - 0.625), WHITE);
    glass.box(W / 2 - 0.01, 1.62, L / 2 - 1.8, 0.04, 0.5, 1.0, WHITE); glass.box(-W / 2 + 0.01, 1.62, L / 2 - 1.8, 0.04, 0.5, 1.0, WHITE);
    det.box(0, 1.5, -L / 2 - 0.005, W * 0.04, 0.9, 0.02, dark);
  } else if (st === 'pickup') {
    bodyTop = 1.05; lightY = 0.86; tailY = 0.92;
    paint.merge(taperBox(W, L, W - 0.06, L - 0.2, bodyTop - 0.4, 0, 0.4), null, WHITE);
    glass.merge(taperBox(W - 0.14, 1.9, W - 0.3, 1.3, t.H - bodyTop - 0.06, -0.12, bodyTop), M(0, 0, 0.55), WHITE);
    paint.merge(new THREE.BoxGeometry(W - 0.28, 0.07, 1.36), M(0, t.H - 0.03, 0.43), WHITE);
    const bedL = 2.2, bz = -L / 2 + bedL / 2 + 0.05;
    paint.merge(new THREE.BoxGeometry(0.12, 0.45, bedL), M(W / 2 - 0.06, bodyTop + 0.22, bz), WHITE);
    paint.merge(new THREE.BoxGeometry(0.12, 0.45, bedL), M(-W / 2 + 0.06, bodyTop + 0.22, bz), WHITE);
    paint.merge(new THREE.BoxGeometry(W, 0.45, 0.12), M(0, bodyTop + 0.22, -L / 2 + 0.06), WHITE);
    det.box(0, bodyTop + 0.01, bz, W - 0.25, 0.04, bedL - 0.1, dark);
    det.box(W / 2 - 0.06, bodyTop + 0.3, 1.2, 0.16, 0.1, 0.18, dark); det.box(-W / 2 + 0.06, bodyTop + 0.3, 1.2, 0.16, 0.1, 0.18, dark);
  }
  // Common: bumpers, grille, lights
  det.box(0, 0.42, L / 2 - 0.02, W + 0.02, 0.2, 0.16, trim);
  det.box(0, 0.42, -L / 2 + 0.02, W + 0.02, 0.2, 0.16, trim);
  det.box(0, lightY - 0.04, L / 2 + 0.005, W * 0.42, 0.14, 0.03, dark);
  head.box(W / 2 - 0.3, lightY, L / 2 + 0.006, 0.38, 0.13, 0.04, WHITE);
  head.box(-W / 2 + 0.3, lightY, L / 2 + 0.006, 0.38, 0.13, 0.04, WHITE);
  tail.box(W / 2 - 0.26, tailY, -L / 2 - 0.006, 0.36, 0.14, 0.04, WHITE);
  tail.box(-W / 2 + 0.26, tailY, -L / 2 - 0.006, 0.36, 0.14, 0.04, WHITE);
  // underside shadow block
  det.box(0, 0.3, 0, W - 0.3, 0.1, L - 0.8, dark);
  // Body = paint + trim + glass + rear wheels, one vertex-coloured mesh. Paint vertices come first so they can be recoloured.
  const body = new GeoBuilder();
  const append = (src, col) => { for (let i = 0; i < src.count; i++) body.vert(src.p[i * 3], src.p[i * 3 + 1], src.p[i * 3 + 2], src.n[i * 3], src.n[i * 3 + 1], src.n[i * 3 + 2], 0, 0, col || [src.c[i * 3], src.c[i * 3 + 1], src.c[i * 3 + 2]]); };
  append(paint, WHITE);
  const paintCount = body.count;
  append(det); append(glass, [0.1, 0.14, 0.19]);
  const wg = wheelGeo(t.wr), wgb = new GeoBuilder();
  for (const sx of [1, -1]) wgb.merge(wg, new THREE.Matrix4().makeTranslation(sx * (W / 2 - 0.2), t.wr, -t.wb / 2), WHITE);
  const wcol = wg.attributes.color.array, wn = wg.attributes.position.count;
  for (let i = 0; i < wgb.count; i++) {
    const k = i % wn;
    body.vert(wgb.p[i * 3], wgb.p[i * 3 + 1], wgb.p[i * 3 + 2], wgb.n[i * 3], wgb.n[i * 3 + 1], wgb.n[i * 3 + 2], 0, 0, [wcol[k * 3], wcol[k * 3 + 1], wcol[k * 3 + 2]]);
  }
  return (VGEO[type] = { body: body.build(), paintCount, head: head.build(), tail: tail.build(), bodyTop });
}

let VEH_ID = 0;
class Vehicle {
  constructor(type, x, z, h, opts = {}) {
    this.id = ++VEH_ID; this.type = type; this.t = VTYPES[type];
    this.paint = opts.paint != null ? opts.paint : pick(this.t.paints);
    this.x = x; this.z = z; this.h = h; this.y = groundHeight(x, z); this.vy = 0; this.air = false; this.rampVy = 0; this.airT = 0; this.fromRamp = false;
    this.vx = 0; this.vz = 0; this.av = 0; this.steer = 0; this.spin = 0; this.slip = 0; this.vF = 0; this.longAcc = 0;
    this.health = 100; this.burning = false; this.burnT = 0; this.wrecked = false;
    this.input = { acc: 0, steer: 0, hb: false };
    this.driver = null; this.ai = null; this.police = type === 'police';
    this.mission = false; this.slot = null; this.pitch = 0; this.roll = 0;
    this.siren = false; this.age = 0;
    this.mass = this.t.mass; this.I = this.mass * (this.t.L * this.t.L + this.t.W * this.t.W) / 12;
    this.r = this.t.W / 2; this.cOff = this.t.L / 2 - this.r;
    this.offs = [-this.cOff, 0, this.cOff];
    this.surf = 'road';
    this.build();
    VEHICLES.push(this);
  }
  build() {
    const G = vehicleGeo(this.type);
    const root = new THREE.Group(); root.rotation.order = 'YXZ';
    const body = new THREE.Group(); root.add(body);
    this.bodyGeo = G.body.clone(); this.paintCount = G.paintCount;
    this.paintMesh = new THREE.Mesh(this.bodyGeo, VMAT.body);
    this.applyPaint();
    this.headMesh = new THREE.Mesh(G.head, VMAT.head); this.tailMesh = new THREE.Mesh(G.tail, VMAT.tail);
    body.add(this.paintMesh, this.headMesh, this.tailMesh);
    this.paintMesh.castShadow = true;
    const wg = wheelGeo(this.t.wr);
    this.wheels = [];
    for (const [sx, sz] of [[1, 1], [-1, 1]]) {
      const pivot = new THREE.Group(); pivot.position.set(sx * (this.t.W / 2 - 0.2), this.t.wr, sz * this.t.wb / 2);
      const w = new THREE.Mesh(wg, VMAT.wheel); pivot.add(w); root.add(pivot);
      this.wheels.push({ pivot, w, front: sz > 0 });
    }
    const bg = new THREE.PlaneGeometry(8, 16); bg.rotateX(-Math.PI / 2); bg.rotateY(Math.PI); bg.translate(0, 0.09, this.t.L / 2 + 7.6);
    this.beam = new THREE.Mesh(bg, VMAT.beam); this.beam.renderOrder = 3; root.add(this.beam);
    if (this.police) {
      this.barR = new THREE.MeshBasicMaterial({ color: 0x400000 }); this.barB = new THREE.MeshBasicMaterial({ color: 0x000040 });
      const bR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.26), this.barR), bB = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.26), this.barB);
      const zc = -this.t.L * 0.04 - 0.08;
      bR.position.set(0.32, this.t.H + 0.14, zc); bB.position.set(-0.32, this.t.H + 0.14, zc);
      body.add(bR, bB);
    }
    this.root = root; this.body = body;
    Game.scene.add(root);
    this.updateMesh(0);
  }
  dispose() {
    Game.scene.remove(this.root);
    this.beam.geometry.dispose(); this.bodyGeo.dispose();
    if (this.police) { this.barR.dispose(); this.barB.dispose(); }
    const i = VEHICLES.indexOf(this); if (i >= 0) VEHICLES.splice(i, 1);
    if (this.slot) { this.slot.used = false; this.slot = null; }
  }
  get speed() { return Math.hypot(this.vx, this.vz); }
  occupied() { return this.driver != null; }
  applyPaint() {
    const c = this.bodyGeo.attributes.color, a = c.array, [r, g, b] = hexRgb(this.paint);
    for (let i = 0; i < this.paintCount; i++) { a[i * 3] = r; a[i * 3 + 1] = g; a[i * 3 + 2] = b; }
    c.needsUpdate = true;
  }
  setPaint(hex) { this.paint = hex; this.applyPaint(); }
  damage(amt) {
    if (this.wrecked || amt <= 0) return;
    this.health -= amt;
    if (this.health <= 0 && !this.burning) { this.health = 0; this.burning = true; this.burnT = 5; }
  }
  repair() { this.health = 100; this.burning = false; this.burnT = 0; }
  step(dt) {
    const t = this.t;
    this.age += dt;
    const sinH = Math.sin(this.h), cosH = Math.cos(this.h);
    const fx = sinH, fz = cosH, rx = -cosH, rz = sinH;
    let vF = this.vx * fx + this.vz * fz, vR = this.vx * rx + this.vz * rz;
    const inp = this.input;
    const dead = this.health <= 0 || this.wrecked;
    const acc = dead ? 0 : clamp(inp.acc, -1, 1);
    const hb = dead ? true : inp.hb;
    const grounded = !this.air;
    this.surf = surfaceAt(this.x, this.z);
    const gripMul = this.surf === 'sand' ? 0.72 : this.surf === 'grass' ? 0.82 : 1;
    const dragMul = this.surf === 'sand' ? 2.6 : this.surf === 'grass' ? 1.8 : 1;
    const maxS = t.steer / (1 + Math.abs(vF) / 16);
    this.steer = damp(this.steer, clamp(inp.steer, -1, 1) * maxS, 7, dt);
    const vF0 = vF;
    if (grounded) {
      let a = 0;
      if (acc > 0) {
        if (vF > -0.8) a = t.accel * acc * Math.pow(clamp(1 - vF / t.maxSpeed, 0, 1), 0.65);
        else a = t.brake * acc;
      } else if (acc < 0) {
        if (vF > 0.8) a = t.brake * acc;
        else a = t.accel * 0.65 * acc * clamp(1 + vF / 13, 0, 1);
      }
      a -= vF * (0.12 + Math.abs(vF) * t.drag) * dragMul;
      let nv = vF + a * dt;
      if (acc === 0 || (acc < 0 && vF > 0.8) || (acc > 0 && vF < -0.8)) {
        // coasting / braking must not reverse direction
        const coast = acc === 0 ? (hb ? 9 : 1.6) * dt : 0;
        if (Math.sign(nv) !== Math.sign(vF) && Math.abs(vF) > 0.001 && acc === 0) nv = 0;
        if (coast > 0) nv = Math.abs(nv) <= coast ? 0 : nv - Math.sign(nv) * coast;
      } else if (hb) {
        const hbd = 7 * dt; nv = Math.abs(nv) <= hbd ? 0 : nv - Math.sign(nv) * hbd;
      }
      vF = nv;
      const grip = t.grip * gripMul * (hb ? 0.32 : 1);
      const dv = Math.min(Math.abs(vR), grip * dt);
      vR -= Math.sign(vR) * dv;
      this.slip = Math.abs(vR);
      let yawTarget = -vF / t.wb * Math.tan(this.steer) * (hb ? 1.45 : 1);
      if (!hb) { const lim = grip * 1.3 / Math.max(5, Math.abs(vF)); yawTarget = clamp(yawTarget, -lim, lim); }
      const rate = hb ? 2.6 : lerp(9, 2.2, clamp(this.slip / 7, 0, 1)) * gripMul;
      this.av = damp(this.av, yawTarget, rate, dt);
    } else {
      this.av *= Math.exp(-0.6 * dt);
      this.slip = 0;
    }
    this.longAcc = (vF - vF0) / dt;
    this.vF = vF;
    this.vx = fx * vF + rx * vR; this.vz = fz * vF + rz * vR;
    this.h = wrapAngle(this.h + this.av * dt);
    this.x += this.vx * dt; this.z += this.vz * dt;
    // vertical
    const g = groundHeight(this.x, this.z);
    if (this.air) {
      this.vy -= GRAV * dt; this.y += this.vy * dt; this.airT += dt;
      if (this.y <= g) {
        const imp = -this.vy; this.y = g; this.vy = 0; this.air = false;
        if (imp > 9) this.damage((imp - 9) * 2.2);
        this.landed = { airT: this.airT, imp, fromRamp: this.fromRamp };
        this.airT = 0; this.fromRamp = false;
      }
    } else {
      if (g < this.y - 0.12) {
        this.air = true; this.vy = clamp(this.rampVy, -2, 16); this.airT = 0;
        this.fromRamp = this.rampVy > 3;
      } else {
        const rv = (g - this.y) / dt;
        this.rampVy = rv > 0.4 && rv < 20 ? rv : 0;
        this.y = g;
      }
    }
    // pitch / roll
    if (!this.air) {
      const hw = t.wb / 2;
      let hf = groundHeight(this.x + fx * hw, this.z + fz * hw), hr = groundHeight(this.x - fx * hw, this.z - fz * hw);
      if (hf < g - 0.2) hf = g + (g - hr); // front wheel over a ledge: keep the current slope
      if (hr < g - 0.2) hr = g - (hf - g);
      this.pitch = damp(this.pitch, Math.atan2(hf - hr, t.wb), 14, dt);
    } else {
      this.pitch = damp(this.pitch, clamp(Math.atan2(this.vy, Math.max(4, Math.abs(vF))) * 0.7, -0.5, 0.5), 3, dt);
    }
    this.roll = damp(this.roll, clamp(this.av * vF * 0.0045, -0.07, 0.07), 8, dt);
    // burning
    if (this.burning && !this.wrecked) {
      this.burnT -= dt;
      if (this.burnT <= 0) Game.explodeVehicle(this);
    }
  }
  collideStatic() {
    const fx = Math.sin(this.h), fz = Math.cos(this.h);
    for (let k = 0; k < 3; k++) {
      const off = this.offs[k];
      const cx = this.x + fx * off, cz = this.z + fz * off;
      staticContacts(cx, cz, this.r, this.y, (nx, nz, d, kind, obj) => {
        if (kind === 'prop') {
          const sp = this.speed;
          if (sp > 4.5) {
            knockProp(obj, this.vx / sp, this.vz / sp, Game.scene);
            this.vx *= 0.88; this.vz *= 0.88; this.damage(2);
            Game.onVehicleHit(this, null, sp * 0.4, 'prop', cx, cz);
            return;
          }
        }
        this.x += nx * d; this.z += nz * d;
        const imp = this.collideNormal(cx, cz, nx, nz, 0.22);
        if (imp > 2.5) Game.onVehicleHit(this, null, imp, kind, cx, cz);
      });
    }
  }
  collideNormal(px, pz, nx, nz, e) {
    const rx = px - this.x, rz = pz - this.z;
    const vpx = this.vx + this.av * rz, vpz = this.vz - this.av * rx;
    const vn = vpx * nx + vpz * nz;
    if (vn >= 0) return 0;
    const k = rz * nx - rx * nz;
    const J = -(1 + e) * vn / (1 / this.mass + k * k / this.I);
    this.vx += J * nx / this.mass; this.vz += J * nz / this.mass; this.av += J * k / this.I * 0.6;
    const tx = -nz, tz = nx, vt = vpx * tx + vpz * tz;
    const jt = clamp(-vt * this.mass * 0.25, -0.35 * J, 0.35 * J);
    this.vx += jt * tx / this.mass; this.vz += jt * tz / this.mass;
    return -vn;
  }
  updateMesh(dt) {
    const r = this.root;
    r.position.set(this.x, this.y, this.z);
    r.rotation.set(-this.pitch, this.h, this.roll);
    this.body.rotation.x = clamp(this.longAcc * 0.0035, -0.045, 0.045);
    this.spin += this.vF / this.t.wr * dt;
    for (const w of this.wheels) {
      w.w.rotation.x = this.spin;
      if (w.front) w.pivot.rotation.y = -this.steer;
    }
    const night = Game.nightK;
    const lightsOn = this.driver != null && !this.wrecked && this.health > 0;
    this.beam.visible = lightsOn && night > 0.05 && dist2(this.x, this.z, Game.camX, Game.camZ) < 200 * 200;
    const braking = this.driver != null && ((this.input.acc < -0.1 && this.vF > 0.5) || this.input.hb || (this.ai && this.ai.braking));
    this.tailMesh.material = braking ? VMAT.brake : VMAT.tail;
    if (this.police) {
      const on = this.siren && Math.floor(Game.time * 6) % 2 === 0;
      this.barR.color.setHex(this.siren ? (on ? 0xff2020 : 0x300000) : 0x400000);
      this.barB.color.setHex(this.siren ? (!on ? 0x2050ff : 0x000030) : 0x000040);
    }
  }
}

function collideVehiclePair(a, b) {
  const dx = a.x - b.x, dz = a.z - b.z, R = (a.t.L + b.t.L) / 2;
  if (dx * dx + dz * dz > R * R) return;
  if (Math.abs(a.y - b.y) > 1.5) return;
  const afx = Math.sin(a.h), afz = Math.cos(a.h), bfx = Math.sin(b.h), bfz = Math.cos(b.h);
  let maxImp = 0, hx = 0, hz = 0;
  for (let i = 0; i < 3; i++) {
    const ax = a.x + afx * a.offs[i], az = a.z + afz * a.offs[i];
    for (let j = 0; j < 3; j++) {
      const bx = b.x + bfx * b.offs[j], bz = b.z + bfz * b.offs[j];
      const ddx = ax - bx, ddz = az - bz, rr = a.r + b.r, d2 = ddx * ddx + ddz * ddz;
      if (d2 >= rr * rr || d2 < 1e-8) continue;
      const d = Math.sqrt(d2), nx = ddx / d, nz = ddz / d, pen = rr - d;
      const ia = 1 / a.mass, ib = 1 / b.mass, s = pen / (ia + ib);
      a.x += nx * s * ia; a.z += nz * s * ia; b.x -= nx * s * ib; b.z -= nz * s * ib;
      const px = ax - nx * a.r, pz = az - nz * a.r;
      const rax = px - a.x, raz = pz - a.z, rbx = px - b.x, rbz = pz - b.z;
      const vax = a.vx + a.av * raz, vaz = a.vz - a.av * rax, vbx = b.vx + b.av * rbz, vbz = b.vz - b.av * rbx;
      const vn = (vax - vbx) * nx + (vaz - vbz) * nz;
      if (vn >= 0) continue;
      const ka = raz * nx - rax * nz, kb = rbz * nx - rbx * nz;
      const J = -(1.25) * vn / (ia + ib + ka * ka / a.I + kb * kb / b.I);
      a.vx += J * nx * ia; a.vz += J * nz * ia; a.av += J * ka / a.I * 0.6;
      b.vx -= J * nx * ib; b.vz -= J * nz * ib; b.av -= J * kb / b.I * 0.6;
      if (-vn > maxImp) { maxImp = -vn; hx = px; hz = pz; }
    }
  }
  if (maxImp > 2.5) { Game.onVehicleHit(a, b, maxImp, 'car', hx, hz); Game.onVehicleHit(b, a, maxImp, 'car', hx, hz); }
}
