#!/usr/bin/env python3
"""AKE Akademi · komut sistemi.
  python3 yks.py konular                      → katalog + kalıp sayıları
  python3 yks.py uret --konu "Yaş" --adet 1000 [--tohum 1]   → üret + bağımsız denetle + zorluk ölç
  python3 yks.py uret --hepsi --adet 500
Çıktı: ../../soru-cikti/py/<konu>/{onayli.jsonl,red.jsonl,rapor.json}  (git'e girmez)
"""
import argparse
import json
import math
import os
import random
import re
import sys
from fractions import Fraction

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cekirdek as C  # noqa: E402
import kaliplar_tyt_mat  # noqa: E402,F401
import denetciler_tyt_mat  # noqa: E402,F401
import kaliplar_yas  # noqa: E402,F401
import denetciler_yas  # noqa: E402,F401
from konular import KATALOG  # noqa: E402

CIKTI = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "soru-cikti", "py"))
BOLUSUM = {1: 0.30, 2: 0.45, 3: 0.25}


def sayi(metin):
    m = metin.replace("−", "-").replace("%", "").replace(",", ".").strip()
    if "/" in m:
        a, b = m.split("/")
        return float(Fraction(int(a), int(b)))
    return float(m)


def zorluk_olc(soru, prm, adim):
    deg = [sayi(o) for o in soru["o"]]
    buyuk = max(abs(v) for v in deg)
    dogru = deg[soru["a"]]
    en_yakin = min((abs(v - dogru) for i, v in enumerate(deg) if i != soru["a"]), default=1)
    skor = adim + 0.6 * math.log10(1 + buyuk) + (0.6 if en_yakin <= 0.08 * max(abs(dogru), 1e-9) else 0)
    return 1 if skor < 3.2 else 2 if skor < 5.4 else 3


def denetle(uretim):
    """Bağımsız denetim. (tamam, sebep, olculen_d)"""
    s, m = uretim["soru"], uretim["meta"]
    den = C.DENETCILER.get(m["kalip"])
    if not den:
        return False, "denetçi yok", None
    if len(s["o"]) != 5 or len(set(s["o"])) != 5:
        return False, "şıklar 5 farklı değil", None
    try:
        deg = [sayi(o) for o in s["o"]]
    except Exception:
        return False, "şık ayrıştırılamadı", None
    if deg != sorted(deg):
        return False, "şıklar sıralı değil", None
    gecen = [i for i, v in enumerate(deg) if den["kosul"](m["prm"], v)]
    if gecen != [s["a"]]:
        return False, f"koşulu sağlayan şıklar {gecen}, işaretli {s['a']}", None
    if f"{'ABCDE'[s['a']]} şıkkıdır" not in s["x"] or s["o"][s["a"]] not in s["x"]:
        return False, "açıklama cevabı içermiyor", None
    return True, "", zorluk_olc(s, m["prm"], den["adim"](m["prm"]))


def slug(t):
    t = t.lower().translate(str.maketrans("çğıöşüâ", "cgiosua"))
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")


