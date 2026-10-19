import { format, formatDistanceToNow } from 'date-fns';

/**
 * Format duration in seconds to human-readable string
 * @param seconds - Duration in seconds
 * @param format - 'short' for "Xh Ym" or 'long' for "HH:MM:SS"
 */
export function formatDuration(seconds: number | null | undefined, formatType: 'short' | 'long' = 'short'): string {
  if (!seconds || seconds < 0) return '0m';
  
  if (formatType === 'long') {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return '0m';
  }
}

/**
 * Format time to consistent format
 */
export function formatTime(date: string | Date | null | undefined): string {
  if (!date) return 'N/A';
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'HH:mm:ss');
  } catch {
    return 'Invalid date';
  }
}

/**
 * Format time as HH:mm (e.g. 09:30, 00:00) for Activity Logs columns
 */
export function formatTimeHHMM(date: string | Date | null | undefined): string {
  if (!date) return '00:00';
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'HH:mm');
  } catch {
    return '00:00';
  }
}

/**
 * Format duration in seconds as HH:mm (e.g. 01:30 for 1h 30m)
 */
export function formatDurationHHMM(seconds: number | null | undefined): string {
  if (seconds == null || seconds < 0) return '00:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Format date to consistent format
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return 'N/A';
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'MMM dd, yyyy');
  } catch {
    return 'Invalid date';
  }
}

/**
 * Format date and time together
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return 'N/A';
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'MMM dd, yyyy HH:mm:ss');
  } catch {
    return 'Invalid date';
  }
}

/**
 * Calculate total hours worked from sessions
 */
export function calculateHoursWorked(sessions: Array<{ duration_seconds: number | null }>): number {
  const totalSeconds = sessions.reduce((sum, session) => {
    return sum + (session.duration_seconds || 0);
  }, 0);
  return totalSeconds / 3600; // Convert to hours
}

/**
 * Get attendance status based on hours worked
 */
export function getAttendanceStatus(hours: number): 'Full Day' | 'Half Day' | 'Partial' | 'Miss' {
  if (hours >= 8) return 'Full Day';
  if (hours >= 4) return 'Half Day';
  if (hours > 0) return 'Partial';
  return 'Miss';
}

/**
 * Check if user is idle based on last activity time
 */
export function isIdle(lastActivity: Date | null, idleThresholdMinutes: number = 5): boolean {
  if (!lastActivity) return false;
  const now = new Date();
  const diffMinutes = (now.getTime() - lastActivity.getTime()) / (1000 * 60);
  return diffMinutes >= idleThresholdMinutes;
}

/**
 * Get relative time string (e.g., "2 hours ago")
 */
export function getRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return 'N/A';
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return formatDistanceToNow(dateObj, { addSuffix: true });
  } catch {
    return 'Invalid date';
  }
}

/**
 * Calculate duration between two dates in seconds
 */
export function calculateDurationSeconds(start: string | Date, end: string | Date | null): number | null {
  if (!end) return null;
  try {
    const startDate = typeof start === 'string' ? new Date(start) : start;
    const endDate = typeof end === 'string' ? new Date(end) : end;
    return Math.floor((endDate.getTime() - startDate.getTime()) / 1000);
  } catch {
    return null;
  }
}

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayDateString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/**
 * Get start of day timestamp
 */
export function getStartOfDay(date: Date = new Date()): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

/**
 * Get end of day timestamp
 */
export function getEndOfDay(date: Date = new Date()): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}


