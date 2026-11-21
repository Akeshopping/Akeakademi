# retoken.py içinde exec edilir; `src` değişkenini günceller. Her değişiklik tam eşleşme + adet doğrular.
def rep(old,new,count=1):
    global src
    n=src.count(old)
    assert n==count,(n,count,old[:80])
    src=src.replace(old,new)

# logo: Eşik K simgesi aynı, rengi mercan (koyu zeminde okunur ton)
rep('5: id => `<svg viewBox="0 0 64 64"><path fill-rule="evenodd" fill="#b69a68" d="M6 60V32A26 26 0 0 1 32 6H58V60z M25 28v28h6V45.5l14.5 14.5H54L36 41.5 54 22.5v-.1h-8.3L31 38V28z"/></svg>`,',
    '5: id => `<svg viewBox="0 0 64 64"><defs><linearGradient id="${id}m" gradientUnits="userSpaceOnUse" x1="6" y1="6" x2="58" y2="60"><stop offset="0" style="stop-color:var(--logo-a)"/><stop offset="1" style="stop-color:var(--logo-b)"/></linearGradient></defs><path fill-rule="evenodd" fill="url(#${id}m)" d="M6 60V32A26 26 0 0 1 32 6H58V60z M25 28v28h6V45.5l14.5 14.5H54L36 41.5 54 22.5v-.1h-8.3L31 38V28z"/></svg>`,')
# ana sayfa yayı: yeşil/altın -> mercan
rep('<stop offset="0" stop-color="#254236" stop-opacity="0"/><stop offset=".25" stop-color="#254236"/><stop offset=".7" stop-color="#b69a68"/><stop offset="1" stop-color="#00d9a3" stop-opacity=".2"/>',
    '<stop offset="0" stop-color="#F27D6D" stop-opacity="0"/><stop offset=".25" stop-color="#D94F43"/><stop offset=".7" stop-color="#F27D6D"/><stop offset="1" stop-color="#F8F5F0" stop-opacity=".25"/>')

# ders grubu yardımcısı + günlük program zaman çizelgesi durumları
rep('function gtaskHTML(x) {',
'''const DG = { turkce: "tr", edebiyat: "tr", mat: "mat", geo: "mat", amat: "mat", fizik: "fen", kimya: "fen", biyoloji: "fen", afizik: "fen", akimya: "fen", abiyoloji: "fen", tarih: "sos", cografya: "sos", felsefe: "sos", din: "sos", tarih2: "sos", cografya2: "sos", psikoloji: "sos", sosyoloji: "sos", mantik: "sos", ingilizce: "dil" };
function dg(s) { return DG[s] || ""; }
function gtaskHTML(x, nx) {''')
rep('''  return `<div class="gtask${x.done ? " done" : ""}"><span class="ck" aria-hidden="true"></span><div class="grow"><div class="t">${esc(x.t)}</div><div class="s">${esc(x.s)}</div></div>${x.done ? `<span class="small muted">Tamam</span>` : `<button class="btn sm" data-a="${x.a}"${at}>${x.l}</button>`}</div>`;''',
'''  return `<div class="gtask${x.done ? " done" : ""}${nx ? " next" : ""}"${x.ds ? ` data-g="${dg(x.ds)}"` : ""}><span class="ck" aria-hidden="true"></span><div class="grow">${nx ? `<span class="gt-now">Sıradaki</span>` : ""}<div class="t">${esc(x.t)}</div><div class="s">${esc(x.s)}</div></div>${x.done ? `<span class="small muted">Tamam</span>` : `<button class="btn sm${nx ? " pri" : ""}" data-a="${x.a}"${at}>${x.l}</button>`}</div>`;''')
rep('<div class="tasks">${prog.map(gtaskHTML).join("")}</div>',
    '<div class="tasks">${(i0 => prog.map((x, i) => gtaskHTML(x, i === i0)).join(""))(prog.findIndex(y => !y.done))}</div>')
# ders renk işaretleri
rep('data-a="stDers" data-s="${k}" class="sc3-d${on','data-a="stDers" data-s="${k}" data-g="${dg(k)}" class="sc3-d${on')
rep('class="ders" data-a="dersAc" data-s="${s}">','class="ders" data-a="dersAc" data-s="${s}" data-g="${dg(s)}">')
rep('<span class="pill">${esc(SUBJ[t.s].n)}</span>','<span class="pill" data-g="${dg(t.s)}">${esc(SUBJ[t.s].n)}</span>',2)
# haftalık plan: geciken görev
rep('<div class="task ${t.done ? "done" : ""}"><input type="checkbox" data-c="taskDone" data-id="${t.id}"${t.done ? " checked" : ""} aria-label="Tamamlandı">',
    '<div class="task ${t.done ? "done" : ""}${i < ti && !t.done ? " late" : ""}"><input type="checkbox" data-c="taskDone" data-id="${t.id}"${t.done ? " checked" : ""} aria-label="Tamamlandı">')
