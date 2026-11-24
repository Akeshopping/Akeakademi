import 'package:flutter/material.dart';

import '../durum/uygulama.dart';
import '../veri/api.dart';
import '../veri/ilerleme.dart';
import '../veri/katalog.dart';
import '../veri/modeller.dart';
import 'ilerleme_ekrani.dart';
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

  @override
  Widget build(BuildContext context) {
    final baslik = widget.konu ?? Katalog.dersAdi(widget.ders);
    return Scaffold(
      appBar: AppBar(title: Text(baslik, overflow: TextOverflow.ellipsis)),
      body: SafeArea(child: _govde()),
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
    final o = _oturum!;
    final soru = o.sorular[_sira];
    final cevaplandi = _sonuc != null;
    final son = _sira + 1 == o.sorular.length;
    return Column(children: [
      LinearProgressIndicator(value: (_sira + (cevaplandi ? 1 : 0)) / o.sorular.length, minHeight: 4, color: AkeRenk.mercan, backgroundColor: AkeRenk.cizgi),
      Expanded(
        child: ListView(padding: const EdgeInsets.all(16), children: [
          Text('Soru ${_sira + 1} / ${o.sorular.length}', style: const TextStyle(color: AkeRenk.murekkep2, fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text(soru.konu, style: const TextStyle(color: AkeRenk.murekkep2, fontSize: 13)),
          const SizedBox(height: 12),
          if (soru.paragraf != null) ...[
            KartKutu(renk: AkeRenk.girinti, child: Text(soru.paragraf!, style: const TextStyle(height: 1.5))),
            const SizedBox(height: 12),
          ],
          Text(soru.metin, style: const TextStyle(fontSize: 17, height: 1.5, fontWeight: FontWeight.w600)),
          const SizedBox(height: 16),
          for (var i = 0; i < soru.secenekler.length; i++) ...[
            _SecenekSatiri(
              harf: _harfler[i],
              metin: soru.secenekler[i],
              secili: _secili == i,
              durum: _secenekDurumu(i),
              aktif: !cevaplandi && !_gonderiliyor,
              basinca: () => setState(() => _secili = i),
            ),
            const SizedBox(height: 8),
          ],
          if (cevaplandi) ...[
            const SizedBox(height: 8),
            _GeriBildirim(sonuc: _sonuc!, secilen: _secili ?? -1),
          ],
          if (_cevapHatasi != null) ...[
            const SizedBox(height: 12),
            Semantics(liveRegion: true, child: Text(hataMetni(_cevapHatasi!), style: const TextStyle(color: AkeRenk.yanlis, fontWeight: FontWeight.w600))),
          ],
        ]),
      ),
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
        child: cevaplandi
            ? FilledButton(onPressed: _gonderiliyor ? null : _ileri, child: Text(_gonderiliyor ? 'Bekle…' : (son ? 'Bitir' : 'Sonraki soru')))
            : FilledButton(onPressed: (_secili == null || _gonderiliyor) ? null : _cevapla, child: Text(_gonderiliyor ? 'Gönderiliyor…' : 'Cevapla')),
      ),
    ]);
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

class _SecenekSatiri extends StatelessWidget {
  final String harf;
  final String metin;
  final bool secili;
  final _SecenekDurumu durum;
  final bool aktif;
  final VoidCallback basinca;
  const _SecenekSatiri({required this.harf, required this.metin, required this.secili, required this.durum, required this.aktif, required this.basinca});
  @override
  Widget build(BuildContext context) {
    Color zemin = AkeRenk.kart, kenar = AkeRenk.cizgiGuclu;
    if (durum == _SecenekDurumu.dogru) {
      zemin = AkeRenk.dogruZemin;
      kenar = AkeRenk.dogru;
    } else if (durum == _SecenekDurumu.yanlis) {
      zemin = AkeRenk.yanlisZemin;
      kenar = AkeRenk.yanlis;
    } else if (secili) {
      zemin = AkeRenk.mercanYumusak;
      kenar = AkeRenk.mercan;
    }
    final etiket = durum == _SecenekDurumu.dogru ? ', doğru cevap' : (durum == _SecenekDurumu.yanlis ? ', yanlış seçim' : (secili ? ', seçili' : ''));
    return Semantics(
      button: true,
      selected: secili,
      label: '$harf şıkkı: $metin$etiket',
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: aktif ? basinca : null,
        child: Container(
          constraints: const BoxConstraints(minHeight: 52),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(color: zemin, borderRadius: BorderRadius.circular(14), border: Border.all(color: kenar, width: secili || durum != _SecenekDurumu.normal ? 2 : 1)),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('$harf)', style: TextStyle(fontWeight: FontWeight.w800, color: kenar == AkeRenk.cizgiGuclu ? AkeRenk.murekkep2 : kenar)),
            const SizedBox(width: 10),
            Expanded(child: Text(metin, style: const TextStyle(fontSize: 16, height: 1.4))),
            if (durum == _SecenekDurumu.dogru) const Icon(Icons.check_circle, color: AkeRenk.dogru),
            if (durum == _SecenekDurumu.yanlis) const Icon(Icons.cancel, color: AkeRenk.yanlis),
          ]),
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
    final d = sonuc.dogru;
    final harf = (sonuc.dogruSecenek >= 0 && sonuc.dogruSecenek < 5) ? _harfler[sonuc.dogruSecenek] : '?';
    return Semantics(
      liveRegion: true,
      child: KartKutu(
        renk: d ? AkeRenk.dogruZemin : AkeRenk.yanlisZemin,
        kenar: d ? AkeRenk.dogru : AkeRenk.yanlis,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(d ? 'Doğru!' : 'Yanlış — doğru cevap $harf', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 17, color: d ? AkeRenk.dogru : AkeRenk.yanlis)),
          if (sonuc.aciklama != null) ...[
            const SizedBox(height: 8),
            Text(sonuc.aciklama!, style: const TextStyle(height: 1.5)),
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
    final toplam = sonuc.dogru + sonuc.yanlis;
    return Scaffold(
      appBar: AppBar(title: const Text('Sonuç'), automaticallyImplyLeading: false),
      body: SafeArea(
        child: ListView(padding: const EdgeInsets.all(20), children: [
          KartKutu(
            child: Column(children: [
              Text('${sonuc.dogru} / $toplam', style: const TextStyle(fontSize: 44, fontWeight: FontWeight.w800)),
              const Text('doğru', style: TextStyle(color: AkeRenk.murekkep2)),
              const SizedBox(height: 12),
              Text('${sonuc.yanlis} yanlış · ${sonuc.bos} boş', style: const TextStyle(color: AkeRenk.murekkep2)),
            ]),
          ),
          const SizedBox(height: 16),
          ListenableBuilder(
            listenable: model.senkron,
            builder: (context, _) {
              final s = model.senkron;
              if (s.durum == SenkronDurumu.kaydediliyor) {
                return const KartKutu(child: Row(children: [SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)), SizedBox(width: 12), Text('İlerlemen hesabına kaydediliyor…')]));
              }
              if (s.durum == SenkronDurumu.bekliyor) {
                return KartKutu(
                  renk: AkeRenk.uyariZemin,
                  kenar: AkeRenk.uyari,
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('İlerlemen henüz hesabına yazılamadı (${s.bekleyenSayisi} kayıt bekliyor).', style: const TextStyle(color: AkeRenk.uyari, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 4),
                    Text(s.sonHata != null ? hataMetni(s.sonHata!) : '', style: const TextStyle(color: AkeRenk.uyari)),
                    const SizedBox(height: 12),
                    OutlinedButton(onPressed: s.bosalt, child: const Text('Tekrar dene')),
                  ]),
                );
              }
              return const KartKutu(renk: AkeRenk.dogruZemin, kenar: AkeRenk.dogru, child: Row(children: [Icon(Icons.cloud_done, color: AkeRenk.dogru), SizedBox(width: 12), Expanded(child: Text('İlerlemen hesabına kaydedildi.', style: TextStyle(color: AkeRenk.dogru, fontWeight: FontWeight.w600)))]));
            },
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: () => Navigator.of(context).pushReplacement(MaterialPageRoute<void>(builder: (_) => SoruEkrani(model: model, ders: ders, konu: konu))),
            child: const Text('Yeni 10 soru'),
          ),
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => IlerlemeEkrani(senkron: model.senkron))),
            child: const Text('Hesabımdaki ilerleme'),
          ),
          const SizedBox(height: 12),
          TextButton(onPressed: () => Navigator.of(context).popUntil((r) => r.isFirst), child: const Text('Ana ekrana dön')),
        ]),
      ),
    );
  }
}
