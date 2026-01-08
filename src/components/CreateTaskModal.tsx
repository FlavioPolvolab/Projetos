import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Project, Task } from '../types';
import { useNotificationsContext } from '../contexts/NotificationsContext';
import { useProjectsContext } from '../contexts/ProjectsContext';
import { getInputDateValue } from '../lib/formatDate';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTask: (projectId: string, stageId: string, taskData: any) => void;
  projects: Project[];
  users: Array<{ id: string; name: string; email: string; roles: string[] }>;
  editingTask?: Task | null;
}

// Função utilitária para garantir data correta no input type='date'
function toDateInputValue(date: any) {
  if (!date) return '';
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  onCreateTask,
  projects = [],
  users = [],
  editingTask
}) => {
  const { user } = useAuth();
  const { addNotification } = useNotificationsContext();
  const { isLoading } = useProjectsContext();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    assignedTo: '',
    projectId: '',
    stageId: '',
    dueDate: '',
    startDate: '',
    parentTaskId: '',
    requiresApproval: false
  });
  const [error, setError] = useState<string | null>(null);

  const selectedProject = Array.isArray(projects) && formData.projectId ? projects.find(p => p.id === formData.projectId) : undefined;

  React.useEffect(() => {
    if (editingTask && isOpen) {
      setFormData({
        title: editingTask.title,
        description: editingTask.description,
        priority: editingTask.priority,
        assignedTo: editingTask.assignedTo,
        projectId: (editingTask as any).projectId || '',
        stageId: (editingTask as any).stageId || '',
        dueDate: editingTask.dueDate ? new Date(editingTask.dueDate).toISOString().slice(0, 10) : '',
        startDate: editingTask.startDate ? new Date(editingTask.startDate).toISOString().slice(0, 10) : '',
        parentTaskId: editingTask.parentTaskId || '',
        requiresApproval: editingTask.requiresApproval
      });
    } else if (isOpen) {
    setFormData({
      title: '',
      description: '',
      priority: 'medium',
      assignedTo: '',
      projectId: '',
      stageId: '',
      dueDate: '',
        startDate: '',
        parentTaskId: '',
      requiresApproval: false
    });
    }
  }, [editingTask, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validação das datas
    if (!formData.startDate || !formData.dueDate) {
      setError('Por favor, preencha a data de início e a data de entrega para salvar a tarefa.');
      return;
    }
    // Verificar se as datas são válidas
    const start = new Date(formData.startDate);
    const end = new Date(formData.dueDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      setError('As datas informadas são inválidas.');
      return;
    }
    if (start > end) {
      setError('A data de início não pode ser maior que a data de entrega.');
      return;
    }
    setError(null);
    const taskData = {
      ...formData,
      id: editingTask ? editingTask.id : `task-${Date.now()}`,
      status: editingTask ? editingTask.status : 'pending',
      createdBy: editingTask ? editingTask.createdBy : user?.id || '',
      createdAt: editingTask ? editingTask.createdAt : new Date(),
      dueDate: end,
      startDate: start,
      parentTaskId: formData.parentTaskId || undefined,
      comments: editingTask ? editingTask.comments : []
    };
    onCreateTask(formData.projectId, formData.stageId, taskData);
    // Notificação para o usuário designado (se não for o próprio criador)
    if (taskData.assignedTo && taskData.assignedTo !== user?.id) {
      await addNotification({
        type: 'task_assigned',
        title: 'Nova tarefa atribuída',
        message: `Você recebeu a tarefa "${taskData.title}"`,
        taskId: taskData.id,
        projectName: '',
        priority: taskData.priority || 'medium',
        read: false
      }, taskData.assignedTo);
    }
    onClose();
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'manager': return 'Gerente';
      case 'user': return 'Usuário';
      case 'aprovador': return 'Aprovador';
      default: return role;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <span className="text-lg text-gray-500 animate-pulse">Carregando dados...</span>
      </div>
    );
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] h-full sm:h-auto flex flex-col overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 sm:p-6 rounded-t-2xl z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">{editingTask ? 'Editar Tarefa' : 'Criar Nova Tarefa'}</h2>
            <button
              onClick={() => { setError(null); onClose(); }}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6">
            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded border border-red-300 text-sm">
                {error}
              </div>
            )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Projeto *
              </label>
              <select
                required
                value={formData.projectId}
                onChange={(e) => setFormData({ ...formData, projectId: e.target.value, stageId: '' })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              >
                <option value="">Selecionar projeto</option>
                  {Array.isArray(projects) ? projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                  )) : null}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Etapa *
              </label>
              <select
                required
                value={formData.stageId}
                onChange={(e) => setFormData({ ...formData, stageId: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                disabled={!selectedProject}
              >
                <option value="">Selecionar etapa</option>
                  {Array.isArray(selectedProject?.stages) ? selectedProject.stages.map(stage => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                  )) : null}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Título da Tarefa *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              placeholder="Digite o título da tarefa"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descrição *
            </label>
            <textarea
              required
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              placeholder="Descreva detalhadamente o que deve ser feito"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prioridade
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              >
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
                <option value="critical">Crítica</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Atribuir para *
              </label>
              <select
                required
                value={formData.assignedTo}
                onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              >
                <option value="">Selecionar usuário</option>
                  {Array.isArray(users) ? users.map(user => (
                  <option key={user.id} value={user.id}>
                      {user.name}
                  </option>
                  )) : null}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data de Início
              </label>
              <input
                type="date"
                required
                value={getInputDateValue(formData.startDate)}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
            </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                Data de Entrega
                </label>
                <input
                  type="date"
                required
                value={getInputDateValue(formData.dueDate)}
                onChange={(e) => {
                  setFormData({ ...formData, dueDate: e.target.value });
                }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>

            <div className="md:col-span-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tarefa Vinculada
                </label>
                <select
                  value={formData.parentTaskId}
                  onChange={(e) => setFormData({ ...formData, parentTaskId: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                >
                  <option value="">Nenhuma</option>
                {selectedProject && selectedProject.stages ? selectedProject.stages.flatMap((stage: any) => stage.tasks || []).map((task: any) => (
                      <option key={task.id} value={task.id}>{task.title}</option>
                    )) : null}
                </select>
              </div>
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="requiresApproval"
              checked={formData.requiresApproval}
              onChange={(e) => setFormData({ ...formData, requiresApproval: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="requiresApproval" className="text-sm text-gray-700">
              Esta tarefa requer aprovação antes de ser marcada como concluída
            </label>
          </div>

          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
                {editingTask ? 'Salvar Alterações' : 'Criar Tarefa'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
};

export default CreateTaskModal;