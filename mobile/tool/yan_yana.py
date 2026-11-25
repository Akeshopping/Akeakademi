"""Site ve uygulama ekranlarını AYNI test verisiyle yan yana birleştirir (sol: site, sağ: Android emülatörü/iOS simülatörü uygulaması).
Kullanım: python3 mobile/tool/yan_yana.py <site klasörü> <uygulama klasörü> <çıktı klasörü> <uygulama dosya soneki, örn. -acik>"""
import sys, os
from PIL import Image, ImageDraw, ImageFont
site, app, cikti, sonek = sys.argv[1:5]
os.makedirs(cikti, exist_ok=True)
ESLEME = [('Ana sayfa', '10-ana', '10-ana'), ('Soru Merkezi', '20-soru-merkezi', '20-soru-sec-sinav'), ('Deneme', '45-deneme', '45-deneme-baslangic'),
          ('AI (boş sohbet)', '51-ai', '50b-ai-bos'), ('Plan', '63-plan', '63-plan-gorevli'), ('Gelişim', '61-gelisim', '61-gelisim')]
def font(n):
    for f in ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf']:
        if os.path.exists(f): return ImageFont.truetype(f, n)
    return ImageFont.load_default()
for ad, s, a in ESLEME:
    ps = os.path.join(site, s + '.png')
    pa = next((os.path.join(app, x) for x in os.listdir(app) if x.endswith(a + sonek + '.png')), None)
    if not (os.path.exists(ps) and pa): print('EKSIK', ad, ps, pa); continue
    A, B = Image.open(ps).convert('RGB'), Image.open(pa).convert('RGB')
    h = 1552; A = A.resize((int(A.width * h / A.height), h)); B = B.resize((int(B.width * h / B.height), h))
    W = Image.new('RGB', (A.width + B.width + 30, h + 70), 'white'); d = ImageDraw.Draw(W)
    d.text((20, 18), f'{ad} · SİTE (390 px)', fill='black', font=font(30)); d.text((A.width + 40, 18), f'{ad} · UYGULAMA (390 dp)', fill='black', font=font(30))
    W.paste(A, (0, 70)); W.paste(B, (A.width + 30, 70)); W.save(os.path.join(cikti, f'{s}-yan-yana.png')); print('ok', ad)
