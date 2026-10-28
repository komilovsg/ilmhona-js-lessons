-- Second course (vc-* lesson slugs) shares task_progress; raise per-user row cap.
create or replace function public.task_progress_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  if new.solved_at > pg_catalog.now() then
    new.solved_at := pg_catalog.now();
  end if;
  -- Serialize inserts per user so concurrent requests can't all pass the count check.
  if tg_op = 'INSERT' then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(new.user_id::text));
  end if;
  if tg_op = 'INSERT'
     and (select count(*) from public.task_progress t where t.user_id = new.user_id) >= 2000 then
    raise exception 'task_progress row limit reached' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function public.task_progress_guard() from public, anon, authenticated;
