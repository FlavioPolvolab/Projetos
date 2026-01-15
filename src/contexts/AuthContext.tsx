import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { User, AuthContextType } from '../types';

const AuthContext = createContext<AuthContextType & { authError?: string } | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | undefined>(undefined);
  const [isInitialized, setIsInitialized] = useState(false);

  // Refs para evitar múltiplas verificações simultâneas
  const checkingTokenRef = useRef(false);
  const lastCheckRef = useRef<number>(0);
  
  // Função para checar se o token está válido
  const checkTokenValid = useCallback(async () => {
    // Evitar múltiplas verificações simultâneas
    if (checkingTokenRef.current) {
      return false;
    }
    
    // Throttle: não verificar mais de uma vez a cada 2 segundos
    const now = Date.now();
    if (now - lastCheckRef.current < 2000) {
      return false;
    }
    
    checkingTokenRef.current = true;
    lastCheckRef.current = now;
    
    try {
      // Não usar retry aqui para evitar loops infinitos
      // Timeout reduzido para 8 segundos (mais rápido)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 8000);
      });
      
      const result = await Promise.race([sessionPromise, timeoutPromise]).finally(() => {
        clearTimeout(timeoutId);
      }) as any;
      
      checkingTokenRef.current = false;
      
      if (result?.error || !result?.data?.session) {
        return false;
      }
      return true;
    } catch (error) {
      checkingTokenRef.current = false;
      // Não logar erros de timeout durante refresh - é esperado
      if (error instanceof Error && !error.message.includes('Timeout') && !error.message.includes('aborted')) {
        console.error('Erro ao verificar sessão:', error);
      }
      return false;
    }
  }, []);

  const fetchUser = useCallback(async (supabaseUser: SupabaseUser) => {
    try {
      // Não verificar token aqui para evitar loops - confiar no Supabase Auth
      // const isValid = await checkTokenValid();
      // if (!isValid) {
      //   setUser(null);
      //   setIsLoading(false);
      //   setAuthError(undefined);
      //   setIsInitialized(true);
      //   return;
      // }

      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', supabaseUser.id)
        .single();

      if (error) {
        console.error('Error fetching user:', error);
        setUser(null);
        setIsLoading(false);
        setAuthError(undefined);
        setIsInitialized(true);
        return;
      }

      if (userData) {
        setUser({
          id: userData.id,
          name: userData.name,
          email: userData.email,
          roles: userData.roles,
          avatar: userData.avatar_url
        });
        setAuthError(undefined);
      }
    } catch (error) {
      console.error('Error in fetchUser:', error);
      setUser(null);
      setAuthError(undefined);
    } finally {
      setIsLoading(false);
      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let subscription: { unsubscribe: () => void } | null = null;
    let initTimeout: NodeJS.Timeout | null = null;
    let authChangeTimeout: NodeJS.Timeout | null = null;

    // Função para inicializar a sessão
    const initializeSession = async () => {
      try {
        // Timeout para evitar que fique travado
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos
        
        // Primeiro, tenta obter a sessão atual sem retry (evitar loops)
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Session timeout')), 10000);
        });
        
        const { data: { session }, error } = await Promise.race([
          sessionPromise,
          timeoutPromise
        ]).finally(() => {
          clearTimeout(timeoutId);
        }) as any;
        
        if (!mounted) return;

        if (error) {
          // Se for erro de timeout, não logar (é esperado em conexões lentas)
          if (!error.message?.includes('timeout') && !error.message?.includes('aborted')) {
            console.error('Erro ao obter sessão:', error);
          }
          setIsLoading(false);
          setUser(null);
          setIsInitialized(true);
          return;
        }

        if (session?.user) {
          await fetchUser(session.user);
        } else {
          setIsLoading(false);
          setUser(null);
          setIsInitialized(true);
        }
      } catch (error: any) {
        // Não logar timeouts durante inicialização
        if (error?.message && !error.message.includes('timeout') && !error.message.includes('aborted')) {
          console.error('Erro ao inicializar sessão:', error);
        }
        if (mounted) {
          setIsLoading(false);
          setUser(null);
          setIsInitialized(true);
        }
      }
    };

    // Delay inicial para evitar conflito com refresh automático do Supabase
    initTimeout = setTimeout(() => {
      initializeSession();
    }, 100);

    // Listen for auth changes com debounce para evitar múltiplas chamadas
    subscription = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      // Debounce: aguardar um pouco antes de processar eventos consecutivos
      if (authChangeTimeout) {
        clearTimeout(authChangeTimeout);
      }

      authChangeTimeout = setTimeout(async () => {
        if (!mounted) return;

        // Ignorar eventos de refresh durante inicialização para evitar loops
        if (event === 'TOKEN_REFRESHED' && !isInitialized) {
          return;
        }

        if (event === 'SIGNED_IN' && session?.user) {
          await fetchUser(session.user);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setIsLoading(false);
          setAuthError(undefined);
          setIsInitialized(true);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Se o token foi atualizado, verifica se precisa atualizar o usuário
          // Isso é importante para manter a sessão ativa após refresh da página
          // Mas só se já estiver inicializado para evitar loops
          if (isInitialized) {
            setUser(prevUser => {
              if (!prevUser && mounted) {
                // Se não temos usuário mas temos sessão, busca
                fetchUser(session.user);
              }
              return prevUser;
            });
          }
        }
      }, 500); // Debounce de 500ms
    });

    return () => {
      mounted = false;
      if (initTimeout) {
        clearTimeout(initTimeout);
      }
      if (authChangeTimeout) {
        clearTimeout(authChangeTimeout);
      }
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [fetchUser]);


  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    setAuthError(undefined);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) {
        setAuthError('Email ou senha inválidos.');
        setIsLoading(false);
        return false;
      }
      if (data.user) {
        await fetchUser(data.user);
        return true;
      }
      setIsLoading(false);
      return false;
    } catch (error) {
      setAuthError('Erro ao fazer login.');
      setIsLoading(false);
      return false;
    }
  };

  const signUp = async (email: string, password: string, name: string): Promise<boolean> => {
    setIsLoading(true);
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            name: cleanName
          }
        }
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        setTimeout(() => {
          fetchUser(data.user!);
        }, 1000);
        return true;
      }

      setIsLoading(false);
      return false;
    } catch (error: any) {
      setIsLoading(false);
      throw error;
    }
  };

  const logout = useCallback(async () => {
    try {
      // Limpa o localStorage relacionado ao Supabase primeiro
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-')) {
          localStorage.removeItem(key);
        }
      });
      
      // Limpa sessionStorage também
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('sb-')) {
          sessionStorage.removeItem(key);
        }
      });
      
      // Tenta fazer logout no Supabase
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Erro ao fazer logout no Supabase:', error);
      }
      
      // Sempre limpa o estado local, mesmo se houver erro
      setUser(null);
      setAuthError(undefined);
      setIsInitialized(false);
      setIsLoading(false);
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      // Mesmo com erro, limpa o estado local
    setUser(null);
    setAuthError(undefined);
      setIsInitialized(false);
    setIsLoading(false);
    }
  }, []);

  const resetPassword = async (email: string): Promise<boolean> => {
    setIsLoading(true);
    setAuthError(undefined);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password'
      });
      setIsLoading(false);
      if (error) {
        setAuthError('Erro ao enviar email de recuperação.');
        return false;
      }
      return true;
    } catch (error) {
      setAuthError('Erro ao enviar email de recuperação.');
      setIsLoading(false);
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, signUp, logout, isLoading, authError, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};