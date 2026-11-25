import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../durum/uygulama.dart';
import '../veri/api.dart';
import '../veri/deneme_plani.dart';
import '../veri/katalog.dart';
import '../veri/modeller.dart';
import '../veri/hesap_verisi.dart';
import 'gelisim.dart' show DenemeGecmisiKarti;
import 'ortak.dart';
import 'tema.dart';

const _harfler = ['A', 'B', 'C', 'D', 'E'];

/// Sitedeki TYT süresi: 120 soru / 165 dk (≈1,375 dk/soru). Süre istemcide sayılır; oturumun gerçek ömrü sunucuda 6 saattir.
int denemeSuresiDk(int adet) => (adet * 165 / 120).ceil();

String sureMetni(int sn) {
  final s = sn < 0 ? 0 : sn;
  final dk = s ~/ 60, kal = s % 60;
  return '${dk.toString().padLeft(2, '0')}:${kal.toString().padLeft(2, '0')}';
}

/// "Deneme" sekmesi: sitedeki Deneme merkezi. Oturum (TYT, AYT Sayısal/EA/Sözel, YDT), uzunluk (tam, yarım, mini, kendi dağılımım),
/// bölüm tablosu ve süre; cevap anahtarı bitene kadar sunucuda kalır. "Serbest" tek ders ya da karışık deneme (20/40/80 soru) içindir.
/// Canlı deneme bu sürümde YOK.
class DenemeSekmesi extends StatefulWidget {
  final UygulamaModeli model;
  const DenemeSekmesi({super.key, required this.model});
  @override
  State<DenemeSekmesi> createState() => _DenemeSekmesiState();
}

const _serbest = 'SERBEST';

class _DenemeSekmesiState extends State<DenemeSekmesi> {
  late Future<(Ozet, HesapDurumu)> _f;
  String _tur = 'TYT'; // oturum; profil alanına göre ilk yüklemede ayarlanır
  bool _turSecildi = false;
  DenemeUzunluk _uzunluk = DenemeUzunluk.tam;
  final Map<String, int> _ozel = {};
  int? _sureDk; // null = otomatik
  String? _ders; // serbest: null = karışık
  int _adet = 20;
  List<DenemeKaydi> _gecmis = const []; // Gelişim ile aynı kaynak (hesaptaki `exams`); okunamazsa liste boş kalır, ekran bozulmaz

  @override
  void initState() {
    super.initState();
    _f = _yukle();
    widget.model.addListener(_modelDegisti);
  }

  @override
  void dispose() {
    widget.model.removeListener(_modelDegisti);
    super.dispose();
  }

  /// Sekme zaten açıkken Ana sayfadan "Mini deneme" kısayolu gelirse ¼ uzunluk hemen seçilir.
  void _modelDegisti() {
    if (widget.model.denemeOnAyar == 'mini' && mounted) {
      widget.model.denemeOnAyar = null;
      setState(() {
        _uzunluk = DenemeUzunluk.mini;
        _sureDk = null;
      });
    }
  }

  Future<(Ozet, HesapDurumu)> _yukle() async {
    final o = await widget.model.api.ozet();
    final h = await widget.model.api.hesapDurumu();
    try {
      final v = await widget.model.hesapVerisi();
      _gecmis = v.denemeler;
      if (!_turSecildi) _tur = DenemeKatalogu.varsayilanTur(v.alan);
    } catch (_) {
      _gecmis = const [];
    }
    if (widget.model.denemeOnAyar == 'mini') {
      _uzunluk = DenemeUzunluk.mini; // Ana sayfa "Mini deneme" kısayolu (site: sıradaki mini deneme = ¼ uzunluk)
      widget.model.denemeOnAyar = null;
    }
    return (o, h);
  }

  void _yenile() {
    setState(() {
      _f = _yukle();
    });
  }

  void _turSec(String k) => setState(() {
        _tur = k;
        _turSecildi = true;
        _sureDk = null;
      });

