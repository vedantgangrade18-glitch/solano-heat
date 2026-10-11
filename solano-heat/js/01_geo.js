// ---------- Geometry builder & procedural textures ----------
class GeoBuilder {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; }
  vert(x, y, z, nx, ny, nz, u, v, col) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, v); this.c.push(col[0], col[1], col[2]);
  }
  // a,b,c,d counter-clockwise seen from the normal side. uvs: [ua,va, ub,vb, uc,vc, ud,vd]
  quad(a, b, c, d, nrm, uvs, col) {
    const [nx, ny, nz] = nrm;
    this.vert(a[0], a[1], a[2], nx, ny, nz, uvs[0], uvs[1], col);
    this.vert(b[0], b[1], b[2], nx, ny, nz, uvs[2], uvs[3], col);
    this.vert(c[0], c[1], c[2], nx, ny, nz, uvs[4], uvs[5], col);
    this.vert(a[0], a[1], a[2], nx, ny, nz, uvs[0], uvs[1], col);
    this.vert(c[0], c[1], c[2], nx, ny, nz, uvs[4], uvs[5], col);
    this.vert(d[0], d[1], d[2], nx, ny, nz, uvs[6], uvs[7], col);
  }
  // Horizontal quad facing up with world-space UVs
  top(x0, z0, x1, z1, y, col, uvScale = 1) {
    const s = 1 / uvScale;
    this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [0, 1, 0],
      [x0 * s, -z1 * s, x1 * s, -z1 * s, x1 * s, -z0 * s, x0 * s, -z0 * s], col);
  }
  // Four walls of an axis-aligned box with world-unit UVs (tiles of tw x th metres)
  walls(x0, z0, x1, z1, y0, y1, tw, th, uo, col) {
    const v0 = y0 / th, v1 = y1 / th;
    const wx = (x1 - x0) / tw, wz = (z1 - z0) / tw;
    let u = uo;
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [u, v0, u + wx, v0, u + wx, v1, u, v1], col); u += wx;
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [u, v0, u + wz, v0, u + wz, v1, u, v1], col); u += wz;
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [u, v0, u + wx, v0, u + wx, v1, u, v1], col); u += wx;
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [u, v0, u + wz, v0, u + wz, v1, u, v1], col);
  }
  // Full box centred at (cx,cy,cz)
  box(cx, cy, cz, sx, sy, sz, col, bottom = false) {
    const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
    const U = [0, 0, 1, 0, 1, 1, 0, 1];
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], U, col);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], U, col);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], U, col);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], U, col);
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], U, col);
    if (bottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], U, col);
  }
  // Merge an arbitrary THREE geometry transformed by matrix m
  merge(geom, m, col, flat = false) {
    let g = geom.index ? geom.toNonIndexed() : geom.clone();
    if (m) g.applyMatrix4(m);
    if (flat || !g.attributes.normal) g.computeVertexNormals();
    const P = g.attributes.position.array, N = g.attributes.normal.array;
    const U = g.attributes.uv ? g.attributes.uv.array : null;
    const cnt = P.length / 3;
    for (let i = 0; i < cnt; i++) {
      this.p.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
      this.n.push(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]);
      if (U) this.uv.push(U[i * 2], U[i * 2 + 1]); else this.uv.push(0, 0);
      this.c.push(col[0], col[1], col[2]);
    }
    g.dispose();
  }
  get count() { return this.p.length / 3; }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere();
    return g;
  }
}

// Tapered box: bottom footprint (w0 x l0), top footprint (w1 x l1) shifted by zo along z.
function taperBox(w0, l0, w1, l1, h, zo = 0, y0 = 0) {
  const b = [[-w0 / 2, y0, -l0 / 2], [w0 / 2, y0, -l0 / 2], [w0 / 2, y0, l0 / 2], [-w0 / 2, y0, l0 / 2]];
  const t = [[-w1 / 2, y0 + h, -l1 / 2 + zo], [w1 / 2, y0 + h, -l1 / 2 + zo], [w1 / 2, y0 + h, l1 / 2 + zo], [-w1 / 2, y0 + h, l1 / 2 + zo]];
  const P = [];
  const f = (a, bb, c) => { P.push(...a, ...bb, ...c); };
  const face = (a, bb, c, d) => { f(a, bb, c); f(a, c, d); };
  face(b[3], b[2], t[2], t[3]); // front (+z)
  face(b[1], b[0], t[0], t[1]); // back (-z)
  face(b[2], b[1], t[1], t[2]); // right (+x)
  face(b[0], b[3], t[3], t[0]); // left (-x)
  face(t[3], t[2], t[1], t[0]); // top
  face(b[0], b[1], b[2], b[3]); // bottom
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.computeVertexNormals();
  return g;
}

