-- Homeroom x Minecraft. Run this ONCE in Supabase (SQL Editor), after schema.sql.
-- It is safe to run while the feature is still switched off in the app: nothing changes for students until you turn it on.
--
-- STEP 1: change the secret below to your own long random text BEFORE you run this file.
--         Put the exact same text in the plugin's config.yml ("secret").

create table if not exists public.mc_links (
  mc_name    text primary key,                                              -- the Minecraft name, lowercase
  user_id    uuid not null unique references auth.users on delete cascade,  -- one Minecraft name per student
  mc_display text not null,                                                 -- the Minecraft name as typed
  created_at timestamptz not null default now()
);
create table if not exists public.mc_settings (key text primary key, value text not null);
alter table public.mc_links enable row level security;     -- no policies on purpose: everything goes through the functions below
alter table public.mc_settings enable row level security;  -- same: the secret can never be read from the app

insert into public.mc_settings (key, value) values ('secret', 'CHANGE-ME-to-a-long-random-text')
on conflict (key) do nothing;

-- INTERNAL: how many of this student's class tasks (current quarter) are done?
-- A task counts as done when the student's name is in the class's "completions" list, the same list the app shows as "classmates finished".
create or replace function public.mc_progress(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uname text; cls text; q int; tasks jsonb; comps jsonb; total int; done int;
begin
  select username, class_id into uname, cls from public.profiles where id = p_user;
  if uname is null or cls is null then return jsonb_build_object('ok', false, 'done', 0, 'total', 0); end if;
  select quarter into q from public.classes where id = cls;
  select value into tasks from public.kv where key = cls || ':tasks';
  select value into comps from public.kv where key = cls || ':completions';
  select count(*), count(*) filter (where (comps -> (t ->> 'id')) @> to_jsonb(uname))
    into total, done
    from jsonb_array_elements(coalesce(tasks, '[]'::jsonb)) t
   where coalesce(nullif(t ->> 'quarter', '')::int, 1) = coalesce(q, 1);
  return jsonb_build_object('ok', total > 0 and done = total, 'done', done, 'total', total);
end $$;
revoke all on function public.mc_progress(uuid) from public, anon, authenticated;

-- THE SERVER ASKS THIS when someone tries to join. Needs the secret. Answers yes/no and why.
create or replace function public.mc_check(p_secret text, p_name text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid; pr jsonb;
begin
  if p_secret is distinct from (select value from public.mc_settings where key = 'secret') then
    return jsonb_build_object('ok', false, 'reason', 'bad_secret');
  end if;
  select user_id into uid from public.mc_links where mc_name = lower(coalesce(p_name, ''));
  if uid is null then return jsonb_build_object('ok', false, 'reason', 'not_linked'); end if;
  pr := public.mc_progress(uid);
  if (pr ->> 'ok')::boolean then return pr; end if;
  return pr || jsonb_build_object('reason', 'tasks_pending');
end $$;
revoke all on function public.mc_check(text, text) from public;
grant execute on function public.mc_check(text, text) to anon, authenticated;

-- THE APP USES THESE (signed-in students)
create or replace function public.my_minecraft() returns text
language sql stable security definer set search_path = public as
  $$ select mc_display from public.mc_links where user_id = auth.uid() $$;

create or replace function public.link_minecraft(p_name text) returns void
language plpgsql security definer set search_path = public as $$
declare n text := trim(coalesce(p_name, ''));
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if n !~ '^[A-Za-z0-9_]{3,16}$' then raise exception 'Bad Minecraft name'; end if;
  delete from public.mc_links where user_id = auth.uid();
  insert into public.mc_links (mc_name, user_id, mc_display) values (lower(n), auth.uid(), n);
end $$;

create or replace function public.unlink_minecraft() returns void
language sql security definer set search_path = public as
  $$ delete from public.mc_links where user_id = auth.uid() $$;

create or replace function public.mc_my_progress() returns jsonb
language sql stable security definer set search_path = public as
  $$ select public.mc_progress(auth.uid()) $$;

revoke all on function public.my_minecraft(), public.link_minecraft(text), public.unlink_minecraft(), public.mc_my_progress() from public, anon;
grant execute on function public.my_minecraft(), public.link_minecraft(text), public.unlink_minecraft(), public.mc_my_progress() to authenticated;

-- ADMIN: see who is linked, and unlink someone (for example a typo, or a name that was claimed by the wrong person)
create or replace function public.mc_links_admin() returns table (mc_display text, username text, class_id text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query select l.mc_display, p.username, p.class_id, l.created_at
    from public.mc_links l join public.profiles p on p.id = l.user_id order by l.created_at desc;
end $$;
create or replace function public.mc_admin_unlink(p_name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  delete from public.mc_links where mc_name = lower(coalesce(p_name, ''));
end $$;
revoke all on function public.mc_links_admin(), public.mc_admin_unlink(text) from public, anon;
grant execute on function public.mc_links_admin(), public.mc_admin_unlink(text) to authenticated;
