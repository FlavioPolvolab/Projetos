import React, { useEffect, useState } from 'react';
import { getConnectionStatus } from '../lib/supabaseConnection';
import { AlertCircle, Wifi, WifiOff } from 'lucide-react';

export const ConnectionStatus: React.FC = () => {
  const [status, setStatus] = useState(getConnectionStatus());
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const currentStatus = getConnectionStatus();
      setStatus(currentStatus);
      
      // Mostrar notificação se houver problemas de conexão
      if (!currentStatus.isConnected || currentStatus.consecutiveFailures >= 2) {
        setIsVisible(true);
      } else if (currentStatus.isConnected && currentStatus.consecutiveFailures === 0) {
        // Esconder após alguns segundos se reconectou
        setTimeout(() => setIsVisible(false), 3000);
      }
    }, 2000); // Verificar a cada 2 segundos

    return () => clearInterval(interval);
  }, []);

  if (!isVisible || (status.isConnected && status.consecutiveFailures === 0)) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-5">
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg ${
          !status.isConnected
            ? 'bg-red-50 border border-red-200 text-red-800'
            : status.consecutiveFailures >= 2
            ? 'bg-yellow-50 border border-yellow-200 text-yellow-800'
            : 'bg-green-50 border border-green-200 text-green-800'
        }`}
      >
        {!status.isConnected ? (
          <>
            <WifiOff className="w-5 h-5" />
            <div>
              <p className="font-semibold text-sm">Sem conexão</p>
              <p className="text-xs">Tentando reconectar...</p>
            </div>
          </>
        ) : status.consecutiveFailures >= 2 ? (
          <>
            <AlertCircle className="w-5 h-5" />
            <div>
              <p className="font-semibold text-sm">Conexão instável</p>
              <p className="text-xs">Algumas operações podem falhar</p>
            </div>
          </>
        ) : (
          <>
            <Wifi className="w-5 h-5" />
            <div>
              <p className="font-semibold text-sm">Conexão restaurada</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
