#!/usr/bin/env python3
"""AKE Ritmi görsel katmanını yeniden üretir: main'deki index.html -> tasarım dalındaki index.html.

Kullanım (depo kökünden):  python3 docs/tasarim/uret.py [--base origin/main] [--out index.html]
Taban sürüm (--base) varsayılan olarak 870e057 (görsel yenilemeden önceki özgün main); o yoksa origin/main, main. NOT: main artık üretilmiş dosyayı içerir, tabanı main yapmayın (çift uygulanır). Başka hiçbir yere yazmaz.
Sabit yerel yol yok: betik kendi klasörünü (docs/tasarim/) ve iki üst klasörü (depo kökü) kullanır.
Ayrıntı: docs/tasarim/README.md"""
import re,subprocess,sys,pathlib,os,argparse
T=pathlib.Path(__file__).resolve().parent
ap=argparse.ArgumentParser(); ap.add_argument('--base'); ap.add_argument('--out',default='index.html'); ap.add_argument('--repo',default=str(T.parent.parent)); A=ap.parse_args()
W=pathlib.Path(A.repo).resolve()
def _ref():
    for r in ([A.base] if A.base else [])+['870e057','origin/main','main']:
        if subprocess.run(['git','rev-parse','--verify','-q',r+':index.html'],cwd=W,capture_output=True).returncode==0: return r
    sys.exit('taban sürüm bulunamadı: --base verin (örn. origin/main)')
REF=_ref()
raw=subprocess.check_output(['git','show',REF+':index.html'],cwd=W)
CRLF=raw.count(b'\r\n')==raw.count(b'\n')
src=raw.decode('utf8').replace('\r\n','\n')

# ---- 0a. GÜVENLİK: taban zaten üretilmiş dosya ise dur (aksi hâlde tasarım iki kez uygulanır)
_URETILMIS=[k for k in ('?v=ritim1','AKE Rakam','data-pal=') if k in src]
if _URETILMIS:
    sys.exit('HATA: taban '+REF+' zaten üretilmiş bir index.html içeriyor ('+', '.join(_URETILMIS)+'). '
             'Tasarım iki kez uygulanmaz. Özgün tabanı verin: --base 870e057 (görsel yenilemeden önceki main).')

# ---- 0. giriş/ilk kullanım + AI sohbet kaydırma yaması (taban: özgün main; diğer düzenlemelerden ÖNCE uygulanır)
import tempfile,shutil
def _yama(metin,yama):
    d=tempfile.mkdtemp()
    try:
        (pathlib.Path(d)/'index.html').write_text(metin,encoding='utf8',newline='\n')
        r=subprocess.run(['git','apply','--unsafe-paths','--directory=.','-p1',str(yama)],cwd=d,capture_output=True,text=True)
        if r.returncode: sys.exit('giris_ai.patch uygulanamadı (taban değişmiş olabilir): '+r.stderr[:400])
        return (pathlib.Path(d)/'index.html').read_text(encoding='utf8')
    finally: shutil.rmtree(d,ignore_errors=True)
src=_yama(src,T/'giris_ai.patch')

# ---- 1. token blocks
a=src.index(':root{\n  --paper:#f5f1e8;')
b=src.index('\n*{box-sizing:border-box}',a)
src=src[:a]+(T/'tokens.css').read_text(encoding='utf8').rstrip('\n')+src[b:]

# ---- 2. later token override (green ink2) -> removed; tokens now single-source
old=':root{--ink:#30302b;--ink2:#254236;--ink3:#66625a;--pencil:#30302b;--card:#fbf8f1;--line:#e0d8c8;--line2:#ebe4d5;--r:12px}'
assert src.count(old)==1; src=src.replace(old,'/* (token geçersiz kılması kaldırıldı: tokenlar tek yerde) */')


