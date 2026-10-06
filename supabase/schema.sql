-- Homeroom database. Paste this whole file into Supabase, SQL Editor, and run it once.
-- It starts fresh: it removes the old shared "kv" table and everything in it.

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
  username text unique, class_id text, is_admin boolean not null default false,
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
revoke update on public.profiles from authenticated;
grant update (class_id) on public.profiles to authenticated;

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
