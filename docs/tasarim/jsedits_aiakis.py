# AI öğretmen akış kaydırması: "yukarı kaydırdım ama ekran aşağı çekildi" yarışını giderir.
# Eski mantık: follow = pending || (alt kenar yakın mı). Her yanıt parçası bir rAF kaydırması kuyruğa alır; kullanıcının
# kaydırması bu karede denk gelirse ekran aşağı çekiliyor ve follow kalıcı true oluyordu.
# Yeni mantık: follow yalnız kullanıcının kaydırma yönünden gelir (scroll olayı rAF'tan önce çalışır); rAF içinde de follow yeniden denetlenir.
rep('''    chatScroll.pending = false;
    if (route() !== "ogretmen") return;
    const last = document.querySelector("#chat > .msg:last-child");''', '''    chatScroll.pending = false;
    if (!chatScroll.follow || route() !== "ogretmen") return;
    const last = document.querySelector("#chat > .msg:last-child");''', 1)
rep('''function render() {
  const r = route(), act = document.activeElement''', '''/* Takip: yukarı kaydırma (belge yüksekliği değişmeden scrollY azalması) takibi bırakır; alt kenara yaklaşınca geri açılır. Programatik kaydırma yalnız aşağı gider. */
let chatScrollY = 0, chatScrollH = 0;
addEventListener("scroll", () => {
  const y = scrollY, h = document.documentElement.scrollHeight;
  if (UI.chatBusy && route() === "ogretmen") {
    if (y < chatScrollY - 2 && Math.abs(h - chatScrollH) <= 1) chatScroll.follow = false;
    else if (!chatScroll.follow) {
      const el = document.getElementById("chat-live") || document.querySelector("#chat > .msg:last-child"), c = document.querySelector(".composer");
      if (el && el.getBoundingClientRect().bottom <= (c ? Math.min(innerHeight, c.getBoundingClientRect().top) : innerHeight) + 40) chatScroll.follow = true;
    }
  }
  chatScrollY = y; chatScrollH = h;
}, { passive: true });
function render() {
  const r = route(), act = document.activeElement''', 1)
rep('''    const el = document.getElementById("chat-live");
    if (!el) return;
    const composer = document.querySelector(".composer");
    const visibleBottom = composer ? Math.min(innerHeight, composer.getBoundingClientRect().top) : innerHeight;
    chatScroll.follow = chatScroll.pending || el.getBoundingClientRect().bottom <= visibleBottom + 180;
    el.innerHTML = md(t);''', '''    const el = document.getElementById("chat-live");
    if (!el) return;
    el.innerHTML = md(t);
    chatScrollH = document.documentElement.scrollHeight;''', 1)
