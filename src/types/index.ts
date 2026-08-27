export type Role = 'ADMIN' | 'MANAGER' | 'DEPT_MANAGER' | 'TASK_USER';

export interface RoleDefinition {
  role: Role;
  label: string;
  scope: string;
  description: string;
  features: string[];
  badgeClass: string;
}

export type UserStatus = 'Active' | 'Inactive';

export interface User {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  password?: string;
  departmentId: string;
  role: Role;
  status: UserStatus;
  workingScheduleId: string;
  avatarUrl?: string;
  title: string;
  createdAt: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  managerId: string;
  status: 'Active' | 'Inactive';
  description?: string;
}

export type TaskStatus = 'Not Started' | 'In Progress' | 'On Hold' | 'Completed' | 'Cancelled';

export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Critical';

export type TaskType = 'Analysis' | 'Development' | 'Testing' | 'Documentation' | 'Meeting' | 'Support' | 'Review' | 'Planning' | 'Administrative' | 'Training';

export type RequestType =
  | 'Project Work'
  | 'Change Request'
  | 'Support'
  | 'Business Analysis'
  | 'Testing/UAT'
  | 'Documentation'
  | 'Meetings'
  | 'Administrative'
  | 'Training'
  | 'Other';

export interface Task {
  id: string;
  taskName: string;
  description: string;
  project: string;
  taskType: TaskType;
  requestType?: RequestType | string;
  workType?: string;
  priority: TaskPriority;
  assignedUserId: string;
  departmentId: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string;  // YYYY-MM-DD (Optional)
  plannedHours: number;
  actualHours: number; // calculated sum of time sessions
  variance: number;    // actualHours - plannedHours
  variancePercent: number; // ((actual - planned)/planned) * 100
  overtimeHours?: number; // approved/logged overtime
  status: TaskStatus;
  remarks: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export type TimeCorrectionType =
  | 'Forgot to Start Timer'
  | 'Forgot to Stop Timer'
  | 'Incorrect Live Timer'
  | 'Offline / Interrupted Work'
  | 'Meeting / Call Outside Timer'
  | 'Ad-hoc Urgent Assistance'
  | 'General Correction';

export interface TimeSession {
  id: string;
  taskId: string;
  userId: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  durationHours: number; // In decimal hours (e.g. 1.75)
  durationSeconds: number; // In seconds
  workType?: string;
  isOvertime?: boolean;
  timeEntryType?: 'Regular' | 'OT';
  notes?: string;
  isManual?: boolean;
  manualReason?: string;
  correctionType?: TimeCorrectionType | string;
  createdAt: string;
  updatedAt?: string;
}

export interface ActiveTimer {
  taskId: string;
  userId: string;
  startTime: string; // ISO string
  lastTick?: string;
}

export interface WorkingSchedule {
  id: string;
  name: string;
  hoursPerDay: number;
  workingDays: number[]; // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  startTime: string; // e.g. "09:00"
  endTime: string;   // e.g. "17:00"
  breakHours: number; // e.g. 1
  isDefault?: boolean;
}

export interface Holiday {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  type: 'Public' | 'Company' | 'Regional';
}

export interface TaskCategoryConfig {
  taskTypes: string[];
  projects: string[];
  priorities: TaskPriority[];
}

export interface WorkloadThresholds {
  underCapacity: number; // default: 80%
  overCapacity: number;  // default: 100%
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  module: 'Tasks' | 'Time Tracking' | 'Users' | 'Departments' | 'Schedules' | 'Categories' | 'System';
  recordId: string;
  recordName?: string;
  oldValue: string;
  newValue: string;
  reason?: string;
  timestamp: string;
}

export type TimePeriod = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

export interface GlobalFilterState {
  departmentId: string;
  userId: string;
  projectId: string;
  requestType: string;
  taskType: string;
  priority: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  period: TimePeriod;
  month: string;
  year: string;
  searchQuery: string;
}
