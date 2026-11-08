export const gcd = (a, b) => b ? gcd(b, a % b) : Math.abs(a);
export const lcm = (a, b) => a / gcd(a, b) * b;
export const bul = (lo, hi, f, adim = 1) => { const r = []; for (let x = lo; x <= hi + 1e-9; x += adim) if (f(+x.toFixed(6))) r.push(+x.toFixed(6)); return r; };
export const C = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r); };
export const fak = n => n <= 1 ? 1 : n * fak(n - 1);
/** ondalık değeri sade kesir metnine çevirir (şıkları küçükten büyüğe sıralamak için sayı olarak tutulur) */
export const kesir = v => { if (Number.isInteger(v)) return String(v); for (let q = 2; q <= 200; q++) { const p = Math.round(v * q); if (Math.abs(p / q - v) < 1e-9) return p + "/" + q; } return String(v).replace(".", ","); };
export const yaklasik = (a, b, e = 1e-9) => Math.abs(a - b) < e;
