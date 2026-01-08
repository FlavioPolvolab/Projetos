import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Comment } from '../types';
import { useProjectsContext } from '../contexts/ProjectsContext';
import ProjectsView from './ProjectsView';
import TaskDetailsModal from './TaskDetailsModal';
import { formatDateToLocal, formatDateUTC } from '../lib/formatDate';
import { CommentRead } from '../lib/database.types';

interface DBComment {
  id: string;
  task_id: string;
  content: string;
  author_id: string;
  created_at: string;
  parent_id?: string;
  mentioned_user_id?: string;
}

type UserMini = { id: string; name: string; avatar_url?: string | null };

interface CommentsThreadProps {
  taskId?: string; // nunca null
  taskTitle?: string;
  users?: UserMini[];
}

function normalize(str: string) {
  return str.normalize('NFD').replace(/[^\w\s]/g, '').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Função para calcular a posição do cursor RELATIVA ao textarea
function getCaretCoordinatesRelative(textarea: HTMLTextAreaElement, position: number) {
  // Cria um div espelho
  const div = document.createElement('div');
  const style = window.getComputedStyle(textarea);
  for (const prop of style) {
    div.style.setProperty(prop, style.getPropertyValue(prop));
  }
  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.whiteSpace = 'pre-wrap';
  div.style.wordWrap = 'break-word';
  div.style.overflow = 'auto';
  div.style.width = textarea.offsetWidth + 'px';
  div.style.height = textarea.offsetHeight + 'px';
  div.style.padding = style.padding;
  div.style.border = style.border;
  div.style.boxSizing = style.boxSizing;
  div.scrollTop = textarea.scrollTop;
  div.scrollLeft = textarea.scrollLeft;
  div.textContent = textarea.value.substring(0, position);
  // Cria um span marcador
  const span = document.createElement('span');
  span.textContent = textarea.value.substring(position) || '.';
  div.appendChild(span);
  textarea.parentNode!.appendChild(div);
  const rect = span.getBoundingClientRect();
  const divRect = div.getBoundingClientRect();
  // Posição relativa ao textarea
  const top = rect.top - divRect.top;
  const left = rect.left - divRect.left;
  textarea.parentNode!.removeChild(div);
  return { top, left };
}

// Função utilitária para gerar nome único de arquivo
function generateUniqueFilename(filename: string) {
  const ext = filename.split('.').pop();
  const base = filename.replace(/\.[^/.]+$/, "");
  return `${base}_${Date.now()}.${ext}`;
}

// Garante que o valor seja string ou undefined, nunca null
function safeString(val: string | null | undefined): string | undefined {
  return typeof val === 'string' ? val : undefined;
}

const CommentsThread: React.FC<CommentsThreadProps> = ({ taskId: propTaskId, taskTitle: propTaskTitle, users: usersProp }) => {
  const { user } = useAuth();
  const { projects } = useProjectsContext();
  const [comments, setComments] = useState<Comment[]>([]);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [mentionUser, setMentionUser] = useState<string>('');
  const [users, setUsers] = useState<UserMini[]>(usersProp || []);
  const normalizedTaskId = propTaskId ?? undefined;
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>(
    typeof normalizedTaskId === 'string' ? normalizedTaskId : undefined
  );
  const [loading, setLoading] = useState(true);
  const [mentionSuggestions, setMentionSuggestions] = useState<UserMini[]>([]);
  const mentionInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<HTMLUListElement>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [modalTask, setModalTask] = useState<any>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const newCommentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [mentionDropdown, setMentionDropdown] = useState<{ open: boolean; position: { top: number; left: number } }>({ open: false, position: { top: 0, left: 0 } });
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionUserId, setMentionUserId] = useState<string | null>(null);
  const [readComments, setReadComments] = useState<{ [commentId: string]: boolean }>({});
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  // Estado para modal de anexo
  const [attachmentModal, setAttachmentModal] = useState<{ url: string; name: string } | null>(null);

  // Buscar todos os usuários se não vier por prop
  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase.from('users').select('id, name, avatar_url');
      setUsers(data || []);
    };
    fetchUsers();
  }, []);

  // Buscar comentários: incluir comentários de tarefas criadas pelo usuário
  const fetchComments = async (opts?: { keepLoading?: boolean }) => {
    try {
      if (!opts?.keepLoading) setLoading(true);
      if (!user) {
        setLoading(false);
        return;
      }
      // Buscar IDs das tarefas criadas pelo usuário ou atribuídas ao usuário
      let myTaskIds: string[] = [];
      if (user && typeof user.id === 'string') {
        const { data: myTasks } = await supabase
          .from('tasks')
          .select('id')
          .or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`);
        myTaskIds = (myTasks || []).map(t => t.id).filter(Boolean);
      }
      
      // NOVA LÓGICA: Buscar tarefas onde o usuário foi mencionado em algum comentário
      // Quando um usuário é mencionado em um comentário de uma tarefa, ele deve poder ver
      // TODOS os comentários daquela tarefa, não apenas o comentário onde foi mencionado
      let mentionedTaskIds: string[] = [];
      if (user && typeof user.id === 'string') {
        const { data: mentionedComments } = await supabase
          .from('task_comments')
          .select('task_id')
          .eq('mentioned_user_id', user.id);
        if (mentionedComments) {
          // Extrair IDs únicos das tarefas onde o usuário foi mencionado
          mentionedTaskIds = Array.from(new Set(mentionedComments.map(c => c.task_id).filter(Boolean)));
        }
      }
      
      // Combinar todas as tarefas relevantes:
      // - Tarefas criadas/atribuídas ao usuário
      // - Tarefas onde o usuário foi mencionado em algum comentário
      const allRelevantTaskIds = Array.from(new Set([...myTaskIds, ...mentionedTaskIds]));
      
      // Buscar comentários onde:
      // - o usuário é autor (seus próprios comentários)
      // - o usuário é mencionado diretamente (comentário específico que o menciona)
      // - a tarefa está na lista de tarefas relevantes (incluindo tarefas onde foi mencionado)
      //   Isso garante que quando mencionado em uma tarefa, o usuário vê TODOS os comentários daquela tarefa
      let orQuery = `author_id.eq.${user.id},mentioned_user_id.eq.${user.id}`;
      if (allRelevantTaskIds.length > 0) {
        orQuery += `,task_id.in.(${allRelevantTaskIds.join(',')})`;
      }
      const { data: dbComments, error: commentsError } = await supabase
        .from('task_comments')
        .select(`
          id, content, created_at, parent_id, mentioned_user_id, author_id, attachment_url,
          task:tasks (
            id, title, status, priority, start_date, due_date, created_by, assigned_to,
            stage:stages (
              project:projects (
                id, name
              )
            )
          )
        `)
        .or(orQuery)
        .order('created_at', { ascending: true });
      if (commentsError) {
        console.error('[Comments] Erro ao buscar comentários:', commentsError);
        setLoading(false);
        return;
      }
      // Montar threads e enriquecer com nomes
      const commentMap: { [id: string]: Comment & { projectName?: string; mentionedUser?: { id: string; name: string }, mentionedIds?: string[], taskData?: any } } = {};
      (dbComments || []).forEach((c: any) => {
        const author = users.find(u => u.id === c.author_id);
        const task = c.task;
        let projectName = '';
        if (task && task.stage && task.stage.project) {
          projectName = task.stage.project.name || '';
        }
        let mentionedUser = undefined;
        if (c.mentioned_user_id) {
          const u = users.find(u => u.id === c.mentioned_user_id);
          if (u) mentionedUser = { id: u.id, name: u.name };
        }
        const parentId: string | undefined = typeof c.parent_id === 'string' && c.parent_id ? c.parent_id : undefined;
        commentMap[c.id] = {
          id: c.id,
          content: c.content,
          author: author?.name || 'Usuário',
          authorId: c.author_id,
          authorAvatar: typeof author?.avatar_url === 'string' ? author.avatar_url : undefined,
          createdAt: new Date(c.created_at),
          taskId: task?.id,
          taskTitle: task?.title || '',
          parentId,
          replies: [],
          projectName,
          mentionedUser,
          mentionedIds: c.mentioned_user_id ? [c.mentioned_user_id] : [],
          taskData: task,
          attachment_url: safeString(c.attachment_url),
        };
      });
      Object.values(commentMap).forEach(c => {
        if (c.parentId && commentMap[c.parentId]) {
          commentMap[c.parentId].replies = commentMap[c.parentId].replies || [];
          commentMap[c.parentId].replies!.push(c);
        }
      });
      const allComments = Object.values(commentMap);
      setComments(allComments);
      // Agrupar comentários por tarefa para renderização da tabela
      const tasksFromComments = Array.from(
        new Map(
          allComments
            .filter((c: any) => c.taskId && (c as any).taskData)
            .map((c: any) => [c.taskId, (c as any).taskData])
        ).values()
      );
      setLoading(false);
    } catch (err) {
      console.error('[Comments] Erro inesperado ao buscar comentários:', err);
      setLoading(false);
    }
  };

  // Autocomplete de menção inline
  useEffect(() => {
    if (!mentionQuery) {
      setMentionSuggestions([]);
      setMentionDropdown({ open: false, position: { top: 0, left: 0 } });
      return;
    }
    const filtered = users.filter(u =>
      u.name.toLowerCase().includes(mentionQuery.toLowerCase()) && u.id !== user?.id
    );
    setMentionSuggestions(filtered.slice(0, 5));
    setMentionDropdown(d => ({ ...d, open: filtered.length > 0 }));
  }, [mentionQuery, users, user]);

  // Função para inserir menção no textarea
  const insertMention = (name: string, id: string, which: 'reply' | 'new') => {
    const textarea = which === 'reply' ? replyTextareaRef.current : newCommentTextareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = replyContent;
    // Encontrar a última ocorrência de @ antes do cursor
    const atIdx = value.lastIndexOf('@', start - 1);
    if (atIdx === -1) return;
    const before = value.slice(0, atIdx + 1);
    const after = value.slice(end);
    const newValue = before + name + ' ' + after;
    setReplyContent(newValue);
    setMentionQuery('');
    setMentionDropdown({ open: false, position: { top: 0, left: 0 } });
    setMentionUserId(id);
    // Reposicionar o cursor após a menção
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(before.length + name.length + 1, before.length + name.length + 1);
    }, 0);
  };

  // Detectar @ e abrir autocomplete
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>, which: 'reply' | 'new') => {
    const value = e.target.value;
    setReplyContent(value);
    const cursor = e.target.selectionStart;
    const textUntilCursor = value.slice(0, cursor);
    // Regex para pegar a palavra após o último @
    const match = textUntilCursor.match(/@([\w\s]*)$/);
    if (match) {
      setMentionQuery(match[1]);
      // Calcular posição precisa do dropdown
      const ref = which === 'reply' ? replyTextareaRef.current : newCommentTextareaRef.current;
      if (ref) {
        const coords = getCaretCoordinatesRelative(ref, cursor);
        setMentionDropdown({
          open: true,
          position: {
            top: coords.top + 20, // 20px abaixo da linha
            left: coords.left
          }
        });
      } else {
      setMentionDropdown(d => ({ ...d, open: true }));
      }
    } else {
      setMentionQuery('');
      setMentionDropdown(d => ({ ...d, open: false }));
    }
  };

  // Enviar resposta
  const handleReply = async (parentId: string) => {
    if (!user) return;
    let parent = comments.find(c => c.id === parentId);
    const tIdReply = parent?.taskId ?? normalizedTaskId ?? selectedTaskId;
    if (!tIdReply) return;
    await supabase.from('task_comments').insert({
      task_id: tIdReply,
      content: replyContent,
      author_id: user.id,
      parent_id: parentId,
      mentioned_user_id: mentionUserId
    });
    if (mentionUserId) {
      const mention = users.find(u => u.id === mentionUserId);
      if (mention) {
        await supabase.from('notifications').insert({
          user_id: mention.id,
          type: 'task_assigned',
          title: 'Você foi mencionado em um comentário',
          message: `${user.name} mencionou você em um comentário de tarefa`,
          task_id: tIdReply,
          project_name: (parent as any)?.projectName || propTaskTitle || '',
          priority: 'medium'
        });
      }
    }
    setReplyTo(null);
    setReplyContent('');
    setMentionQuery('');
    setMentionDropdown({ open: false, position: { top: 0, left: 0 } });
    setMentionUserId(null);
    await fetchComments();
  };

  // Adicionar comentário raiz
  const handleAddComment = async () => {
    if (!user || !replyContent.trim()) return;
    const tIdRoot = normalizedTaskId ?? selectedTaskId;
    if (!tIdRoot) return;
    const mention = mentionUserId ? users.find(u => u.id === mentionUserId) : undefined;
    let fileUrl: string | undefined = undefined;
    if (file) {
      setUploading(true);
      const uniqueName = generateUniqueFilename(file.name);
      const { data, error } = await supabase.storage.from('comments-attachments').upload(uniqueName, file);
      setUploading(false);
      if (error) {
        alert('Erro ao fazer upload do arquivo: ' + error.message);
        return;
      }
      fileUrl = data?.path
        ? safeString(supabase.storage.from('comments-attachments').getPublicUrl(data.path).data.publicUrl)
        : undefined;
      fileUrl = safeString(fileUrl);
    }
    await supabase.from('task_comments').insert({
      task_id: tIdRoot,
      content: replyContent,
      author_id: user.id,
      mentioned_user_id: mentionUserId,
      attachment_url: fileUrl
    });
    if (mention) {
      await supabase.from('notifications').insert({
        user_id: mention.id,
        type: 'task_assigned',
        title: 'Você foi mencionado em um comentário',
        message: `${user.name} mencionou você em um comentário de tarefa`,
        task_id: tIdRoot,
        project_name: propTaskTitle || (tasksFromComments.find(t => t.id === tIdRoot)?.title) || '',
        priority: 'medium'
      });
    }
    setReplyContent('');
    setMentionUser('');
    setFile(null);
    setMentionUserId(null);
    await fetchComments();
  };

  // Autocomplete fecha ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target as Node) && mentionInputRef.current && !mentionInputRef.current.contains(event.target as Node)) {
        setMentionSuggestions([]);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- useEffect para buscar comentários (dependências simplificadas) ---
  useEffect(() => {
    if (users.length > 0) {
      fetchComments();
    }
    // eslint-disable-next-line
  }, [user, normalizedTaskId, selectedTaskId, projects, users]);

  // Função para abrir modal de detalhes da tarefa
  const handleOpenTaskModal = (task: any) => {
    setModalTask(task);
    setShowTaskModal(true);
  };

  // Para renderização da tabela, use tasks extraídas dos comentários:
  const tasksFromComments = Array.from(
    new Map(
      comments
        .filter((c: any) => c.taskId && (c as any).taskData)
        .map((c: any) => [c.taskId, (c as any).taskData])
    ).values()
  );
  const filteredTasks = propTaskId
    ? tasksFromComments.filter(t => t.id === propTaskId)
    : tasksFromComments;
  const filteredComments = propTaskId
    ? comments.filter(c => c.taskId === propTaskId)
    : comments;

  // Buscar comentários lidos do usuário logado
  useEffect(() => {
    const fetchReadComments = async () => {
      if (!user) return;
      const { data: readRows } = await supabase
        .from('comment_reads')
        .select('comment_id')
        .eq('user_id', user.id);
      const readMap: { [commentId: string]: boolean } = {};
      (readRows || []).forEach((r: any) => { readMap[r.comment_id] = true; });
      setReadComments(readMap);
    };
    fetchReadComments();
  }, [user]);

  // Função para marcar comentário como lido no banco
  const markCommentAsRead = async (commentId: string) => {
    if (!user) return;
    setReadComments(prev => ({ ...prev, [commentId]: true }));
    await supabase.from('comment_reads').upsert([
      { comment_id: commentId, user_id: user.id }
    ]);
  };

  // Função para saber se comentário está lido
  const isCommentRead = (commentId: string) => !!readComments[commentId];

  // Ordenar comentários do mais recente para o mais antigo
  const sortedComments = [...comments].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <div className="max-w-6xl mx-auto px-2 py-8">
      <h2 className="text-2xl font-bold mb-8">Comentários do sistema</h2>
      {propTaskId ? (
        // Modal: só cards de comentário, sem tabela
        <div className="space-y-6">
          {filteredComments.length === 0 && (
            <div className="text-gray-500 text-center py-8">Nenhum comentário para esta tarefa.</div>
          )}
          {/* Renderização aninhada de comentários (thread) */}
          {(() => {
            // Função recursiva para renderizar comentários e suas respostas
            const renderCommentThread = (comment: any, level = 0) => (
              <li
                key={comment.id}
                className={`rounded-xl shadow p-4 border border-gray-100 list-none transition-colors ${isCommentRead(comment.id) ? 'bg-white' : 'bg-red-100'} mt-2 ml-${level * 6}`}
                onClick={() => markCommentAsRead(comment.id)}
              >
              <div className="flex items-center gap-3 mb-2">
                {comment.authorAvatar ? <img src={comment.authorAvatar || undefined} alt="avatar" className="w-8 h-8 rounded-full border" /> : <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-base font-bold">?</div>}
                <div>
                  <div className="font-semibold text-gray-800 text-sm">{comment.author}</div>
                  <div className="text-xs text-gray-400">{comment.createdAt.toLocaleString()}</div>
                </div>
              </div>
                <div className="mb-2 whitespace-pre-line text-base text-gray-900 break-all max-w-full">{comment.content}</div>
                {/* Exibir anexo, se houver */}
                {typeof comment.attachment_url === 'string' && comment.attachment_url && (
                  <div className="mt-2">
                    <button
                      className="text-blue-600 underline text-xs flex items-center gap-1"
                      onClick={() => comment.attachment_url && setAttachmentModal({ url: comment.attachment_url, name: comment.attachment_url.split('/').pop() || 'anexo' })}
                    >
                      📎 {comment.attachment_url ? comment.attachment_url.split('/').pop() : ''}
                    </button>
                  </div>
                )}
              {((comment as any).mentionedUser) && (
                <div className="text-xs text-blue-600 mb-2">Mencionou: {(comment as any).mentionedUser.name}</div>
              )}
              <button
                className="text-xs text-blue-600 hover:underline ml-2"
                onClick={() => setReplyTo(comment.id)}
              >
                Responder
              </button>
              {replyTo === comment.id && (
                <div className="mt-2 relative">
                    <div className="relative">
                  <textarea
                        ref={replyTextareaRef}
                    className="w-full border rounded p-2 text-sm"
                    value={replyContent}
                        onChange={e => handleTextareaChange(e, 'reply')}
                    placeholder="Digite sua resposta... Use @ para mencionar alguém."
                    rows={2}
                  />
                  {mentionDropdown.open && mentionSuggestions.length > 0 && (
                    <ul
                          ref={autocompleteRef}
                          className="bg-white border rounded shadow mt-1 max-h-40 overflow-y-auto absolute z-10"
                          style={{
                            minWidth: 200,
                            top: mentionDropdown.position.top ?? 0,
                            left: mentionDropdown.position.left ?? 0,
                            position: 'absolute'
                          }}
                    >
                      {mentionSuggestions.map(u => (
                        <li
                          key={u.id}
                          className="px-3 py-2 hover:bg-blue-100 cursor-pointer transition-colors"
                              onClick={() => insertMention(u.name, u.id, replyTo ? 'reply' : 'new')}
                        >
                          <span className="text-sm font-medium">{u.name}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                    </div>
                  <div className="flex gap-2 mt-1">
                    <button
                      className="px-3 py-1 bg-blue-600 text-white rounded text-xs"
                      onClick={async () => {
                        await handleReply(comment.id);
                      }}
                    >
                      Enviar
                    </button>
                    <button
                      className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs"
                      onClick={() => { setReplyTo(null); setReplyContent(''); setMentionUserId(null); }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
                {/* Renderizar respostas (filhos) recursivamente */}
                {comment.replies && comment.replies.length > 0 && (
                  <ul className="ml-6 mt-2">
                    {comment.replies.map((child: any) => renderCommentThread(child, level + 1))}
                  </ul>
                )}
            </li>
            );
            // Renderizar apenas comentários raiz (sem parentId)
            return filteredComments
              .filter((c: any) => !c.parentId)
              .sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime())
              .map((c: any) => renderCommentThread(c));
          })()}
          {/* Novo comentário raiz */}
          <div className="mt-4">
            <div className="relative">
            <textarea
                ref={newCommentTextareaRef}
              className="w-full border rounded p-2 text-sm"
              value={replyContent}
                onChange={e => handleTextareaChange(e, 'new')}
              placeholder="Escreva um novo comentário... Use @ para mencionar alguém."
              rows={2}
            />
            <input
              type="file"
              className="mt-2 block"
              onChange={e => setFile(e.target.files?.[0] || null)}
              disabled={uploading}
            />
            {file && <div className="text-xs text-gray-600 mt-1">Arquivo selecionado: {file.name}</div>}
            {uploading && <div className="text-xs text-blue-600 mt-1">Enviando arquivo...</div>}
            {mentionDropdown.open && mentionSuggestions.length > 0 && (
              <ul
                  ref={autocompleteRef}
                  className="bg-white border rounded shadow mt-1 max-h-40 overflow-y-auto absolute z-10"
                  style={{
                    minWidth: 200,
                    top: mentionDropdown.position.top ?? 0,
                    left: mentionDropdown.position.left ?? 0,
                    position: 'absolute'
                  }}
              >
                {mentionSuggestions.map(u => (
                  <li
                    key={u.id}
                    className="px-3 py-2 hover:bg-blue-100 cursor-pointer transition-colors"
                    onClick={() => insertMention(u.name, u.id, 'new')}
                  >
                    <span className="text-sm font-medium">{u.name}</span>
                  </li>
                ))}
              </ul>
            )}
            </div>
            <div className="flex gap-2 mt-2">
              <button
                className="px-3 py-1 bg-blue-600 text-white rounded text-xs"
                onClick={handleAddComment}
                disabled={!replyContent.trim()}
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      ) : (
        // Tabela completa
        <div className="overflow-x-auto bg-white rounded-2xl shadow border border-gray-100">
          <table className="min-w-full text-sm text-left">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3">PROJETO</th>
                <th className="px-4 py-3">TÍTULO</th>
                <th className="px-4 py-3">STATUS</th>
                <th className="px-4 py-3">PRIORIDADE</th>
                <th className="px-4 py-3">INÍCIO</th>
                <th className="px-4 py-3">PRAZO</th>
                <th className="px-4 py-3 text-center">NÃO LIDAS</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task: any) => {
                const taskComments = comments.filter((c: any) => c.taskId === task.id);
                return (
                  <React.Fragment key={task.id}>
                    <tr
                      className="border-b hover:bg-blue-50 transition cursor-pointer"
                      onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                    >
                      <td className="px-4 py-3 font-medium">{task?.stage?.project?.name || '-'}</td>
                      <td className="px-4 py-3 text-blue-700 hover:underline cursor-pointer" onClick={e => { e.stopPropagation(); handleOpenTaskModal(task); }}>{task.title}</td>
                      <td className="px-4 py-3">
                        <span className={
                          `px-2 py-1 rounded font-semibold ` +
                          (task.status === 'completed' ? 'bg-green-100 text-green-700' :
                            task.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
                            task.status === 'pending' ? 'bg-gray-100 text-gray-700' :
                            'bg-yellow-100 text-yellow-700')
                        }>
                          {task.status === 'completed' ? 'Concluída' :
                            task.status === 'in-progress' ? 'Em Andamento' :
                            task.status === 'pending' ? 'Pendente' :
                            task.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={
                          `px-2 py-1 rounded font-semibold ` +
                          (task.priority === 'high' ? 'bg-red-100 text-red-700' :
                            task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700')
                        }>
                          {task.priority === 'high' ? 'Alta' :
                            task.priority === 'medium' ? 'Média' :
                            'Baixa'}
                        </span>
                      </td>
                      <td className="px-4 py-3">{task.start_date ? formatDateToLocal(task.start_date) : '-'}</td>
                      <td className="px-4 py-3">{task.due_date ? formatDateToLocal(task.due_date) : '-'}</td>
                      <td className="px-4 py-3 text-center">
                        {comments.filter(c => c.taskId === task.id && !isCommentRead(c.id)).length > 0 && (
                          <span className="inline-block w-3 h-3 rounded-full bg-red-500"></span>
                        )}
                      </td>
                    </tr>
                    {expandedTaskId === task.id && taskComments.length > 0 && (
                      <tr>
                        <td colSpan={6} className="bg-blue-50 px-6 py-6">
                          <ul className="space-y-6">
                            {sortedComments.filter(c => c.taskId === task.id).map(comment => (
                              <li
                                key={comment.id}
                                className={`rounded-xl shadow p-4 border border-gray-100 transition-colors ${isCommentRead(comment.id) ? 'bg-white' : 'bg-red-100'}`}
                                onClick={() => markCommentAsRead(comment.id)}
                              >
                                <div className="flex items-center gap-3 mb-2">
                                  {comment.authorAvatar ? <img src={comment.authorAvatar || undefined} alt="avatar" className="w-8 h-8 rounded-full border" /> : <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-base font-bold">?</div>}
                                  <div>
                                    <div className="font-semibold text-gray-800 text-sm">{comment.author}</div>
                                    <div className="text-xs text-gray-400">{comment.createdAt.toLocaleString()}</div>
                                  </div>
                                </div>
                                <div className="mb-2 whitespace-pre-line text-base text-gray-900 break-all max-w-full">{comment.content}</div>
                                {/* Exibir anexo, se houver */}
                                {typeof comment.attachment_url === 'string' && comment.attachment_url && (
                                  <div className="mt-2">
                                    <button
                                      className="text-blue-600 underline text-xs flex items-center gap-1"
                                      onClick={() => comment.attachment_url && setAttachmentModal({ url: comment.attachment_url, name: comment.attachment_url.split('/').pop() || 'anexo' })}
                                    >
                                      📎 {comment.attachment_url ? comment.attachment_url.split('/').pop() : ''}
                                    </button>
                                  </div>
                                )}
                                {((comment as any).mentionedUser) && (
                                  <div className="text-xs text-blue-600 mb-2">Mencionou: {(comment as any).mentionedUser.name}</div>
                                )}
                                <button
                                  className="text-xs text-blue-600 hover:underline ml-2"
                                  onClick={e => { e.stopPropagation(); setReplyTo(comment.id); }}
                                >
                                  Responder
                                </button>
                                {replyTo === comment.id && (
                                  <div className="mt-2 relative">
                                    <div className="relative">
                                    <textarea
                                        ref={replyTextareaRef}
                                      className="w-full border rounded p-2 text-sm"
                                      value={replyContent}
                                        onChange={e => handleTextareaChange(e, 'reply')}
                                      placeholder="Digite sua resposta... Use @ para mencionar alguém."
                                      rows={2}
                                    />
                                    {mentionDropdown.open && mentionSuggestions.length > 0 && (
                                      <ul
                                          ref={autocompleteRef}
                                          className="bg-white border rounded shadow mt-1 max-h-40 overflow-y-auto absolute z-10"
                                          style={{
                                            minWidth: 200,
                                            top: mentionDropdown.position.top ?? 0,
                                            left: mentionDropdown.position.left ?? 0,
                                            position: 'absolute'
                                          }}
                                      >
                                        {mentionSuggestions.map(u => (
                                          <li
                                            key={u.id}
                                            className="px-3 py-2 hover:bg-blue-100 cursor-pointer transition-colors"
                                            onClick={() => insertMention(u.name, u.id, replyTo ? 'reply' : 'new')}
                                          >
                                            <span className="text-sm font-medium">{u.name}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                    </div>
                                    <div className="flex gap-2 mt-1">
                                      <button
                                        className="px-3 py-1 bg-blue-600 text-white rounded text-xs"
                                        onClick={async () => {
                                          await handleReply(comment.id);
                                        }}
                                      >
                                        Enviar
                                      </button>
                                      <button
                                        className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs"
                                        onClick={() => { setReplyTo(null); setReplyContent(''); setMentionUserId(null); }}
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {/* Modal de detalhes da tarefa */}
      {showTaskModal && modalTask ? (
        <TaskDetailsModal 
          isOpen={showTaskModal} 
          onClose={() => {
            setShowTaskModal(false);
            setTimeout(() => setModalTask(null), 0);
          }} 
          task={modalTask} 
          users={users.map(u => ({
            ...u,
            email: (u as any).email || '',
            roles: (u as any).roles || [],
          }))} 
        />
      ) : null}
      {/* Modal de visualização de anexo */}
      {attachmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-lg w-full relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-xl"
              onClick={() => setAttachmentModal(null)}
            >
              &times;
            </button>
            <div className="mb-4 font-semibold text-sm">{attachmentModal.name}</div>
            {attachmentModal.url.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i) ? (
              <img src={attachmentModal.url} alt={attachmentModal.name} className="max-h-96 max-w-full mx-auto" />
            ) : attachmentModal.url.match(/\.(pdf)$/i) ? (
              <iframe src={attachmentModal.url} title={attachmentModal.name} className="w-full h-96" />
            ) : (
              <a href={attachmentModal.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Baixar arquivo</a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CommentsThread; 