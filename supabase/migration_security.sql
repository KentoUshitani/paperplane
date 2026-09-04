-- Security hardening for public leaderboard (run in SQL Editor)
-- - Scores only via validated RPC (no direct INSERT)
-- - Depth/stage caps
-- - Per-user rate limit
-- - Sanitized display names

-- Ensure table exists (safe if already created)
create table if not exists public.score_records (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null,
  depth integer not null check (depth >= 0 and depth <= 730),
  stage integer not null check (stage >= 1 and stage <= 10),
  created_at timestamptz not null default now()
);

-- Tighten checks if table already existed without caps
alter table public.score_records
  drop constraint if exists score_records_depth_check;
alter table public.score_records
  add constraint score_records_depth_check
  check (depth >= 0 and depth <= 730);

alter table public.score_records
  drop constraint if exists score_records_stage_check;
alter table public.score_records
  add constraint score_records_stage_check
  check (stage >= 1 and stage <= 10);

create index if not exists score_records_depth_idx
  on public.score_records (depth desc, created_at asc);

create index if not exists score_records_user_created_idx
  on public.score_records (user_id, created_at desc);

alter table public.score_records enable row level security;

-- Public can read leaderboard rows only (no write)
drop policy if exists "score_records_select_public" on public.score_records;
create policy "score_records_select_public"
  on public.score_records for select
  using (true);

-- Remove direct client inserts/updates/deletes
drop policy if exists "score_records_insert_own" on public.score_records;
drop policy if exists "score_records_update_own" on public.score_records;
drop policy if exists "score_records_delete_own" on public.score_records;

revoke insert, update, delete on public.score_records from anon, authenticated;
grant select on public.score_records to anon, authenticated;

create or replace function public.submit_score_record(
  p_depth integer,
  p_stage integer,
  p_display_name text
)
returns public.score_records
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  name text;
  recent_count integer;
  result public.score_records;
  d integer := coalesce(p_depth, 0);
  s integer := coalesce(p_stage, 1);
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  -- Cap to game design limits (CLEAR = 730m / 10 stages)
  if d < 1 or d > 730 then
    raise exception 'Invalid depth' using errcode = '22023';
  end if;
  if s < 1 or s > 10 then
    raise exception 'Invalid stage' using errcode = '22023';
  end if;

  -- Rate limit: max 20 submits / hour / user (spam / abuse)
  select count(*) into recent_count
  from public.score_records
  where user_id = uid
    and created_at > now() - interval '1 hour';
  if recent_count >= 20 then
    raise exception 'Rate limit exceeded' using errcode = '54000';
  end if;

  name := left(
    regexp_replace(
      trim(both from coalesce(nullif(p_display_name, ''), 'PILOT')),
      '[[:cntrl:]]',
      '',
      'g'
    ),
    24
  );
  if name = '' then
    name := 'PILOT';
  end if;

  insert into public.score_records (user_id, display_name, depth, stage)
  values (uid, name, d, s)
  returning * into result;

  return result;
end;
$$;

revoke all on function public.submit_score_record(integer, integer, text) from public;
grant execute on function public.submit_score_record(integer, integer, text) to authenticated;
