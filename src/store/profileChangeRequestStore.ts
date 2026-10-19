import { supabase } from '@/integrations/supabase/client';
import { create } from 'zustand';
import {
  USE_MOCK_PROFILE_DATA,
  getMockPendingForHR,
  getMockMyRequests,
  getMockChangeRequest,
  updateMockChangeRequest,
  setMockProfileOverlay,
} from '@/lib/mockProfileData';

export type ChangeRequestStatus = 'pending_hr_approval' | 'approved' | 'rejected';

export interface RequestedProfileData {
  full_name?: string | null;
  birthday?: string | null;
  doj?: string | null;
  city?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  gender?: string | null;
  marital_status?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  state?: string | null;
  pincode?: string | null;
  personal_email?: string | null;
  employee_number?: string | null;
  department?: string | null;
  designation?: string | null;
  work_phone?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_ifsc?: string | null;
  bank_branch?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relation?: string | null;
  [key: string]: string | null | undefined;
}

export interface ProfileChangeRequest {
  id: string;
  profile_id: string;
  requested_by_user_id: string;
  status: ChangeRequestStatus;
  requested_data: RequestedProfileData;
  rejection_reason: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined from profiles
  employee_name?: string | null;
  employee_email?: string | null;
}

interface ProfileChangeRequestState {
  pendingRequests: ProfileChangeRequest[];
  myRequests: ProfileChangeRequest[];
  loading: boolean;
  error: string | null;
  fetchPendingForHR: (orgId: string) => Promise<void>;
  fetchPendingForTeamLead: (orgId: string, tlProfileId: string) => Promise<void>;
  fetchMyRequests: (userId: string) => Promise<void>;
  approveRequest: (requestId: string, orgId: string, tlProfileId?: string) => Promise<void>;
  rejectRequest: (requestId: string, reason: string, orgId: string, tlProfileId?: string) => Promise<void>;
  clearError: () => void;
}

