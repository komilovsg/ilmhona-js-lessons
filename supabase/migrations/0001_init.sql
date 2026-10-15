-- Ilmhona: accounts, cross-device progress sync, public leaderboard.
-- Run once in the Supabase SQL editor (or `supabase db push`). Safe to re-run.
--
-- Security model
--  * Every table has RLS enabled; anon has no table privileges at all.
--  * profiles: NO direct read access for other users. Each user reads/updates only their own
--    row. The public leaderboard goes through public.leaderboard(), a SECURITY DEFINER function
--    that returns only aggregates + display name/avatar. This keeps user ids (= auth.users ids)
--    and the list of all registered accounts private, and lets us control exactly which columns
--    are exposed. A "public select on display_name/avatar" policy would have leaked the id
--    column too (RLS is row-level, and PostgREST needs the id to join).
--  * Users may change only their display_name (column-level GRANT). avatar_url comes from the
--    OAuth provider at sign-up; letting clients set it would allow arbitrary image URLs
--    (tracking pixels, inappropriate images) on a page every student sees.
--  * task_progress: owner-only CRUD.
--
-- Known ceiling: XP is client-reported. A student can insert fake rows (up to 40 XP each,
-- with plausible lesson/task ids) via the API. This is acceptable for a classroom
-- leaderboard; the per-user row cap below only bounds abuse. Upgrade path: a server-side
-- task catalog (lesson_slug, task_id, max_xp) + a foreign key / check, or moving writes to an
-- Edge Function that validates solutions before awarding XP.

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
               check (char_length(display_name) between 2 and 32
                      and display_name = btrim(display_name)
                      and display_name !~ '[[:cntrl:]]'),
  avatar_url   text check (avatar_url is null or (avatar_url ~ '^https://' and char_length(avatar_url) <= 500)),
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;
-- No INSERT (the trigger creates rows) and no DELETE (cascades from auth.users).

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Auto-create a profile on sign-up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name   text;
  v_avatar text;
begin
  v_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(coalesce(new.email, ''), '@', 1)
  );
  v_name := pg_catalog.regexp_replace(v_name, '[[:cntrl:]]', '', 'g');
  v_name := pg_catalog.btrim(pg_catalog.regexp_replace(v_name, '\s+', ' ', 'g'));
  v_name := pg_catalog.btrim(pg_catalog.left(v_name, 32));
  if v_name is null or pg_catalog.char_length(v_name) < 2 then
    v_name := 'Ученик ' || pg_catalog.substr(pg_catalog.md5(pg_catalog.random()::text), 1, 4);
  end if;

  v_avatar := coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture');
  if v_avatar is null or v_avatar !~ '^https://' or pg_catalog.char_length(v_avatar) > 500 then
    v_avatar := null;
  end if;

  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, v_name, v_avatar)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- task_progress
create table if not exists public.task_progress (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lesson_slug text not null check (lesson_slug ~ '^[a-z0-9-]{1,40}$'),
  task_id     text not null check (task_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  solved_at   timestamptz not null,
  auto        boolean not null,
  hints       smallint[] not null default '{}'
              check (cardinality(hints) <= 10 and array_position(hints, null) is null and 0 <= all (hints)),
  xp          smallint not null check (xp between 0 and 40),
  updated_at  timestamptz not null default now(),
  primary key (user_id, lesson_slug, task_id)
);

-- Covering index for the leaderboard aggregate (index-only scan of user_id/xp).
create index if not exists task_progress_user_xp_idx
  on public.task_progress (user_id) include (xp, solved_at);

alter table public.task_progress enable row level security;

revoke all on table public.task_progress from public, anon, authenticated;
grant select, insert, update, delete on table public.task_progress to authenticated;

drop policy if exists "task_progress: read own" on public.task_progress;
create policy "task_progress: read own" on public.task_progress
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "task_progress: insert own" on public.task_progress;
create policy "task_progress: insert own" on public.task_progress
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "task_progress: update own" on public.task_progress;
create policy "task_progress: update own" on public.task_progress
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "task_progress: delete own" on public.task_progress;
create policy "task_progress: delete own" on public.task_progress
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Server-controlled columns + abuse bound (free tier has 500 MB): updated_at is always now(),
-- solved_at can't be in the future, at most 1000 rows per user (the course has far fewer tasks).
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
  if tg_op = 'INSERT'
     and (select count(*) from public.task_progress t where t.user_id = new.user_id) >= 1000 then
    raise exception 'task_progress row limit reached' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function public.task_progress_guard() from public, anon, authenticated;

drop trigger if exists task_progress_guard on public.task_progress;
create trigger task_progress_guard
  before insert or update on public.task_progress
  for each row execute function public.task_progress_guard();

-- ---------------------------------------------------------------- leaderboard
-- Aggregates only: never returns user ids or raw rows. is_me lets the caller find themselves.
create or replace function public.leaderboard(limit_n int default 50)
returns table (
  rank         bigint,
  display_name text,
  avatar_url   text,
  xp_total     bigint,
  solved_count bigint,
  is_me        boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with totals as (
    select t.user_id,
           sum(t.xp)::bigint   as xp_total,
           count(*)::bigint    as solved_count,
           max(t.solved_at)    as last_solved
    from public.task_progress t
    group by t.user_id
  )
  select pg_catalog.rank() over (order by tt.xp_total desc, tt.solved_count desc) as rank,
         p.display_name,
         p.avatar_url,
         tt.xp_total,
         tt.solved_count,
         coalesce(tt.user_id = (select auth.uid()), false) as is_me
  from totals tt
  join public.profiles p on p.id = tt.user_id
  order by tt.xp_total desc, tt.solved_count desc, tt.last_solved asc, p.display_name
  limit greatest(1, least(coalesce(limit_n, 50), 100));
$$;

revoke all on function public.leaderboard(int) from public;
grant execute on function public.leaderboard(int) to anon, authenticated;
