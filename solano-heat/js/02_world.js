// ---------- Port Solano: procedural city ----------
const World = {
  blocks: [], buildings: [], boxes: [], circles: [], props: [], ramps: [], bounds: [],
  poi: {}, parkSlots: [], segs: [], grid: new Map(), cgrid: new Map(), pgrid: new Map(),
  pier: null, platform: null, anim: { pools: [] }, debris: [], tapes: [],
};
const MAT = {};
const CELL = 24;
function cellKey(cx, cz) { return (cx + 512) * 4096 + (cz + 512); }
function gridAdd(grid, x0, z0, x1, z1, idx) {
  const cx0 = Math.floor(x0 / CELL), cx1 = Math.floor(x1 / CELL), cz0 = Math.floor(z0 / CELL), cz1 = Math.floor(z1 / CELL);
  for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) {
    const k = cellKey(cx, cz); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(idx);
  }
}
let _qstamp = 1;
const _boxStamp = [], _circStamp = [], _propStamp = [];
const _qa = [], _qb = [];
function queryGrid(grid, stamp, x, z, r, out) {
  out.length = 0; _qstamp++;
  const cx0 = Math.floor((x - r) / CELL), cx1 = Math.floor((x + r) / CELL), cz0 = Math.floor((z - r) / CELL), cz1 = Math.floor((z + r) / CELL);
  for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) {
    const a = grid.get(cellKey(cx, cz)); if (!a) continue;
    for (let i = 0; i < a.length; i++) { const id = a[i]; if (stamp[id] !== _qstamp) { stamp[id] = _qstamp; out.push(id); } }
  }
  return out;
}
function addBox(x0, z0, x1, z1, h) {
  const b = { x0, z0, x1, z1, h }; World.boxes.push(b);
  gridAdd(World.grid, x0, z0, x1, z1, World.boxes.length - 1);
  return b;
}
function addCircle(x, z, r) { World.circles.push({ x, z, r }); gridAdd(World.cgrid, x - r, z - r, x + r, z + r, World.circles.length - 1); }
function addProp(p) { World.props.push(p); gridAdd(World.pgrid, p.x - p.r, p.z - p.r, p.x + p.r, p.z + p.r, World.props.length - 1); }

// Circle vs AABB contact. Returns true and fills out {nx,nz,d}.
function circleBox(px, pz, r, b, out) {
  const cx = clamp(px, b.x0, b.x1), cz = clamp(pz, b.z0, b.z1);
  const dx = px - cx, dz = pz - cz, d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return false;
  if (d2 > 1e-9) { const d = Math.sqrt(d2); out.nx = dx / d; out.nz = dz / d; out.d = r - d; }
  else {
    const l = px - b.x0, rr = b.x1 - px, t = pz - b.z0, bt = b.z1 - pz, m = Math.min(l, rr, t, bt);
    if (m === l) { out.nx = -1; out.nz = 0; out.d = l + r; }
    else if (m === rr) { out.nx = 1; out.nz = 0; out.d = rr + r; }
    else if (m === t) { out.nx = 0; out.nz = -1; out.d = t + r; }
    else { out.nx = 0; out.nz = 1; out.d = bt + r; }
  }
  return true;
}
// Collect static contacts for a circle at height y. cb(nx,nz,d,kind,obj)
const _ct = { nx: 0, nz: 0, d: 0 };
function staticContacts(x, z, r, y, cb) {
  queryGrid(World.grid, _boxStamp, x, z, r, _qa);
  for (let i = 0; i < _qa.length; i++) {
    const b = World.boxes[_qa[i]];
    if (y > b.h - 0.25 || (b.ramp && y > 0.3)) continue;
    if (circleBox(x, z, r, b, _ct)) cb(_ct.nx, _ct.nz, _ct.d, 'box', b);
  }
  for (let i = 0; i < World.bounds.length; i++) {
    const b = World.bounds[i];
    if (circleBox(x, z, r, b, _ct)) cb(_ct.nx, _ct.nz, _ct.d, 'bound', b);
  }
  queryGrid(World.cgrid, _circStamp, x, z, r, _qa);
  for (let i = 0; i < _qa.length; i++) {
    const c = World.circles[_qa[i]];
    if (y > 3) continue;
    const dx = x - c.x, dz = z - c.z, rr = r + c.r, d2 = dx * dx + dz * dz;
    if (d2 < rr * rr && d2 > 1e-9) { const d = Math.sqrt(d2); cb(dx / d, dz / d, rr - d, 'tree', c); }
  }
  queryGrid(World.pgrid, _propStamp, x, z, r, _qa);
  for (let i = 0; i < _qa.length; i++) {
    const p = World.props[_qa[i]];
    if (!p.alive || y > 4) continue;
    const dx = x - p.x, dz = z - p.z, rr = r + p.r, d2 = dx * dx + dz * dz;
    if (d2 < rr * rr && d2 > 1e-9) { const d = Math.sqrt(d2); cb(dx / d, dz / d, rr - d, 'prop', p); }
  }
}
function pointInBuilding(x, z, minH = 4) {
  queryGrid(World.grid, _boxStamp, x, z, 0, _qb);
  for (let i = 0; i < _qb.length; i++) {
    const b = World.boxes[_qb[i]];
    if (b.h > minH && x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return true;
  }
  return false;
}
function pointBlocked(x, z, r = 0.5) {
  let hit = false;
  staticContacts(x, z, r, 0, () => { hit = true; });
  return hit;
}
function losClear(ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz), n = Math.ceil(L / 3);
  for (let i = 1; i < n; i++) { const t = i / n; if (pointInBuilding(ax + dx * t, az + dz * t, 5)) return false; }
  return true;
}
function segAabb(ax, ay, az, dx, dy, dz, x0, y0, z0, x1, y1, z1) {
  let tmin = 0, tmax = 1;
  const o = [ax, ay, az], d = [dx, dy, dz], lo = [x0, y0, z0], hi = [x1, y1, z1];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) { if (o[i] < lo[i] || o[i] > hi[i]) return 1; }
    else {
      let t1 = (lo[i] - o[i]) / d[i], t2 = (hi[i] - o[i]) / d[i];
      if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; }
      if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return 1;
    }
  }
  return tmin;
}
function rayBuildings(ax, ay, az, bx, by, bz) {
  const mx = (ax + bx) / 2, mz = (az + bz) / 2, r = Math.hypot(bx - ax, bz - az) / 2 + 1;
  queryGrid(World.grid, _boxStamp, mx, mz, r, _qa);
  let best = 1;
  for (let i = 0; i < _qa.length; i++) {
    const b = World.boxes[_qa[i]];
    if (b.h < 2.5) continue;
    const t = segAabb(ax, ay, az, bx - ax, by - ay, bz - az, b.x0 - 0.35, -1, b.z0 - 0.35, b.x1 + 0.35, b.h + 0.4, b.z1 + 0.35);
    if (t < best) best = t;
  }
  return best;
}
function inRect(x, z, r) { return x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1; }
function groundHeight(x, z) {
  for (let i = 0; i < World.ramps.length; i++) {
    const r = World.ramps[i];
    if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) {
      let t;
      if (r.axis === 'z') t = r.dir > 0 ? (z - r.z0) / (r.z1 - r.z0) : (r.z1 - z) / (r.z1 - r.z0);
      else t = r.dir > 0 ? (x - r.x0) / (r.x1 - r.x0) : (r.x1 - x) / (r.x1 - r.x0);
      return t * r.h;
    }
  }
  if (World.pier && (inRect(x, z, World.pier) || inRect(x, z, World.platform))) return World.pier.y;
  const i = Math.floor(x / SP), j = Math.floor(z / SP);
  if (i >= 0 && i < NB && j >= 0 && j < NB) {
    const lx = x - i * SP, lz = z - j * SP;
    if (lx > HALF_ROAD && lx < SP - HALF_ROAD && lz > HALF_ROAD && lz < SP - HALF_ROAD) return CURB;
  }
  return 0;
}
function surfaceAt(x, z) {
  if (World.pier && (inRect(x, z, World.pier) || inRect(x, z, World.platform))) return 'wood';
  if (x > BEACH_X0 + 1) return 'sand';
  if (x < -HALF_ROAD - 1 || z < -HALF_ROAD - 1) return 'grass';
  return 'road';
}
function blockAt(x, z) {
  const i = Math.floor(x / SP), j = Math.floor(z / SP);
  if (i < 0 || j < 0 || i >= NB || j >= NB) return null;
  const lx = x - i * SP, lz = z - j * SP;
  if (lx > HALF_ROAD && lx < SP - HALF_ROAD && lz > HALF_ROAD && lz < SP - HALF_ROAD) return World.blocks[j * NB + i];
  return null;
}
function districtName(x, z) {
  if (x > BEACH_X0) return 'Coral Beach';
  if (z > WORLD_MAX + HALF_ROAD) return 'Port District';
  if (x < -HALF_ROAD || z < -HALF_ROAD) return 'Mangrove Flats';
  const i = clamp(Math.floor(x / SP), 0, NB - 1), j = clamp(Math.floor(z / SP), 0, NB - 1);
  return { beach: 'Coral Beach', port: 'Port District', park: 'Bayfront Park', downtown: 'Downtown', residential: 'Palmetto Heights', midtown: 'Midtown' }[districtOf(i, j)];
}
function districtOf(i, j) {
  if (i === NB - 1) return 'beach';
  if (j >= NB - 2) return 'port';
  if ((i === 2 || i === 3) && j === 5) return 'park';
  if (i >= 4 && i <= 6 && j >= 3 && j <= 5) return 'downtown';
  if (i <= 2 && j <= 7) return 'residential';
  if (i === 3 && j <= 3) return 'residential';
  return 'midtown';
}

// Traffic light phases: shared by every junction. NS = travel along z.
const LIGHT_CYCLE = 24;
let lightClock = 0;
function lightState(axis) {
  const t = lightClock % LIGHT_CYCLE;
  if (axis === 'NS') return t < 9 ? 'G' : t < 11 ? 'Y' : 'R';
  return t < 12 ? 'R' : t < 21 ? 'G' : t < 23 ? 'Y' : 'R';
}
function lightTimeLeft(axis) { // seconds of green remaining (0 if not green)
  const t = lightClock % LIGHT_CYCLE;
  if (axis === 'NS') return t < 9 ? 9 - t : 0;
  return t >= 12 && t < 21 ? 21 - t : 0;
}

