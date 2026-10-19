import { supabase } from '@/integrations/supabase/client';

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

/**
 * Log activity to activity_logs table
 * @param action - Action type (e.g., 'check_in', 'check_out', 'break_start', 'break_end')
 * @param targetUserId - Optional target user ID (for actions affecting other users)
 * @param metadata - Optional metadata object to store as JSONB
 */
export async function logActivity(
  action: string,
  targetUserId?: string | null,
  metadata?: Record<string, any>
): Promise<{ success: boolean; error?: any }> {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    // Get profile ID for actor
    const actorProfileId = await getProfileId(user.id);
    if (!actorProfileId) {
      return { success: false, error: 'Profile not found' };
    }

    // Get profile ID for target user if provided
    let targetProfileId: string | null = null;
    if (targetUserId) {
      targetProfileId = await getProfileId(targetUserId);
    }

    // Insert activity log
    const { error } = await (supabase as any)
      .from('activity_logs')
      .insert({
        actor_id: actorProfileId,
        target_user_id: targetProfileId,
        action,
        metadata: metadata || {},
      });

    if (error) {
      console.error('Error logging activity:', error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in logActivity:', error);
    return { success: false, error };
  }
}

/**
 * Common activity action types
 */
export const ActivityActions = {
  CHECK_IN: 'check_in',
  CHECK_OUT: 'check_out',
  BREAK_START: 'break_start',
  BREAK_END: 'break_end',
  SESSION_CREATE: 'session_create',
  SESSION_UPDATE: 'session_update',
  SESSION_DELETE: 'session_delete',
  ATTENDANCE_CREATE: 'attendance_create',
  ATTENDANCE_UPDATE: 'attendance_update',
} as const;

