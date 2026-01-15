import React, { useEffect, useState } from 'react';
import { useProjectsContext } from '../contexts/ProjectsContext';
import { User, Project } from '../types';

const emptyUser = { name: '', email: '', roles: ['user'] };

const SettingsView: React.FC = () => {
  const {
    getAllUsers,
    createUser,
    updateUser,
    deleteUser,
    projects,
    fetchProjects,
    deleteProject,
    isLoading
  } = useProjectsContext();

  // Usuários
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState<any>(emptyUser);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<User | null>(null);

  // Projetos
  const [confirmDeleteProject, setConfirmDeleteProject] = useState<Project | null>(null);

  // Carregar usuários
  const loadUsers = async () => {
    setLoadingUsers(true);
    const data = await getAllUsers();
    setUsers(data);
    setLoadingUsers(false);
  };
  useEffect(() => { loadUsers(); }, []);
  useEffect(() => { fetchProjects(); }, []);

  // Handlers Usuário
  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setUserForm({ ...user });
    setShowUserModal(true);
  };
  const handleNewUser = () => {
    setEditingUser(null);
    setUserForm({ ...emptyUser });
    setShowUserModal(true);
  };
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      await updateUser(editingUser.id, userForm);
    } else {
      await createUser(userForm);
    }
    setShowUserModal(false);
    await loadUsers();
  };
  const handleDeleteUser = async () => {
    if (confirmDeleteUser) {
      try {
        await deleteUser(confirmDeleteUser.id);
        setConfirmDeleteUser(null);
        await loadUsers();
      } catch (error: any) {
        console.error('Erro ao excluir usuário:', error);
        alert('Erro ao excluir usuário: ' + (error.message || 'Não foi possível excluir o usuário. Verifique se você tem permissão.'));
      }
    }
  };

  // Handlers Projeto
  const handleDeleteProject = async () => {
    if (confirmDeleteProject) {
      await deleteProject(confirmDeleteProject.id);
      setConfirmDeleteProject(null);
      await fetchProjects();
    }
  };

  // Roles disponíveis
  const allRoles = [
    { value: 'admin', label: 'Administrador' },
    { value: 'manager', label: 'Gerente' },
    { value: 'aprovador', label: 'Aprovador' },
    { value: 'user', label: 'Usuário' }
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <span className="text-lg text-gray-500 animate-pulse">Carregando dados...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Usuários */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Gerenciamento de Usuários</h2>
            <p className="text-gray-600">Edite os dados e permissões dos usuários já cadastrados no sistema.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left">Nome</th>
                <th className="px-4 py-2 text-left">E-mail</th>
                <th className="px-4 py-2 text-left">Permissões</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {loadingUsers ? (
                <tr><td colSpan={4} className="text-center py-8">Carregando...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-gray-400">Nenhum usuário encontrado.</td></tr>
              ) : users.map(user => (
                <tr key={user.id} className="border-b">
                  <td className="px-4 py-2">{user.name}</td>
                  <td className="px-4 py-2">{user.email}</td>
                  <td className="px-4 py-2">
                    {user.roles.map(r => allRoles.find(ar => ar.value === r)?.label || r).join(', ')}
                  </td>
                  <td className="px-4 py-2 text-right space-x-2">
                    <button onClick={() => handleEditUser(user)} className="text-blue-600 hover:underline">Editar</button>
                    <button onClick={() => setConfirmDeleteUser(user)} className="text-red-600 hover:underline">Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Projetos */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Gerenciamento de Projetos</h2>
        <p className="text-gray-600 mb-4">Visualize e exclua projetos existentes no sistema.</p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left">Nome</th>
                <th className="px-4 py-2 text-left">Descrição</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Prioridade</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">Nenhum projeto encontrado.</td></tr>
              ) : projects.map(project => (
                <tr key={project.id} className="border-b">
                  <td className="px-4 py-2">{project.name}</td>
                  <td className="px-4 py-2">{project.description}</td>
                  <td className="px-4 py-2">{project.status}</td>
                  <td className="px-4 py-2">{project.priority}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => setConfirmDeleteProject(project)} className="text-red-600 hover:underline">Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Usuário */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <form onSubmit={handleSaveUser} className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md space-y-6">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Editar Usuário</h3>
            <div>
              <label className="block text-sm font-medium mb-1">Nome</label>
              <input type="text" required value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">E-mail</label>
              <input type="email" required value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} className="w-full px-3 py-2 border rounded-lg" disabled />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Permissões</label>
              <div className="flex flex-wrap gap-2">
                {allRoles.map(role => (
                  <label key={role.value} className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={userForm.roles.includes(role.value)}
                      onChange={e => {
                        if (e.target.checked) {
                          setUserForm({ ...userForm, roles: [...userForm.roles, role.value] });
                        } else {
                          setUserForm({ ...userForm, roles: userForm.roles.filter((r: string) => r !== role.value) });
                        }
                      }}
                    />
                    {role.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={() => setShowUserModal(false)} className="px-4 py-2 rounded-lg bg-gray-100">Cancelar</button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 text-white">Salvar</button>
            </div>
          </form>
        </div>
      )}

      {/* Confirmação de exclusão de usuário */}
      {confirmDeleteUser && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">Excluir usuário?</h3>
            <p className="mb-6">Tem certeza que deseja excluir o usuário <b>{confirmDeleteUser.name}</b>? Esta ação não poderá ser desfeita.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDeleteUser(null)} className="px-4 py-2 rounded-lg bg-gray-100">Cancelar</button>
              <button onClick={handleDeleteUser} className="px-4 py-2 rounded-lg bg-red-600 text-white">Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmação de exclusão de projeto */}
      {confirmDeleteProject && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">Excluir projeto?</h3>
            <p className="mb-6">Tem certeza que deseja excluir o projeto <b>{confirmDeleteProject.name}</b>? Esta ação não poderá ser desfeita.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDeleteProject(null)} className="px-4 py-2 rounded-lg bg-gray-100">Cancelar</button>
              <button onClick={handleDeleteProject} className="px-4 py-2 rounded-lg bg-red-600 text-white">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsView; 