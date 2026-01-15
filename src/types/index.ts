export interface User {
  id: string;
  name: string;
  email: string;
  roles: string[];
  avatar?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: 'planning' | 'in-progress' | 'completed' | 'on-hold' | 'encerrado';
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date;
  createdBy: string;
  stages: Stage[];
}

export interface Stage {
  id: string;
  name: string;
  description: string;
  order: number;
  requiresApproval: boolean;
  status: 'pending' | 'waiting-approval' | 'approved' | 'completed';
  tasks: Task[];
}

export interface StatusHistoryItem {
  status: Task['status'];
  userId: string;
  userName: string;
  date: Date;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'waiting-approval' | 'approved' | 'completed' | 'rejected';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedTo: string | string[]; // Suporta string (compatibilidade) ou array de IDs
  assignedToUsers?: Array<{ id: string; name: string; email: string }>; // Dados completos dos usuários atribuídos
  createdBy: string;
  createdAt: Date;
  dueDate?: Date;
  completedAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
  comments: Comment[];
  requiresApproval: boolean;
  statusHistory?: StatusHistoryItem[];
  projectName?: string;
  stageName?: string;
  startDate?: Date;
  parentTaskId?: string;
  parentTaskTitle?: string;
}

export interface Comment {
  id: string;
  content: string;
  author: string;
  authorId: string;
  authorAvatar?: string;
  createdAt: Date;
  taskId: string;
  taskTitle: string;
  parentId?: string;
  mentions?: { id: string; name: string }[];
  replies?: Comment[];
  attachment_url?: string;
}

export interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  resetPassword: (email: string) => Promise<boolean>;
}