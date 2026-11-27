import random
import unittest

import cekirdek as C
import yks  # kalıp + denetçi modüllerini yükler


class Testler(unittest.TestCase):
    def test_her_kalibin_denetcisi_var(self):
        self.assertEqual(set(C.KALIPLAR), set(C.DENETCILER))

    def test_ornekler_gecer_ve_tek_dogru_var(self):
        for k in C.KALIPLAR.values():
            for d in (1, 2, 3):
                r = random.Random(7)
                gecen = 0
                for _ in range(300):
                    u = C.kur(k, d, r)
                    if not u:
                        continue
                    ok, sebep, _ = yks.denetle(u)
                    self.assertTrue(ok, f"{k.id} d{d}: {sebep} | {u['soru']['q']}")
                    gecen += 1
                self.assertGreater(gecen, 5, f"{k.id} d{d} neredeyse hiç soru üretmiyor")

    def test_yanlis_cevap_yakalanir(self):
        for k in C.KALIPLAR.values():
            r = random.Random(3)
            for _ in range(200):
                u = C.kur(k, 2, r)
                if u:
                    u["soru"]["a"] = (u["soru"]["a"] + 1) % 5
                    self.assertFalse(yks.denetle(u)[0], k.id)
                    break

    def test_tohum_ayni_cikti(self):
        k = next(iter(C.KALIPLAR.values()))
        a = C.kur(k, 1, random.Random(5))
        b = C.kur(k, 1, random.Random(5))
        self.assertEqual(a, b)

    def test_uretim_hedefi_uretim_zorluguna_gore(self):
        # Regresyon: hedef ölçülen zorluğa göre sayılınca orta (d=2) soru hiç üretilmiyordu.
        grup = [k for k in C.KALIPLAR.values() if k.konu == "Yaş Problemleri"]
        onayli, _, rapor = yks.uret_konu("Yaş Problemleri", grup, 600, 1)
        sayim = {d: sum(1 for q in onayli if q["dUret"] == d) for d in (1, 2, 3)}
        self.assertGreater(sayim[1], 50)
        self.assertGreater(sayim[2], 100)
        self.assertGreater(sayim[3], 50)


if __name__ == "__main__":
    unittest.main()


class TestKaliteDenetimi(unittest.TestCase):
    """Kullanıcının bildirdiği üç soru türü ve yeni üretim kuralları."""

    def test_sayi_eki(self):
        for g, b in [("3'ya", "3'e"), ("6'dir", "6'dır"), ("10'dir", "10'dur"), ("12'tür", "12'dir"), ("5'ya", "5'e"), ("9'e", "9'a"), ("20'de", "20'de")]:
            self.assertEqual(C.ek_duzelt(g), b)

    def test_yas_gerceklik_denetimi(self):
        import denetim as D
        anne6 = {"q": "Bir ailede anne, baba ve bir çocuk vardır. Annenin yaşı çocuğun yaşının 2 katıdır. Baba, anneden 7 yaş büyüktür. Üç kişinin yaşları toplamı 37 olduğuna göre çocuk kaç yaşındadır?", "x": "", "o": ["1", "2", "3", "4", "5"], "a": 0}
        self.assertTrue(any(b["tur"] == "gerceklik" for b in D.gerceklik(anne6)))      # anne 12, çocuk 6

    def test_islem_anlatimi_isarete_uygun(self):
        import denetim as D
        q = {"q": "3x − 5 < 13 eşitsizliğini sağlayan kaç tane pozitif tam sayı vardır?", "x": "Her iki yandan 5 çıkarılınca 3x < 8 olur.", "o": ["1", "2", "3", "4", "5"], "a": 1}
        self.assertTrue(any("çıkarılır" in b["ne"] for b in D.cozum_islemleri(q)))     # −5 için 'çıkarılır' yanlış
        q["x"] = "Her iki yana 5 eklenince 3x < 18 olur."
        self.assertEqual(D.cozum_islemleri(q), [])

    def test_uretilen_sorularda_bulgu_yok(self):
        import random
        import denetim as D
        for kid in ("tyt-mat-basit-esitsizlik", "yas-kat-toplam", "yas-aile-uzun", "yas-oran", "yas-gecmis-gelecek", "tyt-mat-yas"):
            r = random.Random(7)
            for d in (1, 2, 3):
                for _ in range(150):
                    u = C.kur(C.KALIPLAR[kid], d, r)
                    if u:
                        q = {"id": "x", **u["soru"]} if "soru" in u else u
                        bul = [b for b in D.gerceklik(q) + D.cozum_islemleri(q) + D.metin(q)]
                        self.assertEqual(bul, [], (kid, q["q"], bul))
