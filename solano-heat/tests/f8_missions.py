from harness import *
async def tp_drive(h, x, z, secs=1.0):
    # teleport player's car next to a target then idle into it
    await h.do(f"const v=S.Player.car; v.x={x}; v.z={z}; v.y=S.World && 0; v.vx=0; v.vz=0; v.av=0; v.air=false;")
    await h.sim(secs, {'hb': True})
async def status(h, tag):
    print(tag, await h.j("""({act: S.Missions.active ? S.Missions.active.title : null, stage:S.Missions.stage, idx:S.Missions.idx, obj:document.getElementById('objective').textContent, money:S.Game.money, wanted:S.Police.wanted, timer:S.Missions.timer.toFixed(0), big:document.getElementById('bigTitle').textContent, car:S.Player.car?S.Player.car.type:null})"""))
async def t(h):
    await h.pg.click('#btnPlay'); await h.sim(0.2)
    await h.do("S.Game.hour = 12;")
    # Mission 1: walk into bodega marker
    await h.do("const b=S.World.poi.bodega; S.Player.place(b.x, b.z, 0);")
    await h.sim(0.3); await status(h, 'M1 start')
    await h.do("const v=S.Missions.vehicles.van; S.Player.place(v.x + Math.cos(v.h)*2, v.z - Math.sin(v.h)*2, 0);")
    await h.sim(0.1, {'enterPressed': True}); await h.sim(0.2); await status(h, 'M1 in van')
    await tp_drive(h, 'S.World.poi.hotel1.x', 'S.World.poi.hotel1.z'); await status(h, 'M1 hotel1')
    await tp_drive(h, 'S.World.poi.hotel2.x', 'S.World.poi.hotel2.z'); await status(h, 'M1 hotel2')
    await h.shot('f8_m1_pass')
    # Mission 2
    await h.sim(0.1, {'enterPressed': True}); await h.sim(0.6)
    await h.do("const b=S.World.poi.bodega; S.Player.place(b.x, b.z, 0);"); await h.sim(0.3); await status(h, 'M2 start')
    await h.do("const v=S.Missions.vehicles.tarpon; S.Player.place(v.x + Math.cos(v.h)*2, v.z - Math.sin(v.h)*2, 0);")
    await h.sim(0.1, {'enterPressed': True}); await h.sim(0.2); await status(h, 'M2 in tarpon')
    await tp_drive(h, 'S.World.poi.garage.x', 'S.World.poi.garage.z'); await status(h, 'M2 garage w/ cops')
    await h.do("S.Police.setWanted(0);"); await h.sim(0.6, {'hb': True}); await status(h, 'M2 garage clean')
    await h.wait(0.8); await h.sim(0.3); await status(h, 'M2 after fade')
    # Mission 3: checkpoints
    await h.do("const b=S.World.poi.bodega; S.Player.place(b.x, b.z, 0); for (const v of [...S.VEHICLES]) if (v.police) v.dispose(); S.Police.setWanted(0);"); await h.sim(0.3); await status(h, 'M3 start')
    await h.do("const v=S.Missions.vehicles.racer; S.Player.place(v.x + Math.cos(v.h)*2, v.z - Math.sin(v.h)*2, 0);")
    await h.sim(0.1, {'enterPressed': True}); await h.sim(0.2)
    await tp_drive(h, 937, 70, 0.3); await status(h, 'M3 at start line')
    pts = [[937, 250], [937, 520], [937, 770], [870, 843], [660, 843], [473, 760], [473, 520], [473, 290], [473, 110], [660, 97], [850, 97], [937, 210]]
    for x, z in pts: await tp_drive(h, x, z, 0.2)
    await status(h, 'M3 done')
    # Mission 4: pier package
    await h.sim(0.1, {'enterPressed': True}); await h.sim(0.6)
    await h.do("const b=S.World.poi.bodega; S.Player.place(b.x, b.z, 0);"); await h.sim(0.3); await status(h, 'M4 start')
    await h.do("const p=S.World.poi.pierEnd; S.Player.place(p.x, p.z, 0);"); await h.sim(0.3); await status(h, 'M4 picked')
    await h.do("S.Player.place(49, 181, 0);"); await h.sim(0.3); await status(h, 'M4 delivered')
    # Mission 5
    await h.do("S.Police.setWanted(0); const b=S.World.poi.bodega; S.Player.place(b.x, b.z, 0);"); await h.sim(0.3); await status(h, 'M5 start')
    await h.do("const p=S.World.poi.tower; S.Player.place(p.x, p.z, 0);"); await h.sim(0.3); await status(h, 'M5 case')
    await h.sim(3)
    print('heli', await h.j("!!S.Police.heli"))
    await h.do("const p=S.World.poi.dock; S.Player.place(p.x, p.z, 0);"); await h.sim(0.3); await status(h, 'M5 dock')
    print('save', await h.j("JSON.stringify(S.Store.data)"))
go(t)
