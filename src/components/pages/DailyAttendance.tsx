import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, CheckCircle2, Clock, CalendarOff, Send, Check, X, Users, Save } from 'lucide-react';
import { useDailyAttendanceStore, type DailyAttendanceStatus, type DailyAttendanceSubmission } from '@/store/dailyAttendanceStore';
import { useProfileStore } from '@/store/profileStore';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

/** Normalize DB time (HH:mm:ss or HH:mm) to HH:mm for input[type="time"] */
function toTimeInputValue(t: string | null | undefined): string {
  if (!t) return '';
  const part = t.slice(0, 5);
  return /^\d{2}:\d{2}$/.test(part) ? part : '';
}

const ATTENDANCE_OPTIONS: { value: DailyAttendanceStatus; label: string; icon: typeof CheckCircle2 }[] = [
  { value: 'Full Day', label: 'Full Day', icon: CheckCircle2 },
  { value: 'Half Day', label: 'Half Day', icon: Clock },
  { value: 'Leave', label: 'Leave', icon: CalendarOff },
];

export default function DailyAttendance() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedStatus, setSelectedStatus] = useState<DailyAttendanceStatus | null>(null);
  const [existingSubmission, setExistingSubmission] = useState<{ status: DailyAttendanceStatus; approval_status?: string } | null>(null);
  const [teamLeadProfileId, setTeamLeadProfileId] = useState<string | null>(null);
  const [pendingSubmissions, setPendingSubmissions] = useState<DailyAttendanceSubmission[]>([]);
  const [workStartTime, setWorkStartTime] = useState('');
  const [workEndTime, setWorkEndTime] = useState('');
  const [scheduleSaving, setScheduleSaving] = useState(false);

  const { userRole, user, orgId } = useAuth();
  const { profile, fetchProfile, updateProfile } = useProfileStore();
  const {
    submitAttendance,
    getMySubmissionForDate,
    getPendingSubmissionsForTeamLead,
    getAllSubmissionsForTeamLead,
    approveAttendance,
    rejectAttendance,
    seedMockPendingForTeamLead,
    loading,
    submissions,
  } = useDailyAttendanceStore();
  const { toast } = useToast();

  const isTeamLead = userRole && ['team_lead', 'tl', 'teamlead', 'manager', 'admin'].includes(userRole.toLowerCase());

  useEffect(() => {
    if (user?.id && orgId) {
      fetchProfile(user.id, orgId);
    }
  }, [user?.id, orgId, fetchProfile]);

  useEffect(() => {
    if (profile) {
      setWorkStartTime(toTimeInputValue(profile.work_start_time ?? null));
      setWorkEndTime(toTimeInputValue(profile.work_end_time ?? null));
    }
  }, [profile?.id, profile?.work_start_time, profile?.work_end_time]);

  useEffect(() => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    getMySubmissionForDate(dateStr).then((sub) => {
      setExistingSubmission(sub ? { status: sub.status, approval_status: sub.approval_status } : null);
    });
  }, [selectedDate, getMySubmissionForDate, submissions]);

  useEffect(() => {
    if (isTeamLead) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return;
        supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle()
          .then(({ data }) => {
            if (data?.id) {
              setTeamLeadProfileId(data.id);
              seedMockPendingForTeamLead(data.id);
            }
          });
      });
    }
  }, [isTeamLead, seedMockPendingForTeamLead]);

  const allTeamSubmissions = teamLeadProfileId
    ? getAllSubmissionsForTeamLead(teamLeadProfileId)
    : [];

  useEffect(() => {
    if (teamLeadProfileId) {
      setPendingSubmissions(getPendingSubmissionsForTeamLead(teamLeadProfileId));
    }
  }, [teamLeadProfileId, getPendingSubmissionsForTeamLead, submissions]);

  const handleSaveSchedule = async () => {
    if (!user?.id) return;
    const start = workStartTime.trim();
    const end = workEndTime.trim();
    if (!start || !end) {
      toast({
        title: 'Enter both times',
        description: 'Please set your work start and end time.',
        variant: 'destructive',
      });
      return;
    }
    if (start >= end) {
      toast({
        title: 'Invalid times',
        description: 'End time must be after start time.',
        variant: 'destructive',
      });
      return;
    }
    setScheduleSaving(true);
    try {
      await updateProfile(user.id, {
        work_start_time: start.length === 5 ? start + ':00' : start,
        work_end_time: end.length === 5 ? end + ':00' : end,
      });
      toast({
        title: 'Schedule saved',
        description: 'Your daily work schedule has been updated.',
        variant: 'success',
      });
    } catch (err: any) {
      toast({
        title: 'Failed to save',
        description: err?.message || 'Could not save work schedule.',
        variant: 'destructive',
      });
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedStatus) {
      toast({
        title: 'Select status',
        description: 'Please select Full Day, Half Day, or Leave',
        variant: 'destructive',
      });
      return;
    }

    const result = await submitAttendance(selectedDate, selectedStatus);

    if (result.success) {
      toast({
        title: 'Attendance submitted',
        description: result.message,
        variant: 'success',
      });
      setExistingSubmission({ status: selectedStatus, approval_status: 'pending' });
    } else {
      toast({
        title: 'Submission failed',
        description: result.message,
        variant: 'destructive',
      });
    }
  };

  const handleApprove = async (id: string) => {
    if (!teamLeadProfileId) return;
    const result = await approveAttendance(id, teamLeadProfileId);
    if (result.success) {
      toast({ title: 'Approved', description: result.message, variant: 'success' });
      setPendingSubmissions(getPendingSubmissionsForTeamLead(teamLeadProfileId));
    } else {
      toast({ title: 'Error', description: result.message, variant: 'destructive' });
    }
  };

  const handleReject = async (id: string) => {
    if (!teamLeadProfileId) return;
    const result = await rejectAttendance(id, teamLeadProfileId);
    if (result.success) {
      toast({ title: 'Rejected', description: result.message, variant: 'success' });
      setPendingSubmissions(getPendingSubmissionsForTeamLead(teamLeadProfileId));
    } else {
      toast({ title: 'Error', description: result.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Daily Attendance</h1>
        <p className="text-muted-foreground">
          Mark your attendance for the day. Submissions are sent to your team lead.
        </p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Daily work schedule
          </CardTitle>
          <CardDescription>
            Set your default working hours. This is used for daily attendance and time tracking.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="work-start">Start time</Label>
              <Input
                id="work-start"
                type="time"
                value={workStartTime}
                onChange={(e) => setWorkStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="work-end">End time</Label>
              <Input
                id="work-end"
                type="time"
                value={workEndTime}
                onChange={(e) => setWorkEndTime(e.target.value)}
              />
            </div>
          </div>
          <Button
            onClick={handleSaveSchedule}
            disabled={scheduleSaving}
            className="w-full sm:w-auto"
          >
            <Save className="mr-2 h-4 w-4" />
            {scheduleSaving ? 'Saving…' : 'Save schedule'}
          </Button>
        </CardContent>
      </Card>

      <Card className={cn(isTeamLead ? 'max-w-4xl' : 'max-w-lg')}>
        <CardHeader>
          <CardTitle>Mark Attendance</CardTitle>
          <CardDescription>
            {isTeamLead
              ? 'Select the date and mark your attendance, or approve/reject submissions from your team below.'
              : 'Select the date and mark your attendance status, then submit. Your team lead will receive it.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Date selection */}
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !selectedDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  disabled={(date) => date > new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Attendance status options */}
          <div className="space-y-2">
            <Label>Attendance</Label>
            <div className="grid grid-cols-3 gap-3">
              {ATTENDANCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSelectedStatus(opt.value)}
                  disabled={!!existingSubmission}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors',
                    selectedStatus === opt.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : existingSubmission
                      ? 'cursor-not-allowed opacity-60'
                      : 'border-muted hover:border-primary/50 hover:bg-muted/50'
                  )}
                >
                  <opt.icon className="h-6 w-6" />
                  <span className="text-sm font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Already submitted message */}
          {existingSubmission && (
            <div className="rounded-lg bg-muted p-4 text-sm">
              <p className="text-muted-foreground">
                You have already marked <strong>{existingSubmission.status}</strong> for this date.
              </p>
              <p className="mt-2 flex items-center gap-2">
                Status:{' '}
                <Badge
                  variant={
                    existingSubmission.approval_status === 'approved'
                      ? 'default'
                      : existingSubmission.approval_status === 'rejected'
                      ? 'destructive'
                      : 'secondary'
                  }
                >
                  {existingSubmission.approval_status === 'pending' ? 'Pending team lead approval' : existingSubmission.approval_status}
                </Badge>
              </p>
            </div>
          )}

          {/* Submit button */}
          <Button
            onClick={handleSubmit}
            disabled={loading || !!existingSubmission}
            className="w-full"
          >
            <Send className="mr-2 h-4 w-4" />
            {existingSubmission ? 'Already submitted' : 'Submit attendance'}
          </Button>

          {/* Team Lead: Daily attendance data — view Mark Attendance submissions, approve/reject */}
          {isTeamLead && (
            <div className="border-t pt-6 space-y-3">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Team daily attendance (Mark Attendance data)
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  View and approve or reject Mark Attendance submissions from your team.
                </p>
              </div>
              <Tabs defaultValue="pending" className="w-full">
                <TabsList className="grid w-full max-w-sm grid-cols-2">
                  <TabsTrigger value="pending">
                    Pending ({pendingSubmissions.length})
                  </TabsTrigger>
                  <TabsTrigger value="all">
                    All Mark Attendance
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="pending" className="mt-3">
                  {pendingSubmissions.length === 0 ? (
                    <p className="text-center py-6 text-muted-foreground text-sm rounded-lg border border-dashed">
                      No pending attendance submissions. When your team submits Mark Attendance, they will appear here.
                    </p>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingSubmissions.map((sub) => (
                            <TableRow key={sub.id}>
                              <TableCell className="font-medium">{sub.employee_name || 'Unknown'}</TableCell>
                              <TableCell>{format(new Date(sub.date), 'PPP')}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{sub.status}</Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex justify-end gap-2">
                                  <Button size="sm" variant="default" onClick={() => handleApprove(sub.id)} disabled={loading}>
                                    <Check className="h-4 w-4 mr-1" />
                                    Approve
                                  </Button>
                                  <Button size="sm" variant="destructive" onClick={() => handleReject(sub.id)} disabled={loading}>
                                    <X className="h-4 w-4 mr-1" />
                                    Reject
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="all" className="mt-3">
                  {allTeamSubmissions.length === 0 ? (
                    <p className="text-center py-6 text-muted-foreground text-sm rounded-lg border border-dashed">
                      No Mark Attendance data from your team yet.
                    </p>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Approval</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {allTeamSubmissions.map((sub) => (
                            <TableRow key={sub.id}>
                              <TableCell className="font-medium">{sub.employee_name || 'Unknown'}</TableCell>
                              <TableCell>{format(new Date(sub.date), 'PPP')}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{sub.status}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    sub.approval_status === 'approved'
                                      ? 'default'
                                      : sub.approval_status === 'rejected'
                                      ? 'destructive'
                                      : 'secondary'
                                  }
                                >
                                  {sub.approval_status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
