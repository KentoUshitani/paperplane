-- Paper Plane / Supabase free-tier schema
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run

create table if not exists public.scores (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  best_depth integer not null default 0 check (best_depth >= 0),
  best_stage integer not null default 1 check (best_stage >= 1),
  updated_at timestamptz not null default now()
);

create index if not exists scores_best_depth_idx
  on public.scores (best_depth desc, updated_at asc);

alter table public.scores enable row level security;

drop policy if exists "scores_select_public" on public.scores;
create policy "scores_select_public"
  on public.scores for select
  using (true);

drop policy if exists "scores_insert_own" on public.scores;
create policy "scores_insert_own"
  on public.scores for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "scores_update_own" on public.scores;
create policy "scores_update_own"
  on public.scores for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Upsert best score only when improved (callable from the client)
create or replace function public.submit_best_score(
  p_depth integer,
  p_stage integer,
  p_display_name text
)
returns public.scores
language plpgsql
security invoker
set search_path = public
as $$
declare
  result public.scores;
  name text := left(trim(both from coalesce(nullif(p_display_name, ''), 'PILOT')), 24);
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.scores as s (user_id, display_name, best_depth, best_stage)
  values (auth.uid(), name, greatest(p_depth, 0), greatest(p_stage, 1))
  on conflict (user_id) do update
    set
      display_name = excluded.display_name,
      best_depth = greatest(s.best_depth, excluded.best_depth),
      best_stage = greatest(s.best_stage, excluded.best_stage),
      updated_at = case
        when excluded.best_depth > s.best_depth then now()
        else s.updated_at
      end
  returning * into result;

  return result;
end;
$$;

grant execute on function public.submit_best_score(integer, integer, text) to authenticated;
-- Run in Supabase SQL Editor (adds per-run records ranked by depth)
-- Same display_name may appear multiple times; order is by depth only.

create table if not exists public.score_records (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null,
  depth integer not null check (depth >= 0),
  stage integer not null check (stage >= 1),
  created_at timestamptz not null default now()
);

create index if not exists score_records_depth_idx
  on public.score_records (depth desc, created_at asc);

alter table public.score_records enable row level security;

drop policy if exists "score_records_select_public" on public.score_records;
create policy "score_records_select_public"
  on public.score_records for select
  using (true);

drop policy if exists "score_records_insert_own" on public.score_records;
create policy "score_records_insert_own"
  on public.score_records for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Optional: copy existing bests into records once
insert into public.score_records (user_id, display_name, depth, stage, created_at)
select s.user_id, s.display_name, s.best_depth, s.best_stage, s.updated_at
from public.scores s
where not exists (
  select 1 from public.score_records r where r.user_id = s.user_id and r.depth = s.best_depth
);

-- (score_records appended for new installs)
