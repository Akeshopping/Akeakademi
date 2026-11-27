"""TYT Matematik kalıpları. Her kalıp 3 zorluk üretir; 'prm' sorunun ham verisidir (denetçi yalnız bunu görür)."""
from fractions import Fraction as F
from math import gcd

from cekirdek import dogrusal, kalip, tr

D = "tyt_matematik"


def lcm(a, b):
    return a // gcd(a, b) * b


def yan_islem(b, kip, ip=False):
    """ax + b ifadesinde b'yi yok etmek için doğru işlemi anlatır. b > 0 → çıkar, b < 0 → ekle, b = 0 → "" (işlem yok).
    kip 'iki': her iki yan · 'her': her yan. ip=True: '...çıkarılıp / eklenip', değilse '...çıkarılınca / eklenince'."""
    if b == 0:
        return ""
    yan = "her iki yan" if kip == "iki" else "her yan"
    if b > 0:
        return f"{yan.capitalize()}dan {tr(b)} " + ("çıkarılıp" if ip else "çıkarılınca")
    return f"{yan.capitalize()}a {tr(-b)} " + ("eklenip" if ip else "eklenince")


# ------------------------------------------------------------------ Sayı Basamakları
def _en_buyuk_uc_basamakli(S, farkli=True, kucuk=False):
    aralik = range(100, 1000) if kucuk else range(999, 99, -1)
    for n in aralik:
        h, t, u = n // 100, n // 10 % 10, n % 10
        if h + t + u == S and (not farkli or len({h, t, u}) == 3):
            return n
    return None


@kalip("tyt-mat-sayi-basamaklari", D, "Sayı Basamakları")
def sayi_basamaklari(r, d):
    if d == 1:
        a = r.randint(3, 9)
        b = r.randint(0, a - 2)
        S, Df, n, ters = a + b, 9 * (a - b), 10 * a + b, 10 * b + a
        return dict(prm=dict(tip=1, S=S, D=Df),
                    q=f"Rakamları toplamı {S} olan iki basamaklı bir doğal sayının rakamlarının yeri değiştirildiğinde elde edilen sayı, ilk sayıdan {Df} eksiktir. Buna göre ilk sayı kaçtır?",
                    dogru=n, yanlis=[ters, 10 * S, Df, n + 9, n - 9, n + 11, 11 * a, a * b + 10],
                    x=f"Sayı 10a + b, yeri değişmiş hali 10b + a'dır. Fark 9(a − b) = {Df} olduğundan a − b = {a - b} bulunur. a + b = {S} ile birlikte a = {a}, b = {b} olur. İlk sayı {n}'dir.")
    if d == 2:
        for _ in range(100):
            h, t, u = r.sample(range(10), 3)
            if h:
                break
        S = h + t + u
        buyuk = _en_buyuk_uc_basamakli(S)
        kucuk = _en_buyuk_uc_basamakli(S, kucuk=True)
        tekrarli = _en_buyuk_uc_basamakli(S, farkli=False)
        return dict(prm=dict(tip=2, S=S),
                    q=f"Rakamları birbirinden farklı ve rakamları toplamı {S} olan üç basamaklı en büyük doğal sayı kaçtır?",
                    dogru=buyuk, yanlis=[kucuk, tekrarli, buyuk - 9, buyuk + 9, buyuk - 90, buyuk + 99, int(str(buyuk)[::-1])],
                    x=f"En büyük sayı için yüzler basamağı mümkün olduğunca büyük, sonra onlar basamağı büyük seçilir; rakamlar farklı kalmalı ve toplam {S} olmalıdır. Bu şartları sağlayan en büyük sayı {buyuk}'dur.")
    S = r.randint(4, 16)
    say = sum(1 for a in range(1, 10) if 0 <= S - a <= 9 and (S - a) % 2 == 0)
    if say < 2:
        return None
    tum = sum(1 for a in range(1, 10) if 0 <= S - a <= 9)
    return dict(prm=dict(tip=3, S=S), q=f"Rakamları toplamı {S} olan iki basamaklı kaç tane çift doğal sayı vardır?",
                dogru=say, yanlis=[tum, say + 1, say - 1, say + 2, tum - 1, say * 2],
                x=f"Onlar basamağı a ise birler basamağı {S} − a olur. Birler basamağı çift ve 0-9 arasında olmalıdır. Bu şartı sağlayan {say} sayı vardır.")


