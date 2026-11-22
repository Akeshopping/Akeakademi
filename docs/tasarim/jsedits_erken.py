# Satışı erken erişim listesine çevirir: "Ön sipariş / Satın al / Ödemeye geç" yok; "Açıldığında haber ver" var.
# Ödeme alınmaz, sipariş oluşmaz, paket ya da fiyat garantisi verilmez. Ücretsiz üyelik, erişim kodu etkinleştirme, Shopier webhook'u,
# sipariş bildirimleri ve kod teslimi (sunucu tarafı) BU DOSYADA DEĞİŞMEZ. İstemcide Shopier ürün bağlantısı hiçbir yerde kullanılmaz.

# 1) vPremium: satın alma akışı kalktı; paket kartları + liste formu
_a = src.index('function vPremium() {'); _b = src.index('/* Yasal metinler */', _a)
_YENI = r'''/* ---- Erken erişim listesi: ücretli paketler henüz satışta değil, ödeme alınmaz ---- */
const LISTE_NOT = "Ödeme alınmaz, sipariş oluşmaz; paket ya da fiyat garantisi verilmez.";
const LISTE_RE = /^[^\s@,;<>()[\]\\"]{1,64}@[^\s@,;<>()[\]\\"]{1,190}\.[A-Za-z]{2,24}$/;
const LISTE_HATA = { eposta_gecersiz: "E-posta adresi geçerli görünmüyor. Örnek: ad@ornek.com", izin_yok: "Haber verilmesi için onay kutusunu işaretlemelisin.", cok_istek: "Çok fazla deneme yaptın. Biraz sonra tekrar dene.", eposta_gitmedi: "Onay e-postası gönderilemedi. Biraz sonra tekrar dene.", yapilandirma: "Liste şu an kullanılamıyor. Biraz sonra tekrar dene." };
function listeDurum() { return UI.liste || (UI.liste = { eposta: "", paket: "ikisi", izin: false, busy: false, err: "", alan: "", ok: false, gonderilen: "", sil: false, silE: "", silBusy: false, silMsg: "", silErr: "" }); }
function listeKart() {
  if (IN_CLAUDE) return "";
  const L = listeDurum();
  if (L.ok) return `<div class="card stack liste liste-ok" id="liste" role="status"><span class="pill ok" style="align-self:flex-start">Son adım</span><h2>Kaydını aldık</h2>
    <p><b>${esc(L.gonderilen)}</b> için isteğini aldık. Onay gerekiyorsa adrese bir e-posta gönderdik; içindeki “İsteğimi onayla” düğmesine basınca kaydın tamamlanır. Gelmediyse spam klasörüne de bak. Daha önce onayladıysan başka bir şey yapma.</p>
    <p class="xs muted">Onaylamazsan hiçbir şey olmaz ve kaydın silinir. ${LISTE_NOT}</p><div class="row"><button type="button" class="btn" data-a="listeYeni">Başka adres ekle</button></div></div>`;
  const pk = (v, ad) => `<label class="liste-r"><input type="radio" name="paket" value="${v}" data-c="listePaket"${L.paket === v ? " checked" : ""}><span>${ad}</span></label>`;
  return `<form class="card stack liste" id="liste" data-s="liste" novalidate aria-labelledby="liste-b">
    <span class="eyebrow">Erken erişim listesi</span><h2 id="liste-b">Açıldığında haber ver</h2>
    <p class="muted">Atılım ve Premium paketler henüz satışta değil. E-postanı bırak; paketler açıldığında sana <b>bir kez</b> haber verelim.</p>
    <p class="liste-not" role="note"><b>Ödeme alınmaz, sipariş oluşmaz.</b> Paket ya da fiyat garantisi verilmez.</p>
    <label class="lbl" for="liste-e">E-posta adresin</label>
    <input class="in" id="liste-e" name="eposta" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" placeholder="ad@ornek.com" maxlength="254" value="${esc(L.eposta)}" data-i="listeE"${L.alan === "eposta" ? ` aria-invalid="true"` : ""} aria-describedby="liste-h" required>
    <input class="liste-web" name="web" type="text" tabindex="-1" autocomplete="off" aria-hidden="true">
    <fieldset class="liste-pk"><legend class="lbl">Hangi paketle ilgileniyorsun?</legend>${pk("atilim", "Atılım")}${pk("premium", "Premium")}${pk("ikisi", "İkisi de")}</fieldset>
    <div class="liste-kvkk" role="group" aria-label="Kişisel verilerin işlenmesi (aydınlatma)"><b>Aydınlatma (KVKK)</b><br>E-posta adresin, yalnızca ücretli paketler açıldığında sana haber vermek ve onay/silme işlemlerini yürütmek için saklanır; üçüncü kişilere satılmaz. Kaydını istediğin zaman silebilirsin. Ayrıntılar: <a href="#erken-aydinlatma">Erken Erişim Listesi Aydınlatma Metni</a>. Bu kayıt <b>kampanya ya da reklam izni değildir</b>.</div>
    <label class="check multi"><input type="checkbox" id="liste-izin" name="izin" data-c="listeIzin"${L.izin ? " checked" : ""}${L.alan === "izin" ? ` aria-invalid="true"` : ""} aria-describedby="liste-h"><span>Ücretli paketler açıldığında bana <b>bir kez</b> e-posta ile haber verilmesini istiyorum.</span></label>
    <p class="liste-h" id="liste-h" role="alert" aria-live="assertive">${L.err ? esc(L.err) : ""}</p>
    <button class="btn acc wide"${L.busy ? " disabled" : ""}>${L.busy ? "Gönderiliyor…" : "Açıldığında haber ver"}</button>
    <p class="xs muted">${LISTE_NOT} Kaydını silmek ya da iznini geri çekmek için her e-postadaki bağlantıyı kullan ya da <button type="button" class="lnk" data-a="listeSilAc" aria-expanded="${L.sil}">kaydımı sil</button>.</p>
    ${L.sil ? `<div class="liste-sil"><label class="lbl" for="liste-se">Silmek istediğin e-posta adresi</label><div class="row"><input class="in" id="liste-se" type="email" inputmode="email" autocomplete="email" autocapitalize="off" placeholder="ad@ornek.com" maxlength="254" value="${esc(L.silE)}" data-i="listeSilE" style="flex:1;min-width:200px"><button type="button" class="btn" data-a="listeSilGonder"${L.silBusy ? " disabled" : ""}>${L.silBusy ? "Gönderiliyor…" : "Silme bağlantısı gönder"}</button></div><p class="xs muted" role="status" aria-live="polite">${L.silMsg ? esc(L.silMsg) : "Adres listedeyse, kendisine bir silme bağlantısı yollarız. Başkası senin adresini silemez."}</p>${L.silErr ? `<p class="liste-h" role="alert">${esc(L.silErr)}</p>` : ""}</div>` : ""}
  </form>`;
}
function vPremium() {
  const P = planlar(), li = t => `<li class="pf"><span class="pf-i on" aria-hidden="true"></span>${t}</li>`;
  const mevcut = k => !IN_CLAUDE && typeof HESAP !== "undefined" && HESAP.user && (HESAP.paket ? HESAP.paket.plan === k : k === "ucretsiz");
  const kart = p => `<div class="card stack glow${p.k === "premium" ? " prem" : ""}${mevcut(p.k) ? " cur" : ""}">
      <div class="card-h" style="margin:0"><h2>${p.n}</h2><span class="pill${p.k === "ucretsiz" ? "" : " form"}">${mevcut(p.k) ? "Mevcut paketin" : p.k === "ucretsiz" ? p.tag : "Yakında"}</span></div>
      ${p.k === "ucretsiz" ? `<div class="price"><b>0<small> TL</small></b><span>ücretsiz girişle</span></div>` : `<div class="price liste-fiyat"><b>Yakında</b><span>fiyat ve içerik açıldığında netleşir</span></div>`}
      <ul class="pfl">${p.feats.map(li).join("")}</ul>
      ${p.k === "ucretsiz" ? `<a class="btn" href="#bugun">Hemen başla</a>` : `<button type="button" class="btn ${p.k === "premium" ? "acc" : "pri"}" data-a="listeGit" data-k="${p.k === "orta" ? "atilim" : "premium"}">Açıldığında haber ver</button>`}
    </div>`;
  return `<div class="view wide">
    <div class="vhead"><span class="eyebrow">AKE Akademi paketleri</span><h1>Ücretsiz başla, paketler yakında</h1><p>Soru bankası, canlı denemeler, arkadaş ligi ve takip araçları herkese ücretsiz. Atılım ve Premium paketler henüz satışta değil; açıldığında haber almak için aşağıdaki listeye yazılabilirsin.</p></div>
    <p class="liste-not" role="note"><b>Ödeme alınmaz, sipariş oluşmaz.</b> Paket ya da fiyat garantisi verilmez. Aşağıdaki içerik planlanandır ve açıldığında değişebilir.</p>
    ${(!IN_CLAUDE && typeof HESAP !== "undefined") ? uyelikOzet() : ""}
    <div class="grid3 plans">${P.map(kart).join("")}</div>
    ${listeKart()}
    ${IN_CLAUDE ? "" : `<p class="small muted">Daha önce erişim kodu aldıysan kodun çalışmaya devam eder; <a href="#hesap">Hesabım</a> sayfasından ekleyebilirsin.</p>`}
  </div>`;
}

'''
src = src[:_a] + _YENI + src[_b:]

