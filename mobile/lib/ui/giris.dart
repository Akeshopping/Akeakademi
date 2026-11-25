import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../durum/uygulama.dart';
import 'marka.dart';
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
    final t = context.ake;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(statusBarColor: Colors.transparent, systemNavigationBarColor: t.kagit, systemNavigationBarIconBrightness: t.koyu ? Brightness.light : Brightness.dark),
      child: Scaffold(
        backgroundColor: t.kagit,
        resizeToAvoidBottomInset: true,
        body: SingleChildScrollView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            _Kahraman(kucuk: _giris),
            Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 440),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 22, 20, 28),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: _form(t)),
                ),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  List<Widget> _form(AkeTok t) {
    return [
      if (widget.oturumBitti)
        Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: KartKutu(
            renk: t.uyariZemin,
            kenar: t.uyari,
            child: Text('Oturumunun süresi doldu. İlerlemen hesabında duruyor; yeniden giriş yapman yeterli.', style: TextStyle(color: t.uyari, height: 1.4)),
          ),
        ),
      if (!_giris) ...[
        AkeDugme('Ücretsiz başla', basinca: () => setState(() => _giris = true), simge: Icons.arrow_forward_rounded),
        const SizedBox(height: 14),
        Text('Giriş ücretsizdir. Mevcut AKE hesabınla devam edersin; hesabın yoksa e-postanla otomatik açılır.', textAlign: TextAlign.center, style: TextStyle(color: t.murekkep2, fontSize: 13, height: 1.45)),
      ] else if (!_kodGitti) ...[
        const Text('E-postanla giriş yap', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        Text('Sana 8 haneli bir giriş kodu göndereceğiz. Şifre yok.', style: TextStyle(color: t.murekkep2, height: 1.4)),
        const SizedBox(height: 16),
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
        AkeDugme(_mesgul ? 'Gönderiliyor…' : 'Giriş kodu gönder', basinca: _mesgul ? null : _kodIste),
      ] else ...[
        const Text('Kodunu gir', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        Text('Kodu ${_eposta.text.trim()} adresine gönderdik. 10 dakika geçerli.', style: TextStyle(color: t.murekkep2, height: 1.4)),
        const SizedBox(height: 16),
        TextField(
          controller: _kod,
          keyboardType: TextInputType.number,
          maxLength: 8,
          autofillHints: const [AutofillHints.oneTimeCode],
          style: rakamStili(t.murekkep, 22, agirlik: FontWeight.w500).copyWith(letterSpacing: 4),
          decoration: const InputDecoration(labelText: '8 haneli kod', counterText: ''),
          onSubmitted: (_) => _dogrula(),
        ),
        if (_hata != null) _HataSatiri(_hata!),
        const SizedBox(height: 16),
        AkeDugme(_mesgul ? 'Doğrulanıyor…' : 'Giriş yap', basinca: _mesgul ? null : _dogrula),
        const SizedBox(height: 6),
        AkeDugme('Başka e-posta / yeni kod', tur: DugmeTuru.metin, basinca: _mesgul
            ? null
            : () => setState(() {
                  _kodGitti = false;
                  _kod.clear();
                  _hata = null;
                })),
      ],
    ];
  }
}

/// Koyu mürekkep karşılama alanı: gerçek K amblemi (mercan gradyan), site adı ve YKS 2027 etiketi. Forma geçince küçülür.
class _Kahraman extends StatelessWidget {
  final bool kucuk;
  const _Kahraman({required this.kucuk});
  @override
  Widget build(BuildContext context) {
    final ust = MediaQuery.paddingOf(context).top;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 260),
      curve: Curves.easeOutCubic,
      padding: EdgeInsets.fromLTRB(24, ust + (kucuk ? 22 : 44), 24, kucuk ? 24 : 40),
      decoration: const BoxDecoration(
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(28)),
        gradient: RadialGradient(center: Alignment(0.7, -1.0), radius: 1.4, colors: [Color(0xFF4A3A44), AkeTok.murekkepSabit], stops: [0, 0.75]),
      ),
      child: Column(children: [
        Semantics(
          label: 'AKE Akademi amblemi',
          child: AnimatedContainer(duration: const Duration(milliseconds: 260), curve: Curves.easeOutCubic, width: kucuk ? 56 : 88, child: AkeAmblem(genislik: kucuk ? 56 : 88)),
        ),
        SizedBox(height: kucuk ? 12 : 20),
        const Text('YKS 2027', style: TextStyle(color: Color(0xFFF27D6D), fontWeight: FontWeight.w700, fontSize: 12, letterSpacing: 3.2)),
        const SizedBox(height: 8),
        Text('AKE Akademi', textAlign: TextAlign.center, style: TextStyle(color: AkeTok.porselen, fontSize: kucuk ? 26 : 34, fontWeight: FontWeight.w700, height: 1.05, letterSpacing: -0.3)),
        if (!kucuk) ...[
          const SizedBox(height: 10),
          const Text('Soru bankası, denemeler ve kişisel çalışma planı.', textAlign: TextAlign.center, style: TextStyle(color: AkeTok.uzerindeKoyu2, fontSize: 15, height: 1.4)),
        ],
      ]),
    );
  }
}

class _HataSatiri extends StatelessWidget {
  final String metin;
  const _HataSatiri(this.metin);
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 10),
        child: Semantics(liveRegion: true, child: Text(metin, style: TextStyle(color: context.ake.yanlis, fontWeight: FontWeight.w600))),
      );
}
