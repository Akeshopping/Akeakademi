// Tur 2: fizik + kimya pilot seti -> ../sorular/r02.json
import fs from "node:fs";
import { sifirla, tumu, incelenecekler } from "./lib.mjs";
sifirla();
await import("./yazim/r02-fizik.mjs");
await import("./yazim/r02-kimya.mjs");
const liste = tumu().map(e => e.soru);
fs.writeFileSync(new URL("../sorular/r02.json", import.meta.url), JSON.stringify(liste));
fs.mkdirSync(new URL("./cikti/", import.meta.url), { recursive: true });
fs.writeFileSync(new URL("./cikti/r02-incelenecek.json", import.meta.url), JSON.stringify(incelenecekler()));
const by = {}; liste.forEach(q => by[q.s] = (by[q.s] || 0) + 1);
console.log(JSON.stringify(by), "toplam", liste.length, "incelenecek:", incelenecekler().length);
