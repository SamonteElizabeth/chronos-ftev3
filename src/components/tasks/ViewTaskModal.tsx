import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Task } from '../../types';
import {
  X,
  Clock,
  Calendar,
  User,
  Building,
  Tag,
  AlertTriangle,
  CheckCircle2,
  Edit,
  Trash2,
  FileText,
  TrendingUp,
  History,
  Timer,
} from 'lucide-react';
import {
  formatHours,
  isTaskOverdue,
  getDaysOverdue,
  calculateAvailableWorkingHours,
} from '../../utils/calculations';
import { ConfirmModal } from '../common/ConfirmModal';

interface ViewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  onEdit: (task: Task) => void;
}

export const ViewTaskModal: React.FC<ViewTaskModalProps> = ({
  isOpen,
  onClose,
  task,
  onEdit,
}) => {
  const {
    users,
    departments,
    workingSchedules,
    holidays,
    timeSessions,
    deleteTask,
  } = useApp();

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  if (!isOpen || !task) return null;

  const assignedUser = users.find(u => u.id === task.assignedUserId);
  const createdByUser = users.find(u => u.id === task.createdBy);
  const department = departments.find(d => d.id === task.departmentId);
  const taskSessions = timeSessions.filter(s => s.taskId === task.id);
  const overdue = isTaskOverdue(task);
  const daysOverdue = getDaysOverdue(task);

  const assignedSchedule =
    workingSchedules.find(s => s.id === assignedUser?.workingScheduleId) ||
    workingSchedules[0] || {
      id: 'SCH-001',
      name: 'Standard 8.5-Hour (Mon-Fri)',
      hoursPerDay: 8.5,
      netWorkHoursPerDay: 8.5,
      workingDays: [1, 2, 3, 4, 5],
      startTime: '08:30',
      endTime: '17:00',
      breakHours: 0,
    };

  const scheduleCalc = calculateAvailableWorkingHours(
    task.startDate,
    task.endDate,
    assignedSchedule,
    holidays
  );

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  const formatTimeOnly = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: Task['status']) => {
    switch (status) {
      case 'Completed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'In Progress':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'On Hold':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Cancelled':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Not Started':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getPriorityBadge = (priority: Task['priority']) => {
    switch (priority) {
      case 'Critical':
        return 'bg-rose-100 text-rose-800 border-rose-200 font-semibold';
      case 'High':
        return 'bg-amber-100 text-amber-800 border-amber-200 font-medium';
      case 'Medium':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Low':
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full my-8 animate-in zoom-in-95 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-xs font-mono font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                {task.id}
              </span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${getStatusBadge(
                  task.status
                )}`}
              >
                {task.status}
              </span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full border ${getPriorityBadge(
                  task.priority
                )}`}
              >
                {task.priority} Priority
              </span>
              {overdue && (
                <span className="text-xs bg-rose-500 text-white px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Overdue ({daysOverdue}d)
                </span>
              )}
            </div>
            <h2 className="text-base font-bold text-slate-900 leading-snug">
              {task.taskName}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onEdit(task);
              }}
              className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl border border-slate-200 transition-colors cursor-pointer"
              title="Edit Task"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-slate-200 transition-colors cursor-pointer"
              title="Delete Task"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-slate-700">
          {/* Shift Hours vs Actual Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Shift Hours</span>
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Scheduled Shift
                </span>
              </div>
              <div className="text-xl font-bold text-slate-800 mt-1 font-mono">
                {task.shiftHours || task.plannedHours || 0}h
              </div>
              <div className="text-[11px] text-slate-500 mt-1 leading-tight">
                ({scheduleCalc.workingDaysCount} working {scheduleCalc.workingDaysCount === 1 ? 'day' : 'days'} × {assignedSchedule.hoursPerDay}h/day shift • {assignedSchedule.name})
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <span className="text-xs text-slate-500 font-medium">Actual Hours Logged</span>
              <div className="text-xl font-bold text-slate-900 mt-1 font-mono">
                {task.actualHours}h
              </div>
              <span className="text-xs text-slate-400">{taskSessions.length} time sessions</span>
            </div>

            <div
              className={`rounded-xl p-4 border ${
                task.variance > 0
                  ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                  : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
              }`}
            >
              <span className="text-xs font-medium opacity-80">Variance (Actual - Shift Hour)</span>
              <div className="text-xl font-bold mt-1 font-mono">
                {task.variance > 0 ? `+${task.variance}h` : `${task.variance}h`}
              </div>
              <span className="text-xs opacity-75">
                {task.variancePercent > 0
                  ? `+${task.variancePercent}% over shift`
                  : `${task.variancePercent}% under shift`}
              </span>
            </div>
          </div>

          {/* Timestamps & Audit Trail Card */}
          <div className="bg-blue-50/40 border border-blue-100 rounded-2xl p-4.5 space-y-3">
            <div className="flex items-center gap-2 text-blue-900 font-semibold text-xs uppercase tracking-wider">
              <History className="w-4 h-4 text-blue-600" />
              <span>Timestamps & Audit History</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="bg-white p-3 rounded-xl border border-blue-100/80 shadow-2xs">
                <span className="text-slate-400 text-[10px] uppercase font-semibold block mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-blue-500" /> Start Date
                </span>
                <span className="font-semibold text-slate-900 font-mono text-xs">{task.startDate}</span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-blue-100/80 shadow-2xs">
                <span className="text-slate-400 text-[10px] uppercase font-semibold block mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-blue-500" /> Due Date
                </span>
                {task.endDate ? (
                  <span className={`font-semibold font-mono text-xs ${overdue ? 'text-rose-600 font-bold' : 'text-slate-900'}`}>
                    {task.endDate}
                  </span>
                ) : (
                  <span className="text-slate-400 italic text-xs">No Due Date</span>
                )}
              </div>

              <div className="bg-white p-3 rounded-xl border border-blue-100/80 shadow-2xs">
                <span className="text-slate-400 text-[10px] uppercase font-semibold block mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" /> Created At (Timestamp)
                </span>
                <span className="font-semibold text-slate-800 text-[11px] font-mono block">
                  {formatDateTime(task.createdAt)}
                </span>
                {createdByUser && (
                  <span className="text-[10px] text-slate-400 mt-0.5 block truncate">
                    by {createdByUser.name}
                  </span>
                )}
              </div>

              <div className="bg-white p-3 rounded-xl border border-blue-100/80 shadow-2xs">
                <span className="text-slate-400 text-[10px] uppercase font-semibold block mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" /> Last Updated (Timestamp)
                </span>
                <span className="font-semibold text-slate-800 text-[11px] font-mono block">
                  {formatDateTime(task.updatedAt || task.createdAt)}
                </span>
              </div>
            </div>

            {task.completedAt && (
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-xs flex items-center justify-between">
                <span className="text-emerald-800 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Task Completed Timestamp:
                </span>
                <span className="font-mono font-bold text-emerald-900">
                  {formatDateTime(task.completedAt)}
                </span>
              </div>
            )}
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-400 block mb-1">Task Type</span>
              <span className="font-semibold text-slate-800">{task.taskType}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-1">Assigned Employee</span>
              <span className="font-semibold text-slate-800">{assignedUser?.name || 'Unassigned'}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-1">Department</span>
              <span className="font-semibold text-slate-800">{department?.name || 'N/A'}</span>
            </div>
          </div>

          {/* Description */}
          {task.description && (
            <div>
              <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" /> Description & Scope
              </h4>
              <p className="text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200/60 leading-relaxed text-xs">
                {task.description}
              </p>
            </div>
          )}

          {/* Remarks */}
          {task.remarks && (
            <div>
              <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-1.5">
                Remarks / Blockers
              </h4>
              <p className="text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200/60 text-xs">
                {task.remarks}
              </p>
            </div>
          )}

          {/* Time Sessions History & Detailed Timestamps */}
          <div>
            <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                Time Sessions & Timestamps ({taskSessions.length})
              </span>
              <span className="text-slate-500 font-normal">
                Total Actual: <strong className="text-slate-800 font-mono">{task.actualHours}h</strong>
              </span>
            </h4>

            {taskSessions.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs bg-slate-50/50">
                No time sessions recorded yet for this task.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Session ID</th>
                      <th className="py-2.5 px-3 font-semibold">Date</th>
                      <th className="py-2.5 px-3 font-semibold">Start Timestamp</th>
                      <th className="py-2.5 px-3 font-semibold">End Timestamp</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Duration</th>
                      <th className="py-2.5 px-3 font-semibold">Logged Timestamp</th>
                      <th className="py-2.5 px-3 font-semibold">Notes / Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {taskSessions.map(ses => {
                      const startTimeFormatted = formatTimeOnly(ses.startTime);
                      const endTimeFormatted = formatTimeOnly(ses.endTime);
                      const dateStr = ses.startTime.split('T')[0];

                      return (
                        <tr key={ses.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3 font-mono text-slate-500 font-semibold">{ses.id}</td>
                          <td className="py-2.5 px-3 text-slate-700 font-medium">{dateStr}</td>
                          <td className="py-2.5 px-3 text-slate-800 font-mono text-[11px]">
                            {startTimeFormatted}
                          </td>
                          <td className="py-2.5 px-3 text-slate-800 font-mono text-[11px]">
                            {endTimeFormatted}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900 font-mono text-right">
                            {ses.durationHours}h
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 font-mono text-[10px]">
                            {formatDateTime(ses.createdAt)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 max-w-[200px] truncate">
                            {ses.isManual && (
                              <span className="mr-1.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-medium">
                                Manual
                              </span>
                            )}
                            {ses.notes || ses.manualReason || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 rounded-b-2xl flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsDeleteModalOpen(true)}
            className="px-3.5 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete Task
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={() => {
          deleteTask(task.id);
          setIsDeleteModalOpen(false);
          onClose();
        }}
        title={`Delete Task "${task.taskName}"?`}
        message={`Are you sure you want to permanently delete task ${task.id}? All recorded time sessions will also be removed.`}
        confirmLabel="Delete Task"
        variant="danger"
      />
    </div>
  );
};
