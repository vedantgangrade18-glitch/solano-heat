from harness import *
async def t(h):
    await h.shot('m01_title', 3)
    await h.pg.tap('#btnPlay'); await h.sim(0.3)
    await h.do("S.Game.hour = 11;")
    await h.do("const v = S.VEHICLES.find(v=>v.parked); S.Player.place(v.x + Math.cos(v.h)*2.2, v.z - Math.sin(v.h)*2.2, 0);")
    await h.sim(0.3)
    await h.shot('m02_foot')
    await h.sim(0.05, {'enterPressed': True}); await h.sim(1.5, {'accel': 0.6})
    await h.shot('m03_car')
    print(await h.j("({touch:document.body.classList.contains('touch'), incar:document.body.classList.contains('in-car'), w:innerWidth, sw:document.documentElement.scrollWidth})"))
go(t)
