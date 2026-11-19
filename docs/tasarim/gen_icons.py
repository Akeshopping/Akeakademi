#!/usr/bin/env python3
"""Marka ikonları: açılıştaki Eşik K şekli (aynı path), yeni palet. Chrome ile çizilir."""
import asyncio,re,base64,sys,pathlib,io
from playwright.async_api import async_playwright
from PIL import Image
R=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else pathlib.Path(__file__).resolve().parent.parent.parent)
D="M6 60V32A26 26 0 0 1 32 6H58V60z M25 28v28h6V45.5l14.5 14.5H54L36 41.5 54 22.5v-.1h-8.3L31 38V28z"
def mark(a,b,vb="0 0 64 64",extra=""):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" {extra}><defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="6" y1="6" x2="58" y2="60"><stop offset="0" stop-color="{a}"/><stop offset="1" stop-color="{b}"/></linearGradient></defs><path fill-rule="evenodd" fill="url(#g)" d="{D}"/></svg>'
def tile(size,frac):
    m=mark('#F27D6D','#FAD6D0','0 0 64 64','style="width:100%;height:100%;display:block"')
    # şeklin optik merkezi (32,33): ortala
    return f'<body style="margin:0;width:{size}px;height:{size}px;background:radial-gradient(90% 90% at 50% 30%,#3A3340 0%,#28232C 70%);display:grid;place-items:center;overflow:hidden"><div style="width:{size*frac}px;height:{size*frac}px;transform:translateY({-size*frac*0.5/64}px)">{m}</div></body>'
def bare(size):
    m=mark('#D94F43','#F27D6D','6 6 52 54','style="width:100%;height:100%;display:block"')
    return f'<body style="margin:0;width:{size}px;height:{size}px;background:transparent;display:grid;place-items:center"><div style="width:{size}px;height:{size*54/52:.2f}px;max-height:{size}px">{m}</div></body>'
fb=re.search(r'font-family:"AKE Sans";src:url\(data:font/woff2;base64,([^)]+)\)',(R/'index.html').read_text(encoding='utf8')).group(1)
og=f'''<style>@font-face{{font-family:"S";src:url(data:font/woff2;base64,{fb}) format("woff2");font-weight:400 700}}
body{{margin:0;width:1200px;height:630px;background:radial-gradient(60% 90% at 88% 0%,rgba(242,125,109,.20) 0%,rgba(242,125,109,0) 70%),#28232C;font-family:S,sans-serif;position:relative;overflow:hidden}}
.e{{position:absolute;left:84px;top:170px;font:600 22px/1 S;letter-spacing:.34em;color:#F27D6D}}
h1{{position:absolute;left:84px;top:216px;margin:0;font:700 96px/1.04 S;color:#F8F5F0;letter-spacing:-.01em}}
p{{position:absolute;left:84px;top:418px;margin:0;width:520px;font:400 30px/1.45 S;color:#D2CAD4}}
.m{{position:absolute;left:764px;top:184px;width:252px;height:262px}}</style>
<body><div class="e">YKS 2027</div><h1>AKE<br>Akademi</h1><p>Soru bankası, denemeler ve kişisel çalışma planı.</p><div class="m">{mark('#F27D6D','#FAD6D0','6 6 52 54','style="width:100%;height:100%"')}</div></body>'''
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        async def shot(html,w,h,out,transparent=False):
            pg=await b.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
            await pg.set_content(html); await pg.wait_for_timeout(400)
            await pg.screenshot(path=str(out),omit_background=transparent,type='png'); await pg.close()
        I=R/'icons'
        await shot(tile(512,.62),512,512,I/'icon-512.png'); await shot(tile(192,.62),192,192,I/'icon-192.png')
        await shot(tile(512,.42),512,512,I/'maskable-512.png')
        await shot(tile(180,.62),180,180,I/'apple-touch-icon.png')
        await shot(tile(144,.6),144,144,I/'eposta-logo-v2.png')
        for n in (32,48): await shot(bare(n),n,n,I/f'favicon-{n}.png',True)
        await shot(bare(256),256,256,pathlib.Path('/tmp/fav256.png'),True)
        await shot(og,1200,630,R/'og.png')
        await b.close()
asyncio.run(main())
import shutil
shutil.copy(R/'icons/apple-touch-icon.png',R/'apple-touch-icon.png'); shutil.copy(R/'icons/apple-touch-icon.png',R/'apple-touch-icon-precomposed.png')
big=Image.open('/tmp/fav256.png').convert('RGBA'); big.save(R/'favicon.ico',sizes=[(16,16),(32,32),(48,48)])
for f in ['icons/icon-512.png','icons/icon-192.png','icons/maskable-512.png','icons/apple-touch-icon.png','icons/eposta-logo-v2.png']:
    im=Image.open(R/f).convert('RGB'); im.save(R/f,optimize=True)   # opak kare (önceki sürümlerle aynı mod)
Image.open(R/'og.png').convert('RGB').quantize(colors=256).save(R/'og.png',optimize=True)
print('tamam')
