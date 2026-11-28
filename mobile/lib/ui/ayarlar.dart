import 'package:flutter/material.dart';

import '../durum/uygulama.dart';
import '../veri/api.dart';
import '../veri/hesap_verisi.dart';
import '../veri/modeller.dart';
import '../yapilandirma.dart';
import 'ortak.dart';
import 'tema.dart';

/// Profil belgesini (web ile aynı `profile` alanı) sürümüyle okuyup KOŞULLU yazar; bilinmeyen alanlar korunur.
class ProfilDeposu {
  final AkeApi api;
  ProfilDeposu(this.api);

  Future<(Map<String, dynamic>, int)> oku() async {
    final (alanlar, u) = await api.veriOkuSurumlu();
    // Sitenin belge biçimi: {_u, profile: {name, alan, gunluk, examDate, …}} (AREA.profile = ["profile"]).
    final belge = alanlar['profile'] is Map ? alanlar['profile'] as Map : const {};
    return (belge['profile'] is Map ? Map<String, dynamic>.from(belge['profile'] as Map) : <String, dynamic>{}, u['profile'] ?? 0);
  }

  /// Yalnızca verilen alanlar değişir (name, alan, gunluk, examDate).
  Future<void> kaydet(Map<String, Object> degisen) async {
    for (var deneme = 0; deneme < 3; deneme++) {
      final (belge, surum) = await oku();
      final yeni = Map<String, dynamic>.from(belge)..addAll(degisen);
      try {
        await api.veriYaz('profile', {'profile': yeni}, surum);
        return;
      } on ApiHata catch (e) {
        if (e.tur == HataTuru.cakisma && e.kod == 'eski' && deneme < 2) continue;
        rethrow;
      }
    }
  }
}

String _sade(String s) => s.toUpperCase().replaceAll('İ', 'I').replaceAll('ı', 'I').replaceAll('Ş', 'S').replaceAll('Ğ', 'G').replaceAll('Ü', 'U').replaceAll('Ö', 'O').replaceAll('Ç', 'C').trim();

/// Ayarlar ve hesap: profil/hedef düzenleme (sunucuya yazılır), paket durumu + erişim kodu, tema, çıkış, hesap silme (sunucuda kalıcı).
class AyarlarSekmesi extends StatefulWidget {
  final UygulamaModeli model;
  const AyarlarSekmesi({super.key, required this.model});
  @override
  State<AyarlarSekmesi> createState() => _AyarlarSekmesiState();
}

class _AyarlarSekmesiState extends State<AyarlarSekmesi> {
  late final ProfilDeposu _profil = ProfilDeposu(widget.model.api);
  late Future<(HesapVerisi, HesapDurumu)> _f;
  final TextEditingController _ad = TextEditingController();
  final TextEditingController _kod = TextEditingController();
  String _alan = '';
  int _hedef = 40;
  String _sinav = HesapVerisi.varsayilanSinav;
  bool _dolduruldu = false;
  bool _kaydediliyor = false;
  String? _mesaj;
  bool _mesajHata = false;
  String? _kodHatasi;
  bool _kodBekliyor = false;
  HesapDurumu? _durum;

  UygulamaModeli get model => widget.model;

  @override
  void initState() {
    super.initState();
    _f = _yukle();
  }

  @override
  void dispose() {
    _ad.dispose();
    _kod.dispose();
    super.dispose();
  }

  Future<(HesapVerisi, HesapDurumu)> _yukle() async {
    final v = await model.hesapVerisi();
    final d = await model.api.hesapDurumu();
    if (!_dolduruldu) {
      _ad.text = v.ad;
      _alan = v.alan;
      _hedef = v.gunlukHedef;
      _sinav = v.sinavTarihi;
      _dolduruldu = true;
    }
    _durum = d;
    return (v, d);
  }

  Future<void> _kaydet() async {
    if (_kaydediliyor) return;
    setState(() {
      _kaydediliyor = true;
      _mesaj = null;
    });
    try {
      final ad = _ad.text.trim();
      await _profil.kaydet({'name': ad.length > 60 ? ad.substring(0, 60) : ad, 'alan': _alan, 'gunluk': _hedef, 'examDate': _sinav});
      if (mounted) {
        setState(() {
          _mesaj = 'Kaydedildi. Siteyle aynı profil güncellendi.';
          _mesajHata = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _mesaj = 'Kaydedilemedi: ${hataMetni(e)}';
          _mesajHata = true;
        });
      }
    } finally {
      if (mounted) setState(() => _kaydediliyor = false);
    }
  }

