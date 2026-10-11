import asyncio, os, time
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
THREE = open(f'{ROOT}/node_modules/three/build/three.min.js').read()
URL = 'file://' + ROOT + '/dist/test.html#debug'
logs = []
async def main(scenario):
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'])
        mobile = bool(os.environ.get('MOBILE'))
        ctx = await b.new_context(viewport={'width': int(os.environ.get('VW', 960)), 'height': int(os.environ.get('VH', 540))}, has_touch=mobile, is_mobile=mobile, device_scale_factor=2 if mobile else 1)
        pg = await ctx.new_page()
        pg.on('console', lambda m: logs.append(f'[{m.type}] {m.text}'))
        pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
        async def route(r):
            u = r.request.url
            if 'three.min.js' in u: await r.fulfill(body=THREE, content_type='application/javascript')
            elif 'fonts.googleapis' in u: await r.fulfill(body='', content_type='text/css')
            else: await r.abort()
        await pg.route('https://**/*', route)
        if os.environ.get('NOSHADOW'):
            await pg.add_init_script("try{localStorage.setItem('solano-heat-save-v1', JSON.stringify({money:500,mission:0,tapes:[],jumps:[],shadows:false}))}catch(e){}")
        t0 = time.time()
        await pg.goto(URL)
        await pg.wait_for_function('window.__solano && window.__solano.Game.state === "title"', timeout=60000)
        print('boot secs', round(time.time() - t0, 1), flush=True)
        await scenario(pg)
        await b.close()
