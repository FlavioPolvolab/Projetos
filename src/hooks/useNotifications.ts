import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useProjects } from './useProjects';
import { supabase } from '../lib/supabase';
import { differenceInDays, isAfter } from 'date-fns';

export interface Notification {
  id: string;
  type: 'deadline_warning' | 'deadline_overdue' | 'task_assigned' | 'task_approved' | 'task_rejected' | 'task_transferred';
  title: string;
  message: string;
  taskId?: string;
  projectName?: string;
  createdAt: Date;
  read: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { user } = useAuth();
  const { getUserTasks, isLoading: projectsLoading } = useProjects();
  const checkingDeadlinesRef = useRef(false);
  const fetchingNotificationsRef = useRef(false);
  const lastFetchTimeRef = useRef<number>(0);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const CACHE_DURATION = 3000; // Cache de 3 segundos para notificações

  const fetchNotifications = useCallback(async (force = false) => {
    if (!user) return;
    
    // Evitar múltiplas chamadas simultâneas
    if (fetchingNotificationsRef.current && !force) {
      return;
    }
    
    // Se não for forçado e já foi chamado recentemente, usar cache
    const now = Date.now();
    if (!force && (now - lastFetchTimeRef.current) < CACHE_DURATION) {
      return;
    }
    
    // Limpar timeout anterior se houver
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    
    // Debounce: aguardar um pouco antes de fazer a requisição
    return new Promise<void>((resolve) => {
      debounceTimeoutRef.current = setTimeout(async () => {
        if (fetchingNotificationsRef.current && !force) {
          resolve();
          return;
        }
        
        try {
          fetchingNotificationsRef.current = true;
          const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

          if (error) {
            fetchingNotificationsRef.current = false;
            resolve();
            return;
          }

          const transformedNotifications: Notification[] = data?.map(notif => ({
            id: notif.id,
            type: notif.type,
            title: notif.title,
            message: notif.message,
            taskId: notif.task_id || undefined,
            projectName: notif.project_name || undefined,
            createdAt: new Date(notif.created_at),
            read: notif.read,
            priority: notif.priority
          })) || [];

          setNotifications(transformedNotifications);
          lastFetchTimeRef.current = Date.now();
        } catch (error) {
          // Ignorar erros silenciosamente
        } finally {
          fetchingNotificationsRef.current = false;
          resolve();
        }
      }, 300); // Debounce de 300ms
    });
  }, [user]);

  const addNotification = useCallback(async (
    notification: Omit<Notification, 'id' | 'createdAt'>,
    userIdOverride?: string
  ) => {
    const targetUserId = userIdOverride || user?.id;
    if (!targetUserId) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: targetUserId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          task_id: notification.taskId || null,
          project_name: notification.projectName || null,
          priority: notification.priority,
          read: notification.read
        });

      if (error) {
        console.error('Erro ao criar notificação:', error);
        return;
      }

