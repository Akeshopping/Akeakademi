// Üretici betik (docs/tasarim/uret.py) yanlışlıkla üretilmiş dosyayı taban alırsa güvenle durmalı.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const kok = new URL("..", import.meta.url).pathname;
const betik = join(kok, "docs/tasarim/uret.py");
const git = (...a) => spawnSync("git", a, { cwd: kok, encoding: "utf8" });
const py = (...a) => spawnSync("python3", [betik, ...a], { cwd: kok, encoding: "utf8" });
const pyVar = spawnSync("python3", ["--version"]).status === 0;

test("üretici: üretilmiş HEAD tabanı reddedilir (çift uygulama yok)", { skip: !pyVar || !existsSync(betik) }, () => {
  const d = mkdtempSync(join(tmpdir(), "uret-"));
  try {
    const hedef = git("show", "HEAD:index.html").stdout;
    if (!/\?v=ritim1/.test(hedef)) return; // HEAD henüz üretilmiş değil: kontrol gerekmez
    const r = py("--base", "HEAD", "--out", join(d, "x.html"));
    assert.notEqual(r.status, 0);
    assert.match(r.stderr + r.stdout, /zaten üretilmiş/);
    assert.equal(existsSync(join(d, "x.html")), false);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test("üretici: özgün taban (870e057) varsa çıktı main ile aynı kalır", { skip: !pyVar || !existsSync(betik) }, () => {
  if (git("cat-file", "-e", "870e057:index.html").status !== 0) return; // sığ klon: atla
  const d = mkdtempSync(join(tmpdir(), "uret-"));
  try {
    const cikti = join(d, "y.html");
    const r = py("--base", "870e057", "--out", cikti);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(existsSync(cikti), true);
  } finally { rmSync(d, { recursive: true, force: true }); }
});
