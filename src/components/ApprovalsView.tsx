import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckSquare, List, LayoutGrid } from 'lucide-react';
import { useProjectsContext } from '../contexts/ProjectsContext';
import { useAuth } from '../contexts/AuthContext';
import TaskCard from './TaskCard';
import { User } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ModalCentralizado } from './TaskDetailsModal';

const ApprovalsView: React.FC = () => {
  const { user } = useAuth();
  const { getTasksForApproval, approveTask, rejectTask, getAllUsers, approveStage } = useProjectsContext();
  const [users, setUsers] = useState<User[]>([]);
  const [modal, setModal] = useState<{ open: boolean; action: 'approve' | 'reject' | null; taskId: string | null }>({ open: false, action: null, taskId: null });
  const [comment, setComment] = useState('');
  const [projectDetailModal, setProjectDetailModal] = useState<{ open: boolean, projectName: string, projectDesc: string, stageName: string, stageDesc: string, taskTitle: string, taskDesc: string } | null>(null);

  useEffect(() => {
    getAllUsers().then(setUsers);
  }, []);

  // Redirect if user doesn't have permission (only admin and aprovador can see approvals)
  if (!user?.roles?.includes('admin') && !user?.roles?.includes('aprovador')) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
        <AlertTriangle className="w-16 h-16 text-red-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Acesso Negado
        </h3>
        <p className="text-gray-600">
          Você não tem permissão para acessar esta seção. Apenas administradores e aprovadores podem ver as aprovações pendentes.
        </p>
      </div>
    );
  }

  const pendingApprovals = getTasksForApproval();
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('list');

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Concluída';
      case 'in-progress': return 'Em Andamento';
      case 'pending': return 'Pendente';
      case 'waiting-approval': return 'Aguardando Aprovação';
      case 'approved': return 'Aprovada';
      case 'rejected': return 'Rejeitada';
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Aprovações Pendentes</h1>
          <p className="text-gray-600">Gerencie as solicitações de aprovação de tarefas</p>
        </div>
        <div className="flex items-center gap-2">
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
        <div className="flex items-center space-x-2 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2">
          <AlertTriangle className="w-5 h-5 text-yellow-600" />
          <span className="text-yellow-800 font-medium">
            {pendingApprovals.length} pendente{pendingApprovals.length !== 1 ? 's' : ''}
          </span>
          </div>
        </div>
      </div>

      {/* User Role Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <CheckSquare className="w-5 h-5 text-blue-600" />
          <span className="text-blue-800 font-medium">
            Você está logado como: {user?.roles ? user.roles.map(r => r === 'admin' ? 'Administrador' : r === 'aprovador' ? 'Aprovador' : r.charAt(0).toUpperCase() + r.slice(1)).join(', ') : ''}
          </span>
        </div>
        <p className="text-blue-700 text-sm mt-1">
          {user?.roles?.includes('admin')
            ? 'Como administrador, você pode aprovar ou rejeitar qualquer tarefa.'
            : user?.roles?.includes('aprovador')
              ? 'Como aprovador, você pode aprovar ou rejeitar tarefas que requerem aprovação.'
              : ''}
        </p>
      </div>

      {/* Approval Items */}
      {pendingApprovals.length > 0 ? (
        viewMode === 'cards' ? (
        <div className="space-y-6">
          {pendingApprovals.map(item => (
            item.type === 'stage' ? (
              <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col gap-4 relative">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{item.name}</h3>
                  <div className="text-sm text-gray-500 mb-2">{item.projectName}</div>
                  <p className="text-gray-700 text-sm mb-2">{item.description}</p>
                  {item.createdAt && !isNaN(new Date(item.createdAt).getTime()) && (
                    <p className="text-xs text-gray-400 mb-2">
                      Criada em: {format(new Date(item.createdAt), 'dd/MM/yyyy', { locale: ptBR })}
                    </p>
                  )}
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Aprovação de Etapa</span>
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => approveStage(item.id)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                  >
                    Aprovar Etapa
                  </button>
                  <button
                    onClick={() => rejectTask(item.id, 'Rejeição da etapa')}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                  >
                    Rejeitar Etapa
                  </button>
                </div>
              </div>
            ) : (
            <TaskCard
                key={item.id}
                task={item}
              showProject={true}
              onApprove={approveTask}
              onReject={rejectTask}
              users={users}
            />
            )
          ))}
        </div>
        ) : (
          <div className="overflow-x-auto bg-white rounded-2xl shadow border border-gray-100 p-2 sm:p-4">
            <table className="min-w-[700px] w-full text-xs sm:text-sm text-left">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-2 whitespace-nowrap">PROJETO</th>
                  <th className="px-2 py-2 whitespace-nowrap">TÍTULO</th>
                  <th className="px-2 py-2 whitespace-nowrap">STATUS</th>
                  <th className="px-2 py-2 whitespace-nowrap hidden md:table-cell">PRIORIDADE</th>
                  <th className="px-2 py-2 whitespace-nowrap hidden md:table-cell">INÍCIO</th>
                  <th className="px-2 py-2 whitespace-nowrap hidden md:table-cell">PRAZO</th>
                  <th className="px-2 py-2 whitespace-nowrap">AÇÃO</th>
                </tr>
              </thead>
              <tbody>
                {pendingApprovals.map(item => item.type === 'stage' ? (
                  <tr key={item.id} className="bg-yellow-50">
                    <td className="px-2 py-2 font-medium">{item.projectName}</td>
                    <td className="px-2 py-2">{item.name}</td>
                    <td className="px-2 py-2">Etapa</td>
                    <td className="px-2 py-2 hidden md:table-cell">-</td>
                    <td className="px-2 py-2 hidden md:table-cell">-</td>
                    <td className="px-2 py-2 hidden md:table-cell">{item.createdAt ? format(new Date(item.createdAt), 'dd/MM/yyyy', { locale: ptBR }) : '-'}</td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => approveStage(item.id)}
                        className="px-3 py-1 bg-green-600 text-white rounded text-xs mr-2"
                      >Aprovar</button>
                      <button
                        onClick={() => rejectTask(item.id, 'Rejeição da etapa')}
                        className="px-3 py-1 bg-red-600 text-white rounded text-xs"
                      >Rejeitar</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={item.id}>
                    <td className="px-2 py-2 font-medium">
                      <button className="text-blue-700 underline" onClick={() => setProjectDetailModal({
                        open: true,
                        projectName: item.projectName,
                        projectDesc: item.projectDescription || '',
                        stageName: item.stageName || '',
                        stageDesc: item.stageDescription || '',
                        taskTitle: item.title,
                        taskDesc: item.description || ''
                      })}>{item.projectName}</button>
                    </td>
                    <td className="px-2 py-2">{item.title}</td>
                    <td className="px-2 py-2">
                        <span className={
                          `px-2 py-1 rounded font-semibold ` +
                          (item.status === 'completed' ? 'bg-green-100 text-green-700' :
                            item.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
                            item.status === 'pending' ? 'bg-gray-100 text-gray-700' :
                            item.status === 'waiting-approval' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700')
                        }>
                          {getStatusLabel(item.status)}
                        </span>
                      </td>
                    <td className="px-2 py-2 hidden md:table-cell">{item.priority ? item.priority.charAt(0).toUpperCase() + item.priority.slice(1) : '-'}</td>
                    <td className="px-2 py-2 hidden md:table-cell">{item.startDate ? format(new Date(item.startDate), 'dd/MM/yyyy', { locale: ptBR }) : '-'}</td>
                    <td className="px-2 py-2 hidden md:table-cell">{item.dueDate ? format(new Date(item.dueDate), 'dd/MM/yyyy', { locale: ptBR }) : '-'}</td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => setModal({ open: true, action: 'approve', taskId: item.id })}
                        className="px-3 py-1 bg-green-600 text-white rounded text-xs mr-2"
                      >Aprovar</button>
                      <button
                        onClick={() => setModal({ open: true, action: 'reject', taskId: item.id })}
                        className="px-3 py-1 bg-red-600 text-white rounded text-xs"
                      >Rejeitar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <CheckSquare className="w-16 h-16 text-green-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Nenhuma aprovação pendente
          </h3>
          <p className="text-gray-600">
            Todas as tarefas que requerem aprovação foram processadas.
          </p>
        </div>
      )}

      {/* Modal de comentário obrigatório */}
      <ModalCentralizado
        open={modal.open}
        onClose={() => { setModal({ open: false, action: null, taskId: null }); setComment(''); }}
        title={modal.action === 'approve' ? 'Comentário para Aprovar' : modal.action === 'reject' ? 'Comentário para Rejeitar' : ''}
      >
        <div className="flex flex-col gap-4">
          <input
            type="text"
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Comentário obrigatório"
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
            disabled={!comment.trim()}
            onClick={() => {
              if (modal.action === 'approve' && modal.taskId && comment.trim()) {
                approveTask(modal.taskId, comment);
                setModal({ open: false, action: null, taskId: null });
                setComment('');
              } else if (modal.action === 'reject' && modal.taskId && comment.trim()) {
                rejectTask(modal.taskId, comment);
                setModal({ open: false, action: null, taskId: null });
                setComment('');
              }
            }}
          >Salvar</button>
        </div>
      </ModalCentralizado>

      {projectDetailModal?.open && (
        <ModalCentralizado open={projectDetailModal.open} onClose={() => setProjectDetailModal(null)}>
          <div className="space-y-4">
            <h2 className="text-xl font-bold">{projectDetailModal.projectName}</h2>
            <p className="text-gray-700 text-sm mb-2">{projectDetailModal.projectDesc}</p>
            <div className="border-t pt-2">
              <h3 className="font-semibold text-gray-800">Etapa</h3>
              <p className="text-gray-700 text-sm mb-1">{projectDetailModal.stageName}</p>
              <p className="text-gray-500 text-xs mb-2">{projectDetailModal.stageDesc}</p>
            </div>
            <div className="border-t pt-2">
              <h3 className="font-semibold text-gray-800">Tarefa</h3>
              <p className="text-gray-700 text-sm mb-1">{projectDetailModal.taskTitle}</p>
              <p className="text-gray-500 text-xs">{projectDetailModal.taskDesc}</p>
            </div>
          </div>
        </ModalCentralizado>
      )}
    </div>
  );
};

export default ApprovalsView;