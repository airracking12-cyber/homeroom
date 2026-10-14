-- Homeroom v8 upgrade. Run ONCE in Supabase > SQL Editor on a project that already runs v7.
-- It keeps every account, class and task. (Use schema.sql instead only for a brand-new project.)
-- Safe to run twice.

-- 1. Sign-up is email + password only. The username and class are chosen later, on the boarding pass.
alter table public.profiles alter column username drop not null;
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public
  as $$ begin
    insert into public.profiles (id) values (new.id);
    return new;
  end $$;

-- 2. Each class has a quarter that admins can change (Admin > Classes)
alter table public.classes add column if not exists quarter int not null default 1;
alter table public.classes drop constraint if exists classes_quarter_check;
alter table public.classes add constraint classes_quarter_check check (quarter between 1 and 4);
drop policy if exists classes_admin_update on public.classes;
create policy classes_admin_update on public.classes for update to authenticated using (public.is_admin()) with check (public.is_admin());

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

