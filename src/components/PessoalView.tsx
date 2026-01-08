import React, { useEffect, useState } from 'react';
import { useProjectsContext } from '../contexts/ProjectsContext';
import { AlertTriangle } from 'lucide-react';
import { User } from '../types';

interface PessoalViewProps {
  setActiveTab: (tab: string) => void;
  setUserFilter: (userId: string) => void;
}

const PessoalView: React.FC<PessoalViewProps> = ({ setActiveTab, setUserFilter }) => {
  const { projects, getAllUsers } = useProjectsContext();
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    getAllUsers().then(setUsers);
  }, [getAllUsers]);

  // Montar lista de usuários com tarefas
  const userTaskMap: Record<string, { id: string; name: string; tarefas: any[] }> = {};
  projects.forEach(project => {
    project.stages.forEach(stage => {
      stage.tasks.forEach(task => {
        if (task.assignedTo) {
          const user = users.find(u => u.id === task.assignedTo);
          if (!user) return;
          if (!userTaskMap[user.id]) {
            userTaskMap[user.id] = { id: user.id, name: user.name, tarefas: [] };
          }
          userTaskMap[user.id].tarefas.push(task);
        }
      });
    });
  });
  const usersWithTasks = Object.values(userTaskMap);

  if (usersWithTasks.length === 0) {
    return <div className="p-8 text-center text-gray-500">Nenhum usuário com tarefas atribuídas.</div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold mb-8">Pessoal</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {usersWithTasks.map(user => {
          const overdueTasks = user.tarefas.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed');
          return (
            <div key={user.name} className="bg-white rounded-xl shadow border p-6 flex flex-col items-center justify-center">
              <button
                className="text-lg font-semibold text-gray-800 mb-2 hover:underline hover:text-blue-700 focus:outline-none"
                onClick={() => {
                  setUserFilter(user.id);
                  setActiveTab('tasks');
                }}
              >
                {user.name}
              </button>
              <div className="text-4xl font-bold text-blue-600 mb-2">{user.tarefas.length}</div>
              <div className="text-sm text-gray-500 mb-2">Tarefas atribuídas</div>
              {overdueTasks.length > 0 && (
                <div className="flex items-center gap-2 text-red-600 font-semibold mt-2">
                  <AlertTriangle className="w-5 h-5" /> {overdueTasks.length} tarefa(s) atrasada(s)!
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PessoalView; 