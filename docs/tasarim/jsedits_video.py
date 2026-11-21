# Instagram tasarım ilhamı: mevcut seriyi haftalık bir görsel akışta gösterir.
# Yalnız görünüm metnini değiştirir; seri/rozet hesabı ve veri kaydı aynı kalır.
rep('''function rozetKart() {
  const si = streakInfo(), kaz = ROZET.filter(r => S.badges[r.id]).length;''', '''function seriHafta(si) {
  const adlar = [["Pzt", "Pazartesi"], ["Sal", "Salı"], ["Çar", "Çarşamba"], ["Per", "Perşembe"], ["Cum", "Cuma"], ["Cmt", "Cumartesi"], ["Paz", "Pazar"]];
  const bugun = new Date(), bas = new Date(bugun);
  bas.setDate(bas.getDate() - ((bas.getDay() + 6) % 7));
  bas.setHours(12, 0, 0, 0);
  const bugunKey = dayKey(bugun);
  const gunler = adlar.map(([ad, tamAd], i) => {
    const tarih = new Date(bas); tarih.setDate(bas.getDate() + i);
    const key = dayKey(tarih), sayi = Math.max(0, Number(S.daily[key] && S.daily[key].q) || 0);
    const kor = !sayi && si.bridged.includes(key);
    const hal = sayi ? "tam" : kor ? "kor" : key === bugunKey ? "bugun" : tarih > bugun ? "gelecek" : "bos";
    const bilgi = sayi ? sayi + " soru çözüldü" : kor ? "seri koruması kullanıldı" : key === bugunKey ? "bugün henüz soru çözülmedi" : tarih > bugun ? "henüz gelmedi" : "soru çözülmedi";
    return `<div class="seri-gun ${hal}" role="img" aria-label="${tamAd}: ${bilgi}"><span class="seri-isaret" aria-hidden="true">${sayi ? "✓" : kor ? "•" : ""}</span><span aria-hidden="true">${ad}</span></div>`;
  });
  return `<div class="seri-hafta" role="group" aria-label="Bu haftanın soru çözme günleri">${gunler.join("")}</div>`;
}
function rozetKart() {
  const si = streakInfo(), kaz = ROZET.filter(r => S.badges[r.id]).length;''')
rep('''      <p class="small muted" style="margin:0">Haftada <b>bir gün</b> çalışmayı atlasan seri bozulmaz (seri koruma). Bu hafta koruman: <b>${si.hazir ? "hazır" : "kullanıldı"}</b>.</p></div>
    ${(() => { const az = !UI.rzHepsi''', '''      <p class="small muted" style="margin:0">Haftada <b>bir gün</b> çalışmayı atlasan seri bozulmaz (seri koruma). Bu hafta koruman: <b>${si.hazir ? "hazır" : "kullanıldı"}</b>.</p></div>
    ${seriHafta(si)}
    ${(() => { const az = !UI.rzHepsi''')