# 2) eylemler: satın alma/yönlendirme yok; liste eylemleri
rep('''  premBuy() {
    const p = planlar().find(x => x.k === UI.prem.sel), u = p && p.link ? (UI.prem.yil ? p.link.yil : p.link.ay) : "";
    if (!(UI.prem.a && UI.prem.b) || !okLink(u)) return; window.open(u, "_blank", "noopener");
  },
  premSec(d) { UI.prem.sel = d.k; UI.prem.a = UI.prem.b = false; render(); const el = document.getElementById("odeme"); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); },
  premDonem(d) { UI.prem.yil = d.k === "yil"; render(); }
});''', '''  /* Satış kapalı: ödeme sayfasına yönlendiren eylem YOK (eski premBuy/premSec/premDonem kaldırıldı). */
  listeGit(d) { const L = listeDurum(); L.paket = d.k === "premium" ? "premium" : "atilim"; L.ok = false; render(); const el = document.getElementById("liste-e"); const f = document.getElementById("liste"); if (f) f.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion:reduce)").matches ? "auto" : "smooth", block: "center" }); if (el) el.focus({ preventScroll: true }); },
  listeYeni() { const L = listeDurum(); L.ok = false; L.eposta = ""; L.izin = false; L.err = ""; L.alan = ""; render(); const el = document.getElementById("liste-e"); if (el) el.focus(); },
  listeSilAc() { const L = listeDurum(); L.sil = !L.sil; L.silMsg = ""; L.silErr = ""; render(); const el = document.getElementById("liste-se"); if (L.sil && el) el.focus(); },
  async listeSilGonder() {
    const L = listeDurum(); if (L.silBusy) return; L.silErr = ""; L.silMsg = "";
    if (!LISTE_RE.test(L.silE.trim())) { L.silErr = LISTE_HATA.eposta_gecersiz; render(); return; }
    L.silBusy = true; render();
    try {
      const r = await fetch("/api/liste/sil-iste", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ eposta: L.silE.trim() }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) L.silMsg = "Adres listedeyse silme bağlantısını e-postana yolladık. Gelmezse spam klasörüne bak."; else L.silErr = LISTE_HATA[j.error] || "Şu an yapılamadı. Biraz sonra tekrar dene.";
    } catch (e) { L.silErr = "Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene."; }
    L.silBusy = false; render();
  }
});
Object.assign(INP, { listeE(el) { const L = listeDurum(); L.eposta = el.value; }, listeSilE(el) { listeDurum().silE = el.value; } });
Object.assign(CHG, { listeIzin(el) { const L = listeDurum(); L.izin = el.checked; if (el.checked && L.alan === "izin") { L.alan = ""; L.err = ""; render(); } }, listePaket(el) { listeDurum().paket = el.value; } });
Object.assign(SUB, {
  async liste(fd) {
    const L = listeDurum(); if (L.busy) return;
    L.eposta = String(fd.get("eposta") || "").trim(); L.izin = fd.get("izin") === "on"; L.paket = fd.get("paket") || L.paket; L.err = ""; L.alan = "";
    if (!LISTE_RE.test(L.eposta)) { L.err = LISTE_HATA.eposta_gecersiz; L.alan = "eposta"; }
    else if (!L.izin) { L.err = LISTE_HATA.izin_yok; L.alan = "izin"; }
    if (L.err) { render(); const el = document.getElementById(L.alan === "izin" ? "liste-izin" : "liste-e"); if (el) el.focus(); return; }
    L.busy = true; render();
    try {
      const r = await fetch("/api/liste/kaydet", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ eposta: L.eposta, izin: true, paket: L.paket, web: String(fd.get("web") || "") }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { L.ok = true; L.gonderilen = L.eposta; L.izin = false; }
      else { L.err = LISTE_HATA[j.error] || "Kayıt şu an yapılamadı. Biraz sonra tekrar dene."; L.alan = j.error === "izin_yok" ? "izin" : j.error === "eposta_gecersiz" ? "eposta" : ""; }
    } catch (e) { L.err = "Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene."; }
    L.busy = false; render();
  }
});''', 1)

