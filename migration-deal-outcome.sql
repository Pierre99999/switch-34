-- Why a deal was won or lost, captured at the moment it closes.
--
-- Flat columns rather than a jsonb blob: this is the table any future pattern
-- work will group by, and "which gate gave way, on which round, how often"
-- should be a plain SQL question.

alter table deals add column if not exists close_reason text;
alter table deals add column if not exists close_round int;
alter table deals add column if not exists closed_at date;
alter table deals add column if not exists close_note text;

-- The corpus is always read per seller, and always over closed deals only.
create index if not exists deals_closed_idx
  on deals (user_id, status, closed_at)
  where status in ('won', 'lost');
