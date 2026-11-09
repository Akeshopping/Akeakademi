/* Konsept 2 · Yaşayan Bilgi
   Ders sayfaları, karanlıkta kıvrılan bir öğrenme yolunun iki yanında asılı durur. Renkli ders yolları sayfaları birbirine bağlar.
   Kaydırınca kamera yol boyunca ilerler; son sayfa yaklaşır, ekranı doldurur ve kırık beyaz çalışma alanına dönüşür. */
import { baslat, yumusak, kolay, clamp, KREM, GECE, isikDokusu } from "../../ortak/ortak.js";

const SAYFA = [
  ["TYT · Matematik", "Fonksiyonlar", ["f(x) = 2x + 3", "f(g(x)) = 2g(x) + 3", "Tanım kümesi · görüntü kümesi"], "grafik"],
  ["TYT · Türkçe", "Paragraf", ["Ana düşünce, parçanın", "tamamına yayılan yargıdır.", "Yardımcı düşünceler onu destekler."], "satir"],
  ["AYT · Fizik", "Optik", ["Gelme açısı = yansıma açısı", "Düz aynada görüntü sanaldır."], "isin"],
  ["TYT · Kimya", "Mol kavramı", ["n = m / M", "1 mol = 6,02 · 10²³ tanecik"], "satir"],
  ["TYT · Biyoloji", "Hücre", ["Prokaryot: çekirdek zarı yok", "Ökaryot: zarlı organeller var"], "hucre"],
  ["TYT · Deneme", "Cevap kâğıdı", ["120 soru · 165 dakika"], "optik"],
  ["AYT · Tarih", "Kurtuluş Savaşı", ["1919 · Samsun", "1920 · TBMM", "1922 · Büyük Taarruz"], "zaman"],
  ["TYT · Coğrafya", "Türkiye'nin iklimi", ["Karadeniz: her mevsim yağışlı", "Akdeniz: yazlar sıcak ve kurak"], "cubuk"],
  ["AYT · Edebiyat", "Divan şiiri", ["Aruz ölçüsü", "Gazel · kaside · mesnevi"], "satir"],
  ["TYT · Geometri", "Üçgenler", ["İç açılar toplamı 180°", "Dış açı = uzak iki iç açı"], "ucgen"],
  ["YDT · İngilizce", "Tenses", ["had already started", "By the time we arrived…"], "satir"],
  ["Yanlış defteri", "Tekrar zamanı", ["3 soru bugün tekrar edilecek", "Fonksiyonlar · Hücre · Ses olayları"], "yanlis"],
  ["Bugün", "Çalışma masası", ["Kaldığın yerden devam et", "26 / 40 soru"], "son"]
];

