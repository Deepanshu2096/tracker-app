# Fix: "Bucket not found" for profile photos

The app uploads profile photos to a Supabase Storage bucket named **`avatars`**. Create it once in your project.

## Option 1: Supabase Dashboard (recommended)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **Storage** in the left sidebar.
3. Click **New bucket**.
4. Set:
   - **Name:** `avatars`
   - **Public bucket:** **ON** (so profile image URLs work without auth).
5. Click **Create bucket**.

Optional: under **Bucket configuration** set **File size limit** to 2 MB and **Allowed MIME types** to `image/jpeg`, `image/png`, `image/webp`, `image/gif` if you want to enforce the same limits as the app.

## Option 2: SQL (if your project allows it)

Some projects allow inserting into `storage.buckets`. In **SQL Editor** run:

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  gen_random_uuid(),
  'avatars',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (name) DO NOTHING;
```

If you get "permission denied" or "relation does not exist", use **Option 1** instead.

## After the bucket exists

If uploads still fail with permission errors, add RLS policies for the `avatars` bucket by running the migration:

```bash
supabase db push
```

or run the contents of `supabase/migrations/create_avatars_storage_bucket.sql` in the SQL Editor (you can skip the `INSERT INTO storage.buckets` part if you already created the bucket via Dashboard).
