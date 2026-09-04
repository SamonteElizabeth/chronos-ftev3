import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Task, TimeSession } from '../../types';
import {
  ClockAlert,
  Search,
  Plus,
  Filter,
  Calendar,
  Layers,
  FileSpreadsheet,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Edit3,
  Trash2,
  ExternalLink,
  History,
  TrendingUp,
  Clock,
  Sparkles,
  Info,
  ChevronDown,
  TimerReset,
} from 'lucide-react';
import { TimeCorrectionModal } from './TimeCorrectionModal';
import { ConfirmModal } from '../common/ConfirmModal';
import { exportToExcel } from '../../utils/exportUtils';

interface TimeCorrectionPageProps {
  onViewTask?: (task: Task) => void;
}

type PeriodFilter = 'all' | 'today' | 'week' | 'month' | 'custom';

export const TimeCorrectionPage: React.FC<TimeCorrectionPageProps> = ({
  onViewTask,
}) => {
  const {
    tasks,
    users,
    departments,
    currentUser,
    timeSessions,
    deleteTimeSession,
    showToast,
  } = useApp();

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<TimeSession | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<{ id: string; duration: number } | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [filterScenario, setFilterScenario] = useState('all');
  const [filterEntryType, setFilterEntryType] = useState<'all' | 'Regular' | 'OT'>('all');
  const [filterUser, setFilterUser] = useState(
    currentUser.role === 'TASK_USER' ? currentUser.id : 'all'
  );
  const [viewScope, setViewScope] = useState<'corrections_only' | 'all_sessions'>('corrections_only');

  // Open modal for new record
  const handleOpenNew = (defaultScenario?: string) => {
    setEditingSession(null);
    setIsModalOpen(true);
  };

  // Open modal to edit existing record
  const handleOpenEdit = (session: TimeSession) => {
    setEditingSession(session);
    setIsModalOpen(true);
  };

  // Date range calculation
  const { startDateStr, endDateStr } = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (period === 'today') {
      return { startDateStr: todayStr, endDateStr: todayStr };
    }

    if (period === 'week') {
      const currentDay = today.getDay(); // 0=Sun, 1=Mon...
      const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
      const monday = new Date(today);
      monday.setDate(today.getDate() + mondayOffset);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return {
        startDateStr: monday.toISOString().split('T')[0],
        endDateStr: sunday.toISOString().split('T')[0],
      };
    }

    if (period === 'month') {
      const year = today.getFullYear();
      const month = today.getMonth();
      const firstDay = new Date(year, month, 1).toISOString().split('T')[0];
      const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0];
      return { startDateStr: firstDay, endDateStr: lastDay };
    }

    if (period === 'custom') {
      return {
        startDateStr: customStartDate || '1970-01-01',
        endDateStr: customEndDate || '2099-12-31',
      };
    }

    return { startDateStr: '1970-01-01', endDateStr: '2099-12-31' };
  }, [period, customStartDate, customEndDate]);

  // Accessible sessions based on role
  const accessibleSessions = useMemo(() => {
    if (currentUser.role === 'TASK_USER') {
      return timeSessions.filter(s => s.userId === currentUser.id);
    }
    if (currentUser.role === 'DEPT_MANAGER') {
      return timeSessions.filter(s => {
        const user = users.find(u => u.id === s.userId);
        return user?.departmentId === currentUser.departmentId;
      });
    }
    return timeSessions;
  }, [timeSessions, currentUser, users]);

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    return accessibleSessions.filter(session => {
      // Scope: Corrections only vs All sessions
      if (viewScope === 'corrections_only') {
        if (!session.isManual && !session.correctionType && !session.manualReason) {
          return false;
        }
      }

      // User filter (only applies if manager/admin)
      if (currentUser.role !== 'TASK_USER') {
        if (filterUser !== 'all' && session.userId !== filterUser) {
          return false;
        }
      }

      // Period filter
      const sessionDate = session.startTime.split('T')[0];
      if (period !== 'all') {
        if (sessionDate < startDateStr || sessionDate > endDateStr) {
          return false;
        }
      }

      // Entry Type filter (Regular vs OT)
      const sessionEntryType = session.timeEntryType || (session.isOvertime ? 'OT' : 'Regular');
      if (filterEntryType !== 'all') {
        if (sessionEntryType !== filterEntryType) return false;
      }

      // Scenario / Reason filter
      if (filterScenario !== 'all') {
        if (filterScenario === 'Live Timer') {
          if (session.isManual) return false;
        } else {
          if (session.correctionType !== filterScenario) return false;
        }
      }

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const task = tasks.find(t => t.id === session.taskId);
        const user = users.find(u => u.id === session.userId);
        const matchesTask =
          (task?.taskName && task.taskName.toLowerCase().includes(q)) ||
          session.taskId.toLowerCase().includes(q);
        const matchesUser = user?.name && user.name.toLowerCase().includes(q);
        const matchesReason = session.manualReason && session.manualReason.toLowerCase().includes(q);
        const matchesNotes = session.notes && session.notes.toLowerCase().includes(q);
        const matchesType = session.correctionType && session.correctionType.toLowerCase().includes(q);
        if (!matchesTask && !matchesUser && !matchesReason && !matchesNotes && !matchesType) {
          return false;
        }
      }

      return true;
    });
  }, [
    accessibleSessions,
    viewScope,
    filterUser,
    period,
    startDateStr,
    endDateStr,
    filterEntryType,
    filterScenario,
    search,
    tasks,
    users,
    currentUser,
  ]);

  // Statistics
  const stats = useMemo(() => {
    const totalCorrectedSessions = accessibleSessions.filter(s => s.isManual || s.correctionType || s.manualReason);
    const totalCorrectedHours = totalCorrectedSessions.reduce((sum, s) => sum + s.durationHours, 0);

    // Current filtered metrics
    const filteredHours = filteredSessions.reduce((sum, s) => sum + s.durationHours, 0);

    // Grouping by scenario
    const scenarioCounts: Record<string, number> = {};
    totalCorrectedSessions.forEach(s => {
      const type = s.correctionType || 'General Correction';
      scenarioCounts[type] = (scenarioCounts[type] || 0) + 1;
    });

    let topScenario = 'None';
    let topCount = 0;
    Object.entries(scenarioCounts).forEach(([sc, count]) => {
      if (count > topCount) {
        topCount = count;
        topScenario = sc;
      }
    });

    // FTE equivalent contribution (assuming 40h standard work week)
    const fteEquivalent = Number((filteredHours / 160).toFixed(2)); // monthly standard

    return {
      totalCorrectedHours: Number(totalCorrectedHours.toFixed(1)),
      totalCorrectedCount: totalCorrectedSessions.length,
      filteredHours: Number(filteredHours.toFixed(1)),
      filteredCount: filteredSessions.length,
      topScenario,
      fteEquivalent,
    };
  }, [accessibleSessions, filteredSessions]);

  // Export handlers
  const handleExportExcel = () => {
    const rows = filteredSessions.map(s => {
      const task = tasks.find(t => t.id === s.taskId);
      const user = users.find(u => u.id === s.userId);
      const dept = departments.find(d => d.id === user?.departmentId);
      const entryType = s.timeEntryType || (s.isOvertime ? 'OT' : 'Regular');

      return {
        'Session ID': s.id,
        'Entry Type': entryType,
        'Correction Scenario': s.isManual ? (s.correctionType || 'Time Correction') : 'Live Timer',
        'Employee': user?.name || s.userId,
        'Department': dept?.name || 'N/A',
        'Task ID': s.taskId,
        'Task Name': task?.taskName || 'N/A',
        'Date': s.startTime.split('T')[0],
        'Start Time': new Date(s.startTime).toLocaleTimeString(),
        'End Time': new Date(s.endTime).toLocaleTimeString(),
        'Duration (Hours)': s.durationHours,
        'Overtime': s.isOvertime || entryType === 'OT' ? 'Yes' : 'No',
        'Correction Reason': s.manualReason || 'N/A',
        'Notes': s.notes || '',
        'Created At': s.createdAt,
      };
    });

    exportToExcel(
      {
        reportName: 'Time Correction & Retroactive Time Logs',
        generatedDate: new Date().toLocaleDateString(),
        generatedBy: `${currentUser.name} (${currentUser.role})`,
        filtersApplied: {
          Period: period,
          Employee: filterUser,
          'Time Entry Type': filterEntryType,
          Scenario: filterScenario,
          Scope: viewScope,
        },
        summaryKpis: {
          'Total Filtered Hours': `${stats.filteredHours}h`,
          'Total Entries': stats.filteredCount,
          'FTE Impact': `+${stats.fteEquivalent} FTE`,
        },
      },
      rows,
      'Time_Corrections_Report'
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shrink-0">
            <ClockAlert className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Time Correction</h1>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2.5 shrink-0">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
            title="Export to Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel</span>
          </button>

          <button
            onClick={() => handleOpenNew()}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Corrected Hours */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Total Corrected Hours</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{stats.totalCorrectedHours}h</span>
            <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              {stats.filteredHours}h in view
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">
            Included in task actuals and tracked hours
          </p>
        </div>

        {/* Correction Entries Count */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Correction Entries</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <History className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{stats.totalCorrectedCount}</span>
            <span className="text-xs font-medium text-slate-500">
              ({stats.filteredCount} entries filtered)
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">
            Full compliance & audit logs preserved
          </p>
        </div>

        {/* Primary Scenario */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Primary Reason Scenario</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
              <TimerReset className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 truncate">
            <span className="text-base font-bold text-slate-800 truncate" title={stats.topScenario}>
              {stats.topScenario}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">
            Most frequent manual adjustment reason
          </p>
        </div>
      </div>

      {/* Filter & Control Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by task name, ID, employee, reason, or notes..."
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 text-slate-800"
            />
          </div>

          {/* Scope Toggle: Corrections Only vs All Sessions */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setViewScope('corrections_only')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewScope === 'corrections_only'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Time Corrections Only
            </button>
            <button
              onClick={() => setViewScope('all_sessions')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewScope === 'all_sessions'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              All Time Logs
            </button>
          </div>
        </div>

        {/* Second Row: Period, Employee, and Scenario Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          {/* Period Filter Buttons */}
          <div className="flex items-center flex-wrap gap-1.5">
            <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" /> Period:
            </span>
            {(['all', 'today', 'week', 'month', 'custom'] as PeriodFilter[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer capitalize ${
                  period === p
                    ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                }`}
              >
                {p === 'all' ? 'All Time' : p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : p}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers */}
          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-white text-slate-800"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-white text-slate-800"
              />
            </div>
          )}

          {/* Selectors: Employee & Reason Scenario */}
          <div className="flex items-center flex-wrap gap-2.5 ml-auto">
            {/* Employee Filter */}
            {currentUser.role !== 'TASK_USER' && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-slate-500">Employee:</span>
                <select
                  value={filterUser}
                  onChange={e => setFilterUser(e.target.value)}
                  className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Employees</option>
                  {users
                    .filter(u => u.status === 'Active')
                    .map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* Time Entry Type Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-slate-500">Entry Type:</span>
              <select
                value={filterEntryType}
                onChange={e => setFilterEntryType(e.target.value as 'all' | 'Regular' | 'OT')}
                className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="all">All Types</option>
                <option value="Regular">Regular</option>
                <option value="OT">OT (Overtime)</option>
              </select>
            </div>

            {/* Scenario Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-slate-500">Reason:</span>
              <select
                value={filterScenario}
                onChange={e => setFilterScenario(e.target.value)}
                className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Scenarios</option>
                <option value="Forgot to Start Timer">Forgot to Start Timer</option>
                <option value="Forgot to Stop Timer">Forgot to Stop Timer</option>
                <option value="Incorrect Live Timer">Incorrect Live Timer</option>
                <option value="Offline / Interrupted Work">Offline / Interrupted</option>
                <option value="Meeting / Call Outside Timer">Meeting / Call</option>
                <option value="Ad-hoc Urgent Assistance">Ad-hoc Assistance</option>
                <option value="General Correction">General Correction</option>
                {viewScope === 'all_sessions' && <option value="Live Timer">Live Timer Sessions</option>}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Time Corrections Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">Recorded Time Entries</h3>
            <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full">
              {filteredSessions.length} {filteredSessions.length === 1 ? 'record' : 'records'}
            </span>
          </div>
          <span className="text-xs text-slate-400">
            Total Hours in View: <strong className="text-slate-800">{stats.filteredHours}h</strong>
          </span>
        </div>

        {filteredSessions.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3 border border-amber-100">
              <ClockAlert className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">No time correction entries found</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              No retroactive entries match your current search and period filters. Use the button below to record missing or forgotten task hours.
            </p>
            <button
              onClick={() => handleOpenNew()}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Classification & ID</th>
                  <th className="px-5 py-3">Entry Type</th>
                  <th className="px-5 py-3">Employee</th>
                  <th className="px-5 py-3">Task Details</th>
                  <th className="px-5 py-3">Date & Time</th>
                  <th className="px-5 py-3 text-right">Logged Hours</th>
                  <th className="px-5 py-3">Correction Reason & Notes</th>
                  <th className="px-5 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSessions.map(session => {
                  const task = tasks.find(t => t.id === session.taskId);
                  const user = users.find(u => u.id === session.userId);
                  const dept = departments.find(d => d.id === user?.departmentId);
                  const isManual = session.isManual || session.correctionType;
                  const scenario = session.correctionType || (isManual ? 'Manual Adjustment' : 'Live Timer');
                  const entryType = session.timeEntryType || (session.isOvertime ? 'OT' : 'Regular');

                  return (
                    <tr key={session.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Classification & ID */}
                      <td className="px-5 py-3.5 align-top">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              scenario === 'Forgot to Start Timer'
                                ? 'bg-amber-100 text-amber-800 border-amber-200'
                                : scenario === 'Forgot to Stop Timer'
                                ? 'bg-rose-100 text-rose-800 border-rose-200'
                                : scenario === 'Incorrect Live Timer'
                                ? 'bg-purple-100 text-purple-800 border-purple-200'
                                : scenario === 'Offline / Interrupted Work'
                                ? 'bg-sky-100 text-sky-800 border-sky-200'
                                : isManual
                                ? 'bg-blue-100 text-blue-800 border-blue-200'
                                : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            }`}
                          >
                            {scenario}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {session.id}
                          </span>
                        </div>
                      </td>

                      {/* Entry Type (Regular or OT) */}
                      <td className="px-5 py-3.5 align-top">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                            entryType === 'OT'
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              entryType === 'OT' ? 'bg-amber-600' : 'bg-blue-600'
                            }`}
                          />
                          {entryType === 'OT' ? 'OT' : 'Regular'}
                        </span>
                      </td>

                      {/* Employee */}
                      <td className="px-5 py-3.5 align-top">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                            {user?.name
                              ? user.name
                                  .split(' ')
                                  .map(n => n[0])
                                  .join('')
                                  .substring(0, 2)
                              : 'U'}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 leading-tight">
                              {user?.name || session.userId}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {dept?.name || 'Department'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Task Details */}
                      <td className="px-5 py-3.5 align-top max-w-[200px]">
                        <div>
                          {task ? (
                            <button
                              type="button"
                              onClick={() => onViewTask && onViewTask(task)}
                              className="text-left font-semibold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 group truncate"
                            >
                              <span className="truncate">{task.taskName}</span>
                              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            </button>
                          ) : (
                            <p className="font-medium text-slate-700">{session.taskId}</p>
                          )}
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {session.taskId} {task?.priority && `• ${task.priority}`}
                          </p>
                        </div>
                      </td>

                      {/* Date & Time */}
                      <td className="px-5 py-3.5 align-top">
                        <div className="text-slate-800 font-medium">
                          {session.startTime.split('T')[0]}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(session.startTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          -{' '}
                          {new Date(session.endTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>

                      {/* Logged Hours */}
                      <td className="px-5 py-3.5 align-top text-right">
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200/80 font-mono font-bold text-slate-900 text-xs">
                          <span>+{session.durationHours.toFixed(2)}h</span>
                        </div>
                        {session.isOvertime && (
                          <div className="text-[10px] text-amber-700 font-bold mt-0.5">
                            OT Approved
                          </div>
                        )}
                      </td>

                      {/* Reason & Notes */}
                      <td className="px-5 py-3.5 align-top max-w-[260px]">
                        {session.manualReason && (
                          <div className="text-slate-800 text-xs font-medium leading-relaxed">
                            <span className="text-slate-500 font-semibold text-[11px]">Reason: </span>
                            {session.manualReason}
                          </div>
                        )}
                        {session.notes && (
                          <div className="text-slate-500 text-[11px] mt-0.5 italic">
                            "{session.notes}"
                          </div>
                        )}
                        {!session.manualReason && !session.notes && (
                          <span className="text-slate-400 italic">No notes provided</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 align-top text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(session)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit / Correct Entry"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() =>
                              setSessionToDelete({ id: session.id, duration: session.durationHours })
                            }
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Remove Entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Compliance & Synchronization Guidance Callout */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-start gap-3 text-slate-600">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-semibold text-slate-800">
            {currentUser.role === 'TASK_USER'
              ? 'Automated Synchronization with Task Calculations'
              : 'Automated Synchronization with FTE & Task Calculations'}
          </p>
          <p className="text-slate-500 leading-relaxed">
            {currentUser.role === 'TASK_USER'
              ? "Every time correction saved in this module immediately updates your target task's Actual Hours, recalculates Variance & Variance %, and updates your time logs. Full audit logs are automatically recorded for organizational transparency."
              : "Every time correction saved in this module immediately updates the target task's Actual Hours, recalculates Variance & Variance %, updates user time logs, and reflects in the employee's FTE / Utilization metrics. Full audit logs are automatically recorded for organizational transparency."}
          </p>
        </div>
      </div>

      {/* Time Correction Modal */}
      <TimeCorrectionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingSession(null);
        }}
        sessionToEdit={editingSession}
      />

      {/* Confirm Deletion Modal with Reason */}
      <ConfirmModal
        isOpen={Boolean(sessionToDelete)}
        onClose={() => setSessionToDelete(null)}
        onConfirm={reason => {
          if (sessionToDelete) {
            deleteTimeSession(sessionToDelete.id, reason);
            setSessionToDelete(null);
          }
        }}
        title="Remove Time Log Entry"
        message={`Are you sure you want to remove this time entry (${sessionToDelete?.duration}h)? ${
          currentUser.role === 'TASK_USER'
            ? "The task's actual hours will be automatically adjusted."
            : "The task's actual hours and FTE utilization will be automatically adjusted."
        }`}
        confirmText="Remove Entry"
        requireReason={true}
        variant="danger"
      />
    </div>
  );
};
