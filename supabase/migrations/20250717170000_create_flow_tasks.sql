-- Tabela de tarefas diárias (Flow)
create table if not exists public.flow_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  title text not null,
  description text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Índice para busca rápida por usuário
create index if not exists idx_flow_tasks_user_id on public.flow_tasks(user_id); 