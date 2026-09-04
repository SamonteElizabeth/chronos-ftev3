import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  PieChart,
  Calendar,
  Users,
  Building,
  Settings,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Info,
  Clock,
  Briefcase,
  CheckSquare,
  UserCheck,
  Eye,
} from 'lucide-react';
import {
  calculateAvailableWorkingHours,
  calculateFTE,
  getDateRangeForPeriod,
  getWorkloadStatus,
  isOverCapacity,
  isAtCapacity,
  isUnderCapacity,
} from '../../utils/calculations';
import { exportToExcel } from '../../utils/exportUtils';
import { EmployeeFteDetailsModal, EmployeeMetricItem } from './EmployeeFteDetailsModal';

export const FteCapacityPage: React.FC = () => {
  const {
    users,
    departments,
    tasks,
    timeSessions,
    workingSchedules,
    holidays,
    workloadThresholds,
    setWorkloadThresholds,
    currentUser,
  } = useApp();

  const isTaskUser = currentUser.role === 'TASK_USER';
  const isDeptManager = currentUser.role === 'DEPT_MANAGER';

  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom'>('month');
  const [selectedDay, setSelectedDay] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedWeekDate, setSelectedWeekDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedDept, setSelectedDept] = useState(
    isDeptManager ? currentUser.departmentId : ''
  );
  const [capacityFilter, setCapacityFilter] = useState<'ALL' | 'UNDER' | 'AT' | 'OVER'>('ALL');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedEmployeeForDetails, setSelectedEmployeeForDetails] = useState<EmployeeMetricItem | null>(null);

  // Local threshold edit state
  const [tempUnder, setTempUnder] = useState(workloadThresholds.underCapacity);
  const [tempOver, setTempOver] = useState(workloadThresholds.overCapacity);

  // Date range determination
  const dateRange = useMemo(() => {
    if (period === 'day') {
      const d = selectedDay || new Date().toISOString().split('T')[0];
      return { startDate: d, endDate: d };
    }
    if (period === 'week') {
      const targetDate = selectedWeekDate ? new Date(`${selectedWeekDate}T00:00:00`) : new Date();
      return getDateRangeForPeriod('week', targetDate);
    }
    if (period === 'custom' && customStart && customEnd) {
      return { startDate: customStart, endDate: customEnd };
    }
    return getDateRangeForPeriod(period === 'custom' ? 'month' : period);
  }, [period, selectedDay, selectedWeekDate, customStart, customEnd]);

  // Filtered active employees - strictly scoped by user role
  const activeEmployees = useMemo(() => {
    if (isTaskUser) {
      // Task User can ONLY see their own FTE and profile; CANNOT see other users
      return users.filter(u => u.id === currentUser.id);
    }
    if (isDeptManager) {
      // Department Manager can ONLY see employees in their assigned department
      return users.filter(u => u.departmentId === currentUser.departmentId && u.status === 'Active');
    }
    // Admin & General Manager can see all or filter by department
    return users.filter(u => {
      if (selectedDept && u.departmentId !== selectedDept) return false;
      return u.status === 'Active';
    });
  }, [users, selectedDept, currentUser, isTaskUser, isDeptManager]);

  // Compute FTE metrics per employee in current scope
  const employeeMetrics = useMemo(() => {
    return activeEmployees.map(user => {
      const schedule =
        workingSchedules.find(s => s.id === user.workingScheduleId) ||
        workingSchedules.find(s => s.isDefault) ||
        workingSchedules[0];

      const { availableHours, shiftHours, breakHours, workingDaysCount, holidayCount } =
        calculateAvailableWorkingHours(
          dateRange.startDate,
          dateRange.endDate,
          schedule,
          holidays
        );

      const shiftHoursPerDay = schedule?.hoursPerDay || 10;
      const breakHoursPerDay = schedule?.breakHours !== undefined ? schedule.breakHours : 1.5;

      // Tasks in date range or assigned to user
      const userTasks = tasks.filter(t => t.assignedUserId === user.id);
      const plannedHours = userTasks.reduce((sum, t) => sum + (t.shiftHours || t.plannedHours || 0), 0);

      // Time sessions within date range
      const userSessions = timeSessions.filter(
        s =>
          s.userId === user.id &&
          s.startTime.split('T')[0] >= dateRange.startDate &&
          s.startTime.split('T')[0] <= dateRange.endDate
      );

      const actualHours = Number(
        userSessions.reduce((sum, s) => sum + s.durationHours, 0).toFixed(1)
      );

      const fte = calculateFTE(actualHours, availableHours);
      const status = getWorkloadStatus(fte, workloadThresholds);
      const dept = departments.find(d => d.id === user.departmentId);

      return {
        user,
        schedule,
        departmentName: dept?.name || 'N/A',
        workingDaysCount,
        holidayCount,
        availableHours,
        shiftHours,
        shiftHoursPerDay,
        breakHours,
        breakHoursPerDay,
        plannedHours,
        actualHours,
        capacityVariance: Number((availableHours - actualHours).toFixed(1)),
        fte,
        status,
      };
    });
  }, [
    activeEmployees,
    workingSchedules,
    dateRange,
    holidays,
    tasks,
    timeSessions,
    workloadThresholds,
    departments,
  ]);

  // Aggregate totals
  const totalAvailable = employeeMetrics.reduce((sum, m) => sum + m.availableHours, 0);
  const totalShiftHours = employeeMetrics.reduce((sum, m) => sum + m.shiftHours, 0);
  const totalActual = employeeMetrics.reduce((sum, m) => sum + m.actualHours, 0);
  const totalPlanned = employeeMetrics.reduce((sum, m) => sum + m.plannedHours, 0);
  const aggregateFte = calculateFTE(totalActual, totalAvailable);

  const underCount = employeeMetrics.filter(m => isUnderCapacity(m.status)).length;
  const atCapacityCount = employeeMetrics.filter(m => isAtCapacity(m.status)).length;
  const overCount = employeeMetrics.filter(m => isOverCapacity(m.status)).length;

  // Filtered metrics for ledger table
  const displayedMetrics = useMemo(() => {
    if (capacityFilter === 'UNDER') {
      return employeeMetrics.filter(m => isUnderCapacity(m.status));
    }
    if (capacityFilter === 'AT') {
      return employeeMetrics.filter(m => isAtCapacity(m.status));
    }
    if (capacityFilter === 'OVER') {
      return employeeMetrics.filter(m => isOverCapacity(m.status));
    }
    return employeeMetrics;
  }, [employeeMetrics, capacityFilter]);

  // Personal task breakdown for Task User
  const myTaskBreakdown = useMemo(() => {
    if (!isTaskUser) return [];
    const myTasks = tasks.filter(t => t.assignedUserId === currentUser.id);

    return myTasks.map(task => {
      const taskSessions = timeSessions.filter(
        s =>
          s.taskId === task.id &&
          s.userId === currentUser.id &&
          s.startTime.split('T')[0] >= dateRange.startDate &&
          s.startTime.split('T')[0] <= dateRange.endDate
      );
      const periodHours = Number(
        taskSessions.reduce((sum, s) => sum + s.durationHours, 0).toFixed(1)
      );
      const shareOfTotal = totalActual > 0 ? Number(((periodHours / totalActual) * 100).toFixed(1)) : 0;

      return {
        task,
        periodHours,
        totalTaskActual: task.actualHours,
        plannedHours: task.shiftHours || task.plannedHours || 0,
        shareOfTotal,
      };
    }).filter(item => item.periodHours > 0 || (item.task.startDate && item.task.startDate <= dateRange.endDate && item.task.endDate && item.task.endDate >= dateRange.startDate));
  }, [isTaskUser, tasks, timeSessions, currentUser.id, dateRange, totalActual]);

  const handleSaveThresholds = (e: React.FormEvent) => {
    e.preventDefault();
    setWorkloadThresholds({
      underCapacity: Number(tempUnder),
      overCapacity: Number(tempOver),
    });
    setShowConfigModal(false);
  };

  // Export handlers
  const handleExportExcel = () => {
    const reportTitle = isTaskUser
      ? 'My Personal FTE Capacity & Utilization Report'
      : 'FTE Capacity & Utilization Report';

    const exportData = employeeMetrics.map(m => ({
      'Employee ID': m.user.employeeId,
      'Name': m.user.name,
      'Job Title': m.user.title,
      'Department': m.departmentName,
      'Working Days': m.workingDaysCount,
      'Shift Hour (Total)': `${m.shiftHours}h (${m.shiftHoursPerDay}h/day)`,
      'Break Hours': `${m.breakHours}h (1.5h/day: 1h lunch 12:00-1:00 PM, 15m AM, 15m PM)`,
      'Available Net Capacity': `${m.availableHours}h (${m.schedule?.netWorkHoursPerDay || 8.5}h net/day)`,
      'Actual Tracked Hours': m.actualHours,
      'Variance (Available - Actual)': m.capacityVariance,
      'FTE (%)': `${m.fte}%`,
      'Workload Status': m.status,
    }));

    exportToExcel(
      {
        reportName: reportTitle,
        generatedDate: new Date().toLocaleString(),
        generatedBy: `${currentUser.name} (${currentUser.role})`,
        filtersApplied: {
          Period: period.toUpperCase(),
          DateRange: `${dateRange.startDate} to ${dateRange.endDate}`,
          Department: isTaskUser
            ? departments.find(d => d.id === currentUser.departmentId)?.name || 'Assigned'
            : departments.find(d => d.id === selectedDept)?.name || 'All',
        },
        summaryKpis: {
          'Target Subject': isTaskUser ? `${currentUser.name} (${currentUser.employeeId})` : `${employeeMetrics.length} Employees`,
          'Total Shift Hours': `${totalShiftHours}h (10h/day shift)`,
          'Total Available Capacity': `${totalAvailable}h (8.5h net/day)`,
          'Total Actual Logged': `${totalActual.toFixed(1)}h`,
          'FTE Utilization': `${aggregateFte}%`,
        },
      },
      exportData,
      isTaskUser ? 'My_FTE_Utilization_Report' : 'FTE_Utilization_Report'
    );
  };

  const userDepartment = departments.find(d => d.id === currentUser.departmentId);
  const primaryMetric = employeeMetrics[0];

  if (isTaskUser) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-md mx-auto my-12 shadow-xs">
        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-200">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900 mb-1">Access Restricted</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          FTE & Capacity Utilization analytics are only accessible to Managers and Administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            {isTaskUser ? 'My FTE & Capacity Utilization' : 'FTE & Capacity Utilization'}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg border border-slate-200 shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Export Excel
          </button>
          {currentUser.role === 'ADMIN' && (
            <button
              onClick={() => setShowConfigModal(true)}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Settings className="w-4 h-4" /> Configure Thresholds
            </button>
          )}
        </div>
      </div>

      {/* Filter and Period Controls Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Period Selection Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            {[
              { id: 'day', label: 'Day' },
              { id: 'week', label: 'Weekly' },
              { id: 'month', label: 'Monthly' },
              { id: 'quarter', label: 'Quarterly' },
              { id: 'year', label: 'Yearly' },
              { id: 'custom', label: 'Custom' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id as typeof period)}
                className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                  period === p.id
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Date Range Inputs */}
          {period === 'day' && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Select Day:</span>
              <input
                type="date"
                value={selectedDay}
                onChange={e => setSelectedDay(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs"
              />
            </div>
          )}

          {period === 'week' && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Week containing:</span>
              <input
                type="date"
                value={selectedWeekDate}
                onChange={e => setSelectedWeekDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs"
              />
            </div>
          )}

          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs"
              />
            </div>
          )}

          {/* Department Selector / Scope Badge */}
          {isTaskUser ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50/80 border border-blue-200 text-blue-900 text-xs font-medium">
              <Building className="w-3.5 h-3.5 text-blue-600" />
              <span>Dept: <strong className="font-semibold">{userDepartment?.name || 'Assigned Department'}</strong></span>
            </div>
          ) : isDeptManager ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 text-xs font-medium">
              <Building className="w-3.5 h-3.5 text-slate-600" />
              <span>Dept Scope: <strong className="font-semibold">{departments.find(d => d.id === currentUser.departmentId)?.name || 'Assigned'}</strong></span>
            </div>
          ) : (
            <select
              value={selectedDept}
              onChange={e => setSelectedDept(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs cursor-pointer"
            >
              <option value="">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="text-xs text-slate-500 font-medium flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 text-blue-600" />
          <span>Period:</span> <strong className="text-slate-800">{dateRange.startDate}</strong> to{' '}
          <strong className="text-slate-800">{dateRange.endDate}</strong>
        </div>
      </div>

      {/* KPI Summary Cards */}
      {isTaskUser ? (
        /* Task User Personal KPI Cards */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Work Days & Schedule */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs text-slate-500 font-medium">Working Days</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {primaryMetric?.workingDaysCount || 0}d
            </div>
            <span className="text-[10px] text-slate-400 truncate block" title={primaryMetric?.schedule?.name}>
              {primaryMetric?.schedule?.name || 'Standard 10h Shift'}
            </span>
          </div>

          {/* Shift Hour */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Shift Hour</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                {primaryMetric?.shiftHoursPerDay || 10}h/day
              </span>
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {primaryMetric?.shiftHours || 0}h
            </div>
            <span className="text-[10px] text-slate-400 block truncate" title="10h daily shift · 1.5h scheduled breaks (1h lunch 12:00-1:00 PM, 15m AM, 15m PM) → 8.5h net work">
              {primaryMetric?.workingDaysCount || 0}d × {primaryMetric?.shiftHoursPerDay || 10}h (1.5h break/day)
            </span>
          </div>

          {/* Available Working Hours */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs text-slate-500 font-medium">Available Capacity</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">{totalAvailable}h</div>
            <span className="text-[10px] text-slate-400">8.5h net productive/day</span>
          </div>

          {/* Actual Tracked Hours */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs text-slate-500 font-medium">Actual Logged Hours</span>
            <div className="text-2xl font-bold text-blue-600 mt-1">{totalActual.toFixed(1)}h</div>
            <span className="text-[10px] text-slate-400">Recorded time sessions</span>
          </div>

          {/* FTE Utilization */}
          <div className="bg-blue-600 text-white p-4 rounded-xl border border-blue-600 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-blue-100">My FTE Utilization</span>
            <div className="text-2xl font-bold mt-1 text-white">{aggregateFte}%</div>
            <span className="text-[10px] text-blue-200 font-medium">
              {primaryMetric?.status || 'Under Capacity'}
            </span>
          </div>
        </div>
      ) : (
        /* Team / Department / Admin KPI Summary Cards */
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs text-slate-500 font-medium">Active Headcount</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">{employeeMetrics.length}</div>
            <span className="text-[10px] text-slate-400">In current scope</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs text-slate-500 font-medium">Shift Hour</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">{totalShiftHours}h</div>
            <span className="text-[10px] text-slate-400">10h/day shift schedule</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs text-slate-500 font-medium">Total Available Hours</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">{totalAvailable}h</div>
            <span className="text-[10px] text-slate-400">8h/day net standard</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs text-slate-500 font-medium">Actual Tracked Hours</span>
            <div className="text-2xl font-bold text-blue-600 mt-1">{totalActual.toFixed(1)}h</div>
            <span className="text-[10px] text-slate-400">Logged effort</span>
          </div>

          <div className="bg-blue-600 text-white p-4 rounded-xl border border-blue-600 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-blue-100">Aggregate FTE %</span>
            <div className="text-2xl font-bold mt-1 text-white">{aggregateFte}%</div>
            <span className="text-[10px] text-blue-200">Overall utilization</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Capacity Status</span>
              {capacityFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setCapacityFilter('ALL')}
                  className="text-[10px] text-blue-600 hover:underline font-semibold cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-1 text-center text-[11px] mt-1">
              <button
                type="button"
                onClick={() => setCapacityFilter(capacityFilter === 'UNDER' ? 'ALL' : 'UNDER')}
                className={`p-1 rounded-lg border transition-all cursor-pointer ${
                  capacityFilter === 'UNDER'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs font-bold'
                    : 'bg-blue-50 text-blue-800 border-blue-200/70 hover:bg-blue-100'
                }`}
                title="Under Capacity (< 100% FTE)"
              >
                <span className="font-bold block text-xs">{underCount}</span>
                <span className="text-[9px] block leading-tight">&lt; 100%</span>
              </button>
              <button
                type="button"
                onClick={() => setCapacityFilter(capacityFilter === 'AT' ? 'ALL' : 'AT')}
                className={`p-1 rounded-lg border transition-all cursor-pointer ${
                  capacityFilter === 'AT'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs font-bold'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200/70 hover:bg-emerald-100'
                }`}
                title="At Capacity (= 100% FTE)"
              >
                <span className="font-bold block text-xs">{atCapacityCount}</span>
                <span className="text-[9px] block leading-tight">= 100%</span>
              </button>
              <button
                type="button"
                onClick={() => setCapacityFilter(capacityFilter === 'OVER' ? 'ALL' : 'OVER')}
                className={`p-1 rounded-lg border transition-all cursor-pointer ${
                  capacityFilter === 'OVER'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs font-bold'
                    : 'bg-rose-50 text-rose-800 border-rose-200/70 hover:bg-rose-100'
                }`}
                title="Over Capacity (> 100% FTE)"
              >
                <span className="font-bold block text-xs">{overCount}</span>
                <span className="text-[9px] block leading-tight">&gt; 100%</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detailed FTE Calculation Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {isTaskUser
                ? 'My Capacity & FTE Utilization Ledger'
                : 'Employee Capacity & FTE Utilization Ledger'}
            </h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Capacity Status:</span>
              <span className="inline-flex items-center gap-1 text-blue-700 font-medium bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Under Capacity (&lt; 100%)
              </span>
              <span className="inline-flex items-center gap-1 text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> At Capacity (= 100%)
              </span>
              <span className="inline-flex items-center gap-1 text-rose-700 font-medium bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Over Capacity (&gt; 100%)
              </span>
            </div>
          </div>
          {capacityFilter !== 'ALL' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600">
                Showing: <strong>{capacityFilter === 'UNDER' ? 'Under Capacity (<100%)' : capacityFilter === 'AT' ? 'At Capacity (=100%)' : 'Over Capacity (>100%)'}</strong> ({displayedMetrics.length} staff)
              </span>
              <button
                type="button"
                onClick={() => setCapacityFilter('ALL')}
                className="text-xs text-blue-600 hover:text-blue-800 underline font-semibold cursor-pointer"
              >
                Reset
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-3 px-4 font-semibold">Employee</th>
                <th className="py-3 px-4 font-semibold">Department</th>
                <th className="py-3 px-4 font-semibold text-center">Work Days</th>
                <th className="py-3 px-4 font-semibold text-right">Shift Hour (h)</th>
                <th className="py-3 px-4 font-semibold text-right">Available Cap (h)</th>
                <th className="py-3 px-4 font-semibold text-right">Actual Tracked (h)</th>
                <th className="py-3 px-4 font-semibold text-right">Var (Avail - Act)</th>
                <th className="py-3 px-4 font-semibold text-right">FTE %</th>
                <th className="py-3 px-4 font-semibold">Capacity Status</th>
                <th className="py-3 px-4 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedMetrics.map(item => {
                return (
                  <tr key={item.user.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-900 block">
                        {item.user.name} {isTaskUser && <span className="text-blue-600 font-normal">(You)</span>}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {item.user.employeeId} • {item.user.title}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{item.departmentName}</td>
                    <td className="py-3 px-4 text-center font-mono text-slate-700">
                      {item.workingDaysCount}d
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700">
                      <span className="font-semibold">{item.shiftHours}h</span>
                      <span className="block text-[10px] text-slate-400 font-sans">
                        {item.shiftHoursPerDay}h/day
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700">
                      <span className="font-semibold">{item.availableHours}h</span>
                      <span className="block text-[10px] text-slate-400 font-sans">
                        {item.schedule?.netWorkHoursPerDay || 8.5}h net/day
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {item.actualHours}h
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      <span
                        className={
                          item.capacityVariance < 0
                            ? 'text-rose-600 font-bold'
                            : 'text-emerald-700 font-semibold'
                        }
                      >
                        {item.capacityVariance > 0
                          ? `+${item.capacityVariance}h`
                          : `${item.capacityVariance}h`}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold">
                      <span
                        className={
                          item.fte > 100
                            ? 'text-rose-600 font-bold'
                            : item.fte === 100
                            ? 'text-emerald-700 font-bold'
                            : 'text-blue-600'
                        }
                      >
                        {item.fte}%
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold inline-flex items-center gap-1.5 ${
                          isOverCapacity(item.status)
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : isAtCapacity(item.status)
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isOverCapacity(item.status)
                              ? 'bg-rose-500'
                              : isAtCapacity(item.status)
                              ? 'bg-emerald-500'
                              : 'bg-blue-500'
                          }`}
                        />
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setSelectedEmployeeForDetails(item)}
                        title="View Details"
                        className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-800 border border-blue-200 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5 font-semibold text-xs shadow-2xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Details</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Task User: Contributed Tasks Breakdown Section */}
      {isTaskUser && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                My Logged Hours by Task in Selected Period
              </h3>
            </div>
            <div className="text-xs font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-lg border border-blue-200">
              {myTaskBreakdown.length} Tasks Active
            </div>
          </div>

          {myTaskBreakdown.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              <CheckSquare className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="font-semibold text-slate-700">No time recorded in this period</p>
              <p className="text-slate-400 mt-0.5">Switch periods or start logging time on your assigned tasks.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Task ID & Name</th>
                    <th className="py-3 px-4 font-semibold">Work Type</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Shift Hour (h)</th>
                    <th className="py-3 px-4 font-semibold text-right">Logged in Period (h)</th>
                    <th className="py-3 px-4 font-semibold text-right">Total Task Actual (h)</th>
                    <th className="py-3 px-4 font-semibold text-right">% of My Period Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myTaskBreakdown.map(item => (
                    <tr key={item.task.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-900 block">
                          {item.task.taskName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {item.task.id}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 border border-slate-200">
                          {item.task.workType || 'Standard Task'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            item.task.status === 'Completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.task.status === 'In Progress'
                              ? 'bg-blue-100 text-blue-800'
                              : item.task.status === 'On Hold'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {item.task.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        {item.plannedHours}h
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-blue-600">
                        {item.periodHours}h
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-800">
                        {item.totalTaskActual}h
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                        {item.shareOfTotal}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Threshold Configuration Modal (Only for Admin) */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 text-slate-800 animate-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Configure Capacity Thresholds
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Current benchmark standard: <span className="font-semibold text-blue-700">Under (&lt; 100%)</span>, <span className="font-semibold text-emerald-700">At Capacity (= 100%)</span>, <span className="font-semibold text-rose-700">Over (&gt; 100%)</span>.
            </p>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 mb-4 text-xs space-y-1">
              <div className="font-semibold text-slate-800">Standard Rule Definitions:</div>
              <div className="text-slate-600 flex justify-between">
                <span>Under Capacity:</span>
                <span className="font-mono font-semibold text-blue-700">&lt; 100% FTE</span>
              </div>
              <div className="text-slate-600 flex justify-between">
                <span>At Capacity:</span>
                <span className="font-mono font-semibold text-emerald-700">= 100% FTE</span>
              </div>
              <div className="text-slate-600 flex justify-between">
                <span>Over Capacity:</span>
                <span className="font-mono font-semibold text-rose-700">&gt; 100% FTE</span>
              </div>
            </div>

            <form onSubmit={handleSaveThresholds} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Under Capacity Cutoff (&lt; %)
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={tempUnder}
                  onChange={e => setTempUnder(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <span className="text-[10px] text-slate-400">
                  FTE values below this percentage will be flagged as "Under Capacity".
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Over Capacity Cutoff (&gt; %)
                </label>
                <input
                  type="number"
                  min="100"
                  max="250"
                  value={tempOver}
                  onChange={e => setTempOver(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <span className="text-[10px] text-slate-400">
                  FTE values above this percentage will be flagged as "Over Capacity".
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setTempUnder(100);
                    setTempOver(100);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium underline cursor-pointer"
                >
                  Reset to Standard (100%)
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowConfigModal(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium cursor-pointer"
                  >
                    Save Settings
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Employee Details Modal (Task Information & Logs) */}
      {selectedEmployeeForDetails && (
        <EmployeeFteDetailsModal
          isOpen={!!selectedEmployeeForDetails}
          onClose={() => setSelectedEmployeeForDetails(null)}
          employeeMetric={selectedEmployeeForDetails}
          tasks={tasks}
          timeSessions={timeSessions}
          dateRange={dateRange}
          periodLabel={period}
        />
      )}
    </div>
  );
};
