import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ROUTES_FRONTEND } from '@/constant';

export function RouteErrorBoundary() {
  const error = useRouteError();

  let message = 'Something went wrong.';
  let status: number | undefined;

  if (isRouteErrorResponse(error)) {
    status = error.status;
    message = error.statusText || error.data?.message || error.data?.toString?.() || message;
  } else if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-md w-full text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {status ? `Error ${status}` : 'Error'}
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 break-words">{message}</p>
        <div className="flex gap-3 justify-center">
          <Button asChild variant="outline">
            <Link to={ROUTES_FRONTEND.DASHBOARD}>Go to Dashboard</Link>
          </Button>
          <Button type="button" onClick={() => window.location.reload()}>
            Reload page
          </Button>
        </div>
      </div>
    </div>
  );
}
