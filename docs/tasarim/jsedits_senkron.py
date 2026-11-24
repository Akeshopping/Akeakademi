# Web istemcisi: hesap "stats" belgesi için ÇAKIŞMASIZ senkron (web + mobil + başka cihaz). jsedits_*.py ile aynı biçim (rep: tam eşleşme + adet).
#
# Sorun (kanıtlı): web, daha yeni uzak belgeyi bütünüyle benimsiyordu → henüz gönderilmemiş (≈6 sn / çevrimdışı) yerel cevaplar ezilirdi; ayrıca
# eskimiş bir web sekmesi daha YENİ bir yerel zaman damgasıyla tüm belgenin üstüne yazıp mobilin ilerlemesini silebilirdi.
# Çözüm: her cevap yerelde bir OLAY olarak da tutulur (S.pend, kalıcı). Senkronda: uzak belge okunur → henüz uzakta olmayan olaylar (olay kimliği
# uzaktaki _ev listesinde yoksa) üstüne uygulanır → sunucuya KOŞULLU yazılır (_b = okunan sürüm; araya başka yazma girdiyse 409 → yeniden oku/birleştir).
# Olay yalnızca yazma onaylanınca silinir; yanıt kaybolsa bile tekrar çift sayılmaz (_ev). Gönderilemeyen olaylar bekler, kaybolmaz.
rep('plan: { tasks: [] }, aiQs: [], reports: {}, badges: {}, tr: {}, td: {} };', 'plan: { tasks: [] }, aiQs: [], reports: {}, badges: {}, tr: {}, td: {}, pend: [], sb: 0 };')

rep('''  else if (S.mistakes[q.id] && !S.mistakes[q.id].learned) { if (tekrarDogru(S.mistakes[q.id])) touch("mistakes"); }
  touch("stats");
}''', '''  else if (S.mistakes[q.id] && !S.mistakes[q.id].learned) { if (tekrarDogru(S.mistakes[q.id])) touch("mistakes"); }
  olayEkle(statsOlay(q, res));
  touch("stats");
}''')
rep('if (R.kind === "para") { S.para.times.push(secs); if (res) S.para.c++; else S.para.w++; touch("stats"); }',
    'if (R.kind === "para") { S.para.times.push(secs); if (res) S.para.c++; else S.para.w++; olayEkle({ e: olayId(), k: "p", secs, r: res, ts: Date.now() }); touch("stats"); }')
rep('d.fm = (d.fm || 0) + 25; touch("stats"); xpEkle("odak");', 'd.fm = (d.fm || 0) + 25; olayEkle({ e: olayId(), k: "f", g: dayKey(), ts: Date.now() }); touch("stats"); xpEkle("odak");')