  /// Seçime göre başlatılacak plan; başlatılamıyorsa null (soru yok).
  DenemePlani? _plan(Ozet ozet, List<DenemeSatiri> etkin, int adetSerbest, int sure) {
    if (_tur == _serbest) return DenemePlani(ders: _ders, adet: adetSerbest, sureDk: denemeSuresiDk(adetSerbest));
    final top = etkin.fold(0, (a, b) => a + b.n);
    if (top == 0) return null;
    return DenemePlani(tur: _tur, uzunluk: _uzunluk, satirlar: etkin, adet: top, sureDk: sure);
  }

  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    return FutureBuilder<(Ozet, HesapDurumu)>(
      future: _f,
      builder: (context, s) {
        if (s.connectionState != ConnectionState.done) return const Yukleniyor(metin: 'Deneme hazırlanıyor…');
        if (s.hasError) return DurumKutusu(simge: Icons.cloud_off, baslik: 'Yüklenemedi', aciklama: hataMetni(s.error!), dugme: 'Tekrar dene', basinca: _yenile);
        final (ozet, hesap) = s.data!;
        final serbest = _tur == _serbest;
        // Serbest mod
        final dersler = Katalog.dersler.keys.where((d) => ozet.dersToplami(d) > 0).toList();
        final secilenToplam = _ders == null ? ozet.toplam : ozet.dersToplami(_ders!);
        final adetler = [20, 40, 80].where((a) => a <= secilenToplam || a == 20).toList();
        final adetS = adetler.contains(_adet) ? _adet : adetler.first;
        // Bölümlü mod: havuzda olmayan sorular istenmez (sunucuya giden sayı = en çok havuz kadar)
        final tur = DenemeKatalogu.tur(_tur == _serbest ? 'TYT' : _tur);
        final satirlar = DenemeKatalogu.satirlar(tur, _uzunluk, _ozel);
        final etkin = [for (final r in satirlar) if (math.min(r.n, ozet.dersToplami(r.ders)) > 0) DenemeSatiri(r.bolum, r.ders, r.tam, math.min(r.n, ozet.dersToplami(r.ders)))];
        final istenen = satirlar.fold(0, (a, b) => a + b.n);
        final toplam = etkin.fold(0, (a, b) => a + b.n);
        final otomatik = DenemeKatalogu.otomatikSure(tur, toplam);
        final sure = _sureDk ?? otomatik;
        final plan = _plan(ozet, etkin, adetS, sure);
        final hakYok = !hesap.paketli && hesap.kalanDeneme != null && hesap.kalanDeneme! < 1;
        final eksik = [for (final r in satirlar) if (r.n > ozet.dersToplami(r.ders)) '${Katalog.dersAdi(r.ders)} (${ozet.dersToplami(r.ders)})'];
        final ozetMetni = serbest ? '$adetS soru · ${denemeSuresiDk(adetS)} dk' : '$toplam soru · ${sure == 0 ? 'süresiz' : '$sure dk'}';
        return Column(children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
              children: [
                const Text('Deneme merkezi', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, height: 1.15)),
                const SizedBox(height: 4),
                Text('Süreyi yönet, dersleri karıştır; sonucunu ders ders incele. Cevaplar bitene kadar açıklanmaz.', style: TextStyle(color: t.murekkep2, height: 1.4)),
                const SizedBox(height: 14),
                KartKutu(
                  renk: hakYok ? t.uyariZemin : null,
                  kenar: hakYok ? t.uyari : null,
                  child: Row(children: [
                    Icon(hesap.paketli ? Icons.verified_rounded : Icons.timer_outlined, color: hakYok ? t.uyari : t.murekkep2),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        hesap.paketli
                            ? 'Paketin aktif: deneme sayısı sınırsız.'
                            : (hesap.kalanDeneme == null ? 'Ücretsiz hesap: bu ay deneme hakkı sunucudan okunamadı.' : (hakYok ? 'Bu ayki ücretsiz deneme hakkın bitti.' : 'Ücretsiz hesap: bu ay ${hesap.kalanDeneme} deneme hakkın var.')),
                        style: TextStyle(color: hakYok ? t.uyari : t.murekkep, height: 1.35),
                      ),
                    ),
                  ]),
                ),
                const SizedBox(height: 12),
                KartKutu(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Text('Oturum', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 10),
                    Wrap(spacing: 8, runSpacing: 8, children: [
                      for (final x in DenemeKatalogu.turler) _Secenek(ad: x.ad, secili: _tur == x.kod, basinca: () => _turSec(x.kod), anahtar: 'deneme-tur-${x.kod}'),
                      _Secenek(ad: 'Serbest', secili: serbest, basinca: () => _turSec(_serbest), anahtar: 'deneme-tur-serbest'),
                    ]),
                    const SizedBox(height: 10),
                    Text(
                      serbest ? 'Tek ders ya da karışık, 20/40/80 soru.' : '${tur.uzun} · resmî oturum ${tur.tamSoru} soru, ${tur.dakika} dakika',
                      key: const ValueKey('deneme-tur-aciklama'),
                      style: TextStyle(color: t.murekkep2, fontSize: 13, height: 1.35),
                    ),
                  ]),
                ),
                const SizedBox(height: 12),
                if (serbest)
                  KartKutu(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const Text('Ders', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 10),
                      Wrap(spacing: 8, runSpacing: 8, children: [
                        _Secenek(ad: 'Karışık', secili: _ders == null, basinca: () => setState(() => _ders = null), anahtar: 'deneme-ders-karisik'),
                        for (final d in dersler) _Secenek(ad: Katalog.dersAdi(d), secili: _ders == d, basinca: () => setState(() => _ders = d), anahtar: 'deneme-ders-$d'),
                      ]),
                      const SizedBox(height: 16),
                      const Text('Soru sayısı', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 10),
                      Wrap(spacing: 8, runSpacing: 8, children: [
                        for (final a in adetler) _Secenek(ad: '$a soru · ${denemeSuresiDk(a)} dk', secili: adetS == a, basinca: () => setState(() => _adet = a), anahtar: 'deneme-adet-$a'),
                      ]),
                    ]),
                  )
                else ...[
                  KartKutu(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const Text('Uzunluk', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 10),
                      Wrap(spacing: 8, runSpacing: 8, children: [
                        for (final u in DenemeUzunluk.values) _Secenek(ad: u.ad, secili: _uzunluk == u, basinca: () => setState(() { _uzunluk = u; _sureDk = null; }), anahtar: 'deneme-uzunluk-${u.kod}'),
                      ]),
                    ]),
                  ),
                  const SizedBox(height: 12),
                  _BolumTablosu(satirlar: satirlar, ozet: ozet, ozel: _uzunluk == DenemeUzunluk.ozel, toplam: istenen, degistir: (r, d) => setState(() { _ozel[r.anahtar] = (r.n + d).clamp(0, r.tam).toInt(); _sureDk = null; })),
                  if (eksik.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text('Havuzda yeterli soru olmayan dersler (en çok o kadar gelir): ${eksik.join(', ')}.', key: const ValueKey('deneme-havuz-uyari'), style: TextStyle(color: t.uyari, fontSize: 12.5, height: 1.4)),
                  ],
                  const SizedBox(height: 12),
                  KartKutu(
                    child: Row(children: [
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          const Text('Süre', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                          const SizedBox(height: 2),
                          Text(_sureDk == null ? 'Otomatik: $otomatik dk' : (sure == 0 ? 'Süresiz çalışma' : 'Kendi süren'), key: const ValueKey('deneme-sure-aciklama'), style: TextStyle(color: t.murekkep2, fontSize: 13)),
                        ]),
                      ),
                      _Adimlayici(
                        anahtar: 'deneme-sure',
                        metin: sure == 0 ? '∞' : '$sure',
                        azalt: sure <= 0 ? null : () => setState(() => _sureDk = math.max(0, sure - 5)),
                        arttir: sure >= 300 ? null : () => setState(() => _sureDk = math.min(300, sure + 5)),
                      ),
                    ]),
                  ),
                ],
                if (_gecmis.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  DenemeGecmisiKarti(denemeler: _gecmis),
                ],
                const SizedBox(height: 10),
                Text('Canlı deneme bu sürümde yok. Deneme sonucu bitince Gelişim geçmişine kaydedilir.', style: TextStyle(color: t.murekkep3, fontSize: 12.5, height: 1.4)),
              ],
            ),
          ),
          Container(
            decoration: BoxDecoration(color: t.kart, border: Border(top: BorderSide(color: t.cizgi))),
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                  Text(serbest ? 'Serbest deneme' : (_uzunluk == DenemeUzunluk.tam ? tur.ad : '${tur.ad} · ${_uzunluk.ad}'), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                  Text(ozetMetni, key: const ValueKey('deneme-ozet'), style: TextStyle(color: t.murekkep2, fontSize: 12.5)),
                ]),
              ),
              const SizedBox(width: 10),
              AkeDugme(
                'Denemeyi başlat',
                simge: Icons.play_arrow_rounded,
                genis: false,
                basinca: hakYok || plan == null
                    ? null
                    : () async {
                        await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => DenemeEkrani(model: widget.model, plan: plan)));
                        if (mounted) _yenile();
                      },
              ),
            ]),
          ),
        ]);
      },
    );
  }
}

