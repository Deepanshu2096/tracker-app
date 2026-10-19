import { useEffect } from 'react';
import { useNavigate, Outlet } from 'react-router';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES_FRONTEND } from '@/constant';

interface RoleProtectedRouteProps {
  allowedRoles?: string[];
}

export function RoleProtectedRoute({ allowedRoles }: RoleProtectedRouteProps) {
  const { user, loading, userRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // If not authenticated and not loading, redirect to login
    if (!loading && !user) {
      navigate(ROUTES_FRONTEND.LOGIN);
      return;
    }

    // If authenticated but role doesn't match, redirect to dashboard
    if (!loading && user && allowedRoles && userRole) {
      const normalizedRole = userRole.toLowerCase();
      const hasAccess = allowedRoles.some(role => role.toLowerCase() === normalizedRole);
      
      if (!hasAccess) {
        navigate(ROUTES_FRONTEND.DASHBOARD);
      }
    }
  }, [user, loading, userRole, allowedRoles, navigate]);

  // Show loading state while checking authentication
  if (loading) {
    return <div>Loading...</div>;
  }

  // If not authenticated, don't render anything (will redirect)
  if (!user) {
    return null;
  }

  // If role-based protection is enabled, check role
  if (allowedRoles && userRole) {
    const normalizedRole = userRole.toLowerCase();
    const hasAccess = allowedRoles.some(role => role.toLowerCase() === normalizedRole);
    
    if (!hasAccess) {
      return null; // Will redirect in useEffect
    }
  }

  // If authenticated and has access, allow access to protected routes
  return <Outlet />;
}


