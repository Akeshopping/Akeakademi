import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../durum/odak.dart';
import '../durum/uygulama.dart';
import 'tema.dart';

String _dkSn(int sn) {
  final s = sn < 0 ? 0 : sn;
  return '${(s ~/ 60).toString().padLeft(2, '0')}:${(s % 60).toString().padLeft(2, '0')}';
}

/// Plan sayfasındaki Odak odası (sitedeki Odak odası): Odak 25 dk / Mola 5 dk, Başlat / Duraklat / Devam et / Sıfırla.
/// Sayaç [UygulamaModeli.odak] içinde yaşar (sekme değişse de sürer); süre duvar saatinden hesaplanır, uygulama öne gelince yeniden okunur.
class OdakKarti extends StatefulWidget {
  final UygulamaModeli model;
  final int hesapBugunDk; // hesaptaki bugünkü odak dakikası (sunucudan)
  const OdakKarti({super.key, required this.model, required this.hesapBugunDk});
  @override
  State<OdakKarti> createState() => _OdakKartiState();
}

class _OdakKartiState extends State<OdakKarti> with WidgetsBindingObserver {
  Timer? _zaman;
  OdakSayaci? _bagli;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _baglan();
  }

  void _baglan() {
    final s = widget.model.odak;
    if (identical(s, _bagli)) return;
    _bagli?.removeListener(_degisti);
    _bagli = s;
    s?.addListener(_degisti);
    _zamanla();
  }

  @override
  void didUpdateWidget(covariant OdakKarti eski) {
    super.didUpdateWidget(eski);
    _baglan();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _bagli?.removeListener(_degisti);
    _zaman?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState durum) {
    if (durum == AppLifecycleState.resumed) {
      _bagli?.guncelle(); // arka planda süre dolmuş olabilir
      _bagli?.bekleyenleriGonder();
      if (mounted) setState(() {});
      _zamanla();
    }
  }

  void _degisti() {
    if (!mounted) return;
    setState(() {});
    _zamanla();
    final olay = _bagli?.olayTuket();
    if (olay != null) {
      HapticFeedback.heavyImpact();
      ScaffoldMessenger.maybeOf(context)?.showSnackBar(SnackBar(content: Text(olay == 'odak' ? '25 dakikalık odak turu bitti. Şimdi 5 dakika mola.' : 'Mola bitti. Hazırsan yeni odak turunu başlat.')));
    }
  }

  void _zamanla() {
    final calisiyor = _bagli?.calisiyor == true;
    if (calisiyor && _zaman == null) {
      _zaman = Timer.periodic(const Duration(seconds: 1), (_) {
        _bagli?.guncelle();
        if (mounted) setState(() {});
      });
    } else if (!calisiyor && _zaman != null) {
      _zaman!.cancel();
      _zaman = null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    final s = widget.model.odak;
    if (s == null) return const SizedBox.shrink();
    final calisiyor = s.calisiyor;
    final bugun = s.bugunOdakDk(widget.hesapBugunDk);
    Widget mod(String k, String ad) => Semantics(
          button: true,
          selected: s.mod == k,
          label: ad,
          child: ExcludeSemantics(
            child: AkeDokun(
              basinca: calisiyor ? null : () => s.modSec(k),
              child: Container(
                key: ValueKey('odak-mod-$k'),
                constraints: const BoxConstraints(minHeight: 44, minWidth: 96),
                padding: const EdgeInsets.symmetric(horizontal: 16),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: s.mod == k ? t.murekkep : Colors.transparent,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: s.mod == k ? t.murekkep : t.cizgi),
                ),
                child: Text(ad, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: s.mod == k ? t.kart : (calisiyor ? t.murekkep3 : t.murekkep2))),
              ),
            ),
          ),
        );
    return KartKutu(
      key: const ValueKey('odak-odasi'),
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 16),
      child: Column(children: [
        const Align(alignment: Alignment.centerLeft, child: Text('Odak odası', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w700))),
        const SizedBox(height: 12),
        Wrap(spacing: 8, runSpacing: 8, alignment: WrapAlignment.center, children: [mod('odak', 'Odak 25 dk'), mod('mola', 'Mola 5 dk')]),
        const SizedBox(height: 10),
        Semantics(
          label: s.mod == 'odak' ? 'Odak sayacı' : 'Mola sayacı',
          child: Text(_dkSn(s.kalanSn), key: const ValueKey('odak-saat'), style: rakamStili(s.mod == 'mola' ? t.dogru : t.murekkep, 56, agirlik: FontWeight.w700)),
        ),
        const SizedBox(height: 10),
        LayoutBuilder(builder: (context, c) {
          final ana = calisiyor
              ? AkeDugme('Duraklat', key: const ValueKey('odak-duraklat'), tur: DugmeTuru.cizgili, basinca: s.duraklat)
              : AkeDugme(s.kismenKullanildi ? 'Devam et' : 'Başlat', key: const ValueKey('odak-basla'), basinca: s.basla);
          final sifir = AkeDugme('Sıfırla', key: const ValueKey('odak-sifirla'), tur: DugmeTuru.cizgili, basinca: s.sifirla);
          if (c.maxWidth < 300) return Column(children: [ana, const SizedBox(height: 8), sifir]);
          return Row(children: [Expanded(child: ana), const SizedBox(width: 10), Expanded(child: sifir)]);
        }),
        const SizedBox(height: 12),
        Text('Bugün odaklı çalışma: $bugun dk. Telefonu bırak, 25 dakika tek bir işe odaklan; sayaç bitince mola zamanı.', key: const ValueKey('odak-bugun'), textAlign: TextAlign.center, style: TextStyle(color: t.murekkep2, fontSize: 13, height: 1.4)),
        if (s.bekleyen.isNotEmpty) ...[
          const SizedBox(height: 6),
          Text('${s.bekleyen.length} tur hesabına yazılmayı bekliyor; bağlantı gelince otomatik yazılır.', key: const ValueKey('odak-bekleyen'), textAlign: TextAlign.center, style: TextStyle(color: t.uyari, fontSize: 12.5, height: 1.35)),
        ],
        const SizedBox(height: 6),
        Text('Süre gerçek saate göre sayılır: uygulamayı arka plana alsan da kalan süre doğru görünür. Süre dolunca bildirim gelmez; uygulamayı açınca tur tamamlanmış olur.', textAlign: TextAlign.center, style: TextStyle(color: t.murekkep3, fontSize: 12, height: 1.4)),
      ]),
    );
  }
}