/// Bölüm tablosu (site: Bölüm · Ders · Havuz · Soru). "Kendi dağılımım"da her satır − / + ile ayarlanır.
class _BolumTablosu extends StatelessWidget {
  final List<DenemeSatiri> satirlar;
  final Ozet ozet;
  final bool ozel;
  final int toplam;
  final void Function(DenemeSatiri, int) degistir;
  const _BolumTablosu({required this.satirlar, required this.ozet, required this.ozel, required this.toplam, required this.degistir});

  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    String? son;
    return KartKutu(
      key: const ValueKey('deneme-bolumler'),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Expanded(child: Text('Bölümler', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700))),
          Text('Havuz · Soru', style: TextStyle(color: t.murekkep3, fontSize: 12)),
        ]),
        const SizedBox(height: 4),
        for (final r in satirlar) ...[
          if (r.bolum != (son)) Padding(padding: const EdgeInsets.only(top: 10), child: Text((son = r.bolum), style: TextStyle(color: t.murekkep, fontWeight: FontWeight.w800, fontSize: 13.5))),
          Container(
            constraints: const BoxConstraints(minHeight: 40),
            child: Row(children: [
              Expanded(child: Text(Katalog.dersAdi(r.ders), style: TextStyle(color: t.murekkep2, fontSize: 14))),
              Text('${ozet.dersToplami(r.ders)}', key: ValueKey('deneme-havuz-${r.ders}'), style: TextStyle(color: t.murekkep3, fontSize: 12.5)),
              const SizedBox(width: 12),
              if (ozel)
                _Adimlayici(anahtar: 'deneme-satir-${r.ders}', metin: '${r.n}', azalt: r.n <= 0 ? null : () => degistir(r, -1), arttir: r.n >= r.tam ? null : () => degistir(r, 1))
              else
                SizedBox(width: 36, child: Text('${r.n}', key: ValueKey('deneme-satir-${r.ders}'), textAlign: TextAlign.right, style: const TextStyle(fontWeight: FontWeight.w700))),
            ]),
          ),
        ],
        Container(
          margin: const EdgeInsets.only(top: 8),
          padding: const EdgeInsets.only(top: 8),
          decoration: BoxDecoration(border: Border(top: BorderSide(color: t.cizgi))),
          child: Row(children: [
            const Expanded(child: Text('Toplam', style: TextStyle(fontWeight: FontWeight.w800))),
            Text('$toplam', key: const ValueKey('deneme-toplam'), style: const TextStyle(fontWeight: FontWeight.w800)),
          ]),
        ),
      ]),
    );
  }
}

