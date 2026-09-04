import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Task, GlobalFilterState } from '../../types';
import { exportToExcel, ExportMetadata } from '../../utils/exportUtils';
import {
  Filter,
  Users,
  Building,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  TrendingUp,
  BarChart3,
  Calendar,
  Layers,
  Search,
  PieChart as PieChartIcon,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  ShieldAlert,
  Info,
  ChevronRight,
  X,
  ExternalLink,
  SlidersHorizontal,
  Flame,
  Award,
  ShieldCheck,
  Briefcase,
  UserCheck,
  Settings,
  ChevronDown,
  FileSpreadsheet,
  Download,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  isTaskOverdue,
  getDaysOverdue,
  calculateAvailableWorkingHours,
  calculateFTE,
  getDateRangeForPeriod,
  getWorkloadStatus,
  isOverCapacity,
  isAtCapacity,
  isUnderCapacity,
  formatHours,
} from '../../utils/calculations';

interface ManagerDashboardProps {
  onViewTask: (task: Task) => void;
}

// Enterprise Color System Tokens
const COLORS = {
  primary: '#2563EB',
  primaryLight: '#60A5FA',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  slate: '#64748B',
  slateLight: '#94A3B8',
  indigo: '#6366F1',
  purple: '#8B5CF6',
  pink: '#EC4899',
  teal: '#14B8A6',
  cyan: '#06B6D4',
};

// Work Type Palette for Donut
const WORK_TYPE_COLORS: Record<string, string> = {
  'Standard Task': '#2563EB',
  'Change Request': '#8B5CF6',
  'Support': '#EC4899',
  'Business Analysis': '#06B6D4',
  'Testing/UAT': '#10B981',
  'Documentation': '#F59E0B',
  'Meetings': '#6366F1',
  'Administrative': '#64748B',
  'Training': '#14B8A6',
  'Other': '#94A3B8',
};

// Status Colors
const STATUS_COLORS: Record<string, string> = {
  'Not Started': '#94A3B8',
  'In Progress': '#2563EB',
  'On Hold': '#F59E0B',
  'Completed': '#10B981',
  'Cancelled': '#64748B',
};

type ActiveSectionTab = 'all' | 'fte' | 'workload' | 'compliance';

