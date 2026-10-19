import { supabase } from '@/integrations/supabase/client';
import { create } from 'zustand';
import { format } from 'date-fns';

export interface AttendanceStatus {
  id: string | null;
  user_id: string;
  check_in: string | null;
  check_out: string | null;
  date: string;
  status: 'not_checked_in' | 'checked_in' | 'checked_out' | 'on_break';
  duration_minutes: number | null;
}

interface CheckInOutState {
  currentStatus: AttendanceStatus | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  checkIn: () => Promise<void>;
  checkOut: () => Promise<void>;
  getCurrentStatus: () => Promise<void>;
  clearError: () => void;
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

export const useCheckInOutStore = create<CheckInOutState>((set, get) => ({
  currentStatus: null,
  loading: false,
  error: null,

  checkIn: async () => {
    set({ loading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const today = format(new Date(), 'yyyy-MM-dd');
      const now = new Date().toISOString();

      // MOCK DATA: Simulate check-in
      const state = get();
      if (state.currentStatus && state.currentStatus.check_in && !state.currentStatus.check_out) {
        throw new Error('You are already checked in today. Please check out first.');
      }

      // Update mock status
      set({
        currentStatus: {
          id: 'mock-' + Date.now(),
          user_id: user.id,
          check_in: now,
          check_out: null,
          date: today,
          status: 'checked_in',
          duration_minutes: null,
        },
        loading: false,
      });

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error: any) {
      set({
        error: error.message || 'Failed to check in',
        loading: false,
      });
      throw error;
    }
  },

  checkOut: async () => {
    set({ loading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const today = format(new Date(), 'yyyy-MM-dd');
      const now = new Date().toISOString();

      // MOCK DATA: Check if checked in
      const state = get();
      if (!state.currentStatus || !state.currentStatus.check_in) {
        throw new Error('You must check in before checking out.');
      }

      if (state.currentStatus.check_out) {
        throw new Error('You have already checked out today.');
      }

      // Calculate duration
      const checkInTime = new Date(state.currentStatus.check_in);
      const checkOutTime = new Date(now);
      const durationMinutes = Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60));

      // Update mock status
      set({
        currentStatus: {
          ...state.currentStatus,
          check_out: now,
          duration_minutes: durationMinutes,
          status: 'checked_out',
        },
        loading: false,
      });

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error: any) {
      set({
        error: error.message || 'Failed to check out',
        loading: false,
      });
      throw error;
    }
  },

  getCurrentStatus: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        set({ currentStatus: null });
        return;
      }

      const today = format(new Date(), 'yyyy-MM-dd');

      // MOCK DATA: Return current status from state or default
      const state = get();
      if (state.currentStatus && state.currentStatus.date === today) {
        // Return existing status
        return;
      }

      // Default: not checked in
      set({
        currentStatus: {
          id: null,
          user_id: user.id,
          check_in: null,
          check_out: null,
          date: today,
          status: 'not_checked_in',
          duration_minutes: null,
        },
      });
    } catch (error: any) {
      console.error('Error fetching attendance status:', error);
      set({ error: error.message || 'Failed to fetch status' });
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));

