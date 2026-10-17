import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { BANK } from "../src/lib/sound.js";

const root = path.resolve(import.meta.dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
// every source file of the app: App.jsx, the screens under src/app, and the rules under src/lib
const walk = (d) => fs.readdirSync(path.join(root, d), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.(jsx?|mjs)$/.test(e.name) ? [path.join(d, e.name)] : []));
const sources = () => ["src/App.jsx", ...walk("src/app"), ...walk("src/lib")].map(read);

test("every literal sound name the app plays has a file in the bank", () => {
  const code = sources().join("\n");
  const names = new Set([...code.matchAll(/(?:Sound\.play|\bplay)\(\s*"([A-Za-z]+)"\s*\)/g)].map((m) => m[1]));
  assert.ok(names.size >= 10, "found the names the app plays");
  for (const n of names) assert.ok(BANK[n] && BANK[n].length, `"${n}" is played but not in BANK`);
});

test("the app uses the shared sound player, not a second synthesizer of its own", () => {
  const code = [...walk("src/app"), "src/App.jsx"].map(read).join("\n");
  assert.match(code, /import \{ Sound \} from "\.\.?\/(?:\.\.\/)?lib\/sound\.js"/);
  assert.doesNotMatch(code, /const Sound = /);
  assert.doesNotMatch(code, /createOscillator|new AudioContext|webkitAudioContext/);
});

test("the sound folder is cached for a year, and the security header is still there", () => {
  const h = read("public/_headers");
  assert.match(h, /\/sounds\/v2\/\*\s+Cache-Control: public, max-age=31536000, immutable/);
  assert.ok(!h.includes("/stamp/"), "the boarding-pass stamp folder is gone");
  assert.ok(!/fonts\.(googleapis|gstatic)\.com/.test(h), "fonts are self-hosted, so the policy no longer allows Google Fonts");
  assert.match(h, /^\s+Content-Security-Policy: /m, "the policy is enforced");
  assert.ok(!h.includes("Report-Only"), "and no longer report-only");
});

test("no dead sounds: every sound in the bank is played somewhere, and every file in the folder is in the bank", () => {
  // names inside Sound.play(...) / play(...) calls, including ternaries like play(ok ? "done" : "err")
  const played = new Set();
  for (const src of sources()) for (const line of src.split("\n")) if (/\bplay\(/.test(line)) for (const m of line.matchAll(/"([A-Za-z]+)"/g)) played.add(m[1]);
  for (const name of Object.keys(BANK)) assert.ok(played.has(name), `"${name}" is in BANK but never played; delete it (and its files) so it is not downloaded for nothing`);
  const inBank = new Set([...Object.values(BANK).flat(), "music"]);
  const dir = path.join(root, "public", "sounds", "v2");
  for (const f of fs.readdirSync(dir)) assert.ok(inBank.has(f.replace(/\.mp3$/, "")), `${f} is shipped but nothing can play it`);
});

test("the enforced policy matches how the app is built: no inline scripts, no outside hosts, nothing that would block its own files", () => {
  const h = read("public/_headers");
  const csp = h.match(/^\s+Content-Security-Policy: (.+)$/m)[1];
  const dir = (n) => (csp.match(new RegExp(`${n} ([^;]+)`)) || [])[1] || "";
  assert.equal(dir("script-src"), "'self'", "scripts only from this site");
  assert.ok(!/unsafe-eval|unsafe-inline/.test(dir("script-src")));
  assert.match(dir("default-src"), /^'self'$/);
  assert.match(dir("connect-src"), /'self'.*supabase\.co.*wss:\/\/\*\.supabase\.co/);
  assert.match(csp, /frame-ancestors 'none'/);
  const html = read("index.html");
  assert.equal([...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>/g)].length, 0, "index.html has no inline script");
  assert.ok(!/\son[a-z]+=/i.test(html), "and no inline event handlers");
});
