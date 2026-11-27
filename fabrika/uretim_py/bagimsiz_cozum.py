#!/usr/bin/env python3
"""BAĞIMSIZ çözücü: yalnız dosyadaki SORU METNİNİ okur (üretici, meta, prm, denetçi kullanılmaz).
Metindeki sayıları regex ile alır, soruyu tarama/tam kesir aritmetiğiyle yeniden çözer ve işaretli şıkla karşılaştırır.
Kullanım: python3 bagimsiz_cozum.py <klasor> <cikti.json>   (klasör: */onayli.jsonl içeren ZIP içeriği)
Sonuç: id → {"s": "dogru"|"yanlis"|"cozulemedi"|"belirsiz", "n": neden}
"""
import glob
import json
import math
import os
import re
import sys
from fractions import Fraction as F

N = r"(−?\d+)"


def say(m):
    return [int(g.replace("−", "-")) for g in m.groups() if g is not None and re.fullmatch(r"−?\d+", g)]


def sec_deger(o):
    m = o.replace("−", "-").replace("%", "").replace(",", ".").strip()
    if "/" in m:
        a, b = m.split("/")
        return F(int(a), int(b))
    return F(m)


def lin(metin):
    m = re.fullmatch(r"(\d*)x(?: ([+−]) (\d+))?", metin.strip())
    if not m:
        return None
    a = int(m.group(1) or 1)
    b = 0 if not m.group(2) else (int(m.group(3)) if m.group(2) == "+" else -int(m.group(3)))
    return a, b


def tek(liste):
    liste = list(liste)
    return liste[0] if len(liste) == 1 else None


SEN = []   # son çözümün senaryo kayıtları (gerçeklik denetimi için)


def ec(e, c, gecmis=0):
    SEN.append(("ebeveyn", e, c, gecmis))


def kard(o, y, gecmis=0):
    SEN.append(("kardes", o, y, gecmis))


def kisi(yas):
    SEN.append(("kisi", yas))


R = []  # (regex, çözücü)


def kural(rx):
    def sar(fn):
        R.append((re.compile(rx + "$"), fn))
        return fn
    return sar


