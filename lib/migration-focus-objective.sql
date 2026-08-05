-- The objective for the NEXT conversation, written by the engine at the same
-- moment it writes the post-conversation read — when it has just weighed what
-- was said against what the gates need.
--
-- Composing it from the prescriptions gave mechanical phrasing ("Corroborer X
-- et corroborer Y"). A sentence written once, by the model that just did the
-- analysis, reads like an instruction from a coach.
alter table deal_rounds add column if not exists focus_objective text;
