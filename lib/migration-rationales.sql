-- Add rationales column if missing
ALTER TABLE deal_rounds ADD COLUMN IF NOT EXISTS rationales jsonb DEFAULT '{}';
