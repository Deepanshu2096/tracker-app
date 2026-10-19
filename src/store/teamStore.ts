import { supabase } from '@/integrations/supabase/client';
import { create } from 'zustand';
import { getAccessibleUserIds, filterProfilesByHierarchy, canAccessUser } from '@/lib/hierarchyUtils';
// Types based on your API structure
export interface TeamMember {
  id: string;
  full_name: string | null;
  email: string | null;
  user_id: string;
  org_id: string | null;
  role_id: string;
  status: string | null;
  birthday: string | null;
  doj: string | null;
  team_id?: string | null;
  role?: string | null;
  employee_number?: string | null;
  user_roles: {
    role: string;
  };
}

export interface Team {
  id: string;
  name: string;
  description: string | null;
  org_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PendingInvite {
  token: string;
  email: string;
  name: string | null;
  role: string;
  org_id: string | null;
  expires_at: string;
  accepted_at?: string | null;
}

/** Manager-created group: one Team Lead + members under that TL */
export interface Group {
  id: string;
  name: string;
  manager_id: string;
  team_lead_id: string;
  org_id: string;
  created_at: string;
  updated_at: string;
  team_lead_name?: string | null;
  member_count?: number;
}

// Helper function to check if a role can manage team members
const canManageTeamMembers = (role: string | null): boolean => {
  if (!role) return false;
  const normalizedRole = role.toLowerCase().trim();
  return ['team_lead', 'hr', 'manager', 'tl', 'teamlead'].includes(normalizedRole);
};

interface TeamState {
  // State
  loading: boolean;
  error: string | null;
  profiles: TeamMember[];
  teams: Team[];
  invites: PendingInvite[];
  invitesLoading: boolean;

