#!/usr/bin/env python3
"""BAĞIMSIZ kalite denetimi: üretici/meta kullanılmaz; yalnız dosyadaki soru, şık ve çözüm METNİNE bakar.
Matematiksel doğruluk ayrıdır (bagimsiz_cozum.py). Bu denetim şunları arar (matematik doğru olsa bile):
  gerceklik : yaş senaryosu gerçekçi mi (ebeveyn-çocuk farkı 20-45, ebeveyn ≤ 70, geçmişte çocuk ≥ 1, kardeş farkı ≤ 15, kişi yaşı 5-90)
  cozum     : çözüm metnindeki işlemler soru/cevapla uyuşuyor mu (sayısal eşitlikler yeniden hesaplanır; işlem anlatımı işarete uygun mu)
  metin     : sayıdan sonraki ekler (3'ya → 3'e), boşluk/ASCII eksi vb.
  sik       : zayıf (eşit aralıklı dolgu) ya da bariz alakasız çeldirici
Her bulgu: {tur, ne, oneri: REDDET | DÜZELT}. Bulgusuz soru = DOĞRU adayı (insan incelemesi yine gerekir).
Kullanım: python3 denetim.py <klasor> <cikti.json>   (klasor: */onayli.jsonl)
"""
import glob
import json
import os
import re
import sys
from fractions import Fraction as F

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bagimsiz_cozum as B  # noqa: E402

# ------------------------------------------------------------------ gerçeklik
def gerceklik(q):
    sor = []
    durum, _ = B.coz(q["q"])
    for k in B.SEN:
        if k[0] == "ebeveyn":
            _, e, c, g = k
            if not 20 <= e - c <= 45:
                sor.append(f"ebeveyn {e}, çocuk {c}: yaş farkı {e - c} (20-45 dışı)")
            if e > 70:
                sor.append(f"ebeveyn {e} yaşında (70'ten büyük)")
            if c - g < 1:
                sor.append(f"geçmişte çocuk {c - g} yaşında (doğmamış)")
        elif k[0] == "kardes":
            _, o, y, g = k
            if o - y > 15:
                sor.append(f"kardeşler {o} ve {y}: fark {o - y} (15'ten büyük)")
            if y - g < 1:
                sor.append(f"geçmişte küçük kardeş {y - g} yaşında")
        elif k[0] == "kisi" and not 5 <= k[1] <= 90:
            sor.append(f"kişi yaşı {k[1]} (5-90 dışı)")
    return [{"tur": "gerceklik", "ne": s, "oneri": "REDDET"} for s in sor]


# ------------------------------------------------------------------ çözüm işlemleri
_ISL = r"\d\s.,()+\-−·×/²³"
_ARIT = re.compile(rf"(?<![\w.,²³%])[(\d][{_ISL}]*(?:=[{_ISL}]+)+")


def _hesapla(t):
    t = t.strip().replace("−", "-").replace("·", "*").replace("×", "*").replace("²", "**2").replace("³", "**3")
    t = re.sub(r"\d+(?:,\d+)?", lambda m: f"F('{m.group(0).replace(',', '.')}')", t)
    if re.search(r"\)\s*\(|\)\s*F\(|F\([^)]*\)\s*\(", t):    # ima edilen çarpma: doğrulanamaz
        return None
    try:
        return eval(t, {"__builtins__": {}}, {"F": F})  # noqa: S307  (yalnız rakam/işleç karakterleri geçer)
    except Exception:  # noqa: BLE001
        return None


def cozum_islemleri(q):
    bul, x = [], q["x"]
    for m in _ARIT.finditer(x):
        s, e = m.start(), m.end()
        onc = x[:s].rstrip()
        if onc and onc[-1] in "+-−·×/(=":    # bir ifadenin ortasından başlıyor
            if onc[-1] != "(":
                continue
        sonr = x[e:e + 2].lstrip()
        if sonr and (sonr[0].isalpha() or sonr[0] in "²³%"):
            continue
        run = m.group(0).rstrip(" +-−·×/.,")
        taraflar = run.split("=")
        degerler = [_hesapla(t) for t in taraflar]
        if any(v is None for v in degerler):
            continue
        if len({v for v in degerler}) > 1:
            bul.append({"tur": "cozum", "ne": f"işlem yanlış: «{run.strip()}»", "oneri": "DÜZELT"})
    # gereksiz parantez: işleçten sonra pozitif tek sayı
    if re.search(r"[−+·×] \(\d+\)", x):
        bul.append({"tur": "cozum", "ne": "gereksiz parantez (pozitif sayı parantez içinde)", "oneri": "DÜZELT"})
    if re.search(r"− \(−\d+\)", x):
        bul.append({"tur": "cozum", "ne": "çözüm anlatımı çift işaretli ('c − (−b)'): işlem eklemek/çıkarmak olarak anlatılmalı", "oneri": "DÜZELT"})
    # işlem anlatımı: negatif sayı "çıkarılıp/çıkarılınca" denemez; işaret ile fiil uyumu
    if re.search(r"−\d[\d,]* (çıkarılıp|çıkarılınca|çıkarılarak)", x):
        bul.append({"tur": "cozum", "ne": "negatif sayı 'çıkarılıyor' diye anlatılmış (doğrusu: pozitif sayı eklenir)", "oneri": "DÜZELT"})
    # eşitsizlik sorularında b'nin işareti ile fiil
    for yer in re.finditer(r"(\d*)x ([+−]) (\d+)", q["q"]):
        isaret = yer.group(2)
        if isaret == "−" and re.search(r"çıkar", x) and not re.search(r"eklen", x):
            bul.append({"tur": "cozum", "ne": "ax − b biçimindeki ifadede 'çıkarılır' denmiş (doğrusu: b eklenir)", "oneri": "DÜZELT"})
        if isaret == "+" and re.search(r"eklen", x) and not re.search(r"çıkar", x):
            bul.append({"tur": "cozum", "ne": "ax + b biçimindeki ifadede 'eklenir' denmiş (doğrusu: b çıkarılır)", "oneri": "DÜZELT"})
        break
    return bul


