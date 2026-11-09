/* Konsept 3 · Eşik
   Karanlık bir salonun sonunda kapalı bir kapı. Aralığından sızan ışık açılışta kapıyı aralar.
   Kaydırınca kamera eşikten geçer; karanlık oda geride kalır, öğrenci sıcak kırık beyaz çalışma alanına girer. */
import { baslat, yumusak, kolay, clamp, KREM, GECE, isikDokusu } from "../../ortak/ortak.js";

function huzmeDokusu(THREE) {
  const c = document.createElement("canvas"); c.width = 64; c.height = 256; const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, "rgba(255,236,205,.9)"); g.addColorStop(.35, "rgba(255,230,195,.35)"); g.addColorStop(1, "rgba(255,225,190,0)");
  x.fillStyle = g; x.fillRect(0, 0, 64, 256);
  const h = x.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, "rgba(0,0,0,1)"); h.addColorStop(.2, "rgba(0,0,0,0)"); h.addColorStop(.8, "rgba(0,0,0,0)"); h.addColorStop(1, "rgba(0,0,0,1)");
  x.globalCompositeOperation = "destination-out"; x.fillStyle = h; x.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

baslat({ kavram: "esik", sure: 3.0, fov: 40, kur({ THREE, scene, camera, renderer, mobil, durum }) {
  scene.background = GECE.clone(); scene.fog = new THREE.Fog(GECE.clone(), 6, 26);
  const KG = 1.7, KY = 3.3; /* kapı genişliği, yüksekliği */
  scene.add(new THREE.HemisphereLight(0x1d2c4a, 0x020407, .18));

  /* zemin: hafif yansıtıcı taş */
  const zemin = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), new THREE.MeshStandardMaterial({ color: 0x0a1424, roughness: .22, metalness: .6, envMapIntensity: .06 }));
  zemin.rotation.x = -Math.PI / 2; zemin.position.z = 15.3; scene.add(zemin);
  /* duvar: kapı boşluğu bırakılarak üç parçadan */
  const duvarMat = new THREE.MeshStandardMaterial({ color: 0x0a1528, roughness: .95, metalness: 0, envMapIntensity: .04 });
  const dw = 30, dh = 14, kal = .6;
  [[-(KG / 2 + dw / 2), dh / 2, dw], [KG / 2 + dw / 2, dh / 2, dw]].forEach(([x, y, w]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, dh, kal), duvarMat); m.position.set(x, y, 0); scene.add(m); });
  const ustDuvar = new THREE.Mesh(new THREE.BoxGeometry(KG, dh - KY, kal), duvarMat); ustDuvar.position.set(0, KY + (dh - KY) / 2, 0); scene.add(ustDuvar);
  /* kasa: fırçalanmış şampanya metali */
  const kasaMat = new THREE.MeshPhysicalMaterial({ color: 0xc8b07c, metalness: 1, roughness: .32, clearcoat: .3, envMapIntensity: 1.2 });
  const ka = .09;
  [[-KG / 2 - ka / 2, KY / 2, ka, KY + ka], [KG / 2 + ka / 2, KY / 2, ka, KY + ka], [0, KY + ka / 2, KG + ka * 2, ka]].forEach(([x, y, w, h]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, kal + .06), kasaMat); m.position.set(x, y, 0); scene.add(m); });
  /* kanatlar: menteşeden açılan iki koyu panel, altın kenarlı */
  const kanatMat = new THREE.MeshPhysicalMaterial({ color: 0x0f1e36, metalness: .4, roughness: .5, envMapIntensity: .8 });
  const KANAT = [-1, 1].map(yon => {
    const men = new THREE.Group(); men.position.set(yon * KG / 2, 0, kal / 2 - .04); scene.add(men);
    const p = new THREE.Mesh(new THREE.BoxGeometry(KG / 2, KY, .07), kanatMat); p.position.set(-yon * KG / 4, KY / 2, 0); men.add(p);
    const kenar = new THREE.Mesh(new THREE.BoxGeometry(.02, KY - .3, .08), kasaMat); kenar.position.set(-yon * (KG / 2 - .06), KY / 2, .01); men.add(kenar);
    return { men, yon };
  });
  /* kapının ardındaki aydınlık: krem bir oda */
  const odaMat = new THREE.MeshBasicMaterial({ color: 0xf5f0e6, side: THREE.BackSide, fog: false, toneMapped: false });
  const oda = new THREE.Mesh(new THREE.BoxGeometry(14, 10, 16), odaMat); oda.position.set(0, 4.9, -8.35); scene.add(oda);
  const kapiIsik = new THREE.PointLight(0xffe6c2, 0, 14, 1.8); kapiIsik.position.set(0, 1.8, 1.2); scene.add(kapiIsik);
  const parilti = new THREE.Sprite(new THREE.SpriteMaterial({ map: isikDokusu(THREE), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
  parilti.position.set(0, 1.7, .5); parilti.scale.set(4.5, 6, 1); scene.add(parilti);
  /* ışık huzmeleri ve zemindeki ışık havuzu */
  const hd = huzmeDokusu(THREE), HUZME = [];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(KG * (.7 + i * .12), 7), new THREE.MeshBasicMaterial({ map: hd, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2 + .02 + i * .07; m.position.set((i - 2) * .05, .02 + i * .35, 3.6); scene.add(m); HUZME.push(m);
  }
  const havuz = new THREE.Mesh(new THREE.PlaneGeometry(5, 9), new THREE.MeshBasicMaterial({ map: isikDokusu(THREE), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
  havuz.rotation.x = -Math.PI / 2; havuz.position.set(0, .015, 3.4); scene.add(havuz);
  /* katmanlar: karanlıkta iki sıra sütun */
  const sutunMat = new THREE.MeshStandardMaterial({ color: 0x0b1729, roughness: .6, metalness: .3, envMapIntensity: .08 });
  for (let i = 0; i < 4; i++) [-1, 1].forEach(y => { const s = new THREE.Mesh(new THREE.BoxGeometry(.55, 9, .55), sutunMat); s.position.set(y * (3.2 + i * .15), 4.5, 2.2 + i * 3.2); scene.add(s); });
  /* ışıkta süzülen toz */
  const N = mobil ? 220 : 480, pos = new Float32Array(N * 3), hiz = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos.set([(Math.random() - .5) * 2.6, Math.random() * 3.4, Math.random() * 6.5], i * 3); hiz[i] = .03 + Math.random() * .08; }
  const tg = new THREE.BufferGeometry(); tg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const toz = new THREE.Points(tg, new THREE.PointsMaterial({ size: .03, map: isikDokusu(THREE, "255,240,215", 64), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })); scene.add(toz);
  /* soğuk kenar ışığı: sütunların hatlarını çizer */
  const kenar = new THREE.DirectionalLight(0x5f86ff, .5); kenar.position.set(-6, 5, 8); scene.add(kenar);

  const bg = new THREE.Color();
  return {
    guncelle(d) {
      const { g, s, t, dt } = d, a = d.W / d.H;
      const ac = kolay(yumusak(.3, .9, g)), sizinti = yumusak(.05, .35, g), yur = yumusak(0, .9, s), gec = yumusak(.62, .88, s);
      KANAT.forEach(k => { k.men.rotation.y = k.yon * (.02 + ac * 1.25 + yur * .3); });
      const guc = Math.max(sizinti * .25, ac) * (1 + yur * .8);
      kapiIsik.intensity = 30 * guc; parilti.material.opacity = .55 * guc * (1 - gec);
      HUZME.forEach((h, i) => { h.material.opacity = .16 * ac * (1 - gec) * (1 + Math.sin(t * .7 + i) * .15); });
      havuz.material.opacity = .45 * ac * (1 - gec); toz.material.opacity = .8 * ac * (1 - gec);
      const p = toz.geometry.attributes.position; for (let i = 0; i < N; i++) { let y = p.getY(i) + hiz[i] * dt; if (y > 3.4) y = 0; p.setY(i, y); p.setX(i, p.getX(i) + Math.sin(t * .4 + i) * .0007); } p.needsUpdate = true;
      /* kamera: telefonda daha geriden, kaydırınca eşikten geçer */
      const z0 = a < .8 ? 13 : a < 1.05 ? 11 : 9.2, y0 = a < .8 ? 1.9 : 1.7, gz = (1 - kolay(g)) * 2;
      const z = z0 + gz + (-3.2 - z0) * yur;
      const yanX = a > 1.05 ? -1.7 * (1 - yur) : 0, bakY = a < .8 ? .75 : a < 1.05 ? 1.1 : 1.75;
      camera.position.set(yanX + d.fx * .6 * (1 - yur), y0 - d.fy * .25 * (1 - yur) - yur * .1, z);
      camera.lookAt(yanX * .55 + d.fx * .15, bakY * (1 - yur) + 1.6 * yur, z - 6);
      /* eşikten geçince her şey kırık beyaz */
      bg.copy(GECE).lerp(KREM, gec); scene.background.copy(bg); scene.fog.color.copy(bg); scene.fog.near = 6 - gec * 5.5; scene.fog.far = 26 - gec * 23;
      renderer.toneMappingExposure = 1 + gec * .4;
    }
  };
} });
