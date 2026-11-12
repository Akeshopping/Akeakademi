// AKE Akademi · korumalı soru sistemi bayrakları (yalnız sunucu ortam değişkeninden okunur; sorgu/çerez/başlık/localStorage ile açılamaz)
//   AKE_SORU_V2=1            korumalı soru API'si (oturum, cevap, bitir, katalog, özet) açık
//   AKE_SORU_ESKI_KAPAT=1    (yalnız V2 de açıkken etkili) eski herkese açık yollar kapanır: /api/sorular boş liste, /sorular/* 404
export const bayrakAcik = env => !!env && String(env.AKE_SORU_V2 == null ? "" : env.AKE_SORU_V2).trim() === "1";
export const eskiKapali = env => bayrakAcik(env) && String(env.AKE_SORU_ESKI_KAPAT == null ? "" : env.AKE_SORU_ESKI_KAPAT).trim() === "1";
