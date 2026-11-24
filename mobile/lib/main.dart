import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import 'durum/uygulama.dart';
import 'ui/kok.dart';
import 'veri/api.dart';
import 'veri/ilerleme.dart';
import 'veri/oturum_deposu.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final api = AkeApi(istemci: http.Client(), depo: GuvenliDepo());
  final model = UygulamaModeli(api, IlerlemeSenkron(api));
  model.baslat();
  runApp(AkeUygulamasi(model: model));
}
