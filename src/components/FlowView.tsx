import React, { useEffect, useState } from 'react';
import { Plus, CheckCircle, Circle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useNotificationsContext } from '../contexts/NotificationsContext';
import { Trash2, Edit } from 'lucide-react';
import { format, isBefore, isAfter, isWithinInterval, startOfWeek, endOfWeek, parseISO } from 'date-fns';

interface FlowTask {
  id: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  start_date?: string | null;
  due_date?: string | null;
  is_priority?: boolean;
}

const statusOptions = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'completed', label: 'Concluídas' },
  { value: 'priority', label: 'Prioritária' }
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'completed':
      return <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-semibold">Concluída</span>;
    case 'pending':
      return <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs font-semibold">Pendente</span>;
    default:
      return <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-semibold">{status}</span>;
  }
};

const getDateBadge = (date?: string | null) => {
  if (!date) return null;
  return <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-medium">{format(parseISO(date), 'dd/MM/yyyy')}</span>;
};

const FlowView: React.FC = () => {
  const { user } = useAuth();
  const { addNotification } = useNotificationsContext();
  const [tasks, setTasks] = useState<FlowTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<FlowTask | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilterStart, setDateFilterStart] = useState('');
  const [dateFilterEnd, setDateFilterEnd] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isPriority, setIsPriority] = useState(false);

  const fetchTasks = async () => {
    setLoading(true);
    let query = supabase
      .from('flow_tasks')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });
    const { data, error } = await query;
    if (!error) setTasks(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (user?.id) fetchTasks();
  }, [user?.id]);

  // Filtro de busca por título ou descrição
  const filteredTasks = tasks.filter(task => {
    const matchesSearch =
      !searchTerm ||
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (task.description && task.description.toLowerCase().includes(searchTerm.toLowerCase()));
    let matchesStatus = true;
    if (statusFilter === 'priority') {
      matchesStatus = !!task.is_priority;
    } else {
      matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    }
    const matchesStart = !dateFilterStart || (task.start_date && task.start_date >= dateFilterStart);
    const matchesEnd = !dateFilterEnd || (task.due_date && task.due_date <= dateFilterEnd);
    return matchesSearch && matchesStatus && matchesStart && matchesEnd;
  });

  // Contadores
  const totalTasks = filteredTasks.length;
  const completedTasks = filteredTasks.filter(t => t.status === 'completed').length;
  const pendingTasks = filteredTasks.filter(t => t.status !== 'completed').length;

  // Agrupamento de tarefas
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

  // Antes de filtrar e agrupar, ordenar as tarefas por due_date crescente (tarefas sem due_date vão para o final)
  const orderedTasks = [...filteredTasks].sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });
  // Usar orderedTasks no lugar de filteredTasks para os agrupamentos
  const atrasadas = orderedTasks.filter(t => t.due_date && isBefore(parseISO(t.due_date), today) && t.status !== 'completed');
  const semana = orderedTasks.filter(t => t.due_date && isWithinInterval(parseISO(t.due_date), { start: weekStart, end: weekEnd }) && !atrasadas.includes(t) && t.status !== 'completed');
  const outras = orderedTasks.filter(t => !atrasadas.includes(t) && !semana.includes(t) && t.status !== 'completed');
  const concluidas = orderedTasks.filter(t => t.status === 'completed');

  // CRUD
  const handleCreateOrEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    if (editingTask) {
      // Editar
      await supabase.from('flow_tasks').update({
        title: newTitle,
        description: newDesc,
        start_date: newStartDate || null,
        due_date: newDueDate || null,
        is_priority: isPriority
      }).eq('id', editingTask.id);
      await addNotification({
        type: 'task_assigned',
        title: 'Tarefa editada',
        message: `A tarefa "${newTitle}" foi editada!`,
        priority: 'medium',
        read: false
      });
    } else {
      // Criar
      const { data, error } = await supabase.from('flow_tasks').insert({
        user_id: user?.id,
        title: newTitle,
        description: newDesc,
        status: 'pending',
        start_date: newStartDate || null,
        due_date: newDueDate || null,
        is_priority: isPriority
      }).select().single();
      if (!error && data) {
        await addNotification({
          type: 'task_assigned',
          title: 'Nova tarefa criada',
          message: `A tarefa "${newTitle}" foi criada!`,
          priority: 'medium',
          read: false
        });
      }
    }
    setShowModal(false);
    setEditingTask(null);
    setNewTitle('');
    setNewDesc('');
    setNewStartDate('');
    setNewDueDate('');
    setIsPriority(false);
    fetchTasks();
  };

  const handleEdit = (task: FlowTask) => {
    setEditingTask(task);
    setNewTitle(task.title);
    setNewDesc(task.description);
    setNewStartDate(task.start_date ? task.start_date.slice(0, 10) : '');
    setNewDueDate(task.due_date ? task.due_date.slice(0, 10) : '');
    setIsPriority(!!task.is_priority);
    setShowModal(true);
  };

  const handleDelete = async (task: FlowTask) => {
    if (!window.confirm('Tem certeza que deseja excluir esta tarefa?')) return;
    await supabase.from('flow_tasks').delete().eq('id', task.id);
    await addNotification({
      type: 'task_assigned',
      title: 'Tarefa excluída',
      message: `A tarefa "${task.title}" foi excluída!`,
      priority: 'medium',
      read: false
    });
    fetchTasks();
  };

  const toggleComplete = async (task: FlowTask) => {
    const isCompleted = task.status === 'completed';
    await supabase.from('flow_tasks').update({
      status: isCompleted ? 'pending' : 'completed',
      completed_at: isCompleted ? null : new Date().toISOString()
    }).eq('id', task.id);
    await addNotification({
      type: 'task_assigned',
      title: isCompleted ? 'Tarefa reaberta' : 'Tarefa concluída',
      message: `A tarefa "${task.title}" foi ${isCompleted ? 'reaberta' : 'concluída'}!`,
      priority: isCompleted ? 'medium' : 'high',
      read: false
    });
    fetchTasks();
  };

  // Modal reset
  const handleOpenModal = () => {
    setEditingTask(null);
    setNewTitle('');
    setNewDesc('');
    setNewStartDate('');
    setNewDueDate('');
    setIsPriority(false);
    setShowModal(true);
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb] w-full">
      <div className="max-w-7xl ml-0 px-10 pt-10 pb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
          <div>
            <h2 className="text-3xl font-bold mb-1">Flow - Tarefas Diárias</h2>
            <div className="flex gap-3 mt-2">
              <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded text-sm">Total: {totalTasks}</span>
              <span className="bg-green-100 text-green-800 px-3 py-1 rounded text-sm">Concluídas: {completedTasks}</span>
              <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded text-sm">A fazer: {pendingTasks}</span>
            </div>
          </div>
          <button onClick={handleOpenModal} className="flex items-center px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-base font-semibold shadow">
            <Plus className="w-5 h-5 mr-2" /> Nova Tarefa
          </button>
        </div>
        {/* Filtros + busca juntos, agora abaixo dos contadores */}
        <div className="flex flex-wrap gap-4 mb-6 items-end">
          <div>
            <label className="block text-xs font-semibold mb-1">Buscar</label>
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por título ou descrição..."
              className="border rounded px-3 py-2 min-w-[200px]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded px-2 py-1 min-w-[120px]">
              {statusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Data Inicial</label>
            <input type="date" value={dateFilterStart} onChange={e => setDateFilterStart(e.target.value)} className="border rounded px-2 py-1 min-w-[140px]" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Data Final</label>
            <input type="date" value={dateFilterEnd} onChange={e => setDateFilterEnd(e.target.value)} className="border rounded px-2 py-1 min-w-[140px]" />
          </div>
        </div>
        {/* Agrupamento de tarefas */}
        {atrasadas.length > 0 && (
          <div className="border border-red-200 bg-red-50 rounded-xl mb-6 p-0 shadow-sm overflow-hidden">
            <div className="font-bold text-red-700 px-6 pt-4 pb-2 bg-red-50">Tarefas Atrasadas <span className="font-normal">({atrasadas.length} tarefa(s))</span></div>
            <TaskTable tasks={atrasadas} onEdit={handleEdit} onDelete={handleDelete} onToggle={toggleComplete} />
          </div>
        )}
        {semana.length > 0 && (
          <div className="border border-yellow-200 bg-yellow-50 rounded-xl mb-6 p-0 shadow-sm overflow-hidden">
            <div className="font-bold text-yellow-800 px-6 pt-4 pb-2 bg-yellow-50">Tarefas da Semana <span className="font-normal">({semana.length} tarefa(s))</span></div>
            <TaskTable tasks={semana} onEdit={handleEdit} onDelete={handleDelete} onToggle={toggleComplete} />
          </div>
        )}
        {outras.length > 0 && (
          <div className="border border-gray-200 bg-white rounded-xl mb-6 p-0 shadow-sm overflow-hidden">
            <div className="font-bold text-gray-700 px-6 pt-4 pb-2 bg-gray-50">Outras Tarefas <span className="font-normal">({outras.length} tarefa(s))</span></div>
            <TaskTable tasks={outras} onEdit={handleEdit} onDelete={handleDelete} onToggle={toggleComplete} />
          </div>
        )}
        {concluidas.length > 0 && (
          <>
            <button
              className="mb-2 ml-2 px-3 py-1 rounded bg-green-100 text-green-800 text-sm font-semibold hover:bg-green-200 transition"
              onClick={() => setShowCompleted(v => !v)}
            >
              {showCompleted ? 'Esconder tarefas concluídas' : `Mostrar tarefas concluídas (${concluidas.length})`}
            </button>
            {showCompleted && (
              <div className="border border-green-200 bg-green-50 rounded-xl mb-6 p-0 shadow-sm overflow-hidden">
                <div className="font-bold text-green-800 px-6 pt-4 pb-2 bg-green-50">Tarefas Concluídas <span className="font-normal">({concluidas.length} tarefa(s))</span></div>
                <TaskTable tasks={concluidas} onEdit={handleEdit} onDelete={handleDelete} onToggle={toggleComplete} showComplete />
              </div>
            )}
          </>
        )}
        {/* Modal de criação/edição */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <form onSubmit={handleCreateOrEdit} className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md flex flex-col gap-4 border">
              <h3 className="text-xl font-bold mb-2">{editingTask ? 'Editar Tarefa' : 'Nova Tarefa Diária'}</h3>
              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="Título da tarefa"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <textarea
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="Descrição (opcional)"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[60px]"
              />
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-semibold mb-1">Data Inicial</label>
                  <input type="date" value={newStartDate} onChange={e => setNewStartDate(e.target.value)} className="border rounded px-2 py-1 w-full" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold mb-1">Data Limite</label>
                  <input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} className="border rounded px-2 py-1 w-full" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isPriority" checked={isPriority} onChange={e => setIsPriority(e.target.checked)} />
                <label htmlFor="isPriority" className="text-sm">Tarefa prioritária</label>
              </div>
              <div className="flex gap-2 justify-end mt-2">
                <button type="button" onClick={() => { setShowModal(false); setEditingTask(null); }} className="px-4 py-2 bg-gray-200 rounded-lg">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Salvar</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

// Tabela de tarefas
const TaskTable: React.FC<{ tasks: FlowTask[]; onEdit: (t: FlowTask) => void; onDelete: (t: FlowTask) => void; onToggle: (t: FlowTask) => void; showComplete?: boolean }> = ({ tasks, onEdit, onDelete, onToggle, showComplete }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full bg-transparent">
      <thead>
        <tr className="text-xs text-gray-600 uppercase bg-gray-50">
          <th className="px-6 py-2 text-left">Título / Descrição</th>
          <th className="px-6 py-2 text-left">Status</th>
          <th className="px-6 py-2 text-left">Início</th>
          <th className="px-6 py-2 text-left">Prazo</th>
          <th className="px-6 py-2 text-left">Ações</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map(task => (
          <tr key={task.id} className={showComplete ? 'bg-green-50' : 'bg-white border-b'}>
            <td className="px-6 py-2">
              <div className="flex items-center gap-2">
                <div className="font-medium text-blue-700 hover:underline cursor-pointer" onClick={() => onEdit(task)}>{task.title}</div>
                {task.is_priority && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold ml-1">Prioritária</span>}
              </div>
              {task.description && <div className="text-xs text-gray-500 mt-1">{task.description}</div>}
            </td>
            <td className="px-6 py-2">{getStatusBadge(task.status)}</td>
            <td className="px-6 py-2">{getDateBadge(task.start_date)}</td>
            <td className="px-6 py-2">{getDateBadge(task.due_date)}</td>
            <td className="px-6 py-2 flex gap-2">
              <button onClick={() => onToggle(task)} className={`px-2 py-1 rounded text-xs font-semibold ${task.status === 'completed' ? 'bg-gray-200 text-gray-600' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}>{task.status === 'completed' ? 'Reabrir' : 'Concluir'}</button>
              <button onClick={() => onEdit(task)} className="text-blue-600 hover:underline flex items-center"><Edit className="w-4 h-4 mr-1" />Editar</button>
              <button onClick={() => onDelete(task)} className="text-red-600 hover:underline flex items-center"><Trash2 className="w-4 h-4 mr-1" />Excluir</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default FlowView; 