function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function canvasTex(c, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  return t;
}
function speckle(g, w, h, n, colors, smax = 2) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[(Math.random() * colors.length) | 0];
    const s = 0.6 + Math.random() * smax;
    g.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
}

const TEX = {};
function buildTextures() {
  // --- Facades: 512px = 32m wide x 28m tall (8 cols x 8 floors) ---
  const facade = (style) => {
    const c = makeCanvas(512, 512), e = makeCanvas(512, 512);
    const g = c.getContext('2d'), ge = e.getContext('2d');
    ge.fillStyle = '#000'; ge.fillRect(0, 0, 512, 512);
    const lit = ['#ffd28a', '#ffe2b0', '#fff0d0', '#cfe3ff', '#ffc070'];
    if (style === 'office') {
      g.fillStyle = '#ebe7df'; g.fillRect(0, 0, 512, 512);
      speckle(g, 512, 512, 2500, ['#dcd8cf', '#f4f1ea', '#d0ccc2'], 1.5);
      for (let r = 0; r < 8; r++) {
        g.fillStyle = '#c9c4ba'; g.fillRect(0, r * 64 + 57, 512, 7);
        for (let col = 0; col < 8; col++) {
          const x = col * 64 + 7, y = r * 64 + 12, w = 50, h = 40;
          const grd = g.createLinearGradient(x, y, x + w, y + h);
          grd.addColorStop(0, '#5a7488'); grd.addColorStop(1, '#22313f');
          g.fillStyle = grd; g.fillRect(x, y, w, h);
          g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(x, y, w, 3);
          g.fillStyle = '#8d8c87'; g.fillRect(x + w / 2 - 1, y, 2, h);
          if (Math.random() < 0.42) { ge.globalAlpha = rnd(0.5, 1); ge.fillStyle = pick(lit); ge.fillRect(x + 2, y + 2, w - 4, h - 4); ge.globalAlpha = 1; }
        }
      }
    } else if (style === 'glass') {
      const grd = g.createLinearGradient(0, 0, 512, 512);
      grd.addColorStop(0, '#9fc4d8'); grd.addColorStop(0.45, '#5f8ea8'); grd.addColorStop(0.55, '#7fb0c8'); grd.addColorStop(1, '#3d6680');
      g.fillStyle = grd; g.fillRect(0, 0, 512, 512);
      for (let r = 0; r < 8; r++) {
        g.fillStyle = 'rgba(30,45,60,0.85)'; g.fillRect(0, r * 64 + 58, 512, 6);
        for (let col = 0; col < 16; col++) {
          g.fillStyle = 'rgba(220,235,245,0.55)'; g.fillRect(col * 32, r * 64, 2, 64);
          if (Math.random() < 0.38) { ge.globalAlpha = rnd(0.45, 0.95); ge.fillStyle = pick(lit); ge.fillRect(col * 32 + 3, r * 64 + 3, 27, 54); ge.globalAlpha = 1; }
        }
      }
    } else if (style === 'stucco') {
      g.fillStyle = '#f7f4ee'; g.fillRect(0, 0, 512, 512);
      speckle(g, 512, 512, 3000, ['#efebe3', '#fbf9f5', '#e7e2d8'], 1.4);
      for (let r = 0; r < 8; r++) {
        g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(0, r * 64 + 60, 512, 4);
        for (let col = 0; col < 8; col++) {
          const x = col * 64 + 18, y = r * 64 + 14, w = 28, h = 36;
          g.fillStyle = '#ffffff'; g.fillRect(x - 3, y - 3, w + 6, h + 6);
          g.fillStyle = '#2c3d4c'; g.fillRect(x, y, w, h);
          g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x, y, w, 4);
          g.fillStyle = '#e8e3da'; g.fillRect(x - 3, y + h + 3, w + 6, 3);
          if (Math.random() < 0.4) { ge.globalAlpha = rnd(0.55, 1); ge.fillStyle = pick(lit); ge.fillRect(x + 1, y + 1, w - 2, h - 2); ge.globalAlpha = 1; }
        }
      }
    } else { // warehouse
      g.fillStyle = '#d9d9d6'; g.fillRect(0, 0, 512, 512);
      for (let x = 0; x < 512; x += 8) { g.fillStyle = (x / 8) % 2 ? '#c4c5c2' : '#e4e4e1'; g.fillRect(x, 0, 4, 512); }
      g.fillStyle = '#9a9b98'; g.fillRect(0, 0, 512, 10);
      g.fillStyle = 'rgba(80,70,60,0.18)'; g.fillRect(0, 470, 512, 42);
      for (let x = 32; x < 512; x += 128) { ge.fillStyle = '#ffcf7a'; ge.fillRect(x, 300, 10, 6); g.fillStyle = '#555'; g.fillRect(x, 300, 10, 6); }
    }
    return { map: canvasTex(c), emissive: canvasTex(e) };
  };
  TEX.office = facade('office');
  TEX.glass = facade('glass');
  TEX.stucco = facade('stucco');
  TEX.warehouse = facade('warehouse');

  // Roof gravel
  { const c = makeCanvas(128, 128), g = c.getContext('2d');
    g.fillStyle = '#9b9a96'; g.fillRect(0, 0, 128, 128);
    speckle(g, 128, 128, 1800, ['#86857f', '#adaca7', '#77766f', '#bcbab4'], 1.5);
    TEX.roof = canvasTex(c); }

  // Road segment: 256px across 18m, 512px along 36m
  { const c = makeCanvas(256, 512), g = c.getContext('2d');
    g.fillStyle = '#3b3e44'; g.fillRect(0, 0, 256, 512);
    speckle(g, 256, 512, 5000, ['#34373c', '#43464c', '#2f3236', '#4a4d52'], 1.6);
    const m = 256 / 18;
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, 0.5 * m, 512); g.fillRect(256 - 0.5 * m, 0, 0.5 * m, 512);
    g.fillStyle = '#e7c34a'; g.fillRect(128 - 0.32 * m, 0, 0.14 * m + 1, 512); g.fillRect(128 + 0.18 * m, 0, 0.14 * m + 1, 512);
    g.fillStyle = '#e8e8e2';
    for (let y = 0; y < 512; y += 64) { g.fillRect(128 - 5 * m - 1, y, 3, 40); g.fillRect(128 + 5 * m - 1, y, 3, 40); }
    g.fillStyle = 'rgba(20,20,20,0.18)'; g.fillRect(128 - 3.6 * m, 0, 1.2 * m, 512); g.fillRect(128 + 2.4 * m, 0, 1.2 * m, 512);
    TEX.road = canvasTex(c); }
  // Intersection asphalt
  { const c = makeCanvas(256, 256), g = c.getContext('2d');
    g.fillStyle = '#3b3e44'; g.fillRect(0, 0, 256, 256);
    speckle(g, 256, 256, 2600, ['#34373c', '#43464c', '#2f3236', '#4a4d52'], 1.6);
    g.fillStyle = 'rgba(15,15,15,0.22)'; g.beginPath(); g.arc(128, 128, 40, 0, TAU); g.fill();
    TEX.junction = canvasTex(c); }
  // Crosswalk stripes (alpha)
  { const c = makeCanvas(256, 64), g = c.getContext('2d');
    g.clearRect(0, 0, 256, 64);
    const m = 256 / 18;
    g.fillStyle = 'rgba(240,240,232,0.92)';
    for (let x = 0.6; x < 18; x += 1.3) g.fillRect(x * m, 4, 0.65 * m, 56);
    TEX.cross = canvasTex(c, false); }
  // Sidewalk tiles (2m)
  { const c = makeCanvas(128, 128), g = c.getContext('2d');
    g.fillStyle = '#c3c0b8'; g.fillRect(0, 0, 128, 128);
    speckle(g, 128, 128, 1400, ['#b8b5ad', '#cdcac2', '#adaaa2'], 1.2);
    g.fillStyle = '#9f9c95'; g.fillRect(0, 0, 128, 3); g.fillRect(0, 0, 3, 128); g.fillRect(0, 63, 128, 2); g.fillRect(63, 0, 2, 128);
    TEX.sidewalk = canvasTex(c); }
  // Grass
  { const c = makeCanvas(128, 128), g = c.getContext('2d');
    g.fillStyle = '#5f8f3e'; g.fillRect(0, 0, 128, 128);
    speckle(g, 128, 128, 2600, ['#55833a', '#6b9c47', '#4c7834', '#78a852'], 1.8);
    TEX.grass = canvasTex(c); }
  // Sand
  { const c = makeCanvas(256, 256), g = c.getContext('2d');
    g.fillStyle = '#e6d3a3'; g.fillRect(0, 0, 256, 256);
    speckle(g, 256, 256, 6000, ['#dcc795', '#efdeb3', '#d3bd8a', '#f5e7c4'], 1.4);
    TEX.sand = canvasTex(c); }
  // Concrete (port)
  { const c = makeCanvas(128, 128), g = c.getContext('2d');
    g.fillStyle = '#8f8d87'; g.fillRect(0, 0, 128, 128);
    speckle(g, 128, 128, 2000, ['#85837d', '#99978f', '#7a7872'], 1.6);
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 0, 128, 2); g.fillRect(0, 0, 2, 128);
    TEX.concrete = canvasTex(c); }
  // Wood planks
  { const c = makeCanvas(128, 128), g = c.getContext('2d');
    g.fillStyle = '#8b6a48'; g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 16) { g.fillStyle = (y / 16) % 2 ? '#93714e' : '#7f603f'; g.fillRect(0, y, 128, 14); g.fillStyle = '#4a3622'; g.fillRect(0, y + 14, 128, 2); }
    speckle(g, 128, 128, 600, ['#6e5235', '#a07e59'], 1.2);
    TEX.wood = canvasTex(c); }
  // Soft radial glow
  { const c = makeCanvas(128, 128), g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,0.45)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    TEX.glow = canvasTex(c, false); }
  // Headlight beam (fan)
  { const c = makeCanvas(128, 256), g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 256, 0, 0);
    grd.addColorStop(0, 'rgba(255,250,230,0.95)'); grd.addColorStop(1, 'rgba(255,250,230,0)');
    g.fillStyle = grd; g.beginPath(); g.moveTo(54, 256); g.lineTo(74, 256); g.lineTo(128, 0); g.lineTo(0, 0); g.closePath(); g.fill();
    TEX.beam = canvasTex(c, false); }
  // Water normal map
  { const N = 256, c = makeCanvas(N, N), g = c.getContext('2d'); const img = g.createImageData(N, N);
    const hgt = new Float32Array(N * N);
    const waves = []; for (let i = 0; i < 14; i++) waves.push([rndi(1, 6) * (Math.random() < 0.5 ? -1 : 1), rndi(1, 6) * (Math.random() < 0.5 ? -1 : 1), Math.random() * TAU, rnd(0.3, 1)]);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let h = 0; for (const w of waves) h += Math.sin((x * w[0] + y * w[1]) / N * TAU + w[2]) * w[3];
      hgt[y * N + x] = h;
    }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const hl = hgt[y * N + ((x - 1 + N) % N)], hr = hgt[y * N + ((x + 1) % N)], hu = hgt[((y - 1 + N) % N) * N + x], hd = hgt[((y + 1) % N) * N + x];
      let nx = (hl - hr) * 0.6, ny = (hu - hd) * 0.6, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const i = (y * N + x) * 4; img.data[i] = (nx * 0.5 + 0.5) * 255; img.data[i + 1] = (ny * 0.5 + 0.5) * 255; img.data[i + 2] = (nz * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    TEX.waterN = canvasTex(c); }

  // Sign atlas: 2 columns x 8 rows (512x128 each)
  TEX.signs = buildSignAtlas();
  TEX.ads = buildAdAtlas();
}

