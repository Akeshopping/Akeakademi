"""Siteyi (index.html) YEREL olarak, uygulamanın ekran yürüyüşündeki AYNI sahte kullanıcı verisiyle 390 px'te çizer.
Gerçek hesap/Production yok: /api/* istekleri burada yanıtlanır. Soru metinleri sitenin kendi statik bankasındandır
(uygulamadaki sahte sunucunun 2 örnek sorusu değil); kullanıcı verisi (profil, istatistik, günlük sayılar, plan, paket) birebir aynıdır.
Kullanım: python3 mobile/tool/site_goruntu.py <çıktı klasörü>"""
import sys, json, threading, http.server, socketserver, os, datetime, functools
from playwright.sync_api import sync_playwright

KOK = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CIKTI = sys.argv[1] if len(sys.argv) > 1 else '/tmp/site'
os.makedirs(CIKTI, exist_ok=True)
TEMA = os.environ.get('TEMA', 'light')

bugun = datetime.date.today()
soru = [32, 45, 0, 28, 51, 38, 24]; dogru = [21, 33, 0, 19, 40, 27, 15]
daily = {}
for i in range(7):
    g = bugun - datetime.timedelta(days=6 - i)
    if soru[i] > 0: daily[g.isoformat()] = {'q': soru[i], 'c': dogru[i]}
ALANLAR = {
    'profile': {'_u': 4102444800000, 'profile': {'name': 'Test Öğrencisi', 'alan': 'SAY', 'gunluk': 40, 'examDate': '2027-06-19', 'ok': True}},
    'stats': {'daily': daily, 'topic': {'mat|Sayılar': [34, 12, 2], 'mat|Problemler': [18, 14, 0], 'turkce|Paragraf': [41, 9, 1], 'fizik|Hareket': [7, 11, 0]}},
    'plan': {'_u': 4102444800000, 'plan': {'tasks': [
        {'id': 't1', 'text': 'Problemler: 30 soru', 'day': 0, 's': 'mat', 'min': 45, 'done': True},
        {'id': 't2', 'text': 'Paragraf: 25 soru', 'day': 1, 's': 'turkce', 'min': 30, 'done': True},
        {'id': 't3', 'text': 'Hareket konu tekrarı', 'day': 2, 's': 'fizik', 'min': 40, 'done': False},
        {'id': 't4', 'text': 'Sayılar: yanlışları çöz', 'day': 3, 's': 'mat', 'min': 35, 'done': False},
        {'id': 't5', 'text': 'Deneme sonrası analiz', 'day': 5, 's': 'mat', 'min': 60, 'done': False}]}},
}
BEN = {'kullanici': {'id': 'u1', 'eposta': 'ogrenci@ornek.test', 'ad': ''}, 'paket': {'plan': 'premium', 'bitis': '2026-12-12', 'kod': 'AKE-TEST-••••'},
       'kullanim': {'mesaj': 3, 'guclu': 0}, 'limit': {'mesaj': 100, 'guclu': 20}, 'ucretsiz': None, 'ayar': {'google': False, 'eposta': True}}

class Sessiz(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Sessiz, directory=KOK)); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()

def yanit(route):
    u = route.request.url
    if '/api/hesap/ben' in u: return route.fulfill(json=BEN)
    if u.endswith('/api/hesap/veri'): return route.fulfill(json={'alanlar': ALANLAR, 'u': {k: 1 for k in ALANLAR}, 'hesap': 'u1'})
    if '/api/hesap/veri/' in u: return route.fulfill(json={'ok': True})
    return route.fulfill(status=404, json={'error': 'yok'})

EKRANLAR = [('10-ana', 'bugun'), ('20-soru-merkezi', 'banka'), ('45-deneme', 'deneme'), ('51-ai', 'ogretmen'), ('63-plan', 'plan'), ('61-gelisim', 'gelisim')]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    c = b.new_context(viewport={'width': 390, 'height': 776}, device_scale_factor=2, locale='tr-TR', color_scheme=TEMA, is_mobile=True, has_touch=True, reduced_motion='reduce', service_workers='block')
    c.add_init_script("try{localStorage.setItem('ake.tema','%s');localStorage.setItem('ake.intro','1');localStorage.setItem('ake.intro3d','1');localStorage.setItem('ake.tn','1')}catch(e){}" % TEMA)
    pg = c.new_page(); pg.route('**/api/**', yanit)
    for ad, hs in EKRANLAR:
        pg.goto(f'http://127.0.0.1:{port}/index.html#{hs}'); pg.wait_for_timeout(1800)
        pg.reload(); pg.wait_for_timeout(2200)
        pg.screenshot(path=f'{CIKTI}/{ad}.png'); print('ok', ad)
    b.close()
