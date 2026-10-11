// ---------- Audio: engine, sirens, sfx and three generative radio stations ----------
const Audio2 = {
  ctx: null, ok: false, musicVol: 0.55, sfxVol: 0.9,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0.85;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(c.destination);
    this.sfx = c.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(this.master);
    this.music = c.createGain(); this.music.gain.value = 0; this.music.connect(this.master);
    // radio colour: top cut like car speakers
    const eq = c.createBiquadFilter(); eq.type = 'lowpass'; eq.frequency.value = 9000;
    this.radioBus = c.createGain(); this.radioBus.gain.value = 1; this.radioBus.connect(eq); eq.connect(this.music);
    // Space: feedback delay
    this.delay = c.createDelay(1); this.delay.delayTime.value = 0.3;
    const fb = c.createGain(); fb.gain.value = 0.32; const dl = c.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2500;
    this.delay.connect(dl); dl.connect(fb); fb.connect(this.delay); dl.connect(this.radioBus);
    this.delaySend = c.createGain(); this.delaySend.gain.value = 1; this.delaySend.connect(this.delay);
    // Noise buffer
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    // Engine
    this.eng1 = c.createOscillator(); this.eng1.type = 'sawtooth';
    this.eng2 = c.createOscillator(); this.eng2.type = 'square';
    this.engF = c.createBiquadFilter(); this.engF.type = 'lowpass'; this.engF.frequency.value = 400; this.engF.Q.value = 2;
    this.engG = c.createGain(); this.engG.gain.value = 0;
    const e2g = c.createGain(); e2g.gain.value = 0.5;
    this.eng1.connect(this.engF); this.eng2.connect(e2g); e2g.connect(this.engF); this.engF.connect(this.engG); this.engG.connect(this.sfx);
    this.eng1.start(); this.eng2.start();
    // Skid
    this.skid = this.loopNoise('bandpass', 1100, 3); this.skid.g.connect(this.sfx);
    // Ambient city + surf
    this.amb = this.loopNoise('lowpass', 380, 0.7); this.amb.g.connect(this.sfx);
    this.surf = this.loopNoise('lowpass', 700, 0.5); this.surf.g.connect(this.sfx);
    // Siren
    this.sir = c.createOscillator(); this.sir.type = 'square';
    const sf = c.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 2200;
    this.sirG = c.createGain(); this.sirG.gain.value = 0;
    this.sir.connect(sf); sf.connect(this.sirG); this.sirG.connect(this.sfx); this.sir.start();
    this.ok = true;
    Radio.init();
  },
  loopNoise(type, f, q) {
    const c = this.ctx, src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const flt = c.createBiquadFilter(); flt.type = type; flt.frequency.value = f; flt.Q.value = q;
    const g = c.createGain(); g.gain.value = 0;
    src.connect(flt); flt.connect(g); src.start();
    return { src, flt, g };
  },
  spatial(x, z, range = 90) {
    if (x == null) return { v: 1, p: 0 };
    const dx = x - Game.camX, dz = z - Game.camZ, d = Math.hypot(dx, dz);
    const v = clamp(1 - d / range, 0, 1);
    const rx = -Game.camFZ, rz = Game.camFX;
    const p = d > 0.5 ? clamp((dx * rx + dz * rz) / d, -1, 1) * 0.7 : 0;
    return { v: v * v, p };
  },
  out(pan) {
    const c = this.ctx;
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; p.connect(this.sfx); return p; }
    return this.sfx;
  },
  tone(freq, dur, type, vol, opts = {}) {
    if (!this.ok || vol <= 0.0001) return;
    const c = this.ctx, t = c.currentTime + (opts.delay || 0);
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.01, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(opts.dest || this.out(opts.pan || 0)); o.start(t); o.stop(t + dur + 0.05);
  },
  noise(dur, type, f, vol, opts = {}) {
    if (!this.ok || vol <= 0.0001) return;
    const c = this.ctx, t = c.currentTime + (opts.delay || 0);
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.playbackRate.value = opts.rate || 1;
    const flt = c.createBiquadFilter(); flt.type = type; flt.frequency.setValueAtTime(f, t); flt.Q.value = opts.q || 0.8;
    if (opts.to) flt.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(flt); flt.connect(g); g.connect(opts.dest || this.out(opts.pan || 0));
    s.start(t, Math.random() * Math.max(0, 1.9 - dur)); s.stop(t + dur + 0.05);
  },
  blip(f, d, type = 'sine', v = 0.1) { this.tone(f, d, type, v); },
  crash(imp, x, z) { const s = this.spatial(x, z, 110); if (s.v < 0.02) return; const v = clamp(imp / 20, 0.1, 1) * s.v; this.noise(0.25 + v * 0.3, 'lowpass', 1600, 0.5 * v, { to: 200, pan: s.p }); this.tone(140, 0.18, 'square', 0.12 * v, { to: 50, pan: s.p }); },
  thud(v = 0.4, x, z) { const s = this.spatial(x, z); this.tone(110, 0.15, 'sine', v * s.v, { to: 45, pan: s.p }); this.noise(0.08, 'lowpass', 900, v * 0.4 * s.v, { pan: s.p }); },
  punch() { this.tone(130, 0.12, 'sine', 0.45, { to: 50 }); this.noise(0.06, 'bandpass', 2000, 0.25); },
  whoosh() { this.noise(0.16, 'bandpass', 600, 0.08, { to: 2400, q: 2 }); },
  door(x, z) { const s = this.spatial(x, z, 50); this.noise(0.05, 'highpass', 3000, 0.18 * s.v, { pan: s.p }); this.tone(90, 0.1, 'sine', 0.25 * s.v, { delay: 0.06, to: 60, pan: s.p }); },
  horn(x, z) { const s = this.spatial(x, z, 120); if (s.v < 0.02) return; this.tone(392, 0.4, 'square', 0.05 * s.v, { pan: s.p }); this.tone(494, 0.4, 'square', 0.04 * s.v, { pan: s.p }); },
  explosion(x, z) { const s = this.spatial(x, z, 260); this.noise(1.6, 'lowpass', 2400, 0.9 * s.v, { to: 80, pan: s.p }); this.tone(70, 1.2, 'sine', 0.7 * s.v, { to: 28, pan: s.p }); },
  pickup() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, 'square', 0.05, { delay: i * 0.06 })); },
  checkpoint() { this.tone(880, 0.1, 'triangle', 0.15); this.tone(1320, 0.14, 'triangle', 0.12, { delay: 0.08 }); },
  wantedUp() { this.tone(220, 0.22, 'square', 0.08); this.tone(185, 0.3, 'square', 0.08, { delay: 0.22 }); },
  missionStart() { [220, 277, 330].forEach((f, i) => this.tone(f, 1.4, 'sawtooth', 0.03, { delay: i * 0.05 })); },
  missionPass() { [392, 494, 587, 784].forEach((f, i) => this.tone(f, 0.5 - i * 0.05, 'square', 0.06, { delay: i * 0.09 })); this.tone(60, 0.4, 'sine', 0.4); },
  missionFail() { [330, 277, 220].forEach((f, i) => this.tone(f, 0.45, 'sawtooth', 0.06, { delay: i * 0.18 })); },
  spray() { this.noise(1.1, 'highpass', 4000, 0.12); },
  update(dt) {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime;
    const pv = Game.playerVehicle();
    const playing = Game.state === 'play';
    // Engine
    if (pv && playing) {
      const tp = pv.t, sp = Math.abs(pv.vF), frac = clamp(sp / tp.maxSpeed, 0, 1);
      const gears = 5, gf = frac * gears, gear = Math.min(gears - 1, Math.floor(gf));
      let rpm = pv.input.acc !== 0 || sp > 1 ? 0.25 + 0.75 * (gf - gear) * (gear === 0 ? 1 : 0.85) + gear * 0.03 : 0.18;
      if (pv.air && pv.input.acc > 0) rpm = Math.min(1, rpm + 0.3);
      if (pv.health <= 0) rpm = 0;
      const base = tp.style === 'sports' ? 70 : tp.style === 'van' || tp.style === 'pickup' ? 40 : 52;
      const f = base + rpm * base * 2.2;
      this.eng1.frequency.setTargetAtTime(f, t, 0.05); this.eng2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
      this.engF.frequency.setTargetAtTime(300 + Math.abs(pv.input.acc) * 900 + rpm * 600, t, 0.08);
      this.engG.gain.setTargetAtTime(pv.health > 0 ? 0.07 + Math.abs(pv.input.acc) * 0.06 : 0, t, 0.1);
      const sk = !pv.air ? clamp((pv.slip - 3.5) / 7, 0, 1) * clamp(sp / 6, 0, 1) : 0;
      this.skid.g.gain.setTargetAtTime(sk * 0.22, t, 0.05);
      this.skid.flt.frequency.setTargetAtTime(pv.surf === 'sand' || pv.surf === 'grass' ? 500 : 1100, t, 0.1);
    } else { this.engG.gain.setTargetAtTime(0, t, 0.1); this.skid.g.gain.setTargetAtTime(0, t, 0.05); }
    // Siren from nearest active police car
    let sd = 1e9;
    for (const v of VEHICLES) if (v.police && v.siren) { const d = Math.hypot(v.x - Game.camX, v.z - Game.camZ); if (d < sd) sd = d; }
    const sv = playing ? clamp(1 - sd / 160, 0, 1) : 0;
    this.sirG.gain.setTargetAtTime(sv * sv * 0.045, t, 0.1);
    this.sir.frequency.setTargetAtTime(700 + Math.sin(Game.time * Math.PI * 0.9) * 280, t, 0.03);
    // Ambience
    const shore = clamp(1 - Math.abs(Game.camX - SHORE_X) / 140, 0, 1);
    this.amb.g.gain.setTargetAtTime(playing ? 0.035 : 0.015, t, 0.5);
    this.surf.g.gain.setTargetAtTime((0.04 + Math.sin(Game.time * 0.7) * 0.025) * shore * (playing ? 1 : 0.5), t, 0.3);
    // Radio
    const radioOn = !!pv && playing && Radio.idx < Radio.stations.length - 1;
    this.music.gain.setTargetAtTime(radioOn ? this.musicVol * 0.5 : 0, t, 0.25);
    Radio.active = radioOn;
    Radio.tick();
  },
};

