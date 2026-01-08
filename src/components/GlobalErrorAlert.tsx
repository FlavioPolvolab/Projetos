import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useProjectsContext } from '../contexts/ProjectsContext';
import { X } from 'lucide-react';

const GlobalErrorAlert: React.FC = () => {
  const { authError } = useAuth();
  const { projectsError } = useProjectsContext();
  const [visible, setVisible] = useState(true);

  // Sempre que mudar o erro, mostrar novamente
  useEffect(() => {
    if (authError || projectsError) setVisible(true);
  }, [authError, projectsError]);

  if (!(authError || projectsError) || !visible) return null;

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-100 border border-red-400 text-red-700 px-6 py-3 rounded shadow-lg flex items-center gap-3 min-w-[320px] max-w-[90vw]">
      <span className="flex-1 font-medium">
        {authError || projectsError}
      </span>
      <button onClick={() => setVisible(false)} className="ml-2 text-red-700 hover:text-red-900">
        <X className="w-5 h-5" />
      </button>
    </div>
  );
};

export default GlobalErrorAlert; 