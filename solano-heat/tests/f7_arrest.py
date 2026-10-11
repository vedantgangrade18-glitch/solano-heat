from harness import *
async def t(h):
    await h.pg.click('#btnPlay'); await h.sim(0.2)
    await h.do("const v = new S.Vehicle('marlin', 937, 120, 0); S.Player.place(v.x+1.8, v.z, 0);")
    await h.sim(0.05, {'enterPressed': True})
    await h.do("S.Police.setWanted(2); S.Police.seenNow(S.Player.x, S.Player.z);")
    for k in range(20):
        await h.sim(1.5, {'hb': True})
        r = await h.j("""({t:S.Game.time.toFixed(0), state:S.Game.state, wanted:S.Police.wanted, seen:S.Police.seen, arrest:S.Police.arrestT.toFixed(1), pspd:S.Player.car?S.Player.car.speed.toFixed(1):'-', cops:S.VEHICLES.filter(v=>v.police).map(v=>Math.round(Math.hypot(v.x-S.Player.x, v.z-S.Player.z))+':'+v.speed.toFixed(0)).join(' ')})""")
        print('stopped', r, flush=True)
        if r['state'] != 'play': break
    pass
    await h.wait(4.5)
    print('after', await h.j("({state:S.Game.state, wanted:S.Police.wanted, money:S.Game.money, px:S.Player.x.toFixed(0), pz:S.Player.z.toFixed(0), car:!!S.Player.car, big:document.getElementById('bigTitle').textContent})"))
    # On-foot arrest: officer should get out and chase
    await h.do("S.Police.setWanted(1); S.Police.seenNow(S.Player.x, S.Player.z);")
    for k in range(16):
        await h.sim(1.5)
        r = await h.j("""({t:S.Game.time.toFixed(0), state:S.Game.state, wanted:S.Police.wanted, arrest:S.Police.arrestT.toFixed(1), officers:S.PEDS.filter(p=>p.cop).map(p=>p.state+':'+Math.round(Math.hypot(p.x-S.Player.x,p.z-S.Player.z))).join(' '), cops:S.VEHICLES.filter(v=>v.police).map(v=>Math.round(Math.hypot(v.x-S.Player.x, v.z-S.Player.z))).join(' ')})""")
        print('foot', r, flush=True)
        if r['state'] != 'play': break
    pass
go(t)
