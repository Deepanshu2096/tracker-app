import { useState, useEffect } from 'react';
import { Send, Users, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useNotificationStore } from '@/store/notificationStore';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useTeamStore } from '@/store/teamStore';

export function SendNotificationDialog() {
  const { orgId, userRole } = useAuth();
  const { sendNotification, loading } = useNotificationStore();
  const { profiles, getProfiles } = useTeamStore();
  const { toast } = useToast();
  
  // Check if user can send notifications (HR, Manager, Team Lead, Admin)
  const canSendNotifications = () => {
    if (!userRole) return false;
    const role = userRole.toLowerCase();
    return ['hr', 'manager', 'team_lead', 'tl', 'teamlead', 'admin'].includes(role);
  };

  const isManagerOrTL = () => {
    if (!userRole) return false;
    const role = userRole.toLowerCase();
    return ['manager', 'team_lead', 'tl', 'teamlead'].includes(role);
  };

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'info' | 'warning' | 'success' | 'error'>('info');
  const [recipientType, setRecipientType] = useState<'all' | 'specific' | 'team'>(() => {
    if (!userRole) return 'all';
    const role = userRole.toLowerCase();
    return ['manager', 'team_lead', 'tl', 'teamlead'].includes(role) ? 'team' : 'all';
  });
  const [selectedRecipient, setSelectedRecipient] = useState<string>('');

  const { getTeamMembersFromProfile } = useTeamStore();
  const { user } = useAuth();
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([]);
  const [availableTeamMembers, setAvailableTeamMembers] = useState<any[]>([]);

  useEffect(() => {
    if (orgId && open) {
      getProfiles(orgId);
      
      // If manager/TL, load their team members
      if (isManagerOrTL() && user?.id) {
        loadTeamMembers();
      }
    }
  }, [orgId, open, user?.id]);

  const loadTeamMembers = async () => {
    if (!user?.id) return;
    try {
      const memberIds = await getTeamMembersFromProfile(user.id);
      setTeamMemberIds(memberIds);
      
      // Filter profiles to only show team members
      if (profiles && memberIds.length > 0) {
        const teamMembers = profiles.filter(p => 
          memberIds.includes(p.user_id) || memberIds.includes(p.id)
        );
        setAvailableTeamMembers(teamMembers);
      }
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  };

  if (!canSendNotifications()) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !message.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Title and message are required',
        variant: 'destructive',
      });
      return;
    }

    // Handle team notifications - send to all team members
    if (recipientType === 'team' && isManagerOrTL()) {
      if (availableTeamMembers.length === 0) {
        toast({
          title: 'Validation Error',
          description: 'No team members found. Please add team members first.',
          variant: 'destructive',
        });
        return;
      }

      // Send notification to each team member
      const results = await Promise.all(
        availableTeamMembers.map(member =>
          sendNotification(
            orgId!,
            title,
            message,
            type,
            member.id
          )
        )
      );

      const allSuccess = results.every(r => r.success);
      if (allSuccess) {
        toast({
          title: 'Success',
          description: `Notification sent to ${availableTeamMembers.length} team member(s)`,
        });
        setOpen(false);
        setTitle('');
        setMessage('');
        setType('info');
        setRecipientType('team');
        setSelectedRecipient('');
      } else {
        toast({
          title: 'Partial Success',
          description: 'Some notifications failed to send',
          variant: 'destructive',
        });
      }
      return;
    }

    const recipientId = recipientType === 'specific' && selectedRecipient 
      ? selectedRecipient 
      : null;

    const result = await sendNotification(
      orgId!,
      title,
      message,
      type,
      recipientId
    );

    if (result.success) {
      toast({
        title: 'Success',
        description: result.message,
      });
      setOpen(false);
      setTitle('');
      setMessage('');
      setType('info');
      setRecipientType('all');
      setSelectedRecipient('');
    } else {
      toast({
        title: 'Error',
        description: result.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Send className="h-4 w-4 mr-2" />
          Send Notification
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Send Notification</DialogTitle>
            <DialogDescription>
              {isManagerOrTL() 
                ? 'Send a notification to your team members or a specific team member'
                : 'Send a notification to all users or a specific user'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="recipient-type">Recipient</Label>
              <Select
                value={recipientType}
                onValueChange={(value) => {
                  setRecipientType(value as 'all' | 'specific' | 'team');
                  if (value === 'all') {
                    setSelectedRecipient('');
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {!isManagerOrTL() && (
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span>Everyone</span>
                      </div>
                    </SelectItem>
                  )}
                  {isManagerOrTL() && (
                    <SelectItem value="team">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span>My Team</span>
                      </div>
                    </SelectItem>
                  )}
                  <SelectItem value="specific">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>Specific User</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {recipientType === 'specific' && (
              <div className="space-y-2">
                <Label htmlFor="recipient">Select User</Label>
                <Select
                  value={selectedRecipient}
                  onValueChange={setSelectedRecipient}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(isManagerOrTL() ? availableTeamMembers : profiles).map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.full_name || profile.email || 'Unknown User'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {recipientType === 'team' && isManagerOrTL() && (
              <div className="space-y-2">
                <Label>Team Members</Label>
                <div className="text-sm text-muted-foreground">
                  Notification will be sent to all {availableTeamMembers.length} team member(s)
                </div>
                {availableTeamMembers.length === 0 && (
                  <div className="text-sm text-amber-600">
                    No team members found. Add team members from the Team page.
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select value={type} onValueChange={(value) => setType(value as typeof type)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter notification title..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter notification message..."
                rows={4}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Sending...' : 'Send Notification'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


