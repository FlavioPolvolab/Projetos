import React, { useState } from 'react';
import { Bell, X, Check, CheckCheck, Trash2, Clock, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useNotificationsContext } from '../contexts/NotificationsContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Tooltip from './Tooltip';

interface NotificationCenterProps {
  onOpenTask?: (taskId: string) => void;
}
const NotificationCenter: React.FC<NotificationCenterProps> = ({ onOpenTask }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, markAsRead, markAllAsRead, deleteNotification, getUnreadCount } = useNotificationsContext();
  const [tooltipProjectId, setTooltipProjectId] = useState<string | null>(null);

  const unreadCount = getUnreadCount();

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'deadline_warning':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'deadline_overdue':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'task_approved':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'task_rejected':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'task_assigned':
      case 'task_transferred':
        return <Bell className="w-5 h-5 text-blue-500" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'border-l-red-500 bg-red-50';
      case 'high': return 'border-l-orange-500 bg-orange-50';
      case 'medium': return 'border-l-yellow-500 bg-yellow-50';
      case 'low': return 'border-l-blue-500 bg-blue-50';
      default: return 'border-l-gray-500 bg-gray-50';
    }
  };

  const handleNotificationClick = (notification: any) => {
    if (notification.taskId && onOpenTask) {
      onOpenTask(notification.taskId);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      {/* Notification Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Modal no topo central */}
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-black bg-opacity-40" 
            onClick={() => setIsOpen(false)}
          />
          <div
            className="fixed left-1/2 top-6 transform -translate-x-1/2 z-50 w-full max-w-lg px-2"
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-h-[80vh] flex flex-col overflow-hidden border border-gray-200">
              {/* Header */}
              <div className="p-4 border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Notificações
                    {unreadCount > 0 && (
                      <span className="ml-2 text-sm text-gray-500">
                        ({unreadCount} não lida{unreadCount !== 1 ? 's' : ''})
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center space-x-2">
                    {unreadCount > 0 && (
                      <span className="relative" onMouseEnter={() => setTooltipProjectId('mark-all-read')} onMouseLeave={() => setTooltipProjectId(null)}>
                      <button
                        onClick={markAllAsRead}
                        className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        <CheckCheck className="w-4 h-4" />
                      </button>
                        <Tooltip show={tooltipProjectId === 'mark-all-read'}>Marcar todas como lidas</Tooltip>
                      </span>
                    )}
                    <button
                      onClick={() => setIsOpen(false)}
                      className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Notifications List */}
              <div className="max-h-[60vh] overflow-y-auto">
                {notifications.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {notifications.map(notification => (
                      <div
                        key={notification.id}
                        className={`p-4 hover:bg-gray-50 transition-colors border-l-4 ${
                          notification.read ? 'opacity-75' : ''
                        } ${getPriorityColor(notification.priority)}`}
                        onClick={() => handleNotificationClick(notification)}
                        style={{ cursor: notification.taskId ? 'pointer' : 'default' }}
                      >
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0 mt-1">
                            {getNotificationIcon(notification.type)}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className={`text-sm font-medium ${
                                  notification.read ? 'text-gray-600' : 'text-gray-900'
                                }`}>
                                  {notification.title}
                                </p>
                                <p className={`text-sm mt-1 ${
                                  notification.read ? 'text-gray-500' : 'text-gray-700'
                                }`}>
                                  {notification.message}
                                </p>
                                {notification.projectName && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    Projeto: {notification.projectName}
                                  </p>
                                )}
                                <p className="text-xs text-gray-400 mt-2">
                                  {format(notification.createdAt, 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                                </p>
                              </div>
                              
                              <div className="flex items-center space-x-1 ml-2">
                                {!notification.read && (
                                  <button
                                    onClick={() => markAsRead(notification.id)}
                                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                                  >
                                    <Check className="w-3 h-3" />
                                  </button>
                                )}
                                <button
                                  onClick={e => { e.stopPropagation(); deleteNotification(notification.id); }}
                                  className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Nenhuma notificação</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationCenter;