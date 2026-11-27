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


if __name__ == "__main__":
    unittest.main()
