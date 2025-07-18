-- First drop the foreign key constraint
ALTER TABLE preparation_notes DROP CONSTRAINT IF EXISTS preparation_notes_user_id_fkey;

-- Change the data type of user_id column
ALTER TABLE preparation_notes ALTER COLUMN user_id TYPE VARCHAR;

-- Add the new foreign key constraint referencing google_id
ALTER TABLE preparation_notes ADD CONSTRAINT preparation_notes_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(google_id) ON DELETE CASCADE ON UPDATE CASCADE;