// ---------- Build ----------
const PASTELS = [0xf4b6c2, 0xa8e6cf, 0xfdf0a6, 0xffcfa8, 0xa7d8f0, 0xd8c4f0, 0xffffff, 0xf7d6b5, 0xb9f0e6];
const OFFICE_TINTS = [0xffffff, 0xf0e6d6, 0xdcdcdc, 0xe8dccb, 0xd5dde4, 0xcfc6b8];
const GLASS_TINTS = [0xffffff, 0xcfe8ff, 0xd8f5ee, 0xf5e3c8, 0xdcd6f5, 0xbfd8e8];
const WARE_TINTS = [0x9fb0c0, 0xc0745a, 0xd8c8a0, 0xe8e8e8, 0x7fb8b0, 0xb8a080];
const ROOF_TILES = [0xb5563a, 0x5d6670, 0xc9a46b, 0x8a4a36, 0x6f7f6a];
const WHITE = [1, 1, 1];

function buildWorld(scene) {
  buildMaterials();
  const F = { office: new GeoBuilder(), glass: new GeoBuilder(), stucco: new GeoBuilder(), warehouse: new GeoBuilder() };
  const roofGB = new GeoBuilder(), plainGB = new GeoBuilder(), neonGB = new GeoBuilder(), signGB = new GeoBuilder(), adGB = new GeoBuilder();
  const slabGB = new GeoBuilder(), grassGB = new GeoBuilder(), concreteGB = new GeoBuilder(), poolGB = new GeoBuilder(), pathGB = new GeoBuilder();
  const palms = [], trees = [];
  const reserved = [];

  const addBuilding = (x0, z0, x1, z1, h, style, colHex, opt = {}) => {
    const col = hexRgb(colHex);
    F[style].walls(x0, z0, x1, z1, 0, h, 32, 28, sri(0, 7) * 0.125, col);
    if (!opt.noRoof) { const g = sr(0.5, 0.68); roofGB.top(x0, z0, x1, z1, h, [g, g, g * 0.97], 8); }
    const b = addBox(x0, z0, x1, z1, h + (opt.extraH || 0));
    World.buildings.push({ x0, z0, x1, z1, h, style });
    return b;
  };
  const roofJunk = (x0, z0, x1, z1, h) => {
    const n = sri(1, 4);
    for (let k = 0; k < n; k++) {
      const sx = sr(1.5, 4), sz = sr(1.5, 4);
      if (x1 - x0 < sx + 2 || z1 - z0 < sz + 2) continue;
      const cx = sr(x0 + sx / 2 + 1, x1 - sx / 2 - 1), cz = sr(z0 + sz / 2 + 1, z1 - sz / 2 - 1), sy = sr(1, 2.4);
      roofGB.box(cx, h + sy / 2, cz, sx, sy, sz, [0.7, 0.7, 0.68]);
    }
    if (srng() < 0.3 && x1 - x0 > 10) { // water tank
      const cx = sr(x0 + 3, x1 - 3), cz = sr(z0 + 3, z1 - 3);
      const m = new THREE.Matrix4().makeTranslation(cx, h + 3.2, cz);
      plainGB.merge(new THREE.CylinderGeometry(1.6, 1.6, 2.6, 10), m, hexRgb(0x8a6a4a));
      for (const [ox, oz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) plainGB.box(cx + ox, h + 1, cz + oz, 0.2, 2, 0.2, [0.3, 0.3, 0.3]);
    }
  };
  const addSign = (b, face, y, w, h, idx) => {
    const [u0, v0, u1, v1] = signUV(idx), uv = [u0, v0, u1, v0, u1, v1, u0, v1], o = 0.1;
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    if (face === 'E') { const x = b.x1 + o; signGB.quad([x, y, cz + w / 2], [x, y, cz - w / 2], [x, y + h, cz - w / 2], [x, y + h, cz + w / 2], [1, 0, 0], uv, WHITE); }
    if (face === 'W') { const x = b.x0 - o; signGB.quad([x, y, cz - w / 2], [x, y, cz + w / 2], [x, y + h, cz + w / 2], [x, y + h, cz - w / 2], [-1, 0, 0], uv, WHITE); }
    if (face === 'S') { const z = b.z1 + o; signGB.quad([cx - w / 2, y, z], [cx + w / 2, y, z], [cx + w / 2, y + h, z], [cx - w / 2, y + h, z], [0, 0, 1], uv, WHITE); }
    if (face === 'N') { const z = b.z0 - o; signGB.quad([cx + w / 2, y, z], [cx - w / 2, y, z], [cx - w / 2, y + h, z], [cx + w / 2, y + h, z], [0, 0, -1], uv, WHITE); }
  };
  const addBillboard = (x0, z0, x1, z1, h, idx) => {
    const [u0, v0, u1, v1] = adUV(idx), uv = [u0, v0, u1, v0, u1, v1, u0, v1];
    const W = 12, H = 6, y = h + 3;
    if (srng() < 0.5) {
      const cx = (x0 + x1) / 2, z = z0 + 2;
      adGB.quad([cx - W / 2, y, z], [cx + W / 2, y, z], [cx + W / 2, y + H, z], [cx - W / 2, y + H, z], [0, 0, 1], uv, WHITE);
      plainGB.box(cx, y + H / 2, z - 0.25, W + 0.4, H + 0.4, 0.4, [0.18, 0.18, 0.2]);
      plainGB.box(cx - 4, h + 1.5, z - 0.3, 0.3, 3, 0.3, [0.25, 0.25, 0.25]); plainGB.box(cx + 4, h + 1.5, z - 0.3, 0.3, 3, 0.3, [0.25, 0.25, 0.25]);
    } else {
      const cz = (z0 + z1) / 2, x = x1 - 2;
      adGB.quad([x, y, cz + W / 2], [x, y, cz - W / 2], [x, y + H, cz - W / 2], [x, y + H, cz + W / 2], [1, 0, 0], uv, WHITE);
      plainGB.box(x - 0.25, y + H / 2, cz, 0.4, H + 0.4, W + 0.4, [0.18, 0.18, 0.2]);
      plainGB.box(x - 0.3, h + 1.5, cz - 4, 0.3, 3, 0.3, [0.25, 0.25, 0.25]); plainGB.box(x - 0.3, h + 1.5, cz + 4, 0.3, 3, 0.3, [0.25, 0.25, 0.25]);
    }
  };
  const neonStrip = (b, face, y, colHex) => {
    const c = hexRgb(colHex), t = 0.25;
    if (face === 'E') neonGB.box(b.x1 + 0.15, y, (b.z0 + b.z1) / 2, t, t, b.z1 - b.z0 - 1, c);
    if (face === 'W') neonGB.box(b.x0 - 0.15, y, (b.z0 + b.z1) / 2, t, t, b.z1 - b.z0 - 1, c);
    if (face === 'N') neonGB.box((b.x0 + b.x1) / 2, y, b.z0 - 0.15, b.x1 - b.x0 - 1, t, t, c);
    if (face === 'S') neonGB.box((b.x0 + b.x1) / 2, y, b.z1 + 0.15, b.x1 - b.x0 - 1, t, t, c);
  };
  const pitchedRoof = (x0, z0, x1, z1, y, rh, roofCol, wallCol) => {
    const o = 0.5, U = [0, 0, 1, 0, 1, 1, 0, 1];
    if (x1 - x0 >= z1 - z0) {
      const zm = (z0 + z1) / 2, X0 = x0 - o, X1 = x1 + o, Z0 = z0 - o, Z1 = z1 + o, dz = zm - Z0, L = Math.hypot(dz, rh);
      plainGB.quad([X1, y, Z0], [X0, y, Z0], [X0, y + rh, zm], [X1, y + rh, zm], [0, dz / L, -rh / L], U, roofCol);
      plainGB.quad([X0, y, Z1], [X1, y, Z1], [X1, y + rh, zm], [X0, y + rh, zm], [0, dz / L, rh / L], U, roofCol);
      tri(plainGB, [x1, y, z1], [x1, y, z0], [x1, y + rh, zm], [1, 0, 0], wallCol);
      tri(plainGB, [x0, y, z0], [x0, y, z1], [x0, y + rh, zm], [-1, 0, 0], wallCol);
    } else {
      const xm = (x0 + x1) / 2, X0 = x0 - o, X1 = x1 + o, Z0 = z0 - o, Z1 = z1 + o, dx = X1 - xm, L = Math.hypot(dx, rh);
      plainGB.quad([X1, y, Z1], [X1, y, Z0], [xm, y + rh, Z0], [xm, y + rh, Z1], [rh / L, dx / L, 0], U, roofCol);
      plainGB.quad([X0, y, Z0], [X0, y, Z1], [xm, y + rh, Z1], [xm, y + rh, Z0], [-rh / L, dx / L, 0], U, roofCol);
      tri(plainGB, [x0, y, z1], [x1, y, z1], [xm, y + rh, z1], [0, 0, 1], wallCol);
      tri(plainGB, [x1, y, z0], [x0, y, z0], [xm, y + rh, z0], [0, 0, -1], wallCol);
    }
  };
  const overlapsReserved = (x0, z0, x1, z1) => reserved.some(r => x0 < r.x1 && x1 > r.x0 && z0 < r.z1 && z1 > r.z0);
  const sidewalkTreeLine = (blk, kind, spacing) => {
    const ins = 1.3, { x0, z0, x1, z1 } = blk;
    const edges = [[x0 + ins, z0 + ins, x1 - ins, z0 + ins], [x1 - ins, z0 + ins, x1 - ins, z1 - ins], [x1 - ins, z1 - ins, x0 + ins, z1 - ins], [x0 + ins, z1 - ins, x0 + ins, z0 + ins]];
    for (const [ax, az, bx, bz] of edges) {
      const L = Math.hypot(bx - ax, bz - az);
      for (let s = 10; s < L - 10; s += spacing) {
        const x = ax + (bx - ax) * s / L, z = az + (bz - az) * s / L;
        if (kind === 'palm') palms.push({ x, z, h: sr(7, 11), tilt: sr(0, 0.12), rot: sr(0, TAU) });
        else trees.push({ x, z, h: sr(2.4, 3.4), r: sr(2.2, 3.2), c: spick([0x4f8a3a, 0x5c9a40, 0x3f7a35, 0x6aa548]) });
      }
    }
  };

  // ---- Special lots (reserved before generic generation) ----
  const R = (i, j) => blockRect(i, j);
  const specials = [];
  { const b = R(8, 4); const rect = { x0: b.x0 + 5, z0: b.z0 + 6, x1: b.x0 + 21, z1: b.z0 + 22 }; reserved.push(rect); specials.push(() => {
      const bb = addBuilding(rect.x0, rect.z0, rect.x1, rect.z1, 5.5, 'stucco', 0xf2c14e); addSign(bb, 'W', 3.6, 10, 2.5, 6); neonStrip(bb, 'W', 5.3, 0xffd84a);
      plainGB.box(rect.x0 - 1.2, 3.2, (rect.z0 + rect.z1) / 2, 2.4, 0.2, 12, hexRgb(0x2f8f6f)); // awning
    });
    World.poi.bodega = { x: b.x0 + 2.2, z: b.z0 + 14, h: -Math.PI / 2 };
    World.poi.spawn = { x: b.x0 + 2.4, z: b.z0 + 27, h: Math.PI }; }
  { const b = R(6, 6); const rect = { x0: b.x0 + 6, z0: b.z0 + 6, x1: b.x0 + 70, z1: b.z0 + 40 }; reserved.push(rect); specials.push(() => {
      const bb = addBuilding(rect.x0, rect.z0, rect.x1, rect.z1, 17.5, 'office', 0xb7c6d6); addSign(bb, 'W', 11, 16, 4, 9); neonStrip(bb, 'W', 17.2, 0x5f9dff); roofJunk(rect.x0, rect.z0, rect.x1, rect.z1, 17.5);
    }); World.poi.police = { x: b.x0 + 2.5, z: b.z0 + 24, h: -Math.PI / 2 }; }
  { const b = R(3, 7); const rect = { x0: b.x0 + 8, z0: b.z0 + 6, x1: b.x0 + 68, z1: b.z0 + 48 }; reserved.push(rect); specials.push(() => {
      const bb = addBuilding(rect.x0, rect.z0, rect.x1, rect.z1, 24.5, 'office', 0xffffff); addSign(bb, 'N', 17, 20, 5, 8); roofJunk(rect.x0, rect.z0, rect.x1, rect.z1, 24.5);
      plainGB.box((rect.x0 + rect.x1) / 2, 24.6, (rect.z0 + rect.z1) / 2, 14, 0.1, 14, hexRgb(0xdddddd)); // helipad
    }); World.poi.hospital = { x: b.x0 + 38, z: b.z0 + 2.5, h: Math.PI }; }
  World.poi.spray = [];
  { const b = R(7, 1); const rect = { x0: b.x0 + 50, z0: b.z0 + 6, x1: b.x0 + 70, z1: b.z0 + 26 }; reserved.push(rect); specials.push(() => {
      const bb = addBuilding(rect.x0, rect.z0, rect.x1, rect.z1, 7, 'warehouse', 0x6fc0b8); addSign(bb, 'E', 4.5, 12, 2.4, 7);
      plainGB.box(rect.x1 + 0.05, 2, (rect.z0 + rect.z1) / 2, 0.1, 4, 8, [0.12, 0.12, 0.14]);
    }); World.poi.spray.push({ x: (8 * SP) - PARK_LANE, z: b.z0 + 16, h: Math.PI }); }
  { const b = R(1, 8); const rect = { x0: b.x0 + 6, z0: b.z0 + 6, x1: b.x0 + 26, z1: b.z0 + 26 }; reserved.push(rect); specials.push(() => {
      const bb = addBuilding(rect.x0, rect.z0, rect.x1, rect.z1, 7, 'warehouse', 0x6fc0b8); addSign(bb, 'W', 4.5, 12, 2.4, 7);
      plainGB.box(rect.x0 - 0.05, 2, (rect.z0 + rect.z1) / 2, 0.1, 4, 8, [0.12, 0.12, 0.14]);
    }); World.poi.spray.push({ x: SP + PARK_LANE, z: b.z0 + 16, h: 0 }); }
  { const b = R(5, 9); const rect = { x0: b.x0 + 8, z0: b.z0 + 6, x1: b.x0 + 46, z1: b.z0 + 36 }; reserved.push(rect); specials.push(() => {
      const bb = addBuilding(rect.x0, rect.z0, rect.x1, rect.z1, 12, 'warehouse', 0xc0745a); addSign(bb, 'N', 8, 16, 4, 10);
      plainGB.box((rect.x0 + rect.x1) / 2, 3, rect.z0 - 0.05, 10, 6, 0.1, [0.1, 0.1, 0.12]);
    }); World.poi.garage = { x: b.x0 + 27, z: 9 * SP + PARK_LANE, h: 0 }; }
  { const b = R(5, 4); reserved.push({ x0: b.x0, z0: b.z0, x1: b.x1, z1: b.z1 }); specials.push(() => {
      const x0 = b.x0 + 16, z0 = b.z0 + 16, x1 = b.x1 - 16, z1 = b.z1 - 16;
      addBuilding(x0, z0, x1, z1, 112, 'glass', 0xd8ecff, { extraH: 90 });
      F.glass.walls(x0 + 6, z0 + 6, x1 - 6, z1 - 6, 112, 168, 32, 28, 0, hexRgb(0xd8ecff));
      roofGB.top(x0 + 6, z0 + 6, x1 - 6, z1 - 6, 168, [0.55, 0.55, 0.55], 8);
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      plainGB.merge(new THREE.CylinderGeometry(0.5, 1.6, 34, 8), new THREE.Matrix4().makeTranslation(cx, 185, cz), [0.85, 0.85, 0.88]);
      neonGB.box(cx, 168.3, z0 + 6, x1 - x0 - 12, 0.4, 0.4, hexRgb(0xe8f4ff)); neonGB.box(cx, 168.3, z1 - 6, x1 - x0 - 12, 0.4, 0.4, hexRgb(0xe8f4ff));
      neonGB.box(x0 + 6, 168.3, cz, 0.4, 0.4, z1 - z0 - 12, hexRgb(0xe8f4ff)); neonGB.box(x1 - 6, 168.3, cz, 0.4, 0.4, z1 - z0 - 12, hexRgb(0xe8f4ff));
      World.anim.towerTop = new THREE.Vector3(cx, 202.5, cz);
      // plaza
      for (let k = 0; k < 6; k++) palms.push({ x: b.x0 + 8 + k * 12, z: b.z0 + 8, h: sr(7, 9), tilt: 0.05, rot: sr(0, TAU) });
    }); World.poi.tower = { x: b.x0 + 38, z: b.z0 + 6 }; }
  specials.forEach(f => f());

  // ---- Blocks ----
  let hotelSign = 0;
  const hotelSigns = [1, 2, 4, 5, 11, 12, 13];
  for (let j = 0; j < NB; j++) for (let i = 0; i < NB; i++) {
    const r = blockRect(i, j), d = districtOf(i, j);
    const blk = { i, j, ...r, district: d };
    World.blocks.push(blk);
    // slab with curb
    slabGB.walls(r.x0, r.z0, r.x1, r.z1, 0, CURB, 2, 2, 0, [0.72, 0.71, 0.68]);
    slabGB.top(r.x0, r.z0, r.x1, r.z1, CURB, WHITE, 2);
    const ix0 = r.x0 + SIDEWALK, iz0 = r.z0 + SIDEWALK, ix1 = r.x1 - SIDEWALK, iz1 = r.z1 - SIDEWALK;
    if (d === 'residential' || d === 'park') grassGB.top(ix0, iz0, ix1, iz1, CURB + 0.03, WHITE, 6);
    if (d === 'port') concreteGB.top(ix0, iz0, ix1, iz1, CURB + 0.03, WHITE, 6);

    if (d === 'downtown') {
      if (i === 5 && j === 4) continue;
      const lot = 31, g = 4;
      for (let lj = 0; lj < 2; lj++) for (let li = 0; li < 2; li++) {
        let x0 = ix0 + 1 + li * (lot + g), z0 = iz0 + 1 + lj * (lot + g), x1 = x0 + lot, z1 = z0 + lot;
        if (overlapsReserved(x0, z0, x1, z1)) continue;
        const ins = sr(0.5, 2.5); x0 += ins; z0 += ins; x1 -= ins; z1 -= ins;
        const h = sri(14, 34) * 3.5, style = srng() < 0.6 ? 'glass' : 'office';
        const tint = style === 'glass' ? spick(GLASS_TINTS) : spick(OFFICE_TINTS);
        if (h > 60 && srng() < 0.6) {
          const h1 = Math.round(h * sr(0.4, 0.65) / 3.5) * 3.5, s = sr(3, 6);
          addBuilding(x0, z0, x1, z1, h1, style, tint, { extraH: h - h1 });
          F[style].walls(x0 + s, z0 + s, x1 - s, z1 - s, h1, h, 32, 28, 0, hexRgb(tint));
          roofGB.top(x0 + s, z0 + s, x1 - s, z1 - s, h, [0.58, 0.58, 0.56], 8);
          roofJunk(x0 + s, z0 + s, x1 - s, z1 - s, h);
        } else { addBuilding(x0, z0, x1, z1, h, style, tint); roofJunk(x0, z0, x1, z1, h); }
      }
      sidewalkTreeLine(blk, 'palm', 18);
    } else if (d === 'midtown') {
      const lot = (68 - 2 * 2.5) / 3;
      for (let lj = 0; lj < 3; lj++) for (let li = 0; li < 3; li++) {
        let x0 = ix0 + li * (lot + 2.5), z0 = iz0 + lj * (lot + 2.5), x1 = x0 + lot, z1 = z0 + lot;
        if (overlapsReserved(x0 - 1, z0 - 1, x1 + 1, z1 + 1)) continue;
        if (srng() < 0.1) { if (srng() < 0.6) trees.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, h: 3, r: 3.2, c: 0x4f8a3a }); continue; }
        const ins = sr(0.3, 1.8); x0 += ins; z0 += ins; x1 -= ins; z1 -= ins;
        const h = sri(2, 9) * 3.5, rr = srng(), style = rr < 0.55 ? 'office' : rr < 0.9 ? 'stucco' : 'glass';
        const tint = style === 'stucco' ? spick(PASTELS) : style === 'glass' ? spick(GLASS_TINTS) : spick(OFFICE_TINTS);
        addBuilding(x0, z0, x1, z1, h, style, tint);
        if (h < 25 && srng() < 0.14) addBillboard(x0, z0, x1, z1, h, sri(0, 3)); else roofJunk(x0, z0, x1, z1, h);
        if (style === 'stucco' && srng() < 0.25) { const bb = { x0, z0, x1, z1 }; addSign(bb, spick(['N', 'S', 'E', 'W']), 3.8, 8, 2, spick([11, 12, 13])); }
      }
      if (srng() < 0.6) sidewalkTreeLine(blk, srng() < 0.5 ? 'palm' : 'tree', 22);
    } else if (d === 'beach') {
      const lw = (68 - 3) / 2, ld = (68 - 2 * 2.5) / 3;
      for (let lj = 0; lj < 3; lj++) for (let li = 0; li < 2; li++) {
        let x0 = ix0 + li * (lw + 3), z0 = iz0 + lj * (ld + 2.5), x1 = x0 + lw, z1 = z0 + ld;
        const ins = sr(0.5, 1.5); x0 += ins; z0 += ins; x1 -= ins; z1 -= ins;
        const h = sri(3, 8) * 3.5, tint = spick(PASTELS);
        const bb = addBuilding(x0, z0, x1, z1, h, 'stucco', tint);
        roofJunk(x0, z0, x1, z1, h);
        if (li === 1) {
          const nc = spick([0xff6fa8, 0x3ff0d0, 0x7fd4ff, 0xffc04a, 0xb48cff, 0xff8a5c]);
          neonStrip(bb, 'E', h - 0.4, nc); neonStrip(bb, 'E', 3.6, nc);
          let sIdx = -1;
          if (j === 2 && lj === 0) sIdx = 0; else if (j === 6 && lj === 1) sIdx = 3;
          else if (srng() < 0.8) sIdx = hotelSigns[hotelSign++ % hotelSigns.length];
          if (sIdx >= 0) addSign(bb, 'E', h - 4.2, 13, 3.2, sIdx);
          if (sIdx === 0) World.poi.hotel1 = { x: WORLD_MAX - PARK_LANE, z: (z0 + z1) / 2 };
          if (sIdx === 3) World.poi.hotel2 = { x: WORLD_MAX - PARK_LANE, z: (z0 + z1) / 2 };
        }
      }
      sidewalkTreeLine(blk, 'palm', 14);
    } else if (d === 'residential') {
      const lot = (68 - 3 * 1.5) / 4;
      for (let lj = 0; lj < 4; lj++) for (let li = 0; li < 4; li++) {
        const lx0 = ix0 + li * (lot + 1.5), lz0 = iz0 + lj * (lot + 1.5), lx1 = lx0 + lot, lz1 = lz0 + lot;
        if (overlapsReserved(lx0, lz0, lx1, lz1)) continue;
        const w = sr(8, 11), dd = sr(7, 9.5), north = srng() < 0.5;
        const x0 = lx0 + (lot - w) / 2 + sr(-1, 1), x1 = x0 + w;
        const z0 = north ? lz0 + 1 : lz1 - 1 - dd, z1 = z0 + dd;
        const floors = srng() < 0.35 ? 2 : 1, h = floors * 3.5, tint = spick(PASTELS);
        addBuilding(x0, z0, x1, z1, h, 'stucco', tint, { noRoof: true, extraH: 2.4 });
        pitchedRoof(x0, z0, x1, z1, h, 2.4, hexRgb(spick(ROOF_TILES)), hexRgb(tint));
        const yz0 = north ? z1 + 0.8 : lz0 + 0.6, yz1 = north ? lz1 - 0.6 : z0 - 0.8;
        if (yz1 - yz0 > 4 && srng() < 0.28) poolGB.top(lx0 + 2.5, yz0 + 0.4, lx0 + 2.5 + Math.min(8, lot - 5), yz1 - 0.4, CURB + 0.06, WHITE, 4);
        else if (yz1 - yz0 > 3.5 && srng() < 0.65) trees.push({ x: sr(lx0 + 3, lx1 - 3), z: (yz0 + yz1) / 2, h: sr(2.2, 3), r: sr(1.8, 2.6), c: spick([0x4f8a3a, 0x5c9a40, 0x3f7a35, 0x6aa548]) });
      }
      sidewalkTreeLine(blk, srng() < 0.3 ? 'palm' : 'tree', 16);
    } else if (d === 'port') {
      const typeA = srng() < 0.55;
      const wh = (x0, z0, x1, z1) => { if (overlapsReserved(x0, z0, x1, z1)) return; const h = sr(9, 14); const bb = addBuilding(x0, z0, x1, z1, h, 'warehouse', spick(WARE_TINTS)); roofJunk(x0, z0, x1, z1, h); return bb; };
      if (typeA) {
        wh(ix0 + 2, iz0 + 2, ix1 - 2, iz0 + 28);
        for (let row = 0; row < 8; row++) for (let c = 0; c < 5; c++) {
          if (srng() < 0.3) continue;
          const x0 = ix0 + 2 + c * 12.8, z0 = iz0 + 33 + row * 3.9;
          if (x0 + 12.2 > ix1 - 1 || z0 + 2.5 > iz1 - 1) continue;
          if (overlapsReserved(x0, z0, x0 + 12.2, z0 + 2.5)) continue;
          const lv = sri(1, 3);
          for (let k = 0; k < lv; k++) plainGB.box(x0 + 6.1, k * 2.6 + 1.3 + CURB, z0 + 1.25, 12.2, 2.6, 2.5, hexRgb(spick([0xb0442e, 0x2d5f9a, 0x3f8a4a, 0xe08a2a, 0x8a8f96, 0x1f6f78, 0xc9b23a])));
          addBox(x0, z0, x0 + 12.2, z0 + 2.5, lv * 2.6 + CURB);
        }
      } else { wh(ix0 + 2, iz0 + 2, ix0 + 32, iz1 - 2); wh(ix0 + 36, iz0 + 2, ix1 - 2, iz1 - 2); }
    } else if (d === 'park') {
      const cx = (ix0 + ix1) / 2, cz = (iz0 + iz1) / 2;
      pathGB.top(cx - 2, iz0, cx + 2, iz1, CURB + 0.05, WHITE, 4); pathGB.top(ix0, cz - 2, ix1, cz + 2, CURB + 0.05, WHITE, 4);
      if (i === 2) {
        const m = new THREE.Matrix4().makeTranslation(cx, CURB + 0.4, cz);
        plainGB.merge(new THREE.CylinderGeometry(5, 5.4, 0.8, 20), m, hexRgb(0xd8d2c4));
        poolGB.merge(new THREE.CylinderGeometry(4.5, 4.5, 0.1, 20), new THREE.Matrix4().makeTranslation(cx, CURB + 0.75, cz), WHITE);
        plainGB.merge(new THREE.CylinderGeometry(0.6, 0.9, 2.4, 10), new THREE.Matrix4().makeTranslation(cx, CURB + 1.6, cz), hexRgb(0xd8d2c4));
        addCircle(cx, cz, 5.4);
        World.poi.fountain = { x: cx, z: cz };
      } else {
        plainGB.box(cx + 18, CURB + 0.6, cz + 18, 14, 1.2, 10, hexRgb(0xd8d2c4));
        plainGB.box(cx + 18, CURB + 4, cz + 22.6, 14, 6, 0.6, hexRgb(0xff7a59));
        addBox(cx + 11, cz + 13, cx + 25, cz + 23, 1.3);
      }
      for (let k = 0; k < 26; k++) {
        const x = sr(ix0 + 3, ix1 - 3), z = sr(iz0 + 3, iz1 - 3);
        if (Math.abs(x - cx) < 4.5 || Math.abs(z - cz) < 4.5) continue;
        if (i === 2 && Math.hypot(x - cx, z - cz) < 9) continue;
        if (i === 3 && x > cx + 9 && z > cz + 11) continue;
        trees.push({ x, z, h: sr(2.6, 3.8), r: sr(2.6, 3.8), c: spick([0x4f8a3a, 0x5c9a40, 0x3f7a35, 0x6aa548]) });
      }
      sidewalkTreeLine(blk, 'tree', 14);
    }
  }

  // ---- Roads ----
  const roadGB = new GeoBuilder(), juncGB = new GeoBuilder(), crossGB = new GeoBuilder(), stopGB = new GeoBuilder();
  const yR = 0.02, yD = 0.045;
  for (let k = 0; k <= NB; k++) for (let m = 0; m < NB; m++) {
    const X = k * SP, z0 = m * SP + HALF_ROAD, z1 = (m + 1) * SP - HALF_ROAD;
    roadGB.quad([X - 9, yR, z1], [X + 9, yR, z1], [X + 9, yR, z0], [X - 9, yR, z0], [0, 1, 0], [0, z1 / 36, 1, z1 / 36, 1, z0 / 36, 0, z0 / 36], WHITE);
    const Z = k * SP, x0 = m * SP + HALF_ROAD, x1 = (m + 1) * SP - HALF_ROAD;
    roadGB.quad([x0, yR, Z + 9], [x1, yR, Z + 9], [x1, yR, Z - 9], [x0, yR, Z - 9], [0, 1, 0], [1, x0 / 36, 1, x1 / 36, 0, x1 / 36, 0, x0 / 36], WHITE);
    World.segs.push({ ax: X, az: m * SP, bx: X, bz: (m + 1) * SP, axis: 'NS' });
    World.segs.push({ ax: m * SP, az: Z, bx: (m + 1) * SP, bz: Z, axis: 'EW' });
  }
  const crossUV = [0, 0, 1, 0, 1, 1, 0, 1];
  for (let a = 0; a <= NB; a++) for (let b = 0; b <= NB; b++) {
    const X = a * SP, Z = b * SP;
    juncGB.top(X - 9, Z - 9, X + 9, Z + 9, yR, WHITE, 18);
    // crosswalks + stop lines on each existing arm
    const arms = [[0, -1], [0, 1], [-1, 0], [1, 0]]; // direction from node to arm
    for (const [dx, dz] of arms) {
      const na = a + dx, nb = b + dz;
      if (na < 0 || nb < 0 || na > NB || nb > NB) continue;
      if (dx === 0) {
        const zA = Z + dz * 9, zB = Z + dz * 12, zl = Math.min(zA, zB), zh = Math.max(zA, zB);
        crossGB.quad([X - 9, yD, zh], [X + 9, yD, zh], [X + 9, yD, zl], [X - 9, yD, zl], [0, 1, 0], crossUV, WHITE);
        const sx = X + dz * 0.3, ex = X + dz * 4.8, zs = Z + dz * STOP_DIST;
        stopGB.top(Math.min(sx, ex), zs - 0.3, Math.max(sx, ex), zs + 0.3, yD, WHITE, 1);
      } else {
        const xA = X + dx * 9, xB = X + dx * 12, xl = Math.min(xA, xB), xh = Math.max(xA, xB);
        crossGB.quad([xl, yD, Z + 9], [xh, yD, Z + 9], [xh, yD, Z - 9], [xl, yD, Z - 9], [0, 1, 0], [1, 0, 1, 1, 0, 1, 0, 0], WHITE);
        const sz = Z - dx * 0.3, ez = Z - dx * 4.8, xs = X + dx * STOP_DIST;
        stopGB.top(xs - 0.3, Math.min(sz, ez), xs + 0.3, Math.max(sz, ez), yD, WHITE, 1);
      }
    }
  }

  // ---- Ground, beach, port apron, water ----
  const groundGB = new GeoBuilder(), sandGB = new GeoBuilder();
  groundGB.top(-1400, -1400, BEACH_X0, WORLD_MAX + HALF_ROAD, -0.05, WHITE, 6);
  sandGB.top(BEACH_X0, -1400, SHORE_X, DOCK_Z, 0.0, WHITE, 8);
  sandGB.quad([SHORE_X, 0.004, DOCK_Z], [SHORE_X + 18, -1.4, DOCK_Z], [SHORE_X + 18, -1.4, -1400], [SHORE_X, 0.004, -1400], [0.077, 0.997, 0], [SHORE_X / 8, -DOCK_Z / 8, (SHORE_X + 18) / 8, -DOCK_Z / 8, (SHORE_X + 18) / 8, 1400 / 8, SHORE_X / 8, 1400 / 8], WHITE);
  concreteGB.top(-1400, WORLD_MAX + HALF_ROAD, BEACH_X0, DOCK_Z, 0.0, WHITE, 6);
  concreteGB.quad([-1400, 0, DOCK_Z], [-1400, -3, DOCK_Z], [SHORE_X, -3, DOCK_Z], [SHORE_X, 0, DOCK_Z], [0, 0, 1], [0, 0, 1, 0, 1, 1, 0, 1], [0.7, 0.7, 0.68]);
  for (let x = -60; x < SHORE_X - 20; x += 12) { plainGB.merge(new THREE.CylinderGeometry(0.3, 0.35, 0.8, 8), new THREE.Matrix4().makeTranslation(x, 0.4, DOCK_Z - 1), [0.15, 0.15, 0.17]); }

  // Pier and platform
  World.pier = { x0: SHORE_X - 8, x1: SHORE_X + 110, z0: PIER_Z - 6.4, z1: PIER_Z + 6.4, y: 0.35 };
  World.platform = { x0: SHORE_X + 109.6, x1: SHORE_X + 150.4, z0: PIER_Z - 20.4, z1: PIER_Z + 20.4 };
  const woodGB = new GeoBuilder();
  { const P = World.pier, Q = World.platform;
    woodGB.top(P.x0, P.z0, P.x1, P.z1, P.y, WHITE, 4); woodGB.top(Q.x0, Q.z0, Q.x1, Q.z1, P.y, WHITE, 4);
    woodGB.walls(P.x0, P.z0, P.x1, P.z1, -0.4, P.y, 4, 4, 0, [0.7, 0.7, 0.7]); woodGB.walls(Q.x0, Q.z0, Q.x1, Q.z1, -0.4, P.y, 4, 4, 0, [0.7, 0.7, 0.7]);
    const postGeo = new THREE.CylinderGeometry(0.3, 0.3, 4, 6);
    for (let x = P.x0 + 4; x < Q.x1; x += 8) for (const z of [P.z0 + 0.3, P.z1 - 0.3]) plainGB.merge(postGeo, new THREE.Matrix4().makeTranslation(x, -1.7, z), hexRgb(0x5a4632));
    const railC = hexRgb(0xf2efe6);
    const rail = (x0, z0, x1, z1) => { plainGB.box((x0 + x1) / 2, P.y + 1.0, (z0 + z1) / 2, Math.max(0.12, x1 - x0), 0.12, Math.max(0.12, z1 - z0), railC); };
    rail(SHORE_X - 1, P.z0 + 0.1, Q.x0 + 0.4, P.z0 + 0.22); rail(SHORE_X - 1, P.z1 - 0.22, Q.x0 + 0.4, P.z1 - 0.1);
    rail(Q.x0, Q.z0 + 0.1, Q.x1, Q.z0 + 0.22); rail(Q.x0, Q.z1 - 0.22, Q.x1, Q.z1 - 0.1); rail(Q.x1 - 0.22, Q.z0, Q.x1 - 0.1, Q.z1);
    rail(Q.x0 + 0.1, Q.z0, Q.x0 + 0.22, P.z0); rail(Q.x0 + 0.1, P.z1, Q.x0 + 0.22, Q.z1);
    for (let x = SHORE_X; x < Q.x1; x += 3) { plainGB.box(x, P.y + 0.5, P.z0 + 0.16, 0.1, 1, 0.1, railC); plainGB.box(x, P.y + 0.5, P.z1 - 0.16, 0.1, 1, 0.1, railC); }
    World.poi.pierEnd = { x: SHORE_X + 140, z: PIER_Z + 12 };
  }
  // Boundaries (invisible)
  { const B = BOUND, P = World.pier, Q = World.platform;
    World.bounds.push({ x0: -400, z0: -400, x1: B.x0, z1: 1400 }, { x0: -400, z0: -400, x1: 1600, z1: B.z0 }, { x0: -400, z0: B.z1, x1: 1600, z1: 1400 });
    World.bounds.push({ x0: B.x1, z0: -400, x1: 1600, z1: Q.z0 }, { x0: B.x1, z0: Q.z1, x1: 1600, z1: 1400 });
    World.bounds.push({ x0: B.x1, z0: Q.z0, x1: Q.x0, z1: P.z0 }, { x0: B.x1, z0: P.z1, x1: Q.x0, z1: Q.z1 }, { x0: Q.x1, z0: Q.z0, x1: 1600, z1: Q.z1 });
  }

  // Ramps
  const rampGB = new GeoBuilder();
  const addRamp = (x0, z0, x1, z1, axis, dir, h) => {
    World.ramps.push({ x0, z0, x1, z1, axis, dir, h });
    const yel = hexRgb(0xf2c230), dark = hexRgb(0x3a3a3a);
    const U = [0, 0, 1, 0, 1, 1, 0, 1];
    if (axis === 'z') {
      const zl = dir > 0 ? z0 : z1, zh = dir > 0 ? z1 : z0;
      const L = Math.abs(zh - zl), n = [0, L / Math.hypot(L, h), (dir > 0 ? -h : h) / Math.hypot(L, h)];
      if (dir > 0) rampGB.quad([x0, 0.02, zl], [x1, 0.02, zl], [x1, h, zh], [x0, h, zh], [0, n[1], -Math.abs(n[2])], U, yel);
      else rampGB.quad([x1, 0.02, zl], [x0, 0.02, zl], [x0, h, zh], [x1, h, zh], [0, n[1], Math.abs(n[2])], U, yel);
      const zf = zh;
      if (dir > 0) rampGB.quad([x0, 0, zf], [x1, 0, zf], [x1, h, zf], [x0, h, zf], [0, 0, 1], U, dark);
      else rampGB.quad([x1, 0, zf], [x0, 0, zf], [x0, h, zf], [x1, h, zf], [0, 0, -1], U, dark);
      tri(rampGB, [x0, 0, dir > 0 ? zl : zh], [x0, 0, dir > 0 ? zh : zl], [x0, h, zh], [-1, 0, 0], dark);
      tri(rampGB, [x1, 0, dir > 0 ? zh : zl], [x1, 0, dir > 0 ? zl : zh], [x1, h, zh], [1, 0, 0], dark);
      addBox(x0, dir > 0 ? z1 - 0.5 : z0, x1, dir > 0 ? z1 : z0 + 0.5, h).ramp = true;
    } else {
      const xl = dir > 0 ? x0 : x1, xh = dir > 0 ? x1 : x0;
      const L = Math.abs(xh - xl), ny = L / Math.hypot(L, h), nx = h / Math.hypot(L, h);
      if (dir > 0) rampGB.quad([xl, 0.02, z1], [xh, h, z1], [xh, h, z0], [xl, 0.02, z0], [-nx, ny, 0], U, yel);
      else rampGB.quad([xl, 0.02, z0], [xh, h, z0], [xh, h, z1], [xl, 0.02, z1], [nx, ny, 0], U, yel);
      if (dir > 0) rampGB.quad([xh, 0, z1], [xh, 0, z0], [xh, h, z0], [xh, h, z1], [1, 0, 0], U, dark);
      else rampGB.quad([xh, 0, z0], [xh, 0, z1], [xh, h, z1], [xh, h, z0], [-1, 0, 0], U, dark);
      tri(rampGB, [dir > 0 ? xl : xh, 0, z1], [dir > 0 ? xh : xl, 0, z1], [xh, h, z1], [0, 0, 1], dark);
      tri(rampGB, [dir > 0 ? xh : xl, 0, z0], [dir > 0 ? xl : xh, 0, z0], [xh, h, z0], [0, 0, -1], dark);
      addBox(dir > 0 ? x1 - 0.5 : x0, z0, dir > 0 ? x1 : x0 + 0.5, z1, h).ramp = true;
    }
  };
  addRamp(971, 180, 977, 192, 'z', -1, 2.6);
  addRamp(985, 650, 991, 662, 'z', 1, 2.6);
  addRamp(600, 958, 612, 964, 'x', 1, 2.4);

  // Beach dressing: umbrellas, lifeguard towers, palms
  for (let k = 0; k < 40; k++) {
    const x = sr(BEACH_X0 + 30, SHORE_X - 8), z = sr(-40, DOCK_Z - 30);
    if (Math.abs(z - PIER_Z) < 12 || World.ramps.some(r => x > r.x0 - 8 && x < r.x1 + 8 && z > r.z0 - 25 && z < r.z1 + 25)) continue;
    const c = hexRgb(spick([0xff6f6f, 0x3ff0d0, 0xffc04a, 0x7fd4ff, 0xff9ad0]));
    plainGB.merge(new THREE.ConeGeometry(1.8, 0.7, 8), new THREE.Matrix4().makeTranslation(x, 2.4, z), c);
    plainGB.box(x, 1.2, z, 0.08, 2.4, 0.08, [0.9, 0.9, 0.9]);
    plainGB.box(x + 1.2, 0.15, z, 1.8, 0.1, 0.8, hexRgb(spick([0xffffff, 0x3ff0d0, 0xffc04a])));
  }
  [[60, 0xff6f6f], [300, 0x7fd4ff], [560, 0xffc04a], [820, 0x3ff0d0]].forEach(([z, col]) => {
    const x = BEACH_X0 + 44;
    for (const [ox, oz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) plainGB.box(x + ox, 1.2, z + oz, 0.15, 2.4, 0.15, [0.95, 0.95, 0.95]);
    plainGB.box(x, 2.5, z, 2.6, 0.2, 2.6, [0.95, 0.95, 0.95]);
    plainGB.box(x, 3.6, z, 2.4, 2, 2.4, hexRgb(col));
    plainGB.merge(new THREE.ConeGeometry(2.1, 1, 4), new THREE.Matrix4().makeRotationY(Math.PI / 4).setPosition(x, 5.1, z), hexRgb(0xffffff));
    addBox(x - 1.3, z - 1.3, x + 1.3, z + 1.3, 5.6);
  });
  for (let z = -60; z < DOCK_Z - 10; z += 14) { if (Math.abs(z - PIER_Z) < 10) continue; palms.push({ x: BEACH_X0 + 3, z: z + sr(-2, 2), h: sr(8, 12), tilt: sr(0.02, 0.15), rot: sr(0, TAU) }); }
  for (let k = 0; k < 26; k++) palms.push({ x: sr(BEACH_X0 + 12, SHORE_X - 20), z: sr(-60, DOCK_Z - 40), h: sr(7, 12), tilt: sr(0.05, 0.25), rot: sr(0, TAU) });

  // Port cranes & lighthouse
  const crane = (x) => {
    const red = hexRgb(0xc8402e), white = hexRgb(0xeeeeee);
    for (const [ox, oz] of [[-7, 953], [7, 953], [-7, 973], [7, 973]]) { plainGB.box(x + ox, 17, oz, 1.2, 34, 1.2, red); addBox(x + ox - 0.6, oz - 0.6, x + ox + 0.6, oz + 0.6, 34); }
    plainGB.box(x, 34.5, 975, 2, 1.6, 70, white); plainGB.box(x - 7, 33, 963, 1, 1, 20, red); plainGB.box(x + 7, 33, 963, 1, 1, 20, red);
    plainGB.box(x, 31, 962, 4, 3, 4, hexRgb(0xffc04a));
  };
  crane(260); crane(420); crane(780);
  { const lx = SHORE_X - 14, lz = DOCK_Z - 14;
    for (let k = 0; k < 6; k++) {
      const y0 = k * 4, r0 = 3.2 - k * 0.3, r1 = 3.2 - (k + 1) * 0.3;
      plainGB.merge(new THREE.CylinderGeometry(r1, r0, 4, 14), new THREE.Matrix4().makeTranslation(lx, y0 + 2, lz), k % 2 ? hexRgb(0xd23a2a) : hexRgb(0xf5f2ea));
    }
    plainGB.merge(new THREE.CylinderGeometry(1.9, 1.9, 0.4, 14), new THREE.Matrix4().makeTranslation(lx, 24.2, lz), hexRgb(0x333333));
    plainGB.merge(new THREE.ConeGeometry(1.6, 1.6, 12), new THREE.Matrix4().makeTranslation(lx, 27.6, lz), hexRgb(0xd23a2a));
    addCircle(lx, lz, 3.3);
    World.anim.lighthouse = new THREE.Vector3(lx, 25.6, lz);
    World.poi.lighthouse = { x: lx, z: lz };
  }
  World.poi.dock = { x: 380, z: DOCK_Z - 4 };

  // Distant hills
  const hillGB = new GeoBuilder();
  for (let k = 0; k < 22; k++) {
    const ang = sr(Math.PI * 0.55, Math.PI * 1.45), dd = sr(1100, 1500);
    const x = 450 + Math.cos(ang) * dd, z = 450 + Math.sin(ang) * dd * 0.9;
    const r = sr(180, 340), h = sr(50, 130);
    hillGB.merge(new THREE.ConeGeometry(r, h, 9), new THREE.Matrix4().makeTranslation(x, h / 2 - 2, z), hexRgb(spick([0x3d5a3a, 0x48663f, 0x34503a])), true);
  }
  // Outskirt trees
  for (let k = 0; k < 340; k++) {
    let x, z;
    if (srng() < 0.5) { x = sr(-260, -14); z = sr(-260, DOCK_Z - 40); } else { x = sr(-14, BEACH_X0 - 5); z = sr(-260, -14); }
    trees.push({ x, z, h: sr(2.5, 4), r: sr(2.4, 4.2), c: spick([0x3f6f35, 0x4a7d3a, 0x355f30, 0x56883f]), out: true });
  }

  // ---- Streetlights & traffic lights (instanced, knockable) ----
  const lights = [];
  for (const s of World.segs) {
    const isNS = s.axis === 'NS';
    const base = isNS ? s.az : s.ax, Cc = isNS ? s.ax : s.az;
    const put = (t, side) => {
      const along = base + HALF_ROAD + t * BLOCK, off = Cc + side * (HALF_ROAD + 0.7);
      const x = isNS ? off : along, z = isNS ? along : off;
      const rot = isNS ? (side < 0 ? 0 : Math.PI) : side * Math.PI / 2;
      lights.push({ x, z, rot });
    };
    put(0.25, 1); put(0.75, 1); put(0.5, -1);
  }
  const signals = [];
  for (let a = 0; a <= NB; a++) for (let b = 0; b <= NB; b++) {
    const X = a * SP, Z = b * SP;
    for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { // travel direction d
      const pa = a - dx, pb = b - dz; // previous node
      if (pa < 0 || pb < 0 || pa > NB || pb > NB) continue;
      const rx = -dz, rz = dx;
      const px = X + rx * (HALF_ROAD + 0.8) - dx * (HALF_ROAD + 0.8), pz = Z + rz * (HALF_ROAD + 0.8) - dz * (HALF_ROAD + 0.8);
      signals.push({ x: px, z: pz, rot: Math.atan2(-dx, -dz), axis: dx === 0 ? 'NS' : 'EW' });
    }
  }
  buildLightInstances(scene, lights, signals);

  // ---- Tree instances ----
  buildTrees(scene, palms, trees);

  // ---- Assemble meshes ----
  const mk = (gb, mat, opts = {}) => {
    if (gb.count === 0) return null;
    const m = new THREE.Mesh(gb.build(), mat);
    m.castShadow = !!opts.cast; m.receiveShadow = opts.receive !== false; m.matrixAutoUpdate = false; m.updateMatrix();
    scene.add(m);
    return m;
  };
  for (const s of Object.keys(F)) mk(F[s], MAT.facade[s], { cast: true });
  mk(roofGB, MAT.roof, { cast: true }); mk(plainGB, MAT.plain, { cast: true });
  mk(slabGB, MAT.sidewalk); mk(grassGB, MAT.grass); mk(concreteGB, MAT.concrete); mk(pathGB, MAT.path);
  mk(poolGB, MAT.pool, { receive: false }); mk(groundGB, MAT.grass); mk(sandGB, MAT.sand); mk(woodGB, MAT.wood, { cast: true });
  mk(roadGB, MAT.road); mk(juncGB, MAT.junction); mk(crossGB, MAT.cross, { receive: true }); mk(stopGB, MAT.stopline);
  mk(rampGB, MAT.plain, { cast: true });
  World.anim.neon = mk(neonGB, MAT.neon, { receive: false });
  mk(signGB, MAT.signs, { receive: false }); mk(adGB, MAT.ads, { receive: false });
  const hills = mk(hillGB, MAT.hills, { receive: false }); if (hills) hills.receiveShadow = false;

  // Water
  const water = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), MAT.water);
  water.rotation.x = -Math.PI / 2; water.position.set(450, -0.55, 450); scene.add(water);
  World.anim.water = water;

  buildFerrisWheel(scene);
  buildBoats(scene);
  buildLighthouseBeam(scene);

  // ---- Parking slots ----
  const poiPts = [World.poi.bodega, ...World.poi.spray, World.poi.garage, World.poi.police, World.poi.hospital];
  for (const s of World.segs) {
    const isNS = s.axis === 'NS', base = isNS ? s.az : s.ax, Cc = isNS ? s.ax : s.az;
    for (const side of [-1, 1]) {
      if ((Cc === 0 && side < 0) || (Cc === WORLD_MAX && side > 0)) continue;
      for (let t = HALF_ROAD + 14; t < SP - HALF_ROAD - 14; t += 7.5) {
        const along = base + t, off = Cc + side * PARK_LANE;
        const x = isNS ? off : along, z = isNS ? along : off;
        if (poiPts.some(p => p && dist2(p.x, p.z, x, z) < 14 * 14)) continue;
        const h = isNS ? (side < 0 ? 0 : Math.PI) : (side < 0 ? -Math.PI / 2 : Math.PI / 2);
        World.parkSlots.push({ x, z, h, used: false });
      }
    }
  }
}

