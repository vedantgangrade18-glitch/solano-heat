from harness import *
async def t(h):
    await h.shot('s01_title', 3)
    await h.pg.click('#btnPlay'); await h.sim(0.5)
    await h.do("S.Game.hour = 10.5;"); await h.sim(1)
    await h.shot('s02_start_day')
    # Driving downtown
    await h.do("const v = new S.Vehicle('tarpon', 5*94-3, 3*94+40, 0, {paint:0x16a3a3}); S.Player.place(v.x+1.8, v.z, 0);")
    await h.sim(0.05, {'enterPressed': True}); await h.sim(2.5, {'accel': 0.8})
    await h.shot('s03_drive_downtown')
    # Beach + pier at golden hour
    await h.do("S.Game.hour = 18.0; const v=S.Player.car; v.x=1000; v.z=330; v.h=0; v.vx=0; v.vz=0;")
    await h.sim(2, {'accel': 0.5})
    await h.shot('s04_beach_sunset')
    # Night downtown
    await h.do("S.Game.hour = 21.5; const v=S.Player.car; v.x=937; v.z=60; v.h=0; v.vx=0; v.vz=10;")
    await h.sim(2, {'accel': 0.4})
    await h.shot('s05_night_ocean_blvd')
    # Chase
    await h.do("S.Game.hour = 14; S.Police.setWanted(3);")
    await h.sim(8, {'accel': 0.5})
    await h.shot('s06_chase')
go(t)