/// − değer + (44 dp dokunma hedefi).
class _Adimlayici extends StatelessWidget {
  final String anahtar;
  final String metin;
  final VoidCallback? azalt;
  final VoidCallback? arttir;
  const _Adimlayici({required this.anahtar, required this.metin, required this.azalt, required this.arttir});
  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    Widget dugme(String etiket, IconData ic, VoidCallback? f, String k) => Semantics(
          button: true,
          label: etiket,
          child: ExcludeSemantics(
            child: AkeDokun(
              basinca: f,
              child: Container(key: ValueKey(k), width: 44, height: 44, alignment: Alignment.center, child: Icon(ic, size: 22, color: f == null ? t.cizgi : t.murekkep)),
            ),
          ),
        );
    return Row(mainAxisSize: MainAxisSize.min, children: [
      dugme('Azalt', Icons.remove_rounded, azalt, '$anahtar-eksi'),
      SizedBox(width: 38, child: Text(metin, key: ValueKey('$anahtar-deger'), textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15))),
      dugme('Artır', Icons.add_rounded, arttir, '$anahtar-arti'),
    ]);
  }
}

class _Secenek extends StatelessWidget {
  final String ad;
  final bool secili;
  final VoidCallback basinca;
  final String anahtar;
  const _Secenek({required this.ad, required this.secili, required this.basinca, required this.anahtar});
  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    return Semantics(
      button: true,
      selected: secili,
      label: ad,
      child: ExcludeSemantics(
        child: AkeDokun(
          basinca: basinca,
          child: Container(
            key: ValueKey(anahtar),
            constraints: const BoxConstraints(minHeight: 44, minWidth: 64),
            padding: const EdgeInsets.symmetric(horizontal: 14),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: secili ? t.girinti : t.kart,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: secili ? t.murekkep : t.cizgi, width: secili ? 1.6 : 1),
            ),
            child: Text(ad, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: secili ? t.murekkep : t.murekkep2)),
          ),
        ),
      ),
    );
  }
}

/// Sınav oturumu: soru gezinme paleti, geri sayım, cevap sunucuya yazılır (anahtar dönmez), bitirince sonuç.
class DenemeEkrani extends StatefulWidget {
  final UygulamaModeli model;
  final DenemePlani plan;
  const DenemeEkrani({super.key, required this.model, required this.plan});
  @override
  State<DenemeEkrani> createState() => _DenemeEkraniState();
}

