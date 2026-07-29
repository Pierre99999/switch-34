-- Triage status for tester feedback, set from the admin dashboard.
alter table feedback add column if not exists status text not null default 'new'
  check (status in ('new', 'rejected', 'in_progress', 'done'));
