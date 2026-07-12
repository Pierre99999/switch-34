-- Migration v2: vendor dimensions + prospect dimensions
-- Run this in Supabase SQL editor

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS dimensions JSONB DEFAULT '{}';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS prospect_dimensions JSONB DEFAULT '{}';
