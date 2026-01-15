import React, { useState } from 'react';
import { 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  User,
  Calendar,
  MessageSquare,
  ArrowRightLeft,
  AlertTriangle,
  Edit
} from 'lucide-react';
import { Task } from '../types';
import { format, differenceInDays, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNotificationsContext } from '../contexts/NotificationsContext';
import { useAuth } from '../contexts/AuthContext';
import TransferTaskModal from './TransferTaskModal';
import { useProjectsContext } from '../contexts/ProjectsContext';
import { ModalCentralizado } from './TaskDetailsModal';
import { formatDateUTC } from '../lib/formatDate';
import Tooltip from './Tooltip';

interface TaskCardProps {
  task: Task & { projectName?: string; stageName?: string };
  showProject?: boolean;
  onStatusChange?: (taskId: string, status: Task['status']) => void;
  onApprove?: (taskId: string) => void;
  onReject?: (taskId: string, reason: string) => void;
  onTransfer?: (taskId: string, newAssignee: string, reason: string) => void;
  users?: Array<{ id: string; name: string; email: string; roles: string[] }>;
  onEditTask?: (task: Task) => void;
}

const TaskCard: React.FC<any> = (props) => {
  const {
  task, 
    users = [],
    showProject,
  onStatusChange,
  onTransfer,
    onEditTask,
    onApprove = () => {},
    onReject = () => {},
  } = props;
  if (!task || !Array.isArray(users)) return null;
  const { user } = useAuth();
  const { sendTaskForApproval, updateTask, fetchProjects } = useProjectsContext();
  const { getTaskDeadlineStatus, addNotification } = useNotificationsContext();
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [comment, setComment] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null);
  const [tooltipProjectId, setTooltipProjectId] = useState<string | null>(null);

  const deadlineStatus = getTaskDeadlineStatus(task);

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
    }
  };

  const getStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-800';
      case 'in-progress': return 'bg-blue-100 text-blue-800';
      case 'waiting-approval': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
    }
  };

  const getDeadlineColor = (status: string) => {
    switch (status) {
      case 'overdue': return 'border-l-red-500 bg-red-50';
      case 'urgent': return 'border-l-orange-500 bg-orange-50';
      case 'warning': return 'border-l-yellow-500 bg-yellow-50';
      default: return 'border-l-gray-200 bg-white';
    }
  };

  const getStatusLabel = (status: Task['status']) => {
    switch (status) {
      case 'pending': return 'Pendente';
      case 'in-progress': return 'Em Andamento';
      case 'waiting-approval': return 'Aguardando Aprovação';
      case 'approved': return 'Aprovado';
      case 'completed': return 'Concluído';
      case 'rejected': return 'Rejeitado';
    }
  };

  const getPriorityLabel = (priority: Task['priority']) => {
    switch (priority) {
      case 'critical': return 'Crítica';
      case 'high': return 'Alta';
      case 'medium': return 'Média';
      case 'low': return 'Baixa';
    }
  };

  const getDeadlineInfo = () => {
    if (!task.dueDate) return null;
    
    const now = new Date();
    const dueDate = new Date(task.dueDate);
    const daysUntilDue = differenceInDays(dueDate, now);
    const isOverdue = isAfter(now, dueDate);

    if (isOverdue) {
      return {
        text: `Atrasada há ${Math.abs(daysUntilDue)} dia(s)`,
        icon: <AlertTriangle className="w-4 h-4 text-red-500" />,
        color: 'text-red-600'
      };
    } else if (daysUntilDue === 0) {
      return {
        text: 'Vence hoje',
        icon: <Clock className="w-4 h-4 text-orange-500" />,
        color: 'text-orange-600'
      };
    } else if (daysUntilDue <= 3) {
      return {
        text: `Vence em ${daysUntilDue} dia(s)`,
        icon: <Clock className="w-4 h-4 text-yellow-500" />,
        color: 'text-yellow-600'
      };
    }

    return null;
  };

  const canChangeStatus = () => {
    // Admin e gerente podem mudar status de qualquer tarefa
    if (user?.roles.includes('admin') || user?.roles.includes('manager')) {
      return task.status === 'pending' || task.status === 'in-progress' || task.status === 'approved';
    }
    // Usuários regulares só podem mudar status de tarefas atribuídas a eles
    const assignedToIds = Array.isArray(task.assignedTo) ? task.assignedTo : (task.assignedTo ? [task.assignedTo] : []);
    return assignedToIds.includes(user?.id || '') && (task.status === 'pending' || task.status === 'in-progress' || task.status === 'approved');
  };

  const canTransfer = () => {
    return (user?.roles.includes('admin') || user?.roles.includes('manager') || task.assignedTo === user?.id) && 
           task.status !== 'completed' && users.length > 0;
  };

  const handleTransfer = (newAssignee: string, reason: string) => {
    if (onTransfer) {
      onTransfer(task.id, newAssignee, reason);
    }
  };

  const handleSendForApproval = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    await sendTaskForApproval(task.id);
    // fetchProjects será chamado automaticamente pela função updateTaskStatus
  };

  const handleAddComment = () => {
    if (comment.trim()) {
      const newComment = {
        id: Date.now().toString(),
        content: comment,
        author: user?.id || '',
        createdAt: new Date()
      };
      updateTask(task.id, {
        comments: [...(task.comments || []), newComment]
      });
      setComment('');
      setIsCommenting(false);
    }
  };

  const deadlineInfo = getDeadlineInfo();

  // Banner de conclusão
  const getCompletedBanner = () => {
    if (task.status === 'completed' && task.completedAt && !isNaN(new Date(task.completedAt).getTime())) {
      return (
        <div className="flex items-center space-x-2 mb-4 p-2 rounded-lg bg-green-50">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span className="text-sm font-medium text-green-700">
            Concluída em {formatDateUTC(task.completedAt)}
          </span>
        </div>
      );
    }
    return null;
  };

  const handleStatusChange = async (status: Task['status']) => {
    await updateTaskStatus(task.id, status, (msg) => setBlockedMsg(msg));
    // Log e notificação para todos os assignees
    const assigneeIds = Array.isArray(task.assignedTo) ? task.assignedTo : (task.assignedTo ? [task.assignedTo] : []);
    for (const assigneeId of assigneeIds) {
      if (assigneeId) {
      await addNotification({
        type: 'task_assigned',
        title: 'Tarefa atribuída/atualizada',
        message: `O status da tarefa "${task.title}" foi alterado para: ${status}`,
        taskId: task.id,
        projectName: task.projectName || '',
        priority: task.priority || 'medium',
        read: false
        }, assigneeId);
      }
    }
    // Se não bloqueou, pode chamar onStatusChange normalmente
    // (Opcional: só chamar se não houve bloqueio)
  };

  return (
    <>
      <div className={`rounded-xl shadow-sm border-2 border-l-4 p-6 hover:shadow-md transition-all duration-200 ${getDeadlineColor(deadlineStatus)}`}>
        {/* Banner de conclusão ou de prazo */}
        {task.status === 'completed' ? getCompletedBanner() : deadlineInfo && (
          <div className={`flex items-center space-x-2 mb-4 p-2 rounded-lg bg-opacity-50 ${
            deadlineStatus === 'overdue' ? 'bg-red-100' : 
            deadlineStatus === 'urgent' ? 'bg-orange-100' : 'bg-yellow-100'
          }`}>
            {deadlineInfo.icon}
            <span className={`text-sm font-medium ${deadlineInfo.color}`}>
              {deadlineInfo.text}
            </span>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 text-lg mb-1">{task.title}</h3>
            {showProject && task.projectName && (
              <div className="text-sm text-gray-500 mb-2">
                {task.projectName} • {task.stageName}
              </div>
            )}
            <p className="text-gray-600 text-sm leading-relaxed">{task.description}</p>
          </div>
          <div className="flex flex-col space-y-2 ml-4 items-end">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
              {getStatusLabel(task.status)}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPriorityColor(task.priority)}`}>
              {getPriorityLabel(task.priority)}
            </span>
            {onEditTask && task.status !== 'completed' && (
              <span className="relative" onMouseEnter={() => setTooltipProjectId(task.id + '-edit')} onMouseLeave={() => setTooltipProjectId(null)}>
              <button
                className="flex items-center text-blue-600 hover:underline text-xs mt-2"
                onClick={() => onEditTask(task)}
              >
                <Edit className="w-4 h-4 mr-1" /> Editar
              </button>
                <Tooltip show={tooltipProjectId === task.id + '-edit'}>Editar Tarefa</Tooltip>
              </span>
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-4 mb-4 text-sm text-gray-600">
          {task.startDate && (
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4" />
              <span>Início: {formatDateUTC(task.startDate)}</span>
            </div>
          )}
          {task.dueDate && task.status !== 'completed' && !isNaN(new Date(task.dueDate).getTime()) && (
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4" />
              <span>Prazo: {formatDateUTC(task.dueDate)}</span>
            </div>
          )}
          {task.status === 'completed' && task.completedAt && !isNaN(new Date(task.completedAt).getTime()) && (
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Concluída em: {formatDateUTC(task.completedAt)}</span>
            </div>
          )}
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4" />
            <span>Criado: {task.createdAt && !isNaN(new Date(task.createdAt).getTime()) ? formatDateUTC(task.createdAt) : '-'}</span>
          </div>
          {task.parentTaskId && (
            <div className="flex items-center space-x-2">
              <ArrowRightLeft className="w-4 h-4 text-blue-500" />
              <span>Vinculada: {task.parentTaskTitle || task.parentTaskId}</span>
            </div>
          )}
        </div>

        {/* Exibir histórico, comentários e ações apenas se não estiver concluída */}
        {task.status !== 'completed' && (
          <>
            {/* Histórico de Status */}
            <div className="mt-6">
              <h4 className="font-semibold text-gray-800 mb-2">Histórico de Status</h4>
              <div className="space-y-3">
                {(task.statusHistory || []).map((item, idx) => (
                  <div key={idx} className="flex items-center space-x-3 bg-gray-50 rounded-lg p-3">
                    <Clock className="w-5 h-5 text-gray-400" />
                    <span className="text-xs px-2 py-1 rounded bg-gray-200 font-semibold">{getStatusLabel(item.status)}</span>
                    <span className="text-xs text-gray-700 font-medium">{item.userName}</span>
                    <span className="text-xs text-gray-500 ml-auto">{item.date && !isNaN(new Date(item.date).getTime()) ? formatDateUTC(item.date) : '-'}</span>
                </div>
              ))}
            </div>
          </div>

            {/* Comentários */}
            <div className="mt-8">
              <h4 className="font-semibold text-gray-800 mb-2">Comentários</h4>
              <div className="space-y-4">
                {(task.comments || []).map((c, idx) => {
                  const author = users.find(u => u.id === c.author);
                  return (
                    <div key={idx} className="flex items-start space-x-3 bg-gray-50 rounded-lg p-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                        <span role="img" aria-label="avatar">{author?.name ? author.name[0] : 'U'}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-800 text-sm">{author?.name || 'Usuário'}</span>
                          <span className="text-xs text-gray-500">{c.createdAt && !isNaN(new Date(c.createdAt).getTime()) ? formatDateUTC(c.createdAt) : '-'}</span>
                        </div>
                        <div className="text-gray-700 text-sm mt-1 break-all max-w-full">{c.content}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Adicionar comentário */}
              <div className="mt-4 flex items-center space-x-2">
                <input
                  type="text"
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Adicionar comentário..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  onFocus={() => setIsCommenting(true)}
                />
                <button
                  onClick={handleAddComment}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                  disabled={!comment.trim()}
                >
                  Enviar
                </button>
              </div>
            </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="flex space-x-2">
                {/* Botão Solicitar Aprovação direto no card */}
                {task.requiresApproval && task.status === 'in-progress' && (
                  <button
                    onClick={handleSendForApproval}
                    className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors text-sm font-medium"
                  >
                    Solicitar Aprovação
                  </button>
                )}
                {/* Botões Aprovar/Rejeitar para tarefas aguardando aprovação */}
            {task.status === 'waiting-approval' && onApprove && onReject && (
              <>
                <input
                  type="text"
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Comentário obrigatório para aprovar ou reprovar"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm mr-2"
                />
                <button
                  onClick={e => { e.stopPropagation(); if (comment.trim()) { onApprove(task.id, comment); setComment(''); } }}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                  disabled={!comment.trim()}
                >
                      Aprovar
                </button>
                <button
                  onClick={e => { e.stopPropagation(); if (comment.trim()) { onReject(task.id, comment); setComment(''); } }}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                  disabled={!comment.trim()}
                >
                      Rejeitar
                </button>
              </>
            )}
          </div>
          {/* Status Icons */}
          <div className="flex items-center space-x-2">
            {task.status === 'completed' && <CheckCircle className="w-5 h-5 text-green-500" />}
            {task.status === 'waiting-approval' && <Clock className="w-5 h-5 text-yellow-500" />}
            {task.status === 'rejected' && <XCircle className="w-5 h-5 text-red-500" />}
            {deadlineStatus === 'overdue' && <AlertTriangle className="w-5 h-5 text-red-500" />}
          </div>
        </div>
          </>
        )}
      </div>

      {/* Transfer Modal */}
      <TransferTaskModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        onTransfer={handleTransfer}
        task={task}
        users={users}
      />

      {/* Modal de bloqueio */}
      <ModalCentralizado open={!!blockedMsg} onClose={() => setBlockedMsg(null)} title="Ação Bloqueada">
        {blockedMsg}
      </ModalCentralizado>
    </>
  );
};

export default TaskCard;