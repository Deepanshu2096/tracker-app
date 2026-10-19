import { Link, Outlet, useLocation } from "react-router";
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter, SidebarTrigger } from "@/components/ui/sidebar";
import { Users, LayoutDashboard, Clock, Calendar, FileText, Activity, User, CalendarDays, TrendingUp, ClipboardCheck, UserCog, Download } from "lucide-react";
import { NavUser } from "@/components/nav-user";
import { Button } from "@/components/ui/button";
import { ROUTES_FRONTEND } from "@/constant";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { usePageViewTracking } from "@/hooks/usePageViewTracking";
import { NotificationBar } from "@/components/notifications/NotificationBar";
import { SendNotificationDialog } from "@/components/notifications/SendNotificationDialog";

const allMenuItems = [
  { title: "Dashboard", id: "dashboard", icon: LayoutDashboard, path: ROUTES_FRONTEND.DASHBOARD, roles: ['admin', 'manager', 'team_lead', 'employee', 'l2', 'sme', 'qa', 'qat', 'st', 'hr'] },
  // { title: "Time Tracker", id: "time-tracker", icon: Clock, path: ROUTES_FRONTEND.TIME_TRACKER, roles: ['admin', 'manager', 'team_lead', 'employee', 'l2', 'sme', 'qa', 'qat', 'st'] },
  { title: "My Profile", id: "profile", icon: User, path: ROUTES_FRONTEND.PROFILE, roles: ['admin', 'manager', 'team_lead', 'employee', 'l2', 'sme', 'qa', 'qat', 'st', 'hr', 'it'] },
  { title: "Profile Requests", id: "hr-profile-requests", icon: UserCog, path: ROUTES_FRONTEND.HR_PROFILE_REQUESTS, roles: ['hr', 'admin', 'team_lead'] },
  { title: "Leave Management", id: "leave", icon: CalendarDays, path: ROUTES_FRONTEND.LEAVE_MANAGEMENT, roles: ['admin', 'manager', 'team_lead', 'employee', 'l2', 'sme', 'qa', 'qat', 'st', 'hr'] },
  { title: "Weekly Performance", id: "weekly-performance", icon: TrendingUp, path: ROUTES_FRONTEND.WEEKLY_PERFORMANCE, roles: ['admin', 'manager', 'team_lead', 'employee', 'l2', 'sme', 'qa', 'qat', 'st', 'hr'] },
  { title: "Teams", id: "teams", icon: Users, path: ROUTES_FRONTEND.TEAM, roles: ['admin', 'manager', 'team_lead', 'qat', 'sme'] },
  { title: "Session History", id: "sessions", icon: FileText, path: ROUTES_FRONTEND.SESSION_HISTORY, roles: ['admin', 'manager', 'team_lead'] },
  { title: "Attendance", id: "attendance", icon: Calendar, path: ROUTES_FRONTEND.ATTENDANCE, roles: ['admin', 'manager', 'team_lead'] },
  { title: "Daily Attendance", id: "daily-attendance", icon: ClipboardCheck, path: ROUTES_FRONTEND.DAILY_ATTENDANCE, roles: ['admin', 'manager', 'team_lead', 'employee', 'l2', 'sme', 'qa', 'qat', 'st', 'hr'] },
  { title: "Activity Logs", id: "activity-logs", icon: Activity, path: ROUTES_FRONTEND.ACTIVITY_LOGS, roles: ['admin', 'manager', 'team_lead'] },
];

function AppSidebar() {
  const location = useLocation();
  const { userRole } = useAuth();
  
  // Filter menu items based on user role
  const menuItems = allMenuItems.filter(item => {
    if (!userRole) return false;
    const normalizedRole = userRole.toLowerCase();
    return item.roles.some(role => role.toLowerCase() === normalizedRole);
  });

  return (
    <Sidebar>
      {/* Header */}
      <SidebarHeader>
        <div className="flex items-center gap-2 py-2">
          <img src="/B-logo.svg" alt="Anvesana 2.0 Logo" className="h-10 mt-2 w-auto text-primary my-auto rotate-y-180" /> 
          <div className="">
            <span className="font-semibold text-primary text-3xl tracking-tight">
              Anvesana 2.0
            </span>
            <p className="text-[0.7rem] text-sidebar-accent-foreground">by BergAi</p>
          </div>
        </div>
      </SidebarHeader>

      {/* Menu */}
      <SidebarContent>
        <SidebarGroup>
         
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location.pathname.includes(item.path);
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link to={item.path} className="w-full flex items-center gap-2">
                        <item.icon className="h-5 w-5" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="flex flex-col gap-2">
        <a href="/Anvesana%202.0%20time%20tracker%202.0.0.exe.zip" download="Anvesana 2.0 time tracker 2.0.0.exe.zip" className="w-full">
          <Button variant="outline" size="sm" className="w-full justify-start gap-2">
            <Download className="h-4 w-4" />
            Download App (ZIP)
          </Button>
        </a>
        <NavUser />
      </SidebarFooter>

    </Sidebar>
  );
}

const Dashboard = () => {
  const { userRole } = useAuth()
  // Track page views
  usePageViewTracking();
  console.log('userRole', userRole);
  // Function to get role badge styling
  const getRoleBadge = (role: string | null) => {
    if (!role) return null

    const normalizedRole = role.toLowerCase();
    const roleMap: Record<string, { label: string; variant: 'default' | 'destructive' }> = {
      'admin': { label: 'Admin', variant: 'destructive' },
      'manager': { label: 'Manager', variant: 'destructive' },
      'team_lead': { label: 'Team Lead', variant: 'default' },
      'teamlead': { label: 'Team Lead', variant: 'default' },
      'tl': { label: 'Team Lead', variant: 'default' },
      'employee': { label: 'Employee', variant: 'default' },
      'l2': { label: 'L2', variant: 'default' },
      'sme': { label: 'SME', variant: 'default' },
      'qa': { label: 'QA', variant: 'default' },
      'qat': { label: 'QAT', variant: 'default' },
      'st': { label: 'ST', variant: 'default' },
      'annotator': { label: 'Annotator', variant: 'default' },
      'reviewer': { label: 'Reviewer', variant: 'default' },
      'hr': { label: 'HR', variant: 'default' },
      'it': { label: 'IT', variant: 'default' },
    };
    
    const config = roleMap[normalizedRole] || { label: role.charAt(0).toUpperCase() + role.slice(1), variant: 'default' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };
  
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <main className="flex-1 min-w-0 overflow-x-hidden">
          {/* Top nav bar */}
            <div className="border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
              <div className="flex w-full h-14 justify-between items-center px-4">
                <SidebarTrigger />
                <div className="flex items-center gap-2">
                  <NotificationBar />
                  <SendNotificationDialog />
                  {userRole ? getRoleBadge(userRole) : <Badge variant="outline" className="mx-3 text-lg">Guest</Badge>}
                </div>
              </div>
            </div>

            {/* Routed page */}
            <div className="p-6">
              <Outlet />
            </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;
