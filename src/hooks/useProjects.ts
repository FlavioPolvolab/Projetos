import { useState, useEffect } from 'react';
import { Project, Task, Stage, StatusHistoryItem } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export const useProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | undefined>(undefined);
  const { user, logout } = useAuth();

  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user]);

  const fetchProjects = async () => {
    try {
      setIsLoading(true);
      setProjectsError(undefined);
      
      // Fetch projects with their stages and tasks
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select(`
          *,
          stages (
            *,
            tasks (
              *,
              task_comments (*),
              task_status_history (*)
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (projectsError) {
        setProjectsError('Erro ao buscar projetos.');
        console.error('Error fetching projects:', projectsError);
        return;
      }

      // Função utilitária para montar threads de comentários e resolver menções
      function buildCommentThreads(comments: any[], users: any[]): any[] {
        const commentMap: { [id: string]: any } = {};
        comments.forEach(c => {
          const author = users.find(u => u.id === c.author_id);
          commentMap[c.id] = {
            id: c.id,
            content: c.content,
            author: author?.name || c.author_id || 'Usuário',
            authorId: c.author_id,
            authorAvatar: author?.avatar_url,
            createdAt: new Date(c.created_at),
            taskId: c.task_id,
            taskTitle: c.task_title || '',
            parentId: c.parent_id,
            mentions: c.mentions ? c.mentions.map((id: string) => {
              const u = users.find(u => u.id === id);
              return u ? { id: u.id, name: u.name } : { id, name: id };
            }) : [],
            replies: []
          };
        });
        Object.values(commentMap).forEach(c => {
          if (c.parentId && commentMap[c.parentId]) {
            commentMap[c.parentId].replies = commentMap[c.parentId].replies || [];
            commentMap[c.parentId].replies.push(c);
          }
        });
        return Object.values(commentMap).filter(c => !c.parentId);
      }

      // Transform the data to match our types
      const transformedProjects: Project[] = projectsData?.map(project => ({
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        priority: project.priority,
        createdAt: new Date(project.created_at),
        createdBy: project.created_by || '',
        stages: project.stages?.map(stage => ({
          id: stage.id,
          name: stage.name,
          description: stage.description,
          order: stage.order_index,
          requiresApproval: stage.requires_approval,
          status: stage.status,
          tasks: (stage.tasks || [])
            .slice()
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            .map(task => {
            // Buscar todos os usuários para resolver nomes/menções
            const allUsers = (projectsData || []).flatMap(p => p.stages.flatMap(s => s.tasks.flatMap(t => [t.assigned_to, t.created_by, ...(t.task_comments || []).map((c: any) => c.author_id), ...(t.task_comments || []).flatMap((c: any) => c.mentions || [])]))).filter(Boolean);
            const uniqueUserIds = Array.from(new Set(allUsers));
            // Simples: buscar todos os usuários do banco (pode ser otimizado)
            // Aqui, para garantir, não buscamos de novo, mas o ideal seria passar users como prop/contexto
            const users: any[] = [];
            // Montar threads de comentários
            const comments = buildCommentThreads(task.task_comments || [], users);
            return {
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            assignedTo: task.assigned_to || '',
            createdBy: task.created_by || '',
            createdAt: new Date(task.created_at),
            dueDate: task.due_date ? new Date(task.due_date) : undefined,
            completedAt: task.completed_at ? new Date(task.completed_at) : undefined,
            approvedBy: task.approved_by || undefined,
            approvedAt: task.approved_at ? new Date(task.approved_at) : undefined,
            requiresApproval: task.requires_approval,
              comments,
            statusHistory: task.task_status_history?.map(history => ({
              status: history.status,
              userId: history.user_id || '',
              userName: history.user_name,
              date: new Date(history.created_at)
            })) || [],
            startDate: task.start_date ? new Date(task.start_date) : undefined,
            parentTaskId: task.parent_task_id || undefined
            };
          }) || []
        })) || []
      }))

      // LOG DE DEPURAÇÃO
      // if (transformedProjects) {
      //   transformedProjects.forEach(project => {
      //     project.stages.forEach(stage => {
      //       stage.tasks.forEach(task => {
      //         console.log('Tarefa:', task.title, '| startDate:', task.startDate, '| dueDate:', task.dueDate);
      //       });
      //     });
      //   });
      // }

      setProjects(transformedProjects);
    } catch (error: any) {
      setProjectsError('Erro ao buscar projetos.');
      if (error?.message?.includes('JWT expired') || error?.status === 401) {
        setProjectsError('Sessão expirada. Faça login novamente.');
        logout && logout();
      }
      console.error('Error in fetchProjects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createProject = async (projectData: Omit<Project, 'id' | 'createdAt' | 'createdBy'>) => {
    if (!user) return null;

    try {
      setProjectsError(undefined);
      // Create project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: projectData.name,
          description: projectData.description,
          status: projectData.status,
          priority: projectData.priority,
          created_by: user.id
        })
        .select()
        .single();

      if (projectError) {
        setProjectsError('Erro ao criar projeto.');
        console.error('Error creating project:', projectError);
        return null;
      }

      // Create stages
      for (const stage of projectData.stages) {
        const { data: stageData, error: stageError } = await supabase
          .from('stages')
          .insert({
            project_id: project.id,
            name: stage.name,
            description: stage.description,
            order_index: stage.order,
            requires_approval: stage.requiresApproval
          })
          .select()
          .single();

        if (stageError) {
          console.error('Error creating stage:', stageError);
          continue;
        }

        // Create tasks for this stage
        for (const task of stage.tasks) {
          const { error: taskError } = await supabase
            .from('tasks')
            .insert({
              stage_id: stageData.id,
              title: task.title,
              description: task.description,
              priority: task.priority,
              assigned_to: task.assignedTo && task.assignedTo !== '' ? task.assignedTo : null,
              created_by: user.id,
              due_date: task.dueDate ? new Date(typeof task.dueDate === 'string' ? task.dueDate + 'T00:00:00' : task.dueDate).toISOString() : null,
              start_date: task.startDate ? new Date(typeof task.startDate === 'string' ? task.startDate + 'T00:00:00' : task.startDate).toISOString() : null,
              parent_task_id: task.parentTaskId || null,
              requires_approval: task.requiresApproval
            });

          if (taskError) {
            console.error('Error creating task:', taskError);
          }
        }
      }

      await fetchProjects();
      return project;
    } catch (error: any) {
      setProjectsError('Erro ao criar projeto.');
      if (error?.message?.includes('JWT expired') || error?.status === 401) {
        setProjectsError('Sessão expirada. Faça login novamente.');
        logout && logout();
      }
      console.error('Error in createProject:', error);
      return null;
    }
  };

  // Função utilitária para campo date (YYYY-MM-DD)
  function toDateYYYYMMDD(date: any) {
    if (!date) return null;
    if (typeof date === 'string') return date;
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  // Função utilitária para campo timestamptz (ISO UTC)
  function toTimestampUTC(date: any) {
    if (!date) return null;
    if (typeof date === 'string' && date.length === 10) {
      // Se vier só YYYY-MM-DD, converte para meia-noite local e depois UTC
      const d = new Date(date + 'T00:00:00');
      return d.toISOString();
    }
    return new Date(date).toISOString();
  }

  const createTask = async (projectId: string, stageId: string, taskData: Omit<Task, 'id' | 'createdAt' | 'createdBy' | 'status' | 'comments' | 'statusHistory'>) => {
    if (!user) return null;

    try {
      setProjectsError(undefined);
      const payload = {
        stage_id: stageId,
        title: taskData.title,
        description: taskData.description,
        priority: taskData.priority,
        assigned_to: taskData.assignedTo && taskData.assignedTo !== '' ? taskData.assignedTo : null,
        created_by: user.id,
        due_date: toTimestampUTC(taskData.dueDate),
        start_date: toDateYYYYMMDD(taskData.startDate),
        parent_task_id: taskData.parentTaskId || null,
        requires_approval: taskData.requiresApproval
      };
      const { data: task, error } = await supabase
        .from('tasks')
        .insert(payload)
        .select()
        .single();
      if (error) {
        setProjectsError('Erro ao criar tarefa.');
        console.error('Erro ao criar tarefa:', error);
      } else {
      }

      // Add initial status history
      await supabase
        .from('task_status_history')
        .insert({
          task_id: task.id,
          status: 'pending',
          user_id: user.id,
          user_name: user.name
        });

      await fetchProjects();
      return task;
    } catch (error: any) {
      setProjectsError('Erro ao criar tarefa.');
      if (error?.message?.includes('JWT expired') || error?.status === 401) {
        setProjectsError('Sessão expirada. Faça login novamente.');
        logout && logout();
      }
      console.error('Error in createTask:', error);
      return null;
    }
  };

  const getUserTasks = () => {
    if (!user) return [];
    // Montar um mapa de id -> título para lookup rápido
    const allTasks = projects.flatMap(project =>
      project.stages.flatMap(stage =>
        stage.tasks.map(task => ({
          ...task,
          projectName: project.name,
          stageName: stage.name
        }))
      )
    );
    const taskTitles = new Map<string, string>();
    allTasks.forEach(task => {
      taskTitles.set(task.id, task.title);
    });
    // Retornar apenas as tarefas do usuário, preenchendo parentTaskTitle corretamente
    return allTasks
      .filter(task => task.assignedTo === user.id)
      .map(task => ({
        ...task,
        parentTaskTitle: task.parentTaskId ? taskTitles.get(task.parentTaskId) || '' : undefined
      }));
  };

  const getTasksForApproval = () => {
    if (!user || (user.roles.includes('admin') === false && user.roles.includes('aprovador') === false)) return [];
    const approvalItems: any[] = [];
    projects.forEach(project => {
      project.stages.forEach(stage => {
        // 1. Etapa exige aprovação, está 'pending', todas as tarefas concluídas, nenhuma tarefa individual exige aprovação
        const allTasksCompleted = stage.tasks.length > 0 && stage.tasks.every(task => task.status === 'completed');
        const anyTaskWaitingApproval = stage.tasks.some(task => task.status === 'waiting-approval');
        if (
          stage.requiresApproval &&
          stage.status === 'pending' &&
          allTasksCompleted &&
          !anyTaskWaitingApproval
        ) {
          approvalItems.push({
            type: 'stage',
            id: stage.id,
            name: stage.name,
            description: stage.description,
            status: stage.status,
            projectName: project.name,
            projectDescription: project.description,
            stageId: stage.id,
            stageStatus: stage.status
          });
        }
        // 2. Tarefas individuais que exigem aprovação
        stage.tasks.forEach(task => {
          if (task.status === 'waiting-approval') {
            approvalItems.push({
              ...task,
              type: 'task',
              projectName: project.name,
              projectDescription: project.description,
              stageName: stage.name,
              stageDescription: stage.description,
              stageId: stage.id,
              stageStatus: stage.status
            });
          }
        });
      });
    });
    return approvalItems;
  };

  // Adicionar tipo para callback opcional
  type BlockedByDependencyCallback = (msg: string) => void;

  // Adicionar parâmetro opcional na função
  const updateTaskStatus = async (taskId: string, status: Task['status'], onBlockedByDependency?: BlockedByDependencyCallback) => {
    if (!user) return;

    try {
      // Buscar a tarefa atual para checar dependência
      const allTasks = projects.flatMap(project =>
        project.stages.flatMap(stage => stage.tasks)
      );
      const currentTask = allTasks.find(t => t.id === taskId);
      if (status === 'in-progress' && currentTask?.parentTaskId) {
        const parentTask = allTasks.find(t => t.id === currentTask.parentTaskId);
        if (parentTask && parentTask.status !== 'completed') {
          if (onBlockedByDependency) {
            onBlockedByDependency('Você só pode iniciar esta tarefa após a conclusão da tarefa vinculada: ' + (parentTask.title || parentTask.id));
          }
          return;
        }
      }

      const updates: any = { status };
      if (status === 'completed') {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId);

      if (error) {
        console.error('Error updating task status:', error);
        return;
      }

      // Add status history
      await supabase
        .from('task_status_history')
        .insert({
          task_id: taskId,
          status,
          user_id: user.id,
          user_name: user.name
        });

      // --- NOVA LÓGICA ---
      // Buscar tarefa, etapa e projeto relacionados
      const { data: taskData } = await supabase.from('tasks').select('id, stage_id, status').eq('id', taskId).single();
      if (taskData) {
        // Buscar etapa
        const { data: stageData } = await supabase.from('stages').select('id, project_id, requires_approval, status').eq('id', taskData.stage_id).single();
        if (stageData) {
          // 1. Atualizar status do projeto se qualquer tarefa estiver in-progress
          if (status === 'in-progress') {
            // Sempre que uma tarefa for iniciada, atualizar o projeto para 'in-progress'
            await supabase.from('projects').update({ status: 'in-progress' }).eq('id', stageData.project_id);
          } else if (allTasks && allTasks.some(t => t.status === 'in-progress')) {
            // Se já houver alguma tarefa em andamento, garantir o status também
            await supabase.from('projects').update({ status: 'in-progress' }).eq('id', stageData.project_id);
          }
          // 2. Se todas as tarefas da etapa forem approved e etapa requer aprovação, enviar etapa para aprovação
          // Buscar novamente as tarefas da etapa após atualização
          const { data: etapaTasksAtualizadas } = await supabase.from('tasks').select('status').eq('stage_id', stageData.id);
          if (
            etapaTasksAtualizadas &&
            etapaTasksAtualizadas.length > 0 &&
            etapaTasksAtualizadas.every(t => t.status === 'approved') &&
            !!stageData.requires_approval
          ) {
            await supabase.from('stages').update({ status: 'waiting-approval' }).eq('id', stageData.id);
          }
          // 2b. Se todas as tarefas da etapa forem completed e NÃO requer aprovação, marcar etapa como concluída
          if (
            etapaTasksAtualizadas &&
            etapaTasksAtualizadas.length > 0 &&
            etapaTasksAtualizadas.every(t => t.status === 'completed') &&
            !stageData.requires_approval
          ) {
            await supabase.from('stages').update({ status: 'completed' }).eq('id', stageData.id);
          }
          // 3. Se todas as etapas do projeto estiverem concluídas, marcar projeto como concluído
          const { data: allStages } = await supabase.from('stages').select('status').eq('project_id', stageData.project_id);
          if (
            allStages &&
            allStages.length > 0 &&
            allStages.every(s => s.status === 'completed')
          ) {
            await supabase.from('projects').update({ status: 'completed' }).eq('id', stageData.project_id);
          }
        }
      }
      // --- FIM NOVA LÓGICA ---

      await fetchProjects();
    } catch (error) {
      console.error('Error in updateTaskStatus:', error);
    }
  };

  const approveTask = async (taskId: string, comment?: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (error) {
        console.error('Error approving task:', error);
        return;
      }

      // Add comment if provided
      if (comment && comment.trim()) {
        await supabase
          .from('task_comments')
          .insert({
            task_id: taskId,
            content: `Aprovado: ${comment}`,
            author_id: user.id
          });
      }

      // Add status history
      await supabase
        .from('task_status_history')
        .insert({
          task_id: taskId,
          status: 'approved',
          user_id: user.id,
          user_name: user.name
        });

      await fetchProjects();
    } catch (error) {
      console.error('Error in approveTask:', error);
    }
  };

  const rejectTask = async (taskId: string, reason: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'rejected' })
        .eq('id', taskId);

      if (error) {
        console.error('Error rejecting task:', error);
        return;
      }

      // Add comment with rejection reason
      await supabase
        .from('task_comments')
        .insert({
          task_id: taskId,
                    content: `Rejeitado: ${reason}`,
          author_id: user.id
        });

      // Add status history
      await supabase
        .from('task_status_history')
        .insert({
          task_id: taskId,
          status: 'rejected',
          user_id: user.id,
          user_name: user.name
        });

      await fetchProjects();
    } catch (error) {
      console.error('Error in rejectTask:', error);
    }
  };

  const transferTask = async (taskId: string, newAssignee: string, reason: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ assigned_to: newAssignee })
        .eq('id', taskId);

      if (error) {
        console.error('Error transferring task:', error);
        return;
      }

      // Add comment about transfer
      await supabase
        .from('task_comments')
        .insert({
          task_id: taskId,
          content: `Tarefa transferida por ${user.name}. Motivo: ${reason}`,
          author_id: user.id
        });

      await fetchProjects();
    } catch (error) {
      console.error('Error in transferTask:', error);
    }
  };

  const getAllUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, roles')
        .order('name');

      if (error) {
        console.error('Error fetching users:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getAllUsers:', error);
      return [];
    }
  };

  const updateProject = async (projectId: string, updatedData: Partial<Project>) => {
    try {
      // Atualiza dados básicos do projeto
      const { error: projectError } = await supabase
        .from('projects')
        .update({
          name: updatedData.name,
          description: updatedData.description,
          status: updatedData.status,
          priority: updatedData.priority
        })
        .eq('id', projectId);

      if (projectError) {
        console.error('Error updating project:', projectError);
        return;
      }

      // Busca etapas e tarefas atuais do banco
      const { data: dbStages, error: stagesError } = await supabase
        .from('stages')
        .select('*, tasks(*)')
        .eq('project_id', projectId);
      if (stagesError) {
        console.error('Erro ao buscar etapas do projeto:', stagesError);
        return;
      }

      // Atualiza, cria e remove etapas
      const updatedStages = updatedData.stages || [];
      const dbStagesMap = new Map((dbStages || []).map((s: any) => [s.id, s]));
      const updatedStagesMap = new Map(updatedStages.map((s: any) => [s.id, s]));

      // 1. Atualizar e criar etapas
      for (const stage of updatedStages) {
        if (dbStagesMap.has(stage.id)) {
          // Atualizar etapa existente
          await supabase.from('stages').update({
            name: stage.name,
            description: stage.description,
            order_index: stage.order,
            requires_approval: stage.requiresApproval
          }).eq('id', stage.id);
        } else {
          // Criar nova etapa
          const { data: newStage, error: newStageError } = await supabase.from('stages').insert({
            project_id: projectId,
            name: stage.name,
            description: stage.description,
            order_index: stage.order,
            requires_approval: stage.requiresApproval
          }).select().single();
          if (newStage && stage.tasks) {
            stage.id = newStage.id;
          }
          if (newStageError) {
            console.error('Erro ao criar etapa:', newStageError);
          }
        }
      }

      // 2. Remover etapas excluídas
      for (const dbStage of dbStages || []) {
        if (!updatedStagesMap.has(dbStage.id)) {
          await supabase.from('stages').delete().eq('id', dbStage.id);
        }
      }

      // Atualiza, cria e remove tarefas de cada etapa
      for (const stage of updatedStages) {
        // Busca tarefas atuais da etapa
        const dbStage = dbStagesMap.get(stage.id);
        const dbTasks = dbStage?.tasks || [];
        const dbTasksMap = new Map(dbTasks.map((t: any) => [t.id, t]));
        const updatedTasks = stage.tasks || [];
        const updatedTasksMap = new Map(updatedTasks.map((t: any) => [t.id, t]));

        // Atualizar e criar tarefas
        for (const task of updatedTasks) {
          if (dbTasksMap.has(task.id)) {
            // Atualizar tarefa existente
            const updatePayload = {
              title: task.title,
              description: task.description,
              priority: task.priority,
              assigned_to: task.assignedTo && task.assignedTo !== '' ? task.assignedTo : null,
              due_date: task.dueDate ? new Date(typeof task.dueDate === 'string' ? task.dueDate + 'T00:00:00' : task.dueDate).toISOString() : null,
              start_date: task.startDate ? new Date(typeof task.startDate === 'string' ? task.startDate + 'T00:00:00' : task.startDate).toISOString() : null,
              parent_task_id: task.parentTaskId && task.parentTaskId !== '' ? task.parentTaskId : null,
              requires_approval: task.requiresApproval
            };
            await supabase.from('tasks').update(updatePayload).eq('id', task.id);
          } else {
            // Criar nova tarefa
            const insertPayload = {
              stage_id: stage.id,
              title: task.title,
              description: task.description,
              priority: task.priority,
              assigned_to: task.assignedTo && task.assignedTo !== '' ? task.assignedTo : null,
              due_date: task.dueDate ? new Date(typeof task.dueDate === 'string' ? task.dueDate + 'T00:00:00' : task.dueDate).toISOString() : null,
              start_date: task.startDate ? new Date(typeof task.startDate === 'string' ? task.startDate + 'T00:00:00' : task.startDate).toISOString() : null,
              parent_task_id: task.parentTaskId && task.parentTaskId !== '' ? task.parentTaskId : null,
              requires_approval: task.requiresApproval,
              created_by: user?.id
            };
            await supabase.from('tasks').insert(insertPayload);
            }
        }
        // Remover tarefas excluídas
        for (const dbTask of dbTasks) {
          if (!updatedTasksMap.has(dbTask.id)) {
            await supabase.from('tasks').delete().eq('id', dbTask.id);
          }
        }
      }

      // 1. Enviar etapas para aprovação se necessário
      for (const stage of updatedStages) {
        if (stage.requiresApproval) {
          // Buscar tarefas da etapa
          const { data: etapaTasks } = await supabase.from('tasks').select('status').eq('stage_id', stage.id);
          if (
            etapaTasks &&
            etapaTasks.length > 0 &&
            etapaTasks.every(t => t.status === 'approved')
          ) {
            await supabase.from('stages').update({ status: 'waiting-approval' }).eq('id', stage.id);
          }
        }
      }
      // 2. Se todas as etapas do projeto estiverem concluídas, marcar projeto como concluído
      const { data: allStagesStatus } = await supabase.from('stages').select('status').eq('project_id', projectId);
      if (
        allStagesStatus &&
        allStagesStatus.length > 0 &&
        allStagesStatus.every(s => s.status === 'completed')
      ) {
        await supabase.from('projects').update({ status: 'completed' }).eq('id', projectId);
      }

      await fetchProjects();
    } catch (error) {
      console.error('Error in updateProject:', error);
    }
  };

  const updateTask = async (taskId: string, updatedData: Partial<Task>) => {
    if (!user) return;
    try {
      const updatePayload: any = { ...updatedData };
      if (updatePayload.dueDate) {
        updatePayload.due_date = toTimestampUTC(updatePayload.dueDate);
        delete updatePayload.dueDate;
      }
      if (updatePayload.startDate) {
        updatePayload.start_date = toDateYYYYMMDD(updatePayload.startDate);
        delete updatePayload.startDate;
      }
      const { error } = await supabase
        .from('tasks')
        .update(updatePayload)
        .eq('id', taskId);
      if (error) {
        console.error('Erro ao atualizar tarefa:', error);
      } else {
      }

      await fetchProjects();
    } catch (error) {
      console.error('Error in updateTask:', error);
    }
  };

  const sendTaskForApproval = async (taskId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'waiting-approval' })
        .eq('id', taskId);

      if (error) {
        console.error('Error sending task for approval:', error);
        return;
      }

      // Add status history
      await supabase
        .from('task_status_history')
        .insert({
          task_id: taskId,
          status: 'waiting-approval',
          user_id: user.id,
          user_name: user.name
        });

      await fetchProjects();
    } catch (error) {
      console.error('Error in sendTaskForApproval:', error);
    }
  };

  const addTaskComment = async (taskId: string, content: string) => {
    if (!user) return;
    try {
      await supabase.from('task_comments').insert({
        task_id: taskId,
        content,
        author_id: user.id
      });
      await fetchProjects();
    } catch (error) {
      console.error('Erro ao adicionar comentário:', error);
    }
  };

  // Aprovar etapa manualmente
  const approveStage = async (stageId: string) => {
    if (!user) return;
    try {
      // Aprova a etapa
      await supabase.from('stages').update({ status: 'approved' }).eq('id', stageId);
      // Se todas as tarefas da etapa estiverem concluídas, marcar etapa como concluída
      const { data: etapaTasks } = await supabase.from('tasks').select('status').eq('stage_id', stageId);
      if (etapaTasks && etapaTasks.length > 0 && etapaTasks.every(t => t.status === 'completed')) {
        await supabase.from('stages').update({ status: 'completed' }).eq('id', stageId);
      }
      // Buscar projeto da etapa
      const { data: stageData } = await supabase.from('stages').select('project_id').eq('id', stageId).single();
      if (stageData) {
        // Se todas as etapas do projeto estiverem concluídas, marcar projeto como concluído
        const { data: allStages } = await supabase.from('stages').select('status').eq('project_id', stageData.project_id);
        if (allStages && allStages.length > 0 && allStages.every(s => s.status === 'completed')) {
          await supabase.from('projects').update({ status: 'completed' }).eq('id', stageData.project_id);
        }
      }
      await fetchProjects();
    } catch (error) {
      console.error('Erro ao aprovar etapa:', error);
    }
  };

  // CRUD de Usuários
  const updateUser = async (userId: string, userData: { name?: string; roles?: string[] }) => {
    try {
      const { error } = await supabase.from('users').update({
        name: userData.name,
        roles: userData.roles
      }).eq('id', userId);
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      throw error;
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      const { error } = await supabase.from('users').delete().eq('id', userId);
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      throw error;
    }
  };

  // Excluir Projeto
  const deleteProject = async (projectId: string) => {
    try {
      // Exclui todas as etapas e tarefas relacionadas
      await supabase.from('tasks').delete().in('stage_id',
        (await supabase.from('stages').select('id').eq('project_id', projectId)).data?.map(s => s.id) || []
      );
      await supabase.from('stages').delete().eq('project_id', projectId);
      // Exclui o projeto
      const { error } = await supabase.from('projects').delete().eq('id', projectId);
      if (error) throw error;
      await fetchProjects();
      return true;
    } catch (error) {
      console.error('Erro ao excluir projeto:', error);
      throw error;
    }
  };

  const getUserProjects = () => {
    if (!user) return [];
    if (user.roles.includes('admin') || user.roles.includes('manager')) return projects;
    // Projetos onde o usuário tem tarefas OU é o criador
    return projects.filter(project => {
      if (project.createdBy === user.id) return true;
      return project.stages.some(stage =>
        stage.tasks.some(task => task.assignedTo === user.id)
    );
    });
  };

  return {
    projects,
    isLoading,
    projectsError,
    getUserTasks,
    getTasksForApproval,
    approveTask,
    rejectTask,
    updateTaskStatus,
    transferTask,
    createProject,
    createTask,
    getAllUsers,
    updateProject,
    updateTask,
    sendTaskForApproval,
    fetchProjects,
    addTaskComment,
    approveStage,
    updateUser,
    deleteUser,
    deleteProject,
    getUserProjects
  };
};