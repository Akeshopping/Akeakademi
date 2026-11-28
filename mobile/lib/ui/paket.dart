import 'package:flutter/material.dart';

import '../durum/uygulama.dart';
import '../odeme/odeme.dart';
import 'ortak.dart';
import 'tema.dart';

/// Paketler: Ücretsiz / Atılım / Premium; aylık ve yıllık abonelik MAĞAZA üzerinden (Google Play Billing, StoreKit).
/// Fiyatlar mağazadan okunur. Web/Shopier ödeme bağlantısı yoktur. Erişim, sunucu mağaza işlemini doğrulayınca açılır.
class PaketSekmesi extends StatefulWidget {
  final UygulamaModeli model;
  const PaketSekmesi({super.key, required this.model});
  @override
  State<PaketSekmesi> createState() => _PaketSekmesiState();
}

class _PaketSekmesiState extends State<PaketSekmesi> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Ekran her açılışında abonelik durumu sunucudan tazelenir (süre bitimi, iade, başka cihazdaki değişiklik görünsün).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) widget.model.odeme?.tazele();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState durum) {
    // Ekran açıkken uygulama arka plandan dönerse tazele (ekran kapalıyken dinleyici yine mağaza olaylarını işler, tazeleme gerekmez).
    if (durum == AppLifecycleState.resumed && mounted) widget.model.odeme?.tazele();
  }

  // Dinleyici hesaba bağlıdır; bu ekran kapanınca satın alma olayı kaybolmaz.
  OdemeModeli get _o => widget.model.odeme!;

  @override
  Widget build(BuildContext context) {
    if (widget.model.odeme == null) {
      // Oturum yoksa ya da mağaza köprüsü verilmemişse dinleyici açılmaz; çökmek yerine açıklama göster.
      return const DurumKutusu(simge: Icons.storefront_rounded, baslik: 'Mağazaya ulaşılamıyor', aciklama: 'Paketleri görmek için hesabına giriş yapmış olmalısın ve bu cihazda Google Play ya da App Store kullanılabilmeli.');
    }
    return ListenableBuilder(
      listenable: _o,
      builder: (context, _) {
        switch (_o.faz) {
          case OdemeFazi.yukleniyor:
            return const Yukleniyor(metin: 'Paketler okunuyor…');
          case OdemeFazi.sunucuKapali:
            return ListView(key: const ValueKey('paket-kapali'), padding: const EdgeInsets.all(24), children: const [
              DurumKutusu(simge: Icons.lock_clock_rounded, baslik: 'Paket satın alma henüz açık değil', aciklama: 'Mağaza satın alma açıldığında fiyatları ve satın alma seçeneklerini burada göreceksin.'),
              SizedBox(height: 16),
              Text('Ücretsiz: günlük soru ve aylık deneme hakkı, çalışma planı ve gelişim.'),
              SizedBox(height: 8),
              Text('Atılım: sınırsız soru ve deneme, her ay belirli sayıda AI öğretmen mesajı.'),
            ]);
          case OdemeFazi.magazaYok:
            return DurumKutusu(simge: Icons.storefront_rounded, baslik: 'Mağazaya ulaşılamıyor', aciklama: 'Bu cihazda Google Play ya da App Store satın alma şu an kullanılamıyor. Mağaza hesabına giriş yaptığından emin olup tekrar dene.', dugme: 'Tekrar dene', basinca: _o.yenile);
          case OdemeFazi.hata:
            return DurumKutusu(simge: Icons.cloud_off_rounded, baslik: 'Paketler okunamadı', aciklama: _o.hataMesaji, dugme: 'Tekrar dene', basinca: _o.yenile);
          case OdemeFazi.hazir:
            return _liste(context);
        }
      },
    );
  }

  Widget _liste(BuildContext context) {
    final t = context.ake;
    final h = _o.hesap;
    final mesgul = _o.mesgul;
    return ListView(
      key: const ValueKey('paket-liste'),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
      children: [
        const Text('Paketler', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, height: 1.15)),
        const SizedBox(height: 6),
        Text(h != null && h.paketli ? 'Şu an ${h.plan == 'premium' ? 'Premium' : 'Atılım'} paketindesin${h.bitis.isEmpty ? '' : ' · ${h.bitis} tarihine kadar'}.' : 'Şu an ücretsiz paketi kullanıyorsun.', key: const ValueKey('paket-durum'), style: TextStyle(color: t.murekkep2, height: 1.4)),
        const SizedBox(height: 14),
        if (_o.eskimis) _bilgi(t, Icons.cloud_off_rounded, '${_o.eskimisMesaji} Gördüğün paket bilgisi eski olabilir.', const ValueKey('paket-eski'), hata: true),
        if (_o.eskimis) Padding(padding: const EdgeInsets.only(bottom: 14), child: AkeDugme('Tekrar dene', key: const ValueKey('paket-tazele'), tur: DugmeTuru.cizgili, basinca: _o.tazele)),
        if (_o.satinAlmaEngelli) _bilgi(t, Icons.lock_outline_rounded,
            _o.dogrulanamayan != null
                ? 'Önceki ödemen henüz doğrulanamadı. Yeni satın alma kapalı; önce "Yeniden dene" ya da "Satın almalarımı geri yükle"yi kullan.'
                : _o.eskimis
                    ? 'Bilgiler güncellenene kadar yeni satın alma kapalı.'
                    : 'Etkin bir mağaza aboneliğin var. Çift ücret oluşmaması için bu sürümde ikinci abonelik başlatılamaz; mevcut aboneliğini mağazadan yönetebilirsin.',
            const ValueKey('paket-engel')),
        if (_o.aktifMagazaAboneligi) _abonelikKutusu(t),
        if (_o.bekliyor) _bilgi(t, Icons.hourglass_top_rounded, 'Ödeme onay bekliyor. Mağaza onaylayana kadar paketin açılmaz; onaylanınca burada görünür.', const ValueKey('paket-bekliyor')),
        if (_o.mesaj.isNotEmpty) _bilgi(t, _o.mesajHata ? Icons.error_outline_rounded : Icons.check_circle_outline_rounded, _o.mesaj, const ValueKey('paket-mesaj'), hata: _o.mesajHata),
        if (_o.dogrulanamayan != null) Padding(padding: const EdgeInsets.only(bottom: 14), child: AkeDugme('Yeniden dene', key: const ValueKey('paket-yeniden'), tur: DugmeTuru.cizgili, basinca: mesgul ? null : _o.yenidenDene)),
        KartKutu(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Ücretsiz', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text(_ucretsizMetni(), style: TextStyle(color: t.murekkep2, height: 1.4)),
          ]),
        ),
        // Premium kartı yalnız sunucu Premium ürünleri listelediyse görünür (ilk satış: yalnız Atılım).
        for (final plan in ['orta', if (_o.paketler.any((p) => p.plan == 'premium')) 'premium']) ...[const SizedBox(height: 14), _planKarti(t, plan, mesgul || _o.satinAlmaEngelli)],
        const SizedBox(height: 14),
        AkeDugme(_o.islemdeUrun == null && !mesgul ? 'Satın almalarımı geri yükle' : 'İşlem sürüyor…', key: const ValueKey('paket-geri-yukle'), tur: DugmeTuru.cizgili, simge: Icons.restore_rounded, basinca: mesgul ? null : _o.geriYukle),
        const SizedBox(height: 14),
        Text('Abonelik mağaza hesabına bağlıdır ve süre bitiminde kendiliğinden yenilenir. İptal etmek için Google Play ya da App Store\'daki abonelikler bölümünü kullan; iptal edersen süre bitene kadar erişimin sürer. Erişim kodların paketle birlikte çalışmaya devam eder; en yüksek paket geçerli olur.', style: TextStyle(color: t.murekkep2, fontSize: 13, height: 1.45)),
        if (_o.islemler.any((i) => i.test)) Padding(padding: const EdgeInsets.only(top: 10), child: Text('Bu hesapta mağaza TEST satın alması var; gerçek ücret alınmaz.', key: const ValueKey('paket-test'), style: TextStyle(color: t.murekkep2, fontSize: 13))),
      ],
    );
  }

  Widget _bilgi(AkeTok t, IconData simge, String metin, Key anahtar, {bool hata = false}) => Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: Container(
          key: anahtar,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: hata ? t.yanlis.withValues(alpha: 0.08) : t.mercanYumusak, borderRadius: BorderRadius.circular(12), border: Border.all(color: t.cizgi)),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(simge, size: 20, color: hata ? t.yanlis : t.mercan),
            const SizedBox(width: 10),
            Expanded(child: Text(metin, style: const TextStyle(height: 1.4))),
          ]),
        ),
      );

  String _ucretsizMetni() {
    final soru = _o.hak('ucretsiz', 'soru'), deneme = _o.hak('ucretsiz', 'deneme');
    if (soru == null || deneme == null) return 'Günlük soru ve aylık deneme hakkı, çalışma planı.';
    return 'Günde $soru soru, ayda $deneme deneme, çalışma planı.';
  }

  /// Etkin mağaza aboneliği: otomatik yenileme/iptal bilgisi ve çalışan "Aboneliğimi yönet" düğmesi.
  Widget _abonelikKutusu(AkeTok t) {
    final i = _o.islemler.firstWhere((x) => x.erisim);
    final iptal = i.durum == 'iptal';
    final tarih = i.bitis.isEmpty ? '' : ' (${i.bitis})';
    final metin = iptal
        ? 'Aboneliğin iptal edilmiş; süre bitimine kadar$tarih erişimin sürer, sonra yenilenmez.'
        : 'Aboneliğin her dönem sonunda kendiliğinden yenilenir$tarih; iptal etmezsen mağaza hesabından ücret alınır. İptal ve ödeme yöntemi mağazanın abonelik sayfasındadır.';
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(metin, key: const ValueKey('paket-abonelik-bilgi'), style: TextStyle(color: t.murekkep2, height: 1.45)),
        const SizedBox(height: 10),
        AkeDugme('Aboneliğimi yönet', key: const ValueKey('paket-yonet'), tur: DugmeTuru.cizgili, simge: Icons.open_in_new_rounded, basinca: _o.abonelikleriYonet),
      ]),
    );
  }

  Widget _planKarti(AkeTok t, String plan, bool mesgul) {
    final satirlar = _o.paketler.where((p) => p.plan == plan).toList();
    final ad = plan == 'premium' ? 'Premium' : 'Atılım';
    final mesaj = _o.hak(plan, 'mesaj'); // rakam sunucunun gerçek ayarıdır; bilinmiyorsa yazılmaz
    final aciklama = mesaj == null ? 'Sınırsız soru ve deneme; AI öğretmen mesaj hakkı.' : 'Sınırsız soru ve deneme; ayda $mesaj AI öğretmen mesajı.';
    return KartKutu(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(ad, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        Text(aciklama, style: TextStyle(color: t.murekkep2, height: 1.4)),
        for (final s in satirlar) ...[
          const SizedBox(height: 10),
          AkeDugme(
            s.urun == null ? '${s.donemAdi} · mağazada hazır değil' : '${s.donemAdi} abonelik · ${s.urun!.fiyat} / ${s.donem == 'yil' ? 'yıl' : 'ay'}',
            key: ValueKey('paket-satin-${s.id}'),
            tur: s.donem == 'yil' ? DugmeTuru.dolu : DugmeTuru.cizgili,
            basinca: s.urun == null || mesgul ? null : () => _o.satinAl(s.id),
          ),
        ],
      ]),
    );
  }
}
