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
  const [userFetched, setUserFetched] = useState(false);

  // Função para checar se o token está válido
  const checkTokenValid = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
      setAuthError('Sessão expirada. Faça login novamente.');
      setUser(null);
      setIsLoading(false);
      setAuthError(undefined);
      return false;
    }
    return true;
  };

  useEffect(() => {
    // Ao inicializar, tente restaurar a sessão com timeout de 8s
    let didTimeout = false;
    const timeout = setTimeout(() => {
      didTimeout = true;
      setIsLoading(false);
      setUser(null);
      setAuthError('Tempo de autenticação excedido. Faça login novamente.');
    }, 8000);
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (didTimeout) return;
      clearTimeout(timeout);
      if (session?.user && !userFetched) {
        fetchUser(session.user);
        setUserFetched(true);
      } else {
        setIsLoading(false);
        setUser(null); // Garante que user seja null se não houver sessão
        setAuthError(undefined);
      }
    }).catch(() => {
      if (didTimeout) return;
      clearTimeout(timeout);
      setIsLoading(false);
      setUser(null);
      setAuthError(undefined);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user && !userFetched) {
        await fetchUser(session.user);
        setUserFetched(true);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setIsLoading(false);
        setAuthError(undefined);
      }
    });

    return () => subscription.unsubscribe();
  }, [userFetched]);

  const fetchUser = async (supabaseUser: SupabaseUser) => {
    const isValid = await checkTokenValid();
    if (!isValid) return;
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', supabaseUser.id)
        .single();

      if (error) {
        console.error('Error fetching user:', error);
        setAuthError('Erro ao buscar usuário. Faça login novamente.');
        setIsLoading(false);
        setUser(null);
        setAuthError(undefined);
        return;
      }

      if (user) {
        setUser({
          id: user.id,
          name: user.name,
          email: user.email,
          roles: user.roles,
          avatar: user.avatar_url
        });
        setAuthError(undefined);
      }
    } catch (error) {
      console.error('Error in fetchUser:', error);
      setAuthError('Erro de autenticação. Faça login novamente.');
      setUser(null);
      setAuthError(undefined);
    } finally {
      setIsLoading(false);
    }
  };

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
    await supabase.auth.signOut();
    setUser(null);
    setAuthError(undefined);
    setUserFetched(false);
    setIsLoading(false);
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