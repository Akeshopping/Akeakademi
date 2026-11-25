import 'dart:math';

import 'package:flutter/material.dart';

import '../durum/uygulama.dart';
import '../veri/api.dart';
import '../veri/hesap_verisi.dart';
import '../veri/katalog.dart';
import 'odak.dart';
import 'ortak.dart';
import 'tema.dart';

/// Haftalık planın bir görevi (web ile aynı alanlar: id, day 0=Pazartesi, text ≤140, s ders, min 0–600, done).
class GorevKaydi {
  final String id;
  final int gun;
  final String metin;
  final String ders;
  final int dakika;
  final bool bitti;
  const GorevKaydi({required this.id, required this.gun, required this.metin, required this.ders, required this.dakika, required this.bitti});

  GorevKaydi kopya({bool? bitti}) => GorevKaydi(id: id, gun: gun, metin: metin, ders: ders, dakika: dakika, bitti: bitti ?? this.bitti);

  Map<String, dynamic> json() => {'id': id, 'day': gun, 'text': metin, 's': ders, 'min': dakika, 'done': bitti};

  static GorevKaydi? ham(Object? v, int sira) {
    if (v is! Map) return null;
    final m = Map<String, dynamic>.from(v);
    final metin = '${m['text'] ?? ''}'.trim();
    if (metin.isEmpty) return null;
    int i(Object? x) => x is num ? x.toInt() : 0;
    final id = '${m['id'] ?? ''}'.isEmpty ? 'g$sira' : '${m['id']}';
    return GorevKaydi(id: id, gun: i(m['day']).clamp(0, 6).toInt(), metin: metin, ders: '${m['s'] ?? ''}', dakika: i(m['min']).clamp(0, 600).toInt(), bitti: m['done'] == true);
  }
}

String yeniGorevKimligi([Random? r]) {
  final rnd = r ?? Random.secure();
  const h = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return 'm${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}${List.generate(5, (_) => h[rnd.nextInt(h.length)]).join()}';
}

/// Planı sunucu belgesi + sürümle okur, görev listesini değiştirir ve KOŞULLU yazar (409'da yeniden okuyup bir kez daha dener).
/// Belgedeki bilinmeyen alanlar korunur; `stats` hiç dokunulmaz.
class PlanDeposu {
  final AkeApi api;
  PlanDeposu(this.api);

  Future<(Map<String, dynamic>, int)> oku() async {
    final (belge, surum, _) = await okuTam(DateTime.now());
    return (belge, surum);
  }

  /// Plan belgesi + sürümü + hesaptaki bugünkü odak dakikası (aynı istekte okunur).
  Future<(Map<String, dynamic>, int, int)> okuTam(DateTime simdi) async {
    final (alanlar, u) = await api.veriOkuSurumlu();
    // Sitenin belge biçimi: {_u, plan: {tasks: [...]}} (AREA.plan = ["plan"]).
    final doc = alanlar['plan'] is Map ? alanlar['plan'] as Map : const {};
    final belge = doc['plan'] is Map ? Map<String, dynamic>.from(doc['plan'] as Map) : <String, dynamic>{};
    final fm = HesapVerisi.alanlardan(alanlar).bugun(simdi).odakDk;
    return (belge, u['plan'] ?? 0, fm);
  }

  static List<GorevKaydi> gorevler(Map<String, dynamic> belge) {
    final l = belge['tasks'];
    final r = <GorevKaydi>[];
    if (l is List) {
      for (var i = 0; i < l.length; i++) {
        final g = GorevKaydi.ham(l[i], i);
        if (g != null) r.add(g);
      }
    }
    return r;
  }

  /// [degistir] güncel listeye uygulanır. Dönen: yazılan güncel liste.
  Future<List<GorevKaydi>> uygula(List<GorevKaydi> Function(List<GorevKaydi>) degistir) async {
    for (var deneme = 0; deneme < 3; deneme++) {
      final (belge, surum) = await oku();
      final yeni = degistir(gorevler(belge));
      final gonder = Map<String, dynamic>.from(belge)..['tasks'] = yeni.map((g) => g.json()).toList();
      try {
        await api.veriYaz('plan', {'plan': gonder}, surum);
        return yeni;
      } on ApiHata catch (e) {
        if (e.tur == HataTuru.cakisma && e.kod == 'eski' && deneme < 2) continue; // araya başka yazma girdi: yeniden oku, uygula
        rethrow;
      }
    }
    throw const ApiHata(HataTuru.cakisma, kod: 'eski', mesaj: 'Plan başka bir cihazda değişiyor.');
  }
}

