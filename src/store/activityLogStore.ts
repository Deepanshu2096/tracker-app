import { supabase } from '@/integrations/supabase/client';
import { create } from 'zustand';
import type { ActivityLog } from '@/types/activityLog';

export interface ActivityLogState {
  logs: ActivityLog[];
  loading: boolean;
  error: string | null;
  total: number;
  
  // Search and filters
  searchQuery: string;
  actionFilter: string | null;
  
  // Pagination
  page: number;
  pageSize: number;
  
  // Actions
  fetchLogs: (userRole: string | null, orgId: string | null) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setActionFilter: (action: string | null) => void;
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

export const useActivityLogStore = create<ActivityLogState>((set, get) => ({
  logs: [],
  loading: false,
  error: null,
  total: 0,
  searchQuery: '',
  actionFilter: null,
  page: 1,
  pageSize: 20,

  fetchLogs: async (userRole: string | null, orgId: string | null) => {
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
      let query = (supabase as any)
        .from('activity_logs')
        .select(`
          *,
          profiles_actor:profiles!activity_logs_actor_id_fkey(full_name, email, role),
          profiles_target:profiles!activity_logs_target_user_id_fkey(full_name, email, role)
        `, { count: 'exact' });

      // Role-based filtering
      const isAdminOrManager = userRole === 'admin' || userRole === 'manager';
      if (!isAdminOrManager) {
        // Employees see only their own activity logs
        query = query.eq('actor_id', profileId);
      } else if (orgId) {
        // Admins/managers see all activity logs in their org
        const { data: orgProfiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('org_id', orgId);
        
        if (orgProfiles && orgProfiles.length > 0) {
          const orgProfileIds = orgProfiles.map(p => p.id);
          query = query.in('actor_id', orgProfileIds);
        } else {
          query = query.eq('actor_id', profileId);
        }
      } else {
        query = query.eq('actor_id', profileId);
      }

      // Search filter
      if (state.searchQuery) {
        query = query.or(`action.ilike.%${state.searchQuery}%,metadata.ilike.%${state.searchQuery}%`);
      }

      // Action filter
      if (state.actionFilter) {
        query = query.eq('action', state.actionFilter);
      }

      // Pagination
      const from = (state.page - 1) * state.pageSize;
      const to = from + state.pageSize - 1;

      query = query
        .order('created_at', { ascending: false })
        .range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      // Transform data to match interface
      const transformedData = (data || []).map((log: any) => ({
        ...log,
        profiles_actor: log.profiles_actor || null,
        profiles_target: log.profiles_target || null,
      }));

      set({
        logs: transformedData,
        total: count || 0,
        loading: false,
      });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to fetch activity logs',
        loading: false,
      });
    }
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query, page: 1 });
  },

  setActionFilter: (action) => {
    set({ actionFilter: action, page: 1 });
  },

  setPagination: (page, pageSize) => {
    set({ page, pageSize });
  },
}));

