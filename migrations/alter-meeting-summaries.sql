-- First drop the foreign key constraint
ALTER TABLE meeting_summaries DROP CONSTRAINT IF EXISTS meeting_summaries_meeting_id_fkey;

-- Add the new foreign key constraint referencing meetings.id
ALTER TABLE meeting_summaries ADD CONSTRAINT meeting_summaries_meeting_id_fkey 
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE ON UPDATE CASCADE;
