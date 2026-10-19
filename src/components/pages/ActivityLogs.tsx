import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
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
import { useActivityLogStore } from '@/store/activityLogStore';
import { useAuth } from '@/hooks/useAuth';
import { formatDateTime, formatTimeHHMM, formatDurationHHMM } from '@/lib/timeUtils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { ActivityLogDialog } from '@/components/activity-logs/ActivityLogDialog';
import type { ActivityLog } from '@/types/activityLog';
import { Search, FileText, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const ACTION_TYPES = [
  'check_in',
  'check_out',
  'break_start',
  'break_end',
  'session_create',
  'session_update',
  'session_delete',
  'attendance_create',
  'attendance_update',
] as const;

export default function ActivityLogs() {
  const { userRole, orgId } = useAuth();
  const {
    logs,
    loading,
    error,
    total,
    searchQuery,
    actionFilter,
    page,
    pageSize,
    fetchLogs,
    setSearchQuery,
    setActionFilter,
    setPagination,
  } = useActivityLogStore();

  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    fetchLogs(userRole, orgId);
  }, [userRole, orgId, searchQuery, actionFilter, page, pageSize, fetchLogs]);

  const totalPages = Math.ceil(total / pageSize);

  const handleRowClick = (log: ActivityLog) => {
    setSelectedLog(log);
    setShowDialog(true);
  };

  const handlePageSizeChange = (newSize: string) => {
    setPagination(1, parseInt(newSize));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Activity Logs</h1>
        <p className="text-muted-foreground">
          View system activity and user actions
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Activity Logs
          </CardTitle>
          <CardDescription>
            Search and filter activity logs by actor, action, or details
          </CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="space-y-4 pt-6">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by actor, action, or details..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Action Type</Label>
              <Select
                value={actionFilter || 'all'}
                onValueChange={(value) => setActionFilter(value === 'all' ? null : value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {ACTION_TYPES.map((action) => (
                    <SelectItem key={action} value={action}>
                      {action.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Page Size</Label>
              <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Info */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>
              Showing {logs.length} of {total} logs
            </div>
            <div>
              Page {page} of {totalPages}
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">{error}</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No activity logs found</div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Time</TableHead>
                      <TableHead className="w-[80px]">Start</TableHead>
                      <TableHead className="w-[80px]">End</TableHead>
                      <TableHead className="w-[80px]">Duration</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead className="w-[120px]">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow
                      key={log.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(log)}
                    >
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {formatDateTime(log.created_at)}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {formatTimeHHMM(log.metadata?.start_time)}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {formatTimeHHMM(log.metadata?.end_time)}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {formatDurationHHMM(log.metadata?.duration_seconds)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="font-medium">
                            {log.profiles_actor?.full_name || 'Unknown'}
                          </div>
                          {log.profiles_actor?.full_name && log.profiles_actor?.email && (
                            <div className="text-xs text-muted-foreground">
                              {log.profiles_actor.email}
                            </div>
                          )}
                          {!log.profiles_actor?.full_name && log.profiles_actor?.email && (
                            <div className="text-xs text-muted-foreground">
                              {log.profiles_actor.email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {log.action.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {log.target_user_id ? (
                          <div className="space-y-0.5">
                            <div className={log.profiles_target?.full_name ? 'font-medium' : 'text-muted-foreground'}>
                              {log.profiles_target?.full_name || 'Unknown'}
                            </div>
                            {log.profiles_target?.full_name && log.profiles_target?.email && (
                              <div className="text-xs text-muted-foreground">
                                {log.profiles_target.email}
                              </div>
                            )}
                            {!log.profiles_target?.full_name && log.profiles_target?.email && (
                              <div className="text-xs text-muted-foreground">
                                {log.profiles_target.email}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {Object.keys(log.metadata || {}).length > 0 ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {Object.keys(log.metadata).length} field(s)
                            </span>
                            <Eye className="h-3 w-3 text-muted-foreground" />
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => {
                          if (page > 1) {
                            setPagination(page - 1, pageSize);
                          }
                        }}
                        className={page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <PaginationItem key={p}>
                        <PaginationLink
                          onClick={() => setPagination(p, pageSize)}
                          isActive={p === page}
                          className="cursor-pointer"
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => {
                          if (page < totalPages) {
                            setPagination(page + 1, pageSize);
                          }
                        }}
                        className={page === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <ActivityLogDialog
        open={showDialog}
        onClose={() => {
          setShowDialog(false);
          setSelectedLog(null);
        }}
        log={selectedLog}
      />
    </div>
  );
}

