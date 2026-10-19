import { supabase } from '@/integrations/supabase/client';
import { create } from 'zustand';
import { format } from 'date-fns';

export type LeaveType = 'casual' | 'sick' | 'paid' | 'unpaid' | 'paternity' | 'comp_off';
export type LeaveDurationType = 'full' | 'half';
export type LeaveStatus = 'pending' | 'pending_hr' | 'approved' | 'rejected';
export type ApprovalLevel = 'team_lead' | 'manager' | 'hr';

export interface LeaveRequest {
  id: string;
  user_id: string;
  profile_id: string | null;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  duration_days: number;
  duration_type: LeaveDurationType;
  status: LeaveStatus;
  reason: string | null;
  remarks: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejected_reason: string | null;
  approved_by_manager: string | null;
  approved_by_hr: string | null;
  created_at: string;
  updated_at: string;
  employee_name?: string | null;
  approver_name?: string | null;
}

export interface LeaveBalance {
  casual: { used: number; total: number; remaining: number };
  sick: { used: number; total: number; remaining: number };
  paid: { used: number; total: number; remaining: number };
  unpaid: { used: number; total: number; remaining: number };
}

interface LeaveState {
  leaveRequests: LeaveRequest[];
  leaveHistory: LeaveRequest[];
  pendingRequests: LeaveRequest[];
  pendingHRRequests: LeaveRequest[];
  leaveBalance: LeaveBalance | null;
  loading: boolean;
  error: string | null;

  requestLeave: (data: {
    leave_type: LeaveType;
    start_date: Date;
    end_date: Date;
    duration_type: LeaveDurationType;
    reason?: string;
  }) => Promise<void>;
  getLeaveHistory: (orgId?: string | null) => Promise<void>;
  getPendingRequests: (orgId: string, userRole?: string | null) => Promise<void>;
  getLeaveBalance: (userId?: string) => Promise<void>;
  approveLeave: (leaveId: string, orgId: string, remarks?: string, approvalLevel?: ApprovalLevel) => Promise<void>;
  rejectLeave: (leaveId: string, reason: string, orgId: string, remarks?: string) => Promise<void>;
  clearError: () => void;
  checkLeaveBalance: (leaveType: LeaveType, durationDays: number) => boolean;
}

/**
 * Get profile ID and org_id from user ID
 */
async function getProfileForUser(userId: string): Promise<{ profileId: string; orgId: string } | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, org_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data?.org_id) return null;
  return { profileId: data.id, orgId: data.org_id };
}

/**
 * Map DB row to LeaveRequest with employee_name from join
 */
function mapLeaveRow(row: any): LeaveRequest {
  return {
    id: row.id,
    user_id: row.user_id,
    profile_id: row.profile_id,
    leave_type: row.leave_type,
    start_date: row.start_date,
    end_date: row.end_date,
    duration_days: Number(row.duration_days),
    duration_type: row.duration_type,
    status: row.status,
    reason: row.reason,
    remarks: row.remarks,
    approved_by: row.approved_by,
    approved_at: row.approved_at,
    rejected_by: row.rejected_by,
    rejected_at: row.rejected_at,
    rejected_reason: row.rejected_reason,
    approved_by_manager: row.approved_by_manager,
    approved_by_hr: row.approved_by_hr,
    created_at: row.created_at,
    updated_at: row.updated_at,
    employee_name: row.profiles?.full_name ?? row.employee_name ?? null,
  };
}

/**
 * Calculate duration in days between two dates
 */
function calculateDurationDays(startDate: Date, endDate: Date, durationType: LeaveDurationType): number {
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  if (durationType === 'half') return diffDays * 0.5;
  return diffDays;
}

const CURRENT_YEAR = new Date().getFullYear();