function tri(gb, a, b, c, n, col) {
  gb.vert(a[0], a[1], a[2], n[0], n[1], n[2], 0, 0, col);
  gb.vert(b[0], b[1], b[2], n[0], n[1], n[2], 1, 0, col);
  gb.vert(c[0], c[1], c[2], n[0], n[1], n[2], 0.5, 1, col);
}

function buildMaterials() {
  MAT.facade = {};
  for (const s of ['office', 'glass', 'stucco', 'warehouse']) {
    MAT.facade[s] = new THREE.MeshLambertMaterial({ map: TEX[s].map, emissiveMap: TEX[s].emissive, emissive: 0xffffff, emissiveIntensity: 0, vertexColors: true });
  }
  MAT.roof = new THREE.MeshLambertMaterial({ map: TEX.roof, vertexColors: true });
  MAT.plain = new THREE.MeshLambertMaterial({ vertexColors: true });
  MAT.hills = new THREE.MeshLambertMaterial({ vertexColors: true });
  MAT.road = new THREE.MeshLambertMaterial({ map: TEX.road, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  MAT.junction = new THREE.MeshLambertMaterial({ map: TEX.junction, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  MAT.cross = new THREE.MeshLambertMaterial({ map: TEX.cross, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 });
  MAT.stopline = new THREE.MeshLambertMaterial({ color: 0xe6e6df, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 });
  MAT.sidewalk = new THREE.MeshLambertMaterial({ map: TEX.sidewalk, vertexColors: true });
  MAT.grass = new THREE.MeshLambertMaterial({ map: TEX.grass, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  MAT.path = new THREE.MeshLambertMaterial({ color: 0xd9c9a3, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -3 });
  MAT.sand = new THREE.MeshLambertMaterial({ map: TEX.sand, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  MAT.concrete = new THREE.MeshLambertMaterial({ map: TEX.concrete, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  MAT.wood = new THREE.MeshLambertMaterial({ map: TEX.wood, vertexColors: true });
  MAT.pool = new THREE.MeshPhongMaterial({ color: 0x38c6e0, specular: 0xffffff, shininess: 80, emissive: 0x0a3a48, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -3 });
  TEX.waterN.repeat.set(450, 450);
  MAT.water = new THREE.MeshPhongMaterial({ color: 0x1d6d85, specular: 0xcfeeff, shininess: 70, normalMap: TEX.waterN, normalScale: new THREE.Vector2(0.55, 0.55) });
  MAT.signs = new THREE.MeshLambertMaterial({ map: TEX.signs, emissiveMap: TEX.signs, emissive: 0xffffff, emissiveIntensity: 0.3 });
  MAT.ads = new THREE.MeshLambertMaterial({ map: TEX.ads, emissiveMap: TEX.ads, emissive: 0xffffff, emissiveIntensity: 0.1 });
  MAT.neon = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0x666666 });
  MAT.lampHead = new THREE.MeshBasicMaterial({ color: 0xbdbab0 });
  MAT.glowPool = new THREE.MeshBasicMaterial({ map: TEX.glow, color: 0xffcf8a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -8 });
  MAT.lamps = {
    NS: { R: new THREE.MeshBasicMaterial({ color: 0x3a0d0a }), Y: new THREE.MeshBasicMaterial({ color: 0x3a2a08 }), G: new THREE.MeshBasicMaterial({ color: 0x0a3018 }) },
    EW: { R: new THREE.MeshBasicMaterial({ color: 0x3a0d0a }), Y: new THREE.MeshBasicMaterial({ color: 0x3a2a08 }), G: new THREE.MeshBasicMaterial({ color: 0x0a3018 }) },
  };
}

// One InstancedMesh per item list (optionally split into spatial chunks via opts.chunk).
function chunkedInstances(scene, geo, mat, items, matFor, opts = {}) {
  const groups = new Map();
  items.forEach((it, i) => { const k = opts.chunk ? Math.floor(it.x / opts.chunk) * 1000 + Math.floor(it.z / opts.chunk) : 0; let g = groups.get(k); if (!g) groups.set(k, g = []); g.push(i); });
  const refs = new Array(items.length); const meshes = [];
  if (!geo.boundingSphere) geo.computeBoundingSphere();
  const gr = geo.boundingSphere.radius + geo.boundingSphere.center.length();
  const tmp = new THREE.Matrix4(), col = new THREE.Color();
  for (const idxs of groups.values()) {
    let minX = 1e9, minZ = 1e9, maxX = -1e9, maxZ = -1e9, maxS = 1;
    for (const i of idxs) { const it = items[i]; minX = Math.min(minX, it.x); maxX = Math.max(maxX, it.x); minZ = Math.min(minZ, it.z); maxZ = Math.max(maxZ, it.z); maxS = Math.max(maxS, it.s || 1); }
    const g = new THREE.BufferGeometry();
    for (const name in geo.attributes) g.setAttribute(name, geo.attributes[name]);
    if (geo.index) g.setIndex(geo.index);
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx, (opts.cy || 4), cz), Math.hypot(maxX - minX, maxZ - minZ) / 2 + gr * maxS + (opts.pad || 2));
    const m = new THREE.InstancedMesh(g, mat, idxs.length);
    idxs.forEach((i, k) => { matFor(items[i], tmp, i); m.setMatrixAt(k, tmp); refs[i] = [m, k]; if (opts.color) { opts.color(items[i], col); m.setColorAt(k, col); } });
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.castShadow = !!opts.cast; m.receiveShadow = !!opts.receive; if (opts.order) m.renderOrder = opts.order;
    if (!opts.chunk) m.frustumCulled = false;
    scene.add(m); meshes.push(m);
  }
  return { refs, meshes };
}

function buildLightInstances(scene, lights, signals) {
  const dummy = new THREE.Object3D();
  const gbPole = new GeoBuilder();
  const poleC = [0.32, 0.33, 0.35];
  gbPole.merge(new THREE.CylinderGeometry(0.09, 0.13, 7.6, 6), new THREE.Matrix4().makeTranslation(0, 3.8, 0), poleC);
  gbPole.box(1.3, 7.45, 0, 2.6, 0.12, 0.12, poleC);
  const poleGeo = gbPole.build();
  const headGeo = new THREE.BoxGeometry(0.9, 0.18, 0.42); headGeo.translate(2.55, 7.32, 0);
  const poolGeo = new THREE.PlaneGeometry(12, 12); poolGeo.rotateX(-Math.PI / 2); poolGeo.translate(2.55, 0.06, 0);
  const lm = (l, m) => { dummy.position.set(l.x, 0, l.z); dummy.rotation.set(0, l.rot, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); m.copy(dummy.matrix); };
  const P1 = chunkedInstances(scene, poleGeo, MAT.plain, lights, lm, { cast: true, cy: 4 });
  const P2 = chunkedInstances(scene, headGeo, MAT.lampHead, lights, lm, { cy: 7 });
  const P3 = chunkedInstances(scene, poolGeo, MAT.glowPool, lights, lm, { order: 2, cy: 0 });
  World.anim.pools = P3.meshes;
  const tm = new THREE.Matrix4();
  lights.forEach((l, i) => { lm(l, tm); addProp({ x: l.x, z: l.z, r: 0.28, alive: true, kind: 'lamp', inst: [P1.refs[i], P2.refs[i], P3.refs[i]], mat: tm.clone(), respawn: 0 }); });

  // Traffic signals: pole + arm (local -x) + head facing local +z
  const gbS = new GeoBuilder();
  gbS.merge(new THREE.CylinderGeometry(0.1, 0.14, 6.6, 6), new THREE.Matrix4().makeTranslation(0, 3.3, 0), [0.22, 0.23, 0.25]);
  gbS.box(-3.4, 6.5, 0, 6.8, 0.14, 0.14, [0.22, 0.23, 0.25]);
  gbS.box(-6.8, 6.0, 0, 0.5, 1.5, 0.45, [0.12, 0.12, 0.13]);
  const sGeo = gbS.build();
  const lampGeo = (y) => { const g = new THREE.PlaneGeometry(0.3, 0.3); g.translate(-6.8, y, 0.235); return g; };
  const sm = (sg, m) => { dummy.position.set(sg.x, 0, sg.z); dummy.rotation.set(0, sg.rot, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); m.copy(dummy.matrix); };
  const S0 = chunkedInstances(scene, sGeo, MAT.plain, signals, sm, { cast: true, cy: 4, pad: 8 });
  const lampRefs = {};
  for (const ax of ['NS', 'EW']) {
    const list = signals.filter(sg => sg.axis === ax);
    lampRefs[ax] = {
      list,
      R: chunkedInstances(scene, lampGeo(6.45), MAT.lamps[ax].R, list, sm, { cy: 6, pad: 8 }),
      Y: chunkedInstances(scene, lampGeo(6.0), MAT.lamps[ax].Y, list, sm, { cy: 6, pad: 8 }),
      G: chunkedInstances(scene, lampGeo(5.55), MAT.lamps[ax].G, list, sm, { cy: 6, pad: 8 }),
    };
  }
  const tm2 = new THREE.Matrix4();
  signals.forEach((sg, i) => {
    const L = lampRefs[sg.axis], k = L.list.indexOf(sg);
    sm(sg, tm2);
    addProp({ x: sg.x, z: sg.z, r: 0.3, alive: true, kind: 'signal', inst: [S0.refs[i], L.R.refs[k], L.Y.refs[k], L.G.refs[k]], mat: tm2.clone(), respawn: 0 });
  });
}

function buildTrees(scene, palms, trees) {
  const dummy = new THREE.Object3D();
  // Filter trees that land inside buildings, on ramps or on top of streetlights
  const nearProp = (x, z) => { queryGrid(World.pgrid, _propStamp, x, z, 3.5, _qa); return _qa.some(id => dist2(World.props[id].x, World.props[id].z, x, z) < 3.5 * 3.5); };
  palms = palms.filter(p => !pointInBuilding(p.x, p.z, 0) && !nearProp(p.x, p.z) && !World.ramps.some(r => p.x > r.x0 - 3 && p.x < r.x1 + 3 && p.z > r.z0 - 3 && p.z < r.z1 + 3));
  trees = trees.filter(t => t.out || (!pointInBuilding(t.x, t.z, 0) && !nearProp(t.x, t.z)));
  // Palm trunk
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 1, 6); trunkGeo.translate(0, 0.5, 0);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6e52 });
  // Palm crown: 8 drooping fronds
  const crownGB = new GeoBuilder();
  for (let f = 0; f < 8; f++) {
    const a = f / 8 * TAU, len = 3.6, segs = 4;
    const ca = Math.cos(a), sa = Math.sin(a), px = -sa, pz = ca;
    for (let s = 0; s < segs; s++) {
      const t0 = s / segs, t1 = (s + 1) / segs;
      const w0 = 0.75 * Math.sin(Math.PI * (0.15 + t0 * 0.85)), w1 = 0.75 * Math.sin(Math.PI * (0.15 + t1 * 0.85));
      const r0 = t0 * len, r1 = t1 * len, y0 = 0.5 * t0 - 2.0 * t0 * t0, y1 = 0.5 * t1 - 2.0 * t1 * t1;
      const A = [ca * r0 + px * w0, y0, sa * r0 + pz * w0], B = [ca * r0 - px * w0, y0, sa * r0 - pz * w0];
      const C = [ca * r1 - px * w1, y1, sa * r1 - pz * w1], D = [ca * r1 + px * w1, y1, sa * r1 + pz * w1];
      const col = s % 2 ? [0.27, 0.55, 0.22] : [0.32, 0.62, 0.26];
      crownGB.quad(A, B, C, D, [0, 1, 0], [0, 0, 1, 0, 1, 1, 0, 1], col);
    }
  }
  crownGB.merge(new THREE.IcosahedronGeometry(0.35, 0), null, [0.45, 0.33, 0.2]);
  const crownMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const crownGeo = crownGB.build();
  const up = new THREE.Vector3();
  palms.forEach(p => { p.s = p.h; });
  chunkedInstances(scene, trunkGeo, trunkMat, palms, (p, m) => {
    dummy.position.set(p.x, 0, p.z); dummy.rotation.set(Math.cos(p.rot) * p.tilt, 0, Math.sin(p.rot) * p.tilt); dummy.scale.set(1, p.h, 1); dummy.updateMatrix(); m.copy(dummy.matrix);
  }, { cast: true, cy: 5, pad: 4 });
  chunkedInstances(scene, crownGeo, crownMat, palms, (p, m) => {
    dummy.rotation.set(Math.cos(p.rot) * p.tilt, 0, Math.sin(p.rot) * p.tilt);
    up.set(0, p.h, 0).applyEuler(dummy.rotation);
    dummy.position.set(p.x + up.x, up.y, p.z + up.z); dummy.rotation.set(0, p.rot, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); m.copy(dummy.matrix);
  }, { cast: true, cy: 9, pad: 6 });
  palms.forEach(p => { if (p.x > BOUND.x0 && p.z > BOUND.z0) addCircle(p.x, p.z, 0.35); });
  // Round trees
  const tTrunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 1, 6); tTrunkGeo.translate(0, 0.5, 0);
  const canopyGeo = new THREE.IcosahedronGeometry(1, 0);
  const canopyMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  trees.forEach(t => { t.base = blockAt(t.x, t.z) ? CURB : 0; t.rx = sr(0, 1); t.ry = sr(0, 3); t.s = t.r + t.h; });
  chunkedInstances(scene, tTrunkGeo, trunkMat, trees, (t, m) => {
    dummy.position.set(t.x, t.base, t.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, t.h, 1); dummy.updateMatrix(); m.copy(dummy.matrix);
  }, { cast: true, cy: 2, pad: 3 });
  chunkedInstances(scene, canopyGeo, canopyMat, trees, (t, m) => {
    dummy.position.set(t.x, t.base + t.h + t.r * 0.6, t.z); dummy.rotation.set(t.rx, t.ry, 0); dummy.scale.set(t.r, t.r * 0.85, t.r); dummy.updateMatrix(); m.copy(dummy.matrix);
  }, { cast: true, cy: 5, pad: 5, color: (t, c) => c.setHex(t.c) });
  trees.forEach(t => { if (t.x > BOUND.x0 && t.z > BOUND.z0) addCircle(t.x, t.z, 0.4); });
  World.treeCount = palms.length + trees.length;
}

function buildFerrisWheel(scene) {
  const cx = SHORE_X + 132, cz = PIER_Z, cy = 21;
  const group = new THREE.Group(); group.position.set(cx, cy, cz);
  const wheel = new THREE.Group(); group.add(wheel);
  const gb = new GeoBuilder(), R = 17;
  const ringGeo = new THREE.TorusGeometry(R, 0.35, 6, 48);
  for (const ox of [-1.4, 1.4]) gb.merge(ringGeo, new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(ox, 0, 0), [0.95, 0.95, 0.95]);
  for (let k = 0; k < 16; k++) {
    const a = k / 16 * TAU;
    for (const ox of [-1.4, 1.4]) {
      const m = new THREE.Matrix4().makeRotationX(a); m.setPosition(ox, 0, 0);
      const g = new THREE.BoxGeometry(0.15, R, 0.15); g.translate(0, R / 2, 0);
      gb.merge(g, m, [0.9, 0.9, 0.92]); g.dispose();
    }
  }
  gb.merge(new THREE.CylinderGeometry(0.8, 0.8, 3.4, 10), new THREE.Matrix4().makeRotationZ(Math.PI / 2), [0.4, 0.4, 0.42]);
  wheel.add(new THREE.Mesh(gb.build(), MAT.plain));
  const lightsGB = new GeoBuilder();
  for (let k = 0; k < 48; k++) { const a = k / 48 * TAU; for (const ox of [-1.6, 1.6]) lightsGB.box(ox, Math.sin(a) * R, Math.cos(a) * R, 0.3, 0.3, 0.3, hexRgb(k % 3 === 0 ? 0xff6fa8 : k % 3 === 1 ? 0x3ff0d0 : 0xffc04a)); }
  const wl = new THREE.Mesh(lightsGB.build(), MAT.neon); wheel.add(wl);
  const gondolas = [];
  const gGeo = new THREE.BoxGeometry(2.2, 1.8, 1.8); gGeo.translate(0, -1.4, 0);
  const gMats = [0xff6f6f, 0x3ff0d0, 0xffc04a, 0x7fd4ff].map(c => new THREE.MeshLambertMaterial({ color: c }));
  for (let k = 0; k < 16; k++) {
    const a = k / 16 * TAU, gm = new THREE.Mesh(gGeo, gMats[k % 4]);
    gm.position.set(0, Math.cos(a) * R, Math.sin(a) * R); wheel.add(gm); gondolas.push(gm);
  }
  // supports
  const sGB = new GeoBuilder(), sc = [0.85, 0.85, 0.88];
  for (const ox of [-3, 3]) for (const oz of [-1, 1]) {
    const len = Math.hypot(cy, 9), ang = Math.atan2(9, cy) * oz;
    const g = new THREE.BoxGeometry(0.6, len, 0.6); g.translate(0, -len / 2, 0);
    sGB.merge(g, new THREE.Matrix4().makeRotationX(-ang).setPosition(ox, 0, 0), sc); g.dispose();
  }
  group.add(new THREE.Mesh(sGB.build(), MAT.plain));
  group.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(group);
  for (const ox of [-3, 3]) for (const oz of [-9, 9]) addBox(cx + ox - 0.6, cz + oz - 0.6, cx + ox + 0.6, cz + oz + 0.6, 30);
  World.anim.wheel = wheel; World.anim.gondolas = gondolas; World.anim.wheelR = R;
}

function buildBoats(scene) {
  const boats = [];
  const hullGeo = taperBox(3, 9, 3.6, 10.5, 1.4, 0, -0.6);
  const cabGeo = new THREE.BoxGeometry(2.4, 1.6, 3.2);
  const spots = [[200, 1010, 0.3], [380, 1004, -0.2], [560, 1015, 1.4], [720, 1006, 0.1], [1060, 360, 1.6], [1085, 500, 1.4], [1100, 250, 0.4]];
  for (const [x, z, h] of spots) {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(hullGeo, new THREE.MeshLambertMaterial({ color: pick([0xf5f2ea, 0x2d5f9a, 0xc8402e, 0x1f6f78]) }));
    const cab = new THREE.Mesh(cabGeo, new THREE.MeshLambertMaterial({ color: 0xf5f2ea })); cab.position.set(0, 1.5, -0.8);
    g.add(hull, cab); g.position.set(x, -0.4, z); g.rotation.y = h; scene.add(g);
    boats.push({ g, ph: Math.random() * TAU, y0: -0.35 });
  }
  World.anim.boats = boats;
}

function buildLighthouseBeam(scene) {
  const p = World.anim.lighthouse;
  const geo = new THREE.ConeGeometry(6, 70, 16, 1, true); geo.translate(0, -35, 0); geo.rotateZ(Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const g = new THREE.Group(); g.position.copy(p);
  const b1 = new THREE.Mesh(geo, mat), b2 = new THREE.Mesh(geo, mat); b2.rotation.y = Math.PI;
  g.add(b1, b2); scene.add(g);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff2c8 }));
  lamp.position.copy(p); scene.add(lamp);
  World.anim.beam = g; World.anim.beamMat = mat;
  // Aviation light on Solano Tower
  const av = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020, fog: false }));
  av.position.copy(World.anim.towerTop); scene.add(av); World.anim.aviation = av;
}

