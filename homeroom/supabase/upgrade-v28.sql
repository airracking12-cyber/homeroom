-- Homeroom v28. Run ONCE in Supabase > SQL Editor on a project that is already running. Safe to run twice. Keeps all data.
-- (A brand-new project should run schema.sql instead; it already contains all of this.)
--
--   A. closes a hole where a student could set their own class_id to anything (see below)
--   B. gives notes and their "ideas" real tables, with search and per-person rules
--   C. copies the existing notes and ideas into those tables (the old rows are left alone)
--
-- After it runs, open the app (v28), check the Review > Library tab shows your notes, and only then, if you like, run the
-- optional clean-up at the very bottom.

begin;

-- Lets the database find "<class>:..." keys quickly (LIKE 'prefix%' cannot use the ordinary index).
create index if not exists kv_key_prefix on public.kv (key text_pattern_ops);

-- ===== A. A student can no longer set their own class to anything they like =====
-- Before: any signed-in student could update profiles.class_id to any text through the API (for example the letter "u",
-- which matches every student's private progress keys, or another class's id) and then read and write that data.
-- Now class ids must exist in public.classes, and the only way to change class is choose_class(), which checks that.
update public.profiles set class_id = null
  where class_id is not null and not exists (select 1 from public.classes c where c.id = public.profiles.class_id);
alter table public.profiles drop constraint if exists profiles_class_fk;
alter table public.profiles add constraint profiles_class_fk
  foreign key (class_id) references public.classes(id) on update cascade on delete set null;
revoke update on public.profiles from authenticated;

