-- A deal rarely dies of a single cause: "hors cadre" and "pas d'urgence" are
-- often the same story told twice. The reason becomes a list.
--
-- Safe to run whether or not migration-deal-outcome.sql already added the
-- singular column, and safe to run twice.

alter table deals add column if not exists close_reasons text[];

update deals
   set close_reasons = array[close_reason]
 where close_reason is not null
   and close_reasons is null;

alter table deals drop column if exists close_reason;
