import { supabase } from '@/integrations/supabase/client';
import { create } from 'zustand';
import { logActivity } from '@/lib/activityLogger';
import { calculateDurationSeconds, getStartOfDay, getEndOfDay } from '@/lib/timeUtils';
import { toast } from 'sonner';

export interface WorkSession {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  status: 'open' | 'closed';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Break {
  id: string;
  session_id: string | null;
  user_id: string;
  type: 'lunch' | 'tea' | 'bio' | 'other';
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  created_at: string;
  updated_at: string;
}

interface TimeTrackerState {
  // Current session
  currentSession: WorkSession | null;
  activeBreaks: Break[];
  
  // Today's stats
  todayStats: {
    totalSeconds: number;
    activeSeconds: number;
    idleSeconds: number;
    breakSeconds: number;
  };
  
  // Idle tracking (frontend only)
  lastActivityTime: Date | null;
  isIdle: boolean;
  
  // Loading and error states
  loading: boolean;
  error: string | null;
  
  // Actions
  checkIn: (notes?: string) => Promise<void>;
  checkOut: (notes?: string) => Promise<void>;
  startBreak: (type: 'lunch' | 'tea' | 'bio' | 'other', otherType?: string) => Promise<void>;
  endBreak: (breakId: string) => Promise<void>;
  updateIdleTime: () => void;
  refreshData: () => Promise<void>;
  getCurrentSession: () => Promise<void>;
  getTodayStats: () => Promise<void>;
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
      console.error('Error fetching profile:', error);
      return null;
    }
    
    return data.id;
  } catch (error) {
    console.error('Error in getProfileId:', error);
    return null;
  }
}

