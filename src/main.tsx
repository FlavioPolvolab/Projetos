import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Removida a lógica de limpeza automática de cache que estava causando loops infinitos
// O Supabase gerencia automaticamente os tokens e sessões
// Se necessário limpar cache manualmente, o usuário pode fazer isso pelo navegador

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