  Future<void> _tarihSec() async {
    final p = _sinav.split('-').map(int.parse).toList();
    final simdi = DateTime.now();
    final r = await showDatePicker(
      context: context,
      initialDate: DateTime(p[0], p[1], p[2]),
      firstDate: DateTime(simdi.year - 1),
      lastDate: DateTime(simdi.year + 3),
      helpText: 'Sınav tarihi',
    );
    if (r != null) setState(() => _sinav = HesapVerisi.gunAnahtari(r));
  }

  Future<void> _kodBagla() async {
    final k = _kod.text.trim();
    if (k.isEmpty || _kodBekliyor) return;
    setState(() {
      _kodBekliyor = true;
      _kodHatasi = null;
    });
    try {
      final d = await model.api.kodBagla(k);
      if (mounted) {
        _kod.clear();
        setState(() => _durum = d);
      }
    } catch (e) {
      if (mounted) setState(() => _kodHatasi = e is ApiHata && (e.tur == HataTuru.ag || e.tur == HataTuru.cokIstek) ? hataMetni(e) : 'Kod hatalı, süresi dolmuş ya da başka hesapta kullanılmış.');
    } finally {
      if (mounted) setState(() => _kodBekliyor = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    return ListenableBuilder(
      listenable: model,
      builder: (context, _) {
        final ad = model.kullanici?.ad.trim() ?? '';
        final eposta = model.kullanici?.eposta ?? '';
        final baslik = ad.isNotEmpty ? ad : eposta;
        final bas = baslik.isEmpty ? '?' : baslik.substring(0, 1).toUpperCase();
        return FutureBuilder<(HesapVerisi, HesapDurumu)>(
          future: _f,
          builder: (context, s) {
            final yuklendi = s.connectionState == ConnectionState.done && !s.hasError;
            final d = _durum;
            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
              children: [
                const Text('Ayarlar ve hesap', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, height: 1.15)),
                const SizedBox(height: 14),
                KartKutu(
                  child: Row(children: [
                    Container(width: 48, height: 48, alignment: Alignment.center, decoration: BoxDecoration(color: AkeTok.acik.mercanAcik, shape: BoxShape.circle), child: Text(bas, style: const TextStyle(color: AkeTok.murekkepSabit, fontWeight: FontWeight.w700, fontSize: 18))),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(baslik, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                        if (ad.isNotEmpty && eposta.isNotEmpty) Text(eposta, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: t.murekkep2, fontSize: 13)),
                        Text(d == null ? 'Hesap durumu okunuyor…' : (d.paketli ? 'Paketli hesap${d.bitis.isEmpty ? '' : ' · ${d.bitis} tarihine kadar'}' : 'Ücretsiz hesap'), style: TextStyle(color: t.murekkep3, fontSize: 12.5)),
                      ]),
                    ),
                  ]),
                ),
                const SizedBox(height: 14),
                if (s.connectionState != ConnectionState.done)
                  const KartKutu(child: Row(children: [SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)), SizedBox(width: 12), Flexible(child: Text('Profilin getiriliyor…'))]))
                else if (s.hasError)
                  KartKutu(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('Profil getirilemedi: ${hataMetni(s.error!)}', style: TextStyle(color: t.uyari)),
                      const SizedBox(height: 10),
                      AkeDugme('Tekrar dene', tur: DugmeTuru.cizgili, genis: false, basinca: () {
                        setState(() {
                          _f = _yukle();
                        });
                      }),
                    ]),
                  )
                else if (yuklendi) _profilKarti(t),
                const SizedBox(height: 14),
                if (d != null) AkeDugme('Paketleri gör', key: const ValueKey('ayar-paketler'), tur: DugmeTuru.cizgili, simge: Icons.workspace_premium_rounded, basinca: () => model.menuyeGit(MenuSayfasi.paket)),
                if (d != null) const SizedBox(height: 14),
                if (d != null && !d.paketli) _kodKarti(t),
                if (d != null && !d.paketli) const SizedBox(height: 14),
                KartKutu(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Text('Görünüm', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 12),
                    _TemaSecici(model: model),
                  ]),
                ),
                const SizedBox(height: 14),
                KartKutu(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Text('Hesap', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 6),
                    Text('Bildirim ayarları mobilde henüz yok.', style: TextStyle(color: t.murekkep2, height: 1.4)),
                    const SizedBox(height: 14),
                    AkeDugme('Çıkış yap', tur: DugmeTuru.cizgili, simge: Icons.logout_rounded, basinca: () => _cikisSor(context)),
                    const SizedBox(height: 10),
                    AkeDugme('Hesabımı sil', key: const ValueKey('hesap-sil'), tur: DugmeTuru.cizgili, simge: Icons.delete_forever_rounded, basinca: () => _silSor(context)),
                  ]),
                ),
                const SizedBox(height: 18),
                Center(child: Text('AKE Akademi · test sürümü · sunucu: ${Yapilandirma.apiKisa()}', textAlign: TextAlign.center, style: TextStyle(color: t.murekkep3, fontSize: 12))),
              ],
            );
          },
        );
      },
    );
  }

  Widget _profilKarti(AkeTok t) {
    Widget chip(String ad, bool secili, VoidCallback f, String anahtar) => Semantics(
          button: true,
          selected: secili,
          label: ad,
          child: ExcludeSemantics(
            child: AkeDokun(
              basinca: f,
              child: Container(
                key: ValueKey(anahtar),
                constraints: const BoxConstraints(minHeight: 44, minWidth: 56),
                padding: const EdgeInsets.symmetric(horizontal: 12),
                alignment: Alignment.center,
                decoration: BoxDecoration(color: secili ? t.girinti : t.kart, borderRadius: BorderRadius.circular(12), border: Border.all(color: secili ? t.murekkep : t.cizgi, width: secili ? 1.6 : 1)),
                child: Text(ad, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: secili ? t.murekkep : t.murekkep2)),
              ),
            ),
          ),
        );
    return KartKutu(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Profil ve hedef', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
        const SizedBox(height: 12),
        TextField(key: const ValueKey('profil-ad'), controller: _ad, maxLength: 60, decoration: const InputDecoration(labelText: 'Adın', border: OutlineInputBorder(), counterText: '')),
        const SizedBox(height: 12),
        Text('Alanın', style: TextStyle(color: t.murekkep2, fontWeight: FontWeight.w700, fontSize: 13)),
        const SizedBox(height: 6),
        Wrap(spacing: 6, runSpacing: 6, children: [for (final e in alanAdlari.entries) chip(e.value, _alan == e.key, () => setState(() => _alan = e.key), 'alan-${e.key}')]),
        const SizedBox(height: 12),
        Text('Günlük soru hedefi', style: TextStyle(color: t.murekkep2, fontWeight: FontWeight.w700, fontSize: 13)),
        const SizedBox(height: 6),
        Wrap(spacing: 6, runSpacing: 6, children: [for (final h in [20, 30, 40, 60, 80, 100]) chip('$h', _hedef == h, () => setState(() => _hedef = h), 'hedef-$h')]),
        const SizedBox(height: 12),
        Text('Sınav tarihi', style: TextStyle(color: t.murekkep2, fontWeight: FontWeight.w700, fontSize: 13)),
        const SizedBox(height: 6),
        AkeDugme(_sinav.split('-').reversed.join('.'), key: const ValueKey('profil-tarih'), tur: DugmeTuru.cizgili, simge: Icons.event_rounded, basinca: _tarihSec),
        const SizedBox(height: 14),
        AkeDugme(_kaydediliyor ? 'Kaydediliyor…' : 'Kaydet', key: const ValueKey('profil-kaydet'), basinca: _kaydediliyor ? null : _kaydet),
        if (_mesaj != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text(_mesaj!, style: TextStyle(color: _mesajHata ? t.yanlis : t.dogru, fontWeight: FontWeight.w600))),
      ]),
    );
  }

  Widget _kodKarti(AkeTok t) {
    return KartKutu(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Erişim kodu', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
        const SizedBox(height: 6),
        Text('Paket erişim kodun varsa hesabına bağla; AI öğretmen ve sınırsız soru açılır.', style: TextStyle(color: t.murekkep2, height: 1.4)),
        const SizedBox(height: 12),
        TextField(key: const ValueKey('ayar-kod'), controller: _kod, textCapitalization: TextCapitalization.characters, autocorrect: false, enableSuggestions: false, decoration: const InputDecoration(labelText: 'Kod', border: OutlineInputBorder())),
        if (_kodHatasi != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(_kodHatasi!, style: TextStyle(color: t.yanlis))),
        const SizedBox(height: 12),
        AkeDugme(_kodBekliyor ? 'Bağlanıyor…' : 'Kodu bağla', tur: DugmeTuru.cizgili, basinca: _kodBekliyor ? null : _kodBagla),
      ]),
    );
  }

  Future<void> _cikisSor(BuildContext context) async {
    final onay = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Çıkış yapılsın mı?'),
        content: const Text('İlerlemen hesabında durur; tekrar giriş yapınca kaldığın yerden devam edersin.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(c).pop(false), child: const Text('Vazgeç')),
          TextButton(onPressed: () => Navigator.of(c).pop(true), child: const Text('Çıkış yap')),
        ],
      ),
    );
    if (onay == true) await model.cikis();
  }

  /// Hesap silme: sunucuda KALICI ve geri alınamaz. Kullanıcı "SİL" yazıp açıkça onaylamadan istek gönderilmez.
  Future<void> _silSor(BuildContext context) async {
    final onay = await showDialog<bool>(context: context, builder: (c) => const _SilOnayi());
    if (onay != true) return;
    try {
      await model.hesapSil();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(this.context).showSnackBar(SnackBar(content: Text('Hesap silinemedi: ${hataMetni(e)} Hesabın silinmedi.')));
    }
  }
}

