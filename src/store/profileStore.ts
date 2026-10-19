import { supabase } from '@/integrations/supabase/client';
import { create } from 'zustand';
import {
  USE_MOCK_PROFILE_DATA,
  getMockProfileOverlay,
  setMockProfileOverlay,
  getMockProfileStatus,
  setMockProfileStatus,
  addMockChangeRequest,
} from '@/lib/mockProfileData';

export type ProfileStatus = 'draft' | 'submitted' | 'active';

export interface EmployeeProfile {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
  role: string | null;
  status: string | null;
  profile_status?: ProfileStatus | null;
  birthday: string | null;
  doj: string | null;
  city: string | null;
  team_id: string | null;
  manager_id: string | null;
  team_lead_id: string | null;
  org_id: string | null;
  phone?: string | null;
  profile_submitted?: boolean | null;
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
  blood_group?: string | null;
  work_start_time?: string | null;
  work_end_time?: string | null;
  asset?: string | null;
  // Related data
  team_name?: string | null;
  manager_name?: string | null;
  team_lead_name?: string | null;
}

export type EmployeeProfileUpdatePayload = Partial<Pick<EmployeeProfile,
  | 'full_name' | 'birthday' | 'doj' | 'city' | 'phone' | 'avatar_url'
  | 'gender' | 'marital_status' | 'address_line1' | 'address_line2' | 'state' | 'pincode' | 'personal_email'
  | 'employee_number' | 'department' | 'designation' | 'work_phone'
  | 'bank_name' | 'bank_account_number' | 'bank_ifsc' | 'bank_branch'
  | 'emergency_contact_name' | 'emergency_contact_phone' | 'emergency_contact_relation'
  | 'blood_group' | 'work_start_time' | 'work_end_time' | 'asset'>>;

export interface WorkStatus {
  status: 'active' | 'idle' | 'offline';
  currentSession: any | null;
  todayStats: {
    totalSeconds: number;
    activeSeconds: number;
    breakSeconds: number;
  };
}

interface ProfileState {
  profile: EmployeeProfile | null;
  workStatus: WorkStatus | null;
  loading: boolean;
  error: string | null;
  fetchProfile: (employeeId: string, orgId: string) => Promise<void>;
  fetchWorkStatus: (employeeId: string) => Promise<void>;
  updateProfile: (employeeId: string, updates: Record<string, unknown> & { profile_status?: ProfileStatus }) => Promise<void>;
  submitFirstTimeProfile: (employeeId: string, orgId: string, data: EmployeeProfileUpdatePayload) => Promise<void>;
  submitChangeRequest: (employeeId: string, profileId: string, data: EmployeeProfileUpdatePayload) => Promise<void>;
  clearError: () => void;
}

/**
 * Resolve employeeId (user_id, profile id, or employee_number) to profile id.
 */
