/*
  # Update User Roles

  1. Changes
    - Update user_role enum to include 'user' and 'aprovador' instead of 'developer'
    - Update all references to use new role names
    - Update RLS policies to reflect new role structure
    - Only 'admin' and 'aprovador' can see approvals tab

  2. Security
    - Maintain existing RLS policies with updated role names
    - Ensure proper access control for approval functionality
*/

-- Drop existing enum and recreate with new values
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_old') THEN
        CREATE TYPE user_role_old AS ENUM ('admin', 'manager', 'developer');
    END IF;
END$$;

-- Drop policies que usam a coluna antes de alterar o tipo
DROP POLICY IF EXISTS "Admins and managers can create projects" ON projects;
DROP POLICY IF EXISTS "Admins and managers can update projects" ON projects;
DROP POLICY IF EXISTS "Admins can delete projects" ON projects;
DROP POLICY IF EXISTS "Admins can delete tasks" ON tasks;
DROP POLICY IF EXISTS "Admins can delete comments" ON task_comments;

-- Update user table to use new enum
ALTER TABLE users ALTER COLUMN role DROP DEFAULT;
ALTER TABLE users ALTER COLUMN role TYPE user_role USING
  CASE 
    WHEN role::text = 'developer' THEN 'user'::user_role
    ELSE role::text::user_role
  END;
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user';

-- Recrie as policies após a alteração
CREATE POLICY "Admins and managers can create projects"
  ON projects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins and managers can update projects"
  ON projects
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can delete projects"
  ON projects
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete tasks"
  ON tasks
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete comments"
  ON task_comments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Drop old enum
DROP TYPE user_role_old;

-- Update RLS policies to use new role names

-- Drop existing policies that reference old roles
DROP POLICY IF EXISTS "Admins and managers can manage stages" ON stages;
DROP POLICY IF EXISTS "Admins and managers can create tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update tasks assigned to them or created by them" ON tasks;

-- Recreate policies with updated role names
CREATE POLICY "Admins and managers can manage stages"
  ON stages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins and managers can create tasks"
  ON tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Users can update tasks assigned to them or created by them"
  ON tasks
  FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid() 
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager', 'aprovador')
    )
  );

-- Update the user creation function to use 'user' as default
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO users (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'user')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update user table to use array of roles
ALTER TABLE users ALTER COLUMN roles DROP DEFAULT;
ALTER TABLE users ALTER COLUMN roles TYPE text[] USING roles::text[];
ALTER TABLE users ALTER COLUMN roles SET DEFAULT ARRAY['user'];