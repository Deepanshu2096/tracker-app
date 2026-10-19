 import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ROUTES_FRONTEND } from './constant';
import { RouteErrorBoundary } from './components/utils/RouteErrorBoundary';

import Login from './components/pages/Login';
import ResetPassword from '@/components/pages/ResetPassword';
import Signup from './components/pages/Signup';
import Invite from './components/pages/Invite';
import Layout from './components/utils/Layout';
import Team from './components/pages/Team';
import MemberRoom from './components/pages/MemberRoom';
import Dashboard from './components/pages/Dashboard';
import TimeTracker from './components/pages/TimeTracker';
import SessionHistory from './components/pages/SessionHistory';
import Attendance from './components/pages/Attendance';
import ActivityLogs from './components/pages/ActivityLogs';
import EmployeeProfile from './components/pages/EmployeeProfile';
import LeaveManagement from './components/pages/LeaveManagement';
import DailyAttendance from './components/pages/DailyAttendance';
import WeeklyPerformance from './components/pages/WeeklyPerformance';
import HRProfileRequests from './components/pages/HRProfileRequests';
import { PrivateRoute } from './components/utils/PrivateRoute';
import { RoleProtectedRoute } from './components/utils/RoleProtectedRoute';

export const router = createBrowserRouter([
  {
    path: ROUTES_FRONTEND.LOGIN,
    element: <Login />,
  },
  {
    path: ROUTES_FRONTEND.RESET_PASSWORD,
    element: <ResetPassword />,
  },
  {
    path: "/signup",
    element: <Signup />,
  },
  {
    path: "/invite/:token",
    element: <Invite />,
  },
  {
    path: "/",
    element: <PrivateRoute />,
    errorElement: <RouteErrorBoundary />,
    children: [
          {
            path: "/",
            element: <Layout />,
            children: [
              {
                index: true,
                element: <Navigate to={ROUTES_FRONTEND.DASHBOARD} replace />,
              },
              {
                path: ROUTES_FRONTEND.DASHBOARD,
                element: <Dashboard />,
              },
              {
                path: ROUTES_FRONTEND.TIME_TRACKER,
                element: <TimeTracker />,
              },
              {
                path: ROUTES_FRONTEND.PROFILE,
                element: <EmployeeProfile />,
              },
              {
                path: ROUTES_FRONTEND.PROFILE_EMPLOYEE,
                element: <EmployeeProfile />,
              },
              {
                path: ROUTES_FRONTEND.LEAVE_MANAGEMENT,
                element: <LeaveManagement />,
              },
              {
                path: ROUTES_FRONTEND.WEEKLY_PERFORMANCE,
                element: <WeeklyPerformance />,
              },
              {
                path: ROUTES_FRONTEND.DAILY_ATTENDANCE,
                element: <DailyAttendance />,
              },
              {
                element: <RoleProtectedRoute allowedRoles={['hr', 'admin', 'team_lead', 'tl', 'teamlead']} />,
                children: [
                  {
                    path: ROUTES_FRONTEND.HR_PROFILE_REQUESTS,
                    element: <HRProfileRequests />,
                  },
                ],
              },
              {
                // Admin, Manager, Team Lead routes (excluding employee and agent)
                element: <RoleProtectedRoute allowedRoles={['admin', 'manager', 'team_lead', 'tl', 'teamlead', 'qat', 'sme']} />,
                children: [
                  {
                    path: ROUTES_FRONTEND.TEAM,
                    element: <Team />,
                  },
                  {
                    path: '/team/member/:userId',
                    element: <MemberRoom />,
                  },
                  {
                    path: ROUTES_FRONTEND.SESSION_HISTORY,
                    element: <SessionHistory />,
                  },
                  {
                    path: ROUTES_FRONTEND.ATTENDANCE,
                    element: <Attendance />,
                  },
                  {
                    path: ROUTES_FRONTEND.ACTIVITY_LOGS,
                    element: <ActivityLogs />,
                  },
                  {
                    path: '/activity-log',
                    element: <Navigate to={ROUTES_FRONTEND.ACTIVITY_LOGS} replace />,
                  },
                ],
              },
            ],
          },
        ],
      }
  
]);