async function resolveEmployeeIdToProfileId(employeeId: string): Promise<string | null> {
  if (!employeeId?.trim()) return null;
  const id = employeeId.trim();
  try {
    const { data: byUserId } = await supabase.from('profiles').select('id').eq('user_id', id).maybeSingle();
    if (byUserId?.id) return byUserId.id;
    const { data: byId } = await supabase.from('profiles').select('id').eq('id', id).maybeSingle();
    if (byId?.id) return byId.id;
    const { data: byEmployeeNumber } = await supabase.from('profiles').select('id').eq('employee_number', id).maybeSingle();
    if (byEmployeeNumber?.id) return byEmployeeNumber.id;
    return null;
  } catch {
    return null;
  }
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  workStatus: null,
  loading: false,
  error: null,

  fetchProfile: async (employeeId: string, orgId: string) => {
    set({ loading: true, error: null });
    try {
      const profileId = await resolveEmployeeIdToProfileId(employeeId);
      if (!profileId) {
        throw new Error('Profile not found');
      }

      // Select only columns that exist in DB; all other fields (phone, birthday, doj, city, avatar_url, profile_status, etc.) from mock
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          user_id,
          email,
          full_name,
          role,
          status,
          team_id,
          manager_id,
          team_lead_id,
          org_id,
          birthday,
          doj,
          city,
          phone,
          avatar_url,
          profile_status,
          blood_group,
          emergency_contact_phone,
          employee_number,
          work_start_time,
          work_end_time
        `)
        .eq('id', profileId)
        .eq('org_id', orgId)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        throw new Error('Profile not found');
      }

      // Fetch related data separately
      let team_name = null;
      let manager_name = null;
      let team_lead_name = null;

      // Fetch team name if team_id exists
      if (data.team_id) {
        const { data: teamData } = await supabase
          .from('teams')
          .select('name')
          .eq('id', data.team_id)
          .maybeSingle();
        team_name = teamData?.name || null;
      }

      // Fetch manager name if manager_id exists
      if (data.manager_id) {
        const { data: managerData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', data.manager_id)
          .maybeSingle();
        manager_name = managerData?.full_name || null;
      }

      // Fetch team lead name if team_lead_id exists
      if (data.team_lead_id) {
        const { data: teamLeadData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', data.team_lead_id)
          .maybeSingle();
        team_lead_name = teamLeadData?.full_name || null;
      }

      const nameParts = data.full_name?.split(' ') || [];
      const first_name = nameParts[0] || null;
      const last_name = nameParts.slice(1).join(' ') || null;
      // All possibly-missing fields from mock overlay (phone, birthday, doj, city, avatar_url, profile_status, etc.)
      const overlay = getMockProfileOverlay(data.user_id) ?? {};
      const db = data as Record<string, unknown>;
      const profileStatus = (overlay.profile_status as ProfileStatus) ?? (db.profile_status as ProfileStatus) ?? 'draft';
      const profileSubmitted = profileStatus === 'submitted' || profileStatus === 'active';

      set({
        profile: {
          ...data,
          first_name,
          last_name,
          team_name,
          manager_name,
          team_lead_name,
          profile_status: profileStatus,
          profile_submitted: profileSubmitted,
          birthday: (overlay.birthday as string | null) ?? (db.birthday as string | null) ?? null,
          doj: (overlay.doj as string | null) ?? (db.doj as string | null) ?? null,
          city: (overlay.city as string | null) ?? (db.city as string | null) ?? null,
          phone: (overlay.phone as string | null) ?? (db.phone as string | null) ?? null,
          avatar_url: (overlay.avatar_url as string | null) ?? (db.avatar_url as string | null) ?? null,
          gender: (overlay.gender as string | null) ?? null,
          marital_status: (overlay.marital_status as string | null) ?? null,
          address_line1: (overlay.address_line1 as string | null) ?? null,
          address_line2: (overlay.address_line2 as string | null) ?? null,
          state: (overlay.state as string | null) ?? null,
          pincode: (overlay.pincode as string | null) ?? null,
          personal_email: (overlay.personal_email as string | null) ?? null,
          employee_number: (overlay.employee_number as string | null) ?? (db.employee_number as string | null) ?? null,
          department: (overlay.department as string | null) ?? null,
          designation: (overlay.designation as string | null) ?? null,
          work_phone: (overlay.work_phone as string | null) ?? null,
          bank_name: (overlay.bank_name as string | null) ?? null,
          bank_account_number: (overlay.bank_account_number as string | null) ?? null,
          bank_ifsc: (overlay.bank_ifsc as string | null) ?? null,
          bank_branch: (overlay.bank_branch as string | null) ?? null,
          emergency_contact_name: (overlay.emergency_contact_name as string | null) ?? null,
          emergency_contact_phone: (overlay.emergency_contact_phone as string | null) ?? (db.emergency_contact_phone as string | null) ?? null,
          emergency_contact_relation: (overlay.emergency_contact_relation as string | null) ?? null,
          blood_group: (overlay.blood_group as string | null) ?? (db.blood_group as string | null) ?? null,
          work_start_time: (overlay.work_start_time as string | null) ?? (db.work_start_time as string | null) ?? null,
          work_end_time: (overlay.work_end_time as string | null) ?? (db.work_end_time as string | null) ?? null,
          ...(overlay.full_name !== undefined && { full_name: overlay.full_name as string | null }),
        },
        loading: false,
      });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to fetch profile',
        loading: false,
      });
    }
  },

  fetchWorkStatus: async (employeeId: string) => {
    try {
      const profileId = await resolveEmployeeIdToProfileId(employeeId);
      if (!profileId) {
        set({ workStatus: { status: 'offline', currentSession: null, todayStats: { totalSeconds: 0, activeSeconds: 0, breakSeconds: 0 } } });
        return;
      }

      // Get current open session
      const { data: session } = await supabase
        .from('work_sessions')
        .select('*')
        .eq('user_id', profileId)
        .eq('status', 'open')
        .maybeSingle();

      // Get today's stats
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const { data: todaySessions } = await supabase
        .from('work_sessions')
        .select('duration_seconds')
        .eq('user_id', profileId)
        .gte('started_at', startOfDay.toISOString())
        .lte('started_at', endOfDay.toISOString());

      const totalSeconds = (todaySessions || []).reduce((sum, s) => sum + (s.duration_seconds || 0), 0);

      const { data: todayBreaks } = await supabase
        .from('breaks')
        .select('duration_seconds')
        .eq('user_id', profileId)
        .gte('started_at', startOfDay.toISOString())
        .lte('started_at', endOfDay.toISOString())
        .not('duration_seconds', 'is', null);

      const breakSeconds = (todayBreaks || []).reduce((sum, b) => sum + (b.duration_seconds || 0), 0);
      const activeSeconds = totalSeconds - breakSeconds;

      // Determine status
      let status: 'active' | 'idle' | 'offline' = 'offline';
      if (session) {
        // Check if there's an active break
        const { data: activeBreak } = await supabase
          .from('breaks')
          .select('*')
          .eq('user_id', profileId)
          .is('ended_at', null)
          .maybeSingle();
        
        status = activeBreak ? 'idle' : 'active';
      }

      set({
        workStatus: {
          status,
          currentSession: session,
          todayStats: {
            totalSeconds,
            activeSeconds,
            breakSeconds,
          },
        },
      });
    } catch (error: any) {
      console.error('Error fetching work status:', error);
      set({
        workStatus: {
          status: 'offline',
          currentSession: null,
          todayStats: { totalSeconds: 0, activeSeconds: 0, breakSeconds: 0 },
        },
      });
    }
  },

  updateProfile: async (employeeId: string, updates: Record<string, unknown> & { profile_status?: ProfileStatus }) => {
    set({ loading: true, error: null });
    try {
      if (USE_MOCK_PROFILE_DATA) {
        setMockProfileOverlay(employeeId, updates as Record<string, unknown>);
        const currentProfile = get().profile;
        if (currentProfile?.org_id) {
          await get().fetchProfile(employeeId, currentProfile.org_id);
        }
        set({ loading: false });
        return;
      }

      const allowedKeys = [
        'birthday', 'doj', 'city', 'phone', 'avatar_url', 'blood_group',
        'gender', 'marital_status', 'address_line1', 'address_line2', 'state', 'pincode', 'personal_email',
        'employee_number', 'department', 'designation', 'work_phone',
        'bank_name', 'bank_account_number', 'bank_ifsc', 'bank_branch',
        'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relation', 'full_name',
        'work_start_time', 'work_end_time',
      ];
      const updateData: Record<string, unknown> = {};
      allowedKeys.forEach((k) => {
        if (updates[k] !== undefined) updateData[k] = updates[k];
      });

      // Update by user_id so we always hit the correct row (profile.id ≠ user_id)
      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('user_id', employeeId);

      if (updateError) throw updateError;

      const currentProfile = get().profile;
      if (currentProfile && currentProfile.user_id === employeeId) {
        await get().fetchProfile(employeeId, (currentProfile.org_id as string) || '');
      }
    } catch (error: any) {
      set({
        error: error.message || 'Failed to update profile',
        loading: false,
      });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  submitFirstTimeProfile: async (employeeId: string, orgId: string, data: EmployeeProfileUpdatePayload) => {
    set({ loading: true, error: null });
    try {
      if (USE_MOCK_PROFILE_DATA) {
        setMockProfileOverlay(employeeId, { profile_status: 'submitted', ...(data as Record<string, unknown>) });
        await get().fetchProfile(employeeId, orgId);
        set({ loading: false });
        return;
      }

      const { data: profileCheck } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', employeeId)
        .maybeSingle();
      const profileId = profileCheck?.id || employeeId;
      if (!profileId) throw new Error('Profile not found');

      const allowedKeys = [
        'full_name', 'birthday', 'doj', 'city', 'phone', 'avatar_url', 'blood_group',
        'gender', 'marital_status', 'address_line1', 'address_line2', 'state', 'pincode', 'personal_email',
        'employee_number', 'department', 'designation', 'work_phone',
        'bank_name', 'bank_account_number', 'bank_ifsc', 'bank_branch',
        'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relation',
        'work_start_time', 'work_end_time',
      ];
      const updateData: Record<string, unknown> = { profile_status: 'submitted' };
      allowedKeys.forEach((k) => {
        if ((data as Record<string, unknown>)[k] !== undefined) updateData[k] = (data as Record<string, unknown>)[k];
      });

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', profileId)
        .eq('org_id', orgId);

      if (error) throw error;
      await get().fetchProfile(employeeId, orgId);
    } catch (error: any) {
      set({ error: error.message || 'Failed to submit profile', loading: false });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  submitChangeRequest: async (employeeId: string, profileId: string, data: EmployeeProfileUpdatePayload) => {
    set({ loading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (USE_MOCK_PROFILE_DATA) {
        addMockChangeRequest({
          profile_id: profileId,
          requested_by_user_id: user.id,
          status: 'pending_hr_approval',
          requested_data: data as Record<string, unknown>,
          rejection_reason: null,
          reviewed_at: null,
          reviewed_by: null,
        });
        const currentProfile = get().profile;
        if (currentProfile?.org_id) await get().fetchProfile(employeeId, currentProfile.org_id);
        set({ loading: false });
        return;
      }

      const { error } = await supabase
        .from('employee_profile_change_requests')
        .insert({
          profile_id: profileId,
          requested_by_user_id: user.id,
          status: 'pending_hr_approval',
          requested_data: data as Record<string, unknown>,
        });

      if (error) throw error;
      const currentProfile = get().profile;
      if (currentProfile?.org_id) await get().fetchProfile(employeeId, currentProfile.org_id);
    } catch (error: any) {
      set({ error: error.message || 'Failed to submit change request', loading: false });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));

