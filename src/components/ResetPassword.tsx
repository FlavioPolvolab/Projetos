import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tokenSet, setTokenSet] = useState(false);

  // Captura o access_token da hash da URL e atualiza a sessão do Supabase
  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace('#', ''));
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token') || '';
    if (access_token) {
      supabase.auth.setSession({
        access_token,
        refresh_token,
      }).then(() => setTokenSet(true));
    } else {
      setTokenSet(true); // Permite mostrar erro se não houver token
    }
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setMessage('Erro ao atualizar senha: ' + error.message);
    } else {
      setMessage('Senha alterada com sucesso! Você já pode acessar o sistema.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleReset} className="bg-white p-8 rounded shadow max-w-sm w-full">
        <h2 className="text-xl font-bold mb-4">Redefinir Senha</h2>
        {!tokenSet ? (
          <div className="text-center text-gray-500 mb-4">Carregando...</div>
        ) : (
          <>
            <input
              type="password"
              placeholder="Nova senha"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border rounded px-3 py-2 mb-4"
              required
            />
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded font-semibold hover:bg-blue-700"
              disabled={loading}
            >
              {loading ? 'Salvando...' : 'Alterar senha'}
            </button>
            {message && <p className="mt-4 text-center text-sm">{message}</p>}
          </>
        )}
      </form>
    </div>
  );
};

export default ResetPassword; 