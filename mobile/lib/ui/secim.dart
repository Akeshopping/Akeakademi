import 'package:flutter/material.dart';

import '../durum/uygulama.dart';
import '../veri/api.dart';
import '../veri/ilerleme.dart';
import '../veri/katalog.dart';
import '../veri/modeller.dart';
import 'ilerleme_ekrani.dart';
import 'ortak.dart';
import 'soru.dart';
import 'tema.dart';

/// Ana ekran: Sınav seçimi. Konu/soru sayıları sunucunun /api/soru/ozet yanıtından gelir.
class AnaEkran extends StatefulWidget {
  final UygulamaModeli model;
  const AnaEkran({super.key, required this.model});
  @override
  State<AnaEkran> createState() => _AnaEkranState();
}

class _AnaEkranState extends State<AnaEkran> {
  late Future<Ozet> _ozet;

  @override
  void initState() {
    super.initState();
    _ozet = widget.model.api.ozet();
  }

  void _yenile() => setState(() => _ozet = widget.model.api.ozet());

  @override
  Widget build(BuildContext context) {
    final m = widget.model;
    return Scaffold(
      appBar: AppBar(
        title: const Text('AKE Akademi', style: TextStyle(fontWeight: FontWeight.w800)),
        actions: [
          IconButton(
            tooltip: 'Hesabımdaki ilerleme',
            icon: const Icon(Icons.insights_outlined),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => IlerlemeEkrani(senkron: m.senkron))),
          ),
          PopupMenuButton<String>(
            tooltip: 'Hesap',
            onSelected: (v) {
              if (v == 'cikis') m.cikis();
            },
            itemBuilder: (_) => [
              PopupMenuItem<String>(enabled: false, child: Text(m.kullanici?.eposta ?? '')),
              const PopupMenuItem<String>(value: 'cikis', child: Text('Çıkış yap')),
            ],
          ),
        ],
      ),
      body: FutureBuilder<Ozet>(
        future: _ozet,
        builder: (context, s) {
          if (s.connectionState != ConnectionState.done) return const Yukleniyor(metin: 'Sınavlar hazırlanıyor…');
          if (s.hasError) return _hataGorunumu(s.error!, _yenile);
          final ozet = s.data!;
          if (ozet.toplam == 0) {
            return DurumKutusu(
              simge: Icons.hourglass_empty,
              baslik: 'Henüz soru yok',
              aciklama: 'Soru bankası şu an boş görünüyor. Biraz sonra tekrar dene.',
              dugme: 'Yenile',
              basinca: _yenile,
            );
          }
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              const Padding(
                padding: EdgeInsets.fromLTRB(4, 4, 4, 12),
                child: Text('Hangi sınava çalışıyorsun?', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
              ),
              for (final sinav in Katalog.sinavlar) ...[
                _SinavKarti(
                  sinav: sinav,
                  soruSayisi: sinav.dersler.fold<int>(0, (a, d) => a + ozet.dersToplami(d)),
                  basinca: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => DersEkrani(model: m, sinav: sinav, ozet: ozet))),
                ),
                const SizedBox(height: 12),
              ],
            ],
          );
        },
      ),
    );
  }

  Widget _hataGorunumu(Object e, VoidCallback tekrar) {
    if (e is ApiHata && e.tur == HataTuru.oturum) return const Yukleniyor(metin: 'Oturum kontrol ediliyor…');
    if (e is ApiHata && e.tur == HataTuru.kapali) {
      return DurumKutusu(
        simge: Icons.construction,
        baslik: 'Soru servisi henüz açık değil',
        aciklama: 'Bu sunucuda mobil soru servisi etkin değil. Test sürümünde Preview adresini kullanmalısın.',
        dugme: 'Tekrar dene',
        basinca: tekrar,
      );
    }
    return DurumKutusu(simge: Icons.cloud_off, baslik: 'Yüklenemedi', aciklama: hataMetni(e), dugme: 'Tekrar dene', basinca: tekrar);
  }
}

