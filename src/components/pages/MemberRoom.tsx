import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Calendar, 
  Briefcase, 
  Users, 
  Clock,
  Activity,
  TrendingUp,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { useTeamStore } from '@/store/teamStore';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { ROUTES_FRONTEND } from '@/constant';
import { Skeleton } from '@/components/ui/skeleton';

interface MemberData {
  id: string;
  full_name: string | null;
  email: string | null;
  user_id: string;
  role: string | null;
  status: string | null;
  birthday: string | null;
  doj: string | null;
  team_id: string | null;
  team_name?: string | null;
}

interface AttendanceRecord {
  id: string;
  date: string;
  check_in: string;
  check_out: string | null;
  duration_minutes: number | null;
}

interface WorkSession {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  status: string;
  notes: string | null;
}

interface ActivityLog {
  id: string;
  action: string;
  metadata: any;
  created_at: string;
  actor_name?: string | null;
}

export default function MemberRoom() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { userRole, orgId } = useAuth();
  const { teams, getTeams } = useTeamStore();
  
  const [member, setMember] = useState<MemberData | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTeamMembers, setShowTeamMembers] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  // Check if user can access member room
  const canAccessMemberRoom = () => {
    if (!userRole) return false;
    const role = String(userRole).toLowerCase().trim();
    return ['admin', 'manager', 'team_lead', 'tl', 'teamlead'].includes(role);
  };

  useEffect(() => {
    if (!canAccessMemberRoom()) {
      navigate(ROUTES_FRONTEND.TEAM);
      return;
    }

    if (orgId) {
      getTeams(orgId);
    }
  }, [userRole, orgId]);

  useEffect(() => {
    if (!userId || !orgId) return;
    fetchMemberData();
    fetchAttendanceData();
    fetchSessionData();
    fetchActivityLogs();
  }, [userId, orgId]);

  useEffect(() => {
    if (showTeamMembers && selectedTeamId && orgId) {
      fetchTeamMembers();
    } else {
      setTeamMembers([]);
    }
  }, [showTeamMembers, selectedTeamId, orgId]);

  const fetchMemberData = async () => {
    if (!userId || !orgId) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          user_id,
          role,
          status,
          birthday,
          doj,
          team_id,
          teams:team_id (
            id,
            name
          )
        `)
        .eq('user_id', userId)
        .eq('org_id', orgId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setMember({
          ...data,
          team_name: (data.teams as any)?.name || null,
        });
        setSelectedTeamId(data.team_id);
      }
    } catch (error) {
      console.error('Error fetching member data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceData = async () => {
    if (!userId) return;
    
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(30);

      if (error) throw error;
      setAttendance(data || []);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };

  const fetchSessionData = async () => {
    if (!userId) return;
    
    try {
      // Get profile id first
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!profile) return;

      const { data, error } = await supabase
        .from('work_sessions')
        .select('*')
        .eq('user_id', profile.id)
        .order('started_at', { ascending: false })
        .limit(30);

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  };

  const fetchActivityLogs = async () => {
    if (!userId) return;
    
    try {
      // Get profile id first
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!profile) return;

      const { data, error } = await supabase
        .from('activity_logs')
        .select(`
          id,
          action,
          metadata,
          created_at,
          actor:actor_id (
            full_name
          )
        `)
        .eq('target_user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;
      setActivityLogs((data || []).map(log => ({
        ...log,
        actor_name: (log.actor as any)?.full_name || null,
      })));
    } catch (error) {
      console.error('Error fetching activity logs:', error);
    }
  };

  const fetchTeamMembers = async () => {
    if (!selectedTeamId || !orgId) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          user_id,
          role,
          status
        `)
        .eq('team_id', selectedTeamId)
        .eq('org_id', orgId)
        .order('full_name', { ascending: true });

      if (error) throw error;
      setTeamMembers(data || []);
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
  };

  const getRoleBadge = (role: string | null) => {
    if (!role) return null;
    return (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
        {role}
      </Badge>
    );
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return null;
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      'active': 'default',
      'on_leave': 'secondary',
      'terminated': 'destructive',
      'inactive': 'outline',
    };
    return (
      <Badge variant={variants[status] || 'outline'}>
        {status}
      </Badge>
    );
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '—';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatDurationSeconds = (seconds: number | null) => {
    if (!seconds) return '—';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate(ROUTES_FRONTEND.TEAM)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Team
        </Button>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-gray-500">Member not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(ROUTES_FRONTEND.TEAM)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Team
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Member Room</h1>
            <p className="text-muted-foreground">Detailed member information and activity</p>
          </div>
        </div>
      </div>

      {/* Member Profile Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 bg-purple-100">
              <AvatarFallback className="bg-purple-100 text-purple-600 text-2xl font-medium">
                {member.full_name?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <CardTitle className="text-2xl">{member.full_name || 'Unnamed User'}</CardTitle>
                {getStatusBadge(member.status)}
                {getRoleBadge(member.role)}
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Mail className="h-4 w-4" />
                  {member.email || 'No email'}
                </div>
                {member.team_name && (
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {member.team_name}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <div className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Date of Birth
              </div>
              <div className="text-sm font-medium">
                {member.birthday ? format(parseISO(member.birthday), 'PPP') : 'Not set'}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Briefcase className="h-4 w-4" />
                Date of Joining
              </div>
              <div className="text-sm font-medium">
                {member.doj ? format(parseISO(member.doj), 'PPP') : 'Not set'}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                Status
              </div>
              <div className="text-sm font-medium">
                {member.status || 'Not set'}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <User className="h-4 w-4" />
                Role
              </div>
              <div className="text-sm font-medium">
                {member.role || 'Not set'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Toggle Team Members View */}
      {member.team_id && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>View all members in the same team</CardDescription>
              </div>
              <Button
                variant={showTeamMembers ? "default" : "outline"}
                onClick={() => setShowTeamMembers(!showTeamMembers)}
              >
                {showTeamMembers ? 'Hide Team Members' : 'Show Team Members'}
              </Button>
            </div>
          </CardHeader>
          {showTeamMembers && (
            <CardContent>
              {teamMembers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamMembers.map((tm) => (
                      <TableRow key={tm.id}>
                        <TableCell className="font-medium">{tm.full_name || 'Unnamed'}</TableCell>
                        <TableCell>{tm.email || '—'}</TableCell>
                        <TableCell>{getRoleBadge(tm.role)}</TableCell>
                        <TableCell>{getStatusBadge(tm.status)}</TableCell>
                        <TableCell>
                          <Button
                            variant="link"
                            size="sm"
                            onClick={() => navigate(`/team/member/${tm.user_id}`)}
                          >
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-4">No team members found</p>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* Tabs for Detailed Information */}
      <Tabs defaultValue="attendance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="sessions">Work Sessions</TabsTrigger>
          <TabsTrigger value="activity">Activity Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Attendance Records</CardTitle>
              <CardDescription>Recent attendance history</CardDescription>
            </CardHeader>
            <CardContent>
              {attendance.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Check In</TableHead>
                      <TableHead>Check Out</TableHead>
                      <TableHead>Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{format(parseISO(record.date), 'PPP')}</TableCell>
                        <TableCell>{format(parseISO(record.check_in), 'p')}</TableCell>
                        <TableCell>
                          {record.check_out ? format(parseISO(record.check_out), 'p') : '—'}
                        </TableCell>
                        <TableCell>{formatDuration(record.duration_minutes)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-4">No attendance records found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Work Sessions</CardTitle>
              <CardDescription>Recent work session history</CardDescription>
            </CardHeader>
            <CardContent>
              {sessions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Started At</TableHead>
                      <TableHead>Ended At</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell>{format(parseISO(session.started_at), 'PPP p')}</TableCell>
                        <TableCell>
                          {session.ended_at ? format(parseISO(session.ended_at), 'PPP p') : '—'}
                        </TableCell>
                        <TableCell>{formatDurationSeconds(session.duration_seconds)}</TableCell>
                        <TableCell>{getStatusBadge(session.status)}</TableCell>
                        <TableCell>{session.notes || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-4">No work sessions found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity Logs</CardTitle>
              <CardDescription>Recent activity history</CardDescription>
            </CardHeader>
            <CardContent>
              {activityLogs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Metadata</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activityLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{format(parseISO(log.created_at), 'PPP p')}</TableCell>
                        <TableCell>{log.action}</TableCell>
                        <TableCell>{log.actor_name || 'System'}</TableCell>
                        <TableCell>
                          <code className="text-xs">
                            {JSON.stringify(log.metadata, null, 2)}
                          </code>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-4">No activity logs found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}


