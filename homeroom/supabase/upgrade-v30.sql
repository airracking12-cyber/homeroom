-- Homeroom v30. Run ONCE in Supabase > SQL Editor AFTER upgrade-v28.sql and upgrade-v29.sql. Safe to run twice. Keeps all data.
-- (A brand-new project should run schema.sql instead; it already contains all of this.)
-- Nothing breaks if you open the v30 app before running this: notes still save and open, they just don't keep their original
-- file, and a reviewer a student made is saved as an ordinary upload. See UPGRADE-v30.md.

begin;

-- ===== v30: the Data tab =====
-- A. Students can share a reviewer they made themselves (kind 'reviewer'), next to ordinary notes and the assistant's reviewers.
-- B. An upload keeps its original file (PDF or photo) in a private, class-only storage bucket, linked from the note.
-- C. Search ranks a lesson's topic and title above its body, so the assistant finds the right lesson first.
-- D. A student can add at most 60 notes a day (a stuck loop or a mistake can't flood the class's library).

-- A. student-made reviewers
alter table public.notes drop constraint if exists notes_kind_check;
alter table public.notes add constraint notes_kind_check check (kind in ('upload', 'ai', 'typed', 'reviewer'));

-- B. original files
alter table public.notes add column if not exists file_path text;
alter table public.notes add column if not exists file_name text;
alter table public.notes add column if not exists file_type text;
alter table public.notes add column if not exists file_size int;
alter table public.notes drop constraint if exists notes_file_ok;
alter table public.notes add constraint notes_file_ok check (
  file_path is null or (length(file_path) <= 300 and starts_with(file_path, class_id || '/') and coalesce(file_size, 0) between 0 and 10485760));
grant insert (id, class_id, author, subject, topic, title, body, kind, task_id, task_title, file_path, file_name, file_type, file_size) on public.notes to authenticated;

-- A private bucket: files are saved under <class id>/<note id>/<file name>. Only people in that class can see them.
insert into storage.buckets (id, name, public, file_size_limit) values ('class-notes', 'class-notes', false, 10485760)
  on conflict (id) do update set public = false, file_size_limit = 10485760;
drop policy if exists class_notes_insert on storage.objects;
drop policy if exists class_notes_read on storage.objects;
drop policy if exists class_notes_delete on storage.objects;
create policy class_notes_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'class-notes' and (storage.foldername(name))[1] = public.my_class());
create policy class_notes_read on storage.objects for select to authenticated
  using (bucket_id = 'class-notes' and ((storage.foldername(name))[1] = public.my_class() or public.is_admin()));
-- A file can be removed by whoever may remove its note, or (once the note itself is gone) by anyone in the class, so no orphan stays behind.
create policy class_notes_delete on storage.objects for delete to authenticated
  using (bucket_id = 'class-notes' and (
    public.is_admin()
    or ((storage.foldername(name))[1] = public.my_class() and (
      not exists (select 1 from public.notes n where n.id = (storage.foldername(name))[2])
      or exists (select 1 from public.notes n where n.id = (storage.foldername(name))[2] and (n.owner = auth.uid() or n.owner is null))))));

-- C. better ranking: topic (A) and title (B) count for more than the body text (D)
alter table public.notes drop column if exists search;   -- its index goes with it
alter table public.notes add column search tsvector generated always as (
  setweight(to_tsvector('simple', coalesce(topic, '')), 'A') ||
  setweight(to_tsvector('simple', title), 'B') ||
  setweight(to_tsvector('simple', body), 'D')) stored;
create index if not exists notes_search on public.notes using gin (search);

-- D. at most 60 notes (not counting the assistant's own reviewers) per student per day
create or replace function public.notes_daily_cap() returns trigger language plpgsql as $$
begin
  if new.kind <> 'ai' and new.owner is not null
     and (select count(*) from public.notes where owner = new.owner and kind <> 'ai' and created_at > now() - interval '1 day') >= 60 then
    raise exception 'Too many notes today. Try again tomorrow.';
  end if;
  return new;
end $$;
drop trigger if exists notes_daily_cap on public.notes;
create trigger notes_daily_cap before insert on public.notes for each row execute function public.notes_daily_cap();

commit;
