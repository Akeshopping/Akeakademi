"""Yaş kalıpları · bağımsız denetçiler (kalıp dosyasını içe aktarmaz). Her biri koşulları tarayarak çözer."""
from cekirdek import denetci

AR = range(0, 151)


def tam(v):
    return abs(v - round(v)) < 1e-9


def _kat(p, v):
    if not tam(v):
        return False
    v, k = int(round(v)), p["k"]
    if p["tip"] == 1:
        return [s for s in AR if (k + 1) * s == p["T"]] == [v]
    if p["tip"] == 2:
        return [k * s for s in AR if (k + 1) * s == p["T"]] == [v]
    return [k * s for s in AR if (k + 1) * s - 2 * p["m"] == p["P"]] == [v]


def _aile(p, v):
    sol = [s for s in AR if s + 2 * p["c"] * s + p["b"] == p["T"]]
    if len(sol) != 1:
        return False
    s = sol[0]
    mo, fa = p["c"] * s, p["c"] * s + p["b"]
    hedef = {1: s, 2: fa, 3: mo + fa + 2 * p.get("n", 0)}[p["tip"]]
    return tam(v) and int(round(v)) == hedef


def _oran(p, v):
    sol = [s for s in AR if s > 0 and (p["T"] - s) * p["q"] == p["p"] * s]
    if len(sol) != 1:
        return False
    s = sol[0]
    hedef = {1: s, 2: p["T"] - 2 * s, 3: p["T"] - s + p.get("n", 0)}[p["tip"]]
    return tam(v) and int(round(v)) == hedef


def _gg(p, v):
    cozum = [(x, y) for x in range(1, 100) for y in range(1, 200)
             if x > p["a"] and y - p["a"] == p["k"] * (x - p["a"]) and y + p["b"] == p["l"] * (x + p["b"])]
    if len(cozum) != 1:
        return False
    x, y = cozum[0]
    return tam(v) and int(round(v)) == {1: x, 2: y, 3: x + y}[p["tip"]]


def _ort(p, v):
    if not tam(v):
        return False
    n, M, M2, v = p["n"], p["M"], p["M2"], int(round(v))
    if p["tip"] == 1:
        return [y for y in AR if n * M - y == (n - 1) * M2] == [v]
    if p["tip"] == 2:
        return [y for y in AR if n * M + y == (n + 1) * M2] == [v]
    return [a for a in AR if n * M - p["z"] - a == (n - 2) * M2] == [v]


def _fark(p, v):
    sol = [(o, o - p["dif"]) for o in range(1, 150) if o - p["dif"] > p["n"] and (o - p["n"]) + (o - p["dif"] - p["n"]) == p["P"]]
    if len(sol) != 1:
        return False
    o, y = sol[0]
    hedef = {1: o, 2: o + y + 2 * p.get("m", 0), 3: o * y}[p["tip"]]
    return tam(v) and int(round(v)) == hedef


denetci("yas-kat-toplam", _kat, lambda p: [0, 2, 3, 5][p["tip"]])
denetci("yas-aile-uzun", _aile, lambda p: [0, 4, 5, 6][p["tip"]])
denetci("yas-oran", _oran, lambda p: [0, 3, 4, 5][p["tip"]])
denetci("yas-gecmis-gelecek", _gg, lambda p: [0, 6, 7, 8][p["tip"]])
denetci("yas-ortalama", _ort, lambda p: [0, 3, 3, 5][p["tip"]])
denetci("yas-fark", _fark, lambda p: [0, 3, 4, 5][p["tip"]])