export const useProfileChangeRequestStore = create<ProfileChangeRequestState>((set, get) => ({
  pendingRequests: [],
  myRequests: [],
  loading: false,
  error: null,

  fetchPendingForHR: async (orgId: string) => {
    set({ loading: true, error: null });
    try {
      if (USE_MOCK_PROFILE_DATA) {
        const rows = getMockPendingForHR();
        const profileIds = [...new Set(rows.map((r) => r.profile_id))];
        let namesMap: Record<string, { full_name: string | null; email: string | null }> = {};
        if (profileIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', profileIds);
          (profilesData || []).forEach((p: any) => {
            namesMap[p.id] = { full_name: p.full_name ?? null, email: p.email ?? null };
          });
        }
        const enriched = rows.map((row) => ({
          ...row,
          requested_data: row.requested_data as RequestedProfileData,
          employee_name: namesMap[row.profile_id]?.full_name ?? null,
          employee_email: namesMap[row.profile_id]?.email ?? null,
        }));
        set({ pendingRequests: enriched, loading: false });
        return;
      }

      const { data, error } = await supabase
        .from('employee_profile_change_requests')
        .select(`
          id,
          profile_id,
          requested_by_user_id,
          status,
          requested_data,
          rejection_reason,
          reviewed_at,
          reviewed_by,
          created_at,
          updated_at
        `)
        .eq('status', 'pending_hr_approval')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const rows = data || [];
      const profileIds = [...new Set(rows.map((r: any) => r.profile_id))];
      let namesMap: Record<string, { full_name: string | null; email: string | null }> = {};
      if (profileIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', profileIds);
        (profilesData || []).forEach((p: any) => {
          namesMap[p.id] = { full_name: p.full_name ?? null, email: p.email ?? null };
        });
      }
      const enriched = rows.map((row: any) => ({
        ...row,
        employee_name: namesMap[row.profile_id]?.full_name ?? null,
        employee_email: namesMap[row.profile_id]?.email ?? null,
      }));
      set({ pendingRequests: enriched, loading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch pending requests', loading: false });
    }
  },

  fetchPendingForTeamLead: async (orgId: string, tlProfileId: string) => {
    set({ loading: true, error: null });
    try {
      if (USE_MOCK_PROFILE_DATA) {
        const rows = getMockPendingForHR();
        const profileIds = [...new Set(rows.map((r) => r.profile_id))];
        if (profileIds.length === 0) {
          set({ pendingRequests: [], loading: false });
          return;
        }
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, email, team_lead_id')
          .in('id', profileIds);
        const tlProfileIds = new Set(
          (profilesData || []).filter((p: any) => p.team_lead_id === tlProfileId).map((p: any) => p.id)
        );
        const filteredRows = rows.filter((r) => tlProfileIds.has(r.profile_id));
        const namesMap: Record<string, { full_name: string | null; email: string | null }> = {};
        (profilesData || []).forEach((p: any) => {
          namesMap[p.id] = { full_name: p.full_name ?? null, email: p.email ?? null };
        });
        const enriched = filteredRows.map((row) => ({
          ...row,
          requested_data: row.requested_data as RequestedProfileData,
          employee_name: namesMap[row.profile_id]?.full_name ?? null,
          employee_email: namesMap[row.profile_id]?.email ?? null,
        }));
        set({ pendingRequests: enriched, loading: false });
        return;
      }

      const { data: groupProfiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('team_lead_id', tlProfileId)
        .eq('org_id', orgId);
      const groupProfileIds = (groupProfiles || []).map((p: any) => p.id);
      if (groupProfileIds.length === 0) {
        set({ pendingRequests: [], loading: false });
        return;
      }

      const { data, error } = await supabase
        .from('employee_profile_change_requests')
        .select(`
          id,
          profile_id,
          requested_by_user_id,
          status,
          requested_data,
          rejection_reason,
          reviewed_at,
          reviewed_by,
          created_at,
          updated_at
        `)
        .eq('status', 'pending_hr_approval')
        .in('profile_id', groupProfileIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const rows = data || [];
      const profileIds = [...new Set(rows.map((r: any) => r.profile_id))];
      let namesMap: Record<string, { full_name: string | null; email: string | null }> = {};
      if (profileIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', profileIds);
        (profilesData || []).forEach((p: any) => {
          namesMap[p.id] = { full_name: p.full_name ?? null, email: p.email ?? null };
        });
      }
      const enriched = rows.map((row: any) => ({
        ...row,
        employee_name: namesMap[row.profile_id]?.full_name ?? null,
        employee_email: namesMap[row.profile_id]?.email ?? null,
      }));
      set({ pendingRequests: enriched, loading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch pending requests', loading: false });
    }
  },

  fetchMyRequests: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      if (!profileRow?.id) {
        set({ myRequests: [], loading: false });
        return;
      }

      if (USE_MOCK_PROFILE_DATA) {
        const list = getMockMyRequests(profileRow.id).map((r) => ({
          ...r,
          requested_data: r.requested_data as RequestedProfileData,
        }));
        set({ myRequests: list, loading: false });
        return;
      }

      const { data, error } = await supabase
        .from('employee_profile_change_requests')
        .select('*')
        .eq('profile_id', profileRow.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ myRequests: data || [], loading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch requests', loading: false });
    }
  },

  approveRequest: async (requestId: string, orgId: string) => {
    set({ loading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (USE_MOCK_PROFILE_DATA) {
        const request = getMockChangeRequest(requestId);
        if (!request || request.status !== 'pending_hr_approval') throw new Error('Request not found or already processed');
        const payload = request.requested_data as Record<string, unknown>;
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('id', request.profile_id)
          .maybeSingle();
        if (profileRow?.user_id) {
          setMockProfileOverlay(profileRow.user_id, payload);
        }
        updateMockChangeRequest(requestId, {
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        });
        if (tlProfileId) await get().fetchPendingForTeamLead(orgId, tlProfileId);
        else await get().fetchPendingForHR(orgId);
        set({ loading: false });
        return;
      }

      const { data: request, error: fetchErr } = await supabase
        .from('employee_profile_change_requests')
        .select('profile_id, requested_data')
        .eq('id', requestId)
        .eq('status', 'pending_hr_approval')
        .single();

      if (fetchErr || !request) throw new Error('Request not found or already processed');

      const payload = request.requested_data as Record<string, unknown>;
      const updatePayload: Record<string, unknown> = {};
      const allowedKeys = [
        'full_name', 'birthday', 'doj', 'city', 'phone', 'avatar_url', 'blood_group',
        'gender', 'marital_status', 'address_line1', 'address_line2', 'state', 'pincode', 'personal_email',
        'employee_number', 'department', 'designation', 'work_phone',
        'bank_name', 'bank_account_number', 'bank_ifsc', 'bank_branch',
        'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relation',
      ];
      allowedKeys.forEach((k) => {
        if (payload[k] !== undefined) updatePayload[k] = payload[k];
      });

      const { error: updateProfileErr } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', request.profile_id)
        .eq('org_id', orgId);

      if (updateProfileErr) throw updateProfileErr;

      const { error: updateReqErr } = await supabase
        .from('employee_profile_change_requests')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        })
        .eq('id', requestId);

      if (updateReqErr) throw updateReqErr;

      if (tlProfileId) await get().fetchPendingForTeamLead(orgId, tlProfileId);
      else await get().fetchPendingForHR(orgId);
      set({ loading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to approve', loading: false });
      throw err;
    }
  },

  rejectRequest: async (requestId: string, reason: string, orgId: string, tlProfileId?: string) => {
    set({ loading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (USE_MOCK_PROFILE_DATA) {
        const request = getMockChangeRequest(requestId);
        if (!request || request.status !== 'pending_hr_approval') throw new Error('Request not found or already processed');
        updateMockChangeRequest(requestId, {
          status: 'rejected',
          rejection_reason: reason || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        });
        if (tlProfileId) await get().fetchPendingForTeamLead(orgId, tlProfileId);
        else await get().fetchPendingForHR(orgId);
        set({ loading: false });
        return;
      }

      const { error: updateErr } = await supabase
        .from('employee_profile_change_requests')
        .update({
          status: 'rejected',
          rejection_reason: reason || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        })
        .eq('id', requestId)
        .eq('status', 'pending_hr_approval');

      if (updateErr) throw updateErr;

      if (tlProfileId) await get().fetchPendingForTeamLead(orgId, tlProfileId);
      else await get().fetchPendingForHR(orgId);
      set({ loading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to reject', loading: false });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));
