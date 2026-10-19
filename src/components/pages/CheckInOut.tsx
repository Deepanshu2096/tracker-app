import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCheckInOutStore } from '@/store/checkInOutStore';
import { useProfileStore } from '@/store/profileStore';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { format, parseISO } from 'date-fns';
import { 
  Clock, 
  LogIn, 
  LogOut,
  CheckCircle2,
  XCircle,
  Coffee
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

function formatScheduleTime(t: string | null | undefined): string {
  if (!t) return '';
  const part = t.slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(part)) return '';
  const [h, m] = part.split(':').map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return format(d, 'h:mm a');
}

export default function CheckInOut() {
  const { currentStatus, loading, error, checkIn, checkOut, getCurrentStatus, clearError } = useCheckInOutStore();
  const { profile, fetchProfile } = useProfileStore();
  const { user, orgId } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    getCurrentStatus();
    // Refresh status every minute
    const interval = setInterval(() => {
      getCurrentStatus();
    }, 60000);
    return () => clearInterval(interval);
  }, [getCurrentStatus]);

  useEffect(() => {
    if (user?.id && orgId) {
      fetchProfile(user.id, orgId);
    }
  }, [user?.id, orgId, fetchProfile]);

  const handleCheckIn = async () => {
    try {
      clearError();
      await checkIn();
      toast({
        title: 'Checked In',
        description: 'You have successfully checked in.',
      });
    } catch (error: any) {
      toast({
        title: 'Check-In Failed',
        description: error.message || 'Failed to check in. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleCheckOut = async () => {
    try {
      clearError();
      await checkOut();
      toast({
        title: 'Checked Out',
        description: 'You have successfully checked out.',
      });
    } catch (error: any) {
      toast({
        title: 'Check-Out Failed',
        description: error.message || 'Failed to check out. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = () => {
    if (!currentStatus) return null;

    const statusConfig = {
      not_checked_in: { label: 'Not Checked In', variant: 'outline' as const, icon: XCircle, color: 'text-gray-600' },
      checked_in: { label: 'Checked In', variant: 'default' as const, icon: CheckCircle2, color: 'text-green-600' },
      checked_out: { label: 'Checked Out', variant: 'secondary' as const, icon: CheckCircle2, color: 'text-blue-600' },
      on_break: { label: 'On Break', variant: 'default' as const, icon: Coffee, color: 'text-yellow-600' },
    };

    const config = statusConfig[currentStatus.status];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className={`h-3 w-3 ${config.color}`} />
        {config.label}
      </Badge>
    );
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '0h 0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const canCheckOut = currentStatus?.status === 'checked_in' || currentStatus?.status === 'on_break';
  const canCheckIn = currentStatus?.status === 'not_checked_in' || currentStatus?.status === 'checked_out';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Check-In / Check-Out</h1>
        <p className="text-muted-foreground">
          Record your daily attendance
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today's Attendance</CardTitle>
          <CardDescription>
            {currentStatus?.date ? format(parseISO(currentStatus.date + 'T00:00:00'), 'EEEE, MMMM d, yyyy') : 'Loading...'}
            {profile?.work_start_time && profile?.work_end_time && (
              <span className="block mt-1 text-muted-foreground">
                Your schedule: {formatScheduleTime(profile.work_start_time)} – {formatScheduleTime(profile.work_end_time)}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Status */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Current Status</p>
                {loading ? (
                  <Skeleton className="h-5 w-24 mt-1" />
                ) : (
                  <div className="mt-1">
                    {getStatusBadge()}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Check-In/Check-Out Buttons */}
          <div className="grid gap-4 md:grid-cols-2">
            <Button
              size="lg"
              className="h-24 bg-green-600 hover:bg-green-700 text-white"
              onClick={handleCheckIn}
              disabled={loading || !canCheckIn}
            >
              <div className="flex flex-col items-center gap-2">
                <LogIn className="h-6 w-6" />
                <span className="text-lg font-semibold">Check-In</span>
              </div>
            </Button>

            <Button
              size="lg"
              className="h-24 bg-red-600 hover:bg-red-700 text-white"
              onClick={handleCheckOut}
              disabled={loading || !canCheckOut}
            >
              <div className="flex flex-col items-center gap-2">
                <LogOut className="h-6 w-6" />
                <span className="text-lg font-semibold">Check-Out</span>
              </div>
            </Button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Timestamps */}
          {currentStatus && (currentStatus.check_in || currentStatus.check_out) && (
            <div className="space-y-3 p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Check-In Time:</span>
                {loading ? (
                  <Skeleton className="h-4 w-32" />
                ) : currentStatus.check_in ? (
                  <span className="text-sm font-medium">
                    {format(parseISO(currentStatus.check_in), 'hh:mm a')}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">Not checked in</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Check-Out Time:</span>
                {loading ? (
                  <Skeleton className="h-4 w-32" />
                ) : currentStatus.check_out ? (
                  <span className="text-sm font-medium">
                    {format(parseISO(currentStatus.check_out), 'hh:mm a')}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">Not checked out</span>
                )}
              </div>
              {currentStatus.duration_minutes !== null && (
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm font-medium">Working Hours:</span>
                  <span className="text-sm font-semibold">
                    {formatDuration(currentStatus.duration_minutes)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Info Message */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> You must check in before you can check out. Once you check out, your session is closed for the day.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

