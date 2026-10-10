// Runs the real schema.sql (which includes v28, v29 and v30) in PGlite, a Postgres that runs inside Node, with tiny stand-ins for
// Supabase's auth/storage/realtime schemas, then checks the rules a student could try to break.
//   npm i --no-save @electric-sql/pglite && node supabase/verify/behave.mjs
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const here = (f) => new URL(f, import.meta.url);
const db = new PGlite();
await db.exec(readFileSync(here("./stub.sql"), "utf8"));
await db.exec(readFileSync(here("../schema.sql"), "utf8"));
const A = "11111111-1111-1111-1111-111111111111", B = "22222222-2222-2222-2222-222222222222", Z = "33333333-3333-3333-3333-333333333333";
await db.exec(`
  insert into public.classes (id, year, name, label) values ('c1','2026','Atlas','Atlas'), ('c2','2026','Birch','Birch');
  insert into auth.users (id) values ('${A}'), ('${B}'), ('${Z}');
  update public.profiles set username='mika', class_id='c1' where id='${A}';
  update public.profiles set username='ines', class_id='c1' where id='${B}';
  update public.profiles set username='zed', class_id='c2' where id='${Z}';
`);
let pass = 0, fail = 0;
const as = async (uid, fn) => { await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false)`); try { return await fn(); } finally { await db.exec("reset role"); } };
const ok = async (name, fn) => { try { await fn(); pass++; console.log("  ok  ", name); } catch (e) { fail++; console.log("  FAIL", name, "->", String(e.message).slice(0, 160)); } };
const bad = async (name, fn, re) => { try { await fn(); fail++; console.log("  FAIL", name, "(should have been refused)"); } catch (e) { if (re && !re.test(e.message)) { fail++; console.log("  FAIL", name, "wrong error:", e.message.slice(0, 120)); } else { pass++; console.log("  ok  ", name, "(refused)"); } } };
const ins = (id, o) => db.query(`insert into public.notes (id, class_id, author, subject, topic, title, body, kind, file_path, file_name, file_type, file_size) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
  [id, o.cls || "c1", o.author || "mika", o.subject || "Math", o.topic ?? null, o.title || "t " + id, o.body || "body " + id, o.kind || "upload", o.path ?? null, o.fname ?? null, o.ftype ?? null, o.fsize ?? null]);

await ok("student adds notes, a reviewer of their own, and a note with its original file", () => as(A, async () => {
  await ins("n1", { topic: "Quadratic equations", title: "Factoring", body: "Solve by factoring: the zero product property" });
  await ins("n2", { topic: "Quadratic equations", title: "Reviewer: Quadratics", kind: "reviewer", body: "Discriminant tells how many roots" });
  await ins("n3", { topic: "Photosynthesis", subject: "Science", title: "Quadratic mention", body: "A long body that talks about quadratic things in passing, quadratic quadratic", path: "c1/n3/lecture.pdf", fname: "lecture.pdf", ftype: "application/pdf", fsize: 2048 });
}));
await bad("a file path that points into another class is refused", () => as(A, () => ins("n4", { path: "c2/n4/x.pdf", fname: "x.pdf", fsize: 10 })), /notes_file_ok|check/);
await bad("a file over 10 MB is refused", () => as(A, () => ins("n5", { path: "c1/n5/x.pdf", fname: "x.pdf", fsize: 11 * 1048576 })), /notes_file_ok|check/);
await bad("an unknown kind is still refused", () => as(A, () => ins("n6", { kind: "weird" })), /notes_kind_check|check/);
await bad("cannot add a note to another class", () => as(A, () => ins("n7", { cls: "c2" })), /row-level security/);
await bad("cannot add a note as someone else", () => as(A, () => ins("n8", { author: "ines" })), /row-level security/);