class _SilOnayi extends StatefulWidget {
  const _SilOnayi();
  @override
  State<_SilOnayi> createState() => _SilOnayiState();
}

class _SilOnayiState extends State<_SilOnayi> {
  final TextEditingController _c = TextEditingController();
  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    final tamam = _sade(_c.text) == 'SIL';
    return AlertDialog(
      title: const Text('Hesabın silinsin mi?'),
      content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Hesabın ve hesabında saklanan tüm çalışma verilerin sunucudan kalıcı olarak silinir. Bu işlem geri alınamaz. Hesabına bağlı paket kodu başka hesapta kullanılabilir hâle gelmeyebilir.'),
        const SizedBox(height: 12),
        Text('Onaylamak için SİL yaz.', style: TextStyle(color: t.murekkep2, fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        TextField(key: const ValueKey('sil-yaz'), controller: _c, autofocus: true, autocorrect: false, enableSuggestions: false, textCapitalization: TextCapitalization.characters, decoration: const InputDecoration(border: OutlineInputBorder()), onChanged: (_) => setState(() {})),
      ])),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Vazgeç')),
        TextButton(key: const ValueKey('sil-onay'), onPressed: tamam ? () => Navigator.of(context).pop(true) : null, child: Text('Hesabı kalıcı sil', style: TextStyle(color: tamam ? t.yanlis : null))),
      ],
    );
  }
}