rep('async function flush() {', '''/* STATS-SENKRON-BASLA (tests/web-stats-senkron.test.mjs bu bloğu index.html'den çıkarıp gerçek sunucu koduyla çalıştırır) */
const EV_MAX = 2000, EVID_MAX = 3000, olayId = () => uid() + Math.random().toString(36).slice(2, 6);
const hesapKimlik = () => (HESAP.user && HESAP.user.id) || null;
function statsOlay(q, res) { return { e: olayId(), k: "q", s: q.s, t: q.t, d: q.d || 2, i: q.gen ? null : q.id, r: res, ts: Date.now(), g: dayKey() }; }
/* Bekleyen olay yerel listeye eklenir ve HESABA BAĞLANIR (h). Liste dolarsa eski olaylar SİLİNMEZ: açık uyarı verilir (false döner),
   senkron bu durumda yerel sayaçları da korur (statsMaks). */
function olayEkle(ev) {
  if (!Array.isArray(S.pend)) S.pend = [];
  if (ev.h === undefined) ev.h = hesapKimlik();
  if (S.pend.length >= EV_MAX) {
    S.kayipRisk = (S.kayipRisk || 0) + 1;
    try { if (typeof cloud !== "undefined") cloud.state = "dolu"; if (typeof paintSave === "function") paintSave(); if (typeof toast === "function" && (S.kayipRisk === 1 || S.kayipRisk % 50 === 0)) toast("Çevrimdışı kayıt sınırı doldu. İnternete bağlanıp kaydet; yoksa bazı cevaplar hesabına yazılamayabilir."); } catch (e) { }
    return false;
  }
  S.pend.push(ev); return true;
}
/* Bir olayı düz stats nesnesine uygular (record() ile aynı sayaç kuralları; sunucudaki lib/ilerleme.js ile aynı biçim) */
function olayUygula(st, ev) {
  if (ev.k === "p") { const p = st.para = st.para || { times: [], c: 0, w: 0 }; p.times = (p.times || []).concat([ev.secs]).slice(-60); if (ev.r) p.c = (p.c || 0) + 1; else p.w = (p.w || 0) + 1; return; }
  const daily = st.daily = st.daily || {}, day = daily[ev.g] || (daily[ev.g] = { q: 0, c: 0 });
  if (ev.k === "f") { day.fm = (day.fm || 0) + 25; return; }
  const topic = st.topic = st.topic || {}, key = ev.s + "|" + ev.t, t = topic[key] || (topic[key] = [0, 0, 0]);
  if (ev.r !== -1) { day.q++; if (ev.r === 1) day.c++; day.tp = day.tp || {}; day.tp[key] = (day.tp[key] || 0) + 1; }
  t[ev.r === 1 ? 0 : ev.r === 0 ? 1 : 2]++;
  if (ev.r !== -1) { st.tr = st.tr || {}; st.td = st.td || {}; st.tr[key] = ((st.tr[key] || "") + ev.r).slice(-12); const td = st.td[key] || (st.td[key] = [[0, 0], [0, 0], [0, 0]]), di = Math.min(2, Math.max(0, (ev.d || 2) - 1)); td[di][ev.r === 1 ? 0 : 1]++; }
  if (ev.i) { st.ans = st.ans || {}; const a = st.ans[ev.i] || (st.ans[ev.i] = [0, 0, 0, 0, 0]); a[ev.r === 1 ? 0 : ev.r === 0 ? 1 : 2]++; a[3] = ev.ts; a[4] = ev.r; }
}
const yerelStats = () => { const o = {}; AREA.stats.forEach(k => { if (S[k] !== undefined) o[k] = clone(S[k]); }); return o; };
const bosStats = () => ({ ans: {}, topic: {}, daily: {}, para: { times: [], c: 0, w: 0 }, badges: {}, tr: {}, td: {} });
/* Uzak belgede uygulanmış olay kimlikleri: uygulama PARTİLERİ (g = yazma numarası). Eski düz liste de okunur. Eski partiler sınır aşılınca atılır; atılan en büyük numara _ed. */
const evPartileri = R => { const ev = R && R._ev; if (!Array.isArray(ev)) return []; return ev.length && typeof ev[0] === "string" ? [{ g: 0, i: ev }] : ev.filter(b => b && Array.isArray(b.i)); };
/* Uzak belge + henüz uzakta olmayan olaylar. Rozetler birleşim. */
function statsBirlestir(R, uygula, yerelBadges) {
  const out = clone(R);
  uygula.slice().sort((a, b) => a.ts - b.ts).forEach(e => olayUygula(out, e));
  out.badges = Object.assign({}, yerelBadges || {}, out.badges || {});
  return out;
}
/* Başlangıç / sınır-dolu durumu: iki belgenin sayaçları, büyüğünün altına düşmeyecek biçimde birleşir (kayıp yerine bilinen küçük sapma). */
function statsMaks(a, b) {
  const o = clone(a || {}), mxa = (x, y) => x.map((v, i) => Math.max(v || 0, (y && y[i]) || 0));
  b = b || {};
  o.topic = o.topic || {}; Object.keys(b.topic || {}).forEach(k => { o.topic[k] = o.topic[k] ? mxa(o.topic[k], b.topic[k]) : clone(b.topic[k]); });
  o.daily = o.daily || {}; Object.keys(b.daily || {}).forEach(g => {
    const x = o.daily[g], y = b.daily[g]; if (!x) { o.daily[g] = clone(y); return; }
    x.q = Math.max(x.q || 0, y.q || 0); x.c = Math.max(x.c || 0, y.c || 0); if (x.fm || y.fm) x.fm = Math.max(x.fm || 0, y.fm || 0);
    if (x.tp || y.tp) { x.tp = x.tp || {}; Object.keys(y.tp || {}).forEach(k => { x.tp[k] = Math.max(x.tp[k] || 0, y.tp[k] || 0); }); }
  });
  o.td = o.td || {}; Object.keys(b.td || {}).forEach(k => { o.td[k] = o.td[k] ? o.td[k].map((r, i) => mxa(r, b.td[k][i])) : clone(b.td[k]); });
  o.tr = o.tr || {}; Object.keys(b.tr || {}).forEach(k => { if (!o.tr[k] || String(b.tr[k]).length > String(o.tr[k]).length) o.tr[k] = b.tr[k]; });
  o.ans = o.ans || {}; Object.keys(b.ans || {}).forEach(id => { const x = o.ans[id], y = b.ans[id]; if (!x) { o.ans[id] = clone(y); return; } const m = mxa(x.slice(0, 3), y.slice(0, 3)); const son = (y[3] || 0) > (x[3] || 0) ? y : x; o.ans[id] = [m[0], m[1], m[2], son[3] || 0, son[4]]; });
  const pa = o.para || { times: [], c: 0, w: 0 }, pb = b.para || { times: [], c: 0, w: 0 }; o.para = (pb.c || 0) + (pb.w || 0) > (pa.c || 0) + (pa.w || 0) ? clone(pb) : pa;
  o.badges = Object.assign({}, b.badges || {}, o.badges || {});
  return o;
}
const statsCekirdek = x => { const c = clone(x || {}); ["_u", "_b", "_h", "_g", "_ev", "_ed"].forEach(k => delete c[k]); return JSON.stringify(c); };
/* Yerel sayaçlar başka bir hesaba aitse (aynı tarayıcıda hesap değişti) o hesabın YEDEĞİ ayrılır ve sayaçlar boşaltılır: yeni hesapla ASLA karışmaz.
   Eski hesabın bekleyen olayları (h) listede durur; yalnızca o hesap tekrar senkron olunca yazılır. */
function yerelHesaba(hid) {
  if (S.hid && S.hid !== hid) {
    if (S.kayipRisk) { S.yedek = S.yedek || {}; S.yedek[S.hid] = { sayac: yerelStats(), risk: S.kayipRisk }; }
    const b = bosStats(); AREA.stats.forEach(k => { S[k] = b[k]; }); S.kayipRisk = 0; S.sb = 1;
    (S.pend || []).filter(e => e.h === hid).forEach(e => olayUygula(S, e)); // yeni hesabın zaten bekleyen cevapları boş sayaçlara yeniden işlenir
  }
  if (S.hid !== hid && S.yedek && S.yedek[hid]) { const y = S.yedek[hid]; AREA.stats.forEach(k => { if (y.sayac[k] !== undefined) S[k] = clone(y.sayac[k]); }); S.kayipRisk = y.risk; delete S.yedek[hid]; S.sb = 1; }
  S.hid = hid;
}
function statsBenimse(out, hid, ids, u, belirsiz) {
  AREA.stats.forEach(k => { if (out[k] !== undefined) S[k] = clone(out[k]); });
  const kalan = (S.pend || []).filter(e => !ids.has(e.e)); S.pend = kalan;
  kalan.filter(e => e.h === hid || e.h == null).forEach(e => olayUygula(S, e)); // senkron sürerken gelen yeni cevaplar (yalnız bu hesabınkiler)
  S.sb = 1; S.hid = hid; S.kayipRisk = 0; S.upd.stats = u; if (belirsiz) S.belirsiz = (S.belirsiz || 0) + belirsiz;
  normalize(); saveLocal();
  if (belirsiz) { try { if (typeof toast === "function") toast(belirsiz + " cevabın hesaba yazılıp yazılmadığı doğrulanamadı; sayaçlarda küçük bir fark olabilir."); } catch (e) { } }
}
/* Okur, birleştirir, KOŞULLU yazar; araya başka yazma girerse (409) baştan dener. Hesap kimliği işlem başında yakalanır; her await sonrasında,
   PUT öncesinde ve benimsemeden önce aynı hesapta olunduğu doğrulanır (sunucu da _h ile doğrular). Başarısızlıkta olaylar KORUNUR. */
async function statsSenkron() {
  const hid = hesapKimlik(); if (!hid) throw { code: "not_granted" };
  const ayni = () => hesapKimlik() === hid, iptal = () => { throw { code: "hesap_degisti" }; };
  yerelHesaba(hid);
  for (let n = 0; n < 6; n++) {
    const { r, j } = await hesapIstek("veri"); if (!ayni()) iptal();
    if (r.status === 401) { HESAP.user = null; throw { code: "not_granted" }; }
    if (!r.ok) throw { code: "network" };
    if (j.hesap && j.hesap !== hid) iptal(); // tarayıcının oturumu (çerez) beklenen hesap değil: başka sekmede hesap değişmiş
    const R = (j.alanlar && j.alanlar.stats) || null, ru = Number(j.u && j.u.stats) || (R && Number(R._u)) || 0, G = Number(R && R._g) || 0, ed = Number(R && R._ed) || 0;
    const bat = evPartileri(R), listede = new Set(); bat.forEach(b => b.i.forEach(x => listede.add(x)));
    const benim = (S.pend || []).filter(e => e.h === hid || e.h == null), yerel = yerelStats();
    const uygula = []; let belirsiz = 0;
    benim.forEach(e => { if (listede.has(e.e)) return; if (e.tg !== undefined && e.tg + 1 <= ed) { belirsiz++; return; } uygula.push(e); }); // tg: bu olayı içeren yazma denemesinde okunan yazma numarası
    let out;
    if (!R) out = yerel;
    else if (!S.sb) out = statsMaks(R, yerel);
    else out = statsBirlestir(R, uygula, S.badges);
    if (S.kayipRisk && R && S.sb) out = statsMaks(out, yerel); // olay sınırı dolmuştu: yakalanamayan cevaplar yerel sayaçlardan korunur
    const ids = new Set(benim.map(e => e.e)), yeni = (!R || !S.sb) ? benim.filter(e => !listede.has(e.e)) : uygula;
    if (R && !yeni.length && statsCekirdek(out) === statsCekirdek(R)) { statsBenimse(R, hid, ids, ru, belirsiz); return; } // uzakta zaten aynı: yazmaya gerek yok
    delete out._u; delete out._b; delete out._h;
    const bat2 = bat.map(b => ({ g: b.g, i: b.i.slice() })); if (yeni.length) bat2.push({ g: G + 1, i: yeni.map(e => e.e) });
    let say = bat2.reduce((a, b) => a + b.i.length, 0), ed2 = ed;
    while (say > EVID_MAX && bat2.length > 1) { const b0 = bat2.shift(); say -= b0.i.length; ed2 = Math.max(ed2, b0.g); }
    out._g = G + 1; out._ev = bat2; if (ed2) out._ed = ed2; else delete out._ed;
    let g = 0; while (BYTES(JSON.stringify(out)) > DOC_LIMIT && g++ < 20) { const ks = Object.keys(out.daily || {}).sort(); if (ks.length > 60) ks.slice(0, 30).forEach(k => delete out.daily[k]); else break; }
    if (BYTES(JSON.stringify(out)) > DOC_LIMIT) throw { code: "invalid_argument" };
    yeni.forEach(e => { e.tg = G; }); saveLocal(); // deneme kaydı: yanıt kaybolursa bu olayın uygulanmış olabileceği bilinir
    out._b = ru; out._h = hid;
    if (!ayni()) iptal();
    const r2 = await fetch("/api/hesap/veri/stats", { method: "PUT", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(out) });
    if (r2.status === 409) {
      let j9 = {}; try { j9 = await r2.json(); } catch (e) { }
      yeni.forEach(e => { delete e.tg; }); // 409: yazılmadığı KESİN
      if (j9 && j9.error === "hesap") iptal();
      if (!ayni()) iptal();
      continue;
    }
    if (r2.status === 401) { HESAP.user = null; throw { code: "not_granted" }; }
    if (r2.status === 413) throw { code: "invalid_argument" };
    if (!r2.ok) throw { code: "network" };
    let j2 = {}; try { j2 = await r2.json(); } catch (e) { }
    if (!ayni()) { S.pend = (S.pend || []).filter(e => !ids.has(e.e)); saveLocal(); iptal(); } // yazma ESKİ hesaba onaylandı: olaylar silinir, yeni hesaba hiçbir şey benimsenmez
    delete out._b; delete out._h; statsBenimse(out, hid, ids, Number(j2.u) || ru + 1, belirsiz); return;
  }
  throw { code: "network" };
}
/* STATS-SENKRON-BITIS */
async function flush() {''')

