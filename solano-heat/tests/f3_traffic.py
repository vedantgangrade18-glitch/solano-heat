from harness import *
import time
async def t(h):
    await h.pg.click('#btnPlay'); await h.sim(0.2)
    await h.do("S.Player.place(5*94+12, 4*94+12, 0);")
    await h.do("""window.__st = {stuck:{}, hits:0, maxStuck:0}; const G=S.Game; const o=G.onVehicleHit.bind(G); G.onVehicleHit=function(v,other,imp,kind,x,z){ if(v.ai && other && other.ai && v.id<other.id && imp>2.5) window.__st.hits++; return o(v,other,imp,kind,x,z); };""")
    t0 = time.time()
    for k in range(int(__import__("os").environ.get("N", 5))):
        await h.sim(10)
        r = await h.j("""(()=>{ const ai=S.VEHICLES.filter(v=>v.ai&&v.driver); let slow=0, sum=0, off=0, offL=[];
          for(const v of ai){ sum+=v.speed; if(v.speed<0.3) slow++;
            const lx=Math.abs(v.x-Math.round(v.x/94)*94), lz=Math.abs(v.z-Math.round(v.z/94)*94);
            if(Math.min(lx,lz)>9.5){ off++; offL.push([Math.round(v.x),Math.round(v.z)]); }
            const st=window.__st.stuck; st[v.id] = v.speed<0.3 ? (st[v.id]||0)+10 : 0; window.__st.maxStuck=Math.max(window.__st.maxStuck, st[v.id]); }
          return {t:S.Game.time.toFixed(0), ai:ai.length, avg:(sum/Math.max(1,ai.length)).toFixed(1), stopped:slow, offroad:off, offL:offL.slice(0,3), hits:window.__st.hits, maxStuck:window.__st.maxStuck, peds:S.PEDS.length, pedsOffWalk:S.PEDS.filter(p=>p.state==='walk' && !S.World.blocks.some(b=>p.x>b.x0-0.5&&p.x<b.x1+0.5&&p.z>b.z0-0.5&&p.z<b.z1+0.5)).length, wrecked:S.VEHICLES.filter(v=>v.wrecked||v.burning).length};})()""")
        print(r, flush=True)
    print('wall secs', round(time.time() - t0, 1))
    await h.shot('f3_traffic')
go(t)
