import React, { useState } from 'react';
import Sidebar from './Sidebar';
import SettingsView from './SettingsView';
import CommentsView from './CommentsView';
import FlowView from './FlowView';
import { useAuth } from '../contexts/AuthContext';

interface MainLayoutProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  children: React.ReactNode;
  onUserClick?: () => void;
  onOpenTask?: (taskId: string) => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({ activeTab, setActiveTab, children, onUserClick, onOpenTask }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        onUserClick={onUserClick}
        onOpenTask={onOpenTask}
      />
      <main className="flex-1 p-6 lg:p-10 transition-all duration-300 overflow-x-hidden">
        {activeTab === 'settings' && user?.roles?.includes('admin') ? (
          <SettingsView />
        ) : activeTab === 'comments' ? (
          <CommentsView />
        ) : activeTab === 'flow' ? (
          <FlowView />
        ) : (
          children
        )}
      </main>
    </div>
  );
};

export default MainLayout; 