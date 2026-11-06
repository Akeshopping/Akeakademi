/* Web Push (RFC 8030 + 8291 aes128gcm + VAPID RFC 8292), yalnızca WebCrypto ile; ek paket gerekmez */
const enc = new TextEncoder();
export const b64u = (buf) => { const a = new Uint8Array(buf); let s = ""; for (const x of a) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
export const unb64u = (s) => { s = String(s).replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; const b = atob(s), a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; };
const cat = (...l) => { const n = l.reduce((s, x) => s + x.length, 0), o = new Uint8Array(n); let p = 0; for (const x of l) { o.set(x, p); p += x.length; } return o; };
async function hkdf(salt, ikm, info, len) {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, len * 8));
}
/* VAPID anahtar çifti üretir: { pub: base64url (65 bayt), priv: JWK metni } */
export async function vapidUret() {
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const pub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey)), jwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
  return { pub: b64u(pub), priv: JSON.stringify(jwk) };
}
async function vapidBaslik(endpoint, vapid, konu) {
  const aud = new URL(endpoint).origin, hdr = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const cl = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: konu || "https://akeakademi.com" })));
  const key = await crypto.subtle.importKey("jwk", JSON.parse(vapid.priv), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(hdr + "." + cl)));
  return `vapid t=${hdr}.${cl}.${b64u(sig)}, k=${vapid.pub}`;
}
/* Yükü (metin) alıcının p256dh ve auth anahtarlarıyla şifreler */
export async function sifrele(metin, p256dh, auth) {
  const uaPub = unb64u(p256dh), authSecret = unb64u(auth);
  const as = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", as.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, as.privateKey, 256));
  const ikm = await hkdf(authSecret, ecdh, cat(enc.encode("WebPush: info\0"), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16), nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, cat(enc.encode(metin), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 0x10, 0]); /* kayıt boyutu 4096 */
  return cat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}
/* Tek aboneliğe gönderir. Dönüş: { ok, durum, silinmeli } */
export async function pushGonder(sub, yuk, vapid, opt) {
  opt = opt || {};
  try {
    const body = await sifrele(JSON.stringify(yuk), sub.p256dh, sub.auth);
    const r = await fetch(sub.endpoint, { method: "POST", headers: { "content-encoding": "aes128gcm", "content-type": "application/octet-stream", ttl: String(opt.ttl || 86400), urgency: opt.urgency || "normal", authorization: await vapidBaslik(sub.endpoint, vapid, opt.konu) }, body });
    return { ok: r.status >= 200 && r.status < 300, durum: r.status, silinmeli: r.status === 404 || r.status === 410 };
  } catch (e) { return { ok: false, durum: 0, silinmeli: false }; }
}
