/*
  # Fix RLS policies for solar_projects table

  1. Changes
    - Update RLS policies to be more permissive for new users
    - Allow insertion without requiring prior authentication
    - Keep read protection intact
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own projects" ON solar_projects;
DROP POLICY IF EXISTS "Users can create projects" ON solar_projects;

-- Create new policies
CREATE POLICY "Users can read own projects"
  ON solar_projects
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Enable insert for new users"
  ON solar_projects
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add trigger to ensure user_id matches auth.uid()
CREATE OR REPLACE FUNCTION check_project_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id != auth.uid() THEN
    RAISE EXCEPTION 'user_id must match the authenticated user';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_project_user_id
  BEFORE INSERT ON solar_projects
  FOR EACH ROW
  EXECUTE FUNCTION check_project_user_id();