# 3) diğer sayfalardaki satın alma/ödeme çağrıları
# AI öğretmen kilidi (kod etkinleştirme formu KALIR: mevcut müşteriler)
rep('''<span class="pill form" style="align-self:flex-start">Atılım ve Premium</span><h2>AI öğretmen paketlerle açılıyor</h2><p class="muted">Takıldığın soruyu yazdığında ya da fotoğrafını çektiğinde adım adım çözen, konu anlatan ve zayıf konularına göre öneri veren AI öğretmen Atılım ve Premium paketlerde var. Soru bankası, denemeler ve diğer bölümler ücretsiz kalmaya devam ediyor.</p>''',
    '''<span class="pill form" style="align-self:flex-start">Atılım ve Premium · yakında</span><h2>AI öğretmen paketlerle gelecek</h2><p class="muted">Takıldığın soruyu yazdığında ya da fotoğrafını çektiğinde adım adım çözen, konu anlatan ve zayıf konularına göre öneri veren AI öğretmen, Atılım ve Premium paketler açıldığında gelecek. Paketler henüz satışta değil; ödeme alınmaz. Soru bankası, denemeler ve diğer bölümler ücretsiz kalmaya devam ediyor. Erişim kodun varsa aşağıdan etkinleştirebilirsin.</p>''', 1)
