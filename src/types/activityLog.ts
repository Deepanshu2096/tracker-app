export interface ActivityLog {
  id: string;
  actor_id: string;
  target_user_id: string | null;
  action: string;
  metadata: Record<string, any>;
  created_at: string;
  profiles_actor?: {
    full_name: string | null;
    email: string | null;
    role: string | null;
  };
  profiles_target?: {
    full_name: string | null;
    email: string | null;
    role: string | null;
  };
}