function sayfaCiz(c, [ust, baslik, satir, tur], fontHazir) {
  const x = c.getContext("2d"), W = c.width, H = c.height, F = fontHazir ? '"AKE Sans"' : "system-ui,sans-serif";
  x.fillStyle = "#f3ede1"; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(90,70,40,${Math.random() * .035})`; x.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5); }
  x.fillStyle = "#7a5c22"; x.font = `700 22px ${F}`; x.fillText(ust.toLocaleUpperCase("tr-TR"), 44, 70);
  x.fillStyle = "#0d1b33"; x.font = `700 46px ${F}`; x.fillText(baslik, 44, 130);
  x.strokeStyle = "#c9a86a"; x.lineWidth = 3; x.beginPath(); x.moveTo(44, 152); x.lineTo(150, 152); x.stroke();
  x.font = `400 27px ${F}`; x.fillStyle = "#26334d"; satir.forEach((s, i) => x.fillText(s, 44, 210 + i * 44));
  const y0 = 230 + satir.length * 44; x.strokeStyle = "#0d1b33"; x.lineWidth = 3;
  if (tur === "grafik") { x.strokeStyle = "#c8c0b0"; x.lineWidth = 2; x.beginPath(); x.moveTo(60, y0 + 220); x.lineTo(460, y0 + 220); x.moveTo(110, y0 + 260); x.lineTo(110, y0); x.stroke(); x.strokeStyle = "#2f62e8"; x.lineWidth = 4; x.beginPath(); x.moveTo(70, y0 + 250); x.lineTo(440, y0 + 30); x.stroke(); }
  if (tur === "satir" || tur === "son") { x.fillStyle = "#d9d0bf"; for (let i = 0; i < 9; i++) x.fillRect(44, y0 + i * 30, 300 + ((i * 97) % 130), 10); }
  if (tur === "isin") { x.strokeStyle = "#0d1b33"; x.beginPath(); x.moveTo(60, y0 + 200); x.lineTo(460, y0 + 200); x.stroke(); x.strokeStyle = "#b4324b"; x.beginPath(); x.moveTo(100, y0 + 20); x.lineTo(260, y0 + 200); x.lineTo(420, y0 + 20); x.stroke(); x.setLineDash([8, 8]); x.strokeStyle = "#999"; x.beginPath(); x.moveTo(260, y0 + 200); x.lineTo(260, y0); x.stroke(); x.setLineDash([]); }
  if (tur === "hucre") { x.strokeStyle = "#17785f"; x.lineWidth = 4; x.beginPath(); x.ellipse(250, y0 + 130, 190, 120, 0, 0, 7); x.stroke(); x.fillStyle = "rgba(23,120,95,.18)"; x.beginPath(); x.arc(220, y0 + 130, 46, 0, 7); x.fill(); x.stroke(); }
  if (tur === "optik") { x.font = `600 17px ${F}`; for (let r = 0; r < 9; r++) { x.fillStyle = "#68718a"; x.fillText(String(r + 1), 44, y0 + 18 + r * 34); for (let k = 0; k < 5; k++) { x.beginPath(); x.arc(100 + k * 52, y0 + 12 + r * 34, 12, 0, 7); x.strokeStyle = "#0d1b33"; x.lineWidth = 2; x.stroke(); if ((r * 3 + k * 2) % 5 === 0) { x.fillStyle = "#0d1b33"; x.fill(); } } } }
  if (tur === "zaman") { x.strokeStyle = "#0d1b33"; x.beginPath(); x.moveTo(60, y0 + 80); x.lineTo(460, y0 + 80); x.stroke(); [100, 260, 420].forEach(px => { x.fillStyle = "#c9a86a"; x.beginPath(); x.arc(px, y0 + 80, 12, 0, 7); x.fill(); }); }
  if (tur === "cubuk") { [120, 70, 160, 90, 200].forEach((h, i) => { x.fillStyle = i === 4 ? "#2f62e8" : "#9fb0d6"; x.fillRect(70 + i * 80, y0 + 230 - h, 48, h); }); }
  if (tur === "ucgen") { x.strokeStyle = "#0d1b33"; x.beginPath(); x.moveTo(80, y0 + 230); x.lineTo(430, y0 + 230); x.lineTo(250, y0 + 20); x.closePath(); x.stroke(); }
  if (tur === "yanlis") { x.strokeStyle = "#b4324b"; x.lineWidth = 4; [0, 1, 2].forEach(i => { x.beginPath(); x.moveTo(60, y0 + 30 + i * 70); x.lineTo(90, y0 + 60 + i * 70); x.moveTo(90, y0 + 30 + i * 70); x.lineTo(60, y0 + 60 + i * 70); x.stroke(); x.fillStyle = "#d9d0bf"; x.fillRect(120, y0 + 38 + i * 70, 280, 12); }); }
  if (tur === "son") { x.fillStyle = "#0d1b33"; x.fillRect(44, H - 150, 230, 64); x.fillStyle = "#fff"; x.font = `700 26px ${F}`; x.fillText("Devam et", 92, H - 108); }
  x.strokeStyle = "rgba(13,27,51,.12)"; x.lineWidth = 2; x.strokeRect(1, 1, W - 2, H - 2);
}

baslat({ kavram: "yasayan", sure: 2.8, fov: 42, kur({ THREE, scene, camera, renderer, mobil, durum }) {
  scene.background = GECE.clone(); scene.fog = new THREE.FogExp2(GECE.clone(), .075);
  scene.add(new THREE.HemisphereLight(0x3a4f7a, 0x080a10, .9));
  const ana = new THREE.DirectionalLight(0xffe0b0, 1.6); ana.position.set(-3, 6, 4); scene.add(ana);
  const fener = new THREE.PointLight(0xffe2b8, 14, 9, 1.4); scene.add(fener);

  /* öğrenme yolu */
  const P = [[0, 0, 6], [.6, .2, 1], [-1.2, .6, -4], [.8, -.2, -9], [2.2, .8, -14], [0, .4, -19], [-1.6, -.3, -24], [0, .2, -29], [0, .2, -33]].map(p => new THREE.Vector3(...p));
  const yol = new THREE.CatmullRomCurve3(P, false, "catmullrom", .4);

  /* sayfalar */
  const cizimler = [], SAY = SAYFA.length;
  const SAYFALAR = SAYFA.map((v, i) => {
    const c = document.createElement("canvas"); c.width = 512; c.height = 724; sayfaCiz(c, v, false);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; cizimler.push([c, v, tex]);
    const son = i === SAY - 1;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 1.5), son ? new THREE.MeshBasicMaterial({ color: 0xf5f0e6, side: THREE.DoubleSide, fog: false, toneMapped: false }) : new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xfff3e0, emissiveIntensity: .34, roughness: .7, metalness: 0, side: THREE.DoubleSide }));
    const u = son ? .985 : .13 + i / (SAY - 1) * .8, merkez = yol.getPointAt(u), tan = yol.getTangentAt(u);
    const yan = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 1, 0)).normalize(), taraf = i % 2 ? -1 : 1;
    const hedef = son ? merkez.clone() : merkez.clone().addScaledVector(yan, taraf * (1.25 + (i % 3) * .3)).add(new THREE.Vector3(0, ((i * 37) % 7) / 7 - .4, 0));
    const don = son ? 0 : taraf * (.55 + (i % 3) * .12);
    const dagin = new THREE.Vector3((Math.random() - .5) * 14, (Math.random() - .5) * 8, hedef.z + (Math.random() - .5) * 10);
    scene.add(m); return { m, hedef, don, dagin, son, faz: i * 1.3, gec: i / SAY };
  });
  document.fonts && document.fonts.load('700 40px "AKE Sans"').then(() => cizimler.forEach(([c, v, t]) => { sayfaCiz(c, v, true); t.needsUpdate = true; }));

  /* ders yolları: yola paralel ince ışık çizgileri ve üzerlerinde ilerleyen ışık */
  const RENK = [0x5b86ff, 0xd9b46e, 0x3fbf9d, 0xb48ad8];
  const CIZGI = RENK.map((r, k) => {
    const pts = []; for (let i = 0; i <= 120; i++) { const u = i / 120, p = yol.getPointAt(u), a = u * 9 + k * 1.6; pts.push(p.clone().add(new THREE.Vector3(Math.cos(a) * (1.5 + k * .25), Math.sin(a) * .25 - 1.15 + k * .06, 0))); }
    const egri = new THREE.CatmullRomCurve3(pts), geo = new THREE.TubeGeometry(egri, 420, .0045 + k * .001, 5, false);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: r, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(mesh);
    const isik = new THREE.Sprite(new THREE.SpriteMaterial({ map: isikDokusu(THREE), color: r, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); isik.scale.setScalar(.35); scene.add(isik);
    return { mesh, egri, isik, toplam: geo.index.count, k };
  });
  /* zerreler */
  const N = mobil ? 300 : 700, pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) pos.set([(Math.random() - .5) * 14, (Math.random() - .5) * 7, 6 - Math.random() * 42], i * 3);
  const tg = new THREE.BufferGeometry(); tg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const toz = new THREE.Points(tg, new THREE.PointsMaterial({ size: .05, map: isikDokusu(THREE, "255,235,200", 64), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); scene.add(toz);

  const bg = new THREE.Color(), bak = new THREE.Vector3(), tmp = new THREE.Vector3();
  return {
    guncelle(d) {
      const { g, s, t } = d, a = d.W / d.H;
      const yolU = yumusak(0, .82, s) * .9, isik = yumusak(.74, .97, s);
      /* kamera yolda ilerler; açılışta biraz geriden yaklaşır */
      const u = clamp(.015 + yolU), cp = yol.getPointAt(Math.min(u, .93));
      const geri = (1 - kolay(g)) * 3.5, ileri = yol.getPointAt(Math.min(.999, u + .05));
      const yanKay = a > 1.05 ? -.9 * (1 - yumusak(0, .3, s)) : 0;
      camera.position.set(cp.x + yanKay + d.fx * .3, cp.y + .15 - d.fy * .2, cp.z + geri);
      bak.copy(ileri).add(tmp.set(yanKay * .3 + d.fx * .4, -d.fy * .2, 0)); camera.lookAt(bak);
      fener.position.copy(camera.position).add(tmp.set(0, .6, -2.5));
      /* sayfalar: açılışta dağınıktan yerine uçar, sonra hafifçe salınır */
      SAYFALAR.forEach((p, i) => {
        const gi = kolay((g - .1 - p.gec * .45) / .45);
        p.m.position.lerpVectors(p.dagin, p.hedef, gi);
        p.m.position.y += Math.sin(t * .6 + p.faz) * .05 * (p.son ? 0 : 1);
        p.m.rotation.set(Math.sin(t * .4 + p.faz) * .04, p.don + (1 - gi) * 2.2 + Math.sin(t * .3 + p.faz) * .05, (1 - gi) * .6);
        p.m.material.opacity = 1;
        if (p.son) { const yak = yumusak(.7, .97, s); p.m.position.lerp(tmp.copy(camera.position).add(new THREE.Vector3(0, 0, -.62)), yak * .98); p.m.lookAt(camera.position); }
      });
      /* yollar açılışta çizilir */
      CIZGI.forEach(c => {
        const gi = kolay((g - .25 - c.k * .08) / .55); c.mesh.geometry.setDrawRange(0, Math.floor(c.toplam * gi / 3) * 3);
        c.mesh.material.opacity = .85 * (1 - isik); const v = ((t * .03 + c.k * .23) % 1); c.isik.position.copy(c.egri.getPointAt(v)); c.isik.material.opacity = gi * (1 - isik);
      });
      toz.material.opacity = .6 * kolay(g) * (1 - isik);
      bg.copy(GECE).lerp(KREM, isik); scene.background.copy(bg); scene.fog.color.copy(bg); scene.fog.density = .075 * (1 - isik * .9);
      renderer.toneMappingExposure = 1 + isik * .5;
    }
  };
} });
