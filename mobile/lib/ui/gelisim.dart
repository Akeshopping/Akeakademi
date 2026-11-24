import 'package:flutter/material.dart';

import '../durum/uygulama.dart';
import '../veri/hesap_verisi.dart';
import '../veri/katalog.dart';
import 'ortak.dart';
import 'tema.dart';

/// Gelişim: hesaptaki gerçek çözüm verisi (sunucudan okunur). Veri yoksa uydurma grafik çizilmez.
class GelisimSekmesi extends StatefulWidget {
  final UygulamaModeli model;
  const GelisimSekmesi({super.key, required this.model});
  @override
  State<GelisimSekmesi> createState() => _GelisimSekmesiState();
}

class _GelisimSekmesiState extends State<GelisimSekmesi> {
  late Future<HesapVerisi> _f;

  @override
  void initState() {
    super.initState();
    _f = widget.model.hesapVerisi();
    widget.model.addListener(_sekmeDegisti);
  }

  @override
  void dispose() {
    widget.model.removeListener(_sekmeDegisti);
    super.dispose();
  }

  int _sonSekme = -1;
  void _sekmeDegisti() {
    // Gelişim sekmesine her dönüşte taze veri (yeni çözülen sorular görünsün).
    final s = widget.model.sekme;
    if (s == 2 && _sonSekme != 2 && mounted) setState(() => _f = widget.model.hesapVerisi());
    _sonSekme = s;
  }

  Future<void> _yenile() async {
    final y = widget.model.hesapVerisi();
    setState(() => _f = y);
    try {
      await y;
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    return RefreshIndicator(
      color: t.mercan,
      backgroundColor: t.kart,
      onRefresh: _yenile,
      child: FutureBuilder<HesapVerisi>(
        future: _f,
        builder: (context, s) {
          if (s.connectionState != ConnectionState.done) return const Yukleniyor(metin: 'İlerlemen getiriliyor…');
          if (s.hasError) {
            return DurumKutusu(simge: Icons.cloud_off, baslik: 'İlerleme getirilemedi', aciklama: hataMetni(s.error!), dugme: 'Tekrar dene', basinca: _yenile);
          }
          final v = s.data!;
          if (v.konular.every((k) => k.cozulen == 0)) {
            return const DurumKutusu(simge: Icons.insights_outlined, baslik: 'Henüz ilerleme yok', aciklama: 'Bir konudan soru çözdüğünde ilerlemen burada görünür.');
          }
          final simdi = DateTime.now();
          final bugun = v.bugun(simdi);
          final oran = v.toplamSoru == 0 ? 0 : (v.toplamDogru * 100 / v.toplamSoru).round();
          final liste = v.konular.where((k) => k.cozulen > 0).toList()..sort((a, b) => b.cozulen.compareTo(a.cozulen));
          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
            children: [
              const Text('Gelişimim', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, height: 1.15)),
              const SizedBox(height: 14),
              Row(children: [
                Expanded(child: _Sayi(deger: '${v.toplamSoru}', ad: 'çözülen soru')),
                const SizedBox(width: 10),
                Expanded(child: _Sayi(deger: '%$oran', ad: 'doğru oranı')),
                const SizedBox(width: 10),
                Expanded(child: _Sayi(deger: '${bugun.soru}', ad: 'bugün')),
              ]),
              const SizedBox(height: 14),
              _SonGunler(gunler: v.sonGunler(simdi, 7)),
              const SizedBox(height: 14),
              KartKutu(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 6),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Konu başarısı', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 10),
                  for (final k in liste) _KonuSatiri(konu: k),
                ]),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _Sayi extends StatelessWidget {
  final String deger;
  final String ad;
  const _Sayi({required this.deger, required this.ad});
  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    return Semantics(
      label: '$deger $ad',
      child: ExcludeSemantics(
        child: KartKutu(
          padding: const EdgeInsets.fromLTRB(12, 14, 12, 12),
          yaricap: 14,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.centerLeft, child: Text(deger, style: rakamStili(t.murekkep, 26))),
            const SizedBox(height: 4),
            Text(ad, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: t.murekkep2, fontSize: 12)),
          ]),
        ),
      ),
    );
  }
}

class _SonGunler extends StatelessWidget {
  final List<GunSayisi> gunler;
  const _SonGunler({required this.gunler});
  static const _kisa = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    final enCok = gunler.fold<int>(1, (a, g) => g.soru > a ? g.soru : a);
    final toplam = gunler.fold<int>(0, (a, g) => a + g.soru);
    return Semantics(
      label: 'Son 7 günde $toplam soru çözüldü',
      child: KartKutu(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const Expanded(child: Text('Son 7 gün', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700))),
            Text('$toplam soru', style: TextStyle(color: t.murekkep2, fontSize: 13)),
          ]),
          const SizedBox(height: 14),
          SizedBox(
            height: 120,
            child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
              for (final g in gunler)
                Expanded(
                  child: Column(mainAxisAlignment: MainAxisAlignment.end, children: [
                    Text(g.soru == 0 ? '' : '${g.soru}', style: rakamStili(t.murekkep2, 11, agirlik: FontWeight.w500)),
                    const SizedBox(height: 3),
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 360),
                      curve: Curves.easeOutCubic,
                      width: 20,
                      height: g.soru == 0 ? 4 : (8 + 72 * g.soru / enCok),
                      decoration: BoxDecoration(color: g.soru == 0 ? t.cizgi : t.mercanDeko, borderRadius: BorderRadius.circular(6)),
                    ),
                    const SizedBox(height: 6),
                    Text(_kisa[DateTime.parse(g.gun).weekday - 1], style: TextStyle(color: t.murekkep3, fontSize: 11)),
                  ]),
                ),
            ]),
          ),
        ]),
      ),
    );
  }
}

class _KonuSatiri extends StatelessWidget {
  final KonuBasarisi konu;
  const _KonuSatiri({required this.konu});
  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    final r = dersRengi(context, konu.ders);
    final ders = Katalog.dersAdi(konu.ders);
    return Semantics(
      label: '$ders, ${konu.konu}: ${konu.dogru} doğru, ${konu.yanlis} yanlış, yüzde ${konu.yuzde}',
      child: ExcludeSemantics(
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(border: Border(top: BorderSide(color: t.cizgi))),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(width: 4, height: 54, margin: const EdgeInsets.only(right: 12), decoration: BoxDecoration(color: r.metin, borderRadius: BorderRadius.circular(2))),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(konu.konu.isEmpty ? ders : konu.konu, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15.5, height: 1.25)),
                Text(ders, style: TextStyle(color: t.murekkep2, fontSize: 12.5)),
                const SizedBox(height: 8),
                ClipRRect(borderRadius: BorderRadius.circular(4), child: LinearProgressIndicator(value: konu.yuzde / 100, minHeight: 6, color: t.dogru, backgroundColor: t.girinti)),
                const SizedBox(height: 6),
                Text('${konu.dogru} doğru · ${konu.yanlis} yanlış · %${konu.yuzde}', style: TextStyle(color: t.murekkep2, fontSize: 13)),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}
