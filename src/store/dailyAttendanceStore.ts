import { supabase } from '@/integrations/supabase/client';
import { create } from 'zustand';
import { format } from 'date-fns';

export type DailyAttendanceStatus = 'Full Day' | 'Half Day' | 'Leave';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface DailyAttendanceSubmission {
  id: string;
  profile_id: string;
  employee_name: string | null;
  date: string;
  status: DailyAttendanceStatus;
  submitted_at: string;
  sent_to_team_lead_id: string | null;
  approval_status: ApprovalStatus;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
}

interface DailyAttendanceState {
  submissions: DailyAttendanceSubmission[];
  loading: boolean;
  error: string | null;

  submitAttendance: (
    date: Date,
    status: DailyAttendanceStatus
  ) => Promise<{ success: boolean; message: string }>;
  getSubmissionForDate: (date: string) => DailyAttendanceSubmission | undefined;
  getMySubmissionForDate: (dateStr: string) => Promise<DailyAttendanceSubmission | undefined>;
  getPendingSubmissionsForTeamLead: (teamLeadProfileId: string) => DailyAttendanceSubmission[];
  getAllSubmissionsForTeamLead: (teamLeadProfileId: string) => DailyAttendanceSubmission[];
  approveAttendance: (submissionId: string, teamLeadProfileId: string) => Promise<{ success: boolean; message: string }>;
  rejectAttendance: (submissionId: string, teamLeadProfileId: string) => Promise<{ success: boolean; message: string }>;
  seedMockPendingForTeamLead: (teamLeadProfileId: string) => void;
}

// In-memory mock storage (no DB changes)
const mockSubmissions: DailyAttendanceSubmission[] = [];

export const useDailyAttendanceStore = create<DailyAttendanceState>((set, get) => ({
  submissions: [...mockSubmissions],
  loading: false,
  error: null,

  submitAttendance: async (date: Date, status: DailyAttendanceStatus) => {
    set({ loading: true, error: null });
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, team_lead_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError || !profile) {
        throw new Error('Could not fetch your profile');
      }

      const dateStr = format(date, 'yyyy-MM-dd');

      // Check if already submitted for this date
      const existing = get().submissions.find(
        (s) => s.profile_id === profile.id && s.date === dateStr
      );
      if (existing) {
        set({ loading: false });
        return {
          success: false,
          message: `Attendance for ${dateStr} was already submitted (${existing.status})`,
        };
      }

      const submission: DailyAttendanceSubmission = {
        id: crypto.randomUUID(),
        profile_id: profile.id,
        employee_name: profile.full_name || null,
        date: dateStr,
        status,
        submitted_at: new Date().toISOString(),
        sent_to_team_lead_id: profile.team_lead_id || null,
        approval_status: 'pending',
      };

      // MOCK: Store in memory and simulate sending to team lead
      set((state) => ({
        submissions: [...state.submissions, submission],
        loading: false,
      }));

      const teamLeadNote = profile.team_lead_id
        ? ' and sent to your team lead for acknowledgment.'
        : ' (No team lead assigned.)';

      return {
        success: true,
        message: `Attendance marked as ${status} for ${dateStr}${teamLeadNote}`,
      };
    } catch (error: any) {
      set({
        error: error.message || 'Failed to submit attendance',
        loading: false,
      });
      return {
        success: false,
        message: error.message || 'Failed to submit attendance',
      };
    }
  },

  getSubmissionForDate: (dateStr: string) => {
    return get().submissions.find((s) => s.date === dateStr);
  },

  getMySubmissionForDate: async (dateStr: string): Promise<DailyAttendanceSubmission | undefined> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return undefined;
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!profile) return undefined;
    return get().submissions.find(
      (s) => s.profile_id === profile.id && s.date === dateStr
    );
  },

  getPendingSubmissionsForTeamLead: (teamLeadProfileId: string) => {
    return get().submissions.filter(
      (s) => s.sent_to_team_lead_id === teamLeadProfileId && s.approval_status === 'pending'
    );
  },

  getAllSubmissionsForTeamLead: (teamLeadProfileId: string) => {
    return get().submissions
      .filter((s) => s.sent_to_team_lead_id === teamLeadProfileId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  approveAttendance: async (submissionId: string, teamLeadProfileId: string) => {
    set({ loading: true, error: null });
    try {
      const submission = get().submissions.find((s) => s.id === submissionId);
      if (!submission) {
        set({ loading: false });
        return { success: false, message: 'Submission not found' };
      }
      if (submission.sent_to_team_lead_id !== teamLeadProfileId) {
        set({ loading: false });
        return { success: false, message: 'You can only approve submissions sent to you' };
      }
      if (submission.approval_status !== 'pending') {
        set({ loading: false });
        return { success: false, message: `Already ${submission.approval_status}` };
      }

      set((state) => ({
        submissions: state.submissions.map((s) =>
          s.id === submissionId
            ? { ...s, approval_status: 'approved' as const, reviewed_at: new Date().toISOString(), reviewed_by: teamLeadProfileId }
            : s
        ),
        loading: false,
      }));
      return { success: true, message: 'Attendance approved' };
    } catch (error: any) {
      set({ error: error.message, loading: false });
      return { success: false, message: error.message || 'Failed to approve' };
    }
  },

  rejectAttendance: async (submissionId: string, teamLeadProfileId: string) => {
    set({ loading: true, error: null });
    try {
      const submission = get().submissions.find((s) => s.id === submissionId);
      if (!submission) {
        set({ loading: false });
        return { success: false, message: 'Submission not found' };
      }
      if (submission.sent_to_team_lead_id !== teamLeadProfileId) {
        set({ loading: false });
        return { success: false, message: 'You can only reject submissions sent to you' };
      }
      if (submission.approval_status !== 'pending') {
        set({ loading: false });
        return { success: false, message: `Already ${submission.approval_status}` };
      }

      set((state) => ({
        submissions: state.submissions.map((s) =>
          s.id === submissionId
            ? { ...s, approval_status: 'rejected' as const, reviewed_at: new Date().toISOString(), reviewed_by: teamLeadProfileId }
            : s
        ),
        loading: false,
      }));
      return { success: true, message: 'Attendance rejected' };
    } catch (error: any) {
      set({ error: error.message, loading: false });
      return { success: false, message: error.message || 'Failed to reject' };
    }
  },

  seedMockPendingForTeamLead: (_teamLeadProfileId: string) => {
    // No mock seeding; pending submissions come from real data only.
  },
}));
