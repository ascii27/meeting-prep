-- Add topics and suggestions columns to meeting_summaries table
ALTER TABLE meeting_summaries 
ADD COLUMN IF NOT EXISTS topics JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS suggestions JSONB DEFAULT '[]'::jsonb;

-- Comment on columns
COMMENT ON COLUMN meeting_summaries.topics IS 'Key topics identified in the meeting documents';
COMMENT ON COLUMN meeting_summaries.suggestions IS 'Preparation suggestions for the meeting';