class _TemaSecici extends StatelessWidget {
  final UygulamaModeli model;
  const _TemaSecici({required this.model});
  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    Widget secenek(String ad, IconData ic, ThemeMode m) {
      final secili = model.tema == m;
      return Expanded(
        child: Semantics(
          selected: secili,
          button: true,
          label: 'Tema: $ad',
          child: ExcludeSemantics(
            child: AkeDokun(
              basinca: () => model.temaDegistir(m),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                height: 52,
                margin: const EdgeInsets.symmetric(horizontal: 3),
                decoration: BoxDecoration(
                  color: secili ? t.mercanYumusak : t.kart,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: secili ? t.mercan : t.cizgiGuclu, width: secili ? 2 : 1),
                ),
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Icon(ic, size: 18, color: secili ? t.mercan : t.murekkep2),
                  const SizedBox(width: 6),
                  Flexible(child: Text(ad, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: secili ? t.mercan : t.murekkep))),
                ]),
              ),
            ),
          ),
        ),
      );
    }

    return Row(children: [
      secenek('Sistem', Icons.brightness_auto_rounded, ThemeMode.system),
      secenek('Açık', Icons.light_mode_outlined, ThemeMode.light),
      secenek('Koyu', Icons.dark_mode_outlined, ThemeMode.dark),
    ]);
  }
}
