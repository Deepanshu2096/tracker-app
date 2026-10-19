import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useProfileStore, type EmployeeProfileUpdatePayload } from '@/store/profileStore';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Camera, X } from 'lucide-react';

export type EditProfileMode = 'first_time' | 'edit_request';

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: {
    id: string;
    user_id: string;
    org_id: string | null;
    birthday: string | null;
    doj: string | null;
    city: string | null;
    avatar_url?: string | null;
    full_name?: string | null;
    profile_submitted?: boolean | null;
    profile_status?: string | null;
    phone?: string | null;
    blood_group?: string | null;
    emergency_contact_phone?: string | null;
    employee_number?: string | null;
    asset?: string | null;
  };
  mode: EditProfileMode;
}

const LOCATION_OPTIONS = ['Jammu', 'Dehradun'] as const;
const BLOOD_GROUP_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] as const;

const ASSET_OPTIONS = [
  { value: 'office_laptop', label: 'Office Laptop' },
  { value: 'office_desktop', label: 'Office Desktop' },
  { value: 'personal_laptop_desktop', label: 'Personal Laptop/Desktop' },
] as const;

interface EditProfileFormData {
  full_name: string;
  employee_number: string;
  birthday: string;
  doj: string;
  city: string;
  phone: string;
  blood_group: string;
  emergency_contact_phone: string;
  asset: string;
}

