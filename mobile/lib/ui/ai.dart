import 'package:flutter/material.dart';

import '../durum/uygulama.dart';
import '../veri/api.dart';
import '../veri/modeller.dart';
import 'ortak.dart';
import 'tema.dart';

/// Öğretmen rolü: sunucu yalnız mesajları iletir (sistem istemi yok); rol, ilk kullanıcı mesajının başına eklenir ve ekranda gösterilmez.
const aiRolMetni =
    'Sen AKE Akademi\'nin YKS öğretmenisin. Türkçe, kısa ve adım adım anlat; önce yöntemi söyle, sonra çöz. Emin olmadığın yerde öyle söyle. Öğrencinin sorusu:\n';

class _Mesaj {
  final bool ben;
  final String metin;
  final bool hata;
  const _Mesaj(this.ben, this.metin, {this.hata = false});
}

/// "AI" sekmesi: gerçek /api/ai çağrısı. Hesap, paket ve aylık hak SUNUCUDA denetlenir; paket yoksa erişim kodu girilebilir.
/// Görsel yükleme, akış (yazıyor…) ve sohbet geçmişi saklama yok.
class AiSekmesi extends StatefulWidget {
  final UygulamaModeli model;
  const AiSekmesi({super.key, required this.model});
  @override
  State<AiSekmesi> createState() => _AiSekmesiState();
}

class _AiSekmesiState extends State<AiSekmesi> {
  late Future<HesapDurumu> _durum;
  final List<_Mesaj> _mesajlar = [];
  final TextEditingController _girdi = TextEditingController();
  final TextEditingController _kod = TextEditingController();
  final ScrollController _kaydirma = ScrollController();
  bool _bekliyor = false;
  bool _kodGonderiliyor = false;
  String? _kodHatasi;
  HesapDurumu? _guncel;
  late int _sonSekme;
  int _nesil = 0; // yalnız en son başlatılan hesap okuması _guncel'i değiştirir (geç gelen eski yanıt yenisini ezmez)

  @override
  void initState() {
    super.initState();
    _durum = _yukle();
    _sonSekme = widget.model.sekme;
    widget.model.addListener(_sekmeDegisti);
  }

  @override
  void dispose() {
    widget.model.removeListener(_sekmeDegisti);
    _girdi.dispose();
    _kod.dispose();
    _kaydirma.dispose();
    super.dispose();
  }

  void _sekmeDegisti() {
    final yeni = widget.model.sekme;
    if (yeni == _sonSekme) return;
    _sonSekme = yeni;
    if (yeni == 3 && mounted) _yenile(); // Paketler'den dönünce yeni satın alınan erişimi göster.
  }

  Future<HesapDurumu> _yukle() async {
    final n = ++_nesil;
    final d = await widget.model.api.hesapDurumu(beklenenHesap: widget.model.kullanici?.id); // hesap değiştiyse istek hiç atılmaz
    if (n == _nesil && mounted) _guncel = d;
    return d;
  }

  void _yenile() {
    setState(() {
      _durum = _yukle();
    });
  }

  Future<void> _kodBagla() async {
    final k = _kod.text.trim();
    if (k.isEmpty || _kodGonderiliyor) return;
    setState(() {
      _kodGonderiliyor = true;
      _kodHatasi = null;
    });
    try {
      final d = await widget.model.api.kodBagla(k);
      if (!mounted) return;
      _kod.clear();
      setState(() {
        _guncel = d;
        _durum = Future.value(d);
      });
    } catch (e) {
      if (mounted) setState(() => _kodHatasi = e is ApiHata && e.tur == HataTuru.ag ? hataMetni(e) : (e is ApiHata && e.tur == HataTuru.cokIstek ? hataMetni(e) : 'Kod hatalı, süresi dolmuş ya da başka hesapta kullanılmış.'));
    } finally {
      if (mounted) setState(() => _kodGonderiliyor = false);
    }
  }