# ---- 2b. fontlar: rakam (çizgisiz sıfır) + soru metni serifi (açılıştaki AKE Serif ile aynı dosya)
import base64
_rak=base64.b64encode((T/'rakam.woff2').read_bytes()).decode()
_css=(W/'acilis/ortak/ortak.css').read_text(encoding='utf8')
_ser=re.search(r'font-family:"AKE Serif";src:url\(data:font/woff2;base64,([^)]+)\)',_css).group(1)
_ff=('@font-face{font-family:"AKE Rakam";src:url(data:font/woff2;base64,'+_rak+') format("woff2");font-weight:100 900;font-style:normal;unicode-range:U+0030-0039;font-display:swap}\n'
     '@font-face{font-family:"AKE Serif";src:url(data:font/woff2;base64,'+_ser+') format("woff2");font-weight:400 600;font-style:normal;font-display:swap}\n')
_i=src.index('@font-face{font-family:"AKE Sans"'); _j=src.index('\n',_i)+1
src=src[:_j]+_ff+src[_j:]
assert src.count('.qtext,.passage{font-family:"Source Serif 4",Georgia,"Times New Roman",serif}')==1
src=src.replace('.qtext,.passage{font-family:"Source Serif 4",Georgia,"Times New Roman",serif}','.qtext,.passage{font-family:var(--f-serif)}')

# ---- 3. split into style blocks and process
HEXCTX_DARK=re.compile(r'\.top\b|\.tabbar|\.side\b|\.vitrin|\.hero|\[data-theme="dark"\]|\.glass-d|\.yn-hero|\.sc3|\.adm-|\.atl-|\.lb-|\.logo-tile|\.giris|\.home-head|\.hv|\.vhead')
HEX={ '#f5f1e8':'var(--porcelain-fixed)','#f5f0e6':'var(--porcelain-fixed)','#171715':'var(--ink-fixed)',
 '#30302b':'var(--ink-lift)','#254236':'var(--ink-fixed)','#d9bf8a':'var(--coral-light)','#1a0d06':'var(--ink-fixed)',
 '#d3ccbd':'var(--on-dark-2)','#d2ccbd':'var(--on-dark-2)','#a9a394':'var(--on-dark-3)','#23221f':'var(--d-card)','#2b2a26':'var(--d-sunk)',
 '#9bbfac':'var(--coral-light)','#d4e5db':'var(--on-dark)','#cbd6ce':'var(--on-dark-2)','#d5ddcf':'var(--on-dark-2)',
 '#fffdf8':'var(--card)','#fff':'var(--white)','#ffffff':'var(--white)',
 '#5f9a80':'var(--coral-light)','#8fb3a0':'var(--coral-light)','#1b1a18':'var(--sunk)','#2a2925':'var(--raised)','#201f1c':'var(--card)','#35332e':'var(--line)',
 '#26302b':'var(--ink-fixed)','#cfc9ba':'var(--on-dark-2)','#cfc8b9':'var(--on-dark-2)','#e3eae5':'var(--on-dark-2)','#ecd9a8':'var(--coral-light)','#d9c28f':'var(--coral-light)','#1c372c':'var(--ink-lift)','#142820':'var(--ink-fixed)','#6f5a2f':'var(--coral-ink)','#3d6b57':'var(--coral)','#b9873a':'var(--warn)','#b4503f':'var(--bad)','#d1b98c':'var(--coral-light)','#c3a874':'var(--coral-light)'}
GOLD={'#c5a572','#b69a68','#c9a86a'}
RGBA={ '197,165,114':'242,125,109','182,154,104':'217,79,67','37,66,54':'40,35,44','23,23,21':'40,35,44','245,241,232':'248,245,240',
 '241,223,182':'250,214,208','57,191,160':'242,125,109','48,48,43':'58,51,64','111,90,47':'160,53,45','74,128,102':'84,116,95',
 '15,30,24':'30,26,33','14,26,20':'30,26,33','155,191,172':'242,125,109','95,154,128':'242,125,109','143,179,160':'242,125,109','213,221,207':'248,245,240'}
