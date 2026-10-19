import { supabase } from '@/integrations/supabase/client';

/**
 * Get all user IDs that a user can access based on their role hierarchy
 * 
 * @param requestingUserId - The user ID requesting access
 * @returns Array of user IDs that the requesting user can access
 */
export async function getAccessibleUserIds(requestingUserId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase.rpc('get_accessible_user_ids', {
      requesting_user_id: requestingUserId,
    });

    if (error) {
      console.error('Error fetching accessible user IDs:', error);
      // Fallback: return empty array or just the user's own ID based on role
      return [requestingUserId];
    }

    return (data || []).map((row: { user_id: string }) => row.user_id);
  } catch (error) {
    console.error('Error in getAccessibleUserIds:', error);
    return [requestingUserId]; // Fallback to self-only
  }
}

/**
 * Check if a user can access another user's data
 * 
 * @param requestingUserId - The user ID requesting access
 * @param targetUserId - The user ID being accessed
 * @returns True if access is allowed, false otherwise
 */
export async function canAccessUser(
  requestingUserId: string,
  targetUserId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('can_access_user', {
      requesting_user_id: requestingUserId,
      target_user_id: targetUserId,
    });

    if (error) {
      console.error('Error checking user access:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Error in canAccessUser:', error);
    return false;
  }
}

/**
 * Filter profiles based on role hierarchy (client-side fallback)
 * This is a fallback implementation if RPC functions are not available
 * 
 * @param profiles - Array of all profiles
 * @param currentUserId - The current user's ID
 * @param currentUserRole - The current user's role
 * @param currentUserProfileId - The current user's profile ID
 * @returns Filtered array of profiles the user can access
 */
export function filterProfilesByHierarchy(
  profiles: Array<{
    id: string;
    user_id: string;
    role: string | null;
    team_id?: string | null;
    manager_id?: string | null;
    team_lead_id?: string | null;
  }>,
  currentUserId: string,
  currentUserRole: string | null,
  currentUserProfileId: string
): Array<typeof profiles[0]> {
  if (!currentUserRole) {
    // No role = can only see self
    return profiles.filter((p) => p.user_id === currentUserId);
  }

  const normalizedRole = currentUserRole.toLowerCase();

  // Admin: Can see all
  if (normalizedRole === 'admin') {
    return profiles;
  }

  // Find current user's profile
  const currentUserProfile = profiles.find((p) => p.user_id === currentUserId);
  if (!currentUserProfile) {
    return profiles.filter((p) => p.user_id === currentUserId);
  }

  // Manager: Can see users under them (TLs, Employees, QA under those TLs)
  if (normalizedRole === 'manager') {
    return profiles.filter((profile) => {
      // Direct reports (TLs reporting to this manager)
      if (profile.manager_id === currentUserProfileId) {
        return true;
      }
      // Employees/QA under TLs that report to this manager
      const profileTeamLead = profiles.find((p) => p.id === profile.team_lead_id);
      if (profileTeamLead && profileTeamLead.manager_id === currentUserProfileId) {
        return true;
      }
      return false;
    });
  }

  // Team Lead (TL): Can see users in their team (Employees and QA)
  if (normalizedRole === 'team_lead' || normalizedRole === 'tl') {
    return profiles.filter((profile) => {
      // Users reporting directly to this TL
      if (profile.team_lead_id === currentUserProfileId) {
        return true;
      }
      // Users in the same team
      if (
        profile.team_id &&
        currentUserProfile.team_id &&
        profile.team_id === currentUserProfile.team_id
      ) {
        return true;
      }
      return false;
    });
  }

  // QA: Can see users in the same team
  if (normalizedRole === 'qa') {
    return profiles.filter((profile) => {
      if (!currentUserProfile.team_id) {
        return profile.user_id === currentUserId;
      }
      return profile.team_id === currentUserProfile.team_id;
    });
  }

  // QAT (QA Team Lead): Can see users in their team (similar to Team Lead)
  if (normalizedRole === 'qat') {
    return profiles.filter((profile) => {
      // Users reporting directly to this QAT
      if (profile.team_lead_id === currentUserProfileId) {
        return true;
      }
      // Users in the same team
      if (
        profile.team_id &&
        currentUserProfile.team_id &&
        profile.team_id === currentUserProfile.team_id
      ) {
        return true;
      }
      return false;
    });
  }

  // ST (Senior Tester/Software Tester): Can see users in the same team
  if (normalizedRole === 'st') {
    return profiles.filter((profile) => {
      if (!currentUserProfile.team_id) {
        return profile.user_id === currentUserId;
      }
      return profile.team_id === currentUserProfile.team_id;
    });
  }

  // L2, SME (Subject Matter Expert), Employee: Can only see themselves
  if (normalizedRole === 'l2' || normalizedRole === 'sme' || normalizedRole === 'employee') {
    return profiles.filter((p) => p.user_id === currentUserId);
  }

  // Default: Can only see themselves (fallback for unknown roles)
  return profiles.filter((p) => p.user_id === currentUserId);
}

/**
 * Get the current user's profile ID from user_id
 */
export async function getProfileIdFromUserId(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) {
      console.error('Error fetching profile ID:', error);
      return null;
    }

    return data.id;
  } catch (error) {
    console.error('Error in getProfileIdFromUserId:', error);
    return null;
  }
}