# ------------------------------------------------------------------ metin (sayıdan sonra ek uyumu; ayrı uygulama)
_UNITE = {1: "bir", 2: "iki", 3: "üç", 4: "dört", 5: "beş", 6: "altı", 7: "yedi", 8: "sekiz", 9: "dokuz"}
_ONLAR = {1: "on", 2: "yirmi", 3: "otuz", 4: "kırk", 5: "elli", 6: "altmış", 7: "yetmiş", 8: "seksen", 9: "doksan"}


def _son_kelime(n):
    n = abs(n)
    if n % 10:
        return _UNITE[n % 10]
    if n % 100:
        return _ONLAR[(n // 10) % 10]
    return "yüz" if n % 1000 else "bin"


def beklenen_ek(n, sinif):
    w = _son_kelime(n)
    unlu = [c for c in w if c in "aeıioöuü"][-1]
    sonu_unlu = w[-1] in "aeıioöuü"
    sert = w[-1] in "çfhkpsşt"
    ince = unlu in "eiöü"
    if sinif == "dir":
        v = {"a": "ı", "ı": "ı", "e": "i", "i": "i", "o": "u", "u": "u", "ö": "ü", "ü": "ü"}[unlu]
        return ("t" if sert else "d") + v + "r"
    if sinif == "e":
        return ("y" if sonu_unlu else "") + ("e" if ince else "a")
    if sinif == "den":
        return ("t" if sert else "d") + ("e" if ince else "a") + "n"
    return ("t" if sert else "d") + ("e" if ince else "a")


_SINIF = {"dir": "dir", "dır": "dir", "dur": "dir", "dür": "dir", "tir": "dir", "tır": "dir", "tur": "dir", "tür": "dir",
          "a": "e", "e": "e", "ya": "e", "ye": "e", "den": "den", "dan": "den", "ten": "den", "tan": "den",
          "de": "de", "da": "de", "te": "de", "ta": "de"}
_EKRX = re.compile(r"(?<![\d,/.])(\d+)'([a-zçğıöşü]+)")


def metin(q):
    bul = []
    for ad, t in (("soru", q["q"]), ("çözüm", q["x"])):
        for m in _EKRX.finditer(t):
            ek = m.group(2)
            if ek in _SINIF:
                bek = beklenen_ek(int(m.group(1)), _SINIF[ek])
                if ek != bek:
                    bul.append({"tur": "metin", "ne": f"{ad}: «{m.group(0)}» yanlış ek (olmalı «{m.group(1)}'{bek}»)", "oneri": "DÜZELT"})
        if re.search(r"(?:^|[\s(])-\d", t):
            bul.append({"tur": "metin", "ne": f"{ad}: ASCII eksi işareti", "oneri": "DÜZELT"})
        if re.search(r"None|nan\b|\binf\b|  +|\s$|^\s", t):
            bul.append({"tur": "metin", "ne": f"{ad}: boşluk/yer tutucu hatası", "oneri": "DÜZELT"})
    return bul


# ------------------------------------------------------------------ şık kalitesi
def sik(q):
    try:
        v = [B.sec_deger(o) for o in q["o"]]
    except Exception:  # noqa: BLE001
        return [{"tur": "sik", "ne": "şıklar sayıya çevrilemedi", "oneri": "DÜZELT"}]
    bul, c = [], v[q["a"]]
    gaplar = {v[i + 1] - v[i] for i in range(4)}
    if len(gaplar) == 1:
        bul.append({"tur": "sik", "ne": "zayıf çeldirici: beş şık eşit aralıklı (sayısal dolgu, öğrenci hatası yok)", "oneri": "DÜZELT"})
    tol = max(F(3, 4) * abs(c), 6)
    uzak = [str(x) for i, x in enumerate(v) if i != q["a"] and (abs(x - c) > tol or (c > 0 and x <= 0) or (c < 0 and x >= 0))]
    if uzak:
        bul.append({"tur": "sik", "ne": "bariz alakasız çeldirici: " + ", ".join(uzak) + f" (cevap {c})", "oneri": "DÜZELT"})
    return bul


def denetle(q):
    return gerceklik(q) + cozum_islemleri(q) + metin(q) + sik(q)


def main(kok, cikti):
    sonuc, sayac, konu = {}, {}, {}
    for dosya in sorted(glob.glob(os.path.join(kok, "*", "onayli.jsonl"))):
        ad = os.path.basename(os.path.dirname(dosya))
        for satir in open(dosya, encoding="utf8"):
            if not satir.strip():
                continue
            q = json.loads(satir)
            b = denetle(q)
            if b:
                sonuc[q["id"]] = b
            for x in b:
                sayac[x["tur"]] = sayac.get(x["tur"], 0) + 1
                konu.setdefault(ad, {}).setdefault(x["tur"], 0)
                konu[ad][x["tur"]] += 1
    json.dump(sonuc, open(cikti, "w", encoding="utf8"), ensure_ascii=False)
    print(json.dumps({"bulgulu_soru": len(sonuc), "bulgu_turu": sayac, "konu": konu}, ensure_ascii=False))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
