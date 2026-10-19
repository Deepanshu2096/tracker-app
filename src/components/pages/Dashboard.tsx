import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  User,
  Activity,
  ArrowRight,
  Laptop,
  Bed,
  Clock,
  Pause,
  Building,
  CheckCircle2,
  TrendingUp
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useTeamStore } from '@/store/teamStore';
import { useProfileStore } from '@/store/profileStore';
import { ROUTES_FRONTEND } from '@/constant';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// Admin, manager, and team_lead see dashboard stats/overview (data is already filtered: TL = group members only)
function canSeeDashboardOverview(role: string | null): boolean {
  if (!role) return false;
  const r = role.toLowerCase().trim();
  return r === 'admin' || r === 'manager' || r === 'team_lead' || r === 'tl' || r === 'teamlead';
}

export default function Dashboard() {
  const { user, orgId, userRole } = useAuth();
  const { profiles, loading, getProfiles, teams, getTeams } = useTeamStore();
  const { fetchProfile, fetchWorkStatus, profile: selectedProfile } = useProfileStore();
  const navigate = useNavigate();
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const showDashboardOverview = canSeeDashboardOverview(userRole ?? null);
  const isTeamLead = userRole && ['team_lead', 'tl', 'teamlead'].includes(String(userRole).toLowerCase());
  const [stats, setStats] = useState({
    users: 0,
    available: 0,
    onLeave: 0,
    onLate: 0,
    totalActive: 0,
    totalIdle: 0,
    departments: 0,
    teams: 0,
    presentToday: 0,
  });
  const [loadingStats, setLoadingStats] = useState(false);
  const [weeklyPerformanceData, setWeeklyPerformanceData] = useState<Array<{week: string; productivity: number; quality: number}>>([]);
  const [loadingPerformance, setLoadingPerformance] = useState(true);
  const [weeklyActiveIdleData, setWeeklyActiveIdleData] = useState<Array<{day: string; active: number; idle: number}>>([]);
  const [loadingActiveIdle, setLoadingActiveIdle] = useState(true);

  useEffect(() => {
    if (orgId && user) {
      // Fetch profiles (filtered by role: admin=all, manager=hierarchy, TL=team_members, employee=self)
      getProfiles(orgId);
      // Fetch teams: admin and manager see all teams; team lead sees only their team
      const r = userRole?.toLowerCase();
      if (r === 'admin' || r === 'manager' || r === 'team_lead' || r === 'tl' || r === 'teamlead') {
        getTeams(orgId);
      }
    }
  }, [orgId, user?.id, userRole]);

  // Fetch selected member's profile data
  useEffect(() => {
    if (selectedMemberId && orgId) {
      fetchProfile(selectedMemberId, orgId);
      fetchWorkStatus(selectedMemberId);
    }
  }, [selectedMemberId, orgId, fetchProfile, fetchWorkStatus]);

  // Calculate stats from profiles and work data
  useEffect(() => {
    if (!profiles || profiles.length === 0) {
      setStats({
        users: 0,
        available: 0,
        onLeave: 0,
        onLate: 0,
        totalActive: 0,
        totalIdle: 0,
        departments: 0,
        teams: teams?.length || 0,
        presentToday: 0,
      });
      return;
    }

    const calculateStats = async () => {
      setLoadingStats(true);
      try {
        // Basic stats from profiles
        const usersCount = profiles.length;
        const availableCount = profiles.filter(p => p.status === 'active').length;
        const onLeaveCount = profiles.filter(p => p.status === 'on_leave').length;
        
        // Departments count (unique team_ids)
        const uniqueTeamIds = new Set(
          profiles.map(p => p.team_id).filter(Boolean)
        );
        const departmentsCount = uniqueTeamIds.size;

        // Teams count
        const teamsCount = teams?.length || 0;

        // Get profile IDs for work status queries
        const profileIds = profiles.map(p => p.id);

        // Get today's date
        const today = new Date().toISOString().split('T')[0];
        
        // Get user IDs from profiles
        const profileUserIds = profiles.map(p => p.user_id).filter(Boolean);

        // Total Active Sessions: Count users with open work sessions (checked-in)
        const { data: activeSessions } = await supabase
          .from('work_sessions')
          .select('user_id')
          .eq('status', 'open')
          .in('user_id', profileIds);

        const totalActiveCount = activeSessions 
          ? new Set(activeSessions.map(s => s.user_id)).size 
          : 0;

        // Total Idle: Count users with active breaks
        const { data: activeBreaks } = await supabase
          .from('breaks')
          .select('user_id')
          .is('ended_at', null)
          .in('user_id', profileIds);

        const totalIdleCount = activeBreaks 
          ? new Set(activeBreaks.map(b => b.user_id)).size 
          : 0;

        // MOCK DATA: Use mock values for attendance and leave stats
        // In production, these would come from actual database queries
        const presentTodayCount = Math.floor(usersCount * 0.75); // 75% present
        const activeSessionsCount = Math.floor(usersCount * 0.60); // 60% active
        const onLateCount = Math.floor(usersCount * 0.15); // 15% late
        const onLeaveTodayCount = Math.floor(usersCount * 0.10); // 10% on leave

        setStats({
          users: usersCount,
          available: availableCount,
          onLeave: onLeaveTodayCount, // Use leave requests for today
          onLate: onLateCount,
          totalActive: activeSessionsCount, // Checked-in users today
          totalIdle: totalIdleCount,
          departments: departmentsCount,
          teams: teamsCount,
          presentToday: presentTodayCount, // New stat
        });
      } catch (error) {
        console.error('Error calculating stats:', error);
      } finally {
        setLoadingStats(false);
      }
    };

    calculateStats();
  }, [profiles, teams]);

  // Fetch weekly performance data
  useEffect(() => {
    // MOCK DATA: Generate weekly performance data for the last 8 weeks
    const generateMockData = () => {
      const weeks: Array<{week: string; productivity: number; quality: number}> = [];
      const today = new Date();
      
      for (let i = 7; i >= 0; i--) {
        const weekDate = new Date(today);
        weekDate.setDate(today.getDate() - (i * 7));
        const weekStart = new Date(weekDate);
        weekStart.setDate(weekDate.getDate() - weekDate.getDay()); // Start of week (Sunday)
        
        const weekLabel = `Week ${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
        
        // Generate realistic mock data with some variation
        const baseProductivity = 75 + (i * 2) + Math.random() * 10 - 5;
        const productivity = Math.max(60, Math.min(95, Math.round(baseProductivity)));
        
        const baseQuality = 80 + (i * 1.5) + Math.random() * 8 - 4;
        const quality = Math.max(70, Math.min(98, Math.round(baseQuality)));
        
        weeks.push({
          week: weekLabel,
          productivity,
          quality,
        });
      }
      
      return weeks;
    };

    setLoadingPerformance(true);
    // Simulate API delay
    setTimeout(() => {
      const mockData = generateMockData();
      setWeeklyPerformanceData(mockData);
      setLoadingPerformance(false);
    }, 500);
  }, [user, orgId]);

  // Fetch weekly active vs idle time data
  useEffect(() => {
    // MOCK DATA: Generate weekly active vs idle time data for weekdays
    const generateActiveIdleData = () => {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
      const weekData: Array<{day: string; active: number; idle: number}> = [];
      
      // Generate realistic mock data with variation
      const mockDataPoints = [
        { active: 7.5, idle: 0.5 },   // Monday
        { active: 7.8, idle: 0.2 },   // Tuesday
        { active: 6.5, idle: 1.5 },   // Wednesday
        { active: 8.0, idle: 0.0 },   // Thursday
        { active: 7.2, idle: 0.8 },   // Friday
      ];
      
      days.forEach((day, index) => {
        weekData.push({
          day,
          active: mockDataPoints[index].active,
          idle: mockDataPoints[index].idle,
        });
      });
      
      return weekData;
    };

    setLoadingActiveIdle(true);
    // Simulate API delay
    setTimeout(() => {
      const mockData = generateActiveIdleData();
      setWeeklyActiveIdleData(mockData);
      setLoadingActiveIdle(false);
    }, 500);
  }, [user, orgId]);

  const statCards = [
    {
      title: 'Team Members',
      value: stats.users,
      description: `${stats.available} active`,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      link: ROUTES_FRONTEND.TEAM,
    },
    {
      title: 'Active Sessions',
      value: 0,
      description: 'Work in progress',
      icon: Activity,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      link: '#',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user?.email || 'User'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Profile button - all organization members can go to their profile from dashboard */}
          <Button
            variant="default"
            size="sm"
            onClick={() => navigate(ROUTES_FRONTEND.PROFILE)}
            className="gap-2"
          >
            <User className="h-4 w-4" />
            My Profile
          </Button>
          {/* Member Selector - Admin, manager, team_lead (team_lead sees only group members) */}
          {showDashboardOverview && profiles && profiles.length > 0 && (
            <Select
              value={selectedMemberId || 'all'}
              onValueChange={(value) => {
                setSelectedMemberId(value === 'all' ? null : value);
              }}
            >
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select a member" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Members</SelectItem>
                {profiles.map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    {member.full_name || member.email || 'Unknown'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {userRole && (
            <span className="text-sm text-muted-foreground capitalize">
              {userRole}
            </span>
          )}
        </div>
      </div>

      {/* Stats Cards Grid - Admin, manager, team_lead (team_lead: group members only) */}
      {showDashboardOverview && (
        <>
          {/* Row 1: Users, Available, On Leave, On Late */}
          <div className="grid gap-4 md:grid-cols-4">
            {/* Users Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Users</CardTitle>
                <div className="bg-blue-50 p-2 rounded-lg">
                  <Users className="h-4 w-4 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent>
                {loading || loadingStats ? (
                  <Skeleton className="h-8 w-20 mb-2" />
                ) : (
                  <div className="text-2xl font-bold">{stats.users}</div>
                )}
              </CardContent>
            </Card>

            {/* Available Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Available</CardTitle>
                <div className="bg-blue-50 p-2 rounded-lg">
                  <Laptop className="h-4 w-4 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent>
                {loading || loadingStats ? (
                  <Skeleton className="h-8 w-20 mb-2" />
                ) : (
                  <div className="text-2xl font-bold">{stats.available}</div>
                )}
              </CardContent>
            </Card>

            {/* On Leave Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">On Leave</CardTitle>
                <div className="bg-blue-50 p-2 rounded-lg">
                  <Bed className="h-4 w-4 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent>
                {loading || loadingStats ? (
                  <Skeleton className="h-8 w-20 mb-2" />
                ) : (
                  <div className="text-2xl font-bold">{stats.onLeave}</div>
                )}
              </CardContent>
            </Card>

            {/* On Late Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">On Late</CardTitle>
                <div className="bg-blue-50 p-2 rounded-lg">
                  <Clock className="h-4 w-4 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent>
                {loading || loadingStats ? (
                  <Skeleton className="h-8 w-20 mb-2" />
                ) : (
                  <div className="text-2xl font-bold">{stats.onLate}</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Row 2: Total Active, Total Idle, Departments, Teams */}
          <div className="grid gap-4 md:grid-cols-4">
            {/* Total Active Card - Active Sessions (Checked-In) */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                {loading || loadingStats ? (
                  <Skeleton className="h-8 w-20 mb-2" />
                ) : (
                  <div className="text-2xl font-bold text-green-600">{stats.totalActive}</div>
                )}
                <p className="text-xs text-muted-foreground mt-1">Checked-in users</p>
              </CardContent>
            </Card>

            {/* Total Idle Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Idle</CardTitle>
              </CardHeader>
              <CardContent>
                {loading || loadingStats ? (
                  <Skeleton className="h-8 w-20 mb-2" />
                ) : (
                  <div className="text-2xl font-bold text-yellow-600">{stats.totalIdle}</div>
                )}
              </CardContent>
            </Card>

            {/* Departments Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Departments</CardTitle>
              </CardHeader>
              <CardContent>
                {loading || loadingStats ? (
                  <Skeleton className="h-8 w-20 mb-2" />
                ) : (
                  <div className="text-2xl font-bold">{stats.departments}</div>
                )}
              </CardContent>
            </Card>

            {/* Teams Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Teams</CardTitle>
              </CardHeader>
              <CardContent>
                {loading || loadingStats ? (
                  <Skeleton className="h-8 w-20 mb-2" />
                ) : (
                  <div className="text-2xl font-bold">{stats.teams}</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Additional Stats Row: Present Today */}
        <div className="grid gap-4 md:grid-cols-2">
            {/* Present Today Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Present Today</CardTitle>
                <div className="bg-green-50 p-2 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
              </CardHeader>
              <CardContent>
                {loading || loadingStats ? (
                  <Skeleton className="h-8 w-20 mb-2" />
                ) : (
                  <div className="text-2xl font-bold text-green-600">{stats.presentToday}</div>
                )}
                <p className="text-xs text-muted-foreground mt-1">Checked-in today</p>
              </CardContent>
            </Card>
          </div>

          {/* Selected Member Info - Show when a member is selected */}
          {selectedMemberId && selectedProfile && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Selected Member</CardTitle>
                    <CardDescription>
                      {selectedProfile.full_name || selectedProfile.email}
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(
                      `/profile/${selectedProfile.employee_number ?? selectedProfile.user_id ?? selectedProfile.id}`
                    )}
                  >
                    View Full Profile
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="text-sm font-medium">{selectedProfile.email || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Role</p>
                    <p className="text-sm font-medium capitalize">{selectedProfile.role || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="text-sm font-medium capitalize">{selectedProfile.status || 'N/A'}</p>
                  </div>
        </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Weekly Performance Chart - Show for all users */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Weekly Performance</CardTitle>
              <CardDescription>
                Productivity vs Quality score over the last 8 weeks
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(ROUTES_FRONTEND.WEEKLY_PERFORMANCE)}
            >
              View Details
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingPerformance ? (
            <div className="h-[300px] flex items-center justify-center">
              <Skeleton className="h-full w-full" />
            </div>
          ) : weeklyPerformanceData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No performance data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={weeklyPerformanceData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                <XAxis
                  dataKey="week"
                  className="text-xs"
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                />
                <YAxis
                  domain={[0, 100]}
                  className="text-xs"
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  label={{ value: 'Score (%)', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '8px',
                  }}
                  labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="productivity"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  name="Productivity"
                />
                <Line
                  type="monotone"
                  dataKey="quality"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  name="Quality"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Weekly Active vs Idle Time Chart - Show for all users */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Active vs Idle Time</CardTitle>
          <CardDescription>
            Breakdown of active and idle time for each weekday
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingActiveIdle ? (
            <div className="h-[300px] flex items-center justify-center">
              <Skeleton className="h-full w-full" />
            </div>
          ) : weeklyActiveIdleData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No time data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={weeklyActiveIdleData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                <XAxis
                  dataKey="day"
                  className="text-xs"
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                />
                <YAxis
                  domain={[0, 8]}
                  className="text-xs"
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  label={{ value: 'Hours', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '8px',
                  }}
                  labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                  formatter={(value: number) => [`${value.toFixed(1)} hrs`, '']}
                />
                <Legend />
                <Bar
                  dataKey="active"
                  stackId="time"
                  fill="#3b82f6"
                  name="Active Time"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="idle"
                  stackId="time"
                  fill="#e5e7eb"
                  name="Idle Time"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions - Admin, manager, team_lead */}
      {showDashboardOverview && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Common tasks and shortcuts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate(ROUTES_FRONTEND.TEAM)}
              >
                <Users className="mr-2 h-4 w-4" />
                Manage Team
                <ArrowRight className="ml-auto h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Latest updates and changes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {loading ? (
                  <>
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-8">
                    No recent activity
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Team Overview - Admin/manager: org members; Team lead: group members only */}
      {showDashboardOverview && profiles && profiles.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Team Overview</CardTitle>
                <CardDescription>
                  {isTeamLead ? 'Your group members' : 'Your organization members'}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(ROUTES_FRONTEND.TEAM)}
              >
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {profiles.slice(0, 5).map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {member.full_name?.[0]?.toUpperCase() || member.email?.[0]?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {member.full_name || member.email || 'Unknown'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {member.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground capitalize">
                      {member.role || 'N/A'}
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        member.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {member.status || 'active'}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 text-xs"
                      onClick={() => navigate(`/profile/${member.employee_number ?? member.user_id ?? member.id}`)}
                    >
                      View Profile
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Employee-specific content */}
      {userRole?.toLowerCase() === 'employee' && (
        <Card>
          <CardHeader>
            <CardTitle>Your Details</CardTitle>
            <CardDescription>
              Your personal information and statistics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary">
                    {user?.email?.[0]?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {user?.email || 'Unknown'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {userRole?.toUpperCase() || 'Employee'}
                  </p>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Use the Time Tracker to log your work sessions and track your time.
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

