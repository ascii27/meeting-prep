-- First drop the foreign key constraint
ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_user_id_fkey;

-- Change the data type of user_id column
ALTER TABLE meetings ALTER COLUMN user_id TYPE VARCHAR;

-- Add the new foreign key constraint referencing google_id
ALTER TABLE meetings ADD CONSTRAINT meetings_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(google_id) ON DELETE CASCADE ON UPDATE CASCADE;