/// Plan: haftalık görevleri ekle, işaretle, sil, haftayı sıfırla (web ile aynı belge; sunucuya koşullu yazılır).
class PlanSekmesi extends StatefulWidget {
  final UygulamaModeli model;
  const PlanSekmesi({super.key, required this.model});
  @override
  State<PlanSekmesi> createState() => _PlanSekmesiState();
}

class _PlanSekmesiState extends State<PlanSekmesi> {
  late final PlanDeposu _depo = PlanDeposu(widget.model.api);
  List<GorevKaydi>? _liste;
  Object? _hata;
  bool _yukleniyor = true;
  int _bugunFm = 0; // hesaptaki bugünkü odak dakikası
  bool _kaydediliyor = false;
  String? _islemHatasi;

  @override
  void initState() {
    super.initState();
    _oku();
  }

  Future<void> _oku() async {
    setState(() {
      _yukleniyor = true;
      _hata = null;
    });
    try {
      await widget.model.senkron.bosalt();
      final (belge, _, fm) = await _depo.okuTam(widget.model.saat());
      if (!mounted) return;
      setState(() {
        _bugunFm = fm;
        _liste = PlanDeposu.gorevler(belge);
        _yukleniyor = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _hata = e;
        _yukleniyor = false;
      });
    }
  }

  Future<void> _degistir(List<GorevKaydi> Function(List<GorevKaydi>) f) async {
    if (_kaydediliyor) return;
    setState(() {
      _kaydediliyor = true;
      _islemHatasi = null;
    });
    try {
      final yeni = await _depo.uygula(f);
      if (mounted) setState(() => _liste = yeni);
    } catch (e) {
      if (mounted) setState(() => _islemHatasi = 'Kaydedilemedi: ${hataMetni(e)}');
    } finally {
      if (mounted) setState(() => _kaydediliyor = false);
    }
  }

  Future<void> _ekle() async {
    final g = await showModalBottomSheet<GorevKaydi>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => const _GorevFormu(),
    );
    if (g == null) return;
    await _degistir((l) => [...l, g]);
  }

  Future<void> _sifirlaSor() async {
    final onay = await _onay('Hafta sıfırlansın mı?', 'Tüm görevler “yapılmadı” olur. Görevler silinmez.', 'Sıfırla');
    if (onay) await _degistir((l) => [for (final g in l) g.kopya(bitti: false)]);
  }

  Future<void> _temizleSor() async {
    final onay = await _onay('Plan temizlensin mi?', 'Tüm görevler silinir. Bu işlem geri alınamaz.', 'Temizle');
    if (onay) await _degistir((_) => <GorevKaydi>[]);
  }

  Future<bool> _onay(String baslik, String metin, String dugme) async {
    final r = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(baslik),
        content: Text(metin),
        actions: [
          TextButton(onPressed: () => Navigator.of(c).pop(false), child: const Text('Vazgeç')),
          TextButton(key: const ValueKey('plan-onay'), onPressed: () => Navigator.of(c).pop(true), child: Text(dugme)),
        ],
      ),
    );
    return r == true;
  }

  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    if (_yukleniyor) return const Yukleniyor(metin: 'Planın getiriliyor…');
    if (_hata != null || _liste == null) return DurumKutusu(simge: Icons.cloud_off, baslik: 'Plan getirilemedi', aciklama: hataMetni(_hata ?? 'x'), dugme: 'Tekrar dene', basinca: _oku);
    final liste = _liste!;
    final bugun = DateTime.now().weekday - 1;
    final bitenSayi = liste.where((g) => g.bitti).length;
    return RefreshIndicator(
      color: t.mercan,
      backgroundColor: t.kart,
      onRefresh: _oku,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
        children: [
          Row(children: [
            const Expanded(child: Text('Planım', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, height: 1.15))),
            if (liste.isNotEmpty) Hap('$bitenSayi / ${liste.length}'),
          ]),
          const SizedBox(height: 4),
          Text('Haftalık görevlerin sitedeki planla aynıdır; burada ekleyip işaretleyebilirsin.', style: TextStyle(color: t.murekkep2, height: 1.4)),
          const SizedBox(height: 14),
          AkeDugme('Görev ekle', key: const ValueKey('plan-ekle'), simge: Icons.add_rounded, basinca: _kaydediliyor ? null : _ekle),
          if (_islemHatasi != null) ...[
            const SizedBox(height: 10),
            KartKutu(renk: t.uyariZemin, kenar: t.uyari, child: Text(_islemHatasi!, style: TextStyle(color: t.uyari))),
          ],
          const SizedBox(height: 14),
          OdakKarti(model: widget.model, hesapBugunDk: _bugunFm),
          const SizedBox(height: 14),
          if (liste.isEmpty)
            const KartKutu(child: Text('Henüz görevin yok. “Görev ekle” ile ilk görevini yaz.', style: TextStyle(height: 1.4)))
          else
            for (var g = 0; g < 7; g++)
              if (liste.any((p) => p.gun == g)) ...[
                _Gun(
                  gun: g,
                  bugun: g == bugun,
                  gorevler: liste.where((p) => p.gun == g).toList(),
                  isaretle: (id, v) => _degistir((l) => [for (final x in l) x.id == id ? x.kopya(bitti: v) : x]),
                  sil: (id) => _degistir((l) => l.where((x) => x.id != id).toList()),
                  mesgul: _kaydediliyor,
                ),
                const SizedBox(height: 12),
              ],
          if (liste.isNotEmpty) ...[
            const SizedBox(height: 4),
            Row(children: [
              Expanded(child: AkeDugme('Haftayı sıfırla', tur: DugmeTuru.cizgili, basinca: _kaydediliyor ? null : _sifirlaSor)),
              const SizedBox(width: 10),
              Expanded(child: AkeDugme('Planı temizle', tur: DugmeTuru.cizgili, basinca: _kaydediliyor ? null : _temizleSor)),
            ]),
          ],
          const SizedBox(height: 8),
          Text('AI ile plan hazırlama mobilde henüz yok.', style: TextStyle(color: t.murekkep3, fontSize: 12.5)),
        ],
      ),
    );
  }
}

