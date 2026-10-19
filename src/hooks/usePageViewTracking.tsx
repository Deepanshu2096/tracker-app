import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

/**
 * Hook to track page views automatically on route changes
 * Tracks: userId, url, and timestamp
 */
export function usePageViewTracking() {
  const location = useLocation();
  const { user } = useAuth();
  const previousPathRef = useRef<string | null>(null);

  useEffect(() => {
    // Don't track if user is not authenticated
    if (!user?.id) {
      return;
    }

    // Don't track if it's the same path (e.g., query params changed)
    const currentPath = location.pathname + location.search;
    if (previousPathRef.current === currentPath) {
      return;
    }

    // Update previous path
    previousPathRef.current = currentPath;

    // Track page view
    const trackPageView = async () => {
      try {
        const { error } = await supabase
          .from('page_views')
          .insert({
            user_id: user.id,
            url: currentPath,
            timestamp: new Date().toISOString(),
          });

        // Silently handle errors - table may not exist or user may not have access
        if (error) {
          // Only log if it's not a table not found error
          if (error.code !== 'PGRST205' && error.code !== '42P01') {
            console.error('Error tracking page view:', error);
          }
        }
      } catch (error: any) {
        // Silently handle errors - table may not exist
        if (error?.code !== 'PGRST205' && error?.code !== '42P01') {
          console.error('Error tracking page view:', error);
        }
      }
    };

    // Small delay to ensure route is fully loaded
    const timeoutId = setTimeout(() => {
      trackPageView();
    }, 100);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [location.pathname, location.search, user?.id]);
}

/**
 * Manual function to track a page view (useful for programmatic navigation)
 */
export async function trackPageView(userId: string, url: string) {
  try {
    const { error } = await supabase
      .from('page_views')
      .insert({
        user_id: userId,
        url: url,
        timestamp: new Date().toISOString(),
      });

    if (error) {
      // Silently handle table not found errors
      if (error.code !== 'PGRST205' && error.code !== '42P01') {
        console.error('Error tracking page view:', error);
      }
      return { error };
    }

    return { error: null };
  } catch (error: any) {
    // Silently handle table not found errors
    if (error?.code !== 'PGRST205' && error?.code !== '42P01') {
      console.error('Error tracking page view:', error);
    }
    return { error };
  }
}

