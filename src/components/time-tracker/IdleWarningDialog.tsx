import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTimeTrackerStore } from '@/store/timeTrackerStore';

interface IdleWarningDialogProps {
  open: boolean;
  onContinue: () => void;
  onEndSession: () => void;
}

export function IdleWarningDialog({ open, onContinue, onEndSession }: IdleWarningDialogProps) {
  const updateIdleTime = useTimeTrackerStore((state) => state.updateIdleTime);

  const handleContinue = () => {
    updateIdleTime();
    onContinue();
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Inactivity Detected</AlertDialogTitle>
          <AlertDialogDescription>
            You have been inactive for more than 5 minutes. Would you like to continue your session or end it?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onEndSession}>
            End Session
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleContinue}>
            Continue Session
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}


