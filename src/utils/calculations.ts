import {
  Task,
  TimeSession,
  WorkingSchedule,
  Holiday,
  User,
  WorkloadThresholds,
} from '../types';

/**
 * Checks if a task is overdue:
 * Current Date > End Date AND Status is NOT Completed or Cancelled
 * If no End Date is set, task is not overdue.
 */
export function isTaskOverdue(task: Task, referenceDate: Date = new Date()): boolean {
  if (task.status === 'Completed' || task.status === 'Cancelled' || !task.endDate) {
    return false;
  }
  const end = new Date(task.endDate);
  // Set to end of the day in local time for fair comparison
  end.setHours(23, 59, 59, 999);
  return referenceDate.getTime() > end.getTime();
}

/**
 * Calculates days overdue for a task
 */
export function getDaysOverdue(task: Task, referenceDate: Date = new Date()): number {
  if (!isTaskOverdue(task, referenceDate) || !task.endDate) return 0;
  const end = new Date(task.endDate);
  end.setHours(0, 0, 0, 0);
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);
  const diffTime = ref.getTime() - end.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays);
}

/**
 * Sums all time session durations for a specific task
 */
export function calculateTaskActualHours(taskId: string, sessions: TimeSession[]): number {
  const taskSessions = sessions.filter(s => s.taskId === taskId);
  const totalHours = taskSessions.reduce((sum, s) => sum + s.durationHours, 0);
  return Number(totalHours.toFixed(2));
}

/**
 * Calculates variance and variance percentage
 */
export function calculateVariance(plannedHours: number, actualHours: number) {
  const variance = Number((actualHours - plannedHours).toFixed(2));
  let variancePercent = 0;
  if (plannedHours > 0) {
    variancePercent = Number((((actualHours - plannedHours) / plannedHours) * 100).toFixed(1));
  }
  return { variance, variancePercent };
}

/**
 * Formats decimal hours into a clean string (e.g. "1h 30m" or "4.5h")
 */
export function formatHours(hours: number): string {
  if (hours === 0 || isNaN(hours)) return '0h 00m';
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  if (minutes === 60) {
    return `${wholeHours + 1}h 00m`;
  }
  return `${wholeHours}h ${minutes.toString().padStart(2, '0')}m`;
}

/**
 * Formats total seconds into HH:MM:SS stopwatch string
 */
export function formatSecondsToTimer(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Calculates available working hours for a given date range, schedule, and holidays list.
 * Excludes non-working days (e.g., Saturday/Sunday) and official configured holidays.
 */
export function calculateAvailableWorkingHours(
  startDateStr?: string,
  endDateStr?: string,
  schedule?: WorkingSchedule,
  holidays: Holiday[] = []
): { availableHours: number; workingDaysCount: number; holidayCount: number } {
  const hoursPerDay = schedule?.hoursPerDay || 8;

  if (!startDateStr) {
    return { availableHours: hoursPerDay, workingDaysCount: 1, holidayCount: 0 };
  }

  // If no endDate provided, calculate for 1 working day on startDate
  const effectiveEnd = endDateStr || startDateStr;

  const start = new Date(startDateStr);
  const end = new Date(effectiveEnd);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { availableHours: hoursPerDay, workingDaysCount: 1, holidayCount: 0 };
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  if (start > end) {
    return { availableHours: 0, workingDaysCount: 0, holidayCount: 0 };
  }

  // Create holiday lookup set (YYYY-MM-DD)
  const holidayDates = new Set(holidays.map(h => h.date));
  const workingDays = schedule?.workingDays || [1, 2, 3, 4, 5];

  let workingDaysCount = 0;
  let holidayCount = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
    const dateKey = current.toISOString().split('T')[0];

    const isScheduledWorkingDay = workingDays.includes(dayOfWeek);

    if (isScheduledWorkingDay) {
      if (holidayDates.has(dateKey)) {
        holidayCount++;
      } else {
        workingDaysCount++;
      }
    }

    current.setDate(current.getDate() + 1);
  }

  const availableHours = Number((workingDaysCount * hoursPerDay).toFixed(2));

  return { availableHours, workingDaysCount, holidayCount };
}

/**
 * Calculates FTE Utilization %
 * Formula: (Actual Tracked Hours / Available Working Hours) * 100
 */
export function calculateFTE(actualHours: number, availableHours: number): number {
  if (availableHours <= 0) return 0;
  const fte = (actualHours / availableHours) * 100;
  return Number(fte.toFixed(2));
}

/**
 * Evaluates employee workload status against thresholds
 */
export function getWorkloadStatus(
  utilizationPercent: number,
  thresholds: WorkloadThresholds = { underCapacity: 80, overCapacity: 100 }
): 'UNDER CAPACITY' | 'NEAR CAPACITY' | 'OVER CAPACITY' {
  if (utilizationPercent < thresholds.underCapacity) {
    return 'UNDER CAPACITY';
  } else if (utilizationPercent <= thresholds.overCapacity) {
    return 'NEAR CAPACITY';
  } else {
    return 'OVER CAPACITY';
  }
}

/**
 * Calculates Completion Rate based on formula:
 * Completion Rate = Completed Tasks / Total Decided Tasks * 100
 * Where Total Decided Tasks = Completed Tasks + Cancelled Tasks
 */
export function calculateCompletionRate(completedTasks: number, cancelledTasks: number): number {
  const totalDecided = completedTasks + cancelledTasks;
  if (totalDecided === 0) return 0;
  return Number(((completedTasks / totalDecided) * 100).toFixed(1));
}

/**
 * Calculates date range boundaries for preset periods
 */
export function getDateRangeForPeriod(
  period: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom',
  referenceDate: Date = new Date(),
  customStart?: string,
  customEnd?: string
): { startDate: string; endDate: string } {
  const ref = new Date(referenceDate);

  if (period === 'day') {
    const dStr = ref.toISOString().split('T')[0];
    return { startDate: dStr, endDate: dStr };
  }

  if (period === 'week') {
    // Current week Monday to Sunday
    const day = ref.getDay();
    const diff = ref.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(ref.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      startDate: monday.toISOString().split('T')[0],
      endDate: sunday.toISOString().split('T')[0],
    };
  }

  if (period === 'month') {
    const year = ref.getFullYear();
    const month = ref.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    return {
      startDate: firstDay.toISOString().split('T')[0],
      endDate: lastDay.toISOString().split('T')[0],
    };
  }

  if (period === 'quarter') {
    const year = ref.getFullYear();
    const currentMonth = ref.getMonth();
    const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
    const firstDay = new Date(year, quarterStartMonth, 1);
    const lastDay = new Date(year, quarterStartMonth + 3, 0);
    return {
      startDate: firstDay.toISOString().split('T')[0],
      endDate: lastDay.toISOString().split('T')[0],
    };
  }

  if (period === 'year') {
    const year = ref.getFullYear();
    return {
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    };
  }

  return {
    startDate: customStart || ref.toISOString().split('T')[0],
    endDate: customEnd || ref.toISOString().split('T')[0],
  };
}