datare=re.compile(r'url\((?:"data:[^"]*"|\'data:[^\']*\'|data:[^)]*)\)')
rulere=re.compile(r'([^{}]+)\{([^{}]*)\}')
stats={'hex':0,'rgba':0}
def fix_rule(m):
    sel,body=m.group(1),m.group(2)
    dark=bool(HEXCTX_DARK.search(sel))
    def hx(mm):
        h=mm.group(0).lower()
        if h in GOLD: stats['hex']+=1; return 'var(--coral-light)' if dark else 'var(--coral-deco)'
        if h in HEX: stats['hex']+=1; return HEX[h]
        return mm.group(0)
    body=re.sub(r'#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b',hx,body)
    def rg(mm):
        k=','.join(x.strip() for x in mm.group(1).split(','))
        if k in RGBA: stats['rgba']+=1; return 'rgba('+RGBA[k]+','
        return mm.group(0)
    body=re.sub(r'rgba\(\s*(\d+\s*,\s*\d+\s*,\s*\d+)\s*,',rg,body)
    return sel+'{'+body+'}'
def drop_aur(css):
    def f(m):
        sel,body=m.group(1),m.group(2)
        parts=[x.strip() for x in sel.split(',')]
        keep=[x for x in parts if '#aur' not in x]
        if len(keep)==len(parts): return m.group(0)
        if not keep: return ''
        return ','.join(keep)+'{'+body+'}'
    return rulere.sub(f,css)
def fix_style(css):
    css=drop_aur(css)
    keep=[]; 
    def mask(m): keep.append(m.group(0)); return f'\x00{len(keep)-1}\x00'
    css=datare.sub(mask,css)
    # leave the token blocks (already final) untouched
    css=rulere.sub(fix_rule,css)
    return re.sub(r'\x00(\d+)\x00',lambda m:keep[int(m.group(1))],css)
# tokens block must not be re-mapped: protect it
tok=(T/'tokens.css').read_text(encoding='utf8').rstrip('\n')
PH='\x01TOKENS\x01'; src=src.replace(tok,PH,1)
out=[];pos=0
for m in re.finditer(r'(<style[^>]*>)(.*?)(</style>)',src,flags=re.S):
    out.append(src[pos:m.start(2)]); out.append(fix_style(m.group(2))); pos=m.end(2)
out.append(src[pos:]); src=''.join(out).replace(PH,tok)

# ---- 4. sc-* tokens (soru çözme / konu seçimi)
src=re.sub(r':root\{--sc-sel:[^}]*\}', ':root{--sc-sel:var(--coral);--sc-selbg:var(--coral-soft);--sc-on:var(--on-coral);--sc-gold:var(--coral-deco)}',src,count=1)
src=re.sub(r':root\[data-theme="dark"\]\{--sc-sel:[^}]*\}', ':root[data-theme="dark"]{--sc-sel:var(--coral);--sc-selbg:var(--coral-soft);--sc-on:var(--on-coral)}',src,count=1)

# ---- 5. theme-color meta
src=src.replace('<meta name="theme-color" content="#f5f1e8">','<meta name="theme-color" content="#28232C">')

# ---- 6. component layer
ritim=(T/'ritim.css').read_text(encoding='utf8') if (T/'ritim.css').exists() else ''
if ritim:
    i=src.index('<script>',src.rindex('</style>'))
    src=src[:i]+'<style id="ake-ritmi">\n'+ritim+'\n</style>\n'+src[i:]

# ---- 7. JS edits
exec((T/'jsedits.py').read_text(encoding='utf8'))


