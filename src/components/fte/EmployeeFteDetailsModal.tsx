import React, { useState, useMemo } from 'react';
import {
  X,
  User,
  Clock,
  Calendar,
  Building,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Search,
  Filter,
  Download,
  Briefcase,
  Layers,
  Activity,
  History,
  Timer,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Tag,
  ArrowUpDown,
  ExternalLink,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { User as UserType, Task, TimeSession, Department, WorkingSchedule } from '../../types';
import { exportToExcel } from '../../utils/exportUtils';

export interface DailyTaskBreakdown {
  taskId: string;
  taskName: string;
  workType: string;
  hours: number;
  sessionCount: number;
  percentageOfDay: number;
  notes: string[];
}

export interface DayDistributionItem {
  date: string;
  hours: number;
  sessionCount: number;
  taskCount: number;
  tasks: DailyTaskBreakdown[];
  isWorkingDay: boolean;
}

export interface EmployeeMetricItem {
  user: UserType;
  schedule: WorkingSchedule;
  departmentName: string;
  workingDaysCount: number;
  holidayCount: number;
  availableHours: number;
  shiftHours: number;
  shiftHoursPerDay: number;
  breakHours: number;
  breakHoursPerDay: number;
  plannedHours: number;
  actualHours: number;
  capacityVariance: number;
  fte: number;
  status: 'UNDER CAPACITY' | 'NEAR CAPACITY' | 'OVER CAPACITY';
}

interface EmployeeFteDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeMetric: EmployeeMetricItem | null;
  tasks: Task[];
  timeSessions: TimeSession[];
  dateRange: { startDate: string; endDate: string };
  periodLabel: string;
}

