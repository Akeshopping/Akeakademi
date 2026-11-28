import 'package:flutter/material.dart';

import '../durum/uygulama.dart';
import 'acilis.dart';
import 'giris.dart';
import 'ortak.dart';
import 'kabuk.dart';
import 'tema.dart';

/// Oturum durumuna göre kök ekranı seçer: yükleniyor, ağ yok, giriş, oturum süresi doldu, ana ekran.
class AkeUygulamasi extends StatefulWidget {
  final UygulamaModeli model;
  const AkeUygulamasi({super.key, required this.model});
  @override
  State<AkeUygulamasi> createState() => _AkeUygulamasiState();
}

class _AkeUygulamasiState extends State<AkeUygulamasi> {
  final GlobalKey<NavigatorState> _gezgin = GlobalKey<NavigatorState>();
  UygulamaModeli get model => widget.model;

  @override
  void initState() {
    super.initState();
    model.addListener(_faziIzle);
  }

  @override
  void dispose() {
    model.removeListener(_faziIzle);
    super.dispose();
  }

  /// Oturum bitince (ya da çıkışta) açık soru/ders ekranları kapanır; kullanıcı doğrudan giriş ekranına düşer.
  void _faziIzle() {
    if (model.faz != Faz.ana) _gezgin.currentState?.popUntil((r) => r.isFirst);
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: model,
      builder: (context, _) => MaterialApp(
        navigatorKey: _gezgin,
        title: 'AKE Akademi',
        debugShowCheckedModeBanner: false,
        theme: akeTema(koyu: false),
        darkTheme: akeTema(koyu: true),
        themeMode: model.tema,
        // Her yeni çalıştırmada bir kez oynayan giriş animasyonu uygulamanın ÜSTÜNDE durur; altta uygulama aynı anda yüklenir.
        builder: (context, child) => Stack(children: [
          Positioned.fill(child: child ?? const SizedBox.shrink()),
          if (model.acilisOynat) Positioned.fill(child: AcilisKatmani(bitti: model.acilisBitti)),
        ]),
        home: Builder(builder: (context) {
          switch (model.faz) {
            case Faz.yukleniyor:
              return const Scaffold(body: Yukleniyor(metin: 'AKE Akademi açılıyor…'));
            case Faz.ag:
              return Scaffold(
                body: DurumKutusu(
                  simge: Icons.wifi_off,
                  baslik: 'Bağlantı yok',
                  aciklama: 'AKE sunucusuna ulaşılamadı. İnternet bağlantını kontrol edip tekrar dene. Hesabın ve ilerlemen güvende.',
                  dugme: 'Tekrar dene',
                  basinca: model.baslat,
                ),
              );
            case Faz.giris:
              return AcilisEkrani(key: const ValueKey('giris'), model: model);
            case Faz.oturumBitti:
              return AcilisEkrani(key: const ValueKey('oturumBitti'), model: model, oturumBitti: true);
            case Faz.ana:
              return AnaEkran(key: ValueKey('ana-${model.kullanici?.id}'), model: model);
          }
        }),
      ),
    );
  }
}