const AVATAR_BUCKET = 'avatars';
const MAX_AVATAR_SIZE_MB = 2;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export function EditProfileDialog({
  open,
  onOpenChange,
  profile,
  mode,
}: EditProfileDialogProps) {
  const { updateProfile, submitFirstTimeProfile, submitChangeRequest, loading } = useProfileStore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<EditProfileFormData>({
    defaultValues: {
      full_name: profile.full_name || '',
      employee_number: profile.employee_number || '',
      birthday: profile.birthday ? String(profile.birthday).split('T')[0] : '',
      doj: profile.doj ? String(profile.doj).split('T')[0] : '',
      city: profile.city || '',
      phone: profile.phone || '',
      blood_group: profile.blood_group || '',
      emergency_contact_phone: profile.emergency_contact_phone || '',
      asset: profile.asset || '',
    },
  });

  useEffect(() => {
    if (open && profile) {
      form.reset({
        full_name: profile.full_name || '',
        employee_number: profile.employee_number || '',
        birthday: profile.birthday ? String(profile.birthday).split('T')[0] : '',
        doj: profile.doj ? String(profile.doj).split('T')[0] : '',
        city: profile.city || '',
        phone: profile.phone || '',
        blood_group: profile.blood_group || '',
        emergency_contact_phone: profile.emergency_contact_phone || '',
        asset: profile.asset || '',
      });
      setPhotoFile(null);
      setPhotoPreview(null);
      setRemoveAvatar(false);
    }
  }, [open, profile, form]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_AVATAR_SIZE_MB * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: `Please choose an image under ${MAX_AVATAR_SIZE_MB} MB`,
        variant: 'destructive',
      });
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Use JPEG, PNG, WebP or GIF',
        variant: 'destructive',
      });
      return;
    }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setRemoveAvatar(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onSubmit = async (data: EditProfileFormData) => {
    setIsSubmitting(true);
    try {
      let avatarUrl: string | null = removeAvatar ? null : (profile.avatar_url ?? null);

      if (photoFile && profile.org_id && !removeAvatar) {
        const ext = photoFile.name.split('.').pop() || 'jpg';
        const path = `${profile.org_id}/${profile.id}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from(AVATAR_BUCKET)
          .upload(path, photoFile, { upsert: true });

        if (uploadError) {
          const msg = uploadError.message || '';
          if (msg.includes('Bucket not found') || msg.includes('404'))
            throw new Error('Storage bucket "avatars" is missing. Create a public bucket named "avatars" in Supabase Dashboard → Storage. See docs/STORAGE_AVATARS_BUCKET.md.');
          throw new Error(msg || 'Failed to upload photo. Ensure the "avatars" bucket exists and is public.');
        }
        const { data: urlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
        avatarUrl = urlData.publicUrl;
      }

      const payload: EmployeeProfileUpdatePayload = {
        full_name: data.full_name || null,
        employee_number: data.employee_number || null,
        birthday: data.birthday || null,
        doj: data.doj || null,
        city: data.city || null,
        phone: data.phone || null,
        blood_group: data.blood_group || null,
        emergency_contact_phone: data.emergency_contact_phone || null,
        asset: data.asset || null,
        avatar_url: avatarUrl,
      };

      if (mode === 'first_time') {
        if (!profile.org_id) throw new Error('Organization not found');
        await submitFirstTimeProfile(profile.user_id, profile.org_id, payload);
        toast({
          title: 'Profile submitted',
          description: 'Your profile has been submitted. It is now read-only. Use "Request Edit" for future changes.',
        });
      } else {
        await submitChangeRequest(profile.user_id, profile.id, payload);
        toast({
          title: 'Update requested',
          description: 'Your change request has been sent to your team lead for approval.',
        });
      }

      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{mode === 'first_time' ? 'Complete Your Profile' : 'Request Profile Update'}</DialogTitle>
          <DialogDescription>
            {mode === 'first_time'
              ? 'Fill in your details and submit. After submission, the profile becomes read-only; use "Request Edit" for future changes.'
              : 'Request changes to your profile. Your team lead will review and approve or reject.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Profile photo */}
            <div className="space-y-2">
              <FormLabel>Profile Photo</FormLabel>
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20 border-2 border-muted">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="aspect-square size-full object-cover" />
                  ) : profile.avatar_url && !removeAvatar ? (
                    <AvatarImage src={profile.avatar_url} alt="Profile" />
                  ) : null}
                  <AvatarFallback className="bg-muted text-muted-foreground text-xl">
                    {profile.full_name?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ALLOWED_TYPES.join(',')}
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSubmitting || loading}
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    {photoFile ? 'Change photo' : 'Upload photo'}
                  </Button>
                  {(photoFile || (profile.avatar_url && !removeAvatar)) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearPhoto}
                      disabled={isSubmitting || loading}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Remove photo
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                JPEG, PNG, WebP or GIF. Max {MAX_AVATAR_SIZE_MB} MB.
              </p>
            </div>

            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Your full name" {...field} disabled={isSubmitting || loading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Employee ID - commented out
            <FormField
              control={form.control}
              name="employee_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employee ID</FormLabel>
                  <FormControl>
                    <Input placeholder="Employee ID" {...field} disabled={isSubmitting || loading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            */}

            <FormField
              control={form.control}
              name="birthday"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date of Birth</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      disabled={isSubmitting || loading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="doj"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date of Joining</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      disabled={isSubmitting || loading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <Select
                    value={field.value || ''}
                    onValueChange={field.onChange}
                    disabled={isSubmitting || loading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {LOCATION_OPTIONS.map((loc) => (
                        <SelectItem key={loc} value={loc}>
                          {loc}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mobile number</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder="Mobile number"
                      {...field}
                      disabled={isSubmitting || loading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="blood_group"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Blood group</FormLabel>
                  <Select
                    value={field.value || ''}
                    onValueChange={field.onChange}
                    disabled={isSubmitting || loading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select blood group" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {BLOOD_GROUP_OPTIONS.map((bg) => (
                        <SelectItem key={bg} value={bg}>
                          {bg}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="emergency_contact_phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Emergency contact number</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder="Emergency contact number"
                      {...field}
                      disabled={isSubmitting || loading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="asset"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Asset</FormLabel>
                  <Select
                    value={field.value || ''}
                    onValueChange={field.onChange}
                    disabled={isSubmitting || loading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select asset..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ASSET_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting || loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || loading}>
                {isSubmitting || loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  mode === 'first_time' ? 'Submit Profile' : 'Submit Request'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

