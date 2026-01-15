import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProjectsProvider } from './contexts/ProjectsContext';
import { NotificationsProvider } from './contexts/NotificationsContext';
import LoginForm from './components/LoginForm';
import MainLayout from './components/MainLayout';
import Dashboard from './components/Dashboard';
import TasksView from './components/TasksView';
import ProjectsView from './components/ProjectsView';
import ApprovalsView from './components/ApprovalsView';
import PessoalView from './components/PessoalView';
import Sidebar from './components/Sidebar';
import { supabase } from './lib/supabase';
import ResetPassword from './components/ResetPassword';
import ErrorBoundary from './components/ErrorBoundary';
import TaskDetailsModal from './components/TaskDetailsModal';
import { useProjectsContext } from './contexts/ProjectsContext';
import DivulgacaoView from './components/DivulgacaoView';
import { ConnectionStatus } from './components/ConnectionStatus';

const AppContent: React.FC = () => {
  const { user, isLoading, authError } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [showUserModal, setShowUserModal] = useState(false);
  const [showTaskDetailsModal, setShowTaskDetailsModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const { getUserTasks, getAllUsers, getUserProjects } = useProjectsContext();
  const [users, setUsers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);

  // Cache para evitar chamadas desnecessárias
  const usersFetchedRef = React.useRef(false);
  const projectsFetchedRef = React.useRef(false);
  
  React.useEffect(() => {
    if (user && !usersFetchedRef.current) {
      usersFetchedRef.current = true;
      getAllUsers().then(setUsers);
    } else if (!user) {
      usersFetchedRef.current = false;
      setUsers([]);
    }
  }, [user, getAllUsers]);

  React.useEffect(() => {
    if (user) {
      // getUserProjects é uma função síncrona que retorna do estado, não precisa de cache
      // Mas vamos evitar chamadas desnecessárias durante re-renders
      const currentProjects = getUserProjects();
      if (currentProjects.length > 0 || !projectsFetchedRef.current) {
        setProjects(currentProjects);
        projectsFetchedRef.current = true;
      }
    } else {
      projectsFetchedRef.current = false;
      setProjects([]);
    }
  }, [user, getUserProjects]);

  const handleOpenTask = (taskId: string) => {
    setActiveTab('tasks');
    // Aguarda renderização da aba
    setTimeout(() => {
      const tasks = getUserTasks();
      const task = tasks.find((t: any) => t.id === taskId);
      if (task) {
        setSelectedTask(task);
        setShowTaskDetailsModal(true);
      }
    }, 100);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        {authError && (
          <div className="text-red-600 text-center mb-4 bg-red-50 border border-red-200 rounded-lg p-3 max-w-md mx-auto mt-12">
            {authError}
          </div>
        )}
        <LoginForm />
      </>
    );
  }

  // Se a URL for /reset-password, renderiza o componente de redefinição
  if (typeof window !== 'undefined' && window.location.pathname === '/reset-password') {
    return <ResetPassword />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'tasks':
        return <TasksView initialUserFilter={userFilter} />;
      case 'projects':
        return <ProjectsView />;
      case 'divulgacao':
        return <DivulgacaoView />;
      case 'pessoal':
        return <PessoalView setActiveTab={setActiveTab} setUserFilter={setUserFilter} />;
      case 'approvals':
        return <ApprovalsView />;
      case 'settings':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Configurações</h2>
            <p className="text-gray-600">Esta seção está em desenvolvimento.</p>
          </div>
        );
      default:
        return <Dashboard />;
    }
  };

  return (
    <ErrorBoundary>
      <ConnectionStatus />
      <MainLayout activeTab={activeTab} setActiveTab={setActiveTab} onUserClick={() => setShowUserModal(true)} onOpenTask={handleOpenTask}>
          {renderContent()}
    </MainLayout>
      {/* Modal de usuário global */}
      {showUserModal && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-sm relative">
            <button onClick={() => setShowUserModal(false)} className="absolute top-3 right-3 text-gray-400 hover:text-gray-700">
              <span style={{fontSize: 24, fontWeight: 'bold'}}>&times;</span>
            </button>
            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                <span className="text-blue-600 font-bold text-2xl">
                  {user.name.split(' ').map(n => n[0]).join('')}
                </span>
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">{user.name}</h2>
              <p className="text-sm text-gray-600 mb-2">{user.email}</p>
            </div>
            <button
              onClick={async () => {
                const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
                  redirectTo: window.location.origin + '/reset-password'
                });
                if (error) {
                  alert('Erro ao enviar e-mail de redefinição: ' + error.message);
                } else {
                  alert('Um e-mail de redefinição de senha foi enviado para seu endereço.');
                }
              }}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Trocar senha
            </button>
          </div>
        </div>
      )}
      {/* Modal global de detalhes da tarefa */}
      {showTaskDetailsModal && selectedTask && (
        <TaskDetailsModal
          isOpen={showTaskDetailsModal}
          onClose={() => { setShowTaskDetailsModal(false); setSelectedTask(null); }}
          task={selectedTask}
          users={users}
          project={projects.find((p: any) => p.name === selectedTask.projectName) || undefined}
        />
      )}
    </ErrorBoundary>
  );
};

const App: React.FC = () => (
  <AuthProvider>
    <ProjectsProvider>
      <NotificationsProvider>
        <AppContent />
      </NotificationsProvider>
    </ProjectsProvider>
  </AuthProvider>
);

export default App;