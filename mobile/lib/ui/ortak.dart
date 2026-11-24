import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../veri/api.dart';
import 'marka.dart';
import 'tema.dart';

/// Yükleniyor / boş / hata durumları için ortak parçalar.
class Yukleniyor extends StatelessWidget {
  final String metin;
  const Yukleniyor({super.key, this.metin = 'Yükleniyor…'});
  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    return Center(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const AmblemKutu(boyut: 44),
        const SizedBox(height: 18),
        SizedBox(width: 120, child: LinearProgressIndicator(minHeight: 3, borderRadius: BorderRadius.circular(3), color: t.mercan, backgroundColor: t.cizgi)),
        const SizedBox(height: 14),
        Text(metin, style: TextStyle(color: t.murekkep2)),
      ]),
    );
  }
}

class DurumKutusu extends StatelessWidget {
  final IconData simge;
  final String baslik;
  final String aciklama;
  final String? dugme;
  final VoidCallback? basinca;
  final String? ikinciDugme;
  final VoidCallback? ikinciBasinca;
  const DurumKutusu({
    super.key,
    required this.simge,
    required this.baslik,
    required this.aciklama,
    this.dugme,
    this.basinca,
    this.ikinciDugme,
    this.ikinciBasinca,
  });
  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(28),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(color: t.mercanYumusak, borderRadius: BorderRadius.circular(20)),
              child: Icon(simge, size: 30, color: t.mercan),
            ),
            const SizedBox(height: 18),
            Text(baslik, textAlign: TextAlign.center, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            Text(aciklama, textAlign: TextAlign.center, style: TextStyle(color: t.murekkep2, height: 1.45)),
            if (dugme != null) ...[
              const SizedBox(height: 24),
              AkeDugme(dugme!, basinca: basinca),
            ],
            if (ikinciDugme != null) ...[
              const SizedBox(height: 12),
              AkeDugme(ikinciDugme!, basinca: ikinciBasinca, tur: DugmeTuru.cizgili),
            ],
          ]),
        ),
      ),
    );
  }
}

/// ApiHata → kullanıcıya anlaşılır Türkçe metin (sunucu ayrıntısı, adres, belirteç gösterilmez).
String hataMetni(Object e) {
  if (e is! ApiHata) return 'Beklenmeyen bir sorun oldu. Biraz sonra tekrar dene.';
  switch (e.tur) {
    case HataTuru.ag:
      return 'İnternet bağlantına ulaşılamadı. Bağlantını kontrol edip tekrar dene.';
    case HataTuru.oturum:
      return 'Oturumun süresi doldu. Yeniden giriş yap.';
    case HataTuru.limit:
      return 'Ücretsiz hakkın bitti.';
    case HataTuru.kapali:
      return 'Soru servisi bu sunucuda henüz açık değil.';
    case HataTuru.cokIstek:
      if (e.kod == 'bekle') return 'Yeni kod için 1 dakika bekle.';
      if (e.kod == 'cok_acik_oturum') return 'Çok fazla açık oturumun var. Önce birini bitir.';
      final sn = e.beklemeSn;
      return sn != null ? 'Çok fazla deneme yapıldı. $sn saniye sonra tekrar dene.' : 'Çok fazla deneme yapıldı. Biraz sonra tekrar dene.';
    case HataTuru.cakisma:
      return e.kod == 'cevap_kilitli' ? 'Bu soru zaten cevaplandı.' : 'İşlem şu an tamamlanamadı. Tekrar dene.';
    case HataTuru.sureDoldu:
      return 'Bu soru oturumunun süresi doldu. Yeni bir oturum başlat.';
    case HataTuru.gecersiz:
      if (e.kod == 'kod_yanlis' || e.kod == 'kod_gecersiz') return 'Kod hatalı ya da süresi dolmuş. Yeni kod iste.';
      if (e.kod == 'eposta_gecersiz') return 'E-posta adresi geçerli görünmüyor.';
      return e.mesaj.isNotEmpty ? e.mesaj : 'İstek kabul edilmedi.';
    case HataTuru.sunucu:
      return 'Sunucuda geçici bir sorun var. Biraz sonra tekrar dene.';
  }
}

/// Alt sayfa iskeleti: koyu mürekkep üst çubuk (geri + başlık + isteğe bağlı sağ alan), gövde, isteğe bağlı alt eylem alanı.
class AkeSayfa extends StatelessWidget {
  final String baslik;
  final Widget govde;
  final Widget? alt;
  final Widget? sag;
  final bool geriGoster;
  final PreferredSizeWidget? altCubuk;
  const AkeSayfa({super.key, required this.baslik, required this.govde, this.alt, this.sag, this.geriGoster = true, this.altCubuk});

  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(statusBarColor: t.ustCubuk, systemNavigationBarColor: alt != null ? t.kart : t.kagit, systemNavigationBarIconBrightness: t.koyu ? Brightness.light : Brightness.dark),
      child: Scaffold(
        backgroundColor: t.kagit,
        body: Column(children: [
          Container(
            color: t.ustCubuk,
            padding: EdgeInsets.only(top: MediaQuery.paddingOf(context).top),
            child: Container(
              height: 58,
              padding: EdgeInsets.only(left: geriGoster ? 4 : 16, right: 8),
              decoration: BoxDecoration(border: Border(bottom: BorderSide(color: Colors.white.withValues(alpha: 0.08)))),
              child: Row(children: [
                if (geriGoster)
                  Semantics(
                    button: true,
                    label: 'Geri',
                    child: AkeDokun(
                      basinca: () => Navigator.of(context).maybePop(),
                      child: const SizedBox(width: 48, height: 48, child: Icon(Icons.arrow_back_rounded, color: AkeTok.porselen)),
                    ),
                  ),
                Expanded(child: Text(baslik, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AkeTok.porselen, fontSize: 17, fontWeight: FontWeight.w700))),
                if (sag != null) sag!,
              ]),
            ),
          ),
          if (altCubuk != null) altCubuk!,
          Expanded(child: govde),
          if (alt != null) alt!,
        ]),
      ),
    );
  }
}
