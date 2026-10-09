-- Homeroom database. Paste this whole file into Supabase, SQL Editor, and run it once.
-- It starts fresh: it removes the old shared "kv" table and everything in it.

drop table if exists public.note_ideas cascade;
drop table if exists public.notes cascade;
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop table if exists public.kv cascade;
drop table if exists public.feedback cascade;
drop table if exists public.profiles cascade;
drop table if exists public.classes cascade;

create table public.classes (
  id text primary key, year text not null, name text not null, label text not null,
  quarter int not null default 1 check (quarter between 1 and 4), -- which quarter the class is in; admins change it
  created_at timestamptz not null default now()
);
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique, class_id text references public.classes(id) on update cascade on delete set null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.kv (
  key text primary key, value jsonb not null default 'null', version int not null default 1,
  updated_at timestamptz not null default now()
);
create table public.feedback (
  id bigint generated always as identity primary key,
  user_id uuid default auth.uid(), from_user text, type text, text text,
  read boolean not null default false, created_at timestamptz not null default now()
);

-- Who am I? (security definer so the rules below can ask without looping)
create or replace function public.my_class() returns text language sql stable security definer set search_path = public
  as $$ select class_id from public.profiles where id = auth.uid() $$;
create or replace function public.my_username() returns text language sql stable security definer set search_path = public
  as $$ select username from public.profiles where id = auth.uid() $$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public
  as $$ select coalesce((select is_admin from public.profiles where id = auth.uid()), false) $$;

-- When someone signs up (email + password only), create an empty profile. The username and class
-- are filled in later on the boarding pass, by complete_profile() below.
-- Runs inside the database, so it works whether or not email confirmation is turned on.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public
  as $$ begin
    insert into public.profiles (id) values (new.id);
    return new;
  end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.classes enable row level security;
alter table public.profiles enable row level security;
alter table public.kv enable row level security;
alter table public.feedback enable row level security;

-- Classes: anyone can see the list and add a class
create policy classes_read on public.classes for select to anon, authenticated using (true);
create policy classes_add on public.classes for insert to authenticated
  with check (id ~ '^[a-z0-9-]{3,60}$' and length(label) between 3 and 40);

-- Only admins can change a class's quarter (everyone else can still add a class, which starts in quarter 1)
create policy classes_admin_update on public.classes for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Profiles: you see your own; admins see all. You can only change your own class.
create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid() and is_admin = false);
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- Nobody changes a profile directly any more: the class is picked with choose_class() / complete_profile(), which check it exists.
revoke update on public.profiles from authenticated;

-- Class data lives under keys like "8-16:tasks"; your own progress under "u:yourname:progress".
-- You can only touch your own class's keys and your own progress. Admins can touch everything.
create policy kv_access on public.kv for all to authenticated
  using (public.is_admin() or split_part(key, ':', 1) = public.my_class()
         or (split_part(key, ':', 1) = 'u' and split_part(key, ':', 2) = public.my_username()))
  with check (public.is_admin() or split_part(key, ':', 1) = public.my_class()
         or (split_part(key, ':', 1) = 'u' and split_part(key, ':', 2) = public.my_username()));

-- Suggestions: anyone signed in can send one; only admins can read them
create policy feedback_send on public.feedback for insert to authenticated with check (user_id = auth.uid());
create policy feedback_admin on public.feedback for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Boarding pass: the first time someone signs in they pick a username and class. Works once only.
create or replace function public.complete_profile(uname text, cls text) returns void
language plpgsql security definer set search_path = public as $$
declare u text := lower(trim(uname));
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if u !~ '^[a-z0-9_.]{3,20}$' then raise exception 'Bad username'; end if;
  if not exists (select 1 from public.classes where id = cls) then raise exception 'Unknown class'; end if;
  if exists (select 1 from public.profiles where id = auth.uid() and username is not null) then raise exception 'Already set up'; end if;
  update public.profiles set username = u, class_id = cls where id = auth.uid();
end $$;
revoke all on function public.complete_profile(text, text) from public, anon;
grant execute on function public.complete_profile(text, text) to authenticated;

-- The seat map: everyone in my class (names only), so offline classmates still have a seat.
create or replace function public.class_roster() returns table (username text)
language sql stable security definer set search_path = public as $$
  select p.username from public.profiles p
  where p.class_id = public.my_class() and p.username is not null and p.is_admin = false
  order by p.username
$$;
revoke all on function public.class_roster() from public, anon;
grant execute on function public.class_roster() to authenticated;

-- Live presence ("online") and private chats use Supabase Realtime private channels.
--   class:<class>                    everyone in the class: who is online
--   dm:<class>:<name1>:<name2>       a chat between exactly two people
drop policy if exists hr_rt_read on realtime.messages;
drop policy if exists hr_rt_write on realtime.messages;
create policy hr_rt_read on realtime.messages for select to authenticated using (
  (split_part(realtime.topic(), ':', 1) = 'class' and split_part(realtime.topic(), ':', 2) = public.my_class())
  or (split_part(realtime.topic(), ':', 1) = 'dm' and split_part(realtime.topic(), ':', 2) = public.my_class()
      and public.my_username() in (split_part(realtime.topic(), ':', 3), split_part(realtime.topic(), ':', 4)))
);
create policy hr_rt_write on realtime.messages for insert to authenticated with check (
  (split_part(realtime.topic(), ':', 1) = 'class' and split_part(realtime.topic(), ':', 2) = public.my_class())
  or (split_part(realtime.topic(), ':', 1) = 'dm' and split_part(realtime.topic(), ':', 2) = public.my_class()
      and public.my_username() in (split_part(realtime.topic(), ':', 3), split_part(realtime.topic(), ':', 4)))
);

