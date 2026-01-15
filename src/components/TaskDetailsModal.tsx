import React, { useState } from 'react';
import { X, Edit, Clock, CheckSquare, ArrowLeftRight } from 'lucide-react';
import { Task, Project } from '../types';
import { useProjectsContext } from '../contexts/ProjectsContext';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { useNotificationsContext } from '../contexts/NotificationsContext';
import { formatDateToLocal, formatDateUTC } from '../lib/formatDate';
import CommentsThread from './CommentsView';
import Tooltip from './Tooltip';

interface TaskDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  users: Array<{ id: string; name: string; email: string; roles: string[] }>;
  project?: Project;
  onEditTask?: (task: Task) => void;
}

const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({ isOpen, onClose, task, users, project, onEditTask }) => {
  if (!isOpen || !task) return null;
  const { user } = useAuth();
  const { updateTaskStatus, sendTaskForApproval, updateTask: updateTaskContext, addTaskComment, fetchProjects, isLoading } = useProjectsContext();
  const { addNotification } = useNotificationsContext();
  const [comment, setComment] = useState('');
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <span className="text-lg text-gray-500 animate-pulse">Carregando dados...</span>
      </div>
    );
  }

  const handleStatusChange = async (status: Task['status']) => {
    let blocked = false;
    await updateTaskStatus(task.id, status, (msg) => {
      setBlockedMsg(msg);
      blocked = true;
    });
    if (!blocked) {
      // fetchProjects será chamado automaticamente pela função updateTaskStatus
      
      // Enviar notificação para todos os responsáveis
      const assigneeIds = Array.isArray(task.assignedTo) 
        ? task.assignedTo.filter(id => id && id !== '')
        : (task.assignedTo && task.assignedTo !== '' ? [task.assignedTo] : []);
      
      for (const assigneeId of assigneeIds) {
        if (assigneeId) {
        await addNotification({
          type: 'task_assigned',
          title: 'Tarefa atribuída/atualizada',
          message: `O status da tarefa "${task.title}" foi alterado para: ${status}`,
          taskId: task.id,
          projectName: project?.name || '',
          priority: task.priority || 'medium',
          read: false
          }, assigneeId);
        }
      }
      onClose();
    }
  };

  const handleSendForApproval = () => {
    sendTaskForApproval(task.id);
  };

  const handleAddComment = async () => {
    if (comment.trim() && task) {
      await addTaskComment(task.id, comment);
      setComment('');
    }
  };

  // Processar múltiplos responsáveis
  const assigneeIds = Array.isArray(task.assignedTo) 
    ? task.assignedTo.filter(id => id && id !== '')
    : (task.assignedTo && task.assignedTo !== '' ? [task.assignedTo] : []);
  
  // Buscar todos os responsáveis
  const responsibles = assigneeIds
    .map(id => users.find(u => u.id === id))
    .filter(Boolean) as Array<{ id: string; name: string; email: string; roles: string[] }>;
  
  const creator = users.find(u => u.id === task.createdBy);

  const isManagerOrAdmin = user?.roles.includes('admin') || user?.roles.includes('manager');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] h-full sm:h-auto flex flex-col overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 sm:p-6 rounded-t-2xl z-10 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Detalhes da Tarefa</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Dados principais */}
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">{task.title}</h3>
            <p className="text-gray-700 mb-2">{task.description}</p>
            <div className="flex flex-wrap gap-3 text-sm text-gray-600 mb-2">
              <span className="px-2 py-1 rounded bg-gray-100 font-medium">Prioridade: {task.priority}</span>
              <span className="px-2 py-1 rounded bg-gray-100 font-medium">Status: {task.status}</span>
              {project?.name && <span className="px-2 py-1 rounded bg-gray-100 font-medium">Projeto: {project.name}</span>}
              <span className="px-2 py-1 rounded bg-gray-100 font-medium">
                Responsável: {responsibles.length > 0 ? responsibles.map(r => r.name).join(', ') : '-'}
              </span>
              <span className="px-2 py-1 rounded bg-gray-100 font-medium">Criador: {creator?.name || '-'}</span>
              {task.startDate && <span className="px-2 py-1 rounded bg-gray-100 font-medium">Início: {formatDateUTC(task.startDate)}</span>}
              {task.dueDate && <span className="px-2 py-1 rounded bg-gray-100 font-medium">Entrega: {formatDateUTC(task.dueDate)}</span>}
              {task.parentTaskId && (
                <span className="px-2 py-1 rounded bg-gray-100 font-medium">
                  Vinculada: {
                    task.parentTaskTitle || (() => {
                      let parentTask = null;
                      if (project?.stages) {
                        for (const stage of project.stages) {
                          parentTask = stage.tasks.find(t => t.id === task.parentTaskId);
                          if (parentTask) break;
                        }
                      }
                      return parentTask ? parentTask.title : task.parentTaskId;
                    })()
                  }
                </span>
              )}
            </div>
            <div className="flex gap-2 mt-2 flex-wrap">
              {onEditTask && (
                <button onClick={() => onEditTask(task)} className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                  <Edit className="w-4 h-4 mr-1" /> Editar
                </button>
              )}
              {/* Botões de status */}
              {task.status === 'pending' && (
                <button onClick={() => handleStatusChange('in-progress')} className="flex items-center px-3 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 text-sm font-medium">
                  <ArrowLeftRight className="w-4 h-4 mr-1" /> Iniciar
                </button>
              )}
              {(() => {
                const assignedToIds = Array.isArray(task.assignedTo) ? task.assignedTo : (task.assignedTo ? [task.assignedTo] : []);
                const isAssigned = assignedToIds.includes(user?.id || '');
                const canComplete = isAssigned || isManagerOrAdmin;
                
                return ((task.status === 'in-progress' && !task.requiresApproval) || task.status === 'approved') && canComplete ? (
                  <button onClick={() => handleStatusChange('completed')} className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
                    <CheckSquare className="w-4 h-4 mr-1" /> Concluir
                  </button>
                ) : null;
              })()}
              {task.status === 'in-progress' && task.requiresApproval && (
                <button onClick={handleSendForApproval} className="flex items-center px-3 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 text-sm font-medium">
                  <ArrowLeftRight className="w-4 h-4 mr-1" /> Enviar para Aprovação
                </button>
              )}
              {/* Aprovar/Rejeitar para admin/gerente */}
              {task.status === 'waiting-approval' && isManagerOrAdmin && (
                <>
                  <button onClick={() => handleStatusChange('approved')} className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
                    <CheckSquare className="w-4 h-4 mr-1" /> Aprovar
                  </button>
                  <button onClick={() => handleStatusChange('rejected')} className="flex items-center px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium">
                    <X className="w-4 h-4 mr-1" /> Rejeitar
                  </button>
                </>
              )}
              {/* Reabrir tarefa */}
              {task.status === 'completed' && (
                <button onClick={() => handleStatusChange('in-progress')} className="flex items-center px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm font-medium">
                  <ArrowLeftRight className="w-4 h-4 mr-1" /> Reabrir
                </button>
              )}
            </div>
          </div>
          {/* Histórico de Status */}
          <div>
            <h4 className="font-semibold text-gray-800 mb-2">Histórico de Status</h4>
            <div className="space-y-3">
              {(task.statusHistory || []).map((item, idx) => (
                <div key={idx} className="flex items-center space-x-3 bg-gray-50 rounded-lg p-3">
                  <Clock className="w-5 h-5 text-gray-400" />
                  <span className="text-xs px-2 py-1 rounded bg-gray-200 font-semibold">{item.status}</span>
                  <span className="text-xs text-gray-700 font-medium">{item.userName}</span>
                  <span className="text-xs text-gray-500 ml-auto">{format(new Date(item.date), 'yyyy-MM-dd HH:mm')}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Comentários */}
          <div>
            <h4 className="font-semibold text-gray-800 mb-2">Comentários</h4>
            <CommentsThread taskId={typeof task.id === 'string' ? task.id : undefined} taskTitle={task.title} users={users} />
          </div>
        </div>
        {/* Modal de bloqueio */}
        <ModalCentralizado open={!!blockedMsg} onClose={() => setBlockedMsg(null)} title="Ação Bloqueada">
          {blockedMsg}
        </ModalCentralizado>
      </div>
    </div>
  );
};

// ModalCentralizado para mensagens simples
export const ModalCentralizado: React.FC<{ open: boolean; onClose: () => void; title?: string; children: React.ReactNode }> = ({ open, onClose, title, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col items-center">
        {title && <h2 className="text-xl font-bold text-gray-900 mb-4 text-center">{title}</h2>}
        <div className="mb-4 text-center">{children}</div>
        <button onClick={onClose} className="mt-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">OK</button>
      </div>
    </div>
  );
};

export default TaskDetailsModal; 