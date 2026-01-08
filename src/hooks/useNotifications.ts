import { useState, useEffect } from 'react';
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
  const { getUserTasks } = useProjects();

  useEffect(() => {
    if (user) {
      fetchNotifications();
      checkDeadlineNotifications();
      
      // Set up interval to check deadlines every hour
      const interval = setInterval(checkDeadlineNotifications, 60 * 60 * 1000);
      
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
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
    } catch (error) {
    }
  };

  const checkDeadlineNotifications = async () => {
    if (!user) return;

    const userTasks = getUserTasks();
    const now = new Date();

    for (const task of userTasks) {
      if (!task.dueDate || task.status === 'completed') continue;

      const daysUntilDue = differenceInDays(new Date(task.dueDate), now);
      const isOverdue = isAfter(now, new Date(task.dueDate));
      
      // Check if we already have a notification for this task
      const existingNotification = notifications.find(
        notif => notif.taskId === task.id && 
        (notif.type === 'deadline_warning' || notif.type === 'deadline_overdue')
      );

      if (existingNotification) continue;

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
  };

  const addNotification = async (
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
  };

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