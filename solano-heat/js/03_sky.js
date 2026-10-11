// ---------- Sky, sun, moon, fog, day/night ----------
const SKY_KEYS = [
  // hour, top, horizon, sun colour, sun int, hemi sky, hemi ground, hemi int, fog
  [0.0, 0x050a18, 0x101a36, 0x8ea4ff, 0.20, 0x2a3760, 0x14141c, 0.50, 0x0e1528],
  [5.0, 0x0a1430, 0x2a2c4c, 0x8ea4ff, 0.18, 0x2a3760, 0x14141c, 0.50, 0x1d2240],
  [6.3, 0x3c5d9a, 0xf2a07a, 0xffb07a, 0.60, 0x8aa0c8, 0x5a4a40, 0.55, 0xd8a890],
  [8.0, 0x3d82d4, 0xb8dcf2, 0xfff0dc, 0.95, 0xb8d8ff, 0x6a6050, 0.62, 0xbcd8ea],
  [12.0, 0x2f7ade, 0xc4e4fa, 0xffffff, 1.00, 0xc0dcff, 0x6a6458, 0.64, 0xc4dff2],
  [16.0, 0x3576d0, 0xcfe0ee, 0xfff2d8, 0.97, 0xbcd6f5, 0x6a6050, 0.62, 0xcadcea],
  [17.6, 0x3a62b0, 0xffc890, 0xffc080, 0.90, 0xa8b4d0, 0x6a5040, 0.58, 0xf0c8a0],
  [18.6, 0x2c3f86, 0xff7a4a, 0xff8a50, 0.62, 0x7a6a9a, 0x4a3030, 0.52, 0xd88a6a],
  [19.4, 0x161c48, 0x9a4a6a, 0x9a7aff, 0.28, 0x404070, 0x201820, 0.48, 0x4a3050],
  [20.5, 0x070c1e, 0x18213f, 0x8ea4ff, 0.20, 0x2a3760, 0x14141c, 0.50, 0x111a30],
  [24.0, 0x050a18, 0x101a36, 0x8ea4ff, 0.20, 0x2a3760, 0x14141c, 0.50, 0x0e1528],
];
const Sky = {
  init(scene) {
    this.scene = scene;
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 1);
    this.sun.castShadow = true;
    const s = this.sun.shadow;
    s.mapSize.set(2048, 2048);
    s.camera.left = -85; s.camera.right = 85; s.camera.top = 85; s.camera.bottom = -85;
    s.camera.near = 10; s.camera.far = 700;
    s.bias = -0.0005; s.normalBias = 0.04;
    scene.add(this.sun); scene.add(this.sun.target);
    // Dome
    this.uniforms = {
      top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, bottom: { value: new THREE.Color(0x1a2a3a) },
      sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunColor: { value: new THREE.Color() }, sunVis: { value: 1 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p; }`,
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunColor; uniform float sunVis; varying vec3 vDir;
        void main(){ vec3 d = normalize(vDir); float h = d.y;
          vec3 col = mix(horizon, top, pow(clamp(h,0.0,1.0), 0.5));
          col = mix(col, bottom, clamp(-h*3.0, 0.0, 1.0));
          float s = max(dot(d, sunDir), 0.0);
          col += sunColor * (pow(s, 1200.0) * 3.0 + pow(s, 14.0) * 0.28) * sunVis;
          gl_FragColor = vec4(col, 1.0); }`,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), mat);
    this.dome.renderOrder = -10; this.dome.frustumCulled = false;
    scene.add(this.dome);
    // Stars
    const sp = [];
    for (let i = 0; i < 900; i++) {
      const u = Math.random(), v = Math.random() * 0.9 + 0.08, th = u * TAU, ph = Math.acos(1 - v);
      sp.push(Math.sin(ph) * Math.cos(th) * 1400, Math.cos(ph) * 1400, Math.sin(ph) * Math.sin(th) * 1400);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    this.stars = new THREE.Points(sg, this.starMat); this.stars.frustumCulled = false; this.stars.renderOrder = -9;
    scene.add(this.stars);
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(22, 16, 12), new THREE.MeshBasicMaterial({ color: 0xf2f0e6, fog: false, transparent: true }));
    this.moon.renderOrder = -8; scene.add(this.moon);
    scene.fog = new THREE.Fog(0xcccccc, 200, 1200);
    this.tmp = new THREE.Color(); this.tmp2 = new THREE.Color();
    this.nightK = 0; this.sunDir = new THREE.Vector3();
  },
  sample(hour, idx) {
    let i = 0;
    while (i < SKY_KEYS.length - 2 && SKY_KEYS[i + 1][0] <= hour) i++;
    const a = SKY_KEYS[i], b = SKY_KEYS[i + 1];
    const t = clamp((hour - a[0]) / (b[0] - a[0]), 0, 1);
    const va = a[idx], vb = b[idx];
    if (idx === 4 || idx === 7) return lerp(va, vb, t);
    return this.tmp.setHex(va).lerp(this.tmp2.setHex(vb), t).clone();
  },
  update(hour, cam, fx, fz) {
    hour = ((hour % 24) + 24) % 24;
    const top = this.sample(hour, 1), hor = this.sample(hour, 2), sunC = this.sample(hour, 3), sunI = this.sample(hour, 4);
    const hs = this.sample(hour, 5), hg = this.sample(hour, 6), hi = this.sample(hour, 7), fog = this.sample(hour, 8);
    let nk;
    if (hour < 5 || hour > 20.2) nk = 1;
    else if (hour < 7) nk = 1 - (hour - 5) / 2;
    else if (hour > 18.2) nk = (hour - 18.2) / 2;
    else nk = 0;
    this.nightK = clamp(nk, 0, 1);
    // Sun path: rises in the east (+x), sets west, tilted south
    const a = (hour - 6) / 12 * Math.PI;
    const sunDir = this.sunDir.set(Math.cos(a), Math.sin(a), 0.42).normalize();
    const up = sunDir.y > 0.02;
    const L = up ? new THREE.Vector3(sunDir.x, Math.max(sunDir.y, 0.22), sunDir.z).normalize() : new THREE.Vector3(-0.35, 0.75, -0.3).normalize();
    this.uniforms.top.value.copy(top); this.uniforms.horizon.value.copy(hor);
    this.uniforms.sunDir.value.copy(sunDir); this.uniforms.sunColor.value.copy(sunC);
    this.uniforms.sunVis.value = clamp(sunDir.y * 6 + 0.4, 0, 1);
    this.uniforms.bottom.value.copy(fog).multiplyScalar(0.8);
    this.hemi.color.copy(hs); this.hemi.groundColor.copy(hg); this.hemi.intensity = hi;
    this.sun.color.copy(sunC); this.sun.intensity = sunI;
    const ts = 170 / 2048;
    const sx = Math.round(fx / ts) * ts, sz = Math.round(fz / ts) * ts;
    this.sun.position.set(sx + L.x * 320, L.y * 320, sz + L.z * 320);
    this.sun.target.position.set(sx, 0, sz);
    this.sun.target.updateMatrixWorld();
    this.scene.fog.color.copy(fog);
    this.scene.fog.near = lerp(220, 130, this.nightK); this.scene.fog.far = lerp(1300, 850, this.nightK);
    this.dome.position.copy(cam.position); this.stars.position.copy(cam.position);
    this.starMat.opacity = this.nightK * 0.9;
    const md = new THREE.Vector3(-sunDir.x, Math.abs(sunDir.y) * 0.8 + 0.25, -sunDir.z * 0.3 + 0.4).normalize();
    this.moon.position.copy(cam.position).addScaledVector(md, 1300);
    this.moon.material.opacity = this.nightK;
    this.moon.visible = this.nightK > 0.02;
    return fog;
  },
};
