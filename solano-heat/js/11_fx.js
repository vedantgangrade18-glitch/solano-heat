// ---------- Particles & explosions ----------
class ParticleSystem {
  constructor(scene, cap, additive) {
    this.cap = cap;
    this.pos = new Float32Array(cap * 3); this.col = new Float32Array(cap * 4); this.size = new Float32Array(cap);
    this.p = [];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    this.uniforms = { scale: { value: 400 } };
    const m = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `attribute float size; attribute vec4 pcolor; varying vec4 vC; uniform float scale;
        void main(){ vC = pcolor; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(size * scale / max(0.5, -mv.z), 1.0, 512.0); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec4 vC; void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard; float a = smoothstep(0.5, 0.05, d); gl_FragColor = vec4(vC.rgb, vC.a * a); }`,
    });
    this.points = new THREE.Points(g, m); this.points.frustumCulled = false; this.points.renderOrder = 5;
    this.geo = g; scene.add(this.points);
  }
  emit(o) {
    if (this.p.length >= this.cap) this.p.shift();
    this.p.push(o);
  }
  update(dt) {
    const P = this.p;
    let w = 0;
    for (let i = 0; i < P.length; i++) {
      const q = P[i];
      q.life += dt;
      if (q.life >= q.max) continue;
      q.vy -= (q.g || 0) * dt;
      const dr = Math.exp(-(q.drag || 0) * dt);
      q.vx *= dr; q.vy *= dr; q.vz *= dr;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      if (q.y < 0.05 && q.g) { q.y = 0.05; q.vy *= -0.3; }
      P[w++] = q;
    }
    P.length = w;
    for (let i = 0; i < w; i++) {
      const q = P[i], t = q.life / q.max;
      this.pos[i * 3] = q.x; this.pos[i * 3 + 1] = q.y; this.pos[i * 3 + 2] = q.z;
      const c0 = q.c0, c1 = q.c1 || q.c0;
      this.col[i * 4] = lerp(c0[0], c1[0], t); this.col[i * 4 + 1] = lerp(c0[1], c1[1], t); this.col[i * 4 + 2] = lerp(c0[2], c1[2], t);
      this.col[i * 4 + 3] = q.a * (t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9);
      this.size[i] = lerp(q.s0, q.s1, t);
    }
    this.geo.setDrawRange(0, w);
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.pcolor.needsUpdate = true; this.geo.attributes.size.needsUpdate = true;
  }
}
const FX = {
  init(scene) {
    this.add = new ParticleSystem(scene, 700, true);
    this.norm = new ParticleSystem(scene, 700, false);
    this.flashes = [];
    this.light = new THREE.PointLight(0xffa040, 0, 60, 2); scene.add(this.light);
    this.flashGeo = new THREE.SphereGeometry(1, 16, 12);
    this.scene = scene; this.lightT = 0;
  },
  setScale(h) { this.add.uniforms.scale.value = h * 0.9; this.norm.uniforms.scale.value = h * 0.9; },
  smoke(x, y, z, k = 1) { this.norm.emit({ x: x + rnd(-0.3, 0.3), y, z: z + rnd(-0.3, 0.3), vx: rnd(-0.4, 0.4), vy: rnd(1.2, 2.2) * k, vz: rnd(-0.4, 0.4), drag: 0.4, life: 0, max: rnd(1.6, 2.6), s0: 0.8, s1: 3.2 * k, a: 0.45, c0: [0.32, 0.32, 0.33], c1: [0.55, 0.55, 0.56] }); },
  dust(x, y, z, col) { this.norm.emit({ x: x + rnd(-0.3, 0.3), y, z: z + rnd(-0.3, 0.3), vx: rnd(-0.8, 0.8), vy: rnd(0.3, 0.9), vz: rnd(-0.8, 0.8), drag: 1.2, life: 0, max: rnd(0.8, 1.4), s0: 0.6, s1: 2.6, a: 0.35, c0: col || [0.85, 0.85, 0.85] }); },
  fire(x, y, z, k = 1) { this.add.emit({ x: x + rnd(-0.4, 0.4) * k, y, z: z + rnd(-0.4, 0.4) * k, vx: rnd(-0.3, 0.3), vy: rnd(1.5, 3) * k, vz: rnd(-0.3, 0.3), drag: 0.6, life: 0, max: rnd(0.4, 0.8), s0: 1.4 * k, s1: 0.3, a: 0.9, c0: [1, 0.75, 0.3], c1: [0.9, 0.2, 0.05] }); },
  sparks(x, y, z, n = 10) { for (let i = 0; i < n; i++) this.add.emit({ x, y, z, vx: rnd(-6, 6), vy: rnd(1, 6), vz: rnd(-6, 6), g: 14, drag: 0.5, life: 0, max: rnd(0.3, 0.7), s0: 0.22, s1: 0.08, a: 1, c0: [1, 0.9, 0.5], c1: [1, 0.5, 0.1] }); },
  explosion(x, y, z) {
    for (let i = 0; i < 40; i++) { const a = Math.random() * TAU, e = Math.random() * 1.2, s = rnd(3, 11); this.add.emit({ x, y: y + 1, z, vx: Math.cos(a) * Math.cos(e) * s, vy: Math.sin(e) * s + 2, vz: Math.sin(a) * Math.cos(e) * s, drag: 2.2, life: 0, max: rnd(0.6, 1.1), s0: rnd(3, 5), s1: 1, a: 1, c0: [1, 0.85, 0.45], c1: [0.8, 0.2, 0.04] }); }
    for (let i = 0; i < 30; i++) { const a = Math.random() * TAU, s = rnd(1, 5); this.norm.emit({ x, y: y + 1, z, vx: Math.cos(a) * s, vy: rnd(2, 6), vz: Math.sin(a) * s, drag: 1.2, life: 0, max: rnd(2.5, 4), s0: 2, s1: 8, a: 0.55, c0: [0.15, 0.14, 0.13], c1: [0.4, 0.4, 0.4] }); }
    this.sparks(x, y + 1, z, 30);
    const m = new THREE.Mesh(this.flashGeo, new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.set(x, y + 1.2, z); this.scene.add(m); this.flashes.push({ m, t: 0 });
    this.light.position.set(x, y + 3, z); this.light.intensity = 6; this.lightT = 0.5;
  },
  update(dt) {
    this.add.update(dt); this.norm.update(dt);
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i]; f.t += dt;
      const s = 1 + f.t * 18; f.m.scale.set(s, s, s); f.m.material.opacity = Math.max(0, 0.9 - f.t * 2.4);
      if (f.t > 0.4) { this.scene.remove(f.m); f.m.material.dispose(); this.flashes.splice(i, 1); }
    }
    if (this.lightT > 0) { this.lightT -= dt; this.light.intensity = Math.max(0, this.lightT * 12); } else this.light.intensity = 0;
  },
};
