import React, { createContext, useContext } from 'react';
import { useProjects } from '../hooks/useProjects';

export const ProjectsContext = createContext<ReturnType<typeof useProjects> | undefined>(undefined);

export const ProjectsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const projectsHook = useProjects();
  return (
    <ProjectsContext.Provider value={projectsHook}>
      {children}
    </ProjectsContext.Provider>
  );
};

export const useProjectsContext = () => {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error('useProjectsContext deve ser usado dentro de ProjectsProvider');
  return ctx;
}; 