def uret_konu(konu, kalip_listesi, adet, tohum):
    r = random.Random(f"{tohum}|{konu}")
    onayli, red, gorulen = [], [], set()
    rapor = {"konu": konu, "istenen": adet, "kalip": [k.id for k in kalip_listesi], "red_sebep": {}, "doygun": []}
    hedef = {d: round(adet * p) for d, p in BOLUSUM.items()}
    hedef[2] += adet - sum(hedef.values())
    sayac = {}
    for d in (1, 2, 3):
        i, denemeler, bos = 0, 0, {}
        while sum(1 for q in onayli if q["dUret"] == d) < hedef[d]:   # üretim zorluğu sayılır (ölçülen d değil)
            k = kalip_listesi[i % len(kalip_listesi)]
            i += 1
            denemeler += 1
            if denemeler > hedef[d] * 60 + 200:
                break
            if bos.get(k.id, 0) >= 400:
                if k.id + f"#{d}" not in rapor["doygun"]:
                    rapor["doygun"].append(k.id + f"#{d}")
                if all(bos.get(x.id, 0) >= 400 for x in kalip_listesi):
                    break
                continue
            u = C.kur(k, d, r)
            if not u or u["meta"]["anahtar"] in gorulen:
                bos[k.id] = bos.get(k.id, 0) + 1
                continue
            gorulen.add(u["meta"]["anahtar"])
            ok, sebep, olculen = denetle(u)
            if not ok:
                rapor["red_sebep"][sebep] = rapor["red_sebep"].get(sebep, 0) + 1
                red.append({"id": u["soru"]["id"], "kalip": k.id, "sebep": sebep, "q": u["soru"]["q"]})
                continue
            bos[k.id] = 0
            u["soru"]["d"] = olculen  # bağımsız ölçülen zorluk
            u["soru"]["dUret"] = d
            sayac[(k.id, olculen)] = sayac.get((k.id, olculen), 0) + 1
            onayli.append(u["soru"])
    rapor["onayli"] = len(onayli)
    rapor["red"] = len(red)
    rapor["zorluk_dagilimi"] = {str(d): sum(1 for q in onayli if q["d"] == d) for d in (1, 2, 3)}
    rapor["uyusmayan_zorluk"] = sum(1 for q in onayli if q["d"] != q["dUret"])
    return onayli, red, rapor


def komut_konular(_):
    toplam = 0
    for ders, (yontem, konular) in KATALOG.items():
        kal = {k.konu for k in C.KALIPLAR.values() if k.ders == ders}
        var = sum(1 for k in konular if k in kal)
        toplam += var
        print(f"{ders:24s} {yontem:7s} konu={len(konular):3d}  kalıbı hazır={var}")
        for k in konular:
            if k in kal:
                print("     ✓", k, f"({sum(1 for x in C.KALIPLAR.values() if x.konu == k)} kalıp)")
    print(f"\nToplam kalıbı hazır konu: {toplam} · kalıp: {len(C.KALIPLAR)}")


def komut_uret(a):
    gruplar = {}
    for k in C.KALIPLAR.values():
        gruplar.setdefault(k.konu, []).append(k)
    secilen = list(gruplar) if a.hepsi else [t for t in gruplar if a.konu and a.konu.lower() in t.lower()]
    if not secilen:
        print("Eşleşen konu yok. `python3 yks.py konular` ile bak.")
        return 1
    if a.cikti and os.path.isdir(a.cikti) and any(os.scandir(a.cikti)):
        print("DURDUR: --cikti dolu bir klasör; mevcut çıktının üzerine yazılmaz.")
        return 3
    for konu in secilen:
        onayli, red, rapor = uret_konu(konu, gruplar[konu], a.adet, a.tohum)
        kl = os.path.join(a.cikti or CIKTI, slug(konu))
        os.makedirs(kl, exist_ok=True)
        with open(os.path.join(kl, "onayli.jsonl"), "w", encoding="utf8") as f:
            for q in onayli:
                f.write(json.dumps(q, ensure_ascii=False) + "\n")
        with open(os.path.join(kl, "red.jsonl"), "w", encoding="utf8") as f:
            for q in red:
                f.write(json.dumps(q, ensure_ascii=False) + "\n")
        json.dump(rapor, open(os.path.join(kl, "rapor.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
        print(f"{konu}: istenen {a.adet} → onaylı {rapor['onayli']} · red {rapor['red']} · zorluk {rapor['zorluk_dagilimi']} · doygun {rapor['doygun'] or '-'}")
    return 0


def main():
    p = argparse.ArgumentParser(prog="yks.py")
    s = p.add_subparsers(dest="komut", required=True)
    s.add_parser("konular").set_defaults(f=komut_konular)
    u = s.add_parser("uret")
    u.add_argument("--konu")
    u.add_argument("--hepsi", action="store_true")
    u.add_argument("--adet", type=int, default=1000)
    u.add_argument("--tohum", type=int, default=1)
    u.add_argument("--cikti", help="çıktı kökü (varsayılan: soru-cikti/py); mevcut bir klasörün ÜZERİNE yazmayı reddeder")
    u.set_defaults(f=komut_uret)
    a = p.parse_args()
    sys.exit(a.f(a) or 0)


if __name__ == "__main__":
    main()