# ---- 7b. script içine gömülü renkler (tanıtım CSS'i, tuval çizimleri, SVG özellikleri): eski altın/orman → yeni palet
SJ={'#171715':'#28232C','#f5f1e8':'#F8F5F0','#f5f0e6':'#F8F5F0','#f3efe6':'#F8F5F0','#254236':'#B73F36','#b69a68':'#D94F43','#c9a86a':'#F27D6D',
 '#c5a572':'#F27D6D','#f1dfb6':'#FAD6D0','#f1dcae':'#FAD6D0','#fffbef':'#FAD6D0','#ffe3a6':'#FAD6D0','#ffcb6b':'#F27D6D','#e8c98a':'#F27D6D','#d4b06a':'#F27D6D','#a98440':'#D94F43',
 '#5f9a80':'#F27D6D','#8fb3a0':'#F27D6D','#7fae96':'#F27D6D','#d5ddcf':'#F8F5F0','#30302b':'#3A3340','#00d9a3':'#F27D6D','#262622':'#3A3340','#121210':'#1E1A22',
 '#22211e':'#322C38','#2a2925':'#3A3340','#d0cabc':'#D2CAD4','#aaa497':'#B3AAB8','#3d3b35':'#4A4352','#33312c':'#3F3847','#d1b98c':'#FAD6D0','#39bfa0':'#5FC4CC','#d9a38a':'#C79BE0','#1c372c':'#3A3340'}
SR={'37,66,54':'40,35,44','201,168,106':'242,125,109','95,154,128':'242,125,109','245,240,230':'248,245,240','23,23,21':'40,35,44','182,154,104':'217,79,67','0,217,163':'242,125,109'}
_s=src.index('<script>',src.rindex('</style>')); head,body=src[:_s],src[_s:]
# promo bölge renkleri (ders renkleri koyu temadaki ders tokenları)
for a,b in (('n: "Matematik", s: ["mat", "geo", "amat"], c: "#5f9a80"','n: "Matematik", s: ["mat", "geo", "amat"], c: "#8FB4F0"'),
            ('n: "Türkçe", s: ["turkce"], c: "#c9a86a"','n: "Türkçe", s: ["turkce"], c: "#C79BE0"'),
            ('"abiyoloji"], c: "#39bfa0"','"abiyoloji"], c: "#5FC4CC"'),
            ('"mantik"], c: "#d5ddcf"','"mantik"], c: "#E0B050"'),
            ('s: ["ingilizce"], c: "#d5ddcf"','s: ["ingilizce"], c: "#EE8FBF"')):
    assert body.count(a)==1,a; body=body.replace(a,b)
body=re.sub(r'#[0-9a-fA-F]{6}\b',lambda m:SJ.get(m.group(0).lower(),m.group(0)),body)
body=re.sub(r'rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)',lambda m:m.group(0)[:m.group(0).index('(')+1]+SR.get(f'{m.group(1)},{m.group(2)},{m.group(3)}',f'{m.group(1)},{m.group(2)},{m.group(3)}'),body)
src=head+body


# stil bloklarındaki sabit mercan ışıkları palet değişkenlerine bağlanır (tuval/JS dizgilerine dokunulmaz)
def _stil_rgb(m):
    return m.group(1)+m.group(2).replace('rgba(217,79,67,','rgba(var(--coral-deco-rgb),').replace('rgba(242,125,109,','rgba(var(--coral-light-rgb),')+m.group(3)
src=re.sub(r'(<style[^>]*>)(.*?)(</style>)',_stil_rgb,src,flags=re.S)
src=src.replace('?v=cb84d327ff','?v=ritim1')
for _f in ('jsedits_acilis.py','jsedits_renk.py','jsedits_video.py','jsedits_tanitim.py','jsedits_studyo.py','jsedits_senkron.py'):
    if (T/_f).exists(): exec((T/_f).read_text(encoding='utf8'))
(W/A.out).write_bytes((src.replace('\n','\r\n') if CRLF else src).encode('utf8'))
print('taban:',REF,'| mapped hex',stats['hex'],'rgba',stats['rgba'],'size',len(src))

