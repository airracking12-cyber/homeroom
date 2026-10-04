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
  created_at timestamptz not null default now()
);
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null, class_id text, is_admin boolean not null default false,
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

-- When someone signs up, create their profile from the username and class sent with the sign-up.
-- Runs inside the database, so it works whether or not email confirmation is turned on.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public
  as $$ begin
    insert into public.profiles (id, username, class_id)
    values (new.id, lower(new.raw_user_meta_data->>'username'), new.raw_user_meta_data->>'class_id');
    return new;
  end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.classes enable row level security;
alter table public.profiles enable row level security;
alter table public.kv enable row level security;
alter table public.feedback enable row level security;

-- Classes: anyone can see the list and add a class
create policy classes_read on public.classes for select to anon, authenticated using (true);
create policy classes_add on public.classes for insert to anon, authenticated
  with check (length(id) between 3 and 60 and length(label) between 3 and 40);

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
