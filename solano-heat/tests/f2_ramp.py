from harness import *
async def t(h):
    await h.pg.click('#btnPlay'); await h.sim(0.2)
    await h.do("S.Traffic.target=0; S.Traffic.parkedTarget=0; for (const v of [...S.VEHICLES]) v.dispose(); const v = new S.Vehicle('tarpon', 974, 240, Math.PI); S.Player.place(v.x+1.6, v.z, 0);")
    await h.sim(0.05, {'enterPressed': True})
    await h.do("const v=S.Player.car; v.vx=0; v.vz=-32; S.Game.money=1000;")
    maxy, air = 0, 0
    for i in range(30):
        await h.sim(0.1, {'accel': 1})
        r = await h.j("({y:S.Player.car.y, air:S.Player.car.air})")
        maxy = max(maxy, r['y']); air += 0.1 if r['air'] else 0
    print('ramp maxY', round(maxy, 2), 'air', round(air, 1), 'money', await h.j("S.Game.money"), 'big', await h.j("document.getElementById('bigTitle').textContent + ' / ' + document.getElementById('bigSub').textContent"), 'health', await h.j("S.Player.car.health.toFixed(0)"))
    # Crash into a building
    await h.do("const v=S.Player.car; const b=S.World.boxes.find(b=>b.h>20 && b.x0>470 && b.x0<560 && b.z0>380 && b.z0<420); window.__b=b; v.x=b.x0-25; v.z=(b.z0+b.z1)/2; v.y=0.15; v.h=Math.PI/2; v.vx=30; v.vz=0; v.air=false; v.health=100;")
    await h.sim(2)
    print('crash', await h.j("({x:S.Player.car.x.toFixed(1), wall:window.__b.x0.toFixed(1), v:S.Player.car.speed.toFixed(1), health:S.Player.car.health.toFixed(0)})"))
    # Explosion: set health low and ram again
    await h.do("const v=S.Player.car; v.x=window.__b.x0-25; v.vx=30; v.vz=0; v.health=10;")
    await h.sim(7)
    print('after explode', await h.j("({wrecked: S.VEHICLES.some(v=>v.wrecked), inCar: !!S.Player.car, state: S.Game.state, hp: S.Player.health.toFixed(0)})"))
go(t)
