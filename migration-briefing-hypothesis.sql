-- The hypothesis a round is testing.
--
-- A round is not a list of questions, it is a bet: "if X turns out to be true,
-- then Y follows". Writing it down makes the round falsifiable — the next
-- capture either confirms it or does not.

alter table deal_rounds add column if not exists briefing_hypothesis text;
