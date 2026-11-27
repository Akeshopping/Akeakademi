"""TYT Matematik · BAĞIMSIZ denetçiler. Bu dosya kalıp dosyasını İÇE AKTARMAZ.
Her denetçi, soru ifadesini ham veriden (prm) yeniden kurar ve bir şıkkın koşulu sağlayıp sağlamadığını
tarama / sayma / tam sayı aritmetiği gibi KALIPTAN FARKLI bir yolla sınar.
kosul(prm, v) → bool · adim(prm) → çözüm adım sayısı (zorluk ölçümü için)
"""
import math
from fractions import Fraction as F

from cekirdek import denetci


def yak(a, b, e=1e-6):
    if not (math.isfinite(a) and math.isfinite(b)):
        return a == b
    return abs(a - b) <= e * max(1.0, abs(a), abs(b))


def tam(v):
    return abs(v - round(v)) < 1e-9


# ---- Sayı Basamakları
def _sb(p, v):
    if not tam(v):
        return False
    v = int(round(v))
    if p["tip"] == 1:
        adaylar = [n for n in range(10, 100) if n // 10 + n % 10 == p["S"] and n - (n % 10 * 10 + n // 10) == p["D"]]
        return adaylar == [v]
    if p["tip"] == 2:
        uygun = [n for n in range(100, 1000) if len(set(str(n))) == 3 and sum(map(int, str(n))) == p["S"]]
        return v == max(uygun)
    return v == len([n for n in range(10, 100) if n % 2 == 0 and n // 10 + n % 10 == p["S"]])


denetci("tyt-mat-sayi-basamaklari", _sb, lambda p: [0, 3, 4, 5][p["tip"]])


# ---- Rasyonel Sayılar
def _ras(p, v):
    if p["tip"] == 1:
        pay = p["a"] * p["d"] + p["c"] * p["b"]
        payda = p["b"] * p["d"]
        return yak(v, pay / payda, 1e-9)
    if p["tip"] == 2:
        return tam(v) and int(round(v)) * p["p"] == p["K"] * p["q"]
    if not tam(v):
        return False
    L = int(round(v))
    kalan_pay = L * (p["b"] - p["a"]) * (p["d"] - p["c"])
    return kalan_pay == p["R"] * p["b"] * p["d"]


denetci("tyt-mat-rasyonel", _ras, lambda p: [0, 3, 3, 6][p["tip"]])


# ---- Basit Eşitsizlikler
def _be(p, v):
    if not tam(v):
        return False
    v = int(round(v))
    if p["tip"] == 1:
        return v == sum(1 for x in range(1, 1000) if p["a"] * x + p["b"] < p["c"])
    if p["tip"] == 2:
        return v == sum(x for x in range(-200, 201) if p["alt"] < p["a"] * x + p["b"] <= p["ust"])
    return v == sum(1 for x in range(-300, 301) if abs(p["a"] * x - p["b"]) <= p["c"])


denetci("tyt-mat-basit-esitsizlik", _be, lambda p: [0, 2, 4, 5][p["tip"]])


# ---- Çarpanlara Ayırma
def _ca(p, v):
    if p["tip"] == 1:
        for x in range(-100, 101):
            for y in range(-100, 101):
                if x - y == p["A"] and x + y == p["B"]:
                    return tam(v) and int(round(v)) == x * x - y * y
        return False
    if p["tip"] == 2:
        for a in range(-60, 61):
            b = p["S"] - a
            if a * b == p["P"]:
                return tam(v) and int(round(v)) == a * a + b * b
        return False
    k = p["k"]
    x = (k + math.sqrt(k * k - 4)) / 2
    return yak(x ** 3 + 1 / x ** 3, v, 1e-9)


denetci("tyt-mat-carpanlara-ayirma", _ca, lambda p: [0, 2, 3, 6][p["tip"]])


# ---- Yaş Problemleri
def _yas(p, v):
    if not tam(v):
        return False
    v = int(round(v))
    if p["tip"] == 1:
        return [a for a in range(0, 120) if a + (a + p["F"]) == p["T"]] == [v]
    if p["tip"] == 2:
        return [x for x in range(0, 120) if p["B"] + x == p["k"] * (p["O"] + x)] == [v]
    return [c for c in range(0, 120) if c + (c + p["b"]) + (c + p["b"] + p["a"]) == p["T"]] == [v]


denetci("tyt-mat-yas", _yas, lambda p: [0, 2, 4, 5][p["tip"]])


# ---- Kar Zarar
def _kz(p, v):
    if p["tip"] == 1:
        return yak(v, p["A"] * (100 + p["p"]) / 100, 1e-9)
    if p["tip"] == 2:
        return yak(v * (100 - p["p"]) / 100, p["S"], 1e-9)
    alis_kar = F(p["S"]) / (1 + F(p["p"], 100))
    alis_zarar = F(p["S"]) / (1 - F(p["p"], 100))
    return tam(v) and alis_kar + alis_zarar - 2 * p["S"] == int(round(v))


denetci("tyt-mat-kar-zarar", _kz, lambda p: [0, 1, 3, 6][p["tip"]])


# ---- Karışım
def _kar(p, v):
    if p["tip"] == 1:
        tuz = F(p["a"] * p["m1"] + p["b"] * p["m2"], 100)
        return yak(v, float(tuz / (p["m1"] + p["m2"]) * 100), 1e-9)
    if p["tip"] == 2:
        return tam(v) and F(p["m"] * p["a"], 100) == F(p["m"] + int(round(v))) * p["b"] / 100
    x = v
    return tam(x) and yak(p["a"] * x + p["b"] * p["y"], p["c"] * (x + p["y"]), 1e-9)


denetci("tyt-mat-karisim", _kar, lambda p: [0, 3, 4, 6][p["tip"]])
