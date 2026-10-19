import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAttendanceStore } from '@/store/attendanceStore';
import { useAuth } from '@/hooks/useAuth';
import { formatDate, formatTime, getAttendanceStatus } from '@/lib/timeUtils';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { Users, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

export default function Attendance() {
  const { userRole, orgId } = useAuth();
  const {
    records,
    loading,
    error,
    total,
    dateFrom,
    dateTo,
    summary,
    page,
    pageSize,
    fetchAttendance,
    setDateRange,
    setPagination,
  } = useAttendanceStore();

  useEffect(() => {
    fetchAttendance(userRole, orgId);
  }, [userRole, orgId, dateFrom, dateTo, page, pageSize, fetchAttendance]);

  const totalPages = Math.ceil(total / pageSize);

  // Group records by date
  const groupedByDate = records.reduce((acc, record) => {
    const date = record.date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(record);
    return acc;
  }, {} as Record<string, typeof records>);

  const getStatusBadge = (hours: number) => {
    const status = getAttendanceStatus(hours);
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      'Full Day': 'default',
      'Half Day': 'secondary',
      'Partial': 'outline',
      'Miss': 'destructive',
    };
    return (
      <Badge variant={variants[status] || 'outline'}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
        <p className="text-muted-foreground">
          View attendance records and statistics
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalRecords}</div>
            <p className="text-xs text-muted-foreground">Attendance records</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Full Days</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.fullDays}</div>
            <p className="text-xs text-muted-foreground">8+ hours</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Half Days</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.halfDays}</div>
            <p className="text-xs text-muted-foreground">4-8 hours</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Partial Days</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.partialDays}</div>
            <p className="text-xs text-muted-foreground">Less than 4 hours</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Date Range</CardTitle>
          <CardDescription>Select the date range to view attendance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>From Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateFrom, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={(date) => {
                      if (date) {
                        setDateRange(date, dateTo);
                      }
                    }}
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
                    {format(dateTo, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={(date) => {
                      if (date) {
                        setDateRange(dateFrom, date);
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => setDateRange(subDays(new Date(), 30), new Date())}
              >
                Last 30 Days
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Attendance</CardTitle>
          <CardDescription>
            Attendance records grouped by date
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">{error}</div>
          ) : records.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No attendance records found</div>
          ) : (
            <>
              <div className="space-y-6">
                {Object.entries(groupedByDate)
                  .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                  .map(([date, dateRecords]) => {
                    const totalHours = dateRecords.reduce((sum, r) => {
                      return sum + ((r.duration_minutes || 0) / 60);
                    }, 0);
                    const status = getAttendanceStatus(totalHours);

                    return (
                      <div key={date} className="space-y-2">
                        <div className="flex items-center justify-between border-b pb-2">
                          <div>
                            <h3 className="font-semibold">{formatDate(date)}</h3>
                            <p className="text-sm text-muted-foreground">
                              {dateRecords.length} record(s) • {totalHours.toFixed(2)} hours
                            </p>
                          </div>
                          {getStatusBadge(totalHours)}
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {(userRole === 'admin' || userRole === 'manager') && (
                                <TableHead>Employee</TableHead>
                              )}
                              <TableHead>Check In</TableHead>
                              <TableHead>Check Out</TableHead>
                              <TableHead>Hours</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {dateRecords.map((record) => {
                              const hours = (record.duration_minutes || 0) / 60;
                              return (
                                <TableRow key={record.id}>
                                  {(userRole === 'admin' || userRole === 'manager') && (
                                    <TableCell>
                                      {record.profiles?.full_name || record.profiles?.email || 'Unknown'}
                                    </TableCell>
                                  )}
                                  <TableCell>
                                    <div>{formatDate(record.check_in)}</div>
                                    <div className="text-sm text-muted-foreground">
                                      {formatTime(record.check_in)}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {record.check_out ? (
                                      <>
                                        <div>{formatDate(record.check_out)}</div>
                                        <div className="text-sm text-muted-foreground">
                                          {formatTime(record.check_out)}
                                        </div>
                                      </>
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell>{hours.toFixed(2)}h</TableCell>
                                  <TableCell>{getStatusBadge(hours)}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    );
                  })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-2">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages} ({total} total)
                  </p>
                  <div className="flex items-center gap-1 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1"
                      onClick={() => setPagination(Math.max(1, page - 1), pageSize)}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    {(() => {
                      const maxButtons = 7;
                      const start = Math.max(1, page - Math.floor(maxButtons / 2));
                      const end = Math.min(totalPages, start + maxButtons - 1);
                      const from = Math.max(1, end - maxButtons + 1);
                      return Array.from({ length: end - from + 1 }, (_, i) => from + i).map((p) => (
                        <Button
                          key={p}
                          variant={page === p ? 'default' : 'outline'}
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => setPagination(p, pageSize)}
                        >
                          {p}
                        </Button>
                      ));
                    })()}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1"
                      onClick={() => setPagination(Math.min(totalPages, page + 1), pageSize)}
                      disabled={page >= totalPages}
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
    </div>
  );
}

