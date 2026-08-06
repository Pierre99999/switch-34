-- Momentum gains two brakes and loses one.
--
-- Budget is the brake that most often decides, and it had nowhere to live:
-- "process drag" mixed procurement, legal and committees into one score that
-- said nothing actionable. Competition as a brake on the DECISION is distinct
-- from our standing against competitors, which stays on gate 2.
--
-- process_drag is left in place, unweighted: dropping the column would erase
-- what past rounds recorded.

alter table deal_rounds add column if not exists budget numeric;
alter table deal_rounds add column if not exists competition numeric;
