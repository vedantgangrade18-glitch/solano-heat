// ---------- Input: keyboard, mouse, touch, gamepad ----------
const Input = {
  keys: Object.create(null), pressed: new Set(), mdx: 0, mdy: 0, locked: false, lockFailed: false, dragging: false, lastX: 0, lastY: 0,
  touchMode: false, joy: { id: null, x: 0, y: 0, ox: 0, oy: 0 }, look: { id: null, x: 0, y: 0 }, tbtn: Object.create(null), tpressed: new Set(),
  gpPrev: [], lookIdle: 99,
  init(canvas) {
    this.canvas = canvas;
    window.addEventListener('keydown', e => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') && e.code === 'Space') return;
      if (!this.keys[e.code]) this.pressed.add(e.code);
      this.keys[e.code] = true;
      if (Game.state === 'play' && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = Object.create(null); });
    canvas.addEventListener('mousedown', e => {
      if (this.touchMode) return;
      if (Game.state !== 'play') return;
      if (e.button === 0) {
        if (!this.locked && !this.lockFailed && canvas.requestPointerLock) {
          try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => { this.lockFailed = true; }); } catch (err) { this.lockFailed = true; }
          this.dragging = true; this.lastX = e.clientX; this.lastY = e.clientY;
        } else this.pressed.add('Mouse0');
        if (this.lockFailed) { this.dragging = true; this.lastX = e.clientX; this.lastY = e.clientY; }
      }
      if (e.button === 2) { this.dragging = true; this.lastX = e.clientX; this.lastY = e.clientY; }
    });
    window.addEventListener('mouseup', () => { this.dragging = false; });
    window.addEventListener('mousemove', e => {
      if (this.locked) { this.mdx += e.movementX || 0; this.mdy += e.movementY || 0; this.lookIdle = 0; }
      else if (this.dragging) { this.mdx += e.clientX - this.lastX; this.mdy += e.clientY - this.lastY; this.lastX = e.clientX; this.lastY = e.clientY; this.lookIdle = 0; }
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('pointerlockerror', () => { this.lockFailed = true; });
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === canvas;
      if (was && !this.locked && Game.state === 'play' && !Game.suppressPauseOnUnlock) Game.pause();
      Game.suppressPauseOnUnlock = false;
    });
    // Touch
    const tz = document.getElementById('touchZone');
    const joyEl = document.getElementById('joy'), knob = document.getElementById('joyKnob');
    tz.addEventListener('touchstart', e => {
      this.touchMode = true; document.body.classList.add('touch');
      for (const t of e.changedTouches) {
        if (t.clientX < window.innerWidth * 0.45 && this.joy.id === null) {
          this.joy.id = t.identifier; this.joy.ox = t.clientX; this.joy.oy = t.clientY; this.joy.x = 0; this.joy.y = 0;
          joyEl.style.left = (t.clientX - 60) + 'px'; joyEl.style.top = (t.clientY - 60) + 'px'; joyEl.classList.add('on'); knob.style.transform = 'translate(0px,0px)';
        } else if (this.look.id === null) { this.look.id = t.identifier; this.look.x = t.clientX; this.look.y = t.clientY; }
      }
      e.preventDefault();
    }, { passive: false });
    tz.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joy.id) {
          let dx = t.clientX - this.joy.ox, dy = t.clientY - this.joy.oy; const l = Math.hypot(dx, dy);
          if (l > 55) { dx *= 55 / l; dy *= 55 / l; }
          this.joy.x = dx / 55; this.joy.y = dy / 55; knob.style.transform = `translate(${dx}px,${dy}px)`;
        } else if (t.identifier === this.look.id) {
          this.mdx += (t.clientX - this.look.x) * 1.6; this.mdy += (t.clientY - this.look.y) * 1.6; this.look.x = t.clientX; this.look.y = t.clientY; this.lookIdle = 0;
        }
      }
      e.preventDefault();
    }, { passive: false });
    const end = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joy.id) { this.joy.id = null; this.joy.x = this.joy.y = 0; joyEl.classList.remove('on'); }
        if (t.identifier === this.look.id) this.look.id = null;
      }
    };
    tz.addEventListener('touchend', end); tz.addEventListener('touchcancel', end);
    document.querySelectorAll('[data-btn]').forEach(b => {
      const k = b.dataset.btn;
      b.addEventListener('touchstart', e => { this.touchMode = true; document.body.classList.add('touch'); this.tbtn[k] = true; this.tpressed.add(k); b.classList.add('down'); e.preventDefault(); e.stopPropagation(); }, { passive: false });
      const up = e => { this.tbtn[k] = false; b.classList.remove('down'); e.preventDefault(); };
      b.addEventListener('touchend', up); b.addEventListener('touchcancel', up);
      b.addEventListener('mousedown', e => { this.tpressed.add(k); e.preventDefault(); });
    });
  },
  frame() {
    const K = this.keys, P = this.pressed, T = this.tbtn, TP = this.tpressed;
    const ax = (K.KeyD || K.ArrowRight ? 1 : 0) - (K.KeyA || K.ArrowLeft ? 1 : 0);
    const ay = (K.KeyW || K.ArrowUp ? 1 : 0) - (K.KeyS || K.ArrowDown ? 1 : 0);
    const c = {
      moveX: ax, moveY: ay, sprint: !!(K.ShiftLeft || K.ShiftRight || T.sprint),
      jumpPressed: P.has('Space') || TP.has('jump'), hb: !!(K.Space || T.hb),
      enterPressed: P.has('KeyF') || P.has('KeyE') || P.has('Enter') || TP.has('enter'),
      attackPressed: P.has('Mouse0') || P.has('KeyJ') || TP.has('punch'),
      radioPressed: P.has('KeyQ') || TP.has('radio'), mapPressed: P.has('KeyM') || TP.has('map'),
      pausePressed: P.has('Escape') || P.has('KeyP') || TP.has('pause'), camPressed: P.has('KeyC'),
      horn: !!(K.KeyH || T.horn), accel: ay, steer: ax, lookX: this.mdx, lookY: this.mdy,
    };
    if (this.joy.id !== null) {
      c.moveX = this.joy.x; c.moveY = -this.joy.y; c.steer = this.joy.x;
      c.accel = -this.joy.y < -0.25 ? -this.joy.y : (-this.joy.y > 0.15 ? -this.joy.y : 0);
      if (Math.hypot(this.joy.x, this.joy.y) > 0.92) c.sprint = true;
    }
    if (T.gas) c.accel = 1;
    if (T.brake) c.accel = -1;
    // Gamepad
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads && Array.from(pads).find(p => p && p.connected);
    if (gp) {
      const dz = v => Math.abs(v) < 0.15 ? 0 : v;
      const b = i => !!(gp.buttons[i] && gp.buttons[i].pressed), bv = i => (gp.buttons[i] ? gp.buttons[i].value : 0);
      const edge = i => b(i) && !this.gpPrev[i];
      const lx = dz(gp.axes[0] || 0), ly = dz(gp.axes[1] || 0), rx = dz(gp.axes[2] || 0), ry = dz(gp.axes[3] || 0);
      if (lx || ly) { c.moveX = lx; c.moveY = -ly; c.steer = lx; }
      const g = bv(7) - bv(6); if (Math.abs(g) > 0.05) c.accel = g;
      if (rx || ry) { c.lookX += rx * 14; c.lookY += ry * 10; this.lookIdle = 0; }
      if (edge(0)) c.jumpPressed = true;
      if (b(0)) c.hb = true;
      if (edge(3)) c.enterPressed = true;
      if (edge(2)) c.attackPressed = true;
      if (b(10)) c.sprint = true;
      if (b(1) && !Game.playerVehicle()) c.sprint = true;
      if (edge(5) || edge(4)) c.radioPressed = true;
      if (edge(8)) c.mapPressed = true;
      if (edge(9)) c.pausePressed = true;
      if (b(11)) c.horn = true;
      this.gpPrev = gp.buttons.map(x => x.pressed);
    }
    if (c.lookX || c.lookY) this.lookIdle = 0;
    this.mdx = 0; this.mdy = 0; P.clear(); TP.clear();
    return c;
  },
  release() {
    if (this.locked && document.exitPointerLock) { Game.suppressPauseOnUnlock = true; try { document.exitPointerLock(); } catch (e) { /* ignore */ } }
  },
};
