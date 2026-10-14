-- Homeroom v10 fixes. Run ONCE in Supabase > SQL Editor on a project that is already running. Safe to run twice. Keeps all data.

-- 1. Only signed-in people can add a class, and class ids must be plain (letters, numbers, dashes).
drop policy if exists classes_add on public.classes;
create policy classes_add on public.classes for insert to authenticated
  with check (id ~ '^[a-z0-9-]{3,60}$' and length(label) between 3 and 40);

-- 2. Deleting an account no longer touches other students' data when a username contains "_".
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