export const useLeaveStore = create<LeaveState>((set, get) => ({
  leaveRequests: [],
  leaveHistory: [],
  pendingRequests: [],
  pendingHRRequests: [],
  leaveBalance: null,
  loading: false,
  error: null,

  requestLeave: async (data) => {
    set({ loading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const profileInfo = await getProfileForUser(user.id);
      if (!profileInfo) throw new Error('Profile not found. Complete your profile first.');

      const durationDays = calculateDurationDays(data.start_date, data.end_date, data.duration_type);
      const currentState = get();
      if (!currentState.checkLeaveBalance(data.leave_type, durationDays)) {
        throw new Error(`Insufficient leave balance for ${data.leave_type} leave`);
      }

      const { error } = await supabase.from('leave_requests').insert({
        user_id: user.id,
        profile_id: profileInfo.profileId,
        org_id: profileInfo.orgId,
        leave_type: data.leave_type,
        start_date: format(data.start_date, 'yyyy-MM-dd'),
        end_date: format(data.end_date, 'yyyy-MM-dd'),
        duration_days: durationDays,
        duration_type: data.duration_type,
        status: 'pending',
        reason: data.reason || null,
      });

      if (error) throw error;

      // Refresh history and balance
      await get().getLeaveHistory(null);
      await get().getLeaveBalance();
      set({ loading: false });
    } catch (err: any) {
      set({
        error: err.message || 'Failed to request leave',
        loading: false,
      });
      throw err;
    }
  },

  getLeaveHistory: async (orgId?: string | null) => {
    set({ loading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        set({ leaveHistory: [], loading: false });
        return;
      }

      let query = supabase
        .from('leave_requests')
        .select(`
          *,
          profiles:profile_id(full_name)
        `)
        .order('created_at', { ascending: false });

      if (orgId) {
        query = query.eq('org_id', orgId);
      } else {
        const profileInfo = await getProfileForUser(user.id);
        if (!profileInfo) {
          set({ leaveHistory: [], loading: false });
          return;
        }
        query = query.eq('profile_id', profileInfo.profileId);
      }

      const { data: rows, error } = await query;

      if (error) throw error;

      const leaveHistory = (rows || []).map(mapLeaveRow);
      set({ leaveHistory, loading: false });
    } catch (err: any) {
      set({
        error: err.message || 'Failed to fetch leave history',
        leaveHistory: [],
        loading: false,
      });
    }
  },

  getLeaveBalance: async () => {
    set({ loading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        set({ leaveBalance: null, loading: false });
        return;
      }

      const profileInfo = await getProfileForUser(user.id);
      if (!profileInfo) {
        set({ leaveBalance: null, loading: false });
        return;
      }

      const { data: row, error } = await supabase
        .from('leave_balances')
        .select('*')
        .eq('profile_id', profileInfo.profileId)
        .eq('org_id', profileInfo.orgId)
        .eq('year', CURRENT_YEAR)
        .maybeSingle();

      if (error) throw error;

      if (row) {
        const casualRemaining = Math.max(0, row.casual_total - Number(row.casual_used));
        const sickRemaining = Math.max(0, row.sick_total - Number(row.sick_used));
        const paidRemaining = Math.max(0, row.paid_total - Number(row.paid_used));
        set({
          leaveBalance: {
            casual: { used: Number(row.casual_used), total: row.casual_total, remaining: casualRemaining },
            sick: { used: Number(row.sick_used), total: row.sick_total, remaining: sickRemaining },
            paid: { used: Number(row.paid_used), total: row.paid_total, remaining: paidRemaining },
            unpaid: { used: 0, total: 0, remaining: 0 },
          },
          loading: false,
        });
      } else {
        // Create default balance row for this year
        const { error: insertErr } = await supabase.from('leave_balances').insert({
          profile_id: profileInfo.profileId,
          org_id: profileInfo.orgId,
          year: CURRENT_YEAR,
          casual_total: 12,
          casual_used: 0,
          sick_total: 10,
          sick_used: 0,
          paid_total: 20,
          paid_used: 0,
        });
        if (insertErr) {
          set({ leaveBalance: null, loading: false });
          return;
        }
        set({
          leaveBalance: {
            casual: { used: 0, total: 12, remaining: 12 },
            sick: { used: 0, total: 10, remaining: 10 },
            paid: { used: 0, total: 20, remaining: 20 },
            unpaid: { used: 0, total: 0, remaining: 0 },
          },
          loading: false,
        });
      }
    } catch (err: any) {
      set({
        error: err.message || 'Failed to fetch leave balance',
        leaveBalance: null,
        loading: false,
      });
    }
  },

  getPendingRequests: async (orgId: string, userRole?: string | null) => {
    set({ loading: true, error: null });
    try {
      const isHR = userRole?.toLowerCase() === 'hr';

      if (isHR) {
        const { data: rows, error } = await supabase
          .from('leave_requests')
          .select(`
            *,
            profiles:profile_id(full_name)
          `)
          .eq('org_id', orgId)
          .eq('status', 'pending_hr')
          .order('created_at', { ascending: false });

        if (error) throw error;
        set({
          pendingRequests: [],
          pendingHRRequests: (rows || []).map(mapLeaveRow),
          loading: false,
        });
      } else {
        const { data: rows, error } = await supabase
          .from('leave_requests')
          .select(`
            *,
            profiles:profile_id(full_name)
          `)
          .eq('org_id', orgId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (error) throw error;
        set({
          pendingRequests: (rows || []).map(mapLeaveRow),
          pendingHRRequests: [],
          loading: false,
        });
      }
    } catch (err: any) {
      set({
        error: err.message || 'Failed to fetch pending requests',
        pendingRequests: [],
        pendingHRRequests: [],
        loading: false,
      });
    }
  },

  approveLeave: async (leaveId: string, orgId: string, remarks?: string, approvalLevel?: ApprovalLevel) => {
    set({ loading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const approverProfile = await getProfileForUser(user.id);
      if (!approverProfile) throw new Error('Profile not found');

      const isHR = approvalLevel === 'hr';
      const isManager = approvalLevel === 'manager' || approvalLevel === 'team_lead';

      const { data: leaveRow, error: fetchErr } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('id', leaveId)
        .eq('org_id', orgId)
        .single();

      if (fetchErr || !leaveRow) throw new Error('Leave request not found');

      if (isManager && leaveRow.status === 'pending') {
        const { error: updateErr } = await supabase
          .from('leave_requests')
          .update({
            status: 'pending_hr',
            approved_by_manager: approverProfile.profileId,
            remarks: remarks || leaveRow.remarks,
            updated_at: new Date().toISOString(),
          })
          .eq('id', leaveId);

        if (updateErr) throw updateErr;
      } else if (isHR && leaveRow.status === 'pending_hr') {
        const { error: updateErr } = await supabase
          .from('leave_requests')
          .update({
            status: 'approved',
            approved_by_hr: approverProfile.profileId,
            approved_by: approverProfile.profileId,
            approved_at: new Date().toISOString(),
            remarks: remarks || leaveRow.remarks,
            updated_at: new Date().toISOString(),
          })
          .eq('id', leaveId);

        if (updateErr) throw updateErr;

        // Deduct from leave_balances
        const profileId = leaveRow.profile_id;
        const durationDays = Number(leaveRow.duration_days);
        const leaveType = leaveRow.leave_type;
        if (profileId && leaveType !== 'unpaid') {
          const balanceKey = leaveType === 'casual' ? 'casual_used' : leaveType === 'sick' ? 'sick_used' : leaveType === 'paid' ? 'paid_used' : null;
          if (balanceKey) {
            const { data: bal } = await supabase
              .from('leave_balances')
              .select(balanceKey)
              .eq('profile_id', profileId)
              .eq('org_id', orgId)
              .eq('year', CURRENT_YEAR)
              .single();
            if (bal) {
              const currentUsed = Number((bal as any)[balanceKey]) || 0;
              await supabase
                .from('leave_balances')
                .update({ [balanceKey]: currentUsed + durationDays, updated_at: new Date().toISOString() })
                .eq('profile_id', profileId)
                .eq('org_id', orgId)
                .eq('year', CURRENT_YEAR);
            }
          }
        }
      }

      set({ loading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to approve leave', loading: false });
      throw err;
    }
  },

  rejectLeave: async (leaveId: string, reason: string, orgId: string) => {
    set({ loading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const approverProfile = await getProfileForUser(user.id);
      if (!approverProfile) throw new Error('Profile not found');

      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: 'rejected',
          rejected_by: approverProfile.profileId,
          rejected_at: new Date().toISOString(),
          rejected_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leaveId)
        .eq('org_id', orgId);

      if (error) throw error;
      set({ loading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to reject leave', loading: false });
      throw err;
    }
  },

  checkLeaveBalance: (leaveType: LeaveType, durationDays: number) => {
    const state = get();
    if (!state.leaveBalance) return true;
    if (leaveType === 'unpaid') return true;
    const key = leaveType as keyof LeaveBalance;
    if (key in state.leaveBalance) {
      return state.leaveBalance[key].remaining >= durationDays;
    }
    return true;
  },

  clearError: () => set({ error: null }),
}));