  Future<void> _gonder([String? hazir]) async {
    final metin = (hazir ?? _girdi.text).trim();
    if (metin.isEmpty || _bekliyor) return;
    _girdi.clear();
    setState(() {
      _mesajlar.add(_Mesaj(true, metin));
      _bekliyor = true;
    });
    _alta();
    // Sunucuya son 20 mesaj gider; rol metni ilk kullanıcı mesajının başına eklenir.
    final gecmis = _mesajlar.where((m) => !m.hata).toList();
    final son = gecmis.length > 20 ? gecmis.sublist(gecmis.length - 20) : gecmis;
    final govde = <Map<String, String>>[
      for (var i = 0; i < son.length; i++) {'role': son[i].ben ? 'user' : 'assistant', 'content': (i == 0 && son[i].ben ? aiRolMetni : '') + son[i].metin},
    ];
    try {
      final y = await widget.model.api.aiSor(mesajlar: govde);
      if (!mounted) return;
      setState(() => _mesajlar.add(_Mesaj(false, y.metin.isEmpty ? 'Yanıt boş geldi. Tekrar dene.' : (y.kesildi ? '${y.metin}\n\n(Yanıt uzun olduğu için kesildi.)' : y.metin), hata: y.metin.isEmpty)));
      widget.model.api.hesapDurumu().then((d) {
        if (mounted) setState(() => _guncel = d);
      }).catchError((Object _) {});
    } catch (e) {
      if (!mounted) return;
      var m = hataMetni(e);
      if (e is ApiHata) {
        if (e.tur == HataTuru.limit) {
          _yenile();
          m = 'AI öğretmen paketli hesaplar içindir. Aşağıdan erişim kodunu bağlayabilirsin.';
        } else if (e.tur == HataTuru.cokIstek) {
          m = e.kod == 'kota' ? 'Bu ayki AI mesaj hakkın doldu.' : 'Çok hızlı gönderdin. Biraz sonra tekrar dene.';
        } else if (e.tur == HataTuru.sunucu) {
          m = 'AI şu an yanıt veremiyor. Biraz sonra tekrar dene.';
        }
      }
      setState(() => _mesajlar.add(_Mesaj(false, m, hata: true)));
    } finally {
      if (mounted) setState(() => _bekliyor = false);
      _alta();
    }
  }

