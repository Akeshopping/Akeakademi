import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const yardimcilar = html.split("\n").filter(s => s.startsWith("function atlHareketAz(") || s.startsWith("function atlMobil("));
const kaynak = yardimcilar.join("\n") + "\n" + html.slice(html.indexOf("let atlAcilisBasladi"), html.indexOf("function atlKur()"));
const ORIGIN = "https://ake.example.test";

function olaylar(el = {}) {
  const dinleyenler = new Map();
  return Object.assign(el, {
    addEventListener(ad, fn) { dinleyenler.set(ad, fn); },
    removeEventListener(ad, fn) { if (dinleyenler.get(ad) === fn) dinleyenler.delete(ad); },
    tetikle(ad, olay) { dinleyenler.get(ad)?.(olay); }
  });
}
function ortam({ width = 768, height = 1024, az = false, hareket = "on" } = {}) {
  let zaman = 1, sira = 0, kareler = 0;
  const kuyruk = new Map(), ekranda = [];
  const zamanla = (fn, ms) => { const id = ++sira; kuyruk.set(id, { fn, zaman: zaman + ms }); return id; };
  function ilerle(ms) {
    const son = zaman + ms;
    while (true) {
      const siradaki = [...kuyruk].sort((a, b) => a[1].zaman - b[1].zaman)[0];
      if (!siradaki || siradaki[1].zaman > son) break;
      const [id, gorev] = siradaki;
      kuyruk.delete(id); zaman = gorev.zaman; gorev.fn();
    }
    zaman = son;
  }
  function eleman(tag) {
    const el = olaylar({ tag, classList: new Set(), cocuklar: [], setAttribute() {},
      append(...kids) { this.cocuklar.push(...kids); },
      remove() { ekranda.splice(ekranda.indexOf(this), 1); },
      contentWindow: tag === "iframe" ? {} : undefined
    });
    if (tag === "div") {
      const btn = eleman("button"), logo = { classList: new Set() };
      const islev = () => {};
      const canvas = { getContext: () => ({ clearRect() { kareler++; }, createRadialGradient: () => ({ addColorStop: islev }),
        fillRect: islev, beginPath: islev, moveTo: islev, lineTo: islev, stroke: islev, arc: islev, fill: islev }) };
      el.querySelector = ad => ({ canvas, ".lg": logo, ".atl-skip": btn })[ad];
    }
    return el;
  }
  const window = olaylar({ devicePixelRatio: 2, matchMedia: () => ({ matches: az }) });
  const document = olaylar({ createElement: eleman, body: { appendChild(el) { ekranda.push(el); } },
    getElementById: id => ekranda.find(el => el.id === id) });
  const ctx = { window, document, location: { origin: ORIGIN }, innerWidth: width, innerHeight: height,
    navigator: { hardwareConcurrency: 4 }, ERISIM: { hareket }, matchMedia: window.matchMedia,
    setTimeout: zamanla, clearTimeout: id => kuyruk.delete(id),
    requestAnimationFrame: fn => zamanla(() => fn(zaman), 16), cancelAnimationFrame: id => kuyruk.delete(id) };
  runInNewContext(kaynak, ctx);
  const acilis = () => document.getElementById("atlIntro");
  function mesaj(ake, { origin = ORIGIN, source = acilis()?.cocuklar[0]?.contentWindow } = {}) {
    window.tetikle("message", { origin, source, data: { ake } });
  }
  return { baslat: ctx.atlIntro, acilis, ilerle, mesaj, document, kareler: () => kareler };
}

