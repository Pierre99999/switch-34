-- ============================================================
-- ROLE-BASED ACCESS: Add role to vendors + update RLS
-- Run this in the Supabase SQL editor
-- ============================================================

-- 1. Add role column to vendors
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS role text DEFAULT 'director' CHECK (role IN ('sales', 'director'));

-- 2. Add full_name to vendors (for pipeline display)
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS full_name text;

-- 3. Update deals RLS: directors can see ALL deals
DROP POLICY IF EXISTS "users manage own deals" ON deals;

CREATE POLICY "users manage own deals" ON deals
  FOR ALL USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM vendors WHERE vendors.user_id = auth.uid() AND vendors.role = 'director'
    )
  );

-- 4. Update deal_rounds RLS
DROP POLICY IF EXISTS "users manage own deal_rounds" ON deal_rounds;

CREATE POLICY "users manage own deal_rounds" ON deal_rounds
  FOR ALL USING (
    EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_rounds.deal_id AND deals.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM vendors WHERE vendors.user_id = auth.uid() AND vendors.role = 'director')
  );

-- 5. Update deal_boxes RLS
DROP POLICY IF EXISTS "users manage own deal_boxes" ON deal_boxes;

CREATE POLICY "users manage own deal_boxes" ON deal_boxes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_boxes.deal_id AND deals.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM vendors WHERE vendors.user_id = auth.uid() AND vendors.role = 'director')
  );

-- 6. Update deal_stakeholders RLS
DROP POLICY IF EXISTS "users manage own deal_stakeholders" ON deal_stakeholders;

CREATE POLICY "users manage own deal_stakeholders" ON deal_stakeholders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_stakeholders.deal_id AND deals.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM vendors WHERE vendors.user_id = auth.uid() AND vendors.role = 'director')
  );

-- 7. Update deal_themes RLS
DROP POLICY IF EXISTS "users manage own deal_themes" ON deal_themes;

CREATE POLICY "users manage own deal_themes" ON deal_themes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_themes.deal_id AND deals.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM vendors WHERE vendors.user_id = auth.uid() AND vendors.role = 'director')
  );

-- 8. Update deal_mirror RLS
DROP POLICY IF EXISTS "users manage own deal_mirror" ON deal_mirror;

CREATE POLICY "users manage own deal_mirror" ON deal_mirror
  FOR ALL USING (
    EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_mirror.deal_id AND deals.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM vendors WHERE vendors.user_id = auth.uid() AND vendors.role = 'director')
  );

-- 9. Update vendors RLS: directors can read all vendor profiles
DROP POLICY IF EXISTS "users manage own vendor" ON vendors;

CREATE POLICY "users manage own vendor" ON vendors
  FOR ALL USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM vendors v WHERE v.user_id = auth.uid() AND v.role = 'director'
    )
  );
