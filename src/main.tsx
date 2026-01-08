import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Limpeza automática de cache a cada 2 horas
const CACHE_CLEAN_INTERVAL_HOURS = 2;
const LAST_CACHE_CLEAN_KEY = 'last_cache_clean';

function shouldCleanCache() {
  const lastClean = localStorage.getItem(LAST_CACHE_CLEAN_KEY);
  if (!lastClean) return true;
  const lastDate = new Date(lastClean);
  const now = new Date();
  const diffHours = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);
  return diffHours >= CACHE_CLEAN_INTERVAL_HOURS;
}

if (shouldCleanCache()) {
  localStorage.clear();
  sessionStorage.clear();
  // Limpa tokens do Supabase
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('sb-')) localStorage.removeItem(key);
  });
  localStorage.setItem(LAST_CACHE_CLEAN_KEY, new Date().toISOString());
  window.location.reload();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
