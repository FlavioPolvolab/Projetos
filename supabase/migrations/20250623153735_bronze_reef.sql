/*
  # Create Initial Schema for Project Management System

  1. New Tables
    - `users`
      - `id` (uuid, primary key, references auth.users)
      - `name` (text)
      - `email` (text)
      - `roles` (text[], enum: admin, manager, developer)
      - `avatar_url` (text, optional)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `projects`
      - `id` (uuid, primary key)
      - `name` (text)
      - `description` (text)
      - `status` (text, enum: planning, in-progress, completed, on-hold)
      - `priority` (text, enum: low, medium, high, critical)
      - `created_by` (uuid, references users)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `stages`
      - `id` (uuid, primary key)
      - `project_id` (uuid, references projects)
      - `name` (text)
      - `description` (text)
      - `order_index` (integer)
      - `requires_approval` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `tasks`
      - `id` (uuid, primary key)
      - `stage_id` (uuid, references stages)
      - `title` (text)
      - `description` (text)
      - `status` (text, enum: pending, in-progress, waiting-approval, approved, completed, rejected)
      - `priority` (text, enum: low, medium, high, critical)
      - `assigned_to` (uuid, references users)
      - `created_by` (uuid, references users)
      - `due_date` (timestamp, optional)
      - `completed_at` (timestamp, optional)
      - `approved_by` (uuid, references users, optional)
      - `approved_at` (timestamp, optional)
      - `requires_approval` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `task_comments`
      - `id` (uuid, primary key)
      - `task_id` (uuid, references tasks)
      - `content` (text)
      - `author_id` (uuid, references users)
      - `created_at` (timestamp)
    
    - `task_status_history`
      - `id` (uuid, primary key)
      - `task_id` (uuid, references tasks)
      - `status` (text)
      - `user_id` (uuid, references users)
      - `user_name` (text)
      - `created_at` (timestamp)
    
    - `notifications`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users)
      - `type` (text)
      - `title` (text)
      - `message` (text)
      - `task_id` (uuid, references tasks, optional)
      - `project_name` (text, optional)
      - `priority` (text, enum: low, medium, high, critical)
      - `read` (boolean)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users based on roles
    - Users can read their own user and tasks
    - Managers and admins can manage projects and approve tasks
    - All users can read projects they're involved in
*/

-- Create custom types
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'developer');
CREATE TYPE project_status AS ENUM ('planning', 'in-progress', 'completed', 'on-hold');
CREATE TYPE task_status AS ENUM ('pending', 'in-progress', 'waiting-approval', 'approved', 'completed', 'rejected');
CREATE TYPE priority_level AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE notification_type AS ENUM ('deadline_warning', 'deadline_overdue', 'task_assigned', 'task_approved', 'task_rejected', 'task_transferred');

-- Create user table
CREATE TABLE IF NOT EXISTS "users" (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  roles text[] NOT NULL DEFAULT ARRAY['user'],
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  status project_status NOT NULL DEFAULT 'planning',
  priority priority_level NOT NULL DEFAULT 'medium',
  created_by uuid REFERENCES "users"(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create stages table
CREATE TABLE IF NOT EXISTS stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  order_index integer NOT NULL,
  requires_approval boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid REFERENCES stages(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  status task_status NOT NULL DEFAULT 'pending',
  priority priority_level NOT NULL DEFAULT 'medium',
  assigned_to uuid REFERENCES "users"(id) ON DELETE SET NULL,
  created_by uuid REFERENCES "users"(id) ON DELETE SET NULL,
  due_date timestamptz,
  completed_at timestamptz,
  approved_by uuid REFERENCES "users"(id) ON DELETE SET NULL,
  approved_at timestamptz,
  requires_approval boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create task_comments table
CREATE TABLE IF NOT EXISTS task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  content text NOT NULL,
  author_id uuid REFERENCES "users"(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Create task_status_history table
CREATE TABLE IF NOT EXISTS task_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  status task_status NOT NULL,
  user_id uuid REFERENCES "users"(id) ON DELETE SET NULL,
  user_name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES "users"(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  project_name text,
  priority priority_level NOT NULL DEFAULT 'medium',
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_stages_project_id ON stages(project_id);
CREATE INDEX IF NOT EXISTS idx_stages_order ON stages(project_id, order_index);
CREATE INDEX IF NOT EXISTS idx_tasks_stage_id ON tasks(stage_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_status_history_task_id ON task_status_history(task_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);

-- Enable Row Level Security
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies

-- Users policies
CREATE POLICY "Users can read all users"
  ON "users"
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own user"
  ON "users"
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own user"
  ON "users"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Projects policies
CREATE POLICY "Users can read all projects"
  ON projects
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and managers can create projects"
  ON projects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "users" 
      WHERE id = auth.uid() 
      AND 'admin' = ANY(roles) OR 'manager' = ANY(roles)
    )
  );

CREATE POLICY "Admins and managers can update projects"
  ON projects
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "users" 
      WHERE id = auth.uid() 
      AND ('admin' = ANY(roles) OR 'manager' = ANY(roles))
    )
  );

CREATE POLICY "Admins can delete projects"
  ON projects
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "users" 
      WHERE id = auth.uid() 
      AND 'admin' = ANY(roles)
    )
  );

-- Stages policies
CREATE POLICY "Users can read all stages"
  ON stages
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and managers can manage stages"
  ON stages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "users" 
      WHERE id = auth.uid() 
      AND ('admin' = ANY(roles) OR 'manager' = ANY(roles))
    )
  );

-- Tasks policies
CREATE POLICY "Users can read all tasks"
  ON tasks
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and managers can create tasks"
  ON tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "users" 
      WHERE id = auth.uid() 
      AND ('admin' = ANY(roles) OR 'manager' = ANY(roles))
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
      SELECT 1 FROM "users" 
      WHERE id = auth.uid() 
      AND ('admin' = ANY(roles) OR 'manager' = ANY(roles))
    )
  );

CREATE POLICY "Admins can delete tasks"
  ON tasks
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "users" 
      WHERE id = auth.uid() 
      AND 'admin' = ANY(roles)
    )
  );

-- Task comments policies
CREATE POLICY "Users can read all task comments"
  ON task_comments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create comments"
  ON task_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "Users can update own comments"
  ON task_comments
  FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid());

CREATE POLICY "Admins can delete comments"
  ON task_comments
  FOR DELETE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM "users" 
      WHERE id = auth.uid() 
      AND 'admin' = ANY(roles)
    )
  );

-- Task status history policies
CREATE POLICY "Users can read all task status history"
  ON task_status_history
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create status history"
  ON task_status_history
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Notifications policies
CREATE POLICY "Users can read own notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications"
  ON notifications
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create functions for automatic timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stages_updated_at BEFORE UPDATE ON stages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO "users" (id, name, email, roles)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'roles')::text[], ARRAY['user'])
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user registration
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();