export const EmployeeFteDetailsModal: React.FC<EmployeeFteDetailsModalProps> = ({
  isOpen,
  onClose,
  employeeMetric,
  tasks,
  timeSessions,
  dateRange,
  periodLabel,
}) => {
  const [activeTab, setActiveTab] = useState<'daily' | 'logs'>('daily');
  const [logSearch, setLogSearch] = useState('');
  const [logTypeFilter, setLogTypeFilter] = useState<'ALL' | 'TIMER' | 'MANUAL' | 'CORRECTION' | 'OT'>('ALL');
  const [logScope, setLogScope] = useState<'period' | 'all'>('period');
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [isFullScreen, setIsFullScreen] = useState(false);

  if (!isOpen || !employeeMetric) return null;

  const {
    user,
    schedule,
    departmentName,
    availableHours,
    shiftHours,
    shiftHoursPerDay,
    breakHours,
    breakHoursPerDay,
    actualHours,
    capacityVariance,
    fte,
    status,
    workingDaysCount,
  } = employeeMetric;

  // Time sessions for this employee
  const employeeSessions = useMemo(() => {
    return timeSessions.filter(s => s.userId === user.id);
  }, [timeSessions, user.id]);

  // Filtered time sessions according to scope, type, and search
  const filteredSessions = useMemo(() => {
    return employeeSessions.filter(session => {
      // Scope filter
      if (logScope === 'period') {
        const sessionDate = session.startTime.split('T')[0];
        if (sessionDate < dateRange.startDate || sessionDate > dateRange.endDate) {
          return false;
        }
      }

      // Entry type filter
      if (logTypeFilter === 'TIMER') {
        if (session.isManual || session.correctionType || session.manualReason) return false;
      } else if (logTypeFilter === 'MANUAL') {
        if (!session.isManual && !session.manualReason) return false;
      } else if (logTypeFilter === 'CORRECTION') {
        if (!session.correctionType && !session.manualReason) return false;
      } else if (logTypeFilter === 'OT') {
        if (!session.isOvertime && session.timeEntryType !== 'OT') return false;
      }

      // Search filter
      if (logSearch.trim()) {
        const q = logSearch.toLowerCase().trim();
        const task = tasks.find(t => t.id === session.taskId);
        const taskName = task?.taskName?.toLowerCase() || '';
        const taskId = session.taskId?.toLowerCase() || '';
        const notes = (session.notes || '').toLowerCase();
        const reason = (session.manualReason || '').toLowerCase();
        const corrType = (session.correctionType || '').toLowerCase();

        if (
          !taskName.includes(q) &&
          !taskId.includes(q) &&
          !notes.includes(q) &&
          !reason.includes(q) &&
          !corrType.includes(q)
        ) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }, [employeeSessions, logScope, dateRange, logTypeFilter, logSearch, tasks]);

  // Log KPI calculations
  const logStats = useMemo(() => {
    const totalCount = filteredSessions.length;
    const totalHours = Number(filteredSessions.reduce((sum, s) => sum + s.durationHours, 0).toFixed(1));
    const manualCount = filteredSessions.filter(s => s.isManual || s.manualReason || s.correctionType).length;
    const otHours = Number(
      filteredSessions
        .filter(s => s.isOvertime || s.timeEntryType === 'OT')
        .reduce((sum, s) => sum + s.durationHours, 0)
        .toFixed(1)
    );

    return { totalCount, totalHours, manualCount, otHours };
  }, [filteredSessions]);

  // Daily logged hours breakdown for period with multi-task support per date
  const dailyDistribution: DayDistributionItem[] = useMemo(() => {
    const workingDays = schedule?.workingDays || [1, 2, 3, 4, 5];
    const workingDaysSet = new Set(workingDays);

    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return [];
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    // Map sessions to dates and tasks
    const sessionMap: Record<
      string,
      {
        hours: number;
        sessionCount: number;
        taskMap: Record<
          string,
          {
            taskId: string;
            taskName: string;
            workType: string;
            hours: number;
            sessionCount: number;
            notes: string[];
          }
        >;
      }
    > = {};

    employeeSessions.forEach(s => {
      const day = s.startTime.split('T')[0];
      if (day >= dateRange.startDate && day <= dateRange.endDate) {
        if (!sessionMap[day]) {
          sessionMap[day] = { hours: 0, sessionCount: 0, taskMap: {} };
        }
        sessionMap[day].hours += s.durationHours;
        sessionMap[day].sessionCount += 1;

        const task = tasks.find(t => t.id === s.taskId);
        const taskId = s.taskId || 'GEN-ACT';
        const taskName = task?.taskName || s.notes || 'General Task Activity';
        const workType = s.workType || task?.workType || task?.taskType || 'Operational';

        if (!sessionMap[day].taskMap[taskId]) {
          sessionMap[day].taskMap[taskId] = {
            taskId,
            taskName,
            workType,
            hours: 0,
            sessionCount: 0,
            notes: [],
          };
        }
        sessionMap[day].taskMap[taskId].hours += s.durationHours;
        sessionMap[day].taskMap[taskId].sessionCount += 1;
        if (s.notes && !sessionMap[day].taskMap[taskId].notes.includes(s.notes)) {
          sessionMap[day].taskMap[taskId].notes.push(s.notes);
        }
      }
    });

    const daysList: DayDistributionItem[] = [];

    const current = new Date(start);
    while (current <= end) {
      const dayOfWeek = current.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
      const dateKey = current.toISOString().split('T')[0];
      const isWorkingDay = workingDaysSet.has(dayOfWeek);
      const sessionData = sessionMap[dateKey];

      // Include all scheduled working days in the period (5 days per standard work week),
      // plus any unscheduled weekend days if the user actually logged overtime/sessions on them
      if (isWorkingDay || (sessionData && sessionData.hours > 0)) {
        const totalDayHours = Number((sessionData?.hours || 0).toFixed(1));
        const rawTasks = sessionData ? Object.values(sessionData.taskMap) : [];
        const taskList: DailyTaskBreakdown[] = rawTasks
          .map(t => ({
            taskId: t.taskId,
            taskName: t.taskName,
            workType: t.workType,
            hours: Number(t.hours.toFixed(1)),
            sessionCount: t.sessionCount,
            percentageOfDay: totalDayHours > 0 ? Math.round((t.hours / totalDayHours) * 100) : 0,
            notes: t.notes,
          }))
          .sort((a, b) => b.hours - a.hours);

        daysList.push({
          date: dateKey,
          hours: totalDayHours,
          sessionCount: sessionData?.sessionCount || 0,
          taskCount: taskList.length,
          tasks: taskList,
          isWorkingDay,
        });
      }

      current.setDate(current.getDate() + 1);
    }

    return daysList;
  }, [employeeSessions, dateRange, schedule, tasks]);

  // Toggle date row expansion
  const toggleDateExpansion = (date: string) => {
    setExpandedDates(prev => ({
      ...prev,
      [date]: !prev[date],
    }));
  };

  const handleToggleAllDates = () => {
    const allExpanded = dailyDistribution.every(d => expandedDates[d.date]);
    if (allExpanded) {
      setExpandedDates({});
    } else {
      const all: Record<string, boolean> = {};
      dailyDistribution.forEach(d => {
        all[d.date] = true;
      });
      setExpandedDates(all);
    }
  };

  // Helper date formatter
  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateOnly = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(`${dateStr}T00:00:00`);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateWithDay = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(`${dateStr}T00:00:00`);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Export employee dossier
  const handleExportData = () => {
    const sessionExportData = employeeSessions.map(s => {
      const t = tasks.find(tsk => tsk.id === s.taskId);
      return {
        'Date': s.startTime.split('T')[0],
        'Start Time': formatDateTime(s.startTime),
        'End Time': formatDateTime(s.endTime),
        'Duration (h)': s.durationHours,
        'Task ID': s.taskId,
        'Task Name': t?.taskName || '—',
        'Type': s.isManual ? 'Manual Entry' : s.correctionType ? `Correction (${s.correctionType})` : 'Live Timer',
        'Overtime': s.isOvertime || s.timeEntryType === 'OT' ? 'Yes' : 'No',
        'Notes': s.notes || s.manualReason || '—',
      };
    });

    exportToExcel(
      {
        reportName: `${user.name} - Employee FTE Time Logs Dossier`,
        generatedDate: new Date().toLocaleString(),
        generatedBy: `System Administrator`,
        filtersApplied: {
          Employee: `${user.name} (${user.employeeId})`,
          Department: departmentName,
          Period: `${periodLabel} (${dateRange.startDate} to ${dateRange.endDate})`,
          'FTE Utilization': `${fte}% (${status})`,
        },
        summaryKpis: {
          'Available Working Hours': `${availableHours}h`,
          'Actual Tracked Hours': `${actualHours}h`,
          'Capacity Variance': `${capacityVariance > 0 ? `+${capacityVariance}` : capacityVariance}h`,
          'FTE Utilization %': `${fte}%`,
          'Total Logged Sessions': employeeSessions.length,
        },
      },
      sessionExportData,
      `${user.name.replace(/\s+/g, '_')}_FTE_TimeLogs`
    );
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs ${isFullScreen ? 'p-1 sm:p-2' : 'p-3 sm:p-5 lg:p-6'} overflow-y-auto animate-in fade-in duration-200`}>
      <div
        className={`bg-white rounded-2xl shadow-2xl border border-slate-200 ${
          isFullScreen
            ? 'w-[99vw] h-[98vh] max-w-none max-h-[98vh]'
            : 'w-full max-w-7xl xl:max-w-[1600px] 2xl:max-w-[1720px] max-h-[94vh]'
        } flex flex-col overflow-hidden my-auto text-slate-800 transition-all duration-200`}
      >
        {/* Modal Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-start justify-between bg-gradient-to-r from-slate-50 via-white to-blue-50/30">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-blue-500/20 shrink-0">
              {user.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900">{user.name}</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  {user.employeeId}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    status === 'OVER CAPACITY'
                      ? 'bg-rose-100 text-rose-800'
                      : status === 'NEAR CAPACITY'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {status} ({fte}%)
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                <span>{user.title}</span>
                <span className="text-slate-300">•</span>
                <span className="font-medium text-slate-700">{departmentName}</span>
                <span className="text-slate-300">•</span>
                <span>{user.email}</span>
                <span className="text-slate-300">•</span>
                <span className="text-blue-600 font-medium">{schedule.name} ({schedule.hoursPerDay}h/day)</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportData}
              title="Export Employee Dossier"
              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer border border-slate-200 flex items-center gap-1.5 text-xs font-medium px-3"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export Dossier</span>
            </button>
            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              title={isFullScreen ? 'Exit Full Screen' : 'Full Screen View'}
              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer border border-slate-200 flex items-center gap-1.5 text-xs font-medium px-2.5"
            >
              {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Capacity & FTE Executive Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-4 bg-slate-50/80 border-b border-slate-100 text-xs">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-slate-500 text-[11px] block font-medium">Evaluation Period</span>
            <div className="font-bold text-slate-900 text-sm mt-0.5 capitalize">{periodLabel}</div>
            <span className="text-[10px] text-slate-400 font-mono">
              {dateRange.startDate} ~ {dateRange.endDate}
            </span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-slate-500 text-[11px] block font-medium">Shift Hour</span>
            <div className="font-bold text-slate-900 text-sm mt-0.5">{shiftHours}h</div>
            <span className="text-[10px] text-slate-400" title="10h daily shift · 2h breaks (1h lunch 12:00-1:00 PM, 30m morning, 30m afternoon)">
              {workingDaysCount}d × {shiftHoursPerDay}h (2h break/day)
            </span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-slate-500 text-[11px] block font-medium">Available Capacity</span>
            <div className="font-bold text-slate-900 text-sm mt-0.5">{availableHours}h</div>
            <span className="text-[10px] text-slate-400">
              8h net productive/day
            </span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-slate-500 text-[11px] block font-medium">Actual Logged Hours</span>
            <div className="font-bold text-blue-600 text-sm mt-0.5">{actualHours}h</div>
            <span className="text-[10px] text-slate-400">
              Across all logged tasks
            </span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-slate-500 text-[11px] block font-medium">Capacity Variance</span>
            <div className={`font-bold text-sm mt-0.5 ${capacityVariance < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
              {capacityVariance > 0 ? `+${capacityVariance}h` : `${capacityVariance}h`}
            </div>
            <span className="text-[10px] text-slate-400">
              {capacityVariance >= 0 ? 'Surplus Capacity' : 'Deficit / Overtime'}
            </span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-slate-500 text-[11px] block font-medium">FTE Utilization</span>
            <div className={`font-bold text-sm mt-0.5 ${fte > 100 ? 'text-rose-600' : fte >= 80 ? 'text-emerald-700' : 'text-blue-600'}`}>
              {fte}%
            </div>
            <span className="text-[10px] text-slate-400">
              Target: 100% (Actual / Avail)
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-200 bg-white">
          <button
            onClick={() => setActiveTab('logs')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'logs'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Clock className="w-4 h-4" />
            Time Tracking Logs ({filteredSessions.length})
          </button>
          <button
            onClick={() => setActiveTab('daily')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'daily'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Daily Work Distribution ({dailyDistribution.length} days)
          </button>
        </div>

        {/* Modal Body / Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* TAB 1: TIME TRACKING LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              {/* Log Controls & Filter */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative w-full sm:w-60">
                    <input
                      type="text"
                      value={logSearch}
                      onChange={e => setLogSearch(e.target.value)}
                      placeholder="Search notes, task ID..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:ring-2 focus:ring-blue-500"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  </div>

                  <select
                    value={logScope}
                    onChange={e => setLogScope(e.target.value as any)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs"
                  >
                    <option value="period">Selected Period ({periodLabel})</option>
                    <option value="all">All History Logs</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
                  <span className="text-slate-500 text-xs whitespace-nowrap">Type:</span>
                  {(['ALL', 'TIMER', 'MANUAL', 'CORRECTION', 'OT'] as const).map(tp => (
                    <button
                      key={tp}
                      onClick={() => setLogTypeFilter(tp)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                        logTypeFilter === tp
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {tp === 'ALL'
                        ? 'All'
                        : tp === 'TIMER'
                        ? 'Timer'
                        : tp === 'MANUAL'
                        ? 'Manual'
                        : tp === 'CORRECTION'
                        ? 'Correction'
                        : 'OT'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Log Stats Pill Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500">Log Entries</span>
                  <div className="text-lg font-bold text-slate-900">{logStats.totalCount}</div>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500">Logged Hours</span>
                  <div className="text-lg font-bold text-blue-600">{logStats.totalHours}h</div>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500">Manual / Corrections</span>
                  <div className="text-lg font-bold text-amber-600">{logStats.manualCount}</div>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500">Overtime Hours</span>
                  <div className="text-lg font-bold text-rose-600">{logStats.otHours}h</div>
                </div>
              </div>

              {/* Log Table */}
              {filteredSessions.length === 0 ? (
                <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <Clock className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-600 text-sm">No time logs recorded</p>
                  <p className="text-xs text-slate-400 mt-0.5">No time tracking sessions recorded for this filter scope.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <tr>
                        <th className="py-3 px-4 font-semibold">Date & Time Range</th>
                        <th className="py-3 px-4 font-semibold">Associated Task</th>
                        <th className="py-3 px-4 font-semibold">Entry Classification</th>
                        <th className="py-3 px-4 font-semibold text-right">Duration (h)</th>
                        <th className="py-3 px-4 font-semibold">Reason / Work Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredSessions.map(session => {
                        const task = tasks.find(t => t.id === session.taskId);
                        const isManual = session.isManual || session.manualReason || session.correctionType;
                        const isOT = session.isOvertime || session.timeEntryType === 'OT';

                        return (
                          <tr key={session.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="font-semibold text-slate-900 block">
                                {formatDateOnly(session.startTime)}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                                {new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </td>
                            <td className="py-3 px-4 max-w-[200px]">
                              {task ? (
                                <div>
                                  <span className="font-semibold text-slate-900 block truncate" title={task.taskName}>
                                    {task.taskName}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {task.id}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">Task ({session.taskId})</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {isManual ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">
                                    {session.correctionType ? 'Correction' : 'Manual Entry'}
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                                    Live Timer
                                  </span>
                                )}
                                {isOT && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-800">
                                    OT
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                              {session.durationHours}h
                            </td>
                            <td className="py-3 px-4 max-w-[260px]">
                              <p className="text-slate-700 truncate" title={session.notes || session.manualReason || '—'}>
                                {session.notes || session.manualReason || <span className="text-slate-400 italic">Standard tracking session</span>}
                              </p>
                              {session.correctionType && (
                                <span className="text-[10px] text-amber-700 font-medium block">
                                  Reason: {session.correctionType}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DAILY WORK DISTRIBUTION */}
          {activeTab === 'daily' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-blue-50 via-indigo-50/40 to-slate-50 p-4 rounded-xl border border-blue-100 text-xs text-blue-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">Daily Logged Work & Task Distribution</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                      Multi-Task Enabled
                    </span>
                  </div>
                  <span className="text-slate-600 text-[11px] block mt-0.5">
                    Breakdown of tasks executed per date against daily scheduled shift target ({schedule.hoursPerDay || 10}h/day shift with 2h scheduled breaks: 1h lunch 12:00-1:00 PM, 30m AM, 30m PM → 8h net working time). Multiple distinct tasks executed on the same date are itemized below.
                  </span>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={handleToggleAllDates}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5"
                  >
                    {dailyDistribution.every(d => expandedDates[d.date]) ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                        Collapse All Details
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                        Expand All Task Details
                      </>
                    )}
                  </button>
                  <div className="text-right font-mono font-bold text-base text-blue-700 bg-white px-3 py-1 rounded-lg border border-blue-200/60 shadow-2xs">
                    {actualHours}h <span className="text-xs font-normal text-slate-500">total</span>
                  </div>
                </div>
              </div>

              {dailyDistribution.length === 0 ? (
                <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <Calendar className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-600 text-sm">No activity recorded for this period</p>
                  <p className="text-xs text-slate-400 mt-0.5">Switch the evaluation period or start logging time.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <tr>
                        <th className="py-3 px-3 font-semibold w-10 text-center"></th>
                        <th className="py-3 px-4 font-semibold">Date</th>
                        <th className="py-3 px-4 font-semibold text-right">Daily Tracked</th>
                        <th className="py-3 px-4 font-semibold text-right">Shift Hour ({schedule.hoursPerDay || 10}h)</th>
                        <th className="py-3 px-4 font-semibold text-right">Daily Variance</th>
                        <th className="py-3 px-4 font-semibold text-center">Tasks Executed</th>
                        <th className="py-3 px-4 font-semibold">Task Breakdown & Allocation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dailyDistribution.map(day => {
                        const target = day.isWorkingDay ? schedule.hoursPerDay : 0;
                        const diff = Number((day.hours - target).toFixed(1));
                        const isExpanded = expandedDates[day.date];
                        const hasMultipleTasks = day.taskCount > 1;

                        const taskColors = [
                          { bg: 'bg-blue-600', text: 'text-blue-700', pill: 'bg-blue-50 text-blue-800 border-blue-200' },
                          { bg: 'bg-indigo-600', text: 'text-indigo-700', pill: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
                          { bg: 'bg-purple-600', text: 'text-purple-700', pill: 'bg-purple-50 text-purple-800 border-purple-200' },
                          { bg: 'bg-emerald-600', text: 'text-emerald-700', pill: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
                          { bg: 'bg-amber-600', text: 'text-amber-700', pill: 'bg-amber-50 text-amber-800 border-amber-200' },
                        ];

                        return (
                          <React.Fragment key={day.date}>
                            <tr
                              onClick={() => day.taskCount > 0 && toggleDateExpansion(day.date)}
                              className={`hover:bg-slate-50/80 transition-colors ${
                                day.taskCount > 0 ? 'cursor-pointer' : ''
                              } ${isExpanded ? 'bg-blue-50/20' : ''}`}
                            >
                              <td className="py-3 px-3 text-center text-slate-400">
                                {day.taskCount > 0 ? (
                                  <button
                                    onClick={e => {
                                      e.stopPropagation();
                                      toggleDateExpansion(day.date);
                                    }}
                                    className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors cursor-pointer"
                                    aria-label="Toggle task breakdown"
                                  >
                                    {isExpanded ? (
                                      <ChevronUp className="w-3.5 h-3.5" />
                                    ) : (
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                              <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <span>{formatDateWithDay(day.date)}</span>
                                  {!day.isWorkingDay && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                                      Non-Working / OT
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-bold text-blue-600">
                                {day.hours}h
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-slate-500">
                                {day.isWorkingDay ? `${target}h` : '0h (Weekend)'}
                              </td>
                              <td className="py-3 px-4 text-right font-mono">
                                <span className={diff >= 0 && day.hours > 0 ? 'text-emerald-700 font-semibold' : diff < 0 ? 'text-rose-600 font-medium' : 'text-slate-500'}>
                                  {diff > 0 ? `+${diff}h` : `${diff}h`}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                {day.taskCount === 0 ? (
                                  <span className="text-slate-400 font-mono">0</span>
                                ) : (
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono inline-flex items-center gap-1 ${
                                      hasMultipleTasks
                                        ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                                    }`}
                                  >
                                    {hasMultipleTasks && <span>⚡</span>}
                                    {day.taskCount} {day.taskCount === 1 ? 'task' : 'tasks'}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                {day.tasks.length === 0 ? (
                                  <span className="text-slate-400 text-xs">No tasks logged</span>
                                ) : (
                                  <div className="space-y-1.5">
                                    {/* Task pills with duration & % */}
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {day.tasks.map((tsk, idx) => {
                                        const color = taskColors[idx % taskColors.length];
                                        return (
                                          <span
                                            key={tsk.taskId}
                                            className={`px-2 py-0.5 rounded-md text-[10px] font-medium border flex items-center gap-1 ${color.pill}`}
                                            title={`${tsk.taskId} - ${tsk.taskName}: ${tsk.hours}h (${tsk.percentageOfDay}%)`}
                                          >
                                            <span className="font-bold">{tsk.taskId}</span>
                                            <span>•</span>
                                            <span className="font-mono font-semibold">{tsk.hours}h</span>
                                            <span className="text-[9px] opacity-75">({tsk.percentageOfDay}%)</span>
                                          </span>
                                        );
                                      })}
                                    </div>

                                    {/* Segmented allocation bar for multi-task days */}
                                    {hasMultipleTasks && (
                                      <div className="w-full bg-slate-100 rounded-full h-1.5 flex overflow-hidden border border-slate-200/50">
                                        {day.tasks.map((tsk, idx) => {
                                          const color = taskColors[idx % taskColors.length];
                                          return (
                                            <div
                                              key={tsk.taskId}
                                              style={{ width: `${tsk.percentageOfDay}%` }}
                                              className={`${color.bg} h-full transition-all`}
                                              title={`${tsk.taskId}: ${tsk.hours}h (${tsk.percentageOfDay}%)`}
                                            />
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>

                            {/* Detailed Accordion for Multi-Task Breakdown */}
                            {isExpanded && day.tasks.length > 0 && (
                              <tr className="bg-slate-50/70 border-b border-slate-200/80">
                                <td colSpan={7} className="p-4">
                                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
                                    <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100">
                                      <div className="flex items-center gap-2">
                                        <Layers className="w-4 h-4 text-blue-600" />
                                        <span className="font-bold text-slate-800">
                                          Detailed Task Execution Breakdown for {formatDateWithDay(day.date)}
                                        </span>
                                      </div>
                                      <span className="text-[11px] text-slate-500 font-mono">
                                        {day.hours}h logged across {day.taskCount} {day.taskCount === 1 ? 'task' : 'tasks'} ({day.sessionCount} session{day.sessionCount > 1 ? 's' : ''})
                                      </span>
                                    </div>

                                    {/* Task breakdown list */}
                                    <div className="grid grid-cols-1 gap-2">
                                      {day.tasks.map((tsk, idx) => {
                                        const color = taskColors[idx % taskColors.length];
                                        return (
                                          <div
                                            key={tsk.taskId}
                                            className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-slate-50/80 border border-slate-200/60 hover:bg-slate-100/60 transition-colors gap-2 text-xs"
                                          >
                                            <div className="flex items-start gap-2.5">
                                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase mt-0.5 ${color.pill}`}>
                                                {tsk.taskId}
                                              </span>
                                              <div>
                                                <span className="font-semibold text-slate-900 block">
                                                  {tsk.taskName}
                                                </span>
                                                <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                                                  <span className="px-1.5 py-0.2 rounded bg-slate-200/70 text-slate-700 text-[10px]">
                                                    {tsk.workType}
                                                  </span>
                                                  <span>•</span>
                                                  <span>{tsk.sessionCount} session{tsk.sessionCount > 1 ? 's' : ''}</span>
                                                  {tsk.notes.length > 0 && (
                                                    <>
                                                      <span>•</span>
                                                      <span className="italic text-slate-600 truncate max-w-[320px]" title={tsk.notes.join(' | ')}>
                                                        "{tsk.notes[0]}"
                                                      </span>
                                                    </>
                                                  )}
                                                </div>
                                              </div>
                                            </div>

                                            <div className="flex items-center gap-3 self-end sm:self-center">
                                              <div className="text-right">
                                                <div className="font-mono font-bold text-slate-900">
                                                  {tsk.hours}h
                                                </div>
                                                <div className="text-[10px] text-slate-500 font-mono">
                                                  {tsk.percentageOfDay}% of daily total
                                                </div>
                                              </div>
                                              <div className="w-16 bg-slate-200 rounded-full h-2 overflow-hidden hidden sm:block">
                                                <div
                                                  style={{ width: `${tsk.percentageOfDay}%` }}
                                                  className={`h-full ${color.bg}`}
                                                />
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
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
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Employee Capacity & FTE Ledger • Dossier for <strong className="text-slate-800">{user.name}</strong>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-xs"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};
