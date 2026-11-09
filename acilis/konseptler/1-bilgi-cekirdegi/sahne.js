/* Konsept 1 · Bilgi Çekirdeği
   Işıklı bir çekirdek, onu saran cam küre ve farklı eğimlerde dönen metal ve cam halkalar.
   Dersler halkaların üzerinde yörüngede döner. Kaydırınca halkalar kameraya dönüp bir göz bebeği gibi açılır,
   kamera çekirdeğin içinden geçer ve ışık sıcak kırık beyaz çalışma alanına dönüşür. */
import { baslat, yumusak, kolay, clamp, KREM, GECE, etiketYerlestir, isikDokusu } from "../../ortak/ortak.js";

const DERS = [["Matematik", "#5b86ff"], ["Türkçe", "#d9b46e"], ["Fen", "#3fbf9d"], ["Edebiyat", "#d48b6c"], ["Tarih", "#b48ad8"], ["Coğrafya", "#6cc3d8"], ["Felsefe", "#e3cf8f"], ["İngilizce", "#9fb0d6"]];

baslat({ kavram: "cekirdek", sure: 2.8, kur({ THREE, scene, camera, renderer, mobil, durum }) {
  scene.background = GECE.clone(); scene.fog = new THREE.Fog(GECE.clone(), 7, 20);
  const kok = new THREE.Group(); scene.add(kok);

  /* ışıklar: sıcak ana ışık, soğuk kenar ışığı, çekirdekten yayılan nokta ışık */
  const ana = new THREE.DirectionalLight(0xffe2b4, 2.4); ana.position.set(-4, 5, 6); scene.add(ana);
  const kenar = new THREE.DirectionalLight(0x6d93ff, 3.2); kenar.position.set(5, -1, -5); scene.add(kenar);
  const ic = new THREE.PointLight(0xffd59a, 0, 7, 1.5); kok.add(ic);
  scene.add(new THREE.HemisphereLight(0x22355a, 0x05080f, .6));

  /* çekirdek ve parıltı */
  const cekirdek = new THREE.Mesh(new THREE.SphereGeometry(.12, 48, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(5, 4.4, 3.4) }));
  kok.add(cekirdek);
  const pMat = new THREE.SpriteMaterial({ map: isikDokusu(THREE), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 });
  const parilti = new THREE.Sprite(pMat); parilti.scale.setScalar(3.4); kok.add(parilti);
  const hale = new THREE.Sprite(new THREE.SpriteMaterial({ map: isikDokusu(THREE, "90,130,255"), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .0 }));
  hale.scale.setScalar(9); hale.position.z = -2; kok.add(hale);

  /* cam küre */
  const camMat = new THREE.MeshPhysicalMaterial({ color: 0xe4ecff, metalness: 0, roughness: .05, transmission: 1, thickness: .55, ior: 1.45, clearcoat: 1, clearcoatRoughness: .04, iridescence: .35, iridescenceIOR: 1.3, envMapIntensity: 1.3, transparent: true });
  const kure = new THREE.Mesh(new THREE.SphereGeometry(.62, 64, 48), camMat); kok.add(kure);

  /* halkalar: altın, cam, çelik; her biri farklı eğimde */
  const altin = new THREE.MeshPhysicalMaterial({ color: 0xd9b980, metalness: 1, roughness: .2, clearcoat: .5, clearcoatRoughness: .2, envMapIntensity: 1.4 });
  const celik = new THREE.MeshPhysicalMaterial({ color: 0xbac4d8, metalness: 1, roughness: .26, envMapIntensity: 1.3 });
  const camHalka = new THREE.MeshPhysicalMaterial({ color: 0xd2e2ff, metalness: 0, roughness: .08, transmission: 1, thickness: .3, ior: 1.5, clearcoat: 1, envMapIntensity: 1.4, transparent: true });
  const VERI = [{ r: 1.0, k: .02, m: altin, e: [1.15, .1, .35], h: .16 }, { r: 1.3, k: .055, m: camHalka, e: [.35, .7, 0], h: -.1 }, { r: 1.58, k: .016, m: celik, e: [-.55, .25, .85], h: .07 }, { r: 1.9, k: .028, m: altin, e: [1.52, -.45, -.2], h: -.05 }];
  const HALKA = VERI.map((v, i) => {
    const pivot = new THREE.Group(); pivot.rotation.set(...v.e); kok.add(pivot);
    const don = new THREE.Group(); pivot.add(don);
    const m = new THREE.Mesh(new THREE.TorusGeometry(v.r, v.k, mobil ? 16 : 28, mobil ? 160 : 260), v.m); don.add(m);
    if (i === 0 || i === 3) { /* altın halkada kazınmış ölçek çizgileri */
      const n = i === 0 ? 96 : 120, ti = new THREE.InstancedMesh(new THREE.BoxGeometry(.006, .05, .006), altin, n), o = new THREE.Object3D();
      for (let j = 0; j < n; j++) { const a = j / n * Math.PI * 2, uz = j % 8 === 0 ? 1.8 : 1; o.position.set(Math.cos(a) * (v.r + v.k + .03), Math.sin(a) * (v.r + v.k + .03), 0); o.rotation.set(0, 0, a - Math.PI / 2); o.scale.set(1, uz, 1); o.updateMatrix(); ti.setMatrixAt(j, o.matrix); }
      don.add(ti);
    }
    return { pivot, don, v, e0: new THREE.Euler(...v.e) };
  });

  /* dersler: her halkada iki boncuk */
  const ETK = document.createElement("div"); document.body.appendChild(ETK);
  const BON = DERS.map(([ad, renk], i) => {
    const h = HALKA[i % 4], a0 = (i < 4 ? 0 : Math.PI) + i * .7;
    const m = new THREE.Mesh(new THREE.SphereGeometry(.068, 32, 24), new THREE.MeshPhysicalMaterial({ color: renk, roughness: .22, metalness: .15, clearcoat: 1, clearcoatRoughness: .08, envMapIntensity: 1.2 }));
    h.don.add(m); const el = document.createElement("span"); el.className = "etiket"; el.textContent = ad; ETK.appendChild(el);
    return { m, h, a0, el };
  });

  /* toz: derinlik için seyrek ışık zerreleri */
  const N = mobil ? 260 : 520, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { const r = 2.4 + Math.random() * 5, t = Math.random() * Math.PI * 2, f = Math.acos(2 * Math.random() - 1); pos.set([r * Math.sin(f) * Math.cos(t), r * Math.cos(f) * .6, r * Math.sin(f) * Math.sin(t) - 1], i * 3); }
  const tg = new THREE.BufferGeometry(); tg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const toz = new THREE.Points(tg, new THREE.PointsMaterial({ size: .045, map: isikDokusu(THREE, "220,230,255", 64), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  scene.add(toz);

  const gBg = new THREE.Color(), hedefEgim = new THREE.Euler(0, 0, 0), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), wp = new THREE.Vector3();
  return {
    guncelle(d) {
      const { g, s, t } = d, a = d.W / d.H;
      /* yerleşim: masaüstünde sağda, telefonda üstte */
      const yanX = a > 1.05 ? Math.min(1.6, .9 + a * .4) : 0, ustY = a < .8 ? 1.75 : a < 1.05 ? .95 : .05, uzak = a < .8 ? 10.8 : a < 1.05 ? 8.6 : 6.4;
      const p1 = kolay(yumusak(0, .85, s)), isik = yumusak(.72, .98, s);
      kok.position.set(yanX * (1 - p1), ustY * (1 - p1), 0);
      /* açılış: ışık doğar, cam belirir, halkalar sırayla açılır */
      const gIsik = kolay(g / .35), gCam = kolay((g - .15) / .3);
      cekirdek.scale.setScalar(.2 + .8 * gIsik); pMat.opacity = .85 * gIsik; ic.intensity = 9 * gIsik;
      hale.material.opacity = .22 * gIsik * (1 - isik);
      kure.scale.setScalar(Math.max(.001, gCam));
      HALKA.forEach((h, i) => {
        const gi = kolay((g - .25 - i * .1) / .38);
        h.don.scale.setScalar(Math.max(.001, gi));
        h.don.rotation.z = t * h.v.h + (1 - gi) * 2.4;
        /* kaydırma: halkalar kameraya döner, eş merkezli bir göz bebeği olur */
        q1.setFromEuler(h.e0); q2.setFromEuler(hedefEgim); h.pivot.quaternion.copy(q1).slerp(q2, p1);
        h.pivot.scale.setScalar(1 + yumusak(.4, .95, s) * (1.6 + i * .9));
      });
      kok.rotation.y = d.fx * .22 * (1 - p1) + Math.sin(t * .12) * .05;
      kok.rotation.x = d.fy * .14 * (1 - p1);
      BON.forEach((b, i) => { const r = b.h.v.r, an = b.a0 + t * .18 * (i % 2 ? 1 : -1); b.m.position.set(Math.cos(an) * r, Math.sin(an) * r, 0); b.m.scale.setScalar(Math.max(.001, kolay((g - .6) / .3))); });
      toz.material.opacity = .7 * kolay((g - .4) / .5) * (1 - isik); toz.rotation.y = t * .015;
      /* kamera: açılışta geriden gelir, kaydırınca çekirdeğin içinden geçer */
      const z0 = uzak + (1 - kolay(g)) * 3;
      camera.position.set(d.fx * .25 * (1 - p1), d.fy * -.15 * (1 - p1) + .15, z0 + (0.85 - z0) * p1);
      camera.lookAt(kok.position.x * .35, kok.position.y * .5, 0);
      /* ışık büyür, zemin sıcak kırık beyaza döner */
      parilti.scale.setScalar(3 + yumusak(.68, 1, s) * 16); cekirdek.visible = p1 < .9;
      gBg.copy(GECE).lerp(KREM, isik); scene.background.copy(gBg); scene.fog.color.copy(gBg);
      renderer.toneMappingExposure = 1 + isik * .6;
    },
    etiketler(d) {
      const gor = yumusak(.75, 1, d.g) * (1 - yumusak(.02, .14, d.s));
      BON.forEach(b => { b.m.getWorldPosition(wp); const yon = wp.clone().sub(camera.position).normalize(), on = wp.clone().sub(kok.position).normalize().dot(yon.negate());
        wp.y += .14; etiketYerlestir(THREE, camera, d, b.el, wp, gor * (on > -.15 ? 1 : .25)); });
    }
  };
} });