// Knock over a streetlight/signal prop
function knockProp(p, dirX, dirZ, scene) {
  if (!p.alive) return;
  p.alive = false; p.respawn = 45;
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (const [m, i] of p.inst) { m.setMatrixAt(i, zero); m.instanceMatrix.needsUpdate = true; }
  const geo = new THREE.CylinderGeometry(0.1, 0.14, p.kind === 'lamp' ? 7.6 : 6.6, 6); geo.translate(0, (p.kind === 'lamp' ? 7.6 : 6.6) / 2, 0);
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x55575c }));
  mesh.position.set(p.x, CURB, p.z); mesh.castShadow = true; scene.add(mesh);
  const ax = new THREE.Vector3(dirZ, 0, -dirX).normalize();
  World.debris.push({ mesh, ax, ang: 0, av: 0.5, t: 0 });
}
function updateWorld(dt, nightK, px, pz, scene, time) {
  // Traffic lamps
  for (const ax of ['NS', 'EW']) {
    const st = lightState(ax), L = MAT.lamps[ax];
    L.R.color.setHex(st === 'R' ? 0xff2a1a : 0x3a0d0a);
    L.Y.color.setHex(st === 'Y' ? 0xffb020 : 0x3a2a08);
    L.G.color.setHex(st === 'G' ? 0x2aff7a : 0x0a3018);
  }
  // Night lighting
  for (const s in MAT.facade) MAT.facade[s].emissiveIntensity = nightK * 0.95;
  MAT.glowPool.opacity = nightK * 0.5;
  for (const m of World.anim.pools) m.visible = nightK > 0.02;
  MAT.lampHead.color.setRGB(lerp(0.74, 1.0, nightK), lerp(0.73, 0.93, nightK), lerp(0.69, 0.75, nightK));
  const nv = lerp(0.45, 1.0, nightK); MAT.neon.color.setRGB(nv, nv, nv);
  MAT.signs.emissiveIntensity = lerp(0.25, 1.1, nightK);
  MAT.ads.emissiveIntensity = lerp(0.05, 0.6, nightK);
  // Water scroll
  TEX.waterN.offset.x = (time * 0.006) % 1; TEX.waterN.offset.y = (time * 0.004) % 1;
  // Ferris wheel
  const A = World.anim;
  if (A.wheel) {
    A.wheel.rotation.x += dt * 0.06;
    for (const g of A.gondolas) g.rotation.x = -A.wheel.rotation.x;
  }
  if (A.beam) { A.beam.rotation.y += dt * 0.9; A.beamMat.opacity = nightK * 0.22; A.beam.visible = nightK > 0.02; }
  if (A.aviation) A.aviation.visible = Math.sin(time * 3) > 0.2;
  if (A.boats) for (const b of A.boats) { b.ph += dt; b.g.position.y = b.y0 + Math.sin(b.ph * 1.1) * 0.15; b.g.rotation.z = Math.sin(b.ph * 0.9) * 0.04; }
  // Debris
  for (let i = World.debris.length - 1; i >= 0; i--) {
    const d = World.debris[i]; d.t += dt;
    if (d.ang < Math.PI / 2 - 0.05) { d.av += dt * 3.2; d.ang = Math.min(Math.PI / 2 - 0.05, d.ang + d.av * dt); d.mesh.setRotationFromAxisAngle(d.ax, d.ang); }
    if (d.t > 6) { scene.remove(d.mesh); d.mesh.geometry.dispose(); d.mesh.material.dispose(); World.debris.splice(i, 1); }
  }
  // Prop respawn when the player is far away
  for (const p of World.props) {
    if (p.alive) continue;
    p.respawn -= dt;
    if (p.respawn < 0 && dist2(px, pz, p.x, p.z) > 140 * 140) {
      p.alive = true;
      for (const [m, i] of p.inst) { m.setMatrixAt(i, p.mat); m.instanceMatrix.needsUpdate = true; }
    }
  }
}