class _SinavKarti extends StatelessWidget {
  final Sinav sinav;
  final int soruSayisi;
  final VoidCallback basinca;
  const _SinavKarti({required this.sinav, required this.soruSayisi, required this.basinca});
  @override
  Widget build(BuildContext context) {
    final bos = soruSayisi == 0;
    return Semantics(
      button: true,
      label: '${sinav.ad}, ${sinav.aciklama}, $soruSayisi soru',
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: bos ? null : basinca,
        child: KartKutu(
          padding: const EdgeInsets.all(18),
          child: Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(sinav.ad, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Text(sinav.aciklama, style: const TextStyle(color: AkeRenk.murekkep2)),
                const SizedBox(height: 8),
                Text(bos ? 'Bu sınav için henüz soru yok' : '$soruSayisi soru', style: TextStyle(color: bos ? AkeRenk.uyari : AkeRenk.mercan, fontWeight: FontWeight.w600)),
              ]),
            ),
            const Icon(Icons.chevron_right, color: AkeRenk.murekkep2),
          ]),
        ),
      ),
    );
  }
}

/// Ders seçimi (yalnızca o sınavın dersleri; sorusu olmayan ders pasif).
class DersEkrani extends StatelessWidget {
  final UygulamaModeli model;
  final Sinav sinav;
  final Ozet ozet;
  const DersEkrani({super.key, required this.model, required this.sinav, required this.ozet});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(sinav.ad)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          for (final d in sinav.dersler) ...[
            Builder(builder: (context) {
              final n = ozet.dersToplami(d);
              return Semantics(
                button: true,
                label: '${Katalog.dersAdi(d)}, $n soru',
                child: InkWell(
                  borderRadius: BorderRadius.circular(16),
                  onTap: n == 0 ? null : () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => KonuEkrani(model: model, ders: d, ozet: ozet))),
                  child: KartKutu(
                    child: Row(children: [
                      Expanded(child: Text(Katalog.dersAdi(d), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700))),
                      Text(n == 0 ? 'Yakında' : '$n soru', style: TextStyle(color: n == 0 ? AkeRenk.uyari : AkeRenk.murekkep2)),
                      const SizedBox(width: 8),
                      const Icon(Icons.chevron_right, color: AkeRenk.murekkep2),
                    ]),
                  ),
                ),
              );
            }),
            const SizedBox(height: 10),
          ],
        ],
      ),
    );
  }
}

/// Konu seçimi; hesaptaki ilerleme (varsa) her konunun yanında görünür.
class KonuEkrani extends StatefulWidget {
  final UygulamaModeli model;
  final String ders;
  final Ozet ozet;
  const KonuEkrani({super.key, required this.model, required this.ders, required this.ozet});
  @override
  State<KonuEkrani> createState() => _KonuEkraniState();
}

class _KonuEkraniState extends State<KonuEkrani> {
  Map<String, KonuIlerlemesi> _ilerleme = const {};

  @override
  void initState() {
    super.initState();
    widget.model.senkron.hesaptanOku().then((v) {
      if (mounted) setState(() => _ilerleme = v);
    }).catchError((Object _) {
      // ilerleme gösterilemese de konu seçimi çalışır
    });
  }

  void _baslat(String? konu) {
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => SoruEkrani(model: widget.model, ders: widget.ders, konu: konu),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final konular = (widget.ozet.konular[widget.ders] ?? const <String, int>{});
    final adlar = konular.keys.toList()..sort((a, b) => a.compareTo(b));
    return Scaffold(
      appBar: AppBar(title: Text(Katalog.dersAdi(widget.ders))),
      body: adlar.isEmpty
          ? const DurumKutusu(simge: Icons.hourglass_empty, baslik: 'Bu derste konu yok', aciklama: 'Bu ders için henüz soru eklenmemiş.')
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                FilledButton(onPressed: () => _baslat(null), child: const Text('Karışık 10 soru')),
                const SizedBox(height: 16),
                for (final k in adlar) ...[
                  Semantics(
                    button: true,
                    label: '$k, ${konular[k]} soru',
                    child: InkWell(
                      borderRadius: BorderRadius.circular(16),
                      onTap: () => _baslat(k),
                      child: KartKutu(
                        child: Row(children: [
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(k, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                              const SizedBox(height: 4),
                              Text(_altMetin(k, konular[k] ?? 0), style: const TextStyle(color: AkeRenk.murekkep2, fontSize: 13)),
                            ]),
                          ),
                          const Icon(Icons.chevron_right, color: AkeRenk.murekkep2),
                        ]),
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                ],
              ],
            ),
    );
  }

  String _altMetin(String konu, int n) {
    final p = _ilerleme['${widget.ders}|$konu'];
    if (p == null || p.cozulen == 0) return '$n soru';
    final yuzde = (p.dogru * 100 / p.cozulen).round();
    return '$n soru · ${p.cozulen} çözüldü · %$yuzde doğru';
  }
}
