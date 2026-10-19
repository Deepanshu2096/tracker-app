import React from 'react';
import { createContext, useContext, useEffect, useState, useRef } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { jwtDecode } from 'jwt-decode';

/** Session valid for exactly 2 hours from login (client-side enforcement). */
const SESSION_MAX_AGE_MS = 2 * 60 * 60 * 1000;
const SESSION_STORAGE_KEY_PREFIX = 'berg_session_start_';
export const SESSION_EXPIRED_FLAG = 'berg_session_expired';

interface JWTClaims {
  session_id?: string;
  user_role?: string;
  org_id?: string;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userRole: string | null;
  orgId: string | null;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any, data: any }>;
  signOut: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<{ error: any }>;
  updateUserMetadata: (metadata: { [key: string]: any }) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getSessionIdFromToken(accessToken: string): string | null {
  try {
    const decoded = jwtDecode<JWTClaims>(accessToken);
    return decoded.session_id ?? null;
  } catch {
    return null;
  }
}

/** Returns whether the session is still within the 2h window; if not, caller should sign out and not set user/session. */
function checkAndEnforceSessionExpiry(session: Session): { valid: true } | { valid: false; sessionId: string } {
  const sessionId = getSessionIdFromToken(session.access_token);
  if (!sessionId) return { valid: true };

  const key = `${SESSION_STORAGE_KEY_PREFIX}${sessionId}`;
  const stored = localStorage.getItem(key);
  const now = Date.now();

  if (stored === null) {
    localStorage.setItem(key, String(now));
    return { valid: true };
  }

  const startTime = parseInt(stored, 10);
  if (now - startTime > SESSION_MAX_AGE_MS) {
    return { valid: false, sessionId };
  }
  return { valid: true };
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);

  // Hardcoded org_id for testing
  const HARDCODED_ORG_ID = '7f84da11-78b3-46f1-9610-76eb5c98c418';

  // Track if profile fetch has failed to avoid infinite retries
  const profileFetchFailedRef = useRef(false);

  // Function to fetch role and org_id from profile
  const fetchRoleAndOrgFromProfile = async (userId: string) => {
    // If we've already failed, don't retry
    if (profileFetchFailedRef.current) {
      return { role: null, orgId: null };
    }

    try {
      // Try using RPC function if available, otherwise use direct query
      // First, try a very simple query that only selects role and org_id columns
      // Avoid any automatic joins by being explicit
      const { data, error } = await supabase
        .from('profiles')
        .select('role, org_id')
        .eq('id', userId)
        .limit(1)
        .single();

      // If single() fails, try without it
      if (error && (error.code === 'PGRST116' || error.code === '21000')) {
        const arrayResult = await supabase
          .from('profiles')
          .select('role, org_id')
          .eq('id', userId)
          .limit(1);
        
        if (arrayResult.data && arrayResult.data.length > 0) {
          const role = arrayResult.data[0].role ? String(arrayResult.data[0].role).toLowerCase() : null;
          const orgId = arrayResult.data[0].org_id || null;
          return { role, orgId };
        }
      }

      if (error) {
        if (error.code === '21000' || error.message?.includes('more than one row')) {
          profileFetchFailedRef.current = true; // Mark as failed to prevent retries
          return { role: null, orgId: null };
        }
        return { role: null, orgId: null };
      }

      if (!data) {
        // Try with user_id as fallback
        const userResult = await supabase
          .from('profiles')
          .select('role, org_id')
          .eq('user_id', userId)
          .limit(1)
          .maybeSingle();
        
        if (userResult.data) {
          const role = userResult.data.role ? String(userResult.data.role).toLowerCase() : null;
          const orgId = userResult.data.org_id || null;
          return { role, orgId };
        }
        
        return { role: null, orgId: null };
      }

      const role = data.role ? String(data.role).toLowerCase() : null;
      const orgId = data.org_id || null;
      return { role, orgId };
    } catch (error) {
      profileFetchFailedRef.current = true; // Mark as failed to prevent retries
      return { role: null, orgId: null };
    }
  };

  // Function to decode JWT and extract claims
  const decodeJWTClaims = async (token: string, userId?: string) => {
    try {
      const decoded = jwtDecode<JWTClaims>(token);
      const role = decoded.user_role || null;
      const jwtOrgId = decoded.org_id || null;
      
      // If JWT doesn't have role or org_id, fetch from profile
      if ((!role || !jwtOrgId) && userId) {
        const profileData = await fetchRoleAndOrgFromProfile(userId);
        if (profileData.role) {
          setUserRole(profileData.role);
        } else if (role) {
          setUserRole(role);
        } else {
          setUserRole(null);
        }
        
        // Use org_id from profile if available, otherwise from JWT, otherwise hardcoded
        setOrgId(profileData.orgId || jwtOrgId || HARDCODED_ORG_ID);
      } else {
        setUserRole(role);
        // Use org_id from JWT if available, otherwise hardcoded
        setOrgId(jwtOrgId || HARDCODED_ORG_ID);
      }
    } catch (error) {
      // Try to fetch from profile on error
      if (userId) {
        const profileData = await fetchRoleAndOrgFromProfile(userId);
        setUserRole(profileData.role);
        setOrgId(profileData.orgId || HARDCODED_ORG_ID);
      } else {
        setUserRole(null);
        setOrgId(HARDCODED_ORG_ID);
      }
    }
  };

  useEffect(() => {
    const applySession = (session: Session | null) => {
      if (!session) {
        setSession(null);
        setUser(null);
        setUserRole(null);
        setOrgId(HARDCODED_ORG_ID);
        setLoading(false);
        return;
      }

      const expiry = checkAndEnforceSessionExpiry(session);
      if (!expiry.valid) {
        const key = `${SESSION_STORAGE_KEY_PREFIX}${expiry.sessionId}`;
        localStorage.removeItem(key);
        sessionStorage.setItem(SESSION_EXPIRED_FLAG, '1');
        supabase.auth.signOut().then(() => {
          setSession(null);
          setUser(null);
          setUserRole(null);
          setOrgId(HARDCODED_ORG_ID);
          setLoading(false);
        });
        return;
      }

      setSession(session);
      setUser(session.user);

      if (session.access_token) {
        decodeJWTClaims(session.access_token, session.user?.id);
      } else if (session.user?.id) {
        fetchRoleAndOrgFromProfile(session.user.id).then(data => {
          setUserRole(data.role);
          setOrgId(data.orgId || HARDCODED_ORG_ID);
        });
      } else {
        setUserRole(null);
        setOrgId(HARDCODED_ORG_ID);
      }
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        applySession(session ?? null);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error, data };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPasswordForEmail = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  const updateUserMetadata = async (metadata: { [key: string]: any }) => {
    const { error } = await supabase.auth.updateUser({
      data: metadata,
    });
    return { error };
  };


  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      userRole,
      orgId,
      signIn,
      signUp,
      signOut,
      resetPasswordForEmail,
      updateUserMetadata,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
