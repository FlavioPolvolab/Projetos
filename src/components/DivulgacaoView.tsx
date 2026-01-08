import React, { useState, useEffect } from 'react';
import { useProjectsContext } from '../contexts/ProjectsContext';
import { supabase } from '../lib/supabase';

interface Etapa {
  id: string;
  nome: string;
  concluida: boolean;
  responsaveis: { id: string; nome: string }[];
}

interface TarefaDivulgacao {
  id: string;
  influenciador: string;
  seguidores: number;
  produtos: string;
  endereco: string | null;
  whatsapp: string | null;
  feedback: string | null;
  lead_status: 'lead' | 'nao_lead' | null;
  nicho: 'Food Service' | 'Varejo' | 'Exportação' | 'Institucional' | 'Influenciadores' | null;
  participantes: { id: string; nome: string }[];
  etapas: Etapa[];
}

const DivulgacaoView: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [tarefas, setTarefas] = useState<TarefaDivulgacao[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const { getAllUsers } = useProjectsContext();
  const [loading, setLoading] = useState(false);
  const [editTarefa, setEditTarefa] = useState<TarefaDivulgacao | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Formulário
  const [influenciador, setInfluenciador] = useState('');
  const [seguidores, setSeguidores] = useState('');
  const [produtos, setProdutos] = useState('');
  const [endereco, setEndereco] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [feedback, setFeedback] = useState('');
  const [leadStatus, setLeadStatus] = useState<'lead' | 'nao_lead' | ''>('');
  const [participantes, setParticipantes] = useState<string[]>([]);
  const [etapas, setEtapas] = useState<Array<{ nome: string; responsaveis: string[] }>>([
    { nome: '', responsaveis: [] }
  ]);
  const [nicho, setNicho] = useState<
    'Food Service' | 'Varejo' | 'Exportação' | 'Institucional' | 'Influenciadores' | ''
  >('');

  // Remover filtros individuais, manter apenas busca livre e filtro de lead
  const [search, setSearch] = useState('');
  const [filterLead, setFilterLead] = useState('');
  const [editingFeedbackId, setEditingFeedbackId] = useState<string | null>(null);

  useEffect(() => {
    getAllUsers().then((usrs: any) => setUsers(usrs || []));
  }, [getAllUsers]);

  // Buscar tarefas reais do Supabase
  const fetchTarefas = async () => {
    setLoading(true);
    const { data: tarefasData, error } = await supabase
      .from('divulgacao_tarefas')
      .select(`*,
        participantes:divulgacao_participantes(user_id),
        etapas:divulgacao_etapas(*,
          responsaveis:divulgacao_etapa_responsaveis(user_id)
        )
      `)
      .order('created_at', { ascending: false });
    if (error) {
      alert('Erro ao buscar tarefas de divulgação');
      setLoading(false);
      return;
    }
    setTarefas(
      (tarefasData || []).map((tarefa: any) => ({
        id: tarefa.id,
        influenciador: tarefa.influenciador,
        seguidores: tarefa.seguidores,
        produtos: tarefa.produtos,
        endereco: tarefa.endereco || '',
        whatsapp: tarefa.whatsapp || '',
        feedback: tarefa.feedback || '',
        lead_status: tarefa.lead_status || null,
        nicho: tarefa.nicho || null,
        participantes: (tarefa.participantes || []).map((p: any) => {
          const user = users.find(u => u.id === p.user_id);
          return user ? { id: user.id, nome: user.name } : { id: p.user_id, nome: p.user_id };
        }),
        etapas: (tarefa.etapas || []).map((et: any) => ({
          id: et.id,
          nome: et.nome,
          concluida: et.concluida,
          responsaveis: (et.responsaveis || []).map((r: any) => {
            const user = users.find(u => u.id === r.user_id);
            return user ? { id: user.id, nome: user.name } : { id: r.user_id, nome: r.user_id };
          })
        }))
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    if (users.length > 0) fetchTarefas();
    // eslint-disable-next-line
  }, [users]);

  const handleAddEtapa = () => {
    setEtapas([...etapas, { nome: '', responsaveis: [] }]);
  };
  const handleRemoveEtapa = (idx: number) => {
    setEtapas(etapas.filter((_, i) => i !== idx));
  };
  const handleEtapaChange = (idx: number, field: 'nome' | 'responsaveis', value: any) => {
    setEtapas(etapas.map((et, i) => i === idx ? { ...et, [field]: value } : et));
  };

  // Função utilitária para saber se todas as etapas estão concluídas
  const isTarefaConcluida = (tarefa: TarefaDivulgacao) => tarefa.etapas.length > 0 && tarefa.etapas.every(e => e.concluida);

  // Abrir modal para editar tarefa
  const handleEditTarefa = (tarefa: TarefaDivulgacao) => {
    setEditTarefa(tarefa);
    setInfluenciador(tarefa.influenciador);
    setSeguidores(tarefa.seguidores.toString());
    setProdutos(tarefa.produtos);
    setEndereco(tarefa.endereco || '');
    setWhatsapp(tarefa.whatsapp || '');
    setFeedback(tarefa.feedback || '');
    setLeadStatus(tarefa.lead_status || '');
    setParticipantes(tarefa.participantes.map(p => p.id));
    setEtapas(tarefa.etapas.map(et => ({ nome: et.nome, responsaveis: et.responsaveis.map(r => r.id) })));
    setNicho(tarefa.nicho || '');
    setShowModal(true);
  };

  // Criação/edição real no Supabase
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!influenciador || !seguidores || !produtos || participantes.length === 0 || etapas.some(et => !et.nome || et.responsaveis.length === 0)) {
      alert('Preencha todos os campos e etapas!');
      return;
    }
    let tarefaId = editTarefa?.id;
    if (editTarefa) {
      if (!tarefaId) return; // Não deve acontecer, mas garante tipagem
      // UPDATE tarefa
      await supabase.from('divulgacao_tarefas').update({ influenciador, seguidores: Number(seguidores), produtos, endereco, whatsapp }).eq('id', tarefaId);
      // Remove participantes e etapas antigos
      await supabase.from('divulgacao_participantes').delete().eq('tarefa_id', tarefaId);
      const { data: etapasAntigas } = await supabase.from('divulgacao_etapas').select('id').eq('tarefa_id', tarefaId);
      if (etapasAntigas) {
        for (const et of etapasAntigas) {
          await supabase.from('divulgacao_etapa_responsaveis').delete().eq('etapa_id', et.id);
        }
        await supabase.from('divulgacao_etapas').delete().eq('tarefa_id', tarefaId);
      }
    } else {
      // INSERT tarefa
      const { data: tarefa, error: tarefaError } = await supabase
        .from('divulgacao_tarefas')
        .insert({ influenciador, seguidores: Number(seguidores), produtos, endereco, whatsapp })
        .select()
        .single();
      if (tarefaError || !tarefa) {
        alert('Erro ao criar tarefa');
        return;
      }
      tarefaId = tarefa.id;
    }
    if (!tarefaId) return;
    // Participantes
    for (const userId of participantes) {
      await supabase.from('divulgacao_participantes').insert({ tarefa_id: tarefaId, user_id: userId });
    }
    // Etapas e responsáveis
    for (let i = 0; i < etapas.length; i++) {
      const et = etapas[i];
      const { data: etapa, error: etapaError } = await supabase
        .from('divulgacao_etapas')
        .insert({ tarefa_id: tarefaId, nome: et.nome, ordem: i })
        .select()
        .single();
      if (etapaError || !etapa) continue;
      for (const userId of et.responsaveis) {
        await supabase.from('divulgacao_etapa_responsaveis').insert({ etapa_id: etapa.id, user_id: userId });
      }
    }
    setShowModal(false);
    setEditTarefa(null);
    setInfluenciador('');
    setSeguidores('');
    setProdutos('');
    setEndereco('');
    setWhatsapp('');
    setFeedback('');
    setLeadStatus('');
    setParticipantes([]);
    setEtapas([{ nome: '', responsaveis: [] }]);
    fetchTarefas();
  };

  // Atualizar etapa concluída no Supabase
  const handleCheckEtapa = async (etapaId: string, concluida: boolean) => {
    await supabase.from('divulgacao_etapas').update({ concluida: !concluida }).eq('id', etapaId);
    fetchTarefas();
  };

  const tarefasFiltradas = tarefas.filter(tarefa => {
    const searchTerm = search.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      tarefa.influenciador.toLowerCase().includes(searchTerm) ||
      tarefa.produtos.toLowerCase().includes(searchTerm) ||
      (tarefa.endereco || '').toLowerCase().includes(searchTerm) ||
      (tarefa.whatsapp || '').toLowerCase().includes(searchTerm) ||
      (tarefa.feedback || '').toLowerCase().includes(searchTerm) ||
      tarefa.participantes.some(p => p.nome.toLowerCase().includes(searchTerm));
    const matchesLead = !filterLead || tarefa.lead_status === filterLead;
    return matchesSearch && matchesLead;
  });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 min-h-[60vh]">
      {/* Busca e filtro de lead */}
      <div className="flex flex-wrap gap-4 mb-6 items-end">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Busca livre</label>
          <input type="text" className="border rounded px-2 py-1 w-80" placeholder="Buscar por qualquer campo..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Lead</label>
          <select className="border rounded px-2 py-1" value={filterLead} onChange={e => setFilterLead(e.target.value)}>
            <option value="">Todos</option>
            <option value="lead">Virou lead</option>
            <option value="nao_lead">Não virou lead</option>
          </select>
        </div>
        <button className="ml-2 px-3 py-1 rounded bg-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-300" onClick={() => { setSearch(''); setFilterLead(''); }}>Limpar filtros</button>
      </div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Tarefas de Divulgação de Produtos</h2>
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
          onClick={() => { setShowModal(true); setEditTarefa(null); setInfluenciador(''); setSeguidores(''); setProdutos(''); setEndereco(''); setWhatsapp(''); setFeedback(''); setLeadStatus(''); setParticipantes([]); setEtapas([{ nome: '', responsaveis: [] }]); }}
        >
          Nova Tarefa de Divulgação
        </button>
      </div>
      {loading ? (
        <div className="text-center text-gray-500 py-12">Carregando tarefas...</div>
      ) : (
        <div className="space-y-6">
          {tarefasFiltradas.length === 0 ? (
            <p className="text-gray-500 text-center">Nenhuma tarefa de divulgação encontrada.</p>
          ) : (
            tarefasFiltradas.map(tarefa => {
              const expanded = expandedId === tarefa.id;
              const isEditingFeedback = editingFeedbackId === tarefa.id;
              return (
                <div key={tarefa.id} className={`border rounded-lg p-4 shadow-sm flex flex-col gap-2 cursor-pointer transition-all duration-200
                  ${tarefa.lead_status === 'lead' ? 'bg-green-50 border-green-400' : tarefa.lead_status === 'nao_lead' ? 'bg-orange-50 border-orange-400' : isTarefaConcluida(tarefa) ? 'bg-green-50 border-green-400' : ''}`}
                  onClick={e => {
                    // Evita expandir ao clicar em botões internos
                    if ((e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).tagName === 'SELECT' || (e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).tagName === 'INPUT') return;
                    // Ao expandir um card, sincronizar feedback/leadStatus locais
                    if (!expanded) {
                      setEditTarefa(tarefa);
                      setFeedback(tarefa.feedback || '');
                      setLeadStatus(tarefa.lead_status || '');
                      setNicho(tarefa.nicho || '');
                      setEditingFeedbackId(null);
                    }
                    setExpandedId(expanded ? null : tarefa.id);
                  }}
                >
                  <div className="flex flex-wrap gap-4 items-center justify-between">
                    <div>
                      <span className="font-semibold text-blue-700 mr-2">{tarefa.influenciador}</span>
                      <span className="text-sm text-gray-500">{tarefa.seguidores.toLocaleString()} seguidores</span>
                    </div>
                    <div className="text-sm text-gray-700">Produtos: <span className="font-medium">{tarefa.produtos}</span></div>
                    <div className="text-sm text-gray-700">Endereço: <span className="font-medium">{tarefa.endereco || '-'}</span></div>
                    <div className="text-sm text-gray-700">WhatsApp: <span className="font-medium">{tarefa.whatsapp || '-'}</span></div>
                    <div className="text-sm text-gray-700">Participantes: {tarefa.participantes.length > 0 ? tarefa.participantes.map(p => p.nome).join(', ') : 'Nenhum'}</div>
                    {isTarefaConcluida(tarefa) && (
                      <span className="ml-2 px-2 py-0.5 rounded text-xs font-semibold bg-green-200 text-green-800 border border-green-400">Concluída</span>
                    )}
                    <button className="ml-2 px-3 py-1 rounded bg-blue-100 text-blue-700 text-xs font-semibold hover:bg-blue-200" onClick={e => { e.stopPropagation(); handleEditTarefa(tarefa); }}>Editar</button>
                    <button className="ml-2 px-2 py-1 rounded text-xs font-semibold border border-gray-300 bg-white hover:bg-gray-100" onClick={e => { e.stopPropagation(); setExpandedId(expanded ? null : tarefa.id); }}>{expanded ? '▲' : '▼'}</button>
                  </div>
                  {expanded && (
                    <>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {tarefa.etapas.map((etapa) => (
                          <div key={etapa.id} className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${etapa.concluida ? 'bg-green-100 border-green-400 text-green-800' : 'bg-gray-100 border-gray-300 text-gray-700'}`}>
                            <input
                              type="checkbox"
                              checked={etapa.concluida}
                              onChange={() => handleCheckEtapa(etapa.id, etapa.concluida)}
                              className="accent-green-600 cursor-pointer"
                            />
                            {etapa.nome}
                            <span className="ml-1 text-gray-400">[{etapa.responsaveis.map(r => r.nome).join(', ')}]</span>
                          </div>
                        ))}
                      </div>
                      <form onSubmit={handleSubmit} className="flex flex-row gap-8 mt-2 items-start">
                        <div className="flex flex-col flex-1 max-w-4xl">
                          <label className="font-semibold mb-1">Obs / Feedback:</label>
                          <textarea
                            className="border rounded px-2 py-1 w-full min-h-[40px] max-h-[80px] resize-vertical"
                            placeholder="Feedback..."
                            value={editTarefa && editTarefa.id === tarefa.id ? feedback : tarefa.feedback || ''}
                            onChange={e => { setEditTarefa(tarefa); setFeedback(e.target.value); }}
                            readOnly={!isEditingFeedback}
                          />
                          <div className="mt-2">
                            {!isEditingFeedback && (
                              <button type="button" className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs font-semibold hover:bg-gray-300" onClick={e => { e.stopPropagation(); setEditTarefa(tarefa); setFeedback(tarefa.feedback || ''); setEditingFeedbackId(tarefa.id); }}>Editar Obs / Feedback</button>
                            )}
                            {isEditingFeedback && (
                              <button type="button" className="ml-2 px-3 py-1 bg-green-600 text-white rounded self-start" onClick={async e => {
                                e.stopPropagation();
                                await supabase.from('divulgacao_tarefas').update({ feedback }).eq('id', tarefa.id);
                                setEditTarefa(null);
                                setFeedback('');
                                setEditingFeedbackId(null);
                                fetchTarefas();
                              }}>Salvar Obs / Feedback</button>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col min-w-[180px] justify-center">
                          <label className="font-semibold mb-1">Nicho</label>
                          <select
                            className="border rounded px-2 py-1"
                            value={editTarefa && editTarefa.id === tarefa.id ? nicho : tarefa.nicho || ''}
                            onChange={async e => {
                              setEditTarefa(tarefa);
                              setNicho(e.target.value as 'Food Service' | 'Varejo' | 'Exportação' | 'Institucional' | 'Influenciadores' | '');
                              await supabase.from('divulgacao_tarefas').update({ nicho: e.target.value as 'Food Service' | 'Varejo' | 'Exportação' | 'Institucional' | 'Influenciadores' | null }).eq('id', tarefa.id);
                              fetchTarefas();
                            }}
                          >
                            <option value="">Selecione...</option>
                            <option value="Food Service">Food Service</option>
                            <option value="Varejo">Varejo</option>
                            <option value="Exportação">Exportação</option>
                            <option value="Institucional">Institucional</option>
                            <option value="Influenciadores">Influenciadores</option>
                          </select>
                        </div>
                        <div className="flex flex-col min-w-[180px] justify-center">
                          <label className="font-semibold mb-1">Virou lead?</label>
                          <div className="flex gap-2 items-center">
                            <button type="button" className={`px-3 py-1 rounded-full font-semibold border text-sm ${((editTarefa && editTarefa.id === tarefa.id ? leadStatus : tarefa.lead_status) === 'lead') ? 'bg-green-600 text-white border-green-700' : 'bg-white text-green-700 border-green-400'}`} onClick={async e => {
                              e.stopPropagation();
                              setEditTarefa(tarefa);
                              setLeadStatus('lead');
                              await supabase.from('divulgacao_tarefas').update({ lead_status: 'lead' }).eq('id', tarefa.id);
                              fetchTarefas();
                            }}>Virou lead</button>
                            <button type="button" className={`px-3 py-1 rounded-full font-semibold border text-sm ${((editTarefa && editTarefa.id === tarefa.id ? leadStatus : tarefa.lead_status) === 'nao_lead') ? 'bg-orange-500 text-white border-orange-700' : 'bg-white text-orange-700 border-orange-400'}`} onClick={async e => {
                              e.stopPropagation();
                              setEditTarefa(tarefa);
                              setLeadStatus('nao_lead');
                              await supabase.from('divulgacao_tarefas').update({ lead_status: 'nao_lead' }).eq('id', tarefa.id);
                              fetchTarefas();
                            }}>Não virou lead</button>
                          </div>
                        </div>
                      </form>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
      {/* Modal de criação/edição de tarefa */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto relative">
            <button className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-2xl font-bold" onClick={() => { setShowModal(false); setEditTarefa(null); }}>&times;</button>
            <h3 className="text-xl font-bold mb-4">{editTarefa ? 'Editar Tarefa de Divulgação' : 'Nova Tarefa de Divulgação'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">@ do Influenciador</label>
                <input type="text" className="w-full border rounded px-3 py-2" value={influenciador} onChange={e => setInfluenciador(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número de Seguidores</label>
                <input type="number" className="w-full border rounded px-3 py-2" value={seguidores} onChange={e => setSeguidores(e.target.value)} required min={0} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Produtos Enviados</label>
                <input type="text" className="w-full border rounded px-3 py-2" value={produtos} onChange={e => setProdutos(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
                <input type="text" className="w-full border rounded px-3 py-2" value={endereco} onChange={e => setEndereco(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
                <input type="text" className="w-full border rounded px-3 py-2" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Participantes</label>
                <select multiple className="w-full border rounded px-3 py-2" value={participantes} onChange={e => setParticipantes(Array.from(e.target.selectedOptions, o => o.value))} required>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <span className="text-xs text-gray-400">Segure Ctrl ou Cmd para selecionar vários</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Etapas</label>
                <div className="space-y-2">
                  {etapas.map((et, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input type="text" placeholder="Nome da etapa" className="border rounded px-2 py-1 flex-1" value={et.nome} onChange={e => handleEtapaChange(idx, 'nome', e.target.value)} required />
                      <select multiple className="border rounded px-2 py-1" value={et.responsaveis} onChange={e => handleEtapaChange(idx, 'responsaveis', Array.from(e.target.selectedOptions, o => o.value))} required>
                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                      <button type="button" className="text-red-500 text-lg font-bold px-2" onClick={() => handleRemoveEtapa(idx)} title="Remover etapa">&times;</button>
                    </div>
                  ))}
                  <button type="button" className="text-blue-600 hover:underline text-sm mt-1" onClick={handleAddEtapa}>+ Adicionar etapa</button>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" className="px-4 py-2 bg-gray-200 rounded" onClick={() => { setShowModal(false); setEditTarefa(null); }}>Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DivulgacaoView; 