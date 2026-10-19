import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";
import {
  Plus,
  Edit,
  Trash2,
  Users,
  AlertCircle,
  ArrowUpDown,
  ChevronDown,
  MoreHorizontal,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  Mail,
  Copy,
  Send,
  Upload,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


// Hooks and constants
import { useTeamStore, type TeamMember, type Group } from '@/store/teamStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useAuth } from '@/hooks/useAuth';
import { useForm } from 'react-hook-form';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ROUTES_FRONTEND } from '@/constant';
import { Textarea } from '@/components/ui/textarea';

// Types
interface FormData {
  name: string;
  email: string;
  role: string;
  status: string;
}

const VALID_ROLES = ['admin', 'manager', 'team_lead', 'employee', 'l2', 'sme', 'qa', 'qat', 'st', 'hr', 'it'];
const DEFAULT_ROLE = 'employee';

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += c;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

interface BulkInviteRow {
  email: string;
  name: string;
  role: string;
  error?: string;
}
export default function Team() {
  const navigate = useNavigate();
  const [openSheet, setOpenSheet] = useState(false);
  const [openTeamMembersDialog, setOpenTeamMembersDialog] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({ id: false }); // id column hidden (Employee ID commented out, kept for search filter)
  const [rowSelection, setRowSelection] = useState({});
  const [teamMembers, setTeamMembers] = useState<string[]>([]);
  const [availableUsers, setAvailableUsers] = useState<TeamMember[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSessions, setActiveSessions] = useState<Set<string>>(new Set());
  // Team Lead Management (admin/manager)
  const [selectedTlId, setSelectedTlId] = useState<string | null>(null);
  const [tlMembersList, setTlMembersList] = useState<TeamMember[]>([]);
  const [assignableList, setAssignableList] = useState<TeamMember[]>([]);
  const [openAddToTlDialog, setOpenAddToTlDialog] = useState(false);
  const [openReassignDialog, setOpenReassignDialog] = useState(false);
  const [memberToReassign, setMemberToReassign] = useState<TeamMember | null>(null);
  // Create group (Manager: one group = one TL + members)
  const [openCreateGroupDialog, setOpenCreateGroupDialog] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupTlId, setNewGroupTlId] = useState<string | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);
  const [openNotifyTeamDialog, setOpenNotifyTeamDialog] = useState(false);
  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyMessage, setNotifyMessage] = useState('');
  const [notifySending, setNotifySending] = useState(false);
  // Bulk invite (CSV)
  const [openBulkInviteDialog, setOpenBulkInviteDialog] = useState(false);
  const [bulkCsvRows, setBulkCsvRows] = useState<BulkInviteRow[]>([]);
  const [bulkInviteSending, setBulkInviteSending] = useState(false);
  const [bulkInviteProgress, setBulkInviteProgress] = useState({ sent: 0, failed: 0, total: 0 });
  const [bulkInviteDone, setBulkInviteDone] = useState(false);
  const [bulkInviteResultsByEmail, setBulkInviteResultsByEmail] = useState<Record<string, { success: boolean; message?: string }>>({});
  const SHOW_BULK_INVITE = false; // Hidden for now; set to true to re-enable

  const { 
    profiles, 
    loading, 
    error, 
    getProfiles, 
    getTeamMembersFromProfile,
    addTeamMember,
    removeTeamMember,
    updateMemberStatus, 
    sendInvite, 
    removeMember,
    getInvites,
    resendInvite,
    invites,
    invitesLoading,
    teams,
    getTeams,
    teamLeads,
    getTeamLeads,
    getMembersByTeamLead,
    getAssignableEmployeesForTL,
    assignEmployeeToTeamLead,
    removeEmployeeFromTeamLead,
    reassignEmployeeToTeamLead,
    groups,
    getGroups,
    createGroup,
    deleteGroup,
  } = useTeamStore();
  const { sendNotification } = useNotificationStore();
  const { user, orgId, userRole } = useAuth();
  const { toast } = useToast();
  const [resendingToken, setResendingToken] = useState<string | null>(null);
  const INVITES_PAGE_SIZE = 10;
  const [invitesPage, setInvitesPage] = useState(1);
  const [invitesStatusFilter, setInvitesStatusFilter] = useState<'all' | 'pending' | 'expired' | 'accepted'>('all');
  const [invitesSearchQuery, setInvitesSearchQuery] = useState('');
  const invitesList = invites ?? [];
  const filteredInvitesList = (() => {
    let list = invitesList;
    const q = invitesSearchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (inv) =>
          (inv.email?.toLowerCase().includes(q)) ||
          (inv.name?.toLowerCase().includes(q)) ||
          (inv.role?.toLowerCase().includes(q))
      );
    }
    if (invitesStatusFilter !== 'all') {
      const now = new Date();
      list = list.filter((inv) => {
        const isExpired = new Date(inv.expires_at) < now;
        const isAccepted = Boolean(inv.accepted_at);
        if (invitesStatusFilter === 'pending') return !isAccepted && !isExpired;
        if (invitesStatusFilter === 'expired') return !isAccepted && isExpired;
        if (invitesStatusFilter === 'accepted') return isAccepted;
        return true;
      });
    }
    return list;
  })();
  const invitesTotalPages = Math.max(1, Math.ceil(filteredInvitesList.length / INVITES_PAGE_SIZE));
  const invitesPageClamped = Math.min(invitesPage, invitesTotalPages);
  const paginatedInvites = filteredInvitesList.slice(
    (invitesPageClamped - 1) * INVITES_PAGE_SIZE,
    invitesPageClamped * INVITES_PAGE_SIZE
  );

  // #region agent log
  (() => {
    const r = userRole ? String(userRole).toLowerCase().trim() : null;
    const canTL = r === 'admin' || r === 'manager';
    fetch('http://127.0.0.1:7243/ingest/ae5c929b-a368-47a0-9b09-fb93832ffb13', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'Team.tsx:auth', message: 'Team page auth state', data: { userRole, orgId: orgId ?? null, canManageTLAssignments: canTL }, timestamp: Date.now(), hypothesisId: 'H1-H2' }) }).catch(() => {});
  })();
  // #endregion

  // Helper function to check if user can manage team members (admin, team_lead, HR, manager)
  const canManageTeamMembers = () => {
    if (!userRole) {
      return false;
    }
    const role = String(userRole).toLowerCase().trim();
    return ['admin', 'team_lead', 'hr', 'manager', 'tl', 'teamlead'].includes(role);
  };

  // Admin, manager, HR, team lead, and SME can send invites and see pending invites.
  const canManageTeamMembersList = () => {
    if (!userRole) return false;
    const role = String(userRole).toLowerCase().trim();
    return ['admin', 'hr', 'manager', 'team_lead', 'tl', 'teamlead', 'sme'].includes(role);
  };

  // Helper function to check if user can see roles
  const canSeeRoles = () => {
    if (!userRole) {
      return false;
    }
    const role = String(userRole).toLowerCase().trim();
    return ['admin', 'manager', 'team_lead', 'tl', 'teamlead', 'hr'].includes(role);
  };

  // Helper function to check if user is admin (only admins can remove members)
  const isAdmin = () => {
    if (!userRole) {
      return false;
    }
    const role = String(userRole).toLowerCase().trim();
    return role === 'admin';
  };

  // Admin and manager can remove members from the org
  const canRemoveMember = () => {
    if (!userRole) return false;
    const role = String(userRole).toLowerCase().trim();
    return role === 'admin' || role === 'manager';
  };

  // Helper: admin, manager, or team lead can manage TL assignments (team lead only their own group)
  const canManageTLAssignments = () => {
    if (!userRole) return false;
    const r = String(userRole).toLowerCase().trim();
    return r === 'admin' || r === 'manager' || r === 'team_lead' || r === 'tl' || r === 'teamlead';
  };

  // Team lead creating their own group: only they can be the TL
  const currentUserTlProfile = (teamLeads ?? []).find((tl) => tl.user_id === user?.id);
  const isTeamLeadForGroups = Boolean(
    userRole && currentUserTlProfile && ['team_lead', 'tl', 'teamlead'].includes(String(userRole).toLowerCase().trim())
  );
  const teamLeadsForSelect = isTeamLeadForGroups && currentUserTlProfile
    ? [currentUserTlProfile]
    : (teamLeads ?? []);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    reset,
    setValue,
    watch
  } = useForm<FormData>({
    mode: 'onChange',
    defaultValues: {
      name: '',
      email: '',
      role: '',
      status: 'active'
    }
  });

  useEffect(() => {
    setInvitesPage(1);
  }, [invitesStatusFilter, invitesSearchQuery]);

  useEffect(() => {
    if (!orgId || !user) return;
    
    // Load team members if user can manage them (team_lead, HR, manager)
    if (canManageTeamMembers() && user.id && orgId) {
      loadTeamMembers();
      getInvites(orgId);
    } else if (canManageTeamMembersList() && user.id && orgId) {
      // SME (and others who can send invites but not manage team list) need invites loaded
      getInvites(orgId);
    }
    
    // Load team leads and groups for admin/manager (TL Management / Groups)
    if (canManageTLAssignments() && orgId) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/ae5c929b-a368-47a0-9b09-fb93832ffb13', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'Team.tsx:useEffect', message: 'Calling getTeamLeads', data: { orgId }, timestamp: Date.now(), hypothesisId: 'H2' }) }).catch(() => {});
      // #endregion
      getTeamLeads(orgId);
      getGroups(orgId);
    }
    
    // Fetch profiles (will filter by team_members for authorized roles, or show only own profile for others)
    getProfiles(orgId);
    // Load teams so we can show team name in the Team Members table
    getTeams(orgId);
  }, [orgId, user?.id]);

  // Load members for selected TL
  useEffect(() => {
    if (!selectedTlId) {
      setTlMembersList([]);
      return;
    }
    getMembersByTeamLead(selectedTlId).then(setTlMembersList);
  }, [selectedTlId, getMembersByTeamLead]);

  // MOCK DATA: Set mock active sessions
  useEffect(() => {
    if (!profiles || profiles.length === 0) return;
    
    // MOCK DATA: Randomly mark some profiles as active (60% active)
    const mockActiveIds = new Set<string>();
    profiles.forEach((profile, index) => {
      if (index % 3 !== 0) { // ~66% active
        mockActiveIds.add(profile.id);
      }
    });
    setActiveSessions(mockActiveIds);
  }, [profiles]);

  // Load team members from profile
  const loadTeamMembers = async () => {
    if (!user?.id) return;
    try {
      const memberIds = await getTeamMembersFromProfile(user.id);
      setTeamMembers(memberIds);
    } catch (error: any) {
      console.error('Error loading team members:', error);
    }
  };

  // Load available users for team member selection
  const loadAvailableUsers = async () => {
    if (!orgId || !canManageTeamMembers()) return;
    try {
      // Get all accessible users based on hierarchy
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      // Fetch all profiles in org (we'll filter client-side)
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, user_id, org_id, role, status')
        .eq('org_id', orgId);

      if (error) {
        console.error('Error fetching available users:', error);
        return;
      }

      // Filter out current user and users already in team_members
      const filtered = (data || []).filter(
        (p: any) => p.user_id !== user?.id && !teamMembers.includes(p.user_id)
      );

      setAvailableUsers(filtered.map((profile: any) => ({
        ...profile,
        role_id: profile.role || '',
        user_roles: { role: profile.role || '' }
      })));
    } catch (error) {
      console.error('Error loading available users:', error);
    }
  };

  // Handle add team member
  const handleAddTeamMember = async (userId: string) => {
    try {
      await addTeamMember(userId);
      await loadTeamMembers();
      await getProfiles(orgId!);
      toast({
        title: "Success",
        description: "Team member added successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add team member",
        variant: "destructive",
      });
    }
  };

  // Handle remove team member
  const handleRemoveTeamMember = async (userId: string) => {
    try {
      await removeTeamMember(userId);
      await loadTeamMembers();
      await getProfiles(orgId!);
      toast({
        title: "Success",
        description: "Team member removed successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to remove team member",
        variant: "destructive",
      });
    }
  };

  // Team Lead Management handlers
  const handleOpenAddToTl = async () => {
    if (!orgId || !selectedTlId) return;
    const memberIds = tlMembersList.map(m => m.user_id);
    const list = await getAssignableEmployeesForTL(orgId, memberIds);
    setAssignableList(list);
    setOpenAddToTlDialog(true);
  };
  const handleAssignToTl = async (employeeUserId: string) => {
    if (!selectedTlId) return;
    try {
      await assignEmployeeToTeamLead(employeeUserId, selectedTlId);
      const updated = await getMembersByTeamLead(selectedTlId);
      setTlMembersList(updated);
      setAssignableList(prev => prev.filter(p => p.user_id !== employeeUserId));
      toast({ title: "Success", description: "Employee assigned to team lead" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to assign", variant: "destructive" });
    }
  };
  const handleRemoveFromTl = async (employeeUserId: string) => {
    try {
      await removeEmployeeFromTeamLead(employeeUserId);
      if (selectedTlId) {
        const updated = await getMembersByTeamLead(selectedTlId);
        setTlMembersList(updated);
      }
      toast({ title: "Success", description: "Employee removed from team lead" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to remove", variant: "destructive" });
    }
  };
  const handleReassignToTl = async (employeeUserId: string, newTlProfileId: string) => {
    try {
      await reassignEmployeeToTeamLead(employeeUserId, newTlProfileId);
      if (selectedTlId) {
        const updated = await getMembersByTeamLead(selectedTlId);
        setTlMembersList(updated);
      }
      setOpenReassignDialog(false);
      setMemberToReassign(null);
      toast({ title: "Success", description: "Employee reassigned to new team lead" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to reassign", variant: "destructive" });
    }
  };

  const handleCreateGroup = async () => {
    if (!orgId || !newGroupName.trim() || !newGroupTlId) {
      toast({ title: "Validation", description: "Enter group name and select a Team Lead.", variant: "destructive" });
      return;
    }
    try {
      await createGroup(newGroupName.trim(), newGroupTlId, orgId);
      setOpenCreateGroupDialog(false);
      setNewGroupName('');
      setNewGroupTlId(null);
      toast({ title: "Success", description: "Group created. Add members via Manage." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to create group", variant: "destructive" });
    }
  };

  const handleDeleteGroup = async () => {
    if (!groupToDelete) return;
    try {
      await deleteGroup(groupToDelete.id);
      setGroupToDelete(null);
      if (selectedTlId === groupToDelete.team_lead_id) {
        setSelectedTlId(null);
        setTlMembersList([]);
      }
      toast({ title: "Success", description: "Group removed." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to delete group", variant: "destructive" });
    }
  };

  const handleSendNotificationToTeam = async () => {
    if (!notifyTitle.trim() || !notifyMessage.trim()) {
      toast({ title: "Validation", description: "Title and message are required", variant: "destructive" });
      return;
    }
    if (profiles.length === 0 || !orgId) {
      toast({ title: "No members", description: "There are no team members to notify.", variant: "destructive" });
      return;
    }
    setNotifySending(true);
    try {
      let success = 0;
      let failed = 0;
      for (const p of profiles) {
        const result = await sendNotification(
          orgId,
          notifyTitle.trim(),
          notifyMessage.trim(),
          'info',
          p.id
        );
        if (result.success) success++; else failed++;
      }
      setOpenNotifyTeamDialog(false);
      setNotifyTitle('');
      setNotifyMessage('');
      toast({
        title: "Notifications sent",
        description: failed === 0 ? `Sent to ${success} member(s).` : `Sent to ${success} member(s). ${failed} failed.`,
      });
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to send notifications", variant: "destructive" });
    } finally {
      setNotifySending(false);
    }
  };

  const getRoleBadge = (role: string) => {
    const roleName = role|| 'Unknown';
    return (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
        {roleName}
      </Badge>
    );
  };

  const handleStatusChange = async (memberId: string, newStatus: string) => {
    try {
      await updateMemberStatus(memberId, newStatus);
      toast({
        title: "Success",
        description: `Status updated to ${newStatus}`,
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    if (!orgId) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', memberId);
      if (error) throw error;
      await getProfiles(orgId);
      if (canManageTLAssignments()) {
        await getTeamLeads(orgId);
      }
      toast({
        title: "Success",
        description: `Role updated to ${newRole.replace(/_/g, ' ')}`,
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to update role",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (member: TeamMember) => {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/ae5c929b-a368-47a0-9b09-fb93832ffb13', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'Team.tsx:handleDelete', message: 'handleDelete called', data: { orgId: orgId ?? null, memberId: member?.id, memberUserId: member?.user_id }, timestamp: Date.now(), hypothesisId: 'H2-H5' }) }).catch(() => {});
    // #endregion
    if (!orgId) return;
    try {
      await removeMember(orgId, member.user_id);
      // Refresh the profiles list
      await getProfiles(orgId);
      toast({
        title: "Success",
        description: "Team member removed successfully!",
      });
    } catch (err: any) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/ae5c929b-a368-47a0-9b09-fb93832ffb13', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'Team.tsx:handleDelete_catch', message: 'handleDelete error', data: { errorMessage: err?.message ?? String(err) }, timestamp: Date.now(), hypothesisId: 'H3' }) }).catch(() => {});
      // #endregion
      toast({
        title: "Error",
        description: "Failed to remove team member. Please try again.",
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (data: FormData) => {
    try {
      if (editingMember) {
        // Update existing member (profiles table uses full_name, not name)
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: data.name,
            email: data.email,
            role: data.role,
            status: data.status
          })
          .eq('id', editingMember.id);

        if (error) {
          throw error;
        }

        // Refresh profiles and team leads (so "Select Team Lead" updates when role set to Team Lead)
        if (orgId) {
          await getProfiles(orgId);
          if (canManageTLAssignments()) {
            await getTeamLeads(orgId);
          }
        }

        toast({
          title: "Success",
          description: "Team member updated successfully!",
        });
      } else {
        // Validate and sanitize email before sending
        const email = typeof data.email === 'string' ? data.email.trim() : String(data.email).trim();
        
        // Additional safety checks
        if (!email || email.length === 0) {
          toast({
            title: "Validation Error",
            description: "Email cannot be empty",
            variant: "destructive",
          });
          return;
        }
        
        if (email.length > 320) {
          toast({
            title: "Validation Error",
            description: "Email must be 320 characters or less",
            variant: "destructive",
          });
          return;
        }
        
        // Ensure email is a string (not an object)
        if (typeof email !== 'string') {
          toast({
            title: "Validation Error",
            description: "Invalid email format",
            variant: "destructive",
          });
          return;
        }
        
        // Send invite to new member with sanitized email
        // Team selection for invite is optional
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/ae5c929b-a368-47a0-9b09-fb93832ffb13', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'Team.tsx:onSubmit_before_sendInvite', message: 'Invite form submit calling sendInvite', data: { orgId: orgId ?? null, email, role: data.role, name: data.name, hasOrgId: Boolean(orgId) }, timestamp: Date.now(), hypothesisId: 'H1' }) }).catch(() => {});
        // #endregion
        const {success , message} = await sendInvite(email, data.role, data.name, orgId!, null);
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/ae5c929b-a368-47a0-9b09-fb93832ffb13', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'Team.tsx:onSubmit_after_sendInvite', message: 'sendInvite returned', data: { success, message: message?.slice(0, 80) }, timestamp: Date.now(), hypothesisId: 'H1' }) }).catch(() => {});
        // #endregion
        if(!success){
          const isAlreadyExists = message?.startsWith('Already Exists');
          const isAlreadyPending = message?.includes('invite is already pending');
          const title = isAlreadyExists ? 'Already Exists' : isAlreadyPending ? 'Invite already pending' : 'Invitation failed';
          toast({
            title,
            description: message,
            variant: "destructive",
          });
        }
        else{
          toast({
            title: "Success",
            description: "Invitation sent successfully",
          });
          if (orgId) getInvites(orgId);
        }
        
      }
      
      reset();
      setEditingMember(null);
      setOpenSheet(false);
    } catch {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleBulkCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.name.toLowerCase().endsWith('.csv')) {
      toast({ title: 'Invalid file', description: 'Please upload a CSV file.', variant: 'destructive' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) {
        setBulkCsvRows([]);
        toast({ title: 'Empty file', description: 'CSV has no rows.', variant: 'destructive' });
        return;
      }
      const parsed: BulkInviteRow[] = [];
      const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
      let start = 0;
      const firstCells = parseCSVLine(lines[0]);
      if (firstCells.length > 0 && /^email$/i.test(firstCells[0].trim())) {
        start = 1;
      }
      for (let i = start; i < lines.length; i++) {
        const cells = parseCSVLine(lines[i]);
        const email = (cells[0] ?? '').trim();
        const name = (cells[1] ?? '').trim();
        const roleRaw = (cells[2] ?? DEFAULT_ROLE).trim().toLowerCase();
        const role = VALID_ROLES.includes(roleRaw) ? roleRaw : DEFAULT_ROLE;
        let error: string | undefined;
        if (!email) error = 'Email required';
        else if (!emailRegex.test(email)) error = 'Invalid email';
        parsed.push({ email, name, role, error });
      }
      setBulkCsvRows(parsed);
      setBulkInviteDone(false);
      setBulkInviteResultsByEmail({});
      setBulkInviteProgress({ sent: 0, failed: 0, total: parsed.length });
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleBulkSendInvites = async () => {
    if (!orgId || bulkCsvRows.length === 0) return;
    const valid = bulkCsvRows.filter((r) => !r.error);
    if (valid.length === 0) {
      toast({ title: 'No valid rows', description: 'Fix errors in the CSV or add at least one valid row.', variant: 'destructive' });
      return;
    }
    setBulkInviteSending(true);
    setBulkInviteProgress({ sent: 0, failed: 0, total: valid.length });
    setBulkInviteResultsByEmail({});
    const resultsByEmail: Record<string, { success: boolean; message?: string }> = {};
    let sent = 0;
    let failed = 0;
    for (let i = 0; i < valid.length; i++) {
      const row = valid[i];
      const { success, message } = await sendInvite(row.email, row.role, row.name || '', orgId, null);
      resultsByEmail[row.email] = { success, message };
      if (success) sent++; else failed++;
      setBulkInviteProgress({ sent, failed, total: valid.length });
      setBulkInviteResultsByEmail({ ...resultsByEmail });
    }
    setBulkInviteSending(false);
    setBulkInviteDone(true);
    if (orgId) getInvites(orgId);
    toast({
      title: 'Bulk invite complete',
      description: `${sent} sent, ${failed} failed.`,
      variant: failed > 0 ? 'destructive' : 'default',
    });
  };

  const closeBulkInviteDialog = () => {
    setOpenBulkInviteDialog(false);
    setBulkCsvRows([]);
    setBulkInviteDone(false);
    setBulkInviteResultsByEmail({});
    setBulkInviteProgress({ sent: 0, failed: 0, total: 0 });
  };

  // Define columns for TanStack Table
  const columns: ColumnDef<TeamMember>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    /* Employee ID column commented out
    {
      accessorKey: "id",
      header: "Employee ID",
      cell: ({ row }) => {
        const member = row.original;
        return (
          <div className="font-mono text-sm">
            {member.id}
          </div>
        );
      },
      filterFn: (row, id, value) => {
        const member = row.original;
        const searchValue = String(value || '').toLowerCase();
        return (
          member.id?.toLowerCase().includes(searchValue) ||
          member.user_id?.toLowerCase().includes(searchValue) ||
          member.full_name?.toLowerCase().includes(searchValue) ||
          member.email?.toLowerCase().includes(searchValue)
        );
      },
    },
    */
    {
      accessorKey: "id",
      header: () => null,
      cell: () => null,
      enableHiding: true,
      filterFn: (row, id, value) => {
        const member = row.original;
        const searchValue = String(value || '').toLowerCase();
        return (
          member.id?.toLowerCase().includes(searchValue) ||
          member.user_id?.toLowerCase().includes(searchValue) ||
          member.full_name?.toLowerCase().includes(searchValue) ||
          member.email?.toLowerCase().includes(searchValue)
        );
      },
    },
    {
      id: "active_session",
      header: "Status",
      cell: ({ row }) => {
        const member = row.original;
        const isActive = activeSessions.has(member.id);
        return (
          <Badge variant={isActive ? 'default' : 'outline'}>
            {isActive ? 'Active' : 'Offline'}
          </Badge>
        );
      },
    },
    {
      accessorKey: "name",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const member = row.original;
        return (
          <div 
            className="flex items-center space-x-3 cursor-pointer hover:opacity-80"
            onClick={() => navigate(`/profile/${member.employee_number ?? member.user_id ?? member.id}`)}
          >
            <Avatar className="h-10 w-10 bg-purple-100">
              <AvatarFallback className="bg-purple-100 text-purple-600 font-medium">
                {member.full_name?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium text-gray-900">
                {member.full_name || 'Unnamed User'} { member.user_id === user?.id && "(You)"}
              </div>
              <div className="text-sm text-gray-500">
                {member.email || `ID: ${member.user_id.slice(0, 8)}...`}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "email",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Email
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => (
        <div className="text-sm text-gray-600">
          {row.getValue("email") || 'No email'}
        </div>
      ),
    },
    {
      accessorKey: "role_id",
      header: "Role",
      cell: ({ row }) => {
        const member = row.original;
        if (!canSeeRoles()) {
          return <div className="text-sm text-gray-400">—</div>;
        }
        const currentRole = member.user_roles?.role ?? member.role_id ?? '';
        if (canManageTeamMembers()) {
          return (
            <Select
              value={currentRole || 'employee'}
              onValueChange={(value) => handleRoleChange(member.id, value)}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="team_lead">Team Lead</SelectItem>
                <SelectItem value="employee">Employee</SelectItem>
                <SelectItem value="l2">L2</SelectItem>
                <SelectItem value="sme">SME</SelectItem>
                <SelectItem value="qa">QA</SelectItem>
                <SelectItem value="qat">QAT</SelectItem>
                <SelectItem value="st">ST</SelectItem>
                <SelectItem value="hr">HR</SelectItem>
                <SelectItem value="it">IT</SelectItem>
              </SelectContent>
            </Select>
          );
        }
        return getRoleBadge(currentRole);
      },
      filterFn: (row, id, value) => {
        const member = row.original;
        return value === (member.user_roles?.role ?? member.role_id);
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const member = row.original;
        return (
          <Select
            value={member.status || 'inactive'}
            onValueChange={(value) => handleStatusChange(member.id, value)}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="on_leave">On Leave</SelectItem>
              <SelectItem value="terminated">Terminated</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        );
      },
      filterFn: (row, id, value) => {
        const member = row.original;
        return value === member.status;
      },
    },
    {
      accessorKey: "team_id",
      header: "Team",
      cell: ({ row }) => {
        const member = row.original;
        const teamId = member.team_id;
        if (!teamId) return <span className="text-muted-foreground">—</span>;
        const team = (teams ?? []).find((t) => t.id === teamId);
        return <span className="text-sm">{team?.name ?? teamId}</span>;
      },
      filterFn: (row, id, value) => {
        const member = row.original;
        if (!value) return true;
        return member.team_id === value;
      },
    },
    {
      id: "actions",
      header: "Actions",
      enableHiding: false,
      cell: ({ row }) => {
        const member = row.original as TeamMember;
        
        // Only show actions for team_lead, HR, and manager
        if (!canManageTeamMembers()) {
          return <div className="text-sm text-gray-400">—</div>;
        }
        
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              {canManageTeamMembers() && (
                <DropdownMenuItem
                  onClick={() => {
                    setEditingMember(member);
                    setValue('name', member.full_name || '');
                    setValue('email', member.email || '');
                    setValue('role', member.role_id);
                    setValue('status', member.status || 'active');
                    setOpenSheet(true);
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Member
                </DropdownMenuItem>
              )}
              {(() => {
                // #region agent log
                const canRemove = canRemoveMember();
                fetch('http://127.0.0.1:7243/ingest/ae5c929b-a368-47a0-9b09-fb93832ffb13', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'Team.tsx:actions_cell', message: 'Actions cell render', data: { canRemoveMember: canRemove, userRole: userRole ?? null }, timestamp: Date.now(), hypothesisId: 'H1' }) }).catch(() => {});
                // #endregion
                return canRemove;
              })() && (
                <>
                  <DropdownMenuSeparator />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem
                        onSelect={(e) => e.preventDefault()}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove Member
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Removal</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove this team member? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(member)}
                          className="bg-red-600 hover:bg-red-700"
                          disabled={loading}
                        >
                          {loading ? 'Removing...' : 'Remove'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  // Initialize TanStack Table
  const table = useReactTable({
    data: profiles || [],
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility: {
        ...columnVisibility,
        // Hide columns whose meta.hidden is true, but keep them defined to avoid id errors
        ...(Object.fromEntries(
          columns
            .filter((c: any) => c.meta?.hidden)
            .map((c: any) => {
              const key = c.id ?? c.accessorKey ?? undefined;
              return key ? [key, false] : [Math.random().toString(), false];
            })
        ) as any),
      },
      rowSelection,
    },
  });

  return (
    <div className="h-auto">
      {canManageTLAssignments() ? (
        <Tabs defaultValue="members" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="members">Team Members</TabsTrigger>
            {canManageTeamMembersList() && (
              <TabsTrigger value="pending-invites">Pending Invites ({invitesList.length})</TabsTrigger>
            )}
            <TabsTrigger value="tl-management">Groups</TabsTrigger>
          </TabsList>
          <TabsContent value="members" className="mt-4">
            <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Team Management</h1>
            <p className="text-muted-foreground">Manage your team members and their access</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            {/* Send notification to group/team - for team_lead, manager, admin, HR */}
            {canManageTeamMembers() && profiles.length > 0 && (
              <Button
                variant="outline"
                onClick={() => setOpenNotifyTeamDialog(true)}
              >
                <Send className="mr-2 h-4 w-4" />
                Send notification to team
              </Button>
            )}
            {/* Manage Team Members & Invite - Only for admin, manager, HR (not team_lead) */}
            {canManageTeamMembersList() && (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setOpenTeamMembersDialog(true);
                    loadAvailableUsers();
                  }}
                  className="w-[200px]"
                >
                  <Users className="mr-2 h-4 w-4" />
                  {teamMembers.length > 0 
                    ? `${teamMembers.length} team member${teamMembers.length > 1 ? 's' : ''}`
                    : 'Manage Team Members'}
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
                <Sheet
                  open={openSheet}
                  onOpenChange={setOpenSheet}
                >
                  <SheetTrigger asChild>
                    <Button
                      className="bg-purple-600 hover:bg-purple-700"
                      onClick={() => {
                        setEditingMember(null);
                        reset();
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Invite Team Member
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="w-[400px] sm:w-[540px] p-4">
                <SheetHeader>
                  <SheetTitle>
                    {editingMember ? 'Update Team Member' : 'Invite New Team Member'}
                  </SheetTitle>
                  {editingMember && (
                    <SheetDescription>
                      Update name, email, role, or status. Role changes take effect immediately.
                    </SheetDescription>
                  )}
                </SheetHeader>
                <div className="mt-6 h-full overflow-y-auto">
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                          id="name"
                          placeholder="Enter member name..."
                          {...register('name', { 
                            required: 'Name is required',
                            minLength: { value: 1, message: 'Name cannot be empty' }
                          })}
                          className={errors.name ? 'border-red-500' : ''}
                        />
                        {errors.name && (
                          <p className="text-sm text-red-500">{errors.name.message}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="Enter email address..."
                          {...register('email', { 
                            required: 'Email is required',
                            validate: {
                              trim: (value) => {
                                const trimmed = typeof value === 'string' ? value.trim() : String(value).trim();
                                return trimmed.length > 0 || 'Email cannot be empty';
                              },
                              format: (value) => {
                                const trimmed = typeof value === 'string' ? value.trim() : String(value).trim();
                                const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
                                return emailRegex.test(trimmed) || 'Invalid email address';
                              },
                              maxLength: (value) => {
                                const trimmed = typeof value === 'string' ? value.trim() : String(value).trim();
                                return trimmed.length <= 320 || 'Email must be 320 characters or less';
                              }
                            }
                          })}
                          className={errors.email ? 'border-red-500' : ''}
                          onBlur={(e) => {
                            // Trim the value on blur
                            const trimmed = e.target.value.trim();
                            if (trimmed !== e.target.value) {
                              setValue('email', trimmed, { shouldValidate: true });
                            }
                          }}
                        />
                        {errors.email && (
                          <p className="text-sm text-red-500">{errors.email.message}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="role">Role</Label>
                        <Select
                          value={watch('role')}
                          onValueChange={(value) => setValue('role', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select role..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="team_lead">Team Lead</SelectItem>
                            <SelectItem value="employee">Employee</SelectItem>
                            <SelectItem value="l2">L2</SelectItem>
                            <SelectItem value="sme">SME</SelectItem>
                            <SelectItem value="qa">QA</SelectItem>
                            <SelectItem value="qat">QAT</SelectItem>
                            <SelectItem value="st">ST</SelectItem>
                            <SelectItem value="hr">HR</SelectItem>
                            <SelectItem value="it">IT</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <Select
                          value={watch('status')}
                          onValueChange={(value) => setValue('status', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select status..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="on_leave">On Leave</SelectItem>
                            <SelectItem value="terminated">Terminated</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex gap-3 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setOpenSheet(false)}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={loading || !isValid}
                          className="flex-1 bg-purple-600 hover:bg-purple-700"
                        >
                          {loading ? (editingMember ? 'Updating...' : 'Sending Invite...') : 
                            (editingMember ? 'Update Member' : 'Send Invite')}
                        </Button>
                      </div>
                    </form>
                </div>
              </SheetContent>
            </Sheet>
                {/* <Button variant="outline" onClick={() => setOpenBulkInviteDialog(true)}>
                  <Upload className="w-4 h-4 mr-2" />
                  Bulk invite (CSV)
                </Button> */}
              </>
            )}
          </div>
        </div>

        {/* TanStack Table with built-in search and filters */}
        <Card className='gap-2'>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className='text-2xl font-bold'>Team Members</CardTitle>
              <div className="text-sm text-gray-600">
                Showing {table.getFilteredRowModel().rows.length} of {profiles.length} members
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                <span className="ml-2 text-gray-600">Loading team members...</span>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-12 text-red-600">
                <AlertCircle className="w-5 h-5 mr-2" />
                Failed to load team members.
              </div>
            ) : (
                <div className="w-full">
                <>
                  {
                    (table.getColumn("name")?.getFilterValue() ||
                      table.getColumn("role_id")?.getFilterValue() ||
                      table.getColumn("status")?.getFilterValue()) && (
                      <div className="flex flex-wrap gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-600 font-medium">Active filters:</span>
                        <>

                          {table.getColumn("name")?.getFilterValue() && (
                            <Badge variant="secondary" className="text-xs">
                              Name: "{table.getColumn("name")?.getFilterValue() as string}"
                              <button
                                onClick={() => table.getColumn("name")?.setFilterValue(undefined)}
                                className="ml-1 hover:text-red-500"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          )}

                          {table.getColumn("role_id")?.getFilterValue() && (
                            <Badge variant="secondary" className="text-xs">
                              Role: {table.getColumn("role_id")?.getFilterValue() as string}
                              <button
                                onClick={() => table.getColumn("role_id")?.setFilterValue(undefined)}
                                className="ml-1 hover:text-red-500"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          )}
                          {table.getColumn("status")?.getFilterValue() && (
                            <Badge variant="secondary" className="text-xs">
                              Status: {table.getColumn("status")?.getFilterValue() as string}
                              <button
                                onClick={() => table.getColumn("status")?.setFilterValue(undefined)}
                                className="ml-1 hover:text-red-500"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              table.resetColumnFilters()
                            }}
                            className="h-6 text-xs ml-auto"
                          >
                            Clear All
                          </Button>
                        </>
                      </div>
                    )}
                </>

                {/* Search and Filter Controls */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pb-4">
                  {/* Global Search */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <div className="relative flex-1 max-w-sm">
                        <Input
                          placeholder="Search by name..."
                          value={(table.getColumn("id")?.getFilterValue() as string) ?? ""}
                          onChange={(event) => {
                            const value = event.target.value;
                            // Search in both name and id columns
                            table.getColumn("id")?.setFilterValue(value);
                            if (!value) {
                              table.getColumn("name")?.setFilterValue(undefined);
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Role Filter - Only show if user can see roles */}
                  {canSeeRoles() && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="h-9">
                          Role <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Filter by Role</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuCheckboxItem
                          checked={!table.getColumn("role_id")?.getFilterValue()}
                          onCheckedChange={() => {
                            table.getColumn("role_id")?.setFilterValue(undefined)
                          }}
                        >
                          All Roles
                        </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={table.getColumn("role_id")?.getFilterValue() === "employee"}
                        onCheckedChange={() => {
                          table.getColumn("role_id")?.setFilterValue("employee")
                        }}
                      >
                        Employee
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={table.getColumn("role_id")?.getFilterValue() === "admin"}
                        onCheckedChange={() => {
                          table.getColumn("role_id")?.setFilterValue("admin")
                        }}
                      >
                        Admin
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={table.getColumn("role_id")?.getFilterValue() === "manager"}
                        onCheckedChange={() => {
                          table.getColumn("role_id")?.setFilterValue("manager")
                        }}
                      >
                        Manager
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={table.getColumn("role_id")?.getFilterValue() === "team_lead"}
                        onCheckedChange={() => {
                          table.getColumn("role_id")?.setFilterValue("team_lead")
                        }}
                      >
                        Team Lead
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={table.getColumn("role_id")?.getFilterValue() === "l2"}
                        onCheckedChange={() => {
                          table.getColumn("role_id")?.setFilterValue("l2")
                        }}
                      >
                        L2
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={table.getColumn("role_id")?.getFilterValue() === "sme"}
                        onCheckedChange={() => {
                          table.getColumn("role_id")?.setFilterValue("sme")
                        }}
                      >
                        SME
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={table.getColumn("role_id")?.getFilterValue() === "qa"}
                        onCheckedChange={() => {
                          table.getColumn("role_id")?.setFilterValue("qa")
                        }}
                      >
                        QA
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={table.getColumn("role_id")?.getFilterValue() === "qat"}
                        onCheckedChange={() => {
                          table.getColumn("role_id")?.setFilterValue("qat")
                        }}
                      >
                        QAT
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={table.getColumn("role_id")?.getFilterValue() === "st"}
                        onCheckedChange={() => {
                          table.getColumn("role_id")?.setFilterValue("st")
                        }}
                      >
                        ST
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={table.getColumn("role_id")?.getFilterValue() === "hr"}
                        onCheckedChange={() => {
                          table.getColumn("role_id")?.setFilterValue("hr")
                        }}
                      >
                        HR
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={table.getColumn("role_id")?.getFilterValue() === "it"}
                        onCheckedChange={() => {
                          table.getColumn("role_id")?.setFilterValue("it")
                        }}
                      >
                        IT
                      </DropdownMenuCheckboxItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  )}

                  {/* Status Filter */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="h-9">
                        Status <ChevronDown className="ml-2 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuCheckboxItem
                        checked={!table.getColumn("status")?.getFilterValue()}
                        onCheckedChange={() => {
                          table.getColumn("status")?.setFilterValue(undefined)
                        }}
                      >
                        All Statuses
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={table.getColumn("status")?.getFilterValue() === "active"}
                        onCheckedChange={() => {
                          table.getColumn("status")?.setFilterValue("active")
                        }}
                      >
                        Active
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={table.getColumn("status")?.getFilterValue() === "on_leave"}
                        onCheckedChange={() => {
                          table.getColumn("status")?.setFilterValue("on_leave")
                        }}
                      >
                        On Leave
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={table.getColumn("status")?.getFilterValue() === "terminated"}
                        onCheckedChange={() => {
                          table.getColumn("status")?.setFilterValue("terminated")
                        }}
                      >
                        Terminated
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={table.getColumn("status")?.getFilterValue() === "inactive"}
                        onCheckedChange={() => {
                          table.getColumn("status")?.setFilterValue("inactive")
                        }}
                      >
                        Inactive
                      </DropdownMenuCheckboxItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Column Visibility */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="h-9">
                        Columns <ChevronDown className="ml-2 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {table
                        .getAllColumns()
                        .filter((column) => column.getCanHide())
                        .map((column) => {
                          return (
                            <DropdownMenuCheckboxItem
                              key={column.id}
                              className="capitalize"
                              checked={column.getIsVisible()}
                              onCheckedChange={(value) =>
                                column.toggleVisibility(!!value)
                              }
                            >
                              {column.id}
                            </DropdownMenuCheckboxItem>
                          )
                        })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Table */}
                <div className="overflow-hidden rounded-md border">
                  <Table>
                    <TableHeader>
                      {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                          {headerGroup.headers.map((header) => {
                            return (
                              <TableHead key={header.id}>
                                {header.isPlaceholder
                                  ? null
                                  : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                  )}
                              </TableHead>
                            )
                          })}
                        </TableRow>
                      ))}
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell
                            colSpan={columns.length}
                            className="h-24 text-center"
                          >
                            <div className="flex items-center justify-center py-8">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                              <span className="ml-2 text-gray-600">Loading team members...</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : table.getRowModel().rows?.length ? (
                        table.getRowModel().rows.map((row) => {
                          const member = row.original;
                          return (
                            <TableRow
                              key={row.id}
                              data-state={row.getIsSelected() && "selected"}
                            >
                              {row.getVisibleCells().map((cell) => (
                                <TableCell key={cell.id}>
                                  {flexRender(
                                    cell.column.columnDef.cell,
                                    cell.getContext()
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={columns.length}
                            className="h-24 text-center"
                          >
                            <div className="text-center py-12">
                              <Users className="mx-auto h-12 w-12 text-gray-400" />
                              <h3 className="mt-2 text-sm font-medium text-gray-900">No team members found</h3>
                              <p className="mt-1 text-sm text-gray-500">
                                Get started by adding a new team member.
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination - single row: selection info, rows-per-page, page controls */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-4 border-t">
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="text-sm text-muted-foreground">
                      {table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} row(s) selected
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Rows per page</span>
                      <Select
                        value={`${table.getState().pagination.pageSize}`}
                        onValueChange={(v) => table.setPageSize(Number(v))}
                      >
                        <SelectTrigger className="h-8 w-[70px]">
                          <SelectValue placeholder={table.getState().pagination.pageSize} />
                        </SelectTrigger>
                        <SelectContent side="top">
                          {[10, 20, 30, 40, 50].map((ps) => (
                            <SelectItem key={ps} value={`${ps}`}>{ps}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-sm text-muted-foreground mr-1">
                      Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
                    </span>
                    <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                      <ChevronLeft className="h-4 w-4" /> Previous
                    </Button>
                    {(() => {
                      const totalP = Math.max(1, table.getPageCount());
                      const pageIndex = table.getState().pagination.pageIndex;
                      const maxButtons = 7;
                      const start = Math.max(0, pageIndex - Math.floor(maxButtons / 2));
                      const end = Math.min(totalP, start + maxButtons);
                      const from = Math.max(0, end - maxButtons);
                      return Array.from({ length: end - from }, (_, i) => from + i).map((i) => (
                        <Button
                          key={i}
                          variant={pageIndex === i ? "default" : "outline"}
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => table.setPageIndex(i)}
                        >
                          {i + 1}
                        </Button>
                      ));
                    })()}
                    <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                      Next <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
            </div>
          </TabsContent>
          {canManageTeamMembersList() && (
          <TabsContent value="pending-invites" className="mt-4">
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight">Pending Invites</h2>
                <p className="text-muted-foreground">People who have been invited to join your organization but have not yet signed up.</p>
              </div>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                      <Mail className="h-5 w-5" />
                      Pending Invites
                    </CardTitle>
                    <div className="text-sm text-muted-foreground">
                      {invitesLoading ? 'Loading...' : filteredInvitesList.length === invitesList.length
                        ? `${invitesList.length} invite${invitesList.length !== 1 ? 's' : ''} pending`
                        : `${filteredInvitesList.length} of ${invitesList.length} invite${invitesList.length !== 1 ? 's' : ''}`}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Filters */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Status</Label>
                      <Select value={invitesStatusFilter} onValueChange={(v: 'all' | 'pending' | 'expired' | 'accepted') => setInvitesStatusFilter(v)}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="expired">Expired</SelectItem>
                          <SelectItem value="accepted">Accepted</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-sm font-medium">Search (email, name, role)</Label>
                      <Input
                        placeholder="Search invites..."
                        value={invitesSearchQuery}
                        onChange={(e) => setInvitesSearchQuery(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9"
                        onClick={() => {
                          setInvitesStatusFilter('all');
                          setInvitesSearchQuery('');
                        }}
                        disabled={invitesStatusFilter === 'all' && !invitesSearchQuery.trim()}
                      >
                        Clear filters
                      </Button>
                    </div>
                  </div>
                  {invitesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
                      <span className="ml-2 text-muted-foreground">Loading invites...</span>
                    </div>
                  ) : invitesList.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">
                      No pending invites. Use &quot;Invite Team Member&quot; from the Team Members tab to send an invitation.
                    </p>
                  ) : filteredInvitesList.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">
                      No invites match the current filters. Try changing the status or search query.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Email</TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead>Role</TableHead>
                              <TableHead>Expires</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="w-[100px]">Invite Link</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginatedInvites.map((inv) => {
                              const isExpired = new Date(inv.expires_at) < new Date();
                              const isAccepted = Boolean(inv.accepted_at);
                              const statusLabel = isAccepted ? 'Accepted' : isExpired ? 'Expired' : 'Pending';
                              const statusVariant = isAccepted ? 'default' : isExpired ? 'destructive' : 'secondary';
                              return (
                                <TableRow key={inv.token}>
                                  <TableCell className="font-medium">{inv.email}</TableCell>
                                  <TableCell>{inv.name || '—'}</TableCell>
                                  <TableCell>
                                    <Badge variant="secondary">{inv.role}</Badge>
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {new Date(inv.expires_at).toLocaleDateString()}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={statusVariant}>{statusLabel}</Badge>
                                  </TableCell>
                                  <TableCell className="flex items-center gap-1">
                                    {isExpired ? (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8"
                                        disabled={!orgId || resendingToken === inv.token}
                                        onClick={async () => {
                                          if (!orgId) return;
                                          setResendingToken(inv.token);
                                          const { success, message } = await resendInvite(inv, orgId);
                                          setResendingToken(null);
                                          success ? toast({ title: 'Invite resent', description: message }) : toast({ title: 'Resend failed', description: message, variant: 'destructive' });
                                        }}
                                      >
                                        {resendingToken === inv.token ? (
                                          <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                                        ) : (
                                          <Send className="h-4 w-4 mr-1" />
                                        )}
                                        Resend
                                      </Button>
                                    ) : (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8"
                                        onClick={() => {
                                          navigator.clipboard.writeText(`${window.location.origin}/invite/${inv.token}`);
                                          toast({ title: 'Link copied', description: 'Invite link copied to clipboard.' });
                                        }}
                                      >
                                        <Copy className="h-4 w-4 mr-1" />
                                        Copy link
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                      {invitesTotalPages > 1 && (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-2">
                          <p className="text-sm text-muted-foreground">
                            Page {invitesPageClamped} of {invitesTotalPages} ({filteredInvitesList.length} total)
                          </p>
                          <div className="flex items-center gap-1 flex-wrap">
                            <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => setInvitesPage((p) => Math.max(1, p - 1))} disabled={invitesPageClamped <= 1}>
                              <ChevronLeft className="h-4 w-4" /> Previous
                            </Button>
                            {(() => {
                              const maxButtons = 7;
                              const start = Math.max(1, invitesPageClamped - Math.floor(maxButtons / 2));
                              const end = Math.min(invitesTotalPages, start + maxButtons - 1);
                              const from = Math.max(1, end - maxButtons + 1);
                              return Array.from({ length: end - from + 1 }, (_, i) => from + i).map((page) => (
                                <Button key={page} variant={invitesPageClamped === page ? 'default' : 'outline'} size="sm" className="h-8 w-8 p-0" onClick={() => setInvitesPage(page)}>{page}</Button>
                              ));
                            })()}
                            <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => setInvitesPage((p) => Math.min(invitesTotalPages, p + 1))} disabled={invitesPageClamped >= invitesTotalPages}>
                              Next <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          )}
          <TabsContent value="tl-management" className="mt-4">
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight">Groups</h2>
                <p className="text-muted-foreground">Create groups: each group has one Team Lead. Under that Team Lead you can add members (or leave it empty).</p>
              </div>

              {/* Groups list + Create group */}
              <Card>
                <CardHeader>
                  <CardTitle>Your groups</CardTitle>
                  <CardDescription>Each group contains one Team Lead; members are assigned under that TL.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-end">
                    <Button onClick={() => { setNewGroupName(''); setNewGroupTlId(isTeamLeadForGroups ? (currentUserTlProfile?.id ?? null) : null); setOpenCreateGroupDialog(true); }} disabled={teamLeadsForSelect.length === 0}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create group
                    </Button>
                  </div>
                  {(groups ?? []).length === 0 && !loading && (
                    <p className="text-sm text-muted-foreground rounded-md border border-dashed p-4 bg-muted/30">
                      No groups yet. Create a group and assign one Team Lead to it; then use Manage to add members under that TL.
                    </p>
                  )}
                  {(groups ?? []).length > 0 && (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Group name</TableHead>
                            <TableHead>Team Lead</TableHead>
                            <TableHead>Members</TableHead>
                            <TableHead className="w-[180px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(groups ?? []).map((g) => (
                            <TableRow key={g.id}>
                              <TableCell className="font-medium">{g.name}</TableCell>
                              <TableCell>{g.team_lead_name ?? '—'}</TableCell>
                              <TableCell>{g.member_count ?? 0}</TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button variant="outline" size="sm" onClick={() => setSelectedTlId(g.team_lead_id)}>
                                    Manage
                                  </Button>
                                  <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => setGroupToDelete(g)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Select Team Lead + members (manage a group) */}
              <Card>
                <CardHeader>
                  <CardTitle>Select Team Lead</CardTitle>
                  <CardDescription>Choose a TL to view and add or remove members under them.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(teamLeads ?? []).length === 0 && !loading && (
                    <p className="text-sm text-muted-foreground rounded-md border border-dashed p-4 bg-muted/30">
                      No team leads in your organization yet. Go to the <strong>Team Members</strong> tab, edit a user&apos;s role to <strong>Team Lead</strong>, or invite users with the Team Lead role.
                    </p>
                  )}
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Select value={selectedTlId ?? ''} onValueChange={(v) => setSelectedTlId(v || null)} disabled={teamLeadsForSelect.length === 0}>
                      <SelectTrigger className="w-full sm:max-w-xs">
                        <SelectValue placeholder={teamLeadsForSelect.length === 0 ? "No team leads found" : "Select a Team Lead..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {teamLeadsForSelect.map((tl) => (
                          <SelectItem key={tl.id} value={tl.id}>
                            {tl.full_name || tl.email || tl.user_id} {tl.user_id === user?.id && '(You)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedTlId && (
                      <Button onClick={handleOpenAddToTl}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Members
                      </Button>
                    )}
                  </div>
                  {selectedTlId && (
                    <div className="space-y-2">
                      <Label>Members under this TL ({tlMembersList.length})</Label>
                      <div className="rounded-md border">
                        {tlMembersList.length === 0 ? (
                          <p className="p-4 text-sm text-muted-foreground">No members assigned yet. Use &quot;Add Members&quot; to assign employees.</p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead className="w-[140px]">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {tlMembersList.map((m) => (
                                <TableRow key={m.user_id}>
                                  <TableCell className="font-medium">{m.full_name || m.email}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">{m.email}</TableCell>
                                  <TableCell>{getRoleBadge(m.user_roles?.role ?? m.role ?? '')}</TableCell>
                                  <TableCell>
                                    <div className="flex gap-2">
                                      <Button variant="outline" size="sm" onClick={() => { setMemberToReassign(m); setOpenReassignDialog(true); }}>
                                        Reassign
                                      </Button>
                                      <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => handleRemoveFromTl(m.user_id)}>
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Create group dialog */}
              <Dialog open={openCreateGroupDialog} onOpenChange={setOpenCreateGroupDialog}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create group</DialogTitle>
                    <DialogDescription>Each group has one Team Lead. You can add members to that TL after creating the group.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Group name</Label>
                      <Input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="e.g. Backend Team" />
                    </div>
                    {isTeamLeadForGroups ? (
                      <div className="space-y-2">
                        <Label>Team Lead</Label>
                        <p className="text-sm text-muted-foreground py-2">You (Team Lead)</p>
                        <input type="hidden" value={newGroupTlId ?? ''} readOnly />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>Team Lead</Label>
                        <Select value={newGroupTlId ?? ''} onValueChange={(v) => setNewGroupTlId(v || null)}>
                          <SelectTrigger><SelectValue placeholder="Select Team Lead..." /></SelectTrigger>
                          <SelectContent>
                            {(teamLeads ?? []).map((tl) => (
                              <SelectItem key={tl.id} value={tl.id}>
                                {tl.full_name || tl.email || tl.user_id}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setOpenCreateGroupDialog(false)}>Cancel</Button>
                    <Button onClick={handleCreateGroup} disabled={!newGroupName.trim() || !newGroupTlId}>Create</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Delete group confirmation */}
              <AlertDialog open={!!groupToDelete} onOpenChange={(open) => !open && setGroupToDelete(null)}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete group?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This only removes the group. The Team Lead and their members are unchanged. You can create a new group with the same TL later.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteGroup} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section (no tabs) - team_lead sees group members and can send notification only */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Team Management</h1>
            <p className="text-muted-foreground">
              {canManageTeamMembersList() ? 'Manage your team members and their access' : 'View your group members and send them notifications'}
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            {canManageTeamMembers() && profiles.length > 0 && (
              <Button variant="outline" onClick={() => setOpenNotifyTeamDialog(true)}>
                <Send className="mr-2 h-4 w-4" />
                Send notification to team
              </Button>
            )}
            {canManageTeamMembersList() && (
              <>
                <Button variant="outline" onClick={() => { setOpenTeamMembersDialog(true); loadAvailableUsers(); }} className="w-[200px]">
                  <Users className="mr-2 h-4 w-4" />
                  {teamMembers.length > 0 ? `${teamMembers.length} team member${teamMembers.length > 1 ? 's' : ''}` : 'Manage Team Members'}
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
                <Sheet open={openSheet} onOpenChange={setOpenSheet}>
                  <SheetTrigger asChild>
                    <Button className="bg-purple-600 hover:bg-purple-700" onClick={() => { setEditingMember(null); reset(); }}>
                      <Plus className="w-4 h-4 mr-2" />
                      Invite Team Member
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="w-[400px] sm:w-[540px] p-4">
                    <SheetHeader>
                      <SheetTitle>{editingMember ? 'Update Team Member' : 'Invite New Team Member'}</SheetTitle>
                      {editingMember && (
                        <SheetDescription>
                          Update name, email, role, or status. Role changes take effect immediately.
                        </SheetDescription>
                      )}
                    </SheetHeader>
                    <div className="mt-6 h-full overflow-y-auto">
                      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        <div className="space-y-2">
                          <Label htmlFor="name">Name</Label>
                          <Input id="name" placeholder="Enter member name..." {...register('name', { required: 'Name is required', minLength: { value: 1, message: 'Name cannot be empty' } })} className={errors.name ? 'border-red-500' : ''} />
                          {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input id="email" type="email" placeholder="Enter email address..." {...register('email', { required: 'Email is required', validate: { trim: (v) => (typeof v === 'string' ? v.trim() : String(v).trim()).length > 0 || 'Email cannot be empty', format: (v) => /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(typeof v === 'string' ? v.trim() : String(v).trim()) || 'Invalid email address', maxLength: (v) => (typeof v === 'string' ? v.trim() : String(v).trim()).length <= 320 || 'Email must be 320 characters or less' } })} className={errors.email ? 'border-red-500' : ''} onBlur={(e) => { const t = e.target.value.trim(); if (t !== e.target.value) setValue('email', t, { shouldValidate: true }); }} />
                          {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="role">Role</Label>
                          <Select value={watch('role')} onValueChange={(v) => setValue('role', v)}>
                            <SelectTrigger><SelectValue placeholder="Select role..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="manager">Manager</SelectItem>
                              <SelectItem value="team_lead">Team Lead</SelectItem>
                              <SelectItem value="employee">Employee</SelectItem>
                              <SelectItem value="l2">L2</SelectItem>
                              <SelectItem value="sme">SME</SelectItem>
                              <SelectItem value="qa">QA</SelectItem>
                              <SelectItem value="qat">QAT</SelectItem>
                              <SelectItem value="st">ST</SelectItem>
                              <SelectItem value="hr">HR</SelectItem>
                              <SelectItem value="it">IT</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="status">Status</Label>
                          <Select value={watch('status')} onValueChange={(v) => setValue('status', v)}>
                            <SelectTrigger><SelectValue placeholder="Select status..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="on_leave">On Leave</SelectItem>
                              <SelectItem value="terminated">Terminated</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-3 pt-4">
                          <Button type="button" variant="outline" onClick={() => setOpenSheet(false)} className="flex-1">Cancel</Button>
                          <Button type="submit" disabled={loading || !isValid} className="flex-1 bg-purple-600 hover:bg-purple-700">{loading ? (editingMember ? 'Updating...' : 'Sending Invite...') : (editingMember ? 'Update Member' : 'Send Invite')}</Button>
                        </div>
                      </form>
                    </div>
                  </SheetContent>
                </Sheet>
                {SHOW_BULK_INVITE && (
                  <Button variant="outline" onClick={() => setOpenBulkInviteDialog(true)}>
                    <Upload className="w-4 h-4 mr-2" />
                    Bulk invite (CSV)
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
        {canManageTeamMembersList() && (
          <Card className="gap-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-bold flex items-center gap-2"><Mail className="h-5 w-5" /> Pending Invites</CardTitle>
                <div className="text-sm text-muted-foreground">
                  {invitesLoading ? 'Loading...' : filteredInvitesList.length === invitesList.length
                    ? `${invitesList.length} invite${invitesList.length !== 1 ? 's' : ''} pending`
                    : `${filteredInvitesList.length} of ${invitesList.length} invite${invitesList.length !== 1 ? 's' : ''}`}
                </div>
              </div>
              <CardDescription>People who have been invited to join your organization but have not yet signed up.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Status</Label>
                  <Select value={invitesStatusFilter} onValueChange={(v: 'all' | 'pending' | 'expired' | 'accepted') => setInvitesStatusFilter(v)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="accepted">Accepted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-sm font-medium">Search (email, name, role)</Label>
                  <Input placeholder="Search invites..." value={invitesSearchQuery} onChange={(e) => setInvitesSearchQuery(e.target.value)} className="h-9" />
                </div>
                <div className="flex items-end">
                  <Button variant="outline" size="sm" className="h-9" onClick={() => { setInvitesStatusFilter('all'); setInvitesSearchQuery(''); }} disabled={invitesStatusFilter === 'all' && !invitesSearchQuery.trim()}>Clear filters</Button>
                </div>
              </div>
              {invitesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
                  <span className="ml-2 text-muted-foreground">Loading invites...</span>
                </div>
              ) : invitesList.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No pending invites. Use &quot;Invite Team Member&quot; to send an invitation.</p>
              ) : filteredInvitesList.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No invites match the current filters. Try changing the status or search query.</p>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Expires</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-[100px]">Invite Link</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedInvites.map((inv) => {
                        const isExpired = new Date(inv.expires_at) < new Date();
                        const isAccepted = Boolean(inv.accepted_at);
                        const statusLabel = isAccepted ? 'Accepted' : isExpired ? 'Expired' : 'Pending';
                        const statusVariant = isAccepted ? 'default' : isExpired ? 'destructive' : 'secondary';
                        return (
                          <TableRow key={inv.token}>
                            <TableCell className="font-medium">{inv.email}</TableCell>
                            <TableCell>{inv.name || '—'}</TableCell>
                            <TableCell><Badge variant="secondary">{inv.role}</Badge></TableCell>
                            <TableCell className="text-sm text-gray-600">{new Date(inv.expires_at).toLocaleDateString()}</TableCell>
                            <TableCell><Badge variant={statusVariant}>{statusLabel}</Badge></TableCell>
                            <TableCell className="flex items-center gap-1">
                              {isExpired ? (
                                <Button variant="outline" size="sm" className="h-8" disabled={!orgId || resendingToken === inv.token} onClick={async () => { if (!orgId) return; setResendingToken(inv.token); const { success, message } = await resendInvite(inv, orgId); setResendingToken(null); success ? toast({ title: 'Invite resent', description: message }) : toast({ title: 'Resend failed', description: message, variant: 'destructive' }); }}>
                                  {resendingToken === inv.token ? <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" /> : <Send className="h-4 w-4 mr-1" />}
                                  Resend
                                </Button>
                              ) : (
                                <Button variant="ghost" size="sm" className="h-8" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/invite/${inv.token}`); toast({ title: 'Link copied', description: 'Invite link copied to clipboard.' }); }}><Copy className="h-4 w-4 mr-1" /> Copy link</Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  {invitesTotalPages > 1 && (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-2">
                      <p className="text-sm text-muted-foreground">
                        Page {invitesPageClamped} of {invitesTotalPages} ({filteredInvitesList.length} total)
                      </p>
                      <div className="flex items-center gap-1 flex-wrap">
                        <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => setInvitesPage((p) => Math.max(1, p - 1))} disabled={invitesPageClamped <= 1}><ChevronLeft className="h-4 w-4" /> Previous</Button>
                        {(() => {
                          const maxButtons = 7;
                          const start = Math.max(1, invitesPageClamped - Math.floor(maxButtons / 2));
                          const end = Math.min(invitesTotalPages, start + maxButtons - 1);
                          const from = Math.max(1, end - maxButtons + 1);
                          return Array.from({ length: end - from + 1 }, (_, i) => from + i).map((page) => (
                            <Button key={page} variant={invitesPageClamped === page ? 'default' : 'outline'} size="sm" className="h-8 w-8 p-0" onClick={() => setInvitesPage(page)}>{page}</Button>
                          ));
                        })()}
                        <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => setInvitesPage((p) => Math.min(invitesTotalPages, p + 1))} disabled={invitesPageClamped >= invitesTotalPages}>Next <ChevronRight className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
        <Card className="gap-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-bold">Team Members</CardTitle>
              <div className="text-sm text-gray-600">Showing {table.getFilteredRowModel().rows.length} of {profiles.length} members</div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                <span className="ml-2 text-gray-600">Loading team members...</span>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-12 text-red-600"><AlertCircle className="w-5 h-5 mr-2" /> Failed to load team members.</div>
            ) : (
              <div className="w-full">
                {(table.getColumn("name")?.getFilterValue() || table.getColumn("role_id")?.getFilterValue() || table.getColumn("status")?.getFilterValue()) && (
                  <div className="flex flex-wrap gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600 font-medium">Active filters:</span>
                    {table.getColumn("name")?.getFilterValue() && <Badge variant="secondary" className="text-xs">Name: &quot;{table.getColumn("name")?.getFilterValue() as string}&quot;<button onClick={() => table.getColumn("name")?.setFilterValue(undefined)} className="ml-1 hover:text-red-500"><X className="w-3 h-3" /></button></Badge>}
                    {table.getColumn("role_id")?.getFilterValue() && <Badge variant="secondary" className="text-xs">Role: {table.getColumn("role_id")?.getFilterValue() as string}<button onClick={() => table.getColumn("role_id")?.setFilterValue(undefined)} className="ml-1 hover:text-red-500"><X className="w-3 h-3" /></button></Badge>}
                    {table.getColumn("status")?.getFilterValue() && <Badge variant="secondary" className="text-xs">Status: {table.getColumn("status")?.getFilterValue() as string}<button onClick={() => table.getColumn("status")?.setFilterValue(undefined)} className="ml-1 hover:text-red-500"><X className="w-3 h-3" /></button></Badge>}
                    <Button variant="ghost" size="sm" onClick={() => table.resetColumnFilters()} className="h-6 text-xs ml-auto">Clear All</Button>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pb-4">
                  <div className="flex-1 min-w-0">
                    <div className="relative flex-1 max-w-sm">
                      <Input placeholder="Search by name..." value={(table.getColumn("id")?.getFilterValue() as string) ?? ""} onChange={(e) => { const v = e.target.value; table.getColumn("id")?.setFilterValue(v); if (!v) table.getColumn("name")?.setFilterValue(undefined); }} />
                    </div>
                  </div>
                  {canSeeRoles() && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="outline" className="h-9">Role <ChevronDown className="ml-2 h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Filter by Role</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuCheckboxItem checked={!table.getColumn("role_id")?.getFilterValue()} onCheckedChange={() => table.getColumn("role_id")?.setFilterValue(undefined)}>All Roles</DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem checked={table.getColumn("role_id")?.getFilterValue() === "employee"} onCheckedChange={() => table.getColumn("role_id")?.setFilterValue("employee")}>Employee</DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem checked={table.getColumn("role_id")?.getFilterValue() === "admin"} onCheckedChange={() => table.getColumn("role_id")?.setFilterValue("admin")}>Admin</DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem checked={table.getColumn("role_id")?.getFilterValue() === "manager"} onCheckedChange={() => table.getColumn("role_id")?.setFilterValue("manager")}>Manager</DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem checked={table.getColumn("role_id")?.getFilterValue() === "team_lead"} onCheckedChange={() => table.getColumn("role_id")?.setFilterValue("team_lead")}>Team Lead</DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem checked={table.getColumn("role_id")?.getFilterValue() === "l2"} onCheckedChange={() => table.getColumn("role_id")?.setFilterValue("l2")}>L2</DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem checked={table.getColumn("role_id")?.getFilterValue() === "sme"} onCheckedChange={() => table.getColumn("role_id")?.setFilterValue("sme")}>SME</DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem checked={table.getColumn("role_id")?.getFilterValue() === "qa"} onCheckedChange={() => table.getColumn("role_id")?.setFilterValue("qa")}>QA</DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem checked={table.getColumn("role_id")?.getFilterValue() === "qat"} onCheckedChange={() => table.getColumn("role_id")?.setFilterValue("qat")}>QAT</DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem checked={table.getColumn("role_id")?.getFilterValue() === "st"} onCheckedChange={() => table.getColumn("role_id")?.setFilterValue("st")}>ST</DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem checked={table.getColumn("role_id")?.getFilterValue() === "hr"} onCheckedChange={() => table.getColumn("role_id")?.setFilterValue("hr")}>HR</DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem checked={table.getColumn("role_id")?.getFilterValue() === "it"} onCheckedChange={() => table.getColumn("role_id")?.setFilterValue("it")}>IT</DropdownMenuCheckboxItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="outline" className="h-9">Status <ChevronDown className="ml-2 h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuCheckboxItem checked={!table.getColumn("status")?.getFilterValue()} onCheckedChange={() => table.getColumn("status")?.setFilterValue(undefined)}>All Statuses</DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem checked={table.getColumn("status")?.getFilterValue() === "active"} onCheckedChange={() => table.getColumn("status")?.setFilterValue("active")}>Active</DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem checked={table.getColumn("status")?.getFilterValue() === "on_leave"} onCheckedChange={() => table.getColumn("status")?.setFilterValue("on_leave")}>On Leave</DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem checked={table.getColumn("status")?.getFilterValue() === "terminated"} onCheckedChange={() => table.getColumn("status")?.setFilterValue("terminated")}>Terminated</DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem checked={table.getColumn("status")?.getFilterValue() === "inactive"} onCheckedChange={() => table.getColumn("status")?.setFilterValue("inactive")}>Inactive</DropdownMenuCheckboxItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="outline" className="h-9">Columns <ChevronDown className="ml-2 h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {table.getAllColumns().filter((col) => col.getCanHide()).map((col) => (
                        <DropdownMenuCheckboxItem key={col.id} className="capitalize" checked={col.getIsVisible()} onCheckedChange={(v) => col.toggleVisibility(!!v)}>{col.id}</DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="overflow-hidden rounded-md border">
                  <Table>
                    <TableHeader>
                      {table.getHeaderGroups().map((hg) => (
                        <TableRow key={hg.id}>
                          {hg.headers.map((h) => (
                            <TableHead key={h.id}>{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</TableHead>
                          ))}
                        </TableRow>
                      ))}
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow><TableCell colSpan={columns.length} className="h-24 text-center"><div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div><span className="ml-2 text-gray-600">Loading team members...</span></div></TableCell></TableRow>
                      ) : table.getRowModel().rows?.length ? (
                        table.getRowModel().rows.map((row) => {
                          const member = row.original;
                          return (
                            <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                              {row.getVisibleCells().map((cell) => (
                                <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                              ))}
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow><TableCell colSpan={columns.length} className="h-24 text-center"><div className="text-center py-12"><Users className="mx-auto h-12 w-12 text-gray-400" /><h3 className="mt-2 text-sm font-medium text-gray-900">No team members found</h3><p className="mt-1 text-sm text-gray-500">Get started by adding a new team member.</p></div></TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-4 border-t">
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="text-sm text-muted-foreground">
                      {table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} row(s) selected
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Rows per page</span>
                      <Select value={`${table.getState().pagination.pageSize}`} onValueChange={(v) => table.setPageSize(Number(v))}>
                        <SelectTrigger className="h-8 w-[70px]"><SelectValue placeholder={table.getState().pagination.pageSize} /></SelectTrigger>
                        <SelectContent side="top">{[10, 20, 30, 40, 50].map((ps) => (<SelectItem key={ps} value={`${ps}`}>{ps}</SelectItem>))}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-sm text-muted-foreground mr-1">
                      Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
                    </span>
                    <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}><ChevronLeft className="h-4 w-4" /> Previous</Button>
                    {(() => {
                      const totalP = Math.max(1, table.getPageCount());
                      const pageIndex = table.getState().pagination.pageIndex;
                      const maxButtons = 7;
                      const start = Math.max(0, pageIndex - Math.floor(maxButtons / 2));
                      const end = Math.min(totalP, start + maxButtons);
                      const from = Math.max(0, end - maxButtons);
                      return Array.from({ length: end - from }, (_, i) => from + i).map((i) => (
                        <Button key={i} variant={pageIndex === i ? "default" : "outline"} size="sm" className="h-8 w-8 p-0" onClick={() => table.setPageIndex(i)}>{i + 1}</Button>
                      ));
                    })()}
                    <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Next <ChevronRight className="h-4 w-4" /></Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      )}

      {/* Bulk invite (CSV) dialog - hidden when SHOW_BULK_INVITE is false */}
      {SHOW_BULK_INVITE && canManageTeamMembersList() && orgId && (
        <Dialog open={openBulkInviteDialog} onOpenChange={(open) => { if (!open) closeBulkInviteDialog(); setOpenBulkInviteDialog(open); }}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Bulk invite from CSV
              </DialogTitle>
              <DialogDescription>
                Upload a CSV with columns: <strong>email</strong> (required), <strong>name</strong> (optional), <strong>role</strong> (optional, default: employee). First row can be a header row with &quot;email&quot;, &quot;name&quot;, &quot;role&quot;.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 flex-1 min-h-0">
              <div className="flex items-center gap-2">
                <Label htmlFor="bulk-csv-input" className="sr-only">Upload CSV</Label>
                <Input
                  id="bulk-csv-input"
                  type="file"
                  accept=".csv"
                  onChange={handleBulkCsvFile}
                  className="w-auto max-w-[240px]"
                />
                {bulkCsvRows.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {bulkCsvRows.length} row{bulkCsvRows.length !== 1 ? 's' : ''}
                    {bulkCsvRows.some((r) => r.error) && ` (${bulkCsvRows.filter((r) => r.error).length} with errors)`}
                  </span>
                )}
              </div>
              {bulkCsvRows.length > 0 && (
                <div className="rounded-md border overflow-auto flex-1 min-h-[200px] max-h-[320px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="w-[120px]">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bulkCsvRows.map((row, idx) => (
                        <TableRow key={idx} className={row.error ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                          <TableCell className="font-medium">{row.email || '—'}</TableCell>
                          <TableCell>{row.name || '—'}</TableCell>
                          <TableCell>{row.role}</TableCell>
                          <TableCell>
                            {bulkInviteDone && bulkInviteResultsByEmail[row.email] ? (
                              bulkInviteResultsByEmail[row.email].success ? (
                                <span className="text-green-600 dark:text-green-400">Sent</span>
                              ) : (
                                <span className="text-red-600 dark:text-red-400" title={bulkInviteResultsByEmail[row.email].message}>
                                  Failed
                                </span>
                              )
                            ) : row.error ? (
                              <span className="text-red-600 dark:text-red-400 text-xs">{row.error}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {bulkInviteSending && (
                <p className="text-sm text-muted-foreground">
                  Sending… {bulkInviteProgress.sent + bulkInviteProgress.failed} of {bulkInviteProgress.total} (sent: {bulkInviteProgress.sent}, failed: {bulkInviteProgress.failed})
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeBulkInviteDialog}>
                {bulkInviteDone ? 'Close' : 'Cancel'}
              </Button>
              {!bulkInviteDone && (
                <Button
                  onClick={handleBulkSendInvites}
                  disabled={bulkInviteSending || bulkCsvRows.length === 0 || bulkCsvRows.every((r) => r.error)}
                >
                  {bulkInviteSending ? `Sending… ${bulkInviteProgress.sent}/${bulkInviteProgress.total}` : `Send ${bulkCsvRows.filter((r) => !r.error).length} invite${bulkCsvRows.filter((r) => !r.error).length !== 1 ? 's' : ''}`}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Team Members Management Dialog - Only for admin, HR, manager (not team_lead) */}
      {canManageTeamMembersList() && orgId && (
        <Dialog open={openTeamMembersDialog} onOpenChange={setOpenTeamMembersDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Manage Team Members
              </DialogTitle>
              <DialogDescription>
                Add or remove users from your team. Only users in your team will be visible in the team list.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 flex flex-col gap-4 min-h-0">
              {/* Current Team Members */}
              <div className="space-y-2">
                <Label>Current Team Members ({teamMembers.length})</Label>
                <div className="border rounded-md p-3 max-h-32 overflow-y-auto">
                  {teamMembers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No team members added yet</p>
                  ) : (
                    <div className="space-y-2">
                      {profiles
                        .filter(p => teamMembers.includes(p.user_id))
                        .map((member) => (
                          <div key={member.user_id} className="flex items-center justify-between p-2 hover:bg-accent rounded">
                            <div>
                              <div className="font-medium">{member.full_name || member.email}</div>
                              <div className="text-sm text-muted-foreground">{member.email}</div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveTeamMember(member.user_id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Add Team Members */}
              <div className="space-y-2">
                <Label>Add Team Members</Label>
                <div className="relative">
                  <Input
                    placeholder="Search users to add..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-10"
                  />
                </div>
                <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
                  {availableUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No available users to add</p>
                  ) : (
                    <div className="space-y-2">
                      {availableUsers
                        .filter(user => {
                          if (!searchQuery) return true;
                          const query = searchQuery.toLowerCase();
                          return (
                            user.full_name?.toLowerCase().includes(query) ||
                            user.email?.toLowerCase().includes(query)
                          );
                        })
                        .map((user) => (
                          <div key={user.user_id} className="flex items-center justify-between p-2 hover:bg-accent rounded">
                            <div>
                              <div className="font-medium">{user.full_name || user.email}</div>
                              <div className="text-sm text-muted-foreground">{user.email}</div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAddTeamMember(user.user_id)}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add
                            </Button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenTeamMembersDialog(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Send notification to team dialog - team_lead, manager, admin, HR */}
      {canManageTeamMembers() && (
        <Dialog open={openNotifyTeamDialog} onOpenChange={setOpenNotifyTeamDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Send notification to team
              </DialogTitle>
              <DialogDescription>
                Send a notification to all {profiles.length} member{profiles.length !== 1 ? 's' : ''} in your group.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="notify-title">Title</Label>
                <Input
                  id="notify-title"
                  placeholder="Notification title"
                  value={notifyTitle}
                  onChange={(e) => setNotifyTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notify-message">Message</Label>
                <Textarea
                  id="notify-message"
                  placeholder="Your message..."
                  value={notifyMessage}
                  onChange={(e) => setNotifyMessage(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenNotifyTeamDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSendNotificationToTeam} disabled={notifySending}>
                {notifySending ? 'Sending…' : 'Send to team'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Add Members to TL Dialog - admin/manager */}
      {canManageTLAssignments() && (
        <Dialog open={openAddToTlDialog} onOpenChange={setOpenAddToTlDialog}>
          <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Add Members to Team Lead</DialogTitle>
              <DialogDescription>Select employees to assign to this team lead.</DialogDescription>
            </DialogHeader>
            <div className="border rounded-md p-3 max-h-64 overflow-y-auto">
              {assignableList.length === 0 ? (
                <p className="text-sm text-muted-foreground">No assignable employees (all may already be under this TL or are TLs).</p>
              ) : (
                <div className="space-y-2">
                  {assignableList.map((emp) => (
                    <div key={emp.user_id} className="flex items-center justify-between p-2 hover:bg-accent rounded">
                      <div>
                        <div className="font-medium">{emp.full_name || emp.email}</div>
                        <div className="text-sm text-muted-foreground">{emp.email}</div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleAssignToTl(emp.user_id)}>
                        <Plus className="h-4 w-4 mr-1" />
                        Assign
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenAddToTlDialog(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Reassign Member to Another TL Dialog - admin/manager */}
      {canManageTLAssignments() && (
        <Dialog open={openReassignDialog} onOpenChange={(open) => { if (!open) setMemberToReassign(null); setOpenReassignDialog(open); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Reassign to Another Team Lead</DialogTitle>
              <DialogDescription>
                {memberToReassign ? `Reassign ${memberToReassign.full_name || memberToReassign.email} to a different team lead.` : 'Select the new team lead.'}
              </DialogDescription>
            </DialogHeader>
            {memberToReassign && (
              <div className="space-y-2">
                <Label>New Team Lead</Label>
                <Select onValueChange={(newTlId) => { handleReassignToTl(memberToReassign.user_id, newTlId); }}>
                  <SelectTrigger><SelectValue placeholder="Select team lead..." /></SelectTrigger>
                  <SelectContent>
                    {(teamLeads ?? []).filter(tl => tl.id !== selectedTlId).map((tl) => (
                      <SelectItem key={tl.id} value={tl.id}>
                        {tl.full_name || tl.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => { setOpenReassignDialog(false); setMemberToReassign(null); }}>Cancel</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}