export const useTimeTrackerStore = create<TimeTrackerState>((set, get) => ({
  currentSession: null,
  activeBreaks: [],
  todayStats: {
    totalSeconds: 0,
    activeSeconds: 0,
    idleSeconds: 0,
    breakSeconds: 0,
  },
  lastActivityTime: new Date(),
  isIdle: false,
  loading: false,
  error: null,

  checkIn: async (notes?: string) => {
    set({ loading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const profileId = await getProfileId(user.id);
      if (!profileId) {
        throw new Error('Profile not found');
      }

      const state = get();

      // STRICT RULE 1a: Check if there's already an open session
      if (state.currentSession && state.currentSession.status === 'open') {
        throw new Error('You already have an active session. Please stop it before starting a new one.');
      }

      // STRICT RULE 1b: Check if user is currently on any break
      const hasActiveBreak = state.activeBreaks.some(b => !b.ended_at);
      if (hasActiveBreak) {
        throw new Error('You cannot start a session while on a break. Please end your break first.');
      }

      // Double-check with database to prevent race conditions
      const { data: existingSession } = await (supabase as any)
        .from('work_sessions')
        .select('*')
        .eq('user_id', profileId)
        .eq('status', 'open')
        .maybeSingle();

      if (existingSession) {
        throw new Error('You already have an active session');
      }

      // Check for active breaks in database
      const { data: dbActiveBreaks } = await (supabase as any)
        .from('breaks')
        .select('id')
        .eq('user_id', profileId)
        .is('ended_at', null);

      if (dbActiveBreaks && dbActiveBreaks.length > 0) {
        throw new Error('You cannot start a session while on a break. Please end your break first.');
      }

      // Create new session
      const { data: session, error } = await (supabase as any)
        .from('work_sessions')
        .insert({
          user_id: profileId,
          started_at: new Date().toISOString(),
          status: 'open',
          notes: notes || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Refresh the current session and breaks
      await get().getCurrentSession();

      set({
        currentSession: session,
        lastActivityTime: new Date(),
        isIdle: false,
        loading: false,
      });

      // Log activity (include started_at for Activity Logs columns)
      await logActivity('check_in', null, {
        session_id: session.id,
        start_time: session.started_at,
      });

      toast.success('Session started successfully');
    } catch (error: any) {
      set({ error: error.message || 'Failed to start session', loading: false });
      toast.error(error.message || 'Failed to start session');
    }
  },

  checkOut: async (notes?: string) => {
    set({ loading: true, error: null });
    try {
      const state = get();
      if (!state.currentSession) {
        throw new Error('No active session to stop');
      }

      if (state.currentSession.status !== 'open') {
        throw new Error('Session is already closed');
      }

      // STRICT RULE 2: Store session details before closing
      const endedAt = new Date();
      const duration = calculateDurationSeconds(state.currentSession.started_at, endedAt);

      const { data: session, error } = await (supabase as any)
        .from('work_sessions')
        .update({
          ended_at: endedAt.toISOString(),
          duration_seconds: duration,
          status: 'closed',
          notes: notes || state.currentSession.notes || null,
          updated_at: endedAt.toISOString(),
        })
        .eq('id', state.currentSession.id)
        .select()
        .single();

      if (error) throw error;

      set({
        currentSession: null,
        activeBreaks: [],
        loading: false,
      });

      // Log activity (include times and duration for Activity Logs columns)
      await logActivity('check_out', null, {
        session_id: session.id,
        start_time: state.currentSession.started_at,
        end_time: endedAt.toISOString(),
        duration_seconds: duration,
      });

      // Refresh today's stats
      await get().getTodayStats();

      toast.success('Session stopped successfully');
    } catch (error: any) {
      set({ error: error.message || 'Failed to stop session', loading: false });
      toast.error(error.message || 'Failed to stop session');
    }
  },

  startBreak: async (type: 'lunch' | 'tea' | 'bio' | 'other', otherType?: string) => {
    set({ loading: true, error: null });
    try {
      const state = get();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const profileId = await getProfileId(user.id);
      if (!profileId) {
        throw new Error('Profile not found');
      }

      // STRICT RULE 3a: Check if there's an active session
      if (state.currentSession && state.currentSession.status === 'open') {
        throw new Error('You cannot start a break while a session is active. Please stop your session first.');
      }

      // STRICT RULE 3b: Check if there's already an active break
      const hasActiveBreak = state.activeBreaks.some(b => !b.ended_at);
      if (hasActiveBreak) {
        throw new Error('You already have an active break. Please end it before starting a new one.');
      }

      // Double-check with database to prevent race conditions
      const { data: existingSession } = await (supabase as any)
        .from('work_sessions')
        .select('id')
        .eq('user_id', profileId)
        .eq('status', 'open')
        .maybeSingle();

      if (existingSession) {
        throw new Error('You cannot start a break while a session is active. Please stop your session first.');
      }

      const { data: dbActiveBreaks } = await (supabase as any)
        .from('breaks')
        .select('id')
        .eq('user_id', profileId)
        .is('ended_at', null);

      if (dbActiveBreaks && dbActiveBreaks.length > 0) {
        throw new Error('You already have an active break');
      }

      const metadata = type === 'other' && otherType ? { other_type: otherType } : {};

      // STRICT RULE 3: Breaks are standalone (no session_id)
      const { data: breakItem, error } = await (supabase as any)
        .from('breaks')
        .insert({
          session_id: null, // Breaks are independent of sessions
          user_id: profileId,
          type,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
        activeBreaks: [...state.activeBreaks, breakItem],
        loading: false,
      }));

      // Log activity (include start_time for Activity Logs columns)
      await logActivity('break_start', null, {
        break_id: breakItem.id,
        break_type: type,
        start_time: breakItem.started_at,
        ...metadata,
      });

      toast.success(`Break started: ${type}`);
    } catch (error: any) {
      set({ error: error.message || 'Failed to start break', loading: false });
      toast.error(error.message || 'Failed to start break');
    }
  },

  endBreak: async (breakId: string) => {
    set({ loading: true, error: null });
    try {
      const state = get();
      const breakItem = state.activeBreaks.find(b => b.id === breakId);
      if (!breakItem) {
        throw new Error('Break not found');
      }

      const endedAt = new Date();
      const duration = calculateDurationSeconds(breakItem.started_at, endedAt);

      const { data: updatedBreak, error } = await (supabase as any)
        .from('breaks')
        .update({
          ended_at: endedAt.toISOString(),
          duration_seconds: duration,
          updated_at: endedAt.toISOString(),
        })
        .eq('id', breakId)
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
        activeBreaks: state.activeBreaks.map(b => 
          b.id === breakId ? updatedBreak : b
        ),
        loading: false,
      }));

      // Log activity (include start/end/duration for Activity Logs columns)
      await logActivity('break_end', null, {
        break_id: updatedBreak.id,
        start_time: breakItem.started_at,
        end_time: endedAt.toISOString(),
        duration_seconds: duration,
      });

      toast.success('Break ended');
    } catch (error: any) {
      set({ error: error.message || 'Failed to end break', loading: false });
      toast.error(error.message || 'Failed to end break');
    }
  },

  updateIdleTime: () => {
    const now = new Date();
    set({ lastActivityTime: now, isIdle: false });
  },

  refreshData: async () => {
    await Promise.all([
      get().getCurrentSession(),
      get().getTodayStats(),
    ]);
  },

  getCurrentSession: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const profileId = await getProfileId(user.id);
      if (!profileId) return;

      // Get current open session
      const { data: session } = await (supabase as any)
        .from('work_sessions')
        .select('*')
        .eq('user_id', profileId)
        .eq('status', 'open')
        .maybeSingle();

      // STRICT RULE: Sessions and breaks are mutually exclusive
      // Get active breaks (only standalone breaks, no session_id)
      const { data: breaks } = await (supabase as any)
        .from('breaks')
        .select('*')
        .eq('user_id', profileId)
        .is('ended_at', null)
        .is('session_id', null) // Only get breaks without sessions
        .order('started_at', { ascending: false });

      // Validate: Should not have both session and break active
      if (session && breaks && breaks.length > 0) {
        console.warn('Invalid state: Both session and break are active. This should not happen.');
        // In production, you might want to handle this by ending one of them
      }

      set({
        currentSession: session || null,
        activeBreaks: breaks || [],
      });
    } catch (error: any) {
      console.error('Error fetching current session:', error);
    }
  },

  getTodayStats: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const profileId = await getProfileId(user.id);
      if (!profileId) return;

      const startOfDay = getStartOfDay();
      const endOfDay = getEndOfDay();

      // Get all sessions for today
      const { data: sessions } = await (supabase as any)
        .from('work_sessions')
        .select('duration_seconds')
        .eq('user_id', profileId)
        .gte('started_at', startOfDay.toISOString())
        .lte('started_at', endOfDay.toISOString());

      const totalSeconds = (sessions || []).reduce((sum, s) => sum + (s.duration_seconds || 0), 0);

      // Get break time for today
      const { data: breaks } = await (supabase as any)
        .from('breaks')
        .select('duration_seconds')
        .eq('user_id', profileId)
        .gte('started_at', startOfDay.toISOString())
        .lte('started_at', endOfDay.toISOString())
        .not('duration_seconds', 'is', null);

      const breakSeconds = (breaks || []).reduce((sum, b) => sum + (b.duration_seconds || 0), 0);

      set({
        todayStats: {
          totalSeconds,
          activeSeconds: totalSeconds - breakSeconds, // Approximate, idle tracking is frontend only
          idleSeconds: 0, // Frontend only
          breakSeconds,
        },
      });
    } catch (error: any) {
      console.error('Error fetching today stats:', error);
    }
  },
}));