class _DenemeEkraniState extends State<DenemeEkrani> {
  OturumYaniti? _oturum;
  Object? _hata;
  bool _yukleniyor = true;
  int _sira = 0;
  final Map<String, int> _cevaplar = {}; // yalnız sunucuya KAYDEDİLEN cevaplar
  bool _kaydediliyor = false;
  bool _bitiyor = false;
  Object? _cevapHatasi;
  Timer? _zamanlayici;
  late int _kalanSn = widget.plan.sureDk * 60; // süresizde (0) geçen süre sayılır
  final String _istek = UygulamaModeli.yeniIstekKimligi();
  final DateTime _baslangic = DateTime.now();

  AkeApi get _api => widget.model.api;

  @override
  void initState() {
    super.initState();
    _baslat();
  }

  @override
  void dispose() {
    _zamanlayici?.cancel();
    super.dispose();
  }

  Future<void> _baslat() async {
    setState(() {
      _yukleniyor = true;
      _hata = null;
    });
    try {
      final p = widget.plan;
      final o = p.bolumlu
          ? await _api.oturumOlustur(istek: _istek, adet: p.adet, sinav: true, bolumler: p.bolumlerJson(), tur: p.tur, uzunluk: p.uzunluk.kod)
          : await _api.oturumOlustur(istek: _istek, adet: p.adet, ders: p.ders, sinav: true);
      if (!mounted) return;
      setState(() {
        _oturum = o;
        _yukleniyor = false;
      });
      _zamanlayici?.cancel();
      _zamanlayici = Timer.periodic(const Duration(seconds: 1), (_) => _tik());
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _hata = e;
        _yukleniyor = false;
      });
    }
  }

  void _tik() {
    if (!mounted || _oturum == null || _bitiyor) return;
    final gecen = DateTime.now().difference(_baslangic).inSeconds;
    if (widget.plan.sureDk == 0) {
      setState(() => _kalanSn = gecen); // süresiz: geçen süre görünür, otomatik bitirme yok
      return;
    }
    final kalan = widget.plan.sureDk * 60 - gecen;
    setState(() => _kalanSn = kalan);
    if (kalan <= 0) {
      _zamanlayici?.cancel();
      _bitir(sureDoldu: true);
    }
  }

  Future<void> _sec(int secim) async {
    final o = _oturum;
    if (o == null || _kaydediliyor || _bitiyor) return;
    final soru = o.sorular[_sira];
    setState(() {
      _kaydediliyor = true;
      _cevapHatasi = null;
    });
    try {
      await _api.sinavCevabi(oturum: o.oturum, soru: soru.id, secim: secim);
      if (mounted) setState(() => _cevaplar[soru.id] = secim);
    } catch (e) {
      if (mounted) setState(() => _cevapHatasi = e);
    } finally {
      if (mounted) setState(() => _kaydediliyor = false);
    }
  }

  Future<void> _bitirSor() async {
    final o = _oturum;
    if (o == null) return;
    final bos = o.sorular.length - _cevaplar.length;
    final onay = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Denemeyi bitir?'),
        content: Text(bos == 0 ? 'Tüm soruları cevapladın. Sonuç açıklanacak.' : '$bos soru boş. Bitirirsen cevaplar değiştirilemez ve sonuç açıklanır.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(c).pop(false), child: const Text('Devam et')),
          TextButton(key: const ValueKey('deneme-bitir-onay'), onPressed: () => Navigator.of(c).pop(true), child: const Text('Bitir')),
        ],
      ),
    );
    if (onay == true) await _bitir();
  }

  Future<void> _bitir({bool sureDoldu = false}) async {
    final o = _oturum;
    if (o == null || _bitiyor) return;
    setState(() {
      _bitiyor = true;
      _cevapHatasi = null;
    });
    try {
      final s = await _api.bitir(o.oturum);
      // Deneme sonucu Gelişim geçmişine SUNUCUDA işlenir (stats + deneme özeti, çift sayım korumalı); uygulama sayaç göndermez.
      final hesap = widget.model.kullanici?.id ?? '';
      if (hesap.isNotEmpty) {
        widget.model.senkron.ekle(hesapId: hesap, oturum: o.oturum);
        widget.model.senkron.bosalt();
      }
      if (!mounted) return;
      _zamanlayici?.cancel();
      await Navigator.of(context).pushReplacement(MaterialPageRoute<void>(builder: (_) => DenemeSonucEkrani(model: widget.model, sonuc: s, sorular: o.sorular, sureDoldu: sureDoldu, harcananSn: DateTime.now().difference(_baslangic).inSeconds, plan: widget.plan)));
    } catch (e) {
      if (mounted) {
        setState(() {
          _cevapHatasi = e;
          _bitiyor = false;
        });
      }
    }
  }

  Future<bool> _cikisSor() async {
    if (_oturum == null) return true;
    final onay = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Denemeden çıkılsın mı?'),
        content: const Text('Çıkarsan bu deneme burada devam ettirilemez. Kaydedilmiş cevapların sunucuda kalır ama sonuç gösterilmez.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(c).pop(false), child: const Text('Devam et')),
          TextButton(onPressed: () => Navigator.of(c).pop(true), child: const Text('Çık')),
        ],
      ),
    );
    return onay == true;
  }

  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    final o = _oturum;
    return PopScope(
      canPop: o == null,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final nav = Navigator.of(context);
        if (await _cikisSor()) {
          _zamanlayici?.cancel();
          nav.pop();
        }
      },
      child: AkeSayfa(
        baslik: 'Deneme',
        sag: o == null
            ? null
            : Padding(
                padding: const EdgeInsets.only(right: 8),
                child: Container(
                  key: const ValueKey('deneme-sure'),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                  decoration: BoxDecoration(borderRadius: BorderRadius.circular(999), color: Colors.white.withValues(alpha: 0.08)),
                  child: Text(sureMetni(_kalanSn), style: rakamStili(widget.plan.sureDk > 0 && _kalanSn < 300 ? AkeTok.acik.mercanAcik : AkeTok.porselen, 15, agirlik: FontWeight.w700)),
                ),
              ),
        govde: _yukleniyor
            ? const Yukleniyor(metin: 'Deneme hazırlanıyor…')
            : (_hata != null || o == null)
                ? DurumKutusu(
                    simge: Icons.cloud_off,
                    baslik: _hata is ApiHata && (_hata as ApiHata).tur == HataTuru.limit ? 'Deneme hakkın bitti' : 'Deneme başlatılamadı',
                    aciklama: hataMetni(_hata ?? 'x'),
                    dugme: _hata is ApiHata && (_hata as ApiHata).tur == HataTuru.limit ? null : 'Tekrar dene',
                    basinca: _baslat,
                  )
                : _icerik(t, o),
      ),
    );
  }

  Widget _icerik(AkeTok t, OturumYaniti o) {
    final soru = o.sorular[_sira];
    final secili = _cevaplar[soru.id];
    return Column(children: [
      Expanded(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
          children: [
            Row(children: [
              Text('Soru ${_sira + 1} / ${o.sorular.length}', style: const TextStyle(fontWeight: FontWeight.w700)),
              const Spacer(),
              Text('${_cevaplar.length} cevaplandı', style: TextStyle(color: t.murekkep2, fontSize: 13)),
            ]),
            const SizedBox(height: 10),
            if (soru.paragraf != null) ...[
              SolSeritKutu(serit: t.mercanDeko, seritGenisligi: 3, renk: t.girinti, kenar: Colors.transparent, yaricap: 14, child: Text(soru.paragraf!, style: const TextStyle(fontFamily: AkeYazi.serif, fontFamilyFallback: AkeYazi.yedek, fontSize: 16.5, height: 1.55))),
              const SizedBox(height: 12),
            ],
            Text(soru.metin, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600, height: 1.45)),
            const SizedBox(height: 14),
            for (var i = 0; i < soru.secenekler.length; i++) ...[
              Semantics(
                button: true,
                selected: secili == i,
                label: 'Şık ${_harfler[i]}: ${soru.secenekler[i]}',
                child: ExcludeSemantics(
                  child: AkeDokun(
                    basinca: _kaydediliyor || _bitiyor ? null : () => _sec(i),
                    child: Container(
                      key: ValueKey('deneme-sik-$i'),
                      constraints: const BoxConstraints(minHeight: 56),
                      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                      decoration: BoxDecoration(
                        color: secili == i ? t.girinti : t.kart,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: secili == i ? t.murekkep : t.cizgi, width: secili == i ? 2 : 1),
                      ),
                      child: Row(children: [
                        Container(width: 30, height: 30, alignment: Alignment.center, decoration: BoxDecoration(shape: BoxShape.circle, color: secili == i ? t.murekkep : t.girinti), child: Text(_harfler[i], style: TextStyle(fontWeight: FontWeight.w700, color: secili == i ? t.kart : t.murekkep2))),
                        const SizedBox(width: 12),
                        Expanded(child: Text(soru.secenekler[i], style: const TextStyle(height: 1.35))),
                      ]),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 8),
            ],
            if (_cevapHatasi != null)
              KartKutu(renk: t.uyariZemin, kenar: t.uyari, child: Text(hataMetni(_cevapHatasi!), style: TextStyle(color: t.uyari))),
            const SizedBox(height: 8),
            Text('Soru paleti', style: TextStyle(color: t.murekkep2, fontWeight: FontWeight.w700, fontSize: 13)),
            const SizedBox(height: 8),
            Wrap(spacing: 6, runSpacing: 6, children: [
              for (var i = 0; i < o.sorular.length; i++)
                Semantics(
                  button: true,
                  label: 'Soru ${i + 1}${_cevaplar.containsKey(o.sorular[i].id) ? ', cevaplandı' : ''}',
                  child: ExcludeSemantics(
                    child: AkeDokun(
                      basinca: () => setState(() => _sira = i),
                      child: Container(
                        key: ValueKey('palet-$i'),
                        width: 44,
                        height: 44,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: i == _sira ? t.murekkep : (_cevaplar.containsKey(o.sorular[i].id) ? t.mercanYumusak : t.kart),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: i == _sira ? t.murekkep : (_cevaplar.containsKey(o.sorular[i].id) ? t.mercan : t.cizgi)),
                        ),
                        child: Text('${i + 1}', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: i == _sira ? t.kart : t.murekkep)),
                      ),
                    ),
                  ),
                ),
            ]),
          ],
        ),
      ),
      Container(
        decoration: BoxDecoration(color: t.kart, border: Border(top: BorderSide(color: t.cizgi))),
        padding: EdgeInsets.fromLTRB(16, 10, 16, 10 + MediaQuery.paddingOf(context).bottom),
        child: Row(children: [
          Expanded(child: AkeDugme('Önceki', tur: DugmeTuru.cizgili, basinca: _sira == 0 ? null : () => setState(() => _sira--))),
          const SizedBox(width: 10),
          Expanded(
            child: _sira + 1 < o.sorular.length
                ? AkeDugme('Sonraki', basinca: () => setState(() => _sira++))
                : AkeDugme(_bitiyor ? 'Bitiriliyor…' : 'Bitir', basinca: _bitiyor ? null : _bitirSor),
          ),
        ]),
      ),
    ]);
  }
}