rep('''<a class="btn acc" style="align-self:flex-start" href="#premium">Paketleri incele</a></div>`;''', '''<a class="btn acc" style="align-self:flex-start" href="#premium">Açıldığında haber ver</a></div>`;''', 1)
rep('''AKE Akademi Premium ile açılıyor. <a href="#premium">Premium'u incele →</a>''', '''paketler açıldığında gelecek. <a href="#premium">Açıldığında haber ver →</a>''', 1)
# yan menü, Ayarlar kartı, Hesabım
rep('''<b>AKE Premium</b><span>AI öğretmen, daha fazla soru ve deneme</span><em>Paketleri gör</em>''', '''<b>AKE Premium · yakında</b><span>AI öğretmen, daha fazla soru ve deneme</span><em>Açıldığında haber ver</em>''', 1)
rep('''"AI öğretmen ve daha yüksek haklar için paketleri incele"}</span></div><a class="btn ${pk ? "" : "pri"}" href="#premium">${pk ? "Üyeliği yönet" : "Paketleri gör"}</a>''', '''"Ücretli paketler henüz satışta değil"}</span></div><a class="btn ${pk ? "" : "pri"}" href="#premium">${pk ? "Üyeliği yönet" : "Açıldığında haber ver"}</a>''', 1)
rep('''Şu an ücretsiz paketi kullanıyorsun. AI öğretmen Atılım ve Premium paketlerde var.</p><div class="row"><a class="btn pri" href="#premium">Paketleri incele</a></div>''', '''Şu an ücretsiz paketi kullanıyorsun. AI öğretmen, Atılım ve Premium paketler açıldığında gelecek; paketler henüz satışta değil.</p><div class="row"><a class="btn pri" href="#premium">Açıldığında haber ver</a></div>''', 1)
rep('''Paket satın almadan önce giriş yap; ödeme, giriş yaptığın e-postaya tanımlanır.''', '''Ücretsiz üyelik için giriş yap. Ücretli paketler henüz satışta değil; ödeme alınmaz.''', 1)
# Tanıtım: paket bölümü
rep('''"Abonelik seçenekleri", "Ücretsiz başla. İhtiyacın olursa yükselt.", "Yıllık ödemede bir ay bedava. Ödemeden sonra gelen kodu hesabına bağlayınca paketin açılır."''', '''"Paketler", "Ücretsiz başla. Ücretli paketler yakında.", "Atılım ve Premium henüz satışta değil. Ödeme alınmaz, sipariş oluşmaz; paket ya da fiyat garantisi verilmez. Açıldığında haber almak için listeye yazılabilirsin."''', 1)
rep('''${p.k === "ucretsiz" ? `<div class="fi">0 <small>TL</small></div><div class="yi">Ücretsiz girişle</div>` : `<div class="fi">${tl(p.ay)} <small>TL / ay</small></div><div class="yi">ya da yıllık ${tl(p.yil)} TL</div>`}''', '''${p.k === "ucretsiz" ? `<div class="fi">0 <small>TL</small></div><div class="yi">Ücretsiz girişle</div>` : `<div class="fi">Yakında</div><div class="yi">fiyat açıldığında netleşir</div>`}''', 1)
rep('''href="#premium">${p.n} paketini incele</a>''', '''href="#premium">Açıldığında haber ver</a>''', 1)
# SSS (uygulama içi)
rep('''Sınırsız soru ve deneme, AI öğretmen ve gelişmiş çözümler ücretli paketlerde (Atılım ve Premium) bulunur. Güncel fiyatlar <a href=\\"#premium\\">Paketler</a> sayfasındadır."''', '''Sınırsız soru ve deneme, AI öğretmen ve gelişmiş çözümler için ücretli paketler (Atılım ve Premium) planlanıyor; henüz satışta değil ve ödeme alınmıyor. Açıldığında haber almak için <a href=\\"#premium\\">Paketler</a> sayfasındaki listeye yazılabilirsin."''', 1)
rep('''["Ödemeyi nasıl yaparım?", "Paket ödemesi Shopier üzerinden yapılır. Ödemeden sonra sana bir erişim kodu gelir; bu kodu hesabına bağlayınca paketin açılır."],''', '''["Paket satın alabilir miyim?", "Şu an hayır: ücretli paketler henüz satışta değil, ödeme alınmıyor ve sipariş oluşmuyor. Paket ya da fiyat garantisi verilmiyor. Açıldığında haber almak için <a href=\\"#premium\\">Paketler</a> sayfasındaki listeye yazılabilirsin. Daha önce aldığın erişim kodu çalışmaya devam eder."],''', 1)
rep('''["İade yapabilir miyim?", "Dijital ürünlerde iade ve cayma koşulları yasal metinlerde açıkça yazılıdır: <a href=\\"#iade\\">İptal ve iade</a> ve <a href=\\"#mesafeli\\">Mesafeli satış sözleşmesi</a> sayfalarına bak."],''', '''["İade yapabilir miyim?", "Şu an ödeme alınmadığı için yeni bir iade söz konusu değil. Daha önce alınmış erişim kodları için iade ve cayma koşulları yasal metinlerde yazılıdır: <a href=\\"#iade\\">İptal ve iade</a> ve <a href=\\"#mesafeli\\">Mesafeli satış sözleşmesi</a>."],''', 1)
# Yönetici ayar uyarısı: ödeme linki artık gerekli değil (satış kapalı)
rep('''.concat(["linkOrtaAy", "linkOrtaYil", "linkPremiumAy", "linkPremiumYil"].some(k => AYAR[k]) ? [] : [["", "en az bir ödeme linki"]])''', '''''', 2)