rep('      try { await cloud.col.doc(a).set(o); cloud.writable = true; }', '      try { if (a === "stats" && cloud.col.web) await statsSenkron(); else await cloud.col.doc(a).set(o); cloud.writable = true; }')
rep('const webCol = () => ({\n  async get() {', 'const webCol = () => ({\n  web: true,\n  async get() {')
# hesapEsitle (yalnız web hesabı): stats bütünüyle benimsenmez; olaylarla birleşir
rep('''    const snap = await cloud.col.get(), remote = {};
    snap.docs.forEach(d => { if (d.exists) remote[d.id] = d.data(); });
    let changed = false;
    for (const a of Object.keys(AREA)) {
      const r = remote[a], ru = (r && r._u) || 0, lu = S.upd[a] || 0;''', '''    const snap = await cloud.col.get(), remote = {};
    snap.docs.forEach(d => { if (d.exists) remote[d.id] = d.data(); });
    let changed = false;
    await statsSenkron();
    for (const a of Object.keys(AREA)) {
      if (a === "stats") continue;
      const r = remote[a], ru = (r && r._u) || 0, lu = S.upd[a] || 0;''')

rep('retry: ["retry", "Kayıt bekliyor, tekrar denenecek"], local:', 'retry: ["retry", "Kayıt bekliyor, tekrar denenecek"], dolu: ["retry", "Çevrimdışı kayıt sınırı doldu · internete bağlan"], local:')