create or replace function public.choose_class(cls text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if not exists (select 1 from public.classes where id = cls) then raise exception 'Unknown class'; end if;
  update public.profiles set class_id = cls where id = auth.uid();
end $$;
revoke all on function public.choose_class(text) from public, anon;
grant execute on function public.choose_class(text) to authenticated;

-- ===== B. Notes and their ideas get real tables =====
-- Before: every note of a class (full text) sat in ONE json row "<class>:materials" and every ideas inventory in ONE row
-- "<class>:kb". Everyone downloaded all of it at start-up and every change rewrote the whole row. Now: one row per note,
-- one row per idea, searchable, and only the owner (or an admin) can change or remove a note.
create table if not exists public.notes (
  id text primary key default gen_random_uuid()::text,
  class_id text not null references public.classes(id) on update cascade on delete cascade,
  owner uuid default auth.uid() references auth.users(id) on delete set null,
  author text not null,                                   -- the username shown as "Added by"
  subject text not null check (length(subject) between 1 and 40),
  topic text check (topic is null or length(topic) between 1 and 60),
  title text not null check (length(title) between 1 and 120),
  body text not null check (length(body) <= 120000),
  kind text not null default 'upload' check (kind in ('upload', 'ai', 'typed')),
  task_id text,                                           -- optional: the task it was added under (tasks still live in kv)
  task_title text,
  n int generated always as (length(body)) stored,        -- so the app can show sizes without downloading the text
  ideas_n int not null default 0,                         -- how many ideas are in its inventory (0 = not read yet)
  ideas_src text check (ideas_src in ('ai', 'local')),
  ideas_at timestamptz,
  created_at timestamptz not null default now(),
  search tsvector generated always as (to_tsvector('simple', coalesce(topic, '') || ' ' || title || ' ' || body)) stored
);
create index if not exists notes_class_subject on public.notes (class_id, subject, topic);
create index if not exists notes_class_created on public.notes (class_id, created_at desc);
create index if not exists notes_search on public.notes using gin (search);

create table if not exists public.note_ideas (
  id bigint generated always as identity primary key,
  note_id text not null references public.notes(id) on delete cascade,
  class_id text not null references public.classes(id) on update cascade on delete cascade,
  idx int not null,                                        -- its place in the note's list (flashcard progress is keyed by it)
  title text not null,
  detail text not null,
  keyword text not null default '',
  kind text not null default 'fact',
  search tsvector generated always as (to_tsvector('simple', title || ' ' || detail || ' ' || keyword)) stored,
  unique (note_id, idx)
);
create index if not exists note_ideas_class on public.note_ideas (class_id);
create index if not exists note_ideas_search on public.note_ideas using gin (search);

alter table public.notes enable row level security;
alter table public.note_ideas enable row level security;

drop policy if exists notes_read on public.notes;
drop policy if exists notes_add on public.notes;
drop policy if exists notes_edit on public.notes;
drop policy if exists notes_delete on public.notes;
drop policy if exists ideas_read on public.note_ideas;

-- Everyone in the class can read the class's notes. You can only add notes to your own class, as yourself.
create policy notes_read on public.notes for select to authenticated
  using (class_id = public.my_class() or public.is_admin());
create policy notes_add on public.notes for insert to authenticated
  with check (class_id = public.my_class() and owner = auth.uid() and author = public.my_username());
-- Only the owner (or an admin) can relabel or remove a note. Notes from before owners existed (owner is empty) can be
-- tidied by anyone in the class.
create policy notes_edit on public.notes for update to authenticated
  using ((class_id = public.my_class() and (owner = auth.uid() or owner is null)) or public.is_admin())
  with check (class_id = public.my_class() or public.is_admin());
create policy notes_delete on public.notes for delete to authenticated
  using ((class_id = public.my_class() and (owner = auth.uid() or owner is null)) or public.is_admin());
create policy ideas_read on public.note_ideas for select to authenticated
  using (class_id = public.my_class() or public.is_admin());

-- Only the listed columns can be written directly; everything else (idea counts, owner) is set by the database.
revoke all on public.notes from anon, authenticated;
revoke all on public.note_ideas from anon, authenticated;
grant select on public.notes to authenticated;
grant insert (id, class_id, author, subject, topic, title, body, kind, task_id, task_title) on public.notes to authenticated;
grant update (subject, topic, title) on public.notes to authenticated;
grant delete on public.notes to authenticated;
grant select on public.note_ideas to authenticated;   -- ideas are only written by save_note_ideas() below

-- Turns what a student types into a prefix search: "photosyn" finds "photosynthesis". Safe for any input.
-- Normally every word must match. With any_word (used for whole questions, like in the assistant) one matching word is
-- enough, and short and filler words ("what", "the", "ang", "mga") are ignored so they don't match everything.
create or replace function public.hr_tsq(q text, any_word boolean default false) returns tsquery language sql stable as $$
  select case when w.words is null then null else to_tsquery('simple', w.words) end
  from (
    select string_agg(x || ':*', case when any_word then ' | ' else ' & ' end) as words
    from (select regexp_split_to_table(lower(regexp_replace(left(coalesce(q, ''), 200), '[^[:alnum:]]+', ' ', 'g')), '\s+') as x) s
    where length(x) >= case when any_word then 4 else 2 end
      and not (any_word and x = any (array['what', 'which', 'that', 'this', 'with', 'from', 'have', 'about', 'where', 'when',
        'does', 'your', 'their', 'there', 'these', 'those', 'into', 'tell', 'explain', 'please', 'give', 'could', 'would',
        'should', 'show', 'make', 'help', 'kung', 'para', 'mga', 'ito', 'nang', 'ano', 'paano', 'bakit', 'saan']))
  ) w
$$;

-- Replaces a note's ideas inventory in one step and updates its idea count. Anyone in the class may fill in a note that
-- has none yet, or improve a quick "local" inventory; a good AI inventory can only be replaced by the note's owner or an admin.
create or replace function public.save_note_ideas(p_note text, p_src text, p_ideas jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare nrow public.notes%rowtype; cnt int;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into nrow from public.notes where id = p_note;
  if not found or nrow.class_id is distinct from public.my_class() then raise exception 'Unknown note'; end if;
  if p_src not in ('ai', 'local') then raise exception 'Bad source'; end if;
  if p_ideas is null or jsonb_typeof(p_ideas) <> 'array' then raise exception 'Bad ideas'; end if;
  if nrow.ideas_n > 0 and nrow.ideas_src = 'ai' and nrow.owner is distinct from auth.uid() and not public.is_admin() then
    return nrow.ideas_n;
  end if;
  delete from public.note_ideas where note_id = p_note;
  insert into public.note_ideas (note_id, class_id, idx, title, detail, keyword, kind)
  select p_note, nrow.class_id, (row_number() over (order by e.ord) - 1)::int,
         left(e.item->>'t', 80), left(e.item->>'d', 320), left(coalesce(e.item->>'c', ''), 60),
         left(coalesce(nullif(e.item->>'k', ''), 'fact'), 12)
  from jsonb_array_elements(p_ideas) with ordinality as e(item, ord)
  where coalesce(e.item->>'t', '') <> '' and coalesce(e.item->>'d', '') <> '' and e.ord <= 300;
  get diagnostics cnt = row_count;
  update public.notes set ideas_n = cnt, ideas_src = p_src, ideas_at = now() where id = p_note;
  return cnt;
end $$;
revoke all on function public.save_note_ideas(text, text, jsonb) from public, anon;
grant execute on function public.save_note_ideas(text, text, jsonb) to authenticated;

-- Finds the ideas in MY class that match a subject, topic and/or search words, best first. This is what the study screens
-- and the assistant use, so they only ever work with the lessons that matter.
create or replace function public.find_ideas(p_subjects text[] default null, p_topics text[] default null,
                                             p_q text default '', p_limit int default 80, p_any boolean default false)
returns table (note_id text, idx int, title text, detail text, keyword text, kind text,
               subject text, topic text, note_title text, rank real)
language sql stable set search_path = public as $$
  with q as (select public.hr_tsq(p_q, p_any) as tsq)
  select i.note_id, i.idx, i.title, i.detail, i.keyword, i.kind, n.subject, n.topic, n.title,
         (case when q.tsq is null then 0 else greatest(ts_rank(i.search, q.tsq), ts_rank(n.search, q.tsq) * 0.5) end)::real
  from public.note_ideas i
  join public.notes n on n.id = i.note_id
  cross join q
  where i.class_id = public.my_class()
    and (p_subjects is null or cardinality(p_subjects) = 0 or n.subject = any (p_subjects))
    and (p_topics is null or cardinality(p_topics) = 0 or n.topic = any (p_topics))
    and (q.tsq is null or i.search @@ q.tsq or n.search @@ q.tsq)
  order by 10 desc, n.created_at desc, i.idx
  limit least(coalesce(p_limit, 80), 300)
$$;
revoke all on function public.find_ideas(text[], text[], text, int, boolean) from public, anon;
grant execute on function public.find_ideas(text[], text[], text, int, boolean) to authenticated;

-- Which of MY class's notes mention these words anywhere? Returns the note ids and a short snippet, best first.
create or replace function public.search_notes(p_q text, p_limit int default 30)
returns table (id text, rank real, snippet text)
language sql stable set search_path = public as $$
  with q as (select public.hr_tsq(p_q) as tsq)
  select n.id, ts_rank(n.search, q.tsq)::real,
         ts_headline('simple', n.body, q.tsq, 'MaxFragments=1, MaxWords=24, MinWords=8, StartSel=[[, StopSel=]]')
  from public.notes n
  cross join q
  where q.tsq is not null and n.class_id = public.my_class() and n.search @@ q.tsq
  order by 2 desc, n.created_at desc
  limit least(coalesce(p_limit, 30), 50)
$$;
revoke all on function public.search_notes(text, int) from public, anon;
grant execute on function public.search_notes(text, int) to authenticated;

-- ===== C. Move the existing notes and inventories out of the old shared rows =====
-- Safe to run again (it skips what is already there) and it does not touch the old rows.
insert into public.notes (id, class_id, owner, author, subject, title, body, kind, task_id, task_title, created_at)
select
  coalesce(nullif(m.item->>'id', ''), gen_random_uuid()::text),
  split_part(k.key, ':', 1),
  p.id,
  left(coalesce(nullif(m.item->>'by', ''), 'Assistant'), 40),
  left(coalesce(nullif(m.item->>'subject', ''), 'General'), 40),
  left(coalesce(nullif(m.item->>'title', ''), 'Untitled notes'), 120),
  left(coalesce(m.item->>'text', ''), 120000),
  case when m.item->>'kind' in ('upload', 'ai', 'typed') then m.item->>'kind' else 'upload' end,
  nullif(m.item->>'taskId', ''),
  left(nullif(m.item->>'taskTitle', ''), 200),
  case when (m.item->>'at') ~ '^[0-9]+(\.[0-9]+)?$' then to_timestamp((m.item->>'at')::double precision / 1000.0) else now() end
from public.kv k
cross join lateral jsonb_array_elements(case when jsonb_typeof(k.value) = 'array' then k.value else '[]'::jsonb end) as m(item)
left join public.profiles p on p.username = m.item->>'by' and p.class_id = split_part(k.key, ':', 1)
where k.key like '%:materials' and split_part(k.key, ':', 3) = ''
  and exists (select 1 from public.classes c where c.id = split_part(k.key, ':', 1))
on conflict (id) do nothing;

insert into public.note_ideas (note_id, class_id, idx, title, detail, keyword, kind)
select nt.id, nt.class_id,
       (row_number() over (partition by nt.id order by e.ord) - 1)::int,
       left(e.item->>'t', 80), left(e.item->>'d', 320),
       left(coalesce(e.item->>'c', ''), 60),
       left(coalesce(nullif(e.item->>'k', ''), 'fact'), 12)
from public.kv k
cross join lateral jsonb_each(case when jsonb_typeof(k.value) = 'object' then k.value else '{}'::jsonb end) as ent(nid, entry)
join public.notes nt on nt.id = ent.nid and nt.class_id = split_part(k.key, ':', 1)
cross join lateral jsonb_array_elements(case when jsonb_typeof(ent.entry -> 'ideas') = 'array' then ent.entry -> 'ideas' else '[]'::jsonb end) with ordinality as e(item, ord)
where k.key like '%:kb' and split_part(k.key, ':', 3) = ''
  and coalesce(ent.entry->>'n', '') = nt.n::text          -- only inventories that still match their note's text
  and not exists (select 1 from public.note_ideas x where x.note_id = nt.id)
  and coalesce(e.item->>'t', '') <> '' and coalesce(e.item->>'d', '') <> '' and e.ord <= 300;

update public.notes nt set ideas_n = c.cnt, ideas_src = 'ai', ideas_at = now()
from (select note_id, count(*)::int as cnt from public.note_ideas group by note_id) c
where c.note_id = nt.id and nt.ideas_n = 0;

update public.notes nt set ideas_src = 'local'
from public.kv k, jsonb_each(case when jsonb_typeof(k.value) = 'object' then k.value else '{}'::jsonb end) as ent(nid, entry)
where k.key like '%:kb' and split_part(k.key, ':', 3) = ''
  and ent.nid = nt.id and nt.class_id = split_part(k.key, ':', 1)
  and ent.entry->>'src' = 'local' and nt.ideas_n > 0;

-- Make the new tables and functions visible to the app straight away.
notify pgrst, 'reload schema';

commit;

-- ===== D. Optional clean-up, AFTER you have checked everything in the app. Removes the old shared rows. =====
-- Keep them for a while if you want an easy way back. Un-comment to run.
-- delete from public.kv where (key like '%:materials' or key like '%:kb') and split_part(key, ':', 3) = '';
