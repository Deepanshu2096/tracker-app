import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { formatDateTime, getRelativeTime, formatTimeHHMM, formatDurationHHMM } from '@/lib/timeUtils';
import type { ActivityLog } from '@/types/activityLog';
import { User, Clock, Target, Activity, Hash } from 'lucide-react';

interface ActivityLogDialogProps {
  open: boolean;
  onClose: () => void;
  log: ActivityLog | null;
}

export function ActivityLogDialog({ open, onClose, log }: ActivityLogDialogProps) {
  if (!log) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Activity Log Details
          </DialogTitle>
          <DialogDescription>
            Detailed information about this activity log entry
          </DialogDescription>
        </DialogHeader>
        <Separator />
        <div className="space-y-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Hash className="h-3 w-3" />
                Log ID
              </p>
              <p className="text-sm font-mono break-all">{log.id}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Timestamp
              </p>
              <p className="text-sm">{formatDateTime(log.created_at)}</p>
              <p className="text-xs text-muted-foreground">{getRelativeTime(log.created_at)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <User className="h-3 w-3" />
                Actor
              </p>
              <p className="text-sm font-medium">
                {log.profiles_actor?.full_name || log.profiles_actor?.email || 'Unknown'}
              </p>
              {log.profiles_actor?.email && log.profiles_actor?.full_name && (
                <p className="text-xs text-muted-foreground">{log.profiles_actor.email}</p>
              )}
              {log.profiles_actor?.role && (
                <Badge variant="secondary" className="text-xs mt-1">{String(log.profiles_actor.role).replace(/_/g, ' ')}</Badge>
              )}
              <p className="text-xs font-mono text-muted-foreground mt-1">ID: {log.actor_id}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Target className="h-3 w-3" />
                Target User
              </p>
              <p className="text-sm">
                {log.target_user_id
                  ? (log.profiles_target?.full_name || log.profiles_target?.email || 'Unknown')
                  : <span className="text-muted-foreground">N/A</span>}
              </p>
              {log.target_user_id && log.profiles_target?.email && log.profiles_target?.full_name && (
                <p className="text-xs text-muted-foreground">{log.profiles_target.email}</p>
              )}
              {log.target_user_id && log.profiles_target?.role && (
                <Badge variant="secondary" className="text-xs mt-1">{String(log.profiles_target.role).replace(/_/g, ' ')}</Badge>
              )}
              {log.target_user_id && (
                <p className="text-xs font-mono text-muted-foreground mt-1">ID: {log.target_user_id}</p>
              )}
            </div>
            <div className="md:col-span-2 space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Activity className="h-3 w-3" />
                Action
              </p>
              <Badge variant="outline" className="font-mono">
                {log.action.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </Badge>
            </div>
            {(log.metadata?.start_time != null || log.metadata?.end_time != null || log.metadata?.duration_seconds != null) && (
              <>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Start Time
                  </p>
                  <p className="text-sm font-mono">{formatTimeHHMM(log.metadata?.start_time)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    End Time
                  </p>
                  <p className="text-sm font-mono">{formatTimeHHMM(log.metadata?.end_time)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Duration
                  </p>
                  <p className="text-sm font-mono">{formatDurationHHMM(log.metadata?.duration_seconds)}</p>
                </div>
              </>
            )}
          </div>
          <Separator />
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Metadata</p>
            {Object.keys(log.metadata || {}).length > 0 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                  {Object.entries(log.metadata).map(([key, value]) => (
                    <div key={key} className="flex flex-col gap-0.5 rounded border bg-muted/50 px-3 py-2">
                      <span className="text-xs font-medium text-muted-foreground capitalize">
                        {key.replace(/_/g, ' ')}
                      </span>
                      <span className="text-sm font-mono break-all">
                        {typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
                <details className="bg-muted rounded-md border">
                  <summary className="text-xs font-medium p-3 cursor-pointer text-muted-foreground hover:text-foreground">
                    Raw JSON
                  </summary>
                  <pre className="text-xs p-4 overflow-auto max-h-[200px] border-t">
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                </details>
              </>
            ) : (
              <p className="text-sm text-muted-foreground italic">No metadata available</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

