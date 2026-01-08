import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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

  // Função para checar se o token está válido
  const checkTokenValid = async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        return false;
      }
      return true;
    } catch (error) {
      console.error('Erro ao verificar sessão:', error);
      return false;
    }
  };

  const fetchUser = async (supabaseUser: SupabaseUser) => {
    try {
      const isValid = await checkTokenValid();
      if (!isValid) {
        setUser(null);
        setIsLoading(false);
        setAuthError(undefined);
        return;
      }

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
  };

  useEffect(() => {
    let mounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    // Função para inicializar a sessão
    const initializeSession = async () => {
      try {
        // Primeiro, tenta obter a sessão atual
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;

        if (error) {
          console.error('Erro ao obter sessão:', error);
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
      } catch (error) {
        console.error('Erro ao inicializar sessão:', error);
        if (mounted) {
          setIsLoading(false);
          setUser(null);
          setIsInitialized(true);
        }
      }
    };

    // Inicializa a sessão
    initializeSession();

    // Listen for auth changes
    subscription = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

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
        setUser(prevUser => {
          if (!prevUser) {
            // Se não temos usuário mas temos sessão, busca
            fetchUser(session.user);
          }
          return prevUser;
        });
      }
    });

    return () => {
      mounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);


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

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setAuthError(undefined);
      setIsInitialized(false);
      setIsLoading(false);
      // Limpa o localStorage relacionado ao Supabase
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-')) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      // Mesmo com erro, limpa o estado local
      setUser(null);
      setAuthError(undefined);
      setIsInitialized(false);
      setIsLoading(false);
    }
  };

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