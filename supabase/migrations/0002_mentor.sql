-- Mentor: shared model quota counters + 7-day request log.
-- Run after 0001 in the Supabase SQL editor (or `supabase db push`). Safe to re-run.
--
-- Security model
--  * Only the server (service_role / sb_secret_... key, never shipped to the browser) touches these
--    objects. RLS is enabled with NO policies, and table/function privileges are revoked from
--    public, anon and authenticated, so the public API keys see nothing.
--  * model_key is an opaque id ('m1'..'m6'); the vendor model id is mapped only in server code.
--  * mentor_log never stores model answers, raw IPs or unredacted text: ip_hash is an HMAC with a
--    server-side, daily-rotating salt, redacted_question is the already-redacted student message
--    (max 500 chars). Rows older than 7 days are deleted (pg_cron daily + hourly from the API).

-- ---------------------------------------------------------------- usage counters
create table if not exists public.mentor_model_usage (
  model_key       text primary key check (model_key ~ '^[a-z0-9_-]{1,16}$'),
  minute_window   timestamptz,          -- start of the current one-minute window (first request in it)
  minute_count    int not null default 0,
  day_window      date,                 -- Pacific (America/Los_Angeles) date: the vendor RPD resets at midnight PT
  day_count       int not null default 0,
  exhausted_until timestamptz,          -- set from an upstream 429
  last_status     text,                 -- 'ok' | 'minute' | 'day'
  updated_at      timestamptz not null default now()
);

alter table public.mentor_model_usage enable row level security;
revoke all on table public.mentor_model_usage from public, anon, authenticated;
grant select on table public.mentor_model_usage to service_role;

-- ---------------------------------------------------------------- request log
create table if not exists public.mentor_log (
  id                bigserial primary key,
  created_at        timestamptz not null default now(),
  lesson_slug       text check (char_length(lesson_slug) <= 80),
  task_id           text check (char_length(task_id) <= 40),
  locale            text check (locale in ('ru', 'tg')),
  model_key         text check (char_length(model_key) <= 16),
  outcome           text not null check (outcome in ('ok', 'off_topic', 'identity', 'busy', 'daily_limit', 'error', 'rejected')),
  latency_ms        int check (latency_ms >= 0),
  ip_hash           text check (char_length(ip_hash) <= 64),
  redacted_question text check (char_length(redacted_question) <= 500),
  pii_redacted      boolean not null default false
);

create index if not exists mentor_log_created_at_idx on public.mentor_log (created_at);

alter table public.mentor_log enable row level security;
revoke all on table public.mentor_log from public, anon, authenticated;
grant select, insert on table public.mentor_log to service_role;
revoke all on sequence public.mentor_log_id_seq from public, anon, authenticated;
grant usage on sequence public.mentor_log_id_seq to service_role;

-- ---------------------------------------------------------------- try_acquire
-- Atomically takes one request slot for a model. The row is locked (insert .. on conflict, then
-- select .. for update), so parallel callers on any number of serverless instances serialize here.
-- Minute window: starts at the first request and lasts 60 s. Day window: Pacific calendar date.
-- reason: 'ok' | 'minute' (RPM reached or short upstream exhaustion) | 'day' (RPD reached or daily
-- exhaustion). retry_after: seconds until a slot may free up (0 when allowed).
create or replace function public.mentor_try_acquire(p_model_key text, p_rpm int, p_rpd int)
returns table (allowed boolean, reason text, retry_after int)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_now  timestamptz := pg_catalog.clock_timestamp();
  v_day  date := (v_now at time zone 'America/Los_Angeles')::date;
  r      public.mentor_model_usage%rowtype;
