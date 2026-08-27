import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { TimeSession } from '../../types';
import {
  X,
  ClockAlert,
  AlertCircle,
  Calendar,
  Clock,
  FileText,
  CheckCircle2,
  Plus,
} from 'lucide-react';

interface TimeCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionToEdit?: TimeSession | null;
}

export const CORRECTION_REASONS = [
  'Forgot to Start Timer',
  'Forgot to Stop Timer',
  'Incorrect Live Timer',
  'Offline / Interrupted Work',
  'Meeting / Call Outside Tracker',
  'Ad-hoc Urgent Assistance',
  'System / Network Disruption',
  'General Correction',
];

export const TimeCorrectionModal: React.FC<TimeCorrectionModalProps> = ({
  isOpen,
  onClose,
  sessionToEdit,
}) => {
  const {
    tasks,
    users,
    currentUser,
    addManualTimeSession,
    updateTimeSession,
  } = useApp();

  const isEditMode = Boolean(sessionToEdit);

  // Form states matching user specs
  const [taskId, setTaskId] = useState('');
  const [timeEntryType, setTimeEntryType] = useState<'Regular' | 'OT'>('Regular');
  const [workDate, setWorkDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('11:00');
  const [correctionReason, setCorrectionReason] = useState('Forgot to Start Timer');
  const [notes, setNotes] = useState('');
  const [userId, setUserId] = useState(currentUser.id);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-calculated duration
  const calculation = useMemo(() => {
    if (!startTime || !endTime) {
      return { hours: 0, formatted: '0.00 hrs', valid: false, error: 'Start and End Time required' };
    }
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) {
      return { hours: 0, formatted: '0.00 hrs', valid: false, error: 'Invalid time format' };
    }

    const startMinutes = sh * 60 + sm;
    const endMinutes = eh * 60 + em;
    const diffMinutes = endMinutes - startMinutes;

    if (diffMinutes <= 0) {
      return {
        hours: 0,
        formatted: '0.00 hrs',
        valid: false,
        error: 'End Time must be later than Start Time',
      };
    }

    const hoursDecimal = Number((diffMinutes / 60).toFixed(2));
    const h = Math.floor(diffMinutes / 60);
    const m = diffMinutes % 60;
    const readable = m > 0 ? `${hoursDecimal} hrs (${h}h ${m}m)` : `${hoursDecimal} hrs (${h}h)`;

    return {
      hours: hoursDecimal,
      formatted: readable,
      valid: true,
      error: '',
    };
  }, [startTime, endTime]);

  // Initialize or reset form
  useEffect(() => {
    if (sessionToEdit) {
      setTaskId(sessionToEdit.taskId);
      setUserId(sessionToEdit.userId);
      setTimeEntryType(sessionToEdit.timeEntryType || (sessionToEdit.isOvertime ? 'OT' : 'Regular'));
      const sessionDate = sessionToEdit.startTime.split('T')[0] || new Date().toISOString().split('T')[0];
      setWorkDate(sessionDate);

      try {
        const sTime = new Date(sessionToEdit.startTime).toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
        });
        const eTime = new Date(sessionToEdit.endTime).toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
        });
        setStartTime(sTime || '09:00');
        setEndTime(eTime || '11:00');
      } catch {
        setStartTime('09:00');
        setEndTime('11:00');
      }

      setCorrectionReason(sessionToEdit.correctionType || sessionToEdit.manualReason || 'Forgot to Start Timer');
      setNotes(sessionToEdit.notes || '');
      setErrors({});
    } else {
      setTaskId(tasks.length > 0 ? tasks[0].id : '');
      setUserId(currentUser.id);
      setTimeEntryType('Regular');
      setWorkDate(new Date().toISOString().split('T')[0]);
      setStartTime('09:00');
      setEndTime('11:00');
      setCorrectionReason('Forgot to Start Timer');
      setNotes('');
      setErrors({});
    }
  }, [sessionToEdit, isOpen, currentUser, tasks]);

  if (!isOpen) return null;

  const selectedTask = tasks.find(t => t.id === taskId);

  // Projected hours calculation for target task
  const currentTaskActual = selectedTask ? selectedTask.actualHours : 0;
  const oldSessionHours = sessionToEdit && sessionToEdit.taskId === taskId ? sessionToEdit.durationHours : 0;
  const newHours = calculation.valid ? calculation.hours : 0;
  const projectedTaskActual = Number((currentTaskActual - oldSessionHours + newHours).toFixed(2));
  const projectedVariance = selectedTask ? Number((projectedTaskActual - selectedTask.plannedHours).toFixed(2)) : 0;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!taskId) {
      errs.taskId = 'Please select a Target Task.';
    }
    if (!workDate) {
      errs.workDate = 'Work Date is required.';
    }
    if (!startTime) {
      errs.startTime = 'Start Time is required.';
    }
    if (!endTime) {
      errs.endTime = 'End Time is required.';
    }
    if (!calculation.valid) {
      errs.endTime = calculation.error || 'End Time must be after Start Time.';
    }
    if (!correctionReason.trim()) {
      errs.correctionReason = 'Please select a Correction Reason.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const startISO = new Date(`${workDate}T${startTime}:00`).toISOString();
    const endISO = new Date(`${workDate}T${endTime}:00`).toISOString();
    const isOt = timeEntryType === 'OT';

    if (isEditMode && sessionToEdit) {
      const success = updateTimeSession(
        sessionToEdit.id,
        {
          taskId,
          userId,
          startTime: startISO,
          endTime: endISO,
          durationHours: calculation.hours,
          notes: notes.trim(),
          correctionType: correctionReason,
          timeEntryType,
          isOvertime: isOt,
        },
        correctionReason
      );
      if (success) onClose();
    } else {
      const success = addManualTimeSession({
        taskId,
        userId,
        startTime: startISO,
        endTime: endISO,
        durationHours: calculation.hours,
        notes: notes.trim(),
        reason: correctionReason,
        correctionType: correctionReason,
        timeEntryType,
        isOvertime: isOt,
      });
      if (success) onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full p-6 text-slate-800 animate-in zoom-in-95 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600">
              <ClockAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isEditMode ? 'Edit Time Correction' : 'Create Time Correction'}
              </h3>
              <p className="text-xs text-slate-500">
                Log missing or adjusted task hours with automatic duration calculation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. Target Task* (Dropdown) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Target Task <span className="text-rose-500">*</span>
            </label>
            <select
              value={taskId}
              onChange={e => {
                setTaskId(e.target.value);
                if (errors.taskId) setErrors(prev => ({ ...prev, taskId: '' }));
              }}
              className={`w-full px-3 py-2 text-xs rounded-xl border ${
                errors.taskId ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
              } focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-800`}
            >
              <option value="">Select target task...</option>
              {tasks.map(t => (
                <option key={t.id} value={t.id}>
                  {t.id}: {t.taskName} ({t.status})
                </option>
              ))}
            </select>
            {errors.taskId && (
              <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> {errors.taskId}
              </p>
            )}
          </div>

          {/* Time Entry Type (Regular or OT) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Time Entry Type <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTimeEntryType('Regular')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  timeEntryType === 'Regular'
                    ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-2xs'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                    timeEntryType === 'Regular'
                      ? 'border-blue-600 bg-blue-600'
                      : 'border-slate-300 bg-white'
                  }`}
                >
                  {timeEntryType === 'Regular' && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>
                <span>Regular Time</span>
              </button>

              <button
                type="button"
                onClick={() => setTimeEntryType('OT')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  timeEntryType === 'OT'
                    ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-2xs'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                    timeEntryType === 'OT'
                      ? 'border-amber-600 bg-amber-600'
                      : 'border-slate-300 bg-white'
                  }`}
                >
                  {timeEntryType === 'OT' && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>
                <span>Overtime (OT)</span>
              </button>
            </div>
          </div>

          {/* 2. Work Date* (Date) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Work Date <span className="text-rose-500">*</span></span>
            </label>
            <input
              type="date"
              value={workDate}
              onChange={e => {
                setWorkDate(e.target.value);
                if (errors.workDate) setErrors(prev => ({ ...prev, workDate: '' }));
              }}
              className={`w-full px-3 py-2 text-xs rounded-xl border ${
                errors.workDate ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
              } focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-800`}
            />
            {errors.workDate && (
              <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> {errors.workDate}
              </p>
            )}
          </div>

          {/* 3 & 4. Start Time* & End Time* (Time) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Start Time <span className="text-rose-500">*</span></span>
              </label>
              <input
                type="time"
                value={startTime}
                onChange={e => {
                  setStartTime(e.target.value);
                  if (errors.startTime) setErrors(prev => ({ ...prev, startTime: '' }));
                  if (errors.endTime) setErrors(prev => ({ ...prev, endTime: '' }));
                }}
                className={`w-full px-3 py-2 text-xs rounded-xl border ${
                  errors.startTime ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                } focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-800`}
              />
              {errors.startTime && (
                <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {errors.startTime}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>End Time <span className="text-rose-500">*</span></span>
              </label>
              <input
                type="time"
                value={endTime}
                onChange={e => {
                  setEndTime(e.target.value);
                  if (errors.endTime) setErrors(prev => ({ ...prev, endTime: '' }));
                }}
                className={`w-full px-3 py-2 text-xs rounded-xl border ${
                  errors.endTime ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                } focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-800`}
              />
              {errors.endTime && (
                <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {errors.endTime}
                </p>
              )}
            </div>
          </div>

          {/* 5. Duration (Auto-calculated) */}
          <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-slate-600 block">
                  Duration (Auto-calculated)
                </span>
                <span className="text-[10px] text-slate-400">
                  Calculated automatically from Start & End Time
                </span>
              </div>
              <div className="text-right">
                <span
                  className={`text-sm font-bold font-mono px-2.5 py-1 rounded-lg border inline-block ${
                    calculation.valid
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-rose-50 text-rose-600 border-rose-200 text-xs'
                  }`}
                >
                  {calculation.formatted}
                </span>
              </div>
            </div>

            {/* Live Task Impact Preview */}
            {selectedTask && calculation.valid && (
              <div className="mt-2.5 pt-2.5 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
                <span>
                  Planned: <strong>{selectedTask.plannedHours}h</strong> | Current Actual: <strong>{selectedTask.actualHours}h</strong>
                </span>
                <span>
                  Projected Actual:{' '}
                  <strong className="text-slate-900 font-bold">{projectedTaskActual}h</strong>{' '}
                  <span className={`font-semibold ${projectedVariance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    ({projectedVariance > 0 ? `+${projectedVariance}h` : `${projectedVariance}h`})
                  </span>
                </span>
              </div>
            )}
          </div>

          {/* 6. Correction Reason* (Dropdown) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Correction Reason <span className="text-rose-500">*</span>
            </label>
            <select
              value={correctionReason}
              onChange={e => {
                setCorrectionReason(e.target.value);
                if (errors.correctionReason) setErrors(prev => ({ ...prev, correctionReason: '' }));
              }}
              className={`w-full px-3 py-2 text-xs rounded-xl border ${
                errors.correctionReason ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
              } focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-800`}
            >
              <option value="">Select correction reason...</option>
              {CORRECTION_REASONS.map(r => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            {errors.correctionReason && (
              <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> {errors.correctionReason}
              </p>
            )}
          </div>

          {/* 7. Notes: Optional (Textarea) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>Notes</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">Optional</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add any additional notes or details (optional)..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-800 placeholder:text-slate-400"
            />
          </div>

          {/* Optional Employee Selector for Managers/Admins */}
          {currentUser.role !== 'TASK_USER' && (
            <div className="pt-1">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Logged For Employee
              </label>
              <select
                value={userId}
                onChange={e => setUserId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {users
                  .filter(u => u.status === 'Active')
                  .map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.employeeId}) - {u.role}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Footer Actions with single Create button */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {isEditMode ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Create</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
