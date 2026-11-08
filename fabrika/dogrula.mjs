// AKE Soru Fabrikası · doğrulama
// Kullanım: node dogrula.mjs cikti/r01-mat.json [daha_fazla.json ...]
// Çıktı: hatalar (soru elenir) ve uyarılar (insan bakar). Çıkış kodu 1 ise hata var.
import fs from "node:fs";
import { DERSLER } from "./lib.mjs";

const dosyalar = process.argv.slice(2);
if (!dosyalar.length) { console.log("Kullanım: node dogrula.mjs dosya.json ..."); process.exit(2); }

const norm = s => String(s).toLocaleLowerCase("tr").replace(/[^a-zçğıöşüâîû0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const golge = s => { const w = norm(s).split(" "); const k = new Set(); for (let i = 0; i + 2 < w.length; i++) k.add(w.slice(i, i + 3).join(" ")); if (!k.size) k.add(w.join(" ")); return k; };
const jac = (a, b) => { let n = 0; for (const x of a) if (b.has(x)) n++; return n / (a.size + b.size - n || 1); };

const mevcut = JSON.parse(fs.readFileSync(new URL("./mevcut_ozet.json", import.meta.url), "utf8")).map(m => ({ id: "mevcut", s: m.s, g: golge((m.p || "") + " " + m.q), q: m.q }));
const yeni = []; const hatalar = []; const uyarilar = []; const idler = new Set();
const konular = JSON.parse(fs.readFileSync(new URL("./mevcut_konular.json", import.meta.url), "utf8"));
const YASAK = /^(hepsi|hiçbiri|yukarıdakilerin (hepsi|hiçbiri)|a ve b|b ve c)\b/i;

for (const f of dosyalar) {
  const liste = JSON.parse(fs.readFileSync(f, "utf8"));
  for (const q of liste) {
    const h = m => hatalar.push({ id: q.id, f, m });
    const u = m => uyarilar.push({ id: q.id, f, m });
    if (!q.id || idler.has(q.id)) h("id yok veya tekrar"); idler.add(q.id);
    if (!DERSLER.includes(q.s)) h("ders geçersiz: " + q.s);
    if (!q.t || typeof q.t !== "string") h("konu yok");
    else if (konular[q.s] && !(q.t in konular[q.s])) u("yeni konu adı: " + q.t);
    if (![1, 2, 3].includes(q.d)) h("zorluk geçersiz");
    if (!q.q || q.q.trim().length < 8) h("soru kökü boş/kısa");
    if (!Array.isArray(q.o) || q.o.length !== 5) { h("şık sayısı 5 değil"); continue; }
    if (q.o.some(x => typeof x !== "string" || !x.trim())) h("boş şık");
    if (new Set(q.o.map(x => x.trim().toLocaleLowerCase("tr").replace(/\s+/g, " "))).size !== 5) h("şıklar birbirinden farklı değil");
    if (!Number.isInteger(q.a) || q.a < 0 || q.a > 4) h("a geçersiz");
    if (q.o.some(x => YASAK.test(x.trim()))) h("yasak şık (hepsi/hiçbiri)");
    if (!q.x || q.x.trim().length < 15 || /açıklama eklenmedi/i.test(q.x)) h("açıklama eksik");
    // soru metnindeki öncüllü biçim: şıklar öncül kombinasyonu olmalı
    const onc = (((q.p || "") + "\n" + q.q).match(/(^|\n)\s*(I{1,3}|IV|V)[.)]\s/g) || []).length >= 2;
    if (onc && q.o.filter(x => /^(yalnız\s+)?(I{1,3}|IV|V)(\s|,|$)/i.test(x.trim())).length < 3) h("öncüllü soruda şıklar öncül kombinasyonu değil");
    // uzunluk yanlılığı: doğru şık tek başına en uzun ve diğerlerinden belirgin uzun
    const L = q.o.map(x => x.length), dog = L[q.a], dig = L.filter((_, i) => i !== q.a);
    if (dog > Math.max(...dig) * 1.6 && dog > 25) u("doğru şık diğerlerinden çok uzun");
    // tekrar / benzerlik
    const g = golge((q.p || "") + " " + q.q);
    for (const m of mevcut) if (m.s === q.s && jac(g, m.g) >= 0.8) { u("sitede var olan soruya çok benziyor: " + m.q.slice(0, 90)); break; }
    for (const y of yeni) if (y.s === q.s && jac(g, y.g) >= 0.8) { h(`${y.id} ile çok benziyor (tekrar)`); break; }
    yeni.push({ id: q.id, s: q.s, g, d: q.d, a: q.a, t: q.t });
  }
}

// dağılımlar
const sayim = (anahtar) => yeni.reduce((m, y) => (m[anahtar(y)] = (m[anahtar(y)] || 0) + 1, m), {});
const konum = sayim(y => "ABCDE"[y.a]), zor = sayim(y => y.d), ders = sayim(y => y.s);
const n = yeni.length;
for (const k in konum) if (n >= 40 && konum[k] / n > 0.28) uyarilar.push({ id: "-", f: "-", m: `cevap konumu dengesiz: ${k} = %${Math.round(100 * konum[k] / n)}` });

console.log(`Toplam ${n} soru · ders: ${JSON.stringify(ders)} · zorluk(1/2/3): ${zor[1] || 0}/${zor[2] || 0}/${zor[3] || 0} · doğru şık konumu: ${JSON.stringify(konum)}`);
console.log(`HATA: ${hatalar.length} · UYARI: ${uyarilar.length}`);
hatalar.slice(0, 50).forEach(e => console.log("  HATA ", e.id, "·", e.m));
uyarilar.slice(0, 50).forEach(e => console.log("  uyarı", e.id, "·", e.m));
fs.writeFileSync(new URL("./rapor/son-dogrulama.json", import.meta.url), JSON.stringify({ n, ders, zor, konum, hatalar, uyarilar }, null, 1));
process.exit(hatalar.length ? 1 : 0);