# 4) yasal metinler: erken erişim aydınlatması (ayrı sayfa) + satış metinlerine "şu an satış yok" notu
rep('''const LEGAL_ORDER = ["kvkk", "cerez",''', '''const LEGAL_ORDER = ["kvkk", "erken-aydinlatma", "cerez",''', 1)
rep('''const LEGAL = {
  "kvkk": {''', '''const LEGAL = {
  "erken-aydinlatma": { t: "Erken Erişim Listesi Aydınlatma Metni", d: "“Açıldığında haber ver” listesi için kişisel verilerin nasıl işlendiği", h: () => `
    <p><b>Veri sorumlusu:</b> ${ay("adSoyad", "AD SOYAD")}, Adres: ${ay("adres", "ADRES")}, E-posta: ${ay("eposta", "E-POSTA")}</p>
    <p class="note">Ücretli paketler (Atılım ve Premium) henüz satışta değildir. Ödeme alınmaz, sipariş oluşmaz; paket ya da fiyat garantisi verilmez. Bu liste yalnızca paketler açıldığında sana haber vermek içindir.</p>
    <h2>İşlenen veriler</h2>
    <ul><li>E-posta adresin ve ilgilendiğin paket (Atılım, Premium ya da ikisi)</li><li>Kaydın ve e-posta onayının zamanı, gösterilen izin metninin sürümü</li><li>Kötüye kullanımı incelemek için IP adresinin kısaltılmış, geri döndürülemeyen özeti (IP adresin açık yazılmaz)</li></ul>
    <h2>Amaç ve hukuki sebep</h2>
    <p>Verilerin yalnızca ücretli paketler açıldığında sana bir kez haber vermek ve onay, silme işlemlerini yürütmek için işlenir. Hukuki sebep, bu amaçla verdiğin açık rızadır (KVKK m.5/1). Onay kutusunu işaretlemeden ve e-postadaki bağlantıyı onaylamadan kaydın tamamlanmaz.</p>
    <p><b>Bu kayıt kampanya ya da reklam amaçlı ticari elektronik ileti izni değildir.</b> Açılış haberi dışında bu adrese ticari ileti gönderilmesi için ayrıca, açık ve ayrı bir izin istenir.</p>
    <h2>Kimlere aktarılır</h2>
    <ul><li>Barındırma ve veritabanı hizmeti (${ay("barindirma", "BARINDIRMA")}): kaydın saklanması için</li><li>E-posta gönderim hizmeti (Resend): onay ve silme e-postalarının iletilmesi için</li></ul>
    <p>Verilerin satılmaz ve başka amaçla paylaşılmaz. Bu hizmet sağlayıcıların sunucuları yurt dışında olabilir; aktarım KVKK m.9'a uygun güvencelerle yapılır.</p>
    <h2>Saklama ve silme</h2>
    <p>Onay bağlantısı 48 saat geçerlidir. Onaylamadığın kayıt bu süre dolduktan sonra otomatik temizlikle silinir; temizlik düzenli çalışır ve genellikle bir saat içinde tamamlanır, teknik bir aksaklıkta biraz gecikebilir. Onayladığın kayıt, paketler açılıp haber verilene ya da listenin amacı ortadan kalkana kadar saklanır. Kaydını ve iznini istediğin zaman silebilir ya da geri çekebilirsin: her e-postadaki “kaydımı sil” bağlantısı ya da Paketler sayfasındaki “kaydımı sil” formu yeterlidir. Silme, adresinin ve izin kaydının listeden tamamen kaldırılması demektir.</p>
    <h2>Hakların (KVKK m.11)</h2>
    <p>Verilerinin işlenip işlenmediğini öğrenme, bilgi isteme, düzeltilmesini ya da silinmesini isteme ve itiraz etme haklarına sahipsin. Başvuru için ${ay("eposta", "E-POSTA")} adresine yazabilirsin.</p>
    <p class="small">İzin ve aydınlatma metni sürümü: 2026-11-21.</p>` },
  "kvkk": {''', 1)