class _Gun extends StatelessWidget {
  final int gun;
  final bool bugun;
  final List<GorevKaydi> gorevler;
  final void Function(String id, bool bitti) isaretle;
  final void Function(String id) sil;
  final bool mesgul;
  const _Gun({required this.gun, required this.bugun, required this.gorevler, required this.isaretle, required this.sil, required this.mesgul});
  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    return KartKutu(
      kenar: bugun ? t.mercan : null,
      padding: const EdgeInsets.fromLTRB(16, 14, 8, 8),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(gunAdlari[gun], style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700))),
          if (bugun) const Padding(padding: EdgeInsets.only(right: 8), child: Hap('Bugün')),
        ]),
        const SizedBox(height: 6),
        for (final g in gorevler) _Gorev(g: g, isaretle: isaretle, sil: sil, mesgul: mesgul),
      ]),
    );
  }
}

class _Gorev extends StatelessWidget {
  final GorevKaydi g;
  final void Function(String id, bool bitti) isaretle;
  final void Function(String id) sil;
  final bool mesgul;
  const _Gorev({required this.g, required this.isaretle, required this.sil, required this.mesgul});
  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    final r = g.ders.isEmpty ? null : dersRengi(context, g.ders);
    return Container(
      constraints: const BoxConstraints(minHeight: 52),
      decoration: BoxDecoration(border: Border(top: BorderSide(color: t.cizgi))),
      child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
        Expanded(
          child: Semantics(
          button: true,
          checked: g.bitti,
          label: '${g.metin}, ${g.bitti ? 'tamamlandı' : 'tamamlanmadı'}. Değiştirmek için dokun.',
          child: ExcludeSemantics(
            child: AkeDokun(
              basinca: mesgul ? null : () => isaretle(g.id, !g.bitti),
              child: Container(
                key: ValueKey('gorev-${g.id}'),
                constraints: const BoxConstraints(minHeight: 52),
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Row(children: [
                  Icon(g.bitti ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded, size: 24, color: g.bitti ? t.dogru : t.cizgiGuclu),
                  const SizedBox(width: 12),
                  Flexible(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(g.metin, style: TextStyle(fontWeight: FontWeight.w600, height: 1.3, decoration: g.bitti ? TextDecoration.lineThrough : null, color: g.bitti ? t.murekkep3 : t.murekkep)),
                      if (r != null || g.dakika > 0)
                        Padding(
                          padding: const EdgeInsets.only(top: 3),
                          child: Text([if (g.ders.isNotEmpty) Katalog.dersAdi(g.ders), if (g.dakika > 0) '${g.dakika} dk'].join(' · '), style: TextStyle(color: r?.metin ?? t.murekkep2, fontSize: 12.5, fontWeight: FontWeight.w600)),
                        ),
                    ]),
                  ),
                ]),
              ),
            ),
          ),
        ),
        ),
        Semantics(
          button: true,
          label: 'Görevi sil: ${g.metin}',
          child: AkeDokun(
            basinca: mesgul ? null : () => sil(g.id),
            child: SizedBox(key: ValueKey('gorev-sil-${g.id}'), width: 48, height: 48, child: Icon(Icons.delete_outline_rounded, color: t.murekkep3, size: 22)),
          ),
        ),
      ]),
    );
  }
}

