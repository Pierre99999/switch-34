-- Rounds created before their briefing was generated, then stranded when the
-- generation was interrupted (a browser Back was enough). The code no longer
-- creates them, but existing ones still show up as an extra pill in the
-- timeline — an R2 on a deal still having its first conversation.
--
-- Run the SELECT first to see what would go.

-- 1. What is empty: no briefing, no capture, no score.
with empty_rounds as (
  select r.id, r.deal_id, r.round, d.prospect_name, d.current_round
  from deal_rounds r
  join deals d on d.id = r.deal_id
  where r.briefing_line is null
    and coalesce(r.real_business_problem, r.compelling_reason, r.concerns_fit,
                 r.stakeholder_map, r.personal_pain_linkage, r.credibility_perception,
                 r.value_solution_fit, r.competitive_position, r.urgency,
                 r.product_capability, r.implementation_feasibility, r.adoption_reality,
                 r.impact, r.urgency_resolution, r.value_momentum, r.strategic_alignment,
                 r.internal_momentum, r.open_objections, r.process_drag,
                 r.external_friction) is null
    and not exists (
      select 1 from jsonb_each_text(coalesce(r.capture_notes, '{}'::jsonb)) as kv(k, v)
      where btrim(kv.v) <> ''
    )
)
select * from empty_rounds order by prospect_name, round;

-- 2. Delete only the TRAILING empty round of each deal — an empty round in the
--    middle of a history is not the same thing and is left alone.
-- with empty_rounds as ( ...same CTE as above... )
-- delete from deal_rounds r
-- using empty_rounds e
-- where r.id = e.id
--   and e.round = e.current_round
--   and e.round > 0;

-- 3. Put current_round back on the last round that actually exists.
-- update deals d set current_round = coalesce(
--   (select max(round) from deal_rounds r where r.deal_id = d.id), 0
-- );
