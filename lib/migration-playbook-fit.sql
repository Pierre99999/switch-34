-- Playbook fit: how well a deal matches the socle. Deal-level, not per round —
-- "is this deal ours to win?" is a question about the opportunity, refined as
-- conversations happen, not a per-round score.
alter table deals add column if not exists playbook_fit jsonb;
