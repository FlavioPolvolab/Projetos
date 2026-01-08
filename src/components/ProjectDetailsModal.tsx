import React from 'react';
import { formatDateToLocal } from '../lib/formatDate';
import TaskDetailsModal from './TaskDetailsModal';

interface ProjectDetailsModalProps {
  isOpen: boolean;
  project: any;
  onClose: () => void;
  users: any[];
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'planning': return 'Planejamento';
    case 'in-progress': return 'Em Andamento';
    case 'completed': return 'Concluído';
    case 'on-hold': return 'Pausado';
    default: return status;
  }
};

const getPriorityLabel = (priority: string) => {
  switch (priority) {
    case 'low': return 'Baixa';
    case 'medium': return 'Média';
    case 'high': return 'Alta';
    case 'critical': return 'Crítica';
    default: return priority;
  }
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

const ProjectDetailsModal: React.FC<ProjectDetailsModalProps> = ({ isOpen, project, onClose, users }) => {
  const [showTaskModal, setShowTaskModal] = React.useState(false);
  const [modalTask, setModalTask] = React.useState<any>(null);
  const [sort, setSort] = React.useState<{ field: 'dueDate' | 'stageName', direction: 'asc' | 'desc' }>({ field: 'dueDate', direction: 'asc' });
  const [statusFilter, setStatusFilter] = React.useState<string>('all');

  if (!isOpen || !project) return null;

  // Junta todas as tarefas do projeto em um array único
  const allTasksUnfiltered = (project.stages || []).flatMap((stage: any) =>
    (stage.tasks || []).map((task: any) => ({ ...task, stageName: stage.name, responsible: users?.find(u => u.id === task.assignedTo) }))
  );
  
  // Filtro por status
  let allTasks = allTasksUnfiltered;
  if (statusFilter !== 'all') {
    allTasks = allTasks.filter((task: any) => task.status === statusFilter);
  }
  
  // Ordenação dinâmica
  allTasks = allTasks.slice().sort((a: any, b: any) => {
    if (sort.field === 'dueDate') {
      const aDate = a.dueDate ? new Date(a.dueDate).getTime() : 0;
      const bDate = b.dueDate ? new Date(b.dueDate).getTime() : 0;
      return sort.direction === 'asc' ? aDate - bDate : bDate - aDate;
    } else if (sort.field === 'stageName') {
      const cmp = (a.stageName || '').localeCompare(b.stageName || '', 'pt-BR', { sensitivity: 'base' });
      return sort.direction === 'asc' ? cmp : -cmp;
    }
    return 0;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl p-10 relative max-h-[90vh] flex flex-col">
        <button
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
          onClick={onClose}
        >
          <span className="text-2xl">&times;</span>
        </button>
        <div className="overflow-y-auto flex-1 pr-2">
          <h2 className="text-2xl font-bold mb-2">{project.name}</h2>
          <div className="flex gap-2 mb-4">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${project.status === 'planning' ? 'bg-blue-100 text-blue-800' : project.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' : project.status === 'completed' ? 'bg-green-100 text-green-800' : project.status === 'on-hold' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>{getStatusLabel(project.status)}</span>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${project.priority === 'low' ? 'bg-green-100 text-green-800' : project.priority === 'medium' ? 'bg-blue-100 text-blue-800' : project.priority === 'high' ? 'bg-orange-100 text-orange-800' : project.priority === 'critical' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>{getPriorityLabel(project.priority)}</span>
            {(() => { const s = getDeadlineStatus(project); return <span className={`px-3 py-1 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>; })()}
          </div>
          <div className="mb-4">
            <h3 className="text-md font-semibold text-gray-700 mb-1">Descrição</h3>
            <p className="text-gray-800 text-sm">{project.description}</p>
          </div>
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
              <div>
                <h3 className="text-md font-semibold text-gray-700">Tarefas</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {allTasks.length} de {allTasksUnfiltered.length} tarefa(s)
                  {statusFilter !== 'all' && ` (filtrado por status)`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-600">Filtrar por status:</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="all">Todos</option>
                  <option value="pending">Pendentes</option>
                  <option value="in-progress">Em Andamento</option>
                  <option value="waiting-approval">Aguardando Aprovação</option>
                  <option value="approved">Aprovadas</option>
                  <option value="completed">Concluídas</option>
                  <option value="rejected">Rejeitadas</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border-separate border-spacing-y-1">
                <thead>
                  <tr className="text-left text-gray-700">
                    <th className="px-2 py-1">Título</th>
                    <th
                      className="px-2 py-1 cursor-pointer select-none hover:underline"
                      onClick={() => setSort(s => ({ field: 'dueDate', direction: s.field === 'dueDate' && s.direction === 'asc' ? 'desc' : 'asc' }))}
                    >
                      Vencimento
                      {sort.field === 'dueDate' && (
                        <span className="ml-1 inline-block align-middle">{sort.direction === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </th>
                    <th className="px-2 py-1">Status</th>
                    <th
                      className="px-2 py-1 cursor-pointer select-none hover:underline"
                      onClick={() => setSort(s => ({ field: 'stageName', direction: s.field === 'stageName' && s.direction === 'asc' ? 'desc' : 'asc' }))}
                    >
                      Etapa
                      {sort.field === 'stageName' && (
                        <span className="ml-1 inline-block align-middle">{sort.direction === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {allTasks.map((task: any) => (
                    <tr
                          key={task.id}
                      className={`hover:bg-blue-50 transition cursor-pointer ${task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed' ? 'bg-red-100' : ''}`}
                          onClick={() => { setModalTask(task); setShowTaskModal(true); }}
                        >
                      <td className="px-2 py-1 underline text-blue-700 max-w-[400px] truncate">
                        {task.title}
                        {task.responsible && (
                          <span className="ml-2 text-xs text-gray-400 font-normal">({task.responsible.name})</span>
                        )}
                      </td>
                      <td className="px-2 py-1 text-gray-500">{task.dueDate ? formatDateToLocal(task.dueDate) : '-'}</td>
                      <td className="px-2 py-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${task.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : task.status === 'in-progress' ? 'bg-blue-100 text-blue-800' : task.status === 'completed' ? 'bg-green-100 text-green-800' : task.status === 'waiting-approval' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'}`}> {
                            task.status === 'pending' ? 'Pendente' :
                            task.status === 'in-progress' ? 'Em Andamento' :
                            task.status === 'completed' ? 'Concluída' :
                            task.status === 'waiting-approval' ? 'Aguardando Aprovação' : task.status
                          }</span>
                      </td>
                      <td className="px-2 py-1 font-bold text-gray-800">{task.stageName}</td>
                    </tr>
                      ))}
                  {allTasks.length === 0 && (
                    <tr><td colSpan={4} className="text-gray-400 italic text-center py-4">Nenhuma tarefa encontrada.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      {/* Modal de detalhes da tarefa */}
      {showTaskModal && modalTask && modalTask.id ? (
        <TaskDetailsModal
          isOpen={showTaskModal}
          onClose={() => {
            setShowTaskModal(false);
            setTimeout(() => setModalTask(null), 0);
          }}
          task={modalTask}
          users={users || []}
          project={project}
        />
      ) : null}
    </div>
  );
};

export default ProjectDetailsModal; 