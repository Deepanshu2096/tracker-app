import { supabase } from '@/integrations/supabase/client';
import { create } from 'zustand';
import { useAuth } from '@/hooks/useAuth';

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
  profiles?: {
    full_name: string | null;
    email: string | null;
  };
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
  profiles?: {
    full_name: string | null;
    email: string | null;
  };
}

interface SessionHistoryState {
  // Sessions
  sessions: WorkSession[];
  sessionsLoading: boolean;
  sessionsError: string | null;
  sessionsTotal: number;
  
  // Breaks
  breaks: Break[];
  breaksLoading: boolean;
  breaksError: string | null;
  breaksTotal: number;
  
  // Filters
  sessionFilters: {
    status: 'all' | 'open' | 'closed';
    dateFrom: string | null;
    dateTo: string | null;
    userId: string | null;
  };
  breakFilters: {
    type: 'all' | 'lunch' | 'tea' | 'bio' | 'other';
    dateFrom: string | null;
    dateTo: string | null;
  };
  
  // Pagination
  sessionsPage: number;
  sessionsPageSize: number;
  breaksPage: number;
  breaksPageSize: number;
  
  // Actions
  fetchSessions: (userRole: string | null, orgId: string | null, profileId?: string) => Promise<void>;
  fetchBreaks: (userRole: string | null, orgId: string | null, profileId?: string) => Promise<void>;
  setSessionFilters: (filters: Partial<SessionHistoryState['sessionFilters']>) => void;
  setBreakFilters: (filters: Partial<SessionHistoryState['breakFilters']>) => void;
  setSessionsPagination: (page: number, pageSize: number) => void;
  setBreaksPagination: (page: number, pageSize: number) => void;
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

export const useSessionHistoryStore = create<SessionHistoryState>((set, get) => ({
  sessions: [],
  sessionsLoading: false,
  sessionsError: null,
  sessionsTotal: 0,
  breaks: [],
  breaksLoading: false,
  breaksError: null,
  breaksTotal: 0,
  sessionFilters: {
    status: 'all',
    dateFrom: null,
    dateTo: null,
    userId: null,
  },
  breakFilters: {
    type: 'all',
    dateFrom: null,
    dateTo: null,
  },
  sessionsPage: 1,
  sessionsPageSize: 10,
  breaksPage: 1,
  breaksPageSize: 10,

  fetchSessions: async (userRole: string | null, orgId: string | null, profileId?: string) => {
    set({ sessionsLoading: true, sessionsError: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const currentProfileId = profileId || await getProfileId(user.id);
      if (!currentProfileId) {
        throw new Error('Profile not found');
      }

      const state = get();
      let query = (supabase as any)
        .from('work_sessions')
        .select('*, profiles(full_name, email)', { count: 'exact' });

      // Role-based filtering
      const isAdminOrManager = userRole === 'admin' || userRole === 'manager';
      if (!isAdminOrManager) {
        // Employees see only their own sessions
        query = query.eq('user_id', currentProfileId);
      } else if (orgId) {
        // Admins/managers see all sessions in their org
        // Get all profile IDs in the org
        const { data: orgProfiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('org_id', orgId);
        
        if (orgProfiles && orgProfiles.length > 0) {
          const orgProfileIds = orgProfiles.map(p => p.id);
          query = query.in('user_id', orgProfileIds);
        } else {
          query = query.eq('user_id', currentProfileId); // Fallback
        }
      } else {
        query = query.eq('user_id', currentProfileId);
      }

      // Apply filters
      if (state.sessionFilters.status !== 'all') {
        query = query.eq('status', state.sessionFilters.status);
      }
      if (state.sessionFilters.dateFrom) {
        query = query.gte('started_at', state.sessionFilters.dateFrom);
      }
      if (state.sessionFilters.dateTo) {
        query = query.lte('started_at', state.sessionFilters.dateTo);
      }
      if (state.sessionFilters.userId) {
        query = query.eq('user_id', state.sessionFilters.userId);
      }

      // Pagination
      const from = (state.sessionsPage - 1) * state.sessionsPageSize;
      const to = from + state.sessionsPageSize - 1;

      query = query
        .order('started_at', { ascending: false })
        .range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      set({
        sessions: data || [],
        sessionsTotal: count || 0,
        sessionsLoading: false,
      });
    } catch (error: any) {
      set({
        sessionsError: error.message || 'Failed to fetch sessions',
        sessionsLoading: false,
      });
    }
  },

  fetchBreaks: async (userRole: string | null, orgId: string | null, profileId?: string) => {
    set({ breaksLoading: true, breaksError: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const currentProfileId = profileId || await getProfileId(user.id);
      if (!currentProfileId) {
        throw new Error('Profile not found');
      }

      const state = get();
      let query = (supabase as any)
        .from('breaks')
        .select('*, profiles(full_name, email)', { count: 'exact' });

      // Role-based filtering
      const isAdminOrManager = userRole === 'admin' || userRole === 'manager';
      if (!isAdminOrManager) {
        query = query.eq('user_id', currentProfileId);
      } else if (orgId) {
        const { data: orgProfiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('org_id', orgId);
        
        if (orgProfiles && orgProfiles.length > 0) {
          const orgProfileIds = orgProfiles.map(p => p.id);
          query = query.in('user_id', orgProfileIds);
        } else {
          query = query.eq('user_id', currentProfileId);
        }
      } else {
        query = query.eq('user_id', currentProfileId);
      }

      // Apply filters
      if (state.breakFilters.type !== 'all') {
        query = query.eq('type', state.breakFilters.type);
      }
      if (state.breakFilters.dateFrom) {
        query = query.gte('started_at', state.breakFilters.dateFrom);
      }
      if (state.breakFilters.dateTo) {
        query = query.lte('started_at', state.breakFilters.dateTo);
      }

      // Pagination
      const from = (state.breaksPage - 1) * state.breaksPageSize;
      const to = from + state.breaksPageSize - 1;

      query = query
        .order('started_at', { ascending: false })
        .range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      set({
        breaks: data || [],
        breaksTotal: count || 0,
        breaksLoading: false,
      });
    } catch (error: any) {
      set({
        breaksError: error.message || 'Failed to fetch breaks',
        breaksLoading: false,
      });
    }
  },

  setSessionFilters: (filters) => {
    set((state) => ({
      sessionFilters: { ...state.sessionFilters, ...filters },
      sessionsPage: 1, // Reset to first page when filters change
    }));
  },

  setBreakFilters: (filters) => {
    set((state) => ({
      breakFilters: { ...state.breakFilters, ...filters },
      breaksPage: 1,
    }));
  },

  setSessionsPagination: (page, pageSize) => {
    set({ sessionsPage: page, sessionsPageSize: pageSize });
  },

  setBreaksPagination: (page, pageSize) => {
    set({ breaksPage: page, breaksPageSize: pageSize });
  },
}));

