"""Yaş Problemleri · KISA ve UZUN kalıplar. Uzunluk ile zorluk birbirinden bağımsız: her kalıp kolay/orta/zor üretir.
'uz' = 'kisa' | 'uzun'. Her kalıp ayrı bir soru yapısıdır (aynı kalıbın sayıları değişir)."""
from math import gcd

from cekirdek import kalip

D, K = "tyt_matematik", "Yaş Problemleri"


def gercekci_ec(ebeveyn, cocuk, gecmis=0):
    """Ebeveyn-çocuk gerçekçiliği: yaş farkı 20-45, ebeveyn ≤ 70, geçmişte sorulan zamanda çocuk en az 1 yaşında."""
    return 20 <= ebeveyn - cocuk <= 45 and ebeveyn <= 70 and cocuk - gecmis >= 1


# 1 · KISA · k katı + toplam
@kalip("yas-kat-toplam", D, K)
def yas_kat_toplam(r, d):
    for _ in range(300):
        k = r.randint(2, 4) if d == 1 else r.randint(2, 6)
        s = r.randint(5, 30)
        if gercekci_ec(k * s, s):
            break
    else:
        return None
    f, T = k * s, (k + 1) * s
    if d == 1:
        return dict(uz="kisa", prm=dict(tip=1, k=k, T=T), q=f"Bir annenin yaşı kızının yaşının {k} katıdır. İkisinin yaşları toplamı {T} olduğuna göre kızı kaç yaşındadır?",
                    dogru=s, yanlis=[f, T // k, s + 1, s - 1, s + 2, s - 2, T - 2 * s],
                    x=f"Kızın yaşı x ise annenin yaşı {k}x olur. x + {k}x = {T} denkleminden x = {s} bulunur.")
    if d == 2:
        return dict(uz="kisa", prm=dict(tip=2, k=k, T=T), q=f"Bir babanın yaşı oğlunun yaşının {k} katıdır. İkisinin yaşları toplamı {T} olduğuna göre baba kaç yaşındadır?",
                    dogru=f, yanlis=[s, T // k, f + k, f - k, T - 1, f + s],
                    x=f"Oğul x yaşında ise baba {k}x yaşındadır. {k + 1}x = {T} olduğundan x = {s} ve baba {f} yaşındadır.")
    m = r.randint(1, s - 1)
    P = T - 2 * m
    return dict(uz="kisa", prm=dict(tip=3, k=k, m=m, P=P), q=f"Bir annenin yaşı kızının yaşının {k} katıdır. {m} yıl önce ikisinin yaşları toplamı {P} olduğuna göre annenin bugünkü yaşı kaçtır?",
                dogru=f, yanlis=[s, f - m, f + m, f + 2 * m, T - s + m, f - 2 * m],
                x=f"{m} yıl önce toplam {P} ise bugünkü toplam {P} + 2·{m} = {T} olur. {k + 1}x = {T} ile kızın yaşı {s}, annenin yaşı {f} bulunur.")


# 2 · UZUN · üç kişilik aile
@kalip("yas-aile-uzun", D, K)
def yas_aile(r, d):
    for _ in range(300):
        c, s, b = r.randint(2, 4), r.randint(5, 25), r.randint(2, 7)
        if gercekci_ec(c * s, s) and gercekci_ec(c * s + b, s) and c * s <= 55:
            break
    else:
        return None
    mo = c * s
    fa = mo + b
    T = s + mo + fa
    giris = f"Bir ailede anne, baba ve bir çocuk vardır. Annenin yaşı çocuğun yaşının {c} katıdır. Baba, anneden {b} yaş büyüktür. Üç kişinin yaşları toplamı {T} olduğuna göre"
    if d == 1:
        return dict(uz="uzun", prm=dict(tip=1, c=c, b=b, T=T), q=giris + " çocuk kaç yaşındadır?", dogru=s,
                    yanlis=[mo, fa, T // 3, s + 1, s - 1, s + b],
                    x=f"Çocuk x yaşında ise anne {c}x, baba {c}x + {b} yaşındadır. Toplam {2 * c + 1}x + {b} = {T} olur. Buradan x = {s} bulunur.")
    if d == 2:
        return dict(uz="uzun", prm=dict(tip=2, c=c, b=b, T=T), q=giris + " baba kaç yaşındadır?", dogru=fa,
                    yanlis=[mo, s, T // 3, fa + b, fa - b, fa + 1],
                    x=f"Çocuk x yaşında ise toplam {2 * c + 1}x + {b} = {T} olur ve x = {s} bulunur. Baba {c}·{s} + {b} = {fa} yaşındadır.")
    n = r.randint(2, 9)
    return dict(uz="uzun", prm=dict(tip=3, c=c, b=b, T=T, n=n), q=giris + f" {n} yıl sonra anne ile babanın yaşları toplamı kaç olur?", dogru=mo + fa + 2 * n,
                yanlis=[mo + fa, mo + fa + n, mo + fa - 2 * n, T + 3 * n, mo + fa + 3 * n, T + 2 * n],
                x=f"Çocuğun yaşı {s}, annenin yaşı {mo}, babanın yaşı {fa} bulunur. {n} yıl sonra ikisi de {n} yaş büyüyeceği için toplam {mo + fa} + {2 * n} = {mo + fa + 2 * n} olur.")


# 3 · KISA · yaş oranı
@kalip("yas-oran", D, K)
def yas_oran(r, d):
    for _ in range(400):
        q = r.randint(1, 4)
        p = r.randint(q + 1, 7)
        u = r.randint(2, 15)
        if gcd(p, q) == 1 and gercekci_ec(p * u, q * u):
            break
    else:
        return None
    kucuk, buyuk = q * u, p * u
    T = kucuk + buyuk
    if d == 1:
        return dict(uz="kisa", prm=dict(tip=1, p=p, q=q, T=T), q=f"Bir anne ile kızının yaşları oranı {p}/{q}, yaşları toplamı {T} olduğuna göre kızı kaç yaşındadır?", dogru=kucuk,
                    yanlis=[buyuk, T // p, kucuk + u, kucuk - 1, kucuk + 1, buyuk - kucuk + 1],
                    x=f"Yaşlar {p}k ve {q}k alınır. {p + q}k = {T} ile k = {u} bulunur. Kızın yaşı {q}·{u} = {kucuk}'dir.")
    if d == 2:
        return dict(uz="kisa", prm=dict(tip=2, p=p, q=q, T=T), q=f"Bir anne ile kızının yaşları oranı {p}/{q}, yaşları toplamı {T} olduğuna göre anne ile kızı arasındaki yaş farkı kaçtır?", dogru=buyuk - kucuk,
                    yanlis=[T, u, buyuk, kucuk, buyuk - kucuk + u, buyuk - kucuk - 1],
                    x=f"Yaşlar {p}k ve {q}k alınır, {p + q}k = {T} olduğundan k = {u} bulunur. Fark ({p} − {q})·{u} = {buyuk - kucuk} olur.")
    n = r.randint(2, 8)
    return dict(uz="kisa", prm=dict(tip=3, p=p, q=q, T=T, n=n), q=f"Bir anne ile kızının yaşları oranı {p}/{q}, yaşları toplamı {T} olduğuna göre {n} yıl sonra annenin yaşı kaç olur?", dogru=buyuk + n,
                yanlis=[buyuk, buyuk + 2 * n, kucuk + n, T + n, buyuk - n, buyuk + n + 1],
                x=f"Yaşlar {p}k ve {q}k alınır, k = {u} bulunur. Annenin şimdiki yaşı {buyuk}, {n} yıl sonra {buyuk + n} olur.")


# 4 · UZUN · geçmiş ve gelecek iki ilişki
@kalip("yas-gecmis-gelecek", D, K)
def yas_gecmis_gelecek(r, d):
    for _ in range(400):
        s = r.randint(8, 20)
        a = r.randint(1, s - 2)
        k = r.randint(3, 6)
        f = a + k * (s - a)
        b = r.randint(1, 15)
        if (f + b) % (s + b) == 0:
            l = (f + b) // (s + b)
            if 2 <= l < k and gercekci_ec(f, s, a):
                break
    else:
        return None
    giris = f"Bir baba ile oğlu hakkında şu bilgiler veriliyor: {a} yıl önce babanın yaşı oğlunun yaşının {k} katıydı. {b} yıl sonra babanın yaşı oğlunun yaşının {l} katı olacaktır."
    prm = dict(a=a, k=k, b=b, l=l)
    ortak = f"y − {a} = {k}(x − {a}) ve y + {b} = {l}(x + {b}) denklemleri çözülünce oğul x = {s}, baba y = {f} bulunur."
    if d == 1:
        return dict(uz="uzun", prm=dict(prm, tip=1), q=giris + " Buna göre oğlun bugünkü yaşı kaçtır?", dogru=s,
                    yanlis=[f, s - a, s + b, s + 1, s - 1, f - s], x=ortak)
    if d == 2:
        return dict(uz="uzun", prm=dict(prm, tip=2), q=giris + " Buna göre babanın bugünkü yaşı kaçtır?", dogru=f,
                    yanlis=[s, f - s, f + 1, f - 1, f + b, f - a], x=ortak)
    return dict(uz="uzun", prm=dict(prm, tip=3), q=giris + " Buna göre baba ile oğlunun bugünkü yaşları toplamı kaçtır?", dogru=f + s,
                yanlis=[f, s, f - s, f + s + 1, f + s - 1, f + s + a], x=ortak + f" Toplam {s + f} olur.")


# 5 · KISA · yaş ortalaması
@kalip("yas-ortalama", D, K)
def yas_ortalama(r, d):
    for _ in range(300):
        n = r.randint(4, 8)
        M2 = r.randint(12, 30)
        y = r.randint(10, 60)
        z = r.randint(10, 60)
        if d == 1:
            if ((n - 1) * M2 + y) % n == 0:
                M = ((n - 1) * M2 + y) // n
                return dict(uz="kisa", prm=dict(tip=1, n=n, M=M, M2=M2), q=f"{n} kişilik bir grubun yaş ortalaması {M}'dir. Bu gruptan bir kişi ayrılınca ortalama {M2} oluyor. Ayrılan kişi kaç yaşındadır?",
                            dogru=y, yanlis=[M - M2, n * M, y + n, y - n, y + 1, y - 1],
                            x=f"Toplam yaş {n}·{M} = {n * M}, ayrıldıktan sonra {n - 1}·{M2} = {(n - 1) * M2} olur. Fark {y} yaş, ayrılan kişinin yaşıdır.")
        elif d == 2:
            M = r.randint(12, 30)
            y2 = (n + 1) * M2 - n * M
            if 5 <= y2 <= 70 and M2 != M:
                return dict(uz="kisa", prm=dict(tip=2, n=n, M=M, M2=M2), q=f"{n} kişilik bir grubun yaş ortalaması {M}'dir. Gruba yeni bir kişi katılınca ortalama {M2} oluyor. Gruba katılan kişi kaç yaşındadır?",
                            dogru=y2, yanlis=[abs(M2 - M), (n + 1) * M2, n * M, y2 + n, y2 - n, y2 + 1, y2 - 1],
                            x=f"Yeni toplam {n + 1}·{M2} = {(n + 1) * M2}, eski toplam {n}·{M} = {n * M} olur. Fark {y2} yaş, katılan kişinin yaşıdır.")
        else:
            M = r.randint(15, 30)
            top = n * M - (n - 2) * M2
            a = top - z
            if 20 <= top <= 120 and 5 <= a <= 80 and a != z:
                return dict(uz="kisa", prm=dict(tip=3, n=n, M=M, M2=M2, z=z), q=f"{n} kişilik bir grubun yaş ortalaması {M}'dir. Gruptan {z} yaşındaki bir kişi ile yaşı bilinmeyen başka bir kişi ayrılınca ortalama {M2} oluyor. Diğer ayrılan kişi kaç yaşındadır?",
                            dogru=a, yanlis=[top, a + z, a - 1, a + 1, a + n, a - n],
                            x=f"İlk toplam {n}·{M} = {n * M}, son toplam {n - 2}·{M2} = {(n - 2) * M2} olur. Ayrılanların toplamı {top}, diğer kişi {top} − {z} = {a} yaşındadır.")
    return None


# 6 · KISA · sabit yaş farkı
@kalip("yas-fark", D, K)
def yas_fark(r, d):
    dif = r.randint(3, 14)
    y = r.randint(8, 25)
    o = y + dif
    n = r.randint(1, y - 1)
    P = o + y - 2 * n
    if d == 1:
        return dict(uz="kisa", prm=dict(tip=1, dif=dif, n=n, P=P), q=f"İki kardeşin yaşları arasındaki fark {dif}'tür. {n} yıl önce yaşları toplamı {P} olduğuna göre büyük kardeş şimdi kaç yaşındadır?",
                    dogru=o, yanlis=[y, o - n, o + n, o + 1, o - 1, P - y],
                    x=f"{n} yıl önce toplam {P} idi, şimdi {P} + 2·{n} = {P + 2 * n} olur. Fark {dif} olduğundan büyük kardeş ({P + 2 * n} + {dif})/2 = {o} yaşındadır.")
    m = r.randint(2, 9)
    if d == 2:
        return dict(uz="kisa", prm=dict(tip=2, dif=dif, n=n, P=P, m=m), q=f"İki kardeşin yaşları arasındaki fark {dif}'tür. {n} yıl önce yaşları toplamı {P} olduğuna göre {m} yıl sonra yaşları toplamı kaç olur?", dogru=o + y + 2 * m,
                    yanlis=[o + y, o + y + m, P + 2 * m, P + 2 * n + m, o + y + 2 * m + dif, P + 4 * m],
                    x=f"Şimdiki toplam {P} + 2·{n} = {o + y} olur. {m} yıl sonra her biri {m} yaş büyüyeceği için toplam {o + y} + 2·{m} = {o + y + 2 * m} olur.")
    return dict(uz="kisa", prm=dict(tip=3, dif=dif, n=n, P=P), q=f"İki kardeşin yaşları arasındaki fark {dif}'tür. {n} yıl önce yaşları toplamı {P} olduğuna göre bugünkü yaşlarının çarpımı kaçtır?", dogru=o * y,
                yanlis=[(o - n) * (y - n), o * (y - n), (o + n) * (y + n), o * y + dif, o * y - dif, (o + 1) * y],
                x=f"Şimdiki toplam {P} + 2·{n} = {o + y}, fark {dif} olduğundan yaşlar {o} ve {y} bulunur. Çarpımları {o * y}'dir.")
