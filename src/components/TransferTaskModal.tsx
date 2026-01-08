import React, { useState } from 'react';
import { X, Users, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface TransferTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTransfer: (newAssignee: string, reason: string) => void;
  task: any;
  users: Array<{ id: string; name: string; email: string; roles: string[] }>;
}

const TransferTaskModal: React.FC<TransferTaskModalProps> = ({
  isOpen,
  onClose,
  onTransfer,
  task,
  users
}) => {
  const { user } = useAuth();
  const [selectedUser, setSelectedUser] = useState('');
  const [reason, setReason] = useState('');

  const currentAssignee = users.find(u => u.id === task?.assignedTo);
  const availableUsers = users.filter(u => u.id !== task?.assignedTo);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUser && reason.trim()) {
      onTransfer(selectedUser, reason);
      setSelectedUser('');
      setReason('');
      onClose();
    }
  };

  if (!isOpen || !task) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[95vh] h-full sm:h-auto flex flex-col overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 sm:p-6 rounded-t-2xl z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Transferir Tarefa</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6">
          {/* Task Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">{task.title}</h3>
            <p className="text-sm text-gray-600">{task.description}</p>
          </div>

          {/* Current Assignment */}
          <div className="flex items-center space-x-4 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Atual:</span>
            </div>
            <span className="text-sm text-blue-800">
                {currentAssignee?.name} ({currentAssignee?.roles.map(role => role.charAt(0).toUpperCase() + role.slice(1)).join(', ')})
            </span>
          </div>

          {/* Transfer To */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Transferir para *
            </label>
            <select
              required
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            >
              <option value="">Selecionar usuário</option>
              {availableUsers.map(user => (
                <option key={user.id} value={user.id}>
                    {user.name} ({user.roles.map(role => role.charAt(0).toUpperCase() + role.slice(1)).join(', ')})
                </option>
              ))}
            </select>
          </div>

          {/* Transfer Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Motivo da transferência *
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              placeholder="Explique o motivo da transferência..."
            />
          </div>

          {/* Preview */}
          {selectedUser && (
            <div className="flex items-center justify-center space-x-4 p-4 bg-green-50 rounded-lg">
              <span className="text-sm text-green-800">
                {currentAssignee?.name}
              </span>
              <ArrowRight className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">
                {users.find(u => u.id === selectedUser)?.name}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end space-x-4 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Transferir Tarefa
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
};

export default TransferTaskModal;