begin
  if p_model_key is null or p_rpm is null or p_rpd is null or p_rpm < 1 or p_rpd < 1 then
    raise exception 'bad arguments';
  end if;

  insert into public.mentor_model_usage as u (model_key, minute_window, minute_count, day_window, day_count)
  values (p_model_key, v_now, 0, v_day, 0)
  on conflict (model_key) do nothing;

  select * into r from public.mentor_model_usage u where u.model_key = p_model_key for update;

  if r.minute_window is null or v_now >= r.minute_window + interval '60 seconds' then
    r.minute_window := v_now;
    r.minute_count := 0;
  end if;
  if r.day_window is distinct from v_day then
    r.day_window := v_day;
    r.day_count := 0;
  end if;

  if r.exhausted_until is not null and r.exhausted_until > v_now then
    allowed := false;
    reason := case when r.last_status = 'day' then 'day' else 'minute' end;
    retry_after := greatest(1, ceil(extract(epoch from r.exhausted_until - v_now)))::int;
  elsif r.day_count >= p_rpd then
    allowed := false;
    reason := 'day';
    retry_after := greatest(1, ceil(extract(epoch from
      (((v_day + 1)::timestamp) at time zone 'America/Los_Angeles') - v_now)))::int;
  elsif r.minute_count >= p_rpm then
    allowed := false;
    reason := 'minute';
    retry_after := greatest(1, ceil(extract(epoch from r.minute_window + interval '60 seconds' - v_now)))::int;
  else
    allowed := true;
    reason := 'ok';
    retry_after := 0;
    r.minute_count := r.minute_count + 1;
    r.day_count := r.day_count + 1;
    r.last_status := 'ok';
  end if;

  update public.mentor_model_usage u
     set minute_window = r.minute_window,
         minute_count  = r.minute_count,
         day_window    = r.day_window,
         day_count     = r.day_count,
         last_status   = r.last_status,
         updated_at    = v_now
   where u.model_key = p_model_key;

  return next;
end;
$$;

-- ---------------------------------------------------------------- mark_exhausted
-- Upstream 429: remember until when the model is out ('minute' = retryDelay, 'day' = next Pacific
-- midnight). Never shortens a longer exhaustion already recorded.
create or replace function public.mentor_mark_exhausted(p_model_key text, p_until timestamptz, p_status text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_status not in ('minute', 'day') or p_until is null
     or p_until > pg_catalog.now() + interval '2 days' then
    raise exception 'bad arguments';
  end if;
  insert into public.mentor_model_usage as u (model_key, exhausted_until, last_status)
  values (p_model_key, p_until, p_status)
  on conflict (model_key) do update
     set exhausted_until = excluded.exhausted_until,
         last_status     = excluded.last_status,
         updated_at      = pg_catalog.now()
   where u.exhausted_until is null
      or u.exhausted_until <= pg_catalog.now()
      or u.exhausted_until < excluded.exhausted_until;
end;
$$;

-- ---------------------------------------------------------------- stats for the admin page
create or replace function public.mentor_outcome_totals(p_since timestamptz)
returns table (outcome text, n bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select l.outcome, count(*)::bigint from public.mentor_log l where l.created_at >= p_since group by l.outcome;
$$;

-- ---------------------------------------------------------------- retention
create or replace function public.mentor_purge_logs()
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  n bigint;
begin
  delete from public.mentor_log where created_at < pg_catalog.now() - interval '7 days';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.mentor_try_acquire(text, int, int) from public, anon, authenticated;
revoke all on function public.mentor_mark_exhausted(text, timestamptz, text) from public, anon, authenticated;
revoke all on function public.mentor_outcome_totals(timestamptz) from public, anon, authenticated;
revoke all on function public.mentor_purge_logs() from public, anon, authenticated;
grant execute on function public.mentor_try_acquire(text, int, int) to service_role;
grant execute on function public.mentor_mark_exhausted(text, timestamptz, text) to service_role;
grant execute on function public.mentor_outcome_totals(timestamptz) to service_role;
grant execute on function public.mentor_purge_logs() to service_role;

-- Daily purge at 03:17 UTC via pg_cron when the extension is available (it is on Supabase).
-- Without pg_cron this block only prints a notice; the API still purges at most once an hour.
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron not available (%), relying on the API purge', sqlerrm;
    return;
  end;
  execute $q$select cron.schedule('mentor-purge', '17 3 * * *', 'select public.mentor_purge_logs()')$q$;
exception when others then
  raise notice 'could not schedule mentor-purge (%), relying on the API purge', sqlerrm;
end;
$$;