/// Deneme sonucu: net, doğru/yanlış/boş, soru bazlı çözüm (anahtar ve açıklama sunucudan, bitişte gelir).
class DenemeSonucEkrani extends StatelessWidget {
  final UygulamaModeli model;
  final OturumSonucu sonuc;
  final List<Soru> sorular;
  final bool sureDoldu;
  final int harcananSn;
  final DenemePlani plan;
  const DenemeSonucEkrani({super.key, required this.model, required this.sonuc, required this.sorular, required this.sureDoldu, required this.harcananSn, required this.plan});

  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    final satirlar = {for (final s in sonuc.sorular) s.id: s};
    return AkeSayfa(
      baslik: 'Deneme sonucu',
      geriGoster: false,
      govde: ListView(
        padding: const EdgeInsets.fromLTRB(16, 18, 16, 24),
        children: [
          KartKutu(
            padding: const EdgeInsets.all(22),
            child: Column(children: [
              if (sureDoldu) Padding(padding: const EdgeInsets.only(bottom: 10), child: Text('Süre doldu, deneme otomatik bitirildi.', style: TextStyle(color: t.uyari, fontWeight: FontWeight.w600))),
              Text('NET', style: TextStyle(color: t.murekkep3, fontWeight: FontWeight.w700, letterSpacing: 1.2, fontSize: 12)),
              Text(sonuc.net.toStringAsFixed(2).replaceAll('.', ','), key: const ValueKey('deneme-net'), style: rakamStili(t.murekkep, 44)),
              const SizedBox(height: 8),
              Text('${sonuc.dogru} doğru · ${sonuc.yanlis} yanlış · ${sonuc.bos} boş', style: TextStyle(color: t.murekkep2)),
              const SizedBox(height: 4),
              Text('Süre: ${sureMetni(harcananSn)}', style: TextStyle(color: t.murekkep3, fontSize: 13)),
            ]),
          ),
          if (plan.bolumlu && plan.bolumAdlari.length > 1) ...[
            const SizedBox(height: 14),
            _DersDers(plan: plan, sorular: sorular, satirlar: satirlar),
          ],
          const SizedBox(height: 16),
          const Text('Soru soru çözümler', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
          const SizedBox(height: 10),
          for (var i = 0; i < sorular.length; i++) _SatirKarti(no: i + 1, soru: sorular[i], satir: satirlar[sorular[i].id]),
          const SizedBox(height: 12),
          AkeDugme('Yeni deneme', basinca: () {
            Navigator.of(context).pushReplacement(MaterialPageRoute<void>(builder: (_) => DenemeEkrani(model: model, plan: plan)));
          }),
          const SizedBox(height: 10),
          AkeDugme('Deneme sayfasına dön', tur: DugmeTuru.cizgili, basinca: () => Navigator.of(context).popUntil((r) => r.isFirst)),
        ],
      ),
    );
  }
}

