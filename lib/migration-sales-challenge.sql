-- The first question of onboarding: what the user is actually struggling with.
-- Everything the app asks them to fill in is framed against this.
alter table vendors add column if not exists sales_challenge text;
alter table vendors add column if not exists sales_challenge_note text;
