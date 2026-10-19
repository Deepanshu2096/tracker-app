import { supabase } from '@/integrations/supabase/client';

export interface PageViewStats {
  url: string;
  visit_count: number;
  first_visited: string;
  last_visited: string;
  avg_time_between_visits_seconds?: number;
}

/**
 * Get page view statistics for a specific user
 * @param userId - The user ID to get stats for
 * @returns Array of page view statistics
 */
export async function getUserPageViewStats(userId: string): Promise<{
  data: PageViewStats[] | null;
  error: any;
}> {
  try {
    const { data: pageViews, error } = await supabase
      .from('page_views')
      .select('url, timestamp')
      .eq('user_id', userId)
      .order('timestamp', { ascending: true });

    if (error) {
      return { data: null, error };
    }

    if (!pageViews || pageViews.length === 0) {
      return { data: [], error: null };
    }

    // Group by URL
    const grouped = pageViews.reduce((acc, view) => {
      if (!acc[view.url]) {
        acc[view.url] = {
          url: view.url,
          timestamps: [] as string[],
        };
      }
      acc[view.url].timestamps.push(view.timestamp);
      return acc;
    }, {} as Record<string, { url: string; timestamps: string[] }>);

    // Calculate stats
    const stats: PageViewStats[] = Object.values(grouped).map((group) => {
      const sorted = group.timestamps.sort();
      const firstVisited = sorted[0];
      const lastVisited = sorted[sorted.length - 1];
      
      // Calculate average time between visits
      let avgTimeBetween = 0;
      if (sorted.length > 1) {
        const intervals: number[] = [];
        for (let i = 1; i < sorted.length; i++) {
          const diff = new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime();
          intervals.push(diff / 1000); // Convert to seconds
        }
        avgTimeBetween = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      }

      return {
        url: group.url,
        visit_count: sorted.length,
        first_visited: firstVisited,
        last_visited: lastVisited,
        avg_time_between_visits_seconds: avgTimeBetween || undefined,
      };
    });

    return { data: stats.sort((a, b) => b.visit_count - a.visit_count), error: null };
  } catch (error) {
    return { data: null, error };
  }
}

/**
 * Get most visited pages across all users (global stats)
 * @param limit - Maximum number of results to return (default: 10)
 * @returns Array of global page view statistics
 */
export async function getGlobalPageViewStats(limit: number = 10): Promise<{
  data: Array<{
    url: string;
    total_visits: number;
    unique_visitors: number;
    first_visited: string;
    last_visited: string;
  }> | null;
  error: any;
}> {
  try {
    const { data: pageViews, error } = await supabase
      .from('page_views')
      .select('url, user_id, timestamp')
      .order('timestamp', { ascending: true });

    if (error) {
      return { data: null, error };
    }

    if (!pageViews || pageViews.length === 0) {
      return { data: [], error: null };
    }

    // Group by URL
    const grouped = pageViews.reduce((acc, view) => {
      if (!acc[view.url]) {
        acc[view.url] = {
          url: view.url,
          timestamps: [] as string[],
          uniqueUsers: new Set<string>(),
        };
      }
      acc[view.url].timestamps.push(view.timestamp);
      acc[view.url].uniqueUsers.add(view.user_id);
      return acc;
    }, {} as Record<string, { url: string; timestamps: string[]; uniqueUsers: Set<string> }>);

    // Calculate stats
    const stats = Object.values(grouped).map((group) => {
      const sorted = group.timestamps.sort();
      return {
        url: group.url,
        total_visits: sorted.length,
        unique_visitors: group.uniqueUsers.size,
        first_visited: sorted[0],
        last_visited: sorted[sorted.length - 1],
      };
    });

    return {
      data: stats
        .sort((a, b) => b.total_visits - a.total_visits)
        .slice(0, limit),
      error: null,
    };
  } catch (error) {
    return { data: null, error };
  }
}

