/*
  # Insert Sample Data for Development

  1. Sample Users
    - Admin user
    - Manager user  
    - Developer users

  2. Sample Projects
    - E-commerce project with stages and tasks
    - Mobile app project

  3. Sample Tasks with different statuses
    - Pending, in-progress, completed tasks
    - Tasks requiring approval

  Note: This is for development purposes only
*/

-- Insert sample users (these will be created when users sign up via auth)
-- The trigger will automatically create users for them

-- Insert sample projects
INSERT INTO projects (id, name, description, status, priority, created_by) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Sistema de E-commerce', 'Desenvolvimento de plataforma de vendas online completa', 'in-progress', 'high', null),
  ('550e8400-e29b-41d4-a716-446655440002', 'App Mobile Delivery', 'Aplicativo mobile para delivery de comida', 'planning', 'medium', null);

-- Insert sample stages for e-commerce project
INSERT INTO stages (id, project_id, name, description, order_index, requires_approval) VALUES
  ('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'Planejamento', 'Definição de requisitos e arquitetura', 1, true),
  ('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'Desenvolvimento', 'Implementação das funcionalidades', 2, false),
  ('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', 'Testes', 'Testes e validação do sistema', 3, true);

-- Insert sample stages for mobile app project
INSERT INTO stages (id, project_id, name, description, order_index, requires_approval) VALUES
  ('660e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440002', 'Design', 'Criação do design e protótipos', 1, true),
  ('660e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440002', 'Desenvolvimento', 'Desenvolvimento do aplicativo', 2, false);

-- Note: Sample tasks will be created after users sign up and users are created
-- You can manually insert tasks later or create them through the application interface