/// Sitedeki "Ders ders" tablosu: bölüm başına D / Y / B / net (soru sonuçlarından hesaplanır).
class _DersDers extends StatelessWidget {
  final DenemePlani plan;
  final List<Soru> sorular;
  final Map<String, SonucSatir> satirlar;
  const _DersDers({required this.plan, required this.sorular, required this.satirlar});
  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    final harita = plan.dersBolum;
    final d = <String, int>{}, y = <String, int>{}, b = <String, int>{};
    for (final q in sorular) {
      final bolum = harita[q.ders];
      if (bolum == null) continue;
      final r = satirlar[q.id];
      if (r?.secim == null) {
        b[bolum] = (b[bolum] ?? 0) + 1;
      } else if (r?.dogru == true) {
        d[bolum] = (d[bolum] ?? 0) + 1;
      } else {
        y[bolum] = (y[bolum] ?? 0) + 1;
      }
    }
    final adlar = plan.bolumAdlari.where((a) => (d[a] ?? 0) + (y[a] ?? 0) + (b[a] ?? 0) > 0).toList();
    if (adlar.length < 2) return const SizedBox.shrink(); // site gibi: tek bölüm varsa ders ders tablosu gösterilmez
    Widget hucre(String m, {bool kalin = false, double genislik = 34}) => SizedBox(width: genislik, child: Text(m, textAlign: TextAlign.right, style: TextStyle(fontWeight: kalin ? FontWeight.w800 : FontWeight.w500, fontSize: 13.5)));
    String net(double v) => v.toStringAsFixed(2).replaceAll('.', ',');
    return KartKutu(
      key: const ValueKey('deneme-ders-ders'),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Ders ders', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        Row(children: [
          Expanded(child: Text('Bölüm', style: TextStyle(color: t.murekkep3, fontSize: 12, fontWeight: FontWeight.w700))),
          for (final h in ['D', 'Y', 'B']) hucre(h),
          hucre('Net', genislik: 52),
        ]),
        for (final a in adlar)
          Container(
            constraints: const BoxConstraints(minHeight: 40),
            decoration: BoxDecoration(border: Border(top: BorderSide(color: t.cizgi))),
            child: Row(children: [
              Expanded(child: Text(a, style: const TextStyle(fontWeight: FontWeight.w600))),
              hucre('${d[a] ?? 0}'),
              hucre('${y[a] ?? 0}'),
              hucre('${b[a] ?? 0}'),
              SizedBox(width: 52, child: Text(net((d[a] ?? 0) - (y[a] ?? 0) / 4), key: ValueKey('deneme-bolum-net-$a'), textAlign: TextAlign.right, style: const TextStyle(fontWeight: FontWeight.w800))),
            ]),
          ),
      ]),
    );
  }
}