export const ManagerDashboard: React.FC<ManagerDashboardProps> = ({ onViewTask }) => {
  const {
    currentUser,
    users,
    departments,
    tasks,
    timeSessions,
    workingSchedules,
    holidays,
    categoryConfig,
    showToast,
  } = useApp();

  // Active section tab
  const [activeSection, setActiveSection] = useState<ActiveSectionTab>('all');

  // Selected date preset
  const [datePreset, setDatePreset] = useState<'month' | 'week' | 'quarter' | 'year' | 'all' | 'custom'>('month');

  // Advanced filter drawer toggle
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Overdue drill-down modal state
  const [selectedOverdueDept, setSelectedOverdueDept] = useState<string | null>(null);
  const [isOverdueModalOpen, setIsOverdueModalOpen] = useState(false);

  const isDeptManager = currentUser.role === 'DEPT_MANAGER';
  const isAdmin = currentUser.role === 'ADMIN';

  // Global Filters State
  const [filters, setFilters] = useState<GlobalFilterState>({
    departmentId: isDeptManager ? (currentUser.departmentId || '') : '',
    userId: '',
    projectId: '',
    requestType: '',
    taskType: '',
    priority: '',
    status: '',
    dateFrom: '2026-08-01',
    dateTo: '2026-08-31',
    period: 'month',
    month: '8',
    year: '2026',
    searchQuery: '',
  });

  // Handle Preset Change
  const handlePresetChange = (preset: 'month' | 'week' | 'quarter' | 'year' | 'all' | 'custom') => {
    setDatePreset(preset);
    if (preset === 'all') {
      setFilters(prev => ({
        ...prev,
        period: 'custom',
        dateFrom: '2026-01-01',
        dateTo: '2026-12-31',
      }));
    } else if (preset !== 'custom') {
      const range = getDateRangeForPeriod(preset, new Date('2026-08-26T12:00:00Z'));
      setFilters(prev => ({
        ...prev,
        period: preset,
        dateFrom: range.startDate,
        dateTo: range.endDate,
      }));
    }
  };

  const handleFilterChange = (key: keyof GlobalFilterState, val: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: val,
      ...(key === 'departmentId' ? { userId: '' } : {}),
    }));
    if (key === 'dateFrom' || key === 'dateTo') {
      setDatePreset('custom');
    }
  };

  const resetFilters = () => {
    setDatePreset('month');
    setFilters({
      departmentId: isDeptManager ? (currentUser.departmentId || '') : '',
      userId: '',
      projectId: '',
      requestType: '',
      taskType: '',
      priority: '',
      status: '',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      period: 'month',
      month: '8',
      year: '2026',
      searchQuery: '',
    });
  };

  // Count active non-default filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.departmentId && (!isDeptManager || filters.departmentId !== currentUser.departmentId)) count++;
    if (filters.userId) count++;
    if (filters.projectId) count++;
    if (filters.requestType) count++;
    if (filters.taskType) count++;
    if (filters.priority) count++;
    if (filters.status) count++;
    if (filters.searchQuery) count++;
    if (datePreset !== 'month') count++;
    return count;
  }, [filters, datePreset, isDeptManager, currentUser.departmentId]);

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (filters.departmentId && task.departmentId !== filters.departmentId) return false;
      if (filters.userId && task.assignedUserId !== filters.userId) return false;
      if (filters.projectId && task.project !== filters.projectId) return false;
      if (filters.requestType && (task.requestType || task.taskType) !== filters.requestType) return false;
      if (filters.taskType && task.taskType !== filters.taskType) return false;
      if (filters.priority && task.priority !== filters.priority) return false;
      if (filters.status && task.status !== filters.status) return false;
      if (filters.dateFrom && task.endDate && task.endDate < filters.dateFrom) return false;
      if (filters.dateTo && task.startDate > filters.dateTo) return false;
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const matchesName = task.taskName.toLowerCase().includes(query);
        const matchesId = task.id.toLowerCase().includes(query);
        const matchesDesc = task.description.toLowerCase().includes(query);
        if (!matchesName && !matchesId && !matchesDesc) return false;
      }
      return true;
    });
  }, [tasks, filters]);

  // Filtered Users (for FTE calculations)
  const relevantUsers = useMemo(() => {
    return users.filter(u => {
      if (filters.departmentId && u.departmentId !== filters.departmentId) return false;
      if (filters.userId && u.id !== filters.userId) return false;
      return u.status === 'Active';
    });
  }, [users, filters]);

  // Date range object
  const dateRange = useMemo(() => {
    return {
      startDate: filters.dateFrom || '2026-08-01',
      endDate: filters.dateTo || '2026-08-31',
    };
  }, [filters.dateFrom, filters.dateTo]);

  // ================= 1. KPI CALCULATIONS =================
  const totalTasks = filteredTasks.length;
  const activeTasks = filteredTasks.filter(t => t.status === 'In Progress').length;
  const completedTasks = filteredTasks.filter(t => t.status === 'Completed').length;
  const overdueTasksList = useMemo(() => {
    return filteredTasks.filter(t => isTaskOverdue(t, new Date('2026-08-26T23:59:59Z')));
  }, [filteredTasks]);
  const overdueTasksCount = overdueTasksList.length;

  const totalPlannedHours = useMemo(() => {
    return filteredTasks.reduce((sum, t) => sum + (t.shiftHours || t.plannedHours || 0), 0);
  }, [filteredTasks]);

  const totalActualHours = useMemo(() => {
    return filteredTasks.reduce((sum, t) => sum + (t.actualHours || 0), 0);
  }, [filteredTasks]);

  // Total Available Working Hours across relevant users
  const totalAvailableHours = useMemo(() => {
    return relevantUsers.reduce((sum, user) => {
      const schedule = workingSchedules.find(s => s.id === user.workingScheduleId) || workingSchedules[0];
      const { availableHours } = calculateAvailableWorkingHours(
        dateRange.startDate,
        dateRange.endDate,
        schedule,
        holidays
      );
      return sum + availableHours;
    }, 0);
  }, [relevantUsers, workingSchedules, dateRange, holidays]);

  // FTE Utilization %
  const fteUtilizationPercent = useMemo(() => {
    return calculateFTE(totalActualHours, totalAvailableHours);
  }, [totalActualHours, totalAvailableHours]);

  // Remaining Capacity (surplus/deficit)
  const remainingCapacity = useMemo(() => {
    return Number((totalAvailableHours - totalActualHours).toFixed(1));
  }, [totalAvailableHours, totalActualHours]);

  // Overtime Hours
  const totalOvertimeHours = useMemo(() => {
    return filteredTasks.reduce((sum, t) => sum + (t.overtimeHours || 0), 0);
  }, [filteredTasks]);

  // Time Tracking Compliance %
  const trackingCompliancePercent = useMemo(() => {
    if (totalAvailableHours <= 0) return 100;
    const rate = (totalActualHours / totalAvailableHours) * 100;
    return Math.min(100, Number(rate.toFixed(1)));
  }, [totalActualHours, totalAvailableHours]);

  const untrackedHours = useMemo(() => {
    return Math.max(0, Number((totalAvailableHours - totalActualHours).toFixed(1)));
  }, [totalAvailableHours, totalActualHours]);

  // Current scope department name
  const currentDept = useMemo(() => {
    if (filters.departmentId) {
      return departments.find(d => d.id === filters.departmentId);
    }
    return null;
  }, [departments, filters.departmentId]);

  // ================= 2. FTE UTILIZATION BY DEPARTMENT =================
  const departmentFteData = useMemo(() => {
    const activeDepts = filters.departmentId
      ? departments.filter(d => d.id === filters.departmentId)
      : departments.filter(d => d.status === 'Active');

    return activeDepts.map(dept => {
      const deptUsers = users.filter(u => u.departmentId === dept.id && u.status === 'Active');
      const deptTasks = tasks.filter(t => t.departmentId === dept.id);
      
      const actualHours = deptTasks.reduce((sum, t) => sum + t.actualHours, 0);
      const plannedHours = deptTasks.reduce((sum, t) => sum + (t.shiftHours || t.plannedHours || 0), 0);

      const availableHours = deptUsers.reduce((sum, u) => {
        const schedule = workingSchedules.find(s => s.id === u.workingScheduleId) || workingSchedules[0];
        const { availableHours: userAvail } = calculateAvailableWorkingHours(
          dateRange.startDate,
          dateRange.endDate,
          schedule,
          holidays
        );
        return sum + userAvail;
      }, 0);

      const fte = calculateFTE(actualHours, availableHours);
      const overdueCount = deptTasks.filter(t => isTaskOverdue(t, new Date('2026-08-26T23:59:59Z'))).length;
      const approvedOvertime = deptTasks.reduce((sum, t) => sum + (t.overtimeHours || 0), 0);

      return {
        id: dept.id,
        department: dept.name,
        code: dept.code,
        headcount: deptUsers.length,
        availableHours: Number(availableHours.toFixed(1)),
        actualHours: Number(actualHours.toFixed(1)),
        plannedHours: Number(plannedHours.toFixed(1)),
        ftePercent: fte,
        overdueCount,
        approvedOvertime,
      };
    });
  }, [departments, users, tasks, workingSchedules, dateRange, holidays, filters.departmentId]);

  // ================= 3. FTE UTILIZATION TREND =================
  const fteTrendData = useMemo(() => {
    const weeks = [
      { period: 'Week 1 (Aug 1-7)', actualHours: 68.5, availableHours: 88.0, target: 85 },
      { period: 'Week 2 (Aug 8-14)', actualHours: 92.0, availableHours: 88.0, target: 85 },
      { period: 'Week 3 (Aug 15-21)', actualHours: 86.5, availableHours: 88.0, target: 85 },
      { period: 'Week 4 (Aug 22-28)', actualHours: Number(totalActualHours.toFixed(1)), availableHours: 88.0, target: 85 },
    ];
    return weeks.map(w => ({
      ...w,
      ftePercent: calculateFTE(w.actualHours, w.availableHours),
    }));
  }, [totalActualHours]);

  // ================= 4. EMPLOYEE UTILIZATION =================
  const employeeUtilizationData = useMemo(() => {
    return relevantUsers.map(user => {
      const userTasks = filteredTasks.filter(t => t.assignedUserId === user.id);
      const actualHours = userTasks.reduce((sum, t) => sum + (t.actualHours || 0), 0);
      const plannedHours = userTasks.reduce((sum, t) => sum + (t.shiftHours || t.plannedHours || 0), 0);

      const schedule = workingSchedules.find(s => s.id === user.workingScheduleId) || workingSchedules[0];
      const { availableHours } = calculateAvailableWorkingHours(
        dateRange.startDate,
        dateRange.endDate,
        schedule,
        holidays
      );

      const fte = calculateFTE(actualHours, availableHours);
      const status = getWorkloadStatus(fte);

      return {
        id: user.id,
        employee: user.name,
        department: departments.find(d => d.id === user.departmentId)?.code || 'N/A',
        actualHours: Number(actualHours.toFixed(1)),
        plannedHours: Number(plannedHours.toFixed(1)),
        availableHours: Number(availableHours.toFixed(1)),
        ftePercent: fte,
        status,
      };
    }).sort((a, b) => b.ftePercent - a.ftePercent);
  }, [relevantUsers, filteredTasks, workingSchedules, dateRange, holidays, departments]);

  // ================= 5. SHIFT VS ACTUAL HOURS BY DEPARTMENT =================
  const plannedVsActualData = useMemo(() => {
    return departmentFteData.map(d => ({
      name: d.code,
      fullName: d.department,
      Shift: d.plannedHours,
      Planned: d.plannedHours,
      Actual: d.actualHours,
      Variance: Number((d.actualHours - d.plannedHours).toFixed(1)),
    }));
  }, [departmentFteData]);

  // ================= 6. TASK STATUS DISTRIBUTION =================
  const taskStatusDistribution = useMemo(() => {
    const statuses: Array<{ name: string; value: number; color: string }> = [
      { name: 'Not Started', value: 0, color: STATUS_COLORS['Not Started'] },
      { name: 'In Progress', value: 0, color: STATUS_COLORS['In Progress'] },
      { name: 'On Hold', value: 0, color: STATUS_COLORS['On Hold'] },
      { name: 'Completed', value: 0, color: STATUS_COLORS['Completed'] },
      { name: 'Cancelled', value: 0, color: STATUS_COLORS['Cancelled'] },
    ];

    filteredTasks.forEach(task => {
      const target = statuses.find(s => s.name === task.status);
      if (target) target.value += 1;
    });

    return statuses.filter(s => s.value > 0);
  }, [filteredTasks]);

  // ================= 7. TASK VOLUME BY DEPARTMENT =================
  const taskVolumeByDeptData = useMemo(() => {
    return departmentFteData.map(dept => {
      const deptTasks = tasks.filter(t => t.departmentId === dept.id);
      const inProgress = deptTasks.filter(t => t.status === 'In Progress').length;
      const completed = deptTasks.filter(t => t.status === 'Completed').length;
      const others = deptTasks.length - inProgress - completed;

      return {
        department: dept.code,
        fullName: dept.department,
        totalTasks: deptTasks.length,
        inProgress,
        completed,
        others,
      };
    });
  }, [departmentFteData, tasks]);

  // ================= 8. EMPLOYEE WORKLOAD (Planned vs Available) =================
  const employeeWorkloadData = useMemo(() => {
    return employeeUtilizationData.slice(0, 8).map(u => ({
      employee: u.employee,
      plannedHours: u.plannedHours,
      availableHours: u.availableHours,
    }));
  }, [employeeUtilizationData]);

  // ================= OVERDUE TASKS BY DEPARTMENT =================
  const overdueTasksByDeptData = useMemo(() => {
    return departmentFteData.map(d => ({
      id: d.id,
      department: d.code,
      fullName: d.department,
      overdueCount: d.overdueCount,
    }));
  }, [departmentFteData]);

  // Overdue drill-down tasks
  const drilldownOverdueTasks = useMemo(() => {
    if (!selectedOverdueDept) return overdueTasksList;
    return overdueTasksList.filter(t => t.departmentId === selectedOverdueDept);
  }, [overdueTasksList, selectedOverdueDept]);

  // ================= 11. EFFORT VARIANCE (Top 10 Tasks) =================
  const effortVarianceTop10 = useMemo(() => {
    return [...filteredTasks]
      .map(task => {
        const taskShiftHours = task.shiftHours || task.plannedHours || 0;
        const variance = Number(((task.actualHours || 0) - taskShiftHours).toFixed(1));
        const variancePercent =
          taskShiftHours > 0 ? Number(((variance / taskShiftHours) * 100).toFixed(1)) : 0;
        return {
          id: task.id,
          taskName: task.taskName,
          plannedHours: taskShiftHours,
          actualHours: Number((task.actualHours || 0).toFixed(1)),
          variance,
          variancePercent,
          task,
        };
      })
      .sort((a, b) => b.variance - a.variance)
      .slice(0, 10);
  }, [filteredTasks]);

  // ================= 12. OVERTIME BY DEPARTMENT =================
  const overtimeByDeptData = useMemo(() => {
    return departmentFteData.map(d => ({
      department: d.code,
      fullName: d.department,
      overtimeHours: d.approvedOvertime,
    }));
  }, [departmentFteData]);

  // ================= DYNAMIC SIZING HELPERS FOR LANDSCAPE CHARTS =================
  // Dynamic height for team utilization horizontal bar chart based on data count
  const employeeUtilizationChartHeight = useMemo(() => {
    return Math.max(280, Math.min(850, employeeUtilizationData.length * 44 + 60));
  }, [employeeUtilizationData.length]);

  // Dynamic height for employee workload density horizontal bar chart
  const employeeWorkloadChartHeight = useMemo(() => {
    return Math.max(260, Math.min(800, employeeWorkloadData.length * 42 + 50));
  }, [employeeWorkloadData.length]);

  // Dynamic bar sizing for department charts to ensure optimal visual density
  const deptBarSize = useMemo(() => {
    const count = departmentFteData.length;
    if (count <= 1) return 56;
    if (count <= 3) return 44;
    if (count <= 6) return 32;
    return 24;
  }, [departmentFteData.length]);

  // Employee capacity breakdown counts for summary badges
  const employeeCapacityStats = useMemo(() => {
    let under = 0;
    let atCap = 0;
    let over = 0;
    employeeUtilizationData.forEach(e => {
      if (isOverCapacity(e.status)) over++;
      else if (isAtCapacity(e.status)) atCap++;
      else under++;
    });
    return { under, atCap, over, total: employeeUtilizationData.length };
  }, [employeeUtilizationData]);

  // Export Dashboard to Excel handler
  const handleExportExcel = () => {
    const activeDeptName = isDeptManager
      ? departments.find(d => d.id === currentUser.departmentId)?.name || 'Assigned Department'
      : filters.departmentId
      ? departments.find(d => d.id === filters.departmentId)?.name || 'All Departments'
      : 'All Departments';

    const activeUserName = filters.userId
      ? users.find(u => u.id === filters.userId)?.name || 'All Members'
      : 'All Members';

    const metadata: ExportMetadata = {
      reportName: isDeptManager
        ? `${activeDeptName} Department Executive Analytics Export`
        : 'Executive Analytics Export',
      generatedDate: new Date().toLocaleString(),
      generatedBy: `${currentUser.name} (${currentUser.role})`,
      filtersApplied: {
        'Date Range': `${filters.dateFrom} to ${filters.dateTo} (${datePreset === 'all' ? 'All 2026' : datePreset})`,
        'Department Scope': activeDeptName,
        'Team Member': activeUserName,
        'Work Type': filters.requestType || 'All Work Types',
        'Priority': filters.priority || 'All Priorities',
        'Status': filters.status || 'All Statuses',
        'Search Filter': filters.searchQuery || 'None',
      },
      summaryKpis: {
        'Total Filtered Tasks': totalTasks,
        'Total Tracked Hours': `${totalActualHours.toFixed(1)} hrs`,
        'Total Planned Shift Hours': `${totalPlannedHours.toFixed(1)} hrs`,
        'Total Available Net Capacity': `${totalAvailableHours.toFixed(1)} hrs`,
        'Capacity Hours Variance': `${(totalAvailableHours - totalActualHours).toFixed(1)} hrs`,
        'FTE Utilization Rate': `${fteUtilizationPercent}%`,
        'Avg Completion Rate': `${totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : '0.0'}%`,
        'Overdue Tasks Count': overdueTasksCount,
        'Active Team Size': employeeUtilizationData.length,
        'Over Capacity Staff': employeeCapacityStats.over,
        'At Capacity Staff': employeeCapacityStats.atCap,
        'Under Capacity Staff': employeeCapacityStats.under,
      },
    };

    // 1. Task Master List Dataset
    const tasksData = filteredTasks.map(t => {
      const assignee = users.find(u => u.id === t.assignedUserId);
      const dept = departments.find(d => d.id === t.departmentId);
      const shiftH = t.shiftHours || t.plannedHours || 0;
      const actualH = t.actualHours || 0;
      const variance = Number((shiftH - actualH).toFixed(1));
      const isOverdue = t.status !== 'Completed' && t.status !== 'Cancelled' && t.endDate < '2026-08-26';

      return {
        'Task ID': t.id,
        'Task Title': t.taskName,
        'Department': dept?.name || 'N/A',
        'Assigned Member': assignee?.name || 'Unassigned',
        'Work / Task Type': t.taskType || t.requestType || 'General',
        'Priority': t.priority,
        'Status': t.status,
        'Start Date': t.startDate || '—',
        'Due Date': t.endDate || '—',
        'Planned Shift (h)': shiftH,
        'Actual Tracked (h)': actualH,
        'Variance (h)': variance,
        'Overdue': isOverdue ? 'YES' : 'NO',
        'Description': t.description || '',
      };
    });

    // 2. Staff Capacity & FTE Dataset
    const capacityData = employeeUtilizationData.map(e => ({
      'Employee Name': e.name,
      'Title': e.title,
      'Department': e.department,
      'Active Tasks': e.taskCount,
      'Available Net (h)': e.availableHours,
      'Actual Tracked (h)': e.actualHours,
      'Variance (h)': e.varianceHours,
      'FTE Capacity (%)': `${e.ftePercentage}%`,
      'Capacity Status': e.status,
      'Overdue Tasks': e.overdueCount,
    }));

    // 3. Department Breakdown Dataset
    const departmentData = departmentFteData.map(d => ({
      'Department Code': d.code,
      'Department Name': d.department,
      'Active Staff Count': d.activeEmployees,
      'Total Tasks': d.totalTasks,
      'Planned Shift (h)': d.totalPlannedHours,
      'Actual Tracked (h)': d.totalActualHours,
      'Variance (h)': d.totalVarianceHours,
      'Overdue Tasks': d.overdueTasksCount,
      'Avg FTE %': `${d.avgFtePercentage}%`,
    }));

    exportToExcel(
      metadata,
      [
        { sheetName: 'Tasks Master List', data: tasksData },
        { sheetName: 'Staff Capacity & FTE', data: capacityData },
        { sheetName: 'Department Breakdown', data: departmentData },
      ],
      isDeptManager ? `${activeDeptName.replace(/\s+/g, '_')}_Analytics_Export` : 'Workforce_Analytics_Export'
    );

    showToast('success', 'Excel Export Ready', 'Analytics workbook has been downloaded successfully.');
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* ================= TOP HEADER & ROLE BADGE BANNER ================= */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              {isAdmin
                ? 'Admin Executive Analytics'
                : isDeptManager
                ? `${currentDept?.name || 'Department'} Manager Analytics`
                : 'Manager Analytics'}
            </h2>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                isAdmin
                  ? 'bg-purple-100 text-purple-800'
                  : isDeptManager
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {isAdmin ? 'System Admin' : isDeptManager ? 'Dept Manager' : ''}
            </span>
          </div>
        </div>

        {/* Date Presets & Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-medium border border-slate-200/60">
            {(['week', 'month', 'quarter', 'year', 'all'] as const).map(preset => (
              <button
                key={preset}
                onClick={() => handlePresetChange(preset)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all cursor-pointer ${
                  datePreset === preset
                    ? 'bg-white text-blue-600 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {preset === 'all' ? 'All 2026' : preset}
              </button>
            ))}
          </div>

          {activeFiltersCount > 0 && (
            <button
              onClick={resetFilters}
              className="px-3 py-1.5 text-xs text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 font-semibold rounded-xl border border-rose-200 flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}

          {/* Export to Excel Button */}
          <button
            onClick={handleExportExcel}
            className="px-3.5 py-1.5 text-xs text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 font-semibold rounded-xl border border-emerald-200 shadow-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
            title="Export filtered dashboard datasets and metrics to Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* ================= PRIMARY FILTERS PANEL (REPLACES KPI CARDS) ================= */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Analytics Filters
            </h3>
            {activeFiltersCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
                {activeFiltersCount} active
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">
              {filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'} matched
            </span>
            <button
              onClick={handleExportExcel}
              className="px-2.5 py-1 text-xs text-slate-700 hover:text-emerald-700 bg-slate-50 hover:bg-emerald-50 font-medium rounded-lg border border-slate-200 hover:border-emerald-200 shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Download Excel spreadsheet of matched dashboard data"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 text-xs">
          {/* 1. Date Range */}
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Date Range</label>
            <div className="grid grid-cols-2 gap-1.5">
              <input
                type="date"
                value={filters.dateFrom}
                onChange={e => handleFilterChange('dateFrom', e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 bg-white text-slate-800 text-xs"
              />
              <input
                type="date"
                value={filters.dateTo}
                onChange={e => handleFilterChange('dateTo', e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 bg-white text-slate-800 text-xs"
              />
            </div>
          </div>

          {/* 2. Department */}
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Department</label>
            <select
              value={filters.departmentId}
              onChange={e => handleFilterChange('departmentId', e.target.value)}
              disabled={isDeptManager}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 bg-white text-slate-800 disabled:bg-slate-50 disabled:text-slate-500"
            >
              <option value="">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name === d.code ? d.name : `${d.name} (${d.code})`}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Employee */}
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Team Member</label>
            <select
              value={filters.userId}
              onChange={e => handleFilterChange('userId', e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 bg-white text-slate-800"
            >
              <option value="">All Members</option>
              {users
                .filter(u => (!filters.departmentId || u.departmentId === filters.departmentId) && u.status === 'Active')
                .map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
          </div>

          {/* 4. Request Type */}
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Work Type</label>
            <select
              value={filters.requestType}
              onChange={e => handleFilterChange('requestType', e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 bg-white text-slate-800"
            >
              <option value="">All Work Types</option>
              {Object.keys(WORK_TYPE_COLORS).map(reqType => (
                <option key={reqType} value={reqType}>
                  {reqType}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Priority */}
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Priority</label>
            <select
              value={filters.priority}
              onChange={e => handleFilterChange('priority', e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 bg-white text-slate-800"
            >
              <option value="">All Priorities</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>
          </div>

          {/* 6. Status */}
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Status</label>
            <select
              value={filters.status}
              onChange={e => handleFilterChange('status', e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 bg-white text-slate-800"
            >
              <option value="">All Statuses</option>
              <option value="Not Started">Not Started</option>
              <option value="In Progress">In Progress</option>
              <option value="On Hold">On Hold</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Quick Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={filters.searchQuery}
            onChange={e => handleFilterChange('searchQuery', e.target.value)}
            placeholder="Search tasks across name, ID, or description..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 bg-white text-slate-800 text-xs"
          />
        </div>
      </div>

      {/* ================= SECTION NAVIGATION TABS ================= */}
      <div className="flex items-center gap-1 border-b border-slate-200 pb-2 overflow-x-auto text-xs font-semibold">
        <button
          onClick={() => setActiveSection('all')}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeSection === 'all'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-3.5 h-3.5" /> All Analytics
        </button>
        <button
          onClick={() => setActiveSection('fte')}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeSection === 'fte'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Activity className="w-3.5 h-3.5" /> FTE & Capacity
        </button>
        <button
          onClick={() => setActiveSection('workload')}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeSection === 'workload'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <PieChartIcon className="w-3.5 h-3.5" /> Workload & Allocation
        </button>
        <button
          onClick={() => setActiveSection('compliance')}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeSection === 'compliance'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" /> Deadlines & Compliance
        </button>
      </div>

      {/* ================= SECTION 1: FTE & CAPACITY ================= */}
      {(activeSection === 'all' || activeSection === 'fte') && (
        <div className="space-y-6">
          {/* 1. FTE Utilization by Department (Landscape Card) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">FTE Utilization by Department</h3>
                <p className="text-xs text-slate-500">Available capacity vs logged effort across delivery units</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
                  {departmentFteData.length} Departments
                </span>
                <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
                  Avg FTE: {totalAvailableHours > 0 ? ((totalActualHours / totalAvailableHours) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </div>

            <div className="h-72 sm:h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={departmentFteData}
                  margin={{ top: 15, right: 20, left: -5, bottom: 20 }}
                  barSize={deptBarSize}
                  maxBarSize={48}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="code" tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }} />
                  <YAxis tick={{ fontSize: 11, fill: '#475569' }} unit="h" />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs border border-slate-700 space-y-1">
                            <p className="font-bold text-sm text-blue-300">{data.department}</p>
                            <p className="text-slate-300">Staff Count: <strong>{data.headcount}</strong></p>
                            <p className="text-slate-300">Available Capacity: <strong>{data.availableHours}h</strong></p>
                            <p className="text-slate-300">Logged Hours: <strong>{data.actualHours}h</strong></p>
                            <div className="pt-1 mt-1 border-t border-slate-700 flex justify-between gap-4">
                              <span className="text-slate-400">FTE Utilization:</span>
                              <span className="font-bold text-emerald-400">{data.ftePercent}%</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                  <ReferenceLine y={100} stroke="#10B981" strokeDasharray="4 4" label={{ value: '100% Target', fill: '#059669', fontSize: 10, position: 'top' }} />
                  <Bar dataKey="availableHours" name="Available Capacity (h)" fill="#94A3B8" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="actualHours" name="Actual Logged (h)" fill="#2563EB" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 text-center text-xs">
              {departmentFteData.map(d => (
                <div key={d.id} className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/60 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-800 truncate">{d.code}</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        d.ftePercent > 100
                          ? 'bg-rose-100 text-rose-700'
                          : d.ftePercent === 100
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {d.ftePercent > 100 ? 'Over' : d.ftePercent === 100 ? 'At Cap' : 'Under'}
                    </span>
                  </div>
                  <span
                    className={`text-base font-bold block ${
                      d.ftePercent > 100 ? 'text-rose-600' : d.ftePercent === 100 ? 'text-emerald-600' : 'text-blue-600'
                    }`}
                  >
                    {d.ftePercent}%
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    {d.actualHours}h / {d.availableHours}h • {d.headcount} staff
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Team Member Utilization (Landscape Card with Dynamic Height) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Team Member Utilization</h3>
                <p className="text-xs text-slate-500">Benchmark: Under (&lt;100%), At Capacity (=100%), Over Capacity (&gt;100%)</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg font-semibold border border-blue-200">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  &lt;100% Under ({employeeCapacityStats.under})
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg font-semibold border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  =100% At Cap ({employeeCapacityStats.atCap})
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 text-rose-700 rounded-lg font-semibold border border-rose-200">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  &gt;100% Over ({employeeCapacityStats.over})
                </span>
              </div>
            </div>

            {/* Dynamic height based on employee count to prevent cramped bars */}
            <div style={{ height: `${employeeUtilizationChartHeight}px` }} className="w-full transition-all duration-300">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={employeeUtilizationData}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 15, bottom: 10 }}
                  barSize={Math.max(16, Math.min(26, 320 / Math.max(employeeUtilizationData.length, 1)))}
                  maxBarSize={24}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis type="number" domain={[0, 'dataMax + 20']} unit="%" tick={{ fontSize: 11, fill: '#475569' }} />
                  <YAxis dataKey="employee" type="category" tick={{ fontSize: 11, fill: '#1E293B', fontWeight: 500 }} width={140} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs border border-slate-700 space-y-1">
                            <p className="font-bold text-sm text-white">{data.employee}</p>
                            <p className="text-slate-300">Dept: <strong>{data.department}</strong></p>
                            <p className="text-slate-300">Actual Logged: <strong>{data.actualHours}h</strong></p>
                            <p className="text-slate-300">Available: <strong>{data.availableHours}h</strong></p>
                            <div className="pt-1 mt-1 border-t border-slate-700 flex justify-between gap-3">
                              <span className="text-slate-400">Capacity Status:</span>
                              <span className={`font-bold ${isOverCapacity(data.status) ? 'text-rose-400' : isAtCapacity(data.status) ? 'text-emerald-400' : 'text-blue-400'}`}>
                                {data.ftePercent}% ({data.status})
                              </span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine x={100} stroke="#10B981" strokeDasharray="3 3" label={{ value: '100% Target', fill: '#059669', fontSize: 10, position: 'top' }} />
                  <Bar dataKey="ftePercent" name="FTE Utilization %" radius={[0, 6, 6, 0]}>
                    {employeeUtilizationData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          isOverCapacity(entry.status)
                            ? '#EF4444'
                            : isAtCapacity(entry.status)
                            ? '#10B981'
                            : '#3B82F6'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span>Dynamic height adapts to team roster size ({employeeUtilizationData.length} active members)</span>
              <span className="font-semibold text-slate-700">Ranked by highest workload demand</span>
            </div>
          </div>

          {/* Shift Hours vs Actual Hours (Landscape Card) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Shift Hours vs Actual Hours</h3>
                <p className="text-xs text-slate-500">Planned shift hours vs logged actual hours effort variance by department</p>
              </div>
              <span className="text-xs text-slate-600 font-medium px-3 py-1 bg-slate-100 rounded-lg">
                Net Workforce Variance:{' '}
                <strong className={totalActualHours - totalPlannedHours > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                  {totalActualHours - totalPlannedHours > 0 ? '+' : ''}{(totalActualHours - totalPlannedHours).toFixed(1)}h
                </strong>
              </span>
            </div>

            <div className="h-72 sm:h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={plannedVsActualData}
                  margin={{ top: 15, right: 20, left: -5, bottom: 20 }}
                  barSize={deptBarSize}
                  maxBarSize={44}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }} />
                  <YAxis tick={{ fontSize: 11, fill: '#475569' }} unit="h" />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        const isOver = data.Variance > 0;
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs border border-slate-700 space-y-1">
                            <p className="font-bold text-sm text-blue-300">{data.fullName}</p>
                            <p className="text-slate-300">Shift Hours: <strong>{data.Shift ?? data.Planned}h</strong></p>
                            <p className="text-slate-300">Actual Hours: <strong>{data.Actual}h</strong></p>
                            <p className={`pt-1 border-t border-slate-700 font-bold ${isOver ? 'text-rose-400' : 'text-emerald-400'}`}>
                              Variance: {isOver ? '+' : ''}{data.Variance}h
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                  <Bar dataKey="Shift" name="Shift Hours (h)" fill="#94A3B8" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Actual" name="Actual Hours (h)" fill="#2563EB" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 text-center text-xs">
              {plannedVsActualData.map(d => (
                <div key={d.name} className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                  <span className="font-bold text-slate-800 truncate block">{d.name}</span>
                  <div className="mt-1 flex items-baseline justify-center gap-1">
                    <span className="text-slate-500">{d.Shift}h shift</span>
                    <span className="text-slate-300">•</span>
                    <span className="font-bold text-slate-900">{d.Actual}h act</span>
                  </div>
                  <span
                    className={`text-[11px] font-bold block mt-1 ${
                      d.Variance > 0 ? 'text-rose-600' : d.Variance < 0 ? 'text-blue-600' : 'text-emerald-600'
                    }`}
                  >
                    {d.Variance > 0 ? `+${d.Variance}h over` : d.Variance < 0 ? `${d.Variance}h under` : 'Balanced'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= SECTION 2: WORKLOAD & ALLOCATION ================= */}
      {(activeSection === 'all' || activeSection === 'workload') && (
        <div className="space-y-6">
          {/* 5. Task Status Breakdown (Landscape Card) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Task Status Breakdown</h3>
                <p className="text-xs text-slate-500">Live operational lifecycle status across all active tasks</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
                {totalTasks} Total Tasks in Scope
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-2">
              <div className="lg:col-span-5 h-64 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={taskStatusDistribution}
                      innerRadius={68}
                      outerRadius={96}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {taskStatusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          const pct = totalTasks > 0 ? Math.round((data.value / totalTasks) * 100) : 0;
                          return (
                            <div className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-lg">
                              {data.name}: {data.value} tasks ({pct}%)
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute text-center pointer-events-none">
                  <span className="text-2xl font-bold text-slate-900 block leading-tight">{totalTasks}</span>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Total Tasks</span>
                </div>
              </div>

              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {taskStatusDistribution.map(st => {
                  const pct = totalTasks > 0 ? Math.round((st.value / totalTasks) * 100) : 0;
                  return (
                    <div
                      key={st.name}
                      className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/70 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: st.color }} />
                          <span className="font-bold text-slate-800">{st.name}</span>
                        </div>
                        <span className="font-bold text-slate-900">
                          {st.value} <span className="text-slate-400 font-normal">({pct}%)</span>
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: st.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 6. Task Volume by Department (Landscape Card) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Task Volume by Department</h3>
                <p className="text-xs text-slate-500">In Progress vs Completed workstreams across functional units</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
                  {taskVolumeByDeptData.reduce((acc, d) => acc + d.inProgress, 0)} In Progress
                </span>
                <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200">
                  {taskVolumeByDeptData.reduce((acc, d) => acc + d.completed, 0)} Completed
                </span>
              </div>
            </div>

            <div className="h-72 sm:h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={taskVolumeByDeptData}
                  margin={{ top: 15, right: 20, left: -10, bottom: 20 }}
                  barSize={deptBarSize}
                  maxBarSize={48}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="department" tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }} />
                  <YAxis tick={{ fontSize: 11, fill: '#475569' }} allowDecimals={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg text-xs space-y-1">
                            <p className="font-bold text-sm text-blue-300">{data.fullName}</p>
                            <p>Total Tasks: <strong>{data.totalTasks}</strong></p>
                            <p className="text-blue-300">In Progress: {data.inProgress}</p>
                            <p className="text-emerald-300">Completed: {data.completed}</p>
                            <p className="text-slate-400">Other: {data.others}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                  <Bar dataKey="inProgress" name="In Progress" fill="#2563EB" stackId="a" />
                  <Bar dataKey="completed" name="Completed" fill="#10B981" stackId="a" />
                  <Bar dataKey="others" name="Other Status" fill="#94A3B8" stackId="a" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 text-center text-xs">
              {taskVolumeByDeptData.map(d => {
                const completionRate = d.totalTasks > 0 ? Math.round((d.completed / d.totalTasks) * 100) : 0;
                return (
                  <div key={d.department} className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                    <span className="font-bold text-slate-800 truncate block">{d.department}</span>
                    <span className="text-base font-bold text-slate-900 block mt-1">{d.totalTasks} tasks</span>
                    <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">
                      {completionRate}% Completed ({d.completed}/{d.totalTasks})
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 7. Employee Workload Density (Landscape Card with Dynamic Height) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Employee Workload Density</h3>
                <p className="text-xs text-slate-500">Planned shift hours vs available capacity across team roster</p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 bg-slate-100 text-slate-700 rounded-lg">
                Total Planned Shifts: <strong>{totalPlannedHours} Hours</strong>
              </span>
            </div>

            {/* Dynamic height based on employee count */}
            <div style={{ height: `${employeeWorkloadChartHeight}px` }} className="w-full transition-all duration-300">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={employeeWorkloadData}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 15, bottom: 10 }}
                  barSize={Math.max(16, Math.min(24, 300 / Math.max(employeeWorkloadData.length, 1)))}
                  maxBarSize={24}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#475569' }} unit="h" />
                  <YAxis dataKey="employee" type="category" tick={{ fontSize: 11, fill: '#1E293B', fontWeight: 500 }} width={140} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg text-xs space-y-1">
                            <p className="font-bold text-sm text-white">{data.employee}</p>
                            <p className="text-slate-300">Shift Hours: <strong>{data.plannedHours}h</strong></p>
                            <p className="text-slate-300">Available Capacity: <strong>{data.availableHours}h</strong></p>
                            <p className="text-indigo-400 font-semibold pt-1 border-t border-slate-700">
                              Load: {data.availableHours > 0 ? Math.round((data.plannedHours / data.availableHours) * 100) : 0}% of capacity
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                  <Bar dataKey="availableHours" name="Available Capacity (h)" fill="#CBD5E1" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="plannedHours" name="Shift Hours (h)" fill="#6366F1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span>Dynamic height adapts to roster volume ({employeeWorkloadData.length} team members)</span>
              <span className="font-semibold text-slate-700">
                Average Shift Load: {employeeWorkloadData.length > 0 ? (totalPlannedHours / employeeWorkloadData.length).toFixed(1) : 0}h per person
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ================= SECTION 3: DEADLINES & COMPLIANCE ================= */}
      {(activeSection === 'all' || activeSection === 'compliance') && (
        <div className="space-y-6">
          {/* 9. Overdue Tasks by Department (Landscape Card) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  Overdue Tasks by Department
                  {overdueTasksCount > 0 && (
                    <span className="bg-rose-100 text-rose-700 text-xs font-bold px-2.5 py-0.5 rounded-full">
                      {overdueTasksCount} Overdue Items
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500">Uncompleted tasks past deadline across delivery units</p>
              </div>

              {overdueTasksCount > 0 && (
                <button
                  onClick={() => {
                    setSelectedOverdueDept(null);
                    setIsOverdueModalOpen(true);
                  }}
                  className="text-xs text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 px-3.5 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-rose-200/60 self-start sm:self-auto"
                >
                  <span>Detailed Drill Down</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="h-72 sm:h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={overdueTasksByDeptData}
                  margin={{ top: 15, right: 20, left: -10, bottom: 20 }}
                  barSize={deptBarSize}
                  maxBarSize={48}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="department" tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }} />
                  <YAxis tick={{ fontSize: 11, fill: '#475569' }} allowDecimals={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg text-xs space-y-1">
                            <p className="font-bold text-sm text-rose-300">{data.fullName}</p>
                            <p>Overdue Tasks: <strong className="text-rose-400">{data.overdueCount}</strong></p>
                            <p className="text-[10px] text-slate-400">Click bar to inspect task roster</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="overdueCount"
                    name="Overdue Tasks"
                    fill="#EF4444"
                    radius={[6, 6, 0, 0]}
                    onClick={(entry) => {
                      if (entry && entry.id) {
                        setSelectedOverdueDept(entry.id);
                        setIsOverdueModalOpen(true);
                      }
                    }}
                    cursor="pointer"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <span className="text-slate-500">Schedule SLA Benchmark: Target 0 overdue workstreams</span>
              {overdueTasksCount === 0 ? (
                <span className="text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg font-semibold border border-emerald-200">
                  ✓ SLA Met: 0 Overdue Tasks
                </span>
              ) : (
                <span className="text-rose-700 bg-rose-50 px-3 py-1 rounded-lg font-semibold border border-rose-200">
                  ⚠️ {overdueTasksCount} overdue tasks flagged across {overdueTasksByDeptData.filter(d => d.overdueCount > 0).length} departments
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= DRILL-DOWN MODAL FOR OVERDUE TASKS ================= */}
      {isOverdueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Overdue Tasks Drill-Down
                    {selectedOverdueDept && (
                      <span className="text-xs font-normal text-slate-500 ml-2">
                        ({departments.find(d => d.id === selectedOverdueDept)?.name})
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {drilldownOverdueTasks.length} active task{drilldownOverdueTasks.length !== 1 ? 's' : ''} past deadline
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {selectedOverdueDept && (
                  <button
                    onClick={() => setSelectedOverdueDept(null)}
                    className="text-xs text-slate-600 hover:text-blue-600 px-2.5 py-1 rounded-lg border border-slate-200 bg-white cursor-pointer"
                  >
                    Show All Departments
                  </button>
                )}
                <button
                  onClick={() => setIsOverdueModalOpen(false)}
                  className="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Table Content */}
            <div className="p-5 overflow-y-auto flex-1 space-y-3">
              {drilldownOverdueTasks.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  ✓ No overdue tasks found for the selected criteria.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                        <th className="pb-2.5 px-3">Task ID & Name</th>
                        <th className="pb-2.5 px-3">Department</th>
                        <th className="pb-2.5 px-3">Assignee</th>
                        <th className="pb-2.5 px-3">Due Date</th>
                        <th className="pb-2.5 px-3">Overdue</th>
                        <th className="pb-2.5 px-3">Priority</th>
                        <th className="pb-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {drilldownOverdueTasks.map(task => {
                        const days = getDaysOverdue(task, new Date('2026-08-26T23:59:59Z'));
                        const assignee = users.find(u => u.id === task.assignedUserId);
                        const dept = departments.find(d => d.id === task.departmentId);

                        return (
                          <tr key={task.id} className="hover:bg-rose-50/40 transition-colors">
                            <td className="py-3 px-3">
                              <div className="font-semibold text-slate-900">{task.taskName}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{task.id} • {task.taskType}</div>
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-medium text-slate-800">{dept?.name || 'N/A'}</span>
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-medium text-slate-800">{assignee?.name || 'Unassigned'}</span>
                            </td>
                            <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">
                              {task.endDate || '—'}
                            </td>
                            <td className="py-3 px-3">
                              <span className="bg-rose-600 text-white font-bold px-2 py-0.5 rounded text-[10px] inline-block">
                                +{days} day{days !== 1 ? 's' : ''}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  task.priority === 'Critical'
                                    ? 'bg-rose-100 text-rose-800'
                                    : task.priority === 'High'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {task.priority}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={() => {
                                  setIsOverdueModalOpen(false);
                                  onViewTask(task);
                                }}
                                className="px-3 py-1 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg font-semibold text-[11px] transition-colors cursor-pointer inline-flex items-center gap-1"
                              >
                                <span>Inspect</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
              <span>Inspect opens full task details and execution timeline.</span>
              <button
                onClick={() => setIsOverdueModalOpen(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
