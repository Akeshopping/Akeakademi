/* Konsept 4 · Eşik + Yaşayan Bilgi (Final)
   Tek kamera, tek yol: karanlık salonda kapı aralanır, kamera duraksamadan eşikten geçer,
   havada asılı gerçek ders sayfalarının arasından ilerler; son sayfa ekranı kaplar ve çalışma alanına dönüşür.
   Kamera konumu ve yönü tek bir eğriden gelir, sahne değişimi yoktur. Yolculuk ilerlemesi J (0..1):
   açılışta zamanla (yaklaşık 5 sn), sonrasında kaydırmayla ilerler. */
import { baslat, yumusak, kolay, clamp, KREM, GECE, isikDokusu } from "../../ortak/ortak.js";
import { SAYFA, sayfaCiz, sonSayfaCiz } from "../../ortak/sayfalar.js";

function huzmeDokusu(THREE) {
  const c = document.createElement("canvas"); c.width = 64; c.height = 256; const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, "rgba(255,236,205,.9)"); g.addColorStop(.35, "rgba(255,230,195,.35)"); g.addColorStop(1, "rgba(255,225,190,0)");
  x.fillStyle = g; x.fillRect(0, 0, 64, 256);
  const h = x.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, "rgba(0,0,0,1)"); h.addColorStop(.2, "rgba(0,0,0,0)"); h.addColorStop(.8, "rgba(0,0,0,0)"); h.addColorStop(1, "rgba(0,0,0,1)");
  x.globalCompositeOperation = "destination-out"; x.fillStyle = h; x.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

