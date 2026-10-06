-- Lets a signed-in person delete their own account. Run this once in the Supabase SQL editor.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare uname text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then raise exception 'This account cannot be deleted here'; end if;
  select username into uname from public.profiles where id = auth.uid();
  if uname is not null then delete from public.kv where key like 'u:' || uname || ':%'; end if;
  delete from public.feedback where user_id = auth.uid();
  delete from auth.users where id = auth.uid(); -- profile is removed by cascade
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