  // Actions
  clearError: () => void;
  getProfiles: (orgId: string, teamId?: string | null) => Promise<void>;
  getTeams: (orgId: string) => Promise<void>;
  getTeamMembers: (orgId: string, teamId: string) => Promise<TeamMember[]>;
  getInvites: (orgId: string) => Promise<void>;
  resendInvite: (inv: PendingInvite, orgId: string) => Promise<{ success: boolean; message: string }>;
  // Team members management (for team_lead, HR, manager)
  getTeamMembersFromProfile: (userId: string) => Promise<string[]>;
  addTeamMember: (memberUserId: string) => Promise<void>;
  removeTeamMember: (memberUserId: string) => Promise<void>;
  updateTeamMembers: (memberUserIds: string[]) => Promise<void>;
  addUserToTeam: (userId: string, teamId: string) => Promise<void>;
  removeUserFromTeam: (userId: string, teamId?: string) => Promise<void>;
  getProjectAnnotators: (orgId: string, projectId: string) => Promise<TeamMember[]>;
  updateMemberStatus: (memberId: string, status: string) => Promise<void>;
  updateMemberRole: (memberId: string, newRole: string) => Promise<void>;
  sendInvite: (email: string, role: string, name: string, orgId: string, teamId?: string | null) => Promise<{success: boolean, message: string}>;
  // Project team (ACL) helpers
  getProjectMembers: (orgId: string, projectId: string) => Promise<TeamMember[]>;
  addMembersToProject: (orgId: string, projectId: string, userIds: string[]) => Promise<void>;
  removeMemberFromProject: (orgId: string, projectId: string, userId: string) => Promise<void>;
  // Remove member from organization
  removeMember: (orgId: string, userId: string) => Promise<void>;
  // Team Lead (TL) management (admin/manager only)
  teamLeads: TeamMember[];
  getTeamLeads: (orgId: string) => Promise<void>;
  getMembersByTeamLead: (tlProfileId: string) => Promise<TeamMember[]>;
  getAssignableEmployeesForTL: (orgId: string, excludeUserIds: string[]) => Promise<TeamMember[]>;
  assignEmployeeToTeamLead: (employeeUserId: string, tlProfileId: string) => Promise<void>;
  removeEmployeeFromTeamLead: (employeeUserId: string) => Promise<void>;
  reassignEmployeeToTeamLead: (employeeUserId: string, newTlProfileId: string) => Promise<void>;
  // Groups (Manager creates group = one TL + members under that TL)
  groups: Group[];
  getGroups: (orgId: string) => Promise<void>;
  createGroup: (name: string, teamLeadProfileId: string, orgId: string) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;
}

// Helper: admin, manager, or team lead can manage TL assignments (team lead only their own group)
const canManageTLAssignments = (role: string | null): boolean => {
  if (!role) return false;
  const r = role.toLowerCase().trim();
  return r === 'admin' || r === 'manager' || r === 'team_lead' || r === 'tl' || r === 'teamlead';
};

export const useTeamStore = create<TeamState>((set, get) => ({
  // Initial state
  profiles: [],
  teams: [],
  invites: [],
  invitesLoading: false,
  teamLeads: [],
  groups: [],
  loading: false,
  error: null,

  clearError: () => {
    set({ error: null });
  },

  getInvites: async (orgId: string) => {
    if (!orgId) {
      set({ invites: [], invitesLoading: false });
      return;
    }
    set({ invitesLoading: true });
    try {
      const { data, error } = await supabase
        .from('invites')
        .select('token, email, name, role, org_id, expires_at, accepted_at')
        .eq('org_id', orgId)
        .order('expires_at', { ascending: false });

      if (error) throw error;
      const invitesList = (data ?? []) as PendingInvite[];
      set({ invites: invitesList, invitesLoading: false });
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/ae5c929b-a368-47a0-9b09-fb93832ffb13', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'teamStore.ts:getInvites', message: 'Pending invites loaded', data: { orgId, count: invitesList.length, firstTokenPrefix: invitesList[0]?.token?.slice(0, 8) }, timestamp: Date.now(), hypothesisId: 'H3-H4' }) }).catch(() => {});
      // #endregion
    } catch (err: any) {
      console.error('Error fetching invites:', err);
      set({ invites: [], invitesLoading: false });
    }
  },

  resendInvite: async (inv: PendingInvite, orgId: string) => {
    set({ loading: true, error: null });
    try {
      const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { error: updateError } = await supabase
        .from('invites')
        .update({ expires_at: newExpiresAt })
        .eq('token', inv.token)
        .eq('org_id', orgId);

      if (updateError) throw updateError;

      const inviteLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${inv.token}`;
      const { error: emailError } = await supabase.functions.invoke('send-invite', {
        body: {
          name: inv.name ?? '',
          email: inv.email,
          role: inv.role,
          inviteLink,
        },
      });

      if (emailError) {
        set({ loading: false });
        return { success: false, message: emailError.message || 'Failed to send email' };
      }

      await get().getInvites(orgId);
      set({ loading: false });
      return { success: true, message: 'Invite resent successfully' };
    } catch (err: any) {
      set({ error: err.message, loading: false });
      return { success: false, message: err.message || 'Failed to resend invite' };
    }
  },

  // Get team members from current user's profile team_members JSON field
  getTeamMembersFromProfile: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('team_members')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data || !data.team_members) {
        return [];
      }

      // Ensure team_members is an array and extract user IDs
      const teamMembers = Array.isArray(data.team_members) 
        ? data.team_members 
        : [];
      
      return teamMembers.map((id: any) => String(id));
    } catch (error: any) {
      console.error('Error fetching team members from profile:', error);
      return [];
    }
  },

  // Add a user to current user's team_members array
  addTeamMember: async (memberUserId: string) => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      // Get current user's profile to check role
      const { data: currentProfile, error: profileError } = await supabase
        .from('profiles')
        .select('role, team_members')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError || !currentProfile) {
        throw new Error('Could not fetch your profile');
      }

      // Check if user can manage team members
      if (!canManageTeamMembers(currentProfile.role)) {
        throw new Error('You do not have permission to manage team members');
      }

      // Get current team_members array
      const currentMembers = Array.isArray(currentProfile.team_members)
        ? currentProfile.team_members.map((id: any) => String(id))
        : [];

      // Check if user is already in the list
      if (currentMembers.includes(memberUserId)) {
        return; // Already added
      }

      // Add the new member
      const updatedMembers = [...currentMembers, memberUserId];

      // Update the profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ team_members: updatedMembers })
        .eq('user_id', user.id);

      if (updateError) {
        throw updateError;
      }
    } catch (error: any) {
      console.error('Error adding team member:', error);
      throw error;
    }
  },

  // Remove a user from current user's team_members array
  removeTeamMember: async (memberUserId: string) => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      // Get current user's profile to check role
      const { data: currentProfile, error: profileError } = await supabase
        .from('profiles')
        .select('role, team_members')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError || !currentProfile) {
        throw new Error('Could not fetch your profile');
      }

      // Check if user can manage team members
      if (!canManageTeamMembers(currentProfile.role)) {
        throw new Error('You do not have permission to manage team members');
      }

      // Get current team_members array
      const currentMembers = Array.isArray(currentProfile.team_members)
        ? currentProfile.team_members.map((id: any) => String(id))
        : [];

      // Remove the member
      const updatedMembers = currentMembers.filter((id: string) => id !== memberUserId);

      // Update the profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ team_members: updatedMembers })
        .eq('user_id', user.id);

      if (updateError) {
        throw updateError;
      }
    } catch (error: any) {
      console.error('Error removing team member:', error);
      throw error;
    }
  },

  // Replace entire team_members array
  updateTeamMembers: async (memberUserIds: string[]) => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      // Get current user's profile to check role
      const { data: currentProfile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError || !currentProfile) {
        throw new Error('Could not fetch your profile');
      }

      // Check if user can manage team members
      if (!canManageTeamMembers(currentProfile.role)) {
        throw new Error('You do not have permission to manage team members');
      }

      // Ensure all IDs are strings and remove duplicates
      const uniqueMemberIds = [...new Set(memberUserIds.map(id => String(id)))];

      // Update the profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ team_members: uniqueMemberIds })
        .eq('user_id', user.id);

      if (updateError) {
        throw updateError;
      }
    } catch (error: any) {
      console.error('Error updating team members:', error);
      throw error;
    }
  },

  getTeams: async (orgId: string) => {
    set({ loading: true, error: null });
    try {
      // Get current authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      // Get current user's profile to check role and team
      const { data: currentUserProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, team_id, manager_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError || !currentUserProfile) {
        throw new Error('Could not fetch your profile');
      }

      const currentUserRole = currentUserProfile.role?.toLowerCase();

      let teamsQuery = supabase
        .from('teams')
        .select('*')
        .eq('org_id', orgId);

      // Filter teams based on role
      // Admin and Manager: Can see all team groups in the organization
      if (currentUserRole === 'admin' || currentUserRole === 'manager') {
        // No additional filter - see all teams in org
      }
      // Team Lead: Can see only their own team
      else if (currentUserRole === 'team_lead' || currentUserRole === 'tl' || currentUserRole === 'teamlead') {
        if (currentUserProfile.team_id) {
          teamsQuery = teamsQuery.eq('id', currentUserProfile.team_id);
        } else {
          // If TL has no team assigned, they can't see any teams
          set({ teams: [], loading: false });
          return;
        }
      }
      // SME: Can see only their own team (so they can use Teams page and send invites)
      else if (currentUserRole === 'sme') {
        if (currentUserProfile.team_id) {
          teamsQuery = teamsQuery.eq('id', currentUserProfile.team_id);
        } else {
          set({ teams: [], loading: false });
          return;
        }
      }
      // Other roles: Cannot see teams
      else {
        set({ teams: [], loading: false });
        return;
      }

      const { data, error } = await teamsQuery.order('name', { ascending: true });

      if (error) {
        throw error;
      }

      set({ teams: data || [], loading: false });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to fetch teams',
        loading: false,
      });
    }
  },

  getTeamMembers: async (orgId: string, teamId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, user_id, org_id, role, status, birthday, doj, team_id, employee_number')
        .eq('org_id', orgId)
        .eq('team_id', teamId)
        .order('full_name', { ascending: true });

      if (error) {
        throw error;
      }

      return (data || []).map(profile => ({
        ...profile,
        role_id: profile.role || '',
        user_roles: {
          role: profile.role || ''
        }
      }));
    } catch (error: any) {
      console.error('Error fetching team members:', error);
      return [];
    }
  },

  getProfiles: async (orgId: string, teamId?: string | null) => {
    set({ loading: true, error: null });
    try {
      // Get current authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      // Get current user's profile to check role and team_members
      const { data: currentUserProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, team_members')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError || !currentUserProfile) {
        throw new Error('Could not fetch your profile');
      }

      const currentRole = currentUserProfile.role ? String(currentUserProfile.role).toLowerCase().trim() : '';
      const isAdmin = currentRole === 'admin';
      const isManager = currentRole === 'manager';
      const canManage = canManageTeamMembers(currentUserProfile.role);

      let data: any[] | null = null;
      let error: any = null;

      // Admin: See all users in the organization
      if (isAdmin) {
        let query = supabase
          .from('profiles')
          .select('id, full_name, email, user_id, org_id, role, status, birthday, doj, team_id, manager_id, team_lead_id, employee_number')
          .eq('org_id', orgId);

        // Legacy: Filter by single team if specified (for backward compatibility)
        if (teamId) {
          query = query.eq('team_id', teamId);
        }

        const result = await query;
        
        if (result.error) {
          if (result.error.code === '21000' || result.error.message?.includes('more than one row')) {
            set({
              profiles: [],
              loading: false,
              error: 'Database error: Unable to fetch profiles due to database configuration issue. Please contact administrator.'
            });
            return;
          }
          error = result.error;
        } else {
          data = result.data;
        }
      }
      // Manager: See all team leaders and team members under their hierarchy (direct reports + reports under their TLs)
      else if (isManager) {
        const { data: tlProfiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('org_id', orgId)
          .eq('manager_id', currentUserProfile.id)
          .eq('role', 'team_lead');
        const tlIds = (tlProfiles || []).map((p: { id: string }) => p.id);

        let query = supabase
          .from('profiles')
          .select('id, full_name, email, user_id, org_id, role, status, birthday, doj, team_id, manager_id, team_lead_id, employee_number')
          .eq('org_id', orgId);

        if (tlIds.length > 0) {
          query = query.or(`manager_id.eq.${currentUserProfile.id},team_lead_id.in.(${tlIds.join(',')})`);
        } else {
          query = query.eq('manager_id', currentUserProfile.id);
        }

        if (teamId) {
          query = query.eq('team_id', teamId);
        }

        const result = await query;
        if (result.error) {
          if (result.error.code === '21000' || result.error.message?.includes('more than one row')) {
            set({ profiles: [], loading: false, error: 'Database error. Please contact administrator.' });
            return;
          }
          error = result.error;
        } else {
          data = result.data;
        }
      }
      // Team Lead, HR: filter by team_members JSON field (only their assigned members)
      else if (canManage) {
        const teamMemberIds = Array.isArray(currentUserProfile.team_members)
          ? currentUserProfile.team_members.map((id: any) => String(id))
          : [];

        let query = supabase
          .from('profiles')
          .select('id, full_name, email, user_id, org_id, role, status, birthday, doj, team_id, manager_id, team_lead_id, employee_number')
          .eq('org_id', orgId);

        if (teamMemberIds.length > 0) {
          query = query.in('user_id', teamMemberIds);
        } else {
          set({ profiles: [], loading: false });
          return;
        }

        if (teamId) {
          query = query.eq('team_id', teamId);
        }

        const result = await query;
        if (result.error) {
          if (result.error.code === '21000' || result.error.message?.includes('more than one row')) {
            set({ profiles: [], loading: false, error: 'Database error. Please contact administrator.' });
            return;
          }
          error = result.error;
        } else {
          data = result.data;
        }
      } else {
        // For other roles: only show their own profile
        const result = await supabase
          .from('profiles')
          .select('id, full_name, email, user_id, org_id, role, status, birthday, doj, team_id, manager_id, team_lead_id, employee_number')
          .eq('org_id', orgId)
          .eq('user_id', user.id);

        if (result.error) {
          error = result.error;
        } else {
          data = result.data;
        }
      }

      if (error) {
        throw error;
      }

      // Sort manually if we got data
      const sortedData = (data || []).sort((a, b) => {
        const nameA = (a.full_name || a.email || '').toLowerCase();
        const nameB = (b.full_name || b.email || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });

      // Transform data to match TeamMember interface
      const transformedData = sortedData.map(profile => ({
        ...profile,
        role_id: profile.role || '',
        user_roles: {
          role: profile.role || ''
        }
      }));

      set({
        profiles: transformedData,
        loading: false
      });
    } catch (error: any) {
      // If it's the subquery error, handle gracefully
      if (error.code === '21000' || error.message?.includes('more than one row')) {
        set({
          profiles: [],
          error: 'Database configuration issue detected. Please contact your administrator to fix the database triggers/constraints.',
          loading: false
        });
      } else {
        set({
          error: error.message || 'Failed to fetch profiles',
          loading: false
        });
      }
    }
  },

  getProjectAnnotators: async (orgId: string, projectId: string) => {
    try {
      // 1) Fetch user_ids from ACL for this project who are annotators
      const { data: aclRows, error: aclError } = await supabase
        .from('resource_acl')
        .select('user_id')
        .eq('org_id', orgId)
        .eq('resource_type', 'project')
        .eq('resource_id', projectId);

      if (aclError) {
        throw aclError;
      }

      const userIds = (aclRows || []).map(r => r.user_id);
      if (userIds.length === 0) {
        return [];
      }

      // 2) Fetch profiles for those user_ids who are active annotators
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          user_id,
          org_id,
          role,
          status,
          birthday,
          doj
        `)
        .in('user_id', userIds)
        .eq('org_id', orgId)
        .eq('status', 'active')
        .eq('role', 'annotator')
        .order('name', { ascending: true });

      if (error) {
        throw error;
      }

      // Transform data to match TeamMember interface
      const transformedData = (data || []).map(profile => ({
        ...profile,
        role_id: profile.role || '',
        user_roles: {
          role: profile.role || ''
        }
      }));

      return transformedData;
    } catch (error: any) {
      return [];
    }
  },

  updateMemberStatus: async (memberId: string, status: string) => {
    set({ loading: true, error: null });
    try {
      // Get current authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      // Check if user can access this member
      const targetProfile = await supabase
        .from('profiles')
        .select('user_id')
        .eq('id', memberId)
        .maybeSingle();

      if (targetProfile.data) {
        const hasAccess = await canAccessUser(user.id, targetProfile.data.user_id);
        if (!hasAccess) {
          throw new Error('You do not have permission to update this member');
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update({ status })
        .eq('id', memberId);

      if (error) {
        throw error;
      }

      // Update the local state
      set((state) => ({
        profiles: state.profiles.map(profile =>
          profile.id === memberId
            ? { ...profile, status }
            : profile
        ),
        loading: false
      }));
    } catch (error: any) {
      set({
        error: error.message || 'Failed to update member status',
        loading: false
             });
     }
   },

  updateMemberRole: async (memberId: string, newRole: string) => {
    set({ loading: true, error: null });
    try {
      // Get current authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      // Get current user's profile to check role
      const { data: currentUserProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError || !currentUserProfile) {
        throw new Error('Could not verify your permissions');
      }

      // Check if user can assign roles (only admins and managers)
      const currentUserRole = currentUserProfile.role?.toLowerCase();
      if (!currentUserRole || !['admin', 'manager'].includes(currentUserRole)) {
        throw new Error('You do not have permission to assign roles');
      }

      // Check if user can access this member
      const { data: targetProfile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('id', memberId)
        .maybeSingle();

      if (targetProfile) {
        const hasAccess = await canAccessUser(user.id, targetProfile.user_id);
        if (!hasAccess) {
          throw new Error('You do not have permission to update this member');
        }
      }

      // Update the role in the database
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) {
        throw error;
      }

      // Update the local state
      set((state) => ({
        profiles: state.profiles.map(profile =>
          profile.id === memberId
            ? { 
                ...profile, 
                role: newRole,
                role_id: newRole,
                user_roles: {
                  role: newRole
                }
              }
            : profile
        ),
        loading: false
      }));
    } catch (error: any) {
      set({
        error: error.message || 'Failed to update member role',
        loading: false
      });
      throw error;
    }
  },
 
  addUserToTeam: async (userId: string, teamId: string) => {
    set({ loading: true, error: null });
    try {
      // Get current authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      // Verify the team exists and user has access to it
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('id, org_id')
        .eq('id', teamId)
        .maybeSingle();

      if (teamError || !teamData) {
        throw new Error('Team not found or you do not have access to it');
      }

      // Get current user's profile to check role and verify access to this team
      const { data: currentUserProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, team_id, org_id, manager_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError || !currentUserProfile) {
        throw new Error('Could not verify your permissions');
      }

      // Verify org_id matches
      if (currentUserProfile.org_id !== teamData.org_id) {
        throw new Error('Team is not in your organization');
      }

      // Verify user can manage this specific team
      const currentUserRole = currentUserProfile.role?.toLowerCase();
      if (currentUserRole === 'admin') {
        // Admin can add to any team
      } else if (currentUserRole === 'manager') {
        // Manager can add to teams they manage
        // Check if this team has members that report to this manager
        const { data: teamMembers } = await supabase
          .from('profiles')
          .select('manager_id, team_lead_id')
          .eq('team_id', teamId)
          .eq('org_id', teamData.org_id)
          .limit(1);

        const hasAccess = teamMembers?.some(m => 
          m.manager_id === currentUserProfile.id || 
          (m.team_lead_id && teamMembers.find(tm => tm.manager_id === currentUserProfile.id))
        );
        
        // Also check if user is adding someone they manage
        const { data: targetUser } = await supabase
          .from('profiles')
          .select('manager_id, team_lead_id')
          .eq('user_id', userId)
          .maybeSingle();

        const canManageTarget = targetUser && (
          targetUser.manager_id === currentUserProfile.id ||
          targetUser.team_lead_id === currentUserProfile.id ||
          (targetUser.team_lead_id && teamMembers?.find(m => m.id === targetUser.team_lead_id && m.manager_id === currentUserProfile.id))
        );

        if (!hasAccess && !canManageTarget) {
          throw new Error('You can only add members to teams you manage');
        }
      } else if (currentUserRole === 'team_lead' || currentUserRole === 'tl' || currentUserRole === 'teamlead') {
        // Team Lead can only add to their own team
        if (currentUserProfile.team_id !== teamId) {
          throw new Error('You can only add members to your own team');
        }
      } else {
        throw new Error('You do not have permission to add users to teams');
      }

      // Add user to the team
      const { error } = await supabase
        .from('profiles')
        .update({ team_id: teamId })
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      set({ loading: false });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to add user to team',
        loading: false,
      });
      throw error; // Re-throw so caller can handle
    }
  },

  removeUserFromTeam: async (userId: string, teamId?: string) => {
    set({ loading: true, error: null });
    try {
      // Get current authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      // Get target user's profile to verify team
      const { data: targetProfile, error: targetError } = await supabase
        .from('profiles')
        .select('id, team_id, manager_id, team_lead_id, org_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (targetError || !targetProfile) {
        throw new Error('Target user not found');
      }

      // Verify user is actually in a team before removing
      if (!targetProfile.team_id) {
        throw new Error('User is not in any team');
      }

      // If teamId is provided, verify the user is in that specific team
      if (teamId && targetProfile.team_id !== teamId) {
        throw new Error('User is not in the selected team');
      }

      // Get current user's profile to check role and verify access to this team
      const { data: currentUserProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, team_id, org_id, manager_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError || !currentUserProfile) {
        throw new Error('Could not verify your permissions');
      }

      // Verify org_id matches
      if (currentUserProfile.org_id !== targetProfile.org_id) {
        throw new Error('User is not in your organization');
      }

      const currentUserRole = currentUserProfile.role?.toLowerCase();
      const targetTeamId = teamId || targetProfile.team_id;

      // Verify user can manage this specific team
      if (currentUserRole === 'admin') {
        // Admin can remove from any team they select
        // No additional validation needed
      } else if (currentUserRole === 'manager') {
        // Manager can remove users from teams they manage
        // Check if target user reports to this manager (directly or through TL)
        const canManage = targetProfile.manager_id === currentUserProfile.id ||
          (targetProfile.team_lead_id && targetProfile.team_lead_id === currentUserProfile.id);
        
        if (!canManage) {
          // Check if TL reports to this manager
          if (targetProfile.team_lead_id) {
            const { data: tlProfile } = await supabase
              .from('profiles')
              .select('manager_id')
              .eq('id', targetProfile.team_lead_id)
              .maybeSingle();
            
            if (tlProfile?.manager_id !== currentUserProfile.id) {
              throw new Error('You can only remove users from teams you manage');
            }
          } else {
            throw new Error('You can only remove users from teams you manage');
          }
        }
      } else if (currentUserRole === 'team_lead' || currentUserRole === 'tl' || currentUserRole === 'teamlead') {
        // Team Lead can only remove users from their own team
        if (currentUserProfile.team_id !== targetTeamId || targetProfile.team_id !== targetTeamId) {
          throw new Error('You can only remove users from your own selected team');
        }
        // Also verify the user reports to this TL
        if (targetProfile.team_lead_id !== currentUserProfile.id) {
          throw new Error('You can only remove users that report to you');
        }
      } else {
        throw new Error('You do not have permission to remove users from teams');
      }

      // Remove user from the team (set team_id to null - doesn't delete user)
      const { error } = await supabase
        .from('profiles')
        .update({ team_id: null })
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      set({ loading: false });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to remove user from team',
        loading: false,
      });
      throw error; // Re-throw so caller can handle
    }
  },

