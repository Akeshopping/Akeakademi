import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../durum/uygulama.dart';
import '../veri/api.dart';
import '../veri/ilerleme.dart';
import '../veri/katalog.dart';
import '../veri/modeller.dart';
import 'ortak.dart';
import 'tema.dart';

enum _Evre { yukleniyor, hata, bos, soru }

const _harfler = ['A', 'B', 'C', 'D', 'E'];

/// Bir soru oturumu: sunucudan oturum açılır, sorular cevapsız gelir, şık seçilip gönderilince sunucu doğru/yanlış ve açıklamayı döner.
class SoruEkrani extends StatefulWidget {
  final UygulamaModeli model;
  final String ders;
  final String? konu;
  final int adet;
  const SoruEkrani({super.key, required this.model, required this.ders, this.konu, this.adet = 10});
  @override
  State<SoruEkrani> createState() => _SoruEkraniState();
}

class _SoruEkraniState extends State<SoruEkrani> {
  _Evre _evre = _Evre.yukleniyor;
  Object? _hata;
  OturumYaniti? _oturum;
  int _sira = 0;
  int? _secili;
  CevapSonucu? _sonuc; // geçerli sorunun sonucu (cevaplandıysa)
  bool _gonderiliyor = false;
  Object? _cevapHatasi;
  final ScrollController _kaydirma = ScrollController();
  final GlobalKey _geriBildirimAnahtari = GlobalKey();

  /// Bu soru oturumu denemesinin kimliği: ağ hatasında "Tekrar dene" AYNI kimlikle gider; yanıt kaybolduysa sunucu aynı oturumu döner,
  /// ikinci kota kullanımı olmaz. Yeni oturum ("Yeni 10 soru") yeni ekran = yeni kimlik.
  final String _istekKimligi = UygulamaModeli.yeniIstekKimligi();

  /// Kayıtlar, ekran açıldığındaki hesaba bağlanır (oturum başka hesaba geçse bile bu hesap dışında yazılamaz).
  late final String _hesapId = widget.model.kullanici?.id ?? '';

  AkeApi get _api => widget.model.api;

  @override
  void initState() {
    super.initState();
    _baslat();
  }

  @override
  void dispose() {
    _kaydirma.dispose();
    super.dispose();
  }

  Future<void> _baslat() async {
    setState(() {
      _evre = _Evre.yukleniyor;
      _hata = null;
    });
    try {
      final o = await _api.oturumOlustur(istek: _istekKimligi, adet: widget.adet, ders: widget.ders, konu: widget.konu);
      if (!mounted) return;
      setState(() {
        _oturum = o;
        _sira = 0;
        _secili = null;
        _sonuc = null;
        _evre = o.sorular.isEmpty ? _Evre.bos : _Evre.soru;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _hata = e;
        _evre = _hataBosMu(e) ? _Evre.bos : _Evre.hata;
      });
    }
  }

  bool _hataBosMu(Object e) => e is ApiHata && e.tur == HataTuru.sunucu && e.kod == 'banka_yok';

  Future<void> _cevapla() async {
    final o = _oturum, secim = _secili;
    if (o == null || secim == null || _gonderiliyor || _sonuc != null) return;
    final soru = o.sorular[_sira];
    setState(() {
      _gonderiliyor = true;
      _cevapHatasi = null;
    });
    try {
      final r = await _api.cevapVer(oturum: o.oturum, soru: soru.id, secim: secim);
      if (!mounted) return;
      if (_hesapId.isNotEmpty) widget.model.senkron.ekle(hesapId: _hesapId, oturum: o.oturum);
      setState(() {
        _sonuc = r;
      });
      _aciklamayaKay();
    } catch (e) {
      if (mounted) setState(() => _cevapHatasi = e);
    } finally {
      if (mounted) setState(() => _gonderiliyor = false);
    }
  }

