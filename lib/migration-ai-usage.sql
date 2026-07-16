-- Per-call AI token usage, to track consumption and cost per account.
create table if not exists ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
  deal_id uuid,
  route text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  created_at timestamptz default now()
);

create index if not exists ai_usage_user_idx on ai_usage(user_id);

alter table ai_usage enable row level security;

-- Users may insert their own usage rows; reads are done with the service role
-- (admin dashboard), so no select policy is granted to regular users.
create policy "users insert own ai_usage" on ai_usage
  for insert with check (user_id = auth.uid());
