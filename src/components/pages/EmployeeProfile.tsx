import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { 
  User, 
  Mail, 
  Calendar, 
  Briefcase, 
  Users, 
  Phone,
  ArrowLeft,
  Edit,
  Clock,
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  MapPin,
  Monitor
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProfileStore } from '@/store/profileStore';
import { useProfileChangeRequestStore } from '@/store/profileChangeRequestStore';
import { format, parseISO } from 'date-fns';
import { ROUTES_FRONTEND } from '@/constant';
import { useTimeTrackerStore } from '@/store/timeTrackerStore';
import { formatDuration, formatDate, formatTime } from '@/lib/timeUtils';
import { supabase } from '@/integrations/supabase/client';
import { EditProfileDialog } from './EditProfileDialog';

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

export default function EmployeeProfile() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const navigate = useNavigate();
  const { user, userRole, orgId } = useAuth();
  const { profile, workStatus, loading, error, fetchProfile, fetchWorkStatus } = useProfileStore();
  const { myRequests, fetchMyRequests } = useProfileChangeRequestStore();
  const { currentSession, todayStats } = useTimeTrackerStore();
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [sessionsPage, setSessionsPage] = useState(1);
  const [sessionsPageSize] = useState(10);
  const [sessionsTotal, setSessionsTotal] = useState(0);

  // Determine if viewing own profile
  const isOwnProfile = !employeeId || (user && profile && user.id === profile.user_id);
  
  // Check if user can view this profile
  const canViewProfile = () => {
    if (!profile || !userRole) return false;
    
    // User can always view their own profile
    if (isOwnProfile) return true;
    
    const role = String(userRole).toLowerCase().trim();
    // Admins, managers, and team leads can view any profile
    return ['admin', 'manager', 'team_lead', 'tl', 'teamlead'].includes(role);
  };

  useEffect(() => {
    if (!orgId) return;
    
    const targetEmployeeId = employeeId || user?.id;
    if (targetEmployeeId) {
      fetchProfile(targetEmployeeId, orgId);
      fetchWorkStatus(targetEmployeeId);
    }
  }, [employeeId, user?.id, orgId, fetchProfile, fetchWorkStatus]);

  useEffect(() => {
    if (isOwnProfile && user?.id) fetchMyRequests(user.id);
  }, [isOwnProfile, user?.id, fetchMyRequests]);

  // Fetch work history
  useEffect(() => {
    const fetchWorkHistory = async () => {
      if (!profile?.id) return;
      
      setLoadingHistory(true);
      try {
        // Fetch work sessions with pagination
        const from = (sessionsPage - 1) * sessionsPageSize;
        const to = from + sessionsPageSize - 1;

        const { data: sessionsData, error: sessionsError, count } = await supabase
          .from('work_sessions')
          .select('*', { count: 'exact' })
          .eq('user_id', profile.id)
          .order('started_at', { ascending: false })
          .range(from, to);

        if (sessionsError) throw sessionsError;
        setSessions(sessionsData || []);
        setSessionsTotal(count || 0);

        // Fetch recent activity logs
        const { data: logsData, error: logsError } = await supabase
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
          .limit(20);

        if (logsError) throw logsError;
        setActivityLogs((logsData || []).map(log => ({
          ...log,
          actor_name: (log.actor as any)?.full_name || null,
        })));
      } catch (error) {
        console.error('Error fetching work history:', error);
      } finally {
        setLoadingHistory(false);
      }
    };

    if (profile?.id) {
      fetchWorkHistory();
    }
  }, [profile?.id, sessionsPage, sessionsPageSize]);

  // Reset sessions page when profile changes
  useEffect(() => {
    setSessionsPage(1);
  }, [profile?.id]);

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
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getRoleBadge = (role: string | null) => {
    if (!role) return null;
    return (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </Badge>
    );
  };

  const getWorkStatusBadge = () => {
    if (!workStatus) return null;
    
    const statusConfig = {
      active: { label: 'Active', variant: 'default' as const, icon: CheckCircle2 },
      idle: { label: 'Idle', variant: 'secondary' as const, icon: AlertCircle },
      offline: { label: 'Offline', variant: 'outline' as const, icon: XCircle },
    };
    
    const config = statusConfig[workStatus.status];
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate(ROUTES_FRONTEND.DASHBOARD)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-destructive">{error || 'Profile not found'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canViewProfile()) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate(ROUTES_FRONTEND.DASHBOARD)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-destructive">You don't have permission to view this profile</p>
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
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Employee Profile</h1>
            <p className="text-muted-foreground">
              {isOwnProfile ? 'Your profile information' : `${profile.full_name || 'Employee'}'s profile`}
            </p>
          </div>
        </div>
        {isOwnProfile && (
          <Button 
            variant="outline" 
            onClick={() => setEditDialogOpen(true)}
          >
            <Edit className="mr-2 h-4 w-4" />
            {profile?.profile_status === 'draft' ? 'Complete Profile' : 'Request Edit'}
          </Button>
        )}
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 bg-purple-100">
              {profile.avatar_url && (
                <AvatarImage src={profile.avatar_url} alt={profile.full_name || 'Profile'} className="object-cover" />
              )}
              <AvatarFallback className="bg-purple-100 text-purple-600 text-2xl font-medium">
                {profile.full_name?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <CardTitle className="text-2xl">{profile.full_name || 'Unnamed User'}</CardTitle>
                {getStatusBadge(profile.status)}
                {getRoleBadge(profile.role)}
                {workStatus && getWorkStatusBadge()}
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Mail className="h-4 w-4" />
                  {profile.email || 'No email'}
                </div>
                {profile.team_name && (
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {profile.team_name}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="pt-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Employee ID - commented out
            <div className="space-y-1">
              <div className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <User className="h-4 w-4" />
                Employee ID
              </div>
              <div className="text-sm font-medium font-mono">{profile.employee_number || profile.id || 'Not set'}</div>
            </div>
            */}

            {/* First Name */}
            {profile.first_name && (
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">First Name</div>
                <div className="text-sm font-medium">{profile.first_name}</div>
              </div>
            )}

            {/* Last Name */}
            {profile.last_name && (
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">Last Name</div>
                <div className="text-sm font-medium">{profile.last_name}</div>
              </div>
            )}

            {/* Full Name */}
            <div className="space-y-1">
              <div className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <User className="h-4 w-4" />
                Full Name
              </div>
              <div className="text-sm font-medium">{profile.full_name || 'Not set'}</div>
            </div>

            {/* Email */}
            <div className="space-y-1">
              <div className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Mail className="h-4 w-4" />
                Email Address
              </div>
              <div className="text-sm font-medium">{profile.email || 'Not set'}</div>
            </div>

            {/* Mobile number */}
            <div className="space-y-1">
              <div className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Phone className="h-4 w-4" />
                Mobile number
              </div>
              <div className="text-sm font-medium">{profile.phone || 'Not set'}</div>
            </div>

            {/* Date of Birth */}
            <div className="space-y-1">
              <div className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Date of Birth
              </div>
              <div className="text-sm font-medium">
                {profile.birthday ? format(parseISO(profile.birthday), 'PPP') : 'Not set'}
              </div>
            </div>

            {/* Date of Joining */}
            <div className="space-y-1">
              <div className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Briefcase className="h-4 w-4" />
                Date of Joining
              </div>
              <div className="text-sm font-medium">
                {profile.doj ? format(parseISO(profile.doj), 'PPP') : 'Not set'}
              </div>
            </div>

            {/* Location */}
            <div className="space-y-1">
              <div className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                Location
              </div>
              <div className="text-sm font-medium">
                {profile.city || 'Not set'}
              </div>
            </div>

            {/* Blood group */}
            <div className="space-y-1">
              <div className="text-sm font-medium text-muted-foreground">Blood group</div>
              <div className="text-sm font-medium">{profile.blood_group || 'Not set'}</div>
            </div>

            {/* Asset */}
            <div className="space-y-1">
              <div className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Monitor className="h-4 w-4" />
                Asset
              </div>
              <div className="text-sm font-medium">
                {profile.asset === 'office_laptop'
                  ? 'Office Laptop'
                  : profile.asset === 'office_desktop'
                    ? 'Office Desktop'
                    : profile.asset === 'personal_laptop_desktop'
                      ? 'Personal Laptop/Desktop'
                      : profile.asset || 'Not set'}
              </div>
            </div>

            {/* Emergency contact number */}
            <div className="space-y-1">
              <div className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Phone className="h-4 w-4" />
                Emergency contact number
              </div>
              <div className="text-sm font-medium">{profile.emergency_contact_phone || 'Not set'}</div>
            </div>

            {/* Designation / Role */}
            <div className="space-y-1">
              <div className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Briefcase className="h-4 w-4" />
                Designation / Role
              </div>
              <div className="text-sm font-medium">{profile.role || 'Not set'}</div>
            </div>

            {/* Department / Team */}
            <div className="space-y-1">
              <div className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Users className="h-4 w-4" />
                Department / Team
              </div>
              <div className="text-sm font-medium">{profile.team_name || 'Not assigned'}</div>
            </div>

            {/* Current Work Status */}
            <div className="space-y-1">
              <div className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Activity className="h-4 w-4" />
                Current Work Status
              </div>
              <div className="text-sm font-medium">
                {workStatus ? (
                  <Badge 
                    variant={
                      workStatus.status === 'active' ? 'default' : 
                      workStatus.status === 'idle' ? 'secondary' : 
                      'outline'
                    }
                  >
                    {workStatus.status === 'active' ? 'Online' :
                     workStatus.status === 'idle' ? 'On Break' :
                     'Offline'}
                  </Badge>
                ) : (
                  <Badge variant="outline">Offline</Badge>
                )}
              </div>
            </div>

            {/* Reporting Manager */}
            {profile.manager_name && (
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">Reporting Manager</div>
                <div className="text-sm font-medium">{profile.manager_name}</div>
              </div>
            )}

            {/* Team Lead */}
            {profile.team_lead_name && (
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">Team Lead</div>
                <div className="text-sm font-medium">{profile.team_lead_name}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Work Status & Time Tracker (Only for own profile or managers/admins) */}
      {(isOwnProfile || ['admin', 'manager', 'team_lead', 'tl', 'teamlead'].includes(String(userRole || '').toLowerCase())) && workStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Current Work Status & Time Tracker
            </CardTitle>
            <CardDescription>Real-time work status and today's tracking data</CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {/* Current Status */}
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Current Status
                </div>
                <div className="text-lg font-semibold">
                  {getWorkStatusBadge()}
                </div>
              </div>

              {/* Today's Total Time */}
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Today's Total Time
                </div>
                <div className="text-lg font-semibold">
                  {formatDuration(workStatus.todayStats.totalSeconds)}
                </div>
              </div>

              {/* Active Time */}
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Activity className="h-4 w-4" />
                  Active Time
                </div>
                <div className="text-lg font-semibold">
                  {formatDuration(workStatus.todayStats.activeSeconds)}
                </div>
              </div>

              {/* Break Time */}
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Break Time
                </div>
                <div className="text-lg font-semibold">
                  {formatDuration(workStatus.todayStats.breakSeconds)}
                </div>
              </div>

              {/* Current Session */}
              {workStatus.currentSession && (
                <div className="md:col-span-2 lg:col-span-4 space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">Current Session</div>
                  <div className="text-sm">
                    Started: {format(parseISO(workStatus.currentSession.started_at), 'PPP p')}
                  </div>
                  {workStatus.currentSession.notes && (
                    <div className="text-sm text-muted-foreground">
                      Notes: {workStatus.currentSession.notes}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Work History Tabs (Only for own profile or managers/admins) */}
      {(isOwnProfile || ['admin', 'manager', 'team_lead', 'tl', 'teamlead'].includes(String(userRole || '').toLowerCase())) && (
        <Tabs defaultValue="sessions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="sessions">Work Sessions</TabsTrigger>
            <TabsTrigger value="activity">Activity History</TabsTrigger>
          </TabsList>

          <TabsContent value="sessions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Recent Work Sessions
                </CardTitle>
                <CardDescription>Work session history and tracking data</CardDescription>
              </CardHeader>
              <Separator />
              <CardContent className="pt-6">
                {loadingHistory ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : sessions.length > 0 ? (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Start Time</TableHead>
                          <TableHead>End Time</TableHead>
                          <TableHead>Duration</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sessions.map((session) => (
                          <TableRow key={session.id}>
                            <TableCell>
                              {format(parseISO(session.started_at), 'PPP HH:mm')}
                            </TableCell>
                            <TableCell>
                              {session.ended_at ? (
                                format(parseISO(session.ended_at), 'PPP HH:mm')
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {formatDuration(session.duration_seconds)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={session.status === 'open' ? 'default' : 'secondary'}>
                                {session.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {session.notes || '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {/* Pagination */}
                    {Math.ceil(sessionsTotal / sessionsPageSize) > 1 && (
                      <div className="mt-6">
                        <Pagination>
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious
                                onClick={() => {
                                  if (sessionsPage > 1) {
                                    setSessionsPage(sessionsPage - 1);
                                  }
                                }}
                                className={sessionsPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                              />
                            </PaginationItem>
                            {Array.from({ length: Math.ceil(sessionsTotal / sessionsPageSize) }, (_, i) => i + 1).map((page) => (
                              <PaginationItem key={page}>
                                <PaginationLink
                                  onClick={() => setSessionsPage(page)}
                                  isActive={page === sessionsPage}
                                  className="cursor-pointer"
                                >
                                  {page}
                                </PaginationLink>
                              </PaginationItem>
                            ))}
                            <PaginationItem>
                              <PaginationNext
                                onClick={() => {
                                  if (sessionsPage < Math.ceil(sessionsTotal / sessionsPageSize)) {
                                    setSessionsPage(sessionsPage + 1);
                                  }
                                }}
                                className={sessionsPage >= Math.ceil(sessionsTotal / sessionsPageSize) ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-center text-muted-foreground py-4">No work sessions found</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Activity History
                </CardTitle>
                <CardDescription>Recent activity and action logs</CardDescription>
              </CardHeader>
              <Separator />
              <CardContent className="pt-6">
                {loadingHistory ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : activityLogs.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Actor</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activityLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>{format(parseISO(log.created_at), 'PPP p')}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.action}</Badge>
                          </TableCell>
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
      )}

      {/* Your change requests (own profile only) */}
      {isOwnProfile && myRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Profile Change Requests</CardTitle>
            <CardDescription>Status of your update requests</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {myRequests.slice(0, 5).map((req) => (
                <li key={req.id} className="rounded-lg border p-3 text-sm space-y-1">
                  <div className="flex items-center justify-between">
                    <span>{format(parseISO(req.created_at), 'PPp')}</span>
                    <Badge variant={req.status === 'pending_hr_approval' ? 'secondary' : req.status === 'approved' ? 'default' : 'destructive'}>
                      {req.status === 'pending_hr_approval' ? 'Pending Approval' : req.status === 'approved' ? 'Approved' : 'Rejected'}
                    </Badge>
                  </div>
                  {req.status === 'rejected' && req.rejection_reason && (
                    <p className="text-muted-foreground">Reason: {req.rejection_reason}</p>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Edit Profile Dialog */}
      {profile && isOwnProfile && (
        <EditProfileDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          profile={profile}
          mode={profile.profile_status === 'draft' ? 'first_time' : 'edit_request'}
        />
      )}
    </div>
  );
}

