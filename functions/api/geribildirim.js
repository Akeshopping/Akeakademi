// AKE Akademi · geri bildirim formu (Cloudflare Pages Function) · adres: /api/geribildirim
//   POST /api/geribildirim {tur, mesaj, eposta?, ad?, web?}   ziyaretçinin mesajı iletişim e-postasına gönderilir
//   (web: bot tuzağı alanı, dolu gelirse sessizce yok sayılır)
import { json, fail, epostaGonder } from "../../lib/ortak.js";

const hits = new Map();
const kirp = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ").trim().slice(0, n);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const TUR = { oneri: "Öneri", hata: "Hata bildirimi", soru: "Soru hatası", paket: "Paket / ödeme", diger: "Diğer" };

export async function onRequest({ request, env }) {
  if (request.method !== "POST") return fail(405, "yok");
  let b = {}; try { b = await request.json(); } catch (e) { }
  if (b.web) return json(200, { ok: true });
  const now = Date.now(), ip = request.headers.get("cf-connecting-ip") || "?", l = (hits.get(ip) || []).filter(t => now - t < 3600000);
  if (l.length >= 5) return fail(429, "cok_istek", "Çok fazla mesaj gönderdin. Bir saat sonra tekrar dene.");
  const mesaj = kirp(b.mesaj, 2000), eposta = kirp(b.eposta, 120), ad = kirp(b.ad, 60), tur = TUR[b.tur] ? b.tur : "diger";
  if (mesaj.length < 5) return fail(400, "gecersiz", "Mesajın çok kısa.");
  if (eposta && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(eposta)) return fail(400, "gecersiz", "E-posta adresi geçerli görünmüyor.");
  l.push(now); hits.set(ip, l); if (hits.size > 20000) hits.clear();
  const to = env.AKE_ILETISIM || "info@akeakademi.com";
  const html = `<p><b>${esc(TUR[tur])}</b></p><p style="white-space:pre-wrap">${esc(mesaj)}</p><p style="color:#64748b;font-size:13px">Gönderen: ${esc(ad || "—")} · ${esc(eposta || "e-posta bırakmadı")}</p>`;
  const r = await epostaGonder(env, { to, subject: "[AKE geri bildirim] " + TUR[tur], html, text: TUR[tur] + "\n\n" + mesaj + "\n\nGönderen: " + (ad || "-") + " · " + (eposta || "-"), replyTo: eposta || undefined });
  if (!r.ok) return fail(502, "gonderilemedi", "Mesaj şu an gönderilemedi. Lütfen e-posta ile yaz.");
  return json(200, { ok: true });
}
