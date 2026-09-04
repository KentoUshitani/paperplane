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
