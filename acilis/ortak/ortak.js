/* AKE Akademi · açılış sahneleri için ortak altyapı
   Three.js yerel dosyadan yüklenir (CDN yok). Görünmezken, sekme gizliyken ve hareket azaltıldığında çizim durur. */
import * as THREE from "three";
import { RoomEnvironment } from "./RoomEnvironment.js";

const $ = s => document.querySelector(s);
const D = document.documentElement;
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const yumusak = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
export const kolay = t => 1 - Math.pow(1 - clamp(t), 3);
export const KREM = new THREE.Color("#F5F1E8"), GECE = new THREE.Color("#171715");

function depo(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

/* ---------- çalışma katmanındaki örnek panel (bütün konseptlerde aynı) ---------- */
function panelYaz() {
  const el = $("#calisma"); if (!el) return;
  const net = [61.25, 64.5, 63, 68.25, 71.5], mx = 75, mn = 55, W = 300, H = 64;
  const pts = net.map((v, i) => [12 + i * (W - 24) / 4, H - 8 - (v - mn) / (mx - mn) * (H - 16)]);
  el.innerHTML = `<div class="w">
    <div class="cal-bas"><div><div class="tarih">Pazartesi, 9 Kasım · YKS'ye 223 gün</div><h2>Bugün 40 soru hedefin var. 26'sını çözdün.</h2></div><span class="ornek-et">Örnek veri · senin panelin kendi çalışmanla dolar</span></div>
    <div class="pano">
      <section class="devam" aria-labelledby="dv-b"><div class="k-bas">Kaldığın yerden devam et</div><h3 id="dv-b">Türkçe · Paragraf</h3><p>10 soruluk sette 6. sorudasın. 4 doğru, 1 yanlış.</p>
        <div class="seg" aria-hidden="true"><i class="d"></i><i class="d"></i><i class="y"></i><i class="d"></i><i class="d"></i><i class="s"></i><i></i><i></i><i></i><i></i></div>
        <a class="btn" href="../../calisma/soru.html">Devam et</a></section>
      <section class="blok hedef" aria-labelledby="hd-b"><div class="k-bas" id="hd-b">Günlük hedef</div><div class="buyuk">26 <small>/ 40 soru</small></div><div class="cubuk" aria-hidden="true"><u style="width:65%"></u></div><p class="aciklama">Bir set daha çözersen hedef tamam.</p></section>
      <section class="blok net" aria-labelledby="nt-b"><div class="k-bas" id="nt-b">TYT net gelişimi</div><div class="buyuk">71,5 <small>net · son 5 deneme</small></div>
        <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Son beş deneme: 61,25 netten 71,5 nete"><polyline points="${pts.map(p => p.join(",")).join(" ")}" fill="none" stroke="#1c1b18" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="${i === 4 ? 5 : 3}" fill="${i === 4 ? "#254236" : "#1c1b18"}"/>`).join("")}</svg></section>
      <section class="blok zayif" aria-labelledby="zy-b"><div class="k-bas" id="zy-b">Zayıf konular</div><ul class="liste">
        <li><span><b>Fonksiyonlar</b><small>AYT Matematik · 13 soruda 5 doğru</small></span><span class="oran">%38</span></li>
        <li><span><b>Hücre bölünmeleri</b><small>Biyoloji · 9 soruda 4 doğru</small></span><span class="oran">%44</span></li>
        <li><span><b>Ses olayları</b><small>Türkçe · 12 soruda 6 doğru</small></span><span class="oran">%50</span></li></ul></section>
      <section class="blok ai" aria-labelledby="ai-b"><div class="k-bas" id="ai-b">AI öğretmen önerisi</div><p>Fonksiyonlarda yanlışlarının çoğu bileşke fonksiyondan. Önce 5 dakikalık kısa bir tekrar, sonra 10 soru öneriyorum.</p><a class="btn ikincil kucuk" href="https://akeakademi.com/#ogretmen">AI öğretmene sor</a></section>
      <section class="blok program" aria-labelledby="pr-b"><div class="k-bas" id="pr-b">Yaklaşan program</div><ul class="liste">
        <li><span><b>Bugün · Fonksiyonlar</b><small>20 soru · yaklaşık 35 dakika</small></span><a class="btn metin kucuk" href="../../calisma/soru.html">Başla</a></li>
        <li><span><b>Yarın · Hücre bölünmeleri</b><small>10 soru ve tekrar kartları</small></span><span></span></li>
        <li><span><b>Pazar 20:00 · Canlı TYT denemesi</b><small>120 soru · 165 dakika · Türkiye sıralaması</small></span><span></span></li></ul></section>
    </div></div>`;
}

/* ---------- ana başlatıcı ---------- */
export function baslat({ kavram, sure = 2.6, kur, fov = 35, yolculuk = false }) {
  panelYaz();
  const azHareket = (() => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches || depo("ake.hareket") === "kapali"; } catch (e) { return false; } })();
  const mobil = Math.min(innerWidth, innerHeight) < 700 || matchMedia("(pointer: coarse)").matches;
  if (azHareket) D.classList.add("az");
  if (yolculuk) D.classList.add("yolculuk");
  /* ?sinema: ana sitede tam ekran iframe olarak oynar; her seferinde oynar, bitince üst sayfaya haber verir */
  const sinema = /[?&]sinema/.test(location.search);
  const haber = m => { if (!sinema) return; try { parent.postMessage({ ake: m }, location.origin); } catch (e) { } };
  const cv = $("#sahne"), ust = $(".ust"), atla = $(".atla"), gyazi = $(".gecis-yazi"), kutu = $(".acilis .metin-kutu");
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: !mobil, powerPreference: "high-performance" }); }
  catch (e) { D.classList.add("webgl-yok"); cv.style.background = "radial-gradient(60% 60% at 60% 45%,#254236,#171715 70%)"; return; }
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(fov, 1, .05, 200);
  const pm = new THREE.PMREMGenerator(renderer); const env = pm.fromScene(new RoomEnvironment(renderer), .04).texture; scene.environment = env;
  let oran = Math.min(devicePixelRatio || 1, mobil ? 1.5 : 2), yavas = 0;
  const durum = { t: 0, g: azHareket ? 1 : 0, s: 0, fx: 0, fy: 0, dt: 0, mobil, azHareket, W: 1, H: 1 };
  const sahne = kur({ THREE, scene, camera, renderer, env, mobil, durum });

  function boyut() { const w = innerWidth, h = innerHeight; durum.W = w; durum.H = h; renderer.setPixelRatio(oran); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  addEventListener("resize", () => { boyut(); ciz(); });
  boyut();

  /* kaydırma ilerlemesi: açılıştan çalışma alanına */
  function kaydirma() {
    const g = $(".gecis"), son = yolculuk ? Math.min(g.offsetTop + g.offsetHeight, D.scrollHeight - innerHeight) : g.offsetTop + g.offsetHeight - innerHeight;
    return clamp(scrollY / Math.max(1, son));
  }
  /* tek parça yolculukta çalışma alanının tepesi yolculuğun bittiği yerdir */
  function calismayaGit() { const g = $(".gecis"); scrollTo({ top: g.offsetTop + g.offsetHeight, behavior: "instant" }); }
  /* fare ve dokunma: kontrollü derinlik */
  const hedefFare = { x: 0, y: 0 };
  addEventListener("pointermove", e => { if (e.pointerType === "mouse") { hedefFare.x = e.clientX / innerWidth * 2 - 1; hedefFare.y = e.clientY / innerHeight * 2 - 1; } }, { passive: true });

  let son = 0, dongu = 0, gorunur = true, kayit = false;
  /* açılış */
  let acilisBasi = 0, acilisT = 0, oynuyor = false;
  const anahtar = "ake.acilis." + kavram;
  function acilisBitir(kaydet) {
    oynuyor = false; D.classList.remove("oynuyor", "kilit"); setTimeout(() => kutu && kutu.classList.add("serbest"), 1000); durum.g = 1; if (kaydet !== false && !sinema) depo(anahtar, "goruldu");
    haber("acilis-bitti");
    if (yolculuk && !azHareket && !sinema) { calismayaGit(); const c = $("#calisma"); if (c) { c.classList.add("gir"); setTimeout(() => c.classList.remove("gir"), 1200); } }
    ciz();
  }
  function acilisOyna() { if (azHareket) { acilisBitir(false); return; } durum.g = 0; acilisBasi = 0; acilisT = 0; oynuyor = true; D.classList.add("oynuyor"); if (yolculuk) D.classList.add("kilit"); scrollTo({ top: 0, behavior: "instant" }); calistir(); }
  atla.addEventListener("click", () => acilisBitir());
  addEventListener("keydown", e => { if (e.key === "Escape" && oynuyor) acilisBitir(); });
  const tekrar = $("#tekrar"); if (tekrar) tekrar.addEventListener("click", acilisOyna);
  const hb = $("#hareket");
  if (hb) { hb.textContent = azHareket ? "Hareketi aç" : "Hareketi kapat"; hb.addEventListener("click", () => { depo("ake.hareket", azHareket ? "acik" : "kapali"); location.reload(); }); }
  if (sinema ? azHareket : (depo(anahtar) === "goruldu" || azHareket)) acilisBitir(false); else acilisOyna();
  haber("acilis-hazir");

  /* çizim */
  function ciz() {
    durum.s = azHareket ? 0 : kaydirma(); durum.oyn = oynuyor;
    durum.J = !yolculuk ? 0 : azHareket ? .1 : oynuyor ? durum.g : sinema ? 1 : durum.s;
    sahne.guncelle(durum);
    renderer.render(scene, camera);
    if (sahne.etiketler) sahne.etiketler(durum);
    /* DOM ile eşleşen geçiş */
    const s = durum.s;
    if (yolculuk) {
      const J = durum.J, sol = 1 - yumusak(.05, .24, J), ac = $(".acilis"); if (ac) ac.style.setProperty("--karart", String(sol));
      if (kutu) { kutu.style.opacity = String(sol); kutu.style.transform = `translateY(${(1 - sol) * -26}px)`; }
      const bitti = !sinema && !oynuyor && s >= .995 && !azHareket; cv.classList.toggle("bitti", bitti);
      const hsl2 = {}; scene.background && scene.background.isColor && scene.background.getHSL(hsl2); ust.classList.toggle("acik", s > .98 || (hsl2.l || 0) > .55);
      return;
    }
    const ac = $(".acilis"); if (ac) ac.style.setProperty("--karart", String(1 - yumusak(.02, .22, s)));
    if (kutu && !oynuyor) { kutu.style.opacity = String(1 - yumusak(.02, .22, s)); kutu.style.transform = `translateY(${-s * 60}px)`; }
    if (gyazi) { gyazi.style.opacity = String(yumusak(.14, .24, s) * (1 - yumusak(.34, .44, s))); }
    const hsl = {}; scene.background && scene.background.isColor && scene.background.getHSL(hsl); ust.classList.toggle("acik", s > .8 || (hsl.l || 0) > .55);
    cv.style.opacity = String(1 - yumusak(.94, 1, s));
    cv.style.visibility = s >= 1 ? "hidden" : "visible";
  }
  function adim(z) {
    dongu = 0; if (kayit) return;
    const dt = son ? Math.min(.05, (z - son) / 1000) : .016; son = z; durum.dt = dt; durum.t += dt;
    if (oynuyor) { acilisT += Math.min(dt, .066); durum.g = clamp(acilisT / sure); if (durum.g > .72) D.classList.remove("oynuyor"); if (durum.g >= 1) acilisBitir(); }
    const k = 1 - Math.exp(-dt * 3); durum.fx += (hedefFare.x - durum.fx) * k; durum.fy += (hedefFare.y - durum.fy) * k;
    if (mobil) { durum.fx = Math.sin(durum.t * .25) * .25; durum.fy = Math.cos(durum.t * .2) * .12; }
    ciz();
    /* uyarlanır kalite: kareler yavaşsa çözünürlüğü düşür */
    if (dt > .028) yavas++; else yavas = Math.max(0, yavas - 1);
    if (yavas > 60 && oran > .75) { oran = Math.max(.75, oran - .5); yavas = 0; boyut(); }
    if (gorunur && !document.hidden && durum.s < 1) dongu = requestAnimationFrame(adim);
  }
  function calistir() { if (azHareket) { ciz(); return; } if (!dongu) { son = 0; dongu = requestAnimationFrame(adim); } }
  addEventListener("scroll", () => { if (azHareket) return; if (kaydirma() < 1) calistir(); else ciz(); }, { passive: true });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) calistir(); });
  calistir(); ciz();

  /* kayıt için belirli kareyi çizme (yalnızca ekran kaydında kullanılır) */
  window.__kare = (t, g) => { durum.t = t; durum.dt = 1 / 30; if (g != null) { durum.g = g; oynuyor = g < 1; D.classList.toggle("oynuyor", g < .72); } ciz(); };
  window.__dur = () => { kayit = true; cancelAnimationFrame(dongu); dongu = 0; };
  return { THREE, scene, camera, durum };
}

/* 3B noktayı ekrana yansıtıp HTML etiketini yerleştirir */
export function etiketYerlestir(THREE, camera, durum, el, p, gorunurluk = 1) {
  const v = p.clone().project(camera); const x = (v.x * .5 + .5) * durum.W, y = (1 - (v.y * .5 + .5)) * durum.H;
  el.style.transform = `translate(calc(${x.toFixed(1)}px - 50%),calc(${y.toFixed(1)}px - 100%))`;
  el.style.opacity = v.z < 1 ? String(clamp(gorunurluk)) : "0";
}

/* yumuşak ışık lekesi dokusu (parıltı, toz, ışık huzmesi için) */
export function isikDokusu(THREE, renk = "255,240,214", boy = 128) {
  const c = document.createElement("canvas"); c.width = c.height = boy; const x = c.getContext("2d"), g = x.createRadialGradient(boy / 2, boy / 2, 0, boy / 2, boy / 2, boy / 2);
  g.addColorStop(0, `rgba(${renk},1)`); g.addColorStop(.25, `rgba(${renk},.55)`); g.addColorStop(.6, `rgba(${renk},.12)`); g.addColorStop(1, `rgba(${renk},0)`);
  x.fillStyle = g; x.fillRect(0, 0, boy, boy); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
