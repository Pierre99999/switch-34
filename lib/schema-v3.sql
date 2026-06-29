-- Migration v3: evidence levels for scoring
-- Run this in Supabase SQL editor

ALTER TABLE deal_rounds ADD COLUMN IF NOT EXISTS evidence_levels JSONB DEFAULT '{}';
