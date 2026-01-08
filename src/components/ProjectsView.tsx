import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FolderOpen, Users, Calendar, BarChart3, Plus, Edit, List, LayoutGrid } from 'lucide-react';
import { useProjectsContext } from '../contexts/ProjectsContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import CreateProjectModal from './CreateProjectModal';
import CreateTaskModal from './CreateTaskModal';
import { Project } from '../types';
import ReactDOM from 'react-dom';
import ProjectDetailsModal from './ProjectDetailsModal';
import TaskDetailsModal from './TaskDetailsModal';
import { useAuth } from '../contexts/AuthContext';

const ProjectsView: React.FC = () => {
  const { projects, createProject, updateProject, createTask, getAllUsers, getUserProjects, fetchProjects, isLoading } = useProjectsContext();
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'low' | 'medium' | 'high' | 'critical'>('all');
  const [openStageId, setOpenStageId] = useState<string | null>(null);
  const popoverTimeout = useRef<NodeJS.Timeout | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [tooltipProjectId, setTooltipProjectId] = useState<string | null>(null);
  const [tooltipTarefasPosition, setTooltipTarefasPosition] = useState<'top' | 'bottom'>('bottom');
  const [tooltipTarefasRect, setTooltipTarefasRect] = useState<DOMRect | null>(null);
  const tooltipTarefasTimeout = useRef<NodeJS.Timeout | null>(null);
  const [showProjectDetails, setShowProjectDetails] = useState(false);
  const [viewProject, setViewProject] = useState<Project | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const { user } = useAuth();
  const [tab, setTab] = useState<'ativos' | 'concluidos'>('ativos');

  useEffect(() => {
    getAllUsers().then(setUsers);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planning': return 'bg-blue-100 text-blue-800';
      case 'in-progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'on-hold': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'planning': return 'Planejamento';
      case 'in-progress': return 'Em Andamento';
      case 'completed': return 'Concluído';
      case 'on-hold': return 'Pausado';
      default: return status;
    }
  };

  // Função para cor do badge de prioridade
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-blue-100 text-blue-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Função para pegar a maior dueDate das tarefas do projeto
  const getProjectEndDate = (project: Project) => {
    const allDueDates = project.stages.flatMap(stage =>
      stage.tasks.map(task => task.dueDate ? new Date(task.dueDate) : null).filter(Boolean)
    ) as Date[];
    if (allDueDates.length === 0) return null;
    return new Date(Math.max(...allDueDates.map(d => d.getTime())));
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setShowCreateProject(true);
  };

  const handleSaveProject = async (projectData: any) => {
    if (editingProject) {
      await updateProject(editingProject.id, projectData);
      setEditingProject(null);
    } else {
      await createProject(projectData);
    }
    await fetchProjects();
  };

  const handleCreateTask = async (projectId: string, stageId: string, taskData: any) => {
    await createTask(projectId, stageId, taskData);
    await fetchProjects();
  };

  // Filtro de projetos
  const filteredProjects = getUserProjects().filter(project => {
    // Busca texto em todos os campos principais
    const search = searchTerm.toLowerCase();
    const matchesSearch =
      project.name.toLowerCase().includes(search) ||
      project.description.toLowerCase().includes(search) ||
      project.status.toLowerCase().includes(search) ||
      (project.priority && project.priority.toLowerCase().includes(search)) ||
      project.stages.some(stage =>
        stage.name.toLowerCase().includes(search) ||
        stage.description.toLowerCase().includes(search)
      );
    const matchesPriority = priorityFilter === 'all' || project.priority === priorityFilter;
    // Filtro por aba
    if (tab === 'concluidos') {
      return matchesSearch && matchesPriority && project.status === 'completed';
    } else {
      return matchesSearch && matchesPriority && project.status !== 'completed';
    }
  });

  // Função utilitária para garantir data correta no input type='date'
  function toDateInputValue(date: any) {
    if (!date) return '';
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  // Função para pegar nomes dos envolvidos nas tarefas de um projeto
  function getProjectAssignees(project: Project): string[] {
    const assignees = new Set<string>();
    project.stages.forEach(stage => {
      stage.tasks.forEach(task => {
        if (task.assignedTo && users.find(u => u.id === task.assignedTo)) {
          const user = users.find(u => u.id === task.assignedTo);
          if (user) assignees.add(user.name);
        }
      });
    });
    return Array.from(assignees);
  }

  // Tooltip com position: fixed e delay para fechar
  function FixedTooltip({ show, anchorRect, children, position = 'bottom', onMouseEnter, onMouseLeave }: {
    show: boolean;
    anchorRect: DOMRect | null;
    children: React.ReactNode;
    position?: 'top' | 'bottom';
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
  }) {
    if (!show || !anchorRect) return null;
    const style: React.CSSProperties = {
      position: 'fixed',
      left: anchorRect.left + anchorRect.width / 2,
      transform: 'translateX(-50%)',
      zIndex: 9999,
      minWidth: 120,
      width: 192,
      maxWidth: 240,
      background: 'white',
      color: 'black',
      borderRadius: 8,
      boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
      padding: 12,
      fontSize: 13,
      border: '1px solid #e5e7eb',
      pointerEvents: 'auto',
      top: position === 'bottom' ? anchorRect.bottom + 8 : undefined,
      bottom: position === 'top' ? window.innerHeight - anchorRect.top + 8 : undefined,
    };
    return ReactDOM.createPortal(
      <div style={style} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
        {children}
      </div>,
      document.body
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <span className="text-lg text-gray-500 animate-pulse">Carregando projetos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projetos</h1>
          <p className="text-gray-600">Gerencie todos os projetos e suas tarefas</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            className={`p-2 rounded-lg border ${viewMode === 'cards' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-300 text-gray-500'} transition`}
            onClick={() => setViewMode('cards')}
            title="Visualizar em cards"
          >
            <LayoutGrid className="w-5 h-5" />
          </button>
          <button
            className={`p-2 rounded-lg border ${viewMode === 'list' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-300 text-gray-500'} transition`}
            onClick={() => setViewMode('list')}
            title="Visualizar em lista"
          >
            <List className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowCreateTask(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Tarefa</span>
          </button>
          <button
            onClick={() => setShowCreateProject(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Projeto</span>
          </button>
        </div>
      </div>

      {/* Tabs de projetos */}
      {(user?.roles.includes('admin') || user?.roles.includes('manager')) && (
        <div className="flex gap-2 mb-4">
          <button
            className={`px-4 py-2 rounded-t-lg border-b-2 font-medium text-sm transition-all ${tab === 'ativos' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-gray-500 bg-gray-50'}`}
            onClick={() => setTab('ativos')}
          >Ativos</button>
          <button
            className={`px-4 py-2 rounded-t-lg border-b-2 font-medium text-sm transition-all ${tab === 'concluidos' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-gray-500 bg-gray-50'}`}
            onClick={() => setTab('concluidos')}
          >Concluídos</button>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
        <div className="flex w-full gap-4">
          <input
            type="text"
            placeholder="Buscar projetos..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-[300px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value as any)}
            className="w-[220px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Todas as Prioridades</option>
            <option value="low">Baixa</option>
            <option value="medium">Média</option>
            <option value="high">Alta</option>
            <option value="critical">Crítica</option>
          </select>
        </div>
      </div>

      {/* Projects View Toggle */}
      {viewMode === 'cards' ? (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredProjects.map(project => {
          const totalTasks = project.stages.reduce((acc, stage) => acc + stage.tasks.length, 0);
          const completedTasks = project.stages.reduce(
            (acc, stage) => 
              acc + stage.tasks.filter(task => task.status === 'completed').length, 
            0
          );
          const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
          const endDate = getProjectEndDate(project);
          const creator = users.find(u => u.id === project.createdBy);

          return (
            <div key={project.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200">
              {/* Project Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <FolderOpen className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
                    <p className="text-xs text-gray-500 mb-1">Criado por: {creator ? creator.name : 'Desconhecido'}</p>
                    <p className="text-sm text-gray-600">{project.description}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end space-y-2">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                  {getStatusLabel(project.status)}
                </span>
                  {/* Badge de prioridade */}
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityBadge(project.priority)}`}>{
                    project.priority === 'low' ? 'Baixa' :
                    project.priority === 'medium' ? 'Média' :
                    project.priority === 'high' ? 'Alta' :
                    project.priority === 'critical' ? 'Crítica' : project.priority
                  }</span>
                  <button
                    className="flex items-center text-blue-600 hover:underline text-xs mt-2"
                    onClick={() => handleEditProject(project)}
                    title="Ver Projeto"
                  >
                    <Edit className="w-4 h-4 mr-1" /> Ver
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Progresso</span>
                  <span className="text-sm text-gray-600">{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Project Stats */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-1 mb-1">
                    <BarChart3 className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-500">Etapas</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-900">{project.stages.length}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-1 mb-1">
                    <Users className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-500">Tarefas</span>
                  </div>
                    <p className="text-lg font-semibold text-gray-900">
                      <span
                        className="underline cursor-pointer"
                        onMouseEnter={() => setTooltipProjectId(project.id + '-tarefas')}
                        onMouseLeave={() => setTooltipProjectId(null)}
                      >
                        {totalTasks}
                      </span>
                      <FixedTooltip
                        show={tooltipProjectId === project.id + '-tarefas'}
                        anchorRect={tooltipTarefasRect}
                        position={tooltipTarefasPosition}
                        onMouseEnter={() => {
                          if (tooltipTarefasTimeout.current) clearTimeout(tooltipTarefasTimeout.current);
                        }}
                        onMouseLeave={() => {
                          tooltipTarefasTimeout.current = setTimeout(() => setTooltipProjectId(null), 200);
                        }}
                      >
                        <div>
                          {Array.from(new Set(project.stages.flatMap(stage => stage.tasks.map(task => task.assignedTo)).filter(Boolean)))
                            .map(userId => {
                              const user = users.find(u => u.id === userId);
                              return user ? (
                                <div key={user.id} className="text-xs py-0.5">{user.name}</div>
                              ) : null;
                            })}
                        </div>
                      </FixedTooltip>
                    </p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-1 mb-1">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-500">Criado</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">
                    {format(new Date(project.createdAt), 'dd/MM/yy', { locale: ptBR })}
                    {" "}
                    <span className="text-gray-400">|</span>{" "}
                    <span title="Data prevista de encerramento">
                      {endDate ? format(endDate, 'dd/MM/yy', { locale: ptBR }) : '—'}
                    </span>
                  </p>
                </div>
              </div>

              {/* Stages Overview */}
              <div className="border-t border-gray-100 pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Etapas do Projeto</h4>
                <div className="space-y-2">
                  {project.stages.map(stage => {
                    const stageTasks = stage.tasks.length;
                    const stageCompleted = stage.tasks.filter(task => task.status === 'completed').length;
                    const stageProgress = stageTasks > 0 ? (stageCompleted / stageTasks) * 100 : 0;
                      // Ordenar tarefas por data de vencimento
                      const sortedTasks = [...stage.tasks].sort((a, b) => {
                        if (!a.dueDate) return 1;
                        if (!b.dueDate) return -1;
                        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                      });

                    return (
                        <div key={stage.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg relative"
                          onMouseEnter={() => {
                            if (popoverTimeout.current) clearTimeout(popoverTimeout.current);
                            setOpenStageId(stage.id);
                          }}
                          onMouseLeave={() => {
                            popoverTimeout.current = setTimeout(() => setOpenStageId(null), 200);
                          }}
                          onClick={() => setOpenStageId(openStageId === stage.id ? null : stage.id)}
                          style={{ cursor: 'pointer' }}
                        >
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{stage.name}</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {Array.from(new Set(stage.tasks.map(task => task.assignedTo).filter(Boolean)))
                                .map(userId => {
                                  const user = users.find(u => u.id === userId);
                                  return user ? (
                                    <span
                                      key={user.id}
                                      className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full"
                                      title={user.name}
                                    >
                                      {user.name}
                                    </span>
                                  ) : null;
                                })}
                            </div>
                          <p className="text-xs text-gray-600">{stageTasks} tarefa{stageTasks !== 1 ? 's' : ''}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-16 bg-gray-200 rounded-full h-1.5">
                            <div 
                              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${stageProgress}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-8 text-right">
                            {Math.round(stageProgress)}%
                          </span>
                        </div>
                          {/* Popover de tarefas */}
                          {openStageId === stage.id && (
                            <div className="absolute left-0 top-full mt-2 z-20 bg-white border border-gray-200 rounded-xl shadow-lg p-4 min-w-[260px] max-w-[320px] max-h-72 overflow-y-auto" onMouseEnter={() => setOpenStageId(stage.id)} onMouseLeave={() => setOpenStageId(null)}>
                              <h5 className="text-sm font-semibold text-gray-800 mb-2">Tarefas da Etapa</h5>
                              {sortedTasks.length === 0 ? (
                                <p className="text-xs text-gray-500">Nenhuma tarefa nesta etapa.</p>
                              ) : (
                                <ul className="space-y-2">
                                  {sortedTasks.map(task => {
                                    const responsible = users.find(u => u.id === task.assignedTo);
                                    return (
                                      <li key={task.id} className="flex flex-col border-b last:border-b-0 pb-2 last:pb-0 cursor-pointer hover:bg-blue-50 rounded px-1" onClick={() => { setSelectedTask(task); setShowTaskModal(true); }}>
                                        <span className="font-medium text-gray-900 text-xs flex items-center gap-2">
                                          {task.title}
                                          {responsible && (
                                            <span className="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded-full ml-1">{responsible.name}</span>
                                          )}
                                        </span>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${task.status === 'pending' ? 'bg-gray-100 text-gray-800' : task.status === 'in-progress' ? 'bg-blue-100 text-blue-800' : task.status === 'waiting-approval' ? 'bg-yellow-100 text-yellow-800' : task.status === 'approved' ? 'bg-green-100 text-green-800' : task.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{
                                          task.status === 'pending' ? 'Pendente' :
                                          task.status === 'in-progress' ? 'Em Andamento' :
                                          task.status === 'waiting-approval' ? 'Aguardando Aprovação' :
                                          task.status === 'approved' ? 'Aprovado' :
                                          task.status === 'completed' ? 'Concluída' :
                                          'Rejeitada'
                                        }</span>
                                        <span className="text-xs text-gray-500">{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '-'}</span>
                                      </div>
                                    </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </div>
                          )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prioridade</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Etapas</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarefas</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Criado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Encerramento</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredProjects.map(project => {
                const totalTasks = project.stages.reduce((acc, stage) => acc + stage.tasks.length, 0);
                const endDate = getProjectEndDate(project);
                return (
                  <tr key={project.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-blue-700 font-medium cursor-pointer relative"
                        onClick={() => { setViewProject(project); setShowProjectDetails(true); }}
                        onMouseEnter={() => setTooltipProjectId(project.id + '-name')}
                        onMouseLeave={() => setTooltipProjectId(null)}>
                      {project.name}
                      <FixedTooltip
                        show={tooltipProjectId === project.id + '-name'}
                        anchorRect={null}
                      >
                        {project.name}
                      </FixedTooltip>
                    </td>
                    <td className="px-4 py-2 whitespace-normal break-words text-sm text-gray-700 relative"
                        onMouseEnter={() => setTooltipProjectId(project.id + '-desc')}
                        onMouseLeave={() => setTooltipProjectId(null)}>
                      {project.description}
                      <FixedTooltip
                        show={tooltipProjectId === project.id + '-desc'}
                        anchorRect={null}
                      >
                        {project.description}
                      </FixedTooltip>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-xs relative"
                        onMouseEnter={() => setTooltipProjectId(project.id + '-status')}
                        onMouseLeave={() => setTooltipProjectId(null)}>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(project.status)}`}>{getStatusLabel(project.status)}</span>
                      <FixedTooltip
                        show={tooltipProjectId === project.id + '-status'}
                        anchorRect={null}
                      >
                        {getStatusLabel(project.status)}
                      </FixedTooltip>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-xs relative"
                        onMouseEnter={() => setTooltipProjectId(project.id + '-prio')}
                        onMouseLeave={() => setTooltipProjectId(null)}>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getPriorityBadge(project.priority)}`}>{
                        project.priority === 'low' ? 'Baixa' :
                        project.priority === 'medium' ? 'Média' :
                        project.priority === 'high' ? 'Alta' :
                        project.priority === 'critical' ? 'Crítica' : project.priority
                      }</span>
                      <FixedTooltip
                        show={tooltipProjectId === project.id + '-prio'}
                        anchorRect={null}
                      >
                        {
                          project.priority === 'low' ? 'Baixa' :
                          project.priority === 'medium' ? 'Média' :
                          project.priority === 'high' ? 'Alta' :
                          project.priority === 'critical' ? 'Crítica' : project.priority
                        }
                      </FixedTooltip>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-700 relative"
                        onMouseEnter={() => setTooltipProjectId(project.id + '-etapas')}
                        onMouseLeave={() => setTooltipProjectId(null)}>
                      {project.stages.length}
                      <FixedTooltip
                        show={tooltipProjectId === project.id + '-etapas'}
                        anchorRect={null}
                      >
                        {project.stages.map(stage => <div key={stage.id}>{stage.name}</div>)}
                      </FixedTooltip>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-700 relative">
                      <span
                        className="underline cursor-pointer"
                        onMouseEnter={e => {
                          if (tooltipTarefasTimeout.current) clearTimeout(tooltipTarefasTimeout.current);
                          setTooltipProjectId(project.id + '-tarefas');
                          const rect = (e.target as HTMLElement).getBoundingClientRect();
                          setTooltipTarefasRect(rect);
                          if (window.innerHeight - rect.bottom < 180) {
                            setTooltipTarefasPosition('top');
                          } else {
                            setTooltipTarefasPosition('bottom');
                          }
                        }}
                        onMouseLeave={() => {
                          tooltipTarefasTimeout.current = setTimeout(() => setTooltipProjectId(null), 200);
                        }}
                      >
                        {totalTasks}
                      </span>
                      <FixedTooltip
                        show={tooltipProjectId === project.id + '-tarefas'}
                        anchorRect={tooltipTarefasRect}
                        position={tooltipTarefasPosition}
                        onMouseEnter={() => {
                          if (tooltipTarefasTimeout.current) clearTimeout(tooltipTarefasTimeout.current);
                        }}
                        onMouseLeave={() => {
                          tooltipTarefasTimeout.current = setTimeout(() => setTooltipProjectId(null), 200);
                        }}
                      >
                        <div>
                          {Array.from(new Set(project.stages.flatMap(stage => stage.tasks.map(task => task.assignedTo)).filter(Boolean)))
                            .map(userId => {
                              const user = users.find(u => u.id === userId);
                              return user ? (
                                <div key={user.id} className="text-xs py-0.5">{user.name}</div>
                              ) : null;
                            })}
                        </div>
                      </FixedTooltip>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-700 relative"
                        onMouseEnter={() => setTooltipProjectId(project.id + '-criado')}
                        onMouseLeave={() => setTooltipProjectId(null)}>
                      {format(new Date(project.createdAt), 'dd/MM/yy', { locale: ptBR })}
                      <FixedTooltip
                        show={tooltipProjectId === project.id + '-criado'}
                        anchorRect={null}
                      >
                        {format(new Date(project.createdAt), 'dd/MM/yyyy', { locale: ptBR })}
                      </FixedTooltip>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-700 relative"
                        onMouseEnter={() => setTooltipProjectId(project.id + '-end')}
                        onMouseLeave={() => setTooltipProjectId(null)}>
                      {endDate ? format(endDate, 'dd/MM/yy', { locale: ptBR }) : '—'}
                      <FixedTooltip
                        show={tooltipProjectId === project.id + '-end'}
                        anchorRect={null}
                      >
                        {endDate ? format(endDate, 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                      </FixedTooltip>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap relative"
                        onMouseEnter={() => setTooltipProjectId(project.id + '-edit')}
                        onMouseLeave={() => setTooltipProjectId(null)}>
                      <button
                        className="flex items-center text-blue-600 hover:underline text-xs"
                        onClick={() => handleEditProject(project)}
                      >
                        <Edit className="w-4 h-4 mr-1" /> Editar
                      </button>
                      <FixedTooltip
                        show={tooltipProjectId === project.id + '-edit'}
                        anchorRect={null}
                      >
                        Editar Projeto
                      </FixedTooltip>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {projects.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <FolderOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Nenhum projeto encontrado
          </h3>
          <p className="text-gray-600 mb-6">
            Comece criando seu primeiro projeto para organizar suas tarefas.
          </p>
          <button
            onClick={() => setShowCreateProject(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Criar Primeiro Projeto
          </button>
        </div>
      )}

      {/* Modals */}
      <CreateProjectModal
        isOpen={showCreateProject}
        onClose={() => { setShowCreateProject(false); setEditingProject(null); }}
        onCreateProject={handleSaveProject}
        users={users}
        editingProject={editingProject}
      />

      <CreateTaskModal
        isOpen={showCreateTask}
        onClose={() => setShowCreateTask(false)}
        onCreateTask={handleCreateTask}
        projects={projects}
        users={users}
      />

      {/* Modal de visualização do projeto */}
      {showProjectDetails && viewProject && (
        <ProjectDetailsModal isOpen={showProjectDetails} project={viewProject} onClose={() => setShowProjectDetails(false)} users={users} />
      )}

      {/* Modal de detalhes da tarefa */}
      {showTaskModal && selectedTask && (
        <TaskDetailsModal isOpen={showTaskModal} onClose={() => setShowTaskModal(false)} task={selectedTask} users={users} project={viewProject || undefined} />
      )}

      {/* Animacao fade-in (opcional) */}
      <style>{`.animate-fade-in{animation:fadeIn .15s ease-in}@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
};

export default ProjectsView;