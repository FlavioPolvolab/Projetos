-- Migration: Allow admin and manager to create tasks in any project and complete any task
-- This migration updates RLS policies to allow admins and managers to:
-- 1. Create tasks in any project (not just projects they created)
-- 2. Complete any task (not just tasks assigned to them)

-- Drop existing task creation policy
DROP POLICY IF EXISTS "Admins and managers can create tasks" ON tasks;

-- Create new policy: Admins and managers can create tasks in any project
-- Regular users can only create tasks if they are the project creator or assigned to the project
CREATE POLICY "Admins and managers can create tasks in any project"
  ON tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admins and managers can create tasks in any project
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND ('admin' = ANY(roles) OR 'manager' = ANY(roles))
    )
    OR
    -- Regular users can create tasks if they created the project or are assigned to tasks in the project
    EXISTS (
      SELECT 1 FROM stages s
      JOIN projects p ON p.id = s.project_id
      WHERE s.id = tasks.stage_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM task_assignees ta
          JOIN tasks t ON t.id = ta.task_id
          JOIN stages st ON st.id = t.stage_id
          WHERE ta.user_id = auth.uid()
          AND st.project_id = p.id
        )
      )
    )
  );

-- Update task update policy to allow admins and managers to complete any task
DROP POLICY IF EXISTS "Users can update tasks assigned to them or created by them" ON tasks;

CREATE POLICY "Users can update tasks assigned to them or created by them, admins and managers can update any task"
  ON tasks
  FOR UPDATE
  TO authenticated
  USING (
    -- Users can update tasks assigned to them or created by them
    assigned_to = auth.uid() 
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM task_assignees 
      WHERE task_id = tasks.id 
      AND user_id = auth.uid()
    )
    OR
    -- Admins and managers can update any task
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND ('admin' = ANY(roles) OR 'manager' = ANY(roles))
    )
    OR
    -- Aprovadores podem atualizar tarefas para aprovação
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND 'aprovador' = ANY(roles)
    )
  );
