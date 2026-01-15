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
  allowCreateProject?: boolean;
  onCreateProject?: (projectData: any) => Promise<Project | null>;
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
  editingTask,
  allowCreateProject = false,
  onCreateProject
}) => {
  const { user } = useAuth();
  const { addNotification } = useNotificationsContext();
  const { isLoading } = useProjectsContext();
  
  // Chave para sessionStorage
  const STORAGE_KEY = 'createTaskModal_formData';
  const STORAGE_KEY_NEW_PROJECT = 'createTaskModal_newProjectData';
  const STORAGE_KEY_CREATE_NEW_PROJECT = 'createTaskModal_createNewProject';
  
  // Função para carregar estado inicial do sessionStorage
  const loadInitialState = () => {
    try {
      const savedFormData = sessionStorage.getItem(STORAGE_KEY);
      if (savedFormData) {
        return JSON.parse(savedFormData);
      }
    } catch (error) {
      // Ignorar erros
    }
    return {
      title: '',
      description: '',
      priority: 'medium',
      assignedTo: [],
      projectId: '',
      stageId: '',
      dueDate: '',
      startDate: '',
      parentTaskId: '',
      requiresApproval: false
    };
  };
  
  const loadInitialNewProjectData = () => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY_NEW_PROJECT);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      // Ignorar erros
    }
    return {
      name: '',
      description: '',
      status: 'planning' as const,
      priority: 'medium' as const
    };
  };
  
  const loadInitialCreateNewProject = () => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY_CREATE_NEW_PROJECT);
      if (saved !== null) {
        return JSON.parse(saved);
      }
    } catch (error) {
      // Ignorar erros
    }
    return false;
  };
  
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    assignedTo: string | string[];
    projectId: string;
    stageId: string;
    dueDate: string;
    startDate: string;
    parentTaskId: string;
    requiresApproval: boolean;
  }>(loadInitialState());
  const [error, setError] = useState<string | null>(null);
  const [createNewProject, setCreateNewProject] = useState(loadInitialCreateNewProject);
  const [newProjectData, setNewProjectData] = useState(loadInitialNewProjectData);

  const selectedProject = Array.isArray(projects) && formData.projectId ? projects.find(p => p.id === formData.projectId) : undefined;
  
  // Ref para rastrear se o modal já foi inicializado nesta sessão
  const initializedRef = React.useRef(false);
  const previousIsOpenRef = React.useRef(false);
  const hasRestoredRef = React.useRef(false); // Ref para garantir que só restaure uma vez

  // Salvar estado no sessionStorage sempre que mudar (mesmo sem initializedRef para garantir persistência)
  React.useEffect(() => {
    if (isOpen) {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
        sessionStorage.setItem(STORAGE_KEY_NEW_PROJECT, JSON.stringify(newProjectData));
        sessionStorage.setItem(STORAGE_KEY_CREATE_NEW_PROJECT, JSON.stringify(createNewProject));
      } catch (error) {
        // Ignorar erros de storage (pode estar desabilitado)
        console.warn('Erro ao salvar estado do formulário:', error);
      }
    }
  }, [formData, newProjectData, createNewProject, isOpen]);

  React.useEffect(() => {
    // Só inicializar quando o modal é aberto pela primeira vez (transição de false para true)
    const isOpening = !previousIsOpenRef.current && isOpen;
    previousIsOpenRef.current = isOpen;
    
    if (editingTask && isOpen && isOpening) {
      // Converter assignedTo para array se necessário
      let assignedToArray: string[] = [];
      if (Array.isArray(editingTask.assignedTo)) {
        assignedToArray = editingTask.assignedTo.filter(id => id && id !== '');
      } else if (editingTask.assignedTo && editingTask.assignedTo !== '') {
        assignedToArray = [editingTask.assignedTo];
      }
      
      // Se tiver assignedToUsers, usar os IDs de lá
      if (editingTask.assignedToUsers && editingTask.assignedToUsers.length > 0) {
        assignedToArray = editingTask.assignedToUsers.map(u => u.id);
      }
      
      setFormData({
        title: editingTask.title,
        description: editingTask.description,
        priority: editingTask.priority,
        assignedTo: assignedToArray,
        projectId: (editingTask as any).projectId || '',
        stageId: (editingTask as any).stageId || '',
        dueDate: editingTask.dueDate ? new Date(editingTask.dueDate).toISOString().slice(0, 10) : '',
        startDate: editingTask.startDate ? new Date(editingTask.startDate).toISOString().slice(0, 10) : '',
        parentTaskId: editingTask.parentTaskId || '',
        requiresApproval: editingTask.requiresApproval
      });
      initializedRef.current = true;
    } else if (isOpen && !editingTask) {
      // SEMPRE tentar restaurar do sessionStorage quando o modal está aberto
      // Isso garante que mesmo se o componente for remontado ao trocar de aba, os dados serão preservados
      // Mas só restaurar se ainda não foi restaurado nesta sessão de abertura
      if (!hasRestoredRef.current) {
        try {
          const savedFormData = sessionStorage.getItem(STORAGE_KEY);
          const savedNewProjectData = sessionStorage.getItem(STORAGE_KEY_NEW_PROJECT);
          const savedCreateNewProject = sessionStorage.getItem(STORAGE_KEY_CREATE_NEW_PROJECT);
          
          // Se houver dados salvos, SEMPRE restaurar
          if (savedFormData) {
            const parsed = JSON.parse(savedFormData);
            setFormData(parsed);
            hasRestoredRef.current = true;
          } else if (isOpening) {
            // Só resetar se não houver dados salvos E for a primeira abertura
            setFormData({
              title: '',
              description: '',
              priority: 'medium',
              assignedTo: [],
              projectId: '',
              stageId: '',
              dueDate: '',
              startDate: '',
              parentTaskId: '',
              requiresApproval: false
            });
            hasRestoredRef.current = true;
          }
          
          if (savedNewProjectData) {
            const parsed = JSON.parse(savedNewProjectData);
            setNewProjectData(parsed);
          } else if (isOpening) {
            setNewProjectData({
              name: '',
              description: '',
              status: 'planning',
              priority: 'medium'
            });
          }
          
          if (savedCreateNewProject !== null) {
            const parsed = JSON.parse(savedCreateNewProject);
            setCreateNewProject(parsed);
          } else if (isOpening) {
            setCreateNewProject(false);
          }
        } catch (error) {
          // Se houver erro ao restaurar e for a primeira abertura, resetar normalmente
          if (isOpening) {
            setFormData({
              title: '',
              description: '',
              priority: 'medium',
              assignedTo: [],
              projectId: '',
              stageId: '',
              dueDate: '',
              startDate: '',
              parentTaskId: '',
              requiresApproval: false
            });
            setCreateNewProject(false);
            setNewProjectData({
              name: '',
              description: '',
              status: 'planning',
              priority: 'medium'
            });
            hasRestoredRef.current = true;
          }
        }
      }
      initializedRef.current = true;
    } else if (!isOpen) {
      // Quando o modal fecha, limpar sessionStorage e resetar flags
      try {
        sessionStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(STORAGE_KEY_NEW_PROJECT);
        sessionStorage.removeItem(STORAGE_KEY_CREATE_NEW_PROJECT);
      } catch (error) {
        // Ignorar erros
      }
      initializedRef.current = false;
      hasRestoredRef.current = false; // Resetar flag de restauração
    }
  }, [editingTask, isOpen]);

  // Função para limpar sessionStorage
  const clearFormStorage = React.useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY_NEW_PROJECT);
      sessionStorage.removeItem(STORAGE_KEY_CREATE_NEW_PROJECT);
    } catch (error) {
      // Ignorar erros
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let finalProjectId = formData.projectId;
    let finalStageId = formData.stageId;
    
    // Se está criando novo projeto, criar primeiro
    if (createNewProject && allowCreateProject && onCreateProject) {
      if (!newProjectData.name.trim()) {
        setError('Por favor, preencha o nome do projeto.');
        return;
      }
      
      // Criar projeto com uma etapa padrão
      const projectData = {
        ...newProjectData,
        stages: [{
          name: 'Etapa Inicial',
          description: 'Etapa inicial do projeto',
          order: 0,
          requiresApproval: false,
          tasks: []
        }]
      };
      
      const newProject = await onCreateProject(projectData);
      if (!newProject) {
        setError('Erro ao criar projeto. Tente novamente.');
        return;
      }
      
      // Usar a primeira etapa do projeto criado
      finalProjectId = newProject.id;
      
      // Verificar se o projeto tem stages
      if (newProject.stages && newProject.stages.length > 0) {
        finalStageId = newProject.stages[0].id;
      } else {
        setError('Erro ao obter etapa do projeto criado. O projeto foi criado mas a etapa não foi encontrada.');
        return;
      }
      
      if (!finalStageId) {
        setError('Erro ao obter etapa do projeto criado.');
        return;
      }
    }
    
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
    
    if (!finalProjectId || !finalStageId) {
      setError('Por favor, selecione um projeto e uma etapa.');
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
    onCreateTask(finalProjectId, finalStageId, taskData);
    // Notificação para todos os usuários designados (se não forem o próprio criador)
    const assigneeIds = Array.isArray(taskData.assignedTo) 
      ? taskData.assignedTo.filter(id => id && id !== '')
      : (taskData.assignedTo && taskData.assignedTo !== '' ? [taskData.assignedTo] : []);
    
    for (const assigneeId of assigneeIds) {
      if (assigneeId !== user?.id) {
      await addNotification({
        type: 'task_assigned',
        title: 'Nova tarefa atribuída',
        message: `Você recebeu a tarefa "${taskData.title}"`,
        taskId: taskData.id,
        projectName: '',
        priority: taskData.priority || 'medium',
        read: false
        }, assigneeId);
      }
    }
    // Limpar sessionStorage após sucesso
    clearFormStorage();
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] h-full sm:h-auto flex flex-col overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 sm:p-6 rounded-t-2xl z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">{editingTask ? 'Editar Tarefa' : 'Criar Nova Tarefa'}</h2>
            <button
              onClick={() => { setError(null); clearFormStorage(); onClose(); }}
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
          {allowCreateProject && !editingTask && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="createNewProject"
                  checked={createNewProject}
                  onChange={(e) => {
                    setCreateNewProject(e.target.checked);
                    if (e.target.checked) {
                      setFormData({ ...formData, projectId: '', stageId: '' });
                    }
                  }}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="createNewProject" className="text-sm font-medium text-gray-700">
                  Criar novo projeto
                </label>
              </div>
            </div>
          )}
          
          {createNewProject && allowCreateProject && !editingTask ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Projeto *
                </label>
                <input
                  type="text"
                  required
                  value={newProjectData.name}
                  onChange={(e) => setNewProjectData({ ...newProjectData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="Digite o nome do projeto"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descrição do Projeto
                </label>
                <input
                  type="text"
                  value={newProjectData.description}
                  onChange={(e) => setNewProjectData({ ...newProjectData, description: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="Descrição do projeto"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status Inicial
                </label>
                <select
                  value={newProjectData.status}
                  onChange={(e) => setNewProjectData({ ...newProjectData, status: e.target.value as any })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                >
                  <option value="planning">Planejamento</option>
                  <option value="in-progress">Em Andamento</option>
                  <option value="on-hold">Pausado</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prioridade
                </label>
                <select
                  value={newProjectData.priority}
                  onChange={(e) => setNewProjectData({ ...newProjectData, priority: e.target.value as any })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                >
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                  <option value="critical">Crítica</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Projeto *
                </label>
                <select
                  required={!createNewProject}
                  value={formData.projectId}
                  onChange={(e) => setFormData({ ...formData, projectId: e.target.value, stageId: '' })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  disabled={createNewProject}
                >
                  <option value="">Selecionar projeto</option>
                    {Array.isArray(projects) ? projects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                    )) : null}
                </select>
              </div>
              
              {!createNewProject && (
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
              )}
            </div>
          )}

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

          <div className="space-y-4">
            {/* Primeira linha: Prioridade e Atribuir para */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  Atribuir para
                </label>
                
                {/* Chips dos usuários selecionados */}
                {Array.isArray(formData.assignedTo) && formData.assignedTo.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {formData.assignedTo.map((userId) => {
                      const user = users.find(u => u.id === userId);
                      if (!user) return null;
                      return (
                        <span
                          key={userId}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                        >
                          {user.name}
                          <button
                            type="button"
                            onClick={() => {
                              const assignedToArray = Array.isArray(formData.assignedTo) 
                                ? formData.assignedTo 
                                : (formData.assignedTo ? [formData.assignedTo] : []);
                              const newAssignees = assignedToArray.filter((id: string) => id !== userId);
                              setFormData({ ...formData, assignedTo: newAssignees });
                            }}
                            className="ml-1 text-blue-600 hover:text-blue-800 font-bold"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                
                {/* Select para adicionar usuário */}
                <div className="flex gap-2">
                <select
                    value=""
                    onChange={(e) => {
                      const selectedUserId = e.target.value;
                      if (selectedUserId && !formData.assignedTo.includes(selectedUserId)) {
                        const currentAssignees = Array.isArray(formData.assignedTo) ? formData.assignedTo : [];
                        setFormData({ ...formData, assignedTo: [...currentAssignees, selectedUserId] });
                      }
                      e.target.value = ''; // Reset select
                    }}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                >
                    <option value="">Selecionar usuário...</option>
                    {Array.isArray(users) ? users
                      .filter(user => !formData.assignedTo.includes(user.id))
                      .map(user => (
                    <option key={user.id} value={user.id}>
                        {user.name}
                    </option>
                    )) : null}
                </select>
                </div>
              </div>
            </div>

            {/* Segunda linha: Datas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </div>

            {/* Tarefa Vinculada */}
            <div>
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