-- Photo proof: a private bucket. You can add and see your own photos; admins can see all.
insert into storage.buckets (id, name, public) values ('task-proofs', 'task-proofs', false) on conflict (id) do update set public = false;
drop policy if exists proofs_insert on storage.objects;
drop policy if exists proofs_read on storage.objects;
drop policy if exists proofs_delete on storage.objects;
create policy proofs_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'task-proofs' and (storage.foldername(name))[1] = public.my_class()
  and (storage.foldername(name))[3] = regexp_replace(public.my_username(), '[^A-Za-z0-9_-]', '_', 'g'));
create policy proofs_read on storage.objects for select to authenticated using (
  bucket_id = 'task-proofs' and (public.is_admin() or (storage.foldername(name))[3] = regexp_replace(public.my_username(), '[^A-Za-z0-9_-]', '_', 'g')));
create policy proofs_delete on storage.objects for delete to authenticated using (
  bucket_id = 'task-proofs' and (public.is_admin() or (storage.foldername(name))[3] = regexp_replace(public.my_username(), '[^A-Za-z0-9_-]', '_', 'g')));

-- Lets the database find "<class>:..." keys quickly (LIKE 'prefix%' cannot use the ordinary index).
create index if not exists kv_key_prefix on public.kv (key text_pattern_ops);

-- Changing class goes through this function, which checks the class exists (profiles.class_id also has a foreign key).
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

-- ===== Optional class join codes =====
-- A class with no code is open, exactly as before. When an admin sets a code, new students must enter it to join that class
-- (people already in it are not affected). Codes live in their own table that nobody can read directly; only the functions
-- below can see them, and only admins can set or list them.
alter table public.classes add column if not exists locked boolean not null default false;   -- public: "this class asks for a code"

create table if not exists public.class_codes (
  class_id text primary key references public.classes(id) on update cascade on delete cascade,
  code text not null check (length(code) between 4 and 30)
);
alter table public.class_codes enable row level security;
revoke all on public.class_codes from anon, authenticated;

-- true when the class has no code, or the code given matches (ignoring case and spaces at the ends)
create or replace function public.class_code_ok(cls text, given text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.class_codes c where c.class_id = cls)
      or exists (select 1 from public.class_codes c where c.class_id = cls and lower(c.code) = lower(trim(coalesce(given, ''))))
$$;
revoke all on function public.class_code_ok(text, text) from public, anon, authenticated;

drop function if exists public.choose_class(text);
create or replace function public.choose_class(cls text, code text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if not exists (select 1 from public.classes where id = cls) then raise exception 'Unknown class'; end if;
  if not (public.is_admin() or cls is not distinct from public.my_class() or public.class_code_ok(cls, code)) then
    raise exception 'Wrong class code';
  end if;
  update public.profiles set class_id = cls where id = auth.uid();
end $$;
revoke all on function public.choose_class(text, text) from public, anon;
grant execute on function public.choose_class(text, text) to authenticated;

drop function if exists public.complete_profile(text, text);
create or replace function public.complete_profile(uname text, cls text, code text default null) returns void
language plpgsql security definer set search_path = public as $$
declare u text := lower(trim(uname));
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if u !~ '^[a-z0-9_.]{3,20}$' then raise exception 'Bad username'; end if;
  if not exists (select 1 from public.classes where id = cls) then raise exception 'Unknown class'; end if;
  if not public.class_code_ok(cls, code) then raise exception 'Wrong class code'; end if;
  if exists (select 1 from public.profiles where id = auth.uid() and username is not null) then raise exception 'Already set up'; end if;
  update public.profiles set username = u, class_id = cls where id = auth.uid();
end $$;
revoke all on function public.complete_profile(text, text, text) from public, anon;
grant execute on function public.complete_profile(text, text, text) to authenticated;

-- Admins: set a class's code (empty = remove it, so the class is open again) and list the codes.
create or replace function public.set_class_code(cls text, new_code text) returns void
language plpgsql security definer set search_path = public as $$
declare c text := trim(coalesce(new_code, ''));
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if not exists (select 1 from public.classes where id = cls) then raise exception 'Unknown class'; end if;
  if c = '' then
    delete from public.class_codes where class_id = cls;
    update public.classes set locked = false where id = cls;
  else
    if length(c) < 4 or length(c) > 30 then raise exception 'Codes are 4 to 30 characters'; end if;
    insert into public.class_codes (class_id, code) values (cls, c) on conflict (class_id) do update set code = excluded.code;
    update public.classes set locked = true where id = cls;
  end if;
end $$;
revoke all on function public.set_class_code(text, text) from public, anon;
grant execute on function public.set_class_code(text, text) to authenticated;

create or replace function public.class_codes_admin() returns table (class_id text, code text)
language sql stable security definer set search_path = public as $$
  select c.class_id, c.code from public.class_codes c where public.is_admin()
$$;
revoke all on function public.class_codes_admin() from public, anon;
grant execute on function public.class_codes_admin() to authenticated;

-- After you create your own account in the app, make it the admin (change the name):
--   update public.profiles set is_admin = true where username = 'yourname';
-- Lets a signed-in person delete their own account. Run this once in the Supabase SQL editor.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare uname text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then raise exception 'This account cannot be deleted here'; end if;
  select username into uname from public.profiles where id = auth.uid();
  -- starts_with (not LIKE): "_" in a username is a LIKE wildcard and would delete other students' data
  if uname is not null then delete from public.kv where starts_with(key, 'u:' || uname || ':'); end if;
  delete from public.feedback where user_id = auth.uid();
  delete from auth.users where id = auth.uid(); -- profile is removed by cascade
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
