export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          priority: Database["public"]["Enums"]["priority_level"]
          project_name: string | null
          read: boolean
          task_id: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          priority?: Database["public"]["Enums"]["priority_level"]
          project_name?: string | null
          read?: boolean
          task_id?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          project_name?: string | null
          read?: boolean
          task_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          name: string
          roles: string[]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          name: string
          roles?: string[]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          roles?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      projects: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          id: string
          name: string
          priority: Database["public"]["Enums"]["priority_level"]
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          name: string
          priority?: Database["public"]["Enums"]["priority_level"]
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          name?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      stages: {
        Row: {
          created_at: string
          description: string
          id: string
          name: string
          order_index: number
          project_id: string | null
          requires_approval: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          name: string
          order_index: number
          project_id?: string | null
          requires_approval?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          name?: string
          order_index?: number
          project_id?: string | null
          requires_approval?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          }
        ]
      }
      task_comments: {
        Row: {
          author_id: string | null
          content: string
          created_at: string
          id: string
          task_id: string | null
          parent_id: string | null
          attachment_url: string | null
        }
        Insert: {
          author_id?: string | null
          content: string
          created_at?: string
          id?: string
          task_id?: string | null
          parent_id?: string | null
          attachment_url?: string | null
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string
          id?: string
          task_id?: string | null
          parent_id?: string | null
          attachment_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          }
        ]
      }
      task_status_history: {
        Row: {
          created_at: string
          id: string
          status: Database["public"]["Enums"]["task_status"]
          task_id: string | null
          user_id: string | null
          user_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          status: Database["public"]["Enums"]["task_status"]
          task_id?: string | null
          user_id?: string | null
          user_name: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["task_status"]
          task_id?: string | null
          user_id?: string | null
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_status_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_status_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      tasks: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string
          due_date: string | null
          id: string
          priority: Database["public"]["Enums"]["priority_level"]
          requires_approval: boolean
          stage_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          requires_approval?: boolean
          stage_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          requires_approval?: boolean
          stage_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          }
        ]
      }
      divulgacao_tarefas: {
        Row: {
          id: string;
          influenciador: string;
          seguidores: number;
          produtos: string;
          created_at: string;
          concluida: boolean;
          endereco: string | null;
          whatsapp: string | null;
          feedback: string | null;
          lead_status: 'lead' | 'nao_lead' | null;
          nicho: 'Food Service' | 'Varejo' | 'Exportação' | 'Institucional' | 'Influenciadores' | null;
        };
        Insert: {
          id?: string;
          influenciador: string;
          seguidores: number;
          produtos: string;
          created_at?: string;
          concluida?: boolean;
          endereco?: string | null;
          whatsapp?: string | null;
          feedback?: string | null;
          lead_status?: 'lead' | 'nao_lead' | null;
          nicho?: 'Food Service' | 'Varejo' | 'Exportação' | 'Institucional' | 'Influenciadores' | null;
        };
        Update: {
          id?: string;
          influenciador?: string;
          seguidores?: number;
          produtos?: string;
          created_at?: string;
          concluida?: boolean;
          endereco?: string | null;
          whatsapp?: string | null;
          feedback?: string | null;
          lead_status?: 'lead' | 'nao_lead' | null;
          nicho?: 'Food Service' | 'Varejo' | 'Exportação' | 'Institucional' | 'Influenciadores' | null;
        };
        Relationships: [];
      };
      divulgacao_participantes: {
        Row: {
          id: string;
          tarefa_id: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          tarefa_id: string;
          user_id: string;
        };
        Update: {
          id?: string;
          tarefa_id?: string;
          user_id?: string;
        };
        Relationships: [
          { foreignKeyName: "divulgacao_participantes_tarefa_id_fkey"; columns: ["tarefa_id"]; referencedRelation: "divulgacao_tarefas"; referencedColumns: ["id"] },
          { foreignKeyName: "divulgacao_participantes_user_id_fkey"; columns: ["user_id"]; referencedRelation: "users"; referencedColumns: ["id"] }
        ];
      };
      divulgacao_etapas: {
        Row: {
          id: string;
          tarefa_id: string;
          nome: string;
          concluida: boolean;
          ordem: number;
        };
        Insert: {
          id?: string;
          tarefa_id: string;
          nome: string;
          concluida?: boolean;
          ordem?: number;
        };
        Update: {
          id?: string;
          tarefa_id?: string;
          nome?: string;
          concluida?: boolean;
          ordem?: number;
        };
        Relationships: [
          { foreignKeyName: "divulgacao_etapas_tarefa_id_fkey"; columns: ["tarefa_id"]; referencedRelation: "divulgacao_tarefas"; referencedColumns: ["id"] }
        ];
      };
      divulgacao_etapa_responsaveis: {
        Row: {
          id: string;
          etapa_id: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          etapa_id: string;
          user_id: string;
        };
        Update: {
          id?: string;
          etapa_id?: string;
          user_id?: string;
        };
        Relationships: [
          { foreignKeyName: "divulgacao_etapa_responsaveis_etapa_id_fkey"; columns: ["etapa_id"]; referencedRelation: "divulgacao_etapas"; referencedColumns: ["id"] },
          { foreignKeyName: "divulgacao_etapa_responsaveis_user_id_fkey"; columns: ["user_id"]; referencedRelation: "users"; referencedColumns: ["id"] }
        ];
      };
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      notification_type:
        | "deadline_warning"
        | "deadline_overdue"
        | "task_assigned"
        | "task_approved"
        | "task_rejected"
        | "task_transferred"
      priority_level: "low" | "medium" | "high" | "critical"
      project_status: "planning" | "in-progress" | "completed" | "on-hold"
      task_status:
        | "pending"
        | "in-progress"
        | "waiting-approval"
        | "approved"
        | "completed"
        | "rejected"
      user_role: "admin" | "manager" | "user" | "aprovador"
    }
  }
}

export type CommentRead = {
  id: number;
  comment_id: string;
  user_id: string;
  read_at: string;
};