"""AKE Akademi · Python soru üretim çekirdeği (ücretsiz, yapay zekâ çağrısı yok).

Bir "kalıp" = bir soru tipi. Kalıp, 3 zorlukta (1 kolay, 2 orta, 3 zor) parametreli soru üretir.
Doğru cevap kodla hesaplanır, çeldiriciler öğrencinin gerçek hatalarından türetilir.
Doğrulama AYRI dosyalardaki "denetçi"lerle yapılır; denetçi kalıp dosyasını içe aktarmaz.
"""
import hashlib
import json
import math
import random
import re
from dataclasses import dataclass
from fractions import Fraction
from typing import Callable

# ---------------------------------------------------------------- biçimleme


def tr(v, k=4):
    """Sayıyı Türkçe yazım biçimine çevirir: ondalık virgül, gerçek eksi işareti, kesir a/b."""
    if isinstance(v, str):
        return v
    if isinstance(v, Fraction):
        if v.denominator == 1:
            return tr(int(v))
        return f"{v.numerator}/{v.denominator}".replace("-", "−")
    f = float(v)
    s = str(int(f)) if f == int(f) else f"{f:.{k}f}".rstrip("0").rstrip(".").replace(".", ",")
    return s.replace("-", "−")


def dogrusal(a, b, ad="x"):
    """ax + b biçiminde yazım: işaretleri düzgün yazar."""
    ilk = ad if a == 1 else ("−" + ad if a == -1 else f"{tr(a)}{ad}")
    if b == 0:
        return ilk
    return f"{ilk} {'+' if b > 0 else '−'} {tr(abs(b))}"


_EKSI = re.compile(r"(^|[\s(=,;:])-(?=\d)")


def eksi_duzelt(metin):
    return _EKSI.sub(lambda m: m.group(1) + "−", metin)



# ---------------------------------------------------------------- Türkçe sayı sonrası ek uyumu
_SON = {1: ("i", False, "r"), 2: ("i", True, ""), 3: ("ü", False, "ç"), 4: ("ö", False, "t"), 5: ("e", False, "ş"), 6: ("ı", True, ""),
        7: ("i", True, ""), 8: ("i", False, "z"), 9: ("u", False, "z")}
_ONLAR = {1: ("o", "n"), 2: ("i", ""), 3: ("u", "z"), 4: ("ı", "k"), 5: ("i", ""), 6: ("ı", "ş"), 7: ("i", "ş"), 8: ("e", "n"), 9: ("a", "n")}


