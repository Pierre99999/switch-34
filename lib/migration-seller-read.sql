-- The seller's own read of a round's conversation: engagement, tone,
-- confidence, and what nagged at them. Subjective by design — it never enters
-- a score, and lives beside the capture rather than inside it so it can never
-- be mistaken for something the prospect said.
alter table deal_rounds add column if not exists seller_read jsonb;
