// Test yardımcısı: yayım artık kayıtlı branş uzmanı kabulü ister. Bu yardımcı, önce (test için SENTETİK bir uzman beyanıyla) kabul kaydeder, sonra gerçek yayimKarari'yı çağırır.
// Kabul kaydı başarısız olursa (ör. kayıt yok, red var) yok sayılır: asıl kapı yayimKarari'dır ve tek başına karar verir.
import { yayimKarari, uzmanKarari } from "../../lib/fabrika.js";
export const TEST_UZMAN = { uzmanAd: "Test Uzmanı", brans: "Test branşı", gerekce: "Test için sentetik uzman kabulü kaydı.", kaydeden: "yonetici@ornek.com" };
export async function uzmanKabulEt(env, ids) { for (const id of [].concat(ids)) await uzmanKarari(env, { soruId: id, karar: "kabul", tarih: new Date().toISOString().slice(0, 10), ...TEST_UZMAN }); }
export async function yayimKarariUzmanli(env, ids, karar, ...r) { if (karar === "yayin") await uzmanKabulEt(env, ids); return yayimKarari(env, ids, karar, ...r); }
