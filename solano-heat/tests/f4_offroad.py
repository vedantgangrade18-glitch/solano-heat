from harness import *
async def t(h):
    await h.pg.click('#btnPlay'); await h.sim(0.2)
    await h.do("S.Player.place(5*94+12, 4*94+12, 0);")
    await h.do("""window.__hist = {}; window.__found = null;""")
    for k in range(120):
        await h.sim(0.5)
        r = await h.j("""(()=>{ for(const v of S.VEHICLES){ if(!(v.ai&&v.driver)) continue; const H=(window.__hist[v.id]=window.__hist[v.id]||[]); H.push([v.x.toFixed(1),v.z.toFixed(1),v.h.toFixed(2),v.speed.toFixed(1),v.ai.q.length? v.ai.q[0].x.toFixed(0)+','+v.ai.q[0].z.toFixed(0):'', v.ai.passT.toFixed(1), v.ai.reverseT.toFixed(1), v.ai.mode, v.ai.pullOver.toFixed(1)]); if(H.length>14) H.shift();
            const lx=Math.abs(v.x-Math.round(v.x/94)*94), lz=Math.abs(v.z-Math.round(v.z/94)*94);
            if(Math.min(lx,lz)>9.5 && !window.__found){ window.__found = {id:v.id, type:v.type, police:v.police, hist:H.slice()}; return window.__found; } } return null; })()""")
        if r:
            print('OFFROAD at t=', k*0.5, r['id'], r['type'], 'police', r['police'])
            for row in r['hist']: print('  ', row)
            break
go(t)
