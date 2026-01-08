import React, { useState, useEffect } from 'react';
import { Search, Filter, CheckSquare, List, LayoutGrid } from 'lucide-react';
import { useProjectsContext } from '../contexts/ProjectsContext';
import { useNotificationsContext } from '../contexts/NotificationsContext';
import TaskCard from './TaskCard';
import { Task, User, Project } from '../types';
import CreateTaskModal from './CreateTaskModal';
import TaskDetailsModal from './TaskDetailsModal';
import { ModalCentralizado } from './TaskDetailsModal';
import Tooltip from './Tooltip';

interface TasksViewProps {
  initialUserFilter?: string;
}

type EditingTaskWithProject = Task & { projectId?: string; stageId?: string };

const TasksView: React.FC<TasksViewProps> = ({ initialUserFilter }) => {
  const { getUserTasks, updateTaskStatus, updateTask, transferTask, getAllUsers, fetchProjects, isLoading, getUserProjects } = useProjectsContext();
  const { addNotification } = useNotificationsContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<Task['status'] | 'all'>('all');
  const [userFilter, setUserFilter] = useState<string>(initialUserFilter || 'all');
  const [editingTask, setEditingTask] = useState<EditingTaskWithProject | null>(null);
  const [showEditTaskModal, setShowEditTaskModal] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('list');
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null);
  const [tooltipProjectId, setTooltipProjectId] = useState<string | null>(null);
  // Estado para expandir/colapsar tarefas concluídas (deve ficar no topo)
  const [showCompleted, setShowCompleted] = useState(false);
  // Adicionar estados para modal de detalhes da tarefa
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [outrasSort, setOutrasSort] = useState<'start' | 'due'>('start');

  const userTasks = getUserTasks();
  const userProjects = getUserProjects();

  useEffect(() => {
    getAllUsers().then(setUsers);
  }, []);

  const filteredTasks = userTasks.filter(task => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (task.projectName && task.projectName.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    const matchesUser = userFilter === 'all' || task.assignedTo === userFilter;
    const matchesProject = projectFilter === 'all' || (task.projectName && task.projectName === projectFilter);
    return matchesSearch && matchesStatus && matchesUser && matchesProject;
  });

  // Ordenar tarefas: concluídas por último
  const orderedTasks = [...filteredTasks].sort((a, b) => {
    if (a.status === 'completed' && b.status !== 'completed') return 1;
    if (a.status !== 'completed' && b.status === 'completed') return -1;
    return 0;
  });

  const getProjectAndStageIdForTask = (task: Task): { projectId: string; stageId: string } => {
    for (const project of userProjects) {
      for (const stage of project.stages) {
        if (stage.tasks.some(t => t.id === task.id)) {
          return { projectId: project.id, stageId: stage.id };
        }
      }
    }
    return { projectId: '', stageId: '' };
  };

  const handleEditTask = (task: Task) => {
    const { projectId, stageId } = getProjectAndStageIdForTask(task);
    setEditingTask({ ...task, projectId, stageId });
      setShowEditTaskModal(true);
  };

  const handleSaveTask = async (projectId: string, stageId: string, taskData: any) => {
    if (editingTask) {
      await updateTask(editingTask.id, taskData);
      if (taskData.assignedTo) {
        await addNotification({
          type: 'task_assigned',
          title: 'Tarefa atribuída/atualizada',
          message: `Você foi designado ou sua tarefa foi atualizada: "${taskData.title}"`,
          taskId: editingTask.id,
          projectName: '',
          priority: taskData.priority || 'medium',
          read: false
        }, taskData.assignedTo);
      }
      setEditingTask(null);
      setShowEditTaskModal(false);
      await fetchProjects();
    }
  };

  const statusOptions = [
    { value: 'all', label: 'Todos os Status' },
    { value: 'pending', label: 'Pendente' },
    { value: 'in-progress', label: 'Em Andamento' },
    { value: 'waiting-approval', label: 'Aguardando Aprovação' },
    { value: 'approved', label: 'Aprovado' },
    { value: 'completed', label: 'Concluído' },
    { value: 'rejected', label: 'Rejeitado' }
  ];

  // Funções de ação para lista
  const handleStartTask = (task: Task) => {
    if (task.parentTaskId) {
      // Buscar a tarefa vinculada na lista de tarefas do usuário (ou todas as tarefas)
      const parent = userTasks.find(t => t.id === task.parentTaskId);
      if (parent && parent.status !== 'completed') {
        // Exibir modal de bloqueio já usado no sistema
        setBlockedMsg('Você só pode iniciar esta tarefa após a conclusão da tarefa vinculada: ' + (parent.title || parent.id));
        return;
      }
    }
    updateTaskStatus(task.id, 'in-progress');
  };
  const handleSendForApproval = (task: Task) => updateTaskStatus(task.id, 'waiting-approval');
  const handleCompleteTask = (task: Task) => updateTaskStatus(task.id, 'completed');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <span className="text-lg text-gray-500 animate-pulse">Carregando tarefas...</span>
      </div>
    );
  }

  // Cálculos de tarefas para visualização em lista
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // 1. Tarefas atrasadas
  const overdueTasks = orderedTasks.filter(task =>
    task.dueDate && new Date(task.dueDate) < startOfToday && task.status !== 'completed'
  );
  // 2. Tarefas da semana (começam ou terminam na semana atual, segunda a sexta)
  const dayOfWeek = startOfToday.getDay();
  const monday = new Date(startOfToday);
  monday.setDate(startOfToday.getDate() - ((dayOfWeek + 6) % 7)); // segunda-feira
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4); // sexta-feira
  const weekTasks = orderedTasks.filter(task => {
    if (task.status === 'completed') return false;
    const start = task.startDate ? new Date(task.startDate) : null;
    const due = task.dueDate ? new Date(task.dueDate) : null;
    // Começa OU termina na semana (segunda a sexta)
    const startsThisWeek = start && start >= monday && start <= friday;
    const endsThisWeek = due && due >= monday && due <= friday;
    return (startsThisWeek || endsThisWeek);
  });
  // 3. Outras tarefas (não estão em nenhuma das categorias acima)
  const idsExibidas = new Set([
    ...overdueTasks.map(t => t.id),
    ...weekTasks.map(t => t.id)
  ]);
  const outrasTarefas = orderedTasks.filter(task => !idsExibidas.has(task.id) && task.status !== 'completed');
  // 4. Tarefas concluídas
  const completedTasks = orderedTasks.filter(task => task.status === 'completed');
  // Ordenação para outras tarefas
  const outrasTarefasOrdenadas = [...outrasTarefas].sort((a, b) => {
    const aDate = outrasSort === 'start' ? a.startDate : a.dueDate;
    const bDate = outrasSort === 'start' ? b.startDate : b.dueDate;
    if (!aDate && !bDate) return 0;
    if (!aDate) return 1;
    if (!bDate) return -1;
    return new Date(aDate).getTime() - new Date(bDate).getTime();
  });
  // Função para renderizar tabela de tarefas
  function renderTable(tasks: Task[], emptyMsg: string) {
    return tasks.length > 0 ? (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Projeto</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Etapa</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Título</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prioridade</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Início</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prazo</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vínculo</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {tasks.map((task: Task) => (
              <tr key={task.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{task.projectName}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{task.stageName || '-'}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-blue-700 font-medium cursor-pointer" onClick={() => { setSelectedTask(task); setShowDetailsModal(true); }}>{task.title}</td>
                <td className="px-4 py-2 whitespace-nowrap text-xs">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${task.status === 'pending' ? 'bg-gray-100 text-gray-800' : task.status === 'in-progress' ? 'bg-blue-100 text-blue-800' : task.status === 'waiting-approval' ? 'bg-yellow-100 text-yellow-800' : task.status === 'approved' ? 'bg-green-100 text-green-800' : task.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{
                    task.status === 'pending' ? 'Pendente' :
                    task.status === 'in-progress' ? 'Em Andamento' :
                    task.status === 'waiting-approval' ? 'Aguardando Aprovação' :
                    task.status === 'approved' ? 'Aprovado' :
                    task.status === 'completed' ? 'Concluído' :
                    'Rejeitado'
                  }</span>
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-xs">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${task.priority === 'critical' ? 'bg-red-100 text-red-800' : task.priority === 'high' ? 'bg-orange-100 text-orange-800' : task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>{
                    task.priority === 'critical' ? 'Crítica' :
                    task.priority === 'high' ? 'Alta' :
                    task.priority === 'medium' ? 'Média' :
                    'Baixa'
                  }</span>
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-700">{task.startDate ? new Date(task.startDate).toLocaleDateString() : '-'}</td>
                <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-700">{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '-'}</td>
                <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-700">
                  {task.parentTaskId ? (
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 relative"
                      onMouseEnter={() => setTooltipProjectId(task.id + '-vinculo')}
                      onMouseLeave={() => setTooltipProjectId(null)}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 010 5.656m-3.656-3.656a4 4 0 015.656 0m-7.778 7.778a4 4 0 010-5.656m3.656 3.656a4 4 0 01-5.656 0" /></svg>
                      <Tooltip show={tooltipProjectId === task.id + '-vinculo'}>{task.parentTaskTitle || task.parentTaskId}</Tooltip>
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-2 whitespace-nowrap flex gap-2">
                  {task.status === 'pending' && (
                    <button className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600" onClick={() => handleStartTask(task)}>Iniciar</button>
                  )}
                  {task.status === 'in-progress' && task.requiresApproval && (
                    <button className="px-2 py-1 bg-yellow-500 text-white rounded text-xs hover:bg-yellow-600" onClick={() => handleSendForApproval(task)}>Mandar para aprovação</button>
                  )}
                  {(task.status === 'in-progress' || task.status === 'approved') && (
                    <button className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600" onClick={() => handleCompleteTask(task)}>Concluir</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-500">{emptyMsg}</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Minhas Tarefas</h1>
          <p className="text-gray-600">Gerencie suas tarefas atribuídas</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{filteredTasks.length} de {userTasks.length} tarefas</span>
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
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Pesquisar tarefas ou projetos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            />
          </div>

          {/* Project Filter */}
          <select
            value={projectFilter}
            onChange={e => setProjectFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
          >
            <option value="all">Todos os Projetos</option>
            {userProjects.map(project => (
              <option key={project.id} value={project.name}>{project.name}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as Task['status'] | 'all')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
          >
            {statusOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {/* User Filter */}
          <select
            value={userFilter}
            onChange={e => setUserFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
          >
            <option value="all">Todos os Usuários</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Visualização em lista */}
      {viewMode === 'list' ? (
              <div className="overflow-x-auto">
          <div className="min-w-[700px] w-full grid grid-cols-1 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-red-300 p-2 sm:p-4">
                <div className="p-4 border-b border-red-100">
                  <h3 className="text-lg font-bold text-red-700">Tarefas Atrasadas</h3>
                  <span className="text-sm text-red-500 font-semibold">{overdueTasks.length} tarefa(s)</span>
                </div>
                {renderTable(overdueTasks, 'Nenhuma tarefa atrasada.')}
              </div>
            <div className="bg-white rounded-xl shadow-sm border border-yellow-300 p-2 sm:p-4">
                <div className="p-4 border-b border-yellow-100">
                <h3 className="text-lg font-bold text-yellow-700">Tarefas da Semana</h3>
                <span className="text-sm text-yellow-600 font-semibold">{weekTasks.length} tarefa(s)</span>
              </div>
              {renderTable(weekTasks, 'Nenhuma tarefa para esta semana.')}
                </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-300 p-2 sm:p-4">
              <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                <h3 className="text-lg font-bold text-gray-700">Outras Tarefas</h3>
                <span className="text-sm text-gray-600 font-semibold">{outrasTarefas.length} tarefa(s)</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium">Ordenar por:</label>
                  <select
                    value={outrasSort}
                    onChange={e => setOutrasSort(e.target.value as 'start' | 'due')}
                    className="border rounded px-2 py-1 text-xs"
                  >
                    <option value="start">Data de Início</option>
                    <option value="due">Data Final</option>
                  </select>
                </div>
              </div>
              {renderTable(outrasTarefasOrdenadas, 'Nenhuma outra tarefa.')}
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-green-300 p-2 sm:p-4">
              <div className="p-4 border-b border-green-100 flex items-center justify-between cursor-pointer select-none" onClick={() => setShowCompleted(v => !v)}>
                <div>
                  <h3 className="text-lg font-bold text-green-700">Tarefas Concluídas</h3>
                  <span className="text-sm text-green-600 font-semibold">{completedTasks.length} tarefa(s)</span>
                </div>
                <span className="ml-4 text-green-700">{showCompleted ? '▲' : '▼'}</span>
              </div>
              {showCompleted && renderTable(completedTasks, 'Nenhuma tarefa concluída.')}
            </div>
          </div>
        </div>
      ) : (
        // Visualização em cards (original)
        Array.isArray(orderedTasks) && orderedTasks.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {orderedTasks.map(task => (
            <div key={task.id} onClick={() => { setSelectedTask(task); setShowDetailsModal(true); }} className="cursor-pointer">
            <TaskCard
              task={task}
              showProject={true}
              onStatusChange={updateTaskStatus}
              onTransfer={transferTask}
              users={users}
                onEditTask={handleEditTask}
            />
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <CheckSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhuma tarefa encontrada</h3>
            <p className="text-gray-600">{searchTerm || statusFilter !== 'all' || userFilter !== 'all' ? 'Tente ajustar os filtros para encontrar suas tarefas.' : 'Você não tem tarefas atribuídas no momento.'}</p>
          {(searchTerm || statusFilter !== 'all' || userFilter !== 'all') && (
              <button onClick={() => { setSearchTerm(''); setStatusFilter('all'); setUserFilter('all'); }} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">Limpar Filtros</button>
          )}
        </div>
        )
      )}
      <CreateTaskModal
        isOpen={showEditTaskModal}
        onClose={() => { setShowEditTaskModal(false); setEditingTask(null); fetchProjects(); }}
        onCreateTask={handleSaveTask}
        projects={userProjects}
        users={users}
        editingTask={editingTask}
      />
      {/* Modal de bloqueio para ação de dependência */}
      <ModalCentralizado open={!!blockedMsg} onClose={() => setBlockedMsg(null)} title="Ação Bloqueada">
        {blockedMsg}
      </ModalCentralizado>
      {/* Modal de detalhes da tarefa */}
      <TaskDetailsModal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        task={selectedTask}
        users={users}
        project={userProjects.find(p => p.name === selectedTask?.projectName)}
      />
    </div>
  );
};

export default TasksView;