  Future<void> _ileri() async {
    final o = _oturum!;
    if (_sira + 1 < o.sorular.length) {
      setState(() {
        _sira++;
        _secili = null;
        _sonuc = null;
        _cevapHatasi = null;
      });
      if (_kaydirma.hasClients) _kaydirma.jumpTo(0);
      return;
    }
    setState(() {
      _gonderiliyor = true;
      _cevapHatasi = null;
    });
    try {
      final s = await _api.bitir(o.oturum);
      if (!mounted) return;
      await Navigator.of(context).pushReplacement(MaterialPageRoute<void>(builder: (_) => SonucEkrani(model: widget.model, sonuc: s, ders: widget.ders, konu: widget.konu)));
    } catch (e) {
      if (mounted) setState(() => _cevapHatasi = e);
    } finally {
      if (mounted) setState(() => _gonderiliyor = false);
    }
  }

  /// Cevaplandıktan sonra geri bildirim kartı görünür alana kayar (uzun açıklamada üst kısmı okunur kalır).
  void _aciklamayaKay() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final c = _geriBildirimAnahtari.currentContext;
      if (!mounted || c == null) return;
      Scrollable.ensureVisible(c, alignment: 0.08, duration: const Duration(milliseconds: 320), curve: Curves.easeOutCubic);
    });
  }

  @override
  Widget build(BuildContext context) {
    final baslik = widget.konu ?? Katalog.dersAdi(widget.ders);
    final o = _oturum;
    final gosterIlerleme = _evre == _Evre.soru && o != null;
    final t = context.ake;
    return AkeSayfa(
      baslik: baslik,
      sag: gosterIlerleme ? Padding(padding: const EdgeInsets.only(right: 8), child: Hap('${_sira + 1}/${o.sorular.length}', zemin: Colors.white.withValues(alpha: 0.1), yazi: AkeTok.porselen)) : null,
      altCubuk: gosterIlerleme
          ? PreferredSize(
              preferredSize: const Size.fromHeight(4),
              child: TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: (_sira + (_sonuc != null ? 1 : 0)) / o.sorular.length),
                duration: const Duration(milliseconds: 320),
                curve: Curves.easeOutCubic,
                builder: (context, v, _) => LinearProgressIndicator(value: v, minHeight: 4, color: t.mercanDeko, backgroundColor: t.ustCubuk),
              ),
            )
          : null,
      govde: _govde(),
      alt: gosterIlerleme ? _altEylem(o) : null,
    );
  }

  Widget _govde() {
    switch (_evre) {
      case _Evre.yukleniyor:
        return const Yukleniyor(metin: 'Sorular hazırlanıyor…');
      case _Evre.bos:
        return DurumKutusu(
          simge: Icons.hourglass_empty,
          baslik: 'Soru bulunamadı',
          aciklama: 'Bu seçim için uygun soru yok. Başka bir konu dene.',
          dugme: 'Geri dön',
          basinca: () => Navigator.of(context).pop(),
        );
      case _Evre.hata:
        final h = _hata;
        if (h is ApiHata && h.tur == HataTuru.limit) {
          return DurumKutusu(
            simge: Icons.lock_clock,
            baslik: 'Ücretsiz hakkın bitti',
            aciklama: 'Bugünkü ücretsiz soru hakkını kullandın. Hakkın yenilendiğinde kaldığın yerden devam edebilirsin.',
            dugme: 'Geri dön',
            basinca: () => Navigator.of(context).pop(),
          );
        }
        if (h is ApiHata && h.tur == HataTuru.oturum) return const Yukleniyor(metin: 'Oturum kontrol ediliyor…');
        return DurumKutusu(
          simge: Icons.cloud_off,
          baslik: 'Sorular açılamadı',
          aciklama: hataMetni(h ?? 'hata'),
          dugme: 'Tekrar dene',
          basinca: _baslat,
          ikinciDugme: 'Geri dön',
          ikinciBasinca: () => Navigator.of(context).pop(),
        );
      case _Evre.soru:
        return _soruGorunumu();
    }
  }

  Widget _soruGorunumu() {
    final t = context.ake;
    final o = _oturum!;
    final soru = o.sorular[_sira];
    final cevaplandi = _sonuc != null;
    final r = dersRengi(context, soru.ders);
    return SingleChildScrollView(
      controller: _kaydirma,
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Wrap(spacing: 8, runSpacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(color: r.zemin, borderRadius: BorderRadius.circular(999)),
            child: Text(Katalog.dersAdi(soru.ders), style: TextStyle(color: r.metin, fontWeight: FontWeight.w700, fontSize: 12.5)),
          ),
          Text('Soru ${_sira + 1} / ${o.sorular.length}', style: TextStyle(color: t.murekkep2, fontWeight: FontWeight.w600, fontSize: 13)),
          _ZorlukNoktalari(zorluk: soru.zorluk),
        ]),
        const SizedBox(height: 6),
        Text(soru.konu, style: TextStyle(color: t.murekkep3, fontSize: 13)),
        const SizedBox(height: 14),
        if (soru.paragraf != null) ...[
          SolSeritKutu(
            serit: t.mercanDeko,
            seritGenisligi: 3,
            renk: t.girinti,
            kenar: Colors.transparent,
            yaricap: 14,
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('OKUMA PARÇASI', style: TextStyle(color: t.mercan, fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.1)),
              const SizedBox(height: 8),
              Text(soru.paragraf!, style: TextStyle(fontFamily: AkeYazi.serif, fontFamilyFallback: const ['AkeSans'], fontSize: 16.5, height: 1.65, color: t.murekkep)),
            ]),
          ),
          const SizedBox(height: 16),
        ],
        Text(soru.metin, style: const TextStyle(fontSize: 17.5, height: 1.5, fontWeight: FontWeight.w600)),
        const SizedBox(height: 18),
        for (var i = 0; i < soru.secenekler.length; i++) ...[
          _SecenekSatiri(
            harf: _harfler[i],
            metin: soru.secenekler[i],
            secili: _secili == i,
            durum: _secenekDurumu(i),
            aktif: !cevaplandi && !_gonderiliyor,
            soluk: cevaplandi && _secenekDurumu(i) == _SecenekDurumu.normal,
            basinca: () {
              HapticFeedback.selectionClick();
              setState(() => _secili = i);
            },
          ),
          const SizedBox(height: 10),
        ],
        if (cevaplandi) ...[
          const SizedBox(height: 6),
          KeyedSubtree(key: _geriBildirimAnahtari, child: _GeriBildirim(sonuc: _sonuc!, secilen: _secili ?? -1)),
        ],
        if (_cevapHatasi != null) ...[
          const SizedBox(height: 12),
          Semantics(liveRegion: true, child: Text(hataMetni(_cevapHatasi!), style: TextStyle(color: t.yanlis, fontWeight: FontWeight.w600))),
        ],
      ]),
    );
  }

  /// Alt eylem alanı: her zaman görünür; cevaplamadan önce "Cevapla", sonra "Sonraki soru" / "Bitir".
  Widget _altEylem(OturumYaniti o) {
    final t = context.ake;
    final cevaplandi = _sonuc != null;
    final son = _sira + 1 == o.sorular.length;
    final secimMetni = _secili == null || cevaplandi ? null : 'Seçimin: ${_harfler[_secili!]}';
    return Container(
      padding: EdgeInsets.fromLTRB(16, 12, 16, 12 + MediaQuery.paddingOf(context).bottom),
      decoration: BoxDecoration(color: t.kart, border: Border(top: BorderSide(color: t.cizgi))),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        if (secimMetni != null) Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(secimMetni, style: TextStyle(color: t.murekkep2, fontSize: 13))),
        cevaplandi
            ? AkeDugme(_gonderiliyor ? 'Bekle…' : (son ? 'Bitir' : 'Sonraki soru'), basinca: _gonderiliyor ? null : _ileri, simge: son ? Icons.flag_rounded : Icons.arrow_forward_rounded)
            : AkeDugme(_gonderiliyor ? 'Gönderiliyor…' : 'Cevapla', basinca: (_secili == null || _gonderiliyor) ? null : _cevapla),
      ]),
    );
  }

  _SecenekDurumu _secenekDurumu(int i) {
    final s = _sonuc;
    if (s == null) return _SecenekDurumu.normal;
    if (i == s.dogruSecenek) return _SecenekDurumu.dogru;
    if (i == _secili && !s.dogru) return _SecenekDurumu.yanlis;
    return _SecenekDurumu.normal;
  }
}

