import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getInputDateValue } from '../lib/formatDate';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (projectData: any) => void;
  users: Array<{ id: string; name: string; email: string; roles: string[] }>;
  editingProject?: Project | null;
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onCreateProject,
  users,
  editingProject
}) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'planning' as const,
    priority: 'medium' as const
  });
  
  const [stages, setStages] = useState([
    { name: '', description: '', requiresApproval: false, tasks: [] }
  ]);

  const [tasksByStage, setTasksByStage] = useState<{ [stageId: string]: Array<{ id: string; title: string }> }>({});

  const [error, setError] = useState<string | null>(null);
  const [taskDateErrors, setTaskDateErrors] = useState<Array<{stageIndex: number, taskIndex: number, field: 'startDate' | 'dueDate'}>>([]);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (editingProject && isOpen) {
      setFormData({
        name: editingProject.name,
        description: editingProject.description,
        status: editingProject.status,
        priority: editingProject.priority || 'medium'
      });
      // Respeitar a ordem original das etapas e tarefas
      setStages(
        editingProject.stages.map(stage => ({
          name: stage.name,
          description: stage.description,
          requiresApproval: stage.requiresApproval,
          tasks: stage.tasks.map(task => ({
            title: task.title,
            description: task.description,
            priority: task.priority,
            assignedTo: task.assignedTo,
            requiresApproval: task.requiresApproval,
            dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '',
            startDate: task.startDate ? new Date(task.startDate).toISOString().slice(0, 10) : '',
            parentTaskId: task.parentTaskId
          }))
        }))
      );
      setIsEditing(false); // Sempre abrir travado
    } else if (isOpen) {
      setFormData({ name: '', description: '', status: 'planning', priority: 'medium' });
      setStages([{ name: '', description: '', requiresApproval: false, tasks: [] }]);
      setIsEditing(true); // Novo projeto já pode editar
    }
  }, [editingProject, isOpen]);

  useEffect(() => {
    if (isOpen && editingProject) {
      // Para cada etapa, buscar as tarefas do banco
      const fetchTasks = async () => {
        const tasksMap: { [stageId: string]: Array<{ id: string; title: string }> } = {};
        for (const stage of editingProject.stages) {
          const { data, error } = await supabase
            .from('tasks')
            .select('id, title')
            .eq('stage_id', stage.id)
            .order('title');
          if (!error && data) {
            tasksMap[stage.id] = data;
          }
        }
        setTasksByStage(tasksMap);
      };
      fetchTasks();
    }
  }, [isOpen, editingProject]);

  const addStage = () => {
    setStages([...stages, { name: '', description: '', requiresApproval: false, tasks: [] }]);
  };

  const removeStage = (index: number) => {
    if (stages.length > 1) {
      setStages(stages.filter((_, i) => i !== index));
    }
  };

  const updateStage = (index: number, field: string, value: any) => {
    const updatedStages = stages.map((stage, i) => 
      i === index ? { ...stage, [field]: value } : stage
    );
    setStages(updatedStages);
  };

  const addTaskToStage = (stageIndex: number) => {
    const updatedStages = stages.map((stage, i) => 
      i === stageIndex 
        ? { 
            ...stage, 
            tasks: [...stage.tasks, {
              title: '',
              description: '',
              priority: 'medium' as const,
              assignedTo: '',
              requiresApproval: false,
              dueDate: '',
              startDate: '',
              parentTaskId: ''
            }]
          }
        : stage
    );
    setStages(updatedStages);
  };

  const removeTaskFromStage = (stageIndex: number, taskIndex: number) => {
    const updatedStages = stages.map((stage, i) => 
      i === stageIndex 
        ? { ...stage, tasks: stage.tasks.filter((_, ti) => ti !== taskIndex) }
        : stage
    );
    setStages(updatedStages);
  };

  const updateTask = (stageIndex: number, taskIndex: number, field: string, value: any) => {
    const updatedStages = stages.map((stage, i) => 
      i === stageIndex 
        ? {
            ...stage,
            tasks: stage.tasks.map((task, ti) => 
              ti === taskIndex ? { ...task, [field]: value } : task
            )
          }
        : stage
    );
    setStages(updatedStages);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Validação: todas as tarefas devem ter data de início e de entrega válidas
    const errors: Array<{stageIndex: number, taskIndex: number, field: 'startDate' | 'dueDate'}> = [];
    for (const [stageIndex, stage] of stages.entries()) {
      for (const [taskIndex, task] of stage.tasks.entries()) {
        if (!task.startDate) {
          errors.push({stageIndex, taskIndex, field: 'startDate'});
        } else {
          const start = new Date(task.startDate);
          if (isNaN(start.getTime())) {
            errors.push({stageIndex, taskIndex, field: 'startDate'});
          }
        }
        if (!task.dueDate) {
          errors.push({stageIndex, taskIndex, field: 'dueDate'});
        } else {
          const end = new Date(task.dueDate);
          if (isNaN(end.getTime())) {
            errors.push({stageIndex, taskIndex, field: 'dueDate'});
          }
        }
        // Validação: data de início não pode ser maior que a de entrega
        if (task.startDate && task.dueDate) {
          const start = new Date(task.startDate);
          const end = new Date(task.dueDate);
          if (start > end) {
            errors.push({stageIndex, taskIndex, field: 'startDate'});
            errors.push({stageIndex, taskIndex, field: 'dueDate'});
            setError('A data de início não pode ser maior que a data de entrega em uma ou mais tarefas.');
          }
        }
      }
    }
    if (errors.length > 0) {
      setTaskDateErrors(errors);
      // Mensagem geral, mas agora pode ser mais curta
      setError('Preencha a data de início e de entrega para todas as tarefas destacadas.');
      return;
    }
    setTaskDateErrors([]);
    setError(null);
    
    const projectData = {
      ...formData,
      stages: stages.map((stage, index) => ({
        ...stage,
        id: editingProject && editingProject.stages[index] ? editingProject.stages[index].id : `stage-${Date.now()}-${index}`,
        order: index + 1,
        tasks: stage.tasks.map((task, taskIndex) => ({
          ...task,
          id:
            editingProject && editingProject.stages[index] && editingProject.stages[index].tasks[taskIndex]
              ? editingProject.stages[index].tasks[taskIndex].id
              : `task-${Date.now()}-${index}-${taskIndex}`,
          status:
            editingProject && editingProject.stages[index] && editingProject.stages[index].tasks[taskIndex]
              ? editingProject.stages[index].tasks[taskIndex].status
              : 'pending',
          createdBy:
            editingProject && editingProject.stages[index] && editingProject.stages[index].tasks[taskIndex]
              ? editingProject.stages[index].tasks[taskIndex].createdBy
              : user?.id || '',
          createdAt:
            editingProject && editingProject.stages[index] && editingProject.stages[index].tasks[taskIndex]
              ? editingProject.stages[index].tasks[taskIndex].createdAt
              : new Date(),
          dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
          startDate: task.startDate ? new Date(task.startDate) : undefined,
          parentTaskId: task.parentTaskId,
          comments:
            editingProject && editingProject.stages[index] && editingProject.stages[index].tasks[taskIndex]
              ? editingProject.stages[index].tasks[taskIndex].comments
              : []
        }))
      })),
      id: editingProject ? editingProject.id : `project-${Date.now()}`,
      createdAt: editingProject ? editingProject.createdAt : new Date(),
      createdBy: editingProject ? editingProject.createdBy : user?.id || ''
    };

    onCreateProject(projectData);
    
    // Reset form
    setFormData({ name: '', description: '', status: 'planning', priority: 'medium' });
    setStages([{ name: '', description: '', requiresApproval: false, tasks: [] }]);
    onClose();
  };

  if (!isOpen) return null;

  // Antes de mapear stages para exibir, ordenar por data de início ou prazo
  const sortedStages = [...stages].sort((a, b) => {
    const aDate = a.startDate ? new Date(a.startDate) : (a.dueDate ? new Date(a.dueDate) : null);
    const bDate = b.startDate ? new Date(b.startDate) : (b.dueDate ? new Date(b.dueDate) : null);
    if (!aDate && !bDate) return 0;
    if (!aDate) return 1;
    if (!bDate) return -1;
    return aDate.getTime() - bDate.getTime();
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] h-full sm:h-auto flex flex-col overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 sm:p-6 rounded-t-2xl z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">{editingProject ? 'Editar Projeto' : 'Criar Novo Projeto'}</h2>
            {editingProject && !isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium mr-4"
              >Editar</button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <form onSubmit={e => { if (editingProject && !isEditing) { e.preventDefault(); return; } handleSubmit(e); }} className="p-4 sm:p-6 space-y-8">
            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded border border-red-300 text-sm font-semibold text-center">
                {error}
              </div>
            )}
          {/* Project Basic Info */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Informações do Projeto</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Projeto *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="Digite o nome do projeto"
                  readOnly={editingProject && !isEditing}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status Inicial
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  disabled={editingProject && !isEditing}
                >
                  <option value="planning">Planejamento</option>
                  <option value="in-progress">Em Andamento</option>
                  <option value="on-hold">Pausado</option>
                </select>
              </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prioridade *
                  </label>
                  <select
                    required
                    value={formData.priority}
                    onChange={e => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    disabled={editingProject && !isEditing}
                  >
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                    <option value="critical">Crítica</option>
                  </select>
                </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descrição *
              </label>
              <textarea
                required
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                placeholder="Descreva o objetivo e escopo do projeto"
                readOnly={editingProject && !isEditing}
              />
            </div>
          </div>

          {/* Stages */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Etapas do Projeto</h3>
              <button
                type="button"
                onClick={addStage}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                disabled={editingProject && !isEditing}
              >
                <Plus className="w-4 h-4" />
                <span>Adicionar Etapa</span>
              </button>
            </div>

            {sortedStages.map((stage, stageIndex) => (
              <div key={stageIndex} className="border border-gray-200 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-md font-semibold text-gray-800">Etapa {stageIndex + 1}</h4>
                  {stages.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeStage(stageIndex)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors"
                      disabled={editingProject && !isEditing}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nome da Etapa *
                    </label>
                    <input
                      type="text"
                      required
                      value={stage.name}
                      onChange={(e) => updateStage(stageIndex, 'name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ex: Desenvolvimento, Testes, Deploy"
                      readOnly={editingProject && !isEditing}
                    />
                  </div>

                  <div className="flex items-center space-x-4 pt-6">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={stage.requiresApproval}
                        onChange={(e) => updateStage(stageIndex, 'requiresApproval', e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        disabled={editingProject && !isEditing}
                      />
                      <span className="text-sm text-gray-700">Requer aprovação</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Descrição da Etapa
                  </label>
                  <textarea
                    rows={2}
                    value={stage.description}
                    onChange={(e) => updateStage(stageIndex, 'description', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Descreva o que será feito nesta etapa"
                    readOnly={editingProject && !isEditing}
                  />
                </div>

                {/* Tasks for this stage */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h5 className="text-sm font-medium text-gray-700">Tarefas da Etapa</h5>
                    <button
                      type="button"
                      onClick={() => addTaskToStage(stageIndex)}
                      className="flex items-center space-x-1 px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                      disabled={editingProject && !isEditing}
                    >
                      <Plus className="w-3 h-3" />
                      <span>Tarefa</span>
                    </button>
                  </div>

                  {stage.tasks.map((task, taskIndex) => (
                    <div key={taskIndex} className="bg-gray-50 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-600">Tarefa {taskIndex + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeTaskFromStage(stageIndex, taskIndex)}
                          className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                          disabled={editingProject && !isEditing}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <input
                            type="text"
                            value={task.title}
                              onChange={e => updateTask(stageIndex, taskIndex, 'title', e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Título da tarefa"
                            readOnly={editingProject && !isEditing}
                          />
                        </div>
                        <div>
                          <select
                            value={task.assignedTo}
                              onChange={e => updateTask(stageIndex, taskIndex, 'assignedTo', e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            disabled={editingProject && !isEditing}
                          >
                              <option value="">Atribuir</option>
                            {users.map(user => (
                                <option key={user.id} value={user.id}>{user.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                        <div className="mt-2">
                        <textarea
                          value={task.description}
                            onChange={e => updateTask(stageIndex, taskIndex, 'description', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Descrição da tarefa"
                            rows={2}
                            readOnly={editingProject && !isEditing}
                        />
                      </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-2">
                        <div>
                          <select
                            value={task.priority}
                              onChange={e => updateTask(stageIndex, taskIndex, 'priority', e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            disabled={editingProject && !isEditing}
                          >
                            <option value="low">Baixa</option>
                            <option value="medium">Média</option>
                            <option value="high">Alta</option>
                            <option value="critical">Crítica</option>
                          </select>
                        </div>
                        <div>
                          <input
                            type="date"
                            value={task.startDate}
                            onChange={e => updateTask(stageIndex, taskIndex, 'startDate', e.target.value)}
                            className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${taskDateErrors.some(err => err.stageIndex === stageIndex && err.taskIndex === taskIndex && err.field === 'startDate') ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                            disabled={editingProject && !isEditing}
                          />
                          {taskDateErrors.some(err => err.stageIndex === stageIndex && err.taskIndex === taskIndex && err.field === 'startDate') && (
                            <div className="text-xs text-red-600 mt-1">Preencha a data de início</div>
                          )}
                        </div>
                          <div>
                            <input
                              type="date"
                              value={task.dueDate}
                              onChange={e => updateTask(stageIndex, taskIndex, 'dueDate', e.target.value)}
                              className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${taskDateErrors.some(err => err.stageIndex === stageIndex && err.taskIndex === taskIndex && err.field === 'dueDate') ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                              disabled={editingProject && !isEditing}
                            />
                            {taskDateErrors.some(err => err.stageIndex === stageIndex && err.taskIndex === taskIndex && err.field === 'dueDate') && (
                              <div className="text-xs text-red-600 mt-1">Preencha a data de entrega</div>
                            )}
                          </div>
                          <div>
                            <select
                              value={task.parentTaskId || ''}
                              onChange={e => updateTask(stageIndex, taskIndex, 'parentTaskId', e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              disabled={editingProject && !isEditing}
                            >
                              <option value="">Vincular tarefa</option>
                              {(tasksByStage[editingProject?.stages[stageIndex]?.id] || [])
                                .filter(t => t.id !== (editingProject?.stages[stageIndex]?.tasks[taskIndex]?.id || task.id))
                                .map(t => (
                                  <option key={t.id} value={t.id}>{t.title}</option>
                                ))}
                            </select>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center">
                          <input
                            type="checkbox"
                            checked={task.requiresApproval}
                            onChange={e => updateTask(stageIndex, taskIndex, 'requiresApproval', e.target.checked)}
                            className="mr-2"
                            disabled={editingProject && !isEditing}
                            />
                            <span className="text-xs text-gray-600">Requer aprovação</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Submit Buttons */}
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
                {editingProject ? 'Salvar Alterações' : 'Criar Projeto'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
};

export default CreateProjectModal;