  void _alta() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_kaydirma.hasClients) _kaydirma.animateTo(_kaydirma.position.maxScrollExtent, duration: const Duration(milliseconds: 200), curve: Curves.easeOut);
    });
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<HesapDurumu>(
      future: _durum,
      builder: (context, s) {
        if (s.connectionState != ConnectionState.done && _guncel == null) return const Yukleniyor(metin: 'AI öğretmen hazırlanıyor…');
        if (s.hasError && _guncel == null) return DurumKutusu(simge: Icons.cloud_off, baslik: 'Yüklenemedi', aciklama: hataMetni(s.error!), dugme: 'Tekrar dene', basinca: _yenile);
        final d = _guncel ?? s.data!;
        return d.paketli ? _sohbet(context, d) : _kapi(context);
      },
    );
  }

  Widget _kapi(BuildContext context) {
    final t = context.ake;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
      children: [
        const Text('AI öğretmen', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, height: 1.15)),
        const SizedBox(height: 14),
        KartKutu(
          key: const ValueKey('ai-kapi'),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Container(width: 44, height: 44, decoration: BoxDecoration(color: t.mercanYumusak, borderRadius: BorderRadius.circular(12)), child: Icon(Icons.auto_awesome_rounded, color: t.mercan)),
              const SizedBox(width: 12),
              const Expanded(child: Text('Paketli hesaplara açık', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700))),
            ]),
            const SizedBox(height: 10),
            Text('AI öğretmenle konu çalışabilir ve sorularını sorabilirsin. Aylık mesaj hakkı pakete göre değişir; Paketler ekranında güncel hakkı görürsün.', style: TextStyle(color: t.murekkep2, height: 1.45)),
            const SizedBox(height: 14),
            AkeDugme('Paketleri gör', key: const ValueKey('ai-paketler'), basinca: () => widget.model.menuyeGit(MenuSayfasi.paket)),
            const SizedBox(height: 18),
            Text('Erişim kodun varsa hesabına bağla:', style: TextStyle(color: t.murekkep2)),
            const SizedBox(height: 10),
            TextField(
              key: const ValueKey('ai-kod'),
              controller: _kod,
              textCapitalization: TextCapitalization.characters,
              autocorrect: false,
              enableSuggestions: false,
              decoration: const InputDecoration(labelText: 'Erişim kodu', border: OutlineInputBorder()),
              onSubmitted: (_) => _kodBagla(),
            ),
            if (_kodHatasi != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(_kodHatasi!, style: TextStyle(color: t.yanlis))),
            const SizedBox(height: 12),
            AkeDugme(_kodGonderiliyor ? 'Bağlanıyor…' : 'Kodu bağla', basinca: _kodGonderiliyor ? null : _kodBagla),
          ]),
        ),
      ],
    );
  }

  Widget _sohbet(BuildContext context, HesapDurumu d) {
    final t = context.ake;
    final kalan = d.aiMesajLimit - d.aiMesaj;
    const oneriler = ['Türevde zincir kuralını bir örnekle anlat', 'Paragraf sorularında nasıl hızlanırım?', 'Bugün ne çalışmalıyım?', 'Mol kavramını sıfırdan anlat', 'Divan edebiyatı nazım şekillerini özetle', 'Present perfect ile past simple farkı ne?'];
    return Column(children: [
      Expanded(
        child: ListView(
          controller: _kaydirma,
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
          children: [
            Row(children: [
              const Expanded(child: Text('AI öğretmen', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, height: 1.15))),
              if (d.aiMesajLimit > 0) Hap('${kalan < 0 ? 0 : kalan} mesaj hakkı'),
            ]),
            const SizedBox(height: 12),
            if (_mesajlar.isEmpty) ...[
              Text('Takıldığın soruyu yaz; konu anlatımı, çözüm adımları ve çalışma önerisi iste. Öğretmen alanını ve zayıf konularını bilir. Cevaplar yapay zekâ ile üretilir; önemli yerleri kendin de kontrol et.', style: TextStyle(color: t.murekkep2, height: 1.45)),
              const SizedBox(height: 12),
              Text('Şunlardan biriyle başlayabilirsin:', key: const ValueKey('ai-oneri-baslik'), style: TextStyle(color: t.murekkep2, fontSize: 13, fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              Wrap(spacing: 8, runSpacing: 8, children: [
                for (final o in oneriler)
                  Semantics(
                    button: true,
                    label: o,
                    child: ExcludeSemantics(
                      child: AkeDokun(
                        basinca: () => _girdi.text = o,
                        child: Container(padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14), decoration: BoxDecoration(color: t.kart, borderRadius: BorderRadius.circular(12), border: Border.all(color: t.cizgi)), child: Text(o, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5))),
                      ),
                    ),
                  ),
              ]),
            ],
            for (final m in _mesajlar)
              Align(
                alignment: m.ben ? Alignment.centerRight : Alignment.centerLeft,
                child: Container(
                  margin: const EdgeInsets.only(bottom: 10, left: 28, right: 0),
                  constraints: const BoxConstraints(maxWidth: 520),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: m.hata ? t.uyariZemin : (m.ben ? t.girinti : t.kart),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: m.hata ? t.uyari : t.cizgi),
                  ),
                  child: SelectableText(m.metin, style: TextStyle(height: 1.5, color: m.hata ? t.uyari : t.murekkep)),
                ),
              ),
            if (_bekliyor)
              Padding(padding: const EdgeInsets.only(bottom: 10), child: Row(children: [SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: t.mercan)), const SizedBox(width: 10), Text('Öğretmen yazıyor…', style: TextStyle(color: t.murekkep2))])),
          ],
        ),
      ),
      Container(
        decoration: BoxDecoration(color: t.kart, border: Border(top: BorderSide(color: t.cizgi))),
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Expanded(
            child: TextField(
              key: const ValueKey('ai-girdi'),
              controller: _girdi,
              minLines: 1,
              maxLines: 5,
              maxLength: 4000,
              textInputAction: TextInputAction.newline,
              decoration: const InputDecoration(hintText: 'Sorunu yaz…', border: OutlineInputBorder(), counterText: ''),
            ),
          ),
          const SizedBox(width: 8),
          Semantics(
            button: true,
            label: 'Gönder',
            child: AkeDokun(
              basinca: _bekliyor ? null : () => _gonder(),
              child: Container(key: const ValueKey('ai-gonder'), width: 52, height: 52, decoration: BoxDecoration(color: _bekliyor ? t.girinti : t.mercan, borderRadius: BorderRadius.circular(14)), child: Icon(Icons.arrow_upward_rounded, color: _bekliyor ? t.murekkep3 : t.mercanUstu)),
            ),
          ),
          ]),
          if (d.aiMesajLimit > 0)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Align(alignment: Alignment.centerLeft, child: Text('Bu ay ${kalan < 0 ? 0 : kalan} mesaj hakkın kaldı. Soru sorduğunda kullanılır.', key: const ValueKey('ai-kota-notu'), style: TextStyle(color: t.murekkep3, fontSize: 12.5))),
            ),
        ]),
      ),
    ]);
  }
}
