-- The Sales Playbook (Part A of the Switch playbook — "le socle") replaces the
-- 9-dimension company profile. The old `dimensions` column is left in place
-- untouched: nothing reads it any more, but no data is destroyed either.
alter table vendors add column if not exists playbook jsonb default '{}'::jsonb;
