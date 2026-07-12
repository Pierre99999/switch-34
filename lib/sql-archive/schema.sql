-- ============================================================
-- SCOREJAM DATABASE SCHEMA
-- Run this in the Supabase SQL editor
-- ============================================================

-- Vendor profile (one per user — their company + product context)
create table vendors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  company_name text not null,
  company_url text,
  product_description text,
  value_proposition text,
  differentiators text,
  ideal_customer text,
  past_wins text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Deals
create table deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  prospect_name text not null,
  prospect_url text,
  contact_name text,
  contact_title text,
  contact_linkedin text,
  current_round integer default 0,
  status text default 'active' check (status in ('active', 'won', 'lost', 'paused')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Per-round diagnostic scores (one row per deal per round)
create table deal_rounds (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references deals(id) on delete cascade not null,
  round integer not null,
  -- Layer 1: Opportunity
  real_business_problem integer check (real_business_problem between 1 and 5),
  compelling_reason integer check (compelling_reason between 1 and 5),
  concerns_fit integer check (concerns_fit between 1 and 5),
  stakeholder_map integer check (stakeholder_map between 1 and 5),
  personal_pain_linkage integer check (personal_pain_linkage between 1 and 5),
  -- Layer 2: Winability
  credibility_perception integer check (credibility_perception between 1 and 5),
  value_solution_fit integer check (value_solution_fit between 1 and 5),
  competitive_position integer check (competitive_position between 1 and 5),
  urgency integer check (urgency between 1 and 5),
  -- Layer 3: Impact
  product_capability integer check (product_capability between 1 and 5),
  implementation_feasibility integer check (implementation_feasibility between 1 and 5),
  adoption_reality integer check (adoption_reality between 1 and 5),
  impact integer check (impact between 1 and 5),
  urgency_resolution integer check (urgency_resolution between 1 and 5),
  -- Layer 4: Momentum
  value_momentum integer check (value_momentum between 1 and 5),
  strategic_alignment integer check (strategic_alignment between 1 and 5),
  internal_momentum integer check (internal_momentum between 1 and 5),
  open_objections integer check (open_objections between 1 and 5),
  process_drag integer check (process_drag between 1 and 5),
  external_friction integer check (external_friction between 1 and 5),
  -- Rationales (free text per variable)
  rationales jsonb default '{}',
  -- Engine narrative
  narrative text,
  -- Capture (conversation log)
  capture_notes jsonb default '{}',
  -- Briefing content (generated or written)
  briefing_line text,
  briefing_read text,
  briefing_angle text,
  briefing_questions jsonb default '[]',
  briefing_do_not jsonb default '[]',
  briefing_mirror jsonb default '[]',
  briefing_objections jsonb default '[]',
  briefing_win_condition text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(deal_id, round)
);

-- Knowledge boxes (one row per box per deal, updated across rounds)
create table deal_boxes (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references deals(id) on delete cascade not null,
  box_id text not null,  -- e.g. 'perception', 'problemes', 'urgence'
  entries jsonb default '[]',  -- [{round: 0, text: "..."}]
  updated_at timestamptz default now(),
  unique(deal_id, box_id)
);

-- Stakeholders (per deal)
create table deal_stakeholders (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references deals(id) on delete cascade not null,
  name text not null,
  role text,
  actor_type text check (actor_type in ('champion', 'decision_maker', 'user', 'reviewer', 'blocker', 'unknown')),
  notes text,
  first_seen_round integer,
  created_at timestamptz default now()
);

-- Conversation themes (extracted across rounds)
create table deal_themes (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references deals(id) on delete cascade not null,
  title text not null,
  body text,
  rounds jsonb default '[]',  -- [1, 2]
  created_at timestamptz default now()
);

-- Mirror vocabulary (prospect's exact words)
create table deal_mirror (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references deals(id) on delete cascade not null,
  term text not null,
  round integer,
  unique(deal_id, term)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table vendors enable row level security;
alter table deals enable row level security;
alter table deal_rounds enable row level security;
alter table deal_boxes enable row level security;
alter table deal_stakeholders enable row level security;
alter table deal_themes enable row level security;
alter table deal_mirror enable row level security;

-- Vendors: user owns their own row
create policy "users manage own vendor" on vendors
  for all using (auth.uid() = user_id);

-- Deals: user owns their deals
create policy "users manage own deals" on deals
  for all using (auth.uid() = user_id);

-- Deal sub-tables: access via deal ownership
create policy "users manage own deal_rounds" on deal_rounds
  for all using (
    exists (select 1 from deals where deals.id = deal_rounds.deal_id and deals.user_id = auth.uid())
  );

create policy "users manage own deal_boxes" on deal_boxes
  for all using (
    exists (select 1 from deals where deals.id = deal_boxes.deal_id and deals.user_id = auth.uid())
  );

create policy "users manage own deal_stakeholders" on deal_stakeholders
  for all using (
    exists (select 1 from deals where deals.id = deal_stakeholders.deal_id and deals.user_id = auth.uid())
  );

create policy "users manage own deal_themes" on deal_themes
  for all using (
    exists (select 1 from deals where deals.id = deal_themes.deal_id and deals.user_id = auth.uid())
  );

create policy "users manage own deal_mirror" on deal_mirror
  for all using (
    exists (select 1 from deals where deals.id = deal_mirror.deal_id and deals.user_id = auth.uid())
  );

-- ============================================================
-- HELPERS
-- ============================================================

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger update_vendors_updated_at before update on vendors for each row execute function update_updated_at();
create trigger update_deals_updated_at before update on deals for each row execute function update_updated_at();
create trigger update_deal_rounds_updated_at before update on deal_rounds for each row execute function update_updated_at();