# ------------------------------------------------------------------ Rasyonel Sayılar
@kalip("tyt-mat-rasyonel", D, "Rasyonel Sayılar")
def rasyonel(r, d):
    if d == 1:
        for _ in range(200):
            b, dd = r.sample([2, 3, 4, 5, 6, 8, 9, 10], 2)
            a, c = r.randint(1, b - 1), r.randint(1, dd - 1)
            if gcd(a, b) == 1 and gcd(c, dd) == 1:
                break
        L = lcm(b, dd)
        topla = F(a, b) + F(c, dd)
        return dict(prm=dict(tip=1, a=a, b=b, c=c, d=dd), q=f"{a}/{b} + {c}/{dd} işleminin sonucu kaçtır?", dogru=topla,
                    yanlis=[F(a + c, b + dd), F(a * c, b * dd), F(a + c, b * dd), F(a + c, L), F(a * dd + c, b * dd), topla + F(1, L), topla - F(1, L)],
                    adim=F(1, topla.denominator),
                    x=f"Paydalar {L}'de eşitlenir: {a * (L // b)}/{L} + {c * (L // dd)}/{L} = {a * (L // b) + c * (L // dd)}/{L} = {tr(topla)} bulunur. Payları ve paydaları ayrı ayrı toplamak yanlıştır.")
    if d == 2:
        q = r.choice([3, 4, 5, 6, 8])
        p = r.randint(1, q - 1)
        if gcd(p, q) != 1:
            return None
        n = q * r.randint(2, 12)
        K = n * p // q
        return dict(prm=dict(tip=2, p=p, q=q, K=K), q=f"Bir sayının {p}/{q} kadarı {K} olduğuna göre bu sayı kaçtır?", dogru=n,
                    yanlis=[K * p // q if K * p % q == 0 else K + p, K + q - p, K * p, n + q, n - q, K - p, K * q // p if K * q % p == 0 else K + q],
                    x=f"Sayıya x denirse x·{p}/{q} = {K} olur. Buradan x = {K}·{q}/{p} = {n} bulunur.")
    for _ in range(200):
        b, dd = r.choice([3, 4, 5, 6, 8]), r.choice([3, 4, 5, 6, 8])
        a, c = r.randint(1, b - 1), r.randint(1, dd - 1)
        if gcd(a, b) == 1 and gcd(c, dd) == 1:
            break
    L = b * dd * r.randint(1, 8)
    R = L * (b - a) * (dd - c) // (b * dd)
    if R < 2 or L > 700:
        return None
    return dict(prm=dict(tip=3, a=a, b=b, c=c, d=dd, R=R),
                q=f"Bir yolun {a}/{b} kadarı birinci gün, kalan yolun {c}/{dd} kadarı ikinci gün alınıyor. Geriye {R} km yol kaldığına göre yolun tamamı kaç km'dir?",
                dogru=L, yanlis=[R * b // a if R * b % a == 0 else R + L // 2, L - R, R * (b + dd), L + b * dd, L - b * dd, R * 2 + L // 2],
                x=f"Birinci günden sonra yolun {b - a}/{b} kadarı kalır. İkinci günden sonra kalanın {dd - c}/{dd} kadarı, yani yolun {b - a}/{b}·{dd - c}/{dd} kadarı kalır. Bu miktar {R} km olduğundan yol {R}·{b * dd}/({b - a}·{dd - c}) = {L} km'dir.")


# ------------------------------------------------------------------ Basit Eşitsizlikler
@kalip("tyt-mat-basit-esitsizlik", D, "Basit Eşitsizlikler")
def basit_esitsizlik(r, d):
    if d == 1:
        a, b = r.randint(2, 5), r.randint(-6, 8)
        c = r.randint(b + 3 * a, b + 14 * a)
        say = sum(1 for x in range(1, 300) if a * x + b < c)
        if not 3 <= say <= 15:
            return None
        return dict(prm=dict(tip=1, a=a, b=b, c=c), q=f"{dogrusal(a, b)} < {tr(c)} eşitsizliğini sağlayan kaç tane pozitif tam sayı vardır?",
                    dogru=say, yanlis=[say + 1, say - 1, say + 2, say - 2, say + 3, (c - b) // a if (c - b) % a else (c - b) // a - 1],
                    x=f"{yan_islem(b, 'iki') or 'Eşitsizlik'} {a}x < {c - b} olur. Bu eşitsizliği sağlayan pozitif tam sayılar 1'den {say}'e kadardır, yani {say} tanedir.")
    if d == 2:
        a = r.randint(2, 4)
        b = r.randint(-5, 5)
        alt = r.randint(-10, 4)
        ust = alt + r.randint(8, 20)
        cozum = [x for x in range(-60, 61) if alt < a * x + b <= ust]
        if len(cozum) < 3:
            return None
        top = sum(cozum)
        return dict(prm=dict(tip=2, a=a, b=b, alt=alt, ust=ust), q=f"x bir tam sayı olmak üzere {tr(alt)} < {dogrusal(a, b)} ≤ {tr(ust)} eşitsizliğini sağlayan x değerlerinin toplamı kaçtır?",
                    dogru=top, yanlis=[len(cozum), top + cozum[0], top - cozum[-1], top + cozum[-1], top - cozum[0], top + 1, top - 1, sum(cozum[1:])],
                    x=f"{(yan_islem(b, 'her', ip=True) + ' ') if b else ''}{a}'ya bölününce x'in aralığı bulunur. Bu aralıktaki tam sayılar {', '.join(tr(x) for x in cozum)} olur. Toplamları {tr(top)}'dir.")
    a, b = r.choice([2, 3]), r.randint(1, 9)
    c = r.randint(4, 15)
    cozum = [x for x in range(-100, 101) if abs(a * x - b) <= c]
    if len(cozum) < 3:
        return None
    n = len(cozum)
    return dict(prm=dict(tip=3, a=a, b=b, c=c), q=f"x bir tam sayı olmak üzere |{a}x − {b}| ≤ {c} eşitsizliğini sağlayan kaç farklı x değeri vardır?",
                dogru=n, yanlis=[n + 1, n - 1, n + 2, n - 2, 2 * c + 1, c, n * 2],
                x=f"Mutlak değer eşitsizliğinden −{c} ≤ {a}x − {b} ≤ {c} yazılır. Düzenlenince x tam sayıları {tr(cozum[0])}'dan {tr(cozum[-1])}'e kadar gider ve {n} tanedir.")


# ------------------------------------------------------------------ Çarpanlara Ayırma
@kalip("tyt-mat-carpanlara-ayirma", D, "Çarpanlara Ayırma")
def carpanlara_ayirma(r, d):
    if d == 1:
        x = r.randint(4, 15)
        y = r.randint(1, x - 2)
        A, B = x - y, x + y
        return dict(prm=dict(tip=1, A=A, B=B), q=f"x − y = {A} ve x + y = {B} olduğuna göre x² − y² kaçtır?", dogru=A * B,
                    yanlis=[A + B, B - A, A * A + B * B, x * x + y * y, A * B + x, A * B - y, (A + B) * 2],
                    x=f"x² − y² = (x − y)(x + y) özdeşliği kullanılır. {A}·{B} = {A * B} bulunur.")
    if d == 2:
        a, b = r.randint(1, 12), r.randint(1, 12)
        S, P = a + b, a * b
        return dict(prm=dict(tip=2, S=S, P=P), q=f"a + b = {S} ve a·b = {P} olduğuna göre a² + b² kaçtır?", dogru=a * a + b * b,
                    yanlis=[S * S, S * S + 2 * P, S * S - P, 2 * P, S * S - 2 * P + 2, S * S - 2 * P - 2, a * a * b * b],
                    x=f"(a + b)² = a² + 2ab + b² olduğundan a² + b² = {S}² − 2·{P} = {S * S - 2 * P} bulunur.")
    k = r.randint(3, 9)
    return dict(prm=dict(tip=3, k=k), q=f"x + 1/x = {k} olduğuna göre x³ + 1/x³ ifadesinin değeri kaçtır?", dogru=k ** 3 - 3 * k,
                yanlis=[k ** 3, k ** 3 - k, k * k - 2, k ** 3 - 2 * k, k ** 3 - 3 * k + 3, k ** 3 - 3 * k - 3, k ** 2 + 2],
                x=f"(x + 1/x)³ = x³ + 1/x³ + 3(x + 1/x) olur. Buradan x³ + 1/x³ = {k}³ − 3·{k} = {k ** 3 - 3 * k} bulunur.")


# ------------------------------------------------------------------ Yaş Problemleri
@kalip("tyt-mat-yas", D, "Yaş Problemleri")
def yas(r, d):
    if d == 1:
        ali, fark = r.randint(8, 25), r.randint(20, 35)
        T = 2 * ali + fark
        return dict(prm=dict(tip=1, T=T, F=fark), q=f"Ali ile babasının yaşları toplamı {T}, yaşları arasındaki fark {fark} olduğuna göre Ali kaç yaşındadır?",
                    dogru=ali, yanlis=[ali + fark, T // 2, fark, ali + 1, ali - 1, ali + 2, T - fark],
                    x=f"Babanın yaşı Ali'nin yaşından {fark} fazladır. Ali x yaşında ise x + (x + {fark}) = {T} olur. Buradan x = {ali} bulunur.")
    if d == 2:
        O, x, k = r.randint(6, 16), r.randint(2, 12), r.randint(2, 4)
        B = k * (O + x) - x
        if not (20 <= B - O <= 45 and B <= 62):   # baba-oğul yaş farkı gerçekçi
            return None
        return dict(prm=dict(tip=2, B=B, O=O, k=k), q=f"Babanın şimdiki yaşı {B}, oğlunun şimdiki yaşı {O} olduğuna göre kaç yıl sonra babanın yaşı oğlunun yaşının {k} katı olur?",
                    dogru=x, yanlis=[x + 1, x - 1, B - k * O, k, B - O, x + 2, x * 2],
                    x=f"x yıl sonra {B} + x = {k}·({O} + x) olmalıdır. Düzenlenince {B - k * O} = {k - 1}x olur ve x = {x} bulunur.")
    c, a, b = r.randint(5, 20), r.randint(2, 8), r.randint(2, 8)
    if a + b > 15:   # en büyük ile en küçük kardeş farkı makul kalsın
        return None
    T = 3 * c + 2 * b + a
    return dict(prm=dict(tip=3, a=a, b=b, T=T), q=f"Ayşe, Burak'tan {a} yaş büyüktür. Burak da Can'dan {b} yaş büyüktür. Üçünün yaşları toplamı {T} olduğuna göre Can kaç yaşındadır?",
                dogru=c, yanlis=[c + b, c + a + b, T // 3, c + 1, c - 1, c + 2, T - 3 * c],
                x=f"Can x yaşında ise Burak x + {b}, Ayşe x + {a + b} yaşındadır. Toplam 3x + {a + 2 * b} = {T} olur. Buradan x = {c} bulunur.")


# ------------------------------------------------------------------ Kar Zarar Problemleri
@kalip("tyt-mat-kar-zarar", D, "Kar Zarar Problemleri")
def kar_zarar(r, d):
    if d == 1:
        p = r.choice([10, 20, 25, 30, 40, 50])
        A = 20 * r.randint(3, 40)
        S = A * (100 + p) // 100
        return dict(prm=dict(tip=1, A=A, p=p), q=f"Alış fiyatı {A} TL olan bir mal %{p} kârla satılıyor. Malın satış fiyatı kaç TL'dir?", dogru=S,
                    yanlis=[A + p, A * p // 100, A * (100 - p) // 100, A + A * p // 50, S + 20, S - 20, A * (100 + p) // 50],
                    x=f"Kâr {A}·{p}/100 = {A * p // 100} TL olur. Satış fiyatı {A} + {A * p // 100} = {S} TL bulunur.")
    p = r.choice([10, 20, 25, 40])
    if d == 2:
        A = 20 * r.randint(3, 40)
        S = A * (100 - p) // 100
        return dict(prm=dict(tip=2, S=S, p=p), q=f"Bir mal %{p} zararla {S} TL'ye satılıyor. Malın alış fiyatı kaç TL'dir?", dogru=A,
                    yanlis=[S * (100 + p) // 100 if S * (100 + p) % 100 == 0 else S + p, S + p, S + S * p // 100 if S * p % 100 == 0 else S + 10, A + 20, A - 20, 2 * S - A + p],
                    x=f"Alış fiyatı x ise x·(100 − {p})/100 = {S} olur. Buradan x = {S}·100/{100 - p} = {A} TL bulunur. Zarar yüzdesini satış fiyatına uygulamak yanlıştır.")
    p = r.choice([20, 25])
    kat = 12 if p == 20 else 15
    S = kat * r.randint(2, 20) * 10
    c1, c2 = F(S * 100, 100 + p), F(S * 100, 100 - p)
    zarar = c1 + c2 - 2 * S
    if zarar.denominator != 1 or zarar <= 0:
        return None
    zarar = int(zarar)
    return dict(prm=dict(tip=3, S=S, p=p), q=f"Aynı fiyata, {S} TL'ye satılan iki maldan biri %{p} kârla, diğeri %{p} zararla satılmıştır. Bu satışlardan toplam kaç TL zarar edilmiştir?",
                dogru=zarar, yanlis=[0 if False else S * p // 100, 2 * S * p // 100, zarar + 10, zarar - 10, zarar * 2, zarar + S // 10, S // 10],
                x=f"Kârla satılan malın alış fiyatı {S}·100/{100 + p} = {tr(c1)} TL, zararla satılanın alış fiyatı {S}·100/{100 - p} = {tr(c2)} TL'dir. Toplam alış {tr(c1 + c2)} TL, toplam satış {2 * S} TL olduğundan {zarar} TL zarar edilir.")


# ------------------------------------------------------------------ Karışım Problemleri
@kalip("tyt-mat-karisim", D, "Karışım Problemleri")
def karisim(r, d):
    pct = lambda v: "%" + tr(v)
    if d == 1:
        for _ in range(300):
            m1, m2 = r.choice([100, 200, 300, 400]), r.choice([100, 200, 300, 400])
            a, b = r.choice([10, 20, 30, 40, 50]), r.choice([10, 20, 30, 40, 50])
            if a != b and (a * m1 + b * m2) % (m1 + m2) == 0:
                break
        else:
            return None
        s = (a * m1 + b * m2) // (m1 + m2)
        return dict(prm=dict(tip=1, a=a, m1=m1, b=b, m2=m2), q=f"Tuz oranı %{a} olan {m1} g tuzlu su ile tuz oranı %{b} olan {m2} g tuzlu su karıştırılıyor. Karışımın tuz oranı yüzde kaçtır?",
                    dogru=s, bic=pct, yanlis=[(a + b) // 2, a + b, abs(a - b), s + 5, s - 5, s + 2, s - 2],
                    x=f"Birinci çözeltideki tuz {m1}·{a}/100 = {m1 * a // 100} g, ikincideki tuz {m2}·{b}/100 = {m2 * b // 100} g olur. Toplam tuz {(a * m1 + b * m2) // 100} g, toplam çözelti {m1 + m2} g olduğundan oran %{s} bulunur.")
    if d == 2:
        for _ in range(300):
            b = r.choice([5, 10, 12, 15, 20, 25])
            a = b * r.choice([2, 3, 4, 5])
            m = 20 * r.randint(2, 30)
            w = m * a / b - m
            if w == int(w) and w > 0:
                break
        else:
            return None
        w = int(w)
        return dict(prm=dict(tip=2, a=a, m=m, b=b), q=f"Tuz oranı %{a} olan {m} g tuzlu suya kaç gram saf su eklenirse tuz oranı %{b} olur?", dogru=w,
                    yanlis=[m * a // b if m * a % b == 0 else w + 10, m * (a - b) // 100, w + m, w - 20, w + 20, m * b // a if m * b % a == 0 else w - 10, m - w if m > w else w + 40],
                    x=f"Başlangıçtaki tuz {m}·{a}/100 g'dır. Su eklenince tuz miktarı değişmez. {m}·{a}/100 = ({m} + x)·{b}/100 denkleminden x = {w} g bulunur.")
    for _ in range(300):
        b = r.choice([10, 15, 20, 25])
        c = b + r.choice([5, 10, 15])
        a = c + r.choice([5, 10, 15, 20])
        k = r.randint(2, 8)
        x1, y1 = k * (c - b), k * (a - c)
        if y1 <= 400 and gcd(c - b, a - c) >= 1:
            break
    return dict(prm=dict(tip=3, a=a, b=b, c=c, y=y1), q=f"Tuz oranı %{a} olan tuzlu su ile tuz oranı %{b} olan tuzlu su karıştırılarak tuz oranı %{c} olan çözelti elde ediliyor. Tuz oranı %{b} olan çözeltiden {y1} g kullanıldığına göre tuz oranı %{a} olan çözeltiden kaç gram kullanılmıştır?",
                dogru=x1, yanlis=[y1, x1 + y1, (a - c) * k, abs(x1 - y1), x1 + k * 5, x1 - k * 5, y1 * (a - c) // (c - b) if y1 * (a - c) % (c - b) == 0 else x1 + 10],
                x=f"Tuz miktarı korunur: {a}·x + {b}·{y1} = {c}·(x + {y1}). Düzenlenince x·({a} − {c}) = {y1}·({c} − {b}) olur ve x = {x1} g bulunur.")
