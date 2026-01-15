import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from './database.types';
import { startConnectionMonitor } from './supabaseConnection';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Configuração otimizada do cliente Supabase
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'sb-auth-token',
    flowType: 'pkce',
    // Configurações de timeout para auth
    debug: false,
    // Aumentar tempo de refresh para evitar múltiplas tentativas
    autoRefreshTokenInterval: 3600000, // 1 hora (padrão é 30 minutos)
  },
  global: {
    headers: {
      'x-client-info': 'project-bolt'
    },
    // Timeout global aumentado para 45 segundos para dar mais tempo
    fetch: (url, options = {}) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 segundos

      return fetch(url, {
        ...options,
        signal: controller.signal
      }).finally(() => {
        clearTimeout(timeoutId);
      });
    }
  },
  db: {
    schema: 'public'
  },
  realtime: {
    // Configurações de reconexão para realtime
    params: {
      eventsPerSecond: 10
    }
  }
});

// Iniciar monitor de conexão quando o módulo é carregado (apenas no browser)
if (typeof window !== 'undefined') {
  // Delay inicial maior para não interferir no carregamento inicial e refresh
  setTimeout(() => {
    startConnectionMonitor(supabase, 120000); // Verifica a cada 120 segundos (2 minutos)
  }, 15000); // Delay de 15 segundos
}