enum _SecenekDurumu { normal, dogru, yanlis }

class _ZorlukNoktalari extends StatelessWidget {
  final int zorluk;
  const _ZorlukNoktalari({required this.zorluk});
  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    final z = zorluk.clamp(1, 3).toInt();
    return Semantics(
      label: 'Zorluk $z / 3',
      child: ExcludeSemantics(
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          for (var i = 1; i <= 3; i++)
            Container(width: 7, height: 7, margin: const EdgeInsets.only(right: 3), decoration: BoxDecoration(shape: BoxShape.circle, color: i <= z ? t.murekkep2 : t.cizgi)),
        ]),
      ),
    );
  }
}

class _SecenekSatiri extends StatelessWidget {
  final String harf;
  final String metin;
  final bool secili;
  final _SecenekDurumu durum;
  final bool aktif;
  final bool soluk;
  final VoidCallback basinca;
  const _SecenekSatiri({required this.harf, required this.metin, required this.secili, required this.durum, required this.aktif, required this.basinca, this.soluk = false});

  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    Color zemin = t.kart, kenar = t.cizgiGuclu, rozetZemin = t.girinti, rozetYazi = t.murekkep2;
    if (durum == _SecenekDurumu.dogru) {
      zemin = t.dogruZemin;
      kenar = t.dogru;
      rozetZemin = t.dogru;
      rozetYazi = t.koyu ? AkeTok.murekkepSabit : Colors.white;
    } else if (durum == _SecenekDurumu.yanlis) {
      zemin = t.yanlisZemin;
      kenar = t.yanlis;
      rozetZemin = t.yanlis;
      rozetYazi = t.koyu ? AkeTok.murekkepSabit : Colors.white;
    } else if (secili) {
      zemin = t.mercanYumusak;
      kenar = t.mercan;
      rozetZemin = t.mercan;
      rozetYazi = t.mercanUstu;
    }
    final vurgulu = secili || durum != _SecenekDurumu.normal;
    final etiket = durum == _SecenekDurumu.dogru ? ', doğru cevap' : (durum == _SecenekDurumu.yanlis ? ', yanlış seçim' : (secili ? ', seçili' : ''));
    return Semantics(
      selected: secili,
      label: '$harf şıkkı: $metin$etiket',
      child: ExcludeSemantics(
        child: AkeDokun(
          basinca: aktif ? basinca : null,
          child: AnimatedOpacity(
            opacity: soluk ? 0.62 : 1,
            duration: const Duration(milliseconds: 200),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              curve: Curves.easeOut,
              constraints: const BoxConstraints(minHeight: 56),
              padding: EdgeInsets.symmetric(horizontal: vurgulu ? 11 : 12, vertical: 10),
              decoration: BoxDecoration(color: zemin, borderRadius: BorderRadius.circular(14), border: Border.all(color: kenar, width: vurgulu ? 2 : 1)),
              child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  width: 32,
                  height: 32,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: rozetZemin, shape: BoxShape.circle),
                  child: durum == _SecenekDurumu.dogru
                      ? Icon(Icons.check_rounded, size: 19, color: rozetYazi)
                      : durum == _SecenekDurumu.yanlis
                          ? Icon(Icons.close_rounded, size: 19, color: rozetYazi)
                          : Text(harf, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: rozetYazi)),
                ),
                const SizedBox(width: 12),
                Expanded(child: Text(metin, style: const TextStyle(fontSize: 16, height: 1.4))),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}

class _GeriBildirim extends StatelessWidget {
  final CevapSonucu sonuc;
  final int secilen;
  const _GeriBildirim({required this.sonuc, required this.secilen});
  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    final d = sonuc.dogru;
    final renk = d ? t.dogru : t.yanlis;
    final harf = (sonuc.dogruSecenek >= 0 && sonuc.dogruSecenek < 5) ? _harfler[sonuc.dogruSecenek] : '?';
    return Semantics(
      liveRegion: true,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: d ? t.dogruZemin : t.yanlisZemin, borderRadius: BorderRadius.circular(16), border: Border.all(color: renk)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Icon(d ? Icons.check_circle_rounded : Icons.cancel_rounded, color: renk),
            const SizedBox(width: 8),
            Expanded(child: Text(d ? 'Doğru!' : 'Yanlış — doğru cevap $harf', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18, color: renk))),
          ]),
          if (sonuc.aciklama != null) ...[
            const SizedBox(height: 10),
            Text('AÇIKLAMA', style: TextStyle(color: t.murekkep3, fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.1)),
            const SizedBox(height: 6),
            Text(sonuc.aciklama!, style: const TextStyle(height: 1.6, fontSize: 15.5)),
          ],
        ]),
      ),
    );
  }
}

