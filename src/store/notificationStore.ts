import { supabase } from '@/integrations/supabase/client';
import { create } from 'zustand';

export interface Notification {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  is_read: boolean;
  org_id: string;
  created_at: string;
  sender?: {
    full_name: string | null;
    email: string | null;
  };
}

interface NotificationState {
  // State
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;

  // Actions
  clearError: () => void;
  fetchNotifications: (orgId: string) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: (orgId: string) => Promise<void>;
  sendNotification: (
    orgId: string,
    title: string,
    message: string,
    type: 'info' | 'warning' | 'success' | 'error',
    recipientId?: string | null
  ) => Promise<{ success: boolean; message: string }>;
  deleteNotification: (notificationId: string) => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  // Initial state
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,

  clearError: () => {
    set({ error: null });
  },

  fetchNotifications: async (orgId: string) => {
    set({ loading: true, error: null });
    try {
      // Get current user's profile ID
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError || !profileData) {
        throw new Error('Profile not found');
      }

      const profileId = profileData.id;

      // Fetch notifications: personal notifications OR global notifications (where recipient_id is NULL)
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          sender:profiles!notifications_sender_id_fkey(full_name, email)
        `)
        .eq('org_id', orgId)
        .or(`recipient_id.eq.${profileId},recipient_id.is.null`)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const notifications = (data || []).map((n: any) => ({
        ...n,
        sender: n.sender || null,
      }));

      const unreadCount = notifications.filter((n: Notification) => !n.is_read).length;

      set({
        notifications,
        unreadCount,
        loading: false,
      });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to fetch notifications',
        loading: false,
      });
    }
  },

  markAsRead: async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) {
        throw error;
      }

      // Update local state
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === notificationId ? { ...n, is_read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch (error: any) {
      set({ error: error.message || 'Failed to mark notification as read' });
    }
  },

  markAllAsRead: async (orgId: string) => {
    try {
      // Get current user's profile ID
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError || !profileData) {
        throw new Error('Profile not found');
      }

      const profileId = profileData.id;

      // Mark all unread notifications as read
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('org_id', orgId)
        .or(`recipient_id.eq.${profileId},recipient_id.is.null`)
        .eq('is_read', false);

      if (error) {
        throw error;
      }

      // Update local state
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
        unreadCount: 0,
      }));
    } catch (error: any) {
      set({ error: error.message || 'Failed to mark all notifications as read' });
    }
  },

  sendNotification: async (
    orgId: string,
    title: string,
    message: string,
    type: 'info' | 'warning' | 'success' | 'error',
    recipientId?: string | null
  ) => {
    set({ loading: true, error: null });
    try {
      // Get current authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      // Verify user is HR
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError || !profileData) {
        throw new Error('Profile not found');
      }

      const normalizedRole = profileData.role?.toLowerCase();
      // Allow HR, managers, and team leads to send notifications
      const allowedRoles = ['hr', 'manager', 'team_lead', 'tl', 'teamlead', 'admin'];
      if (!allowedRoles.includes(normalizedRole || '')) {
        throw new Error('Only HR, Managers, and Team Leads can send notifications');
      }

      // Insert notification
      const { error: insertError } = await supabase
        .from('notifications')
        .insert({
          sender_id: profileData.id,
          recipient_id: recipientId || null,
          title: title.trim(),
          message: message.trim(),
          type,
          org_id: orgId,
        });

      if (insertError) {
        throw insertError;
      }

      set({ loading: false });
      return { success: true, message: 'Notification sent successfully' };
    } catch (error: any) {
      set({
        error: error.message || 'Failed to send notification',
        loading: false,
      });
      return { success: false, message: error.message || 'Failed to send notification' };
    }
  },

  deleteNotification: async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) {
        throw error;
      }

      // Update local state
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== notificationId),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch (error: any) {
      set({ error: error.message || 'Failed to delete notification' });
    }
  },
}));


