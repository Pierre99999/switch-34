-- Who the seller is about to meet, per round.
--
-- The briefing was written as if every round faced the same person. The room
-- changes between conversations, and questions written for the wrong person
-- are wasted questions.

alter table deal_rounds add column if not exists briefing_attendees jsonb;
