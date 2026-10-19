import { supabase } from '@/integrations/supabase/client';
import { create } from 'zustand';
import { subDays, format } from 'date-fns';

export interface AttendanceRecord {
  id: string;
  user_id: string;
  check_in: string;
  check_out: string | null;
  duration_minutes: number | null;
  date: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string | null;
    email: string | null;
  };
}

interface AttendanceState {
  records: AttendanceRecord[];
  loading: boolean;
  error: string | null;
  total: number;
  
  // Date range
  dateFrom: Date;
  dateTo: Date;
  
  // Summary stats
  summary: {
    totalRecords: number;
    fullDays: number;
    halfDays: number;
    partialDays: number;
    missedDays: number;
  };
  
  // Pagination
  page: number;
  pageSize: number;
  
  // Actions
  fetchAttendance: (userRole: string | null, orgId: string | null, profileId?: string) => Promise<void>;
  setDateRange: (from: Date, to: Date) => void;
  calculateStats: () => void;
  setPagination: (page: number, pageSize: number) => void;
}

/**
 * Get profile ID from user ID
 */
async function getProfileId(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error || !data) {
      return null;
    }
    
    return data.id;
  } catch (error) {
    return null;
  }
}

export const useAttendanceStore = create<AttendanceState>((set, get) => ({
  records: [],
  loading: false,
  error: null,
  total: 0,
  dateFrom: subDays(new Date(), 30),
  dateTo: new Date(),
  summary: {
    totalRecords: 0,
    fullDays: 0,
    halfDays: 0,
    partialDays: 0,
    missedDays: 0,
  },
  page: 1,
  pageSize: 20,

  fetchAttendance: async (userRole: string | null, orgId: string | null, profileId?: string) => {
    set({ loading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const state = get();
      const dateFromStr = format(state.dateFrom, 'yyyy-MM-dd');
      const dateToStr = format(state.dateTo, 'yyyy-MM-dd');

      // MOCK DATA: Generate consistent mock attendance records
      const mockRecords: AttendanceRecord[] = [];
      const startDate = new Date(state.dateFrom);
      const endDate = new Date(state.dateTo);
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      // Predefined patterns for consistent data
      const checkInHours = [9, 8, 9, 8, 9, 8, 9, 8, 9, 8]; // Alternating pattern
      const checkInMinutes = [15, 30, 0, 45, 20, 10, 35, 25, 5, 40]; // Various minutes
      const workHoursPattern = [8.5, 8.0, 9.0, 8.5, 8.0, 8.5, 9.0, 8.0, 8.5, 8.0]; // Work hours pattern

      // Generate records for each day in the range
      for (let i = 0; i <= daysDiff && i < 30; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        const dateStr = format(currentDate, 'yyyy-MM-dd');

        // Skip weekends (Saturday = 6, Sunday = 0)
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          continue; // Skip weekends
        }

        // Skip every 10th weekday to simulate some absences
        if (i % 10 === 0) {
          continue; // Skip this day (absent)
        }

        // Use deterministic patterns based on day index
        const patternIndex = i % 10;
        const checkInHour = checkInHours[patternIndex];
        const checkInMinute = checkInMinutes[patternIndex];
        const workHours = workHoursPattern[patternIndex];

        const checkInTime = new Date(currentDate);
        checkInTime.setHours(checkInHour, checkInMinute, 0, 0);

        // Calculate check-out time based on work hours
        const checkOutTime = new Date(checkInTime);
        checkOutTime.setHours(checkInTime.getHours() + Math.floor(workHours), checkInTime.getMinutes() + Math.floor((workHours % 1) * 60), 0, 0);

        // Calculate duration in minutes
        const durationMinutes = Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60));

        mockRecords.push({
          id: `mock-attendance-${dateStr}-${i}`,
          user_id: user.id,
          check_in: checkInTime.toISOString(),
          check_out: checkOutTime.toISOString(),
          duration_minutes: durationMinutes,
          date: dateStr,
          created_at: checkInTime.toISOString(),
          updated_at: checkOutTime.toISOString(),
          profiles: (userRole === 'admin' || userRole === 'manager')
            ? { full_name: 'Employee', email: null }
            : { full_name: 'Current User', email: user.email || null },
        });
      }

      // Sort by date descending
      mockRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Apply pagination
      const from = (state.page - 1) * state.pageSize;
      const to = from + state.pageSize;
      const paginatedRecords = mockRecords.slice(from, to);

      set({
        records: paginatedRecords,
        total: mockRecords.length,
        loading: false,
      });

      // Calculate stats
      get().calculateStats();
    } catch (error: any) {
      set({
        error: error.message || 'Failed to fetch attendance',
        loading: false,
      });
    }
  },

  setDateRange: (from, to) => {
    set({ dateFrom: from, dateTo: to, page: 1 });
  },

  calculateStats: () => {
    const state = get();
    const records = state.records;

    const summary = {
      totalRecords: records.length,
      fullDays: 0,
      halfDays: 0,
      partialDays: 0,
      missedDays: 0,
    };

    records.forEach((record) => {
      const hours = (record.duration_minutes || 0) / 60;
      if (hours >= 8) {
        summary.fullDays++;
      } else if (hours >= 4) {
        summary.halfDays++;
      } else if (hours > 0) {
        summary.partialDays++;
      } else {
        summary.missedDays++;
      }
    });

    set({ summary });
  },

  setPagination: (page, pageSize) => {
    set({ page, pageSize });
  },
}));
