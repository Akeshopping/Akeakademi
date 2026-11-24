import 'package:flutter/material.dart';

import '../veri/api.dart';
import 'tema.dart';

/// Yükleniyor / boş / hata durumları için ortak parçalar.
class Yukleniyor extends StatelessWidget {
  final String metin;
  const Yukleniyor({super.key, this.metin = 'Yükleniyor…'});
  @override
  Widget build(BuildContext context) => Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const CircularProgressIndicator(color: AkeRenk.mercan),
          const SizedBox(height: 16),
          Text(metin, style: const TextStyle(color: AkeRenk.murekkep2)),
        ]),
      );
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
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(simge, size: 48, color: AkeRenk.mercan),
            const SizedBox(height: 16),
            Text(baslik, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            Text(aciklama, textAlign: TextAlign.center, style: const TextStyle(color: AkeRenk.murekkep2, height: 1.4)),
            if (dugme != null) ...[
              const SizedBox(height: 24),
              FilledButton(onPressed: basinca, child: Text(dugme!)),
            ],
            if (ikinciDugme != null) ...[
              const SizedBox(height: 12),
              OutlinedButton(onPressed: ikinciBasinca, child: Text(ikinciDugme!)),
            ],
          ]),
        ),
      );
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
