export type KanbanStatus = 'Todo' | 'Doing' | 'Blocked' | 'Done';
export type WeekDay = 'Unplanned' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri';

export interface Project {
  id: string;
  name: string;
  order: number;
}

export interface WeeklyMembership {
  weekId: string;
  day: WeekDay;
}

export interface WeeklyTaskMembership extends WeeklyMembership {
  repeatWeekly: boolean;
}

export interface Container {
  id: string;
  projectId: string;
  name: string;
  order: number;
  labels: string[];
  archived: boolean;
  kanban: KanbanMembership | null;
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface KanbanMembership {
  status: KanbanStatus;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  labels: string[];
  projectId: string;
  containerId: string;
  order: number;
  completed: boolean;
  completedDate: number | null;
  archived: boolean;
  weekly: WeeklyTaskMembership | null;
}

export interface WeekTemplate {
  id: string;
  taskId: string;
  title: string;
  description: string;
  labels: string[];
  projectId: string;
  containerId: string;
}

export interface Setting {
  key: string;
  value: unknown;
}