baslat({ kavram: "final", sure: 5, fov: 38, yolculuk: true, kur({ THREE, scene, camera, renderer, mobil, durum }) {
  scene.background = GECE.clone(); scene.fog = new THREE.Fog(GECE.clone(), 5, 36);
  const KG = 1.7, KY = 3.3, GY = 1.65, SON_Z = -34; /* kapı genişliği ve yüksekliği, göz hizası, son sayfanın konumu */
  scene.add(new THREE.HemisphereLight(0x2b2a24, 0x050504, .22));

  /* ---------- salon: yansıtıcı taş zemin, duvar, kasa, kanatlar, sütunlar ---------- */
  const zemin = new THREE.Mesh(new THREE.PlaneGeometry(60, 110), new THREE.MeshStandardMaterial({ color: 0x151513, roughness: .24, metalness: .55, envMapIntensity: .06 }));
  zemin.rotation.x = -Math.PI / 2; zemin.position.z = -12; scene.add(zemin);
  const duvarMat = new THREE.MeshStandardMaterial({ color: 0x181816, roughness: .95, metalness: 0, envMapIntensity: .04 });
  const dw = 30, dh = 14, kal = .6;
  [-(KG / 2 + dw / 2), KG / 2 + dw / 2].forEach(x => { const m = new THREE.Mesh(new THREE.BoxGeometry(dw, dh, kal), duvarMat); m.position.set(x, dh / 2, 0); scene.add(m); });
  const ustDuvar = new THREE.Mesh(new THREE.BoxGeometry(KG, dh - KY, kal), duvarMat); ustDuvar.position.set(0, KY + (dh - KY) / 2, 0); scene.add(ustDuvar);
  const kasaMat = new THREE.MeshPhysicalMaterial({ color: 0xB69A68, metalness: 1, roughness: .32, clearcoat: .3, envMapIntensity: 1.2 });
  const ka = .09;
  [[-KG / 2 - ka / 2, KY / 2, ka, KY + ka], [KG / 2 + ka / 2, KY / 2, ka, KY + ka], [0, KY + ka / 2, KG + ka * 2, ka]].forEach(([x, y, w, h]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, kal + .06), kasaMat); m.position.set(x, y, 0); scene.add(m); });
  const kanatMat = new THREE.MeshPhysicalMaterial({ color: 0x2a2a26, metalness: .4, roughness: .5, envMapIntensity: .8 });
  const KANAT = [-1, 1].map(yon => {
    const men = new THREE.Group(); men.position.set(yon * KG / 2, 0, kal / 2 - .04); scene.add(men);
    const p = new THREE.Mesh(new THREE.BoxGeometry(KG / 2, KY, .07), kanatMat); p.position.set(-yon * KG / 4, KY / 2, 0); men.add(p);
    const kenar = new THREE.Mesh(new THREE.BoxGeometry(.02, KY - .3, .08), kasaMat); kenar.position.set(-yon * (KG / 2 - .06), KY / 2, .01); men.add(kenar);
    return { men, yon };
  });
  const sutunMat = new THREE.MeshStandardMaterial({ color: 0x1c1c19, roughness: .6, metalness: .3, envMapIntensity: .08 });
  for (let i = 0; i < 4; i++) [-1, 1].forEach(y => { const s = new THREE.Mesh(new THREE.BoxGeometry(.55, 9, .55), sutunMat); s.position.set(y * (3.2 + i * .15), 4.5, 2.2 + i * 3.2); scene.add(s); });
  const kenarIsik = new THREE.DirectionalLight(0x8fb3a0, .5); kenarIsik.position.set(-6, 5, 8); scene.add(kenarIsik);

  /* kapıdan sızan sıcak ışık: nokta ışık, parıltı, zemine yayılan huzmeler */
  const kapiIsik = new THREE.PointLight(0xf1dfb6, 0, 14, 1.8); kapiIsik.position.set(0, 1.8, 1.2); scene.add(kapiIsik);
  const parilti = new THREE.Sprite(new THREE.SpriteMaterial({ map: isikDokusu(THREE), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
  parilti.position.set(0, 1.7, .5); parilti.scale.set(4.5, 6, 1); scene.add(parilti);
  const hd = huzmeDokusu(THREE), HUZME = [];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(KG * (.7 + i * .12), 7), new THREE.MeshBasicMaterial({ map: hd, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2 + .02 + i * .07; m.position.set((i - 2) * .05, .02 + i * .35, 3.6); scene.add(m); HUZME.push(m);
  }
  const havuz = new THREE.Mesh(new THREE.PlaneGeometry(5, 9), new THREE.MeshBasicMaterial({ map: isikDokusu(THREE), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
  havuz.rotation.x = -Math.PI / 2; havuz.position.set(0, .015, 3.4); scene.add(havuz);

  /* ---------- koridor: öğrenme yolu ---------- */
  const KORIDOR = [[0, GY, -.6], [.5, GY + .07, -6], [-.9, GY - .03, -11], [.9, GY + .07, -16], [1.5, GY - .03, -21], [0, GY + .05, -25.5], [0, GY, -29.5], [0, GY, SON_Z + 1.2]].map(p => new THREE.Vector3(...p));
  const kor = new THREE.CatmullRomCurve3(KORIDOR, false, "catmullrom", .4);
  let cur = null, curKat = "";
  /* kamera eğrisi salondan başlar ve koridor noktalarıyla aynı eğriye bağlanır; ekran oranına göre yalnızca başlangıç mesafesi değişir */
  function kameraEgrisi(a) {
    const z0 = a < .8 ? 11 : a < 1.05 ? 8.6 : 7, anahtar = String(z0);
    if (anahtar === curKat) return; curKat = anahtar;
    cur = new THREE.CatmullRomCurve3([new THREE.Vector3(0, GY + .05, z0), new THREE.Vector3(0, GY + .03, z0 * .5), new THREE.Vector3(0, GY + .01, 2.4), ...KORIDOR], false, "catmullrom", .4);
  }

  /* sayfalar: son sayfa hariç hepsi yolun iki yanında asılı */
  const HAZIR = SAYFA.slice(0, -1), SAY = HAZIR.length, cizimler = [];
  const SAYFALAR = HAZIR.map((v, i) => {
    const c = document.createElement("canvas"); c.width = 512; c.height = 724; sayfaCiz(c, v, false);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; cizimler.push([c, v, tex]);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 1.5), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xfff3e0, emissiveIntensity: .4, roughness: .7, metalness: 0, side: THREE.DoubleSide }));
    const u = .07 + i / (SAY - 1) * .86, merkez = kor.getPointAt(u), tan = kor.getTangentAt(u);
    const yan = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 1, 0)).normalize(), taraf = i % 2 ? -1 : 1;
    m.position.copy(merkez).addScaledVector(yan, taraf * (1.25 + (i % 3) * .3)).add(new THREE.Vector3(0, ((i * 37) % 7) / 7 - .4, 0));
    scene.add(m); return { m, y0: m.position.y, don: taraf * (.55 + (i % 3) * .12), faz: i * 1.3 };
  });
  /* son sayfa: çalışma ekranının başlığıyla aynı yazı. Yaklaşınca ekranı kaplar */
  const sc = document.createElement("canvas"); sc.width = 512; sc.height = 724; sonSayfaCiz(sc, false);
  const sTex = new THREE.CanvasTexture(sc); sTex.colorSpace = THREE.SRGBColorSpace; sTex.anisotropy = 8;
  const sonSayfa = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.97), new THREE.MeshBasicMaterial({ map: sTex, fog: false, toneMapped: false }));
  sonSayfa.position.set(0, GY, SON_Z); scene.add(sonSayfa);
  document.fonts && document.fonts.load('700 40px "AKE Sans"').then(() => { cizimler.forEach(([c, v, t]) => { sayfaCiz(c, v, true); t.needsUpdate = true; }); sonSayfaCiz(sc, true); sTex.needsUpdate = true; });

  /* ders yolları: yola paralel ışık çizgileri ve üzerlerinde ilerleyen ışık */
  const RENK = [0x7fae96, 0xB69A68, 0xD5DDCF, 0xE3CFA0];
  const CIZGI = RENK.map((r, k) => {
    const pts = []; for (let i = 0; i <= 120; i++) { const u = i / 120, p = kor.getPointAt(u), an = u * 9 + k * 1.6; pts.push(p.clone().add(new THREE.Vector3(Math.cos(an) * (1.5 + k * .25), Math.sin(an) * .25 - 1.15 + k * .06, 0))); }
    const egri = new THREE.CatmullRomCurve3(pts), geo = new THREE.TubeGeometry(egri, 360, .0045 + k * .001, 5, false);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: r, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(mesh);
    const isik = new THREE.Sprite(new THREE.SpriteMaterial({ map: isikDokusu(THREE), color: r, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); isik.scale.setScalar(.35); scene.add(isik);
    return { mesh, egri, isik, toplam: geo.index.count, k };
  });

  /* ışıkta süzülen toz: salonda ve koridorda */
  const N = mobil ? 380 : 800, pos = new Float32Array(N * 3), hiz = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos.set([(Math.random() - .5) * 7, Math.random() * 3.6, 7 - Math.random() * 41], i * 3); hiz[i] = .03 + Math.random() * .08; }
  const tg = new THREE.BufferGeometry(); tg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const toz = new THREE.Points(tg, new THREE.PointsMaterial({ size: .035, map: isikDokusu(THREE, "255,240,215", 64), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })); scene.add(toz);

  /* koridorda kamerayı izleyen yumuşak ışık ve son karelerde ekranı örten krem katman */
  const fener = new THREE.PointLight(0xf1dfb6, 0, 10, 1.4); scene.add(fener);
  const ortu = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ color: 0xF5F1E8, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false, toneMapped: false }));
  ortu.renderOrder = 999; ortu.frustumCulled = false; ortu.position.z = -.4; camera.add(ortu); scene.add(camera);

  const bg = new THREE.Color(), bak = new THREE.Vector3(), tmp = new THREE.Vector3(), tan = new THREE.Vector3();
  return {
    guncelle(d) {
      const { t, dt } = d, J = d.J, a = d.W / d.H;
      kameraEgrisi(a);
      /* kapı: önce ışık sızar, sonra kanatlar açılır */
      const ac = yumusak(.04, .26, J), sizinti = yumusak(0, .05, J), salon = 1 - yumusak(.24, .42, J), guc = Math.max(sizinti * .25, ac);
      KANAT.forEach(k => { k.men.rotation.y = k.yon * (.02 + ac * 1.35); });
      kapiIsik.intensity = 30 * guc * (1 - yumusak(.5, .8, J) * .6); parilti.material.opacity = .55 * guc * (1 - yumusak(.1, .2, J));
      HUZME.forEach((h, i) => { h.material.opacity = .16 * ac * (1 - yumusak(.14, .3, J)) * (1 + Math.sin(t * .7 + i) * .15); });
      havuz.material.opacity = .45 * ac * salon;
      toz.material.opacity = .8 * ac * (1 - yumusak(.86, .97, J));
      const p = tg.attributes.position; for (let i = 0; i < N; i++) { let y = p.getY(i) + hiz[i] * dt; if (y > 3.6) y = 0; p.setY(i, y); p.setX(i, p.getX(i) + Math.sin(t * .4 + i) * .0007); } p.needsUpdate = true;

      /* kamera: tek eğri, zamanla yumuşak hızlanıp yumuşak durur */
      const u = clamp(J * J * (3 - 2 * J)), cp = cur.getPointAt(u); cur.getTangentAt(u, tan);
      const yan = a > 1.05 ? -1.6 * (1 - yumusak(0, .26, J)) : 0, par = 1 - yumusak(.8, 1, J);
      camera.position.set(cp.x + yan + d.fx * .35 * par, cp.y - d.fy * .22 * par, cp.z);
      bak.copy(cp).addScaledVector(tan, 3).add(tmp.set(yan * .55 + d.fx * .2 * par, .1 * (1 - yumusak(.2, .4, J)) - d.fy * .12 * par, 0));
      camera.lookAt(bak);
      camera.fov = 38 + 6 * yumusak(.2, .5, J) - 3 * yumusak(.85, 1, J); camera.updateProjectionMatrix();
      fener.position.copy(camera.position).add(tmp.set(0, .5, -2.2)); fener.intensity = 14 * yumusak(.22, .4, J) * (1 - yumusak(.86, .98, J));

      /* sayfalar hafifçe süzülür */
      SAYFALAR.forEach(s => { s.m.position.y = s.y0 + Math.sin(t * .6 + s.faz) * .05; s.m.rotation.set(Math.sin(t * .4 + s.faz) * .04, s.don + Math.sin(t * .3 + s.faz) * .05, 0); });
      /* ders yolları kamera ilerledikçe çizilir */
      CIZGI.forEach(c => {
        const gi = kolay((J - .16 - c.k * .05) / .4); c.mesh.geometry.setDrawRange(0, Math.floor(c.toplam * gi / 3) * 3);
        const sol = 1 - yumusak(.84, .97, J); c.mesh.material.opacity = .85 * sol; c.isik.position.copy(c.egri.getPointAt((t * .03 + c.k * .23) % 1)); c.isik.material.opacity = gi * sol;
      });
      /* son: ışık büyür, her şey kırık beyaza döner, krem katman ekranı örter (canvas sonra çalışma alanına dönüşür) */
      const kr = yumusak(.82, .97, J);
      bg.copy(GECE).lerp(KREM, kr); scene.background.copy(bg); scene.fog.color.copy(bg); scene.fog.near = 5 + kr * 20; scene.fog.far = 36 - kr * 10;
      ortu.material.opacity = yumusak(.9, .995, J);
      renderer.toneMappingExposure = 1 + kr * .3;
    }
  };
} });