rep('${t.min ? ` <span class="faint small">${t.min} dk</span>` : ""}</span><button class="x" data-a="taskDel"',
    '${t.min ? ` <span class="faint small">${t.min} dk</span>` : ""}${i < ti && !t.done ? ` <span class="pill warn">Gecikti</span>` : ""}</span><button class="x" data-a="taskDel"')
# odak odası: mola/odak modu CSS için
rep('<div class="card pomo"><h2>Odak odası</h2>','<div class="card pomo" data-mode="${POMO.mode}"><h2>Odak odası</h2>')
# soru çözme başlığı: ders etiketi ders renginde
rep('<span class="pill form">${esc(subj)}</span>','<span class="pill" data-g="${dg(q.s)}">${esc(subj)}</span>')

# ---- plan: bugünün görevleri öne, odak odası yanda kompakt
rep('function vPlan() {','''function planBugun(T, ti) {
  const ts = T.filter(t => t.day === ti), dn = ts.filter(t => t.done).length;
  return `<div class="plan-hero"><section class="card plan-bugun"><div class="card-h"><h2>Bugün · ${DAYS[ti]}</h2><span class="small muted">${dn}/${ts.length} tamam</span></div>
    ${ts.length ? `<div class="bar ok"><i style="width:${pct(dn, ts.length)}%"></i></div><div class="list">${ts.map(taskRow).join("")}</div>` : `<div class="durum bos"><b>Bugün için görev yok</b><span>Aşağıdan bir görev ekle ya da haftalık planını oluştur.</span></div>`}</section>${pomoKart()}</div>`;
}
function vPlan() {''')
rep('  ${pomoKart()}\n  <div class="card"><div class="row" style="justify-content:space-between">','  ${planBugun(T, ti)}\n  <div class="card plan-ozet"><div class="row" style="justify-content:space-between">')

# ---- gelişim: veri yokken ilk kullanım durumu
rep('function vProgress() {','''function ilkKullanim() {
  return `<section class="card ilk"><span class="eyebrow">Henüz veri yok</span><h2>Gelişimin ilk soruyla başlar</h2>
    <p class="muted">Soru çözdükçe doğruluğun, güçlü ve zayıf konuların burada kendiliğinden görünür. Grafikler ilk verinle birlikte açılır.</p>
    <ol class="ilk-adim"><li><b>10 soru çöz</b><span>Doğruluk ve ders dağılımı oluşur.</span></li><li><b>İlk denemeni çöz</b><span>Net grafiğin başlar.</span></li><li><b>Zayıf konularını gör</b><span>Planın buna göre şekillenir.</span></li></ol>
    <div class="row"><a class="btn pri" href="#studyo">İlk soruyu çöz</a><a class="btn" href="#deneme">Deneme çöz</a></div></section>`;
}
function vProgress() {''')
rep('  const weak = weakTopics(8);\n  return `<div class="view">\n  <div class="vhead"><span class="eyebrow">Veriye bak, plana dön</span>','  const weak = weakTopics(8), bos = !tot.q && !S.exams.length;\n  return `<div class="view"${bos ? \' data-bos="1"\' : ""}>\n  <div class="vhead"><span class="eyebrow">Veriye bak, plana dön</span>')
_a=src.index('Veriye bak, plana dön'); _b=src.index('  <div class="tiles">${tile(tot.q, "çözülen soru")}',_a)
src=src[:_b]+'  ${bos ? ilkKullanim() : `<div class="tiles">${tile(tot.q, "çözülen soru")}'+src[_b+len('  <div class="tiles">${tile(tot.q, "çözülen soru")}'):]
_b=src.index('${barChart(days)}</div>\n  <div class="grid2">',_a)
src=src[:_b]+'${barChart(days)}</div>`}\n  <div class="grid2">'+src[_b+len('${barChart(days)}</div>\n  <div class="grid2">'):]

# ---- ana sayfa: üyelik kartı programın altına, tanışma kartı sakinleşir (CSS)
rep('  ${p.ok ? "" : obKart(goal)}\n  ${uyelikKart()}\n  <section class="card today">','  ${p.ok ? "" : obKart(goal)}\n  <section class="card today">')
rep('    </section>\n  ${veriUyari()}\n  <div class="${ng ? "grid2" : ""}">${ng}','    </section>\n  ${uyelikKart()}\n  ${veriUyari()}\n  <div class="${ng ? "grid2" : ""}">${ng}')

# ---- soru çözme: bildirim üst sabit çubuğun üzerinde (CSS ile; işaretleme değişmez)

# ---- soru çözme: bildirim, araç çubuğunun altında kendine ayrılmış satırda (akışta; hiçbir şeyin üstüne binmez)
rep('  <div class="rprog" role="progressbar"','  ${UI.toast ? `<div class="run-toast" role="status">${esc(UI.toast)}</div>` : ""}\n  <div class="rprog" role="progressbar"')
rep('const el = document.querySelector(".toast"); if (el) el.remove();','document.querySelectorAll(".toast,.run-toast").forEach(el => el.remove());')
