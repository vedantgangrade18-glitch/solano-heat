from harness import *
async def t(h):
    await h.pg.click('#btnPlay'); await h.sim(0.2)
    # Put player in a car on Ocean Blvd, give 3 stars
    await h.do("const v = new S.Vehicle('marlin', 937, 120, 0); S.Player.place(v.x+1.8, v.z, 0);")
    await h.sim(0.05, {'enterPressed': True})
    await h.do("S.Police.setWanted(3); S.Police.seenNow(S.Player.x, S.Player.z);")
    for k in range(8):
        await h.sim(2, {'accel': 0.6})
        print('drive', await h.j("""({t:S.Game.time.toFixed(0), wanted:S.Police.wanted, seen:S.Police.seen, unseen:S.Police.unseenT.toFixed(1), cops:S.VEHICLES.filter(v=>v.police).map(v=>Math.round(Math.hypot(v.x-S.Player.x, v.z-S.Player.z))+(v.siren?'s':'')+(v.ai?v.ai.mode[0]:'-')).join(' '), z:S.Player.z.toFixed(0), arrest:S.Police.arrestT.toFixed(1)})"""))
    # Stop and wait for arrest
    for k in range(10):
        await h.sim(1.5, {'hb': True})
        r = await h.j("""({state:S.Game.state, arrest:S.Police.arrestT.toFixed(1), cops:S.VEHICLES.filter(v=>v.police).map(v=>Math.round(Math.hypot(v.x-S.Player.x, v.z-S.Player.z))).join(' '), officers:S.PEDS.filter(p=>p.cop).length})""")
        print('stopped', r)
        if r['state'] != 'play': break
    await h.shot('f6_arrest')
    await h.wait(4.5)
    print('after arrest', await h.j("({state:S.Game.state, wanted:S.Police.wanted, money:S.Game.money, px:S.Player.x.toFixed(0), pz:S.Player.z.toFixed(0), car:!!S.Player.car})"))
    # Lose the cops: wanted 1, teleport far away out of sight
    await h.do("S.Police.setWanted(1); S.Police.seenNow(S.Player.x, S.Player.z); S.Player.place(40, 40, 0);")
    for k in range(4):
        await h.sim(5)
        print('hiding', await h.j("({wanted:S.Police.wanted, seen:S.Police.seen, unseen:S.Police.unseenT.toFixed(1)})"))
go(t)
