-- Repair: rounds opened before the lab carried the previous round's diagnostic.
--
-- A new round is not a new deal. Rounds created by the lab's own path were
-- inserted bare, so opening round N+1 wiped the scores, evidence levels,
-- sources and rationales the previous conversation had established.
--
-- The code is fixed; this fills the rounds already created empty. Only rounds
-- with no score at all are touched — anything already scored is left exactly
-- as it is, and running this twice changes nothing the second time.
--
-- To see what it will touch before running it, replace the final UPDATE with:
--   select * from source;

with unscored as (
  select r.id, r.deal_id, r.round
    from deal_rounds r
   where r.real_business_problem is null
     and r.compelling_reason is null
     and r.concerns_fit is null
     and r.stakeholder_map is null
     and r.personal_pain_linkage is null
     and r.credibility_perception is null
     and r.value_solution_fit is null
     and r.competitive_position is null
     and r.urgency is null
     and r.product_capability is null
     and r.implementation_feasibility is null
     and r.adoption_reality is null
     and r.impact is null
     and r.urgency_resolution is null
     and r.value_momentum is null
     and r.strategic_alignment is null
     and r.internal_momentum is null
     and r.open_objections is null
     and r.process_drag is null
     and r.external_friction is null
),
source as (
  select u.id as target_id,
         p.real_business_problem,
             p.compelling_reason,
             p.concerns_fit,
             p.stakeholder_map,
             p.personal_pain_linkage,
             p.credibility_perception,
             p.value_solution_fit,
             p.competitive_position,
             p.urgency,
             p.product_capability,
             p.implementation_feasibility,
             p.adoption_reality,
             p.impact,
             p.urgency_resolution,
             p.value_momentum,
             p.strategic_alignment,
             p.internal_momentum,
             p.open_objections,
             p.process_drag,
             p.external_friction,
         p.evidence_levels,
         p.authority_levels,
         p.rationales
    from unscored u
    join lateral (
      select *
        from deal_rounds p
       where p.deal_id = u.deal_id
         and p.round < u.round
         and (p.real_business_problem is not null
           or p.compelling_reason is not null
           or p.concerns_fit is not null
           or p.stakeholder_map is not null
           or p.personal_pain_linkage is not null
           or p.credibility_perception is not null
           or p.value_solution_fit is not null
           or p.competitive_position is not null
           or p.urgency is not null
           or p.product_capability is not null
           or p.implementation_feasibility is not null
           or p.adoption_reality is not null
           or p.impact is not null
           or p.urgency_resolution is not null
           or p.value_momentum is not null
           or p.strategic_alignment is not null
           or p.internal_momentum is not null
           or p.open_objections is not null
           or p.process_drag is not null
           or p.external_friction is not null)
       order by p.round desc
       limit 1
    ) p on true
)
update deal_rounds r
   set real_business_problem = src.real_business_problem,
       compelling_reason = src.compelling_reason,
       concerns_fit = src.concerns_fit,
       stakeholder_map = src.stakeholder_map,
       personal_pain_linkage = src.personal_pain_linkage,
       credibility_perception = src.credibility_perception,
       value_solution_fit = src.value_solution_fit,
       competitive_position = src.competitive_position,
       urgency = src.urgency,
       product_capability = src.product_capability,
       implementation_feasibility = src.implementation_feasibility,
       adoption_reality = src.adoption_reality,
       impact = src.impact,
       urgency_resolution = src.urgency_resolution,
       value_momentum = src.value_momentum,
       strategic_alignment = src.strategic_alignment,
       internal_momentum = src.internal_momentum,
       open_objections = src.open_objections,
       process_drag = src.process_drag,
       external_friction = src.external_friction,
       evidence_levels  = coalesce(nullif(src.evidence_levels,  '{}'::jsonb), r.evidence_levels),
       authority_levels = coalesce(nullif(src.authority_levels, '{}'::jsonb), r.authority_levels),
       rationales       = coalesce(nullif(src.rationales,       '{}'::jsonb), r.rationales)
  from source src
 where r.id = src.target_id;