const Radio = {
  stations: [
    { name: 'NEON 88.1', tag: 'synthwave after dark', bpm: 100 },
    { name: 'CALLE 104.5', tag: 'dembow, all day', bpm: 96 },
    { name: 'LOW TIDE FM', tag: 'slow songs for slow traffic', bpm: 76 },
    { name: 'RADIO OFF', tag: '', bpm: 100 },
  ],
  idx: 0, step: 0, next: 0, active: false,
  init() { this.idx = Math.floor(Math.random() * 3); },
  cycle() { this.idx = (this.idx + 1) % this.stations.length; this.step = 0; this.next = 0; return this.stations[this.idx]; },
  mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); },
  tick() {
    const A = Audio2; if (!A.ok) return;
    const c = A.ctx;
    if (!this.active) { this.next = 0; return; }
    const st = this.stations[this.idx];
    const s16 = 60 / st.bpm / 4;
    if (this.next < c.currentTime) this.next = c.currentTime + 0.05;
    while (this.next < c.currentTime + 0.15) {
      if (this.idx === 0) this.synthwave(this.step, this.next, s16);
      else if (this.idx === 1) this.dembow(this.step, this.next, s16);
      else if (this.idx === 2) this.lofi(this.step, this.next, s16);
      this.step++; this.next += s16;
    }
  },
  // --- instruments ---
  kick(t, v) { const c = Audio2.ctx, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.connect(g); g.connect(Audio2.radioBus); o.start(t); o.stop(t + 0.32); },
  snare(t, v, space = 0) {
    const c = Audio2.ctx, s = c.createBufferSource(); s.buffer = Audio2.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.7;
    const g = c.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    s.connect(f); f.connect(g); g.connect(Audio2.radioBus); if (space) { const sg = c.createGain(); sg.gain.value = space; g.connect(sg); sg.connect(Audio2.delaySend); }
    s.start(t, Math.random()); s.stop(t + 0.2);
    const o = c.createOscillator(), og = c.createGain(); o.frequency.setValueAtTime(190, t); og.gain.setValueAtTime(v * 0.5, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.08); o.connect(og); og.connect(Audio2.radioBus); o.start(t); o.stop(t + 0.1);
  },
  hat(t, v, open = false) {
    const c = Audio2.ctx, s = c.createBufferSource(); s.buffer = Audio2.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = c.createGain(); const d = open ? 0.16 : 0.035; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f); f.connect(g); g.connect(Audio2.radioBus); s.start(t, Math.random()); s.stop(t + d + 0.02);
  },
  note(t, m, dur, v, type, cutoff = 1800, space = 0, attack = 0.005) {
    const c = Audio2.ctx, o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(this.mtof(m), t);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(cutoff, t);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(Audio2.radioBus);
    if (space) { const sg = c.createGain(); sg.gain.value = space; g.connect(sg); sg.connect(Audio2.delaySend); }
    o.start(t); o.stop(t + dur + 0.05);
  },
  // --- stations ---
  synthwave(step, t, s16) {
    const bar = Math.floor(step / 16) % 4, s = step % 16;
    const prog = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]][bar];
    if (s === 0 || s === 8) this.kick(t, 0.55);
    if (s === 4 || s === 12) this.snare(t, 0.32, 0.5);
    if (s % 2 === 1) this.hat(t, 0.06);
    if (s % 2 === 0) this.note(t, prog[0] - 24 + (s % 4 === 2 ? 12 : 0), s16 * 1.8, 0.16, 'sawtooth', 700);
    this.note(t, prog[s % 3] + 12 + (s % 6 >= 3 ? 12 : 0), s16 * 0.9, 0.035, 'square', 2600, 0.6);
    if (s === 0) for (const m of prog) this.note(t, m, s16 * 16, 0.035, 'sawtooth', 1200, 0.3, 0.4);
  },
  dembow(step, t, s16) {
    const bar = Math.floor(step / 16) % 4, s = step % 16;
    const roots = [50, 46, 48, 45][bar];
    if (s % 4 === 0) this.kick(t, 0.6);
    if (s === 3 || s === 6 || s === 11 || s === 14) this.snare(t, 0.28);
    this.hat(t, s % 2 ? 0.035 : 0.05);
    if (s === 0 || s === 6 || s === 10) this.note(t, roots - 12, s16 * 3, 0.22, 'sine', 600);
    const scale = [0, 3, 5, 7, 10, 12];
    if ([0, 3, 6, 8, 11, 14].includes(s) && Math.random() < 0.7) this.note(t, roots + 12 + scale[(step * 7 + bar) % scale.length], s16 * 1.5, 0.06, 'triangle', 3000, 0.25);
  },
  lofi(step, t, s16) {
    const bar = Math.floor(step / 16) % 4, s = step % 16;
    const ch = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]][bar];
    const swing = s % 2 === 1 ? s16 * 0.18 : 0;
    const tt = t + swing;
    if (s === 0 || s === 10) this.kick(tt, 0.4);
    if (s === 4 || s === 12) this.snare(tt, 0.14);
    if (s % 2 === 0) this.hat(tt, 0.03);
    if (s === 0 || s === 7) for (const m of ch) this.note(tt, m, s16 * 6, 0.045, 'triangle', 1500, 0.2, 0.01);
    if (s === 0 || s === 8) this.note(tt, ch[0] - 24, s16 * 6, 0.2, 'sine', 500);
    if (Math.random() < 0.4) { const c = Audio2.ctx, sN = c.createBufferSource(); sN.buffer = Audio2.noiseBuf; const g = c.createGain(); g.gain.setValueAtTime(0.012, tt); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.01); const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 3000; sN.connect(f); f.connect(g); g.connect(Audio2.radioBus); sN.start(tt, Math.random()); sN.stop(tt + 0.02); }
  },
};