class _SatirKarti extends StatelessWidget {
  final int no;
  final Soru soru;
  final SonucSatir? satir;
  const _SatirKarti({required this.no, required this.soru, required this.satir});
  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    final secim = satir?.secim;
    final dogruS = satir?.dogruSecenek;
    final dogru = satir?.dogru == true;
    final bos = secim == null;
    final renk = bos ? t.murekkep3 : (dogru ? t.dogru : t.yanlis);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: KartKutu(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Icon(bos ? Icons.remove_circle_outline : (dogru ? Icons.check_circle_rounded : Icons.cancel_rounded), color: renk, size: 20),
            const SizedBox(width: 8),
            Text('Soru $no · ${Katalog.dersAdi(soru.ders)}', style: TextStyle(fontWeight: FontWeight.w700, color: t.murekkep2, fontSize: 13)),
          ]),
          const SizedBox(height: 8),
          Text(soru.metin, maxLines: 4, overflow: TextOverflow.ellipsis, style: const TextStyle(height: 1.4)),
          const SizedBox(height: 8),
          Text(
            bos ? 'Boş bıraktın' : 'Senin cevabın: ${_harfler[secim]}',
            style: TextStyle(color: renk, fontWeight: FontWeight.w600, fontSize: 13.5),
          ),
          if (dogruS != null && dogruS >= 0 && dogruS < 5) Text('Doğru cevap: ${_harfler[dogruS]}  ${soru.secenekler[dogruS]}', style: TextStyle(color: t.dogru, fontWeight: FontWeight.w600, fontSize: 13.5, height: 1.35)),
          if (satir?.aciklama != null) ...[
            const SizedBox(height: 8),
            Text(satir!.aciklama!, style: TextStyle(color: t.murekkep2, height: 1.45, fontSize: 14)),
          ],
        ]),
      ),
    );
  }
}
