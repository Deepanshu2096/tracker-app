import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useProfileChangeRequestStore, type ProfileChangeRequest, type RequestedProfileData } from '@/store/profileChangeRequestStore';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ROUTES_FRONTEND } from '@/constant';
import { format, parseISO } from 'date-fns';
import { CheckCircle2, XCircle, FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { USE_MOCK_PROFILE_DATA, getMockProfileOverlay } from '@/lib/mockProfileData';

const FIELD_LABELS: Record<string, string> = {
  full_name: 'Full Name',
  birthday: 'Date of Birth',
  doj: 'Date of Joining',
  city: 'City',
  phone: 'Phone',
  personal_email: 'Personal Email',
  gender: 'Gender',
  marital_status: 'Marital Status',
  address_line1: 'Address Line 1',
  address_line2: 'Address Line 2',
  state: 'State',
  pincode: 'Pincode',
  employee_number: 'Employee Number',
  department: 'Department',
  designation: 'Designation',
  work_phone: 'Work Phone',
  bank_name: 'Bank Name',
  bank_account_number: 'Account Number',
  bank_ifsc: 'IFSC',
  bank_branch: 'Branch',
  emergency_contact_name: 'Emergency Contact Name',
  emergency_contact_phone: 'Emergency Contact Phone',
  emergency_contact_relation: 'Relation',
};

function formatValue(v: unknown): string {
  if (v == null || v === '') return '—';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    try {
      return format(parseISO(v), 'PPP');
    } catch {
      return v;
    }
  }
  return String(v);
}

export default function HRProfileRequests() {
  const navigate = useNavigate();
  const { orgId, userRole, user } = useAuth();
  const {
    pendingRequests,
    loading,
    error,
    fetchPendingForHR,
    fetchPendingForTeamLead,
    approveRequest,
    rejectRequest,
    clearError,
  } = useProfileChangeRequestStore();
  const { toast } = useToast();
  const [detailRequest, setDetailRequest] = useState<ProfileChangeRequest | null>(null);
  const [currentProfileData, setCurrentProfileData] = useState<RequestedProfileData | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [tlProfileId, setTlProfileId] = useState<string | null>(null);

  const r = String(userRole || '').toLowerCase();
  const isHR = r === 'hr' || r === 'admin';
  const isTeamLead = ['team_lead', 'tl', 'teamlead'].includes(r);
  const isAuthorized = isHR || isTeamLead;

  useEffect(() => {
    if (!orgId || !isAuthorized) return;
    if (isHR) {
      fetchPendingForHR(orgId);
      return;
    }
    if (isTeamLead && user?.id) {
      (async () => {
        const { data } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (data?.id) {
          setTlProfileId(data.id);
          fetchPendingForTeamLead(orgId, data.id);
        }
      })();
    }
  }, [orgId, userRole, user?.id]);

  useEffect(() => {
    if (!detailRequest?.profile_id) return;
    (async () => {
      if (USE_MOCK_PROFILE_DATA) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .eq('id', detailRequest.profile_id)
          .maybeSingle();
        if (!profile) {
          setCurrentProfileData(null);
          return;
        }
        const overlay = getMockProfileOverlay(profile.user_id) ?? {};
        setCurrentProfileData({ full_name: profile.full_name ?? undefined, email: profile.email ?? undefined, ...overlay } as RequestedProfileData);
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('full_name, birthday, doj, city, phone, personal_email, gender, marital_status, address_line1, address_line2, state, pincode, employee_number, department, designation, work_phone, bank_name, bank_account_number, bank_ifsc, bank_branch, emergency_contact_name, emergency_contact_phone, emergency_contact_relation')
        .eq('id', detailRequest.profile_id)
        .single();
      setCurrentProfileData(data || null);
    })();
  }, [detailRequest?.profile_id]);

  if (!isAuthorized) {
    navigate(ROUTES_FRONTEND.DASHBOARD);
    return null;
  }

  const handleApprove = async () => {
    if (!detailRequest || !orgId) return;
    setActionLoading(true);
    try {
      await approveRequest(detailRequest.id, orgId, tlProfileId ?? undefined);
      toast({ title: 'Approved', description: 'Profile update has been applied.' });
      setDetailRequest(null);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to approve', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!detailRequest || !orgId) return;
    setActionLoading(true);
    try {
      await rejectRequest(detailRequest.id, rejectReason, orgId, tlProfileId ?? undefined);
      toast({ title: 'Rejected', description: 'Change request has been rejected.' });
      setDetailRequest(null);
      setRejectDialogOpen(false);
      setRejectReason('');
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to reject', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const openRejectDialog = () => setRejectDialogOpen(true);

  const allKeys = new Set<string>([
    ...Object.keys(detailRequest?.requested_data || {}),
    ...Object.keys(currentProfileData || {}),
  ]);
  const sortedKeys = Array.from(allKeys).filter((k) => FIELD_LABELS[k] || k).sort();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile Change Requests</h1>
        <p className="text-muted-foreground">
          {isTeamLead
            ? 'Review and approve or reject profile update requests from your group members.'
            : 'Review and approve or reject employee profile update requests.'}
        </p>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={clearError}>Dismiss</Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Pending Requests
          </CardTitle>
          <CardDescription>
            {loading
              ? 'Loading...'
              : isTeamLead
                ? `${pendingRequests.length} request(s) from your group awaiting approval`
                : `${pendingRequests.length} request(s) awaiting approval`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : pendingRequests.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No pending profile change requests.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Requested At</TableHead>
                  <TableHead className="w-[140px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium">{req.employee_name || '—'}</TableCell>
                    <TableCell>{req.employee_email || '—'}</TableCell>
                    <TableCell>{format(parseISO(req.created_at), 'PPp')}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDetailRequest(req)}
                      >
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Review / comparison dialog */}
      <Dialog open={!!detailRequest} onOpenChange={(open) => !open && setDetailRequest(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Change Request</DialogTitle>
            <DialogDescription>
              {detailRequest && (
                <>Compare current profile with requested changes for {detailRequest.employee_name || 'employee'}.</>
              )}
            </DialogDescription>
          </DialogHeader>
          {detailRequest && (
            <div className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Field</TableHead>
                      <TableHead>Current (Approved)</TableHead>
                      <TableHead>Requested</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedKeys.map((key) => {
                      const current = currentProfileData?.[key];
                      const requested = detailRequest.requested_data?.[key];
                      const changed = current !== requested;
                      return (
                        <TableRow key={key} className={changed ? 'bg-muted/50' : ''}>
                          <TableCell className="font-medium">{FIELD_LABELS[key] || key}</TableCell>
                          <TableCell>{formatValue(current)}</TableCell>
                          <TableCell>
                            <span className={changed ? 'text-primary font-medium' : ''}>
                              {formatValue(requested)}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={openRejectDialog}
                  disabled={actionLoading}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={actionLoading}
                >
                  {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Approve
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject reason dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Request</DialogTitle>
            <DialogDescription>
              Provide a reason for rejection. The employee will see this message.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reject-reason">Reason (optional)</Label>
              <Textarea
                id="reject-reason"
                placeholder="e.g. Incorrect document provided for DOB"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