const SIGN_LIST = [
  ['HOTEL MARISOL', '#ff6fa8'], ['THE CORAL', '#3ff0d0'], ['SEABREEZE', '#7fd4ff'], ['LA PALMA', '#ffc04a'],
  ['PELICAN ARMS', '#ff8a5c'], ['OCEANAIRE', '#b48cff'], ['BODEGA DOLORES', '#ffd84a'], ['FRESH COAT', '#3ff0d0'],
  ['SOLANO GENERAL', '#ff4a4a'], ['POLICE  PSPD', '#7fb4ff'], ['DRYDOCK GARAGE', '#ffb547'], ['CASA AZUL', '#59c9ff'],
  ['MOTEL SUNSPOT', '#ff6f6f'], ['TIKI ROOM', '#ffb547'], ['SOLANO TOWER', '#e8f4ff'], ['PIER 9', '#3ff0d0'],
];
function signUV(idx) { const col = idx % 2, row = Math.floor(idx / 2); return [col * 0.5, 1 - (row + 1) / 8, (col + 1) * 0.5, 1 - row / 8]; }
function buildSignAtlas() {
  const c = makeCanvas(1024, 1024), g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 1024);
  SIGN_LIST.forEach(([txt, col], i) => {
    const x = (i % 2) * 512, y = Math.floor(i / 2) * 128;
    g.fillStyle = '#16131c'; g.fillRect(x + 4, y + 4, 504, 120);
    g.strokeStyle = col; g.lineWidth = 4; g.strokeRect(x + 10, y + 10, 492, 108);
    let size = 70; g.font = `900 ${size}px "Arial Black", Impact, sans-serif`;
    while (g.measureText(txt).width > 460 && size > 20) { size -= 4; g.font = `900 ${size}px "Arial Black", Impact, sans-serif`; }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = col; g.shadowBlur = 18; g.fillStyle = col; g.fillText(txt, x + 256, y + 66);
    g.shadowBlur = 0; g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillText(txt, x + 256, y + 66);
    if (txt === 'SOLANO GENERAL') { g.fillStyle = '#ff4a4a'; g.fillRect(x + 24, y + 50, 40, 12); g.fillRect(x + 38, y + 36, 12, 40); }
  });
  const t = canvasTex(c, false);
  return t;
}
function buildAdAtlas() {
  const c = makeCanvas(1024, 512), g = c.getContext('2d');
  const ad = (x, y, bg, draw) => { g.save(); g.translate(x, y); g.fillStyle = bg; g.fillRect(0, 0, 512, 256); draw(); g.restore(); };
  const font = (s, w = 900) => `${w} ${s}px "Arial Black", Impact, sans-serif`;
  ad(0, 0, '#0d7f86', () => {
    g.fillStyle = '#fff'; g.font = font(64); g.fillText('TIDEWATER', 28, 110); g.font = font(30, 700); g.fillText('COLA  ·  taste the Gulf', 30, 160);
    g.fillStyle = '#ffb547'; g.beginPath(); g.ellipse(440, 130, 34, 90, 0.15, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.fillRect(410, 120, 60, 18);
  });
  ad(512, 0, '#1c3b22', () => {
    g.fillStyle = '#ffe14a'; g.font = font(70); g.fillText('GATOR AUTO', 24, 110); g.fillStyle = '#fff'; g.font = font(28, 700); g.fillText('No credit? No problem. Rt 41', 26, 160);
    g.fillStyle = '#ffe14a'; g.fillRect(24, 190, 300, 10);
  });
  ad(0, 256, '#f3efe6', () => {
    g.fillStyle = '#111'; g.font = font(62); g.fillText('SOLANO SUN', 26, 100); g.font = font(26, 700); g.fillText('News you can trust. Mostly.', 28, 150);
    g.fillStyle = '#c0392b'; g.fillRect(26, 180, 460, 8); g.fillStyle = '#555'; for (let i = 0; i < 4; i++) g.fillRect(26 + i * 118, 200, 100, 30);
  });
  ad(512, 256, '#ff7a59', () => {
    g.fillStyle = '#fff'; g.font = font(54); g.fillText('BAYFRONT PARK', 24, 100); g.font = font(28, 700); g.fillText('Free concerts every Friday', 26, 150);
    g.fillStyle = '#ffe3a0'; g.beginPath(); g.arc(440, 200, 36, 0, TAU); g.fill();
  });
  return canvasTex(c, false);
}
function adUV(idx) { const col = idx % 2, row = Math.floor(idx / 2); return [col * 0.5, 1 - (row + 1) / 2, (col + 1) * 0.5, 1 - row / 2]; }
