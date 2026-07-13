-- Store a reusable template for the "what to understand about a prospect" question.
-- Sales reps can save their standard checklist once and pre-fill it on every new deal.
alter table vendors add column if not exists sales_context_template text;