# ---------------- Sayı Basamakları
@kural(r"Rakamları toplamı (\d+) olan iki basamaklı bir doğal sayının rakamlarının yeri değiştirildiğinde elde edilen sayı, ilk sayıdan (\d+) eksiktir\. Buna göre ilk sayı kaçtır\?")
def _(S, Df):
    return tek(n for n in range(10, 100) if n // 10 + n % 10 == S and n - (n % 10 * 10 + n // 10) == Df)


@kural(r"Rakamları birbirinden farklı ve rakamları toplamı (\d+) olan üç basamaklı en büyük doğal sayı kaçtır\?")
def _(S):
    return max((n for n in range(100, 1000) if len(set(str(n))) == 3 and sum(map(int, str(n))) == S), default=None)


@kural(r"Rakamları toplamı (\d+) olan iki basamaklı kaç tane çift doğal sayı vardır\?")
def _(S):
    return sum(1 for n in range(10, 100) if n % 2 == 0 and n // 10 + n % 10 == S)


# ---------------- Rasyonel
@kural(r"(\d+)/(\d+) \+ (\d+)/(\d+) işleminin sonucu kaçtır\?")
def _(a, b, c, d):
    return F(a, b) + F(c, d)


@kural(r"Bir sayının (\d+)/(\d+) kadarı (\d+) olduğuna göre bu sayı kaçtır\?")
def _(p, q, K):
    return F(K) / F(p, q)


@kural(r"Bir yolun (\d+)/(\d+) kadarı birinci gün, kalan yolun (\d+)/(\d+) kadarı ikinci gün alınıyor\. Geriye (\d+) km yol kaldığına göre yolun tamamı kaç km'dir\?")
def _(a, b, c, d, Rk):
    return F(Rk) / ((1 - F(a, b)) * (1 - F(c, d)))


# ---------------- Basit eşitsizlik
@kural(r"(.+?) < " + N + r" eşitsizliğini sağlayan kaç tane pozitif tam sayı vardır\?")
def _(*g):
    return None


def _ines1(m):
    l = lin(m.group(1))
    if not l:
        return None
    a, b = l
    c = int(m.group(2).replace("−", "-"))
    return sum(1 for x in range(1, 2000) if a * x + b < c)


@kural(r"x bir tam sayı olmak üzere " + N + r" < (.+?) ≤ " + N + r" eşitsizliğini sağlayan x değerlerinin toplamı kaçtır\?")
def _(*g):
    return None


@kural(r"x bir tam sayı olmak üzere \|(\d+)x − (\d+)\| ≤ (\d+) eşitsizliğini sağlayan kaç farklı x değeri vardır\?")
def _(a, b, c):
    return sum(1 for x in range(-500, 501) if abs(a * x - b) <= c)


# ---------------- Çarpanlara ayırma
@kural(r"x − y = (\d+) ve x \+ y = (\d+) olduğuna göre x² − y² kaçtır\?")
def _(A, B):
    x, y = F(A + B, 2), F(B - A, 2)
    return x * x - y * y


@kural(r"a \+ b = (\d+) ve a·b = (\d+) olduğuna göre a² \+ b² kaçtır\?")
def _(S, P):
    s = {a * a + (S - a) ** 2 for a in range(-300, 301) if a * (S - a) == P}
    return tek(s)


@kural(r"x \+ 1/x = (\d+) olduğuna göre x³ \+ 1/x³ ifadesinin değeri kaçtır\?")
def _(k):
    x = (k + math.sqrt(k * k - 4)) / 2
    return round(x ** 3 + 1 / x ** 3)


# ---------------- Yaş (eski kalıp)
@kural(r"Ali ile babasının yaşları toplamı (\d+), yaşları arasındaki fark (\d+) olduğuna göre Ali kaç yaşındadır\?")
def _(T, Fk):
    a = tek(a for a in range(0, 150) if a + a + Fk == T)
    if a is not None:
        ec(a + Fk, a)
    return a


@kural(r"Babanın şimdiki yaşı (\d+), oğlunun şimdiki yaşı (\d+) olduğuna göre kaç yıl sonra babanın yaşı oğlunun yaşının (\d+) katı olur\?")
def _(B, O, k):
    ec(B, O)
    return tek(x for x in range(0, 200) if B + x == k * (O + x))


@kural(r"Ayşe, Burak'tan (\d+) yaş büyüktür\. Burak da Can'dan (\d+) yaş büyüktür\. Üçünün yaşları toplamı (\d+) olduğuna göre Can kaç yaşındadır\?")
def _(a, b, T):
    c = tek(c for c in range(0, 150) if c + (c + b) + (c + b + a) == T)
    if c is not None:
        kard(c + b + a, c)
    return c


# ---------------- Yaş (yeni kalıplar)
@kural(r"Bir annenin yaşı kızının yaşının (\d+) katıdır\. İkisinin yaşları toplamı (\d+) olduğuna göre kızı kaç yaşındadır\?")
def _(k, T):
    s = tek(s for s in range(0, 150) if s + k * s == T)
    if s is not None:
        ec(k * s, s)
    return s


@kural(r"Bir babanın yaşı oğlunun yaşının (\d+) katıdır\. İkisinin yaşları toplamı (\d+) olduğuna göre baba kaç yaşındadır\?")
def _(k, T):
    s = tek(s for s in range(0, 150) if s + k * s == T)
    if s is not None:
        ec(k * s, s)
    return None if s is None else k * s


@kural(r"Bir annenin yaşı kızının yaşının (\d+) katıdır\. (\d+) yıl önce ikisinin yaşları toplamı (\d+) olduğuna göre annenin bugünkü yaşı kaçtır\?")
def _(k, m, P):
    s = tek(s for s in range(0, 150) if (s - m) + (k * s - m) == P and s > m)
    if s is not None:
        ec(k * s, s, m)
    return None if s is None else k * s


AILE = r"Bir ailede anne, baba ve bir çocuk vardır\. Annenin yaşı çocuğun yaşının (\d+) katıdır\. Baba, anneden (\d+) yaş büyüktür\. Üç kişinin yaşları toplamı (\d+) olduğuna göre "


def _aile(c, b, T):
    s = tek(s for s in range(0, 150) if s + c * s + (c * s + b) == T)
    if s is not None:
        ec(c * s, s)
        ec(c * s + b, s)
    return s


@kural(AILE + r"çocuk kaç yaşındadır\?")
def _(c, b, T):
    return _aile(c, b, T)


@kural(AILE + r"baba kaç yaşındadır\?")
def _(c, b, T):
    s = _aile(c, b, T)
    return None if s is None else c * s + b


@kural(AILE + r"(\d+) yıl sonra anne ile babanın yaşları toplamı kaç olur\?")
def _(c, b, T, n):
    s = _aile(c, b, T)
    return None if s is None else c * s + c * s + b + 2 * n


ORAN = r"Bir anne ile kızının yaşları oranı (\d+)/(\d+), yaşları toplamı (\d+) olduğuna göre "


def _oran(p, q, T):
    s = tek(s for s in range(1, 150) if (T - s) * q == p * s)
    if s is not None:
        ec(T - s, s)
    return s


@kural(ORAN + r"kızı kaç yaşındadır\?")
def _(p, q, T):
    return _oran(p, q, T)


@kural(ORAN + r"anne ile kızı arasındaki yaş farkı kaçtır\?")
def _(p, q, T):
    s = _oran(p, q, T)
    return None if s is None else T - 2 * s


@kural(ORAN + r"(\d+) yıl sonra annenin yaşı kaç olur\?")
def _(p, q, T, n):
    s = _oran(p, q, T)
    return None if s is None else T - s + n


GG = r"Bir baba ile oğlu hakkında şu bilgiler veriliyor: (\d+) yıl önce babanın yaşı oğlunun yaşının (\d+) katıydı\. (\d+) yıl sonra babanın yaşı oğlunun yaşının (\d+) katı olacaktır\. Buna göre "


def _gg(a, k, b, l):
    c = tek((x, y) for x in range(1, 100) for y in range(1, 200) if x > a and y - a == k * (x - a) and y + b == l * (x + b))
    if c is not None:
        ec(c[1], c[0], a)
    return c


@kural(GG + r"oğlun bugünkü yaşı kaçtır\?")
def _(a, k, b, l):
    s = _gg(a, k, b, l)
    return None if s is None else s[0]


@kural(GG + r"babanın bugünkü yaşı kaçtır\?")
def _(a, k, b, l):
    s = _gg(a, k, b, l)
    return None if s is None else s[1]


@kural(GG + r"baba ile oğlunun bugünkü yaşları toplamı kaçtır\?")
def _(a, k, b, l):
    s = _gg(a, k, b, l)
    return None if s is None else s[0] + s[1]


@kural(r"(\d+) kişilik bir grubun yaş ortalaması (\d+)'[a-zçğıöşü]+\. Bu gruptan bir kişi ayrılınca ortalama (\d+) oluyor\. Ayrılan kişi kaç yaşındadır\?")
def _(n, M, M2):
    y = tek(y for y in range(0, 200) if n * M - y == (n - 1) * M2)
    if y is not None:
        kisi(y)
    return y


@kural(r"(\d+) kişilik bir grubun yaş ortalaması (\d+)'[a-zçğıöşü]+\. Gruba yeni bir kişi katılınca ortalama (\d+) oluyor\. Gruba katılan kişi kaç yaşındadır\?")
def _(n, M, M2):
    y = tek(y for y in range(0, 200) if n * M + y == (n + 1) * M2)
    if y is not None:
        kisi(y)
    return y


@kural(r"(\d+) kişilik bir grubun yaş ortalaması (\d+)'[a-zçğıöşü]+\. Gruptan (\d+) yaşındaki bir kişi ile yaşı bilinmeyen başka bir kişi ayrılınca ortalama (\d+) oluyor\. Diğer ayrılan kişi kaç yaşındadır\?")
def _(n, M, z, M2):
    a = tek(a for a in range(0, 200) if n * M - z - a == (n - 2) * M2)
    kisi(z)
    if a is not None:
        kisi(a)
    return a


FARK = r"İki kardeşin yaşları arasındaki fark (\d+)'[a-zçğıöşü]+\. (\d+) yıl önce yaşları toplamı (\d+) olduğuna göre "


def _fark(dif, n, P):
    c = tek((o, o - dif) for o in range(1, 200) if o - dif > n and (o - n) + (o - dif - n) == P)
    if c is not None:
        kard(c[0], c[1], n)
    return c


@kural(FARK + r"büyük kardeş şimdi kaç yaşındadır\?")
def _(dif, n, P):
    s = _fark(dif, n, P)
    return None if s is None else s[0]


@kural(FARK + r"(\d+) yıl sonra yaşları toplamı kaç olur\?")
def _(dif, n, P, m):
    s = _fark(dif, n, P)
    return None if s is None else s[0] + s[1] + 2 * m


@kural(FARK + r"bugünkü yaşlarının çarpımı kaçtır\?")
def _(dif, n, P):
    s = _fark(dif, n, P)
    return None if s is None else s[0] * s[1]


# ---------------- Kâr zarar
@kural(r"Alış fiyatı (\d+) TL olan bir mal %(\d+) kârla satılıyor\. Malın satış fiyatı kaç TL'dir\?")
def _(A, p):
    return F(A) * (100 + p) / 100


@kural(r"Bir mal %(\d+) zararla (\d+) TL'ye satılıyor\. Malın alış fiyatı kaç TL'dir\?")
def _(p, S):
    return F(S) * 100 / (100 - p)


@kural(r"Aynı fiyata, (\d+) TL'ye satılan iki maldan biri %(\d+) kârla, diğeri %(\d+) zararla satılmıştır\. Bu satışlardan toplam kaç TL zarar edilmiştir\?")
def _(S, p, p2):
    alis = F(S) * 100 / (100 + p) + F(S) * 100 / (100 - p2)
    return alis - 2 * S


# ---------------- Karışım
@kural(r"Tuz oranı %(\d+) olan (\d+) g tuzlu su ile tuz oranı %(\d+) olan (\d+) g tuzlu su karıştırılıyor\. Karışımın tuz oranı yüzde kaçtır\?")
def _(a, m1, b, m2):
    return F(a * m1 + b * m2, m1 + m2)


@kural(r"Tuz oranı %(\d+) olan (\d+) g tuzlu suya kaç gram saf su eklenirse tuz oranı %(\d+) olur\?")
def _(a, m, b):
    return F(m * a, b) - m


@kural(r"Tuz oranı %(\d+) olan tuzlu su ile tuz oranı %(\d+) olan tuzlu su karıştırılarak tuz oranı %(\d+) olan çözelti elde ediliyor\. Tuz oranı %\2 olan çözeltiden (\d+) g kullanıldığına göre tuz oranı %\1 olan çözeltiden kaç gram kullanılmıştır\?")
def _(a, b, c, y):
    return F(y * (c - b), a - c)


def esitsizlik_ozel(q):
    m = re.fullmatch(r"(.+?) < " + N + r" eşitsizliğini sağlayan kaç tane pozitif tam sayı vardır\?", q)
    if m:
        return _ines1(m)
    m = re.fullmatch(r"x bir tam sayı olmak üzere " + N + r" < (.+?) ≤ " + N + r" eşitsizliğini sağlayan x değerlerinin toplamı kaçtır\?", q)
    if m:
        l = lin(m.group(2))
        if not l:
            return None
        a, b = l
        alt, ust = int(m.group(1).replace("−", "-")), int(m.group(3).replace("−", "-"))
        return sum(x for x in range(-500, 501) if alt < a * x + b <= ust)
    return "yok"


def coz(q):
    """Metinden çözer. Dönüş: (durum, değer|neden). durum: 'ok' | 'cozulemedi'"""
    SEN.clear()
    e = esitsizlik_ozel(q)
    if e != "yok":
        return ("ok", F(e)) if e is not None else ("cozulemedi", "eşitsizlik ayrıştırılamadı")
    for rx, fn in R:
        m = rx.match(q)
        if m and fn.__code__.co_argcount:
            v = fn(*say(m))
            if v is None:
                return "cozulemedi", "çözüm benzersiz değil/bulunamadı"
            return "ok", F(v)
    return "cozulemedi", "metin hiçbir bilinen kalıba uymuyor"


def main(kok, cikti):
    sonuc, sayac = {}, {}
    for dosya in sorted(glob.glob(os.path.join(kok, "*", "onayli.jsonl"))):
        for satir in open(dosya, encoding="utf8"):
            if not satir.strip():
                continue
            s = json.loads(satir)
            try:
                durum, v = coz(s["q"])
                if durum != "ok":
                    r = {"s": "cozulemedi", "n": v}
                else:
                    deger = [sec_deger(o) for o in s["o"]]
                    eslesen = [i for i, d in enumerate(deger) if d == v]
                    if eslesen == [s["a"]]:
                        r = {"s": "dogru", "n": ""}
                    elif not eslesen:
                        r = {"s": "yanlis", "n": f"bağımsız çözüm {v} hiçbir şıkta yok; işaretli {s['o'][s['a']]}"}
                    else:
                        r = {"s": "yanlis", "n": f"bağımsız çözüm {v} şık {eslesen}; işaretli {s['a']}"}
            except Exception as e:  # noqa: BLE001
                r = {"s": "cozulemedi", "n": "ayrıştırma hatası: " + str(e)[:80]}
            sonuc[s["id"]] = r
            sayac[r["s"]] = sayac.get(r["s"], 0) + 1
    json.dump(sonuc, open(cikti, "w", encoding="utf8"), ensure_ascii=False)
    print(json.dumps(sayac, ensure_ascii=False))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
