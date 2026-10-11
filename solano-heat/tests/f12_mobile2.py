from harness import *
async def t(h):
    await h.pg.tap('#btnPlay'); await h.sim(0.3)
    await h.do("S.Game.hour = 11; S.Hud.phone('Dolores', 'You made it. Come see me at the bodega, I have work for you. Look for the D.');")
    await h.do("const v = S.VEHICLES.find(v=>v.parked); S.Player.place(v.x + Math.cos(v.h)*2.2, v.z - Math.sin(v.h)*2.2, 0);")
    await h.sim(0.05, {'enterPressed': True}); await h.sim(1.0, {'accel': 0.6})
    await h.shot('m04_car_fixed')
go(t)
