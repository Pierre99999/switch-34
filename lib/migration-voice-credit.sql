-- Voice-credit weighting (Switch_credit_de_voix.md)

-- 1. Add the budget_guardian actor type to the stakeholder role constraint.
alter table deal_stakeholders drop constraint if exists deal_stakeholders_actor_type_check;
alter table deal_stakeholders add constraint deal_stakeholders_actor_type_check
  check (actor_type in ('champion', 'decision_maker', 'user', 'reviewer', 'budget_guardian', 'blocker', 'unknown'));

-- 2. Store per-criterion declarations (who said what, with which stance) so the
--    engine can recompute the voice credit and show the evidence breakdown.
alter table deal_rounds add column if not exists declarations jsonb default '{}';