/// Görev ekleme formu (alt sayfa): metin, gün, ders, süre.
class _GorevFormu extends StatefulWidget {
  const _GorevFormu();
  @override
  State<_GorevFormu> createState() => _GorevFormuState();
}

class _GorevFormuState extends State<_GorevFormu> {
  final TextEditingController _metin = TextEditingController();
  int _gun = DateTime.now().weekday - 1;
  String _ders = '';
  int _dk = 30;

  @override
  void dispose() {
    _metin.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    final bos = _metin.text.trim().isEmpty;
    Widget chip(String ad, bool secili, VoidCallback f, {String? anahtar}) => Semantics(
          button: true,
          selected: secili,
          label: ad,
          child: ExcludeSemantics(
            child: AkeDokun(
              basinca: f,
              child: Container(
                key: anahtar == null ? null : ValueKey(anahtar),
                constraints: const BoxConstraints(minHeight: 44, minWidth: 52),
                padding: const EdgeInsets.symmetric(horizontal: 12),
                alignment: Alignment.center,
                decoration: BoxDecoration(color: secili ? t.girinti : t.kart, borderRadius: BorderRadius.circular(12), border: Border.all(color: secili ? t.murekkep : t.cizgi, width: secili ? 1.6 : 1)),
                child: Text(ad, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: secili ? t.murekkep : t.murekkep2)),
              ),
            ),
          ),
        );
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Yeni görev', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
          TextField(
            key: const ValueKey('gorev-metin'),
            controller: _metin,
            maxLength: 140,
            autofocus: true,
            decoration: const InputDecoration(labelText: 'Ne yapacaksın?', hintText: 'Örn. Paragraf: 25 soru', border: OutlineInputBorder()),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 8),
          Text('Gün', style: TextStyle(color: t.murekkep2, fontWeight: FontWeight.w700, fontSize: 13)),
          const SizedBox(height: 6),
          Wrap(spacing: 6, runSpacing: 6, children: [for (var i = 0; i < 7; i++) chip(gunAdlari[i].substring(0, 3), _gun == i, () => setState(() => _gun = i), anahtar: 'gun-$i')]),
          const SizedBox(height: 12),
          Text('Ders (isteğe bağlı)', style: TextStyle(color: t.murekkep2, fontWeight: FontWeight.w700, fontSize: 13)),
          const SizedBox(height: 6),
          Wrap(spacing: 6, runSpacing: 6, children: [
            chip('Yok', _ders.isEmpty, () => setState(() => _ders = '')),
            for (final d in ['turkce', 'mat', 'geo', 'fizik', 'kimya', 'biyoloji', 'tarih', 'cografya', 'edebiyat']) chip(Katalog.dersAdi(d), _ders == d, () => setState(() => _ders = d)),
          ]),
          const SizedBox(height: 12),
          Text('Süre', style: TextStyle(color: t.murekkep2, fontWeight: FontWeight.w700, fontSize: 13)),
          const SizedBox(height: 6),
          Wrap(spacing: 6, runSpacing: 6, children: [for (final d in [0, 15, 30, 45, 60, 90]) chip(d == 0 ? 'Süresiz' : '$d dk', _dk == d, () => setState(() => _dk = d))]),
          const SizedBox(height: 16),
          AkeDugme(
            'Ekle',
            key: const ValueKey('gorev-kaydet'),
            basinca: bos ? null : () => Navigator.of(context).pop(GorevKaydi(id: yeniGorevKimligi(), gun: _gun, metin: _metin.text.trim(), ders: _ders, dakika: _dk, bitti: false)),
          ),
        ]),
      ),
    );
  }
}
