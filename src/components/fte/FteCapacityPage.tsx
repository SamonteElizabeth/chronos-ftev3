import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  PieChart,
  Calendar,
  Users,
  Building,
  Settings,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Info,
  Clock,
  Briefcase,
  CheckSquare,
  UserCheck,
} from 'lucide-react';
import {
  calculateAvailableWorkingHours,
  calculateFTE,
  getDateRangeForPeriod,
  getWorkloadStatus,
} from '../../utils/calculations';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';

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
  const [showConfigModal, setShowConfigModal] = useState(false);

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

      const { availableHours, workingDaysCount, holidayCount } =
        calculateAvailableWorkingHours(
          dateRange.startDate,
          dateRange.endDate,
          schedule,
          holidays
        );

      // Tasks in date range or assigned to user
      const userTasks = tasks.filter(t => t.assignedUserId === user.id);
      const plannedHours = userTasks.reduce((sum, t) => sum + t.plannedHours, 0);

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
  const totalActual = employeeMetrics.reduce((sum, m) => sum + m.actualHours, 0);
  const totalPlanned = employeeMetrics.reduce((sum, m) => sum + m.plannedHours, 0);
  const aggregateFte = calculateFTE(totalActual, totalAvailable);

  const underCount = employeeMetrics.filter(m => m.status === 'UNDER CAPACITY').length;
  const nearCount = employeeMetrics.filter(m => m.status === 'NEAR CAPACITY').length;
  const overCount = employeeMetrics.filter(m => m.status === 'OVER CAPACITY').length;

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
        plannedHours: task.plannedHours,
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
      'Available Hours': m.availableHours,
      'Planned Hours': m.plannedHours,
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
          'Total Available Capacity': `${totalAvailable}h`,
          'Total Actual Logged': `${totalActual.toFixed(1)}h`,
          'FTE Utilization': `${aggregateFte}%`,
        },
      },
      exportData,
      isTaskUser ? 'My_FTE_Utilization_Report' : 'FTE_Utilization_Report'
    );
  };

  const handleExportPDF = () => {
    const reportTitle = isTaskUser
      ? 'My Personal FTE Capacity & Utilization Report'
      : 'FTE Capacity & Utilization Report';

    const columns = [
      { header: 'Employee', dataKey: 'name' },
      { header: 'Dept', dataKey: 'dept' },
      { header: 'Avail (h)', dataKey: 'avail' },
      { header: 'Plan (h)', dataKey: 'plan' },
      { header: 'Actual (h)', dataKey: 'actual' },
      { header: 'FTE (%)', dataKey: 'fte' },
      { header: 'Status', dataKey: 'status' },
    ];

    const exportData = employeeMetrics.map(m => ({
      name: m.user.name,
      dept: m.departmentName,
      avail: m.availableHours,
      plan: m.plannedHours,
      actual: m.actualHours,
      fte: `${m.fte}%`,
      status: m.status,
    }));

    exportToPDF(
      {
        reportName: reportTitle,
        generatedDate: new Date().toLocaleString(),
        generatedBy: `${currentUser.name} (${currentUser.role})`,
        filtersApplied: {
          DateRange: `${dateRange.startDate} to ${dateRange.endDate}`,
          Department: isTaskUser
            ? departments.find(d => d.id === currentUser.departmentId)?.name || 'Assigned'
            : departments.find(d => d.id === selectedDept)?.name || 'All',
        },
        summaryKpis: {
          'Target Subject': isTaskUser ? `${currentUser.name} (${currentUser.employeeId})` : `${employeeMetrics.length} Employees`,
          'FTE Utilization': `${aggregateFte}%`,
          'Total Hours Logged': `${totalActual.toFixed(1)}h`,
        },
      },
      columns,
      exportData,
      isTaskUser ? 'My_FTE_Utilization_Report' : 'FTE_Utilization_Report'
    );
  };

  const userDepartment = departments.find(d => d.id === currentUser.departmentId);
  const primaryMetric = employeeMetrics[0];

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
          <button
            onClick={handleExportPDF}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg border border-slate-200 shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileText className="w-4 h-4 text-rose-600" /> Export PDF
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Work Days & Schedule */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs text-slate-500 font-medium">Working Days</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {primaryMetric?.workingDaysCount || 0}d
            </div>
            <span className="text-[10px] text-slate-400 truncate block" title={primaryMetric?.schedule?.name}>
              {primaryMetric?.schedule?.name || 'Standard 8h'}
            </span>
          </div>

          {/* Available Working Hours */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs text-slate-500 font-medium">Available Capacity</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">{totalAvailable}h</div>
            <span className="text-[10px] text-slate-400">Scheduled standard hours</span>
          </div>

          {/* Planned Hours */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs text-slate-500 font-medium">Planned Task Hours</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">{totalPlanned}h</div>
            <span className="text-[10px] text-slate-400">Allocated to my tasks</span>
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
              {primaryMetric?.status || 'UNDER CAPACITY'}
            </span>
          </div>

          {/* Capacity Variance */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs text-slate-500 font-medium">Capacity Variance</span>
            <div
              className={`text-2xl font-bold mt-1 ${
                (primaryMetric?.capacityVariance || 0) < 0
                  ? 'text-rose-600'
                  : 'text-emerald-600'
              }`}
            >
              {(primaryMetric?.capacityVariance || 0) > 0
                ? `+${primaryMetric?.capacityVariance}h`
                : `${primaryMetric?.capacityVariance || 0}h`}
            </div>
            <span className="text-[10px] text-slate-400">
              {(primaryMetric?.capacityVariance || 0) >= 0 ? 'Remaining capacity' : 'Over capacity'}
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
            <span className="text-xs text-slate-500 font-medium">Total Available Hours</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">{totalAvailable}h</div>
            <span className="text-[10px] text-slate-400">8h/day standard</span>
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

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs col-span-2 flex flex-col justify-between">
            <span className="text-xs text-slate-500 font-medium">Workload Distribution</span>
            <div className="grid grid-cols-3 gap-2 text-center text-xs mt-1">
              <div className="p-1.5 bg-blue-50 text-blue-800 rounded-lg">
                <span className="font-bold">{underCount}</span> Under
              </div>
              <div className="p-1.5 bg-emerald-50 text-emerald-800 rounded-lg">
                <span className="font-bold">{nearCount}</span> Near
              </div>
              <div className="p-1.5 bg-rose-50 text-rose-800 rounded-lg">
                <span className="font-bold">{overCount}</span> Over
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detailed FTE Calculation Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {isTaskUser
                ? 'My Capacity & FTE Utilization Ledger'
                : 'Employee Capacity & FTE Utilization Ledger'}
            </h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-3 px-4 font-semibold">Employee</th>
                <th className="py-3 px-4 font-semibold">Department</th>
                <th className="py-3 px-4 font-semibold text-center">Work Days</th>
                <th className="py-3 px-4 font-semibold text-right">Available Cap (h)</th>
                <th className="py-3 px-4 font-semibold text-right">Planned (h)</th>
                <th className="py-3 px-4 font-semibold text-right">Actual Tracked (h)</th>
                <th className="py-3 px-4 font-semibold text-right">Var (Avail - Act)</th>
                <th className="py-3 px-4 font-semibold text-right">FTE %</th>
                <th className="py-3 px-4 font-semibold">Capacity Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employeeMetrics.map(item => {
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
                      {item.availableHours}h
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">
                      {item.plannedHours}h
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
                          item.fte > workloadThresholds.overCapacity
                            ? 'text-rose-600'
                            : item.fte >= workloadThresholds.underCapacity
                            ? 'text-emerald-700'
                            : 'text-blue-600'
                        }
                      >
                        {item.fte}%
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                          item.status === 'OVER CAPACITY'
                            ? 'bg-rose-100 text-rose-800'
                            : item.status === 'NEAR CAPACITY'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {item.status}
                      </span>
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
                    <th className="py-3 px-4 font-semibold text-right">Planned (h)</th>
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
              Configure Workload Thresholds
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Set custom percentage cutoffs for Under, Near, and Over Capacity classifications.
            </p>

            <form onSubmit={handleSaveThresholds} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Under Capacity Cutoff (&lt; %)
                </label>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={tempUnder}
                  onChange={e => setTempUnder(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-400">
                  Employees below this percentage will be marked "UNDER CAPACITY".
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Over Capacity Cutoff (&gt; %)
                </label>
                <input
                  type="number"
                  min="50"
                  max="200"
                  value={tempOver}
                  onChange={e => setTempOver(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-400">
                  Employees above this percentage will be marked "OVER CAPACITY".
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
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
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