def _son_ses(n):
    """Sayının okunuşunun son ünlüsü ve son harfi (ek uyumu için)."""
    n = abs(int(n))
    if n % 10:
        u, _, c = _SON[n % 10]
        return u, c
    if n % 100:
        u, c = _ONLAR[(n // 10) % 10]
        return u, c
    return ("ü", "z") if n % 1000 else ("i", "n")   # yüz / bin


def sayi_eki(n, sinif):
    """sinif: 'dir' (-dir/-dır/-dur/-dür/-tir…), 'e' (yönelme), 'den' (ayrılma), 'de' (bulunma)."""
    u, c = _son_ses(n)
    unlu_biter = c == ""
    sert = c in ("ç", "f", "h", "k", "p", "s", "ş", "t")
    arka = u in "aıou"
    if sinif == "dir":
        v = {"a": "ı", "ı": "ı", "e": "i", "i": "i", "o": "u", "u": "u", "ö": "ü", "ü": "ü"}[u]
        return ("t" if sert else "d") + v + "r"
    if sinif == "e":
        return ("y" if unlu_biter else "") + ("a" if arka else "e")
    if sinif == "den":
        return ("t" if sert else "d") + ("a" if arka else "e") + "n"
    return ("t" if sert else "d") + ("a" if arka else "e")


_EK_SINIF = {**{k: "dir" for k in ("dir", "dır", "dur", "dür", "tir", "tır", "tur", "tür")}, **{k: "e" for k in ("a", "e", "ya", "ye")},
             **{k: "den" for k in ("den", "dan", "ten", "tan")}, **{k: "de" for k in ("de", "da", "te", "ta")}}
_EK_RX = re.compile(r"(?<![\d,/.])(\d+)'(" + "|".join(sorted(_EK_SINIF, key=len, reverse=True)) + r")(?![a-zçğıöşü])")


def ek_duzelt(metin):
    """Rakamla yazılmış sayıdan sonraki 'ek'leri okunuşa göre düzeltir (3'ya → 3'e, 6'dir → 6'dır, 5'ten, 10'dan …)."""
    return _EK_RX.sub(lambda m: f"{m.group(1)}'{sayi_eki(int(m.group(1)), _EK_SINIF[m.group(2)])}", metin)


# ---------------------------------------------------------------- şık kurma


def _yuvarla(v):
    if isinstance(v, Fraction):
        return v
    f = float(v)
    return int(f) if f.is_integer() else round(f, 4)


def _ondalik(v):
    if isinstance(v, (int, Fraction)):
        return 0
    return len(f"{v:.4f}".rstrip("0").split(".")[1]) if "." in f"{v:.4f}".rstrip("0") else 0


def _guzel(x):
    e = 10 ** math.floor(math.log10(x))
    m = x / e
    return (1 if m <= 1 else 2 if m <= 2 else 5 if m <= 5 else 10) * e


def secenek_kur(r, dogru, yanlis, bic=tr, pozitif=False, adim=None):
    """4 yanlış + 1 doğru şık. Şıklar küçükten büyüğe sıralanır, doğru şıkkın yeri dengeli dağılır.
    Dönüş: (şık_metinleri, doğru_indeks, değerler) ya da None."""
    kesirli = isinstance(dogru, Fraction)
    if kesirli:
        yanlis = [Fraction(y) for y in yanlis if isinstance(y, (int, Fraction))]
    else:
        dogru = _yuvarla(dogru)
        yanlis = [_yuvarla(y) for y in yanlis if y is not None and math.isfinite(float(y))]
    tam = (not kesirli) and float(dogru).is_integer()
    en_ondalik = max(2, _ondalik(dogru))
    if adim is None:
        adim = Fraction(1, 2 * dogru.denominator) if kesirli else (max(1, _guzel(max(abs(dogru) * 0.12, 1e-9))) if tam else max(0.1, _guzel(max(abs(dogru) * 0.12, 1e-9))))
    dogru_metin = bic(dogru)
    gorulen, havuz = {dogru_metin}, []
    for y in yanlis:
        if pozitif and y <= 0:
            continue
        if tam and not float(y).is_integer():
            continue
        if not kesirli and _ondalik(y) > en_ondalik:
            continue
        m = bic(y)
        if m in gorulen:
            continue
        gorulen.add(m)
        havuz.append(y)
    alt = sorted([v for v in havuz if v < dogru], reverse=True)
    ust = sorted([v for v in havuz if v > dogru])

    dolgu = [0]

    def doldur(liste, yon, n):
        cikti = list(liste[:n])
        gor = {bic(v) for v in cikti} | {dogru_metin}
        j = 1
        while len(cikti) < n and j < 80:
            v = dogru + yon * j * adim
            j += 1
            v = v if kesirli else _yuvarla(v)
            if pozitif and v <= 0:
                break
            if tam and not float(v).is_integer():
                continue
            m = bic(v)
            if m in gor:
                continue
            gor.add(m)
            cikti.append(v)
            dolgu[0] += 1
        return cikti if len(cikti) == n else None

    sira = [0, 1, 2, 3, 4]
    r.shuffle(sira)
    for k in sira:
        dolgu[0] = 0
        a, u = doldur(alt, -1, k), doldur(ust, +1, 4 - k)
        if a is None or u is None:
            continue
        degerler = sorted(a + [dogru] + u, key=float)
        metin = [bic(v) for v in degerler]
        if len(set(metin)) != 5:
            continue
        return metin, degerler.index(dogru), degerler, dolgu[0]
    return None


# ---------------------------------------------------------------- kayıt defteri


@dataclass
class Kalip:
    id: str
    ders: str      # konular.py'deki ders anahtarı
    konu: str      # konular.py'deki konu adı (birebir)
    fn: Callable
    pozitif: bool = True


KALIPLAR: dict = {}
DENETCILER: dict = {}


def kalip(id, ders, konu, pozitif=True):
    def sar(fn):
        if id in KALIPLAR:
            raise ValueError("kalıp kimliği tekrar: " + id)
        KALIPLAR[id] = Kalip(id, ders, konu, fn, pozitif)
        return fn
    return sar


def denetci(id, kosul, adim):
    """kosul(prm, v) → v değeri sorunun koşulunu sağlıyor mu; adim(prm) → çözüm adım sayısı (zorluk için)."""
    DENETCILER[id] = {"kosul": kosul, "adim": adim}


def kur(k, d, r):
    """Bir kalıptan tek soru kurar. {soru, meta} ya da None döner."""
    g = k.fn(r, d)
    if not g:
        return None
    sec = secenek_kur(r, g["dogru"], g["yanlis"], bic=g.get("bic", tr), pozitif=g.get("pozitif", k.pozitif), adim=g.get("adim"))
    if not sec:
        return None
    metin, a, degerler, dolgu = sec
    if dolgu >= 2:   # çeldiricilerin çoğu 'gerçek öğrenci hatası' değil sayısal dolgu: kalitesiz, reddedilir
        return None
    x = ek_duzelt(eksi_duzelt(g["x"].strip())) + f" Doğru cevap {'ABCDE'[a]} şıkkıdır."
    q = ek_duzelt(eksi_duzelt(g["q"].strip()))
    anahtar = k.id + "|" + json.dumps(g["prm"], sort_keys=True, ensure_ascii=False)
    kimlik = f"py-{k.ders}-{hashlib.sha1(anahtar.encode()).hexdigest()[:8]}"
    if re.search(r"\d[.,]\d{5,}|None|nan|inf", q + " ".join(metin) + x):
        return None
    soru = {"id": kimlik, "s": k.ders, "t": k.konu, "d": d, "q": q, "o": metin, "a": a, "x": x}
    return {"soru": soru, "meta": {"kalip": k.id, "uz": g.get("uz"), "dolgu": dolgu, "prm": g["prm"], "dUret": d, "degerler": [float(v) for v in degerler], "anahtar": anahtar}}
