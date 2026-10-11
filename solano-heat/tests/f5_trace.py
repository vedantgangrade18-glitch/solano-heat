from harness import *
async def t(h):
    await h.pg.click('#btnPlay'); await h.sim(0.2)
    await h.do("S.Player.place(5*94+12, 4*94+12, 0);")
    await h.do("""window.__hist = {}; window.__found = null;
      const DA = S.DriverAI.prototype; const oi = DA.initRoute; DA.initRoute = function(){ (window.__ev=window.__ev||[]).push([this.v.id, 'init', S.Game.time.toFixed(2), this.v.x.toFixed(1), this.v.z.toFixed(1), this.v.h.toFixed(2)]); return oi.call(this); };""")
    for k in range(240):
        await h.sim(0.25)
        r = await h.j("""(()=>{ for(const v of S.VEHICLES){ if(!(v.ai&&v.driver)) continue; const H=(window.__hist[v.id]=window.__hist[v.id]||[]); H.push([S.Game.time.toFixed(2), v.x.toFixed(1),v.z.toFixed(1),v.h.toFixed(2),v.vF.toFixed(1), v.ai.q.slice(0,3).map(q=>q.x.toFixed(0)+','+q.z.toFixed(0)+(q.stop?'S':'')+(q.slow?'c':'')).join(' '), 'A'+v.ai.A.a+','+v.ai.A.b+' B'+v.ai.B.a+','+v.ai.B.b, v.ai.passT.toFixed(1), v.ai.reverseT.toFixed(1), v.input.steer.toFixed(2)]); if(H.length>40) H.shift();
            const lx=Math.abs(v.x-Math.round(v.x/94)*94), lz=Math.abs(v.z-Math.round(v.z/94)*94);
            if(Math.min(lx,lz)>9.5 && !window.__found){ window.__found = {id:v.id, hist:H.slice(), ev:(window.__ev||[]).filter(e=>e[0]===v.id)}; return window.__found; } } return null; })()""")
        if r:
            print('OFFROAD', r['id'])
            for row in r['hist']: print('  ', row)
            print('inits', r['ev'])
            break
go(t)
