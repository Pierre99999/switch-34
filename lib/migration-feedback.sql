-- In-app feedback from beta testers.
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
  sentiment text check (sentiment in ('positive', 'negative', 'neutral')),
  message text not null,
  page text,
  created_at timestamptz default now()
);

create index if not exists feedback_created_idx on feedback(created_at desc);

alter table feedback enable row level security;

-- Users submit their own feedback; reading is done with the service role
-- (admin dashboard), so no select policy for regular users.
create policy "users insert own feedback" on feedback
  for insert with check (user_id = auth.uid());
