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
const EV_MAX = 500, EVID_MAX = 400, olayId = () => uid() + Math.random().toString(36).slice(2, 6);
function statsOlay(q, res) { return { e: olayId(), k: "q", s: q.s, t: q.t, d: q.d || 2, i: q.gen ? null : q.id, r: res, ts: Date.now(), g: dayKey() }; }
function olayEkle(ev) { if (!Array.isArray(S.pend)) S.pend = []; S.pend.push(ev); if (S.pend.length > EV_MAX) S.pend.splice(0, S.pend.length - EV_MAX); }
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
/* Uzak belge + henüz uzakta olmayan olaylar. Rozetler birleşim. */
function statsBirlestir(R, bek, yerelBadges) {
  const out = clone(R), ev = Array.isArray(out._ev) ? out._ev.slice() : [], gorulen = new Set(ev);
  bek.slice().sort((a, b) => a.ts - b.ts).forEach(e => { if (gorulen.has(e.e)) return; olayUygula(out, e); gorulen.add(e.e); ev.push(e.e); });
  if (ev.length || out._ev) out._ev = ev.slice(-EVID_MAX);
  out.badges = Object.assign({}, yerelBadges || {}, out.badges || {});
  return out;
}
/* Tek seferlik başlangıç (bu cihaz bu sürümle henüz senkron olmadı): iki belgenin sayaçları, büyüğünün altına düşmeyecek biçimde birleşir. */
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
const statsKarsi = x => { const c = clone(x || {}); delete c._u; delete c._b; return JSON.stringify(c); };
function statsBenimse(out, ids, u) {
  AREA.stats.forEach(k => { if (out[k] !== undefined) S[k] = clone(out[k]); });
  const kalan = (S.pend || []).filter(e => !ids.has(e.e)); S.pend = kalan; kalan.forEach(e => olayUygula(S, e)); // senkron sürerken gelen yeni cevaplar
  S.sb = 1; S.upd.stats = u; normalize(); saveLocal();
}
/* Okur, birleştirir, koşullu yazar; araya başka yazma girerse (409) baştan dener. Başarısızlıkta olaylar KORUNUR (hata fırlatır; flush yeniden dener). */
async function statsSenkron() {
  for (let n = 0; n < 6; n++) {
    const { r, j } = await hesapIstek("veri");
    if (r.status === 401) { HESAP.user = null; throw { code: "not_granted" }; }
    if (!r.ok) throw { code: "network" };
    const R = (j.alanlar && j.alanlar.stats) || null, ru = Number(j.u && j.u.stats) || (R && Number(R._u)) || 0;
    const bek = (S.pend || []).slice(), ids = new Set(bek.map(e => e.e)), yerel = yerelStats();
    let out;
    if (!R) { out = yerel; out._ev = bek.map(e => e.e).slice(-EVID_MAX); }
    else if (!S.sb) { out = statsMaks(R, yerel); out._ev = (R._ev || []).concat(bek.map(e => e.e)).slice(-EVID_MAX); }
    else out = statsBirlestir(R, bek, S.badges);
    delete out._u; delete out._b;
    if (R && statsKarsi(out) === statsKarsi(R)) { statsBenimse(out, ids, ru); return; } // uzakta zaten aynı: yazmaya gerek yok
    let g = 0; while (BYTES(JSON.stringify(out)) > DOC_LIMIT && g++ < 20) { const ks = Object.keys(out.daily || {}).sort(); if (ks.length > 60) ks.slice(0, 30).forEach(k => delete out.daily[k]); else break; }
    if (BYTES(JSON.stringify(out)) > DOC_LIMIT) throw { code: "invalid_argument" };
    out._b = ru;
    const r2 = await fetch("/api/hesap/veri/stats", { method: "PUT", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(out) });
    if (r2.status === 409) continue;
    if (r2.status === 401) { HESAP.user = null; throw { code: "not_granted" }; }
    if (r2.status === 413) throw { code: "invalid_argument" };
    if (!r2.ok) throw { code: "network" };
    let j2 = {}; try { j2 = await r2.json(); } catch (e) { }
    delete out._b; statsBenimse(out, ids, Number(j2.u) || ru + 1); return;
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