   sendInvite: async (email: string, role: string, name: string, orgId: string, teamId?: string | null) => {
     set({ loading: true, error: null });
     // #region agent log
     fetch('http://127.0.0.1:7243/ingest/ae5c929b-a368-47a0-9b09-fb93832ffb13', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'teamStore.ts:sendInvite_entry', message: 'sendInvite called', data: { email, orgId, role, nameLength: name?.length }, timestamp: Date.now(), hypothesisId: 'H1' }) }).catch(() => {});
     // #endregion
     try {
       // Validate orgId exists
       if (!orgId || orgId.trim().length === 0) {
         throw new Error('Organization ID is required');
       }

      // Check if organization exists
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('id')
        .eq('id', orgId)
        .maybeSingle();

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/ae5c929b-a368-47a0-9b09-fb93832ffb13', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'teamStore.ts:sendInvite_orgCheck', message: 'Org check result', data: { orgId, orgFound: Boolean(orgData), orgError: orgError?.message ?? null }, timestamp: Date.now(), hypothesisId: 'H2' }) }).catch(() => {});
      // #endregion
      console.log('orgData:', orgData);
      console.log('orgError:', orgError);
      console.log('orgId being checked:', orgId);

      if (orgError) {
        console.error('Error checking organization:', orgError);
        throw new Error(`Failed to verify organization: ${orgError.message}`);
      }

      if (!orgData) {
        console.error('Organization not found for orgId:', orgId);
        throw new Error(`Organization with ID ${orgId} does not exist. Please create the organization first.`);
      }

       // Validate and sanitize email input
       if (typeof email !== 'string') {
         throw new Error('Email must be a string');
       }
       
       const sanitizedEmail = email.trim();
       
       if (!sanitizedEmail || sanitizedEmail.length === 0) {
         throw new Error('Email cannot be empty');
       }
       
       if (sanitizedEmail.length > 320) {
         throw new Error('Email must be 320 characters or less');
       }
       
       // Validate email format
       const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
       if (!emailRegex.test(sanitizedEmail)) {
         throw new Error('Invalid email format');
       }
       
       // Ensure name and role are strings
       const sanitizedName = typeof name === 'string' ? name.trim() : String(name || '').trim();
       const sanitizedRole = typeof role === 'string' ? role.trim() : String(role || '').trim();

       // Invite is always sent. If an invite row exists (pending or accepted), update expiry and resend; otherwise insert new.
       // When the recipient opens the link, the invite page may show "expired", "already accepted", or "already exists" as appropriate.
       const { data: existingInvite, error: existingInviteError } = await supabase
         .from('invites')
         .select('token')
         .eq('org_id', orgId)
         .ilike('email', sanitizedEmail)
         .order('created_at', { ascending: false })
         .limit(1)
         .maybeSingle();

       if (existingInviteError) {
         console.error('Error checking existing invite:', existingInviteError);
         throw new Error('Failed to verify invite');
       }

       let token: string;
       const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

       if (existingInvite?.token) {
         // Update expiry and optionally name/role so the resent email is correct; then send email
         const { error: updateError } = await supabase
           .from('invites')
           .update({
             expires_at: newExpiresAt,
             name: sanitizedName,
             role: sanitizedRole as any
           })
           .eq('org_id', orgId)
           .ilike('email', sanitizedEmail);

         if (updateError) {
           console.error('Error updating invite:', updateError);
           throw new Error('Failed to update invite');
         }
         token = existingInvite.token;
       } else {
         // Insert new invite
         const { data: insertData, error } = await supabase
           .from('invites')
           .insert({
             email: sanitizedEmail,
             role: sanitizedRole as any,
             org_id: orgId,
             name: sanitizedName
           })
           .select()
           .single();

         if (error) {
           if (error.code === '23503' || error.message?.includes('foreign key constraint')) {
             throw new Error(`Organization with ID ${orgId} does not exist. Please create the organization first.`);
           }
           throw error;
         }
         if (!insertData?.token) throw new Error('Invite created but no token returned');
         token = insertData.token;
       }

       // Send invite email in all cases (new or updated invite)
       const inviteLink = `${window.location.origin}/invite/${token}`;
       try {
         const safePayload = {
           name: sanitizedName,
           email: sanitizedEmail,
           role: sanitizedRole,
           inviteLink: typeof inviteLink === 'string' ? inviteLink : String(inviteLink)
         };
         await supabase.functions.invoke('send-invite', { body: safePayload });
       } catch {
         // Invite row is created/updated; email failure is non-blocking
       }

       set({ loading: false });
       return { success: true, message: 'Invitation sent successfully.' };
     } catch (error: any) {
       // #region agent log
       fetch('http://127.0.0.1:7243/ingest/ae5c929b-a368-47a0-9b09-fb93832ffb13', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'teamStore.ts:sendInvite_catch', message: 'sendInvite threw', data: { message: error?.message?.slice(0, 120) }, timestamp: Date.now(), hypothesisId: 'H1-H2-H3' }) }).catch(() => {});
       // #endregion
       set({
         error: error.message || 'Failed to send invite',
         loading: false
       });
       return { success: false, message: error.message || 'Failed to send invite' };
     }
   },

  // Project team (ACL) helpers
  getProjectMembers: async (orgId: string, projectId: string) => {
    try {
      // 1) Fetch user_ids from ACL for this project
      const { data: aclRows, error: aclError } = await supabase
        .from('resource_acl')
        .select('user_id')
        .eq('org_id', orgId)
        .eq('resource_type', 'project')
        .eq('resource_id', projectId);

      if (aclError) {
        throw aclError;
      }

      const userIds = (aclRows || []).map(r => r.user_id);
      if (userIds.length === 0) {
        return [];
      }

      // 2) Fetch profiles for those user_ids
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          user_id,
          org_id,
          role,
          status,
          birthday,
          doj,
          employee_number
        `)
        .in('user_id', userIds)
        .order('full_name', { ascending: true });

      if (profilesError) {
        throw profilesError;
      }

      // Transform data to match TeamMember interface
      const transformedData = (profilesData || []).map(profile => ({
        ...profile,
        role_id: profile.role || '',
        user_roles: {
          role: profile.role || ''
        }
      }));

      return transformedData;
    } catch (error) {
      console.error('Error fetching project members:', error);
      return [];
    }
  },

  addMembersToProject: async (orgId: string, projectId: string, userIds: string[]) => {
    if (!userIds || userIds.length === 0) return;
    set({ loading: true, error: null });
    try {
      const rows = userIds.map(userId => ({
        id: crypto.randomUUID(),
        org_id: orgId,
        resource_id: projectId,
        resource_type: 'project',
        user_id: userId,
      }));

      const { error } = await supabase
        .from('resource_acl')
        .insert(rows);

      if (error) {
        throw error;
      }
    } catch (error: any) {
      set({ error: error.message || 'Failed to add members to project' });
    } finally {
      set({ loading: false });
    }
  },

  removeMemberFromProject: async (orgId: string, projectId: string, userId: string) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('resource_acl')
        .delete()
        .eq('org_id', orgId)
        .eq('resource_type', 'project')
        .eq('resource_id', projectId)
        .eq('user_id', userId);

      if (error) {
        throw error;
      }
    } catch (error: any) {
      set({ error: error.message || 'Failed to remove member from project' });
    } finally {
      set({ loading: false });
    }
  },

  removeMember: async (orgId: string, userId: string) => {
    set({ loading: true, error: null });
    try {
      // Get current authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      // Check if user can remove members (admin or manager)
      const currentUserProfile = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      const currentUserRole = currentUserProfile.data?.role?.toLowerCase();
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/ae5c929b-a368-47a0-9b09-fb93832ffb13', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'teamStore.ts:removeMember', message: 'removeMember entry', data: { orgId, userId, currentUserRole: currentUserRole ?? null }, timestamp: Date.now(), hypothesisId: 'H3-H5' }) }).catch(() => {});
      // #endregion
      if (currentUserRole !== 'admin' && currentUserRole !== 'manager') {
        throw new Error('Only admins and managers can remove members');
      }

      // Check access to the target user
      const hasAccess = await canAccessUser(user.id, userId);
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/ae5c929b-a368-47a0-9b09-fb93832ffb13', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'teamStore.ts:removeMember_hasAccess', message: 'hasAccess result', data: { hasAccess, userId }, timestamp: Date.now(), hypothesisId: 'H3' }) }).catch(() => {});
      // #endregion
      if (!hasAccess) {
        throw new Error('You do not have permission to remove this member');
      }

      // Remove ACL entries for this user in this org (best-effort; table may not exist)
      const { error: aclError } = await supabase
        .from('resource_acl')
        .delete()
        .eq('org_id', orgId)
        .eq('user_id', userId);

      if (aclError) {
        const msg = aclError.message ?? '';
        const tableMissing = /schema cache|relation.*does not exist|resource_acl/i.test(msg);
        if (tableMissing) {
          console.warn('resource_acl table not found; skipping ACL cleanup:', msg);
        } else {
          throw aclError;
        }
      }

      // Then, remove the profile from the organization (set org_id to null)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ org_id: null })
        .eq('user_id', userId)
        .eq('org_id', orgId);

      if (profileError) {
        throw profileError;
      }

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/ae5c929b-a368-47a0-9b09-fb93832ffb13', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'teamStore.ts:removeMember_success', message: 'removeMember completed', data: { userId }, timestamp: Date.now(), hypothesisId: 'H4' }) }).catch(() => {});
      // #endregion
      // Update local state - remove the member from profiles
      set((state) => ({
        profiles: state.profiles.filter(profile => profile.user_id !== userId),
        loading: false
      }));
    } catch (error: any) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/ae5c929b-a368-47a0-9b09-fb93832ffb13', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'teamStore.ts:removeMember_catch', message: 'removeMember error', data: { errorMessage: error?.message ?? String(error) }, timestamp: Date.now(), hypothesisId: 'H3' }) }).catch(() => {});
      // #endregion
      set({ 
        error: error.message || 'Failed to remove member from organization',
        loading: false 
      });
      throw error;
    }
  },

  // --- Team Lead (TL) management (admin/manager only) ---
  getTeamLeads: async (orgId: string) => {
    set({ loading: true, error: null });
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/ae5c929b-a368-47a0-9b09-fb93832ffb13', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'teamStore.ts:getTeamLeads:entry', message: 'getTeamLeads called', data: { orgId }, timestamp: Date.now(), hypothesisId: 'H2-H4' }) }).catch(() => {});
    // #endregion
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }
      const { data: currentProfile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/ae5c929b-a368-47a0-9b09-fb93832ffb13', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'teamStore.ts:getTeamLeads:afterProfile', message: 'Current user profile check', data: { profileError: profileError?.message ?? null, hasProfile: !!currentProfile, profileRole: currentProfile?.role ?? null, canManage: currentProfile ? canManageTLAssignments(currentProfile.role) : false }, timestamp: Date.now(), hypothesisId: 'H3' }) }).catch(() => {});
      // #endregion
      if (profileError || !currentProfile || !canManageTLAssignments(currentProfile.role)) {
        set({ teamLeads: [], loading: false });
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, user_id, org_id, role, status, team_id, manager_id, team_lead_id, employee_number')
        .eq('org_id', orgId)
        .eq('role', 'team_lead')
        .order('full_name', { ascending: true });

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/ae5c929b-a368-47a0-9b09-fb93832ffb13', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'teamStore.ts:getTeamLeads:afterQuery', message: 'TL query result', data: { error: error?.message ?? null, rowCount: (data || []).length }, timestamp: Date.now(), hypothesisId: 'H4' }) }).catch(() => {});
      // #endregion
      if (error) throw error;
      const transformed = (data || []).map(p => ({
        ...p,
        role_id: p.role || '',
        user_roles: { role: p.role || '' }
      }));
      set({ teamLeads: transformed, loading: false });
    } catch (error: any) {
      set({ teamLeads: [], error: error.message || 'Failed to fetch team leads', loading: false });
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/ae5c929b-a368-47a0-9b09-fb93832ffb13', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'teamStore.ts:getTeamLeads:catch', message: 'getTeamLeads error', data: { errorMessage: error?.message }, timestamp: Date.now(), hypothesisId: 'H4' }) }).catch(() => {});
      // #endregion
    }
  },

  getMembersByTeamLead: async (tlProfileId: string) => {
    try {
      // Members are those with team_lead_id = tlProfileId, or in TL's team_members
      const { data: tlProfile, error: tlError } = await supabase
        .from('profiles')
        .select('user_id, team_members')
        .eq('id', tlProfileId)
        .maybeSingle();
      if (tlError || !tlProfile) return [];

      const teamMemberIds = Array.isArray(tlProfile.team_members)
        ? tlProfile.team_members.map((id: any) => String(id))
        : [];

      // Also get anyone with team_lead_id = tlProfileId (in case not in team_members)
      const { data: byLeadId, error: e2 } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('team_lead_id', tlProfileId);
      const fromLeadId = (byLeadId || []).map((r: { user_id: string }) => r.user_id);
      const allUserIds = [...new Set([...teamMemberIds, ...fromLeadId])];
      if (allUserIds.length === 0) return [];

      const { data: profilesData, error: e3 } = await supabase
        .from('profiles')
        .select('id, full_name, email, user_id, org_id, role, status, birthday, doj, team_id, manager_id, team_lead_id, employee_number')
        .in('user_id', allUserIds)
        .order('full_name', { ascending: true });
      if (e3 || !profilesData) return [];
      return profilesData.map(p => ({
        ...p,
        role_id: p.role || '',
        user_roles: { role: p.role || '' }
      }));
    } catch (error: any) {
      console.error('Error fetching members by team lead:', error);
      return [];
    }
  },

  getAssignableEmployeesForTL: async (orgId: string, excludeUserIds: string[]) => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return [];
      const { data: currentProfile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      if (profileError || !currentProfile || !canManageTLAssignments(currentProfile.role)) return [];

      const excludeSet = new Set(excludeUserIds.map(id => String(id)));
      const tlRoles = ['team_lead', 'tl', 'teamlead'];
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, user_id, org_id, role, status, birthday, doj, team_id, manager_id, team_lead_id, employee_number')
        .eq('org_id', orgId)
        .order('full_name', { ascending: true });
      if (error) return [];
      const filtered = (data || []).filter(
        (p: { user_id: string; role?: string | null }) =>
          !excludeSet.has(String(p.user_id)) &&
          !tlRoles.includes((p.role || '').toLowerCase())
      );
      return filtered.map((p: any) => ({
        ...p,
        role_id: p.role || '',
        user_roles: { role: p.role || '' }
      }));
    } catch (error: any) {
      console.error('Error fetching assignable employees:', error);
      return [];
    }
  },

  assignEmployeeToTeamLead: async (employeeUserId: string, tlProfileId: string) => {
    set({ loading: true, error: null });
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('User not authenticated');
      const { data: currentProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, org_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (profileError || !currentProfile || !canManageTLAssignments(currentProfile.role)) {
        throw new Error('Only admin or manager can assign employees to a team lead');
      }
      const { data: tlProfile, error: tlErr } = await supabase
        .from('profiles')
        .select('id, user_id, org_id, team_members')
        .eq('id', tlProfileId)
        .maybeSingle();
      if (tlErr || !tlProfile) throw new Error('Team lead not found');
      if (tlProfile.org_id !== currentProfile.org_id) throw new Error('Team lead is not in your organization');

      const currentMembers = Array.isArray(tlProfile.team_members)
        ? tlProfile.team_members.map((id: any) => String(id))
        : [];
      if (currentMembers.includes(employeeUserId)) return; // already assigned

      const updatedMembers = [...currentMembers, employeeUserId];
      const { error: updateTlErr } = await supabase
        .from('profiles')
        .update({ team_members: updatedMembers })
        .eq('id', tlProfileId);
      if (updateTlErr) throw updateTlErr;

      const { error: updateEmpErr } = await supabase
        .from('profiles')
        .update({ team_lead_id: tlProfileId })
        .eq('user_id', employeeUserId);
      if (updateEmpErr) throw updateEmpErr;

      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to assign employee to team lead', loading: false });
      throw error;
    }
  },

  removeEmployeeFromTeamLead: async (employeeUserId: string) => {
    set({ loading: true, error: null });
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('User not authenticated');
      const { data: currentProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, org_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (profileError || !currentProfile || !canManageTLAssignments(currentProfile.role)) {
        throw new Error('Only admin or manager can remove employees from a team lead');
      }
      const { data: empProfile, error: empErr } = await supabase
        .from('profiles')
        .select('id, team_lead_id, org_id')
        .eq('user_id', employeeUserId)
        .maybeSingle();
      if (empErr || !empProfile) throw new Error('Employee not found');
      if (empProfile.org_id !== currentProfile.org_id) throw new Error('Employee is not in your organization');
      if (!empProfile.team_lead_id) {
        set({ loading: false });
        return; // not under any TL
      }

      const tlId = empProfile.team_lead_id;
      const { data: tlProfile, error: tlErr } = await supabase
        .from('profiles')
        .select('team_members')
        .eq('id', tlId)
        .maybeSingle();
      if (tlErr || !tlProfile) throw new Error('Team lead not found');
      const currentMembers = Array.isArray(tlProfile.team_members)
        ? tlProfile.team_members.filter((id: any) => String(id) !== employeeUserId)
        : [];
      await supabase
        .from('profiles')
        .update({ team_members: currentMembers })
        .eq('id', tlId);
      await supabase
        .from('profiles')
        .update({ team_lead_id: null })
        .eq('user_id', employeeUserId);

      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to remove employee from team lead', loading: false });
      throw error;
    }
  },

  reassignEmployeeToTeamLead: async (employeeUserId: string, newTlProfileId: string) => {
    set({ loading: true, error: null });
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('User not authenticated');
      const { data: currentProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, org_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (profileError || !currentProfile || !canManageTLAssignments(currentProfile.role)) {
        throw new Error('Only admin or manager can reassign employees');
      }
      const { data: empProfile } = await supabase
        .from('profiles')
        .select('team_lead_id')
        .eq('user_id', employeeUserId)
        .maybeSingle();
      if (empProfile?.team_lead_id) {
        await get().removeEmployeeFromTeamLead(employeeUserId);
      }
      await get().assignEmployeeToTeamLead(employeeUserId, newTlProfileId);
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to reassign employee', loading: false });
      throw error;
    }
  },

  getGroups: async (orgId: string) => {
    set({ loading: true, error: null });
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        set({ groups: [], loading: false });
        return;
      }
      const { data: currentProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, org_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (profileError || !currentProfile || !canManageTLAssignments(currentProfile.role)) {
        set({ groups: [], loading: false });
        return;
      }
      const profileId = currentProfile.id;
      const role = (currentProfile.role || '').toLowerCase().trim();
      const isAdmin = role === 'admin';
      const isTeamLead = role === 'team_lead' || role === 'tl' || role === 'teamlead';
      let query = supabase
        .from('groups')
        .select('id, name, manager_id, team_lead_id, org_id, created_at, updated_at')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });
      if (!isAdmin) {
        if (isTeamLead) {
          query = query.eq('team_lead_id', profileId);
        } else {
          query = query.eq('manager_id', profileId);
        }
      }
      const { data: rows, error } = await query;
      if (error) throw error;
      const groupIds = (rows || []).map((r: { team_lead_id: string }) => r.team_lead_id);
      const tlProfiles: Record<string, { full_name: string | null }> = {};
      if (groupIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', groupIds);
        (profiles || []).forEach((p: { id: string; full_name: string | null }) => { tlProfiles[p.id] = { full_name: p.full_name }; });
      }
      const memberCounts: Record<string, number> = {};
      for (const g of rows || []) {
        const members = await get().getMembersByTeamLead(g.team_lead_id);
        memberCounts[g.id] = members.length;
      }
      const groups: Group[] = (rows || []).map((r: any) => ({
        ...r,
        team_lead_name: tlProfiles[r.team_lead_id]?.full_name ?? null,
        member_count: memberCounts[r.id] ?? 0,
      }));
      set({ groups, loading: false });
    } catch (error: any) {
      set({ groups: [], error: error.message || 'Failed to fetch groups', loading: false });
    }
  },

  createGroup: async (name: string, teamLeadProfileId: string, orgId: string) => {
    set({ loading: true, error: null });
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('User not authenticated');
      const { data: currentProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, org_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (profileError || !currentProfile || !canManageTLAssignments(currentProfile.role)) {
        throw new Error('Only admin, manager, or team lead can create groups');
      }
      const role = (currentProfile.role || '').toLowerCase().trim();
      const isTeamLead = role === 'team_lead' || role === 'tl' || role === 'teamlead';
      if (isTeamLead && teamLeadProfileId !== currentProfile.id) {
        throw new Error('Team lead can only create a group for themselves');
      }
      const { error: insertError } = await supabase
        .from('groups')
        .insert({ name: name.trim(), manager_id: currentProfile.id, team_lead_id: teamLeadProfileId, org_id: orgId });
      if (insertError) throw insertError;
      await get().getGroups(orgId);
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to create group', loading: false });
      throw error;
    }
  },

  deleteGroup: async (groupId: string) => {
    set({ loading: true, error: null });
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('User not authenticated');
      const { data: currentProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('user_id', user.id)
        .maybeSingle();
      if (profileError || !currentProfile || !canManageTLAssignments(currentProfile.role)) {
        throw new Error('Only admin, manager, or team lead can delete groups');
      }
      const role = (currentProfile.role || '').toLowerCase().trim();
      const isTeamLead = role === 'team_lead' || role === 'tl' || role === 'teamlead';
      if (isTeamLead) {
        const group = get().groups.find((g) => g.id === groupId);
        if (!group || group.team_lead_id !== currentProfile.id) {
          throw new Error('Team lead can only delete their own group');
        }
      }
      const { error: deleteError } = await supabase.from('groups').delete().eq('id', groupId);
      if (deleteError) throw deleteError;
      const list = get().groups.filter((g) => g.id !== groupId);
      set({ groups: list, loading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to delete group', loading: false });
      throw error;
    }
  },
}));
