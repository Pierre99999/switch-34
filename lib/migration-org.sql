-- ============================================================
-- Migration: Organizations, Question Templates, Team Management
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Organizations table
CREATE TABLE organizations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  invite_code text NOT NULL DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages org"
  ON organizations FOR ALL
  USING (owner_id = auth.uid());

CREATE POLICY "members read org"
  ON organizations FOR SELECT
  USING (id IN (SELECT organization_id FROM vendors WHERE user_id = auth.uid()));

-- 2. Add organization_id to vendors
ALTER TABLE vendors ADD COLUMN organization_id uuid REFERENCES organizations(id);

-- 3. Question templates table
CREATE TABLE question_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  text text NOT NULL,
  category text DEFAULT 'general',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE question_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members manage templates"
  ON question_templates FOR ALL
  USING (organization_id IN (SELECT organization_id FROM vendors WHERE user_id = auth.uid()));

-- 4. Add selected_templates to deal_rounds (array of template IDs to use in this round)
ALTER TABLE deal_rounds ADD COLUMN selected_templates jsonb DEFAULT '[]'::jsonb;

-- 5. Add mandatory_questions if not already added
DO $$ BEGIN
  ALTER TABLE deal_rounds ADD COLUMN mandatory_questions jsonb DEFAULT '[]'::jsonb;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 6. Add onboarding_completed to vendors
ALTER TABLE vendors ADD COLUMN onboarding_completed boolean DEFAULT false;

-- 7. Update RLS: scope deals to organization
-- Drop old policies that don't account for org
DROP POLICY IF EXISTS "users manage own deals" ON deals;
DROP POLICY IF EXISTS "directors read all deals" ON deals;

CREATE POLICY "users manage own deals"
  ON deals FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "directors read org deals"
  ON deals FOR SELECT
  USING (
    user_id IN (
      SELECT v2.user_id FROM vendors v1
      JOIN vendors v2 ON v2.organization_id = v1.organization_id
      WHERE v1.user_id = auth.uid() AND v1.role = 'director'
    )
  );

-- 8. Update RLS: scope deal_rounds to organization
DROP POLICY IF EXISTS "users manage own rounds" ON deal_rounds;
DROP POLICY IF EXISTS "directors read all rounds" ON deal_rounds;

CREATE POLICY "users manage own rounds"
  ON deal_rounds FOR ALL
  USING (deal_id IN (SELECT id FROM deals WHERE user_id = auth.uid()));

CREATE POLICY "directors read org rounds"
  ON deal_rounds FOR SELECT
  USING (
    deal_id IN (
      SELECT d.id FROM deals d
      JOIN vendors v1 ON v1.user_id = auth.uid() AND v1.role = 'director'
      JOIN vendors v2 ON v2.organization_id = v1.organization_id AND v2.user_id = d.user_id
      WHERE true
    )
  );
