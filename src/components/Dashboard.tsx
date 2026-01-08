import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, 
  Clock, 
  AlertTriangle, 
  TrendingUp,
  Users,
  FolderOpen,
  Plus
} from 'lucide-react';
import { useProjectsContext } from '../contexts/ProjectsContext';
import { useAuth } from '../contexts/AuthContext';
import TaskCard from './TaskCard';
import CreateTaskModal from './CreateTaskModal';
import { User, Project } from '../types';
import ProjectDetailsModal from './ProjectDetailsModal';
import { formatDateToLocal } from '../lib/formatDate';
import { Gantt, Task, ViewMode } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Tooltip from './Tooltip';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { projects, getUserTasks, getTasksForApproval, updateTaskStatus, approveTask, rejectTask, createTask, getAllUsers, fetchProjects, isLoading } = useProjectsContext();
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedGanttProject, setSelectedGanttProject] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Month);
  const [tooltipProjectId, setTooltipProjectId] = useState<string | null>(null);
  const [collapsedProjects, setCollapsedProjects] = useState<string[]>(() => projects.map(p => String(p.id)));
  
  let userTasks = getUserTasks();
  if (user?.roles?.includes('admin') || user?.roles?.includes('manager')) {
    // Monta todas as tarefas do sistema
    userTasks = projects.flatMap(project =>
      project.stages.flatMap(stage =>
        stage.tasks.map(task => ({
          ...task,
          projectName: project.name,
          stageName: stage.name,
          parentTaskTitle: task.parentTaskId ? stage.tasks.find((t: any) => t.id === task.parentTaskId)?.title || '' : undefined,
          parentTaskId: task.parentTaskId || undefined
        }))
      )
    );
  }
  const pendingApprovals = getTasksForApproval();

  const stats = {
    totalTasks: userTasks.length,
    completedTasks: userTasks.filter(task => task.status === 'completed').length,
    inProgressTasks: userTasks.filter(task => task.status === 'in-progress').length,
    pendingTasks: userTasks.filter(task => task.status === 'pending').length,
    waitingApproval: userTasks.filter(task => task.status === 'waiting-approval').length
  };

  const recentTasks = userTasks
    .sort((a: any, b: any) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
    .slice(0, 3);

  useEffect(() => {
    getAllUsers().then(setUsers);
  }, []);

  const handleCreateTask = async (projectId: string, stageId: string, taskData: any) => {
    await createTask(projectId, stageId, taskData);
    await fetchProjects();
  };

  const getDeadlineStatus = (project: any) => {
    const now = new Date();
    let hasOverdue = false;
    let hasDueSoon = false;
    for (const stage of project.stages || []) {
      for (const task of stage.tasks || []) {
        if (!task.dueDate) continue;
        const due = new Date(task.dueDate);
        if (due < now && task.status !== 'completed') {
          hasOverdue = true;
        } else if ((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24) <= 2 && due >= now && task.status !== 'completed') {
          hasDueSoon = true;
        }
      }
    }
    if (hasOverdue) return { label: 'Tarefa atrasada', color: 'bg-red-100 text-red-800' };
    if (hasDueSoon) return { label: 'Tarefa vencendo', color: 'bg-orange-100 text-orange-800' };
    return { label: 'Dentro do prazo', color: 'bg-green-100 text-green-800' };
  };

  // Função para converter projetos e tarefas para o formato do Gantt
  const getGanttTasks = () => {
    let filteredProjects = projects;
    if (selectedGanttProject !== 'all') {
      filteredProjects = projects.filter(p => String(p.id) === selectedGanttProject);
    }
    const tasks: any[] = [];
    // Mapa de títulos de tarefas para lookup rápido
    const taskTitles = new Map<string, string>();
    filteredProjects.forEach(project => {
      project.stages.forEach(stage => {
        stage.tasks.forEach(task => {
          taskTitles.set(task.id, task.title);
        });
      });
    });
    filteredProjects.forEach(project => {
      // Projeto como grupo
      const dueDates = project.stages.flatMap(s =>
        s.tasks
          .filter((t: any) => t.dueDate && !isNaN(new Date(t.dueDate ? t.dueDate : '').getTime()))
          .map((t: any) => new Date(t.dueDate ? t.dueDate : '').getTime())
      );
      const end = dueDates.length > 0 ? new Date(Math.max(...dueDates)) : (project.createdAt ? new Date(project.createdAt) : new Date());
      tasks.push({
        id: project.id,
        name: project.name,
        start: project.createdAt ? new Date(project.createdAt) : new Date(),
        end,
        startLabel: format(project.createdAt ? new Date(project.createdAt) : new Date(), 'dd-MM-yy'),
        endLabel: format(end, 'dd-MM-yy'),
        type: 'project',
        progress: 0,
        isDisabled: true,
        hideChildren: collapsedProjects.includes(project.id),
        styles: { progressColor: '#2563eb', progressSelectedColor: '#1d4ed8' }
      });
      // Tarefas
      project.stages.forEach(stage => {
        stage.tasks.forEach(task => {
          if (!task.startDate || !task.dueDate) return;
          const start = new Date(task.startDate);
          const end = new Date(task.dueDate);
          if (isNaN(start.getTime()) || isNaN(end.getTime())) return;
          tasks.push({
            id: task.id,
            name: task.title,
            start: task.startDate ? new Date(task.startDate) : new Date(),
            end: task.dueDate ? new Date(task.dueDate) : new Date(),
            startLabel: format(task.startDate ? new Date(task.startDate) : new Date(), 'dd-MM-yy'),
            endLabel: format(task.dueDate ? new Date(task.dueDate) : new Date(), 'dd-MM-yy'),
            type: 'task',
            project: project.id,
            progress: task.status === 'completed' ? 100 : 0,
            parentTaskTitle: task.parentTaskId ? taskTitles.get(task.parentTaskId) || '' : undefined,
            parentTaskId: task.parentTaskId || undefined,
            styles: {
              progressColor: task.status === 'completed' ? '#22c55e' : (task.status === 'in-progress' ? '#2563eb' : '#facc15'),
              progressSelectedColor: task.status === 'completed' ? '#16a34a' : (task.status === 'in-progress' ? '#1d4ed8' : '#ca8a04')
            }
          });
        });
      });
    });
    return tasks;
  };

  // Função para atribuir valor numérico à prioridade
  const priorityValue = (priority: string) => {
    switch (priority) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 0;
    }
  };

  // Função para pegar a menor dueDate válida do projeto
  const getClosestDueDate = (project: any) => {
    const dueDates = project.stages.flatMap((s: any) =>
      s.tasks
        .filter((t: any) => t.dueDate && !isNaN(new Date(t.dueDate ? t.dueDate : '').getTime()))
        .map((t: any) => new Date(t.dueDate ? t.dueDate : '').getTime())
    );
    return dueDates.length > 0 ? Math.min(...dueDates) : Infinity;
  };

  // Projetos ativos ordenados por prioridade e dueDate
  const isAdminOrManager = user?.roles?.includes('admin') || user?.roles?.includes('manager');
  const userId = user?.id;
  const topActiveProjects = projects
    .filter(p => p.status === 'in-progress')
    .filter(p => isAdminOrManager || p.stages.some(stage => stage.tasks.some(task => task.assignedTo === userId)))
    .sort((a, b) => {
      const pa = priorityValue(a.priority);
      const pb = priorityValue(b.priority);
      if (pb !== pa) return pb - pa;
      return getClosestDueDate(a) - getClosestDueDate(b);
    })
    .slice(0, 5);

  // Sempre que mudar a lista de projetos ou o filtro, garantir que todos iniciem fechados
  useEffect(() => {
    setCollapsedProjects(projects.map(p => String(p.id)));
  }, [projects, selectedGanttProject]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <span className="text-lg text-gray-500 animate-pulse">Carregando dados...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full min-w-0 overflow-x-hidden">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-4 sm:p-6 md:p-8 text-white max-w-full min-w-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              Olá, {user?.name.split(' ')[0]}!
            </h1>
            <p className="text-blue-100 text-lg">
              Bem-vindo ao seu painel de controle. Aqui você pode acompanhar suas tarefas e projetos.
            </p>
          </div>
          {(user?.roles?.includes('admin') || user?.roles?.includes('manager')) && (
            <button
              onClick={() => setShowCreateTask(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 transition-all duration-200 font-medium"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Tarefa</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 md:gap-6 w-full max-w-full min-w-0">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 lg:col-span-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total de Tarefas</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalTasks}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <CheckSquare className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Em Andamento</p>
              <p className="text-3xl font-bold text-blue-600">{stats.inProgressTasks}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Concluídas</p>
              <p className="text-3xl font-bold text-green-600">{stats.completedTasks}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <CheckSquare className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pendente</p>
              <p className="text-3xl font-bold text-yellow-600">{stats.pendingTasks}</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-full">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-2 sm:gap-4 md:gap-6 w-full max-w-full min-w-0">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 lg:col-span-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribuição de Tarefas</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Pendentes</span>
              <span className="font-semibold text-gray-900">{stats.pendingTasks}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Em Andamento</span>
              <span className="font-semibold text-blue-600">{stats.inProgressTasks}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Aguardando Aprovação</span>
              <span className="font-semibold text-yellow-600">{stats.waitingApproval}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Concluídas</span>
              <span className="font-semibold text-green-600">{stats.completedTasks}</span>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 lg:col-span-3">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Projetos Ativos</h3>
          <div className="space-y-3">
            {topActiveProjects.map(project => (
              <div key={project.id} className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-0 max-w-full min-w-0">
                <div className="flex items-center flex-wrap gap-1 sm:gap-2 min-w-0 w-full max-w-full">
                  <FolderOpen className="w-5 h-5 text-blue-600" />
                  <span className="relative max-w-[90px] sm:max-w-xs md:max-w-sm lg:max-w-md truncate break-words" onMouseEnter={() => setTooltipProjectId(project.id + '-nome')} onMouseLeave={() => setTooltipProjectId(null)}>
                    <button
                      className="text-gray-900 font-medium hover:underline focus:outline-none text-sm text-left truncate break-words max-w-full"
                      onClick={() => setSelectedProject(project)}
                      type="button"
                    >
                      {project.name}
                    </button>
                    <Tooltip show={tooltipProjectId === project.id + '-nome'}>{project.name}</Tooltip>
                  </span>
                  <span className={`ml-2 px-2 py-0.5 rounded text-xs font-semibold ${project.priority === 'low' ? 'bg-green-100 text-green-800' : project.priority === 'medium' ? 'bg-blue-100 text-blue-800' : project.priority === 'high' ? 'bg-orange-100 text-orange-800' : project.priority === 'critical' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}> {
                    project.priority === 'low' ? 'Baixa' :
                    project.priority === 'medium' ? 'Média' :
                    project.priority === 'high' ? 'Alta' :
                    project.priority === 'critical' ? 'Crítica' : project.priority
                  }</span>
                  <span className={`ml-2 px-2 py-0.5 rounded text-xs font-semibold ${project.status === 'planning' ? 'bg-blue-100 text-blue-800' : project.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' : project.status === 'completed' ? 'bg-green-100 text-green-800' : project.status === 'on-hold' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}> {
                    project.status === 'planning' ? 'Planejamento' :
                    project.status === 'in-progress' ? 'Em Andamento' :
                    project.status === 'completed' ? 'Concluído' :
                    project.status === 'on-hold' ? 'Pausado' : project.status
                  }</span>
                  {(() => { const s = getDeadlineStatus(project); return <span className={`ml-2 px-2 py-0.5 rounded text-xs font-semibold ${s.color}`}>{s.label}</span>; })()}
                </div>
                <span className="text-sm text-gray-500 whitespace-nowrap flex-shrink-0" style={{minWidth: '70px', textAlign: 'right'}}>
                  {project.stages.reduce((acc, stage) => acc + stage.tasks.length, 0)} tarefas
                </span>
              </div>
            ))}
            {topActiveProjects.length === 0 && (
              <p className="text-gray-500 text-sm">Nenhum projeto ativo no momento</p>
            )}
          </div>
          {/* Modal de detalhes do projeto */}
          <ProjectDetailsModal
            isOpen={!!selectedProject}
            project={selectedProject}
            onClose={() => setSelectedProject(null)}
            users={users}
          />
        </div>
      </div>

      {/* Filtro de projeto para o Gantt */}
      <div className="flex flex-col sm:flex-row w-full gap-2 sm:gap-4 md:gap-6 items-stretch sm:items-end mb-4 w-full max-w-full min-w-0">
        <div className="flex-1 min-w-0 max-w-full">
          <label className="block text-sm font-medium text-gray-700 mb-1">Visualizar:</label>
          <select
            value={String(selectedGanttProject)}
            onChange={e => setSelectedGanttProject(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
          >
            <option value="all">Todos os projetos</option>
            {projects.map(p => (
              <option key={p.id} value={String(p.id)}>{p.name}</option>
            ))}
          </select>
          </div>
        <div className="min-w-0 max-w-full">
          <label className="block text-sm font-medium text-gray-700 mb-1">Modo de visualização:</label>
          <select
            value={viewMode}
            onChange={e => setViewMode(e.target.value as ViewMode)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value={ViewMode.Day}>Dia</option>
            <option value={ViewMode.Week}>Semana</option>
            <option value={ViewMode.Month}>Mês</option>
            <option value={ViewMode.Year}>Ano</option>
          </select>
        </div>
      </div>
      {/* Gantt Chart abaixo dos filtros */}
      <div className="bg-white rounded-xl p-2 sm:p-4 md:p-6 shadow-sm border border-gray-200 mb-6">
        <div className="overflow-x-auto" style={{ maxWidth: '100vw', WebkitOverflowScrolling: 'touch' }}>
          <div className="min-w-[900px]">
          <Gantt
            tasks={getGanttTasks()}
            viewMode={viewMode}
              listCellWidth={window.innerWidth < 640 ? "90px" : window.innerWidth < 1024 ? "120px" : "155px"}
            locale="pt-BR"
            barFill={60}
            fontSize={14}
            rowHeight={38}
            columnWidth={
                viewMode === ViewMode.Day ? (window.innerWidth < 640 ? 40 : 80) :
                viewMode === ViewMode.Week ? (window.innerWidth < 640 ? 30 : 60) :
                viewMode === ViewMode.Month ? (window.innerWidth < 640 ? 40 : 80) :
                viewMode === ViewMode.Year ? (window.innerWidth < 640 ? 60 : 100) : 60
            }
            listColumns={[
              {
                title: "Nome",
                field: "name",
                width: window.innerWidth < 640 ? '90' : window.innerWidth < 1024 ? '120' : '180',
                render: (task: any) => (
                  <span style={{ fontWeight: task.type === 'project' ? 'bold' : 'normal', wordBreak: 'break-word', maxWidth: '100%' }}>
                    {task.name}
                  </span>
                )
              },
              {
                title: "From",
                field: "start",
                width: window.innerWidth < 640 ? '80' : '155',
                render: (task: any) => format(task.start, 'dd/MM/yyyy', { locale: ptBR })
              },
              {
                title: "To",
                field: "end",
                width: window.innerWidth < 640 ? '80' : '155',
                render: (task: any) => format(task.end, 'dd/MM/yyyy', { locale: ptBR })
              }
            ]}
            todayColor="#2563eb22"
              onExpanderClick={task => {
                if (task.type === 'project') {
                  setCollapsedProjects(prev =>
                    prev.includes(task.id)
                      ? prev.filter(id => id !== task.id)
                      : [...prev, task.id]
                  );
                }
              }}
          />
          </div>
          </div>
      </div>

      {/* Pending Approvals (for managers and admins) */}
      {pendingApprovals.length > 0 && (user?.roles?.includes('admin') || user?.roles?.includes('manager')) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2 sm:p-4 md:p-6 max-w-full min-w-0 overflow-x-auto">
          <div className="flex items-center space-x-3 mb-6">
            <AlertTriangle className="w-6 h-6 text-yellow-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Aprovações Pendentes ({pendingApprovals.length})
            </h2>
          </div>
          
          <div className="space-y-4">
            {pendingApprovals.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                showProject={true}
                onApprove={approveTask}
                onReject={rejectTask}
              />
            ))}
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={showCreateTask}
        onClose={() => setShowCreateTask(false)}
        onCreateTask={handleCreateTask}
        projects={projects}
        users={users}
      />
    </div>
  );
};

export default Dashboard;