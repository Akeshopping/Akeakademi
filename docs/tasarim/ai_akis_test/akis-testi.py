# AI öğretmen akış kaydırması testi. Gerçek webAI call() kodunu, yerel sahte SSE sunucusuna (sahte-sunucu.mjs) karşı çalıştırır.
# Kullanım: REPO=$PWD node docs/tasarim/ai_akis_test/sahte-sunucu.mjs &  ;  python3 docs/tasarim/ai_akis_test/akis-testi.py  (playwright + google-chrome gerekir)
import asyncio,sys,json
from playwright.async_api import async_playwright
PORT=8795
MEAS="""()=>{const c=document.querySelector('.composer');const cr=c?c.getBoundingClientRect():null;const l=document.querySelector('#chat > .msg:last-child');const lb=l?l.getBoundingClientRect().bottom:null;const doc=document.documentElement;return {sy:Math.round(scrollY),max:Math.round(doc.scrollHeight-innerHeight),gap:cr&&lb!=null?Math.round(cr.top-lb):null,compOK:cr?(cr.top>=0&&cr.bottom<=innerHeight+1):null,busy:UI.chatBusy,n:UI.chat.length,sw:doc.scrollWidth,w:innerWidth}}"""
SEED="""()=>{webAIAc();AI.ready=true;UI.chat=[1,2,3,4,5,6].map(i=>({role:i%2?'user':'assistant',content:'Önceki mesaj '+i+' '+'önceki içerik '.repeat(30)}));render()}"""
async def new(b,w,h,th,mobile):
    ctx=await b.new_context(viewport={'width':w,'height':h},service_workers='block',is_mobile=mobile,has_touch=mobile,device_scale_factor=2 if mobile else 1)
    await ctx.add_init_script(f"Object.defineProperty(navigator,'hardwareConcurrency',{{get:()=>8}});localStorage.setItem('ake.intro','1');localStorage.setItem('ake.intro3d','1');localStorage.setItem('ake.tema','{th}')")
    pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)[:120]))
    await pg.goto(f'http://localhost:{PORT}/index.html#ogretmen'); await pg.wait_for_timeout(1800)
    await pg.evaluate("document.getElementById('atlIntro')?.remove()")
    await pg.evaluate(SEED); await pg.wait_for_timeout(300)
    await pg.evaluate("window.scrollTo(0,document.documentElement.scrollHeight)"); await pg.wait_for_timeout(200)
    return ctx,pg,errs
SAMP="""()=>{window.__G=[];window.__stop=false;(function loop(){if(window.__stop)return;requestAnimationFrame(()=>{setTimeout(()=>{if(UI.chatBusy){const c=document.querySelector('.composer'),l=document.querySelector('#chat > .msg:last-child');if(c&&l){const cr=c.getBoundingClientRect();window.__G.push([Math.round(cr.top-l.getBoundingClientRect().bottom),cr.bottom<=innerHeight+1?1:0,Math.round(scrollY)])}}},0);loop()})})();return 1}"""
async def wait_done(pg,mx=30):
    for i in range(mx*10):
        await pg.wait_for_timeout(100)
        if not await pg.evaluate("UI.chatBusy"): return
async def stat(pg):
    G=await pg.evaluate("window.__G");return G
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        for w,h,th,mob in [(390,844,'light',True),(320,640,'dark',True),(820,1180,'light',False),(1440,900,'dark',False)]:
            tag=f'{w}{th[0]}'
            for nm,msg in [('KISA','Zincir kuralı nedir?'),('UZUN','UZUN anlat')]:
                ctx,pg,errs=await new(b,w,h,th,mob); await pg.evaluate(SAMP)
                await pg.evaluate(f"setTimeout(()=>sendChat({json.dumps(msg)}),0)"); await wait_done(pg); await pg.wait_for_timeout(500)
                G=await stat(pg); fin=await pg.evaluate(MEAS)
                print(f'{tag} A-{nm}: kare {len(G)} min gap(boyama sonrası) {min(g[0] for g in G)} yazma alanı hep görünür {all(g[1] for g in G)} son gap {fin["gap"]} taşma {fin["sw"]>fin["w"]} err {errs[:1]}',flush=True)
                if nm=='UZUN': await pg.screenshot(path=f'/tmp/s6/{tag}-son.png')
                await ctx.close()
            ctx,pg,errs=await new(b,w,h,th,mob); await pg.evaluate(SAMP)
            await pg.evaluate("setTimeout(()=>sendChat('UZUN ikinci'),0)"); await pg.wait_for_timeout(3500)
            await pg.evaluate("window.scrollTo(0,Math.max(0,scrollY-500))"); await pg.wait_for_timeout(300); y0=await pg.evaluate("Math.round(scrollY)")
            await pg.evaluate("window.__G=[]"); await wait_done(pg); await pg.wait_for_timeout(800)
            G=await stat(pg); ys=[g[2] for g in G]; yend=await pg.evaluate("Math.round(scrollY)")
            print(f'{tag} B yukarıda: y0 {y0} akışta {min(ys)}-{max(ys)} bitişte {yend} yazma alanı görünür {all(g[1] for g in G)} -> {"ZORLANDI" if max(ys)>y0+8 or yend>y0+8 else "zorlanmadı"}',flush=True)
            await pg.screenshot(path=f'/tmp/s6/{tag}-B.png'); await ctx.close()
            ctx,pg,errs=await new(b,w,h,th,mob); await pg.evaluate(SAMP)
            await pg.evaluate("setTimeout(()=>sendChat('UZUN üçüncü'),0)"); await pg.wait_for_timeout(3000)
            await pg.evaluate("window.scrollTo(0,Math.max(0,scrollY-500))"); await pg.wait_for_timeout(1200)
            await pg.evaluate("window.scrollTo(0,document.documentElement.scrollHeight)"); await pg.wait_for_timeout(500)
            await pg.evaluate("window.__G=[]"); await wait_done(pg)
            G=await stat(pg); print(f'{tag} C alta dönünce: kare {len(G)} min gap {min(g[0] for g in G) if G else None} (>=0 beklenir)',flush=True); await ctx.close()
        await b.close()
asyncio.run(main())
