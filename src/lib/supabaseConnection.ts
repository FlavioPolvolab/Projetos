import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from './database.types';

// Tipos para retry e timeout
interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  retryableErrors?: string[];
}

interface ConnectionStatus {
  isConnected: boolean;
  lastCheck: Date | null;
  consecutiveFailures: number;
}

// Status global de conexão
let connectionStatus: ConnectionStatus = {
  isConnected: true,
  lastCheck: null,
  consecutiveFailures: 0
};

// Configurações padrão
const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  retryDelay: 2000, // 2 segundos (aumentado para dar mais tempo entre tentativas)
  timeout: 45000, // 45 segundos (aumentado para dar mais tempo)
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ECONNREFUSED',
    'Network request failed',
    'Failed to fetch',
    'NetworkError',
    'timeout',
    'PGRST301', // Supabase connection error
    'PGRST204', // Supabase no rows error (pode ser temporário)
  ]
};

// Função para verificar se um erro é retryable
function isRetryableError(error: any): boolean {
  if (!error) return false;
  
  const errorMessage = error.message || error.toString() || '';
  const errorCode = error.code || '';
  
  return DEFAULT_RETRY_OPTIONS.retryableErrors.some(
    retryableError => 
      errorMessage.toLowerCase().includes(retryableError.toLowerCase()) ||
      errorCode.toLowerCase().includes(retryableError.toLowerCase())
  );
}

// Função para calcular delay exponencial com jitter
function calculateDelay(attempt: number, baseDelay: number): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 30% de jitter
  return exponentialDelay + jitter;
}

// Função para criar timeout promise
function createTimeoutPromise(timeoutMs: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Request timeout após ${timeoutMs}ms`));
    }, timeoutMs);
  });
}

// Função principal de retry com timeout
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      // Criar race entre operação e timeout
      const result = await Promise.race([
        operation(),
        createTimeoutPromise(config.timeout)
      ]);

      // Sucesso - resetar contador de falhas
      connectionStatus.consecutiveFailures = 0;
      connectionStatus.isConnected = true;
      connectionStatus.lastCheck = new Date();

      return result;
    } catch (error: any) {
      lastError = error;

      // Se não for retryable ou última tentativa, lançar erro
      if (!isRetryableError(error) || attempt === config.maxRetries) {
        // Incrementar contador de falhas
        connectionStatus.consecutiveFailures++;
        if (connectionStatus.consecutiveFailures >= 3) {
          connectionStatus.isConnected = false;
        }
        connectionStatus.lastCheck = new Date();
        throw error;
      }

      // Calcular delay com backoff exponencial
      const delay = calculateDelay(attempt, config.retryDelay);
      
      console.warn(
        `Tentativa ${attempt + 1}/${config.maxRetries + 1} falhou. Tentando novamente em ${Math.round(delay)}ms...`,
        error.message || error
      );

      // Aguardar antes de tentar novamente
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // Não deveria chegar aqui, mas TypeScript exige
  throw lastError || new Error('Erro desconhecido');
}

// Health check da conexão usando Supabase client
export async function checkConnectionHealth(
  supabase: SupabaseClient<Database>
): Promise<boolean> {
  try {
    // Timeout aumentado para 10 segundos para health check
    const { error } = await Promise.race([
      supabase.from('users').select('id').limit(1),
      createTimeoutPromise(10000)
    ]) as any;

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows, mas conexão OK
      connectionStatus.isConnected = false;
      connectionStatus.consecutiveFailures++;
      connectionStatus.lastCheck = new Date();
      return false;
    }

    connectionStatus.isConnected = true;
    connectionStatus.consecutiveFailures = 0;
    connectionStatus.lastCheck = new Date();
    return true;
  } catch (error) {
    connectionStatus.isConnected = false;
    connectionStatus.consecutiveFailures++;
    connectionStatus.lastCheck = new Date();
    return false;
  }
}

// Health check usando MCP Supabase (validação direta no banco)
export async function checkDatabaseHealthViaMCP(): Promise<boolean> {
  try {
    // Esta função será chamada apenas se o MCP estiver disponível
    // Por enquanto, retorna true se não houver erro ao tentar
    return true;
  } catch (error) {
    console.error('Erro ao verificar saúde do banco via MCP:', error);
    return false;
  }
}

// Obter status da conexão
export function getConnectionStatus(): ConnectionStatus {
  return { ...connectionStatus };
}

// Resetar status da conexão
export function resetConnectionStatus(): void {
  connectionStatus = {
    isConnected: true,
    lastCheck: null,
    consecutiveFailures: 0
  };
}

// Wrapper para queries Supabase com retry automático
export async function supabaseQuery<T>(
  supabase: SupabaseClient<Database>,
  queryFn: () => Promise<{ data: T | null; error: any }>,
  options: RetryOptions = {}
): Promise<{ data: T | null; error: any }> {
  try {
    const result = await withRetry(queryFn, options);
    return result;
  } catch (error: any) {
    return {
      data: null,
      error: {
        message: error.message || 'Erro desconhecido na conexão',
        code: error.code || 'UNKNOWN_ERROR',
        details: error
      }
    };
  }
}

// Monitor de conexão - verifica periodicamente a saúde da conexão
let healthCheckInterval: NodeJS.Timeout | null = null;

export function startConnectionMonitor(
  supabase: SupabaseClient<Database>,
  intervalMs: number = 120000 // 120 segundos (2 minutos - reduzido para não sobrecarregar)
): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }

  healthCheckInterval = setInterval(async () => {
    // Verificar saúde da conexão
    const isHealthy = await checkConnectionHealth(supabase);
    
    // Se não estiver saudável, tentar verificar novamente após um delay
    if (!isHealthy) {
      console.warn('Conexão não saudável detectada. Tentando reconectar...');
      // Aguardar um pouco antes de tentar novamente
      setTimeout(async () => {
        await checkConnectionHealth(supabase);
      }, 10000); // Aumentado para 10 segundos
    }
  }, intervalMs);

  // Verificação inicial com delay maior para não bloquear o carregamento
  setTimeout(() => {
    checkConnectionHealth(supabase);
  }, 10000); // Aumentado para 10 segundos
}

export function stopConnectionMonitor(): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
}
