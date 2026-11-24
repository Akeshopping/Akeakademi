import 'package:flutter/material.dart';

import '../durum/uygulama.dart';
import 'ortak.dart';
import 'tema.dart';

/// Açılış + ücretsiz giriş. Giriş e-postaya gelen 8 haneli kodla yapılır (mevcut AKE hesabı; şifre yok).
class AcilisEkrani extends StatefulWidget {
  final UygulamaModeli model;
  final bool oturumBitti;
  const AcilisEkrani({super.key, required this.model, this.oturumBitti = false});
  @override
  State<AcilisEkrani> createState() => _AcilisEkraniState();
}

class _AcilisEkraniState extends State<AcilisEkrani> {
  final _eposta = TextEditingController();
  final _kod = TextEditingController();
  bool _giris = false; // false: karşılama, true: form
  bool _kodGitti = false;
  bool _mesgul = false;
  String? _hata;

  @override
  void initState() {
    super.initState();
    _giris = widget.oturumBitti;
  }

  @override
  void dispose() {
    _eposta.dispose();
    _kod.dispose();
    super.dispose();
  }

  Future<void> _kodIste() async {
    final e = _eposta.text.trim();
    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$').hasMatch(e)) {
      setState(() => _hata = 'E-posta adresi geçerli görünmüyor.');
      return;
    }
    setState(() {
      _mesgul = true;
      _hata = null;
    });
    try {
      await widget.model.kodIste(e);
      if (mounted) setState(() => _kodGitti = true);
    } catch (err) {
      if (mounted) setState(() => _hata = hataMetni(err));
    } finally {
      if (mounted) setState(() => _mesgul = false);
    }
  }

  Future<void> _dogrula() async {
    final kod = _kod.text.replaceAll(RegExp(r'\D'), '');
    if (kod.length != 8) {
      setState(() => _hata = 'Kod 8 haneli.');
      return;
    }
    setState(() {
      _mesgul = true;
      _hata = null;
    });
    try {
      await widget.model.kodDogrula(_eposta.text, kod);
    } catch (err) {
      if (mounted) setState(() => _hata = hataMetni(err));
    } finally {
      if (mounted) setState(() => _mesgul = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Semantics(
                  label: 'AKE Akademi amblemi',
                  child: Center(child: ClipRRect(borderRadius: BorderRadius.circular(22), child: Image.asset('assets/ake_logo.png', width: 96, height: 96))),
                ),
                const SizedBox(height: 20),
                Text('AKE Akademi', textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w800)),
                const SizedBox(height: 8),
                const Text('YKS için soru çöz, hatanı gör, ilerlemeni hesabında tut.',
                    textAlign: TextAlign.center, style: TextStyle(color: AkeRenk.murekkep2, height: 1.4)),
                const SizedBox(height: 28),
                if (widget.oturumBitti)
                  const Padding(
                    padding: EdgeInsets.only(bottom: 16),
                    child: KartKutu(
                      renk: AkeRenk.uyariZemin,
                      kenar: AkeRenk.uyari,
                      child: Text('Oturumunun süresi doldu. İlerlemen hesabında duruyor; yeniden giriş yapman yeterli.',
                          style: TextStyle(color: AkeRenk.uyari)),
                    ),
                  ),
                if (!_giris) ...[
                  FilledButton(onPressed: () => setState(() => _giris = true), child: const Text('Ücretsiz başla')),
                  const SizedBox(height: 12),
                  const Text('Giriş ücretsizdir. Mevcut AKE hesabınla devam edersin; hesabın yoksa e-postanla otomatik açılır.',
                      textAlign: TextAlign.center, style: TextStyle(color: AkeRenk.murekkep2, fontSize: 13, height: 1.4)),
                ] else if (!_kodGitti) ...[
                  TextField(
                    controller: _eposta,
                    keyboardType: TextInputType.emailAddress,
                    autofillHints: const [AutofillHints.email],
                    textInputAction: TextInputAction.done,
                    decoration: const InputDecoration(labelText: 'E-posta adresin'),
                    onSubmitted: (_) => _kodIste(),
                  ),
                  if (_hata != null) _HataSatiri(_hata!),
                  const SizedBox(height: 16),
                  FilledButton(onPressed: _mesgul ? null : _kodIste, child: Text(_mesgul ? 'Gönderiliyor…' : 'Giriş kodu gönder')),
                ] else ...[
                  Text('Kodu ${_eposta.text.trim()} adresine gönderdik. 10 dakika geçerli.', style: const TextStyle(color: AkeRenk.murekkep2, height: 1.4)),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _kod,
                    keyboardType: TextInputType.number,
                    maxLength: 8,
                    autofillHints: const [AutofillHints.oneTimeCode],
                    decoration: const InputDecoration(labelText: '8 haneli kod', counterText: ''),
                    onSubmitted: (_) => _dogrula(),
                  ),
                  if (_hata != null) _HataSatiri(_hata!),
                  const SizedBox(height: 16),
                  FilledButton(onPressed: _mesgul ? null : _dogrula, child: Text(_mesgul ? 'Doğrulanıyor…' : 'Giriş yap')),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: _mesgul ? null : () => setState(() {
                      _kodGitti = false;
                      _kod.clear();
                      _hata = null;
                    }),
                    child: const Text('Başka e-posta / yeni kod'),
                  ),
                ],
              ]),
            ),
          ),
        ),
      ),
    );
  }
}

class _HataSatiri extends StatelessWidget {
  final String metin;
  const _HataSatiri(this.metin);
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 10),
        child: Semantics(liveRegion: true, child: Text(metin, style: const TextStyle(color: AkeRenk.yanlis, fontWeight: FontWeight.w600))),
      );
}
