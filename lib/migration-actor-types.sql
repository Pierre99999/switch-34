-- A contact can wear several hats (e.g. decision maker AND budget guardian).
-- Store the full set of roles; actor_type stays as the primary role for
-- backward-compatible single-role displays.
alter table deal_stakeholders add column if not exists actor_types text[] default '{}';