rep('''<h1>${L.t}</h1><p class="small">Son güncelleme: ${ay("guncelleme", "TARİH")}</p></div>
    <article class="card legal">${L.h()}</article>''', '''<h1>${L.t}</h1><p class="small">Son güncelleme: ${ay("guncelleme", "TARİH")}</p></div>
    ${["on-bilgi", "mesafeli", "iade"].includes(k) ? `<p class="note">Şu an ücretli paket satışı yoktur ve ödeme alınmaz. Bu metin, daha önce alınmış erişim kodları ve paketler satışa açıldığında geçerli olacak koşullar içindir.</p>` : ""}
    <article class="card legal">${L.h()}</article>''', 1)

# 5) kalan çağrılar
rep('''<a class="btn" href="#ogretmen">Kodu gir</a><a class="btn ghost" href="#premium">Paketleri incele</a></div>''', '''<a class="btn" href="#ogretmen">Kodu gir</a><a class="btn ghost" href="#premium">Açıldığında haber ver</a></div>''', 1)
rep('''<span class="pill form" style="align-self:flex-start">Atılım ve Premium</span><h2>AI öğretmen için giriş yap</h2>
    <p class="muted">Takıldığın soruyu yazdığında ya da fotoğrafını çektiğinde adım adım çözen, konu anlatan ve zayıf konularını bilen AI öğretmen paketlerle açılır. Önce giriş yap; paket kodun hesabına bağlanır.</p>${girisFormu(true)}<a class="btn ghost" style="align-self:flex-start" href="#premium">Paketleri incele</a></div>`;''', '''<span class="pill form" style="align-self:flex-start">Atılım ve Premium · yakında</span><h2>AI öğretmen için giriş yap</h2>
    <p class="muted">Takıldığın soruyu yazdığında ya da fotoğrafını çektiğinde adım adım çözen, konu anlatan ve zayıf konularını bilen AI öğretmen, ücretli paketler açıldığında gelecek; paketler henüz satışta değil ve ödeme alınmaz. Erişim kodun varsa önce giriş yap; kodun hesabına bağlanır.</p>${girisFormu(true)}<a class="btn ghost" style="align-self:flex-start" href="#premium">Açıldığında haber ver</a></div>`;''', 1)
rep('''Ücretli paket aldığında ödeme ve iletişim bilgilerin ${ay("odemeAracisi", "ÖDEME ARACISI")} üzerinden alınır''', '''Ücretli paket satışı açıldığında ve paket aldığında ödeme ve iletişim bilgilerin ${ay("odemeAracisi", "ÖDEME ARACISI")} üzerinden alınır''', 1)

# 6) ön bilgilendirmedeki fiyat satırı: satış kapalıyken sayı gösterilmez
rep('''<p>Atılım paketi aylık ${ayN("fiyatOrta", "FİYAT")} TL veya yıllık ${ayN("yillikOrta", "FİYAT")} TL; Premium paket aylık ${ayN("fiyatPremium", "FİYAT")} TL veya yıllık ${ayN("yillikPremium", "FİYAT")} TL. Fiyatlara tüm vergiler dahildir, ek ücret yoktur.</p>''', '''<p>Ücretli paketler henüz satışta değildir; şu an fiyat ilan edilmemiştir ve ödeme alınmaz. Satış açıldığında fiyat, vergiler dahil olarak bu sayfada ve Paketler sayfasında açıkça gösterilir.</p>''', 1)
