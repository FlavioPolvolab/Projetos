import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  FolderOpen, 
  CheckSquare, 
  Users, 
  Settings,
  LogOut,
  Menu,
  X,
  MessageCircle,
  TrendingUp
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import NotificationCenter from './NotificationCenter';
import { supabase } from '../lib/supabase';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  onUserClick?: () => void;
  onOpenTask?: (taskId: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  isCollapsed, 
  setIsCollapsed,
  onUserClick,
  onOpenTask
}) => {
  const { user, logout } = useAuth();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'projects', label: 'Projetos', icon: FolderOpen },
    { id: 'tasks', label: 'Minhas Tarefas', icon: CheckSquare },
    { id: 'flow', label: 'Flow', icon: TrendingUp },
    { id: 'divulgacao', label: 'Divulgação', icon: TrendingUp },
    { id: 'comments', label: 'Comentários', icon: MessageCircle },
    // Aba Pessoal para managers e admins
    ...(user?.roles.includes('admin') || user?.roles.includes('manager')
      ? [{ id: 'pessoal', label: 'Pessoal', icon: Users }]
      : []),
    // Only show approvals for admin and aprovador roles
    ...(user?.roles.includes('admin') || user?.roles.includes('aprovador') 
      ? [{ id: 'approvals', label: 'Aprovações', icon: Users }] 
      : []),
    // Exibir Configurações apenas para admin
    ...(user?.roles.includes('admin')
      ? [{ id: 'settings', label: 'Configurações', icon: Settings }]
      : [])
  ];

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'manager': return 'Gerente';
      case 'user': return 'Usuário';
      case 'aprovador': return 'Aprovador';
      default: return role;
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {!isCollapsed && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsCollapsed(true)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50 
        ${isCollapsed ? '-translate-x-full lg:translate-x-0' : 'translate-x-0'}
        ${isCollapsed ? 'lg:w-20' : 'w-64'} 
        bg-white border-r border-gray-200 transition-all duration-300 ease-in-out
        flex flex-col
      `}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {!isCollapsed && (
              <h1 className="text-xl font-bold text-gray-800">Projetos</h1>
            )}
            <div className="flex items-center space-x-2">
              {!isCollapsed && <NotificationCenter onOpenTask={onOpenTask} />}
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {isCollapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* User Info */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={onUserClick}>
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-semibold text-sm">
                {user?.name.split(' ').map(n => n[0]).join('')}
              </span>
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.name}
                </p>
                <p className="text-xs text-gray-500">
                  {user?.roles ? getRoleLabel(user.roles.join(', ')) : ''}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 p-4 space-y-2 flex flex-col">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`
                  w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200
                  ${isActive 
                    ? 'bg-blue-50 text-blue-600 border-r-2 border-blue-600' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                  ${isCollapsed ? 'justify-center' : ''}
                `}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && (
                  <span className="font-medium">{item.label}</span>
                )}
              </button>
            );
          })}
          <div className="mt-auto pt-4 border-t border-gray-200">
          <button
            onClick={logout}
            className={`
              w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg 
              text-red-600 hover:bg-red-50 transition-colors
              ${isCollapsed ? 'justify-center' : ''}
            `}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!isCollapsed && <span className="font-medium">Sair</span>}
          </button>
        </div>
        </nav>
      </div>
    </>
  );
};

export default Sidebar;