-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own projects" ON solar_projects;
DROP POLICY IF EXISTS "Users can create projects" ON solar_projects;
DROP POLICY IF EXISTS "Enable insert for new users" ON solar_projects;

-- Remove user_id constraint
ALTER TABLE solar_projects ALTER COLUMN user_id DROP NOT NULL;

-- Create new policies
CREATE POLICY "Enable insert for everyone"
  ON solar_projects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Enable read for everyone"
  ON solar_projects
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS ensure_project_user_id ON solar_projects;
DROP FUNCTION IF EXISTS check_project_user_id();