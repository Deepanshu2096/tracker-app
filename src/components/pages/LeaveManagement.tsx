import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, CheckCircle2, XCircle, Clock, Send, Upload, Sun, Stethoscope, User } from 'lucide-react';
import { useLeaveStore } from '@/store/leaveStore';
import type { LeaveType, LeaveDurationType, LeaveStatus } from '@/store/leaveStore';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface LeaveRequestFormData {
  leave_type: LeaveType;
  start_date: Date;
  end_date: Date;
  duration_type: LeaveDurationType;
  reason: string;
}

export default function LeaveManagement() {
  const { user, orgId, userRole } = useAuth();
  const {
    leaveHistory,
    pendingRequests,
    pendingHRRequests,
    leaveBalance,
    loading,
    error,
    requestLeave,
    getLeaveHistory,
    getPendingRequests,
    getLeaveBalance,
    approveLeave,
    rejectLeave,
    checkLeaveBalance,
  } = useLeaveStore();
  const { toast } = useToast();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedLeaveId, setSelectedLeaveId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const isManager = userRole && ['admin', 'manager', 'team_lead', 'hr'].includes(userRole.toLowerCase());

  const form = useForm<LeaveRequestFormData>({
    defaultValues: {
      leave_type: 'casual',
      start_date: new Date(),
      end_date: new Date(),
      duration_type: 'full',
      reason: '',
    },
  });

  useEffect(() => {
    if (user) {
      getLeaveHistory(isManager && orgId ? orgId : undefined);
      if (isManager && orgId) {
        getPendingRequests(orgId, userRole);
      }
      if (!isManager) {
        getLeaveBalance();
      }
    }
  }, [user, orgId, isManager, userRole, getLeaveHistory, getPendingRequests, getLeaveBalance]);

  const onSubmit = async (data: LeaveRequestFormData) => {
    try {
      // Calculate duration to check balance
      const startDate = new Date(data.start_date);
      const endDate = new Date(data.end_date);
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      const durationDays = data.duration_type === 'half' ? diffDays * 0.5 : diffDays;

      // Check balance before submitting
      if (!checkLeaveBalance(data.leave_type, durationDays)) {
        toast({
          title: 'Insufficient Balance',
          description: `You don't have enough ${data.leave_type} leave balance for ${durationDays} day(s)`,
          variant: 'destructive',
        });
        return;
      }

      await requestLeave({
        leave_type: data.leave_type,
        start_date: data.start_date,
        end_date: data.end_date,
        duration_type: data.duration_type,
        reason: data.reason,
      });
      toast({
        title: 'Success',
        description: 'Leave request submitted successfully. Your manager will be notified.',
      });
      form.reset();
      // Refresh balance
      if (!isManager) {
        getLeaveBalance();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit leave request',
        variant: 'destructive',
      });
    }
  };

  const handleApprove = async (leaveId: string, remarks?: string) => {
    if (!orgId) return;
    try {
      // Determine approval level based on user role
      const approvalLevel: 'team_lead' | 'manager' | 'hr' = 
        userRole?.toLowerCase() === 'hr' ? 'hr' :
        (userRole?.toLowerCase() === 'manager' || userRole?.toLowerCase() === 'team_lead') ? 'manager' : 'team_lead';
      
      await approveLeave(leaveId, orgId, remarks, approvalLevel);
      toast({
        title: 'Success',
        description: userRole?.toLowerCase() === 'hr' 
          ? 'Leave request approved and balance deducted'
          : 'Leave request approved. Sent to HR for final approval.',
      });
      getPendingRequests(orgId, userRole);
      getLeaveHistory(isManager && orgId ? orgId : undefined);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve leave',
        variant: 'destructive',
      });
    }
  };

  const handleReject = async () => {
    if (!selectedLeaveId || !orgId) return;
    try {
      await rejectLeave(selectedLeaveId, rejectReason, orgId);
      toast({
        title: 'Success',
        description: 'Leave request rejected',
      });
      setRejectDialogOpen(false);
      setSelectedLeaveId(null);
      setRejectReason('');
      getPendingRequests(orgId, userRole);
      getLeaveHistory(isManager && orgId ? orgId : undefined);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject leave',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      'pending': 'secondary',
      'approved': 'default',
      'rejected': 'destructive',
    };
    return (
      <Badge variant={variants[status] || 'outline'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const leaveTypes: { value: LeaveType; label: string }[] = [
    { value: 'casual', label: 'Casual Leave' },
    { value: 'sick', label: 'Sick Leave' },
    { value: 'paid', label: 'Paid Leave' },
    { value: 'unpaid', label: 'Unpaid Leave' },
    { value: 'paternity', label: 'Paternity Leave' },
    { value: 'comp_off', label: 'Comp-off' },
  ];

  const leaveBalances = leaveBalance;

  const displayLeaveHistory = leaveHistory;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Leave Management</h1>
        <p className="text-muted-foreground">
          {isManager ? 'Manage leave requests and view team leave calendar' : 'Request leave and view your leave history'}
        </p>
      </div>

      {/* Leave Request Form - For Employees */}
      {!isManager && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column: Apply for Leave Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Apply for Leave</CardTitle>
                <CardDescription>Submit a new leave request. Your manager will be notified automatically.</CardDescription>
              </CardHeader>
              <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="leave_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Leave Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select leave type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {leaveTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="start_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  'w-full justify-start text-left font-normal',
                                  !field.value && 'text-muted-foreground'
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, 'PPP') : 'Pick a date'}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) => date < new Date()}
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="end_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  'w-full justify-start text-left font-normal',
                                  !field.value && 'text-muted-foreground'
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, 'PPP') : 'Pick a date'}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) => date < form.watch('start_date') || date < new Date()}
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reason</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Please provide a detailed reason for your leave request..."
                          className="min-h-[120px]"
                          {...field}
                        />
                      </FormControl>
                      <p className="text-sm text-muted-foreground">Be specific about why you need this leave.</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* File Upload Area */}
                <div className="space-y-2">
                  <Label>Supporting Documents (Optional)</Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer">
                    <Upload className="h-10 w-10 mx-auto mb-4 text-gray-400" />
                    <p className="text-sm font-medium mb-1">Drag and drop files here, or click to browse</p>
                    <p className="text-xs text-muted-foreground">
                      Optional: Upload supporting documents (PDF, JPG, PNG up to 5MB)
                    </p>
                  </div>
                </div>

                <Button type="submit" disabled={loading} className="w-full bg-teal-600 hover:bg-teal-700 text-white">
                  <Send className="mr-2 h-4 w-4" />
                  {loading ? 'Submitting...' : 'Submit Request'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
          </div>

          {/* Right Column: Your Balance */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Your Balance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading && !leaveBalances ? (
                  <div className="space-y-4">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                ) : !leaveBalances ? (
                  <p className="text-sm text-muted-foreground py-4">No balance data. Complete your profile or contact HR.</p>
                ) : (
                  <>
                    <Card className="bg-green-50 border-green-200">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-4">
                          <Sun className="h-8 w-8 text-green-600" />
                        </div>
                        <div className="text-3xl font-bold text-gray-900 mb-2">
                          {leaveBalances.casual.remaining} / {leaveBalances.casual.total}
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">{leaveBalances.casual.used} used</span>
                            <span className="text-gray-600">{leaveBalances.casual.remaining} remaining</span>
                          </div>
                          <div className="relative h-2 w-full bg-green-100 rounded-full overflow-hidden">
                            <div
                              className="absolute left-0 top-0 h-full bg-green-500 rounded-full transition-all"
                              style={{ width: `${leaveBalances.casual.total ? (leaveBalances.casual.used / leaveBalances.casual.total) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-red-50 border-red-200">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-4">
                          <Stethoscope className="h-8 w-8 text-red-600" />
                        </div>
                        <div className="text-3xl font-bold text-gray-900 mb-2">
                          {leaveBalances.sick.remaining} / {leaveBalances.sick.total}
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">{leaveBalances.sick.used} used</span>
                            <span className="text-gray-600">{leaveBalances.sick.remaining} remaining</span>
                          </div>
                          <div className="relative h-2 w-full bg-red-100 rounded-full overflow-hidden">
                            <div
                              className="absolute left-0 top-0 h-full bg-red-500 rounded-full transition-all"
                              style={{ width: `${leaveBalances.sick.total ? (leaveBalances.sick.used / leaveBalances.sick.total) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-4">
                          <User className="h-8 w-8 text-blue-600" />
                        </div>
                        <div className="text-3xl font-bold text-gray-900 mb-2">
                          {leaveBalances.paid.remaining} / {leaveBalances.paid.total}
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">{leaveBalances.paid.used} used</span>
                            <span className="text-gray-600">{leaveBalances.paid.remaining} remaining</span>
                          </div>
                          <div className="relative h-2 w-full bg-blue-100 rounded-full overflow-hidden">
                            <div
                              className="absolute left-0 top-0 h-full bg-blue-500 rounded-full transition-all"
                              style={{ width: `${leaveBalances.paid.total ? (leaveBalances.paid.used / leaveBalances.paid.total) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Pending Requests - For Managers/TL */}
      {isManager && (pendingRequests.length > 0 || pendingHRRequests.length > 0) && (
        <>
          {/* Manager/TL Pending Requests */}
          {pendingRequests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Pending Leave Requests (Awaiting Your Approval)</CardTitle>
                <CardDescription>Approve or reject leave requests from your team members</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Leave Type</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell>{request.employee_name || 'Unknown'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {leaveTypes.find(t => t.value === request.leave_type)?.label || request.leave_type}
                            </Badge>
                          </TableCell>
                          <TableCell>{format(parseISO(request.start_date), 'PPP')}</TableCell>
                          <TableCell>{format(parseISO(request.end_date), 'PPP')}</TableCell>
                          <TableCell>
                            {request.duration_days} day{request.duration_days !== 1 ? 's' : ''} ({request.duration_type})
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {request.reason || '—'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => {
                                  setSelectedLeaveId(request.id);
                                  setRejectReason('');
                                  // For now, approve without remarks dialog
                                  handleApprove(request.id);
                                }}
                                disabled={loading}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setSelectedLeaveId(request.id);
                                  setRejectDialogOpen(true);
                                }}
                                disabled={loading}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* HR Pending Requests */}
          {userRole?.toLowerCase() === 'hr' && pendingHRRequests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Pending HR Approval</CardTitle>
                <CardDescription>Final approval required for leave requests approved by managers</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Leave Type</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Manager Remarks</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingHRRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell>{request.employee_name || 'Unknown'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {leaveTypes.find(t => t.value === request.leave_type)?.label || request.leave_type}
                            </Badge>
                          </TableCell>
                          <TableCell>{format(parseISO(request.start_date), 'PPP')}</TableCell>
                          <TableCell>{format(parseISO(request.end_date), 'PPP')}</TableCell>
                          <TableCell>
                            {request.duration_days} day{request.duration_days !== 1 ? 's' : ''} ({request.duration_type})
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {request.reason || '—'}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {request.remarks || '—'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleApprove(request.id)}
                                disabled={loading}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Final Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setSelectedLeaveId(request.id);
                                  setRejectDialogOpen(true);
                                }}
                                disabled={loading}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Leave History */}
      <Card>
        <CardHeader>
          <CardTitle>Leave History</CardTitle>
          <CardDescription>
            {isManager ? 'All leave requests in your organization' : 'Your leave request history'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : displayLeaveHistory.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No leave requests found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {isManager && <TableHead>Employee</TableHead>}
                  <TableHead>Leave Type</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayLeaveHistory.map((request) => (
                  <TableRow key={request.id}>
                    {isManager && (
                      <TableCell>{request.employee_name || 'Unknown'}</TableCell>
                    )}
                    <TableCell>
                      <Badge variant="outline">
                        {leaveTypes.find(t => t.value === request.leave_type)?.label || request.leave_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(parseISO(request.start_date), 'PPP')}</TableCell>
                    <TableCell>{format(parseISO(request.end_date), 'PPP')}</TableCell>
                    <TableCell>
                      {request.duration_days} day{request.duration_days !== 1 ? 's' : ''} ({request.duration_type})
                    </TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {request.reason || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Leave Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this leave request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reject-reason">Rejection Reason</Label>
              <Textarea
                id="reject-reason"
                placeholder="Enter reason for rejection..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setRejectDialogOpen(false);
              setRejectReason('');
              setSelectedLeaveId(null);
            }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim()}>
              Reject Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

