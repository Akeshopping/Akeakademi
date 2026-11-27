import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import 'durum/uygulama.dart';
import 'odeme/magaza_koprusu.dart';
import 'ui/kok.dart';
import 'veri/api.dart';
import 'veri/ilerleme.dart';
import 'veri/oturum_deposu.dart';
import 'yapilandirma.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final String adres;
  try {
    adres = Yapilandirma.api();
  } on YapilandirmaHatasi catch (h) {
    runApp(YapilandirmaHataEkrani(mesaj: h.mesaj));
    return;
  }
  final api = AkeApi(taban: adres, istemci: http.Client(), depo: GuvenliDepo());
  final model = UygulamaModeli(api, IlerlemeSenkron(api), ayar: GuvenliAyar())..magaza = GercekMagazaKoprusu();
  model.baslat();
  runApp(AkeUygulamasi(model: model));
}

/// Yanlış/eksik sunucu adresiyle derlenmiş uygulama ağa HİÇ çıkmaz; bu ekranı gösterir.
class YapilandirmaHataEkrani extends StatelessWidget {
  final String mesaj;
  const YapilandirmaHataEkrani({super.key, required this.mesaj});

  @override
  Widget build(BuildContext context) => MaterialApp(
        home: Scaffold(
          body: SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Center(
                child: Text('Yapılandırma hatası\n\n$mesaj', textAlign: TextAlign.center),
              ),
            ),
          ),
        ),
      );
}
