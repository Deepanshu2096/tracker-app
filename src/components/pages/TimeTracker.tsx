import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useTimeTrackerStore } from '@/store/timeTrackerStore';
import { useAuth } from '@/hooks/useAuth';
import { LiveTimer } from '@/components/time-tracker/LiveTimer';
import { IdleWarningDialog } from '@/components/time-tracker/IdleWarningDialog';
import { formatDuration } from '@/lib/timeUtils';
import { isIdle } from '@/lib/timeUtils';
import { 
  Clock, 
  Play, 
  Square, 
  Coffee, 
  UtensilsCrossed, 
  Droplets, 
  MoreHorizontal,
  ChevronDown
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

const OTHER_BREAK_TYPES = [
  'Training',
  'Refresher',
  'Floor Activity',
  'Meeting',
  'Medical Break',
] as const;

export default function TimeTracker() {
  const {
    currentSession,
    activeBreaks,
    todayStats,
    lastActivityTime,
    isIdle: isIdleState,
    loading,
    checkIn,
    checkOut,
    startBreak,
    endBreak,
    updateIdleTime,
    refreshData,
    getCurrentSession,
    getTodayStats,
  } = useTimeTrackerStore();

  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const [sessionNotes, setSessionNotes] = useState('');
  const [otherBreakType, setOtherBreakType] = useState<string>('');
  const [showOtherBreakDropdown, setShowOtherBreakDropdown] = useState(false);
  const [justEndedSession, setJustEndedSession] = useState(false);
  const [justEndedBreak, setJustEndedBreak] = useState(false);

  // Load data on mount
  useEffect(() => {
    getCurrentSession();
    getTodayStats();
  }, [getCurrentSession, getTodayStats]);

  // Idle detection
  useEffect(() => {
    if (!currentSession) return;

    const interval = setInterval(() => {
      if (lastActivityTime) {
        const idle = isIdle(lastActivityTime, 5);
        if (idle && !showIdleWarning) {
          setShowIdleWarning(true);
        }
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [currentSession, lastActivityTime, showIdleWarning]);

  // Activity tracking
  useEffect(() => {
    if (!currentSession) return;

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    const handleActivity = () => {
      updateIdleTime();
      if (showIdleWarning) {
        setShowIdleWarning(false);
      }
    };

    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
    };
  }, [currentSession, updateIdleTime, showIdleWarning]);

  const handleCheckIn = async () => {
    await checkIn(sessionNotes || undefined);
    setSessionNotes('');
    updateIdleTime();
    setJustEndedSession(false);
    setJustEndedBreak(false);
  };

  const handleCheckOut = async () => {
    await checkOut();
    setJustEndedSession(true);
    setJustEndedBreak(false);
  };

  const handleStartBreak = async (type: 'lunch' | 'tea' | 'bio' | 'other') => {
    if (type === 'other' && !otherBreakType) {
      toast.error('Please select an "Other" break type');
      return;
    }
    await startBreak(type, otherBreakType || undefined);
    setOtherBreakType('');
    setShowOtherBreakDropdown(false);
    setJustEndedSession(false);
  };

  const handleEndBreak = async () => {
    const activeBreak = activeBreaks.find(b => !b.ended_at);
    if (activeBreak) {
      await endBreak(activeBreak.id);
      setJustEndedBreak(true);
      setJustEndedSession(false);
      // Clear break type selection
      setOtherBreakType('');
      setShowOtherBreakDropdown(false);
    }
  };

  const activeBreak = activeBreaks.find(b => !b.ended_at);
  const hasActiveBreak = !!activeBreak;
  // Only show check-in button when there's NO active session
  const hasActiveSession = !!(currentSession && currentSession.status === 'open');
  const sessionEnded = currentSession && currentSession.status === 'closed';
  
  // Reset flags when session/break state changes
  useEffect(() => {
    if (hasActiveSession) {
      setJustEndedSession(false);
      setJustEndedBreak(false);
    }
    if (hasActiveBreak) {
      setJustEndedBreak(false);
    }
  }, [hasActiveSession, hasActiveBreak]);

  // Calculate today's productive time (total time minus breaks)
  const productiveTime = todayStats.totalSeconds - todayStats.breakSeconds;

  return (
    <div className="space-y-6">
      {/* Header - Today's Productive Time */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Today's Productive Time</h1>
          <p className="text-muted-foreground">Tracked since midnight</p>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-6 w-6 text-primary" />
          {hasActiveSession ? (
            <LiveTimer 
              startTime={currentSession?.started_at || null}
              className="text-3xl font-bold text-primary"
            />
          ) : (
            <span className="text-3xl font-bold text-primary font-mono">
              {formatDuration(productiveTime, 'long')}
            </span>
          )}
        </div>
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Left Card - Work Session */}
        <Card>
          <CardHeader>
            <CardTitle>Work Session</CardTitle>
            <CardDescription>Start your work day</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasActiveSession ? (
              <>
                {/* STRICT RULE 6: If session is active, show only "Stop Session" button */}
                <div className="border border-dashed border-muted-foreground/20 rounded-lg p-4 bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    Your session is active and being tracked. Stop the session to take a break.
                  </p>
                </div>
                
                {/* Session Timer */}
                <div className="text-center py-4">
                  <div className="text-sm text-muted-foreground mb-2">Current Session</div>
                  <LiveTimer startTime={currentSession.started_at} className="text-2xl font-bold" />
                </div>

                {/* Stop Session Button */}
                <Button
                  size="lg"
                  variant="destructive"
                  className="w-full"
                  onClick={handleCheckOut}
                  disabled={loading}
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop Session
                </Button>
              </>
            ) : hasActiveBreak ? (
              <>
                {/* STRICT RULE 6: If break is active, disable "Start Session" */}
                <div className="border border-dashed border-muted-foreground/20 rounded-lg p-4 bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    You're currently on a break. End your break to start a new session.
                  </p>
                </div>
                
                {/* Notes Input (disabled) */}
                <div className="space-y-2 opacity-50">
                  <Label htmlFor="session-notes-disabled">Optional notes for session</Label>
                  <Textarea
                    id="session-notes-disabled"
                    placeholder="End your break to start a session"
                    value=""
                    disabled
                    rows={3}
                    className="resize-none"
                  />
                </div>

                {/* Check In Button (disabled) */}
                <Button
                  size="lg"
                  className="w-full bg-primary text-primary-foreground"
                  onClick={() => {}}
                  disabled={true}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Session (End break first)
                </Button>
              </>
            ) : justEndedBreak ? (
              <>
                {/* Break Ended - Show Start New Session */}
                <div className="border border-dashed border-muted-foreground/20 rounded-lg p-4 bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    Your break has ended. You can now start a new session.
                  </p>
                </div>
                
                {/* Notes Input */}
                <div className="space-y-2">
                  <Label htmlFor="session-notes">Optional notes for this session</Label>
                  <Textarea
                    id="session-notes"
                    placeholder="Enter session notes..."
                    value={sessionNotes}
                    onChange={(e) => setSessionNotes(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                </div>

                <Button
                  size="lg"
                  className="w-full bg-primary text-primary-foreground"
                  onClick={handleCheckIn}
                  disabled={loading}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start New Session
                </Button>
              </>
            ) : (
              <>
                {/* No Session - Check In */}
                <div className="border border-dashed border-muted-foreground/20 rounded-lg p-4 bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    You're currently checked out. Add optional notes and tap check in when you're ready.
                  </p>
                </div>
                
                {/* Notes Input */}
                <div className="space-y-2">
                  <Label htmlFor="session-notes">Optional notes for this session</Label>
                  <Textarea
                    id="session-notes"
                    placeholder="Enter session notes..."
                    value={sessionNotes}
                    onChange={(e) => setSessionNotes(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                </div>

                {/* Check In Button */}
                <Button
                  size="lg"
                  className="w-full bg-primary text-primary-foreground"
                  onClick={handleCheckIn}
                  disabled={loading}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Check In
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Right Card - Break Tracking */}
        <Card>
          <CardHeader>
            <CardTitle>Break Tracking</CardTitle>
            <CardDescription>Take a break when needed</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasActiveBreak ? (
              <>
                {/* Active Break Status */}
                <div className="border border-dashed border-muted-foreground/20 rounded-lg p-4 bg-muted/30">
                  <p className="text-sm text-muted-foreground mb-4">
                    You're currently on a break.
                  </p>
                  
                  {/* Break Timer */}
                  <div className="text-center py-4">
                    <div className="text-sm text-muted-foreground mb-2">
                      {activeBreak.type.charAt(0).toUpperCase() + activeBreak.type.slice(1)} Break
                    </div>
                    <LiveTimer startTime={activeBreak.started_at} className="text-2xl font-bold" />
                  </div>
                </div>

                {/* End Break Button */}
                <Button
                  size="lg"
                  variant="destructive"
                  className="w-full"
                  onClick={handleEndBreak}
                  disabled={loading}
                >
                  <Square className="h-4 w-4 mr-2" />
                  End Break
                </Button>
              </>
            ) : justEndedSession ? (
              <>
                {/* Session Ended - Show Start Break option */}
                <div className="border border-dashed border-muted-foreground/20 rounded-lg p-4 bg-muted/30 mb-4">
                  <p className="text-sm text-muted-foreground">
                    Your session has ended. Select a break type to start tracking your break.
                  </p>
                </div>

                {/* Break Type Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={() => handleStartBreak('lunch')}
                    disabled={loading}
                    className="flex flex-col items-center gap-2 h-auto py-6"
                  >
                    <UtensilsCrossed className="h-5 w-5" />
                    <span>Lunch</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleStartBreak('tea')}
                    disabled={loading}
                    className="flex flex-col items-center gap-2 h-auto py-6"
                  >
                    <Coffee className="h-5 w-5" />
                    <span>Tea</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleStartBreak('bio')}
                    disabled={loading}
                    className="flex flex-col items-center gap-2 h-auto py-6"
                  >
                    <Droplets className="h-5 w-5" />
                    <span>Bio</span>
                  </Button>
                  <div className="relative">
                    <Button
                      variant="outline"
                      onClick={() => setShowOtherBreakDropdown(!showOtherBreakDropdown)}
                      disabled={loading}
                      className="flex flex-col items-center gap-2 h-auto py-6 w-full"
                    >
                      <MoreHorizontal className="h-5 w-5" />
                      <div className="flex items-center gap-1">
                        <span>Other</span>
                        <ChevronDown className="h-4 w-4" />
                      </div>
                    </Button>
                    {showOtherBreakDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-background border rounded-md shadow-lg z-10">
                        <Select value={otherBreakType} onValueChange={setOtherBreakType}>
                          <SelectTrigger className="w-full border-0">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            {OTHER_BREAK_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="p-2">
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={() => handleStartBreak('other')}
                            disabled={!otherBreakType || loading}
                          >
                            Start {otherBreakType || 'Break'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* STRICT RULE 6: If session is active, disable all break buttons */}
                {hasActiveSession ? (
                  <>
                    {/* Active Session - Breaks Disabled */}
                    <div className="border border-dashed border-muted-foreground/20 rounded-lg p-4 bg-muted/30">
                      <p className="text-sm text-muted-foreground">
                        Stop your session first to start a break.
                      </p>
                    </div>

                    {/* Break Type Buttons (disabled) */}
                    <div className="grid grid-cols-2 gap-3 opacity-50 pointer-events-none">
                      <Button
                        variant="outline"
                        disabled={true}
                        className="flex flex-col items-center gap-2 h-auto py-6"
                      >
                        <UtensilsCrossed className="h-5 w-5" />
                        <span>Lunch</span>
                      </Button>
                      <Button
                        variant="outline"
                        disabled={true}
                        className="flex flex-col items-center gap-2 h-auto py-6"
                      >
                        <Coffee className="h-5 w-5" />
                        <span>Tea</span>
                      </Button>
                      <Button
                        variant="outline"
                        disabled={true}
                        className="flex flex-col items-center gap-2 h-auto py-6"
                      >
                        <Droplets className="h-5 w-5" />
                        <span>Bio</span>
                      </Button>
                      <Button
                        variant="outline"
                        disabled={true}
                        className="flex flex-col items-center gap-2 h-auto py-6 w-full"
                      >
                        <MoreHorizontal className="h-5 w-5" />
                        <span>Other</span>
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* No Active Session - Show Break Options */}
                    <div className="border border-dashed border-muted-foreground/20 rounded-lg p-4 bg-muted/30 mb-4">
                      <p className="text-sm text-muted-foreground">
                        Select a break type to start tracking your break.
                      </p>
                    </div>

                    {/* Break Type Buttons */}
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        variant="outline"
                        onClick={() => handleStartBreak('lunch')}
                        disabled={loading}
                        className="flex flex-col items-center gap-2 h-auto py-6"
                      >
                        <UtensilsCrossed className="h-5 w-5" />
                        <span>Lunch</span>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleStartBreak('tea')}
                        disabled={loading}
                        className="flex flex-col items-center gap-2 h-auto py-6"
                      >
                        <Coffee className="h-5 w-5" />
                        <span>Tea</span>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleStartBreak('bio')}
                        disabled={loading}
                        className="flex flex-col items-center gap-2 h-auto py-6"
                      >
                        <Droplets className="h-5 w-5" />
                        <span>Bio</span>
                      </Button>
                      <div className="relative">
                        <Button
                          variant="outline"
                          onClick={() => setShowOtherBreakDropdown(!showOtherBreakDropdown)}
                          disabled={loading}
                          className="flex flex-col items-center gap-2 h-auto py-6 w-full"
                        >
                          <MoreHorizontal className="h-5 w-5" />
                          <div className="flex items-center gap-1">
                            <span>Other</span>
                            <ChevronDown className="h-4 w-4" />
                          </div>
                        </Button>
                        {showOtherBreakDropdown && (
                          <div className="absolute top-full left-0 right-0 mt-2 bg-background border rounded-md shadow-lg z-10">
                            <Select value={otherBreakType} onValueChange={setOtherBreakType}>
                              <SelectTrigger className="w-full border-0">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                              <SelectContent>
                                {OTHER_BREAK_TYPES.map((type) => (
                                  <SelectItem key={type} value={type}>
                                    {type}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="p-2">
                              <Button
                                size="sm"
                                className="w-full"
                                onClick={() => handleStartBreak('other')}
                                disabled={!otherBreakType || loading}
                              >
                                Start {otherBreakType || 'Break'}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <IdleWarningDialog
        open={showIdleWarning}
        onContinue={() => setShowIdleWarning(false)}
        onEndSession={async () => {
          setShowIdleWarning(false);
          await handleCheckOut();
        }}
      />

    </div>
  );
}
