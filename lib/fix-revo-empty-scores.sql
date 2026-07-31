-- One-off cleanup: round 1 of "revo" was scored from an empty capture.
-- The AI had no conversation to read, so it scored the prospect's website
-- instead. Wipe those scores so the round goes back to "briefed, not yet
-- captured" and can be scored properly after a real conversation.
--
-- Safe to re-run. Only touches rounds whose capture_notes hold nothing.

update deal_rounds set
  -- Gate 1
  real_business_problem = null, compelling_reason = null, concerns_fit = null,
  stakeholder_map = null, personal_pain_linkage = null,
  -- Gate 2
  credibility_perception = null, value_solution_fit = null,
  competitive_position = null, urgency = null,
  -- Gate 3
  product_capability = null, implementation_feasibility = null,
  adoption_reality = null, impact = null, urgency_resolution = null,
  -- Momentum
  value_momentum = null, strategic_alignment = null, internal_momentum = null,
  open_objections = null, process_drag = null, external_friction = null,
  -- Derived artefacts of that scoring pass
  evidence_levels = '{}'::jsonb,
  rationales = '{}'::jsonb,
  declarations = '{}'::jsonb
where deal_id = '627be453-b9ba-4a99-91f9-99ed949ecb3d'
  and round = 1
  and (
    capture_notes is null
    or not exists (
      select 1 from jsonb_each_text(capture_notes) as kv(k, v)
      where btrim(kv.v) <> ''
    )
  );