      // Só atualiza as notificações se for para o usuário logado
      if (targetUserId === user?.id) {
        await fetchNotifications();
      }
    } catch (error) {}
  }, [user, fetchNotifications]);

  const checkDeadlineNotifications = useCallback(async () => {
    if (!user || checkingDeadlinesRef.current) return;
    
    checkingDeadlinesRef.current = true;
    try {
      // Usar getUserTasks diretamente sem depender do estado
      const userTasks = getUserTasks();
      if (!userTasks || userTasks.length === 0) {
        checkingDeadlinesRef.current = false;
        return;
      }
      
      const now = new Date();
      
      // Evitar verificação se não houver tarefas com data de vencimento
      const tasksWithDueDate = userTasks.filter(t => t.dueDate && t.status !== 'completed');
      if (tasksWithDueDate.length === 0) {
        checkingDeadlinesRef.current = false;
        return;
      }
      
      // Buscar notificações atuais do banco para verificar duplicatas
      // Usar cache para evitar múltiplas queries quando a aba volta ao foco
      const cacheKey = `deadline_notifs_${user.id}`;
      const cacheTime = sessionStorage.getItem(`${cacheKey}_time`);
      const nowTimestamp = Date.now();
      let existingNotifs: any[] = [];
      
      // Se o cache for recente (menos de 30 segundos), usar do cache
      if (cacheTime && (nowTimestamp - parseInt(cacheTime)) < 30000) {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          try {
            existingNotifs = JSON.parse(cached);
          } catch (e) {
            // Se houver erro ao parsear, buscar do banco
          }
        }
      }
      
      // Se não houver cache válido, buscar do banco
      if (existingNotifs.length === 0) {
        const { data } = await supabase
          .from('notifications')
          .select('task_id, type')
          .eq('user_id', user.id)
          .in('type', ['deadline_warning', 'deadline_overdue']);
        
        existingNotifs = data || [];
        
        // Salvar no cache
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(existingNotifs));
          sessionStorage.setItem(`${cacheKey}_time`, nowTimestamp.toString());
        } catch (e) {
          // Ignorar erros de storage
        }
      }

      const existingTaskIds = new Set(
        existingNotifs?.map(n => `${n.task_id}-${n.type}`) || []
      );

      for (const task of tasksWithDueDate) {

        const daysUntilDue = differenceInDays(new Date(task.dueDate), now);
        const isOverdue = isAfter(now, new Date(task.dueDate));
        
        // Verificar se já existe notificação para esta tarefa
        const notificationKey = `${task.id}-${isOverdue ? 'deadline_overdue' : 'deadline_warning'}`;
        if (existingTaskIds.has(notificationKey)) continue;

        let notificationType: 'deadline_warning' | 'deadline_overdue' | null = null;
        let title = '';
        let message = '';
        let priority: 'low' | 'medium' | 'high' | 'critical' = 'medium';

        if (isOverdue) {
          notificationType = 'deadline_overdue';
          title = 'Tarefa em Atraso';
          message = `A tarefa "${task.title}" está atrasada há ${Math.abs(daysUntilDue)} dia(s)`;
          priority = 'critical';
        } else if (daysUntilDue <= 2 && daysUntilDue >= 0) {
          notificationType = 'deadline_warning';
          title = 'Prazo Próximo';
          message = `A tarefa "${task.title}" vence em ${daysUntilDue} dia(s)`;
          priority = daysUntilDue === 0 ? 'high' : 'medium';
        }

        if (notificationType) {
          await addNotification({
            type: notificationType,
            title,
            message,
            taskId: task.id,
            projectName: task.projectName,
            priority,
            read: false
          });
        }
      }
    } catch (error) {
      console.error('Erro ao verificar prazos:', error);
    } finally {
      checkingDeadlinesRef.current = false;
    }
  }, [user, getUserTasks, addNotification]);

  useEffect(() => {
    if (!user) return;
    
    let timeoutId: NodeJS.Timeout | null = null;
    let intervalId: NodeJS.Timeout | null = null;
    let notificationTimeoutId: NodeJS.Timeout | null = null;
    
    // Buscar notificações com debounce para evitar múltiplas chamadas
    notificationTimeoutId = setTimeout(() => {
      fetchNotifications();
    }, 500); // Debounce de 500ms
    
    // Só verificar deadlines após os projetos estarem carregados
    if (!projectsLoading) {
      // Delay inicial maior para evitar chamadas simultâneas durante o carregamento inicial
      timeoutId = setTimeout(() => {
        checkDeadlineNotifications();
      }, 5000); // Aumentado para 5 segundos
      
      // Set up interval to check deadlines every hour
      intervalId = setInterval(() => {
        checkDeadlineNotifications();
      }, 60 * 60 * 1000);
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
      if (notificationTimeoutId) clearTimeout(notificationTimeoutId);
    };
  }, [user, projectsLoading, fetchNotifications, checkDeadlineNotifications]); // Aguardar projetos carregarem

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) {
        return;
      }

      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId ? { ...notif, read: true } : notif
        )
      );
    } catch (error) {
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) {
        return;
      }

      setNotifications(prev => 
        prev.map(notif => ({ ...notif, read: true }))
      );
    } catch (error) {
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) {
        return;
      }

      setNotifications(prev => 
        prev.filter(notif => notif.id !== notificationId)
      );
    } catch (error) {
    }
  };

  const getUnreadCount = () => {
    return notifications.filter(notif => !notif.read).length;
  };

  const getTaskDeadlineStatus = (task: any) => {
    if (!task.dueDate || task.status === 'completed') return 'normal';
    
    const now = new Date();
    const dueDate = new Date(task.dueDate);
    const daysUntilDue = differenceInDays(dueDate, now);
    
    if (isAfter(now, dueDate)) return 'overdue';
    if (daysUntilDue <= 1) return 'urgent';
    if (daysUntilDue <= 3) return 'warning';
    
    return 'normal';
  };

  return {
    notifications,
    addNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    getUnreadCount,
    getTaskDeadlineStatus,
    checkDeadlineNotifications,
    fetchNotifications
  };
};