await ok("classmate sees the class's notes, with file info; another class sees none", async () => {
  const mine = await as(B, () => db.query("select id, kind, file_name, file_size from public.notes order by id"));
  if (mine.rows.length !== 3) throw new Error("classmate sees " + mine.rows.length);
  if (mine.rows.find((r) => r.id === "n3").file_name !== "lecture.pdf") throw new Error("file info missing");
  const other = await as(Z, () => db.query("select id from public.notes"));
  if (other.rows.length !== 0) throw new Error("other class sees " + other.rows.length);
});
await ok("search ranks the topic/title match above a body-only mention", async () => {
  const r = await as(B, () => db.query("select id from public.search_notes('quadratic', 10)"));
  const ids = r.rows.map((x) => x.id);
  if (ids[ids.length - 1] !== "n3" || ids.length !== 3) throw new Error("order was " + ids.join(","));
});
await ok("ideas are stored by save_note_ideas and found by find_ideas (subject + topic)", async () => {
  await as(A, () => db.query(`select public.save_note_ideas('n1','ai','[{"t":"Zero product property","d":"If a product is zero, a factor is zero.","c":"factor","k":"term"},{"t":"Standard form","d":"ax^2 + bx + c = 0","c":"ax^2","k":"formula"}]'::jsonb)`));
  const r = await as(B, () => db.query("select title from public.find_ideas(array['Math'], array['Quadratic equations'], '', 20, false)"));
  if (r.rows.length !== 2) throw new Error("found " + r.rows.length);
  const w = await as(B, () => db.query("select title from public.find_ideas(null, null, 'zero prod', 20, false)"));
  if (!w.rows.length || w.rows[0].title !== "Zero product property") throw new Error("best match was " + (w.rows[0] && w.rows[0].title));
  const none = await as(Z, () => db.query("select title from public.find_ideas(null, null, 'zero prod', 20, false)"));
  if (none.rows.length) throw new Error("another class found ideas");
});
await bad("a classmate cannot remove someone else's note", async () => { const r = await as(B, () => db.query("delete from public.notes where id='n1' returning id")); if (r.rows.length) throw new Error("deleted"); throw new Error("row-level: zero rows"); }, /zero rows/);
await ok("storage: own class can add and read a file; other class cannot read it", async () => {
  await as(A, () => db.query("insert into storage.objects (bucket_id, name) values ('class-notes','c1/n3/lecture.pdf')"));
  const mine = await as(B, () => db.query("select name from storage.objects where bucket_id='class-notes'"));
  if (mine.rows.length !== 1) throw new Error("classmate sees " + mine.rows.length);
  const other = await as(Z, () => db.query("select name from storage.objects where bucket_id='class-notes'"));
  if (other.rows.length !== 0) throw new Error("other class sees " + other.rows.length);
});
await bad("storage: cannot upload into another class's folder", () => as(A, () => db.query("insert into storage.objects (bucket_id, name) values ('class-notes','c2/n9/x.pdf')")), /row-level security/);
await ok("storage: a classmate cannot delete the owner's file, the owner can", async () => {
  const b = await as(B, () => db.query("delete from storage.objects where name='c1/n3/lecture.pdf' returning name"));
  if (b.rows.length) throw new Error("classmate deleted it");
  const a = await as(A, () => db.query("delete from storage.objects where name='c1/n3/lecture.pdf' returning name"));
  if (a.rows.length !== 1) throw new Error("owner could not delete");
});
await ok("storage: once the note is gone, any classmate may clear the orphan file", async () => {
  await as(A, () => db.query("insert into storage.objects (bucket_id, name) values ('class-notes','c1/gone/old.pdf')"));
  const b = await as(B, () => db.query("delete from storage.objects where name='c1/gone/old.pdf' returning name"));
  if (b.rows.length !== 1) throw new Error("orphan stayed");
});
await ok("daily cap: the 61st note in a day is refused (reviewers by the assistant don't count)", async () => {
  await as(B, async () => { for (let i = 0; i < 60; i++) await ins("cap" + i, { author: "ines" }); });
  await as(B, () => ins("aiok", { author: "ines", kind: "ai" }));
  let refused = false;
  try { await as(B, () => ins("cap60", { author: "ines" })); } catch (e) { refused = /Too many notes/.test(e.message); }
  if (!refused) throw new Error("not refused");
});
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
