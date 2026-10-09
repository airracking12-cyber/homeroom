-- Homeroom v29: optional join codes for classes. Run in Supabase > SQL Editor AFTER upgrade-v28.sql. Safe to run twice. Keeps all data.
-- Nothing changes for students until an admin sets a code on a class (Admin > Classes). See UPGRADE-v29.md.

begin;

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

notify pgrst, 'reload schema';

commit;
