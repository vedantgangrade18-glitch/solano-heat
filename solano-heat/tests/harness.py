import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run
S = 'window.__solano'
SIM_JS = """
window.__sim = (secs, c) => {
  const S = window.__solano, G = S.Game;
  const base = {moveX:0, moveY:0, sprint:false, jumpPressed:false, hb:false, enterPressed:false, attackPressed:false, radioPressed:false, mapPressed:false, pausePressed:false, camPressed:false, horn:false, accel:0, steer:0, lookX:0, lookY:0};
  const n = Math.max(1, Math.round(secs * 60));
  for (let i = 0; i < n; i++) {
    const ctl = Object.assign({}, base, c || {}, i > 0 ? {jumpPressed:false, enterPressed:false, attackPressed:false, lookX:0, lookY:0} : {});
    G.step(1/60, ctl); G.updateCamera(1/60, G.state === 'play' ? ctl : null);
    if (i % 6 === 0 && G.state !== 'title') S.Hud.update(0.1);
  }
  return true;
};
"""
class H:
    def __init__(s, pg): s.pg = pg
    async def ev(s, js): return await s.pg.evaluate(js)
    async def wait(s, sec): await s.pg.wait_for_timeout(int(sec * 1000))
    async def shot(s, name, frames=2):
        await s.ev(f"{S}.Game.forceRender = {frames + 1}")
        await s.ev("(async()=>{for(let i=0;i<%d;i++) await new Promise(r=>requestAnimationFrame(r));})()" % (frames + 1))
        await s.pg.screenshot(path=os.path.join(run.ROOT, 'shots', f'{name}.png'), timeout=180000)
    async def sim(s, secs, ctl=None): await s.ev(f"window.__sim({secs}, {json.dumps(ctl or {})})")
    async def j(s, expr): return await s.ev(f"(()=>{{const S={S}; return {expr};}})()")
    async def do(s, stmt): return await s.ev(f"(()=>{{const S={S}; {stmt} }})()")
def go(fn):
    async def sc(pg):
        h = H(pg)
        await h.ev(SIM_JS)
        await h.ev(f"{S}.Game.manual = true")
        await fn(h)
    asyncio.run(run.main(sc))
    errs = [l for l in run.logs if l.startswith('[error]') or l.startswith('[pageerror]') or l.startswith('[warning]')]
    print('CONSOLE ISSUES:', len(errs)); print('\n'.join(errs[:30]))
