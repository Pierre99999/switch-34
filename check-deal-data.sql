-- Read-only. Changes nothing. Run the four blocks and read the answers.
-- Replace the name if it is spelled differently in the app.

-- 1. Is the prospect context still there, and how big is it?
select id,
       prospect_name,
       prospect_url,
       jsonb_array_length(coalesce(prospect_dimensions->'dimensions', '[]'::jsonb)) as nb_dimensions,
       length(prospect_dimensions::text)                                            as taille_json,
       updated_at
  from deals
 where prospect_name ilike '%tonton%';

-- 2. Who is recorded on the deal — Nadège should be here.
select s.name, s.role, s.actor_type, s.actor_types, s.created_at
  from deal_stakeholders s
  join deals d on d.id = s.deal_id
 where d.prospect_name ilike '%tonton%'
 order by s.created_at;

-- 3. The rounds, and who each briefing was written for.
select round,
       briefing_attendees,
       briefing_line is not null as a_un_briefing,
       capture_notes <> '{}'::jsonb as a_une_capture
  from deal_rounds r
  join deals d on d.id = r.deal_id
 where d.prospect_name ilike '%tonton%'
 order by round;

-- 4. The context itself, readable. Empty result = the data is gone;
--    rows = it is in the database and the screen is not showing it.
select dim->>'label' as section,
       f->>'label'   as champ,
       f->>'value'   as valeur
  from deals d,
       jsonb_array_elements(coalesce(d.prospect_dimensions->'dimensions', '[]'::jsonb)) dim,
       jsonb_array_elements(coalesce(dim->'fields', '[]'::jsonb)) f
 where d.prospect_name ilike '%tonton%'
   and coalesce(f->>'value', '') <> '';
