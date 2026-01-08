import React, { createContext, useContext } from 'react';
import { useNotifications } from '../hooks/useNotifications';

export const NotificationsContext = createContext<ReturnType<typeof useNotifications> | undefined>(undefined);

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const notificationsHook = useNotifications();
  return (
    <NotificationsContext.Provider value={notificationsHook}>
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotificationsContext = () => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotificationsContext deve ser usado dentro de NotificationsProvider');
  return ctx;
}; 