for (const width of [768, 820]) {
  test(width + " px görünümünde 3B ilk kareden sonra sürer ve bitişte kapanır", () => {
    const s = ortam({ width }); s.baslat();
    assert.equal(s.acilis().className, "atl-intro3d");
    s.ilerle(1000); s.mesaj("acilis-hazir"); s.ilerle(5000);
    assert.equal(s.acilis().className, "atl-intro3d");
    s.mesaj("acilis-bitti"); s.ilerle(600);
    assert.equal(s.acilis(), undefined);
    s.baslat(); assert.equal(s.acilis(), undefined);
    s.baslat(true); assert.equal(s.acilis().className, "atl-intro3d");
  });
}
test("Kare gelmezse 2B devreye girer, çizilir ve bir kez oynar", () => {
  const s = ortam(); s.baslat(); s.ilerle(4500);
  assert.equal(s.acilis().className, "atl-intro");
  s.ilerle(500); assert.ok(s.kareler() > 0);
  s.ilerle(3000); assert.equal(s.acilis(), undefined);
  s.baslat(); assert.equal(s.acilis(), undefined);
});
test("3B sahne hata verirse beklemeden 2B devreye girer", () => {
  const s = ortam(); s.baslat(); s.mesaj("acilis-hata");
  assert.equal(s.acilis().className, "atl-intro");
});
test("Başka çerçeveden veya kökenden gelen mesaj açılışı bitirmez", () => {
  const s = ortam(); s.baslat();
  s.mesaj("acilis-bitti", { source: {} });
  s.mesaj("acilis-bitti", { origin: "https://diger.example.test" });
  s.ilerle(600);
  assert.equal(s.acilis().classList.has("out"), false);
});
test("3B hazır olsa da bitiş gelmezse sayfa açılır", () => {
  const s = ortam(); s.baslat(); s.mesaj("acilis-hazir"); s.ilerle(20600);
  assert.equal(s.acilis(), undefined);
});
test("Geç düğmesi ve Escape 3B yüklemesi tamamlanmadan çalışır", () => {
  for (const atla of [s => s.acilis().cocuklar[1].tetikle("click", {}), s => s.document.tetikle("keydown", { key: "Escape" })]) {
    const s = ortam(); s.baslat(); atla(s); s.ilerle(5000);
    assert.equal(s.acilis(), undefined);
    assert.equal(s.kareler(), 0);
  }
});
test("Sistem veya site hareketi azaltıyorsa açılış gösterilmez", () => {
  for (const ayar of [{ az: true }, { hareket: "off" }]) {
    const s = ortam(ayar); s.baslat(); s.baslat(true);
    assert.equal(s.acilis(), undefined);
  }
});

test("Sahne WebGL bağlamı açamazsa üst sayfaya hata bildirir", async t => {
  const mesajlar = [];
  const getContext = t.mock.fn(() => null);
  const canvas = { style: {}, addEventListener() {}, setAttribute() {}, getContext };
  const globalDegerler = {
    document: { documentElement: { classList: new Set() }, querySelector: s => s === "#sahne" ? canvas : null },
    matchMedia: () => ({ matches: false }), innerWidth: 820, innerHeight: 1180,
    location: { origin: ORIGIN, search: "?sinema=1" },
    parent: { postMessage: (data, origin) => mesajlar.push({ data, origin }) }
  };
  for (const [k, v] of Object.entries(globalDegerler)) {
    const onceki = Object.getOwnPropertyDescriptor(globalThis, k);
    Object.defineProperty(globalThis, k, { configurable: true, writable: true, value: v });
    t.after(() => { if (onceki) Object.defineProperty(globalThis, k, onceki); else delete globalThis[k]; });
  }
  t.mock.method(console, "error", () => {});
  const { baslat } = await import("../acilis/ortak/ortak.js");
  baslat({ kavram: "final" });
  assert.ok(getContext.mock.callCount() > 0);
  assert.deepEqual(mesajlar, [{ data: { ake: "acilis-hata" }, origin: ORIGIN }]);
});

test("Çevrimdışıyken açılış çerçevesine ana sayfanın HTML'i gönderilmez", async () => {
  const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  let fetchIsleyici;
  const self = { addEventListener(ad, fn) { if (ad === "fetch") fetchIsleyici = fn; } };
  const caches = { match: async k => k === "/" ? new Response("ana sayfa") : undefined };
  runInNewContext(sw, { self, caches, location: { origin: ORIGIN }, URL, Response,
    fetch: async () => { throw new Error("çevrimdışı"); } });
  const gezin = yol => new Promise(resolve => fetchIsleyici({
    request: { method: "GET", mode: "navigate", url: ORIGIN + yol, headers: new Headers() }, respondWith: resolve
  }));
  assert.equal((await gezin("/acilis/sinema/?sinema=1")).type, "error");
  assert.equal(await (await gezin("/sss/")).text(), "ana sayfa");
});
