// ---------- HUD, minimap, full map ----------
const $ = id => document.getElementById(id);
const Hud = {
  init() {
    this.el = {
      clock: $('clock'), money: $('money'), stars: $('stars'), objective: $('objective'), timer: $('timer'), prompt: $('prompt'),
      toast: $('toast'), phone: $('phone'), subtitle: $('subtitle'), big: $('big'), bigT: $('bigTitle'), bigS: $('bigSub'),
      hp: $('hpFill'), car: $('carFill'), carBar: $('carBar'), speedo: $('speedo'), spd: $('spd'), radio: $('radio'), district: $('district'),
      arrest: $('arrest'), arrestFill: $('arrestFill'), dmg: $('dmgFlash'), fade: $('fade'), mtitle: $('missionTitle'),
    };
    let sh = '';
    for (let i = 0; i < 5; i++) sh += '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z"/></svg>';
    this.el.stars.innerHTML = sh;
    this.starEls = Array.from(this.el.stars.children);
    this.mm = $('minimap'); this.mmx = this.mm.getContext('2d');
    this.buildMapImage();
    this.lastDistrict = ''; this.districtT = 0; this.toastQ = []; this.toastT = 0; this.subT = 0; this.phoneT = 0; this.bigT = 0; this.route = []; this.routeT = 0;
    this.waypoint = null; this.moneyShown = Game.money;
    const bm = $('bigmapCanvas');
    bm.addEventListener('click', e => this.mapClick(e));
    this.resize();
  },
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const s = this.mm.clientWidth || 180;
    this.mm.width = s * dpr; this.mm.height = s * dpr; this.mmDpr = dpr;
  },
  W0: -150, Z0: -150, MW: 1350, MH: 1250,
  buildMapImage() {
    const c = makeCanvas(this.MW, this.MH), g = c.getContext('2d');
    const T = (x, z) => [x - this.W0, z - this.Z0];
    g.fillStyle = '#0c3442'; g.fillRect(0, 0, this.MW, this.MH);
    g.fillStyle = '#1c2a22'; const [lx, lz] = T(-150, -150); g.fillRect(lx, lz, SHORE_X + 150, DOCK_Z + 150);
    g.fillStyle = '#8c7a55'; g.fillRect(...T(BEACH_X0, -150), SHORE_X - BEACH_X0, DOCK_Z + 150);
    g.fillStyle = '#3b3b3e'; g.fillRect(...T(-150, WORLD_MAX + HALF_ROAD), BEACH_X0 + 150, DOCK_Z - WORLD_MAX - HALF_ROAD);
    const dc = { downtown: '#3d4258', midtown: '#353a4c', residential: '#2c3b31', park: '#2f5c3c', port: '#3b3732', beach: '#40394a' };
    for (const b of World.blocks) { g.fillStyle = dc[b.district]; g.fillRect(...T(b.x0, b.z0), BLOCK, BLOCK); }
    g.fillStyle = 'rgba(150,160,190,0.28)';
    for (const b of World.buildings) g.fillRect(...T(b.x0, b.z0), b.x1 - b.x0, b.z1 - b.z0);
    g.fillStyle = '#6f7889';
    for (let k = 0; k <= NB; k++) { g.fillRect(...T(k * SP - HALF_ROAD, -HALF_ROAD), ROAD, WORLD_MAX + ROAD); g.fillRect(...T(-HALF_ROAD, k * SP - HALF_ROAD), WORLD_MAX + ROAD, ROAD); }
    g.fillStyle = '#6b5a44'; const P = World.pier, Q = World.platform;
    g.fillRect(...T(P.x0, P.z0), P.x1 - P.x0, P.z1 - P.z0); g.fillRect(...T(Q.x0, Q.z0), Q.x1 - Q.x0, Q.z1 - Q.z0);
    this.mapImg = c;
  },
  // world -> minimap screen (relative to centre)
  mmXform(x, z, px, pz, yaw, s) {
    const dx = (x - px) * s, dz = (z - pz) * s, th = yaw - Math.PI, c = Math.cos(th), sn = Math.sin(th);
    return [dx * c - dz * sn, dx * sn + dz * c];
  },
  toast(msg) { this.toastQ.push(msg); },
  big(title, sub, kind) {
    this.el.bigT.textContent = title; this.el.bigS.textContent = sub || '';
    this.el.big.className = 'show ' + (kind || ''); this.bigT = 4;
  },
  subtitle(text, secs = 5) { this.el.subtitle.textContent = text; this.el.subtitle.classList.add('show'); this.subT = secs; },
  objective(text) { if (this.objText === text) return; this.objText = text; this.el.objective.innerHTML = text ? `<b>◆</b> ${text}` : ''; this.el.objective.classList.toggle('show', !!text); },
  timer(t) {
    if (t == null) { this.el.timer.classList.remove('show'); return; }
    const s = Math.max(0, Math.ceil(t)); this.el.timer.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    this.el.timer.classList.add('show'); this.el.timer.classList.toggle('low', t < 10);
  },
  phone(from, text) { this.el.phone.innerHTML = `<span class="who">${from}</span><span>${text}</span>`; this.el.phone.classList.add('show'); this.phoneT = 6; Audio2.blip(1200, 0.08, 'sine', 0.06); Audio2.tone(1500, 0.08, 'sine', 0.05, { delay: 0.12 }); },
  missionTitle(t) { this.el.mtitle.textContent = t; this.el.mtitle.classList.remove('show'); void this.el.mtitle.offsetWidth; this.el.mtitle.classList.add('show'); },
  radio(name, tag) { this.el.radio.innerHTML = `<b>${name}</b>${tag ? `<span>${tag}</span>` : ''}`; this.el.radio.classList.remove('pop'); void this.el.radio.offsetWidth; this.el.radio.classList.add('pop'); },
  flashDamage() { this.el.dmg.classList.remove('hit'); void this.el.dmg.offsetWidth; this.el.dmg.classList.add('hit'); },
  fade(cb) { const f = this.el.fade; f.classList.add('on'); setTimeout(() => { try { if (cb) cb(); } finally { setTimeout(() => f.classList.remove('on'), 120); } }, 420); },
  prompt(text) { if (this.promptText === text) return; this.promptText = text; this.el.prompt.innerHTML = text || ''; this.el.prompt.classList.toggle('show', !!text); },
  update(dt) {
    const E = this.el;
    // clock & money
    const hr = Math.floor(Game.hour) % 24, mn = Math.floor((Game.hour % 1) * 60);
    E.clock.textContent = `${String(hr).padStart(2, '0')}:${String(mn).padStart(2, '0')}`;
    this.moneyShown = Math.abs(this.moneyShown - Game.money) < 1 ? Game.money : damp(this.moneyShown, Game.money, 6, dt);
    E.money.textContent = fmtMoney(this.moneyShown);
    // stars
    const W = Police.wanted, blink = W > 0 && !Police.seen && Math.floor(Game.time * 3) % 2 === 0;
    this.starEls.forEach((s, i) => { const on = i < W; s.classList.toggle('on', on && !blink); s.classList.toggle('dim', on && blink); });
    E.stars.classList.toggle('flash', Police.flash > 0);
    // vehicle
    const pv = Game.playerVehicle();
    E.speedo.classList.toggle('show', !!pv);
    if (pv) { E.spd.textContent = Math.round(Math.abs(pv.vF) * 3.6); E.car.style.width = clamp(pv.health, 0, 100) + '%'; }
    E.carBar.classList.toggle('show', !!pv);
    E.hp.style.width = clamp(Player.health, 0, 100) + '%';
    E.hp.parentElement.classList.toggle('low', Player.health < 30);
    // arrest
    E.arrest.classList.toggle('show', Police.arrestT > 0.05);
    E.arrestFill.style.width = clamp(Police.arrestT / 3 * 100, 0, 100) + '%';
    // district
    const pp = Game.playerPos(), dn = districtName(pp.x, pp.z);
    if (dn !== this.lastDistrict) { this.lastDistrict = dn; E.district.textContent = dn; E.district.classList.add('show'); this.districtT = 3.5; }
    if (this.districtT > 0) { this.districtT -= dt; if (this.districtT <= 0) E.district.classList.remove('show'); }
    // timers
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) E.toast.classList.remove('show'); }
    else if (this.toastQ.length) { E.toast.textContent = this.toastQ.shift(); E.toast.classList.add('show'); this.toastT = 2.8; }
    if (this.subT > 0) { this.subT -= dt; if (this.subT <= 0) E.subtitle.classList.remove('show'); }
    if (this.phoneT > 0) { this.phoneT -= dt; if (this.phoneT <= 0) E.phone.classList.remove('show'); }
    if (this.bigT > 0) { this.bigT -= dt; if (this.bigT <= 0) E.big.className = ''; }
    // prompts
    let pr = '';
    if (Game.state === 'play') {
      if (!pv && Player.state === 'foot') {
        const v = Player.nearestEnterable();
        if (v) pr = `<kbd>${Input.touchMode ? 'Car' : 'F'}</kbd> ${v.driver ? 'Take' : 'Enter'} the ${v.t.name}`;
        else if (Missions.available() && dist2(pp.x, pp.z, World.poi.bodega.x, World.poi.bodega.z) < 64) pr = 'Step into the marker to talk to Dolores';
      }
    }
    this.prompt(pr);
    // route
    this.routeT -= dt;
    if (this.routeT <= 0) { this.routeT = 0.5; this.route = this.computeRoute(); }
    this.drawMinimap();
    if (Game.state === 'map') this.drawBigMap();
  },
  routeTarget() {
    const o = Missions.objectivePos();
    if (o) return o;
    return this.waypoint;
  },
  computeRoute() {
    const t = this.routeTarget(); if (!t) return [];
    const p = Game.playerPos();
    const a = nearestNode(p.x, p.z), b = nearestNode(t.x, t.z);
    const pts = [[p.x, p.z]];
    let ca = a.a, cb = a.b;
    // Manhattan path along the grid: walk the longer axis first for fewer turns
    const firstA = Math.abs(b.a - ca) >= Math.abs(b.b - cb);
    pts.push([ca * SP, cb * SP]);
    const walk = axis => { if (axis === 'a') { ca = b.a; } else { cb = b.b; } pts.push([ca * SP, cb * SP]); };
    if (firstA) { walk('a'); walk('b'); } else { walk('b'); walk('a'); }
    pts.push([t.x, t.z]);
    return pts;
  },
  drawMinimap() {
    const g = this.mmx, dpr = this.mmDpr, S = this.mm.width, R = S / 2;
    const pp = Game.playerPos(), yaw = Game.camYaw;
    const pv = Game.playerVehicle();
    const zoom = (pv ? lerp(0.62, 0.34, clamp(pv.speed / 40, 0, 1)) : 0.75) * dpr;
    g.save(); g.clearRect(0, 0, S, S);
    g.beginPath(); g.arc(R, R, R - 1, 0, TAU); g.clip();
    g.fillStyle = '#0c3442'; g.fillRect(0, 0, S, S);
    g.translate(R, R); g.rotate(yaw - Math.PI); g.scale(zoom, zoom); g.translate(-pp.x, -pp.z);
    g.drawImage(this.mapImg, this.W0, this.Z0);
    if (this.route.length > 1) {
      g.strokeStyle = '#ffb547'; g.lineWidth = 5 / zoom * dpr; g.lineJoin = 'round'; g.globalAlpha = 0.9;
      g.beginPath(); g.moveTo(this.route[0][0], this.route[0][1]); for (const q of this.route) g.lineTo(q[0], q[1]); g.stroke(); g.globalAlpha = 1;
    }
    g.restore();
    // blips
    g.save(); g.translate(R, R);
    const blip = (x, z, draw, clampEdge) => {
      let [sx, sy] = this.mmXform(x, z, pp.x, pp.z, yaw, zoom);
      const d = Math.hypot(sx, sy), lim = R - 9 * dpr;
      if (d > lim) { if (!clampEdge) return; sx *= lim / d; sy *= lim / d; }
      draw(sx, sy);
    };
    const dot = (col, r, ring) => (sx, sy) => { g.beginPath(); g.arc(sx, sy, r * dpr, 0, TAU); g.fillStyle = col; g.fill(); if (ring) { g.lineWidth = 1.5 * dpr; g.strokeStyle = ring; g.stroke(); } };
    const letter = (ch, col) => (sx, sy) => { g.beginPath(); g.arc(sx, sy, 7 * dpr, 0, TAU); g.fillStyle = '#0e1220'; g.fill(); g.lineWidth = 2 * dpr; g.strokeStyle = col; g.stroke(); g.fillStyle = col; g.font = `700 ${10 * dpr}px "Barlow Condensed", system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, sx, sy + 0.5 * dpr); };
    for (const s of World.poi.spray) blip(s.x, s.z, letter('$', '#2ee6c9'), false);
    blip(World.poi.hospital.x, World.poi.hospital.z, letter('+', '#ff5a5f'), false);
    blip(World.poi.police.x, World.poi.police.z, letter('P', '#7fb4ff'), false);
    for (const v of VEHICLES) if (v.police && (v.driver || v.officer) && Police.wanted > 0) blip(v.x, v.z, dot(Math.floor(Game.time * 4) % 2 ? '#ff3b3b' : '#3b6bff', 3.5, '#fff'), false);
    if (Police.heli) blip(Police.heli.x, Police.heli.z, dot('#ff3b3b', 4.5, '#fff'), true);
    for (const b of Missions.blips()) {
      if (b.kind === 'contact') blip(b.x, b.z, letter('D', '#ffb547'), true);
      else if (b.kind === 'car') blip(b.x, b.z, dot('#2ee6c9', 5, '#0e1220'), true);
      else blip(b.x, b.z, (sx, sy) => { g.save(); g.translate(sx, sy); g.rotate(Math.PI / 4); g.fillStyle = '#ffb547'; g.fillRect(-5 * dpr, -5 * dpr, 10 * dpr, 10 * dpr); g.strokeStyle = '#0e1220'; g.lineWidth = 2 * dpr; g.strokeRect(-5 * dpr, -5 * dpr, 10 * dpr, 10 * dpr); g.restore(); }, true);
    }
    if (this.waypoint && !Missions.objectivePos()) blip(this.waypoint.x, this.waypoint.z, dot('#ff6fa8', 5, '#0e1220'), true);
    // player arrow
    const ph = pv ? pv.h : Player.h;
    const [fx, fy] = this.mmXform(pp.x + Math.sin(ph), pp.z + Math.cos(ph), pp.x, pp.z, yaw, 1);
    const ang = Math.atan2(fy, fx);
    g.rotate(ang + Math.PI / 2);
    g.beginPath(); g.moveTo(0, -8 * dpr); g.lineTo(6 * dpr, 7 * dpr); g.lineTo(0, 4 * dpr); g.lineTo(-6 * dpr, 7 * dpr); g.closePath();
    g.fillStyle = '#f4f1ea'; g.fill(); g.lineWidth = 2 * dpr; g.strokeStyle = '#0e1220'; g.stroke();
    g.restore();
    // north marker
    const [nx, ny] = this.mmXform(pp.x, pp.z - 1000, pp.x, pp.z, yaw, 1); const nl = Math.hypot(nx, ny) || 1;
    const nr = R - 10 * dpr;
    g.fillStyle = '#ffb547'; g.font = `700 ${11 * dpr}px "Barlow Condensed", system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('N', R + nx / nl * nr, R + ny / nl * nr);
  },
  openMap() { $('bigmap').hidden = false; this.resizeBigMap(); },
  closeMap() { $('bigmap').hidden = true; },
  resizeBigMap() {
    const c = $('bigmapCanvas'), dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = c.clientWidth * dpr; c.height = c.clientHeight * dpr; this.bmDpr = dpr;
  },
  bmXform() {
    const c = $('bigmapCanvas'), s = Math.min(c.width / this.MW, c.height / this.MH) * 0.96;
    const ox = (c.width - this.MW * s) / 2, oy = (c.height - this.MH * s) / 2;
    return { s, ox, oy };
  },
  drawBigMap() {
    const c = $('bigmapCanvas'), g = c.getContext('2d'), dpr = this.bmDpr || 1;
    const { s, ox, oy } = this.bmXform();
    const T = (x, z) => [ox + (x - this.W0) * s, oy + (z - this.Z0) * s];
    g.fillStyle = '#081e28'; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(this.mapImg, ox, oy, this.MW * s, this.MH * s);
    g.font = `600 ${12 * dpr}px "Barlow Condensed", system-ui, sans-serif`; g.textAlign = 'center'; g.fillStyle = 'rgba(244,241,234,0.75)';
    const labels = [['DOWNTOWN', 520, 330], ['MIDTOWN', 700, 640], ['PALMETTO HEIGHTS', 150, 260], ['BAYFRONT PARK', 282, 560], ['PORT DISTRICT', 470, 930], ['CORAL BEACH', 985, 120], ['MIDTOWN', 700, 200], ['PIER 9', SHORE_X + 70, PIER_Z - 30]];
    for (const [t, x, z] of labels) { const [sx, sy] = T(x, z); g.fillText(t, sx, sy); }
    if (this.route.length > 1) { g.strokeStyle = '#ffb547'; g.lineWidth = 3 * dpr; g.beginPath(); this.route.forEach((q, i) => { const [sx, sy] = T(q[0], q[1]); if (i) g.lineTo(sx, sy); else g.moveTo(sx, sy); }); g.stroke(); }
    const icon = (x, z, ch, col) => { const [sx, sy] = T(x, z); g.beginPath(); g.arc(sx, sy, 9 * dpr, 0, TAU); g.fillStyle = '#0e1220'; g.fill(); g.lineWidth = 2 * dpr; g.strokeStyle = col; g.stroke(); g.fillStyle = col; g.font = `700 ${12 * dpr}px "Barlow Condensed", system-ui, sans-serif`; g.textBaseline = 'middle'; g.fillText(ch, sx, sy + dpr); };
    for (const sp of World.poi.spray) icon(sp.x, sp.z, '$', '#2ee6c9');
    icon(World.poi.hospital.x, World.poi.hospital.z, '+', '#ff5a5f');
    icon(World.poi.police.x, World.poi.police.z, 'P', '#7fb4ff');
    for (const b of Missions.blips()) icon(b.x, b.z, b.kind === 'contact' ? 'D' : '◆', '#ffb547');
    if (this.waypoint) icon(this.waypoint.x, this.waypoint.z, '•', '#ff6fa8');
    const pp = Game.playerPos(), [px, py] = T(pp.x, pp.z), ph = Game.playerVehicle() ? Game.playerVehicle().h : Player.h;
    g.save(); g.translate(px, py); g.rotate(-ph + Math.PI);
    g.beginPath(); g.moveTo(0, -10 * dpr); g.lineTo(7 * dpr, 8 * dpr); g.lineTo(0, 4 * dpr); g.lineTo(-7 * dpr, 8 * dpr); g.closePath();
    g.fillStyle = '#f4f1ea'; g.fill(); g.lineWidth = 2 * dpr; g.strokeStyle = '#0e1220'; g.stroke(); g.restore();
  },
  mapClick(e) {
    const c = $('bigmapCanvas'), r = c.getBoundingClientRect(), dpr = this.bmDpr || 1;
    const { s, ox, oy } = this.bmXform();
    const x = ((e.clientX - r.left) * dpr - ox) / s + this.W0, z = ((e.clientY - r.top) * dpr - oy) / s + this.Z0;
    if (this.waypoint && Math.hypot(this.waypoint.x - x, this.waypoint.z - z) < 25) this.waypoint = null;
    else this.waypoint = { x: clamp(x, BOUND.x0, BOUND.x1), z: clamp(z, BOUND.z0, BOUND.z1) };
    this.routeT = 0;
    $('mapHint').textContent = this.waypoint ? 'Waypoint set. Click it again to clear.' : 'Waypoint cleared.';
  },
};