/// Oturum sonucu + ilerlemenin hesaba yazılma durumu.
class SonucEkrani extends StatelessWidget {
  final UygulamaModeli model;
  final OturumSonucu sonuc;
  final String ders;
  final String? konu;
  const SonucEkrani({super.key, required this.model, required this.sonuc, required this.ders, this.konu});

  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    final toplam = sonuc.dogru + sonuc.yanlis;
    final oran = toplam == 0 ? 0.0 : sonuc.dogru / toplam;
    return AkeSayfa(
      baslik: 'Sonuç',
      geriGoster: false,
      govde: ListView(padding: const EdgeInsets.fromLTRB(16, 18, 16, 24), children: [
        KartKutu(
          padding: const EdgeInsets.all(22),
          child: Column(children: [
            SizedBox(
              width: 132,
              height: 132,
              child: Stack(alignment: Alignment.center, children: [
                SizedBox(width: 132, height: 132, child: CircularProgressIndicator(value: oran, strokeWidth: 9, strokeCap: StrokeCap.round, color: oran >= 0.5 ? t.dogru : t.mercan, backgroundColor: t.girinti)),
                Column(mainAxisSize: MainAxisSize.min, children: [
                  Text('${sonuc.dogru} / $toplam', style: rakamStili(t.murekkep, 30)),
                  Text('doğru', style: TextStyle(color: t.murekkep2, fontSize: 13)),
                ]),
              ]),
            ),
            const SizedBox(height: 16),
            Text('${sonuc.yanlis} yanlış · ${sonuc.bos} boş', style: TextStyle(color: t.murekkep2)),
          ]),
        ),
        const SizedBox(height: 14),
        ListenableBuilder(
          listenable: model.senkron,
          builder: (context, _) {
            final s = model.senkron;
            if (s.durum == SenkronDurumu.kaydediliyor) {
              return KartKutu(child: Row(children: [SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: t.mercan)), const SizedBox(width: 12), const Expanded(child: Text('İlerlemen hesabına kaydediliyor…'))]));
            }
            if (s.durum == SenkronDurumu.bekliyor) {
              return KartKutu(
                renk: t.uyariZemin,
                kenar: t.uyari,
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('İlerlemen henüz hesabına yazılamadı (${s.bekleyenSayisi} kayıt bekliyor).', style: TextStyle(color: t.uyari, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 4),
                  Text(s.sonHata != null ? hataMetni(s.sonHata!) : '', style: TextStyle(color: t.uyari)),
                  const SizedBox(height: 12),
                  AkeDugme('Tekrar dene', basinca: s.bosalt, tur: DugmeTuru.cizgili, genis: false),
                ]),
              );
            }
            return KartKutu(
              renk: t.dogruZemin,
              kenar: t.dogru,
              child: Row(children: [Icon(Icons.cloud_done_rounded, color: t.dogru), const SizedBox(width: 12), const Expanded(child: Text('İlerlemen hesabına kaydedildi.', style: TextStyle(fontWeight: FontWeight.w600)))]),
            );
          },
        ),
        const SizedBox(height: 20),
        AkeDugme('Yeni 10 soru', basinca: () => Navigator.of(context).pushReplacement(MaterialPageRoute<void>(builder: (_) => SoruEkrani(model: model, ders: ders, konu: konu))), simge: Icons.refresh_rounded),
        const SizedBox(height: 12),
        AkeDugme('Gelişimimi gör', tur: DugmeTuru.cizgili, basinca: () {
          Navigator.of(context).popUntil((r) => r.isFirst);
          model.sekmeGit(2);
        }),
        const SizedBox(height: 8),
        AkeDugme('Ana sayfaya dön', tur: DugmeTuru.metin, basinca: () {
          Navigator.of(context).popUntil((r) => r.isFirst);
          model.sekmeGit(0);
        }),
      ]),
    );
  }
}
