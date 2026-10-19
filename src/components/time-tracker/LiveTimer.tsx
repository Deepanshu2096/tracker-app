import { useEffect, useState } from 'react';
import { formatDuration } from '@/lib/timeUtils';

interface LiveTimerProps {
  startTime: string | null;
  className?: string;
}

export function LiveTimer({ startTime, className }: LiveTimerProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime) {
      setElapsed(0);
      return;
    }

    const interval = setInterval(() => {
      const start = new Date(startTime);
      const now = new Date();
      const diffSeconds = Math.floor((now.getTime() - start.getTime()) / 1000);
      setElapsed(Math.max(0, diffSeconds));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <div className={className}>
      <span className="font-mono text-2xl font-bold">
        {formatDuration(elapsed, 'long')}
      </span>
    </div>
  );
}


