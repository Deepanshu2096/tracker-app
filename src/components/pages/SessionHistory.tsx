import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useSessionHistoryStore } from '@/store/sessionHistoryStore';
import { useAuth } from '@/hooks/useAuth';
import { formatDate, formatTime, formatDuration } from '@/lib/timeUtils';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface UserOption {
  id: string;
  full_name: string | null;
  email: string | null;
}

export default function SessionHistory() {
  const { userRole, orgId } = useAuth();
  const [users, setUsers] = useState<UserOption[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const {
    sessions,
    sessionsLoading,
    sessionsError,
    sessionsTotal,
    breaks,
    breaksLoading,
    breaksError,
    breaksTotal,
    sessionFilters,
    breakFilters,
    sessionsPage,
    sessionsPageSize,
    breaksPage,
    breaksPageSize,
    fetchSessions,
    fetchBreaks,
    setSessionFilters,
    setBreakFilters,
    setSessionsPagination,
    setBreaksPagination,
  } = useSessionHistoryStore();

  const isAdminOrManager = userRole === 'admin' || userRole === 'manager';

  // Fetch users for filter dropdown (only for admins/managers)
  useEffect(() => {
    const fetchUsers = async () => {
      if (!isAdminOrManager || !orgId) return;
      
      setUsersLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('org_id', orgId)
          .order('full_name', { ascending: true });

        if (error) throw error;
        setUsers(data || []);
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setUsersLoading(false);
      }
    };

    fetchUsers();
  }, [isAdminOrManager, orgId]);

  useEffect(() => {
    fetchSessions(userRole, orgId);
  }, [userRole, orgId, sessionFilters, sessionsPage, sessionsPageSize, fetchSessions]);

  useEffect(() => {
    fetchBreaks(userRole, orgId);
  }, [userRole, orgId, breakFilters, breaksPage, breaksPageSize, fetchBreaks]);

  const sessionsTotalPages = Math.ceil(sessionsTotal / sessionsPageSize);
  const breaksTotalPages = Math.ceil(breaksTotal / breaksPageSize);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Session History</h1>
        <p className="text-muted-foreground">
          View your work sessions and breaks
        </p>
      </div>

      <Tabs defaultValue="sessions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sessions">Sessions ({sessionsTotal})</TabsTrigger>
          <TabsTrigger value="breaks">Breaks ({breaksTotal})</TabsTrigger>
        </TabsList>

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Work Sessions</CardTitle>
              <CardDescription>Filter and view your work sessions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className={`grid grid-cols-1 gap-4 ${isAdminOrManager ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
                {isAdminOrManager && (
                  <div className="space-y-2">
                    <Label>User</Label>
                    <Select
                      value={sessionFilters.userId || 'all'}
                      onValueChange={(value) =>
                        setSessionFilters({ userId: value === 'all' ? null : value })
                      }
                      disabled={usersLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select user..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Users</SelectItem>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.full_name || user.email || 'Unknown'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={sessionFilters.status}
                    onValueChange={(value: 'all' | 'open' | 'closed') =>
                      setSessionFilters({ status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>From Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {sessionFilters.dateFrom
                          ? format(new Date(sessionFilters.dateFrom), 'PPP')
                          : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={sessionFilters.dateFrom ? new Date(sessionFilters.dateFrom) : undefined}
                        onSelect={(date) =>
                          setSessionFilters({ dateFrom: date ? date.toISOString() : null })
                        }
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>To Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {sessionFilters.dateTo
                          ? format(new Date(sessionFilters.dateTo), 'PPP')
                          : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={sessionFilters.dateTo ? new Date(sessionFilters.dateTo) : undefined}
                        onSelect={(date) =>
                          setSessionFilters({ dateTo: date ? date.toISOString() : null })
                        }
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={() => setSessionFilters({ status: 'all', dateFrom: null, dateTo: null, userId: null })}
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>

              {/* Table */}
              {sessionsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : sessionsError ? (
                <div className="text-center py-8 text-destructive">{sessionsError}</div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No sessions found</div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {(userRole === 'admin' || userRole === 'manager') && (
                          <TableHead>Employee</TableHead>
                        )}
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
                          {(userRole === 'admin' || userRole === 'manager') && (
                            <TableCell>
                              {session.profiles?.full_name || session.profiles?.email || 'Unknown'}
                            </TableCell>
                          )}
                          <TableCell>
                            <div>{formatDate(session.started_at)}</div>
                            <div className="text-sm text-muted-foreground">
                              {formatTime(session.started_at)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {session.ended_at ? (
                              <>
                                <div>{formatDate(session.ended_at)}</div>
                                <div className="text-sm text-muted-foreground">
                                  {formatTime(session.ended_at)}
                                </div>
                              </>
                            ) : (
                              <span className="text-muted-foreground">-</span>
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
                            {session.notes || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {sessionsTotalPages > 1 && (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-2">
                      <p className="text-sm text-muted-foreground">
                        Page {sessionsPage} of {sessionsTotalPages} ({sessionsTotal} total)
                      </p>
                      <div className="flex items-center gap-1 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1"
                          onClick={() => setSessionsPagination(Math.max(1, sessionsPage - 1), sessionsPageSize)}
                          disabled={sessionsPage <= 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        {(() => {
                          const maxButtons = 7;
                          const start = Math.max(1, sessionsPage - Math.floor(maxButtons / 2));
                          const end = Math.min(sessionsTotalPages, start + maxButtons - 1);
                          const from = Math.max(1, end - maxButtons + 1);
                          return Array.from({ length: end - from + 1 }, (_, i) => from + i).map((page) => (
                            <Button
                              key={page}
                              variant={sessionsPage === page ? 'default' : 'outline'}
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => setSessionsPagination(page, sessionsPageSize)}
                            >
                              {page}
                            </Button>
                          ));
                        })()}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1"
                          onClick={() => setSessionsPagination(Math.min(sessionsTotalPages, sessionsPage + 1), sessionsPageSize)}
                          disabled={sessionsPage >= sessionsTotalPages}
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Breaks Tab */}
        <TabsContent value="breaks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Breaks</CardTitle>
              <CardDescription>Filter and view your breaks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={breakFilters.type}
                    onValueChange={(value: 'all' | 'lunch' | 'tea' | 'bio' | 'other') =>
                      setBreakFilters({ type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="lunch">Lunch</SelectItem>
                      <SelectItem value="tea">Tea</SelectItem>
                      <SelectItem value="bio">Bio</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>From Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {breakFilters.dateFrom
                          ? format(new Date(breakFilters.dateFrom), 'PPP')
                          : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={breakFilters.dateFrom ? new Date(breakFilters.dateFrom) : undefined}
                        onSelect={(date) =>
                          setBreakFilters({ dateFrom: date ? date.toISOString() : null })
                        }
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>To Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {breakFilters.dateTo
                          ? format(new Date(breakFilters.dateTo), 'PPP')
                          : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={breakFilters.dateTo ? new Date(breakFilters.dateTo) : undefined}
                        onSelect={(date) =>
                          setBreakFilters({ dateTo: date ? date.toISOString() : null })
                        }
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={() => setBreakFilters({ type: 'all', dateFrom: null, dateTo: null })}
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>

              {/* Table */}
              {breaksLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : breaksError ? (
                <div className="text-center py-8 text-destructive">{breaksError}</div>
              ) : breaks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No breaks found</div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {(userRole === 'admin' || userRole === 'manager') && (
                          <TableHead>Employee</TableHead>
                        )}
                        <TableHead>Type</TableHead>
                        <TableHead>Start Time</TableHead>
                        <TableHead>End Time</TableHead>
                        <TableHead>Duration</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {breaks.map((breakItem) => (
                        <TableRow key={breakItem.id}>
                          {(userRole === 'admin' || userRole === 'manager') && (
                            <TableCell>
                              {breakItem.profiles?.full_name || breakItem.profiles?.email || 'Unknown'}
                            </TableCell>
                          )}
                          <TableCell>
                            <Badge variant="outline">
                              {breakItem.type.charAt(0).toUpperCase() + breakItem.type.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div>{formatDate(breakItem.started_at)}</div>
                            <div className="text-sm text-muted-foreground">
                              {formatTime(breakItem.started_at)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {breakItem.ended_at ? (
                              <>
                                <div>{formatDate(breakItem.ended_at)}</div>
                                <div className="text-sm text-muted-foreground">
                                  {formatTime(breakItem.ended_at)}
                                </div>
                              </>
                            ) : (
                              <Badge variant="default">Active</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {formatDuration(breakItem.duration_seconds)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {breaksTotalPages > 1 && (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-2">
                      <p className="text-sm text-muted-foreground">
                        Page {breaksPage} of {breaksTotalPages} ({breaksTotal} total)
                      </p>
                      <div className="flex items-center gap-1 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1"
                          onClick={() => setBreaksPagination(Math.max(1, breaksPage - 1), breaksPageSize)}
                          disabled={breaksPage <= 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        {(() => {
                          const maxButtons = 7;
                          const start = Math.max(1, breaksPage - Math.floor(maxButtons / 2));
                          const end = Math.min(breaksTotalPages, start + maxButtons - 1);
                          const from = Math.max(1, end - maxButtons + 1);
                          return Array.from({ length: end - from + 1 }, (_, i) => from + i).map((page) => (
                            <Button
                              key={page}
                              variant={breaksPage === page ? 'default' : 'outline'}
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => setBreaksPagination(page, breaksPageSize)}
                            >
                              {page}
                            </Button>
                          ));
                        })()}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1"
                          onClick={() => setBreaksPagination(Math.min(breaksTotalPages, breaksPage + 1), breaksPageSize)}
                          disabled={breaksPage >= breaksTotalPages}
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

